"""Isolate each wave source at the failed neighboring-label sample."""
import json,sys
import numpy as np
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,BY,start,advance,open_page
from check_gacha_layers_round31 import pair
from check_gacha_layers_round33 import box,OUT
rows=[]
final='--final' in sys.argv
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for seed in range(20):
  p,errors=open_page(b,(HERE/'deluxe-gacha-b-standalone.html').as_uri())
  p.evaluate('seed=>{let s=seed+1;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}',seed)
  p.set_viewport_size({'width':1024,'height':640});p.evaluate('window.__clockRender=false')
  p.add_style_tag(content='.reveal-shell{transition:none!important}')
  start(p,[BY['common']]*2+[BY['mythic']]+[BY['common']]*7)
  advance(p,1750+1680+1300+320+450)
  p.eval_on_selector_all('.slot:not(.is-revealing)',"es=>es.forEach(e=>e.classList.add('selected'))")
  for canvas,css in ([(.25,.4)] if final else [(.25,1),(.12,1),(0,1),(.25,.5),(.25,0)]):
   if final:assert p.locator('.shockwave').first.evaluate('e=>getComputedStyle(e).filter')=='opacity(0.4)'
   style=None if final else p.add_style_tag(content=f'.ceremony-canvas.over.high-impact{{opacity:{canvas}!important}}.shockwave{{filter:opacity({css})}}')
   wave,base=pair(p,'.shockwave,.ceremony-canvas.over')
   row={'seed':seed,'canvasOpacity':canvas,'cssOpacity':css,'labels':[]}
   for index in [0,1,2]:
    for sel in ['.face-name','.face-rarity']:
     r=box(p,f'.slot[data-i="{index}"] '+sel)
     a=np.asarray(base.crop(r).convert('L'));c=np.asarray(wave.crop(r).convert('L'))
     row['labels'].append(dict(index=index,label=sel,baseStd=float(a.std()),waveStd=float(c.std()),ratio=float(c.std()/a.std()) if a.std()>1 else None))
   if min(x['ratio'] for x in row['labels'] if x['ratio'] is not None)<.7:
    wave.save(OUT/f'A-label-seed{seed}-{canvas}-{css}-on.png');base.save(OUT/f'A-label-seed{seed}-{canvas}-{css}-off.png')
   rows.append(row)
   if style:style.evaluate('e=>e.remove()')
  assert not errors,errors
  p.close()
  (OUT/('A-label-seeds-final.json' if final else 'A-label-seeds.json')).write_text(json.dumps(rows,indent=2))
  print('seed',seed,'min',min(x['ratio'] for row in rows[-5:] for x in row['labels'] if x['ratio'] is not None),flush=True)
 if final:
  b.close()
  minimum=min(x['ratio'] for row in rows for x in row['labels'] if x['ratio'] is not None)
  print('final 20-seed minimum label contrast',minimum,flush=True)
  sys.exit(int(minimum<.7))
 p,errors=open_page(b,(HERE/'deluxe-gacha-b-standalone.html').as_uri())
 p.set_viewport_size({'width':1024,'height':640});p.evaluate('window.__clockRender=false')
 p.add_style_tag(content='.reveal-shell{transition:none!important}')
 start(p,[BY['common']]*2+[BY['mythic']]+[BY['common']]*7)
 advance(p,1750+1680+1300+320)
 for _ in range(9):
  advance(p,50)
  p.eval_on_selector_all('.slot:not(.is-revealing)',"es=>es.forEach(e=>e.classList.add('selected'))")
 for opacity in [.25,.18,.12,0]:
  style=p.add_style_tag(content=f'.ceremony-canvas.over.high-impact{{opacity:{opacity}!important}}')
  wave,base=pair(p,'.shockwave,.ceremony-canvas.over')
  row={'canvasOpacity':opacity,'labels':[]}
  for index in [0,1,2]:
   for sel in ['.face-name','.face-rarity']:
    r=box(p,f'.slot[data-i="{index}"] '+sel)
    a=np.asarray(base.crop(r).convert('L'));c=np.asarray(wave.crop(r).convert('L'))
    row['labels'].append(dict(index=index,label=sel,baseStd=float(a.std()),waveStd=float(c.std()),ratio=float(c.std()/a.std()) if a.std()>1 else None))
  rows.append(row);style.evaluate('e=>e.remove()')
 assert not errors,errors
 b.close()
(OUT/'A-label-source-probe.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows,indent=2))
