// v3 末世經濟純邏輯（2026-09-13）
const test = require('node:test');
const assert = require('node:assert');
globalThis.ApocPool = [
  { id: 'pufayueyue', name: '普發玥玥', rarity: 'rare' }, { id: 'm1', name: 'M1', rarity: 'mythic' }, { id: 'm2', name: 'M2', rarity: 'mythic' }, { id: 'm3', name: 'M3', rarity: 'mythic' },
  { id: 'l1', name: 'L1', rarity: 'legendary' }, { id: 'e1', name: 'E1', rarity: 'epic' },
];
require('../../src/clicker-apoc-economy.js');
const A = globalThis.ApocEconomy, R = A.RULES;

test('開門禮：普發玥玥入隊＋10 券，只給一次', () => {
  const a = A.gift(A.fresh());
  assert.equal(a.tickets, 10); assert.equal(a.collection.pufayueyue, 1); assert.deepEqual(a.roster, ['pufayueyue']);
  assert.equal(A.gift(a).tickets, 10);
});
test('戰力：四階 100/85/72/60，重複升星 +25%', () => {
  let a = A.gift(A.fresh()); a = A.drawn({ ...a, tickets: 3 }, ['m1', 'pufayueyue', 'e1']);
  assert.equal(a.tickets, 0); assert.equal(a.collection.pufayueyue, 2);
  assert.equal(A.cardPower(a, 'pufayueyue'), 75); assert.equal(A.power(a), 100 + 75 + 72);
});
test('抽到的卡自動入隊但不超過階級上限', () => {
  let a = A.gift(A.fresh()); a = A.drawn({ ...a, tickets: 3 }, ['m1', 'm2', 'm3']);
  assert.deepEqual(a.roster, ['pufayueyue', 'm1', 'm2']); assert.equal(a.collection.m3, 1);
  assert.throws(() => A.setTeam(a, ['m1', 'm2', 'm3']), /階級上限/);
});
test('一般關：放置＋點擊打到 0 就通關、拿獎勵、進度 +1', () => {
  let a = A.gift(A.fresh()); const now = 1e6;
  assert.throws(() => A.fight({ ...a, roster: [] }, now), /隊伍是空的/);
  a = A.fight(a, now); assert.equal(a.stage.need, A.need(0)); assert.equal(a.stage.deadline, null);
  let r = A.settle(a, now + 1000, 1); assert.equal(r.events.length, 0); assert.ok(r.state.stage.hp < A.need(0));
  a = A.tap(r.state, now); assert.equal(a.stage.hp, r.state.stage.hp - 60 * R.CLICK_SHARE);
  a = { ...a, stage: { ...a.stage, hp: 1 } }; r = A.settle(a, now + 2000, 1);
  assert.deepEqual(r.events[0], { type: 'win', index: 0, reward: A.reward(0) }); assert.equal(r.state.progress, 1); assert.equal(r.state.stage, null);
  assert.ok(r.state.coins >= A.reward(0));
});
test('王關時限（預設關閉，RULES.BOSS_TIME 給值才生效）：時間到失敗、進冷卻、之後才能再打', () => {
  const now = 1e6;
  // 預設是關的：王關不給 deadline，永遠不會因為時間到而失敗
  assert.equal(R.BOSS_TIME, 0);
  assert.equal(A.fight({ ...A.gift(A.fresh()), progress: 3 }, now).stage.deadline, null);
  const saved = R.BOSS_TIME; R.BOSS_TIME = 60000;
  try {
    let a = A.fight({ ...A.gift(A.fresh()), progress: 3 }, now);
    assert.ok(a.stage.boss); assert.equal(a.stage.deadline, now + R.BOSS_TIME);
    const r = A.settle(a, now + R.BOSS_TIME, 0); assert.equal(r.events[0].type, 'fail'); assert.equal(r.state.cooldownUntil, now + R.BOSS_TIME + R.BOSS_COOLDOWN);
    assert.equal(A.canFight(r.state, now + R.BOSS_TIME + 1000), false); assert.equal(A.canFight(r.state, r.state.cooldownUntil), true);
  } finally { R.BOSS_TIME = saved; }
});
// --- 第三輪（使用者定案）：末世金幣直接抽卡；券只從 1.0 金幣換（時薪券），抽的時候先用券
test('抽卡直接花末世金幣：第一抽 1000、每付費抽一次漲 2%；先用券，不夠的才付錢', () => {
  const a = { ...A.fresh(), coins: 1500 };
  assert.equal(A.drawCost(a, 1), 1000);
  const one = A.purchaseDraw(a, 1, 0, () => .9);
  assert.equal(one.coins, 500); assert.equal(one.paidDraws, 1); assert.equal(one.stats.draws, 1); assert.ok(one.pending);
  assert.throws(() => A.purchaseDraw(a, 10, 0), /不足/);
  const rich = { ...A.fresh(), coins: 1e9, paidDraws: 100 };
  assert.equal(A.drawCost(rich, 3), [0, 1, 2].reduce((n, i) => n + Math.round(1000 * R.DRAW_GROWTH ** (100 + i)), 0));
  // 7 張券抽十連：7 張免費、3 張付錢
  const mixed = { ...A.fresh(), coins: 1e6, tickets: 7 };
  assert.equal(A.drawCost(mixed, 10), [0, 1, 2].reduce((n, i) => n + Math.round(1000 * R.DRAW_GROWTH ** i), 0));
  const after = A.purchaseDraw(mixed, 10, 0, () => .9);
  assert.equal(after.tickets, 0); assert.equal(after.paidDraws, 3); assert.equal(after.coins, 1e6 - A.drawCost(mixed, 10));
  // 收下不再扣錢／扣券，只落帳
  const got = A.collectDraw(after, after.pending.draw.id, 0).state;
  assert.equal(got.tickets, 0); assert.equal(got.coins, after.coins); assert.equal(Object.values(got.collection).reduce((x, y) => x + y, 0), 10);
});
test('桌邊金幣換券（時薪券）：一張＝桌邊 10 分鐘收益，當天每換一張 ×1.25，隔天重置', () => {
  const day = 86400000 * 20000, P = 1e10;
  let a = A.fresh();
  assert.equal(A.exchangeCost(a, P, day), P * 600);
  let r = A.exchange(a, 1e20, P, day + 1000); a = r.state;
  assert.equal(r.cost, P * 600); assert.equal(a.tickets, 1);
  assert.equal(A.exchangeCost(a, P, day + 2000), Math.ceil(P * 600 * 1.25));
  a = A.exchange(a, 1e20, P, day + 3000).state;
  assert.equal(A.exchangeCost(a, P, day + 4000), Math.ceil(P * 600 * 1.25 ** 2));
  assert.equal(A.exchangeCost(a, P, day + 86400000), P * 600, '隔天回到原價');
  assert.equal(a.exchange.total, 2);
  assert.throws(() => A.exchange(a, P * 600, P, day + 5000), /不足/);
  assert.throws(() => A.exchange(a, 1e20, 0, day), /沒有每秒收益/);
  // 日期往回調不能重置加價（Codex 第三輪）：前進一天換一張，再調回原日，價格照最後紀錄那天算
  let b = A.exchange(a, 1e20, P, day + 86400000).state;
  assert.equal(A.exchangeCost(b, P, day + 6000), Math.ceil(P * 600 * 1.25), '調回前一天：沿用最後那天的 1 張');
  b = A.exchange(b, 1e20, P, day + 7000).state;
  assert.equal(b.exchange.day, Math.floor((day + 86400000) / 86400000), '日界不會往回退');
  assert.equal(A.normalize({ ...A.fresh(), onePeak: 'x' }).onePeak, 0);
});
test('訓練：全隊訓練每級戰力 +3%、點擊力每級每下 +5%；費用每級 ×2；「最多」買到錢不夠為止', () => {
  const T = R.TRAIN;
  let a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], coins: T.team.COST });
  const p0 = A.power(a);
  a = A.train(a, 'team').state;
  assert.equal(a.teamLevel, 1); assert.equal(a.coins, 0); assert.ok(Math.abs(A.power(a) - p0 * (1 + T.team.MUL)) < 1e-9);
  assert.throws(() => A.train(a, 'team'), /不足/);
  const two = T.click.COST + Math.round(T.click.COST * T.click.GROWTH);
  let b = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], coins: two + 100 }), 0);
  const r = A.train(b, 'click', true);
  assert.equal(r.levels, 2); assert.equal(r.state.clickLevel, 2); assert.equal(r.state.coins, 100);
  assert.ok(Math.abs(A.tapDamage(r.state, 0) - A.power(b) * R.CLICK_SHARE * (1 + 2 * T.click.MUL)) < 1e-9);
  assert.equal(A.trainCost(r.state, 'click'), Math.round(T.click.COST * T.click.GROWTH ** 2));
});
test('戰績：點擊數、最高一擊、破盾次數會累積', () => {
  let a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 }), 0);
  for (let i = 0; i < R.SHIELD.TAPS; i++) a = A.tap(a, 0);
  assert.equal(a.stats.taps, R.SHIELD.TAPS); assert.equal(a.stats.shieldBreaks, 1);
  const hit = A.tapDamage(a, 0); a = A.tap(a, 0);
  assert.equal(a.stats.maxHit, hit, '破防中的一下 ×2 是目前最高');
});
test('normalize：壞欄位歸零、不在收藏的卡出隊、進度不符的戰鬥丟掉', () => {
  const a = A.normalize({ unlocked: true, collection: { m1: 1 }, roster: ['m1', 'ghost'], skills: ['m1', 'ghost'], stage: { index: 5, hp: 10 }, progress: 0 });
  assert.deepEqual(a.roster, ['m1']); assert.deepEqual(a.skills, ['m1', null, null, null]); assert.equal(a.stage, null);
});

