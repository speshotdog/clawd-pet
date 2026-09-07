# -*- coding: utf-8 -*-
# 第十七輪驗收：冰箱 100 包門檻、新卡 2.0、卡冊排序、印記商店四項、電動手指上限、更衣室欄寬、標題帶內距、音量面板百分比、零食小偷
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
def run(width, height, tag):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width': width, 'height': height})
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
        if tag == 'main':
            # 新卡與排序
            check(pg.evaluate("window.GachaPool.CHARACTER_IDS.length") == 25, '角色 25 隻')
            check(pg.evaluate("['jiaotou','jinggou','gebugou','zhenjpg'].every(id=>window.GachaPool.byId[id]&&window.ClickerBalance.characters[id])"), '四張新卡在目錄與數值表')
            check(pg.evaluate("window.ClickerBalance.characters.jiaotou.trait?.clickMul === 1.5"), '膠頭燃額 trait clickMul 1.5')
            check(pg.evaluate("window.ClickerBalance.autoClickMax") == 10, '電動手指上限 10')
            check(pg.evaluate("['finger14','bossTime','offline15','daily2'].every(id=>window.ClickerBalance.marks.some(m=>m.id===id))"), '印記商店四項')
            pg.locator('#roster-open').click(); pg.wait_for_timeout(600)
            order = []
            for i in range(8):
                order += pg.evaluate("[...document.querySelectorAll('#album-book .album-slot')].map(e=>({rare:0,epic:1,legendary:2,mythic:3})[window.GachaPool.byId[e.dataset.id]?.rarity])")
                if pg.locator('#album-next').is_disabled(): break
                pg.locator('#album-next').click(); pg.wait_for_timeout(700)
            pg.wait_for_timeout(600)
            check(order and all(order[i] <= order[i+1] for i in range(len(order)-1)) and len(order) >= 25, f'卡冊依稀有度低→高（{len(order)} 張）')
            pg.screenshot(path=str(OUT / 'r17-album-last.png'))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
            # 音量面板
            pg.locator('#audio-toggle').click(); pg.wait_for_timeout(300)
            pct = pg.evaluate("[...document.querySelectorAll('#audio-panel output')].map(o=>o.textContent)")
            check(len(pct) == 2 and all('%' in t or '靜音' in t for t in pct), f'音量百分比 {pct}')
            pg.evaluate("const i=document.getElementById('music-volume'); i.value=.25; i.dispatchEvent(new Event('input',{bubbles:true}))"); pg.wait_for_timeout(200)
            check(pg.evaluate("[...document.querySelectorAll('#audio-panel output')][0].textContent") == '25%', '拖動後百分比更新 25%')
            w = pg.locator('#audio-panel').bounding_box(); check(w and w['width'] >= 200, f'音量面板寬 {w and w["width"]}')
            pg.screenshot(path=str(OUT / 'r17-audio.png'), clip={'x': w['x']-260, 'y': w['y']-70, 'width': w['width']+300, 'height': w['height']+100})
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
            # 標題帶內距
            over = pg.evaluate("""[...document.querySelectorAll('#shop h2, .buddy-header h2, .skills-heading')].map(h=>{const r=h.getBoundingClientRect(); const range=document.createRange(); range.selectNodeContents(h); const t=range.getBoundingClientRect(); return [h.textContent.trim().slice(0,6), Math.round(t.left-r.left), Math.round(r.right-t.right)];})""")
            print('   標題帶內距', over)
            check(all(o[1] >= 6 and o[2] >= 6 for o in over), '標題帶文字兩側至少 6px')
            # 冰箱王 100 包
            r = pg.evaluate("""() => { const E=window.ClickerEconomy, S=window.ClickerSave; let s=S.fresh(0); s.coins=s.lifetimeCoins=1e9; s.collection={yueyue2:16}; s.settings.scene='fridge'; s.bossWins=['backyard','kitchen','market','factory','nightmarket']; s.package.index=100; const a=E.canBoss(s,1000); s.package.index=101; const b=E.canBoss(s,1000); return [a,b]; }""")
            check(r[0] is False and r[1] is True, f'冰箱拆滿 99 包不可挑戰、100 包可挑戰 {r}')
            check(not errs, f'無 JS 錯誤 {errs[:3]}')
        # 更衣室欄寬（兩種解析度）
        pg.locator('#wardrobe-open').click(); pg.wait_for_timeout(500)
        cols = pg.evaluate("[...document.querySelectorAll('.wardrobe-col')].map(c=>Math.round(c.getBoundingClientRect().width))")
        wrap = pg.evaluate("[...document.querySelectorAll('#wardrobe-decor .wardrobe-item')].map(e=>e.querySelector('small').getBoundingClientRect().height / e.querySelector('b').getBoundingClientRect().height)")
        check(cols and max(cols) - min(cols) < 8, f'{tag} 更衣室三欄等寬 {cols}')
        check(wrap and max(wrap) <= 1.3, f'{tag} 「已放上桌」單行（狀態／名稱高度比 {round(max(wrap),2) if wrap else None}）')
        pg.screenshot(path=str(OUT / f'r17-wardrobe-{tag}.png'))
        b.close()
run(1280, 860, 'main')
run(2560, 1215, 'wide')
print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAIL')
sys.exit(1 if fails else 0)
