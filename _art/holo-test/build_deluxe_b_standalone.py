# -*- coding: utf-8 -*-
"""Self-contained copy of the style-B prototype: every image inlined as a WebP data URI.

deluxe-gacha-b.html points at ../../src/card-*.png and cardback/, so it only works
from inside the repo. This makes deluxe-gacha-b-standalone.html, which can be copied
anywhere or handed to someone and still plays.

Run build_deluxe_b.py first.
"""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json, re, argparse
from card_assets import keys
parser=argparse.ArgumentParser();parser.add_argument("--test",action="store_true")
parser.add_argument("--card-width",type=int,default=600)
parser.add_argument("--output",type=Path)
args=parser.parse_args(); TEST=args.test
assert args.card_width == 600
from PIL import Image

OUT = Path(__file__).parent
ROOT = (OUT / '../..').resolve()
page = (OUT / ('deluxe-gacha-b-test.html' if TEST else 'deluxe-gacha-b.html')).read_text(encoding='utf-8')
cards = json.loads(re.search(r'<script type="application/json" id="pool-data">(.*?)</script>', page, re.S).group(1))


def uri(path, box=None, quality=82):
    box = box or (args.card_width, args.card_width*7//5)
    if path.suffix.lower() == '.webp':
        return 'data:image/webp;base64,' + b64encode(path.read_bytes()).decode('ascii')
    with Image.open(path) as im:
        im.load()
        im.thumbnail(box, Image.Resampling.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        buf = BytesIO()
        im.save(buf, format='WEBP', quality=quality, method=4)
    return 'data:image/webp;base64,' + b64encode(buf.getvalue()).decode('ascii')


assets = {}
for name in ('foil-pack.webp', 'foil-tear.webp', 'summon-substrate.webp'):
    file = OUT / 'fx' / name
    if not file.exists():
        assert name == 'summon-substrate.webp', name
        continue
    mime = 'image/svg+xml' if file.suffix == '.svg' else 'image/webp'
    assets['fx/' + name] = 'data:' + mime + ';base64,' + b64encode(file.read_bytes()).decode('ascii')

back = uri(OUT / 'cardback' / 'deluxe-back.webp')

# the foil CSS still fetches these two relatively
for tex in ('texture-fiber.png', 'texture-engraving.png'):
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' + b64encode((OUT / tex).read_bytes()).decode('ascii'))

# 卡面現在由共用的 card_face.js 產生，素材一律經過 path()，
# 所以單檔版只要把 path() 的實作換成查表即可，不必再逐條字面替換 DOM 程式碼。
hook = "function path(n){"
assert hook in page, 'path()'
i = page.index(hook)
end_i = page.index("}", page.index("return", i)) + 1
page = page[:i] + ("const __ASSETS=JSON.parse(document.getElementById('asset-data').textContent)" +
                   ";function path(n){ return __CARD_ASSETS[n] || __ASSETS[n] || n; }") + page[end_i:]

assert 'url("cardback/deluxe-back.webp")' in page
page = page.replace('url("cardback/deluxe-back.webp")', 'url("' + back + '")')

tag = '<script type="application/json" id="pool-data">'
page = page.replace(tag, '<script type="application/json" id="asset-data">'
                    + json.dumps(assets, separators=(',', ':')) + '</script>\n' + tag, 1)

target = args.output or OUT / ('deluxe-gacha-b-test-standalone.html' if TEST else 'deluxe-gacha-b-standalone.html')
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(page, encoding='utf-8', newline='\n')
print('wrote', target.name, '%.2f MiB' % (target.stat().st_size / 1048576), '| non-card assets:', len(assets), '| shared card layers:', sum(len(keys(c)) for c in cards))
