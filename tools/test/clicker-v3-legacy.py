# -*- coding: utf-8 -*-
"""舊版存檔的大掃除補償（2026-09-14 使用者回報「朋友們導入檔案都看不到」）。

根因：`legacy`（補償旗標）是 `validate()` 在載入 v2 存檔時就地遷移寫上的，
但 `cleanupPage()` 只在遊戲啟動時跑過一次——匯入走的是 `commit → reload()`，
`reload()` 只重畫畫面，不會再叫它。所以補償沒有消失，只是要玩家自己重新整理才看得到。

這支驗四件事：
  ① 匯入 v2 存檔之後，大掃除頁**當下**就跳出來
  ② 選「從零開始」真的拿到徽章「舊時代的珍母」與魔花少女收藏卡，而且卡冊看得到
  ③ 戰績頁的「大掃除補償」鍵可以手動再開（已經看過也能開）
  ④ 沒有 legacy 的存檔不顯示那顆鍵

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-legacy.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-legacy'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 一份 v2 的舊存檔（有輪迴、有印記、有夥伴），用遊戲自己的匯出編碼包起來
MAKE_V2 = """() => {
  const S = ClickerSave, B = ClickerBalance, X = ClickerExtras;
  const s = S.fresh(Date.now());
  const ids = Object.keys(B.characters).slice(0, 8);
  s.collection = Object.fromEntries(ids.map(i => [i, 16])); s.dust = { ...s.collection };
  s.coins = 1e9; s.lifetimeCoins = 1e12; s.manualClicks = 500; s.packages = 200;
  s.claimedMilestones = ['tutorial50'];
  s.prestiges = 6; s.marksClaimed = 90000; s.marks = 50000; s.blessing = 40;
  // 買過「第四技能槽」：fresh() 固定給 3 格，但 validate 要求買過 slot4 就得是 4 格。
  // 「從零開始」把 markShop 搬過去卻沒補格子的話，commit 會失敗、按鈕按下去毫無反應（Codex 複查指出）。
  s.markShop = { slot4: true }; s.skillSlots = [null, null, null, null]; s.slotReadyAt = [0, 0, 0, 0];
  s.version = 2; delete s.legacy;
  return X.encodeSave(s);
}"""

def go(pg, payload):
    """走玩家真的會走的路：統計 → 匯入存檔 → 貼上 → 檢查 → 確定覆蓋"""
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent)).click()")
    pg.wait_for_timeout(700)
    pg.click('#io-import'); pg.wait_for_timeout(400)
    pg.fill('#io-text', payload); pg.wait_for_timeout(300)
    pg.click('#import-check'); pg.wait_for_timeout(700)
    ok = pg.inner_text('#io-status').startswith('存檔 OK')
    pg.click('#import-confirm'); pg.wait_for_timeout(1800)
    return ok

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append((getattr(e, 'stack', None) or str(e))[:700]))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1800)

    # ---- ④ 全新存檔（沒有 legacy）不該有那顆鍵
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent)).click()")
    pg.wait_for_timeout(600)
    check(pg.locator('#cleanup-open').is_hidden(), '沒有從舊版遷移過的存檔，戰績頁不顯示「大掃除補償」')
    pg.click('#stats-close'); pg.wait_for_timeout(400)

    # ---- ① 匯入 v2 存檔，補償頁要當下就出現
    payload = pg.evaluate(MAKE_V2)
    check(go(pg, payload), '匯入前的「檢查」驗得過')
    st = pg.evaluate("() => ({ seen: Clicker.state.legacy?.seen ?? null, ver: Clicker.state.version, hidden: document.getElementById('cleanup').hidden })")
    check(st['ver'] == 3 and st['seen'] is None, f'v2 存檔被就地遷移、補償還沒領（{st}）')
    check(not st['hidden'], '匯入之後**當下**就看得到大掃除補償頁（以前要自己重新整理才看得到）')
    body = pg.inner_text('#cleanup-body')
    check('舊時代的珍母' in body and '魔花少女' in body, f'補償頁列出徽章與收藏卡（{body[:40]}…）')
    pg.screenshot(path=str(OUT / 'cleanup.png'))

    # ---- ② 從零開始：要按兩次，之後真的拿到徽章與收藏卡
    pg.click('#cleanup-reset'); pg.wait_for_timeout(300)
    armed = pg.inner_text('#cleanup-reset')
    check('再按一次' in armed, f'「從零開始」要按兩次才生效（第一次變成「{armed}」）')
    check(pg.evaluate("() => (Clicker.state.collectibles||[]).length === 0"), '只按一次不會發卡')
    pg.click('#cleanup-reset'); pg.wait_for_timeout(1800)
    got = pg.evaluate("""() => ({ collectibles: Clicker.state.collectibles || [], badges: (Clicker.state.badges||[]).includes('oldtimes'),
      reset: Clicker.state.legacy?.reset === true, snapshot: !!Clicker.state.legacy?.snapshot,
      coins: Clicker.state.coins, cards: Object.keys(Clicker.state.collection || {}).length,
      marks: Clicker.state.marks, marksClaimed: Clicker.state.marksClaimed, blessing: Clicker.state.blessing, prestiges: Clicker.state.prestiges,
      slots: (Clicker.state.skillSlots||[]).length, slot4: !!Clicker.state.markShop?.slot4,
      reward: !document.getElementById('reward').hidden })""")
    check('mohuashaonv' in got['collectibles'], f"拿到魔花少女收藏卡（{got['collectibles']}）")
    check(got['badges'], '拿到徽章「舊時代的珍母」')
    check(got['reset'] and got['snapshot'], '舊進度封存成 legacy.snapshot（徽章牆的「舊時代的相簿」要用）')
    check(got['cards'] == 0 and got['coins'] == 0, f"進度真的歸零（夥伴 {got['cards']} 隻、幣 {got['coins']}）")
    # 第十二輪回報：「朋友按放棄進度後只有拿到成就跟卡，沒有印記」——fresh() 把印記歸零了
    check(got['marksClaimed'] > 0 and got['marks'] > 0,
          f"印記照帶（claimed {got['marksClaimed']}、手上 {got['marks']}）")
    check(got['slots'] == 4 and got['slot4'],
          f"買過 slot4 的人重來之後技能槽還是 4 格（實得 {got['slots']} 格、slot4={got['slot4']}）")
    check(got['blessing'] > 0 and got['prestiges'] > 0,
          f"祝福等級與輪迴次數照帶（Lv.{got['blessing']}、輪迴 {got['prestiges']}）")
    dbg = pg.evaluate("()=>({ cleanup: document.getElementById('cleanup').hidden, reward: document.getElementById('reward').hidden, blocked: Clicker.state ? 'ok' : 'no-state' })")
    check(got['reward'], f'有跳出獎勵視窗（{dbg}、錯誤 {errors[:2]}）')
    pg.screenshot(path=str(OUT / 'reward.png'))
    pg.click('#reward-ok'); pg.wait_for_timeout(800)

    # 收藏卡要在卡冊看得到（末世的卡冊頂端「收藏卡」鍵）
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊|卡冊/.test(b.textContent))?.click()")
    pg.wait_for_timeout(900)
    co = pg.evaluate("() => { const el = document.getElementById('collect-open'); return el ? { hidden: el.hidden, txt: el.textContent.trim() } : null; }")
    check(co and not co['hidden'], f'卡冊看得到「收藏卡」入口（{co}）')
    pg.screenshot(path=str(OUT / 'album.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)

    # ---- ③ 已經看過了，戰績頁的鍵還是要能手動再開
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent)).click()")
    pg.wait_for_timeout(700)
    btn = pg.locator('#cleanup-open')
    check(not btn.is_hidden(), '看過之後那顆鍵還在（當初選「保留進度」的人可以改選）')
    check('已經看過' in (btn.get_attribute('title') or ''), f'看過之後 tooltip 講得出來（{btn.get_attribute("title")}）')
    btn.click(); pg.wait_for_timeout(900)
    check(not pg.evaluate("() => document.getElementById('cleanup').hidden"), '手動觸發真的把補償頁叫出來了')
    pg.screenshot(path=str(OUT / 'manual.png'))

    check(not errors, f'沒有 pageerror：{errors[:2]}')
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
