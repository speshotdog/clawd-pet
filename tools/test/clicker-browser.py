"""可選的離線瀏覽器驗證：所有 HTTP 請求由 Playwright 讀本地檔回覆，不啟動 server。
執行：python tools/test/clicker-browser.py（需已安裝 Python Playwright 與 Chromium）。
"""
import json
import os
from datetime import datetime, timezone, timedelta
import mimetypes
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
OUT = ROOT / 'tools/test/clicker-artifacts'


def round5(context):
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.ClickerMusic && window.Clicker?.state && !document.getElementById("tap").disabled')
    page.evaluate('''() => {
      const s=ClickerSave.fresh(Date.now());
      s.collection={yueyue2:1,jiaobu:1,zhenmu:1}; s.manualClicks=50;
      s.claimedMilestones=['tutorial50']; s.lifetimeCoins=100000; s.skillSlots=['yueyue2','jiaobu','zhenmu'];
      sessionStorage.setItem('test-seed',JSON.stringify(s));
    }''')
    page.reload()
    page.wait_for_function('window.ClickerMusic && !document.getElementById("tap").disabled')
    page.wait_for_function("[...document.querySelectorAll('#clicker-scene img')].every(i=>i.complete && i.naturalWidth)")
    page.wait_for_timeout(650)
    page.screenshot(path=str(OUT / 'round5-static.png'))
    assert page.locator('.scene-layer').count() == 9
    assert page.evaluate('''() => {
      const z=s=>+getComputedStyle(document.querySelector(s)).zIndex;
      return z('#clicker-scene')<z('#hero-position') && z('.package-meter')>z('#clicker-scene') &&
        [...document.querySelectorAll('.scene-layer')].every((e,i)=>+e.style.zIndex===i) &&
        +getComputedStyle(document.querySelector('.desk-mat'),'::after').zIndex>z('#clicker-scene');
    }''')
    # Exercise actual sprite transforms, including the shared wind's spatial delay.
    assert page.evaluate('''() => {
      ClickerScene.mount('backyard',Clicker.state.package.index);
      const rows=[];
      for(let t=0;t<3;t++) {
        ClickerScene.update(t ? 1 : 0);
        rows.push([...document.querySelectorAll('#clicker-scene [data-layer="grass"] img')].map(e=>parseFloat(e.style.transform.slice(7))));
      }
      return rows.every(r=>r.every(v=>v>0)) && rows[0][0]!==rows[1][0] && rows[1][0]!==rows[2][0];
    }''')
    # Remount intentionally detaches its old scope; lifecycle resumes through real visibility.
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));')
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));')
    page.mouse.move(930,600)
    page.wait_for_timeout(1600)
    assert page.evaluate('''() => {
      const layers=[...document.querySelectorAll('.scene-layer')];
      const grass=new DOMMatrix(getComputedStyle(layers[7]).transform);
      return grass.m41>5 && grass.m42>2.5 && layers.every((el,i)=>{
        const m=new DOMMatrix(getComputedStyle(el).transform), p=ClickerScenes.backyard.layers[i].parallax;
        return Math.abs(m.m41-grass.m41*p)<.01 && Math.abs(m.m42-grass.m42*p)<.01;
      });
    }''')
    assert page.evaluate('''() => {
      const el=document.querySelector('[data-layer="clouds"] img'), before=parseFloat(el.style.transform.slice(11));
      ClickerScene.update(848/6);
      return Math.abs(parseFloat(el.style.transform.slice(11))-before)<.001;
    }''')
    page.evaluate('''() => {
      for(let i=0;i<450;i++) {ClickerScene.update(.033);if(ClickerScene.gust && ClickerScene.time-ClickerScene.gust.start<.04)break;}
      ClickerScene.update(ClickerScene.gust.duration/2);
    }''')
    page.screenshot(path=str(OUT / 'round5-gust.png'))
    peak = page.evaluate('''() => {
      let max=0;
      for(let i=0;i<1800;i++){ClickerScene.update(.033);max=Math.max(max,ClickerScene.particleCount);}
      return max;
    }''')
    assert 0 < peak <= 6
    page.wait_for_timeout(80)
    page.screenshot(path=str(OUT / 'round5-particles.png'))
    page.mouse.click(300,50)
    page.wait_for_function('ClickerMusic.ctx?.state === "running" && ClickerMusic.scene.transport.playing')
    metadata = page.evaluate('''() => ({scene:{bpm:ClickerMusic.scene.song.bpm,transpose:ClickerMusic.scene.song.transpose,seed:ClickerMusic.scene.song.seed},skill:{bpm:ClickerMusic.skill.song.bpm,transpose:ClickerMusic.skill.song.transpose,seed:ClickerMusic.skill.song.seed}})''')
    assert metadata['scene']['transpose'] == metadata['skill']['transpose']
    (OUT / 'round5-music.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
    page.locator('.skill-use').nth(0).click()
    page.wait_for_function('ClickerMusic.skill.target === .32 && ClickerMusic.skill.transport.playing')
    frozen = page.evaluate('ClickerScene.time')
    page.wait_for_timeout(1000)
    assert page.evaluate('ClickerScene.time') == frozen
    assert abs(page.evaluate('ClickerMusic.skill.gain.gain.value')-.32)<.01
    page.screenshot(path=str(OUT / 'round5-cutin-frozen.png'))
    page.wait_for_timeout(800)
    # Another skill keeps the transport running rather than starting at step zero.
    step = page.evaluate('ClickerMusic.skill.transport.lastStep')
    page.locator('.skill-use').nth(1).click()
    page.wait_for_timeout(100)
    assert page.evaluate('ClickerMusic.skill.transport.lastStep') >= step
    page.wait_for_timeout(1400)
    # Consuming the one-charge skill must not end the other skill's variation.
    page.locator('#tap').click()
    assert page.evaluate('ClickerMusic.skill.target') == .32
    for _ in range(9):
        page.wait_for_timeout(150)
        page.locator('#tap').click()
    page.wait_for_timeout(1720)
    assert abs(page.evaluate('ClickerMusic.skill.gain.gain.value'))<.01
    assert not page.evaluate('ClickerMusic.skill.transport.playing')
    # Passive effects end by their real expiresAt, including the 1400ms exit and delayed 1700ms scene return.
    page.locator('.skill-use').nth(2).click()
    page.wait_for_function('ClickerMusic.skill.target === .32')
    remaining = page.evaluate('Math.max(...Clicker.state.effects.map(e=>e.expiresAt))-Date.now()')
    page.wait_for_timeout(remaining+1720)
    assert abs(page.evaluate('ClickerMusic.skill.gain.gain.value'))<.01
    assert not page.evaluate('ClickerMusic.skill.transport.playing')
    page.locator('#audio-toggle').click()
    page.locator('#music').click()
    page.keyboard.press('Escape')
    page.wait_for_timeout(850)
    assert page.evaluate('ClickerMusic.ctx.state') == 'suspended', page.evaluate('({settings:Clicker.state.settings,gain:ClickerMusic.scene.gain.gain.value,skill:ClickerMusic.skill.gain.gain.value})')
    assert page.evaluate('JSON.parse(localStorage.clicker_save).settings.music') is False
    page.locator('#audio-toggle').click()
    page.locator('#music').click()
    page.keyboard.press('Escape')
    page.wait_for_function('ClickerMusic.ctx.state === "running"')
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));')
    page.wait_for_timeout(350)
    assert page.evaluate('ClickerMusic.ctx.state') == 'suspended', page.evaluate('({settings:Clicker.state.settings,gain:ClickerMusic.scene.gain.gain.value,skill:ClickerMusic.skill.gain.gain.value})')
    assert not page.evaluate('ClickerMusic.scene.transport.playing || ClickerMusic.skill.transport.playing')
    page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));')
    page.wait_for_function('ClickerMusic.scene.transport.playing')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(80)
    assert page.evaluate('ClickerScene.particleCount') <= 2
    assert page.evaluate('''[...document.querySelectorAll('[data-layer="grass"] img')].every(e=>e.style.transform==='rotate(0deg) scaleX(1)')''')
    assert not errors, errors
    page.close()
    print('PASS: Round 5 layers, wind, parallax, cloud loop, particles, frozen scene, ChipForge crossfades, toggles, hide/resume, reduced motion')


