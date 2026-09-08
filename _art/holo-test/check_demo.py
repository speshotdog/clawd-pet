"""Real file:// browser interaction and evidence. Run with Python Playwright installed."""
from pathlib import Path
import json, hashlib, re
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parent
SHOTS=OUT/'shots'; SHOTS.mkdir(exist_ok=True)
def main():
 with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1512,'height':1000},device_scale_factor=1)
    page.add_init_script('''(() => {const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);const pending=new Set();window.__rafAudit={pending:()=>pending.size};window.requestAnimationFrame=cb=>{const id=request(t=>{pending.delete(id);cb(t)});pending.add(id);return id};window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id)}})();''')
    errors=[]; external=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('requestfailed',lambda r:errors.append(r.url+': '+str(r.failure)))
    page.on('request',lambda r:external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.goto((OUT/'demo.html').as_uri(),wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)',polling=100)
    page.wait_for_timeout(250)
    assert not errors,errors[:12][:12]
    page.screenshot(path=str(SHOTS/'01-comparison-rest.png'),full_page=False)
    def state():return page.evaluate('holoDemo.snapshot()')
    def move(loc,x=.8,y=.2):
        loc.scroll_into_view_if_needed();b=loc.bounding_box();page.mouse.move(b['x']+b['width']*x,b['y']+b['height']*y,steps=12);page.wait_for_timeout(600)
    pair=page.locator('#pair-input');move(pair,.88,.2)
    page.screenshot(path=str(SHOTS/'02-comparison-tilted.png'))
    moving=state();assert moving['cards'][0]['pose'][0]>.5
    new=page.locator('[data-id="comparison-new"]')
    before=new.evaluate('(e)=>({art:getComputedStyle(e.querySelector(".face-art")).transform,bg:getComputedStyle(e.querySelector(".face-depth-bg")).transform,foil:getComputedStyle(e.querySelector(".foil-spectrum")).backgroundPosition,glare:getComputedStyle(e.querySelector(".foil-glare")).backgroundImage})')
    move(pair,.12,.8)
    after=new.evaluate('(e)=>({art:getComputedStyle(e.querySelector(".face-art")).transform,bg:getComputedStyle(e.querySelector(".face-depth-bg")).transform,foil:getComputedStyle(e.querySelector(".foil-spectrum")).backgroundPosition,glare:getComputedStyle(e.querySelector(".foil-glare")).backgroundImage})')
    assert all(before[k]!=after[k] for k in before), (before,after)
    assert after['art']!=after['bg']
    page.mouse.move(10,10);page.wait_for_timeout(1100);idle=state();assert idle['raf']==0 and idle['active'] is None and page.evaluate('__rafAudit.pending()')==0
    frames=idle['totalFrames'];page.wait_for_timeout(250);assert state()['totalFrames']==frames
    # Lock a useful pose using real checkbox input, then change range inputs with keyboard.
    page.locator('#hold').check();move(pair,.8,.25);page.mouse.move(1450,400);page.wait_for_timeout(100)
    saved_pose=state()['cards'][0]['pose'];assert saved_pose[0]>.3
    slider_checks={}
    for key in ['depth','foil','grain','glare']:
        slider=page.locator('#'+key);slider.focus();slider.press('End')
        high=state();high_css=new.get_attribute('style');slider.press('Home');low=state();low_css=new.get_attribute('style')
        assert high['settings'][key]>0 and low['settings'][key]==0 and high_css!=low_css
        assert page.locator('#'+key+'-value').inner_text()=='0%'
        slider.press('End');slider_checks[key]={'high':high['settings'][key],'low':low['settings'][key]}
    page.screenshot(path=str(SHOTS/'03-controls-max.png'))
    page.locator('input[value="foil"]').check();assert new.evaluate('(e)=>e.style.getPropertyValue("--za")')=='0px'
    page.locator('input[value="depth"]').check();assert new.evaluate('(e)=>e.style.getPropertyValue("--foil")')=='0'
    page.locator('#reset').click()
    # Four large scene cards, mouse drag and independent geometry/foil changes.
    scene_checks=[]
    for i,name in enumerate(['rocketdog','astronaut','alienkitty','fluffdog']):
        card=page.locator('[data-id="'+name+'"]');hit=card.locator('..');move(hit,.2,.35)
        old=card.get_attribute('style');b=hit.bounding_box();page.mouse.down();page.mouse.move(b['x']+b['width']*.82,b['y']+b['height']*.7,steps=18);page.mouse.up();page.wait_for_timeout(650)
        assert old!=card.get_attribute('style')
        page.screenshot(path=str(SHOTS/f'04-scene-{name}.png'))
        scene_checks.append({'id':name,'pose':next(c['pose'] for c in state()['cards'] if c['id']==name)})
    # One continuous input target in five-rank row; all other records must remain unchanged.
    rank=page.locator('[data-id="rank-epic-zhenwang"]');hit=rank.locator('..');page.mouse.move(10,10);page.wait_for_timeout(1100)
    move(hit,.3,.6);start=state();move(hit,.83,.18);end=state()
    changed=[i for i,(a,b) in enumerate(zip(start['cards'],end['cards'])) if a['updates']!=b['updates']]
    assert len(changed)==1 and end['input']==1,(changed,end)
    page.screenshot(path=str(SHOTS/'05-five-rarities.png'))
    # Flip every representative by actual locator.click(), check computed matrix and save backside.
    flip_checks=[]
    for selector in ['[data-id="comparison-new"]','[data-id="alienkitty"]','[data-id="mieshi"]','[data-id="wanwumythic"]']:
        card=page.locator(selector);specimen=card.locator('../..');button=specimen.locator('button');button.click();page.wait_for_timeout(720)
        assert 'is-back' in card.get_attribute('class')
        matrix=card.locator('.card-inner').evaluate('(e)=>getComputedStyle(e).transform');assert matrix.startswith('matrix3d(-1'),matrix
        flip_checks.append({'selector':selector,'matrix':matrix})
        if 'alienkitty' in selector:page.screenshot(path=str(SHOTS/'06-card-back.png'))
        button.click();page.wait_for_timeout(720);assert 'is-back' not in card.get_attribute('class')
    page.locator('#legacy').scroll_into_view_if_needed();page.mouse.move(10,10);page.wait_for_timeout(1100);page.screenshot(path=str(SHOTS/'07-legacy.png'))
    # Reduced motion toggle AND actual OS media emulation preserve visible foil and kill rAF.
    page.locator('#reduced').check();assert state()['reduced'] and state()['raf']==0
    move(pair,.9,.1);assert state()['raf']==0 and state()['cards'][0]['pose']==[0,0]
    assert float(new.evaluate('(e)=>getComputedStyle(e.querySelector(".foil-stack")).opacity'))>0
    page.screenshot(path=str(SHOTS/'08-reduced-motion.png'))
    page.locator('#reduced').uncheck();page.emulate_media(reduced_motion='reduce');assert state()['reduced'] and state()['raf']==0
    page.emulate_media(reduced_motion='no-preference')
    # Real keyboard path: focus card, arrows, Enter, Escape.
    new.locator('..').focus();new.locator('..').press('ArrowRight');page.wait_for_timeout(700);assert state()['cards'][0]['pose'][0]>.1
    new.locator('..').press('Enter');page.wait_for_timeout(720);assert state()['cards'][0]['flipped'];new.locator('..').press('Enter');new.locator('..').press('Escape');assert state()['raf']==0
    # Mobile layout and touch drag through Playwright's Chromium input protocol.
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    mobile.on('pageerror',lambda e:errors.append('mobile: '+str(e)))
    mobile.goto((OUT/'demo.html').as_uri(),wait_until='load');mobile.locator('#controls summary').click()
    mobile.screenshot(path=str(SHOTS/'09-mobile.png'),full_page=True)
    mobile.screenshot(path=str(SHOTS/'09-mobile-first-screen.png'))
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mhit=mobile.locator('[data-id="fluffdog"]').locator('..');mhit.scroll_into_view_if_needed();mb=mhit.bounding_box();session=mobile.context.new_cdp_session(mobile)
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':mb['x']+mb['width']*.35,'y':mb['y']+mb['height']*.4}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':mb['x']+mb['width']*.8,'y':mb['y']+mb['height']*.65}]});mobile.wait_for_timeout(600)
    touch_pose=mobile.evaluate('holoDemo.snapshot().cards.find(c=>c.id==="fluffdog").pose');assert touch_pose[0]>.3,touch_pose
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mobile.wait_for_timeout(1100);assert mobile.evaluate('holoDemo.snapshot().raf')==0
    # All images, source preservation, and no forbidden runtime request mechanisms.
    assert page.locator('.hcard').count()==16
    assert page.evaluate('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
    assert not errors,errors[:12]
    assert not external,external
    html=(OUT/'demo.html').read_text(encoding='utf-8')
    assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|<script[^>]+src=|type=[\"\']module|\bimport\s*\(',html)
    root=OUT.parent.parent;protected=json.loads((OUT/'protected-before.json').read_text(encoding='utf-8'))
    modified=[path for path,h in protected.items() if hashlib.sha256((root/path).read_bytes()).hexdigest()!=h]
    # Another project can edit unrelated working files concurrently. Verify only the
    # read-only assets actually used here; never overwrite or restore other changes.
    used={p for p in protected if p.startswith('_art/holo-test/') or p in ['src/gacha-card.css','src/gacha-card.js'] or re.match(r'src/card-(zhenpete|zhenwang|zhencao|zhenjpg|mieshi|wanwumythic)\.png$',p)}
    modified_used=[p for p in modified if p in used]
    assert not modified_used,modified_used
    page.locator('#reset').click();page.mouse.move(10,10);page.wait_for_timeout(1100)
    for section in ['scenes','rarities','legacy']:
        page.locator('#'+section).screenshot(path=str(SHOTS/('10-section-'+section+'.png')))
    page.screenshot(path=str(SHOTS/'11-desktop-full.png'),full_page=True)
    report={'browser':browser.version,'url':(OUT/'demo.html').as_uri(),'viewport':[1512,1000],'checks':{'all_four_sections':True,'image_count':page.locator('img').count(),'cards':16,'depth_and_foil_changed':{'before':before,'after':after},'sliders':slider_checks,'scenes':scene_checks,'five_rank_updated_indices':changed,'flips':flip_checks,'reduced_motion_simulated_and_media':True,'keyboard':True,'mobile_no_horizontal_overflow':True,'touch_drag_pose':touch_pose,'idle_raf':idle['raf'],'idle_frames_stable':True,'max_concurrent_raf':state()['maxConcurrent'],'console_errors':errors,'external_requests':external,'referenced_original_files_unchanged':len(used),'independent_pending_raf_after_leave':0},'screenshots':sorted(x.name for x in SHOTS.glob('*.png'))}
    (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
if __name__=='__main__':main()
