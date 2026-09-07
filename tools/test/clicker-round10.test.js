// 第十輪：角色粉塵、升階、超越、溢出折萬用、粉塵商店、更衣室、存檔遷移
const test = require('node:test'), assert = require('node:assert');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), B = require('../../src/clicker-balance.js'), Pool = require('../../src/gacha-pool.js');
const seed = (over = {}) => { const s = S.fresh(0); Object.assign(s, over); return s; };
const own = (s, id, n) => { s.collection[id] = n; s.dust[id] = n; return s; };
test('v1 存檔遷移：張數變粉塵、預設更衣室與穿著', () => {
  const s = seed(); s.version = 1; delete s.dust; delete s.owned; s.collection = { yueyue2: 5 }; delete s.settings.clickSound;
  const v = S.validate(JSON.parse(JSON.stringify(s)), Pool);
  assert.equal(v.version, 2); assert.equal(v.dust.yueyue2, 5); assert.deepEqual(v.owned.wardrobe, ['sounds:soft', 'fx:shard']); assert.equal(v.settings.clickFx, 'shard');
});
test('升星門檻照粉塵（1/2/4/8/16），第 17 顆起不再有熟練', () => {
  assert.deepEqual([1, 2, 4, 8, 16, 40].map(E.stars), [1, 2, 3, 4, 5, 5]); assert.equal(E.starMultiplier(40), 2);
});
test('精良升階兩步：12、16 顆；階級係數 1／1.8／3.2', () => {
  const s = own(seed({ coins: 1, lifetimeCoins: 1 }), 'yueyue2', 16);
  assert.throws(() => E.promote(s, 'yueyue2', 0), /粉塵不足/);
  s.dust.yueyue2 = 28; const a = E.promote(s, 'yueyue2', 0); assert.equal(a.promotions.yueyue2, 1); assert.equal(E.availableDust(a, 'yueyue2'), 0);
  assert.ok(Math.abs(E.individual(a, 'yueyue2') / E.individual(s, 'yueyue2') - 1.8) < 1e-9);
  a.dust.yueyue2 = 44; const b = E.promote(a, 'yueyue2', 0); assert.equal(E.rarity(b, 'yueyue2'), 'legendary'); assert.throws(() => E.promote(b, 'yueyue2', 0), /最高階/);
  S.validate(b, Pool);
});
test('傳說超越 4/5/6/7/10；每級 +14%；超越五覺醒；未到 5★ 不能超越', () => {
  const s = own(seed(), 'zhenmu', 16);
  assert.throws(() => E.transcend(own(seed(), 'zhenmu', 8), 'zhenmu', 0), /5★/);
  s.dust.zhenmu = 16 + 4 + 5 + 6 + 7 + 10; let t = s;
  for (let i = 1; i <= 5; i++) t = E.transcend(t, 'zhenmu', 0);
  assert.equal(t.transcend.zhenmu, 5); assert.equal(t.awakened.zhenmu, true); assert.equal(E.availableDust(t, 'zhenmu'), 0);
  assert.ok(Math.abs(E.individual(t, 'zhenmu') / E.individual(s, 'zhenmu') - 1.7) < 1e-9);
  assert.throws(() => E.transcend(t, 'zhenmu', 0)); S.validate(t, Pool);
});
test('滿養後的重複卡折萬用粉塵（精良 4:1、傳說 1:1），零頭保留', () => {
  const s = own(seed(), 'yueyue2', 94); s.promotions.yueyue2 = 2; s.transcend.yueyue2 = 5; s.awakened.yueyue2 = true; S.validate(s, Pool);
  s.pending = { draw: { id: 'x', visualSeed: 1, entries: [0, 1, 2, 3, 4].map(i => ({ key: `x:${i}`, entry: { ...Pool.byId.yueyue2 }, dup: true, owned: 94 + i })) } };
  s.paidDraws = 5; const r = E.collect(s, 'x', 0);
  assert.equal(r.state.universalDust, 1); assert.equal(r.state.overflow.yueyue2, 1); assert.equal(r.state.dust.yueyue2, 94);
});
test('粉塵商店：萬用 → 指定角色，匯率 1／2／3，餘額不足拒絕', () => {
  const s = own(seed({ universalDust: 7 }), 'zhenmu', 3);
  const a = E.exchange(s, 'zhenmu', 6, 0); assert.equal(a.dust.zhenmu, 5); assert.equal(a.universalDust, 1);
  assert.throws(() => E.exchange(a, 'zhenmu', 3, 0), /不足/);
  const b = E.exchange(own(seed({ universalDust: 2 }), 'yueyue2', 1), 'yueyue2', 2, 0); assert.equal(b.dust.yueyue2, 3);
});
test('更衣室：每件固定 20000 幣、買過永久、穿上要先擁有', () => {
  const s = seed({ coins: 21000, lifetimeCoins: 21000 }); assert.equal(E.wardrobePrice(s), 20000);
  assert.equal(E.wardrobePrice(own(seed({ trainingLevel: 50 }), 'zhenmu', 1)), 20000);
  assert.throws(() => E.wardrobe(seed({ coins: 19999 }), 'fx', 'heart', false, 0), /餘額不足/);
  assert.throws(() => E.wardrobe(s, 'fx', 'heart', true, 0), /尚未擁有/);
  const a = E.wardrobe(s, 'fx', 'heart', false, 0); assert.equal(a.coins, 1000); assert.ok(a.owned.wardrobe.includes('fx:heart'));
  assert.throws(() => E.wardrobe(a, 'fx', 'heart', false, 0), /已經擁有/);
  const b = E.wardrobe(a, 'fx', 'heart', true, 0); assert.equal(b.settings.clickFx, 'heart'); S.validate(b, Pool);
  assert.throws(() => E.wardrobe(a, 'sounds', 'nope', true, 0));
});
