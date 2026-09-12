# -*- coding: utf-8 -*-
"""5.0 八張系列卡改走 flat（滿版平鋪、不摳圖）——使用者 2026-09-13：「摳不出來就不要摳、人物要置中」。
每張卡＝原畫以角色為中心裁一個 5:7 視窗（角色約佔卡高六成、中心落在卡高 44%，下方留名字框），縮成 600×840。
小丑玥玥維持 framed（單一角色，Astra 已去掉外圍白底）。只有裁切與 LANCZOS 縮放，不改任何 RGB、不補畫。"""
from pathlib import Path
from PIL import Image
HERE = Path(__file__).parent
SRC = HERE / 'source-5.0'
TEA = SRC / '悠閒時光系列 拆三張卡.jpg'
STAR = SRC / 'star-frame-120.png'        # ffmpeg 抽第 120 幀（2.000 秒），同 Astra 選的那一格
OMEGA = SRC / '奧米加咆嘯獸 神話.png'
# id → (來源, 角色本體包圍盒 [l,t,r,b]；長道具不算，讓角色本體置中)
CARDS = {
    'tiandianaini': (TEA, (245, 484, 1266, 1377)),
    'xiawujiaojiao': (TEA, (117, 1193, 706, 1850)),
    'danngaomie': (TEA, (378, 1468, 1172, 2457)),
    'wangyuanmie': (STAR, (24, 1043, 524, 1369)),
    'xingyejiao': (STAR, (488, 1109, 737, 1376)),
    'tilanxing': (STAR, (758, 1023, 1039, 1371)),
    'shanqiulong': (STAR, (698, 827, 961, 1018)),
    'aomijiapaoxiaoshou': (OMEGA, (1100, 353, 2771, 1654)),
}
FILL, CENTER_Y = 1.6, .44
STAR_FILL = {'wangyuanmie': 2.0, 'xingyejiao': 2.4, 'tilanxing': 2.2, 'shanqiulong': 3.0}   # 影片裡四隻擠在一起、又小：視窗放寬，龍（191px 高）放最寬免得放大太多
def window(size, box, fill=FILL):
    W, H = size; l, t, r, b = box; w, h = r - l, b - t; cx, cy = (l + r) / 2, (t + b) / 2
    ch = h * fill; cw = ch * 5 / 7
    if cw < w * 1.12: cw = w * 1.12; ch = cw * 7 / 5
    if ch > H: ch = H; cw = ch * 5 / 7
    if cw > W: cw = W; ch = cw * 7 / 5
    x0 = cx - cw / 2; y0 = cy - ch * CENTER_Y
    x0 = min(max(0, x0), W - cw); y0 = min(max(0, y0), H - ch)
    return (round(x0), round(y0), round(x0 + cw), round(y0 + ch))
def main():
    for ident, (src, box) in CARDS.items():
        im = Image.open(src).convert('RGBA'); win = window(im.size, box, STAR_FILL.get(ident, FILL))
        out = im.crop(win).resize((600, 840), Image.LANCZOS)
        out.save(HERE / 'art' / f'card-{ident}.png'); print(ident, im.size, 'window', win)
if __name__ == '__main__': main()
