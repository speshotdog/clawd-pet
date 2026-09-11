"""Actual browser negative controls for decode/refit reporting and internal transforms."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from check_card_parity import WALK, REFIT, SAMESIZE_JS
from scope3_capture import refit

HERE=Path(__file__).resolve().parent
out={}
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    page=browser.new_page(viewport={'width':1440,'height':1200})
    page.goto((HERE/'cards-remade.html').as_uri());page.evaluate(WALK)
    clean=refit(page,REFIT)
    out['clean']=not clean['errors'] and len(clean['decoded'])>0
    page.evaluate(SAMESIZE_JS,260)
    out['internalTransform']=page.evaluate("""()=>{
      const c=document.querySelector('.hcard[data-id="zhenzhen"]');
      return {art:getComputedStyle(c.querySelector('.art-media')).transform,
              gem:getComputedStyle(c.querySelector('.face-gem')).transform};}""")
    assert out['internalTransform']['art']!='none'
    assert out['internalTransform']['gem']!='none'
    page.evaluate("()=>{const i=document.querySelector('img');i.decode=async()=>{throw Error('injected decode')}}")
    decoded=page.evaluate(REFIT)
    out['decodeFailureRecorded']=any(e['stage']=='decode' and 'injected decode' in e['error'] for e in decoded['errors'])
    page.evaluate("()=>{delete document.querySelector('img').decode;HoloCardFace.refit=()=>{throw Error('injected refit')}}")
    failed=page.evaluate(REFIT)
    out['refitFailureRecorded']=any(e['stage']=='refit' and 'injected refit' in e['error'] for e in failed['errors'])
    try:
        refit(page,REFIT)
        out['callerRejectsFailure']=False
    except RuntimeError:
        out['callerRejectsFailure']=True
    browser.close()
out['pass']=all(out[k] for k in ('clean','decodeFailureRecorded','refitFailureRecorded','callerRejectsFailure'))
path=HERE.parents[1]/'docs/clicker/shots/scope3/capture-controls.json'
path.write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
raise SystemExit(0 if out['pass'] else 1)
