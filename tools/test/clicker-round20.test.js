const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
const seed = () => { const s=S.fresh(0); s.collection={lk:1}; s.partnerLevels={lk:3}; s.marks=s.marksClaimed=30; return s; };

test('round20: five costs 135 seconds, training pricing has half the exponent', () => {
  const s=seed(); s.marks=s.marksClaimed=0;
  const price=E.drawCost(s,5), rate=E.rates(s), individual=E.individual(s,'lk');
  assert.equal(price,2700); assert.equal(E.DRAW_SECONDS.single,30);
  s.trainingLevel=4;
  assert.equal(E.drawCost(s,5),Math.ceil(price*1.25**2));
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
// 2026-09-08：粉塵兌換從「固定 1 印記換 5 粉塵」改成遞增價（第 n 次要 n 印記）。
// 招募券仍是固定價，所以這條同時守著「一個改了、另一個沒被順手改掉」。
test('round20: repeat dust and tickets account for marks and balances', () => {
  let s=seed();
  s=P.tradeDust(s);        // 第 1 次：1 印記
  s=P.tradeDust(s,5);      // 第 2~6 次：2+3+4+5+6 = 20 印記
  s=P.buyDrawTicket(s,2);  // 固定 2 印記 ×2 = 4
  assert.equal(s.marks,30-1-20-4); assert.equal(s.universalDust,30); assert.equal(s.dustTrades,6);
  assert.equal(s.freeDraws,10);
  assert.equal(s.marksClaimed,30); S.validate(s,Pool);
  s=E.purchaseDraw(s,1,0,Pool,{id:'free',rng:()=>.5}); assert.equal(s.freeDraws,9); assert.equal(s.coins,0);
});
test('round20: 粉塵兌換是遞增價，買得越多下一次越貴', () => {
  const s=seed();
  assert.equal(P.dustTradeCost(s,1),1);
  assert.equal(P.dustTradeCost(s,10),55);           // 1+2+...+10
  const t={...s, dustTrades:10};
  assert.equal(P.dustTradeCost(t,1),11);            // 第 11 次要 11 印記
  assert.equal(P.dustTradeCost(t,5),11+12+13+14+15);
  // 形狀才是重點：湊滿一張神話（1600 粉塵＝320 次）舊制只要 320 印記，新制要五萬多
  assert.equal(P.dustTradeCost(s,320), 320*321/2);
  assert.ok(P.dustTradeCost(s,320) > 320 * 100, '遞增價必須遠高於舊的固定價，否則等於沒改');
  // 印記不夠就要擋下來，而且不可以動到原本的狀態
  const poor={...seed(), marks:5, marksClaimed:5}, before=E.clone(poor);
  assert.throws(()=>P.tradeDust(poor,5),/印記不足/);   // 第 1~5 次要 15 印記
  assert.deepEqual(poor,before);
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
