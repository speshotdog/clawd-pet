"""Independent-process repeatability; mean(max-channel absolute error) must be < 1."""
import argparse, json, subprocess, sys, shutil
from pathlib import Path
import numpy as np
from PIL import Image,ImageStat
from scope3_capture import SCOPE, artifact_hashes, tool_hashes
HERE=Path(__file__).resolve().parent
SHOTS=HERE.parents[1]/'docs/clicker/shots/scope3/determinism'

def main():
    global SHOTS
    ap=argparse.ArgumentParser()
    ap.add_argument('--viewport',default='1440x1200')
    ap.add_argument('--out',type=Path)
    ap.add_argument('--team-role',choices=['overview','detail'],default='overview')
    ap.add_argument('--card',default='rocketdog')
    ap.add_argument('--entry',default=','.join(SCOPE))
    ap.add_argument('--runs',type=int,default=3)
    ap.add_argument('--width',type=int,default=260)
    args=ap.parse_args()
    if args.runs < 3: ap.error('at least three runs required')
    if args.out: SHOTS=args.out
    names=args.entry.split(',')
    hashes=artifact_hashes(HERE)
    results={'sourceHashes':hashes,'toolHashes':tool_hashes(),'threshold':'mean(max RGB absolute difference) < 1.0',
             'viewport':args.viewport,'runs':args.runs,'card':args.card,'entries':{},'errors':[]}
    for run in range(args.runs):
        out=SHOTS/(args.card+('-detail' if args.team_role=='detail' else ''))/('run%d'%run);out.mkdir(parents=True,exist_ok=True)
        for entry in names: (out/('%s-%s-%dpx.png'%(args.card,entry,args.width))).unlink(missing_ok=True)
        proc=subprocess.run([sys.executable,str(HERE/'shoot_card_parity_samesize.py'),
            '--viewport',args.viewport,'--card',args.card,'--team-role',args.team_role,'--width',str(args.width),'--entries',args.entry,'--out',str(out)],capture_output=True)
        (out/'capture.log').write_bytes(proc.stdout+proc.stderr)
        if proc.returncode:
            results['errors'].append({'run':run,'exit':proc.returncode})
            print(proc.stdout.decode('utf-8','replace'));print(proc.stderr.decode('utf-8','replace'))
    for entry in names:
        paths=[SHOTS/(args.card+('-detail' if args.team_role=='detail' else ''))/('run%d'%i)/('%s-%s-%dpx.png'%(args.card,entry,args.width)) for i in range(args.runs)]
        if not all(p.exists() for p in paths):
            results['errors'].append({'entry':entry,'error':'missing fresh capture'});continue
        arrays=[np.asarray(Image.open(p).convert('RGB')).astype(int) for p in paths]
        visible=all(ImageStat.Stat(Image.open(p).convert('L')).stddev[0]>8 for p in paths)
        dimensions=all(a.shape==(round(args.width*7/5*2),args.width*2,3) for a in arrays)
        diffs=[]
        for i in range(len(arrays)):
            for j in range(i+1,len(arrays)):
                if arrays[i].shape != arrays[j].shape:
                    results['errors'].append({'entry':entry,'error':'shape mismatch'});continue
                delta=np.abs(arrays[i]-arrays[j]).max(axis=2)
                diffs.append({'a':i,'b':j,'mean':float(delta.mean()),'max':int(delta.max()),'over100':float((delta>100).mean())})
        ok=bool(diffs) and visible and dimensions and all(d['mean']<1.0 for d in diffs)
        results['entries'][entry]={'pass':ok,'pairs':diffs,'nonblank':visible,'correctDimensions':dimensions}
        print('%s %s worst mean %.6f'%('PASS' if ok else 'FAIL',entry,max((d['mean'] for d in diffs),default=float('inf'))))
    results['artifactsUnchanged']=hashes==artifact_hashes(HERE)
    results['pass']=not results['errors'] and results['artifactsUnchanged'] and len(results['entries'])==len(names) and all(v['pass'] for v in results['entries'].values())
    SHOTS.mkdir(parents=True,exist_ok=True)
    (SHOTS/(args.card+('-detail' if args.team_role=='detail' else '')+'-result.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
    return 0 if results['pass'] else 1

if __name__=='__main__': sys.exit(main())
