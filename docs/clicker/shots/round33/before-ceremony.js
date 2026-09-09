/* Round 29: generation / revealed / complete remain the A5 ownership contract. */
const stage=$('#stage'),fan=$('#fan'),win=$('#win'),idlepack=$('#entry-pack'),hint=$('#hint');
const btn={p1:$('#p1'),p5:$('#p5'),p10:$('#p10'),all:$('#revealall'),fin:$('#finish')};
let busy=false,slots=[],pending=0,tickets=30,cascading=false,skipped=false,generation=0;
const anims=new Set(),timers=new Map(),rafs=new Map(),voices=new Set();
const fxPainters=new Set();
const testing=new URLSearchParams(location.search).has('ceremony-test');
const events=[];
let screen='entry',pageIndex=0,selectedIndex=0,collecting=false;
let root=null,ready=Promise.resolve(),audio=null,muted=true,collectMarked=false;
try{muted=localStorage.getItem('holo-muted')!=='false';}catch{}
const audioButton=node('button','','音效：關');audioButton.id='sound';
$('.stageacts').prepend(audioButton);
function audioLabel(){audioButton.textContent=muted?'音效：關':'音效：開';audioButton.setAttribute('aria-pressed',String(!muted));}
audioLabel();
audioButton.addEventListener('click',async()=>{muted=!muted;try{localStorage.setItem('holo-muted',String(muted));}catch{}
  if(!muted){try{audio=window.CeremonyAudio.ensure();await audio.resume();}catch{muted=true;}}
  else{stopAudio();stopCollectionAudio();}audioLabel();});
function mark(type,s,extra={}){if(testing)events.push({type,time:Date.now(),run:generation,index:s?slots.indexOf(s):null,...extra});}
let audioScope=null, currentCue=null,collectionAudio=null;
const collectionVoices=new Set();
CeremonyAudio.onSchedule=({type:primitive,...cue})=>mark('audio-scheduled',currentCue?.slot,{cue:currentCue?.name,primitive,...cue});
CeremonyAudio.onSource=o=>{const run=generation,group=currentCue?.name==='collect'?collectionVoices:voices;group.add(o);o.addEventListener('ended',()=>{group.delete(o);if(group===collectionVoices){if(!group.size){collectionAudio?.stop(0);collectionAudio=null;}return;}if(run===generation)updateFinish();},{once:true});};
function sound(kind,s,arg){
  const record={kind,muted,state:audio?.state||'uninitialized',audioTime:audio?.currentTime??null};
  mark('audio',s,record);if(muted||audio?.state!=='running')return;
  const scope=kind==='collect'?(collectionAudio ||= CeremonyAudio.createScope()):(audioScope ||= CeremonyAudio.createScope());currentCue={name:kind==='reveal'?'reveal:'+s.data.rarity:kind,slot:s};
  try{scope[kind](kind==='reveal'?s.data.rarity:arg);}finally{currentCue=null;}
}
function stopCollectionAudio(){collectionAudio?.stop(0);collectionAudio=null;collectionVoices.clear();}
function stopAudio(){audioScope?.stop(0);audioScope=null;for(const o of voices){try{o.stop();o.disconnect();}catch{}}voices.clear();}
const A=(el,frames,opts)=>{const run=generation,a=el.animate(frames,{fill:'both',...opts});anims.add(a);
  a.finished.catch(()=>{}).finally(()=>{anims.delete(a);if(run===generation)updateFinish();});if(document.hidden){a.pause();a.__visibilityPaused=true;}return a;};
// Logical timer IDs survive visibility suspension; cancellation resolves pending waits.
let timerSerial=0;const timerDetails=new Map(),pausedRafs=new Map();let hiddenAt=0,pausedTotal=0;
const activeNow=()=>performance.now()-pausedTotal-(hiddenAt?performance.now()-hiddenAt:0);
function schedule(fn,ms,run,cancel=()=>{}){const key=++timerSerial,job={fn,remaining:ms,due:performance.now()+ms,id:null,run};
 timers.set(key,cancel);timerDetails.set(key,job);armTimer(key,job);return key;}
