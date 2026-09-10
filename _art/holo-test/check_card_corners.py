# -*- coding: utf-8 -*-
"""卡片圓角外的純黑 L 形硬邊角：偵測與量化。

成因（記在 docs/clicker/METHOD-card-face.md 第三節）：
mix-blend-mode:screen 的圖層在獨立 3D 合成層裡，圓角外沒有背景可混就吐出純黑。
screen 對黑色中性的前提是「有東西可以混」，獨立合成層的空白處不成立。

判準取「在地」參考值（同一份文件第二節第 7 點）：
背景參考取各角落緊鄰的區域，不要拿單一背景亮度去套四個角——
頁面背景常是放射漸層，那樣會製造假紅燈。

用法：python check_card_corners.py <頁面路徑或 URL> [--selector .hcard] [--out 目錄]
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent

def corner_boxes(x, y, w, h, r):
    """回傳四角『圓角外』的方形取樣區（邊長 r），以及各自緊鄰的在地背景區。"""
    r = max(4, int(r))
    out = []
    for name, (cx, cy, ox, oy) in {
        'TL': (x,        y,        -1, -1),
        'TR': (x + w - r, y,        +1, -1),
        'BL': (x,        y + h - r, -1, +1),
        'BR': (x + w - r, y + h - r, +1, +1),
    }.items():
        corner = (int(cx), int(cy), int(cx + r), int(cy + r))
        # 在地背景：沿對角往外平移一個 r，完全在卡片之外
        local = (int(cx + ox * r), int(cy + oy * r), int(cx + ox * r + r), int(cy + oy * r + r))
        out.append((name, corner, local))
    return out

def lum(a):
    a = a.astype(float)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def crop(img, box):
    x0, y0, x1, y1 = box
    x0, y0 = max(0, x0), max(0, y0)
    return np.asarray(img.crop((x0, y0, x1, y1)).convert('RGB'))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('page')
    ap.add_argument('--selector', default='.hcard')
    ap.add_argument('--out', default=None)
    ap.add_argument('--wait', type=int, default=2500)
    ap.add_argument('--limit', type=int, default=8)
    ap.add_argument('--inject-bug', action='store_true',
                    help='負控制：注入已知會產生 L 形黑角的寫法，判準必須變紅')
    args = ap.parse_args()

    url = args.page if args.page.startswith('http') else Path(args.page).resolve().as_uri()
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1440, 'height': 900})
        pg.goto(url)
        pg.wait_for_timeout(args.wait)
        if args.inject_bug:
            # 已知壞掉的寫法（METHOD-card-face.md 第三節）：
            # 方角黑底板 + screen 混合 + 獨立 3D 合成層 => 圓角外吐出純黑
            pg.add_style_tag(content='''
              .card-face{isolation:isolate}
              .card-face:after{content:"";position:absolute;inset:0;
                background:#000;mix-blend-mode:screen;transform:translateZ(2px)}
            ''')
            pg.wait_for_timeout(400)
        # 決定性取樣：暫停所有 WAAPI 動畫，再等雙重 rAF 重繪屏障
        pg.evaluate("()=>document.getAnimations().forEach(a=>{try{a.pause();a.currentTime=0}catch{}})")
        pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        shot = Path(args.out or '.') / 'corner-page.png'
        shot.parent.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(shot))
        cards = pg.eval_on_selector_all(args.selector, """els=>els.slice(0,%d).map(e=>{
            const b=e.getBoundingClientRect(), s=getComputedStyle(e);
            return {x:b.x,y:b.y,w:b.width,h:b.height,
                    radius:parseFloat(s.borderTopLeftRadius)||12,
                    cls:e.className};
        })""" % args.limit)
        b.close()

    img = Image.open(shot)
    W, H = img.size
    skipped = []
    for i, c in enumerate(cards):
        if c['w'] < 40 or c['h'] < 40:
            skipped.append((i, 'too small')); continue
        # 只取「完整落在視窗內、而且外圈取樣區也在視窗內」的卡，
        # 否則會採到截圖外的空白（純黑），製造整片假紅燈。
        r = max(4, int(c['radius']))
        if c['x'] - r < 0 or c['y'] - r < 0 or c['x'] + c['w'] + r > W or c['y'] + c['h'] + r > H:
            skipped.append((i, 'out of viewport')); continue
        for name, cbox, lbox in corner_boxes(c['x'], c['y'], c['w'], c['h'], c['radius']):
            cl, ll = lum(crop(img, cbox)), lum(crop(img, lbox))
            if cl.size == 0 or ll.size == 0:
                continue
            local_ref = float(np.median(ll))
            if local_ref <= 1.0:
                # 在地背景本身就是純黑 => 這個取樣點沒有鑑別力，不能判紅
                rows.append(dict(card=i, cls=c['cls'][:40], corner=name,
                                 local_ref=round(local_ref, 2), darkest=float(cl.min()),
                                 near_black_pct=None, much_darker_pct=None,
                                 note='在地背景為純黑，取樣無效')); continue
            darkest = float(cl.min())
            # 「比在地背景暗很多」且「接近純黑」才算 L 形黑角
            near_black = float((cl <= 12).mean() * 100)
            much_darker = float((cl <= max(4.0, local_ref * 0.35)).mean() * 100)
            rows.append(dict(card=i, cls=c['cls'][:40], corner=name,
                             local_ref=round(local_ref, 2), darkest=round(darkest, 2),
                             near_black_pct=round(near_black, 3),
                             much_darker_pct=round(much_darker, 3)))

    valid = [r for r in rows if r['much_darker_pct'] is not None]
    worst = sorted(valid, key=lambda r: -r['much_darker_pct'])[:12]
    print(json.dumps(dict(url=url, cards=len(cards), samples=len(rows), worst=worst),
                     ensure_ascii=False, indent=2))
    bad = [r for r in rows if r['much_darker_pct'] >= 8 and r['darkest'] <= 12]
    print(f"\n>>> 疑似 L 形黑角的角落數：{len(bad)} / {len(rows)}")
    print(">>> 判定:", "FAIL" if bad else "PASS")
    if args.out:
        Path(args.out, 'corners.json').write_text(
            json.dumps(dict(url=url, rows=rows, bad=len(bad)), ensure_ascii=False, indent=2),
            encoding='utf-8')
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main())
