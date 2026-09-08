# -*- coding: utf-8 -*-
"""第三十輪驗收（2026-09-08 使用者定案四項）：
粉塵兌換改遞增價、更衣室改成兩層商店、桌面裝飾預設不擺、前兩站換成會動的怪。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round30.py"""
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

SEED = """() => { const S=ClickerSave, E=ClickerEconomy, B=ClickerBalance;
  const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,5]));
  s.partnerLevels=Object.fromEntries(ids.map(i=>[i,30]));
  s.clickLevel=60; s.trainingLevel=15; s.coins=1e12; s.lifetimeCoins=1e13;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.marks=500; s.marksClaimed=500;
  s.deco=B.decor.slice(0,4).map(d=>d.id);   // 買了四件，但預設一件都不擺
  s.owned={wardrobe:['sounds:soft','fx:shard']};
  s.settings.scene='backyard'; s.package=E.newPackage('backyard',55);
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width': 1280, 'height': 860})
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

        # ---- 一、桌面裝飾：買了但預設不擺 ----
        deco = pg.evaluate("""() => ({owned: Clicker.state.deco.length,
          shown: (Clicker.state.decoShown||[]).length,
          onStage: document.querySelectorAll('#clicker-scene .deco, .deco').length,
          mul: ClickerEconomy.decoMul(Clicker.state)})""")
        check(deco['owned'] == 4 and deco['shown'] == 0,
              f"買了 {deco['owned']} 件裝飾，預設擺出來 {deco['shown']} 件")
        check(deco['onStage'] == 0, f"桌上一件都沒畫出來（畫面不會變亂）：{deco['onStage']} 件")
        check(abs(deco['mul'] - 1.04) < 1e-9,
              f"但 +1%／件的加成照算（買了 4 件 → ×{deco['mul']:.2f}）")

        # ---- 二、商店：兩層 UI ----
        pg.locator('#wardrobe-open').click(); pg.wait_for_timeout(500)
        cats = pg.evaluate("""() => ({title: document.getElementById('shop-title').textContent,
          catsShown: !document.getElementById('shop-cats').hidden,
          bodyShown: !document.getElementById('wardrobe-body').hidden,
          backShown: !document.getElementById('shop-back').hidden,
          n: document.querySelectorAll('.shop-cat').length,
          labels: [...document.querySelectorAll('.shop-cat b')].map(e=>e.textContent)})""")
        check(cats['title'] == '商店', f"面板標題是「{cats['title']}」")
        check(cats['catsShown'] and not cats['bodyShown'] and not cats['backShown'],
              '一進來是分類頁，內容與「回到分類」都收著')
        check(cats['n'] == 3, f"三個分類：{cats['labels']}")

        pg.locator('.shop-cat[data-cat="decor"]').click(); pg.wait_for_timeout(400)
        inside = pg.evaluate("""() => ({title: document.getElementById('shop-title').textContent,
          catsShown: !document.getElementById('shop-cats').hidden,
          backShown: !document.getElementById('shop-back').hidden,
          visibleCols: [...document.querySelectorAll('.wardrobe-col')].filter(c=>!c.hidden).map(c=>c.dataset.cat),
          items: document.querySelectorAll('#wardrobe-decor .wardrobe-item').length})""")
        check(inside['title'] == '桌面裝飾' and not inside['catsShown'] and inside['backShown'],
              f"點進分類後只看到該分類：標題「{inside['title']}」、有回到分類鍵")
        check(inside['visibleCols'] == ['decor'], f"只有裝飾那一欄是顯示的：{inside['visibleCols']}")
        check(inside['items'] > 0, f"裝飾清單有 {inside['items']} 件")

        # ---- 三、擺出來／收起來的切換 ----
        first = pg.locator('#wardrobe-decor .wardrobe-item').first
        before = pg.evaluate("first => document.querySelector('#wardrobe-decor .wardrobe-item small').textContent", None)
        first.click(); pg.wait_for_timeout(450)
        after = pg.evaluate("""() => ({shown:(Clicker.state.decoShown||[]).length,
          onStage: document.querySelectorAll('.deco').length,
          label: document.querySelector('#wardrobe-decor .wardrobe-item small').textContent})""")
        check(after['shown'] == 1, f"按一下就擺出來了：decoShown {after['shown']} 件（標籤「{before}」→「{after['label']}」）")
        first.click(); pg.wait_for_timeout(450)
        back = pg.evaluate("({shown:(Clicker.state.decoShown||[]).length, onStage:document.querySelectorAll('.deco').length})")
        check(back['shown'] == 0, f"再按一下就收起來：decoShown {back['shown']} 件")
        pg.screenshot(path=str(OUT / 'r30-shop-decor.png'))

        # Esc 先退回分類頁，再按一次才關商店
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        step1 = pg.evaluate("({wardrobe: document.getElementById('wardrobe').hidden, cats: !document.getElementById('shop-cats').hidden})")
        check(not step1['wardrobe'] and step1['cats'], 'Esc 第一次退回分類頁，商店還開著')
        pg.screenshot(path=str(OUT / 'r30-shop-cats.png'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        check(pg.evaluate("document.getElementById('wardrobe').hidden"), 'Esc 第二次才關掉商店')

        # ---- 四、粉塵兌換遞增價 ----
        price = pg.evaluate("""() => { const P=ClickerPrestige, s=Clicker.state;
          const before = P.dustTradeCost(s,1);
          const t = P.tradeDust(s,1,Date.now());
          return {first: before, dust: t.universalDust, trades: t.dustTrades,
                  next: P.dustTradeCost(t,1), ten: P.dustTradeCost(s,10),
                  mythic: P.dustTradeCost(s,320)}; }""")
        check(price['first'] == 1 and price['next'] == 2,
              f"第 1 次 {price['first']} 印記、第 2 次 {price['next']} 印記（會遞增）")
        check(price['dust'] == 5 and price['trades'] == 1,
              f"一次換 {price['dust']} 粉塵，兌換次數記到 {price['trades']}")
        check(price['ten'] == 55, f"一口氣換 10 次要 {price['ten']} 印記（1+2+…+10）")
        check(price['mythic'] == 320 * 321 // 2,
              f"湊滿一張神話（320 次）要 {price['mythic']} 印記（舊制固定價只要 320）")

        # ---- 五、前兩站的王換成會動的怪 ----
        pg.wait_for_function('!document.getElementById("boss-challenge").hidden', timeout=20000)
        pg.locator('#boss-challenge').click()
        pg.wait_for_function('!!Clicker.state.boss', timeout=15000)
        pg.wait_for_timeout(1200)
        boss = pg.evaluate("""() => { const img=document.getElementById('boss-image'), cs=getComputedStyle(img);
          return {alt: img.alt, sprite: img.classList.contains('sprite'),
                  bg: cs.backgroundImage, size: cs.backgroundSize,
                  anim: cs.animationName, frames: cs.getPropertyValue('--boss-frames').trim(),
                  broken: img.complete && img.naturalWidth === 0}; }""")
        check(boss['alt'] == '啄包怪鳥' and boss['sprite'],
              f"後院的王是「{boss['alt']}」，走 sprite 模式")
        check('clicker-monster-bird.png' in boss['bg'], f"背景是鳥的 strip：{boss['bg'][-40:]}")
        check(boss['anim'] == 'boss-frames' and boss['frames'] == '4',
              f"用 steps() 逐幀播：animation={boss['anim']}、frames={boss['frames']}")
        check('400%' in boss['size'], f"background-size 放大成 4 倍寬：{boss['size']}")
        pg.locator('#stage').screenshot(path=str(OUT / 'r30-boss-bird.png'))

        # 中後期的站仍然是靜態罐子（boss() 展開繼承時要把 sprite 清掉，否則會沿用鳥的動畫）
        still = pg.evaluate("""() => { const S=ClickerScenes;
          return Object.fromEntries(['backyard','kitchen','market','factory','nightmarket','fridge','city']
            .map(id=>[id, S[id].boss.sprite || null])); }""")
        check(still['backyard'] and still['kitchen'], f"前兩站有 sprite：{still['backyard']}／{still['kitchen']}")
        check(all(not still[k] for k in ['market','factory','nightmarket','fridge','city']),
              f"其餘各站仍是靜態圖，沒有沿用到鳥的動畫：{ {k:still[k] for k in ['market','factory','nightmarket','fridge','city']} }")

        # ---- 六、每一站的王都要放得進舞台（寬王最容易超出右緣） ----
        fit = pg.evaluate("""() => { const S=ClickerScenes;
          const st=document.getElementById('stage'), z=new DOMMatrix(getComputedStyle(document.getElementById('zoomer')).transform).a;
          const W=st.getBoundingClientRect().width / z;
          const out={};
          for (const [id,sc] of Object.entries(S)) {
            const bw=(sc.boss.size && sc.boss.size[0]) || 260, cx=sc.boss.center || 460;
            // 寬度 >=600 的王走 .full-board（第二十二輪的設計：整張畫鋪滿版面當王本體），
            // 本來就該超出這個框，不列入檢查
            if (bw >= 600) continue;
            out[id]={left:+(cx-bw/2).toFixed(0), right:+(cx+bw/2).toFixed(0), ok:(cx-bw/2)>=0 && (cx+bw/2)<=W};
          }
          return {W:+W.toFixed(0), out}; }""")
        bad = {k: v for k, v in fit['out'].items() if not v['ok']}
        check(not bad, f"每個王都在舞台（寬 {fit['W']}）內（鋪滿版面的滅世都市除外）：出界的有 {bad or '沒有'}")

        check(not errors, f"沒有 JS 錯誤：{errors}")
        print('截圖 _art/out/r30-shop-cats.png ／ r30-shop-decor.png ／ r30-boss-bird.png')
        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()
