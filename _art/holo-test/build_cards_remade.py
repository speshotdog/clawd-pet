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
cards = pool()

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>卡池重製 · 場景卡規格</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<script>__CARD_FACE_JS__</script>
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

</style>

<h1>卡池重製 · 全部照場景卡規格</h1>
<p class="lede"><b style="color:#ffd76a">滑鼠移到卡片上可以傾斜</b>，看箔面與景深；移開回正。</p>
<p class="lede">63 張精裝研究卡依卡型呈現原插畫與背景，顏色取自每張角色圖的實際像素（<code>art/palette.json</code>），
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

const LABEL=HoloCardFace.LABEL;

function node(t,c,x){const n=document.createElement(t);if(c)n.className=c;if(x!==undefined)n.textContent=x;return n;}

function build(d,host,capHtml){
 const cell=node('div','cell'),hit=node('div','hit');
 const card=HoloCardFace.create(d,{masks,resolve:n=>(typeof __A!=='undefined'&&__A[n])||(n.startsWith('layer-')?n:'art/'+n)});
 hit.append(card);
 const cap=node('p','cap');
 cap.innerHTML=capHtml!==undefined?capHtml:`${LABEL[d.rarity]}・${d.name}`;
 cell.append(hit,cap);
 host.append(cell);
 HoloCardFace.observe(card);
 // 卡面展示頁：整張卡可以傾斜（抽卡頁不轉，只有材質跟著游標）
 hit.addEventListener('pointermove',e=>{const r=hit.getBoundingClientRect();
  HoloCardFace.paint(card,d.rarity,(e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1,{tilt:true});});
 hit.addEventListener('pointerleave',()=>HoloCardFace.paint(card,d.rarity,0,0,{tilt:true}));
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

page = (HTML.replace('__CARD_FACE_JS__', (OUT / 'card_face.js').read_text(encoding='utf-8'))
            .replace('__CARD_CSS__', '\n'.join(styles))
            .replace('__MASKS__', json.dumps(masks, separators=(',', ':')))
            .replace('__POOL__', json.dumps(cards, ensure_ascii=False, separators=(',', ':'))))
(OUT / 'cards-remade.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote cards-remade.html :', len(cards), 'cards, %.2f MiB' % ((OUT / 'cards-remade.html').stat().st_size / 1048576))
