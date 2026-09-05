// All cut-in timing is in milliseconds; game settlement never waits for this timeline.
window.ClickerCutin = (() => {
  const T = Object.freeze({ hit:80, focus:180, panel:260, arrive:80, rebound:60, actorLag:40, actorIn:100,
    rig:400, blink:180, blinkHold:70, trail:120, impact:90, impactOut:60, banner:520, brush:120,
    name:80, stamp:720, stampIn:100, exit:820, slideOut:160, fadeOut:180, end:1050, shake:50 });
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
      if (deliver) { stage.freeze(false); finish?.(); done(); }
      finish = null;
    }
    function play(effect) {
      if (active) return;
      active = true; stage.freeze(true); sound('skill');
      const entry = window.GachaPool.byId[effect.source], def = window.ClickerBalance.characters[effect.source];
      const mother = effect.source === 'zhenmu', direction = mother ? 1 : -1;
      root.style.setProperty('--skill', {rare:'#94BED0',epic:'#B8A2CF',legendary:'#E9B94E'}[entry.rarity] || '#94BED0');
      root.style.setProperty('--stripe', entry.rarity === 'legendary' ? '#B8862A' : entry.rarity === 'epic' ? '#80679E' : '#5E93AA');
      root.style.setProperty('--focus-x', mother ? '256px' : '320px'); root.dataset.phase = 'hit-stop';
      finish = () => stage.skill(effect);
      const dim = node('cutin-dim'); motion(dim,[{opacity:0},{opacity:1}],T.hit);
      const dots = node('cutin-halftone',dim);
      const focus = node('cutin-focus'); motion(focus,[{opacity:0},{opacity:1}],T.focus,T.hit);
      let lines, ring, bars;
      if (!reduced.matches) {
        lines = masked('cutin-speedlines','speedlines'); ring = masked('cutin-ring','ring');
        motion(lines,[{opacity:0,transform:'scale(1.6)'},{opacity:.9,transform:'scale(1)'}],T.focus,T.hit);
        motion(ring,[{opacity:1,transform:'scale(2.2)'},{opacity:0,transform:'scale(.9)'}],T.focus,T.hit);
        bars = ['top','bottom'].map(side => { const el = node(`cutin-bar-${side}`); el.className = 'cutin-letterbox'; motion(el,[{transform:`translateY(${side === 'top' ? -100 : 100}%)`},{transform:'translateY(0)'}],T.focus,T.hit); return el; });
      }
      later(()=>{ root.dataset.phase = 'focus'; },T.hit);
      const trail = reduced.matches ? null : masked('cutin-trail','speedlines-h');
      if (trail) motion(trail,[{opacity:.4},{opacity:0}],T.trail,T.panel);
      const panel = node('cutin-panel'); panel.classList.toggle('from-right',mother);
      node('cutin-stripes',panel);
      const ink = masked('cutin-ink','ink-splash',panel);
      const actor = node('cutin-actor',panel), svg = card.art.create(entry); actor.append(svg);
      const banner = masked('cutin-banner','brush-banner',panel);
      const name = node('cutin-name',panel); name.textContent = mother ? '這個頭\n我收下了' : def.skill;
      const subtitle = node('cutin-subtitle',panel); subtitle.textContent = `${entry.name}・${effect.kind === 'click' ? `接下來 ${effect.remaining} 次點擊 ×${effect.multiplier}` : '借一個頭，幫你加速拆包'}`;
      const stamp = node('cutin-stamp',panel); stamp.textContent = effect.kind === 'click' ? `×${effect.multiplier}` : '發動';
      if (reduced.matches) {
        motion(panel,[{opacity:0},{opacity:1}],T.arrive,T.panel);
        ink.hidden = banner.hidden = stamp.hidden = true;
      } else {
        motion(panel,[{transform:`translateX(${direction * 120}%) skewX(-6deg)`},{transform:`translateX(${-direction * 12}px) skewX(-6deg)`,offset:T.arrive/(T.arrive+T.rebound)},{transform:'translateX(0) skewX(-6deg)'}],T.arrive+T.rebound,T.panel,'cubic-bezier(.17,.89,.32,1.28)');
        motion(actor,[{opacity:0,transform:`translateX(${direction * 60}px) scale(1.08)`},{opacity:1,transform:'translateX(0) scale(1)'}],T.actorIn,T.panel+T.actorLag);
        motion(banner,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],T.brush,T.banner);
        motion(stamp,[{opacity:0,transform:'scale(1.6) rotate(-12deg)'},{opacity:1,transform:'scale(1) rotate(-12deg)'}],T.stampIn,T.stamp);
        const impact = node('cutin-impact',panel,'img'); impact.src = 'clicker-fx-impact-burst.png';
        motion(impact,[{opacity:0,transform:'scale(.4)'},{opacity:1,transform:'scale(1.15)',offset:T.impact/(T.impact+T.impactOut)},{opacity:0,transform:'scale(1.15)'}],T.impact+T.impactOut,T.panel+T.arrive);
        later(()=>{
          const cfg = card.art.cfg(entry.id), start = performance.now();
          function setLimb(key, angle) { const el = svg.querySelector(`#${key}`), pivot = cfg[key]; if (el && pivot) el.setAttribute('transform',`rotate(${angle} ${pivot[0]} ${pivot[1]})`); }
          function rig(now) {
            const elapsed = Math.min(T.rig,now-start), swing = Math.sin(elapsed/T.rig*Math.PI);
            if (mother) { setLimb('legL',-13*(cfg.limbScale||1)*swing); setLimb('legR',13*(cfg.limbScale||1)*swing); }
            else if (entry.id === 'jiaobu') setLimb('pawR',24*(cfg.pawScale||1)*swing);
            else setLimb('tail',22*(cfg.tailScale||1)*swing);
            const shut = elapsed >= T.blink && elapsed < T.blink+T.blinkHold;
            const open = svg.querySelector('#eyes-open'), closed = svg.querySelector('#eyes-closed');
            if (open) open.style.display = shut ? 'none' : ''; if (closed) closed.style.display = shut ? '' : 'none';
            raf = elapsed < T.rig ? requestAnimationFrame(rig) : 0;
          }
          raf = requestAnimationFrame(rig);
        },T.panel+T.actorLag);
      }
      motion(name,reduced.matches ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'scale(1.3)'},{opacity:1,transform:'scale(1)'}],T.name,T.banner+T.brush);
      motion(subtitle,reduced.matches ? [{opacity:0},{opacity:1}] : [{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],T.name,T.banner+T.brush);
      later(()=>{ root.dataset.phase = 'panel'; },T.panel);
      later(()=>{ sound('cutin-impact'); shake(); },T.panel+T.arrive);
      later(()=>{ root.dataset.phase = 'name'; },T.banner);
      later(()=>{ sound('cutin-stamp'); shake(); },T.stamp);
      const buddy = document.querySelector(`.buddy[data-id="${effect.source}"]`);
      if (buddy && !mother && !reduced.matches) {
        motion(buddy,[{transform:'scale(1)'},{transform:'scale(1.15)',filter:'brightness(1.2)',offset:.5},{transform:'scale(1)'}],T.focus);
        const badge = buddy.querySelector('.slot-stamp'); if (badge) motion(badge,[{opacity:1},{opacity:.2},{opacity:1}],T.focus);
      }
      later(()=>{
        root.dataset.phase = 'exit';
        // Cancel the entrance's fill before exit so the same transform has one owner.
        panel.getAnimations().forEach(a=>a.cancel());
        motion(panel,reduced.matches ? [{opacity:1},{opacity:0}] : [{transform:'translateX(0) skewX(-6deg)'},{transform:`translateX(${-direction * 130}%) skewX(-6deg)`}],T.slideOut,0,'ease-in');
        [dim,focus,lines,...(bars||[])].filter(Boolean).forEach(el=>{el.getAnimations().forEach(a=>a.cancel());motion(el,[{opacity:1},{opacity:0}],T.fadeOut);});
      },T.exit);
      later(()=>stop(true),T.end);
    }
    return { play, stop, get active() { return active; } };
  }
  return { create, T, ready };
})();
