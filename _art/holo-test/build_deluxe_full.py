# -*- coding: utf-8 -*-
"""Generate the file:// deluxe prototype only; never build or modify the game.

Run: python _art/holo-test/build_deluxe_full.py
Assets remain relative to this file. No fetch, server, or dependencies required.
"""
from pathlib import Path
import json
import re

OUT = Path(__file__).resolve().parent
ROOT = OUT.parent.parent


def data_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')


def inputs():
    demo = (OUT / 'demo.html').read_text(encoding='utf-8')
    clean = re.sub(r'<template id="baseline-css">.*?</template>', '', demo, flags=re.S)
    styles = '\n'.join(re.findall(r'<style\b[^>]*>.*?</style>', clean, re.S))
    masks = json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S)[1])
    source = (ROOT / 'src/gacha-pool.js').read_text(encoding='utf-8')
    catalog = re.search(r'const CATALOG = \[(.*?)\n  \];', source, re.S)[1]
    manifest = json.loads((OUT / 'art/manifest.json').read_text(encoding='utf-8'))
    cards = []
    for entry in re.findall(r'\{[^{}]*\}', catalog):
        fields = dict(re.findall(r"\b(id|name|rarity|src):\s*'([^']*)'", entry))
        if 'src' not in fields:
            continue
        file = fields.pop('src')
        assert file in manifest and (OUT / 'art' / file).is_file(), file
        cards.append({**fields, 'file': file, 'bleed': 'bleed: true' in entry})
    # Scene showcase metadata is absent from CATALOG. Read the approved HANDOFF
    # table, including the corrected 玥 (demo's older sceneData has a typo).
    handoff = (ROOT / 'docs/clicker/HANDOFF-holo-cards.md').read_text(encoding='utf-8')
    for line in handoff.splitlines():
        cols = [x.strip() for x in line.split('|')]
        if len(cols) < 6 or cols[1] not in ('`rocketdog`', '`alienkitty`', '`astronaut`', '`fluffdog`'):
            continue
        card_id = cols[1].strip('`')
        name = cols[3].replace('**', '')
        rarity = re.findall(r'common|rare|epic|legendary|mythic', cols[4])[-1]
        for layer in ('subject', 'background'):
            assert (OUT / f'layer-{card_id}-{layer}.png').is_file()
        cards.append({'id': card_id, 'name': name, 'rarity': rarity, 'scene': True})
    assert len(cards) == 47 and (OUT / 'cardback/deluxe-back.webp').is_file()
    return styles, masks, cards, manifest


