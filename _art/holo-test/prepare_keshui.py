# -*- coding: utf-8 -*-
"""2026-09-16 三張新卡（素材在桌面 5.0／）。

瞌睡時光（keshuishiguang，神話）depth。作者給的拆分：
  b15a…png  沒有鳥的場景            → 背景層
  攔卡打瞌睡.avi（與 2 號逐格相同）  → 鳥的透明逐格動畫 20 格 10fps，連被杯子擋住的尾巴都畫完整
                                      第 0 格＝靜態主體（反光遮罩、小卡用）；20 格＝animated WebP（fx.anim）
  48111…png 杯子單層                → 不用（只拿來算裁窗範圍）。試過當前景層，轉卡時跟背景裡的杯子錯位出重影，
                                      使用者：「杯子不要拆分，直接用背景」。
  656d…png  完整合成                → 1.0 相容整幅圖、對照用
  ⚠ 第一版用「有鳥－沒鳥」相減取鳥，顏色接近處漏掉 → 使用者看到缺口；AVI 本身就是乾淨的主體，不要再相減。
  使用者：「鳥動起來、在最上層」。
  裁窗：高度吃滿 1080、5:7 置中在「20 格鳥＋杯子」包圍盒上，都不被裁。

珍的不是我（zhendebushiwo，傳說）framed：透明底貼圖，只裁到包圍盒。

枝頭咩咩（zhitoumiemie，傳說，名字暫定）flat：場景右上角樹枝上的兩隻玩偶。整幅畫的一部分 → 滿版裁 5:7、不摳圖，
  臉的高度落在卡高約 40%（視窗頂到 0 為止）。

輸出：layer-keshuishiguang-{subject,background}.png、layer-keshuishiguang-anim.webp（＋-thumb）、art/card-*.png、
masks-5.0.json／art/palette.json 各補，預覽 shots/keshui/。
"""
from pathlib import Path
import base64, io, json, subprocess, tempfile
import numpy as np
from PIL import Image

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
    a = np.array(im.convert('RGBA')); rgb = a[:, :, :3][a[:, :, 3] > 0]
    return '#' + ''.join(f'{x:02x}' for x in np.median(rgb, axis=0).astype(int))


def avi_frames():
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(SRC / '攔卡打瞌睡.avi'), '-pix_fmt', 'rgba', str(Path(tmp) / 'f%02d.png')], check=True)
        frames = [Image.open(f).convert('RGBA') for f in sorted(Path(tmp).glob('*.png'))]
    assert len(frames) == 20 and all(f.size == (1920, 1080) for f in frames)
    return frames


def union(*boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def keshui():
    full = Image.open(SRC / '656d1e001da49a1f.png').convert('RGBA')
    plate = Image.open(SRC / 'b15a5eefd66f82a4.png').convert('RGBA')
    cup = Image.open(SRC / '48111f12be1a3ff3.png').convert('RGBA')
    frames = avi_frames()
    ub = union(cup.getbbox(), *[f.getbbox() for f in frames])
    win_h = 1080; win_w = round(win_h * 5 / 7)
    left = min(max(0, round((ub[0] + ub[2]) / 2 - win_w / 2)), 1920 - win_w)
    box = (left, 0, left + win_w, win_h)
    assert box[0] <= ub[0] and ub[2] <= box[2], (box, ub)

    crop = lambda im, size=(W, H): im.crop(box).resize(size, Image.Resampling.LANCZOS)
    birds = [crop(f) for f in frames]
    back = crop(plate)
    assert np.array(back)[:, :, 3].min() == 255
    birds[0].save(HERE / f'layer-{ID}-subject.png'); back.save(HERE / f'layer-{ID}-background.png')
    kw = dict(save_all=True, duration=100, loop=0, quality=90, alpha_quality=100, method=6)
    birds[0].save(HERE / f'layer-{ID}-anim.webp', append_images=birds[1:], **kw)
    thumbs = [crop(f, (200, 280)) for f in frames]
    thumbs[0].save(HERE / f'layer-{ID}-anim-thumb.webp', append_images=thumbs[1:], **kw)
    crop(full).save(HERE / 'art' / f'card-{ID}.png')

    SHOT.mkdir(parents=True, exist_ok=True)
    for i in (0, 10):
        Image.alpha_composite(back, birds[i]).save(SHOT / f'aligned-f{i}.png')
    small = birds[0].copy(); small.thumbnail((300, 420), Image.Resampling.LANCZOS)
    mask = Image.new('RGBA', small.size, 'white'); mask.putalpha(small.getchannel('A'))
    return {f'layer-{ID}-subject.png': data_uri(mask)}, median_color(birds[0]), dict(
        window=box, union_bbox=ub, anim_kb=round((HERE / f'layer-{ID}-anim.webp').stat().st_size / 1024))


def zhen():
    im = Image.open(DESK / '珍的不是我 傳說.png').convert('RGBA')
    out = im.crop(im.getbbox()); out.save(HERE / 'art' / 'card-zhendebushiwo.png')
    return median_color(out)


def dolls():
    plate = Image.open(SRC / 'b15a5eefd66f82a4.png').convert('RGBA')
    doll_box = (1590, 85, 1900, 345)            # 兩隻玩偶（含蝴蝶結、羊角）在 1920×1080 裡的範圍
    face_y = 215
    win_w = 420; win_h = round(win_w * 7 / 5)
    cx = (doll_box[0] + doll_box[2]) / 2
    left = min(max(0, round(cx - win_w / 2)), 1920 - win_w)
    top = min(max(0, round(face_y - 0.402 * win_h)), 1080 - win_h)
    box = (left, top, left + win_w, top + win_h)
    assert box[0] <= doll_box[0] and doll_box[2] <= box[2] and box[1] <= doll_box[1] and doll_box[3] <= box[3], box
    out = plate.crop(box).resize((W, H), Image.Resampling.LANCZOS)
    out.save(HERE / 'art' / 'card-zhitoumiemie.png'); out.save(SHOT / 'dolls-card.png')
    a = np.array(plate.crop(doll_box).convert('RGB')).reshape(-1, 3)
    return '#' + ''.join(f'{x:02x}' for x in np.median(a, axis=0).astype(int)), box


def main():
    masks_new, keshui_color, meta = keshui()
    zhen_color = zhen()
    dolls_color, dolls_box = dolls()
    mp = HERE / 'masks-5.0.json'; masks = json.loads(mp.read_text(encoding='utf-8')); masks.update(masks_new)
    mp.write_text(json.dumps(masks), encoding='utf-8')
    pp = HERE / 'art' / 'palette.json'; pal = json.loads(pp.read_text(encoding='utf-8'))
    for file, color in [(f'card-{ID}.png', keshui_color), ('card-zhendebushiwo.png', zhen_color), ('card-zhitoumiemie.png', dolls_color)]:
        pal[file] = {'base': color, 'glow': color, 'accent': color, 'ink': '#080c17'}
    pp.write_text(json.dumps(pal, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps(dict(meta, dolls_window=dolls_box), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
