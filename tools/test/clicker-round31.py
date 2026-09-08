# -*- coding: utf-8 -*-
"""第三十一輪驗收：商店是置中的懸浮視窗；直式手機版面。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round31.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave, B=ClickerBalance, E=ClickerEconomy; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,5])); s.partnerLevels=Object.fromEntries(ids.map(i=>[i,40]));
  s.clickLevel=80; s.trainingLevel=20; s.coins=1e14; s.lifetimeCoins=1e15;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.marks=300; s.marksClaimed=900; s.markShop={slot4:true};
  s.skillSlots=['mieshi','qinghua','wanwumythic','zhenmu']; s.slotReadyAt=[0,0,0,0];
  s.owned={wardrobe:Object.entries(B.wardrobe).flatMap(([k,it])=>it.map(i=>k+':'+i.id))};
  s.settings.scene='backyard'; s.package=E.newPackage('backyard',30);
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def open_page(p, w, h, mobile):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2,
                        is_mobile=mobile, has_touch=mobile)
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file():
            r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(),
                  content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html')
    pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED)
    pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled')
    pg.wait_for_timeout(1400)
    return b, pg, errors


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        # ---- 橫式：商店是置中的懸浮視窗 ----
        b, pg, errors = open_page(p, 1280, 860, False)
        pg.locator('#wardrobe-open').click(); pg.wait_for_selector('.shop-cat', timeout=15000)
        pg.wait_for_timeout(600)
        w = pg.evaluate("""() => { const g=document.getElementById('game').getBoundingClientRect(),
            w=document.getElementById('wardrobe').getBoundingClientRect(), cs=getComputedStyle(document.getElementById('wardrobe'));
          return {dx:+((w.left+w.right)/2-(g.left+g.right)/2).toFixed(1),
                  dy:+((w.top+w.bottom)/2-(g.top+g.bottom)/2).toFixed(1),
                  inside: w.left>=g.left-1 && w.right<=g.right+1 && w.top>=g.top-1 && w.bottom<=g.bottom+1,
                  dim: cs.boxShadow.includes('9999px')}; }""")
        check(abs(w['dx']) < 2 and abs(w['dy']) < 2,
              f"商店在遊戲正中央（偏差 x{w['dx']} y{w['dy']}），不是釘在左上角")
        check(w['inside'], '整個視窗都在遊戲畫面內')
        check(w['dim'], '外面有撐滿畫面的暗底，看得出是浮在上層')
        # 進到分類之後內容不可以被切掉
        pg.locator('.shop-cat[data-cat="sounds"]').click(); pg.wait_for_timeout(500)
        fit = pg.evaluate("""() => { const w=document.getElementById('wardrobe').getBoundingClientRect();
          const col=document.querySelector('.wardrobe-col:not([hidden])');
          const items=[...col.querySelectorAll('.wardrobe-item')];
          const hint=document.getElementById('shop-hint').getBoundingClientRect();
          return {n:items.length, allInside: items.every(i=>i.getBoundingClientRect().bottom<=w.bottom+1),
                  hintInside: hint.bottom<=w.bottom+1}; }""")
        check(fit['n'] > 0 and fit['allInside'] and fit['hintInside'],
              f"進到分類後 {fit['n']} 個項目與底部說明都沒有被切掉")
        pg.locator('#game').screenshot(path=str(OUT / 'r31-shop-center.png'))
        check(not errors, f"橫式沒有 JS 錯誤：{errors}")
        b.close()

        # ---- 直式手機 ----
        b, pg, errors = open_page(p, 390, 844, True)
        base = pg.evaluate("""() => { const doc=document.documentElement;
          return {portrait: matchMedia('(max-aspect-ratio: 3/4)').matches,
            scroll: doc.scrollWidth>doc.clientWidth+1 || doc.scrollHeight>doc.clientHeight+1,
            slots: document.querySelectorAll('.skill-slot').length,
            tabs: [...document.querySelectorAll('footer button')].filter(x=>x.getBoundingClientRect().width>0).length,
            wide: [...document.querySelectorAll('#game-content > *')].filter(e=>e.getBoundingClientRect().right>doc.clientWidth+1).map(e=>e.id||e.tagName),
            stageAspect: (()=>{const r=document.getElementById('stage-fit').getBoundingClientRect(); return +(r.width/r.height).toFixed(3);})()}; }""")
        check(base['portrait'], '390×844 會切到直式版面')
        check(not base['scroll'], '整頁不出現捲軸')
        check(base['slots'] == 4, f"技能槽 4 格都排得下（印記商店的 slot4）：{base['slots']} 格")
        check(base['tabs'] == 5, f"底部五個分頁都排得下：{base['tabs']} 個")
        check(not base['wide'], f"沒有元素撐出畫面寬：{base['wide'] or '沒有'}")
        check(abs(base['stageAspect'] - 608/360) < .02,
              f"舞台維持 608:360 的比例（實測 {base['stageAspect']}），內部座標系不用改")
        pg.screenshot(path=str(OUT / 'r31-portrait.png'))

        # 直式的面板是底部推上來
        pg.locator('#wardrobe-open').click(); pg.wait_for_selector('.shop-cat', timeout=15000)
        pg.wait_for_timeout(700)
        sheet = pg.evaluate("""() => { const doc=document.documentElement,
            w=document.getElementById('wardrobe').getBoundingClientRect();
          return {fits: w.left>=-1 && w.right<=doc.clientWidth+1,
                  atBottom: Math.abs(w.bottom-doc.clientHeight)<2,
                  cats: document.querySelectorAll('.shop-cat').length}; }""")
        check(sheet['fits'] and sheet['atBottom'],
              '直式的商店是從底部推上來、貼齊畫面底緣（手機上比置中視窗好按）')
        check(sheet['cats'] == 3, f"分類卡片照樣是三張：{sheet['cats']}")
        pg.screenshot(path=str(OUT / 'r31-portrait-shop.png'))
        check(not errors, f"直式沒有 JS 錯誤：{errors}")
        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()
