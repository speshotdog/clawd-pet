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
  // 第九輪一站 5 隻：直接打這一站的最後一隻；一隻給這一站獎勵的 1/WAVES
  a = { ...a, stage: { ...a.stage, hp: 1, wave: a.stage.waves } }; r = A.settle(a, now + 2000, 1);
  const last = Math.round(A.reward(0) / R.WAVES);
  assert.deepEqual(r.events[0], { type: 'win', index: 0, reward: last }); assert.equal(r.state.progress, 1); assert.equal(r.state.stage, null);
  assert.ok(r.state.coins >= last);
});
test('王關時限（第四輪使用者：統一 60 秒）：時間到失敗、進冷卻、之後才能再打；一般關沒有時限', () => {
  const now = 1e6;
  assert.equal(R.BOSS_TIME, 60000, '王關一律 60 秒');
  assert.equal(A.fight(A.gift(A.fresh()), now).stage.deadline, null, '一般關沒有時限');
  const saved = R.BOSS_TIME;
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
test('訓練（第六輪乘算）：全隊訓練每級戰力 ×(1+MUL)、點擊力每級每下 ×(1+MUL)；費用每級 ×GROWTH；「最多」買到錢不夠為止', () => {
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
  assert.ok(Math.abs(A.tapDamage(r.state, 0) - A.power(b) * R.CLICK_SHARE * (1 + T.click.MUL) ** 2) < 1e-6);
  assert.equal(A.trainCost(r.state, 'click'), Math.round(T.click.COST * T.click.GROWTH ** 2));
});
test('戰績：點擊數、最高一擊、破防次數會累積（扛槌兔拍子上連中破防）', () => {
  const MS = R.BOSS_MECH.RHYTHM.MS, N = R.BOSS_MECH.RHYTHM.CHAIN;
  let a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 11 }), 0);
  a = { ...a, stage: { ...a.stage, hp: 1e15, need: 1e15 } };
  for (let i = 0; i < N; i++) a = A.tap(a, i * MS);
  assert.equal(a.stats.taps, N); assert.equal(a.stats.shieldBreaks, 1);
  const t = N * MS, hit = A.tapDamage(a, t); a = A.tap(a, t);
  assert.equal(a.stats.maxHit, hit, '破防中拍子上的一下（×2×3）是目前最高');
});
test('normalize：壞欄位歸零、不在收藏的卡出隊、進度不符的戰鬥丟掉', () => {
  const a = A.normalize({ unlocked: true, collection: { m1: 1 }, roster: ['m1', 'ghost'], skills: ['m1', 'ghost'], stage: { index: 5, hp: 10 }, progress: 0 });
  assert.deepEqual(a.roster, ['m1']); assert.deepEqual(a.skills, ['m1', null, null, null]); assert.equal(a.stage, null);
});

