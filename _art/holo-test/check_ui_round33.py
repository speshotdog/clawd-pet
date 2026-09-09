"""Keyboard and real production controls, without the testing hook."""
import json,shutil
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE
OUT=HERE.parents[1]/'docs/clicker/shots/round33'
portable=OUT/'ui-portable';portable.mkdir(exist_ok=True)
shutil.copy2(HERE/'deluxe-gacha-b-standalone.html',portable/'production.html')
rows=[]
with sync_playwright() as pw:
 b=pw.chromium.launch()
 p=b.new_page(viewport={'width':1440,'height':900})
 p.goto((OUT/'frozen-before-reproduction.html').as_uri())
 p.evaluate('document.fonts.ready')
 p.screenshot(path=str(OUT/'D-before-buttons.png'))
 p.locator('.entry-actions').screenshot(path=str(OUT/'D-before-buttons-detail.png'));p.close()
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable/'production.html')]:
    p=b.new_page(reduced_motion='reduce',viewport={'width':1440,'height':900});errors=[]
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    p.goto(file.as_uri());assert not p.evaluate('!!window.__ceremony')
    p.keyboard.press('Tab');p.keyboard.press('Tab');assert p.locator('#p1').evaluate('e=>e===document.activeElement')
    p.screenshot(path=str(OUT/f'{label}-D-keyboard-focus.png'))
    for i in range(3):
        p.locator('#p10').click();pack=p.locator('#entry-pack[role=button]');pack.wait_for()
        pack.focus();p.keyboard.press('Enter');p.locator('#finish').wait_for();assert p.locator('.slot.done').count()==10
        p.locator('#finish').click();p.locator('.slot').first.wait_for(state='detached')
    row=dict(label=label,ticket=p.locator('#ticket').inner_text(),disabled=p.locator('.pull-actions button').evaluate_all('es=>es.map(e=>({disabled:e.disabled,opacity:getComputedStyle(e).opacity}))'),errors=errors)
    assert row['ticket']=='0' and all(x['disabled'] and float(x['opacity'])<=.4 for x in row['disabled']) and not errors,row
    p.screenshot(path=str(OUT/f'{label}-D-disabled.png'));rows.append(row);p.close()
 for label,file in [('test-dev',HERE/'deluxe-gacha-b-test.html'),('test-portable',OUT/'portable/test.html')]:
    if label=='test-portable':shutil.copy2(HERE/'deluxe-gacha-b-test-standalone.html',file)
    p=b.new_page(viewport={'width':601,'height':640});p.goto(file.as_uri()+'?ceremony-test')
    p.evaluate('__ceremony.reset()');assert p.locator('#ticket').inner_text()=='∞'
    widths=p.evaluate('[601,700,1024,1440].map(width=>CeremonyTable.layout(1,{width,height:640})[0].cw)')
    assert min(widths)>=190,widths
    rows.append(dict(label=label,resetTicket=p.locator('#ticket').inner_text(),singleWidths=widths));p.close()
 b.close()
(OUT/'D-keyboard-disabled.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
