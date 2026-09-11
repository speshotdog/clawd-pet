/* Separate team layout and state. No ceremony controller or card geometry. */
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const rank={mythic:0,legendary:1,epic:2,rare:3,common:3}, labels=['神話','神話＋傳說','神話＋傳說＋史詩','全隊'],limits=[2,6,12,20], symbols=['◆◆','◆','◇','△'];
const cards=TEAM_DATA.cards, byId=new Map(cards.map(c=>[c.id,c]));
// 抽卡與卡池在 body 掛 ink-chroma，卡名／稀有度才會用階級墨色（--name-ink）。
// 卡面搬進 shadow root 之後 body 選擇器跨不過邊界，文字會落回 --accent-card，
// 所以在這裡換成同特異性（2 class + 1 type）的等價選擇器，規則先後順序不變。
const SHADOW_CSS=TEAM_DATA.css
  .replace(/body\.ink-chroma \.face-name/g,'.hcard b.face-name')
  .replace(/body\.ink-chroma \.face-rarity/g,'.hcard span.face-rarity')
  // 2026-09-12 拖曳：卡面在 shadow root 裡，外層的 user-select 進不來，選區保護要在這裡補
  +'\n.hcard,.hcard *{user-select:none;-webkit-user-select:none}.hcard img{-webkit-user-drag:none;pointer-events:none}';

