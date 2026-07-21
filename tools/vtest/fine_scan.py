#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""細角度掃描：找乾淨最大角。讀 out/<char>_<part>_<tag>.png，對 base(0deg) 算 blackline_maxcomp。
用法：python fine_scan.py <char> <part> <zerotag> <tag:deg,tag:deg,...>
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
DARK_DROP, DARK_ABS, A_ON = 45, 110, 128


def L(a): return 0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
def ld(char,part,tag):
    return np.asarray(Image.open(os.path.join(OUT,f'{char}_{part}_{tag}.png')).convert('RGBA')).astype(np.int16)

def maxcomp(m):
    if m.sum()==0: return 0
    lab,n=ndimage.label(m)
    if n==0: return 0
    return int(ndimage.sum(np.ones_like(lab),lab,range(1,n+1)).max())

def main():
    char,part,zerotag,spec = sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
    base=ld(char,part,zerotag); a0=base[...,3]; L0=L(base)
    print(f'{char}/{part}  (0deg={zerotag})   [clean floor: dog maxcomp<=64]')
    rows=[]
    for item in spec.split(','):
        tag,deg=item.split(':')
        f=ld(char,part,tag); aT=f[...,3]; LT=L(f)
        both=(a0>A_ON)&(aT>A_ON)
        bl=both&(LT<L0-DARK_DROP)&(LT<DARK_ABS)
        mc=maxcomp(bl)
        rows.append((float(deg),int(bl.sum()),mc))
    for deg,px,mc in sorted(rows,key=lambda r:r[0]):
        flag='  <-- clean' if mc<=64 else ('  << dirty' if mc>=150 else '  ~ marginal')
        print(f'  {deg:>6.1f}deg  blackline_px={px:>5}  maxcomp={mc:>5}{flag}')

if __name__=='__main__': main()
