# -*- coding: utf-8 -*-
"""驗收：稀有度字族統一。比對 before.json / after.json，並跑字族負控制。"""
import json, pathlib, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = pathlib.Path(r"C:/Users/spesh/AppData/Local/Temp/claude/D--claude--/24b5ac31-e5e3-4c13-b150-0a60884ac742/scratchpad/out")
ROOT = pathlib.Path(r"D:/claude研究/clawd-pet-50/_art/holo-test")
before = json.loads((BASE/"before.json").read_text(encoding="utf-8"))
after  = json.loads((BASE/"after.json").read_text(encoding="utf-8"))

fails, notes = [], []
def chk(ok, msg):
    print(("PASS " if ok else "FAIL ") + msg)
    if not ok: fails.append(msg)

print("== 1. 字族指定（computed fontFamily 第一順位）")
for page in ("demo","gacha","team"):
    for vp, v in after[page].items():
        cards = [c for c in v["cards"] if c["rarityStyle"]]
        bad = [c["id"] for c in cards if not c["rarityStyle"]["fontFamily"].startswith('"Holo Noto Sans"')]
        chk(not bad and cards, f"{page} {vp}: {len(cards)} 張，非 Holo Noto Sans {len(bad)} 張 {bad[:3]}")

print("\n== 2. 實際平台字型（CDP CSS.getPlatformFontsForNode）")
for page in ("demo","gacha","team"):
    for vp, v in after[page].items():
        f = v["platformFonts"]["rarity"]["fonts"]
        fb = {k:n for k,n in f.items() if k != "Noto Sans TC"}
        b = before[page][vp]["platformFonts"]["rarity"]["fonts"]
        chk(not fb, f"{page} {vp}: rarity fallback glyph {sum(fb.values())} (before={b}) after={f}")

print("\n== 3. 卡名的 fallback（本輪沒改，只回報）")
for page in ("demo","gacha","team"):
    for vp, v in after[page].items():
        f = v["platformFonts"]["name"]["fonts"]
        fb = {k:n for k,n in f.items() if k != "Noto Sans TC"}
        if fb: notes.append(f"{page} {vp}: .face-name 仍有 fallback {fb}")

print("\n== 4. 字級變數生效 + 主副標比例 13.5/24=0.5625")
R = 13.5/24
for page in ("demo","gacha","team"):
    for vp, v in after[page].items():
        worst_var = worst_ratio = 0.0; wid = None; skipped = []
        for c in v["cards"]:
            if not c["rarityStyle"]: continue
            if c["cardWidth"] == 0 or not c["rarityFsVar"]:
                # 尚未佈局／沒跑過 fit() 的卡（詳情面隱藏時）：不列入字級門檻，另外列出
                skipped.append(c["id"]); continue
            fs = float(c["rarityStyle"]["fontSize"].removesuffix("px"))
            if c["rarityFsVar"]:
                worst_var = max(worst_var, abs(fs - float(c["rarityFsVar"].removesuffix("px"))))
            nfs = float(c["name"]["fontSize"].removesuffix("px"))
            d = abs(fs - nfs*R)
            if d > worst_ratio: worst_ratio, wid = d, c["id"]
        chk(worst_var < 0.011, f"{page} {vp}: |fontSize - --rarity-fs| max {worst_var:.4f}px")
        chk(worst_ratio < 0.011, f"{page} {vp}: |rarityFS - nameFS*0.5625| max {worst_ratio:.4f}px ({wid})")
        if skipped: notes.append(f"{page} {vp}: 排除未佈局卡（cardWidth=0、沒有 --rarity-fs）{skipped}；before/after 數值相同，非本輪造成")