function armTimer(key,job){if(document.hidden)return;job.due=performance.now()+job.remaining;job.id=setTimeout(()=>{timers.delete(key);timerDetails.delete(key);if(job.run===generation){job.fn();updateFinish();}},job.remaining);}
const wait=(ms,run=generation)=>new Promise(resolve=>schedule(()=>resolve(run===generation),ms,run,()=>resolve(false)));
function later(fn,ms,run=generation){return schedule(fn,ms,run);}
function pauseTimers(){for(const job of timerDetails.values()){clearTimeout(job.id);job.remaining=Math.max(0,job.due-performance.now());}}
function resumeTimers(){for(const [key,job] of timerDetails)armTimer(key,job);}
function pauseRafs(){hiddenAt=performance.now();for(const [id,cancel] of rafs){cancelAnimationFrame(id);pausedRafs.set(id,cancel);}}
function resumeRafs(){if(hiddenAt){pausedTotal+=performance.now()-hiddenAt;hiddenAt=0;}for(const [id,cancel] of pausedRafs){rafs.delete(id);cancel.resume?.();}pausedRafs.clear();}
function sweep(s,duration=450,reverse=false,strength=1,dual=false){const run=generation,start=activeNow();return new Promise(resolve=>{
  let id;const cancel=()=>resolve(false);cancel.resume=()=>{id=requestAnimationFrame(step);rafs.set(id,cancel);};const step=now=>{rafs.delete(id);if(run!==generation){resolve(false);return;}
    const elapsed=activeNow()-start,p=Math.min(1,elapsed/duration);
    if(dual){const first=Math.min(1,elapsed/560),second=Math.max(0,Math.min(1,(elapsed-480)/440));
      const a=elapsed<560?1:0,b=elapsed>=480?.35:0;
      paintFoil(s.face,s.data.rarity,(-.8+1.6*first)*a+(.8-1.6*second)*b,(-.5+first)*a+(.5-second)*b);
    }else paintFoil(s.face,s.data.rarity,(-.8+1.6*(reverse?1-p:p))*strength,(-.5+(reverse?1-p:p))*strength);
    if(p<1){id=requestAnimationFrame(step);rafs.set(id,cancel);}};
  // Finite material sweep shares the visibility-aware active clock.
  const endTimer=later(()=>{cancelAnimationFrame(id);rafs.delete(id);paintFoil(s.face,s.data.rarity,0,0);resolve(true);},duration,run);
  timers.set(endTimer,()=>resolve(false));
  id=requestAnimationFrame(step);rafs.set(id,cancel);});}
function cancelWork(){
  for(const [id,cancel] of timers){clearTimeout(timerDetails.get(id)?.id);cancel();}timers.clear();timerDetails.clear();pausedRafs.clear();
  for(const [id,cancel] of rafs){cancelAnimationFrame(id);cancel();}rafs.clear();
  for(const a of anims)a.cancel();anims.clear();stopAudio();
  fan.getAnimations({subtree:true}).forEach(a=>a.cancel());
  $('.entry-actions').getAnimations({subtree:true}).forEach(a=>a.cancel());
  $('.entry-actions').classList.remove('press-feedback');win.querySelectorAll('.control-sheen').forEach(e=>e.remove());
  $('.stage-background').getAnimations().forEach(a=>a.cancel());
  for(const e of win.querySelectorAll('.rarity-fx'))e.remove();
  root?.remove();root=null;
}
function clearRun(){generation++;cancelWork();
  for(const f of fan.querySelectorAll('.hcard'))HoloCardFace.unobserve(f);
  $('.entry-actions').classList.remove('press-feedback');win.querySelectorAll('.control-sheen').forEach(e=>e.remove());
  fan.replaceChildren();slots=[];busy=false;skipped=false;cascading=false;pending=0;collectMarked=false;
  setScreen('entry');pageIndex=0;selectedIndex=0;collecting=false;btn.fin.hidden=true;btn.all.hidden=true;idlepack.style.opacity='';
  for(const [b,n] of [[btn.p1,1],[btn.p5,5],[btn.p10,10]])b.disabled=tickets<n;
}
function setScreen(next){
  if(!['entry','ceremony','results'].includes(next))throw new Error('Invalid screen');
  screen=next;win.dataset.screen=next;win.classList.toggle('is-ceremony',next!=='entry');
  win.classList.toggle('focus-held',next==='ceremony');
  mark('screen',null,{screen:next});updatePages();
}
const mobile=()=>innerWidth<=600;
const unit=()=>Math.min(innerWidth/1440,innerHeight/900);
const focusWidth=()=>layout(Math.max(1,slots.length))[0].cw;
// Original tabletop columns / two rows, with clearance for hover and ±18° drag.
function layout(n){return CeremonyTable.layout(n,{index:selectedIndex});}
const slotTransform=s=>`translate(${s.spot.x}px,${s.spot.y}px) rotate(${s.spot.rz}deg)`;
function position(s){s.el.classList.toggle('mobile-current',mobile()&&slots.indexOf(s)===selectedIndex);s.el.style.setProperty('--cw',s.spot.cw+'px');s.el.style.transform=slotTransform(s);
 s.el.classList.toggle('page-away',mobile()?slots.indexOf(s)!==selectedIndex:false);}
