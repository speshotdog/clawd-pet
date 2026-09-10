# -*- coding: utf-8 -*-
"""診斷：同尺寸截圖為什麼還會差像素——箔面相位到底有沒有被後續寫入？

做法（照 ORDER-2026-09-11-parity-v3 第 2 節）：
  1. 在測試端包裝 HoloCardFace.paint，記下每一次呼叫的參數、來源與時間。
  2. 在三個時點各讀一次卡片的相位相關 CSS 變數：
     paint(0,0) 之後 / 雙 rAF 之後 / 截圖前（再等 600ms）。
  3. 三次值若一樣，就不是「後續寫入」；不一樣就把寫入者的 stack 印出來。

用法：
    python diag_foil_phase.py [--card rocketdog] [--entries pool-standalone,gacha-test]
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

# 卡面用到的相位／位移類自訂屬性（來自 card_face.js 的 paint()）
VARS = ['--phase', '--fx', '--fy', '--gx', '--gy', '--sx', '--sy',
        '--tilt', '--zl', '--foil', '--shine']

HOOK = """() => {
  window.__paintLog = [];
  const F = window.HoloCardFace;
  if (!F || F.__wrapped) return 'no-holocardface';
  const orig = F.paint;
  F.paint = function (card, rarity, x, y, opts) {
    try {
      window.__paintLog.push({
        t: +performance.now().toFixed(1),
        id: card && card.dataset ? card.dataset.id : null,
        rarity: rarity, x: x, y: y, opts: opts ? JSON.stringify(opts) : null,
        stack: (new Error()).stack.split('\\n').slice(2, 5).join(' | ').slice(0, 260)
      });
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  F.__wrapped = true;
  return 'ok';
}"""

READ = """(id) => {
  const cs = [];
  (function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
  const c = cs.find(x => (x.dataset.id||'').replace(/^pool-/,'') === id);
  if (!c) return null;
  const s = getComputedStyle(c), out = {};
  %s.forEach(v => out[v] = s.getPropertyValue(v).trim());
  const cr = c.getBoundingClientRect();
  const LAYERS = ['.frame-material','.face-art','.art-media','.art-media img','.face-depth-bg',
                  '.face-stock','.foil-stack','.foil-etch','.subject-mask','.face-frame'];
  LAYERS.forEach(sel => {
    const e = c.querySelector(sel);
    if (!e) { out[sel] = null; return; }
    const s2 = getComputedStyle(e), r = e.getBoundingClientRect();
    out[sel] = {
      // 位置尺寸一律換算成「相對卡片左上角、除以卡寬」，尺寸不同也能比
      x: +((r.x - cr.x) / cr.width).toFixed(5), y: +((r.y - cr.y) / cr.height).toFixed(5),
      w: +(r.width / cr.width).toFixed(5), h: +(r.height / cr.height).toFixed(5),
      transform: s2.transform, backgroundSize: s2.backgroundSize,
      backgroundPosition: s2.backgroundPosition, opacity: s2.opacity,
      objectFit: s2.objectFit, objectPosition: s2.objectPosition,
      mixBlendMode: s2.mixBlendMode, filter: s2.filter,
      maskImage: (s2.maskImage || '').slice(0, 40),
      backgroundImage: (s2.backgroundImage || '').slice(0, 40),
      src: e.tagName === 'IMG' ? (e.getAttribute('src') || '').slice(0, 40) : null,
    };
  });
  return out;
}""" % json.dumps(VARS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--card', default='rocketdog')
    ap.add_argument('--entries', default='gacha-test,pool-standalone,demo,team')
    ap.add_argument('--width', type=int, default=260)
    args = ap.parse_args()

    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    fixture_cards = [expected[args.card]] if args.card in expected else []

    report = {}
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for name in args.entries.split(','):
            cfg = ENTRIES.get(name)
            if not cfg:
                continue
            pg = br.new_page(viewport={'width': 1440, 'height': 1200}, device_scale_factor=1)
            rec = {}
            try:
                pg.add_init_script(WALK)
                pg.goto((HERE / cfg['file']).as_uri() +
                        ('?ceremony-test' if cfg['surface'] == 'gacha' else ''))
                pg.evaluate(WALK)
                rec['hook'] = pg.evaluate(HOOK)
                activate(pg, cfg, [args.card], fixture_cards)
                if cfg.get('fixture'):
                    err, _ = pull_batch(pg, fixture_cards)
                    if err:
                        rec['skip'] = err; report[name] = rec; continue
                if cfg['surface'] == 'team':
                    pg.evaluate(REACH_CARD, args.card)
                    pg.wait_for_timeout(900)
                pg.evaluate(WALK); pg.evaluate(REFIT); pg.evaluate(FREEZE)
                if pg.evaluate(READ, args.card) is None:
                    rec['skip'] = 'card not present'; report[name] = rec; continue
                pg.evaluate("()=>{window.__paintLog.length=0}")
                pg.evaluate(SAMESIZE_JS, args.width)
                rec['afterPaint'] = pg.evaluate(READ, args.card)
                pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
                rec['afterRaf'] = pg.evaluate(READ, args.card)
                pg.wait_for_timeout(600)
                rec['beforeShot'] = pg.evaluate(READ, args.card)
                rec['paintCalls'] = pg.evaluate(
                    "(id)=>window.__paintLog.filter(p=>(p.id||'').replace(/^pool-/,'')===id)", args.card)
            except Exception as e:
                rec['error'] = str(e)[:200]
            finally:
                pg.close()
            report[name] = rec
        br.close()

    out = HERE.parent.parent / 'docs' / 'clicker' / 'shots' / 'parity' / 'foil-phase-diag.json'
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    for name, rec in report.items():
        if rec.get('skip') or rec.get('error'):
            print('%-22s 跳過：%s' % (name, rec.get('skip') or rec.get('error'))); continue
        a, b, c = rec['afterPaint'], rec['afterRaf'], rec['beforeShot']
        drift = sorted(k for k in a if not (a[k] == b[k] == c[k]))
        print('%-22s paint 呼叫 %d 次；三個時點不同的變數 %d 個 %s'
              % (name, len(rec.get('paintCalls') or []), len(drift), drift[:6]))
        for k in drift[:4]:
            print('        %-26s paint後=%r rAF後=%r 截圖前=%r' % (k, a[k], b[k], c[k]))
        extra = [p for p in (rec.get('paintCalls') or [])]
        if extra:
            print('        最後一次 paint：x=%s y=%s opts=%s' % (extra[-1]['x'], extra[-1]['y'], extra[-1]['opts']))
            print('        來源：%s' % extra[-1]['stack'][:200])
    print('\n寫出 %s' % out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