def round6(context):
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.ClickerMusic && window.Clicker && !document.getElementById("tap").disabled')
    page.evaluate('''() => {
      const s=ClickerSave.fresh(Date.now()); s.package={index:78,progress:479000};
      s.collection={yueyue2:1,jiaobu:1,zhenmu:1}; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
      s.lifetimeCoins=100000; s.skillSlots=['yueyue2','jiaobu','zhenmu'];
      sessionStorage.setItem('test-seed',JSON.stringify(s));
    }''')
    page.reload()
    page.wait_for_function('window.ClickerMusic && !document.getElementById("tap").disabled')
    page.wait_for_timeout(800)
    assert page.locator('#tap').evaluate('(e)=>getComputedStyle(e).left') == '184px'
    assert page.locator('.package-meter').evaluate('(e)=>[e.offsetLeft,e.offsetTop,e.offsetWidth,e.offsetHeight]') == [24,308,560,40]
    assert page.evaluate("document.querySelectorAll('[data-layer=grass] img').length===4 && document.querySelectorAll('[data-layer=flowers] img').length===3")
    assert page.evaluate("""() => {
      const boxes=[...document.querySelectorAll('[data-layer=tree] img')].map(e=>e.getBoundingClientRect());
      const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
      return boxes.slice(1).every(b=>overlap(boxes[0],b)) && overlap(boxes[1],boxes[2]) && overlap(boxes[2],boxes[3]);
    }""")
    page.screenshot(path=str(OUT / 'round6-scene.png'))
    page.locator('.package-meter').screenshot(path=str(OUT / 'round6-meter.png'))
    page.locator('#audio-toggle').click()
    assert page.locator('#audio-panel').is_visible()
    page.wait_for_timeout(1250)
    assert abs(page.evaluate('ClickerMusic.scene.gain.gain.value*ClickerMusic.volume.gain.value')-.144)<.002
    before = page.evaluate('localStorage.clicker_save')
    page.locator('#music-volume').evaluate("e=>{e.value=.4;e.dispatchEvent(new Event('input',{bubbles:true}));}")
    assert page.evaluate('localStorage.clicker_save') == before
    page.wait_for_timeout(220)
    assert abs(page.evaluate('ClickerMusic.volume.gain.value')-.4)<.01
    page.wait_for_timeout(5100)  # Autosave must not commit an in-progress slider preview.
    assert page.evaluate('JSON.parse(localStorage.clicker_save).settings.musicVolume') == .6
    assert page.evaluate('Clicker.state.settings.musicVolume') == .4
    page.locator('#music-volume').dispatch_event('change')
    assert page.evaluate('JSON.parse(localStorage.clicker_save).settings.musicVolume') == .4
    page.locator('#sfx-volume').evaluate("e=>{e.value=.3;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}")
    assert page.evaluate('JSON.parse(localStorage.clicker_save).settings.sfxVolume') == .3
    assert abs(page.evaluate('GachaAudio.createScope().dry.gain.value')-.3)<.001
    page.screenshot(path=str(OUT / 'round6-volume.png'))
    page.keyboard.press('Escape')
    assert page.locator('#audio-panel').is_hidden()
    page.locator('#audio-toggle').click()
    page.mouse.click(300,50)
    assert page.locator('#audio-panel').is_hidden()
    page.locator('#tap').click()
    page.wait_for_timeout(80)
    assert page.locator('.floater').last.evaluate('(e)=>getComputedStyle(e).fontSize') == '26px'
    assert page.locator('.floater b').last.evaluate('(e)=>getComputedStyle(e).webkitTextStrokeWidth') == '1.2px'
    page.screenshot(path=str(OUT / 'round6-floater.png'))
    # Sample actual AudioParams in the audio clock; no fake timers or gain mocks.
    samples = page.evaluate("""async () => {
      window.beginTestSkill = () => {
        const s=Clicker.state, now=Date.now(); s.settledAt=now; s.collection.yueyue2=1;
        s.cooldownUntil.yueyue2=now+60000;
        s.effects=[{source:'yueyue2',kind:'click',multiplier:2,remaining:10,startedAt:now,expiresAt:now+15000}];
        ClickerMusic.sync(s);
      };
      beginTestSkill();
      const rows=[], start=performance.now();
      for (const ms of [0,300,700,1000]) {
        await new Promise(r=>setTimeout(r,Math.max(0,ms-(performance.now()-start))));
        rows.push([ClickerMusic.scene.gain.gain.value*ClickerMusic.volume.gain.value,ClickerMusic.skill.gain.gain.value*ClickerMusic.volume.gain.value]);
      }
      return rows;
    }""")
    assert all(samples[i][0]>=samples[i+1][0]-.002 and samples[i][1]<=samples[i+1][1]+.002 for i in range(3)), samples
    assert all(abs(samples[i][j]-samples[i+1][j])<.25 for i in range(3) for j in range(2)), samples
    assert abs(samples[-1][1]-.128)<.002, samples
    page.evaluate("Clicker.state.effects=[]; ClickerMusic.sync(Clicker.state)")
    page.wait_for_timeout(500)
    page.evaluate("beginTestSkill()")
    page.wait_for_timeout(430)
    assert abs(page.evaluate('ClickerMusic.skill.gain.gain.value')-.32)<.002
    page.evaluate("Clicker.state.effects=[]; ClickerMusic.sync(Clicker.state)")
    page.wait_for_timeout(1700)
    assert abs(page.evaluate('ClickerMusic.scene.gain.gain.value')-.24)<.002
    assert abs(page.evaluate('ClickerMusic.skill.gain.gain.value'))<.002
    page.locator('#audio-toggle').click()
    page.locator('#music').click()
    page.wait_for_timeout(150)
    assert page.evaluate('ClickerMusic.ctx.state') == 'running'
    page.wait_for_timeout(200)
    assert page.evaluate('ClickerMusic.ctx.state') == 'suspended', page.evaluate('({settings:Clicker.state.settings,gain:ClickerMusic.scene.gain.gain.value,skill:ClickerMusic.skill.gain.gain.value})')
    page.keyboard.press('Escape')
    (OUT / 'round6-gains.json').write_text(json.dumps(samples,indent=2),encoding='utf8')
    assert not errors, errors
    page.close()
    print('PASS: Round 6 volume preview/save/popup, real AudioParam samples, fade reversal, center, floaters, ruler, tree overlap')


