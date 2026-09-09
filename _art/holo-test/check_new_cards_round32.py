"""Round32 acceptance. Record every failure; never turn a failed assertion green."""
from pathlib import Path
import json,sys,shutil,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from playwright.sync_api import sync_playwright
from pool_data import pool,EXTRA_CARDS,catalog,SCENE_CARDS,palettes
from prepare_round32 import SOURCE,source,cutout,boundary,edge_connected
from check_gacha_ceremony_round28 import open_page,start,advance,state

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'docs/clicker/shots/round33'
SIZES=[(1440,900),(1024,640),(390,844)]
failures=[];records=[]

def check(ok,label,data=None):
    records.append({'check':label,'pass':bool(ok),'data':data})
    if not ok:failures.append(label);print('FAIL',label,data,flush=True)

MEASURE=r'''selector=>{
 const cs=[...document.querySelectorAll(selector)].filter(c=>{const s=getComputedStyle(c),r=c.getBoundingClientRect(),slot=c.closest('.slot');if(slot&&getComputedStyle(slot).visibility==='hidden')return false;return s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0&&r.width>0});
 const rows=cs.map(c=>{const r=c.getBoundingClientRect();return {id:c.dataset.id,rect:[r.left,r.top,r.right,r.bottom],overflow:['.face-name','.face-rarity'].map(sel=>{const el=c.querySelector(sel),range=document.createRange();range.selectNodeContents(el);const b=range.getBoundingClientRect();return Math.max(0,r.left-b.left,b.right-r.right,r.top-b.top,b.bottom-r.bottom)}),name:c.querySelector('.face-name').textContent,kind:c.dataset.artKind,masked:!!c.querySelector('.subject-mask'),broken:[...c.querySelectorAll('img')].some(i=>!i.complete||!i.naturalWidth)};});
 let intersections=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i].rect,b=rows[j].rect;const area=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));if(area>0)intersections.push({ids:[rows[i].id,rows[j].id],area});}
 return {rows,intersections,documentOverflow:document.documentElement.scrollWidth>innerWidth};
}'''

def self_test():
    # Numeric known-good enclosed white region and deliberately injected hole.
    white=np.zeros((9,9),bool);white[3:6,3:6]=True
    assert not edge_connected(white).any()
    mask=np.zeros((9,9),bool);mask[2:7,2:7]=True
    assert int((~mask & ~edge_connected(~mask)).sum())==0
    mask[4,4]=False
    assert int((~mask & ~edge_connected(~mask)).sum())==1
    # Calibrate actual Range measurement against the existing, known-good renderer.
    with sync_playwright() as pw:
        b=pw.chromium.launch();p=b.new_page(viewport={'width':1440,'height':900})
        p.goto((HERE/'demo.html').as_uri());p.evaluate('document.fonts.ready')
        p.wait_for_timeout(300)
        data=p.evaluate(MEASURE,"#pool-grid .hcard[data-id='pool-dino']")
        assert len(data['rows'])==1 and max(data['rows'][0]['overflow'])<=1.5,data
        b.close()
    print('known-good image topology + legacy card Range calibration PASS',flush=True)

