// 腳印召喚陣：一枚腳印蓋下去，召喚陣在桌上亮起、慢慢轉，五根光柱升起，卡從光柱裡浮出來。
// 陣一律暖白（不預告顏色）；所有稀有度的重量留給玩家開始揭曉後的共用 R。
window.GachaModes = window.GachaModes || {};
window.GachaModes.summon = {
  label: '腳印召喚陣', counts: [5],
  create(ctx) {
    const { x: CX, y: CY } = ctx.center;
    const CIRCLE_Y = CY + 70;                  // 陣的中心（躺在桌上，透視壓扁）
    const slotX = (i) => CX - 284 + i * 142, slotY = (i) => CIRCLE_Y - 8 + Math.abs(i - 2) * 6;
    const style = document.createElement('style');
    style.textContent = `
      .mode-summon { perspective: 900px; }
      .mode-summon .sm-circle { position:absolute; left:${CX - 300}px; top:${CIRCLE_Y - 300}px; width:600px; height:600px; opacity:0;
        background:url("gacha-summon-circle.png") center / contain no-repeat; transform:rotateX(62deg) scale(.6);
        filter:drop-shadow(0 0 10px rgba(255,240,196,.5)) drop-shadow(0 0 26px rgba(255,220,150,.3)); }
      .mode-summon .sm-glow { position:absolute; left:${CX - 320}px; top:${CIRCLE_Y - 130}px; width:640px; height:260px; border-radius:50%; opacity:0;
        background:radial-gradient(ellipse, rgba(255,235,190,.55), rgba(255,220,150,.18) 45%, transparent 70%); filter:blur(8px); mix-blend-mode:screen; }
      .mode-summon .sm-paw { position:absolute; left:${CX - 60}px; top:${CIRCLE_Y - 78}px; width:120px; height:120px; opacity:0; transform-origin:50% 60%; }
      .mode-summon .sm-paw path, .mode-summon .sm-paw ellipse { fill:#fff0cf; stroke:#1a1a1a; stroke-width:6; stroke-linejoin:round; }`;
    const circle = document.createElement('div'); circle.className = 'sm-circle';
    const glow = document.createElement('div'); glow.className = 'sm-glow';
    const paw = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    paw.setAttribute('viewBox', '-60 -60 120 120'); paw.classList.add('sm-paw');
    paw.innerHTML = '<ellipse cy="18" rx="30" ry="24"/><ellipse cx="-36" cy="-12" rx="12" ry="17" transform="rotate(-22 -36 -12)"/><ellipse cx="-13" cy="-34" rx="12" ry="18"/><ellipse cx="13" cy="-34" rx="12" ry="18"/><ellipse cx="36" cy="-12" rx="12" ry="17" transform="rotate(22 36 -12)"/>';
    ctx.root.append(style, glow, circle, paw);
    let spin = null;
    const dispose = () => { ctx.cancel(); spin?.cancel(); style.remove(); circle.remove(); glow.remove(); paw.remove(); };
    return {
      async open(draw) {
        const R = ctx.motion.reduced;
        const mythic = draw.entries.some(it => it.entry.rarity === 'mythic');
        if (mythic) {
          circle.classList.add('mythic-circle');
          [...paw.children].forEach((el,i)=>el.style.fill=window.GachaFx.rainbow[i%7]);
        }
        // ---- 蓋印：腳印從上方蓋下來，桌面輕震、揚起一圈灰塵
        ctx.audio.tone(110, { type: 'sine', slide: 70, slideT: .08, a: .002, d: .09, r: .03, gain: .2 });
        await ctx.animate(paw, R ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(2.2) translateY(-40px)' }, { opacity: 1, transform: 'scale(.92)', offset: .7 }, { opacity: 1, transform: 'scale(1)' }], { duration: 200, easing: 'cubic-bezier(.3,0,.7,1)' });
        ctx.audio.noiseHit({ type: 'lowpass', f0: 700, d: .05, gain: .12 });
        if (!R) { ctx.shake(true); for (let k = 0; k < 10; k++) { const a = ctx.rng() * Math.PI * 2;
          ctx.fx.spawn({ sprite: 4, x: CX + Math.cos(a) * 40, y: CIRCLE_Y - 10 + Math.sin(a) * 14, vx: Math.cos(a) * 120, vy: Math.sin(a) * 40 - 20, g: 0, drag: .9, r: 14 + ctx.rng() * 10, life: .55, color: '#d9d0bd', grow: true, fadeK: 1, blend: 'source-over' }); } }
        await ctx.wait(120);
        // ---- 陣亮起：從腳印往外「描」出來（圓形遮罩擴張），同時開始慢轉
        ctx.audio.noiseHit({ type: 'bandpass', f0: 1200, f1: 2600, q: 2, a: .02, d: .4, r: .1, gain: .07 });
        ctx.audio.tone(392, { type: 'sine', a: .3, d: .5, r: .3, gain: .05, to: ctx.audio.verb });
        circle.style.opacity = '1';
        const reveal = ctx.animate(circle, [{ clipPath: 'circle(6% at 50% 50%)' }, { clipPath: 'circle(52% at 50% 50%)' }], { duration: R ? 150 : 620, easing: 'ease-out' });
        spin = circle.animate([{ transform: 'rotateX(62deg) scale(.6) rotateZ(0deg)' }, { transform: 'rotateX(62deg) scale(.6) rotateZ(360deg)' }], { duration: 14000, iterations: 1, easing: 'linear' });
        ctx.animate(glow, [{ opacity: 0 }, { opacity: 1 }], { duration: 700 }).catch(() => {});
        await reveal;
        // 陣描完的瞬間：一圈亮片沿著外環跑一圈
        if (!R) for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2;
          ctx.fx.spawn({ sprite: 14, x: CX + Math.cos(a) * 290, y: CIRCLE_Y + Math.sin(a) * 130, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 26, g: 0, drag: .97, r: 5 + ctx.rng() * 4, life: .5 + ctx.rng() * .3, color: '#fff0cf', shrink: true }); }
        await ctx.wait(160);
        // ---- 五根光柱依序升起（每 90ms 一根，暖白），根部有亮片往上飄
        for (let i = 0; i < 5; i++) {
          const x = slotX(i), y = slotY(i);
          ctx.audio.tone([784, 880, 988, 880, 784][i], { type: 'triangle', a: .004, d: .12, r: .08, gain: .04, to: ctx.audio.verb });
          if (!R) {
            let t = 0; ctx.fx.layer({ dead: false, update(dt) { t += dt; if (t > 1.4) this.dead = true; if (ctx.rng() < .5) ctx.fx.spawn({ sprite: 14, x: x + (ctx.rng() - .5) * 36, y: y + 6, vx: 0, vy: -50 - ctx.rng() * 60, g: -20, r: 4 + ctx.rng() * 3, life: .7, color: '#fff3d0', shrink: true }); },
              draw(c) { const k = Math.min(1, t / .25) * (t > 1.1 ? Math.max(0, (1.4 - t) / .3) : 1); window.GachaFx.blit(c, 15, '#fff3d0', x, y - 110, 120, 260, k * .9); } });
          }
          await ctx.wait(90);
        }
        await ctx.wait(260);
        // ---- 卡從光柱裡浮出來，直立到扇形
        await ctx.cards.deal(draw.entries, { stagger: 70, duration: 640, from: (_, i) => ({ x: slotX(i), y: slotY(i) + 10, scale: .45, rotateX: 74 }) });
        // ---- 陣慢慢退場
        await Promise.all([ctx.animate(circle, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }), ctx.animate(glow, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }), ctx.animate(paw, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 })]);
        spin?.cancel(); circle.remove(); glow.remove(); paw.remove();
        await ctx.interact();
      },
      skip: dispose, dispose,
    };
  },
};
