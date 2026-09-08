from pathlib import Path
from tempfile import TemporaryDirectory
import json, re, shutil
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'shots'

def check(page, uri, label):
    errors=[]; external=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:','https:')) else None)
    page.goto(uri, wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)')
    page.wait_for_timeout(250)
    assert not errors, errors
    assert not external, external
    assert page.locator('#scenes-grid .hcard').count() == 4
    assert page.locator('#ranks-grid .hcard').count() == 5
    assert page.locator('.hcard').count() == 20
    page.locator('input[name="gem"][value="faceted"]').click()
    page.locator('input[name="name-style"][value="pixel"]').click()
    page.locator('input[name="name-style"][value="relief"]').click()
    page.locator('input[name="name-style"][value="slant"]').click()
    assert page.locator('body.name-slant').count() == 1
    layout = page.evaluate('window.holoDemo.snapshot().layout')
    assert all(row['ok'] for row in layout), layout
    page.locator('#reset').click()
    page.locator('#scenes').scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / f'r5-{label}-scenes.png'))
    page.locator('#rarities').scroll_into_view_if_needed()
    page.screenshot(path=str(SHOTS / f'r5-{label}-five-rarities.png'))
    page.locator('#scenes-grid .hcard').nth(0).hover()
    page.wait_for_timeout(180)
    page.locator('body').hover(position={'x':20,'y':20})
    page.wait_for_timeout(250)
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    return {'label':label,'cards':page.locator('.hcard').count(),'external_requests':external,'console_errors':errors,'layout_failures':[x for x in layout if not x['ok']],'raf_after_leave':page.evaluate('window.holoDemo.snapshot().raf')}

def main():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1512,'height':1000}, device_scale_factor=1)
        results.append(check(page, (OUT/'demo.html').as_uri(), 'dev'))
        with TemporaryDirectory(prefix='holo-r5-copy-') as tmp:
            copied=Path(tmp)/'portable.html'
            shutil.copy2(OUT/'demo-standalone.html', copied)
            results.append(check(page, copied.as_uri(), 'standalone-copy'))
        browser.close()
    source=(OUT/'demo-standalone.html').read_text(encoding='utf-8')
    assert 'http://' not in source and 'https://' not in source
    assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|type=["\']module', source)
    report={'bytes':(OUT/'demo-standalone.html').stat().st_size,'results':results,'standalone_copied':True}
    (OUT/'verification-round5.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