function relayout(){
 const active=slots.findIndex(s=>s.el.classList.contains('is-revealing'));if(mobile()&&active>=0)selectedIndex=active;
 const spots=layout(slots.length);slots.forEach((s,i)=>{s.spot=spots[i];position(s);
  if(s.el.classList.contains('is-revealing')){const rest=slotTransform(s),lift=rest+' translateY(-6px)';
   for(const a of s.el.getAnimations())a.effect.setKeyframes(s.returning?[{transform:lift},{transform:rest}]:[{transform:rest},{transform:lift}]);}
  if(s.face)HoloCardFace.refit(s.face);});updatePages();
}
function updatePages(){const pages=$('.pages');pages.hidden=screen!=='results'||slots.length<2||!mobile();
 $('#page-count').textContent=mobile()?`${selectedIndex+1} / ${slots.length}`:`${pageIndex*5+1}–${Math.min(pageIndex*5+5,slots.length)} / ${slots.length}`;
 $('#prev').disabled=mobile()?selectedIndex===0:pageIndex===0;$('#next').disabled=mobile()?selectedIndex>=slots.length-1:pageIndex>=Math.ceil(slots.length/5)-1;
}
function browse(delta){if(screen!=='results')return;if(mobile()){selectedIndex=Math.max(0,Math.min(slots.length-1,selectedIndex+delta));pageIndex=Math.floor(selectedIndex/5);}else{pageIndex=Math.max(0,Math.min(Math.ceil(slots.length/5)-1,pageIndex+delta));selectedIndex=pageIndex*5+2;}
 relayout();mark('page',null,{page:pageIndex,index:selectedIndex});}
$('#prev').addEventListener('click',()=>browse(-1));$('#next').addEventListener('click',()=>browse(1));
function createSlots(result,run){const spots=layout(result.length);slots=result.map((data,i)=>{
  const el=node('div','slot'),anchor=node('div','reveal-anchor'),shell=node('div','reveal-shell'),back=node('div','veilback');
  const flip=node('div','reveal-flip');flip.append(back);shell.append(flip);el.append(anchor,shell);el.dataset.i=i;el.style.opacity='0';fan.append(el);
  const s={el,anchor,shell,flip,back,data,spot:spots[i],revealed:false,complete:false,run,rx:0,ry:0};position(s);return s;});}
