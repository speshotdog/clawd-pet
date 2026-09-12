# -*- coding: utf-8 -*-
"""v3 卡冊編隊／派遣驗收：隊伍摘要、隊／派章、當家旗、編入／移出、階級上限擋、派遣 4 小時、收回給粉塵、技能槽要在隊。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-team.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-team'
OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,3])); s.dust={...s.collection};
  s.coins=1e7; s.lifetimeCoins=1e7; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.roster=['yueyue2','caihua','lk','yang','dog','fox','jiaobu2','zhenzhen2','zhenmu','jiaobu','yueyue','zhenzhen'];
  s.skillSlots=['yueyue2',null,null]; s.champions=['caihua','zhenmu'];
  // 派遣：一位已經回來、一位還沒
  s.dispatch=[{id:'alu',startedAt:Date.now()-5*3600000,until:Date.now()-3600000},{id:'seal',startedAt:Date.now(),until:Date.now()+4*3600000}];
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

def open_page(p):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1, reduced_motion='reduce')
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
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
    pg.click('#roster-open'); pg.wait_for_timeout(500)
    summary = pg.text_content('#team-summary'); check('12/20' in summary and '神 0/2' in summary, '隊伍摘要：' + summary[:60])
    check(not pg.evaluate("()=>document.getElementById('recall-all').hidden") and '（1）' in pg.text_content('#recall-all'), '收回派遣鍵（1）')
    stamps = pg.evaluate("()=>({team:document.querySelectorAll('.album-slot .team-stamp').length, away:document.querySelectorAll('.album-slot .away-stamp').length, champ:document.querySelectorAll('.album-slot .champ-flag').length, slot:document.querySelectorAll('.album-slot .slot-stamp:not(.team-stamp):not(.away-stamp)').length})")
    check(stamps['team'] >= 1 and stamps['champ'] >= 1, '第一頁有隊章與當家旗 ' + str(stamps))
    pg.screenshot(path=str(OUT / '1-book.png'))
    # 詳情：caihua 在隊＋當家 → 移出
    pg.click('.album-slot[data-id="caihua"]'); pg.wait_for_timeout(400)
    rows = pg.text_content('#album-detail .detail-info'); check('本輪當家' in rows and '在隊伍裡' in rows, '詳情列：當家、在隊')
    pg.screenshot(path=str(OUT / '2-detail-in-team.png'))
    pg.click('#album-detail .grow-btn.team'); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>({r:Clicker.state.roster.length, inc:Clicker.state.roster.includes('caihua')})"); check(st == {'r': 11, 'inc': False}, '移出隊伍 → 11 張 ' + str(st))
    check(pg.evaluate("()=>[...document.querySelectorAll('#album-detail .detail-buttons button')].filter(b=>b.textContent.startsWith('裝備至槽')).every(b=>b.disabled)"), '不在隊：裝備鍵全部灰掉')
    # 派遣 caihua
    pg.click('#album-detail .grow-btn.dispatch'); pg.wait_for_timeout(500)
    st = pg.evaluate("()=>Clicker.state.dispatch.map(d=>d.id)"); check('caihua' in st and len(st) == 3, '派遣 caihua → 3 格滿 ' + str(st))
    check('派遣中' in pg.text_content('#album-detail .grow-btn.dispatch'), '鍵變「派遣中」')
    pg.screenshot(path=str(OUT / '3-detail-dispatched.png'))
    # 收回已到期的 alu
    pg.click('#album-detail .detail-back'); pg.wait_for_timeout(300)
    dust0 = pg.evaluate("()=>({alu:Clicker.state.dust.alu, u:Clicker.state.universalDust})")
    pg.click('#recall-all'); pg.wait_for_timeout(500)
    dust1 = pg.evaluate("()=>({alu:Clicker.state.dust.alu, u:Clicker.state.universalDust, n:Clicker.state.dispatch.length})")
    check(dust1['alu'] == dust0['alu'] + 1 and dust1['u'] == dust0['u'] + 1 and dust1['n'] == 2, '收回：alu 粉塵 +1、萬用 +1、剩 2 位在外 ' + str(dust1))
    check(pg.evaluate("()=>document.getElementById('recall-all').hidden"), '沒有到期的就收起收回鍵')
    # 階級上限：神話 3 張擋住（先塞 2 張神話進隊）
    pg.evaluate("()=>{const E=ClickerEconomy; const s=structuredClone(Clicker.state); const my=Object.keys(ClickerBalance.characters).filter(id=>E.origin(id)===3); s.roster=[...s.roster.filter(id=>E.origin(id)!==3), my[0], my[1]]; sessionStorage.setItem('test-seed',JSON.stringify(s));}")   # 用 test-seed，直接寫 localStorage 會被自動存檔蓋掉
    pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800)
    third = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===3)[2]")
    pg.click('#roster-open'); pg.wait_for_timeout(400)
    pg.evaluate("(id)=>{ const el=document.querySelector(`.album-slot[data-id=${id}]`); if(!el){ for(let i=0;i<10;i++){ document.getElementById('album-next').click(); if(document.querySelector(`.album-slot[data-id=${id}]`)) break; } } }", third)
    pg.wait_for_timeout(300); pg.click(f'.album-slot[data-id="{third}"]'); pg.wait_for_timeout(400)
    pg.click('#album-detail .grow-btn.team'); pg.wait_for_timeout(400)
    st = pg.evaluate("(id)=>Clicker.state.roster.includes(id)", third); check(not st and '格子滿了' in (pg.text_content('#notice') or ''), '第三張神話被擋：' + (pg.text_content('#notice') or ''))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:300])
    b.close()
print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
