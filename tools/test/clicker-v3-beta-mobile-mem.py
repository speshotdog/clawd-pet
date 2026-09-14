# -*- coding: utf-8 -*-
"""手機記憶體：375×812／DPR 3 走一趟「主畫面 → 卡冊翻 9 頁 → 收藏卡頁 → 回主畫面」，
每個時點量一次 JS heap 與 DOM 節點數，印成一張表。

為什麼要量這個：2.0 的卡面是原生 DOM（每張一個 shadow root、一張 600×840 的卡圖），
卡冊一次畫兩頁、翻九頁就建過上百張；收藏卡還帶著一支 2.5 MB 的 90 幀替身動畫。
手機的分頁記憶體上限比桌機低很多，翻一翻就被系統殺掉的話，玩家看到的是「白畫面」。

量法：CDP `Performance.getMetrics` 的 `JSHeapUsedSize`（每次取樣前先 `HeapProfiler.collectGarbage`，
      不然量到的是還沒回收的垃圾，數字會亂跳）＋ `Memory.getDOMCounters` 的 nodes／listeners。
門檻：① JS heap 任一時點 ≤ 150 MB；② 回主畫面之後不高於「進卡冊前」的 1.3 倍（沒有洩漏）。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-mobile-mem.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art/out/beta-mobile-mem'; OUT.mkdir(parents=True, exist_ok=True)
MB = 1024 * 1024
HEAP_CAP_MB = 150
LEAK_RATIO = 1.3
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)


# 2.0 全收集（71 張）＋ 收藏卡：卡冊要有東西可翻才量得到。
SEED = """() => { const S=ClickerSave,B=ClickerBalance,A=ApocEconomy; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,16])); s.dust={...s.collection};
  s.coins=1e15; s.lifetimeCoins=1e16; s.manualClicks=999; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.collectibles=['mohuashaonv'];
  s.settings.world='apoc';
  let a = A.normalize({ ...A.fresh(), unlocked:true, tutorial:4 });
  const full = A.fullDust();
  a.collection={}; a.dust={};
  for (const c of (window.ApocPool||[])) { a.collection[c.id]=full; a.dust[c.id]=full; }
  a.coins=1e12; a.tickets=99; a.progress=8;
  a = A.normalize(a);
  s.apoc=a;
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# ⚠ JSHeapUsedSize **不含**圖片的點陣資料——這個遊戲真正吃記憶體的是 600×840 的卡圖跟
#   2.5 MB／90 幀的替身動畫，JS heap 完全看不到它們。所以另外自己估一份「解碼後的點陣」：
#   naturalWidth × naturalHeight × 4 bytes，穿過 shadow root 一起算（卡面都在裡面）。
DOM_STATS = """()=>{
  const imgs = [...document.querySelectorAll('img')];
  for (const h of document.querySelectorAll('*')) if (h.shadowRoot) imgs.push(...h.shadowRoot.querySelectorAll('img'));
  const loaded = imgs.filter(i => i.naturalWidth > 0);
  const bytes = loaded.reduce((n,i)=> n + i.naturalWidth * i.naturalHeight * 4, 0);
  return { faces: document.querySelectorAll('.holo-face').length,
    imgs: imgs.length, decoded: loaded.length, bitmapMB: bytes / 1048576,
    altLoaded: imgs.filter(i=>/collect-alt/.test(i.currentSrc||i.src||'')).length }; }"""


def dismiss_panels(pg):
    """首次載入的「這次更新改了什麼」是 modal，不關掉點不到卡冊。"""
    for _ in range(3):
        n = pg.evaluate("""()=>{ let n=0; for (const id of ['update-notes','daily-done']) {
              const el=document.getElementById(id); if(el&&!el.hidden){ el.querySelector('button')?.click(); n++; } } return n; }""")
        if not n: break
        pg.wait_for_timeout(400)


rows = []


def sample(pg, cdp, label):
    # ⚠ 一定要先強制 GC：不然量到的是「還沒回收的垃圾」，同一個時點跑兩次可以差三倍，
    #   1.3 倍的洩漏門檻就完全失去意義。
    cdp.send('HeapProfiler.collectGarbage')
    pg.wait_for_timeout(400)
    metrics = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    dom = cdp.send('Memory.getDOMCounters')
    d = pg.evaluate(DOM_STATS)
    row = {'時點': label, 'heapMB': metrics.get('JSHeapUsedSize', 0) / MB,
           'nodes': dom.get('nodes', 0), 'listeners': dom.get('jsEventListeners', 0), 'docs': dom.get('documents', 0),
           **d}
    rows.append(row)
    print(f"  {label:<16} heap {row['heapMB']:7.1f} MB  點陣 {row['bitmapMB']:7.1f} MB  nodes {row['nodes']:>6}"
          f"  listeners {row['listeners']:>5}  卡面 {row['faces']:>3}  img {row['decoded']}/{row['imgs']:<4}  已載替身 {row['altLoaded']}")
    return row


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=3, is_mobile=True, has_touch=True)

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    cdp = ctx.new_cdp_session(pg)
    cdp.send('Performance.enable')

    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2500)
    dismiss_panels(pg)

    print('375×812 DPR 3：')
    base = sample(pg, cdp, '① 主畫面')
    pg.screenshot(path=str(OUT / '1-home.png'))

    # 卡冊：翻九頁（每一頁都等卡面畫完）
    pg.evaluate("() => [...document.querySelectorAll('button')].find(x => /名冊|卡冊/.test(x.textContent)).click()")
    pg.wait_for_timeout(1500)
    for i in range(9):
        pg.evaluate("() => document.getElementById('album-next')?.click()")
        pg.wait_for_timeout(700)
    pg.screenshot(path=str(OUT / '2-album.png'))
    album = sample(pg, cdp, '② 卡冊翻 9 頁')

    # 收藏卡頁
    pg.evaluate("() => document.getElementById('collect-open')?.click()")
    pg.wait_for_timeout(2000)
    pg.screenshot(path=str(OUT / '3-collect.png'))
    collect = sample(pg, cdp, '③ 收藏卡頁')

    # 回主畫面（收藏卡頁 → 卡冊 → 關掉）
    for _ in range(4):
        pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / '4-back-home.png'))
    home2 = sample(pg, cdp, '④ 回主畫面')

    check(not errors, '頁面錯誤 0：' + '; '.join(errors)[:200])
    b.close()

peak = max(r['heapMB'] for r in rows)
check(peak <= HEAP_CAP_MB, f'JS heap 任一時點 ≤ {HEAP_CAP_MB} MB（尖峰 {peak:.1f} MB @ '
      + max(rows, key=lambda r: r['heapMB'])['時點'] + '）')
ratio = home2['heapMB'] / base['heapMB'] if base['heapMB'] else 0
check(ratio <= LEAK_RATIO, f'回主畫面後不高於進卡冊前的 {LEAK_RATIO} 倍（'
      f'{home2["heapMB"]:.1f} / {base["heapMB"]:.1f} = {ratio:.2f}）')
# 卡冊縮圖不准把 2.5 MB 的替身動畫拉下來（B2：只有收藏卡頁／詳情／放大才載）
check(album['altLoaded'] == 0, f'卡冊翻頁時沒有載入替身動畫（實得 {album["altLoaded"]} 張）')

print(f'\n截圖在 {OUT}')
print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
