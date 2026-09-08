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

# pool straight out of the game source - names are never retyped (HANDOFF 5.2)
src = (ROOT / 'src' / 'gacha-pool.js').read_text(encoding='utf-8')
body = src[src.index('const CATALOG = ['):src.index('\n  ];', src.index('const CATALOG = ['))]
pool = []
for line in body.splitlines():
    line = line.strip()
    if not line.startswith('{ id:'):
        continue
    art = re.search(r"\bsrc:\s*'([^']*)'", line)
    if not art:
        continue
    pool.append({
        'id': re.search(r"\bid:\s*'([^']*)'", line).group(1),
        'name': re.search(r"\bname:\s*'([^']*)'", line).group(1),
        'rarity': re.search(r"\brarity:\s*'([^']*)'", line).group(1),
        'file': art.group(1),
        **({'bleed': True} if 'bleed: true' in line else {}),
    })

# the four layered scene cards live only in the研究 branch, but they are the showcase
scene = [
    {'id': 'rocketdog', 'name': '宇宙冒險羊', 'rarity': 'mythic', 'scene': True},
    {'id': 'alienkitty', 'name': '天外膠膠', 'rarity': 'legendary', 'scene': True},
    {'id': 'astronaut', 'name': '玥面探索者', 'rarity': 'epic', 'scene': True},
    {'id': 'fluffdog', 'name': '居家珍獸', 'rarity': 'epic', 'scene': True},
]
cards = scene + pool

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>星軌展廳 · 精裝抽卡試抽</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
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
/* 只有人物的卡：中心點是「卡片頂端到文字框上緣」的中間，不是整張卡的中間 */
.slot .kind-framed .art-media{inset:0 6% 20% 6% !important;display:grid !important;
 place-items:center !important;padding:0 !important}
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
function makeFace(d){
  const kind=d.scene?'depth':'framed';
  const card=node('div',`hcard r-${d.rarity} kind-${kind} gem-faceted${d.scene?' scene':''}${d.bleed?' bleed':''}`);
  card.dataset.rarity=d.rarity;
  const lift=node('div','card-lift'),inner=node('div','card-inner'),front=node('div','card-face');
  const stock=node('div','leaf face-stock'),bg=node('div','leaf face-depth-bg'),art=node('div','leaf face-art'),
        frame=node('div','leaf face-frame'),plate=node('div','leaf face-plate'),gem=node('div','face-gem');
  const key=d.scene?`layer-${d.id}-subject.png`:d.file;
  const srcPath=d.scene?`layer-${d.id}-subject.png`:`art/${d.file}`;
  if(d.scene){const i=node('img');i.src=`layer-${d.id}-background.png`;i.alt='';i.draggable=false;bg.append(i);}
  else bg.append(node('div','floor'));
  material(bg);
  const media=node('div','art-media'),img=node('img');img.src=srcPath;img.alt='';img.draggable=false;media.append(img);
  if(masks[key]){const m=node('div','subject-mask');m.style.setProperty('--subject',`url("${masks[key]}")`);material(m);media.append(m);}
  art.append(media);
  frame.append(node('div','frame-material'));
  const text=node('div','face-text');
  text.append(node('b','face-name',d.name),node('span','face-rarity',`${LABEL[d.rarity]} / ${d.rarity.toUpperCase()}`));
  if(d.scene||d.bleed) front.append(stock,bg,art,frame,plate,gem,text);
  else { plate.append(node('b','face-name',d.name),node('span','face-rarity',`${LABEL[d.rarity]} / ${d.rarity.toUpperCase()}`));
         front.append(stock,bg,art,frame,plate,gem); }
  inner.append(front);lift.append(inner);card.append(lift);
  paintCard(card,d.rarity,0,0);
  sizeObserver.observe(card);
  return card;
}
// 名字與稀有度是卡片寬度的固定比例（跟展示頁同一個基準：24px / 290px 卡寬）。
// 少了這一段，--name-fs 會退回 20px，小卡上的字就會撐爆文字框。
const NAME_SHARE=24/290, RARITY_SHARE=9/290, GEM_SHARE=22/290;
const sizeObserver=new ResizeObserver(list=>{for(const e of list){const w=e.contentRect.width;if(!w)continue;
 e.target.style.setProperty('--name-fs',(w*NAME_SHARE).toFixed(2)+'px');
 e.target.style.setProperty('--rarity-fs',Math.max(6,w*RARITY_SHARE).toFixed(2)+'px');
 e.target.style.setProperty('--gem-fs',Math.max(6,w*GEM_SHARE).toFixed(2)+'px');}});
