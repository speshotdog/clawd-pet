# -*- coding: utf-8 -*-
"""卡包印刷層 700x980 RGBA：navy 底＋奶油線框＋珍珍主視覺＋標題；封口與外緣留透明讓鋁箔透出。
風格對齊 cardback/deluxe-back.png（深藍底、奶油描邊、黑輪廓）。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

W, H = 700, 980
SEAL = 90          # 上下封口高度（對應 Blender 的 0.9/9.8）
MARGIN = 26        # 左右留鋁箔
NAVY = (28, 42, 76, 255)
NAVY2 = (18, 28, 56, 255)
CREAM = (246, 236, 201, 255)
INK = (20, 18, 24, 255)
random.seed(3)

img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 印刷區域（圓角矩形），其餘透明＝鋁箔
box = (MARGIN, SEAL, W - MARGIN, H - SEAL)
d.rounded_rectangle(box, radius=26, fill=NAVY)
# 上下漸暗
grad = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(grad)
for y in range(box[1], box[3]):
    t = (y - box[1]) / (box[3] - box[1])
    a = int(70 * (abs(t - 0.5) * 2) ** 2)
    gd.line([(box[0], y), (box[2], y)], fill=(8, 12, 30, a))
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle(box, radius=26, fill=255)
img = Image.composite(Image.alpha_composite(img, grad), img, mask)
d = ImageDraw.Draw(img)

# 星軌弧線＋小星：畫在獨立圖層再用印刷區遮罩裁掉（不能溢到鋁箔區）
deco = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(deco)
cx, cy = W * 0.78, SEAL + 40
for r in range(160, 900, 58):
    a = 34 + random.randint(0, 26)
    dd.arc((cx - r, cy - r, cx + r, cy + r), start=95, end=200, fill=(246, 236, 201, a), width=2)
for _ in range(80):
    x = random.randint(box[0] + 20, box[2] - 20); y = random.randint(box[1] + 20, box[3] - 20)
    s_ = random.choice([1, 1, 2, 2, 3])
    dd.ellipse((x - s_, y - s_, x + s_, y + s_), fill=(255, 250, 230, random.randint(110, 220)))
deco.putalpha(Image.composite(deco.getchannel('A'), Image.new('L', (W, H), 0), mask))
img = Image.alpha_composite(img, deco)
d = ImageDraw.Draw(img)

# 奶油雙線框（黑描邊）
inner = (box[0] + 24, box[1] + 24, box[2] - 24, box[3] - 24)
d.rounded_rectangle(inner, radius=22, outline=INK, width=9)
d.rounded_rectangle(inner, radius=22, outline=CREAM, width=5)
inner2 = (inner[0] + 12, inner[1] + 12, inner[2] - 12, inner[3] - 12)
d.rounded_rectangle(inner2, radius=16, outline=INK, width=5)
d.rounded_rectangle(inner2, radius=16, outline=CREAM, width=2)

# 中央圓形視窗＋主視覺
R = 215
ccx, ccy = W // 2, H // 2 + 20
d.ellipse((ccx - R - 6, ccy - R - 6, ccx + R + 6, ccy + R + 6), fill=INK)
d.ellipse((ccx - R, ccy - R, ccx + R, ccy + R), fill=CREAM)
d.ellipse((ccx - R + 14, ccy - R + 14, ccx + R - 14, ccy + R - 14), outline=INK, width=4)
sub = Image.open('D:/claude/clawd-pet-holo/_art/holo-test/cardback/subject-cutout.png').convert('RGBA')
sub = sub.crop(sub.getbbox())
sh = int(R * 1.5); sw = int(sub.width * sh / sub.height)
sub = sub.resize((sw, sh), Image.LANCZOS)
img.alpha_composite(sub, (ccx - sw // 2, ccy - sh // 2 + 10))
d = ImageDraw.Draw(img)

# 標題
def outlined(text, xy, font, fill, outline, w):
    x, y = xy
    for dx in range(-w, w + 1):
        for dy in range(-w, w + 1):
            if dx * dx + dy * dy <= w * w:
                d.text((x + dx, y + dy), text, font=font, fill=outline, anchor='mm')
    d.text((x, y), text, font=font, fill=fill, anchor='mm')

FONT = 'C:/Windows/Fonts/NotoSansTC-VF.ttf'
f_big = ImageFont.truetype(FONT, 88); f_big.set_variation_by_name('Black') if 'Black' in [n.decode() if isinstance(n, bytes) else n for n in f_big.get_variation_names()] else None
f_mid = ImageFont.truetype(FONT, 40)
try: f_mid.set_variation_by_name('Bold')
except Exception: pass
f_small = ImageFont.truetype('C:/Windows/Fonts/NotoSansTC-VF.ttf', 22)

outlined('珍母點點', (W // 2, SEAL + 118), f_big, CREAM, INK, 6)
outlined('精裝典藏包', (W // 2, H - SEAL - 120), f_mid, CREAM, INK, 4)
d.text((W // 2, H - SEAL - 76), 'DELUXE  COLLECTOR  PACK', font=f_small, fill=(246, 236, 201, 200), anchor='mm')

# 四角小圖示：星／愛心（簡單向量）
def star(c, r, fill):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((c[0] + rr * math.cos(ang), c[1] + rr * math.sin(ang)))
    d.polygon(pts, fill=INK);
    pts2 = [((p[0] - c[0]) * 0.78 + c[0], (p[1] - c[1]) * 0.78 + c[1]) for p in pts]
    d.polygon(pts2, fill=fill)
star((inner2[0] + 46, inner2[1] + 46), 22, (251, 233, 128, 255))
star((inner2[2] - 46, inner2[3] - 46), 22, (251, 233, 128, 255))
d.ellipse((inner2[2] - 66, inner2[1] + 26, inner2[2] - 26, inner2[1] + 66), fill=INK)
d.ellipse((inner2[2] - 62, inner2[1] + 30, inner2[2] - 30, inner2[1] + 62), fill=(252, 200, 212, 255))
d.ellipse((inner2[0] + 26, inner2[3] - 66, inner2[0] + 66, inner2[3] - 26), fill=INK)
d.ellipse((inner2[0] + 30, inner2[3] - 62, inner2[0] + 62, inner2[3] - 30), fill=(176, 220, 250, 255))

img.save('D:/claude/holo-pack/out/pack-print.png')
print('ok', img.size)
