// 進度曲線模擬：真人節奏（點擊 4/s、技能一好就放、貪婪買回本最快的升級、有錢就五連），量各場景王前的耗時、包速、抽卡節奏、王的比例。
// 用法：node tools/sim/clicker-curve.js [clicksPerSec] [sessionMin] [days]
const E=require('../../src/clicker-economy.js'), S=require('../../src/clicker-save.js'), B=require('../../src/clicker-balance.js'), P=require('../../src/clicker-prestige.js'), Pool=require('../../src/gacha-pool.js'), {scenes}=require('../../src/clicker-scene.js');
const CPS=+process.argv[2]||4, SESSION=(+process.argv[3]||20)*60000, DAYS=+process.argv[4]||14;
let seed=0x8a57a; const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let skipUntil=0; let s=S.fresh(0), now=0, draws=0, drawLog=[], bossLog=[], packLog=[], active=0, lastDrawAt=0, buys={click:0,training:0,partner:0,auto:0};
const order=['backyard','kitchen','market','factory','nightmarket','fridge'];
const combos=[['yueyue','dog','jiaobu'],['yang','fox','caihua'],['yueyue2','jiaobu2','caihua']];
function payback(kind,id) {   // 回本秒數：花費 / 每秒增加的 P（點擊用 D×CPS 換算）
  const r=E.rates(s), P0=r.P+r.D*CPS; let cost, next=E.clone(s);
  if(kind==='click'){cost=E.clickCost(s.clickLevel);next.clickLevel++;}
  else if(kind==='training'){cost=E.trainingCost(s.trainingLevel);next.trainingLevel++;}
  else if(kind==='partner'){const L=s.partnerLevels?.[id]||0; if(L>=P.PARTNER_CAP) return null; cost=P.trainCost(L,id);next.partnerLevels={...(s.partnerLevels||{}),[id]:L+1};}
  else if(kind==='auto'){const L=s.autoClick||0; if(L>=B.autoClickMax) return null; cost=P.autoClickCost(L);next.autoClick=L+1;}
  const r2=E.rates(next), P1=r2.P+r2.D*(CPS+(kind==='auto'?.5:0)); const gain=P1-P0; return gain>0?{cost,seconds:cost/gain}:null;
}
function shop() {
  if(s.pending||s.boss) return;
  while((s.marks || 0) >= (s.blessing || 0) + 1) s=P.buyBlessing(s,now);
  // 五連：付得起就抽（最多每 90 秒一次，模擬真人開包時間）
  while(!s.pending && (s.freeDraws>=5 || s.coins>=E.drawCost(s,5)) && now-lastDrawAt>=90000) {
    const paidState=E.settle(s,now).state, price=E.drawCost(paidState,5-Math.min(paidState.freeDraws||0,5));
    s=E.purchaseDraw(s,5,now,Pool,{rng,id:`d${++draws}`,visualSeed:seed});
    const beforeP=E.rates(s).P, collected=E.collect(s,s.pending.draw.id,now);
    s=collected.state; const gainPerSec=E.rates(s).P-beforeP;
    lastDrawAt=now; drawLog.push({at:now,scene:s.settings.scene,pkg:s.package.index,price,newIds:collected.newIds,gainPerSec,paybackSec:collected.newIds.length ? price/gainPerSec : null});
    for(let i=0;i<3;i++) if(!s.skillSlots[i]) for(const c of combos) for(const id of c) if(s.collection[id]&&!s.skillSlots.includes(id)&&i<E.slotCount(s)) {s=E.equip(s,i,id,now);break;}
  }
  // 存錢買包：距上次五連超過 90 秒就先攢到五連價，攢夠之前不買升級（真人「想開包」的行為）
  if(now-lastDrawAt>=90000 && s.coins<E.drawCost(s,5) && (s.freeDraws||0)<5) return;
  for(let guard=0;guard<2000;guard++) {
    const options=[['click'],['training'],['auto'],...Object.keys(s.collection).map(id=>['partner',id])].map(([k,id])=>({k,id,...payback(k,id)})).filter(o=>o.cost&&o.cost<=s.coins);
    if(!options.length) break; options.sort((a,b)=>a.seconds-b.seconds); const o=options[0]; if(o.seconds>4*3600 && o.cost>s.coins*.2) break;   // 真人有錢就買；回本超過 4 小時、而且要花掉兩成以上存款才收手
    if(o.k==='click'||o.k==='training') s=E.upgrade(s,o.k,false,now).state; else if(o.k==='partner') s=P.train(s,o.id,now).state; else s=P.buyAutoClick(s,now).state; buys[o.k]++;
  }
}
function fight() {
  // 王：連點 6/s ＋ 技能全放；失敗就等冷卻再打
  const scene=s.settings.scene; let tries=0, start=now;
  while(E.canBoss(s,now)&&tries<3) {
    tries++; const r0=E.rates(s); s=E.startBoss(s,now); const need=s.boss.need, dealt0=s.boss.dealt;
    if(tries===1) {   // 三種打法的 30 秒容量（技能冷卻全清、需求無限大）
      // regen 場景（冰箱 1%/s）：need 灌成 1e100 時回升量也跟著變 1e100 級，dealt 每 tick 被歸零 → 量到的容量全是 0。
      // 量容量時先把回升關掉，改在下面的 ratio 用 rate×30 秒把它扣回來。
      const regenRate=scenes[scene].enemy?.regen||0, enemy=scenes[scene].enemy;
      const cap=(ids,clicks)=>{if(enemy) enemy.regen=null; let f=E.clone(s);f.boss.need=1e100;f.boss.dealt=0;f.effects=[];f.cooldownUntil={};f.slotReadyAt=[0,0,0,0];f.skillSlots=ids;f.chain={count:1,expiresAt:0};
        for(let i=0;i<180;i++){const t=now+i*1000/6;for(let k=0;k<ids.length;k++) if(ids[k]) {try{f=E.activate(f,k,t).state;}catch{}} f=clicks?E.click(f,t).state:E.settle(f,t).state;} f=E.settle(f,now+29999).state; if(enemy) enemy.regen=regenRate||null; return f.boss.dealt;};
      const slots=s.skillSlots.map(id=>id&&s.collection[id]?id:null);
      const caps=[cap([],false),cap([],true),cap(slots,true)];
      bossLog.push({at:now,active,scene,try:0,won:false,ratio:caps.map(v=>(v/need-regenRate*30).toFixed(2)).join('/'),need,P:r0.P,note:`P0=${r0.P.toExponential(2)} D0=${r0.D.toExponential(2)} slots=${slots}`});
      if(caps[2]<need*(.95+regenRate*30)) { s=E.abandonBoss(s,now); skipUntil=now+SESSION; return; }
    }
    for(let i=0;i<180&&s.boss;i++){ const t=now+i*1000/6; for(let k=0;k<3&&s.boss;k++) { try{ s=E.activate(s,k,t).state; }catch{} } s=E.click(s,t).state; }
    if(s.boss) s=E.settle(s,now+30000).state; now+=30000;
    const won=s.bossWins.includes(scene); const r=s.bossResult; bossLog.push({at:now,active,scene,try:tries,won,ratio:+(won?1:(r.crack/scenes[scene].boss.crackKeep+dealt0/need)).toFixed(2),need,P:E.rates(s).P});
    if(won) return; now+=31000; s=E.settle(s,now).state;
  }
}
function fmt(ms){return (ms/3600000).toFixed(2)+'h';}
const daily=[]; let lastPkgAt=0;
const dailyDust={}; let previousDust=0;
function recordDust() { const day=Math.floor(now/86400000); dailyDust[day]=(dailyDust[day]||0)+s.universalDust-previousDust; previousDust=s.universalDust; }
while(now<DAYS*86400000) {
  // 一段主動遊玩
  const end=now+SESSION;
  while(now<end) {
    const dt=1000/CPS; now+=dt;
    for(let k=0;k<3;k++) { const id=s.skillSlots[k]; if(id && (s.cooldownUntil[id]||0)<=now && (s.slotReadyAt[k]||0)<=now) { try{ s=E.activate(s,k,now).state; }catch{} } }
    const before=s.package.index; s=E.click(s,now).state;
    if(s.package.index>before) { packLog.push({scene:s.settings.scene,pkg:before,sec:(now-lastPkgAt)/1000}); lastPkgAt=now; }
    if(Math.round(now/dt)%(CPS*5)===0) shop();
    if(now>=skipUntil && E.canBoss(s,now)) { fight(); lastPkgAt=now; }
    recordDust(); active+=dt;
  }
  s=E.settle(s,now).state; shop(); if(now<86400000) daily.push(`${fmt(now)} 收工 ${s.settings.scene}#${s.package.index} P=${E.rates(s).P.toExponential(2)} D=${E.rates(s).D.toExponential(1)} 訓練Lv${s.trainingLevel} 攻擊力Lv${s.clickLevel} 夥伴${Object.keys(s.collection).length} Lv中位${[...Object.values(s.partnerLevels||{})].sort((a,b)=>a-b)[Object.keys(s.partnerLevels||{}).length>>1]||0}`);
  now+=8*3600000; s=E.settle(s,now,{offline:true}).state; lastPkgAt=now; const pre=s.coins; shop();
  recordDust();
  daily.push(`${fmt(now)} ${s.settings.scene}#${s.package.index} P=${E.rates(s).P.toExponential(2)} 醒來幣=${pre.toExponential(1)} 剩=${s.coins.toExponential(1)} 訓練Lv${s.trainingLevel} 夥伴Lv中位${[...Object.values(s.partnerLevels||{})].sort((a,b)=>a-b)[Object.keys(s.partnerLevels||{}).length>>1]||0}`);
}
const won=order.filter(id=>s.bossWins.includes(id));
console.log('=== 曲線模擬 CPS',CPS,'session',SESSION/60000,'min，天數',DAYS,'===');
console.log('王勝：',won.join(' → ')||'無','；目前場景',s.settings.scene,'第',s.package.index,'包；P=',E.rates(s).P.toExponential(2),'coins=',s.coins.toExponential(2),'lifetime=',s.lifetimeCoins.toExponential(2));
console.log('升級次數',buys,'五連',draws,'夥伴',Object.keys(s.collection).length,'訓練 Lv',s.trainingLevel,'攻擊力 Lv',s.clickLevel,'夥伴訓練',JSON.stringify(s.partnerLevels));
for(const b of bossLog) console.log(' 王',b.scene,'第',b.try,'次',b.won?'勝':'敗','比例',b.ratio,'need',b.need.toExponential(2),'時間',fmt(b.at),'主動',fmt(b.active),'P',b.P.toExponential(2),b.note||'');
const byScene={}; for(const p of packLog){(byScene[p.scene]||=[]).push(p.sec);} 
for(const [sc,arr] of Object.entries(byScene)) { const a=[...arr].sort((x,y)=>x-y); console.log(' 包速',sc,'n=',a.length,'中位',a[a.length>>1].toFixed(1)+'s','p90',a[Math.floor(a.length*.9)].toFixed(1)+'s','最長',a[a.length-1].toFixed(0)+'s'); }
const dHours={}; for(const d of drawLog){const h=Math.floor(d.at/3600000/24); dHours[h]=(dHours[h]||0)+1;} console.log(' 每日五連數',JSON.stringify(dHours));
console.log(' 每日萬用粉塵入帳',JSON.stringify(dailyDust));
console.log(' 收益祝福 Lv',s.blessing || 0,'剩餘印記',s.marks || 0);
console.log(' 主動遊玩總時數',fmt(active)); for(const d of daily) console.log(' 醒來',d);

const paidBack=drawLog.map((d,i)=>({...d,n:i+1})).filter(d=>d.paybackSec!==null).sort((a,b)=>a.paybackSec-b.paybackSec);
const worst=paidBack.at(-1), duplicates=drawLog.filter(d=>d.paybackSec===null).length;
console.log(' 五連回本秒數 中位數',paidBack.length ? paidBack[Math.floor((paidBack.length-1)/2)].paybackSec.toFixed(2) : '無','／最差',worst ? `${worst.paybackSec.toFixed(2)}（第${worst.n}抽、第${Math.floor(worst.at/86400000)+1}天）` : '無','／整包重複比例',`${duplicates}/${draws} (${(100*duplicates/(draws||1)).toFixed(2)}%)`);
for(const [label,rows] of [['前5抽',drawLog.slice(0,5)],['後5抽',drawLog.slice(-5)]]) for(const d of rows) console.log(' ',label,JSON.stringify({n:drawLog.indexOf(d)+1,day:Math.floor(d.at/86400000)+1,...d}));
