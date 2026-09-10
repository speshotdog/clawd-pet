"""Package reviewed imagegen layers at 600x840; no changes to the B assets."""
from pathlib import Path
from PIL import Image
import numpy as np

HERE=Path(__file__).resolve().parent
SOURCE=HERE/'round42-source'
OUT=HERE.parents[1]/'docs/clicker/shots/round42'

def main():
    # A retains the established crop and 5:7 extension, shared by BOTH layers.
    for layer in ['subject','background']:
        im=Image.open(SOURCE/f'a-{layer}.png').convert('RGBA').resize((952,747),Image.Resampling.LANCZOS)
        crop=im.crop((116,0,878,747))
        frame=Image.new('RGBA',(762,1067))
        if layer=='background':
            frame.paste(crop.crop((0,0,762,1)).resize((762,160)),(0,0))
            frame.paste(crop.crop((0,746,762,747)).resize((762,160)),(0,907))
        frame.paste(crop,(0,160))
        frame.resize((600,840),Image.Resampling.LANCZOS).save(HERE/f'layer-shabaolingzhu-{layer}.png')
    for layer in ['subject','background']:
        im=Image.open(SOURCE/f'c-{layer}.png').convert('RGBA')
        if layer=='subject':
            # Explicit crop around the COMPLETE sticker including AA margin.
            # The generator left alpha 1..7 dust far outside the sheep. Keep
            # the full subject region; discard only outside this review box.
            crop=im.crop((176,540,895,1134));clean=Image.new('RGBA',im.size)
            clean.paste(crop,(176,540));im=clean
        im.resize((600,840),Image.Resampling.LANCZOS).save(HERE/f'layer-zhenzhen-{layer}.png')
    for ident in ['shabaolingzhu','zhenzhen']:
        bg=Image.open(HERE/f'layer-{ident}-background.png').convert('RGBA')
        sub=Image.open(HERE/f'layer-{ident}-subject.png').convert('RGBA')
        bg.save(OUT/f'{ident}-background-only.png')
        Image.alpha_composite(bg,sub).save(OUT/f'{ident}-composite.png')
        a=np.asarray(sub)[:,:,3];b=sub.getbbox()
        print(ident,{'coverage_percent':float((a>0).mean()*100),'bbox':b,'height_percent':(b[3]-b[1])/840*100,'background_holes':int((np.asarray(bg)[:,:,3][a>0]==0).sum())})
    for name in ['foil-pack','foil-tear']:
        Image.open(HERE/'fx'/f'{name}.png').save(HERE/'fx'/f'{name}.webp',quality=88,method=6)

if __name__=='__main__':main()
