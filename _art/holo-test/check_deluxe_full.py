# -*- coding: utf-8 -*-
"""Playwright 驗收：整頁式精裝抽卡原型。

對應 BRIEF-deluxe-fullscreen-impl.md 最後一節列出的驗收項目。
跑法：PYTHONIOENCODING=utf-8 python _art/holo-test/check_deluxe_full.py
"""
from pathlib import Path
import json, re, sys
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
PAGE = OUT / 'deluxe-gacha-full.html'
SHOTS = OUT / 'shots'
SHOTS.mkdir(exist_ok=True)

RARITIES = ('common', 'rare', 'epic', 'legendary', 'mythic')


def click_any(page, patterns, timeout=4000):
    """按下第一個文字符合的可見按鈕，回傳有沒有按到。"""
    for pat in patterns:
        loc = page.locator(f'button:visible:has-text("{pat}")').first
        try:
            if loc.count() and loc.is_enabled(timeout=800):
                loc.click(timeout=timeout)
                return pat
        except Exception:
            continue
    return None


def run():
    report = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 860}, device_scale_factor=2)
        errors, failed = [], []
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)[:200]))
        page.on('console', lambda m: errors.append('console: ' + m.text[:160]) if m.type == 'error' else None)
        page.on('requestfailed', lambda r: failed.append(r.url[-70:]))
        page.goto(PAGE.resolve().as_uri(), wait_until='load')
        page.wait_for_timeout(1500)
        page.screenshot(path=str(SHOTS / 'r15-full-entry.png'))

        # 十連
        pulled = click_any(page, ['十連', '10', '十'])
        report['pull_button'] = pulled
        page.wait_for_timeout(3500)
        page.screenshot(path=str(SHOTS / 'r15-full-dealt.png'))
        click_any(page, ['全部', '自動', '全部揭曉'])
        page.wait_for_timeout(18000)
        page.screenshot(path=str(SHOTS / 'r15-full-result.png'))

        report['cards'] = page.evaluate("""() => {
          const faces=[...document.querySelectorAll('.hcard')];
          const vis=faces.filter(c=>{const r=c.getBoundingClientRect();
            return r.width>4 && r.height>4 && r.bottom>0 && r.top<innerHeight;});
          return {total:faces.length, onScreen:vis.length,
                  rarities:vis.map(c=>c.dataset.rarity||null),
                  minCardW:Math.round(Math.min(...vis.map(c=>c.getBoundingClientRect().width||9999)))};
        }""")

        report['names'] = page.evaluate("""() => {
          const rows=[...document.querySelectorAll('.hcard')].map(c=>{
            const n=c.querySelector('.face-name'); if(!n) return null;
            const cs=getComputedStyle(n); const p=c.querySelector('.face-plate');
            // .face-name 是塊元素，量它的 rect 等於量文字框；要量文字本身得用 Range
            const g=c.querySelector('.face-gem');
            const rg=document.createRange(); rg.selectNodeContents(n);
            const tw=rg.getBoundingClientRect(), cr=c.getBoundingClientRect();
            const pcs=p?getComputedStyle(p):null, pr=p?p.getBoundingClientRect():null;
            const cx=cr.left+cr.width/2;
            const toPlate=p?(pr.right-parseFloat(pcs.paddingRight))-cx:0;
            const toGem=g?cx-g.getBoundingClientRect().right:toPlate;
            const room=2*Math.min(toPlate,toGem);
            return {fs:+parseFloat(cs.fontSize).toFixed(1), overflow:tw.width>room,
                    gapToGem:+(tw.left-(g?g.getBoundingClientRect().right:0)).toFixed(1)};
          }).filter(Boolean);
          return {min:Math.min(...rows.map(r=>r.fs)), max:Math.max(...rows.map(r=>r.fs)),
                  overflowing:rows.filter(r=>r.overflow).length, n:rows.length,
                  minGapToGem:+Math.min(...rows.map(r=>r.gapToGem)).toFixed(1)};
        }""")

        report['centring'] = page.evaluate("""() => {
          const out=[];
          for(const c of document.querySelectorAll('.hcard.kind-framed')){
            const img=c.querySelector('.art-media img'), box=c.querySelector('.art-media');
            if(!img||!box) continue;
            const ib=img.getBoundingClientRect(), bb=box.getBoundingClientRect();
            out.push(+Math.abs((ib.top+ib.bottom)/2-(bb.top+bb.bottom)/2).toFixed(2));
          }
          return {worstOffsetPx: out.length?Math.max(...out):null, n:out.length};
        }""")

        report['leftovers'] = page.evaluate("""() => ({
          animations:document.getAnimations().length,
          particles:document.querySelectorAll('.spark,.shock,.ray,[class*=particle]').length})""")

        report['touch_targets'] = page.evaluate("""() => {
          const small=[...document.querySelectorAll('button:not([hidden])')].filter(b=>{
            const r=b.getBoundingClientRect(); return r.width>0 && (r.width<44||r.height<44);});
          return {tooSmall:small.length, labels:small.slice(0,5).map(b=>b.textContent.trim().slice(0,12))};
        }""")

        # 沒有保底：直接打抽樣函式，抽 200 次十連看分布
        report['pity'] = page.evaluate("""() => {
          const fn = window.__draw || (window.deluxe && window.deluxe.draw);
          if(typeof fn !== 'function') return {available:false};
          const counts={}, noHigh=[];
          for(let i=0;i<200;i++){
            const pack=fn(10);
            let high=0;
            for(const c of pack){counts[c.rarity]=(counts[c.rarity]||0)+1;
              if(c.rarity==='legendary'||c.rarity==='mythic')high++;}
            if(high===0) noHigh.push(i);
          }
          return {available:true, counts, packsWithNoHighRarity:noHigh.length};
        }""")

        report['console_errors'] = errors[:6]
        report['failed_requests'] = failed[:6]
        browser.close()
    return report


if __name__ == '__main__':
    if not PAGE.exists():
        print('deluxe-gacha-full.html 還沒產生'); sys.exit(2)
    r = run()
    (OUT / 'verification-deluxe-full.json').write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(r, ensure_ascii=False, indent=2))
