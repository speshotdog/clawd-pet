# -*- coding: utf-8 -*-
"""Self-contained copy of the fullscreen prototype: every image inlined as a WebP data URI.

deluxe-gacha-full.html points at art/, cardback/ and layer-*.png, so it only runs from
inside _art/holo-test/. This produces deluxe-gacha-full-standalone.html, which can be
copied anywhere or handed to someone and still plays.

Run build_deluxe_full.py first.
"""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import re
from PIL import Image

OUT = Path(__file__).parent
SRC = OUT / 'deluxe-gacha-full.html'
DST = OUT / 'deluxe-gacha-full-standalone.html'
page = SRC.read_text(encoding='utf-8')


def uri(path: Path, box=(520, 728), quality=84) -> str:
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


# every relative image reference the page makes, whether in markup, CSS or JS strings
refs = set(re.findall(r'["\'\(]((?:art|cardback)/[^"\'\)]+\.(?:png|webp|jpg))["\'\)]', page))
refs |= set(re.findall(r'["\'`](layer-[a-z]+-(?:subject|background)\.png)["\'`]', page))
refs |= set(re.findall(r'["\'\(](texture-[a-z]+\.png)["\'\)]', page))

missing = [r for r in refs if not (OUT / r).exists()]
assert not missing, missing

# longest first so art/x.png is not clobbered by a shorter prefix
for ref in sorted(refs, key=len, reverse=True):
    page = page.replace(ref, uri(OUT / ref))

# the JS builds scene layer paths from a template, so patch those the same way
for name in ('subject', 'background'):
    for cid in ('rocketdog', 'alienkitty', 'astronaut', 'fluffdog'):
        f = f'layer-{cid}-{name}.png'
        if (OUT / f).exists() and f in page:
            page = page.replace(f, uri(OUT / f))

import json

# 卡圖的路徑是 JS 樣板組出來的（art/${file}、layer-${id}-subject.png），
# 檔名不會以字面出現在頁面裡，所以要照 pool-data 自己建一張 asset 表，
# 再把樣板改成查表。
pool = json.loads(re.search(r'<script type="application/json" id="pool-data">(.*?)</script>', page, re.S).group(1))
assets = {}
for c in pool:
    if c.get('scene'):
        for layer in ('subject', 'background'):
            name = 'layer-{}-{}.png'.format(c['id'], layer)
            if (OUT / name).exists():
                assets[name] = uri(OUT / name)
    elif c.get('file') and (OUT / 'art' / c['file']).exists():
        assets[c['file']] = uri(OUT / 'art' / c['file'])

hook = "const POOL"
i = page.index(hook)
page = page[:i] + ("const __ASSETS=" + json.dumps(assets, separators=(',', ':')) +
                   ";const __asset=n=>__ASSETS[n]||n;\n") + page[i:]
page = page.replace('`art/${file}`', '__asset(file)')
page = page.replace('`art/${c.file}`', '__asset(c.file)')
page = page.replace('`layer-${d.id}-subject.png`', '__asset(`layer-${d.id}-subject.png`)')
page = page.replace('`layer-${d.id}-background.png`', '__asset(`layer-${d.id}-background.png`)')
page = page.replace('`layer-${c.id}-subject.png`', '__asset(`layer-${c.id}-subject.png`)')
page = page.replace('`layer-${c.id}-background.png`', '__asset(`layer-${c.id}-background.png`)')

DST.write_text(page, encoding='utf-8', newline='\n')
print('wrote', DST.name, '%.2f MiB' % (DST.stat().st_size / 1048576), '| inlined:', len(refs))
