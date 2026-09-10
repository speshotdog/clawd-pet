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
    if path.suffix.lower() == '.webp':
        URI_CACHE[key] = 'data:image/webp;base64,' + b64encode(path.read_bytes()).decode('ascii')
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

from update_demo_data import update
update()
html = SOURCE.read_text(encoding='utf-8')
refs = set(re.findall(r'(?:(?:src|href)=["\']|url\(["\']?)([^"\')]+\.(?:png|jpg|jpeg|webp))', html))
replacements = {}
for ref in sorted(refs):
    if ref.startswith('data:'):
        continue
    path = (ROOT / ref).resolve() if not ref.startswith('../../') else (ROOT / ref).resolve()
    if path.exists():
        replacements[ref] = data_uri(path)

# ⚠ 整份純字串取代會連 mask-data 的 JSON **鍵名**一起換掉，
# 而 card_face.js:86 是用原檔名查 masks[key]，查不到就不掛 .subject-mask，
# 四張場景卡（rocketdog／astronaut／alienkitty／fluffdog）因此少了圖內視差層。
# 先把 mask-data 區塊挖出來、取代完再放回去。
_mask_block = re.search(r'<script type="application/json" id="mask-data">.*?</script>', html, re.S)
_MASK_TOKEN = '<!--MASK_DATA_PLACEHOLDER-->'
if _mask_block:
    html = html.replace(_mask_block.group(0), _MASK_TOKEN)

for ref, uri in replacements.items():
    html = html.replace(ref, uri)

if _mask_block:
    # 鍵名保持原檔名；值本來就是 data URI，不需要取代
    html = html.replace(_MASK_TOKEN, _mask_block.group(0))

# Runtime-created cards use template strings; route those through the same map.
asset_map = {}
def cached_uri(path: Path) -> str:
    return data_uri(path)
for path in sorted(ROOT.glob('layer-*.png')):
    asset_map[path.name] = cached_uri(path)
for path in sorted((ROOT / 'art').glob('card-*.png')):
    asset_map[path.name] = cached_uri(path)
for path in sorted((ROOT / 'art').glob('toy-*.png')):
    asset_map[path.name] = cached_uri(path)
for name in ('texture-fiber.png', 'texture-engraving.png', 'gacha-cardback.jpg'):
    path = (ROOT / name) if (ROOT / name).exists() else (ROOT / '../../src' / name).resolve()
    if path.exists():
        asset_map[name] = cached_uri(path)
resolver = "function resolve(name){return name.startsWith('layer-')?name:'art/'+name;}"
assert html.count(resolver) == 1, 'demo resolver contract changed'
import json
html = html.replace(resolver, 'const assetMap='+json.dumps(asset_map)+';function resolve(name){if(!assetMap[name])throw Error("Missing asset: "+name);return assetMap[name];}')
script = '<script src="card_face.js"></script>'
assert html.count(script) == 1, 'shared card script contract changed'
html = html.replace(script, '<script>'+(ROOT/'card_face.js').read_text(encoding='utf-8')+'</script>')
html = html.replace('../../src/card-zhenpete.png', 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=')

html = html.replace('華麗卡牌第五輪', '華麗卡牌第五輪 · 單檔分享版')
html = '<!-- Round 5 standalone: all PNG references converted to self-contained WebP data URIs. -->\n' + html
TARGET.write_text(html, encoding='utf-8', newline='\n')
print(f'embedded={len(replacements)} size={TARGET.stat().st_size} bytes')
if TARGET.stat().st_size > 15 * 1024 * 1024:
    raise SystemExit('standalone exceeds 15 MiB')
