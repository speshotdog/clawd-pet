const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js');
const B = require('../../src/clicker-balance.js');
const S = require('../../src/clicker-save.js');
const Pool = require('../../src/gacha-pool.js');
const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon * Math.max(1, Math.abs(expected)), `${actual} ≈ ${expected}`);
const fresh = () => S.fresh(1000000);
const money = (coins = 1e6) => ({ ...fresh(), coins, lifetimeCoins: coins });
const opts = { id: 'draw-1', visualSeed: 12, rng: () => .9 };

for (const id of ['caihua', 'fox', 'lk', 'zhenzhen2', 'yang', 'zhenzhen', 'dog', 'jiaobu2', 'yueyue']) {
  test(`round7 ${id}: snapshot, expiry, cooldown and save roundtrip`, () => {
    const s = money(); s.collection = Object.fromEntries(Object.keys(B.characters).map(id => [id, 4]));
    s.trainingLevel = 2; s.skillSlots[0] = id;
    const t = s.settledAt, def = B.characters[id], { P, D } = E.rates(s), pi = E.individual(s, id);
    const r = E.activate(s, 0, t), a = r.state;
    assert.throws(() => E.activate(a, 0, t), /冷卻/);
    S.validate(JSON.parse(JSON.stringify(a)), Pool);
    if (def.kind === 'burst') {
      const expected = id === 'caihua' ? 20 * pi : 15 * P;
      close(a.coins - s.coins, expected); close(a.lifetimeCoins - s.lifetimeCoins, expected);
      assert.deepEqual(a.package, E.advancePackage(s.package, expected).package);
      assert.equal(a.manualClicks, s.manualClicks); assert.equal(a.effects.length, 0);
    } else if (['self', 'team'].includes(def.kind)) {
      const extra = def.kind === 'self' ? pi * (def.multiplier - 1) : P * def.ratio;
      close(r.effect.value, extra);
      a.trainingLevel++; // the existing effect keeps the original snapshot
      const first = E.settle(a, t + 7000), end = t + 40000;
      const last = E.settle(first.state, end), all = E.settle(a, end);
      close(all.earned, E.rates(a).P * 40 + extra * def.duration);
      close(first.earned + last.earned, all.earned);
      assert.equal(E.settle(all.state, end).earned, 0); assert.equal(all.state.effects.length, 0);
    } else {
      close(E.click(a, t).amount, def.kind === 'clickAdd' ? D + .5 * P : D * def.multiplier);
      close(E.click(a, t + def.duration * 1000).amount, D);
      let used = a;
      for (let i = 0; i < (def.charges || 50); i++) used = E.click(used, t).state;
      assert.equal(used.effects.length, def.kind === 'clickTime' ? 1 : 0);
    }
  });
}

test('round7 click multiplier max then fixed add; all charge effects consume together', () => {
  let s = money(); s.collection = { dog: 1, jiaobu2: 1, yueyue: 1 };
  s.skillSlots = ['dog', 'jiaobu2', 'yueyue'];
  for (let i = 0; i < 3; i++) s = E.activate(s, i, s.settledAt).state;
  const r = E.click(s, s.settledAt);
  close(r.amount, E.rates(s).D * 4 + E.rates(s).P * .5);
  assert.deepEqual(r.state.effects.map(e => e.remaining), [19, 4, undefined]);
});

test('round7 self + team + parasite integrate only remaining offline intervals', () => {
  let s = money(); s.collection = { lk: 1, yang: 1, zhenmu: 1 };
  s.skillSlots = ['lk', 'yang', 'zhenmu']; const t = s.settledAt;
  for (let i = 0; i < 3; i++) s = E.activate(s, i, t).state;
  s = E.settle(s, t + 10000).state;
  const r = E.settle(s, t + 40000);
  close(r.earned, 26 * 30 + 10 * 10 + 5.2 * 20 + 5 * 10);
  assert.equal(E.settle(r.state, t + 40000).earned, 0);
});

