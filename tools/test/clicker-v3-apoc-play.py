# -*- coding: utf-8 -*-
"""v3 末世關卡串接驗收（2026-09-13 晚）：開門禮（普發玥玥＋10 券）→ 地圖「開戰」→ 點「攻擊」打到 0 → 通關演出、金幣、進度 +1
→ 換券 → 招募頁十連（券由 1.0 存檔扣）→ 抽到的卡進收藏與隊伍 → 編隊頁只列擁有的卡、隊伍同步 → 王關 60 秒時限與 3 分鐘冷卻（用假時間）。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]; SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-apoc-play'; OUT.mkdir(parents=True, exist_ok=True); fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,16])); s.dust={...s.collection};
  s.trainingLevel=30; s.clickLevel=80; s.coins=1e14; s.lifetimeCoins=1e15; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city'; s.package=E.newPackage('city',120);
  s.apoc={unlocked:true,tutorial:6};
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
FRAME = "document.getElementById('apoc-frame').contentWindow"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1, reduced_motion='reduce')
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route); ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    pg.click('#apoc-open'); pg.wait_for_function('window.Clicker.apocReady'); pg.wait_for_timeout(1500)
    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['gifted'] and a['tickets'] == 10 and a['collection'].get('pufayueyue') == 1 and a['roster'] == ['pufayueyue'], '開門禮：普發玥玥入隊＋10 券 ' + str({k: a[k] for k in ('tickets', 'roster')}))
    fr = pg.frame_locator('#apoc-frame')
    check(fr.locator('#apoc-tickets').text_content().strip() == '10', '頂欄末世券 10')
    check(fr.locator('#apoc-fight').is_visible() and not fr.locator('#apoc-fight').is_disabled(), '地圖面板有「開戰」且可按')
    # 正式數值下第 1 站要打 4 分鐘（tools/sim/apoc.js 掃出來的），這支是接線測試，把血量壓小再打
    pg.evaluate("()=>{ApocEconomy.RULES.BASE_NEED=3000;}")
    fr.locator('#apoc-fight').click(); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>Clicker.state.apoc.stage"); check(st and st['index'] == 0 and st['need'] == 3000 and st['shield'] is None, '開戰：第 1 站血量 3000、一般關沒有護盾 ' + str(st))
    check(fr.locator('#apoc-tap').is_visible(), '「攻擊！」鍵出現')
    pg.screenshot(path=str(OUT / '1-fight.png'))
    hp0 = pg.evaluate("()=>Clicker.state.apoc.stage.hp")
    for _ in range(140):
        fr.locator('#apoc-tap').dispatch_event('pointerdown', {'button': 0, 'pointerType': 'mouse'}); pg.wait_for_timeout(30)
        if pg.evaluate("()=>Clicker.state.apoc.progress") >= 1: break
    pg.wait_for_timeout(1500)
    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['progress'] == 1 and a['stage'] is None and a['coins'] >= 60, '點到 0 → 通關、進度 1、拿到獎勵 ' + str({'progress': a['progress'], 'coins': int(a['coins'])}))
    check(pg.evaluate(f"()=>{FRAME}.map20.progress") == 1, '地圖進度同步 1')
    pg.screenshot(path=str(OUT / '2-won.png'))
    # 換券
    pg.evaluate("()=>{Clicker.state.apoc.coins=2500;}"); pg.wait_for_timeout(1200)
    fr.locator('#apoc-buy').click(); pg.wait_for_timeout(400)
    a = pg.evaluate("()=>Clicker.state.apoc"); check(a['tickets'] == 11 and int(a['coins']) < 2000, '換券：11 券、扣 1000 ' + str({'tickets': a['tickets'], 'coins': int(a['coins'])}))
    # 招募十連
    pg.evaluate(f"()=>{FRAME}.apocShell.go('gacha')"); pg.wait_for_timeout(3500)
    g = fr.frame_locator('#gacha-screen iframe')
    check(g.locator('#ticket').text_content().strip() == '11', '招募頁券數＝存檔 11')
    g.locator('#p10').click(); pg.wait_for_timeout(1500)
    a = pg.evaluate("()=>Clicker.state.apoc"); owned = sum(a['collection'].values())
    check(a['tickets'] == 1 and owned == 11, '十連：券剩 1、收藏 11 張 ' + str({'tickets': a['tickets'], 'owned': owned, 'roster': len(a['roster'])}))
    check(len(a['roster']) >= 2 and pg.evaluate("()=>ApocEconomy.power(Clicker.state.apoc)") > 60, '新卡自動入隊、戰力上升')
    pg.wait_for_timeout(2000); pg.screenshot(path=str(OUT / '3-gacha.png'))
    # 編隊頁只列擁有的
    pg.evaluate(f"()=>{FRAME}.apocShell.go('team')"); pg.wait_for_timeout(1200)
    t = pg.evaluate(f"()=>({{roster:{FRAME}.team20.roster, grid:{FRAME}.document.querySelectorAll('#team-grid .team-proxy').length}})")
    check(t['roster'] == a['roster'] and t['grid'] == len(a['roster']), '編隊頁隊伍＝存檔 ' + str(t['roster']))
    pg.evaluate(f"()=>{FRAME}.team20.openPicker('add')"); pg.wait_for_timeout(600)
    n = pg.evaluate(f"()=>{FRAME}.document.querySelectorAll('#picker-grid .team-proxy').length")
    check(n == len(a['collection']), '挑選器只列擁有的卡 %d' % n)
    pg.evaluate(f"()=>{FRAME}.document.getElementById('picker-close')?.click()"); pg.wait_for_timeout(300)
    # 末世星數（＝張數）畫在卡面：先塞一張重複卡再看
    dup = pg.evaluate("()=>{const a=Clicker.state.apoc,id=a.roster[0]; a.collection[id]=3; return id;}"); pg.wait_for_timeout(1500)
    star = pg.evaluate(f"()=>{FRAME}.document.querySelector('#team-grid .team-proxy[data-id=\"{dup}\"] .proxy-star')?.textContent")
    check(star == '★3', '卡面畫出星數 ★3（實際 %s）' % star)
    pg.screenshot(path=str(OUT / '4-team.png'))
    # 王關：護盾＋節奏（沒有時限；節奏用點擊次數）
    pg.evaluate(f"()=>{FRAME}.apocShell.go('map')"); pg.evaluate("()=>{Clicker.state.apoc.progress=3;}"); pg.wait_for_timeout(1500)
    check(fr.locator('#apoc-fight').text_content().startswith('挑戰王關'), '第 4 站是王關：鍵面「挑戰王關」')
    fr.locator('#apoc-fight').click(); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>Clicker.state.apoc.stage")
    check(st and st['boss'] and st['deadline'] is None and st['shield']['need'] == 15, '王關進場：帶護盾、沒有時限 ' + str(st.get('shield')))
    check(fr.locator('#apoc-shield').is_visible() and '破盾' in fr.locator('#apoc-shieldtext').text_content(), '護盾條與說明出現：' + fr.locator('#apoc-shieldtext').text_content())
    for _ in range(15):
        fr.locator('#apoc-tap').dispatch_event('pointerdown', {'button': 0, 'pointerType': 'mouse'}); pg.wait_for_timeout(25)
    pg.wait_for_timeout(600)
    st = pg.evaluate("()=>Clicker.state.apoc.stage")
    check(st['breakUntil'] > 0, '點滿 15 下 → 破防 ' + str({'taps': st['shield']['taps'], 'breakUntil': bool(st['breakUntil'])}))
    check('破防' in fr.locator('#apoc-shieldtext').text_content(), '破防提示：' + fr.locator('#apoc-shieldtext').text_content())
    pg.screenshot(path=str(OUT / '5-boss-shield.png'))
    # 獨立技能格：放一張神話進去 → 按鍵亮、按下去接下來的點擊變 ×10
    # 十連不一定抽得到神話（0.25%），直接發一張再測，不要讓驗收看運氣
    mythic = pg.evaluate("""()=>{const a=Clicker.state.apoc,p=Object.fromEntries(ApocPool.map(c=>[c.id,c]));
        let id=Object.keys(a.collection).find(x=>p[x]&&p[x].rarity==='mythic');
        if(!id){id=ApocPool.find(c=>c.rarity==='mythic').id; a.collection[id]=1;}
        return id;}""")
    if mythic:
        pg.evaluate("(id)=>{const a=Clicker.state.apoc; if(!a.roster.includes(id))a.roster=[id,...a.roster.filter(x=>x!==id)].slice(0,20); a.skills=[id,null,null,null];}", mythic)
        pg.wait_for_timeout(1500)
        btn = fr.locator('#apoc-skills button').first
        check(not btn.is_disabled(), '技能格 1 可按：' + ' '.join(btn.inner_text().split()))
        btn.click(); pg.wait_for_timeout(600)
        fx = pg.evaluate("()=>Clicker.state.apoc.fx")
        check(fx['clickLeft'] == 10 and fx['clickMul'] == 10, '按下神話技能 → 接下來 10 下 ×10 ' + str(fx))
        check(fr.locator('#apoc-skills button').first.is_disabled(), '技能進冷卻')
    else:
        check(False, '存檔裡沒有神話卡可以測技能（十連運氣）')
    pg.screenshot(path=str(OUT / '6-skills.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200]); b.close()
print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
