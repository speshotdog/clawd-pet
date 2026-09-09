"""Evenly spaced snapshots of the independently animated CSS geometry."""
import json
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,open_page
from check_gacha_ceremony_round30 import shot
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for w,h in [(1440,900),(1024,640),(390,844)]:
    p,errors=open_page(b,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size({'width':w,'height':h})
    p.evaluate("window.backgroundAnimations=document.querySelector('.stage-background').getAnimations({subtree:true});backgroundAnimations.forEach(a=>a.pause())")
    for t in range(0,10001,2000):
        p.evaluate('t=>backgroundAnimations.forEach(a=>a.currentTime=t)',t)
        shot(p).save(OUT/f'C-background-{w}-{t:05}.png')
        rows.append(dict(width=w,t=t,elements=p.evaluate("backgroundAnimations.map(a=>({name:a.animationName,time:a.currentTime,transform:getComputedStyle(a.effect.target).transform,rotate:getComputedStyle(a.effect.target).rotate,translate:getComputedStyle(a.effect.target).translate,offset:getComputedStyle(a.effect.target).strokeDashoffset}))")))
    assert not errors,errors;p.close()
 b.close()
(OUT/'C-equal-interval-samples.json').write_text(json.dumps(rows,indent=2));print('18 equally spaced background frames; zero page errors')
