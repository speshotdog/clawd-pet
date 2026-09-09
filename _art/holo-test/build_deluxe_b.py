# -*- coding: utf-8 -*-
"""Build the playable "星軌展廳" (style B) deluxe gacha prototype.

Reuses the card CSS and foil masks from demo.html so the cards in the prototype are
literally the deluxe card faces, then adds the floating-window UI and the pull
choreography on top. Card art is referenced relatively (../../src/card-*.png) so the
file stays small; it opens straight off file:// with no fetch.

Output: deluxe-gacha-b.html
"""
from pathlib import Path
import json, re

OUT = Path(__file__).parent
ROOT = (OUT / '../..').resolve()
demo = (OUT / 'demo.html').read_text(encoding='utf-8')

# card CSS from the demo, minus the review-page chrome template
tpl = re.search(r'<template id="baseline-css">.*?</template>', demo, re.S)
styles = [m.group(0) for m in re.finditer(r'<style[^>]*>.*?</style>', demo, re.S)
          if not (tpl.start() <= m.start() < tpl.end())]
masks = json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S).group(1))

# 卡池與卡型只有一個來源：pool_data.py（HANDOFF 三節的定案寫在那裡）
from pool_data import pool
cards = pool()          # 帶 palette，抽卡頁才有跟卡面頁一樣的背景

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>星軌展廳 · 精裝抽卡試抽</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<script>__CARD_FACE_JS__</script>
<style id="orbit-ui">
:root{--rc-mythic:#ff7ad0;--rc-legend:#ffd45c;--rc-epic:#c39dff;--rc-rare:#6fd8ff;--rc-common:#9fb0c8}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;font:14px/1.6 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;color:#dbe7ff;
 background:radial-gradient(120% 90% at 50% 0%,#151b33,#080b16 60%,#05070e);
 display:grid;place-items:center;padding:20px;overflow:hidden}

/* ── 懸浮視窗 ─────────────────────────────────────── */
.win{position:relative;width:min(96vw,1020px);aspect-ratio:3/2;max-height:92vh;border-radius:18px;
 display:flex;flex-direction:column;overflow:hidden;isolation:isolate;
 background:radial-gradient(90% 80% at 50% 0%,#1d2444,#0d1122 65%,#080b16);
 box-shadow:0 34px 70px #000b,0 0 0 1px #ffffff14,0 0 90px #2a3a7a3d}
.bar{display:flex;align-items:center;gap:10px;padding:0 18px;height:8.6%;flex:0 0 8.6%;font-size:12px;
 background:#ffffff0d;border-bottom:1px solid #ffffff1a;cursor:grab;user-select:none}
.bar b{letter-spacing:.24em;font-size:13px}
.bar .spacer{flex:1}
.chip{display:flex;gap:5px;padding:4px 11px;border-radius:999px;font-size:11px;background:#ffffff12;
 border:1px solid #ffffff26;white-space:nowrap}
.bar button{background:#ffffff10;border:1px solid #ffffff24;color:inherit;border-radius:7px;
 padding:4px 10px;font-size:11px;cursor:pointer}
.body{flex:1;display:flex;min-height:0}
.rail{width:16%;flex:0 0 16%;display:flex;flex-direction:column;gap:8px;padding:14px 12px;
 background:#ffffff08;border-right:1px solid #ffffff14}
.rail button{background:#ffffff0d;color:#b9c8e8;border:1px solid #ffffff14;border-radius:8px;
 padding:9px 6px;font-size:12px;cursor:pointer;font-family:inherit}
.rail button[aria-pressed=true]{background:linear-gradient(120deg,#ff7ad055,#6fd8ff55);color:#fff;border-color:#ffffff45}
.stage{flex:1;position:relative;display:grid;place-items:center;padding:14px;min-width:0}
.rate{position:absolute;top:14px;left:16px;font-size:11px;opacity:.6;z-index:9}
.foot{height:14%;flex:0 0 14%;display:flex;align-items:center;gap:10px;padding:0 18px;
 background:#ffffff08;border-top:1px solid #ffffff14}
.foot button{flex:1;height:70%;border-radius:10px;font:700 14px/1.25 inherit;letter-spacing:.08em;cursor:pointer;
 background:#ffffff10;color:#dbe7ff;border:1px solid #ffffff24;display:flex;flex-direction:column;
 align-items:center;justify-content:center}
.foot button small{font-weight:400;font-size:10.5px;opacity:.75}
.foot button.go{background:linear-gradient(120deg,#ff7ad0,#c39dff 45%,#6fd8ff);color:#10142a;border-color:#ffffff5c}
.foot button:disabled{opacity:.4;cursor:default}

/* ── 軌道 ─────────────────────────────────────────── */
.orbit{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.ring{position:absolute;left:50%;top:50%;translate:-50% -50%;border-radius:50%;
 border:1px solid #ffffff1f;transition:opacity .4s}
.ring.r1{width:64%;aspect-ratio:1;box-shadow:inset 0 0 70px #4d6cff2e}
.ring.r2{width:44%;aspect-ratio:1;border-style:dashed;border-color:#ffffff1a}
.ring.r3{width:86%;aspect-ratio:1;border-color:#ffffff12}
.ring.spin{animation:ring-spin 26s linear infinite}
.ring.r2.spin{animation-duration:17s;animation-direction:reverse}
.ring.r3.spin{animation-duration:38s}
@keyframes ring-spin{to{rotate:360deg}}
.charge{position:absolute;left:50%;top:50%;translate:-50% -50%;width:64%;aspect-ratio:1;border-radius:50%;
 opacity:0;background:conic-gradient(from 0deg,transparent 0 62%,var(--surge,#6fd8ff) 86%,transparent 100%);
 mask:radial-gradient(circle,transparent 0 47%,#000 49% 52%,transparent 54%);
 -webkit-mask:radial-gradient(circle,transparent 0 47%,#000 49% 52%,transparent 54%)}
.core{position:absolute;left:50%;top:50%;translate:-50% -50%;width:52px;aspect-ratio:1;border-radius:50%;
 opacity:0;background:radial-gradient(circle,#fff,#9fd8ff 40%,transparent 70%)}
.starfield{position:absolute;inset:0;opacity:0;background-repeat:repeat;
 background-image:radial-gradient(1.4px 1.4px at 20% 30%,#fff9,transparent),
  radial-gradient(1.2px 1.2px at 70% 60%,#fff7,transparent),
  radial-gradient(1.6px 1.6px at 45% 80%,#fff8,transparent),
  radial-gradient(1.2px 1.2px at 85% 20%,#fff6,transparent);
 background-size:180px 180px}
.shock{position:absolute;left:50%;top:50%;translate:-50% -50%;width:20px;aspect-ratio:1;border-radius:50%;
 border:3px solid var(--sc,#fff);opacity:0;pointer-events:none}
.flashwrap{position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:screen}
.rays{position:absolute;left:50%;top:50%;translate:-50% -50%;width:150%;aspect-ratio:1;opacity:0;pointer-events:none;
 background:conic-gradient(from 0deg,transparent 0 3deg,var(--ray,#fff) 3deg 5deg,transparent 5deg 15deg);
 filter:blur(.4px)}
.spark{position:absolute;width:7px;height:7px;border-radius:50%;pointer-events:none;
 background:radial-gradient(circle,#fff,var(--sp,#ffd45c) 55%,transparent 72%)}
.win.shake{animation:shake .42s cubic-bezier(.36,.07,.19,.97)}
@keyframes shake{10%,90%{translate:-2px 0}20%,80%{translate:4px 0}30%,50%,70%{translate:-7px 1px}40%,60%{translate:7px -1px}}
.slot.tease .veilback{animation:tease .5s ease-in-out infinite}
@keyframes tease{0%,100%{filter:brightness(1)}50%{filter:brightness(1.5) saturate(1.3)}}
.slot.rattle{animation:rattle .34s linear}
@keyframes rattle{0%,100%{rotate:0deg}25%{rotate:-3.5deg}50%{rotate:3.5deg}75%{rotate:-2deg}}
@media(prefers-reduced-motion:reduce){.win.shake,.slot.tease .veilback,.slot.rattle{animation:none}}

/* ── 卡在舞台上的排列 ─────────────────────────────── */
.fan{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.slot{position:absolute;width:var(--cw,104px);aspect-ratio:5/7;pointer-events:auto;cursor:pointer;
 transform-style:preserve-3d;transition:none}
.slot .hcard{position:absolute;inset:0}
.slot.done{cursor:default}
/* 揭曉後：指上去放大就好，不做角度追蹤 */
.slot.done{transition:scale .18s ease-out}
.slot.done:hover{scale:1.13;z-index:7}
/* 動作鍵移到舞台右上角，不要跟抽卡鍵擠在下面 */
.stageacts{position:absolute;top:10px;right:14px;display:flex;gap:8px;z-index:12}
.stageacts button{background:#ffffff12;color:#dbe7ff;border:1px solid #ffffff2e;border-radius:8px;
 padding:7px 14px;font:600 12px/1 inherit;letter-spacing:.06em;cursor:pointer}
.stageacts button.go{background:linear-gradient(120deg,#ff7ad0,#c39dff 45%,#6fd8ff);color:#10142a;border-color:#ffffff5c}
.stageacts button[hidden]{display:none}
.veilback{position:absolute;inset:0;border-radius:12px;overflow:hidden;backface-visibility:hidden;
 background:#26324f url("cardback/deluxe-back.webp") center/cover no-repeat;
 box-shadow:0 10px 20px #0009,inset 0 0 0 1px #0b1120}
.hint{position:absolute;bottom:6%;left:0;right:0;text-align:center;font-size:12px;opacity:.75;z-index:8}
.tag{position:absolute;left:50%;bottom:-22px;translate:-50% 0;font-size:10px;letter-spacing:.12em;opacity:0}
.idlepack{width:26%;max-width:150px;aspect-ratio:5/7;position:relative}
.idlepack .veilback{position:absolute;inset:0}
.idlepack{animation:bob 4.4s ease-in-out infinite}
@keyframes bob{0%,100%{translate:0 -4px}50%{translate:0 6px}}
@media(prefers-reduced-motion:reduce){
 .ring.spin,.idlepack{animation:none}
}
</style>
<style>__CEREMONY_CSS__</style>

<div class="win" id="win">
 <div class="bar" id="bar"><span></span><b>星 軌 展 廳</b><span class="spacer"></span>
  <span class="chip">◆ <i id="coin">12,400</i></span><span class="chip">券 <i id="ticket">30</i></span>
  <button id="reset">重設</button></div>
 <div class="body">
  <div class="rail">
   <button aria-pressed="true">精裝卡池</button>
   <button title="試抽版只做精裝池" disabled>一般卡池</button>
   <button id="ratebtn">機率一覽</button>
   <button id="bookbtn">典藏冊</button>
  </div>
  <div class="stage" id="stage">
   <span class="rate">神話 0.5% ／ 傳說 4% ／ 史詩 15%</span>
   <div class="stageacts">
    <button id="revealall" hidden>全部翻開</button>
    <button id="finish" class="go" hidden>收下</button>
   </div>
   <div class="orbit" id="orbit">
    <div class="ring r3 spin"></div><div class="ring r1 spin"></div><div class="ring r2 spin"></div>
    <div class="charge" id="charge"></div><div class="core" id="core"></div>
    <div class="rays" id="rays"></div>
<div class="starfield" id="starfield"></div><div class="flashwrap" id="flashwrap"></div>
   </div>
   <div class="idlepack" id="idlepack"><div class="veilback"></div></div>
   <div class="fan" id="fan"></div>
   <p class="hint" id="hint">從軌道上取下你的卡。</p>
  </div>
 </div>
 <div class="foot">
  <button id="p1">單抽<small>1 券</small></button>
  <button id="p5">五連<small>5 券</small></button>
  <button id="p10" class="go">十連<small>10 券 · 無保底</small></button>
 </div>
</div>

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
const TILT ={common:6,rare:8,epic:10,legendary:12,mythic:14};
const ZLIFT={common:24,rare:32,epic:40,legendary:48,mythic:56};
const SURGE={common:'#9fb0c8',rare:'#6fd8ff',epic:'#c39dff',legendary:'#ffd45c',mythic:'#ff7ad0'};
// 試抽用的假機率，經濟層還沒定案（DESIGN-deluxe-gacha.md 第 9 節），不要當成正式數字
const RATE=[['mythic',.005],['legendary',.04],['epic',.15],['rare',.40],['common',.405]];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const byRarity={};
for(const c of POOL)(byRarity[c.rarity] ||= []).push(c);

function rollRarity(){let r=Math.random(),acc=0;for(const [k,p] of RATE){acc+=p;if(r<acc&&byRarity[k])return k;}return 'rare';}
function pick(rarity){const a=byRarity[rarity]||byRarity.rare;return a[Math.floor(Math.random()*a.length)];}
function draw(n){
  const out=[];
  for(let i=0;i<n;i++) out.push(pick(rollRarity()));
  // 精裝池沒有保底（使用者定案，HANDOFF 六節也是這樣寫）——不要偷塞傳說
  return out;
}

/* ── 卡面：跟展示頁同一套 DOM 與 CSS ─────────────────────── */
function node(t,c,x){const n=document.createElement(t);if(c)n.className=c;if(x!==undefined)n.textContent=x;return n;}
function material(p){const s=node('div','foil-stack');['spectrum','relief','etch'].forEach(x=>s.append(node('div','foil-'+x)));
  p.append(s,node('div','foil-fiber'),node('div','foil-grain'),node('div','foil-glare'));}
function path(n){
  return (typeof asset==='function') ? asset(n) : ((n.startsWith('layer-') || n.startsWith('fx/')) ? n : 'art/'+n);
}
function makeFace(d){
  // 卡面完全交給共用建立器，抽卡頁不再自己拼一套 DOM
  const card=HoloCardFace.create(d,{masks,resolve:path});
  HoloCardFace.observe(card);
  return card;
}
// 名字與稀有度是卡片寬度的固定比例（跟展示頁同一個基準：24px / 290px 卡寬）。
// 少了這一段，--name-fs 會退回 20px，小卡上的字就會撐爆文字框。


// 揭曉後的卡：卡片本身固定不動（不轉角度、不做圖層位移），
// 但箔面、鍍膜、反光與彩虹相位跟著游標跑，指上去才看得到材質。
// 抽卡揭曉後：卡片不轉，只有材質光影跟著游標（HANDOFF 六之五）
function paintFoil(card,rarity,x,y){HoloCardFace.paint(card,rarity,x,y,{tilt:false});}

/* ── 演出 ─────────────────────────────────────────── */
__CEREMONY_JS__

// 視窗可拖曳
(() => {const win=$('#win'),bar=$('#bar');let dx=0,dy=0,ox=0,oy=0,on=false;
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;on=true;bar.setPointerCapture(e.pointerId);
  const r=win.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;});
 bar.addEventListener('pointermove',e=>{if(!on)return;ox=e.clientX-dx;oy=e.clientY-dy;
  win.style.position='fixed';win.style.left=ox+'px';win.style.top=oy+'px';win.style.margin='0';});
 bar.addEventListener('pointerup',()=>{on=false});})();


})();
</script>
'''

page = HTML.replace('__CEREMONY_JS__', (OUT / 'ceremony.js').read_text(encoding='utf-8')).replace('__CEREMONY_CSS__', (OUT / 'ceremony.css').read_text(encoding='utf-8')).replace('__CARD_FACE_JS__', (OUT / 'card_face.js').read_text(encoding='utf-8'))\
           .replace('__CARD_CSS__', '\n'.join(styles)) \
           .replace('__MASKS__', json.dumps(masks, separators=(',', ':'))) \
           .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':')))
(OUT / 'deluxe-gacha-b.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote deluxe-gacha-b.html  cards:', len(cards), ' %.2f MiB' % ((OUT / 'deluxe-gacha-b.html').stat().st_size / 1048576))
