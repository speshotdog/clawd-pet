// ClawdPet 抽卡 ─ 音效（全部 WebAudio 現場合成，沒有任何音檔）
// 設計原則：每個音都是「一個動作的回饋」，短、乾、有重量；只有傳說允許拖長尾巴。
// AudioContext 要在使用者手勢後才能建，所以 ensure() 由第一次 pointerdown 呼叫。
window.GachaAudio = (() => {
  let activeScope = null;
  let ctx = null;
  let master = null;
  let verb = null;      // 簡易迴響（feedback delay），只給揭曉音用

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    // 迴響：兩條 delay 交叉回授 + 低通，便宜但夠有空間感
    verb = ctx.createGain();
    verb.gain.value = 0.35;
    const d1 = ctx.createDelay(1); d1.delayTime.value = 0.173;
    const d2 = ctx.createDelay(1); d2.delayTime.value = 0.251;
    const fb1 = ctx.createGain(); fb1.gain.value = 0.42;
    const fb2 = ctx.createGain(); fb2.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    verb.connect(d1); verb.connect(d2);
    d1.connect(fb1).connect(d2); d2.connect(fb2).connect(d1);
    d1.connect(lp); d2.connect(lp); lp.connect(master);
    return ctx;
  }

  // ---------- 基本積木 ----------
  const now = () => ctx.currentTime;
  function env(node, t, a, d, peak = 1, s = 0, r = 0.05) {
    const g = node.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(s * peak, 0.0001), t + a + d);
    if (s > 0) g.setValueAtTime(s * peak, t + a + d);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }
  function tone(freq, { type = 'sine', t = now(), a = 0.005, d = 0.2, r = 0.05, s = 0, gain = 0.3, detune = 0, to = master, slide = null, slideT = 0 } = {}) {
    to = activeScope ? activeScope.route(to) : to;
    const o = ctx.createOscillator();
    activeScope?.track(o);
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + (slideT || d));
    const g = ctx.createGain();
    env(g, t, a, d, gain, s, r);
    o.connect(g).connect(to);
    o.start(t); o.stop(t + a + d + r + 0.05);
    return o;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    return src;
  }
  function noiseHit({ t = now(), a = 0.002, d = 0.12, r = 0.05, gain = 0.4, type = 'bandpass', f0 = 1500, f1 = null, q = 0.8, to = master } = {}) {
    to = activeScope ? activeScope.route(to) : to;
    const src = noise();
    activeScope?.track(src);
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f0, t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = ctx.createGain();
    env(g, t, a, d, gain, 0, r);
    src.connect(flt).connect(g).connect(to);
    src.start(t); src.stop(t + a + d + r + 0.05);
    return src;
  }
  // 鐘：一個基頻 + 非諧泛音（真實鐘的泛音比不是整數倍），各自不同衰減
  function bell(freq, t, { gain = 0.5, decay = 2.6, to = master } = {}) {
    const partials = [[1, 1, 1], [2.0, 0.55, 0.8], [2.76, 0.42, 0.7], [3.9, 0.25, 0.45], [5.4, 0.18, 0.35], [8.9, 0.08, 0.2]];
    for (const [ratio, amp, dscale] of partials) {
      tone(freq * ratio, { t, a: 0.003, d: decay * dscale, r: 0.3, gain: gain * amp, to });
      // 輕微失諧的第二層讓聲音「晃」——鐘的拍頻感
      tone(freq * ratio, { t, a: 0.003, d: decay * dscale * 0.9, r: 0.3, gain: gain * amp * 0.5, detune: 6, to });
    }
    // 敲擊瞬間的金屬「叮」
    noiseHit({ t, a: 0.001, d: 0.03, gain: gain * 0.5, f0: 5000, q: 2 });
  }

  // ---------- 對外：每個動作一個方法 ----------
  const api = { ensure };

  // 拿起卡包：很輕的紙質摩擦
  api.pick = () => { if (!ensure()) return; noiseHit({ d: 0.06, gain: 0.12, f0: 2500, f1: 1200, q: 1.5 }); };
  // 放到桌上／彈回托盤：悶悶的一下
  api.drop = (heavy = false) => {
    if (!ensure()) return;
    const t = now();
    tone(heavy ? 95 : 130, { type: 'sine', t, a: 0.003, d: 0.14, gain: heavy ? 0.5 : 0.28, slide: heavy ? 50 : 80, slideT: 0.12 });
    noiseHit({ t, d: 0.05, gain: heavy ? 0.25 : 0.14, type: 'lowpass', f0: 900, q: 0.5 });
  };
  // 就位：小小一聲確認（玻璃感）
  api.lock = () => {
    if (!ensure()) return;
    const t = now();
    tone(1320, { type: 'triangle', t, a: 0.003, d: 0.18, gain: 0.16, to: verb });
    tone(1980, { type: 'sine', t: t + 0.04, a: 0.003, d: 0.22, gain: 0.1, to: verb });
  };
  // 撕包：三段——鋸齒撕裂（顆粒噪音掃頻）→ 撕開後的氣流 → 爆光的低音衝擊
  api.tear = () => {
    if (!ensure()) return;
    const t = now();
    // 撕裂：一連串短促的顆粒，頻率往上爬
    for (let i = 0; i < 14; i++) {
      const tt = t + i * 0.028 + Math.random() * 0.006;
      noiseHit({ t: tt, a: 0.001, d: 0.02 + Math.random() * 0.015, r: 0.01, gain: 0.22 + i * 0.012, f0: 1800 + i * 220, q: 3 + Math.random() * 2 });
    }
    // 底下一層連續的紙撕聲
    noiseHit({ t, a: 0.02, d: 0.36, r: 0.06, gain: 0.2, f0: 700, f1: 3800, q: 0.7 });
  };
  api.burst = () => {
    if (!ensure()) return;
    const t = now();
    // 氣流：往上掃的噪音
    noiseHit({ t, a: 0.04, d: 0.45, r: 0.2, gain: 0.35, type: 'bandpass', f0: 400, f1: 6000, q: 0.6 });
    // 低音衝擊
    tone(70, { type: 'sine', t, a: 0.004, d: 0.5, gain: 0.7, slide: 32, slideT: 0.45 });
    // 光的「嗡」——高頻閃一下
    tone(2400, { type: 'sine', t: t + 0.02, a: 0.01, d: 0.5, gain: 0.12, slide: 4800, slideT: 0.3, to: verb });
  };
  // 發牌：每張一個乾脆的「啪」，音高微升
  api.deal = (i = 0) => {
    if (!ensure()) return;
    const t = now();
    noiseHit({ t, a: 0.001, d: 0.045, r: 0.02, gain: 0.3, f0: 2600 + i * 180, q: 1.2 });
    tone(220 + i * 18, { type: 'triangle', t, a: 0.002, d: 0.06, gain: 0.18 });
  };
  // 滑鼠靠近未翻的卡：稀有度越高，滲光的聲音越亮、越長
  api.hover = (rarity) => {
    if (!ensure()) return;
    const t = now();
    const cfg = {
      common: null,
      rare: { f: 880, d: 0.25, g: 0.06 },
      epic: { f: 1174, d: 0.4, g: 0.08 },
      legendary: { f: 1568, d: 0.7, g: 0.1 },
    }[rarity];
    if (!cfg) { noiseHit({ t, d: 0.03, gain: 0.05, f0: 3000, q: 2 }); return; }
    tone(cfg.f, { type: 'sine', t, a: 0.02, d: cfg.d, r: 0.15, gain: cfg.g, to: verb });
    tone(cfg.f * 1.5, { type: 'sine', t: t + 0.03, a: 0.02, d: cfg.d, r: 0.15, gain: cfg.g * 0.5, to: verb });
    if (rarity === 'legendary') tone(cfg.f / 4, { type: 'triangle', t, a: 0.05, d: 0.6, gain: 0.05, to: verb });
  };
  // 翻卡：紙板翻面的「啪」+ 短促的低頻
  api.flip = () => {
    if (!ensure()) return;
    const t = now();
    noiseHit({ t, a: 0.001, d: 0.05, r: 0.03, gain: 0.35, f0: 1800, f1: 900, q: 1 });
    tone(160, { type: 'sine', t: t + 0.01, a: 0.002, d: 0.08, gain: 0.25, slide: 90, slideT: 0.07 });
  };
  // 揭曉：四階四種語彙
  api.reveal = (rarity) => {
    if (!ensure()) return;
    const t = now() + 0.02;
    if (rarity === 'common') {
      // 普通：悶悶一聲，沒什麼好慶祝的
      tone(330, { type: 'triangle', t, a: 0.004, d: 0.12, gain: 0.16 });
      return;
    }
    if (rarity === 'rare') {
      // 精良：兩個清亮的音（E5 → B5）
      tone(659, { type: 'triangle', t, a: 0.004, d: 0.28, r: 0.2, gain: 0.22, to: verb });
      tone(988, { type: 'triangle', t: t + 0.09, a: 0.004, d: 0.42, r: 0.3, gain: 0.2, to: verb });
      tone(1319, { type: 'sine', t: t + 0.09, a: 0.02, d: 0.5, gain: 0.08, to: verb });
      noiseHit({ t, a: 0.005, d: 0.08, gain: 0.08, f0: 6000, q: 1 });
      return;
    }
    if (rarity === 'epic') {
      // 史詩：上行琶音 + 失諧鋸齒的墊底，有點魔法感
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => {
        tone(f, { type: 'triangle', t: t + i * 0.055, a: 0.004, d: 0.35, r: 0.3, gain: 0.16, to: verb });
      });
      tone(262, { type: 'sawtooth', t, a: 0.05, d: 0.7, r: 0.4, gain: 0.07, detune: -8, to: verb });
      tone(262, { type: 'sawtooth', t, a: 0.05, d: 0.7, r: 0.4, gain: 0.07, detune: 8, to: verb });
      noiseHit({ t, a: 0.02, d: 0.5, r: 0.3, gain: 0.12, f0: 3000, f1: 9000, q: 0.5, to: verb });
      tone(1568, { type: 'sine', t: t + 0.3, a: 0.02, d: 0.6, gain: 0.08, slide: 2093, slideT: 0.5, to: verb });
      return;
    }
    // 傳說：大鐘。先一記低沉的鐘身，再疊一顆高的，最後灑一串亮片
    tone(55, { type: 'sine', t, a: 0.005, d: 1.2, gain: 0.6, slide: 40, slideT: 1 });        // 地面震動
    bell(392, t, { gain: 0.42, decay: 3.2, to: verb });
    bell(784, t + 0.12, { gain: 0.26, decay: 2.4, to: verb });
    noiseHit({ t, a: 0.005, d: 0.4, r: 0.4, gain: 0.25, f0: 2500, f1: 12000, q: 0.4, to: verb });
    const sparkle = [2093, 2637, 3136, 3520, 4186, 5274];
    sparkle.forEach((f, i) => {
      tone(f, { type: 'sine', t: t + 0.35 + i * 0.07, a: 0.003, d: 0.25, r: 0.4, gain: 0.07, to: verb });
    });
  };
  // 傳說蓄力：翻之前那半拍的「來了」——低頻在漲、高頻在抖、心跳
  api.charge = (dur = 0.9) => {
    if (!ensure()) return;
    const t = now();
    tone(48, { type: 'sine', t, a: dur * 0.85, d: dur * 0.15, r: 0.1, gain: 0.55, slide: 62, slideT: dur });
    noiseHit({ t, a: dur * 0.9, d: 0.08, r: 0.05, gain: 0.3, f0: 300, f1: 5000, q: 1.2 });
    tone(1760, { type: 'sine', t, a: dur * 0.8, d: 0.1, gain: 0.05, slide: 3520, slideT: dur, to: verb });
    // 心跳兩下
    [0, dur * 0.45].forEach((off) => {
      tone(80, { type: 'sine', t: t + off, a: 0.004, d: 0.12, gain: 0.35, slide: 45, slideT: 0.1 });
    });
  };
  // 收下：卡飛走的風聲 + 收進袋子的「咚」
  api.collect = (n = 5) => {
    if (!ensure()) return;
    const t = now();
    for (let i = 0; i < n; i++) {
      noiseHit({ t: t + i * 0.07, a: 0.01, d: 0.12, r: 0.08, gain: 0.14, f0: 800, f1: 3500, q: 0.8 });
    }
    tone(196, { type: 'triangle', t: t + n * 0.07 + 0.15, a: 0.004, d: 0.18, gain: 0.25 });
    tone(392, { type: 'sine', t: t + n * 0.07 + 0.18, a: 0.004, d: 0.3, gain: 0.12, to: verb });
  };
  // 化塵：碎裂的顆粒 + 塵往上飄的亮音
  api.dust = () => {
    if (!ensure()) return;
    const t = now();
    for (let i = 0; i < 10; i++) {
      noiseHit({ t: t + i * 0.022 + Math.random() * 0.01, a: 0.001, d: 0.025, r: 0.02, gain: 0.12, f0: 2200 + Math.random() * 3000, q: 4 });
    }
    tone(880, { type: 'sine', t: t + 0.1, a: 0.05, d: 0.5, gain: 0.07, slide: 1760, slideT: 0.5, to: verb });
    noiseHit({ t: t + 0.1, a: 0.1, d: 0.4, r: 0.2, gain: 0.08, f0: 4000, f1: 9000, q: 0.5, to: verb });
  };
  // 塵計數器跳數：每跳一格一聲極短的 tick
  api.tick = (i = 0) => {
    if (!ensure()) return;
    tone(1200 + (i % 5) * 60, { type: 'square', t: now(), a: 0.001, d: 0.02, r: 0.01, gain: 0.04 });
  };
  // 一般按鈕
  api.ui = () => { if (!ensure()) return; tone(660, { type: 'triangle', t: now(), a: 0.002, d: 0.06, gain: 0.1 }); };

  // 每次演出有自己的乾聲與迴響出口，取消時連尾音一起收乾。
  api.createScope = () => {
    const sources = new Set(), children = new Set(), nodes = [];
    let stopped = false;
    const ac = ensure();
    const output = ac?.createGain(), wet = ac?.createGain();
    if (ac) {
      output.connect(master); wet.gain.value = .35;
      nodes.push(output, wet);
      for (const seconds of [.173, .251]) {
        const delay = ac.createDelay(1), gain = ac.createGain();
        delay.delayTime.value = seconds; gain.gain.value = .4;
        wet.connect(delay).connect(gain).connect(output);
        nodes.push(delay, gain);
      }
    }
    const scope = {
      createScope() {
        const child = api.createScope(); children.add(child);
        if (stopped) child.stop();
        return child;
      },
      dry: output, verb: wet, now: () => ac?.currentTime || 0,
      route: (to) => to === verb || to === wet ? wet : output,
      track(src) { sources.add(src); src.addEventListener('ended', () => sources.delete(src), { once: true }); },
      stop(ms = 30) {
        if (stopped) return;
        stopped = true;
        children.forEach((child) => child.stop(ms)); children.clear();
        if (!ac) return;
        const t = ac.currentTime, end = t + ms / 1000;
        output.gain.cancelScheduledValues(t);
        output.gain.setValueAtTime(output.gain.value, t);
        output.gain.linearRampToValueAtTime(0, end);
        sources.forEach((src) => { try { src.stop(end); } catch {} });
        setTimeout(() => { nodes.forEach((n) => n.disconnect()); sources.clear(); }, ms + 10);
      },
    };
    const run = (fn, args) => {
      if (stopped || !ac) return;
      const previous = activeScope; activeScope = scope;
      try { return fn(...args); } finally { activeScope = previous; }
    };
    Object.assign(scope, {
      tone: (...args) => run(tone, args), noiseHit: (...args) => run(noiseHit, args),
      bell: (...args) => run(bell, args),
    });
    for (const name of ['flip', 'reveal', 'deal', 'hover', 'collect', 'dust', 'tick', 'ui', 'tear', 'burst', 'charge', 'lock', 'drop']) {
      scope[name] = (...args) => run(api[name], args);
    }
    return scope;
  };

  return api;
})();
