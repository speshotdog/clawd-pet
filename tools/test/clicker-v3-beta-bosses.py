# -*- coding: utf-8 -*-
"""公測前：**每一關王都真的開一場**，截圖 ＋ 量「王有沒有壓到技能鍵／血條有沒有出舞台」。

以前的掃描（HANDOFF r12 第 11 節）是把王圖層「強制擺出來」量框——那是靜態幾何，
量不到真的開打之後才會發生的事（入場動畫的位移、滿版王的 z 層、2.0 的怪依高度貼齊地板）。
這一支改成真的打：
  · 1.0 七個場景各自湊到 `canBoss`（bossWins 全給、runWins 空、包數推到門檻以上），按 `#boss-challenge` 開王包。
  · 2.0 六個站（第 1／4／8／12／16／20）用真實 `apoc.progress` 載入，讓 `autoFight()` 自己開場。
每一場在**開打 1 秒後**截 `#stage`，並量三件事（見 measure()）。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-bosses.py
輸出：_art/out/beta-bosses/*.png（13 張）
"""
import json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/beta-bosses'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
shots = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)


# ---- 存檔種子 ----------------------------------------------------------------
# 1.0：指定場景、王包就緒（index 遠高於門檻）、四個技能槽（印記買了 slot4）、錢多到升級不卡。
SEED_HOME = """(scene) => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters).slice(0,8);
  // ⚠ 養成要壓到最低。王包一開場就被打死的話，1 秒後量到的是**沒有王**（backyard 的王最弱，
  //   clickLevel 120 的隊伍不到一秒就贏，#boss-view 直接收起來）。錢還是要多，不然 slotCount 不到 3。
  s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.roster=ids.slice(0,4);
  s.coins=1e15; s.lifetimeCoins=1e16; s.manualClicks=999; s.claimedMilestones=['tutorial50'];
  s.clickLevel=0; s.trainingLevel=0;
  // 四顆技能鍵：1.0 的第四格要印記商店買 slot4（印記重設計 2026-09-15）
  s.marksClaimed=50; s.marks=0; s.prestiges=10; s.markShop={slot4:true};
  s.skillSlots=ids.slice(0,4); s.slotReadyAt=[0,0,0,0];
  // 每一站都解鎖（bossWins 全給）但本輪都沒打過（runWins 空）→ canBoss 過得了
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.runWins=[];
  s.settings.scene=scene;
  s.package=E.newPackage(scene, 400);     // 門檻最高 110 包，400 穩過
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# 2.0：真實進度載入，隊伍與技能排滿，讓 autoFight() 自己開這一站。
SEED_APOC = """(progress) => { const S=ClickerSave,B=ClickerBalance,A=ApocEconomy; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters).slice(0,8);
  s.collection=Object.fromEntries(ids.map(i=>[i,60])); s.dust={...s.collection};
  s.coins=1e15; s.lifetimeCoins=1e16; s.manualClicks=999; s.claimedMilestones=['tutorial50'];
  s.marksClaimed=50; s.marks=0; s.prestiges=10; s.markShop={slot4:true};
  s.skillSlots=ids.slice(0,4); s.slotReadyAt=[0,0,0,0];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.settings.world='apoc';
  let a = A.normalize({ ...A.fresh(), unlocked:true, tutorial:4 });
  const full = A.fullDust();
  a.collection={}; a.dust={}; a.transcend={};
  // ⚠ 卡要收滿（編隊要得到卡），但養成要**低**：滿養的隊伍一秒就把第 20 站的王打死，
  //   畫面直接跳結局層，量到的是「沒有怪」。等級壓到 1 之後每一站都撐得過取樣的那 1 秒。
  for (const c of (window.ApocPool||[])) { a.collection[c.id]=full; a.dust[c.id]=full; a.transcend[c.id]=0; }
  a.coins=1e12; a.tickets=99; a.teamLevel=1; a.clickLevel=1;
  a.progress = progress; a.cleared = progress >= A.RULES.STATIONS;
  a.roster=[]; a.skills=[null,null,null,null];
  a = A.normalize(a);
  { const byR = r => (window.ApocPool||[]).filter(c=>c.rarity===r).map(c=>c.id);
    const roster=[...byR('mythic').slice(0,2), ...byR('legendary').slice(0,4), ...byR('epic').slice(0,6), ...byR('rare').slice(0,8)];
    a = A.setTeam(a, roster, [roster[0],roster[1],roster[2],roster[3]]); }
  a.progress = progress; a.cleared = progress >= A.RULES.STATIONS;
  s.apoc = a;
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""


