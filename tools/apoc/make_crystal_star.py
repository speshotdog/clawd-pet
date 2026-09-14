# -*- coding: utf-8 -*-
"""畫「超越星」＝薑餅人王國那種**彩虹水晶星**：稜鏡刻面、彩虹折射、白色高光、外圈光暈。

使用者 2026-09-14 晚：「星星還是不夠好看，我想要像是薑餅人王國那種感覺：水晶、彩虹、光暈」。
上一版 make_gem_star.py 是單色半透明紫水晶，沒有彩虹也沒有光暈。

做法（沿用金星 clicker-star.png 的輪廓，同一排星才不會跳動）：
  1. 10 片放射刻面，每片顏色沿色相環走（粉→紫→藍→青→綠→黃→橘→粉），面向光的偏白、背光的偏深
  2. 中心一顆小的白色核心（水晶最厚的地方最亮）
  3. 邊緣亮邊（玻璃邊是亮的）＋左上一片實心白高光＋一道細反光
  4. **光暈**：畫布四周留 22% 的邊，把星的輪廓模糊成粉紫色的暈；卡冊的 CSS 再疊一層 drop-shadow 補動態感
輸出 4 倍超取樣後縮回，畫布比金星大（有光暈的邊），卡冊用 height 對齊時星本體會比金星小一點——
所以 CSS 把寶石星的高度放大同樣比例（.star-row img.gem）。

用法：python tools/apoc/make_crystal_star.py [--preview]
"""
import colorsys, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src' / 'clicker-star.png'
OUT = ROOT / 'src' / 'clicker-star-gem.png'
S = 4            # 超取樣
PAD = .22        # 光暈留邊（相對星寬）

def hue_col(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1, s, v)
    return (int(r * 255), int(g * 255), int(b * 255))

