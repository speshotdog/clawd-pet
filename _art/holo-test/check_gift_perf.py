"""Gift-only native frame budget; all evidence and relocated copies stay in worktree."""
import argparse
import json
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'docs/clicker/shots/round39'
SOURCE = ROOT / '_art/holo-test/gift-mohuashaonv.html'


def measure(browser, source, mode='current'):
    page = browser.new_page(viewport={'width': 900, 'height': 1000}, device_scale_factor=2)
    page.add_init_script('''window.appRaf=0; const nativeRaf=window.requestAnimationFrame.bind(window);
      window.measureRaf=nativeRaf;
      window.requestAnimationFrame=cb=>{window.appRaf++;return nativeRaf(cb)};''')
    page.goto(source.as_uri(), wait_until='load')
    page.wait_for_function("[...document.images].every(i=>!i.getAttribute('src')||(i.complete&&i.naturalWidth>0))")
    if mode == 'no-particles':
        page.add_style_tag(content='.gift-particles,.gift-hearts{display:none!important}')
    if mode in ('no-alt', 'no-masks'):
        page.evaluate('''()=>{giftCard.card.querySelectorAll('.art-media img')[1].removeAttribute('src');
          for(const s of ['.subject-mask:not(.special-tint)','.special-tint'])
            giftCard.card.querySelectorAll(s)[1].style.setProperty('--subject','none');}''')
    if mode == 'no-masks':
        page.evaluate("document.querySelectorAll('.subject-mask').forEach(e=>e.style.setProperty('--subject','none'))")
    page.wait_for_timeout(700)
    frames = page.evaluate('''()=>new Promise(resolve=>{
      const s=document.querySelector('#stage'),r=s.getBoundingClientRect(),dt=[];
      let start,last;function frame(t){if(start===undefined){start=t;last=t}else{dt.push(t-last);last=t}
        const a=(t-start)/3000*Math.PI*2;
        s.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+r.width*(.5+.4*Math.cos(a)),
          clientY:r.y+r.height*(.5+.4*Math.sin(a))}));
        if(t-start<3000)measureRaf(frame);else resolve(dt)}measureRaf(frame)} )''')
    page.evaluate("document.querySelector('#stage').dispatchEvent(new PointerEvent('pointerleave'))")
    page.wait_for_timeout(900)
    page.evaluate('window.appRaf=0')
    page.wait_for_timeout(3000)
    idle = page.evaluate('window.appRaf')
    result = dict(mode=mode, fps=len(frames)*1000/sum(frames), medianMs=float(np.median(frames)),
                  p95Ms=float(np.percentile(frames,95)), idleRaf=idle, intervalsMs=frames)
    result['passed'] = result['fps'] >= 35 and result['medianMs'] <= 25 and result['p95Ms'] <= 50 and idle == 0
    page.close()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--tag', default='perf')
    parser.add_argument('--runs', type=int, default=5)
    parser.add_argument('--diagnosis', action='store_true')
    parser.add_argument('--measure-only', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve()
    assert source.is_relative_to(ROOT)
    SHOTS.mkdir(parents=True, exist_ok=True)
    results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--use-angle=d3d11'])
        for run in range(1,args.runs+1):
            if args.diagnosis:
                for mode in ('current','no-particles','no-alt','no-masks'):
                    results.append(dict(run=run,entry='dev',**measure(browser,source,mode)))
            else:
                results.append(dict(run=run,entry='dev',**measure(browser,source)))
                with TemporaryDirectory(dir=SHOTS) as tmp:
                    copy=Path(tmp)/source.name
                    shutil.copyfile(source,copy)
                    results.append(dict(run=run,entry='moved-copy',**measure(browser,copy)))
            (SHOTS/(args.tag+'.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
            for row in results[-(4 if args.diagnosis else 2):]:
                print(json.dumps({k:v for k,v in row.items() if k!='intervalsMs'}),flush=True)
        browser.close()
    if not (args.diagnosis or args.measure_only):
        assert all(r['passed'] for r in results), 'frame budget failed; see recorded measurements'


if __name__ == '__main__':
    main()
