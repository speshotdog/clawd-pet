// 拆包桌面：實體收藏卡的節奏——撕開、爆光、五張甩出來、自己挑先翻哪張。
// 這是第一版就定案的手感（使用者回饋：回饋感最好），模式化之後原封不動搬進來：
// 撕條飛走 420ms → 白閃＋鋁箔碎片＋整桌震 → 140ms 後開始發牌（每張 95ms、帶回彈）。
window.GachaModes = window.GachaModes || {};
window.GachaModes.hearthstone = {
  label: '拆包桌面', counts: [1, 5, 10],
  create(ctx) {
    let disposed = false;
    const cleanup = () => ctx.root.replaceChildren();
    const dispose = () => { if (disposed) return; disposed = true; ctx.cancel(); cleanup(); };
    return {
      async open(draw) {
        // 卡包是宿主交付的視覺副本（原本那顆留在原位隱藏，拖曳手感不動）
        const pack = ctx.root.querySelector('.pack');
        const mythic = draw.entries.some(it => window.GachaPool.shownRarity(it) === 'mythic');
        if (mythic) pack?.classList.add('mythic-pack');
        if (pack && !ctx.motion.reduced) {
          pack.classList.add('tearing');
          ctx.audio.tear();
          await ctx.wait(430);
          pack.classList.add('burst');
          ctx.flash();
          ctx.audio.burst();
          ctx.fx.packBurst(ctx.center.x, ctx.center.y);
          if (mythic) { ctx.fx.reveal(ctx.center.x,ctx.center.y,'mythic'); ctx.fx.rainbowRing(ctx.center.x,ctx.center.y); }
          ctx.shake();
          await ctx.wait(140);
        } else if (pack) {
          ctx.audio.burst();
          await ctx.animate(pack, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
        }
        const dealing = ctx.cards.deal(draw.entries, { stagger: draw.entries.length === 10 ? 50 : 95, duration: 620 });
        ctx.wait(500).then(() => { if (pack) pack.hidden = true; }).catch(() => {});
        await dealing;
        cleanup();
        await ctx.interact();
      },
      skip: dispose, dispose,
    };
  },
};
