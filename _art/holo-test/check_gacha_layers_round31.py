"""Round 31 pixel evidence. Uses the established real Chromium/WAAPI clock."""
from pathlib import Path
from io import BytesIO
import json, sys, shutil, math
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY, CARDS, open_page, start, advance, state
from check_gacha_ceremony_round30 import shot, p95, nonoverlap

OUT=HERE.parent.parent/'docs/clicker/shots/round32/retained'
OUT.mkdir(parents=True,exist_ok=True)

def save(name,data):
    (OUT/name).write_text(json.dumps(data,indent=2),encoding='utf-8')

def rect(p):
    b=p.locator('.hcard').first.bounding_box()
    return (math.ceil(b['x']),math.ceil(b['y']),math.floor(b['x']+b['width']),math.floor(b['y']+b['height']))

def pair(p,selector):
    a=shot(p)
    p.eval_on_selector_all(selector,"es=>es.forEach(e=>e.style.visibility='hidden')")
    b=shot(p)
    p.eval_on_selector_all(selector,"es=>es.forEach(e=>e.style.removeProperty('visibility'))")
    return a,b

def reproduce(browser):
    rows=[]
    for rarity in ['legendary','mythic']:
        p,errors=open_page(browser,(HERE/'baseline-round31.html').as_uri())
        p.set_viewport_size({'width':1440,'height':900})
        start(p,[BY[rarity]]);advance(p,1620)
        for t in range(0,2501,50):
            if t:advance(p,50)
            if t<200:continue
            whole=rect(p);box=(whole[0]+3,whole[1]+3,whole[2]-3,whole[3]-3)
            a,b=pair(p,'.ceremony-canvas')
            diff=ImageChops.difference(a,b).crop(box)
            row={'rarity':rarity,'ms_after_F':t,'bbox':diff.getbbox(),'mean':ImageStat.Stat(diff).mean,
                 'revealing':p.locator('.is-revealing').count()}
            if diff.getbbox() and not row['revealing'] and not any(r['rarity']==rarity and r.get('diagnosis') for r in rows):
                a.save(OUT/f'before-A-{rarity}.png');b.save(OUT/f'before-A-{rarity}-canvas-off.png')
                p.eval_on_selector('.ceremony-canvas:not(.under)',"e=>e.style.zIndex='1'")
                c,d=pair(p,'.ceremony-canvas')
                row['lower_upper_bbox']=ImageChops.difference(c,d).crop(box).getbbox()
                row['diagnosis']='Only upper z-index changed 4 → 1'
                p.eval_on_selector('.ceremony-canvas:not(.under)',"e=>e.style.removeProperty('z-index')")
            rows.append(row)
        assert not errors,errors;p.close()
    save('before-A-measurements.json',rows)
    assert any(r['bbox'] and not r['revealing'] for r in rows)
    assert all(r['lower_upper_bbox'] is None for r in rows if 'diagnosis' in r)
    print('reproduction confirmed; upper-only lowering control passes',flush=True)

