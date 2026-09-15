// 2026-09-16：朋友的 v2 存檔匯不進新版——買過退役印記商品（finger14 等）的 v2 存檔，
// 遷移時 shopSpent 沒算退役項、退款段又把原價加回 marks，帳對不起來卡「印記商店」。
const test = require('node:test'), assert = require('node:assert');
const S = require('../../src/clicker-save.js'), B = require('../../src/clicker-balance.js'), Pool = require('../../src/gacha-pool.js');

function v2Save() {
  const s = S.fresh(1700000000000); s.version = 2; s.prestiges = 4; s.blessing = 29; s.marks = 26; s.marksClaimed = 490;
  s.markShop = { finger14: true, offline15: true, offline12: true, slot4: true, chain2: true, rooftop: true, starter5: true, daily2: true, bossTime: true, crack75: true };
  s.skillSlots = [null, null, null, null]; s.slotReadyAt = [0, 0, 0, 0];
  return JSON.parse(JSON.stringify(s));
}

test('v2 存檔買過退役商品：遷移後帳要對得起、退款要在手上', () => {
  const s = S.validate(v2Save(), Pool);
  const retired = Object.keys(B.RETIRED_MARKS), refund = Object.values(B.RETIRED_MARKS).reduce((a, b) => a + b, 0);
  assert.ok(retired.every(id => !s.markShop[id]), '退役項要刪掉');
  assert.strictEqual(s.markRefunds, refund);
  const shop = Object.keys(s.markShop).reduce((sum, id) => sum + B.marks.find(m => m.id === id).cost, 0);
  assert.strictEqual(s.marksClaimed, 4 * B.V3.MARKS_PER_RUN + shop + refund);
  assert.strictEqual(s.marks, (4 * B.V3.MARKS_PER_RUN - s.blessing * (s.blessing + 1) / 2) + refund);
});

test('帳對不起來的存檔走自動修復「印記對帳」，不賠任何東西', () => {
  const s = S.validate(v2Save(), Pool); s.marksClaimed -= 10;   // 人為弄壞帳
  assert.throws(() => S.validate(JSON.parse(JSON.stringify(s)), Pool), /印記商店/);
  const r = S.repair(JSON.parse(JSON.stringify(s)), Pool, 1700000000000);
  assert.ok(r, '要救得回來'); assert.deepStrictEqual(r.applied, ['印記對帳']);
  assert.strictEqual(r.state.marks, s.marks); assert.strictEqual(r.state.blessing, s.blessing); assert.deepStrictEqual(r.state.markShop, s.markShop);
});