function paintCard(card,rarity,x,y){
  const z=ZLIFT[rarity]*.65,tilt=TILT[rarity],d=Math.min(1,Math.hypot(x,y));
  let t=((Math.atan2(y,x)+Math.PI)/(Math.PI*2)*4)%4;if(d<.002)t=0;
  const a=Math.floor(t),b=(a+1)%4,f=t-a,q=i=>`${i%2*100}% ${Math.floor(i/2)*100}%`;
  const v={'--rx':`${-y*tilt}deg`,'--ry':`${x*tilt}deg`,'--za':`${z}px`,'--zb':'2px','--zf':'8px','--zp':'12px',
   '--comp':(1000-z)/1000,'--ax':`${x*1.5}px`,'--ay':`${y*1.5}px`,'--bx':`${-x*.5}px`,'--by':`${-y*.5}px`,
   '--fx':`${50-26*x+10*y}%`,'--fy':`${50+16*y}%`,'--cx':`${50+20*x+8*y}%`,'--cy':`${50-24*y}%`,
   '--gx':`${50+42*x}%`,'--gy':`${50+42*y}%`,'--phase':`${120+x*70-y*40}deg`,
   '--ga':(.18+.82*d)*(1-f),'--gb':(.18+.82*d)*f,'--apos':q(a),'--bpos':q(b),
   '--foil':.85,'--grain':.75,'--glare':.45*(.3+.35*d)};
  for(const [k,val] of Object.entries(v))card.style.setProperty(k,String(val));
}

/* ── 演出 ─────────────────────────────────────────── */
const stage=$('#stage'),fan=$('#fan'),charge=$('#charge'),core=$('#core'),rays=$('#rays'),win=$('#win'),
      starfield=$('#starfield'),flashwrap=$('#flashwrap'),idlepack=$('#idlepack'),hint=$('#hint');
const btn={p1:$('#p1'),p5:$('#p5'),p10:$('#p10'),all:$('#revealall'),fin:$('#finish')};
let busy=false, slots=[], pending=0, tickets=30, cascading=false, skipped=false;
const anims=new Set();
const A=(el,frames,opts)=>{const a=el.animate(frames,{fill:'both',...opts});anims.add(a);a.finished.catch(()=>{}).finally(()=>anims.delete(a));return a;};
const wait=ms=>new Promise(r=>setTimeout(r,reduced.matches?Math.min(ms,120):ms));

