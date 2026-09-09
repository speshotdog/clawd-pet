/* Round 28: generation / revealed / complete remain the A5 ownership contract. */
const stage=$('#stage'),fan=$('#fan'),win=$('#win'),idlepack=$('#idlepack'),hint=$('#hint');
const btn={p1:$('#p1'),p5:$('#p5'),p10:$('#p10'),all:$('#revealall'),fin:$('#finish')};
let busy=false,slots=[],pending=0,tickets=30,cascading=false,skipped=false,generation=0;
const anims=new Set(),timers=new Map(),rafs=new Map(),voices=new Set();
const testing=new URLSearchParams(location.search).has('ceremony-test');
const events=[];
let root=null,ready=Promise.resolve(),audio=null,muted=true,collectMarked=false;
try{muted=localStorage.getItem('holo-muted')!=='false';}catch{}
const audioButton=node('button','','音效：關');audioButton.id='sound';
$('.stageacts').prepend(audioButton);
function audioLabel(){audioButton.textContent=muted?'音效：關':'音效：開';audioButton.setAttribute('aria-pressed',String(!muted));}
audioLabel();
audioButton.addEventListener('click',async()=>{muted=!muted;try{localStorage.setItem('holo-muted',String(muted));}catch{}
  if(!muted){try{audio ||= new AudioContext();await audio.resume();}catch{muted=true;}}
  else stopAudio();audioLabel();});
function mark(type,s,extra={}){if(testing)events.push({type,time:Date.now(),run:generation,index:s?slots.indexOf(s):null,...extra});}
function sound(kind,s){
  const record={kind,muted,state:audio?.state||'uninitialized',audioTime:audio?.currentTime??null};
  mark('audio',s,record);if(muted||audio?.state!=='running')return;
  const t=audio.currentTime,d=kind==='charge'?.62:kind==='tear'?.18:kind==='impact'?.12:.45;
  const frequencies=kind==='chord'?[261.63,329.63,392]:kind==='charge'?[160]:kind==='impact'?[65]:[1200,1730];
  for(const f of frequencies){const o=audio.createOscillator(),g=audio.createGain();o.type=kind==='tear'?'sawtooth':'sine';
    o.frequency.setValueAtTime(f,t);if(kind==='charge')o.frequency.exponentialRampToValueAtTime(500,t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045/frequencies.length,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g).connect(audio.destination);o.outputGain=g;voices.add(o);o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();updateFinish();};o.start(t);o.stop(t+d);
  }
}
function stopAudio(){for(const o of voices){o.onended=null;try{o.stop();o.disconnect();o.outputGain.disconnect();}catch{}}voices.clear();}
const A=(el,frames,opts)=>{const run=generation,a=el.animate(frames,{fill:'both',...opts});anims.add(a);
  a.finished.catch(()=>{}).finally(()=>{anims.delete(a);if(run===generation)updateFinish();});return a;};
const wait=(ms,run=generation)=>new Promise(resolve=>{const id=setTimeout(()=>{timers.delete(id);resolve(run===generation);updateFinish();},ms);timers.set(id,()=>resolve(false));});
function later(fn,ms,run=generation){const id=setTimeout(()=>{timers.delete(id);if(run===generation){fn();updateFinish();}},ms);timers.set(id,()=>{});return id;}
function sweep(s,duration=450){const run=generation,start=performance.now();return new Promise(resolve=>{
  let id;const step=now=>{rafs.delete(id);if(run!==generation){resolve(false);return;}
    const p=Math.min(1,(now-start)/duration);paintFoil(s.face,s.data.rarity,-.8+1.6*p,-.5+p);
    if(p<1){id=requestAnimationFrame(step);rafs.set(id,()=>resolve(false));}};
  // v3's 1370–1820 window shifts with the ruling's 140/360 beat: face+0–450.
  const endTimer=later(()=>{cancelAnimationFrame(id);rafs.delete(id);paintFoil(s.face,s.data.rarity,0,0);resolve(true);},duration,run);
  timers.set(endTimer,()=>resolve(false));
  id=requestAnimationFrame(step);rafs.set(id,()=>resolve(false));});}
