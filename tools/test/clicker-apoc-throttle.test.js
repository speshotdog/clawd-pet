// 節流（2026-09-16）：重度玩家一天玩三小時第 2 天就到最後一關——把「一天能拿多少」跟天綁。
const test = require('node:test'), assert = require('node:assert');
globalThis.ApocPool = [{ id: 'pufayueyue', name: '玥', rarity: 'rare', role: 'reset' }];
const A = require('../../src/clicker-apoc-economy.js');
const D = A.RULES.DAILY, day = 86400000 * 20000;

test('每日獎金遞減：前 FULL_KILLS 場全額、之後 ×AFTER，隔天重置；王首勝不算場次', () => {
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4 });
  assert.equal(A.dailyMul(a, day), 1);
  a.dailyKills = { day: Math.floor(day / 86400000), count: D.FULL_KILLS - 1 };
  assert.equal(A.dailyMul(a, day), 1, '第 150 場前一場還是全額');
  a.dailyKills.count = D.FULL_KILLS;
  assert.equal(A.dailyMul(a, day), D.AFTER, '到 150 場之後打折');
  assert.equal(A.dailyMul(a, day + 86400000), 1, '隔天回到全額');
  assert.equal(A.killsToday(a, day + 86400000), 0);
});

test('擊殺會累計當天場次，超過上限後金幣照 ×AFTER 入帳', () => {
  const base = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, coins: 0 });
  const won = (a, at) => { a = A.fight({ ...a, progress: 1, stage: null, cooldownUntil: 0 }, at); a.stage.hp = 0; a.stage.wave = a.stage.waves; return A.settle(a, at + 1000, 1, () => 0).state; };
  const r1 = won(base, day); const c1 = r1.coins;
  assert.equal(r1.dailyKills.count, 1); assert.ok(c1 > 0);
  const r2 = won({ ...base, dailyKills: { day: Math.floor(day / 86400000), count: D.FULL_KILLS } }, day + 5000);
  assert.ok(Math.abs(r2.coins - Math.round(c1 * D.AFTER)) <= 1, `打折後 ${r2.coins} ≈ ${c1} × ${D.AFTER}`);
  assert.equal(r2.dailyKills.count, D.FULL_KILLS + 1);
});

test('訓練上限跟站數綁：8 + 4×站數；輪迴過的人上限照 20 站算', () => {
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, coins: 1e15 });
  a.progress = 0; assert.equal(A.trainCap(a), 8);
  a.progress = 19; assert.equal(A.trainCap(a), 8 + 4 * 19);
  const r = A.train(a, 'team', true); assert.equal(r.state.teamLevel, 8 + 4 * 19, '「最多」停在上限');
  assert.throws(() => A.train(r.state, 'team'), /訓練上限/);
  a.laps = 1; a.progress = 0; assert.equal(A.trainCap(a), 8 + 4 * 20, '重走過的人不會被壓回 8 級');
});

test('每天最多推進 STATIONS 站：到頂後 canFight 為 false、fight 丟明確訊息；隔天恢復；刷怪／回顧不受影響', () => {
  const S = A.RULES.DAILY.STATIONS;
  let a = A.normalize({ ...A.gift(A.fresh()), unlocked: true, tutorial: 4, coins: 0 });
  a.dailyAdvance = { day: Math.floor(day / 86400000), count: S };
  a.progress = 5; a.stage = null;
  assert.equal(A.dayCapped(a, day), true); assert.equal(A.canFight(a, day), false);
  assert.throws(() => A.fight(a, day), /明天再往下/);
  assert.equal(A.canFight(a, day + 86400000), true, '隔天恢復');
  const r = A.revisit(a, day, 3, { walk: false }); assert.ok(r.stage, '回顧照常');
});
