// 儲存的隊伍（朋友 2026-09-16 建議）：存三組、套用時過濾掉不在卡冊／派遣中的卡、壞資料 normalize 掉
const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global; require('../../src/apoc/pool.js');
const A = require('../../src/clicker-apoc-economy.js');
const ids = ApocPool.filter(c => c.rarity === 'epic').slice(0, 5).map(c => c.id);
const base = () => A.normalize({ ...A.fresh(), unlocked: true, collection: Object.fromEntries(ids.map(id => [id, 1])), roster: ids.slice(0, 4), skills: [ids[0], ids[1], null, null] });

test('normalize：presets 固定三格，壞資料整組丟、名字截 24 字', () => {
  const a = A.normalize({ ...A.fresh(), presets: [{ name: 'x'.repeat(40), roster: [ids[0], ids[0], 5], skills: [ids[0], 7] }, 'junk'] });
  assert.equal(a.presets.length, A.RULES.PRESETS);
  assert.deepEqual(a.presets[0], { name: 'x'.repeat(24), roster: [ids[0]], skills: [ids[0], null, null, null] });
  assert.equal(a.presets[1], null); assert.equal(a.presets[2], null);
});
test('savePreset 照抄目前隊伍與技能槽；applyPreset 寫回一模一樣', () => {
  let a = A.savePreset(base(), 1, '王關');
  assert.deepEqual(a.presets[1], { name: '王關', roster: ids.slice(0, 4), skills: [ids[0], ids[1], null, null] });
  a = A.setTeam(a, [ids[4]], [ids[4], null, null, null]);
  const r = A.applyPreset(a, 1);
  assert.equal(r.missing, 0); assert.deepEqual(r.state.roster, ids.slice(0, 4)); assert.deepEqual(r.state.skills, [ids[0], ids[1], null, null]);
  assert.throws(() => A.applyPreset(a, 0), /空的/); assert.throws(() => A.savePreset(a, 3, ''), /沒有這一組/);
});
test('applyPreset：不在卡冊或派遣中的卡跳過並回報缺幾張，技能槽跟著清', () => {
  let a = A.savePreset(base(), 0, '');
  a = { ...a, collection: { ...a.collection, [ids[1]]: 0 }, roster: [], skills: [null, null, null, null], dispatch: [{ id: ids[2], startedAt: 0, until: A.RULES.DISPATCH.MS }] };
  const r = A.applyPreset(a, 0);
  assert.equal(r.missing, 2); assert.deepEqual(r.state.roster, [ids[0], ids[3]]); assert.deepEqual(r.state.skills, [ids[0], null, null, null]);
});

// ── Astra 複檢（VERDICT-2026-09-16-presets）必修 3／建議 4 ──
test('存檔驗證：1.0 teamPresets 壞資料整組 null、未知卡與多餘欄位清掉、舊存檔補三個空組', () => {
  const S = require('../../src/clicker-save.js'), Pool = require('../../src/gacha-pool.js');
  const s = S.fresh(0); s.collection = { zhenmu: 1 };
  s.teamPresets = [{}, { name: 'x'.repeat(30), roster: ['zhenmu', 'nope', 'zhenmu', 7], skills: ['zhenmu', 'nope', 3], junk: 1 }, 'bad', 1, 2];
  const v = S.validate(JSON.parse(JSON.stringify(s)), Pool);
  assert.equal(v.teamPresets.length, 3); assert.equal(v.teamPresets[0], null); assert.equal(v.teamPresets[2], null);
  assert.deepEqual(v.teamPresets[1], { name: 'x'.repeat(24), roster: ['zhenmu'], skills: ['zhenmu', null, null, null] });
  const old = S.fresh(0); old.collection = { zhenmu: 1 }; delete old.teamPresets;
  assert.deepEqual(S.validate(JSON.parse(JSON.stringify(old)), Pool).teamPresets, [null, null, null]);
});
test('useSkill 記下這一次效果的實際總量（王關破防 ×.6 之後圓環分母要用實際秒數）', () => {
  const id = ApocPool.find(c => c.role === 'breach' && c.rarity === 'rare').id;
  let a = A.normalize({ ...A.fresh(), unlocked: true, collection: { [id]: 1 }, roster: [id], skills: [id, null, null, null], progress: 15 });
  a = A.fight(a, 0); a.stage = { ...a.stage, need: 1e8, hp: 1e8 };
  const def = A.RULES.SKILLS.breach.rare, b = A.useSkill(a, 0, 0);
  assert.equal(b.stage.breakMs, b.stage.breakUntil); assert.ok(Math.abs(b.stage.breakMs - def.ms * A.mechRules().RESIST.BREACH_TIME) < 1e-6);
  const t = ApocPool.find(c => c.role === 'train' && c.rarity === 'epic').id;
  let c = A.normalize({ ...A.fresh(), unlocked: true, collection: { [t]: 1 }, roster: [t], skills: [t, null, null, null] }); c = A.fight(c, 0);
  c = A.useSkill(c, 0, 1000); assert.equal(c.fx.powerMs, A.RULES.SKILLS.train.epic.ms); assert.equal(c.fx.powerUntil, 1000 + c.fx.powerMs);
});