function cancelWork(){
  for(const [id,cancel] of timers){clearTimeout(id);cancel();}timers.clear();
  for(const [id,cancel] of rafs){cancelAnimationFrame(id);cancel();}rafs.clear();
  for(const a of anims)a.cancel();anims.clear();stopAudio();
  win.getAnimations({subtree:true}).forEach(a=>a.cancel());
  for(const e of win.querySelectorAll('.shock,.spark,.reveal-rays,.reveal-column,.reveal-impact'))e.remove();
  root?.remove();root=null;
}
function clearRun(){generation++;cancelWork();
  for(const f of fan.querySelectorAll('.hcard'))HoloCardFace.unobserve(f);
  fan.replaceChildren();slots=[];busy=false;skipped=false;cascading=false;pending=0;collectMarked=false;
  win.classList.remove('is-ceremony');btn.fin.hidden=true;btn.all.hidden=true;idlepack.style.opacity='';
  for(const [b,n] of [[btn.p1,1],[btn.p5,5],[btn.p10,10]])b.disabled=tickets<n;
}
function layout(n){const r=stage.getBoundingClientRect();
  const cw=n<=1?Math.min(230,r.height*.52):n<=5?Math.min(150,r.width/6.6):Math.min(118,r.width/6.6,r.height/3.6);
  const rows=n<=5?[n]:[5,n-5],out=[];rows.forEach((count,ri)=>{const gap=cw*.16,total=count*cw+(count-1)*gap,y=rows.length===1?0:(ri===0?-cw*.78:cw*.78);
    for(let i=0;i<count;i++)out.push({x:-total/2+i*(cw+gap)+cw/2,y,cw});});return out;}
function position(s){s.el.style.setProperty('--cw',s.spot.cw+'px');s.el.style.transform=`translate(${s.spot.x}px,${s.spot.y}px)`;}
function relayout(){const spots=layout(slots.length);slots.forEach((s,i)=>{s.spot=spots[i];position(s);if(s.face)HoloCardFace.refit(s.face);});}
function effect(scope,anchor,cls,color,duration,frames){if(scope!==generation)return;
  const e=node('div',cls);e.style.setProperty('--light',color);anchor.append(e);
  A(e,frames||[{opacity:0,scale:.5},{opacity:.65,scale:1,offset:.15},{opacity:0,scale:1.5}],{duration,easing:'ease-out'}).finished.catch(()=>{}).finally(()=>e.remove());return e;}
function shock(scope,anchor,color,duration=450){return effect(scope,anchor,'reveal-impact',color,duration);}
function rayBurst(scope,anchor,color,duration=600){return effect(scope,anchor,'reveal-rays',color,duration,[{opacity:0,rotate:'-12deg',scale:.7},{opacity:.65,offset:.12},{opacity:0,rotate:'12deg',scale:1.2}]);}
function burst(scope,anchor,color,count=12){for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,dist=60+(i%4)*18;
  const e=effect(scope,anchor,'spark',color,550,[{opacity:1,transform:'translate(-50%,-50%)'},{opacity:0,transform:`translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px)`}]);e?.style.setProperty('--sp',color);}}
function createSlots(result,run){const spots=layout(result.length);slots=result.map((data,i)=>{
  const el=node('div','slot'),anchor=node('div','reveal-anchor'),shell=node('div','reveal-shell'),back=node('div','veilback');
  shell.append(back);el.append(anchor,shell);el.dataset.i=i;el.style.opacity='0';fan.append(el);
  const s={el,anchor,shell,back,data,spot:spots[i],revealed:false,complete:false,run,rx:0,ry:0};position(s);return s;});}