function layout(n){
  const r=stage.getBoundingClientRect();
  const cw=n<=1?Math.min(230,r.height*.52):n<=5?Math.min(150,r.width/6.6):Math.min(118,r.width/8.4);
  const rows=n<=5?[n]:[5,n-5];
  const out=[];let idx=0;
  rows.forEach((count,ri)=>{
    const gap=cw*.16,total=count*cw+(count-1)*gap;
    const y=rows.length===1?0:(ri===0?-cw*.78:cw*.78);
    for(let i=0;i<count;i++,idx++) out.push({x:-total/2+i*(cw+gap)+cw/2,y,cw});
  });
  return out;
}
function shock(color,scale,dur){
  const s=node('div','shock');s.style.setProperty('--sc',color);$('#orbit').append(s);
  A(s,[{transform:'translate(-50%,-50%) scale(1)',opacity:.9,borderWidth:'4px'},
       {transform:`translate(-50%,-50%) scale(${scale})`,opacity:0,borderWidth:'1px'}],
    {duration:dur,easing:'cubic-bezier(.15,.7,.2,1)'}).finished.catch(()=>{}).finally(()=>s.remove());
}
function burst(color,count,spread){
  const box=$('#orbit').getBoundingClientRect();
  for(let i=0;i<count;i++){
    const el=node('div','spark');el.style.setProperty('--sp',color);
    el.style.left=(box.width/2)+'px';el.style.top=(box.height/2)+'px';$('#orbit').append(el);
    const a=Math.random()*Math.PI*2,d=spread*(.35+Math.random()*.85);
    A(el,[{transform:'translate(-50%,-50%) scale(1)',opacity:1},
          {transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(${(.2+Math.random()*.5).toFixed(2)})`,opacity:0}],
      {duration:700+Math.random()*600,easing:'cubic-bezier(.1,.7,.2,1)'})
      .finished.catch(()=>{}).finally(()=>el.remove());
  }
}
function rayBurst(color,dur,turns){
  rays.style.setProperty('--ray',color);
  A(rays,[{opacity:0,rotate:'0deg',scale:.2},{opacity:.5,offset:.14},
          {opacity:0,rotate:turns+'deg',scale:1.25}],{duration:dur,easing:'cubic-bezier(.1,.6,.2,1)'});
}
function shakeWin(){ if(reduced.matches)return;
  win.classList.remove('shake');void win.offsetWidth;win.classList.add('shake');
  setTimeout(()=>win.classList.remove('shake'),470); }
function flash(bg,dur,blend){
  flashwrap.style.background=bg;flashwrap.style.mixBlendMode=blend||'screen';
  A(flashwrap,[{opacity:0},{opacity:.85,offset:.12},{opacity:0}],{duration:dur,easing:'ease-out'});
}

async function pull(n){
  if(busy||tickets<n)return;
  busy=true;skipped=false;cascading=false;tickets-=n;$('#ticket').textContent=tickets;
  for(const b of [btn.p1,btn.p5,btn.p10])b.disabled=true;
  const result=draw(n);
  // 先把這一抽會用到的圖解碼好，不然揭曉的那一瞬間卡面可能還是空的
  for(const c of result){
    const im=new Image();
    const path = n => (typeof asset==='function' ? asset(n) : (n.startsWith('layer-') ? n : `art/${n}`));
    im.src = path(c.scene ? `layer-${c.id}-subject.png` : c.file);
    if(c.scene){const bgIm=new Image();bgIm.src=path(`layer-${c.id}-background.png`);}
  }
  const best=result.reduce((b,c)=>['common','rare','epic','legendary','mythic'].indexOf(c.rarity)>
                                  ['common','rare','epic','legendary','mythic'].indexOf(b)?c.rarity:b,'common');

  // 1) 蓄力：軌道亮起、能量沿環轉、核心聚光
  hint.textContent='軌道充能…';
  A(idlepack,[{opacity:1,scale:1},{opacity:0,scale:.6}],{duration:260,easing:'ease-in'});
  charge.style.setProperty('--surge',SURGE[best]);
  A(charge,[{opacity:0,rotate:'0deg'},{opacity:.95,offset:.3},{opacity:.95,rotate:'760deg'}],
    {duration:900,easing:'cubic-bezier(.3,0,.2,1)'});
  A(core,[{opacity:0,scale:.3},{opacity:1,scale:1.5,offset:.75},{opacity:0,scale:2.6}],
    {duration:900,easing:'ease-in'});
  await wait(760);
  shock(SURGE[best],9,520);

  // 2) 發牌：從核心沿軌道甩出來
  const spots=layout(n);
  fan.replaceChildren();slots=[];
  hint.textContent='點卡片揭曉，或按「全部揭曉」。';
  for(let i=0;i<n;i++){
    const s=node('div','slot');s.style.setProperty('--cw',spots[i].cw+'px');
    s.append(node('div','veilback'));s.dataset.i=i;fan.append(s);
    const a0=(i/n)*Math.PI*2;
    A(s,[{transform:`translate(${Math.cos(a0)*40}px,${Math.sin(a0)*40}px) rotate(${-160+i*22}deg) scale(.24)`,opacity:0},
         {transform:`translate(${spots[i].x}px,${spots[i].y}px) rotate(0deg) scale(1)`,opacity:1}],
      {duration:400,delay:i*42,easing:'cubic-bezier(.2,.9,.25,1.05)'});
    slots.push({el:s,data:result[i],spot:spots[i],revealed:false});
  }
  await wait(320+n*42);
  for(const sl of slots) sl.el.addEventListener('click',()=>skipAll());
  stage.addEventListener('click',skipAll);
  busy=false;
  hint.textContent='點畫面任一處＝全部翻開';
  cascade();
}

// 手遊的抽卡不用一張一張按：發完牌就一路翻下去，玩家想快轉就點畫面。
async function cascade(){
  cascading=true;
  for(const sl of slots){
    if(skipped) break;
    if(sl.revealed) continue;
    const r=sl.data.rarity;
    revealOne(sl);
    await wait(r==='mythic'?1500:r==='legendary'?1000:r==='epic'?330:170);
  }
  cascading=false;
  if(!skipped) finishReveal();
}

function skipAll(){
  if(!slots.length||skipped) return;
  skipped=true;
  for(const sl of slots) if(!sl.revealed) revealOne(sl,true);
  finishReveal();
}

function finishReveal(){
  hint.textContent='收下之後回到入口。';
  updateFinish();
}

async function revealOne(s,fast){
  if(s.revealed)return;s.revealed=true;s.el.classList.add('done');
  const r=s.data.rarity, big=r==='legendary'||r==='mythic';

  // (1) 預告：卡背先亮起來，稀有的還會抖一下。快轉時整段跳過。
  if(!fast){
    s.el.classList.add('tease');
    if(big){ s.el.classList.add('rattle'); await wait(300); s.el.classList.remove('rattle'); }
    else await wait(110);
    s.el.classList.remove('tease');
  }

  const face=makeFace(s.data);face.style.opacity='0';s.el.append(face);

  // (2) 撞擊：白閃一格 + 卡片衝出來 + 傳說以上震一下畫面
  A(s.el.querySelector('.veilback'),[{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],
    {duration:big?200:230,easing:'ease-in'});
  if(big){
    shakeWin();
    A(s.el,[{transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`},
            {transform:`translate(${s.spot.x*.3}px,${s.spot.y*.3}px) scale(1.72)`,offset:.55},
            {transform:`translate(${s.spot.x*.35}px,${s.spot.y*.35}px) scale(1.5)`}],
      {duration:520,easing:'cubic-bezier(.16,1.1,.3,1)'});
    s.el.style.zIndex='6';
  } else {
    A(s.el,[{transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`},
            {transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1.14)`,offset:.5},
            {transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`}],
      {duration:420,easing:'cubic-bezier(.2,.9,.25,1)'});
  }
  await wait(big?190:205);
  s.el.querySelector('.veilback').style.display='none';
  face.style.opacity='1';
  A(face,[{transform:'rotateY(-90deg)'},{transform:'rotateY(0deg)'}],{duration:big?260:280,easing:'ease-out'});

  // (3) 回報：份量隨稀有度階梯
  if(r==='mythic'){
    flash('linear-gradient(120deg,#ff7ad0aa,#ffc25eaa,#7dffab99,#6fd8ffaa,#c39dffaa)',760,'soft-light');
    shock('#ff7ad0',13,760);
    setTimeout(()=>shock('#6fd8ff',17,900),120);
    setTimeout(()=>shock('#fff87d',21,1000),250);
    burst('#ff7ad0',46,190);
    setTimeout(()=>burst('#6fd8ff',34,230),180);
    A(starfield,[{opacity:0},{opacity:.9,offset:.18},{opacity:0}],{duration:2200});
    A(charge,[{opacity:.9},{opacity:0}],{duration:1000});
    for(const el of document.querySelectorAll('.ring'))
      A(el,[{filter:'hue-rotate(0deg) brightness(1)'},{filter:'hue-rotate(360deg) brightness(1.6)'}],{duration:1600});
  } else if(r==='legendary'){
    flash('radial-gradient(circle,#ffd45c88,#ffb43a55 45%,transparent 74%)',600,'soft-light');
    shock('#ffd45c',11,660);
    setTimeout(()=>shock('#fff3c9',15,780),110);
    burst('#ffd45c',30,150);
  } else if(r==='epic'){
    shock('#c39dff',8,520);burst('#c39dff',14,105);
  } else {
    shock(SURGE[r],6,420);burst(SURGE[r],7,80);
  }

  // 放大的傳說／神話看完就歸位，不然會壓到旁邊的卡
  if(big){
    await wait(980);
    A(s.el,[{transform:`translate(${s.spot.x*.35}px,${s.spot.y*.35}px) scale(1.5)`},
            {transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1.06)`}],
      {duration:460,easing:'cubic-bezier(.3,.8,.3,1)'});
    s.el.style.zIndex='3';
  }
  // 揭曉後不做角度追蹤：卡固定正面，指上去放大就好（.slot.done:hover）
  updateFinish();
}