const initial=cards.filter(c=>c.rarity!=='mythic'||cards.filter(x=>x.rarity==='mythic').indexOf(c)<2).filter(c=>c.rarity!=='legendary'||cards.filter(x=>x.rarity==='legendary').indexOf(c)<4).map(c=>c.id);
let roster=[...initial],skills=[null,null,null,null],selected=roster[0],face=null, generation=0,pending=null,pickerMode='add',skillSlot=0,previewTimer=0;
const state={preview:null,lastReject:null,previewElapsed:null};
const screen=$('#team-screen');
function counts(ids){return limits.map((_,i)=>ids.filter(id=>rank[byId.get(id).rarity]<=i).length)}
function violations(ids){return counts(ids).flatMap((n,i)=>n>limits[i]?[i]:[])}
function clearOperation(){clearTimeout(previewTimer);state.preview=null;state.lastReject=null;$('#capacity-errors').textContent='';$$('.capacity-row').forEach(e=>e.classList.remove('affected','violated'));screen.getAnimations({subtree:true}).forEach(a=>a.cancel())}
function proxy(c,index,handler){const b=document.createElement('button');b.className='team-proxy';b.dataset.id=c.id;b.setAttribute('aria-label',`${index===null?'候選':String(index+1).padStart(2,'0')} ${c.name} ${HoloCardFace.LABEL[c.rarity]}`);b.innerHTML=`<span class="proxy-image"><img src="${TEAM_DATA.images[c.proxy]}" alt="" draggable="false">${index===null?'':`<span class="proxy-index team-marker">${String(index+1).padStart(2,'0')}</span>`}<span class="proxy-symbol">${symbols[rank[c.rarity]]}</span></span><span class="proxy-name">${c.name}</span>`;b.onclick=handler;return b}
function renderCapacity(){const n=counts(roster);$('#capacity-rows').innerHTML=labels.map((l,i)=>`<div class="capacity-row" data-row="${i}"><span>${l}</span><span class="digits">${n[i]} / ${limits[i]}</span><span class="segments" style="--count:${limits[i]}" aria-hidden="true">${Array.from({length:limits[i]},(_,j)=>`<i class="${j<n[i]?'filled':''}"></i>`).join('')}</span></div>`).join('')}
let rosterPage=0;const overviewFaces=new Set();
function disposeOverview(){overviewFaces.forEach(h=>h.dispose());overviewFaces.clear()}
function bindPointer(host,paint){let raf=0,point=null;const move=e=>{const r=host.getBoundingClientRect();point=[Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1))];if(!raf)raf=requestAnimationFrame(()=>{raf=0;paint(...point)})};const leave=()=>{cancelAnimationFrame(raf);raf=0;paint(0,0)};host.addEventListener('pointermove',move);host.addEventListener('pointerleave',leave);return ()=>{cancelAnimationFrame(raf);host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave)}}
// 唯一的完整卡面掛載器（總覽／挑選器／拖曳 ghost 共用）。沿用 HoloCardFace 的 create/observe/refit/paint，
// 不複製 DOM 當卡面（cloneNode 不會帶 shadow root）。回傳的 dispose 會取消 rAF、拆事件、解除觀察再移除節點。
function mountFace(host,c,{pointer=true}={}){host.querySelector('img')?.remove();const mount=document.createElement('span');mount.className='overview-face';host.prepend(mount);const sh=mount.attachShadow({mode:'open'}),st=document.createElement('style');st.textContent=SHADOW_CSS;sh.append(st);mount.style.setProperty('--frame-mask',`url("${TEAM_DATA.masks.frame}")`);mount.style.setProperty('--glitter-mask',`url("${TEAM_DATA.masks.glitter}")`);const f=HoloCardFace.create(c,{masks:TEAM_DATA.masks,resolve:n=>TEAM_DATA.images[n]});sh.append(f);HoloCardFace.observe(f);HoloCardFace.refit(f);
let unbind=null;if(pointer)unbind=bindPointer(host,(x,y)=>{if(f.isConnected&&document.body.dataset.screen==='team'&&!(drag&&drag.active))HoloCardFace.paint(f,c.rarity,x,y,{tilt:!matchMedia('(prefers-reduced-motion: reduce)').matches})});else HoloCardFace.paint(f,c.rarity,0,0,{tilt:false});
return {face:f,mount,card:c,refit(){HoloCardFace.refit(f)},dispose(){unbind?.();HoloCardFace.unobserve(f);mount.remove()}}}
function mountOverview(b,c){overviewFaces.add(mountFace(b.querySelector('.proxy-image'),c))}
function showPage(n){cancelDrag();rosterPage=Math.max(0,Math.min(Math.ceil(roster.length/10)-1,n));disposeOverview();$$('#team-grid .team-proxy').forEach((b,i)=>{b.hidden=Math.floor(i/10)!==rosterPage;b.querySelector('.overview-face')?.remove();if(!b.hidden)mountOverview(b,byId.get(b.dataset.id))});$('#roster-page').textContent=`${rosterPage+1} / ${Math.ceil(roster.length/10)}`;$('#roster-prev').disabled=rosterPage===0;$('#roster-next').disabled=rosterPage>=Math.ceil(roster.length/10)-1}
$('#roster-prev').onclick=()=>showPage(rosterPage-1);$('#roster-next').onclick=()=>showPage(rosterPage+1);
function renderRoster(){disposeOverview();const grid=$('#team-grid');grid.replaceChildren(...roster.map((id,i)=>{const b=proxy(byId.get(id),i,()=>select(id,true));b.setAttribute('aria-selected',String(id===selected));return b}));$('#roster-count').textContent=`${roster.length} / 20`;renderCapacity();renderSkills();showPage(rosterPage)}
function disposeFace(){if(face){HoloCardFace.unobserve(face);face.remove();face=null}}
const shadow=$('#card-host').attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=SHADOW_CSS;shadow.append(style);
$('#card-host').style.setProperty('--frame-mask',`url("${TEAM_DATA.masks.frame}")`);$('#card-host').style.setProperty('--glitter-mask',`url("${TEAM_DATA.masks.glitter}")`);
function detail(){disposeFace();const c=byId.get(selected)||byId.get(roster[0]);if(!c){$('#detail-name').textContent='尚未編入';$('#detail-number').textContent='—';$('#detail-operation').textContent='選擇成員以編入';return}selected=c.id;const index=roster.indexOf(c.id),serial=index>=0?String(index+1).padStart(2,'0'):'候選';
$('#detail-number').textContent=serial;$('#detail-name').textContent=c.name;$('#detail-rarity').textContent=HoloCardFace.LABEL[c.rarity];$('#detail-operation').innerHTML=`<span class="selection-serial">${serial}</span> · ${index>=0?'已編入':'尚未編入'} · ${c.name}`;$('#team-detail').dataset.id=c.id;$('#team-detail').dataset.slot=serial;
face=HoloCardFace.create(c,{masks:TEAM_DATA.masks,resolve:n=>TEAM_DATA.images[n]});shadow.append(face);HoloCardFace.observe(face);HoloCardFace.refit(face);$('#team-detail').style.setProperty('--accent-card',getComputedStyle(face).getPropertyValue('--accent-card'));$$('#team-grid .team-proxy').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.id===selected)));}
function select(id,open=false){if(!byId.has(id))return;clearOperation();selected=id;const index=roster.indexOf(id);if(index>=0&&Math.floor(index/10)!==rosterPage)showPage(Math.floor(index/10));detail();if(open){screen.classList.add('detail-open');if(innerWidth<=700)$('#detail-close').focus()}}
function pose(x,y){if(face&&document.body.dataset.screen==='team')HoloCardFace.paint(face,byId.get(selected).rarity,x,y,{tilt:!matchMedia('(prefers-reduced-motion: reduce)').matches})}
bindPointer($('#card-host'),pose);$('#card-host').addEventListener('keydown',e=>{const p={ArrowLeft:[-.6,0],ArrowRight:[.6,0],ArrowUp:[0,-.6],ArrowDown:[0,.6],Escape:[0,0]}[e.key];if(p){e.preventDefault();pose(...p)}});
function preview(id){clearOperation();pending=id;const c=byId.get(id),start=performance.now(),token=generation;previewTimer=setTimeout(()=>{if(token!==generation||!c)return;state.preview=limits.map((_,i)=>rank[c.rarity]<=i);state.previewElapsed=performance.now()-start;$$('.capacity-row').forEach((e,i)=>e.classList.toggle('affected',state.preview[i]));$('#picker-status').textContent=`${c.name} · 影響：${labels.filter((_,i)=>state.preview[i]).join('、')}`},120)}
function add(id,replace=null,origin=null){clearOperation();if(!byId.has(id))return false;let next=roster.filter(x=>x!==replace);if(next.includes(id)){$('#picker-status').textContent='此成員已在隊伍中';return false}next.push(id);const bad=violations(next);if(bad.length){const n=counts(roster),after=counts(next);state.lastReject={id,rows:bad,before:[...roster],after:next};$('#capacity-errors').textContent=bad.map(i=>`${labels[i]}合計已達 ${n[i]}，加入後將為 ${after[i]}`).join('；');$('#picker-status').textContent=$('#capacity-errors').textContent;bad.forEach(i=>{const e=$$('.capacity-row')[i];e.classList.add('violated');const a=e.animate([{borderColor:'#949690'},{borderColor:'#949690'}],{duration:300});a.id='team-over-limit'});const target=origin||$(`#picker-grid [data-id="${id}"]`)||$('#add-member');const a=target.animate([{transform:'translateY(-12px)'},{transform:'translateY(0)'}],{duration:210,easing:'ease-out'});a.id='team-return';return false}if(replace){next=roster.map(x=>x===replace?id:x)}roster=next;selected=id;renderRoster();detail();return true}
function remove(){clearOperation();roster=roster.filter(id=>id!==selected);selected=roster[0];renderRoster();detail();screen.classList.remove('detail-open')}
function renderSkills(){$('#skill-grid').replaceChildren(...skills.map((id,i)=>{const b=document.createElement('button');b.className='skill-slot';b.dataset.slot=String(i);b.innerHTML=`<small>獨立技能 ${i+1}</small>${id?byId.get(id).name:'＋ 挑選'}`;b.onclick=()=>openPicker('skill',i);return b}))}
// 訊息出口：挑選器開著就寫 #picker-status，否則寫技能區的 #skill-status（dialog 關閉時 #picker-status 看不見）。
function notify(msg){const dlg=$('#team-picker');const el=dlg.open?$('#picker-status'):$('#skill-status');if(el)el.textContent=msg;return msg}
function assignSkill(i,id){if(!byId.has(id)||i<0||i>3)return false;if(byId.get(id).rarity==='mythic'&&skills.some((x,j)=>j!==i&&x&&byId.get(x).rarity==='mythic')){notify('神話技能最多 1 張；請先替換原神話技能');return false}skills[i]=id;renderSkills();notify(`獨立技能 ${i+1} · ${byId.get(id).name}`);return true}
const pickerFaces=new Set();function disposePicker(){pickerFaces.forEach(h=>h.dispose());pickerFaces.clear()}
function openPicker(mode,slot=0){cancelDrag();clearOperation();pending=null;pickerMode=mode;skillSlot=slot;disposePicker();$('#picker-title').textContent=mode==='skill'?'挑選獨立技能':mode==='replace'?'替換目前成員':'新增隊伍成員';$('#picker-status').textContent=mode==='skill'?`獨立技能 ${slot+1} · 點卡片選擇；桌機也可直接從隊伍拖到技能格`:'選擇成員，預覽受影響的累加上限';$('#picker-confirm').disabled=true;const buttons=cards.map(c=>{const b=proxy(c,null,()=>{if(mode==='skill'){pending=c.id;$('#picker-status').textContent=`獨立技能 ${slot+1} · ${c.name}`}else preview(c.id);$('#picker-confirm').disabled=false;$$('#picker-grid button').forEach(x=>x.setAttribute('aria-selected',String(x===b)))});if(mode!=='skill'&&roster.includes(c.id))b.disabled=true;return b});$('#picker-grid').replaceChildren(...buttons);$('#team-picker').showModal();
// 開窗後才掛完整卡面：dialog 佈局完成才有正確寬度給字級公式；掛完再 refit 一次
buttons.forEach(b=>pickerFaces.add(mountFace(b.querySelector('.proxy-image'),byId.get(b.dataset.id),{pointer:false})));requestAnimationFrame(()=>pickerFaces.forEach(h=>h.refit()))}
function closePicker(){clearTimeout(previewTimer);pending=null;disposePicker();$('#team-picker').close()}
$('#picker-confirm').onclick=()=>{if(!pending)return;const id=pending,ok=pickerMode==='skill'?assignSkill(skillSlot,id):add(id,pickerMode==='replace'?selected:null);if(ok){closePicker();if(pickerMode==='skill')notify(`獨立技能 ${skillSlot+1} · ${byId.get(id).name}`)}};
$('#picker-close').onclick=closePicker;$('#team-picker').addEventListener('cancel',closePicker);
$('#add-member').onclick=()=>openPicker('add');$('#replace-member').onclick=()=>openPicker('replace');$('#remove-member').onclick=remove;
$('#detail-close').onclick=()=>{screen.classList.remove('detail-open');$(`#team-grid [data-id="${selected}"]`)?.focus()};
function setScreen(name){if(!['map','team'].includes(name))return false;cancelDrag();generation++;if(name==='team')map20.cancel();clearOperation();closePicker();disposeFace();document.body.dataset.screen=name;screen.classList.remove('detail-open');if(name==='team'){renderRoster();detail()}else{disposeOverview();lines();terrainLayout()}return true}
$('#open-team').onclick=()=>setScreen('team');$('#return-map').onclick=()=>setScreen('map');

