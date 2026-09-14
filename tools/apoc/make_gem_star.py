# -*- coding: utf-8 -*-
"""畫「超越星」＝真正的刻面寶石星。

使用者第十二輪：「A 但我希望超越的星星可以更好看，有寶石的材質」。
舊的 clicker-star-gem.png 是藍色平塗＋粉紅描邊，沒有任何材質，放大就看得出來廉價。

做法：**沿用金星 clicker-star.png 的輪廓**（卡冊的 A 版是同一格金星換成寶石星，
形狀不一樣會在同一排跳動），在裡面畫寶石：
  10 片從中心放射的刻面（一亮一暗交錯）→ 由下往上的漸層 → 高光點 → 邊緣的亮邊與內陰影。
輸出 4 倍解析度，卡冊縮到 13px 也還是銳利。

用法：python tools/apoc/make_gem_star.py [--preview]
"""
import math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src' / 'clicker-star.png'
OUT = ROOT / 'src' / 'clicker-star-gem.png'
S = 4          # 超取樣倍率（畫完再縮，刻面邊緣才不會鋸齒）

# 三種水晶配色：(主色, 亮面, 深面, 邊緣折射光)
# 使用者第十二輪：「寶石有點醜，我要半透明、有水晶感的」——所以這一版是**透光**的：
# 本體只有 ~55% 不透明，卡冊的紙底會透出來；體積感靠刻面的「透明度差」與邊緣折射光做，不是靠塗滿顏色。
GEMS = {
    'amethyst': ((0x9A, 0x63, 0xE8), (0xE6, 0xD2, 0xFF), (0x4E, 0x21, 0x8E), (0xFF, 0xF2, 0xFF)),
    'aqua':     ((0x49, 0xC6, 0xE8), (0xD8, 0xFB, 0xFF), (0x11, 0x5C, 0x8C), (0xF0, 0xFF, 0xFF)),
    'ruby':     ((0xE8, 0x5A, 0x8C), (0xFF, 0xD6, 0xE4), (0x8E, 0x12, 0x45), (0xFF, 0xF0, 0xF4)),
}

# 每一片刻面的不透明度（10 片，從正上方順時針）。水晶的關鍵是**同一顆裡透明度不一樣**：
# 有的面幾乎看得穿，有的面因為背後多一層折射而比較實。
FACET_A = [168, 104, 214, 124, 180, 98, 208, 112, 190, 108]

def facets(size, main, light, deep, ring):
    """10 片放射刻面，逐片給不同的顏色與不透明度（這一版是透光的）。"""
    w = h = size
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx, cy, R = w / 2, h * .52, w
    for k in range(10):
        a0 = math.radians(-90 + k * 36 - 18); a1 = a0 + math.radians(36)
        # 光從左上：朝光的面偏亮面色、背光的面偏深色，但兩者都保持半透明
        lit = math.cos(a0 + math.radians(18) - math.radians(-135))
        t = (lit + 1) / 2
        col = tuple(int(deep[c] + (light[c] - deep[c]) * t) for c in range(3))
        col = tuple(int(col[c] * .40 + main[c] * .60) for c in range(3))
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                   (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=col + (FACET_A[k],))
    return img

