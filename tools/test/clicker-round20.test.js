const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
const seed = () => { const s=S.fresh(0); s.collection={lk:1}; s.partnerLevels={lk:3}; s.marks=s.marksClaimed=30; return s; };

test('round20: five costs 80 seconds, training pricing has half the exponent', () => {
  const s=seed(); s.marks=s.marksClaimed=0;
  const price=E.drawCost(s,5), rate=E.rates(s), individual=E.individual(s,'lk');
  assert.equal(price,1600); assert.equal(E.DRAW_SECONDS.single,30);
  s.trainingLevel=4;
  assert.equal(E.drawCost(s,5),price*1.25**2);
  assert.equal(E.rates(s).P,rate.P*1.25**4);
  assert.equal(E.individual(s,'lk'),individual*1.25**4);
  assert.deepEqual(E.rates(s,{trainingLevel:0}),rate);
  assert.equal(s.trainingLevel,4);
});
test('round20: three blessings cost six marks and multiply P and D by 1.3', () => {
  let s=seed(); const before=E.clone(s), rates=E.rates(s);
  for(let i=0;i<3;i++) s=P.buyBlessing(s);
  assert.equal(s.marks,24); assert.equal(s.blessing,3); assert.equal(before.marks,30);
  assert.equal(E.rates(s).P,rates.P*1.3); assert.equal(E.rates(s).D,rates.D*1.3);
  assert.equal(E.markMul(s),E.markMul(before)); S.validate(s,Pool);
});
test('round20: repeat dust and tickets account for marks and balances', () => {
  let s=seed(); s=P.tradeDust(s); s=P.tradeDust(s,10); s=P.buyDrawTicket(s,2);
  assert.equal(s.marks,15); assert.equal(s.universalDust,55); assert.equal(s.freeDraws,10);
  assert.equal(s.marksClaimed,30); S.validate(s,Pool);
  s=E.purchaseDraw(s,1,0,Pool,{id:'free',rng:()=>.5}); assert.equal(s.freeDraws,9); assert.equal(s.coins,0);
});
test('round20: insufficient marks and invalid quantities reject without mutation', () => {
  const s=S.fresh(0), before=E.clone(s);
  for(const buy of [P.buyBlessing,P.tradeDust,P.buyDrawTicket]) assert.throws(()=>buy(s),/印記不足/);
  for(const buy of [P.tradeDust,P.buyDrawTicket]) for(const n of [0,-1,.5,NaN,Infinity]) assert.throws(()=>buy(s,n),/數量/);
  assert.deepEqual(s,before);
});
test('round20: new save fields migrate and validate, including blessing spending', () => {
  const s=seed(); delete s.blessing; delete s.peakRateStamp; S.validate(s,Pool);
  assert.equal(s.blessing,0); assert.equal(s.peakRateStamp,0);
  for(const field of ['blessing','peakRateStamp']) for(const value of [-1,.5,Infinity,'4']) assert.throws(()=>S.validate({...s,[field]:value},Pool));
  assert.throws(()=>S.validate({...s,blessing:8},Pool),/印記商店/);
  assert.throws(()=>S.validate({...s,peakRateStamp:2},Pool),/關卡/);
});
test('round20: prestige retains blessing and clears the rate stamp', () => {
  let s=seed(); s=P.buyBlessing(s); s.lifetimeCoins=1e12; s.peakRateStamp=4; s.peakRate=12000;
  s=P.prestige(s,0).state;
  assert.equal(s.blessing,1); assert.equal(s.peakRateStamp,0); assert.equal(s.peakRate,0); S.validate(s,Pool);
});
