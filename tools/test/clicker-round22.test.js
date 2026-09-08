const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('../../src/clicker-economy.js');
const S = require('../../src/clicker-save.js');
const B = require('../../src/clicker-balance.js');
const Pool = require('../../src/gacha-pool.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-9, `${a} != ${b}`);
const NEW_IDS = ['mieshi','qinghua','yuefeimo','yuesong','zhenbush','bingyang','zhenbing','zhenpete','guanjiu','miepupu','manhua','yangtuo','ababa'];
// 第二十三輪（桌面「新卡\2.0」）
const NEW_IDS_23 = ['foxfriend','wanwu','lkreal','qipupu','foxmoney','gebuyang','zhenwang','salamander'];
const NEW_IDS_24 = ['shiyi','shiwang','seal','chaichai','jiaolan'];

test('round22: 十三張新卡都有卡面、技能與稀有度', () => {
  for (const id of [...NEW_IDS, ...NEW_IDS_23, ...NEW_IDS_24]) {
    const entry = Pool.byId[id];
    assert.ok(entry, `${id} 不在卡池`);
    assert.equal(entry.kind, 'char');
    assert.ok(fs.existsSync(new URL('../../src/' + entry.src, require('node:url').pathToFileURL(__filename))), `${entry.src} 不存在`);
    assert.ok(B.characters[id]?.skill, `${id} 沒有技能`);
    assert.ok(B.characters[id].base > 0);
  }
  assert.deepEqual(NEW_IDS.filter(id => Pool.byId[id].rarity === 'mythic'), ['mieshi','qinghua']);
  assert.equal(Pool.CHARACTER_IDS.length, 51);
});

test('round22: bossDamage 王關中砍血量百分比，平常退化成爆發', () => {
  const s = S.fresh(0);
  s.collection = { mieshi: 1, yuefeimo: 1, zhenmu: 1 };
  s.skillSlots = ['mieshi', 'yuefeimo', null];
  s.coins = s.lifetimeCoins = 1e6;
  S.validate(s, Pool);

  // 平常（沒有王包）：等同 burst，錢包進帳 fallback × P，包裝有推進
  const before = E.rates(s).P;
  const out = E.activate(s, 0, 0);
  near(out.effect.value, B.skillAt('mieshi', 1).fallback * before);
  assert.equal(out.state.effects.length, 0, 'bossDamage 是瞬發，不留 effect');
  assert.ok(out.state.coins > 1e6);

  // 王關中：傷害 = 血量 × share，跟 P 無關
  let boss = S.fresh(0);
  boss.collection = { mieshi: 1, yuefeimo: 1, zhenmu: 1 };
  boss.skillSlots = ['mieshi', 'yuefeimo', null];
  boss.coins = boss.lifetimeCoins = 1e9;
  boss.package.index = 61;
  S.validate(boss, Pool);
  boss = E.startBoss(boss, 0);
  const need = boss.boss.need;
  const hit = E.activate(boss, 0, 0);
  near(hit.state.boss.dealt, need * B.skillAt('mieshi', 1).share);
  assert.equal(hit.effect.value, need * B.skillAt('mieshi', 1).share);
});

test('round22: bossDamage 升星／超越只放大 share 與 fallback，且不會一發破王', () => {
  const one = B.skillAt('mieshi', 1), five = B.skillAt('mieshi', 5), max = B.skillAt('mieshi', 5, 5);
  near(five.share, one.share * 1.32);
  assert.ok(max.share < .5, `滿養 share ${max.share} 不能超過半條血`);
  assert.ok(five.fallback > one.fallback);
  assert.ok(max.cd < one.cd);
  assert.match(B.characters.mieshi.desc(one), /王關中：立即對王包造成血量/);
});

test('round24: 五張新卡的稀有度、精良 trait 與 11 發', () => {
  assert.deepEqual(NEW_IDS_24.map(id => Pool.byId[id].rarity),
    ['legendary','rare','rare','rare','rare']);
  // jiaolan 是第一張帶 trait 的精良卡，倍率要明顯低於傳說的 jiaotou（trait 是跨槽連乘的）
  assert.ok(B.characters.jiaolan.trait.clickMul < B.characters.jiaotou.trait.clickMul);
  assert.equal(B.characters.shiyi.charges, 11);
  // seal 是第一張精良 clickAdd，要比史詩那批弱
  assert.ok(B.characters.seal.ratio < Math.min(...['dog','yangpu','zhenpete','foxmoney'].map(id => B.characters[id].ratio)));
});
