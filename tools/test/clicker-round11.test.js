// 第十一輪：三連包（分配／掃過去／完成判定）、輸送帶（到期／離線不漏／王包暫停）、夜市禮包（命中／過期）、存檔驗證
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), Pool = require('../../src/gacha-pool.js');
const { scenes } = require('../../src/clicker-scene.js');
const near = (a, b, k = 1e-9) => assert.ok(Math.abs(a - b) <= k * Math.max(1, Math.abs(b)), `${a} ~= ${b}`);
const wins = { market: ['backyard', 'kitchen'], factory: ['backyard', 'kitchen', 'market'], nightmarket: ['backyard', 'kitchen', 'market', 'factory'] };
const enter = (id, index = 1, now = 0) => { const s = S.fresh(now); s.bossWins = wins[id]; s.settings.scene = id; s.package = E.newPackage(id, index); return s; };
const H = (id, k = 1) => E.requirement(k, id);

test('scene configs: three enemies driven by parameters, home pairs, boss mul 1.35 with images', () => {
  assert.equal(scenes.market.enemy.triple, true); assert.equal(scenes.factory.enemy.timer, 20);
  assert.deepEqual(scenes.nightmarket.enemy.gift, { everyMs: [45000, 90000], seconds: 15, mul: 10 });
  assert.deepEqual([scenes.market, scenes.factory, scenes.nightmarket].map(s => [s.requirementMul, s.rewardMul, s.unlock.packages, s.unlock.boss]), [[8, 8, 200, 'kitchen'], [20, 20, 600, 'market'], [50, 50, 1500, 'factory']]);
  for (const id of ['market', 'factory', 'nightmarket']) { assert.equal(scenes[id].boss.mul, 1.35); assert.ok(scenes[id].boss.image && scenes[id].boss.name); assert.notEqual(scenes[id].available, false); }
  assert.equal(scenes.rainynight.available, false);
  assert.ok(E.tripleFor('market') && !E.tripleFor('kitchen') && E.timerFor('factory') === 20 && !E.timerFor('market') && E.giftFor('nightmarket') && !E.giftFor('factory'));
});

test('triple: targeted click only advances that sub; passive and burst split evenly among unfinished subs', () => {
  const need = H('market') / 3;
  let r = E.advancePackage(E.newPackage('market'), 90, 'market', 'click', 1);
  assert.deepEqual(r.package.sub.map(x => x.progress), [0, 90, 0]); near(r.package.progress, 90); assert.equal(r.completed, 0);
  r = E.advancePackage(r.package, 60, 'market', 'passive');
  assert.deepEqual(r.package.sub.map(x => x.progress), [20, 110, 20]);
  // finish sub 1 by targeting; overflow spreads to the two open subs
  r = E.advancePackage(r.package, need - 110 + 40, 'market', 'click', 1);
  near(r.package.sub[1].progress, need); near(r.package.sub[0].progress, 40); near(r.package.sub[2].progress, 40);
  // passive after one sub is done only feeds the other two
  r = E.advancePackage(r.package, 10, 'market', 'passive');
  near(r.package.sub[0].progress, 45); near(r.package.sub[2].progress, 45); near(r.package.sub[1].progress, need);
  let s = enter('market'); s.collection = { caihua: 1 }; s.skillSlots[0] = 'caihua';
  s = E.activate(s, 0, 0).state; const v = s.package.sub.map(x => x.progress); near(v[0], v[1]); near(v[1], v[2]);
});

