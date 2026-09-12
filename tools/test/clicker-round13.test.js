// 第十三輪：輪迴、印記商店、電動手指、夥伴訓練、桌面裝飾
const test = require('node:test'), assert = require('node:assert');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), B = require('../../src/clicker-balance.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
const seed = (over = {}) => { const s = S.fresh(0); Object.assign(s, over); return s; };
const own = (s, id, n = 1) => { s.collection[id] = n; s.dust[id] = n; return s; };
// v3（2026-09-12）：印記不再是 √生涯幣，改成「本輪做到的事」——大王每隻 1、100／300 包各 1、滅世珍獸 +3，每輪上限 12；
// markMul 係數 0。舊規則的實測後果是 ×76,000（DESIGN-balance-v3 §一）。
test('印記 v3：本輪王勝＋包數里程碑，每輪上限 12；沒打贏王不能換桌布；markMul 係數 0', () => {
  const s = seed({ lifetimeCoins: 4e8, coins: 100 }); assert.equal(P.marksTotal(s), 0);
  assert.equal(P.canPrestige(s), '本輪至少要打贏一隻王才能換桌布');
  s.bossWins = ['backyard','kitchen']; s.runWins = ['backyard','kitchen']; s.runPacks = 120;
  assert.equal(P.marksTotal(s), 3); assert.equal(P.marksAvailable(s), 3);
  const r = P.prestige(own(s, 'zhenmu', 16), 0, () => .5); assert.equal(r.gained, 3); assert.equal(r.state.marks, 3); assert.equal(r.state.marksClaimed, 3);
  assert.equal(r.state.coins, 0); assert.equal(r.state.clickLevel, 0); assert.equal(r.state.settings.scene, 'backyard'); assert.equal(r.state.dust.zhenmu, 16); assert.equal(r.state.universalDust, 3);
  assert.deepEqual(r.state.runWins, []); assert.equal(r.state.runPacks, 0); assert.deepEqual(r.state.bossWins, ['backyard','kitchen']);   // 永久解鎖留著，本輪紀錄清掉
  assert.equal(r.state.champions.length, 1);   // 只擁有 1 張就只有 1 個當家
  assert.equal(E.markMul(r.state), 1);
  assert.throws(() => P.prestige(r.state, 0), /至少要打贏/);
  S.validate(r.state, Pool);
  const full = seed({ bossWins: ['backyard','kitchen','market','factory','nightmarket','fridge','city'], runWins: ['backyard','kitchen','market','factory','nightmarket','fridge','city'], runPacks: 400 });
  assert.equal(P.marksTotal(full), 12);   // 7 + 1 + 1 + 3 = 12 剛好封頂
});
test('倍率進 rates：只剩收益祝福，marksClaimed 不再自動加成；本輪當家 ×1.5', () => {
  const s = own(seed({ marksClaimed: 4, marks: 0, lifetimeCoins: 1e9, coins: 0 }), 'yueyue2', 1);
  const base = own(seed(), 'yueyue2', 1);
  assert.ok(Math.abs(E.rates(s).P / E.rates(base).P - 1) < 1e-9);
  s.champions = ['yueyue2'];
  assert.ok(Math.abs(E.rates(s).P / E.rates(base).P - 1.5) < 1e-9);
  assert.ok(Math.abs(E.skillAt(s,'yueyue2').cd / E.skillAt(base,'yueyue2').cd - .8) < 1e-9);
});
test('印記商店：扣印記、第四槽開一格、離線 12 小時、開局五連', () => {
  let s = seed({ marks: 6, marksClaimed: 6, lifetimeCoins: 36e8 });
  s = P.buyMark(s, 'slot4', 0); assert.equal(s.skillSlots.length, 4); assert.equal(E.slotCount(s), 4); assert.equal(s.marks, 3);
  s = P.buyMark(s, 'offline12', 0); s.settledAt = 0; assert.equal(E.settle(s, 20 * 3600000).duration, 12 * 3600000);
  s = P.buyMark(s, 'starter5', 0); assert.throws(() => P.buyMark(s, 'rooftop', 0), /印記不足/); assert.throws(() => P.buyMark(s, 'slot4', 0), /已經擁有/);
  S.validate(s, Pool);
  const r = P.prestige(Object.assign(own(s, 'zhenmu', 1), { lifetimeCoins: 49e8, bossWins: ['backyard'], runWins: ['backyard'] }), 0); assert.equal(r.state.freeDraws, 5); assert.equal(r.state.skillSlots.length, 4);
});
test('電動手指：5000×2.2^L、上限 10、每秒 .5L 次帶小數累積、不算手點', () => {
  let s = seed({ coins: 1e9, lifetimeCoins: 1e9 });
  const r = P.buyAutoClick(s, 0, true); assert.equal(r.state.autoClick, 10); assert.equal(r.levels, 10); assert.throws(() => P.buyAutoClick(r.state, 0), /滿級/);
  const t = seed({ autoClick: 1 }); assert.equal(P.autoClicks(t, 1), 0); assert.equal(P.autoClicks(t, 1), 1); assert.ok(Math.abs(t.autoRemainder) < 1e-9);
  const c = E.click(seed(), 0, undefined, { auto: true }); assert.equal(c.state.manualClicks, 0); assert.equal(c.state.autoClicks, 1);
});
test('夥伴訓練：200×base×1.15^L（里程碑級不加價，2026-09-08）、每級 +1 倍、10/25/50/100 收益 ×2、25/50/75/100 給技能副軸', () => {
  let s = own(seed({ coins: 1e18, lifetimeCoins: 1e18 }), 'yueyue2', 1);
  const before = E.individual(s, 'yueyue2'), sk0 = E.skillAt(s, 'yueyue2');
  assert.equal(P.trainCost(0, 'yueyue2'), 800); assert.equal(P.trainCost(9, 'yueyue2'), Math.ceil(800 * 1.15 ** 9)); assert.equal(P.trainCost(0, 'zhenzhen'), 4000);
  assert.deepEqual([0, 1, 9, 10, 25, 100].map(E.partnerMul), [1, 2, 10, 22, 104, 1616]);
  s = P.train(s, 'yueyue2', 0).state; assert.ok(Math.abs(E.individual(s, 'yueyue2') / before - 2) < 1e-9);
  s = P.train(s, 'yueyue2', 0, true).state; assert.equal(s.partnerLevels.yueyue2, 200);
  const sk = E.skillAt(s, 'yueyue2'); assert.equal(sk.charges, sk0.charges + 1); assert.equal(sk.duration, sk0.duration + 2); assert.ok(Math.abs(sk.cd - sk0.cd * .95) < 1e-9); assert.ok(sk.multiplier > sk0.multiplier);
  assert.throws(() => P.train(s, 'yueyue2', 0), /200 級/); assert.throws(() => P.train(seed(), 'yueyue2', 0), /尚未招募/); S.validate(s, Pool);
});
test('桌面裝飾：50000×1.5^擁有數、各 +1%、輪迴保留', () => {
  let s = own(seed({ coins: 1e6, lifetimeCoins: 1e8 }), 'zhenmu', 1); assert.equal(P.decoPrice(s), 50000);
  assert.equal(P.decoPrice(seed({ trainingLevel: 50 })), 50000);
  assert.equal(P.decoPrice(seed({ deco: Array.from({ length: 9 }, (_, i) => `deco${i}`) })), 1922168);
  assert.throws(() => P.buyDeco(seed({ coins: 49999 }), 'deco0', 0), /餘額不足/);
  s = P.buyDeco(s, 'deco0', 0); assert.equal(s.coins, 950000); assert.equal(P.decoPrice(s), 75000); assert.ok(Math.abs(E.decoMul(s) - 1.01) < 1e-9); assert.throws(() => P.buyDeco(s, 'deco0', 0), /已經擁有/);
  const r = P.prestige(Object.assign(s, { lifetimeCoins: 1e8, bossWins: ['backyard'], runWins: ['backyard'] }), 0); assert.deepEqual(r.state.deco, ['deco0']); S.validate(r.state, Pool);
});
test('提示：低於巔峰 15% 且有印記可領才提示，一天一次', () => {
  const s = seed({ lifetimeCoins: 1e8 }); assert.equal(P.hint(s, 100, 'd1'), false);   // v3：還沒打贏王（canPrestige 非空）照樣提示，提示只是「該想辦法了」 assert.equal(P.hint(s, 10, 'd1'), true); assert.equal(P.hint(s, 10, 'd1'), false); assert.equal(P.hint(s, 10, 'd2'), true);
});