function updateFinish(){
  const left=slots.filter(s=>!s.revealed).length;
  btn.all.hidden = left===0;            // 還沒翻完時當「快轉」用
  btn.fin.hidden = left>0 || cascading;
}
btn.all.addEventListener('click',skipAll);
btn.fin.addEventListener('click',()=>{
  fan.replaceChildren();slots=[];btn.fin.hidden=true;btn.all.hidden=true;skipped=false;cascading=false;
  stage.removeEventListener('click',skipAll);
  idlepack.style.opacity='';idlepack.getAnimations().forEach(a=>a.cancel());
  hint.textContent='從軌道上取下你的卡。';
  for(const b of [btn.p1,btn.p5,btn.p10])b.disabled=tickets<1;
  btn.p5.disabled=tickets<5;btn.p10.disabled=tickets<10;
});
$('#p1').addEventListener('click',()=>pull(1));
$('#p5').addEventListener('click',()=>pull(5));
$('#p10').addEventListener('click',()=>pull(10));
$('#reset').addEventListener('click',()=>{tickets=30;$('#ticket').textContent=tickets;btn.fin.click();});
$('#ratebtn').addEventListener('click',()=>{
  hint.textContent='試抽用的假機率：神話 0.5%／傳說 4%／史詩 15%／精良 40%／普通 40.5%；十連保底一張傳說以上。正式數字未定案。';});
