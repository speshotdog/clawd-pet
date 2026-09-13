# -*- coding: utf-8 -*-
"""末世端到端：十連 → 進隊 → 打一般關 → 王關護盾破防 → 技能 → 全線通行。
（2026-09-13 之後這一輪重寫：舊版測的是 iframe 橋與 postMessage，那整套已經拿掉。）

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-apoc-play'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.apoc={unlocked:true,tutorial:6}; s.settings.world='apoc';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

MYTHIC_JS = """()=>{const a=Clicker.state.apoc,p=Object.fromEntries(ApocPool.map(c=>[c.id,c]));
  let id=Object.keys(a.collection).find(x=>p[x]&&p[x].rarity==='mythic');
  if(!id){id=ApocPool.find(c=>c.rarity==='mythic').id; a.collection[id]=1;}
  if(!a.roster.includes(id)) a.roster=[id,...a.roster].slice(0,20);
  a.skills=[id,null,null,null]; return id;}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("addEventListener('error',e=>{window.__stacks=(window.__stacks||[]);window.__stacks.push(e.error&&e.error.stack||e.message)});")
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)

    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['gifted'] and a['tickets'] == 10 and a['roster'] == ['pufayueyue'], '開門禮：普發玥玥入隊＋10 券')

    # 末世一進來是關卡地圖；點「進入戰鬥」才是 1.0 的戰鬥畫面
    check(pg.locator('#apoc-map').is_visible(), '末世的主畫面是關卡地圖')
    pg.evaluate("()=>{ApocEconomy.RULES.BASE_NEED=3000;}")   # 這支測接線不是數值；進入戰鬥當下就算血量，要先改
    pg.eval_on_selector('#map-enter', 'e=>e.click()'); pg.wait_for_timeout(800)
    check(pg.locator('#apoc-map').is_hidden(), '進入戰鬥 → 地圖收起')

    # 十連：演出是精裝典藏包（使用者指定），扣券與結果在主頁先寫進存檔
    pg.eval_on_selector('#draw-five', 'e=>e.click()'); pg.wait_for_timeout(600)
    check(pg.evaluate("()=>!!Clicker.state.apoc.pending"), '十連：pending 進了末世的存檔')
    check(not pg.evaluate("()=>!!Clicker.state.pending"), '沒有汙染 1.0 的 pending')
    check(pg.locator('#apoc-ceremony').is_visible(), '精裝典藏包打開')
    frame = next(f for f in pg.frames if f.url.endswith('apoc/ceremony.html'))
    frame.wait_for_function("()=>window.ApocCeremony && ApocCeremony.state().entryPhase==='waiting'", timeout=20000)
    saved = pg.evaluate("()=>Clicker.state.apoc.pending.draw.entries.map(e=>e.entry.id)")
    check(frame.evaluate("()=>ApocCeremony.state().ids") == saved, '演出的十張＝存檔裡的十張')
    frame.eval_on_selector('#entry-pack', 'e=>e.click()'); pg.wait_for_timeout(1500)
    frame.evaluate("()=>{const b=document.getElementById('revealall'); if(b&&!b.hidden) b.click();}")
    frame.wait_for_function("()=>ApocCeremony.state().collectable", timeout=30000)
    inside = frame.evaluate("()=>{const w=document.getElementById('win').getBoundingClientRect();"
                            "const s=[...document.querySelectorAll('#fan .slot')].map(e=>e.getBoundingClientRect());"
                            "return s.length===10 && s.every(r=>r.left>=w.left-1&&r.right<=w.right+1&&r.top>=w.top-1&&r.bottom<=w.bottom+1);}")
    check(inside, '十張卡都在典藏包的畫面裡')
    pg.screenshot(path=str(OUT / '1-ten.png'))
    frame.eval_on_selector('#finish', 'e=>e.click()'); pg.wait_for_timeout(1000)
    check(pg.locator('#apoc-ceremony').is_hidden(), '收下 → 典藏包關閉')
    if not pg.locator('#draw-summary').is_hidden():
        check(True, '收下之後出結算：' + ' / '.join(pg.locator('#draw-summary-body').inner_text().split('\n'))[:60])
        pg.screenshot(path=str(OUT / '2-summary.png'))
        pg.eval_on_selector('#draw-summary-ok', 'e=>e.click()'); pg.wait_for_timeout(900)
    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['tickets'] == 0 and len(a['roster']) >= 2, '十連：券扣光、新卡自動入隊 ' + str({'tickets': a['tickets'], 'roster': len(a['roster'])}))

    # 一般關
    pg.eval_on_selector('#boss-challenge', 'e=>e.click()'); pg.wait_for_timeout(500)
    check(pg.evaluate("()=>Clicker.state.apoc.stage.shield") is None, '一般關沒有護盾')
    for _ in range(80):
        pg.evaluate("()=>document.getElementById('tap').click()"); pg.wait_for_timeout(30)
        if pg.evaluate("()=>Clicker.state.apoc.progress") >= 1: break
    check(pg.evaluate("()=>Clicker.state.apoc.progress") >= 1, '打完第 1 站，進度 +1')

    # 王關：護盾＋節奏
    pg.evaluate("()=>{Clicker.state.apoc.progress=3;}"); pg.wait_for_timeout(1300)
    pg.eval_on_selector('#boss-challenge', 'e=>e.click()'); pg.wait_for_timeout(600)
    st = pg.evaluate("()=>Clicker.state.apoc.stage")
    check(bool(st and st['boss'] and st['deadline'] is None and st['shield']['need'] == 15), '王關：帶護盾、沒有時限')
    check('破盾' in pg.locator('#effect-label').inner_text(), '畫面寫著護盾怎麼破：' + pg.locator('#effect-label').inner_text())
    for _ in range(15):
        pg.evaluate("()=>document.getElementById('tap').click()"); pg.wait_for_timeout(35)
    pg.wait_for_timeout(500)
    check(pg.evaluate("()=>Clicker.state.apoc.stage.breakUntil") > 0, '點滿 15 下 → 破防')
    check('破防' in pg.locator('#effect-label').inner_text(), '破防提示：' + pg.locator('#effect-label').inner_text())
    pg.screenshot(path=str(OUT / '3-boss.png'))

    # 技能格
    mythic = pg.evaluate(MYTHIC_JS); pg.wait_for_timeout(1300)
    btn = pg.locator('#slots .skill-use').first
    check(not btn.is_disabled(), '技能格 1 可以按（%s）' % mythic)
    btn.click(); pg.wait_for_timeout(600)
    fx = pg.evaluate("()=>Clicker.state.apoc.fx")
    check(fx['clickLeft'] == 10 and fx['clickMul'] == 10, '神話技能：接下來 10 下 ×10 ' + str(fx))

    # 全線通行
    pg.evaluate("()=>{const s=Clicker.state.apoc; s.progress=19; s.stage=null;}"); pg.wait_for_timeout(1300)
    pg.eval_on_selector('#boss-challenge', 'e=>e.click()'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{Clicker.state.apoc.stage.hp=1;}")
    for _ in range(40):
        pg.evaluate("()=>document.getElementById('tap').click()"); pg.wait_for_timeout(40)
        if pg.evaluate("()=>Clicker.state.apoc.progress") >= 20: break
    pg.wait_for_timeout(900)
    check(pg.evaluate("()=>Clicker.state.apoc.cleared"), '打完第 20 站 → 全線通行')
    check(not pg.locator('#apoc-ending').is_hidden(), '出現結局畫面：' + pg.locator('#apoc-ending-text').inner_text())
    pg.screenshot(path=str(OUT / '4-ending.png'))
    pg.eval_on_selector('#apoc-ending-close', 'e=>e.click()'); pg.wait_for_timeout(500)
    check(pg.locator('#apoc-ending').is_hidden(), '按「留在末世」關掉，可以繼續玩')

    if errors: print('STACKS:', pg.evaluate('()=>window.__stacks||[]'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK')
sys.exit(1 if fails else 0)
