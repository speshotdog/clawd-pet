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
    fr.locator('#apoc-fight').click(); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>Clicker.state.apoc.stage"); check(st and st['index'] == 0 and st['need'] == 3000, '開戰：第 1 站血量 3000 ' + str(st))
    check(fr.locator('#apoc-tap').is_visible(), '「攻擊！」鍵出現')
    pg.screenshot(path=str(OUT / '1-fight.png'))
    hp0 = pg.evaluate("()=>Clicker.state.apoc.stage.hp")
    for _ in range(140):
        fr.locator('#apoc-tap').dispatch_event('pointerdown', {'button': 0, 'pointerType': 'mouse'}); pg.wait_for_timeout(30)
        if pg.evaluate("()=>Clicker.state.apoc.progress") >= 1: break
    pg.wait_for_timeout(1500)
    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['progress'] == 1 and a['stage'] is None and a['coins'] >= 300, '點到 0 → 通關、進度 1、金幣 ≥300 ' + str({'progress': a['progress'], 'coins': int(a['coins'])}))
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
    pg.screenshot(path=str(OUT / '4-team.png'))
    # 王關：進度跳到 3，開戰後把 deadline 拉到過去 → 失敗、冷卻
    pg.evaluate(f"()=>{FRAME}.apocShell.go('map')"); pg.evaluate("()=>{Clicker.state.apoc.progress=3;}"); pg.wait_for_timeout(1500)
    check(fr.locator('#apoc-fight').text_content().startswith('挑戰王關'), '第 4 站是王關：鍵面「挑戰王關（60 秒）」')
    fr.locator('#apoc-fight').click(); pg.wait_for_timeout(400)
    pg.evaluate("()=>{Clicker.state.apoc.stage.deadline=Date.now()-1; Clicker.state.apoc.stage.hp=1e9;}"); pg.wait_for_timeout(1800)
    a = pg.evaluate("()=>Clicker.state.apoc")
    check(a['stage'] is None and a['cooldownUntil'] > 0 and a['progress'] == 3, '王關逾時 → 失敗、冷卻 3 分鐘、進度不動')
    check(fr.locator('#apoc-fight').is_disabled() and '冷卻' in fr.locator('#apoc-timer').text_content(), '冷卻中不能再打：' + fr.locator('#apoc-timer').text_content())
    pg.screenshot(path=str(OUT / '5-boss-cooldown.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200]); b.close()
print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
