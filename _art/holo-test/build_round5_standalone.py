from base64 import b64encode
from io import BytesIO
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).parent
SOURCE = ROOT / 'demo.html'
TARGET = ROOT / 'demo-standalone.html'
URI_CACHE = {}

def data_uri(path: Path) -> str:
    key = str(path.resolve())
    if key in URI_CACHE:
        return URI_CACHE[key]
    with Image.open(path) as im:
        im.load()
        # 360x504 is the largest useful size in the review page; preserve alpha.
        im.thumbnail((360, 504), Image.Resampling.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        out = BytesIO()
        im.save(out, format='WEBP', quality=82, method=4, lossless=False)
    URI_CACHE[key] = 'data:image/webp;base64,' + b64encode(out.getvalue()).decode('ascii')
    return URI_CACHE[key]

html = SOURCE.read_text(encoding='utf-8')
refs = set(re.findall(r'(?:(?:src|href)=["\']|url\(["\']?)([^"\')]+\.(?:png|jpg|jpeg))', html))
replacements = {}
for ref in sorted(refs):
    if ref.startswith('data:'):
        continue
    path = (ROOT / ref).resolve() if not ref.startswith('../../') else (ROOT / ref).resolve()
    if path.exists():
        replacements[ref] = data_uri(path)

for ref, uri in replacements.items():
    html = html.replace(ref, uri)

# Runtime-created cards use template strings; route those through the same map.
asset_map = {}
def cached_uri(path: Path) -> str:
    return data_uri(path)
for path in sorted(ROOT.glob('layer-*.png')):
    asset_map[path.name] = cached_uri(path)
for path in sorted((ROOT / '../../src').resolve().glob('card-*.png')):
    asset_map[path.name] = cached_uri(path)
for name in ('texture-fiber.png', 'texture-engraving.png', 'gacha-cardback.jpg'):
    path = (ROOT / name) if (ROOT / name).exists() else (ROOT / '../../src' / name).resolve()
    if path.exists():
        asset_map[name] = cached_uri(path)
html = html.replace("const masks=JSON.parse($('#mask-data').textContent);", "const assetMap=" + repr(asset_map).replace("'", '"') + ";const asset=name=>assetMap[name]||name;const masks=JSON.parse($('#mask-data').textContent);")
html = html.replace("const srcKey=scene?`layer-${data.id}-subject.png`:`card-${data.id}.png`;const src=scene?`layer-${data.id}-subject.png`:`../../src/card-${data.id}.png`;", "const srcKey=scene?`layer-${data.id}-subject.png`:`card-${data.id}.png`;const src=asset(srcKey);")
html = html.replace("image.src=`layer-${data.id}-background.png`", "image.src=asset(`layer-${data.id}-background.png`)")
html = html.replace("if(masks[src])", "if(masks[srcKey])").replace("if(masks[src]&&kind!=='flat')", "if(masks[srcKey]&&kind!=='flat')").replace("`url(\"${masks[src]}\")`", "`url(\"${masks[srcKey]}\")`")
html = html.replace('../../src/card-zhenpete.png', 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=')

html = html.replace('華麗卡牌第五輪', '華麗卡牌第五輪 · 單檔分享版')
html = '<!-- Round 5 standalone: all PNG references converted to self-contained WebP data URIs. -->\n' + html
TARGET.write_text(html, encoding='utf-8', newline='\n')
print(f'embedded={len(replacements)} size={TARGET.stat().st_size} bytes')
if TARGET.stat().st_size > 15 * 1024 * 1024:
    raise SystemExit('standalone exceeds 15 MiB')
