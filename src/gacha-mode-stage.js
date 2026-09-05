// 本尊先露臉，再收進已翻開的卡；不重播翻卡 R。
window.GachaModes = window.GachaModes || {};
window.GachaModes.stage = {
  label: '拉幕登場', counts: [5],
  create(ctx) {
    const colors = { common: '#ddd9cf', rare: '#78baff', epic: '#d5a2ff', legendary: '#ffc477' };
    const holds = { common: 600, rare: 800, epic: 1000, legendary: 1200 };
    const style = document.createElement('style');
    style.textContent = `
      .mode-stage { z-index:11; }
      .mode-stage .stage-set { position:absolute; inset:70px 0 116px; background:radial-gradient(ellipse at 50% 100%,#302127,transparent 72%); }
      .mode-stage .stage-floor { position:absolute; left:110px; right:110px; top:332px; height:50px; border-radius:50%; border-bottom:8px solid #684732; background:repeating-linear-gradient(90deg,#423027 0 78px,#35251f 79px 81px); }
      .mode-stage .stage-curtain { position:absolute; top:0; bottom:0; width:50%; background:repeating-linear-gradient(90deg,#35121c,#762538 28px,#421722 56px); border-bottom:7px solid #b59053; }
      .mode-stage .stage-curtain.left { left:0; } .mode-stage .stage-curtain.right { right:0; }
      .mode-stage .stage-beam { position:absolute; left:calc(50% - 190px); top:0; width:380px; height:366px; color:#fff; opacity:.36; }
      .mode-stage .stage-actor { position:absolute; left:calc(50% - 110px); top:142px; width:220px; height:192px; display:flex; justify-content:center; align-items:flex-end; transform-origin:50% 100%; }
      .mode-stage .stage-actor > svg { height:192px !important; width:auto; margin:0 !important; }
      .mode-stage .stage-actor > img { max-width:150px; max-height:150px; object-fit:contain; margin:0 !important; }
      .mode-stage .stage-actor > .emoji { font-size:112px; line-height:1.2; }
      .mode-stage .stage-name { position:absolute; top:365px; left:calc(50% - 160px); width:320px; padding:10px; text-align:center; color:var(--stage-color,#fff); border-block:1px solid currentColor; background:#191723; letter-spacing:.16em; opacity:0; }
      .mode-stage .stage-next { position:absolute; top:438px; left:calc(50% - 100px); width:200px; pointer-events:auto; }
    `;
    const scene = document.createElement('div'); scene.className = 'stage-set';
    // 單一白色圓錐；currentColor 只在露臉那一拍更新。
    scene.innerHTML = `<div class="stage-floor"></div><svg class="stage-beam" viewBox="0 0 380 366"><defs><linearGradient id="stage-light" x2="0" y2="1"><stop stop-color="currentColor" stop-opacity=".05"/><stop offset="1" stop-color="currentColor" stop-opacity=".6"/></linearGradient></defs><path d="M184 0 L196 0 L376 344 Q190 386 4 344 Z" fill="url(#stage-light)"/></svg><div class="stage-curtain left"></div><div class="stage-curtain right"></div><div class="stage-name"></div>`;
    const next = document.createElement('button'); next.className = 'pill stage-next'; next.textContent = '下一位 · 點擊或空白鍵'; next.hidden = true;
    scene.append(next); ctx.root.append(style, scene);
    const beam = scene.querySelector('.stage-beam'), name = scene.querySelector('.stage-name');
    let raf = 0, rays = null;
    const rayLayers = new Set();
    const stopRig = () => { cancelAnimationFrame(raf); raf = 0; };
    ctx.signal.addEventListener('abort', () => { stopRig(); rayLayers.forEach((layer) => { layer.dead = true; }); }, { once: true });
    function setLimb(el, deg, pivot) {
      if (el && pivot) el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${pivot[0]} ${pivot[1]})`);
    }
    async function gesture(art, cfg, duration, walking) {
      if (!cfg || ctx.motion.reduced) { await ctx.wait(duration); return; }
      const legL = art.querySelector('#legL'), legR = art.querySelector('#legR');
      const tail = art.querySelector('#tail'), paw = art.querySelector('#pawR');
      const open = art.querySelector('#eyes-open'), closed = art.querySelector('#eyes-closed');
      const start = performance.now(), ls = cfg.limbScale ?? 1;
      const reset = () => {
        setLimb(legL, 0, cfg.legL); setLimb(legR, 0, cfg.legR); setLimb(tail, 0, cfg.tail); setLimb(paw, 0, cfg.pawR);
        if (open) open.style.display = ''; if (closed) closed.style.display = 'none';
      };
      function frame(now) {
        const ms = Math.min(duration, now - start), t = ms / duration;
        if (walking) {
          const step = Math.sin(t * Math.PI * 4) * 13 * ls;
          setLimb(legL, step, cfg.legL); setLimb(legR, -step, cfg.legR);
          setLimb(tail, Math.sin(t * Math.PI * 2) * 4 * (cfg.tailScale ?? 1), cfg.tail);
        } else {
          const swing = Math.sin(t * Math.PI * 2);
          if (tail && cfg.tail) setLimb(tail, swing * 6 * (cfg.tailScale ?? 1), cfg.tail);
          else setLimb(paw, Math.sin(t * Math.PI) * (cfg.up ?? 1) * 12 * ls * (cfg.pawScale ?? 1), cfg.pawR);
          if (open && closed) { const shut = ms >= 180 && ms < 290; open.style.display = shut ? 'none' : ''; closed.style.display = shut ? '' : 'none'; }
        }
        if (ms < duration && !ctx.signal.aborted) raf = requestAnimationFrame(frame);
        else { raf = 0; reset(); }
      }
      raf = requestAnimationFrame(frame);
      try { await ctx.wait(duration); } finally { stopRig(); reset(); }
    }
    async function waitNext() {
      if (ctx.isAuto()) { await ctx.wait(60); return; }
      next.hidden = false;
      const listeners = new AbortController();
      try {
        await new Promise((resolve, reject) => {
          next.addEventListener('click', resolve, { signal: listeners.signal });
          document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.closest('select, input, button')) { e.preventDefault(); resolve(); }
          }, { signal: listeners.signal });
          // 自動選項切換時即續演；不需要輪詢或閒置 rAF。
          document.addEventListener('change', () => { if (ctx.isAuto()) resolve(); }, { signal: listeners.signal });
          ctx.signal.addEventListener('abort', () => reject(new DOMException('演出取消', 'AbortError')), { once: true, signal: listeners.signal });
        });
      } finally { listeners.abort(); next.hidden = true; }
    }
    const dispose = () => { ctx.cancel(); style.remove(); scene.remove(); };
    return {
      async open(draw) {
        ctx.audio.tone(240, { type: 'triangle', slide: 170, slideT: .065, d: .065, r: .025, gain: .09 });
        await ctx.wait(160);
        ctx.audio.noiseHit({ type: 'lowpass', f0: 1600, f1: 450, a: .025, d: .18, r: .06, gain: .09 });
        await Promise.all([...scene.querySelectorAll('.stage-curtain')].map((curtain, i) => ctx.animate(curtain,
          ctx.motion.reduced ? [{ opacity: 1 }, { opacity: .2 }] : [{ transform: 'translateX(0)' }, { transform: `translateX(${i ? 84 : -84}%)` }], { duration: 260, easing: 'ease-in-out' })));
        ctx.audio.tone(1200, { type: 'triangle', d: .035, r: .02, gain: .035 });
        await ctx.wait(180);
        for (let i = 0; i < draw.entries.length; i++) {
          const item = draw.entries[i], rarity = item.entry.rarity, legendary = rarity === 'legendary';
          beam.style.color = '#fff'; beam.style.opacity = '.36'; name.style.opacity = '0';
          const actor = document.createElement('div'); actor.className = 'stage-actor'; actor.style.filter = 'brightness(0)';
          const art = ctx.art.create(item.entry), cfg = item.entry.kind === 'char' ? ctx.art.cfg(item.entry.id) : null;
          actor.append(art); scene.append(actor);
          const entrance = cfg ? 520 : 480;
          if (cfg) ctx.audio.tone(130, { type: 'sine', slide: 85, slideT: .065, d: .065, r: .025, gain: .09 });
          const movement = ctx.animate(actor, ctx.motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] : cfg ?
            [{ transform: `translateX(${i % 2 ? 310 : -310}px)` }, { transform: 'translateX(0)' }] :
            [{ transform: 'translateY(-300px)' }, { transform: 'translateY(0) scale(1.14,.86)', offset: .68 }, { transform: 'translateY(-20px)', offset: .84 }, { transform: 'translateY(0)' }], { duration: entrance, easing: 'ease-out' });
          const [entered] = await Promise.all([movement, gesture(art, cfg, entrance, true)]); entered.cancel();
          if (!cfg) ctx.audio.drop();
          if (legendary) {
            ctx.audio.charge(1.05);
            ctx.audio.tone(55, { type: 'sine', a: .08, d: .8, r: .12, gain: .14 });
            await ctx.animate(beam, ctx.motion.reduced ? [{ opacity: .2 }, { opacity: .36 }] :
              [{ opacity: .36 }, { opacity: .08 }, { opacity: .6 }, { opacity: .12 }, { opacity: .42 }, { opacity: .06 }], { duration: 1080 });
            beam.getAnimations().forEach((a) => a.cancel());
          }
          // 露臉與燈色、揭曉音同拍，進場途中不帶稀有度色。
          actor.style.filter = ''; beam.style.color = colors[rarity]; beam.style.opacity = '.95';
          ctx.audio.reveal(rarity);
          if (legendary) {
            ctx.audio.lock(); ctx.flash();
            if (!ctx.motion.reduced) {
              ctx.shake(); rays = window.GachaFx.rays(ctx.center.x, 70 + 238, { fadeIn: .08, hold: 1.3 }); rayLayers.add(rays);
            }
          } else if (rarity === 'epic' && !ctx.motion.reduced) ctx.shake(true);
          ctx.fx.reveal(ctx.center.x, 70 + 238, rarity);
          name.textContent = item.entry.name; name.style.setProperty('--stage-color', colors[rarity]);
          const naming = ctx.animate(name, [{ opacity: 0, transform: 'translateX(-28px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 180 });
          await Promise.all([naming, gesture(art, cfg, 440, false), ctx.wait(holds[rarity])]);
          name.getAnimations().forEach((a) => a.cancel()); name.style.opacity = '0';
          const c = ctx.cards.create(item); c.flipped = true; ctx.onReveal(item.key);
          c.el.classList.add('dealt', 'flipped'); c.el.style.transition = 'none';
          // 舞台層在卡上方，已入扇形的卡不會遮住下一位本尊。
          const transform = `translate(${c.x}px, ${c.y}px) rotate(${ctx.motion.reduced ? 0 : c.rot}deg)`;
          c.el.style.transform = transform;
          await Promise.all([
            ctx.animate(actor, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.35)' }], { duration: ctx.motion.reduced ? 150 : 260 }),
            ctx.animate(c.el, [{ opacity: 0, transform: `translate(${ctx.center.x}px, 330px) scale(.8)` }, { opacity: 1, transform }], { duration: ctx.motion.reduced ? 150 : 320 }),
          ]);
          c.el.getAnimations().forEach((a) => a.cancel()); actor.remove();
          if (rays) { rays.stop(.2); rays = null; }
          beam.style.color = '#fff'; beam.style.opacity = '.36';
          if (i < draw.entries.length - 1) await waitNext();
        }
        await ctx.animate(scene, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }); scene.remove();
        // 最後才進共用總覽，收下不會在舞台仍演出時提早出現。
        ctx.cards.showSummary(draw.entries);
      },
      skip: dispose, dispose,
    };
  },
};
