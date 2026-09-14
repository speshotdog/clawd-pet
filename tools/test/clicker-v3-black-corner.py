# -*- coding: utf-8 -*-
"""黑角掃描：**揭卡演出過程中**的卡片圓角（VERIFY-black-corner.md 第三節的未竟項）。

已經掃過的只有「結果頁」那一個時刻。演出途中會開啟 `.charge-surface`
（`mix-blend-mode:screen` ＋ `border-radius:inherit`）與 ceremony 的各層——
禮物卡那次的黑角就是在特定 FX 狀態才出現的，所以「結果頁沒事」不等於「抽卡沒事」。

判準沿用 clawd-pet-50 的 `_art/holo-test/check_card_corners.py`（同一套幾何與門檻），
**每一輪都跑負控制**：注入已知壞寫法必須讓判準變紅，否則綠燈不代表任何事。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-black-corner.py
"""
import importlib.util, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art' / 'out' / 'black-corner'; OUT.mkdir(parents=True, exist_ok=True)
# 判準腳本在隔壁的 clawd-pet-50 worktree。⚠ 不要寫死絕對路徑：它搬過一次家
# （D:\claude研究\ → D:\claude\），這支就整整壞在 FileNotFoundError 上沒人發現。
def _find_checker():
    rel = Path('clawd-pet-50/_art/holo-test/check_card_corners.py')
    for base in (ROOT.parent, ROOT.parent.parent, Path(r'D:/claude'), Path(r'D:/claude研究')):
        p = base / rel
        if p.exists(): return p
    return None
CHECKER = _find_checker()

if CHECKER is None:
    print('SKIP 找不到判準腳本 clawd-pet-50/_art/holo-test/check_card_corners.py——這支需要隔壁的 worktree')
    sys.exit(0)
spec = importlib.util.spec_from_file_location('check_card_corners', CHECKER)
CC = importlib.util.module_from_spec(spec); spec.loader.exec_module(CC)

fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

PAUSE = ("()=>[document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)]"
         ".forEach(root=>root.getAnimations().forEach(a=>{try{a.pause()}catch{}}))")
RESUME = ("()=>[document,...[...document.querySelectorAll('*')].filter(e=>e.shadowRoot).map(e=>e.shadowRoot)]"
          ".forEach(root=>root.getAnimations().forEach(a=>{try{a.play()}catch{}}))")
BARRIER = "()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"
REVEALED = """()=>{const up=e=>e.parentElement||(e.getRootNode().host||null);
 const vis=e=>{let p=e;while(p){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)return false;p=up(p)}return true};
 return [...document.querySelectorAll('.hcard')].filter(vis).length;}"""
# 演出是「點一下開封、之後每點一下翻一張」，所以取樣點用「翻到第幾張」而不是時間。
# 在剛點下去的 150ms 取樣＝charge-surface／flip 還開著，正是沒掃過的那些 FX 狀態。
MOMENTS = [1, 4, 8]


# 演出途中整個舞台是黑的，判準會判「在地背景為純黑 → 取樣無效」（照它自己的規矩，不判紅）。
# 要讓這幾個時刻真的可測，取樣時在**卡片底下**鋪一層中灰：
# 卡片自己的合成方式完全沒動（黑角是 screen 在獨立合成層裡沒東西可混，跟頁面底色無關），
# 但「卡外」有了非黑的在地參考，黑角才分得出來。負控制會證明這樣確實有鑑別力。
BACKDROP = """()=>{const s=document.querySelector('.stage')||document.body;
 let d=document.getElementById('__bc_grey');
 if(!d){d=document.createElement('div');d.id='__bc_grey';
  d.style.cssText='position:fixed;inset:0;background:#7a7a7a;z-index:0;pointer-events:none';
  s.prepend(d);} d.style.display='block';
 // 取樣期間關掉卡片自己的投影：.face-stock 有 `box-shadow:0 14px 30px #0008`，投影正好落在
 // 「圓角外」那一圈——判準是「比在地背景暗很多」，投影一定中。那是設計，不是黑角。
 // ⚠ 這是量測用的鷹架，跟黑角的成因無關（黑角是元素自己畫出來的，不是投影），取樣完就關掉。
 let o=document.getElementById('__bc_noshadow');
 if(!o){o=document.createElement('style');o.id='__bc_noshadow';document.head.append(o);}
 o.textContent='.leaf,.face-stock,.hcard{box-shadow:none!important}'; o.disabled=false;}"""