HTML = r'''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>珍母點點 · 精裝收藏室</title>
__CSS__
<style id="deluxe-full-ui">
:root{color-scheme:dark;--paper:#f4e4b9;--navy:#121e35;--muted:#b9c5d5;font-family:"Microsoft JhengHei",sans-serif}
html,body{margin:0;width:100%;height:100%;overflow:hidden;scroll-behavior:auto}
body{background:#121e35;color:var(--paper);font:16px/1.4 "Microsoft JhengHei",sans-serif;display:block;padding:0}
*{box-sizing:border-box} [hidden]{display:none!important}
button{font:inherit;min-width:44px;min-height:44px;padding:9px 16px;border:1px solid #f4e4b947;background:#17263e;color:var(--paper);border-radius:5px;cursor:pointer;touch-action:manipulation}
button:disabled{opacity:.4;cursor:default}button:active:not(:disabled){translate:0 2px}button:focus-visible{outline:3px solid #94e1d0;outline-offset:2px}
button.primary{background:var(--paper);color:#172238;border:2px solid #0a1221;font-weight:800;box-shadow:3px 3px 0 #060f21}
button[aria-pressed=true]{border-color:#94e1d0;color:#94e1d0}
#app{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:env(safe-area-inset-top) max(16px,env(safe-area-inset-right)) env(safe-area-inset-bottom) max(16px,env(safe-area-inset-left));isolation:isolate}
.toolbar{display:flex;align-items:center;gap:10px;min-height:64px;border-bottom:1px solid #f4e4b936;z-index:10}
.wordmark{font-weight:800;letter-spacing:.12em}.grow{flex:1}.meter{font:13px monospace;color:#c0cddd;white-space:nowrap}
#volume{width:80px;min-width:44px;height:44px;margin:0;accent-color:var(--paper)}.vol-label{display:flex;align-items:center;gap:6px;font-size:13px}
#stage{position:relative;min-height:0;min-width:0;overflow:hidden}
.screen{height:100%;min-height:0}.entry{display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center;padding:24px max(16px,5vw)}
.entry-copy{max-width:420px}.kicker{font:12px monospace;letter-spacing:.22em;color:#94e1d0;margin:0 0 14px}.entry h1{font:800 clamp(32px,4.6vw,64px)/1.12 "Microsoft JhengHei",sans-serif;letter-spacing:.06em;margin:0 0 22px}.entry p{line-height:1.7;color:#c4cddd;font-size:15px}.entry .rule{border-left:3px solid #d8bd7f;padding-left:14px}.entry-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.pack-wrap{position:relative;width:min(290px,30vw,calc((100dvh - 200px)*.64));aspect-ratio:5/7;margin:auto;transform:rotate(6deg)}
.pack-wrap:before{content:"";position:absolute;inset:12px -15px -12px 8px;background:#213550;border:2px solid #f4e4b9;transform:rotate(-11deg)}
.back{position:absolute;inset:0;background:#182842 url("cardback/deluxe-back.webp") center/100% 100%;border-radius:10px;box-shadow:5px 10px 0 #050d1d66}
.seal-strip{position:absolute;top:12%;left:-5%;width:110%;height:13%;border:2px solid #0d1629;background:var(--paper);color:#172238;display:grid;place-items:center;letter-spacing:.22em;font-size:13px;font-weight:800;clip-path:polygon(0 0,100% 4%,98% 20%,100% 40%,98% 65%,100% 100%,0 96%,2% 70%,0 45%,2% 20%)}
.entry-caption{position:absolute;bottom:-35px;width:100%;text-align:center;font:11px monospace;letter-spacing:.16em;color:#aabbd1;transform:rotate(-6deg)}
#actions{min-height:86px;border-top:1px solid #f4e4b936;display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0;z-index:10}
.buy{flex:1;max-width:230px;min-height:60px;font-weight:800}.buy small{display:block;font-size:12px;font-weight:400;margin-top:3px}
.performance{display:grid;grid-template-rows:minmax(0,1fr) auto auto;gap:8px;padding:10px 0}
.arena{position:relative;display:grid;place-items:center;min-height:0;isolation:isolate;perspective:1200px}
.main-card{position:relative;width:var(--main-w,280px);aspect-ratio:5/7;z-index:3;padding:0;border:0;background:transparent;border-radius:12px;transform-style:preserve-3d}
.main-card:disabled{opacity:1}.main-card:active{translate:none}
.caption{text-align:center;min-height:49px;z-index:5}.caption strong{display:block;font-size:20px;line-height:1.3}.caption span{font-size:14px;color:#cad6e5}
.sequence{display:flex;gap:5px;overflow-x:auto;justify-content:safe center;min-height:44px;padding:0 2px}.sequence button{flex:0 0 44px;padding:4px;font-size:14px}.sequence button.revealed{border-bottom:3px solid #94e1d0}
.result{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;padding:10px 0}
.result-heading{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.result-heading h2{font-size:20px;font-weight:800}.result-heading span{font-size:13px;color:#b9c5d5}
.result-grid{display:grid;grid-template-columns:repeat(var(--cols,5),minmax(0,1fr));grid-template-rows:repeat(var(--rows,2),minmax(0,1fr));gap:12px 14px;min-height:0;padding:2px 8px 5px}
.result-item{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:44px;padding:0 2px 3px;background:transparent;border:0;box-shadow:none}
.card-thumb{position:relative;flex:none;width:var(--thumb-w,130px);aspect-ratio:5/7;pointer-events:none}
.result-label{display:block;width:100%;text-align:center;min-height:42px}.result-name{display:block;font-size:16px;font-weight:800;line-height:20px;overflow-wrap:anywhere;white-space:normal}.result-rarity{display:block;font-size:14px;line-height:18px;color:#bfcfe3}
.detail{display:grid;grid-template-rows:minmax(0,1fr) auto;padding:14px 0;gap:10px}
.info{max-width:680px;margin:auto;padding:28px 12px;overflow:auto}.info h2{font-size:28px;font-weight:800;margin-bottom:20px}.info p{color:#c3cede}.rate-row{display:flex;justify-content:space-between;border-bottom:1px solid #f4e4b929;padding:13px 0}.info .note{border:1px solid #f4e4b940;padding:16px}
.fx{position:absolute;pointer-events:none;z-index:1}.scrap{width:16px;height:9px;background:var(--paper);border:2px solid #0d1629;clip-path:polygon(0 0,100% 20%,80% 100%,10% 80%)}
.brush{width:var(--main-w);height:36%;background:#bc8bdb;clip-path:polygon(0 20%,98% 0,92% 18%,100% 25%,94% 42%,100% 60%,2% 100%,8% 80%,0 76%);transform:rotate(-18deg)}
.stamp{font-size:24px;letter-spacing:.12em;border:5px double #0c1729;color:#0c1729;background:#eac575;padding:8px 18px;transform:rotate(-12deg);z-index:4}
.ink-mark{width:45px;height:15px;border-bottom:6px solid #94d3df;border-right:6px solid #94d3df;transform:rotate(-10deg)}
.split-paper{inset:0 50% 0 0;background:#263c59;border:5px solid var(--edge,#efbdd7);clip-path:polygon(0 0,100% 0,90% 16%,100% 32%,82% 49%,99% 63%,87% 82%,100% 100%,0 100%)}
.split-paper.local{top:12%;bottom:12%;left:calc(50% - var(--main-w)/2);right:50%}.split-paper.local.right{left:50%;right:calc(50% - var(--main-w)/2)}
.split-paper.right{inset:0 0 0 50%;transform:rotate(180deg)}
#app .hcard,#app .hcard *{animation:none!important;transition:none!important}
#app .hcard{--comp:1;--ax:0px;--ay:0px;--bx:0px;--by:0px;--phase:120deg}
#app .card-lift{transform:none!important}#app .card-face,#app .card-inner{transform:none!important}
#app .leaf,#app .face-art,#app .face-gem,#app .face-text{transform:none!important}
#app .face-depth-bg{inset:2.4%;z-index:1!important}#app .face-art{z-index:3!important}#app .face-frame{z-index:4!important}
#app .face-plate{left:5%!important;right:5%!important;bottom:4%!important;height:var(--plate-h,16%)!important;padding:0 13%!important;z-index:5!important}
#app .face-text{position:absolute;left:18%;right:18%;bottom:4%;height:var(--plate-h,16%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;z-index:7!important}
#app .face-name{font-size:var(--name-fs)!important;line-height:1.15!important;letter-spacing:0!important;white-space:normal!important;text-align:center;width:100%!important;overflow:visible}
#app .face-rarity{font-size:var(--rarity-fs)!important;letter-spacing:0!important;line-height:1.1!important;white-space:nowrap}
#app .face-gem{z-index:8!important;transform:rotate(45deg)!important;bottom:calc(4% + var(--plate-h,16%)/2 - var(--gem-fs)/2)!important}
#app .kind-framed:not(.bleed) .art-media{inset:0 6% calc(4% + var(--plate-h,16%))!important;display:grid!important;place-items:center!important;padding:0!important}
#app .kind-framed:not(.bleed) .art-media>img{position:absolute!important;inset:6.25% 5.682%!important;width:88.636%!important;height:87.5%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;margin:0!important}
#app .kind-depth .face-art,#app .kind-depth .face-depth-bg{inset:0!important}#app .kind-depth .art-media{inset:0!important}
#app .kind-flat .face-art{inset:0!important}#app .kind-flat .art-media{inset:0!important}
#app .subject-mask{inset:0!important}
@media(max-width:620px){
 .toolbar{gap:6px;min-height:58px}.toolbar button{padding:8px}.wordmark{font-size:14px;letter-spacing:0}.meter{font-size:12px}.vol-label{display:none}
 .entry{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:10px;padding:18px 2px}.entry-copy{max-width:none}.entry h1{font-size:34px;margin:0 0 10px}.entry .kicker{margin-bottom:8px}.entry p{margin:6px 0;font-size:14px}.entry-links{margin-top:10px}.entry .rule{display:none}
 .pack-wrap{width:min(250px,52vw,calc((100dvh - 365px)*.65))}.entry-caption{bottom:-26px}
 #actions{min-height:74px;gap:8px;padding:10px 0}#actions button{padding:8px 9px}.buy{min-height:54px}
 .result-grid{gap:7px 10px;padding:0 2px 2px}.result-heading h2{font-size:18px}.result-heading span{font-size:12px}.result-item{gap:4px}.result-label{min-height:38px}
 .result-grid.compact .result-item{flex-direction:row;gap:8px;text-align:left;justify-content:flex-start;padding:3px;border-bottom:1px solid #f4e4b923}
 .result-grid.compact .result-label{text-align:left;flex:1;min-width:0}.result-grid.compact .result-name{line-height:19px}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body class="font-system gem-faceted ink-chroma">
<div id="app">
 <header class="toolbar"><button id="back">← 返回</button><span class="wordmark">精裝收藏室</span><span class="grow"></span><span class="meter" id="meter">試抽券 200</span><label class="vol-label">音量<input id="volume" aria-label="音量" type="range" min="0" max="100" value="70"></label><button id="mute" aria-pressed="false">靜音</button></header>
 <main id="stage"></main><footer id="actions"></footer>
</div>
<script type="application/json" id="mask-data">__MASKS__</script>
<script type="application/json" id="pool-data">__POOL__</script>
<script type="application/json" id="art-manifest">__MANIFEST__</script>
<script>
'use strict';
(() => {
const $=s=>document.querySelector(s), stage=$('#stage'), actions=$('#actions');
const POOL=JSON.parse($('#pool-data').textContent), masks=JSON.parse($('#mask-data').textContent), manifest=JSON.parse($('#art-manifest').textContent);
const LABEL={common:'普通',rare:'精良',epic:'史詩',legendary:'傳說',mythic:'神話'};
const RATE=[['mythic',.005],['legendary',.04],['epic',.15],['rare',.4],['common',.405]];
const order=['common','rare','epic','legendary','mythic'], reduced=matchMedia('(prefers-reduced-motion: reduce)');
const unavailable=new Set();
const groups=Object.fromEntries(order.map(r=>[r,POOL.filter(c=>c.rarity===r)]));
document.documentElement.style.setProperty('--frame-mask',`url("${masks.frame}")`);
document.documentElement.style.setProperty('--glitter-mask',`url("${masks.glitter}")`);
function draw(n){return Array.from({length:n},()=>{let x=Math.random(),r='common';for(const [key,p] of RATE){x-=p;if(x<0){r=key;break;}}const a=groups[r];return {...a[Math.floor(Math.random()*a.length)],edition:'deluxe'};});}
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function button(text,fn,cls=''){const e=node('button',cls,text);e.type='button';e.onclick=fn;return e;}
function material(e){const s=node('div','foil-stack');for(const c of ['spectrum','relief','etch'])s.append(node('div','foil-'+c));e.append(s,node('div','foil-fiber'),node('div','foil-grain'),node('div','foil-glare'));}
function makeFace(d){
 const kind=d.scene?'depth':d.bleed?'flat':'framed', card=node('div',`hcard r-${d.rarity} kind-${kind}${d.scene?' scene':''}`);
 Object.assign(card.dataset,{id:d.id,rarity:d.rarity,artKind:kind});
 const lift=node('div','card-lift'),inner=node('div','card-inner'),front=node('div','card-face'),stock=node('div','leaf face-stock'),bg=node('div','leaf face-depth-bg'),art=node('div','leaf face-art'),frame=node('div','leaf face-frame'),plate=node('div','leaf face-plate'),gem=node('div','face-gem'),text=node('div','face-text');
 const file=d.scene?`layer-${d.id}-subject.png`:d.file, media=node('div','art-media'),img=node('img');
 const imagePath=d.scene?file:`art/${file}`;if(!unavailable.has(imagePath))img.src=imagePath;img.alt='';img.draggable=false;media.append(img);
 if(d.scene){const b=node('img');const path=`layer-${d.id}-background.png`;if(!unavailable.has(path))b.src=path;b.alt='';b.draggable=false;bg.append(b);}
 material(bg);
 if(masks[file]&&kind!=='flat'){
  const mask=node('div','subject-mask');mask.style.setProperty('--subject',`url("${masks[file]}")`);material(mask);
  if(!d.scene){
   // The original foil is in source-image coordinates. Crop its wrapper by
   // the same manifest bbox as the trimmed PNG; never stretch an old mask.
   const m=manifest[file], [iw,ih]=m.source, [x,y]=m.bbox, [w,h]=m.size;
   const wrap=node('div','cropped-foil');Object.assign(wrap.style,{position:'absolute',overflow:'hidden'});
   mask.style.cssText+=`;inset:auto!important;left:${-x/w*100}%!important;top:${-y/h*100}%!important;width:${iw/w*100}%;height:${ih/h*100}%;mask-size:100% 100%;-webkit-mask-size:100% 100%`;
   wrap.append(mask);media.append(wrap);
  }else media.append(mask);
 }
 art.append(media);frame.append(node('div','frame-material'));text.append(node('b','face-name',d.name),node('span','face-rarity',LABEL[d.rarity]+' / '+d.rarity.toUpperCase()));
 front.append(stock,bg,art,frame,plate,gem,text);inner.append(front);lift.append(inner);card.append(lift);return card;
}
function fitCards(){
 for(const c of stage.querySelectorAll('.hcard')){
  const w=c.clientWidth,n=c.querySelector('.face-name');c.style.setProperty('--name-fs',w*24/290+'px');c.style.setProperty('--rarity-fs',w*9/290+'px');c.style.setProperty('--gem-fs',w*22/290+'px');c.style.setProperty('--plate-h','16%');
  // 名字是照卡片置中、寶石在文字框左側，所以安全半寬要取
  //「到文字框內緣」與「到寶石右緣」的較小值，再乘二。
  // 原本 n.scrollWidth>n.clientWidth 這個判斷永遠不成立（nowrap 的元素兩者相等），
  // 所以那個降級從來沒被觸發過。
  const plate=c.querySelector('.face-plate'), gemEl=c.querySelector('.face-gem');
  if(plate&&n){
   const pcs=getComputedStyle(plate), cr=c.getBoundingClientRect(), pr=plate.getBoundingClientRect();
   const cx=cr.left+cr.width/2;
   const toPlate=(pr.right-parseFloat(pcs.paddingRight))-cx;
   const toGem=gemEl?cx-(gemEl.getBoundingClientRect().right+w*.02):toPlate;
   const room=Math.max(24,2*Math.min(toPlate,toGem));
   let fs=w*24/290;
   // .face-name 是塊元素，它的 rect 寬＝文字框寬，量它會永遠超標並一路縮到下限。
   // 要量的是文字本身，用 Range。
   const textW=()=>{const r=document.createRange();r.selectNodeContents(n);
    return r.getBoundingClientRect().width;};
   for(let i=0;i<14&&textW()>room&&fs>w*24/290*.55;i++){
    fs*=.93;c.style.setProperty('--name-fs',fs.toFixed(2)+'px');}
  }
  if(n.getBoundingClientRect().height>w*24/290*1.5)c.style.setProperty('--plate-h','22%');
  const wrap=c.querySelector('.cropped-foil');if(wrap){const d=POOL.find(x=>x.id===c.dataset.id),m=manifest[d.file],box=c.querySelector('.art-media'),[iw,ih]=m.size,s=Math.min(box.clientWidth*.88636/iw,box.clientHeight*.875/ih);Object.assign(wrap.style,{width:iw*s+'px',height:ih*s+'px',left:(box.clientWidth-iw*s)/2+'px',top:(box.clientHeight-ih*s)/2+'px'});}
 }
}

// Local adaptation of gacha-audio.js: lazy context, envelope, oscillator,
// filtered noise, and scoped dry/wet routing. No game globals or audio files.
const sound=(()=>{
 let ctx,bus,noiseBuffer,muted=false,volume=.7;const scopes=new Set();
 function ensure(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;if(!ctx){ctx=new AC();bus=ctx.createGain();bus.gain.value=muted?0:volume*.6*.7;bus.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;}catch{return null;}}
 function scope(){if(!ensure())return {tone(){},noise(){},stop(){}};const out=ctx.createGain();out.connect(bus);const sources=new Set(),nodes=[out];let dead=false;
  function emit(freq,t,d,g,type='sine',wet=0,slide=0){if(dead||muted||!volume||ctx.state!=='running')return;let src;if(freq){src=ctx.createOscillator();src.type=type;src.frequency.setValueAtTime(freq,t);if(slide)src.frequency.exponentialRampToValueAtTime(slide,t+d);}else{if(!noiseBuffer){noiseBuffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const a=noiseBuffer.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;}src=ctx.createBufferSource();src.buffer=noiseBuffer;}
   const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(g,t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+d);nodes.push(src,gain);
   if(!freq){const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=type;f.Q.value=.8;src.connect(f).connect(gain);nodes.push(f);}else src.connect(gain);
   gain.connect(out);if(wet){for(const delay of [.173,.251]){const echo=ctx.createDelay(.3),eg=ctx.createGain();echo.delayTime.value=delay;eg.gain.value=wet;gain.connect(echo).connect(eg).connect(out);nodes.push(echo,eg);}}
   sources.add(src);src.onended=()=>sources.delete(src);src.start(t);src.stop(t+d+.02);
  }
  const s={tone(f,delay=0,d=.1,g=.1,type='sine',wet=0,slide=0){emit(f,ctx.currentTime+delay,d,g,type,wet,slide);},noise(delay=0,d=.06,g=.08,f=1800){emit(0,ctx.currentTime+delay,d,g,f);},stop(ms=30){if(dead)return;dead=true;const t=ctx.currentTime;out.gain.cancelScheduledValues(t);out.gain.setValueAtTime(out.gain.value,t);out.gain.linearRampToValueAtTime(0,t+ms/1000);for(const src of sources){try{src.stop(t+ms/1000);}catch{}}setTimeout(()=>{for(const n of nodes)n.disconnect();scopes.delete(s);},ms+5);}};scopes.add(s);return s;
 }
 function stop(ms=30){for(const s of scopes)s.stop(ms);}
 function gain(){if(!ctx)return;const t=ctx.currentTime;bus.gain.cancelScheduledValues(t);bus.gain.setValueAtTime(bus.gain.value,t);bus.gain.linearRampToValueAtTime(muted?0:volume*.6*.7,t+.025);if(muted||!volume)stop(25);}
 return {ensure,scope,stop,mute(v){muted=v;gain();},volume(v){volume=v;gain();},snapshot:()=>({muted,volume,scopes:scopes.size,context:ctx?.state||'uninitialized'})};
})();
let muted=false;
$('#mute').onclick=()=>{muted=!muted;sound.mute(muted);$('#mute').textContent=muted?'開啟聲音':'靜音';$('#mute').setAttribute('aria-pressed',String(muted));};
$('#volume').oninput=e=>sound.volume(Number(e.target.value)/100);
document.addEventListener('pointerdown',()=>sound.ensure(),{once:true});document.addEventListener('keydown',()=>sound.ensure(),{once:true});

let view='entry',tickets=200,pending=null,collection=[],index=0,auto=false,busy=false,inspection=0,sequence=0;
// This prototype has its own save key; it never reads or writes game saves.
const SAVE_KEY='deluxe-full-prototype-v1';
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({tickets,pending,collection,sequence}));}catch{/* file:// storage may be unavailable; this tab still retains its draw. */}}
function restore(){try{const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!saved)return;const hydrate=c=>{const d=POOL.find(x=>x.id===c.id);if(!d)throw Error('Unknown prototype card');return {...d,edition:'deluxe'};};const owned=saved.collection.map(hydrate),p=saved.pending;if(p&&!p.collected){if(![1,5,10].includes(p.cards.length)||p.seen.length!==p.cards.length)throw Error('Invalid draw');p.cards=p.cards.map(hydrate);}if(!Number.isInteger(saved.tickets)||saved.tickets<0)throw Error('Invalid tickets');tickets=saved.tickets;collection=owned;pending=p&&!p.collected?p:null;sequence=saved.sequence||0;}catch{/* Ignore stale prototype data; all catalog names remain authoritative. */}}
let epoch=0,clockBase=0,audioScope=null;const timers=new Map(),animations=new Set();
function cancel(){epoch++;for(const [id,resolve] of timers){clearTimeout(id);resolve(false);}timers.clear();for(const a of animations)a.cancel();animations.clear();stage.querySelectorAll('.fx').forEach(e=>e.remove());sound.stop();audioScope=null;busy=false;}
function wait(ms,token=epoch){return new Promise(resolve=>{const id=setTimeout(()=>{timers.delete(id);resolve(token===epoch);},Math.max(0,ms));timers.set(id,resolve);});}
async function at(ms,token){return wait(clockBase+ms-performance.now(),token);}
function animate(e,frames,duration,delay=0){if(!e||reduced.matches)return;const a=e.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.75,.25,1)',fill:'none'});animations.add(a);a.finished.catch(()=>{}).finally(()=>{a.cancel();animations.delete(a);if(e.classList.contains('fx'))e.remove();});return a;}
function resetPage(next){persist();view=next;stage.replaceChildren();actions.replaceChildren();$('#app').dataset.view=next;$('#meter').textContent=`試抽券 ${tickets}`;$('#back').textContent=pending?'← 返回保留':'← 返回';$('#back').disabled=next==='entry';}
function layout(){
 const arena=stage.querySelector('.arena');if(arena){const w=Math.max(44,Math.min(arena.clientWidth-40,(arena.clientHeight-16)*5/7,360));stage.style.setProperty('--main-w',w+'px');}
 const grid=stage.querySelector('.result-grid');if(grid){const n=grid.children.length,portrait=innerWidth<=620,cols=n===1?1:portrait?2:5,rows=Math.ceil(n/cols),cellH=(grid.clientHeight-(rows-1)*(portrait?7:12))/rows,cellW=(grid.clientWidth-(cols-1)*(portrait?10:14)-16)/cols;
  const compact=portrait&&cellH<160;grid.classList.toggle('compact',compact);grid.style.setProperty('--cols',cols);grid.style.setProperty('--rows',rows);
  const w=compact?Math.min((cellH-8)*5/7,cellW*.43):Math.min((cellH-64)*5/7,cellW-8,n===1?360:240);grid.style.setProperty('--thumb-w',Math.max(28,w)+'px');
 }
 fitCards();
}
new ResizeObserver(layout).observe(stage);
function entry(focus=false){cancel();resetPage('entry');stage.innerHTML='<section class="screen entry"><div class="entry-copy"><p class="kicker">珍母點點 / DELUXE EDITION</p><h1>拆一封。<br>珍藏這一刻。</h1><p>熟悉的夥伴，換上精裝箔光。<br>揭開封套，讓下一張親自亮相。</p><p class="rule">每張獨立抽取，沒有保底。<br>試抽機率與券價均未定案。</p><div class="entry-links"></div></div><div class="pack-wrap"><div class="back"></div><div class="seal-strip">珍藏 · 封緘</div><span class="entry-caption">一封尚未揭曉的相遇</span></div></section>';
 const links=stage.querySelector('.entry-links');links.append(button('機率一覽',()=>info('rates')),button(`典藏冊 · ${collection.length}`,()=>info('collection')));
 if(pending)actions.append(button('繼續這包 · 結果已保留',results,'primary'));
 else for(const n of [1,5,10]){const b=button('',()=>pull(n),'buy'+(n===10?' primary':''));b.innerHTML=(n===1?'單抽':n===5?'五連':'十連')+`<small>${n} 試抽券</small>`;b.disabled=tickets<n;actions.append(b);}
 if(tickets<10&&!pending)links.append(button('補充試抽券',()=>{tickets=200;entry();}));if(focus)actions.querySelector('button')?.focus();
}
function info(kind){cancel();resetPage(kind);const e=node('section','screen info');
 if(kind==='rates'){e.innerHTML='<p class="kicker">POOL NOTES / 精裝試抽</p><h2>每一張，獨立相遇。</h2><p class="note">以下是假機率，僅供試抽，尚未定案。<br>精裝池沒有保底；十連也是十次獨立抽取。</p>';for(const [r,p] of RATE){const row=node('div','rate-row');row.append(node('span','',LABEL[r]),node('strong','',(p*100).toFixed(1)+'%'));e.append(row);}e.append(node('p','','目前提供 43 張有卡圖的角色／玩具與 4 張場景展示卡。缺圖角色未加入。'));}
 else{e.append(node('h2','',`典藏冊 · ${collection.length} 張`));if(!collection.length)e.append(node('p','','收下的卡片會放在這裡。本次原型不連接遊戲存檔。'));for(const c of collection){const row=node('div','rate-row');row.append(node('span','',c.name),node('span','',LABEL[c.rarity]+' · 精裝'));e.append(row);}}
 stage.append(e);actions.append(button('返回收藏室',()=>entry(true),'primary'));
}
async function preload(cards){const paths=new Set(['cardback/deluxe-back.webp']);for(const c of cards){paths.add(c.scene?`layer-${c.id}-subject.png`:`art/${c.file}`);if(c.scene)paths.add(`layer-${c.id}-background.png`);}await Promise.all([...paths].map(src=>new Promise(resolve=>{const i=new Image(),failed=()=>{unavailable.add(src);resolve();};i.onload=()=>i.decode().then(resolve,failed);i.onerror=failed;i.src=src;})));}
async function pull(n){
 if(pending||busy||tickets<n)return;cancel();const token=epoch;busy=true;pending={id:++sequence,cards:draw(n),seen:Array(n).fill(false),collected:false,highlight:-1};tickets-=n;persist();
 const rank=Math.max(...pending.cards.map(c=>order.indexOf(c.rarity)));if(rank>=3)pending.highlight=pending.cards.findIndex(c=>order.indexOf(c.rarity)===rank);
 for(const b of actions.querySelectorAll('button'))b.disabled=true;$('#meter').textContent=`試抽券 ${tickets}`;
 await preload(pending.cards);if(token!==epoch)return;if(unavailable.size){results();stage.querySelector('.result-heading span').textContent='部分卡圖未載入，結果仍可收下';return;}
 if(token!==epoch)return;index=0;auto=false;performancePage();busy=true;clockBase=performance.now();audioScope=sound.scope();const s=audioScope;
 s.tone(660,0,.072,.08,'triangle');s.noise(.13,.082,.1,2500);for(let i=0;i<8;i++)s.noise(.38+i*.028,.029,.08+i*.007,1800+i*200);s.tone(130,.7,.123,.16,'sine',0,80);
 const main=stage.querySelector('.main-card'),strip=node('div','seal-strip','珍藏 · 封緘');main.append(strip);
 if(!reduced.matches)animate(main,[{transform:'translateX(22vw) rotate(6deg)'},{transform:'translateX(0) rotate(0)'}],420);
 if(!await at(reduced.matches?80:420,token))return;
 if(!reduced.matches){animate(strip,[{transform:'translate(0,0)'},{transform:'translate(90px,-70px) rotate(25deg)',opacity:0}],280);scraps(main);}
 if(!await at(reduced.matches?80:700,token))return;strip.remove();animate(main,[{transform:'translateY(-14px)'},{transform:'translateY(0)'}],180);
 if(!await at(reduced.matches?160:880,token))return;audioScope?.stop();audioScope=null;busy=false;performancePage();if(auto)reveal(index);
}
function scraps(main){const arena=main.parentElement,b=main.getBoundingClientRect(),r=arena.getBoundingClientRect();for(let i=0;i<6;i++){const e=node('i','fx scrap');e.style.left=b.left-r.left+b.width*i/6+'px';e.style.top=b.top-r.top+b.height*.18+'px';arena.append(e);animate(e,[{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:`translate(${25+i*9}px,${-35-i*6}px) rotate(${i*29}deg)`,offset:.45},{transform:`translate(${55+i*9}px,100px) rotate(${i*43}deg)`,opacity:0}],450);}}
function performancePage(){resetPage('performance');const page=node('section','screen performance'),arena=node('div','arena'),main=button('',()=>reveal(index),'main-card');main.setAttribute('aria-label',pending.seen[index]?'已揭曉卡片':'揭開第 '+(index+1)+' 張');main.disabled=busy||pending.seen[index];main.append(pending.seen[index]?makeFace(pending.cards[index]):node('div','back'));arena.append(main);const caption=node('div','caption');caption.setAttribute('aria-live','polite');caption.append(node('strong','',pending.seen[index]?pending.cards[index].name:'輕觸卡背，揭開相遇'),node('span','',pending.seen[index]?LABEL[pending.cards[index].rarity]+' · 精裝':`第 ${index+1} 張 / ${pending.cards.length} 張`));const seq=node('nav','sequence');seq.setAttribute('aria-label','抽卡順序');pending.seen.forEach((seen,i)=>{const b=button(String(i+1),()=>choose(i),seen?'revealed':'');b.disabled=busy;b.setAttribute('aria-label',seen?`第 ${i+1} 張，${pending.cards[i].name}`:`第 ${i+1} 張，未揭曉`);b.setAttribute('aria-pressed',String(i===index));seq.append(b);});page.append(arena,caption,seq);stage.append(page);
 actions.append(button('跳過 · 全部結果',results),button(auto?'暫停自動':'自動揭曉',toggleAuto));const next=button(pending.seen[index]?'下一張':'揭曉這張',()=>pending.seen[index]?advance():reveal(index),'primary');next.disabled=busy;actions.append(next);layout();}
function choose(i){if(busy)return;index=i;auto=false;performancePage();if(!pending.seen[i])reveal(i);}
function toggleAuto(){auto=!auto;if(!auto){if(busy){actions.children[1].textContent='自動揭曉';}else{cancel();performancePage();}return;}if(!busy){if(pending.seen[index])advance();else reveal(index);}else actions.children[1].textContent='暫停自動';}
function advance(){if(busy)return;let next=pending.seen.findIndex((v,i)=>!v&&i>index);if(next<0)next=pending.seen.indexOf(false);if(next<0){results();return;}index=next;performancePage();reveal(index);}
function effect(r,hero){if(reduced.matches)return;const arena=stage.querySelector('.arena'),main=arena.querySelector('.main-card'),b=main.getBoundingClientRect(),a=arena.getBoundingClientRect();
 if(r==='rare'){const e=node('i','fx ink-mark');e.style.left=b.right-a.left-30+'px';e.style.top=b.bottom-a.top-50+'px';arena.append(e);animate(e,[{opacity:0,scale:.5},{opacity:1,scale:1,offset:.45},{opacity:0,scale:1}],200);}
 if(r==='epic'){const e=node('div','fx brush');arena.append(e);animate(e,[{clipPath:'inset(100% 100% 0 0)'},{clipPath:'inset(0 0 0 0)',offset:.6},{opacity:0}],220);}
 if(r==='legendary'){const brush=node('div','fx brush');brush.style.background='#eac575';brush.style.height='10%';brush.style.top=b.top-a.top+'px';arena.append(brush);animate(brush,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)',offset:.6},{opacity:0}],hero?320:220);const e=node('div','fx stamp','珍藏');e.style.left=b.left-a.left-12+'px';e.style.top=b.top-a.top+10+'px';arena.append(e);animate(e,[{transform:'translateY(-75px) rotate(-12deg) scale(1.3)',opacity:0},{transform:'translateY(0) rotate(-12deg) scale(1)',opacity:1,offset:.35},{opacity:0}],hero?320:220);animate(main,[{transform:'translateY(0)'},{transform:'translateY(4px)',offset:.35},{transform:'translateY(0)'}],320);}
 if(r==='mythic'){for(let layer=0;layer<(hero?3:1);layer++)for(const side of [-1,1]){const e=node('div','fx split-paper'+(hero?'':' local')+(side===1?' right':''));e.style.setProperty('--edge',['#efbdd7','#f4e4b9','#96dccc'][layer]);arena.append(e);animate(e,[{transform:`translateX(0) ${side===1?'rotate(180deg)':''}`,opacity:1},{transform:`translateX(${side*(hero?85:35)}%) ${side===1?'rotate(180deg)':''}`,opacity:0}],hero?460:300,layer*60);}}
}
function impact(s,r,hero){
 if(r==='common')s.tone(330,0,.103,.1,'triangle');
 if(r==='rare'){s.tone(659,0,.133,.1,'triangle');s.tone(988,.06,.133,.07);}
 if(r==='epic'){[523,659,784].forEach((f,i)=>s.tone(f,i*.045,.173,.07,'triangle'));s.noise(0,.062,.05,2400);}
 if(r==='legendary'){s.tone(95,0,.183,.2,'sine',0,50);[392,784,1082].forEach((f,i)=>s.tone(f,0,hero?.463:.223,[.09,.045,.03][i]*(hero?1:.8),'sine',hero?.08:0));s.noise(0,.056,.08,1000);}
 if(r==='mythic'){s.tone(80,0,.264,.2,'sine',0,40);s.tone(262,0,.245,.07,'triangle');[784,988,1175].forEach((f,i)=>s.tone(f,.06+i*.06,hero?.464:.223,.06,'sine',hero?.1:0));s.noise(0,.117,.08,1600);}
}
async function reveal(i){
 if(busy||!pending||pending.seen[i])return;busy=true;index=i;performancePage();const token=epoch,c=pending.cards[i],r=c.rarity,hero=i===pending.highlight;
 const v=reduced.matches?150:({common:400,rare:400,epic:460,legendary:hero?680:460,mythic:hero?860:520}[r]);
 const slot=reduced.matches?(order.indexOf(r)>=3?900:500):({common:900,rare:1000,epic:1200,legendary:hero?1900:1300,mythic:hero?2400:1450}[r]);
 audioScope?.stop(60);const s=audioScope=sound.scope();clockBase=performance.now();s.tone(180,0,.062,.07,'triangle');s.noise(0,.036,.06);const main=stage.querySelector('.main-card');animate(main,[{transform:'translateY(0)'},{transform:'translateY(3px)'}],100);
 if(!await at(reduced.matches?100:170,token))return;s.noise(0,.065,.1,1800);s.tone(160,0,.082,.1,'sine',0,90);
 if(!await at(reduced.matches?120:220,token))return;animate(main,[{transform:'rotateY(0deg)'},{transform:'rotateY(88deg)'}],v-(reduced.matches?120:220));
 // No sound in the 120/180 ms lead-in to the one full high-rarity reveal.
 if(!await at(v-50,token))return;if(order.indexOf(r)>=3)s.noise(0,.045,.07,1100);
 if(!await at(v,token))return;pending.seen[i]=true;persist();main.replaceChildren(makeFace(c));layout();impact(s,r,hero);effect(r,hero);main.style.transform='none';
 const caption=stage.querySelector('.caption');caption.replaceChildren(node('strong','',c.name),node('span','',`${LABEL[r]} · 精裝 · ${i+1} / ${pending.cards.length}`));main.setAttribute('aria-label',c.name+'，'+LABEL[r]);
 busy=false;actions.lastElementChild.disabled=false;actions.lastElementChild.textContent='下一張';actions.lastElementChild.onclick=()=>{cancel();advance();};
 if(!await at(slot,token))return;s.stop();if(auto){busy=true;if(!await wait(reduced.matches?0:160,token))return;busy=false;advance();}else if(pending.seen.every(Boolean))results();else performancePage();
}
function results(){if(!pending)return;cancel();auto=false;pending.seen.fill(true);resetPage('results');const e=node('section','screen result'),head=node('div','result-heading');head.append(node('h2','',`這一封 · ${pending.cards.length} 張`),node('span','','點任一卡片，放大細看'));const grid=node('div','result-grid');pending.cards.forEach((c,i)=>{const b=button('',()=>detail(i),'result-item');b.dataset.index=i;b.setAttribute('aria-label',`檢視 ${c.name}，${LABEL[c.rarity]}`);const thumb=node('span','card-thumb'),label=node('span','result-label');thumb.append(makeFace(c));label.append(node('strong','result-name',c.name),node('span','result-rarity',LABEL[c.rarity]));b.append(thumb,label);grid.append(b);});e.append(head,grid);stage.append(e);actions.append(button('收下全部',collect,'primary'));layout();}
function detail(i){cancel();inspection=(i+pending.cards.length)%pending.cards.length;resetPage('detail');const c=pending.cards[inspection],e=node('section','screen detail'),arena=node('div','arena'),main=node('div','main-card'),caption=node('div','caption');main.append(makeFace(c));arena.append(main);caption.append(node('strong','',c.name),node('span','',`${LABEL[c.rarity]} · 精裝 · ${inspection+1} / ${pending.cards.length}`));e.append(arena,caption);stage.append(e);actions.append(button('上一張',()=>detail(inspection-1)),button('回到十張總覽'.replace('十張',pending.cards.length===10?'十張':'結果'),()=>{results();stage.querySelectorAll('.result-item')[inspection]?.focus();},'primary'),button('下一張',()=>detail(inspection+1)));layout();actions.children[1].focus();}
async function collect(){if(!pending||pending.collected||busy)return;cancel();const token=epoch,batch=pending;busy=true;batch.collected=true;collection.push(...batch.cards);persist();actions.querySelectorAll('button').forEach(b=>b.disabled=true);const s=audioScope=sound.scope();s.noise(0,.14,.1,800);s.tone(196,.16,.123,.12,'triangle');s.tone(392,.2,.123,.06);const grid=stage.querySelector('.result-grid'),envelope=node('div','pack-wrap');Object.assign(envelope.style,{position:'absolute',width:'110px',left:'calc(50% - 55px)',bottom:'8px',zIndex:'6',transform:'none'});envelope.append(node('div','back'));stage.append(envelope);animate(grid,[{transform:'scale(1)',opacity:1},{transform:'translateY(30%) scale(.12)',opacity:0}],240);const seal=node('div','seal-strip','珍藏 · 入袋');envelope.append(seal);animate(seal,[{transform:'translateY(-16px)',opacity:0},{transform:'translateY(0)',opacity:1}],100,200);if(!await wait(reduced.matches?80:320,token))return;pending=null;entry(true);}
$('#back').onclick=()=>{if(view==='detail'){results();return;}if(view==='entry')return;if(pending?.collected)pending=null;entry(true);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();$('#back').click();}if(view==='detail'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();detail(inspection+(e.key==='ArrowLeft'?-1:1));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();auto=false;if(pending?.collected){pending=null;entry();}else if(pending)entry();}});
reduced.addEventListener('change',()=>{if(view==='performance'){cancel();auto=false;performancePage();}});
window.addEventListener('pagehide',cancel);
window.__draw=draw;
window.deluxe={draw, snapshot:()=>({view,tickets,pending:pending?JSON.parse(JSON.stringify(pending)):null,collected:collection.length,auto,busy,timers:timers.size,animations:animations.size,audio:sound.snapshot()}),catalog:POOL.map(c=>({...c}))};
restore();entry();
})();
</script></body></html>'''


def main():
    styles, masks, cards, manifest = inputs()
    page = HTML
    for key, value in {'__CSS__': styles, '__MASKS__': data_json(masks),
                       '__POOL__': data_json(cards), '__MANIFEST__': data_json(manifest)}.items():
        page = page.replace(key, value)
    target = OUT / 'deluxe-gacha-full.html'
    target.write_text(page, encoding='utf-8', newline='\n')
    print(f'wrote {target.name}: {len(cards)} cards, {target.stat().st_size} bytes')


if __name__ == '__main__':
    main()
