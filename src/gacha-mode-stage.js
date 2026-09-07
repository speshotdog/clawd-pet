// 拉幕登場：本尊先露臉，再收進已翻開的卡；不重播翻卡 R。
// 場景是真的劇場：簷幕、左右布幕（真素材）、木台、一盞白色探照燈、燈裡飄的塵。
// 節拍：拉環 160 → 布幕拉開 520（帶一點布料的晃）→ 燈亮 → 每位：剪影走進燈下 → 燈打亮才變稀有度色
//        → 名牌緞帶滑入 → 角色回應 → 縮成卡飛進扇形。傳說：燈忽明忽暗蓄力 1080ms，再全亮＋彩帶雨＋射線＋整桌震。
window.GachaModes = window.GachaModes || {};
window.GachaModes.stage = {
  label: '拉幕登場', counts: [5],
  create(ctx) {
    const RC = { common: '#d9d4c7', rare: '#78baff', epic: '#d5a2ff', legendary: '#ffc477', mythic: '#FF4FD8' };
    const RC2 = { common: '#9d9d9d', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000', mythic: '#FF4FD8' };
    const LABEL = { common: '普通', rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' };
    const holds = { common: 600, rare: 800, epic: 1000, legendary: 1250, mythic: 1600 };
    const CX = ctx.center.x, FLOOR = 452;            // 角色腳底的 y
    const style = document.createElement('style');
    style.textContent = `
      .mode-stage { z-index: 11; pointer-events: none; }
      .mode-stage .st-back { position:absolute; inset:0; background:
        radial-gradient(ellipse 60% 50% at 50% 70%, rgba(80,40,50,.45), transparent 70%),
        linear-gradient(180deg, #120b12, #1d1017 55%, #0d0a0e); opacity:0; transition:opacity .35s; }
      .mode-stage .st-back.on { opacity:1; }
      .mode-stage .st-stage { position:absolute; left:50%; top:388px; width:720px; margin-left:-360px; }
      .mode-stage .st-valance { position:absolute; left:50%; top:44px; width:1000px; margin-left:-500px; filter:drop-shadow(0 6px 6px rgba(0,0,0,.5)); }
      .mode-stage .st-curtain { position:absolute; top:70px; height:560px; width:500px; background:url("gacha-set-curtain.png") right top / 100% 100% no-repeat;
        filter:drop-shadow(0 8px 10px rgba(0,0,0,.55)); transform-origin:50% 0; }
      .mode-stage .st-curtain.l { left:-8px; }
      .mode-stage .st-curtain.r { right:-8px; transform:scaleX(-1); }
      .mode-stage .st-beam { position:absolute; left:calc(50% - 230px); top:56px; width:460px; height:420px; color:#fff; opacity:0; transition:color .25s; }
      .mode-stage .st-pool { position:absolute; left:calc(50% - 180px); top:${FLOOR - 34}px; width:360px; height:68px; border-radius:50%; opacity:0;
        background:radial-gradient(ellipse, currentColor, transparent 70%); color:#fff; filter:blur(6px); mix-blend-mode:screen; transition:color .25s; }
      .mode-stage .st-actor { position:absolute; left:calc(50% - 130px); top:${FLOOR - 210}px; width:260px; height:210px; display:flex; justify-content:center; align-items:flex-end; transform-origin:50% 100%; }
      .mode-stage .st-actor > svg { height:200px !important; width:auto; margin:0 !important; filter:none !important; }
      .mode-stage .st-actor > img { max-width:170px; max-height:160px; object-fit:contain; margin:0 !important; filter:none !important; }
      .mode-stage .st-actor > .emoji { font-size:120px; line-height:1.2; }
      .mode-stage .st-actor.shadow { filter:brightness(0) opacity(.92); }
      .mode-stage .st-ribbon { position:absolute; left:50%; top:${FLOOR + 46}px; width:320px; margin-left:-160px; padding:8px 0 6px; text-align:center; opacity:0;
        background:linear-gradient(90deg, transparent, var(--sc) 12%, var(--sc) 88%, transparent); color:#fff; letter-spacing:.2em; text-indent:.2em;
        font-family:Georgia,"Microsoft JhengHei",serif; font-size:20px; text-shadow:0 1px 0 rgba(0,0,0,.6); }
      .mode-stage .st-ribbon small { display:block; font-family:"Microsoft JhengHei",sans-serif; font-size:11px; letter-spacing:.4em; text-indent:.4em; opacity:.85; margin-top:2px; }
      .mode-stage .st-ribbon::before, .mode-stage .st-ribbon::after { content:""; position:absolute; top:0; bottom:0; width:2px; background:rgba(255,255,255,.35); }
      .mode-stage .st-ribbon::before { left:12%; } .mode-stage .st-ribbon::after { right:12%; }
      .mode-stage .st-next { position:absolute; top:548px; left:calc(50% - 110px); width:220px; pointer-events:auto; }`;
    const scene = document.createElement('div');
    scene.innerHTML = `
      <div class="st-back"></div>
      <img class="st-stage" src="gacha-set-stage.png" alt="">
      <div class="st-pool"></div>
      <svg class="st-beam" viewBox="0 0 460 420"><defs><linearGradient id="st-light" x2="0" y2="1"><stop stop-color="currentColor" stop-opacity=".02"/><stop offset="1" stop-color="currentColor" stop-opacity=".55"/></linearGradient></defs><path d="M220 0 L240 0 L450 396 Q230 440 10 396 Z" fill="url(#st-light)"/></svg>
      <div class="st-curtain l"></div><div class="st-curtain r"></div>
      <img class="st-valance" src="gacha-set-valance.png" alt="">
      <div class="st-ribbon"></div>`;
    const next = document.createElement('button'); next.className = 'pill st-next'; next.textContent = '下一位 · 點擊或空白鍵'; next.hidden = true;
    scene.append(next); ctx.root.append(style, scene);
    const q = (s) => scene.querySelector(s);
    const back = q('.st-back'), beam = q('.st-beam'), pool = q('.st-pool'), ribbon = q('.st-ribbon');
    const curtains = [q('.st-curtain.l'), q('.st-curtain.r')];
    let raf = 0, rays = null, dust = null;
    const stopRig = () => { cancelAnimationFrame(raf); raf = 0; };
    ctx.signal.addEventListener('abort', () => { stopRig(); if (dust) dust.dead = true; rays?.stop(.2); }, { once: true });
    function setLimb(el, deg, pivot) { if (el && pivot) el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${pivot[0]} ${pivot[1]})`); }
    // rig：走路（雙腿交替＋尾巴）或回應（眨眼＋搖尾／抬手）
    async function gesture(art, cfg, duration, walking) {
      if (!cfg || ctx.motion.reduced) { await ctx.wait(duration); return; }
      const legL = art.querySelector('#legL'), legR = art.querySelector('#legR'), tail = art.querySelector('#tail'), paw = art.querySelector('#pawR');
      const open = art.querySelector('#eyes-open'), closed = art.querySelector('#eyes-closed');
      const start = performance.now(), ls = cfg.limbScale ?? 1;
      const reset = () => { setLimb(legL, 0, cfg.legL); setLimb(legR, 0, cfg.legR); setLimb(tail, 0, cfg.tail); setLimb(paw, 0, cfg.pawR); if (open) open.style.display = ''; if (closed) closed.style.display = 'none'; };
      function frame(now) {
        const ms = Math.min(duration, now - start), t = ms / duration;
        if (walking) {
          const step = Math.sin(t * Math.PI * 5) * 13 * ls;
          setLimb(legL, step, cfg.legL); setLimb(legR, -step, cfg.legR);
          setLimb(tail, Math.sin(t * Math.PI * 2.5) * 4 * (cfg.tailScale ?? 1), cfg.tail);
        } else {
          const swing = Math.sin(t * Math.PI * 2);
          if (tail && cfg.tail) setLimb(tail, swing * 6 * (cfg.tailScale ?? 1), cfg.tail);
          else setLimb(paw, Math.sin(t * Math.PI) * (cfg.up ?? 1) * 12 * ls * (cfg.pawScale ?? 1), cfg.pawR);
          if (open && closed) { const shut = ms >= 180 && ms < 290; open.style.display = shut ? 'none' : ''; closed.style.display = shut ? '' : 'none'; }
        }
        if (ms < duration && !ctx.signal.aborted) raf = requestAnimationFrame(frame); else { raf = 0; reset(); }
      }
      raf = requestAnimationFrame(frame);
      try { await ctx.wait(duration); } finally { stopRig(); reset(); }
    }
    // 燈裡的塵：低速、少量、只在燈亮時；用貼圖粒子 0（光球）
    function startDust() {
      let acc = 0;
      dust = ctx.fx.layer({ dead: false, update(dt) { acc += dt; while (acc > .09) { acc -= .09;
        ctx.fx.spawn({ sprite: 0, x: CX + (ctx.rng() - .5) * 220, y: 110 + ctx.rng() * 320, vx: (ctx.rng() - .5) * 14, vy: 6 + ctx.rng() * 10, g: 0, drag: 1,
          r: 3 + ctx.rng() * 5, life: 2 + ctx.rng() * 2, color: '#fff3d0', fadeK: .9, blend: 'lighter' }); } }, draw() {} });
    }
    async function waitNext() {
      if (ctx.isAuto()) { await ctx.wait(60); return; }
      next.hidden = false;
      const listeners = new AbortController();
      try {
        await new Promise((resolve, reject) => {
          next.addEventListener('click', resolve, { signal: listeners.signal });
          document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.target.closest('select, input, button')) { e.preventDefault(); resolve(); } }, { signal: listeners.signal });
          document.addEventListener('change', () => { if (ctx.isAuto()) resolve(); }, { signal: listeners.signal });
          ctx.signal.addEventListener('abort', () => reject(new DOMException('演出取消', 'AbortError')), { once: true, signal: listeners.signal });
        });
      } finally { listeners.abort(); next.hidden = true; }
    }
    // 揭曉特效：依稀有度，用貼圖粒子
    function revealFx(rarity) {
      const x = CX, y = FLOOR - 100, c = RC2[rarity];
      if (rarity === 'common') return;
      if (rarity === 'rare') {
        for (let i = 0; i < 14; i++) { const a = ctx.rng() * Math.PI * 2, sp = 90 + ctx.rng() * 160;
          ctx.fx.spawn({ sprite: 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 180, r: 9 + ctx.rng() * 8, life: .6 + ctx.rng() * .5, color: '#9fd0ff', rot: ctx.rng() * 6, vr: 2, shrink: true }); }
        return;
      }
      if (rarity === 'epic') {
        for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, sp = 120 + ctx.rng() * 120;
          ctx.fx.spawn({ sprite: i % 3 ? 7 : 10, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 60, drag: .96, r: 10 + ctx.rng() * 10, life: .8 + ctx.rng() * .6, color: i % 3 ? '#d5a2ff' : '#ff9bd6', rot: ctx.rng() * 6, vr: 3, shrink: true }); }
        ctx.fx.layer(ctx.fx.ring(x, y, c, .55, 240, 8));
        return;
      }
      // 傳說：五星爆開 + 從簷幕撒下來的金色彩帶雨（1.4 秒）
      for (let i = 0; i < 26; i++) { const a = ctx.rng() * Math.PI * 2, sp = 160 + ctx.rng() * 260;
        ctx.fx.spawn({ sprite: i % 2 ? 2 : 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 260, drag: .975, r: 12 + ctx.rng() * 12, life: .9 + ctx.rng() * .7, color: i % 2 ? '#ffd27a' : '#fff3d0', rot: ctx.rng() * 6, vr: (ctx.rng() - .5) * 8, shrink: true }); }
      ctx.fx.layer(ctx.fx.ring(x, y, '#ffd27a', .6, 320, 10));
      let t = 0; ctx.fx.layer({ dead: false, update(dt) { t += dt; if (t > 1.4) { this.dead = true; return; }
        for (let i = 0; i < 2; i++) ctx.fx.spawn({ sprite: ctx.rng() < .5 ? 8 : 9, x: CX + (ctx.rng() - .5) * 700, y: 60, vx: (ctx.rng() - .5) * 40, vy: 60 + ctx.rng() * 80, g: 120, drag: .99,
          r: 8 + ctx.rng() * 8, life: 2.2 + ctx.rng(), color: rarity === 'mythic' ? window.GachaFx.rainbow[Math.floor(ctx.rng()*7)] : ['#ffd27a', '#ff8000', '#fff3d0', '#ffb04d'][Math.floor(ctx.rng() * 4)], rot: ctx.rng() * 6, vr: (ctx.rng() - .5) * 6, blend: 'source-over', fadeK: 1.2 }); }, draw() {} });
    }
    const dispose = () => { ctx.cancel(); style.remove(); scene.remove(); };
    return {
      async open(draw) {
        // ---- 開場：拉環扣、布幕向兩側拉開（帶布料的晃）、燈亮、塵開始飄
        back.classList.add('on');
        if (draw.entries.some(it => it.entry.rarity === 'mythic') && !ctx.motion.reduced) {
          for (let i=0;i<32;i++) ctx.fx.spawn({sprite:9,x:CX+(ctx.rng()-.5)*700,y:60,vy:90,g:120,r:9,life:2.2,color:window.GachaFx.rainbow[i%7],vr:4});
        }
        ctx.audio.tone(240, { type: 'triangle', slide: 170, slideT: .065, d: .065, r: .025, gain: .09 });
        await ctx.wait(420);   // 先讓觀眾看到閉著的幕
        ctx.audio.noiseHit({ type: 'lowpass', f0: 1600, f1: 450, a: .03, d: .32, r: .12, gain: .12 });
        await Promise.all(curtains.map((cur, i) => ctx.animate(cur, ctx.motion.reduced ? [{ opacity: 1 }, { opacity: .15 }] : [
          { transform: `${i ? 'scaleX(-1) ' : ''}translateX(0) skewX(0)` },
          { transform: `${i ? 'scaleX(-1) ' : ''}translateX(-36%) skewX(${i ? -3 : 3}deg)`, offset: .7 },
          { transform: `${i ? 'scaleX(-1) ' : ''}translateX(-42%) skewX(0)` },
        ], { duration: 620, easing: 'cubic-bezier(.3,.7,.3,1)' })));
        ctx.audio.tone(1200, { type: 'triangle', d: .035, r: .02, gain: .035 });
        beam.style.opacity = '.7'; pool.style.opacity = '.55';
        if (!ctx.motion.reduced) startDust();
        await ctx.wait(220);
        for (let i = 0; i < draw.entries.length; i++) {
          const item = draw.entries[i], rarity = item.entry.rarity, mythic = rarity === 'mythic', legendary = mythic || rarity === 'legendary';
          beam.style.color = '#fff'; pool.style.color = '#fff'; ribbon.style.opacity = '0';
          const actor = document.createElement('div'); actor.className = 'st-actor shadow';
          const art = ctx.art.create(item.entry), cfg = item.entry.kind === 'char' ? ctx.art.cfg(item.entry.id) : null;
          actor.append(art); scene.insertBefore(actor, curtains[0]);
          const entrance = cfg ? 560 : 480;
          if (cfg) ctx.audio.tone(130, { type: 'sine', slide: 85, slideT: .065, d: .065, r: .025, gain: .09 });
          const fromLeft = i % 2 === 0;
          const movement = ctx.animate(actor, ctx.motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] : cfg ?
            [{ transform: `translateX(${fromLeft ? -360 : 360}px) scaleX(${fromLeft ? 1 : -1})` }, { transform: `translateX(0) scaleX(${fromLeft ? 1 : -1})` }] :
            [{ transform: 'translateY(-320px)' }, { transform: 'translateY(0) scale(1.14,.86)', offset: .68 }, { transform: 'translateY(-22px)', offset: .84 }, { transform: 'translateY(0)' }], { duration: entrance, easing: cfg ? 'linear' : 'ease-out' });
          const [entered] = await Promise.all([movement, gesture(art, cfg, entrance, true)]); entered.cancel();
          actor.style.transform = cfg && !fromLeft ? 'scaleX(-1)' : '';
          if (!cfg) { ctx.audio.drop(); for (let k = 0; k < 6; k++) ctx.fx.spawn({ sprite: 4, x: CX + (ctx.rng() - .5) * 120, y: FLOOR - 10, vx: (ctx.rng() - .5) * 90, vy: -20 - ctx.rng() * 30, g: -10, r: 16 + ctx.rng() * 12, life: .6, color: '#d9d4c7', grow: true, fadeK: 1, blend: 'source-over' }); }
          if (mythic) ctx.dim(true);
          if (legendary) {
            // 燈忽明忽暗、地板低頻、角色停在燈下——「來了」
            ctx.audio.charge(1.05);
            ctx.audio.tone(55, { type: 'sine', a: .08, d: .8, r: .12, gain: .14 });
            await ctx.animate(beam, ctx.motion.reduced ? [{ opacity: .3 }, { opacity: .7 }] :
              [{ opacity: .7 }, { opacity: .1 }, { opacity: .9 }, { opacity: .15 }, { opacity: .6 }, { opacity: .05 }, { opacity: .8 }, { opacity: .04 }], { duration: 1080 });
            beam.getAnimations().forEach((a) => a.cancel());
          }
          if (mythic && !ctx.motion.reduced) await ctx.mythicFlash();
          // ---- 露臉：燈變色、揭曉音、特效、緞帶名牌
          actor.classList.remove('shadow'); beam.style.color = RC[rarity]; pool.style.color = RC[rarity]; beam.style.opacity = '.95'; pool.style.opacity = '.9';
          ctx.audio.reveal(rarity);
          if (legendary) {
            ctx.flash();
            if (!ctx.motion.reduced) { ctx.shake(); rays = window.GachaFx.rays(CX, FLOOR - 110, { fadeIn: .08, hold: mythic ? 1.7 : 1.3, mythic }); }
          } else if (rarity === 'epic' && !ctx.motion.reduced) ctx.shake(true);
          if (!ctx.motion.reduced) revealFx(rarity);
          if (mythic) {
            beam.classList.add('mythic-sweep'); pool.classList.add('mythic-sweep');
            if (!ctx.motion.reduced) { ctx.fx.reveal(CX,FLOOR-110,'mythic'); ctx.fx.rainbowRing(CX,FLOOR-110); ctx.wait(120).then(()=>ctx.shake()).catch(()=>{}); }
          }
          ribbon.innerHTML = `${item.entry.name}<small>${LABEL[rarity]}</small>`; ribbon.style.setProperty('--sc', RC2[rarity]);
          const naming = ctx.animate(ribbon, [{ opacity: 0, transform: 'translateY(14px) scaleX(.6)' }, { opacity: 1, transform: 'translateY(0) scaleX(1)' }], { duration: 240, easing: 'cubic-bezier(.2,1.2,.3,1)' });
          await Promise.all([naming, gesture(art, cfg, 440, false), ctx.wait(holds[rarity])]);
          ribbon.getAnimations().forEach((a) => a.cancel()); ribbon.style.opacity = '0';
          // ---- 收進卡：本尊縮小、卡從舞台中央飛到扇形位
          const c = ctx.cards.create(item); c.flipped = true; ctx.onReveal(item.key);
          c.el.classList.add('dealt', 'flipped');
          if (mythic && !ctx.motion.reduced) c.el.classList.add('mythic-ripple');
          c.el.style.transition = 'none';
          const transform = `translate(${c.x}px, ${c.y}px) rotate(${ctx.motion.reduced ? 0 : c.rot}deg)`;
          c.el.style.transform = transform;
          ctx.audio.deal(i);
          await Promise.all([
            ctx.animate(actor, [{ opacity: 1, transform: actor.style.transform + ' scale(1)' }, { opacity: 0, transform: actor.style.transform + ' scale(.3)' }], { duration: ctx.motion.reduced ? 150 : 240 }),
            ctx.animate(c.el, [{ opacity: 0, transform: `translate(${CX}px, ${FLOOR - 100}px) scale(.7)` }, { opacity: 1, transform }], { duration: ctx.motion.reduced ? 150 : 360, easing: 'cubic-bezier(.22,.9,.32,1.12)' }),
          ]);
          c.el.getAnimations().forEach((a) => a.cancel()); actor.remove();
          ctx.dim(false); beam.classList.remove('mythic-sweep'); pool.classList.remove('mythic-sweep');
          if (rays) { rays.stop(.25); rays = null; }
          beam.style.color = '#fff'; pool.style.color = '#fff'; beam.style.opacity = '.7'; pool.style.opacity = '.55';
          if (i < draw.entries.length - 1) await waitNext();
        }
        // ---- 落幕：布幕合上，場景淡出
        if (dust) { dust.dead = true; dust = null; }
        ctx.audio.noiseHit({ type: 'lowpass', f0: 1200, f1: 400, a: .03, d: .3, r: .1, gain: .09 });
        await Promise.all(curtains.map((cur, i) => ctx.animate(cur, [{ transform: `${i ? 'scaleX(-1) ' : ''}translateX(-42%)` }, { transform: `${i ? 'scaleX(-1) ' : ''}translateX(0)` }], { duration: 380, easing: 'ease-in-out' })));
        await ctx.animate(scene, [{ opacity: 1 }, { opacity: 0 }], { duration: 260 }); scene.remove();
        ctx.cards.showSummary(draw.entries);
      },
      skip: dispose, dispose,
    };
  },
};
