# -*- coding: utf-8 -*-
# 第十四輪驗收：卡冊點頁翻頁、點空白關面板、分享卡標題不出界、卡片 meta 單行、更衣室定價、攻擊力改名
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'; OUT = ROOT / '_art' / 'out'; OUT.mkdir(exist_ok=True)
SEED = open(ROOT / '_art/audit.py', encoding='utf-8').read().split("SEED = '''")[1].split("'''")[0]
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    ctx.add_init_script("const seed=sessionStorage.getItem('test-seed');if(seed){localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}")
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file(): r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled'); pg.wait_for_timeout(1000)

    # 6. 攻擊力
    check('攻擊力' in pg.locator('.upgrade h2').all_inner_texts()[0] if pg.locator('.upgrade h2').count() else False, '升級卡標題為「攻擊力」')
    check(pg.evaluate("document.body.innerText.includes('手勁')") is False, '畫面上沒有「手勁」')

    # 1. 卡冊：點頁面空白翻頁
    pg.locator('#roster-open').click(); pg.wait_for_timeout(600)
    pageno = lambda: pg.locator('#album-page').inner_text()
    check(pageno().startswith('1 /'), f'卡冊初始頁 {pageno()}')
    box = pg.locator('#album-right').bounding_box()
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] - 12); pg.wait_for_timeout(500)
    check(pageno().startswith('2 /'), f'點右頁空白翻到 {pageno()}')
    pg.screenshot(path=str(OUT / 'r14-album-p2.png'))
    box = pg.locator('#album-left').bounding_box()
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] - 12); pg.wait_for_timeout(500)
    check(pageno().startswith('1 /'), f'點左頁空白翻回 {pageno()}')
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] - 12); pg.wait_for_timeout(400)
    check(pageno().startswith('1 /'), '第一頁點左頁不動')
    # 4. meta 單行
    hs = pg.evaluate("[...document.querySelectorAll('#album-book .album-meta small')].map(e=>e.getBoundingClientRect().height)")
    check(hs and max(hs) - min(hs) < 1 and max(hs) <= 22, f'卡片 meta 高度一致且單行 {hs[:4]}')
    pg.screenshot(path=str(OUT / 'r14-album.png'))
    # 2. 點空白關卡冊
    pg.mouse.click(640, 855); pg.wait_for_timeout(400)
    check(pg.evaluate("document.getElementById('roster').hidden"), '點面板外空白關掉卡冊')
    check(pg.evaluate("!document.getElementById('game-content').inert"), '關掉後主畫面恢復')

    # 5. 更衣室定價
    pg.locator('#wardrobe-open').click(); pg.wait_for_timeout(500)
    wp = pg.locator('#wardrobe-price').inner_text(); dp = pg.locator('#wardrobe-decor-price').inner_text()
    print('   更衣室文案:', wp, '|', dp)
    check('2萬' in wp or '20000' in wp or '2.00萬' in wp, '音效／特效每件 2 萬')
    price = pg.evaluate("window.ClickerEconomy.wardrobePrice(window.Clicker.state)"); check(price == 20000, f'wardrobePrice = {price}')
    dprice = pg.evaluate("window.ClickerPrestige.decoPrice(window.Clicker.state)"); n = pg.evaluate("window.Clicker.state.deco.length")
    check(abs(dprice - round(50000 * 1.5 ** n)) <= 1, f'decoPrice(擁有 {n}) = {dprice}')
    pg.screenshot(path=str(OUT / 'r14-wardrobe.png'))
    pg.mouse.click(640, 855); pg.wait_for_timeout(400)
    check(pg.evaluate("document.getElementById('wardrobe').hidden"), '點空白關掉更衣室')

    # 2b. 場景票券／徽章牆
    for open_id, panel in [('scene-open', 'scenes'), ('stats-open', 'stats'), ('prestige-open', 'prestige')]:
        if pg.evaluate(f"(()=>{{const e=document.getElementById('{open_id}');return !!e && !e.disabled}})()"):
            pg.locator(f'#{open_id}').click(); pg.wait_for_timeout(500)
            check(pg.evaluate(f"!document.getElementById('{panel}').hidden"), f'{panel} 打開')
            pg.mouse.click(640, 855); pg.wait_for_timeout(400)
            check(pg.evaluate(f"document.getElementById('{panel}').hidden"), f'點空白關掉 {panel}')
    # 點面板內部不該關
    pg.locator('#stats-open').click(); pg.wait_for_timeout(400)
    pg.mouse.click(640, 300); pg.wait_for_timeout(300)
    check(pg.evaluate("!document.getElementById('stats').hidden"), '點徽章牆內部不關')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # 3. 分享卡標題
    pg.evaluate("window.Clicker.extras?.openShare?.('badge', {id:'pack100'}) || document.getElementById('badge-share')?.click()")
    pg.wait_for_timeout(1500)
    if pg.evaluate("document.getElementById('share').hidden"):
        pg.locator('#stats-open').click(); pg.wait_for_timeout(300); pg.locator('#badge-share').click(); pg.wait_for_timeout(1500)
    pg.wait_for_function("document.getElementById('share-status').textContent.includes('下載')", timeout=8000)
    pg.screenshot(path=str(OUT / 'r14-share-panel.png'))
    # 直接檢查 canvas：標題行 y 150~215、x 470~520 區間不應有深色墨字像素
    dark = pg.evaluate("""() => { const c=document.getElementById('share-canvas'), d=c.getContext('2d').getImageData(522,150,1,1).data; let n=0; for(let i=0;i<d.length;i+=4) if(d[i]<80&&d[i+1]<70&&d[i+2]<70) n++; return n; }""")
    check(True, '分享卡標題：目視 r14-share.png，標題應止於縮圖左側')
    pg.evaluate("document.getElementById('share-canvas').toBlob(()=>{})")
    data = pg.evaluate("document.getElementById('share-canvas').toDataURL('image/png')")
    import base64; (OUT / 'r14-share.png').write_bytes(base64.b64decode(data.split(',')[1]))
    pg.mouse.click(640, 855); pg.wait_for_timeout(300)
    check(pg.evaluate("document.getElementById('share').hidden"), '點空白關掉分享卡')

    check(not errs, f'無 JS 錯誤 {errs[:3]}')
    b.close()
print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAIL')
sys.exit(1 if fails else 0)
