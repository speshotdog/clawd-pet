"""Run retained checks with separate evidence and real subprocess exit records.

The loader changes only the old evidence-directory literal, including in imported
check helpers. Assertions and test inputs are unchanged; historical inputs are
copied byte-for-byte into the new evidence directory before execution.
"""
from pathlib import Path
import importlib.abc, importlib.util, json, os, shutil, subprocess, sys, time

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'docs/clicker/shots/round34'
RETAINED=OUT/'retained'
EVIDENCE='docs/clicker/shots/round34/retained'

class EvidenceLoader(importlib.abc.MetaPathFinder,importlib.abc.Loader):
    def find_spec(self,fullname,path=None,target=None):
        file=HERE/(fullname+'.py')
        if fullname.startswith(('check_','probe_')) and file.exists():
            return importlib.util.spec_from_file_location(fullname,file,loader=self)
    def create_module(self,spec):return None
    def exec_module(self,module):
        file=Path(module.__spec__.origin)
        exec(compile(source(file),str(file),'exec'),module.__dict__)

def source(file):
    return file.read_text(encoding='utf-8').replace('docs/clicker/shots/round33',EVIDENCE)

def main():
    global EVIDENCE
    OUT.mkdir(parents=True,exist_ok=True);RETAINED.mkdir(exist_ok=True)
    temporary=OUT/'temporary';temporary.mkdir(exist_ok=True)
    os.environ.update(TEMP=str(temporary),TMP=str(temporary),PYTHONIOENCODING='utf-8')
    if sys.argv[1]=='--child':
        if sys.argv[2].startswith('probe_'):
            EVIDENCE='docs/clicker/shots/round34/diagnostics'
            (ROOT/EVIDENCE).mkdir(exist_ok=True)
        sys.meta_path.insert(0,EvidenceLoader())
        file=HERE/sys.argv[2];sys.argv=sys.argv[2:]
        exec(compile(source(file),str(file),'exec'),dict(__name__='__main__',__file__=str(file)))
        return
    for name in ['before-foil-pack.webp','frozen-before.json','frozen-before-reproduction.html']:
        original=ROOT/'docs/clicker/shots/round33'/name
        if original.exists():shutil.copy2(original,RETAINED/name)
    portable=RETAINED/'portable';portable.mkdir(exist_ok=True)
    shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',portable/'production.html')
    scripts=sys.argv[1:] or []
    for command in scripts:
        args=command.split();stamp=str(time.time_ns());log=OUT/(stamp+'-'+Path(args[0]).stem+'.log')
        started=time.monotonic()
        with log.open('w',encoding='utf-8') as stream:
            run=subprocess.run([sys.executable,__file__,'--child',*args],cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT)
        row=dict(command=['python','_art/holo-test/check_retained_round34.py',command],script=args,exit=run.returncode,seconds=round(time.monotonic()-started,2),log=log.name)
        (OUT/(stamp+'-exit.json')).write_text(json.dumps(row,indent=2))
        print(json.dumps(row),flush=True)

if __name__=='__main__':main()
