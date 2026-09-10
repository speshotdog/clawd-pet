# -*- coding: utf-8 -*-
"""素材與效果層的一致性：卡內每一層的幾何／混色／遮罩要一致，
素材可以換傳輸方式（檔案 vs data URI），但**解析度與實際畫面**要能追溯到建置參數。

背景（2026-09-11）：同尺寸中性姿態下 computed style 與幾何都是 0 差異，
但截圖還是差像素。診斷結果不是箔面相位（`diag_foil_phase.py` 證明三個時點都沒有後續寫入），
而是兩件事：
  1. 幾個 standalone 建置會**重新編碼、甚至縮圖**素材
     （`build_cards_remade_standalone.py` 的 `uri(box=(420,588), quality=84)`）。
  2. 截圖裁切落在非整數像素上，會產生 1px 對位誤差。

所以這支把「層的樣式與幾何」與「素材本身的解析度」分開驗：
  - 層的幾何／transform／背景尺寸／混色／遮罩／濾鏡：**必須完全一致**。
  - 素材的內在解析度：允許不同，但要列出來並對得上建置參數，不能默默不同。

用法：
    python check_card_assets.py [--card rocketdog] [--viewport 1440x1200]
"""
from __future__ import annotations
import argparse, json, sys, io
from pathlib import Path

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stdout = _OUT
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_card_parity import (ENTRIES, WALK, REFIT, FREEZE, SAMESIZE_JS,
                               activate, REACH_CARD, pull_batch)

# 這些層的樣式與幾何必須完全一致（傳輸方式除外）
LAYERS = ['.face-stock', '.face-depth-bg', '.face-art', '.art-media', '.art-media img',
          '.subject-mask', '.face-frame', '.frame-material', '.foil-stack', '.foil-etch',
          '.face-plate', '.face-gem', '.card-back']
STRICT = ['x', 'y', 'w', 'h', 'transform', 'backgroundSize', 'backgroundPosition',
          'backgroundRepeat', 'opacity', 'mixBlendMode', 'filter', 'objectFit',
          'objectPosition', 'borderRadius', 'maskSize', 'maskPosition', 'maskRepeat']
# 這些只回報、不判定（傳輸方式與內在解析度）
LOOSE = ['assetKind', 'naturalWidth', 'naturalHeight', 'bgKind', 'maskKind']