test('手勁費用 L=0/5/10/20/30 及訓練費用依公式逐級向上取整', () => {
  assert.deepEqual([0, 5, 10, 20, 30].map(E.clickCost), [10, 38, 138, 1901, 26200]);
  assert.deepEqual([0, 1, 2, 5, 10].map(E.trainingCost), [1000, 1600, 2561, 10486, 109952]);
});

test('1/2/4/8/16/20 張的星級倍率；逐張角標', () => {
  assert.deepEqual([1, 2, 4, 8, 16, 20].map(E.stars), [1, 2, 3, 4, 5, 5]);
  [1, 1.25, 1.5, 1.75, 2, 2.04].forEach((v, i) => close(E.starMultiplier([1, 2, 4, 8, 16, 20][i]), v));
  assert.equal(E.starMultiplier(0), 0);
  assert.equal(E.tagFor({}, false, 0).text, 'NEW');
  assert.equal(E.tagFor({}, true, 3).text, '2★ → 3★');
  assert.equal(E.tagFor({}, true, 2).text, '升星進度 3/4');
  assert.equal(E.tagFor({}, true, 19).text, '熟練 +4%');
});

test('12 隻被動全數計入；D/P 不含暫時技能，沒有槽位限制', () => {
  const s = fresh(); s.collection = Object.fromEntries(Object.keys(B.characters).map((id) => [id, 1]));
  assert.equal(E.rates(s).P, 125); s.collection.yueyue2 = 4; s.trainingLevel = 3; s.clickLevel = 10;
  close(E.rates(s).P, 127 * 1.15 ** 3); close(E.rates(s).D, 1.18 ** 10 + .05 * 127 * 1.15 ** 3);
  const before = E.rates(s); s.effects = [{ kind: 'passive', value: 99999 }]; assert.deepEqual(E.rates(s), before);
});

test('拆包需求、二分結算、溢出與多包只計一次收入', () => {
  close(E.requirement(1), 100); close(E.requirement(2), 112); close(E.requirement(20), 100 * 1.12 ** 19);
  const result = E.advancePackage({ index: 1, progress: 90 }, 130);
  assert.equal(result.completed, 2); assert.equal(result.package.index, 3); close(result.package.progress, 8);
  assert.equal(E.advancePackage({ index: 1, progress: 0 }, 100).package.index, 2);
  const large = E.advancePackage({ index: 20, progress: 3 }, E.packageSum(20, 100) + 4);
  assert.equal(large.completed, 100); close(large.package.progress, 7, 1e-6);
  // 和獨立逐包參考實作比較多種中間進度與收益。
  for (let k = 1; k <= 30; k++) {
    const initial = { index: k, progress: E.requirement(k) * .37 }, power = k ** 4 * 100;
    let index = k, progress = initial.progress + power;
    while (progress >= E.requirement(index)) progress -= E.requirement(index++);
    const actual = E.advancePackage(initial, power); assert.equal(actual.package.index, index); close(actual.package.progress, progress, 1e-7);
  }
  const s = fresh(); s.collection = { yueyue2: 1 }; const paid = E.settle(s, s.settledAt + 60000);
  close(paid.state.coins, 240); close(paid.state.lifetimeCoins, 240); assert.equal(paid.completed, 2);
});

test('离線 100% 效率、8 小時上限；倒退不付錢且保留高水位', () => {
  const s = fresh(); s.collection = { yueyue2: 1 };
  const r = E.settle(s, s.settledAt + 12 * 3600000);
  assert.equal(r.duration, 8 * 3600000); assert.equal(r.elapsed, 12 * 3600000); close(r.earned, 4 * 8 * 3600);
  const backwards = E.settle(r.state, r.state.settledAt - 3600000);
  assert.equal(backwards.earned, 0); assert.equal(backwards.state.settledAt, r.state.settledAt);
  assert.equal(E.settle(backwards.state, r.state.settledAt).earned, 0);
  close(E.settle(backwards.state, r.state.settledAt + 1000).earned, 4);
});