def round7(browser):
    context = browser.new_context(viewport={'width': 1100, 'height': 760})
    context.add_init_script('''const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){const a=animate.apply(this,args);a.testBorn=performance.now();return a;};''')
    context.add_init_script('''let fx; window.fxEvents=[];
      Object.defineProperty(window,'GachaFx',{get:()=>fx,set:value=>{
        fx=value;const create=fx.createScope;
        fx.createScope=(...args)=>{const scope=create(...args),spawn=scope.spawn;
          scope.spawn=p=>{fxEvents.push(p);spawn.call(scope,p)};return scope;};
      }});''')
    errors, missing = [], []
    web = ROOT / 'dist-web'
    def route(request):
        path = (web / unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(web) and path.is_file():
            request.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            missing.append(str(path)); request.fulfill(status=404, body='missing')
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://clicker-web.test/index.html')
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    page.clock.install()
    page.clock.pause_at(datetime.now(timezone.utc) + timedelta(seconds=2))   # install 之後才 pause，時間要在未來，否則偶發 Cannot fast-forward to the past
    assert page.evaluate('!window.__TAURI__ && document.getElementById("close").hidden')
    assert page.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(201, 164, 111)'
    page.set_viewport_size({'width': 720, 'height': 800})
    page.clock.run_for(20)
    assert page.locator('#game').bounding_box() == {'x': 0, 'y': 160, 'width': 720, 'height': 480}
    page.set_viewport_size({'width': 1100, 'height': 760})
    page.clock.run_for(20)
    page.screenshot(path=str(OUT / 'round7-web-start.png'))
    for _ in range(50):
        page.locator('#tap').dispatch_event('click')
        page.clock.run_for(130)
    assert page.evaluate('Clicker.state.manualClicks') == 50
    page.locator('.skill-use').first.dispatch_event('click')
    page.clock.run_for(400)
    page.screenshot(path=str(OUT / 'round7-web-skill.png'))
    page.clock.run_for(1500)
    page.clock.fast_forward(30000)
    page.locator('#draw-one').dispatch_event('click')
    page.clock.run_for(100)
    page.locator('#skip').dispatch_event('click')
    page.clock.run_for(2000)
    page.wait_for_function('!document.getElementById("collect").hidden')
    page.screenshot(path=str(OUT / 'round7-web-recruit.png'))
    page.locator('#collect').dispatch_event('click')
    page.clock.run_for(1000)
    before = page.evaluate('({collection:Clicker.state.collection, draws:Clicker.state.paidDraws})')
    page.reload()
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    assert page.evaluate('({collection:Clicker.state.collection, draws:Clicker.state.paidDraws})') == before
    page.screenshot(path=str(OUT / 'round7-web-reload.png'))
    ids = page.evaluate('Object.keys(ClickerBalance.characters)')
    for ident in ids:
        page.evaluate('''id => {
          const s=ClickerSave.fresh(Date.now());
          s.collection=Object.fromEntries(Object.keys(ClickerBalance.characters).map(id=>[id,1]));
          s.lifetimeCoins=100000; s.manualClicks=50; s.claimedMilestones=['tutorial50']; s.skillSlots=[id,null,null];
          localStorage.setItem('clicker_save',JSON.stringify(s));
        }''', ident)
        # Suspend before seeding to prevent beforeunload overwriting the fixture.
        fixture = page.evaluate('localStorage.getItem("clicker_save")')
        page.evaluate('window.dispatchEvent(new Event("beforeunload"))')
        page.evaluate('s=>localStorage.setItem("clicker_save",s)', fixture)
        page.reload()
        page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
        old = page.evaluate('Clicker.state.coins')
        # burst 的實際值（含當家、連鎖）先用經濟層在「發動前」的狀態試算，發動後再比
        expected = page.evaluate('(()=>{const E=ClickerEconomy; try { return E.activate(E.clone(Clicker.state),0,Date.now()).effect.value; } catch (e) { return null; } })()') if ident in ['caihua', 'fox'] else None
        daily_before = page.evaluate('!!Clicker.state.daily?.done')
        page.locator('.skill-use').first.dispatch_event('click')
        if ident in ['caihua', 'fox']:
            # burst 也會打今日限定包，剛好拆完會多一份等額金幣獎勵
            if not daily_before and page.evaluate('!!Clicker.state.daily?.done'): expected += page.evaluate('Clicker.state.daily.bonus || 0')
            assert abs(page.evaluate('Clicker.state.coins') - old - expected) < 1e-6, (ident, page.evaluate('Clicker.state.coins') - old, expected)
            page.locator('.skill-use').first.dispatch_event('click')
            assert abs(page.evaluate('Clicker.state.coins') - old - expected) < 1e-6
        page.clock.run_for(400)
        page.evaluate('document.getAnimations().forEach(a=>{if(a.testBorn===undefined) return; a.pause();a.currentTime=performance.now()-a.testBorn;})')   # CSS 動畫（今日限定包星星）沒有 testBorn，略過
        assert page.locator('#cutin-actor svg, #cutin-actor img').count() == 1
        assert '冷卻' not in page.locator('#cutin-subtitle').inner_text()
        page.screenshot(path=str(OUT / f'round7-web-cutin-{ident}-400.png'))
        page.evaluate('document.getAnimations().forEach(a=>a.play())')
        page.clock.run_for(300)
        page.evaluate('document.getAnimations().forEach(a=>{if(a.testBorn===undefined) return; a.pause();a.currentTime=performance.now()-a.testBorn;})')
        page.screenshot(path=str(OUT / f'round7-web-cutin-{ident}-700.png'))
        page.evaluate('document.getAnimations().forEach(a=>a.play())')
        page.clock.run_for(600)
        page.evaluate('fxEvents.length=0')
        page.clock.run_for(200)
        if ident in ['caihua', 'fox']:
            assert page.evaluate('fxEvents.filter(p=>p.shape==="shard").length') == 12
            assert page.evaluate('fxEvents.every(p=>p.shape==="shard")')
            assert page.locator('.floater').count() == 1
        if ident == 'yueyue':
            page.clock.fast_forward(12000)
            assert page.evaluate('Clicker.state.effects.length') == 0
    assert page.evaluate('''() => {
      const E=ClickerEconomy; let s=ClickerSave.fresh(1000000);
      s.collection={lk:1,yang:1}; s.lifetimeCoins=100000; s.skillSlots=['lk','yang',null];
      s=E.activate(s,0,s.settledAt).state; s=E.activate(s,1,s.settledAt).state;
      const r=E.settle(s,1040000); return Math.abs(r.earned-678)<1e-6 && E.settle(r.state,1040000).earned===0;   // 400 被動 + ㄌㄎ 10×20s + 羊咩（連鎖 ×1.3）2.6×30s
    }''')
    assert not errors, errors
    # 第十二輪素材（今日限定包、霜層、徽章）尚未產出，程式以 onerror 退回既有素材；其他缺檔仍算失敗
    pending = re.compile(r'clicker-(daily|frozen|badge)-[^\/]+\.png$')
    assert not [m for m in missing if not pending.search(m)], missing
    context.close()
    print('PASS round7: 12 cutins, burst, timed clicks, offline stacking, static web recruit/save/reload; no missing assets')


def round8(browser):
    context = browser.new_context(viewport={'width': 960, 'height': 640})
    context.add_init_script('''let fx; window.round8fx=[];
      Object.defineProperty(window,'GachaFx',{get:()=>fx,set:value=>{
        fx=value;const create=fx.createScope;
        fx.createScope=(...args)=>{const scope=create(...args),spawn=scope.spawn;
          scope.spawn=p=>{round8fx.push({...p});spawn.call(scope,p)};return scope;};
      }});
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){const a=animate.apply(this,args);a.testBorn=performance.now();return a;};''')
    missing, errors = set(), []
    def route(request):
        name = unquote(urlparse(request.request.url).path).lstrip('/')
        path = (SRC / name).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            request.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            missing.add(name)
            request.fulfill(status=404, body='missing')
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    page.clock.pause_at(datetime.fromtimestamp((page.evaluate("Date.now()")+1000)/1000, timezone.utc))
    # Virtual timers and WAAPI have separate clocks: sample both at the same time.
    def advance(ms):
        for _ in range(ms // 20):
            page.clock.run_for(20)
            page.evaluate('''() => {for(const a of document.getAnimations()) {
              if(a.testBorn===undefined) continue;
              a.currentTime=performance.now()-a.testBorn;
            }}''')
        if ms % 20:
            page.clock.run_for(ms % 20)
    def shot(name):
        page.screenshot(path=str(OUT / name))
    page.evaluate('''() => {const s=Clicker.state;s.package.index=51;
      s.collection={yueyue2:1};s.manualClicks=50;s.claimedMilestones=['tutorial50'];document.getElementById('tap').click();}''')
    advance(1100)
    assert page.locator('#boss-challenge').is_visible(), page.evaluate('({state:Clicker.state,can:ClickerEconomy.canBoss(Clicker.state,Date.now()),notice:document.getElementById("notice").textContent})')
    page.locator('#boss-challenge').dispatch_event('pointerdown')
    page.locator('#boss-challenge').dispatch_event('click')
    advance(600)
    shot('round8-boss-enter.png')
    assert page.evaluate('!!Clicker.state.boss')
    assert page.evaluate('ClickerMusic.skill.target===.32')
    assert page.locator('#scene-open').is_disabled()
    page.locator('#recruit-open').dispatch_event('click')
    assert page.locator('#recruit-layer').is_hidden()
    page.evaluate('Clicker.state.boss.dealt=Clicker.state.boss.need*.8')
    page.clock.fast_forward(30000)
    advance(200)
    shot('round8-boss-fail.png')
    assert page.evaluate('!Clicker.state.boss && Clicker.state.bossCracks.backyard>=.4')
    advance(1400)
    page.clock.fast_forward(30000)
    advance(1100)
    page.locator('#boss-challenge').dispatch_event('click')
    advance(700)
    assert page.evaluate('Clicker.state.boss.crack>=.4')
    page.evaluate('Clicker.state.clickLevel=100;round8fx.length=0')
    page.locator('#tap').dispatch_event('click')
    advance(160)
    shot('round8-boss-win.png')
    assert page.evaluate('Clicker.state.bossWins.includes("backyard") && Clicker.state.freeDraws===5')
    assert page.evaluate('round8fx.filter(p=>p.shape==="shard").length>=48 && round8fx.filter(p=>p.sprite===3).length>=6')
    advance(3300)
    assert page.evaluate('ClickerScene.current===ClickerScenes.kitchen')
    assert page.evaluate('ClickerMusic.scene.song.seed==="zhenmu-kitchen-1"')
    shot('round8-kitchen.png')
    assert not page.locator('#draw-five').is_disabled()
    assert '5' in page.locator('#draw-five').inner_text(), page.evaluate('({text:document.getElementById("draw-five").textContent,state:Clicker.state})')
    page.locator('#draw-five').dispatch_event('click')
    assert page.evaluate('Clicker.state.freeDraws===0 && Clicker.state.usedFreeDraws===5 && Clicker.state.pending.draw.entries.length===5')
    page.locator('#skip').dispatch_event('click')
    advance(2200)
    page.locator('#collect').dispatch_event('click')
    advance(1200)
    page.evaluate('''() => {const s=Clicker.state;s.clickLevel=0;s.package=ClickerEconomy.newPackage('kitchen');
      s.collection={yueyue2:1};s.effects=[];s.skillSlots=['yueyue2',null,null];s.settledAt=Date.now()-100000;}''')
    advance(1100)
    LINE="ClickerEconomy.requirement(1,'kitchen')*.25"   # 第一層硬殼線（廚房第一包 800 的 25%）
    assert page.evaluate(f'Clicker.state.package.progress==={LINE} && Clicker.state.package.blocked>0')
    for _ in range(2):
        page.locator('#tap').dispatch_event('click')
        advance(160)
    assert page.evaluate(f'Clicker.state.package.shellHp===1 && Clicker.state.package.progress==={LINE}')
    page.evaluate('round8fx.length=0')
    page.locator('#tap').dispatch_event('click')
    shot('round8-shell-release-0.png')
    advance(120)
    shot('round8-shell-release.png')
    shot('round8-shell-release-120.png')
    assert page.evaluate('round8fx.filter(p=>p.sprite===14 && p.color==="#D9D9D9").length===10')
    assert page.evaluate('Clicker.state.package.index>1')
    advance(280)
    shot('round8-shell-release-400.png')
    page.locator('#scene-open').dispatch_event('click')
    advance(200)
    shot('round8-scenes.png')
    assert page.locator('.scene-ticket').count() == 7   # 六個場景 + 印記商店的屋頂星空
    page.locator('.scene-ticket[data-scene="backyard"]').dispatch_event('click')
    advance(500)
    assert page.evaluate('Clicker.state.settings.scene==="backyard" && ClickerScene.current===ClickerScenes.backyard')
    # Record actual canvas draw alpha for one deterministic scene particle until expiry.
    alphas = page.evaluate('''() => {
      let layer;const random=Math.random;Math.random=()=>.5;
      ClickerScene.mount('backyard');ClickerScene.attach({layer(p){layer=p;return p;}});
      const values=[],ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},rect(){},clip(){},globalAlpha:1,
        drawImage(img){if(img.naturalWidth) values.push(this.globalAlpha);}};
      ClickerScene.update(2.35);Math.random=random;
      window.alphaLayer=layer;window.alphaCtx=ctx;window.alphaValues=values;
      return values;
    }''')
    page.wait_for_timeout(100)
    alphas = page.evaluate('''() => {
      // Stop additional spawning by making the next interval distant, keep the first particle.
      const random=Math.random, cfg=ClickerScenes.backyard.particles, every=cfg.everyMs, max=cfg.max;
      Math.random=()=>.5;cfg.everyMs=[1e9,1e9];cfg.max=1;
      for(let i=0;i<450;i++){ClickerScene.update(.016);alphaLayer.draw(alphaCtx);}
      Math.random=random;cfg.everyMs=every;cfg.max=max;return alphaValues;
    }''')
    assert alphas and all(0 <= a <= 1 for a in alphas) and alphas[-1] < .1, alphas[-10:]
    # Real visibility handler must persist a loss before stopping animation/audio.
    page.evaluate('''() => {const s=Clicker.state;s.bossWins=[];s.bossCracks={};s.bossCooldownUntil=0;
      s.scenePackages={};s.package=ClickerEconomy.newPackage('backyard',51);s.bossResult=null;
      document.getElementById('tap').click();}''')
    advance(1100)
    page.locator('#boss-challenge').dispatch_event('click')
    advance(700)
    page.evaluate('''() => {Clicker.state.boss.dealt=Clicker.state.boss.need*.8;
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}''')
    assert page.evaluate('!Clicker.state.boss && JSON.parse(localStorage.getItem("clicker_save")).bossCracks.backyard===.4')
    (OUT / 'round8-results.json').write_text(json.dumps({'missingAssets': sorted(missing), 'errors': errors, 'lastParticleAlpha': alphas[-1]}, indent=2), encoding='utf8')
    assert not errors, errors
    context.close()
    print('PASS round8: boss enter/fail/retry/win, free five-draw, kitchen shells, tickets, particle alpha; missing assets recorded')


def round9(browser):
    context=browser.new_context(viewport={'width':960,'height':640})
    context.add_init_script("const animate=Element.prototype.animate;Element.prototype.animate=function(...args){const a=animate.apply(this,args);a.testBorn=performance.now();return a;};")
    errors=[]
    def route(request):
        path=(SRC/unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            request.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: request.fulfill(status=404,body='missing')
    context.route('**/*',route)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.clock.install();page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    page.clock.pause_at(datetime.fromtimestamp((page.evaluate('Date.now()')+1000)/1000,timezone.utc))
    def advance(ms):
        for _ in range(ms//20):
            page.clock.run_for(20)
            page.evaluate('for(const a of document.getAnimations()) if(a.testBorn!==undefined) a.currentTime=performance.now()-a.testBorn')
    def shot(name): page.screenshot(path=str(OUT/('round9-'+name+'.png')))
    page.evaluate("""() => {const s=Clicker.state;s.collection=Object.fromEntries(Object.keys(ClickerBalance.characters).map(id=>[id,1]));s.lifetimeCoins=1e6;s.skillSlots=['caihua','yueyue','jiaobu'];s.manualClicks=50;s.claimedMilestones=['tutorial50'];s.slotReadyAt=[0,0,0];}""")
    advance(1100)
    page.locator('.skill-use').first.hover();shot('hover')
    assert '現在：' in page.locator('.skill-use').first.get_attribute('title')
    assert '下一星：' in page.locator('.skill-use').first.get_attribute('title')
    assert page.locator('.skill-use .affinity-flag').count()==1
    assert page.locator('.buddy .affinity-flag').count()==2
    page.locator('#roster-open').click();shot('bonds')
    page.locator('.album-slot[data-id="yueyue2"]').click();advance(300)
    assert '羈絆' in page.locator('#album-detail').inner_text();shot('bonds-detail')
    page.keyboard.press('Escape');advance(400)
    page.locator('#recommend-open').click();shot('recommendations')
    page.locator('.recommend-ticket').first.click()
    assert page.evaluate('Clicker.state.skillSlots')==['yueyue','dog','jiaobu']
    assert page.evaluate('Clicker.state.slotReadyAt[0]>Date.now()')
    page.locator('#roster-close').click();page.mouse.move(900,620);advance(31000)
    page.locator('.skill-use').nth(1).click();shot('chain-0');advance(2400)
    page.locator('.skill-use').nth(0).click();advance(300);shot('chain-2-300')
    assert page.locator('#chain-tape').get_attribute('data-count')=='2'
    advance(800);shot('chain-stamp-2');assert page.locator('#cutin-chain-stamp').inner_text()=='連鎖 ×2'
    advance(1300)
    page.locator('.skill-use').nth(2).click();page.mouse.move(900,620);advance(700);shot('chain-3-700')
    assert page.locator('#chain-tape').get_attribute('data-count')=='3'
    advance(400);shot('chain-stamp-3');advance(13000)   # 第十五輪玥圓羈絆連鎖窗 12 秒
    assert 'visible' not in page.locator('#chain-tape').get_attribute('class')
    assert not errors,errors
    (OUT/'round9-results.json').write_text(json.dumps({'errors':errors,'checks':['hover','bonds','recommendations','flags','three chain stages','stamps','expiry']},ensure_ascii=False,indent=2),encoding='utf8')
    context.close();print('PASS round9 browser')


def round11(browser):
    """第十一輪：三連包掃三下、輸送帶剩 5 秒抖動與漏包、禮包升起／落地／拆完／過期、三場景靜態圖與票券選單。"""
    import time
    context = browser.new_context(viewport={'width': 960, 'height': 640})
    context.add_init_script('''let fx; window.r11fx=[];
      Object.defineProperty(window,'GachaFx',{get:()=>fx,set:value=>{
        fx=value;const create=fx.createScope;
        fx.createScope=(...args)=>{const scope=create(...args),spawn=scope.spawn;
          scope.spawn=p=>{r11fx.push({...p});spawn.call(scope,p)};return scope;};
      }});
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){const a=animate.apply(this,args);a.testBorn=performance.now();return a;};''')
    missing, errors = set(), []
    def route(request):
        name = unquote(urlparse(request.request.url).path).lstrip('/')
        path = (SRC / name).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            request.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            missing.add(name); request.fulfill(status=404, body='missing')
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    page.clock.pause_at(datetime.fromtimestamp((page.evaluate('Date.now()') + 1000) / 1000, timezone.utc))
    def advance(ms):
        for _ in range(ms // 20):
            page.clock.run_for(20)
            page.evaluate('for(const a of document.getAnimations()) if(a.testBorn!==undefined && a.playState!=="paused") a.currentTime=performance.now()-a.testBorn')
        if ms % 20:
            page.clock.run_for(ms % 20)
    def shot(name):
        page.screenshot(path=str(OUT / f'round11-{name}.png'))
    def images_ready():
        for _ in range(100):
            if page.evaluate("[...document.querySelectorAll('#clicker-scene img,#triple img,#bag img,#belt img,#gift-bag,#gift-boss')].every(i=>i.complete)"):
                return
            time.sleep(.05); page.clock.run_for(20)
        raise AssertionError('scene images did not load')
    def go(scene):
        # 真實路徑：場景票券選單 → switchScene → mount
        # 沒有夥伴（被動 0／秒）：三連包「只推指向的子包」與禮包「不進拆包進度」才能用等號斷言
        # 種子包數會跨過第 100 包，先把 12 選 1 標成已選，免得第十二輪的選角面板蓋住熱區
        page.evaluate('''() => {const s=Clicker.state;s.bossWins=['backyard','kitchen','market','factory'];s.badges=[...new Set([...(s.badges||[]),'pack100'])];s.pick100=s.pick100||'yueyue2';}''')
        page.locator('#scene-open').dispatch_event('click'); advance(100)
        page.locator(f'.scene-ticket[data-scene="{scene}"]').dispatch_event('click'); advance(500)
        assert page.evaluate('Clicker.state.settings.scene') == scene and page.evaluate('ClickerScene.current') == page.evaluate(f'ClickerScenes.{scene}')
        images_ready(); advance(700)
    advance(1100)
    # 票券選單：六張票，未解鎖文字用該場景王的名字
    page.evaluate("Clicker.state.bossWins=['backyard','kitchen']")
    page.locator('#scene-open').dispatch_event('click'); advance(200); shot('tickets')
    assert page.locator('.scene-ticket').count() == 7   # 六個場景 + 屋頂星空
    assert '大三連包' in page.locator('.scene-ticket[data-scene="factory"]').inner_text() and '大輸送箱' in page.locator('.scene-ticket[data-scene="nightmarket"]').inner_text()
    assert not page.locator('.scene-ticket[data-scene="market"]').is_disabled() and page.locator('.scene-ticket[data-scene="factory"]').is_disabled()
    page.locator('#scenes-close').dispatch_event('click'); advance(100)

    # ── 便利商店三連包 ──
    go('market'); shot('market')
    assert page.evaluate('document.getElementById("stage").dataset.enemy') == 'triple'
    assert page.locator('#triple').is_visible() and page.locator('#bag').is_hidden() and page.locator('.sub-hot:not([hidden])').count() == 3 and page.locator('#belt').is_hidden()
    assert page.evaluate("[...document.querySelectorAll('.sub-hot')].every(e=>getComputedStyle(e).pointerEvents==='auto') && getComputedStyle(document.getElementById('triple')).pointerEvents==='none'")
    layers = page.evaluate("[...document.querySelectorAll('.scene-layer')].map(e=>e.dataset.layer)")
    assert layers == ['sky', 'far', 'mid', 'ground', 'props', 'tags'], layers
    assert page.evaluate("(()=>{const r=document.querySelector('[data-layer=far] img').getBoundingClientRect();return Math.round(r.width)===260 && Math.round(r.height)===150;})()")
    assert page.evaluate("document.querySelectorAll('[data-layer=tags] img').length===2 && document.querySelector('[data-layer=tags] img').style.transformOrigin==='50% 0px'")
    # 真實座標點擊：落在第一包（舞台 x 380 → 畫面 396）而不是珍母熱區
    page.mouse.click(396, 318); advance(60)
    assert page.evaluate('Clicker.state.sweep.last') == 0 and page.evaluate('(s=>s[0].progress>s[1].progress && Math.abs(s[1].progress-s[2].progress)<1e-6)(Clicker.state.package.sub)'), '點擊只推第一包，被動平均分給其餘'
    page.mouse.click(458, 318); advance(60)
    page.evaluate('r11fx.length=0')
    page.mouse.click(520, 318); advance(40)
    assert page.evaluate('Clicker.state.sweep.count') == 3 and page.evaluate('Clicker.state.sweep.last') == 2
    assert page.locator('.floater .sweep-stamp').count() == 1 and page.locator('.floater .sweep-stamp').last.inner_text() == '掃！'
    assert page.evaluate("r11fx.every(p=>Math.abs(p.x-520)<=12)"), '第三包的粒子要噴在第三包上'
    shot('market-sweep')
    # 點珍母：平均分配、掃過去重算
    page.locator('#tap').dispatch_event('click'); advance(60)
    assert page.evaluate('Clicker.state.sweep.count') == 0 and page.evaluate('Clicker.state.package.sub.every(x=>x.progress>0)')
    # 單包拆完先爆開留在原地，三個都完成整組滑出
    page.evaluate('''() => {const s=Clicker.state,need=ClickerEconomy.subNeed(s.package.index,'market');s.package.sub=[{progress:need-1},{progress:0},{progress:0}];s.package.progress=need-1;}''')
    page.locator('.sub-hot[data-sub="0"]').dispatch_event('click'); advance(60)
    assert page.locator('.sub-pack[data-sub="0"]').get_attribute('src') == 'clicker-pack3-4.png' and page.locator('.sub-pack[data-sub="1"]').get_attribute('src') == 'clicker-pack3-0.png'
    assert page.evaluate('Clicker.state.package.index') == 1
    shot('market-sub-torn')
    page.evaluate('''() => {const s=Clicker.state,need=ClickerEconomy.subNeed(s.package.index,'market');s.package.sub=[{progress:need},{progress:need-1},{progress:need-1}];s.package.progress=3*need-2;}''')
    page.locator('.sub-hot[data-sub="1"]').dispatch_event('click'); advance(30)
    assert page.evaluate('Clicker.state.package.index') == 2
    shot('market-group-complete'); advance(400)
    assert page.evaluate("[...document.querySelectorAll('.sub-pack')].every(e=>e.getAttribute('src')==='clicker-pack3-0.png')")
    # 市場王：換成大三連包的圖
    page.evaluate('''() => {const s=Clicker.state;s.package=ClickerEconomy.newPackage('market',601);s.bossWins=['backyard','kitchen'];s.bossCooldownUntil=0;}''')
    advance(1100); assert page.locator('#boss-challenge').is_visible() and '大三連包' in page.locator('#boss-challenge').inner_text()
    page.locator('#boss-challenge').dispatch_event('click'); advance(700); shot('market-boss')
    assert page.evaluate('!!Clicker.state.boss') and page.locator('#boss-image').get_attribute('src') == 'clicker-boss3-pack.png'
    assert page.locator('.sub-hot:not([hidden])').count() == 0
    page.evaluate('Clicker.state.boss.dealt=0'); page.clock.fast_forward(31000); advance(1400); assert page.evaluate('!Clicker.state.boss')

    # ── 零食工廠輸送帶 ──
    go('factory'); shot('factory')
    assert page.evaluate('document.getElementById("stage").dataset.enemy') == 'timer' and page.locator('#belt').is_visible() and page.locator('#bag').is_visible()
    assert page.evaluate("[...document.querySelectorAll('.scene-layer')].map(e=>e.dataset.layer)") == ['sky', 'far', 'gears', 'smoke', 'mid', 'ground', 'props']
    assert page.evaluate('Clicker.state.package.deadline > Date.now()')
    before = page.evaluate("document.getElementById('belt-track').style.backgroundPositionX")
    advance(500)
    assert page.evaluate("document.getElementById('belt-track').style.backgroundPositionX") != before, '帶面要捲動'
    assert page.evaluate("(()=>{const a=document.querySelector('[data-layer=gears] img').style.transform;return /rotate\\(-?\\d/.test(a);})()")
    page.evaluate('Clicker.state.package.deadline=Date.now()+4800'); advance(400)
    assert page.locator('#bag.shiver').count() == 1 and page.locator('#belt-lamp.warn').count() == 1 and page.locator('#belt-timer').inner_text() == '5s'
    shot('factory-shiver')
    page.evaluate('r11fx.length=0'); coins = page.evaluate('Clicker.state.coins'); index = page.evaluate('Clicker.state.package.index')
    advance(4600)
    assert page.evaluate('Clicker.state.missed') == 1 and page.evaluate('Clicker.state.package.index') == index and page.evaluate('Clicker.state.package.progress') < 1e-6 * 20
    assert page.evaluate('Clicker.state.coins') >= coins
    assert page.locator('.floater.miss').count() == 1 and page.locator('.floater.miss').inner_text() == '漏了！'
    shot('factory-miss')
    advance(700); shot('factory-next-enter'); advance(600)
    assert page.locator('#bag.shiver').count() == 0 and page.evaluate('Clicker.state.package.deadline - Date.now() > 14000')
    page.locator('#stats-open').dispatch_event('click'); assert '漏掉 1 包' in page.locator('#stats-body').inner_text(); page.locator('#stats-close').dispatch_event('click')

    # ── 夜市限時大禮包 ──
    go('nightmarket'); shot('nightmarket')
    assert page.evaluate('document.getElementById("stage").dataset.enemy') == 'gift' and page.evaluate('Clicker.state.nextGiftAt > Date.now()')
    assert page.evaluate("[...document.querySelectorAll('.scene-layer')].map(e=>e.dataset.layer)") == ['sky', 'far', 'moths', 'mid', 'ground', 'props', 'lanterns']
    # 排程到期後由 1Hz 的結算撿起；等它生出禮包再量演出時間軸（升起 300ms → 拋物線 500ms → 落地）
    page.evaluate('Clicker.state.nextGiftAt=Date.now()-1')
    for _ in range(60):
        advance(20)
        if page.evaluate('!!Clicker.state.gift'): break
    assert page.evaluate('!!Clicker.state.gift') and page.evaluate('Clicker.state.gift.need===4*ClickerEconomy.requirement(Clicker.state.package.index,"nightmarket")')
    advance(160); shot('gift-rise')
    assert page.locator('#gift-clip').is_visible() and page.locator('#gift-hot').is_hidden()
    advance(400); shot('gift-throw')
    advance(300)
    assert page.locator('#gift-hot').is_visible() and page.locator('#gift-timer').is_visible(), '落地後才開熱區與倒數'
    shot('gift-land')
    page.evaluate('r11fx.length=0'); progress = page.evaluate('Clicker.state.package.progress')
    # 假時鐘下 page.mouse.click 偶爾送不到剛落地的熱區（事件一個都沒到），改用 locator.click（會等元素穩定）
    page.locator('#gift-hot').click(position={'x': 52, 'y': 69}); advance(60)
    assert page.evaluate('Clicker.state.gift.dealt>0') and page.evaluate('Clicker.state.package.progress') == progress, '打禮包不進拆包進度'
    assert page.evaluate("r11fx.every(p=>Math.abs(p.x-96)<=12)")
    shot('gift-hit')
    page.evaluate('Clicker.state.gift.dealt=Clicker.state.gift.need-1; r11fx.length=0'); coins = page.evaluate('Clicker.state.coins')
    page.locator('#gift-hot').dispatch_event('click'); advance(120); shot('gift-win')
    assert page.evaluate('Clicker.state.gift===null && Clicker.state.giftResult.won')
    assert page.evaluate('Clicker.state.coins') - coins > page.evaluate('Clicker.state.giftResult.bonus') - 1e-6
    assert page.evaluate('r11fx.filter(p=>p.sprite===8).length') >= 30, '彩帶 30 片'
    assert page.evaluate('JSON.parse(localStorage.clicker_save).giftResult.won'), '禮包結果要即時存檔'
    advance(600); assert page.locator('#gift-clip').is_hidden() and page.locator('#gift-hot').is_hidden()
    page.evaluate('Clicker.state.nextGiftAt=Date.now()-1'); advance(1000); advance(900)
    assert page.locator('#gift-hot').is_visible()
    page.evaluate('Clicker.state.gift.endsAt=Date.now()+300'); coins = page.evaluate('Clicker.state.coins')
    advance(1200)
    assert page.evaluate('Clicker.state.gift===null && !Clicker.state.giftResult.won') and page.evaluate('Clicker.state.coins') >= coins
    advance(120); shot('gift-expire'); advance(400)
    assert page.locator('#gift-bag').is_hidden() and page.locator('#gift-hot').is_hidden()
    (OUT / 'round11-results.json').write_text(json.dumps({'missingAssets': sorted(missing), 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf8')
    assert not errors, errors
    context.close()
    print('PASS round11: tickets, market triple sweep/pop/group/boss, factory belt shiver/miss/enter/stats, nightmarket gift rise/throw/land/hit/win/expire; missing assets recorded')
def round12(browser):
    """第十二輪：冰箱靜態圖與霜層三階、burst 碎冰、今日限定包、徽章蓋下、分享卡 PNG 落地、匯出→清存檔→匯入。"""
    import base64, struct
    context=browser.new_context(viewport={'width':960,'height':640})
    # 離開頁面時 suspend 會 commit 一次，所以種子放 sessionStorage、載入時才搬進 localStorage
    context.add_init_script("""const seed=sessionStorage.getItem('test-seed');if(seed){localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}
      const animate=Element.prototype.animate;Element.prototype.animate=function(...args){const a=animate.apply(this,args);a.testBorn=performance.now();return a;};
      let fx; window.r12fx=[];
      Object.defineProperty(window,'GachaFx',{get:()=>fx,set:value=>{fx=value;const create=fx.createScope;
        fx.createScope=(...args)=>{const scope=create(...args),spawn=scope.spawn;scope.spawn=p=>{r12fx.push({...p});spawn.call(scope,p)};return scope;};}});""")
    errors=[]
    def route(request):
        path=(SRC/unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            request.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: request.fulfill(status=404,body='missing')
    context.route('**/*',route)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.clock.install();page.goto('http://clicker.test/clicker.html')
    def ready():
        page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
        page.wait_for_function("[...document.querySelectorAll('#clicker-scene img')].every(i=>i.complete)")
        page.clock.pause_at(datetime.fromtimestamp((page.evaluate('Date.now()')+1000)/1000,timezone.utc))
    ready()
    def seed(js):
        page.evaluate("""(js) => {const s=ClickerSave.fresh(Date.now());(new Function('s','E',js))(s,ClickerEconomy);sessionStorage.setItem('test-seed',JSON.stringify(s));}""",js)
        page.reload();ready()
    def advance(ms):
        for _ in range(ms//20):
            page.clock.run_for(20)
            page.evaluate('for(const a of document.getAnimations()) if(a.testBorn!==undefined) a.currentTime=performance.now()-a.testBorn')
    def shot(name): page.screenshot(path=str(OUT/('round12-'+name+'.png')))
    checks=[]
    # 一、深夜冰箱：靜態圖、霜層三階
    seed("""s.bossWins=['backyard','kitchen','market','factory','nightmarket'];s.settings.scene='fridge';s.package=E.newPackage('fridge');s.package.progress=E.requirement(1,'fridge')*.5;
      s.collection={caihua:1,yueyue2:1};s.dust={caihua:1,yueyue2:1};s.manualClicks=50;s.claimedMilestones=['tutorial50'];s.lifetimeCoins=1e6;s.coins=1e6;s.skillSlots=['caihua',null,null];s.slotReadyAt=[0,0,0];""")
    advance(1100)
    assert page.evaluate('ClickerScene.current===ClickerScenes.fridge && document.getElementById("stage").dataset.scene==="fridge"')
    assert page.locator('#clicker-scene .scene-tint').count()==1
    assert page.locator('#regen-tag').is_visible() and '−1%/秒' in page.locator('#regen-tag').inner_text()
    assert page.locator('#bag-image').get_attribute('src').startswith('clicker-can-')
    shot('fridge')
    # 可見時每秒回升 need×1%：進度變化 = (P − need×1%) × dt
    page.evaluate("Clicker.state.package.progress=ClickerEconomy.requirement(Clicker.state.package.index,'fridge')*.1")
    before=page.evaluate('({p:Clicker.state.package.progress,t:Clicker.state.settledAt,P:ClickerEconomy.rates(Clicker.state).P,need:ClickerEconomy.requirement(Clicker.state.package.index,"fridge")})');advance(1000)
    after=page.evaluate('({p:Clicker.state.package.progress,t:Clicker.state.settledAt})')
    dt=(after['t']-before['t'])/1000;expected=before['p']+(before['P']-before['need']*.01)*dt
    assert dt>=.9 and abs(after['p']-expected)<before['need']*.001,(before,after,expected)
    checks.append('regen visible tick')
    for level,ratio in [(1,.9),(2,.5),(3,.05)]:
        page.evaluate(f"Clicker.state.package.progress=ClickerEconomy.requirement(1,'fridge')*{ratio}");advance(1000)
        assert page.evaluate('document.getElementById("frost").dataset.level')==str(level), (level, page.evaluate('({lvl:document.getElementById("frost").dataset.level,frost:document.getElementById("frost").style.getPropertyValue("--frost")})'))
        shot(f'frost-{level}')
    checks.append('frost three levels')
    # burst 碎冰：采華龍尾掃袋 → 切入結束後 16 片碎冰
    page.evaluate('r12fx.length=0');page.locator('.skill-use').first.click();page.mouse.move(900,620)
    for _ in range(200):
        advance(20)
        if page.evaluate('r12fx.filter(p=>p.sprite===9 && ["#DFF3FF","#8CC8F0"].includes(p.color)).length')>=16: break
    advance(120);shot('burst-ice-120ms')
    assert page.evaluate('r12fx.filter(p=>p.sprite===9 && ["#DFF3FF","#8CC8F0"].includes(p.color)).length')>=16, page.evaluate('r12fx.length')
    checks.append('burst ice shards')
    page.mouse.move(900,620);advance(2500)
    # 二、今日限定包：上桌、點到拆完、當天不再出現
    seed("""s.collection={yueyue2:1};s.dust={yueyue2:1};s.manualClicks=50;s.claimedMilestones=['tutorial50'];s.clickLevel=40;s.coins=s.lifetimeCoins=100;""")
    advance(1100)
    assert page.locator('#daily-bag').is_visible(), page.evaluate('Clicker.state.daily')
    assert page.evaluate('Clicker.state.daily && !Clicker.state.daily.done && Clicker.state.daily.streak===0')
    shot('daily')
    coins=page.evaluate('Clicker.state.coins');pkg=page.evaluate('Clicker.state.package.progress')
    page.evaluate('r12fx.length=0')
    for _ in range(120):   # 需求約 80 次點擊；點擊上限 8 次/秒，所以每下隔 130ms
        if page.evaluate('Clicker.state.daily.done'): break
        page.locator('#daily-bag').dispatch_event('click');advance(130)
    assert page.evaluate('Clicker.state.daily.done && Clicker.state.freeDraws===1 && Clicker.state.universalDust===1 && Clicker.state.daily.streak===1'), page.evaluate('Clicker.state.daily')
    advance(900); assert page.locator('#daily-done').is_visible(); shot('daily-receipt'); page.locator('#daily-done-close').click(); advance(200)   # 拆完 700ms 後跳收據，關掉才能繼續
    assert page.evaluate('Clicker.state.coins')>coins   # 一般包只有被動在推（點擊全進限定包，node 測試驗）
    assert page.evaluate('r12fx.filter(p=>p.sprite===8).length')>=24
    advance(120);shot('daily-done')
    advance(1500);assert page.locator('#daily-bag').is_hidden()
    assert page.evaluate('JSON.parse(localStorage.getItem("clicker_save")).daily.done')
    checks.append('daily pack appear, complete, rewards, hidden')
    # 三、徽章：第 10 包 → 蓋下 100ms、小恐龍進場景、徽章牆
    page.evaluate('Clicker.state.package.index=11');advance(1000);advance(100)
    assert page.evaluate('Clicker.state.badges.includes("pack10")')
    assert page.locator('#badge-pop').is_visible();shot('badge-100ms')
    assert page.locator('#clicker-scene img[data-toy="toy-dino.png"]').count()==1
    advance(2400)
    page.locator('#stats-open').click();advance(300)
    assert page.locator('#badge-grid .badge-cell').count()==18 and page.locator('#badge-grid .badge-cell.earned').count()==1
    assert '連續 1 天' in page.locator('#stats-body').inner_text()
    shot('badge-wall')
    checks.append('badge pop, toy in scene, wall')
    # 第 100 包 12 選 1
    page.locator('#stats-close').click();page.evaluate('Clicker.state.package.index=101');advance(1100)
    assert page.locator('#pick100').is_hidden()   # 不再自動彈出，改由徽章牆按鈕手動開
    page.locator('#stats-open').click();advance(200);page.locator('#pick100-open').click();advance(200)
    assert page.locator('#pick100').is_visible(), page.evaluate('Clicker.state.badges')
    shot('pick100');page.locator('.pick-card[data-id="zhenmu"]').click();advance(200)
    assert page.evaluate('Clicker.state.pick100==="zhenmu" && ClickerEconomy.dust(Clicker.state,"zhenmu")===1')
    checks.append('pick100')
    # 四、分享卡：canvas 960×540 落地、下載鍵觸發下載
    page.locator('#stats-open').click();advance(200);page.locator('#badge-share').click()
    for _ in range(300):
        advance(20)
        if not page.locator('#share-download').is_disabled(): break
    assert not page.locator('#share-download').is_disabled(), page.locator('#share-status').inner_text()
    shot('share')
    data=page.evaluate('document.getElementById("share-canvas").toDataURL("image/png")')
    png=base64.b64decode(data.split(',',1)[1]);(OUT/'round12-share-card.png').write_bytes(png)
    w,h=struct.unpack('>II',png[16:24]);assert (w,h)==(960,540),(w,h)
    assert len(png)>20000
    with page.expect_download() as dl: page.locator('#share-download').click()
    assert dl.value.suggested_filename.endswith('.png')
    page.locator('#share-copy').click();advance(200);page.locator('#share-close').click()
    checks.append('share card png 960x540 + download')
    # 五、匯出 → 清存檔 → 匯入 → 狀態一致
    page.locator('#stats-open').click();advance(100);page.locator('#io-export').click()
    text=page.locator('#io-text').input_value();assert text.startswith('ZMDD1.')
    snapshot=page.evaluate('({coins:Clicker.state.coins,index:Clicker.state.package.index,collection:Clicker.state.collection,badges:Clicker.state.badges,pick:Clicker.state.pick100})')
    page.locator('#stats-close').click()
    page.evaluate("sessionStorage.setItem('test-seed',JSON.stringify(ClickerSave.fresh(Date.now())))");page.reload();ready();advance(1100)
    assert page.evaluate('Clicker.state.package.index')==1
    page.locator('#stats-open').click();advance(100);page.locator('#io-import').click()
    page.locator('#io-text').fill('ZMDD1.not-a-save');page.locator('#import-check').click()
    assert '無法匯入' in page.locator('#io-status').inner_text() and page.locator('#import-confirm').is_hidden()
    page.locator('#io-text').fill(text);page.locator('#import-check').click()
    assert '確定要覆蓋' in page.locator('#io-status').inner_text(), page.locator('#io-status').inner_text()
    shot('import-check');page.locator('#import-confirm').click();advance(300)
    assert page.locator('#stats').is_hidden()
    after=page.evaluate('({coins:Clicker.state.coins,index:Clicker.state.package.index,collection:Clicker.state.collection,badges:Clicker.state.badges,pick:Clicker.state.pick100})')
    assert after==snapshot,(snapshot,after)
    assert page.evaluate('JSON.parse(localStorage.getItem("clicker_save")).package.index')==snapshot['index']
    assert page.locator('#clicker-scene img[data-toy="toy-dino.png"]').count()==1
    shot('imported')
    checks.append('export → wipe → import roundtrip')
    assert not errors,errors
    (OUT/'round12-results.json').write_text(json.dumps({'errors':errors,'checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
    context.close();print('PASS round12 browser')


def main():
    OUT.mkdir(exist_ok=True)
    os.chdir(OUT)  # Chromium audio may emit debug.log; keep all generated files here.
    errors = []
    original_css = subprocess.check_output(['git', 'show', 'HEAD:src/gacha-card.css'], cwd=ROOT) + subprocess.check_output(['git', 'show', 'HEAD:src/gacha.css'], cwd=ROOT)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required', '--log-file='+str(OUT / 'chromium.log')])
        if '--round11' in __import__('sys').argv:
            round11(browser)
        if '--round12' in __import__('sys').argv:
            round12(browser)
            browser.close()
            return
        if '--round9' in __import__('sys').argv:
            round9(browser)
            browser.close()
            return
        if '--round8' in __import__('sys').argv:
            round8(browser)
            browser.close()
            return
        if '--round7' in __import__('sys').argv:
            round7(browser)
            browser.close()
            return
        if not any(arg in __import__('sys').argv for arg in ['--round5', '--round6']):
            round7(browser)
        context = browser.new_context(viewport={'width': 960, 'height': 640}, device_scale_factor=1.25)
        context.add_init_script('''const animate = Element.prototype.animate; Element.prototype.animate = function(...args) {const a=animate.apply(this,args);a.testBorn=performance.now();return a;};''')
        context.add_init_script('''const seed = sessionStorage.getItem('test-seed'); if(seed) {localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}''')
        context.add_init_script('''(() => {
          window.testSchedules={raf:new Set(),timeout:new Set(),interval:new Set()}; window.testFns=new Map();
          const raf=requestAnimationFrame.bind(window), cancel=cancelAnimationFrame.bind(window);
          window.requestAnimationFrame=fn=>{const id=raf(t=>{testSchedules.raf.delete(id);fn(t)});testSchedules.raf.add(id);return id};
          window.cancelAnimationFrame=id=>{testSchedules.raf.delete(id);cancel(id)};
          const timeout=setTimeout.bind(window), clear=clearTimeout.bind(window), interval=setInterval.bind(window), clearI=clearInterval.bind(window);
          window.setTimeout=(fn,ms,...args)=>{const id=timeout(()=>{testSchedules.timeout.delete(id);testFns.delete(id);fn(...args)},ms);testSchedules.timeout.add(id);testFns.set(id,String(fn).slice(0,160)+' @'+ms);return id};
          window.clearTimeout=id=>{testSchedules.timeout.delete(id);clear(id)};
          window.setInterval=(fn,ms,...args)=>{const id=interval(fn,ms,...args);testSchedules.interval.add(id);testFns.set(id,'INTERVAL '+String(fn).slice(0,160)+' @'+ms);return id};
          window.clearInterval=id=>{testSchedules.interval.delete(id);clearI(id)};
        })();''')

        context.add_init_script("""(() => {
          let fx; window.fxEvents=[]; window.fxBindings=[];
          Object.defineProperty(window,'GachaFx',{get:()=>fx,set:value=>{
            fx=value; const init=fx.init, create=fx.createScope;
            fx.init=(canvas,...args)=>{fxBindings.push(canvas.id);init(canvas,...args)};
            fx.createScope=(...args)=>{const scope=create(...args), spawn=scope.spawn;
              scope.spawn=p=>{fxEvents.push({...p,canvas:fxBindings.at(-1)});spawn.call(scope,p)};return scope;};
          }});
        })();""")

        def route(request):
            name = unquote(urlparse(request.request.url).path).lstrip('/')
            if name == 'original-gacha.css':
                request.fulfill(body=original_css, content_type='text/css')
                return
            path = (SRC / name).resolve()
            if path.is_relative_to(SRC) and path.is_file():
                request.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else:
                request.fulfill(status=404, body='not found')

        context.route('**/*', route)
        round6(context)
        round5(context)
        if '--round6' in __import__('sys').argv or '--round5' in __import__('sys').argv:
            browser.close()
            return
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://clicker.test/clicker.html')
        page.evaluate("sessionStorage.setItem('test-seed',JSON.stringify(ClickerSave.fresh(Date.now())))")
        page.reload()
        page.wait_for_function('window.Clicker && !document.getElementById("tap").disabled')
        page.locator('#receipt-close').click() if page.locator('#receipt').is_visible() else None
        assert page.evaluate('Clicker.state.coins') == 0
        assert page.locator('#hero > svg').count() == 1
        assert page.locator('#tap').bounding_box()['width'] == 240
        assert page.locator('#hero > svg').bounding_box()['height'] > 185
        assert page.evaluate('testSchedules.raf.size') == 2
        page.wait_for_timeout(550)
        page.screenshot(path=str(OUT / 'opening.png'))
        # 真實輸入節流：同一秒 12 次只能記 8 次。
        page.evaluate('for(let i=0;i<12;i++) document.getElementById("tap").click()')
        assert page.evaluate('Clicker.state.manualClicks') == 8
        for _ in range(5):
            page.wait_for_timeout(1010)
            page.evaluate('for(let i=0;i<8;i++) document.getElementById("tap").click()')
        page.wait_for_timeout(1010)
        page.evaluate('document.getElementById("tap").click(); document.getElementById("tap").click()')
        page.wait_for_timeout(70); page.screenshot(path=str(OUT / 'join-tutorial.png'))
        assert page.evaluate('Clicker.state.collection.yueyue2') == 1
        assert page.evaluate('Clicker.state.paidDraws') == 0
        assert page.locator('#slots .skill-use').first.is_enabled()
        page.locator('#slots .skill-use').first.click()
        assert page.evaluate('Clicker.state.effects[0].remaining') == 10
        assert page.evaluate('Object.keys(localStorage)') == ['clicker_save']
        page.screenshot(path=str(OUT / 'tutorial.png'))

        # 注入一份合法測試存檔後重新載入：完整隊伍、寄生、五模式、pending 恢復。
        page.evaluate('''() => {
          const s=ClickerSave.fresh(Date.now()); s.coins=s.lifetimeCoins=1000000;
          s.collection=Object.fromEntries(GachaPool.CHARACTER_IDS.map(id=>[id,1]));
          s.skillSlots=['yueyue2','jiaobu','zhenmu']; sessionStorage.setItem('test-seed',JSON.stringify(s));
        }''')
        page.reload(); page.wait_for_function('window.Clicker && !document.getElementById("tap").disabled')
        page.locator('#slots .skill-use').nth(2).click()
        assert page.evaluate('Clicker.state.effects[0].target') == 'yueyuexian'   # 第十五輪起最高收益夥伴是神話玥來玥閒
        page.wait_for_timeout(1400)
        assert page.locator('#parasite-label svg, #parasite-label img').count() == 1
        assert page.locator('#stage .partner, #parasite-host').count() == 0
        page.screenshot(path=str(OUT / 'parasite.png'))
        page.locator('#roster-open').click(); assert page.locator('.album-slot').count() == 8   # 第十輪起是卡冊：一跨頁 8 張
        page.screenshot(path=str(OUT / 'roster.png')); page.locator('#roster-close').click()

        for name in ['wish', 'hearthstone', 'summon', 'stage', 'rip']:
            page.locator('#recruit-open').click()
            page.locator('#mode-select').select_option(name)
            if name not in ['wish', 'hearthstone']:
                assert page.locator('#recruit-one').is_disabled()
            page.locator('#recruit-five').click()
            page.wait_for_function('Clicker.state.pending !== null')
            draw_id = page.evaluate('Clicker.state.pending.draw.id')
            page.wait_for_timeout(350)
            page.locator('#skip').click()
            assert page.evaluate('Clicker.state.pending.draw.id') == draw_id
            assert page.locator('#cards .card.flipped').count() == 5
            if name == 'wish':
                page.reload(); page.wait_for_selector('#collect', state='visible')
                assert page.evaluate('Clicker.state.pending.draw.id') == draw_id
                page.wait_for_timeout(700)
                page.screenshot(path=str(OUT / 'pending.png'))
            before = page.evaluate('Object.values(Clicker.state.collection).reduce((a,b)=>a+b,0)')
            page.evaluate('document.getElementById("collect").click();document.getElementById("collect").click()')
            if name == 'wish':
                page.wait_for_selector('#join-flight svg, #join-flight img')
                page.screenshot(path=str(OUT / 'join-duplicate.png'))
            assert page.evaluate('Clicker.state.pending') is None
            assert page.evaluate('Object.values(Clicker.state.collection).reduce((a,b)=>a+b,0)') == before + 5

        # 故意令儲存失敗：消費不改記憶體，顯示尚未儲存並鎖住。
        page.evaluate('() => {window.savedSetItem=Storage.prototype.setItem; Storage.prototype.setItem=()=>{throw Error("test quota")};}')
        before = page.evaluate('Clicker.state.clickLevel')
        page.locator('#click-one').click()
        assert page.evaluate('Clicker.state.clickLevel') == before
        assert page.locator('#save-status').inner_text() == '尚未儲存'
        assert page.locator('#draw-one').is_disabled()
        page.evaluate('() => {Storage.prototype.setItem=window.savedSetItem;}')
        page.locator('#retry-save').click()
        assert page.locator('#tap').is_enabled()

        # 隱藏 / 返回：手點與主舞台迴圈停，收益回來才結算，pending 直接總覽。
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true}); document.dispatchEvent(new Event("visibilitychange"));')
        held = page.evaluate('Clicker.state.settledAt')
        page.wait_for_timeout(1100)
        assert page.evaluate('Clicker.state.settledAt') == held
        assert page.evaluate('document.getAnimations().length') == 0
        assert page.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0, 0, 0], page.evaluate('[...testSchedules.timeout, ...testSchedules.interval].map(id=>testFns.get(id))')
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false}); document.dispatchEvent(new Event("visibilitychange"));')
        assert page.evaluate('Clicker.state.settledAt') > held

        page.locator('#recruit-open').click(); page.locator('#mode-select').select_option('wish'); page.locator('#recruit-five').click()
        page.wait_for_timeout(900)
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true}); document.dispatchEvent(new Event("visibilitychange"));')
        page.wait_for_timeout(500)
        assert page.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0, 0, 0], page.evaluate('[...testSchedules.timeout, ...testSchedules.interval].map(id=>testFns.get(id))')
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false}); document.dispatchEvent(new Event("visibilitychange"));')
        assert page.locator('#collect').is_visible()
        page.locator('#collect').click()

        bindings=page.evaluate('fxBindings'); page.close()
        # Round 2 scenes use the actual save/load and input paths; no server or app debug API.
        scenes = context.new_page(); scenes.on('pageerror', lambda error: errors.append(str(error)))
        scenes.goto('http://clicker.test/clicker.html')
        scenes.wait_for_function('window.Clicker && !document.getElementById("tap").disabled')

        def seed(count=6, progress=0, heavy=False, cooldown=False, coins=1000000, level=0):
            nonlocal scenes
            fixture = scenes.evaluate("""({count,progress,heavy,cooldown,coins,level}) => {
              let s=ClickerSave.fresh(Date.now()); s.settings.muted=true;
              s.coins=coins; s.lifetimeCoins=Math.max(coins,1000000); s.clickLevel=level; s.manualClicks=count ? 50 : 0; s.claimedMilestones=count ? ['tutorial50'] : [];
              const ids=count>=7 ? ['yueyue2','jiaobu','zhenmu',...Object.keys(ClickerBalance.characters).filter(id=>!['yueyue2','jiaobu','zhenmu'].includes(id))] : Object.keys(ClickerBalance.characters); s.collection=Object.fromEntries(ids.slice(0,count).map(id=>[id,1]));
              s.package.progress=progress;
              if(count>=7) s.skillSlots=['yueyue2','jiaobu','zhenmu'];
              if(cooldown) s.slotReadyAt=[s.settledAt+30000,s.settledAt+30000,s.settledAt+30000];
              if(heavy) s=ClickerEconomy.activate(s,1,Date.now()).state;
              ClickerSave.validate(s,GachaPool);
              return s;
            }""", dict(count=count,progress=progress,heavy=heavy,cooldown=cooldown,coins=coins,level=level))
            scenes.close(); scenes = context.new_page()
            scenes.on('pageerror', lambda error: errors.append(str(error)))
            scenes.add_init_script('''const fixture=''' + json.dumps(fixture) + ''';
              // Pin settlement beyond asset loading; slow image/font decode cannot advance fixture packages.
              const delta=Date.now()+86400000-fixture.settledAt; fixture.savedAt+=delta; fixture.settledAt+=delta;
              fixture.slotReadyAt=fixture.slotReadyAt.map(t=>t?t+delta:0);
              for(const id in fixture.cooldownUntil) fixture.cooldownUntil[id]+=delta;
              fixture.effects.forEach(e=>{e.startedAt+=delta;e.expiresAt+=delta;});
              localStorage.setItem('clicker_save',JSON.stringify(fixture));''')
            scenes.clock.install()
            scenes.goto('http://clicker.test/clicker.html')
            scenes.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
            scenes.wait_for_function('GachaFx.sheetReady()')
            scenes.clock.pause_at(datetime.fromtimestamp((scenes.evaluate('Date.now()') + 2000) / 1000, timezone.utc))
            advance(600)


        def advance(ms):
            # Playwright's virtual clock does not seek the Web Animations timeline.
            # Advance both clocks together so captures represent the requested frame.
            while ms > 0:
                step=min(ms,16); scenes.clock.run_for(step); ms-=step
                scenes.evaluate("document.getAnimations().filter(a=>a.playState!=='paused' && a.testBorn!==undefined).forEach(a=>{a.currentTime=performance.now()-a.testBorn;})")

        def shot(name):
            if name.startswith('click-'):
                assert scenes.evaluate('''() => {
                  const data=document.getElementById('click-fx').getContext('2d').getImageData(0,0,960,640).data;
                  return data.some((v,i)=>i%4===3 && v>0);
                }'''), 'Particle canvas is empty: '+name
            scenes.screenshot(path=str(OUT / (name+'.png')))

        # Round 4: real activation/settlement; exact virtual-time storyboard captures.
        seed(0); shot('round4-font-loaded-empty-slots')
        assert scenes.evaluate("document.fonts.check('16px Huninn')")
        assert scenes.locator('.skill-slot[data-state="empty"]').count() == 3
        assert scenes.locator('.skill-use').first.get_attribute('title') == '點我選一位夥伴'
        seed(10,cooldown=True); shot('round4-slots-cooldown')
        assert scenes.locator('.skill-slot[data-state="cooldown"]').count() == 3
        seed(10); shot('round4-ten-partners-ready')
        assert scenes.locator('.skill-slot[data-state="ready"]').count() == 3
        assert scenes.locator('.buddy').count() == 10
        scenes.locator('#roster-open').click(); advance(160); shot('round4-roster-paper'); scenes.locator('#roster-close').click()
        for slot, character in enumerate(['yueyue2','jiaobu','zhenmu']):
            seed(10)
            scenes.evaluate("""slot => {
              document.querySelectorAll('.skill-use')[slot].click();
              window.beforeCutinClicks=Clicker.state.manualClicks;
              window.beforeCutinCoins=Clicker.state.coins;
              window.frozenHero=document.querySelector('#hero svg').style.transform;
              window.heldExpected=0;
            }""",slot)
            previous=0
            for elapsed, phase in [(100,'hit-stop'),(300,'panel'),(500,'name'),(800,'hold'),(1150,'exit')]:
                advance(elapsed-previous); previous=elapsed
                assert scenes.locator('#cutin').get_attribute('data-phase') == phase
                if elapsed == 100:
                    scenes.evaluate("document.getElementById('recruit-open').click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));")
                    assert scenes.locator('#recruit-layer').is_hidden()
                    assert scenes.locator('#game.stage-frozen').count() == 1
                assert scenes.evaluate("document.querySelector('#hero svg').style.transform === frozenHero")
                before=scenes.evaluate('Clicker.state.coins')
                scenes.evaluate("document.getElementById('tap').click()")
                scenes.evaluate('heldExpected+=Clicker.state.coins-'+str(before))
                assert scenes.locator('.floater').count() == 0
                assert scenes.evaluate('fxEvents.length') == 0
                scenes.evaluate("document.querySelectorAll('#cutin *').forEach(el=>el.getAnimations().forEach(a=>{a.currentTime=performance.now()-a.testBorn;a.pause();}))")
                shot(f'round4-cutin-{character}-{elapsed}')
            assert scenes.evaluate('Clicker.state.manualClicks-beforeCutinClicks') == 5
            assert scenes.evaluate('Clicker.state.coins>beforeCutinCoins')
            advance(251)
            assert scenes.locator('#cutin > *').count() == 0
            assert scenes.locator('#game.stage-frozen').count() == 0
            assert scenes.locator('.floater').count() == 1
            assert abs(float(scenes.locator('.floater b').inner_text()[1:].replace(',',''))-scenes.evaluate('heldExpected')) <= .051
            if character == 'zhenmu':
                advance(320); shot('round4-parasite-merge')
                assert scenes.locator('#parasite-label svg, #parasite-label img').count() == 1
        seed(10); scenes.emulate_media(reduced_motion='reduce')
        scenes.evaluate("document.querySelector('.skill-use').click()")
        advance(700); shot('round4-cutin-reduced')
        assert scenes.locator('#cutin-speedlines').count() == 0
        advance(701); assert scenes.locator('#cutin > *').count() == 0
        seed(10)
        scenes.evaluate("document.getElementById('tap').click()")
        advance(60)
        scenes.evaluate("document.querySelector('.skill-use').click()")
        advance(100)
        held=scenes.evaluate("({canvas:document.getElementById('click-fx').toDataURL(),float:getComputedStyle(document.querySelector('.floater')).transform,bag:getComputedStyle(document.getElementById('bag-image')).transform})")
        advance(300)
        assert held == scenes.evaluate("({canvas:document.getElementById('click-fx').toDataURL(),float:getComputedStyle(document.querySelector('.floater')).transform,bag:getComputedStyle(document.getElementById('bag-image')).transform})")
        advance(380)
        scenes.evaluate("document.querySelectorAll('#cutin *').forEach(el=>el.getAnimations().forEach(a=>{a.currentTime=performance.now()-a.testBorn;a.pause();}))")
        shot('round4-cutin-stamp-780')
        advance(621)
        assert scenes.locator('#cutin > *').count() == 0
        # Hiding halfway must cancel the cut-in along with all stage schedules.
        seed(10); scenes.evaluate("document.querySelector('.skill-use').click()")
        advance(400)
        scenes.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));')
        advance(60)
        assert scenes.locator('#cutin > *').count() == 0
        assert scenes.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0,0,0]

        for count in [1,6,7,9,10,12]:
            seed(count); assert scenes.locator('.buddy').count()==min(count,10), (count, scenes.locator('.buddy').count(), scenes.evaluate('Clicker.state'), scenes.locator('#fatal').text_content())
            assert scenes.locator('#hero > svg').count()==1
            shot('buddies-'+str(count))
            if count > 10:
                scenes.locator('#buddy-next').click(); assert scenes.locator('.buddy').count()==count-10
                shot('buddies-'+str(count)+'-page2')
        # Round 3: real pointer coordinates, scaled viewport, wallet tween and paper cards.
        for zoom in [1, .75]:
            for corner, offset in [('upper-left', 8), ('lower-right', 232)]:
                seed(1)
                scenes.evaluate("z => document.getElementById('zoomer').style.transform='scale('+z+')'", zoom)
                box = scenes.locator('#tap').bounding_box()
                x, y = box['x'] + offset * zoom, box['y'] + offset * zoom
                scenes.evaluate('fxEvents.length=0')
                scenes.mouse.click(x, y)
                expected = scenes.evaluate("({x,y})=>{const r=document.getElementById('game').getBoundingClientRect();return {x:(x-r.left)*960/r.width,y:(y-r.top)*640/r.height}}", dict(x=x,y=y))
                particles = scenes.evaluate('fxEvents')
                assert len(particles)==8
                assert all(abs(v['x']-expected['x'])<=10 and abs(v['y']-expected['y'])<=4 for v in particles)
                floater = scenes.locator('.floater')
                assert abs(float(floater.evaluate('(e)=>e.style.left.slice(0,-2)'))-expected['x'])<=10
                assert float(floater.evaluate('(e)=>e.style.top.slice(0,-2)'))==expected['y']-12
                advance(60); shot('click-pointer-'+corner+'-'+str(zoom))
        seed(0,coins=0,level=50)
        scenes.locator('#tap').focus(); scenes.keyboard.press('Space'); advance(64)
        target = scenes.evaluate('Clicker.state.coins')
        assert target > 1000
        shown = float(scenes.locator('#coins').inner_text().replace(',',''))
        assert 0 < shown < target
        assert all(abs(v['x']-485)<=10 and abs(v['y']-240)<=4 for v in scenes.evaluate('fxEvents'))
        shot('wallet-tween-increase')
        advance(240)
        assert float(scenes.locator('#coins').inner_text().replace(',',''))==int(target)
        for coins, expected in [(9999,'9,999'),(12345,'1.23萬'),(120000000,'1.20億'),(12089300,'1209萬'),(2.4e12,'2.40兆')]:
            seed(0,coins=coins)
            assert scenes.locator('#coins').inner_text()==expected
            assert scenes.locator('#coins').get_attribute('title')==f'{int(coins):,}'
        seed(0,99)
        scenes.locator('#tap').focus(); scenes.keyboard.press('Enter')
        values=[]
        for _ in range(35):
            advance(16)
            values.append(scenes.locator('#package-progress').evaluate('(e)=>e.value'))
        assert 1 in values and values[-1]==0, values
        seed(9); advance(200); shot('shop-round3')
        assert scenes.locator('.price-ticket').count()==3
        scenes.locator('#training-one').click(); advance(64)
        target = scenes.evaluate('Clicker.state.coins')
        shown = scenes.locator('#coins').inner_text()
        assert shown != '100.00\u842c' and shown != f'{target/10000:.2f}\u842c', (shown,target)
        shot('wallet-tween-spend')
        advance(240)
        assert scenes.locator('#coins').inner_text()==f'{target/10000:.2f}\u842c'
        scenes.locator('#recruit-open').click(); shot('recruit-topbar-round3')
        assert 'clicker-ui-paper.png' in scenes.locator('#recruit-topbar').evaluate('(e)=>getComputedStyle(e).borderImageSource')
        scenes.locator('#recruit-close').click()
        seed(7,cooldown=True); shot('skills-cooldown')
        seed(7); scenes.locator('#slots .skill-use').nth(2).click(); advance(1400)
        assert scenes.locator('#parasite-label svg, #parasite-label img').count()==1; shot('parasite-active')
        for state,progress in enumerate([0,30,55,80]):
            seed(1,progress); assert scenes.locator('#bag-image').get_attribute('src')==f'clicker-bag-{state}.png', (state, scenes.locator('#bag-image').get_attribute('src'), scenes.evaluate('({state:Clicker.state,now:Date.now(),time:performance.now()})'))
            shot('bag-'+str(state))
        seed(1,99); scenes.evaluate('document.getElementById("tap").click()'); advance(60)
        assert scenes.locator('#bag-image').get_attribute('src')=='clicker-bag-4.png', scenes.evaluate('({state:Clicker.state,now:Date.now(),events:fxEvents})'); shot('bag-4')
        advance(400)
        assert scenes.locator('#bag-image').get_attribute('src')=='clicker-bag-0.png'
        seed(1); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); advance(60)
        particles=scenes.evaluate('fxEvents'); assert len(particles)==8, scenes.evaluate('({events:fxEvents,state:Clicker.state,now:Date.now(),time:performance.now()})')
        assert sum(p.get('shape')=='shard' for p in particles)==6
        assert all(p['canvas']=='click-fx' for p in particles); advance(60); shot('click-normal')
        advance(5); scenes.evaluate('document.getElementById("tap").click()')
        advance(125); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); advance(60)
        assert scenes.evaluate('fxEvents.length')==13; shot('click-chain')
        seed(7,heavy=True); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); advance(60)
        assert scenes.evaluate('fxEvents.length')==20, scenes.evaluate('({events:fxEvents,state:Clicker.state,now:Date.now()})')
        assert scenes.evaluate('fxEvents.filter(p=>p.sprite===5).length')==1; advance(30); shot('click-heavy')
        # Multi-package completion and subsequent inputs retain the newest progress.
        advance(1100)
        scenes.evaluate('Clicker.state.clickLevel=100; fxEvents.length=0; document.getElementById("tap").click()')
        advance(60); shot('multi-package')
        advance(125); scenes.evaluate('document.getElementById("tap").click()'); advance(500)
        expected=scenes.evaluate('Math.min(3,Math.floor(Clicker.state.package.progress/ClickerEconomy.requirement(Clicker.state.package.index)*4))')
        assert scenes.locator('#bag-image').get_attribute('src')==f'clicker-bag-{expected}.png'
        assert bindings.count('fx') >= 5
        assert bindings[-1] == 'click-fx'
        scenes.close()

        # 相同 DOM 對照切分前後 CSS 的所有 computed style（含偽元素、減少動態）。
        demo = context.new_page(); demo.on('pageerror', lambda error: errors.append(str(error)))
        demo.goto('http://clicker.test/gacha.html')
        demo.wait_for_function('document.getElementById("fatal").hidden && document.getElementById("hint").textContent !== "素材載入中"')
        demo.evaluate('''async () => {
          const card=GachaCard.create({rarity:GachaPool.RARITY,byId:GachaPool.byId,canHover:()=>false,fatal:document.getElementById('fatal')});
          await card.ready;
          for(const rarity of GachaPool.RARITY_ORDER) {
            const entry=GachaPool.CATALOG.find(e=>e.rarity===rarity);
            const el=card.create(entry); el.classList.add('dealt','flipped'); document.getElementById('cards').append(el);
            const mini=document.createElement('div'); mini.className='mini locked';mini.append(card.create(entry)); document.getElementById('album-body').append(mini);
          }
        }''')
        def computed():
            return demo.evaluate('''() => [...document.querySelectorAll('#table, .card, .card *, .mini, .mini *')].map(el =>
              ['', '::before', '::after'].map(pseudo => {const s=getComputedStyle(el,pseudo||null);return Object.fromEntries([...s].filter(k=>!k.startsWith('--')).map(k=>[k,s.getPropertyValue(k)]));}))''')

        for reduced in ['no-preference', 'reduce']:
            demo.emulate_media(reduced_motion=reduced)
            demo.add_style_tag(content='*,*::before,*::after {animation:none!important;transition:none!important}')
            before_css = computed()
            demo.evaluate('''() => {document.querySelectorAll('link[rel=stylesheet]').forEach(el=>el.disabled=true);const link=document.createElement('link');link.rel='stylesheet';link.href='original-gacha.css';link.id='original-css';document.head.append(link);}''')
            demo.wait_for_function('document.getElementById("original-css").sheet !== null')
            demo.add_style_tag(content='*,*::before,*::after {animation:none!important;transition:none!important}')
            after_css = computed()
            differences = []
            for i, (a, b) in enumerate(zip(before_css, after_css)):
                for pseudo, (aa, bb) in enumerate(zip(a, b)):
                    for key in aa:
                        if aa[key] != bb[key]:
                            differences.append([i, pseudo, key, aa[key], bb[key]])
            assert not differences, json.dumps(differences[:20], ensure_ascii=False)
            demo.evaluate('document.getElementById("original-css").remove();document.querySelectorAll("link[rel=stylesheet]").forEach(el=>el.disabled=false)')
        assert not errors, errors
        browser.close()
    print('PASS: Round 4 storyboards x12, font, 10 buddies, slots empty/cooldown/ready, frozen particles/floaters, aggregate input, unskippable/recruit guard, reduced motion, hidden cleanup; Round 3 pointer/zoom, wallet tween +/- and format, meter wrap, paper shop/recruit, nine buddies;  真實點擊節流、教學、技能、12 角色、五模式、pending 恢復/雙擊、儲存失敗、隱藏恢復、卡面 CSS computed-style 等價；第二輪夥伴分頁、五狀態、寄生、8/12+1/18+2 粒子與多包最新進度。')


if __name__ == '__main__':
    main()
