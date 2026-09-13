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
test('券：第一張 1000，之後每買一張漲 2%；金幣不夠丟錯', () => {
  const a = { ...A.fresh(), coins: 1500 };
  assert.equal(A.ticketCost(a, 1), 1000);
  assert.equal(A.buyTicket(a).tickets, 1); assert.equal(A.buyTicket(a).coins, 500);
  assert.equal(A.buyTicket(a).ticketsBought, 1);
  assert.throws(() => A.buyTicket(a, 2), /不足/);
  const rich = { ...A.fresh(), coins: 1e9, ticketsBought: 100 };
  assert.equal(A.ticketCost(rich, 1), Math.round(1000 * R.TICKET_GROWTH ** 100));
  assert.equal(A.ticketCost(rich, 3), [0, 1, 2].reduce((n, i) => n + Math.round(1000 * R.TICKET_GROWTH ** (100 + i)), 0));
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
test('ticketsBought 非有限數要歸零，否則券價會變 Infinity', () => {
  assert.equal(A.normalize({ ...A.fresh(), ticketsBought: '1e309' }).ticketsBought, 0);
  assert.ok(Number.isFinite(A.ticketCost(A.normalize({ ...A.fresh(), ticketsBought: '1e309' }), 1)));
});
test('舊檔已經走完 20 站但沒有 cleared → 直接補成已通關，不事後補播結局', () => {
  assert.equal(A.normalize({ ...A.fresh(), progress: 20 }).cleared, true);
  assert.equal(A.normalize({ ...A.fresh(), progress: 19 }).cleared, false);
});