def layers(browser,file,label):
    rows=[]
    for rarity in ['legendary','mythic']:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':1440,'height':900})
        p.evaluate('()=>{let seed=300;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}')
        start(p,[BY[rarity]]);advance(p,1300+(900 if rarity=='legendary' else 1300)+320)
        mask=Image.new('L',(1440,900),0)
        from PIL import ImageDraw
        d=ImageDraw.Draw(mask);d.rectangle((160,160,1279,719),fill=255);d.rectangle((490,110,950,750),fill=0)
        samples=[]
        for t in range(0,4501,50):
            if t:advance(p,50)
            if t==2500:
                p.locator('.slot').evaluate("e=>e.classList.add('selected')")
                p.mouse.move(720,400)
            if t==3000:
                p.locator('.slot').evaluate("e=>e.classList.remove('selected')")
                p.mouse.move(1,1)
            a,b=pair(p,'.ceremony-canvas,.ceremony-flash');box=rect(p)
            diff=ImageChops.difference(a,b).crop(box)
            # Include every whole pixel in the card rect, including curved corners.
            peak=max(v[1] for v in diff.getextrema())
            row={'t':t,'max_difference':peak,'bbox':diff.getbbox(),'p95':p95(a,mask),'base':p95(b,mask),
                 'revealing':bool(p.locator('.is-revealing').count())}
            samples.append(row)
            if t in [200,1300,2500]:a.save(OUT/f'{label}-after-A-{rarity}-{t}.png');b.save(OUT/f'{label}-after-A-{rarity}-{t}-off.png')
            save(f'{label}-A-{rarity}.json',samples)
            assert peak<=1,(label,rarity,row)
            if t>=4100 and not p.locator('.ceremony-canvas').count():break
        peak=max(r['p95'] for r in samples if r['t']<=600)
        duration=sum(50 for r in samples if r['p95']>r['base']+40)
        assert peak>=(223 if rarity=='legendary' else 255),(rarity,peak)
        assert duration>=(1600 if rarity=='legendary' else 1950),(rarity,duration)
        rows.append({'rarity':rarity,'peak':peak,'duration':duration,'samples':len(samples)})
        assert not errors,errors;p.close();print('A-pass',label,rows[-1],flush=True)
    save(f'{label}-A-summary.json',rows)

def waves(browser,file,label):
    rows=[]
    for rarity,name,offset in [('legendary','fx-substrate-wave',100),('mythic','fx-spectrum-wave',120)]:
        geometry=[]
        for tag,path,F in [('before',HERE/'baseline-round31.html',1620),('after',file,1620+(900 if rarity=='legendary' else 1300))]:
            p,errors=open_page(browser,path.as_uri());p.set_viewport_size({'width':1440,'height':900})
            start(p,[BY[rarity]]);advance(p,F+offset)
            selector='.'+name;a,b=pair(p,selector);a.save(OUT/f'{label}-{tag}-B-{rarity}.png');b.save(OUT/f'{label}-{tag}-B-{rarity}-off.png')
            visible=ImageChops.subtract(a.convert('L'),b.convert('L'));card=rect(p)
            p.eval_on_selector_all('.reveal-shell,.ceremony-canvas,.ceremony-flash',"es=>es.forEach(e=>e.style.display='none')")
            clean,off=pair(p,selector);delta=ImageChops.difference(clean,off).convert('L')
            bbox=delta.point(lambda v:255 if v>2 else 0).getbbox();assert bbox
            cx=(bbox[0]+bbox[2]-1)/2;cy=(bbox[1]+bbox[3]-1)/2
            radius=(bbox[2]-bbox[0])/2
            # Right-hand cross-section measures the rasterized band, not CSS width.
            lit=[x for x in range(round(cx),bbox[2]) if delta.getpixel((x,round(cy)))>2]
            thickness=max(lit)-min(lit)+1 if lit else 0
            geometry.append({'tag':tag,'bbox':bbox,'diameter':bbox[2]-bbox[0],'line':thickness})
            if tag=='after':
                overlap=visible.crop(card).point(lambda v:255 if v>2 else 0).getbbox();assert overlap,(rarity,'ring not visible over card')
                # For every angular bin with visible reference ring pixels on the card,
                # require at least one changed pixel in the same bin on the real card.
                bins=set();seen=set()
                for y in range(max(0,card[1]),min(900,card[3])):
                    for x in range(max(0,card[0]),min(1440,card[2])):
                        if delta.getpixel((x,y))>8:
                            bin=int((math.atan2(y-cy,x-cx)+math.pi)*36/(2*math.pi))
                            bins.add(bin)
                            if visible.getpixel((x,y))>2:seen.add(bin)
                assert bins and seen==bins,(rarity,bins-seen)
                z=p.locator('.rarity-fx,.reveal-anchor,.hcard *').evaluate_all("es=>es.map(e=>({name:e.className,z:new DOMMatrix(getComputedStyle(e).transform).m43})).filter(x=>Math.abs(x.z)>42.01)")
                assert not z,z
            assert not errors,errors;p.close()
        assert abs(geometry[0]['diameter']-geometry[1]['diameter'])<=2,geometry
        assert abs(geometry[0]['line']-geometry[1]['line'])<=2,geometry
        rows.append({'rarity':rarity,'geometry':geometry});print('B-pass',label,rows[-1],flush=True)
    save(f'{label}-B.json',rows)

