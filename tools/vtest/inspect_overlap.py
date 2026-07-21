#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""診斷『深對深重疊帶』：載入 part 與 body，找兩者都是深色(且不透明)的像素＝重疊帶。
輸出一張放大診斷圖：body深色=藍、part深色=紅、兩者都深(重疊帶)=洋紅。並印重疊帶像素數與 bbox。
用法：python inspect_overlap.py <part_png> <body_png> <cx> <cy> <half>  (原圖768座標裁窗)
"""
import sys, os
import numpy as np
from PIL import Image

def dark(png):
    a = np.asarray(Image.open(png).convert('RGBA')).astype(np.int16)
    L = 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
    return (a[...,3] > 128) & (L < 110), a

part_png, body_png = sys.argv[1], sys.argv[2]
cx, cy, half = int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
pd, pa = dark(part_png)
bd, ba = dark(body_png)
overlap = pd & bd
ys, xs = np.where(overlap)
if len(xs):
    print(f'重疊帶 px={overlap.sum()}  bbox=x[{xs.min()}-{xs.max()}] y[{ys.min()}-{ys.max()}]  寬{xs.max()-xs.min()+1} 高{ys.max()-ys.min()+1}')
else:
    print('重疊帶 px=0 (無深對深重疊)')
# 診斷圖裁窗
x0,x1 = max(0,cx-half), min(768,cx+half)
y0,y1 = max(0,cy-half), min(768,cy+half)
H,W = y1-y0, x1-x0
img = np.full((H,W,3), 235, np.uint8)
# body 灰底
bL = (0.299*ba[...,0]+0.587*ba[...,1]+0.114*ba[...,2]).astype(np.uint8)
bon = ba[...,3] > 40
sub_bon = bon[y0:y1, x0:x1]
img[sub_bon] = np.stack([bL[y0:y1,x0:x1]]*3, -1)[sub_bon]
img[bd[y0:y1,x0:x1]] = [80,80,255]     # body 深色 藍
img[pd[y0:y1,x0:x1]] = [255,80,80]     # part 深色 紅
img[overlap[y0:y1,x0:x1]] = [255,60,255] # 重疊帶 洋紅
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'overlap_diag.png')
Image.fromarray(img).resize((W*3,H*3), Image.NEAREST).save(out)
print('圖=', out)
