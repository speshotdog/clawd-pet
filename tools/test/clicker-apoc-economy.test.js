// v3 末世經濟純邏輯（2026-09-13）
const test = require('node:test');
const assert = require('node:assert');
globalThis.ApocPool = [
  { id: 'pufayueyue', name: '普發玥玥', rarity: 'rare' }, { id: 'm1', name: 'M1', rarity: 'mythic' }, { id: 'm2', name: 'M2', rarity: 'mythic' }, { id: 'm3', name: 'M3', rarity: 'mythic' },
  { id: 'l1', name: 'L1', rarity: 'legendary' }, { id: 'e1', name: 'E1', rarity: 'epic' },
];
require('../../src/clicker-apoc-economy.js');
const A = globalThis.ApocEconomy, R = A.RULES;

test('開門禮：普發玥玥入隊＋10 券，只給一次', () => {
  const a = A.gift(A.fresh());
  assert.equal(a.tickets, 10); assert.equal(a.collection.pufayueyue, 1); assert.deepEqual(a.roster, ['pufayueyue']);
  assert.equal(A.gift(a).tickets, 10);
});
test('戰力：四階 100/85/72/60，重複升星 +25%', () => {
  let a = A.gift(A.fresh()); a = A.drawn({ ...a, tickets: 3 }, ['m1', 'pufayueyue', 'e1']);
  assert.equal(a.tickets, 0); assert.equal(a.collection.pufayueyue, 2);
  assert.equal(A.cardPower(a, 'pufayueyue'), 75); assert.equal(A.power(a), 100 + 75 + 72);
});
test('抽到的卡自動入隊但不超過階級上限', () => {
  let a = A.gift(A.fresh()); a = A.drawn({ ...a, tickets: 3 }, ['m1', 'm2', 'm3']);
  assert.deepEqual(a.roster, ['pufayueyue', 'm1', 'm2']); assert.equal(a.collection.m3, 1);
  assert.throws(() => A.setTeam(a, ['m1', 'm2', 'm3']), /階級上限/);
});
test('一般關：放置＋點擊打到 0 就通關、拿獎勵、進度 +1', () => {
  let a = A.gift(A.fresh()); const now = 1e6;
  assert.throws(() => A.fight({ ...a, roster: [] }, now), /隊伍是空的/);
  a = A.fight(a, now); assert.equal(a.stage.need, A.need(0)); assert.equal(a.stage.deadline, null);
  let r = A.settle(a, now + 1000, 1); assert.equal(r.events.length, 0); assert.ok(r.state.stage.hp < A.need(0));
  a = A.tap(r.state, now); assert.equal(a.stage.hp, r.state.stage.hp - 60 * R.CLICK_SHARE);
  a = { ...a, stage: { ...a.stage, hp: 1 } }; r = A.settle(a, now + 2000, 1);
  assert.deepEqual(r.events[0], { type: 'win', index: 0, reward: A.reward(0) }); assert.equal(r.state.progress, 1); assert.equal(r.state.stage, null);
  assert.ok(r.state.coins >= A.reward(0));
});
test('王關：60 秒沒打完失敗、冷卻 3 分鐘、之後才能再打', () => {
  let a = { ...A.gift(A.fresh()), progress: 3 }; const now = 1e6;
  a = A.fight(a, now); assert.ok(a.stage.boss); assert.equal(a.stage.deadline, now + R.BOSS_TIME);
  const r = A.settle(a, now + R.BOSS_TIME, 0); assert.equal(r.events[0].type, 'fail'); assert.equal(r.state.cooldownUntil, now + R.BOSS_TIME + R.BOSS_COOLDOWN);
  assert.equal(A.canFight(r.state, now + R.BOSS_TIME + 1000), false); assert.equal(A.canFight(r.state, r.state.cooldownUntil), true);
});
test('券：1000 金幣一張；金幣不夠丟錯', () => {
  const a = { ...A.fresh(), coins: 1500 };
  assert.equal(A.buyTicket(a).tickets, 1); assert.equal(A.buyTicket(a).coins, 500);
  assert.throws(() => A.buyTicket(a, 2), /不足/);
});
test('normalize：壞欄位歸零、不在收藏的卡出隊、進度不符的戰鬥丟掉', () => {
  const a = A.normalize({ unlocked: true, collection: { m1: 1 }, roster: ['m1', 'ghost'], skills: ['m1', 'ghost'], stage: { index: 5, hp: 10 }, progress: 0 });
  assert.deepEqual(a.roster, ['m1']); assert.deepEqual(a.skills, ['m1', null, null, null]); assert.equal(a.stage, null);
});
