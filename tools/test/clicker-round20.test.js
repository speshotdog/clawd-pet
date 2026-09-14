const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
// v3：夥伴訓練成長旋鈕 PARTNER_G 預設 1.02（兩週日曆掃描定的）；這幾條測的是 v2 的基礎公式，把旋鈕歸 1 再量
require('../../src/clicker-balance.js').V3.PARTNER_G = 1;
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
// v3（2026-09-12）：招募券停售（印記換免費抽等於把卡池買下來）。
// 第十一輪（2026-09-14）：**粉塵兌換也一起停售**（使用者：「我希望印記商店的粉塵兌換也移除」）——
// 理由同招募券，印記產出是 √生涯收入，留這條路等於可以把卡池買下來。
test('round20: 印記商店的粉塵兌換與招募券都已停售', () => {
  const s=seed(), before=E.clone(s);
  assert.throws(()=>P.tradeDust(s),/停售/);
  assert.throws(()=>P.tradeDust(s,5),/停售/);
  assert.throws(()=>P.buyDrawTicket(s,2),/停售/);
  assert.deepEqual(s,before,'停售的東西不可以動到狀態');
  // 舊存檔的 dustTrades 仍要通過驗證（marksClaimed 的對帳要用）
  const old={...seed(), dustTrades:6, marks:30-21, universalDust:30};
  S.validate(old,Pool);
});
test('round20/v3: blessing caps at Lv.20 (×3.0)', () => {
  let s=seed(); s.marks=s.marksClaimed=300;
  for(let i=0;i<20;i++) s=P.buyBlessing(s);
  assert.equal(s.blessing,20); assert.equal(s.marks,300-210); assert.equal(E.blessMul(s),3);
  assert.throws(()=>P.buyBlessing(s),/滿級/); S.validate(s,Pool);
  assert.throws(()=>S.validate({...s,blessing:21},Pool),/收益祝福/);
});
test('round20: dustTradeCost 留著給舊存檔對帳（停售之後仍要算得出已花掉的印記）', () => {
  const s=seed();
  assert.equal(P.dustTradeCost(s,1),1);
  assert.equal(P.dustTradeCost(s,10),55);           // 1+2+...+10
  const t={...s, dustTrades:10};
  assert.equal(P.dustTradeCost(t,1),11);            // 第 11 次要 11 印記
  assert.equal(P.dustTradeCost(t,5),11+12+13+14+15);
});
test('round20: insufficient marks and invalid quantities reject without mutation', () => {
  const s=S.fresh(0), before=E.clone(s);
  assert.throws(()=>P.buyBlessing(s),/印記不足/);
  assert.throws(()=>P.tradeDust(s),/停售/);
  // 粉塵兌換停售之後，任何數量都是「停售」——數量檢查已經沒有東西可以擋了
  for(const n of [0,-1,.5,NaN,Infinity]) assert.throws(()=>P.tradeDust(s,n),/停售/);
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
  let s=seed(); s=P.buyBlessing(s); s.lifetimeCoins=1e12; s.peakRateStamp=4; s.peakRate=12000; s.bossWins=['backyard']; s.runWins=['backyard'];
  s=P.prestige(s,0).state;
  assert.equal(s.blessing,1); assert.equal(s.peakRateStamp,0); assert.equal(s.peakRate,0); S.validate(s,Pool);
});
