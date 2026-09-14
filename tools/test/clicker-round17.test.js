const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../../src/clicker-balance.js'), E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), P = require('../../src/clicker-prestige.js'), X = require('../../src/clicker-extras.js'), Pool = require('../../src/gacha-pool.js');
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-8 * Math.max(1,a,b), `${a} != ${b}`);
const seed = () => { const s=S.fresh(0); s.collection.yueyue2=1; s.dust.yueyue2=1; return s; };
const marked = id => { const s=seed(); s.marks=20; s.marksClaimed=20; return P.buyMark(s,id,0); };
// 第二十二輪：終點站從冰箱移到滅世都市。打贏大冰磚會解鎖並自動切到第七站，
// 可重複挑戰＋冷卻＋獎勵只發一次的規則也跟著搬到滅世珍獸身上。
test('round17/22: fridge unlocks at 100, winning it opens 滅世都市 and switches there', () => {
 let s=seed(); s.settings.scene='fridge'; s.bossWins=['backyard','kitchen','market','factory','nightmarket']; s.package=E.newPackage('fridge',100);
 assert.equal(E.canBoss(s,0),false); s.package.index=101; assert.equal(E.canBoss(s,0),true);
 s=E.startBoss(s,0); S.validate(s,Pool); s.boss.dealt=s.boss.need-1; s.clickLevel=10;
 s=E.click(s,0).state; assert.ok(s.bossWins.includes('fridge')); assert.equal(s.freeDraws,5); assert.equal(s.universalDust,3);
 assert.ok(X.BADGES.find(b=>b.id==='boss-fridge').test(s)); S.validate(s,Pool);
 assert.equal(s.settings.scene,'city','打贏大冰磚要自動進滅世都市');
 assert.equal(E.canBoss(s,0),false,'第七站要先拆滿 110 包才能挑戰滅世珍獸');
});
test('round22: 滅世珍獸是可重複挑戰的終點王，冷卻照舊、獎勵只發一次', () => {
 let s=seed(); s.settings.scene='city'; s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge'];
 s.package=E.newPackage('city',110); assert.equal(E.canBoss(s,0),false);
 s.package.index=111; assert.equal(E.canBoss(s,0),true);
 s=E.startBoss(s,0); S.validate(s,Pool); s.boss.dealt=s.boss.need-1; s.clickLevel=10;
 s=E.click(s,0).state; assert.ok(s.bossWins.includes('city')); assert.equal(s.freeDraws,5); assert.equal(s.universalDust,3);
 assert.equal(s.settings.scene,'city','終點站打贏不切場景');
 assert.equal(E.canBoss(s,29999),false,'冷卻 30 秒內不能重打');
 s=E.startBoss(s,30000); S.validate(s,Pool); s.boss.dealt=s.boss.need-1; s=E.click(s,30000).state;
 assert.equal(s.freeDraws,5); assert.equal(s.universalDust,3);
});
test('round17: four PNG cards, skill snapshots, old save fields and equipped trait scaling', () => {
 assert.equal(Object.keys(B.characters).length,52);
 for (const id of ['jiaotou','jinggou','gebugou','zhenjpg']) { const s=seed(); s.collection[id]=1; s.skillSlots[0]=id; assert.equal(Pool.byId[id].src,`card-${id}.png`); S.validate(E.activate(s,0,0).state,Pool); assert.equal(S.validate(seed(),Pool).dust[id],0); }
 const s=seed(); s.collection.jiaotou=16; s.dust.jiaotou=16; const base=E.rates(s); s.skillSlots[0]='jiaotou'; near(E.rates(s).D/base.D,1.9); assert.equal(E.rates(s).P,base.P);
 s.transcend.jiaotou=3; assert.equal(E.skillAt(s,'jiaotou').trait.clickMul,2.05); assert.equal(B.characters.jiaotou.trait.clickMul,1.5);
 s.dust.jiaotou=1; s.transcend.jiaotou=0; assert.equal(E.skillAt(s,'jiaotou').trait.clickMul,1.5);
});
test('印記重設計：退役項目載入時原價退回、電動手指壓回 10；daily 獎勵回 1', () => {
 let s=seed(); s.markShop={finger14:true}; s.marks=0; s.marksClaimed=3; s.coins=s.lifetimeCoins=1e10; s.autoClick=14;   // 舊存檔：買過退役的 finger14（商店已經沒有它，不能用 buyMark）
 const claimed=s.marksClaimed; const v=S.validate(s,Pool);
 assert.equal(v.markShop.finger14,undefined,'退役鍵刪掉'); assert.equal(v.marks,3,'原價 3 退回'); assert.equal(v.marksClaimed,claimed,'累計不動'); assert.equal(v.autoClick,10,'上限回 10'); assert.equal(v.markRefunds,3);
 assert.equal(B.autoClickCap(v),10); assert.equal(B.autoClickMax,10);
 const d=seed(); d.markShop={daily2:true}; d.marksClaimed=2; const rolled=X.dailyRoll(S.validate(d,Pool)); const r=X.dailyBurst(rolled,rolled.daily.need).state; assert.equal(r.freeDraws,1); assert.equal(r.universalDust,1);
});
test('round17: bossTime adds ten seconds while capacity HP stays fixed', () => {
 const s=marked('bossTime'); s.package.index=51; const a=E.startBoss(s,0); delete s.markShop.bossTime; const b=E.startBoss(s,0);
 assert.equal(a.boss.endsAt,40000); assert.equal(b.boss.endsAt,30000); assert.equal(a.boss.need,b.boss.need); S.validate(a,Pool);
});
test('round17: thief cadence, entry delay, five hits, coins only and no repeat reward', () => {
 const opts={rng:()=>0}; let s=E.settle(seed(),0,opts).state; s=E.settle(s,59999,opts).state; assert.equal(s.thief.active,false);
 s=E.settle(s,60000,opts).state; assert.equal(s.thief.active,true); assert.equal(E.thiefHit(s,60000).state.thief.hits,0);
 s=E.settle(s,60600).state; const pack=E.clone(s.package), coins=s.coins, expected=E.rates(s).P*20;
 for(let i=0;i<4;i++) { const r=E.thiefHit(s,60600); assert.equal(r.reward,0); s=r.state; }
 const r=E.thiefHit(s,60600); assert.equal(r.reward,expected); assert.equal(r.state.coins-coins,expected); assert.deepEqual(r.state.package,pack); assert.equal(E.thiefHit(r.state,60600).reward,0); S.validate(r.state,Pool);
});
test('round17: thief expires without penalty, never appears offline/hidden/boss and is not persisted', () => {
 let s=E.settle(seed(),60000,{rng:()=>0}).state; assert.equal(s.thief.active,true);
 const ordinary=E.clone(s); delete ordinary.thief;
 const expired=E.settle(s,72600,{rng:()=>0}); assert.equal(expired.state.thief.active,false); assert.equal(expired.state.coins,E.settle(ordinary,72600).state.coins);
 for (const opts of [{offline:true},{visible:false}]) assert.equal(E.settle(s,120000,opts).state.thief,undefined);
 s.package=E.newPackage('backyard',51); s=E.startBoss(s,60000); assert.equal(s.thief,undefined);
 let raw; const store=S.create({getItem:()=>null,setItem:(k,v)=>raw=v},{now:()=>0,pool:Pool}); assert.ok(store.commit(E.settle(seed(),0).state)); assert.equal(JSON.parse(raw).thief,undefined); assert.ok(store.state.thief);
});
