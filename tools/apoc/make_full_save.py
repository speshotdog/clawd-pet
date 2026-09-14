# -*- coding: utf-8 -*-
"""產一份「全開」存檔字串，讓使用者自己匯入測試。
   用遊戲自己的 ClickerSave.validate + ClickerExtras.encodeSave，保證匯得進去。"""
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

SRC = Path(r'D:\claude\clawd-pet-balance\src')
OUT = Path(r'C:\Users\ASUS User VII\Desktop\珍母點點-全開存檔.txt')

BUILD = """() => {
  const S = ClickerSave, E = ClickerEconomy, B = ClickerBalance, P = ClickerPrestige, A = ApocEconomy, X = ClickerExtras;
  const s = S.fresh(Date.now());

  // ---- 1.0：52 張全收集、全部滿養（5★ → 升階 → 超越 5）
  const ids = Object.keys(B.characters);
  s.collection = {}; s.dust = {}; s.promotions = {}; s.transcend = {}; s.partnerLevels = {};
  for (const id of ids) {
    const o = E.origin(id);
    // 升階上限是 max(0, 2-出身)：精良能升兩階、史詩一階、傳說與神話本來就到頂（存檔驗證會擋）
    const p = Math.max(0, 2 - o);
    const promoCost = o === 0 ? 12 + 16 : (p ? 12 : 0);
    const need = 16 + promoCost + [50, 40, 32, 32][o];   // 滿養要的粉塵
    s.collection[id] = need; s.dust[id] = need;
    s.promotions[id] = p;
    s.transcend[id] = 5;
    s.partnerLevels[id] = 200;
  }
  s.awakened = Object.fromEntries(ids.map(i => [i, true]));
  s.universalDust = 99999;

  // ---- 錢與等級
  s.coins = 1e18; s.lifetimeCoins = 1e20; s.manualClicks = 99999;
  s.clickLevel = 300; s.trainingLevel = 60; s.autoClick = B.autoClickMax;
  s.claimedMilestones = ['tutorial50'];
  s.packages = 5000;

  // ---- 印記／神器：全部買到頂
  // ⚠ 印記總量上限是 MARKS_TOTAL_CAP=100（神器全滿光 blessing 20 就要 210），所以「全開」＝把 100 點花完。
  //   驗證式：marksClaimed >= 手上的 + 祝福三角數 + 神器三角數 + 粉塵兌換三角數 + 商店花費。
  s.prestiges = 30; s.marksClaimed = B.MARKS_TOTAL_CAP;
  s.markShop = Object.fromEntries((B.marks || []).map(m => [m.id, true]));
  const shopCost = (B.marks || []).reduce((n, m) => n + m.cost, 0);          // 33
  const tri = n => n * (n + 1) / 2;
  s.blessing = 8;                                                            // 36
  s.artifacts = { tap: 5, skill: 4 };                                        // 15 + 10
  const spent = shopCost + tri(s.blessing) + Object.values(s.artifacts).reduce((n, r) => n + tri(r), 0);
  s.marks = Math.max(0, s.marksClaimed - spent);

  // ---- 進度：七站王全勝（末世解鎖）
  s.bossWins = ['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.settings.scene = 'city';
  s.package = E.newPackage('city', 5000);
  s.collectibles = ['mohuashaonv'];
  // 買了 slot4 之後技能槽是 4 格（fresh 只有 3），slotReadyAt 也要跟著長度
  s.skillSlots = ids.slice(0, 4); s.slotReadyAt = [0, 0, 0, 0];
  s.roster = ids.slice(0, 20);
  // 更衣室的鍵是「分類:id」（驗證會逐個比對），而且一定要含 sounds:soft 與 fx:shard
  { const list = [];
    for (const [kind, items] of Object.entries(B.wardrobe || {})) for (const it of items) list.push(`${kind}:${it.id}`);
    s.owned = { ...(s.owned || {}), wardrobe: list }; }

  // ---- 2.0：71 張全收集、全部滿養、通關、錢給滿
  let a = A.normalize({ ...A.fresh(), unlocked: true, tutorial: 4 });
  const full = A.fullDust();
  a.collection = {}; a.dust = {}; a.transcend = {};
  for (const c of (window.ApocPool || [])) {
    a.collection[c.id] = full; a.dust[c.id] = full;
    a.transcend[c.id] = A.RULES.GROW.TRANSCEND.length;
  }
  a.universalDust = 99999; a.coins = 1e15; a.tickets = 999;
  a.progress = A.RULES.STATIONS; a.cleared = true;
  a.teamLevel = 200; a.clickLevel = 200;
  a.roster = []; a.skills = [null, null, null, null];
  a = A.normalize(a);
  // 隊伍要照累加上限排：神話 2、傳說 4、史詩 6、精良 8
  { const byR = r => (window.ApocPool || []).filter(c => c.rarity === r).map(c => c.id);
    const roster = [...byR('mythic').slice(0,2), ...byR('legendary').slice(0,4),
                    ...byR('epic').slice(0,6), ...byR('rare').slice(0,8)];
    a = A.setTeam(a, roster, [roster[0], roster[1], roster[2], roster[3]]); }
  s.apoc = a;

  // 徽章：讓 checkBadges 自己算
  const checked = X.checkBadges ? X.checkBadges(s).state : s;
  S.validate(checked, GachaPool);
  return X.encodeSave(checked);
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page()
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.wait_for_timeout(1800)
    try:
        blob = pg.evaluate(BUILD)
    except Exception as e:
        print('建檔失敗：', str(e)[:400]); b.close(); raise SystemExit(1)
    OUT.write_text(blob, encoding='utf-8')
    print(f'存檔字串 {len(blob)} 字 → {OUT}')

    # 立刻用遊戲自己的匯入流程驗一次，確定真的吃得下
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent)).click()")
    pg.wait_for_timeout(700)
    pg.click('#io-import'); pg.wait_for_timeout(400)
    pg.fill('#io-text', blob); pg.wait_for_timeout(400)
    pg.click('#import-check'); pg.wait_for_timeout(900)
    print('檢查：', pg.inner_text('#io-status')[:90])
    pg.click('#import-confirm'); pg.wait_for_timeout(2000)
    st = pg.evaluate("""() => ({ 幣: Clicker.state.coins, 夥伴: Object.keys(Clicker.state.collection).length,
      末世解鎖: !!Clicker.state.apoc?.unlocked, 末世卡: Object.keys(Clicker.state.apoc?.collection||{}).length,
      收藏卡: Clicker.state.collectibles, 徽章: (Clicker.state.badges||[]).length })""")
    print('匯入後：', st)
    b.close()
