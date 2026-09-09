# -*- coding: utf-8 -*-
"""cards-remade.html 的單檔版：圖片全部內嵌，複製到任何資料夾都能開。

以前這一步是臨時貼在終端機裡跑的一段程式，所以 Astra 驗收時發現
cards-remade-standalone.html 還停在舊實作（沒有 HoloCardFace）。
變成正式腳本，跟其他三支建置一起跑。

先跑 build_cards_remade.py。
"""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json, re
from PIL import Image

OUT = Path(__file__).parent
SRC = OUT / 'cards-remade.html'
DST = OUT / 'cards-remade-standalone.html'
page = SRC.read_text(encoding='utf-8')
pool = json.loads(re.search(r'<script type="application/json" id="pool-data">(.*?)</script>', page, re.S).group(1))


def uri(path: Path, box=(420, 588), quality=84) -> str:
    with Image.open(path) as im:
        im.load()
        im.thumbnail(box, Image.Resampling.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        buf = BytesIO()
        im.save(buf, format='WEBP', quality=quality, method=4)
    return 'data:image/webp;base64,' + b64encode(buf.getvalue()).decode('ascii')


# 箔紋是 CSS 直接引用的相對檔名
for tex in ('texture-fiber.png', 'texture-engraving.png'):
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' + b64encode((OUT / tex).read_bytes()).decode('ascii'))

# 卡圖經過 HoloCardFace 的 resolve()，所以只要把查表塞進頁面即可
assets = {}
for c in pool:
    if c.get('scene'):
        for layer in ('subject', 'background'):
            key = f"layer-{c['id']}-{layer}.png"
            assets[key] = uri(OUT / key)
    else:
        assets[c['file']] = uri(OUT / 'art' / c['file'])
hook = "const POOL  = JSON.parse($('#pool-data').textContent);"
assert hook in page, hook
page = page.replace(hook, hook + "\nconst __A=" + json.dumps(assets, separators=(',', ':')) + ";", 1)

DST.write_text(page, encoding='utf-8', newline='\n')
print('wrote', DST.name, '%.2f MiB' % (DST.stat().st_size / 1048576), '| assets:', len(assets))