// --- 王關護盾＋節奏（使用者 2026-09-13：節奏用點擊次數，不要太嚴苛）
function bossReady() {
  let a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 });
  return A.fight(a, 0);
}
test('王關：進場帶護盾；護盾在場放置只剩三成五，點擊照常', () => {
  const a = bossReady(), p = A.power(a);
  assert.equal(a.stage.boss, true); assert.equal(a.stage.shield.need, R.SHIELD.TAPS); assert.equal(a.stage.shield.taps, 0);
  const idle = A.settle(a, 1000, 1).state;
  assert.ok(Math.abs((a.stage.hp - idle.stage.hp) - p * R.SHIELD.IDLE_MUL) < 1e-6, '放置 ×0.35');
  const tapped = A.tap(a, 0);
  assert.ok(Math.abs((a.stage.hp - tapped.stage.hp) - p * R.CLICK_SHARE) < 1e-6, '點擊不打折');
  assert.equal(tapped.stage.shield.taps, 1, '這一下算進破盾進度');
});
test('王關節奏：點滿 15 下破防 8 秒、全傷害 ×2，破防結束重新起盾且門檻變高', () => {
  let a = bossReady(), p = A.power(a);
  for (let i = 0; i < R.SHIELD.TAPS; i++) a = A.tap(a, 0);
  assert.equal(a.stage.breakUntil, R.SHIELD.BREAK_MS, '破防中');
  const before = a.stage.hp, hit = A.tap(a, 0);
  assert.ok(Math.abs((before - hit.stage.hp) - p * R.CLICK_SHARE * R.SHIELD.BREAK_MUL) < 1e-6, '破防時點擊 ×2');
  const idle = A.settle(a, 1000, 1).state;
  assert.ok(Math.abs((before - idle.stage.hp) - p * R.SHIELD.BREAK_MUL) < 1e-6, '破防時放置也 ×2');
  const after = A.settle(a, R.SHIELD.BREAK_MS + 1, 0).state;
  assert.equal(after.stage.breakUntil, 0);
  assert.equal(after.stage.shield.cycle, 1);
  assert.equal(after.stage.shield.need, Math.round(R.SHIELD.TAPS * R.SHIELD.GROWTH));
});
test('一般關沒有護盾，放置照原速', () => {
  let a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'] });
  a = A.fight(a, 0); assert.equal(a.stage.boss, false); assert.equal(a.stage.shield, null);
  const idle = A.settle(a, 1000, 1).state;
  assert.ok(Math.abs((a.stage.hp - idle.stage.hp) - A.power(a)) < 1e-6);
});

