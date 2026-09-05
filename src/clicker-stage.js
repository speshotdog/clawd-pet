window.ClickerStage = (() => {
  function create({ card, sound, format, showRoster, notice }) {
    const $ = (id) => document.getElementById(id), E = window.ClickerEconomy;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const hero = card.art.create(window.GachaPool.byId.zhenmu), cfg = card.art.cfg('zhenmu');
    $('hero').append(hero);
    let frozen = false, heldAmount = 0;
    let running = false, raf = 0, lastFrame = 0, lastSceneFrame = 0, blinkTimer = 0, openTimer = 0;
    let pressAt = -Infinity, pressAmount = 0, combo = 0, previousClick = -Infinity;
    let parasite = null, lastPackage = 1, bagBusy = false, latestState = null, bagState = 0;
    let fx = null, page = 0, teamState = null, teamKey = '', clickChain = 0, fxClickAt = -Infinity, joining = false;
    let soundTimes = [];
    const timers = new Set(), animations = new Set();

    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (frozen) later(fn, 32); else fn(); }, ms); timers.add(id); return id; };
    function motion(el, frames, ms, done) {
      const a = el.animate(reduced.matches ? [{ opacity: .55 }, { opacity: 1 }] : frames, { duration: reduced.matches ? 100 : ms, easing: 'ease-out' });
      animations.add(a);
      a.finished.then(() => { animations.delete(a); a.cancel(); done?.(); }).catch(() => {});
      return a;
    }
    function limb(svg, key, angle, conf) {
      const pivot = conf[key], el = svg.querySelector(`#${key}`);
      if (pivot && el) el.setAttribute('transform', `rotate(${angle} ${pivot[0]} ${pivot[1]})`);
    }
    function eyes(closed) {
      const open = hero.querySelector('#eyes-open'), shut = hero.querySelector('#eyes-closed');
      if (open) open.style.display = closed ? 'none' : '';
      if (shut) shut.style.display = closed ? '' : 'none';
    }
    function scheduleBlink() {
      blinkTimer = setTimeout(() => {
        if (!running) return;
        if (frozen) { scheduleBlink(); return; }
        eyes(true); openTimer = setTimeout(() => { if (!frozen) eyes(false); if (running) scheduleBlink(); }, 130);
      }, 2500 + Math.random() * 3500);
    }
    function animate(now) {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      const budget = 33;
      if (frozen || now - lastFrame < budget) return;
      lastFrame = now - (now - lastFrame) % budget;
      window.ClickerScene.update(Math.min(.1, (now - lastSceneFrame) / 1000)); lastSceneFrame = now;
      const duration = combo >= 3 ? 150 : 220, elapsed = now - pressAt;
      const squeeze = elapsed < 55 ? elapsed / 55 : Math.max(0, 1 - (elapsed - 55) / duration);
      const breath = reduced.matches ? 0 : Math.sin(now / 3400 * Math.PI * 2) * .015;
      const k = reduced.matches ? 0 : squeeze;
      hero.style.transform = `scale(${1 + breath + pressAmount * k}, ${1 + breath - (pressAmount + .02) * k})`;
      limb(hero, 'legL', 10 * (cfg.limbScale || 1) * k, cfg);
      limb(hero, 'legR', -10 * (cfg.limbScale || 1) * k, cfg);

    }
    function start() {
      if (running || document.hidden) return;
      window.GachaFx.init($('click-fx')); fx = window.GachaFx.createScope();
      const spawn = fx.spawn;
      fx.spawn = p => {
        const update = p.update;
        spawn.call(fx, { ...p, update(part, dt) {
          if (frozen) { part.life += dt; return; }
          if (update) update(part, dt);
          else { part.vx *= part.drag; part.vy = part.vy * part.drag + part.g * dt; part.x += part.vx * dt; part.y += part.vy * dt; part.rot += part.vr * dt; }
        } });
      };
      window.ClickerScene.attach(fx);
      running = true; lastSceneFrame = lastFrame = performance.now(); raf = requestAnimationFrame(animate); scheduleBlink();
    }
    function stop() {
      frozen = false; heldAmount = 0; $('game').classList.remove('stage-frozen'); window.ClickerScene.detach(); fx?.stop(); fx = null; joining = false; $('join-flight').replaceChildren();
      cancelAnimationFrame(meterRaf); meterRaf = 0; meterFull = false; $('package-progress').classList.remove('meter-full'); $('effect-label').hidden = true;
      running = false; cancelAnimationFrame(raf); raf = 0;
      clearTimeout(blinkTimer); clearTimeout(openTimer); eyes(false);
      timers.forEach(clearTimeout); timers.clear(); animations.forEach((a) => a.cancel()); animations.clear();
      $('floaters').replaceChildren();
      hero.style.transform = ''; limb(hero, 'legL', 0, cfg); limb(hero, 'legR', 0, cfg);
      bagBusy = false; if (latestState) showBag(stateOf(latestState)); pressAt = -Infinity; combo = 0; clickChain = 0; fxClickAt = -Infinity;
    }
    function float(amount, heavy, point) {
      const el = document.createElement('span'); el.className = 'floater';
      el.innerHTML = '<img src="clicker-coin.png" alt="" /><b></b>';
      el.querySelector('b').textContent = `+${format(amount)}`;
      el.style.left = `${point.x + Math.random() * 20 - 10}px`; el.style.top = `${point.y - 12}px`; el.style.fontSize = heavy ? '26px' : clickChain >= 3 ? '22px' : '20px'; if (clickChain >= 3) el.style.color = '#E9B94E';
      $('floaters').append(el);
      motion(el, [{ transform: `translateY(0) scale(.6) rotate(${heavy ? -6 : 0}deg)`, opacity: 1 }, { transform:'translateY(-3px) scale(1) rotate(0)', opacity:1, offset:.125 }, { transform: 'translateY(-24px)', opacity: 1, offset: 2 / 3 }, { transform: 'translateY(-36px)', opacity: 0 }], 480, () => { el.remove(); });
    }
    function click(amount, heavy = false, s, completed = 0, point = IMPACT) {
      if (frozen) { heldAmount += amount; latestState = s; return; }
      if (!running) return;
      const now = performance.now(); combo = now - previousClick <= 400 ? combo + 1 : 1; previousClick = now;
      pressAt = now; pressAmount = combo >= 3 ? .10 : .08;
      soundTimes = soundTimes.filter((t) => now - t < 1000);
      if (soundTimes.length < 6) { sound(heavy ? 'skill' : 'click'); soundTimes.push(now); }
      clickChain = now - fxClickAt <= 180 ? clickChain + 1 : 1; fxClickAt = now;
      const crossed = s.package.index > lastPackage || stateOf(s) !== bagState;
      render(s, { completed, manual: true, heavy });
      burst(heavy ? 18 : clickChain >= 3 ? 12 : 8, heavy, !heavy && clickChain >= 3, point);
      if (heavy) bounce(true); else if (!crossed && !bagBusy) bounce(false);
      float(amount, heavy, point);
    }
    function setPartners(s) {
      teamState = s; if (frozen) return;
      const ids = Object.keys(window.ClickerBalance.characters).filter(id => s.collection[id]);
      page = Math.min(page, Math.max(0, Math.ceil(ids.length / 10) - 1));
      const key = JSON.stringify([s.collection, s.skillSlots, s.effects.find(e => e.source === 'zhenmu')?.target, page]);
      if (key === teamKey) return; teamKey = key;
      $('buddies').replaceChildren();
      $('buddy-page').textContent = `${page + 1}/${Math.max(1, Math.ceil(ids.length / 10))}`;
      $('buddy-prev').disabled = joining || page === 0; $('buddy-next').disabled = joining || (page + 1) * 10 >= ids.length;
      if (!ids.length) $('buddies').textContent = '還沒有夥伴。點 50 次，玥玥會來幫忙。';
      ids.slice(page * 10, page * 10 + 10).forEach(id => {
        const entry = window.GachaPool.byId[id], el = document.createElement('button');
        el.title = `${entry.name}・查看名冊與裝備技能`; el.className = 'buddy'; el.dataset.id = id; el.style.setProperty('--rarity', {common:'#A9A297',rare:'#94BED0',epic:'#B8A2CF',legendary:'#E9B94E'}[entry.rarity]);
        const portrait = document.createElement('span'); portrait.className = 'buddy-portrait'; portrait.append(card.art.create(entry));
        const name = document.createElement('b'); name.textContent = entry.name;
        const stars = document.createElement('span'); stars.textContent = `★${E.stars(s.collection[id])}`;
        el.append(portrait, name, stars);
        const slot = s.skillSlots.indexOf(id); if (slot >= 0) { const stamp = document.createElement('small'); stamp.className = 'slot-stamp'; stamp.textContent = `槽${slot + 1}`; el.append(stamp); }
        if (s.effects.some(e => e.source === 'zhenmu' && e.target === id)) { const tag = document.createElement('small'); tag.className = 'parasite-stamp'; tag.textContent = '寄生'; el.append(tag); }
        el.onclick = () => showRoster(id); $('buddies').append(el);
      });
    }
    $('buddy-prev').onclick = () => { page--; setPartners(teamState); };
    $('buddy-next').onclick = () => { page++; setPartners(teamState); };
    function updateParasite(s, instant) {
      const effect = s.effects.find(e => e.source === 'zhenmu');
      if (effect?.target === parasite?.target && !instant) return;
      parasite = effect || null; const label = $('parasite-label');
      if (effect) {
        label.replaceChildren(card.art.create(window.GachaPool.byId[effect.target]));
        const text = document.createElement('span'); text.textContent = `寄生・${window.GachaPool.byId[effect.target].name}`; label.append(text);
        label.hidden = false; label.title = text.textContent;
        // 全名只亮 2.4 秒，之後縮成宿主小頭像掛在珍母身側，不讓字卡整段 20 秒佈在舞台上
        label.classList.toggle('compact', !!instant);
        if (!instant) { motion(label, [{transform:'scale(.85)',opacity:0},{transform:'scale(1)',opacity:1}],160); later(() => { if (parasite?.target === effect.target) label.classList.add('compact'); }, 2400); }
      } else if (!label.hidden) {
        if (instant) label.hidden = true;
        else motion(label,[{opacity:1},{opacity:0}],120,()=>{ if (!parasite) label.hidden = true; });
      }
    }
    const stateOf = s => { const r = Math.max(0, 1 - s.package.progress / E.requirement(s.package.index, s.settings.scene)); return r > .75 ? 0 : r > .5 ? 1 : r > .25 ? 2 : 3; };
    function showBag(state) { $('bag').dataset.skin = window.ClickerScene.current.bagSkin; bagState = state; $('bag-image').src = `clicker-bag-${state}.png`; $('bag-image').alt = `零食包：${['完整','輕損','中損','重損','撕開'][state]}`; }
    function bounce(heavy) {
      motion($('bag-image'), heavy ? [{transform:'scale(1)'},{transform:'scale(1.10)',offset:.35},{transform:'scale(.97)',offset:.7},{transform:'scale(1)'}] : [{transform:'scale(1)'},{transform:'scale(1.045)',offset:.5},{transform:'scale(1)'}], heavy ? 180 : 140);
    }
    // 撕口錨點（全畫面座標）。碎紙要看得見：夠大、噴得高、有翻面暗色，落回時已在桌墊上
    const IMPACT = { x: 485, y: 240 };
    function burst(count, heavy = false, chain = false, point = IMPACT) {
      if (!fx) return;
      const rand = (a,b) => a + Math.random() * (b-a), sparks = count <= 6 ? 0 : 2;
      const k = chain ? 1.15 : 1;
      for (let i = 0; i < count; i++) {
        const spark = i >= count - sparks;
        const pink = i % 6 < 4;
        const color = spark ? '#E9B94E' : pink ? '#EF8E8E' : '#FFF3DC';
        const color2 = pink ? '#C9686B' : '#D8C4A0';
        const w = heavy ? rand(14, 22) : rand(10, 16), h = w * rand(.55, .8);
        fx.spawn(spark
          ? { sprite: 14, x: point.x + rand(-10, 10), y: point.y + rand(-4, 4), vx: rand(-50, 50), vy: rand(-120, -50), g: 80,
              r: heavy ? rand(9, 13) : rand(6, 9), life: rand(.28, .4), rot: rand(0, Math.PI * 2), vr: rand(-1, 1), drag: .985, shrink: true, color, blend: 'lighter' }
          : { shape: 'shard', x: point.x + rand(-10, 10), y: point.y + rand(-4, 4),
              vx: rand(heavy ? -170 : -120, heavy ? 170 : 120) * k, vy: rand(heavy ? -330 : -260, heavy ? -170 : -130) * k, g: heavy ? 520 : 460,
              life: heavy ? rand(.7, 1) : rand(.55, .8), w, h, rot: rand(0, Math.PI * 2), vr: rand(heavy ? -9 : -6, heavy ? 9 : 6),
              drag: .99, color, color2, fadeK: 4 });
      }
      if (chain) fx.spawn({ sprite:14, x:point.x, y:point.y, r:6, vy:-90, life:.3, color:'#E9B94E', blend:'lighter' });
      if (heavy) fx.spawn({ sprite:3, x:point.x, y:point.y, r:36, life:.25, color:'#E9B94E', blend:'lighter', update(p) { p.r = 36 + 54 * (1 - p.life / p.max); } });
      if (heavy) fx.spawn({ sprite: 5, x: point.x, y: point.y, r: 40, life: .14, vx: 0, vy: 0, g: 0, rot: -.35, color: '#E9B94E', blend: 'lighter' });
    }
    let meterRaf = 0, meterTarget = 0, meterFull = false, meterStarted = 0;
    function meter(target, crossed, instant) {
      if (!instant && !crossed && target === meterTarget && (meterRaf || $('package-progress').value === target)) return;
      meterTarget = target;
      if (instant || reduced.matches) { cancelAnimationFrame(meterRaf); meterRaf = 0; meterFull = false; $('package-progress').value = target; return; }
      if (crossed) meterFull = true;
      if (meterRaf) return;
      meterStarted = performance.now();
      function frame(now) {
        if (frozen) { meterRaf = requestAnimationFrame(frame); return; }
        const el = $('package-progress'), goal = meterFull ? 1 : meterTarget;
        el.value += (goal - el.value) * .25;
        if (Math.abs(goal - el.value) < .002 || now - meterStarted >= 180) {
          el.value = goal;
          if (meterFull) { meterFull = false; meterStarted = now; el.classList.add('meter-full'); meterRaf = 0; later(() => { el.classList.remove('meter-full'); el.value = 0; meterStarted = performance.now(); meterRaf = requestAnimationFrame(frame); }, 200); return; }
          meterRaf = 0; return;
        }
        meterRaf = requestAnimationFrame(frame);
      }
      meterRaf = requestAnimationFrame(frame);
    }
    function render(s, { instant = false, completed = 0, manual = false, heavy = false } = {}) {
      latestState = s; if (frozen) return; setPartners(s);
      if (!running && !instant) { lastPackage = s.package.index; return; }
      const need = E.requirement(s.package.index, s.settings.scene), next = stateOf(s), crossed = next !== bagState;
      $('package-label').textContent = `${format(s.package.index)} 包`;
      meter(s.package.progress / need, s.package.index > lastPackage, instant); $('package-number').textContent = `${format(s.package.progress)} / ${format(need)}`;
      if (s.package.index > lastPackage && !instant) {
        $('package-result').textContent = `完成 ${completed || s.package.index - lastPackage} 包`;
        if (!bagBusy) {
          bagBusy = true; showBag(4); burst(6); impact();
          motion($('package-result'), [{opacity:0,transform:'translateY(8px) scale(.7)'},{opacity:1,transform:'translateY(-12px) scale(1)',offset:.35},{opacity:0,transform:'translateY(-28px) scale(1)'}],700);
          later(() => motion($('bag'), [{opacity:1},{opacity:0}],100,()=>{
            showBag(stateOf(latestState));
            motion($('bag'),[{transform:'translateY(10px)',opacity:0},{transform:'translateY(0)',opacity:1}],140,()=>{bagBusy=false; showBag(stateOf(latestState));});
          }),180);
        }
        if (!manual) burst(4);
      } else if (!bagBusy) { showBag(next); if (crossed && !instant) { if (!heavy) bounce(false); if (!manual) burst(4); } }
      lastPackage = s.package.index; updateParasite(s, instant);
    }
    function impact(point = IMPACT) {
      if (reduced.matches) return;
      const el = document.createElement('img'); el.src = 'clicker-fx-impact-burst.png'; el.className = 'small-impact'; el.style.left = `${point.x - 65}px`; el.style.top = `${point.y - 65}px`; $('floaters').append(el);
      motion(el,[{transform:'scale(.2)',opacity:1},{transform:'scale(.5)',opacity:1,offset:.6},{transform:'scale(.6)',opacity:0}],150,()=>el.remove());
    }
    function freeze(on) {
      lastSceneFrame = performance.now();
      frozen = on; $('game').classList.toggle('stage-frozen', on);
      animations.forEach(a => on ? a.pause() : a.play());
      if (!on) {
        eyes(false);
        pressAt = -Infinity;
        if (latestState) render(latestState);
        if (heldAmount) float(heldAmount, true, IMPACT);
        heldAmount = 0;
      }
    }
    function skill(effect) {
      const label = $('effect-label'); label.hidden = false;
      label.textContent = window.ClickerBalance.characters[effect.source].skill;
      motion(label,[{transform:'translateY(8px) scale(.8)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],180);
      later(()=>{ label.hidden = true; },1800);
      if (effect.source === 'zhenmu') {
        motion($('parasite-label'),[{transform:'translateY(-40px) scale(1.3)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],300,()=>impact({x:250,y:285}));
      }
      const el = document.querySelector(`.buddy[data-id="${effect.source}"]`);
      if (el && running) motion(el,[{transform:'scale(1)'},{transform:'scale(1.08)',offset:.5},{transform:'scale(1)'}],140);
    }
    function join(s, entries) {
      if (frozen) { later(()=>join(latestState, entries),32); return; }
      if (!entries.length || !running) return;
      const ids = Object.keys(window.ClickerBalance.characters).filter(id => s.collection[id]);
      const unique = [...new Map(entries.map(e => [e.id,e])).values()], groups = new Map();
      unique.forEach(e => { const p = Math.floor(ids.indexOf(e.id)/10); if (!groups.has(p)) groups.set(p,[]); groups.get(p).push(e); });
      joining = true;
      const batches = [...groups];
      function group(index) {
        if (index >= batches.length) { joining = false; teamKey = ''; setPartners(s); return; }
        const [p, items] = batches[index]; page = p; teamKey = ''; setPartners(s);
        items.forEach((e,i) => later(()=>{
          const target = document.querySelector(`.buddy[data-id="${e.id}"] .buddy-portrait`), box = $('game').getBoundingClientRect(), rect = target.getBoundingClientRect(), zoom = box.width/960;
          const from = e.origin || {x:320,y:98}, to = {x:(rect.left+rect.width/2-box.left)/zoom,y:(rect.top+rect.height/2-box.top)/zoom};
          const el = document.createElement('div'); el.className = 'joining-portrait'; el.append(card.art.create(window.GachaPool.byId[e.id])); $('join-flight').append(el);
          motion(el,[{transform:`translate(${from.x-32}px,${from.y-32}px) scale(1)`},{transform:`translate(${(from.x+to.x)/2-32}px,${(from.y+to.y)/2-68}px) scale(.8)`,offset:.5},{transform:`translate(${to.x-32}px,${to.y-32}px) scale(.625)`}],380,()=>{el.remove(); motion(target,[{transform:'scale(1)'},{transform:'scale(1.08)',offset:.5},{transform:'scale(1)'}],140); notice(`${window.GachaPool.byId[e.id].name} 已入隊・★${E.stars(s.collection[e.id])}`);});
        },i*70));
        later(()=>group(index+1),items.length*70+520);
      }
      group(0);
    }
    return { start, stop, click, render, skill, join, setPartners, freeze, get frozen() { return frozen; } };
  }
  return { create };
})();
