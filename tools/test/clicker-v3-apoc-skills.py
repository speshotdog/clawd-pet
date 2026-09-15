# -*- coding: utf-8 -*-
"""六型實機驗收：route 本機 src，不開 server；真按技能鍵與攻擊鍵、讀浮字與存檔。"""
import importlib.util, json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]; SRC=ROOT/'src'; OUT=ROOT/'_art/out/apoc-skills'; OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('recommend',Path(__file__).with_name('clicker-v3-apoc-recommend.py')); helper=importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
fails=[]; measures=[]
def check(ok,label,data=None):
    print(('ok   ' if ok else 'FAIL ')+label+(f' {data}' if data is not None else ''))
    measures.append({'label':label,'passed':bool(ok),'data':data})
    if not ok:fails.append(label)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True);ctx=browser.new_context(viewport={'width':1280,'height':860})
    def route(r):
        path=(SRC/unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:r.fulfill(status=404,body='missing')
    ctx.route('**/*',route);ctx.add_init_script("const s=sessionStorage.getItem('test-seed');if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html');pg.wait_for_function('window.Clicker?.state');pg.evaluate(helper.SEED);pg.reload();pg.wait_for_function('window.Clicker?.state');pg.wait_for_timeout(1600)
    # 大血量讓 ×2／×6 的非封頂讀數可被觀察。第四格已解鎖。
    def fight(boss=False):
        pg.evaluate("""boss=>{const A=ApocEconomy,s=Clicker.state,ids=['rocketdog','foxmoney','gebugou','miepuxiong'];
          A.RULES.BASE_NEED=1e6;let a=A.normalize({...A.fresh(),unlocked:true,gifted:true,tutorial:6,collection:Object.fromEntries(ids.map(id=>[id,1])),roster:ids,skills:ids,progress:boss?15:0,coins:0,seenAt:Date.now()});
          s.apoc=A.fight(a,Date.now());document.querySelectorAll('#floaters .floater').forEach(e=>e.remove());} """,boss)
        pg.wait_for_timeout(400)
    def click_hit():
        return pg.evaluate("""()=>{document.getElementById('tap').click();const e=document.querySelector('#floaters .apoc-hit:last-child');return {hit:Clicker.state.apoc.lastHit,text:e?.textContent,damage:Number(e?.dataset.damage),gold:e?.classList.contains('apoc-coin-hit')};}""")
    def cast(slot):
        pg.locator(f'#slots .skill-use[data-slot="{slot}"]').click();pg.wait_for_timeout(1800)
    for boss in [False,True]:
        fight(boss);label='王關' if boss else '一般關'
        base=click_hit()['damage'];cast(1)
        coins_before=pg.evaluate('()=>Clicker.state.apoc.coins');coin=click_hit();coins_after=pg.evaluate('()=>Clicker.state.apoc.coins')
        check(coin['hit']['coins']>0 and coins_after>coins_before and '+ ' not in (coin['text'] or '') and '幣' in coin['text'] and coin['gold'],label+' coin 入帳與金色浮字',coin)
        check(pg.locator('#slots .coin-active').count()==1,label+' 金框')
        pg.screenshot(path=str(OUT/('coin-boss.png' if boss else 'coin-normal.png')))
        before=click_hit()['damage'];cast(2);after=click_hit()['damage'];check(abs(after/before-2)<.001,label+' breach 浮字 ×2',{'before':before,'after':after})
        check(pg.locator('#apoc-enemy.breaking').count()==1,label+' 裂痕層')
        pg.screenshot(path=str(OUT/('breach-boss.png' if boss else 'breach-normal.png')))
        # 先清破防與 coin，量同一敵人上 1 秒的被動傷害。
        pg.evaluate("()=>{const a=Clicker.state.apoc;a.stage.breakUntil=0;a.fx.coinUntil=0;}")
        hp0=pg.evaluate('()=>Clicker.state.apoc.stage.hp');pg.wait_for_timeout(1000);slow=hp0-pg.evaluate('()=>Clicker.state.apoc.stage.hp')
        cast(3);hp0=pg.evaluate('()=>Clicker.state.apoc.stage.hp');pg.wait_for_timeout(1000);fast=hp0-pg.evaluate('()=>Clicker.state.apoc.stage.hp')
        check(fast>slow*1.7,label+' idle 放置加速',{'baseline':slow,'frenzy':fast})
        check(pg.locator('#buddies.apoc-frenzy').count()==1 and pg.locator('#slots .idle-active').count()==1,label+' 夥伴衝刺與橘框')
        pg.evaluate("()=>{const a=Clicker.state.apoc;a.fx.idleUntil=0;a.stage.breakUntil=0;}")
        base=click_hit()['damage'];cast(0);hit=click_hit();target=6 if boss else 8
        check(abs(hit['damage']/base-target)<.001,label+f' open 浮字 ×{target}',{'base':base,'hit':hit})
        if boss:
            check('抵抗' in pg.locator('#slots .skill-use[data-slot="0"]').get_attribute('title'), '王關 tooltip 抵抗')
            pg.evaluate("()=>{const a=Clicker.state.apoc;a.teamLevel=250;a.clickLevel=250;}")
            cap=pg.evaluate('()=>Clicker.state.apoc.stage.need*.04');hit=click_hit();check(hit['damage']<=cap and hit['hit']['capped'] and '盾' in hit['text'],'王關浮字 ≤4% 且顯示盾',{'cap':cap,'hit':hit})
        pg.screenshot(path=str(OUT/('skills-boss.png' if boss else 'skills-normal.png')))
        if boss:
            pg.set_viewport_size({'width':390,'height':844});pg.wait_for_timeout(250)
            pg.screenshot(path=str(OUT/'skills-mobile.png'))
            badge=pg.evaluate("()=>{const e=document.querySelector('#slots .resisted .skill-use');const b=e?.getBoundingClientRect();return {content:e&&getComputedStyle(e,'::before').content,inside:b&&b.left>=0&&b.right<=innerWidth};}")
            check(badge['inside'] and '抵抗' in badge['content'],'手機抵抗標籤可見',badge)
    check(not errors,'無 pageerror',errors);browser.close()
(OUT/'browser-measurements.json').write_text(json.dumps(measures,ensure_ascii=False,indent=2),encoding='utf-8')
print('全部通過' if not fails else f'失敗 {len(fails)} 項');sys.exit(bool(fails))
