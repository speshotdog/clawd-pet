(function (root) {
  const B = typeof module !== 'undefined' && module.exports ? require('./clicker-balance.js') : root.ClickerBalance;
  const Scenes = typeof module !== 'undefined' && module.exports ? require('./clicker-scene.js').resolve : root.ClickerScene.resolve;
  const clone = (s) => JSON.parse(JSON.stringify(s));
  const clickCost = (l) => Math.ceil(10 * 1.30 ** l);
  const trainingCost = (t) => Math.ceil(1000 * 1.60 ** t);
  const drawCost = (n, count = 1) => Array.from({ length: count }, (_, i) => Math.ceil(150 * 1.30 ** Math.floor((n + i) / 5))).reduce((a, b) => a + b, 0);
  const stars = (n) => n < 1 ? 0 : B.stars.filter((threshold) => n >= threshold).length;
  const starMultiplier = (n) => n < 1 ? 0 : 1 + .25 * (stars(n) - 1) + .01 * Math.max(0, n - 16);
  const individual = (s, id) => B.characters[id].base * starMultiplier(s.collection[id] || 0) * 1.15 ** s.trainingLevel;
  function rates(s) {
    const P = Object.keys(B.characters).reduce((sum, id) => sum + individual(s, id), 0);
    return { P, D: 1.18 ** s.clickLevel + .05 * P };
  }
  function tagFor(entry, dup, owned) {
    if (!owned) return { text: 'NEW', cls: 'new' };
    if (owned >= 16) return { text: `熟練 +${owned + 1 - 16}%`, cls: 'mastery' };
    if (stars(owned + 1) > stars(owned)) return { text: `${stars(owned)}★ → ${stars(owned + 1)}★`, cls: 'star-up' };
    return { text: `升星進度 ${owned + 1}/${B.stars[stars(owned)]}`, cls: 'dup' };
  }
  const requirement = (k, sceneId = 'backyard') => 100 * 1.12 ** (k - 1) * Scenes(sceneId).requirementMul;
  // expm1 保留小區間精度；二分搜尋只依包數的對數次數運算。
  const packageSum = (index, count, sceneId) => count === 0 ? 0 : requirement(index, sceneId) * Math.expm1(count * Math.log(1.12)) / .12;
  function advancePackage(pack, power, sceneId) {
    const total = pack.progress + power;
    let low = 0, high = 1;
    const fits = (n) => packageSum(pack.index, n, sceneId) <= total;
    while (fits(high)) high *= 2;
    while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (fits(mid)) low = mid; else high = mid; }
    let progress = Math.max(0, total - packageSum(pack.index, low, sceneId));
    // 累積等比浮點誤差不留下一包幾乎 100% 的幽靈進度。
    if (requirement(pack.index + low, sceneId) - progress <= requirement(pack.index + low, sceneId) * 1e-12) { low++; progress = 0; }
    return { package: { index: pack.index + low, progress }, completed: low };
  }
  function grant(s, amount) {
    s.coins += amount; s.lifetimeCoins += amount;
    const result = advancePackage(s.package, amount, s.settings.scene); s.package = result.package;
    return result.completed;
  }
  function settle(state, now) {
    const s = clone(state), elapsed = Math.max(0, now - s.settledAt), duration = Math.min(elapsed, B.offlineMs);
    const start = s.settledAt, end = start + duration;
    let earned = rates(s).P * duration / 1000;
    for (const effect of s.effects) if (['passive', 'self', 'team'].includes(effect.kind)) {
      earned += effect.value * Math.max(0, Math.min(end, effect.expiresAt) - Math.max(start, effect.startedAt)) / 1000;
    }
    const completed = grant(s, earned);
    s.settledAt = Math.max(s.settledAt, now);
    s.effects = s.effects.filter((e) => e.expiresAt > s.settledAt && (e.remaining === undefined || e.remaining > 0));
    return { state: s, earned, completed, elapsed, duration };
  }
  function click(state, now) {
    const result = settle(state, now), s = result.state;
    const multiplier = Math.max(1, ...s.effects.filter((e) => ['click', 'clickTime'].includes(e.kind)).map((e) => e.multiplier));
    const amount = rates(s).D * multiplier + s.effects.filter(e => e.kind === 'clickAdd').reduce((sum, e) => sum + e.value, 0);
    result.completed += grant(s, amount); s.manualClicks++;
    for (const effect of s.effects) if (effect.remaining !== undefined) effect.remaining--;
    s.effects = s.effects.filter((e) => e.remaining === undefined || e.remaining > 0);
    const tutorial = s.manualClicks >= 50 && !s.claimedMilestones.includes('tutorial50');
    if (tutorial) {
      s.collection.yueyue2 = (s.collection.yueyue2 || 0) + 1;
      s.claimedMilestones.push('tutorial50');
      if (!s.skillSlots[0]) s.skillSlots[0] = 'yueyue2';
    }
    return { ...result, amount, multiplier, tutorial };
  }
  function upgrade(state, type, max, now) {
    const s = settle(state, now).state, field = type === 'click' ? 'clickLevel' : 'trainingLevel';
    if (!['click', 'training'].includes(type)) throw new Error('未知升級');
    const cost = type === 'click' ? clickCost : trainingCost;
    let levels = 0;
    do { const price = cost(s[field]); if (price > s.coins || !Number.isFinite(price)) break;
      s.coins -= price; s[field]++; levels++;
    } while (max);
    if (!levels) throw new Error('餘額不足');
    return { state: s, levels };
  }
  const slotCount = (s) => B.slotThresholds.filter((v) => s.lifetimeCoins >= v).length;
  function equip(state, slot, id, now) {
    const s = settle(state, now).state;
    if (!Number.isInteger(slot) || slot < 0 || slot >= slotCount(s) || (id !== null && !s.collection[id])) throw new Error('無法裝備');
    if (s.pending) throw new Error('請先收下招募');
    if (s.skillSlots[slot] === id) return s;
    if (id && s.skillSlots.includes(id)) throw new Error('角色已在其他槽位');
    s.skillSlots[slot] = id; s.slotReadyAt[slot] = s.settledAt + 30000;
    return s;
  }
  function activate(state, slot, now) {
    const s = settle(state, now).state, id = s.skillSlots[slot], def = B.characters[id], t = s.settledAt;
    if (s.pending || slot >= slotCount(s) || !s.collection[id] || !def?.kind) throw new Error('技能尚未開放');
    if ((s.cooldownUntil[id] || 0) > t || s.slotReadyAt[slot] > t) throw new Error('技能冷卻中');
    const effect = { source: id, kind: def.kind, startedAt: t, expiresAt: t + (def.duration || 0) * 1000 };
    if (def.kind === 'click') Object.assign(effect, { multiplier: def.multiplier, remaining: def.charges });
    else if (def.kind === 'clickTime') effect.multiplier = def.multiplier;
    else if (def.kind === 'self') effect.value = individual(s, id) * (def.multiplier - 1);
    else if (def.kind === 'team') effect.value = rates(s).P * def.ratio;
    else if (def.kind === 'clickAdd') Object.assign(effect, { value: rates(s).P * def.ratio, remaining: def.charges });
    else if (def.kind === 'burst') effect.value = def.factor * (def.basis === 'individual' ? individual(s, id) : rates(s).P);
    else {
      const targets = Object.keys(s.collection).filter((key) => key !== id && s.collection[key] > 0).sort((a, b) => individual(s, b) - individual(s, a));
      if (!targets.length) throw new Error('需要另一位夥伴');
      effect.target = targets[0]; effect.value = individual(s, effect.target);
    }
    const completed = def.kind === 'burst' ? grant(s, effect.value) : 0;
    if (def.kind !== 'burst') s.effects.push(effect); s.cooldownUntil[id] = t + def.cd * 1000;
    return { state: s, effect, completed };
  }
  function purchaseDraw(state, count, now, pool, options = {}) {
    const s = settle(state, now).state;
    if (s.pending || ![1, 5].includes(count)) throw new Error('尚有待收下結果或張數錯誤');
    const price = drawCost(s.paidDraws, count);
    if (!Number.isFinite(price) || s.coins < price) throw new Error('餘額不足');
    const result = pool.rollPack({ ...options, count, policy: pool.GAME_POLICY, pity: s.pity.sinceLegendary, collection: s.collection });
    s.coins -= price; s.paidDraws += count; s.pity.sinceLegendary = result.nextPity;
    s.pending = { draw: result.draw };
    return s;
  }
  function collect(state, drawId, now) {
    // 同一 id 第二次收下直接拒絕；不結算、不寫入、不播入隊。
    if (!state.pending || state.pending.draw.id !== drawId) return { state, accepted: false };
    const s = settle(state, now).state, entries = s.pending.draw.entries;
    const newIds = [...new Set(entries.filter((e) => !s.collection[e.entry.id]).map((e) => e.entry.id))];
    for (const item of entries) s.collection[item.entry.id] = (s.collection[item.entry.id] || 0) + 1;
    s.pending = null;
    return { state: s, accepted: true, newIds };
  }
  const api = { clone, clickCost, trainingCost, drawCost, stars, starMultiplier, individual, rates, tagFor,
    requirement, packageSum, advancePackage, settle, click, upgrade, slotCount, equip, activate, purchaseDraw, collect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
