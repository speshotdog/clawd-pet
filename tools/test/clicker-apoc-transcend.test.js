const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../../src/apoc/pool.js');
const A = require('../../src/clicker-apoc-economy.js');
const id = ApocPool[0].id;
const state = (laps = 0, dust = 87, level = 5) => A.normalize({ collection: {[id]: 1}, dust: {[id]: dust}, transcend: {[id]: level}, laps });

test('兩種滿養：22 與 87，前五級語意不變', () => {
  assert.equal(A.fullDust(), 22); assert.equal(A.fullDustLoop(), 87);
  assert.deepEqual(A.RULES.GROW.TRANSCEND, [2,2,3,3,4,8,10,12,15,20]);
  const a=state(); assert.equal(A.isMaxed(a,id), true); assert.equal(A.isFullyMaxed(a,id), false);
  const b=state(10,87,10); assert.equal(A.isMaxed(b,id), true); assert.equal(A.isFullyMaxed(b,id), true);
  assert.equal(A.cardPower(b,id)/A.cardPower(state(10,87,0),id), 2);
});
test('第 6～10 級各自鎖圈；cost 仍回數字；autoGrow 不越鎖', () => {
  for (let level=5;level<10;level++) {
    const lap=A.RULES.GROW.TRANSCEND_LAP[level], a=state(lap-1,87,level);
    assert.equal(A.transcendCost(a,id), A.RULES.GROW.TRANSCEND[level]);
    assert.equal(A.canTranscend(a,id), false); assert.deepEqual(A.autoGrow(a,[id]), []);
    assert.throws(()=>A.transcend(a,id)); a.laps=lap;
    assert.equal(A.canTranscend(a,id), true);
    const before=A.availableDust(a,id), b=A.transcend(a,id);
    assert.equal(A.availableDust(b,id),before-A.transcendCost(a,id));
    assert.equal(A.dustOf(b,id),87); assert.equal(A.transcendOf(a,id),level);
    A.autoGrow(a,[id]); assert.equal(A.transcendOf(a,id),level+1);
  }
});
test('粉塵罐不買圈數鎖住的等級，解鎖後補 8 顆升六級', () => {
  const a={...state(0,22),universalDust:1000};
  assert.equal(A.exchangeCapacity(a,id),0); assert.throws(()=>A.exchangeDust(a,id));
  const b=A.exchangeDust({...a,laps:2},id,8).state;
  assert.equal(A.transcendOf(b,id),6); assert.equal(A.dustOf(b,id),30);
  assert.equal(b.universalDust,1000-8*A.dustRate(id));
  assert.throws(()=>A.exchangeDust(b,id));
});
test('normalize 夾十級且保留舊印記紀錄；重跑不重發', () => {
  const a=state(10,87,999); assert.equal(A.transcendOf(a,id),10);
  const old={...state(0,22),marksGiven:{boss:[],cleared:false,collected:false,maxed:true,laps:0}};
  const b=A.normalize(old); assert.equal(b.marksGiven.maxed,true);
  assert.equal(A.markMilestones(b).state.marksGiven.maxed,true);
  assert.equal(A.transcendOf(A.normalize({...old,laps:undefined}),id),5);
});
test('全卡十級只增加輪迴滿養計數，不重發五級印記或新增印記', () => {
  const a=A.normalize({
    laps:10, collection:Object.fromEntries(ApocPool.map(c=>[c.id,1])),
    dust:Object.fromEntries(ApocPool.map(c=>[c.id,87])),
    transcend:Object.fromEntries(ApocPool.map(c=>[c.id,10])),
    marksGiven:{boss:[],cleared:true,collected:true,maxed:true,laps:10}
  });
  assert.equal(A.view(a,0).fullyMaxed,75);
  assert.equal(A.markMilestones(a).gained,0);
  assert.equal(A.RULES.MARKS.MAXED,10);
});
test('第 10 圈第 88 顆折萬用；第 0 圈第 23 顆就折（溢出界＝目前圈數允許的上限）；遷移冪等', () => {
  const z=state(0,22), zb=A.addCards(z,[id,id]);
  assert.equal(A.dustOf(zb,id),22); assert.equal(zb.universalDust,2*A.dustRate(id));
  const a=state(10,86), b=A.addCards(a,[id,id,id]);
  assert.equal(A.dustOf(b,id),87); assert.equal(A.transcendOf(b,id),10);
  assert.equal(b.universalDust,2*A.dustRate(id));
  const c=A.normalize({...a,dust:{[id]:90}});
  assert.equal(A.dustOf(c,id),87); assert.equal(c.universalDust,3*A.dustRate(id));
  assert.equal(A.normalize(c).universalDust,c.universalDust);
});
