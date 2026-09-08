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
        # 版面決策（2026-09-08 與 Astra 討論後定案）
        lay = pg.evaluate("""() => { const W=document.documentElement.clientWidth, H=document.documentElement.clientHeight;
          const Y=id=>{const e=document.getElementById(id); const r=e.getBoundingClientRect(); return {y:r.y, h:r.height, b:r.bottom};};
          const slot=document.querySelector('.skill-use').getBoundingClientRect();
          const tap=document.getElementById('tap').getBoundingClientRect();
          const foot=[...document.querySelectorAll('footer button')].filter(b=>b.getBoundingClientRect().width>0);
          return { order:['stage-gap','shop','stage-fit','team'].map(id=>+Y(id).y.toFixed(0)),
            team: +Y('team').h.toFixed(0),
            skillCenter: (slot.top+slot.bottom)/2, tapCenter: (tap.top+tap.bottom)/2, H,
            coinsInside: document.getElementById('coins').getBoundingClientRect().right<=W,
            coinsText: document.getElementById('coins').textContent,
            footRows: new Set(foot.map(b=>Math.round(b.getBoundingClientRect().y))).size,
            footIcons: foot.filter(b=>{const i=b.querySelector('img'); return i && getComputedStyle(i).display!=='none';}).length,
            statusShown: getComputedStyle(document.getElementById('completed')).display!=='none' }; }""")
        check(lay['order'] == sorted(lay['order']),
              f"版面順序是 留白 → 升級／招募 → 舞台 → 夥伴（y 座標遞增）：{lay['order']}")
        check(lay['skillCenter'] > lay['H'] * .5 and lay['tapCenter'] > lay['H'] * .45,
              f"拆包鍵與技能槽都落在拇指區（拆包 y={lay['tapCenter']:.0f}、技能 y={lay['skillCenter']:.0f}，畫面高 {lay['H']}）")
        check(lay['team'] == 100,
              f"夥伴列釘死 100px、不再吸收剩餘空間（實測 {lay['team']}；曾經漲到 299 讓中間一大片空白）")
        check(lay['coinsInside'], f"錢包在畫面內（{lay['coinsText']}）——它在橫式是絕對定位的，直式一定要整組解除")
        check(lay['footRows'] == 1 and lay['footIcons'] == 0,
              f"底部五個入口同一條基線、統一成單行文字（{lay['footRows']} 排、{lay['footIcons']} 個圖示）")
        check(lay['statusShown'], '「已拆幾包／下一目標」擺進上方留白，那段不再是空的')
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
        pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
        pg.keyboard.press('Escape')
        pg.wait_for_function("document.getElementById('wardrobe').hidden && !document.getElementById('game-content').inert", timeout=15000)
        pg.wait_for_timeout(400)

        # 技能切入演出：內部是 960×640 的座標系，直式要整塊縮成畫面中央的橫幅才不會被切掉。
        # 這裡驗的是版面規則本身（幾何＋暗底），所以直接套上 data-phase，
        # 不靠真的按技能鍵——「演出跑得起來」由 round22 與舊套件在橫式顧。
        cut = pg.evaluate("""() => { const doc=document.documentElement, c=document.getElementById('cutin');
          c.dataset.phase='hit-stop';
          const r=c.getBoundingClientRect(), cs=getComputedStyle(c);
          const probe=document.createElement('div');
          probe.style.cssText='position:absolute;left:0;top:376px;width:960px;height:60px';
          c.append(probe);
          const p=probe.getBoundingClientRect();
          const out={ inViewport: r.left>=-1 && r.right<=doc.clientWidth+1 && r.top>=-1 && r.bottom<=doc.clientHeight+1,
            w:+r.width.toFixed(0), h:+r.height.toFixed(0),
            fitsWidth: Math.abs(r.width-doc.clientWidth)<2,
            dim: cs.boxShadow.includes('9999px'),
            // 960 座標系裡最靠下的字幕帶（top 376）縮完之後仍要在框內
            barInside: p.bottom<=r.bottom+1 && p.right<=r.right+1 };
          probe.remove(); return out; }""")
        check(cut['inViewport'] and cut['fitsWidth'],
              f"切入演出整塊在畫面內、寬度貼齊螢幕（{cut['w']}×{cut['h']}），不會被切掉")
        check(cut['barInside'],
              '960 座標系裡最靠下的字幕帶（top 376）縮完之後仍在框內——這就是原本被切掉的那一塊')
        check(cut['dim'], '演出中橫幅以外的畫面也壓暗了')
        pg.screenshot(path=str(OUT / 'r31-portrait-cutin.png'))
        pg.evaluate("() => document.getElementById('cutin').removeAttribute('data-phase')")
        pg.wait_for_timeout(200)
        check(not pg.evaluate("getComputedStyle(document.getElementById('cutin')).boxShadow.includes('9999px')"),
              '演出結束後暗底就收掉，不會一直暗著')

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