// --- 第十輪：五種王關機制（使用者：「照企劃做五種」）
const BM = () => R.BOSS_MECH;
function bossAtStation(i) {
  const a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: i }), 0);
  return { ...a, stage: { ...a.stage, hp: 1e9, need: 1e9 } };
}
test('王① 灰狼犬：狗群先吸收傷害（放置也打狗），清光才打得到王，AGAIN_MS 後再來一批', () => {
  let a = bossAtStation(3), p = A.power(a);
  assert.equal(a.stage.mech, 0); assert.equal(a.stage.minions.left, BM().SUMMON.COUNT);
  a = { ...a, stage: { ...a.stage, minions: { ...a.stage.minions, max: 10, hp: 10 } } };
  let t = A.tap(a, 0);
  assert.equal(t.stage.hp, 1e9, '有狗的時候王不掉血'); assert.ok(t.stage.minions.left <= BM().SUMMON.COUNT);
  for (let i = 0; i < 20 && t.stage.minions.left; i++) t = A.tap(t, 0);
  assert.equal(t.stage.minions.left, 0); assert.equal(t.stage.minions.nextAt, BM().SUMMON.AGAIN_MS);
  const hit = A.tap(t, 1); assert.ok(hit.stage.hp < 1e9, '狗清光就打得到王');
  const again = A.settle(hit, BM().SUMMON.AGAIN_MS + 1, 0).state;
  assert.equal(again.stage.minions.left, BM().SUMMON.AGAIN, '狗群再來');
  assert.equal(A.bossInfo(again.stage, BM().SUMMON.AGAIN_MS + 1).minions, BM().SUMMON.AGAIN);
  void p;
});
test('王② 貼紙羊：血掉到 75% 長殼、殼只吃點擊（放置打不動），剝掉一層破防', () => {
  let a = bossAtStation(7);
  assert.equal(a.stage.mech, 1);
  a = { ...a, stage: { ...a.stage, hp: 1e9 * .75 + 1 } };
  let t = A.tap(a, 0);
  assert.equal(t.stage.hp, 1e9 * .75, '打到門檻就停住'); assert.ok(t.stage.shell.hp > 0, '長出殼');
  const idle = A.settle(t, 1000, 1).state;
  assert.equal(idle.stage.shell.hp, t.stage.shell.hp, '放置剝不了殼'); assert.equal(idle.stage.hp, t.stage.hp);
  t = { ...t, stage: { ...t.stage, shell: { ...t.stage.shell, hp: 1 } } };
  const peeled = A.tap(t, 2000);
  assert.equal(peeled.stage.shell.layer, 1); assert.equal(peeled.stage.shell.hp, 0);
  assert.equal(peeled.stage.breakUntil, 2000 + BM().SHELL.STAGGER_MS, '剝掉一層破防');
  assert.equal(peeled.stats.shieldBreaks, 1);
});
test('王③ 扛槌兔：拍子上 ×3、沒對上 ×.5，連中 CHAIN 下破防；放置打折', () => {
  const MS = BM().RHYTHM.MS, a = bossAtStation(11), p = A.power(a);
  assert.equal(a.stage.mech, 2);
  const on = A.tap(a, MS), off = A.tap(a, MS / 2);
  assert.ok(Math.abs((1e9 - on.stage.hp) - p * R.CLICK_SHARE * BM().RHYTHM.HIT_MUL) < 1e-6, '拍子上 ×3');
  assert.ok(Math.abs((1e9 - off.stage.hp) - p * R.CLICK_SHARE * BM().RHYTHM.MISS_MUL) < 1e-6, '沒對上 ×.5');
  assert.equal(on.stage.rhythm.chain, 1); assert.equal(A.tap(on, MS * 1.5).stage.rhythm.chain, 0, '沒對上連中歸零');
  const idle = A.settle(a, MS / 2, MS / 2000).state;
  assert.ok(Math.abs((1e9 - idle.stage.hp) - p * BM().IDLE_MUL * MS / 2000) < 1e-6, '放置打折');
});
test('王④ 雞頭合成怪：照順序點部位 LEN 下破防；點錯從頭；點空白處照樣有傷害', () => {
  let a = bossAtStation(15);
  assert.equal(a.stage.mech, 3);
  const seq = a.stage.order.seq; assert.equal(seq.length, BM().ORDER.LEN);
  const wrong = BM().ORDER.PARTS.find(x => x !== seq[0]);
  assert.equal(A.tap(a, 0, { part: wrong }).stage.order.step, 0, '點錯從頭');
  assert.ok(A.tap(a, 0).stage.hp < 1e9, '點空白處有傷害');
  for (const part of seq) a = A.tap(a, 100, { part });
  assert.equal(a.stage.breakUntil, 100 + BM().BREAK_MS, '一輪點完破防'); assert.equal(a.stage.order.round, 1); assert.equal(a.stage.order.step, 0);
  assert.equal(A.bossInfo(a.stage, 100).nextPart, a.stage.order.seq[0]);
});
test('王⑤ 滅世珍獸：每 ROTATE_MS 換一種機制；外殼期間已經打到門檻底下不會把血補回去', () => {
  const a = bossAtStation(19), T = BM().ROTATE_MS;
  assert.equal(a.stage.mech, 4);
  assert.deepEqual([0, T, 2 * T, 3 * T, 4 * T].map(t => A.mechAt(a.stage, t + 1)), [0, 1, 2, 3, 0]);
  const low = { ...a, stage: { ...a.stage, hp: 1e9 * .3 } };
  const r = A.tap(low, T + 1);
  assert.ok(r.stage.hp <= 1e9 * .3, '血不會被補回門檻'); assert.equal(r.stage.shell.layer, 2, '跳過已經打穿的兩層');
});
// --- 第五輪 Codex 必修：舊存檔換算、舊王關給一次期限、逾時不能判勝
test('舊存檔的戰鬥照剩餘比例換算成新版血量（只換一次）；舊王關沒有期限的第一次結算給 60 秒、之後不續時', () => {
  const n3 = A.need(3);
  const old = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3,
    stage: { index: 3, hp: 1296000, need: 2592000, boss: true, startedAt: 0, deadline: null, shield: { taps: 0, need: 15, cycle: 0 }, breakUntil: 0 } });
  assert.equal(old.stage.need, n3); assert.ok(Math.abs(old.stage.hp - n3 * .5) < 1e-6, '半血換成新版的半血');
  assert.equal(old.stage.shield, undefined, '舊的護盾欄位拿掉'); assert.equal(old.stage.mech, 0); assert.equal(old.stage.minions.left, R.BOSS_MECH.SUMMON.COUNT, '換成這一隻王的機制');
  assert.equal(A.normalize(old).stage.hp, old.stage.hp, '換算只做一次');
  const r1 = A.settle(old, 1000000, 0);
  assert.equal(r1.state.stage.deadline, 1000000 + R.BOSS_TIME, '第一次結算給完整 60 秒');
  const r2 = A.settle(A.normalize(r1.state), 1000500, 0);
  assert.equal(r2.state.stage.deadline, 1000000 + R.BOSS_TIME, '重新載入不會續時');
});
test('期限過了的點擊不算傷害、放置只算到期限為止——逾時不能被判勝；期限前的致死照樣算贏', () => {
  let a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 }), 0);
  a = { ...a, stage: { ...a.stage, minions: { ...a.stage.minions, left: 0, nextAt: 1e15 } } };   // 狗群清光（王露出來，放置 ×1）
  const p = A.power(a), late = a.stage.deadline + 10000;
  const one = { ...a, stage: { ...a.stage, hp: 1 } };
  assert.equal(A.tapDamage(one, late), 0);
  assert.equal(A.settle(A.tap(one, late), late, 0).events[0].type, 'fail', '王剩 1 滴，期限過後才點：判輸');
  // 期限前 1 秒進來、隔了 11 秒才結算：只算 1 秒的放置
  const five = { ...a, stage: { ...a.stage, hp: p * 5 } };
  assert.equal(A.settle(five, a.stage.deadline + 10000, 11).events[0].type, 'fail');
  const half = { ...a, stage: { ...a.stage, hp: p * .5 } };
  assert.equal(A.settle(half, a.stage.deadline - 500, 1).events[0].type, 'win', '期限前合法的致死');
});
test('一般關沒有王關機制，放置照原速', () => {
  let a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'] });
  a = A.fight(a, 0); assert.equal(a.stage.boss, false); assert.equal(a.stage.mech, undefined); assert.equal(A.mechAt(a.stage, 0), -1);
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

// Codex 5b 必修：王關期限附近的勝負判定
function bossAt100() {
  const i = [...Array(R.STATIONS).keys()].find(A.isBoss);
  const a = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: i });
  assert.equal(A.power(a), 100);
  const f = A.fight(a, 0);   // deadline = 60000
  return { ...f, stage: { ...f.stage, minions: { ...f.stage.minions, left: 0, nextAt: 1e15 } } };   // 第十輪：第一隻王有狗群，先清光（王露出來，放置 ×1）
}
test('破防跟王關期限同時結束：期限前那段照破防 ×2 算，不會被整段算成一般倍率（Codex 5b 必修 2）', () => {
  const a = bossAt100(); a.stage = { ...a.stage, hp: 100, breakUntil: R.BOSS_TIME };
  const late = A.settle(a, R.BOSS_TIME + 1, 2);   // 58.001～60 秒是破防：100×2×1.999 ≈ 400 > 100
  assert.equal(late.events[0].type, 'win');
  const early = A.settle(a, R.BOSS_TIME - 1, 2);
  assert.equal(early.events[0].type, 'win', '期限前結算也一樣贏');
  // 切段：破防 1 秒（×2）＋ 一般 1 秒（狗清光的王，放置 ×1）
  const b = bossAt100(); b.stage = { ...b.stage, hp: 1e6, need: 1e6, breakUntil: 10000 };
  const mixed = A.settle(b, 11000, 2).state.stage;
  assert.ok(Math.abs((1e6 - mixed.hp) - 100 * (R.BOSS_MECH.BREAK_MUL + 1)) < 1e-6, String(1e6 - mixed.hp));
  assert.equal(mixed.breakUntil, 0, '破防結束');
});
test('逾時後才結算：期限前還沒算的放置傷害照算，夠打死就贏；只拿 dt 0 結算會吞掉它（Codex 5b 必修 1，UI 點擊要先補算）', () => {
  const a = bossAt100(); a.stage = { ...a.stage, hp: 10 };
  // 上次結算在 59 秒，期限 60 秒：期限前還有 1 秒 ×IDLE_MUL 的放置傷害
  assert.equal(A.settle(a, R.BOSS_TIME + 500, 1.5).events[0].type, 'win');
  assert.equal(A.settle(A.tap(a, R.BOSS_TIME + 1), R.BOSS_TIME + 1, 0).events[0].type, 'fail');
});

