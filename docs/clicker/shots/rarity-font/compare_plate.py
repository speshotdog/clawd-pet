# -*- coding: utf-8 -*-
"""同一張卡、同一個尺寸，拍『稀有度用舊 monospace』與『新 Sans』兩張銘牌對照圖。"""
import pathlib, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = pathlib.Path(r"D:/claude研究/clawd-pet-50/_art/holo-test")
OUT = pathlib.Path(r"C:/Users/spesh/AppData/Local/Temp/claude/D--claude--/24b5ac31-e5e3-4c13-b150-0a60884ac742/scratchpad/out/compare")
OUT.mkdir(parents=True, exist_ok=True)

FIND = """(id)=>{
  const cards=[]; const walk=r=>{r.querySelectorAll('.hcard').forEach(c=>cards.push(c));
    r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot)})}; walk(document);
  const c = cards.find(c=>c.dataset.id===id) || cards[0];
  if(!c) return null;
  c.scrollIntoView({block:'center'});
  window.__c = c;
  return {id:c.dataset.id,name:c.querySelector('.face-name').textContent,
          rarity:c.querySelector('.face-rarity').textContent};
}"""

# 把 override 注進「那張卡所在的 root」（可能是 shadow root）
INJECT = """(css)=>{
  const c = window.__c; const root = c.getRootNode();
  const s = document.createElement('style'); s.id='__cmp'; s.textContent=css;
  (root.head || root).appendChild(s);
}"""
REMOVE = "()=>{const r=window.__c.getRootNode();const s=(r.head||r).querySelector('#__cmp');if(s)s.remove()}"

OLD = '.hcard .face-rarity{font-family:monospace !important;font-weight:400 !important;letter-spacing:.14em !important}'

RECT = "()=>{const p=window.__c.querySelector('.face-plate')||window.__c;const r=p.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}"

def shot(pg, box, path, pad=6):
    pg.wait_for_timeout(250)
    box = pg.evaluate(RECT)
    pg.screenshot(path=str(path), clip={"x":max(0,box["x"]-pad),"y":max(0,box["y"]-pad),
                                        "width":box["w"]+pad*2,"height":box["h"]+pad*2})

def stack(a, b, out, gap=10):
    ia, ib = Image.open(a), Image.open(b)
    w = max(ia.width, ib.width)
    im = Image.new("RGBA", (w, ia.height+ib.height+gap), (14,18,26,255))
    im.paste(ia, ((w-ia.width)//2, 0)); im.paste(ib, ((w-ib.width)//2, ia.height+gap))
    im = im.resize((im.width*3, im.height*3), Image.NEAREST)
    im.save(out); print("wrote", out)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=2)

    # --- demo.html 的 rocketdog（宇宙冒險羊）
    pg.goto((ROOT/"demo.html").as_uri()); pg.evaluate("async()=>{await document.fonts.ready}")
    pg.wait_for_timeout(1200)
    info = pg.evaluate(FIND, "rocketdog"); print("demo:", info)
    pg.wait_for_timeout(500); box = None
    shot(pg, box, OUT/"demo-new.png")
    pg.evaluate(INJECT, OLD); shot(pg, box, OUT/"demo-old.png"); pg.evaluate(REMOVE)
    stack(OUT/"demo-old.png", OUT/"demo-new.png", OUT/"demo-plate-old-vs-new.png")

    # --- map20 編隊詳情
    pg.goto((ROOT/"map20.html").as_uri()); pg.evaluate("async()=>{await document.fonts.ready}")
    pg.wait_for_timeout(600)
    try: pg.click("#open-team", timeout=4000)
    except Exception as e: print("open-team:", str(e)[:60])
    pg.wait_for_timeout(1200)
    info = pg.evaluate(FIND, "rocketdog"); print("team:", info)
    pg.wait_for_timeout(500); box = None
    shot(pg, box, OUT/"team-new.png")
    pg.evaluate(INJECT, OLD); shot(pg, box, OUT/"team-old.png"); pg.evaluate(REMOVE)
    stack(OUT/"team-old.png", OUT/"team-new.png", OUT/"team-plate-old-vs-new.png")
    b.close()
