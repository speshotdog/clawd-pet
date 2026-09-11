# -*- coding: utf-8 -*-
"""卡片圓角外的純黑 L 形硬邊角：偵測與量化（2026-09-12 弧外版）。

成因（記在 docs/clicker/METHOD-card-face.md 第三節）：
mix-blend-mode:screen 的圖層在獨立 3D 合成層裡，圓角外沒有背景可混就吐出純黑。
screen 對黑色中性的前提是「有東西可以混」，獨立合成層的空白處不成立。

判準（ORDER-2026-09-12-picker-drag.md 命令 3）：
- 取樣只限**圓弧外**：舊版拿 r×r 方塊整塊量，方塊 79% 是卡體，背景亮時把卡框深色全算成黑角（假紅）。
- 幾何用**投影後**的四角點：呼叫端在 .hcard 四角放 0×0 探針讀 getBoundingClientRect，
  這裡用單應性把截圖像素反投影回卡片座標，再判「在角落方塊內、且在圓弧外」。傾斜卡因此不用近似。
- CSS 座標 × dpr = 截圖像素；不混用。
- 背景參考取各角緊鄰的卡外區域（在地），不拿單一背景亮度套四角。
- 沒鑑別力的樣本（背景本身純黑、探針出視窗、被遮擋）逐角記原因，不算 PASS 也不算 FAIL。
- 門檻：一般 8%／12（fraction／darkest）；編隊呼叫端 5%／6。有效樣本 0 → SKIP，CLI exit 2。

用法：python check_card_corners.py <頁面路徑或 URL> [--selector .hcard] [--out 目錄] [--dpr 1] [--inject-bug]
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent

# 頁內：找出所有 .hcard（穿 shadow root），回傳投影後四角點 + 可見性 + 遮擋資訊
GEOMETRY_JS = r"""(sel)=>{
  const cs=[];
  (function walk(r){r.querySelectorAll(sel).forEach(c=>cs.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot)})})(document);
  const up=e=>e.parentElement||(e.getRootNode().host||null);
  const visible=e=>{let p=e;while(p){const s=getComputedStyle(p);
    if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)return false;p=up(p)}return true};
  const dlg=document.querySelector('dialog[open]');
  // contains() 穿不過 shadow root，遮擋判定要沿 host 往上走
  const within=(e,a)=>{let p=e;while(p){if(p===a)return true;p=up(p)}return false};
  const out=[];
  cs.forEach(e=>{
    const b=e.getBoundingClientRect(); if(b.width<=0||b.height<=0)return;
    const cs=getComputedStyle(e);
    // 0×0 探針：子元素繼承整條 3D 變形鏈，它的 rect 就是投影後的角點
    const probes=[[0,0],[1,0],[0,1],[1,1]].map(([px,py])=>{const d=document.createElement('i');
      d.style.cssText=`position:absolute;left:${px*100}%;top:${py*100}%;width:0;height:0;margin:0;padding:0;border:0;pointer-events:none`;
      e.appendChild(d);const r=d.getBoundingClientRect();d.remove();return [r.left,r.top]});
    const rr=parseFloat(cs.borderTopLeftRadius);
    // 會蓋住別張卡的浮層：拖曳 ghost（pointer-events:none，elementsFromPoint 看不到，只能用矩形判）
    const occ=[...document.querySelectorAll('#drag-layer .drag-ghost')].filter(g=>!within(e,g)).map(g=>{const r=g.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]});
    out.push({x:b.x,y:b.y,w:b.width,h:b.height,cw:e.clientWidth||b.width,ch:e.clientHeight||b.height,occluders:occ,
      quad:probes,radius:Number.isFinite(rr)&&rr>0?rr:12,cls:String(e.className).slice(0,60),
      vis:visible(e),occluded:!!(dlg&&!within(e,dlg)),id:e.dataset.id||'',ghost:!!(document.getElementById('drag-layer')&&within(e,document.getElementById('drag-layer')))});
  });
  return out;}"""

# 已知壞寫法（METHOD 第三節）：方角黑底板 + screen 混合 + 獨立 3D 合成層 ⇒ 圓角外吐純黑。遞迴進 shadow root。
INJECT_JS = r"""()=>{const roots=[document];
  (function walk(r){r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot){roots.push(e.shadowRoot);walk(e.shadowRoot)}})})(document);
  let hit=0;
  for(const root of roots){if(!root.querySelector('.card-face'))continue;
    const s=document.createElement('style');s.className='__corner_bug';
    s.textContent='.card-face{isolation:isolate}.card-face::after{content:"";position:absolute;inset:0;background:#000;mix-blend-mode:screen;transform:translateZ(2px)}';
    (root.head||root).appendChild(s);hit++}
  const faces=[];for(const root of roots)root.querySelectorAll('.card-face').forEach(f=>faces.push(getComputedStyle(f,'::after').content));
  return {roots:hit,faces:faces.length,effective:faces.filter(v=>v==='""').length};}"""


def lum(a):
    a = a.astype(float)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def homography(src, dst):
    """src(4×2 卡片座標) → dst(4×2 螢幕座標) 的 3×3 單應矩陣。"""
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.asarray(A, float))
    H = vt[-1].reshape(3, 3)
    return H / H[2, 2]


def card_quad(c, dpr):
    if c.get('quad'):
        q = np.asarray(c['quad'], float) * dpr  # TL, TR, BL, BR
    else:
        x, y, w, h = c['x'] * dpr, c['y'] * dpr, c['w'] * dpr, c['h'] * dpr
        q = np.asarray([[x, y], [x + w, y], [x, y + h], [x + w, y + h]], float)
    return q


def measure_corners(img, cards, fraction=8, darkest_limit=12, dpr=1.0, ring=8):
    """回傳 dict(rows, skipped, samples, bad, status, thresholds)。

    rows 每筆：card, corner, local_ref, darkest, near_black_pct, much_darker_pct（None＝無效樣本，附 note）。
    """
    L = lum(np.asarray(img.convert('RGB')))
    Hh, Ww = L.shape
    rows, skipped = [], []
    for i, c in enumerate(cards):
        if c.get('vis') is False:
            skipped.append((i, 'not visible')); continue
        if c.get('occluded'):
            skipped.append((i, 'occluded by open dialog')); continue
        if c['w'] < 40 or c['h'] < 40:
            skipped.append((i, 'too small')); continue
        cw, ch = float(c.get('cw') or c['w']), float(c.get('ch') or c['h'])
        r = float(c.get('radius') or 12)
        r = max(4.0, min(r, cw / 2, ch / 2))
        quad = card_quad(c, dpr)
        if not np.all(np.isfinite(quad)):
            skipped.append((i, 'non-finite geometry')); continue
        # 卡片座標（CSS px）→ 螢幕像素
        src = np.asarray([[0, 0], [cw, 0], [0, ch], [cw, ch]], float)
        try:
            H = homography(src, quad); Hinv = np.linalg.inv(H)
        except np.linalg.LinAlgError:
            skipped.append((i, 'degenerate quad')); continue
        ring_px = ring * dpr
        x0, y0 = quad.min(axis=0) - ring_px; x1, y1 = quad.max(axis=0) + ring_px
        if x0 < 0 or y0 < 0 or x1 > Ww or y1 > Hh:
            skipped.append((i, 'out of viewport (incl. background ring)')); continue
        xs = np.arange(int(np.floor(x0)), int(np.ceil(x1))); ys = np.arange(int(np.floor(y0)), int(np.ceil(y1)))
        gx, gy = np.meshgrid(xs + .5, ys + .5)
        pts = np.stack([gx.ravel(), gy.ravel(), np.ones(gx.size)])
        loc = Hinv @ pts; loc = loc[:2] / loc[2]
        lx = loc[0].reshape(gx.shape); ly = loc[1].reshape(gx.shape)
        patch = L[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
        inside_card = (lx >= 0) & (lx <= cw) & (ly >= 0) & (ly <= ch)
        for name, (ax, ay, sx, sy) in {'TL': (r, r, -1, -1), 'TR': (cw - r, r, +1, -1),
                                       'BL': (r, ch - r, -1, +1), 'BR': (cw - r, ch - r, +1, +1)}.items():
            # 角落方塊：卡片座標裡靠角的 r×r
            cx0, cx1 = (0, r) if sx < 0 else (cw - r, cw)
            cy0, cy1 = (0, r) if sy < 0 else (ch - r, ch)
            sq = (lx >= cx0) & (lx <= cx1) & (ly >= cy0) & (ly <= cy1)
            outside_arc = sq & (np.hypot(lx - ax, ly - ay) > r + 0.5)
            # 在地背景：緊鄰該角、卡外 ring 範圍
            bg = (~inside_card) & (lx >= -ring) & (lx <= cw + ring) & (ly >= -ring) & (ly <= ch + ring) & \
                 (((lx < 0) if sx < 0 else (lx > cw)) | ((ly < 0) if sy < 0 else (ly > ch))) & \
                 ((lx <= cx1 + ring) if sx < 0 else (lx >= cx0 - ring)) & ((ly <= cy1 + ring) if sy < 0 else (ly >= cy0 - ring))
            # 角落方塊（含背景環）若被別張卡的 ghost 矩形壓到，這個角沒有鑑別力：記原因、不判
            sq_pts = np.stack([np.where(sq | bg)[1] + xs[0], np.where(sq | bg)[0] + ys[0]]) if (sq | bg).any() else None
            occluded = False
            if sq_pts is not None:
                px0, py0 = sq_pts.min(axis=1); px1, py1 = sq_pts.max(axis=1)
                for ox0, oy0, ox1, oy1 in c.get('occluders') or []:
                    ox0, oy0, ox1, oy1 = ox0 * dpr, oy0 * dpr, ox1 * dpr, oy1 * dpr
                    if px0 <= ox1 and px1 >= ox0 and py0 <= oy1 and py1 >= oy0:
                        occluded = True; break
            if occluded:
                rows.append(dict(card=i, cls=c['cls'][:40], corner=name, local_ref=None, darkest=None,
                                 near_black_pct=None, much_darker_pct=None, note='occluded by drag ghost')); continue
            o = patch[outside_arc]; b = patch[bg]
            if o.size < 4 or b.size < 4:
                rows.append(dict(card=i, cls=c['cls'][:40], corner=name, local_ref=None, darkest=None,
                                 near_black_pct=None, much_darker_pct=None, note=f'insufficient pixels (outside={o.size}, bg={b.size})'))
                continue
            ref = float(np.median(b))
            if ref <= 2.0:
                rows.append(dict(card=i, cls=c['cls'][:40], corner=name, local_ref=round(ref, 2), darkest=float(o.min()),
                                 near_black_pct=None, much_darker_pct=None, note='在地背景為純黑，取樣無效')); continue
            rows.append(dict(card=i, cls=c['cls'][:40], corner=name, local_ref=round(ref, 2), darkest=round(float(o.min()), 2),
                             outside_px=int(o.size), outside_median=round(float(np.median(o)), 2),
                             near_black_pct=round(float((o <= 12).mean() * 100), 3),
                             much_darker_pct=round(float((o <= max(4.0, ref * 0.35)).mean() * 100), 3)))
    valid = [r for r in rows if r['much_darker_pct'] is not None]
    bad = [r for r in valid if r['much_darker_pct'] >= fraction and r['darkest'] <= darkest_limit]
    return dict(rows=rows, skipped=skipped, samples=len(valid), bad=len(bad),
                status='FAIL' if bad else 'PASS' if valid else 'SKIP',
                thresholds={'fraction': fraction, 'darkest': darkest_limit, 'dpr': dpr, 'ring': ring})


def collect_geometry(pg, selector='.hcard', limit=None):
    cards = pg.evaluate(GEOMETRY_JS, selector)
    return cards[:limit] if limit else cards


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('page')
    ap.add_argument('--selector', default='.hcard')
    ap.add_argument('--out', default=None)
    ap.add_argument('--wait', type=int, default=2500)
    ap.add_argument('--limit', type=int, default=0, help='0＝全部')
    ap.add_argument('--dpr', type=float, default=1.0)
    ap.add_argument('--viewport', default='1440x900', help='WxH（CSS px）')
    ap.add_argument('--fraction', type=float, default=8)
    ap.add_argument('--darkest', type=float, default=12)
    ap.add_argument('--inject-bug', action='store_true',
                    help='負控制：注入已知會產生 L 形黑角的寫法（遞迴進 shadow root），判準必須變紅')
    args = ap.parse_args()

    url = args.page if args.page.startswith('http') else Path(args.page).resolve().as_uri()
    with sync_playwright() as p:
        b = p.chromium.launch()
        vw, vh = (int(v) for v in args.viewport.lower().split('x'))
        pg = b.new_page(viewport={'width': vw, 'height': vh}, device_scale_factor=args.dpr)
        pg.goto(url)
        pg.wait_for_timeout(args.wait)
        inject = None
        if args.inject_bug:
            inject = pg.evaluate(INJECT_JS)
            pg.wait_for_timeout(400)
        # 決定性取樣：暫停所有 WAAPI 動畫（穿 shadow root），再等雙重 rAF 重繪屏障
        pg.evaluate("()=>[document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)]"
                    ".forEach(root=>root.getAnimations().forEach(a=>{try{a.pause();a.currentTime=0}catch{}}))")
        pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        shot = Path(args.out or '.') / 'corner-page.png'
        shot.parent.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(shot))
        cards = collect_geometry(pg, args.selector, args.limit or None)
        b.close()

    m = measure_corners(Image.open(shot), cards, fraction=args.fraction, darkest_limit=args.darkest, dpr=args.dpr)
    valid = [r for r in m['rows'] if r['much_darker_pct'] is not None]
    worst = sorted(valid, key=lambda r: -r['much_darker_pct'])[:12]
    print(json.dumps(dict(url=url, cards=len(cards), samples=m['samples'], skipped=m['skipped'],
                          inject=inject, worst=worst), ensure_ascii=False, indent=2))
    print(f"\n>>> 疑似 L 形黑角的角落數：{m['bad']} / {m['samples']}（無效樣本 {len(m['rows']) - m['samples']}，跳過卡 {len(m['skipped'])}）")
    print(">>> 判定:", m['status'])
    if args.out:
        Path(args.out, 'corners.json').write_text(
            json.dumps(dict(url=url, cards=cards, inject=inject, **m), ensure_ascii=False, indent=2), encoding='utf-8')
    return {'FAIL': 1, 'PASS': 0, 'SKIP': 2}[m['status']]


if __name__ == '__main__':
    sys.exit(main())
