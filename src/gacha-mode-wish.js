window.GachaModes = window.GachaModes || {};
window.GachaModes.wish = {
  label: '流星投遞', counts: [1, 5, 10],
  create(ctx) {
    const style = document.createElement('style');
    style.textContent = `
      .mode-wish .wish-night { position:absolute; inset:65px 25px 90px; border-radius:50%; background:radial-gradient(ellipse,#101e3bc9,transparent 72%); }
      .mode-wish .wish-envelope { position:absolute; width:72px; height:72px; margin:-36px; overflow:visible; }
      .mode-wish .wish-stack { position:absolute; width:54px; height:76px; margin:-38px -27px; border:3px solid #161b28; border-radius:7px; background:#244b63; box-shadow:4px 3px 0 #d4b27a,8px 6px 0 #162637; }
      .mode-wish .wish-preview { position:absolute; left:360px; top:100px; width:220px; text-align:center; color:var(--wish-color,#eee); font-size:13px; letter-spacing:.12em; }
    `;
    ctx.root.append(style);
    const night = document.createElement('div'); night.className = 'wish-night';
    const envelope = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    envelope.setAttribute('viewBox', '0 0 72 72'); envelope.classList.add('wish-envelope');
    envelope.innerHTML = '<path d="M36 3 69 36 36 69 3 36Z" fill="#f4dfb4" stroke="#161b28" stroke-width="3"/><path d="m4 35 32 9 32-9M36 44v24" fill="none" stroke="#8e7156" stroke-width="3"/><path d="m28 29 8-6 8 6-8 8Z" fill="#579fa9" stroke="#161b28" stroke-width="2"/>';
    const preview = document.createElement('div'); preview.className = 'wish-preview';
    ctx.root.append(night, envelope, preview);
    const cleanup = () => ctx.root.replaceChildren();
    let disposed = false;
    const dispose = () => { if (!disposed) { disposed = true; ctx.cancel(); cleanup(); } };
    function pose(x, y, scale) {
      envelope.style.left = `${x}px`; envelope.style.top = `${y}px`;
      envelope.style.transform = `scale(${scale})`;
    }
    return {
      async open(draw) {
        const order = ['common', 'rare', 'epic', 'legendary'];
        const rank = Math.max(...draw.entries.map((item) => order.indexOf(item.entry.rarity)));
        const rarity = order[rank], color = ['#9d9d9d', '#0070dd', '#a335ee', '#ff8000'][rank];
        const { x, y } = ctx.center;
        pose(x, y, 1);
        ctx.audio.tone(440, { type: 'triangle', slide: 660, a: .003, d: .09, r: .03, gain: .10 });
        const compression = await ctx.animate(envelope, ctx.motion.reduced ? [{ opacity: .7 }, { opacity: 1 }] :
          [{ transform: 'scale(1)' }, { transform: 'scale(.92)' }], { duration: 120 });
        compression.cancel();
        const flightAudio = ctx.audio.createScope();
        flightAudio.noiseHit({ type: 'bandpass', f0: 700, f1: 2800, q: .7, a: .10, d: .48, r: .12, gain: .10 });
        const launch = await ctx.animate(envelope, ctx.motion.reduced ? [{ opacity: .65 }, { opacity: 1 }] : [
          { left: `${x}px`, top: `${y}px`, transform: 'scale(.92)' },
          { left: '800px', top: '130px', transform: 'scale(.45)' },
        ], { duration: ctx.motion.reduced ? 150 : 360, easing: 'ease-in' });
        if (ctx.motion.reduced) await ctx.wait(210);
        launch.cancel();
        if (ctx.motion.reduced) pose(x, y, 1);
        else pose(800, 130, .45);
        // 三條固定方向曲線只偏移控制點；結果與揭曉順序不受演出亂數影響。
        const path = [[690, 20, 430, 90], [710, 35, 470, 65], [670, 45, 420, 110]][Math.floor(ctx.rng() * 3)];
        const jitter = ctx.rng() * 24 - 12;
        const point = (t) => ({
          x: (1-t)**3*800 + 3*(1-t)**2*t*(path[0]+jitter) + 3*(1-t)*t*t*path[2] + t**3*x,
          y: (1-t)**3*130 + 3*(1-t)**2*t*path[1] + 3*(1-t)*t*t*(path[3]+jitter) + t**3*(y-72),
        });
        let age = 0, ended = false;
        if (!ctx.motion.reduced) ctx.fx.layer({ dead: false,
          update(dt) {
            age += dt;
            const p = point(Math.min(1, age / .56)); pose(p.x, p.y, .45);
            this.dead = ended;
          },
          draw(c) {
            const t = Math.min(1, age / .56), p = point(t);
            c.save(); c.lineCap = 'round'; c.globalCompositeOperation = 'lighter';
            const blend = Math.max(0, Math.min(1, (age - .24) / .16));
            const rgb = [[157,157,157],[0,112,221],[163,53,238],[255,128,0]][rank];
            c.strokeStyle = `rgb(${rgb.map((v) => Math.round(255 + (v-255)*blend)).join(',')})`;
            c.shadowColor = c.strokeStyle; c.shadowBlur = 14;
            c.lineWidth = [3,5,5,8][rank];
            function tail(delay, offset) {
              c.beginPath();
              for (let i = 0; i <= 12; i++) {
                const q = point(Math.max(0, t - delay - (12-i)*.014));
                c.lineTo(q.x, q.y + offset);
              }
              c.stroke();
            }
            tail(0, 0);
            if (rank === 2) tail(.04/.56, 6);
            if (rank === 3 && age >= .56) {
              c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(p.x+24,p.y-46);
              c.moveTo(p.x,p.y); c.lineTo(p.x-14,p.y-48); c.stroke();
            }
            // 流星頭：一顆亮核，稀有度越高越大
            const head = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, [10,14,16,22][rank]);
            head.addColorStop(0, 'rgba(255,255,255,.95)'); head.addColorStop(.35, c.strokeStyle); head.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = head; c.beginPath(); c.arc(p.x, p.y, [10,14,16,22][rank], 0, Math.PI * 2); c.fill();
            if (rank > 0) {
              c.fillStyle = '#fff'; c.beginPath();
              c.moveTo(p.x,p.y-5); c.lineTo(p.x+5,p.y); c.lineTo(p.x,p.y+5); c.lineTo(p.x-5,p.y); c.fill();
            }
            c.restore();
          },
        });
        // 12 粒尾屑有固定短壽命，不隨每幀重生。
        if (!ctx.motion.reduced) for (let i = 0; i < 12; i++) {
          const p = point(i / 18);
          ctx.fx.spawn({ x:p.x, y:p.y, vx:10, vy:12, r:1.3, life:.56, color:'#ddd', shrink:true });
        }
        await ctx.wait(240);
        ctx.root.style.setProperty('--wish-color', color);
        preview.textContent = `${['• 普通','◇ 精良','◇◇ 史詩','♛ 傳說'][rank]} · 本次最高`;
        if (rank) flightAudio.tone([0,880,1174,1568][rank], {
          a:.015, d:.18, r:.10, gain:.05, to:flightAudio.verb,
        });
        if (rank === 2) flightAudio.tone(1761, { a:.015, d:.18, r:.10, gain:.025, to:flightAudio.verb });
        if (rank === 3) flightAudio.tone(62, { a:.02, d:.12, r:.04, gain:.07 });
        await ctx.wait(290);
        flightAudio.stop(30);
        await ctx.wait(30);
        // 傳說固定留白 120ms；提示迴響在 1040ms 前由獨立短出口收乾。
        if (rank !== 3 && !ctx.motion.reduced) {
          ended = true;
          ctx.animate(envelope, [{ top:`${y-72}px` }, { top:`${y-24}px` }], { duration:120 }).catch(() => {});
        }
        await ctx.wait(120);
        ended = true;
        ctx.audio.tone(rank === 3 ? 75 : 120, { slide:rank === 3 ? 45 : 75,
          a:rank === 3 ? .004 : .003, d:rank === 3 ? .24 : .15, r:rank === 3 ? .07 : .04, gain:rank === 3 ? .22 : .16 });
        const stack = document.createElement('div'); stack.className = 'wish-stack';
        stack.style.left = `${x}px`; stack.style.top = `${y}px`; ctx.root.append(stack);
        ctx.animate(stack, [{ opacity:0 }, { opacity:1 }], { duration:150, delay:90 }).catch(() => {});
        const landing = await ctx.animate(envelope, ctx.motion.reduced ? [{ opacity:0 }, { opacity:1 }] : [
          { left:`${x}px`, top:`${y-(rank === 3 ? 72 : 24)}px`, transform:'scale(.45)' },
          { left:`${x}px`, top:`${y}px`, transform:'scale(1)', opacity:0 },
        ], { duration:ctx.motion.reduced ? 150 : 240, easing:'ease-in' });
        if (ctx.motion.reduced) await ctx.wait(90);
        landing.cancel(); envelope.remove(); stack.remove();
        await ctx.cards.deal(draw.entries, { stagger:draw.entries.length === 10 ? 40 : 60, duration:400, quiet:true });
        cleanup();
        await ctx.interact();
      },
      skip:dispose, dispose,
    };
  },
};
