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
      const entry = window.GachaPool.byId[effect.source], def = window.ClickerBalance.characters[effect.source];
      const mother = effect.source === 'zhenmu', direction = mother ? 1 : -1;
      root.style.setProperty('--skill', {rare:'#94BED0',epic:'#B8A2CF',legendary:'#E9B94E'}[entry.rarity] || '#94BED0');
      root.style.setProperty('--stripe', entry.rarity === 'legendary' ? '#B8862A' : entry.rarity === 'epic' ? '#80679E' : '#5E93AA');
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
      const name = node('cutin-name',panel); name.textContent = mother ? '這個頭\n我收下了' : def.skill;
      const subtitle = node('cutin-subtitle',panel); subtitle.textContent = `${entry.name}・${effect.kind === 'click' ? `接下來 ${effect.remaining} 次點擊 ×${effect.multiplier}` : '借一個頭，幫你加速拆包'}`;
      const stamp = node('cutin-stamp',panel); stamp.textContent = effect.kind === 'click' ? `×${effect.multiplier}` : '發動';
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
  return { create, T, ready };
})();
