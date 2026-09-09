"""Retained mythical-first return trigger: F+1290, 20 skips in each build."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json,shutil
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance,state
rows=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='return29-') as tmp:
 b=pw.chromium.launch();copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
  p,errors=open_page(b,file.as_uri());p.evaluate('window.__clockRender=false')
  for repeat in range(20):
   start(p,[BY['mythic']]+[BY['common']]*9);advance(p,3400)
   assert p.evaluate('__ceremony.events.filter(e=>e.index===0&&e.type==="phase-start").at(-1).phase')=='return'
   p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181);assert state(p)['collectable'] and state(p)['complete']==10
  assert not errors;rows.append({'entry':label,'return_skips':20,'trigger_ms':3400});p.close()
 b.close()
(OUT/'return-final.json').write_text(json.dumps(rows,indent=2),encoding='utf-8');print(rows)
