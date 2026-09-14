# -*- coding: utf-8 -*-
"""A4（2026-09-15 任務書）：印記商店的導線。

2.0 玩家要買第四技能槽／第 4 個派遣位，得先想到那是在 1.0 的「換桌布」面板裡。
所以：
  - 2.0 技能列第四格上鎖時，點它直接開印記商店（#prestige 的「神器與商店」分頁）
  - 2.0 的末世商店多一個「印記商店」區塊，一顆「前往」鍵，同一個結果

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-marks-nav.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-beta'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 沒買 slot4 的 2.0 存檔：末世開著、有隊伍（不然技能格與戰鬥都不會動），markShop 是空的
SEED = """() => { const S = ClickerSave, B = ClickerBalance;
  const s = S.fresh(Date.now());
  const ids = Object.keys(B.characters).slice(0, 8);
  s.collection = Object.fromEntries(ids.map(i => [i, 4])); s.dust = { ...s.collection };
  s.coins = 1e9; s.lifetimeCoins = 1e12; s.manualClicks = 500;
  s.claimedMilestones = ['tutorial50'];
  s.bossWins = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket', 'fridge', 'city'];
  s.marks = 12; s.marksClaimed = 12; s.markShop = {};   // ⚠ 沒買第四技能槽
  s.apoc = { unlocked: true, tutorial: 4, progress: 6, coins: 5e5, tickets: 3 };
  s.settings.world = 'apoc';
  S.validate(s, GachaPool);
  sessionStorage.setItem('test-seed', JSON.stringify(s));
  return { slot4: !!s.markShop.slot4 }; }"""

# 面板現在是不是開在「神器與商店」分頁
TAB = """() => { const p = document.getElementById('prestige');
  const active = [...document.querySelectorAll('#prestige-body .prestige-tabs button')].find(b => b.classList.contains('active'));
  return { open: p && !p.hidden, tab: active ? active.textContent.trim() : null,
    artifacts: document.querySelectorAll('#prestige-body .mark-list.artifacts .artifact').length,
    shop: document.querySelectorAll('#prestige-body .mark-list .mark-ticket:not(.artifact)').length }; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    seed = pg.evaluate(SEED)
    check(seed.get('slot4') is False, f'存檔沒買第四技能槽（{seed}）')
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2200)
    pg.evaluate("() => { const el = document.getElementById('update-notes'); if (el && !el.hidden) document.getElementById('update-notes-close').click(); }")
    pg.wait_for_timeout(300)
    check(pg.evaluate("() => window.Clicker.world"), '在末世（world=apoc）')

    # --- 1) 技能列第四格上鎖 → 點下去直接開印記商店
    locked = pg.evaluate("() => { const b = document.querySelectorAll('#slots .skill-use')[3]; return b ? { locked: !!b.querySelector('.slot-locked'), title: b.title } : null; }")
    check(locked and locked['locked'], f'第四技能格是上鎖狀態（{locked}）')
    pg.evaluate("() => document.querySelectorAll('#slots .skill-use')[3].click()")
    pg.wait_for_timeout(600)
    t = pg.evaluate(TAB)
    check(t['open'], f'點第四格之後 #prestige 面板看得到（{t}）')
    check(t['tab'] == '神器與商店', f'分頁停在「神器與商店」（實得 {t["tab"]}）')
    check(t['artifacts'] > 0 and t['shop'] > 0, f'神器與商店的清單都畫出來了（{t}）')
    pg.screenshot(path=str(OUT / 'marks-nav-slot4.png'))
    pg.evaluate("() => document.getElementById('prestige-close').click()"); pg.wait_for_timeout(400)
    check(pg.evaluate("() => document.getElementById('prestige').hidden"), '關得掉')

    # --- 2) 末世商店的「印記商店」區塊
    pg.evaluate("() => document.getElementById('wardrobe-open').click()"); pg.wait_for_timeout(700)
    shop = pg.evaluate("""() => { const secs = [...document.querySelectorAll('#shop-cats .apoc-shop-sec')].map(s => (s.querySelector('h3') || {}).textContent);
      const btn = document.getElementById('apoc-marks-go');
      return { secs, btn: btn ? btn.textContent.trim() : null }; }""")
    check('印記商店' in (shop['secs'] or []), f'末世商店有「印記商店」區塊（{shop["secs"]}）')
    check(shop['btn'] == '前往', f'區塊裡有一顆「前往」鍵（實得 {shop["btn"]}）')
    pg.screenshot(path=str(OUT / 'marks-nav-shop.png'))
    pg.evaluate("() => document.getElementById('apoc-marks-go').click()"); pg.wait_for_timeout(600)
    t2 = pg.evaluate(TAB)
    check(t2['open'] and t2['tab'] == '神器與商店', f'按「前往」也是開在神器與商店（{t2}）')
    check(pg.evaluate("() => document.getElementById('wardrobe').hidden"), '末世商店面板讓位了（不會兩層疊著）')
    pg.screenshot(path=str(OUT / 'marks-nav-from-shop.png'))

    # --- 3) 派遣位滿的錯誤訊息（純邏輯，直接問經濟層）
    msg = pg.evaluate("""() => { const A = window.ApocEconomy;
      const a = A.normalize({ unlocked: true, collection: { x: 1 }, dispatch: [] });
      const full = { ...a, dispatch: Array.from({ length: A.RULES.DISPATCH.SLOTS }, (_, i) => ({ id: 'd' + i, startedAt: 0, until: A.RULES.DISPATCH.MS })) };
      try { A.startDispatch({ ...full, collection: { x: 1 } }, 'x', 0); return null; } catch (e) { return e.message; } }""")
    check(msg and '印記商店可買第 4 位' in msg, f'派遣位滿的訊息帶到印記商店（實得 {msg}）')

    check(not errors, f'沒有 pageerror：{errors[:2]}')
    ctx.close(); b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
