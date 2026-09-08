from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright

OUT=Path(__file__).parent; SHOTS=OUT/'shots'; SHOTS.mkdir(exist_ok=True)
def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True); page=browser.new_page(viewport={'width':1512,'height':1000},device_scale_factor=1)
    errors=[]; external=[]; page.on('pageerror',lambda e:errors.append(str(e))); page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None); page.on('request',lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.goto((OUT/'demo.html').as_uri(),wait_until='load'); page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)'); page.wait_for_timeout(400)
    assert not errors, errors; assert not external, external
    assert page.locator('#legacy-grid .hcard').count()==10
    assert page.locator('#scenes-grid .hcard').count()==4 and page.locator('#ranks-grid .hcard').count()==5
    assert page.locator('.hcard').count()==20
    for value in ['noto-sans','noto-serif','system']:
      page.locator(f'input[name="font"][value="{value}"]').click(); assert page.locator('body').evaluate('(e)=>e.classList.contains("font-'+value+'")')
    for value in ['orbit','prism','faceted']:
      page.locator(f'input[name="gem"][value="{value}"]').click(); assert page.locator('body').evaluate('(e)=>e.classList.contains("gem-'+value+'")')
    layout=page.evaluate('window.holoDemo.snapshot().layout'); assert all(x['ok'] for x in layout), layout
    page.locator('#reset').click(); page.locator('#scenes').scroll_into_view_if_needed(); page.screenshot(path=str(SHOTS/'r4-scenes-cards.png'),full_page=False)
    page.locator('#rarities').scroll_into_view_if_needed(); page.screenshot(path=str(SHOTS/'r4-five-rarities.png'),full_page=False)
    page.locator('#legacy').scroll_into_view_if_needed(); page.screenshot(path=str(SHOTS/'r4-legacy-cards.png'),full_page=False)
    page.locator('[data-id="legacy-mieshi-original"]').scroll_into_view_if_needed(); page.screenshot(path=str(SHOTS/'r4-bleed-cards.png'),full_page=False)
    page.locator('#scenes-grid .hcard').nth(0).hover(); page.wait_for_timeout(180); page.locator('body').hover(position={'x':20,'y':20}); page.wait_for_timeout(250); raf=page.evaluate('window.holoDemo.snapshot().raf'); assert raf==0, raf
    html=(OUT/'demo.html').read_text(encoding='utf-8'); assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|<script[^>]+src=|type=["\']module|\bimport\s*\(',html)
    report={'browser':browser.version,'cards':page.locator('.hcard').count(),'legacy_cards':page.locator('#legacy-grid .hcard').count(),'layout_failures':[x for x in layout if not x['ok']],'external_requests':external,'console_errors':errors,'raf_after_leave':raf,'screenshots':sorted(x.name for x in SHOTS.glob('r4-*.png'))}
    (OUT/'verification-round4.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8'); print(json.dumps(report,ensure_ascii=False,indent=2)); browser.close()
if __name__=='__main__': main()
