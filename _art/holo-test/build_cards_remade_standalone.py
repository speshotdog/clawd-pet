# -*- coding: utf-8 -*-
"""cards-remade.html 的單檔版：圖片全部內嵌，複製到任何資料夾都能開。

以前這一步是臨時貼在終端機裡跑的一段程式，所以 Astra 驗收時發現
cards-remade-standalone.html 還停在舊實作（沒有 HoloCardFace）。
變成正式腳本，跟其他三支建置一起跑。

先跑 build_cards_remade.py。
"""
from base64 import b64encode
from pathlib import Path
import json, re, argparse
from card_assets import keys

parser=argparse.ArgumentParser()
parser.add_argument('--card-width',type=int,default=600)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
assert args.card_width == 600
OUT = Path(__file__).parent
SRC = OUT / 'cards-remade.html'
DST = args.output or OUT / 'cards-remade-standalone.html'
DST.parent.mkdir(parents=True,exist_ok=True)
page = SRC.read_text(encoding='utf-8')
pool = json.loads(re.search(r'<script type="application/json" id="pool-data">(.*?)</script>', page, re.S).group(1))


# 箔紋是 CSS 直接引用的相對檔名
for tex in ('texture-fiber.png', 'texture-engraving.png'):
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' + b64encode((OUT / tex).read_bytes()).decode('ascii'))

# 卡圖經過 HoloCardFace 的 resolve()，所以只要把查表塞進頁面即可
DST.write_text(page, encoding='utf-8', newline='\n')
print('wrote', DST.name, '%.2f MiB' % (DST.stat().st_size / 1048576), '| shared card layers:', sum(len(keys(c)) for c in pool))
