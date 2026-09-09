"""Round 28 acceptance: native rendering, deterministic virtual time, portable copy.

Clock controls pause timers/rAF AND WAAPI; no production timing/rate changes.
"""
from pathlib import Path
from datetime import datetime, timezone
from tempfile import TemporaryDirectory
from io import BytesIO
import json, shutil, sys
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
from pool_data import pool

HERE=Path(__file__).resolve().parent
OUT=HERE/'verify-round30'
OUT.mkdir(exist_ok=True)
CLOCK=r"""(() => {
 const timeouts=new Map(),nativeSet=setTimeout,nativeClear=clearTimeout;
 window.setTimeout=(fn,ms=0,...args)=>{const id=nativeSet(()=>{timeouts.delete(id);fn(...args);},ms);timeouts.set(id,Date.now()+ms);return id;};
 window.clearTimeout=id=>{timeouts.delete(id);nativeClear(id);};
 window.__nextDeadline=()=>Math.min(...timeouts.values());
 const original=Element.prototype.animate;
 const tracked=new Map();window.__syncAnimations=()=>{for(const [a,start] of tracked)if(a.playState!=='idle'&&a.playState!=='finished')a.currentTime=performance.now()-start;};
 Element.prototype.animate=function(frames,opts){
  const a=original.call(this,frames,opts);a.pause();const start=performance.now();
  tracked.set(a,start);
  const end=(opts.delay||0)+(opts.duration||0);let frame;
  const step=()=>{if(a.playState==='idle')return;a.currentTime=Math.min(end,performance.now()-start);if(a.currentTime<end)frame=setTimeout(step,16);};
  if(window.__clockRender!==false)frame=setTimeout(step,16);
  const timer=setTimeout(()=>{clearTimeout(frame);if(a.playState!=='idle')a.finish();},end);
  a.finished.catch(()=>{}).finally(()=>{tracked.delete(a);clearTimeout(timer);clearTimeout(frame);});return a;
 };
})();"""
CARDS=pool()
BY={r:next(c for c in CARDS if c['rarity']==r) for r in ['common','rare','epic','legendary','mythic']}
rows=[]

def record(name,**data):
    rows.append(dict(check=name,**data))
    (OUT/('ceremony-results'+('-interaction' if '--interaction-only' in sys.argv else '-core' if '--core-only' in sys.argv else '')+'.json')).write_text(json.dumps(rows,indent=2),encoding='utf-8')
    print(name, {k:v for k,v in data.items() if k!='events'},flush=True)

def open_page(browser,url,reduced=False,init_script=None):
    p=browser.new_page(viewport={'width':1280,'height':900},has_touch=True,reduced_motion='reduce' if reduced else 'no-preference')
    errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('requestfailed',lambda r:errors.append(r.url))
    p.clock.install(time=datetime(2026,9,9,tzinfo=timezone.utc))
    p.clock.pause_at(datetime(2026,9,9,0,0,1,tzinfo=timezone.utc))
    p.add_init_script(CLOCK)
    if init_script:p.add_init_script(init_script)
    p.goto(url+'?ceremony-test')
    p.evaluate('document.fonts.ready')
    p.evaluate("document.querySelectorAll('.stage-background *').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0}))")
    return p,errors

def start(p,fixture,open_pack=True):
    p.evaluate('f=>{__ceremony.reset();__ceremony.events.length=0;window.__ceremonyFixture=f;__ceremony.pull(f.length)}',fixture)
    if p.evaluate('!!__ceremony.openPack'):
        p.evaluate('async()=>await __ceremony.ready()')
        if p.evaluate('!!window.__nextDeadline'):advance(p,600)
        p.wait_for_function('__ceremony.state().entryPhase==="waiting"',polling=10)
        if open_pack:p.evaluate('__ceremony.openPack()')
    # decode() is real asynchronous work, excluded from ceremony time.
    p.wait_for_function('__ceremony.events.some(e=>e.type==="phase-start")',polling=10)

def state(p):return p.evaluate('__ceremony.state()')

def advance(p,ms):
    if not p.evaluate('window.__clockRender===false'):
        p.clock.run_for(ms)
        return
    end=p.evaluate('Date.now()')+ms
    while True:
        now,due=p.evaluate('[Date.now(),__nextDeadline()]')
        if now>=end:break
        # Browser nested zero-delay timers may be clamped to the next millisecond.
        step=max(1,min(end,due if due is not None else end)-now)
        p.clock.fast_forward(step)

def clean(p):
    p.evaluate('document.querySelector("#finish").click()')
    advance(p,221)
    before=state(p)
    for ms in [5000,25000]:
        p.clock.fast_forward(ms)
        assert state(p)==before,(before,state(p))
    assert not any(before[k] for k in ['anims','timers','rafs','voices','complete']),before
    assert not before['ids'],before

