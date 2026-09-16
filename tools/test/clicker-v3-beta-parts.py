# -*- coding: utf-8 -*-
"""第 20 站滿版王（滅世珍獸）輪到「部位」機制時，頭／身／尾三顆圓鈕要在舞台裡、釘在珍獸身上、點得到
（朋友 2026-09-16：「跑位，看不到身體標記」——以前用置中王的比例算，頭尾落在舞台外）。桌機＋手機直式各一次。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-beta-parts.py"""
import mimetypes, re, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/beta-parts'
OUT.mkdir(parents=True, exist_ok=True)
SEED = re.search(r'SEED_APOC = """(.*?)"""', (ROOT / 'tools/test/clicker-v3-beta-bosses.py').read_text(encoding='utf-8'), re.S).group(1)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

PROBE = """()=>{const A=ApocEconomy, st=Clicker.state.apoc.stage; const info=A.bossInfo(st,Date.now()); const stg=document.getElementById('stage').getBoundingClientRect();
  const parts=[...document.querySelectorAll('#apoc-parts button')].map(b=>{const r=b.getBoundingClientRect(); const top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {part:b.dataset.part, x:Math.round((r.left+r.width/2-stg.left)/stg.width*100), y:Math.round((r.top+r.height/2-stg.top)/stg.height*100),
            inStage:r.left>=stg.left-1&&r.right<=stg.right+1&&r.top>=stg.top-1&&r.bottom<=stg.bottom+1, hit:top===b||b.contains(top)};});
  return {mech:info.mech, full:document.getElementById('apoc-enemy').classList.contains('full-board'), hidden:document.getElementById('apoc-parts').hidden, parts};}"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        for label, vp, mob in [('桌機', {'width': 1280, 'height': 860}, False), ('手機直式', {'width': 390, 'height': 844}, True)]:
            ctx = b.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
            def route(r):
                path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
                if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            ctx.route('**/*', route)
            ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
            pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
            pg.evaluate(SEED, 19); pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
            pg.evaluate("()=>{for(const id of ['update-notes','daily-done']){const el=document.getElementById(id); if(el&&!el.hidden) el.querySelector('button')?.click();}}")
            pg.wait_for_function("()=>!!Clicker.state.apoc?.stage", timeout=10000); pg.wait_for_timeout(800)
            # 滅世珍獸每 15 秒換機制：把開打時間撥到 46 秒前 → 部位那一段；期限順延
            pg.evaluate("()=>{const st=Clicker.state.apoc.stage; st.startedAt=Date.now()-46000; st.deadline=Date.now()+40000;}"); pg.wait_for_timeout(1200)
            r = pg.evaluate(PROBE)
            check(r['full'] and r['mech'] == 3 and not r['hidden'], f'{label}：滿版王輪到部位機制、圓鈕有顯示：{ {k: r[k] for k in ("full", "mech", "hidden")} }')
            check(len(r['parts']) == 3 and all(x['inStage'] for x in r['parts']), f'{label}：三顆圓鈕都在舞台裡：{[(x["part"], x["x"], x["y"]) for x in r["parts"]]}')
            check(all(x['hit'] for x in r['parts']), f'{label}：三顆圓鈕都點得到（沒被別的東西蓋住）')
            head = next(x for x in r['parts'] if x['part'] == 'head'); body = next(x for x in r['parts'] if x['part'] == 'body')
            check(not (66 <= body['x'] <= 78 and 38 <= body['y'] <= 56), f'{label}：「身」不能壓在羊角上（x {body["x"]}% y {body["y"]}%）')
            check(45 <= head['x'] <= 60 and 38 <= head['y'] <= 55, f'{label}：「頭」釘在珍獸的臉上（x {head["x"]}% y {head["y"]}%）')
            pg.screenshot(path=str(OUT / f'st20-{label}.png'))
            check(not errors, f'{label}：沒有 pageerror：{errors}')
            ctx.close()
        b.close()
    print('\n' + ('全部通過' if not fails else f'失敗 {len(fails)} 項')); sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
