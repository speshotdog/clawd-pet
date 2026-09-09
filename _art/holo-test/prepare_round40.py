"""Original-pixel masks and nearest-boundary cloning; no generated RGB artwork."""
import json
import cv2
import numpy as np
from scipy import ndimage as nd
from PIL import Image, ImageDraw
from prepare_round32 import source, HERE
from pool_data import EXTRA_CARDS

OUT=HERE.parents[1]/'docs/clicker/shots/round40'
IDS=('zhenqiqiu','zhenjunyue','shabaolingzhu')

def polygon(size, points):
    im=Image.new('L',size);ImageDraw.Draw(im).polygon(points,fill=255)
    return np.array(im)>0

def subject_mask(rgb, ident):
    h,w=rgb.shape[:2]
    if ident=='zhenqiqiu':
        # The blue sky separates the outlined balloon (including its string) from clouds.
        sky=(rgb[:,:,2].astype(int)-rgb[:,:,0]>35)&(rgb[:,:,1]>120)
        labels,_=nd.label(~sky)
        mask=labels==labels[400,400]
        return nd.binary_fill_holes(mask)
    if ident=='zhenjunyue':
        points=[(155,110),(209,109),(302,184),(380,159),(483,173),(506,113),(550,93),
                (588,120),(647,245),(697,322),(740,427),(721,503),(690,548),
                (592,553),(646,585),(639,622),(602,656),(543,678),(482,659),
                (432,617),(443,665),(414,697),(340,705),(265,684),(240,650),
                (255,591),(264,566),(230,563),(221,601),(181,636),(111,645),
                (51,632),(29,611),(48,574),(88,542),(140,515),(121,466),
                (132,408),(175,320),(155,225)]
        region=polygon((w,h),points)
        gc=np.where(region,cv2.GC_PR_FGD,cv2.GC_BGD).astype('uint8')
        gc[nd.binary_erosion(region,iterations=16)]=cv2.GC_FGD
        cv2.setRNGSeed(40)
        cv2.grabCut(rgb,gc,None,np.zeros((1,65)),np.zeros((1,65)),5,cv2.GC_INIT_WITH_MASK)
        return nd.binary_fill_holes((gc==1)|(gc==3))
    # Selection follows the castle's existing outline, not the sheep behind it.
    points=[(121,565),(121,549),(146,517),(170,497),(177,413),(183,384),(218,378),
            (227,352),(270,344),(325,343),(330,400),(362,397),(365,341),(403,335),
            (483,333),(496,343),(495,405),(528,407),(530,345),(542,330),(585,331),
            (627,343),(638,354),(635,481),(655,511),(677,539),(688,565),(708,581),
            (706,594),(676,605),(628,607),(607,615),(578,611),(549,618),(485,620),
            (432,628),(372,620),(340,618),(306,616),(267,608),(231,600),(208,604),
            (176,596),(157,586),(144,574)]
    return polygon((w,h),points)

def main():
    OUT.mkdir(parents=True,exist_ok=True);rows=[]
    for ident in IDS:
        c=next(c for c in EXTRA_CARDS if c['id']==ident)
        im=Image.open(source(c)).convert('RGB');rgb=np.array(im);h,w=rgb.shape[:2]
        mask=subject_mask(rgb,ident)
        # Include the source antialias fringe, then clone from outside that fringe.
        mask=nd.binary_dilation(mask,iterations=1)
        hole=nd.binary_dilation(mask,iterations=4)
        nearest=nd.distance_transform_edt(hole,return_distances=False,return_indices=True)
        bg=rgb.copy();bg[hole]=rgb[nearest[0][hole],nearest[1][hole]]
        subject=np.dstack([rgb,mask.astype('uint8')*255])
        bbox=Image.fromarray(subject).getbbox()
        # Keep all selected pixels and original height; only crop peripheral scenery.
        if ident=='shabaolingzhu': left,right=116,878
        elif ident=='zhenqiqiu': left,right=max(0,bbox[0]-8),min(w,bbox[2]+8)
        else: left,right=max(0,bbox[0]-8),min(w,bbox[2]+8)
        width=right-left;target_h=round(width*7/5)
        assert target_h>=h
        top=(target_h-h)//2;bottom=target_h-h-top
        def frame(a, transparent=False):
            a=a[:,left:right]
            pads=((top,bottom),(0,0))+(((0,0),) if a.ndim==3 else ())
            a=np.pad(a,pads,mode='constant' if transparent else 'edge')
            return Image.fromarray(a).resize((600,840),Image.Resampling.LANCZOS)
        sub=frame(subject,True);back=frame(np.dstack([bg,np.full((h,w),255,'uint8')]))
        sub.save(HERE/f'layer-{ident}-subject.png');back.save(HERE/f'layer-{ident}-background.png')
        before=rgb.copy();before[hole]=[255,0,255]
        frame(before).save(OUT/f'{ident}-hole-before.png');back.save(OUT/f'{ident}-hole-after.png')
        Image.alpha_composite(back.convert('RGBA'),sub).save(OUT/f'{ident}-aligned.png')
        Image.fromarray(mask.astype('uint8')*255).save(OUT/f'{ident}-source-mask.png')
        inner=hole & ~nd.binary_erosion(hole,iterations=3)
        outer=nd.binary_dilation(hole,iterations=3)&~hole
        delta=float(np.abs(bg[inner].mean(0)-rgb[outer].mean(0)).mean())
        # Compare each repeated edge row against the three adjacent original rows.
        extension_delta=max(float(np.abs(bg[:3,left:right].mean(0)-bg[0,left:right]).mean()),
                            float(np.abs(bg[-3:,left:right].mean(0)-bg[-1,left:right]).mean()))
        assert delta<=8 and extension_delta<=6
        assert (top+bottom)/target_h<=.30
        assert not mask[:,:left].any() and not mask[:,right:].any()
        assert np.array(back)[:,:,3].min()==255
        rows.append(dict(id=ident,name=c['name'],original_size=[w,h],output_size=[600,840],
            source_alpha_bbox=bbox,crop=[left,0,right,h],extension_top=top,extension_bottom=bottom,
            extension_ratio=(top+bottom)/target_h,extension_color_delta=extension_delta,
            hole_pixels=int(hole.sum()),unfilled_pixels=int((np.array(back)[:,:,3]!=255).sum()),
            boundary_color_delta=delta,output_alpha_bbox=sub.getbbox(),
            subject_pixels_cropped=int(mask[:,:left].sum()+mask[:,right:].sum()),
            cloned_rgb_all_from_source=bool(np.array_equal(bg[hole],rgb[nearest[0][hole],nearest[1][hole]]))))
        print(rows[-1],flush=True)
    (OUT/'depth-metrics.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    # Re-run the original framed batch with the shared saturation protection.
    import prepare_round32 as clean
    clean.OUT=OUT
    cutouts=[]
    for c in EXTRA_CARDS:
        if c['kind']!='framed':continue
        im=Image.open(source(c)).convert('RGBA')
        result,metrics=clean.cutout(im,source(c).suffix.lower()=='.jpg')
        result.save(HERE/'art'/c['file'])
        clean.comparison(c,im,result)
        metrics.update(clean.bright_edge.measure(np.array(result)))
        cutouts.append(dict(id=c['id'],name=c['name'],original_size=im.size,output_size=result.size,**metrics))
    (OUT/'cutout-metrics.json').write_text(json.dumps(cutouts,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':main()
