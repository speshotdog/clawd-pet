# -*- coding: utf-8 -*-
"""Build the full-screen deluxe pack ceremony from the frozen shared card renderer.
UI and choreography live in ceremony.css / ceremony.js; resources use one resolver.
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
<title>精裝卡池 · 拆封</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<script>__CARD_FACE_JS__</script>
<style>__CEREMONY_CSS__</style>
<main class="win" id="win" data-screen="entry">
 <div class="stage-background" aria-hidden="true">
  <div class="stage-base"></div><div class="stage-substrate"></div>
  <div class="stage-geometry"></div><div class="stage-glow"></div>
  <div class="stage-sheen"></div><div class="stage-vignette"></div>
 </div>
 <div class="stage" id="stage">
  <div class="stageacts"><button id="revealall" hidden>跳過演出</button></div>
  <div class="entry-pack" id="entry-pack" aria-label="精裝卡包"></div>
  <div class="fan" id="fan"></div>
  <div class="entry-actions">
   <div class="pull-actions"><button id="p1">單抽</button><button id="p5">五連</button><button id="p10">十連</button></div>
   <p class="ticket-count">試抽券 <span id="ticket">30</span></p>
  </div>
  <div class="result-actions"><nav class="pages" aria-label="卡片分頁" hidden><button id="prev" aria-label="上一張或上一組">←</button><span id="page-count"></span><button id="next" aria-label="下一張或下一組">→</button></nav><button id="finish" hidden>收下</button></div>
  <p class="hint" id="hint" aria-live="polite"></p>
 </div>
</main>

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

// Test instrumentation boundary (no window dragging).


})();
</script>
'''

page = HTML.replace('__CEREMONY_JS__', '\n'.join((OUT / name).read_text(encoding='utf-8') for name in ['ceremony-layout.js','ceremony-fx.js','ceremony-audio.js','ceremony.js'])).replace('__CEREMONY_CSS__', (OUT / 'ceremony.css').read_text(encoding='utf-8')).replace('__CARD_FACE_JS__', (OUT / 'card_face.js').read_text(encoding='utf-8'))\
           .replace('__CARD_CSS__', '\n'.join(styles)) \
           .replace('__MASKS__', json.dumps(masks, separators=(',', ':'))) \
           .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':')))
page = page.replace('__SUBSTRATE_INIT__', "win.style.setProperty('--substrate', 'url(' + path('fx/summon-substrate.webp') + ')');" if (OUT / 'fx/summon-substrate.webp').exists() else '// Optional substrate pending: CSS material fallback remains active.')
(OUT / 'deluxe-gacha-b.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote deluxe-gacha-b.html  cards:', len(cards), ' %.2f MiB' % ((OUT / 'deluxe-gacha-b.html').stat().st_size / 1048576))
