"""Additional A check: isolate the entire background, excluding foreground pixels."""
import json
import numpy as np
from playwright.sync_api import sync_playwright
from check_gacha_round34 import HERE,OUT,capture
from check_gacha_ceremony_round28 import open_page

with sync_playwright() as pw:
    browser=pw.chromium.launch();rows=[]
    for label in ['before','after']:
        p,errors=open_page(browser,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size(dict(width=1440,height=900))
        if label=='before':p.locator('.stage-geometry').evaluate('(e,svg)=>e.innerHTML=svg',(OUT/'source-before/ceremony-background.svg').read_text(encoding='utf-8'))
        p.add_style_tag(content='.win>:not(.stage-background){display:none!important}')
        p.evaluate("document.querySelectorAll('.stage-background *').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0}))")
        im=capture(p,label+'-background-isolated');rows.append(dict(label=label,mean=float(im.mean()),errors=errors));p.close()
    browser.close()
result=dict(rows=rows,ratio=rows[1]['mean']/rows[0]['mean'])
(OUT/'background-isolated.json').write_text(json.dumps(result,indent=2));print(result)
