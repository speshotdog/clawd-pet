// 點擊受擊特效（第七輪，兩個世界共用）。
// 使用者：「現在的點擊特效都不夠華麗，有辦法幫我強化嗎」「有沒有辦法做類似 Sakura Clicker 點擊噴出金幣的特效」，
// 看過 fx-demo 的 A／B／C 三版樣品後選「效果都不錯，都做」＋「兩個世界都套」→ 華麗版碎片＋噴金幣。
// 只負責畫布上的粒子（GachaFx scope）；浮字、震動、怪物壓扁由各世界自己做（DOM 結構不同）。
// 等級：0 一般點擊、1 爆擊／技能、2 破盾／拆完一包、3 擊倒。
window.ClickerHitFx = (() => {
  const rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
  const coinImg = new Image(); coinImg.src = 'clicker-coin.png';
  // 元素在畫布座標系裡的位置（畫布屬性是 960×640，實際顯示會被縮放；直式時盒子也不同，一律用 getBoundingClientRect 換）
  function box(canvas, el) {
    const c = canvas.getBoundingClientRect(), r = el.getBoundingClientRect();
    const kx = canvas.width / (c.width || 1), ky = canvas.height / (c.height || 1);
    return { left: (r.left - c.left) * kx, right: (r.right - c.left) * kx, top: (r.top - c.top) * ky, bottom: (r.bottom - c.top) * ky,
      cx: (r.left + r.width / 2 - c.left) * kx, cy: (r.top + r.height / 2 - c.top) * ky };
  }
  const SHARDS = [14, 26, 40, 56], STREAKS = [6, 12, 18, 26], STARS = [0, 5, 8, 12];
  // 華麗版碎片：碎片翻面＋放射光痕＋四芒星＋中心閃光＋衝擊波（破盾／擊倒再加一圈光環）
  function impact(fx, p, level, { spark = '#F2B233', shards = ['#8A6A48', '#9E4A34'], dark = '#2A1C12', u = 1 } = {}) {
    const L = Math.max(0, Math.min(3, level | 0));
    for (let i = 0; i < SHARDS[L]; i++) {
      const a = rand(0, TAU), sp = rand(120, 260 + L * 110) * u;
      fx.spawn({ shape: 'shard', x: p.x + rand(-12, 12) * u, y: p.y + rand(-10, 10) * u, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180 * u, g: 900 * u,
        life: rand(.5, .8 + L * .2), w: rand(8, 16 + L * 3) * u, h: rand(5, 10) * u, rot: rand(0, TAU), vr: rand(-14, 14), drag: .985,
        color: shards[i % shards.length], color2: dark, fadeK: 3 });
    }
    for (let i = 0; i < STREAKS[L]; i++) {
      const a = rand(0, TAU), sp = rand(360, 640 + L * 160) * u;
      fx.spawn({ shape: 'streak', x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300 * u, drag: .93, r: rand(2, 3.6 + L) * u,
        life: rand(.18, .32 + L * .06), color: i % 3 ? '#FFE7A6' : spark, shrink: true });
    }
    for (let i = 0; i < STARS[L]; i++) {
      const a = rand(0, TAU), sp = rand(90, 220) * u;
      fx.spawn({ sprite: 1, x: p.x + rand(-20, 20) * u, y: p.y + rand(-20, 20) * u, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * u, g: 120 * u, drag: .95,
        r: rand(10, 18 + L * 4) * u, life: rand(.4, .7), color: '#FFF3D0', shrink: true, rot: rand(0, TAU), vr: rand(-3, 3) });
    }
    fx.spawn({ sprite: 0, x: p.x, y: p.y, r: (40 + L * 26) * u, life: .16 + L * .04, color: '#FFE7A6', grow: true });
    fx.spawn({ sprite: 3, x: p.x, y: p.y, r: 30 * u, life: .28 + L * .06, color: spark, update(q) { q.r = (30 + (70 + L * 60) * (1 - q.life / q.max)) * u; } });
    if (L >= 2) fx.layer(fx.ring(p.x, p.y, '#FFE7A6', .45, (170 + L * 40) * u, 9 * u));
  }

  // 噴金幣：從落點往上噴 → 在舞台底部彈跳落地 → 停一下 → 被吸進錢包（抵達時錢包跳一下、冒幾顆小閃）
  // 連點每秒 8 下 × 2 枚＝16 枚／秒；上限 24 枚／秒，爆擊連發時不會把畫面灌滿金幣
  const PER_SECOND = 24;
  let budget = 0, budgetAt = 0, pulseAt = 0;
  // floor：落地線的元素（血條）。金幣停在它的上緣，不要壓在「第 N 站／N 包」與血量數字上（實機截圖看到的）
  function coins(fx, p, n, { canvas, stage, wallet, floor = null, u = 1 } = {}) {
    if (!canvas || !stage || !wallet || !(n > 0)) return;
    const now = performance.now();
    if (now - budgetAt > 1000) { budgetAt = now; budget = 0; }
    n = Math.min(n, PER_SECOND - budget); if (n <= 0) return; budget += n;
    const sb = box(canvas, stage), left = sb.left + 14 * u, right = sb.right - 14 * u;
    const fb = floor && floor.offsetParent !== null ? box(canvas, floor) : null;
    const ground = fb && fb.top > p.y ? fb.top - 12 * u : sb.bottom - 34 * u;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.05, 1.05), sp = rand(320, 560 + (n > 10 ? 180 : 0)) * u;
      fx.spawn({ img: coinImg, x: p.x + rand(-10, 10) * u, y: p.y + rand(-10, 10) * u, r: rand(11, 15) * u, life: 4, blend: 'source-over', fadeK: 99,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vr: rand(-10, 10), phase: 'air', bounces: 0, rest: rand(.28, .5) + i * .02, t: 0,
        update(q, dt) {
          if (q.phase === 'air') {
            q.vy += 1500 * u * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
            if (q.x < left) { q.x = left; q.vx = Math.abs(q.vx) * .6; }
            if (q.x > right) { q.x = right; q.vx = -Math.abs(q.vx) * .6; }
            if (q.y > ground && q.vy > 0) {
              q.y = ground; q.bounces++; q.vy = -q.vy * .42; q.vx *= .6; q.vr *= .5;
              if (q.bounces >= 3 || Math.abs(q.vy) < 80 * u) { q.phase = 'rest'; q.t = 0; q.vy = 0; }
            }
          } else if (q.phase === 'rest') {
            q.t += dt; q.rot *= .8; q.x += q.vx * dt; q.vx *= .85;
            if (q.t >= q.rest) {
              // 錢包的位置在起飛當下才量（視窗縮放、直式切換後也飛得準）
              const w = box(canvas, wallet);
              Object.assign(q, { phase: 'fly', t: 0, sx: q.x, sy: q.y, tx: w.cx, ty: w.cy, cx: (q.x + w.cx) / 2 + rand(-60, 60) * u, cy: Math.min(q.y, w.cy) - rand(40, 120) * u, dur: rand(.38, .55) });
            }
          } else {
            q.t += dt; const k = Math.min(1, q.t / q.dur), e = k * k;
            q.x = (1 - e) * (1 - e) * q.sx + 2 * (1 - e) * e * q.cx + e * e * q.tx;
            q.y = (1 - e) * (1 - e) * q.sy + 2 * (1 - e) * e * q.cy + e * e * q.ty;
            q.r = Math.max(7 * u, q.r - dt * 10 * u); q.rot += dt * 12;
            if (k >= 1) {
              q.life = .001;
              for (let j = 0; j < 3; j++) fx.spawn({ sprite: 14, x: q.tx + rand(-6, 6), y: q.ty + rand(-6, 6), vx: rand(-90, 90), vy: rand(-90, 40), g: 100, r: rand(5, 9), life: rand(.18, .3), color: '#FFE08A', shrink: true });
              const t = performance.now();
              if (t - pulseAt > 90) { pulseAt = t; wallet.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-8deg)' }, { transform: 'scale(1)' }], 150); }
            }
          }
        } });
    }
  }
  return { impact, coins, box, COINS: [2, 5, 8, 18] };
})();
