from pathlib import Path
import json, shutil, hashlib
from PIL import ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY, start, advance, open_page
from check_gacha_layers_round31 import pair
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
OUT.mkdir(parents=True,exist_ok=True)
frozen=list((HERE.parents[1]/'src').rglob('*'))+[HERE/'card_face.js',HERE/'pool_data.py']
(OUT/'frozen-before.json').write_text(json.dumps({str(p.relative_to(HERE.parents[1])):hashlib.sha256(p.read_bytes()).hexdigest() for p in frozen if p.is_file()},indent=2))
for name in ['deluxe-gacha-b.html','ceremony.js','ceremony.css','ceremony-layout.js','ceremony-fx.js','build_deluxe_b.py','build_deluxe_b_standalone.py','ceremony-background.svg']:
    shutil.copy2(HERE/name,OUT/('before-'+name))
for name in ['fx/foil-pack.webp','fx/foil-tear.webp','cardback/deluxe-back.webp']:
    shutil.copy2(HERE/name,OUT/('before-'+Path(name).name))
rows=[]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for rarity in ['legendary','mythic']:
        p,errs=open_page(b,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size({'width':1440,'height':900})
        start(p,[BY['common']]*2+[BY[rarity]]+[BY['common']]*7)
        advance(p,1750+2*840+(900 if rarity=='legendary' else 1300)+320)
        for t in [100,200,300]:
            advance(p,100)
            for source in ['.ceremony-canvas','.fx-substrate-wave,.fx-spectrum-wave']:
                on,off=pair(p,source)
                box=p.locator('.slot').nth(1).bounding_box();rect=tuple(round(v) for v in [box['x'],box['y'],box['x']+box['width'],box['y']+box['height']])
                row=dict(rarity=rarity,t=t,source=source,neighborMean=ImageStat.Stat(ImageChops.subtract(on,off).crop(rect)).mean)
                p.eval_on_selector_all('.ceremony-canvas','es=>es.forEach(e=>e.style.zIndex=8)')
                raised,base=pair(p,source)
                row['raisedMean']=ImageStat.Stat(ImageChops.subtract(raised,base).crop(rect)).mean
                p.eval_on_selector_all('.ceremony-canvas',"es=>es.forEach(e=>e.style.removeProperty('z-index'))")
                on.save(OUT/f'before-A-{rarity}-{t}-{len(rows)}.png');raised.save(OUT/f'raised-A-{rarity}-{t}-{len(rows)}.png');rows.append(row)
        assert not errs,errs
        p.close()
    p=b.new_page();p.goto((HERE/'deluxe-gacha-b.html').as_uri()+'?ceremony-test')
    p.evaluate('()=>{__ceremony.pull(1)}');p.wait_for_function('__ceremony.state().ids.length===1')
    p.evaluate('()=>{__ceremony.skipAll()}');p.wait_for_function('__ceremony.state().collectable')
    r=p.locator('.reveal-shell').bounding_box();x=r['x']+r['width']*.7;y=r['y']+r['height']*.4
    evidence=p.evaluate('''({x,y})=>{const e=document.querySelector('.reveal-shell'),f=e.querySelector('.hcard');const send=t=>e.dispatchEvent(new PointerEvent(t,{clientX:x,clientY:y}));send('pointermove');send('pointerleave');const before=f.style.getPropertyValue('--phase');send('pointermove');return {complete:__ceremony.state().complete,rafs:__ceremony.state().rafs,before,after:f.style.getPropertyValue('--phase')}}''',dict(x=x,y=y))
    evidence['after300']=p.wait_for_timeout(300) or p.locator('.hcard').evaluate("e=>e.style.getPropertyValue('--phase')")
    (OUT/'before-J.json').write_text(json.dumps(evidence,indent=2))
    print('J',evidence)
    p.screenshot(path=str(OUT/'before-D.png'));b.close()
(OUT/'before-A.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows,indent=2))
