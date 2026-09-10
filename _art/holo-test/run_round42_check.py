"""Capture the real exit code, preserving every attempt in its own log/JSON."""
from pathlib import Path
import subprocess,sys,json,time
root=Path(__file__).resolve().parents[2]
out=root/'docs/clicker/shots/round42'
stamp=str(time.time_ns());cmd=[sys.executable,*sys.argv[1:]]
run=subprocess.run(cmd,cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace')
log=stamp+'-'+Path(sys.argv[1]).stem
(out/(log+'.log')).write_text(run.stdout+run.stderr,encoding='utf-8')
(out/(log+'.json')).write_text(json.dumps({'command':cmd,'exit_code':run.returncode,'log':log+'.log'},indent=2),encoding='utf-8')
print(run.stdout[-5000:]+run.stderr[-1000:]);print('REAL EXIT CODE',run.returncode,flush=True)
sys.exit(run.returncode)
