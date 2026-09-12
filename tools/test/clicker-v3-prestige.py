# -*- coding: utf-8 -*-
"""v3 換桌布面板驗收：本輪帳（王勝／包數）、神器七條線買賣、招募券消失、換桌布後本輪歸零＋當家重抽。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-prestige.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-prestige'
OUT.mkdir(parents=True, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters).slice(0,12); s.collection=Object.fromEntries(ids.map(i=>[i,3])); s.dust={...s.collection};
  s.coins=1e6; s.lifetimeCoins=2e6; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen']; s.runWins=['backyard','kitchen']; s.runPacks=130; s.marks=9; s.marksClaimed=9; s.champions=['yueyue2','caihua'];
  s.settings.scene='market'; s.package=E.newPackage('market',5);
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def open_page(p):
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
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    return b, pg, errors


with sync_playwright() as p:
    b, pg, errors = open_page(p)
    pg.click('#prestige-open'); pg.wait_for_timeout(400)
    summary = pg.text_content('#prestige-summary'); check('本輪已拿 3 / 12' in summary and '/ 100' in summary, '摘要：' + summary)
    ledger = pg.evaluate("()=>[...document.querySelectorAll('.run-ledger li')].map(li=>li.className+':'+li.textContent)")
    check(len(ledger) == 9 and sum(1 for x in ledger if x.startswith('done')) == 3, '本輪帳 9 列、3 列完成：' + ' | '.join(ledger)[:200])
    go = pg.text_content('#prestige-go'); check('領 3 顆' in go, '換桌布鍵：' + go)
    pg.screenshot(path=str(OUT / '1-prestige-tab.png'))
    pg.click('.prestige-tabs button:nth-child(2)'); pg.wait_for_timeout(300)
    arts = pg.evaluate("()=>[...document.querySelectorAll('.mark-ticket.artifact')].map(t=>({id:t.dataset.item,disabled:t.disabled,text:t.querySelector('b').textContent,cost:t.querySelector('i').textContent}))")
    check(len(arts) == 7 and all(a['text'].endswith('/ 20') or a['text'].endswith('/ 10') for a in arts), '神器 7 條：' + ', '.join(a['id'] for a in arts))
    check(not pg.evaluate("()=>[...document.querySelectorAll('.mark-ticket')].some(t=>t.textContent.includes('招募券'))"), '招募券不在面板上')
    pg.screenshot(path=str(OUT / '2-artifacts.png'))
    pg.click('.mark-ticket.artifact[data-item="tap"]'); pg.wait_for_timeout(300)
    pg.click('.mark-ticket.artifact[data-item="tap"]'); pg.wait_for_timeout(300)
    st = pg.evaluate("()=>({marks:Clicker.state.marks, tap:Clicker.state.artifacts.tap})"); check(st == {'marks': 6, 'tap': 2}, '買兩級攻擊力祝福：1+2 枚 ' + str(st))
    pg.click('.mark-ticket.artifact[data-item="blessing"]'); pg.wait_for_timeout(300)
    st = pg.evaluate("()=>({marks:Clicker.state.marks, b:Clicker.state.blessing})"); check(st == {'marks': 5, 'b': 1}, '收益祝福 Lv1：' + str(st))
    pips = pg.evaluate("()=>document.querySelector('.mark-ticket.artifact[data-item=tap] .art-pips').querySelectorAll('i.on').length"); check(pips == 2, '攻擊力祝福亮 2 格')
    pg.click('.prestige-tabs button:nth-child(1)'); pg.wait_for_timeout(300)
    pg.click('#prestige-go'); pg.wait_for_timeout(200); pg.click('#prestige-go'); pg.wait_for_timeout(2500)
    st = pg.evaluate("()=>({run:Clicker.state.runWins, packs:Clicker.state.runPacks, marks:Clicker.state.marks, claimed:Clicker.state.marksClaimed, champs:Clicker.state.champions, tap:Clicker.state.artifacts.tap, scene:Clicker.state.settings.scene})")
    check(st['run'] == [] and st['packs'] < 10 and st['marks'] == 8 and st['claimed'] == 12, '換桌布後：本輪歸零、印記 5+3=8、累計 12 ' + str(st))
    check(len(st['champs']) == 2 and st['tap'] == 2 and st['scene'] == 'backyard', '當家重抽、神器保留、回後院 ' + str(st))
    pg.screenshot(path=str(OUT / '3-after.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
