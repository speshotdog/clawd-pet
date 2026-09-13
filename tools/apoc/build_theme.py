# -*- coding: utf-8 -*-
"""末世的「舊化 1.0」材質：把 1.0 的牛皮紙、紙卡、標籤、按鈕貼圖做舊。

使用者 2026-09-13：「幫我再思考新的 UI 配色……說不定可以變成舊化材質的 1.0 感覺」。
版面與 9-slice 切法完全沿用 1.0（同尺寸、同 alpha），只改像素的顏色與髒污，
所以 CSS 只要把 url 換掉就能套上，不會有新的裁切風險。

使用者 09-13 在「舊化／焦黑」兩張樣張裡選了舊化：泛黃、褪色、咖啡漬、邊緣焦——紙還是淺的，字用深棕。

輸出：src/apoc/theme/<variant>/<原檔名去掉 clicker-ui->.webp
用法：python tools/apoc/build_theme.py
"""
from pathlib import Path
import random
from PIL import Image, ImageChops, ImageFilter, ImageOps

V3 = Path(__file__).resolve().parents[2]
SRC = V3 / 'src'
OUT = V3 / 'src/apoc/theme'
NAMES = ['kraft', 'paper', 'label', 'label-green', 'label-purple', 'btn-cream', 'btn-green', 'btn-pink',
         'btn-purple', 'btn-disabled', 'coinplate', 'title-tape', 'tape-0', 'tape-1', 'tape-2', 'tape-3',
         'frame', 'mat', 'ticket', 'sticker-badge', 'page-corner', 'album']
VARIANTS = {
    #          灰階比例  亮度   暖色偏移(r,g,b)     髒污  咖啡漬  焦邊
    'aged':    dict(desat=.45, bright=.86, tint=(1.00, .93, .80), grime=.22, stains=7, burn=.55),
}


def noise(size, seed, scale):
    rnd = random.Random(seed)
    w, h = max(1, size[0] // scale), max(1, size[1] // scale)
    small = Image.new('L', (w, h)); small.putdata([rnd.randint(0, 255) for _ in range(w * h)])
    return small.resize(size, Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))


def stains(size, seed, count):
    rnd = random.Random(seed); layer = Image.new('L', size, 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        r = rnd.uniform(.05, .18) * min(size); x, y = rnd.uniform(0, size[0]), rnd.uniform(0, size[1])
        d.ellipse([x - r, y - r, x + r, y + r], fill=rnd.randint(40, 110))
        d.ellipse([x - r * .9, y - r * .9, x + r * .9, y + r * .9], fill=rnd.randint(10, 50))   # 咖啡漬是外圈深、裡面淺
    return layer.filter(ImageFilter.GaussianBlur(min(size) * .02))


def age(im, seed, desat, bright, tint, grime, stains, burn):
    im = im.convert('RGBA'); r, g, b, a = im.split()
    rgb = Image.merge('RGB', (r, g, b))
    gray = ImageOps.grayscale(rgb).convert('RGB')
    rgb = Image.blend(rgb, gray, desat)
    rgb = Image.merge('RGB', [ch.point(lambda v, k=k: min(255, int(v * bright * k))) for ch, k in zip(rgb.split(), tint)])
    # 髒污：大尺度的明暗不均＋細顆粒
    dirt = ImageChops.multiply(noise(im.size, seed, 48), noise(im.size, seed + 1, 6))
    dark = Image.new('RGB', im.size, (40, 28, 18))
    rgb = Image.composite(dark, rgb, dirt.point(lambda v: int(v * grime)))
    # 咖啡漬
    rgb = Image.composite(Image.new('RGB', im.size, (92, 60, 30)), rgb, globals()['stains'](im.size, seed + 2, stains))
    # 焦邊：離 alpha 邊緣越近越深
    edge = a.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(min(im.size) * .035))
    edge = ImageOps.invert(edge).point(lambda v: int(v * burn))
    edge = ImageChops.multiply(edge, a)
    rgb = Image.composite(Image.new('RGB', im.size, (30, 18, 10)), rgb, edge)
    out = rgb.convert('RGBA'); out.putalpha(a)
    return out


def main():
    for variant, params in VARIANTS.items():
        dest = OUT / variant; dest.mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(NAMES):
            src = SRC / f'clicker-ui-{name}.png'
            if not src.exists(): continue
            age(Image.open(src), 1000 + i, **params).save(dest / f'{name}.webp', 'WEBP', quality=90, method=4)
    total = sum(p.stat().st_size for p in OUT.rglob('*.webp'))
    print(f'舊化材質 {len(list(OUT.rglob("*.webp")))} 張，{total / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
