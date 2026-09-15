# -*- coding: utf-8 -*-
"""收藏卡（魔花少女）只有精裝版（2026-09-14 使用者：「魔花少女只有精裝版」「收藏卡也只有精裝版」
   「如果有必要 讓1.0顯示精裝版」「他的放大比較2.0的檢視方式 不要外部開HTML」）。

以前：`makeCard()` 只有在末世才回 `deluxeCard()`，1.0 退回平面的 1.0 卡面；
      詳情頁那顆「看精裝版」是 `window.open('apoc/mohuashaonv.html')` 開外部分頁。

第十二輪：收藏卡改成**原生精裝卡面**（ClickerHolo → HoloCardFace，跟 2.0 那 71 張同一條路），
      不再嵌 iframe。使用者：「收藏卡的品質要跟 2.0 的卡冊一樣好」。
      iframe 那條路是模糊、掉 FPS、字型不對的共同根因：150px 寬的 iframe 會用 150px 的版面視口算版再放大。
      兩個世界都一樣，放大走跟末世卡同一個 `#card-zoom` 層。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-collect.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-collect'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
DEEP_GRID = "() => { const deep = el => { if (!el) return ''; let t = el.textContent || ''; el.querySelectorAll('*').forEach(n => { if (n.shadowRoot) t += ' ' + n.shadowRoot.textContent; }); return t.replace(/\\s+/g, ' ').trim(); }; const slot = [...document.querySelectorAll('.album-slot')].find(x => x.querySelector('.card.locked')); if (!slot) return null; return { grid: deep(slot), id: slot.dataset.id }; }"
DEEP_DETAIL = "() => { const deep = el => { if (!el) return ''; let t = el.textContent || ''; el.querySelectorAll('*').forEach(n => { if (n.shadowRoot) t += ' ' + n.shadowRoot.textContent; }); return t.replace(/\\s+/g, ' ').trim(); }; return { h3: (document.querySelector('#album-detail h3') || {}).textContent || '', card: deep(document.querySelector('#album-detail .detail-card')), zoom: deep(document.getElementById('card-zoom')) }; }"
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

# ⚠ 卡面在 shadow root 裡，外面的 querySelector 看不到——一定要穿進 shadowRoot 量。
FACE = """(sel) => {
  const host = document.querySelector(sel + ' .holo-face');
  if (!host || !host.shadowRoot) return { err: '沒有原生卡面' };
  const r = host.shadowRoot, card = r.querySelector('.hcard');
  if (!card) return { err: 'shadow root 裡沒有 .hcard' };
  return {
    rarity: [...card.classList].find(c => c.startsWith('r-')),
    specialCss: /holo-special\.css/.test(host.dataset.holoSheets || '') || [...r.querySelectorAll('link')].some(l => /holo-special\.css/.test(l.href)),
    tint: r.querySelectorAll('.special-tint').length,
    hearts: r.querySelectorAll('.gift-hearts > i').length,
    // ⚠ 「愛心在」不等於「愛心會動」：holo-special.css 有一條 .r-special .gift-hearts>i{animation:none}，
    //   樣式表改成 adoptedStyleSheets 之後它排在 enhance() 注入的 <style> 後面，把 16 顆愛心的動畫全壓死
    //   （線上實測 getAnimations() 全 0、animationName 'none'，一聲不吭）。所以要直接量「有沒有動畫在跑」。
    heartAnims: [...r.querySelectorAll('.gift-hearts > i')].filter(h => h.getAnimations().length > 0).length,
    allAnims: card.getAnimations({ subtree: true }).length,
    name: r.querySelector('.face-name')?.textContent || '',
    iframes: document.querySelectorAll(sel + ' iframe').length,
    plain: !!document.querySelector(sel + ' .character-png'),
  }; }"""

# 已經載進來的替身動作有幾張（穿 shadow root）。2.5 MB／90 幀，卡冊縮圖不准載。
ALT_LOADED = """()=>{ const imgs=[...document.querySelectorAll('img')];
  for (const h of document.querySelectorAll('*')) if (h.shadowRoot) imgs.push(...h.shadowRoot.querySelectorAll('img'));
  return imgs.filter(i=>/collect-alt/.test(i.currentSrc||i.src||'')).length; }"""


def check_album_thumb(pg, world):
    """1.0 的卡冊把收藏卡排在最後一頁。那一格的縮圖點下去是「開詳情」，替身動作根本看不到，
       所以不准為了它拉 2.5 MB 下來（B2）。⚠ 這一格跟收藏卡頁同樣是 .album-slot，
       靠 .collect-slot／#album-detail／#card-zoom 區分，所以這條一定要真的驗。"""
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊|卡冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(1000)
    found = False
    for _ in range(24):
        if pg.evaluate("()=>!!document.querySelector('.album-slot[data-id=\"mohuashaonv\"] .holo-face')"): found = True; break
        pg.evaluate("()=>document.getElementById('album-next')?.click()"); pg.wait_for_timeout(450)
    check(found, f'{world}：卡冊裡找得到收藏卡那一格')
    if found:
        before = pg.evaluate(ALT_LOADED)
        # ⚠ 一定要點 shadow root 裡的 .hcard（處理器掛在那裡）。點 host 不會往下傳，
        #   這條就會變成永遠綠的假驗證——我第一版就是這樣，0 → 0 但其實什麼都沒點到。
        pg.evaluate("()=>document.querySelector('.album-slot[data-id=\"mohuashaonv\"] .holo-face')?.shadowRoot?.querySelector('.hcard')?.click()")
        pg.wait_for_timeout(2500)
        after = pg.evaluate(ALT_LOADED)
        check(after == before, f'{world}：卡冊縮圖不載替身動作（{before} → {after}）')
    for _ in range(3): pg.keyboard.press('Escape'); pg.wait_for_timeout(400)


