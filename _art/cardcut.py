# -*- coding: utf-8 -*-
"""把桌面「新卡」資料夾的原圖切成 src/card-<id>.png。

三種來源混在一起（見 2026-09-08 的批次）：
  1. 已經去背的 RGBA（邊角 alpha=0）→ 只要裁邊 + 縮放
  2. 白底 RGBA/RGB（邊角是白的）  → 從四邊 flood fill 近白色，只吃「跟邊界連通」的白
     （zhencao 那次的教訓反過來：角色身上封閉的白袋不能一起吃掉，所以不用全域門檻）
  3. 黑底 RGBA（2.0 批的黃色蠑螈）→ 從四邊 flood fill 近黑色。角色自己的黑描邊外面隔著
     一圈灰色貼紙外框，fill 走到灰色就停，不會把描邊一起吃掉
  4. 不透明的場景圖（滅世珍獸）    → 不去背，另外處理

用法: python _art/cardcut.py <來源png> <card-id> [目標高度]
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
NEAR_WHITE = 232          # RGB 三通道都 >= 這個值才算背景白
NEAR_BLACK = 30           # RGB 三通道都 <= 這個值才算背景黑
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

def main(src, card_id, target_h=TARGET_H):
    im = Image.open(src).convert('RGBA')
    corners = [im.getpixel(p) for p in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]]
    transparent = all(c[3] == 0 for c in corners)
    how = '已去背'
    if not transparent:
        white = all(min(c[:3]) >= NEAR_WHITE for c in corners)
        black = all(max(c[:3]) <= NEAR_BLACK for c in corners)
        if white:
            im = flood(im, lambda r, g, b, a: a == 0 or min(r, g, b) >= NEAR_WHITE); how = '白底 flood fill'
        elif black:
            im = flood(im, lambda r, g, b, a: a == 0 or max(r, g, b) <= NEAR_BLACK); how = '黑底 flood fill'
        else:
            raise SystemExit(f'{src}：四角不是白、不是黑、也不是透明（{corners[0]}），這張要另外處理，不要硬切')
    a = im.getchannel('A')
    im.putalpha(a.point(lambda v: 0 if v < 8 else v))
    box = im.getchannel('A').getbbox()
    if box: im = im.crop(box)
    target_h = int(target_h)
    im = im.resize((max(1, round(im.width * target_h / im.height)), target_h), Image.LANCZOS)
    out = ROOT / 'src' / f'card-{card_id}.png'
    im.save(out)
    print(f'card-{card_id}.png {im.size}  ({how})')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else TARGET_H)
