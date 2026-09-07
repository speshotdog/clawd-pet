// 共用卡池：素材目錄 + 抽樣函式。
// 這裡不讀 localStorage、不扣幣、不改 collection；宿主（抽卡演示 gacha.js／遊戲 clicker-gacha.js）
// 各自傳進自己的「政策」（候選、權重、保底）與目前狀態，拿回不可變的 draw 與新的保底計數再存檔。
(function (root) {
  const RARITY = {
    common:    { label: '普通' },
    rare:      { label: '精良' },
    epic:      { label: '史詩' },
    legendary: { label: '傳說' },
    mythic: { label: '神話' },
  };
  const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'common'];
  // id / 顯示名照 menu.js 的 CHARACTERS 與 TOYS
  const CATALOG = [
    { id: 'zhenmu',     name: '珍母',        rarity: 'legendary', kind: 'char' },
    { id: 'jiaobu',     name: '膠布（原版）', rarity: 'legendary', kind: 'char' },
    { id: 'yueyue',     name: '玥玥（原版）', rarity: 'legendary', kind: 'char' },
    { id: 'zhenzhen',   name: '珍珍（原版）', rarity: 'legendary', kind: 'char' },
    { id: 'dog',        name: '熱狗狗狗',    rarity: 'epic', kind: 'char' },
    { id: 'fox',        name: '女僕狐狐',    rarity: 'epic', kind: 'char' },
    { id: 'jiaobu2',    name: '膠布',        rarity: 'epic', kind: 'char' },
    { id: 'zhenzhen2',  name: '珍珍',        rarity: 'epic', kind: 'char' },
    { id: 'yueyue2',    name: '玥玥',        rarity: 'rare', kind: 'char' },
    { id: 'caihua',     name: '采華',        rarity: 'rare', kind: 'char' },
    { id: 'lk',         name: 'ㄌㄎ',        rarity: 'rare', kind: 'char' },
    { id: 'yang',       name: '羊咩',        rarity: 'rare', kind: 'char' },
    { id: 'yueyuexian', name: '玥來玥閒', rarity: 'mythic', kind: 'char', src: 'card-yueyuexian.png' },
    { id: 'zhenfang', name: '珍的很方', rarity: 'legendary', kind: 'char', src: 'card-zhenfang.png' },
    { id: 'lksphinx', name: '獅身ㄌㄎ', rarity: 'legendary', kind: 'char', src: 'card-lksphinx.png' },
    { id: 'zhenmoss', name: '苔蘚珍珍', rarity: 'legendary', kind: 'char', src: 'card-zhenmoss.png' },
    { id: 'yuetrumpet', name: '小號玥', rarity: 'epic', kind: 'char', src: 'card-yuetrumpet.png' },
    { id: 'zhencao', name: '珍的是草', rarity: 'epic', kind: 'char', src: 'card-zhencao.png' },
    { id: 'mianhua', name: '棉花糖', rarity: 'epic', kind: 'char', src: 'card-mianhua.png' },
    { id: 'yangpu', name: '羊咩噗', rarity: 'epic', kind: 'char', src: 'card-yangpu.png' },
    { id: 'alu', name: '阿漉', rarity: 'rare', kind: 'char', src: 'card-alu.png' },
    { id: 'yuelegend', name: '玥玥傳說卡', rarity: 'rare', kind: 'char', art: 'yueyue' },
    { id: 'dino',       name: '小恐龍',      rarity: 'common', kind: 'toy', src: 'toy-dino.png', w: 120 },
    { id: 'ballyellow', name: '黃色球',      rarity: 'common', kind: 'toy', src: 'toy-ballyellow.png', w: 109.4 },
    { id: 'beachball',  name: '皮球',        rarity: 'common', kind: 'toy', src: 'toy-beachball.png', w: 94.7 },
    { id: 'hotdog',     name: '熱狗',        rarity: 'common', kind: 'emoji', glyph: '🌭' },
    { id: 'heart',      name: '愛心',        rarity: 'common', kind: 'emoji', glyph: '♥', color: '#e8473a' },
  ];
  const byId = Object.fromEntries(CATALOG.map((e) => [e.id, e]));
  const CHARACTER_IDS = CATALOG.filter((e) => e.kind === 'char').map((e) => e.id);

  // 抽卡演示視窗的政策：17 張全池、每包至少一張精良、連續 10「包」沒傳說第 10 包必出。
  const DEMO_POLICY = Object.freeze({
    candidates: CATALOG.map((e) => e.id),
    weights: { common: 60, rare: 27, epic: 10, legendary: 3 },
    packMinRarity: 'rare',
    pity: { unit: 'pack', hard: 10 },
  });
  // 遊戲（珍母點點）的政策：只抽 22 隻角色、69.5/25/5/0.5、
  // 保底按「張」算：第 30 張起每張傳說率 +5%（第 30 張 10%、第 31 張 15%…），第 40 張必出。
  const GAME_POLICY = Object.freeze({
    candidates: CHARACTER_IDS,
    weights: { rare: 695, epic: 250, legendary: 50, mythic: 5 },
    pity: { unit: 'draw', hard: 40, softStart: 30, softStep: 0.05 },
  });

  const rank = (r) => RARITY_ORDER.indexOf(r);
  const uuid = () => (root.crypto?.randomUUID ? root.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : r & 3 | 8).toString(16); }));
  const seed32 = () => (root.crypto?.getRandomValues ? root.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 4294967296));

  // 只在候選內存在的稀有度才有權重；minRarity 限制最低階。
  function rollRarity(policy, pool, rng, { minRarity = null, legendaryBonus = 0 } = {}) {
    const weights = {};
    let total = 0;
    for (const r of RARITY_ORDER) {
      if (!pool[r].length) continue;
      if (minRarity && rank(r) > rank(minRarity)) continue;
      weights[r] = policy.weights[r] || 0;
      total += weights[r];
    }
    if (total <= 0) throw new Error('卡池政策沒有可抽的稀有度');
    // 神話沒有保底：軟／硬保底只將低階機率轉給傳說，神話維持原始機率。
    const baseTotal = RARITY_ORDER.reduce((sum, r) => sum + (pool[r].length ? policy.weights[r] || 0 : 0), 0);
    const pMythic = (weights.mythic || 0) / baseTotal;
    let pLegend = (weights.legendary || 0) / total;
    if (minRarity === 'legendary' && weights.legendary) pLegend = 1 - pMythic;
    else if (legendaryBonus > 0 && weights.legendary) pLegend = Math.min(1 - pMythic, pLegend + legendaryBonus);
    const x = rng();
    if (x < pLegend) return 'legendary';
    if (x < pLegend + pMythic) return 'mythic';
    const rest = Object.entries(weights).filter(([k]) => k !== 'legendary' && k !== 'mythic');
    const restTotal = rest.reduce((sum, [, w]) => sum + w, 0);
    if (!restTotal) return weights.legendary ? 'legendary' : 'mythic';
    let y = (x - pLegend - pMythic) / (1 - pLegend - pMythic) * restTotal;
    for (const [k, w] of rest) { y -= w; if (y < 0) return k; }
    return rest[rest.length - 1][0];
  }
  const pick = (list, rng) => list[Math.floor(rng() * list.length)];

  // rollPack：回傳 { draw, nextPity }。draw 不可變；entries[i] = { key, entry, dup, owned }
  //   owned = 這張之前（存檔 + 同包前面幾張）已持有的張數；dup = owned > 0
  //   pity 是「連續未出傳說」的計數，單位依 policy.pity.unit（pack／draw）
  function rollPack({ count = 5, policy, pity = 0, collection = {}, rng = Math.random, id = uuid(), visualSeed = seed32() }) {
    if (!policy) throw new Error('rollPack 需要 policy');
    const candidates = policy.candidates.map((cid) => byId[cid]).filter(Boolean);
    const pool = Object.fromEntries(RARITY_ORDER.map((r) => [r, candidates.filter((e) => e.rarity === r)]));
    const pityCfg = policy.pity || {};
    let rarities = [];
    let nextPity = pity;
    if (pityCfg.unit === 'draw') {
      // 逐張處理：每張先看保底再抽，跨保底時從那張重新計數
      for (let i = 0; i < count; i++) {
        const n = nextPity + 1;   // 這是連續第 n 張
        let r;
        if (pityCfg.hard && n >= pityCfg.hard && pool.legendary.length) r = rollRarity(policy, pool, rng, { minRarity: 'legendary' });
        else {
          const bonus = pityCfg.softStart && n >= pityCfg.softStart ? (n - pityCfg.softStart + 1) * (pityCfg.softStep || 0) : 0;
          r = rollRarity(policy, pool, rng, { legendaryBonus: bonus });
        }
        rarities.push(r);
        nextPity = rank(r) <= rank('legendary') ? 0 : n;
      }
    } else {
      rarities = Array.from({ length: count }, () => rollRarity(policy, pool, rng));
      // 保底一：每包至少一張 packMinRarity 以上
      if (policy.packMinRarity && !rarities.some((r) => rank(r) <= rank(policy.packMinRarity))) {
        rarities[Math.floor(rng() * count)] = rollRarity(policy, pool, rng, { minRarity: policy.packMinRarity });
      }
      // 保底二：連續 hard 包沒傳說就塞一張
      const n = pity + 1;
      if (pityCfg.hard && !rarities.some(r => rank(r) <= rank('legendary')) && n >= pityCfg.hard && pool.legendary.length) {
        rarities[Math.floor(rng() * count)] = rollRarity(policy, pool, rng, { minRarity: 'legendary' });
      }
      nextPity = rarities.some(r => rank(r) <= rank('legendary')) ? 0 : n;
    }
    const owned = {};
    for (const [k, v] of Object.entries(collection)) if (v > 0) owned[k] = v;
    const entries = rarities.map((r, i) => {
      const entry = pick(pool[r], rng);
      const had = owned[entry.id] || 0;
      owned[entry.id] = had + 1;
      return Object.freeze({ key: `${id}:${i}`, entry: Object.freeze({ ...entry }), dup: had > 0, owned: had });
    });
    const draw = Object.freeze({ id, entries: Object.freeze(entries), visualSeed });
    return { draw, nextPity };
  }

  const api = { rank, RARITY, RARITY_ORDER, CATALOG, byId, CHARACTER_IDS, DEMO_POLICY, GAME_POLICY, rollPack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GachaPool = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
