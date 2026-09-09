"""Isolate frozen round-32 canvas clipping from the CSS waves, without source edits."""
import json
from PIL import ImageChops,ImageStat
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,BY,start,advance,open_page
from check_gacha_layers_round31 import pair
from check_gacha_layers_round33 import OUT,box
source=OUT/'frozen-before-reproduction.html'
source.write_text('<base href="'+HERE.as_uri()+'/">'+(OUT/'before-deluxe-gacha-b.html').read_text(encoding='utf-8'),encoding='utf-8')
rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for rarity in ['legendary','mythic']:
    p,errors=open_page(b,source.as_uri());p.set_viewport_size({'width':1440,'height':900});p.evaluate('window.__clockRender=false')
    start(p,[BY['common']]*2+[BY[rarity]]+[BY['common']]*7);advance(p,1750+1680+(900 if rarity=='legendary' else 1300)+420)
    r=box(p,'.slot[data-i="1"] .hcard');r=(r[0]+3,r[1]+3,r[2]-3,r[3]-3)
    css,cssOff=pair(p,'.fx-substrate-wave,.fx-spectrum-wave');cssdelta=ImageChops.subtract(css,cssOff).crop(r)
    # The CSS wave reaches the neighbor at +100ms; the smaller canvas ring
    # reaches it later. Do not sample a ring before it intersects the target.
    advance(p,200)
    a,off=pair(p,'.ceremony-canvas:not(.under)');original=ImageChops.difference(a,off).crop(r)
    style=p.add_style_tag(content='.ceremony-canvas:not(.under){clip-path:none!important;z-index:8!important}')
    raised,raisedOff=pair(p,'.ceremony-canvas:not(.under)');delta=ImageChops.subtract(raised,raisedOff).crop(r)
    row=dict(rarity=rarity,neighbor=r,original_bbox=original.getbbox(),original_max=max(v[1] for v in original.getextrema()),css_mean=ImageStat.Stat(cssdelta).mean,unclipped_canvas_mean=ImageStat.Stat(delta).mean,unclipped_bbox=delta.getbbox())
    assert row['original_bbox'] is None and row['unclipped_bbox'] is not None and max(row['css_mean'])>0,row
    a.save(OUT/f'A-diagnosis-{rarity}-before.png');raised.save(OUT/f'A-diagnosis-{rarity}-canvas-raised-unclipped.png');rows.append(row);p.close()
 b.close()
(OUT/'A-isolated-diagnosis.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