# ---- 量測 --------------------------------------------------------------------
# 三件事：
#  ① 王圖層的框跟四顆 `.skill-use` 的框不相交（滿版王除外，見下）
#  ② 血條在舞台裡（1.0 是王自己的 #boss-health，2.0 是 .package-meter 的 #package-progress）
#  ③ 四顆技能鍵中心 elementFromPoint 回到 `.skill-use`（真的點得到，不是被透明層蓋住）
MEASURE = """(arg) => {
  const [bossSel, barSel] = arg;
  const R = el => { const b = el.getBoundingClientRect(); return { x:b.x, y:b.y, w:b.width, h:b.height, r:b.right, b:b.bottom }; };
  const boss = document.querySelector(bossSel);
  const stage = document.getElementById('stage');
  const keys = [...document.querySelectorAll('#slots .skill-use')];
  const hit = keys.map(k => { const b = k.getBoundingClientRect();
    const el = document.elementFromPoint(b.x + b.width/2, b.y + b.height/2);
    return el ? (el.closest('.skill-use') ? 'skill-use' : (el.id || el.className || el.tagName)) : 'null'; });
  const inter = (a, c) => !(a.r <= c.x || c.r <= a.x || a.b <= c.y || c.b <= a.y);
  const bossBox = boss && !boss.hidden ? R(boss) : null;
  const bar = document.querySelector(barSel);
  const barBox = bar ? R(bar) : null, stageBox = R(stage), gameBox = R(document.getElementById('game'));
  const eps = 0.5;
  const within = (a, c) => !!a && a.x >= c.x - eps && a.r <= c.r + eps && a.y >= c.y - eps && a.b <= c.b + eps;
  return {
    bossVisible: !!bossBox,
    fullBoard: !!boss && boss.classList.contains('full-board'),
    keys: keys.length,
    boss: bossBox, stage: stageBox, bar: barBox, game: gameBox,
    barInGame: within(barBox, gameBox),
    overlaps: bossBox ? keys.map((k,i) => inter(bossBox, R(k)) ? i : -1).filter(i => i >= 0) : [],
    barInStage: within(barBox, stageBox),
    hit,
  }; }"""


def measure(pg, tag, boss_sel, bar_sel, label):
    m = pg.evaluate(MEASURE, [boss_sel, bar_sel])
    shot = OUT / f'{tag}.png'
    pg.locator('#stage').screenshot(path=str(shot))
    shots.append(shot)
    check(m['bossVisible'], f'{label}：王圖層在畫面上（{boss_sel}）')
    check(m['keys'] == 4, f'{label}：四顆技能鍵（實得 {m["keys"]}）')
    if m['fullBoard']:
        # 滿版滅世珍獸是刻意鋪滿整個舞台、z-index 8 墊在技能鍵下面（HANDOFF r12 第 10／11 節）。
        # 框一定相交，這時候唯一有意義的判準是 ③：鍵還點得到。
        print(f'     （{label}：滿版王，框相交是設計，改看 elementFromPoint）')
    else:
        check(not m['overlaps'], f'{label}：王圖層沒壓到技能鍵（相交的鍵 {m["overlaps"]}；王 {m["boss"]}）')
    # 血條：硬判準是「沒有被畫布切掉」（#game 是 overflow:hidden，掉出去就真的看不見）。
    # 舞台本身是 overflow:visible（clicker.css 第 101 行），1.0 的王血條照設計掛在 #boss-view 的
    # bottom:-16px、left:-20px，本來就露在舞台框外側那條空隙上——所以「在舞台裡」只當情報印出來。
    check(m['barInGame'], f'{label}：血條沒有被畫布切掉（bar {m["bar"]} / game {m["game"]}）')
    if not m['barInStage']:
        print(f'     ⚠ {label}：血條超出 #stage 的框（bar {m["bar"]} / stage {m["stage"]}）——'
              '舞台 overflow:visible，畫得出來，但確實不在舞台矩形內')
    check(all(h == 'skill-use' for h in m['hit']), f'{label}：四顆鍵中心都點得到（{m["hit"]}）')
    print(f'     圖 {shot.name}｜王 {m["boss"]}｜相交 {m["overlaps"]}｜命中 {m["hit"]}')
    return m


