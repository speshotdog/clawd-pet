# -*- coding: utf-8 -*-
"""收藏卡（魔花少女）只有精裝版（2026-09-14 使用者：「魔花少女只有精裝版」「收藏卡也只有精裝版」
   「如果有必要 讓1.0顯示精裝版」「他的放大比較2.0的檢視方式 不要外部開HTML」）。

以前：`makeCard()` 只有在末世才回 `deluxeCard()`，1.0 退回平面的 1.0 卡面；
      詳情頁那顆「看精裝版」是 `window.open('apoc/mohuashaonv.html')` 開外部分頁。

現在：兩個世界的收藏卡都是精裝頁（`?embed=1` 內嵌），放大走跟末世卡同一個 `#card-zoom` 層。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-collect.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-collect'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters).slice(0,8);
  s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e9; s.lifetimeCoins=1e12; s.manualClicks=500; s.packages=200;
  s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.collectibles=['mohuashaonv'];
  s.apoc={unlocked:true,tutorial:4};
  s.settings.world='WORLD';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

FACE = ("() => { const el = document.querySelector('#album-detail .detail-left .card, #album-detail .card'); "
        "if (!el) return null; const f = el.querySelector('iframe'); "
        "return { deluxe: el.classList.contains('deluxe-card'), iframe: f ? f.getAttribute('src') : null, "
        "plain: !!el.querySelector('.character-png') }; }")

def run(pg, world):
    # 卡冊 → 收藏卡 → 點開詳情
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊|卡冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(1000)
    co = pg.locator('#collect-open')
    check(not co.is_hidden(), f'{world}：卡冊看得到「收藏卡」入口')
    co.click(); pg.wait_for_timeout(900)

    # 卡冊格子上的收藏卡就要是精裝版
    grid = pg.evaluate("() => { const el = [...document.querySelectorAll('.album-slot .card')].find(c => c.classList.contains('collect')); "
                       "return el ? { deluxe: el.classList.contains('deluxe-card'), iframe: !!el.querySelector('iframe'), plain: !!el.querySelector('.character-png') } : null; }")
    check(grid and grid['deluxe'] and grid['iframe'], f'{world}：卡冊格子上的收藏卡是精裝版（{grid}）')
    check(grid and not grid['plain'], f'{world}：收藏卡沒有退回 1.0 平面卡面（{grid}）')

    pg.evaluate("() => document.querySelector('.album-slot .card.collect')?.closest('.album-slot')?.click()")
    pg.wait_for_timeout(900)
    face = pg.evaluate(FACE)
    check(face and face['deluxe'] and face['iframe'] and 'embed=1' in face['iframe'],
          f'{world}：詳情頁的收藏卡是內嵌精裝頁（{face}）')

    # 不准有開外部分頁的鍵
    btns = pg.evaluate("() => [...document.querySelectorAll('#album-detail button')].map(b => b.textContent.trim())")
    check('看精裝版' not in btns, f'{world}：詳情頁沒有「看精裝版」那顆開外部 HTML 的鍵（{btns}）')
    zooms = [t for t in btns if '放大' in t]
    check(len(zooms) == 1, f'{world}：詳情頁剛好一顆「放大」鍵，不重複（{btns}）')
    pg.screenshot(path=str(OUT / f'detail-{world}.png'))

    # 放大：走 2.0 的內嵌檢視層，不是新分頁
    before = len(pg.context.pages)
    pg.evaluate("() => [...document.querySelectorAll('#album-detail button')].find(b => /放大/.test(b.textContent)).click()")
    pg.wait_for_timeout(1000)
    check(len(pg.context.pages) == before, f'{world}：按放大**沒有**開新分頁（{before} → {len(pg.context.pages)}）')
    zoom = pg.evaluate("() => { const z = document.getElementById('card-zoom'); if (!z) return null; "
                       "const f = z.querySelector('iframe'); const hint = z.querySelector('.zoom-hint'); "
                       "return { open: true, iframe: f ? f.getAttribute('src') : null, hint: hint ? hint.textContent.trim() : '' }; }")
    check(zoom and zoom['open'], f'{world}：放大層打開了（{zoom}）')
    check(zoom and zoom['iframe'] and 'embed=1' in zoom['iframe'], f'{world}：放大層裡就是那張精裝頁（{zoom}）')
    check(zoom and '拖曳轉動' in zoom['hint'], f'{world}：提示字講的是會動的精裝卡（{zoom and zoom["hint"]}）')
    pg.screenshot(path=str(OUT / f'zoom-{world}.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)


# ---- 字型：精裝卡面的子集不能是空的（2026-09-14 使用者：「字型字體發生什麼事了？」）
# 上游 build_round4_fonts.py 只設 Options.text 沒呼叫 populate()，fontTools 會**安靜**產出
# 996 bytes 的空字型（1 個 glyph、cmap 0 個碼位），頁面不報錯、整頁退回 Arial／微軟正黑。
# 這一段就是擋這個：檔案要有卡名用得到的字，頁面不准再內嵌 data URI。
def check_fonts():
    from fontTools.ttLib import TTFont
    need = '魔花少女特殊'
    for name in ('holo-0.woff2', 'holo-1.woff2'):
        p = SRC / 'apoc' / 'fonts' / name
        check(p.exists(), f'{name} 存在')
        if not p.exists(): continue
        f = TTFont(str(p)); cm = set()
        for t in f['cmap'].tables: cm |= set(t.cmap.keys())
        f.close()
        check(len(cm) > 500, f'{name} 不是空字型（{len(cm)} 個碼位；空字型是 0）')
        miss = [c for c in need if ord(c) not in cm]
        check(not miss, f'{name} 有收藏卡名字用得到的字（缺 {miss}）')
    for p in (SRC / 'apoc').glob('*.html'):
        inline = 'data:font/woff2' in p.read_text(encoding='utf-8')
        check(not inline, f'{p.name} 沒有內嵌字型 data URI（內嵌的那兩份是空的，會蓋掉正確字型）')

check_fonts()

with sync_playwright() as p:
    b = p.chromium.launch()
    for world, label in (('home', '1.0'), ('apoc', '2.0')):
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
        pg.evaluate(SEED.replace('WORLD', world)); pg.reload()
        pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2200)
        run(pg, label)
        check(not errors, f'{label}：沒有 pageerror：{errors[:2]}')
        ctx.close()
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
