# -*- coding: utf-8 -*-
"""A5（2026-09-15 任務書）：更新說明面板 ＋ 存檔頁的「複製診斷」。

  - 存檔的 seenNotes 對不上 src/update-notes.js 的 VERSION，載入就彈一次「這次更新改了什麼」；
    按「知道了」寫回 seenNotes，重整不再出現。
  - 徽章牆（統計）的存檔工具列多一顆「複製診斷」：複製一段 JSON（版本／UA／DPR／視窗／
    減少動態／world／末世進度／印記與神器／收藏張數／最近三則提示），不含存檔字串。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-notes.py
"""
import json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-beta'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S = ClickerSave, B = ClickerBalance;
  const s = S.fresh(Date.now());
  const ids = Object.keys(B.characters).slice(0, 6);
  s.collection = Object.fromEntries(ids.map(i => [i, 3])); s.dust = { ...s.collection };
  s.coins = 1e6; s.lifetimeCoins = 1e6; s.manualClicks = 500; s.claimedMilestones = ['tutorial50'];
  delete s.seenNotes;                       // ＝更新說明上線之前就存在的舊存檔（fresh() 現在會直接蓋上目前版本）
  S.validate(s, GachaPool);
  sessionStorage.setItem('test-seed', JSON.stringify(s));
  return { seenNotes: s.seenNotes === undefined ? 'undefined' : s.seenNotes }; }"""

PANEL = """() => { const el = document.getElementById('update-notes');
  return el ? { hidden: el.hidden, title: (document.getElementById('update-notes-title') || {}).textContent,
    items: [...document.querySelectorAll('#update-notes-text li')].map(li => li.textContent) } : null; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    # ⚠ navigator.clipboard 只存在於安全情境（https）；用 http 的話整個 API 是 undefined，
    #   測到的只會是「複製失敗的退路」。這裡走 https + ctx.route 餵檔（沒有真的 TLS）。
    ctx = b.new_context(viewport={'width': 1280, 'height': 860}, ignore_https_errors=True)
    try: ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin='https://clicker.test')
    except Exception as err: print('（剪貼簿權限拿不到：%s）' % err)
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('https://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    print('種子：', pg.evaluate(SEED))
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1800)

    # --- 1) 沒看過就要彈
    v = pg.evaluate("() => window.ClickerUpdateNotes && window.ClickerUpdateNotes.VERSION")
    check(bool(v), f'update-notes.js 有 VERSION（{v}）')
    panel = pg.evaluate(PANEL)
    check(panel is not None and panel['hidden'] is False, f'載入後看得到「這次更新改了什麼」（{panel and panel["hidden"]}）')
    check(panel and len(panel['items']) >= 3, f'面板裡有條列內容（{panel and panel["items"]}）')
    pg.screenshot(path=str(OUT / 'update-notes.png'))

    # --- 2) 按「知道了」→ 寫回 seenNotes，重整不再出現
    pg.evaluate("() => document.getElementById('update-notes-close').click()"); pg.wait_for_timeout(400)
    check(pg.evaluate("() => document.getElementById('update-notes').hidden"), '按了之後面板收起來')
    check(pg.evaluate("() => window.Clicker.state.seenNotes") == v, 'seenNotes 寫回存檔')
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1800)
    again = pg.evaluate(PANEL)
    check(again['hidden'] is True, f'重整之後不再出現（{again["hidden"]}）')

    # --- 3) 複製診斷
    pg.evaluate("() => document.getElementById('stats-open').click()"); pg.wait_for_timeout(600)
    check(pg.evaluate("() => { const b = document.getElementById('io-diag'); return !!b && b.textContent.trim() === '複製診斷'; }"), '存檔工具列有「複製診斷」')
    pg.evaluate("() => document.getElementById('io-diag').click()"); pg.wait_for_timeout(900)
    text = pg.evaluate("() => navigator.clipboard.readText()")
    ok_json, data = True, None
    try: data = json.loads(text)
    except Exception as err: ok_json = False; print('   剪貼簿內容不是 JSON：', repr(text)[:200], err)
    check(ok_json, '剪貼簿裡是一段 JSON')
    if ok_json:
        check('world' in data and data['world'] == 'home', f'診斷含 world（{data.get("world")}）')
        for key in ('ua', 'dpr', 'viewport', 'reducedMotion', 'apoc', 'marks', 'marksClaimed', 'markShop', 'artifacts', 'collection', 'notices', 'version'):
            check(key in data, f'診斷含 {key}')
        check(isinstance(data['notices'], list) and len(data['notices']) <= 3, f'最近三則提示（{data["notices"]}）')
        check('ZMDD1.' not in text, '診斷裡沒有存檔字串')
    check(pg.evaluate("() => document.getElementById('io-text').value.length > 0"), '同一段文字也塞進 #io-text（複製失敗時玩家自己複製）')
    pg.screenshot(path=str(OUT / 'io-diag.png'))
    check(not errors, f'沒有 pageerror：{errors[:2]}')
    ctx.close(); b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
