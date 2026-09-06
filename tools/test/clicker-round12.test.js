// 第十二輪：冰箱 regen（可見／離線／王）、每日一包、里程碑徽章與 12 選 1、存檔匯出匯入、rainynight 遷移
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), X = require('../../src/clicker-extras.js'), Pool = require('../../src/gacha-pool.js');
const { scenes } = require('../../src/clicker-scene.js');
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} ~= ${b}`);
const NOON = new Date(2026, 8, 6, 12).getTime(), DAY = 86400000;
const fridge = (now = 0) => { const s = S.fresh(now); s.bossWins = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket']; s.settings.scene = 'fridge'; s.package = E.newPackage('fridge'); return s; };

test('round12 scene: 深夜冰箱取代 rainynight，regen 1%/秒、倍率 120、王「大冰磚」×6', () => {
  assert.equal(scenes.rainynight, undefined);
  assert.equal(scenes.fridge.name, '深夜冰箱'); assert.equal(scenes.fridge.enemy.regen, .01); assert.equal(scenes.fridge.requirementMul, 120);
  assert.deepEqual(scenes.fridge.unlock, { packages: 4000, boss: 'nightmarket' }); assert.equal(scenes.fridge.boss.name, '大冰磚'); assert.equal(scenes.fridge.boss.mul, 6);
  assert.equal(E.nextScene('nightmarket'), 'fridge'); S.validate(fridge(), Pool);
});
test('round12 regen 可見：每秒吃掉 need×1%，不低於 0；其他場景不受影響', () => {
  const s = fridge(0), need = E.requirement(1, 'fridge'); s.package.progress = need * .5;
  const a = E.settle(s, 1000).state; near(a.package.progress, need * .5 - need * .01);
  const b = E.settle(s, 60000).state; assert.equal(b.package.progress, 0);
  const k = S.fresh(0); k.package.progress = 40; assert.equal(E.settle(k, 5000).state.package.progress, 40);
});
test('round12 regen 離線：P < need×regen 進度停在原地、幣照給；P 夠大則扣掉回升量後推進', () => {
  const s = fridge(0); s.collection = { yueyue2: 1 }; s.dust = { yueyue2: 1 }; s.package.index = 30; s.package.progress = 500;   // P 480/秒 < need×1% ≈ 3.2k/秒
  const r = E.settle(s, 3600000, { offline: true });
  assert.equal(r.state.package.progress, 500); near(r.state.coins, r.earned); assert.ok(r.earned > 0);
  const big = fridge(0); big.collection = { zhenmu: 1 }; big.dust = { zhenmu: 1 }; big.package.progress = 500;   // P 1920/秒 > 120/秒
  const need = E.requirement(1, 'fridge'), b = E.settle(big, 3000, { offline: true });
  near(b.state.package.progress, 500 + b.earned - need * .01 * 3); near(b.state.coins, b.earned);
});
test('round12 regen 王包：大冰磚照吃，但不低於裂痕起點', () => {
  let s = fridge(0); s.package.index = 4001; s.bossCracks.fridge = .4; s.settings.scene = 'fridge';
  // 冰箱是最後一個場景，canBoss 需要下一場景；這裡直接驗 regen 對王包的作用
  const need = scenes.fridge.boss.mul * E.requirement(4001, 'fridge');
  s.boss = { scene: 'fridge', need, dealt: need * .5, startedAt: 0, endsAt: 30000, crack: .4, shells: [], shellHp: 3, blocked: 0 };
  const a = E.settle(s, 1000).state; near(a.boss.dealt, need * .5 - need * .01);
  const b = E.settle(s, 20000).state; near(b.boss.dealt, need * .4);
});
test('round12 每日一包：日期變了才換包、沒拆不累積、連續天數只在昨天拆完時延續', () => {
  const s = S.fresh(NOON), a = X.dailyRoll(s);
  assert.equal(a.daily.date, X.localDate(NOON)); assert.equal(a.daily.done, false); near(a.daily.need, 3 * E.requirement(1)); assert.equal(a.daily.streak, 0);
  assert.equal(X.dailyRoll(a), a);
  const same = E.clone(a); same.settledAt = NOON + 3600000; assert.equal(X.dailyRoll(same), same);
  a.daily.done = true; a.daily.streak = 3; a.settledAt = NOON + DAY;
  const b = X.dailyRoll(a); assert.equal(b.daily.done, false); assert.equal(b.daily.streak, 3); assert.equal(b.daily.dealt, 0);
  b.settledAt = NOON + 2 * DAY;   // 昨天沒拆 → 歸零
  const c = X.dailyRoll(b); assert.equal(c.daily.streak, 0);
  S.validate(c, Pool);
});
test('round12 每日一包：點擊只進限定包、幣照給、一般包不動；拆完送免費單抽 +1 與萬用粉塵 +1', () => {
  let s = X.dailyRoll(S.fresh(NOON)); s.clickLevel = 30;
  const before = E.clone(s.package), r = X.dailyClick(s, NOON);
  assert.equal(r.done, false); near(r.state.daily.dealt, r.amount); near(r.state.coins, r.amount); assert.deepEqual(r.state.package, before); assert.equal(r.state.manualClicks, 1);
  s = r.state; s.daily.dealt = s.daily.need - 1;
  const done = X.dailyClick(s, NOON + 100);
  assert.equal(done.done, true); assert.equal(done.state.daily.done, true); assert.equal(done.state.daily.dealt, done.state.daily.need);
  assert.equal(done.state.freeDraws, 1); assert.equal(done.state.universalDust, 1); assert.equal(done.state.daily.streak, 1);
  assert.throws(() => X.dailyClick(done.state, NOON + 200), /已經拆完/);
  S.validate(done.state, Pool);
  const burst = X.dailyBurst(s, s.daily.need); assert.equal(burst.done, true); assert.equal(burst.state.freeDraws, 1);
  assert.equal(X.dailyBurst(done.state, 5).state, done.state);
});
test('round12 徽章：累計包數跨場景、第 10／25／50 包放玩具、判定一次只發一次', () => {
  const s = S.fresh(0); s.package.index = 8; s.bossWins = ['backyard']; s.scenePackages = { kitchen: E.newPackage('kitchen', 20) };
  assert.equal(X.totalPackages(s), 7 + 19);
  const a = X.checkBadges(s); assert.deepEqual(a.earned, ['pack10', 'pack25', 'boss-backyard']); assert.deepEqual(X.toys(a.state), ['toy-dino.png', 'toy-ballyellow.png']);
  assert.deepEqual(X.checkBadges(a.state).earned, []); assert.equal(X.checkBadges(a.state).state, a.state);
  S.validate(a.state, Pool);
  assert.equal(X.BADGES.length, 17);
  const t = S.fresh(0); t.collection = { zhenmu: 16 }; t.dust = { zhenmu: 20 }; t.transcend = { zhenmu: 1 }; t.lifetimeCoins = 1e8; t.daily = { date: '2026-09-06', done: true, need: 300, dealt: 300, streak: 7 };
  assert.deepEqual(X.checkBadges(t).earned, ['star5', 'transcend', 'streak7', 'coins1e8']);
});
test('round12 第 100 包 12 選 1：要有徽章、只能選一次、送該角色粉塵 1 顆', () => {
  const s = S.fresh(0); assert.throws(() => X.pick100(s, 'zhenmu'), /100/);
  s.package.index = 101; const a = X.checkBadges(s).state; assert.ok(a.badges.includes('pack100')); assert.equal(X.canPick(a), true);
  assert.throws(() => X.pick100(a, 'nobody'), /未知/);
  const b = X.pick100(a, 'zhenmu'); assert.equal(b.pick100, 'zhenmu'); assert.equal(E.dust(b, 'zhenmu'), 1); assert.equal(X.canPick(b), false);
  assert.throws(() => X.pick100(b, 'fox'), /選過/); S.validate(b, Pool);
  const forged = E.clone(s); forged.pick100 = 'zhenmu'; assert.throws(() => S.validate(forged, Pool), /百包選角/);
});
test('round12 匯出／匯入：ZMDD1. 前綴 round-trip、壞字串拒絕、未來 settledAt 取現在、王包視同放棄', () => {
  const s = S.fresh(1000); s.coins = s.lifetimeCoins = 12345; s.collection = { fox: 1 }; s.dust = { fox: 1 }; s.settings.clickSound = 'soft';
  const text = X.encodeSave(s); assert.ok(text.startsWith('ZMDD1.'));
  const back = S.validate(X.decodeSave(text), Pool); assert.deepEqual(back, S.validate(E.clone(s), Pool));
  for (const bad of ['', 'hello', 'ZMDD1.', 'ZMDD1.!!!', `ZMDD1.${btoa('[1,2]')}`, `ZMDD1.${btoa('{"version":9}')}`]) assert.throws(() => S.validate(X.decodeSave(bad), Pool));
  const future = E.clone(s); future.settledAt = 5e12; const p = X.prepareImport(future, 2000); assert.equal(p.settledAt, 2000);
  const boss = S.fresh(0); boss.package.index = 51; const withBoss = E.startBoss(boss, 0); withBoss.boss.dealt = withBoss.boss.need * .8;
  const q = X.prepareImport(withBoss, 500); assert.equal(q.boss, null); near(q.bossCracks.backyard, .4);
  assert.deepEqual(X.summary(s), { coins: 12345, packages: 0, partners: 1, savedAt: 1000, scene: '後院草地' });
});
test('round12 存檔：rainynight 遷移成 fridge；新欄位缺省補齊、壞值拒絕', () => {
  const s = fridge(0); s.settings.scene = 'rainynight'; s.scenePackages = { rainynight: E.newPackage('fridge', 3) }; s.bossCracks = { rainynight: .2 }; s.bossResult = { scene: 'nightmarket', won: true, crack: 0, at: 0, next: 'rainynight' };
  delete s.daily; delete s.badges; delete s.pick100;
  const v = S.validate(JSON.parse(JSON.stringify(s)), Pool);
  assert.equal(v.settings.scene, 'fridge'); assert.equal(v.scenePackages.fridge.index, 3); assert.equal(v.scenePackages.rainynight, undefined); assert.equal(v.bossCracks.fridge, .2); assert.equal(v.bossResult.next, 'fridge');
  assert.equal(v.daily, null); assert.deepEqual(v.badges, []); assert.equal(v.pick100, null);
  for (const mutate of [t => t.badges = ['nope'], t => t.badges = ['pack10', 'pack10'], t => t.daily = { date: 'today', done: false, need: 10, dealt: 0, streak: 0 }, t => t.daily = { date: '2026-09-06', done: false, need: 10, dealt: 10, streak: 0 }, t => t.daily = { date: '2026-09-06', done: true, need: 10, dealt: 10, streak: 1.5 }]) {
    const t = S.fresh(0); mutate(t); assert.throws(() => S.validate(t, Pool));
  }
  const ok = S.fresh(0); ok.daily = { date: '2026-09-06', done: true, need: 10, dealt: 10, streak: 2 }; S.validate(ok, Pool);
});
test('round12 分享卡文案', () => {
  assert.equal(X.shareTitle('packs', { packages: 42 }), '我拆了 42 包'); assert.equal(X.shareTitle('boss', { scene: 'backyard' }), '打贏了大罐頭');
  assert.equal(X.shareTitle('boss', { scene: 'fridge' }), '打贏了大冰磚'); assert.equal(X.shareTitle('badge', { id: 'pack10' }), '拿到「第 10 包」徽章');
});