// --- 第六輪（使用者：王變門檻，照 Sakura Clicker 等比縮到約 1 小時）
test('王輸過：回前一站刷怪（拿前一站獎勵、不推進度），「再次挑戰」會換掉刷怪的戰鬥；沒輸過不能刷', () => {
  const base = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 });
  assert.throws(() => A.fight(base, 0, true), /不能刷怪/);
  const lost = A.settle(A.fight(base, 0), R.BOSS_TIME, 0).state;
  assert.equal(lost.bossFailed, 3);
  let f = A.fight(lost, R.BOSS_TIME, true);
  assert.equal(f.stage.index, 2); assert.equal(f.stage.farm, true); assert.equal(f.stage.boss, false); assert.equal(f.stage.deadline, null);
  assert.equal(A.normalize(f).stage.index, 2, '重新載入：刷怪的戰鬥留著');
  // 第十二輪：走過的站都能重打（回顧），所以「沒輸過卻在刷怪」不再是壞資料——沒走過的站才是
  assert.equal(A.normalize({ ...f, bossFailed: null }).stage.index, 2, '走過的站本來就能刷');
  assert.equal(A.normalize({ ...f, stage: { ...f.stage, index: 5 } }).stage, null, '還沒走到的站在刷怪＝壞資料');
  assert.equal(A.canFight(f, R.BOSS_TIME + 1000), false, '冷卻中不能挑戰');
  const coins = f.coins, dying = { ...f, stage: { ...f.stage, hp: 1 } };
  const r = A.settle(dying, R.BOSS_TIME + 1000, 1);
  assert.deepEqual(r.events.map(e => e.type), ['farm']);
  assert.equal(r.state.progress, 3); assert.equal(r.state.stage, null); assert.ok(r.state.coins >= coins + Math.round(A.reward(2) / R.WAVES));   // 刷怪一隻＝一般站一隻的獎勵
  const again = A.fight(f, lost.cooldownUntil);
  assert.equal(again.stage.index, 3); assert.equal(again.stage.boss, true); assert.equal(again.stage.hp, A.need(3), '再次挑戰從滿血開打');
});
test('血量與獎勵：王＝該站血量 × BOSS_MULS（逐隻遞增）、一定比前一站硬；獎勵成長略高於血量', () => {
  R.BOSS_MULS.forEach((m, k) => { const i = 4 * k + 3; assert.equal(A.need(i), Math.round(R.BASE_NEED * R.GROWTH ** i * m)); assert.ok(A.need(i) > A.need(i - 1)); });
  assert.ok(A.reward(10) / A.need(10) > A.reward(1) / A.need(1));
});
test('刷怪一秒最多開一場（Codex 第六輪必修：一擊必殺連點可以無限刷）；等級有上限，乘算不會變 Infinity', () => {
  const base = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 });
  const lost = A.settle(A.fight(base, 0), R.BOSS_TIME, 0).state;
  let f = A.fight(lost, R.BOSS_TIME, true); f = { ...f, stage: { ...f.stage, hp: 1 } };
  const t = R.BOSS_TIME + 10, won = A.settle(A.tap(f, t), t, 0).state;
  assert.equal(won.stage, null); assert.equal(won.farmNextAt, t + R.FARM_RESPAWN);
  assert.throws(() => A.fight(won, t + R.FARM_RESPAWN / 2, true), /不能刷怪/, '剛打死馬上點：不能立刻開下一場');
  assert.equal(A.fight(won, t + R.FARM_RESPAWN, true).stage.farm, true);
  const huge = A.normalize({ ...base, teamLevel: 10000, clickLevel: 1e9 });
  assert.equal(huge.teamLevel, R.TRAIN_MAX); assert.equal(huge.clickLevel, R.TRAIN_MAX);
  assert.ok(Number.isFinite(A.power(huge))); assert.ok(Number.isFinite(A.tapDamage(A.fight(huge, 0), 0)));
  assert.ok(Number.isFinite(A.trainCost(huge, 'team')));
  assert.throws(() => A.train({ ...huge, coins: Infinity }, 'team'), /練到頂/);
});

