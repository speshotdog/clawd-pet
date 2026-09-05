"""可選的離線瀏覽器驗證：所有 HTTP 請求由 Playwright 讀本地檔回覆，不啟動 server。
執行：python tools/test/clicker-browser.py（需已安裝 Python Playwright 與 Chromium）。
"""
import json
import os
from datetime import datetime, timezone
import mimetypes
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
        rows.push([...document.querySelectorAll('[data-layer="grass"] img')].map(e=>parseFloat(e.style.transform.slice(7))));
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


def main():
    OUT.mkdir(exist_ok=True)
    os.chdir(OUT)  # Chromium audio may emit debug.log; keep all generated files here.
    errors = []
    original_css = subprocess.check_output(['git', 'show', 'HEAD:src/gacha-card.css'], cwd=ROOT) + subprocess.check_output(['git', 'show', 'HEAD:src/gacha.css'], cwd=ROOT)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required', '--log-file='+str(OUT / 'chromium.log')])
        context = browser.new_context(viewport={'width': 960, 'height': 640}, device_scale_factor=1.25)
        context.add_init_script('''const animate = Element.prototype.animate; Element.prototype.animate = function(...args) {const a=animate.apply(this,args);a.testBorn=performance.now();return a;};''')
        context.add_init_script('''const seed = sessionStorage.getItem('test-seed'); if(seed) {localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}''')
        context.add_init_script('''(() => {
          window.testSchedules={raf:new Set(),timeout:new Set(),interval:new Set()};
          const raf=requestAnimationFrame.bind(window), cancel=cancelAnimationFrame.bind(window);
          window.requestAnimationFrame=fn=>{const id=raf(t=>{testSchedules.raf.delete(id);fn(t)});testSchedules.raf.add(id);return id};
          window.cancelAnimationFrame=id=>{testSchedules.raf.delete(id);cancel(id)};
          const timeout=setTimeout.bind(window), clear=clearTimeout.bind(window), interval=setInterval.bind(window), clearI=clearInterval.bind(window);
          window.setTimeout=(fn,ms,...args)=>{const id=timeout(()=>{testSchedules.timeout.delete(id);fn(...args)},ms);testSchedules.timeout.add(id);return id};
          window.clearTimeout=id=>{testSchedules.timeout.delete(id);clear(id)};
          window.setInterval=(fn,ms,...args)=>{const id=interval(fn,ms,...args);testSchedules.interval.add(id);return id};
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
        assert page.evaluate('Clicker.state.effects[0].target') == 'zhenzhen'
        page.wait_for_timeout(1400)
        assert page.locator('#parasite-label svg').count() == 1
        assert page.locator('#stage .partner, #parasite-host').count() == 0
        page.screenshot(path=str(OUT / 'parasite.png'))
        page.locator('#roster-open').click(); assert page.locator('.roster-character').count() == 12
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
                page.wait_for_selector('#join-flight svg')
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
        assert page.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0, 0, 0]
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false}); document.dispatchEvent(new Event("visibilitychange"));')
        assert page.evaluate('Clicker.state.settledAt') > held

        page.locator('#recruit-open').click(); page.locator('#mode-select').select_option('wish'); page.locator('#recruit-five').click()
        page.wait_for_timeout(900)
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true}); document.dispatchEvent(new Event("visibilitychange"));')
        page.wait_for_timeout(500)
        assert page.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0, 0, 0]
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
                assert scenes.locator('#parasite-label svg').count() == 1
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
        for coins, expected in [(9999,'9,999'),(12345,'1.23萬'),(120000000,'1.2億')]:
            seed(0,coins=coins)
            assert scenes.locator('#coins').inner_text()==expected
            assert scenes.locator('#coins').get_attribute('title')==f'{coins:,}'
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
        assert scenes.locator('#parasite-label svg').count()==1; shot('parasite-active')
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