test('triple: a package completes only when all three subs are torn; overflow enters the next group', () => {
  const need = H('market'), sub = need / 3;
  let p = E.newPackage('market'); p.sub = [{ progress: sub }, { progress: sub }, { progress: sub - 5 }]; p.progress = need - 5;
  let r = E.advancePackage(p, 5 + 12, 'market', 'click', 2);
  assert.equal(r.completed, 1); assert.equal(r.package.index, 2); near(r.package.progress, 12); r.package.sub.forEach(x => near(x.progress, 4));
  // huge passive: many groups, remainder split evenly and validated by the save layer
  r = E.advancePackage(E.newPackage('market'), E.packageSum(1, 5, 'market') + 9, 'market', 'offline');
  assert.equal(r.completed, 5); assert.equal(r.package.index, 6); near(r.package.progress, 9); r.package.sub.forEach(x => near(x.progress, 3));
  const s = enter('market'); s.package = r.package; S.validate(s, Pool);
  // exact fill leaves no ghost progress
  r = E.advancePackage(E.newPackage('market'), need, 'market', 'passive'); assert.equal(r.completed, 1); assert.equal(r.package.progress, 0);
});

test('triple: sweep bonus from the third distinct sub, same sub or hero click resets, window 1.5 s', () => {
  let s = enter('market'); s.clickLevel = 10; s.settledAt = 0;
  const base = E.click(s, 0).amount;
  const a = E.click(s, 100, 0), b = E.click(a.state, 200, 1), c = E.click(b.state, 300, 2), d = E.click(c.state, 400, 0);
  assert.deepEqual([a.sweep, b.sweep, c.sweep, d.sweep], [false, false, true, true]);
  near(c.amount, base * 1.15); near(d.amount, base * 1.15); near(a.amount, base);
  assert.deepEqual(c.state.sweep, { last: 2, count: 3, at: 300 });
  near(c.state.package.sub[2].progress, base * 1.15);
  const same = E.click(b.state, 300, 1); assert.equal(same.sweep, false); assert.equal(same.state.sweep.count, 1);
  const hero = E.click(b.state, 300); assert.equal(hero.sweep, false); assert.deepEqual(hero.state.sweep, { last: null, count: 0, at: 300 });
  hero.state.package.sub.forEach(x => assert.ok(x.progress > 0));
  const late = E.click(b.state, 200 + E.SWEEP_WINDOW_MS + 1, 2); assert.equal(late.sweep, false); assert.equal(late.state.sweep.count, 1);
  const kitchen = S.fresh(0); kitchen.bossWins = ['backyard']; kitchen.settings.scene = 'kitchen'; kitchen.package = E.newPackage('kitchen');
  assert.equal(E.click(kitchen, 0, 0).sweep, false); assert.equal(kitchen.package.sub, undefined);
  S.validate(c.state, Pool);
});

test('timer: deadline stamped on entry, online expiry drops the package without touching coins, chained misses', () => {
  let s = enter('factory'); assert.equal(s.package.deadline, null);
  s = E.settle(s, 1000).state; assert.equal(s.package.deadline, 21000);
  s.collection = { yueyue2: 1 };
  s = E.settle(s, 5000).state; assert.ok(s.package.progress > 0); const coins = s.coins;
  const r = E.settle(s, 21500); s = r.state;
  assert.equal(s.missed, 1); assert.equal(s.package.index, 1); assert.equal(s.package.deadline, 41000);
  near(s.coins - coins, E.rates(s).P * 16.5); near(s.package.progress, E.rates(s).P * .5); near(r.earned, E.rates(s).P * 16.5);
  s = E.settle(s, 100000).state; assert.equal(s.missed, 4); assert.equal(s.package.deadline, 101000); near(s.package.progress, E.rates(s).P * 19);
  S.validate(s, Pool);
});

