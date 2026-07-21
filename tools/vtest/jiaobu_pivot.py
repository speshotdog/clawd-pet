#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""膠布樞紐實驗輔助：
  tip        : 找 pawR 刀尖（離某樞紐最遠的深色點）與各角度位移(物理px)
  jwin       : junction-windowed 指標——只在交界窗口內算 blackline_maxcomp
"""
import sys, os, math
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = r'D:\claude\clawd-pet'
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
# jiaobu viewBox 121 63 553 635 → 物理 W=323 H=371
VBX, VBY, VBW, VBH = 121, 63, 553, 635
PW, PH = 323, 371
SX, SY = PW / VBW, PH / VBH  # viewBox→physical


def rgba(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.int16)


def tip_of(pivot):
    paw = rgba(os.path.join(SRC, 'jiaobu-pawR.png'))
    L = 0.299 * paw[..., 0] + 0.587 * paw[..., 1] + 0.114 * paw[..., 2]
    dark = (paw[..., 3] > 128) & (L < 110)
    ys, xs = np.where(dark)
    d2 = (xs - pivot[0]) ** 2 + (ys - pivot[1]) ** 2
    k = int(np.argmax(d2))
    return (int(xs[k]), int(ys[k])), math.sqrt(d2[k])


def tipcmd():
    for piv in [(533, 452), (595, 545), (610, 560), (580, 530)]:
        tip, r_vb = tip_of(piv)
        r_phys = r_vb * (SX + SY) / 2
        print(f'pivot {piv}: tip(viewBox)={tip} radius_vb={r_vb:.0f} radius_phys={r_phys:.0f}')
        for deg in [5.5, 11, 14.5]:
            disp = r_phys * math.sin(math.radians(deg))
            print(f'    {deg:>5}° → 刀尖位移 {disp:.1f} 物理px')


# junction window（物理座標）：肩接縫 overlap 帶 x_vb[588-602] y_vb[516-576] 轉物理並外擴
def jwin_bbox(pad=8):
    x0 = (588 - VBX) * SX - pad; x1 = (602 - VBX) * SX + pad
    y0 = (516 - VBY) * SY - pad; y1 = (576 - VBY) * SY + pad
    return int(x0), int(y0), int(x1), int(y1)


def L(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def jwin():
    # 用法 python jiaobu_pivot.py jwin <zerotag> <tag1,tag2,...>
    zt, spec = sys.argv[2], sys.argv[3]
    x0, y0, x1, y1 = jwin_bbox()
    base = rgba(os.path.join(OUT, f'jiaobu_pawR_{zt}.png'))
    a0 = base[..., 3]; L0 = L(base)
    print(f'junction window 物理 x[{x0}-{x1}] y[{y0}-{y1}]  (0°={zt})')
    for item in spec.split(','):
        tag = item
        f = rgba(os.path.join(OUT, f'jiaobu_pawR_{tag}.png'))
        aT = f[..., 3]; LT = L(f)
        both = (a0 > 128) & (aT > 128)
        bl = both & (LT < L0 - 45) & (LT < 110)
        win = np.zeros_like(bl); win[y0:y1, x0:x1] = True
        blw = bl & win
        if blw.sum():
            lab, n = ndimage.label(blw)
            mc = int(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)).max())
        else:
            mc = 0
        # 全幀對照
        if bl.sum():
            lab2, n2 = ndimage.label(bl)
            mcf = int(ndimage.sum(np.ones_like(lab2), lab2, range(1, n2 + 1)).max())
        else:
            mcf = 0
        print(f'  {tag:>7}  jwin_blackline_px={int(blw.sum()):>4} jwin_maxcomp={mc:>4}   fullframe_maxcomp={mcf:>4}')


if __name__ == '__main__':
    {'tip': tipcmd, 'jwin': jwin}[sys.argv[1]]()
