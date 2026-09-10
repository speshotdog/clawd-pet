# -*- coding: utf-8 -*-
"""量『抽卡揭到的那張卡』對『編隊卡／卡池卡』的差異：同一張卡、把數值用卡寬正規化。"""
import json, pathlib, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(r"D:/claude研究/clawd-pet-50/_art/holo-test")

COLLECT = """()=>{
 const cs=[];const w=r=>{r.querySelectorAll('.hcard').forEach(c=>cs.push(c));
  r.querySelectorAll('*').forEach(e=>{if(e.shadowRoot)w(e.shadowRoot)})};w(document);
 const props=['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','color',
   'textShadow','backgroundImage','webkitTextFillColor','opacity','textTransform','whiteSpace'];
 const st=e=>{if(!e)return null;const s=getComputedStyle(e);const o={};props.forEach(p=>o[p]=s[p]);
   const r=e.getBoundingClientRect();o._w=+r.width.toFixed(2);o._h=+r.height.toFixed(2);return o};
 const plate=e=>{if(!e)return null;const s=getComputedStyle(e);const r=e.getBoundingClientRect();
   return {height:s.height,padding:s.padding,gap:s.gap,background:s.backgroundImage.slice(0,40),
           borderTop:s.borderTop,_w:+r.width.toFixed(2),_h:+r.height.toFixed(2)}};
 return cs.filter(c=>c.querySelector('.face-rarity')).map(c=>{
  const cw=c.getBoundingClientRect().width;
  const n=c.querySelector('.face-name'),ra=c.querySelector('.face-rarity'),p=c.querySelector('.face-plate');
  return {id:c.dataset.id,rarity:c.dataset.rarity,cw:+cw.toFixed(2),
   nameFsVar:getComputedStyle(c).getPropertyValue('--name-fs').trim(),
   rarityFsVar:getComputedStyle(c).getPropertyValue('--rarity-fs').trim(),
   name:st(n),rar:st(ra),plate:plate(p),
   classes:[...c.classList].sort().join(' '), host:c.getRootNode()===document?'document':'shadow'};
 });
}"""

def norm(d):
    """把長度類數值除以卡寬，得到與尺寸無關的比例。"""
    cw = d["cw"] or 1
    out = {}
    for k in ("name","rar"):
        s = d[k]
        if not s: continue
        o = dict(s)
        for f in ("fontSize","letterSpacing"):
            try: o[f] = round(float(s[f].removesuffix("px"))/cw, 5)
            except Exception: pass
        o["_w"] = round(s["_w"]/cw,5); o["_h"] = round(s["_h"]/cw,5)
        o.pop("lineHeight",None)
        out[k]=o
    return out

with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":900})
    # 抽卡：揭到的那張
    pg.goto((ROOT/"deluxe-gacha-b.html").as_uri()); pg.evaluate("async()=>{await document.fonts.ready}")
    pg.wait_for_timeout(800)
    for s in ("#p10","#entry-pack"):
        try: pg.click(s,timeout=3000)
        except Exception: pass
    got=None
    for _ in range(20):
        pg.wait_for_timeout(600)
        c=pg.evaluate(COLLECT)
        if c: got=c; break
        try: pg.click("#next",timeout=400)
        except Exception: pass
    gacha=got or []
    print("抽卡揭到:", [(c["id"],c["rarity"],c["cw"]) for c in gacha])

    # 卡池頁
    pg.goto((ROOT/"cards-remade.html").as_uri()); pg.evaluate("async()=>{await document.fonts.ready}")
    pg.wait_for_timeout(1500); pool=pg.evaluate(COLLECT)
    # 編隊
    pg.goto((ROOT/"map20.html").as_uri()); pg.evaluate("async()=>{await document.fonts.ready}")
    pg.wait_for_timeout(600)
    try: pg.click("#open-team",timeout=4000)
    except Exception: pass
    pg.wait_for_timeout(1500); team=pg.evaluate(COLLECT)
    b.close()

# 額外：卡池 vs 編隊 的共同卡
pmap={c["id"]:c for c in pool}
tmap={}
for c in team: tmap.setdefault(c["id"],[]).append(c)
common=sorted(set(pmap)&set(tmap))
print()
print("卡池∩編隊 共同卡:", common)
for i in common[:6]:
    for j,tc in enumerate(tmap[i]):
        pn,tn=norm(pmap[i]),norm(tc)
        diffs=[]
        for part in ("name","rar"):
            for k in pn.get(part,{}):
                a,bv=pn[part][k],tn.get(part,{}).get(k)
                if a!=bv and not (isinstance(a,float) and isinstance(bv,float) and abs(a-bv)<2e-4):
                    diffs.append((part,k,a,bv))
        print()
        print("[卡池 vs 編隊#%d] %s poolCw=%s teamCw=%s 差異 %d 項" % (j,i,pmap[i]["cw"],tc["cw"],len(diffs)))
        for d in diffs: print("   ",d)

ref = gacha[0] if gacha else None
print("\n參考（抽卡）:", ref["id"] if ref else None, "cw=", ref["cw"] if ref else None)
if ref:
    rn = norm(ref)
    for label, cards in (("卡池", pool), ("編隊", team)):
        same=[c for c in cards if c["id"]==ref["id"]]
        if not same:
            print(f"\n[{label}] 找不到同一張卡 {ref['id']}；有的 id：", [c['id'] for c in cards][:8]); continue
        for c in same:
            cn=norm(c); diffs=[]
            for part in ("name","rar"):
                for k in rn.get(part,{}):
                    a,bv=rn[part][k], cn.get(part,{}).get(k)
                    if a!=bv: diffs.append((part,k,a,bv))
            print(f"\n[{label}] {c['id']} cw={c['cw']} host={c['host']} 差異 {len(diffs)} 項")
            for d in diffs: print("   ", d)
