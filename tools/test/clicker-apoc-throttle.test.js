// 2026-09-16：訓練上限跟站數綁（留著）；每日站數／每日獎金／每日抽卡加價全部撤掉（使用者：「是不好的設計」），這裡鎖住它們是關的。
const test = require('node:test'), assert = require('node:assert');
globalThis.ApocPool = [{ id: 'pufayueyue', name: '玥', rarity: 'rare', role: 'reset' }];
const A = require('../../src/clicker-apoc-economy.js');
const day = 86400000 * 20000;

test('訓練上限跟站數綁：8 + 4×站數；輪迴過的人上限照 20 站算', () => {
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, coins: 1e15 });
  a.progress = 0; assert.equal(A.trainCap(a), 8);
  a.progress = 19; assert.equal(A.trainCap(a), 8 + 4 * 19);
  const r = A.train(a, 'team', true); assert.equal(r.state.teamLevel, 8 + 4 * 19, '「最多」停在上限');
  assert.throws(() => A.train(r.state, 'team'), /訓練上限/);
  a.laps = 1; a.progress = 0; assert.equal(A.trainCap(a), 8 + 4 * 20, '重走過的人不會被壓回 8 級');
});

test('每日節流全部關著：站數不設限、獎金不打折、抽卡不加價', () => {
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, coins: 1e12 });
  a.dailyAdvance = { day: Math.floor(day / 86400000), count: 999 }; a.dailyKills = { day: Math.floor(day / 86400000), count: 99999 }; a.dailyDraws = { day: Math.floor(day / 86400000), count: 99999 };
  a.progress = 5; a.stage = null;
  assert.equal(A.dayCapped(a, day), false); assert.equal(A.canFight(a, day), true);
  assert.equal(A.dailyMul(a, day), 1);
  assert.equal(A.drawCost(a, 10, day), A.drawCost({ ...a, dailyDraws: { day: null, count: 0 } }, 10, day), '抽卡價跟當天抽了幾次無關');
});

test('輪迴：血每圈 ×1.39、戰力每圈只 +5%、上限 20 圈、印記只算前 10 圈、每圈送 10 券', () => {
  const R = A.RULES.LAP;
  assert.equal(R.MAX, 20); assert.equal(R.MARK_LAPS, 10); assert.equal(R.HP_GROWTH, 1.39); assert.equal(R.POWER, .05);
  assert.ok(Math.abs(A.lapHp({ laps: 10 }) - 10 * 1.39 ** 9) < 1e-9); assert.ok(Math.abs(A.lapPower({ laps: 10 }) - 1.5) < 1e-9);
  assert.equal(A.RULES.LOOP.TICKETS, 10);
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, laps: 3, tickets: 0, progress: 19, stage: null });
  a = A.fight(a, day); a.stage.hp = 0; a.stage.wave = a.stage.waves;
  const r = A.settle(a, day + 1000, 1, () => 0).state;
  assert.equal(r.cleared, true); assert.equal(r.tickets, 10, '第 3 圈打完送 10 券');
});
