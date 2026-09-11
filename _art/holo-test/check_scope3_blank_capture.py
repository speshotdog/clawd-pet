"""A real blank card must fail capture, even if it would repeat perfectly."""
import json
import subprocess
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/scope3/blank-control'
fixture=OUT/'source';fixture.mkdir(parents=True,exist_ok=True)
page=fixture/'cards-remade-standalone.html'
page.write_text((HERE/page.name).read_text(encoding='utf-8')+
                '<style>.hcard{opacity:0!important}</style>',encoding='utf-8')
try:
    result=subprocess.run([sys.executable,str(HERE/'shoot_card_parity_samesize.py'),
                           '--entries','pool-standalone','--root',str(fixture),'--out',str(OUT/'shots')],capture_output=True)
    (OUT/'capture.log').write_bytes(result.stdout+result.stderr)
    evidence=json.loads((OUT/'shots/rocketdog-capture.json').read_text(encoding='utf-8'))
    ok=result.returncode==1 and any('blank or incorrectly sized' in e.get('error','') for e in evidence['errors'])
    (OUT/'result.json').write_text(json.dumps({'pass':ok,'exit':result.returncode,'errors':evidence['errors']},indent=2),encoding='utf-8')
    print('PASS' if ok else 'FAIL','blank capture rejected, exit',result.returncode)
finally:
    page.unlink()
raise SystemExit(0 if ok else 1)
