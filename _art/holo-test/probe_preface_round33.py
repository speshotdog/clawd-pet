import json
from io import BytesIO
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,BY,open_page,start,advance
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
rows=[];reference=None
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for i in range(12):
    rarity=['common','rare','epic'][i%3];p,errors=open_page(b,(HERE/'deluxe-gacha-b.html').as_uri());start(p,[BY[rarity]]);advance(p,200)
    p.evaluate('__syncAnimations();__ceremony.syncFx()')
    meta=p.evaluate("({now:Date.now(),events:__ceremony.events,pack:getComputedStyle(document.querySelector('.summon-pack')).transform,animations:document.querySelector('.summon-pack').getAnimations().map(a=>({time:a.currentTime,start:a.startTime,state:a.playState}))})")
    a=Image.open(BytesIO(p.screenshot())).convert('RGB');p.wait_for_timeout(40);z=Image.open(BytesIO(p.screenshot())).convert('RGB')
    a.save(OUT/f'preface-{i}-immediate.png');z.save(OUT/f'preface-{i}-settled.png')
    if reference is None:reference=z
    rows.append(dict(rarity=rarity,meta=meta,same_time_delta=ImageChops.difference(a,z).getbbox(),cross_rarity_delta=ImageChops.difference(reference,z).getbbox()))
    assert not errors,errors;p.close()
 b.close()
(OUT/'preface-compositor-probe.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
