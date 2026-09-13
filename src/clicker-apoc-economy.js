// v3 末世（2.0）經濟：純邏輯、無 DOM（2026-09-13 第一版，使用者：「繼續完成關卡串接」）。
// 照 DESIGN-team-and-map.md §7-3／7-4 與 DESIGN-2026-09-12-content-architecture.md §三：
//   一般關＝放置／點擊，打不死就過不去；王關 60 秒時限、失敗冷卻 3 分鐘；沒有其他懲罰。
//   只有隊伍（roster）產戰力；四階落差小 100/85/72/60；重複卡直接升星（每星 +25%）。
//   末世金幣：通關獎勵＋放置產出；券固定 1000 一張；抽率 0.25/4/20/75.75（在招募頁）。
// 卡表由 tools/apoc/build_apoc.py 從 holo-5.0 的 pool_data 產成 src/apoc/pool.js（window.ApocPool）。
(function (root) {
  const RULES = {
    POWER: { mythic: 100, legendary: 85, epic: 72, rare: 60, common: 50 },
    STAR_MUL: .25,           // 每多一張同卡 +25%
    CLICK_SHARE: .5,         // 一下＝每秒戰力的一半
    // 2026-09-13 之後這一輪定案：用 tools/sim/apoc.js 掃出來的（目標＝一天三段 20 分鐘、20 站 3～5 天）。
    // 量到的形狀：第 1 站 4 分鐘 → 第 20 站 33 分鐘，累計遊玩 202 分鐘、第 4 天全線通行、抽 210 次、收集 46/71。
    // ⚠ 末世沒有離線收益，所以「幾天」＝「玩了幾段」，不是掛機天數。
    BASE_NEED: 600000, GROWTH: 1.20, BOSS_MUL: 2.5,
    REWARD_SHARE: .02,       // 通關獎勵＝血量 ×0.02 末世金幣
    IDLE_COINS: .01,         // 放置產出＝每秒戰力 ×0.01
    // 券價隨「已經買過幾張」往上走（同 1.0 的招募費用），不然放置金幣是跟戰力一起指數長的，
    // 戰力→金幣→抽卡→戰力 會直接跑掉：模擬器量到一輪 20 站可以抽到一千七百次。
    TICKET_COST: 1000, TICKET_GROWTH: 1.02, STATIONS: 20,
    // 王關**沒有時限**（BOSS_TIME 0 就是關掉）。模擬器量過：後段一站本來就要幾分鐘，
    // 再壓一個 60／120 秒的限時，王關一定是一道硬牆——一輪 20 站可以失敗八百多次。
    // 王的難度改由護盾承擔：要人在場一直點，不能純掛機。時限與冷卻的程式留著，數字歸零。
    BOSS_TIME: 0, BOSS_COOLDOWN: 60000,
    // 王關機制（使用者 2026-09-13：護盾＋節奏，節奏用「點擊次數」而不是計時器，而且不要太嚴苛）：
    //   王有護盾，護盾在場時放置傷害只剩三成五（不是零，放著還是會動）；
    //   累積 TAPS 下點擊破盾 → BREAK_MS 毫秒破防，全部傷害 ×2；破防結束重新起盾，需要的點擊數 ×GROWTH。
    //   一般關完全不受影響。
    SHIELD: { TAPS: 15, GROWTH: 1.25, IDLE_MUL: .35, BREAK_MS: 8000, BREAK_MUL: 2 },
    // 獨立技能格 4 格：沿用 1.0 的語意（點擊倍率／全隊加成／冷卻縮短），技能由卡的稀有度決定
    SKILLS: {
      mythic:    { name: '一口氣開封', kind: 'clickMul', value: 10, uses: 10, cd: 60000, text: '接下來 10 次點擊 ×10' },
      legendary: { name: '尾巴節拍',   kind: 'clickMul', value: 3,  uses: 15, cd: 45000, text: '接下來 15 次點擊 ×3' },
      epic:      { name: '全隊加訓',   kind: 'powerMul', value: 1.5, ms: 20000, cd: 60000, text: '全隊戰力 ×1.5，20 秒' },
      rare:      { name: '重整',       kind: 'cool',     value: 8000, cd: 45000, text: '其他技能冷卻 −8 秒' },
      common:    { name: '重整',       kind: 'cool',     value: 8000, cd: 45000, text: '其他技能冷卻 −8 秒' },
    },
    GIFT: { card: 'pufayueyue', tickets: 10 },   // 開門禮：普發玥玥＋一次十連
  };
  const isBoss = i => i % 4 === 3;
  const freshShield = cycle => ({ taps: 0, need: Math.round(RULES.SHIELD.TAPS * RULES.SHIELD.GROWTH ** cycle), cycle });
  // 王關傷害倍率：破防中 ×2、護盾在場的放置 ×0.35（點擊不受罰，點擊才是破盾的手段）
  const bossMul = (st, now, byTap) => !st?.boss ? 1 : now < (st.breakUntil || 0) ? RULES.SHIELD.BREAK_MUL : byTap ? 1 : RULES.SHIELD.IDLE_MUL;
  const skillOf = (a, slot) => { const id = a.skills?.[slot]; const c = id ? poolById()[id] : null; return c ? { slot, id, card: c, ...RULES.SKILLS[c.rarity] } : null; };
  const powerMul = (a, now) => (a.fx && now < (a.fx.powerUntil || 0)) ? (a.fx.powerMul || 1) : 1;
  // ⚠ 這個表每次點擊都會被查好幾十次（power() → cardPower() → poolById()），
  //   原本每次都重建一個 71 筆的物件；快取起來，卡池換了才重算。
  let poolCache = null, poolCacheSrc = null;
  const poolById = () => { const src = root.ApocPool || []; if (src !== poolCacheSrc) { poolCacheSrc = src; poolCache = Object.fromEntries(src.map(c => [c.id, c])); } return poolCache; };
  function fresh() { return { unlocked: false, tutorial: 0, coins: 0, tickets: 0, progress: 0, cooldownUntil: 0, collection: {}, roster: [], skills: [null, null, null, null], stage: null, gifted: false, wins: 0, ticketsBought: 0, pending: null, cleared: false, skillCd: [0, 0, 0, 0], fx: { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1 } }; }
  function normalize(a) {
    const f = fresh(); a = { ...f, ...(a || {}) };
    if (!a.collection || typeof a.collection !== 'object') a.collection = {};
    if (!Array.isArray(a.roster)) a.roster = [];
    if (!Array.isArray(a.skills)) a.skills = []; a.skills = [0, 1, 2, 3].map(i => a.skills[i] || null);
    a.roster = a.roster.filter(id => a.collection[id] > 0);
    a.skills = a.skills.map(id => (id && a.roster.includes(id)) ? id : null);
    if (a.stage && (typeof a.stage.hp !== 'number' || a.stage.index !== a.progress)) a.stage = null;
    if (a.stage && a.stage.boss && !a.stage.shield) { a.stage = { ...a.stage, shield: freshShield(0), breakUntil: 0 }; }   // 舊存檔的王關補上護盾
    a.ticketsBought = Math.max(0, Math.floor(Number(a.ticketsBought) || 0));
    a.cleared = !!a.cleared;
    if (!a.pending || !a.pending.draw || !Array.isArray(a.pending.draw.entries)) a.pending = null;
    a.skillCd = [0, 1, 2, 3].map(i => Number(a.skillCd?.[i]) || 0);
    a.fx = { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1, ...(a.fx || {}) };
    return a;
  }
  function gift(a) {
    if (a.gifted) return a;
    a = { ...a, gifted: true, collection: { ...a.collection }, tickets: a.tickets + RULES.GIFT.tickets };
    if (poolById()[RULES.GIFT.card]) { a.collection[RULES.GIFT.card] = (a.collection[RULES.GIFT.card] || 0) + 1; if (!a.roster.includes(RULES.GIFT.card)) a.roster = [...a.roster, RULES.GIFT.card]; }
    return a;
  }
  function cardPower(a, id) { const c = poolById()[id]; if (!c || !a.collection[id]) return 0; return RULES.POWER[c.rarity] * (1 + RULES.STAR_MUL * (a.collection[id] - 1)); }
  const power = a => a.roster.reduce((sum, id) => sum + cardPower(a, id), 0);
  const need = i => Math.round(RULES.BASE_NEED * RULES.GROWTH ** i * (isBoss(i) ? RULES.BOSS_MUL : 1));
  const reward = i => Math.round(need(i) * RULES.REWARD_SHARE);
  const canFight = (a, now) => !a.stage && a.progress < RULES.STATIONS && !(isBoss(a.progress) && a.cooldownUntil > now);
  function fight(a, now) {
    if (!canFight(a, now)) throw new Error(a.progress >= RULES.STATIONS ? '全線已通行' : a.stage ? '戰鬥中' : '王關冷卻中');
    if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
    const i = a.progress, boss = isBoss(i);
    return { ...a, stage: { index: i, hp: need(i), need: need(i), boss, startedAt: now, deadline: boss && RULES.BOSS_TIME ? now + RULES.BOSS_TIME : null, shield: boss ? freshShield(0) : null, breakUntil: 0 } };
  }
  // 結算：回傳 { state, events:[{type:'win'|'fail', index}] }
  function settle(a, now, dt) {
    const events = []; let s = { ...a };
    if (s.fx && s.fx.powerUntil && now >= s.fx.powerUntil) s.fx = { ...s.fx, powerUntil: 0, powerMul: 1 };
    const p = power(s) * powerMul(s, now);
    if (dt > 0) s.coins += p * RULES.IDLE_COINS * dt;
    if (s.stage) {
      let st = { ...s.stage };
      // 破防時間到 → 重新起盾，下一輪要的點擊數 ×GROWTH
      if (st.boss && st.breakUntil && now >= st.breakUntil) st = { ...st, breakUntil: 0, shield: freshShield((st.shield?.cycle || 0) + 1) };
      if (dt > 0) st.hp -= p * dt * bossMul(st, now, false);
      if (st.hp <= 0) {
        s.coins += reward(st.index); s.progress = st.index + 1; s.wins = (s.wins || 0) + 1; s.stage = null;
        events.push({ type: 'win', index: st.index, reward: reward(st.index) });
        // 全線通行只報一次；之後留在末世繼續放置與補收藏
        if (s.progress >= RULES.STATIONS && !s.cleared) { s.cleared = true; events.push({ type: 'cleared' }); }
      }
      else if (st.deadline && now >= st.deadline) { s.stage = null; s.cooldownUntil = now + RULES.BOSS_COOLDOWN; events.push({ type: 'fail', index: st.index }); }
      else s.stage = st;
    }
    return { state: s, events };
  }
  function tap(a, now) {
    if (!a.stage) return a;
    // 次數型增益（尾巴節拍／一口氣開封）在這裡消耗一格
    let fx = { ...a.fx }, boost = 1;
    if (fx.clickLeft > 0) { boost = fx.clickMul || 1; fx.clickLeft -= 1; if (!fx.clickLeft) fx.clickMul = 1; }
    let st = { ...a.stage };
    if (st.boss && !(now < (st.breakUntil || 0))) {
      // 護盾在場：這一下算進破盾進度；點滿就破防
      const sh = { ...(st.shield || freshShield(0)) }; sh.taps += 1;
      st.shield = sh; if (sh.taps >= sh.need) st.breakUntil = now + RULES.SHIELD.BREAK_MS;
    }
    st.hp -= power(a) * powerMul(a, now) * RULES.CLICK_SHARE * boost * bossMul(a.stage, now, true);
    return { ...a, stage: st, fx };
  }
  function canSkill(a, slot, now) { return !!skillOf(a, slot) && now >= (a.skillCd?.[slot] || 0); }
  function useSkill(a, slot, now) {
    const def = skillOf(a, slot); if (!def) throw new Error('這格還沒放卡');
    if (now < (a.skillCd?.[slot] || 0)) throw new Error('技能冷卻中');
    let fx = { ...a.fx }, cd = [...(a.skillCd || [0, 0, 0, 0])];
    if (def.kind === 'clickMul') { fx.clickMul = def.value; fx.clickLeft = def.uses; }
    else if (def.kind === 'powerMul') { fx.powerMul = def.value; fx.powerUntil = now + def.ms; }
    else if (def.kind === 'cool') cd = cd.map((t, i) => i === slot ? t : Math.max(now, t - def.value));
    cd[slot] = now + def.cd;
    return { ...a, fx, skillCd: cd };
  }
  const ticketCost = (a, n = 1) => { let sum = 0; for (let i = 0; i < n; i++) sum += Math.round(RULES.TICKET_COST * RULES.TICKET_GROWTH ** ((a.ticketsBought || 0) + i)); return sum; };
  function buyTicket(a, n = 1) {
    const cost = ticketCost(a, n);
    if (a.coins < cost) throw new Error(`末世金幣不足，下一張券 ${ticketCost(a, 1)}`);
    return { ...a, coins: a.coins - cost, tickets: a.tickets + n, ticketsBought: (a.ticketsBought || 0) + n };
  }
  // 招募頁抽完回報卡片 id：券在這裡扣（頁面只是演出）
  function drawn(a, ids) {
    const pool = poolById(); ids = ids.filter(id => pool[id]);
    if (!ids.length) return a;
    if (a.tickets < ids.length) throw new Error('末世券不足');
    const collection = { ...a.collection }; for (const id of ids) collection[id] = (collection[id] || 0) + 1;
    let roster = [...a.roster];
    for (const id of ids) if (!roster.includes(id) && roster.length < 20 && !rosterViolations(roster.concat(id)).length) roster.push(id);   // 新卡自動入隊（同 1.0）
    return { ...a, tickets: a.tickets - ids.length, collection, roster };
  }
  const LIMITS = [2, 6, 12, 20], RANK = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 3 };
  const rosterCounts = ids => { const pool = poolById(); return LIMITS.map((_, i) => ids.filter(id => pool[id] && RANK[pool[id].rarity] <= i).length); };
  const rosterViolations = ids => rosterCounts(ids).flatMap((n, i) => n > LIMITS[i] ? [i] : []);
  function setTeam(a, roster, skills) {
    roster = (roster || []).filter((id, i, arr) => a.collection[id] > 0 && arr.indexOf(id) === i).slice(0, 20);
    if (rosterViolations(roster).length) throw new Error('超過階級上限');
    skills = (skills || a.skills).map(id => (id && roster.includes(id)) ? id : null); while (skills.length < 4) skills.push(null);
    return { ...a, roster, skills: skills.slice(0, 4) };
  }
  // 末世的抽卡：卡池是 ApocPool，貨幣是末世券，但**產出的 draw 形狀跟 1.0 的 rollPack 完全一樣**，
  // 所以招募層、五種演出、收下流程全部共用（使用者：兩邊邏輯不要差太多）。
  const RATES = [['mythic', .0025], ['legendary', .04], ['epic', .20], ['rare', .7575]];
  function rollPack(a, count, rng = Math.random, id = `apoc-${Date.now().toString(36)}-${Math.floor(rng() * 1e6).toString(36)}`) {
    const pool = {}; for (const c of (root.ApocPool || [])) (pool[c.rarity === 'common' ? 'rare' : c.rarity] ||= []).push(c);
    const owned = { ...a.collection };
    const entries = [];
    for (let i = 0; i < count; i++) {
      let r = rng(), acc = 0, rarity = 'rare';
      for (const [name, p] of RATES) { acc += p; if (r < acc) { rarity = name; break; } }
      const list = pool[rarity] && pool[rarity].length ? pool[rarity] : pool.rare;
      const entry = list[Math.floor(rng() * list.length)];
      const had = owned[entry.id] || 0; owned[entry.id] = had + 1;
      entries.push(Object.freeze({ key: `${id}:${i}`, entry: Object.freeze({ ...entry }), dup: had > 0, owned: had }));
    }
    return Object.freeze({ id, entries: Object.freeze(entries), visualSeed: Math.floor(rng() * 2 ** 31) });
  }
  function purchaseDraw(a, count, now, rng) {
    if (a.pending) throw new Error('還有沒收下的結果');
    if (a.tickets < count) throw new Error(`末世券不足（還有 ${a.tickets} 張）`);
    return { ...a, tickets: a.tickets - count, pending: { draw: rollPack(a, count, rng) } };
  }
  function collectDraw(a, drawId, now) {
    if (!a.pending || a.pending.draw.id !== drawId) return { state: a, accepted: false };
    const ids = a.pending.draw.entries.map(e => e.entry.id);
    const next = drawn({ ...a, tickets: a.tickets + ids.length, pending: null }, ids);   // drawn() 自己會扣券
    const newIds = [...new Set(ids.filter(id => !a.collection[id]))];
    // 末世的「星」就是張數，所以重複＝升星；結算提示用得到
    const starUps = [];
    for (const id of new Set(ids.filter(id => a.collection[id]))) starUps.push({ id, from: a.collection[id], to: next.collection[id] });
    return { state: next, accepted: true, newIds, starUps };
  }
  const view = (a, now) => ({ coins: Math.floor(a.coins), tickets: a.tickets, progress: a.progress, cooldownUntil: a.cooldownUntil, stage: a.stage, power: power(a) * powerMul(a, now),
    skillCd: a.skillCd, fx: a.fx, now, pending: a.pending || null, cleared: !!a.cleared,
    skillDefs: [0, 1, 2, 3].map(i => { const d = skillOf(a, i); return d ? { name: d.name, text: d.text, card: d.card.name, rarity: d.card.rarity } : null; }), canFight: canFight(a, now), need: a.progress < RULES.STATIONS ? need(a.progress) : 0, ticketCost: ticketCost(a, 1), roster: a.roster, skills: a.skills, owned: Object.keys(a.collection).filter(id => a.collection[id] > 0), collection: a.collection, stations: RULES.STATIONS });
  root.ApocEconomy = { RULES, fresh, normalize, gift, power, cardPower, need, reward, isBoss, canFight, fight, settle, tap, buyTicket, drawn, setTeam, rosterCounts, rosterViolations, view, ticketCost, rollPack, purchaseDraw, collectDraw, skillOf, canSkill, useSkill, powerMul };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ApocEconomy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
