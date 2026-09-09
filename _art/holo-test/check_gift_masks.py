"""Measure all-frame alpha spill for static, decimated and original gift masks."""
import json
from pathlib import Path
from base64 import b64encode
import re
import shutil

import numpy as np
from PIL import Image, ImageSequence, ImageDraw

HERE = Path(__file__).resolve().parent
SHOTS = HERE.parents[1] / 'docs/clicker/shots/round39'


def measure():
    results = {}
    for kind in ('idle', 'alt'):
        art = [np.asarray(f.convert('RGBA'))[:, :, 3].copy() for f in ImageSequence.Iterator(Image.open(HERE/'gift'/f'layer-mohuashaonv-{kind}.webp'))]
        masks = [f.convert('RGBA').copy() for f in ImageSequence.Iterator(Image.open(HERE/'gift'/f'layer-mohuashaonv-{kind}-mask.webp'))]
        union = masks[0].copy()
        union.putalpha(Image.fromarray(np.maximum.reduce([np.asarray(m)[:,:,3] for m in masks])))
        candidates = {'frame0':[masks[0]], 'union':[union], '15fps':masks[::2], '10fps':masks[::3], 'original':masks}
        rows = {}
        for name, seq in candidates.items():
            step = {'15fps':2,'10fps':3}.get(name,1)
            alphas = [np.asarray(m.getchannel('A').resize((600,840),Image.Resampling.BILINEAR)) for m in seq]
            spill=[]
            ious=[]
            for i,a in enumerate(art):
                m = alphas[min(i//step,len(alphas)-1)]
                spill.append(float(((m>0)&(a==0)).sum()/a.size*100))
                ious.append(float(((m>127)&(a>127)).sum()/((m>127)|(a>127)).sum()))
            path=SHOTS/f'{kind}-{name}.webp'
            if name == 'original':
                shutil.copyfile(HERE/'gift'/f'layer-mohuashaonv-{kind}-mask.webp',path)
            else:
                seq[0].save(path,format='WEBP',save_all=len(seq)>1,append_images=seq[1:],duration=33*step,loop=0,lossless=True)
            rows[name]={'frames':len(seq),'durationMs':2970 if len(seq)>1 else None,'maxSpillPercent':max(spill),
                        'worstFrame':int(np.argmax(spill)), 'frame0IoU':ious[0], 'minIoU':min(ious), 'spillPerFrame':spill}
        results[kind]=rows
        # Ideal full-resolution static silhouettes also fail: distinguish motion
        # spill from the existing small mask's resampling fringe.
        rows['exactArtStatic'] = {name:max(float(((m>0)&(a==0)).sum()/a.size*100) for a in art)
                                 for name,m in [('frame0',art[0]),('union',np.maximum.reduce(art))]}
        i=rows['frame0']['worstFrame']
        canvas=Image.new('RGB',(1200,880),'#201b29')
        for col,name in enumerate(('frame0','original')):
            m=np.asarray(candidates[name][0 if name=='frame0' else i].getchannel('A').resize((600,840),Image.Resampling.BILINEAR))
            rgb=np.zeros((840,600,3),np.uint8);rgb[:]=[32,27,41]
            rgb[art[i]>0]=[200,200,215]
            rgb[(m>0)&(art[i]==0)]=[255,40,80]
            canvas.paste(Image.fromarray(rgb),(col*600,40))
        ImageDraw.Draw(canvas).text((10,10),f'{kind} frame {i}: STATIC FRAME 0 (left) / ORIGINAL (right); red = spill',fill='white')
        canvas.save(SHOTS/f'{kind}-spill-comparison.png')
    (SHOTS/'mask-analysis.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps({k:{n:{x:y for x,y in r.items() if x!='spillPerFrame'} for n,r in v.items()} for k,v in results.items()},indent=2))
    # Candidate pages differ only in the embedded masks; A must already be applied.
    source=(HERE/'gift-mohuashaonv.html').read_text(encoding='utf-8')
    for name in ('frame0','union','15fps','10fps','original'):
        page=source
        for block, key,kind in [('mask-data','layer-mohuashaonv-subject.png','idle'),('asset-data','alt-mask','alt')]:
            pattern=rf'(<script type="application/json" id="{block}">)(.*?)(</script>)'
            match=re.search(pattern,page,re.S)
            data=json.loads(match[2]);data[key]='data:image/webp;base64,'+b64encode((SHOTS/f'{kind}-{name}.webp').read_bytes()).decode()
            page=page[:match.start(2)]+json.dumps(data,separators=(',',':'))+page[match.end(2):]
        (SHOTS/f'candidate-{name}.html').write_text(page,encoding='utf-8')


if __name__=='__main__':
    measure()
