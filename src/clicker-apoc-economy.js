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
    BASE_NEED: 3000, GROWTH: 1.22, BOSS_MUL: 6,
    REWARD_SHARE: .1,        // 通關獎勵＝血量 ×0.1 末世金幣
    IDLE_COINS: .01,         // 放置產出＝每秒戰力 ×0.01
    TICKET_COST: 1000, STATIONS: 20,
    BOSS_TIME: 60000, BOSS_COOLDOWN: 180000,
    GIFT: { card: 'pufayueyue', tickets: 10 },   // 開門禮：普發玥玥＋一次十連
  };
  const isBoss = i => i % 4 === 3;
  const poolById = () => Object.fromEntries((root.ApocPool || []).map(c => [c.id, c]));
  function fresh() { return { unlocked: false, tutorial: 0, coins: 0, tickets: 0, progress: 0, cooldownUntil: 0, collection: {}, roster: [], skills: [null, null, null, null], stage: null, gifted: false, wins: 0 }; }
  function normalize(a) {
    const f = fresh(); a = { ...f, ...(a || {}) };
    if (!a.collection || typeof a.collection !== 'object') a.collection = {};
    if (!Array.isArray(a.roster)) a.roster = [];
    if (!Array.isArray(a.skills)) a.skills = []; a.skills = [0, 1, 2, 3].map(i => a.skills[i] || null);
    a.roster = a.roster.filter(id => a.collection[id] > 0);
    a.skills = a.skills.map(id => (id && a.roster.includes(id)) ? id : null);
    if (a.stage && (typeof a.stage.hp !== 'number' || a.stage.index !== a.progress)) a.stage = null;
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
    const i = a.progress; return { ...a, stage: { index: i, hp: need(i), need: need(i), boss: isBoss(i), startedAt: now, deadline: isBoss(i) ? now + RULES.BOSS_TIME : null } };
  }
  // 結算：回傳 { state, events:[{type:'win'|'fail', index}] }
  function settle(a, now, dt) {
    const events = []; let s = { ...a };
    const p = power(s);
    if (dt > 0) s.coins += p * RULES.IDLE_COINS * dt;
    if (s.stage) {
      const st = { ...s.stage };
      if (dt > 0) st.hp -= p * dt;
      if (st.hp <= 0) { s.coins += reward(st.index); s.progress = st.index + 1; s.wins = (s.wins || 0) + 1; s.stage = null; events.push({ type: 'win', index: st.index, reward: reward(st.index) }); }
      else if (st.deadline && now >= st.deadline) { s.stage = null; s.cooldownUntil = now + RULES.BOSS_COOLDOWN; events.push({ type: 'fail', index: st.index }); }
      else s.stage = st;
    }
    return { state: s, events };
  }
  function tap(a, now) { if (!a.stage) return a; const st = { ...a.stage, hp: a.stage.hp - power(a) * RULES.CLICK_SHARE }; return { ...a, stage: st }; }
  function buyTicket(a, n = 1) { const cost = RULES.TICKET_COST * n; if (a.coins < cost) throw new Error(`末世金幣不足，一張券 ${RULES.TICKET_COST}`); return { ...a, coins: a.coins - cost, tickets: a.tickets + n }; }
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
  const view = (a, now) => ({ coins: Math.floor(a.coins), tickets: a.tickets, progress: a.progress, cooldownUntil: a.cooldownUntil, stage: a.stage, power: power(a), canFight: canFight(a, now), need: a.progress < RULES.STATIONS ? need(a.progress) : 0, ticketCost: RULES.TICKET_COST, roster: a.roster, skills: a.skills, owned: Object.keys(a.collection).filter(id => a.collection[id] > 0), collection: a.collection, stations: RULES.STATIONS });
  root.ApocEconomy = { RULES, fresh, normalize, gift, power, cardPower, need, reward, isBoss, canFight, fight, settle, tap, buyTicket, drawn, setTeam, rosterCounts, rosterViolations, view };
})(typeof globalThis !== 'undefined' ? globalThis : this);