def run(pg, world):
    # 卡冊 → 收藏卡 → 點開詳情
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊|卡冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(1000)
    co = pg.locator('#collect-open')
    check(not co.is_hidden(), f'{world}：卡冊看得到「收藏卡」入口')
    co.click(); pg.wait_for_timeout(1200)

    # 卡冊格子上的收藏卡就要是原生精裝卡面
    grid = pg.evaluate(FACE, '.collect-page .album-slot')
    check(grid.get('rarity') == 'r-special' and grid.get('hearts') == 16,
          f'{world}：卡冊格子上的收藏卡是原生精裝卡面（{grid}）')
    check(grid.get('heartAnims') == 16 and grid.get('allAnims', 0) > 0,
          f'{world}：卡冊格子上的 16 顆愛心真的在動（heartAnims {grid.get("heartAnims")} / allAnims {grid.get("allAnims")}）')
    check(grid.get('iframes') == 0 and not grid.get('plain'),
          f'{world}：沒有 iframe、也沒有退回 1.0 平面卡面（{grid}）')

    pg.evaluate("() => document.querySelector('.collect-page .album-slot')?.click()")
    pg.wait_for_timeout(1200)
    face = pg.evaluate(FACE, '#album-detail')
    check(face.get('rarity') == 'r-special' and face.get('specialCss') and face.get('name') == '魔花少女',
          f'{world}：詳情頁的收藏卡是原生精裝卡面（{face}）')
    check(face.get('heartAnims') == 16 and face.get('allAnims', 0) > 0,
          f'{world}：詳情頁的 16 顆愛心真的在動（heartAnims {face.get("heartAnims")} / allAnims {face.get("allAnims")}）')

    # 替身動作（2.5 MB／90 幀）：詳情頁點卡片要真的載、真的疊上去（B2 的延遲載入不能把它弄不見）。
    # ⚠ 一定要點 shadow root 裡的 .hcard（處理器在那裡），而且要在**詳情頁**點——
    #   收藏卡頁格子上點下去會冒泡到 .album-slot 那顆按鈕、整張卡被換掉，替身 decode 完發現卡已離開 DOM 就自己釋放了。
    # 2026-09-16：改用**真的滑鼠點**。以前 JS 直接 click .hcard 一直是綠的，但真人點從來觸發不了——
    #   host 按下時 setPointerCapture，click 被重新指派到 host，.hcard 的處理器收不到（朋友回報「不回跳到砍人那張」）。
    #   現在 clicker-holo.js 在 host 上補了「沒拖動的點擊轉給替身」，這條要驗真的點。
    hb = pg.evaluate("() => { const r = document.querySelector('#album-detail .holo-face').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    pg.mouse.click(hb[0], hb[1])
    pg.wait_for_timeout(2500)
    alt = pg.evaluate(ALT_LOADED)
    check(alt >= 1, f'{world}：詳情頁點卡片會載入替身動作（實得 {alt}）')
    check(pg.evaluate("()=>document.querySelector('#album-detail .holo-face')?.shadowRoot?.querySelector('.hcard')?.dataset.face || ''") == 'alt',
          f'{world}：替身動作真的疊上去了（data-face=alt）')

    # 不准有開外部分頁的鍵
    btns = pg.evaluate("() => [...document.querySelectorAll('#album-detail button')].map(b => b.textContent.trim())")
    check('看精裝版' not in btns, f'{world}：詳情頁沒有「看精裝版」那顆開外部 HTML 的鍵（{btns}）')
    zooms = [t for t in btns if '放大' in t]
    check(len(zooms) == 1, f'{world}：詳情頁剛好一顆「放大」鍵，不重複（{btns}）')
    pg.screenshot(path=str(OUT / f'detail-{world}.png'))

    # 放大：走 2.0 的內嵌檢視層，不是新分頁
    before = len(pg.context.pages)
    pg.evaluate("() => [...document.querySelectorAll('#album-detail button')].find(b => /放大/.test(b.textContent)).click()")
    pg.wait_for_timeout(1200)
    check(len(pg.context.pages) == before, f'{world}：按放大**沒有**開新分頁（{before} → {len(pg.context.pages)}）')
    zoom = pg.evaluate(FACE, '#card-zoom')
    check(zoom.get('rarity') == 'r-special' and zoom.get('iframes') == 0,
          f'{world}：放大層裡是原生精裝卡面、沒有 iframe（{zoom}）')
    hint = pg.evaluate("() => document.querySelector('#card-zoom .zoom-hint')?.textContent.trim() || ''")
    check('拖曳轉動' in hint, f'{world}：提示字講的是會動的精裝卡（{hint}）')
    # 可以拿在手上看：interactive() 有掛上去（跟 2.0 那 71 張一樣）
    inter = pg.evaluate("() => !!document.querySelector('#card-zoom .holo-face.holo-interactive')")
    check(inter, f'{world}：放大層的收藏卡可以拖曳轉動（holo-interactive）')
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


def check_mask(pg, world):
    """還沒抽到的卡不准露出名字（使用者 2026-09-14 選「全遮」，而且「放大預覽的部分也要遮」）。
       ⚠ 2.0 的精裝卡面在 shadow root 裡，從外面 textContent 讀不到——要穿進去看，
         不然這條會變成永遠綠的假驗證。"""
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊|卡冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(1100)
    g = pg.evaluate(DEEP_GRID)
    if not g:
        check(False, f'{world}：卡冊裡找得到還沒抽到的卡')
        return
    real = pg.evaluate(f"() => (window.ApocPool||[]).concat(Object.values(GachaPool.byId||{{}})).find(c => c.id === '{g['id']}')?.name || ''")
    check('？？？' in g['grid'], f"{world}：卡冊格子上的未獲得卡是「？？？」（實得 {g['grid'][:24]}）")
    check(real and real not in g['grid'], f"{world}：卡面沒有露出真名「{real}」")

    pg.evaluate("() => document.querySelector('.album-slot .card.locked')?.closest('.album-slot')?.click()")
    pg.wait_for_timeout(900)
    d = pg.evaluate(DEEP_DETAIL)
    check('？？？' in d['h3'], f"{world}：詳情頁標題是「？？？」（實得 {d['h3']}）")
    check(real not in d['card'], f"{world}：詳情頁的大卡沒有露出真名（實得 {d['card'][:24]}）")
    pg.evaluate("() => [...document.querySelectorAll('#album-detail button')].find(b => /放大/.test(b.textContent))?.click()")
    pg.wait_for_timeout(1100)
    d2 = pg.evaluate(DEEP_DETAIL)
    check(d2['zoom'] and real not in d2['zoom'], f"{world}：放大預覽也遮住了（實得 {d2['zoom'][:36]}）")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)

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
        if world == 'home': check_album_thumb(pg, label)   # 收藏卡只在 1.0 的卡冊格子裡出現
        run(pg, label)
        check_mask(pg, label)
        check(not errors, f'{label}：沒有 pageerror：{errors[:2]}')
        ctx.close()
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
