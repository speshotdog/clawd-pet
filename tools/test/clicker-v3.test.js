// v3（2026-09-12）：牆、編隊、有限印記、當家、派遣、重整／充能、寶箱、大掃除（DESIGN-balance-v3.md）
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), B = require('../../src/clicker-balance.js'), P = require('../../src/clicker-prestige.js'), Pool = require('../../src/gacha-pool.js');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ~= ${b}`);
const seed = (over = {}) => { const s = S.fresh(0); s.collection = { zhenmu: 16 }; s.dust = { zhenmu: 16 }; s.coins = 1e6; s.lifetimeCoins = 1e6; Object.assign(s, over); return s; };
const V = B.V3;

test('v3 小王：第 10 包拆完擋路，拆包力只進錢包；自動挑戰、輸了 30 秒冷卻、贏了放行', () => {
  let s = seed({ collection: { yueyue2: 1 }, dust: { yueyue2: 1 } }); s.package = E.newPackage('backyard', 10); s.package.progress = E.requirement(10) - 1;   // P=4/s，30 秒打不掉 2×H(10)
  s = E.click(s, 1000).state;   // 拆完第 10 包 → 路障
  assert.deepEqual(s.package.gate, { index: 10, cooldownUntil: 0 }); assert.equal(s.package.index, 11);
  assert.ok(s.boss && s.boss.gate === 10, '自動挑戰：結算時直接開打');
  near(s.boss.need, V.GATE_MUL * E.requirement(10)); assert.equal(s.boss.endsAt, 1000 + V.GATE_SECONDS * 1000);
  S.validate(JSON.parse(JSON.stringify(s)), Pool);
  const coins = s.coins, lost = E.settle(s, 1000 + 31000).state;   // 30 秒沒打完
  assert.equal(lost.boss, null); assert.equal(lost.package.gate.cooldownUntil, 1000 + 30000 + V.GATE_COOLDOWN * 1000);
  assert.ok(lost.coins > coins, '打王期間的被動照樣進錢包'); assert.equal(lost.package.progress, 0, '路障期間不推包');
  assert.equal(lost.bossResult.gate, 10); assert.equal(lost.bossResult.won, false);
  assert.throws(() => E.startGate(lost, lost.settledAt), /沒有待打/);
  assert.equal(lost.package.gate.lost, true);
  const idle = E.settle(lost, lost.package.gate.cooldownUntil + 5000).state; assert.equal(idle.boss, null, '輸過一次就不自動再打，等玩家點挑戰');
  const retry = E.startGate(idle, idle.settledAt); assert.ok(retry.boss);
  const c0 = retry.coins, won = E.click({ ...retry, clickLevel: 200 }, retry.settledAt + 1).state;   // 一擊打穿
  assert.equal(won.boss, null); assert.equal(won.package.gate, undefined); assert.equal(won.runGates, 1); assert.equal(won.bossResult.won, true);
  near(won.bossResult.bonus, E.requirement(10) * V.GATE_REWARD); assert.ok(won.coins - c0 >= won.bossResult.bonus, 'C 路：小王給一次性大錢');
  const after = E.click(won, won.settledAt + 1).state; assert.ok(after.package.progress > 0 || after.package.index > 11, '放行後恢復推包');
});
test('v3 小王：關掉自動挑戰就停在路障；第 50 包是 area 王 ×1.5；門檻包之後交給大王', () => {
  let s = seed(); s.settings.autoChallenge = false; s.settings.scene = 'nightmarket'; s.bossWins = ['backyard','kitchen','market','factory']; s.package = E.newPackage('nightmarket', 50); s.package.progress = E.requirement(50, 'nightmarket') - 1;
  s = E.click(s, 1000).state; assert.equal(s.boss, null); assert.ok(s.package.gate);
  s = E.startGate(s, 2000); near(s.boss.need, V.GATE_MUL * V.AREA_MUL * E.requirement(50, 'nightmarket'));
  let t = seed(); t.settings.scene = 'nightmarket'; t.bossWins = ['backyard','kitchen','market','factory']; t.package = E.newPackage('nightmarket', 90); t.package.progress = E.requirement(90, 'nightmarket') - 1;
  t = E.click(t, 1000).state; assert.equal(t.package.gate, undefined, '第 90 包是夜市的門檻，不出小王'); assert.ok(E.canBoss(t, 1000));
});
test('v3 大王：血量是門檻包的函數；每輪可重打；通關章門檻減半；runWins 進印記', () => {
  let s = seed(); s.package.index = 51; s = E.startBoss(s, 0); near(s.boss.need, V.BOSS_MUL * E.requirement(51) * 1.25);
  s.boss.dealt = s.boss.need - 1; s = E.click(s, 1).state;
  assert.deepEqual(s.bossWins, ['backyard']); assert.deepEqual(s.runWins, ['backyard']); assert.equal(s.universalDust, 3);
  near(s.bossResult.bonus, E.requirement(51) * 1.25 * V.BOSS_REWARD);
  assert.equal(P.marksTotal(s), 1); assert.equal(P.canPrestige(s), null);
  const r = P.prestige(s, 10, () => .5).state; assert.deepEqual(r.runWins, []); assert.deepEqual(r.bossWins, ['backyard']);
  assert.equal(E.bossPackagesFor(r, 'backyard'), 25, '贏過的站門檻減半');
  r.package.index = 26; assert.ok(E.canBoss(r, 10)); const again = E.startBoss(r, 10); near(again.boss.need, V.BOSS_MUL * E.requirement(51) * 1.25, 1e-9);
  again.boss.dealt = again.boss.need - 1; const w = E.click(again, 11).state;
  assert.deepEqual(w.runWins, ['backyard']); assert.equal(w.universalDust, 3 + 3, '輪迴給 3、首勝獎勵不重發'); assert.equal(w.freeDraws, 5);
  S.validate(JSON.parse(JSON.stringify(w)), Pool);
});
test('v3 編隊：前綴上限用出身；只有隊伍裡的產錢；空隊伍＝自動編隊；技能槽要在隊伍裡', () => {
  const s = S.fresh(0); s.coins = s.lifetimeCoins = 1e6;
  for (const id of Object.keys(B.characters)) { s.collection[id] = 1; s.dust[id] = 1; }
  const all = E.rosterOf(s); assert.equal(all.length, 20); assert.deepEqual(E.rosterViolations(all), []);
  const mythics = Object.keys(B.characters).filter(id => E.origin(id) === 3);
  assert.throws(() => E.setRoster(s, mythics.slice(0, 3), 0), /階級上限/);
  const legendaries = Object.keys(B.characters).filter(id => E.origin(id) === 2);
  assert.throws(() => E.setRoster(s, [...mythics.slice(0, 2), ...legendaries.slice(0, 5)], 0), /階級上限/);   // 2 + 5 = 7 > 6
  let t = E.setRoster(s, ['yueyue2', 'zhenmu'], 0); near(E.rates(t).P, E.rates({ ...s, roster: ['yueyue2', 'zhenmu'] }).P);
  assert.ok(E.rates(t).P < E.rates(s).P, '兩張的隊伍比自動編的二十張弱');
  assert.throws(() => E.equip(t, 0, 'yang', 0), /先編入隊伍/); t = E.equip(t, 0, 'zhenmu', 0);
  t = E.setRoster(t, ['yueyue2'], 0); assert.deepEqual(t.skillSlots, [null, null, null], '離隊一併離開技能槽');
  // 升階不改所屬層：精良升到傳說階仍佔精良格
  const u = S.fresh(0); for (const id of legendaries.slice(0, 6)) { u.collection[id] = 1; u.dust[id] = 1; }
  u.collection.yueyue2 = 50; u.dust.yueyue2 = 50; u.promotions.yueyue2 = 2;
  assert.deepEqual(E.rosterViolations([...legendaries.slice(0, 6), 'yueyue2']), []);
  S.validate(JSON.parse(JSON.stringify(E.setRoster(u, [...legendaries.slice(0, 6), 'yueyue2'], 0))), Pool);
  // 新夥伴自動入隊
  const n = S.fresh(0); n.manualClicks = 49; const c = E.click(n, 0).state; assert.deepEqual(c.roster, ['yueyue2']); assert.equal(c.skillSlots[0], 'yueyue2');
});
test('v3 當家：×1.5、CD ×.8；輪迴重抽；遷移時確定性抽', () => {
  const s = seed(); s.collection = { zhenmu: 16, yueyue2: 1 }; s.dust = { zhenmu: 16, yueyue2: 1 }; s.roster = ['zhenmu', 'yueyue2'];
  const base = E.individual(s, 'zhenmu'); s.champions = ['zhenmu']; near(E.individual(s, 'zhenmu'), base * 1.5);
  s.settings.scene = 'fridge'; s.bossWins = ['backyard','kitchen','market','factory','nightmarket']; s.package = E.newPackage('fridge');
  near(E.skillAt(s, 'zhenmu').cd, B.skillAt('zhenmu', 5).cd * .8 * .8, 1e-9);   // 冰箱當家 ×.8 × 本輪當家 ×.8
  const a = E.activate({ ...s, skillSlots: ['zhenmu', null, null], settledAt: 0 }, 0, 0).state; S.validate(JSON.parse(JSON.stringify(a)), Pool);
  s.settings.scene = 'backyard'; s.package = E.newPackage('backyard'); s.runWins = ['backyard'];
  const r = P.prestige(s, 0, () => 0).state; assert.equal(r.champions.length, 2); assert.notDeepEqual(new Set(r.champions).size, 1);
});
test('v3 派遣：只派不在隊的、3 格、4 小時、回收給粉塵、每日 9 次上限、輪迴不清', () => {
  const s = seed(); for (const id of ['yueyue2', 'caihua', 'lk', 'yang', 'dog']) { s.collection[id] = 1; s.dust[id] = 1; }
  s.roster = ['zhenmu']; s.settings.autoChallenge = false;   // 四小時的被動會拆到路障，這條只看派遣
  assert.throws(() => E.dispatch(s, 'zhenmu', 0), /無法派遣/);
  let t = E.dispatch(s, 'yueyue2', 0); t = E.dispatch(t, 'caihua', 0); t = E.dispatch(t, 'lk', 0);
  assert.throws(() => E.dispatch(t, 'yang', 0), /無法派遣/); assert.throws(() => E.setRoster(t, ['zhenmu', 'yueyue2'], 0), /不合法/);
  assert.throws(() => E.recall(t, 1000), /還沒回來/); S.validate(JSON.parse(JSON.stringify(t)), Pool);
  const r = E.recall(t, V.DISPATCH_MS + 1); assert.equal(r.rewards.length, 3); assert.equal(r.state.dust.yueyue2, 2); assert.equal(r.state.universalDust, 3); assert.deepEqual(r.state.dispatch, []);
  let u = r.state; u.roster = ['yueyue2']; u = E.dispatch(u, 'zhenmu', u.settledAt);
  u = E.recall(u, u.settledAt + V.DISPATCH_MS).state; assert.equal(u.dust.zhenmu, 16, '傳說半顆：第一次只記帳'); assert.equal(u.dispatchHalf.zhenmu, 1);
  u = E.dispatch(u, 'zhenmu', u.settledAt); u = E.recall(u, u.settledAt + V.DISPATCH_MS).state; assert.equal(u.dust.zhenmu, 17); assert.equal(u.dispatchHalf.zhenmu, 0);
  u.dispatchDay = { day: Math.floor(u.settledAt / 86400000), count: V.DISPATCH_DAILY };
  u = E.dispatch(u, 'caihua', u.settledAt); const capped = E.recall(u, u.settledAt + V.DISPATCH_MS); assert.equal(capped.rewards[0].capped, true); assert.equal(capped.state.dust.caihua, 2);
  u = E.dispatch(capped.state, 'lk', capped.state.settledAt); u.bossWins = ['backyard']; u.runWins = ['backyard'];
  const p = P.prestige(u, u.settledAt, () => .5).state; assert.equal(p.dispatch.length, 1); S.validate(JSON.parse(JSON.stringify(p)), Pool);
});
test('v3 重整／充能：重整清其他槽 CD、充能讓下一個技能 ×2、都算一次連鎖；快照通過驗證', () => {
  const s = seed(); for (const id of ['seal', 'chaichai', 'yueyue']) { s.collection[id] = 1; s.dust[id] = 1; }
  s.roster = ['zhenmu', 'seal', 'chaichai', 'yueyue']; s.lifetimeCoins = 2e5; s.coins = 2e5; s.skillSlots = ['yueyue', 'seal', 'chaichai']; s.slotReadyAt = [0, 0, 0];
  assert.equal(B.characters.seal.kind, 'energize'); assert.match(B.skillAt('seal', 1).desc(B.skillAt('seal', 1)), /×2/);
  let a = E.activate(s, 0, 0).state; assert.throws(() => E.activate(a, 0, 1), /冷卻/);
  a = E.activate(a, 2, 1000).state; assert.equal(a.cooldownUntil.yueyue, 0, '重整清掉玥玥的冷卻'); assert.ok(a.cooldownUntil.chaichai > 1000); assert.equal(a.chain.count, 2);
  a = E.activate(a, 1, 2000).state; assert.equal(a.energized, true); assert.equal(a.chain.count, 3);
  const plain = E.activate({ ...s, chain: { count: 1, expiresAt: 0 } }, 0, 0).effect.multiplier;
  const r = E.activate(a, 0, 3000); assert.equal(r.state.energized, undefined); assert.equal(r.effect.energized, 2);
  near(r.effect.multiplier - 1, (plain - 1) * 2, 1e-9);   // 連鎖窗到第三個就關（重整、充能各吃掉一格），第四個從 ×1 起算，再充能 ×2
  S.validate(JSON.parse(JSON.stringify(r.state)), Pool);
});
test('v3 寶箱包：種子決定、率 3%＋Lv150 隊員各 1%、拆完加 requirement×8、離線不出', () => {
  const s = seed(); s.chestSeed = 12345;
  const hits = Array.from({ length: 2000 }, (_, i) => E.isChest(s, i + 1)).filter(Boolean).length;
  assert.ok(hits > 30 && hits < 100, `2000 包命中 ${hits}（期望 60）`);
  assert.equal(E.chestRate({ ...s, roster: ['zhenmu'], partnerLevels: { zhenmu: 150 } }), .04);
  const idx = Array.from({ length: 2000 }, (_, i) => i + 1).find(i => E.isChest(s, i) && i % 10 !== 0);
  let t = { ...s, package: E.newPackage('backyard', idx), settledAt: 1000 }; t.package.progress = E.requirement(idx) - 1;
  const before = t.coins, r = E.click(t, 1000); near(r.state.coins - before - r.amount, E.requirement(idx) * V.CHEST_MUL, 1e-9); assert.ok(r.chest > 0);
  let o = { ...s, package: E.newPackage('backyard', idx), settledAt: 0 }; o.package.progress = E.requirement(idx) - 1; o.clickLevel = 30;
  const off = E.settle(o, 5000, { offline: true }); assert.equal(off.state.coins - before, off.earned, '離線沒有寶箱加成');
});
test('v3 大掃除：v2 存檔重算印記、祝福買到頂、原值封存、當家確定性、roster 自動編', () => {
  const s = S.fresh(0); s.version = 2; delete s.roster; delete s.runWins; delete s.champions; delete s.dispatch; delete s.legacy; delete s.chestSeed; delete s.settings.autoChallenge;
  s.collection = { zhenmu: 16, yueyue2: 3 }; s.dust = { zhenmu: 16, yueyue2: 3 };
  s.prestiges = 12; s.marksClaimed = 1069453; s.marks = 500; s.blessing = 1462; s.lifetimeCoins = 1.1e20; s.coins = 1e6; s.markShop = { slot4: true, bossTime: true }; s.dustTrades = 3;
  s.skillSlots = [null, null, null, null]; s.slotReadyAt = [0, 0, 0, 0]; s.bossWins = ['backyard', 'kitchen'];
  const v = S.validate(JSON.parse(JSON.stringify(s)), Pool);
  assert.equal(v.version, 3); assert.deepEqual(v.legacy, { ...v.legacy, marksClaimed: 1069453, blessing: 1462, marks: 500, prestiges: 12, lifetimeCoins: 1.1e20 });
  assert.equal(v.blessing, 16); assert.equal(v.marks, 144 - 136, '12 輪 × 12 = 144 枚：買到 Lv.16 花 136、剩 8'); assert.equal(v.marksClaimed, 144 + 6 + 6, '已買的商店 6 與粉塵兌換 6 照舊承認');
  near(E.blessMul(v), 2.6); assert.equal(E.markMul(v), 1);
  assert.equal(v.champions.length, 2); assert.deepEqual(v.champions, S.validate(JSON.parse(JSON.stringify(s)), Pool).champions, '同一份存檔抽到同樣的當家');
  assert.deepEqual(v.roster, ['zhenmu', 'yueyue2']); assert.deepEqual(v.runWins, []); assert.equal(v.settings.autoChallenge, true);
  S.validate(JSON.parse(JSON.stringify(v)), Pool);
  const few = S.fresh(0); few.version = 2; few.prestiges = 1; few.collection = { zhenmu: 1 }; few.dust = { zhenmu: 1 };
  const f = S.validate(JSON.parse(JSON.stringify(few)), Pool); assert.equal(f.blessing, 4); assert.equal(f.marks, 2);   // 12 枚：1+2+3+4 = 10，剩 2
});
test('v3 商店：點擊附加 5%→10%→15%、要先買前一項；招募券停售', () => {
  let s = seed({ marks: 6, marksClaimed: 6 }); const d0 = E.rates(s).D, P0 = E.rates(s).P;
  assert.throws(() => P.buyMark(s, 'tapShare2', 0), /前一項/);
  s = P.buyMark(s, 'tapShare1', 0); near(E.rates(s).D - d0, .05 * P0, 1e-9);
  s = P.buyMark(s, 'tapShare2', 0); near(E.rates(s).D - d0, .10 * P0, 1e-9); S.validate(s, Pool);
  assert.ok(!B.blessings.some(b => b.id === 'drawTicket'));
});
test('D 路神器：7 條線第 r 級收 r 枚、各有頂；效果進 rates／技能／冷卻／離線／寶箱／輪迴粉塵；總量上限 100', () => {
  let s = seed({ marks: 30, marksClaimed: 30 }); s.collection.yang = 1; s.dust.yang = 1; s.roster = ['zhenmu', 'yang']; s.skillSlots = ['yang', null, null]; s.slotReadyAt = [0, 0, 0]; s.lifetimeCoins = 1e6;
  const d0 = E.rates(s).D, cd0 = E.skillAt(s, 'yang').cd;
  s = P.buyArtifact(s, 'tap', 0); s = P.buyArtifact(s, 'tap', 0);   // 1 + 2 = 3 枚
  near(E.rates(s).D, d0 * 1.2, 1e-9); assert.equal(s.marks, 27); assert.equal(s.artifacts.tap, 2);
  s = P.buyArtifact(s, 'skill', 0); s = P.buyArtifact(s, 'cd', 0); s = P.buyArtifact(s, 'chest', 0); s = P.buyArtifact(s, 'dust', 0); s = P.buyArtifact(s, 'offline', 0);
  assert.equal(s.marks, 27 - 5); near(E.chestRate(s), .04, 1e-9);
  const a = E.activate(s, 0, 0); near(a.effect.value, E.rates(s).P * E.skillAt(s, 'yang').ratio * 1.05, 1e-9);   // 羊咩 team：全隊 P × ratio × 技能祝福 1.05
  near(a.state.cooldownUntil.yang, cd0 * 1000 * .98, 1e-6); assert.deepEqual(a.effect.arts, { skill: 1, cd: 1 });
  S.validate(JSON.parse(JSON.stringify(a.state)), Pool);
  for (let i = 0; i < 9; i++) s = P.buyArtifact({ ...s, marks: 100 }, 'cd', 0);
  assert.equal(s.artifacts.cd, 10); assert.throws(() => P.buyArtifact({ ...s, marks: 100 }, 'cd', 0), /滿級/);
  let o = { ...s, settledAt: 0 }; const off = E.settle(o, 3600000, { offline: true }); near(off.earned, E.rates(o).P * 3600 * 1.1, 1e-6);
  s.bossWins = ['backyard']; s.runWins = ['backyard']; const r = P.prestige(s, 0, () => .5); assert.equal(r.state.universalDust, 3 + 1);
  const capped = P.prestige({ ...s, marksClaimed: 99 }, 0, () => .5); assert.equal(capped.gained, 1, '總量上限 100');
});
