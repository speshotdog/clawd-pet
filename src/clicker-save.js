(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const KEY = 'clicker_save';
  function fresh(now) {
    return { version: 1, balanceVersion: 1, revision: 0, savedAt: now, settledAt: now,
      coins: 0, lifetimeCoins: 0, manualClicks: 0, clickLevel: 0, trainingLevel: 0,
      collection: {}, paidDraws: 0, pity: { sinceLegendary: 0 }, pending: null,
      package: { index: 1, progress: 0 }, claimedMilestones: [],
      skillSlots: [null, null, null], cooldownUntil: {}, slotReadyAt: [0, 0, 0], effects: [],
      settings: { muted: false, mode: 'wish', scene: 'backyard', music: true, musicVolume: .6, sfxVolume: .8 } };
  }
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const number = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const integer = (v) => number(v) && Number.isSafeInteger(v);
  const known = (id) => Object.hasOwn(B.characters, id);
  function validate(s, pool) {
    const check = (ok, field) => { if (!ok) throw new Error(`存檔驗證失敗：${field}`); };
    check(object(s) && s.version === 1 && s.balanceVersion === 1, '版本（本版不降級或重置）');
    for (const key of ['coins', 'lifetimeCoins', 'savedAt', 'settledAt']) check(number(s[key]), key);
    for (const key of ['revision', 'manualClicks', 'clickLevel', 'trainingLevel', 'paidDraws']) check(integer(s[key]), key);
    check(s.lifetimeCoins >= s.coins, '累計收入');
    check(object(s.collection), 'collection');
    for (const [id, count] of Object.entries(s.collection)) check(known(id) && integer(count) && count > 0, '角色張數');
    check(object(s.pity) && integer(s.pity.sinceLegendary) && s.pity.sinceLegendary < 40 && s.pity.sinceLegendary <= s.paidDraws, '保底');
    check(object(s.package) && integer(s.package.index) && s.package.index >= 1 && number(s.package.progress) && s.package.progress < E.requirement(s.package.index, s.settings?.scene), '拆包進度');
    check(Number.isFinite(E.requirement(s.package.index, s.settings?.scene)) && Object.values(E.rates(s)).every(number), '數值溢出');
    check(Array.isArray(s.claimedMilestones) && s.claimedMilestones.every((v) => v === 'tutorial50') && new Set(s.claimedMilestones).size === s.claimedMilestones.length, '獎勵紀錄');
    check(s.manualClicks < 50 ? !s.claimedMilestones.includes('tutorial50') : s.claimedMilestones.includes('tutorial50') && s.collection.yueyue2 > 0, '教學獎勵');
    check(Array.isArray(s.skillSlots) && s.skillSlots.length === 3 && s.skillSlots.every((id, i) => id === null || (known(id) && s.collection[id] > 0 && i < E.slotCount(s))), '技能槽');
    check(new Set(s.skillSlots.filter(Boolean)).size === s.skillSlots.filter(Boolean).length, '重複槽位');
    check(Array.isArray(s.slotReadyAt) && s.slotReadyAt.length === 3 && s.slotReadyAt.every(number), '換槽時間');
    check(object(s.cooldownUntil) && Object.entries(s.cooldownUntil).every(([id, t]) => known(id) && s.collection[id] > 0 && number(t)), '冷卻');
    check(Array.isArray(s.effects) && s.effects.length <= 3, '效果');
    const sources = new Set();
    for (const e of s.effects) {
      check(object(e) && known(e.source) && s.collection[e.source] > 0 && !sources.has(e.source), '效果來源'); sources.add(e.source);
      const def = B.characters[e.source];
      check(def.kind && e.kind === def.kind && number(e.startedAt) && number(e.expiresAt) && e.expiresAt - e.startedAt === def.duration * 1000 && e.startedAt <= s.settledAt, '效果期限');
      check(s.cooldownUntil[e.source] === e.startedAt + def.cd * 1000, '效果冷卻');
      if (e.kind === 'click') check(e.multiplier === def.multiplier && integer(e.remaining) && e.remaining > 0 && e.remaining <= def.charges, '次數效果');
      else if (e.kind === 'clickTime') check(e.multiplier === def.multiplier, '時間倍率');
      else if (e.kind === 'clickAdd') check(number(e.value) && integer(e.remaining) && e.remaining > 0 && e.remaining <= def.charges, '點擊加法');
      else if (['self', 'team'].includes(e.kind)) check(number(e.value), '產能快照');
      else check(known(e.target) && e.target !== e.source && s.collection[e.target] > 0 && number(e.value), '寄生快照');
    }
    check(object(s.settings) && typeof s.settings.muted === 'boolean' && B.modes.includes(s.settings.mode), '設定');
    s.settings.scene ??= 'backyard'; s.settings.music ??= true;
    s.settings.musicVolume ??= .6; s.settings.sfxVolume ??= .8;
    check(['musicVolume','sfxVolume'].every(k => number(s.settings[k]) && s.settings[k] <= 1), '音量');
    const scenes = node ? require('./clicker-scene.js').scenes : root.ClickerScenes;
    check(typeof s.settings.music === 'boolean' && Object.hasOwn(scenes, s.settings.scene) && s.package.index >= scenes[s.settings.scene].unlockPackages, '場景與音樂');
    if (s.pending !== null) {
      const draw = s.pending?.draw;
      check(object(draw) && typeof draw.id === 'string' && draw.id.length > 0 && integer(draw.visualSeed) && draw.visualSeed <= 0xffffffff, 'pending 身分');
      check(Array.isArray(draw.entries) && [1, 5].includes(draw.entries.length) && draw.entries.length <= s.paidDraws, 'pending 張數');
      const counts = { ...s.collection }, keys = new Set();
      for (const [i, item] of draw.entries.entries()) {
        const id = item?.entry?.id;
        check(known(id) && item.key === `${draw.id}:${i}` && !keys.has(item.key), 'pending 角色'); keys.add(item.key);
        check(item.owned === (counts[id] || 0) && item.dup === (item.owned > 0), 'pending 升星計數');
        if (pool) check(item.entry.kind === pool.byId[id].kind && item.entry.rarity === pool.byId[id].rarity && item.entry.name === pool.byId[id].name, 'pending 目錄');
        counts[id] = (counts[id] || 0) + 1;
      }
      const lastLegendary = draw.entries.findLastIndex((item) => item.entry.rarity === 'legendary');
      if (lastLegendary >= 0) check(s.pity.sinceLegendary === draw.entries.length - lastLegendary - 1, 'pending 保底');
    }
    return s;
  }
  function create(storage, { now = Date.now, pool } = {}) {
    let state = null, raw = null, error = null, blocked = false;
    try { raw = storage.getItem(KEY); state = raw === null ? fresh(now()) : validate(JSON.parse(raw), pool); }
    catch (err) { error = err; blocked = true; }
    return {
      get state() { return state; }, get raw() { return raw; }, get error() { return error; }, get blocked() { return blocked; },
      // 點擊與 1Hz 結算只更新工作副本；消費提交成功才替換它。
      stage(next) { if (blocked) return false; state = next; return true; },
      commit(next = state) {
        if (!state) return false;
        try {
          const candidate = E.clone(next);
          candidate.revision = state.revision + 1; candidate.savedAt = Math.max(state.savedAt, now());
          validate(candidate, pool);
          const encoded = JSON.stringify(candidate);
          storage.setItem(KEY, encoded);
          state = candidate; raw = encoded; error = null; blocked = false; return true;
        } catch (err) { error = err; blocked = true; return false; }
      },
    };
  }
  const api = { KEY, fresh, validate, create };
  if (node) module.exports = api; else root.ClickerSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
