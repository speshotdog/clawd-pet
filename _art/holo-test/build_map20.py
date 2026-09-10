"""Deterministically build the standalone map; source artwork is read-only.

python _art/holo-test/build_map20.py
Pillow required. No network, no image generation, no recoloring or filters.
"""
import base64
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image
from collections import deque

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
    # Only four-neighbour cream connected to the outside is background.
    # The darker closed contour around each cream sticker rim stops the fill.
    cutout = sheet.convert('RGBA')
    pix = cutout.load(); seen = bytearray(w*h)
    queue = deque([(x,y) for x in range(w) for y in (0,h-1)] + [(x,y) for y in range(h) for x in (0,w-1)])
    while queue:
        x,y = queue.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y*w+x]: continue
        seen[y*w+x] = 1
        r,g,b,a = pix[x,y]
        if min(r,g,b) < 235 or max(r,g,b)-min(r,g,b) > 25: continue
        pix[x,y] = (r,g,b,0)
        queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    # Existing cutout is immutable in the team round; verify instead of writing.
    assert Image.open(art/'icons-sheet-cutout.png').convert('RGBA').tobytes() == cutout.tobytes()
    # Strict integer 2 x 2 cells. Trim only empty margins using documented
    # motif bounds plus 8px safety; keep source RGB and enclosed sticker cream unchanged.
    bounds = {'check': (112,132,516,506), 'lock': (804,105,1129,521),
              'paw': (109,744,506,1119), 'gate': (682,738,1219,1142)}
    cells = [(0,0,w//2,h//2),(w//2,0,w,h//2),(0,h//2,w//2,h),(w//2,h//2,w,h)]
    assets = {}
    crops = {}
    for (name, box), cell in zip(bounds.items(), cells):
        x,y,_,_ = cell
        crop = cutout.crop(cell).crop((box[0]-x,box[1]-y,box[2]-x,box[3]-y))
        assets[name] = encode(crop)
        crops[name] = {'cell':cell, 'source_box':box, 'size':crop.size, 'lossless':True, 'retained_pixels':sum(a>0 for a in crop.getchannel('A').get_flattened_data()), 'removed_pixels':sum(a==0 for a in crop.getchannel('A').get_flattened_data())}
    template = (HERE / 'map20.template.html').read_text(encoding='utf-8')
    from pool_data import pool
    cards = []
    for rarity, count in [('mythic',4),('legendary',6),('epic',6),('rare',8)]:
        # Prototype subset: very wide silhouettes need a separate overview
        # treatment to retain their full tools/body in a 5:7 slot.
        deferred={'foxmoney','ababa','gebuyang'}
        cards.extend([c for c in pool() if c['rarity']==rarity and c['id'] not in deferred][:count])
    demo = (HERE/'demo.html').read_text(encoding='utf-8')
    baseline = re.search(r'<template id="baseline-css">.*?</template>',demo,re.S)
    styles = '\n'.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>',demo,re.S)
        if not baseline.start() <= m.start() < baseline.end())
    styles = styles.replace('<style>','') # source has a nested opening style tag
    styles += (HERE/'card-position.css').read_text(encoding='utf-8')
    def embed_url(m):
        name=m.group(1).strip('"\'')
        if name.startswith('data:') or name.startswith('#'): return m.group(0)
        path=HERE/name
        if not path.exists(): raise FileNotFoundError(path)
        return 'url("'+encode(Image.open(path).convert('RGBA'))+'")'
    styles=re.sub(r'url\(([^)]+)\)',embed_url,styles)
    masks=json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>',demo,re.S)[1])
    images={};used={'frame','glitter'}
    for c in cards:
        keys=[f"layer-{c['id']}-subject.png",f"layer-{c['id']}-background.png"] if c.get('scene') else [c['file']]
        for key in keys:
            path=HERE/key if key.startswith('layer-') else HERE/'art'/key
            images[key]=encode(Image.open(path).convert('RGBA'),90)
            used.add(key)
        subject_path=HERE/keys[0] if keys[0].startswith('layer-') else HERE/'art'/keys[0]
        subject=Image.open(subject_path).convert('RGBA')
        # The overview is a separate component. Trim transparent margins only;
        # preserve every nontransparent pixel, including tools, horns and tails.
        bounds=subject.getchannel('A').getbbox()
        sprite=subject.crop(bounds)
        scale=min(240/sprite.width,326/sprite.height,(.60*250*350/(sprite.width*sprite.height))**.5)
        sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
        proxy=Image.new('RGBA',(250,350))
        proxy.alpha_composite(sprite,((250-sprite.width)//2,(350-sprite.height)//2))
        key='proxy-'+c['id'];images[key]=encode(proxy)
        c['proxy']=key
        c['proxy_bounds_share']=sprite.width*sprite.height/(250*350)*100
        c['proxy_alpha_share']=sum(a>0 for a in proxy.getchannel('A').get_flattened_data())/(250*350)*100
    payload={'cards':cards,'images':images,'masks':{k:v for k,v in masks.items() if k in used},'css':styles}
    # Styles remain byte-for-byte in a shadow tree; only URL transport changes.
    fonts=''.join(re.findall(r'@font-face\s*\{[^}]+\}',styles))
    template=template.replace('<!-- TEAM_FONT -->','<style>'+fonts+'</style>')
    template=template.replace('/* TEAM_DATA */','const TEAM_DATA='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';')
    template=template.replace('/* CARD_FACE */',(HERE/'card_face.js').read_text(encoding='utf-8'))
    template=template.replace('/* TEAM_CSS */',(HERE/'team20.css').read_text(encoding='utf-8'))
    template=template.replace('/* TEAM_JS */',(HERE/'team20.js').read_text(encoding='utf-8'))
    for quality in [94,90,86,82,78]:
        assets['terrain'] = encode(scene, quality)
        html = template.replace('/* EMBEDDED_ASSETS */', ':root{' + ''.join('--art-'+k+':url("'+v+'");' for k,v in assets.items()) + '}')
        if len(html.encode('utf-8')) <= 6_000_000:
            break
    else:
        raise ValueError('Standalone HTML exceeds 6 MB')
    (HERE / 'map20.html').write_text(html,encoding='utf-8',newline='\n')
    evidence = {'html_bytes':len(html.encode('utf-8')), 'html_sha256':hashlib.sha256(html.encode('utf-8')).hexdigest(), 'terrain_quality':quality,
                'team_cards':[{k:c[k] for k in ('id','name','rarity','kind')} for c in cards], 'frozen_css_sha256':hashlib.sha256(styles.encode()).hexdigest(), 'terrain_size':scene.size, 'crops':crops, 'cutout_method':{'connectivity':4,'cream_min_channel':235,'cream_max_channel_spread':25,'changes':'alpha only; original RGB untouched'},
                'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [art/'seg1-backyard-ruin.png',art/'icons-sheet.png']}}
    out = HERE.parents[1] / 'docs/clicker/shots/team-round3'
    out.mkdir(parents=True,exist_ok=True)
    for name,info in crops.items():
        original=sheet.crop(info['source_box']).convert('RGBA')
        transparent=cutout.crop(info['source_box'])
        review=Image.new('RGBA',(original.width*2,original.height),(55,61,53,255))
        review.alpha_composite(original,(0,0));review.alpha_composite(transparent,(original.width,0))
        review.convert('RGB').save(out/f'icon-{name}-cutout-pair.png')
    (out/'build.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(evidence,ensure_ascii=False))
    return evidence

if __name__ == '__main__':
    build()
