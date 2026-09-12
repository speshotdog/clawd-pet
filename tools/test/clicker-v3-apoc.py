# -*- coding: utf-8 -*-
"""v3 末世入口驗收：打贏滅世珍獸 → apoc.unlocked、演出後自動開末世殼＋新手引導；六步走完 → tutorial 記錄；
底部「末世地圖」鍵出現；地圖／編隊（map20 iframe setScreen）／精裝招募／收藏卡（有魔花少女才顯示）四個分頁。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-apoc'
OUT.mkdir(parents=True, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def SEED(collect):
    return """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,16])); s.dust={...s.collection}; s.partnerLevels=Object.fromEntries(ids.map(i=>[i,150]));
  s.trainingLevel=30; s.clickLevel=80; s.coins=1e14; s.lifetimeCoins=1e15; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge']; s.settings.scene='city'; s.package=E.newPackage('city',120);
  %s
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }""" % ("s.collectibles=['mohuashaonv'];" if collect else "")


def open_page(p, seed):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1, reduced_motion='reduce')

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file():
            r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(seed); pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    return b, pg, errors


with sync_playwright() as p:
    b, pg, errors = open_page(p, SEED(False))
    check(pg.evaluate("()=>document.getElementById('apoc-open').hidden"), '還沒打滅世珍獸：末世鍵藏著')
    check(pg.evaluate("()=>ClickerEconomy.canBoss(Clicker.state, Date.now())"), '可以挑戰滅世珍獸')
    pg.click('#boss-challenge'); pg.wait_for_timeout(600)
    pg.evaluate("()=>{ Clicker.state.boss.dealt = Clicker.state.boss.need - 1; }")
    pg.click('#boss-view', force=True); pg.wait_for_timeout(1500)
    st = pg.evaluate("()=>({won:Clicker.state.bossWins.includes('city'), unlocked:Clicker.state.apoc.unlocked})")
    check(st['won'] and st['unlocked'], '打贏滅世珍獸 → apoc.unlocked ' + str(st))
    pg.wait_for_timeout(4200)
    check(not pg.evaluate("()=>document.getElementById('apoc').hidden") and pg.evaluate("()=>document.body.dataset.mode") == 'apoc', '演出後自動切成末世模式（整框）')
    check(pg.evaluate("()=>getComputedStyle(document.getElementById('topbar')).visibility") == 'hidden', '1.0 頂欄被蓋掉（模式切換，不是浮窗）')
    pg.wait_for_function("()=>Clicker.apocReady", timeout=40000)
    check(not pg.evaluate("()=>document.getElementById('apoc-coach').hidden") and pg.text_content('#apoc-coach-title') == '歡迎來到末世', '新手引導第 1 步：' + pg.text_content('#apoc-coach-title'))
    check(not pg.evaluate("()=>document.getElementById('apoc-open').hidden") and pg.evaluate("()=>document.getElementById('apoc-open').classList.contains('new')"), '底部「末世地圖」鍵出現、發光')
    F = "document.getElementById('apoc-frame').contentWindow"
    coins = pg.evaluate(f"()=>{F}.document.querySelector('#apoc-coins').textContent"); check(coins.isdigit() and int(coins) < 100, '末世頂欄顯示末世金幣（放置剛開始累積，不是 1.0 的幣）' + coins)
    pg.screenshot(path=str(OUT / '1-coach.png'))
    titles, screens = [], []
    for i in range(5):
        pg.click('#apoc-coach-next'); pg.wait_for_timeout(800); titles.append(pg.text_content('#apoc-coach-title'))
        screens.append(pg.evaluate(f"()=>({{screen:{F}.document.body.dataset.screen, tab:[...{F}.document.querySelectorAll('.apoc-nav button')].find(b=>b.getAttribute('aria-current')==='true')?.dataset.go, gacha:!{F}.document.getElementById('gacha-screen').hidden}})"))
    check(titles[2].startswith('編隊') and screens[2]['screen'] == 'team' and screens[2]['tab'] == 'team', '第 4 步切到編隊收藏 ' + str(screens[2]))
    check(titles[1] == '先抽第一張精裝卡' and screens[1]['gacha'] and screens[1]['tab'] == 'gacha', '第 3 步精裝招募 ' + str(screens[1]))
    check(titles[4] == '卡冊・收藏卡' and screens[4]['screen'] == 'team' and screens[4]['tab'] == 'collect', '第 6 步卡冊・收藏卡（在編隊收藏裡）' + str(screens[4]))
    check(pg.evaluate(f"()=>{F}.document.querySelector('#collect-grid .collect-empty')?.textContent") == '還沒有收藏卡。', '沒有收藏卡：顯示「還沒有收藏卡」')
    pg.screenshot(path=str(OUT / '2-collect-step.png'))
    check(pg.text_content('#apoc-coach-next') == '開始探索', '最後一步鍵字「開始探索」')
    pg.click('#apoc-coach-next'); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>({coach:document.getElementById('apoc-coach').hidden, tut:Clicker.state.apoc.tutorial, glow:document.getElementById('apoc-open').classList.contains('new')})")
    check(st['coach'] and st['tut'] == 6 and not st['glow'], '教學完成：記錄 6、鍵不再發光 ' + str(st))
    pg.evaluate(f"()=>{F}.document.getElementById('apoc-back').click()"); pg.wait_for_timeout(400)
    check(pg.evaluate("()=>document.getElementById('apoc').hidden") and pg.evaluate("()=>document.body.dataset.mode") is None, '末世頂欄「返回 1.0」→ 回 1.0 模式')
    pg.click('#apoc-open'); pg.wait_for_timeout(800); check(pg.evaluate("()=>document.getElementById('apoc-coach').hidden"), '再進來不重播教學')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()
    # 有收藏卡：編隊收藏最下面的收藏卡欄有魔花少女，點開是精裝卡頁
    b, pg, errors = open_page(p, SEED(True))
    pg.evaluate("()=>{ const s=structuredClone(Clicker.state); s.bossWins.push('city'); sessionStorage.setItem('test-seed',JSON.stringify(s)); }")
    pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    check(not pg.evaluate("()=>document.getElementById('apoc-open').hidden"), '舊存檔打過城市 → 開門')
    pg.click('#apoc-open'); pg.wait_for_function("()=>Clicker.apocReady", timeout=40000); pg.wait_for_timeout(300); pg.click('#apoc-coach-skip'); pg.wait_for_timeout(300)
    pg.evaluate(f"()=>{F}.apocShell.go('collect')"); pg.wait_for_timeout(600)
    check(pg.evaluate(f"()=>{F}.document.querySelectorAll('#collect-grid .collect-card').length") == 1, '收藏卡欄有 1 張（魔花少女）')
    pg.evaluate(f"()=>{F}.document.querySelector('#collect-grid .collect-card').click()"); pg.wait_for_timeout(300)
    pg.wait_for_function(f"()=>{{const v={F}.document.getElementById('collect-view'); const f=v.querySelector('iframe'); return !v.hidden && f.contentDocument && f.contentDocument.title.includes('魔花少女')}}", timeout=40000)
    check(True, '點開 → 精裝魔花少女頁（three.js 原版）')
    pg.wait_for_timeout(1500); pg.screenshot(path=str(OUT / '3-collect.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
