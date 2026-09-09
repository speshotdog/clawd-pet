"""Final-built-artifact checks for early cancellation and retained drag state."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json,shutil
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance,state

results=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='edge-portable-') as tmp:
    b=pw.chromium.launch()
    copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
    for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
        p,errors=open_page(b,file.as_uri());p.evaluate('window.__clockRender=false')
        fixture=[BY['common']]+[BY['mythic']]*9
        start(p,fixture);advance(p,2700);print(label,'first card done',flush=True)
        assert p.locator('.slot.done').count()==1
        shell=p.locator('.slot').nth(0).locator('.reveal-shell');box=shell.bounding_box()
        x=box['x']+box['width']/2;y=box['y']+box['height']/2
        p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+60,y);p.mouse.up()
        pose=lambda:p.locator('.slot').nth(0).locator('.hcard').evaluate('e=>getComputedStyle(e).getPropertyValue("--ry")')
        assert pose()!='0deg'
        p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181);assert state(p)['collectable']
        assert pose()=='0deg'
        shell=p.locator('.slot').nth(0).locator('.reveal-shell');box=shell.bounding_box()
        p.mouse.move(box['x']+20,box['y']+60);assert pose()=='0deg'
        p.evaluate('__ceremony.reset()');p.clock.fast_forward(30000)
        assert not any(state(p)[k] for k in ['timers','rafs','anims','voices'])
        assert not errors,errors;p.close();print(label,'drag cleanup passed',flush=True)
        # No fake clock: skip immediately while the native decode promises are pending.
        p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
        p.goto(file.as_uri()+'?ceremony-test')
        p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(10);__ceremony.skipAll()}',fixture)
        p.wait_for_function('__ceremony.state().collectable',timeout=15000)
        assert state(p)['ids']==[c['id'] for c in fixture]
        assert p.evaluate('[...document.querySelectorAll(".slot img")].every(e=>e.complete&&e.naturalWidth>0)')
        assert not errors,errors;p.close()
        results.append({'entry':label,'drag_then_skip':'neutral','early_decode_skip':'complete','errors':errors})
    b.close()
(OUT/'edges.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
