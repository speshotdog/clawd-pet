"""Round 33 acceptance: real Chromium pixels, native input and isolated fixtures."""
from pathlib import Path
from io import BytesIO
import json, math, shutil, sys, hashlib
import numpy as np
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY, start, advance, open_page, state
from check_gacha_ceremony_round30 import shot, nonoverlap
from check_gacha_layers_round31 import pair
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
OUT.mkdir(parents=True,exist_ok=True)
results=[]
def record(name,data,ok=True):
    results.append(dict(check=name,pass_=bool(ok),data=data))
    (OUT/('acceptance-round33'+('-'+'-'.join(a.strip('-') for a in sys.argv[1:]) if len(sys.argv)>1 else '')+'.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(name,'PASS' if ok else 'FAIL',str(data)[:600],flush=True)
def box(p,sel):
    b=p.locator(sel).bounding_box();return (math.ceil(b['x']),math.ceil(b['y']),math.floor(b['x']+b['width']),math.floor(b['y']+b['height']))
def photometry():
    rows=[]
    for file in [OUT/'before-foil-pack.webp',HERE/'fx/foil-pack.webp']:
        a=np.asarray(Image.open(file).convert('L'));v=np.sort(a.ravel());rows.append(dict(top5=float(v[-round(len(v)*.05):].mean()),rms=float(a.std())))
    ratios={k:rows[1][k]/rows[0][k] for k in rows[0]}
    record('H pack highlight and full-image RMS',dict(before=rows[0],after=rows[1],ratios=ratios),.7<=ratios['top5']<=.8 and ratios['rms']>=.9)
    a=np.asarray(Image.open(HERE/'cardback/deluxe-back.webp').convert('RGB'))
    cream=(a[:,:,0]>180)&(a[:,:,1]>175)&(a[:,:,2]>120)
    h,w=cream.shape
    distances=[int(np.where(cream[h//2])[0][0]),int(w-1-np.where(cream[h//2])[0][-1]),int(np.where(cream[:,w//2])[0][0]),int(h-1-np.where(cream[:,w//2])[0][-1])]
    record('F back printed-edge clearance',dict(size=[w,h],pixels=distances),max(distances)<=w*.02 and w/h==5/7)
def variants():
    for suffix in ['', '-standalone']:
        a=(HERE/f'deluxe-gacha-b{suffix}.html').read_text(encoding='utf-8').splitlines();b=(HERE/f'deluxe-gacha-b-test{suffix}.html').read_text(encoding='utf-8').splitlines()
        differences=[dict(line=i+1,production=x,test=y) for i,(x,y) in enumerate(zip(a,b)) if x!=y]
        record('E exact variant diff '+suffix,differences,len(a)==len(b) and len(differences)==2 and all('const RATE=' in d['production'] or 'const ticketPolicy=' in d['production'] for d in differences))
    frozen=json.loads((OUT/'frozen-before.json').read_text());changed=[p for p,h in frozen.items() if hashlib.sha256((HERE.parents[1]/p).read_bytes()).hexdigest()!=h]
    record('frozen sources',changed,not changed)
def background(browser,file,label):
    p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':1440,'height':900})
    p.evaluate('''()=>{window.calls=0;const r=requestAnimationFrame;window.requestAnimationFrame=f=>{calls++;return r(f)};
    window.bg=document.querySelector('.stage-background');window.ba=bg.getAnimations({subtree:true});ba.forEach(a=>{a.pause();a.currentTime=0})}''')
    advance(p,3000);record(label+' C idle rAF',p.evaluate('calls'),p.evaluate('calls')==0)
    count=p.evaluate('ba.length');changed=0;seams=[]
    for i in range(count):
        meta=p.evaluate('i=>{const a=ba[i];ba.forEach(a=>a.currentTime=0);return {name:a.animationName,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay}}',i)
        # The pack covers the central star at idle. Isolate that element's pixels
        # instead of accepting a vacuous comparison of an occluded animation.
        meta['packHiddenForIsolation']=meta['name']=='star-pulse'
        if meta['packHiddenForIsolation']:p.locator('#entry-pack').evaluate("e=>e.style.visibility='hidden'")
        before=shot(p)
        p.evaluate('i=>ba[i].currentTime=ba[i].effect.getTiming().delay+2*ba[i].effect.getTiming().duration',i)
        # Compare equivalent local endpoints, accounting for staggered ripple delays.
        end=shot(p)
        p.evaluate('i=>ba[i].currentTime=ba[i].effect.getTiming().delay+ba[i].effect.getTiming().duration',i);first=shot(p)
        seam=ImageChops.difference(first,end).getbbox()
        p.evaluate('i=>ba[i].currentTime=ba[i].effect.getTiming().delay+ba[i].effect.getTiming().duration+Math.min(9000,ba[i].effect.getTiming().duration*.4)',i)
        middle=shot(p);delta=ImageChops.difference(first,middle).getbbox();changed+=bool(delta)
        first.save(OUT/f'{label}-C-{i}-first.png');middle.save(OUT/f'{label}-C-{i}-middle.png');end.save(OUT/f'{label}-C-{i}-end.png')
        seams.append(dict(**meta,seam=seam,motion=delta))
        if meta['packHiddenForIsolation']:p.locator('#entry-pack').evaluate("e=>e.style.removeProperty('visibility')")
    record(label+' C seamless independent animations',dict(elements=seams,moving=changed),all(x['seam'] is None for x in seams) and changed>=6)
    p.evaluate("document.querySelector('#win').classList.add('background-paused')")
    paused=p.locator('.stage-background').evaluate("e=>e.getAnimations({subtree:true}).every(a=>a.playState==='paused')");record(label+' C paused',paused,paused)
    p.close();p,errors=open_page(browser,file.as_uri(),reduced=True)
    record(label+' C reduced animation count',p.locator('.stage-background').evaluate('e=>e.getAnimations({subtree:true}).length'),p.locator('.stage-background').evaluate('e=>e.getAnimations({subtree:true}).length')==0);p.close()
def transition(browser,file,label):
    for reduced in [False,True]:
        p,errors=open_page(browser,file.as_uri(),reduced=reduced)
        p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(10)}',[BY['common']]*10)
        p.evaluate('async()=>await __ceremony.ready()')
        if not reduced:
            advance(p,219);a=state(p);advance(p,1);b=state(p);advance(p,379);c=state(p);advance(p,1)
            record(label+' G transition durations',[a['entryPhase'],b['entryPhase'],c['entryPhase'],state(p)['entryPhase']],a['entryPhase']=='controls' and b['entryPhase']==c['entryPhase']=='push' and state(p)['entryPhase']=='waiting')
        else:advance(p,1)
        p.wait_for_function('__ceremony.state().entryPhase==="waiting"',polling=10)
        before=state(p);advance(p,5000);after=state(p)
        record(label+' G indefinite wait '+str(reduced),dict(before=before,after=after),before==after and after['complete']==0 and not any(after[k] for k in ['timers','rafs','voices']))
        p.screenshot(path=str(OUT/f'{label}-G-wait-{reduced}.png'))
        p.evaluate("()=>{for(let i=0;i<5;i++)document.querySelector('#entry-pack').click()}");advance(p,200)
        ev=p.evaluate('__ceremony.events');record(label+' G one open '+str(reduced),ev,sum(e['type']=='pack-open' for e in ev)==1 and len(state(p)['ids'])==10)
        p.close()
    for action in ['Escape','skip']:
        p,errors=open_page(browser,file.as_uri());start(p,[BY['common']]*10,open_pack=False)
        if action=='Escape':p.keyboard.press('Escape')
        else:p.evaluate('()=>{__ceremony.skipAll()}')
        advance(p,180);s=state(p);record(label+' G wait cancel '+action,s,s['collectable'] and not any(s[k] for k in ['anims','timers','rafs','voices']));p.close()
def charge(browser,file,label):
    for rarity,duration,target in [('legendary',900,1.45),('mythic',1300,1.6)]:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':1440,'height':900});start(p,[BY[rarity]]);advance(p,1300)
        # Remove translation-only shake from both images; sample the same printed pixels.
        p.add_style_tag(content='.reveal-shell{transform:none!important}')
        before=shot(p);rect=box(p,'.veilback');a=np.asarray(before.crop(rect).convert('L'))
        advance(p,duration-(160 if rarity=='mythic' else 120));after=shot(p);b=np.asarray(after.crop(rect).convert('L'))
        before.save(OUT/f'{label}-B-{rarity}-start.png');after.save(OUT/f'{label}-B-{rarity}-peak.png')
        row=dict(mean_start=float(a.mean()),mean_peak=float(b.mean()),std_start=float(a.std()),std_peak=float(b.std()))
        record(label+' B '+rarity,row,b.mean()>=a.mean()*target and b.std()>=a.std()*.4)
        p.evaluate('()=>{__ceremony.skipAll()}');advance(p,180);s=state(p);record(label+' B cleanup '+rarity,s,s['collectable'] and p.locator('.rarity-fx').count()==0 and not any(s[k] for k in ['anims','timers','rafs','voices']));p.close()
def layers(browser,file,label):
    for w,h in [(1440,900),(1024,640),(390,844)]:
      for rarity in ['legendary','mythic']:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':w,'height':h});p.evaluate('window.__clockRender=false');p.add_style_tag(content='.reveal-shell{transition:none!important}')
        start(p,[BY['common']]*2+[BY[rarity]]+[BY['common']]*7)
        advance(p,1750+1680+(900 if rarity=='legendary' else 1300)+320)
        rows=[]
        for t in range(50,501,50):
            advance(p,50)
            p.eval_on_selector_all('.slot:not(.is-revealing)',"es=>es.forEach(e=>e.classList.add('selected'))")
            on,off=pair(p,'.ceremony-canvas:not(.over),.ceremony-flash')
            active=box(p,'.slot[data-i="2"] .hcard');d=ImageChops.difference(on,off).crop(active)
            neighbors=[]
            for index in [0,1,3,4]:
                r=box(p,f'.slot[data-i="{index}"] .hcard');neighbors.append(float(np.asarray(ImageChops.subtract(on,off).crop(r)).mean()))
            wave,base=pair(p,'.shockwave,.ceremony-canvas.over');delta=np.asarray(ImageChops.subtract(wave.convert('L'),base.convert('L')))
            wave.save(OUT/f'{label}-A-{w}-{rarity}-{t}.png')
            # Isolated reference wave at exactly the same frame; each angular bin
            # intersecting a neighboring card must retain some positive photons.
            p.eval_on_selector_all('.reveal-shell',"es=>es.forEach(e=>e.style.display='none')")
            ref,refbase=pair(p,'.shockwave,.ceremony-canvas.over');reference=np.asarray(ImageChops.subtract(ref.convert('L'),refbase.convert('L')))
            p.eval_on_selector_all('.reveal-shell',"es=>es.forEach(e=>e.style.removeProperty('display'))")
            cx=(active[0]+active[2])/2;cy=(active[1]+active[3])/2;bins=set();seen=set()
            if w>600:
                for index in [0,1,3,4]:
                    x1,y1,x2,y2=box(p,f'.slot[data-i="{index}"] .hcard');x1=max(0,x1);x2=min(w,x2);y1=max(0,y1);y2=min(h,y2)
                    yy,xx=np.where(reference[y1:y2,x1:x2]>5);xx+=x1;yy+=y1
                    angles=((np.arctan2(yy-cy,xx-cx)+math.pi)*36/(2*math.pi)).astype(int)
                    bins.update(angles.tolist());seen.update(angles[delta[yy,xx]>1].tolist())
            contrasts=[]
            for index in ([0,1,2] if w>600 else [2]):
              for sel in ['.face-name','.face-rarity']:
                r=box(p,f'.slot[data-i="{index}"] '+sel);a=np.asarray(base.crop(r).convert('L'));b=np.asarray(wave.crop(r).convert('L'))
                if a.std()>1:contrasts.append(float(b.std()/a.std()))
            order=p.locator('.slot').evaluate_all('es=>es.map(e=>Number(getComputedStyle(e).zIndex))')
            owner_above=all(order[2]>z for i,z in enumerate(order) if i!=2)
            rows.append(dict(t=t,activeMax=max(v[1] for v in d.getextrema()),neighborLight=max(neighbors),bins=len(bins),missing=sorted(bins-seen),contrast=min(contrasts,default=1),ownerAboveNeighbors=owner_above))
        record(label+f' A four planes {w} {rarity}',rows,all(r['activeMax']==0 and not r['missing'] and r['contrast']>=.7 and r['ownerAboveNeighbors'] for r in rows) and (w<=600 or any(r['bins'] and r['neighborLight']>0 for r in rows)))
        assert not errors,errors;p.close()
def layout_ui(browser,file,label):
    p,errors=open_page(browser,file.as_uri());p.screenshot(path=str(OUT/f'{label}-D-entry.png'))
    buttons=p.locator('.pull-actions button').evaluate_all("es=>es.map(e=>({clip:getComputedStyle(e).clipPath,radius:getComputedStyle(e).borderRadius,lines:e.children.length}))")
    p.locator('#p1').focus();record(label+' D buttons',buttons,all('polygon' in b['clip'] and b['radius']=='0px' and b['lines']==2 for b in buttons) and p.locator('#p1').evaluate('e=>e===document.activeElement'));p.close()
    for w,h in [(1440,900),(1024,640),(390,844)]:
      for n in [1,5,10]:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':w,'height':h});start(p,[BY['common']]*n);p.evaluate('()=>{__ceremony.skipAll()}');advance(p,180)
        rects=p.locator('.slot').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})');nonoverlap(rects)
        left=min(r['x'] for r in rects);right=w-max(r['x']+r['w'] for r in rects);top=min(r['y'] for r in rects);bottom=h-max(r['y']+r['h'] for r in rects)
        row=dict(rects=rects,margins=[left,right,top,bottom]);ok=all(r['w']>=(260 if w<=600 else 190) for r in rects)
        if w==1440:ok &= (360<=rects[0]['w']<=390 if n==1 else 200<=rects[0]['w']<=215 if n==5 else 190<=rects[0]['w']<=205) and min(left,right)>=140 and (n!=10 or min(top,bottom)>=70)
        if 600<w<1440 and n>1:ok &= min(left,right)>=140*min(w/1440,h/900)
        for a,b in zip(rects,rects[1:]):
            if a['y']==b['y']:ok &= b['x']-a['x']-a['w']>=7.99
        record(label+f' I {w} {n}',row,ok);p.screenshot(path=str(OUT/f'{label}-I-{w}-{n}.png'));p.close()
def endurance(browser,file):
    p,errors=open_page(browser,file.as_uri(),reduced=True);seen=set()
    for i in range(200):
        p.locator('#p10').evaluate('e=>e.click()');p.evaluate('async()=>await __ceremony.ready()');advance(p,1)
        p.evaluate('__ceremony.openPack()');advance(p,180)
        if not state(p)['collectable']:advance(p,1)
        ids=state(p)['ids'];seen.update(p.evaluate("JSON.parse(document.querySelector('#pool-data').textContent).filter(c=>__ceremony.state().ids.includes(c.id)).map(c=>c.rarity)"))
        assert len(ids)==10 and state(p)['collectable'],(i,state(p))
        p.locator('#finish').evaluate('e=>e.click()');advance(p,220)
    p.screenshot(path=str(OUT/'E-test-entry.png'))
    record('E 200 ten-pulls',dict(rarities=sorted(seen),errors=errors,ticket=p.locator('#ticket').inner_text()),len(seen)==5 and not errors and p.locator('#ticket').inner_text()=='∞');p.close()
def main():
    if '--self-test' in sys.argv:
        assert ImageChops.difference(Image.new('RGB',(10,10)),Image.new('RGB',(10,10))).getbbox() is None
        nonoverlap([dict(x=0,y=0,w=10,h=10),dict(x=18,y=0,w=10,h=10)])
        print('pixel identity and disjoint-rect calibration passed');return 0
    groups=sys.argv[1:] or ['--assets','--background','--transition','--charge','--layers','--layout','--endurance']
    if '--assets' in groups:photometry();variants()
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        portable=OUT/'portable';portable.mkdir(exist_ok=True)
        shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',portable/'production.html');shutil.copy2(HERE/'deluxe-gacha-b-test-standalone.html',portable/'test.html')
        for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable/'production.html')]:
            for flag,fn in [('--background',background),('--transition',transition),('--charge',charge),('--layers',layers),('--layout',layout_ui)]:
                if flag in groups:
                    try:fn(browser,file,label)
                    except Exception as e:record(label+' '+flag,repr(e),False)
        if '--endurance' in groups:endurance(browser,portable/'test.html')
        browser.close()
    return int(any(not r['pass_'] for r in results))
if __name__=='__main__':sys.exit(main())
