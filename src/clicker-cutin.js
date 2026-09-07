// All cut-in timing is in milliseconds; game settlement never waits for this timeline.
window.ClickerCutin = (() => {
  // 依 GGST Roman Cancel（凍結:餘韻≈1:2）、M3 emphasized 曲線、動畫 impact frame（1 格≈40ms）修訂：
  // 進場位移只 75ms＋回彈、到位一格白閃、名字後留 320ms 閱讀期、出場 210ms 加速滑出，
  // 壓暗層比面板多活 ~200ms，舞台提早 150ms 解凍並做一次小反衝。
  const T = Object.freeze({ flash:40, hit:130, focus:200, smearIn:180, smear:70,
    panel:190, arrive:75, rebound:90, actorLag:50, actorIn:110,
    rig:400, blink:180, blinkHold:70, impact:90, impactOut:60,
    banner:420, brush:130, name:110, stamp:560, stampIn:90, hold:320,
    exitSmear:1040, exit:1080, slideOut:210, exitFlash:1120, barsOut:160,
    unfreeze:1250, punch:150, dimOut:1220, fadeOut:180, end:1400, shake:60 });
  const EASE = { in:'cubic-bezier(.05,.7,.1,1)', settle:'cubic-bezier(.17,.89,.32,1.28)', out:'cubic-bezier(.3,0,.8,.15)', emph:'cubic-bezier(.2,0,0,1)', punch:'cubic-bezier(.34,1.4,.64,1)' };
  const CUTIN = {};
  const rigs = {
    yueyue2: (p, limb, body, c) => limb('tail', 22 * Math.sin(p * Math.PI * 4)),
    caihua: (p, limb) => limb('tail', p < .75 ? -28 + 56 * p / .75 : 28 * (1 - p) / .25),
    lk: (p, limb, body) => { limb('legL', 10 * Math.sin(p * Math.PI * 2)); limb('legR', -10 * Math.sin(p * Math.PI * 2)); body(`scaleY(${1 - .04 * Math.sin(p * Math.PI)})`); },
    yang: (p, limb, body, c) => limb('pawR', (c.up ?? -1) * 18 * Math.sin(p * Math.PI)),
    dog: (p, limb, body, c) => { limb('pawR', (c.up ?? -1) * 20 * Math.sin(p * Math.PI)); body(`translateX(${6 * Math.sin(p * Math.PI)}px)`); },
    fox: (p, limb) => { limb('pawR', -18 * Math.sin(p * Math.PI)); limb('tail', 6 * Math.sin(p * Math.PI * 2)); },
    jiaobu2: (p, limb) => limb('pawR', 26 * (p < .2 ? p / .2 : (1 - p) / .8)),
    zhenzhen2: (p, limb, body) => body(`scale(${1 + .06 * Math.sin(p * Math.PI)},${1 - .1 * Math.sin(p * Math.PI)})`),
    zhenmu: (p, limb) => { limb('legL', -13 * Math.sin(p * Math.PI)); limb('legR', 13 * Math.sin(p * Math.PI)); },
    jiaobu: (p, limb) => limb('pawR', 24 * Math.sin(p * Math.PI)),
    yueyue: (p, limb, body, c) => { limb('pawR', (c.up ?? 1) * 20 * Math.sin(p * Math.PI)); limb('tail', 5 * Math.sin(p * Math.PI * 2)); },
    zhenzhen: (p, limb, body) => body(`scale(${1 + .08 * Math.sin(p * Math.PI)},${1 - .08 * Math.sin(p * Math.PI)})`),
  };
  const stamps = { caihua:'拆！', fox:'收！', yang:'+20%', zhenzhen:'+50%', dog:'聞！', zhenmu:'發動' };
  for (const [id, def] of Object.entries(window.ClickerBalance.characters)) {
    const rarity = window.GachaPool.byId[id].rarity;
    CUTIN[id] = { side:id === 'zhenmu' ? 'right' : 'left',
      color:{rare:'#94BED0',epic:'#B8A2CF',legendary:'#E9B94E',mythic:'#FF4FD8'}[rarity],
      stripe:{rare:'#5E93AA',epic:'#80679E',legendary:'#B8862A',mythic:'conic-gradient(#ff4fd8,#ffb347,#fff275,#7dff9c,#5ad7ff,#b48bff,#ff4fd8)'}[rarity], rig:rigs[id],
      name:def.skill.length >= 6 ? def.skill.slice(0, Math.floor(def.skill.length / 2)) + '\n' + def.skill.slice(Math.floor(def.skill.length / 2)) : def.skill,
      sub:effect => def.desc(effect.params || window.ClickerBalance.skillAt(id,1)).split('・冷卻')[0], stamp:effect => def.kind === 'team' ? `+${Number(((effect.params?.ratio || def.ratio)*100).toFixed(2))}%` : stamps[id] || `×${effect.multiplier || def.multiplier || effect.params?.factor || def.factor || '發動'}` };
  }
  const ready = Promise.all(['speedlines','speedlines-h','stripe-tile','brush-banner','impact-burst','halftone-tile','ink-splash','ring','stamp','paper-grain'].map(name => new Promise(resolve => {
    const img = new Image(); img.onload = () => img.decode().catch(()=>{}).then(resolve); img.onerror = resolve; img.src = `clicker-fx-${name}.png`;
  })));
  function create({ card, stage, sound, done }) {
    const root = document.getElementById('cutin'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let active = false, raf = 0, finish = null;
    const timers = new Set(), animations = new Set();
    const later = (fn, delay) => { const id = setTimeout(() => { timers.delete(id); fn(); }, delay); timers.add(id); };
    function motion(el, frames, duration, delay = 0, easing = 'cubic-bezier(.2,.9,.3,1)') {
      const a = el.animate(frames, {duration, delay, easing, fill:'both'}); animations.add(a); return a;
    }
    function node(id, parent = root, tag = 'div') { const el = document.createElement(tag); el.id = id; parent.append(el); return el; }
    function masked(id, asset, parent = root) { const el = node(id,parent); el.className = 'cutin-mask'; el.style.maskImage = `url('clicker-fx-${asset}.png')`; return el; }
    function shake() {
      if (!reduced.matches) motion(document.getElementById('stage'), [{transform:'translate(4px,-3px)'},{transform:'translate(-3px,2px)'},{transform:'translate(0)'}], T.shake);
    }
    function stop(deliver = false) {
      if (!active) return;
      timers.forEach(clearTimeout); timers.clear(); cancelAnimationFrame(raf); raf = 0;
      animations.forEach(a => a.cancel()); animations.clear(); root.replaceChildren(); root.removeAttribute('data-phase');
      active = false;
      if (deliver) { if (stage.frozen) stage.freeze(false); finish?.(); done(); }
      finish = null;
    }
    function play(effect) {
      if (active) return;
      active = true; stage.freeze(true); sound('skill');
      const entry = window.GachaPool.byId[effect.source];
      const spec = CUTIN[effect.source], mother = spec.side === 'right', direction = mother ? 1 : -1;
      root.classList.toggle('mythic', entry.rarity === 'mythic');
      root.style.setProperty('--skill', spec.color);
      root.style.setProperty('--stripe', spec.stripe);
      root.style.setProperty('--focus-x', mother ? '320px' : '320px'); root.dataset.phase = 'hit-stop';
      finish = () => stage.skill(effect);
      const dim = node('cutin-dim'); motion(dim,[{opacity:0},{opacity:1}],T.hit,0,'cubic-bezier(0,0,.2,1)');
      const flash = node('cutin-flash'); if (!reduced.matches) motion(flash,[{opacity:0},{opacity:.75,offset:.4},{opacity:0}],T.flash,0,'linear');
      const dots = node('cutin-halftone',dim);
      const focus = node('cutin-focus'); motion(focus,[{opacity:0},{opacity:1}],T.focus,T.hit,EASE.in);
      let lines, ring, bars;
      if (!reduced.matches) {
        lines = masked('cutin-speedlines','speedlines'); ring = masked('cutin-ring','ring');
        motion(lines,[{opacity:0,transform:'scale(1.6)'},{opacity:.9,transform:'scale(1)'}],T.focus,T.hit,EASE.in);
        motion(ring,[{opacity:1,transform:'scale(2.2)'},{opacity:0,transform:'scale(.9)'}],T.focus,T.hit,EASE.in);
        bars = ['top','bottom'].map(side => { const el = node(`cutin-bar-${side}`); el.className = 'cutin-letterbox'; motion(el,[{transform:`translateY(${side === 'top' ? -100 : 100}%)`},{transform:'translateY(0)'}],T.focus,T.hit,EASE.in); return el; });
      }
      later(()=>{ root.dataset.phase = 'focus'; },T.hit);
      const trail = reduced.matches ? null : masked('cutin-trail','speedlines-h');
      if (trail) motion(trail,[{opacity:0,transform:`translateX(${direction * 40}%) scaleX(.2)`},{opacity:.9,transform:'translateX(0) scaleX(1)',offset:.5},{opacity:0,transform:`translateX(${-direction * 10}%) scaleX(1)`}],T.smear,T.smearIn,'cubic-bezier(.3,0,1,1)');
      const panel = node('cutin-panel'); panel.classList.toggle('from-right',mother);
      node('cutin-stripes',panel);
      const ink = masked('cutin-ink','ink-splash',panel);
      const actor = node('cutin-actor',panel), svg = card.art.create(entry); actor.append(svg);
      const banner = masked('cutin-banner','brush-banner',panel);
      const name = node('cutin-name',panel); name.textContent = spec.name;
      const subtitle = node('cutin-subtitle',panel); subtitle.textContent = spec.sub(effect);
      const stamp = node('cutin-stamp',panel); stamp.textContent = spec.stamp(effect);
      if (effect.chain >= 2) {
        const chain=node('cutin-chain-stamp',panel);chain.textContent=`連鎖 ×${effect.chain}`;
        motion(chain,reduced.matches ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'scale(1.6) rotate(9deg)'},{opacity:1,transform:'scale(1) rotate(9deg)'}],90,T.stamp+120,EASE.settle);
        later(()=>{sound('cutin-stamp');shake();},T.stamp+120);
      }
      if (reduced.matches) {
        motion(panel,[{opacity:0},{opacity:1}],T.arrive,T.panel);
        ink.hidden = banner.hidden = stamp.hidden = true;
      } else {
        motion(panel,[{transform:`translateX(${direction * 118}%) skewX(-6deg)`},{transform:`translateX(${-direction * 14}px) skewX(-6deg)`}],T.arrive,T.panel,EASE.in)
          .finished.then(() => { if (!active) return; motion(panel,[{transform:`translateX(${-direction * 14}px) skewX(-6deg)`},{transform:'translateX(0) skewX(-6deg)'}],T.rebound,0,EASE.settle); }).catch(()=>{});
        motion(flash,[{opacity:0},{opacity:.6,offset:.3},{opacity:0}],T.flash,T.panel+T.arrive,'linear');
        motion(actor,[{opacity:0,transform:`translateX(${direction * 60}px) scale(1.10)`},{opacity:1,transform:'translateX(0) scale(1)'}],T.actorIn,T.panel+T.actorLag,EASE.in);
        motion(banner,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],T.brush,T.banner,EASE.emph);
        motion(stamp,[{opacity:0,transform:'scale(1.6) rotate(-12deg)'},{opacity:1,transform:'scale(1) rotate(-12deg)'}],T.stampIn,T.stamp,EASE.settle);
        const impact = node('cutin-impact',panel,'img'); impact.src = 'clicker-fx-impact-burst.png';
        motion(impact,[{opacity:0,transform:'scale(.4)'},{opacity:1,transform:'scale(1.15)',offset:T.impact/(T.impact+T.impactOut)},{opacity:0,transform:'scale(1.15)'}],T.impact+T.impactOut,T.panel+T.arrive);
        later(()=>{
          if (entry.src) {
            motion(svg, [{transform:'skewX(6deg) translateY(0)'},{transform:'skewX(6deg) translateY(-6px)',offset:.5},{transform:'skewX(6deg) translateY(0)'}],1200,0,'ease-in-out'); return;
          }
          const cfg = card.art.cfg(entry.id), start = performance.now();
          function setLimb(key, angle) { const el = svg.querySelector(`#${key}`), pivot = cfg[key]; if (el && pivot) el.setAttribute('transform',`rotate(${angle * (key === 'tail' ? cfg.tailScale ?? cfg.limbScale ?? 1 : key === 'pawR' ? cfg.pawScale ?? cfg.limbScale ?? 1 : cfg.limbScale ?? 1)} ${pivot[0]} ${pivot[1]})`); }
          function rig(now) {
            const elapsed = Math.min(T.rig,now-start);
            spec.rig(elapsed / T.rig, setLimb, transform => { svg.style.transformOrigin = '50% 100%'; svg.style.transform = `skewX(6deg) ${transform}`; }, cfg);
            const shut = elapsed >= T.blink && elapsed < T.blink+T.blinkHold;
            const open = svg.querySelector('#eyes-open'), closed = svg.querySelector('#eyes-closed');
            if (open) open.style.display = shut ? 'none' : ''; if (closed) closed.style.display = shut ? '' : 'none';
            raf = elapsed < T.rig ? requestAnimationFrame(rig) : 0;
          }
          raf = requestAnimationFrame(rig);
        },T.panel+T.actorLag);
      }
      motion(name,reduced.matches ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'scale(1.45)'},{opacity:1,transform:'scale(1)'}],T.stampIn,T.banner+T.brush,EASE.settle);
      motion(subtitle,reduced.matches ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],T.name,T.banner+T.brush+50,EASE.in);
      // 閱讀期：斜紋緩慢平移，讓玩家看清技能名再走
      if (!reduced.matches) { later(()=>{ root.dataset.phase = 'hold'; }, T.stamp+T.stampIn); motion(panel.querySelector('#cutin-stripes'),[{backgroundPosition:'0 0'},{backgroundPosition:'4px 0'}],T.hold,T.stamp+T.stampIn,'ease-in-out'); }
      later(()=>{ root.dataset.phase = 'panel'; },T.panel);
      later(()=>{ sound('cutin-impact'); shake(); },T.panel+T.arrive);
      later(()=>{ root.dataset.phase = 'name'; },T.banner);
      later(()=>{ sound('cutin-stamp'); shake(); },T.stamp);
      const buddy = document.querySelector(`.buddy[data-id="${effect.source}"]`);
      if (buddy && !mother && !reduced.matches) {
        motion(buddy,[{transform:'scale(1)'},{transform:'scale(1.15)',filter:'brightness(1.2)',offset:.5},{transform:'scale(1)'}],T.focus);
        const badge = buddy.querySelector('.slot-stamp'); if (badge) motion(badge,[{opacity:1},{opacity:.2},{opacity:1}],T.focus);
      }
      if (!reduced.matches) later(()=>{
        const smear = masked('cutin-exit-trail','speedlines-h'); smear.style.transform = 'scaleX(-1)';
        motion(smear,[{opacity:0},{opacity:.6,offset:.5},{opacity:0}],T.exit-T.exitSmear+T.slideOut*.6,0,'ease-out');
      },T.exitSmear);
      later(()=>{
        root.dataset.phase = 'exit';
        // 先取消進場的 fill，同一個 transform 只能有一個主人
        panel.getAnimations().forEach(a=>a.cancel());
        motion(panel,reduced.matches ? [{opacity:1},{opacity:0}] : [{transform:'translateX(0) skewX(-6deg) scaleY(1)'},{transform:`translateX(${-direction * 135}%) skewX(-10deg) scaleY(.98)`}],T.slideOut,0,EASE.out);
        [focus,lines].filter(Boolean).forEach(el=>{el.getAnimations().forEach(a=>a.cancel());motion(el,[{opacity:1},{opacity:0}],T.barsOut,0,'ease-in');});
        if (bars) bars.forEach((el,i)=>{ el.getAnimations().forEach(a=>a.cancel()); motion(el,[{transform:'translateY(0)'},{transform:`translateY(${i === 0 ? -100 : 100}%)`}],T.barsOut,0,'ease-in'); });
      },T.exit);
      if (!reduced.matches) later(()=>{ motion(flash,[{opacity:.5},{opacity:0}],T.flash,0,'linear'); },T.exitFlash);
      later(()=>{
        // 面板走光、壓暗還在：舞台先復活並做一次小反衝（GGST「凍結結束但慢動作還在」的等價物）
        if (stage.frozen) stage.freeze(false);
        if (!reduced.matches) motion(document.getElementById('stage'),[{transform:'scale(1)'},{transform:'scale(1.03)',offset:.4},{transform:'scale(1)'}],T.punch,0,EASE.punch);
      },T.unfreeze);
      later(()=>{ dim.getAnimations().forEach(a=>a.cancel()); motion(dim,[{opacity:1},{opacity:0}],T.fadeOut,0,'cubic-bezier(.4,0,.6,1)'); },T.dimOut);
      later(()=>stop(true),T.end);
    }
    return { play, stop, get active() { return active; } };
  }
  return { create, T, ready, CUTIN };
})();
