# -*- coding: utf-8 -*-
"""匯出／匯入存檔的驗收（2026-09-14 使用者回報「匯入存檔被擋住」）。

根因：戰績／徽章牆面板在桌機是固定高度（`.panel` 的 inset），第十輪加了數字格與 14 個徽章之後，
`#save-io`（文字框＋「檢查／確定覆蓋」）整塊掉到面板底部之外——貼完存檔沒有按鈕可以按。
⚠ `clicker-ui-audit.py` 抓不到桌機這一版：它的「按鈕在畫面外」是拿**視窗**算的，
而桌機是被 `#game` 的縮放框裁掉、按鈕仍在視窗內。所以這裡改成**對面板**判斷。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-saveio.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-saveio'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance,A=ApocEconomy;
  const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120);
  let a=A.normalize({unlocked:true,tutorial:4,progress:10,coins:1e9,tickets:20});
  const pool=window.ApocPool, pick=r=>pool.filter(c=>c.rarity===r).map(c=>c.id);
  const give=(id,n)=>{ for(let k=0;k<n;k++) a=A.addCards(a,[id]); };
  give(pick('rare')[0],30); give(pick('epic')[0],12);
  a.universalDust=500; s.apoc=a; s.settings.world='WORLD';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# 對「面板」判斷，不是對視窗——桌機是被 #game 的縮放框裁掉的
GEOM = ("() => { const p = document.getElementById('stats').getBoundingClientRect(); "
        "const one = id => { const el = document.getElementById(id); if (!el) return null; "
        "const r = el.getBoundingClientRect(); "
        "return { top: Math.round(r.top), bottom: Math.round(r.bottom), "
        "inside: r.bottom <= p.bottom + 1 && r.top >= p.top - 1 }; }; "
        "return { panel: { top: Math.round(p.top), bottom: Math.round(p.bottom) }, "
        "io: one('io-text'), check: one('import-check') }; }")

VIEWS = [('桌機 1280×860', 1280, 860, 'home'), ('桌機・末世', 1280, 860, 'apoc'),
         ('矮螢幕 1024×640', 1024, 640, 'apoc'), ('手機 390×844', 390, 844, 'apoc')]

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, w, h, world in VIEWS:
        ctx = b.new_context(viewport={'width': w, 'height': h})
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
        pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1800)

        pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent)).click()")
        pg.wait_for_timeout(800)
        # 先匯出，拿一串真實長度的存檔字串當待會兒要貼的內容
        pg.click('#io-export'); pg.wait_for_timeout(600)
        text = pg.input_value('#io-text')
        check(len(text) > 200, f'{label}：匯出拿得到存檔字串（{len(text)} 字）')
        g = pg.evaluate(GEOM)
        check(g['io']['inside'], f'{label}：匯出的文字框在面板裡（{g}）')

        pg.click('#io-import'); pg.wait_for_timeout(600)
        pg.fill('#io-text', text); pg.wait_for_timeout(400)
        g = pg.evaluate(GEOM)
        check(g['io']['inside'], f'{label}：匯入的文字框在面板裡（{g}）')
        check(g['check']['inside'], f'{label}：「檢查」鍵在面板裡，按得到（{g}）')

        # 整條流程真的走得完：檢查 → 確定覆蓋
        pg.click('#import-check'); pg.wait_for_timeout(700)
        status = pg.inner_text('#io-status')
        check(status.startswith('存檔 OK'), f'{label}：按「檢查」驗得過（{status[:40]}）')
        check(not pg.locator('#import-confirm').is_hidden(), f'{label}：「確定覆蓋」出現了')
        g2 = pg.evaluate("() => { const p=document.getElementById('stats').getBoundingClientRect(), r=document.getElementById('import-confirm').getBoundingClientRect(); return { inside: r.bottom <= p.bottom + 1 && r.top >= p.top - 1, top: Math.round(r.top), bottom: Math.round(r.bottom), panelBottom: Math.round(p.bottom) }; }")
        check(g2['inside'], f'{label}：「確定覆蓋」也在面板裡（{g2}）')
        pg.screenshot(path=str(OUT / f'{label.split()[0]}-{world}.png'))

        pg.click('#import-confirm'); pg.wait_for_timeout(1500)
        coins = pg.evaluate('() => Clicker.state.coins')
        check(coins > 0, f'{label}：匯入真的覆蓋成功（幣 {coins:.3g}）')
        check(not errors, f'{label}：沒有 pageerror：{errors[:1]}')
        ctx.close()
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