test('跨技能到期區間積分，離線效果不重施放；分段結算一致', () => {
  const s = money(); s.collection = { zhenmu: 1, jiaobu: 1 }; s.skillSlots[0] = 'zhenmu';
  const active = E.activate(s, 0, s.settledAt).state;
  const end = s.settledAt + 30000, r = E.settle(active, end);
  close(r.earned, 34 * 30 + 18 * 20); assert.deepEqual(r.state.effects, []);
  const half = E.settle(active, s.settledAt + 15000), other = E.settle(half.state, end);
  close(half.earned + other.earned, r.earned);
  const eight = E.settle(active, s.settledAt + 12 * 3600000); close(eight.earned, 34 * 8 * 3600 + 18 * 20);
  assert.deepEqual(active.collection, s.collection); assert.equal(active.effects[0].target, 'jiaobu');
});

test('點擊倍率只取最高，每次消耗所有次數型效果，15 秒到期', () => {
  let s = money(); s.collection = { yueyue2: 1, jiaobu: 1 }; s.skillSlots = ['yueyue2', 'jiaobu', null];
  s = E.activate(s, 0, s.settledAt).state; s = E.activate(s, 1, s.settledAt).state;
  const r = E.click(s, s.settledAt); close(r.amount, E.rates(s).D * 10);
  assert.equal(r.state.effects.length, 1); assert.equal(r.state.effects[0].remaining, 9);
  close(E.click(r.state, s.settledAt + 1).amount, E.rates(s).D * 2);
  close(E.click(r.state, s.settledAt + 15000).amount, E.rates(s).D);
  assert.throws(() => E.activate(s, 0, s.settledAt + 1000), /冷卻/);
});

test('第 50 次明示贈卡一次，不計保底；贈卡前按舊產能結算', () => {
  let s = fresh();
  for (let i = 1; i <= 50; i++) s = E.click(s, s.settledAt + 125).state;
  assert.equal(s.collection.yueyue2, 1); assert.equal(s.paidDraws, 0); assert.equal(s.pity.sinceLegendary, 0);
  assert.equal(s.coins, 50); assert.equal(s.skillSlots[0], 'yueyue2');
  assert.equal(E.click(s, s.settledAt + 125).state.collection.yueyue2, 1); S.validate(s, Pool);
});

test('升級最多按逐級總價；訓練前結算舊產能；不足不修改輸入', () => {
  const s = money(100); const upgraded = E.upgrade(s, 'click', true, s.settledAt);
  assert.equal(upgraded.levels, 5); assert.equal(upgraded.state.coins, 9); assert.equal(s.clickLevel, 0);
  const train = money(1000); train.collection = { yueyue2: 1 };
  const r = E.upgrade(train, 'training', false, train.settledAt + 10000);
  close(r.state.coins, 40); close(E.rates(r.state).P, 4.6);
  assert.throws(() => E.upgrade(fresh(), 'click', false, 1000000), /餘額不足/);
});

test('累計收益解鎖槽位，换槽保留 CD 並等 30 秒', () => {
  assert.deepEqual([0, 4999, 5000, 99999, 100000].map((lifetimeCoins) => E.slotCount({ lifetimeCoins })), [1, 1, 2, 2, 3]);
  let s = money(); s.collection = { yueyue2: 1, jiaobu: 1 }; s.skillSlots[0] = 'yueyue2'; s = E.activate(s, 0, s.settledAt).state;
  const swapped = E.equip(s, 0, 'jiaobu', s.settledAt); assert.equal(swapped.cooldownUntil.yueyue2, s.cooldownUntil.yueyue2);
  assert.throws(() => E.activate(swapped, 0, swapped.settledAt + 29999), /冷卻/);
  assert.equal(E.activate(swapped, 0, swapped.settledAt + 30000).effect.multiplier, 10);
});

