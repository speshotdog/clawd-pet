"""Verify every visible roster member at actual and required reserve scale."""
import json
from check_card_feel import HERE, OUT, freeze
from playwright.sync_api import sync_playwright

rows=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    p=browser.new_page()
    for w,h in [(1440,900),(1024,768),(390,844)]:
        p.set_viewport_size({'width':w,'height':h})
        p.goto((HERE/'map20.html').as_uri()+'?screen=team');p.evaluate('document.fonts.ready')
        for scale in [1.04,1.06]:
            for page in [0,1]:
                p.evaluate('(n)=>team20.showPage(n)',page)
                ids=p.locator('#team-grid .team-proxy:not([hidden])').evaluate_all('es=>es.map(e=>e.dataset.id)')
                for ident in ids:
                    p.evaluate('(id)=>team20.select(id)',ident)
                    loc=p.locator(f'#team-grid [data-id="{ident}"] .overview-face')
                    loc.evaluate('(e,s)=>e.style.scale=s',str(scale));loc.scroll_into_view_if_needed();freeze(p)
                    row=loc.evaluate('''e=>{const r=e.getBoundingClientRect(),v=document.querySelector('.roster-scroll').getBoundingClientRect();const area=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));const lim={left:Math.max(0,v.left),right:Math.min(innerWidth,v.right),top:Math.max(0,v.top),bottom:Math.min(innerHeight,v.bottom)};return {clipped:100*(1-area(r,lim)/(r.width*r.height)),overlap:[...document.querySelectorAll('#team-grid .team-proxy:not([hidden]) .overview-face')].filter(x=>x!==e).reduce((n,x)=>n+area(r,x.getBoundingClientRect()),0)/(r.width*r.height)*100}}''')
                    rows.append(dict(width=w,scale=scale,page=page,id=ident,**row))
                    loc.evaluate("e=>e.style.removeProperty('scale')")
    browser.close()
result={'rows':rows,'summary':[{'width':w,'scale':s,'max_clipped_percent':max(r['clipped'] for r in rows if r['width']==w and r['scale']==s),'max_overlap_percent':max(r['overlap'] for r in rows if r['width']==w and r['scale']==s)} for w in [1440,1024,390] for s in [1.04,1.06]]}
(OUT/'clearance.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result['summary'],indent=2))
raise SystemExit(int(any(r['clipped']>0.001 or r['overlap']>0.001 for r in rows)))
