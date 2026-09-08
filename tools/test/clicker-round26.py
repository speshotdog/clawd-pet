# -*- coding: utf-8 -*-
"""第二十六輪驗收（2026-09-08 使用者回報四項）：
滿花去白邊、滅世珍獸卡面滿版、粉塵罐兌換不跳頁、四張神話都有專屬演出、收下並繼續五連。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round26.py"""
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

SEED = """() => {
  const S=ClickerSave; const s=S.fresh(Date.now());
  const ids=Object.keys(ClickerBalance.characters);
  s.collection=Object.fromEntries(ids.map(id=>[id,5]));
  s.dust=Object.fromEntries(ids.map(id=>[id,10]));
  s.partnerLevels=Object.fromEntries(ids.map(id=>[id,60]));
  s.skillSlots=['yueyuexian','wanwumythic','qinghua'];
  s.clickLevel=60; s.trainingLevel=20; s.coins=1e14; s.lifetimeCoins=5e14;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];   // 過了教學，#tap 才點得出浮字
  s.universalDust=500;
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
}"""

HALO = """async () => {
  const measure = async (src) => {
    const im=new Image(); im.src=src; await im.decode();
    const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    const g=c.getContext('2d'); g.drawImage(im,0,0);
    const d=g.getImageData(0,0,c.width,c.height).data, W=c.width, H=c.height;
    const A=(x,y)=>d[((y*W)+x)*4+3];
    let ring=0, light=0, pure=0;
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++) {
      if (A(x,y)<=8) continue;
      if (A(x+1,y)>8 && A(x-1,y)>8 && A(x,y+1)>8 && A(x,y-1)>8) continue;
      const i=((y*W)+x)*4, m=Math.min(d[i],d[i+1],d[i+2]);
      ring++; if (m>=150) light++; if (m>=235) pure++;
    }
    return {light:light/ring, pure:pure/ring};
  };
  return {manhua: await measure('card-manhua.png'), qipupu: await measure('card-qipupu.png')};
}"""

# GachaCard.art 是 create() 之後的實例才有的，模組本身沒有——所以自己建一份來量
BLEED = """async () => {
  const card = GachaCard.create({ rarity: GachaPool.RARITY, byId: GachaPool.byId,
    canHover: () => false, fatal: document.getElementById('fatal'), tagFor: () => ({text:'',cls:''}) });
  const host=document.createElement('div'); host.style.cssText='position:fixed;left:0;top:0;width:150px;height:210px';
  host.innerHTML='<div class="card-face"><div class="face-art"></div></div>'; document.body.append(host);
  const art=host.querySelector('.face-art'); const out={};
  for (const id of ['mieshi','wanwumythic','qinghua']) {
    art.replaceChildren(card.art.create(GachaPool.byId[id]));
    const img=art.querySelector('img');
    await img.decode().catch(()=>{});
    const a=art.getBoundingClientRect(), i=img.getBoundingClientRect();
    out[id]={cover:+((i.width*i.height)/(a.width*a.height)).toFixed(3), fit:getComputedStyle(img).objectFit};
  }
  host.remove(); return out;
}"""

