#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""vtest 指標：在「實體尺度」的 Chromium 光柵化 frame 上，對每個部件角度掃描與 0° 比對，
量三種缺陷並輸出 2x 人審條帶。所有 frame 同尺寸（只有目標部件 transform 不同，body 相同），
故可直接逐像素比對，無需對位。

指標：
  (a) 黑線 darken : 兩層都不透明、θ 顯著比 0° 暗且本身夠暗（深對深半透明疊加變更黑）——
                    這是實機新指標，PIL 不透明合成世界抓不到。
  (b) 缺口 gap    : θ 出現「被剪影包住」的透明像素（背景色跑進剪影內＝破圖）。
  (c) 殘影 ghost  : 0° 是明亮毛色、θ 變深色的孤兒塊（部件移開後露出的深色殘留）。

用法：python metrics.py <char> <part> <tag0,tag1,...>   (tag 檔名 out/<char>_<part>_<tag>.png，須含 0)
輸出：out/strip_<char>_<part>.png  與  out/report_<char>_<part>.json（並印出摘要）
"""
import sys, os, json
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
try:
    from scipy import ndimage
    HAVE_SCIPY = True
except Exception:
    HAVE_SCIPY = False

# --- 門檻（以實體尺度像素為單位；預設讓乾淨對照 dog 落在 noise 以下）---
DARK_DROP = 45      # θ 比 0° 暗多少才算「變暗」
DARK_ABS  = 110     # θ 本身要夠暗才算黑線像素
LIGHT_ABS = 150     # 0° 要夠亮才算「原本是毛色」（給 ghost 用）
A_ON      = 128     # 不透明門檻
A_OFF     = 64      # 透明門檻


def load(char, part, tag):
    p = os.path.join(OUT, f'{char}_{part}_{tag}.png')
    im = Image.open(p).convert('RGBA')
    return np.asarray(im).astype(np.int16)


def lum(rgb):
    return (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2])


def enclosed_bg(alpha):
    """回傳『被不透明像素四向包住』的透明像素 mask（剪影內破洞）。"""
    on = alpha > A_ON
    off = alpha < A_OFF
    H, W = alpha.shape
    # 四向是否有不透明像素（累積 max 掃描）
    left = np.zeros_like(on); right = np.zeros_like(on)
    up = np.zeros_like(on); down = np.zeros_like(on)
    acc = np.zeros(H, bool)
    for x in range(W):
        acc |= on[:, x]; left[:, x] = acc
    acc = np.zeros(H, bool)
    for x in range(W - 1, -1, -1):
        acc |= on[:, x]; right[:, x] = acc
    acc = np.zeros(W, bool)
    for y in range(H):
        acc |= on[y, :]; up[y, :] = acc
    acc = np.zeros(W, bool)
    for y in range(H - 1, -1, -1):
        acc |= on[y, :]; down[y, :] = acc
    return off & left & right & up & down


def largest_component(mask):
    if mask.sum() == 0:
        return 0, None, 0.0, 0.0
    if HAVE_SCIPY:
        lab, n = ndimage.label(mask)
        if n == 0:
            return 0, None, 0.0, 0.0
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        k = int(np.argmax(sizes)) + 1
        ys, xs = np.where(lab == k)
        size = int(sizes.max())
    else:
        ys, xs = np.where(mask)
        size = int(mask.sum())
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    bw, bh = (x1 - x0 + 1), (y1 - y0 + 1)
    aspect = max(bw, bh) / max(1, min(bw, bh))
    density = size / max(1, bw * bh)
    return size, [int(x0), int(y0), int(bw), int(bh)], round(aspect, 2), round(density, 3)


def analyze(char, part, tags, zerotag='0'):
    base = None
    frames = {}
    for t in tags:
        frames[t] = load(char, part, t)
    base = frames[zerotag if zerotag in frames else tags[len(tags) // 2]]
    a0 = base[..., 3]; L0 = lum(base)
    rows = []
    heat = {}
    for t in tags:
        f = frames[t]
        aT = f[..., 3]; LT = lum(f)
        both = (a0 > A_ON) & (aT > A_ON)
        darker = both & (LT < L0 - DARK_DROP)
        blackline = darker & (LT < DARK_ABS)
        ghost = (a0 > A_ON) & (L0 > LIGHT_ABS) & (aT > A_ON) & (LT < DARK_ABS)
        gap = enclosed_bg(aT) & (a0 > A_ON)   # 0° 該處本是不透明，θ 破洞
        bl_size, bl_bbox, bl_aspect, bl_dens = largest_component(blackline)
        gp_size, gp_bbox, gp_aspect, gp_dens = largest_component(gap)
        gh_size, gh_bbox, gh_aspect, gh_dens = largest_component(ghost)
        rows.append({
            'tag': t, 'deg': t,
            'blackline_px': int(blackline.sum()), 'blackline_maxcomp': bl_size,
            'blackline_bbox': bl_bbox, 'blackline_aspect': bl_aspect,
            'darken_px': int(darker.sum()), 'max_darken': int((L0 - LT)[darker].max()) if darker.any() else 0,
            'gap_px': int(gap.sum()), 'gap_maxcomp': gp_size, 'gap_bbox': gp_bbox,
            'ghost_px': int(ghost.sum()), 'ghost_maxcomp': gh_size, 'ghost_bbox': gh_bbox,
        })
        # heatmap：紅=變暗(黑線/殘影)，藍=缺口
        H, W = aT.shape
        hm = np.zeros((H, W, 3), np.uint8)
        # 底：灰階原圖
        g = np.clip(LT, 0, 255).astype(np.uint8)
        hm[..., 0] = g // 2; hm[..., 1] = g // 2; hm[..., 2] = g // 2
        hm[darker] = [255, 40, 40]
        hm[gap] = [40, 120, 255]
        # 透明處塗棋盤讓破圖可見
        trans = aT < A_OFF
        hm[trans] = [90, 90, 90]
        heat[t] = hm
    return rows, frames, heat


def make_strip(char, part, tags, frames, heat, scale=2):
    # 兩列：上=原 frame(透明鋪灰底)，下=heatmap。每格上方標角度。
    H, W = frames[tags[0]].shape[:2]
    pad = 6
    cols = len(tags)
    cellW = W * scale + pad
    stripW = cellW * cols + pad
    stripH = (H * scale) * 2 + pad * 3 + 18
    canvas = Image.new('RGB', (stripW, stripH), (60, 60, 60))
    from PIL import ImageDraw
    d = ImageDraw.Draw(canvas)
    for i, t in enumerate(tags):
        x = pad + i * cellW
        # 原 frame over 灰底
        f = frames[t].astype(np.uint8)
        rgb = f[..., :3]; a = f[..., 3:4] / 255.0
        bg = np.full_like(rgb, 128)
        comp = (rgb * a + bg * (1 - a)).astype(np.uint8)
        im = Image.fromarray(comp).resize((W * scale, H * scale), Image.NEAREST)
        canvas.paste(im, (x, 18))
        hm = Image.fromarray(heat[t]).resize((W * scale, H * scale), Image.NEAREST)
        canvas.paste(hm, (x, 18 + H * scale + pad))
        d.text((x, 4), f'{t}deg', fill=(255, 255, 0))
    path = os.path.join(OUT, f'strip_{char}_{part}.png')
    canvas.save(path)
    return path


def main():
    char, part, tagstr = sys.argv[1], sys.argv[2], sys.argv[3]
    tags = tagstr.split(',')
    rows, frames, heat = analyze(char, part, tags)
    strip = make_strip(char, part, tags, frames, heat)
    report = {'char': char, 'part': part, 'tags': tags,
              'thresholds': {'DARK_DROP': DARK_DROP, 'DARK_ABS': DARK_ABS, 'LIGHT_ABS': LIGHT_ABS},
              'strip': strip, 'frames': rows}
    rp = os.path.join(OUT, f'report_{char}_{part}.json')
    with open(rp, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f'== {char} {part} ==  strip={strip}')
    for r in rows:
        print(f"  {r['deg']:>6}deg  blackline={r['blackline_px']:>5} (maxcomp={r['blackline_maxcomp']} bbox={r['blackline_bbox']} asp={r['blackline_aspect']})"
              f"  darken={r['darken_px']:>5}(max{r['max_darken']})  gap={r['gap_px']:>4}(comp{r['gap_maxcomp']})  ghost={r['ghost_px']:>5}(comp{r['ghost_maxcomp']})")
    print('report=' + rp)


if __name__ == '__main__':
    main()
