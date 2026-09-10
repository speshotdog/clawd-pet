"""Deterministic card-feel evidence: run --before before rebuilding, then default."""
import base64, hashlib, io, json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'docs/clicker/shots/card-feel'
OUT.mkdir(parents=True,exist_ok=True)
BEFORE='--before' in sys.argv
PHASE='before' if BEFORE else 'after'

def freeze(p):
    p.evaluate('''async()=>{for(const root of [document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)])for(const a of root.getAnimations()){a.pause();a.currentTime=1000}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}''')

def capture(p,name,selector):
    if name=='overview':p.locator(selector).first.evaluate("e=>e.style.scale='1'")
    freeze(p)
    loc=p.locator(selector).first
    loc.screenshot(path=str(OUT/f'{name}-{PHASE}.png'))
    if not BEFORE:
        a=Image.open(OUT/f'{name}-before.png').convert('RGB');b=Image.open(OUT/f'{name}-after.png').convert('RGB')
        pair=Image.new('RGB',(max(a.width,b.width)*2,max(a.height,b.height)+24),'#181818')
        pair.paste(a,(0,24));pair.paste(b,(max(a.width,b.width),24))
        ImageDraw.Draw(pair).text((4,4),'BEFORE / AFTER',fill='white');pair.save(OUT/f'{name}-pair.png')
        a=a.crop((0,int(a.height*.76),a.width,a.height));b=b.crop((0,int(b.height*.76),b.width,b.height))
        crop=Image.new('RGB',(max(a.width,b.width)*2,max(a.height,b.height)),'#181818');crop.paste(a);crop.paste(b,(max(a.width,b.width),0))
        crop.resize((crop.width*3,crop.height*3)).save(OUT/f'{name}-type-pair.png')
    if name=='overview':p.locator(selector).first.evaluate("e=>e.style.removeProperty('scale')")

def hover(p,selector,name):
    loc=p.locator(selector).first;box=loc.bounding_box();clip={k:box[k] for k in ['x','y','width','height']}
    imgs=[]
    for x in [None,.25,.5,.75]:
        if x is None:p.mouse.move(0,0)
        else:p.mouse.move(box['x']+box['width']*x,box['y']+box['height']*.5)
        freeze(p)
        im=Image.open(io.BytesIO(p.screenshot(clip=clip))).convert('RGB');imgs.append(np.asarray(im).astype(float));im.save(OUT/f'{name}-{x}-{PHASE}.png')
    # Fixed top 10% luminance population, measured in card-normalized coordinates.
    centroids=[]
    for a in imgs[1:]:
        l=a@np.array([.2126,.7152,.0722]);ys,xs=np.where(l>=np.percentile(l,90));centroids.append(float(xs.mean()/a.shape[1]*100))
    return {'centroids_percent':centroids,'travel_percent':abs(centroids[2]-centroids[0]),'changed_percent':[float((np.max(abs(a-imgs[0]),axis=2)>2).mean()*100) for a in imgs[1:]]}

def corners(p,name):
    from check_card_corners import measure_corners
    states={}
    for inject in [False,True]:
        if inject:
            p.evaluate('''()=>{for(const root of [document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)]){if(!root.querySelector('.card-face'))continue;const s=document.createElement('style');s.textContent='.card-face{isolation:isolate}.card-face::after{content:"";position:absolute;inset:0;background:#000;mix-blend-mode:screen;transform:translateZ(2px);pointer-events:none}';(root.head||root).append(s)}}''')
        freeze(p)
        geometry=p.locator('.hcard').evaluate_all('''es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,radius:parseFloat(getComputedStyle(e).borderTopLeftRadius)||12,cls:e.className}})''')
        shot=OUT/f'{name}-corners-{inject}.png';p.screenshot(path=str(shot));states['negative' if inject else 'current']=measure_corners(Image.open(shot),geometry)
    return states

