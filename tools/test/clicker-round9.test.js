const test=require('node:test'), assert=require('node:assert/strict');
const B=require('../../src/clicker-balance.js'), E=require('../../src/clicker-economy.js'), S=require('../../src/clicker-save.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ~= ${b}`);
const state=ids=>{const s=S.fresh(0);s.lifetimeCoins=1e6;s.collection=Object.fromEntries(ids.map(id=>[id,1]));s.skillSlots=[...ids.slice(0,3),null,null,null].slice(0,3);return s;};
const cases={yueyue2:{multiplier:[2,2.16,2.32],duration:[15,17,19],charges:[10,10,10]},yueyue:{multiplier:[3,3.32,3.64],duration:[12,14,16]},dog:{ratio:[.5,.6,.7],charges:[20,24,28]},fox:{factor:[15,18,21]},lk:{multiplier:[3,3,3],duration:[20,24,28]},yang:{ratio:[.2,.24,.28],duration:[30,34,38]},zhenmu:{copy:[1,1,1.1],duration:[20,24,28]}};
for(const [id,expected] of Object.entries(cases)) test(`skillAt ${B.characters[id].kind}: 1★ / 3★ / 5★`,()=>{
  [1,3,5].forEach((star,i)=>{const p=B.skillAt(id,star);for(const [key,values] of Object.entries(expected)) near(p[key],values[i]);near(p.cd,B.characters[id].cd*[1,.94,.88][i]);assert.equal(typeof p.desc(p),'string');});
  assert.equal(B.characters[id].cd,B.skillAt(id,1).cd);
});
test('transcend interface scales effect and cd, preserves durations',()=>{for(const id of Object.keys(B.characters)){const p=B.skillAt(id,5),q=B.skillAt(id,5,2);near(q.cd,p.cd*.96);const key=['ratio','factor','copy'].find(k=>p[k]!==undefined);if(key) near(q[key],p[key]*1.1);else near(q.multiplier-1,(p.multiplier-1)*1.1);assert.equal(q.duration,p.duration);}});
test('click (2.3 + 13) × 10 = 153',()=>{let s=state(['dog','jiaobu']);s=E.activate(s,0,0).state;s.chain.expiresAt=0;s=E.activate(s,1,0).state;near(E.click(s,0).amount,153);});
test('parasite selects self-buffed lk: 5 + 10 = 15',()=>{let s=state(['lk','zhenmu','dog']);s=E.activate(s,0,0).state;s.chain.expiresAt=0;const r=E.activate(s,1,0);assert.equal(r.effect.target,'lk');near(r.effect.value,15);});
test('team burst (13 + 2.6) × 15 = 234',()=>{let s=state(['yang','fox']);s=E.activate(s,0,0).state;s.chain.expiresAt=0;near(E.activate(s,1,0).effect.value,234);});
test('chain 1 / 1.3 / 1.6, fourth resets; exact expiry resets',()=>{
  let s=state(['dog','yueyue','jiaobu']);const a=E.activate(s,0,0),b=E.activate(a.state,1,300),c=E.activate(b.state,2,700);
  assert.deepEqual([a.effect.chain,b.effect.chain,c.effect.chain],[1,2,3]);near(b.effect.multiplier,3.6);near(c.effect.multiplier,15.4);assert.equal(c.state.chain.expiresAt,8700);
  s=c.state;s.cooldownUntil.dog=0;assert.equal(E.activate(s,0,701).effect.chain,1);
  s=a.state;assert.equal(E.activate(s,1,8000).effect.chain,1);assert.equal(E.activate(s,1,7999).effect.chain,2);
});
test('three collection bonds: charges +1, window 11000, self duration ×1.25',()=>{
  const s=state(Object.keys(B.characters));assert.equal(E.skillAt(s,'jiaobu').charges,2);assert.equal(E.skillAt(s,'dog').charges,21);assert.equal(E.skillAt(s,'lk').duration,25);
  assert.equal(E.activate(s,0,0).state.chain.expiresAt,11000);delete s.collection.jiaobu2;assert.equal(E.skillAt(s,'jiaobu').charges,1);
});
test('scene affinity income ×1.5 and cd ×.8, switching recalculates',()=>{
  let s=state(['caihua','fox']);near(E.individual(s,'caihua'),6);near(E.skillAt(s,'caihua').cd,36);s.bossWins=['backyard'];s=E.switchScene(s,'kitchen',0);
  near(E.individual(s,'caihua'),4);near(E.individual(s,'fox'),12);near(E.skillAt(s,'fox').cd,96);near(E.rates(s).P,48);
});
test('recommendations equip all three, swap existing slots, retain missing and locked slots; 30s wait',()=>{
  for(let index=0;index<3;index++){let s=state(Object.keys(B.characters));s.skillSlots=[...B.recommendations[index].slots].reverse();const r=E.recommend(s,index,0);assert.deepEqual(r.skillSlots,B.recommendations[index].slots);assert.equal(r.slotReadyAt[0],30000);assert.throws(()=>E.activate(r,0,29999));}
  const s=state(['yang','dog','jiaobu']);assert.deepEqual(E.recommend(s,0,0).skillSlots,['yang','dog','jiaobu']);s.lifetimeCoins=0;s.skillSlots=['yang',null,null];assert.deepEqual(E.recommend(s,0,0).skillSlots,s.skillSlots);
  s.lifetimeCoins=1e6;s.collection.yueyue=1;s.skillSlots=['dog','yang','jiaobu'];delete s.collection.jiaobu; s.skillSlots[2]='yueyue';assert.deepEqual(E.recommend(s,0,0).skillSlots,['dog','yang','yueyue']);
});
test('save chain and effect snapshot: valid high stars, old saves, rejects corrupt fields',()=>{
  let s=state(Object.keys(B.characters));s.collection=Object.fromEntries(Object.keys(B.characters).map(id=>[id,16]));s.skillSlots=['lk','dog','zhenmu'];for(let i=0;i<3;i++) s=E.activate(s,i,0).state;S.validate(E.clone(s));
  s.collection.lk=32;s.bossWins=['backyard'];s=E.switchScene(s,'kitchen',0);S.validate(E.clone(s));
  const old=S.fresh(0);delete old.chain;assert.equal(S.validate(old).chain.expiresAt,0);
  for(const chain of [null,{count:0,expiresAt:0},{count:4,expiresAt:0},{count:1.5,expiresAt:0},{count:1,expiresAt:Infinity},{count:1,expiresAt:'8'}]){const bad=S.fresh(0);bad.chain=chain;assert.throws(()=>S.validate(bad));}
  for(const mutate of [s=>s.effects[0].chain=4,s=>s.effects[0].params.duration=999,s=>s.effects[0].params.cd=1]){const bad=E.clone(s);mutate(bad);assert.throws(()=>S.validate(bad));}
});

test('long 5-star effects survive swapping after 30 seconds and four active snapshots save',()=>{
  let s=state(Object.keys(B.characters));s.collection=Object.fromEntries(Object.keys(B.characters).map(id=>[id,16]));s.skillSlots=['lk','zhenzhen2','yang'];
  for(let i=0;i<3;i++) s=E.activate(s,i,0).state;
  s=E.equip(s,0,'zhenzhen',0);s=E.activate(s,0,30000).state;
  assert.equal(s.effects.length,4);S.validate(s);
});
