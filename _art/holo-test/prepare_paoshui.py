# -*- coding: utf-8 -*-
"""泡水大亨堡（paoshuidahengbao，新卡・神話）depth：作者給的 .clip 三層（水池／熱狗／水波）直接當圖層，不摳圖。

來源：桌面「熱狗池整理.clip」1000×1500、透明底、三個像素圖層（拆出的 PNG 放在 art/paoshui/）：
  水池（最後面）→ 背景層；熱狗 → 主體層；水波（最前面）→ 第三層疊在最上面慢慢漂（card_fx.js）。
裁窗（2026-09-16 定案）：視窗＝作者畫的水池矩形（x 64–911、y 136–1198）以高度吃滿、5:7 置中，
跟整幅圖 flat 卡看到的範圍一模一樣（使用者：「第一張的位置構圖、第二張的效果」）。
第一版臉釘 40.2% 的規則留在 window_face() 備查；臉＝熱狗頭（含眼睛的淺褐色連通塊）。
RGB 不改、不補畫、不摳圖。
輸出到 shots/paoshui/ 先給人看；定案後才覆蓋 layer-paoshuidahengbao-*.png 與 masks。
"""
from pathlib import Path
import base64, io, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = Path(__file__).resolve().parent
SRC = HERE / 'art' / 'paoshui'
OUT = HERE / 'shots' / 'paoshui'
ID = 'paoshuidahengbao'

W, H = 600, 840
PLATE_TOP = 1 - 0.034 - 0.162          # 文字框上緣（卡高比例）
FACE_Y = PLATE_TOP / 2                 # 0.402
MARGIN = 24                            # 熱狗＋水波包圍盒到視窗左右邊的留白（來源像素）


def layers():
    out = {n: Image.open(SRC / f'{n}.png').convert('RGBA') for n in ('pool', 'hotdog', 'ripples')}
    assert len({im.size for im in out.values()}) == 1
    return out['pool'].size, out