test('timer: completing a package starts a fresh window; offline never misses, only settles the package up to the deadline', () => {
  let s = enter('factory'); s.clickLevel = 200; s = E.settle(s, 1000).state;
  const r = E.click(s, 4000); assert.ok(r.completed >= 1); assert.equal(r.state.package.deadline, 24000);
  s = enter('factory'); s.collection = { zhenmu: 16 }; s = E.settle(s, 1000).state;
  const P = E.rates(s).P, off = E.settle(s, 3601000, { offline: true }), o = off.state;
  assert.equal(o.missed, 0); near(o.coins - s.coins, P * 3600); near(off.earned, P * 3600);
  // 包裝只結算到 deadline 前（一個 20 秒窗口），之後的時間只進錢包
  const expected = E.advancePackage(E.newPackage('factory'), P * 21, 'factory').package;   // 進場那 1 秒＋到期前的 20 秒
  assert.equal(o.package.index, expected.index); near(o.package.progress, expected.progress); assert.ok(o.package.index > 1);
  assert.equal(o.package.deadline, 3601000 + 20000); assert.equal(o.settledAt, 3601000);
  const again = E.settle(o, 3602000); assert.equal(again.state.missed, 0);
  const d = enter('factory'); d.collection = { zhenmu: 16 }; const fresh = E.settle(d, 25000, { offline: true }).state; assert.equal(fresh.missed, 0);
});

test('timer: boss pauses the belt, a fresh window follows the fight; scene switch restamps', () => {
  let s = enter('factory', 1501); s.settledAt = 0; s = E.settle(s, 1000).state; assert.equal(s.package.deadline, 21000);
  s = E.startBoss(s, 2000); s.collection = { zhenmu: 1 };
  s = E.settle(s, 40000).state; assert.equal(s.boss, null); assert.equal(s.missed, 0); assert.equal(s.package.deadline, 32000 + 20000);
  assert.equal(E.settle(s, 60000).state.missed, 1);   // 王包後的新窗口 52000 到期，切場景前照樣算漏
  let t = E.switchScene(s, 'market', 50000); assert.equal(t.package.deadline, undefined);
  t = E.switchScene(t, 'factory', 90000); assert.equal(t.package.deadline, 110000); assert.equal(t.missed, 0);
  S.validate(t, Pool);
});

test('gift: scheduled with everyMs, spawns with 4×H, only clicks on the gift hit it, win pays H_gift×(mul−1) without package progress', () => {
  const rng = () => 0;
  let s = enter('nightmarket'); s.settledAt = 0;
  s = E.settle(s, 1000, { rng }).state; assert.equal(s.nextGiftAt, 46000); assert.equal(s.gift, null);
  s = E.settle(s, 46000, { rng }).state; assert.deepEqual(s.gift, { need: 4 * H('nightmarket'), dealt: 0, endsAt: 61000 });
  s.clickLevel = 5; const D = E.rates(s).D, coins = s.coins, progress = s.package.progress;
  const hit = E.click(s, 47000, 'gift'); assert.equal(hit.giftHit, true); near(hit.state.gift.dealt, D); near(hit.state.coins, coins + D); near(hit.state.package.progress, progress);
  const hero = E.click(s, 47000); assert.equal(hero.giftHit, false); near(hero.state.gift.dealt, 0); near(hero.state.package.progress, progress + D);
  s.collection = { zhenmu: 1 }; const passive = E.settle(s, 50000, { rng }).state; near(passive.gift.dealt, 0); assert.ok(passive.package.progress > progress);
  let w = hit.state; w.gift.dealt = w.gift.need - 1; const before = w.coins, need = w.gift.need;
  const win = E.click(w, 48000, 'gift'); assert.equal(win.state.gift, null);
  near(win.state.coins - before, win.amount + need * 9); assert.deepEqual(win.state.giftResult, { won: true, at: 48000, bonus: need * 9, need });
  assert.ok(win.state.nextGiftAt >= 48000 + 45000 && win.state.nextGiftAt <= 48000 + 90000); near(win.state.package.progress, progress);
  S.validate(win.state, Pool);
});

