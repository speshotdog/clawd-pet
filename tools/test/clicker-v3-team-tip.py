# -*- coding: utf-8 -*-
"""編隊：指到卡片浮出技能效果（1.0 與 2.0）、詳情面板有技能列（手機沒 hover 也看得到）。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-team-tip.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-team-tip'
OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,3])); s.dust={...s.collection};
  s.coins=1e7; s.lifetimeCoins=1e7; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.roster=['yueyue2','caihua','lk','yang','dog','fox']; s.skillSlots=['yueyue2',null,null];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.apoc={unlocked:true,tutorial:4};
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
TIP = "()=>{const t=document.querySelector('#team-editor .team-tip'); if(!t||t.hidden) return null; const r=t.getBoundingClientRect(), h=document.getElementById('team-editor').getBoundingClientRect(); return {name:t.querySelector('b').textContent, text:t.querySelector('span').textContent, inside:r.left>=h.left&&r.right<=h.right&&r.top>=h.top&&r.bottom<=h.bottom};}"
DETAIL = "()=>{const p=document.getElementById('t20-detail-skill'); return p&&!p.hidden ? {name:p.querySelector('b')?.textContent, text:p.querySelector('span')?.textContent} : null;}"

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1280, 'height': 860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED); pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)

        for world in ['home', 'apoc']:
            if world == 'apoc':
                pg.evaluate("()=>document.getElementById('mode-open').click()"); pg.wait_for_timeout(500)
                pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>/末世/.test(b.textContent)&&!b.disabled)?.click()"); pg.wait_for_timeout(1200)
                pg.evaluate("()=>{const A=ApocEconomy,s=Clicker.state; s.apoc=A.drawn({...A.normalize(s.apoc),tickets:40}, ApocPool.slice(0,12).map(c=>c.id)); s.apoc.skills=[s.apoc.roster[0],null,null,null];}")
                pg.wait_for_timeout(600)
                check(pg.evaluate("()=>Clicker.state.settings.world")=='apoc', '切到末世')
            pg.evaluate("()=>document.getElementById('team-open').click()"); pg.wait_for_timeout(900)
            check(pg.evaluate("()=>!document.getElementById('team-editor').hidden"), f'{world}：編隊打開')
            # 詳情面板（預設選第一位）已有技能列
            d = pg.evaluate(DETAIL)
            check(bool(d and d['name'] and d['text']), f'{world}：詳情面板有技能名與效果：{d}')
            # 指到第二張卡 → 浮出提示
            second = pg.locator('#t20-grid .team-proxy').nth(1); second.hover(); pg.wait_for_timeout(250)
            t = pg.evaluate(TIP); name2 = second.locator('.proxy-name').inner_text()
            check(bool(t and t['name'] and t['text']), f'{world}：指到卡片浮出技能提示：{t}')
            check(bool(t and t['inside']), f'{world}：提示在編隊畫面裡沒被切掉')
            if world == 'home': check(bool(t and '現在：' in t['text'] and ('下一星' in t['text'] or '冷卻' in t['text'])), f'{world}：1.0 提示含現在／下一星')
            else: check(bool(t and '冷卻' in t['text']), f'{world}：2.0 提示含效果與冷卻')
            pg.screenshot(path=str(OUT / f'tip-{world}.png'))
            # 移開 → 消失
            pg.mouse.move(5, 5); pg.wait_for_timeout(250)
            check(pg.evaluate(TIP) is None, f'{world}：移開後提示消失')
            # 技能槽也有
            pg.locator('#t20-skills .skill-slot').first.hover(); pg.wait_for_timeout(250)
            t = pg.evaluate(TIP); check(bool(t and t['name'] and t['inside']), f'{world}：技能槽也浮出提示、而且在畫面裡：{t}')
            pg.mouse.move(5, 5); pg.wait_for_timeout(200)
            # 點卡 → 詳情換人、技能列跟著換
            second.click(); pg.wait_for_timeout(400); d2 = pg.evaluate(DETAIL)
            check(bool(d2 and d2 != d), f'{world}：點另一張卡，詳情技能列跟著換：{d2}')
            pg.evaluate("()=>document.getElementById('team-close').click()"); pg.wait_for_timeout(500)
        check(not errors, f'沒有 pageerror：{errors}')
        b.close()
    print('\n' + ('全部通過' if not fails else f'失敗 {len(fails)} 項')); sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
