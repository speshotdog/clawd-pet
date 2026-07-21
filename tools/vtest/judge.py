#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""vtest 視覺判官：把每個角色部件的「原始渲染條帶」(不含 heatmap，避免紅框誤導)
送 Gemini 視覺模型，請它指出肉眼可見的接縫/黑線/缺口/破圖/殘影。

Key 從 D:\\claude\\.env 的 GEMINI_API_KEY 以 dotenv 載入，不印出。
用法：python judge.py            # 判所有預設 GROUPS
      python judge.py char part tag0,tag1,...   # 判單一組
"""
import sys, os, io, json
import numpy as np
from PIL import Image, ImageDraw
from dotenv import load_dotenv
import google.generativeai as genai

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
load_dotenv(r'D:\claude\.env')
genai.configure(api_key=os.environ['GEMINI_API_KEY'])
MODEL = 'gemini-2.5-flash'

PROMPT = (
    "這是桌寵角色的部件擺動測試圖（同一角色在不同旋轉角度，最左或中間標 0deg 為靜止基準）。"
    "請以嚴格的美術品管眼光，指出任何肉眼可見的：接縫、黑線、深色重疊帶、背景缺口、破圖、"
    "斷裂輪廓、殘影（部件移開後殘留的深色塊）。請具體說明在哪一格(角度)、部件的哪個位置。"
    "若各格都乾淨、與 0deg 無明顯差異，只回覆「PASS」。"
)


def raw_montage(char, part, tags, scale=2):
    imgs = [np.asarray(Image.open(os.path.join(OUT, f'{char}_{part}_{t}.png')).convert('RGBA')) for t in tags]
    H, W = imgs[0].shape[:2]
    pad = 6
    cw = W * scale + pad
    canvas = Image.new('RGB', (cw * len(tags) + pad, H * scale + 24), (150, 150, 150))
    d = ImageDraw.Draw(canvas)
    for i, (t, arr) in enumerate(zip(tags, imgs)):
        rgb = arr[..., :3].astype(float); a = arr[..., 3:4].astype(float) / 255.0
        bg = np.full_like(rgb, 150)
        comp = (rgb * a + bg * (1 - a)).astype(np.uint8)
        im = Image.fromarray(comp).resize((W * scale, H * scale), Image.NEAREST)
        x = pad + i * cw
        canvas.paste(im, (x, 20))
        d.text((x, 4), f'{t}deg', fill=(0, 0, 0))
    return canvas


def judge_group(char, part, tags):
    mont = raw_montage(char, part, tags)
    buf = io.BytesIO(); mont.save(buf, 'PNG'); buf.seek(0)
    model = genai.GenerativeModel(MODEL)
    resp = model.generate_content([PROMPT, {'mime_type': 'image/png', 'data': buf.getvalue()}])
    txt = (resp.text or '').strip()
    return txt


GROUPS = [
    ('jiaobu', 'pawR', ['n11', 'n5_5', '0', 'p5_5', 'p11', 'p14_5']),
    ('jiaobu', 'tail', ['n5', '0', 'p5']),
    ('jiaobu', 'legR', ['n6_5', '0', 'p6_5']),
    ('yueyue', 'tail', ['n5', '0', 'p5']),
    ('yueyue', 'pawR', ['n11', '0', 'p14_5']),
    ('dog', 'pawR', ['n22', '0', 'p22']),
    ('dog', 'legR', ['n13', '0', 'p13']),
]


def main():
    if len(sys.argv) >= 4:
        groups = [(sys.argv[1], sys.argv[2], sys.argv[3].split(','))]
    else:
        groups = GROUPS
    results = {}
    for char, part, tags in groups:
        try:
            v = judge_group(char, part, tags)
        except Exception as e:  # noqa
            v = 'JUDGE_ERROR: ' + str(e)
        key = f'{char}/{part}'
        results[key] = v
        print(f'===== {key} =====')
        print(v)
        print()
    with open(os.path.join(OUT, 'gemini_verdicts.json'), 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
