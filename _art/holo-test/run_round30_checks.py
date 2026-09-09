"""Run retained checks, persist real exit codes (including failures), never commit."""
from pathlib import Path
import subprocess,sys,json,os,time
P=Path(__file__).resolve().parent;OUT=P/'verify-round30';OUT.mkdir(exist_ok=True)
groups={
 'regression':[
  ['check_gacha_controls_round29.py'],['check_gacha_return_round29.py'],
  ['check_gacha_ceremony_edges_round28.py'],['check_gacha_fx_round28.py'],
  ['check_gacha_ceremony_round28.py','--interaction-only'],
  ['check_gacha_ceremony_round29.py','--live'],
  ['check_gacha_artifacts_round29.py'],
  ['check_gacha_card_regression.py','--cards-only'],['check_gacha_card_regression.py','--race-only'],['check_gacha_card_regression.py','--flows-only']],
 'final':[['check_gacha_ceremony_round30.py','--layout'],['check_gacha_ceremony_round30.py','--pixels']],
 'core':[['check_gacha_ceremony_round30.py','--core'],['check_gacha_ceremony_round28.py','--core-only']],
 'retained':[['check_gacha_ceremony_round28.py','--core-only']],
 'return-final':[['check_gacha_card_regression.py','--race-only','--timing-phase=return']],
 'finish-regression':[['check_gacha_card_regression.py','--race-only'],['check_gacha_card_regression.py','--flows-only']],
}
group=sys.argv[1];records=[];env={**os.environ,'PYTHONIOENCODING':'utf-8','CHROME_LOG_FILE':str(OUT/'chromium.log')}
for args in groups[group]:
 name='-'.join(args).replace('.py','').replace('--','');log=OUT/(name+'.log');started=time.time()
 with log.open('w',encoding='utf-8') as output:r=subprocess.run([sys.executable,str(P/args[0]),*args[1:]],cwd=P.parent.parent,env=env,stdout=output,stderr=subprocess.STDOUT)
 record={'command':'python '+' '.join(args),'exit':r.returncode,'seconds':round(time.time()-started,1),'log':log.name};records.append(record)
 (OUT/f'command-exits-{group}.json').write_text(json.dumps(records,indent=2),encoding='utf-8');print(record,flush=True)
sys.exit(1 if any(r['exit'] for r in records) else 0)
