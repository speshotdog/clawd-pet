"""Round 30: actual file:// original, pixel photometry and prototype acceptance."""
from pathlib import Path
from io import BytesIO
import json, sys, shutil
from PIL import Image, ImageDraw, ImageChops
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, BY, open_page, start, advance, state, CLOCK
BASELINE=HERE/'verify-round30'
OUT=HERE.parent.parent/'docs/clicker/shots/round33/retained/retained30'
OUT.mkdir(parents=True,exist_ok=True)
RARITIES=list(BY)

def shot(p):
    p.evaluate('__syncAnimations();window.__ceremony?.syncFx()')
    # Explicit presentation barrier for the paused WAAPI sample. A pack-only
    # one-frame mismatch occurred under concurrent GPU load; virtual time must
    # not advance while Chromium commits the sampled transform to its compositor.
    stamp=p.evaluate('window.__nextDeadline?Date.now():null')
    p.evaluate("document.querySelectorAll('.summon-pack,.reveal-shell').forEach(e=>getComputedStyle(e).transform)")
    p.wait_for_timeout(20)
    if stamp is not None:assert p.evaluate('Date.now()')==stamp
    return Image.open(BytesIO(p.screenshot())).convert('RGB')

def p95(im,mask):
    h=im.convert('L').histogram(mask);target=sum(h)*.95;n=0
    for i,v in enumerate(h):
        n+=v
        if n>=target:return i

def measure(p,selector,label,rarity):
    # Fixed, matched viewport ROI. Exclude card footprint through the whole flip,
    # not the near-zero bounding box of the edge-on first frame.
    mask=Image.new('L',(1440,900),0);d=ImageDraw.Draw(mask)
    d.rectangle((160,160,1279,719),fill=255)
    d.rectangle((490,110,950,750),fill=0)
    mask.save(OUT/'photometry-mask.png')
    print('measuring',label,rarity,flush=True)
    base=shot(p);baseline=p95(base,mask)
    p.evaluate('()=>{window.__goReveal()}')
    for _ in range(250):
        if p.evaluate('window.__faceTime!=null'):break
        advance(p,10)
    assert p.evaluate('window.__faceTime!=null'),p.evaluate('({cards:document.querySelector("#cards")?.innerHTML,body:document.body.innerText})')
    values=[]
    for t in range(0,4501,50):
        if t:advance(p,50)
        im=shot(p);values.append({'ms':t,'p95':p95(im,mask)})
        if t<=600:im.save(OUT/f'{label}-{rarity}-{t:03}.png')
        if label!='original' and t>=700 and all(v['p95']<=baseline+40 for v in values[-3:]):break
    result={'rarity':rarity,'baseline_p95':baseline,'peak_p95':max(x['p95'] for x in values if x['ms']<=600),
            'duration_ms':sum(50 for x in values[:-1] if x['p95']>baseline+40),'samples':values}
    return result

def save(name,data):
    (OUT/name).write_text(json.dumps(data,indent=2),encoding='utf-8')

def pixels(browser,file,label):
    baseline_file=OUT/'original-baseline.json'
    if not baseline_file.exists():baseline_file=BASELINE/'original-baseline.json'
    baseline=json.loads(baseline_file.read_text());rows=[]
    for rarity,original in zip(RARITIES,baseline):
        p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':1440,'height':900})
        p.evaluate('()=>{let seed=300;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}')
        start(p,[BY[rarity]]);advance(p,1300)
        p.evaluate("()=>{window.__goReveal=()=>{};Object.defineProperty(window,'__faceTime',{get:()=>__ceremony.events.find(e=>e.type==='face-visible')?.time})}")
        row=measure(p,'.hcard',label,rarity);factor=1.3 if rarity in ['legendary','mythic'] else 1
        row.update(entry=label,original_peak=original['peak_p95'],original_duration=original['duration_ms'],factor=factor)
        rows.append(row);save(f'{label}-pixels.json',rows)
        assert row['peak_p95']>=original['peak_p95']*factor,row
        assert row['duration_ms']>=original['duration_ms']*factor,row
        if factor>1:assert row['duration_ms']>=1000,row
        assert not errors,errors;p.close();print('pixel-pass',label,rarity,row['peak_p95'],row['duration_ms'],flush=True)
    return rows

def rectangles(p):
    return p.locator('.hcard').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cw:e.clientWidth}})')