PICK_BTN = """() => { const l=document.querySelector('.dust-list'); const lb=l.getBoundingClientRect();
  const btns=[...l.querySelectorAll('button[data-dust]')].filter(b=>{ const r=b.getBoundingClientRect();
    return !b.disabled && r.top>lb.top && r.bottom<lb.bottom; });
  return btns.length ? btns[0].dataset.dust : null; }"""


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width': 1280, 'height': 860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file():
                r.fulfill(status=404, body='missing'); return
            body = path.read_bytes()
            if path.name == 'clicker-stage.js':
                body += (chr(10) + 'const createStage=ClickerStage.create; ClickerStage.create=(o)=>(window.testStage=createStage(o));').encode()
            r.fulfill(body=body, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html')
        pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED)
        pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled')

        # ---- 一、滿花：黑描邊外沒有白暈了 ----
        halo = pg.evaluate(HALO)
        check(halo['manhua']['light'] < .25,
              f"滿花的黑描邊外不再有白暈：邊界亮像素只剩 {halo['manhua']['light']:.1%}")
        check(halo['qipupu']['pure'] > .9,
              f"氣噗噗那種「刻意的白色貼紙外框」沒被誤殺：仍有 {halo['qipupu']['pure']:.1%} 純白邊")

        # ---- 二、滅世珍獸卡面鋪滿圖窗 ----
        bleed = pg.evaluate(BLEED)
        for key, name in [('mieshi', '滅世珍獸'), ('wanwumythic', '玩物就玩物')]:
            check(bleed[key]['cover'] >= .99 and bleed[key]['fit'] == 'cover',
                  f"{name}鋪滿圖窗：佔 {bleed[key]['cover']:.0%}、object-fit={bleed[key]['fit']}")
        check(bleed['qinghua']['cover'] < .8 and bleed['qinghua']['fit'] == 'contain',
              f"一般去背角色維持 84%＋contain（青花膠佔 {bleed['qinghua']['cover']:.0%}）")

        # ---- 三之前、推薦組合不可以穿出紙面 ----
        pg.locator('#roster-open').click(); pg.wait_for_timeout(500)
        pg.locator('#recommend-open').click(); pg.wait_for_timeout(500)
        rec = pg.evaluate("""() => { const r=document.getElementById('recommendations'); if(!r) return null;
          const p=document.getElementById('roster').getBoundingClientRect();
          const t=[...r.querySelectorAll('.recommend-ticket')].map(x=>x.getBoundingClientRect());
          return {out:t.filter(x=>x.right>p.right+1||x.left<p.left-1).length, n:t.length,
                  rows:new Set(t.map(x=>Math.round(x.top))).size}; }""")
        check(rec and rec['n'] > 0, f"推薦組合開得起來：{rec and rec['n']} 張票券")
        check(rec and rec['out'] == 0,
              f"四張票券排成 {rec and rec['rows']} 列都在紙面內，沒有穿出去（穿出去的有 {rec and rec['out']} 張）")
        pg.screenshot(path=str(OUT / 'r26-recommend.png'))
        pg.evaluate("() => document.getElementById('recommendations')?.remove()")

        # ---- 三、粉塵罐：兌換後不跳回最上面 ----
        pg.locator('#dust-open').click(); pg.wait_for_timeout(400)
        before = pg.evaluate("""() => { const l=document.querySelector('.dust-list');
          l.scrollTop=Math.floor(l.scrollHeight/2); return l.scrollTop; }""")
        check(before > 0, f"粉塵罐捲得動（捲到 {before}px）")
        target = pg.evaluate(PICK_BTN)
        check(bool(target), f"畫面中段找得到可按的兌換鍵：{target}")
        pg.locator(f'button[data-dust="{target}"]').click(); pg.wait_for_timeout(500)
        after = pg.evaluate("""() => ({ top:document.querySelector('.dust-list').scrollTop,
          focus:document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.dust : null })""")
        check(abs(after['top'] - before) < 8,
              f"兌換後沒有跳回最上面：捲動位置 {before} → {after['top']}")
        check(after['focus'] == target,
              f"焦點還留在剛才按的那顆，可以連按：{after['focus']}")
        pg.screenshot(path=str(OUT / 'r26-dust.png'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(350)

        # ---- 四、四張神話都有專屬演出 ----
        # ⚠ 切入期間 stage 是 frozen，特效會（正確地）整段跳過，直接放會驗出假的 0
        pg.wait_for_function('window.testStage?.running && !window.testStage.frozen', timeout=20000)
        fx = {}
        for src, kind in [('mieshi', 'bossDamage'), ('qinghua', 'team'),
                          ('yueyuexian', 'team'), ('wanwumythic', 'clickAdd')]:
            fx[src] = pg.evaluate("""([src,kind]) => {
              document.querySelectorAll('.mythic-fx').forEach(e=>e.remove());
              testStage.skill({source:src, kind, value:1e9, chain:1});
              return document.querySelectorAll('.mythic-fx').length; }""", [src, kind])
            pg.wait_for_timeout(120)
        for src, name in [('mieshi', '滅世光線'), ('qinghua', '青花綻放'),
                          ('yueyuexian', '躺著也會贏'), ('wanwumythic', '捧在手心')]:
            check(fx[src] > 0, f"{name}（{src}）有專屬演出：{fx[src]} 個 .mythic-fx")
        for src, kind, shot in [('yueyuexian', 'team', 'r26-fx-yueyuexian.png'),
                                ('wanwumythic', 'clickAdd', 'r26-fx-wanwumythic.png')]:
            pg.evaluate("""([src,kind]) => { document.querySelectorAll('.mythic-fx').forEach(e=>e.remove());
              testStage.skill({source:src, kind, value:1e9, chain:1}); }""", [src, kind])
            pg.wait_for_timeout(220); pg.locator('#stage').screenshot(path=str(OUT / shot))
        pg.wait_for_timeout(2200)
        left = pg.evaluate("document.querySelectorAll('.mythic-fx').length")
        check(left == 0, f"演出結束後殘骸歸零（剩 {left} 個）")
        top = pg.evaluate("""() => [...document.querySelectorAll('#slots .skill-use')].map(b=>{
          const r=b.getBoundingClientRect();
          const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return hit===b || b.contains(hit); })""")
        check(all(top), f"技能鍵沒被特效蓋住：{top}")

        # ---- 四之後、卡冊詳細頁不可以重播進場動畫（使用者回報的「卡片抽動／閃一下」） ----
        pg.locator('#roster-open').click(); pg.wait_for_timeout(600)
        pg.evaluate("""() => { window.__log=[]; window.__rec=false;
          const step=()=>{ if(window.__rec){ const c=document.querySelector('.detail-card');
            if(c){ const r=c.getBoundingClientRect();
              window.__log.push({t:performance.now(), w:+r.width.toFixed(1), op:+getComputedStyle(c).opacity}); } }
            requestAnimationFrame(step); }; requestAnimationFrame(step); }""")
        pg.evaluate("window.__rec=true")
        pg.locator('#roster .album-slot').first.click()
        pg.wait_for_timeout(4000)
        pg.evaluate("window.__rec=false")
        log = pg.evaluate("window.__log")
        check(len(log) > 60, f"取到 {len(log)} 個動畫幀")
        t0 = log[0]['t']
        # 進場動畫跑完之後又出現 opacity≈0 的幀 = 整個從頭重播了一次
        restarts = [e for i, e in enumerate(log) if i > 4 and e['op'] < .2]
        check(len(restarts) == 0,
              f"進場動畫沒有被重播（修好前 refresh() 會在 +222ms 把它整個歸零重來）：重播 {len(restarts)} 次")
        tail = [e['w'] for e in log if e['t'] - t0 > 500]
        check(tail and max(tail) - min(tail) < 1,
              f"0.5 秒之後卡片寬度穩定不抖：{min(tail)} ~ {max(tail)}")
        pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(350)

        # ---- 五、收下並繼續五連 ----
        pg.locator('#recruit-open').click(); pg.wait_for_timeout(400)
        pg.locator('#recruit-five').click()
        pg.wait_for_selector('#collect:not([hidden])', timeout=40000)
        again = pg.evaluate("""() => { const b=document.getElementById('collect-again');
          return {hidden:b.hidden, text:b.textContent}; }""")
        check(not again['hidden'], f"抽完的總覽上有「收下並繼續五連」：{again['text']}")
        owned = pg.evaluate("Object.values(Clicker.state.collection).reduce((a,b)=>a+b,0)")
        pg.locator('#collect-again').click()
        pg.wait_for_selector('#collect:not([hidden])', timeout=40000)
        second = pg.evaluate("""() => ({
          layerOpen: !document.getElementById('recruit-layer').hidden,
          entryHidden: document.getElementById('recruit-entry').hidden,
          cards: document.querySelectorAll('#cards .card').length,
          owned: Object.values(Clicker.state.collection).reduce((a,b)=>a+b,0) })""")
        check(second['layerOpen'] and second['entryHidden'],
              "按下去之後人還在招募畫面，不用重開面板")
        check(second['owned'] >= owned + 5,
              f"上一輪那五張真的收下了：{owned} → {second['owned']}")
        check(second['cards'] == 5, f"而且直接抽了新的一輪五連：{second['cards']} 張卡")
        pg.screenshot(path=str(OUT / 'r26-collect-again.png'))
        pg.locator('#collect').click()
        pg.wait_for_function('document.getElementById("recruit-layer").hidden', timeout=20000)
        check(True, "最後正常收下，招募層關得掉（兩輪累積的入隊演出一起補播）")

        check(not errors, f"沒有 JS 錯誤：{errors}")
        print('截圖 _art/out/r26-dust.png ／ r26-fx-*.png ／ r26-collect-again.png')
        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()
