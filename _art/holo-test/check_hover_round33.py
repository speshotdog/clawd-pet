from pathlib import Path
from io import BytesIO
import json, shutil
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',OUT/'portable/production.html')]:
    p=b.new_page(viewport={'width':1440,'height':900});p.goto(file.as_uri()+'?ceremony-test')
    p.evaluate('f=>{window.__ceremonyFixture=[f];__ceremony.pull(1)}',BY['mythic']);p.evaluate('async()=>await __ceremony.ready()');p.evaluate('()=>{__ceremony.skipAll()}');p.wait_for_function('__ceremony.state().collectable')
    shell=p.locator('.reveal-shell');r=shell.bounding_box();cx=r['x']+r['width']/2;cy=r['y']+r['height']/2
    p.mouse.move(1,1);p.wait_for_timeout(350)
    p.evaluate("document.querySelector('.stage-background').getAnimations({subtree:true}).forEach(a=>a.pause())")
    neutral=p.locator('.hcard').evaluate("e=>e.style.getPropertyValue('--phase')")
    p.mouse.move(cx,cy);p.wait_for_timeout(300);center=p.locator('.hcard').evaluate("e=>e.style.getPropertyValue('--phase')")
    p.mouse.move(1,1);p.wait_for_timeout(350);before=Image.open(BytesIO(p.screenshot())).convert('RGB')
    state=p.evaluate('''({cx,cy})=>{const e=document.querySelector('.reveal-shell'),c=e.querySelector('.hcard');
    const send=(type,x,y)=>e.dispatchEvent(new PointerEvent(type,{clientX:x,clientY:y}));
    send('pointermove',cx+50,cy-50);send('pointerleave',0,0);const running=__ceremony.state().rafs;
    send('pointerenter',cx+70,cy-40);send('pointermove',cx+70,cy-40);
    return {complete:__ceremony.state().complete,running,afterMove:__ceremony.state().rafs,phase:c.style.getPropertyValue('--phase')}}''',dict(cx=cx,cy=cy))
    p.wait_for_timeout(300);after=Image.open(BytesIO(p.screenshot())).convert('RGB');state['phase300']=p.locator('.hcard').evaluate("e=>e.style.getPropertyValue('--phase')")
    delta=ImageChops.difference(before,after).getbbox();state.update(neutral=neutral,center=center,pixel_bbox=delta)
    assert state['running']==1 and state['afterMove']==0 and state['phase']==state['phase300'] and delta,state
    before.save(OUT/f'{label}-J-neutral.png');after.save(OUT/f'{label}-J-interrupted-hover.png');rows.append(dict(label=label,**state));p.close()
 b.close()
(OUT/'J-hover-evidence.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
