# -*- coding: utf-8 -*-
"""2026-09-16 兩張新卡。

瞌睡時光（keshuishiguang，神話）depth：作者給了同一個場景的兩張 1920×1080（有鳥／沒有鳥）＋杯子單層＋打瞌睡 GIF。
  背景層＝沒有鳥的場景；主體層＝兩張相減得到的鳥（像素差，不摳圖、RGB 不改）；
  杯子在鳥前面：前景層（fx.front）＝沒有鳥那張的杯子像素，用作者的杯子單層當範圍；鳥本體點頭（fx.nod，card_fx.js）。
  裁窗：高度吃滿 1080、5:7 置中在「鳥＋杯子」上，兩者都不被裁（跟泡水大亨堡定案的「整幅構圖」同一路）。
珍的不是我（zhendebushiwo，傳說）framed：單一角色透明底貼圖，只裁到包圍盒，不縮不補。

輸出：layer-keshuishiguang-{subject,background,front}.png、art/card-*.png、masks-5.0.json 與 art/palette.json 各補一筆，
預覽 shots/keshui/aligned.png。
"""
from pathlib import Path
import base64, io, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = Path(__file__).resolve().parent
DESK = Path.home() / 'OneDrive/Desktop/5.0'
SRC = DESK / '瞌睡時光 藍卡'
SHOT = HERE / 'shots' / 'keshui'
ID = 'keshuishiguang'
W, H = 600, 840


def data_uri(im):
    buf = io.BytesIO(); im.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


def median_color(im):
    a = np.array(im); rgb = a[:, :, :3][a[:, :, 3] > 0]
    return '#' + ''.join(f'{x:02x}' for x in np.median(rgb, axis=0).astype(int))


def keshui():
    full = Image.open(SRC / '656d1e001da49a1f.png').convert('RGBA')
    plate = Image.open(SRC / 'b15a5eefd66f82a4.png').convert('RGBA')
    cup = Image.open(SRC / '48111f12be1a3ff3.png').convert('RGBA')
    assert full.size == plate.size == cup.size == (1920, 1080)
    f, p = np.array(full).astype(int), np.array(plate).astype(int)
    cup_a = np.array(cup)[:, :, 3]
    diff = np.abs(f[:, :, :3] - p[:, :, :3]).max(2) > 24
    lab, n = nd.label(diff)
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    bird = lab == sizes.argmax()                                 # 最大的差異塊＝鳥（其他是壓縮雜點）
    bird = nd.binary_fill_holes(bird)
    bird = nd.binary_dilation(bird, iterations=1) & (cup_a == 0)  # 杯子蓋住的地方留給前景層
    small_blobs = int((sizes > 0).sum()) - 1
    subject = np.array(full); subject[:, :, 3] = np.where(bird, 255, 0)
    front = np.array(plate); front[:, :, 3] = cup_a
    subject, front = Image.fromarray(subject), Image.fromarray(front)

    sb, cb = subject.getbbox(), front.getbbox()
    ub = (min(sb[0], cb[0]), min(sb[1], cb[1]), max(sb[2], cb[2]), max(sb[3], cb[3]))
    win_h = 1080; win_w = round(win_h * 5 / 7)
    left = min(max(0, round((ub[0] + ub[2]) / 2 - win_w / 2)), 1920 - win_w)
    box = (left, 0, left + win_w, win_h)
    assert box[0] <= ub[0] and ub[2] <= box[2], (box, ub)       # 鳥與杯子都不被裁

    crop = lambda im: im.crop(box).resize((W, H), Image.Resampling.LANCZOS)
    s, fr, back = crop(subject), crop(front), crop(plate)
    assert np.array(back)[:, :, 3].min() == 255
    s.save(HERE / f'layer-{ID}-subject.png'); fr.save(HERE / f'layer-{ID}-front.png'); back.save(HERE / f'layer-{ID}-background.png')
    SHOT.mkdir(parents=True, exist_ok=True)
    Image.alpha_composite(Image.alpha_composite(back, s), fr).save(SHOT / 'aligned.png')
    crop(full).save(HERE / 'art' / f'card-{ID}.png')           # 1.0 相容的整幅圖
    check = Image.new('RGBA', (W, H), (255, 0, 255, 255)); Image.alpha_composite(check, s).save(SHOT / 'subject-on-magenta.png')
    small = s.copy(); small.thumbnail((300, 420), Image.Resampling.LANCZOS)
    mask = Image.new('RGBA', small.size, 'white'); mask.putalpha(small.getchannel('A'))
    bb = s.getbbox()
    return {f'layer-{ID}-subject.png': data_uri(mask)}, median_color(s), dict(
        window=box, union_bbox=ub, bird_px=int(bird.sum()), diff_blobs=small_blobs, subject_bbox_card=bb,
        nod_origin=f'{(bb[0] + bb[2]) / 2 / W * 100:.0f}% {bb[3] / H * 100:.0f}%')


def zhen():
    im = Image.open(DESK / '珍的不是我 傳說.png').convert('RGBA')
    out = im.crop(im.getbbox())
    out.save(HERE / 'art' / 'card-zhendebushiwo.png')
    return median_color(out), out.size


def main():
    masks_new, keshui_color, meta = keshui()
    zhen_color, zhen_size = zhen()
    mp = HERE / 'masks-5.0.json'; masks = json.loads(mp.read_text(encoding='utf-8')); masks.update(masks_new)
    mp.write_text(json.dumps(masks), encoding='utf-8')
    pp = HERE / 'art' / 'palette.json'; pal = json.loads(pp.read_text(encoding='utf-8'))
    for file, color in [(f'card-{ID}.png', keshui_color), ('card-zhendebushiwo.png', zhen_color)]:
        pal[file] = {'base': color, 'glow': color, 'accent': color, 'ink': '#080c17'}
    pp.write_text(json.dumps(pal, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(dict(meta, zhen_size=zhen_size), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
