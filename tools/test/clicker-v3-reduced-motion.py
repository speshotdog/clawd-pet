# -*- coding: utf-8 -*-
"""減少動態（prefers-reduced-motion）時，王還是要動。

朋友回報「打王的時候路障小王不會動」。根因不是哪一張卡的樣式，是 clicker.css 開頭那條
`#game *, #game *::before, #game *::after { animation-duration:.01s !important }`——
它把 #game 裡每一個動畫都壓成 0.01s。手機一開省電模式就會送出這個偏好，王整隻定格，
看起來像遊戲壞掉；而且因為是 !important，後面每張各自寫的 `animation:none` 其實從來沒生效過。

現在的規則：角色的逐格動作（動畫表）是原地演出，不是位移也不是視差，減速一半就好，不要停。
這支驗「開了減少動態之後，動畫還在、而且比平常慢」。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-reduced-motion.py
"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

# 兩隻都量：1.0 的王（#boss-image.sprite）與末世的王（#apoc-enemy.apoc-sprite）。
# #apoc-enemy 要等末世舞台畫出來才存在，所以量不到就自己插一個一樣的節點來量樣式。
PROBE = """() => {
  const read = (el) => { const cs = getComputedStyle(el); return { name: cs.animationName, dur: parseFloat(cs.animationDuration) }; };
  const out = {};
  const boss = document.getElementById('boss-image');
  if (boss) { boss.classList.add('sprite'); out.boss = read(boss); boss.classList.remove('sprite'); }
  let enemy = document.getElementById('apoc-enemy'), temp = false;
  if (!enemy) { enemy = document.createElement('img'); enemy.id = 'apoc-enemy'; document.getElementById('stage').append(enemy); temp = true; }
  enemy.classList.add('apoc-sprite');
  enemy.style.setProperty('--frames', '7'); enemy.style.setProperty('--frame-ms', '100ms');
  out.apoc = read(enemy);
  if (temp) enemy.remove(); else enemy.classList.remove('apoc-sprite');
  return out; }"""

with sync_playwright() as p:
    b = p.chromium.launch(); got = {}
    for rm in ('no-preference', 'reduce'):
        ctx = b.new_context(viewport={'width': 1280, 'height': 860}, reduced_motion=rm)
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if path.is_relative_to(SRC) and path.is_file():
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            else: r.fulfill(status=404, body='missing')
        ctx.route('**/*', route)
        pg = ctx.new_page()
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
        got[rm] = pg.evaluate(PROBE)
        ctx.close()
    b.close()

for key, label in (('boss', '1.0 的王'), ('apoc', '末世的王')):
    a, r = got['no-preference'].get(key), got['reduce'].get(key)
    check(a and a['name'] == 'boss-frames' and a['dur'] > 0, f'{label}：平常會動（{a}）')
    check(r and r['name'] == 'boss-frames' and r['dur'] > 0.05,
          f'{label}：開了減少動態還是會動，沒有被 .01s 壓死（{r}）')
    check(a and r and r['dur'] > a['dur'], f'{label}：減少動態時放慢（{a and a["dur"]}s → {r and r["dur"]}s）')

print('全部通過' if not fails else f'{len(fails)} 項失敗：' + '；'.join(fails))
sys.exit(1 if fails else 0)
