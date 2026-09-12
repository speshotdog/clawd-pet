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
    # 滅世珍獸血量是關卡函數（很厚）；這裡驗的是「打贏之後的流程」，直接把血量壓到剩一點再點最後一下
    pg.evaluate("()=>{ Clicker.state.boss.dealt = Clicker.state.boss.need - 1; }")
    pg.click('#boss-view', force=True); pg.wait_for_timeout(1500)
    st = pg.evaluate("()=>({won:Clicker.state.bossWins.includes('city'), unlocked:Clicker.state.apoc.unlocked})")
    check(st['won'] and st['unlocked'], '打贏滅世珍獸 → apoc.unlocked ' + str(st))
    pg.wait_for_timeout(4200)
    check(not pg.evaluate("()=>document.getElementById('apoc').hidden"), '演出後自動開末世殼')
    check(not pg.evaluate("()=>document.getElementById('apoc-coach').hidden") and pg.text_content('#apoc-coach-title') == '歡迎來到末世', '新手引導第 1 步：' + pg.text_content('#apoc-coach-title'))
    check(not pg.evaluate("()=>document.getElementById('apoc-open').hidden") and pg.evaluate("()=>document.getElementById('apoc-open').classList.contains('new')"), '底部「末世地圖」鍵出現、發光')
    pg.wait_for_function("()=>{const f=document.getElementById('apoc-frame-map'); return f && !f.classList.contains('off') && f.contentWindow && f.contentWindow.map20}", timeout=30000)
    check(True, 'map20 iframe 載入（window.map20 存在）')
    pg.screenshot(path=str(OUT / '1-coach.png'))
    titles, screens = [], []
    for i in range(5):
        pg.click('#apoc-coach-next'); pg.wait_for_timeout(700); titles.append(pg.text_content('#apoc-coach-title'))
        screens.append(pg.evaluate("()=>({map:document.getElementById('apoc-frame-map').contentDocument.body.dataset.screen, gachaOn:!document.getElementById('apoc-frame-gacha').classList.contains('off')})"))
    check(titles[2] == '編隊：20 張、上限 2／6／12' and screens[2]['map'] == 'team', '第 4 步切到 map20 的編隊畫面 ' + str(screens[2]))
    check(titles[1] == '先抽第一張精裝卡' and screens[1]['gachaOn'], '第 3 步精裝招募分頁 ' + str(screens[1]))
    check(titles[4] == '準備好就出發' and screens[4]['map'] == 'map', '第 6 步回到地圖')
    pg.screenshot(path=str(OUT / '2-team-step.png'))
    check(pg.text_content('#apoc-coach-next') == '開始探索', '最後一步鍵字「開始探索」')
    pg.click('#apoc-coach-next'); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>({coach:document.getElementById('apoc-coach').hidden, tut:Clicker.state.apoc.tutorial, glow:document.getElementById('apoc-open').classList.contains('new')})")
    check(st['coach'] and st['tut'] == 6 and not st['glow'], '教學完成：記錄 6、鍵不再發光 ' + str(st))
    pg.click('#apoc-tab-collect'); pg.wait_for_timeout(300)
    check(not pg.evaluate("()=>document.getElementById('apoc-collect-empty').hidden"), '沒有收藏卡：顯示「還沒有收藏卡」')
    pg.click('#apoc-close'); pg.wait_for_timeout(300); check(pg.evaluate("()=>document.getElementById('apoc').hidden"), '返回 1.0')
    pg.click('#apoc-open'); pg.wait_for_timeout(500); check(pg.evaluate("()=>document.getElementById('apoc-coach').hidden"), '再進來不重播教學')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()
    # 有收藏卡：收藏卡分頁載入精裝魔花少女
    b, pg, errors = open_page(p, SEED(True))
    check(pg.evaluate("()=>document.getElementById('apoc-open').hidden"), '打過城市前末世鍵藏著（bossWins 沒 city）')
    pg.evaluate("()=>{ const s=structuredClone(Clicker.state); s.bossWins.push('city'); sessionStorage.setItem('test-seed',JSON.stringify(s)); }")
    pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    check(not pg.evaluate("()=>document.getElementById('apoc-open').hidden"), '舊存檔打過城市 → 開門')
    pg.click('#apoc-open'); pg.wait_for_timeout(300); pg.click('#apoc-coach-skip'); pg.wait_for_timeout(300)
    pg.click('#apoc-tab-collect'); pg.wait_for_timeout(300)
    pg.wait_for_function("()=>{const f=document.getElementById('apoc-frame-collect'); return f && !f.classList.contains('off') && f.contentDocument && f.contentDocument.title.includes('魔花少女')}", timeout=30000)
    check(True, '收藏卡分頁載入精裝魔花少女頁')
    pg.wait_for_timeout(1500); pg.screenshot(path=str(OUT / '3-collect.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
