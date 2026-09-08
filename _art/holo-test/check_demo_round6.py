from pathlib import Path
from tempfile import TemporaryDirectory
import json, re, shutil
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'shots'

def check(page, uri, label):
    errors, external = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.goto(uri, wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
    page.wait_for_timeout(300)
    assert not errors, errors
    assert not external, external
    assert page.locator('.hcard').count() == 20
    assert page.locator('.font-picker:visible').count() == 0
    assert page.locator('.gem-picker:visible').count() == 0
    assert page.locator('.name-picker:visible').count() == 0
    assert page.locator('.face-name').first.evaluate('(e) => getComputedStyle(e).fontFamily').lower().find('holo noto sans') >= 0
    layout = page.evaluate('window.holoDemo.snapshot().layout')
    assert all(row['ok'] and row['nameProtected'] for row in layout), layout
    rocket = page.locator('[data-id="rocketdog"]')
    rocket.scroll_into_view_if_needed()
    rocket.screenshot(path=str(SHOTS / f'r6-{label}-rocketdog-card.png'))
    rocket.locator('.face-plate').screenshot(path=str(SHOTS / f'r6-{label}-rocketdog-plaque-closeup.png'))
    page.locator('#reduced').click()
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    page.locator('#reduced').click()
    page.locator('#reset').click()
    page.locator('[data-id="rocketdog"]').hover(position={'x': 0.82, 'y': 0.72})
    page.wait_for_timeout(180)
    page.locator('body').hover(position={'x': 20, 'y': 20})
    page.wait_for_timeout(500)
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    return {'label': label, 'cards': page.locator('.hcard').count(), 'layout_failures': [x for x in layout if not x['ok']], 'name_layer_failures': [x for x in layout if not x['nameProtected']], 'external_requests': external, 'console_errors': errors, 'raf_after_leave': page.evaluate('window.holoDemo.snapshot().raf')}

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1512, 'height': 1000}, device_scale_factor=1)
        results = [check(page, (OUT / 'demo.html').as_uri(), 'dev')]
        with TemporaryDirectory(prefix='holo-r6-copy-') as tmp:
            copied = Path(tmp) / 'portable.html'
            shutil.copy2(OUT / 'demo-standalone.html', copied)
            results.append(check(page, copied.as_uri(), 'standalone-copy'))
        browser.close()
    source = (OUT / 'demo-standalone.html').read_text(encoding='utf-8')
    assert (OUT / 'demo-standalone.html').stat().st_size <= 15 * 1024 * 1024
    assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|type=["\']module|\bimport\s*\(', source)
    report = {'bytes': (OUT / 'demo-standalone.html').stat().st_size, 'results': results, 'standalone_copied': True}
    (OUT / 'verification-round6.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
