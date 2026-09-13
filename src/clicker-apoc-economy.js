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
    // 第四輪使用者：「難度可能偏難」→ 第五輪把王血壓到一般站 ×.04（60 秒內打得完），結果變成「王太簡單、路上太難」。
    // 第六輪使用者：「關卡難度也同步，不然會造成王太簡單、路上太難」→ 選「王變門檻（打不過就去抽卡／練）」
    //   ＋「對照之前的參考遊戲，用等比的方式把時長降低」＋「約 1 小時」。
    // 參考 Sakura Clicker（Clicker Heroes 換皮，docs/clicker/REFERENCE-2026-09-12-sakura-clicker.md）：
    //   血量是關卡函數；王＝該區怪 ×2～6 逐隻遞增；限時打不完就回去刷怪變強；金幣成長率略高於血量（1.59 對 1.55），
    //   牆來自「花錢買傷害越後面越沒效率」。它的一般玩家（每秒 3 下）到第 10／20／30／40／50 區是 2.5／12／34／108／326 分，
    //   我們的 5 個王站（第 4／8／12／16／20 站）對準它的 1/6：0.4／1.9／5.7／18／54 分。
    // 為什麼不能再用第五輪的做法：2.0 的戰力靠收藏，抽滿就停在兩三千；王要比路上硬又是 60 秒，路上一站只剩幾十秒，整條變成幾分鐘。
    //   要保住長度又讓王是門檻，戰力就得能靠錢一直長（訓練改乘算，見 TRAIN），輸了要有地方賺錢（刷前一站，見 fight）。
    // 數字是 tools/sim/apoc.js 掃出來的，結果見 docs/clicker/HANDOFF-2026-09-13-v3.md 〇之十。
    BASE_NEED: 5000, GROWTH: 2.1, BOSS_MULS: [2, 3, 4, 5, 6],
    // 過關獎勵＝血量 ×0.08 ×1.066^站：Sakura 金／血成長比 1.59／1.55≈1.026／區，我們一站約等於它 2.5 區 → 1.026^2.5≈1.066
    REWARD_SHARE: .08, REWARD_GROWTH: 1.066,
    IDLE_COINS: .01,         // 放置產出＝每秒戰力 ×0.01
    // 抽卡價隨「已經付費抽過幾次」往上走（同 1.0 的招募費用），不然放置金幣是跟戰力一起指數長的，
    // 戰力→金幣→抽卡→戰力 會直接跑掉：模擬器量到一輪 20 站可以抽到一千七百次。
    DRAW_COST: 1000, DRAW_GROWTH: 1.02, STATIONS: 20,
    // 第九輪使用者：「可以利用增加每一站需要打的小站數量拉長遊戲時長，注意難度平衡」——一般站要連打 WAVES 隻（每隻給一次獎勵、滿血換下一隻，
    // 最後一隻才推進度）；王站還是一隻。
    // 模擬（tools/sim/apoc.js，一隻給這一站獎勵的 1/WAVES；王關整條輸 3～4 次都沒變）——一般玩家全線：1 隻 54 分／3 隻 106／5 隻 164／8 隻 239；
    //   5 隻時慢的 329、很懶 435（第 8 天）、勤快 37。使用者選 5 隻。
    WAVES: 5,
    // 1.0 金幣換券（時薪券）：一張＝1.0 每秒收益 × SECONDS，當天第 k 張再 ×GROWTH^k
    EXCHANGE: { SECONDS: 600, GROWTH: 1.25 },
    // 訓練（花末世金幣）：全隊訓練 Lv L 全隊戰力 ×(1+MUL)^L；點擊力 Lv L 每下 ×(1+MUL)^L。第 L 級 COST×GROWTH^L
    // 第六輪改乘算：戰力 ∝ 花掉的錢^(ln1.1／ln1.3≈0.36)，越後面越沒效率——這就是 Sakura 的牆（收藏會抽滿，只有訓練能一直長）。
    //   第三輪是線性 +3%／+5%、費用 ×2：戰力停在兩三千，王一變成門檻就永遠過不去。
    TRAIN: { team: { MUL: .1, COST: 500, GROWTH: 1.3 }, click: { MUL: .1, COST: 300, GROWTH: 1.3 } },
    TRAIN_MAX: 1000,   // 等級上限：1.1^1000、1.3^1000 都還是有限數；存檔改成一萬級會變 Infinity（Codex 第六輪）
    // 第三輪一度把王關時限關掉（當時王血是一般站 ×2.5，60 秒一定是硬牆）；第五輪王血壓到 ×.04 之後加回。
    // 第四輪使用者：「第一次遭遇應該直接進入關卡，失敗之後才會在右上方有進入選項」＋「統一 60」→ 王關一律 60 秒，輸了冷卻 60 秒後手動「再次挑戰」。
    BOSS_TIME: 60000, BOSS_COOLDOWN: 60000,
    // 刷怪兩場之間至少隔 1 秒（Codex 第六輪必修：一擊必殺時連點可以 750ms 刷 6 場；模擬器也是一秒一場）
    FARM_RESPAWN: 1000,
    // ⚠ 第五輪試過「輸了保留部分傷害」（照 1.0 的裂痕），使用者：「我不想要保留血量的機制，直接調整血量就好」→ 拿掉。
    //   輸了從滿血重來；第六輪起輸了自動回前一站刷怪（fight(a, now, true)），變強了玩家自己按「再次挑戰」。
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
  const DRAW_COUNTS = [1, 5, 10];   // 典藏包抽卡選單的三顆鍵（第七輪）
  const freshShield = cycle => ({ taps: 0, need: Math.round(RULES.SHIELD.TAPS * RULES.SHIELD.GROWTH ** cycle), cycle });
  // 王關傷害倍率：破防中 ×2、護盾在場的放置 ×0.35（點擊不受罰，點擊才是破盾的手段）
  const bossMul = (st, now, byTap) => !st?.boss ? 1 : now < (st.breakUntil || 0) ? RULES.SHIELD.BREAK_MUL : byTap ? 1 : RULES.SHIELD.IDLE_MUL;
  // 技能名沿用 1.0（使用者第四輪：「2.0 技能雖然重新設計，但技能名稱不要改，1.0 有的名稱就直接沿用」）：
  // 同名角色用 1.0 的技能名（ClickerBalance.characters[id].skill），效果仍照稀有度；1.0 沒有這張卡才用稀有度的名字。
  // 瀏覽器裡 clicker-balance.js／gacha-pool.js 比這支先載入；node 測試沒有它們就一律用稀有度的名字。
  let oneSkills = null;
  const oneSkillName = c => {
    if (!oneSkills) {
      const B = root.ClickerBalance, P = root.GachaPool; if (!B || !P || !P.byId) return null;
      oneSkills = {};
      for (const [id, ch] of Object.entries(B.characters)) { const n = P.byId[id]?.name; if (n && ch.skill && !(n in oneSkills)) oneSkills[n] = ch.skill; }
    }
    return oneSkills[c.name] || null;
  };
  const skillOf = (a, slot) => { const id = a.skills?.[slot]; const c = id ? poolById()[id] : null; if (!c) return null; const base = RULES.SKILLS[c.rarity]; return { slot, id, card: c, ...base, name: oneSkillName(c) || base.name }; };
  // 1.0 的印記／祝福加成（使用者第四輪：「1.0 的印記加成直接套進 2.0」）。畫面層每次從 1.0 存檔現算後掛在 a.boost，不寫進存檔。
  const NO_BOOST = { power: 1, click: 1, skill: 1, cd: 1 };
  const boostOf = a => a.boost || NO_BOOST;
  const powerMul = (a, now) => (a.fx && now < (a.fx.powerUntil || 0)) ? (a.fx.powerMul || 1) : 1;
  // ⚠ 這個表每次點擊都會被查好幾十次（power() → cardPower() → poolById()），
  //   原本每次都重建一個 71 筆的物件；快取起來，卡池換了才重算。
  let poolCache = null, poolCacheSrc = null;
  const poolById = () => { const src = root.ApocPool || []; if (src !== poolCacheSrc) { poolCacheSrc = src; poolCache = Object.fromEntries(src.map(c => [c.id, c])); } return poolCache; };
  const count = v => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;   // 存檔可編輯：'1e309' 會變 Infinity，價格跟著變 Infinity
  const dayKey = now => Math.floor(now / 86400000);   // 同 1.0 派遣的日界
  function fresh() {
    return { unlocked: false, tutorial: 0, coins: 0, tickets: 0, progress: 0, cooldownUntil: 0, collection: {}, roster: [], skills: [null, null, null, null], stage: null, gifted: false, wins: 0,
      paidDraws: 0, teamLevel: 0, clickLevel: 0, onePeak: 0, bossFailed: null, farmNextAt: 0, exchange: { day: null, count: 0, total: 0 }, stats: { taps: 0, maxHit: 0, shieldBreaks: 0, draws: 0 }, cosmetics: { owned: ['rust'], hitFx: 'rust' },
      pending: null, cleared: false, skillCd: [0, 0, 0, 0], fx: { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1, mythic: false } };
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
    // 刷怪中的戰鬥是前一站：只有「這一站是王、而且輸過」才合法（第六輪）；其他進度不符的戰鬥丟掉
    const farmOk = st => st.index === a.progress - 1 && isBoss(a.progress) && raw.bossFailed === a.progress;
    if (a.stage && (typeof a.stage.hp !== 'number' || (a.stage.farm ? !farmOk(a.stage) : a.stage.index !== a.progress))) a.stage = null;
    if (a.stage?.farm) a.stage = { ...a.stage, farm: true, boss: false, deadline: null, shield: null, breakUntil: 0 };
    if (a.stage && a.stage.boss && !a.stage.shield) { a.stage = { ...a.stage, shield: freshShield(0), breakUntil: 0 }; }   // 舊存檔的王關補上護盾
    // 一站幾隻（第九輪）：王站與刷怪固定 1 隻；一般站照現在的 WAVES，目前第幾隻夾在 1～waves
    if (a.stage) { const waves = a.stage.boss || a.stage.farm ? 1 : RULES.WAVES;
      a.stage = { ...a.stage, waves, wave: Math.max(1, Math.min(waves, count(a.stage.wave) || 1)) }; }
    // 舊存檔的戰鬥還是舊血量（第五輪改了 BASE_NEED／GROWTH／BOSS_MUL，Codex 第五輪必修 2）：照剩下的血佔幾成換算成新版血量。
    // 換算後 need 就等於新版，所以只會換一次；王關的 60 秒期限在第一次結算時才給（settle 裡），這裡不碰期限，避免每次載入就續時。
    if (a.stage && a.stage.need !== need(a.stage.index)) {
      const n = need(a.stage.index), ratio = a.stage.need > 0 ? Math.max(0, Math.min(1, a.stage.hp / a.stage.need)) : 1;
      a.stage = { ...a.stage, need: n, hp: n * ratio };
    }
    // 舊檔的「買過幾張券」就是當時的抽卡價格進度，搬成付費抽數，價格不會倒退
    a.paidDraws = count(raw.paidDraws !== undefined ? raw.paidDraws : raw.ticketsBought); delete a.ticketsBought;
    a.teamLevel = Math.min(RULES.TRAIN_MAX, count(a.teamLevel)); a.clickLevel = Math.min(RULES.TRAIN_MAX, count(a.clickLevel));
    a.farmNextAt = Number.isFinite(Number(a.farmNextAt)) && Number(a.farmNextAt) > 0 ? Number(a.farmNextAt) : 0;
    delete a.boost;   // 1.0 加成是執行期現算的，存檔裡的舊值一律不信
    a.bossFailed = Number.isInteger(a.bossFailed) && a.bossFailed === a.progress ? a.bossFailed : null;   // 只記「目前這一站的王輸過」
    delete a.bossCarry;   // 保留血量的機制拿掉了（第五輪使用者），上一版存檔留下的欄位丟掉
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
        && DRAW_COUNTS.includes(d.entries.length)   // 第七輪抽卡選單有五連（Codex 第七輪必修：只收 1／10 會把已扣款的五連結果清掉）
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
    a.fx = { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1, mythic: false, ...(a.fx || {}) };
    a.fx.mythic = !!a.fx.mythic && a.fx.clickLeft > 0;
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
  const trainMul = (kind, level) => (1 + RULES.TRAIN[kind].MUL) ** (level || 0);   // 第六輪起乘算（見 RULES.TRAIN）
  const trainCost = (a, kind, n = 1) => { const t = RULES.TRAIN[kind], L = a[LEVEL_KEY[kind]] || 0; let sum = 0; for (let i = 0; i < n; i++) sum += Math.round(t.COST * t.GROWTH ** (L + i)); return sum; };
  // max＝有多少錢就升多少級（同 1.0 的「最多」）；一級都買不起就丟錯
  function train(a, kind, max = false) {
    const t = RULES.TRAIN[kind]; if (!t) throw new Error('沒有這種訓練');
    let L = a[LEVEL_KEY[kind]] || 0, coins = a.coins, levels = 0;
    for (;;) { if (L >= RULES.TRAIN_MAX) break; const c = Math.round(t.COST * t.GROWTH ** L); if (coins < c) break; coins -= c; L++; levels++; if (!max || levels >= 1000) break; }
    if (!levels) throw new Error(L >= RULES.TRAIN_MAX ? '已經練到頂了' : `末世金幣不足，下一級要 ${Math.round(t.COST * t.GROWTH ** L)}`);
    return { state: { ...a, coins, [LEVEL_KEY[kind]]: L }, levels };
  }
  function cardPower(a, id) { const c = poolById()[id]; if (!c || !a.collection[id]) return 0; return RULES.POWER[c.rarity] * (1 + RULES.STAR_MUL * (a.collection[id] - 1)); }
  const power = a => a.roster.reduce((sum, id) => sum + cardPower(a, id), 0) * trainMul('team', a.teamLevel) * boostOf(a).power;
  // 血量：一般站 BASE×GROWTH^i；王站再 ×BOSS_MULS[第幾隻王]（Sakura 的王＝該區怪 ×2～6，逐隻遞增）
  const bossMulOf = i => RULES.BOSS_MULS[Math.floor(i / 4)] ?? RULES.BOSS_MULS[RULES.BOSS_MULS.length - 1];
  const need = i => Math.round(RULES.BASE_NEED * RULES.GROWTH ** i * (isBoss(i) ? bossMulOf(i) : 1));
  const reward = i => Math.round(need(i) * RULES.REWARD_SHARE * RULES.REWARD_GROWTH ** i);
  // 一般站一隻（含刷怪）的獎勵＝這一站的獎勵 ÷ WAVES：一站打完拿到的錢跟以前一樣，只是多花時間。
  // ⚠ 第九輪先試過每隻都給整份——錢變成 WAVES 倍、訓練長得太快，打越多隻全線反而越短（一般玩家 54 分 → 8 隻時 38 分）
  const killReward = i => isBoss(i) ? reward(i) : Math.round(reward(i) / Math.max(1, RULES.WAVES));
  // 刷怪中的戰鬥可以直接被「再次挑戰」換掉
  const canFight = (a, now) => (!a.stage || !!a.stage.farm) && a.progress < RULES.STATIONS && !(isBoss(a.progress) && a.cooldownUntil > now);
  // 刷怪（第六輪，照 Sakura 的「打不過就回去刷怪」）：這一站的王輸過之後，回前一站一直打——拿那一站的獎勵、不推進度
  const canFarm = (a, now) => !a.stage && isBoss(a.progress) && a.bossFailed === a.progress && a.progress > 0 && now >= (a.farmNextAt || 0);
  function fight(a, now, farm = false) {
    if (farm) {
      if (!canFarm(a, now)) throw new Error('現在不能刷怪');
      if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
      const i = a.progress - 1;
      return { ...a, stage: { index: i, hp: need(i), need: need(i), boss: false, farm: true, startedAt: now, deadline: null, shield: null, breakUntil: 0 } };
    }
    if (!canFight(a, now)) throw new Error(a.progress >= RULES.STATIONS ? '全線已通行' : a.stage ? '戰鬥中' : '王關冷卻中');
    if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
    const i = a.progress, boss = isBoss(i);
    return { ...a, stage: { index: i, hp: need(i), need: need(i), boss, wave: 1, waves: boss ? 1 : RULES.WAVES, startedAt: now, deadline: boss && RULES.BOSS_TIME ? now + RULES.BOSS_TIME : null, shield: boss ? freshShield(0) : null, breakUntil: 0 } };
  }
  // 結算：回傳 { state, events:[{type:'win'|'fail', index}] }
  function settle(a, now, dt) {
    const events = []; let s = { ...a };
    if (s.fx && s.fx.powerUntil && now >= s.fx.powerUntil) s.fx = { ...s.fx, powerUntil: 0, powerMul: 1 };
    const p = power(s) * powerMul(s, now);
    if (dt > 0) s.coins += p * RULES.IDLE_COINS * dt;
    if (s.stage) {
      let st = { ...s.stage };
      // 舊存檔的王關沒有期限：第一次結算時給一個完整的 60 秒。只在 deadline 是空的時候給，給過就存下來，不會無限續時
      if (st.boss && RULES.BOSS_TIME && !st.deadline) st.deadline = now + RULES.BOSS_TIME;
      // 放置傷害只算到期限為止（Codex 第五輪必修 3：逾時之後才進來的這一段不能拿來打贏）。期限前合法的致死照樣算贏。
      // 這一段依「破防結束、技能到期、王關期限」切開，各段用當時的倍率（Codex 5b 必修 2：期限前的破防 ×2 被整段算成護盾倍率）
      const t0 = now - dt * 1000, tEnd = st.deadline ? Math.min(now, st.deadline) : now;
      if (tEnd > t0) {
        const cuts = [t0, ...[st.breakUntil, a.fx?.powerUntil].filter(t => t > t0 && t < tEnd), tEnd].sort((x, y) => x - y);
        for (let k = 1; k < cuts.length; k++) {
          const mid = (cuts[k - 1] + cuts[k]) / 2;
          st.hp -= power(a) * powerMul(a, mid) * bossMul(st, mid, false) * (cuts[k] - cuts[k - 1]) / 1000;
        }
      }
      // 破防時間到 → 重新起盾，下一輪要的點擊數 ×GROWTH（傷害算完才換，破防那段才吃得到 ×2）
      if (st.boss && st.breakUntil && now >= st.breakUntil) st = { ...st, breakUntil: 0, shield: freshShield((st.shield?.cycle || 0) + 1) };
      if (st.hp <= 0 && st.farm) {
        // 刷怪：拿這一站的獎勵、不推進度（王那一站還等著玩家再挑戰）
        s.coins += killReward(st.index); s.stage = null; s.farmNextAt = now + RULES.FARM_RESPAWN;
        events.push({ type: 'farm', index: st.index, reward: killReward(st.index) });
      }
      else if (st.hp <= 0 && (st.wave || 1) < (st.waves || 1)) {
        // 同一站的下一隻（第九輪）：給這一隻的獎勵、滿血換下一隻，進度不動
        s.coins += killReward(st.index);
        s.stage = { ...st, wave: (st.wave || 1) + 1, hp: need(st.index), startedAt: now };
        events.push({ type: 'wave', index: st.index, wave: st.wave || 1, waves: st.waves, reward: killReward(st.index) });
      }
      else if (st.hp <= 0) {
        s.coins += killReward(st.index); s.progress = st.index + 1; s.wins = (s.wins || 0) + 1; s.stage = null;
        events.push({ type: 'win', index: st.index, reward: killReward(st.index) });
        // 全線通行只報一次；之後留在末世繼續放置與補收藏
        if (s.progress >= RULES.STATIONS && !s.cleared) { s.cleared = true; events.push({ type: 'cleared' }); }
      }
      // 輸過就記下這一站：之後不自動開打，等玩家按右上角的「再次挑戰」（使用者第四輪：第一次遭遇直接進，失敗之後才有進入選項）
      else if (st.deadline && now >= st.deadline) { s.stage = null; s.cooldownUntil = now + RULES.BOSS_COOLDOWN; s.bossFailed = st.index; events.push({ type: 'fail', index: st.index }); }
      else s.stage = st;
    }
    return { state: s, events };
  }
  // 這一下點擊的傷害（畫面浮字要跟實際扣血一致，打死那一下也要顯示整下的量，不是剩下的血）
  const tapDamage = (a, now) => !a.stage || (a.stage.deadline && now >= a.stage.deadline) ? 0 : power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel) * boostOf(a).click
    * (a.fx?.clickLeft > 0 ? (a.fx.clickMul || 1) : 1) * bossMul(a.stage, now, true);
  function tap(a, now) {
    if (!a.stage) return a;
    if (a.stage.deadline && now >= a.stage.deadline) return a;   // 期限過了的點擊不算（結算時會判輸）
    const dmg = tapDamage(a, now);
    // 次數型增益（尾巴節拍／一口氣開封）在這裡消耗一格
    let fx = { ...a.fx };
    if (fx.clickLeft > 0) { fx.clickLeft -= 1; if (!fx.clickLeft) { fx.clickMul = 1; fx.mythic = false; } }
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
    const k = boostOf(a);   // 1.0 的技能祝福放大效果量、冷卻祝福縮短冷卻（同 1.0 的 skillArt／cdArt）
    // mythic：神話卡的點擊加倍還在（第八輪：施放期間放神話技能曲，clicker-music.js 讀這個；傳說卡也是 clickMul，不算）
    if (def.kind === 'clickMul') { fx.clickMul = def.value * k.skill; fx.clickLeft = def.uses; fx.mythic = def.card.rarity === 'mythic'; }
    else if (def.kind === 'powerMul') { fx.powerMul = 1 + (def.value - 1) * k.skill; fx.powerUntil = now + def.ms; }
    else if (def.kind === 'cool') cd = cd.map((t, i) => i === slot ? t : Math.max(now, t - def.value * k.skill));
    cd[slot] = now + def.cd * k.cd;
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
    if (!DRAW_COUNTS.includes(n)) throw new Error('只能單抽、五連或十連');
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
    teamMul: trainMul('team', a.teamLevel), clickMul: trainMul('click', a.clickLevel), tapDamage: power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel) * boostOf(a).click, boost: boostOf(a),
    exchangeToday: exchangeToday(a, now), exchangeTotal: a.exchange?.total || 0, stats: a.stats, wins: a.wins || 0, cosmetics: a.cosmetics,
    roster: a.roster, skills: a.skills, owned: Object.keys(a.collection).filter(id => a.collection[id] > 0), collection: a.collection, stations: RULES.STATIONS });
  root.ApocEconomy = { RULES, fresh, normalize, gift, power, cardPower, need, reward, isBoss, canFight, canFarm, fight, settle, tap, tapDamage, drawn, addCards, setTeam, rosterCounts, rosterViolations, view,
    drawCost, exchangeCost, exchangeToday, exchange, train, trainCost, trainMul, buyCosmetic, wearCosmetic, rollPack, purchaseDraw, collectDraw, skillOf, canSkill, useSkill, powerMul };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ApocEconomy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
