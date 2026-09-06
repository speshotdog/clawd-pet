const test=require('node:test'), assert=require('node:assert/strict');
const E=require('../../src/clicker-economy.js'), S=require('../../src/clicker-save.js'), Pool=require('../../src/gacha-pool.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,b),`${a} ~= ${b}`);
const kitchen=()=>{const s=S.fresh(0);s.bossWins=['backyard'];s.settings.scene='kitchen';s.package=E.newPackage('kitchen');return s;};
const boss=()=>{const s=S.fresh(0);s.package.index=51;return E.startBoss(s,0);};
test('round8 shell: passive and burst stop at first ring, coins still granted',()=>{
  let s=kitchen();s.collection={fox:1};s.skillSlots[0]='fox';s=E.activate(s,0,0).state;
  near(s.package.progress,75);near(s.package.blocked,465);near(s.coins,540);
});
test('round8 shell: exactly three effective clicks, independent of power',()=>{
  let p=E.advancePackage(E.newPackage('kitchen'),100,'kitchen').package;
  for(let i=0;i<2;i++){const r=E.advancePackage(p,10000,'kitchen','click');p=r.package;assert.equal(r.shellBroken,false);near(p.progress,75);assert.equal(p.shellHp,2-i);}
  const r=E.advancePackage(p,1,'kitchen','click');assert.equal(r.shellBroken,true);assert.equal(r.package.shellHp,3);near(r.released,25);near(r.package.progress,101);
  const huge=E.advancePackage(p,10000,'kitchen','click');near(huge.package.progress,150);near(huge.package.blocked,9950);
});
test('round8 shell: release gives no duplicate coins and can open multiple packages',()=>{
  let s=kitchen();s.collection={yueyue2:1};s=E.settle(s,100000,{offline:true}).state;
  const coins=s.coins;s=E.click(s,100000).state;s=E.click(s,100000).state;const r=E.click(s,100000);
  near(r.released,900);assert.equal(r.completed,2);near(r.state.coins-coins,E.rates(s).D*3);
});
test('round8 shell: offline caps blocked at three needs and keeps first shell',()=>{
  let s=kitchen();s.collection={zhenmu:16};const r=E.settle(s,8*3600000,{offline:true});
  near(r.state.package.progress,75);near(r.state.package.blocked,900);assert.equal(r.state.package.index,1);assert.deepEqual(r.state.package.shells,[.75,.5,.25]);
  assert.ok(r.earned>900);
});
test('round8 shell: new packages copy scene shells without sharing arrays',()=>{
  const p=E.newPackage('kitchen');p.shells=[];p.progress=299;
  const r=E.advancePackage(p,2,'kitchen','click');assert.equal(r.package.index,2);assert.deepEqual(r.package.shells,[.75,.5,.25]);near(r.package.progress,1);assert.deepEqual(p.shells,[]);
});
test('round8 shell: backyard geometric multi-package behavior remains unchanged',()=>{
  const p=E.newPackage('backyard');const r=E.advancePackage(p,E.packageSum(1,100,'backyard')+7,'backyard','offline');assert.equal(r.package.index,101);near(r.package.progress,7);assert.deepEqual(r.package.shells,[]);
});
test('round8 boss: appearance threshold and cooldown guards',()=>{
  const s=S.fresh(0);s.package.index=50;assert.equal(E.canBoss(s,0),false);s.package.index=51;assert.equal(E.canBoss(s,0),true);
  s.bossCooldownUntil=30;assert.throws(()=>E.startBoss(s,29));assert.ok(E.startBoss(s,30).boss);
});
test('round8 boss: need, deadline and saved crack seed',()=>{
  const s=S.fresh(0);s.package.index=51;s.bossCracks.backyard=.4;const b=E.startBoss(s,100).boss;
  near(b.need,E.requirement(51)*1.35);near(b.dealt,b.need*.4);assert.equal(b.endsAt,30100);
});
test('round8 boss: all sources earn coins into boss, normal package paused',()=>{
  let s=boss();s.collection={fox:1};s.skillSlots[0]='fox';const p=structuredClone(s.package);
  s=E.activate(s,0,0).state;s=E.click(s,1000).state;near(s.boss.dealt,120+8+1.4);near(s.coins,s.boss.dealt);assert.deepEqual(s.package,p);
});
test('round8 boss: 80% failure keeps 40%, cooldown and package exact',()=>{
  let s=boss();s.boss.dealt=s.boss.need*.8;const p=structuredClone(s.package);s=E.settle(s,30000).state;
  assert.equal(s.boss,null);near(s.bossCracks.backyard,.4);assert.equal(s.bossCooldownUntil,60000);assert.deepEqual(s.package,p);
  assert.throws(()=>E.startBoss(s,59999));near(E.startBoss(s,60000).boss.crack,.4);
});
test('round8 boss: no late damage win, victory unlocks once and preserves old package',()=>{
  let s=boss();s.clickLevel=100;const late=E.click(s,30000);assert.equal(late.state.bossWins.length,0);
  const won=E.click(s,1).state;assert.deepEqual(won.bossWins,['backyard']);assert.equal(won.settings.scene,'kitchen');assert.equal(won.freeDraws,5);assert.deepEqual(won.scenePackages.backyard,s.package);near(won.bossCracks.backyard,0);S.validate(won,Pool);
  assert.equal(E.settle(won,2).state.freeDraws,5);
});
test('round8 boss: hide and restart fail immediately, never settle background damage',()=>{
  let s=boss();s.boss.dealt=s.boss.need*.8;s.collection={zhenmu:1};const p=structuredClone(s.package);
  const hidden=E.abandonBoss(s,1000);assert.equal(hidden.boss,null);near(hidden.bossCracks.backyard,.4);assert.deepEqual(hidden.package,p);S.validate(hidden);
  const store=S.create({getItem:()=>JSON.stringify(s)},{now:()=>2000});assert.equal(store.blocked,false);assert.equal(store.state.boss,null);near(store.state.bossCracks.backyard,.4);assert.equal(store.state.bossCooldownUntil,32000);
});
test('round8 boss: kitchen boss rings and recruitment/scene guard, roster allowed',()=>{
  let s=kitchen();s.package.index=201;s=E.startBoss(s,0);s.collection={fox:16};s.skillSlots[0]='fox';
  s.boss.dealt=s.boss.need*.25;s.boss.blocked=100;
  assert.throws(()=>E.purchaseDraw(s,1,0,Pool));assert.throws(()=>E.switchScene(s,'backyard',0));assert.equal(E.equip(s,0,null,0).skillSlots[0],null);
  for(let i=0;i<2;i++) s=E.click(s,0).state;near(s.boss.dealt,s.boss.need*.25);const r=E.click(s,0);assert.equal(r.shellBroken,true);near(r.released,100);
});
test('round8 boss: save rejects forged wins, crack, boss timing and shells',()=>{
  for(const mutate of [s=>s.bossWins=['oops'],s=>s.bossCracks.backyard=.76,s=>s.boss.endsAt++,s=>s.boss.shells=[.8],s=>s.boss.dealt=-1]) {const s=boss();mutate(s);assert.throws(()=>S.validate(s));}
  S.validate(boss());
});
test('round8 rewardMul includes D/P and upgrade preview without double multiplication',()=>{
  const s=kitchen();s.collection={dog:1};const b={...s,settings:{...s.settings,scene:'backyard'}};
  for(const delta of [0,1]) {s.clickLevel=b.clickLevel=delta;near(E.rates(s).D,E.rates(b).D*3);near(E.rates(s).P,E.rates(b).P*3);}
});
test('round8 scene validation, switch roundtrip and free five-draw accounting',()=>{
  const s=S.fresh(0);s.settings.scene='kitchen';assert.throws(()=>S.validate(s));s.bossWins=['backyard'];s.package=E.newPackage('kitchen');S.validate(s);
  s.package.progress=12;s.coins=s.lifetimeCoins=1000;s.freeDraws=5;let t=E.switchScene(s,'backyard',0);t=E.switchScene(t,'kitchen',0);assert.deepEqual(t.package,s.package);near(t.coins,1000);
  t=E.purchaseDraw(t,5,0,Pool,{rng:()=>.9,id:'free',visualSeed:8});assert.equal(t.freeDraws,0);assert.equal(t.paidDraws,0);assert.equal(t.usedFreeDraws,5);near(t.coins,1000);S.validate(t,Pool);
});