// --- 第七輪：2.0 抽卡選單有單抽／五連／十連（Codex 第七輪必修：五連扣了款、pending 卻在 normalize 被清掉）
test('五連：扣款、pending 經過 normalize（重開／tick）還在、收得下；其他張數不准買', () => {
  const a = A.normalize({ ...A.fresh(), unlocked: true, tickets: 10, coins: 0 });
  const bought = A.purchaseDraw(a, 5, 0, () => .9);
  assert.equal(bought.tickets, 5); assert.equal(bought.pending.draw.entries.length, 5);
  const reloaded = A.normalize(JSON.parse(JSON.stringify(bought)));
  assert.ok(reloaded.pending, '重新載入後五連結果還在');
  const got = A.collectDraw(reloaded, reloaded.pending.draw.id, 0);
  assert.equal(got.accepted, true); assert.equal(Object.values(got.state.collection).reduce((x, y) => x + y, 0), 5);
  assert.throws(() => A.purchaseDraw(a, 3, 0, () => .9), /單抽、五連或十連/);
});

// --- 第八輪：神話卡技能施放期間放專屬 BGM（clicker-music.js 讀 fx.mythic）
test('神話卡施放：fx.mythic 開著直到 10 下用完；傳說卡不算；normalize 清掉沒有次數的 mythic', () => {
  let a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1, l1: 1 }, roster: ['m1', 'l1'], skills: ['m1', 'l1', null, null] }), 0);
  a = A.useSkill(a, 0, 0);
  assert.equal(a.fx.mythic, true); assert.equal(a.fx.clickLeft, R.SKILLS.mythic.uses);
  for (let i = 0; i < R.SKILLS.mythic.uses - 1; i++) a = { ...A.tap(a, 0), stage: { ...a.stage, hp: 1e12 } };
  assert.equal(a.fx.mythic, true, '還剩一下');
  a = A.tap(a, 0); assert.equal(a.fx.mythic, false, '10 下用完就收掉');
  const legend = A.useSkill(a, 1, 0); assert.equal(legend.fx.mythic, false, '傳說卡的點擊加倍不放神話技能曲');
  assert.equal(A.normalize({ ...a, fx: { ...a.fx, mythic: true, clickLeft: 0 } }).fx.mythic, false);
});

// --- 第九輪：一般站要連打 WAVES 隻
test('一站多隻：打死換下一隻滿血＋獎勵、進度不動；最後一隻才推進度；王站一隻；normalize 補欄位', () => {
  const saved = R.WAVES; R.WAVES = 3;
  try {
    let a = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'] }), 0);
    assert.equal(a.stage.waves, 3); assert.equal(a.stage.wave, 1);
    const kill = s => A.settle({ ...s, stage: { ...s.stage, hp: 1 } }, 1000, 1);
    let r = kill(a); assert.deepEqual(r.events.map(e => e.type), ['wave']); assert.equal(r.state.progress, 0);
    assert.equal(r.state.stage.wave, 2); assert.equal(r.state.stage.hp, A.need(0));
    assert.equal(r.events[0].reward, Math.round(A.reward(0) / 3), '一隻給這一站獎勵的 1/3（一站總額不變）');
    r = kill(r.state); assert.equal(r.state.stage.wave, 3);
    r = kill(r.state); assert.deepEqual(r.events.map(e => e.type), ['win']); assert.equal(r.state.progress, 1);
    const boss = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 3 }), 0);
    assert.equal(boss.stage.waves, 1);
    const old = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], stage: { index: 0, hp: 5, need: A.need(0), boss: false } });
    assert.equal(old.stage.waves, 3); assert.equal(old.stage.wave, 1);
  } finally { R.WAVES = saved; }
});

// --- Codex 第十輪 A 必修
test('放置照事件時間推進：一次結算 10 秒＝逐秒結算 10 秒（狗群、殼、輪流都一樣）', () => {
  for (const [i, hp] of [[3, null], [7, .8], [19, null]]) {
    const base = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1, m2: 1 }, roster: ['m1', 'm2'], progress: i }), 0);
    // 每秒約 4000 傷害：40 秒內三站都打不死（第 4 站清掉約 3 隻狗、第 8 站打到 75% 長殼、第 20 站中途換成外殼），才比得出差別
    const boost = { power: 20, click: 1, skill: 1, cd: 1 };
    let a = { ...base, boost, stage: { ...base.stage, hp: base.stage.need * (hp || 1), minions: { ...base.stage.minions, max: 50000, hp: 50000 } } };
    const once = A.settle(a, 40000, 40).state.stage;
    let b = a; for (let s = 1; s <= 40; s++) b = A.settle(b, s * 1000, 1).state;
    const step = b.stage;
    assert.ok(Math.abs(once.hp - step.hp) <= Math.max(1, step.need * 1e-9), `第 ${i + 1} 站 王血 一次 ${once.hp} vs 逐秒 ${step.hp}`);
    assert.equal(once.minions.left, step.minions.left, `第 ${i + 1} 站 狗數`);
    assert.equal(once.shell.layer, step.shell.layer, `第 ${i + 1} 站 殼層`);
  }
});
test('期限後才到點的狗群重生，不能把期限前本來會贏的判成輸', () => {
  const i = 3, base = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: i }), 100000);
  const a = { ...base, stage: { ...base.stage, hp: 50, deadline: 160000, minions: { ...base.stage.minions, left: 0, nextAt: 160500 } } };
  assert.equal(A.settle(a, 160000, 1).events[0].type, 'win');
  assert.equal(A.settle(a, 161000, 2).events[0].type, 'win');
});
test('壞掉的王關機制存檔：normalize 重建那一塊，點部位不丟例外、血不會變 NaN', () => {
  const base = A.fight(A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 15 }), 0);
  const bad = A.normalize({ ...base, stage: { ...base.stage, order: {}, minions: { left: 2, hp: 'bad', max: 5 }, shell: { layer: .5, hp: -1 }, rhythm: { chain: 'x' } } });
  assert.ok(Array.isArray(bad.stage.order.seq) && bad.stage.order.seq.length === R.BOSS_MECH.ORDER.LEN);
  const t = A.tap(bad, 10, { part: 'head' });
  assert.ok(Number.isFinite(t.stage.hp));
  const s1 = A.normalize({ ...base, progress: 3, stage: { ...base.stage, index: 3, mech: 0, minions: { left: 2, hp: 'bad', max: 5 } } });
  assert.ok(Number.isFinite(A.tap(s1, 10).stage.minions.hp));
  const s2 = A.normalize({ ...base, progress: 7, stage: { ...base.stage, index: 7, mech: 1, need: 1000, hp: 900, shell: { layer: .5, hp: 0 } } });
  assert.ok(Number.isFinite(A.tap(s2, 10).stage.hp));
});

