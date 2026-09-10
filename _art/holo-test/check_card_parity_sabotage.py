# -*- coding: utf-8 -*-
"""記憶體負控制：把一份合格的 parity JSON 照既知的手法弄壞，正式判定器必須非零退出。

這些破壞手法都是 Astra 在 2026-09-11 兩輪驗收裡示範出來的假通過。
每一種都從原始 JSON 複製後**單獨**破壞，不改判定器。

用法：
    python check_card_parity_sabotage.py --input <合格的 parity-*.json>
"""
from __future__ import annotations
import argparse, copy, json, subprocess, sys, io
from pathlib import Path

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stdout = _OUT
HERE = Path(__file__).resolve().parent


def drop_entry(d):
    d['entries'].pop('pool', None)


def drop_card(d):
    for vp in d['entries']['pool']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('canonicalId') != 'rocketdog']


def drop_detail(d):
    for vp in d['entries']['team']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('role') != 'detail']


def blank_required(d):
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            c['visible'] = False
            c['rarityFsVar'] = c['nameFsVar'] = ''
            c['rarityRange'] = None


def shrink_manifest(d):
    """連 JSON 自帶的預期清單一起改小——判定器若讀它就會跟著瞎掉。"""
    d['expectedPoolIds'] = [i for i in d.get('expectedPoolIds', []) if i != 'rocketdog']
    for vp in d['entries']['pool']['viewports'].values():
        vp['cards'] = [c for c in vp['cards'] if c.get('canonicalId') != 'rocketdog']


def hollow_geometry(d):
    """物件還在，裡面的欄位掏空。"""
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            c['rarityClear'] = {'missing': True}
            c['nameClear'] = {'missing': True}
            c.pop('lineGap', None)
            c.pop('gemOverlapArea', None)


def clone_one_slot(d):
    """十連變成同一槽複製十份。"""
    for vp in d['entries']['gacha']['viewports'].values():
        for pose in ('native', 'neutral'):
            rows = [c for c in vp['cards'] if c.get('pose', 'native') == pose]
            if not rows:
                continue
            others = [c for c in vp['cards'] if c.get('pose', 'native') != pose]
            vp['cards'] = others + [copy.deepcopy(rows[0]) for _ in range(len(rows))]


def zero_complete(d):
    for vp in d['entries']['gacha-test']['viewports'].values():
        for b in (vp.get('activation') or {}).get('ceremony') or []:
            b['complete'] = 0


def detail_offscreen(d):
    for vp in d['entries']['team']['viewports'].values():
        for c in vp['cards']:
            if c.get('role') == 'detail':
                c['inViewport'] = False


CASES = [
    ('drop-entry', '刪掉整個 pool 入口', drop_entry),
    ('drop-card', '刪掉 pool 的 rocketdog', drop_card),
    ('drop-detail', '刪掉編隊全部手機詳情', drop_detail),
    ('blank-required', 'pool 全標不可見＋清必填', blank_required),
    ('shrink-manifest', '連 JSON 自帶的預期清單一起改小', shrink_manifest),
    ('hollow-geometry', '幾何物件在、內層欄位掏空', hollow_geometry),
    ('clone-one-slot', '十連變成同一槽複製十份', clone_one_slot),
    ('zero-complete', '固定抽卡 complete 改成 0', zero_complete),
    ('detail-offscreen', '詳情全部標成視窗外', detail_offscreen),
]


# ---- 2026-09-11 第二批：Astra 在 VERDICT-v4 示範的五種 ----

def drop_error_fields(d):
    """錯誤採集欄位整個消失——缺 key 不能被當成空清單。"""
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            vp.pop('pageErrors', None)
            vp.pop('brokenImages', None)


def drop_instance(d):
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            for c in vp.get('cards', []):
                c.pop('instance', None)


def drop_design_keys(d):
    for e in d['entries'].values():
        for vp in (e.get('viewports') or {}).values():
            for c in vp.get('cards', []):
                for part in ('nameStyle', 'rarityStyle'):
                    if isinstance(c.get(part), dict):
                        c[part].pop('fontWeight', None)
                if isinstance(c.get('frame'), dict):
                    c['frame'].pop('backgroundImage', None)


def truncate_fixture(d):
    d['fixtureIds'] = d['fixtureIds'][:10]
    for name in ('gacha-test', 'gacha-test-standalone'):
        for rec in d['entries'][name]['viewports'].values():
            rec['activation']['ceremony'] = rec['activation']['ceremony'][:1]


def clone_neutral(d):
    for vp in d['entries']['gacha']['viewports'].values():
        first = {}
        for c in vp['cards']:
            if c.get('pose') != 'neutral':
                continue
            k = c.get('canonicalId')
            if k not in first:
                first[k] = copy.deepcopy(c)
        vp['cards'] = [c if c.get('pose') != 'neutral'
                       else copy.deepcopy(first[c.get('canonicalId')]) for c in vp['cards']]


def nan_values(d):
    for vp in d['entries']['pool']['viewports'].values():
        for c in vp['cards']:
            if isinstance(c.get('rarityClear'), dict):
                c['rarityClear']['left'] = float('nan')


CASES += [
    ('drop-error-fields', '錯誤採集欄位整個消失', drop_error_fields),
    ('drop-instance', '實例序號消失', drop_instance),
    ('drop-design-keys', '必驗設計欄位消失', drop_design_keys),
    ('truncate-fixture', '固定揭卡證據只剩第一批', truncate_fixture),
    ('clone-neutral', '中性姿態全換成第一筆複本', clone_neutral),
    ('nan-values', '幾何值改成 NaN', nan_values),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True)
    ap.add_argument('--reference', default='gacha-test')
    args = ap.parse_args()
    src_path = Path(args.input)
    src = json.loads(src_path.read_text(encoding='utf-8'))
    out_dir = src_path.parent

    def run(d, label):
        f = out_dir / ('parity-sabotage-%s.json' % label)
        f.write_text(json.dumps(d, ensure_ascii=False), encoding='utf-8')
        r = subprocess.run([sys.executable, str(HERE / 'check_card_parity_report.py'),
                            '--input', str(f), '--reference', args.reference],
                           capture_output=True)
        text = r.stdout.decode('utf-8', 'replace')
        (out_dir / ('report-sabotage-%s.log' % label)).write_text(text, encoding='utf-8')
        return r.returncode, sum(1 for l in text.splitlines() if l.startswith('FAIL '))

    rc0, n0 = run(copy.deepcopy(src), 'clean')
    print('%-18s %-28s exit=%d FAIL=%d  %s' % ('clean', '未破壞的對照', rc0, n0,
                                               'OK' if rc0 == 0 else '⚠ 乾淨的就不過，先修這個'))
    bad = []
    for label, desc, fn in CASES:
        d = copy.deepcopy(src)
        fn(d)
        rc, n = run(d, label)
        ok = rc != 0
        if not ok:
            bad.append(label)
        print('%-18s %-28s exit=%d FAIL=%d  %s' % (label, desc, rc, n, 'OK' if ok else '⚠ 假通過'))
    print()
    print('結果：%d/%d 種破壞被擋下' % (len(CASES) - len(bad), len(CASES)))
    return 0 if (rc0 == 0 and not bad) else 1


if __name__ == '__main__':
    sys.exit(main())