def build(name):
    main, light, deep, ring = GEMS[name]
    base = Image.open(SRC).convert('RGBA')
    w, h = base.size
    big = (w * S, h * S)
    alpha = base.split()[3].resize(big, Image.LANCZOS)
    solid = alpha.point(lambda v: 255 if v > 128 else 0)

    gem = facets(big[0], main, light, deep, ring).resize(big, Image.LANCZOS)

    # 底部聚光（caustic）：光穿過水晶在下緣聚起來，是「這東西透光」最有效的暗示
    glow = Image.new('RGBA', big, (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for y in range(big[1]):
        t = y / (big[1] - 1)
        if t > .55:
            gd.line([(0, y), (big[0], y)], fill=light + (int(105 * ((t - .55) / .45) ** 2),))
    gem = Image.alpha_composite(gem, glow)

    # 邊緣折射光：往內縮一圈的環，畫成亮邊而不是暗邊——玻璃的邊是亮的，石頭的邊才是暗的
    inner = solid.filter(ImageFilter.MinFilter(9 if S >= 4 else 5)).filter(ImageFilter.GaussianBlur(3 * S / 4))
    edge_ring = ImageChops.subtract(solid, inner)
    lit_ring = Image.new('RGBA', big, ring + (205,))
    gem.paste(lit_ring, (0, 0), edge_ring)

    # 高光：左上一片刻面整片打亮，加一道細反光
    hl = Image.new('RGBA', big, (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
    hd.polygon([(big[0] * .29, big[1] * .33), (big[0] * .45, big[1] * .20),
                (big[0] * .49, big[1] * .30), (big[0] * .34, big[1] * .43)], fill=(255, 255, 255, 225))
    hd.polygon([(big[0] * .56, big[1] * .22), (big[0] * .63, big[1] * .27),
                (big[0] * .52, big[1] * .42), (big[0] * .48, big[1] * .37)], fill=(255, 255, 255, 105))
    hl = hl.filter(ImageFilter.GaussianBlur(1.2 * S / 4))
    gem = Image.alpha_composite(gem, hl)

    # 外輪廓：**不描實心黑邊**（那會立刻變回貼紙）。用主色的半透明細邊，在淺底上仍看得出形狀。
    out = Image.new('RGBA', big, (0, 0, 0, 0))
    grow = solid.filter(ImageFilter.MaxFilter(5 if S >= 4 else 3))
    out.paste(Image.new('RGBA', big, tuple(int(c * .75) for c in deep) + (225,)), (0, 0), grow)
    out.paste(gem, (0, 0), solid)
    return out.resize((w, h), Image.LANCZOS)

def main():
    if '--preview' in sys.argv:
        pad, cell = 12, 96
        cols = len(GEMS) + 1
        # 上排深底、下排卡冊的紙底：半透明的東西只看一種底會判斷錯
        sheet = Image.new('RGBA', ((cell + pad) * cols, (cell + pad) * 2 + pad), (44, 34, 28, 255))
        ImageDraw.Draw(sheet).rectangle([0, cell + pad + pad // 2, sheet.width, sheet.height], fill=(0xF3, 0xE2, 0xC0, 255))
        gold = Image.open(SRC).convert('RGBA').resize((cell, cell), Image.LANCZOS)
        for row in (0, 1):
            y = pad + row * (cell + pad + pad // 2)
            sheet.paste(gold, (pad // 2, y), gold)
            for i, name in enumerate(GEMS, start=1):
                g = build(name).resize((cell, cell), Image.LANCZOS)
                sheet.paste(g, (pad // 2 + i * (cell + pad), y), g)
        # 實際尺寸（卡冊是 13px）：放大看漂亮沒有用，要在這個尺寸還讀得出來
        strip = Image.new('RGBA', (sheet.width, 26), (0xF3, 0xE2, 0xC0, 255))
        x = 6
        for name in GEMS:
            g13 = build(name).resize((13, 13), Image.LANCZOS)
            for k in range(5):
                strip.paste(g13, (x, 6), g13); x += 14
            x += 12
        sheet = Image.new('RGBA', (sheet.width, sheet.height + 26), (0xF3, 0xE2, 0xC0, 255)) if False else sheet
        full = Image.new('RGBA', (sheet.width, sheet.height + 26)); full.paste(sheet, (0, 0)); full.paste(strip, (0, sheet.height)); sheet = full
        p = Path(sys.argv[sys.argv.index('--preview') + 1]) if len(sys.argv) > sys.argv.index('--preview') + 1 else ROOT / 'gem-preview.png'
        sheet.save(p); print('預覽 →', p, '（左起：金星、' + '、'.join(GEMS) + '）')
        return
    name = sys.argv[1] if len(sys.argv) > 1 else 'amethyst'
    build(name).save(OUT)
    print(f'{name} → {OUT}  {OUT.stat().st_size/1024:.0f} KB')

if __name__ == '__main__':
    main()
