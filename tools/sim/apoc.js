// 末世（2.0）節奏模擬器。
// 第六輪（使用者：王變門檻，「對照之前的參考遊戲，用等比的方式把時長降低」「約 1 小時」）起的玩家模型：
//   王輸了自動回前一站刷怪（A.fight(a, now, true)），「戰力推估夠了」才再挑戰（上次打掉 d 成 → 戰力要到上次的 1/d 倍）；
//   錢先抽十連（收藏還沒滿 DRAW_UNTIL 種），抽不起再買最便宜的訓練；技能格放戰力前 4 張、技能一好就放。
// 對照：Sakura Clicker（Clicker Heroes 換皮）一般玩家（每秒 3 下）到第 10／20／30／40／50 區是 2.5／12／34／108／326 分，
//   我們 5 個王站（第 4／8／12／16／20 站）目標是它的 1/6：0.4／1.9／5.7／18／54 分。
// 第十輪 D 起末世有離線收益（只賺錢不前進，RULES.OFFLINE）；OFFLINE=0 可以關掉對照。
// 用法：node tools/sim/apoc.js [場次分鐘=20] [每天場次=3] [天數=14]
//   玩家節奏：CPS（在戰鬥中每秒點幾下）、TAP_SHARE（在場時間裡真的在點的比例）、SKILLS=0（不放技能）、ONE_BOOST（1.0 加成的戰力倍率）
//   數字：任何 RULES 頂層數字鍵（BASE_NEED=2000 GROWTH=1.9 REWARD_SHARE=.1…）、BOSS_MULS=2,3,4,5,6、
//         TEAM_MUL／TEAM_COST／TEAM_GROWTH、CLICK_*、DRAW_UNTIL；1.0 換券 ONE_P／ONE_COINS
global.window = global;
(() => {
require('../../src/apoc/pool.js');
const A = require(process.env.LOOP_BASELINE === '1' ? '../../_art/out/v3-apoc-loop/economy-before.js' : '../../src/clicker-apoc-economy.js');
const R = A.RULES;
if (R.LOOP && process.env.LOOP_CHEST_MAX !== undefined) R.LOOP.CHEST_MAX = Number(process.env.LOOP_CHEST_MAX);

const env = (k, d) => process.env[k] !== undefined ? Number(process.env[k]) : d;
for (const k of Object.keys(R)) if (process.env[k] !== undefined && typeof R[k] === 'number') R[k] = Number(process.env[k]);
if (process.env.BOSS_MULS) R.BOSS_MULS = process.env.BOSS_MULS.split(',').map(Number);
// 第十輪王關機制：MECH_IDLE_MUL／MECH_BREAK_MUL…覆寫 BOSS_MECH 頂層數字；ACC＝玩家踩中拍子／點對部位的機率
for (const k of ['IDLE_MUL', 'BREAK_MS', 'BREAK_MUL', 'ROTATE_MS']) if (process.env['MECH_' + k] !== undefined) R.BOSS_MECH[k] = Number(process.env['MECH_' + k]);
// 第十輪 D：DISPATCH=0 關掉派遣；DISPATCH_KILLS／DISPATCH_TICKET 覆寫派遣收益
// 第十一輪：養成旋鈕 PITY_AT（保底門檻）、BOSS_DUST（五隻王首勝的萬用粉塵，逗號分隔）
if (process.env.PITY_AT !== undefined) R.GROW.PITY.AT = Number(process.env.PITY_AT);
// 六型技能：CAP_BOSS／CAP_NORMAL 覆寫單下傷害盾牌
if (process.env.CAP_BOSS !== undefined) R.TAP_CAP.BOSS = Number(process.env.CAP_BOSS);
// 節流旋鈕：DAILY_KILLS／DAILY_AFTER／DAILY_DRAWS／DRAW_SURCHARGE／TRAIN_GATE_PER
for (const [k, path] of [['DAILY_KILLS', ['DAILY', 'FULL_KILLS']], ['DAILY_AFTER', ['DAILY', 'AFTER']], ['DAILY_DRAWS', ['DAILY', 'DRAWS']], ['DRAW_SURCHARGE', ['DAILY', 'DRAW_SURCHARGE']], ['TRAIN_GATE_PER', ['TRAIN_GATE', 'PER_STATION']], ['DAILY_STATIONS', ['DAILY', 'STATIONS']]]) if (process.env[k] !== undefined && R[path[0]]) R[path[0]][path[1]] = Number(process.env[k]);
if (process.env.CAP_NORMAL !== undefined) R.TAP_CAP.NORMAL = Number(process.env.CAP_NORMAL);
if (process.env.BOSS_DUST) R.GROW.BOSS = process.env.BOSS_DUST.split(',').map(Number);
if (process.env.DISPATCH_KILLS !== undefined) R.DISPATCH.KILLS = Number(process.env.DISPATCH_KILLS);
if (process.env.DISPATCH_TICKET !== undefined) R.DISPATCH.TICKET = Number(process.env.DISPATCH_TICKET);
for (const [kind, pre] of [['team', 'TEAM'], ['click', 'CLICK']]) for (const k of ['MUL', 'COST', 'GROWTH']) R.TRAIN[kind][k] = env(`${pre}_${k}`, R.TRAIN[kind][k]);

const SESSION_MIN = Number(process.argv[2] || 20), SESSIONS = Number(process.argv[3] || 3), DAYS = Number(process.argv[4] || 14);
const TAPS_PER_SEC = env('CPS', 6), USE_SKILLS = env('SKILLS', 1) > 0, TAP_SHARE = env('TAP_SHARE', 1), DRAW_UNTIL = env('DRAW_UNTIL', 60), ACC = env('ACC', .7);
// KEEP=1：全線通行不收工；LOOP=1（預設）重走到 10 圈再接無盡，LOOP=0 沿用直接進無盡的基準玩法。
// LOOP_BASELINE=1 載入 _art/out/v3-apoc-loop/economy-before.js（修改前快照）；LOOP_CHEST_MAX 可比較寶箱上限。
// 這個模式下 DRAW_UNTIL 失效——玩家會一直抽下去，因為抽卡是唯一的養成來源。
const KEEP = env('KEEP', 0) > 0;
const SEED = env('SEED', 20260913);   // 換抽卡運氣：門檻對抽到什麼很敏感，定案前要多跑幾個種子
let seed = SEED;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const MARKS_ON = env('MARKS', 0) > 0, K = { blessing: env('K_BLESS', .02), tap: env('K_TAP', .02) }, CAP = env('MARKS_CAP', 150);
function run(SESSION_MIN, SESSIONS, DAYS, { oneP = env('ONE_P', 0), oneCoins = env('ONE_COINS', 0) } = {}) {
seed = SEED;
let a = A.gift(A.normalize({ ...A.fresh(), unlocked: true }));
// 印記重設計（2026-09-15）：MARKS=1 打開印記模型——入場帶 START_MARKS 枚、2.0 里程碑／重走照 RULES.MARKS 入帳、
// 印記一到手就砸「收益」「攻擊」兩條神器（最壞情況：全拿去買戰力），倍率照 ARTIFACT_APOC（戰力每級 +2%）。
let marks = env('START_MARKS', 0), claimed = marks, bless = 0, tapLv = 0, spentLog = [];
const boostNow = () => ({ power: env('ONE_BOOST', 1) * (MARKS_ON ? 1 + K.blessing * bless : 1), click: env('ONE_CLICK', 1) * (MARKS_ON ? 1 + K.tap * tapLv : 1), skill: env('ONE_SKILL', 1), cd: env('ONE_CD', 1), slot4: env('SLOT4', 1) > 0 });
function buyArtifacts() { for (;;) { const next = bless <= tapLv ? 'bless' : 'tap', lv = (next === 'bless' ? bless : tapLv) + 1; if (lv > 20 || marks < lv) break; marks -= lv; if (next === 'bless') bless = lv; else tapLv = lv; } }
if (MARKS_ON) buyArtifacts();
a = { ...a, boost: boostNow() };
let now = 0, played = 0, draws = 0, bossFails = 0, farms = 0, done = null, exchanged = 0, one = oneCoins, lastFail = null, dispatched = 0;
let lapStart = 0, lapTimes = [];
let stop = false, collectedAt = null, maxedAt = null, fullyMaxedAt = null, day = 0;
const dustFrom = { boss: 0, endless: 0, dispatch: 0, draw: 0, chest: 0 };   // 萬用粉塵的四個來源（驗收判準：王要佔 15～30%）
const mark = () => {
  const all = (global.ApocPool || []);
  if (!collectedAt && all.length && all.every(c => a.collection[c.id] > 0)) collectedAt = { day, min: Math.round(played / 60) };
  if (!maxedAt && all.length && all.every(c => A.isMaxed(a, c.id))) maxedAt = { day, min: Math.round(played / 60) };
  if (!fullyMaxedAt && all.length && A.isFullyMaxed && all.every(c => A.isFullyMaxed(a, c.id))) fullyMaxedAt = { day, min: Math.round(played / 60) };
};
const log = [];
// 第十一輪：萬用粉塵的花法。價值守恆（換出去與換進來同一張匯率表），所以「花在誰身上」不影響總量，
// 只影響戰力長得快不快——玩家模型就先餵隊上的卡（有戰力），隊上都滿養了再去補卡冊（純收集）。
const ALL = () => (global.ApocPool || []);
function spendDust() {
  A.autoGrow(a, ALL().map(c => c.id));
  for (;;) {
    // ⚠ 兌換所只補「已經抽到過」的卡（使用者退掉了「沒有的卡也能換」），沒抽到的一律跳過
    const inTeam = a.roster.filter(id => a.collection[id] > 0 && (A.exchangeCapacity ? A.exchangeCapacity(a, id) > 0 : !A.isMaxed(a, id)));
    const rest = ALL().map(c => c.id).filter(id => a.collection[id] > 0 && (A.exchangeCapacity ? A.exchangeCapacity(a, id) > 0 : !A.isMaxed(a, id)) && !a.roster.includes(id));
    // 隊上：先餵匯率低的（同樣一顆萬用粉塵，換便宜的卡拿到的粉塵一樣多，但便宜的卡先滿養才能早點溢出）
    const pick = [...inTeam, ...rest].sort((x, y) => A.dustRate(x) - A.dustRate(y))
      .find(id => (a.universalDust || 0) >= A.dustRate(id));
    if (!pick) break;
    a = A.exchangeDust(a, pick, 1).state;
  }
}
function spend() {
  spendDust();
  for (;;) {
    if (!a.pending && a.coins >= A.drawCost(a, 10, now) && (KEEP || Object.keys(a.collection).length < DRAW_UNTIL)) {
      a = A.purchaseDraw(a, 10, now, rnd);
      { const r = A.collectDraw(a, a.pending.draw.id, now); dustFrom.draw += r.universalDust || 0; a = r.state; }
      draws += 10;
      const top = [...a.roster].sort((x, y) => A.cardPower(a, y) - A.cardPower(a, x)).slice(0, 4);
      a = A.setTeam(a, a.roster, top); continue;
    }
    // 節流：訓練上限跟站數綁（A.trainCap），到頂的那一種就不練、換另一種；兩種都到頂就留著錢
    const cap = A.trainCap ? A.trainCap(a) : Infinity;
    const kinds = ['team', 'click'].filter(k => (a[k === 'team' ? 'teamLevel' : 'clickLevel'] || 0) < cap).sort((x, y) => A.trainCost(a, x) - A.trainCost(a, y));
    const kind = kinds[0];
    if (kind && a.coins >= A.trainCost(a, kind)) { a = A.train(a, kind).state; continue; }
    break;
  }
}
for (day = 1; day <= DAYS && !stop; day++) {
  for (let s = 0; s < SESSIONS && !stop; s++) {
    // 第十輪 D 派遣：每場開頭收回到期的、把隊外的卡（稀有度高的先）派滿位子（Codex 10D 值得修：平衡要算進派遣）
    if (env('DISPATCH', 1) > 0) {
      { const r = A.collectDispatch(a, now, rnd); dustFrom.dispatch += r.rewards.reduce((x, y) => x + (y.dust || 0), 0); a = r.state; }
      const RANKS = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 }, pool = Object.fromEntries((global.ApocPool || []).map(c => [c.id, c]));
      const idle = Object.keys(a.collection).filter(id => a.collection[id] > 0 && !a.roster.includes(id) && !(a.dispatch || []).some(d => d.id === id))
        .sort((x, y) => (RANKS[pool[x]?.rarity] ?? 9) - (RANKS[pool[y]?.rarity] ?? 9));
      for (const id of idle) { if ((a.dispatch || []).length >= R.DISPATCH.SLOTS) break; a = A.startDispatch(a, id, now); dispatched++; }
    }
    if (oneP > 0) for (;;) { const c = A.exchangeCost(a, oneP, now); if (!(c <= one)) break; const r = A.exchange(a, one, oneP, now); a = r.state; one -= r.cost; exchanged++; }
    for (let t = 0; t < SESSION_MIN * 60 && !stop; t++) {
      now += 1000; played += 1;
      spend();
      if (!a.stage) {
        const i = a.progress, ready = !lastFail || lastFail.i !== i || A.power(a) >= lastFail.power / Math.max(.05, lastFail.dealt);
        if (A.isBoss(i) && a.bossFailed === i && (!A.canFight(a, now) || !ready)) { a = A.fight(a, now, true); farms++; }
        else if (A.canFight(a, now)) a = A.fight(a, now);
        // 節流：今天推進到頂了 → 真人會回顧前一站刷錢（常駐式），模擬也照做，不然這段時間會被算成發呆
        else if (A.dayCapped && A.dayCapped(a, now) && A.revisit && a.progress > 0 && now >= (a.farmNextAt || 0)) { try { a = A.revisit(a, now, A.incomeIndex(a), { walk: false }); farms++; } catch { /* 沒得回顧就等 */ } }
      }
      if (a.stage) {
        // 打王一定會點（60 秒而已）；TAP_SHARE 只套在一般站與刷怪。
        // ⚠ 以前一律「點 50 秒停 50 秒」：王關整場落在停手那段 → 打掉比例很低 → 推估要戰力 ×20 才再挑戰 → 卡在刷怪幾十分鐘，數字忽大忽小
        // 一秒內的幾下平均分開點（節拍要看時間點）；扛槌兔時 ACC 機率踩在拍子上，雞頭合成怪時 ACC 機率點對亮的部位
        // Codex 第十輪 A 值得修：點擊時間一定遞增；節拍命中＝等到下一個拍點才點（這一秒內沒有拍點就算沒踩到），
        //   沒命中＝落在兩拍中間；部位點錯一定是別顆（以前三分之一機率「失誤卻點對」）
        if (a.stage.boss || t % 100 < TAP_SHARE * 100) { let prev = now - 1000;
          for (let k = 0; k < TAPS_PER_SEC && a.stage; k++) {
            let at = Math.max(prev + 1, now - 1000 + (k + .5) * 1000 / TAPS_PER_SEC);
            const info = A.bossInfo(a.stage, at), s0 = a.stage.startedAt || 0;
            if (info && info.mech === 2) {
              const ms = info.beatMs, next = s0 + Math.ceil((at - s0) / ms) * ms;
              if (rnd() < ACC && next <= now) at = next;
              else { const ph = ((at - s0) % ms + ms) % ms; if (Math.min(ph, ms - ph) <= (A.mechRules ? A.mechRules(a) : R.BOSS_MECH).RHYTHM.WINDOW) at = s0 + Math.floor((at - s0) / ms) * ms + ms / 2; if (at <= prev) at = prev + 1; }
            }
            let part;
            if (info && info.mech === 3) { const parts = R.BOSS_MECH.ORDER.PARTS, wrong = parts.filter(x => x !== info.nextPart); part = rnd() < ACC ? info.nextPart : wrong[Math.floor(rnd() * wrong.length)]; }
            at = Math.min(now, Math.max(at, s0)); prev = at;
            a = A.tap(a, at, { part });
          }
        }
        if (USE_SKILLS) {
          const slots = [0, 1, 2, 3];
          if (a.stage?.boss) { const order = ['train', 'breach', 'open', 'coin', 'idle', 'reset']; slots.sort((x, y) => order.indexOf(A.skillOf(a, x)?.role) - order.indexOf(A.skillOf(a, y)?.role)); }
          for (const slot of slots) if (A.canSkill(a, slot, now)) a = A.useSkill(a, slot, now);
        }
      }
      const st = a.stage, r = A.settle(a, now, 1, rnd); a = r.state;
      if (MARKS_ON) { const m = A.markMilestones(a); if (m.gained) { const got = Math.min(m.gained, Math.max(0, CAP - claimed)); marks += got; claimed += got; a = m.state; buyArtifacts(); spentLog.push({ day, notes: m.notes, bless, tapLv }); } a = { ...a, boost: boostNow() }; }
      for (const ev of r.events) if (ev.type === 'dust') dustFrom[ev.boss ? 'boss' : 'endless'] += ev.amount;
      if (r.events.some(e => e.type === 'dust')) spendDust();   // 打王／無盡掉的粉塵當場換掉
      for (const ev of r.events) {
        if (ev.type === 'fail') { bossFails++; lastFail = { i: ev.index, power: A.power(a), dealt: 1 - st.hp / st.need }; }
        if (ev.type === 'win') { lastFail = null; log.push({ station: ev.index + 1, min: +(played / 60).toFixed(1), day, power: Math.round(A.power(a)), owned: Object.keys(a.collection).length, draws, team: a.teamLevel, click: a.clickLevel }); }
      }
      if (r.events.some(e=>e.type==='cleared')) { lapTimes.push({lap:a.laps,minutes:+((played-lapStart)/60).toFixed(1)}); lapStart=played; }
      for (const ev of r.events) if(ev.type==='cleared' && ev.entry) dustFrom.chest += ev.entry.dust;
      if (A.swapMutation && a.bossStreak?.fails>=3 && !a.rerolled && a.mutations?.length && (!a.stage || a.stage.farm)) a=A.swapMutation(a,a.mutations.find(id=>!R.MUTATIONS.find(m=>m.id===id).positive)||a.mutations[0],rnd);
      if (A.dropMutation && a.bossStreak?.fails>=6 && !a.dropped && a.mutations?.length && (!a.stage || a.stage.farm)) a=A.dropMutation(a,a.mutations.find(id=>!R.MUTATIONS.find(m=>m.id===id).positive)||a.mutations[0]);
      mark();
      if (a.progress >= R.STATIONS) {
        if (!done) done = { day, min: Math.round(played / 60) };
        if (KEEP) { if (env('LOOP',1)>0 && a.laps<R.LAP.MAX) { a=A.replay(a,now,rnd); lastFail=null; } else if (!a.endless) a = A.setEndless(a, true); } else stop = true;
      }
    }
    now += 6 * 3600 * 1000; one += oneP * 6 * 3600;   // 下線 6 小時；1.0 那邊回桌邊一次補 6 小時離線
    if (env('OFFLINE', 1) > 0) a = A.offline(a, now).state;   // 第十輪 D：末世離線收益（OFFLINE=0 關掉對照）
  }
}
return { done, log, a, played, lapTimes, bossFails, farms, draws, exchanged, dispatched, collectedAt, maxedAt, fullyMaxedAt, dustFrom, marks: { marks, claimed, bless, tapLv, spentLog } };
}
if (require.main !== module) { module.exports = { run, RULES: R }; return; }
const res = run(SESSION_MIN, SESSIONS, DAYS);
const { done, log, a: end, played: secs, bossFails: fails } = res;
if (MARKS_ON) console.log(`印記模型：入場 ${env('START_MARKS', 0)} 枚，累計 ${res.marks.claimed}，收益祝福 L${res.marks.bless}、攻擊 L${res.marks.tapLv}，最後倍率 ×${(1 + K.blessing * res.marks.bless).toFixed(2)}／×${(1 + K.tap * res.marks.tapLv).toFixed(2)}`);
if (res.collectedAt || res.maxedAt) console.log(`全收集：${res.collectedAt ? '第 ' + res.collectedAt.day + ' 天' : '沒到'}；全滿養：${res.maxedAt ? '第 ' + res.maxedAt.day + ' 天' : '沒到'}`);
console.log(`場次 ${SESSION_MIN} 分 × ${SESSIONS}／天　BASE_NEED=${R.BASE_NEED} GROWTH=${R.GROWTH} BOSS_MULS=${R.BOSS_MULS} REWARD=${R.REWARD_SHARE}×${R.REWARD_GROWTH} TEAM=${JSON.stringify(R.TRAIN.team)} CLICK=${JSON.stringify(R.TRAIN.click)}`);
console.log('站　 累計分鐘  第幾天  戰力          卡種  抽數  全隊Lv 點擊Lv');
for (const l of log) console.log(`${String(l.station).padStart(2)}   ${String(l.min).padStart(7)}  ${String(l.day).padStart(5)}   ${String(l.power).padStart(11)}  ${String(l.owned).padStart(4)}  ${String(l.draws).padStart(4)}  ${String(l.team).padStart(5)} ${String(l.click).padStart(6)}`);
console.log(`輪迴：第 ${end.laps} 圈；每圈分鐘 ${JSON.stringify(res.lapTimes)}；寶箱合計 ${end.lapChest||0}；粉塵来源 ${JSON.stringify(res.dustFrom)}`);
console.log(`輪迴滿養：${res.fullyMaxedAt ? '第 ' + res.fullyMaxedAt.day + ' 天' : DAYS + ' 天內未達'}（兩週滿養仍以突破 5 級計）`);
console.log('圈內戰鬥紀錄：'+JSON.stringify(end.lapLog||[]));
const boss = [4, 8, 12, 16, 20].map(s => log.find(l => l.station === s)?.min ?? '-').join('／');
console.log(done ? `\n全線 20 站：第 ${done.day} 天、累計遊玩 ${done.min} 分鐘（王站 ${boss} 分、王關失敗 ${fails} 次、刷怪 ${res.farms} 場、換到券 ${res.exchanged} 張、派遣 ${res.dispatched} 次）`
                 : `\n${DAYS} 天內沒打完，只到第 ${end.progress} 站（累計 ${Math.round(secs / 60)} 分鐘、戰力 ${Math.round(A.power(end))}、王關失敗 ${fails} 次）`);
})();