def nonoverlap(rects):
    for i,a in enumerate(rects):
        for b in rects[i+1:]:
            area=max(0,min(a['x']+a['w'],b['x']+b['w'])-max(a['x'],b['x']))*max(0,min(a['y']+a['h'],b['y']+b['h'])-max(a['y'],b['y']))
            assert area==0,(a,b,area)

def layouts(browser,file,label):
    rows=[]
    for w,h in [(1440,900),(1024,640),(390,844)]:
        for n in [5,10]:
            p,errors=open_page(browser,file.as_uri());p.set_viewport_size({'width':w,'height':h});start(p,[BY['common']]*n)
            p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181)
            rects=rectangles(p);nonoverlap(rects)
            if w==1440:assert min(r['cw'] for r in rects)>=(200 if n==5 else 190)
            if w>600:
                assert p.locator('.slot.page-away').count()==0
                assert all(r['x']>=0 and r['x']+r['w']<=w and r['y']>=35 and r['y']+r['h']<=h-35 for r in rects)
            # Hover plus retained ±18° drag must preserve the clearance too.
            target=p.locator('.slot').nth(0).locator('.reveal-shell');b=target.bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
            p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+90,y+90);p.mouse.up();advance(p,200);nonoverlap(rectangles(p))
            p.keyboard.press('Escape');p.mouse.move(1,1);advance(p,200)
            p.screenshot(path=str(OUT/f'{label}-layout-{w}-{n}.png'))
            if w<600:
                for _ in range(n-1):p.click('#next');nonoverlap(rectangles(p))
                assert p.locator('.slot.mobile-current').get_attribute('data-i')==str(n-1)
            assert not errors,errors;p.close();rows.append({'viewport':[w,h],'n':n,'rects':rects,'intersection_area':0});print('layout-pass',label,w,n,flush=True)
    save(f'{label}-layout.json',rows)

def core(browser,file,label):
    # Same 13 full-frame pre-F captures × 3 ranks × 2 builds = 78 frames.
    captures=[]
    for rarity in ([] if '--a5-only' in sys.argv else ['common','rare','epic','legendary','mythic']):
        p,errors=open_page(browser,file.as_uri());start(p,[BY[rarity]]);last=0;frames=[]
        for t in [0,200,400,600,680,780,1000,1300,1400,1500,1580,1618,1619]:
            advance(p,t-last);last=t;assert not p.evaluate('__ceremony.events.some(e=>e.type==="face-visible")')
            im=shot(p);im.save(OUT/f'{label}-neutral-{rarity}-{t}.png');frames.append(im)
        captures.append(frames);assert not errors,errors;p.close()
    for frames in captures[1:3]:
        for a,b in zip(captures[0],frames):assert ImageChops.difference(a,b).getbbox() is None
    for frames in captures[3:]:
        assert ImageChops.difference(captures[0][-1],frames[-1]).getbbox() is not None
    rows=[{'check':'low-tier-no-preview','frames':39,'max_difference':0},
          {'check':'high-tier-charge-preview','variants':2,'difference':'nonempty'}] if captures else []
    if '--preview-only' in sys.argv:
        save(f'{label}-preview.json',rows)
        return
    p,errors=open_page(browser,file.as_uri());p.evaluate('window.__clockRender=false')
    fixture=[BY['mythic']]+[BY['common']]*9
    # 1750 prelude + 1300 charge + 320 flip = F3370; read1900 → return5270.
    # First complete5630 + eight commons*(320+300+220) = last charge12350.
    for phase,ms in [('controls',100),('tension',300),('tear',550),('deal',900),('pre-face',3369),('post-face',3371),('return',5350),('last-before',12349),('last-after',12351)]:
        if '--late-only' in sys.argv and not phase.startswith('last-'):continue
        for _ in range(20):
            if phase=='controls':
                p.evaluate('f=>{__ceremony.reset();__ceremony.events.length=0;window.__ceremonyFixture=f;__ceremony.pull(f.length)}',fixture);p.evaluate('async()=>await __ceremony.ready()')
            else:start(p,fixture)
            advance(p,ms)
            if phase=='return':assert p.evaluate('__ceremony.events.filter(e=>e.index===0&&e.type==="phase-start").at(-1).phase')=='return'
            if phase.startswith('last-'):assert p.evaluate('__ceremony.events.some(e=>e.index===9&&e.phase==="charge")')==(phase=='last-after')
            p.evaluate('()=>{__ceremony.skipAll();__ceremony.skipAll()}');advance(p,181);s=state(p)
            assert s['collectable'] and s['complete']==10 and s['ids']==[c['id'] for c in fixture],s
            assert not any(s[k] for k in ['anims','timers','rafs','voices'])
            assert not p.locator('.rarity-fx,.control-sheen').count()
            assert p.evaluate('__ceremony.events.filter(e=>e.type==="slot-complete").length')==10
        rows.append({'check':'A5','phase':phase,'trigger_ms':ms,'clock_origin':'pull' if phase=='controls' else 'pack-open (after 600ms + player wait)','repeats':20});print('A5-pass',label,phase,flush=True)
        save(f'{label}-core'+('-late' if '--late-only' in sys.argv else '-a5' if '--a5-only' in sys.argv else '')+'.json',rows)
    assert not errors,errors;p.close()

