# -*- coding: utf-8 -*-
"""Real CDP pointer drags, local routing only. No server/download required.

python tools/test/clicker-v3-drag-perf.py --label before
python tools/test/clicker-v3-drag-perf.py --label after
Saved baseline files can be routed with --holo PATH --css PATH.
JSON + raw traces go under _art/out/v3-drag-perf. CPU throttling is not GPU emulation.
"""
import argparse
import json
import math
import mimetypes
import os
import time
from io import BytesIO
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-drag-perf'
SEED = """() => { const s=ClickerSave.fresh(Date.now());
s.collection=Object.fromEntries(Object.keys(ClickerBalance.characters).slice(0,8).map(id=>[id,4])); s.dust={...s.collection};
s.coins=1e9; s.lifetimeCoins=1e12; s.manualClicks=500; s.packages=200;
s.claimedMilestones=['tutorial50']; s.collectibles=['mohuashaonv'];
s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
s.apoc={unlocked:true,tutorial:4,collection:{[ApocPool[0].id]:1}};
s.settings.world='apoc'; ClickerSave.validate(s,GachaPool);
sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
PROBE = """sel => {
 const h=document.querySelector(sel+' .holo-face.holo-interactive');
 if(!h) throw Error('interactive host missing: '+sel);
 const f=h._face, b=h.getBoundingClientRect();
 const q=window.dragProbe={moves:0,calls:0,updates:0,rectReads:0,times:[],active:false};
 const paint=HoloCardFace.paint;
 HoloCardFace.paint=function(card,...args){if(q.active && card===f) q.calls++; return paint.call(this,card,...args)};
 const rect=h.getBoundingClientRect.bind(h);
 h.getBoundingClientRect=()=>{if(q.active)q.rectReads++;return rect()};
 const observer=new MutationObserver(records=>{if(q.active && records.some(r=>r.attributeName==='style'))q.updates++});
 observer.observe(f,{attributes:true,subtree:true});
 h.addEventListener('pointermove',()=>{if(q.active)q.moves++});
 h.addEventListener('pointerdown',()=>{q.active=true;q.start=performance.now()});
 h.addEventListener('pointerup',()=>{q.active=false;q.end=performance.now()});
 for(const type of ['pointerdown','pointerup','pointerleave','pointercancel'])h.addEventListener(type,()=>q.trackingEvents?.push({type,t:performance.now()}));
 let raf; function tick(t){if(q.active)q.times.push(t);raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick);
 q.cleanup=()=>{cancelAnimationFrame(raf);observer.disconnect();HoloCardFace.paint=paint};
 return {x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height,
 rarity:f.dataset.rarity,altLoaded:[...f.querySelectorAll('img')].some(i=>/collect-alt/.test(i.src))};
}"""

def percentile(values, p):
    a = sorted(values)
    return round(a[min(len(a)-1, math.ceil(len(a)*p)-1)], 2) if a else None

def run_case(browser, viewport, rate, kind, surface, args):
    mobile = viewport == 'mobile'
    ctx = browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 860},
                              is_mobile=mobile, has_touch=mobile, device_scale_factor=1)
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if args.holo and path == SRC / 'clicker-holo.js':
            r.fulfill(body=Path(args.holo).read_bytes(),content_type='application/javascript'); return
        if args.css and path == SRC / 'clicker.css':
            r.fulfill(body=Path(args.css).read_bytes(),content_type='text/css'); return
        if path.is_relative_to(SRC) and path.is_file():
            if args.visual_only and path.suffix=='.webp':
                # Visual QA only: serve frame zero for animated images/masks so two
                # screenshots compare the same instant. Never used for performance.
                from PIL import Image
                im=Image.open(path)
                if getattr(im,'n_frames',1)>1:
                    buf=BytesIO(); im.seek(0); im.save(buf,format='PNG')
                    r.fulfill(body=buf.getvalue(),content_type='image/png'); return
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed');if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed')}")
    pg = ctx.new_page()
    errors=[]
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html')
    pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state')
    pg.wait_for_timeout(1800)
    pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>/名冊|卡冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(600)
    if kind == 'special':
        pg.locator('#collect-open').click()
        pg.wait_for_timeout(600)
        pg.evaluate("()=>document.querySelector('.collect-page .album-slot').click()")
    else:
        for _ in range(24):
            if pg.evaluate("()=>!!document.querySelector('.album-slot[data-id=\"'+ApocPool[0].id+'\"]')"): break
            pg.evaluate("()=>document.getElementById('album-next').click()")
            pg.wait_for_timeout(400)
        pg.evaluate("()=>document.querySelector('.album-slot[data-id=\"'+ApocPool[0].id+'\"]').click()")
    pg.wait_for_timeout(700)
    if surface == 'zoom':
        pg.evaluate("()=>[...document.querySelectorAll('#album-detail button')].find(b=>/放大/.test(b.textContent)).click()")
    pg.wait_for_timeout(900)
    sel = '#card-zoom' if surface == 'zoom' else '#album-detail'
    if args.snapshot:
        pg.evaluate("""sel=>{const f=document.querySelector(sel+' .holo-face')._face;
        window.snapshotAnims=f.getAnimations({subtree:true}).map(a=>({a,time:a.currentTime,state:a.playState}));
        for(const {a} of snapshotAnims){a.pause();a.currentTime=1000}}
        """,sel)
        pg.locator(sel+' .holo-face').screenshot(path=str(OUT/f'{args.label}-{viewport}-{kind}-{surface}-idle.png'))
        pg.evaluate("()=>{for(const {a,time,state} of snapshotAnims){a.currentTime=time;if(state==='running')a.play()}delete window.snapshotAnims}")
    if args.visual_only:
        ctx.close()
        return {'viewport':viewport,'rate':rate,'kind':kind,'surface':surface,'pass':True}
    if args.experiment:
        pg.evaluate("""({sel,mode})=>{const h=document.querySelector(sel+' .holo-face');
        if(mode==='freeze'||mode==='transform-only'){const paint=HoloCardFace.paint;HoloCardFace.paint=(f,...a)=>{if(f!==h._face||!h.classList.contains('holo-dragging'))paint(f,...a)};
        if(mode==='transform-only'){const f=h._face,lift=f.querySelector('.card-lift'),set=f.style.setProperty.bind(f.style);let rx='0deg',ry='0deg';
        lift.style.transition='none';f.style.setProperty=(k,v,...rest)=>{if(k==='--rx')rx=v;else if(k==='--ry')ry=v;else return set(k,v,...rest);lift.style.transform=`perspective(1000px) rotateX(${rx}) rotateY(${ry})`}}}
        else if(mode==='cached-rect'){const r=h.getBoundingClientRect();h.getBoundingClientRect=()=>r}
        else if(mode==='solo'){for(const other of document.querySelectorAll('.holo-face'))if(other!==h)other.style.visibility='hidden'}
        else if(mode==='opaque'){h.closest('#card-zoom').style.background='#0c0804'}
        else if(mode==='pause-background'){for(const other of document.querySelectorAll('.holo-face'))if(other!==h)for(const a of other._face.getAnimations({subtree:true}))a.pause()}
        else if(mode==='pause-all'){for(const other of document.querySelectorAll('.holo-face'))for(const a of other._face.getAnimations({subtree:true}))a.pause()}
        else if(mode==='quiet'){for(const other of document.querySelectorAll('.holo-face'))for(const a of other._face.getAnimations({subtree:true}))a.pause();
        const st=new CSSStyleSheet();st.replaceSync('.frame-material,.subject-mask,.bg-tint{display:none!important}');h.shadowRoot.adoptedStyleSheets=[...h.shadowRoot.adoptedStyleSheets,st]}
        else if(mode==='flatten-background'){for(const other of document.querySelectorAll('.holo-face'))if(other!==h){other.style.filter='opacity(1)';for(const a of other._face.getAnimations({subtree:true}))a.pause()}}
        else {const rules={'no-hearts':'.gift-hearts{display:none!important}',
        'no-transition':'.hcard .card-lift{transition:none!important}',
        'no-images':'.art-media>img{visibility:hidden!important}',
        'no-masks':'.subject-mask{display:none!important}',
        'pause-hearts':':host(.holo-dragging) .gift-hearts>i,:host(.holo-dragging) .gift-hearts b{animation-play-state:paused!important}',
        'hide-hearts':'.gift-hearts{visibility:hidden!important}',
        'flatten':':host(.holo-dragging) .card-inner{isolation:isolate}',
        'no-filters':':host(.holo-dragging) .hcard *{filter:none!important}',
        'less-effects':':host(.holo-dragging) .gift-hearts,:host(.holo-dragging) .frame-material,:host(.holo-dragging) .subject-mask,:host(.holo-dragging) .bg-tint{display:none!important}',
        'no-layers':'.frame-material,.special-tint,.bg-tint{display:none!important}'};
        const st=new CSSStyleSheet();st.replaceSync(rules[mode]);h.shadowRoot.adoptedStyleSheets=[...h.shadowRoot.adoptedStyleSheets,st]}
        }""", {'sel':sel,'mode':args.experiment})
    dims=pg.evaluate(PROBE, sel)
    cdp=ctx.new_cdp_session(pg)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate':rate})
    cdp.send('Performance.enable')
    events=[]; done=[]
    cdp.on('Tracing.dataCollected', lambda data: events.extend(data['value']))
    cdp.on('Tracing.tracingComplete', lambda data: done.append(True))
    cdp.send('Tracing.start',{'categories':'devtools.timeline,blink.user_timing','transferMode':'ReportEvents'})
    before={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    x,y=dims['x'],dims['y']
    def pointer(phase, px, py):
        if mobile:
            cdp.send('Input.dispatchTouchEvent',{'type':{'down':'touchStart','move':'touchMove','up':'touchEnd'}[phase],
                'touchPoints':[] if phase=='up' else [{'x':px,'y':py,'id':1}]})
        else:
            cdp.send('Input.dispatchMouseEvent',{'type':{'down':'mousePressed','move':'mouseMoved','up':'mouseReleased'}[phase],
                'x':px,'y':py,'button':'left','buttons':0 if phase=='up' else 1,'clickCount':1 if phase!='move' else 0})
    pointer('down',x,y)
    for i in range(1,61):
        # Monotonic movement avoids synthetic click and repeated positions; 0.2 deg/px reaches clamp.
        px=x+96*i/60; py=y+48*math.sin(i/60*math.pi/2)
        pointer('move',px,py)
        pg.wait_for_timeout(12)
    pg.wait_for_timeout(30)
    pointer('up',px,py)
    after={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    cdp.send('Tracing.end')
    deadline=time.monotonic()+15
    while not done and time.monotonic()<deadline: pg.wait_for_timeout(50)
    if not done: raise RuntimeError('trace incomplete')
    q=pg.evaluate("()=>{const q=dragProbe;q.cleanup();return {moves:q.moves,calls:q.calls,updates:q.updates,rectReads:q.rectReads,times:q.times}}")
    stamps=q.pop('times'); gaps=[b-a for a,b in zip(stamps,stamps[1:])]
    result={'viewport':viewport,'rate':rate,'kind':kind,'surface':surface,**dims,**q,
            'p50':percentile(gaps,.5),'p95':percentile(gaps,.95),'max':round(max(gaps),2),'frames':len(gaps),
            'metrics':{k:round((after[k]-before[k])*1000,2) for k in ['RecalcStyleDuration','LayoutDuration','TaskDuration']},
            'trace':{name:{'count':sum(e.get('ph')=='X' and e['name']==name for e in events),
                           'ms':round(sum(e.get('dur',0) for e in events if e.get('ph')=='X' and e['name']==name)/1000,2)}
                     for name in ['UpdateLayoutTree','Layout','Paint','Layerize','PrePaint']},'errors':errors}
    result['pass']=result['p95']<=34 and q['moves']==60 and q['updates']>0 and not errors
    if args.tracking:
        # A separate step response, outside the timed drag/trace. Compare the visible
        # matrix with the 0.2 deg/px command, then verify the 280 ms return really ends.
        pg.wait_for_timeout(1200)
        pg.evaluate('()=>{dragProbe.trackingEvents=[]}')
        pointer('down',x,y); pointer('move',x+60,y+30)
        pg.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        matrix_probe="""({sel,rx,ry})=>{const h=document.querySelector(sel+' .holo-face'),lift=h._face.querySelector('.card-lift');
        const css=getComputedStyle(lift), actual=new DOMMatrix(css.transform), wanted=new DOMMatrix(`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`);
        const animations=[...document.querySelectorAll('.holo-collect')].flatMap(other=>other._face.getAnimations({subtree:true}));
        const hearts=h._face.querySelector('.gift-hearts');
        return {transition:css.transitionDuration,error:Math.max(...actual.toFloat64Array().map((v,i)=>Math.abs(v-wanted.toFloat64Array()[i]))),dragging:h.classList.contains('holo-dragging'),animations:animations.length,paused:animations.filter(a=>a.playState==='paused').length,heartVisibility:hearts?getComputedStyle(hearts).visibility:null};}"""
        result['tracking']=pg.evaluate(matrix_probe,{'sel':sel,'rx':-6,'ry':12})
        pointer('up',x+60,y+30); pg.wait_for_timeout(350)
        result['return']=pg.evaluate(matrix_probe,{'sel':sel,'rx':0,'ry':0})
        result['pass'] = result['pass'] and result['tracking']['error']<1e-4 and result['return']['error']<1e-4 and not result['return']['dragging']
        result['altAfterDrag']=pg.evaluate("sel=>[...document.querySelector(sel+' .holo-face')._face.querySelectorAll('img')].some(i=>/collect-alt/.test(i.src))",sel)
        result['pass'] = result['pass'] and not result['altAfterDrag']
        pointer('down',x,y); pointer('move',x+120,y+120)
        pg.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        result['clamp']=pg.evaluate(matrix_probe,{'sel':sel,'rx':-18,'ry':18})
        if mobile:
            cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
        else:
            pg.evaluate("sel=>document.querySelector(sel+' .holo-face').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}))",sel)
            pointer('up',x+120,y+120)
        pg.wait_for_timeout(350)
        result['cancelReturn']=pg.evaluate(matrix_probe,{'sel':sel,'rx':0,'ry':0})
        result['trackingEvents']=pg.evaluate('()=>dragProbe.trackingEvents')
        result['pass'] = result['pass'] and result['clamp']['error']<1e-4 and result['cancelReturn']['error']<1e-4 and not result['cancelReturn']['dragging']
        result['pass'] = result['pass'] and result['tracking']['paused']==result['tracking']['animations'] and result['return']['paused']==0 and result['cancelReturn']['paused']==0
        if kind=='special':
            result['pass'] = result['pass'] and result['tracking']['heartVisibility']=='hidden' and result['return']['heartVisibility']=='visible' and result['cancelReturn']['heartVisibility']=='visible'
        pointer('down',x,y); pointer('move',x+30,y+30)
        pg.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        pg.evaluate("sel=>document.querySelector(sel+' .holo-face').remove()",sel)
        pg.wait_for_timeout(100)
        result['detach']=pg.evaluate("()=>({dragging:document.querySelectorAll('.holo-dragging').length,paused:[...document.querySelectorAll('.holo-collect')].flatMap(h=>h._face.getAnimations({subtree:true})).filter(a=>a.playState==='paused').length})")
        result['pass'] = result['pass'] and result['detach']=={'dragging':0,'paused':0}
        pointer('up',x+30,y+30)
        print('tracking: '+json.dumps({k:result[k] for k in ['tracking','return']}),flush=True)
    key=f'{args.label}-{viewport}-{rate}-{kind}-{surface}'
    (OUT / (key+'-trace.json')).write_text(json.dumps({'traceEvents':events}),encoding='utf-8')
    print(f"{key}: p50/p95/max {result['p50']}/{result['p95']}/{result['max']} ms; move/appPaint/styleUpdates {q['moves']}/{q['calls']}/{q['updates']}; browserPaint {result['trace']['Paint']}; {'PASS' if result['pass'] else 'FAIL'}",flush=True)
    ctx.close()
    return result

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--label',default='current')
    ap.add_argument('--quick',action='store_true',help='mobile 6x zoom only, both cards')
    ap.add_argument('--tracking',action='store_true',help='also check visible step response and return outside measured trace')
    ap.add_argument('--kind',choices=['special','control'])
    ap.add_argument('--viewport',choices=['desktop','mobile'])
    ap.add_argument('--rate',type=int,choices=[1,4,6])
    ap.add_argument('--resume',action='store_true',help='resume a partial JSON run without repeating completed cases')
    ap.add_argument('--holo',help='route a saved clicker-holo.js for a reproducible baseline')
    ap.add_argument('--css',help='route a saved clicker.css for a reproducible baseline')
    ap.add_argument('--snapshot',action='store_true',help='save idle card with heart animations at a fixed time, then restore animation')
    ap.add_argument('--visual-only',action='store_true',help='deterministic idle screenshots only; animated images served at frame zero, NO perf results')
    ap.add_argument('--experiment',choices=['freeze','cached-rect','no-hearts','no-layers','no-transition','no-images','no-masks','transform-only','pause-hearts','flatten','solo','no-filters','less-effects','pause-background','quiet','flatten-background','opaque','pause-all','hide-hearts'])
    args=ap.parse_args(); OUT.mkdir(parents=True,exist_ok=True)
    if args.holo: args.holo=str(Path(args.holo).resolve())
    if args.css: args.css=str(Path(args.css).resolve())
    # Chromium may emit debug.log even with --log-file. Keep incidental output in _art.
    os.chdir(OUT)
    if args.visual_only: args.snapshot=True
    result_path=OUT / (args.label+'.json')
    results=json.loads(result_path.read_text(encoding='utf-8')) if args.resume and result_path.exists() else []
    with sync_playwright() as p:
        browser=p.chromium.launch(args=['--log-file='+str(OUT/'chromium.log')])
        print('Chromium '+browser.version,flush=True)
        for viewport in ([args.viewport] if args.viewport else ['mobile'] if args.quick else ['desktop','mobile']):
            for rate in ([args.rate] if args.rate else [1] if args.visual_only else [6] if args.quick else [1,4,6]):
                for kind in ([args.kind] if args.kind else ['special','control']):
                    for surface in (['zoom'] if args.quick else ['detail','zoom']):
                        if any((r['viewport'],r['rate'],r['kind'],r['surface'])==(viewport,rate,kind,surface) for r in results): continue
                        results.append(run_case(browser,viewport,rate,kind,surface,args))
                        (OUT / (args.label+'.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
        browser.close()
    ok=all(not r.get('errors') and (r['rate']!=6 or r['pass']) for r in results)
    summary = '6x p95 <= 34 ms: ' if any(r['rate']==6 for r in results) else 'Selected cases (6x not measured): '
    print('Visual snapshots complete (no performance measurement)' if args.visual_only else summary+('PASS' if ok else 'FAIL'),flush=True)
    return 0 if ok else 1

if __name__=='__main__':
    raise SystemExit(main())
