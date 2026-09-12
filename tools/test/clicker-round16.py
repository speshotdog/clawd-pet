# -*- coding: utf-8 -*-
# 第十六輪驗收：卡冊箭頭鍵、轉彩（偽裝精良→翻牌轉傳說）、yuelegend 移除、神話星星列／鍍膜修正
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
from PIL import Image
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

    # yuelegend 移除
    check(pg.evaluate("!window.GachaPool.byId.yuelegend && !window.ClickerBalance.characters.yuelegend"), 'yuelegend 已移除')
    # 基準重寫（v3 卡池從 21 隻長到 52 隻）：不再寫死數字，改成「名冊計數＝卡池角色數」這條不變式
    n = pg.evaluate("window.GachaPool.CHARACTER_IDS.length")
    check(n >= 21, f'卡池角色數 {n}')
    check(f'/ {n}' in pg.locator('#owned-count').inner_text(), f"名冊計數 {pg.locator('#owned-count').inner_text()}（卡池 {n}）")

    # 卡冊箭頭鍵
    pg.locator('#roster-open').click(); pg.wait_for_timeout(600)
    book = pg.locator('#album-book').bounding_box(); prev = pg.locator('#album-prev').bounding_box(); nxt = pg.locator('#album-next').bounding_box()
    mid = book['y'] + book['height'] / 2
    check(abs(prev['y'] + prev['height'] / 2 - mid) < 40 and prev['x'] < book['x'] + 60, f'上一頁鍵在左緣中間 {prev}')
    check(abs(nxt['y'] + nxt['height'] / 2 - mid) < 40 and nxt['x'] + nxt['width'] > book['x'] + book['width'] - 60, f'下一頁鍵在右緣中間 {nxt}')
    check(prev['width'] >= 44 and nxt['width'] >= 44, '箭頭鍵夠大')
    check(pg.locator('#album-prev').is_disabled(), '第一跨頁 prev disabled')
    pg.locator('#album-next').click(); pg.wait_for_timeout(500)
    check(pg.locator('#album-page').inner_text().startswith('2 /'), '箭頭翻到第二跨頁')
    # 卡片不與箭頭重疊
    cards = pg.evaluate("[...document.querySelectorAll('#album-book .album-slot')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right]})")
    check(all(c[0] > prev['x'] + prev['width'] - 2 and c[1] < nxt['x'] + 2 for c in cards), '卡片與箭頭不重疊')
    pg.screenshot(path=str(OUT / 'r16-album.png'))
    # 神話展示頁：星星列彩虹條寬度
    # 基準重寫：卡池長到 52 張之後「玥來玥閒」不一定在目前跨頁上，改成翻頁找出任何一張神話
    myth = pg.evaluate("()=>GachaPool.CHARACTER_IDS.find(id=>GachaPool.byId[id].rarity==='mythic' && Clicker.state.collection[id])")
    found = False
    for _ in range(12):
        if pg.locator(f'.album-slot[data-id="{myth}"]').count():
            pg.locator(f'.album-slot[data-id="{myth}"]').first.click(); pg.wait_for_timeout(800); found = True; break
        if pg.evaluate("()=>document.getElementById('album-next').disabled"): break
        pg.eval_on_selector('#album-next', 'el=>el.click()'); pg.wait_for_timeout(450)
    check(found, f'卡冊裡翻得到已擁有的神話卡（{myth}）')
    sw = pg.evaluate("(()=>{const r=document.querySelector('#album-detail .star-row'); if(!r) return null; const b=r.getBoundingClientRect(); const d=document.getElementById('album-detail').getBoundingClientRect(); return [b.width, d.width];})()")
    check(sw and sw[0] < sw[1] * 0.4, f'神話星星列寬度 {sw}')
    pg.screenshot(path=str(OUT / 'r16-detail.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    # 轉彩：強制抽到帶 veil 的傳說
    pg.evaluate("""() => { const P=window.GachaPool, orig=P.rollPack; P.rollPack = (o) => { for (let i=0;i<20000;i++){ const r=orig(o); if (r.draw.entries.some(x=>x.veil)) return r; } return orig(o); }; }""")
    pg.locator('#draw-one').click(); pg.wait_for_timeout(2500)
    veil = pg.evaluate("(window.Clicker.state.pending?.draw?.entries || window.Clicker.state.pending?.entries)?.map(e=>[e.entry.rarity, e.veil||null])")
    print('   pending', veil)
    check(veil and veil[0][1] == 'rare' and veil[0][0] == 'legendary', '抽到轉彩卡（真傳說、偽精良）')
    card = pg.locator('#recruit-layer .card').first
    check('r-rare' in (card.get_attribute('class') or ''), f"翻開前 class 是精良：{card.get_attribute('class')}")
    check(pg.evaluate("window.GachaPool.shownRarity((window.Clicker.state.pending.draw?.entries || window.Clicker.state.pending.entries)[0])") == 'rare', 'shownRarity = rare')
    box = card.bounding_box(); pg.screenshot(path=str(OUT / 'r16-v0.png'))
    pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    classes = []
    for i, t in enumerate([300, 300, 300, 300, 300, 600, 900]):
        pg.wait_for_timeout(t); classes.append(card.get_attribute('class') or ''); pg.screenshot(path=str(OUT / f'r16-v{i+1}.png'))
    print('   classes:', [('rare' if 'r-rare' in c else 'legendary' if 'r-legendary' in c else '?') + ('+unveil' if 'unveil' in c else '') for c in classes])
    check(any('r-rare' in c and 'flipped' in c for c in classes), '翻開後先看到精良框')
    check('r-legendary' in classes[-1] and 'r-rare' not in classes[-1], '最後轉成傳說')
    ims = [Image.open(OUT / f'r16-v{i}.png').crop((300, 120, 980, 720)).resize((340, 300)) for i in range(8)]
    sheet = Image.new('RGB', (340 * 8, 300)); [sheet.paste(im, (i * 340, 0)) for i, im in enumerate(ims)]; sheet.save(OUT / 'r16-veil-seq.png')

    check(not errs, f'無 JS 錯誤 {errs[:3]}')
    b.close()
print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAIL')
sys.exit(1 if fails else 0)
