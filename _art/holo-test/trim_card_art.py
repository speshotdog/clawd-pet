# -*- coding: utf-8 -*-
"""Trim every card PNG to its opaque pixels.

The card art in src/ has different amounts of transparent padding on each file, so
centring the <img> box centres the *file*, not the character - which is why the
characters looked off-centre. Cropping each one to its alpha bounding box makes the
image box and the subject the same thing, and centring then just works.

src/ is the game's art and stays read-only: the trimmed copies go to _art/holo-test/art/.
Writes art/manifest.json with the crop each file got, so the trim is auditable.
"""
from pathlib import Path
import json
from PIL import Image

OUT = Path(__file__).parent
ROOT = (OUT / '../..').resolve()
DST = OUT / 'art'
DST.mkdir(exist_ok=True)

manifest = {}
for src in sorted((ROOT / 'src').glob('*.png')):
    if not (src.name.startswith('card-') or src.name.startswith('toy-')):
        continue
    im = Image.open(src).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if not bbox:
        continue
    w, h = im.size
    # a fully opaque file (a painted scene, not a cut-out character) has nothing to trim
    trimmed = im if bbox == (0, 0, w, h) else im.crop(bbox)
    trimmed.save(DST / src.name, optimize=True)
    manifest[src.name] = {
        'source': [w, h],
        'bbox': list(bbox),
        'size': list(trimmed.size),
        'trimmed': bbox != (0, 0, w, h),
    }

(DST / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
trimmed_n = sum(1 for v in manifest.values() if v['trimmed'])
print('wrote', len(manifest), 'files to art/ ;', trimmed_n, 'actually needed trimming')
for name, v in list(manifest.items())[:4]:
    print(' ', name, v['source'], '->', v['size'])