test('gift: expires with nothing deducted, hidden counts as expired, scene switch and boss clear it', () => {
  const rng = () => 1;
  let s = enter('nightmarket'); s.settledAt = 0; s.nextGiftAt = 1000; s = E.settle(s, 1000, { rng }).state; assert.ok(s.gift);
  s.gift.dealt = 5; const coins = s.coins;
  const ex = E.settle(s, 16500, { rng }).state; assert.equal(ex.gift, null); assert.deepEqual(ex.giftResult, { won: false, at: 16000, bonus: 0, need: s.gift.need });
  assert.equal(ex.nextGiftAt, 16000 + 90000); assert.ok(ex.coins >= coins);
  const late = E.click(s, 16500, 'gift'); assert.equal(late.giftHit, false); assert.ok(late.state.package.progress > 0);
  const hidden = E.settle(s, 3000, { offline: true, rng }).state; assert.equal(hidden.gift, null); assert.equal(hidden.giftResult.won, false); assert.equal(hidden.nextGiftAt, 3000 + 90000);
  const sw = E.switchScene(s, 'factory', 2000); assert.equal(sw.gift, null);
  let b = enter('nightmarket', 4001); b.nextGiftAt = 1000; b = E.settle(b, 1000, { rng }).state; assert.ok(b.gift);
  b = E.startBoss(b, 2000); assert.equal(b.gift, null); b = E.settle(b, 10000, { rng }).state; assert.equal(b.gift, null);
  assert.equal(E.settle(enter('factory'), 1000).state.nextGiftAt, 0);
});

test('save: old saves gain defaults, new fields validated, forged values rejected, store roundtrip', () => {
  const old = S.fresh(0); for (const k of ['missed', 'sweep', 'gift', 'nextGiftAt', 'giftResult']) delete old[k];
  const v = S.validate(old, Pool); assert.equal(v.missed, 0); assert.deepEqual(v.sweep, { last: null, count: 0, at: 0 }); assert.equal(v.gift, null); assert.equal(v.nextGiftAt, 0);
  const m = enter('market'); delete m.package.sub; m.package.progress = H('market') / 3 + 7;
  const mv = S.validate(m, Pool); near(mv.package.sub[0].progress, H('market') / 3); near(mv.package.sub[1].progress, 7); assert.equal(mv.package.sub[2].progress, 0);
  const f = enter('factory'); delete f.package.deadline; assert.equal(S.validate(f, Pool).package.deadline, null);
  const bad = [
    () => { const s = enter('market'); s.package.sub = [{ progress: 1 }, { progress: 0 }, { progress: 0 }]; return s; },
    () => { const s = enter('market'); s.package.sub[0].progress = H('market') / 3 + 1; s.package.progress = s.package.sub[0].progress; return s; },
    () => { const s = enter('market'); s.package.sub = [{ progress: 0 }, { progress: 0 }]; return s; },
    () => { const s = enter('factory'); s.package.deadline = 'soon'; return s; },
    () => { const s = S.fresh(0); s.missed = -1; return s; },
    () => { const s = S.fresh(0); s.sweep = { last: 3, count: 1, at: 0 }; return s; },
    () => { const s = S.fresh(0); s.sweep = { last: null, count: 2, at: 0 }; return s; },
    () => { const s = S.fresh(0); s.gift = { need: 100, dealt: 0, endsAt: 1 }; return s; },
    () => { const s = enter('nightmarket'); s.gift = { need: 100, dealt: 100, endsAt: 1 }; return s; },
    () => { const s = enter('nightmarket'); s.giftResult = { won: false, at: 0, bonus: 5, need: 1 }; return s; },
  ];
  for (const make of bad) assert.throws(() => S.validate(make(), Pool));
  let s = enter('nightmarket'); s.nextGiftAt = 1000; s = E.settle(s, 1000).state; s.gift.dealt = 3;
  const store = S.create({ getItem: () => JSON.stringify(s) }, { now: () => 2000, pool: Pool });
  assert.equal(store.blocked, false); assert.deepEqual(store.state.gift, s.gift);
  let t = enter('factory'); t = E.settle(t, 1000).state; t.missed = 4;
  const raw = {}; const st = S.create({ getItem: () => null, setItem: (k, v) => { raw[k] = v; } }, { now: () => 1000, pool: Pool });
  assert.ok(st.commit(t)); assert.equal(JSON.parse(raw.clicker_save).package.deadline, 21000); assert.equal(JSON.parse(raw.clicker_save).missed, 4);
});