def facets(w, h):
    """10 片放射刻面，顏色沿色相環走，面光的偏白。"""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    cx, cy, R = w / 2, h * .52, w
    for k in range(10):
        a0 = math.radians(-90 + k * 36 - 18); a1 = a0 + math.radians(36)
        mid = a0 + math.radians(18)
        lit = (math.cos(mid - math.radians(-135)) + 1) / 2      # 光從左上
        hue = (.90 + k / 10 * .80) % 1                            # 粉→紫→藍→青→綠→黃，不繞到土色的橘褐
        sat = .62 - .30 * lit
        val = .90 + .10 * lit
        col = hue_col(hue, sat, val)
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                   (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=col + (255,))
    # 刻面之間的稜線：淡淡的白線，是「有切面」的暗示
    for k in range(10):
        a = math.radians(-90 + k * 36 - 18)
        d.line([(cx, cy), (cx + R * math.cos(a), cy + R * math.sin(a))], fill=(255, 255, 255, 90), width=max(1, w // 120))
    return img

def build():
    base = Image.open(SRC).convert('RGBA')
    w0, h0 = base.size
    pad = int(w0 * PAD)
    W, H = (w0 + pad * 2) * S, (h0 + pad * 2) * S
    alpha = Image.new('L', (W, H), 0)
    alpha.paste(base.split()[3].resize((w0 * S, h0 * S), Image.LANCZOS), (pad * S, pad * S))
    solid = alpha.point(lambda v: 255 if v > 128 else 0)
    bbox = (pad * S, pad * S, pad * S + w0 * S, pad * S + h0 * S)

    # 1. 刻面本體
    gem = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gem.paste(facets(w0 * S, h0 * S), (pad * S, pad * S))

    # 2. 中心白核（徑向漸層）
    core = Image.new('L', (W, H), 0); cd = ImageDraw.Draw(core)
    cx, cy = W / 2, bbox[1] + h0 * S * .52
    for r in range(int(w0 * S * .30), 0, -2):
        a = int(210 * (1 - r / (w0 * S * .30)) ** 1.6)
        cd.ellipse([cx - r, cy - r * .9, cx + r, cy + r * .9], fill=a)
    gem.paste(Image.new('RGBA', (W, H), (255, 255, 255, 255)), (0, 0), core)

    # 3. 邊緣亮邊
    inner = solid.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(3))
    ring = ImageChops.subtract(solid, inner)
    gem.paste(Image.new('RGBA', (W, H), (255, 250, 255, 230)), (0, 0), ring)

    # 高光：左上一片＋細反光
    hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
    x0, y0, bw, bh = bbox[0], bbox[1], w0 * S, h0 * S
    hd.polygon([(x0 + bw * .30, y0 + bh * .34), (x0 + bw * .45, y0 + bh * .21),
                (x0 + bw * .49, y0 + bh * .31), (x0 + bw * .35, y0 + bh * .44)], fill=(255, 255, 255, 235))
    hd.polygon([(x0 + bw * .57, y0 + bh * .23), (x0 + bw * .64, y0 + bh * .28),
                (x0 + bw * .60, y0 + bh * .33), (x0 + bw * .54, y0 + bh * .28)], fill=(255, 255, 255, 200))
    hl = hl.filter(ImageFilter.GaussianBlur(1.2))
    gem = Image.alpha_composite(gem, hl)

    # 星形裁切（保留一點軟邊）
    gem.putalpha(ImageChops.multiply(gem.split()[3], alpha))

    # 描邊：沿用金星的黑描邊（它就是這條線讓星星有卡通感），改成深紫才跟水晶合
    src_px = base.load(); outline = Image.new('L', (w0, h0), 0); op = outline.load()
    for y in range(h0):
        for x in range(w0):
            r, g, b, a = src_px[x, y]
            if a > 128 and r + g + b < 240: op[x, y] = 255
    outline = outline.resize((w0 * S, h0 * S), Image.LANCZOS)
    ol = Image.new('L', (W, H), 0); ol.paste(outline, (pad * S, pad * S))
    gem.paste(Image.new('RGBA', (W, H), (70, 30, 95, 255)), (0, 0), ol)

    # 閃光：右上一顆四芒星＋左下一顆小的（薑餅人的水晶星都有）
    sp = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sp)
    def sparkle(cx, cy, r):
        pts = []
        for k in range(8):
            ang = math.radians(k * 45); rr = r if k % 2 == 0 else r * .28
            pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
        sd.polygon(pts, fill=(255, 255, 255, 245))
    sparkle(x0 + bw * .78, y0 + bh * .14, bw * .13); sparkle(x0 + bw * .16, y0 + bh * .78, bw * .07)
    gem = Image.alpha_composite(gem, sp.filter(ImageFilter.GaussianBlur(0.8)))

    # 4. 光暈：輪廓模糊成粉紫暈，放在星的底下
    glow_a = solid.filter(ImageFilter.GaussianBlur(pad * S * .55)).point(lambda v: min(255, int(v * 1.35)))
    glow = Image.new('RGBA', (W, H), (255, 170, 240, 0)); glow.putalpha(glow_a.point(lambda v: int(v * .80)))
    glow2_a = solid.filter(ImageFilter.GaussianBlur(pad * S * .22))
    glow2 = Image.new('RGBA', (W, H), (255, 245, 255, 0)); glow2.putalpha(glow2_a.point(lambda v: int(v * .55)))
    out = Image.alpha_composite(Image.alpha_composite(glow, glow2), gem)
    return out.resize((W // S, H // S), Image.LANCZOS)

if __name__ == '__main__':
    img = build()
    img.save(OUT, optimize=True)
    print(f'{OUT.name} {img.size}')
    if '--preview' in sys.argv:
        p = ROOT / '_art' / 'out' / 'crystal-star-preview.png'; p.parent.mkdir(parents=True, exist_ok=True)
        gold = Image.open(SRC).convert('RGBA')
        sheet = Image.new('RGBA', (1400, 360), (0xF3, 0xE6, 0xCA, 255))
        for i, h in enumerate((13, 26, 52, 104)):
            x = 40 + i * 320
            g = gold.resize((int(gold.width * h / gold.height), h), Image.LANCZOS)
            c = img.resize((int(img.width * h * (1 + 2 * PAD) / img.height), int(h * (1 + 2 * PAD))), Image.LANCZOS)
            for k in range(5):
                sheet.alpha_composite(g if k >= 3 else c, (x + k * (h + 6) - (int(h * PAD) if k < 3 else 0), 120 - (int(h * PAD) if k < 3 else 0)))
        sheet.save(p); print(p)
