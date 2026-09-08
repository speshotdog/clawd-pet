# -*- coding: utf-8 -*-
"""把卡池 43 張重製成「場景卡」規格，輸出 cards-remade.html。

宇宙冒險羊那四張好看，是因為有滿版背景；卡池那些只有深色底＋稀有度光暈。
這支腳本給每張卡畫一層跟角色同調的滿版背景（顏色取自 art/palette.json），
版型維持已定案的：滿版圖窗＋人物置中＋文字框＋階級寶石。

背景是純 CSS 圖層，不是生成圖：底色、角色背後的光暈、地平線、星點、暗角。
真正一張一張畫的背景要走 imagegen，這裡先把「不再是平塗深色底」解決掉。
"""
from pathlib import Path
import json, re

OUT = Path(__file__).parent
ROOT = (OUT / '../..').resolve()
demo = (OUT / 'demo.html').read_text(encoding='utf-8')

tpl = re.search(r'<template id="baseline-css">.*?</template>', demo, re.S)
styles = [m.group(0) for m in re.finditer(r'<style[^>]*>.*?</style>', demo, re.S)
          if not (tpl.start() <= m.start() < tpl.end())]
masks = json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S).group(1))
palette = json.loads((OUT / 'art' / 'palette.json').read_text(encoding='utf-8'))
manifest = json.loads((OUT / 'art' / 'manifest.json').read_text(encoding='utf-8'))

src = (ROOT / 'src' / 'gacha-pool.js').read_text(encoding='utf-8')
body = src[src.index('const CATALOG = ['):src.index('\n  ];', src.index('const CATALOG = ['))]
cards = []
for line in body.splitlines():
    line = line.strip()
    if not line.startswith('{ id:'):
        continue
    art = re.search(r"\bsrc:\s*'([^']*)'", line)
    if not art:
        continue
    f = art.group(1)
    cards.append({
        'id': re.search(r"\bid:\s*'([^']*)'", line).group(1),
        'name': re.search(r"\bname:\s*'([^']*)'", line).group(1),
        'rarity': re.search(r"\brarity:\s*'([^']*)'", line).group(1),
        'file': f,
        'pal': palette.get(f, {}),
        # 卡型是資料欄位（HANDOFF 三節）：有背景但拆不出前後關係的走 flat，
        # 不是每張都當去背卡框卡。CATALOG 的 bleed 就是在標這件事。
        'kind': 'flat' if 'bleed: true' in line else 'framed',
        **({'bleed': True} if 'bleed: true' in line else {}),
    })
