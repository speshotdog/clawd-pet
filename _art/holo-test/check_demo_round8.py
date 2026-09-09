from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json, re, shutil
from tempfile import TemporaryDirectory
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'verify-round27' / 'round8-shots'

def diff(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / 3

def gem_contrast(page, card):
    hit = card.locator('xpath=ancestor::div[contains(@class,"hit")]')
    im = Image.open(BytesIO(hit.screenshot())).convert('RGB')
    box = page.evaluate('(e) => { const h=e.closest(".hit").getBoundingClientRect(), g=e.getBoundingClientRect(); return {x:g.left-h.left,y:g.top-h.top,w:g.width,h:g.height}; }', card.locator('.face-gem').element_handle())
    x, y, w, h = [round(box[k]) for k in ('x', 'y', 'w', 'h')]
    inner = im.crop((x + round(w*.28), y + round(h*.28), x + round(w*.72), y + round(h*.72)))
    rings = [im.crop((max(0,x-8), max(0,y-8), min(im.width,x+w+8), max(0,y-2))), im.crop((max(0,x-8), min(im.height,y+h+2), min(im.width,x+w+8), min(im.height,y+h+8))), im.crop((max(0,x-8), y, min(im.width,x-2), min(im.height,y+h))), im.crop((min(im.width,x+w+2), y, min(im.width,x+w+8), min(im.height,y+h)))]
    g = tuple(round(v) for v in ImageStat.Stat(inner).mean)
    r = tuple(round(sum(ImageStat.Stat(i).mean[k] for i in rings)/len(rings)) for k in range(3))
    return {'delta': round(diff(g, r), 2), 'threshold': 35, 'gem_rgb': g, 'ring_rgb': r}

def check(page, uri, label):
    errors, external = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.goto(uri, wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
    page.wait_for_timeout(250)
    assert not errors, errors
    assert not external, external
    assert page.locator(".hcard").count() == 65
    layers = page.evaluate('window.holoRound8.validateLayers()')
    assert all(x['ok'] for x in layers), layers
    assert all(x['nameCenterDelta'] < 2 and x['rarityCenterDelta'] < 2 and (x['kind'] == 'framed' or x['gemNameGap'] >= 5) for x in layers), layers
    depth = [x for x in layers if x['kind'] == 'depth']
    flat = [x for x in layers if x['kind'] == 'flat']
    assert depth and all(x['subjectAbovePlate'] for x in depth), depth
    assert flat and all(not page.locator(f'[data-id="{x["id"]}"] .subject-mask').count() for x in flat), flat

    rocket = page.locator('[data-id="rocketdog"]')
    rocket.scroll_into_view_if_needed()
    rocket.hover(position={'x': 120, 'y': 210})
    page.wait_for_timeout(180)
    rocket.screenshot(path=str(SHOTS / f'r8-{label}-rocketdog-tilted-closeup.png'))
    page.locator('body').hover(position={'x': 4, 'y': 4})
    page.wait_for_timeout(500)
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    page.locator('#flat-compare-grid').scroll_into_view_if_needed()
    page.locator('#flat-compare-grid').screenshot(path=str(SHOTS / f'r8-{label}-mieshi-flat.png'))
    page.locator('#ranks-grid').scroll_into_view_if_needed()
    page.locator('#ranks-grid').screenshot(path=str(SHOTS / f'r8-{label}-five-rarities.png'))
    page.locator('#gem-proof').scroll_into_view_if_needed()
    page.locator('#gem-proof').screenshot(path=str(SHOTS / f'r8-{label}-gem-original-vs-tuned.png'))

    # Exercise real controls with locator.click(), including the reset path.
    page.locator('#reduced').click()
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    page.locator('#reduced').click()
    page.locator('#reset').click()

    contrasts = []
    for card in page.locator('.hcard').all():
        card.scroll_into_view_if_needed()
        contrasts.append({'id': card.get_attribute('data-id'), **gem_contrast(page, card)})
    assert all(x['delta'] >= 35 for x in contrasts), contrasts
    return {'label': label, 'cards': page.locator('.hcard').count(), 'layers': layers, 'gem_contrast_failures': [x for x in contrasts if x['delta'] < 35], 'external_requests': external, 'console_errors': errors}

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1512, 'height': 1000}, device_scale_factor=1)
        results = [check(page, (OUT / 'demo.html').as_uri(), 'dev')]
        with TemporaryDirectory(prefix='holo-r8-copy-',dir=OUT/'verify-round27') as tmp:
            copied = Path(tmp) / 'portable.html'
            shutil.copy2(OUT / 'demo-standalone.html', copied)
            results.append(check(page, copied.as_uri(), 'standalone-copy'))
        browser.close()
    source = (OUT / 'demo-standalone.html').read_text(encoding='utf-8')
    assert (OUT / 'demo-standalone.html').stat().st_size <= 15 * 1024 * 1024
    assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|type=["\']module|\bimport\s*\(', source)
    report = {'bytes': (OUT / 'demo-standalone.html').stat().st_size, 'results': results, 'standalone_copied': True, 'gem_contrast_threshold': 35}
    (OUT / 'verify-round27' / 'verification-round8.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
