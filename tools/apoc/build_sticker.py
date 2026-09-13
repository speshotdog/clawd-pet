# -*- coding: utf-8 -*-
"""末世技能格的圓形貼紙頭像：每張卡算一個「裁成正方形」的取景，輸出 src/apoc/sticker.js。

使用者 2026-09-13 第三輪：「技能格不要把整張卡放上去（不好看）」→ 跟 1.0 一樣是圓形貼紙頭像。
卡圖有三種：
  depth  ：layer-<id>-subject.png（去背主體，畫布 600×840、主體只佔中間一小塊）
  framed ：card-<id>.png（去背主體，主體幾乎撐滿）
  flat   ：card-<id>.png（整張場景、不透明）
去背的用 alpha 外框取景（偏上，圓裡要看到臉）；不透明的取中間偏上的正方形。

輸出 window.ApocSticker = { id: [file, sizePct, posXPct, posYPct] }，
直接當 background-size／background-position 用（容器是正方形）。
用法：python tools/apoc/build_sticker.py
"""
import json, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
APOC = ROOT / 'src' / 'apoc'
text = (APOC / 'pool.js').read_text(encoding='utf-8')
pool = json.loads(re.search(r'window\.ApocPool\s*=\s*(\[.*?\]);', text, re.S).group(1))
assets = json.loads(re.search(r'window\.ApocAssets\s*=\s*(\{.*?\});', text, re.S).group(1))

out = {}
for c in pool:
    key = f"layer-{c['id']}-subject.png" if c.get('scene') else c.get('file')
    rel = assets.get(key)
    if not rel: print('沒有卡圖', c['id'], key); continue
    im = Image.open(APOC / rel)
    W, H = im.size
    box = None
    if im.mode in ('RGBA', 'LA'):
        a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
        box = a.getbbox()
        if box and (box[2] - box[0]) * (box[3] - box[1]) > W * H * .97: box = None   # 其實是不透明的
    if box:
        l, t, r, b = box; bw, bh = r - l, b - t
        s = min(max(bw, bh) * .96, W, H)
        cx = (l + r) / 2
        cy = t + min(bh, s) / 2 if bh > bw else (t + b) / 2   # 直長的主體取上半（臉）
    else:
        s = min(W, H) * .9; cx = W / 2; cy = H * .45
    x0 = min(max(cx - s / 2, 0), W - s); y0 = min(max(cy - s / 2, 0), H - s)
    size = W / s * 100
    px = 0 if W == s else x0 / (W - s) * 100
    py = 0 if H == s else y0 / (H - s) * 100
    out[c['id']] = [rel, round(size, 1), round(px, 1), round(py, 1)]

js = ('// 由 tools/apoc/build_sticker.py 產生：技能格圓形貼紙的取景（[卡圖, background-size%, x%, y%]）\n'
      'window.ApocSticker=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
(APOC / 'sticker.js').write_text(js, encoding='utf-8')
print(len(out), '張 →', APOC / 'sticker.js')
