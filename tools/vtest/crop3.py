#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""並排三張圖(ref/tail/body)的同一裁窗，透明鋪棋盤，放大檢視結構。
用法：python crop3.py x0 y0 x1 y1 scale out.png ref.png tail.png body.png [labels...]
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

x0, y0, x1, y1, scale, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
paths = sys.argv[7:]
W, H = x1 - x0, y1 - y0


def render(p):
    a = np.asarray(Image.open(p).convert('RGBA'))[y0:y1, x0:x1].astype(float)
    rgb = a[..., :3]; al = a[..., 3:4] / 255.0
    # 棋盤底
    yy, xx = np.mgrid[0:H, 0:W]
    chk = (((xx // 8 + yy // 8) % 2) * 40 + 180).astype(float)
    bg = np.stack([chk, chk, chk], -1)
    comp = (rgb * al + bg * (1 - al)).astype(np.uint8)
    return Image.fromarray(comp).resize((W * scale, H * scale), Image.NEAREST)


imgs = [render(p) for p in paths]
gap = 10
canvas = Image.new('RGB', (sum(i.width for i in imgs) + gap * (len(imgs) + 1), imgs[0].height + 24), (30, 30, 30))
d = ImageDraw.Draw(canvas)
labels = ['ref', 'tail', 'body', 'd', 'e']
x = gap
for i, im in enumerate(imgs):
    canvas.paste(im, (x, 20))
    d.text((x, 4), f'{labels[i]}  win=({x0},{y0})-({x1},{y1})', fill=(255, 255, 0))
    x += im.width + gap
canvas.save(out)
print('saved', out, canvas.size)
