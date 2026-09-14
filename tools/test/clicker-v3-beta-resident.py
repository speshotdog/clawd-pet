# -*- coding: utf-8 -*-
"""A2（2026-09-15 任務書）：全破後的常駐怪不要走到王——真的跑一遍。

單元測試驗的是 `revisit(..., {walk:false})` 與 settle 的分支；這一支驗**畫面上**的行為：
全線通行（cleared、progress 20）的存檔進末世，autoFight 會在第 19 站（index 18）留一隻常駐小怪。
以前那條路用的是「會走路」的回顧，打完一段就走到 index 19＝真・滅世珍獸（60 秒機制王），
變成 18 → 19 → 18 一直循環，掛機賺錢的人每分鐘被王打斷一次。

判準：把常駐那一站連續打死好幾輪（含跨過重生空檔），index 不准離開 18、不准出現 boss。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-resident.py
"""
import mimetypes, sys, time
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-beta'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.settings.world='apoc';
  // 全線通行：20 站走完、cleared 蓋章、結局看過（seenAt 有值），場上什麼都沒有
  s.apoc={unlocked:true,tutorial:6,progress:20,cleared:true,coins:1e6,tickets:0,stage:null,revisitAt:null};
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# 隊伍要有戰力，不然 autoFight 直接不動
TEAM = """()=>{const a=Clicker.state.apoc,p=ApocPool.slice(0,6);
  for(const c of p){a.collection[c.id]=(a.collection[c.id]||0)+1;}
  a.roster=[...new Set([...p.map(c=>c.id),...a.roster])].slice(0,20); return a.roster.length;}"""

STAGE = "() => { const a = Clicker.state.apoc; return a.stage ? { index: a.stage.index, boss: !!a.stage.boss, resident: !!a.stage.resident, wave: a.stage.wave } : { index: null, revisitAt: a.revisitAt }; }"

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
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.apocReady'); pg.wait_for_timeout(2000)
    pg.evaluate("() => { const el = document.getElementById('apoc-ending'); if (el && !el.hidden) document.getElementById('apoc-ending-close').click(); }")
    pg.evaluate(TEAM); pg.wait_for_timeout(2500)

    st = pg.evaluate(STAGE)
    check(st['index'] == 18, f'全線通行後場上常駐第 19 站（index 18）的小怪（{st}）')
    check(st.get('resident') is True, f'那一隻是常駐（stage.resident）（{st}）')
    check(st.get('boss') is False, f'不是王（{st}）')
    pg.screenshot(path=str(OUT / 'resident-stage.png'))
    label = pg.locator('#package-label').inner_text()
    check('常駐' in label, f'標籤照舊寫「常駐」（{label}）')

    # 連續打死好幾輪（含跨過 1 秒重生空檔）：index 不准離開 18、不准冒出王
    seen, saw_gap = [], False
    for i in range(14):
        pg.evaluate("() => { const st = Clicker.state.apoc.stage; if (st) { st.hp = 1; st.wave = st.waves; } }")
        pg.wait_for_timeout(1400)
        s2 = pg.evaluate(STAGE)
        if s2['index'] is None: saw_gap = True
        seen.append(s2)
    bad = [s for s in seen if s['index'] not in (18, None) or s.get('boss')]
    check(not bad, f'連殺 {len(seen)} 輪都留在第 19 站、沒有出現王（違規：{bad[:3]}）')
    check(saw_gap or any(s.get('resident') for s in seen), f'重生回來的還是常駐（{seen[-3:]}）')
    check(pg.evaluate("() => Clicker.state.apoc.revisitAt") == 18, '回顧站一直停在 18')
    check(pg.evaluate("() => Clicker.state.apoc.progress") == 20, '進度沒被推動')
    pg.screenshot(path=str(OUT / 'resident-after.png'))
    check(not errors, f'沒有 pageerror：{errors[:2]}')
    ctx.close(); b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
