"""Verify source immutability, original RGB selections, and both file:// entries."""
import base64, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from pool_data import CARDS_5_0, pool
from card_assets import assets

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/5.0'

def main():
    prep=json.loads((OUT/'preparation.json').read_text(encoding='utf-8'))
    assert prep['source_sha256']=={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in (HERE/'source-5.0').iterdir()}
    assert len(CARDS_5_0)==9 and len({c['id'] for c in pool()})==len(pool())
    assets()
    for row in prep['cards']:
        src=OUT/'stargaze-frame-120.png' if row['frame'] is not None else HERE/'source-5.0'/row['source']
        rgb=np.array(Image.open(src).convert('RGB'))
        sub=np.array(Image.open(OUT/(row['id']+'-source-cutout.png')))
        assert np.array_equal(rgb,sub[:,:,:3]),row['id']
        assert (sub[:,:,3]>0).any() and (sub[:,:,3]==0).any(),row['id']
        if row['kind']=='depth':
            for part in ('subject','background'):
                im=Image.open(HERE/f"layer-{row['id']}-{part}.png")
                assert im.size==(600,840)
                if part=='background':assert np.array(im)[:,:,3].min()==255
    entries=[]
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for filename in ('cards-remade.html','cards-remade-standalone.html'):
            page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
            errors=[];failed=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.on('requestfailed',lambda r:failed.append(r.url))
            page.goto((HERE/filename).as_uri(),wait_until='load')
            page.evaluate('''async()=>{await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready;}''')
            assert page.locator('#grid .hcard').count()==len(pool())
            page.locator('#grid').evaluate("g=>g.style.gridTemplateColumns='repeat(2,600px)'")
            cards=[]
            for c in CARDS_5_0:
                card=page.locator('#grid .hcard[data-id="'+c['id']+'"]')
                assert card.count()==1
                card.scroll_into_view_if_needed()
                assert card.locator('.face-name').inner_text()==c['name']
                assert card.get_attribute('data-art-kind')==c['kind']
                dims=card.locator('img').evaluate_all('(imgs)=>imgs.map(i=>({width:i.naturalWidth,height:i.naturalHeight,ok:i.complete&&i.naturalWidth>0}))')
                assert all(d['ok'] for d in dims)
                assert card.locator('.subject-mask').count()==1
                page.evaluate('''()=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=0});return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}''')
                if filename=='cards-remade.html':
                    card.screenshot(path=str(OUT/(c['id']+'-card-face.png')))
                    alt=OUT/(c['id']+'-alternative-background.png')
                    if alt.exists():
                        card.locator('.face-depth-bg img').evaluate('(i,src)=>i.src=src','data:image/png;base64,'+base64.b64encode(alt.read_bytes()).decode())
                        card.locator('.face-depth-bg img').evaluate('(i)=>i.decode()')
                        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                        card.screenshot(path=str(OUT/(c['id']+'-alternative-card-face.png')))
                cards.append({'id':c['id'],'images':dims,'subject_masks':1})
            assert not errors,errors
            assert not failed,failed
            entries.append({'entry':filename,'total_cards':len(pool()),'new_cards_loaded':len(cards),'console_errors':len(errors),'failed_requests':len(failed),'cards':cards})
            page.close()
        browser.close()
    (OUT/'checks.json').write_text(json.dumps({'source_files_unchanged':4,'original_rgb_checks':9,'entries':entries},ensure_ascii=False,indent=2),encoding='utf-8')
    for c in CARDS_5_0:
        from prepare_5_0 import pair
        ident=c['id'];face=Image.open(OUT/(ident+'-card-face.png'))
        pair(OUT/(ident+'-body-and-card.png'),[Image.open(HERE/'art'/c['file']),face],['本體 / '+c['name'],'既有精裝卡面 / '+c['name']])
        alt=OUT/(ident+'-alternative-card-face.png')
        if alt.exists():
            pair(OUT/(ident+'-background-options.png'),[face,Image.open(alt)],['A 系列一致（展示提案）','B 各自背景（待選）'])
    print(json.dumps({'entries':[{k:v for k,v in e.items() if k!='cards'} for e in entries],'source_files_unchanged':4,'original_rgb_checks':9},ensure_ascii=False))

if __name__=='__main__':main()
