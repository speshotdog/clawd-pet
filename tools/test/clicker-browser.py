"""可選的離線瀏覽器驗證：所有 HTTP 請求由 Playwright 讀本地檔回覆，不啟動 server。
執行：python tools/test/clicker-browser.py（需已安裝 Python Playwright 與 Chromium）。
"""
import json
from datetime import datetime, timezone
import mimetypes
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
OUT = ROOT / 'tools/test/clicker-artifacts'


def main():
    OUT.mkdir(exist_ok=True)
    errors = []
    original_css = subprocess.check_output(['git', 'show', 'HEAD:src/gacha-card.css'], cwd=ROOT) + subprocess.check_output(['git', 'show', 'HEAD:src/gacha.css'], cwd=ROOT)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--log-file='+str(OUT / 'chromium.log')])
        context = browser.new_context(viewport={'width': 960, 'height': 640}, device_scale_factor=1.25)
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
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://clicker.test/clicker.html')
        page.wait_for_function('window.Clicker && !document.getElementById("tap").disabled')
        page.locator('#receipt-close').click() if page.locator('#receipt').is_visible() else None
        assert page.evaluate('Clicker.state.coins') == 0
        assert page.locator('#hero > svg').count() == 1
        assert page.locator('#tap').bounding_box()['width'] == 240
        assert page.locator('#hero > svg').bounding_box()['height'] > 185
        assert page.evaluate('testSchedules.raf.size') == 1
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
        page.wait_for_timeout(350)
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
        page.wait_for_timeout(100)
        assert page.evaluate('[testSchedules.raf.size,testSchedules.timeout.size,testSchedules.interval.size]') == [0, 0, 0]
        page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false}); document.dispatchEvent(new Event("visibilitychange"));')
        assert page.locator('#collect').is_visible()
        page.locator('#collect').click()

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
              // A short settlement high-water mark keeps fixture progress stable while assets load.
              const delta=Date.now()+10000-fixture.settledAt; fixture.savedAt+=delta; fixture.settledAt+=delta;
              fixture.slotReadyAt=fixture.slotReadyAt.map(t=>t?t+delta:0);
              for(const id in fixture.cooldownUntil) fixture.cooldownUntil[id]+=delta;
              fixture.effects.forEach(e=>{e.startedAt+=delta;e.expiresAt+=delta;});
              localStorage.setItem('clicker_save',JSON.stringify(fixture));''')
            scenes.clock.install()
            scenes.goto('http://clicker.test/clicker.html')
            scenes.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
            scenes.wait_for_function('GachaFx.sheetReady()')
            scenes.clock.pause_at(datetime.fromtimestamp((scenes.evaluate('Date.now()') + 2000) / 1000, timezone.utc))


        def shot(name):
            if name.startswith('click-'):
                assert scenes.evaluate('''() => {
                  const data=document.getElementById('click-fx').getContext('2d').getImageData(0,0,960,640).data;
                  return data.some((v,i)=>i%4===3 && v>0);
                }'''), 'Particle canvas is empty: '+name
            scenes.screenshot(path=str(OUT / (name+'.png')))

        for count in [1,6,7,9]:
            seed(count); assert scenes.locator('.buddy').count()==min(count,6), (count, scenes.locator('.buddy').count(), scenes.evaluate('Clicker.state'), scenes.locator('#fatal').text_content())
            assert scenes.locator('#stage svg').count()==1
            shot('buddies-'+str(count))
            if count in [7,9]:
                scenes.locator('#buddy-next').click(); assert scenes.locator('.buddy').count()==count-6
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
                scenes.clock.run_for(60); shot('click-pointer-'+corner+'-'+str(zoom))
        seed(0,coins=0,level=50)
        scenes.locator('#tap').focus(); scenes.keyboard.press('Space'); scenes.clock.run_for(64)
        target = scenes.evaluate('Clicker.state.coins')
        assert target > 1000
        shown = float(scenes.locator('#coins').inner_text().replace(',',''))
        assert 0 < shown < target
        assert all(abs(v['x']-485)<=10 and abs(v['y']-240)<=4 for v in scenes.evaluate('fxEvents'))
        shot('wallet-tween-increase')
        scenes.clock.run_for(240)
        assert float(scenes.locator('#coins').inner_text().replace(',',''))==int(target)
        for coins, expected in [(9999,'9,999'),(12345,'1.23萬'),(120000000,'1.2億')]:
            seed(0,coins=coins)
            assert scenes.locator('#coins').inner_text()==expected
            assert scenes.locator('#coins').get_attribute('title')==f'{coins:,}'
        seed(0,99)
        scenes.locator('#tap').focus(); scenes.keyboard.press('Enter')
        values=[]
        for _ in range(25):
            scenes.clock.run_for(16)
            values.append(scenes.locator('#package-progress').evaluate('(e)=>e.value'))
        assert 1 in values and values[-1]==0, values
        seed(9); scenes.clock.run_for(200); shot('shop-round3')
        assert scenes.locator('.price-ticket').count()==3
        scenes.locator('#training-one').click(); scenes.clock.run_for(64)
        target = scenes.evaluate('Clicker.state.coins')
        shown = scenes.locator('#coins').inner_text()
        assert shown != '100.00\u842c' and shown != f'{target/10000:.2f}\u842c', (shown,target)
        shot('wallet-tween-spend')
        scenes.clock.run_for(240)
        assert scenes.locator('#coins').inner_text()==f'{target/10000:.2f}\u842c'
        scenes.locator('#recruit-open').click(); shot('recruit-topbar-round3')
        assert 'clicker-ui-paper.png' in scenes.locator('#recruit-topbar').evaluate('(e)=>getComputedStyle(e).borderImageSource')
        scenes.locator('#recruit-close').click()
        seed(7,cooldown=True); shot('skills-cooldown')
        seed(7); scenes.locator('#slots .skill-use').nth(2).click(); scenes.clock.run_for(170)
        assert scenes.locator('#parasite-label svg').count()==1; shot('parasite-active')
        for state,progress in enumerate([0,30,55,80]):
            seed(1,progress); assert scenes.locator('#bag-image').get_attribute('src')==f'clicker-bag-{state}.png', (state, scenes.locator('#bag-image').get_attribute('src'), scenes.evaluate('({state:Clicker.state,now:Date.now(),time:performance.now()})'))
            shot('bag-'+str(state))
        seed(1,99); scenes.evaluate('document.getElementById("tap").click()'); scenes.clock.run_for(60)
        assert scenes.locator('#bag-image').get_attribute('src')=='clicker-bag-4.png', scenes.evaluate('({state:Clicker.state,now:Date.now(),events:fxEvents})'); shot('bag-4')
        scenes.clock.run_for(400)
        assert scenes.locator('#bag-image').get_attribute('src')=='clicker-bag-0.png'
        seed(1); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); scenes.clock.run_for(60)
        particles=scenes.evaluate('fxEvents'); assert len(particles)==8, scenes.evaluate('({events:fxEvents,state:Clicker.state,now:Date.now(),time:performance.now()})')
        assert sum(p.get('shape')=='shard' for p in particles)==6
        assert all(p['canvas']=='click-fx' for p in particles); scenes.clock.run_for(60); shot('click-normal')
        scenes.clock.run_for(5); scenes.evaluate('document.getElementById("tap").click()')
        scenes.clock.run_for(125); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); scenes.clock.run_for(60)
        assert scenes.evaluate('fxEvents.length')==13; shot('click-chain')
        seed(7,heavy=True); scenes.evaluate('fxEvents.length=0;document.getElementById("tap").click()'); scenes.clock.run_for(60)
        assert scenes.evaluate('fxEvents.length')==20, scenes.evaluate('({events:fxEvents,state:Clicker.state,now:Date.now()})')
        assert scenes.evaluate('fxEvents.filter(p=>p.sprite===5).length')==1; scenes.clock.run_for(30); shot('click-heavy')
        # Multi-package completion and subsequent inputs retain the newest progress.
        scenes.clock.run_for(1100)
        scenes.evaluate('Clicker.state.clickLevel=100; fxEvents.length=0; document.getElementById("tap").click()')
        scenes.clock.run_for(60); shot('multi-package')
        scenes.clock.run_for(125); scenes.evaluate('document.getElementById("tap").click()'); scenes.clock.run_for(500)
        expected=scenes.evaluate('Math.min(3,Math.floor(Clicker.state.package.progress/ClickerEconomy.requirement(Clicker.state.package.index)*4))')
        assert scenes.locator('#bag-image').get_attribute('src')==f'clicker-bag-{expected}.png'
        assert page.evaluate('fxBindings.filter(id=>id==="fx").length') >= 5
        assert page.evaluate('fxBindings.at(-1)') == 'click-fx'
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
    print('PASS: Round 3 pointer/zoom, wallet tween +/- and format, meter wrap, paper shop/recruit, nine buddies;  真實點擊節流、教學、技能、12 角色、五模式、pending 恢復/雙擊、儲存失敗、隱藏恢復、卡面 CSS computed-style 等價；第二輪夥伴分頁、五狀態、寄生、8/12+1/18+2 粒子與多包最新進度。')


if __name__ == '__main__':
    main()