UNBACKDROP = ("()=>{const d=document.getElementById('__bc_grey'); if(d)d.style.display='none';"
              "const o=document.getElementById('__bc_noshadow'); if(o)o.disabled=true;}")


# ⚠ 上游的 check_card_corners.py 後來只留下幾何與判準（corner_boxes／lum／crop／measure_corners），
#   `INJECT_JS` 與 `collect_geometry` 都不在了——這支照舊 import 就 AttributeError 整支死掉。
#   這兩段本來就是「怎麼餵資料給判準」，屬於呼叫端，搬到這裡自己維護，判準仍然共用上游那一份。

# 負控制：在卡片四角畫黑色方塊 —— 也就是「L 形黑角」這個瑕疵長出來的樣子。
#
# ⚠ 為什麼不是沿用舊的 `mix-blend-mode:screen` 黑底：**那一段根本畫不出任何東西**。
#   screen 的定義是 1-(1-a)(1-b)，來源是純黑就等於什麼都沒做，不管有沒有獨立合成層、
#   不管掛在 .hcard／.slot／.reveal-shell／.card-face 哪一層都一樣（2026-09-15 實測五種寫法，
#   螢幕截圖逐像素比對：跟沒注入完全同一張）。舊註解猜的「進不了 shadow root」也不是原因——
#   apoc/ceremony.html 整頁是 light DOM，沒有任何 shadow root，主頁的 <style> 直接就套得上。
#   負控制的目的是「證明判準抓得到黑角」，所以就直接畫一個黑角給它抓。
INJECT_JS = """() => {
  let st = document.getElementById('__bc_inject');
  if (!st) { st = document.createElement('style'); st.id = '__bc_inject'; document.head.append(st); }
  st.textContent = `.hcard::after{content:'';position:absolute;inset:0;border-radius:0;z-index:99;pointer-events:none;
    background:linear-gradient(#000,#000) 0 0/16px 16px no-repeat,
               linear-gradient(#000,#000) 100% 0/16px 16px no-repeat,
               linear-gradient(#000,#000) 0 100%/16px 16px no-repeat,
               linear-gradient(#000,#000) 100% 100%/16px 16px no-repeat}`;
  return { page: 1, shadow: 0 }; }"""