def interaction(browser,file,label):
    # Native time here: CSS hover transitions are not owned by the WAAPI clock shim.
    p=browser.new_page(viewport={'width':1280,'height':900});errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(file.as_uri()+'?ceremony-test');p.evaluate('document.fonts.ready')
    p.evaluate('window.__syncAnimations=()=>{}')
    start(p,[next(c for c in CARDS if c['id']=='foxfriend')]);p.evaluate('()=>{__ceremony.skipAll()}')
    p.wait_for_function('__ceremony.state().collectable')
    shell=p.locator('.reveal-shell');b=shell.bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
    p.mouse.move(x,y);p.mouse.down();p.mouse.up();p.mouse.move(1,1);p.wait_for_timeout(400)
    box=rect(p);before=shot(p).crop(box);before.save(OUT/f'{label}-C-before.png')
    p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+90,y+90);shot(p).save(OUT/f'{label}-C-drag.png');p.mouse.up();p.mouse.move(1,1);p.wait_for_timeout(400)
    after=shot(p).crop(box);after.save(OUT/f'{label}-C-after.png')
    bbox=ImageChops.difference(before,after).getbbox()
    blue=sum(1 for r,g,b in after.get_flattened_data() if b>120 and b>r+40 and b>g+20)/(after.width*after.height)
    ranges=p.evaluate('getSelection().rangeCount')
    row={'bbox':bbox,'selection_ranges':ranges,'blue_ratio':blue}
    save(f'{label}-C.json',row);assert bbox is None,row;assert ranges==0 and blue<=.01,row
    angles=lambda:p.locator('.hcard').evaluate("e=>['--rx','--ry'].map(k=>parseFloat(e.style.getPropertyValue(k)))")
    p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+90,y+90);p.mouse.up();p.wait_for_timeout(200)
    # Capture and dispatch atomically so no native rAF can fall between observations.
    a,b=p.evaluate("({x,y})=>{const e=document.querySelector('.reveal-shell'),c=e.querySelector('.hcard'),read=()=>['--rx','--ry'].map(k=>parseFloat(c.style.getPropertyValue(k)));const a=read();e.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,clientX:x+90,clientY:y+90}));return [a,read()]}",{'x':x,'y':y})
    p.mouse.move(x+100,y+100);c=angles()
    assert a==b and abs(c[0]-(b[0]-2))<.01 and abs(c[1]-(b[1]+2))<.01,(a,b,c)
    shell.dispatch_event('pointerup');p.wait_for_timeout(400)
    for event in ['pointercancel','pointerleave']:
        p.mouse.down();p.mouse.move(x+120,y+120);shell.dispatch_event(event);p.wait_for_timeout(400);assert angles()==[0,0]
        p.mouse.up()
    row['interrupt_angles']=[a,b,c];save(f'{label}-C.json',row)
    assert not errors,errors;p.close();print('C-pass',label,row,flush=True)

