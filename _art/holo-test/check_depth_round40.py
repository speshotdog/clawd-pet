"""Verify relocated single-file entries and all four maximum-tilt corners."""
from pathlib import Path
import json, shutil
from playwright.sync_api import sync_playwright
from pool_data import pool

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/round40'
IDS=['zhenqiqiu','zhenjunyue','shabaolingzhu']

def main():
    portable=OUT/'portable';portable.mkdir(exist_ok=True)
    rows=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        for entry in ['cards-remade','deluxe-gacha-b']:
            copy=portable/(entry+'.html')
            shutil.copyfile(HERE/(entry+'-standalone.html'),copy)
            page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            external=[]
            page.on('request',lambda r:external.append(r.url) if not r.url.startswith(('file:','data:')) else None)
            page.goto(copy.as_uri()+'?ceremony-test')
            for ident in IDS:
                if entry=='deluxe-gacha-b':
                    fixture=[next(c for c in pool() if c['id']==ident)]
                    page.evaluate('f=>{__ceremony.reset();window.__ceremonyFixture=f;__ceremony.pull(1)}',fixture)
                    page.wait_for_function('__ceremony.state().entryPhase==="waiting"')
                    page.evaluate('__ceremony.openPack()')
                    page.wait_for_timeout(500)
                    page.evaluate('__ceremony.skipAll()')
                    page.wait_for_function('__ceremony.state().collectable')
                    selector=f'.slot .hcard[data-id="{ident}"]'
                else:selector=f'#grid .hcard[data-id="{ident}"]'
                card=page.locator(selector);card.scroll_into_view_if_needed()
                page.evaluate('async()=>await Promise.all([...document.images].map(i=>i.decode()))')
                info=card.evaluate('''c=>({kind:c.dataset.artKind,mask:!!c.querySelector('.subject-mask'),
                  images:[...c.querySelectorAll('img')].map(i=>({data:i.src.startsWith('data:'),w:i.naturalWidth,h:i.naturalHeight})),
                  backgroundOpaque:(()=>{const i=c.querySelector('.face-depth-bg img'),v=document.createElement('canvas');v.width=i.naturalWidth;v.height=i.naturalHeight;const x=v.getContext('2d');x.drawImage(i,0,0);const a=x.getImageData(0,0,v.width,v.height).data;let holes=0;for(let j=3;j<a.length;j+=4)if(a[j]!==255)holes++;return holes})()})''')
                assert info['kind']=='depth' and info['mask'] and len(info['images'])==2,info
                assert all(i['data'] and i['w'] and i['h'] for i in info['images']),info
                assert info['backgroundOpaque']==0,info
                card.evaluate("c=>HoloCardFace.paint(c,'mythic',0,0)")
                card.screenshot(path=str(OUT/f'{entry}-{ident}-neutral.png'))
                corners=[]
                for x,y in [(-1,-1),(-1,1),(1,-1),(1,1)]:
                    card.evaluate("(c,p)=>HoloCardFace.paint(c,'mythic',p[0],p[1])",[x,y])
                    style=card.evaluate("c=>Object.fromEntries(['--rx','--ry','--ax','--ay','--bx','--by'].map(k=>[k,c.style.getPropertyValue(k)]))")
                    page.screenshot(path=str(OUT/f'{entry}-{ident}-max-{x}-{y}.png'))
                    corners.append(dict(x=x,y=y,style=style,unfilled_background_pixels=info['backgroundOpaque']))
                rows.append(dict(entry=entry,id=ident,**info,corners=corners,errors=list(errors),external=list(external)))
                print(entry,ident,'PASS',flush=True)
                assert not errors and not external,(errors,external)
            page.close()
        browser.close()
    (OUT/'portable-depth.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PASS: six relocated cards; 24 maximum-tilt screenshots; zero unfilled background pixels')

if __name__=='__main__':main()