READ = """(id) => {
  const cs = [];
  (function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  const c = cs.find(x => (x.dataset.id||'').replace(/^pool-/,'') === id);
  if (!c) return null;
  const cr = c.getBoundingClientRect();
  const kind = u => !u ? null : (u.indexOf('data:image/webp') >= 0 ? 'data:webp'
                : u.indexOf('data:image/png') >= 0 ? 'data:png'
                : u.indexOf('data:') >= 0 ? 'data:other'
                : u.indexOf('url(') >= 0 || u.indexOf('file:') >= 0 ? 'file' : 'none');
  const out = {};
  %s.forEach(sel => {
    const e = c.querySelector(sel);
    if (!e) { out[sel] = null; return; }
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    out[sel] = {
      x: +((r.x - cr.x) / cr.width).toFixed(5), y: +((r.y - cr.y) / cr.height).toFixed(5),
      w: +(r.width / cr.width).toFixed(5), h: +(r.height / cr.height).toFixed(5),
      transform: s.transform, backgroundSize: s.backgroundSize,
      backgroundPosition: s.backgroundPosition, backgroundRepeat: s.backgroundRepeat,
      opacity: s.opacity, mixBlendMode: s.mixBlendMode, filter: s.filter,
      objectFit: s.objectFit, objectPosition: s.objectPosition,
      borderRadius: s.borderRadius,
      maskSize: s.maskSize || s.webkitMaskSize || '',
      maskPosition: s.maskPosition || s.webkitMaskPosition || '',
      maskRepeat: s.maskRepeat || s.webkitMaskRepeat || '',
      assetKind: e.tagName === 'IMG' ? kind(e.currentSrc || e.src) : null,
      naturalWidth: e.tagName === 'IMG' ? e.naturalWidth : null,
      naturalHeight: e.tagName === 'IMG' ? e.naturalHeight : null,
      bgKind: kind(s.backgroundImage),
      maskKind: kind(s.maskImage || s.webkitMaskImage),
    };
  });
  return out;
}""" % json.dumps(LAYERS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--card', default='rocketdog')
    ap.add_argument('--reference', default='gacha-test')
    ap.add_argument('--viewport', default='1440x1200')
    ap.add_argument('--width', type=int, default=260)
    args = ap.parse_args()
    W, H = (int(x) for x in args.viewport.split('x'))

    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    fixture_cards = [expected[args.card]] if args.card in expected else []

    data = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for name, cfg in ENTRIES.items():
            pg = br.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
            try:
                pg.add_init_script(WALK)
                pg.goto((HERE / cfg['file']).as_uri() +
                        ('?ceremony-test' if cfg['surface'] == 'gacha' else ''))
                pg.evaluate(WALK)
                activate(pg, cfg, [args.card], fixture_cards)
                if cfg.get('fixture'):
                    err, _ = pull_batch(pg, fixture_cards)
                    if err:
                        print('%-24s 跳過：%s' % (name, err)); continue
                if cfg['surface'] == 'team':
                    pg.evaluate(REACH_CARD, args.card)
                    pg.wait_for_timeout(900)
                pg.evaluate(WALK); pg.evaluate(REFIT); pg.evaluate(FREEZE)
                pg.evaluate(SAMESIZE_JS, args.width)
                pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
                v = pg.evaluate(READ, args.card)
                if v is None:
                    print('%-24s 跳過：這個入口沒有 %s' % (name, args.card)); continue
                data[name] = v
            except Exception as e:
                print('%-24s 失敗：%s' % (name, str(e)[:140]))
            finally:
                pg.close()
        br.close()

    out = HERE.parent.parent / 'docs' / 'clicker' / 'shots' / 'parity' / 'asset-layers.json'
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    ref = data.get(args.reference)
    if not ref:
        print('參考入口 %s 沒有資料' % args.reference); return 2
    fails = 0
    print('\n== 層的樣式與幾何（必須完全一致，參考＝%s）' % args.reference)
    for name, v in data.items():
        if name == args.reference:
            continue
        bad = []
        for sel in LAYERS:
            a, b = ref.get(sel), v.get(sel)
            if (a is None) != (b is None):
                bad.append((sel, '存在與否', bool(a), bool(b))); continue
            if a is None:
                continue
            for k in STRICT:
                if a.get(k) != b.get(k):
                    bad.append((sel, k, a.get(k), b.get(k)))
        ok = not bad
        fails += 0 if ok else 1
        print(('PASS ' if ok else 'FAIL ') + '%-24s 差異 %d 項 %s'
              % (name, len(bad), [(s, k) for s, k, _, _ in bad][:4]))
        for s, k, x, y in bad[:3]:
            print('        %-18s %-18s %r vs %r' % (s, k, str(x)[:40], str(y)[:40]))

    print('\n== 素材傳輸與內在解析度（只回報，差異要能追溯到建置參數）')
    for name, v in data.items():
        rows = []
        for sel in ('.art-media img', '.foil-etch', '.frame-material', '.face-depth-bg'):
            a = v.get(sel)
            if not a:
                continue
            if a.get('assetKind') or a.get('naturalWidth'):
                rows.append('%s=%s %sx%s' % (sel, a.get('assetKind'),
                                             a.get('naturalWidth'), a.get('naturalHeight')))
            elif a.get('bgKind') and a.get('bgKind') != 'none':
                rows.append('%s bg=%s' % (sel, a.get('bgKind')))
        print('  %-24s %s' % (name, '; '.join(rows)))

    print('\n== 結果：%s' % ('層樣式與幾何全綠' if not fails else '%d 個入口有層差異' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
