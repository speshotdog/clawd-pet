"""Record actual subprocess return codes, including failures, without shell masking."""
from pathlib import Path
import subprocess,sys,json,os,time
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/round31';OUT.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,PYTHONIOENCODING='utf-8')
rows=[]
for arg in sys.argv[1:]:
    cmd=[sys.executable,str(ROOT/'_art/holo-test'/arg.split()[0]),*arg.split()[1:]]
    name=arg.replace(' ','_').replace('/','_')
    before=time.time()
    with (OUT/(name+'.log')).open('w',encoding='utf-8') as log:
        result=subprocess.run(cmd,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,env=env)
    row={'command':'python _art/holo-test/'+arg,'exit_code':result.returncode,'seconds':round(time.time()-before,2)}
    rows.append(row);print(json.dumps(row),flush=True)
    path=OUT/'command-exits.json'
    previous=json.loads(path.read_text()) if path.exists() else []
    path.write_text(json.dumps(previous+[row],indent=2),encoding='utf-8')
sys.exit(1 if any(r['exit_code'] for r in rows) else 0)