def face_center(hotdog):
    a = np.array(hotdog).astype(int)
    solid = a[:, :, 3] > 128
    tan = (abs(a[:, :, 0] - 232) < 25) & (abs(a[:, :, 1] - 198) < 25) & (abs(a[:, :, 2] - 140) < 30) & solid
    dark = (a[:, :, :3].max(2) < 40) & solid
    dlab, n = nd.label(dark)
    sizes = np.bincount(dlab.ravel())
    small = [i for i in range(1, n + 1) if 100 <= sizes[i] <= 3000]      # 黑線稿是一大塊；眼睛、腳掌是小塊
    eye = dlab == min(small, key=lambda i: np.nonzero(dlab == i)[0].min())   # 最上面那個小塊＝眼睛
    lab, _ = nd.label(tan)
    eye_dil = nd.binary_dilation(eye, iterations=6)
    cands = [i for i in np.unique(lab[eye_dil]) if i]
    head = max(cands, key=lambda i: (lab == i).sum())          # 含眼睛的最大淺褐塊＝頭
    ys, xs = np.nonzero(lab == head)
    return (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2


def window_pool(pool, hotdog, ripples):
    """2026-09-16 使用者看過對照後選「第一張的位置構圖」：視窗＝作者畫的水池矩形以高度吃滿、5:7 置中裁
    （跟 flat 卡 object-fit:cover 看到的範圍一樣），臉不再釘 40.2%。熱狗與水波仍要完整在視窗內。"""
    x0, y0, x1, y1 = pool.getbbox()
    win_h = y1 - y0; win_w = round(win_h * 5 / 7)
    assert win_w <= x1 - x0, '水池矩形比 5:7 還窄'
    left = round((x0 + x1) / 2 - win_w / 2)
    box = (left, y0, left + win_w, y0 + win_h)
    sb = hotdog.getbbox(); rb = ripples.getbbox()
    ub = (min(sb[0], rb[0]), min(sb[1], rb[1]), max(sb[2], rb[2]), max(sb[3], rb[3]))
    assert box[0] <= ub[0] and ub[2] <= box[2] and box[1] <= ub[1] and ub[3] <= box[3], (box, ub)
    return box, face_center(hotdog), win_w


def window_face(size, hotdog, ripples):
    """第一版（09-15）：沿用 prepare_wanwu.py 的臉釘 40.2% 規則；使用者看過後改用 window_pool。"""
    fx, fy = face_center(hotdog)
    sb = hotdog.getbbox(); rb = ripples.getbbox()
    ub = (min(sb[0], rb[0]), min(sb[1], rb[1]), max(sb[2], rb[2]), max(sb[3], rb[3]))
    win_w = ub[2] - ub[0] + 2 * MARGIN
    cx = (ub[0] + ub[2]) / 2
    win_h = round(win_w * 7 / 5)
    left = round(cx - win_w / 2); top = round(fy - FACE_Y * win_h)
    box = (left, top, left + win_w, top + win_h)
    assert 0 <= box[0] and 0 <= box[1] and box[2] <= size[0] and box[3] <= size[1], box
    assert box[0] <= ub[0] and ub[2] <= box[2] and box[1] <= ub[1] and ub[3] <= box[3], (box, ub)   # 熱狗與水波都不被裁
    return box, (fx, fy), win_w


def crop(im, box):
    return im.crop(box).resize((W, H), Image.Resampling.LANCZOS)


def extend_pool(pool):
    """把水池那塊矩形的邊緣顏色往外延伸到整張畫布，讓背景層不透明。"""
    a = np.array(pool)
    x0, y0, x1, y1 = pool.getbbox()
    assert (a[y0:y1, x0:x1, 3] == 255).all(), '水池矩形內部不是全不透明'
    a[:y0] = a[y0]; a[y1:] = a[y1 - 1]
    a[:, :x0] = a[:, x0:x0 + 1]; a[:, x1:] = a[:, x1 - 1:x1]
    a[:, :, 3] = 255
    return Image.fromarray(a), (x0, y0, x1, y1)


def data_uri(im, fmt='PNG'):
    buf = io.BytesIO(); im.save(buf, format=fmt)
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    size, L = layers()
    box, face, win_w = window_pool(L['pool'], L['hotdog'], L['ripples'])
    pool_full, pool_rect = extend_pool(L['pool'])       # 視窗在水池矩形內時不會用到延伸的部分
    subject = crop(L['hotdog'], box)
    ripples = crop(L['ripples'], box)
    back = crop(pool_full, box)
    assert np.array(back)[:, :, 3].min() == 255
    subject.save(OUT / f'layer-{ID}-subject.png')
    ripples.save(OUT / f'layer-{ID}-ripples.png')
    back.save(OUT / f'layer-{ID}-background.png')
    Image.alpha_composite(Image.alpha_composite(back, subject), ripples).save(OUT / 'aligned.png')
    # 1.0 相容的整幅圖（card-<id>.png）：三層直接合成，跟 5.0 flat 卡同一種輸出
    Image.alpha_composite(Image.alpha_composite(L['pool'], L['hotdog']), L['ripples']).crop(L['pool'].getbbox()).save(OUT / f'card-{ID}.png')
    small = subject.copy(); small.thumbnail((300, 420), Image.Resampling.LANCZOS)
    mask = Image.new('RGBA', small.size, 'white'); mask.putalpha(small.getchannel('A'))
    (OUT / 'mask.json').write_text(json.dumps({f'layer-{ID}-subject.png': data_uri(mask)}), encoding='utf-8')
    meta = dict(source=str(SRC), size=size, window=box, pool_rect=pool_rect, face_center_source=face,
                face_center_card=[(face[0] - box[0]) / win_w, (face[1] - box[1]) / (box[3] - box[1])],
                subject_bbox=subject.getbbox(), ripples_bbox=ripples.getbbox(),
                subject_bottom_ratio=subject.getbbox()[3] / H, plate_top=PLATE_TOP,
                extended_rows_top=max(0, pool_rect[1] - box[1]))
    (OUT / 'preparation.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
