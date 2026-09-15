# -*- coding: utf-8 -*-
"""2.0 典藏包：跳過演出分兩段——第一下快轉（沒看過的卡停下來翻給你看、其他直接翻正），第二下全部略過。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-skip.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-apoc-skip'
OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.apoc={unlocked:true,tutorial:6}; s.settings.world='apoc';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

def open_page(p):
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1280, 'height': 860})
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
        r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
    return b, pg, errors

def draw(pg, owned_ids):
    # 給券、把收藏設成 owned_ids（其他都是「沒看過」），開十連
    pg.evaluate("(ids)=>{const A=ApocEconomy,s=Clicker.state; const a=A.normalize(s.apoc); a.tickets=10; a.collection=Object.fromEntries(ids.map(i=>[i,1])); a.roster=ids.slice(0,5); s.apoc=a;}", owned_ids)
    pg.wait_for_timeout(300)
    pg.wait_for_function("()=>!document.getElementById('draw-five').disabled", timeout=10000)
    pg.evaluate("()=>document.getElementById('draw-five').click()")
    pg.wait_for_function("()=>!document.getElementById('apoc-ceremony').hidden", timeout=10000); pg.wait_for_timeout(500)
    frame = next(f for f in pg.frames if f.url.endswith('apoc/ceremony.html'))
    try: frame.wait_for_function("()=>window.ApocCeremony && ApocCeremony.state().entryPhase==='waiting'", timeout=20000)
    except Exception: print('state at timeout:', frame.evaluate("()=>ApocCeremony.state()"), pg.evaluate("()=>document.getElementById('notice')?.textContent")); raise
    frame.eval_on_selector('#entry-pack', 'e=>e.click()'); pg.wait_for_timeout(1200)
    return frame

def main():
    with sync_playwright() as p:
        b, pg, errors = open_page(p)
        all_ids = pg.evaluate("()=>ApocPool.map(c=>c.id)")
        # ---- 情境一：一半沒看過 → 第一下快轉會停在新卡
        frame = draw(pg, all_ids[:20])
        frame.evaluate("()=>document.getElementById('revealall').click()"); pg.wait_for_timeout(700)
        st = frame.evaluate("()=>ApocCeremony.state()")
        fresh_n = sum(st['fresh'])
        check(fresh_n > 0, f'這包有沒看過的卡：{fresh_n} 張')
        check(st['fast'] and not st['skipped'], '第一下進入快轉，不是全部略過')
        check(st['skipLabel'] == '全部略過', f'按鈕改成「全部略過」：{st["skipLabel"]}')
        done_old = all(c for c, f in zip(st['complete'], st['fresh']) if not f)
        pending_new = any(not c for c, f in zip(st['complete'], st['fresh']) if f)
        check(done_old, '看過的卡全部直接翻正')
        check(pending_new, '沒看過的卡還在排隊翻（沒有一起被跳掉）')
        pg.screenshot(path=str(OUT / 'fast-1.png'))
        frame.wait_for_function("()=>ApocCeremony.state().collectable", timeout=60000)
        st = frame.evaluate("()=>ApocCeremony.state()")
        check(all(st['complete']), '快轉跑完：十張全部翻開、可以收下')
        badges = frame.evaluate("()=>[...document.querySelectorAll('#fan .slot .apoc-badge')].map(b=>b.textContent)")
        check(badges.count('新夥伴') == fresh_n, f'新夥伴徽章數 = 沒看過的張數（{badges.count("新夥伴")} / {fresh_n}）')
        pg.screenshot(path=str(OUT / 'fast-done.png'))
        frame.eval_on_selector('#finish', 'e=>e.click()'); pg.wait_for_timeout(1200)
        # ---- 情境二：按兩下 → 真的全部略過（新卡不等）
        frame = draw(pg, all_ids[:20])
        for _ in range(2): frame.evaluate("()=>document.getElementById('revealall').click()"); pg.wait_for_timeout(300)
        frame.wait_for_function("()=>ApocCeremony.state().collectable", timeout=8000)
        st = frame.evaluate("()=>ApocCeremony.state()")
        check(st['skipped'] and all(st['complete']), '第二下全部略過，立刻到結果頁')
        frame.eval_on_selector('#finish', 'e=>e.click()'); pg.wait_for_timeout(1200)
        # ---- 情境三：全部看過 → 一下就全部略過
        frame = draw(pg, all_ids)
        frame.evaluate("()=>document.getElementById('revealall').click()"); pg.wait_for_timeout(300)
        frame.wait_for_function("()=>ApocCeremony.state().collectable", timeout=8000)
        st = frame.evaluate("()=>ApocCeremony.state()")
        check(st['skipped'] and not st['fast'], '沒有新卡：一下就全部略過')
        check(not errors, f'沒有 pageerror：{errors}')
        b.close()
    print('\n' + ('全部通過' if not fails else f'失敗 {len(fails)} 項')); sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
