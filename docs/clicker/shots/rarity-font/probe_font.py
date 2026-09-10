# -*- coding: utf-8 -*-
"""逐卡量測 .face-name / .face-rarity 的 computed style 與『實際用到的平台字型』。
用法: python probe_font.py <label>  -> 寫出 <label>.json 與截圖到 out/<label>/
"""
import json, pathlib, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"D:/claude研究/clawd-pet-50/_art/holo-test")
LABEL = sys.argv[1]
OUT = pathlib.Path(r"C:/Users/spesh/AppData/Local/Temp/claude/D--claude--/24b5ac31-e5e3-4c13-b150-0a60884ac742/scratchpad/out") / LABEL
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [(1440, 900), (1024, 900), (390, 844)]

COLLECT = """() => {
  const cards=[]; const walk=(root)=>{
    root.querySelectorAll('.hcard').forEach(c=>cards.push(c));
    root.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot)});
  }; walk(document);
  const cs=e=>{const s=getComputedStyle(e);return{fontFamily:s.fontFamily,fontSize:s.fontSize,
    fontWeight:s.fontWeight,fontStyle:s.fontStyle,lineHeight:s.lineHeight,
    letterSpacing:s.letterSpacing,color:s.color,textShadow:s.textShadow}};
  const rect=e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();
    return{w:+b.width.toFixed(3),h:+b.height.toFixed(3)}};
  return cards.map((c,i)=>{
    const n=c.querySelector('.face-name'), r=c.querySelector('.face-rarity');
    const cw=c.getBoundingClientRect().width;
    return {i, id:c.dataset.id||null, rarity:c.dataset.rarity||null, cardWidth:+cw.toFixed(3),
      nameCount:c.querySelectorAll('.face-name').length, rarityCount:c.querySelectorAll('.face-rarity').length,
      nameText:n?n.textContent.trim():null, rarityText:r?r.textContent.trim():null,
      name:n?cs(n):null, rarityStyle:r?cs(r):null,
      nameRange:n?rect(n):null, rarityRange:r?rect(r):null,
      rarityFsVar:getComputedStyle(c).getPropertyValue('--rarity-fs').trim(),
      nameFsVar:getComputedStyle(c).getPropertyValue('--name-fs').trim()};
  });
}"""

def platform_fonts(cdp, selector):
    """用 DOM.performSearch（會穿 shadow DOM）拿節點，再問實際平台字型。"""
    cdp.send("DOM.getDocument", {"depth": -1, "pierce": True})
    s = cdp.send("DOM.performSearch", {"query": selector, "includeUserAgentShadowDOM": False})
    n = s["resultCount"]
    if not n:
        return {"count": 0, "fonts": []}
    ids = cdp.send("DOM.getSearchResults",
                   {"searchId": s["searchId"], "fromIndex": 0, "toIndex": min(n, 80)})["nodeIds"]
    seen = {}
    for nid in ids:
        if not nid:
            continue
        try:
            fs = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]
        except Exception:
            continue
        for f in fs:
            seen[f["familyName"]] = seen.get(f["familyName"], 0) + f["glyphCount"]
    return {"count": n, "fonts": seen}

def run(pg, cdp, page_file, opener, tag):
    res = {}
    for w, h in VIEWPORTS:
        pg.set_viewport_size({"width": w, "height": h})
        pg.goto((ROOT / page_file).as_uri())
        try:
            pg.evaluate("async()=>{await document.fonts.ready}")
        except Exception:
            pass
        if opener:
            opener(pg)
        pg.wait_for_timeout(900)
        pg.evaluate("()=>{document.querySelectorAll('.hcard').forEach(c=>window.HoloCardFace&&HoloCardFace.refit&&HoloCardFace.refit(c))}")
        pg.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        cards = pg.evaluate(COLLECT)
        pf_r = platform_fonts(cdp, ".face-rarity")
        pf_n = platform_fonts(cdp, ".face-name")
        res[f"{w}x{h}"] = {"cards": cards, "platformFonts": {"rarity": pf_r, "name": pf_n}}
        if w == 1440 and cards:
            try:
                pg.locator(".hcard").first.screenshot(path=str(OUT / f"{tag}-card-1440.png"))
            except Exception as e:
                print("shot fail", tag, e)
    return res

def open_team(pg):
    try:
        pg.click("#open-team", timeout=4000)
    except Exception as e:
        print("open-team:", str(e)[:60])

def open_gacha(pg):
    for sel in ("#p1", "#entry-pack"):
        try:
            pg.click(sel, timeout=3000)
        except Exception:
            pass
    for _ in range(14):
        pg.wait_for_timeout(600)
        if pg.evaluate("()=>!!document.querySelector('.hcard .face-rarity')"):
            return
        try:
            pg.click("#next", timeout=400)
        except Exception:
            pass

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("DOM.enable"); cdp.send("CSS.enable")
    data = {"label": LABEL, "chromium": b.version}
    data["demo"] = run(pg, cdp, "demo.html", None, "demo")
    data["gacha"] = run(pg, cdp, "deluxe-gacha-b.html", open_gacha, "gacha")
    data["team"] = run(pg, cdp, "map20.html", open_team, "team")
    b.close()

p = OUT.parent / f"{LABEL}.json"
p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", p)
for page in ("demo", "gacha", "team"):
    for vp, v in data[page].items():
        fams = sorted({c["rarityStyle"]["fontFamily"] for c in v["cards"] if c["rarityStyle"]})
        print(f"{page:6} {vp:9} cards={len(v['cards']):3}  rarity family={fams}")
        print(f"        platformFonts rarity={v['platformFonts']['rarity']['fonts']}")
        print(f"        platformFonts name  ={v['platformFonts']['name']['fonts']}")
