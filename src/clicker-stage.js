window.ClickerStage = (() => {
  function create({ card, sound, format }) {
    const $ = (id) => document.getElementById(id), E = window.ClickerEconomy;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const hero = card.art.create(window.GachaPool.byId.zhenmu), cfg = card.art.cfg('zhenmu');
    $('hero').append(hero);
    let running = false, raf = 0, lastFrame = 0, blinkTimer = 0, openTimer = 0;
    let pressAt = -Infinity, pressAmount = 0, combo = 0, previousClick = -Infinity;
    let gesture = null, displayedSlots = '', parasite = null, lastPackage = 1, bagBusy = false;
    let floatingTimes = [], floating = [], merged = 0, soundTimes = [];
    const timers = new Set(), animations = new Set();
    const partners = new Map();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
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
        eyes(true); openTimer = setTimeout(() => { eyes(false); if (running) scheduleBlink(); }, 130);
      }, 2500 + Math.random() * 3500);
    }
    function animate(now) {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      const budget = 33;
      if (now - lastFrame < budget) return;
      lastFrame = now - (now - lastFrame) % budget;
      const duration = combo >= 3 ? 150 : 220, elapsed = now - pressAt;
      const squeeze = elapsed < 55 ? elapsed / 55 : Math.max(0, 1 - (elapsed - 55) / duration);
      const breath = reduced.matches ? 0 : Math.sin(now / 3400 * Math.PI * 2) * .015;
      const k = reduced.matches ? 0 : squeeze;
      hero.style.transform = `scale(${1 + breath + pressAmount * k}, ${1 + breath - (pressAmount + .02) * k})`;
      limb(hero, 'legL', 10 * (cfg.limbScale || 1) * k, cfg);
      limb(hero, 'legR', -10 * (cfg.limbScale || 1) * k, cfg);
      if (gesture) {
        const t = Math.min(1, (now - gesture.start) / 400), wave = reduced.matches ? 0 : Math.sin(t * Math.PI);
        limb(gesture.svg, gesture.key, gesture.degrees * wave, gesture.cfg);
        if (t === 1) gesture = null;
      }
    }
    function start() {
      if (running || document.hidden) return;
      running = true; lastFrame = performance.now(); raf = requestAnimationFrame(animate); scheduleBlink();
    }
    function stop() {
      running = false; cancelAnimationFrame(raf); raf = 0;
      clearTimeout(blinkTimer); clearTimeout(openTimer); eyes(false);
      timers.forEach(clearTimeout); timers.clear(); animations.forEach((a) => a.cancel()); animations.clear();
      $('floaters').replaceChildren(); floating = []; floatingTimes = []; merged = 0;
      if (gesture) limb(gesture.svg, gesture.key, 0, gesture.cfg); gesture = null;
      hero.style.transform = ''; limb(hero, 'legL', 0, cfg); limb(hero, 'legR', 0, cfg);
      $('bag-image').src = 'clicker-bag.png'; bagBusy = false; pressAt = -Infinity; combo = 0;
    }
    function float(amount, now) {
      merged += amount; floatingTimes = floatingTimes.filter((t) => now - t < 1000);
      if (floatingTimes.length >= 8 || floating.length >= 12) {
        const last = floating[floating.length - 1];
        if (last) { last.amount += merged; last.el.querySelector('b').textContent = `+${format(last.amount)}`; merged = 0; }
        return;
      }
      const el = document.createElement('span'); el.className = 'floater';
      el.innerHTML = '<img src="clicker-coin.png" alt="" /><b></b>';
      const item = { el, amount: merged }; merged = 0;
      el.querySelector('b').textContent = `+${format(item.amount)}`;
      el.style.left = `${248 + (floatingTimes.length % 3 - 1) * 24}px`; el.style.top = '105px';
      $('floaters').append(el); floating.push(item); floatingTimes.push(now);
      motion(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-54px)', opacity: 0 }], 900, () => { el.remove(); floating = floating.filter((v) => v !== item); });
    }
    function click(amount, heavy = false) {
      if (!running) return;
      const now = performance.now(); combo = now - previousClick <= 400 ? combo + 1 : 1; previousClick = now;
      pressAt = now; pressAmount = combo >= 3 ? .10 : .08;
      soundTimes = soundTimes.filter((t) => now - t < 1000);
      if (soundTimes.length < 6) { sound(heavy ? 'skill' : 'click'); soundTimes.push(now); }
      float(amount, now);
    }
    function partner(id, position) {
      const el = document.createElement('div'); el.className = 'partner'; el.dataset.id = id;
      el.style.left = `${[25, 462, 105][position]}px`;
      el.style.setProperty('--partner-color', `var(--c-${window.GachaPool.byId[id].rarity})`);
      const svg = card.art.create(window.GachaPool.byId[id]); el.append(svg);
      const label = document.createElement('small'); label.textContent = window.GachaPool.byId[id].name; el.append(label);
      $('partners').append(el); partners.set(id, { el, svg }); return el;
    }
    function setPartners(s, featured) {
      let ids = s.skillSlots.filter((id) => id && id !== 'zhenmu');
      // 入隊展示替換一格，不追加第四位；下次槽位變更再恢復對應。
      if (featured && featured !== 'zhenmu' && !ids.includes(featured)) ids = [featured, ...ids].slice(0, 3);
      const key = ids.join(',');
      if (key === displayedSlots) return;
      displayedSlots = key; partners.clear(); $('partners').replaceChildren();
      ids.forEach((id, i) => partner(id, i));
    }
    function updateParasite(s, instant) {
      const effect = s.effects.find((e) => e.source === 'zhenmu');
      if (effect?.target === parasite?.target && !instant) return;
      const previous = parasite; parasite = effect || null;
      if (effect) {
        let source = partners.get(effect.target);
        // 未展示的宿主替換夥伴席，中央宿主仍計入最多三位夥伴。
        if (!source) {
          if (partners.size >= 3) { const [id, p] = [...partners][partners.size - 1]; p.el.remove(); partners.delete(id); }
          partner(effect.target, Math.min(partners.size, 2)); source = partners.get(effect.target);
        }
        const r = source.el.getBoundingClientRect(), center = $('hero-position').getBoundingClientRect(), zoom = center.width / 240;
        source.el.hidden = true;
        const host = card.art.create(window.GachaPool.byId[effect.target]), hostCfg = card.art.cfg(effect.target);
        host.style.height = `${hostCfg.height}px`; $('parasite-host').replaceChildren(host);
        // 同一個 240×256 座標：圓頂落在宿主頭臉，而不是站上頭頂。
        // PARASITE-V2：同底、同座標，不用臉中心另算偏移。宿主和珍母一起放大到主角尺寸。
        host.style.height = `${hostCfg.height * 190 / cfg.height}px`;
        $('hero').style.transform = '';
        if (!instant && running) {
          motion($('parasite-host'), [{ transform: `translate(${(r.left - center.left) / zoom}px, 0)` }, { transform: 'translate(0, 0)' }], 300);
          motion($('hero'), [{ transform: 'translate(0, -35px)' }, { transform: 'translate(0, 0)' }], 300);
        }
      } else if (previous) {
        const finish = () => { $('parasite-host').replaceChildren(); for (const p of partners.values()) p.el.hidden = false; };
        $('hero').style.transform = '';
        if (!instant && running) motion($('hero'), [{ transform: 'translate(0, 0)' }, { transform: 'translate(-28px, -35px)', offset: .5 }, { transform: 'translate(0, 0)' }], 300, finish);
        else finish();
      }
    }
    function render(s, { instant = false, completed = 0 } = {}) {
      if (!running && !instant) { lastPackage = s.package.index; return; }
      const need = E.requirement(s.package.index), fraction = s.package.progress / need;
      $('package-label').textContent = `第 ${s.package.index} 包`;
      $('package-progress').value = fraction; $('package-number').textContent = `${format(s.package.progress)} / ${format(need)}`;
      if (s.package.index > lastPackage && !instant) {
        $('package-result').textContent = `完成 ${completed || s.package.index - lastPackage} 包`;
        if (!bagBusy) {
          bagBusy = true; $('bag-image').src = 'clicker-bag-open.png'; $('tears').hidden = true;
          later(() => motion($('bag'), [{ opacity: 1 }, { opacity: 0 }], 180, () => {
            $('bag-image').src = 'clicker-bag.png'; $('tears').hidden = false;
            motion($('bag'), [{ transform: 'translateY(25px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], 220);
            bagBusy = false;
          }), 300);
        }
      }
      lastPackage = s.package.index;
      if (!bagBusy) $('tears').hidden = false;
      [...$('tears').children].forEach((el, i) => { el.hidden = fraction < (i + 1) * .25; });
      updateParasite(s, instant);
      $('effect-label').textContent = s.effects.map((e) => e.kind === 'click' ? `×${e.multiplier} · ${e.remaining} 次` : `複製 ${window.GachaPool.byId[e.target].name} +${format(e.value)}/秒`).join('　');
    }
    function skill(effect) {
      if (!running || effect.source === 'zhenmu') return;
      if (gesture) limb(gesture.svg, gesture.key, 0, gesture.cfg);
      const p = partners.get(effect.source); if (!p) return;
      const conf = card.art.cfg(effect.source), key = effect.source === 'yueyue2' ? 'tail' : 'pawR';
      const degrees = key === 'tail' ? 5 * (conf.tailScale || 1) : (conf.up || 1) * 20 * (conf.limbScale || 1) * (conf.pawScale || 1);
      gesture = { svg: p.svg, cfg: conf, key, degrees, start: performance.now() };
    }
    function join(s, ids) {
      if (!ids.length) return;
      const rank = window.GachaPool.RARITY_ORDER;
      const id = [...ids].sort((a, b) => rank.indexOf(window.GachaPool.byId[a].rarity) - rank.indexOf(window.GachaPool.byId[b].rarity))[0];
      setPartners(s, id); render(s, { instant: true });
      const el = partners.get(id)?.el;
      if (el && running) motion(el, [{ transform: 'translateX(-55px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], 320);
    }
    return { start, stop, click, render, skill, join, setPartners };
  }
  return { create };
})();
