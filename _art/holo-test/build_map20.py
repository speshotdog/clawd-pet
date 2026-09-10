"""Deterministically build the standalone map; source artwork is read-only.

python _art/holo-test/build_map20.py
Pillow required. No network, no image generation, no recoloring or filters.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent

def encode(im, quality=None):
    b = io.BytesIO()
    im.save(b, 'WEBP', lossless=quality is None, quality=100 if quality is None else quality, method=4, exact=True)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode('ascii')

def build():
    art = HERE / 'map-art'
    scene = Image.open(art / 'seg1-backyard-ruin.png').convert('RGB')
    sheet = Image.open(art / 'icons-sheet.png').convert('RGB')
    w, h = sheet.size
    # Strict integer 2 x 2 cells. Trim only empty margins using documented
    # motif bounds plus 8px safety; keep source colors/background unchanged.
    bounds = {'check': (112,132,516,506), 'lock': (804,105,1129,521),
              'paw': (109,744,506,1119), 'gate': (682,738,1219,1142)}
    cells = [(0,0,w//2,h//2),(w//2,0,w,h//2),(0,h//2,w//2,h),(w//2,h//2,w,h)]
    assets = {}
    crops = {}
    for (name, box), cell in zip(bounds.items(), cells):
        x,y,_,_ = cell
        crop = sheet.crop(cell).crop((box[0]-x,box[1]-y,box[2]-x,box[3]-y))
        assets[name] = encode(crop)
        crops[name] = {'cell':cell, 'source_box':box, 'size':crop.size, 'lossless':True}
    template = (HERE / 'map20.template.html').read_text(encoding='utf-8')
    for quality in [94,90,86,82,78]:
        assets['terrain'] = encode(scene, quality)
        html = template.replace('/* EMBEDDED_ASSETS */', ':root{' + ''.join('--art-'+k+':url("'+v+'");' for k,v in assets.items()) + '}')
        if len(html.encode('utf-8')) <= 2_500_000:
            break
    else:
        raise ValueError('Standalone HTML exceeds 2.5 MB')
    (HERE / 'map20.html').write_text(html,encoding='utf-8',newline='\n')
    evidence = {'html_bytes':len(html.encode('utf-8')), 'terrain_quality':quality,
                'terrain_size':scene.size, 'crops':crops,
                'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [art/'seg1-backyard-ruin.png',art/'icons-sheet.png']}}
    out = HERE.parents[1] / 'docs/clicker/shots/map-round2'
    out.mkdir(parents=True,exist_ok=True)
    (out/'build.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(evidence,ensure_ascii=False))
    return evidence

if __name__ == '__main__':
    build()
