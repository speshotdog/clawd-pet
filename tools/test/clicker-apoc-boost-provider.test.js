// 2026-09-16 朋友：買了「派遣位 +1」卡冊寫 3/4 卻按不下去——卡冊拿的是沒掛 boost 的裸 apoc，dispatchSlots 退回 3。
const test = require('node:test'), assert = require('node:assert');
const A = require('../../src/clicker-apoc-economy.js');
require('../../src/clicker-balance.js');

test('沒掛 boost 時 boostOf 會問 provider：派遣位 3 → 4', () => {
  let a = A.normalize({ ...A.fresh(), unlocked: true, tutorial: 4 });
  const ids = (require('../../src/gacha-pool.js').CHARACTER_IDS || []).slice(0, 0);
  // 用假卡池：直接塞四張「已擁有」的 id（dispatch 只看 collection 與 roster）
  a.collection = { c1: 1, c2: 1, c3: 1, c4: 1 }; a.roster = [];
  A.setBoostProvider(() => ({ ...{ power: 1, click: 1, skill: 1, cd: 1, offline: 1, ticket: 0, dust: 0, slot4: true, bossTime: false, offline12: false, tapShare: 0 }, dispatch4: true }));
  assert.strictEqual(A.dispatchSlots(a), 4);
  A.setBoostProvider(null);
  assert.strictEqual(A.dispatchSlots(a), 3);
  a.boost = { dispatch4: true }; assert.strictEqual(A.dispatchSlots(a), 4, '掛了 boost 以 boost 為準');
});
