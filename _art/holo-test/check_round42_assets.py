"""Paired thresholds, fixed measurement definitions; never silently adjust limits."""
from pathlib import Path
import json
import numpy as np
from scipy import ndimage as nd
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/round42'

def luminance(im):return np.asarray(im.convert('RGB')).astype(float) @ np.array([.2126,.7152,.0722])
def pair(images,path,labels,zoom=1):
    images=[i.convert('RGB') for i in images]
    w=sum(i.width for i in images)+20*(len(images)+1);h=max(i.height for i in images)+55
    canvas=Image.new('RGB',(w,h),'#141824');d=ImageDraw.Draw(canvas);x=20
    for im,label in zip(images,labels):d.text((x,12),label,fill='white');canvas.paste(im,(x,35));x+=im.width+20
    canvas.save(path)

def main():
    result={};failures=[]
    for ident in ['shabaolingzhu','zhenzhen']:
        sub=Image.open(HERE/f'layer-{ident}-subject.png').convert('RGBA');bg=Image.open(HERE/f'layer-{ident}-background.png').convert('RGBA')
        a=np.asarray(sub)[:,:,3];b=sub.getbbox()
        row={'size':list(sub.size),'coverage_percent':float((a>0).mean()*100),'alpha_bbox':b,
             'height_percent':(b[3]-b[1])/840*100,'background_holes_under_subject':int((np.asarray(bg)[:,:,3][a>0]==0).sum())}
        result[ident]=row
        if ident=='shabaolingzhu' and not 28<=row['coverage_percent']<=55:failures.append('A alpha coverage')
        if ident=='zhenzhen' and not 38<=row['height_percent']<=62:failures.append('C sheep height')
        if row['background_holes_under_subject']:failures.append(ident+' background holes')
    metrics={}
    for name,path in [('before',OUT/'before/foil-pack.webp'),('after',HERE/'fx/foil-pack.webp'),('print',HERE/'fx/pack-print.png')]:
        im=Image.open(path).convert('RGBA');a=np.asarray(im);mask=a[:,:,3]>0;rgb=a[:,:,:3].astype(float);y=luminance(im)
        sat=np.divide(rgb.max(2)-rgb.min(2),rgb.max(2),out=np.zeros(mask.shape),where=rgb.max(2)>0)
        metrics[name]={'mean':float(y[mask].mean()),'p05':float(np.percentile(y[mask],5)),'p99':float(np.percentile(y[mask],99)),
                       'saturation_mean':float(sat[mask].mean()),'region_pixels':int(mask.sum())}
    metrics['saturation_ratio']=metrics['after']['saturation_mean']/metrics['print']['saturation_mean'];result['D1']=metrics
    m=metrics['after']
    if not 150<=m['mean']<=180:failures.append('D1 mean')
    if m['p05']<25:failures.append('D1 p05')
    if m['p99']>250:failures.append('D1 p99')
    if metrics['saturation_ratio']<.85:failures.append('D1 saturation')
    # Coordinate system: original 700x980 print. 0<distance<=3 outside
    # alpha>=128 subject; compare each pixel to nearest pixel at distance>3.
    source=Image.open(HERE/'cardback/subject-cutout.png').convert('RGBA');source=source.crop(source.getbbox())
    sw=int(700*.66);sh=int(source.height*sw/source.width);source=source.resize((sw,sh),Image.Resampling.LANCZOS)
    canvas=Image.new('L',(700,980));canvas.paste(source.getchannel('A'),(350-sw//2,int(980*.53)-sh//2))
    mask=np.asarray(canvas)>=128;dist=nd.distance_transform_edt(~mask);ring=(dist>0)&(dist<=3)
    nearest=nd.distance_transform_edt(dist<=3,return_distances=False,return_indices=True)
    rows={}
    for name,path in [('before',OUT/'before/pack-print.png'),('after',HERE/'fx/pack-print.png')]:
        y=luminance(Image.open(path));delta=np.abs(y-y[nearest[0],nearest[1]])
        rows[name]={'median_edge_delta':float(np.median(delta[ring])),'ring_pixels':int(ring.sum())}
    rgba=np.asarray(source);semi=(rgba[:,:,3]>0)&(rgba[:,:,3]<255)
    rows['source_alpha_edge']={'semi_transparent_pixels':int(semi.sum()),'near_white_pixels':int((semi&(rgba[:,:,:3].min(2)>235)).sum())}
    rows['method']='700x980 print; Euclidean outer 3px ring around alpha>=128; nearest adjacent background beyond 3px; Rec.709 absolute luminance difference'
    result['D2']=rows
    if not 3<=rows['after']['median_edge_delta']<=12:failures.append('D2 edge contrast')
    pair([Image.open(OUT/'before/foil-pack.webp'),Image.open(HERE/'fx/foil-pack.webp')],OUT/'D1-before-after.png',['BEFORE','AFTER'])
    # Both full-print and close contour comparisons are required to judge blending.
    pair([Image.open(OUT/'before/pack-print.png').crop((100,250,260,520)).resize((480,810)),Image.open(HERE/'fx/pack-print.png').crop((100,250,260,520)).resize((480,810))],OUT/'D2-edge-before-after.png',['BEFORE - 3x','AFTER - 3x'])
    result['failures']=failures
    (OUT/'asset-metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2),flush=True)
    raise SystemExit(1 if failures else 0)

if __name__=='__main__':main()
