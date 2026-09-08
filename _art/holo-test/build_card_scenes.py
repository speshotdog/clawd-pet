# -*- coding: utf-8 -*-
"""每張卡算一組配色，用來畫滿版背景。

場景卡（宇宙冒險羊那四張）好看的原因是有真的畫出來的滿版背景；卡池那 43 張只有
深色底＋稀有度光暈，所以看起來像半成品。這支腳本從每張去背卡圖的實際像素取出
主色，寫成 art/palette.json，讓卡面可以用「跟這隻角色同調」的背景，而不是所有卡
共用同一層平塗漸層。

輸出每張：
  base   底色（角色主色壓暗）
  glow   角色背後的光暈色
  accent 點綴色（星點、地平線）
  ink    角色的暗部，用來壓邊
"""
from pathlib import Path
import colorsys, json
from PIL import Image

OUT = Path(__file__).parent
ART = OUT / 'art'


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def hex_of(r, g, b):
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


def palette(path: Path):
    im = Image.open(path).convert('RGBA')
    im.thumbnail((96, 96), Image.Resampling.LANCZOS)
    px = [p for p in im.getdata() if p[3] > 160]
    if not px:
        return None
    # 以飽和度加權取平均色相，避免被大面積的白／黑主導
    hs, ss, vs, wsum = 0.0, 0.0, 0.0, 0.0
    import math
    sin_h = cos_h = 0.0
    for r, g, b, _a in px:
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        w = s * v + 0.05
        sin_h += math.sin(h * 2 * math.pi) * w
        cos_h += math.cos(h * 2 * math.pi) * w
        ss += s * w
        vs += v * w
        wsum += w
    hue = (math.atan2(sin_h, cos_h) / (2 * math.pi)) % 1.0
    sat = ss / wsum
    val = vs / wsum

    # 背景要比角色暗、比角色低飽和，才不會跟角色打架
    base = colorsys.hsv_to_rgb((hue + 0.52) % 1.0, clamp(sat * .55, .18, .5), clamp(val * .18, .05, .13))
    glow = colorsys.hsv_to_rgb(hue, clamp(sat * .8, .3, .8), clamp(val * .48, .18, .42))
    accent = colorsys.hsv_to_rgb((hue + 0.08) % 1.0, clamp(sat * .9, .35, .9), clamp(val * .95, .55, .95))
    ink = colorsys.hsv_to_rgb((hue + 0.5) % 1.0, clamp(sat * .5, .15, .45), clamp(val * .09, .03, .08))
    return {
        'base': hex_of(*base), 'glow': hex_of(*glow),
        'accent': hex_of(*accent), 'ink': hex_of(*ink),
        'hue': round(hue, 4), 'sat': round(sat, 3), 'val': round(val, 3),
    }


out = {}
for f in sorted(ART.glob('*.png')):
    p = palette(f)
    if p:
        out[f.name] = p
(ART / 'palette.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
print('wrote palette for', len(out), 'cards')
for k in list(out)[:4]:
    print(' ', k, out[k]['base'], out[k]['glow'], out[k]['accent'])