RANK = {'mythic': 0, 'legendary': 1, 'epic': 2, 'rare': 3, 'common': 4}
cards.sort(key=lambda c: (RANK[c['rarity']], c['id']))

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>卡池重製 · 場景卡規格</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<style id="remade">
*{box-sizing:border-box}
body{margin:0;background:#07080d;color:#dbe7ff;padding:28px 22px 70px;
 font:14px/1.6 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
h1{font-size:20px;letter-spacing:.06em;margin:0 0 4px}
p.lede{color:#8f9bb3;max-width:76ch;margin:0 0 22px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:34px 22px;max-width:1500px}
.cell{min-width:0}
.hit{position:relative;width:100%;aspect-ratio:5/7}
.cap{margin-top:9px;font-size:12px;color:#7b879c;text-align:center}

/* ── 滿版背景：底色 + 角色背後光暈 + 地平線 + 星點 + 暗角 ───────── */
.kind-framed .face-depth-bg{
 background:
  radial-gradient(2.2px 2.2px at 18% 22%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(1.6px 1.6px at 74% 14%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(1.9px 1.9px at 88% 38%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(1.5px 1.5px at 32% 9%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(1.7px 1.7px at 9% 52%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(1.4px 1.4px at 61% 30%,var(--pal-accent) 0 45%,transparent 46%),
  radial-gradient(120% 60% at 50% 108%,var(--pal-glow) 0%,transparent 62%),
  radial-gradient(62% 46% at 50% 44%,var(--pal-glow) 0%,transparent 72%),
  radial-gradient(140% 100% at 50% 50%,transparent 40%,var(--pal-ink) 100%),
  linear-gradient(170deg,var(--pal-base),var(--pal-ink) 92%) !important}
.kind-framed .face-depth-bg:after{content:"";position:absolute;left:0;right:0;bottom:18%;height:34%;
 background:linear-gradient(to top,var(--pal-glow),transparent);opacity:.32;
 mask:linear-gradient(to top,#000,transparent);-webkit-mask:linear-gradient(to top,#000,transparent)}
</style>

<h1>卡池重製 · 全部照場景卡規格</h1>
<p class="lede">43 張都補上滿版背景，顏色取自每張角色圖的實際像素（<code>art/palette.json</code>），
所以背景跟角色同調而不是所有卡共用一層深色。版型維持已定案的：滿版圖窗、人物置中、
文字框帶階級寶石與名字。背景是 CSS 圖層，不是一張一張畫出來的圖。</p>
<div class="grid" id="grid"></div>

<script type="application/json" id="mask-data">__MASKS__</script>
<script type="application/json" id="pool-data">__POOL__</script>
<script>
'use strict';
(() => {
const $ = s => document.querySelector(s);
const masks = JSON.parse($('#mask-data').textContent);
const POOL  = JSON.parse($('#pool-data').textContent);
document.documentElement.style.setProperty('--frame-mask',`url("${masks.frame}")`);
document.documentElement.style.setProperty('--glitter-mask',`url("${masks.glitter}")`);
document.body.classList.add('font-system','gem-faceted','ink-chroma');

const LABEL={common:'普通',rare:'精良',epic:'史詩',legendary:'傳說',mythic:'神話'};
const ZL={common:24,rare:32,epic:40,legendary:48,mythic:56};
const TL={common:6,rare:8,epic:10,legendary:12,mythic:14};

function node(t,c,x){const n=document.createElement(t);if(c)n.className=c;if(x!==undefined)n.textContent=x;return n;}
function material(p){const s=node('div','foil-stack');['spectrum','relief','etch'].forEach(x=>s.append(node('div','foil-'+x)));
 p.append(s,node('div','foil-fiber'),node('div','foil-grain'),node('div','foil-glare'));}

const NAME_SHARE=24/290, RARITY_SHARE=9/290, GEM_SHARE=22/290;
const obs=new ResizeObserver(list=>{for(const e of list){const w=e.contentRect.width;if(!w)continue;
 e.target.style.setProperty('--name-fs',(w*NAME_SHARE).toFixed(2)+'px');
 e.target.style.setProperty('--rarity-fs',Math.max(7,w*RARITY_SHARE).toFixed(2)+'px');
 e.target.style.setProperty('--gem-fs',Math.max(7,w*GEM_SHARE).toFixed(2)+'px');
 fit(e.target,w);}});

function fit(card,w){
 const n=card.querySelector('.face-name'),p=card.querySelector('.face-plate'),g=card.querySelector('.face-gem');
 if(!n||!p)return;
 const pcs=getComputedStyle(p),cr=card.getBoundingClientRect(),pr=p.getBoundingClientRect();
 const cx=cr.left+cr.width/2;
 const toPlate=(pr.right-parseFloat(pcs.paddingRight))-cx;
 const toGem=g?cx-(g.getBoundingClientRect().right+w*.02):toPlate;
 const room=Math.max(24,2*Math.min(toPlate,toGem));
 const textW=()=>{const r=document.createRange();r.selectNodeContents(n);return r.getBoundingClientRect().width;};
 let fs=w*NAME_SHARE;
 for(let i=0;i<14&&textW()>room&&fs>w*NAME_SHARE*.55;i++){fs*=.93;card.style.setProperty('--name-fs',fs.toFixed(2)+'px');}
}

function paint(card,rarity){
 const z=ZL[rarity]*.65;
 const v={'--rx':'0deg','--ry':'0deg','--za':z+'px','--zb':'2px','--zf':'8px','--zp':'12px',
  '--comp':(1000-z)/1000,'--ax':'0px','--ay':'0px','--bx':'0px','--by':'0px',
  '--fx':'50%','--fy':'50%','--cx':'50%','--cy':'50%','--gx':'50%','--gy':'50%','--phase':'120deg',
  '--ga':.5,'--gb':.5,'--apos':'0% 0%','--bpos':'100% 0%','--foil':.85,'--grain':.75,'--glare':.2};
 for(const [k,val] of Object.entries(v))card.style.setProperty(k,String(val));
}

const grid=$('#grid');
for(const d of POOL){
 const cell=node('div','cell'),hit=node('div','hit');
 const card=node('div',`hcard r-${d.rarity} kind-${d.kind||'framed'} gem-faceted${d.bleed?' bleed':''}`);
 card.dataset.id=d.id;card.dataset.rarity=d.rarity;
 const p=d.pal||{};
 card.style.setProperty('--pal-base',p.base||'#141b2e');
 card.style.setProperty('--pal-glow',p.glow||'#2b3550');
 card.style.setProperty('--pal-accent',p.accent||'#9fb0c8');
 card.style.setProperty('--pal-ink',p.ink||'#080c17');
 const lift=node('div','card-lift'),inner=node('div','card-inner'),front=node('div','card-face');
 const stock=node('div','leaf face-stock'),bg=node('div','leaf face-depth-bg'),art=node('div','leaf face-art'),
       frame=node('div','leaf face-frame'),plate=node('div','leaf face-plate'),gem=node('div','face-gem');
 material(bg);
 const media=node('div','art-media'),img=node('img');
 img.src='art/'+d.file;img.alt='';img.draggable=false;media.append(img);
 if(masks[d.file]&&d.kind!=='flat'){const m=node('div','subject-mask');m.style.setProperty('--subject',`url("${masks[d.file]}")`);material(m);media.append(m);}
 art.append(media);
 frame.append(node('div','frame-material'));
 plate.append(node('b','face-name',d.name),node('span','face-rarity',`${LABEL[d.rarity]} / ${d.rarity.toUpperCase()}`));
 front.append(stock,bg,art,frame,plate,gem);
 inner.append(front);lift.append(inner);card.append(lift);hit.append(card);
 cell.append(hit,node('p','cap',`${LABEL[d.rarity]}・${d.file}`));
 grid.append(cell);
 paint(card,d.rarity);obs.observe(card);
}
})();
</script>
'''

page = (HTML.replace('__CARD_CSS__', '\n'.join(styles))
            .replace('__MASKS__', json.dumps(masks, separators=(',', ':')))
            .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':'))))
(OUT / 'cards-remade.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote cards-remade.html :', len(cards), 'cards, %.2f MiB' % ((OUT / 'cards-remade.html').stat().st_size / 1048576))
