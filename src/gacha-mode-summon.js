// 暖白陣只負責召喚；所有稀有度重量留給玩家開始揭曉後的共用 R。
window.GachaModes = window.GachaModes || {};
window.GachaModes.summon = {
  label: '腳印召喚陣', counts: [5],
  create(ctx) {
    const style = document.createElement('style');
    style.textContent = `
      .mode-summon .summon-array { position:absolute; inset:0; width:100%; height:100%; overflow:visible; color:#fff0cf; }
      .mode-summon .summon-ring { fill:none; stroke:currentColor; stroke-width:2; stroke-dasharray:1; stroke-dashoffset:1; }
      .mode-summon .summon-slot { fill:#fff0cf; fill-opacity:.025; stroke:#fff0cf; stroke-opacity:.18; stroke-width:1.5; }
      .mode-summon .summon-slot.on { fill-opacity:.3; stroke-opacity:1; filter:drop-shadow(0 0 8px #fff0cf); }
      .mode-summon .summon-paw { fill:currentColor; transform-box:fill-box; transform-origin:center; }
    `;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${ctx.size.width} ${ctx.size.height}`); svg.classList.add('summon-array');
    const { x, y } = ctx.center;
    svg.innerHTML = `<g transform="translate(${x} ${y + 64}) scale(1 .48)">
      <circle class="summon-ring" r="218" pathLength="1"/><circle class="summon-ring" r="194" pathLength="1"/>
      <path class="summon-ring" pathLength="1" d="M0 -194 L114 157 L-184 -60 L184 -60 L-114 157 Z"/>
      <g class="summon-paw" opacity="0"><ellipse cy="16" rx="31" ry="25"/><ellipse cx="-36" cy="-15" rx="12" ry="17" transform="rotate(-22 -36 -15)"/><ellipse cx="-14" cy="-36" rx="12" ry="18"/><ellipse cx="14" cy="-36" rx="12" ry="18"/><ellipse cx="36" cy="-15" rx="12" ry="17" transform="rotate(22 36 -15)"/></g>
    </g>`;
    const slots = Array.from({ length: 5 }, (_, i) => {
      const slot = document.createElementNS(ns, 'rect');
      slot.classList.add('summon-slot'); slot.setAttribute('x', x - 320 + i * 142);
      slot.setAttribute('y', y + 60 + Math.abs(i - 2) * 7); slot.setAttribute('width', 72);
      slot.setAttribute('height', 35); slot.setAttribute('rx', 6); svg.append(slot); return slot;
    });
    ctx.root.append(style, svg);
    const dispose = () => { ctx.cancel(); style.remove(); svg.remove(); };
    return {
      async open(draw) {
        const paw = svg.querySelector('.summon-paw');
        ctx.audio.tone(110, { type: 'sine', slide: 70, slideT: .08, a: .002, d: .08, r: .025, gain: .18 });
        ctx.audio.noiseHit({ type: 'lowpass', f0: 650, d: .035, gain: .08 });
        await ctx.animate(paw, ctx.motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] :
          [{ opacity: 0, transform: 'scale(1.7)' }, { opacity: 1, transform: 'scale(.94)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 160 });
        ctx.audio.noiseHit({ type: 'bandpass', f0: 1200, f1: 2400, q: 2, a: .02, d: .24, r: .06, gain: .055 });
        await Promise.all([...svg.querySelectorAll('.summon-ring')].map((ring) => ctx.animate(ring,
          [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 440, easing: 'ease-out' })));
        for (let i = 0; i < slots.length; i++) {
          slots[i].classList.add('on');
          ctx.audio.tone([880, 1174, 1568, 1174, 880][i], { type: 'triangle', a: .003, d: .065, r: .035, gain: .025 });
          await ctx.wait(80);
        }
        ctx.audio.tone(196, { type: 'sine', a: .06, d: .26, r: .1, gain: .025 });
        ctx.audio.tone(294, { type: 'sine', a: .06, d: .26, r: .1, gain: .012 });
        await ctx.wait(320);
        // 每張都從自己的暖白卡位立起，再由既有發牌器決定最終扇形。
        await ctx.cards.deal(draw.entries, { stagger: 60, duration: 640,
          from: (_, i) => ({ x: x - 284 + i * 142, y: y + 78 + Math.abs(i - 2) * 7, scale: .48, rotateX: 76 }) });
        const fading = ctx.animate(svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
        await fading; svg.remove();
        await ctx.interact();
      },
      skip: dispose, dispose,
    };
  },
};
