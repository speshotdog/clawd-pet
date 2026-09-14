# -*- coding: utf-8 -*-
"""末世養成軸（第十一輪）驗收：粉塵／星級／突破的畫面，與萬用粉塵兌換所。

對應 docs/clicker/DESIGN-2026-09-14-apoc-growth.md。純邏輯在
tools/test/clicker-apoc-economy.test.js（node --test），這一支只驗「畫面上看得到、而且沒被裁」。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-growth.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-growth'; OUT.mkdir(parents=True, exist_ok=True)
fails = []
# 第十二輪（使用者：「10 星在卡冊裡不好看，參考薑餅人王國」，選了 A 版）：
# 星格**永遠 5 個**，1～5 亮金星、第 6～10 星把金星從左邊一顆顆換成寶石星。
# 卡位只有 90px 寬，10 顆 13px 的星要 140px，一定擠爆——所以不再用「星數＝圖片數」來驗。
STAR_ROW_JS = "() => { const r = document.querySelector('#album-detail .star-row'); if (!r) return null; const box = r.getBoundingClientRect(), host = r.closest('#album-detail').getBoundingClientRect(); const im = [...r.querySelectorAll('img')]; return { n: im.length, gems: im.filter(e => e.classList.contains('gem')).length, off: im.filter(e => e.classList.contains('off')).length, w: Math.round(box.width), fits: box.right <= host.right + 1 && box.left >= host.left - 1 }; }"
CLICK_BUDDY_JS = '() => document.querySelector(\'#buddies .buddy[data-id="%s"]\').click()'
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 做出一組「每一種養成狀態都有一張」的存檔：滿養／剛好滿星／滿星＋突破 2／3 顆粉塵／1 顆粉塵，
# 外加 500 萬用粉塵好按兌換。稀有度各取第一張，卡池換了也不會壞。
SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance,A=ApocEconomy;
  const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.collectibles=['mohuashaonv'];
  let a=A.normalize({unlocked:true,tutorial:4,progress:10,coins:1e9,tickets:20});
  const pool=window.ApocPool, pick=r=>pool.filter(c=>c.rarity===r).map(c=>c.id);
  const give=(id,n)=>{ for(let k=0;k<n;k++) a=A.addCards(a,[id]); };
  give(pick('rare')[0],30); give(pick('rare')[1],8); give(pick('epic')[0],12);
  give(pick('legendary')[0],3); give(pick('mythic')[0],1);
  a.universalDust=500; s.apoc=a; s.settings.world='apoc';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

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
    pg.wait_for_function('window.Clicker?.state?.settings?.world === "apoc"'); pg.wait_for_timeout(1500)

    ids = pg.evaluate("() => { const a=window.Clicker.state.apoc, A=ApocEconomy; return Object.keys(a.collection).map(id => [id, A.dustOf(a,id), A.starsAt(a,id), A.transcendOf(a,id), A.isMaxed(a,id)]); }")
    by = {r[0]: r for r in ids}
    maxed = [r for r in ids if r[4]]
    check(len(maxed) == 1, f'種子裡剛好一張滿養（實得 {len(maxed)}）')
    check(any(r[2] == 5 and r[3] == 0 for r in ids), '有一張剛好滿星、還沒突破')
    check(any(r[3] == 2 for r in ids), '有一張滿星＋突破 2')

    # ---- 夥伴列：星數不再等於張數（滿養那張是 ★5＋5，不是 ★30）
    buddies = pg.evaluate("() => [...document.querySelectorAll('#buddies .buddy')].map(el => [el.dataset.id, el.querySelector('.buddy-stars')?.textContent || ''])")
    txt = dict(buddies)
    mid = maxed[0][0] if maxed else None
    check(mid in txt and txt[mid] == '★10', f'滿養那張顯示 ★10（使用者：星數是一條連續的 1～10；實得 {txt.get(mid)!r}）')
    check(txt and all(t.startswith('★') for t in txt.values()), f'夥伴列每一張都有星數（實得 {txt}）')
    over = [ (i, t) for i, t in txt.items() if t.replace('★','').isdigit() and int(t.replace('★','')) > 10 ]
    check(not over, f'沒有任何一張顯示超過 ★10（舊版張數當星數會出現 ★30）：{over}')

    # ---- 滿養那張的星列：10 顆星（前 5 顆普通星、第 6～10 顆寶石星），而且不能撐破詳情卡
    pg.evaluate(CLICK_BUDDY_JS % mid)
    pg.wait_for_timeout(900)
    row = pg.evaluate(STAR_ROW_JS)
    check(row and row['n'] == 5, '星格永遠 5 個（實得 %s）' % (row,))
    check(row and row['gems'] == 5 and row['off'] == 0, '★10＝5 顆全是寶石星、沒有空格（實得 %s）' % (row,))
    check(row and row['fits'], '星列沒有撐出詳情卡（實得 %s）' % (row,))
    check(row and row['w'] <= 95, '星列塞得進 90px 的卡位（實得 %spx）' % (row and row['w'],))
    pg.screenshot(path=str(OUT / 'stars10.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)

    # ---- 卡冊：標題列要有「滿養 n/71」，而且末世也看得到粉塵罐
    pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /名冊/.test(b.textContent)).click()")
    pg.wait_for_timeout(700)
    summary = pg.inner_text('#team-summary')
    check('滿養' in summary, f'卡冊標題列有「滿養 n/71」（實得 {summary!r}）')
    check(not pg.locator('#dust-open').is_hidden(), '末世的卡冊看得到萬用粉塵罐（以前是整顆收起來的）')
    check(pg.inner_text('#dust-count').strip() == '500', '粉塵罐上的數字是末世的萬用粉塵')
    pg.screenshot(path=str(OUT / 'album.png'))

    # ---- 兌換所
    pg.click('#dust-open'); pg.wait_for_timeout(700)
    rows = pg.locator('#dust-shop .dust-row')
    check(rows.count() == len(pg.evaluate('() => window.ApocPool.map(c=>c.id)')), '兌換所列出整個末世卡池（含還沒抽到的）')
    # 圓形貼紙頭像：一定要有，而且不能爆版（position:absolute 的貼紙放進 grid 會撐滿整個面板）
    box = pg.evaluate("() => { const el=document.querySelector('#dust-shop .dust-row .apoc-sticker'); if(!el) return null; const r=el.getBoundingClientRect(); return {w:r.width,h:r.height}; }")
    check(box is not None, '每一列都有末世的圓形貼紙頭像（不能用 1.0 卡面，也不能留空洞）')
    check(box and 16 <= box['w'] <= 48 and 16 <= box['h'] <= 48, f'貼紙尺寸正常（實得 {box}）')
    check(pg.evaluate("() => !document.querySelector('#dust-shop .character-png')"), '兌換所沒有出現 1.0 卡面')

    # 沒抽到的卡**不能**換（使用者：「這樣才有顯得第一次抽到的重要性」）；已經抽到的才補得下去
    missing = pg.evaluate("() => { const a=window.Clicker.state.apoc; return window.ApocPool.map(c=>c.id).find(id => !a.collection[id]); }")
    miss_btn = pg.locator(f'#dust-shop [data-dust="{missing}:1"]')
    check(miss_btn.count() == 1 and miss_btn.is_disabled(), '還沒抽到的卡，兌換鍵是按不下去的')
    owned = pg.evaluate("() => { const a=window.Clicker.state.apoc, A=ApocEconomy; return Object.keys(a.collection).find(id => !A.isMaxed(a,id)); }")
    btn = pg.locator(f'#dust-shop [data-dust="{owned}:1"]')
    check(btn.count() == 1 and btn.is_enabled(), '已經抽到、還沒滿養的卡，兌換鍵可以按')
    d0 = pg.evaluate(f"() => ApocEconomy.dustOf(window.Clicker.state.apoc, '{owned}')")
    btn.click(); pg.wait_for_timeout(600)
    got = pg.evaluate(f"() => {{ const a=window.Clicker.state.apoc; return [ApocEconomy.dustOf(a,'{owned}'), a.universalDust, a.collection['{missing}']||0]; }}")
    check(got[0] == d0 + 1, f'兌換補的是粉塵（{d0} → {got[0]}）')
    check(got[1] < 500, f'萬用粉塵有扣（實得 {got[1]}）')
    check(got[2] == 0, '沒抽到的卡不會因為兌換而憑空出現')
    pg.screenshot(path=str(OUT / 'dust-shop.png'))

    # ---- 版面：兌換所不能有字被裁或跑出面板
    bad = pg.evaluate("""() => {
      const panel = document.getElementById('dust-shop').getBoundingClientRect(), out = [];
      for (const el of document.querySelectorAll('#dust-shop .dust-row > *')) {
        const r = el.getBoundingClientRect();
        if (r.right > panel.right + 1 || r.left < panel.left - 1) out.push(['出界', el.textContent.slice(0, 12)]);
        if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') out.push(['被裁', el.textContent.slice(0, 12)]);
      }
      return out;
    }""")
    check(not bad, f'兌換所沒有出界或被裁的字：{bad[:5]}')

    check(not errors, f'沒有 pageerror：{errors[:2]}')
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