# 卡片幾何：位置、尺寸、圓角。
# ⚠ 取樣元素是 `.face-stock`（最外層的 .leaf），不是 `.hcard`。`.hcard` 的 computed border-radius 是 **0**——
#   圓角寫在 .leaf 上（12px）。用 .hcard 的話 corner_boxes 會退到 r=max(4,0)=4，只取到角落 4×4 像素，
#   而且那個位置根本不是「圓角外會露出來」的那一圈，判準等於瞎的（實測：注入的黑角明明畫出來了，還是全綠）。
#   卡面可能在 shadow root 裡（主頁的卡冊是），所以也穿進去找。
COLLECT_GEOMETRY_JS = """(sel) => {
  const out = [], seen = new Set();
  const push = el => {
    if (seen.has(el)) return; seen.add(el);
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (b.width < 2 || b.height < 2) return;
    out.push({ x: b.x, y: b.y, w: b.width, h: b.height,
               radius: parseFloat(cs.borderTopLeftRadius) || 0,
               cls: (el.className || '').toString() });
  };
  document.querySelectorAll(sel).forEach(push);
  document.querySelectorAll('.holo-face').forEach(h => h.shadowRoot?.querySelectorAll(sel).forEach(push));
  // ⚠ 翻牌途中卡片在 rotateY／perspective 裡，畫出來的是斜的，但 getBoundingClientRect 是**正的外接框**——
  //   角落取樣方塊裡會塞進卡片本體（這副牌接近全黑），而且遮罩也對不上，判準一定假紅。
  //   所以把「正在旋轉」的卡標出來，呼叫端整張跳過，如實說「這張這一刻量不了」。
  for (const c of out) c.rotated = false;
  const mark = (el, rec) => { let p = el;
    while (p && p !== document.documentElement) {
      const t = getComputedStyle(p).transform;
      if (t && t !== 'none') {
        if (t.startsWith('matrix3d')) { const v = t.slice(9, -1).split(',').map(Number);
          if (Math.abs(v[1]) > .01 || Math.abs(v[2]) > .01 || Math.abs(v[4]) > .01 ||
              Math.abs(v[6]) > .01 || Math.abs(v[8]) > .01 || Math.abs(v[9]) > .01) { rec.rotated = true; return; } }
        else if (t.startsWith('matrix')) { const v = t.slice(7, -1).split(',').map(Number);
          if (Math.abs(v[1]) > .01 || Math.abs(v[2]) > .01) { rec.rotated = true; return; } }
      }
      p = p.parentElement || p.getRootNode().host;
    } };
  let i = 0;
  const all = [...document.querySelectorAll(sel)];
  for (const h of document.querySelectorAll('.holo-face')) all.push(...(h.shadowRoot?.querySelectorAll(sel) || []));
  // 還在演出「一次性」動畫的卡也跳過：翻牌的 flash／lift／charge-surface 會蓋在角落上，
  // 外接框與遮罩模型在那幾格都不成立。⚠ 只看一次性的：卡面的反光是 iterations:Infinity，
  //   進度永遠不會到 1，連它一起算的話**每一張都會被跳過**，整支測試變成空跑還印 ALL OK（實測踩過）。
  // ⚠ 只往上走到 .slot／.fan 為止：舞台本身有長達好幾秒的一次性演出動畫，走太上面的話
  //   每一張卡都會被判成「還在演出」，整支又變成空跑（實測踩過第二次）。
  const busy = el => { let p = el;
    while (p && p !== document.documentElement && !(p.classList && (p.classList.contains('fan') || p.classList.contains('stage')))) {
      for (const a of p.getAnimations({ subtree: true })) {
        const tm = a.effect && a.effect.getTiming(); if (!tm || tm.iterations === Infinity) continue;
        const t = a.effect.getComputedTiming();
        if (t && t.progress != null && t.progress < 1) return true;
      }
      p = p.parentElement || p.getRootNode().host;
    } return false; };
  for (const el of all) { const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
    const rec = out[i++]; mark(el, rec); if (!rec.rotated && busy(el)) rec.rotated = true; }
  return out; }"""

def sample(pg, tag):
    """取一張圖＋當下的卡片幾何。判準留給呼叫端算（門檻要就地校正，見下面 calibrate 的說明）。"""
    pg.evaluate(BACKDROP)
    pg.evaluate(PAUSE); pg.evaluate(BARRIER)
    shot = OUT / f'{tag}.png'; pg.screenshot(path=str(shot))
    cards = pg.evaluate(COLLECT_GEOMETRY_JS, '.face-stock')
    pg.evaluate(UNBACKDROP); pg.evaluate(RESUME)
    spun = [c for c in cards if c.get('rotated')]
    cards = [c for c in cards if not c.get('rotated')]
    if spun: print(f'     （{shot.stem}：{len(spun)} 張正在翻轉，外接框對不上畫出來的樣子，這一刻跳過）')
    return mask_interior(shot, cards), cards


