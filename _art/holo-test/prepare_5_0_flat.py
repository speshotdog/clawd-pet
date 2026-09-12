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
# 2026-09-13 第二次退回：「甜點系列放大一點、以角色的臉為主置中、龍總拉更近；尾巴裁掉可以，臉一定在卡中間」
# id → (來源, 臉的中心 (x,y), 視窗高度＝來源像素)。臉放在卡寬 50%、卡高 40%。
CARDS = {
    'tiandianaini': (TEA, (750, 830), 1150),
    'xiawujiaojiao': (TEA, (380, 1500), 1000),
    'danngaomie': (TEA, (730, 1740), 1150),
    'wangyuanmie': (STAR, (300, 1180), 620),
    'xingyejiao': (STAR, (755, 1190), 900),   # 2026-09-13 使用者：今晚不睡膠＋提籃摘星獸併成一張（兩隻臉的中點）
    'shanqiulong': (STAR, (790, 905), 420),
    'aomijiapaoxiaoshou': (OMEGA, (2280, 990), 1900),
}
FACE_X, FACE_Y = .5, .40   # 文字框上緣在卡高 80%（bottom 4%＋height 16%），「卡頂到文字框上緣」那塊的中心＝40%
def window(size, face, ch):
    W, H = size; fx, fy = face
    ch = min(ch, H); cw = ch * 5 / 7
    if cw > W: cw = W; ch = cw * 7 / 5
    x0 = fx - cw * FACE_X; y0 = fy - ch * FACE_Y
    x0 = min(max(0, x0), W - cw); y0 = min(max(0, y0), H - ch)
    return (round(x0), round(y0), round(x0 + cw), round(y0 + ch))
def main():
    for ident, (src, face, ch) in CARDS.items():
        im = Image.open(src).convert('RGBA'); win = window(im.size, face, ch)
        out = im.crop(win).resize((600, 840), Image.LANCZOS)
        out.save(HERE / 'art' / f'card-{ident}.png'); print(ident, im.size, 'window', win)
if __name__ == '__main__': main()