def main():
    result={}
    if BEFORE:
        files=[* (ROOT/'src').rglob('*'),HERE/'card_face.js',HERE/'ceremony.css',HERE/'ceremony.js',HERE/'pool_data.py',*(HERE/'map-art').rglob('*')]
        (OUT/'protected-before.json').write_text(json.dumps({str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}))
        (OUT/'demo-before.html').write_bytes((HERE/'demo.html').read_bytes())
    with sync_playwright() as pw:
        b=pw.chromium.launch();p=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
        p.goto((HERE/'demo.html').as_uri());p.evaluate('document.fonts.ready');p.mouse.move(0,0);capture(p,'demo','.hcard')
        p.goto((HERE/'deluxe-gacha-b.html').as_uri()+'?ceremony-test');p.evaluate('document.fonts.ready')
        result['gacha_available']=p.evaluate("typeof __ceremony!=='undefined'")
        p.evaluate('''()=>{let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);__ceremony.pull(10)}''')
        p.wait_for_function('__ceremony.state().entryPhase==="waiting"')
        p.evaluate('__ceremony.skipAll()')
        p.wait_for_function('__ceremony.state().collectable',timeout=30000)
        p.mouse.move(0,0);capture(p,'gacha','.slot:not(.page-away) .hcard')
        if not BEFORE:result['gacha_corners']=corners(p,'gacha')
        p.goto((HERE/'map20.html').as_uri()+'?screen=team');p.evaluate('document.fonts.ready');p.mouse.move(0,0)
        capture(p,'overview','#team-grid .overview-face');capture(p,'detail','#card-host')
        result['detail_hover']=hover(p,'#card-host','detail-hover')
        result['overview_hover']=hover(p,'#team-grid .overview-face','overview-hover')
        result['fonts']=p.evaluate('''()=>({check:document.fonts.check('600 16px "Holo Noto Sans"'),faces:[...document.fonts].map(f=>({family:f.family,status:f.status}))})''')
        if not BEFORE:
            p.mouse.move(0,0);freeze(p)
            p.evaluate('''()=>{window.paintCalls=0;const original=HoloCardFace.paint;HoloCardFace.paint=(...args)=>{paintCalls++;return original(...args)}}''')
            p.evaluate('''async()=>{for(let i=0;i<60;i++)await new Promise(requestAnimationFrame)}''')
            result['idle_paint_calls_60_frames']=p.evaluate('paintCalls')
            neutral=p.locator('#team-grid .overview-face').first.screenshot()
            p.evaluate('''()=>document.querySelector('#team-grid .proxy-image').dispatchEvent(new PointerEvent('pointerleave'))''');freeze(p)
            reset=p.locator('#team-grid .overview-face').first.screenshot()
            result['neutral_reset_changed_percent']=float(np.any(np.asarray(Image.open(io.BytesIO(neutral)))!=np.asarray(Image.open(io.BytesIO(reset))),axis=2).mean()*100)
            result['raf_burst']=p.evaluate('''async()=>{paintCalls=0;let h=document.querySelector('#team-grid .proxy-image'),r=h.getBoundingClientRect();for(let i=0;i<20;i++)h.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*.75,clientY:r.y+r.height*.5}));let sync=paintCalls;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return {sync,after:paintCalls}}''')
            result['selection']=[]
            for w,h in [(1440,900),(1024,768),(390,844)]:
                p.set_viewport_size({'width':w,'height':h});p.goto((HERE/'map20.html').as_uri()+'?screen=team');p.evaluate('document.fonts.ready');p.mouse.move(0,0);freeze(p)
                result['selection'].append(p.evaluate('''()=>{const e=document.querySelector('#team-grid .team-proxy[aria-selected=true] .overview-face'),s=getComputedStyle(e),r=e.getBoundingClientRect(),v=document.querySelector('.roster-scroll').getBoundingClientRect();const intersect=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return {width:innerWidth,scale:s.scale,duration:s.transitionDuration,easing:s.transitionTimingFunction,clipped_percent:100*(1-intersect(r,{left:Math.max(0,v.left),right:Math.min(innerWidth,v.right),top:Math.max(0,v.top),bottom:Math.min(innerHeight,v.bottom)})/(r.width*r.height)),overlap_percent:[...document.querySelectorAll('#team-grid .team-proxy:not([hidden]) .overview-face')].filter(x=>x!==e).reduce((n,x)=>n+intersect(r,x.getBoundingClientRect()),0)/(r.width*r.height)*100}}'''))
                p.screenshot(path=str(OUT/f'team-{w}-after.png'))
            result['text_overflow']=[]
            for index in range(2):
                p.evaluate('(i)=>team20.showPage(i)',index);freeze(p)
                result['text_overflow']+=p.locator('.face-name').evaluate_all('''es=>es.flatMap(e=>{let range=document.createRange();range.selectNodeContents(e);let r=range.getBoundingClientRect(),b=e.getBoundingClientRect(),card=e.closest('.hcard').getBoundingClientRect();return e.scrollWidth>e.clientWidth+1||r.width>b.width+1||r.left<card.left-1||r.right>card.right+1?[{name:e.textContent,width:b.width,text_width:r.width,scroll:e.scrollWidth,client:e.clientWidth}]:[]})''')
            result['all_page_fonts']={}
            for name in ['demo.html','cards-remade.html','cards-remade-standalone.html','deluxe-gacha-b.html','deluxe-gacha-b-standalone.html','map20.html']:
                p.goto((HERE/name).as_uri())
                result['all_page_fonts'][name]=p.evaluate('''async()=>{await Promise.all([...document.fonts].map(f=>f.load().catch(()=>null)));return {check:document.fonts.check('600 16px "Holo Noto Sans"'),faces:[...document.fonts].map(f=>({family:f.family,status:f.status}))}}''')
            p.set_viewport_size({'width':1440,'height':1000});p.goto((HERE/'map20.html').as_uri()+'?screen=team');p.evaluate('document.fonts.ready');result['team_corners']=corners(p,'team')
            p.goto((HERE/'demo.html').as_uri());p.evaluate('document.fonts.ready');result['demo_corners']=corners(p,'demo')
        for w,h in [(1440,900),(1024,768),(390,844)]:
            p.set_viewport_size({'width':w,'height':h});p.goto((HERE/'map20.html').as_uri()+'?screen=map');freeze(p)
            path=OUT/f'map-{w}-{PHASE}.png';p.screenshot(path=str(path))
            if not BEFORE:result[f'map_{w}_changed_pixels']=int(np.any(np.asarray(Image.open(path))!=np.asarray(Image.open(OUT/f'map-{w}-before.png')),axis=2).sum())
        b.close()
    if not BEFORE:
        old=(OUT/'demo-before.html').read_bytes();new=(HERE/'demo.html').read_bytes();pattern=rb'data:font/woff2;base64,[A-Za-z0-9+/=]+'
        result['demo_nonfont_identical']=re.sub(pattern,b'FONT',old)==re.sub(pattern,b'FONT',new)
        result['font_bytes']=[len(base64.b64decode(v.split(b',')[1])) for v in re.findall(pattern,new)]
        protected=json.loads((OUT/'protected-before.json').read_text());result['protected_changed']=[f for f,h in protected.items() if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=h]
        checks={}
        def check(name,value,lo,hi):checks[name]={'value':value,'range':[lo,hi],'status':'PASS' if lo<=value<=hi else 'FAIL'}
        check('hover_travel_percent',result['overview_hover']['travel_percent'],12,45)
        for i,n in enumerate(result['overview_hover']['changed_percent']):check(f'hover_changed_{i}_percent',n,3,25)
        check('idle_paint',result['idle_paint_calls_60_frames'],0,0)
        check('neutral_core_difference',result['neutral_reset_changed_percent'],0,0)
        check('raf_sync',result['raf_burst']['sync'],0,0);check('raf_paints',result['raf_burst']['after'],1,1)
        for i,n in enumerate(result['font_bytes']):check(f'font_{i}_bytes',n,150000,600000)
        check('demo_nonfont_diff',int(not result['demo_nonfont_identical']),0,0);check('protected_changes',len(result['protected_changed']),0,0)
        check('text_overflow',len(result['text_overflow']),0,0)
        for name in ['team','demo','gacha']:
            for state in ['current','negative']:
                c=result[name+'_corners'][state]
                check(name+'_'+state+'_corner_samples',c['samples'],1,10000)
                check(name+'_'+state+'_bad_corners',c['bad'],0 if state=='current' else 1,0 if state=='current' else 10000)
        for name,f in result['all_page_fonts'].items():
            check(name+'_font_check',int(f['check']),1,1)
            check(name+'_font_errors',sum(x['status']!='loaded' for x in f['faces']),0,0)
        for s in result['selection']:
            check(f"scale_{s['width']}",float(s['scale']),1.03,1.06)
            check(f"clipped_{s['width']}",s['clipped_percent'],0,0);check(f"overlap_{s['width']}",s['overlap_percent'],0,0)
        result['checks']=checks;result['status']='FAIL' if any(c['status']=='FAIL' for c in checks.values()) else 'PASS'
    (OUT/f'{PHASE}.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
    return int(result.get('status')=='FAIL')

if __name__=='__main__':raise SystemExit(main())
