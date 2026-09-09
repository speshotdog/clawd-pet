"""Final press-feedback cancellation and draw-owned animation cleanup, 20 repeats per entry."""
import json,shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance,state
rows=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='final-controls-') as tmp:
 b=pw.chromium.launch();copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
  p,errors=open_page(b,file.as_uri());p.evaluate('window.__clockRender=false')
  for repeat in range(20):
   start(p,[BY['mythic']]*5);advance(p,100);assert p.locator('.press-feedback').count()==1
   p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181)
   assert state(p)['collectable'] and p.locator('.press-feedback,.control-sheen').count()==0
   assert p.locator('.entry-actions').evaluate('e=>getComputedStyle(e).display')=='none'
   p.click('#finish');advance(p,221);assert state(p)['screen']=='entry'
   assert p.evaluate("document.querySelector('.entry-actions').getAnimations({subtree:true}).length")==0
   assert not any(state(p)[k] for k in ['anims','timers','rafs','voices'])
  # A complete mythic draw leaves only the three background CSS loops.
  start(p,[BY['mythic']]);advance(p,5000);assert state(p)['collectable']
  assert p.evaluate("document.querySelector('.stage-background').getAnimations().length")==0
  p.click('#finish');advance(p,221);assert p.evaluate("document.querySelector('.stage-background').getAnimations({subtree:true}).length")==3
  p.set_viewport_size({'width':390,'height':844});start(p,[BY['common']]*5);advance(p,100);p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181)
  assert p.locator('.press-feedback,.control-sheen').count()==0
  assert p.locator('.slot.mobile-current').count()==1
  assert p.evaluate("(()=>{const e=document.querySelector('.slot.mobile-current .face-name'),r=e.getBoundingClientRect();return document.elementFromPoint(r.right-5,r.y+r.height/2).closest('.slot').classList.contains('mobile-current')})()")
  p.screenshot(path=str(OUT/f'{label}-mobile-final.png'))
  assert not errors,errors;p.close();rows.append({'entry':label,'early_skip_repeats':20,'control_artifacts':0,'retained_stage_impacts':0})
 b.close()
(OUT/'final-controls.json').write_text(json.dumps(rows,indent=2),encoding='utf-8');print(rows)
