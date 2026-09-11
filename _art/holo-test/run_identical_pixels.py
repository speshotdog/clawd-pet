"""Run all 7 entries x 3 card types x 3 viewports, gate each on 3 captures."""
import json
import subprocess
import sys
from pathlib import Path
from scope3_capture import artifact_hashes, tool_hashes, SCOPE
HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/identical'

def run(args, log):
    with log.open('wb') as f:
        p=subprocess.run([sys.executable,*args],cwd=HERE,stdout=f,stderr=subprocess.STDOUT)
    print(log.name,p.returncode,flush=True)
    return p.returncode

def main():
    results=[]
    sources=artifact_hashes(HERE)
    capture_tools=tool_hashes()
    for vp in ['1440x1200','1024x900','390x844']:
        for card in ['rocketdog','chaichai','mieshi']:
            gate_dir=OUT/'determinism'/vp
            gate_dir.mkdir(parents=True,exist_ok=True)
            gate=gate_dir/(card+'-result.json')
            # Reuse only complete gates tied to these exact artifacts and tools.
            rc=0
            prior=json.loads(gate.read_text(encoding='utf-8')) if gate.exists() else {}
            reusable=(prior.get('pass') is True and prior.get('viewport')==vp and prior.get('card')==card
                      and prior.get('sourceHashes')==sources and prior.get('toolHashes')==capture_tools
                      and set(prior.get('entries',{}))==set(SCOPE) and prior.get('runs',0)>=3)
            if not reusable:
                rc=run(['check_shot_determinism.py','--viewport',vp,'--card',card,'--out',str(gate_dir)],OUT/f'gate-{vp}-{card}.log')
            dest=OUT/'controlled'/vp
            dest.mkdir(parents=True,exist_ok=True)
            pixel_rc=run(['shoot_card_parity_samesize.py','--viewport',vp,'--card',card,'--compare','--determinism',str(gate),'--out',str(dest)],OUT/f'pixel-{vp}-{card}.log') if rc==0 else None
            results.append(dict(viewport=vp,card=card,gateExit=rc,pixelExit=pixel_rc))
            (OUT/'pixel-runs.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    return 0 if all(r['gateExit']==0 and r['pixelExit']==0 for r in results) else 1

if __name__=='__main__':sys.exit(main())