test('第十輪 C 重走廢土：通關才能重走；保留收藏、金幣訓練歸零；敵人血 ×HP_FIRST、戰力 ×(1+POWER)；最多 MAX 圈；壞值', () => {
  let a = A.gift(A.fresh());
  assert.throws(() => A.replay(a), /全線通行之後/);
  a = { ...a, cleared: true, progress: 20, coins: 999, teamLevel: 5, clickLevel: 3 };
  const r = A.replay(a);
  assert.equal(r.laps, 1); assert.equal(r.progress, 0); assert.equal(r.coins, 0); assert.equal(r.teamLevel, 0); assert.equal(r.clickLevel, 0);
  assert.deepEqual(r.collection, a.collection); assert.deepEqual(r.roster, a.roster); assert.equal(r.cleared, false); assert.equal(r.endless, false);
  assert.equal(A.need(0, r), A.need(0) * R.LAP.HP_FIRST);
  assert.ok(Math.abs(A.power(r) - A.power({ ...a, teamLevel: 0 }) * (1 + R.LAP.POWER)) < 1e-9);
  assert.equal(A.fight(r, 1e6).stage.need, A.need(0) * R.LAP.HP_FIRST);
  const boss = A.fight({ ...r, progress: 3 }, 1e6).stage;
  assert.ok(Math.abs(boss.minions.max - A.need(3, r) * R.BOSS_MECH.SUMMON.HP) < 1e-6, '狗群的血也跟著圈數放大');
  assert.equal(A.replay({ ...a, laps: R.LAP.MAX - 1 }).laps, R.LAP.MAX);
  assert.throws(() => A.replay({ ...a, laps: R.LAP.MAX }), /到頂/);
  assert.equal(A.normalize({ ...A.fresh(), laps: 'x' }).laps, 0);
  assert.equal(A.normalize({ ...A.fresh(), laps: -2 }).laps, 0);
  assert.equal(A.normalize({ ...A.fresh(), laps: 99 }).laps, R.LAP.MAX);
  // 重走後的存檔再載入：戰鬥血量不會被 normalize 當成舊版血量換算回第一圈
  const saved = A.fight(r, 1e6), back = A.normalize(JSON.parse(JSON.stringify(saved)));
  assert.equal(back.stage.need, saved.stage.need);
});
test('第十輪 C 無盡模式：通關才能開；第 21 站起照打、記最遠；關掉丟掉 20 站後的戰鬥；王是四種輪流', () => {
  let a = A.gift(A.fresh());
  assert.throws(() => A.setEndless(a, true), /全線通行之後/);
  a = { ...a, cleared: true, progress: 20 };
  assert.equal(A.canFight(a, 0), false);
  a = A.setEndless(a, true); assert.equal(A.canFight(a, 0), true);
  a = A.fight(a, 1e6); assert.equal(a.stage.index, 20);
  for (let k = 0; k < R.WAVES; k++) { a = { ...a, stage: { ...a.stage, hp: 0 } }; a = A.settle(a, 1e6 + k, 0).state; }
  assert.equal(a.progress, 21); assert.equal(a.endlessBest, 1);
  assert.equal(A.view(a, 1e6).need, A.need(21));
  assert.equal(A.normalize(a).endless, true);
  assert.equal(A.normalize({ ...a, cleared: false, progress: 3 }).endless, false);
  const off = A.setEndless(A.fight(a, 2e6), false);
  assert.equal(off.stage, null); assert.equal(A.canFight(off, 3e6), false);
  assert.equal(A.fight({ ...a, progress: 23 }, 1e6).stage.mech, 4);
  assert.equal(A.canFight({ ...a, progress: R.ENDLESS_MAX }, 1e6), false);
});

test('第十輪 D 離線：只在目前這一站賺錢、不前進；最多 MAX_MS；不到 MIN_MS 不算；王站算前一個一般站；settle 更新 seenAt', () => {
  let a = A.gift(A.fresh()); a = { ...a, progress: 2, seenAt: 1e9 };
  const r = A.offline(a, 1e9 + 3600000), ev = r.events[0];
  assert.equal(r.state.progress, 2); assert.equal(r.state.stage, a.stage); assert.ok(ev.earned > 0); assert.equal(ev.index, 2);
  assert.equal(r.state.coins, a.coins + ev.earned); assert.equal(r.state.seenAt, 1e9 + 3600000);
  assert.equal(A.offline(a, 1e9 + 100 * 3600000).events[0].earned, A.offline(a, 1e9 + R.OFFLINE.MAX_MS).events[0].earned);
  assert.equal(A.offline(a, 1e9 + R.OFFLINE.MIN_MS - 1).events.length, 0);
  assert.equal(A.offline({ ...a, seenAt: 0 }, 1e9).events.length, 0);
  assert.equal(A.offline({ ...a, progress: 3 }, 1e9 + 3600000).events[0].index, 2);
  assert.equal(A.offline({ ...a, progress: 20, cleared: true }, 1e9 + 3600000).events[0].index, 18);
  assert.equal(A.settle(a, 5e9, 0).state.seenAt, 5e9);
  assert.equal(A.normalize({ ...a, seenAt: 'x' }).seenAt, 0);
});
test('第十輪 D 派遣：隊外的卡才能派、位子有限；時間到收金幣（稀有度加成）、機率帶券；派遣中不能入隊；壞資料丟掉', () => {
  let a = A.gift(A.fresh()); a = A.drawn({ ...a, tickets: 4 }, ['e1', 'l1', 'm1', 'm2']);
  a = A.setTeam(a, ['pufayueyue'], [null, null, null, null]);
  assert.throws(() => A.startDispatch(a, 'pufayueyue', 0), /先移出隊伍/);
  assert.throws(() => A.startDispatch(a, 'm3', 0), /還沒抽到/);
  for (const id of ['e1', 'l1', 'm1']) a = A.startDispatch(a, id, 0);
  assert.throws(() => A.startDispatch(a, 'e1', 0), /派遣中/);
  assert.throws(() => A.startDispatch(a, 'm2', 0), /滿了/);
  assert.ok(!A.setTeam(a, ['pufayueyue', 'e1'], null).roster.includes('e1'));
  assert.ok(!A.addCards(a, ['e1']).roster.includes('e1'));
  assert.equal(A.collectDispatch(a, R.DISPATCH.MS - 1).rewards.length, 0);
  const lucky = A.collectDispatch(a, R.DISPATCH.MS, () => 0), none = A.collectDispatch(a, R.DISPATCH.MS, () => .99);
  assert.equal(lucky.rewards.length, 3); assert.equal(lucky.state.tickets, a.tickets + 3); assert.equal(none.state.tickets, a.tickets);
  assert.equal(lucky.state.dispatch.length, 0); assert.equal(lucky.state.dispatchDone, 3);
  const m1 = lucky.rewards.find(r => r.id === 'm1'), e1 = lucky.rewards.find(r => r.id === 'e1');
  assert.ok(m1.coins > e1.coins && e1.coins > 0);
  assert.equal(none.state.coins, a.coins + lucky.rewards.reduce((sum, r) => sum + r.coins, 0));
  assert.equal(A.normalize(a).dispatch.length, 3);
  const bad = A.normalize({ ...a, dispatch: [{ id: 'm1', startedAt: 0, until: 5 }, { id: 'zzz', startedAt: 0, until: R.DISPATCH.MS }, null, { id: 'pufayueyue', startedAt: 0, until: R.DISPATCH.MS }] });
  assert.equal(bad.dispatch.length, 0);
});

