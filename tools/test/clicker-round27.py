# -*- coding: utf-8 -*-
"""第二十七輪驗收：打贏終點站（第七站滅世都市）之後還換得了場景。
2026-09-08 使用者回報「打完王不能換場景，要重整才可以」。
真兇：勝利字卡那行寫死特判 'fridge'，第七站 city 沒有下一站（r.next 是 undefined），
ClickerScenes[undefined].name 直接丟例外；那段跑在 later() 裡，例外一丟，
後面的 bossBusy=false 就永遠不會執行 → #scene-open 一直是 disabled。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round27.py"""
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

def seed(scene, wins, packages):
    return """() => {
      const E=ClickerEconomy, S=ClickerSave;
      const s=S.fresh(Date.now());
      const ids=Object.keys(ClickerBalance.characters);
      s.collection=Object.fromEntries(ids.map(id=>[id,5]));
      s.partnerLevels=Object.fromEntries(ids.map(id=>[id,150]));
      s.skillSlots=['mieshi','yuefeimo','zhenmu'];
      s.trainingLevel=30; s.clickLevel=80;
      s.bossWins=%s;
      s.settings.scene='%s'; s.package=E.newPackage('%s',%d);
      s.lifetimeCoins=s.coins=1e18;
      S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
    }""" % (wins, scene, scene, packages)

# 直接把王打完：不靠真的點擊（血量是玩家強度的函數，點不完）
WIN = """() => {
  const E=ClickerEconomy;
  const s=E.clone(Clicker.state);
  s.boss.dealt = s.boss.need;
  Clicker.__win(s);
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

        # 兩條路都要驗：中途站（有下一站）與終點站（沒有下一站）
        for scene, wins, packages, label in [
            ('city', "['backyard','kitchen','market','factory','nightmarket','fridge']", 111, '第七站 滅世都市（終點，沒有下一站）'),
            ('backyard', "[]", 55, '第一站 後院（中途站，有下一站）'),
        ]:
            pg = ctx.new_page(); errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.goto('http://clicker.test/clicker.html')
            pg.wait_for_function('window.Clicker?.state')
            pg.evaluate(seed(scene, wins, packages))
            pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled')

            print(f'\n— {label} —')
            check(pg.evaluate("ClickerEconomy.canBoss(Clicker.state, Date.now())"), '  可以挑戰這一站的王')
            pg.locator('#boss-challenge').click()
            pg.wait_for_function('!!Clicker.state.boss', timeout=15000)
            pg.wait_for_timeout(1200)
            # 用 economy 直接結算成勝利，再讓 UI 照常演出
            pg.evaluate("""() => {
              const E=ClickerEconomy;
              const s=E.clone(Clicker.state);
              // v3：王血量是關卡函數，這種滿養種子一秒就打穿；已經贏了就直接拿現況
              if (s.boss) { s.boss.dealt = s.boss.need * 2; window.__finished = E.settle(s, Date.now()).state; } else window.__finished = s;
            }""")
            won = pg.evaluate("""() => {
              const s = window.__finished;
              return {won: !!s.bossResult && s.bossResult.won, scene: s.bossResult && s.bossResult.scene,
                      next: (s.bossResult && s.bossResult.next) ?? null};
            }""")
            check(won['won'], f"  王打贏了（{won['scene']} → 下一站 {won['next'] or '（沒有，這是終點）'}）")
            # 把勝利狀態灌回遊戲，讓勝利字卡與 bossBusy 的收尾真的跑一次
            pg.evaluate("() => { Clicker.state.boss = window.__finished.boss; Clicker.state.bossResult = window.__finished.bossResult; Clicker.state.bossWins = window.__finished.bossWins; }")
            pg.evaluate("() => window.testForceRender && window.testForceRender()")
            pg.wait_for_timeout(4200)     # 字卡 800ms + 停留 1800ms + 滑走 220ms，留足餘裕

            state = pg.evaluate("""() => ({
              errors: window.__pageErrors || [],
              sceneDisabled: document.getElementById('scene-open').disabled,
              banner: document.getElementById('boss-banner').textContent,
              bannerHidden: document.getElementById('boss-banner').hidden,
            })""")
            check(not errors, f"  勝利演出沒有丟例外：{errors}")
            check(not state['sceneDisabled'],
                  f"  打完王之後「場景」鍵還按得下去（不用重整）：disabled={state['sceneDisabled']}")
            pg.screenshot(path=str(OUT / f'r27-after-boss-{scene}.png'))
            pg.close()

        b.close()

    print()
    if fails:
        print(f'{len(fails)} 項未過：')
        for f in fails: print('  - ' + f)
        sys.exit(1)
    print('全部通過')

if __name__ == '__main__':
    main()
