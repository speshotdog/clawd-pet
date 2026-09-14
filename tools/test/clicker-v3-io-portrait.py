# -*- coding: utf-8 -*-
"""手機直式：統計／存檔頁與收藏卡頁不能被邊框、螢幕底邊或自己的版型擠爆。

使用者 2026-09-14：「手機的存檔頁面還是有遮擋」。
根因有兩層，兩層都不會讓 DOM 斷言變紅，只有量尺寸才看得到：

  ① 面板捲到底時，最後一排剛好頂在面板的虛線內框（outline-offset:-7px）與直式面板的底邊上。
     實測「檢查」鍵底邊離視窗只剩 3～4px——沒有真的被裁掉，但視覺上就是壓在框上。
  ② 徽章牆在直式是 repeat(5,1fr)，而 1fr 的最小值是**內容寬度**不是 0；
     徽章圖寫死 --size:64px，360px 的機器每格只有 ~63px，於是整排往右溢出，右邊三顆被切掉。

③ 收藏卡展示頁（第十二輪新版型）在直式會爆：橫式那套是「卡 280px ＋ 說明牌 300px」並排，
   手機可用寬只有 314–344px，flex 把說明牌壓成 52px、整排右溢 48–78px，360px 的機器連卡都
   壓到「回到卡冊」。另外 `.album-slot .card` 帶著卡冊縮圖用的 `margin-bottom:-84px`，
   直排時會把說明牌往上拉 84px，名字／階級／取得三行被卡片蓋掉——DOM 尺寸全對，只有截圖看得出來。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-io-portrait.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/v3-io-portrait'; OUT.mkdir(parents=True, exist_ok=True)
SIZES = [(390, 844, 'iPhone14'), (360, 740, 'Android小'), (412, 915, 'Pixel7')]
CLEAR = 12   # 最後一排離螢幕底至少要留這麼多，才不會壓在框上

fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

MEASURE = """() => {
  const panel = document.getElementById('stats'), pr = panel.getBoundingClientRect(), out = {};
  out.over = [...panel.querySelectorAll('*')].filter(el => {
    if (el.hidden || !el.getClientRects().length) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > pr.right + 1 || r.left < pr.left - 1);
  }).map(el => `${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]}`).slice(0, 6);
  for (const id of ['import-check', 'import-confirm', 'io-status']) {
    const el = document.getElementById(id);
    if (!el || el.hidden) { out[id] = null; continue; }
    const b = el.getBoundingClientRect();
    const pts = [[b.left+4,b.top+4],[b.right-4,b.bottom-4],[b.left+b.width/2,b.top+b.height/2]];
    const hits = pts.map(([x,y]) => { const e = document.elementFromPoint(x,y); return e ? (e === el || el.contains(e) ? 'self' : `${e.tagName.toLowerCase()}#${e.id||''}`) : 'null'; });
    out[id] = { clear: Math.round(innerHeight - b.bottom), covered: hits.filter(h => h !== 'self') };
  }
  return out; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h, name in SIZES:
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if path.is_relative_to(SRC) and path.is_file():
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else: r.fulfill(status=404, body='missing')
        ctx.route('**/*', route)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1600)
        pg.evaluate("() => [...document.querySelectorAll('button')].find(b => /戰績|統計/.test(b.textContent))?.click()")
        pg.wait_for_timeout(700)
        pg.click('#io-import'); pg.wait_for_timeout(1400)          # scrollIntoView 是 smooth，要等它停

        m = pg.evaluate(MEASURE)
        check(not m['over'], f'{name}：面板裡沒有東西橫向溢出（{m["over"]}）')
        check(m['import-check'] and m['import-check']['clear'] >= CLEAR,
              f'{name}：「檢查」鍵離螢幕底 {m["import-check"] and m["import-check"]["clear"]}px（要 ≥{CLEAR}）')
        check(m['import-check'] and not m['import-check']['covered'],
              f'{name}：「檢查」鍵沒有被別的東西蓋住（{m["import-check"] and m["import-check"]["covered"]}）')

        # 走完整流程：貼一份合法存檔 → 檢查 →「確定覆蓋」冒出來（那一排會再長一顆）
        blob = pg.evaluate("() => ClickerExtras.encodeSave(Clicker.state)")
        pg.fill('#io-text', blob); pg.click('#import-check'); pg.wait_for_timeout(1500)
        m = pg.evaluate(MEASURE)
        check(m['import-confirm'] and m['import-confirm']['clear'] >= CLEAR,
              f'{name}：「確定覆蓋」離螢幕底 {m["import-confirm"] and m["import-confirm"]["clear"]}px（要 ≥{CLEAR}）')
        check(m['io-status'] and m['io-status']['clear'] >= 0 and not m['io-status']['covered'],
              f'{name}：狀態訊息整段看得到（{m["io-status"]}）')
        pg.screenshot(path=str(OUT / f'{name}-io.png'))

        # ---- ③ 收藏卡展示頁
        blob2 = pg.evaluate("""() => {
          const S = ClickerSave, A = ApocEconomy, s = S.fresh(Date.now());
          s.coins = 1e12; s.lifetimeCoins = 1e14; s.settings.world = 'apoc'; s.collectibles = ['mohuashaonv'];
          s.bossWins = ['backyard','kitchen','market','factory','nightmarket','fridge','city'];
          let a = A.normalize({ ...A.fresh(), unlocked: true, tutorial: 4, progress: 6 });
          const full = A.fullDust();
          for (const c of (window.ApocPool || []).slice(0, 20)) { a.collection[c.id] = full; a.dust[c.id] = full; }
          a.coins = 1e12; a = A.normalize(a);
          const roster = (window.ApocPool || []).filter(c => a.collection[c.id]).slice(0, 4).map(c => c.id);
          a = A.setTeam(a, roster, [roster[0], null, null, null]);
          s.apoc = a; S.validate(s, GachaPool); return JSON.stringify(s); }""")
        pg.evaluate("b => { localStorage.setItem('clicker_save', b); Storage.prototype.setItem = function(){}; }", blob2)
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2200)
        pg.click('#roster-open'); pg.wait_for_timeout(1200)
        pg.click('#collect-open'); pg.wait_for_timeout(2500)
        c = pg.evaluate("""() => {
          const page = document.querySelector('.collect-page'); if (!page) return { err: '沒有收藏卡頁' };
          const p = page.getBoundingClientRect();
          const over = [...page.querySelectorAll('*')].filter(el => {
            if (el.hidden || !el.getClientRects().length) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > p.right + 1 || r.left < p.left - 1 || r.bottom > p.bottom + 1);
          }).map(el => `${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ')[0]}`).slice(0, 6);
          const card = page.querySelector('.album-slot .card'), back = page.querySelector('.detail-back');
          // 說明牌的每一行都要真的看得到：中心點命中自己（沒有被卡片蓋住）
          const rows = [...page.querySelectorAll('.collect-plate > *')].filter(el => getComputedStyle(el).display !== 'none');
          const hidden = rows.filter(el => { const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
            return !(hit === el || el.contains(hit)); }).map(el => (el.textContent || '').slice(0, 8));
          return { over, hidden, rows: rows.length,
                   overlap: card && back ? Math.round(card.getBoundingClientRect().bottom - back.getBoundingClientRect().top) : null,
                   hscroll: page.scrollWidth - page.clientWidth }; }""")
        check(not c.get('over'), f'{name}：收藏卡頁沒有東西溢出（{c.get("over")}）')
        check(c.get('hscroll', 99) <= 0, f'{name}：收藏卡頁沒有橫向捲動（{c.get("hscroll")}）')
        check(c.get('overlap', 99) <= 0, f'{name}：卡片沒有壓到「回到卡冊」（{c.get("overlap")}px）')
        check(c.get('rows', 0) >= 4 and not c.get('hidden'),
              f'{name}：說明牌每一行都看得到、沒被卡片蓋住（{c.get("rows")} 行，被蓋：{c.get("hidden")}）')
        pg.screenshot(path=str(OUT / f'{name}-collect.png'))

        check(not errors, f'{name}：沒有 pageerror（{errors[:2]}）')
        ctx.close()
    b.close()

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