// ---- 第十一輪 養成：粉塵／星級／突破／兌換所／王掉粉塵（DESIGN-2026-09-14-apoc-growth.md）
test('星級看累計粉塵，滿星之後才會自動突破，滿養封頂', () => {
  const cap = A.starCap(), full = A.fullDust();
  assert.equal(cap, 8); assert.equal(full, 22);
  let a = A.gift(A.fresh());           // 開門禮已經有一張 pufayueyue
  assert.equal(A.dustOf(a, 'pufayueyue'), 1, '開門禮要落地粉塵，不然第一次重複會少算');
  a = A.drawn({ ...a, tickets: 7 }, Array(7).fill('pufayueyue'));
  assert.equal(A.dustOf(a, 'pufayueyue'), 8); assert.equal(A.starsAt(a, 'pufayueyue'), 5);
  assert.equal(A.transcendOf(a, 'pufayueyue'), 0, '滿星當下還沒有多的粉塵可以突破');
  a = A.drawn({ ...a, tickets: 2 }, ['pufayueyue', 'pufayueyue']);
  assert.equal(A.transcendOf(a, 'pufayueyue'), 1, '多 2 顆粉塵＝自動突破第 1 級');
  a = A.drawn({ ...a, tickets: 12 }, Array(12).fill('pufayueyue'));
  assert.ok(A.isMaxed(a, 'pufayueyue')); assert.equal(A.dustOf(a, 'pufayueyue'), full);
  assert.equal(A.transcendOf(a, 'pufayueyue'), 5);
  // 滿養之後再抽到：粉塵不再長，改成溢出萬用粉塵
  const before = a.universalDust || 0;
  a = A.drawn({ ...a, tickets: 3 }, Array(3).fill('pufayueyue'));
  assert.equal(A.dustOf(a, 'pufayueyue'), full);
  assert.equal(a.universalDust - before, 3 * A.dustRate('pufayueyue'));
  // 戰力＝底 60 ×（1+.25×4）×（1+.1×5）
  assert.equal(A.cardPower(a, 'pufayueyue'), 60 * 2 * 1.5);
});
test('兌換所只補已經抽到過的卡（使用者退掉「沒有的卡也能換」，要保住第一次抽到的重量）', () => {
  let a = A.gift(A.fresh());
  assert.equal(A.dustRate('m1'), R.GROW.DUST.mythic);
  assert.throws(() => A.exchangeDust({ ...a, universalDust: 999 }, 'm1', 1), /還沒抽到/);
  assert.throws(() => A.exchangeDust({ ...a, universalDust: 999 }, 'zzz', 1), /不在末世卡池/);
  assert.throws(() => A.exchangeDust({ ...a, universalDust: 999 }, 'pufayueyue', 0), /數量/);
  assert.throws(() => A.exchangeDust({ ...a, universalDust: 0 }, 'pufayueyue', 1), /不足/);
  // 已經有的卡才補得下去
  const r = A.exchangeDust({ ...a, universalDust: 30 }, 'pufayueyue', 3);
  assert.equal(r.state.universalDust, 30 - 3 * A.dustRate('pufayueyue'));
  assert.equal(A.dustOf(r.state, 'pufayueyue'), 1 + 3);
  assert.equal(r.state.collection.pufayueyue, 1, '兌換補的是粉塵，不是張數');
  // 補到滿養就不能再補
  const done = A.exchangeDust({ ...a, universalDust: 9999 }, 'pufayueyue', A.fullDust() - 1);
  assert.ok(A.isMaxed(done.state, 'pufayueyue'));
  assert.throws(() => A.exchangeDust(done.state, 'pufayueyue', 1), /滿養/);
});
test('保底：連續 AT 次沒有新卡，下一張保證是還沒有的卡', () => {
  const AT = R.GROW.PITY.AT;
  let a = A.gift(A.fresh());
  // 只有一張卡的假卡池太小，這裡用真的規則：手動把 pity 推到門檻前一格
  a = { ...a, pity: AT - 1 };
  const rng = () => 0;   // 固定亂數：正常路徑只會抽到 rare 的第一張
  const pack = A.rollPack(a, 1, rng);
  const got = pack.entries[0].entry.id;
  assert.ok(!a.collection[got], `保底那一張要是還沒有的卡（實得 ${got}）`);
  // 抽到新卡之後計數歸零
  const after = A.addCards(a, [got]);
  assert.equal(after.pity, 0);
  // 抽到重複的會往上加
  assert.equal(A.addCards({ ...a, pity: 3 }, ['pufayueyue']).pity, 4);
  assert.equal(A.normalize({ ...a, pity: AT + 999 }).pity, AT, '壞存檔的保底計數夾在門檻');
});
test('打王首勝掉萬用粉塵，只掉一次；無盡模式每站都掉；重走廢土重算', () => {
  const i = 3, now = 1e6;                       // 第 4 站＝第一隻王
  assert.equal(A.winDust(A.fresh(), 0), 0, '一般站不掉粉塵');
  assert.equal(A.winDust(A.fresh(), i), R.GROW.BOSS[0]);
  assert.equal(A.winDust({ ...A.fresh(), bossDust: [i] }, i), 0, '首勝之後不再掉');
  assert.equal(A.winDust(A.fresh(), R.STATIONS), R.GROW.ENDLESS.BASE, '無盡第一站');
  assert.ok(A.winDust(A.fresh(), R.STATIONS + 5) > R.GROW.ENDLESS.BASE, '無盡越後面越多');
  let a = A.gift({ ...A.fresh(), progress: i, unlocked: true });
  a = A.fight(a, now);
  assert.equal(a.stage.mech, 0, '第一隻王是狗群');
  // 狗群擋在前面，王不會掉血——先把狗清乾淨（不然 hp 設成 1 也打不到王，這一站永遠不會贏）
  a = { ...a, stage: { ...a.stage, hp: 1, minions: { ...a.stage.minions, left: 0, nextAt: 0 } } };
  const r = A.settle(a, now + 1000, 1);
  const ev = r.events.find(e => e.type === 'dust');
  assert.deepEqual({ amount: ev.amount, boss: ev.boss }, { amount: R.GROW.BOSS[0], boss: true });
  assert.equal(r.state.universalDust, R.GROW.BOSS[0]);
  assert.deepEqual(r.state.bossDust, [i]);
  assert.deepEqual(A.replay({ ...r.state, cleared: true, pending: null }).bossDust, [], '重走廢土每一圈重算');
});
test('normalize：舊存檔張數搬成粉塵、突破級數買不起就砍掉', () => {
  // 舊存檔（第十輪以前）只有 collection，沒有 dust
  const old = A.normalize({ collection: { pufayueyue: 5, m1: 40 }, roster: ['pufayueyue'] });
  assert.equal(old.dust.pufayueyue, 5);
  assert.equal(old.dust.m1, A.fullDust(), '超過滿養的張數夾到滿養，不會變成無限戰力');
  // 手改存檔：粉塵只有 8（剛好滿星）卻寫了突破 5 → 買得起幾級就留幾級
  const cheat = A.normalize({ collection: { pufayueyue: 1 }, dust: { pufayueyue: 8 }, transcend: { pufayueyue: 5 } });
  assert.equal(cheat.transcend.pufayueyue, undefined);
  const ok = A.normalize({ collection: { pufayueyue: 1 }, dust: { pufayueyue: 12 }, transcend: { pufayueyue: 5 } });
  assert.equal(ok.transcend.pufayueyue, 2, '8+2+2=12 只買得起兩級');
  assert.equal(A.normalize({ universalDust: -5 }).universalDust, 0);
});
test('抽卡結算：升星只報到滿星，之後報突破', () => {
  let a = A.gift(A.fresh());
  a = A.drawn({ ...a, tickets: 7 }, Array(7).fill('pufayueyue'));   // 8 粉塵＝滿星
  const pack = { draw: { id: 'x', entries: [0, 1].map(k => ({ key: 'x:' + k, entry: { id: 'pufayueyue', rarity: 'rare', name: '普發玥玥' }, dup: true, owned: 8 })) } };
  const r = A.collectDraw({ ...a, pending: pack }, 'x', 0);
  assert.deepEqual(r.starUps, [], '已經滿星就不該再報升星');
  assert.deepEqual(r.grows, [{ id: 'pufayueyue', kind: 'transcend', from: 0, to: 1 }]);
});
test('舊存檔遷移：超過滿養的重複卡折成萬用粉塵，不會白白蒸發，而且重跑不會重複加', () => {
  // 舊版是「張數＝星數、每張 +25% 無上限」，直接套新規則會把既有玩家的戰力腰斬
  const full = A.fullDust(), extra = 10;
  const old = { collection: { pufayueyue: full + extra, m1: 3 }, roster: ['pufayueyue'] };
  const a = A.normalize(old);
  assert.equal(A.dustOf(a, 'pufayueyue'), full);
  assert.equal(a.universalDust, extra * A.dustRate('pufayueyue'));
  assert.equal(A.dustOf(a, 'm1'), 3, '沒超過滿養的照搬，不折算');
  // 同一份原始存檔再 normalize 一次（沒有寫檔的情況）結果要一樣
  assert.equal(A.normalize(old).universalDust, a.universalDust);
  // 已經有 dust 欄位的新存檔不再折算
  assert.equal(A.normalize({ collection: { pufayueyue: 99 }, dust: { pufayueyue: full }, universalDust: 7 }).universalDust, 7);
});

