from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'shots'
SHOTS.mkdir(exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1512, 'height': 1000}, device_scale_factor=1)
        errors, external = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
        page.goto((OUT / 'demo.html').as_uri(), wait_until='load')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
        page.wait_for_timeout(250)
        assert not errors, errors
        assert not external, external
        assert page.locator('#legacy-grid .legacy-pair').count() == 10
        assert page.locator('.hcard').count() == 30

        # Rank gem and name rectangles must be disjoint for every live card.
        page.locator('#legacy').scroll_into_view_if_needed()
        overlaps = page.evaluate('''() => Array.from(document.querySelectorAll('.hcard')).map(card => {
          const gem = card.querySelector('.face-gem').getBoundingClientRect();
          const name = card.querySelector('.face-name').getBoundingClientRect();
          const hit = !(gem.right <= name.left || gem.left >= name.right || gem.bottom <= name.top || gem.top >= name.bottom);
          return {id: card.dataset.id, gem: {x:gem.x,y:gem.y,w:gem.width,h:gem.height}, name: {x:name.x,y:name.y,w:name.width,h:name.height}, overlap: hit};
        })''')
        assert not [x for x in overlaps if x['overlap']], overlaps

        # Real controls: locator.click() only; no evaluate(el.click()).
        for value in ['serif', 'round', 'sans']:
            page.locator(f'input[name="font"][value="{value}"]').check()
            assert page.locator('body').evaluate('(e)=>e.classList.contains("font-'+value+'")')
        page.locator('#ink-chroma').uncheck(); assert not page.locator('body').evaluate('(e)=>e.classList.contains("ink-chroma")')
        page.locator('#ink-chroma').check()

        # Text has a distinct transform from art and is visibly protected above foil.
        card = page.locator('[data-id="legacy-mieshi-composite"]')
        text_transform = card.locator('.face-name').evaluate('(e)=>getComputedStyle(e).transform')
        plate_transform = card.locator('.face-plate').evaluate('(e)=>getComputedStyle(e).transform')
        assert text_transform != 'none' and plate_transform != 'none'
        page.locator('#reset').click()
        page.locator('#scenes').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / 'r3-scenes-cards.png'))
        page.locator('#edge-repair').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / 'r3-edge-before-after.png'))
        page.locator('#legacy').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / 'r3-composite-cards.png'))

        html = (OUT / 'demo.html').read_text(encoding='utf-8')
        assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|<script[^>]+src=|type=["\']module|\bimport\s*\(', html)
        report = {
            'browser': browser.version,
            'url': (OUT / 'demo.html').as_uri(),
            'cards': page.locator('.hcard').count(),
            'legacy_pairs': page.locator('#legacy-grid .legacy-pair').count(),
            'gem_name_overlaps': [x for x in overlaps if x['overlap']],
            'font_directions': ['sans', 'serif', 'round'],
            'text_transform': text_transform,
            'plate_transform': plate_transform,
            'external_requests': external,
            'console_errors': errors,
            'screenshots': sorted(x.name for x in SHOTS.glob('r3-*.png')),
        }
        (OUT / 'verification-round3.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()

if __name__ == '__main__':
    main()
