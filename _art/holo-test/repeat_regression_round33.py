"""Three consecutive complete runs; never convert a failing child to success."""
import subprocess,sys
from pathlib import Path
H=Path(__file__).resolve().parent
codes=[]
for i in range(3):
    code=subprocess.call([sys.executable,str(H/'run_round33.py'),sys.executable,str(H/'check_gacha_card_regression.py')])
    codes.append(code);print('complete regression run',i+1,'exit',code,flush=True)
print('consecutive exits',codes,flush=True)
sys.exit(int(any(codes)))