// --- 第十二輪（使用者：「要讓回家可以回到過去，打當時的怪物重複玩，不要鎖住」
//                       「全破之後常駐一隻珍母，讓玩家點擊打怪賺錢，不要就空在那」）
test('回顧：從那一站往下重走到這一段的王為止，拿獎勵、進度不動；正規王關打到一半不能落跑', () => {
  const base = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 5 });
  assert.equal(A.canRevisit(base, 2), true);
  assert.equal(A.canRevisit(base, 5), false, '目前站不算回顧');
  assert.equal(A.canRevisit(base, 9), false, '沒走過的站不能回顧');
  assert.throws(() => A.revisit(base, 0, 9), /還沒走過/);

  const r = A.revisit(base, 0, 2);
  assert.equal(r.revisitAt, 2);
  assert.equal(r.stage.index, 2); assert.equal(r.stage.farm, true); assert.equal(r.stage.revisit, true);
  assert.equal(r.stage.boss, false); assert.equal(r.stage.deadline, null);
  assert.equal(r.stage.waves, R.WAVES, '回顧的小怪站跟正規一樣要打滿 WAVES 隻');
  assert.equal(A.normalize(r).stage.index, 2, '重開之後回顧還在');
  assert.equal(A.normalize(r).revisitAt, 2);

  // 打死第一隻：拿獎勵、換下一隻，進度與回顧點都不動
  let out = A.settle({ ...r, stage: { ...r.stage, hp: 1 } }, 1000, 1);
  assert.deepEqual(out.events.map(e => e.type), ['wave']);
  assert.equal(out.state.progress, 5, '回顧不推進度');
  assert.equal(out.state.revisitAt, 2); assert.equal(out.state.stage.wave, 2);
  assert.ok(out.state.coins > r.coins);
  // 打滿 WAVES 隻：這一站清完，回顧點往下一站走（使用者：「等於那關從走，但保留整體進度」）
  for (let k = 2; k < R.WAVES; k++) out = A.settle({ ...out.state, stage: { ...out.state.stage, hp: 0 } }, 1000 + k, 0);   // dt=0 沒有放置傷害，直接把血歸零
  out = A.settle({ ...out.state, stage: { ...out.state.stage, hp: 0 } }, 2000, 0);
  assert.deepEqual(out.events.map(e => e.type), ['farm']);
  assert.equal(out.state.stage, null); assert.equal(out.state.revisitAt, 3, '往下一站走');
  assert.equal(out.state.progress, 5, '回顧不推進度');
  // 下一站是這一段的王：回顧的王是真的王（機制、期限），打贏就結束回顧；逾時不算輸
  const rb = A.revisit(out.state, 3000, out.state.revisitAt);
  assert.equal(rb.stage.boss, true); assert.ok(rb.stage.deadline > 3000); assert.ok(rb.stage.minions, '有王的機制');
  assert.equal(A.canRevisit(rb, 1), true, '回顧中的王隨時可以走');
  const timeout = A.settle(rb, rb.stage.deadline + 1, 0);
  assert.equal(timeout.state.stage, null); assert.equal(timeout.state.bossFailed, null, '回顧的王逾時不算輸');
  assert.equal(timeout.state.revisitAt, 3, '逾時留在回顧，等重生再來');
  const win = A.settle({ ...rb, stage: { ...rb.stage, hp: 0, minions: { ...rb.stage.minions, left: 0 } } }, 3500, 0);
  assert.equal(win.state.progress, 5, '回顧打贏王也不推進度');
  assert.equal(win.state.revisitAt, null, '這一段的王打完＝回顧結束');
  out = { state: A.revisit(base, 0, 2) };   // 下面「回到目前站」的檢查用一個還在回顧中的狀態

  // 回到目前站＝離開回顧
  const back = A.fight(out.state, out.state.cooldownUntil + 1);
  assert.equal(back.revisitAt, null); assert.equal(back.stage.index, 5);

  // 王關進行中不能落跑（不然跑一趟地圖就能躲掉 60 秒判輸）
  const bossing = A.fight(A.normalize({ ...base, progress: 3 }), 0);
  assert.equal(bossing.stage.boss, true);
  assert.equal(A.canRevisit(bossing, 1), false);
  assert.throws(() => A.revisit(bossing, 0, 1), /王關進行中/);

  // 輪迴回到第 0 站：回顧點失效
  assert.equal(A.normalize({ ...r, progress: 0 }).revisitAt, null);
});