def mask_interior(shot, cards):
    """把「圓角裡面」（卡片本體）塗成它周圍的在地背景色，只留圓角外那一小塊給判準看。

    ⚠ 沒有這一步的話正控制一定紅，而且是**假紅**：上游判準的取樣方塊是角落 r×r（r＝圓角 12px），
      其中只有約 21% 真的在圓角外，剩下 79% 是卡片內容。這副牌的卡面本來就接近全黑
      （太空、夜景、深色底 #151c24），所以「角落比周圍暗很多」永遠成立——量到的是卡面自己，
      不是黑角。塗掉卡片本體之後，那個方塊裡剩下的就只有「圓角外露出來的東西」：
      沒瑕疵＝背景色，有黑角＝黑。負控制注入的方角黑塊落在圓角外，塗不掉，照樣抓得到。
    """
    img = Image.open(shot).convert('RGB')
    src = img.copy()
    d = ImageDraw.Draw(img)
    W, H = img.size
    for c in cards:
        x, y, w, h = c['x'], c['y'], c['w'], c['h']
        r = max(4, int(c['radius']))
        # 在地背景色：卡外一圈（左上角往外 r）的中位數
        bx = (int(max(0, x - r)), int(max(0, y - r)), int(max(0, x - r) + r), int(max(0, y - r) + r))
        patch = src.crop(bx)
        if patch.size[0] < 1 or patch.size[1] < 1: continue
        import numpy as np
        arr = np.asarray(patch).reshape(-1, 3)
        fill = tuple(int(v) for v in np.median(arr, axis=0))
        d.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=r, fill=fill)
    out = shot.with_name(shot.stem + '-masked.png')
    img.save(out)
    return out


