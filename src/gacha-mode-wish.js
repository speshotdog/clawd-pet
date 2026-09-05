// 流星投遞：借原神祈願的語彙——夜空、一顆越飛越亮的流星、落地白閃、卡片從光裡升起。
// 整段只有一個主體（流星），其他東西都在等它。預告（尾光變色）預設關閉，驚喜留到翻卡。
// 節拍：入夜 300 → 起飛 → 飛行 900 → 撞擊 → 五張從坑裡升起 → 揭曉
window.GachaModes = window.GachaModes || {};
// TELEGRAPH：原神式「尾光先變色告訴你這批多好」。使用者要驚喜感，關掉；留著開關是給之後別的遊戲用。
const WISH_TELEGRAPH = false;
window.GachaModes.wish = {
  label: '流星投遞', counts: [1, 5, 10],
  create(ctx) {
    const RC = { common: '#9d9d9d', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000' };
    const RGB = { common: [200, 200, 200], rare: [90, 170, 255], epic: [200, 120, 255], legendary: [255, 170, 60] };
    const style = document.createElement('style');
    style.textContent = `
      .mode-wish .wish-night { position:absolute; inset:0; opacity:0; transition:opacity .3s;
        background: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(4,8,20,.25), rgba(2,4,12,.86)); }
      .mode-wish .wish-night.on { opacity:1; }
      .mode-wish .wish-night i { position:absolute; width:2px; height:2px; border-radius:50%; background:#fff; opacity:.55; }
      .mode-wish .wish-crater { position:absolute; width:520px; height:320px; margin:-160px -260px; border-radius:50%; opacity:0;
        background: radial-gradient(ellipse, var(--wc,#fff) 0%, transparent 60%); filter: blur(6px); }
      .mode-wish .wish-preview { position:absolute; left:0; right:0; top:84px; text-align:center; letter-spacing:.3em; font-size:13px;
        color:var(--wc,#fff); text-shadow:0 0 12px var(--wc,#fff); opacity:0; transition:opacity .35s; }
      .mode-wish .wish-preview.on { opacity:1; }
      .mode-wish .wish-preview b { display:block; margin-top:4px; font-size:22px; letter-spacing:.4em; text-indent:.4em; }
    `;
    const night = document.createElement('div'); night.className = 'wish-night';
    // 幾顆固定的星，不閃——閃的東西只有流星
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('i');
      s.style.left = `${(ctx.rng() * 100).toFixed(1)}%`; s.style.top = `${(ctx.rng() * 70).toFixed(1)}%`;
      s.style.opacity = (0.25 + ctx.rng() * 0.5).toFixed(2);
      if (ctx.rng() < .3) { s.style.width = s.style.height = '3px'; }
      night.appendChild(s);
    }
    const crater = document.createElement('div'); crater.className = 'wish-crater';
    const preview = document.createElement('div'); preview.className = 'wish-preview';
    ctx.root.append(style, night, crater, preview);
    let disposed = false;
    const cleanup = () => ctx.root.replaceChildren();
    const dispose = () => { if (disposed) return; disposed = true; ctx.cancel(); cleanup(); };

    return {
      async open(draw) {
        const order = ['common', 'rare', 'epic', 'legendary'];
        const rank = WISH_TELEGRAPH ? Math.max(...draw.entries.map((it) => order.indexOf(it.entry.rarity))) : 0;
        // 不預告時流星一律暖白，撞擊也用白光；顏色第一次出現是在翻卡那一刻
        const top = order[rank], color = WISH_TELEGRAPH ? RC[top] : '#ffe7a6', rgb = WISH_TELEGRAPH ? RGB[top] : [255, 231, 166];
        const { x: cx, y: cy } = ctx.center;
        crater.style.left = `${cx}px`; crater.style.top = `${cy}px`;
        ctx.root.style.setProperty('--wc', color);

        // ---- 入夜：桌子沉下去，星星浮出來
        night.classList.add('on');
        ctx.audio.noiseHit({ type: 'lowpass', f0: 600, f1: 200, a: .1, d: .3, r: .2, gain: .08 });
        await ctx.wait(320);
        if (ctx.motion.reduced) {
          await ctx.wait(200); ctx.flash();
          await ctx.cards.deal(draw.entries, { stagger: 60, duration: 150 });
          night.classList.remove('on'); await ctx.interact(); return;
        }

        // ---- 飛行路徑：右上角進場，弧線落到中央（三條預設弧只偏控制點）
        const start = { x: 940, y: -30 };
        const ctrlSet = [[760, 40], [700, 90], [800, 120]][Math.floor(ctx.rng() * 3)];
        const jitter = ctx.rng() * 24 - 12;
        const ctrl = { x: ctrlSet[0] + jitter, y: ctrlSet[1] + jitter };
        const point = (t) => ({
          x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * ctrl.x + t * t * cx,
          y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * ctrl.y + t * t * cy,
        });
        const FLIGHT = .9, HOVER_AT = .88;
        const legendary = WISH_TELEGRAPH && top === 'legendary';
        let age = 0, prog = 0, hovering = false, hoverT = 0, ended = false;
        const trail = [];   // 最近的取樣點，畫成漸細的光帶
        // 起飛：風聲從遠處拉近，稀有度提示音在 45% 處進來
        const wind = ctx.audio.createScope();
        wind.noiseHit({ type: 'bandpass', f0: 300, f1: 3600, q: .8, a: .5, d: .45, r: .25, gain: .22 });
        wind.tone(180, { type: 'sine', slide: 720, slideT: .95, a: .4, d: .5, r: .2, gain: .06 });
        const meteor = ctx.fx.layer({
          dead: false,
          update(dt) {
            age += dt;
            if (hovering) { hoverT += dt; return; }
            prog = Math.min(1, prog + dt / FLIGHT * (0.55 + prog * 0.9));   // 加速：後半越來越快
            const p = point(prog);
            trail.push({ x: p.x, y: p.y, t: age });
            while (trail.length > 42) trail.shift();
            // 火星從頭部往後掉
            for (let i = 0; i < 2; i++) ctx.fx.spawn({ x: p.x + (ctx.rng() - .5) * 10, y: p.y + (ctx.rng() - .5) * 10,
              vx: (ctx.rng() - .5) * 60 + (trail.length > 2 ? (trail[trail.length - 3].x - p.x) * 3 : 0),
              vy: (ctx.rng() - .5) * 60 + 40, g: 160, r: 1 + ctx.rng() * 1.8, life: .35 + ctx.rng() * .4,
              color: prog < .45 || !WISH_TELEGRAPH ? '#ffffff' : color, glow: 8, shrink: true });
            if (ended) this.dead = true;
          },
          draw(c) {
            if (!trail.length) return;
            const head = trail[trail.length - 1];
            // 顏色：前 45% 白，45–70% 漸變成本批最高稀有度色
            const k = WISH_TELEGRAPH ? Math.max(0, Math.min(1, (prog - .45) / .25)) : 0;
            const col = [0, 1, 2].map((i) => Math.round(255 + (rgb[i] - 255) * k));
            const cs = `rgb(${col.join(',')})`;
            c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
            // 光帶：多段線，越靠頭越粗越亮
            const w0 = !WISH_TELEGRAPH ? 13 : legendary ? 16 : top === 'epic' ? 13 : top === 'rare' ? 11 : 9;
            for (let i = 1; i < trail.length; i++) {
              const f = i / trail.length;
              c.strokeStyle = `rgba(${col.join(',')},${(f * f * .85).toFixed(3)})`;
              c.lineWidth = w0 * f;
              c.beginPath(); c.moveTo(trail[i - 1].x, trail[i - 1].y); c.lineTo(trail[i].x, trail[i].y); c.stroke();
            }
            // 外暈
            c.shadowColor = cs; c.shadowBlur = 24; c.strokeStyle = `rgba(${col.join(',')},.35)`; c.lineWidth = w0 * 1.8;
            c.beginPath();
            for (let i = Math.max(0, trail.length - 14); i < trail.length; i++) c.lineTo(trail[i].x, trail[i].y);
            c.stroke();
            c.shadowBlur = 0;
            // 頭：亮核 + 稀有度色暈，傳說懸停時脈動變大
            const pulse = hovering ? 1 + Math.sin(hoverT * 18) * .12 + hoverT * .6 : 1;
            const R = (legendary ? 30 : 22) * pulse;
            const g = c.createRadialGradient(head.x, head.y, 0, head.x, head.y, R);
            g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, `rgba(${col.join(',')},.9)`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
            c.fillStyle = g; c.beginPath(); c.arc(head.x, head.y, R, 0, Math.PI * 2); c.fill();
            if (legendary && k > .9) {
              // 金色光環：只有傳說有第二層
              c.strokeStyle = `rgba(255,215,120,${(.5 + Math.sin(age * 12) * .2).toFixed(2)})`; c.lineWidth = 2;
              c.beginPath(); c.arc(head.x, head.y, R * 1.4 + Math.sin(age * 9) * 3, 0, Math.PI * 2); c.stroke();
            }
            c.restore();
          },
        });
        // 預告：45% 處顏色轉變的同時，天空跟著染色、提示音進來
        await ctx.wait(FLIGHT * 1000 * .42);
        if (WISH_TELEGRAPH && top !== 'common') {
          wind.tone({ rare: 880, epic: 1174, legendary: 1568 }[top], { type: 'sine', a: .03, d: .5, r: .3, gain: .09, to: wind.verb });
          wind.tone({ rare: 1320, epic: 1761, legendary: 2352 }[top], { type: 'sine', t: wind.now() + .06, a: .03, d: .5, r: .3, gain: .05, to: wind.verb });
        }
        if (WISH_TELEGRAPH) {
          night.style.background = `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(${rgb.join(',')},.10), rgba(2,4,12,.86))`;
          preview.innerHTML = `本次最高<b>${{ common: '普通', rare: '精良', epic: '史詩', legendary: '傳說' }[top]}</b>`;
          preview.classList.add('on');
        }
        // 等流星飛到懸停點
        while (prog < HOVER_AT) await ctx.wait(16);
        if (legendary) {
          // 「來了」：流星停在半空，光在漲、低頻在漲，故意讓你等一下
          hovering = true;
          const charge = ctx.audio.createScope();
          charge.tone(48, { type: 'sine', slide: 70, slideT: .38, a: .3, d: .06, r: .04, gain: .5 });
          charge.tone(1760, { type: 'sine', slide: 3520, slideT: .38, a: .3, d: .06, r: .04, gain: .05, to: charge.verb });
          charge.tone(80, { type: 'sine', a: .004, d: .12, gain: .35, slide: 45, slideT: .1 });
          await ctx.wait(380);
          charge.stop(30);
          hovering = false;
        }
        while (prog < 1) await ctx.wait(16);
        ended = true;
        wind.stop(60);

        // ---- 撞擊：白閃、衝擊波、整桌震、坑口餘光
        ctx.flash();
        ctx.shake();
        ctx.audio.burst();
        if (legendary) ctx.audio.tone(55, { type: 'sine', a: .005, d: 1.0, gain: .5, slide: 38, slideT: .9 });
        ctx.fx.layer(ctx.fx.ring(cx, cy, color, .6, 420, 12));
        ctx.fx.layer(ctx.fx.ring(cx, cy, '#ffffff', .4, 240, 6));
        for (let i = 0; i < 70; i++) {
          const a = ctx.rng() * Math.PI * 2, sp = 120 + ctx.rng() * 520;
          ctx.fx.spawn({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 480, drag: .975,
            r: 1.2 + ctx.rng() * 2.2, life: .5 + ctx.rng() * .8, color: ctx.rng() < .5 ? '#ffffff' : color, glow: 6, shrink: true, shape: 'streak' });
        }
        ctx.animate(crater, [{ opacity: 0 }, { opacity: .55, offset: .08 }, { opacity: .18, offset: .5 }, { opacity: 0 }], { duration: 2200 }).catch(() => {});
        await ctx.wait(260);

        // ---- 卡片從光裡升起：每張 110ms，慢一點、重一點（不是甩出去，是浮上來）
        await ctx.cards.deal(draw.entries, { stagger: draw.entries.length === 10 ? 60 : 110, duration: 560, from: { x: cx, y: cy + 40, scale: .3 } });
        preview.classList.remove('on');
        await ctx.wait(200);
        night.classList.remove('on');
        await ctx.interact();
      },
      skip: dispose, dispose,
    };
  },
};
