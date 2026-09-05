// 模式只拿演出能力；取消後的等待會拒絕，避免舊時間軸繼續發牌。
window.GachaModeRuntime = (() => {
  function create(host, draw) {
    const controller = new AbortController(), signal = controller.signal;
    const animations = new Set(), cards = new Map(), revealed = new Set();
    let seed = draw.visualSeed >>> 0, busy = false, automatic = false, complete = false;
    let resolveDone, rejectDone;
    const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
    done.catch(() => {});
    const rng = () => {
      seed += 0x6D2B79F5;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const audio = window.GachaAudio.createScope(), fx = window.GachaFx.createScope({ rng });
    const motion = { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
    const aborted = () => new DOMException('演出已取消', 'AbortError');
    function check() { if (signal.aborted) throw aborted(); }
    function wait(ms) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(aborted()); return; }
        const cancel = () => { clearTimeout(timer); reject(aborted()); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
        signal.addEventListener('abort', cancel, { once: true });
      });
    }
    async function animate(el, frames, options) {
      check();
      const animation = el.animate(frames, { fill: 'forwards', ...options });
      animations.add(animation);
      try { await animation.finished; check(); }
      finally { animations.delete(animation); }
      return animation;
    }
    function notify(key) {
      if (revealed.has(key)) return;
      revealed.add(key); host.onReveal(key);
    }
    function createCard(item) {
      if (cards.has(item.key)) return cards.get(item.key);
      const el = host.card.create(item.entry, { dup: item.dup, owned: item.owned });
      const card = { ...item, el, ...host.layout(draw.entries.indexOf(item), draw.entries.length), flipped: false };
      el.dataset.key = item.key;
      host.cardsEl.append(el); cards.set(item.key, card);
      host.onCards([...cards.values()]);
      return card;
    }
    const transform = (c) => `translate(${c.x}px, ${c.y}px) rotate(${motion.reduced ? 0 : c.rot}deg) scale(${c.scale || 1})`;
    async function deal(items, { stagger = 80, duration = 500, quiet = false, from = null } = {}) {
      const origin = from || { x: host.center.x, y: host.center.y, scale: .2 };
      check(); host.state('dealing');
      await Promise.all(items.map(async (item, i) => {
        const c = createCard(item);
        const start = typeof origin === 'function' ? origin(item, i) : origin;
        await wait(i * stagger); check();
        c.el.classList.add('dealt'); c.el.style.transition = 'none';
        c.el.style.transform = transform(c);
        if (quiet) audio.noiseHit({ d: .045, r: .02, gain: .12, f0: 2600 + i * 180, q: 1.2 });
        else audio.deal(i);
        const frames = motion.reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
          { opacity: 0, transform: `translate(${start.x}px, ${start.y}px) rotateX(${start.rotateX || 0}deg) scale(${start.scale ?? .2})` },
          { opacity: 1, transform: transform(c) },
        ];
        // 帶一點回彈：卡是被甩出來落定的，不是滑到位
        const a = await animate(c.el, frames, { duration: motion.reduced ? 150 : duration, easing: 'cubic-bezier(.22,.9,.32,1.12)' });
        a.cancel(); c.el.style.transition = '';
        if (motion.reduced) await wait(duration - 150);
      }));
      host.state('fanned');
    }
    async function finish() {
      if (complete || revealed.size !== draw.entries.length) return;
      await wait(180); check();
      complete = true; host.summary(); resolveDone();
    }
    // R 只有這一份：身份、音效落點與動畫完成分開記錄。分鏡沿用第一版（回饋感最好的那版）
    async function reveal(key, { deferSummary = false, onFlip = null } = {}) {
      check();
      const c = cards.get(key);
      if (!c || c.flipped || busy) return;
      busy = true; host.card.liveEnd(); host.state('revealing');
      const rarity = c.entry.rarity, legendary = rarity === 'legendary';
      const sound = audio.createScope();
      const inner = c.el.querySelector('.card-inner');
      inner.style.transition = 'none';
      let rays = null;
      if (legendary && !motion.reduced) {
        // 「來了」：桌子壓暗、其他卡沉下去、卡在抖、橘光從卡背後升起、蓄力音在漲——故意拖一秒再翻
        host.charging?.(true); c.el.classList.add('charging'); host.dim.classList.add('on');
        rays = window.GachaFx.rays(c.x, c.y - 10, { fadeIn: .6, hold: 1.6 });
        sound.charge(1.05);
        await wait(560); c.el.classList.add('hard');
        await wait(520);
        c.el.classList.remove('charging', 'hard');
      }
      onFlip?.(); sound.flip();
      const flipping = animate(inner, motion.reduced ? [
        { transform: 'rotateY(180deg)', opacity: 0 }, { transform: 'rotateY(180deg)', opacity: 1 },
      ] : [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
      { duration: motion.reduced ? 150 : 580, delay: motion.reduced ? 240 : 0, easing: 'cubic-bezier(.35,.1,.25,1)' });
      flipping.catch(() => {});
      // 翻到一半、卡面剛露出來的那一刻才是揭曉
      await wait(legendary ? 270 : 290); check();
      c.flipped = true; c.el.classList.add('flipped', 'reveal-pop');
      notify(key); sound.reveal(rarity);
      if (!motion.reduced) {
        window.GachaFx.reveal(c.x, c.y - 6, rarity);
        if (legendary) host.shake?.(); else if (rarity === 'epic') host.shake?.(true);
      }
      await wait(legendary ? 900 : 300);
      if (legendary) { host.dim.classList.remove('on'); host.charging?.(false); rays?.stop(1.4); }
      (await flipping).cancel(); inner.style.transition = '';
      c.el.classList.remove('reveal-pop');
      sound.stop(200);
      busy = false; host.state('fanned');
      if (!deferSummary) await finish();
    }
    function showSummary(items) {
      host.card.liveEnd();
      for (const item of items) {
        const c = createCard(item);
        c.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        c.el.classList.remove('charging', 'reveal-pop');
        c.el.classList.add('dealt', 'flipped'); c.flipped = true;
        c.el.style.transition = 'none'; c.el.style.transform = transform(c);
        void c.el.offsetWidth; c.el.style.transition = '';
        c.el.querySelector('.card-inner').style.transition = 'none';
        notify(item.key);
      }
      host.dim.classList.remove('on'); host.charging?.(false); host.state('fanned');
      complete = true; host.summary(); resolveDone();
    }
    function stop() {
      if (signal.aborted) return;
      controller.abort(); rejectDone(aborted()); animations.forEach((a) => a.cancel()); animations.clear();
      audio.stop(30); fx.stop(); host.dim.classList.remove('on'); host.charging?.(false);
      host.cardsEl.querySelectorAll('.charging').forEach((el) => el.classList.remove('charging', 'hard'));
      host.root.replaceChildren();
    }
    async function all() {
      if (host.mode === 'rip' || host.mode === 'stage') return;
      if (busy || automatic || complete || signal.aborted) return;
      automatic = true;
      try {
        for (const item of draw.entries) {
          if (!cards.get(item.key)?.flipped) {
            await reveal(item.key);
            if (!complete) await wait(80);
          }
          if (!host.isAuto() && host.mode !== 'hearthstone') break;
        }
      } finally { automatic = false; }
    }
    function run(promise) {
      promise.catch((err) => { if (err.name !== 'AbortError') host.error(err); });
    }
    host.cardsEl.addEventListener('click', (event) => {
      if (host.mode === 'rip' || host.mode === 'stage') return;
      const key = event.target.closest('.card')?.dataset.key;
      if (key && !automatic && !busy && !complete && host.isFanned()) run(reveal(key).then(() => {
        if (host.mode !== 'hearthstone' && host.isAuto()) return all();
      }));
    }, { signal });
    const cooldown = new Map();
    host.cardsEl.addEventListener('pointerover', (event) => {
      const el = event.target.closest('.card'), c = cards.get(el?.dataset.key);
      if (!c || c.flipped || busy || !host.isFanned() || el.contains(event.relatedTarget)) return;
      const now = performance.now();
      if ((cooldown.get(c.key) || 0) > now) return;
      cooldown.set(c.key, now + 800); audio.hover(c.entry.rarity);
      if (c.entry.rarity === 'legendary' && !motion.reduced) {
        animate(el.querySelector('.back-leak'), [{ opacity: .55 }, { opacity: 1 }], { duration: 180 }).then((a) => a.cancel()).catch(() => {});
      }
    }, { signal });
    const ctx = { root: host.root, size: host.size, center: host.center,
      cards: { create: createCard, deal, reveal, showSummary }, art: host.card.art,
      audio, fx, wait, animate, signal, motion, onReveal: notify, rng, cancel: stop,
      flash: () => host.flash?.(), shake: (soft) => host.shake?.(soft),
      isAuto: () => host.isAuto(),
      // 等待互動的 Promise 也在略過總覽時結束，不把收下算進模式生命週期。
      async interact() {
        check(); host.interactive();
        if (host.mode !== 'hearthstone' && host.isAuto()) run(all());
        return done;
      },
    };
    return { ctx, all: () => run(all()), stop, summary: () => showSummary(draw.entries), run,
      skip() { stop(); showSummary(draw.entries); } };
  }
  return { create };
})();