function ensureFace(s){if(s.face)return s.face;s.face=makeFace(s.data);for(const img of s.face.querySelectorAll('img'))img.draggable=false;s.face.style.visibility='hidden';s.flip.append(s.face);return s.face;}
async function prepare(result,run){
  const names=['fx/foil-pack.webp','fx/foil-tear.webp'];
  for(const c of result)names.push(...(c.scene?[`layer-${c.id}-subject.png`,`layer-${c.id}-background.png`]:[c.file]));
  await Promise.all(names.map(n=>{const im=new Image();im.src=path(n);return im.decode();}));
  if(run!==generation)return false;
  for(const s of slots)ensureFace(s);
  await Promise.all([...fan.querySelectorAll('img')].map(im=>im.decode()));
  if(run!==generation)return false;for(const s of slots)s.loaded=true;return true;
}
async function prelude(run,n){
 root=node('div','ceremony-root');const pack=node('div','summon-pack'),body=node('div','summon-pack-body'),top=node('div','summon-pack-top'),tear=node('div','summon-tear');
 pack.append(body,top,tear);root.append(pack);stage.prepend(root);idlepack.style.opacity='0';
 mark('phase-start',null,{phase:'entry'});hint.textContent='點空白處跳過';
 A(pack,[{transform:`translateY(${innerHeight<=700&&!mobile()?-28:-40}px) rotate(-4deg)`},{transform:'translateY(0) rotate(0deg)'}],{duration:240});
 if(!await wait(240,run))return false;
 mark('phase-start',null,{phase:'tension'});A(pack,[{transform:'translateY(0) scale(1)'},{transform:'translateY(5px) scale(.985)'}],{duration:200});
 if(!await wait(200,run))return false;
 mark('phase-start',null,{phase:'tear'});sound('tear');
 A(top,[{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(120px,-75px) rotate(28deg)',opacity:0}],{duration:340});
 A(tear,[{opacity:0},{opacity:1,offset:.2},{opacity:0}],{duration:340});
 if(!await wait(240,run))return false;
 mark('phase-start',null,{phase:'deal'});
 const stagger=CeremonyTable.stagger(n);sound('burst');
 // Shared seal origin and the original 620ms overshooting deal easing.
 for(const [i,s] of slots.entries()){
  later(()=>sound('deal',s,i),i*stagger,run);
  A(s.el,[{opacity:0,transform:'translate(0,-145px) rotate(0deg) scale(.2)'},{opacity:1,transform:slotTransform(s)}],{duration:CeremonyTable.dealDuration,delay:stagger*i,easing:'cubic-bezier(.22,.9,.32,1.12)'});
 }
 A(pack,[{opacity:1},{opacity:0}],{duration:480});
 if(!await wait(620+stagger*(n-1),run))return false;
 for(const s of slots){s.el.style.opacity='1';s.el.getAnimations().forEach(a=>a.cancel());position(s);}
 root.remove();root=null;mark('phase-start',null,{phase:'cards',prelude:1300+stagger*(n-1)});return true;
}
async function pull(n){if(busy||slots.length||tickets<n)return;const run=++generation;
  stopCollectionAudio();
  if(!muted){try{audio=window.CeremonyAudio.ensure();audio.resume().catch(()=>{});}catch{muted=true;audioLabel();}}
  busy=true;skipped=false;cascading=false;collectMarked=false;tickets-=n;$('#ticket').textContent=tickets;
  for(const b of [btn.p1,btn.p5,btn.p10])b.disabled=true;
  setScreen('ceremony');idlepack.style.opacity='1';
  if(!reduced.matches){const controls=$('.entry-actions'),pressed=btn['p'+n],sheen=node('span','control-sheen');controls.classList.add('press-feedback');pressed.append(sheen);
    A(pressed,[{transform:'translateY(0)'},{transform:'translateY(2px)'}],{duration:80});A(sheen,[{transform:'translateX(-120%)'},{transform:'translateX(120%)'}],{duration:160});
    const exiting=A(controls,[{opacity:1},{opacity:0}],{duration:240});later(()=>{controls.classList.remove('press-feedback');sheen.remove();exiting.cancel();pressed.getAnimations().forEach(a=>a.cancel());},240,run);
  }
  btn.all.hidden=false;hint.textContent='準備卡片…';
  const result=testing&&window.__ceremonyFixture?window.__ceremonyFixture.slice(0,n):draw(n);createSlots(result,run);
  ready=prepare(result,run).catch(error=>{if(run===generation){hint.textContent='素材載入失敗，請重新載入再試。';mark('asset-error',null,{message:String(error)});}return false;});
  if(!await ready||run!==generation)return;
  if(reduced.matches){skipAll();return;}
  if(!await prelude(run,n)||run!==generation)return;
  busy=false;cascade();
}
async function cascade(){const run=generation;cascading=true;
  // Serial scheduling is deliberately rarity-independent before first sight.
  // This stricter form of the high-tier mutex also avoids leaking the next rank by its start time.
  try{for(const [i,s] of slots.entries()){if(skipped||run!==generation)break;
    if(mobile()){selectedIndex=i;pageIndex=Math.floor(i/5);relayout();}
    await revealOne(s);
  }}
  finally{if(run===generation){cascading=false;finishReveal();}}
}
function revealOne(s,fast=false){if(s.work)return s.work;if(s.run!==generation)return Promise.resolve();
  s.work=performReveal(s,fast);return s.work;}
// Round 31 user decision: only common/rare/epic remain neutral before first sight.
async function chargeHigh(s){
 const mythic=s.data.rarity==='mythic',duration=mythic?1300:900,contraction=mythic?160:120;
 if(!mythic&&s.data.rarity!=='legendary')return true;
 const glow=node('div','rarity-fx charge-glow');s.el.prepend(glow);
 glow.style.setProperty('--charge-color',mythic?'218,241,255':'255,194,104');
 const frames=[],steps=Math.ceil(duration/10);
 for(let i=0;i<=steps;i++){
  const t=i/steps*duration,p=t/duration,release=Math.max(0,(t-duration+contraction)/contraction);
  const envelope=p*(1-.85*release)*(mythic&&t>duration-200?1.15:1);
  const wave=Math.sin(t/1000*Math.PI*2*21),amp=(mythic?4:2.5)*Math.min(1,envelope);
  frames.push({offset:p,transform:`translate(${wave*amp}px,${Math.cos(t/1000*Math.PI*2*19)*amp*.35}px) rotate(${wave*(mythic?1.2:.8)*Math.min(1,envelope)}deg)`});
 }
 const shake=A(s.shell,frames,{duration,easing:'linear'});
 const light=A(glow,[{opacity:0},{opacity:mythic?.7:.6,offset:1-contraction/duration},{opacity:mythic?.3:.25}],{duration,easing:'ease-in'});
 sound('charge',s,duration/1000);
 const ok=await wait(duration,s.run);shake.cancel();light.cancel();glow.remove();return ok;
}
async function beginReveal(s){const run=s.run;s.revealed=true;s.el.classList.add('is-revealing');mark('phase-start',s,{phase:'charge'});
 const start=slotTransform(s);s.el.style.setProperty('--cw',focusWidth()+'px');HoloCardFace.refit(s.face);
 s.focus=A(s.el,[{transform:start},{transform:start+' translateY(-6px)'}],{duration:500,easing:'cubic-bezier(.2,.7,.2,1)'});
 if(!await chargeHigh(s))return false;
 if(!await wait(140,run))return false;
 sound('flip',s);
 const flip=A(s.flip,[{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],{duration:180,easing:'ease-in'});
 if(!await wait(180,run))return false;flip.cancel();return true;
}
function commitFaceVisible(s){s.back.hidden=true;s.flip.style.transform='rotateY(-89deg)';s.face.style.visibility='visible';
 s.el.style.setProperty('--result-color',SURGE[s.data.rarity]);mark('face-visible',s);mark('burst',s);
 A(s.flip,[{transform:'rotateY(-89deg)'},{transform:'rotateY(0deg)'}],{duration:180,easing:'ease-out'});
 later(()=>{s.flip.style.transform='';A(s.shell,[{scale:1.02,transform:'translateY(-4px)'},{scale:1,transform:'translateY(0)'}],{duration:80});},180,s.run);
}
function fx(s,name,delay,duration,options={}){const run=s.run;
 const launch=()=>{if(run!==generation)return;mark('fx-start',s,{effect:name,duration});
 const e=node('div','rarity-fx '+name);e.style.setProperty('--light',options.color||SURGE[s.data.rarity]);s.anchor.append(e);
 const cw=focusWidth();e.style.width=(options.width||cw)+'px';
 if(options.band)e.style.setProperty('--band',options.band+'px');
 if(options.height)e.style.height=options.height+'px';
 const frames=options.frames||[{opacity:0,scale:options.from??.9,'--band':(options.band||24)+'px',borderWidth:(options.line||4)+'px'},{opacity:options.peak??.65,offset:Math.min(24/duration,.2)},{opacity:0,scale:options.to??1.8,'--band':'6px',borderWidth:'1px'}];
 const a=A(e,frames,{duration,easing:'cubic-bezier(.215,.61,.355,1)'});
 later(()=>{a.cancel();e.remove();mark('fx-end',s,{effect:name});},duration,run);
 };if(delay)later(launch,delay,run);else launch();
}
function flakes(s,count,delay,duration,name='fx-flake'){
 for(let i=0;i<count;i++){const angle=(i*137.508+32)*Math.PI/180,corner=i%4;const x=(corner%2?1:-1)*focusWidth()*.52,y=(corner<2?-1:1)*focusWidth()*.72;
 const dist=24+(i%5)*10;fx(s,name,delay,duration,{width:3+i%4,height:12+(i%4)*6,frames:[{opacity:0,transform:`translate(${x}px,${y}px) rotate(${i*31}deg)`},{opacity:.72,offset:24/duration},{opacity:0,transform:`translate(${x+Math.cos(angle)*dist}px,${y+Math.sin(angle)*dist}px) rotate(${i*31+54}deg)`}]});}
}
const READ={common:300,rare:420,epic:640,legendary:1400,mythic:1900};
const RETURN={common:220,rare:240,epic:280,legendary:320,mythic:360};
function runRarityFx(s){const r=s.data.rarity,u=unit();
 const sweepDuration={common:220,rare:300,epic:420,legendary:520,mythic:560}[r];
 mark('fx-start',s,{effect:'foil-sweep',duration:sweepDuration});if(r==='mythic'){sweep(s,920,false,1,true);later(()=>mark('fx-end',s,{effect:'foil-sweep'}),560,s.run);}else sweep(s,sweepDuration).then(ok=>{if(ok)mark('fx-end',s,{effect:'foil-sweep'});});
 sound('reveal',s);runCanvasFx(s);
 if(r==='legendary'){
  fx(s,'fx-substrate-wave',40,900,{width:mobile()?560:1100*u,from:.3,to:1,band:32,peak:.65});
  later(()=>stageImpact(s,3,160),80,s.run);
 }
 if(r==='mythic'){
  // Original runtime's white flash, moved to F to preserve the neutral pre-F contract.
  const flash=node('div','rarity-fx ceremony-flash');stage.append(flash);
  const a=A(flash,[{opacity:1},{opacity:0}],{duration:156});later(()=>{a.cancel();flash.remove();},156,s.run);
  fx(s,'fx-spectrum-wave',60,1100,{width:mobile()?680:1320*u,from:.28,to:1,band:32,peak:.7});
  fx(s,'fx-counter-wave',180,1200,{width:mobile()?505:980*u,from:360/980,to:1,band:24,peak:.45});
  fx(s,'mythic-ripple',0,1040,{width:focusWidth()+30,frames:[{opacity:1,scale:.9},{opacity:0,scale:1.8}]});
  // Single material writer: second pass blends in from +480, never races the first sweep.
  later(()=>{mark('fx-start',s,{effect:'foil-afterglow',duration:440});},480,s.run);
  later(()=>mark('fx-end',s,{effect:'foil-afterglow'}),920,s.run);
  later(()=>stageImpact(s,4,200),60,s.run);
 }
}
function runCanvasFx(s){
 const run=s.run,upper=node('canvas','rarity-fx ceremony-canvas'),lower=node('canvas','rarity-fx ceremony-canvas under');
 for(const c of [lower,upper]){c.width=innerWidth;c.height=innerHeight;stage.append(c);}
 const engine=CeremonyFx(),box=s.shell.getBoundingClientRect();engine.init(upper,lower);
 engine.strengthen(box.x+box.width/2,box.y+box.height/2,s.data.rarity);
 mark('fx-start',s,{effect:'original-particles',particles:engine.particles});
 let id,ended=false,ticks=0;const start=activeNow();
 const cancel=()=>{if(ended)return;ended=true;fxPainters.delete(paint);cancelAnimationFrame(id);rafs.delete(id);engine.stop();upper.remove();lower.remove();mark('fx-end',s,{effect:'original-particles'});};
 const paint=(force=false)=>{if(ended||run!==generation)return;const targetTicks=Math.floor(((activeNow()-start)*60+1e-6)/1000);
  // The rectangular contract also covers transparent rounded corners and the
  // edge-on flip. Exclude those footprints without changing off-card photons.
  const faces=slots.filter(s=>s.face&&s.face.style.visibility==='visible').map(s=>s.face.getBoundingClientRect());
  for(const c of stage.querySelectorAll('.ceremony-canvas,.ceremony-flash')){
    const box=c.getBoundingClientRect();
    const holes=faces.map(r=>`M${r.left-box.left} ${r.top-box.top}H${r.right-box.left}V${r.bottom-box.top}H${r.left-box.left}Z`).join('');
    c.style.clipPath=`path(evenodd, "M0 0H${box.width}V${box.height}H0Z${holes}")`;
  }
  const target=s.shell.getBoundingClientRect();engine.move((target.x+target.width/2)*upper.width/innerWidth-box.x-box.width/2,(target.y+target.height/2)*upper.height/innerHeight-box.y-box.height/2);
  // Integrate elapsed active time, including delayed frames, without truncating tails.
  while(ticks<targetTicks&&engine.active){ticks++;engine.step(1/60,ticks===targetTicks);}
  if(force&&engine.active)engine.step(0);
 };
 fxPainters.add(paint);
 const step=()=>{rafs.delete(id);if(run!==generation){cancel();return;}paint();
  if(engine.active){id=requestAnimationFrame(step);rafs.set(id,cancel);}else{cancel();updateFinish();}};
 cancel.resume=()=>{id=requestAnimationFrame(step);rafs.set(id,cancel);};
 id=requestAnimationFrame(step);rafs.set(id,cancel);
}
function stageImpact(s,px,duration){mark('fx-start',s,{effect:'stage-impact',duration});
 const impact=A($('.stage-background'),[{transform:'translateX(0)'},{transform:`translateX(${px}px)`,offset:.25},{transform:'translateX(-1px)',offset:.6},{transform:'translateX(0)'}],{duration});later(()=>{impact.cancel();mark('fx-end',s,{effect:'stage-impact'});},duration,s.run);
}
async function settleReveal(s){const run=s.run,r=s.data.rarity;
 if(!await wait(READ[r],run))return;mark('phase-start',s,{phase:'return'});
 s.focus?.cancel();const from=slotTransform(s)+' translateY(-6px)';
 const returning=A(s.el,[{transform:from},{transform:slotTransform(s)+` scale(${s.spot.cw/focusWidth()})`}],{duration:RETURN[r],easing:'cubic-bezier(.4,0,.2,1)'});
 s.returning=returning;
 if(!await wait(RETURN[r],run))return;returning.cancel();s.el.getAnimations().forEach(a=>a.cancel());s.flip.getAnimations().forEach(a=>a.cancel());s.shell.getAnimations().forEach(a=>a.cancel());
 completeSlot(s);updateFinish();
}
async function performReveal(s){if(!await beginReveal(s))return;commitFaceVisible(s);runRarityFx(s);await settleReveal(s);}
function completeSlot(s){if(s.complete)return;s.flip.style.transform='';s.revealed=true;s.complete=true;s.rx=s.ry=0;s.el.classList.remove('is-revealing','selected');s.el.classList.add('done');
  s.el.style.opacity='1';s.shell.style.transform='';s.back.hidden=true;ensureFace(s).style.visibility='visible';
  s.el.style.setProperty('--result-color',SURGE[s.data.rarity]);position(s);paintFoil(s.face,s.data.rarity,0,0);HoloCardFace.refit(s.face);
  if(!s.bound){s.bound=true;bindInteraction(s);}
  mark('slot-complete',s);
}
async function skipAll(){if(!slots.length||skipped)return;skipped=true;const prepared=ready,old=generation;
  // Invalidate callbacks before cancelling them; keep the already drawn identities.
  generation++;const run=generation;cancelWork();cascading=false;busy=true;pending=0;
  slots.forEach(s=>{s.run=run;s.work=null;s.rx=s.ry=0;s.resetPose?.();});pageIndex=0;selectedIndex=0;relayout();idlepack.style.opacity='0';
  // prepare may finish under the old ID; independently decode the reused faces here.
  if(!slots.every(s=>s.loaded)){
    await prepared;if(run!==generation)return;
    try{for(const s of slots)ensureFace(s);await Promise.all([...fan.querySelectorAll('img')].map(im=>im.decode()));for(const s of slots)s.loaded=true;}
    catch{if(run===generation)hint.textContent='素材載入失敗，請重新載入再試。';return;}
  }
  if(run!==generation)return;
  mark('phase-start',null,{phase:reduced.matches?'reduced':'skip',fromRun:old});
  for(const s of slots){s.shell.getAnimations({subtree:true}).forEach(a=>a.cancel());s.flip.style.transform='';s.el.classList.remove('is-revealing');s.back.hidden=true;s.face.style.visibility='visible';s.el.style.opacity='1';position(s);}
  const fade=A(fan,[{opacity:0},{opacity:1}],{duration:180});if(!await wait(180,run)||run!==generation)return;fade.cancel();
  for(const s of slots)completeSlot(s);busy=false;finishReveal();
}
function bindInteraction(s){let drag=null,rebound=null,lightX=0,lightY=0;const face=s.face,el=s.shell;
  const paint=(x,y)=>{lightX=x;lightY=y;paintFoil(face,s.data.rarity,x,y);face.style.setProperty('--rx',s.rx+'deg');face.style.setProperty('--ry',s.ry+'deg');};
  const stop=()=>{rebound?.();rebound=null;};
  const reset=()=>{stop();s.rx=s.ry=0;paint(0,0);};s.resetPose=reset;
  const release=()=>{drag=null;stop();const rx=s.rx,ry=s.ry,x=lightX,y=lightY,start=activeNow(),run=generation;let id;
    const cancel=()=>{cancelAnimationFrame(id);rafs.delete(id);rebound=null;};
    const step=()=>{rafs.delete(id);if(run!==generation){cancel();return;}
      const p=Math.min(1,(activeNow()-start)/280),k=Math.pow(1-p,4);
      s.rx=rx*k;s.ry=ry*k;paint(x*k,y*k);
      if(p<1){id=requestAnimationFrame(step);rafs.set(id,cancel);}else{cancel();reset();updateFinish();}
    };
    cancel.resume=()=>{id=requestAnimationFrame(step);rafs.set(id,cancel);};rebound=cancel;cancel.resume();
  };
  el.addEventListener('pointerdown',e=>{if(!s.complete||e.button>0)return;e.preventDefault();getSelection()?.removeAllRanges();stop();if(e.pointerType!=='touch'){slots.forEach(x=>x.el.classList.remove('selected'));s.el.classList.add('selected');}drag={x:e.clientX,y:e.clientY,rx:s.rx,ry:s.ry};el.setPointerCapture(e.pointerId);});
  el.addEventListener('pointermove',e=>{if(!s.complete)return;const b=el.getBoundingClientRect();
    if(drag){s.rx=Math.max(-18,Math.min(18,drag.rx-(e.clientY-drag.y)*.2));s.ry=Math.max(-18,Math.min(18,drag.ry+(e.clientX-drag.x)*.2));}
    if(!rebound)paint((e.clientX-b.left)/b.width*2-1,(e.clientY-b.top)/b.height*2-1);});
  el.addEventListener('pointerup',e=>{if(drag&&e.pointerType==='touch'&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6){const selected=s.el.classList.contains('selected');slots.forEach(x=>x.el.classList.remove('selected'));s.el.classList.toggle('selected',!selected);}release();if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);});
  el.addEventListener('pointercancel',release);el.addEventListener('pointerleave',()=>{if(!rebound)release();});
  el.addEventListener('dblclick',reset);
}
function finishReveal(){updateFinish();}
function updateFinish(){const complete=slots.length&&slots.every(s=>s.complete)&&!cascading&&!busy&&!anims.size&&!timers.size&&!rafs.size&&!voices.size;
  btn.all.hidden=!slots.length||!!complete||skipped;btn.fin.hidden=!complete||collecting;
  if(complete&&!collecting){hint.textContent='拖曳轉動 · 放開自動回正';if(!collectMarked){collectMarked=true;root?.remove();root=null;setScreen('results');relayout();mark('collectable');}}
}
btn.all.textContent='跳過演出';btn.all.addEventListener('click',skipAll);
stage.addEventListener('click',e=>{if(!e.target.closest('button,a,.slot.done')&&slots.length&&!btn.all.hidden)skipAll();});
btn.fin.addEventListener('click',async()=>{if(btn.fin.hidden||collecting)return;collecting=true;btn.fin.hidden=true;const run=generation;
 sound('collect',null,slots.length);
 A(fan,[{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(20px) scale(.96)'}],{duration:220});
 if(await wait(220,run)){clearRun();hint.textContent='';}
});
btn.p1.addEventListener('click',()=>pull(1));btn.p5.addEventListener('click',()=>pull(5));btn.p10.addEventListener('click',()=>pull(10));
addEventListener('keydown',e=>{if(e.key==='Escape'){if(screen==='ceremony')skipAll();else for(const s of slots)if(s.complete)s.resetPose?.();}
 if(screen==='results'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const d=e.key==='ArrowLeft'?-1:1;
 if(mobile())browse(d);else{selectedIndex=Math.max(0,Math.min(slots.length-1,selectedIndex+d));pageIndex=Math.floor(selectedIndex/5);relayout();slots.forEach((s,i)=>s.el.classList.toggle('selected',i===selectedIndex));}}
});
// Only the active draw owns cancellable work. Background CSS has an independent lifecycle.
const backgroundScope={hidden:false};
function backgroundVisibility(){const hidden=document.hidden;backgroundScope.hidden=hidden;win.classList.toggle('background-paused',hidden||reduced.matches);
 if(hidden){for(const a of anims)if(a.playState==='running'){a.pause();a.__visibilityPaused=true;}pauseTimers();pauseRafs();audio?.suspend();}
 else{for(const a of anims)if(a.__visibilityPaused){a.__visibilityPaused=false;a.play();}resumeTimers();resumeRafs();if(!muted&&(voices.size||collectionVoices.size))audio?.resume();}
}
document.addEventListener('visibilitychange',backgroundVisibility);reduced.addEventListener('change',backgroundVisibility);
win.style.setProperty('--pack',`url("${path('fx/foil-pack.webp')}")`);win.style.setProperty('--tear',`url("${path('fx/foil-tear.webp')}")`);
__SUBSTRATE_INIT__
backgroundVisibility();
addEventListener('resize',()=>{if(slots.length)relayout();});
if(testing)window.__ceremony={events,pull,skipAll,syncFx:()=>fxPainters.forEach(paint=>paint(true)),reset:()=>{tickets=30;$('#ticket').textContent=tickets;clearRun();},layout,ready:()=>ready,setScreen,state:()=>({screen,pageIndex,selectedIndex,generation,busy,cascading,skipped,anims:anims.size,timers:timers.size,rafs:rafs.size,voices:voices.size,complete:slots.filter(s=>s.complete).length,ids:slots.map(s=>s.data.id),collectable:!btn.fin.hidden}),pause:()=>win.getAnimations({subtree:true}).forEach(a=>a.pause())};