def main():
    assert (HERE/'deluxe-gacha-b-standalone.html').stat().st_size<=6_500_000
    with sync_playwright() as pw,TemporaryDirectory(prefix='portable-',dir=OUT) as tmp:
        browser=pw.chromium.launch(headless=True)
        portable=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',portable)
        for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable)]:
            url=file.as_uri()
            p=None
            if '--interaction-only' not in sys.argv:
                # Entire frame, every 200 ms, including pack, deal and pre-face charge.
                captures=[]
                for rarity in ['common','legendary','mythic']:
                    p,errors=open_page(browser,url);start(p,[BY[rarity]])
                    shots=[]; diagnostics=[]
                    previous=0
                    for t in [0,200,400,600,680,780,1000,1300,1400,1500,1580,1618,1619]:
                        advance(p,t-previous);previous=t
                        assert not p.evaluate('__ceremony.events.some(e=>e.type==="face-visible")')
                        p.evaluate('__syncAnimations()')
                        shots.append(Image.open(BytesIO(p.screenshot())).convert('RGB'))
                        shots[-1].save(OUT/f'{label}-{rarity}-{t}.png')
                        diagnostics.append(p.evaluate('({time:Date.now(),events:__ceremony.events,animations:document.getAnimations().map(a=>({time:a.currentTime,target:a.effect.target.className}))})'))
                    shots[7].save(OUT/f'{label}-{rarity}-1400.png')
                    (OUT/f'{label}-{rarity}-capture.json').write_text(json.dumps(diagnostics,indent=2),encoding='utf-8')
                    captures.append(shots);assert not errors,errors;p.close()
                for variant in captures[1:]:
                    for a,b in zip(captures[0],variant):assert ImageChops.difference(a,b).getbbox() is None,'rarity preview pixels differ'
                record('no-preview',entry=label,samples=13,variants=3,max_pixel_difference=0)

                p,errors=open_page(browser,url)
                p.evaluate('window.__clockRender=false')
                for n in [1,5,10]:
                    fixture=([BY[r] for r in BY]*2)[:n];start(p,fixture)
                    for t in range(0,24000,100):
                        advance(p,100)
                        p.evaluate('__syncAnimations()')
                        assert p.locator('.slot.is-revealing').count()<=1
                        if t in [3000,5000]:p.set_viewport_size({'width':1100 if t==3000 else 1280,'height':900})
                        alignment=p.evaluate('''()=>[...document.querySelectorAll('.slot.is-revealing')].flatMap(s=>{const c=s.querySelector('.reveal-shell').getBoundingClientRect();return [...s.querySelectorAll('.reveal-anchor,.reveal-rays,.reveal-column,.reveal-impact')].map(e=>{const a=e.getBoundingClientRect();return Math.hypot(a.x+a.width/2-c.x-c.width/2,a.y+a.height/2-c.y-c.height/2)/s.offsetWidth})})''')
                        assert all(x<=.05 for x in alignment),alignment
                        if state(p)['collectable']:break
                    final=state(p);assert final['collectable'] and final['ids']==[c['id'] for c in fixture],final
                    events=p.evaluate('__ceremony.events')
                    for i in range(n):
                        face=next(e for e in events if e['type']=='face-visible' and e['index']==i)
                        burst=next(e for e in events if e['type']=='burst' and e['index']==i)
                        assert abs(face['time']-burst['time'])<=50
                        if i:
                            prev=next(e for e in events if e['type']=='slot-complete' and e['index']==i-1)
                            charge=next(e for e in events if e['type']=='phase-start' and e.get('phase')=='charge' and e['index']==i)
                            assert 0<=charge['time']-prev['time']<=(320 if i==5 else 100)
                    entry=next(e for e in events if e.get('phase')=='entry');cards=next(e for e in events if e.get('phase')=='cards')
                    assert cards['time']-entry['time']==1300+(50 if n==10 else 95)*(n-1)
                    p.screenshot(path=str(OUT/f'{label}-result-{n}.png'))
                    record('normal',entry=label,n=n,prelude_ms=cards['time']-entry['time'],events=events)
                    clean(p)
                # Seven fixed trigger points, repeated 20 times, retain A5 ownership assertions.
                p.evaluate('window.__clockRender=false')
                fixture=[BY['mythic']]+[BY['common']]*9
                for phase,ms in [('prelude',500),('tear',550),('wait',3000),('last-before',10349),('last-after',10351),('front',10800),('return',3350)]:
                    for repeat in range(20):
                        start(p,fixture);advance(p,ms)
                        snapshot=state(p)
                        if phase=='last-before':assert not p.evaluate('__ceremony.events.some(e=>e.index===9&&e.phase==="charge")')
                        if phase=='last-after':assert p.evaluate('__ceremony.events.some(e=>e.index===9&&e.phase==="charge")')
                        p.evaluate('__ceremony.skipAll();__ceremony.skipAll()')
                        p.wait_for_function('__ceremony.events.some(e=>e.phase==="skip")',polling=10)
                        advance(p,180);advance(p,1)
                        s=state(p);assert s['collectable'] and s['complete']==10 and s['ids']==[c['id'] for c in fixture],s
                        assert not any(s[k] for k in ['anims','timers','rafs','voices']),s
                        p.evaluate('document.querySelector("#finish").click()')
                    record('A5-skip',entry=label,phase=phase,repeats=20)
                # Reset/re-pull during charge and tear must not allow stale work into the next run.
                for ms in [100,550,2100]:
                    start(p,fixture);advance(p,ms);start(p,[BY['rare']]);advance(p,5000)
                    assert state(p)['collectable'] and state(p)['ids']==[BY['rare']['id']]
                    clean(p)
            if '--core-only' in sys.argv:
                assert not errors,errors
                p.close();continue
            if p is None:
                p,errors=open_page(browser,url)
                p.evaluate('window.__clockRender=false')
            # White artwork isolates browser selection blue from intentional blue/purple art.
            start(p,[next(c for c in CARDS if c['id']=='foxfriend')]);advance(p,6000)
            card=p.locator('.slot .hcard');shell=p.locator('.slot .reveal-shell');box=shell.bounding_box()
            read=lambda:card.evaluate("c=>Object.fromEntries(['--rx','--ry','--phase','--name-fs'].map(k=>[k,getComputedStyle(c).getPropertyValue(k)]))")
            before=read();x=box['x']+30;y=box['y']+70
            p.mouse.move(x,y);advance(p,200);p.wait_for_timeout(220);hover=read()
            scale=float(shell.evaluate('e=>getComputedStyle(e).scale'))
            assert abs(scale-1.04)<.001,(scale,shell.evaluate('e=>e.matches(":hover")'))
            assert before['--name-fs']==hover['--name-fs'] and hover['--rx']=='0deg' and hover['--ry']=='0deg' and hover['--phase']!=before['--phase'],(before,hover)
            p.mouse.down();p.mouse.move(x+60,y);p.mouse.up();pose=read();advance(p,500)
            p.mouse.move(1,1);advance(p,400);p.wait_for_timeout(220)
            pixels=Image.open(BytesIO(card.screenshot(path=str(OUT/f'{label}-drag-card.png')))).convert('RGB')
            blue=sum(b>120 and b>r+40 and b>g+20 for r,g,b in pixels.convert('RGB').get_flattened_data())
            blue_ratio=blue/(pixels.width*pixels.height)
            selection_ranges=p.evaluate('getSelection().rangeCount')
            record('drag-pixels',entry=label,blue_pixels=blue,total_pixels=pixels.width*pixels.height,blue_ratio=blue_ratio,selection_ranges=selection_ranges)
            assert blue_ratio<=.01,blue_ratio
            assert selection_ranges==0,selection_ranges
            assert pose['--ry']!='0deg' and read()['--ry']==pose['--ry']
            p.keyboard.press('Escape');assert read()['--ry']=='0deg'
            p.mouse.move(1,1);advance(p,400);assert read()['--phase']=='120deg'
            selected=p.locator('.slot.selected').count()
            p.touchscreen.tap(x,y);assert p.locator('.slot.selected').count()==1-selected
            p.touchscreen.tap(x,y);assert p.locator('.slot.selected').count()==selected
            record('interaction',entry=label,before=before,hover=hover,drag=pose)
            clean(p);assert not errors,errors;p.close()

            p,errors=open_page(browser,url,True);start(p,[BY['mythic']]*5);advance(p,179)
            assert not state(p)['collectable'];advance(p,1);advance(p,1)
            assert state(p)['collectable'];assert not p.evaluate('__ceremony.events.some(e=>e.phase==="tear"||e.type==="burst")')
            clean(p);record('reduced-motion',entry=label,fade_ms=180);assert not errors;p.close()
            # Real AudioContext: run without virtual time so oscillator lifetimes are measured honestly.
            p=browser.new_page();p.goto(url+'?ceremony-test');p.click('#sound')
            p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(1)}',[BY['mythic']])
            p.wait_for_function('__ceremony.state().collectable',timeout=15000)
            audio=p.evaluate('__ceremony.events.filter(e=>e.type==="audio")')
            assert len(audio)==5 and all(e['state']=='running' and not e['muted'] for e in audio),audio
            faces=p.evaluate('__ceremony.events.filter(e=>e.type==="face-visible")')
            assert max(abs(e['time']-faces[0]['time']) for e in audio if e['kind']=='reveal')<=50
            record('audio',entry=label,events=audio)
            p.click('#finish');p.wait_for_timeout(250)
            p.evaluate('window.__idleMutations=0;new MutationObserver(x=>__idleMutations+=x.length).observe(document.querySelector("#win"),{subtree:true,attributes:true,childList:true,characterData:true})')
            for ms in [5000,25000]:
                p.wait_for_timeout(ms)
                assert p.evaluate('__idleMutations')==0
                assert not any(state(p)[k] for k in ['anims','timers','rafs','voices'])
            record('real-idle',entry=label,seconds=[5,30],mutations=0)
            p.reload();assert p.locator('#sound').get_attribute('aria-pressed')=='true'
            p.click('#p1');p.wait_for_timeout(300);p.click('#revealall')
            p.wait_for_function('__ceremony.state().collectable')
            assert state(p)['voices']==0
            record('remembered-audio-cancel',entry=label,voices=0);p.close()
        browser.close()
    record('size',bytes=(HERE/'deluxe-gacha-b-standalone.html').stat().st_size)

if __name__=='__main__':main()
