"""Read-only implementation audit. Fixtures use the shipped builder and captured options.
Run from any cwd; writes only verify-gacha evidence. Exit 1 means measured failures.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import json, shutil, sys
from io import BytesIO
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright
from pool_data import pool

HERE = Path(__file__).resolve().parent
OUT = HERE / 'verify-round29' / 'regression'
OUT.mkdir(parents=True,exist_ok=True)
WIDTHS = [80, 102, 150, 230, 290, 380, 420]
MEASURE = r"""c => {
 const cs=getComputedStyle(c), cr=c.getBoundingClientRect();
 const sels=['.card-lift','.card-inner','.card-face','.face-stock','.face-depth-bg','.face-art','.art-media','.art-media img','.face-frame','.frame-material','.face-plate','.face-text','.face-gem','.face-name','.face-rarity'];
 const props=['fontFamily','fontSize','lineHeight','letterSpacing','color','webkitTextFillColor','backgroundImage','backgroundColor','transform','zIndex','left','right','top','bottom','height','width','paddingLeft','paddingRight','gap','opacity','filter','mixBlendMode','borderRadius','borderTopWidth','maskSize','backgroundSize'];
 let layers={};
 for(const sel of sels){const e=c.querySelector(sel);if(!e){layers[sel]=null;continue;}const s=getComputedStyle(e),r=e.getBoundingClientRect();let styles={};for(const p of props)styles[p]=s[p];layers[sel]={rect:[r.x-cr.x,r.y-cr.y,r.width,r.height],styles};}
 const skin={};for(const [key,sel,prop,pseudo] of [['frame','.face-frame','borderRadius'],['inset','.face-frame','top','::after'],['material','.frame-material','borderRadius'],['mask','.frame-material','maskSize'],['background','.frame-material','backgroundSize'],['plate','.face-plate','borderRadius'],['gem','.face-gem','borderRadius'],['glyph','.face-gem','fontSize']])skin[key]=(getComputedStyle(c.querySelector(sel),pseudo)[prop].includes('%')?parseFloat(getComputedStyle(c.querySelector(sel),pseudo)[prop]):parseFloat(getComputedStyle(c.querySelector(sel),pseudo)[prop])/parseFloat(cs.width)*100);
 const n=c.querySelector('.face-name'),p=c.querySelector('.face-plate'),g=c.querySelector('.face-gem');
 const range=document.createRange();range.selectNodeContents(n);const nr=range.getBoundingClientRect(),pr=p.getBoundingClientRect(),gr=g.getBoundingClientRect(),ps=getComputedStyle(p),scale=pr.width/p.offsetWidth,cx=cr.x+cr.width/2;
 const room=2*Math.max(0,Math.min(cx-pr.left-parseFloat(ps.paddingLeft)*scale,pr.right-parseFloat(ps.paddingRight)*scale-cx,cx-gr.right-parseFloat(cs.width)*.02*scale));
 return {skin,id:c.dataset.id,kind:c.dataset.artKind,rarity:c.dataset.rarity,name:n.textContent,width:parseFloat(cs.width),cardRect:[cr.width,cr.height],outerTransform:getComputedStyle(c.parentElement).transform,outerScale:getComputedStyle(c.parentElement).scale,layers,
 structure:c.querySelectorAll('.face-text').length===1&&c.querySelectorAll('.face-text .face-name').length===1&&c.querySelectorAll('.face-text .face-rarity').length===1&&!p.textContent&&(c.dataset.artKind!=='flat'||!c.querySelector('.subject-mask')),
 nameFits:c.dataset.nameFits,rangeWidth:nr.width,room,gemGap:nr.left-gr.right,localName:n.style.getPropertyValue('--name-fs'),
 broken:[...c.querySelectorAll('img')].filter(i=>!i.complete||!i.naturalWidth).length,
 centers:['.face-name','.face-rarity'].map(s=>{const r=c.querySelector(s).getBoundingClientRect();return Math.abs(r.x+r.width/2-cx)}),
 overflow:['.face-plate','.face-text','.face-gem','.face-name','.face-rarity'].map(s=>{const r=c.querySelector(s).getBoundingClientRect();return {selector:s,amount:Math.max(0,cr.left-r.left,r.right-cr.right,cr.top-r.top,r.bottom-cr.bottom)}}),
 vars:Object.fromEntries(['--rx','--ry','--ax','--ay','--bx','--by','--phase','--foil','--grain','--glare','--pal-base'].map(k=>[k,cs.getPropertyValue(k)]))};
}"""

def settle(page):
    page.evaluate("async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}")
    page.wait_for_timeout(80)

def prepare(page, name):
    page.add_init_script("""Object.defineProperty(window,'HoloCardFace',{configurable:true,set(v){Object.defineProperty(window,'HoloCardFace',{value:v,configurable:true});const original=v.create;v.create=(d,o)=>{window.__opts=o;return original(d,o)}}});""")
    page.goto((HERE/name).as_uri())
    settle(page)
    page.mouse.move(1,1)
    page.evaluate("""()=>{window.__cards=[...document.querySelectorAll('.hcard')];for(const el of document.body.children)el.style.display='none';document.body.style.background='#07080d';document.body.style.padding='0';}""")

def place(page, data, width, gacha=False):
    page.evaluate("""({d,w,g})=>{
      if(window.__host){HoloCardFace.unobserve(__host.querySelector('.hcard'));__host.remove();}
      const c=g?HoloCardFace.create(d,window.__opts):(__cards.find(c=>c.dataset.id==='pool-'+d.id)||__cards.find(c=>c.dataset.id===d.id)||HoloCardFace.create(d,window.__opts));
      if(!c)throw Error('missing '+d.id);
      const h=document.createElement('div');h.className=g?'slot':'hit';h.style.cssText=`position:fixed;left:100px;top:100px;width:${w}px;height:${w*1.4}px;margin:0;transform:none;scale:1;`;
      h.append(c);document.body.append(h);window.__host=h;c.style.opacity='1';
      HoloCardFace.observe(c);
    }""", {'d':data,'w':width,'g':gacha})
    settle(page)
    return page.locator('body > .hit .hcard, body > .slot .hcard').evaluate(MEASURE)

def compare(a,b):
    diffs=[];maxrect=0
    for sel,x in a['layers'].items():
        y=b['layers'][sel]
        if x is None or y is None:
            if x!=y:diffs.append([sel,'missing'])
            continue
        maxrect=max(maxrect,max(abs(i-j) for i,j in zip(x['rect'],y['rect'])))
        for k,v in x['styles'].items():
            if v!=y['styles'][k]:diffs.append([sel,k,v,y['styles'][k]])
    return {'maxRectDelta':maxrect,'styleDifferences':diffs,'pass':maxrect<=1 and not diffs}

def check_skin(ctx):
    rows=[]
    for entry in ['demo.html','cards-remade.html','deluxe-gacha-b.html']:
        p=ctx.new_page();p.goto((HERE/entry).as_uri());settle(p)
        for rarity in ['rare','legendary','mythic']:
            for w in WIDTHS:
                row=p.evaluate("""({w,r})=>{
                  document.querySelector('#skin-probe')?.remove();
                  const c=document.createElement('div');c.id='skin-probe';c.className='hcard kind-framed r-'+r;
                  c.style.cssText=`position:fixed;width:${w}px;height:${w*1.4}px;--cw:${w}px`;
                  c.innerHTML='<div class="face-frame"></div><div class="frame-material"></div><div class="face-plate"></div><div class="face-gem"></div>';document.body.append(c);
                  const read=(s,k,pseudo)=>{const v=getComputedStyle(c.querySelector(s),pseudo)[k];return v.includes('%')?parseFloat(v):parseFloat(v)/w*100;};
                  return {frame:read('.face-frame','borderRadius'),inset:read('.face-frame','top','::after'),material:read('.frame-material','borderRadius'),mask:read('.frame-material','maskSize'),background:read('.frame-material','backgroundSize'),plate:read('.face-plate','borderRadius'),gem:read('.face-gem','borderRadius'),glyph:read('.face-gem','fontSize'),border:read('.face-frame','borderTopWidth'),crown:getComputedStyle(c.querySelector('.face-frame'),'::before').backgroundImage};
                }""", {'w':w,'r':rarity})
                expected=dict(frame=12/262*100,inset=(10 if rarity=='rare' else 12)/262*100,material=12/262*100,mask=100,background=300,plate=5/262*100,gem=3/262*100,glyph=14/262*100)
                for key,value in expected.items():assert abs(row[key]-value)<.3,(entry,rarity,w,key,row[key],value)
                if rarity!='rare':assert row['crown']=='none',row
                rows.append(dict(entry=entry,rarity=rarity,width=w,values=row))
        p.close()
    (OUT/'skin.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
    print('skin:',len(rows),'page/rarity/width cases, 8 proportional properties within 0.3 percentage points',flush=True)


def check_remade_portable(ctx):
    with TemporaryDirectory(prefix='round27-remade-',dir=OUT) as tmp:
        moved=Path(tmp)/'cards.html';shutil.copy2(HERE/'cards-remade-standalone.html',moved)
        p=ctx.new_page();errors=[];failed=[]
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        p.on('requestfailed',lambda r:failed.append(r.url))
        p.goto(moved.as_uri());settle(p)
        assert p.locator('#grid .hcard').count()==43
        assert p.evaluate('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
        assert not errors and not failed,(errors,failed)
        p.close()
    print('remade standalone copied: 43 cards, images loaded, no errors',flush=True)


def main():
    result={'viewport':{'width':1512,'height':1000},'deviceScaleFactor':1,'widths':WIDTHS,'pairs':[],'flows':[],'errors':[], 'stress':[]}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        result['browser']=browser.version
        ctx=browser.new_context(viewport=result['viewport'],device_scale_factor=1)
        if '--race-only' in sys.argv or '--race-before' in sys.argv:
            from check_reveal_timing import check_timing
            check_timing(ctx,HERE,OUT,repeats=1 if '--race-before' in sys.argv else 20,portable_values=(False,) if '--race-before' in sys.argv else (False,True),evidence='timing-first-failure.json' if '--race-before' in sys.argv else 'timing-after.json')
            return 0
        if '--flows-only' not in sys.argv:
            check_skin(ctx)
            if '--skin-only' not in sys.argv:check_remade_portable(ctx)
            if '--skin-only' in sys.argv:return 0
            g,r,d=[ctx.new_page() for _ in range(3)]
            for label,p in [('gacha',g),('remade',r),('demo',d)]:
                p.on('pageerror',lambda e,l=label:result['errors'].append([l,str(e)]))
            # Capture the exact resolver/masks actually passed by makeFace on a real draw.
            g.goto((HERE/'deluxe-gacha-b.html').as_uri())
            g.evaluate("()=>{const f=HoloCardFace.create;HoloCardFace.create=function(d,o){window.__opts=o;return f(d,o)}}")
            g.locator('#p1').click();g.wait_for_function('window.__opts!==undefined');g.wait_for_timeout(3500)
            g.evaluate("()=>{for(const e of document.body.children)e.style.display='none';document.body.style.background='#07080d';document.body.style.padding='0'}")
            prepare(r,'cards-remade.html');prepare(d,'demo.html')
            for w in WIDTHS:
                for card in pool():
                    ref=r
                    a=place(ref,card,w);b=place(g,card,w,True)
                    demo=place(d,card,w) if ref!=d else a
                    for measured in [a,b,demo]:
                        expected=dict(frame=12/262*100,inset=(12 if card['rarity'] in ['legendary','mythic'] else 10)/262*100,material=12/262*100,mask=100,background=300,plate=5/262*100,gem=3/262*100,glyph=14/262*100)
                        for key,value in expected.items():assert abs(measured['skin'][key]-value)<.3,(card['id'],w,key,measured['skin'])
                        for sel in ['.face-plate','.face-text']:
                            st=measured['layers'][sel]['styles']
                            for prop,denom,target in [('left',w,4.4),('right',w,4.4),('bottom',w*1.4,3.4),('height',w*1.4,16.2)]:assert abs(float(st[prop].removesuffix('px'))/denom*100-target)<.03,(card['id'],w,sel,prop,st[prop])
                    row={'demoComparison':compare(demo,b),'id':card['id'],'width':w,'reference':'cards-remade.html','referenceMeasurement':a,'gachaMeasurement':b,**compare(a,b)}
                    for measured in [a,b,demo]:
                        assert measured['structure'] and not measured['broken'],(card['id'],w,measured['structure'],measured['broken'])
                        assert all(x['amount']<=1.5 for x in measured['overflow']),(card['id'],w,measured['overflow'])
                    if card['id'] in ['rocketdog','mieshi','wanwumythic','foxfriend','dino']:
                        imgs=[]
                        for label,p in [('reference',ref),('gacha',g)]:
                            buf=p.screenshot(clip={'x':96,'y':96,'width':w+8,'height':int(w*1.4)+8})
                            (OUT/f'{card["id"]}-{w}-{label}.png').write_bytes(buf);imgs.append(Image.open(BytesIO(buf)).convert('RGB'))
                        delta=ImageChops.difference(*imgs);row['pixelMAE']=sum(ImageStat.Stat(delta).mean)/3
                        row['differentPixels']=sum(1 for x in delta.get_flattened_data() if x!=(0,0,0))
                    result['pairs'].append(row)
                print('measured width',w,flush=True)
                (OUT/('flows-final.json' if '--flows-only' in sys.argv else 'measure-gacha-after.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            if '--cards-only' in sys.argv:
                failures=[x for x in result['pairs'] if not x['pass'] or not x['demoComparison']['pass']]
                print('cross-page cases:',len(result['pairs']),'failures:',len(failures),flush=True)
                return int(bool(failures or result['errors']))
            # Same-width long-name stress and restore, no production pool mutations.
            fixture=dict(next(c for c in pool() if c['id']=='dino'))
            fixture['name']='這是一張用來驗證縮字下限與恢復能力的超長卡片名稱'
            for w in [290,80,290]:
                result['stress'].append(place(g,fixture,w,True))
            # Refit must use content width even under whole-card scale.
            place(g,next(c for c in pool() if c['id']=='dino'),102,True)
            g.evaluate("()=>{__host.style.scale='1.13';HoloCardFace.refit()}")
            result['scaledRefit']=g.locator('body > .slot .hcard').evaluate(MEASURE)
        # Real controls, untouched pages and randomness; normal and skip paths.
        for portable in [False,True]:
            with TemporaryDirectory(prefix='gacha-verify-',dir=OUT) as tmp:
                source=HERE/'deluxe-gacha-b.html'
                if portable:
                    source=Path(tmp)/'portable.html';shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',source)
                p=ctx.new_page();errs=[];failed=[]
                p.on('pageerror',lambda e:errs.append(str(e)))
                p.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
                p.on('requestfailed',lambda q:failed.append(q.url))
                p.goto(source.as_uri()+"?ceremony-test")
                for n in [1,5,10]:
                    for skip in [False,True]:
                        p.evaluate('__ceremony.reset()');p.locator(f'#p{n}').click()
                        p.wait_for_function(f'document.querySelectorAll(".slot").length==={n}')
                        if skip:
                            p.wait_for_timeout(1200);p.locator('#stage').click(position={'x':15,'y':100})
                        p.wait_for_function(f'document.querySelectorAll(".slot .hcard").length==={n}',timeout=30000)
                        # Round 28 pre-decodes hidden faces; DOM existence is no longer reveal completion.
                        p.wait_for_function('!document.querySelector("#finish").hidden',timeout=30000)
                        p.mouse.move(1,1);settle(p)
                        cards=p.locator('.slot .hcard').evaluate_all('(cs)=>cs.map('+MEASURE+')')
                        first=p.locator('.slot:not(.page-away) .hcard').last
                        before=first.evaluate(MEASURE);first.hover();p.wait_for_timeout(250);hover=first.evaluate(MEASURE)
                        p.mouse.move(1,1);p.wait_for_timeout(250)
                        if n==10 and not skip:p.screenshot(path=str(OUT/f'ten-pull-{portable}.png'))
                        p.set_viewport_size({'width':1100,'height':800});p.wait_for_timeout(250)
                        resized=p.locator('.slot .hcard').evaluate_all('(cs)=>cs.map('+MEASURE+')')
                        finish_visible=p.locator('#finish').is_visible()
                        if finish_visible:
                            p.locator('#finish').click();p.wait_for_timeout(250)
                        else:
                            p.screenshot(path=str(OUT/f'finish-hidden-{portable}-{n}-{skip}.png'))
                        assert all(before['vars'][k]==hover['vars'][k] for k in ['--rx','--ry','--ax','--ay','--bx','--by']),(portable,n,skip,before['vars'],hover['vars'])
                        assert before['vars']['--phase']!=hover['vars']['--phase'],(portable,n,skip,'foil did not respond')
                        assert all(c['structure'] and not c['broken'] for c in cards),(portable,n,skip,'broken card')
                        result['flows'].append({'portable':portable,'n':n,'skip':skip,'cards':cards,'hoverBefore':before['vars'],'hoverAfter':hover['vars'],'resized':resized,'finishVisible':finish_visible,'collected':p.locator('.slot').count()==0,'errors':list(errs),'failedRequests':list(failed)})
                        (OUT/('flows-final.json' if '--flows-only' in sys.argv else 'measure-gacha-after.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
                        p.set_viewport_size(result['viewport'])
                        print('flow',portable,n,skip,flush=True)
                p.close()
        if '--flows-only' not in sys.argv:
            from check_reveal_timing import check_timing
            result['fixedTiming']=check_timing(ctx,HERE,OUT)
        browser.close()
    result['summary']={'pairs':len(result['pairs']),'pairFailures':sum(not x['pass'] or not x['demoComparison']['pass'] for x in result['pairs']),'gachaStructureFailures':sum(not x['gachaMeasurement']['structure'] for x in result['pairs']),'gachaNameFitFailures':sum(x['gachaMeasurement']['nameFits']=='false' for x in result['pairs']),'flowCount':len(result['flows'])}
    (OUT/('flows-final.json' if '--flows-only' in sys.argv else 'measure-gacha-after.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result['summary'],ensure_ascii=False))
    return 1 if result['summary']['pairFailures'] or result['summary']['gachaStructureFailures'] or result['summary']['gachaNameFitFailures'] or result['errors'] or any(not f['collected'] or f['errors'] or f['failedRequests'] for f in result['flows']) else 0

if __name__=='__main__':
    sys.exit(main())
