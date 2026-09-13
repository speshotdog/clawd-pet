# -*- coding: utf-8 -*-
"""第二十一輪驗收：被動浮字改「同一欄疊起來」、冰箱王血量下限收成 0.3（打得贏）。
route src，不 build、不啟動 server。用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py"""
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

def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width':1280,'height':860})
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

        # ---- 冰箱王：血量要跟著玩家的 30 秒容量走，不再被 1.0e11 的下限綁死 ----
        boss = pg.evaluate("""() => {
          const E=ClickerEconomy, S=ClickerSave, Sc=ClickerScenes;   // 瀏覽器端 ClickerScenes 就是場景表本身
          const s=S.fresh(Date.now());
          s.collection={zhenmu:5,yueyue2:5,lk:5,yang:5,dog:5,fox:5};
          s.skillSlots=['zhenmu','yueyue2','lk']; s.trainingLevel=24; s.clickLevel=60;
          s.partnerLevels=Object.fromEntries(Object.keys(s.collection).map(id=>[id,118]));
          s.bossWins=['backyard','kitchen','market','factory','nightmarket'];
          s.settings.scene='fridge'; s.package=E.newPackage('fridge'); s.package.index=101;
          s.lifetimeCoins=s.coins=1e12;
          S.validate(s,GachaPool);
          const r=E.rates(s), cap=30*r.P+180*r.D;
          const cfg=Sc.fridge.boss;
          const st=E.startBoss(s,s.settledAt);
          return {need:st.boss.need, cap, floorMul:cfg.floorMul, mul:cfg.mul, k:ClickerBalance.V3.BOSS_K.fridge ?? ClickerBalance.V3.BOSS_MUL,
                  floorRaw:E.requirement(101,'fridge'), regen:Sc.fridge.enemy.regen};
        }""")
        need, cap, floor = boss['need'], boss['cap'], boss['floorRaw'] * boss['floorMul']
        check(boss['floorMul'] == .3, f"冰箱王下限係數 floorMul=0.3（實際 {boss['floorMul']}）")
        # v3：王血量改成關卡函數 K×門檻包需求×站係數（不再讀 P／D）
        k = boss['k']
        check(abs(need - k * boss['floorRaw'] * boss['mul']) / need < 1e-9,
              f"血量＝K {k}×門檻包需求 {boss['floorRaw']:.3e}×係數 {boss['mul']} = {need:.3e}（不再跟玩家火力掛鉤）")
        check(floor < boss['floorRaw'] * .5,
              f"下限從 {boss['floorRaw']:.3e} 收成 {floor:.3e}（舊值高於任何玩家到得了的 30 秒容量＝永遠打不贏）")

        # 模擬器實測的「剛走到冰箱第 100 包」玩家：P=8.55e8、D=4.28e7（node tools/sim/clicker-curve.js）
        # 30 秒容量 cap0＝30P+180D；連點＋技能約打得出 1.36×cap0；回升 1%/s×30 秒＝0.3×血量
        cap0 = 30 * 8.55e8 + 180 * 4.28e7
        need0 = max(floor, boss['mul'] * cap0)
        check(abs(need0 - boss['mul'] * cap0) < 1, f"到站玩家的血量由容量決定（{need0:.3e}），下限不再綁死")
        nets = {'純放置': 30 * 8.55e8, '連點不用技': 1.0 * cap0, '連點＋技能': 1.36 * cap0}
        for label, dealt in nets.items():
            net = dealt / need0 - boss['regen'] * 30
            if label == '連點＋技能':
                check(1.0 < net < 1.3, f"{label} 淨比例 {net:.2f}（要 1.0～1.3：打得贏但不無腦）")
            else:
                check(net < .95, f"{label} 淨比例 {net:.2f}（要 <0.95：不能躺著贏）")

        # ---- 被動浮字：同一欄疊起來、不再斜體斜飛 ----
        pg.evaluate("""() => {
          const S=ClickerSave;
          const s=S.fresh(Date.now()); s.collection={zhenmu:1,yueyue2:1,lk:1};
          s.skillSlots=['zhenmu','yueyue2','lk']; s.partnerLevels={zhenmu:40,yueyue2:40,lk:40};
          s.lifetimeCoins=s.coins=1e8; s.marks=s.marksClaimed=20;
          S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
        }""")
        pg.reload()
        pg.wait_for_function('!document.getElementById("tap").disabled')
        pg.wait_for_function('document.querySelectorAll(".floater.passive").length >= 3', timeout=15000)
        pg.mouse.move(0, 0)
        info = pg.evaluate("""() => {
          const els=[...document.querySelectorAll('.floater.passive')];
          const cs=getComputedStyle(els[0]);
          const boxes=els.map(e=>e.getBoundingClientRect());
          return {n:els.length, italic:cs.fontStyle, lefts:els.map(e=>e.style.left),
                  xs:boxes.map(b=>Math.round(b.left)), rights:boxes.map(b=>Math.round(b.right)),
                  spread:Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))};
        }""")
        check(info['n'] >= 3, f"同時看得到 {info['n']} 個被動浮字（疊起來）")
        check(len(set(info['lefts'])) == 1, f"全部同一欄 left={set(info['lefts'])}")
        # 右對齊（translate(-100%)）：字數不同左緣自然不同，要看右緣有沒有對齊
        check(max(info['rights']) - min(info['rights']) <= 2,
              f"沒有橫向漂移，右緣對齊（範圍 {max(info['rights'])-min(info['rights'])}px）")
        check(info['italic'] == 'normal', f"不再斜體（font-style={info['italic']}）")
        check(20 <= info["spread"] <= 48, f"整疊高度 {info['spread']}px（20～48 才叫疊在一起、不叫瀑布）")
        pg.locator('#stage').screenshot(path=str(OUT / 'r21-passive-stack.png'))
        print('截圖 _art/out/r21-passive-stack.png')

        # ---- BUG 回報：抽完還沒收下時按 ESC 會卡在空的招募畫面 ----
        pg.evaluate("""() => {
          const E=ClickerEconomy, S=ClickerSave;
          const s=S.fresh(Date.now()); s.collection={zhenmu:1}; s.skillSlots=[null,null,null];
          s.lifetimeCoins=s.coins=1e9; s.freeDraws=5;
          S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));
        }""")
        pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled')
        pg.locator('#draw-five').click()   # start() 自己會開招募層；先開層的話這顆會被層擋住
        pg.wait_for_selector('#skip:not([hidden])')
        pg.locator('#skip').click()
        pg.wait_for_selector('#collect:not([hidden])', timeout=20000)
        check(pg.evaluate('!!Clicker.state.pending'), "抽完、還沒收下：pending 還在")
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(300)
        after = pg.evaluate("""() => ({
          layer: !document.getElementById('recruit-layer').hidden,
          collect: !document.getElementById('collect').hidden,
          cards: document.getElementById('cards').children.length,
          pending: !!Clicker.state.pending,
        })""")
        check(after['layer'] and after['collect'] and after['cards'] > 0,
              f"按 ESC 後畫面沒有被清空：招募層 {after['layer']}／收下鍵 {after['collect']}／卡片 {after['cards']} 張")
        pg.locator('#collect').click()
        pg.wait_for_function('!Clicker.state.pending', timeout=10000)
        # 2026-09-13 起收下後會先出抽卡結算（新夥伴／升星／自動升階），按「繼續」才關
        if pg.locator('#draw-summary').is_visible(): pg.locator('#draw-summary-ok').click(); pg.wait_for_timeout(300)
        check(pg.evaluate('document.getElementById("recruit-layer").hidden'), "ESC 之後照樣收得下，招募層正常關閉")

        check(not errors, f"沒有 JS 錯誤：{errors[:3]}")
        b.close()
    print(('\n全部通過' if not fails else f'\n{len(fails)} 項失敗'))
    sys.exit(1 if fails else 0)

main()
