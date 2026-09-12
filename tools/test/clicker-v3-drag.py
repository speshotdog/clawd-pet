# -*- coding: utf-8 -*-
"""v3 拖曳驗收：夥伴列拖到技能槽＝裝備；<8px 是點擊（開名冊）；放到槽外取消；Escape 取消；ghost／drop-target 清乾淨；手機寬度不拖。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-drag.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-drag'
OUT.mkdir(parents=True, exist_ok=True)
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  for (const id of ['yueyue2','caihua','lk','yang','dog','fox']) { s.collection[id]=1; s.dust[id]=1; }
  s.roster=['yueyue2','caihua','lk','yang','dog','fox']; s.skillSlots=['yueyue2',null,null]; s.coins=2e5; s.lifetimeCoins=2e5; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def open_page(p, w=1280, h=860):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, reduced_motion='reduce')

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


def center(pg, sel):
    return pg.evaluate("(sel)=>{const r=document.querySelector(sel).getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]}", sel)


def drag(pg, src, dst, steps=12, escape=False):
    x0, y0 = center(pg, src); x1, y1 = dst
    pg.mouse.move(x0, y0); pg.mouse.down()
    for i in range(1, steps + 1):
        pg.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); pg.wait_for_timeout(16)
    mid = pg.evaluate("()=>Clicker.drag")
    if escape:
        pg.keyboard.press('Escape'); pg.wait_for_timeout(50)
    pg.mouse.up(); pg.wait_for_timeout(250)
    return mid


NOTICE = "()=>document.getElementById('notice').textContent"

with sync_playwright() as p:
    b, pg, errors = open_page(p)
    mid = drag(pg, '.buddy[data-id="caihua"]', center(pg, '#slots .skill-slot:nth-child(2)'))
    check(mid['active'] and mid['ghosts'] == 1 and mid['targets'] == 1, '拖曳中：ghost 1、目標高亮 1 ' + str(mid))
    st = pg.evaluate("()=>({slots:Clicker.state.skillSlots, drag:Clicker.drag})")
    check(st['slots'][1] == 'caihua', '放下：槽 2 = 采華 ' + str(st['slots']))
    check(st['drag']['ghosts'] == 0 and st['drag']['targets'] == 0 and not st['drag']['pending'], '放下後清乾淨 ' + str(st['drag']))
    check(pg.evaluate("()=>document.getElementById('roster').hidden"), '拖曳成立不會順便開名冊')
    drag(pg, '.buddy[data-id="lk"]', (400, 300))
    st = pg.evaluate("()=>Clicker.state.skillSlots")
    check('lk' not in st and '取消' in pg.evaluate(NOTICE), '放到槽外：取消、技能不變 ' + pg.evaluate(NOTICE))
    drag(pg, '.buddy[data-id="yang"]', center(pg, '#slots .skill-slot:nth-child(3)'), escape=True)
    st = pg.evaluate("()=>({slots:Clicker.state.skillSlots, drag:Clicker.drag})")
    check(st['slots'][2] is None and st['drag']['ghosts'] == 0, 'Escape：取消、ghost 0 ' + str(st))
    x, y = center(pg, '.buddy[data-id="dog"]'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 3, y + 2); pg.mouse.up(); pg.wait_for_timeout(500)
    check(not pg.evaluate("()=>document.getElementById('roster').hidden"), '移動 3px 放開＝點擊，名冊開了')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    drag(pg, '.buddy[data-id="yueyue2"]', center(pg, '#slots .skill-slot:nth-child(3)'))
    st = pg.evaluate("()=>Clicker.state.skillSlots")
    check(st[0] == 'yueyue2' and st[2] is None, '已在槽 1 的卡拖到槽 3：擋下並提示 ' + pg.evaluate(NOTICE))
    pg.screenshot(path=str(OUT / '1-after.png'))
    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200])
    b.close()
    b, pg, errors = open_page(p, 390, 844)
    x, y = center(pg, '.buddy[data-id="caihua"]'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 120, steps=10)
    mid = pg.evaluate("()=>Clicker.drag"); pg.mouse.up(); pg.wait_for_timeout(300)
    check(not mid['active'] and mid['ghosts'] == 0, '手機寬度：不成立拖曳 ' + str(mid))
    b.close()

print('\n%d FAIL' % len(fails) if fails else '\nALL OK'); sys.exit(1 if fails else 0)
