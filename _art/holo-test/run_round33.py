"""Run one command, preserve its actual status and complete output."""
from pathlib import Path
import subprocess, sys, time, json, os
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/round33'
OUT.mkdir(parents=True,exist_ok=True)
args=sys.argv[1:]
records=OUT/'command-exits.json'
rows=json.loads(records.read_text()) if records.exists() else []
log=OUT/f'{time.time_ns()}-{Path(args[0]).stem}.log'
t=time.monotonic()
env=dict(os.environ,PYTHONIOENCODING='utf-8')
with log.open('w',encoding='utf-8') as f:
    p=subprocess.run(args,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,env=env)
row=dict(command=args,exit_code=p.returncode,seconds=round(time.monotonic()-t,2),log=log.name)
(OUT/(log.stem+'.exit.json')).write_text(json.dumps(row,indent=2),encoding='utf-8')
rows=json.loads(records.read_text()) if records.exists() else []
rows.append(row);records.write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(row),flush=True)
print(log.read_text(encoding='utf-8')[-5000:])
sys.exit(p.returncode)