def assets():
    old={c['id'] for c in catalog()+SCENE_CARDS};new={c['id'] for c in EXTRA_CARDS}
    check(len(new)==16 and not old&new,'unique IDs',sorted(old&new))
    check(len(pool())==63,'pool count',len(pool()))
    check(len(list(SOURCE.glob('*.*')))==16,'source file count')
    pal=palettes();check(len(pal)==63,'palette count',len(pal))
    metrics=[]
    for c in EXTRA_CARDS:
        original=Image.open(source(c)).convert('RGBA');path=HERE/'art'/c['file']
        check(source(c).stem==c['name']+' '+{'rare':'精良','epic':'史詩','legendary':'傳說','mythic':'神話'}[c['rarity']],c['id']+' filename')
        check(c['kind'] in ('framed','flat'),c['id']+' kind')
        if not path.exists():check(False,c['id']+' missing asset');continue
        im=Image.open(path);a=np.array(im);check(im.mode=='RGBA',c['id']+' RGBA')
        if c['kind']=='framed':
            expected,m=cutout(original,source(c).suffix=='.jpg')
            check(np.array_equal(a,np.array(expected)),c['id']+' reproducible original-only cutout')
            check(im.height==580 and im.getbbox()==(0,0,*im.size),c['id']+' tight 580',im.getbbox())
            edge=boundary(a[:,:,3]>0);ratio=float(((a[:,:,:3].min(2)>165)&edge).sum()/edge.sum())
            check(ratio<=.01,c['id']+' bright boundary <=1%',ratio)
            check(m['new_interior_hole_pixels']==0,c['id']+' no new enclosed holes',m)
            check(m['interior_white_removed']==0,c['id']+' enclosed white preserved',m['interior_white_removed'])
            metrics.append({'id':c['id'],'bright_boundary_ratio':ratio,**m})
        else:
            check(im.size==(600,840),c['id']+' flat size',im.size)
            check(im.getbbox()==(0,0,600,840),c['id']+' crop-only composition contract',{'actual_content_bbox':im.getbbox(),'note':'Transparent padding preserves full content; crop exception approval pending'})
        base=pal.get(c['file'],{}).get('base')
        if base:
            rgb=np.array([int(base[i:i+2],16) for i in (1,3,5)])
            lum=float(a[:,:,:3][a[:,:,3]>160].mean(axis=0) @ np.array([.2126,.7152,.0722]))
            check(float(rgb @ [.2126,.7152,.0722])<lum,c['id']+' base darker',{'base':base,'art_luminance':lum})
        else:check(False,c['id']+' missing palette')
    (OUT/'quality-checked.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2),encoding='utf-8')
    size=(HERE/'deluxe-gacha-b-standalone.html').stat().st_size
    check(size-5146465<=900000,'standalone growth <=900000',{'bytes':size,'delta':size-5146465})
    frozen=json.loads((OUT/'frozen-before.json').read_text())
    changed=[p for p,h in frozen.items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
    check(not changed,'frozen source/card_face/ceremony bytes',changed)

def verify_layout(p,selector,label):
    result=p.evaluate(MEASURE,selector)
    check(not result['intersections'],label+' pairwise zero intersections',result['intersections'])
    check(all(max(r['overflow'])<=1.5 for r in result['rows']),label+' Range text within card',result)
    check(not result['documentOverflow'],label+' document fits')
    check(all(not r['broken'] for r in result['rows']),label+' images loaded')
    check(all(not r['masked'] for r in result['rows'] if r['kind']=='flat'),label+' flat no subject-mask')
    return result

def browser_checks():
    portable=OUT/'portable32';portable.mkdir(exist_ok=True)
    for name in ['cards-remade','deluxe-gacha-b']:
        shutil.copyfile(HERE/(name+'-standalone.html'),portable/(name+'.html'))
    with sync_playwright() as pw:
        b=pw.chromium.launch()
        for label,folder in [('dev',HERE),('portable',portable)]:
            for w,h in SIZES:
                p=b.new_page(viewport={'width':w,'height':h});errors=[]
                p.on('pageerror',lambda e:errors.append(str(e)))
                p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
                p.goto((folder/'cards-remade.html').as_uri());p.evaluate('document.fonts.ready')
                p.evaluate('async()=>await Promise.all([...document.images].map(i=>i.decode()))');p.wait_for_timeout(300)
                result=verify_layout(p,'#grid .hcard',f'{label} gallery {w}')
                check(len(result['rows'])==63,f'{label} gallery {w} count',len(result['rows']))
                check(not errors,f'{label} gallery errors',errors)
                if w==1440 and label=='dev':
                    thumbs=[]
                    for card in p.locator('#grid .hcard').all():
                        from io import BytesIO
                        thumb=Image.open(BytesIO(card.screenshot())).convert('RGB');thumb.thumbnail((140,196));thumbs.append(thumb)
                    sheet=Image.new('RGB',(9*150,7*210),'#10121b')
                    for i,im in enumerate(thumbs):sheet.paste(im,((i%9)*150,(i//9)*210))
                    sheet.save(OUT/'contact-sheet-63.jpg',quality=92)
                p.close()
                p,errors=open_page(b,(folder/'deluxe-gacha-b.html').as_uri(),init_script='window.__clockRender=false')
                p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
                p.set_viewport_size({'width':w,'height':h})
                seen=set()
                by_id={c['id']:c for c in pool()}
                all_cards=[by_id[c['id']] for c in EXTRA_CARDS]+[c for c in pool() if c['id'] not in {x['id'] for x in EXTRA_CARDS}]
                for i in range(0,63,10):
                    batch=all_cards[i:i+10]
                    if len(batch) not in (1,5,10):batch+=pool()[:5-len(batch)]
                    print(label,w,'batch',i,flush=True)
                    start(p,batch);advance(p,1800)
                    p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181);advance(p,400)
                    check(state(p)['collectable'],f'{label} results {w} batch {i} collectable')
                    for j in range(len(batch) if w==390 else 1):
                        result=verify_layout(p,'.slot .hcard',f'{label} results {w} batch {i} page {j}')
                        check(len(result['rows'])==(1 if w==390 else len(batch)),f'{label} results {w} visible count {i}/{j}',len(result['rows']))
                        check(all(r['rect'][0]>=-1.5 and r['rect'][1]>=-1.5 and r['rect'][2]<=w+1.5 and r['rect'][3]<=h+1.5 for r in result['rows']),f'{label} results {w} inside viewport {i}/{j}',[r['rect'] for r in result['rows']])
                        if w==390:check(result['rows'][0]['id']==batch[j]['id'],f'{label} mobile page identity {i}/{j}')
                        seen.update(r['id'] for r in result['rows'])
                        if i==0 and j==0:p.screenshot(path=str(OUT/f'{label}-results-{w}.png'))
                        if w==390 and j<len(batch)-1:p.locator('#next').click();advance(p,400)
                check(seen=={c['id'] for c in pool()},f'{label} {w} all 63 reachable',sorted(seen))
                check(not errors,f'{label} results {w} console',errors);p.close()
            p,errors=open_page(b,(folder/'deluxe-gacha-b.html').as_uri(),init_script='window.__clockRender=false')
            for c in EXTRA_CARDS:
                print(label,'natural reveal',c['id'],flush=True)
                full=next(d for d in pool() if d['id']==c['id']);start(p,[full]);advance(p,11000)
                s=state(p)
                check(s['collectable'] and s['ids']==[c['id']] and s['complete']==1,f'{label} natural reveal {c["id"]}',s)
                check(p.locator('.face-name').inner_text()==c['name'],f'{label} rendered name {c["id"]}')
            check(not errors,f'{label} natural reveal errors',errors);p.close()
        b.close()

if __name__=='__main__':
    if '--self-test' in sys.argv:self_test();sys.exit(0)
    try:
        assets()
        if '--assets-only' not in sys.argv:browser_checks()
    finally:
        (OUT/('acceptance-assets.json' if '--assets-only' in sys.argv else 'acceptance.json')).write_text(json.dumps({'failures':failures,'records':records},ensure_ascii=False,indent=2),encoding='utf-8')
    print('checks',len(records),'failures',len(failures),flush=True)
    sys.exit(1 if failures else 0)