// --- 獨立技能格：沿用 1.0 語意（點擊倍率／全隊加成／冷卻縮短）
const teamed = (skills) => A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1, l1: 1, e1: 1, pufayueyue: 1 }, roster: ['m1', 'l1', 'e1', 'pufayueyue'], skills });
test('技能由卡的稀有度決定；神話＝次數型 ×10、史詩＝全隊 ×1.5、精良＝縮短其他格冷卻', () => {
  let a = teamed(['m1', 'e1', 'pufayueyue', null]);
  assert.equal(A.skillOf(a, 0).kind, 'clickMul'); assert.equal(A.skillOf(a, 1).kind, 'powerMul'); assert.equal(A.skillOf(a, 2).kind, 'cool');
  assert.equal(A.skillOf(a, 3), null);
  assert.throws(() => A.useSkill(a, 3, 0), /還沒放卡/);

  // 次數型：接下來 10 下 ×10，用完自動退掉
  let b = A.fight(A.useSkill(a, 0, 0), 0);
  const base = A.power(b) * R.CLICK_SHARE;
  let hp = b.stage.hp; b = A.tap(b, 0);
  assert.ok(Math.abs((hp - b.stage.hp) - base * 10) < 1e-6, '第一下 ×10');
  for (let i = 1; i < 10; i++) b = A.tap(b, 0);
  assert.equal(b.fx.clickLeft, 0);
  hp = b.stage.hp; b = A.tap(b, 0);
  assert.ok(Math.abs((hp - b.stage.hp) - base) < 1e-6, '第 11 下回到原本');
  assert.throws(() => A.useSkill(b, 0, 1000), /冷卻中/);

  // 全隊加成：20 秒內戰力 ×1.5，到期自動退
  let c = A.useSkill(a, 1, 0);
  assert.ok(Math.abs(A.view(c, 0).power - A.power(a) * 1.5) < 1e-6);
  assert.ok(Math.abs(A.view(c, 20001).power - A.power(a)) < 1e-6);
  assert.equal(A.settle(c, 20001, 0).state.fx.powerMul, 1);

  // 重整：自己照常進冷卻，其他格各減 8 秒
  let d = A.useSkill(A.useSkill(a, 0, 0), 2, 0);
  assert.equal(d.skillCd[0], R.SKILLS.mythic.cd - R.SKILLS.rare.value);
  assert.equal(d.skillCd[2], R.SKILLS.rare.cd);
  assert.ok(!A.canSkill(d, 0, 0) && A.canSkill(d, 0, d.skillCd[0]));
});

