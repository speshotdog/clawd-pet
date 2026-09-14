# -*- coding: utf-8 -*-
"""直式（手機）版面回歸（2026-09-14 使用者回報三點）：

① 「手機版本的 UI 沒有很正，字體框突出」
   → `#shop h2`（ID 權重）蓋掉了直式的 `.upgrade h2`，18px 的字塞進 29px 的框，
     膠帶 border-image 上下各吃 10px，字就比粉紅膠帶高、上下戳出來。
② 「點擊特效沒有在點擊區域上」
   → 浮字層與粒子畫布在直式被釘在 (0,0)，而舞台在 y≈376，特效全噴在拆包區（差 376px）。
③ 「神器商店的 UI 呈現方式不友善」
   → 神器卡是 2 欄 ×286px 塞進 350px 的面板，右欄整排被切掉、價格被擠成一字一行。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-portrait.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-portrait'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
ROWS_JS = "() => { const out = []; for (const row of document.querySelectorAll('#shop .upgrade, #shop .recruit')) { const rr = row.getBoundingClientRect(); for (const el of row.querySelectorAll('.purchase > *, h2')) { const cs = getComputedStyle(el); if (cs.display === 'none') continue; const r = el.getBoundingClientRect(); if (r.width < 3) continue; if (r.right > rr.right + 1 || r.left < rr.left - 1 || r.bottom > rr.bottom + 1) out.push({ sel: el.id ? '#'+el.id : el.tagName.toLowerCase(), txt: (el.textContent||'').trim().slice(0,10), out: Math.round(Math.max(r.right - rr.right, rr.left - r.left, r.bottom - rr.bottom)) }); } } const price = [...document.querySelectorAll('#shop .price-ticket b')].map(el => ({ txt: (el.textContent||'').trim(), cut: el.scrollWidth > el.clientWidth + 1 })); return { out, price, doc: document.documentElement.scrollWidth, view: innerWidth }; }"
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy; const s=S.fresh(Date.now());
  s.coins=451; s.lifetimeCoins=5000; s.manualClicks=30; s.packages=3;
  s.collection={yueyue:1}; s.dust={yueyue:1}; s.skillSlots=['yueyue',null,null];
  s.marks=20; s.marksClaimed=20; s.prestiges=1;
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# 字有沒有被自己的膠帶框裝下：框高至少要是行高的 1.3 倍（橫式是 36/24 = 1.5）
H2 = ("() => ['.upgrade h2', '.recruit h2'].map(sel => { const el = document.querySelector(sel); if (!el) return null; "
      "const cs = getComputedStyle(el), r = el.getBoundingClientRect(); "
      "return { sel, fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight), h: r.height, ratio: r.height / parseFloat(cs.lineHeight) }; })")

FX = ("() => { const tap = document.getElementById('tap').getBoundingClientRect(), out = []; "
      "for (const el of document.querySelectorAll('#floaters .floater:not(.passive)')) { "
      "const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue; "
      "out.push(r.left >= tap.left - 4 && r.right <= tap.right + 4 && r.top >= tap.top - 4 && r.bottom <= tap.bottom + 4); } "
      "return { n: out.length, inside: out.filter(Boolean).length, "
      "tap: { t: Math.round(tap.top), b: Math.round(tap.bottom) } }; }")

SHOP = ("() => { const body = document.getElementById('prestige-body').getBoundingClientRect(); "
        "const lists = [...document.querySelectorAll('#prestige-body .mark-list')].map(el => { "
        "const r = el.getBoundingClientRect(); "
        "return { cols: getComputedStyle(el).gridTemplateColumns.split(' ').length, w: Math.round(r.width), "
        "fits: r.right <= body.right + 1 && r.left >= body.left - 1 }; }); "
        "const price = [...document.querySelectorAll('#prestige-body .mark-ticket i')].map(el => { "
        "const r = el.getBoundingClientRect(); return { h: Math.round(r.height), txt: (el.textContent||'').trim() }; }).slice(0, 6); "
        "return { bodyW: Math.round(body.width), lists, price }; }")

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
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
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2200)

    # ---- ① 字框
    for row in pg.evaluate(H2):
        if not row: continue
        check(row['ratio'] >= 1.3, f"{row['sel']} 的框裝得下字（框 {row['h']:.0f}px／行高 {row['lh']:.0f}px＝{row['ratio']:.2f} 倍，要 ≥1.3）")
        check(row['fs'] <= 16, f"{row['sel']} 直式用的是直式字級（實得 {row['fs']:.0f}px——18px 代表被 #shop h2 的 ID 權重蓋掉了）")

    # ---- ② 點擊特效
    box = pg.evaluate("() => { const r=document.getElementById('tap').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }")
    for _ in range(6):
        pg.mouse.click(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2); pg.wait_for_timeout(80)
    pg.wait_for_timeout(120)
    fx = pg.evaluate(FX)
    check(fx['n'] > 0, f'點了之後真的有浮字（{fx}）')
    check(fx['n'] and fx['inside'] == fx['n'], f"點擊浮字全部落在點擊區內（{fx['inside']}/{fx['n']}，點擊區 y {fx['tap']['t']}..{fx['tap']['b']}）")
    pg.screenshot(path=str(OUT / 'click-fx.png'))

    # 版面不能因為特效層而橫向撐開（960×640 的畫布要被 #fx-clip 裁住）
    wide = pg.evaluate("() => ({ doc: document.documentElement.scrollWidth, view: innerWidth })")
    check(wide['doc'] <= wide['view'] + 1, f'特效層沒有把畫面撐出橫向捲動（{wide}）')


    # ---- ④ 升級／招募列在各種手機寬度都塞得下（使用者：「部分手機的UI還是會稍微突出」）
    # 360px 實測過的原因：中間那欄用 1fr（自動最小值＝min-content，而標題 nowrap 不肯縮），
    # 右欄的「五連」鍵就被擠出列外 3px；票根的 min-width 92px 也吃掉購買區一半。
    for w in (320, 360, 375, 393, 412, 430):
        pg.set_viewport_size({'width': w, 'height': 780}); pg.wait_for_timeout(700)
        g = pg.evaluate(ROWS_JS)
        check(not g['out'], f'{w}px：升級／招募列沒有元素戳出列外（{g["out"][:3]}）')
        cut = [p for p in g['price'] if p['cut']]
        check(not cut, f'{w}px：價格沒有被票根的膠帶邊蓋掉（{cut}）')
        check(g['doc'] <= g['view'] + 1, f'{w}px：沒有橫向捲動（{g["doc"]} / {g["view"]}）')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(700)

    # ---- ③ 神器商店
    pg.evaluate("() => document.getElementById('prestige-open').click()"); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='神器與商店', exact=True).click(); pg.wait_for_timeout(800)
    shop = pg.evaluate(SHOP)
    for l in shop['lists']:
        check(l['cols'] == 1, f"神器清單直式是一欄（實得 {l['cols']} 欄，面板寬 {shop['bodyW']}）")
        check(l['fits'], f"神器清單沒有超出面板（寬 {l['w']} / 面板 {shop['bodyW']}）")
    tall = [x for x in shop['price'] if x['h'] > 26]
    check(not tall, f'價格沒有被擠到斷行（每行應 ≤26px 高，實得 {tall}）')
    pg.screenshot(path=str(OUT / 'artifacts.png'))

    check(not errors, f'沒有 pageerror：{errors[:2]}')
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