// ---- 拖曳：從隊伍網格把卡拖到獨立技能格（2026-09-12，ORDER 第 2.2 節）
// Pointer Events；只在 >700px、mouse/pen、主鍵；移動 8 CSS px 才成立，未成立就是原本的點擊。
// ghost 是同一張卡的完整卡面（走 mountFace），放在 body 的 fixed 覆層，pointer-events:none。
const DRAG_THRESHOLD=8;let drag=null,suppressClick=false;
const dragLayer=document.createElement('div');dragLayer.id='drag-layer';dragLayer.setAttribute('aria-hidden','true');document.body.append(dragLayer);
const dragEnabled=e=>innerWidth>700&&e.isPrimary&&e.button===0&&(e.pointerType==='mouse'||e.pointerType==='pen');
function dragCleanup(){if(!drag)return;const d=drag;drag=null;cancelAnimationFrame(d.raf);d.raf=0;d.ghostFace?.dispose();d.ghost?.remove();d.over?.classList.remove('drop-target');d.src.classList.remove('drag-source');if(d.captured){try{d.src.releasePointerCapture(d.pid)}catch{}}screen.classList.remove('dragging')}
function cancelDrag(){if(!drag)return;const active=drag.active;dragCleanup();if(active)notify('已取消，技能未變更')}
function startDrag(e){const d=drag;d.active=true;screen.classList.add('dragging');getSelection()?.removeAllRanges();d.src.classList.add('drag-source');const img=d.src.querySelector('.proxy-image');const r=img.getBoundingClientRect();
// 用未放大的佈局寬度（offsetWidth），不是 hover 放大後的投影寬
d.w=img.offsetWidth;d.h=img.offsetHeight;d.gx=(e.clientX-r.left)/r.width*d.w;d.gy=(e.clientY-r.top)/r.height*d.h;
const g=document.createElement('div');g.className='drag-ghost';g.style.width=d.w+'px';g.style.height=d.h+'px';const host=document.createElement('span');host.className='proxy-image';g.append(host);dragLayer.append(g);d.ghost=g;d.ghostFace=mountFace(host,byId.get(d.id),{pointer:false});
try{d.src.setPointerCapture(d.pid);d.captured=true}catch{}
placeGhost()}
function placeGhost(){const d=drag;if(!d||!d.active)return;d.raf=0;d.ghost.style.translate=`${d.x-d.gx}px ${d.y-d.gy}px`;
// 從 user-select:none 的網格按下再拖過可選文字（詳情面板）時，Chrome 仍會延伸選區；拖曳中一律清掉
const sel=getSelection();if(sel&&!sel.isCollapsed)sel.removeAllRanges();
// 最上層命中：ghost 與覆層都是 pointer-events:none，elementsFromPoint 不會回傳它們；浮層蓋住技能格就不算命中
const top=document.elementsFromPoint(d.x,d.y)[0];const slot=top?.closest?.('#skill-grid .skill-slot');const over=slot&&!slot.disabled?slot:null;
if(over!==d.over){d.over?.classList.remove('drop-target');over?.classList.add('drop-target');d.over=over}}
$('#team-grid').addEventListener('pointerdown',e=>{const b=e.target.closest('.team-proxy');if(!b||!dragEnabled(e)||drag)return;drag={id:b.dataset.id,src:b,pid:e.pointerId,sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,active:false,raf:0,ghost:null,ghostFace:null,over:null,captured:false}});
addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pid)return;drag.x=e.clientX;drag.y=e.clientY;if(!drag.active){if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<DRAG_THRESHOLD)return;startDrag(e);return}if(!drag.raf)drag.raf=requestAnimationFrame(placeGhost)});
addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pid)return;if(!drag.active){drag=null;return}
// 放下前用最新座標再判一次命中，不吃上一格 rAF 的舊結果
drag.x=e.clientX;drag.y=e.clientY;cancelAnimationFrame(drag.raf);drag.raf=0;placeGhost();const over=drag.over,id=drag.id;suppressClick=true;setTimeout(()=>{suppressClick=false},0);dragCleanup();
if(over){assignSkill(+over.dataset.slot,id)}else notify('已取消，技能未變更')});
addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.pid)cancelDrag()});
$('#team-grid').addEventListener('lostpointercapture',e=>{if(drag&&drag.active&&e.pointerId===drag.pid&&drag.captured)cancelDrag()});
addEventListener('keydown',e=>{if(e.key==='Escape'&&drag)cancelDrag()});
addEventListener('blur',()=>cancelDrag());
addEventListener('resize',()=>{if(drag&&innerWidth<=700)cancelDrag()});
// 拖曳成立後衍生的 click 只吃這一次；下一次普通點擊照常
$('#team-grid').addEventListener('click',e=>{if(suppressClick){e.stopPropagation();e.preventDefault();suppressClick=false}},true);
window.team20={showPage,cards,notify,get drag(){return {threshold:DRAG_THRESHOLD,active:!!(drag&&drag.active),pending:!!drag,ghosts:dragLayer.childElementCount,rafPending:!!(drag&&drag.raf),targets:$$('.skill-slot.drop-target').length,pickerFaces:pickerFaces.size,overviewFaces:overviewFaces.size}},counts,violations,add,select,preview,assignSkill,pose,setScreen,openPicker,get roster(){return [...roster]},get skills(){return [...skills]},get face(){return face},get state(){return {...state}},get generation(){return generation},reset(){cancelDrag();clearOperation();roster=[...initial];skills=[null,null,null,null];selected=roster[0];renderRoster();detail()},ablate(flags=[]){for(const name of ['carrier','texture','selection'])screen.classList.toggle('no-team-'+name,flags.includes(name))}};
document.body.dataset.screen='map';if(new URLSearchParams(location.search).get('screen')==='team')setScreen('team');
})();
