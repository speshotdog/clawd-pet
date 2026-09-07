# -*- coding: utf-8 -*-
"""UI 稽核 + 場景縮圖產生器。
  python _art/audit.py audit   -> _art/out/*.png、印出 404 素材、JS 錯誤、fallback 元素
  python _art/audit.py thumbs  -> 產生 src/clicker-scene{3..7}-thumb.png
"""
import sys, json, mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
OUT = ROOT / '_art/out'
OUT.mkdir(parents=True, exist_ok=True)

SEED = '''() => {
  const s = ClickerSave.fresh(Date.now());
  s.collection = Object.fromEntries(Object.keys(ClickerBalance.characters).map(id => [id, 20]));
  s.coins = 1e12; s.lifetimeCoins = 5e12; s.manualClicks = 99999;
  s.claimedMilestones = ['tutorial50'];
  s.skillSlots = Object.keys(ClickerBalance.characters).slice(0, 4); s.slotReadyAt = [0,0,0,0];
  s.dust = Object.fromEntries(Object.keys(ClickerBalance.characters).map(id => [id, 40]));
  s.universalDust = 9999; s.marks = 20; s.marksClaimed = 40; s.prestiges = 3; s.autoClick = 6;
  s.markShop = { slot4: true, offline12: true, chain2: true, starter5: true, crack75: true, rooftop: true };
  s.bossWins = ['backyard','kitchen','market','factory','nightmarket','fridge'];
  s.package = { ...s.package, index: 400 };
  s.deco = ClickerBalance.decor.map(d => d.id);
  s.badges = ['pack10','pack25','pack50','pack100','pack300','pack1000','boss-backyard','boss-kitchen','boss-market','boss-factory','boss-nightmarket','boss-fridge','star5','streak7','coins1e8'];
  s.partnerLevels = Object.fromEntries(Object.keys(ClickerBalance.characters).map(id => [id, 60]));
  sessionStorage.setItem('test-seed', JSON.stringify(s));
}'''


def open_page(browser, width=1280, height=860, dsf=1):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dsf)
    missing, errors, console = set(), [], []

    def route(request):
        path = (SRC / unquote(urlparse(request.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            request.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:
            missing.add(path.name)
            request.fulfill(status=404, body='missing')
    ctx.add_init_script("const seed = sessionStorage.getItem('test-seed'); if (seed) { localStorage.setItem('clicker_save', seed); sessionStorage.removeItem('test-seed'); }")
    ctx.route('**/*', route)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: console.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.goto('http://clicker.test/clicker.html')
    page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    page.evaluate(SEED)
    page.reload()
    try:
        page.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    except Exception:
        print('SEED BOOT FAILED, errors:', errors)
        raise
    page.wait_for_timeout(900)
    return page, missing, errors, console


def crop_thumb(src_png, dest):
    from PIL import Image
    im = Image.open(src_png).convert('RGB')
    w, h = im.size
    m = round(w * 0.035)
    im = im.crop((m, m, w - m, h - m))
    # 對齊 192x108 的 16:9
    tw, th = 192, 108
    r = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    im.crop((left, top, left + tw, top + th)).save(dest)


SCENES = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket', 'rooftop', 'fridge']


def switch(page, sid):
    page.evaluate(f'''() => {{
      const s = Clicker.state; s.settings.scene = '{sid}';
      window.ClickerScene.mount('{sid}', s.package.index);
    }}''')
    page.wait_for_timeout(700)


HIDE = '''() => {
  const kill = ['#prestige-hint', '.package-label', '#package-label', '#toy-layer', '#prestige-hint', '.float-text', '#floaters', '#gift-bag', '#daily-bag', '#tutorial', '#shell-hint', '#boss-banner', '#hero-light'];
  for (const sel of kill) document.querySelectorAll(sel).forEach(e => { e.style.display = 'none'; });
  document.querySelectorAll('.skill-slot, .skill-use, #skill-hotspots, #deco-layer, .package-meter').forEach(e => { e.style.display = 'none'; });
}'''


def thumbs(browser):
    page, missing, errors, _ = open_page(browser, 960, 640)
    for i, sid in enumerate(SCENES, start=1):
        switch(page, sid)
        page.evaluate(HIDE)
        page.wait_for_function("[...document.querySelectorAll('#clicker-scene img')].every(i=>!i.src || i.complete)")
        page.wait_for_timeout(400)
        el = page.locator('#clicker-scene')
        el.screenshot(path=str(OUT / f'thumb-raw-{i}-{sid}.png'))
        crop_thumb(OUT / f'thumb-raw-{i}-{sid}.png', SRC / f'clicker-scene{i}-thumb.png')
        print('shot', i, sid)
    print('MISSING', sorted(missing))
    print('ERRORS', errors)


PANELS = [
    ('roster', "document.getElementById('roster-open')"),
    ('stats', "document.getElementById('stats-open')"),
    ('scenes', "document.getElementById('scene-open')"),
    ('prestige', "document.getElementById('prestige-open')"),
    ('wardrobe', "document.getElementById('wardrobe-open')"),
]


def audit(browser):
    page, missing, errors, console = open_page(browser, 1280, 860)
    report = {}
    for sid in SCENES:
        switch(page, sid)
        page.screenshot(path=str(OUT / f'scene-{sid}.png'))
        report[f'scene:{sid}'] = page.evaluate(FALLBACK_PROBE)
    switch(page, 'backyard')
    for name, sel in PANELS:
        ok = page.evaluate(f'''() => {{ const el = {sel}; if (!el) return false; el.click(); return true; }}''')
        if not ok:
            report[f'panel:{name}'] = 'NO SUCH BUTTON'
            continue
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / f'panel-{name}.png'))
        report[f'panel:{name}'] = page.evaluate(FALLBACK_PROBE)
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    print('MISSING ASSETS:', sorted(missing))
    print('PAGE ERRORS:', errors)
    print('CONSOLE:', console[:20])


FALLBACK_PROBE = '''() => {
  const broken = [...document.images].filter(i => i.src && i.complete && !i.naturalWidth).map(i => i.src.split('/').pop());
  const fallbacks = [...document.querySelectorAll('.deco-fallback, .badge-icon.composed')].map(e => e.className);
  const hiddenImgs = [...document.images].filter(i => i.hidden).map(i => i.src.split('/').pop());
  return { broken: [...new Set(broken)], fallbacks: fallbacks.length, hiddenImgs: [...new Set(hiddenImgs)] };
}'''


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'audit'
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required'])
        (thumbs if cmd == 'thumbs' else audit)(b)
        b.close()
