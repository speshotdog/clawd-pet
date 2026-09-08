# -*- coding: utf-8 -*-
"""第二十二輪驗收：第七站滅世都市、整張圖當王的戰鬥畫面、新卡在卡冊裡。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py"""
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
  const E=ClickerEconomy, S=ClickerSave;
  const s=S.fresh(Date.now());
  const ids=Object.keys(ClickerBalance.characters);
  s.collection=Object.fromEntries(ids.map(id=>[id,5]));
  s.skillSlots=['mieshi','yuefeimo','zhenmu'];
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
        ctx = b.new_context(viewport={'width':1280,'height':860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file():
                r.fulfill(status=404, body='missing'); return
            body = path.read_bytes()
            if path.name == 'clicker-stage.js':   # 借 round20 的做法，把 stage 實例掛出來直接放技能演出
                body += (chr(10) + 'const createStage=ClickerStage.create; ClickerStage.create=(opts)=>(window.testStage=createStage(opts));').encode()
            r.fulfill(body=body,
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

        info = pg.evaluate("""() => {
          const Sc=ClickerScenes, s=Clicker.state;
          return {scene:s.settings.scene, name:Sc.city.name, order:Object.keys(Sc),
                  bossName:Sc.city.boss.name, size:Sc.city.boss.size,
                  canBoss:ClickerEconomy.canBoss(s,Date.now()),
                  broken:[...document.querySelectorAll('#clicker-scene img')].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))};
        }""")
        check(info['scene'] == 'city' and info['name'] == '滅世都市', f"人在第七站：{info['name']}")
        check(info['order'][-1] == 'city', f"場景順序最後一個是 city（票券縮圖用 clicker-scene8-thumb.png）：{info['order']}")
        check(not info['broken'], f"場景層沒有破圖：{info['broken']}")
        check(info['canBoss'], "拆滿 110 包後可以挑戰滅世珍獸")
        pg.locator('#stage').screenshot(path=str(OUT / 'r22-city-idle.png'))

        pg.locator('#boss-challenge').click()
        pg.wait_for_function('!!Clicker.state.boss', timeout=10000)
        pg.wait_for_timeout(900)
        boss = pg.evaluate("""() => {
          const img=document.getElementById('boss-image'), v=document.getElementById('boss-view');
          const cs=getComputedStyle(v), b=img.getBoundingClientRect(), stage=document.getElementById('stage').getBoundingClientRect();
          return {src:img.getAttribute('src'), alt:img.alt, broken:img.complete&&img.naturalWidth===0,
                  w:cs.getPropertyValue('--boss-w').trim(), h:cs.getPropertyValue('--boss-h').trim(),
                  coverage:+( (b.width*b.height)/(stage.width*stage.height) ).toFixed(2),
                  need:Clicker.state.boss.need};
        }""")
        check(boss['src'] == 'clicker-boss7-mieshi.png' and not boss['broken'], f"王本體是整張滅世珍獸圖：{boss['src']}")
        check(boss['alt'] == '滅世珍獸', f"王的名字：{boss['alt']}")
        check(boss['coverage'] > .55, f"整張圖幾乎鋪滿版面（佔 {boss['coverage']:.0%}），點哪裡都算打到它")
        pg.locator('#stage').screenshot(path=str(OUT / 'r22-city-boss.png'))

        # 滅世光線：bossDamage 技能要真的砍掉一段血
        hit = pg.evaluate("""() => {
          const before=Clicker.state.boss.dealt, need=Clicker.state.boss.need;
          const share=ClickerEconomy.skillAt(Clicker.state,'mieshi').share;
          return {before,need,share};
        }""")
        pg.locator('.skill-use').first.click()
        pg.wait_for_timeout(600)
        after = pg.evaluate('Clicker.state.boss ? Clicker.state.boss.dealt : null')
        if after is None:
            check(True, "滅世光線一發把王打掉了（傷害 = 血量 × share，已足夠）")
        else:
            gain = (after - hit['before']) / hit['need']
            check(gain >= hit['share'] * .99, f"滅世光線砍掉血量的 {gain:.1%}（skillAt share {hit['share']:.1%}）")
        pg.locator('#stage').screenshot(path=str(OUT / 'r22-city-skill.png'))
        print('截圖 _art/out/r22-city-idle.png ／ r22-city-boss.png ／ r22-city-skill.png')

        # ---- 神話專屬演出（Astra 第二十二輪）：連放三次不留殘骸、技能鍵仍點得到 ----
        # 切入演出期間 stage 是 frozen，神話特效（正確地）會整段跳過，所以要等它解凍再驗
        pg.wait_for_function('window.testStage?.running && !window.testStage.frozen', timeout=20000)
        diag = pg.evaluate("""() => {
          testStage.skill({source:'mieshi', kind:'bossDamage', value:1e12, chain:1});
          return {n:document.querySelectorAll('.mythic-fx').length, running:testStage.running, frozen:testStage.frozen};
        }""")
        for _ in range(2):
            pg.evaluate("() => testStage.skill({source:'mieshi', kind:'bossDamage', value:1e12, chain:1})")
            pg.wait_for_timeout(120)
        peak = max(diag['n'], pg.evaluate("document.querySelectorAll('.mythic-fx').length"))
        check(peak > 0, f"滅世光線演出中畫面上有 {peak} 個 .mythic-fx 元素")
        pg.locator('#stage').screenshot(path=str(OUT / 'r22-mythic-beam.png'))
        pg.evaluate("() => testStage.skill({source:'qinghua', kind:'team', value:1e12, chain:1})")
        pg.wait_for_timeout(260)
        pg.locator('#stage').screenshot(path=str(OUT / 'r22-mythic-bloom.png'))
        pg.wait_for_timeout(1800)
        left = pg.evaluate("document.querySelectorAll('.mythic-fx').length")
        check(left == 0, f"1.8 秒後演出殘骸歸零（剩 {left} 個）")
        # 用 elementFromPoint 驗「點得到」而不是真的按下去：技能剛放完都在冷卻，按鍵是 disabled 的
        top = pg.evaluate("""() => [...document.querySelectorAll('.skill-use')].map(b => {
          const r=b.getBoundingClientRect(), el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
          return el===b || b.contains(el);
        })""")
        check(top and all(top), f"演出之後三顆技能鍵都還在最上層、沒被特效蓋住：{top}")
        print('截圖 _art/out/r22-mythic-beam.png ／ r22-mythic-bloom.png')

        check(not errors, f"沒有 JS 錯誤：{errors[:3]}")
        b.close()
    print('\n全部通過' if not fails else f'\n{len(fails)} 項失敗')
    sys.exit(1 if fails else 0)

main()
