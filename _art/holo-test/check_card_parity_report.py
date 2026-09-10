# -*- coding: utf-8 -*-
"""把 check_card_parity.py 的原始資料判成 PASS/FAIL。

驗收標準（ORDER-2026-09-11-parity.md）：
  同一張正式卡，在抽卡揭卡、卡池、編隊總覽與詳情裡，卡面設計／字體階層／配色／
  效果一致；尺寸差異只允許來自共用縮放規則。**參考基準是抽卡揭卡。**

分三類，刻意不混在一起：
  A. 硬契約——不需要容差（身分、文字設計、字型證據、CSS 變數契約、完整性）。
  B. 同尺寸中性姿態的幾何——所有卡就地設成同一個未變形 content-box 寬度、
     關掉 transform 再量，所以可以直接比原始 px，不必拿投影寬去抵銷選取放大。
  C. 原生姿態——只留有硬判準的項目（單行、寶石交疊、投影倍率）。

用法：
    python check_card_parity_report.py --input <parity-*.json> [--reference gacha-test]
"""
from __future__ import annotations
import argparse, json, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

TEXT_IDENTICAL = ['fontFamily', 'fontStyle', 'fontWeight', 'color', 'webkitTextFillColor',
                  'backgroundImage', 'backgroundClip', 'opacity', 'textTransform',
                  'whiteSpace', 'textAlign', 'mixBlendMode', 'lineHeight']
TEXT_SAMESIZE = TEXT_IDENTICAL + ['fontSize', 'letterSpacing', 'textShadow', 'filter']
BOX_SAMESIZE = ['width', 'height', 'padding', 'margin', 'gap', 'borderTopWidth',
                'borderTopColor', 'borderRadius', 'backgroundImage', 'backgroundColor',
                'boxShadow', 'opacity', 'filter', 'mixBlendMode',
                'left', 'right', 'top', 'bottom', 'position']

EMBEDDED = 'Noto Sans TC'
RARITY_TO_NAME = 13.5 / 24
VAR_EPS = 0.011
GEOM_EPS = 0.011


# ---------------------------------------------------------------- 獨立預期清單
# 這一段刻意不看輸入資料裡有什麼，而是從資料來源（卡池、編隊全集）與入口定義反推
# 「應該收到哪些樣本」。2026-09-11 Astra 示範過：預期清單若取自輸入自己，
# 刪掉整個 pool 入口、刪掉某張卡、刪掉全部手機詳情，驗收器都還是 EXIT 0。
ALL_ENTRIES = ['demo', 'demo-standalone', 'pool', 'pool-standalone', 'gacha',
               'gacha-standalone', 'gacha-test', 'gacha-test-standalone', 'team']
FIXTURE_ENTRIES = ['gacha-test', 'gacha-test-standalone']
RANDOM_ENTRIES = ['gacha', 'gacha-standalone']
POOL_ENTRIES = ['demo', 'demo-standalone', 'pool', 'pool-standalone']
REQUIRED = ['nameStyle', 'rarityStyle', 'plate', 'gem', 'frame',
            'rarityRange', 'nameRange', 'rarityClear', 'nameClear', 'contentWidth']


def source_ids(root):
    """⚠ 預期清單必須從**原始碼／資料來源**讀，不能讀待驗 JSON 自己帶的欄位。
    2026-09-11 Astra 示範：只要把 JSON 裡的 expectedPoolIds 一起改掉，
    預期清單就跟著縮水，刪掉的卡再也驗不出來。"""
    import re as _re
    root = Path(root)
    sys.path.insert(0, str(root))
    from pool_data import pool
    pool_ids = {c['id'] for c in pool()}
    m = _re.search(r'const TEAM_DATA=(\{.*?\});',
                   (root / 'map20.html').read_text(encoding='utf-8'), _re.S)
    team_ids = {c['id'] for c in json.loads(m.group(1))['cards']} if m else set()
    return pool_ids, team_ids


