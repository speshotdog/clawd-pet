"""Assert the brief's numeric criteria against saved, matched browser evidence."""
import json, math, sys
import numpy as np
from PIL import Image
from check_gacha_round34 import OUT
from check_glow_candidates_round34 import metrics

def read(name):return json.loads((OUT/(name+'.json')).read_text())
def main():
    rows=[]
    def check(name,ok,data):rows.append(dict(check=name,pass_=bool(ok),data=data));print(name,'PASS' if ok else 'FAIL',flush=True)
    before=read('before')
    for label in ['after-A','final-portable-A']:
        row=metrics(label)
        a=np.asarray(Image.open(OUT/'before-held.png').convert('L'),dtype=float)
        b=np.asarray(Image.open(OUT/(label+'-held.png')).convert('L'),dtype=float)
        r=before['glow']['rect'];x,y,w,h=[r[k] for k in ['x','y','width','height']]
        box=(slice(math.ceil(y),math.floor(y+h)),slice(math.ceil(x),math.floor(x+w)))
        row.update(heldBefore=float(a.mean()),heldAfter=float(b.mean()),heldRatio=float(b.mean()/a.mean()),cardStdBefore=float(a[box].std()),cardStdAfter=float(b[box].std()),cardStdRatio=float(b[box].std()/a[box].std()))
        check(label+' A full frame <=15%',row['meanRatio']<=1.15,row)
        check(label+' A line >=40% and width >=1.5x',row['lineRatio']>=1.4 and row['widthRatio']>=1.5,row)
        check(label+' A card contrast >=98%',row['cardStdRatio']>=.98,row)
        check(label+' A focus-held <=105%',row['heldRatio']<=1.05,row)
    isolated=read('background-isolated')
    check('A isolated full background <=15%',isolated['ratio']<=1.15,isolated)
    for label in ['after','after-portable']:
        final=read(label)
        if 'glow' in final:check(label+' reduced background animations',final['glow']['reducedAnimations']==0,final['glow'])
        for old,new in zip(before['layout'],final['layout']):
            w,h=new['viewport'];n=new['n'];rects=new['rects'];m=new['margins']
            overlap=[]
            for i,a in enumerate(rects):
                for b in rects[i+1:]:overlap.append(max(0,min(a['x']+a['w'],b['x']+b['w'])-max(a['x'],b['x']))*max(0,min(a['y']+a['h'],b['y']+b['h'])-max(a['y'],b['y'])))
            ok=not any(overlap) and new['gap']>=8 and not new['errors']
            if w>600:ok &= min(m[:2])>=w*.06 and min(r['w'] for r in rects)>=(170 if w<=1024 else 190) and (n!=10 or min(m[2:])>=70)
            else:ok &= new==old
            check(f'{label} B {w} {n}',ok,new)
            if w==1440:check(f'{label} B 1440 {n} exactly unchanged',old==new,dict(before=old,after=new))
        light=final['light'];oldlight=before['light']
        check(label+' C monotonic peaks and durations',all(a['peak']<=b['peak'] and a['duration']<=b['duration'] for a,b in zip(light,light[1:])),light)
        check(label+' C epic >=110% rare and >=200ms',light[2]['peak']>=light[1]['peak']*1.1 and light[2]['duration']>=200,light[1:3])
        check(label+' C common and rare unchanged',all(light[i]['peak']==oldlight[i]['peak'] and light[i]['duration']==oldlight[i]['duration'] for i in [0,1]),light[:2])
        check(label+' C legendary and mythic not reduced',all(light[i]['peak']>=oldlight[i]['peak'] and light[i]['duration']>=oldlight[i]['duration'] for i in [3,4]),light[3:])
    for label,row in read('glow-candidates').items():
        check(label+' A p95 <=20ms and baseline+2ms',row['timing']['p95']<=20 and row['timing']['p95']<=before['timing']['p95']+2,dict(before=before['timing'],after=row['timing']))
    for label in ['final-timing','final-portable-timing']:
        if (OUT/(label+'.json')).exists():
            row=read(label)['timing'];check(label+' A p95 <=20ms and baseline+2ms',row['p95']<=20 and row['p95']<=before['timing']['p95']+2,row)
    gpu=read('gpu-timing');baseline=gpu['results']['baseline']['p95']
    for label,row in gpu['results'].items():
        if label!='baseline':check('Chrome GPU '+label+' p95 <=20ms and baseline+2ms',row['p95']<=20 and row['p95']<=baseline+2,dict(environment=gpu['environment'],baseline=baseline,**row))
    (OUT/'acceptance-round34.json').write_text(json.dumps(rows,indent=2))
    return int(any(not r['pass_'] for r in rows))

if __name__=='__main__':sys.exit(main())
