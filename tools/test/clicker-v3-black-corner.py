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
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art' / 'out' / 'black-corner'; OUT.mkdir(parents=True, exist_ok=True)
CHECKER = Path(r'D:/claude研究/clawd-pet-50/_art/holo-test/check_card_corners.py')

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
  s.prepend(d);} d.style.display='block';}"""
UNBACKDROP = "()=>{const d=document.getElementById('__bc_grey'); if(d)d.style.display='none';}"


def sample(pg, tag):
    pg.evaluate(BACKDROP)
    pg.evaluate(PAUSE); pg.evaluate(BARRIER)
    shot = OUT / f'{tag}.png'; pg.screenshot(path=str(shot))
    cards = CC.collect_geometry(pg, '.hcard')
    m = CC.measure_corners(Image.open(shot), cards, dpr=1.0)
    pg.evaluate(UNBACKDROP); pg.evaluate(RESUME)
    return m, len(cards)


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
        pg.goto('http://apoc.test/apoc/gacha.html'); pg.wait_for_timeout(2500)
        pg.evaluate("()=>window.apocGacha?.setTickets(99)")
        injected = pg.evaluate(CC.INJECT_JS) if inject else None
        pg.click('#p10'); pg.wait_for_timeout(2500)
        prefix = 'inject-' if inject else ''
        results, taken = [], set()
        for i in range(26):
            pg.mouse.click(720, 450)
            pg.wait_for_timeout(150)
            n = pg.evaluate(REVEALED)
            if n in MOMENTS and n not in taken:
                taken.add(n)
                if inject:   # 這一輪新生成的卡面也要被注入（卡面是翻開那一刻才掛上 shadow root）
                    for _ in range(3): pg.evaluate(CC.INJECT_JS); pg.wait_for_timeout(120)
                m, cards = sample(pg, f'{prefix}reveal-{n}')
                results.append((f'翻到第 {n} 張（FX 進行中）', m, cards))
            pg.wait_for_timeout(450)
            if n >= 10: break
        pg.wait_for_timeout(1200)
        if inject:
            for _ in range(3): pg.evaluate(CC.INJECT_JS); pg.wait_for_timeout(120)
        m, cards = sample(pg, prefix + 'result')
        results.append(('結果頁', m, cards))
        b.close()
        return results, errs, injected


print('=== 現況（要全綠）===')
real, errs, _ = run(False)
for tag, m, n in real:
    from collections import Counter
    notes = Counter(r.get('note', '有效') if r['much_darker_pct'] is None else '有效' for r in m['rows'])
    print(f'  {tag}: {m["status"]}  bad {m["bad"]}/{m["samples"]}  卡 {n}  取樣 {dict(notes)}  跳過 {m["skipped"][:2]}')
    if m['status'] == 'FAIL':
        worst = sorted([r for r in m['rows'] if r['much_darker_pct'] is not None], key=lambda r: -r['much_darker_pct'])[:3]
        print('    最黑的三角：', [(r['card'], r['corner'], r['cls'][:22], r['much_darker_pct'], r['darkest'], r['local_ref']) for r in worst])
    check(m['status'] != 'FAIL', f'演出中「{tag}」沒有 L 形黑角（{m["bad"]}/{m["samples"]}）')
check(not errs, '頁面錯誤 0：' + '; '.join(errs)[:200])

print('=== 負控制（注入壞寫法，至少一個時刻要變紅，否則判準沒有鑑別力）===')
neg, _, injected = run(True)
for tag, m, n in neg:
    print(f'  {tag}: {m["status"]}  bad {m["bad"]}/{m["samples"]}  卡 {n}')
check(any(m['status'] == 'FAIL' for _, m, _ in neg), '注入壞寫法後判準變紅（注入 %s）' % injected)
# 每一個時刻都要有鑑別力，不然那個時刻的綠燈不代表任何事。
# 實測：只有結果頁的負控制咬得動；演出途中卡面被祖先（.card-lift／.reveal-flip）的圓角裁掉，
# 注入的方角黑底根本畫不出來——那幾個時刻**量不出黑角**，綠燈不算數，如實列出來不當成通過。
blind = []
for (tag, m, _), (tag2, m2, _) in zip(real, neg):
    if m['samples'] == 0:
        blind.append(f'{tag}（沒有有效取樣）')
    elif m2['status'] != 'FAIL':
        blind.append(f'{tag}（負控制注不進去：bad {m2["bad"]}/{m2["samples"]}）')
    else:
        check(True, f'「{tag}」判準有鑑別力（注入後 {m2["bad"]}/{m2["samples"]} 變紅）')
if blind:
    print('⚠ 這些時刻掃過但判準沒有鑑別力，綠燈不代表任何事：')
    for t in blind: print('   -', t)
check(any(m2['status'] == 'FAIL' for _, m2, _ in neg), '至少結果頁的判準要有鑑別力')

print('\n%d FAIL' % len(fails) if fails else '\nALL OK')
sys.exit(1 if fails else 0)
