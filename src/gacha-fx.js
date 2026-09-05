// ClawdPet 抽卡 ─ Canvas 特效層（粒子／射線／塵）
// 只有在有活動特效時才跑 rAF；桌上沒事的時候這層完全靜止，不吃 CPU。
window.GachaFx = (() => {
  let canvas, ctx, W, H;
  let under = null;      // 卡底下那層（射線用）
  const parts = [];      // 粒子
  const layers = [];     // 長效層（射線等），每個有 update(dt)/draw() 與 dead
  let running = false;
  let last = 0;

  const RC = {
    common: '#9d9d9d', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000',
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  function init(el, underEl) {
    canvas = el; ctx = el.getContext('2d');
    W = el.width; H = el.height;
    under = underEl ? underEl.getContext('2d') : ctx;
  }

  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    ctx.clearRect(0, 0, W, H);
    if (under !== ctx) under.clearRect(0, 0, W, H);
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      l.update(dt);
      if (l.dead) { layers.splice(i, 1); continue; }
      l.draw(l.under ? under : ctx);
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.update) p.update(p, dt);
      else {
        p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      drawPart(p);
    }
    if (parts.length || layers.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); if (under !== ctx) under.clearRect(0, 0, W, H); }
  }

  function drawPart(p) {
    const k = p.life / p.max;
    ctx.save();
    ctx.globalCompositeOperation = p.blend || 'lighter';
    ctx.globalAlpha = Math.min(1, k * (p.fadeK || 1.6));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'shard') {
      // 鋁箔碎片：長方形，正反面用亮暗兩色模擬翻面
      const face = Math.cos(p.rot * 2) > 0 ? p.color : p.color2;
      ctx.fillStyle = face;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else if (p.shape === 'star') {
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * p.r * 0.32, Math.sin(a + Math.PI / 4) * p.r * 0.32);
      }
      ctx.closePath(); ctx.fill();
    } else if (p.shape === 'streak') {
      ctx.strokeStyle = p.color; ctx.lineWidth = p.r; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 0.04, -p.vy * 0.04); ctx.stroke();
    } else {
      const r = p.r * (p.shrink ? k : 1);
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = p.glow; }
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.2, r), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function spawn(p) {
    parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0.985, rot: 0, vr: 0, r: 2, life: 1, color: '#fff' }, p, { max: p.life }));
  }

  // ---------- 撕包爆光：火花 + 鋁箔碎片 ----------
  function packBurst(x, y) {
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), sp = rand(120, 620);
      spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 420, drag: 0.975,
        r: rand(1.2, 3.2), life: rand(0.5, 1.1), color: Math.random() < 0.5 ? '#ffe7a6' : '#ffb866', glow: 6, shrink: true, shape: 'streak' });
    }
    const foil = ['#1f8a99', '#12475a', '#d08a4a', '#f0b26a', '#2b3f7a'];
    const foilDark = ['#0d3f48', '#082530', '#7a4a20', '#8a5a2a', '#141f40'];
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU), sp = rand(80, 380);
      const ci = Math.floor(rand(0, foil.length));
      spawn({ x: x + rand(-30, 30), y: y + rand(-60, 60), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, g: 900, drag: 0.985,
        rot: rand(0, TAU), vr: rand(-12, 12), w: rand(6, 16), h: rand(4, 10), life: rand(0.9, 1.6), color: foil[ci], color2: foilDark[ci], shape: 'shard', fadeK: 3 });
    }
    // 光暈環
    layers.push(ring(x, y, '#ffe7a6', 0.55, 380, 10));
    kick();
  }

  // ---------- 環形衝擊波 ----------
  function ring(x, y, color, dur, maxR, width) {
    let t = 0;
    return {
      dead: false,
      update(dt) { t += dt; if (t >= dur) this.dead = true; },
      draw(ctx) {
        const k = t / dur, e = 1 - Math.pow(1 - k, 3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = color; ctx.lineWidth = width * (1 - k * 0.6);
        ctx.shadowColor = color; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(x, y, 10 + e * maxR, 0, TAU); ctx.stroke();
        ctx.restore();
      },
    };
  }

  // ---------- 揭曉：依稀有度 ----------
  function reveal(x, y, rarity) {
    const c = RC[rarity] || RC.common;
    if (rarity === 'common') {
      // 幾顆灰塵掉下來就好
      for (let i = 0; i < 8; i++) {
        spawn({ x: x + rand(-40, 40), y: y + rand(-60, 20), vx: rand(-30, 30), vy: rand(-40, 10), g: 200, r: rand(1, 2), life: rand(0.4, 0.8), color: '#cfcfcf', blend: 'source-over', fadeK: 1 });
      }
      kick(); return;
    }
    if (rarity === 'rare') {
      layers.push(ring(x, y, c, 0.5, 160, 6));
      for (let i = 0; i < 26; i++) {
        const a = rand(0, TAU), sp = rand(60, 260);
        spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 260, r: rand(1.5, 3.5), life: rand(0.5, 1), color: Math.random() < 0.6 ? '#7fc0ff' : '#ffffff', glow: 8, shrink: true, shape: 'star', rot: rand(0, TAU), vr: rand(-4, 4) });
      }
      kick(); return;
    }
    if (rarity === 'epic') {
      layers.push(ring(x, y, c, 0.6, 260, 8));
      layers.push(ring(x, y, '#e2b6ff', 0.45, 160, 4));
      // 一圈旋著往外散的紫光，像被吸出去再甩開
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * TAU, sp = rand(140, 330);
        spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.94, r: rand(2, 4), life: rand(0.7, 1.2), color: Math.random() < 0.5 ? c : '#e2b6ff', glow: 12, shrink: true,
          update(p, dt) { const ang = Math.atan2(p.vy, p.vx) + dt * 2.2; const s = Math.hypot(p.vx, p.vy) * p.drag; p.vx = Math.cos(ang) * s; p.vy = Math.sin(ang) * s; p.x += p.vx * dt; p.y += p.vy * dt; } });
      }
      for (let i = 0; i < 14; i++) {
        spawn({ x: x + rand(-50, 50), y: y + rand(-70, 70), vx: rand(-20, 20), vy: rand(-90, -40), g: -30, r: rand(2, 4), life: rand(0.9, 1.6), color: '#ffffff', glow: 10, shape: 'star', rot: rand(0, TAU), vr: rand(-3, 3) });
      }
      kick(); return;
    }
    // 傳說：一圈貼卡的衝擊波、外緣火星、少量餘燼與星芒——中央留給立繪，不用大環蓋全桌
    layers.push(ring(x, y, '#ffd27a', 0.55, 220, 8));
    for (let i = 0; i < 40; i++) {
      const a = rand(0, TAU), sp = rand(150, 600);
      spawn({ x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 100, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, g: 500, drag: 0.972, r: rand(1.5, 3.5), life: rand(0.7, 1.5), color: Math.random() < 0.5 ? '#ffd27a' : c, glow: 8, shrink: true, shape: 'streak' });
    }
    for (let i = 0; i < 20; i++) {
      spawn({ x: x + rand(-90, 90), y: y + rand(-40, 110), vx: rand(-15, 15), vy: rand(-70, -25), g: -25, r: rand(1.5, 3), life: rand(1.6, 3), color: Math.random() < 0.7 ? '#ff9a3c' : '#ffe7a6', glow: 10, shrink: true, fadeK: 1.2,
        update(p, dt) { p.vx += Math.sin(p.life * 7 + p.x) * 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } });
    }
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), sp = rand(120, 220);
      spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 80, drag: 0.97, r: rand(4, 8), life: rand(1, 1.8), color: '#fff3d0', glow: 16, shape: 'star', rot: rand(0, TAU), vr: rand(-2, 2), shrink: true });
    }
    kick();
  }

  // ---------- 傳說射線：從卡後方放射、緩慢旋轉的橘光，fadeIn → 停留 → fadeOut ----------
  // 回傳的物件有 stop()，讓流程在揭曉後把它慢慢收掉
  function rays(x, y, { color = '#ff8000', n = 14, len = 900, fadeIn = 0.5, hold = 0.6 } = {}) {
    hold = Number.isFinite(hold) ? Math.min(hold, 4) : 0.6;
    let t = 0, rot = rand(0, TAU), alpha = 0, stopping = false, fadeOut = 0;
    const layer = {
      dead: false,
      under: true,
      stop(dur = 0.8) { stopping = true; fadeOut = dur; },
      update(dt) {
        t += dt; rot += dt * 0.35;
        if (stopping) { alpha -= dt / fadeOut; if (alpha <= 0) this.dead = true; }
        else alpha = Math.min(1, t / fadeIn);
        if (t > hold && !stopping) this.stop();
      },
      draw(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, y);
        // 底光
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
        g.addColorStop(0, `rgba(255,190,90,${0.55 * alpha})`);
        g.addColorStop(1, 'rgba(255,128,0,0)');
        ctx.fillStyle = g; ctx.fillRect(-300, -300, 600, 600);
        // 射線：兩組不同轉速、不同寬度疊在一起，才不會像轉盤
        for (let set = 0; set < 2; set++) {
          const r = rot * (set ? -0.6 : 1) + set * 0.3;
          const count = set ? n - 3 : n;
          for (let i = 0; i < count; i++) {
            const a = r + (i / count) * TAU;
            const w = (set ? 0.05 : 0.09) * (0.7 + 0.3 * Math.sin(t * 2.3 + i * 1.7));
            const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
            grad.addColorStop(0, `rgba(255,210,120,${(set ? 0.28 : 0.42) * alpha})`);
            grad.addColorStop(0.5, `rgba(255,128,0,${0.14 * alpha})`);
            grad.addColorStop(1, 'rgba(255,128,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
            ctx.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
            ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      },
    };
    layers.push(layer);
    kick();
    return layer;
  }

  // ---------- 化塵：卡碎成金粉，沿弧線飛向塵計數器 ----------
  function dustStream(x, y, tx, ty, { n = 46, onArrive } = {}) {
    let arrived = 0;
    for (let i = 0; i < n; i++) {
      const delay = rand(0, 0.35);
      const sx = x + rand(-60, 60), sy = y + rand(-90, 90);
      const cx = (sx + tx) / 2 + rand(-160, 160), cy = Math.min(sy, ty) - rand(60, 220);
      const dur = rand(0.75, 1.2);
      spawn({ x: sx, y: sy, r: rand(1.5, 3.2), life: delay + dur + 0.05, color: Math.random() < 0.7 ? '#ffd24a' : '#fff6c8', glow: 8, fadeK: 8,
        t0: delay, dur, sx, sy, cx, cy,
        update(p, dt) {
          const el = p.max - p.life;
          if (el < p.t0) { p.x = p.sx + rand(-1, 1); p.y = p.sy - (el / p.t0) * 8; return; }
          const k = Math.min(1, (el - p.t0) / p.dur);
          const e = k * k * (3 - 2 * k);
          // 二次貝茲：出發 → 控制點（上方）→ 塵計數器
          p.x = (1 - e) * (1 - e) * p.sx + 2 * (1 - e) * e * p.cx + e * e * tx;
          p.y = (1 - e) * (1 - e) * p.sy + 2 * (1 - e) * e * p.cy + e * e * ty;
          if (k >= 1 && !p.done) { p.done = true; p.life = 0.01; arrived++; if (onArrive) onArrive(arrived, n); }
        } });
    }
    kick();
  }

  // ---------- 卡飛進圖鑑時，終點噴一小撮亮片 ----------
  function puff(x, y, color = '#ffd24a') {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), sp = rand(40, 140);
      spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 120, r: rand(1, 2.5), life: rand(0.3, 0.6), color, glow: 6, shrink: true });
    }
    kick();
  }

  // scope 只移除自己建立的物件，收集動畫不會被上一場的取消波及。
  function createScope({ rng = Math.random } = {}) {
    const ownedParts = new Set(), ownedLayers = new Set();
    let stopped = false;
    return {
      spawn(p) {
        if (stopped) return;
        spawn(p); ownedParts.add(parts[parts.length - 1]); kick();
      },
      layer(l) {
        if (stopped) return;
        layers.push(l); ownedLayers.add(l); kick(); return l;
      },
      reveal(x, y, rarity) {
        const count = { common: 0, rare: 8, epic: 12, legendary: 20 }[rarity];
        const life = { common: 0, rare: .24, epic: .42, legendary: .6 }[rarity];
        for (let i = 0; i < count; i++) {
          const a = i / count * TAU + (rng() - .5) * .2;
          this.spawn({ x: x + Math.cos(a) * 78, y: y + Math.sin(a) * 108,
            vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, r: 1.5, life,
            color: RC[rarity], shape: rarity === 'epic' ? 'star' : 'streak', shrink: true });
        }
        if (rarity === 'legendary') {
          let age = 0;
          this.layer({ dead: false, under: true,
            update(dt) { age += dt; this.dead = age >= .6; },
            draw(c) {
              c.save(); c.translate(x, y); c.strokeStyle = '#ffba63';
              c.globalAlpha = Math.sin(Math.PI * age / .6) * .5; c.lineWidth = 7;
              for (let i = 0; i < 6; i++) {
                const a = i * TAU / 6;
                c.beginPath(); c.moveTo(Math.cos(a) * 80, Math.sin(a) * 110);
                c.lineTo(Math.cos(a) * 185, Math.sin(a) * 190); c.stroke();
              }
              c.restore();
            },
          });
        }
      },
      stop() {
        if (stopped) return;
        stopped = true;
        for (let i = parts.length - 1; i >= 0; i--) if (ownedParts.has(parts[i])) parts.splice(i, 1);
        for (let i = layers.length - 1; i >= 0; i--) if (ownedLayers.has(layers[i])) layers.splice(i, 1);
        ownedParts.clear(); ownedLayers.clear();
        // 下一幀自然停止；先清畫布，避免背景分頁的 rAF 延後留下殘影。
        ctx?.clearRect(0, 0, W, H); under?.clearRect(0, 0, W, H);
      },
    };
  }
  return { init, packBurst, reveal, rays, dustStream, puff, createScope };
})();
