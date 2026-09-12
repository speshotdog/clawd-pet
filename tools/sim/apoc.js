// 末世（2.0）節奏模擬器（2026-09-13 之後這一輪）。
// 目的：ApocEconomy.RULES 的第一版數字是猜的，要量「20 站要打幾天」。
// 真人模型照 1.0 模擬器的假設：一天三段 20 分鐘、每段連點 6 下/秒。
// ⚠ 末世**沒有離線收益**（tick 的 dt 上限 60 秒），所以只有在玩的時間會推進，
//   下線時間對進度完全沒有貢獻——這是它跟 1.0 最大的差別。
// 用法：node tools/sim/apoc.js [場次分鐘=20] [每天場次=3] [天數=14]
//   環境變數可覆寫任何 RULES 頂層鍵：BASE_NEED=2400 GROWTH=1.19 node tools/sim/apoc.js
global.window = global;
(() => {
require('../../src/apoc/pool.js');
const A = require('../../src/clicker-apoc-economy.js');
const R = A.RULES, POOL = globalThis.ApocPool;

for (const k of Object.keys(R)) if (process.env[k] !== undefined && typeof R[k] === 'number') R[k] = Number(process.env[k]);
for (const k of ['TAPS', 'GROWTH', 'IDLE_MUL', 'BREAK_MS', 'BREAK_MUL']) if (process.env['SHIELD_' + k] !== undefined) R.SHIELD[k] = Number(process.env['SHIELD_' + k]);

const SESSION_MIN = Number(process.argv[2] || 20), SESSIONS = Number(process.argv[3] || 3), DAYS = Number(process.argv[4] || 14);
const TAPS_PER_SEC = 6, STEP = 1000;   // 一秒一格
const RATES = [['mythic', .0025], ['legendary', .04], ['epic', .20], ['rare', .7575]];
const byRarity = {}; for (const c of POOL) (byRarity[c.rarity === 'common' ? 'rare' : c.rarity] ||= []).push(c.id);

let seed = 20260913;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function rollOne() {
  let r = rnd(), acc = 0;
  for (const [rarity, p] of RATES) { acc += p; if (r < acc) { const list = byRarity[rarity]; return list[Math.floor(rnd() * list.length)]; } }
  return byRarity.rare[0];
}

function run(SESSION_MIN, SESSIONS, DAYS) {
seed = 20260913;
let a = A.gift(A.normalize({ ...A.fresh(), unlocked: true }));
let now = 0, played = 0, draws = 0, bossFails = 0, done = null;
const log = [];
function drawIfRich() {
  // 有 10 張券就十連；沒券但買得起就先換券（券 1000 一張）
  while (a.tickets < 10 && a.coins >= A.ticketCost(a, 1)) a = A.buyTicket(a, 1);
  if (a.tickets >= 10) { a = A.drawn(a, Array.from({ length: 10 }, rollOne)); draws += 10; }
}
for (let day = 1; day <= DAYS && !done; day++) {
  for (let s = 0; s < SESSIONS && !done; s++) {
    for (let t = 0; t < SESSION_MIN * 60 && !done; t++) {
      now += STEP; played += 1;
      drawIfRich();   // 真人不會等打完才抽：湊到十連就抽（戰鬥中也能抽）
      if (!a.stage && A.canFight(a, now)) { try { a = A.fight(a, now); } catch {} }
      if (a.stage) {
        for (let k = 0; k < TAPS_PER_SEC; k++) a = A.tap(a, now);
        for (let slot = 0; slot < 4; slot++) if (A.canSkill(a, slot, now)) a = A.useSkill(a, slot, now);
      }
      const r = A.settle(a, now, 1); a = r.state;
      for (const ev of r.events) {
        if (ev.type === 'fail') bossFails++;
        if (ev.type === 'win') log.push({ station: ev.index + 1, min: Math.round(played / 60), day, power: Math.round(A.power(a)), owned: Object.keys(a.collection).length, draws });
      }
      if (a.progress >= R.STATIONS) done = { day, min: Math.round(played / 60) };
    }
    // 下線：末世沒有離線收益，時間不推進任何東西
    now += 6 * 3600 * 1000;
  }
}
return { done, log, a, played, bossFails, draws };
}
if (require.main !== module) { module.exports = { run, RULES: R }; return; }
const res = run(SESSION_MIN, SESSIONS, DAYS);
const { done, log, a: end, played: mins, bossFails: fails } = res;
const head = `場次 ${SESSION_MIN} 分 × ${SESSIONS}／天　BASE_NEED=${R.BASE_NEED} GROWTH=${R.GROWTH} BOSS_MUL=${R.BOSS_MUL} IDLE_COINS=${R.IDLE_COINS} CLICK_SHARE=${R.CLICK_SHARE} TICKET=${R.TICKET_COST}`;
console.log(head);
console.log('站　 累計分鐘  第幾天  戰力      卡種  抽數');
for (const l of log) console.log(`${String(l.station).padStart(2)}   ${String(l.min).padStart(7)}  ${String(l.day).padStart(5)}   ${String(l.power).padStart(7)}  ${String(l.owned).padStart(4)}  ${String(l.draws).padStart(4)}`);
console.log(done ? `\n全線 20 站：第 ${done.day} 天、累計遊玩 ${done.min} 分鐘（王關失敗 ${fails} 次）`
                 : `\n${DAYS} 天內沒打完，只到第 ${end.progress} 站（累計 ${Math.round(mins / 60)} 分鐘、戰力 ${Math.round(A.power(end))}、王關失敗 ${bossFails} 次）`);

})();
