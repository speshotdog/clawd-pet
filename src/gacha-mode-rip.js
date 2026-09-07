window.GachaModes = window.GachaModes || {};
window.GachaModes.rip = {
  label: '撕包', counts: [5],
  // 抽取前的入口：只在成功撕開時請宿主固定結果，不攔截其他模式的拖包。
  // 手感：拉片在封口左端，拖著它往右，頂條真的被掀起來（繞著還沒撕到的那一端翹起），
  // 底下露出鋸齒缺口與裡面卡片的邊。拖不到七成放手，頂條啪一聲彈回去。
  mountEntry(pack, ctx) {
    const events = new AbortController(), body = pack.querySelector('.pack-body');
    const LID = 16;   // 頂條高度（% of pack）
    const wrap = document.createElement('div');
    wrap.className = 'rip-entry';
    wrap.innerHTML = `
      <div class="rip-gap"><i></i><i></i><i></i></div>
      <div class="rip-lid"></div>
      <div class="rip-tab" title="沿封口往右拉"><b>▸▸</b></div>`;
    const style = document.createElement('style');
    style.textContent = `
      .rip-entry { position:absolute; inset:0; pointer-events:none; }
      .rip-gap { position:absolute; left:6%; right:6%; top:${LID - 3}%; height:9%; background:#0d1220; border-radius:3px; overflow:hidden;
        clip-path:inset(0 100% 0 0); }
      .rip-gap i { position:absolute; left:8%; right:8%; height:3px; border-radius:2px; background:#f3e6c4; opacity:.8; }
      .rip-gap i:nth-child(1) { top:32%; } .rip-gap i:nth-child(2) { top:52%; opacity:.55; } .rip-gap i:nth-child(3) { top:72%; opacity:.35; }
      .rip-lid { position:absolute; inset:0; background:url("gacha-pack.png") center / contain no-repeat;
        clip-path:inset(0 0 ${100 - LID}% 0); filter:drop-shadow(0 3px 3px rgba(0,0,0,.45)); transform-origin:100% 100%; }
      .rip-tab { position:absolute; top:${LID - 8}%; left:2%; width:34px; height:24px; margin-left:-17px; border-radius:6px; pointer-events:auto;
        cursor:ew-resize; touch-action:none; user-select:none; display:grid; place-items:center;
        background:linear-gradient(180deg,#fff3d0,#e2c98f); border:2px solid #1a1a1a; box-shadow:0 2px 0 #1a1a1a, 0 4px 8px rgba(0,0,0,.4);
        color:#1a1a1a; font-size:12px; letter-spacing:-1px; }
      .rip-tab.arm { animation:rip-nudge 1.6s ease-in-out 3; }
      @keyframes rip-nudge { 50% { transform:translateX(6px); } }
      .rip-entry.grabbing .rip-tab { animation:none; cursor:grabbing; box-shadow:0 1px 0 #1a1a1a, 0 2px 4px rgba(0,0,0,.4); transform:translateY(1px); }`;
    pack.append(style, wrap);
    const gap = wrap.querySelector('.rip-gap'), lid = wrap.querySelector('.rip-lid'), tab = wrap.querySelector('.rip-tab');
    tab.classList.add('arm');
    let pointer = null, start = 0, progress = 0, grain = 0, opened = false, rebound = [];
    function paint(p) {
      const edge = 6 + p * 88;                       // 撕到哪裡（% of pack 寬）
      const zig = [];                                 // 鋸齒撕口：沿著撕過的區段上下交錯
      for (let x = 0; x <= edge; x += 4) zig.push(`${x}% ${LID + (Math.round(x / 4) % 2 ? 1.2 : -1.2)}%`);
      // 包身：撕過的部分把頂條挖掉（頂條由 rip-lid 自己畫、自己翹）
      body.style.clipPath = `polygon(0 ${LID}%, ${zig.join(',')}, ${edge}% 0, 100% 0, 100% 100%, 0 100%)`;
      gap.style.clipPath = `inset(0 ${Math.max(0, 100 - p * 100)}% 0 0)`;
      // 頂條：以「還沒撕到的那一端」為軸翹起，撕越多翹越高
      lid.style.transformOrigin = `${edge}% 100%`;
      lid.style.transform = `rotate(${(-14 * p).toFixed(2)}deg) translateY(${(-3 * p).toFixed(1)}px)`;
      lid.style.clipPath = `polygon(0 0, ${edge}% 0, ${edge}% ${LID}%, 0 ${LID}%)`;
      lid.style.opacity = p > 0 ? '1' : '0';
      tab.style.left = `${2 + p * 88}%`;
      tab.style.transform = `rotate(${(-14 * p).toFixed(2)}deg)`;
    }
    paint(0);
    tab.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || pointer !== null || opened) return;
      e.preventDefault(); rebound.forEach((a) => a.cancel()); rebound = [];
      pointer = e.pointerId; start = e.clientX; progress = 0; grain = 0; paint(0);
      wrap.classList.add('grabbing'); tab.setPointerCapture(pointer); ctx.audio.pick?.();
    }, { signal: events.signal });
    tab.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      const r = pack.getBoundingClientRect();
      // 進度＝指標行程 ÷ 封口寬度，再打八折當阻力；用螢幕座標所以縮放不影響門檻
      progress = Math.max(0, Math.min(1, (e.clientX - start) / (r.width * .88) * .8));
      paint(progress);
      const step = Math.floor(progress / .12);
      while (grain < step) { grain++; ctx.audio.noiseHit({ type: 'bandpass', f0: 1800 + grain * 260, q: 2.5, a: .001, d: .028, r: .012, gain: .16 }); }
    }, { signal: events.signal });
    function release(e, cancelled = false) {
      if (e.pointerId !== pointer) return;
      const id = pointer; pointer = null; wrap.classList.remove('grabbing');
      if (tab.hasPointerCapture(id)) tab.releasePointerCapture(id);
      if (!cancelled && progress >= .7) {
        opened = true; paint(1);
        ctx.audio.noiseHit({ type: 'bandpass', f0: 900, f1: 4200, q: .8, a: .01, d: .18, r: .05, gain: .25 });
        Promise.resolve(ctx.start()).then(() => { if (!events.signal.aborted) { opened = false; paint(0); } });
      } else {
        // 彈回：頂條啪回原位、拉片跟著回去
        const p0 = progress; progress = 0; grain = 0;
        const from = { lid: lid.style.transform, tab: tab.style.left };
        paint(0);
        rebound = [
          lid.animate([{ transform: from.lid }, { transform: lid.style.transform }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' }),
          tab.animate([{ left: from.tab }, { left: tab.style.left }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' }),
        ];
        if (p0 > .1) ctx.audio.drop();
      }
    }
    tab.addEventListener('pointerup', (e) => release(e), { signal: events.signal });
    tab.addEventListener('pointercancel', (e) => release(e, true), { signal: events.signal });
    tab.addEventListener('lostpointercapture', (e) => release(e, true), { signal: events.signal });
    return () => {
      events.abort(); if (pointer !== null && tab.hasPointerCapture(pointer)) tab.releasePointerCapture(pointer);
      rebound.forEach((a) => a.cancel()); style.remove(); wrap.remove(); body.style.clipPath = ''; ctx.audio.stop(30);
    };
  },
  create(ctx) {
    const style = document.createElement('style');
    style.textContent = `
      .mode-rip .rip-note { position:absolute; top:465px; width:100%; text-align:center; color:#fff0cf; letter-spacing:.16em; }
      .mode-rip .rip-wrapper { position:absolute; width:150px; height:214px; left:calc(50% - 75px); top:203px; background:url('gacha-pack.png') center/contain no-repeat; }
      .mode-rip .rip-lid { clip-path:inset(0 0 85% 0); }
      .mode-rip .rip-bottom { clip-path:inset(15% 0 0 0); }
    `;
    const note = document.createElement('div'); note.className = 'rip-note'; note.textContent = '點擊最上面一張 · 滑出揭曉';
    ctx.root.append(style, note);
    const ownedCards = [], fans = [];
    const dispose = () => {
      ownedCards.forEach((c, i) => {
        Object.assign(c, fans[i]); c.scale = 1;
        c.el.style.pointerEvents = ''; c.el.style.zIndex = ''; c.el.style.opacity = '';
      });
      ctx.cancel(); style.remove(); note.remove();
    };
    async function topClick(c) {
      const listeners = new AbortController(); c.el.style.pointerEvents = 'auto';
      try {
        await new Promise((resolve, reject) => {
          c.el.addEventListener('click', resolve, { once: true, signal: listeners.signal });
          ctx.signal.addEventListener('abort', () => reject(new DOMException('演出取消', 'AbortError')), { once: true, signal: listeners.signal });
        });
      } finally { listeners.abort(); c.el.style.pointerEvents = 'none'; }
    }
    return {
      async open(draw) {
        const mythic = draw.entries.some(it => it.entry.rarity === 'mythic');
        const lid = document.createElement('div'), bottom = document.createElement('div');
        lid.className = 'rip-wrapper rip-lid'; bottom.className = 'rip-wrapper rip-bottom';
        if (mythic) { lid.classList.add('mythic-pack'); bottom.classList.add('mythic-pack'); }
        ctx.root.append(bottom, lid); ctx.audio.tear();
        await Promise.all([
          ctx.animate(lid, [{ opacity: 1, transform: 'translate(0,0)' }, { opacity: 0, transform: 'translate(150px,-65px) rotate(25deg)' }], { duration: ctx.motion.reduced ? 150 : 360 }),
          ctx.animate(bottom, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(100px)' }], { duration: ctx.motion.reduced ? 150 : 420 }),
        ]);
        lid.remove(); bottom.remove(); ctx.audio.burst();
        // 撕開的瞬間：封口噴出鋁箔亮片＋一團煙，桌子輕震（貼圖粒子）
        if (!ctx.motion.reduced) {
          ctx.shake(true);
          const tx = ctx.center.x, ty = ctx.center.y - 92;
          for (let i = 0; i < 6; i++) ctx.fx.spawn({ sprite: 4, x: tx + (ctx.rng() - .5) * 90, y: ty, vx: (ctx.rng() - .5) * 60, vy: -40 - ctx.rng() * 40, g: -15, r: 18 + ctx.rng() * 14, life: .7, color: '#e9e2d0', grow: true, fadeK: 1, blend: 'source-over' });
          for (let i = 0; i < 34; i++) { const a = -Math.PI / 2 + (ctx.rng() - .5) * 2.2, sp = 160 + ctx.rng() * 360;
            ctx.fx.spawn({ sprite: i % 4 === 0 ? 8 : i % 4 === 1 ? 9 : 14, x: tx + (ctx.rng() - .5) * 80, y: ty, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 520, drag: .985, r: 6 + ctx.rng() * 9, life: .9 + ctx.rng() * .7,
              color: mythic ? window.GachaFx.rainbow[i % 7] : ['#4f8a8b', '#f3e6c4', '#ffd27a', '#9fe3e0'][i % 4], rot: ctx.rng() * 6, vr: (ctx.rng() - .5) * 10, blend: i % 4 === 3 ? 'lighter' : 'source-over', fadeK: 1.3 }); }
        }
        draw.entries.forEach((item) => {
          const c = ctx.cards.create(item); ownedCards.push(c);
          const fan = { x: c.x, y: c.y, rot: c.rot };
          const i = ownedCards.length - 1;
          c.x = ctx.center.x + i * 2; c.y = ctx.center.y + i * 3; c.rot = 0;
          c.el.style.transition = 'none'; c.el.style.zIndex = `${10 - i}`; c.el.style.pointerEvents = 'none';
          c.el.style.transform = `translate(${c.x}px,${c.y}px)`; c.el.classList.add('dealt');
          fans.push(fan);
        });
        for (let i = 0; i < ownedCards.length; i++) {
          const c = ownedCards[i], last = i === ownedCards.length - 1;
          note.textContent = `點擊最上面一張 · ${i + 1} / ${ownedCards.length}`;
          await topClick(c); note.textContent = '';
          // 共用 R 完整負責蓄力、翻面、聲音與特效；滑出時保留 580ms 翻面節拍。
          const start = c.el.style.transform;
          let moving;
          await ctx.cards.reveal(c.key, { deferSummary: true, onFlip() {
            if (!ctx.motion.reduced && !last) for (let k = 0; k < 6; k++) ctx.fx.spawn({ sprite: 5, x: ctx.center.x + 40 + k * 26, y: ctx.center.y + (ctx.rng() - .5) * 120, vx: 240, vy: 0, g: 0, drag: .9, r: 22 + ctx.rng() * 10, life: .35, color: '#fff3d0', shrink: true });
            c.x = last ? ctx.center.x : ctx.center.x + 210; c.y = ctx.center.y; c.scale = last ? 1.12 : 1;
            const target = `translate(${c.x}px,${c.y}px) scale(${c.scale})`;
            moving = ctx.animate(c.el, [{ transform: start }, { transform: target }], { duration: ctx.motion.reduced ? 150 : 580, easing: 'cubic-bezier(.35,.1,.25,1)' })
              .then((a) => { c.el.style.transform = target; a.cancel(); });
            moving.catch(() => {});
          } });
          await moving;
          if (!last) {
            await ctx.wait(240);
            const a = await ctx.animate(c.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
            c.el.style.opacity = '0'; a.cancel();
          } else await ctx.wait(600);
        }
        note.remove();
        await Promise.all(ownedCards.map(async (c, i) => {
          Object.assign(c, fans[i]); c.scale = 1;
          const target = `translate(${c.x}px,${c.y}px) rotate(${ctx.motion.reduced ? 0 : c.rot}deg)`;
          const a = await ctx.animate(c.el, [{ opacity: Number(c.el.style.opacity || 1), transform: c.el.style.transform }, { opacity: 1, transform: target }], { duration: ctx.motion.reduced ? 150 : 480, easing: 'ease-out' });
          c.el.style.transform = target; c.el.style.opacity = ''; a.cancel();
          c.el.style.transition = ''; c.el.style.zIndex = ''; c.el.style.pointerEvents = '';
        }));
        ctx.cards.showSummary(draw.entries);
      },
      skip: dispose, dispose,
    };
  },
};
