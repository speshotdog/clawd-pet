# -*- coding: utf-8 -*-
"""第二十輪：route src 驗收，不 build、不啟動 server。"""
import json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width':1280,'height':860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file():
                r.fulfill(status=404,body='missing'); return
            body = path.read_bytes()
            if path.name == 'clicker-stage.js':
                body += b'\nconst createStage=ClickerStage.create; ClickerStage.create=(opts)=>(window.testStage=createStage(opts));'
            r.fulfill(body=body,content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*',route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg=ctx.new_page(); errors=[]
        pg.on('pageerror',lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html')
        pg.wait_for_function('window.Clicker?.state && window.testStage')
        pg.evaluate("""() => {
          const s=ClickerSave.fresh(Date.now()); s.collection={zhenmu:1,yueyue2:1,lk:1};
          s.skillSlots=['zhenmu','yueyue2','lk']; s.lifetimeCoins=s.coins=1e6;
          s.marks=s.marksClaimed=50; s.peakRateStamp=3;
          ClickerSave.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
        }""")
        pg.reload(); pg.wait_for_function('window.testStage?.running && !document.getElementById("tap").disabled')
        pg.evaluate('document.fonts.ready')
        # Activate through the real skill button, including the existing cut-in.
        pg.locator('.skill-use').first.click()
        pg.mouse.move(0,0)
        pg.wait_for_function('!testStage.frozen && !document.getElementById("parasite-label").hidden && !document.getElementById("parasite-label").classList.contains("compact")')
        pg.wait_for_timeout(400)
        def geometry():
            return pg.evaluate("""() => {
              const rect=e=>e.getBoundingClientRect().toJSON(), label=rect(document.getElementById('parasite-label'));
              const others=[...document.querySelectorAll('.skill-slot,.skill-name,.skill-slot small,#chain-tape')].map(rect);
              const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
              const chain=rect(document.getElementById('chain-tape'));
              return {label,hero:rect(document.getElementById('hero-position')),others,clear:others.every(r=>!hit(label,r)),chainClear:[...document.querySelectorAll('.skill-name')].every(e=>!hit(chain,rect(e)))};
            }""")
        full=geometry(); check(full['clear'] and full['chainClear'],'寄生全名不與槽位、名字、冷卻、連鎖相交')
        pg.screenshot(path=str(OUT/'r20-parasite-full.png'))
        pg.wait_for_function('document.getElementById("parasite-label").classList.contains("compact")')
        pg.wait_for_timeout(250)
        compact=geometry(); check(compact['clear'],'寄生 compact 不與四種矩形相交')
        pg.screenshot(path=str(OUT/'r20-parasite-compact.png'))
        pg.locator('.skill-use').nth(1).click()
        pg.wait_for_function('!testStage.frozen')
        pg.locator('.skill-use').nth(2).click()
        pg.mouse.move(0,0)
        pg.wait_for_function('!testStage.frozen && Clicker.state.chain.count===3')
        check(geometry()['chainClear'] and geometry()['clear'],'三連鎖標籤不遮技能名字或寄生')
        pg.evaluate("Clicker.state.effects=[]; document.getElementById('floaters').replaceChildren()")
        pg.wait_for_selector('.floater.passive',timeout=1500)
        # 基準重寫：第二十一輪（d2609db）把被動浮字從斜體改成琥珀色粗體「一疊」，斜體那條已經不成立
        passive=pg.locator('.floater.passive').evaluate("e=>({weight:getComputedStyle(e).fontWeight,size:getComputedStyle(e).fontSize,images:e.querySelectorAll('img').length,count:document.querySelectorAll('.floater.passive').length})")
        check(passive=={'weight':'700','size':'18px','images':0,'count':1},f'被動浮字 1Hz、粗體 18px、無圖示、只有一疊 {passive}')
        pg.evaluate('Clicker.state.clickLevel=100')
        pg.locator('#tap').click()
        click=pg.locator('.floater:not(.passive)').last.evaluate("e=>({size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color,stroke:getComputedStyle(e.querySelector('b')).webkitTextStrokeWidth})")
        check(click=={'size':'42px','color':'rgb(239, 142, 142)','stroke':'2px'},f'ratio ≥200 點擊浮字 {click}')
        pg.screenshot(path=str(OUT/'r20-floaters.png'))
        pg.evaluate("""() => {
          const s=Clicker.state; s.collection={yueyue2:1}; s.skillSlots=[null,null,null]; s.cooldownUntil={}; s.slotReadyAt=[0,0,0]; s.effects=[]; s.clickLevel=0; s.partnerLevels={};
          // 基準重寫：v3 的印記改走神器／祝福，`marksClaimed` 只是帳面總額、不再推 P；
          // 改用「全隊訓練等級」當推 P 的旋鈕，二分找出 P 剛好低於 1 萬的等級。
          s.roster=['yueyue2'];
          s.trainingLevel=(()=>{let lo=0,hi=400;for(let i=0;i<40;i++){const mid=Math.round((lo+hi)/2);
            if(ClickerEconomy.rates({...s,trainingLevel:mid}).P<1e4)lo=mid;else hi=mid;
            if(hi-lo<=1)break;}
            return lo;})();
          s.peakRateStamp=3;
          window.stamps=0; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList?.contains('rate-stamp'))stamps++;}))).observe(document.getElementById('stage'),{childList:true});
        }""")
        p0=pg.evaluate('ClickerEconomy.rates(Clicker.state).P')
        check(8000<=p0<10000,f'關卡前 P 在 1 萬以下 {round(p0)}')
        pg.wait_for_timeout(1100)
        pg.evaluate('''()=>{const s=Clicker.state;let n=s.trainingLevel;
          while(ClickerEconomy.rates({...s,trainingLevel:n}).P<1.2e4 && n<2000)n++;
          s.trainingLevel=n;}''')
        pg.wait_for_function('Clicker.state.peakRateStamp===4')
        check(pg.evaluate('stamps')==1 and pg.locator('.rate-stamp').inner_text()=='每秒破 1 萬！','P=1.2 萬，指數 4，章只出現一次')
        pg.wait_for_timeout(1100)
        check(pg.evaluate('stamps')==1,'下一秒不重複蓋章')
        # 商店測試要買得起：印記直接給足（marksClaimed 要蓋得住 marks，不然 validate 會擋、commit 失敗）
        pg.evaluate('()=>{Clicker.state.marks=100000; Clicker.state.marksClaimed=Math.max(Clicker.state.marksClaimed,200000);}')
        pg.eval_on_selector('#prestige-open','el=>el.click()'); pg.get_by_role('button',name='神器與商店',exact=True).click()   # v3 分頁改名（原「印記商店」）
        # 基準重寫：v3 D 路把商店改成「神器／永久／兌換」三段，祝福變成神器的一條線，
        # 招募券下架（DESIGN-balance-v3 §D）——原本的 blessing／drawTicket 商品已經不存在
        heads=pg.locator('#prestige-body h3').all_text_contents()
        check([h for h in heads if h in ('神器（每級價＝下一級的等級）','永久','兌換')]==['神器（每級價＝下一級的等級）','永久','兌換'],f'商店分神器／永久／兌換 {heads}')
        check(pg.locator('[data-item="drawTicket"]').count()==0,'招募券已下架')
        # 祝福：神器線，第 r 級收 r 枚
        before=pg.evaluate('({marks:Clicker.state.marks,blessing:Clicker.state.blessing})')
        pg.eval_on_selector('[data-item="blessing"]','el=>el.click()'); pg.wait_for_timeout(250)
        after=pg.evaluate('({marks:Clicker.state.marks,blessing:Clicker.state.blessing})')
        check(after['blessing']==before['blessing']+1 and after['marks']==before['marks']-(before['blessing']+1),f'祝福 +1、扣 {before["blessing"]+1} 印記 {before}→{after}')
        # 兌換：萬用粉塵 ×1／×10
        for n in (1,10):
            before=pg.evaluate('({marks:Clicker.state.marks,dust:Clicker.state.universalDust})')
            cost=pg.evaluate(f'ClickerPrestige.dustTradeCost(Clicker.state,{n})')
            per=pg.evaluate('ClickerPrestige.DUST_PER_TRADE')
            pg.eval_on_selector(f'[data-item="dustTrade"][data-quantity="{n}"]','el=>el.click()'); pg.wait_for_timeout(250)
            after=pg.evaluate('({marks:Clicker.state.marks,dust:Clicker.state.universalDust})')
            check(after['dust']==before['dust']+per*n and after['marks']==before['marks']-cost,f'萬用粉塵 ×{n} 入帳（扣 {cost} 印記、+{per*n} 粉塵）')
        pg.locator('[data-item="dustTrade"][data-quantity="10"]').scroll_into_view_if_needed()
        check(pg.locator('[data-item="dustTrade"][data-quantity="10"]').evaluate("e=>{const r=e.getBoundingClientRect(),p=document.getElementById('prestige-body').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom}") ,'兌換商品捲動後完整留在面板內')
        pg.screenshot(path=str(OUT/'r20-mark-shop.png'))
        pg.keyboard.press('Escape')
        pg.evaluate("document.getElementById('floaters').replaceChildren(); testStage.freeze(true); testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})")
        check(pg.locator('.floater').count()==0,'凍結時不生成浮字')
        pg.evaluate('testStage.freeze(false); testStage.stop(); testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})')
        check(pg.locator('.floater').count()==0,'停止／隱藏舞台不生成浮字')
        # 基準重寫：2026-09-08 使用者回報「部分玩家看不到被動傷害」→ 減少動態時**照樣出數字**，
        # 只是原地淡入淡出不飄（clicker-stage.js floatPassive 的註解）。原本「不生成浮字」已經反了。
        pg.evaluate('testStage.start()'); pg.emulate_media(reduced_motion='reduce')
        pg.evaluate("document.getElementById('floaters').replaceChildren()")
        pg.evaluate('testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})')
        check(pg.locator('.floater').count()>0,f'減少動態時仍看得到數字（{pg.locator(".floater").count()} 個）')
        check(not errors,f'無 JS 錯誤 {errors}')
        (OUT/'r20-geometry.json').write_text(json.dumps({'full':full,'compact':compact},ensure_ascii=False,indent=2),encoding='utf-8')
        b.close()
    print('RESULT:', 'ALL PASS' if not fails else fails)
    return int(bool(fails))

if __name__=='__main__': sys.exit(main())
