# -*- coding: utf-8 -*-
import sys, mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
SRC = Path('src').resolve(); OUT = Path('_art/out'); OUT.mkdir(exist_ok=True)
SEED = open('_art/audit.py', encoding='utf-8').read().split("SEED = '''")[1].split("'''")[0]
W, H = int(sys.argv[1]), int(sys.argv[2])
TAG = sys.argv[3]
PANELS = ['roster-open', 'stats-open', 'scene-open', 'prestige-open', 'wardrobe-open', 'recruit-open', 'dust-open', 'recommend-open']
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': W, 'height': H})
    ctx.add_init_script("const seed=sessionStorage.getItem('test-seed');if(seed){localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}")
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled'); pg.wait_for_timeout(1200)
    pg.screenshot(path=str(OUT / f'{TAG}-main.png'))
    for pid in PANELS:
        if not pg.evaluate(f"() => {{ const e=document.getElementById('{pid}'); if(!e||e.disabled) return false; e.click(); return true; }}"):
            print('skip', pid); continue
        pg.wait_for_timeout(800)
        pg.screenshot(path=str(OUT / f'{TAG}-{pid}.png'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    print('errors', errs)
    b.close()
