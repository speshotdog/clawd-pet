# -*- coding: utf-8 -*-
"""把桌面「新卡」資料夾的原圖切成 src/card-<id>.png。

三種來源混在一起（見 2026-09-08 的批次）：
  1. 已經去背的 RGBA（邊角 alpha=0）→ 只要裁邊 + 縮放
  2. 白底 RGBA/RGB（邊角是白的）  → 從四邊 flood fill 近白色，只吃「跟邊界連通」的白
     （zhencao 那次的教訓反過來：角色身上封閉的白袋不能一起吃掉，所以不用全域門檻）
  3. 黑底 RGBA（2.0 批的黃色蠑螈）→ 從四邊 flood fill 近黑色。角色自己的黑描邊外面隔著
     一圈灰色貼紙外框，fill 走到灰色就停，不會把描邊一起吃掉
  4. 貼紙圖：白邊 + 一塊單色底板（珍彼特是橘色）→ 兩趟 flood fill。
     第一趟吃外圍近白，第二趟吃底板顏色（顏色是量出來的，不是寫死的：
     取第一趟做完後 alpha 邊界內側的眾數色）。兩趟一定要分開跑——
     合成一趟的話，吃掉底板後 fill 會接著碰到角色自己的白色貼紙描邊，
     把描邊吃掉再漏進身體裡。分兩趟時第二趟不認白色，就停在描邊上。
     ⚠ 2026-09-08：珍彼特本來就是這樣被切壞的——三種舊模式都不認橘色底板，
     於是整塊方板被留下來當成角色的一部分，卡面上就是一個橘色（鍍膜後變灰）方框。
  5. 不透明的場景圖（滅世珍獸）    → 不去背，另外處理

用法: python _art/cardcut.py <來源png> <card-id> [目標高度]
"""
import sys
from collections import Counter, deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NEAR_WHITE = 232          # RGB 三通道都 >= 這個值才算背景白
NEAR_BLACK = 30           # RGB 三通道都 <= 這個值才算背景黑
PANEL_TOL  = 40           # 貼紙底板顏色的容差；24/40/60 實測差不多，取中間值
SPECK_RATIO = .005        # 連通面積不到最大元件這個比例的，當碎屑砍掉
TARGET_H = 580

def flood(im, hit):
    """從四邊 flood fill，hit(r,g,b,a) 為真的像素打成透明。"""
    px = im.load()
    w, h = im.size
    seen = bytearray(w * h)
    q = deque()
    def push(x, y):
        i = y * w + x
        if seen[i]: return
        if hit(*px[x, y]): seen[i] = 1; q.append((x, y))
    for x in range(w): push(x, 0); push(x, h - 1)
    for y in range(h): push(0, y); push(w - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h: push(nx, ny)
    for i, hit in enumerate(seen):
        if hit:
            x, y = i % w, i // w
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
    return im

def panel_color(im):
    """第一趟白底 fill 之後，alpha 邊界內側的眾數色就是貼紙底板的顏色。
    眾數佔不到邊界的 20% 就代表沒有底板（邊界是角色自己的雜色描邊），回 None 不做第二趟。"""
    px = im.load(); w, h = im.size
    ring = Counter()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 200 and any(0 <= x+dx < w and 0 <= y+dy < h and px[x+dx, y+dy][3] == 0
                                         for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                ring[px[x, y][:3]] += 1
    if not ring: return None
    color, total = ring.most_common(1)[0][0], sum(ring.values())
    # 不能只看「眾數這個精確顏色」佔幾成——底板邊緣整圈都是反鋸齒的雜色，
    # 會把眾數稀釋到 10% 以下，判準就永遠不成立（第一版就是這樣靜靜地什麼都沒做）。
    # 要算的是「邊界上落在容差內的像素」佔幾成。
    near = sum(n for c, n in ring.items() if all(abs(a - b) <= PANEL_TOL for a, b in zip(c, color)))
    # 珍彼特實測 39%：剩下那六成是角色自己的白色貼紙描邊，也貼在同一條邊界上。
    # 門檻取 .3；再加一條「眾數不能是近白」，免得把描邊本身當成底板又吃一次。
    if min(color) >= NEAR_WHITE: return None
    return color if near / total >= .3 else None

def despeckle(im, ratio=SPECK_RATIO):
    """砍掉面積不到最大元件 ratio 的連通碎屑，回傳 (im, 砍掉幾塊)。
    貼紙圖的底板外面還有一圈粗糙的深色描邊，顏色超出 PANEL_TOL 所以第二趟吃不掉，
    會留下一個很淡的虛線方框。它本身看不太到，但**會把 bbox 撐開**，
    於是角色被縮小又偏移——珍彼特原本就是這樣歪掉的。
    實測：角色 211165 px、兩顆愛心 5918／5436 px、碎屑全部 <=171 px，中間差了 30 倍，門檻很好抓。"""
    px = im.load(); w, h = im.size
    lab = [0] * (w * h); comps = []
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if lab[i] or px[sx, sy][3] <= 8: continue
            cid = len(comps) + 1; area = 0; q = deque([(sx, sy)]); lab[i] = cid
            while q:
                x, y = q.popleft(); area += 1
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not lab[j] and px[nx, ny][3] > 8: lab[j] = cid; q.append((nx, ny))
            comps.append(area)
    if not comps: return im, 0
    floor = max(comps) * ratio
    doomed = {i + 1 for i, a in enumerate(comps) if a < floor}
    if not doomed: return im, 0
    for i, cid in enumerate(lab):
        if cid in doomed:
            x, y = i % w, i // w; r, g, b, _ = px[x, y]; px[x, y] = (r, g, b, 0)
    return im, len(doomed)

def main(src, card_id, target_h=TARGET_H, panel=True):
    im = Image.open(src).convert('RGBA')
    corners = [im.getpixel(p) for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
    transparent = all(c[3] == 0 for c in corners)
    how = '已去背'
    if not transparent:
        white = all(min(c[:3]) >= NEAR_WHITE for c in corners)
        black = all(max(c[:3]) <= NEAR_BLACK for c in corners)
        if white:
            im = flood(im, lambda r, g, b, a: a == 0 or min(r, g, b) >= NEAR_WHITE); how = '白底 flood fill'
            bg = panel_color(im) if panel else None
            if bg:
                im = flood(im, lambda r, g, b, a: a == 0 or all(abs(c - p) <= PANEL_TOL for c, p in zip((r,g,b), bg)))
                how += f' + 底板 rgb{bg} flood fill'
        elif black:
            im = flood(im, lambda r, g, b, a: a == 0 or max(r, g, b) <= NEAR_BLACK); how = '黑底 flood fill'
        else:
            raise SystemExit(f'{src}：四角不是白、不是黑、也不是透明（{corners[0]}），這張要另外處理，不要硬切')
    a = im.getchannel('A')
    im.putalpha(a.point(lambda v: 0 if v < 8 else v))
    im, killed = despeckle(im)
    if killed: how += f'（去掉 {killed} 塊碎屑）'
    box = im.getchannel('A').getbbox()
    if box: im = im.crop(box)
    target_h = int(target_h)
    im = im.resize((max(1, round(im.width * target_h / im.height)), target_h), Image.LANCZOS)
    out = ROOT / 'src' / f'card-{card_id}.png'
    im.save(out)
    print(f'card-{card_id}.png {im.size}  ({how})')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else TARGET_H)
