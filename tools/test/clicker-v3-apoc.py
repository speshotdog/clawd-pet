# -*- coding: utf-8 -*-
"""末世（2.0）驗收——**改用 1.0 介面之後的版本**（2026-09-13 之後這一輪重寫）。

舊版測的是 iframe 殼（`#apoc-open`、`#apoc-frame`、新手引導），那整套已經拿掉了。
現在測的是使用者要的那個形狀：兩個主系統從「場景」切換、末世用 1.0 的同一組節點、
卡片是末世卡、按鈕與文字不會被裁。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-apoc'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.apoc={unlocked:true,tutorial:6};
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled'); pg.wait_for_timeout(1200)

    # ---- 從「場景」切過去（使用者：末世地圖的選項放在場景裡面）
    check(pg.evaluate("()=>Clicker.state.settings.world") == 'home', '一開始在 1.0 桌邊')
    check(pg.locator('#apoc-open').count() == 0, '底欄沒有「末世地圖」鍵了（統一從場景切）')
    pg.eval_on_selector('#scene-open', 'e=>e.click()'); pg.wait_for_timeout(600)
    check(pg.locator('.scene-ticket[data-scene="apoc"]').count() == 1, '場景面板有「末世」這張票')
    pg.eval_on_selector('.scene-ticket[data-scene="apoc"]', 'e=>e.click()'); pg.wait_for_timeout(1400)
    check(pg.evaluate("()=>Clicker.state.settings.world") == 'apoc', '選了末世 → 當前主系統是末世')
    check(pg.evaluate("()=>document.body.dataset.world") == 'apoc', 'body 掛上 data-world=apoc（色票換掉）')
    check(pg.evaluate("()=>document.getElementById('scenes').hidden"), '切換後場景面板自己關掉')
    pg.screenshot(path=str(OUT / '1-apoc-stage.png'))

    # ---- 用的是 1.0 的節點（沒有 iframe）
    check(pg.locator('iframe').count() == 0, '沒有 iframe 了')
    check(pg.locator('#apoc-enemy').is_visible(), '舞台上有怪')
    check(not pg.locator('#boss-challenge').is_hidden(), '有「開戰」鍵')
    check(pg.locator('#bag').is_hidden() or not pg.locator('#bag').is_visible(), '1.0 的零食包收起來了')

    # ---- 卡片是末世卡
    pg.evaluate("()=>{const A=ApocEconomy,s=Clicker.state; s.apoc=A.gift(A.normalize(s.apoc)); s.apoc=A.drawn({...s.apoc,tickets:30}, ApocPool.slice(0,12).map(c=>c.id)); s.apoc.skills=[s.apoc.roster[0],s.apoc.roster[1],null,null];}")
    pg.wait_for_timeout(1400)
    srcs = pg.evaluate("()=>[...document.querySelectorAll('#buddies .buddy img, #slots .skill-use img')].map(i=>i.getAttribute('src'))")
    check(srcs and all('apoc/cards/' in (s or '') for s in srcs), f'夥伴列與技能格用的是末世卡圖（{len(srcs)} 張）')
    check(pg.locator('#slots .skill-use img').count() == 2, '技能格有角色縮圖（舊版沒有）')

    # ---- 打一場
    pg.eval_on_selector('#boss-challenge', 'e=>e.click()'); pg.wait_for_timeout(700)
    st = pg.evaluate("()=>Clicker.state.apoc.stage")
    check(st and st['index'] == 0, '開戰：進入第 1 站 ' + str({'need': st and st['need']}))
    hp0 = pg.evaluate("()=>Clicker.state.apoc.stage.hp")
    for _ in range(12):
        pg.evaluate("()=>document.getElementById('tap').click()"); pg.wait_for_timeout(40)
    check(pg.evaluate("()=>Clicker.state.apoc.stage.hp") < hp0, '點怪會扣血')
    check('/' in pg.locator('#package-number').inner_text(), '血條寫著目前血量：' + pg.locator('#package-number').inner_text())
    pg.screenshot(path=str(OUT / '2-fight.png'))

    # ---- 卡冊與編隊都是 1.0 那一套
    pg.eval_on_selector('#roster-open', 'e=>e.click()'); pg.wait_for_timeout(900)
    check(pg.locator('.album-slot').count() > 0, '末世卡冊打得開（%d 格）' % pg.locator('.album-slot').count())
    check(pg.locator('#train-all').is_hidden() and pg.locator('#dust-open').is_hidden(), '1.0 的粉塵罐／平均訓練在末世收起來')
    pg.evaluate("()=>document.querySelector('.album-slot:not(.locked)')?.click()"); pg.wait_for_timeout(700)
    btns = [t.strip() for t in pg.locator('#album-detail button').all_inner_texts()]
    check(not any('超越' in t or '升階' in t or '派遣' in t for t in btns), '末世詳情沒有升階／超越／派遣：' + '、'.join(btns))
    pg.screenshot(path=str(OUT / '3-album.png'))
    pg.eval_on_selector('#roster-close', 'e=>e.click()'); pg.wait_for_timeout(500)
    pg.eval_on_selector('#team-open', 'e=>e.click()'); pg.wait_for_timeout(900)
    check(pg.locator('#t20-grid .team-proxy').count() > 0, '末世編隊打得開')
    check(pg.locator('#t20-caps .capacity-row').count() == 4, '四條累加上限列都在')
    pg.screenshot(path=str(OUT / '4-team.png'))
    pg.eval_on_selector('#team-close', 'e=>e.click()'); pg.wait_for_timeout(500)

    # ---- 切回 1.0：兩邊進度互不影響
    apoc_progress = pg.evaluate("()=>Clicker.state.apoc.progress")
    coins = pg.evaluate("()=>Clicker.state.coins")
    pg.eval_on_selector('#scene-open', 'e=>e.click()'); pg.wait_for_timeout(600)
    pg.eval_on_selector('.scene-ticket[data-scene="backyard"]', 'e=>e.click()'); pg.wait_for_timeout(1400)
    check(pg.evaluate("()=>Clicker.state.settings.world") == 'home', '選 1.0 的場景 → 切回桌邊')
    check(pg.evaluate("()=>document.body.dataset.world") is None, 'body 的 data-world 拿掉（色票回來）')
    check(pg.evaluate("()=>Clicker.state.apoc.progress") == apoc_progress, '末世進度沒有被動到')
    check(abs(pg.evaluate("()=>Clicker.state.coins") - coins) < coins * .5 + 1e6, '1.0 的錢還在')
    check(pg.locator('#apoc-enemy').is_hidden(), '回到桌邊，怪收起來')
    pg.screenshot(path=str(OUT / '5-back-home.png'))

    # ---- 重新整理之後還在剛剛選的那個主系統
    pg.eval_on_selector('#scene-open', 'e=>e.click()'); pg.wait_for_timeout(500)
    pg.eval_on_selector('.scene-ticket[data-scene="apoc"]', 'e=>e.click()'); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
    check(pg.evaluate("()=>Clicker.state.settings.world") == 'apoc', '重新整理之後還在末世（存檔記得）')

    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK')
sys.exit(1 if fails else 0)
