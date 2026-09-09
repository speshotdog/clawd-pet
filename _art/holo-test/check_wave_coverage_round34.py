"""Diagnose the retained unseeded zero-reference-bin failure at 1440 legendary."""
import json,math
import numpy as np
from PIL import ImageChops
from playwright.sync_api import sync_playwright
from check_gacha_round34 import HERE,OUT,SEED
from check_gacha_ceremony_round28 import BY,open_page,start,advance
from check_gacha_layers_round31 import pair
from check_gacha_layers_round33 import box

with sync_playwright() as pw:
    browser=pw.chromium.launch();rows=[]
    for label in ['before','after']:
        p,errors=open_page(browser,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size(dict(width=1440,height=900));p.evaluate(SEED);p.evaluate('window.__clockRender=false')
        if label=='before':
            for name in ['ceremony-layout.js','ceremony-fx.js']:p.add_script_tag(content=(OUT/'source-before'/name).read_text(encoding='utf-8'))
            p.locator('.stage-geometry').evaluate('(e,svg)=>e.innerHTML=svg',(OUT/'source-before/ceremony-background.svg').read_text(encoding='utf-8'))
            p.add_style_tag(content=(OUT/'source-before/ceremony.css').read_text(encoding='utf-8'))
            p.evaluate("document.querySelectorAll('.stage-background *').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0}))")
        p.add_style_tag(content='.reveal-shell{transition:none!important}')
        start(p,[BY['common']]*2+[BY['legendary']]+[BY['common']]*7);advance(p,1750+1680+900+320)
        samples=[]
        for t in range(50,501,50):
            advance(p,50);p.eval_on_selector_all('.slot:not(.is-revealing)',"es=>es.forEach(e=>e.classList.add('selected'))")
            wave,base=pair(p,'.shockwave,.ceremony-canvas.over');delta=np.asarray(ImageChops.subtract(wave.convert('L'),base.convert('L')))
            active=box(p,'.slot[data-i="2"] .hcard');cx=(active[0]+active[2])/2;cy=(active[1]+active[3])/2
            p.eval_on_selector_all('.reveal-shell',"es=>es.forEach(e=>e.style.display='none')")
            ref,off=pair(p,'.shockwave,.ceremony-canvas.over');reference=np.asarray(ImageChops.subtract(ref.convert('L'),off.convert('L')))
            p.eval_on_selector_all('.reveal-shell',"es=>es.forEach(e=>e.style.removeProperty('display'))")
            bins=set();seen=set()
            for index in [0,1,3,4]:
                x1,y1,x2,y2=box(p,f'.slot[data-i="{index}"] .hcard')
                yy,xx=np.where(reference[y1:y2,x1:x2]>5);xx+=x1;yy+=y1
                angles=((np.arctan2(yy-cy,xx-cx)+math.pi)*36/(2*math.pi)).astype(int)
                bins.update(angles.tolist());seen.update(angles[delta[yy,xx]>1].tolist())
            samples.append(dict(t=t,bins=len(bins),missing=sorted(bins-seen)))
            if t==150:wave.save(OUT/f'coverage-{label}-150.png');ref.save(OUT/f'coverage-{label}-reference-150.png')
        rows.append(dict(label=label,seed=300,samples=samples,errors=errors));p.close()
    browser.close()
(OUT/'wave-coverage-diagnosis.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
assert rows[0]['samples']==rows[1]['samples'],rows
