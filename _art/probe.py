# -*- coding: utf-8 -*-
import mimetypes, json
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
SRC = Path('src').resolve()
SEED = open('_art/audit.py', encoding='utf-8').read().split("SEED = '''")[1].split("'''")[0]
JS = open('_art/probe.js', encoding='utf-8').read()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 960, 'height': 640})
    ctx.add_init_script("const seed=sessionStorage.getItem('test-seed');if(seed){localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}")
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page()
    pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED); pg.reload()
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled'); pg.wait_for_timeout(1000)
    print(json.dumps(pg.evaluate(JS), ensure_ascii=False, indent=1))
    b.close()
