// Deterministic DESIGN-astra I-7 progression; no purchases or draws are invented.
const E=require('../../src/clicker-economy.js');
const S=require('../../src/clicker-save.js');
const B=require('../../src/clicker-balance.js');
const Pool=require('../../src/gacha-pool.js');
const {scenes}=require('../../src/clicker-scene.js');
let seed=0x8a57a, draw=0;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let s=S.fresh(0), spent={click:0,training:0,draw:0};
function buy() {
  for(const [type,share] of [['click',.2],['training',.4],['draw',.4]]) {
    while(true) {
      const cost=type==='draw'?E.drawCost(s.paidDraws):type==='click'?E.clickCost(s.clickLevel):E.trainingCost(s.trainingLevel);
      if(cost>s.lifetimeCoins*share-spent[type] || cost>s.coins) break;
      if(type==='draw') {s=E.purchaseDraw(s,1,s.settledAt,Pool,{rng,id:`sim-${++draw}`,visualSeed:seed});s=E.collect(s,s.pending.draw.id,s.settledAt).state;}
      else s=E.upgrade(s,type,false,s.settledAt).state;
      spent[type]+=cost;
    }
  }
}
let elapsed=0;
while(s.package.index<51 && elapsed<30*86400000) {
  const first=elapsed<1800000, dayTime=(elapsed-1800000)%43200000;
  if(!first && dayTime>=600000) {elapsed+=43200000-dayTime;s=E.settle(s,elapsed,{offline:true}).state;}
  else {elapsed+=1000/(first?2:6);s=E.click(s,elapsed).state;buy();}
}
if(s.package.index<51) throw new Error('Did not reach 50 packages');
function damage(ids=[],clicks=6) {
  let f=E.clone(s), start=f.settledAt;
  f.effects=[];f.cooldownUntil={};f.slotReadyAt=[0,0,0];f.skillSlots=[...ids,...Array(3-ids.length).fill(null)];
  f=E.startBoss(f,start);f.boss.need=1e100;
  for(let i=0;i<ids.length;i++) f=E.activate(f,i,start).state;
  for(let i=0;i<180;i++) {const now=start+i*1000/6;f=clicks?E.click(f,now).state:E.settle(f,now).state;}
  f=E.settle(f,start+30000).state;
  // At exactly 30 seconds the boss fails; use crack to recover dealt/need.
  return f.boss ? f.boss.dealt : f.bossResult.crack*2*1e100;
}
let combo=['yueyue','dog','jiaobu'];
if(!combo.every(id=>s.collection[id]) || E.slotCount(s)<3) {
  const ids=Object.keys(s.collection).filter(id=>B.characters[id].kind);let best=-1;
  for(const a of ids) for(const b of ids) if(a!==b) {const pair=[a,b].slice(0,E.slotCount(s)), d=damage(pair);if(d>best){best=d;combo=pair;}}
}
const raw=[damage([],0),damage([]),damage(combo)], targets=[[.35,.45],[.7,.85],[1.1,1.4]], base=E.requirement(s.package.index);
const lower=Math.max(...raw.map((d,i)=>d/base/targets[i][1])), upper=Math.min(...raw.map((d,i)=>d/base/targets[i][0]));
const suggested=(lower+upper)/2;
const mul=scenes.backyard.boss.mul;
console.log(JSON.stringify({seed:'0x8a57a',elapsedSeconds:elapsed/1000,package:s.package.index,clickLevel:s.clickLevel,trainingLevel:s.trainingLevel,paidDraws:s.paidDraws,collection:s.collection,rates:E.rates(s),combo,mul,need:base*mul,feasibleMul:[lower,upper],suggestedMul:suggested},null,2));
console.table(raw.map((d,i)=>({style:['idle','6 clicks/s','6 clicks/s + skills'][i],damage:d,percent:d/(base*mul)*100,target:targets[i].map(v=>v*100).join('-')+'%'})));
