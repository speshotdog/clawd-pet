// 第二十四輪：舊存檔的 bossResult 沒有 next 欄位（第二十二輪加 city 時才開始寫）
const assert = require('node:assert');
const { test } = require('node:test');
const S = require('../../src/clicker-save.js');
const E = require('../../src/clicker-economy.js');
const Pool = require('../../src/gacha-pool.js');

// 使用者朋友 2026-09-08 回報的實際情況：在 fridge 打贏王、結算牌還掛著，
// 換到有第七站的新版一讀就丟「存檔驗證失敗：王包結算」。
test('round24: 缺 next 的舊 bossResult 會被補回來，不再鎖死存檔', () => {
  const s = S.fresh(0);
  s.bossWins = ['backyard','kitchen','market','factory','nightmarket','fridge'];
  s.settings.scene = 'fridge';
  s.bossResult = { scene: 'fridge', won: true, crack: 0, at: 1788835403207 };   // 沒有 next
  const out = S.validate(JSON.parse(JSON.stringify(s)), Pool);                   // 走過 JSON 一趟，跟真的讀檔一樣
  assert.equal(out.bossResult.next, 'city');
  assert.equal(E.nextScene('fridge'), 'city');
});

test('round24: 終點站 city 的 bossResult 沒有 next 是對的，補完仍然驗得過', () => {
  const s = S.fresh(0);
  s.bossWins = ['backyard','kitchen','market','factory','nightmarket','fridge','city'];
  s.settings.scene = 'city';
  s.bossResult = { scene: 'city', won: true, crack: 0, at: 1788835403207, next: E.nextScene('city') };
  assert.equal(E.nextScene('city'), undefined);
  const out = S.validate(JSON.parse(JSON.stringify(s)), Pool);
  assert.equal(out.bossResult.next, undefined);
});
