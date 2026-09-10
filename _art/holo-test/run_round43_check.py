"""Run unmodified check/build entry points; retain real exits and historical evidence."""
from pathlib import Path
import subprocess,sys,time,json,os,shutil
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'docs/clicker/shots/round43'
OUT.mkdir(exist_ok=True)
name=sys.argv[1];stamp=str(time.time_ns());prefix=OUT/(stamp+'-'+Path(name).stem)
# Older checks write to historical paths. Preserve their original bytes, while
# retaining the new measurements separately in this round's evidence directory.
historical=[ROOT/'docs/clicker/shots/round33',ROOT/'docs/clicker/shots/round42'] if name in ['check_new_cards_round32.py','check_round42_assets.py','check_round42_contracts.py'] else []
before={p:p.read_bytes() for folder in historical for p in folder.rglob('*') if p.is_file() and p.suffix in ('.json','.png','.jpg','.log','.html')}
if name=='check_round42_contracts.py':
    # Its unchanged entry point expects the relocated build at the old path.
    # Supply the current standalone there, then restore the historical copy below.
    relocated=ROOT/'docs/clicker/shots/round42/portable/deluxe-gacha-b.html'
    relocated.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',relocated)
env=dict(os.environ,PYTHONIOENCODING='utf-8')
with prefix.with_suffix('.log').open('w',encoding='utf-8') as log:
    run=subprocess.run([sys.executable,str(HERE/name),*sys.argv[2:]],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
for p,content in before.items():
    if p.exists() and p.read_bytes()!=content:
        if p.suffix=='.json':
            dest=OUT/'retained'/p.parent.name;dest.mkdir(parents=True,exist_ok=True);(dest/p.name).write_bytes(p.read_bytes())
        p.write_bytes(content)
record={'script':name,'args':sys.argv[2:],'exit_code':run.returncode,'log':prefix.with_suffix('.log').name}
if name=='check_round43_idle.py' and (OUT/'idle-metrics.json').exists():
    prefix.with_name(prefix.name+'-metrics.json').write_bytes((OUT/'idle-metrics.json').read_bytes())
prefix.with_suffix('.json').write_text(json.dumps(record,indent=2),encoding='utf-8')
print(json.dumps(record),flush=True)
sys.exit(run.returncode)
