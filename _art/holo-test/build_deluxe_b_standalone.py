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
import json, re
from PIL import Image

OUT = Path(__file__).parent
ROOT = (OUT / '../..').resolve()
page = (OUT / 'deluxe-gacha-b.html').read_text(encoding='utf-8')
cards = json.loads(re.search(r'<script type="application/json" id="pool-data">(.*?)</script>', page, re.S).group(1))


def uri(path, box=(360, 504), quality=82):
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
for c in cards:
    if c.get('scene'):
        for layer in ('subject', 'background'):
            name = 'layer-{}-{}.png'.format(c['id'], layer)
            assets[name] = uri(OUT / name)
    else:
        assets[c['file']] = uri(OUT / 'art' / c['file'])

back = uri(OUT / 'cardback' / 'deluxe-back.webp')

# the foil CSS still fetches these two relatively
for tex in ('texture-fiber.png', 'texture-engraving.png'):
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' + b64encode((OUT / tex).read_bytes()).decode('ascii'))

hook = "const POOL  = JSON.parse($('#pool-data').textContent);"
assert hook in page
page = page.replace(hook, hook + "\nconst ASSETS = JSON.parse($('#asset-data').textContent);"
                                 "\nconst asset = n => ASSETS[n] || n;", 1)

old_bg = "i.src=`layer-${d.id}-background.png`"
assert old_bg in page
page = page.replace(old_bg, "i.src=asset(`layer-${d.id}-background.png`)", 1)

old_src = "const srcPath=d.scene?`layer-${d.id}-subject.png`:`art/${d.file}`;"
assert old_src in page
page = page.replace(old_src, "const srcPath=asset(d.scene?`layer-${d.id}-subject.png`:d.file);", 1)

assert 'url("cardback/deluxe-back.webp")' in page
page = page.replace('url("cardback/deluxe-back.webp")', 'url("' + back + '")')

tag = '<script type="application/json" id="pool-data">'
page = page.replace(tag, '<script type="application/json" id="asset-data">'
                    + json.dumps(assets, separators=(',', ':')) + '</script>\n' + tag, 1)

target = OUT / 'deluxe-gacha-b-standalone.html'
target.write_text(page, encoding='utf-8', newline='\n')
print('wrote', target.name, '%.2f MiB' % (target.stat().st_size / 1048576), '| assets:', len(assets))
