"""Run retained acceptance scripts unchanged, preserving their real exit codes."""
import os, subprocess, json, sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'docs/clicker/shots/round40'
names=sys.argv[1:] or ['check_demo_round8.py','check_demo_round9.py',
    'check_gacha_card_regression.py','check_gacha_followup.py','check_bright_edge.py',
    'check_new_cards_round32.py','check_gift_card.py','check_gift_perf.py']
env=dict(os.environ,PYTHONIOENCODING='utf-8',TEMP=str(OUT/'tmp'),TMP=str(OUT/'tmp'))
(OUT/'tmp').mkdir(parents=True,exist_ok=True)
path=OUT/'exit-codes.json'
rows=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
for name in names:
    args=[sys.executable,str(HERE/name)]
    if name.startswith('check_gift'):args+=['--tag','round40']
    with (OUT/(name+'.log')).open('w',encoding='utf-8') as log:
        result=subprocess.run(args,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
    rows.append(dict(script=name,args=args,exit_code=result.returncode))
    path.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print(name,result.returncode,flush=True)