test('「下一抽付現」不受手上的券影響（有券時 drawCost1 是 0，拿去寫價錢會印出 0）', () => {
  const a = A.normalize({ ...A.fresh(), unlocked: true, tickets: 18, paidDraws: 0 });
  assert.equal(A.view(a, 0).drawCost1, 0, '有券：這一抽不用付錢');
  assert.equal(A.view(a, 0).drawCostNext, R.DRAW_COST, '但「券用完後一抽」還是原價');
  const paid = A.normalize({ ...a, tickets: 0, paidDraws: 10 });
  assert.equal(A.view(paid, 0).drawCostNext, Math.round(R.DRAW_COST * R.DRAW_GROWTH ** 10));
  assert.equal(A.view(paid, 0).drawCostNext, A.view(paid, 0).drawCost1, '沒券時兩者一致');
});

test('開無盡模式會先離開回顧（不然常駐的那一隻會把第 21 站擋住）', () => {
  const base = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: R.STATIONS, cleared: true });
  const standing = A.revisit(base, 0, A.incomeIndex(base));   // 全線通行後場上常駐的那一隻
  assert.equal(standing.revisitAt, A.incomeIndex(base));
  const on = A.setEndless(standing, true);
  assert.equal(on.revisitAt, null, '開無盡＝離開回顧');
  assert.equal(on.stage, null, '常駐的那一隻要收掉');
  assert.equal(A.canFight(on, 0), true, '接下來打得到第 21 站');
  // 輪迴也要清掉
  assert.equal(A.replay(A.normalize({ ...standing, cleared: true })).revisitAt, null);
});

test('normalize 會把 revisitAt 與場上的回顧對齊（壞存檔不能各說各話）', () => {
  const base = A.normalize({ ...A.fresh(), unlocked: true, collection: { m1: 1 }, roster: ['m1'], progress: 5 });
  const r = A.revisit(base, 0, 2);
  // ① stage 是回顧、revisitAt 卻是 null → 以 stage 為準補回來
  assert.equal(A.normalize({ ...r, revisitAt: null }).revisitAt, 2);
  // ② revisitAt 指到別站 → 也以 stage 為準
  assert.equal(A.normalize({ ...r, revisitAt: 4 }).revisitAt, 2);
  // ③ 場上是正規戰鬥（不是 farm）→ revisitAt 一定要清掉
  const fighting = A.fight(base, 0);
  assert.equal(A.normalize({ ...fighting, revisitAt: 2 }).revisitAt, null);
  // ④ 沒有場次、只是在等重生 → revisitAt 留著（autoFight 靠它接下一隻）
  assert.equal(A.normalize({ ...r, stage: null }).revisitAt, 2);
});
