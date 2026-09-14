# -*- coding: utf-8 -*-
"""A1（2026-09-15 任務書）：徽章彈窗卡住的原始情境。

使用者 2026-09-15：「成就卡住不會消失，要重整才會不見」。
真兇：拿到徽章 1.8 秒內切分頁／縮視窗時，clicker.js 的 suspend() 會走到
extras 的 suspend()——那裡把 popTimer 清掉，卻沒把彈窗收起來；
而 stopTimers() 又把整份文件的動畫全 cancel 掉，淡出動畫的 finished 永遠不回來。
兩條收掉彈窗的路同時斷掉 → #badge-pop 永遠留在舞台上。

這支測試重現那個情境：
  1. 載入一份「再打贏一隻王就拿到『王5』（夜市）徽章」的存檔（bossWins 四隻、王包就緒、王血剩 1）
  2. 遊戲自己的 settle 把王打完 → checkBadges 發徽章 → #badge-pop 出現
  3. **1.8 秒內**把 document.hidden 模擬成 true 並發 visibilitychange（＝切分頁），再切回來
  4. 切回來後 2.5 秒內 #badge-pop 必須 hidden === true

負控制：把 clicker-extras.js suspend() 裡的 `pop.hidden = true` 拿掉，這支要變紅。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-badge.py
"""
import mimetypes, sys, time
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-beta'; OUT.mkdir(parents=True, exist_ok=True)
BADGE = 'boss-nightmarket'   # 徽章牆上的「王5」
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 「再打贏一隻王就拿到王5」：夜市場景、前四站的王都贏過、王包就緒、王血只剩 1 點，
# 交給遊戲自己每秒的 settle() 打完（被動收益會進王的 dealt）。
SEED = """() => {
  const S = ClickerSave, E = ClickerEconomy, B = ClickerBalance;
  const now = Date.now();
  let s = S.fresh(now);
  const ids = Object.keys(B.characters).slice(0, 8);
  s.collection = Object.fromEntries(ids.map(i => [i, 4])); s.dust = { ...s.collection };
  s.coins = 1e9; s.lifetimeCoins = 1e9; s.manualClicks = 500;
  s.claimedMilestones = ['tutorial50'];
  s.bossWins = ['backyard', 'kitchen', 'market', 'factory'];
  s.settings.scene = 'nightmarket';
  s.package = E.newPackage('nightmarket');
  // 王包就緒：包號往上加到 canBoss 為止（門檻包數各場景不同，不要寫死數字）
  for (let i = 1; i <= 2000 && !E.canBoss(s, now); i++) s.package.index = i;
  if (!E.canBoss(s, now)) return { err: '王包排不出來' };
  // ⚠ 王包不能直接寫進存檔：載入時的離線結算會把進行中的王當成放棄（clicker-economy.js settle 的 offline 分支），
  //   一載入就變成「輸了」。所以存檔只做到「王包就緒」，開王交給頁面上的挑戰鍵。
  S.validate(s, GachaPool);
  sessionStorage.setItem('test-seed', JSON.stringify(s));
  return { ok: true, packageIndex: s.package.index };
}"""

POP = "() => { const el = document.getElementById('badge-pop'); return el ? { hidden: el.hidden, text: (el.textContent || '').trim() } : null; }"
HIDE = """(on) => { Object.defineProperty(document, 'hidden', { value: on, configurable: true });
  Object.defineProperty(document, 'visibilityState', { value: on ? 'hidden' : 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange')); }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
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
    seed = pg.evaluate(SEED)
    check(seed.get('ok'), f'種子存檔做得出來（{seed}）')
    if not seed.get('ok'):
        print('種子失敗，後面不用測了'); sys.exit(1)
    pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
    # 新存檔第一次載入會彈「這次更新改了什麼」（A5）；它蓋在舞台上，先按掉才點得到挑戰鍵
    pg.evaluate("() => { const el = document.getElementById('update-notes'); if (el && !el.hidden) document.getElementById('update-notes-close').click(); }")
    pg.wait_for_timeout(300)

    # 0) 用畫面上的挑戰鍵開王包（走遊戲自己的 ClickerEconomy.startBoss），再把王打到剩 1 點血：
    #    剩下那 1 點交給每秒的 settle（被動收益會進王的 dealt），等於真的把王打完。
    pg.wait_for_selector('#boss-challenge:not([hidden])', timeout=10000)
    pg.click('#boss-challenge'); pg.wait_for_timeout(600)
    started = pg.evaluate("""() => { const s = window.Clicker.state; if (!s.boss) return null;
      s.boss.shells = []; s.boss.shellHp = 3; s.boss.blocked = 0;   // 硬殼會吃掉被動傷害，這裡只測徽章
      s.boss.dealt = s.boss.need - 1; return { need: s.boss.need }; }""")
    check(started is not None, f'王包開起來了（{started}）')

    # 1) 王被打完 → 徽章入帳
    pg.wait_for_function(f"() => (window.Clicker?.state?.badges || []).includes('{BADGE}')", timeout=15000)
    earned_at = time.time()
    check(True, '打贏夜市的王，拿到「王5」徽章')

    # 2) 彈窗真的出現了（沒出現的話下面整段就是假綠）
    pop = pg.evaluate(POP)
    check(pop is not None and pop['hidden'] is False, f'#badge-pop 出現在舞台上（{pop}）')
    pg.screenshot(path=str(OUT / 'badge-pop.png'))

    # 2b) 順手驗 A5 的診斷：最近三則提示真的有記到（這一頁剛好會跳「徽章：…」）
    diag = pg.evaluate("() => window.Clicker.extras.diagnostics()")
    check(any('徽章' in t for t in diag['notices']), f'診斷的「最近三則提示」記得到剛剛那幾行（{diag["notices"]}）')
    check(len(diag['notices']) <= 3, f'最多三則（{len(diag["notices"])}）')

    # 3) 1.8 秒內切走（彈窗自己的收尾計時器還沒到）
    elapsed = time.time() - earned_at
    check(elapsed < 1.8, f'在彈窗自己的 1.8 秒收尾之前就切走（實際 {elapsed:.2f} 秒）')
    pg.evaluate(HIDE, True)
    pg.wait_for_timeout(700)
    hidden_state = pg.evaluate(POP)
    check(hidden_state and hidden_state['hidden'] is True, f'切走的當下彈窗就收起來了（{hidden_state}）')

    # 4) 切回來：2.5 秒內一定要是 hidden
    pg.evaluate(HIDE, False)
    deadline = time.time() + 2.5; final = None
    while time.time() < deadline:
        final = pg.evaluate(POP)
        if final and final['hidden']: break
        pg.wait_for_timeout(100)
    check(final is not None and final['hidden'] is True, f'切回來 2.5 秒內 #badge-pop.hidden === true（{final}）')
    pg.screenshot(path=str(OUT / 'badge-after-resume.png'))
    check(not errors, f'沒有 pageerror：{errors[:2]}')
    ctx.close(); b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
