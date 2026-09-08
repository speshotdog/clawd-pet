from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
SHOTS = OUT / 'shots'
SHOTS.mkdir(exist_ok=True)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1512, 'height': 1000}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.goto((OUT / 'demo.html').as_uri(), wait_until='load')
        page.wait_for_function('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)')
        page.wait_for_timeout(250)
        assert not errors, errors
        assert page.locator('#legacy-grid .legacy-pair').count() == 10
        assert page.locator('.hcard').count() == 30
        rare = page.locator('[data-id="rank-rare-zhenwang"]')
        relief = rare.locator('.face-depth-bg .foil-relief').evaluate('(e)=>getComputedStyle(e).backgroundImage')
        etch = rare.locator('.face-depth-bg .foil-etch').evaluate('(e)=>getComputedStyle(e).backgroundImage')
        assert '112deg' in relief and '90deg' not in relief
        assert '28deg' in etch and '-34deg' in etch
        page.locator('#rarities').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / 'r2-five-rarities.png'))
        page.locator('#legacy').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOTS / 'r2-legacy-comparison.png'))
        composite = page.locator('[data-id="legacy-zhenpete-composite"]')
        hit = composite.locator('..')
        hit.scroll_into_view_if_needed()
        box = hit.bounding_box()
        page.mouse.move(box['x'] + box['width']*.2, box['y'] + box['height']*.35)
        page.wait_for_timeout(500)
        before = composite.get_attribute('style')
        page.mouse.move(box['x'] + box['width']*.82, box['y'] + box['height']*.72, steps=12)
        page.wait_for_timeout(500)
        after = composite.get_attribute('style')
        assert before != after
        page.screenshot(path=str(SHOTS / 'r2-legacy-tilted.png'))
        page.mouse.move(10, 10)
        page.wait_for_timeout(1100)
        idle = page.evaluate('holoDemo.snapshot()')
        assert idle['raf'] == 0 and idle['active'] is None
        page.screenshot(path=str(SHOTS / 'r2-idle.png'))
        assert page.locator('[data-id="legacy-zhenpete-composite"] .art-media>img').get_attribute('src').endswith('layer-zhenpete-subject.png')
        assert page.locator('[data-id="legacy-zhenpete-composite"] .face-depth-bg img').get_attribute('src').endswith('layer-zhenpete-background.png')
        assert not errors, errors
        report = {'cards': page.locator('.hcard').count(), 'legacy_pairs': 10,
                  'rare_relief': relief, 'rare_etch': etch,
                  'composite_changed_after_pointer': True, 'idle_raf': idle['raf'],
                  'console_errors': errors, 'screenshots': sorted(x.name for x in SHOTS.glob('r2-*.png'))}
        (OUT / 'verification-round2.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()

if __name__ == '__main__':
    main()
