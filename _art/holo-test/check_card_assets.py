"""Compare every neutral front-face instance from the same full collection artifact.

The collector is check_card_parity.py --label scope3 --fixture auto --shots.
No missing entry, viewport, role, card, descendant or pseudo-element can pass.
Image natural dimensions are reported separately; all existing layer constraints remain strict.
"""
import argparse,json,sys,re,ast
from pathlib import Path
from scope3_json import read_json,resolve_input
from scope3_capture import SCOPE,artifact_hashes,digest
from scope3_layers import design,LAYER_JS
HERE=Path(__file__).resolve().parent
VPS=('1440x1200','1024x900','390x844')
REQUIRED=('card-lift','card-inner','card-face','face-stock','face-depth-bg','face-art','art-media',
          'face-frame','frame-material','face-plate','face-gem','face-text','face-name','face-rarity')
STYLE_KEYS=('transform','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat',
            'opacity','mixBlendMode','filter','objectFit','objectPosition','borderRadius',
            'maskImage','maskSize','maskPosition','maskRepeat','clipPath','content')
FULL_STYLE_KEYS=ast.literal_eval(re.search(r'const keys=(\[.*?\]);',LAYER_JS,re.S)[1])
TEXT_KEYS=('color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textShadow','webkitTextFillColor')

def evaluate(data,root=HERE):
    from pool_data import pool
    expected={c['id']:c for c in pool()}
    team={c['id'] for c in json.loads(re.search(r'const TEAM_DATA=(\{.*?\});',(root/'map20.html').read_text(encoding='utf-8'),re.S)[1])['cards']}
    masks=json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>',(root/'demo.html').read_text(encoding='utf-8'),re.S)[1])
    failures=[]; comparisons=0; dimensions={}; kinds=set(); roles=set()
    if data.get('sourceHashes') != artifact_hashes(root) or data.get('artifactsUnchanged') is not True:
        failures.append('artifact hashes missing or stale')
    refs={}
    for vp,rec in data.get('entries',{}).get('gacha-test',{}).get('viewports',{}).items():
        for c in rec.get('cards',[]):
            if c.get('pose')=='neutral': refs[(vp,c.get('canonicalId'))]=c
    for entry in SCOPE:
        for vp in VPS:
            key=entry+'@'+vp
            rec=data.get('entries',{}).get(entry,{}).get('viewports',{}).get(vp)
            if not isinstance(rec,dict) or rec.get('error'):
                failures.append(key+': missing record');continue
            samples=[c for c in rec.get('cards',[]) if c.get('pose')=='neutral']
            required_roles=('overview','detail') if entry=='team' else (('reveal',) if entry.startswith('gacha') else ('grid',))
            for role in required_roles:
                subset=[c for c in samples if c.get('role')==role]
                want=team if entry=='team' else set(expected)
                if entry in ('gacha','gacha-standalone'):
                    if len(subset)!=10: failures.append(key+': expected ten actual reveal slots')
                elif {c.get('canonicalId') for c in subset} != want or len(subset)!=len(want):
                    failures.append(key+': missing/excess cards in '+role)
            dimensions[key]=[]
            for c in samples:
                # Keep the original cross-viewport constraint: a single 1440x1200
                # reveal reference per card, not a different baseline per viewport.
                cid=c.get('canonicalId');ref=refs.get((VPS[0],cid)); layers=c.get('layers')
                label=key+'/'+str(cid)+'/'+str(c.get('role'))+'/'+str(c.get('instance'))
                if c.get('role') not in required_roles: failures.append(label+': unexpected role')
                if not ref or not isinstance(layers,list) or not layers:
                    failures.append(label+': missing reference/layers');continue
                spec=expected[cid];kind=spec.get('kind') or ('depth' if spec.get('scene') else 'flat' if spec.get('bleed') else 'framed')
                maskkey='layer-'+cid+'-subject.png' if spec.get('scene') else spec['file']
                count=31 if masks.get(maskkey) and kind!='flat' else 23
                if len(layers)!=count: failures.append(label+': unexpected descendant count '+str(len(layers)))
                for cls in REQUIRED:
                    if sum(cls in str(l.get('classes','')).split() for l in layers)!=1:
                        failures.append(label+': mandatory layer '+cls)
                for layer in layers:
                    required_keys=FULL_STYLE_KEYS if layer.get('classes') in ('face-name','face-rarity') else [k for k in FULL_STYLE_KEYS if k not in TEXT_KEYS]
                    for part in ('style','before','after'):
                        value=layer.get(part)
                        if not isinstance(value,dict) or any(not isinstance(value.get(k),str) or not value[k] for k in required_keys):
                            failures.append(label+': missing full styles/pseudo evidence')
                    if layer.get('tag')=='IMG':
                        image=layer.get('image')
                        if not isinstance(image,dict) or any(type(image.get(k)) is not int or image[k]<=0 for k in ('width','height')):
                            failures.append(label+': missing intrinsic image dimensions')
                a,b=design(ref['layers']),design(layers)
                comparisons+=1;kinds.add(kind);roles.add(c.get('role'))
                if a!=b:
                    for i,(x,y) in enumerate(zip(a,b)):
                        for field in x:
                            if x.get(field)!=y.get(field):
                                if isinstance(x[field],dict) and isinstance(y.get(field),dict):
                                    for prop in x[field]:
                                        if x[field].get(prop)!=y[field].get(prop): failures.append(label+': layer%d.%s.%s %r != %r'%(i,field,prop,x[field][prop],y[field].get(prop)))
                                else: failures.append(label+': layer%d.%s'%(i,field))
                dimensions[key].append({'card':cid,'role':c.get('role'),'images':[l['image'] for l in layers if l.get('image')]})
    return {'pass':not failures,'comparisons':comparisons,'differences':len(failures),'failures':failures,
            'kinds':sorted(kinds),'roles':sorted(roles),'dimensions':dimensions}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--input',type=Path,default=HERE.parents[1]/'docs/clicker/shots/parity/parity-scope3-final.json')
    ap.add_argument('--output',type=Path)
    args=ap.parse_args();args.input=resolve_input(args.input);data=read_json(args.input)
    result=evaluate(data);result['inputSha256']=digest(args.input);result['sourceHashes']=data.get('sourceHashes')
    out=args.output or args.input.parent/'asset-layers-scope3.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=1),encoding='utf-8')
    print('PASS' if result['pass'] else 'FAIL', 'comparisons',result['comparisons'],'differences',result['differences'])
    for item in result['failures'][:25]: print(item)
    print(out)
    return 0 if result['pass'] else 1
if __name__=='__main__': sys.exit(main())