// --- Codex 複檢 2-2：pending 是玩家能改的存檔內容，壞資料要擋在 normalize
test('normalize 擋掉壞掉的 pending：entries 有 null、卡片不在卡池、張數不對', () => {
  const base = { ...A.fresh(), unlocked: true, tickets: 10 };
  const draw = ids => ({ id: 'x', entries: ids.map((id, i) => ({ key: `x:${i}`, entry: { id }, dup: false, owned: 0 })) });
  assert.equal(A.normalize({ ...base, pending: { draw: { id: 'x', entries: [null] } } }).pending, null, 'entries 有 null');
  assert.equal(A.normalize({ ...base, pending: { draw: draw(['missing']) } }).pending, null, '卡片不在末世卡池');
  assert.equal(A.normalize({ ...base, pending: { draw: draw(['m1', 'm2', 'l1']) } }).pending, null, '張數不是 1 或 10');
  assert.ok(A.normalize({ ...base, pending: { draw: draw(['m1']) } }).pending, '單抽是合法的');
});
test('未知卡片不會憑空生券（以前是默默過濾掉、券卻沒扣回來）', () => {
  const a = { ...A.fresh(), tickets: 10 };
  assert.throws(() => A.drawn(a, ['missing']), /不在末世卡池/);
  assert.equal(A.drawn({ ...a }, ['m1']).tickets, 9);
});
test('付費抽數非有限數要歸零（否則抽卡價會變 Infinity）；舊檔的 ticketsBought 搬成 paidDraws', () => {
  assert.equal(A.normalize({ ...A.fresh(), paidDraws: '1e309' }).paidDraws, 0);
  assert.ok(Number.isFinite(A.drawCost(A.normalize({ ...A.fresh(), paidDraws: '1e309' }), 1)));
  const old = A.normalize({ unlocked: true, ticketsBought: 42, tickets: 3 });
  assert.equal(old.paidDraws, 42); assert.equal(old.ticketsBought, undefined); assert.equal(old.tickets, 3);
  assert.equal(A.normalize({ ...A.fresh(), teamLevel: 'x', stats: { taps: -5, maxHit: 'Infinity' } }).teamLevel, 0);
});
test('舊檔已經走完 20 站但沒有 cleared → 直接補成已通關，不事後補播結局', () => {
  assert.equal(A.normalize({ ...A.fresh(), progress: 20 }).cleared, true);
  assert.equal(A.normalize({ ...A.fresh(), progress: 19 }).cleared, false);
});

test('pending 的每一筆都從卡池重建：缺 rarity 會補回來，重複 key 會被重編（Codex 第二輪 A5）', () => {
  const base = { ...A.fresh(), unlocked: true, tickets: 10 };
  const bad = { id: 'd1', entries: Array.from({ length: 10 }, () => ({ key: 'same', entry: { id: 'm1' } })) };
  const got = A.normalize({ ...base, pending: { draw: bad } });
  assert.ok(got.pending, '合法 id 的資料不該整份丟掉');
  assert.equal(new Set(got.pending.draw.entries.map(e => e.key)).size, 10, 'key 不可以重複，否則十連只畫得出一張');
  assert.equal(got.pending.draw.entries[0].entry.rarity, 'mythic', 'rarity 要從卡池補回來');
  assert.ok(got.pending.draw.entries.every(e => typeof e.entry.name === 'string'));
});

test('把已經在槽 1 的卡指定到槽 2 → 是搬過去，不是清掉槽 2（Codex 第三輪 B1）', () => {
  const a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1, l1: 1 }, roster: ['m1', 'l1'], skills: ['m1', 'l1', null, null] });
  const moved = A.setTeam(a, a.roster, ['m1', 'm1', null, null]);
  assert.deepEqual(moved.skills, [null, 'm1', null, null], 'm1 搬到槽 2，槽 1 空出來');
  // 舊檔的同卡多槽在 normalize 就要清掉
  assert.deepEqual(A.normalize({ ...a, skills: ['m1', 'm1', 'm1', 'm1'] }).skills, ['m1', null, null, null]);
});
