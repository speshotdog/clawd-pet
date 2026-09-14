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
    // 第十輪王有機制（狗群擋傷害、殼放置打不動、節拍／部位放置只剩三成五）後，舊 [2,3,4,5,6] 一般玩家（CPS 3、在場一半）全破 228 分，
    //   最後一隻滅世珍獸四種機制輪流就吃掉 128 分 → 後三隻降成 3.5／4／3.5：四個種子 161～179 分、踩拍命中 5 成 192 分、快手 41 分。
    BASE_NEED: 5000, GROWTH: 2.1, BOSS_MULS: [2, 3, 3.5, 4, 3.5],
    // 過關獎勵＝血量 ×0.08 ×1.066^站：Sakura 金／血成長比 1.59／1.55≈1.026／區，我們一站約等於它 2.5 區 → 1.026^2.5≈1.066
    REWARD_SHARE: .08, REWARD_GROWTH: 1.066,
    IDLE_COINS: .01,         // 放置產出＝每秒戰力 ×0.01
    // 抽卡價隨「已經付費抽過幾次」往上走（同 1.0 的招募費用），不然放置金幣是跟戰力一起指數長的，
    // 戰力→金幣→抽卡→戰力 會直接跑掉：模擬器量到一輪 20 站可以抽到一千七百次。
    //   第十一輪把 DRAW_GROWTH 從 1.02 降到 1.006：目標函數換成「兩週養滿 71 張」之後，1.02 在第 4 天就讓抽卡實質停住
    //   （第 1260 抽單價 1000×1.02^1260≈3.8e13，收入只跟站數走 2.1^站，兩條指數在第 30 站附近交叉）。
    //   掃描（KEEP=1、一般玩家、30 天，看「全滿養在第幾天」）：王粉塵砍成 150 之後 1.004→8 天／1.0055→14 天／1.006→16 天／1.007→21 天。
    //   ⚠ 這個參數非常敏感（千分之一就差四天），改它一定要重跑 tools/sim/apoc.js 的多種子驗證。
    DRAW_COST: 1000, DRAW_GROWTH: 1.0055, STATIONS: 20,
    // 第十一輪 養成（DESIGN-2026-09-14-apoc-growth.md）：使用者「玩家玩兩週才有辦法把所有卡片都抽到滿星突破、卡冊全收集」。
    //   星級門檻是「累計粉塵」（抽到重複＝+1 粉塵，同 1.0 的 dust）；滿星之後才能突破，突破吃掉滿星門檻以上的粉塵。
    //   ⚠ 神話率 0.25% 分給 14 張＝每張 0.018%，「14 張神話各抽到一張」期望要 18,200 抽（兩週預算只有 1,260）——
    //     所以卡冊全收集不可能靠運氣，一定要有兌換所這條不看運氣的路（同 1.0 的萬用粉塵換指定卡）。
    GROW: {
      STARS: [1, 2, 3, 5, 8],          // 累計粉塵 → 1★～5★（8 顆滿星）
      TRANSCEND: [2, 2, 3, 3, 4],      // 滿星之後五級突破各要幾顆粉塵（累計 14 → 滿養 22）
      TRANSCEND_MUL: .10,              // 每突破一級 +10% 戰力
      // 萬用粉塵匯率：已滿養的卡再抽到就換成這麼多萬用粉塵，兌換所也用同一張表（價值守恆，不做懲罰性折損）。
      // 數字是抽中機率的倒數比例（1 : 2.2 : 4.4 : 25）壓過的——神話不壓的話會獨自吃掉一半以上的預算。
      DUST: { common: 1, rare: 1, epic: 2, legendary: 4, mythic: 10 },
      // 五隻王首勝送的萬用粉塵。第十一輪一開始是 [30,60,120,240,480]（合計 930），
      // 使用者實測後：「到後面不就可以快速把卡都生滿，我認為這樣給太多」
      // 「如果抽卡漲價幅度調緩了，就不用給這麼多粉塵」→ 砍成合計 150（原本的 16%）。
      // 王的回饋感靠「有掉東西」，不是靠「掉很多」。
      BOSS: [10, 20, 30, 40, 50],
      ENDLESS: { BASE: 20, GROWTH: 1.15 },   // 無盡模式每推進一站送 BASE×GROWTH^(第幾站)
      DISPATCH: 3,                     // 派遣回來的萬用粉塵（再 ×DISPATCH.RARITY）
      // 保底：連續抽 AT 次都沒有新卡，下一張保證是「還沒有的卡」（抽中就歸零）。
      // 使用者把「兌換所可以生出沒有的卡」退掉之後，這是卡冊全收集唯一還走得通的路——
      // 神話率 0.25% 分給 14 張＝每張 0.018%，純靠運氣「14 張各抽到一張」期望 18,200 抽。
      // 保底放在抽卡裡而不是兌換所裡，是為了保住「第一次抽到」的重量（使用者原話）。
      PITY: { AT: 180 },
    },
    // 第十輪 C 重走廢土（使用者：「兩個都做」，幅度交給模擬器）：全線通行後重來一圈，保留收藏、金幣與訓練歸零；
    //   第 n 圈敵人血與獎勵 ×HP_FIRST×HP_GROWTH^(n−1)、戰力 ×(1＋POWER×n)，最多 MAX 圈。
    //   scratchpad ngplus_sim.js 一般玩家：HP_FIRST 3／4／6／10／16 第二圈 59／51／76／109／137 分 → 取 10（第一圈 146，第二圈快約 25%，之後 48→41→40）
    LAP: { MAX: 10, HP_FIRST: 10, HP_GROWTH: 1.1, POWER: .25 },
    ENDLESS_MAX: 100,
    // 第十輪 D 離線（使用者：「離線會在該關卡持續賺錢，不會自己前進任何關卡」）：回來時補算最多 MAX_MS；
    //   收入＝（放置金幣＋一直打目前這一站的怪的擊殺獎勵）×SHARE。王站／打完全線時算前一個一般站。
    //   tools/sim/apoc.js（一天 3 場 20 分、中間下線 6 小時）SHARE .25：一般玩家全破 179 → 158 分、慢的 462 → 420 分（少一成左右，不會變成掛著就過）
    OFFLINE: { MIN_MS: 60000, MAX_MS: 8 * 3600000, SHARE: .25 },
    // 第十輪 D 派遣（使用者：「派遣拿金幣，低機率拿到券」）：不在隊上的卡出去 MS，回來帶「目前這一站 KILLS 隻怪」的金幣 ×稀有度，TICKET 機率多一張券
    //   Codex 10D 值得修「派遣要算進平衡」：模擬器每場開頭把隊外的卡派滿（最勤快的派法），一般玩家三個種子平均
    //   不派 150 分／KILLS 2 → 129（−14%）／3 → 119／5 → 122（單種子）／20 → 81（全線少一半）→ 取 2
    DISPATCH: { SLOTS: 3, MS: 2 * 3600000, KILLS: 2, TICKET: .12, RARITY: { mythic: 2, legendary: 1.6, epic: 1.3, rare: 1, common: 1 } },   // 無盡模式最多到第 100 站（血是 2.1^站，再往下數字會大到畫面寫不下）
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
    // 王關機制（第十輪使用者：「照企劃做五種」，PLAN-2.0-levels.md 三；以前五隻王都是同一套護盾）。
    //   mech＝第幾隻王：0 灰狼犬 召喚小怪／1 貼紙羊 外殼層／2 扛槌兔 節拍／3 雞頭合成怪 部位順序／4 滅世珍獸 前四種每 ROTATE_MS 輪流。
    //   破防（breakUntil）是共用的：外殼剝掉一層、節拍連中 CHAIN 下、部位順序打完一輪都會破防，破防中全部傷害 ×BREAK_MUL。
    //   一般關完全不受影響。
    BOSS_MECH: {
      IDLE_MUL: .35, BREAK_MS: 8000, BREAK_MUL: 2, ROTATE_MS: 15000,
      SUMMON: { COUNT: 5, HP: .06, AGAIN_MS: 20000, AGAIN: 3 },           // 狗群：每隻血＝王血 ×HP，清光才打得到王，AGAIN_MS 後再來 AGAIN 隻；放置也打得到狗
      SHELL: { AT: [.75, .5, .25], HP: .08, STAGGER_MS: 3000 },           // 外殼：王血掉到 AT 時長出殼（血＝王血 ×HP），只有點擊剝得掉；剝掉一層破防 3 秒
      RHYTHM: { MS: 1170, WINDOW: 200, HIT_MUL: 3, MISS_MUL: .5, CHAIN: 8 },   // 節拍＝扛槌兔 9 格 ×130ms 的揮槌週期；拍子上 ±WINDOW 內點 ×3、沒對上 ×.5，連中 CHAIN 下破防
      ORDER: { PARTS: ['head', 'body', 'tail'], LEN: 4 },                  // 部位：照亮起的圓鈕順序點 LEN 下破防；點錯從頭；點空白處普通傷害
    },
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
  // ---- 王關機制（第十輪）
  const M = () => RULES.BOSS_MECH;
  const seqFor = (index, round) => Array.from({ length: M().ORDER.LEN }, (_, k) => M().ORDER.PARTS[(index * 7 + round * 5 + k * k * 3 + k * 2) % M().ORDER.PARTS.length]);
  function freshMech(i, needHp = need(i)) {
    const hp = needHp * M().SUMMON.HP;
    return { mech: Math.min(4, Math.floor(i / 4)), minions: { left: M().SUMMON.COUNT, max: hp, hp, nextAt: 0 }, shell: { layer: 0, hp: 0 },
      rhythm: { chain: 0 }, order: { step: 0, round: 0, seq: seqFor(i, 0) } };
  }
  // 現在是哪一種機制（滅世珍獸每 ROTATE_MS 換一種）
  const mechAt = (st, now) => !st?.boss ? -1 : st.mech === 4 ? Math.floor(Math.max(0, now - (st.startedAt || 0)) / M().ROTATE_MS) % 4 : (st.mech ?? 0);
  const onBeat = (st, now) => { const ms = M().RHYTHM.MS, ph = ((now - (st.startedAt || 0)) % ms + ms) % ms; return Math.min(ph, ms - ph) <= M().RHYTHM.WINDOW; };
  const breaking = (st, now) => now < (st?.breakUntil || 0);
  // 點一下的倍率：破防 ×2；節拍時拍子上 ×3、沒對上 ×.5
  const tapMul = (st, now) => !st?.boss ? 1 : (breaking(st, now) ? M().BREAK_MUL : 1) * (mechAt(st, now) === 2 ? (onBeat(st, now) ? M().RHYTHM.HIT_MUL : M().RHYTHM.MISS_MUL) : 1);
  // 放置的倍率：破防 ×2；節拍與部位時放置只剩 IDLE_MUL（要人在場點）；外殼長出來時放置打不動殼
  const idleMul = (st, now) => {
    if (!st?.boss) return 1;
    const m = mechAt(st, now), br = breaking(st, now) ? M().BREAK_MUL : 1;
    if (m === 1 && st.shell?.hp > 0) return 0;
    return br * (m === 2 || m === 3 ? M().IDLE_MUL : 1);
  };
  // 傷害進王：狗群先吸收、殼只吃點擊、節拍連中計數、部位順序計步。回傳 { st, broke, absorbed }
  function routeDamage(st0, d, now, byTap, part) {
    const st = { ...st0 }, m = mechAt(st, now); let broke = false;
    if (m === 0 && st.minions?.left > 0) {
      const mi = { ...st.minions }; mi.hp -= d;
      if (mi.hp <= 0) { mi.left -= 1; mi.hp = mi.left > 0 ? mi.max : 0; if (!mi.left) mi.nextAt = now + M().SUMMON.AGAIN_MS; }
      st.minions = mi; return { st, broke, absorbed: true };
    }
    if (m === 1) {
      const sh = { ...(st.shell || { layer: 0, hp: 0 }) }, AT = M().SHELL.AT;
      if (sh.hp > 0) {
        if (byTap) { sh.hp -= d; if (sh.hp <= 0) { sh.hp = 0; sh.layer += 1; st.breakUntil = now + M().SHELL.STAGGER_MS; broke = true; } }
        st.shell = sh; return { st, broke, absorbed: true };
      }
      // 別的機制期間（滅世珍獸輪流）已經打到門檻底下：那幾層直接跳過，不要把血補回門檻
      while (sh.layer < AT.length && st.hp <= AT[sh.layer] * st.need) sh.layer += 1;
      const floor = sh.layer < AT.length ? AT[sh.layer] * st.need : -Infinity;
      st.hp = Math.max(floor, st.hp - d);
      if (st.hp <= floor) sh.hp = st.need * M().SHELL.HP;
      st.shell = sh; return { st, broke, absorbed: false };
    }
    if (m === 2 && byTap) {
      const r = { ...(st.rhythm || { chain: 0 }) };
      if (onBeat(st, now)) { r.chain += 1; if (r.chain >= M().RHYTHM.CHAIN && !breaking(st, now)) { st.breakUntil = now + M().BREAK_MS; broke = true; r.chain = 0; } }
      else r.chain = 0;
      st.rhythm = r;
    }
    if (m === 3 && byTap && part) {
      const o = { ...(st.order || { step: 0, round: 0, seq: seqFor(st.index, 0) }) };
      if (part === o.seq[o.step]) {
        o.step += 1;
        if (o.step >= o.seq.length) { o.step = 0; o.round += 1; o.seq = seqFor(st.index, o.round); if (!breaking(st, now)) { st.breakUntil = now + M().BREAK_MS; broke = true; } }
      } else o.step = 0;
      st.order = o;
    }
    st.hp -= d; return { st, broke, absorbed: false };
  }
  // 狗群到點重生（只在輪到狗群的時候）
  const respawn = (st, t) => mechAt(st, t) === 0 && st.minions && !st.minions.left && st.minions.nextAt && t >= st.minions.nextAt
    ? { ...st, minions: { ...st.minions, left: M().SUMMON.AGAIN, hp: st.minions.max, nextAt: 0 } } : st;
  // 殼的下一條線（已經打穿的層不算）
  function shellFloor(st) {
    const AT = M().SHELL.AT; let layer = st.shell?.layer || 0;
    while (layer < AT.length && st.hp <= AT[layer] * st.need) layer += 1;
    return layer < AT.length ? AT[layer] * st.need : -Infinity;
  }
  // 放置傷害照時間順序推進（Codex 第十輪 A 必修 1、2）：一段時間裡可能殺好幾隻狗、打到門檻長殼、狗群到點重生，
  //   剩下的傷害要接著算；以前一段最多殺一隻狗、多的傷害消失，而且結算頻率不同結果就不同。只推進到 s1（呼叫端已經夾在期限內）。
  function idleBoss(st0, dps, s0, s1) {
    let st = st0, t = s0;
    const mid = (s0 + s1) / 2, m = mechAt(st, mid);   // 呼叫端在換機制、破防、技能到期的時間點切段，段內機制固定
    // ⚠ 傳給 routeDamage 的時間一定要在段內：段尾剛好是滅世珍獸換機制的時間點，拿段尾去判斷會把傷害算進下一種機制
    const inside = x => Math.min(Math.max(x, s0), s1 - Math.min(1, (s1 - s0) / 2));
    for (let guard = 0; t < s1 && guard < 2000; guard++) {
      st = respawn(st, t);
      const rate = dps * idleMul(st, mid) / 1000;   // 每毫秒
      if (!(rate > 0)) {
        // 殼擋住放置：這一段剩下的時間打不動（狗群輪不到這裡）
        break;
      }
      let until = s1;
      if (m === 0 && st.minions && !st.minions.left && st.minions.nextAt > t && st.minions.nextAt < s1) until = st.minions.nextAt;
      if (m === 0 && st.minions?.left > 0) {
        const ms = st.minions.hp / rate;
        if (t + ms <= until) { st = routeDamage(st, st.minions.hp * (1 + 1e-9) + 1e-9, inside(t + ms), false).st; t += ms; continue; }
      } else if (m === 1 && !(st.shell?.hp > 0)) {
        const floor = shellFloor(st);
        if (floor > -Infinity && st.hp > floor) {
          const ms = (st.hp - floor) / rate;
          if (t + ms <= until) { st = routeDamage(st, st.hp - floor, inside(t + ms), false).st; t += ms; continue; }
        }
      }
      st = routeDamage(st, rate * (until - t), inside(until), false).st; t = until;
    }
    return st;
  }
  // 滅世珍獸換機制的時間點
  const rotateCuts = (st, t0, t1) => {
    if (st.mech !== 4) return [];
    const T = M().ROTATE_MS, s = st.startedAt || 0, out = [];
    for (let k = Math.ceil((t0 - s) / T); s + k * T < t1 && out.length < 100; k++) if (k > 0) out.push(s + k * T);
    return out;
  };
  // 存檔可編輯（Codex 第十輪 A 必修 4）：機制狀態壞掉就重建那一塊，不要 NaN、不要點部位時丟例外
  function cleanMech(st) {
    const f = freshMech(st.index, st.need > 0 ? st.need : need(st.index)), fin = v => Number.isFinite(Number(v)) ? Number(v) : NaN, int = v => Number.isInteger(Number(v)) ? Number(v) : NaN;
    const out = { ...st, mech: f.mech };
    const mi = st.minions || {}, maxCount = Math.max(M().SUMMON.COUNT, M().SUMMON.AGAIN);
    out.minions = int(mi.left) >= 0 && int(mi.left) <= maxCount && fin(mi.max) > 0 && fin(mi.hp) >= 0 && fin(mi.hp) <= fin(mi.max) && fin(mi.nextAt ?? 0) >= 0
      ? { left: int(mi.left), max: fin(mi.max), hp: fin(mi.hp), nextAt: fin(mi.nextAt ?? 0) } : f.minions;
    const sh = st.shell || {};
    out.shell = int(sh.layer) >= 0 && int(sh.layer) <= M().SHELL.AT.length && fin(sh.hp) >= 0 && fin(sh.hp) <= (st.need || 0) * M().SHELL.HP * 1.0001
      ? { layer: int(sh.layer), hp: fin(sh.hp) } : f.shell;
    const r = st.rhythm || {};
    out.rhythm = int(r.chain) >= 0 && int(r.chain) <= M().RHYTHM.CHAIN ? { chain: int(r.chain) } : f.rhythm;
    const o = st.order || {}, P = M().ORDER.PARTS;
    out.order = Array.isArray(o.seq) && o.seq.length === M().ORDER.LEN && o.seq.every(x => P.includes(x)) && int(o.step) >= 0 && int(o.step) < o.seq.length && int(o.round) >= 0
      ? { seq: [...o.seq], step: int(o.step), round: int(o.round) } : f.order;
    out.breakUntil = fin(st.breakUntil) >= 0 ? fin(st.breakUntil) : 0;
    return out;
  }
  // 畫面與模擬器用的王關狀態摘要
  function bossInfo(st, now) {
    if (!st?.boss) return null;
    const m = mechAt(st, now), o = st.order || {};
    return { mech: m, rotating: st.mech === 4, breaking: breaking(st, now), breakLeft: Math.max(0, (st.breakUntil || 0) - now),
      minions: st.minions?.left || 0, respawnIn: st.minions?.left ? 0 : Math.max(0, (st.minions?.nextAt || 0) - now),
      shellHp: st.shell?.hp || 0, shellMax: st.need * M().SHELL.HP, shellLayer: st.shell?.layer || 0, shellLayers: M().SHELL.AT.length,
      chain: st.rhythm?.chain || 0, chainNeed: M().RHYTHM.CHAIN, onBeat: onBeat(st, now), beatMs: M().RHYTHM.MS,
      nextPart: o.seq ? o.seq[o.step || 0] : null, step: o.step || 0, steps: o.seq?.length || M().ORDER.LEN,
      rotateIn: st.mech === 4 ? M().ROTATE_MS - (Math.max(0, now - (st.startedAt || 0)) % M().ROTATE_MS) : 0 };
  }
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
    return { unlocked: false, tutorial: 0, coins: 0, tickets: 0, progress: 0, cooldownUntil: 0, collection: {}, dust: {}, universalDust: 0, transcend: {}, bossDust: [], pity: 0, roster: [], skills: [null, null, null, null], stage: null, gifted: false, wins: 0,
      paidDraws: 0, teamLevel: 0, clickLevel: 0, onePeak: 0, bossFailed: null, farmNextAt: 0, revisitAt: null, exchange: { day: null, count: 0, total: 0 }, stats: { taps: 0, maxHit: 0, shieldBreaks: 0, draws: 0 }, cosmetics: { owned: ['rust'], hitFx: 'rust' },
      pending: null, cleared: false, laps: 0, endless: false, endlessBest: 0, seenAt: 0, dispatch: [], dispatchDone: 0, skillCd: [0, 0, 0, 0], fx: { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1, mythic: false } };
  }
  function normalize(a) {
    const f = fresh(), raw = a || {}; a = { ...f, ...raw };
    if (!a.collection || typeof a.collection !== 'object') a.collection = {};
    // 第十一輪養成欄位。舊存檔沒有 dust：那時候「張數就是星數」，所以直接把張數當累計粉塵搬過來
    //   （dustOf 的 fallback 也是這樣，但這裡要落地成真欄位，不然第一次抽到重複就會從 0 重算）。
    // ⚠ 要看 raw.dust 不是 a.dust：a 已經跟 fresh() 合併過，沒有粉塵的舊存檔在這裡會是空物件（truthy），
    //   拿它當「有粉塵」判斷會讓整批舊存檔的粉塵歸零。
    { const raw0 = a.collection, d = raw.dust && typeof raw.dust === 'object' ? raw.dust : null;
      a.dust = {};
      // 舊版「張數就是星數、每張 +25% 無上限」：一張抽了 59 次的精良卡以前是 ×15.5，現在封在 ×3.0。
      // 直接套上去等於把既有玩家的戰力腰斬、卡在打不過的站——超出滿養的張數一律折成萬用粉塵還給玩家。
      // 這段只在「舊存檔（沒有 dust 欄位）」跑，而且只從 collection 推導，所以重跑幾次結果都一樣（沒寫檔也不會重複加）。
      let refund = 0;
      for (const id of Object.keys(raw0)) {
        const n = count(d ? d[id] : raw0[id]); if (n <= 0) continue;
        a.dust[id] = Math.min(n, fullDust());
        if (!d) refund += Math.max(0, n - fullDust()) * (RULES.GROW.DUST[poolById()[id]?.rarity] ?? 1);
      }
      if (refund) a.universalDust = count(a.universalDust) + refund;
    }
    { const t = raw.transcend && typeof raw.transcend === 'object' ? raw.transcend : {};
      a.transcend = {};
      for (const id of Object.keys(a.collection)) {
        const v = Math.min(count(t[id]), RULES.GROW.TRANSCEND.length);
        // 突破級數不能比粉塵買得起的多（手改存檔會憑空多戰力）：逐級回推，買不起就砍掉
        let lv = v; while (lv > 0 && dustOf(a, id) < starCap() + RULES.GROW.TRANSCEND.slice(0, lv).reduce((x, y) => x + y, 0)) lv--;
        if (lv > 0) a.transcend[id] = lv;
      }
    }
    a.universalDust = count(a.universalDust);
    a.pity = Math.min(count(a.pity), RULES.GROW.PITY.AT);   // 保底計數：連續幾次沒抽到新卡
    // 哪幾隻王的首勝粉塵已經發過（重走廢土每一圈重算，見 replay）
    a.bossDust = [...new Set((Array.isArray(a.bossDust) ? a.bossDust : []).filter(n => Number.isInteger(n) && n >= 0 && n <= RULES.ENDLESS_MAX))];
    if (!Array.isArray(a.roster)) a.roster = [];
    if (!Array.isArray(a.skills)) a.skills = []; a.skills = [0, 1, 2, 3].map(i => a.skills[i] || null);
    a.roster = a.roster.filter(id => a.collection[id] > 0);
    // 第十輪 D：派遣中的卡（壞資料整筆丟：沒抽到、在隊上、重複、時間不對）；離線基準時間
    { const seen = new Set(); a.dispatch = (Array.isArray(a.dispatch) ? a.dispatch : []).filter(d => d && typeof d.id === 'string' && a.collection[d.id] > 0 && !a.roster.includes(d.id) && !seen.has(d.id) && seen.add(d.id)
        && Number.isFinite(d.startedAt) && Number.isFinite(d.until) && d.until - d.startedAt === RULES.DISPATCH.MS).slice(0, RULES.DISPATCH.SLOTS).map(d => ({ id: d.id, startedAt: d.startedAt, until: d.until })); }
    a.dispatchDone = count(a.dispatchDone); a.seenAt = Number.isFinite(Number(a.seenAt)) && Number(a.seenAt) > 0 ? Number(a.seenAt) : 0;
    { const seen = new Set();
      a.skills = a.skills.map(id => {
        if (!id || !a.roster.includes(id) || seen.has(id)) return null;   // 舊檔可能有同卡多槽（Codex 第三輪 B1）
        seen.add(id); return id;
      }); }
    // 刷怪中的戰鬥是前一站：只有「這一站是王、而且輸過」才合法（第六輪）；其他進度不符的戰鬥丟掉
    // 走過的站都可以刷（第十二輪，使用者：「要讓回家可以回到過去，打當時的怪物重複玩，不要鎖住」）。
    // 以前只認「王輸過時的前一站」，回顧模式重整後會被清掉。
    const farmOk = st => st.index >= 0 && st.index < a.progress;
    if (a.stage && (typeof a.stage.hp !== 'number' || (a.stage.farm ? !farmOk(a.stage) : a.stage.index !== a.progress))) a.stage = null;
    if (a.stage?.farm) a.stage = { ...a.stage, farm: true, boss: false, deadline: null, breakUntil: 0 };
    // 第十輪：舊存檔的王關是護盾版（shield），換成這一隻王自己的機制狀態
    if (a.stage && a.stage.boss && (a.stage.mech === undefined || !a.stage.minions || !a.stage.shell || !a.stage.rhythm || !a.stage.order)) {
      a.stage = { ...a.stage, ...freshMech(a.stage.index, need(a.stage.index, a)), breakUntil: 0 };
    }
    if (a.stage && a.stage.boss) a.stage = cleanMech(a.stage);   // 壞掉的機制欄位重建（Codex 第十輪 A 必修 4）
    if (a.stage) delete a.stage.shield;
    // 一站幾隻（第九輪）：王站與刷怪固定 1 隻；一般站照現在的 WAVES，目前第幾隻夾在 1～waves
    if (a.stage) { const waves = a.stage.boss || a.stage.farm ? 1 : RULES.WAVES;
      a.stage = { ...a.stage, waves, wave: Math.max(1, Math.min(waves, count(a.stage.wave) || 1)) }; }
    // 舊存檔的戰鬥還是舊血量（第五輪改了 BASE_NEED／GROWTH／BOSS_MUL，Codex 第五輪必修 2）：照剩下的血佔幾成換算成新版血量。
    // 換算後 need 就等於新版，所以只會換一次；王關的 60 秒期限在第一次結算時才給（settle 裡），這裡不碰期限，避免每次載入就續時。
    if (a.stage && a.stage.need !== need(a.stage.index, a)) {
      const n = need(a.stage.index, a), ratio = a.stage.need > 0 ? Math.max(0, Math.min(1, a.stage.hp / a.stage.need)) : 1;
      a.stage = { ...a.stage, need: n, hp: n * ratio };
    }
    // 舊檔的「買過幾張券」就是當時的抽卡價格進度，搬成付費抽數，價格不會倒退
    a.paidDraws = count(raw.paidDraws !== undefined ? raw.paidDraws : raw.ticketsBought); delete a.ticketsBought;
    a.teamLevel = Math.min(RULES.TRAIN_MAX, count(a.teamLevel)); a.clickLevel = Math.min(RULES.TRAIN_MAX, count(a.clickLevel));
    // 回顧：選了哪一站就一直重打那一站，不推進度。進度往前走之後失效（例如輪迴回到第 0 站）
    a.revisitAt = Number.isInteger(raw.revisitAt) && raw.revisitAt >= 0 && raw.revisitAt < a.progress ? raw.revisitAt : null;
    // 場上那一場如果是回顧，revisitAt 就以它為準——兩者不能各說各話。
    // （Codex 複查指出：壞存檔可能出現「stage.revisit 為真但 revisitAt 是 null」，
    //   那樣打完一隻之後不會再重生，玩家會停在一個不會前進、也沒人接手的舊站。）
    if (a.stage?.revisit) a.revisitAt = a.stage.index;
    else if (a.revisitAt !== null && a.stage && !a.stage.farm) a.revisitAt = null;   // 場上是正規戰鬥＝已經離開回顧
    a.farmNextAt = Number.isFinite(Number(a.farmNextAt)) && Number(a.farmNextAt) > 0 ? Number(a.farmNextAt) : 0;
    delete a.boost;   // 1.0 加成是執行期現算的，存檔裡的舊值一律不信
    a.bossFailed = Number.isInteger(a.bossFailed) && a.bossFailed === a.progress ? a.bossFailed : null;   // 只記「目前這一站的王輸過」
    delete a.bossCarry;   // 保留血量的機制拿掉了（第五輪使用者），上一版存檔留下的欄位丟掉
    a.onePeak = Number.isFinite(Number(a.onePeak)) && Number(a.onePeak) > 0 ? Number(a.onePeak) : 0;   // 桌邊歷史最高每秒收益（換券定價基準，換桌布不歸零）
    { const x = a.exchange && typeof a.exchange === 'object' ? a.exchange : {};
      a.exchange = { day: Number.isFinite(x.day) ? x.day : null, count: count(x.count), total: count(x.total) }; }
    // 第十輪 B：2.0 新手引導走到第幾步（0～4，4＝看完）；UI 照這個數字決定要不要冒提示
    a.tutorial = Number.isInteger(a.tutorial) && a.tutorial > 0 ? Math.min(a.tutorial, 4) : 0;
    { const x = a.stats && typeof a.stats === 'object' ? a.stats : {};
      a.stats = { taps: count(x.taps), maxHit: Number.isFinite(x.maxHit) && x.maxHit > 0 ? x.maxHit : 0, shieldBreaks: count(x.shieldBreaks), draws: count(x.draws) }; }
    { const x = a.cosmetics && typeof a.cosmetics === 'object' ? a.cosmetics : {}, ids = RULES.HIT_FX.map(f => f.id);
      const owned = [...new Set(['rust', ...(Array.isArray(x.owned) ? x.owned : [])])].filter(id => ids.includes(id));
      a.cosmetics = { owned, hitFx: owned.includes(x.hitFx) ? x.hitFx : 'rust' }; }
    a.cleared = !!a.cleared || a.progress >= RULES.STATIONS; a.laps = lapsOf(a); a.endless = !!a.endless && a.cleared; a.endlessBest = count(a.endlessBest);   // cleared＝已通關；舊檔已經走完 20 站就直接補上，不要事後補播結局
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
    if (poolById()[RULES.GIFT.card]) {
      const id = RULES.GIFT.card;
      a.dust = { ...(a.dust || {}) }; a.dust[id] = dustOf(a, id) + 1;   // 開門禮也要落地粉塵，不然第一次抽到重複會少算
      a.collection[id] = (a.collection[id] || 0) + 1;
      if (!a.roster.includes(id)) a.roster = [...a.roster, id];
    }
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
  // ---- 養成：粉塵／星級／突破（第十一輪，DESIGN-2026-09-14-apoc-growth.md）
  const G = () => RULES.GROW;
  const starCap = () => G().STARS[G().STARS.length - 1];                    // 滿星要的粉塵（8）
  const fullDust = () => starCap() + G().TRANSCEND.reduce((x, y) => x + y, 0);   // 滿養要的粉塵（22）
  const starsOf = n => n < 1 ? 0 : G().STARS.filter(t => n >= t).length;    // 累計粉塵 → 幾顆星
  const maxStars = () => G().STARS.length;
  // 舊存檔沒有 dust：張數就是粉塵（跟 1.0 的 dust() 同一招）
  const dustOf = (a, id) => a.dust?.[id] ?? a.collection?.[id] ?? 0;
  const starsAt = (a, id) => starsOf(dustOf(a, id));
  const transcendOf = (a, id) => a.transcend?.[id] || 0;
  const spentDust = (a, id) => G().TRANSCEND.slice(0, transcendOf(a, id)).reduce((x, y) => x + y, 0);
  // 可花的粉塵＝累計粉塵扣掉「維持滿星的那 8 顆」與已經花在突破上的（同 1.0 availableDust 的語意）
  const availableDust = (a, id) => Math.max(0, dustOf(a, id) - starCap() - spentDust(a, id));
  const transcendCost = (a, id) => G().TRANSCEND[transcendOf(a, id)] || 0;
  const dustRate = id => G().DUST[poolById()[id]?.rarity] ?? 1;
  const isMaxed = (a, id) => transcendOf(a, id) >= G().TRANSCEND.length && dustOf(a, id) >= fullDust();
  const canTranscend = (a, id) => starsAt(a, id) >= maxStars() && transcendCost(a, id) > 0 && availableDust(a, id) >= transcendCost(a, id);
  // 收下時自動升（第〇之五輪定案：升階／超越改成收下時自動做，詳情頁不再放那兩顆鍵）
  function autoGrow(a, ids) {
    const grows = [];
    for (const id of [...new Set(ids)]) {
      while (canTranscend(a, id)) {
        a.transcend = { ...(a.transcend || {}), [id]: transcendOf(a, id) + 1 };
        grows.push({ id, to: transcendOf(a, id) });
      }
    }
    return grows;
  }
  function cardPower(a, id) {
    const c = poolById()[id]; if (!c || !a.collection[id]) return 0;
    const stars = Math.max(1, starsAt(a, id));
    return RULES.POWER[c.rarity] * (1 + RULES.STAR_MUL * (stars - 1)) * (1 + G().TRANSCEND_MUL * transcendOf(a, id));
  }
  // 兌換所：花萬用粉塵補**已經抽到過**的卡的粉塵。
  // ⚠ 第一版是「沒有的卡也能換」，使用者退掉：「這個我不要，這樣才有顯得第一次抽到的重要性」。
  //   第一張一律要從抽卡出來；運氣卡死的部分改由保底處理（見 RULES.GROW.PITY 與 rollPack）。
  function exchangeDust(a, id, n = 1) {
    if (!poolById()[id]) throw new Error('卡片不在末世卡池裡');
    if (!Number.isSafeInteger(n) || n < 1) throw new Error('數量不對');
    if (!a.collection[id]) throw new Error('還沒抽到這張卡');
    if (isMaxed(a, id)) throw new Error('這張已經滿養了');
    const cost = dustRate(id) * n;
    if ((a.universalDust || 0) < cost) throw new Error('萬用粉塵不足');
    const s = { ...a, universalDust: a.universalDust - cost, dust: { ...(a.dust || {}) }, collection: { ...a.collection }, transcend: { ...(a.transcend || {}) } };
    s.dust[id] = dustOf(s, id) + n;
    const grows = autoGrow(s, [id]);
    return { state: s, grows };
  }
  const power = a => a.roster.reduce((sum, id) => sum + cardPower(a, id), 0) * trainMul('team', a.teamLevel) * boostOf(a).power * lapPower(a);
  // 血量：一般站 BASE×GROWTH^i；王站再 ×BOSS_MULS[第幾隻王]（Sakura 的王＝該區怪 ×2～6，逐隻遞增）
  const bossMulOf = i => RULES.BOSS_MULS[Math.floor(i / 4)] ?? RULES.BOSS_MULS[RULES.BOSS_MULS.length - 1];
  // 第十輪 C 重走廢土：第幾圈（壞值當 0）→ 敵人血倍率、戰力倍率
  const lapsOf = a => Number.isInteger(a?.laps) && a.laps > 0 ? Math.min(a.laps, RULES.LAP.MAX) : 0;
  const lapHp = a => lapsOf(a) ? RULES.LAP.HP_FIRST * RULES.LAP.HP_GROWTH ** (lapsOf(a) - 1) : 1;
  const lapPower = a => 1 + RULES.LAP.POWER * lapsOf(a);
  const need = (i, a) => Math.round(RULES.BASE_NEED * RULES.GROWTH ** i * (isBoss(i) ? bossMulOf(i) : 1) * lapHp(a));
  const reward = (i, a) => Math.round(need(i, a) * RULES.REWARD_SHARE * RULES.REWARD_GROWTH ** i);
  // 一般站一隻（含刷怪）的獎勵＝這一站的獎勵 ÷ WAVES：一站打完拿到的錢跟以前一樣，只是多花時間。
  // ⚠ 第九輪先試過每隻都給整份——錢變成 WAVES 倍、訓練長得太快，打越多隻全線反而越短（一般玩家 54 分 → 8 隻時 38 分）
  const killReward = (i, a) => isBoss(i) ? reward(i, a) : Math.round(reward(i, a) / Math.max(1, RULES.WAVES));
  // 刷怪中的戰鬥可以直接被「再次挑戰」換掉
  // 第十一輪：打贏一站送多少萬用粉塵。王只有首勝給（每圈重算），無盡模式每推進一站都給。
  //   使用者：「也要顧及打怪收益與打王的回饋感」——以前王只給金幣，回饋是間接的；現在王直接掉養成資源。
  function winDust(a, i) {
    if (i >= RULES.STATIONS) return Math.round(RULES.GROW.ENDLESS.BASE * RULES.GROW.ENDLESS.GROWTH ** (i - RULES.STATIONS));
    if (!isBoss(i) || (a.bossDust || []).includes(i)) return 0;
    return RULES.GROW.BOSS[Math.min(RULES.GROW.BOSS.length - 1, Math.floor(i / 4))] || 0;
  }
  const canFight = (a, now) => (!a.stage || !!a.stage.farm) && a.progress < (a.endless ? RULES.ENDLESS_MAX : RULES.STATIONS) && !(isBoss(a.progress) && a.cooldownUntil > now);
  // 刷怪（第六輪，照 Sakura 的「打不過就回去刷怪」）：這一站的王輸過之後，回前一站一直打——拿那一站的獎勵、不推進度
  const canFarm = (a, now) => !a.stage && isBoss(a.progress) && a.bossFailed === a.progress && a.progress > 0 && now >= (a.farmNextAt || 0);
  // 回顧（第十二輪，使用者指定）：走過的站可以無限重打，拿那一站的獎勵、進度不動。
  // 全線通行之後也靠這條在場上常駐一隻珍母，讓玩家點著賺錢，不要空在那。
  // 王關打到一半不能落跑（不然跑一趟地圖就能躲掉 60 秒判輸）；小怪站隨時可以走，本來就沒有輸贏。
  // 正規的王關打到一半不能走；回顧中的王沒有輸贏（逾時只是重來），隨時可以走。
  const canRevisit = (a, i) => Number.isInteger(i) && i >= 0 && i < a.progress && !(a.stage && a.stage.boss && !a.stage.revisit);
  function revisit(a, now, i) {
    if (!canRevisit(a, i)) throw new Error(a.stage?.boss ? '王關進行中' : '這一站還沒走過');
    if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
    // farm:true ＝ 結算時給這一站的獎勵、不推進度（跟王關失敗的刷怪走同一條路）
    // 王站回顧就是真的王（機制、護盾、60 秒期限都在）——使用者 2026-09-14：「重打這一站似乎不會真的重打那站，根本遇不到王」。
    // 逾時不算輸（不記 bossFailed、不進冷卻），只是等重生再來一隻。
    // 使用者 2026-09-14 晚：「回顧打完小怪會切到王嗎？我希望是這樣，等於那關從走但保留整體進度」——
    // 所以回顧是**一條路**：小怪站照正規打 WAVES 隻，打完往下一站走，打到這一區段的王就結束回顧（settle 裡推 revisitAt）。
    const boss = isBoss(i);
    return { ...a, revisitAt: i, stage: { index: i, hp: need(i, a), need: need(i, a), boss, farm: true, revisit: true, wave: 1, waves: boss ? 1 : RULES.WAVES, startedAt: now,
      deadline: boss && RULES.BOSS_TIME ? now + RULES.BOSS_TIME : null, breakUntil: 0, ...(boss ? freshMech(i, need(i, a)) : {}) } };
  }
  const leaveRevisit = a => a.revisitAt === null || a.revisitAt === undefined ? a : { ...a, revisitAt: null, stage: a.stage?.revisit ? null : a.stage };
  function fight(a, now, farm = false) {
    a = leaveRevisit(a);   // 回到目前站＝離開回顧
    if (farm) {
      if (!canFarm(a, now)) throw new Error('現在不能刷怪');
      if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
      const i = a.progress - 1;
      return { ...a, stage: { index: i, hp: need(i, a), need: need(i, a), boss: false, farm: true, startedAt: now, deadline: null, breakUntil: 0 } };
    }
    if (!canFight(a, now)) throw new Error(a.progress >= RULES.STATIONS ? '全線已通行' : a.stage ? '戰鬥中' : '王關冷卻中');
    if (power(a) <= 0) throw new Error('隊伍是空的，先去編隊');
    const i = a.progress, boss = isBoss(i);
    return { ...a, stage: { index: i, hp: need(i, a), need: need(i, a), boss, wave: 1, waves: boss ? 1 : RULES.WAVES, startedAt: now, deadline: boss && RULES.BOSS_TIME ? now + RULES.BOSS_TIME : null, breakUntil: 0, ...(boss ? freshMech(i, need(i, a)) : {}) } };
  }
  // 結算：回傳 { state, events:[{type:'win'|'fail', index}] }
  function settle(a, now, dt) {
    const events = []; let s = { ...a, seenAt: now };   // seenAt：最後一次結算的時間，離線收益從這裡算
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
        // 切段：破防結束、技能到期、滅世珍獸換機制（段內倍率與機制固定）；王的段內再照事件時間推進（idleBoss）
        const cuts = [t0, ...[st.breakUntil, a.fx?.powerUntil, ...rotateCuts(st, t0, tEnd)].filter(t => t > t0 && t < tEnd), tEnd].sort((x, y) => x - y);
        for (let k = 1; k < cuts.length; k++) {
          const mid = (cuts[k - 1] + cuts[k]) / 2, dps = power(a) * powerMul(a, mid);
          if (st.boss) st = idleBoss(st, dps, cuts[k - 1], cuts[k]);
          else st.hp -= dps * (cuts[k] - cuts[k - 1]) / 1000;
        }
      }
      // 結算到的時間點（期限以內）狗群剛好到點：補上重生（dt 0 的結算不會走上面的推進；期限後才到點的不算）
      if (st.boss) st = respawn(st, tEnd);
      // 破防時間到（傷害算完才清，破防那段才吃得到 ×2）
      if (st.boss && st.breakUntil && now >= st.breakUntil) st = { ...st, breakUntil: 0 };
      if (st.hp <= 0 && st.farm && st.revisit && (st.wave || 1) < (st.waves || 1)) {
        // 回顧的小怪站跟正規一樣打滿 WAVES 隻，進度不動
        s.coins += killReward(st.index, s);
        s.stage = { ...st, wave: (st.wave || 1) + 1, hp: need(st.index, s), startedAt: now };
        events.push({ type: 'wave', index: st.index, wave: st.wave || 1, waves: st.waves, reward: killReward(st.index, s) });
      }
      else if (st.hp <= 0 && st.farm) {
        // 刷怪：拿這一站的獎勵、不推進度（王那一站還等著玩家再挑戰）
        s.coins += killReward(st.index, s); s.stage = null; s.farmNextAt = now + RULES.FARM_RESPAWN;
        // 回顧：往下一站走；打完這一區段的王（或走到目前站前一站）就結束回顧，autoFight 會接回目前站／全破後的常駐
        if (st.revisit) s.revisitAt = isBoss(st.index) || st.index + 1 >= s.progress ? null : st.index + 1;
        events.push({ type: 'farm', index: st.index, reward: killReward(st.index, s) });
      }
      else if (st.hp <= 0 && (st.wave || 1) < (st.waves || 1)) {
        // 同一站的下一隻（第九輪）：給這一隻的獎勵、滿血換下一隻，進度不動
        s.coins += killReward(st.index, s);
        s.stage = { ...st, wave: (st.wave || 1) + 1, hp: need(st.index, s), startedAt: now };
        events.push({ type: 'wave', index: st.index, wave: st.wave || 1, waves: st.waves, reward: killReward(st.index, s) });
      }
      else if (st.hp <= 0) {
        s.coins += killReward(st.index, s); s.progress = st.index + 1; s.wins = (s.wins || 0) + 1; s.stage = null;
        if (s.progress > RULES.STATIONS) s.endlessBest = Math.max(s.endlessBest || 0, s.progress - RULES.STATIONS);   // 無盡模式記最遠
        events.push({ type: 'win', index: st.index, reward: killReward(st.index, s) });
        { const d = winDust(s, st.index);
          if (d > 0) {
            s.universalDust = (s.universalDust || 0) + d;
            if (st.index < RULES.STATIONS) s.bossDust = [...(s.bossDust || []), st.index];   // 王首勝只發一次
            events.push({ type: 'dust', index: st.index, amount: d, boss: st.index < RULES.STATIONS });
          } }
        // 全線通行只報一次；之後留在末世繼續放置與補收藏
        if (s.progress >= RULES.STATIONS && !s.cleared) { s.cleared = true; events.push({ type: 'cleared' }); }
      }
      // 輸過就記下這一站：之後不自動開打，等玩家按右上角的「再次挑戰」（使用者第四輪：第一次遭遇直接進，失敗之後才有進入選項）
      // 回顧中的王逾時：不算輸（不記 bossFailed、不冷卻），等重生再來一隻
      else if (st.deadline && now >= st.deadline && st.farm) { s.stage = null; s.farmNextAt = now + RULES.FARM_RESPAWN; }
      else if (st.deadline && now >= st.deadline) { s.stage = null; s.cooldownUntil = now + RULES.BOSS_COOLDOWN; s.bossFailed = st.index; events.push({ type: 'fail', index: st.index }); }
      else s.stage = st;
    }
    return { state: s, events };
  }
  // 這一下點擊的傷害（畫面浮字要跟實際扣血一致，打死那一下也要顯示整下的量，不是剩下的血）
  const tapDamage = (a, now) => !a.stage || (a.stage.deadline && now >= a.stage.deadline) ? 0 : power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel) * boostOf(a).click
    * (a.fx?.clickLeft > 0 ? (a.fx.clickMul || 1) : 1) * tapMul(a.stage, now);
  // opt.part：王④部位圓鈕（head／body／tail）；點空白處不帶
  function tap(a, now, opt = {}) {
    if (!a.stage) return a;
    if (a.stage.deadline && now >= a.stage.deadline) return a;   // 期限過了的點擊不算（結算時會判輸）
    const dmg = tapDamage(a, now);
    // 次數型增益（尾巴節拍／一口氣開封）在這裡消耗一格
    let fx = { ...a.fx };
    if (fx.clickLeft > 0) { fx.clickLeft -= 1; if (!fx.clickLeft) { fx.clickMul = 1; fx.mythic = false; } }
    let st = { ...a.stage }, broke = false;
    if (st.boss) ({ st, broke } = routeDamage(respawn(st, now), dmg, now, true, opt.part));   // 第十輪：五種王關機制（點之前先補到點的狗群重生）
    else st.hp -= dmg;
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
    // 第十一輪：張數（collection）與粉塵（dust）分家——collection 是「抽到過幾張」（卡冊顯示用），
    // dust 才是養成貨幣。已經滿養的卡再抽到不再累積粉塵，改成溢出萬用粉塵（同 1.0 receive 的語意）。
    const s = { ...a, collection: { ...a.collection }, dust: { ...(a.dust || {}) }, transcend: { ...(a.transcend || {}) }, roster: [...a.roster] };
    for (const id of ids) {
      // ⚠ 粉塵要先算再加張數：dustOf 對舊存檔會 fallback 到 collection[id]，
      //   先 collection++ 的話這一張會被算兩次（一次張數、一次 fallback）。
      const before = dustOf(s, id);
      s.pity = s.collection[id] ? (s.pity || 0) + 1 : 0;   // 抽到新卡就歸零（rollPack 照這個數字決定要不要保底）
      s.collection[id] = (s.collection[id] || 0) + 1;
      if (isMaxed(s, id)) s.universalDust = (s.universalDust || 0) + dustRate(id);
      else s.dust[id] = before + 1;
      if (!s.roster.includes(id) && !dispatchedApoc(a, id) && s.roster.length < 20 && !rosterViolations(s.roster.concat(id)).length) s.roster.push(id);   // 新卡自動入隊（同 1.0）
    }
    autoGrow(s, ids);
    return s;
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
    roster = (roster || []).filter((id, i, arr) => a.collection[id] > 0 && !dispatchedApoc(a, id) && arr.indexOf(id) === i).slice(0, 20);   // 派遣中的卡不能入隊
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
    let pity = a.pity || 0;
    for (let i = 0; i < count; i++) {
      let entry;
      // 保底：連續 AT 次沒新卡，這一張直接從「還沒有的卡」裡挑（均勻，不特別偏神話——
      // 後期沒有的本來就幾乎都是神話，不需要再加權）
      const miss = pity + 1 >= RULES.GROW.PITY.AT ? (root.ApocPool || []).filter(c => !owned[c.id]) : [];
      if (miss.length) entry = miss[Math.floor(rng() * miss.length)];
      else {
        let r = rng(), acc = 0, rarity = 'rare';
        for (const [name, p] of RATES) { acc += p; if (r < acc) { rarity = name; break; } }
        const list = pool[rarity] && pool[rarity].length ? pool[rarity] : pool.rare;
        entry = list[Math.floor(rng() * list.length)];
      }
      const had = owned[entry.id] || 0; owned[entry.id] = had + 1;
      pity = had > 0 ? pity + 1 : 0;
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
    // 第十一輪：重複卡加的是粉塵，星級由累計粉塵換算——所以升星要比對 starsAt，不是比對張數
    // （8 粉塵就滿星，之後的重複是在推突破，不能再報「升星」）。
    const starUps = [];
    for (const id of new Set(ids.filter(id => a.collection[id]))) {
      const from = starsAt(a, id), to = starsAt(next, id);
      if (to > from) starUps.push({ id, from, to });
    }
    // addCards 已經自動突破過了，這裡比對前後差出「這一批推到第幾級」給結算徽章用
    // （不能再呼叫一次 autoGrow——粉塵已經扣掉，第二次一定回空陣列）
    const grows = [...new Set(ids)].filter(id => transcendOf(next, id) > transcendOf(a, id))
      .map(id => ({ id, kind: 'transcend', from: transcendOf(a, id), to: transcendOf(next, id) }));   // kind 是結算徽章在分類用的（1.0 另有 promote）
    const gained = (next.universalDust || 0) - (a.universalDust || 0);
    return { state: next, accepted: true, newIds, starUps, grows, universalDust: gained };
  }
  // 第十輪 C 重走廢土：全線通行後重來一圈。保留收藏／隊伍／技能／券／戰績／外觀／引導；金幣、訓練、進度、王關狀態歸零
  function replay(a) {
    if (!a.cleared) throw new Error('全線通行之後才能重走廢土');
    if (lapsOf(a) >= RULES.LAP.MAX) throw new Error('已經重走 ' + RULES.LAP.MAX + ' 圈，到頂了');
    if (a.pending) throw new Error('還有沒收下的結果');
    // 第十一輪：王首勝的粉塵每一圈重算（重走廢土是「再打一次」，回饋感要跟著回來）
    return { ...a, laps: lapsOf(a) + 1, progress: 0, stage: null, coins: 0, teamLevel: 0, clickLevel: 0, bossFailed: null, cooldownUntil: 0, farmNextAt: 0, revisitAt: null, bossDust: [],
      cleared: false, endless: false, skillCd: [0, 0, 0, 0], fx: { clickLeft: 0, clickMul: 1, powerUntil: 0, powerMul: 1, mythic: false } };
  }
  // 無盡模式：全線通行後第 21 站起一直往下打（王固定是四種輪流），關掉時丟掉 20 站以後的戰鬥
  function setEndless(a, on) {
    if (on && !a.cleared) throw new Error('全線通行之後才能開無盡模式');
    // ⚠ 開無盡之前一定要先離開回顧：全線通行後場上常駐的那隻是回顧（revisitAt 有值），
    //   留著的話 UI 的自動接關會一直重開那一隻，無盡的第 21 站永遠打不到。
    if (on) a = leaveRevisit(a);
    return { ...a, endless: !!on, stage: !on && a.progress >= RULES.STATIONS ? null : a.stage };
  }
  // ---- 第十輪 D 離線與派遣
  // 算錢的那一站：目前這一站；王站、打完全線（沒開無盡）→ 往前找最近的一般站
  const incomeIndex = a => { let i = Math.min(a.progress || 0, (a.endless ? RULES.ENDLESS_MAX : RULES.STATIONS) - 1); while (i > 0 && isBoss(i)) i -= 1; return Math.max(0, i); };
  function offline(a, now) {
    const O = RULES.OFFLINE, seen = a.seenAt || 0, elapsed = seen > 0 ? Math.max(0, now - seen) : 0, p = power(a);
    if (elapsed < O.MIN_MS || !(p > 0)) return { state: { ...a, seenAt: now }, events: [] };
    const secs = Math.min(elapsed, O.MAX_MS) / 1000, i = incomeIndex(a);
    const kills = Math.floor(p * secs * O.SHARE / need(i, a)), earned = Math.floor(p * RULES.IDLE_COINS * secs * O.SHARE + kills * killReward(i, a));
    return { state: { ...a, coins: a.coins + earned, seenAt: now }, events: [{ type: 'offline', elapsed, secs, index: i, kills, earned }] };
  }
  const dispatchedApoc = (a, id) => (a.dispatch || []).some(d => d.id === id);
  function startDispatch(a, id, now) {
    if (!(a.collection[id] > 0)) throw new Error('還沒抽到這張');
    if (a.roster.includes(id)) throw new Error('隊伍裡的卡不能派遣，先移出隊伍');
    if (dispatchedApoc(a, id)) throw new Error('已經在派遣中');
    if ((a.dispatch || []).length >= RULES.DISPATCH.SLOTS) throw new Error('派遣位子滿了（' + RULES.DISPATCH.SLOTS + ' 個）');
    return { ...a, dispatch: [...(a.dispatch || []), { id, startedAt: now, until: now + RULES.DISPATCH.MS }] };
  }
  const dispatchCoins = (a, id) => Math.round(killReward(incomeIndex(a), a) * RULES.DISPATCH.KILLS * (RULES.DISPATCH.RARITY[poolById()[id]?.rarity] || 1));
  // 時間到的全部收回：金幣照收回當下的進度算（先派出去、之後打到後面的站，回來拿得比較多）
  function collectDispatch(a, now, rng = Math.random) {
    const done = (a.dispatch || []).filter(d => d.until <= now);
    if (!done.length) return { state: a, rewards: [] };
    let coins = 0, tickets = 0, dust = 0;
    // 第十一輪：派遣除了金幣與券，也帶萬用粉塵回來（稀有度越高帶越多，同 dispatchCoins 的倍率表）
    const rewards = done.map(d => { const c = dispatchCoins(a, d.id), t = rng() < RULES.DISPATCH.TICKET ? 1 : 0,
      u = Math.round(RULES.GROW.DISPATCH * (RULES.DISPATCH.RARITY[poolById()[d.id]?.rarity] || 1));
      coins += c; tickets += t; dust += u; return { id: d.id, coins: c, ticket: t, dust: u }; });
    return { state: { ...a, coins: a.coins + coins, tickets: a.tickets + tickets, universalDust: (a.universalDust || 0) + dust,
      dispatch: a.dispatch.filter(d => d.until > now), dispatchDone: (a.dispatchDone || 0) + done.length }, rewards };
  }
  // 第十一輪：畫面要畫星／突破／粉塵，這些都從 view 帶出去（UI 不直接讀存檔）
  const growView = a => ({
    stars: Object.fromEntries(Object.keys(a.collection || {}).filter(id => a.collection[id] > 0).map(id => [id, Math.max(1, starsAt(a, id))])),
    transcend: { ...(a.transcend || {}) }, dust: { ...(a.dust || {}) },
    universalDust: a.universalDust || 0, maxStars: maxStars(), fullDust: fullDust(),
  });
  const view = (a, now) => ({ ...growView(a), revisitAt: a.revisitAt ?? null, coins: Math.floor(a.coins), tickets: a.tickets, progress: a.progress, cooldownUntil: a.cooldownUntil, stage: a.stage, power: power(a) * powerMul(a, now),
    skillCd: a.skillCd, fx: a.fx, now, pending: a.pending || null, cleared: !!a.cleared,
    skillDefs: [0, 1, 2, 3].map(i => { const d = skillOf(a, i); return d ? { name: d.name, text: d.text, card: d.card.name, rarity: d.card.rarity } : null; }), canFight: canFight(a, now), need: a.progress < (a.endless ? RULES.ENDLESS_MAX : RULES.STATIONS) ? need(a.progress, a) : 0,
    drawCost1: drawCost(a, 1), drawCost10: drawCost(a, 10), paidDraws: a.paidDraws || 0,
    // 「下一抽付現要多少」——不看手上的券。drawCost1 有券時會算成 0（因為那一抽不用付），
    // 拿它去寫「下一抽 X」會印出 0（第十二輪修）。
    drawCostNext: Math.round(RULES.DRAW_COST * RULES.DRAW_GROWTH ** (a.paidDraws || 0)),
    teamLevel: a.teamLevel || 0, clickLevel: a.clickLevel || 0, teamCost: trainCost(a, 'team'), clickCost: trainCost(a, 'click'),
    teamMul: trainMul('team', a.teamLevel), clickMul: trainMul('click', a.clickLevel), tapDamage: power(a) * powerMul(a, now) * RULES.CLICK_SHARE * trainMul('click', a.clickLevel) * boostOf(a).click, boost: boostOf(a),
    exchangeToday: exchangeToday(a, now), exchangeTotal: a.exchange?.total || 0, stats: a.stats, wins: a.wins || 0, cosmetics: a.cosmetics,
    roster: a.roster, skills: a.skills, owned: Object.keys(a.collection).filter(id => a.collection[id] > 0), collection: a.collection, stations: RULES.STATIONS,
    dispatch: a.dispatch || [], dispatchSlots: RULES.DISPATCH.SLOTS, dispatchDone: a.dispatchDone || 0,
    laps: lapsOf(a), endless: !!a.endless, endlessBest: a.endlessBest || 0, lapHp: lapHp(a), lapPower: lapPower(a),
    canReplay: !!a.cleared && lapsOf(a) < RULES.LAP.MAX, nextLapHp: lapHp({ laps: Math.min(RULES.LAP.MAX, lapsOf(a) + 1) }), nextLapPower: lapPower({ laps: Math.min(RULES.LAP.MAX, lapsOf(a) + 1) }) });
  root.ApocEconomy = { RULES, fresh, normalize, gift, power, cardPower, need, reward, lapHp, lapPower, replay, setEndless, offline, incomeIndex, startDispatch, collectDispatch, dispatchCoins, isBoss, canFight, canFarm, canRevisit, revisit, leaveRevisit, fight, mechAt, bossInfo, tapMul, idleMul, settle, tap, tapDamage, drawn, addCards, setTeam, rosterCounts, rosterViolations, view,
    drawCost, exchangeCost, exchangeToday, exchange, train, trainCost, trainMul, buyCosmetic, wearCosmetic, rollPack, purchaseDraw, collectDraw, skillOf, canSkill, useSkill, powerMul,
    // 第十一輪 養成（DESIGN-2026-09-14-apoc-growth.md）
    starsOf, starsAt, maxStars, dustOf, availableDust, spentDust, transcendOf, transcendCost, canTranscend, autoGrow, isMaxed, dustRate, fullDust, starCap, exchangeDust, winDust };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ApocEconomy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
