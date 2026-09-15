# -*- coding: utf-8 -*-
"""突破圈數鎖、手動突破、兩種滿養與圈末文字；route fulfil，無伺服器。"""
import ast, mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]; SRC=ROOT/'src'
OUT=ROOT/'_art/out/v3-apoc-transcend'; OUT.mkdir(parents=True,exist_ok=True)
# 共用既有輪迴測試的 1.0 解鎖存檔，不執行它的測試流程。
tree=ast.parse((Path(__file__).with_name('clicker-v3-apoc-loop.py')).read_text(encoding='utf-8-sig'))
SEED=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SEED' for t in n.targets))
with sync_playwright() as p:
    browser=p.chromium.launch()
    for label,size in [('desktop',{'width':1280,'height':860}),('portrait',{'width':390,'height':844})]:
        ctx=browser.new_context(viewport=size,reduced_motion='reduce'); errors=[]
        def route(r):
            path=(SRC/unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if path.is_relative_to(SRC) and path.is_file():r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else:r.fulfill(status=404,body='missing')
        ctx.route('**/*',route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed');if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html');pg.wait_for_function('window.Clicker?.apocReady');pg.evaluate(SEED)
        pg.evaluate("""()=>{const s=JSON.parse(sessionStorage.getItem('test-seed')),id=ApocPool.find(c=>c.rarity==='rare').id;
          s.apoc={...s.apoc,collection:{[id]:1},dust:{[id]:30},transcend:{[id]:5},roster:[id],laps:0};
          sessionStorage.setItem('test-seed',JSON.stringify(s));}""")
        pg.reload();pg.wait_for_function('window.Clicker?.apocReady');pg.wait_for_timeout(1300)
        id=pg.evaluate('Clicker.state.apoc.roster[0]')
        def detail():
            pg.evaluate('(id)=>document.querySelector(`#buddies .buddy[data-id="${id}"]`).click()',id)
            pg.locator('#album-detail').wait_for(state='visible')
        detail();assert '第 2 圈解鎖' in pg.locator('#album-detail').inner_text()
        assert pg.locator('[data-apoc-transcend]').count()==0
        pg.screenshot(path=str(OUT/f'{label}-locked.png'))
        pg.keyboard.press('Escape');pg.wait_for_timeout(250)
        pg.evaluate('Clicker.state.apoc.laps=2');pg.wait_for_timeout(1200);detail()
        grow=pg.locator('[data-apoc-transcend]');assert grow.is_enabled()
        before=pg.evaluate('(id)=>ApocEconomy.availableDust(Clicker.state.apoc,id)',id)
        grow.click();pg.wait_for_timeout(350)
        assert pg.evaluate('(id)=>ApocEconomy.transcendOf(Clicker.state.apoc,id)',id)==6
        assert pg.evaluate('(id)=>ApocEconomy.availableDust(Clicker.state.apoc,id)',id)==before-8
        assert '第 4 圈解鎖' in pg.locator('#album-detail').inner_text()
        pg.screenshot(path=str(OUT/f'{label}-level6.png'));pg.keyboard.press('Escape')
        pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>/名冊/.test(b.textContent)).click()")
        pg.wait_for_timeout(350)
        assert '輪迴滿養 0/71' in pg.locator('#team-summary').inner_text()
        assert '滿養 1/71' in pg.locator('#team-summary').inner_text()
        pg.keyboard.press('Escape');pg.wait_for_timeout(250)
        pg.evaluate("""()=>{const a=Clicker.state.apoc;a.stage=null;a.progress=19;a.cleared=false;a.cooldownUntil=0;
          Clicker.state.apoc=ApocEconomy.fight(a,Date.now());const st=Clicker.state.apoc.stage;st.hp=1;st.minions.left=0;st.minions.nextAt=Date.now()+1e8;}""")
        pg.evaluate("()=>document.getElementById('tap').click()")
        pg.locator('#lap-done').wait_for(state='visible')
        assert pg.locator('#lap-done-transcend').inner_text()=='突破上限 → 第 6 級'
        pg.screenshot(path=str(OUT/f'{label}-chest.png'))
        pg.locator('#lap-done-next').click();pg.locator('#apoc-ending').wait_for(state='visible')
        assert pg.locator('#ending-lap-unlock').inner_text()==''
        pg.locator('#apoc-ending-close').click()
        pg.evaluate('Clicker.state.apoc.laps=1');pg.wait_for_timeout(1200)
        # Reopen the ending via the same finish event at lap 1; next lap is the unlock.
        pg.evaluate("""()=>{const a=Clicker.state.apoc;a.stage=null;a.progress=19;a.cleared=false;a.cooldownUntil=0;
          Clicker.state.apoc=ApocEconomy.fight(a,Date.now());const st=Clicker.state.apoc.stage;st.hp=1;st.minions.left=0;st.minions.nextAt=Date.now()+1e8;}""")
        pg.evaluate("()=>document.getElementById('tap').click()")
        pg.locator('#lap-done').wait_for(state='visible');assert pg.locator('#lap-done-transcend').inner_text()==''
        pg.locator('#lap-done-next').click();pg.locator('#apoc-ending').wait_for(state='visible')
        assert pg.locator('#ending-lap-unlock').inner_text()=='下一圈解鎖：突破第 6 級'
        pg.locator('#apoc-ending-close').click();pg.locator('#stats-open').click()
        assert pg.locator('.apoc-badge-cell').filter(has_text='輪迴滿養').count()==1
        assert not errors,errors
        print('ok',label,'圈數鎖、扣 8 粉塵、兩種滿養、圈末解鎖、下一圈提示、徽章；0 page errors')
        ctx.close()
    browser.close()