def expected_manifest(pool_ids, team_ids):
    man = {}
    for e in ALL_ENTRIES:
        if e in FIXTURE_ENTRIES:
            man[e] = {'roles': ['reveal'], 'ids': pool_ids, 'count': None}
        elif e in RANDOM_ENTRIES:
            man[e] = {'roles': ['reveal'], 'ids': None, 'count': 10}
        elif e in POOL_ENTRIES:
            man[e] = {'roles': ['grid'], 'ids': pool_ids, 'count': None}
        elif e == 'team':
            man[e] = {'roles': ['overview', 'detail'], 'ids': team_ids, 'count': None}
    return man


def finite(v):
    """NaN／Infinity 不是合格的量測值。Python 的 json 預設會接受它們，所以要自己擋。"""
    return isinstance(v, (int, float)) and v == v and v not in (float('inf'), float('-inf'))


def bad_numbers(obj, path=''):
    """遞迴找出所有非有限數值的位置。"""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            out += bad_numbers(v, '%s.%s' % (path, k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += bad_numbers(v, '%s[%d]' % (path, i))
    elif isinstance(obj, float) and not finite(obj):
        out.append(path)
    return out


def px(v):
    try:
        return float(str(v).removesuffix('px'))
    except Exception:
        return None


def cid(c):
    """demo 的正式卡 DOM id 是 pool-<id>（demo.html:669），要還原成卡池 ID。"""
    return c.get('canonicalId') or (c.get('id') or '').replace('pool-', '')


def cards_of(data, entry, pose=None):
    out = []
    for vp, rec in data['entries'].get(entry, {}).get('viewports', {}).items():
        if not isinstance(rec, dict) or rec.get('error'):
            continue
        for c in rec.get('cards', []):
            if c.get('error'):
                continue
            if pose is not None and c.get('pose', 'native') != pose:
                continue
            out.append(c)
    return out


class Report:
    def __init__(self):
        self.fails, self.notes = [], []

    def chk(self, ok, msg):
        print(('PASS ' if ok else 'FAIL ') + msg)
        if not ok:
            self.fails.append(msg)

    def note(self, msg):
        self.notes.append(msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--reference', default='gacha-test')
    ap.add_argument('--expect-entries', default=None)
    ap.add_argument('--expect-viewports', default=None)
    ap.add_argument('--root', default=str(Path(__file__).resolve().parent),
                    help='原始碼目錄，預期清單從這裡讀')
    args = ap.parse_args()

    data = json.loads(Path(args.input).read_text(encoding='utf-8'))
    R = Report()
    entries = data['entries']
    fixture = data.get('fixtureIds', [])

    print('== 環境')
    print('  chromium=%s  viewports=%s  label=%s  inject=%s'
          % (data.get('chromium'), data.get('viewports'), data.get('label'), data.get('inject')))
    print('  固定序列 %d 張' % len(fixture))

    # ------------------------------------------------ 0. 完整性（缺件即 FAIL）
    print('')
    print('== 0. 入口／尺寸／取樣完整性（預期清單由資料來源反推，不看輸入有什麼）')
    pool_ids_src, team_ids_src = source_ids(args.root)
    man = expected_manifest(pool_ids_src, team_ids_src)
    want = (args.expect_entries.split(',') if args.expect_entries else ALL_ENTRIES)
    want_vps = (args.expect_viewports.split(',') if args.expect_viewports
                else ['1440x900', '1024x900', '390x844'])
    R.chk(bool(pool_ids_src) and bool(team_ids_src),
          '預期清單來自原始碼：卡池 %d 張、編隊 %d 張（不是讀待驗 JSON 的欄位）'
          % (len(pool_ids_src), len(team_ids_src)))
    # 待驗 JSON 若自稱的清單與來源不符，本身就是可疑
    R.chk(set(data.get('expectedPoolIds', [])) == pool_ids_src,
          'JSON 自帶的 expectedPoolIds 與原始碼一致（%d vs %d）'
          % (len(data.get('expectedPoolIds', [])), len(pool_ids_src)))
    R.chk(set(data.get('expectedTeamIds', [])) == team_ids_src,
          'JSON 自帶的 expectedTeamIds 與原始碼一致（%d vs %d）'
          % (len(data.get('expectedTeamIds', [])), len(team_ids_src)))
    for name in want:
        e = entries.get(name)
        if not e or e.get('error'):
            R.chk(False, '%s: 入口缺漏或載入失敗（%s）' % (name, (e or {}).get('error')))
            continue
        for vp in want_vps:
            rec = e.get('viewports', {}).get(vp)
            if not isinstance(rec, dict) or rec.get('error'):
                R.chk(False, '%s %s: 缺這個尺寸（%s）' % (name, vp, (rec or {}).get('error')))
                continue
            act = rec.get('activation', {})
            if act.get('error'):
                R.chk(False, '%s %s 啟動失敗: %s' % (name, vp, act['error']))
                continue
            bad = [(c.get('id'), c.get('error')) for c in rec.get('cards', []) if c.get('error')]
            R.chk(not bad, '%s %s: 取樣失敗 %d 筆 %s' % (name, vp, len(bad), bad[:3]))
            nan = bad_numbers(rec, '%s.%s' % (name, vp))
            R.chk(not nan, '%s %s: 非有限數值 %d 處 %s' % (name, vp, len(nan), nan[:3]))
            spec = man.get(name)
            if not spec:
                continue
            good = [c for c in rec.get('cards', []) if not c.get('error')]
            for pose in ('native', 'neutral'):
                rows = [c for c in good if c.get('pose', 'native') == pose]
                for role in spec['roles']:
                    inst = [c for c in rows if c.get('role') == role]
                    got = {cid(c) for c in inst}
                    if spec['ids'] is not None:
                        miss = sorted(spec['ids'] - got)
                        R.chk(not miss, '%s %s [%s/%s]: 預期 %d 張，缺 %d 張 %s'
                              % (name, vp, pose, role, len(spec['ids']), len(miss), miss[:5]))
                    else:
                        # 正式版是隨機抽，同一張可能抽到兩次，所以算「筆數」不是不重複 ID
                        R.chk(len(inst) >= spec['count'],
                              '%s %s [%s/%s]: 至少要 %d 筆，實得 %d 筆（%d 種）'
                              % (name, vp, pose, role, spec['count'], len(inst), len(got)))
                        # 十連要來自十個不同槽位，不能是同一槽複製十份
                        if pose == 'native':
                            # 同尺寸那趟會把每張卡就地改寬度、關掉版面變形，位置會疊在一起，
                            # 所以槽位唯一性只在原生姿態成立。
                            slots = {(c.get('shadowPath'), c.get('instance'),
                                      round((c.get('box') or {}).get('x', -1), 1),
                                      round((c.get('box') or {}).get('y', -1), 1)) for c in inst}
                            R.chk(len(slots) >= spec['count'],
                                  '%s %s [%s/%s]: 要有 %d 個不同槽位，實得 %d'
                                  % (name, vp, pose, role, spec['count'], len(slots)))
                        drawn = sorted(act.get('drawnIds') or [])
                        R.chk(drawn == sorted(cid(c) for c in inst),
                              '%s %s [%s/%s]: 樣本 ID 與 drawnIds 相符'
                              % (name, vp, pose, role))
            # 內層 schema：物件在不代表欄位在（Astra 示範過把 rarityClear 換成 {"missing":true}）
            INNER = {'rarityRange': ('w', 'h', 'lines'), 'nameRange': ('w', 'h', 'lines'),
                     'rarityClear': ('left', 'right'), 'nameClear': ('left', 'right'),
                     'plate': ('width', 'height', 'gap'), 'gem': ('width', 'height'),
                     'frame': ('width', 'height'),
                     'nameStyle': ('fontSize', 'fontFamily', 'color'),
                     'rarityStyle': ('fontSize', 'fontFamily', 'color')}
            SCALARS = ('lineGap', 'gemOverlapArea', 'contentWidth', 'box', 'shadowPath', 'role')
            missing_fields = []
            for c in good:
                for k in REQUIRED:
                    if c.get(k) in (None, {}, ''):
                        missing_fields.append((cid(c), c.get('role'), c.get('pose', 'native'), k))
                for k, inner in INNER.items():
                    v = c.get(k)
                    if isinstance(v, dict):
                        for kk in inner:
                            if v.get(kk) is None:
                                missing_fields.append((cid(c), c.get('role'),
                                                       c.get('pose', 'native'), '%s.%s' % (k, kk)))
                for k in SCALARS:
                    if c.get(k) is None:
                        missing_fields.append((cid(c), c.get('role'), c.get('pose', 'native'), k))
                # 要比的樣式鍵必須存在，否則「差異 0」只是因為兩邊都沒有這個鍵
                for part, keys in (('nameStyle', TEXT_SAMESIZE), ('rarityStyle', TEXT_SAMESIZE),
                                   ('plate', BOX_SAMESIZE), ('gem', BOX_SAMESIZE),
                                   ('frame', BOX_SAMESIZE)):
                    v = c.get(part)
                    if isinstance(v, dict):
                        for kk in keys:
                            if kk not in v:
                                missing_fields.append((cid(c), c.get('role'),
                                                       c.get('pose', 'native'), '%s.%s 缺鍵' % (part, kk)))
                if c.get('instance') is None:
                    missing_fields.append((cid(c), c.get('role'), c.get('pose', 'native'), 'instance'))
                # 焦點卡（揭卡、詳情）一定要在視窗內，否則等於沒真的呈現；
                # 卡池／demo 是長格線頁，卡片在摺線下方是捲動位置，不是缺陷——
                # 那些頁的版面數值不需要進視窗也成立，只有截圖才需要。
                if (c.get('pose', 'native') == 'native' and c.get('role') == 'detail'
                        and not c.get('inViewport')):
                    missing_fields.append((cid(c), c.get('role'), 'native', 'not in viewport'))
                if not c.get('contentWidth'):
                    missing_fields.append((cid(c), c.get('role'), c.get('pose', 'native'), 'contentWidth=0'))
                if c.get('pose', 'native') == 'native' and not c.get('visible'):
                    missing_fields.append((cid(c), c.get('role'), 'native', 'not visible'))
                if not c.get('rarityFsVar') or not c.get('nameFsVar'):
                    missing_fields.append((cid(c), c.get('role'), c.get('pose', 'native'), 'fs var'))
            R.chk(not missing_fields, '%s %s: 必填欄位缺漏 %d 筆 %s'
                  % (name, vp, len(missing_fields), missing_fields[:3]))
            # 同尺寸那趟要與原生逐實例對應：同一張卡有幾個實例，中性也要有幾個，
            # 而且 shadowPath+instance 要對得起來，不能整批換成第一筆的複本
            def sig(rows):
                out = {}
                for c in rows:
                    out.setdefault((cid(c), c.get('role')), set()).add(
                        (c.get('shadowPath'), c.get('instance')))
                return out
            nat = sig([c for c in good if c.get('pose', 'native') == 'native'])
            neu = sig([c for c in good if c.get('pose', 'native') == 'neutral'])
            mism = sorted(k for k in nat if neu.get(k) != nat[k])
            R.chk(not mism, '%s %s: 中性姿態與原生逐實例對應；不符 %d 組 %s'
                  % (name, vp, len(mism), [(a, b, sorted(nat[(a, b)])[:2],
                                            sorted(neu.get((a, b)) or [])[:2]) for a, b in mism][:2]))
            # 這個畫面至少要有卡真的落在視窗裡，否則等於沒呈現
            focal = [c for c in good if c.get('pose', 'native') == 'native']
            R.chk(any(c.get('inViewport') for c in focal),
                  '%s %s: 至少有一張卡真的在視窗內（%d/%d）'
                  % (name, vp, sum(1 for c in focal if c.get('inViewport')), len(focal)))
            R.chk('pageErrors' in rec and 'brokenImages' in rec,
                  '%s %s: 有錯誤採集欄位（pageErrors／brokenImages）' % (name, vp))
            R.chk(not rec.get('pageErrors'), '%s %s: 頁面錯誤／console error %d 筆 %s'
                  % (name, vp, len(rec.get('pageErrors') or []), (rec.get('pageErrors') or [])[:2]))
            R.chk(not rec.get('brokenImages'), '%s %s: 壞圖 %d 張 %s'
                  % (name, vp, len(rec.get('brokenImages') or []), (rec.get('brokenImages') or [])[:2]))
            if name in FIXTURE_ENTRIES + RANDOM_ENTRIES:
                cer = act.get('ceremony')
                R.chk(bool(cer), '%s %s: 有揭卡儀式證據' % (name, vp))
                if cer:
                    R.chk(all(b.get('screen') == 'results' for b in cer),
                          '%s %s: 每一批都到 results' % (name, vp))
                    if name in FIXTURE_ENTRIES:
                        R.chk(all((b.get('complete') or 0) == len(b.get('ids') or [])
                                  and (b.get('complete') or 0) > 0 for b in cer),
                              '%s %s: 每批 complete 等於該批張數（實得 %s）'
                              % (name, vp, [(b.get('complete'), len(b.get('ids') or [])) for b in cer]))
                    if name in RANDOM_ENTRIES:
                        R.chk(all((b.get('complete') or 0) == 10 for b in cer),
                              '%s %s: 正式版每批 complete=10（實得 %s）'
                              % (name, vp, [b.get('complete') for b in cer]))
                        R.chk(len(act.get('drawnIds') or []) == 10,
                              '%s %s: drawnIds 有 10 筆（實得 %d）'
                              % (name, vp, len(act.get('drawnIds') or [])))
    # ------------------------------------------------ 1. 揭卡真的揭開了
    print('\n== 1. 抽卡：儀式狀態與固定序列')
    for name, e in entries.items():
        if not isinstance(e, dict) or e.get('error'):
            continue
        for vp, rec in e.get('viewports', {}).items():
            if not isinstance(rec, dict) or rec.get('error'):
                continue
            cer = (rec.get('activation') or {}).get('ceremony')
            if not cer:
                continue
            for b in cer:
                R.chk(b.get('error') is None and b.get('screen') == 'results',
                      '%s %s batch%d: screen=%s complete=%s err=%s'
                      % (name, vp, b['batch'], b.get('screen'), b.get('complete'), b.get('error')))
            if all(b.get('ids') is None for b in cer):
                R.note('%s %s: 正式版用真實 UI 隨機抽，沒有固定序列可比（抽到 %s）'
                       % (name, vp, ((rec.get('activation') or {}).get('drawnIds') or [])[:4]))
                continue
            # ⚠ 固定序列的期望值由**原始碼的卡池**推導，不看待驗 JSON 的 fixtureIds
            want_seq = sorted(pool_ids_src)
            n_batches = (len(want_seq) + 9) // 10
            R.chk(len(cer) == n_batches,
                  '%s %s: 儀式批次數 %d（卡池 %d 張，每批 10 張應為 %d 批）'
                  % (name, vp, len(cer), len(want_seq), n_batches))
            got = [i for b in cer for i in (b.get('ids') or [])]
            same = sum(1 for a, b in zip(got, want_seq) if a == b)
            R.chk(got == want_seq,
                  '%s %s: 揭卡序列與卡池順序逐位相同（%d/%d）' % (name, vp, same, len(want_seq)))
            R.chk(list(data.get('fixtureIds') or []) == want_seq,
                  '%s %s: JSON 自帶的 fixtureIds 與原始碼卡池一致' % (name, vp))

    # ------------------------------------------------ 2. 字型證據
    print('\n== 2. 字型證據（逐節點、保留 CDP node ID、無筆數上限）')
    for name, e in entries.items():
        if not isinstance(e, dict) or e.get('error'):
            continue
        for vp, rec in e.get('viewports', {}).items():
            if not isinstance(rec, dict) or rec.get('error'):
                continue
            err, fb, custom, empty, nonid = [], [], [], [], []
            for c in rec.get('cards', []):
                if c.get('error') or c.get('pose') == 'neutral':
                    continue
                for part in ('name', 'rarity'):
                    pf = c.get('platformFonts', {}).get(part, {})
                    if pf.get('error'):
                        err.append((cid(c), c.get('role'), part, pf['error']))
                        continue
                    if not pf.get('nodeId'):
                        nonid.append((cid(c), c.get('role'), part))
                    fonts, text = pf.get('fonts', []), (c.get(part + 'Text') or '')
                    if not fonts:
                        if c.get('visible') and text.strip():
                            empty.append((cid(c), c.get('role'), part))
                        continue
                    for f in fonts:
                        if f['familyName'] != EMBEDDED:
                            fb.append((cid(c), c.get('role'), part, f['familyName'], f['glyphCount']))
                        elif not f['isCustomFont']:
                            custom.append((cid(c), c.get('role'), part, f['familyName']))
            R.chk(not err, '%s %s: 字型取樣錯誤 %d %s' % (name, vp, len(err), err[:2]))
            R.chk(not empty, '%s %s: 可見文字沒有字型證據 %d %s' % (name, vp, len(empty), empty[:2]))
            R.chk(not fb, '%s %s: 非預期 fallback %d %s' % (name, vp, len(fb), fb[:3]))
            R.chk(not custom, '%s %s: 非內嵌字型 %d %s' % (name, vp, len(custom), custom[:2]))
            R.chk(not nonid, '%s %s: 缺 CDP node ID %d %s' % (name, vp, len(nonid), nonid[:2]))

    # ------------------------------------------------ 3. 字級契約
    print('\n== 3. 字級契約（--rarity-fs 生效、主副標比例 13.5/24）')
    for name, e in entries.items():
        if not isinstance(e, dict) or e.get('error'):
            continue
        for vp, rec in e.get('viewports', {}).items():
            if not isinstance(rec, dict) or rec.get('error'):
                continue
            worst_v = worst_r = 0.0
            wid, skipped = None, []
            for c in rec.get('cards', []):
                if c.get('error') or not c.get('rarityStyle'):
                    continue
                if not c.get('visible') or not c.get('rarityFsVar'):
                    skipped.append((cid(c), c.get('role'), c.get('pose', 'native')))
                    continue
                fs, nfs = px(c['rarityStyle']['fontSize']), px(c['nameStyle']['fontSize'])
                v = px(c['rarityFsVar'])
                if v is not None:
                    worst_v = max(worst_v, abs(fs - v))
                d = abs(fs - nfs * RARITY_TO_NAME)
                if d > worst_r:
                    worst_r, wid = d, (cid(c), c.get('role'), c.get('pose', 'native'))
            R.chk(worst_v < VAR_EPS, '%s %s: |fontSize − --rarity-fs| 最大 %.4fpx' % (name, vp, worst_v))
            R.chk(worst_r < VAR_EPS,
                  '%s %s: |rarityFS − nameFS×0.5625| 最大 %.4fpx %s' % (name, vp, worst_r, wid))
            if skipped:
                R.note('%s %s: 未顯示／未 refit 未套字級門檻 %d 筆 %s'
                       % (name, vp, len(skipped), skipped[:3]))

    # ------------------------------------------------ 4. 同尺寸中性姿態的卡面一致性
    print('\n== 4. 卡面一致性（同尺寸中性姿態，參考＝%s）' % args.reference)
    ref = {}
    for c in cards_of(data, args.reference, pose='neutral'):
        ref.setdefault((c['viewport'], cid(c)), c)
    if not ref:
        R.chk(False, '參考入口 %s 沒有同尺寸中性姿態樣本' % args.reference)
    else:
        for name in entries:
            if name == args.reference:
                continue
            rows = [c for c in cards_of(data, name, pose='neutral') if cid(c) in pool_ids_src]
            if not rows:
                R.chk(False, '%s: 沒有可比的同尺寸樣本 —— 不能當成通過' % name)
                continue
            uncovered = sorted({cid(c) for c in rows if (c['viewport'], cid(c)) not in ref})
            R.chk(not uncovered, '%s: %d 筆同尺寸樣本全部有參考對象；未覆蓋 %d %s'
                  % (name, len(rows), len(uncovered), uncovered[:5]))
            diffs, compared = [], 0
            for c in rows:
                r = ref.get((c['viewport'], cid(c)))
                if not r:
                    continue
                compared += 1
                for k in ('rarity', 'kind', 'nameText', 'rarityText'):
                    if r.get(k) != c.get(k):
                        diffs.append((cid(c), c.get('role'), 'card', k, r.get(k), c.get(k)))
                for part in ('nameStyle', 'rarityStyle'):
                    a, b = r.get(part) or {}, c.get(part) or {}
                    for k in TEXT_SAMESIZE:
                        if a.get(k) != b.get(k):
                            diffs.append((cid(c), c.get('role'), part, k, a.get(k), b.get(k)))
                for part in ('plate', 'gem', 'frame'):
                    a, b = r.get(part) or {}, c.get(part) or {}
                    for k in BOX_SAMESIZE:
                        if a.get(k) != b.get(k):
                            diffs.append((cid(c), c.get('role'), part, k, a.get(k), b.get(k)))
            R.chk(not diffs, '%s: 同尺寸比對 %d 張，列入比較的屬性差異 %d 項 %s'
                  % (name, compared, len(diffs), diffs[:3]))

    # ------------------------------------------------ 5. 同尺寸幾何（原始 px）
    print('\n== 5. 同尺寸中性姿態的幾何（原始 px，門檻 %.3fpx）' % GEOM_EPS)
    GEOM = [('rarityRange.w', lambda x: (x.get('rarityRange') or {}).get('w')),
            ('rarityRange.h', lambda x: (x.get('rarityRange') or {}).get('h')),
            ('rarityRange.lines', lambda x: (x.get('rarityRange') or {}).get('lines')),
            ('lineGap', lambda x: x.get('lineGap')),
            ('rarityClear.left', lambda x: (x.get('rarityClear') or {}).get('left')),
            ('rarityClear.right', lambda x: (x.get('rarityClear') or {}).get('right')),
            ('nameClear.left', lambda x: (x.get('nameClear') or {}).get('left')),
            ('nameClear.right', lambda x: (x.get('nameClear') or {}).get('right')),
            ('gemOverlapArea', lambda x: x.get('gemOverlapArea'))]
    if ref:
        for name in entries:
            if name == args.reference:
                continue
            rows = [c for c in cards_of(data, name, pose='neutral') if cid(c) in pool_ids_src]
            if not rows:
                continue
            bad = []
            for c in rows:
                r = ref.get((c['viewport'], cid(c)))
                if not r:
                    continue
                for label, get in GEOM:
                    a, b = get(r), get(c)
                    if a is None or b is None:
                        continue
                    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
                        # lineGap／clear 在收集端已除過未變形卡寬，同尺寸下分母相同
                        scale = c.get('sameSizeWidth') or 1
                        if abs(a - b) * (scale if label != 'gemOverlapArea' else 1) > GEOM_EPS:
                            bad.append((cid(c), c.get('role'), label, round(a, 5), round(b, 5)))
                    elif a != b:
                        bad.append((cid(c), c.get('role'), label, a, b))
            R.chk(not bad, '%s: 同尺寸幾何與參考差異 %d 項 %s' % (name, len(bad), bad[:3]))

    # ------------------------------------------------ 6. 原生姿態的硬判準
    print('\n== 6. 原生姿態的硬判準')
    for name in entries:
        rows = [c for c in cards_of(data, name, pose='native')
                if c.get('visible') and c.get('rarityRange') and cid(c) in pool_ids_src]
        if not rows:
            continue
        lines = [c['rarityRange']['lines'] for c in rows]
        R.chk(all(l == 1 for l in lines),
              '%s: 稀有度全部單行（%d 張，最多 %d 行）' % (name, len(rows), max(lines)))
        ov = [(cid(c), c.get('role'), c['gemOverlapArea']) for c in rows
              if (c.get('gemOverlapArea') or 0) > 0]
        R.chk(not ov, '%s: 稀有度與寶石零交疊（%d 張命中）%s' % (name, len(ov), ov[:2]))
        odd, zoom = [], 0
        for c in rows:
            sc = ((c.get('box') or {}).get('w') or 0) / (c.get('contentWidth') or 1)
            if abs(sc - 1.0) <= 0.001:
                continue
            # 1.04 是 hover／選取放大，抽卡結果面與編隊總覽共用同一條規則
            # （ceremony.css `.slot.done.selected`、team20.css `[aria-selected=true]`）。
            # 綁在「這張卡當下真的是選取狀態」，不是綁在哪個畫面。
            if abs(sc - 1.04) <= 0.001 and c.get('selectedState'):
                zoom += 1
                continue
            odd.append((cid(c), c.get('role'), round(sc, 4)))
        R.chk(not odd, '%s: 投影倍率只有 1.0，或選取／hover 狀態的 1.04（放大中 %d 張）；例外 %d %s'
              % (name, zoom, len(odd), odd[:3]))

    print('\n== 觀察（不計入通過與否）')
    for n in R.notes:
        print('  -', n)
    print('\n== 結果：%s' % ('全綠' if not R.fails else '%d 項 FAIL' % len(R.fails)))
    return 1 if R.fails else 0


if __name__ == '__main__':
    sys.exit(main())
