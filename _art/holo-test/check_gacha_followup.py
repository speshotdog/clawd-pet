"""Targeted lifecycle and resize probes; no implementation files are changed."""
import json, sys
from check_card_sizing import check_sizing
from pathlib import Path
from playwright.sync_api import sync_playwright
from check_gacha_card_regression import HERE, OUT, MEASURE, settle

with sync_playwright() as pw:
    b=pw.chromium.launch()
    check_sizing(b)
    if "--sizing-only" in sys.argv:
        b.close();sys.exit(0)
    p=b.new_page(viewport={'width':1512,'height':1000})
    p.add_init_script("""(()=>{const Original=ResizeObserver;window.__observed=new Set();window.ResizeObserver=class extends Original{observe(e,...a){__observed.add(e);return super.observe(e,...a)}unobserve(e){__observed.delete(e);return super.unobserve(e)}disconnect(){return super.disconnect()}}})()""")
    p.goto((HERE/'deluxe-gacha-b.html').as_uri())
    p.locator('#p10').click();p.locator('#entry-pack[role=button]').click()
    p.locator('#finish').wait_for(state='visible',timeout=60000)
    p.wait_for_function('document.querySelectorAll(".slot .hcard").length===10');p.mouse.move(1,1);settle(p)
    native=p.locator('.slot .hcard').evaluate_all('(cs)=>cs.map('+MEASURE+')')
    p.evaluate("()=>document.querySelectorAll('.slot .hcard').forEach(c=>HoloCardFace.fit(c,parseFloat(getComputedStyle(c).width)))")
    refit=p.locator('.slot .hcard').evaluate_all('(cs)=>cs.map('+MEASURE+')')
    p.locator('#finish').click()
    retained=p.evaluate('()=>[...__observed].filter(c=>c.matches(".hcard")&&!c.isConnected).length')
    p.goto((HERE/'cards-remade.html').as_uri());settle(p)
    p.evaluate("""()=>{window.c=document.querySelector('#grid [data-id="dino"]');window.h=c.parentElement;h.style.cssText='position:fixed;left:100px;top:100px;width:290px;height:406px';document.body.append(h);c.querySelector('.face-name').textContent='這是一張用來驗證縮字下限與恢復能力的超長卡片名稱';HoloCardFace.fit(c,290)}""")
    long=p.locator('body > .hit .hcard').evaluate(MEASURE)
    restore=[]
    for w in [80,290]:
        p.evaluate('(w)=>{h.style.width=w+"px";h.style.height=w*1.4+"px"}',w);settle(p)
        restore.append(p.locator('body > .hit .hcard').evaluate(MEASURE))
    p.evaluate("()=>{c.querySelector('.face-name').textContent='小恐龍';HoloCardFace.fit(c,290)}")
    short=p.locator('body > .hit .hcard').evaluate(MEASURE)
    result={'native':native,'neutralRefit':refit,'detachedStillObserved':retained,'long':long,'sameNodeResize':restore,'restoredShort':short}
    (OUT/'followup.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'detachedStillObserved':retained,'nativeFitChanges':sum(a['layers']['.face-name']['styles']['fontSize']!=z['layers']['.face-name']['styles']['fontSize'] for a,z in zip(native,refit)),'longFits':long['nameFits'],'longWidth':long['rangeWidth'],'longRoom':long['room'],'restoredShortFs':short['layers']['.face-name']['styles']['fontSize']}))
    assert retained==0, result
    assert all(a['layers']['.face-name']['styles']['fontSize']==z['layers']['.face-name']['styles']['fontSize'] for a,z in zip(native,refit)), 'neutral refit changed settled text'
    assert long['nameFits']=='false' and abs(float(long['layers']['.face-name']['styles']['fontSize'].removesuffix('px'))-24*.55)<.02
    assert short['nameFits']=='true' and short['layers']['.face-name']['styles']['fontSize']=='24px'
    b.close()
