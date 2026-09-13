// v3 末世（2.0）經濟：純邏輯、無 DOM（2026-09-13 第一版，使用者：「繼續完成關卡串接」）。
// 照 DESIGN-team-and-map.md §7-3／7-4 與 DESIGN-2026-09-12-content-architecture.md §三：
//   一般關＝放置／點擊，打不死就過不去；王關 60 秒時限、失敗冷卻 3 分鐘；沒有其他懲罰。
//   只有隊伍（roster）產戰力；四階落差小 100/85/72/60；重複卡直接升星（每星 +25%）。
//   抽率 0.25/4/20/75.75（在招募頁）。
// 卡表由 tools/apoc/build_apoc.py 從 holo-5.0 的 pool_data 產成 src/apoc/pool.js（window.ApocPool）。
//
// 錢（2026-09-13 第三輪，使用者定案）：
//   末世金幣只在 2.0 用：直接抽卡（「我幹嘛拿錢換卷再抽卡，為什麼不直接花錢抽卡」）、點擊力、全隊訓練。
//   末世券只從 1.0 的金幣換來，比值故意很差（「讓玩家覺得 1.0 練的卡還有一點用處」）：
//   時薪券＝一張值 1.0 當下 10 分鐘的收益，當天每多換一張 ×1.25，隔天重置。抽卡時先用券、不夠才付金幣。
(function (root) {
  const RULES = {
    POWER: { mythic: 100, legendary: 85, epic: 72, rare: 60, common: 50 },
    STAR_MUL: .25,           // 每多一張同卡 +25%
    CLICK_SHARE: .5,         // 一下＝每秒戰力的一半
    // 2026-09-13 之後這一輪定案：用 tools/sim/apoc.js 掃出來的（目標＝一天三段 20 分鐘、20 站 3～5 天）。
    // ⚠ 末世沒有離線收益，所以「幾天」＝「玩了幾段」，不是掛機天數。
    BASE_NEED: 600000, GROWTH: 1.20, BOSS_MUL: 2.5,
    REWARD_SHARE: .02,       // 通關獎勵＝血量 ×0.02 末世金幣
    IDLE_COINS: .01,         // 放置產出＝每秒戰力 ×0.01
    // 抽卡價隨「已經付費抽過幾次」往上走（同 1.0 的招募費用），不然放置金幣是跟戰力一起指數長的，
    // 戰力→金幣→抽卡→戰力 會直接跑掉：模擬器量到一輪 20 站可以抽到一千七百次。
    DRAW_COST: 1000, DRAW_GROWTH: 1.02, STATIONS: 20,
    // 1.0 金幣換券（時薪券）：一張＝1.0 每秒收益 × SECONDS，當天第 k 張再 ×GROWTH^k
    EXCHANGE: { SECONDS: 600, GROWTH: 1.25 },
    // 訓練（花末世金幣）：全隊訓練 Lv L 全隊戰力 ×(1+MUL·L)；點擊力 Lv L 每下 ×(1+MUL·L)。第 L 級 COST×GROWTH^L
    // tools/sim/apoc.js 掃出來的（第三輪）：不訓練 218 分鐘；這組 201 分鐘・第 4 天・抽 200 次，跟改版前 202 分鐘同節奏，
    // 一輪大約練到全隊 Lv2、點擊 Lv3——訓練是「卡關時補一把」，不是主線（主線還是抽卡）。
    TRAIN: { team: { MUL: .03, COST: 40000, GROWTH: 2 }, click: { MUL: .05, COST: 20000, GROWTH: 2 } },
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
    // 末世商店的外觀（同 1.0 商店賣點擊特效）：受擊時碎片／火花的配色，花末世金幣、買了永久保留、沒有數值
    HIT_FX: [
      { id: 'rust',  name: '鏽鐵火花', price: 0,     spark: '#F2B233', shards: ['#8A6A48', '#9E4A34'], shield: '#BFD4E6' },
      { id: 'frost', name: '冰霜碎片', price: 30000, spark: '#CFF4FF', shards: ['#7FB8D6', '#DDEFF7'], shield: '#FFFFFF' },
      { id: 'neon',  name: '霓虹殘響', price: 30000, spark: '#FF4FD8', shards: ['#5AD7FF', '#B48BFF'], shield: '#7DFF9C' },
      { id: 'ash',   name: '焦土餘燼', price: 30000, spark: '#FF7A3D', shards: ['#3B2A1C', '#6B5646'], shield: '#FFB08A' },
    ],
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
  const count = v => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;   // 存檔可編輯：'1e309' 會變 Infinity，價格跟著變 Infinity
  const dayKey = now => Math.floor(now / 86400000);   // 同 1.0 派遣的日界
  function fresh() {
    return { unlocked: false, tutorial: 0, coins: 0, tickets: 0, progress: 0, cooldownUntil: 0, collection: {}, roster: [], skills: [null, null, null, null], stage: null, gifted: false, wins: 0,
      paidDraws: 0, teamLevel: 0, clickLevel: 0, onePeak: 0, exchange: { day: null, count: 0, total: 0 }, stats: { taps: 0, maxHit: 0, shieldBreaks: 0, draws: 0 }, cosmetics: { owned: ['rust'], hitFx: 'rust' },
      pending: null, cleared: false, skillCd: [0, 0, 0, 0], fx: { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1 } };
  }
  function normalize(a) {
    const f = fresh(), raw = a || {}; a = { ...f, ...raw };
    if (!a.collection || typeof a.collection !== 'object') a.collection = {};
    if (!Array.isArray(a.roster)) a.roster = [];
    if (!Array.isArray(a.skills)) a.skills = []; a.skills = [0, 1, 2, 3].map(i => a.skills[i] || null);
    a.roster = a.roster.filter(id => a.collection[id] > 0);
    { const seen = new Set();
      a.skills = a.skills.map(id => {
        if (!id || !a.roster.includes(id) || seen.has(id)) return null;   // 舊檔可能有同卡多槽（Codex 第三輪 B1）
        seen.add(id); return id;
      }); }
    if (a.stage && (typeof a.stage.hp !== 'number' || a.stage.index !== a.progress)) a.stage = null;
    if (a.stage && a.stage.boss && !a.stage.shield) { a.stage = { ...a.stage, shield: freshShield(0), breakUntil: 0 }; }   // 舊存檔的王關補上護盾
    // 舊檔的「買過幾張券」就是當時的抽卡價格進度，搬成付費抽數，價格不會倒退
    a.paidDraws = count(raw.paidDraws !== undefined ? raw.paidDraws : raw.ticketsBought); delete a.ticketsBought;
    a.teamLevel = count(a.teamLevel); a.clickLevel = count(a.clickLevel);
    a.onePeak = Number.isFinite(Number(a.onePeak)) && Number(a.onePeak) > 0 ? Number(a.onePeak) : 0;   // 桌邊歷史最高每秒收益（換券定價基準，換桌布不歸零）
    { const x = a.exchange && typeof a.exchange === 'object' ? a.exchange : {};
      a.exchange = { day: Number.isFinite(x.day) ? x.day : null, count: count(x.count), total: count(x.total) }; }
    { const x = a.stats && typeof a.stats === 'object' ? a.stats : {};
      a.stats = { taps: count(x.taps), maxHit: Number.isFinite(x.maxHit) && x.maxHit > 0 ? x.maxHit : 0, shieldBreaks: count(x.shieldBreaks), draws: count(x.draws) }; }
    { const x = a.cosmetics && typeof a.cosmetics === 'object' ? a.cosmetics : {}, ids = RULES.HIT_FX.map(f => f.id);
      const owned = [...new Set(['rust', ...(Array.isArray(x.owned) ? x.owned : [])])].filter(id => ids.includes(id));
      a.cosmetics = { owned, hitFx: owned.includes(x.hitFx) ? x.hitFx : 'rust' }; }
    a.cleared = !!a.cleared || a.progress >= RULES.STATIONS;   // cleared＝已通關；舊檔已經走完 20 站就直接補上，不要事後補播結局
    // pending 是玩家可以編輯的存檔內容，這裡要擋住兩種實測過的壞資料（Codex 複檢 2-2）：
    //   entries:[null] → 收下時炸掉；卡片 id 不在卡池 → drawn() 過濾掉但券沒扣回來，憑空生券。
    //   驗不過就整個丟掉（錢在扣款時已經花掉，這跟 1.0 的 pending 語意一致）。
    {
      const d = a.pending && a.pending.draw, pool = poolById();
      const ok = d && typeof d.id === 'string' && Array.isArray(d.entries)
        && (d.entries.length === 1 || d.entries.length === 10)
        && d.entries.every(e => e && e.entry && typeof e.entry.id === 'string' && pool[e.entry.id]);
      if (!ok) a.pending = null;
      else {
        // 每一筆都從卡池重建 canonical entry：存檔裡只留 id 是合法的，但卡面要 rarity／name，
        // 缺了會在 gacha-card 直接拋錯；key 重複則會被 runtime 的 Map 合成同一張（十連只出一張）。
        // 這兩種資料實測都通得過舊版驗證（Codex 第二輪 A5）。
        a.pending = { draw: { ...d, entries: d.entries.map((e, i) => ({
          key: `${d.id}:${i}`, entry: { ...pool[e.entry.id] },
          dup: !!e.dup, owned: Math.max(0, Math.floor(Number(e.owned) || 0)),
        })) } };
      }
    }
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
  // ---- 訓練
  const LEVEL_KEY = { team: 'teamLevel', click: 'clickLevel' };
  const trainMul = (kind, level) => 1 + RULES.TRAIN[kind].MUL * (level || 0);
  const trainCost = (a, kind, n = 1) => { const t = RULES.TRAIN[kind], L = a[LEVEL_KEY[kind]] || 0; let sum = 0; for (let i = 0; i < n; i++) sum += Math.round(t.COST * t.GROWTH ** (L + i)); return sum; };
  // max＝有多少錢就升多少級（同 1.0 的「最多」）；一級都買不起就丟錯
  function train(a, kind, max = false) {
    const t = RULES.TRAIN[kind]; if (!t) throw new Error('沒有這種訓練');
    let L = a[LEVEL_KEY[kind]] || 0, coins = a.coins, levels = 0;
    for (;;) { const c = Math.round(t.COST * t.GROWTH ** L); if (coins < c) break; coins -= c; L++; levels++; if (!max || levels >= 1000) break; }
    if (!levels) throw new Error(`末世金幣不足，下一級要 ${Math.round(t.COST * t.GROWTH ** L)}`);
    return { state: { ...a, coins, [LEVEL_KEY[kind]]: L }, levels };
  }
  function cardPower(a, id) { const c = poolById()[id]; if (!c || !a.collection[id]) return 0; return RULES.POWER[c.rarity] * (1 + RULES.STAR_MUL * (a.collection[id] - 1)); }
  const power = a => a.roster.reduce((sum, id) => sum + cardPower(a, id), 0) * trainMul('team', a.teamLevel);
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
  // 這一下點擊的傷害（畫面浮字要跟實際扣血一致，打死那一下也要顯示整下的量，不是剩下的血）
  const tapDamage = (a, now) => !a.stage ? 0 : power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel)
    * (a.fx?.clickLeft > 0 ? (a.fx.clickMul || 1) : 1) * bossMul(a.stage, now, true);
  function tap(a, now) {
    if (!a.stage) return a;
    const dmg = tapDamage(a, now);
    // 次數型增益（尾巴節拍／一口氣開封）在這裡消耗一格
    let fx = { ...a.fx };
    if (fx.clickLeft > 0) { fx.clickLeft -= 1; if (!fx.clickLeft) fx.clickMul = 1; }
    let st = { ...a.stage }, broke = false;
    if (st.boss && !(now < (st.breakUntil || 0))) {
      // 護盾在場：這一下算進破盾進度；點滿就破防
      const sh = { ...(st.shield || freshShield(0)) }; sh.taps += 1;
      st.shield = sh; if (sh.taps >= sh.need) { st.breakUntil = now + RULES.SHIELD.BREAK_MS; broke = true; }
    }
    st.hp -= dmg;
    const stats = { ...a.stats, taps: (a.stats?.taps || 0) + 1, maxHit: Math.max(a.stats?.maxHit || 0, dmg), shieldBreaks: (a.stats?.shieldBreaks || 0) + (broke ? 1 : 0) };
    return { ...a, stage: st, fx, stats };
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
  // ---- 抽卡價：n 抽裡先用券，剩下的才付末世金幣
  const drawCost = (a, n = 1) => { const paid = Math.max(0, n - (a.tickets || 0)); let sum = 0; for (let i = 0; i < paid; i++) sum += Math.round(RULES.DRAW_COST * RULES.DRAW_GROWTH ** ((a.paidDraws || 0) + i)); return sum; };
  // ---- 1.0 金幣換券（時薪券）。oneP＝1.0 當下每秒收益；錢從 1.0 扣，由呼叫端寫回 1.0 的 state
  // ⚠ 日期往回調不能重置當天加價（Codex 第三輪：同一天換兩張→日期前進→調回原日，價格回到 1 倍）。
  //   只有日期「往前」才算新的一天；往回一律沿用最後紀錄的那天與張數。
  const exchangeToday = (a, now) => a.exchange && a.exchange.day !== null && dayKey(now) <= a.exchange.day ? a.exchange.count : 0;
  const exchangeCost = (a, oneP, now) => oneP > 0 && Number.isFinite(oneP) ? Math.ceil(oneP * RULES.EXCHANGE.SECONDS * RULES.EXCHANGE.GROWTH ** exchangeToday(a, now)) : Infinity;
  function exchange(a, oneCoins, oneP, now) {
    const cost = exchangeCost(a, oneP, now);
    if (!Number.isFinite(cost)) throw new Error('桌邊還沒有每秒收益，換不了券');
    if (!(oneCoins >= cost)) throw new Error('桌邊金幣不足');
    const today = exchangeToday(a, now);
    return { state: { ...a, tickets: a.tickets + 1, exchange: { day: Math.max(dayKey(now), a.exchange?.day ?? -Infinity), count: today + 1, total: (a.exchange?.total || 0) + 1 } }, cost };
  }
  // ---- 末世商店的外觀（受擊特效配色）：買了永久保留，換上不花錢
  function buyCosmetic(a, id) {
    const item = RULES.HIT_FX.find(f => f.id === id); if (!item) throw new Error('沒有這個外觀');
    if (a.cosmetics?.owned?.includes(id)) throw new Error('已經擁有');
    if (a.coins < item.price) throw new Error(`末世金幣不足，要 ${item.price}`);
    return { ...a, coins: a.coins - item.price, cosmetics: { ...a.cosmetics, owned: [...(a.cosmetics?.owned || ['rust']), id] } };
  }
  function wearCosmetic(a, id) {
    if (!a.cosmetics?.owned?.includes(id)) throw new Error('還沒買這個外觀');
    return { ...a, cosmetics: { ...a.cosmetics, hitFx: id } };
  }
  // 卡片落帳（收藏＋升星＋新卡自動入隊），不碰錢
  function addCards(a, ids) {
    const pool = poolById();
    if (ids.some(id => !pool[id])) throw new Error('卡片不在末世卡池裡');   // 以前是默默過濾掉 → 券沒扣回來會憑空變多
    const collection = { ...a.collection }; for (const id of ids) collection[id] = (collection[id] || 0) + 1;
    let roster = [...a.roster];
    for (const id of ids) if (!roster.includes(id) && roster.length < 20 && !rosterViolations(roster.concat(id)).length) roster.push(id);   // 新卡自動入隊（同 1.0）
    return { ...a, collection, roster };
  }
  // 直接用券把卡落帳（測試與模擬器用；遊戲裡走 purchaseDraw → collectDraw）
  function drawn(a, ids) {
    if (ids.some(id => !poolById()[id])) throw new Error('卡片不在末世卡池裡');
    if (!ids.length) return a;
    if (a.tickets < ids.length) throw new Error('末世券不足');
    return { ...addCards(a, ids), tickets: a.tickets - ids.length };
  }
  const LIMITS = [2, 6, 12, 20], RANK = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 3 };
  const rosterCounts = ids => { const pool = poolById(); return LIMITS.map((_, i) => ids.filter(id => pool[id] && RANK[pool[id].rarity] <= i).length); };
  const rosterViolations = ids => rosterCounts(ids).flatMap((n, i) => n > LIMITS[i] ? [i] : []);
  function setTeam(a, roster, skills) {
    roster = (roster || []).filter((id, i, arr) => a.collection[id] > 0 && arr.indexOf(id) === i).slice(0, 20);
    if (rosterViolations(roster).length) throw new Error('超過階級上限');
    // 同一張卡不能同時佔兩個技能格（桌邊的 equip 有這條，末世本來沒有）。
    // ⚠ 去重要留「新指定的那一格」，不是留第一格——不然「把已經在槽 1 的 A 指定到槽 2」會變成
    //    清掉槽 2 原本的 B、A 也沒搬過去（Codex 第三輪 B1）。所以比對舊配置，搬動而不是丟掉。
    const before = (a.skills || []).slice(0, 4);
    skills = (skills || a.skills || []).slice(0, 4).map(id => (id && roster.includes(id)) ? id : null);
    while (skills.length < 4) skills.push(null);
    for (let i = 0; i < 4; i++) {
      const id = skills[i]; if (!id) continue;
      for (let j = 0; j < 4; j++) {
        if (j === i || skills[j] !== id) continue;
        // 同一張出現兩次：保留「這一次新指定的那一格」，把舊的那一格清空（＝搬過去）
        if (before[i] === id && before[j] !== id) skills[i] = null; else skills[j] = null;
      }
    }
    return { ...a, roster, skills: skills.slice(0, 4) };
  }
  // 末世的抽卡：卡池是 ApocPool，付的是券／末世金幣，但**產出的 draw 形狀跟 1.0 的 rollPack 完全一樣**，
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
  function purchaseDraw(a, n, now, rng) {
    if (a.pending) throw new Error('還有沒收下的結果');
    const cost = drawCost(a, n), free = Math.min(a.tickets || 0, n);
    if (a.coins < cost) throw new Error(`末世金幣不足（還差 ${Math.ceil(cost - a.coins)}）`);
    return { ...a, coins: a.coins - cost, tickets: a.tickets - free, paidDraws: (a.paidDraws || 0) + (n - free),
      stats: { ...a.stats, draws: (a.stats?.draws || 0) + n }, pending: { draw: rollPack(a, n, rng) } };
  }
  function collectDraw(a, drawId, now) {
    if (!a.pending || a.pending.draw.id !== drawId) return { state: a, accepted: false };
    const ids = a.pending.draw.entries.map(e => e.entry.id);
    const next = addCards({ ...a, pending: null }, ids);
    const newIds = [...new Set(ids.filter(id => !a.collection[id]))];
    // 末世的「星」就是張數，所以重複＝升星；結算提示用得到
    const starUps = [];
    for (const id of new Set(ids.filter(id => a.collection[id]))) starUps.push({ id, from: a.collection[id], to: next.collection[id] });
    return { state: next, accepted: true, newIds, starUps };
  }
  const view = (a, now) => ({ coins: Math.floor(a.coins), tickets: a.tickets, progress: a.progress, cooldownUntil: a.cooldownUntil, stage: a.stage, power: power(a) * powerMul(a, now),
    skillCd: a.skillCd, fx: a.fx, now, pending: a.pending || null, cleared: !!a.cleared,
    skillDefs: [0, 1, 2, 3].map(i => { const d = skillOf(a, i); return d ? { name: d.name, text: d.text, card: d.card.name, rarity: d.card.rarity } : null; }), canFight: canFight(a, now), need: a.progress < RULES.STATIONS ? need(a.progress) : 0,
    drawCost1: drawCost(a, 1), drawCost10: drawCost(a, 10), paidDraws: a.paidDraws || 0,
    teamLevel: a.teamLevel || 0, clickLevel: a.clickLevel || 0, teamCost: trainCost(a, 'team'), clickCost: trainCost(a, 'click'),
    teamMul: trainMul('team', a.teamLevel), clickMul: trainMul('click', a.clickLevel), tapDamage: power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel),
    exchangeToday: exchangeToday(a, now), exchangeTotal: a.exchange?.total || 0, stats: a.stats, wins: a.wins || 0, cosmetics: a.cosmetics,
    roster: a.roster, skills: a.skills, owned: Object.keys(a.collection).filter(id => a.collection[id] > 0), collection: a.collection, stations: RULES.STATIONS });
  root.ApocEconomy = { RULES, fresh, normalize, gift, power, cardPower, need, reward, isBoss, canFight, fight, settle, tap, tapDamage, drawn, addCards, setTeam, rosterCounts, rosterViolations, view,
    drawCost, exchangeCost, exchangeToday, exchange, train, trainCost, trainMul, buyCosmetic, wearCosmetic, rollPack, purchaseDraw, collectDraw, skillOf, canSkill, useSkill, powerMul };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ApocEconomy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
