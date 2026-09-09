# -*- coding: utf-8 -*-
"""卡包印刷層 700x980 RGBA，滿版（寶可夢補充包做法，但不照抄）：
鮮豔插畫底（imagegen）＋珍珍主視覺放大＋左上小品牌標＋底部厚重貼標。
只有上下封口（4%／3%）留透明給鋁箔。"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math

W, H = 700, 980
SEAL_TOP, SEAL_BOT = int(H * 0.04), int(H * 0.03)
CREAM = (255, 248, 222, 255)
INK = (34, 24, 40, 255)

# ---- 底圖：滿版鮮豔插畫，裁成 700x(980-封口) ----
bg = Image.open('D:/claude/holo-pack/generated_images/pack-backdrop.png').convert('RGB')
target_h = H - SEAL_TOP - SEAL_BOT
scale = max(W / bg.width, target_h / bg.height)
bg = bg.resize((int(bg.width * scale) + 1, int(bg.height * scale) + 1), Image.LANCZOS)
x0 = (bg.width - W) // 2; y0 = (bg.height - target_h) // 2
bg = bg.crop((x0, y0, x0 + W, y0 + target_h))
bg = ImageEnhance.Color(bg).enhance(1.15)          # 再推一點飽和，補償 Blender 光照
bg = ImageEnhance.Contrast(bg).enhance(1.05)

img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
img.paste(bg, (0, SEAL_TOP))
d = ImageDraw.Draw(img)

# 封口交界一條細高光線，讓印刷與鋁箔有「壓合」感
d.line([(0, SEAL_TOP), (W, SEAL_TOP)], fill=(255, 255, 255, 90), width=2)
d.line([(0, H - SEAL_BOT - 1), (W, H - SEAL_BOT - 1)], fill=(255, 255, 255, 90), width=2)

# ---- 主視覺：珍珍，含白色描邊＋柔影 ----
sub = Image.open('D:/claude/clawd-pet-holo/_art/holo-test/cardback/subject-cutout.png').convert('RGBA')
sub = sub.crop(sub.getbbox())
sw = int(W * 0.66); sh = int(sub.height * sw / sub.width)
sub = sub.resize((sw, sh), Image.LANCZOS)
cx, cy = W // 2, int(H * 0.53)
# 白描邊：把 alpha 膨脹後填白
a = sub.getchannel('A')
halo = a.filter(ImageFilter.MaxFilter(15))
halo_img = Image.new('RGBA', sub.size, (255, 255, 255, 0)); halo_img.putalpha(halo)
shadow = Image.new('RGBA', sub.size, (40, 20, 60, 0)); shadow.putalpha(halo.filter(ImageFilter.GaussianBlur(14)))
img.alpha_composite(shadow, (cx - sw // 2 + 6, cy - sh // 2 + 18))
img.alpha_composite(halo_img, (cx - sw // 2, cy - sh // 2))
img.alpha_composite(sub, (cx - sw // 2, cy - sh // 2))
d = ImageDraw.Draw(img)

# ---- 文字 ----
FONT = 'C:/Windows/Fonts/NotoSansTC-VF.ttf'
def font(size, var='Black'):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_name(var)
    except Exception: pass
    return f
def outlined(text, xy, f, fill, outline, w, anchor='mm'):
    x, y = xy
    for dx in range(-w, w + 1):
        for dy in range(-w, w + 1):
            if dx * dx + dy * dy <= w * w:
                d.text((x + dx, y + dy), text, font=f, fill=outline, anchor=anchor)
    d.text((x, y), text, font=f, fill=fill, anchor=anchor)

# 左上品牌標：白色圓角膠囊＋深色字（小，不搶主視覺）
f_brand = font(30)
tw = d.textlength('珍母點點', font=f_brand)
px, py = 28, SEAL_TOP + 24
d.rounded_rectangle((px, py, px + tw + 40, py + 50), radius=25, fill=(255, 255, 255, 235), outline=INK, width=3)
d.text((px + 20 + tw / 2, py + 25), '珍母點點', font=f_brand, fill=INK, anchor='mm')

# 底部厚重貼標：斜切色塊＋大字＋描邊（像實體包裝的系列名貼標）
f_title = font(74)
ty = H - SEAL_BOT - 120
band = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bd = ImageDraw.Draw(band)
bd.polygon([(70, ty - 58), (W - 70, ty - 66), (W - 60, ty + 60), (60, ty + 68)], fill=(48, 28, 92, 230))
band = band.filter(ImageFilter.GaussianBlur(0.6))
img.alpha_composite(band); d = ImageDraw.Draw(img)
outlined('精裝典藏包', (W // 2, ty), f_title, (255, 236, 120, 255), INK, 6)
f_sub = font(22, 'Bold')
outlined('DELUXE COLLECTOR PACK', (W // 2, ty + 62), f_sub, CREAM, INK, 3)

img.save('D:/claude/holo-pack/out/pack-print.png')
print('ok', img.size, 'seal', SEAL_TOP, SEAL_BOT)
