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
manifest = json.loads((OUT / 'art' / 'manifest.json').read_text(encoding='utf-8'))

# 卡池與卡型只有一個來源：pool_data.py（HANDOFF 三節的定案寫在那裡）
from pool_data import pool
cards = pool(with_scenes=False)

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
h2{font-size:16px;letter-spacing:.05em;margin:34px 0 4px}
.compare{display:grid;grid-template-columns:repeat(2,minmax(0,260px));gap:26px;margin:10px 0 6px}
.compare .cap b{color:#c9d4e6;display:block;font-size:13px;margin-bottom:2px}

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
<p class="lede"><b style="color:#ffd76a">滑鼠移到卡片上可以傾斜</b>，看箔面與景深；移開回正。</p>
<p class="lede">43 張都補上滿版背景，顏色取自每張角色圖的實際像素（<code>art/palette.json</code>），
所以背景跟角色同調而不是所有卡共用一層深色。版型維持已定案的：滿版圖窗、人物置中、
文字框帶階級寶石與名字。背景是 CSS 圖層，不是一張一張畫出來的圖。</p>
<h2>平面滿版：滅世珍獸</h2>
<p class="lede">同一張圖，左邊用舊版的假景深（當成拆得開的兩層去推 Z），
右邊是定案的平面滿版：整張平鋪、不做圖內視差，景深只發生在卡片本身傾斜。
滑鼠移上去傾斜看差別。</p>
<div class="compare" id="compare"></div>
<h2>全卡池</h2>
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

function paint(card,rarity,x,y){
 x=x||0; y=y||0;
 const z=ZL[rarity]*.65, tilt=TL[rarity];
 const d=Math.min(1,Math.hypot(x,y));
 let t=((Math.atan2(y,x)+Math.PI)/(Math.PI*2)*4)%4; if(d<.002)t=0;
 const qa=Math.floor(t), qb=(qa+1)%4, f=t-qa, q=i=>`${i%2*100}% ${Math.floor(i/2)*100}%`;
 const v={'--rx':`${-y*tilt}deg`,'--ry':`${x*tilt}deg`,'--za':z+'px','--zb':'2px','--zf':'8px','--zp':'12px',
  '--comp':(1000-z)/1000,'--ax':`${x*1.5}px`,'--ay':`${y*1.5}px`,'--bx':`${-x*.5}px`,'--by':`${-y*.5}px`,
  '--fx':`${50-26*x+10*y}%`,'--fy':`${50+16*y}%`,'--cx':`${50+20*x+8*y}%`,'--cy':`${50-24*y}%`,
  '--gx':`${50+42*x}%`,'--gy':`${50+42*y}%`,'--phase':`${120+x*70-y*40}deg`,
  '--ga':(.18+.82*d)*(1-f),'--gb':(.18+.82*d)*f,'--apos':q(qa),'--bpos':q(qb),
  '--foil':.85,'--grain':.75,'--glare':.45*(.3+.35*d)};
 for(const [k,val] of Object.entries(v))card.style.setProperty(k,String(val));
}

function build(d,host,capHtml){
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
 // 名字一律放獨立的 .face-text（第十八輪統一），文字框只當背板。
 // 之前塞在 .face-plate 裡，depth／flat 的 CSS 預期的是 .face-text，
 // 所以對照組那兩張的文字框與名字整個沒畫出來。
 const text=node('div','face-text');
 text.append(node('b','face-name',d.name),node('span','face-rarity',`${LABEL[d.rarity]} / ${d.rarity.toUpperCase()}`));
 front.append(stock,bg,art,frame,plate,gem,text);
 inner.append(front);lift.append(inner);card.append(lift);hit.append(card);
 const cap=node('p','cap');
 cap.innerHTML=capHtml!==undefined?capHtml:`${LABEL[d.rarity]}・${d.file}`;
 cell.append(hit,cap);
 host.append(cell);
 paint(card,d.rarity,0,0);obs.observe(card);
 // 不是鎖定版：滑過去可以傾斜看箔面，離開回正
 hit.addEventListener('pointermove',e=>{const r=hit.getBoundingClientRect();
  paint(card,d.rarity,(e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1);});
 hit.addEventListener('pointerleave',()=>paint(card,d.rarity,0,0));
 return card;
}

const grid=$('#grid');
for(const d of POOL) build(d,grid);

// Round 7 的對照組搬過來：同一張圖，一邊當拆得開的兩層推 Z（舊版假景深），
// 一邊照定案做平面滿版。卡型是資料欄位，不是靠 id 判斷。
const mieshi=POOL.find(c=>c.id==='mieshi');
if(mieshi){
 const cmp=$('#compare');
 const a=build({...mieshi,kind:'depth'},cmp,'<b>舊版假景深</b>兩層沿 Z 推開');
 a.dataset.id='compare-depth';
 const b=build({...mieshi,kind:'flat'},cmp,'<b>平面滿版（定案）</b>不做圖內視差');
 b.dataset.id='compare-flat';
}
})();
</script>
'''

page = (HTML.replace('__CARD_CSS__', '\n'.join(styles))
            .replace('__MASKS__', json.dumps(masks, separators=(',', ':')))
            .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':'))))
(OUT / 'cards-remade.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote cards-remade.html :', len(cards), 'cards, %.2f MiB' % ((OUT / 'cards-remade.html').stat().st_size / 1048576))
