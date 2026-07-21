#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""玥玥 tail/body 重切分析與建置。
compose 順序（照 template）：tail(後) → body(前/上)。在尾巴區比對 ref。
子命令：
  base   : 印 current composite vs ref 在尾巴區的逐像素差；輸出分類圖
  build  : 依方法建新 body（刪除 body∩tail 的重疊描邊，改法由 --mode 指定），寫檔
"""
import sys, os
import numpy as np
from PIL import Image

ROOT = r'D:\claude\clawd-pet'
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')


def rgba(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.int16)


def over(dst, src):
    """src over dst, both HxWx4 int16 0..255 → int16."""
    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    oa = sa + da * (1 - sa)
    rgb = np.where(oa > 0, (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.clip(oa, 1e-6, None), 0)
    out = np.concatenate([rgb, oa * 255], -1)
    return out.astype(np.int16)


def L(a):
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def load_all():
    tail = rgba(os.path.join(SRC, 'yueyue-tail.png'))
    body = rgba(os.path.join(SRC, 'yueyue-body.png'))
    ref = rgba(os.path.join(ROOT, 'ref-yueyue.png'))
    return tail, body, ref


# 尾巴分析區（768 座標，右側）
RX0, RY0, RX1, RY1 = 520, 250, 730, 690


def base():
    tail, body, ref = load_all()
    trans = np.zeros_like(tail)
    comp = over(over(trans, tail), body)
    # 尾巴區 diff（只比不透明差異；ref 邊緣 AA 容忍）
    reg = (slice(RY0, RY1), slice(RX0, RX1))
    dc = comp[reg]; dr = ref[reg]
    # 對齊 alpha：兩邊都不透明處比 RGB；alpha 不同處也算差
    da = np.abs(dc[..., 3] - dr[..., 3])
    drgb = np.abs(dc[..., :3] - dr[..., :3]).max(-1)
    both = (dc[..., 3] > 128) & (dr[..., 3] > 128)
    diff = ((da > 40) | (both & (drgb > 40)))
    print(f'baseline composite vs ref 尾巴區: 差異像素={int(diff.sum())} / {diff.size}  (alpha差>40 或 共同不透明RGB差>40)')
    # 分類：body dark, tail dark, overlap
    bd = (body[..., 3] > 128) & (L(body) < 110)
    td = (tail[..., 3] > 128) & (L(tail) < 110)
    ov = bd & td
    bonly = bd & ~td
    print(f'尾巴區 body_dark={int(bd[reg].sum())} tail_dark={int(td[reg].sum())} overlap={int(ov[reg].sum())} body_only_dark={int(bonly[reg].sum())}')
    # 分類圖
    H, W = RY1 - RY0, RX1 - RX0
    img = np.full((H, W, 3), 235, np.uint8)
    bl = L(body).astype(np.uint8)
    bon = body[..., 3] > 40
    img[bon[reg]] = np.stack([bl] * 3, -1)[reg][bon[reg]]
    img[bonly[reg]] = [60, 100, 255]   # body-only dark 藍（真身體邊，保留）
    img[ov[reg]] = [255, 60, 255]      # overlap 洋紅（重複描邊，可拆）
    img[diff] = [50, 220, 50]          # baseline diff 綠（應接近無）
    Image.fromarray(img).resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(OUT, 'PHASEB_yy_classify.png'))
    print('分類圖=', os.path.join(OUT, 'PHASEB_yy_classify.png'), '(藍=真身體邊留 洋紅=重疊描邊拆 綠=baseline差)')


def gray_of(body):
    reg = (slice(RY0, RY1), slice(RX0, RX1))
    b = body[reg]
    m = (b[..., 3] > 200) & (L(b) > 140)
    px = b[m][:, :3]
    return np.median(px, 0).astype(np.int16) if len(px) else np.array([162, 159, 151])


def diff_vs_ref(comp, ref, tag=''):
    reg = (slice(RY0, RY1), slice(RX0, RX1))
    dc, dr = comp[reg], ref[reg]
    da = np.abs(dc[..., 3] - dr[..., 3])
    both = (dc[..., 3] > 128) & (dr[..., 3] > 128)
    drgb = np.abs(dc[..., :3] - dr[..., :3]).max(-1)
    diff = ((da > 40) | (both & (drgb > 40)))
    print(f'  {tag} 0°composite vs ref 尾巴區差異像素={int(diff.sum())}')
    return diff


def build():
    mode = sys.argv[2]
    outbody = sys.argv[3]
    tail, body, ref = load_all()
    bd = (body[..., 3] > 128) & (L(body) < 110)
    td = (tail[..., 3] > 128) & (L(tail) < 110)
    ov = bd & td
    gray = gray_of(body)
    if mode.startswith('tail_'):
        from scipy import ndimage
        nt = tail.copy()
        if mode == 'tail_trim_inner':
            # 移除尾巴與 body 邊重疊的內側描邊（0° 本就被 body 蓋住，移除不動 0°）
            rm = ov.copy()
        elif mode == 'tail_trim_inner_keep2':
            # 保留貼 body 真剪影邊 2px 當存根，其餘 overlap 移除
            bt = body[..., 3] <= 64
            near_bg = ndimage.binary_dilation(bt, iterations=2)
            rm = ov & ~near_bg
        nt[rm, 3] = 0
        Image.fromarray(nt.astype(np.uint8)).save(outbody)  # outbody 這裡是 tail 輸出路徑
        comp = over(over(np.zeros_like(tail), nt), body)
        diff_vs_ref(comp, ref, mode)
        print('  removed from tail:', int(rm.sum()), 'px  wrote', outbody)
        return
    nb = body.copy()
    if mode == 'grayfill':
        nb[ov] = [gray[0], gray[1], gray[2], 255]
    elif mode == 'transp':
        nb[ov, 3] = 0
    elif mode == 'grayfill_keepouter':
        # 只把 overlap「內側」(靠 body 那半)填灰，最外 3px（body 真剪影邊）保留為單一暗邊
        from scipy import ndimage
        # overlap 的外緣（貼背景側）：距 body 透明區 <=3px 的 overlap 保留
        bt = body[..., 3] <= 64
        near_bg = ndimage.binary_dilation(bt, iterations=3)
        fill = ov & ~near_bg
        nb[fill] = [gray[0], gray[1], gray[2], 255]
    Image.fromarray(nb.astype(np.uint8)).save(outbody)
    comp = over(over(np.zeros_like(tail), tail), nb)
    diff_vs_ref(comp, ref, mode)
    print('  wrote', outbody)


if __name__ == '__main__':
    fn = sys.argv[1]
    {'base': base, 'build': build}[fn]()
