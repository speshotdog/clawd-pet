// 裝幀典藏第一輪：edition fallback 是演出用假資料，不是身分模型或抽樣政策。
// entry.edition 優先；?edition=all|mixed|none，預設 mixed（固定 seed，前兩張精美）。
// 不回寫 entry、draw、rarity、veil、pending 或任何存檔。
window.GachaModes = window.GachaModes || {};
window.GachaModes.deluxe = {
  label: '裝幀典藏', counts: [1, 5, 10],
  create(ctx) {
    const R = ctx.motion.reduced, sound = ctx.audio.createScope();
    const listeners = new AbortController(), animations = new Set(), transient = new Set();
    const records = [], opened = new Set();
    let draw, ready = false, busy = false, complete = false, disposed = false, finishOpen;
    let forceAll = false, seed = 0xD31A2026;
    const editionMode = new URLSearchParams(location.search).get('edition') || 'mixed';
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const check = () => {
      if (disposed || ctx.signal.aborted) throw new DOMException('裝幀已取消', 'AbortError');
    };
    const wait = async (ms) => { await ctx.wait(ms); check(); };
    // 模式自己的動畫在完成時取消 fill；不留下常駐 compositor layer。
    async function animate(el, frames, duration, delay = 0) {
      check();
      if (!el.animate) { await wait(duration + delay); return; }
      const a = el.animate(frames, { duration, delay, fill: 'backwards', easing: 'cubic-bezier(.22,.8,.3,1)' });
      animations.add(a);
      try { await a.finished; check(); }
      finally { a.cancel(); animations.delete(a); }
    }
    const node = (cls, parent, text) => {
      const el = document.createElement('div'); el.className = cls;
      if (text) el.textContent = text;
      parent.append(el); return el;
    };
    const style = document.createElement('style');
    style.textContent = `
      body.dl-scroll { overflow:auto; }
      .mode-deluxe { perspective:1200px; }
      .mode-deluxe .dl-room { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 35%,#414239,#151d1c 70%); }
      .mode-deluxe .dl-book { position:absolute; inset:132px 32px 114px; border:9px solid #3c2820; border-radius:12px;
        box-shadow:0 18px 26px #0009,inset 0 0 0 2px #b29863; transform-origin:50% 50%;
        background:linear-gradient(90deg,transparent 49%,#45352655 50%,transparent 51%),repeating-linear-gradient(12deg,#e2d3ae 0 2px,#daceb0 3px 4px); }
      .mode-deluxe .dl-book::before { content:''; position:absolute; inset:12px; border:1px solid #8d7956; border-radius:3px; }
      .mode-deluxe .dl-heading { position:absolute; top:74px; left:52px; color:#eee0bd; font:24px Georgia,'Microsoft JhengHei',serif; letter-spacing:.28em; }
      .mode-deluxe .dl-heading small { display:block; font-size:10px; letter-spacing:.4em; margin-top:8px; color:#baa783; }
      .mode-deluxe .dl-slot { position:absolute; width:158px; height:222px; margin:-111px 0 0 -79px; border:1px solid #806b48; border-radius:8px;
        background:#9c876526; box-shadow:inset 0 2px 7px #3b2a3333; }
      .mode-deluxe .dl-slot::before { content:''; position:absolute; inset:5px; border:1px solid #f8e8ba80; border-radius:5px; }
      .mode-deluxe .dl-slot::after { content:attr(data-number); position:absolute; bottom:-19px; left:calc(50% - 12px); width:24px; color:#554831;
        font:10px Georgia,serif; text-align:center; border-top:2px dotted #a38b57; }
      .mode-deluxe .dl-strap { position:absolute; top:148px; left:40px; right:40px; height:9px; background:linear-gradient(#e7c784,#6f5837 50%,#c9ae76); box-shadow:0 3px 4px #0006; }
      .mode-deluxe .dl-press { position:absolute; top:93px; left:calc(50% - 31px); width:62px; height:62px; border-radius:50%;
        color:#ddc699; background:radial-gradient(circle at 30% 20%,#b39463,#463624 65%); box-shadow:0 8px 0 #291e16,0 12px 14px #0008,inset 0 0 0 4px #b69a61; }
      .mode-deluxe .dl-press svg { width:100%; height:100%; }
      .mode-deluxe .dl-footer { position:absolute; top:536px; width:100%; display:flex; flex-direction:column; align-items:center; gap:8px; color:#eee0bd; font:13px 'Microsoft JhengHei',serif; }
      .mode-deluxe .dl-all { pointer-events:auto; min-height:44px; padding:8px 24px; border:1px solid #b59a66; background:#28332f; color:#f5e5c1; border-radius:5px; cursor:pointer; }
      .mode-deluxe .dl-all:focus-visible, .dl-card .dl-hit:focus-visible { outline:3px solid #fff2ba; outline-offset:5px; }
      .mode-deluxe .dl-all:disabled { opacity:.5; cursor:default; }
      .dl-card { animation:none !important; pointer-events:none !important; }
      .dl-card .card-back { background:repeating-linear-gradient(45deg,#263735 0 2px,#293b38 2px 4px) !important; box-shadow:inset 0 0 0 3px #88704c,inset 0 0 0 8px #243632 !important; }
      .dl-card .card-back > *, .dl-card .card-back::before, .dl-card .card-back::after { display:none !important; }
      .dl-card .card-glow, .dl-card .back-leak, .dl-card .back-motes, .dl-card .back-sweep { display:none !important; }
      .dl-card.dl-focus.charging .card-glow { display:block !important; }
      .dl-card:not(.dl-focus) *, .dl-card:not(.dl-focus)::after { animation:none !important; }
      .dl-card:not(.dl-focus) .card-lift { transform:none !important; }
      .dl-card .face-holo, .dl-card .face-glare, .dl-card .face-embers, .dl-card .face-sheen { display:none !important; }
      .dl-card .dl-wax { display:block !important; position:absolute; left:50%; top:50%; width:48px; height:48px; margin:-24px; border-radius:46%;
        background:radial-gradient(circle at 35% 25%,#c07961,#803e34 70%); box-shadow:0 4px 1px #422420,inset 0 0 0 5px #a95c49; }
      .dl-card .dl-wax::after { content:'◇'; position:absolute; inset:0; display:grid; place-items:center; color:#e5b19a; font-size:30px; }
      .dl-card .dl-slit { display:block !important; position:absolute; top:32%; bottom:32%; left:49%; width:2%; background:#f9efc7; box-shadow:0 0 12px #ffe8ab; opacity:0; }
      .dl-card .dl-hit { position:absolute; inset:0; z-index:30; width:100%; height:100%; min-width:54px; min-height:54px; border:0; border-radius:12px; background:transparent; pointer-events:auto; cursor:pointer; }
      .dl-card .dl-hit:disabled { cursor:default; }
      .dl-card .dl-effect { position:absolute; inset:-6px; z-index:20; pointer-events:none; border-radius:14px; }
      .dl-card .dl-foil { background:linear-gradient(45deg,#f9e3a9b0,transparent 25% 75%,#f9e3a9b0),linear-gradient(-45deg,#93d7c0b0,transparent 25% 75%,#93d7c0b0); }
      .dl-card .dl-gem { background:radial-gradient(ellipse at 50% 5%,#e4fff6,transparent 28%); }
      .dl-card .dl-ink { border:4px double #d6bd83; box-shadow:inset 0 0 0 4px #173c35; }
      .dl-card .dl-particles { background:radial-gradient(circle at 10% 20%,#ead4a0 0 1px,transparent 2px),radial-gradient(circle at 90% 30%,#ead4a0 0 2px,transparent 3px),radial-gradient(circle at 30% 75%,#ead4a0 0 1px,transparent 2px),radial-gradient(circle at 80% 85%,#ead4a0 0 1px,transparent 2px); }
      @media (prefers-reduced-motion:reduce) {
        .mode-deluxe *, .dl-card, .dl-card *, .dl-card::after { animation:none !important; transition:none !important; }
        .dl-card .dl-particles, .dl-card .dl-foil, .dl-card .dl-gem { display:none !important; }
      }`;
    const scene = node('dl-room', ctx.root);
    const heading = node('dl-heading', scene, '裝幀典藏');
    const subtitle = document.createElement('small'); subtitle.textContent = '編目 · 裝幀 · 壓印'; heading.append(subtitle);
    const book = node('dl-book', scene), slots = node('dl-slots', scene);
    const strap = node('dl-strap', scene), press = node('dl-press', scene);
    press.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12 49 30 32 50 15 30Z M21 30H43 M32 12V50" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const footer = node('dl-footer', scene), status = node('dl-status', footer, '正在編目');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const all = document.createElement('button'); all.className = 'dl-all'; all.type = 'button';
    all.textContent = '全部壓印'; all.disabled = true; footer.append(all);
    book.hidden = strap.hidden = press.hidden = true;
    ctx.root.append(style); document.body.classList.add('dl-scroll');

    function layout(i, count) {
      return { x: count === 1 ? ctx.center.x : ctx.center.x + (i % 5 - 2) * 164,
        y: count === 10 ? (i < 5 ? 224 : 416) : 330, rot: 0, scale: count === 10 ? .82 : 1 };
    }
    // 180–480：只建槽。edition 留在閉包，不放到卡背、ARIA 或 DOM dataset。
    function makeSlots() {
      draw.entries.forEach((item, i) => {
        const pos = layout(i, draw.entries.length), slot = node('dl-slot', slots);
        slot.style.left = pos.x + 'px'; slot.style.top = pos.y + 'px'; slot.style.transform = `scale(${pos.scale})`;
        slot.dataset.number = String(i + 1).padStart(2, '0');
        const sample = random();
        const edition = item.entry.edition ?? (editionMode === 'all' || (editionMode !== 'none' && editionMode !== 'all' && (i < 2 || sample < .35)) ? 'deluxe' : 'standard');
        records.push({ item, pos, slot, edition });
      });
    }
    function makeCards() {
      records.forEach((r, i) => {
        r.card = ctx.cards.create(r.item); Object.assign(r.card, r.pos);
        const el = r.card.el; el.classList.add('dl-card'); el.style.pointerEvents = 'none'; el.style.animation = 'none';
        r.wax = node('dl-wax', el.querySelector('.card-back'));
        r.slit = node('dl-slit', el.querySelector('.card-back'));
        r.hit = document.createElement('button'); r.hit.className = 'dl-hit'; r.hit.type = 'button'; r.hit.disabled = true;
        r.hit.setAttribute('aria-label', `壓印揭曉第 ${i + 1} 張`); el.append(r.hit);
      });
    }
    // 永久部分只留在本次卡面的 DOM；skip 移除 style 後仍能保留靜態版本徽記。
    function finishMaterial(r) {
      if (r.badge) return;
      const face = r.card.el.querySelector('.card-face');
      const sleeve = node('dl-sleeve', face);
      sleeve.style.cssText = `position:absolute;inset:2px;border-radius:10px;pointer-events:none;z-index:8;border:${r.edition === 'deluxe' ? '3px double #d5c08d' : '1px solid #e9dab080'};box-shadow:inset 0 0 0 1px #ffffff30;background:linear-gradient(125deg,#ffffff12,transparent 30% 80%,#ffffff0b);`;
      r.badge = node('dl-badge', sleeve, r.edition === 'deluxe' ? '◆ 精美' : '普通');
      r.badge.style.cssText = 'position:absolute;right:3px;top:3px;padding:3px 5px;border:1px solid #c4ad78;border-radius:3px;background:#203b34;color:#f5e5bc;font:10px Georgia,serif;';
    }
    // 精美四層同拍開始；900ms 統一移除。普通只用一層灰塵與紙面回彈。
    async function material(r) {
      check(); finishMaterial(r);
      const duration = R ? 150 : r.edition === 'deluxe' ? 900 : 320;
      if (R) { await animate(r.badge, [{ opacity: .35 }, { opacity: 1 }], duration); return; }
      const types = r.edition === 'deluxe' ? ['foil', 'gem', 'ink', 'particles'] : ['particles'];
      const layers = types.map(type => { const el = node('dl-effect dl-' + type, r.card.el); transient.add(el); return el; });
      try {
        await Promise.all([
          ...layers.map((el, i) => animate(el, i === 0 && r.edition === 'deluxe' ? [
            { opacity: 0, transform: 'scale(1.22)' }, { opacity: 1, transform: 'scale(1)', offset: .35 }, { opacity: 0, transform: 'scale(.12)' },
          ] : [{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)', offset: .2 },
            { opacity: 0, transform: types[i] === 'particles' ? 'translateY(25px) scale(1.15)' : 'scale(1.15)' }], duration)),
          animate(r.badge, [{ opacity: .2, transform: 'scale(1.45)' }, { opacity: 1, transform: 'scale(1)' }], 150),
          ...(r.edition === 'deluxe' ? [] : [animate(r.card.el.querySelector('.card-face'), [
            { transform: 'rotateY(180deg) scale(1)' }, { transform: 'rotateY(180deg) scale(1.04,.96)', offset: .3 }, { transform: 'rotateY(180deg) scale(1)' },
          ], 320)]),
        ]);
      } finally { layers.forEach(el => { el.remove(); transient.delete(el); }); }
    }
    function controls() {
      all.disabled = !ready || busy || complete;
      records.forEach(r => { if (r.hit) r.hit.disabled = !ready || busy || opened.has(r.item.key); });
    }
    function run(promise) {
      promise.catch(err => {
        if (err.name === 'AbortError') return;
        console.error('裝幀典藏', err);
        skip(); ctx.cards.showSummary(draw.entries);
      });
    }
    function freezeCards() {
      records.forEach(r => {
        if (!r.card) return;
        r.card.el.getAnimations({ subtree: true }).forEach(a => a.cancel());
        r.card.el.classList.remove('dl-focus', 'mythic-ripple');
        // 只凍結材質，不蓋掉宿主收下時卡片本身的飛行／化塵。
        r.card.el.querySelectorAll('.face-sheen,.face-holo,.face-glare,.face-embers,.card-glow').forEach(el => { el.style.display = 'none'; });
        r.hit?.remove(); r.wax?.remove(); r.slit?.remove();
      });
    }
    async function conclude() {
      status.textContent = '全部完成'; complete = true; controls();
      await wait(180);
      freezeCards(); scene.remove();
      // deferSummary 不會自行 finish；interact() 也只等 done，必須明確 showSummary。
      const done = ctx.interact(); done.catch(() => {});
      ctx.cards.showSummary(draw.entries);
      await done; cleanup(); finishOpen?.();
    }
    async function reveal(r) {
      if (!ready || busy || complete || disposed || opened.has(r.item.key)) return;
      busy = true; controls(); r.card.el.classList.add('dl-focus');
      status.textContent = `壓印第 ${records.indexOf(r) + 1} 張`;
      let finishing = null;
      try {
        // 互動 0–220：先碎蠟，220ms 才交给共用翻牌；傳說／神話節奏完全由 runtime 保留。
        sound.noiseHit({ type: 'highpass', f0: 1900, d: .07, r: .08, gain: .14 });
        if (!R) r.wax.style.clipPath = 'polygon(0 0,45% 0,39% 25%,48% 50%,40% 70%,49% 100%,0 100%,0 0,55% 0,100% 0,100% 100%,59% 100%,50% 70%,58% 50%,49% 25%,55% 0)';
        await Promise.all([
          animate(r.wax, R ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'scale(1)' },
            { opacity: 1, transform: 'scale(.85)', offset: .25 }, { opacity: 0, transform: 'scale(1.7) rotate(18deg)' }], R ? 150 : 220),
          animate(r.slit, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], R ? 150 : 220),
        ]);
        r.wax.remove();
        await ctx.cards.reveal(r.item.key, { deferSummary: true,
          onFlip() {
            if (r.item.veil) return; // 轉彩必須等 runtime 還原真實框，不能在精良假框上封裝。
            finishing = wait(R ? 390 : 580).then(() => material(r));
            finishing.catch(() => {});
          },
          onUnveil() {
            finishing = material(r); finishing.catch(() => {});
          },
        });
        check();
        if (!finishing) finishing = material(r);
        await finishing; check(); opened.add(r.item.key);
        r.card.el.classList.remove('dl-focus'); r.hit.hidden = true;
        status.textContent = `逐張翻 · ${opened.size} / ${records.length} 完成`;
      } finally { busy = false; controls(); }
      if (opened.size === records.length) await conclude();
      else if (forceAll || ctx.isAuto()) { await wait(80); await reveal(records.find(next => !opened.has(next.item.key))); }
    }
    all.addEventListener('click', () => { forceAll = true; run(reveal(records.find(r => !opened.has(r.item.key)))); }, { signal: listeners.signal });
    // 攔住本模式的卡面 hover／點擊，避免 runtime 自動翻牌提前結算或聲音洩漏 rarity。
    const cardRecord = event => records.find(r => r.card?.el.contains(event.target));
    document.addEventListener('click', event => {
      const r = cardRecord(event);
      if (r) { event.stopImmediatePropagation(); event.preventDefault(); if (!r.hit.hidden) run(reveal(r)); }
      else if (event.target.closest('#reveal-all')) {
        event.stopImmediatePropagation(); forceAll = true;
        if (ready && !busy && !complete) run(reveal(records.find(next => !opened.has(next.item.key))));
      }
    }, { capture: true, signal: listeners.signal });
    for (const type of ['pointerover', 'pointermove']) document.addEventListener(type, event => {
      if (cardRecord(event)) event.stopImmediatePropagation();
    }, { capture: true, signal: listeners.signal });
    document.addEventListener('change', event => {
      if (!event.target.matches('#reveal-policy')) return;
      event.stopImmediatePropagation(); forceAll = false;
      if (ready && !busy && !complete && ctx.isAuto()) run(reveal(records.find(r => !opened.has(r.item.key))));
    }, { capture: true, signal: listeners.signal });
    function cleanup() {
      listeners.abort(); animations.forEach(a => a.cancel()); animations.clear();
      transient.forEach(el => el.remove()); transient.clear(); sound.stop(30);
      scene.remove(); style.remove(); document.body.classList.remove('dl-scroll');
    }
    function dispose() {
      if (disposed) return;
      disposed = true; ready = false; cleanup(); freezeCards(); finishOpen?.(); ctx.cancel();
    }
    function skip() {
      if (!disposed && draw) {
        // 開場任何時間 skip 都先建立相同 layout 與靜態 edition；宿主接著 showSummary。
        if (!records.length) makeSlots();
        if (!records[0]?.card) makeCards();
        records.forEach(finishMaterial);
      }
      dispose();
    }
    ctx.signal.addEventListener('abort', dispose, { once: true });
    return {
      async open(value) {
        check(); draw = value;
        if (draw.entries.length === 10) book.style.bottom = '94px';
        const ended = new Promise(resolve => { finishOpen = resolve; });
        if (R) {
          // reduced 0–480：完成冊頁與卡背淡入，沒有翻頁、粒子、震動。
          book.hidden = strap.hidden = false; makeSlots(); makeCards();
          await Promise.all([animate(scene, [{ opacity: 0 }, { opacity: 1 }], 480),
            ctx.cards.deal(draw.entries, { stagger: 0, duration: 150, quiet: true })]);
          check();
        } else {
          // 0–180 裝幀室定位。
          await animate(scene, [{ opacity: 0 }, { opacity: 1 }], 180);
          // 180–480 展冊、空槽／鉚釘依序落位。
          book.hidden = false; makeSlots();
          await Promise.all([animate(book, [{ transform: 'rotateX(48deg) scaleX(.2)' }, { transform: 'rotateX(0) scaleX(1)' }], 300),
            ...records.map((r, i) => animate(r.slot, [{ opacity: 0, translate: '0 -14px' }, { opacity: 1, translate: '0 0' }], 120, i * (180 / Math.max(1, records.length - 1))))]);
          // 480–760 五槽起點相隔70；最後一張在760開始壓入，索帶同步滑入。
          makeCards();
          const dealing = ctx.cards.deal(draw.entries, { stagger: 70, duration: 140, quiet: true,
            from: (_, i) => ({ x: records[i].pos.x, y: records[i].pos.y - 32, scale: records[i].pos.scale * 1.06 }) });
          dealing.catch(() => {});
          await wait(Math.max(280, (records.length - 1) * 70));
          // 760–1060（十連 +350ms）：索帶低音與紙摩擦。
          strap.hidden = false;
          sound.tone(90, { type: 'sine', slide: 55, slideT: .2, d: .2, r: .1, gain: .15 });
          sound.noiseHit({ type: 'lowpass', f0: 1600, f1: 500, d: .22, r: .08, gain: .12 });
          await Promise.all([dealing, animate(strap, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 300)]);
          // 1060–1420：中央壓印頭下降。
          press.hidden = false; status.textContent = '按住／點擊壓印';
          await animate(press, [{ opacity: 0, transform: 'translateY(-90px) rotate(-20deg) scale(1.3)' },
            { opacity: 1, transform: 'translateY(5px) rotate(0) scale(.96)', offset: .8 }, { opacity: 1, transform: 'none' }], 360);
        }
        ready = true; controls(); status.textContent = '按住／點擊任一卡槽壓印 · 逐張翻';
        if (ctx.isAuto() || forceAll) run(reveal(records[0]));
        await ended;
      },
      skip, dispose,
    };
  },
};

// 演示宿主的 launch/hint 文案寫死且不可改檔；只補 deluxe 的 DOM 文案。
// 仍由原 launch click → startDraw → DEMO_POLICY 執行，不攔截抽樣或存檔。
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('mode-select'), launch = document.getElementById('launch');
  const hint = document.getElementById('hint');
  if (!select || !launch || !hint) return;
  const sync = () => {
    if (select.value !== 'deluxe' || launch.hidden) return;
    const text = '開啟典藏冊 · 五張';
    if (launch.textContent !== text) launch.textContent = text;
    if (!launch.disabled) {
      const prompt = '開啟典藏冊，逐張完成壓印';
      if (hint.textContent !== prompt) hint.textContent = prompt;
      hint.classList.add('on');
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(launch, { childList: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
  sync(); window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
});
