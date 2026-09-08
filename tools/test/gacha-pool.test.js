const test = require('node:test');
const assert = require('node:assert/strict');
const Pool = require('../../src/gacha-pool.js');

// 固定序列的 rng：用完回 0.5
const seq = (values) => { let i = 0; return () => (i < values.length ? values[i++] : 0.5); };
const rollGame = (opts) => Pool.rollPack({ policy: Pool.GAME_POLICY, id: 'd', visualSeed: 1, ...opts });

test('目錄：46 隻角色進遊戲池，玩具與 emoji 不進', () => {
  assert.equal(Pool.CATALOG.length, 51);
  assert.equal(Pool.GAME_POLICY.candidates.length, 46);
  assert.ok(Pool.GAME_POLICY.candidates.every((id) => Pool.byId[id].kind === 'char'));
});

test('遊戲保底：第 40 張必出傳說，任一傳說歸零', () => {
  // rng 全回 .99：永遠抽不到傳說（5%）
  const r = rollGame({ count: 1, pity: 39, rng: () => .99 });
  assert.equal(r.draw.entries[0].entry.rarity, 'legendary');
  assert.equal(r.nextPity, 0);
  const miss = rollGame({ count: 1, pity: 38, rng: () => .99 });
  assert.notEqual(miss.draw.entries[0].entry.rarity, 'legendary');
  assert.equal(miss.nextPity, 39);
});

test('遊戲軟保底：第 30 張傳說率 10%、第 31 張 15%，第 29 張仍是 5%', () => {
  // 第 29 張（pity 28）：x=.07 > .05 → 不是傳說
  assert.notEqual(rollGame({ count: 1, pity: 28, rng: () => .07 }).draw.entries[0].entry.rarity, 'legendary');
  // 第 30 張（pity 29）：x=.07 < .10 → 傳說
  assert.equal(rollGame({ count: 1, pity: 29, rng: () => .07 }).draw.entries[0].entry.rarity, 'legendary');
  // 第 31 張（pity 30）：x=.12 < .15 → 傳說；x=.16 → 不是
  assert.equal(rollGame({ count: 1, pity: 30, rng: () => .12 }).draw.entries[0].entry.rarity, 'legendary');
  assert.notEqual(rollGame({ count: 1, pity: 30, rng: () => .16 }).draw.entries[0].entry.rarity, 'legendary');
});

test('五連跨保底：第 40 張落在第 3 張，之後從該張重新計數', () => {
  const r = rollGame({ count: 5, pity: 37, rng: () => .99 });
  const rarities = r.draw.entries.map((e) => e.entry.rarity);
  assert.equal(rarities[2], 'legendary');
  assert.ok(rarities.filter((x) => x === 'legendary').length === 1);
  assert.equal(r.nextPity, 2);
});

test('同包重複：owned 逐張累計、dup 只看之前是否持有', () => {
  // rng 消耗順序：先五次稀有度（x=.9 → 精良），再五次選角（0 → 該階第一隻）
  const rng = seq([.9, .9, .9, .9, .9, 0, 0, 0, 0, 0]);
  const r = rollGame({ count: 5, pity: 0, collection: { [Pool.GAME_POLICY.candidates.filter((id) => Pool.byId[id].rarity === 'rare')[0]]: 1 }, rng });
  const owned = r.draw.entries.map((e) => e.owned);
  assert.deepEqual(owned, [1, 2, 3, 4, 5]);
  assert.ok(r.draw.entries.every((e) => e.dup));
  assert.equal(r.draw.entries[0].key, 'd:0');
  assert.ok(Object.isFrozen(r.draw) && Object.isFrozen(r.draw.entries[0]));
});

test('遊戲池抽不到普通', () => {
  for (let i = 0; i < 200; i++) {
    const r = rollGame({ count: 5, pity: 0 });
    assert.ok(r.draw.entries.every((e) => e.entry.rarity !== 'common' && e.entry.kind === 'char'));
  }
});

test('演示政策：每包保底一張精良、10 包必出傳說、計數按包', () => {
  const r = Pool.rollPack({ count: 5, policy: Pool.DEMO_POLICY, pity: 9, rng: () => .99, id: 'p', visualSeed: 1 });
  const rarities = r.draw.entries.map((e) => e.entry.rarity);
  assert.ok(rarities.includes('legendary'));
  assert.equal(r.nextPity, 0);
  const miss = Pool.rollPack({ count: 5, policy: Pool.DEMO_POLICY, pity: 3, rng: () => .999, id: 'p', visualSeed: 1 });
  assert.equal(miss.nextPity, 4);
  // .999 全落普通 → 保底一補進一張精良以上
  assert.ok(miss.draw.entries.some((e) => e.entry.rarity !== 'common'));
});
