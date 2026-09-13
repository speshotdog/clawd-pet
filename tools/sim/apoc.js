// 末世（2.0）節奏模擬器（2026-09-13 之後這一輪；第三輪改成「末世金幣直接抽卡＋訓練＋1.0 換券」）。
// 目的：量「20 站要打幾天」。真人模型照 1.0 模擬器的假設：一天三段 20 分鐘、每段連點 6 下/秒。
// ⚠ 末世**沒有離線收益**（tick 的 dt 上限 60 秒），所以只有在玩的時間會推進，
//   下線時間對進度完全沒有貢獻——這是它跟 1.0 最大的差別。
// 花錢策略：湊到十連就抽（先用券）；訓練只在「比十連便宜很多」的時候買（TRAIN_SHARE，預設 0.25）。
// 1.0 換券：ONE_P＝1.0 每秒收益、ONE_COINS＝1.0 存款；每段開始前把當天換得起的券換掉，段與段之間 1.0 補 6 小時離線。
// 用法：node tools/sim/apoc.js [場次分鐘=20] [每天場次=3] [天數=14]
//   環境變數可覆寫任何 RULES 頂層數字鍵：BASE_NEED=2400 GROWTH=1.19 node tools/sim/apoc.js
//   訓練：TEAM_MUL／TEAM_COST／TEAM_GROWTH、CLICK_MUL／CLICK_COST／CLICK_GROWTH；1.0：ONE_P=1e10 ONE_COINS=1e14
global.window = global;
(() => {
require('../../src/apoc/pool.js');
const A = require('../../src/clicker-apoc-economy.js');
const R = A.RULES;

const env = (k, d) => process.env[k] !== undefined ? Number(process.env[k]) : d;
for (const k of Object.keys(R)) if (process.env[k] !== undefined && typeof R[k] === 'number') R[k] = Number(process.env[k]);
for (const k of ['TAPS', 'GROWTH', 'IDLE_MUL', 'BREAK_MS', 'BREAK_MUL']) if (process.env['SHIELD_' + k] !== undefined) R.SHIELD[k] = Number(process.env['SHIELD_' + k]);
for (const [kind, pre] of [['team', 'TEAM'], ['click', 'CLICK']]) for (const k of ['MUL', 'COST', 'GROWTH']) R.TRAIN[kind][k] = env(`${pre}_${k}`, R.TRAIN[kind][k]);

const SESSION_MIN = Number(process.argv[2] || 20), SESSIONS = Number(process.argv[3] || 3), DAYS = Number(process.argv[4] || 14);
const TAPS_PER_SEC = 6, STEP = 1000;   // 一秒一格
let seed = 20260913;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function run(SESSION_MIN, SESSIONS, DAYS, { oneP = env('ONE_P', 0), oneCoins = env('ONE_COINS', 0), trainShare = env('TRAIN_SHARE', .25) } = {}) {
seed = 20260913;
let a = A.gift(A.normalize({ ...A.fresh(), unlocked: true }));
let now = 0, played = 0, draws = 0, bossFails = 0, done = null, exchanged = 0, one = oneCoins;
const log = [];
function spend() {
  // 真人不會等打完才抽：湊到十連就抽（戰鬥中也能抽）
  if (a.coins >= A.drawCost(a, 10)) { a = A.purchaseDraw(a, 10, now, rnd); a = A.collectDraw(a, a.pending.draw.id, now).state; draws += 10; }
  const cheap = A.drawCost({ ...a, tickets: 0 }, 10) * trainShare;
  for (const kind of ['click', 'team']) while (A.trainCost(a, kind) <= Math.min(a.coins, cheap)) a = A.train(a, kind).state;
}
for (let day = 1; day <= DAYS && !done; day++) {
  for (let s = 0; s < SESSIONS && !done; s++) {
    if (oneP > 0) for (;;) { const c = A.exchangeCost(a, oneP, now); if (!(c <= one)) break; const r = A.exchange(a, one, oneP, now); a = r.state; one -= r.cost; exchanged++; }
    for (let t = 0; t < SESSION_MIN * 60 && !done; t++) {
      now += STEP; played += 1;
      spend();
      if (!a.stage && A.canFight(a, now)) { try { a = A.fight(a, now); } catch {} }
      if (a.stage) {
        for (let k = 0; k < TAPS_PER_SEC; k++) a = A.tap(a, now);
        for (let slot = 0; slot < 4; slot++) if (A.canSkill(a, slot, now)) a = A.useSkill(a, slot, now);
      }
      const r = A.settle(a, now, 1); a = r.state;
      for (const ev of r.events) {
        if (ev.type === 'fail') bossFails++;
        if (ev.type === 'win') log.push({ station: ev.index + 1, min: Math.round(played / 60), day, power: Math.round(A.power(a)), owned: Object.keys(a.collection).length, draws, team: a.teamLevel, click: a.clickLevel });
      }
      if (a.progress >= R.STATIONS) done = { day, min: Math.round(played / 60) };
    }
    // 下線：末世沒有離線收益；1.0 那邊回桌邊一次補 6 小時離線
    now += 6 * 3600 * 1000; one += oneP * 6 * 3600;
  }
}
return { done, log, a, played, bossFails, draws, exchanged };
}
if (require.main !== module) { module.exports = { run, RULES: R }; return; }
const res = run(SESSION_MIN, SESSIONS, DAYS);
const { done, log, a: end, played: mins, bossFails: fails } = res;
console.log(`場次 ${SESSION_MIN} 分 × ${SESSIONS}／天　BASE_NEED=${R.BASE_NEED} GROWTH=${R.GROWTH} DRAW=${R.DRAW_COST}×${R.DRAW_GROWTH} TEAM=${JSON.stringify(R.TRAIN.team)} CLICK=${JSON.stringify(R.TRAIN.click)} ONE_P=${env('ONE_P', 0)}`);
console.log('站　 累計分鐘  第幾天  戰力      卡種  抽數  全隊Lv 點擊Lv');
for (const l of log) console.log(`${String(l.station).padStart(2)}   ${String(l.min).padStart(7)}  ${String(l.day).padStart(5)}   ${String(l.power).padStart(7)}  ${String(l.owned).padStart(4)}  ${String(l.draws).padStart(4)}  ${String(l.team).padStart(5)} ${String(l.click).padStart(6)}`);
console.log(done ? `\n全線 20 站：第 ${done.day} 天、累計遊玩 ${done.min} 分鐘（王關失敗 ${fails} 次、換到券 ${res.exchanged} 張）`
                 : `\n${DAYS} 天內沒打完，只到第 ${end.progress} 站（累計 ${Math.round(mins / 60)} 分鐘、戰力 ${Math.round(A.power(end))}、王關失敗 ${fails} 次）`);
})();
