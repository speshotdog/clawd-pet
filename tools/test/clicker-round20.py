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
        passive=pg.locator('.floater.passive').evaluate("e=>({italic:getComputedStyle(e).fontStyle,size:getComputedStyle(e).fontSize,images:e.querySelectorAll('img').length,count:document.querySelectorAll('.floater.passive').length})")
        check(passive=={'italic':'italic','size':'18px','images':0,'count':1},f'被動浮字 1Hz、斜體 18px、無圖示 {passive}')
        pg.evaluate('Clicker.state.clickLevel=100')
        pg.locator('#tap').click()
        click=pg.locator('.floater:not(.passive)').last.evaluate("e=>({size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color,stroke:getComputedStyle(e.querySelector('b')).webkitTextStrokeWidth})")
        check(click=={'size':'42px','color':'rgb(239, 142, 142)','stroke':'2px'},f'ratio ≥200 點擊浮字 {click}')
        pg.screenshot(path=str(OUT/'r20-floaters.png'))
        pg.evaluate("""() => {
          const s=Clicker.state; s.collection={yueyue2:1}; s.skillSlots=[null,null,null]; s.cooldownUntil={}; s.slotReadyAt=[0,0,0]; s.effects=[]; s.clickLevel=0; s.partnerLevels={};
          s.marksClaimed=29980; s.peakRateStamp=3;
          window.stamps=0; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList?.contains('rate-stamp'))stamps++;}))).observe(document.getElementById('stage'),{childList:true});
        }""")
        check(pg.evaluate('ClickerEconomy.rates(Clicker.state).P')==9000,'關卡前 P=9 千')
        pg.wait_for_timeout(1100)
        pg.evaluate('Clicker.state.marksClaimed=39980')
        pg.wait_for_function('Clicker.state.peakRateStamp===4')
        check(pg.evaluate('stamps')==1 and pg.locator('.rate-stamp').inner_text()=='每秒破 1 萬！','P=1.2 萬，指數 4，章只出現一次')
        pg.wait_for_timeout(1100)
        check(pg.evaluate('stamps')==1,'下一秒不重複蓋章')
        pg.locator('#prestige-open').click(); pg.get_by_role('button',name='印記商店',exact=True).click()
        check(pg.locator('#prestige-body h3').all_text_contents()==['永久','祝福'],'印記商店分永久／祝福')
        for item,n in [('blessing',1),('dustTrade',1),('dustTrade',10),('drawTicket',1)]:
            before=pg.evaluate('({marks:Clicker.state.marks,dust:Clicker.state.universalDust,free:Clicker.state.freeDraws,blessing:Clicker.state.blessing})')
            pg.locator(f'[data-item="{item}"][data-quantity="{n}"]').click()
            after=pg.evaluate('({marks:Clicker.state.marks,dust:Clicker.state.universalDust,free:Clicker.state.freeDraws,blessing:Clicker.state.blessing})')
            cost=before['blessing']+1 if item=='blessing' else n*(2 if item=='drawTicket' else 1)
            check(after['marks']==before['marks']-cost and (after['blessing']==before['blessing']+1 if item=='blessing' else after['dust']==before['dust']+5*n if item=='dustTrade' else after['free']==before['free']+5*n),f'{item} ×{n} 按鈕入帳')
        pg.locator('[data-item="drawTicket"]').scroll_into_view_if_needed()
        check(pg.locator('[data-item="drawTicket"]').evaluate("e=>{const r=e.getBoundingClientRect(),p=document.getElementById('prestige-body').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom}") ,'祝福商品捲動後完整留在面板內')
        pg.screenshot(path=str(OUT/'r20-mark-shop.png'))
        pg.keyboard.press('Escape')
        pg.evaluate("document.getElementById('floaters').replaceChildren(); testStage.freeze(true); testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})")
        check(pg.locator('.floater').count()==0,'凍結時不生成浮字')
        pg.evaluate('testStage.freeze(false); testStage.stop(); testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})')
        check(pg.locator('.floater').count()==0,'停止／隱藏舞台不生成浮字')
        pg.evaluate('testStage.start()'); pg.emulate_media(reduced_motion='reduce')
        pg.evaluate('testStage.floatPassive(100); testStage.float(1e9,true,{x:485,y:240})')
        check(pg.locator('.floater').count()==0,'減少動態時不生成浮字')
        check(not errors,f'無 JS 錯誤 {errors}')
        (OUT/'r20-geometry.json').write_text(json.dumps({'full':full,'compact':compact},ensure_ascii=False,indent=2),encoding='utf-8')
        b.close()
    print('RESULT:', 'ALL PASS' if not fails else fails)
    return int(bool(fails))

if __name__=='__main__': sys.exit(main())
