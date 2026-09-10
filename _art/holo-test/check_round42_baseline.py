"""Read-only round 42 baseline, numerical measurements and actual card screenshots."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from pool_data import pool

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/round42'

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result={'stage':'unchanged baseline','cards':{},'pack':{}}
    for ident in ['shabaolingzhu','zhenjunyue','zhenqiqiu','fluffdog']:
        row={}
        for layer in ['subject','background']:
            path=HERE/f'layer-{ident}-{layer}.png'
            im=Image.open(path).convert('RGBA'); a=np.array(im)[:,:,3]
            row[layer]={'size':list(im.size),'nonzero_alpha_percent':float((a>0).mean()*100),
                        'zero_alpha_pixels':int((a==0).sum()),'opaque_percent':float((a==255).mean()*100),
                        'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        row['kind']=next(c['kind'] for c in pool() if c['id']==ident)
        row['scene']=next(c.get('scene',False) for c in pool() if c['id']==ident)
        result['cards'][ident]=row
    for name in ['pack-backdrop-source.png','pack-print.png','foil-pack.png','foil-pack.webp']:
        im=Image.open(HERE/'fx'/name).convert('RGBA'); rgba=np.asarray(im); rgb=rgba[:,:,:3].astype(float)
        mask=rgba[:,:,3]>0; lum=rgb @ np.array([.2126,.7152,.0722])
        saturation=np.divide(rgb.max(2)-rgb.min(2),rgb.max(2),out=np.zeros(mask.shape),where=rgb.max(2)>0)
        result['pack'][name]={'region':'alpha > 0; transparent canvas excluded','pixel_count':int(mask.sum()),
            'mean':float(lum[mask].mean()),'p05':float(np.percentile(lum[mask],5)),
            'p99':float(np.percentile(lum[mask],99)),'saturation_mean':float(saturation[mask].mean())}
    result['pack']['saturation_ratio']=result['pack']['foil-pack.webp']['saturation_mean']/result['pack']['pack-print.png']['saturation_mean']
    (OUT/'baseline-metrics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport={'width':1100,'height':1000},device_scale_factor=1)
        page.goto((HERE/'cards-remade-standalone.html').as_uri())
        page.evaluate('async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));}')
        renders=[]
        for ident in ['zhenjunyue','zhenqiqiu','fluffdog','zhenzhen']:
            panels=[]
            card=page.locator(f'#grid .hcard[data-id="{ident}"]')
            for width in [102,190,262]:
                card.evaluate('(c,w)=>{c.closest(".cell").style.width=w+"px";HoloCardFace.paint(c,c.dataset.rarity,0,0,{tilt:false});HoloCardFace.refit();}',width)
                card.scroll_into_view_if_needed();page.mouse.move(0,0)
                page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
                page.wait_for_timeout(350)
                info=card.evaluate('''c=>{const a=c.querySelector('.art-media'),b=c.querySelector('.face-depth-bg img');return {width:c.clientWidth,kind:c.dataset.artKind,name:c.querySelector('.face-name').textContent,rarity:c.querySelector('.face-rarity').textContent,art:a?{w:a.clientWidth,h:a.clientHeight}:null,background:b?{w:b.clientWidth,h:b.clientHeight,naturalWidth:b.naturalWidth,naturalHeight:b.naturalHeight,objectFit:getComputedStyle(b).objectFit}:null}}''')
                path=OUT/f'before-{ident}-{width}.png';card.screenshot(path=str(path));panels.append((width,Image.open(path).convert('RGB')))
                renders.append({'id':ident,'requested_width':width,**info})
            sheet=Image.new('RGB',(sum(i.width for _,i in panels)+80,max(i.height for _,i in panels)+55),'#101522')
            d=ImageDraw.Draw(sheet);x=20
            for width,im in panels:
                d.text((x,10),f'{width}px',fill='white');sheet.paste(im,(x,35));x+=im.width+20
            sheet.save(OUT/f'before-{ident}-sizes.png')
        result['rendered_cards']=renders
        browser.close()
    (OUT/'baseline-metrics.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(renders,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
