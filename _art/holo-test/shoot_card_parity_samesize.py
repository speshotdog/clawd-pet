# -*- coding: utf-8 -*-
"""受控卡面圖：同一張卡、同一個未變形寬度、中性姿態，在各入口各拍一張。

ORDER-2026-09-11-parity.md 要求「同尺寸完整卡面驗收」不能只有 computed style，
要有可以並排看的受控圖。這支沿用 check_card_parity.py 的同尺寸中性姿態做法。

用法：
    python shoot_card_parity_samesize.py [--card rocketdog] [--width 260] [--out DIR]
"""
from __future__ import annotations
import argparse, sys, io
from pathlib import Path

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stdout = _OUT   # 留參考，否則 wrapper 被回收會變成 I/O on closed file
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check_card_parity import (ENTRIES, WALK, REFIT, FREEZE, SAMESIZE_JS,
                               activate, REACH_CARD, pull_batch)


def find_card(pg, card_id):
    return pg.evaluate("""(id)=>{
      const cs=[];(function w(r){r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
        r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})})(document);
      const c=cs.find(x=>(x.dataset.id||'').replace(/^pool-/,'')===id);
      if(!c) return null; window.__shot=c; c.scrollIntoView({block:'center'});
      const r=c.getBoundingClientRect();
      return {x:r.x,y:r.y,w:r.width,h:r.height};
    }""", card_id)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--card', default='rocketdog')
    ap.add_argument('--width', type=int, default=260)
    ap.add_argument('--out', default=str(HERE.parent.parent / 'docs' / 'clicker' /
                                         'shots' / 'parity' / 'samesize'))
    args = ap.parse_args()
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)

    sys.path.insert(0, str(HERE))
    from pool_data import pool
    expected = {c['id']: c for c in pool()}
    fixture_cards = [expected[args.card]] if args.card in expected else []

    shots = []
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for name, cfg in ENTRIES.items():
            f = HERE / cfg['file']
            if not f.exists():
                continue
            pg = br.new_page(viewport={'width': 1440, 'height': 1200}, device_scale_factor=2)
            try:
                pg.add_init_script(WALK)
                pg.goto(f.as_uri() + ('?ceremony-test' if cfg['surface'] == 'gacha' else ''))
                pg.evaluate(WALK)
                act = activate(pg, cfg, [args.card], fixture_cards)
                if cfg.get('fixture'):
                    err, _ = pull_batch(pg, fixture_cards)
                    if err:
                        print('%-24s 跳過：%s' % (name, err)); continue
                if cfg['surface'] == 'team':
                    pg.evaluate(REACH_CARD, args.card)
                    pg.wait_for_timeout(900)
                pg.evaluate(WALK); pg.evaluate(REFIT); pg.evaluate(FREEZE)
                if not find_card(pg, args.card):
                    print('%-24s 跳過：這個入口沒有 %s' % (name, args.card)); continue
                pg.evaluate(SAMESIZE_JS, args.width)
                pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
                # 同尺寸之後版面會位移，要重新捲進可視區再量一次
                find_card(pg, args.card)
                pg.wait_for_timeout(300)
                box = find_card(pg, args.card)
                # 不裁切：卡片若沒有完整落在視窗內就跳過並講明，不要拍半張假裝有圖
                if (not box or box['w'] < 1 or box['h'] < 1 or box['x'] < 0 or box['y'] < 0
                        or box['x'] + box['w'] > 1440 or box['y'] + box['h'] > 1200):
                    print('%-24s 跳過：同尺寸後沒有完整落在視窗內 %s' % (name, box)); continue
                p = out / ('%s-%s-%dpx.png' % (args.card, name, args.width))
                pg.screenshot(path=str(p), clip={'x': box['x'], 'y': box['y'],
                                                 'width': box['w'], 'height': box['h']})
                shots.append((name, p))
                print('%-24s %.1f×%.1f -> %s' % (name, box['w'], box['h'], p.name))
            except Exception as e:
                print('%-24s 失敗：%s' % (name, str(e)[:120]))
            finally:
                pg.close()
        br.close()

    if shots:
        ims = [Image.open(p) for _, p in shots]
        w = sum(i.width for i in ims) + 8 * (len(ims) - 1)
        h = max(i.height for i in ims)
        sheet = Image.new('RGBA', (w, h), (14, 18, 26, 255))
        x = 0
        for i in ims:
            sheet.paste(i, (x, 0)); x += i.width + 8
        p = out / ('%s-all-entries-%dpx.png' % (args.card, args.width))
        sheet.save(p)
        print('\n並排圖：%s（%d 個入口）' % (p, len(ims)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
