from pathlib import Path
from tempfile import TemporaryDirectory
import json, re, shutil
from io import BytesIO
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'shots'

def rgb_diff(a, b):
    return sum(abs(x-y) for x, y in zip(a, b)) / 3

def gem_contrast(page, card):
    hit = card.locator('xpath=ancestor::div[contains(@class,"hit")]')
    png = hit.screenshot()
    im = Image.open(BytesIO(png)).convert('RGB')
    hr = page.evaluate('(e) => { const h=e.closest(".hit").getBoundingClientRect(), g=e.getBoundingClientRect(); return {x:g.left-h.left,y:g.top-h.top,w:g.width,h:g.height}; }', card.locator('.face-gem').element_handle())
    x, y, w, h = [round(hr[k]) for k in ('x','y','w','h')]
    inner = [im.crop((x+round(w*.28), y+round(h*.28), x+round(w*.72), y+round(h*.72)))]
    rings = []
    for box in ((max(0,x-8),max(0,y-8),min(im.width,x+w+8),max(0,y-2)),
                (max(0,x-8),min(im.height,y+h+2),min(im.width,x+w+8),min(im.height,y+h+8)),
                (max(0,x-8),y,min(im.width,x-2),min(im.height,y+h)),
                (min(im.width,x+w+2),y,min(im.width,x+w+8),min(im.height,y+h))):
        if box[2] > box[0] and box[3] > box[1]: rings.append(im.crop(box))
    gem = tuple(round(v) for v in ImageStat.Stat(inner[0]).mean)
    bg = tuple(round(sum(ImageStat.Stat(r).mean[i] for r in rings)/len(rings)) for i in range(3))
    return {'delta': round(rgb_diff(gem,bg),2), 'gem_rgb': gem, 'ring_rgb': bg, 'threshold': 35}

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
    assert page.locator('.hcard').count() == 22
    layout = page.evaluate('window.holoDemo.snapshot().layout')
    assert all(x['ok'] for x in layout), layout
    assert page.locator('.hcard .face-plate').evaluate_all('(es) => es.every(e => { const s=getComputedStyle(e); return s.backgroundColor === "rgba(0, 0, 0, 0)" && s.borderTopWidth === "0px"; })')
    assert page.locator('.hcard.r-common .face-name, .hcard.r-rare .face-name, .hcard.r-epic .face-name').evaluate_all('(es) => es.every(e => getComputedStyle(e).color === "rgb(255, 255, 255)" && getComputedStyle(e).textShadow === "none")')

    # Required visual evidence.
    rocket = page.locator('[data-id="rocketdog"]')
    rocket.scroll_into_view_if_needed(); rocket.screenshot(path=str(SHOTS / f'r7-{label}-rocketdog-fullbleed.png'))
    page.locator('#flat-compare-grid').scroll_into_view_if_needed(); page.locator('#flat-compare-grid').screenshot(path=str(SHOTS / f'r7-{label}-mieshi-depth-vs-flat.png'))
    page.locator('#ranks-grid').scroll_into_view_if_needed(); page.locator('#ranks-grid').screenshot(path=str(SHOTS / f'r7-{label}-five-rarities.png'))

    contrasts = []
    for card in page.locator('.hcard').all():
        card.scroll_into_view_if_needed()
        contrasts.append({'id': card.get_attribute('data-id'), **gem_contrast(page, card)})
    assert all(x['delta'] >= x['threshold'] for x in contrasts), contrasts

    # Exercise the real UI control and the requested click API.
    page.locator('.gem-picker label').nth(1).click()
    page.wait_for_timeout(100)
    frame_layout = page.evaluate('window.holoDemo.snapshot().layout')
    assert all(x['ok'] for x in frame_layout), frame_layout
    page.locator('#reduced').click()
    assert page.evaluate('window.holoDemo.snapshot().raf') == 0
    page.locator('#reduced').click()
    page.locator('#reset').click()
    return {'label': label, 'cards': page.locator('.hcard').count(), 'layout_failures': [x for x in layout if not x['ok']], 'gem_contrast_failures': [x for x in contrasts if x['delta'] < x['threshold']], 'external_requests': external, 'console_errors': errors}

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1512, 'height': 1000}, device_scale_factor=1)
        results = [check(page, (OUT / 'demo.html').as_uri(), 'dev')]
        with TemporaryDirectory(prefix='holo-r7-copy-') as tmp:
            copied = Path(tmp) / 'portable.html'
            shutil.copy2(OUT / 'demo-standalone.html', copied)
            results.append(check(page, copied.as_uri(), 'standalone-copy'))
        browser.close()
    source = (OUT / 'demo-standalone.html').read_text(encoding='utf-8')
    assert (OUT / 'demo-standalone.html').stat().st_size <= 15 * 1024 * 1024
    assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|type=["\']module|\bimport\s*\(', source)
    report = {'bytes': (OUT / 'demo-standalone.html').stat().st_size, 'results': results, 'standalone_copied': True, 'gem_contrast_threshold': 35}
    (OUT / 'verification-round7.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
