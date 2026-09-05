window.GachaModes = window.GachaModes || {};
window.GachaModes.hearthstone = {
  label: '拆包桌面', counts: [1, 5, 10],
  create(ctx) {
    const style = document.createElement('style');
    style.textContent = '.mode-hearthstone .pack { pointer-events:none }';
    ctx.root.append(style);
    const cleanup = () => ctx.root.replaceChildren();
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true; ctx.cancel(); cleanup();
    };
    return {
      async open(draw) {
        // 拖曳完成前不建立演出；此處的包是宿主交付的視覺副本。
        const pack = ctx.root.querySelector('.pack'), tilt = pack.querySelector('.pack-tilt');
        const strip = pack.querySelector('.pack-strip'), body = pack.querySelector('.pack-body');
        ctx.audio.noiseHit({ d: .06, gain: .09, f0: 1800, f1: 900 });
        await ctx.animate(tilt, ctx.motion.reduced ? [{ opacity: .8 }, { opacity: 1 }] :
          [{ transform: 'none' }, { transform: 'translateY(3px) scaleX(.98)' }], { duration: 120 });
        // 撕裂控制在 240ms，為後面的輕落點留出空間。
        for (let i = 0; i < 10; i++) ctx.audio.noiseHit({
          t: ctx.audio.now() + i * .021, a: .001, d: .016, r: .008,
          gain: .14, f0: 1800 + i * 220, q: 3,
        });
        strip.style.opacity = '1';
        await ctx.animate(strip, ctx.motion.reduced ? [{ opacity: 1 }, { opacity: 0 }] :
          [{ transform: 'none', opacity: 1 }, { transform: `translate(90px,-140px) rotate(${ctx.rng() * 12 - 6}deg)`, opacity: 0 }],
        { duration: ctx.motion.reduced ? 150 : 240 });
        if (ctx.motion.reduced) await ctx.wait(90);
        ctx.audio.tone(95, { slide: 55, a: .003, d: .18, r: .05, gain: .18 });
        ctx.audio.noiseHit({ type: 'lowpass', f0: 1200, f1: 500, a: .003, d: .10, r: .04, gain: .09 });
        const glow = pack.querySelector('.pack-glow');
        ctx.animate(glow, [{ opacity: 0 }, { opacity: .25 }, { opacity: 0 }], { duration: 140 }).catch(() => {});
        await ctx.animate(body, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
        pack.hidden = true;
        await ctx.cards.deal(draw.entries, { stagger: draw.entries.length === 10 ? 50 : 80, duration: 500 });
        cleanup();
        await ctx.interact();
      },
      skip: dispose, dispose,
    };
  },
};