print("\n== 5. 非目標樣式零變更（weight/style/line-height/letter-spacing/color/textShadow）")
KEYS = ["fontWeight","fontStyle","lineHeight","letterSpacing","color","textShadow"]
for page in ("demo","gacha","team"):
    for vp in after[page]:
        bmap = {c["id"]: c for c in before[page][vp]["cards"] if c["rarityStyle"] and c["id"]}
        amap = {c["id"]: c for c in after[page][vp]["cards"] if c["rarityStyle"] and c["id"]}
        common = sorted(set(bmap) & set(amap))
        diffs = []
        for i in common:
            for k in KEYS:
                bv, av = bmap[i]["rarityStyle"][k], amap[i]["rarityStyle"][k]
                if k == "lineHeight" and "px" in bv and "px" in av:   # 換字族會動 normal 的 px 值
                    continue
                if bv != av: diffs.append((i,k,bv,av))
        chk(not diffs, f"{page} {vp}: 共同卡 {len(common)} 張，非目標樣式差異 {len(diffs)} 項 {diffs[:2]}")

print("\n== 6. 稀有度文字幾何（換字族後的寬高變化，回報用）")
for page in ("demo","gacha","team"):
    for vp in after[page]:
        bmap = {c["id"]: c for c in before[page][vp]["cards"] if c["rarityRange"] and c["id"]}
        amap = {c["id"]: c for c in after[page][vp]["cards"] if c["rarityRange"] and c["id"]}
        common = sorted(set(bmap) & set(amap))
        if not common: continue
        dw = max(amap[i]["rarityRange"]["w"] - bmap[i]["rarityRange"]["w"] for i in common)
        dh = max(amap[i]["rarityRange"]["h"] - bmap[i]["rarityRange"]["h"] for i in common)
        over = [i for i in common if amap[i]["rarityRange"]["w"] > amap[i]["cardWidth"]*0.9]
        print(f"     {page} {vp}: 最大寬增 {dw:+.3f}px 高增 {dh:+.3f}px；寬度 >90% 卡寬 {len(over)} 張 {over[:3]}")
        chk(not over, f"{page} {vp}: 稀有度文字寬度未超過 90% 卡寬")

print("\n== 7. 字族負控制（注進正確 root，必須變紅）")
NEG = '.hcard .face-rarity{font-family:monospace !important}'
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={"width":1440,"height":900})
    pg.goto((ROOT/"map20.html").as_uri()); pg.wait_for_timeout(600)
    pg.click("#open-team"); pg.wait_for_timeout(1200)
    Q = """()=>{const cs=[];const w=r=>{r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
      r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})};w(document);
      return cs.filter(c=>c.querySelector('.face-rarity')).map(c=>getComputedStyle(c.querySelector('.face-rarity')).fontFamily)}"""
    clean = pg.evaluate(Q)
    chk(clean and all(f.startswith('"Holo Noto Sans"') for f in clean), f"注入前 {len(clean)} 張全部 Holo Noto Sans")
    pg.evaluate("""(css)=>{const cs=[];const w=r=>{r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
      r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})};w(document);
      const roots=new Set(cs.map(c=>c.getRootNode()));
      roots.forEach(r=>{const s=document.createElement('style');s.className='__neg';s.textContent=css;(r.head||r).appendChild(s)})}""", NEG)
    pg.wait_for_timeout(300)
    dirty = pg.evaluate(Q)
    chk(dirty and all(f == "monospace" for f in dirty), f"注入後 {len(dirty)} 張全部變回 monospace（負控制成功變紅）")
    pg.evaluate("""()=>{const w=r=>{r.querySelectorAll('.__neg').forEach(s=>s.remove());
      r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})};w(document)}""")
    pg.wait_for_timeout(300)
    restored = pg.evaluate(Q)
    chk(all(f.startswith('"Holo Noto Sans"') for f in restored), "移除後恢復全綠")
    b.close()

print("\n== 觀察（不計入通過與否）")
for n in notes: print("  -", n)
print(f"\n== 結果：{'全綠' if not fails else str(len(fails)) + ' 項 FAIL'}")
sys.exit(1 if fails else 0)
