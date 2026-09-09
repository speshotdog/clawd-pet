"""Matched native Chrome/GPU timing; keep the software-renderer results as well."""
import json,shutil,sys
from playwright.sync_api import sync_playwright
from check_gacha_round34 import HERE,OUT,timing
from check_glow_candidates_round34 import FILTER,DOUBLE,DOUBLE_CSS

def main():
    html=(HERE/'deluxe-gacha-b.html').read_text(encoding='utf-8')
    for name in ['ceremony-background.svg','ceremony.css','ceremony-layout.js','ceremony-fx.js']:
        current=(HERE/name).read_text(encoding='utf-8');original=(OUT/'source-before'/name).read_text(encoding='utf-8')
        assert html.count(current)==1,name
        html=html.replace(current,original)
    baseline=HERE/'baseline-round34.html';baseline.write_text(html,encoding='utf-8')
    portable=OUT/'gpu-portable/production.html';portable.parent.mkdir(exist_ok=True)
    shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',portable)
    rows={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chrome',args=['--allow-file-access-from-files'])
        p=browser.new_page();environment=p.evaluate("()=>{const gl=document.createElement('canvas').getContext('webgl'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),userAgent:navigator.userAgent}}")
        p.close();environment['version']=browser.version
        for label,file,css,script in [('baseline',baseline,'',None),('filter',baseline,FILTER,None),('double',baseline,DOUBLE_CSS,DOUBLE.replace("'opacity','.65'","'opacity','.5'")),('final-dev',HERE/'deluxe-gacha-b.html','',None),('final-portable',portable,'',None)]:
            rows[label]=timing(browser,file,label,css,script,warmup='--warmup' in sys.argv)
            (OUT/'gpu-timing.json').write_text(json.dumps(dict(environment=environment,results=rows),indent=2))
        browser.close()
    baseline.unlink()
    base=rows['baseline']['p95']
    return int(any(rows[k]['p95']>20 or rows[k]['p95']>base+2 for k in ['double','final-dev','final-portable']))

if __name__=='__main__':raise SystemExit(main())
