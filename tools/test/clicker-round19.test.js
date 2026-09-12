const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), Pool = require('../../src/gacha-pool.js');
const seed = () => { const s=S.fresh(0); s.collection={yueyue2:1,caihua:1,lk:1}; s.partnerLevels={yueyue2:0,caihua:0,lk:0}; return s; };
const collect = (s,ids) => {
  s.pending={draw:{id:'r19',entries:ids.map(id=>({entry:Pool.byId[id]}))}};
  return E.collect(s,'r19',s.settledAt);
};

test('round19: median pricing ignores one overtrained partner but follows the team', () => {
  const s=seed(), prices=[1,2,3,4,5].map(n=>E.drawCost(s,n));
  s.partnerLevels.lk=150;
  assert.deepEqual([1,2,3,4,5].map(n=>E.drawCost(s,n)),prices);
  s.partnerLevels={yueyue2:20,caihua:20,lk:20};
  assert.ok(E.drawCost(s,1)>prices[0]); assert.ok(E.drawCost(s,5)>prices[4]); assert.equal(E.drawCost(s,0),0);
});
test('round19: default rates retain the original formula and all multipliers', () => {
  const s=seed(); s.dust={yueyue2:40,caihua:1,lk:1}; s.promotions={yueyue2:1}; s.transcend={yueyue2:2};
  s.trainingLevel=2; s.clickLevel=3; s.partnerLevels={yueyue2:10,caihua:2,lk:0}; s.marksClaimed=4; s.deco=['a','b'];
  // Backyard affinity: yueyue2/caihua ×1.5; 5 stars ×2; rare promotion ×1.8; transcend ×1.12.
  const raw=(4*2*1.8*1.12*1.25**2*1.5*22)+(4*1.25**2*1.5*3)+(5*1.25**2);
  const M=1;   // v3：marksClaimed 不再自動加成（markMul 係數 0），只剩收益祝福
  assert.deepEqual(E.rates(s),{P:M*raw*1.02,D:(M*1.15**3+.05*M*raw)*1.02});
  assert.deepEqual(E.rates(s,{}),E.rates(s));
  const uniform=E.clone(s); uniform.partnerLevels={yueyue2:20,caihua:20,lk:20};
  assert.deepEqual(E.rates(s,{partnerLevel:20}),E.rates(uniform));
});
test('round19: median uses recruited partners only, defaults missing levels to zero and takes lower middle', () => {
  assert.equal(E.medianPartnerLevel(S.fresh(0)),0);
  const s=seed(); s.collection.dog=1; s.collection.fox=0; s.partnerLevels={yueyue2:30,caihua:10,lk:20,fox:200};
  assert.equal(E.medianPartnerLevel(s),10); assert.equal(s.partnerLevels.dog,undefined);
});
test('round19: new recruits inherit before insertion, including sequential recruits, with no spending', () => {
  const s=seed(); s.partnerLevels={yueyue2:10,caihua:20,lk:100};
  const r=collect(s,['dog','fox','dog','yang','zhenmu']);
  for(const id of r.newIds) assert.equal(r.state.partnerLevels[id],20);
  assert.equal(r.state.coins,s.coins); assert.equal(r.state.partnerLevels.lk,100);
  assert.deepEqual(r.state.claimedMilestones,s.claimedMilestones);
  assert.deepEqual(s.partnerLevels,{yueyue2:10,caihua:20,lk:100});
  assert.doesNotThrow(()=>S.validate(JSON.parse(JSON.stringify(r.state)),Pool));
});
test('round19: duplicate retains its level even when the median differs', () => {
  const s=seed(); s.partnerLevels={yueyue2:10,caihua:20,lk:100};
  assert.equal(collect(s,['lk']).state.partnerLevels.lk,100);
});
test('round19: first partner starts at zero and a second follows the only partner', () => {
  let s=collect(S.fresh(0),['dog']).state; assert.equal(s.partnerLevels.dog,0);
  s.partnerLevels.dog=50; s=collect(s,['fox']).state; assert.equal(s.partnerLevels.fox,50);
  assert.equal(E.individual(s,'fox'),8*E.partnerMul(50));
  assert.doesNotThrow(()=>S.validate(s,Pool));
});
