"""Round 34: matched pixels, native frame timing, and complete layout evidence."""
from pathlib import Path
from io import BytesIO
import json, sys, shutil
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY, open_page, start, advance
from check_gacha_ceremony_round30 import shot, p95

OUT=HERE.parents[1]/'docs/clicker/shots/round34'
OUT.mkdir(parents=True,exist_ok=True)
SEED='''()=>{let seed=300;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}'''

def capture(p,name):
    im=shot(p);im.save(OUT/(name+'.png'));return np.asarray(im.convert('L'),dtype=float)

def glow(browser,file,label):
    p,errors=open_page(browser,file.as_uri());p.set_viewport_size(dict(width=1440,height=900));p.evaluate(SEED)
    # Hold C's exposure constant when testing A's background-only contribution.
    original=OUT/'source-before/ceremony-fx.js'
    if original.exists():p.add_script_tag(content=original.read_text(encoding='utf-8'))
    capture(p,label+'-idle')
    p.add_style_tag(content='.stage-geometry{visibility:hidden!important}')
    capture(p,label+'-idle-no-geometry');p.locator('style').last.evaluate('e=>e.remove()')
    start(p,[BY['epic']]);advance(p,1300+320+250)
    capture(p,label+'-held')
    rect=p.locator('.hcard').bounding_box()
    p.close()
    reduced,reduce_errors=open_page(browser,file.as_uri(),reduced=True)
    animations=reduced.locator('.stage-background').evaluate('e=>e.getAnimations({subtree:true}).length');reduced.close()
    return dict(rect=rect,errors=errors+reduce_errors,reducedAnimations=animations)

def layouts(browser,file,label):
    rows=[]
    for w,h in [(1440,900),(1024,640),(390,844)]:
      for n in [5,10]:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size(dict(width=w,height=h));p.evaluate('window.__clockRender=false');start(p,[BY['common']]*n)
        p.evaluate('()=>{__ceremony.skipAll()}');advance(p,180)
        rects=p.locator('.slot').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
        faces=p.locator('.slot .hcard').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
        assert all(abs(a[k]-b[k])<.0001 for a,b in zip(rects,faces) for k in a),(rects,faces)
        table=p.evaluate('n=>CeremonyTable.layout(n)',n)
        margins=[min(r['x'] for r in rects),w-max(r['x']+r['w'] for r in rects),min(r['y'] for r in rects),h-max(r['y']+r['h'] for r in rects)]
        gap=rects[1]['x']-rects[0]['x']-rects[0]['w']
        fit=p.locator('.hcard').evaluate_all('es=>es.map(e=>{const a=e.querySelector(".face-name"),r=document.createRange();r.selectNodeContents(a);return {cw:e.clientWidth,name:getComputedStyle(e).getPropertyValue("--name-fs"),textWidth:r.getBoundingClientRect().width,plateWidth:e.querySelector(".face-plate").getBoundingClientRect().width}})')
        rows.append(dict(viewport=[w,h],n=n,table=table,rects=rects,margins=margins,gap=gap,fit=fit,errors=errors))
        capture(p,f'{label}-layout-{w}-{n}');p.close()
    return rows

def light(browser,file,label):
    mask=Image.new('L',(1440,900),0);d=ImageDraw.Draw(mask);d.rectangle((160,160,1279,719),fill=255);d.rectangle((490,110,950,750),fill=0)
    rows=[]
    for rarity in BY:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size(dict(width=1440,height=900));p.evaluate(SEED)
        start(p,[BY[rarity]]);advance(p,1300);base=p95(shot(p),mask)
        advance(p,320+(900 if rarity=='legendary' else 1300 if rarity=='mythic' else 0))
        values=[]
        for t in range(0,4501,50):
            if t:advance(p,50)
            im=shot(p);values.append(dict(ms=t,p95=p95(im,mask)))
            if t==250:im.save(OUT/f'{label}-light-{rarity}.png')
        rows.append(dict(rarity=rarity,baseline=base,peak=max(v['p95'] for v in values if v['ms']<=600),duration=sum(50 for v in values[:-1] if v['p95']>base+40),samples=values,errors=errors))
        (OUT/(label+'-light.json')).write_text(json.dumps(rows,indent=2));print(label,rarity,rows[-1]['peak'],rows[-1]['duration'],flush=True);p.close()
    return rows

def timing(browser,file,label,css='',script=None,warmup=False):
    p=browser.new_page(viewport=dict(width=1440,height=900));p.goto(file.as_uri()+'?ceremony-test');p.evaluate('document.fonts.ready');p.evaluate(SEED)
    if script:p.evaluate(script)
    if css:p.add_style_tag(content=css)
    if warmup:
        p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(10)}',[BY[r] for r in BY]*2)
        p.wait_for_function('__ceremony.state().entryPhase==="waiting"')
        p.evaluate('__ceremony.openPack()');p.wait_for_function('__ceremony.state().collectable',timeout=60000)
        p.evaluate('()=>{__ceremony.reset()}');p.evaluate(SEED)
    p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(10)}',[BY[r] for r in BY]*2)
    p.wait_for_function('__ceremony.state().entryPhase==="waiting"')
    p.evaluate('''()=>{window.intervals=[];let last;window.sample=true;function frame(t){if(last)intervals.push(t-last);last=t;if(sample)requestAnimationFrame(frame)}requestAnimationFrame(frame);__ceremony.openPack()}''')
    p.wait_for_function('__ceremony.state().collectable',timeout=60000)
    values=p.evaluate('()=>{sample=false;return intervals}')
    row=dict(p95=float(np.percentile(values,95)),max=max(values),frames=len(values),over20=sum(v>20 for v in values),elapsed_ms=sum(values),warmup=warmup)
    (OUT/(label+'-frame-intervals.json')).write_text(json.dumps(values))
    p.close();print(label,row,flush=True);return row

def main():
    label=sys.argv[1];groups=sys.argv[2:] or ['glow','layout','light','timing']
    result={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=['--allow-file-access-from-files'])
        file=HERE/'deluxe-gacha-b.html'
        if 'portable' in label:
            file=OUT/'portable/production.html';file.parent.mkdir(exist_ok=True)
            shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',file)
        for group in groups:
            result[group]={'glow':glow,'layout':layouts,'light':light,'timing':timing}[group](browser,file,label)
            (OUT/(label+'.json')).write_text(json.dumps(result,indent=2))
        browser.close()
    return 0

if __name__=='__main__':sys.exit(main())
