"""Final external FX depth and center check, including two pages and resize."""
import json,shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance,state

rows=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='fx-final-') as tmp:
    browser=pw.chromium.launch()
    copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
    for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
        p,errors=open_page(browser,file.as_uri());p.evaluate('window.__clockRender=false')
        start(p,[BY['legendary']]*10);maximum=0;seen=set()
        for t in range(0,20000,100):
            advance(p,100);p.evaluate('__syncAnimations()')
            if t in [3000,7000]:p.set_viewport_size({'width':1100 if t==3000 else 1280,'height':800 if t==3000 else 900})
            probes=p.evaluate('''()=>[...document.querySelectorAll('.slot.is-revealing')].map(s=>{const c=s.querySelector('.reveal-shell').getBoundingClientRect(),a=s.querySelector('.reveal-anchor').getBoundingClientRect();return {i:s.dataset.i,error:Math.hypot(a.x+a.width/2-c.x-c.width/2,a.y+a.height/2-c.y-c.height/2)/s.offsetWidth,z:getComputedStyle(s.querySelector('.reveal-anchor')).transform}})''')
            for x in probes:
                seen.add(x['i']);maximum=max(maximum,x['error']);assert x['error']<=.05,x
                assert '-200' in x['z'],x
            if state(p)['collectable']:break
        assert len(seen)==10 and state(p)['collectable'] and not errors,(seen,state(p),errors)
        rows.append({'entry':label,'slots':len(seen),'maximum_center_error_fraction':maximum,'external_anchor_z':-200,'resizes':2})
        p.close()
    browser.close()
(OUT/'final-fx-alignment.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(rows)
