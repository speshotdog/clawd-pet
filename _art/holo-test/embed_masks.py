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
for name in ('zhenpete','zhenwang','zhencao','zhenjpg','mieshi','wanwumythic'):
    path=root/'src'/f'card-{name}.png'
    alpha=Image.open(path).convert('RGBA').getchannel('A')
    mask=Image.new('RGBA',alpha.size,'white');mask.putalpha(alpha)
    buf=io.BytesIO();mask.save(buf,format='PNG',optimize=True)
    data[f'card-{name}.png']=uri(buf.getvalue(),'image/png')
for name in ('rocketdog','astronaut','alienkitty','fluffdog'):
    key=f'layer-{name}-subject.png'
    alpha=Image.open(out/key).getchannel('A');mask=Image.new('RGBA',alpha.size,'white');mask.putalpha(alpha)
    buf=io.BytesIO();mask.save(buf,format='PNG',optimize=True);data[key]=uri(buf.getvalue(),'image/png')
# Round 9: the whole pool gets a deluxe frame, so every card art needs its foil mask.
# Downscaled to 300x420 - the mask only drives foil placement, and 43 full-res alphas
# would add megabytes to demo.html for no visible gain.
import json as _json
for entry in _json.loads((out/'pool-cards.json').read_text(encoding='utf-8')):
    key=entry['src']
    if key in data: continue
    src=root/'src'/entry['src']
    if not src.exists(): print('missing art, skipped:',entry['src']); continue
    im=Image.open(src).convert('RGBA')
    im.thumbnail((300,420),Image.Resampling.LANCZOS)
    alpha=im.getchannel('A');mask=Image.new('RGBA',alpha.size,'white');mask.putalpha(alpha)
    buf=io.BytesIO();mask.save(buf,format='PNG',optimize=True);data[key]=uri(buf.getvalue(),'image/png')

path=out/'demo.html';html=path.read_text(encoding='utf-8')
block='<!-- MASK_DATA_START -->\n<script type="application/json" id="mask-data">'+json.dumps(data,separators=(',',':'))+'</script>\n<!-- MASK_DATA_END -->'
html=re.sub(r'<!-- MASK_DATA_START -->.*?<!-- MASK_DATA_END -->',lambda m:block,html,flags=re.S)
path.write_text(html,encoding='utf-8');print('Embedded alpha-only masks + atlas + vector frame:',len(block),'bytes')