test('單抽／五連連續價格；五連跨第 40 張，收下雙擊 id 防重', () => {
  assert.equal(E.drawCost(0), 150); assert.equal(E.drawCost(0, 5), 750); assert.equal(E.drawCost(4, 5), 930);
  const s = money(); s.paidDraws = 37; s.pity.sinceLegendary = 37; s.collection = { yueyue2: 1 };
  const pending = E.purchaseDraw(s, 5, s.settledAt, Pool, opts);
  assert.equal(pending.pending.draw.entries[2].entry.rarity, 'legendary'); assert.equal(pending.pity.sinceLegendary, 2);
  assert.equal(pending.paidDraws, 42); assert.deepEqual(pending.collection, s.collection);
  S.validate(pending, Pool); assert.throws(() => E.purchaseDraw(pending, 1, s.settledAt, Pool), /待收下/);
  assert.equal(E.collect(pending, 'wrong', s.settledAt).accepted, false);
  const collected = E.collect(pending, opts.id, s.settledAt + 10000);
  close(collected.state.coins - pending.coins, 40); assert.equal(collected.state.pending, null);
  const double = E.collect(collected.state, opts.id, s.settledAt + 20000);
  assert.equal(double.accepted, false); assert.equal(double.state, collected.state);
  assert.equal(Object.values(collected.state.collection).reduce((a, b) => a + b), 6);
});

test('同包重複 owned 逐張累計；收下存檔可重讀', () => {
  const s = money(); const pending = E.purchaseDraw(s, 5, s.settledAt, Pool, opts);
  assert.deepEqual(pending.pending.draw.entries.map((item) => item.owned), [0, 1, 2, 3, 4]);
  S.validate(JSON.parse(JSON.stringify(pending)), Pool);
  const got = E.collect(pending, opts.id, s.settledAt); S.validate(got.state, Pool);
});

test('原子寫入與失敗防護：不變更記憶體、重啟 pending、同 id 只落帳一次', () => {
  let raw = JSON.stringify(money()), writes = 0, fail = false;
  const storage = { getItem(key) { assert.equal(key, 'clicker_save'); return raw; }, setItem(key, value) { assert.equal(key, 'clicker_save'); if (fail) throw Error('quota'); writes++; raw = value; } };
  const store = S.create(storage, { now: () => 1000000, pool: Pool }); const before = store.state;
  const next = E.purchaseDraw(before, 5, before.settledAt, Pool, opts);
  fail = true; assert.equal(store.commit(next), false); assert.equal(store.state, before); assert.equal(store.blocked, true); assert.equal(writes, 0);
  fail = false; assert.equal(store.commit(), true); assert.equal(store.blocked, false);
  assert.equal(store.commit(next), true); assert.equal(writes, 2);
  assert.equal(JSON.parse(raw).coins, before.coins - 750); assert.equal(JSON.parse(raw).pending.draw.id, opts.id);
  const reopened = S.create(storage, { now: () => 1000000, pool: Pool });
  const collected = E.collect(reopened.state, opts.id, 1000000); fail = true;
  assert.equal(reopened.commit(collected.state), false); assert.equal(reopened.state.pending.draw.id, opts.id);
  fail = false; assert.equal(reopened.commit(collected.state), true);
  assert.equal(E.collect(reopened.state, opts.id, 1000000).accepted, false); assert.equal(writes, 3);
});

test('壞 JSON、未來版本、未知 ID、異常數值或 pending 都保留原文，不偷偷重置', () => {
  for (const alter of [() => '{invalid', (s) => { s.version = 2; }, (s) => { s.coins = -1; }, (s) => { s.collection.intruder = 1; }, (s) => { s.clickLevel = 1.5; }, (s) => { s.pending = {}; }, (s) => { s.effects = [{ source: 'dog', kind: 'passive' }]; }]) {
    const s = fresh(), modified = alter(s), raw = typeof modified === 'string' ? modified : JSON.stringify(s);
    const store = S.create({ getItem: () => raw, setItem() { assert.fail('不可清空壞檔'); } }, { pool: Pool });
    assert.equal(store.state, null); assert.equal(store.blocked, true); assert.equal(store.raw, raw); assert.ok(store.error);
  }
  const s = fresh(); s.coins = Infinity; assert.throws(() => S.validate(s, Pool), /coins/);
});