function ensureFace(s){if(s.face)return s.face;s.face=makeFace(s.data);for(const img of s.face.querySelectorAll('img'))img.draggable=false;s.face.style.visibility='hidden';s.shell.append(s.face);return s.face;}
async function prepare(result,run){
  const names=['fx/summon-night.webp','fx/foil-pack.webp','fx/foil-tear.webp','fx/star-track.svg','fx/star-seal.svg'];
  for(const c of result)names.push(...(c.scene?[`layer-${c.id}-subject.png`,`layer-${c.id}-background.png`]:[c.file]));
  await Promise.all(names.map(n=>{const im=new Image();im.src=path(n);return im.decode();}));
  if(run!==generation)return false;
  for(const s of slots)ensureFace(s);
  await Promise.all([...fan.querySelectorAll('img')].map(im=>im.decode()));
  if(run!==generation)return false;for(const s of slots)s.loaded=true;return true;
}
async function prelude(run,n){
  root=node('div','ceremony-root');for(const [key,name] of [['night','summon-night.webp'],['pack','foil-pack.webp'],['tear','foil-tear.webp']])root.style.setProperty('--'+key,`url("${path('fx/'+name)}")`);
  const circle=node('img','summon-circle'),seal=node('img','summon-seal');circle.src=path('fx/star-track.svg');seal.src=path('fx/star-seal.svg');
  const pack=node('div','summon-pack'),body=node('div','summon-pack-body'),top=node('div','summon-pack-top'),tear=node('div','summon-tear'),trail=node('div','summon-trail');
  pack.append(body,top,tear);root.append(circle,trail,pack,seal);stage.prepend(root);
  mark('phase-start',null,{phase:'entry'});hint.textContent='星軌召喚';
  A(root,[{opacity:0},{opacity:1}],{duration:180});if(!await wait(180,run))return false;
  mark('phase-start',null,{phase:'circle'});sound('charge');
  A(circle,[{opacity:0,rotate:'-30deg'},{opacity:.75,rotate:'0deg'}],{duration:620});
  A(seal,[{opacity:0},{opacity:.8}],{duration:620});if(!await wait(620,run))return false;
  mark('phase-start',null,{phase:'delivery'});
  A(trail,[{opacity:0,transform:'translate(-75vw,-55vh) rotate(38deg)'},{opacity:1,offset:.5},{opacity:0,transform:'translate(-100%,0) rotate(38deg)'}],{duration:700});
  A(pack,[{opacity:0,scale:.75},{opacity:1,scale:1}],{duration:700});if(!await wait(700,run))return false;
  mark('phase-start',null,{phase:'tear'});sound('tear');
  A(top,[{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(120px,-75px) rotate(28deg)',opacity:0}],{duration:380});
  A(tear,[{opacity:0},{opacity:1,offset:.2},{opacity:0}],{duration:380});if(!await wait(380,run))return false;
  mark('phase-start',null,{phase:'deal'});
  for(const [i,s] of slots.entries())A(s.el,[{opacity:0,transform:'translate(0,-70px) scale(.3)'},{opacity:1,transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`}],{duration:360,delay:40*i,easing:'cubic-bezier(.2,.8,.2,1)'});
  A(pack,[{opacity:1},{opacity:0}],{duration:300});
  if(!await wait(360+40*(n-1),run))return false;
  for(const s of slots){s.el.style.opacity='1';s.el.getAnimations().forEach(a=>a.cancel());position(s);}
  root.replaceChildren();mark('phase-start',null,{phase:'cards',prelude:2240+40*(n-1)});return true;
}
async function pull(n){if(busy||slots.length||tickets<n)return;const run=++generation;
  if(!muted){try{audio ||= new AudioContext();audio.resume().catch(()=>{});}catch{muted=true;audioLabel();}}
  busy=true;skipped=false;cascading=false;collectMarked=false;tickets-=n;$('#ticket').textContent=tickets;
  for(const b of [btn.p1,btn.p5,btn.p10])b.disabled=true;
  win.classList.add('is-ceremony');idlepack.style.opacity='0';btn.all.hidden=false;hint.textContent='準備卡片…';
  const result=testing&&window.__ceremonyFixture?window.__ceremonyFixture.slice(0,n):draw(n);createSlots(result,run);
  ready=prepare(result,run).catch(error=>{if(run===generation){hint.textContent='素材載入失敗，請重設後再試。';mark('asset-error',null,{message:String(error)});}return false;});
  if(!await ready||run!==generation)return;
  if(reduced.matches){skipAll();return;}
  if(!await prelude(run,n)||run!==generation)return;
  busy=false;cascade();
}
async function cascade(){const run=generation;cascading=true;
  // Serial scheduling is deliberately rarity-independent before first sight.
  // This stricter form of the high-tier mutex also avoids leaking the next rank by its start time.
  try{for(const s of slots){if(skipped||run!==generation)break;await revealOne(s);}}
  finally{if(run===generation){cascading=false;finishReveal();}}
}
function revealOne(s,fast=false){if(s.work)return s.work;if(s.run!==generation)return Promise.resolve();
  s.work=performReveal(s,fast);return s.work;}
async function performReveal(s,fast){const run=s.run;s.revealed=true;s.el.classList.add('is-revealing');
  const r=s.data.rarity;mark('phase-start',s,{phase:'charge'});
  if(!fast){shock(run,s.anchor,'#e5efff',140);if(!await wait(140,run))return;}
  const flip=A(s.shell,[{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],{duration:180,easing:'ease-in'});
  await flip.finished.catch(()=>{});if(run!==generation)return;flip.cancel();
  s.back.hidden=true;s.face.style.visibility='visible';s.el.style.setProperty('--result-color',SURGE[r]);
  mark('face-visible',s);mark('burst',s);sound('impact',s);sound('chord',s);
  const high=['epic','legendary','mythic'].includes(r);
  let focus;
  if(high)focus=A(s.el,[{transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`},{transform:'translate(0px,0px) scale(1.35)'}],{duration:180,easing:'ease-out'});
  const fx=r==='common'?220:r==='rare'?350:r==='epic'?500:600;
  shock(run,s.anchor,SURGE[r],fx);
  if(r==='rare'||r==='epic')effect(run,s.anchor,'reveal-column',SURGE[r],fx);
  if(r==='legendary'||r==='mythic'){rayBurst(run,s.anchor,SURGE[r],fx);burst(run,s.anchor,SURGE[r],r==='mythic'?24:16);}
  if(r==='mythic'){rayBurst(run,s.anchor,'#6fd8ff',fx);shock(run,s.anchor,'#fff2aa',fx);}
  const sweepWork=sweep(s);
  const open=A(s.shell,[{transform:'rotateY(-90deg)'},{transform:'rotateY(0deg)'}],{duration:180,easing:'ease-out'});
  await open.finished.catch(()=>{});if(run!==generation)return;open.cancel();
  const read={common:120,rare:180,epic:380,legendary:280,mythic:620}[r],back={common:0,rare:0,epic:260,legendary:360,mythic:400}[r];
  mark('phase-start',s,{phase:'read'});if(!await wait(read,run))return;
  mark('phase-start',s,{phase:'return'});
  if(back){focus?.cancel();const returning=A(s.el,[{transform:'translate(0px,0px) scale(1.35)'},{transform:`translate(${s.spot.x}px,${s.spot.y}px) scale(1)`}],{duration:back,easing:'ease-in-out'});
    await returning.finished.catch(()=>{});if(run!==generation)return;returning.cancel();position(s);}
  await sweepWork;if(run!==generation)return;
  await Promise.all(s.anchor.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));if(run!==generation)return;
  completeSlot(s);updateFinish();
}
function completeSlot(s){s.revealed=true;s.complete=true;s.rx=s.ry=0;s.el.classList.remove('is-revealing','selected');s.el.classList.add('done');
  s.el.style.opacity='1';s.shell.style.transform='';s.back.hidden=true;ensureFace(s).style.visibility='visible';
  s.el.style.setProperty('--result-color',SURGE[s.data.rarity]);position(s);paintFoil(s.face,s.data.rarity,0,0);HoloCardFace.refit(s.face);
  if(!s.bound){s.bound=true;s.shell.append(node('div','result-mark',({common:'·',rare:'◇',epic:'⬡',legendary:'✦',mythic:'✧'}[s.data.rarity])+' '+LABEL[s.data.rarity]));bindInteraction(s);}
  mark('slot-complete',s);
}
async function skipAll(){if(!slots.length||skipped)return;skipped=true;const prepared=ready,old=generation;
  // Invalidate callbacks before cancelling them; keep the already drawn identities.
  generation++;const run=generation;cancelWork();cascading=false;busy=true;pending=0;
  slots.forEach(s=>{s.run=run;s.work=null;});
  // prepare may finish under the old ID; independently decode the reused faces here.
  if(!slots.every(s=>s.loaded)){
    await prepared;if(run!==generation)return;
    try{for(const s of slots)ensureFace(s);await Promise.all([...fan.querySelectorAll('img')].map(im=>im.decode()));for(const s of slots)s.loaded=true;}
    catch{if(run===generation)hint.textContent='素材載入失敗，請重設後再試。';return;}
  }
  if(run!==generation)return;
  mark('phase-start',null,{phase:reduced.matches?'reduced':'skip',fromRun:old});
  for(const s of slots){s.shell.getAnimations().forEach(a=>a.cancel());s.el.classList.remove('is-revealing');s.back.hidden=true;s.face.style.visibility='visible';s.el.style.opacity='1';position(s);}
  const fade=A(fan,[{opacity:0},{opacity:1}],{duration:180});await fade.finished.catch(()=>{});if(run!==generation)return;fade.cancel();
  for(const s of slots)completeSlot(s);busy=false;finishReveal();
}
function bindInteraction(s){let drag=null;const face=s.face,el=s.shell;
  const paint=(x,y)=>{paintFoil(face,s.data.rarity,x,y);face.style.setProperty('--rx',s.rx+'deg');face.style.setProperty('--ry',s.ry+'deg');};
  const reset=()=>{s.rx=s.ry=0;paint(0,0);};s.resetPose=reset;
  el.addEventListener('pointerdown',e=>{if(!s.complete||e.button>0)return;e.preventDefault();getSelection()?.removeAllRanges();drag={x:e.clientX,y:e.clientY,rx:s.rx,ry:s.ry};el.setPointerCapture(e.pointerId);});
  el.addEventListener('pointermove',e=>{if(!s.complete)return;const b=el.getBoundingClientRect();
    if(drag){s.rx=Math.max(-18,Math.min(18,drag.rx-(e.clientY-drag.y)*.2));s.ry=Math.max(-18,Math.min(18,drag.ry+(e.clientX-drag.x)*.2));}
    paint((e.clientX-b.left)/b.width*2-1,(e.clientY-b.top)/b.height*2-1);});
  el.addEventListener('pointerup',e=>{if(drag&&e.pointerType==='touch'&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)s.el.classList.toggle('selected');drag=null;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);});
  el.addEventListener('pointercancel',()=>{drag=null;paint(0,0);});el.addEventListener('pointerleave',()=>{if(!drag)paint(0,0);});
  el.addEventListener('dblclick',reset);
}
function finishReveal(){updateFinish();}
function updateFinish(){const complete=slots.length&&slots.every(s=>s.complete)&&!cascading&&!busy&&!anims.size&&!timers.size&&!rafs.size&&!voices.size;
  btn.all.hidden=!slots.length||!!complete||skipped;btn.fin.hidden=!complete;
  if(complete){hint.textContent='拖曳轉動 · 雙擊或 Esc 回正';if(!collectMarked){collectMarked=true;root?.remove();root=null;win.classList.remove('is-ceremony');relayout();mark('collectable');}}
}
btn.all.textContent='跳過演出';btn.all.addEventListener('click',skipAll);
stage.addEventListener('click',e=>{if(!e.target.closest('button,a,.slot.done')&&slots.length&&!btn.all.hidden)skipAll();});
btn.fin.addEventListener('click',()=>{if(btn.fin.hidden)return;clearRun();hint.textContent='從軌道上取下你的卡。';});
btn.p1.addEventListener('click',()=>pull(1));btn.p5.addEventListener('click',()=>pull(5));btn.p10.addEventListener('click',()=>pull(10));
$('#reset').addEventListener('click',()=>{tickets=30;$('#ticket').textContent=tickets;clearRun();});
$('#ratebtn').addEventListener('click',()=>{hint.textContent='試抽機率：神話 0.5%／傳說 4%／史詩 15%／精良 40%／普通 40.5%；無保底。';});
$('#bookbtn').addEventListener('click',()=>{hint.textContent='典藏冊尚未開放。';});
addEventListener('keydown',e=>{if(e.key==='Escape')for(const s of slots)if(s.complete)s.resetPose?.();});
addEventListener('resize',()=>{if(slots.length)relayout();});
if(testing)window.__ceremony={events,pull,skipAll,reset:clearRun,state:()=>({generation,busy,cascading,skipped,anims:anims.size,timers:timers.size,rafs:rafs.size,voices:voices.size,complete:slots.filter(s=>s.complete).length,ids:slots.map(s=>s.data.id),collectable:!btn.fin.hidden}),pause:()=>win.getAnimations({subtree:true}).forEach(a=>a.pause())};
