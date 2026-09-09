"""Round 29 acceptance: screen/pixel/timing/layout contracts, independent expected FX table.
Uses the retained native-WAAPI virtual clock; --live checks real hidden/idle/audio behavior.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from io import BytesIO
import json, shutil, sys, math
from PIL import Image, ImageChops, ImageDraw
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE, OUT, BY, CARDS, open_page, start, advance, state
ROWS=[]
def record(check, **data):
 ROWS.append(dict(check=check,**data));(OUT/('round29-live.json' if '--live' in sys.argv else 'round29-visual.json' if '--visual-only' in sys.argv else 'round29-results.json')).write_text(json.dumps(ROWS,indent=2),encoding='utf-8');print(check,data,flush=True)
def shot(p):
 p.evaluate('__syncAnimations()');return Image.open(BytesIO(p.screenshot())).convert('RGB')
def frozen_bg(p):
 p.evaluate("document.querySelectorAll('.stage-background *').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0}))")
EXPECTED={
 'common':{'fx-confirm-ring':(0,180),'foil-sweep':(0,220)},
 'rare':{'fx-rare-ring':(0,320),'fx-flake':(40,280),'foil-sweep':(0,300)},
 'epic':{'fx-epic-ring':(0,420),'fx-broken-ring':(70,500),'fx-flake':(30,400),'foil-sweep':(0,420)},
 'legendary':{'fx-legendary-ring':(0,440),'fx-local-reflection':(0,180),'fx-substrate-wave':(40,680),'fx-flake':(24,516),'fx-afterglow':(100,660),'stage-impact':(80,160),'foil-sweep':(0,520)},
 'mythic':{'fx-mythic-ring':(0,320),'fx-local-reflection':(0,320),'fx-spectrum-wave':(60,800),'fx-counter-wave':(180,860),'fx-flake':(40,640),'stage-impact':(60,200),'foil-sweep':(0,560),'foil-afterglow':(480,440)}}
def core(browser,url,label):
 p,errors=open_page(browser,url);p.set_viewport_size({'width':1440,'height':900});frozen_bg(p)
 assert state(p)['screen']=='entry'
 assert p.locator('.rail,.bar,.body,.chip,.rate,.foot,.orbit,.charge,.core,.starfield,.rays,.idlepack,.result-mark,#reset').count()==0
 assert p.locator('.stage-background > div').count()==6
 p.screenshot(path=str(OUT/f'{label}-entry29.png'));p.close()
 for w,h in [(1440,900),(1024,640),(390,844)]:
  for n in [1,5,10]:
   p,errors=open_page(browser,url);p.set_viewport_size({'width':w,'height':h});p.evaluate('window.__clockRender=false');start(p,[BY['common']]*n)
   p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181);assert state(p)['screen']=='results'
   data=p.evaluate("[...document.querySelectorAll('.slot')].map(e=>({cw:parseFloat(getComputedStyle(e).width),transform:e.style.transform,hidden:e.classList.contains('page-away')}))")
   expected=(304 if n==1 else 288) if w<600 else (420 if n==1 else 380)*min(w/1440,h/900)
   assert all(abs(d['cw']-expected)<=1 for d in data),(w,h,n,data)
   layout=p.evaluate(f'__ceremony.layout({n})')
   if w>600 and n>1:
    for i,d in enumerate(layout):assert abs(d['x']-[-420,-210,0,210,420][i%5]*min(w/1440,h/900))<.01 and d['rz']==[-12,-6,0,6,12][i%5]
   if n==10:
    p.click('#next');assert state(p)['selectedIndex']==1 if w<600 else state(p)['pageIndex']==1
   p.screenshot(path=str(OUT/f'{label}-{w}-{n}.png'));record('layout',entry=label,viewport=[w,h],n=n,width=data[0]['cw']);assert not errors; p.close()
 for rarity,expected in EXPECTED.items():
  p,errors=open_page(browser,url);p.set_viewport_size({'width':1440,'height':900});frozen_bg(p);start(p,[BY[rarity]])
  advance(p,1479);assert not p.locator('.rarity-fx').count();assert not p.evaluate('__ceremony.events.some(e=>e.type==="face-visible")')
  advance(p,1);assert p.evaluate('__ceremony.events.some(e=>e.type==="face-visible")');transform=p.locator('.reveal-flip').evaluate('e=>getComputedStyle(e).transform');assert '-89deg' in p.locator('.reveal-flip').get_attribute('style')
  assert p.locator('.hcard').evaluate('e=>e.clientWidth')==420
  first_frame=shot(p);p.evaluate("document.querySelector('.hcard').style.visibility='hidden'");no_face=shot(p);p.evaluate("document.querySelector('.hcard').style.visibility='visible'")
  assert ImageChops.difference(first_frame,no_face).getbbox() is not None,'F has no actual face pixels'
  # Every DOM effect must create visible pixels outside the actual projected card.
  visible=[];effect_pixels={k:0 for k in expected if k.startswith('fx-')}
  for elapsed in [100,240,400,650,850]:
   current=p.evaluate('Date.now()-__ceremony.events.find(e=>e.type==="face-visible").time');advance(p,max(0,elapsed-current));a=shot(p)
   p.evaluate("document.querySelectorAll('.rarity-fx').forEach(e=>e.style.visibility='hidden')");b=shot(p)
   p.evaluate("document.querySelectorAll('.rarity-fx').forEach(e=>e.style.visibility='')")
   delta=ImageChops.difference(a,b);box=p.locator('.reveal-shell').bounding_box()
   def outside_count(diff):
    ImageDraw.Draw(diff).rectangle((box['x'],box['y'],box['x']+box['width'],box['y']+box['height']),fill=(0,0,0))
    channels=diff.split();maximum=ImageChops.lighter(ImageChops.lighter(channels[0],channels[1]),channels[2]);return sum(maximum.histogram()[3:])
   pixels=outside_count(delta)
   for effect in effect_pixels:
    if p.locator('.'+effect).count():
     p.evaluate("c=>document.querySelectorAll('.'+c).forEach(e=>e.style.visibility='hidden')",effect);without=shot(p)
     p.evaluate("c=>document.querySelectorAll('.'+c).forEach(e=>e.style.visibility='')",effect)
     effect_pixels[effect]=max(effect_pixels[effect],outside_count(ImageChops.difference(a,without)))
   visible.append(pixels)
   if elapsed==240:a.save(OUT/f'{label}-{rarity}-peak29.png')
   if elapsed==400:
    gray=a.convert('L');bg=[];card=[]
    for y in range(80,780,4):
     for x in range(0,1440,4):
      (card if box['x']+20<x<box['x']+box['width']-20 and box['y']+20<y<box['y']+box['height']-20 else bg).append(gray.getpixel((x,y)))
    p95=lambda v:sorted(v)[int(len(v)*.95)];ratio=p95(bg)/p95(card);assert ratio<(.85 if rarity in ['legendary','mythic'] else .65),ratio
  advance(p,2000);ev=p.evaluate('__ceremony.events');F=next(e['time'] for e in ev if e['type']=='face-visible');end=next(e['time'] for e in ev if e['type']=='slot-complete')
  for effect,(offset,duration) in expected.items():
   begins=[e for e in ev if e['type']=='fx-start' and e['effect']==effect];ends=[e for e in ev if e['type']=='fx-end' and e['effect']==effect]
   assert begins and ends,(rarity,effect)
   assert all(abs(e['time']-F-offset)<=34 for e in begins),(rarity,effect,begins,F)
   assert all(abs(e['time']-F-offset-duration)<=34 for e in ends),(rarity,effect,ends,F)
  assert max(visible)>0,(rarity,visible)
  assert all(effect_pixels.values()),(rarity,effect_pixels)
  assert state(p)['collectable'];assert not errors
  record('five-tier',entry=label,rarity=rarity,face=F,complete_after_face=end-F,visible_pixels=visible,effect_pixels=effect_pixels,background_ratio=ratio);p.close()
 # Fixed preceding prefix, replace only the next rank; no next-rarity timing or pixel clue.
 captures=[]
 for rarity in ['common','legendary','mythic']:
  p,errors=open_page(browser,url);frozen_bg(p);start(p,[BY['common'],BY[rarity],BY['common'],BY['common'],BY['common']]);advance(p,2490);captures.append(shot(p));assert not p.evaluate('__ceremony.events.some(e=>e.type==="face-visible"&&e.index===1)');p.close()
 assert all(ImageChops.difference(captures[0],v).getbbox() is None for v in captures[1:]);record('next-rarity-neutral',entry=label)
 if '--visual-only' in sys.argv:return
 # Real preparation race, plus each new fixed stage point x20 (the original A5 suite remains separate).
 p,errors=open_page(browser,url);p.evaluate('window.__clockRender=false');fixture=[BY['common']]*10
 for phase,ms in [('tension',300),('tear',550),('deal',900),('before-face',2109),('after-face',2111),('return',2480),('page',6000)]:
  for repeat in range(20):
   start(p,fixture);advance(p,ms);p.evaluate('__ceremony.skipAll();__ceremony.skipAll()');advance(p,181);s=state(p)
   assert s['collectable'] and s['complete']==10 and s['ids']==[c['id'] for c in fixture],s
   assert not any(s[k] for k in ['anims','timers','rafs','voices'])
   completions=p.evaluate('__ceremony.events.filter(e=>e.type==="slot-complete").map(e=>e.index)');assert len(completions)==len(set(completions))==10
  record('skip20',entry=label,phase=phase,repeats=20)
 assert not errors;p.close()
def live(browser,url,label):
 p=browser.new_page(viewport={'width':1440,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(url+'?ceremony-test');p.evaluate('document.fonts.ready')
 p.evaluate("()=>{window.__rafCalls=0;const rr=requestAnimationFrame;window.requestAnimationFrame=f=>{__rafCalls++;return rr(f)}}")
 for ms in [5000,25000]:p.wait_for_timeout(ms);assert p.evaluate('__rafCalls')==0;assert not any(state(p)[k] for k in ['anims','timers','rafs','voices'])
 record('idle',entry=label,seconds=[5,30],raf_calls=0)
 # Visibility API event is injected, but all runtime clocks / WAAPI / audio are native.
 p.click('#sound');p.evaluate('f=>{window.__ceremonyFixture=f;__ceremony.pull(1)}',[BY['mythic']]);p.wait_for_timeout(500)
 p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
 before=p.evaluate('__ceremony.events.length');p.wait_for_timeout(1200);assert p.evaluate('__ceremony.events.length')==before
 assert p.evaluate("[...document.querySelectorAll('.stage-background>div')].every(e=>getComputedStyle(e).animationPlayState==='paused')")
 p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
 p.wait_for_function('__ceremony.state().collectable',timeout=15000);record('hidden-resume',entry=label,events_during_hidden=0)
 assert not errors;p.close()
def main():
 assert (HERE/'deluxe-gacha-b-standalone.html').stat().st_size<=6500000
 with sync_playwright() as pw,TemporaryDirectory(prefix='portable29-',dir=OUT) as tmp:
  b=pw.chromium.launch();copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
  for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
   (live if '--live' in sys.argv else core)(b,file.as_uri(),label)
  b.close()
if __name__=='__main__':main()