# 上游判準要兩個條件同時成立才判紅：①「比在地背景暗很多」②「接近純黑」（darkest ≤ darkest_limit，預設 12）。
# ⚠ ② 在這一頁**永遠不可能成立**：結果頁的卡片在 `.slot.done` 底下，opacity 0.35——
#   疊一塊純黑上去，量到的也只有在地背景的 0.65 倍（實測 local 122 → darkest 79），離 12 遠得很。
#   這就是為什麼以前「注入壞寫法也不會變紅」：不是注不進去，是絕對門檻在半透明的卡上沒有意義。
# 所以門檻要就地校正：先用負控制那張圖量出「真的全黑的角在這一頁長什麼樣」（black_ref），
# 正控制再用 black_ref + 餘裕當 darkest_limit。校正值本身也印出來，數字是哪裡來的看得見。
def calibrate(img, cards):
    m = CC.measure_corners(Image.open(img), cards, darkest_limit=255)   # 只看「比周圍暗很多」這一條
    bad = [r for r in m['rows'] if r['much_darker_pct'] is not None and r['much_darker_pct'] >= 8]
    # 取中位數不取最大值：最大值是「注入的黑角剛好被亮光蓋住的那一角」，用它當門檻會放得太鬆，
    # 鬆到把在地背景取樣落在彩虹光束上的正常角落也判成黑角（實測 reveal-1 穩定假紅）。
    # 中位數才是「這一刻的黑長什麼樣」的代表值；夠不夠嚴由下面的負控制自己驗（同一個門檻要判紅）。
    vals = sorted(r['darkest'] for r in bad)
    ref = vals[len(vals) // 2] if vals else None
    return m, ref


def verdict(img, cards, limit):
    return CC.measure_corners(Image.open(img), cards, darkest_limit=limit)


def run(inject):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if path.is_relative_to(SRC) and path.is_file():
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else: r.fulfill(status=404, body='missing')
        ctx.route('**/*', route)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        # 末世的抽卡演出＝精裝典藏包（apoc/ceremony.html）。舊的 apoc/gacha.html 殼已刪；
        # 扣券在主頁，這一頁由 ApocCeremony.play(ids) 驅動，所以直接交 10 張卡給它演
        pg.goto('http://apoc.test/apoc/ceremony.html')
        pg.wait_for_function('window.ApocCeremony && window.ApocPool'); pg.wait_for_timeout(800)
        injected = pg.evaluate(INJECT_JS) if inject else None
        pg.evaluate("()=>ApocCeremony.play(ApocPool.slice(0,10).map(c=>c.id))")
        pg.wait_for_function("()=>ApocCeremony.state().entryPhase==='waiting'", timeout=20000)
        pg.click('#entry-pack'); pg.wait_for_timeout(2500)
        prefix = 'inject-' if inject else ''
        results, taken = [], set()
        for i in range(26):
            pg.mouse.click(720, 450)
            pg.wait_for_timeout(150)
            n = pg.evaluate(REVEALED)
            if n in MOMENTS and n not in taken:
                taken.add(n)
                if inject: pg.evaluate(INJECT_JS)      # 注入是主頁的一張 <style>，新翻出來的卡也吃得到
                shot, cards = sample(pg, f'{prefix}reveal-{n}')
                results.append((f'翻到第 {n} 張（FX 進行中）', shot, cards))
                # 同一張再等 FX 收完拍一次：150ms 那一格十張卡全在一次性動畫裡，外接框與遮罩
                # 模型都不成立（實測會整批被跳過）。這一格才是這個階段真正量得到的畫面。
                pg.wait_for_timeout(700)
                shot2, cards2 = sample(pg, f'{prefix}reveal-{n}-settled')
                results.append((f'翻到第 {n} 張（FX 收完）', shot2, cards2))
            pg.wait_for_timeout(450)
            if n >= 10: break
        pg.wait_for_timeout(1200)
        if inject: pg.evaluate(INJECT_JS)
        shot, cards = sample(pg, prefix + 'result')
        results.append(('結果頁', shot, cards))
        b.close()
        return results, errs, injected


print('=== 負控制先跑：注入方角黑塊，順便量出「這一頁的全黑長什麼樣」當門檻 ===')
neg, _, injected = run(True)
cal = {}
for tag, shot, cards in neg:
    m, ref = calibrate(shot, cards)
    cal[tag] = (m, ref)
    print(f'  {tag}: 相對判準 bad {len([r for r in m["rows"] if r["much_darker_pct"] and r["much_darker_pct"]>=8])}/{m["samples"]}'
          f'  卡 {len(cards)}  黑角實測最亮 {ref}')

print('=== 現況（要全綠）===')
real, errs, _ = run(False)
MARGIN = 8          # 校正值再放寬一點點：同一個時刻兩次跑的合成結果會差個幾階
blind = []
for tag, shot, cards in real:
    m_neg, ref = cal.get(tag, (None, None))
    if ref is None:
        # 這個時刻連「畫在四角的純黑方塊」都量不出來（卡在 FX 裡幾乎全透明／被閃光蓋住），
        # 判準在這裡沒有鑑別力。如實列出來、不當成通過，也不當成失敗（沒有量到東西 ≠ 有黑角）。
        blind.append(tag)
        print(f'  ⚠ {tag}: 負控制也量不到黑角 → 這個時刻沒有鑑別力，掃過也不代表沒事')
        continue
    limit = ref + MARGIN
    # 負控制在這個門檻底下一定要紅（不紅就代表門檻訂錯，正控制的綠燈沒有意義）
    neg_shot, neg_cards = next((s2, c2) for t2, s2, c2 in neg if t2 == tag)
    v_neg = verdict(neg_shot, neg_cards, limit)
    m = verdict(shot, cards, limit)
    from collections import Counter
    notes = Counter(r.get('note', '有效') if r['much_darker_pct'] is None else '有效' for r in m['rows'])
    print(f'  {tag}: {m["status"]}  bad {m["bad"]}/{m["samples"]}  卡 {len(cards)}  門檻 darkest≤{limit:.0f}'
          f'  取樣 {dict(notes)}  跳過 {m["skipped"][:2]}')
    if m['status'] == 'FAIL':
        worst = sorted([r for r in m['rows'] if r['much_darker_pct'] is not None], key=lambda r: -r['much_darker_pct'])[:3]
        print('    最黑的三角：', [(r['card'], r['corner'], r['cls'][:22], r['much_darker_pct'], r['darkest'], r['local_ref']) for r in worst])
    check(v_neg['status'] == 'FAIL', f'「{tag}」判準有鑑別力（注入方角黑塊後 {v_neg["bad"]}/{v_neg["samples"]} 變紅）')
    check(m['status'] != 'FAIL', f'演出中「{tag}」沒有 L 形黑角（{m["bad"]}/{m["samples"]}）')
check(not errs, '頁面錯誤 0：' + '; '.join(errs)[:200])
if blind:
    print('⚠ 這些時刻掃過但判準沒有鑑別力，綠燈不代表任何事：' + '；'.join(blind))

print('%d FAIL' % len(fails) if fails else 'ALL OK')
sys.exit(1 if fails else 0)