def original(browser):
    rows=[]
    layout_only='--baseline-layout' in sys.argv
    for rarity in (['common'] if layout_only else RARITIES):
        n=5 if layout_only else 1
        # Chromium disallows fetch(file:) even though scripts/images load. Serve
        # the exact on-disk rig template bytes to this one fetch; no visual fixture.
        template=(HERE.parent.parent/'src/index.html').read_text(encoding='utf-8')
        shim='const nativeFetch=fetch;window.fetch=(u,...a)=>String(u)==="index.html"?Promise.resolve(new Response('+json.dumps(template)+')):nativeFetch(u,...a);'
        p,errors=open_page(browser,(HERE.parent.parent/'src/clicker.html').as_uri(),init_script=shim)
        p.set_viewport_size({'width':1440,'height':900})
        p.wait_for_function('window.Clicker && Clicker.state')
        p.wait_for_function('document.querySelector("#recruit-open").onclick != null')
        p.evaluate('''({r,n})=>{
          Clicker.state.coins=Clicker.state.lifetimeCoins=1e9;Clicker.state.settings.mode='hearthstone';
          Clicker.state.settings.muted=true;Clicker.state.settings.music=false;
          let seed=300;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
          const create=GachaModeRuntime.create;
          GachaModeRuntime.create=(host,draw)=>{
            const entry=GachaPool.CATALOG.find(e=>e.rarity===r);
            draw={...draw,visualSeed:300,entries:Array.from({length:n},(_,i)=>({key:'fixed:'+i,entry,dup:false,owned:0}))};
            window.__fixedDraw=draw;
            const notify=host.onReveal;host.onReveal=k=>{window.__faceTime=Date.now();notify(k)};
            window.__runtime=create(host,draw);return __runtime;
          };
          const mode=GachaModes.hearthstone.create;
          GachaModes.hearthstone.create=ctx=>{const m=mode(ctx),open=m.open;m.open=()=>open(__fixedDraw);return m;};
        }''',{'r':rarity,'n':n})
        advance(p,100)
        p.evaluate("n=>{const e=document.querySelector(n===5?'#draw-five':'#draw-one');e.disabled=false;e.click()}",n)
        advance(p,1800 if layout_only else 1400)
        assert p.locator('#cards .card').count()==n, p.evaluate('({fatal:document.querySelector("#fatal").textContent,pending:Clicker.state.pending,body:document.body.innerText,runtime:!!window.__runtime})')
        if layout_only:
            p.evaluate('__syncAnimations()');p.screenshot(path=str(OUT/'original-five-table.png'))
            save('original-layout.json',p.locator('#cards .card').evaluate_all('es=>es.map(e=>({clientWidth:e.clientWidth,rect:e.getBoundingClientRect().toJSON(),transform:e.style.transform}))'))
            assert not errors,errors;p.close();continue
        p.evaluate("()=>{window.__goReveal=()=>__runtime.ctx.cards.reveal('fixed:0')}")
        row=measure(p,'#cards .card','original',rarity)
        row['errors']=errors;rows.append(row);print('original',row,flush=True);p.close()
    if not layout_only:save('original-baseline.json',rows)

if __name__=='__main__':
    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=['--allow-file-access-from-files'])
        if '--baseline' in sys.argv or '--baseline-layout' in sys.argv:original(browser)
        else:
            portable=OUT/'portable'/'index.html';portable.parent.mkdir(exist_ok=True);shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',portable)
            for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable)]:
                if '--pixels' in sys.argv:pixels(browser,file,label)
                elif '--layout' in sys.argv:layouts(browser,file,label)
                elif '--core' in sys.argv:core(browser,file,label)
                else:layouts(browser,file,label);core(browser,file,label);pixels(browser,file,label)
            assert portable.stat().st_size<=6_000_000
        browser.close()
