"""CSS masks need data URLs on Chromium file://. Bake alpha only, never fetch at runtime.
Source character <img> remains ../../src/card-*.png; no duplicate character RGB files.
"""
from pathlib import Path
import base64, io, json, re
from PIL import Image
out=Path(__file__).resolve().parent
root=out.parent.parent
def uri(data,mime):return 'data:'+mime+';base64,'+base64.b64encode(data).decode('ascii')
data={
 'glitter':uri((out/'texture-glitter-atlas.png').read_bytes(),'image/png'),
 'frame':uri((out/'frame-mask.svg').read_bytes(),'image/svg+xml')
}
# Preserve historical demo masks byte-for-byte; only new framed assets need baking.
old_html=(out/'demo.html').read_text(encoding='utf-8')
data.update(json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>',old_html,re.S).group(1)))
from pool_data import pool, EXTRA_CARDS
extra_files={c['file'] for c in EXTRA_CARDS}
extra_files.update(f"layer-{c['id']}-subject.png" for c in EXTRA_CARDS if c.get('scene'))

def resolve_art(card):
    """One data-driven resolver: scene layers, research art, legacy source fallback."""
    if card.get('scene'):
        return out / f"layer-{card['id']}-subject.png"
    research = out / 'art' / card['file']
    return research if research.exists() else root / 'src' / card['file']

for card in pool():
    if card['kind'] == 'flat':
        continue
    path = resolve_art(card)
    key = path.name
    if key in data and key not in extra_files: continue
    im=Image.open(path).convert('RGBA')
    im.thumbnail((300,420),Image.Resampling.LANCZOS)
    alpha=im.getchannel('A');mask=Image.new('RGBA',alpha.size,'white');mask.putalpha(alpha)
    buf=io.BytesIO();mask.save(buf,format='PNG',optimize=True)
    data[key]=uri(buf.getvalue(),'image/png')

path=out/'demo.html';html=path.read_text(encoding='utf-8')
block='<!-- MASK_DATA_START -->\n<script type="application/json" id="mask-data">'+json.dumps(data,separators=(',',':'))+'</script>\n<!-- MASK_DATA_END -->'
html=re.sub(r'<!-- MASK_DATA_START -->.*?<!-- MASK_DATA_END -->',lambda m:block,html,flags=re.S)
path.write_text(html,encoding='utf-8');print('Embedded alpha-only masks + atlas + vector frame:',len(block),'bytes')
