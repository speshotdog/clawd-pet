"""Compare both requested glow constructions on unchanged production HTML."""
import json
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
from check_gacha_round34 import HERE, OUT, SEED, capture, timing
from check_gacha_ceremony_round28 import open_page

FILTER='.stage-geometry{filter:drop-shadow(0 0 1px white) drop-shadow(0 0 2px white)}.focus-held .stage-geometry{filter:none}'
# Each shape is defined once; both strokes share its geometry and animation owner.
DOUBLE=r'''()=>{const svg=document.querySelector('.summoning-geometry'),ns=svg.namespaceURI,defs=svg.querySelector('defs');
let i=0;for(const e of [...svg.querySelectorAll('path,circle,ellipse')]){
 if(e.closest('defs')||getComputedStyle(e).stroke==='none')continue;
 const g=document.createElementNS(ns,'g'),shape=document.createElementNS(ns,e.localName);
 for(const a of [...e.attributes]){if(['d','cx','cy','r','rx','ry'].includes(a.name))shape.setAttribute(a.name,a.value);else g.setAttribute(a.name,a.value)}
 const id='glow-path-'+i++;shape.id=id;defs.append(shape);
 const halo=document.createElementNS(ns,'use'),core=document.createElementNS(ns,'use');
 halo.setAttribute('href','#'+id);core.setAttribute('href','#'+id);halo.setAttribute('class','geometry-halo');
 halo.setAttribute('stroke-width','3');halo.setAttribute('opacity','.65');halo.setAttribute('fill','none');
 g.append(halo,core);e.replaceWith(g);
}}'''
DOUBLE_CSS='.focus-held .geometry-halo{display:none}'

def metrics(label):
    a=np.asarray(Image.open(OUT/'before-idle.png').convert('L'),dtype=float)
    off=np.asarray(Image.open(OUT/'before-idle-no-geometry.png').convert('L'),dtype=float)
    b=np.asarray(Image.open(OUT/(label+'-idle.png')).convert('L'),dtype=float)
    mask=a>off
    # Top vertical axis: fixed original path crosses y=80..159 at x=720.
    widths=[]
    for im in [a,b]:
        widths.append(float(np.mean([np.count_nonzero(im[y,710:730]>off[y,710:730]+10) for y in range(80,160)])))
    return dict(meanBefore=float(a.mean()),meanAfter=float(b.mean()),meanRatio=float(b.mean()/a.mean()),linePixels=int(mask.sum()),lineBefore=float(a[mask].mean()),lineAfter=float(b[mask].mean()),lineRatio=float(b[mask].mean()/a[mask].mean()),widthBefore=widths[0],widthAfter=widths[1],widthRatio=widths[1]/widths[0])

def main():
    rows={}
    with sync_playwright() as pw:
        b=pw.chromium.launch(args=['--allow-file-access-from-files'])
        file=HERE/'deluxe-gacha-b.html'
        for label,css,script in [('filter',FILTER,None),('double',DOUBLE_CSS,DOUBLE)]:
            p,errors=open_page(b,file.as_uri());p.set_viewport_size(dict(width=1440,height=900));p.evaluate(SEED)
            if script:p.evaluate(script)
            p.add_style_tag(content=css)
            # Newly created animation owners must use the same frozen phase.
            p.evaluate("document.querySelectorAll('.stage-background *').forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=0}))")
            capture(p,label+'-idle')
            if script:(OUT/'double-candidate.svg').write_text(p.locator('.summoning-geometry').evaluate('e=>e.outerHTML'),encoding='utf-8')
            p.close()
            rows[label]=dict(timing=timing(b,file,label,css,script),pixels=metrics(label))
            (OUT/'glow-candidates.json').write_text(json.dumps(rows,indent=2))
        b.close()

if __name__=='__main__':main()
