# -*- coding: utf-8 -*-
"""v3 編隊畫面驗收：上限列、候選點一下編入、隊員點兩下移出、塞不進去的階級講原因、點隊員再點槽＝裝備、自動編隊、Escape 關閉。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-teamui.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]; SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-teamui'; OUT.mkdir(parents=True, exist_ok=True); fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,3])); s.dust={...s.collection};
  const my=ids.filter(id=>E.origin(id)===3), leg=ids.filter(id=>E.origin(id)===2), rare=ids.filter(id=>E.origin(id)===0);
  s.roster=[my[0],my[1],...leg.slice(0,4),...rare.slice(0,6)];   // 神話 2/2 滿、傳說 6/6 滿、共 12
  s.skillSlots=[rare[0],null,null]; s.coins=1e7; s.lifetimeCoins=1e7; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
def open_page(p):
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1280, 'height': 860}, device_scale_factor=1, reduced_motion='reduce')
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route); ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(800); return b, pg, errors
with sync_playwright() as p:
    b, pg, errors = open_page(p)
    pg.click('#team-open'); pg.wait_for_timeout(400)
    caps = pg.evaluate("()=>[...document.querySelectorAll('.team-cap')].map(e=>e.className.includes('full')+':'+e.textContent)")
    check(len(caps) == 4 and caps[0].startswith('true') and caps[1].startswith('true') and caps[2].startswith('false'), '上限列：神話 2/2 滿、傳說層 6/6 滿、史詩層未滿 ' + str(caps))
    check(pg.text_content('#team-count').strip() == '12 / 20', '隊伍 12/20')
    pg.screenshot(path=str(OUT / '1-editor.png'))
    # 塞不進去的神話：講原因
    third = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===3)[2]")
    pg.click(f'.team-cell.cand[data-id="{third}"]'); pg.wait_for_timeout(300)
    why = pg.text_content('#team-why'); check('神話卡塞不進去' in why and '2/2' in why, '第三張神話：' + why)
    check(pg.evaluate("(id)=>!ClickerEconomy.rosterOf(Clicker.state).includes(id)", third), '沒有被編入')
    fifth = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===2)[4]")
    pg.click(f'.team-cell.cand[data-id="{fifth}"]'); pg.wait_for_timeout(300)
    why = pg.text_content('#team-why'); check('傳說卡塞不進去' in why and '神話＋傳說' in why and '6/6' in why, '第五張傳說：' + why)
    # 史詩塞得進去
    epic = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===1)[0]")
    pg.click(f'.team-cell.cand[data-id="{epic}"]'); pg.wait_for_timeout(300)
    check(pg.evaluate("(id)=>ClickerEconomy.rosterOf(Clicker.state).includes(id)", epic) and pg.text_content('#team-count').strip() == '13 / 20', '史詩編入 → 13/20')
    pg.screenshot(path=str(OUT / '2-why.png'))
    # 點隊員再點槽 2 = 裝備
    pg.click(f'.team-grid .team-cell[data-id="{epic}"]'); pg.wait_for_timeout(200)
    check(pg.evaluate("(id)=>document.querySelector(`.team-grid .team-cell[data-id=${id}]`).classList.contains('picked')", epic), '點隊員 → 選取')
    pg.click('.team-slots .team-slot:nth-child(2)'); pg.wait_for_timeout(400)
    check(pg.evaluate("()=>Clicker.state.skillSlots[1]") == epic, '再點槽 2 → 裝備')
    # 點兩下移出：移出後技能槽清空
    pg.click(f'.team-grid .team-cell[data-id="{epic}"]'); pg.wait_for_timeout(150); pg.click(f'.team-grid .team-cell[data-id="{epic}"]'); pg.wait_for_timeout(400)
    st = pg.evaluate("(id)=>({inTeam:ClickerEconomy.rosterOf(Clicker.state).includes(id), slot:Clicker.state.skillSlots[1]})", epic); check(not st['inTeam'] and st['slot'] is None, '點兩下移出，技能槽一併清空 ' + str(st))
    # 自動編隊
    pg.click('#team-auto'); pg.wait_for_timeout(400); check(pg.text_content('#team-count').strip() == '20 / 20', '自動編隊 → 20/20')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); check(pg.evaluate("()=>document.getElementById('team-editor').hidden"), 'Escape 關閉')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200]); b.close()
print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
