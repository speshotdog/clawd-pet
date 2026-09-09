"""Final review plates from the actual prototype, with one of each tier."""
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round30 import HERE,OUT,BY,open_page,start,advance,rectangles,nonoverlap
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for n in [5,10]:
  p,errors=open_page(b,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size({'width':1440,'height':900})
  start(p,(list(BY.values())*2)[:n]);p.evaluate('()=>{__ceremony.skipAll()}');advance(p,181)
  nonoverlap(rectangles(p));assert not errors,errors;p.screenshot(path=str(OUT/f'final-mixed-{n}.png'));p.close()
 b.close()
