# -*- coding: utf-8 -*-
"""玩物就玩物（wanwumythic）改 depth：作者給的 PSD 三層（手／羊／愛心）直接當圖層，不摳圖。

來源：桌面「玩物就玩物.psd」1000×1500、透明底、三個像素圖層：
  手（最後面）→ 背景層；羊＋愛心（前面兩層）→ 主體層。
裁窗規則沿用 prepare_5_0_flat.py：5:7 視窗、臉中心落在卡高 40.2%
（卡頂到文字框上緣的中點；文字框 bottom 3.4% + height 16.2% → 上緣 80.4%）。
RGB 不改、不補畫；PSD 沒有背景，所以背景層＝手層疊在一塊素色底上（A 深色／B 暖色，待使用者選）。
輸出到 shots/wanwu/ 先給人看；定案後才覆蓋 layer-wanwumythic-*.png 與 masks。
"""
from pathlib import Path
import base64, io, json, math, os, sys
import numpy as np
from PIL import Image
from psd_tools import PSDImage

HERE = Path(__file__).resolve().parent
OUT = HERE / 'shots' / 'wanwu'
PSD = Path(os.environ.get('WANWU_PSD', Path.home() / 'OneDrive/Desktop/玩物就玩物.psd'))

W, H = 600, 840
PLATE_TOP = 1 - 0.034 - 0.162          # 文字框上緣（卡高比例）
FACE_Y = PLATE_TOP / 2                 # 0.402
MARGIN = 24                            # 羊＋愛心包圍盒到視窗左右邊的留白（來源像素）


def layers():
    psd = PSDImage.open(PSD)
    out = {}
    for l in psd:
        canvas = Image.new('RGBA', psd.size, (0, 0, 0, 0))
        canvas.paste(l.topil(), (l.bbox[0], l.bbox[1]))
        out[l.name] = canvas
    assert set(out) == {'手', '羊', '愛心'}, list(out)
    return psd.size, out


def face_center(sheep):
    a = np.array(sheep)
    from scipy import ndimage as nd
    white = (a[:, :, :3].min(2) > 225) & (a[:, :, 3] > 200)
    lab, _ = nd.label(white); sizes = np.bincount(lab.ravel()); sizes[0] = 0
    ys, xs = np.nonzero(lab == sizes.argmax())
    return (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2


def window(size, sheep, hearts):
    """2026-09-15 使用者：放大到羊不會被裁切的程度。視窗寬＝羊＋愛心包圍盒寬＋兩側留白，
    水平以該包圍盒置中，垂直仍以臉中心釘在 40.2%；手會被裁是預期的（它是背景層）。"""
    fx, fy = face_center(sheep)
    sb = sheep.getbbox(); hb = hearts.getbbox()
    ub = (min(sb[0], hb[0]), min(sb[1], hb[1]), max(sb[2], hb[2]), max(sb[3], hb[3]))
    win_w = ub[2] - ub[0] + 2 * MARGIN
    cx = (ub[0] + ub[2]) / 2
    win_h = round(win_w * 7 / 5)
    left = round(cx - win_w / 2); top = round(fy - FACE_Y * win_h)
    box = (left, top, left + win_w, top + win_h)
    assert 0 <= box[0] and 0 <= box[1] and box[2] <= size[0] and box[3] <= size[1], box
    assert box[0] <= ub[0] and ub[2] <= box[2] and box[1] <= ub[1] and ub[3] <= box[3], (box, ub)   # 羊與愛心都不被裁
    return box, (fx, fy), win_w


def crop(im, box):
    return im.crop(box).resize((W, H), Image.Resampling.LANCZOS)


def backdrop(kind):
    """素色底：A 照 demo.html 非場景卡的 CSS 深色底；B 暖色（羊的粉／手的膚色同調）。"""
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    u, v = xx / W, yy / H
    if kind == 'A':
        t = np.clip((u * math.cos(math.radians(155 - 90)) + v * math.sin(math.radians(155 - 90)) + 0.25) / 1.2, 0, 1)
        c0, c1 = np.array([0x2b, 0x35, 0x47]), np.array([0x11, 0x1c, 0x2d])
        rgb = c0 * (1 - t[..., None]) + c1 * t[..., None]
        d = np.sqrt(((u - .5) / .5) ** 2 + ((v - .6) / .6) ** 2)
        g = np.clip(1 - d / .65, 0, 1) * 0x55 / 255
        rgb = rgb * (1 - g[..., None]) + np.array([0x4b, 0x4f, 0x73]) * g[..., None]
        d = np.sqrt(((u - .5) / .5) ** 2 + ((v - .75) / .6) ** 2)
        g = np.clip(1 - d / .65, 0, 1) * .17
        rgb = rgb * (1 - g[..., None]) + np.array([0xc6, 0xb2, 0x81]) * g[..., None]
    else:
        c0, c1 = np.array([0xfd, 0xf1, 0xea]), np.array([0xf2, 0xc4, 0xc6])
        t = np.clip(v * 1.1, 0, 1)
        rgb = c0 * (1 - t[..., None]) + c1 * t[..., None]
        d = np.sqrt(((u - .5) / .55) ** 2 + ((v - .42) / .5) ** 2)
        g = np.clip(1 - d, 0, 1) * .35
        rgb = rgb * (1 - g[..., None]) + np.array([0xff, 0xff, 0xff]) * g[..., None]
    return Image.fromarray(np.dstack([rgb.astype('uint8'), np.full((H, W), 255, 'uint8')]))


def data_uri(im, fmt='PNG'):
    buf = io.BytesIO(); im.save(buf, format=fmt)
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    size, L = layers()
    box, face, win_w = window(size, L['羊'], L['愛心'])
    subject = crop(L['羊'], box)                    # 主體只有羊；愛心另一層在最上面微晃
    hearts = crop(L['愛心'], box)
    hands = crop(L['手'], box)
    subject.save(OUT / 'layer-wanwumythic-subject.png')
    hearts.save(OUT / 'layer-wanwumythic-hearts.png')
    backs = {}
    for k in 'AB':
        back = Image.alpha_composite(backdrop(k), hands)
        assert np.array(back)[:, :, 3].min() == 255
        back.save(OUT / f'layer-wanwumythic-background-{k}.png')
        Image.alpha_composite(Image.alpha_composite(back, subject), hearts).save(OUT / f'aligned-{k}.png')
        backs[k] = back
    small = subject.copy(); small.thumbnail((300, 420), Image.Resampling.LANCZOS)
    mask = Image.new('RGBA', small.size, 'white'); mask.putalpha(small.getchannel('A'))
    (OUT / 'mask.json').write_text(json.dumps({'layer-wanwumythic-subject.png': data_uri(mask)}), encoding='utf-8')
    meta = dict(psd=str(PSD), psd_size=size, window=box, face_center_source=face,
                face_center_card=[(face[0] - box[0]) / win_w, (face[1] - box[1]) / (box[3] - box[1])],
                subject_bbox=subject.getbbox(), hearts_bbox=hearts.getbbox(), hands_bbox_card=hands.getbbox(),
                subject_bottom_ratio=subject.getbbox()[3] / H, plate_top=PLATE_TOP)
    (OUT / 'preparation.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
