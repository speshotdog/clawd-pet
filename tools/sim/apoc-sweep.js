// 末世數值掃描：目標 20 站 ≈ 3～5 天（一天三段 20 分鐘＝實際遊玩 180～300 分鐘），
// 而且王關不要變成一道牆（王關失敗次數要很少）。用法：node tools/sim/apoc-sweep.js
function trial(over) {
  Object.assign(process.env, Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])));
  delete require.cache[require.resolve('./apoc.js')];
  delete require.cache[require.resolve('../../src/clicker-apoc-economy.js')];
  const { run } = require('./apoc.js');
  const A = require('../../src/clicker-apoc-economy.js');
  const r = run(20, 3, 40);
  const per = r.log.map((l, i) => l.min - (r.log[i - 1]?.min ?? 0));
  return { ...over, day: r.done?.day ?? null, min: r.done?.min ?? null, stop: r.a.progress,
           power: Math.round(A.power(r.a)), draws: r.draws, fails: r.bossFails,
           first: per[0] ?? null, last: per.at(-1) ?? null };
}
const rows = [];
for (const BASE_NEED of [300000, 450000, 600000])
  for (const GROWTH of [1.16, 1.20, 1.24])
    for (const TICKET_GROWTH of [1.005, 1.01, 1.02])
      for (const REWARD_SHARE of [0.02, 0.05])
        rows.push(trial({ BASE_NEED, GROWTH, TICKET_GROWTH, REWARD_SHARE }));
rows.sort((x, y) => (x.min ?? 1e9) - (y.min ?? 1e9));
console.log('BASE_NEED GROWTH 券漲 REWARD | 天 總分鐘 停 戰力 抽數 王敗 首站分 末站分');
for (const r of rows) console.log(
  `${String(r.BASE_NEED).padStart(7)} ${r.GROWTH} ${String(r.TICKET_GROWTH).padStart(5)} ${String(r.REWARD_SHARE).padStart(6)} | ${String(r.day ?? '-').padStart(2)} ${String(r.min ?? '-').padStart(5)} ${String(r.stop).padStart(2)} ${String(r.power).padStart(6)} ${String(r.draws).padStart(5)} ${String(r.fails).padStart(4)} ${String(r.first ?? '-').padStart(6)} ${String(r.last ?? '-').padStart(6)}`);
