"""Round 9 verification.

Covers what round 9 added on top of round 8:
  * the whole pool section (E) renders every card that has art, in the deluxe frame
  * card names and rarities match src/gacha-pool.js exactly - never inferred from a
    filename (HANDOFF section 5.2: foxfriend was once shipped as the wrong name)
  * legendary names are the solid bright gold, mythic names are the frame's conic
    rainbow with transparent fill (the round 9 decision)
  * common / rare / epic names stay clean white - no foil, no gradient
  * dev page and a standalone copied to another folder both pass, with no external
    request and no console error

Run:  PYTHONIOENCODING=utf-8 python _art/holo-test/check_demo_round9.py
"""
from pathlib import Path
import json, re, shutil
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'shots'
ROOT = (OUT / '../..').resolve()

EXPECTED_TOTAL = 65          # 22 sample cards from rounds 1-8 + 43 pool cards
GOLD = 'rgb(255, 244, 92)'   # #fff45c


def pool_from_source():
    """Read the catalog out of the real game source, not out of the demo."""
    src = (ROOT / 'src' / 'gacha-pool.js').read_text(encoding='utf-8')
    body = src[src.index('const CATALOG = ['):src.index('\n  ];', src.index('const CATALOG = ['))]
    rows = []
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith('{ id:'):
            continue
        got = {k: re.search(r"\b%s:\s*'([^']*)'" % k, line) for k in ('id', 'name', 'rarity')}
        art = re.search(r"\bsrc:\s*'([^']*)'", line)
        if art:
            rows.append({'id': got['id'].group(1), 'name': got['name'].group(1),
                         'rarity': got['rarity'].group(1), 'src': art.group(1)})
    return rows


def check(page, uri, label, expected):
    errors, external = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.goto(uri, wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
    page.wait_for_timeout(300)
    assert not errors, errors
    assert not external, external
    assert page.locator('.hcard').count() == EXPECTED_TOTAL, page.locator('.hcard').count()

    rows = page.evaluate("""() => [...document.querySelectorAll('#pool-grid .hcard')].map(c => {
      const name = c.querySelector('.face-name'), rarity = c.querySelector('.face-rarity');
      const img = c.querySelector('.art-media img');
      const cs = getComputedStyle(name);
      const box = c.getBoundingClientRect(), nb = name.getBoundingClientRect();
      return {
        id: c.dataset.id.replace(/^pool-/, ''),
        rarity: c.dataset.rarity,
        name: name.textContent,
        rarityText: rarity.textContent,
        artLoaded: !!(img && img.complete && img.naturalWidth > 0),
        masked: !!c.querySelector('.subject-mask'),
        fill: cs.webkitTextFillColor,
        background: cs.backgroundImage,
        nameCenterDelta: Math.abs(nb.left + nb.width / 2 - (box.left + box.width / 2)),
      };
    })""")
    assert len(rows) == len(expected), (len(rows), len(expected))

    by_id = {r['id']: r for r in rows}
    for want in expected:
        got = by_id.get(want['id'])
        assert got, 'missing pool card: ' + want['id']
        assert got['name'] == want['name'], (want['id'], got['name'], want['name'])
        assert got['rarity'] == want['rarity'], (want['id'], got['rarity'], want['rarity'])
        assert got['rarityText'].endswith(want['rarity'].upper()), (want['id'], got['rarityText'])
        assert got['artLoaded'], 'art failed to load: ' + want['id']
        assert got['masked'], 'no foil mask: ' + want['id']
        assert got['nameCenterDelta'] < 2, (want['id'], got['nameCenterDelta'])

        if want['rarity'] == 'legendary':
            assert got['fill'] == GOLD, (want['id'], got['fill'])
            assert got['background'] == 'none', (want['id'], got['background'])
        elif want['rarity'] == 'mythic':
            assert got['fill'] == 'rgba(0, 0, 0, 0)', (want['id'], got['fill'])
            assert 'conic-gradient' in got['background'], (want['id'], got['background'])
        else:
            assert 'gradient' not in got['background'], (want['id'], got['background'])

    SHOTS.mkdir(exist_ok=True)
    page.locator('#pool-grid').screenshot(path=str(SHOTS / f'r9-{label}-pool.png'))
    return {'label': label, 'cards': page.locator('.hcard').count(), 'pool': len(rows),
            'external_requests': external, 'console_errors': errors}


def main():
    expected = pool_from_source()
    with sync_playwright() as pw, TemporaryDirectory() as tmp:
        copy = Path(tmp) / 'standalone.html'
        shutil.copy(OUT / 'demo-standalone.html', copy)
        browser = pw.chromium.launch()
        results = []
        for label, uri in (('dev', (OUT / 'demo.html').as_uri()), ('standalone-copy', copy.as_uri())):
            page = browser.new_page(viewport={'width': 1400, 'height': 1000})
            results.append(check(page, uri, label, expected))
            page.close()
        browser.close()
    report = {'expected_total': EXPECTED_TOTAL, 'pool_cards': len(expected),
              'standalone_bytes': (OUT / 'demo-standalone.html').stat().st_size, 'results': results}
    (OUT / 'verification-round9.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
