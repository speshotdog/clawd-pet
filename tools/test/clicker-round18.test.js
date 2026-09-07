const test = require('node:test'), assert = require('node:assert/strict');
const B = require('../../src/clicker-balance.js'), E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), P = require('../../src/clicker-prestige.js');
const seed = () => { const s = S.fresh(0); s.collection = { yueyue2:1, caihua:1, lk:1 }; s.partnerLevels = { yueyue2:0, caihua:0, lk:10 }; return s; };

test('round18: low levels buy first and rounds spend the exact affordable budget without mutating input', () => {
  const s = seed(); s.coins = P.trainCost(0,'yueyue2') + P.trainCost(0,'caihua') + P.trainCost(1,'yueyue2');
  const before = E.clone(s), r = P.trainAll(s,0);
  assert.deepEqual(r.perPartner,{yueyue2:2,caihua:1}); assert.equal(r.levels,3);
  assert.equal(r.state.partnerLevels.lk,10); assert.equal(r.spent,s.coins); assert.equal(r.state.coins,0); assert.deepEqual(s,before);
});
test('round18: insufficient coins throws', () => {
  const s = seed(); s.coins = 0; assert.throws(() => P.trainAll(s,0), /餘額不足/);
});
test('round18: skips capped and unowned partners and unaffordable purchases', () => {
  const s = seed(); s.partnerLevels = {yueyue2:200,caihua:1,lk:0}; s.coins = P.trainCost(1,'caihua');
  const r = P.trainAll(s,0); assert.deepEqual(r.perPartner,{caihua:1}); assert.equal(r.state.partnerLevels.yueyue2,200);
  assert.equal(r.state.partnerLevels.lk,0); assert.equal(r.levels,1);
});
test('round18: stops at 500 levels even with abundant coins', () => {
  const s = seed(); s.coins = 1e100; const r = P.trainAll(s,0);
  assert.equal(r.levels,500); assert.equal(Object.values(r.perPartner).reduce((a,b)=>a+b,0),500);
  assert.ok(Object.values(r.state.partnerLevels).every(n=>n<=200));
});
test('round18: crossing skill milestones matches individual training', () => {
  for (const id of Object.keys(B.characters)) for (const milestone of [25,50,75,100,200]) {
    const s = S.fresh(0); s.collection = {[id]:1}; s.partnerLevels = {[id]:milestone-1}; s.coins = P.trainCost(milestone-1,id);
    const r = P.trainAll(s,0), single = P.train(s,id,0);
    assert.equal(r.state.partnerLevels[id],milestone); assert.deepEqual(E.skillAt(r.state,id),E.skillAt(single.state,id));
    assert.equal(E.individual(r.state,id),E.individual(single.state,id));
  }
});
