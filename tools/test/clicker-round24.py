# -*- coding: utf-8 -*-
"""第二十四輪驗收：五張新卡（十一／失望卡哇／快樂海豹／柴柴／膠頭爛額）真的進得了卡冊與技能槽，
以及第七站滅世都市打贏後拿得到 boss-city 徽章。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round24.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
NEW = ['shiyi', 'shiwang', 'seal', 'chaichai', 'jiaolan', 'wanwumythic']   # 第二十五輪追加神話「玩物就玩物」
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 五張新卡全養滿並上槽；bossWins 停在六站，把 city 留給徽章那段自己打
SEED = """() => {
  const E=ClickerEconomy, S=ClickerSave;
  const s=S.fresh(Date.now());
  const ids=Object.keys(ClickerBalance.characters);
  s.collection=Object.fromEntries(ids.map(id=>[id,5]));
  s.skillSlots=['shiyi','jiaolan','seal'];
  s.partnerLevels=Object.fromEntries(ids.map(id=>[id,150]));
  s.trainingLevel=30; s.clickLevel=80;
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge'];
  s.settings.scene='city'; s.package=E.newPackage('city',111);
  s.lifetimeCoins=s.coins=1e16;
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
}"""

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
        pg.evaluate('document.fonts.ready')

        # ---- 一、卡池與技能表對得起來 ----
        info = pg.evaluate("""(ids) => {
          const P=GachaPool, B=ClickerBalance;
          return {
            total:P.CHARACTER_IDS.length, catalog:P.CATALOG.length,
            rows:ids.map(id=>({id, name:P.byId[id]?.name, rarity:P.byId[id]?.rarity,
                               src:P.byId[id]?.src, skill:B.characters[id]?.skill,
                               desc:B.characters[id] && B.characters[id].desc(B.characters[id])})),
            inPool:ids.filter(id=>P.GAME_POLICY.candidates.includes(id)).length};
        }""", NEW)
        check(info['total'] == 52 and info['catalog'] == 58, f"角色 {info['total']} 隻、CATALOG {info['catalog']} 項")   # v3：+ 收藏卡 mohuashaonv（不進池）
        check(info['inPool'] == len(NEW), f"新卡都抽得到（在 GAME_POLICY.candidates 裡的有 {info['inPool']}／{len(NEW)} 張）")
        for row in info['rows']:
            check(bool(row['name'] and row['skill'] and row['src']),
                  f"{row['id']}：{row['name']}・{row['rarity']}・{row['skill']}")
            check('undefined' not in (row['desc'] or 'undefined') and 'NaN' not in (row['desc'] or ''),
                  f"  技能說明讀得通：{row['desc']}")

        # ---- 二、五張卡面在瀏覽器裡都載得起來，沒有破圖 ----
        broken = pg.evaluate("""async (ids) => {
          const out=[];
          for (const id of ids) {
            const im=new Image(); im.src='card-'+id+'.png';
            try { await im.decode(); if(!im.naturalWidth) out.push(id); } catch(e) { out.push(id); }
          }
          return out;
        }""", NEW)
        check(not broken, f"新卡的 card-*.png 都解得開，沒有破圖：{broken or '全部 OK'}")

        # ---- 三、卡冊裡看得到（依稀有度排序，新卡不能被排丟） ----
        pg.locator('#roster-open').click(); pg.wait_for_timeout(500)
        seen = pg.evaluate("""(ids) => {
          const names=[...document.querySelectorAll('#roster img')].map(i=>i.getAttribute('src'));
          return ids.filter(id=>names.includes('card-'+id+'.png'));
        }""", NEW)
        found = list(seen)
        for _ in range(24):        # 神話排在最後（卡冊依稀有度低→高），52 張要翻十幾頁才看得到
            if len(found) == len(NEW): break
            if not pg.locator('#album-next').count(): break
            pg.locator('#album-next').click(); pg.wait_for_timeout(260)
            more = pg.evaluate("""(ids) => {
              const names=[...document.querySelectorAll('#roster img')].map(i=>i.getAttribute('src'));
              return ids.filter(id=>names.includes('card-'+id+'.png'));
            }""", NEW)
            found = sorted(set(found) | set(more))
        check(len(found) == len(NEW), f"翻完卡冊新卡都露臉了：{found}")
        pg.screenshot(path=str(OUT / 'r24-album.png'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

        # ---- 四、技能真的放得出來（十一 11 發、爛額狂點的 trait 有進 D） ----
        trait = pg.evaluate("""() => {
          const E=ClickerEconomy, s=Clicker.state;
          const withJiao=E.rates(s).D;
          const bare={...s, skillSlots:['shiyi', null, 'seal']};
          return {ratio:withJiao/E.rates(bare).D, clickMul:E.skillAt(s,'jiaolan').trait.clickMul};
        }""")
        check(abs(trait['ratio'] - trait['clickMul']) < 1e-6,
              f"爛額狂點的特質有乘進拆包力：D 變成 {trait['ratio']:.4f} 倍（trait.clickMul={trait['clickMul']}）")
        # 種子把五星＋150 級全開了，所以實際發數是升星放大後的值；
        # 「基礎 11 發」由 npm test 的 round24 那條顧，這裡驗的是「發動後的次數 == skillAt 算出來的次數」
        fired = pg.evaluate("""() => {
          const E=ClickerEconomy, s=Clicker.state;
          const want=E.skillAt(s,'shiyi');
          const r=E.activate(s, 0, Date.now());
          const eff=r.state.effects.find(e=>e.source==='shiyi');
          return eff ? {remaining:eff.remaining, mul:eff.multiplier, want:want.charges, base:ClickerBalance.characters.shiyi.charges} : null;
        }""")
        check(bool(fired) and fired['remaining'] == fired['want'] and fired['base'] == 11,
              f"十一連發放得出來：基礎 {fired and fired['base']} 發，滿養後 {fired and fired['remaining']} 發 ×{fired and fired['mul']}")

        # ---- 五、boss-city 徽章：打贏第七站才拿得到 ----
        badge = pg.evaluate("""() => {
          const X=ClickerExtras, S=ClickerSave;
          const all=X.BADGES.map(b=>b.id);
          const before=S.fresh(0); before.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge'];
          const after={...before, bossWins:[...before.bossWins,'city']};
          const b=X.BADGES.find(x=>x.id==='boss-city');
          return {count:all.length, has:all.includes('boss-city'),
                  name:b&&b.name, desc:b&&b.desc, label:b&&b.label,
                  beforeWin:b&&b.test(before), afterWin:b&&b.test(after)};
        }""")
        check(badge['count'] == 19 and badge['has'], f"徽章 {badge['count']} 枚，boss-city 在裡面")
        check(badge['name'] == '滅世珍獸・滅世都市' and badge['label'] == '王7',
              f"徽章名字與標籤：{badge['name']}／{badge['label']}（{badge['desc']}）")
        check(badge['beforeWin'] is False and badge['afterWin'] is True,
              f"打贏前拿不到、打贏後拿得到：{badge['beforeWin']} → {badge['afterWin']}")

        # 徽章牆上真的畫得出來（走 badgeNode 合成 fallback，不能是破圖或空格）
        pg.evaluate("""() => { const s=Clicker.state; s.badges=[...new Set([...(s.badges||[]),'boss-city'])]; }""")
        pg.locator('#stats-open').click(); pg.wait_for_timeout(500)
        wall = pg.evaluate("""() => {
          const cells=[...document.querySelectorAll('#badge-grid .badge-cell')];
          const city=cells.find(c=>(c.title||'').includes('滅世都市'));
          if(!city) return {n:cells.length, found:false};
          const r=city.getBoundingClientRect();
          return {n:cells.length, found:true, earned:city.classList.contains('earned'),
                  w:Math.round(r.width), h:Math.round(r.height),
                  text:(city.querySelector('small')||{}).textContent};
        }""")
        check(wall['found'] and wall['w'] > 20 and wall['h'] > 20,
              f"徽章牆 {wall['n']} 格，滅世都市那格畫得出來（{wall.get('w')}×{wall.get('h')}，字樣「{wall.get('text')}」，已取得={wall.get('earned')}）")
        pg.screenshot(path=str(OUT / 'r24-badges.png'))
        print('截圖 _art/out/r24-album.png ／ r24-badges.png')

        # ---- 六、重切的兩張卡面（2026-09-08 使用者回報） ----
        art = pg.evaluate("""async () => {
          const out={};
          for (const id of ['mieshi','zhenpete']) {
            const im=new Image(); im.src='card-'+id+'.png'; await im.decode();
            out[id]={w:im.naturalWidth, h:im.naturalHeight, ar:+(im.naturalWidth/im.naturalHeight).toFixed(3)};
          }
          const box=document.createElement('div'); box.className='face-art'; document.body.append(box);
          const cs=getComputedStyle(box); out.window={w:parseFloat(cs.width), h:parseFloat(cs.height)};
          box.remove();
          return out;
        }""")
        target = 130/148
        check(abs(art['mieshi']['ar'] - target) < .02,
              f"滅世珍獸已裁成卡面圖窗的比例：{art['mieshi']['w']}×{art['mieshi']['h']}（{art['mieshi']['ar']} vs 圖窗 {target:.3f}）")
        # 珍彼特：橘色底板不該再出現在圖裡
        panel = pg.evaluate("""async () => {
          const im=new Image(); im.src='card-zhenpete.png'; await im.decode();
          const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
          const g=c.getContext('2d'); g.drawImage(im,0,0);
          const d=g.getImageData(0,0,c.width,c.height).data;
          let box=0, opaque=0;
          for (let i=0;i<d.length;i+=4) {
            if (d[i+3]<=8) continue; opaque++;
            if (Math.abs(d[i]-220)<=40 && Math.abs(d[i+1]-150)<=40 && Math.abs(d[i+2]-112)<=40) box++;
          }
          // 四個角落一定要是全透明的（有底板的話角落就是橘色）
          const corner=(x,y)=>d[((y*c.width)+x)*4+3];
          return {ratio:box/opaque, corners:[corner(0,0),corner(c.width-1,0),corner(0,c.height-1),corner(c.width-1,c.height-1)]};
        }""")
        check(all(a == 0 for a in panel['corners']),
              f"珍彼特四個角是透明的、沒有橘色方板：{panel['corners']}")
        # 舊版（整塊橘板還在）量到 41.2%，重切後 6.1%——剩的那些是愛心內部與羊角陰影的真實顏色。
        # 門檻取 15%：底板只要回來就一定破，正常的角色配色不會碰到。
        check(panel['ratio'] < .15,
              f"橘底色殘留只剩 {panel['ratio']:.1%}（舊版是 41.2%；剩的是愛心內部與羊角陰影的真實顏色）")

        check(not errors, f"沒有 JS 錯誤：{errors}")
        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()