def charge_background(browser,file,label):
    rows=[]
    for w,h in [(1440,900),(1024,640),(390,844)]:
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':w,'height':h})
        p.evaluate('()=>{window.__rafCalls=0;const r=requestAnimationFrame;window.requestAnimationFrame=f=>{__rafCalls++;return r(f)}}')
        advance(p,3000);assert p.evaluate('__rafCalls')==0
        orbit=p.locator('.summon-orbit').bounding_box()
        assert orbit['x']>=0 and orbit['x']+orbit['width']<=w and orbit['y']>=0 and orbit['y']+orbit['height']<=h,orbit
        shot(p).save(OUT/f'{label}-E-{w}.png')
        for rarity,duration in [('legendary',900),('mythic',1300)]:
            start(p,[BY[rarity]]+[BY['common']]*9);advance(p,1750)
            for t in range(0,duration+321,16):
                if t:advance(p,16)
                p.evaluate('__syncAnimations()')
                boxes=p.locator('.slot').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
                nonoverlap(boxes)
                nonoverlap(p.locator('.reveal-shell').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})'))
                if t in [0,400,800,1200]:shot(p).save(OUT/f'{label}-D-{rarity}-{w}-{t}.png')
            advance(p,50)
            ev=p.evaluate('__ceremony.events');charge=next(e for e in ev if e.get('phase')=='charge');face=next(e for e in ev if e['type']=='face-visible')
            assert face['time']-charge['time']>=duration+320
            rows.append({'size':[w,h],'rarity':rarity,'charge_to_F':face['time']-charge['time']})
            for method in ['skip','Escape']:
                start(p,[BY[rarity]]+[BY['common']]*9);advance(p,1750+400)
                if method=='skip':p.evaluate('()=>{__ceremony.skipAll()}')
                else:p.keyboard.press('Escape')
                advance(p,181);s=state(p)
                assert s['collectable'] and not any(s[k] for k in ['anims','timers','rafs','voices']),s
                assert p.locator('.rarity-fx').count()==0
        assert not errors,errors;p.close()
    p,errors=open_page(browser,file.as_uri(),reduced=True)
    assert p.locator('.stage-background').evaluate('e=>e.getAnimations({subtree:true}).length')==0
    assert not errors,errors;p.close()
    assert (HERE/'deluxe-gacha-b-standalone.html').stat().st_size-5146465<=900000
    save(f'{label}-DE.json',rows);print('D/E-pass',label,flush=True)

def native_charge(browser,file,label):
    rows=[]
    for rarity,duration in [('legendary',900),('mythic',1300)]:
        for method in ['skip','Escape','finish-charge']:
            p=browser.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
            p.goto(file.as_uri()+'?ceremony-test');p.click('#sound')
            start(p,[BY[rarity]])
            p.wait_for_function("__ceremony.events.some(e=>e.phase==='charge')")
            p.wait_for_timeout(300)
            assert state(p)['voices']>0
            if method=='finish-charge':
                p.wait_for_function("__ceremony.events.some(e=>e.type==='face-visible')")
                delta=p.evaluate("__ceremony.events.find(e=>e.type==='face-visible').time-__ceremony.events.find(e=>e.phase==='charge').time")
                assert delta>=duration+320,(rarity,delta)
                p.evaluate('()=>{__ceremony.skipAll()}')
            elif method=='skip':p.evaluate('()=>{__ceremony.skipAll()}')
            else:p.keyboard.press('Escape')
            p.wait_for_timeout(181);s=state(p)
            assert s['collectable'] and not any(s[k] for k in ['anims','timers','rafs','voices']),s
            assert not p.locator('.rarity-fx').count()
            rows.append({'rarity':rarity,'method':method,'charge_to_F_ms':delta if method=='finish-charge' else None,'after':s})
            assert not errors,errors;p.close()
    save(f'{label}-native-charge.json',rows);print('native-charge-pass',label,flush=True)

if __name__=='__main__':
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        if '--reproduce' in sys.argv:reproduce(browser)
        else:
            portable=OUT/'portable'/'index.html';portable.parent.mkdir(exist_ok=True);shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',portable)
            for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable)]:
                for option,fn in [('--a',layers),('--b',waves),('--c',interaction),('--de',charge_background),('--native',native_charge)]:
                    if len(sys.argv)==1 or option in sys.argv:fn(browser,file,label)
        browser.close()
