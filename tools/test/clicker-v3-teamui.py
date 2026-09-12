# -*- coding: utf-8 -*-
"""v3 編隊畫面驗收（與末世 team20 同一套邏輯）：累加上限列、新增成員挑選器、塞不進去的階級逐層講原因、替換／移除、技能槽挑選器、自動編隊、Escape 關閉。
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
    caps = pg.evaluate("()=>[...document.querySelectorAll('#t20-caps .capacity-row .digits')].map(e=>e.textContent)")
    check(caps == ['2 / 2', '6 / 6', '6 / 12', '12 / 20'], '累加上限列 ' + str(caps))
    check(pg.text_content('#t20-count').strip() == '12 / 20', '隊伍 12/20')
    check(pg.evaluate("()=>document.querySelectorAll('#t20-grid .team-proxy:not([hidden])').length") == 10 and pg.text_content('#t20-page').strip() == '1 / 2', '10 張一頁、共 2 頁')
    pg.screenshot(path=str(OUT / '1-editor.png'))
    # 新增成員 → 挑選器；第三張神話：預覽亮「受影響」層，確認後逐層講原因、不編入
    pg.click('#t20-add'); pg.wait_for_timeout(300); check(pg.evaluate("()=>document.getElementById('t20-picker').open"), '挑選器開啟')
    third = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===3)[2]")
    pg.click(f'#t20-picker-grid .team-proxy[data-id="{third}"]'); pg.wait_for_timeout(300)
    check(pg.evaluate("()=>[...document.querySelectorAll('#t20-caps .capacity-row')].map(r=>r.classList.contains('affected'))") == [True, True, True, True], '神話預覽：四層都受影響')
    pg.click('#t20-picker-confirm'); pg.wait_for_timeout(300)
    why = pg.text_content('#t20-picker-status'); check('神話合計已達 2，加入後將為 3（上限 2' in why and '神話＋傳說合計已達 6' in why, '第三張神話原因：' + why)
    check(pg.evaluate("()=>[...document.querySelectorAll('#t20-caps .capacity-row')].map(r=>r.classList.contains('violated'))") == [True, True, False, False], '神話、神話＋傳說兩層標紅')
    check(pg.evaluate("(id)=>!ClickerEconomy.rosterOf(Clicker.state).includes(id)", third) and pg.evaluate("()=>document.getElementById('t20-picker').open"), '沒有被編入，挑選器留著')
    pg.screenshot(path=str(OUT / '2-why.png'))
    fifth = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===2)[4]")
    pg.click(f'#t20-picker-grid .team-proxy[data-id="{fifth}"]'); pg.wait_for_timeout(300); pg.click('#t20-picker-confirm'); pg.wait_for_timeout(300)
    why = pg.text_content('#t20-picker-status'); check(why.startswith('神話＋傳說合計已達 6，加入後將為 7（上限 6') and '神話合計' not in why.split('；')[0], '第五張傳說原因：' + why)
    # 史詩塞得進去 → 13/20，挑選器關閉
    epic = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===1)[0]")
    pg.click(f'#t20-picker-grid .team-proxy[data-id="{epic}"]'); pg.wait_for_timeout(300); pg.click('#t20-picker-confirm'); pg.wait_for_timeout(400)
    check(pg.evaluate("(id)=>ClickerEconomy.rosterOf(Clicker.state).includes(id)", epic) and pg.text_content('#t20-count').strip() == '13 / 20' and not pg.evaluate("()=>document.getElementById('t20-picker').open"), '史詩編入 → 13/20，挑選器關閉')
    check(pg.text_content('#t20-detail-number').strip() == '13', '詳情顯示 13 號')
    # 技能槽 2 挑選器：只列隊伍成員；選史詩 → 裝備
    pg.click('#t20-skills .skill-slot[data-slot="2"]'); pg.wait_for_timeout(300)
    n = pg.evaluate("()=>document.querySelectorAll('#t20-picker-grid .team-proxy').length"); check(n == 13, '技能槽挑選器只列隊伍 13 張 ' + str(n))
    pg.click(f'#t20-picker-grid .team-proxy[data-id="{epic}"]'); pg.wait_for_timeout(200); pg.click('#t20-picker-confirm'); pg.wait_for_timeout(400)
    check(pg.evaluate("()=>Clicker.state.skillSlots[2]") == epic, '技能槽 3 → 史詩')
    pg.screenshot(path=str(OUT / '3-skill.png'))
    # 替換目前成員（史詩 → 另一張史詩）
    epic2 = pg.evaluate("()=>Object.keys(ClickerBalance.characters).filter(id=>ClickerEconomy.origin(id)===1)[1]")
    pg.click('#t20-next'); pg.wait_for_timeout(200); pg.click(f'#t20-grid .team-proxy[data-id="{epic}"]'); pg.wait_for_timeout(200)
    pg.click('#t20-replace'); pg.wait_for_timeout(300); pg.click(f'#t20-picker-grid .team-proxy[data-id="{epic2}"]'); pg.wait_for_timeout(300); pg.click('#t20-picker-confirm'); pg.wait_for_timeout(400)
    st = pg.evaluate("([a,b])=>({a:ClickerEconomy.rosterOf(Clicker.state).includes(a), b:ClickerEconomy.rosterOf(Clicker.state).includes(b), slot:Clicker.state.skillSlots[2], n:document.getElementById('t20-count').textContent})", [epic, epic2])
    check(not st['a'] and st['b'] and st['slot'] is None and st['n'].strip() == '13 / 20', '替換：舊的離隊（技能槽清空）、新的入隊 ' + str(st))
    # 移除
    pg.click('#t20-remove'); pg.wait_for_timeout(400)
    check(not pg.evaluate("(id)=>ClickerEconomy.rosterOf(Clicker.state).includes(id)", epic2) and pg.text_content('#t20-count').strip() == '12 / 20', '移除 → 12/20')
    # 桌機拖曳：隊伍網格 → 編隊畫面的技能槽 2（與舞台夥伴列共用 clicker-drag）
    pg.click('#t20-prev'); pg.wait_for_timeout(200)
    src = pg.locator('#t20-grid .team-proxy:not([hidden])').nth(2); sid = src.get_attribute('data-id'); sb = src.bounding_box(); tb = pg.locator('#t20-skills .skill-slot[data-slot="1"]').bounding_box()
    pg.mouse.move(sb['x'] + sb['width'] / 2, sb['y'] + sb['height'] / 2); pg.mouse.down(); pg.mouse.move(sb['x'] + 30, sb['y'] + 30, steps=4); pg.mouse.move(tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2, steps=8); pg.wait_for_timeout(120)
    check(pg.evaluate("()=>Clicker.drag.active && Clicker.drag.targets===1"), '編隊畫面拖曳中：目標高亮 1')
    pg.mouse.up(); pg.wait_for_timeout(400)
    check(pg.evaluate("()=>Clicker.state.skillSlots[1]") == sid and pg.evaluate("()=>!Clicker.drag.pending"), '拖到技能槽 2 → 裝備 ' + str(sid))
    # 自動編隊
    pg.click('#team-auto'); pg.wait_for_timeout(400); check(pg.text_content('#t20-count').strip() == '20 / 20', '自動編隊 → 20/20')
    pg.screenshot(path=str(OUT / '4-auto.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); check(pg.evaluate("()=>document.getElementById('team-editor').hidden"), 'Escape 關閉')
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200]); b.close()
print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
