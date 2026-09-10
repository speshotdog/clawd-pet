"""Real mouse, rendered pixel and relocated-standalone checks for round 42."""
from pathlib import Path
import json, shutil, io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from pool_data import pool
from check_round42_assets import pair

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/round42'

def barrier(page):page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
def freeze(page):
    page.evaluate('()=>{for(const a of document.getAnimations())if(a instanceof CSSAnimation){a.pause();a.currentTime=0;}}')
    barrier(page)
def pixels(locator):return np.array(Image.open(io.BytesIO(locator.screenshot())).convert('RGB')).astype(float)

def main():
    result={'cards':[],'pack':[]};fail=[]
    portable=OUT/'portable';portable.mkdir(exist_ok=True)
    for name in ['cards-remade','deluxe-gacha-b']:
        shutil.copyfile(HERE/f'{name}-standalone.html',portable/f'{name}.html')
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for label,url in [('dev',(HERE/'cards-remade.html').as_uri()),('portable',(portable/'cards-remade.html').as_uri())]:
            page=browser.new_page(viewport={'width':1100,'height':1000},device_scale_factor=1);errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)));page.goto(url)
            page.evaluate('async()=>await Promise.all([...document.images].map(i=>i.decode()))')
            for ident in ['zhenjunyue','zhenqiqiu','fluffdog','zhenzhen','shabaolingzhu']:
                card=page.locator(f'#grid .hcard[data-id="{ident}"]');images=[]
                for width in [102,190,262]:
                    card.evaluate('(c,w)=>{c.closest(".cell").style.width=w+"px";HoloCardFace.paint(c,c.dataset.rarity,0,0,{tilt:false});HoloCardFace.refit();}',width)
                    card.scroll_into_view_if_needed();page.mouse.move(0,0);page.wait_for_timeout(350);barrier(page)
                    path=OUT/f'{label}-{ident}-{width}.png';card.screenshot(path=str(path));images.append(Image.open(path))
                    data=card.evaluate('''c=>({width:c.clientWidth,kind:c.dataset.artKind,name:c.querySelector('.face-name').textContent,rarity:c.querySelector('.face-rarity').textContent,images:[...c.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight}))})''')
                    result['cards'].append({'entry':label,'id':ident,'requested_width':width,**data})
                    if data['width']!=width or data['kind']!='depth' or not all(i['loaded'] for i in data['images']):fail.append(f'{label}/{ident}/{width}')
                    if ident=='zhenzhen' and data['name']!=next(c['name'] for c in pool() if c['id']==ident):fail.append('C name')
                pair(images,OUT/f'{label}-{ident}-sizes.png',['102px','190px','262px'])
                if ident=='zhenzhen':
                    pair([Image.open(OUT/'before-zhenzhen-262.png'),images[-1]],OUT/f'C-before-after-{label}.png',['BEFORE','AFTER'])
                if ident=='shabaolingzhu':
                    for x,y in [(-1,-1),(-1,1),(1,-1),(1,1)]:
                        card.evaluate('(c,p)=>HoloCardFace.paint(c,"mythic",p[0],p[1])',[x,y]);barrier(page)
                        card.screenshot(path=str(OUT/f'{label}-A-tilt-{x}-{y}.png'))
            if errors:fail.extend(errors)
            page.close()
        for label,url in [('dev',(HERE/'deluxe-gacha-b.html').as_uri()),('portable',(portable/'deluxe-gacha-b.html').as_uri())]:
            page=browser.new_page(viewport={'width':1100,'height':900},device_scale_factor=1);errors=[];external=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:external.append(r.url) if not r.url.startswith(('file:','data:')) else None)
            page.goto(url+'?ceremony-test');pack=page.locator('#entry-pack')
            fixture=next(c for c in pool() if c['rarity']=='common')
            def waiting(card=fixture):
                page.evaluate('c=>{__ceremony.reset();window.__ceremonyFixture=[c];__ceremony.pull(1)}',card)
                page.wait_for_function('__ceremony.state().entryPhase==="waiting"');freeze(page)
            def opens():return page.evaluate('__ceremony.events.filter(e=>e.type==="pack-open").length')
            row={'entry':label,'input':[]}
            for motion in ['no-preference','reduce']:
                page.emulate_media(reduced_motion=motion);waiting();initial=opens()
                for i in range(20):
                    b=pack.bounding_box();x=b['x']+b['width']*.45;y=b['y']+b['height']*.5
                    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+45,y-28,steps=5);page.mouse.up()
                dragged=opens()-initial;clicks=0
                for i in range(20):
                    waiting();initial=opens();pack.click();page.wait_for_function('__ceremony.state().entryPhase!=="waiting"');clicks+=opens()-initial
                row['input'].append({'motion':motion,'drags':20,'drag_distance_px':float(np.hypot(45,28)),'opens_after_drags':dragged,'clicks':20,'opens_after_clicks':clicks})
                print(label,motion,'drag opens',dragged,'click opens',clicks,flush=True)
                if dragged!=0 or clicks!=20:fail.append(f'D4 {label} {motion}')
            page.emulate_media(reduced_motion='no-preference');waiting();page.mouse.move(0,0);page.wait_for_timeout(350);freeze(page)
            base=[]
            for rarity in ['common','rare','epic','legendary','mythic']:
                waiting(next(c for c in pool() if c['rarity']==rarity));page.mouse.move(0,0);page.wait_for_timeout(350);freeze(page)
                shot=pixels(pack);base.append(shot);pack.screenshot(path=str(OUT/f'{label}-pack-{rarity}.png'))
            differences=[int(np.count_nonzero(np.any(a!=base[0],axis=2))) for a in base[1:]]
            row['preopen_different_pixels']=differences
            if any(differences):fail.append(f'D4 preopen pixel identity {label}')
            waiting();b=pack.bounding_box();centers=[];positions=[]
            for t in np.linspace(.16,.84,9):
                x=b['x']+b['width']*float(t);page.mouse.move(x,b['y']+b['height']*.5);barrier(page)
                on=pixels(pack);page.locator('.pack-surface .foil-glare').evaluate('e=>e.style.visibility="hidden"');barrier(page);off=pixels(pack)
                page.locator('.pack-surface .foil-glare').evaluate('e=>e.style.visibility=""');barrier(page)
                delta=np.maximum(0,(on-off)@np.array([.2126,.7152,.0722]));weight=delta.sum()
                centers.append(float((delta.sum(0)*np.arange(delta.shape[1])).sum()/weight) if weight else None);positions.append(x)
            corr=float(np.corrcoef(positions,centers)[0,1]) if all(c is not None for c in centers) else None
            row['cursor_x']=positions;row['measured_glare_centroid_x']=centers;row['glare_correlation']=corr
            if corr is None or corr<.9:fail.append(f'D4 glare correlation {label}')
            pack.screenshot(path=str(OUT/f'{label}-pack-material-on.png'))
            page.locator('.pack-surface').evaluate('e=>{for(const c of e.children)c.style.visibility="hidden"}');barrier(page)
            pack.screenshot(path=str(OUT/f'{label}-pack-material-off.png'))
            pair([Image.open(OUT/f'{label}-pack-material-off.png'),Image.open(OUT/f'{label}-pack-material-on.png')],OUT/f'D3-{label}-off-on.png',['MATERIAL OFF','MATERIAL ON'])
            row['errors']=errors;row['external_requests']=external
            if errors or external:fail.append(f'{label} errors/requests')
            result['pack'].append(row);page.close()
        browser.close()
    result['failures']=fail
    (OUT/'browser-metrics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result['pack'],indent=2),flush=True);print('failures',fail,flush=True)
    raise SystemExit(1 if fail else 0)

if __name__=='__main__':main()
