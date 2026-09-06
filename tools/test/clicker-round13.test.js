// 第十三輪：輪迴、印記商店、電動手指、夥伴訓練、桌面裝飾
const test = require('node:test'), assert = require('node:assert');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), B = require('../../src/clicker-balance.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
const seed = (over = {}) => { const s = S.fresh(0); Object.assign(s, over); return s; };
const own = (s, id, n = 1) => { s.collection[id] = n; s.dust[id] = n; return s; };
test('印記：floor(sqrt(生涯/1e8)) − 已領；倍率 1+.05×已領', () => {
  const s = seed({ lifetimeCoins: 4e8, coins: 100 }); assert.equal(P.marksTotal(s), 2); assert.equal(P.marksAvailable(s), 2);
  assert.equal(P.canPrestige(seed({ lifetimeCoins: 5e7 })), '生涯收入到 1 億才能換桌布');
  const r = P.prestige(own(s, 'zhenmu', 16), 0); assert.equal(r.gained, 2); assert.equal(r.state.marks, 2); assert.equal(r.state.marksClaimed, 2);
  assert.equal(r.state.coins, 0); assert.equal(r.state.clickLevel, 0); assert.equal(r.state.settings.scene, 'backyard'); assert.equal(r.state.dust.zhenmu, 16); assert.equal(r.state.universalDust, 3);
  assert.ok(Math.abs(E.markMul(r.state) - 1.1) < 1e-9); assert.throws(() => P.prestige(r.state, 0), /沒有可領/);
  S.validate(r.state, Pool);
});
test('倍率進 rates：P 與手勁部分都乘 M，不重複乘', () => {
  const s = own(seed({ marksClaimed: 4, marks: 0, lifetimeCoins: 1e9, coins: 0 }), 'yueyue2', 1);
  const base = own(seed(), 'yueyue2', 1);
  assert.ok(Math.abs(E.rates(s).P / E.rates(base).P - 1.2) < 1e-9); assert.ok(Math.abs(E.rates(s).D / E.rates(base).D - 1.2) < 1e-9);
});
test('印記商店：扣印記、第四槽開一格、離線 12 小時、開局五連', () => {
  let s = seed({ marks: 6, marksClaimed: 6, lifetimeCoins: 36e8 });
  s = P.buyMark(s, 'slot4', 0); assert.equal(s.skillSlots.length, 4); assert.equal(E.slotCount(s), 4); assert.equal(s.marks, 3);
  s = P.buyMark(s, 'offline12', 0); s.settledAt = 0; assert.equal(E.settle(s, 20 * 3600000).duration, 12 * 3600000);
  s = P.buyMark(s, 'starter5', 0); assert.throws(() => P.buyMark(s, 'rooftop', 0), /印記不足/); assert.throws(() => P.buyMark(s, 'slot4', 0), /已經擁有/);
  S.validate(s, Pool);
  const r = P.prestige(Object.assign(own(s, 'zhenmu', 1), { lifetimeCoins: 49e8 }), 0); assert.equal(r.state.freeDraws, 5); assert.equal(r.state.skillSlots.length, 4);
});
test('電動手指：5000×2.2^L、上限 6、每秒 .5L 次帶小數累積、不算手點', () => {
  let s = seed({ coins: 1e9, lifetimeCoins: 1e9 });
  const r = P.buyAutoClick(s, 0, true); assert.equal(r.state.autoClick, 6); assert.equal(r.levels, 6); assert.throws(() => P.buyAutoClick(r.state, 0), /滿級/);
  const t = seed({ autoClick: 1 }); assert.equal(P.autoClicks(t, 1), 0); assert.equal(P.autoClicks(t, 1), 1); assert.ok(Math.abs(t.autoRemainder) < 1e-9);
  const c = E.click(seed(), 0, { auto: true }); assert.equal(c.state.manualClicks, 0); assert.equal(c.state.autoClicks, 1);
});
test('夥伴訓練：50×1.22^L、每級 +5%、里程碑給技能副軸', () => {
  let s = own(seed({ coins: 1e12, lifetimeCoins: 1e12 }), 'yueyue2', 1);
  const before = E.individual(s, 'yueyue2'), sk0 = E.skillAt(s, 'yueyue2');
  s = P.train(s, 'yueyue2', 0).state; assert.ok(Math.abs(E.individual(s, 'yueyue2') / before - 1.05) < 1e-9);
  s = P.train(s, 'yueyue2', 0, true).state; assert.equal(s.partnerLevels.yueyue2, 100);
  const sk = E.skillAt(s, 'yueyue2'); assert.equal(sk.charges, sk0.charges + 1); assert.equal(sk.duration, sk0.duration + 2); assert.ok(Math.abs(sk.cd - sk0.cd * .95) < 1e-9); assert.ok(sk.multiplier > sk0.multiplier);
  assert.throws(() => P.train(s, 'yueyue2', 0), /100 級/); assert.throws(() => P.train(seed(), 'yueyue2', 0), /尚未招募/); S.validate(s, Pool);
});
test('桌面裝飾：max(20000, P×3600)、各 +1%、輪迴保留', () => {
  let s = own(seed({ coins: 1e6, lifetimeCoins: 1e8 }), 'zhenmu', 1); assert.equal(P.decoPrice(s), 57600);
  s = P.buyDeco(s, 'deco0', 0); assert.ok(Math.abs(E.decoMul(s) - 1.01) < 1e-9); assert.throws(() => P.buyDeco(s, 'deco0', 0), /已經擁有/);
  const r = P.prestige(Object.assign(s, { lifetimeCoins: 1e8 }), 0); assert.deepEqual(r.state.deco, ['deco0']); S.validate(r.state, Pool);
});
test('提示：低於巔峰 15% 且有印記可領才提示，一天一次', () => {
  const s = seed({ lifetimeCoins: 1e8 }); assert.equal(P.hint(s, 100, 'd1'), false); assert.equal(P.hint(s, 10, 'd1'), true); assert.equal(P.hint(s, 10, 'd1'), false); assert.equal(P.hint(s, 10, 'd2'), true);
});
