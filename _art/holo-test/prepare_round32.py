"""Original-only cutouts; no drawing, inpainting, generated art or RGB edits."""
from pathlib import Path
import json, os
import numpy as np
from scipy import ndimage as nd
from PIL import Image, ImageDraw, ImageFont
from pool_data import EXTRA_CARDS, catalog, SCENE_CARDS,source_stem
import bright_edge

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/round32'
RARITY={'rare':'精良','epic':'史詩','legendary':'傳說','mythic':'神話'}
CROSS=nd.generate_binary_structure(2,1)

def resolve_source():
    candidates=[HERE/'source-4.0', Path.home()/'OneDrive/Desktop/4.0']
    for key in ('HOLO_SOURCE_4_0','HOLO_SOURCE'):
        if os.environ.get(key):candidates.append(Path(os.environ[key]).expanduser())
    tried=[]
    for folder in candidates:
        invalid=[]
        for c in EXTRA_CARDS:
            pattern=source_stem(c)+'.*'
            matches=[p for p in folder.glob(pattern) if p.is_file()]
            if len(matches)!=1:invalid.append('%s (%d matches)' % (pattern,len(matches)))
        if not invalid:
            print('4.0 source: %s' % folder)
            return folder
        tried.append('%s (missing or ambiguous: %s)' % (folder,', '.join(invalid)))
    raise SystemExit('No complete 4.0 source set. Searched:\n'+'\n'.join(tried))

SOURCE=resolve_source()

def edge_connected(mask):
    seed=np.zeros_like(mask);seed[0]=mask[0];seed[-1]=mask[-1];seed[:,0]=mask[:,0];seed[:,-1]=mask[:,-1]
    return nd.binary_propagation(seed,structure=CROSS,mask=mask)

def boundary(mask):
    return mask & ~nd.binary_erosion(mask,structure=CROSS,border_value=0)

def source(c):
    # 來源檔名不可變，顯示名改了也不會動到它（對照表在 pool_data.SOURCE_STEM）。
    matches=list(SOURCE.glob(source_stem(c)+'.*'))
    assert len(matches)==1,(c,matches)
    return matches[0]

def cutout(im,jpg=False):
    a=np.array(im);rgb=a[:,:,:3];original=a[:,:,3]>0
    white=np.min(rgb,axis=2)>235
    interior_white=white & ~edge_connected(white) & original
    labels,n=nd.label(interior_white,CROSS)
    had_alpha=not original.all()
    mask=original.copy()
    if not had_alpha:
        mask &= ~edge_connected(white)
        cc,nc=nd.label(mask,CROSS);sizes=np.bincount(cc.ravel());sizes[0]=0
        mask=cc==sizes.argmax()
    component_removed=int((original & ~mask & ~edge_connected(white)).sum())
    for _ in range(7 if jpg else 5):
        mask &= ~(boundary(mask)&bright_edge.sat_ok(rgb)&~interior_white)
    a[:,:,3]=np.where(mask,a[:,:,3],0)
    new_holes=(~mask & ~edge_connected(~mask)) & original
    metrics={'existing_alpha':had_alpha,'white_components':n,'interior_white_pixels':int(interior_white.sum()),
             'white_pixels':int((white & original).sum()),'removed_white_pixels':int((white & original & ~mask).sum()),
             'interior_white_removed':int((interior_white & ~mask).sum()),'new_interior_hole_pixels':int(new_holes.sum()),
             'removed_non_background_component_pixels':component_removed,
             'white_component_removed_pixels':[int(((labels==i)&~mask).sum()) for i in range(1,n+1)]}
    cleaned=Image.fromarray(a);box=cleaned.getbbox();cleaned=cleaned.crop(box)
    result=cleaned.resize((round(cleaned.width*580/cleaned.height),580),Image.Resampling.LANCZOS)
    # LANCZOS can expose near-white AA at the new raster edge; same defringe rule.
    b=np.array(result);m=b[:,:,3]>0
    protected=np.array(Image.fromarray(interior_white).crop(box).resize(result.size,Image.Resampling.NEAREST))
    for _ in range(7 if jpg else 5):m &= ~(boundary(m)&bright_edge.sat_ok(b[:,:,:3])&~protected)
    b[:,:,3]=np.where(m,b[:,:,3],0);result=Image.fromarray(b)
    metrics['crop']=box
    return result,metrics

def comparison(c,im,result):
    sheet=Image.new('RGB',(960,660),'#343443');d=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',20)
    for i,(label,pic) in enumerate([('原圖',im),('處理後',result)]):
        pic=pic.copy();pic.thumbnail((450,590),Image.Resampling.LANCZOS)
        sheet.paste(pic,(i*480+(480-pic.width)//2,55+(590-pic.height)//2),pic)
        d.text((i*480+15,12),c['name']+' / '+label,font=font,fill='white')
    sheet.save(OUT/(c['id']+'-before-after.png'))

def main():
    old={c['id'] for c in catalog()+SCENE_CARDS}
    assert not old & {c['id'] for c in EXTRA_CARDS},old & {c['id'] for c in EXTRA_CARDS}
    OUT.mkdir(parents=True,exist_ok=True);rows=[]
    for c in EXTRA_CARDS:
        if c['kind']=='depth':
            continue  # Layered assets are rebuilt by prepare_round40.py.
        im=Image.open(source(c)).convert('RGBA')
        if c['kind']=='flat':
            # Preservation-first review draft. A strict 5:7 crop cuts subjects in
            # these originals; transparent padding is an explicitly reported deviation.
            resized=im.copy();resized.thumbnail((600,840),Image.Resampling.LANCZOS)
            result=Image.new('RGBA',(600,840),(0,0,0,0))
            offset=((600-resized.width)//2,(840-resized.height)//2)
            result.paste(resized,offset)
            metrics={'method':'full original resized + transparent padding (crop exception)',
                     'image_size':resized.size,'offset':offset,'crop':(0,0,*im.size)}
        else:
            result,metrics=cutout(im,source(c).suffix.lower()=='.jpg')
        result.save(HERE/'art'/c['file'],optimize=True)
        comparison(c,im,result)
        if c['kind']=='framed':
            # 判準只有一份，在 bright_edge.py（2026-09-09 使用者裁決：飽和的填色不算白毛邊）。
            # 產圖時與事後用 check_bright_edge.py 複驗，量到的是同一個數字。
            metrics.update(bright_edge.measure(np.array(result)))
        row={**c,'source':source(c).name,'original_size':im.size,'output_size':result.size,**metrics};rows.append(row)
        print(c['id'],result.size,metrics.get('bright_boundary_ratio'),metrics.get('new_interior_hole_pixels'))
    (OUT/'cutout-metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':main()
