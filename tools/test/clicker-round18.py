# -*- coding: utf-8 -*-
# 第十八輪驗收：平均訓練鍵、縮放比取 0.25 倍數、9-slice 角落乾淨（四種解析度放大圖）
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
def open_page(p, width, height):
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
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled'); pg.wait_for_timeout(900)
    return b, pg, errs
with sync_playwright() as p:
    # 1. 平均訓練
    b, pg, errs = open_page(p, 1280, 860)
    r = pg.evaluate("""() => { const P=window.ClickerPrestige, S=window.ClickerSave; let s=S.fresh(0); s.collection={yueyue2:16,caihua:16,lk:16}; s.partnerLevels={yueyue2:0,caihua:0,lk:10}; s.coins=s.lifetimeCoins=P.trainCost(0,'yueyue2')+P.trainCost(0,'caihua')+P.trainCost(1,'yueyue2')+1;
      const out=P.trainAll(s,0); return [out.levels, out.state.partnerLevels, out.spent]; }""")
    print('   trainAll', r)
    check(r[0] == 3 and r[1]['lk'] == 10 and r[1]['yueyue2'] + r[1]['caihua'] == 3 and min(r[1]['yueyue2'], r[1]['caihua']) >= 1, '低等級先升、輪流買')
    thrown = pg.evaluate("""() => { const P=window.ClickerPrestige, S=window.ClickerSave; let s=S.fresh(0); s.collection={yueyue2:16}; s.coins=1; try { P.trainAll(s,0); return null; } catch(e) { return e.message; } }""")
    check(thrown is not None, f'沒錢會拋錯：{thrown}')
    pg.locator('#roster-open').click(); pg.wait_for_timeout(600)
    btn = pg.locator('#train-all'); check(btn.count() == 1 and '平均訓練' in btn.inner_text(), f"卡冊有平均訓練鍵：{btn.inner_text() if btn.count() else None}")
    before = pg.evaluate("Object.values(window.Clicker.state.partnerLevels||{}).reduce((a,b)=>a+b,0)")
    btn.click(); pg.wait_for_timeout(800)
    after = pg.evaluate("Object.values(window.Clicker.state.partnerLevels||{}).reduce((a,b)=>a+b,0)")
    check(after > before, f'按下後總等級上升 {before} → {after}')
    pg.screenshot(path=str(OUT / 'r18-album.png'))
    check(not errs, f'無 JS 錯誤 {errs[:3]}')
    b.close()
    # 2. 縮放比與角落
    for w, h in [(2560, 1215), (1920, 1080), (1366, 768), (1280, 860)]:
        b, pg, errs = open_page(p, w, h)
        z = pg.evaluate("(()=>{const m=getComputedStyle(document.getElementById('zoomer')).transform; const a=m.match(/matrix\\(([^,]+)/); return a? parseFloat(a[1]) : (parseFloat(document.getElementById('zoomer').style.zoom)||null);})()")
        check(z is not None and abs(z / 0.25 - round(z / 0.25)) < 1e-6, f'{w}×{h} 縮放比 {z} 是 0.25 倍數')
        pg.screenshot(path=str(OUT / f'r18-full-{w}.png'))
        box = pg.locator('#click-one').bounding_box()
        im = Image.open(OUT / f'r18-full-{w}.png')
        x0, y0 = int(box['x']) - 6, int(box['y']) - 6
        crop = im.crop((x0, y0, x0 + 40, y0 + 30)).resize((320, 240), Image.NEAREST); crop.save(OUT / f'r18-corner-{w}.png')
        b.close()
print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAIL')
sys.exit(1 if fails else 0)
