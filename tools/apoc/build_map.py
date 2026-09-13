# -*- coding: utf-8 -*-
"""把末世關卡地圖的素材從原型頁（map20.html 是 20 MB 的內嵌單頁）拆成檔案。

使用者 2026-09-13：「模式 是額外的大選項，切換後就是之前做的關卡地圖」。
地圖本身改由 `src/clicker-apoc-map.js` 畫進主頁，這裡只負責素材。

切法完全照 `_art/holo-test/build_map20.py`：
  - icons-sheet.png 的四象限各有一枚貼紙，背景的米白是從外圍四連通泛洪填出來的，
    貼紙邊緣那圈較深的輪廓會擋住填色 → 只動 alpha，RGB 一個像素都不改。
  - 四個 motif 的裁切框是原型量好的，照抄。

輸出：src/apoc/map/{terrain,check,lock,paw,gate}.webp
用法：python tools/apoc/build_map.py
"""
from collections import deque
from pathlib import Path
from PIL import Image

ART = Path(r'D:/claude研究/clawd-pet-50/_art/holo-test/map-art')
OUT = Path(__file__).resolve().parents[2] / 'src/apoc/map'
BOUNDS = {'check': (112, 132, 516, 506), 'lock': (804, 105, 1129, 521),
          'paw': (109, 744, 506, 1119), 'gate': (682, 738, 1219, 1142)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(ART / 'icons-sheet.png').convert('RGB')
    w, h = sheet.size
    cutout = sheet.convert('RGBA'); pix = cutout.load(); seen = bytearray(w * h)
    queue = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]: continue
        seen[y * w + x] = 1
        r, g, b, a = pix[x, y]
        if min(r, g, b) < 235 or max(r, g, b) - min(r, g, b) > 25: continue
        pix[x, y] = (r, g, b, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    # 原型的切法就是嚴格的 2×2 象限，再用量好的框去邊
    cells = [(0, 0, w // 2, h // 2), (w // 2, 0, w, h // 2), (0, h // 2, w // 2, h), (w // 2, h // 2, w, h)]
    total = 0
    for (name, box), cell in zip(BOUNDS.items(), cells):
        x, y = cell[0], cell[1]
        crop = cutout.crop(cell).crop((box[0] - x, box[1] - y, box[2] - x, box[3] - y))
        dest = OUT / f'{name}.webp'; crop.save(dest, 'WEBP', lossless=True, method=4, exact=True)
        total += dest.stat().st_size
    # 地形是滿版插畫，無損會到 1.3 MB；原型自己也是壓 quality 過的，這裡沿用 q90
    scene = Image.open(ART / 'seg1-backyard-ruin.png').convert('RGB')
    dest = OUT / 'terrain.webp'; scene.save(dest, 'WEBP', quality=90, method=4)
    total += dest.stat().st_size
    print(f'地圖素材 5 個檔，合計 {total/1e6:.2f} MB（地形 {scene.size[0]}×{scene.size[1]}）')


if __name__ == '__main__':
    main()