$('#bookbtn').addEventListener('click',()=>{hint.textContent='典藏冊在試抽版還沒接，先看抽卡。';});

// 視窗可拖曳
(() => {const win=$('#win'),bar=$('#bar');let dx=0,dy=0,ox=0,oy=0,on=false;
 bar.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;on=true;bar.setPointerCapture(e.pointerId);
  const r=win.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;});
 bar.addEventListener('pointermove',e=>{if(!on)return;ox=e.clientX-dx;oy=e.clientY-dy;
  win.style.position='fixed';win.style.left=ox+'px';win.style.top=oy+'px';win.style.margin='0';});
 bar.addEventListener('pointerup',()=>{on=false});})();

addEventListener('resize',()=>{if(!slots.length)return;const spots=layout(slots.length);
 slots.forEach((s,i)=>{s.spot=spots[i];s.el.style.setProperty('--cw',spots[i].cw+'px');
  s.el.style.transform=`translate(${spots[i].x}px,${spots[i].y}px)`;});});
})();
</script>
'''

page = HTML.replace('__CARD_CSS__', '\n'.join(styles)) \
           .replace('__MASKS__', json.dumps(masks, separators=(',', ':'))) \
           .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':')))
(OUT / 'deluxe-gacha-b.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote deluxe-gacha-b.html  cards:', len(cards), ' %.2f MiB' % ((OUT / 'deluxe-gacha-b.html').stat().st_size / 1048576))
