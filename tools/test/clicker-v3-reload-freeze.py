# -*- coding: utf-8 -*-
"""玩家回報 2026-09-16「柴柴技能會當機」：1.0 兩個持續技能還在跑時按柴柴打滾 → 存檔被擋 → 畫面凍住。
驗：按完柴柴後存檔狀態不是「儲存失敗」、重試儲存鍵沒出現、幣還會增加。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-reload-freeze.py
"""
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-reload'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
SEED = """() => { const S=ClickerSave,E=ClickerEconomy;
  const s=S.fresh(Date.now());
  s.collection={zhenmu:16,yueyue2:1,chaichai:1,yueyue:1,qinghua:1}; s.dust={...s.collection};
  s.coins=1e9; s.lifetimeCoins=1e9; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.roster=['zhenmu','yueyue2','chaichai','yueyue','qinghua']; s.skillSlots=['yueyue','qinghua','chaichai']; s.slotReadyAt=[0,0,0];
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 420, 'height': 860}, is_mobile=True, has_touch=True)
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file(): r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1200)
    slots = pg.evaluate("() => [...document.querySelectorAll('#slots .skill-use')].map(e => e.dataset.id || e.getAttribute('data-id') || e.textContent.trim().slice(0,12))")
    print('slots', slots)
    def press(i):
        pg.evaluate(f"() => document.querySelectorAll('#slots .skill-use')[{i}].click()"); pg.wait_for_timeout(3000)
    press(0); press(1)
    fx = pg.evaluate("() => window.Clicker.state.effects.length"); check(fx == 2, f'兩個持續效果在跑（{fx}）')
    press(2)   # 柴柴打滾
    pg.wait_for_timeout(1500)
    st = pg.evaluate("() => ({ status: document.getElementById('save-status').textContent, retry: !document.getElementById('retry-save').hidden, cd: window.Clicker.state.cooldownUntil, fx: window.Clicker.state.effects.length })")
    print(st)
    check('失敗' not in st['status'], f'存檔狀態：{st["status"]}')
    check(not st['retry'], '「重試儲存」鍵沒出現')
    c0 = pg.evaluate("() => window.Clicker.state.coins"); pg.wait_for_timeout(2500); c1 = pg.evaluate("() => window.Clicker.state.coins")
    check(c1 > c0, f'按完柴柴後幣還在增加（{c0:.3g} → {c1:.3g}）')
    check(not errors, f'無 pageerror {errors[:2]}')
    pg.screenshot(path=str(OUT / 'after-reload.png'))
    b.close()
print('FAILS' if fails else 'ALL OK', fails)
