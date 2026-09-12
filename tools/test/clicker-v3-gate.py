# -*- coding: utf-8 -*-
"""v3 小王驗收（畫面）：
  ·拆完第 10 包出現路障，第一次自動開打，30 秒沒打完 → 停在路障、挑戰鍵留著、火力預估顯示冷卻
  ·輸過一次不自動再打；冷卻後自己點「挑戰」才開打
  ·火力預估 ≥90% 挑戰鍵發光；打贏橫幅寫獎金
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-gate.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-gate'
OUT.mkdir(parents=True, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def SEED(strong):
    return """() => { const S=ClickerSave,E=ClickerEconomy; const s=S.fresh(Date.now());
  s.collection={yueyue2:1}; s.dust={yueyue2:1}; s.roster=['yueyue2']; s.skillSlots=['yueyue2',null,null];
  s.coins=5000; s.lifetimeCoins=5000; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  if (%s) { s.clickLevel=40; s.package=E.newPackage('backyard',11); s.package.gate={index:10,cooldownUntil:0,lost:true}; }
  else { s.package=E.newPackage('backyard',10); s.package.progress=E.requirement(10)-1; }
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }""" % ('true' if strong else 'false')


def open_page(p, strong=False):
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
    pg.evaluate(SEED(strong)); pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    return b, pg, errors


STATE = """()=>{const s=Clicker.state; return {gate:s.package.gate||null, boss:s.boss?{gate:s.boss.gate,need:s.boss.need,dealt:s.boss.dealt}:null, idx:s.package.index, coins:s.coins,
  btn:{hidden:document.getElementById('boss-challenge').hidden, disabled:document.getElementById('boss-challenge').disabled, text:document.getElementById('boss-challenge').textContent, glow:document.getElementById('boss-challenge').classList.contains('glow')},
  est:{hidden:document.getElementById('boss-estimate').hidden, text:document.getElementById('boss-estimate').querySelector('span').textContent},
  block:{hidden:document.getElementById('gate-block').hidden, text:document.getElementById('gate-label').textContent},
  banner:document.getElementById('boss-banner').textContent, bossView:document.getElementById('boss-view').hidden}}"""

with sync_playwright() as p:
    b, pg, errors = open_page(p)
    d = pg.evaluate(STATE); check(d['idx'] in (10, 11), '起點：第 10 包（或載入結算剛拆完） ' + str(d['idx']))
    pg.click('#tap'); pg.wait_for_timeout(600)
    d = pg.evaluate(STATE)
    check(d['boss'] is not None and d['boss']['gate'] == 10, '拆完第 10 包：路障小王自動開打 ' + str(d['boss']))
    check(not d['bossView'], '王的畫面出現')
    pg.screenshot(path=str(OUT / '1-gate-fight.png'))
    pg.wait_for_timeout(31500)
    d = pg.evaluate(STATE)
    check(d['boss'] is None and d['gate'] and d['gate'].get('lost') is True, '30 秒沒打完：停在路障、lost=true ' + str(d['gate']))
    check(not d['btn']['hidden'], '挑戰鍵留著')
    check(not d['block']['hidden'] and '路障' in d['block']['text'], '路障佔位出現：' + d['block']['text'])
    check(not d['est']['hidden'] and '冷卻' in d['est']['text'], '火力預估顯示冷卻：' + d['est']['text'])
    pg.screenshot(path=str(OUT / '2-gate-lost.png'))
    pg.wait_for_timeout(31000)
    d = pg.evaluate(STATE); check(d['boss'] is None, '冷卻後沒有自動再打'); check(not d['btn']['disabled'] and '%' in d['est']['text'], '冷卻後挑戰鍵可按、預估 ' + d['est']['text'])
    check(not errors, '頁面錯誤 0（弱）：' + '; '.join(errors)[:300])
    b.close()
    # 第二頁：變強了（輸過一次的路障 + 攻擊力 40 級）→ 預估 ≥100%、鍵發光；點挑戰打贏、橫幅寫獎金
    b, pg, errors = open_page(p, strong=True)
    d = pg.evaluate(STATE); check(d['boss'] is None and d['gate'] and d['gate'].get('lost'), '強：路障在、沒自動打 ' + str(d['gate']))
    check(d['btn']['glow'] and '%' in d['est']['text'], '強：預估 ' + d['est']['text'] + ' 鍵發光=' + str(d['btn']['glow']))
    pg.screenshot(path=str(OUT / '3-gate-ready.png'))
    pg.click('#boss-challenge'); pg.wait_for_timeout(700)
    d = pg.evaluate(STATE); check(d['boss'] is not None and d['boss']['gate'] == 10, '點挑戰 → 開打 ' + str(d['boss']))
    for _ in range(15):
        pg.click('#tap'); pg.wait_for_timeout(60)
    pg.wait_for_timeout(2500)
    d = pg.evaluate(STATE)
    check(d['boss'] is None and d['gate'] is None and d['idx'] >= 11, '打贏：路障拆掉、繼續推包 ' + str((d['gate'], d['idx'])))
    check('路障打通' in d['banner'], '橫幅：' + d['banner'])
    pg.screenshot(path=str(OUT / '4-gate-won.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
