# -*- coding: utf-8 -*-
"""1.0 抽卡：神話卡不可以比其他卡矮（使用者 2026-09-16 截圖：神話卡「變超短」）。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-mythic-height.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave, B=ClickerBalance, E=ClickerEconomy; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters);
  s.collection=Object.fromEntries(ids.map(i=>[i,3])); s.partnerLevels=Object.fromEntries(ids.map(i=>[i,20]));
  s.clickLevel=80; s.trainingLevel=20; s.coins=1e14; s.lifetimeCoins=1e15;
  s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.settings.scene='backyard'; s.package=E.newPackage('backyard',30);
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""
# 稀有度骰：x∈[.05,.055) 是神話（傳說 50/1000、神話 5/1000）。奇數次回 .052、偶數次回 .4 → 一包裡神話與非神話都有
RIG = "(()=>{let n=0; const seq=[.052,.4,.052,.4,.4,.4]; Math.random=()=>seq[n++%seq.length];})()"

def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={'width': 1500, 'height': 1000}, device_scale_factor=1)
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED); pg.reload(); pg.wait_for_function('!document.getElementById("tap").disabled'); pg.wait_for_timeout(1400)
        pg.evaluate(RIG)
        pg.wait_for_function('!document.getElementById("draw-five").disabled', timeout=15000); pg.locator('#draw-five').click()
        pg.wait_for_timeout(1200); pg.locator('#reveal-all').click(timeout=15000); pg.wait_for_timeout(2600)
        pg.wait_for_function('!document.getElementById("collect").hidden', timeout=15000); pg.wait_for_timeout(600)
        cards = pg.evaluate("""()=>[...document.querySelectorAll('#cards .card')].map(el=>{const r=el.getBoundingClientRect();
          const face=el.querySelector('.card-face'), fr=face.getBoundingClientRect();
          const s=getComputedStyle(el);
          return {rarity:[...el.classList].find(c=>c.startsWith('r-')), w:+r.width.toFixed(1), h:+r.height.toFixed(1),
                  faceH:+fr.height.toFixed(1), cssH:s.height, transform:s.transform, cls:el.className};})""")
        for c in cards: print(c)
        pg.screenshot(path=str(OUT / 'mythic-height.png'))
        my = [c for c in cards if c['rarity']=='r-mythic']; other = [c for c in cards if c['rarity']!='r-mythic']
        check(my and other, '一包裡同時有神話與非神話：%d / %d' % (len(my), len(other)))
        if my and other:
            check(min(c['h'] for c in my) >= min(c['h'] for c in other) - 2, '神話卡外框高度不比別張矮：神話 %s vs 其他 %s' % ([c['h'] for c in my],[c['h'] for c in other]))
            check(min(c['faceH'] for c in my) >= min(c['faceH'] for c in other) - 2, '神話卡卡面高度不比別張矮：神話 %s vs 其他 %s' % ([c['faceH'] for c in my],[c['faceH'] for c in other]))
        # 2026-09-16：1.0 卡面右上角本來就有 NEW／2★ → 3★ 小標，卡頂不再重複掛「新夥伴／★2→★3」（2.0 不動）
        tags = pg.evaluate("()=>[...document.querySelectorAll('#cards .card')].map(el=>({face:el.querySelector('.face-tag')?.textContent||'', top:[...el.querySelectorAll('.draw-badge')].map(b=>b.className.replace('draw-badge','').trim()+':'+b.textContent)}))")
        print(tags)
        check(all(t['face'] for t in tags), '1.0 每張結果卡的卡面都有右上角小標')
        check(not any(k.startswith('new:') or k.startswith('star:') for t in tags for k in t['top']), '1.0 卡頂沒有再疊「新夥伴／★→★」：%s' % [t['top'] for t in tags])
        check(not errors, '沒有 pageerror：%s' % errors)
        b.close()
    print('\n' + ('全部通過' if not fails else '失敗 %d 項' % len(fails)))
    sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
