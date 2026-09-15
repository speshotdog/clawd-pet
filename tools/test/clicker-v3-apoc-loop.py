# -*- coding: utf-8 -*-
"""輪迴 UI 端到端：本機 route fulfil，桌機／直式；不啟動伺服器。"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]; SRC=ROOT/'src'; OUT=ROOT/'_art/out/v3-apoc-loop'; OUT.mkdir(parents=True,exist_ok=True)
SEED="""() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance,s=S.fresh(Date.now());
 s.collection=Object.fromEntries(Object.keys(B.characters).map(i=>[i,4]));s.dust={...s.collection};s.coins=1e12;s.lifetimeCoins=1e13;s.manualClicks=50;s.claimedMilestones=['tutorial50'];
 s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];s.settings.scene='city';s.settings.world='apoc';s.package=E.newPackage('city',120);s.marksClaimed=50;s.marks=0;s.prestiges=10;s.markShop={slot4:true};s.skillSlots=[null,null,null,null];s.slotReadyAt=[0,0,0,0];
 s.apoc={unlocked:true,tutorial:6,progress:19,coins:1e6};S.validate(s,GachaPool);sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
def click(pg, selector):
    pg.locator(selector).click(); pg.wait_for_timeout(150)
def finish_boss(pg):
    pg.evaluate("""()=>{ const a=Clicker.state.apoc;a.stage=null;a.progress=19;a.bossFailed=null;a.cooldownUntil=0;a.revisitAt=null;
      Clicker.state.apoc=ApocEconomy.fight(a,Date.now());const st=Clicker.state.apoc.stage;st.hp=1;st.minions.left=0;st.minions.nextAt=Date.now()+1e8;}""")
    pg.evaluate("()=>document.getElementById('tap').click()")
    pg.wait_for_function('Clicker.state.apoc.cleared')
def bounds(pg, selector):
    assert pg.locator(selector).evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}'), selector+' outside viewport'
with sync_playwright() as p:
    browser=p.chromium.launch()
    for label,size in [('desktop',{'width':1280,'height':860}),('portrait',{'width':390,'height':844})]:
        ctx=browser.new_context(viewport=size,reduced_motion='reduce' if label=='portrait' else 'no-preference'); errors=[]
        def route(r):
            path=(SRC/unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if path.is_relative_to(SRC) and path.is_file(): r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else:r.fulfill(status=404,body='missing')
        ctx.route('**/*',route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed');if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html');pg.wait_for_function('window.Clicker?.apocReady');pg.evaluate(SEED);pg.reload();pg.wait_for_function('window.Clicker?.apocReady');pg.wait_for_timeout(1300)
        finish_boss(pg);pg.locator('#apoc-ending').wait_for(state='visible');pg.wait_for_timeout(350);assert pg.locator('#apoc-ending .ending-card').count()==3
        bounds(pg,'#apoc-ending');pg.screenshot(animations='disabled',path=str(OUT/f'{label}-ending.png'))
        click(pg,'#apoc-replay');pg.locator('#mutation-draw').wait_for(state='visible');pg.wait_for_timeout(550)
        assert pg.evaluate('Clicker.state.apoc.laps')==1
        assert pg.locator('.mutation-card.revealed').count()==1
        assert pg.evaluate('Clicker.state.apoc.stage') is None
        bounds(pg,'#mutation-draw');pg.screenshot(animations='disabled',path=str(OUT/f'{label}-draw.png'))
        click(pg,'#mutation-team' if label=='desktop' else '#mutation-close');
        if label=='desktop':
            pg.locator('#team-editor').wait_for(state='visible');click(pg,'#team-close')
        pg.locator('#apoc-map').wait_for(state='visible')
        assert pg.locator('#apoc-lap-line .mut-chip').count()==1
        assert pg.locator('#map-mut-chips .mut-chip').count()==1
        assert pg.locator('.map-station.boss .map-mut-icons').count()==5
        # Reroll uses the actual two-click control and persisted purse.
        pg.evaluate('Clicker.state.apoc.purse=200000');pg.wait_for_timeout(1200)
        before=pg.evaluate('Clicker.state.apoc.purse');click(pg,'#map-reroll');assert pg.evaluate('Clicker.state.apoc.purse')==before
        click(pg,'#map-reroll');assert pg.evaluate('Clicker.state.apoc.purse')==before-80000
        pg.screenshot(animations='disabled',path=str(OUT/f'{label}-map.png'))
        click(pg,'#map-mut-chips .mut-chip');assert pg.locator('#map-mut-chips .mut-tip').is_visible()
        click(pg,'.map-station[data-index="3"]');assert '這一圈：' in pg.locator('#map-mutation-desc').inner_text();pg.screenshot(animations='disabled',path=str(OUT/f'{label}-boss.png'))
        click(pg,'.map-station[data-index="0"]')
        click(pg,'#map-enter');pg.wait_for_timeout(1200)
        # Three real deadline failures, keeping combat clocks short for the UI test.
        for fail in range(1,4):
            pg.evaluate("""()=>{const a=Clicker.state.apoc;a.stage=null;a.revisitAt=null;a.progress=3;a.cooldownUntil=0;
              Clicker.state.apoc=ApocEconomy.fight(a,Date.now()-1000);Clicker.state.apoc.stage.deadline=Date.now()-1;}""")
            pg.wait_for_function(f'Clicker.state.apoc.bossStreak.fails==={fail}')
        pg.locator('#mutation-swap').wait_for(state='visible');pg.screenshot(animations='disabled',path=str(OUT/f'{label}-fail.png'))
        old=pg.evaluate('Clicker.state.apoc.mutations.slice()');click(pg,'#mutation-swap');click(pg,'#mutation-rescue-options button')
        assert pg.evaluate('Clicker.state.apoc.rerolled')
        assert pg.evaluate('Clicker.state.apoc.mutations')!=old
        # Finish lap via the live hit -> settle -> completion event path.
        finish_boss(pg);pg.locator('#lap-done').wait_for(state='visible');pg.wait_for_timeout(450)
        log=pg.evaluate('Clicker.state.apoc.lapLog.at(-1)');assert log['lap']==1 and log['bossFails']==3
        assert pg.locator('#lap-done-dust').inner_text()==str(log['dust'])
        assert pg.locator('#apoc-ending').is_hidden()
        bounds(pg,'#lap-done');pg.screenshot(animations='disabled',path=str(OUT/f'{label}-chest.png'))
        click(pg,'#lap-done-next');pg.locator('#apoc-ending').wait_for(state='visible');click(pg,'#apoc-ending-close')
        click(pg,'#stats-open');assert pg.locator('#apoc-lap-history tr').count()==3
        assert '無盡最遠 第' in pg.locator('#apoc-lap-history').inner_text()
        pg.screenshot(animations='disabled',path=str(OUT/f'{label}-history.png'))
        assert not errors,errors
        print('ok',label,'全破 → 三卡 → 第 1 圈翻牌 → 頂列與地圖 → 重抽 → 連敗 3 次換變異 → 寶箱 → 紀錄；0 page errors')
        ctx.close()
    browser.close()


