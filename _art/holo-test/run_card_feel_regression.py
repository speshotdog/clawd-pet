"""Run the unchanged map/team acceptance into this round's evidence folder."""
import shutil
import check_map20 as suite
from pathlib import Path
suite.OUT=suite.ROOT/'docs/clicker/shots/card-feel/regression'
suite.OUT.mkdir(parents=True,exist_ok=True)
for name in ['protected-before.json','build.json']:
    shutil.copyfile(suite.ROOT/'docs/clicker/shots/team-round3'/name,suite.OUT/name)
raise SystemExit(suite.main())