# ---- 開場 --------------------------------------------------------------------
HOME_SCENES = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket', 'fridge', 'city']
APOC_STATIONS = [1, 4, 8, 12, 16, 20]      # 1-based；index = station-1


# 首次載入會彈「這次更新改了什麼」（任務書 A5，群組 A 同時在做）：它是 modal，會擋住
# `#boss-challenge` 的點擊、也會蓋住技能鍵的 elementFromPoint。量之前先關掉。
def dismiss_panels(pg):
    for _ in range(3):
        closed = pg.evaluate("""()=>{ let n=0;
          for (const id of ['update-notes','daily-done']) {
            const el = document.getElementById(id);
            if (el && !el.hidden) { const b = el.querySelector('button'); if (b) { b.click(); n++; } } }
          return n; }""")
        if not closed: break
        pg.wait_for_timeout(500)


def new_page(ctx):
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    return pg, errors


with sync_playwright() as p:
    b = p.chromium.launch()

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')

    all_errors = []

    # ---- 1.0：七個場景各開一場王包
    for scene in HOME_SCENES:
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg, errors = new_page(ctx)
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED_HOME, scene); pg.reload()
        pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(1200)
        dismiss_panels(pg)
        name = pg.evaluate("(id)=>window.ClickerScenes[id]?.boss?.name || '?'", scene)
        ready = pg.evaluate("()=>ClickerEconomy.canBoss(Clicker.state, Date.now())")
        check(ready, f'1.0 {scene}：王包就緒（canBoss）')
        if not ready:
            ctx.close(); continue
        pg.click('#boss-challenge')
        pg.wait_for_function("()=>!!Clicker.state.boss", timeout=5000)
        # 開王包到王真的畫出來之間有一段：先收包（bagBusy）再讓王從上面砸下來（300+90ms），
        # 不等就會量到 hidden 的 #boss-view（實測 backyard 就是這樣紅的）。
        pg.wait_for_function("()=>!document.getElementById('boss-view').hidden", timeout=6000)
        pg.wait_for_timeout(1000)          # 入場動畫跑完、站定之後再取樣
        measure(pg, f'home-{scene}', '#boss-view', '#boss-view #boss-health', f'1.0 {scene}（{name}）')
        all_errors += errors
        ctx.close()

    # ---- 2.0：六個站讓 autoFight 自己開場
    for st in APOC_STATIONS:
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, device_scale_factor=1)
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg, errors = new_page(ctx)
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED_APOC, st - 1); pg.reload()
        pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
        dismiss_panels(pg)
        started = False
        try:
            pg.wait_for_function("()=>!!Clicker.state.apoc?.stage", timeout=8000); started = True
        except Exception:
            pass
        check(started, f'2.0 第 {st} 站：autoFight 自己開場了')
        if not started:
            print('     現況：', pg.evaluate("()=>({progress:Clicker.state.apoc?.progress, world:document.body.dataset.world, stage:!!Clicker.state.apoc?.stage})"))
            ctx.close(); continue
        pg.wait_for_timeout(1000)
        dismiss_panels(pg)
        boss = pg.evaluate("()=>!!Clicker.state.apoc?.stage?.boss")
        measure(pg, f'apoc-st{st:02d}', '#apoc-enemy', '#package-progress', f'2.0 第 {st} 站（{"王" if boss else "小怪"}）')
        all_errors += errors
        ctx.close()

    b.close()

check(len(shots) == 13, f'13 張圖全部產出（實得 {len(shots)}）')
check(not all_errors, '頁面錯誤 0：' + '; '.join(all_errors)[:300])
print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
