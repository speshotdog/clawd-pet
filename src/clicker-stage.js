window.ClickerStage = (() => {
  function create({ card, sound, format, showRoster, notice, tick, thiefHit }) {
    const $ = (id) => document.getElementById(id), E = window.ClickerEconomy;
    const thiefEl = document.createElement('button'); thiefEl.id = 'snack-thief'; thiefEl.hidden = true;
    thiefEl.innerHTML = '<img alt="零食小偷"><span>🍪</span>'; $('targets').append(thiefEl);
    thiefEl.onclick = () => thiefHit?.();
    let thiefActive = false, thiefLeaving = false;
    function renderThief(s, instant) {
      const active = !!s.thief?.active && !s.boss, cfg = window.ClickerScene.resolve(s.settings.scene).thief;
      if (active) {
        thiefEl.firstElementChild.src = cfg.sprite;
        thiefEl.hidden = false; thiefEl.disabled = s.thief.remainingMs > 12000;
        thiefEl.setAttribute('aria-label', `零食小偷：還要點 ${cfg.hits-s.thief.hits} 下`);
        thiefEl.lastElementChild.hidden = true;
        if (!thiefActive && !instant) motion(thiefEl,[{transform:'translateX(180px)'},{transform:'translateX(0)'}],600);
      } else if (thiefActive && !instant && !s.boss && cfg) {
        thiefLeaving = true; thiefEl.disabled = true; thiefEl.lastElementChild.hidden = !!s.thief?.won;
        motion(thiefEl,[{transform:'translateX(0)',opacity:1},{transform:'translateX(180px)',opacity:0}],600,()=>{thiefEl.hidden=true;thiefLeaving=false;});
      } else if (!thiefLeaving || instant || s.boss || !cfg) { thiefEl.hidden = true; thiefLeaving = false; }
      thiefActive = active;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const hero = card.art.create(window.GachaPool.byId.zhenmu), cfg = card.art.cfg('zhenmu');
    $('hero').append(hero);
    let frozen = false, heldAmount = 0;
    let running = false, raf = 0, lastFrame = 0, lastSceneFrame = 0, blinkTimer = 0, openTimer = 0;
    let pressAt = -Infinity, pressAmount = 0, combo = 0, previousClick = -Infinity;
    let parasite = null, lastPackage = 1, bagBusy = false, latestState = null, bagState = 0;
    let fx = null, page = 0, teamState = null, teamKey = '', clickChain = 0, fxClickAt = -Infinity, joining = false;
    let soundTimes = [];
    let bossKey=null, resultKey=null, bossBusy=false, bossEntering=false, heartbeat=-1, shellTarget=null, struckRing=null;
    const GATE_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200"><g stroke="#3b2a1a" stroke-width="6" stroke-linejoin="round"><rect x="20" y="70" width="180" height="34" rx="8" fill="#ffb347"/><rect x="20" y="120" width="180" height="34" rx="8" fill="#ffb347"/><line x1="50" y1="55" x2="50" y2="190"/><line x1="170" y1="55" x2="170" y2="190"/></g><g fill="#3b2a1a"><rect x="44" y="70" width="20" height="34" transform="skewX(-20)"/><rect x="98" y="70" width="20" height="34" transform="skewX(-20)"/><rect x="152" y="70" width="20" height="34" transform="skewX(-20)"/><rect x="71" y="120" width="20" height="34" transform="skewX(-20)"/><rect x="125" y="120" width="20" height="34" transform="skewX(-20)"/><rect x="179" y="120" width="20" height="34" transform="skewX(-20)"/></g><circle cx="110" cy="30" r="16" fill="#ff4d4d" stroke="#3b2a1a" stroke-width="5"/><circle cx="70" cy="32" r="5" fill="#3b2a1a"/><circle cx="150" cy="32" r="5" fill="#3b2a1a"/></svg>';
    // 第十一輪：三連包子包狀態、輸送帶、夜市禮包的演出狀態
    let subStates=[0,0,0], tripleBusy=false, lastMissed=null, beltTime=0, beltWarned=false, beltTicked=null;
    let giftKey=null, giftResultKey=null, giftLanded=false;
    // 舞台原點在全畫面 (16,72)：三個子包各 100×120 並排在舞台 x 330／392／454（中心 380／442／504），禮包落在舞台 (80,177)（技能槽上方）
    const SUB_CENTER = i => ({ x: 396 + 62*i, y: 318 });
    const GIFT_POINT = { x: 96, y: 249 };
    const enemyOf = s => E.tripleFor(s.settings.scene) ? 'triple' : E.timerFor(s.settings.scene) ? 'timer' : E.giftFor(s.settings.scene) ? 'gift' : '';
    const packEl = s => E.tripleFor((s || latestState).settings.scene) ? $('triple') : $('bag');
    const timers = new Set(), animations = new Set();

    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (frozen) later(fn, 32); else fn(); }, ms); timers.add(id); return id; };
    function motion(el, frames, ms, done, easing = 'ease-out') {
      const a = el.animate(reduced.matches ? [{ opacity: .55 }, { opacity: 1 }] : frames, { duration: reduced.matches ? 100 : ms, easing });
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
      const dt = Math.min(.1, (now - lastSceneFrame) / 1000);
      window.ClickerScene.update(dt); lastSceneFrame = now;
      bossClock(); beltClock(dt); giftClock();
      const duration = combo >= 3 ? 150 : 220, elapsed = now - pressAt;
      const squeeze = elapsed < 55 ? elapsed / 55 : Math.max(0, 1 - (elapsed - 55) / duration);
      const breath = reduced.matches ? 0 : Math.sin(now / 3400 * Math.PI * 2) * .015;
      const k = reduced.matches ? 0 : squeeze;
      hero.style.transform = `scale(${1 + breath + pressAmount * k}, ${1 + breath - (pressAmount + .02) * k})`;
      limb(hero, 'legL', 10 * (cfg.limbScale || 1) * k, cfg);
      limb(hero, 'legR', -10 * (cfg.limbScale || 1) * k, cfg);

    }
    function start() {
      if (running) return;   // 可見性由 clicker.js 判斷（WebView2 的 document.hidden 不可靠）
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
      $('stage').querySelectorAll('.mythic-fx').forEach(el => el.remove());
      document.querySelectorAll('.rate-stamp').forEach(el => el.remove()); passiveAt = -Infinity;
      hero.style.transform = ''; limb(hero, 'legL', 0, cfg); limb(hero, 'legR', 0, cfg);
      bagBusy = false; if (latestState) showBag(stateOf(latestState)); pressAt = -Infinity; combo = 0; clickChain = 0; fxClickAt = -Infinity;
      bossKey=null; bossBusy=false; bossEntering=false; resultKey=latestState?.bossResult ? JSON.stringify(latestState.bossResult) : null;
      for (const id of ['boss-view','boss-timer','boss-flash','boss-banner']) $(id).hidden=true;
      $('bag').style.visibility=''; $('bag').style.transform=''; $('stage').classList.remove('boss-shake');
      $('triple').style.visibility=''; $('triple').style.transform=''; tripleBusy=false; lastMissed=null; beltWarned=false; beltTicked=null;
      $('bag').classList.remove('shiver'); $('belt-lamp').classList.remove('warn'); $('belt-timer').classList.remove('warn');
      giftKey=null; giftLanded=false; giftResultKey=latestState?.giftResult ? String(latestState.giftResult.at) : null;
      for (const id of ['gift-clip','gift-bag','gift-timer','gift-hot']) $(id).hidden=true;
      $('gift-bag').style.transform=''; $('gift-boss').style.transform='';
      $('shell-rings').classList.remove('blocked'); $('boss-shells').classList.remove('blocked');
      document.querySelectorAll('.shell-hit-overlay').forEach(el=>el.remove()); struckRing=null;
    }
    function appendFloater(el) {
      const list = $('floaters');
      if (list.querySelectorAll('.floater').length >= 12) (list.querySelector('.floater.passive') || list.querySelector('.floater')).remove();
      list.append(el);
    }
    let passiveAt = -Infinity;
    const PASSIVE_RISE = 42, PASSIVE_LIFE = 2600;   // 42px 疊三層還看得清楚；2600ms ÷ 每秒一個 ≈ 同時 3 個
    function floatPassive(amount) {
      const now = Math.floor(performance.now() / 1000);
      // ⚠ 這裡本來也擋 reduced.matches，結果是「系統開了減少動畫的玩家一個浮字都看不到」
      //（2026-09-08 使用者回報「部分玩家看不到被動傷害的顯示」，實測 reduce 下被動 0 個、點擊 0 個）。
      // 數字是資訊不是裝飾——減少動畫該減的是位移，不是把讀數整個拿掉。改成原地淡入淡出。
      if (!running || frozen || amount <= 0 || !latestState || E.rates(latestState).P <= 0 || now === passiveAt) return;
      passiveAt = now;
      // 第二十一輪：改成「同一欄疊起來」。斜斜飄走的單一數字沒有爽感（使用者回饋），
      // 改成固定 x、只往正上方走一點點、活久一點，讓相鄰幾秒的數字在畫面上疊成一小疊。
      // PASSIVE_RISE 小於字高，PASSIVE_LIFE / 1000 秒就是同時看得到幾個——不要再往上加，會變成一整條數字瀑布。
      const el = document.createElement('span'); el.className = 'floater passive'; el.textContent = `+${format(amount)}`;
      el.style.left = `${IMPACT.x + 78}px`; el.style.top = `${IMPACT.y + 34}px`;
      appendFloater(el);
      motion(el, reduced.matches
        ? [{transform:'translate(-100%,0)',opacity:0},{transform:'translate(-100%,0)',opacity:.9,offset:.12},{transform:'translate(-100%,0)',opacity:.9,offset:.72},{transform:'translate(-100%,0)',opacity:0}]
        : [{transform:'translate(-100%,0)',opacity:0},{transform:'translate(-100%,-4px)',opacity:.9,offset:.12},{transform:`translate(-100%,${-PASSIVE_RISE * .72}px)`,opacity:.9,offset:.62},{transform:`translate(-100%,${-PASSIVE_RISE}px)`,opacity:0}],
        PASSIVE_LIFE,()=>el.remove(),'linear');
    }
    function rateStamp(s) {
      if (!running || frozen) return false;
      const exponent = Math.floor(Math.log10(E.rates(s).P));
      if (exponent < 3 || exponent <= (s.peakRateStamp || 0)) return false;
      s.peakRateStamp = exponent;
      const el = document.createElement('div'); el.className = 'rate-stamp'; el.setAttribute('role','status');
      const label = exponent === 3 ? '1 千' : format(10 ** exponent).replace(/\.0+(?=\D|$)/,'').replace(/(\d)([\u4e00-\u9fff])/,'$1 $2');
      el.textContent = `每秒破 ${label}！`; $('stage').append(el);
      sound('upgrade');
      motion(el,[{transform:'translate(-50%,-50%) scale(1.6) rotate(-8deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1) rotate(-4deg)',opacity:1}],260);
      later(()=>motion(el,[{opacity:1},{opacity:0}],300,()=>el.remove()),1700);
      return true;
    }
    function float(amount, heavy, point, { sweep = false, text = null } = {}) {
      if (!running || frozen) return;   // 同上：reduced 也要看得到數字，只是不飄
      const P = latestState ? E.rates(latestState).P : 0, ratio = P > 0 ? amount / P : amount > 0 ? Infinity : 0;
      const size = ratio >= 200 ? 42 : ratio >= 30 ? 36 : ratio >= 5 ? 30 : 26, tilt = ratio >= 30 ? -4 : 0;
      const el = document.createElement('span'); el.className = 'floater';
      el.innerHTML = '<img src="clicker-coin.png" alt="" /><b></b>';
      el.querySelector('b').textContent = `+${format(amount)}`;
      // 掃過去的浮字加「掃！」小章；漏包的浮字是灰字、沒有錢幣
      if (sweep) { const stamp = document.createElement('i'); stamp.className = 'sweep-stamp'; stamp.textContent = '掃！'; el.append(stamp); }
      if (text) { el.classList.add('miss'); el.querySelector('img').remove(); el.querySelector('b').textContent = text; }
      el.style.left = `${point.x + Math.random() * 20 - 10}px`; el.style.top = `${point.y - 12}px`; el.style.fontSize = `${size}px`; el.style.color = text ? '#9A9A9A' : ratio >= 200 ? '#EF8E8E' : clickChain >= 3 ? '#E9B94E' : '#FFF6E6';
      if (ratio >= 200) el.querySelector('b').style.webkitTextStroke = '2px #30251F';
      appendFloater(el);
      motion(el, reduced.matches
        ? [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .72 }, { opacity: 0 }]
        : [{ transform: `translateY(0) scale(.6) rotate(${tilt}deg)`, opacity: 1 }, { transform:`translateY(-2px) scale(1.15) rotate(${tilt}deg)`, opacity:1, offset:30/720 }, { transform:`translateY(-4px) scale(1) rotate(${tilt}deg)`, opacity:1, offset:60/720 }, { transform: `translateY(-40px) rotate(${tilt}deg)`, opacity: 1, offset:520/720 }, { transform: `translateY(-56px) rotate(${tilt}deg)`, opacity: 0 }],
        720, () => { el.remove(); }, 'linear');
    }
    function click(amount, heavy = false, s, completed = 0, point = IMPACT, result = {}) {
      if (frozen) { heldAmount += amount; latestState = s; return; }
      if (!running) return;
      const now = performance.now(); combo = now - previousClick <= 400 ? combo + 1 : 1; previousClick = now;
      pressAt = now; pressAmount = combo >= 3 ? .10 : .08;
      soundTimes = soundTimes.filter((t) => now - t < 1000);
      if (soundTimes.length < 6) { sound(heavy ? 'skill' : 'click'); soundTimes.push(now); }
      clickChain = now - fxClickAt <= 180 ? clickChain + 1 : 1; fxClickAt = now;
      const triple = E.tripleFor(s.settings.scene), sub = Number.isInteger(result.target) ? result.target : null;
      if (point === IMPACT && triple && sub !== null) point = SUB_CENTER(sub);
      if (result.giftHit) point = point === IMPACT ? GIFT_POINT : point;
      const crossed = s.package.index > lastPackage || (triple ? false : stateOf(s) !== bagState);
      struckRing=shellTarget?{el:shellTarget.cloneNode(true),parent:shellTarget.parentElement.parentElement}:null;
      const before = triple ? [...subStates] : null;
      render(s, { completed, manual: true, heavy });
      burst(heavy ? 18 : clickChain >= 3 ? 12 : 8, heavy, !heavy && clickChain >= 3, point);
      if (result.giftHit) motion($('gift-bag'), [{transform:'scale(1)'},{transform:'scale(1.06)',offset:.5},{transform:'scale(1)'}], 140);
      else if (triple) { if (!tripleBusy && s.package.index === lastPackage) for (const i of (sub === null ? [0,1,2] : [sub])) if (before[i] === subStates[i] && subStates[i] !== 4) subBounce(i, heavy); }
      else if (heavy) bounce(true); else if (!crossed && !bagBusy) bounce(false);
      float(amount, heavy, point, { sweep: !!result.sweep });
    }
    function subBounce(i, heavy) {
      const el = document.querySelector(`.sub-pack[data-sub="${i}"]`);
      motion(el, heavy ? [{transform:'scale(1)'},{transform:'scale(1.10)',offset:.35},{transform:'scale(.97)',offset:.7},{transform:'scale(1)'}] : [{transform:'scale(1)'},{transform:'scale(1.045)',offset:.5},{transform:'scale(1)'}], heavy ? 180 : 140);
    }
    function setPartners(s) {
      teamState = s; if (frozen) return;
      const ids = Object.keys(window.ClickerBalance.characters).filter(id => s.collection[id]);
      page = Math.min(page, Math.max(0, Math.ceil(ids.length / 10) - 1));
      const key = JSON.stringify([s.settings.scene,s.collection, s.skillSlots, s.effects.find(e => e.source === 'zhenmu')?.target, page]);
      if (key === teamKey) return; teamKey = key;
      $('buddies').replaceChildren();
      $('buddy-page').textContent = `${page + 1}/${Math.max(1, Math.ceil(ids.length / 10))}`;
      $('buddy-prev').disabled = joining || page === 0; $('buddy-next').disabled = joining || (page + 1) * 10 >= ids.length;
      if (!ids.length) $('buddies').textContent = '還沒有夥伴。點 50 次，玥玥會來幫忙。';
      ids.slice(page * 10, page * 10 + 10).forEach(id => {
        const entry = window.GachaPool.byId[id], el = document.createElement('button');
        el.title = `${entry.name}・查看名冊與裝備技能`; el.className = 'buddy'; el.dataset.id = id; el.style.setProperty('--rarity', {common:'#A9A297',rare:'#94BED0',epic:'#B8A2CF',legendary:'#E9B94E',mythic:'#FF4FD8'}[entry.rarity]);
        const portrait = document.createElement('span'); portrait.className = 'buddy-portrait'; portrait.append(card.art.create(entry));
        const name = document.createElement('b'); name.textContent = entry.name;
        const stars = document.createElement('span'); const t = s.transcend?.[id] || 0; stars.textContent = `★${E.stars(E.dust(s,id))}${t ? `◆${t}` : ''}`; if (t) stars.className = 'buddy-transcend';
        el.append(portrait, name, stars);
        if (window.ClickerScene.resolve(s.settings.scene).affinity.includes(id)) {const flag=document.createElement('small');flag.className='affinity-flag';flag.title=`${window.ClickerScene.resolve(s.settings.scene).name}當家：收益 ×1.5、冷卻 −20%`;flag.setAttribute('aria-label',flag.title);el.append(flag);}
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
    function showBag(state) { $('bag').dataset.skin = window.ClickerScene.current.bagSkin; bagState = state; const img=$('bag-image'); img.onerror=()=>{img.style.visibility='hidden';}; const src=`${window.ClickerScene.current.bagPrefix || (window.ClickerScene.current.bagSkin===1?'clicker-can-':'clicker-bag-')}${state}.png`; if(img.getAttribute('src')!==src) {img.style.visibility=''; img.src=src;} img.alt = `包裝：${['完整','輕損','中損','重損','撕開'][state]}`; }
    function bounce(heavy) {
      motion($('bag-image'), heavy ? [{transform:'scale(1)'},{transform:'scale(1.10)',offset:.35},{transform:'scale(.97)',offset:.7},{transform:'scale(1)'}] : [{transform:'scale(1)'},{transform:'scale(1.045)',offset:.5},{transform:'scale(1)'}], heavy ? 180 : 140);
    }
    // 撕口錨點（全畫面座標）。碎紙要看得見：夠大、噴得高、有翻面暗色，落回時已在桌墊上
    const IMPACT = { x: 485, y: 240 };
    const fxImages = {};
    function fxPreset(id) {
      const list = window.ClickerBalance.wardrobe.fx, preset = list.find(f => f.id === (id || latestState?.settings?.clickFx)) || list[0];
      if (preset.file && !fxImages[preset.file]) { const img = new Image(); img.src = preset.file; fxImages[preset.file] = img; }
      return preset;
    }
    const RIBBON = ['#EF8E8E', '#E9B94E', '#94BED0', '#B8A2CF', '#9BAF6B'];
    function burst(count, heavy = false, chain = false, point = IMPACT, paperOnly = false, fxId = null) {
      if (!fx) return;
      const rand = (a,b) => a + Math.random() * (b-a), sparks = paperOnly || count <= 6 ? 0 : 2;
      const k = chain ? 1.15 : 1;
      const preset = paperOnly ? null : fxPreset(fxId);
      if (preset && preset.id !== 'shard') {
        // 更衣室特效：只換粒子的形狀與色，數量、噴發方向、重力、連點加成配方與碎紙相同
        for (let i = 0; i < count; i++) {
          const color = preset.id === 'ribbon' ? RIBBON[i % RIBBON.length] : preset.color;
          fx.spawn({ sprite: preset.sprite, img: preset.file ? fxImages[preset.file] : undefined, x: point.x + rand(-10, 10), y: point.y + rand(-4, 4),
            vx: rand(heavy ? -170 : -120, heavy ? 170 : 120) * k, vy: rand(heavy ? -330 : -260, heavy ? -170 : -130) * k, g: heavy ? 520 : 460,
            life: heavy ? rand(.7, 1) : rand(.55, .8), r: heavy ? rand(11, 16) : rand(7, 11), rot: rand(0, Math.PI * 2), vr: rand(heavy ? -9 : -6, heavy ? 9 : 6),
            drag: .99, color, blend: preset.blend || 'source-over', shrink: true, fadeK: 4 });
        }
        if (chain) fx.spawn({ sprite:14, x:point.x, y:point.y, r:6, vy:-90, life:.3, color:'#E9B94E', blend:'lighter' });
        if (heavy) fx.spawn({ sprite:3, x:point.x, y:point.y, r:36, life:.25, color:'#E9B94E', blend:'lighter', update(p) { p.r = 36 + 54 * (1 - p.life / p.max); } });
        return;
      }
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
    let meterShown = 0, meterNeed = 100, meterAmount = 0;
    let meterRaf = 0, meterTarget = 0, meterFull = false, meterStarted = 0;
    function meter(target, crossed, instant) {
      // 進度沒變也要把需求寫上去（換場景或王包後包數不同，need 會變）
      if (!instant && !crossed && target === meterTarget && (meterRaf || $('package-progress').value === target)) { if (!meterRaf) $('package-number').textContent = `${format(meterShown)} / ${format(meterNeed)}`; return; }
      meterTarget = target;
      if (instant || reduced.matches) { cancelAnimationFrame(meterRaf); meterRaf = 0; meterFull = false; $('package-progress').value = target; meterShown = meterAmount; $('package-number').textContent = `${format(meterShown)} / ${format(meterNeed)}`; return; }
      if (crossed) meterFull = true;
      if (meterRaf) return;
      meterStarted = performance.now();
      function frame(now) {
        if (frozen) { meterRaf = requestAnimationFrame(frame); return; }
        meterShown += (meterAmount-meterShown)*.25;
        $('package-number').textContent = `${format(meterShown)} / ${format(meterNeed)}`;
        const el = $('package-progress'), goal = meterFull ? 1 : meterTarget;
        el.value += (goal - el.value) * .25;
        if (Math.abs(goal - el.value) < .002 || now - meterStarted >= 180) {
          el.value = goal; meterShown = meterAmount; $('package-number').textContent = `${format(meterShown)} / ${format(meterNeed)}`;
          if (meterFull) { meterFull = false; meterStarted = now; el.classList.add('meter-full'); meterRaf = 0; later(() => { el.classList.remove('meter-full'); el.value = 0; meterStarted = performance.now(); meterRaf = requestAnimationFrame(frame); }, 200); return; }
          meterRaf = 0; return;
        }
        meterRaf = requestAnimationFrame(frame);
      }
      meterRaf = requestAnimationFrame(frame);
    }
    // 依場景敵人切換舞台上的包裝元件：三連包用 #triple（三個子包熱區），輸送帶顯示帶面與警示燈，夜市開放禮包熱區
    function layout(s) {
      const kind = enemyOf(s), boss = !!s.boss || bossBusy;
      $('stage').dataset.enemy = kind;
      $('bag').hidden = kind === 'triple'; $('triple').hidden = kind !== 'triple';
      $('belt').hidden = kind !== 'timer' || boss;
      document.querySelectorAll('.sub-hot').forEach(el => { el.hidden = kind !== 'triple' || boss; });
      if (kind !== 'gift') { for (const id of ['gift-clip','gift-bag','gift-timer','gift-hot']) $(id).hidden = true; giftKey = null; giftLanded = false; }
      if (kind !== 'timer') { $('bag').classList.remove('shiver'); lastMissed = null; }
    }
    function render(s, { instant = false, completed = 0, manual = false, heavy = false } = {}) {
      latestState = s; if (frozen) return; setPartners(s); renderDeco(s);
      renderBoss(s,instant); rings(s); layout(s);
      document.querySelector('.package-meter').hidden=!!s.boss || bossBusy;
      renderGift(s, instant); renderThief(s, instant);
      if (s.boss || bossBusy) { updateParasite(s,instant); return; }
      if (!running && !instant) { lastPackage = s.package.index; return; }
      const need = E.requirement(s.package.index, s.settings.scene);
      const chest = !s.boss && E.isChest(s, s.package.index);   // v3 寶箱包：金色包裝（先用 CSS 濾鏡佔位）
      $('package-label').textContent = `${format(s.package.index)} 包`;
      $('bag').classList.toggle('chest', chest); $('triple').classList.toggle('chest', chest);
      meterAmount = s.package.progress; meterNeed = need;
      meter(s.package.progress / need, s.package.index > lastPackage, instant);
      if (E.tripleFor(s.settings.scene)) { renderTriple(s, { instant, completed, manual, heavy }); lastPackage = s.package.index; updateParasite(s, instant); return; }
      const timer = E.timerFor(s.settings.scene), next = stateOf(s), crossed = next !== bagState;
      if (timer) { if (lastMissed === null || instant) lastMissed = s.missed; else if (s.missed > lastMissed) { lastMissed = s.missed; missPackage(); } }
      if (s.package.index > lastPackage && !instant) {
        $('package-result').textContent = `完成 ${completed || s.package.index - lastPackage} 包`;
        if (!bagBusy) {
          bagBusy = true; showBag(4); burst(6); impact(); $('bag').classList.remove('shiver');
          motion($('package-result'), [{opacity:0,transform:'translateY(8px) scale(.7)'},{opacity:1,transform:'translateY(-12px) scale(1)',offset:.35},{opacity:0,transform:'translateY(-28px) scale(1)'}],700);
          later(() => motion($('bag'), [{opacity:1},{opacity:0}],100,()=>{
            showBag(stateOf(latestState)); beltEnter();
          }),180);
        }
        if (!manual) burst(4);
      } else if (!bagBusy) { showBag(next); if (crossed && !instant) { if (!heavy) bounce(false); if (!manual) burst(4); } }
      lastPackage = s.package.index; updateParasite(s, instant);
    }
    // 輸送帶：新包從右滑入 600ms（translateX 240→0）；一般場景維持原本的向上淡入
    function beltEnter() {
      const timer = E.timerFor(latestState.settings.scene);
      const frames = timer ? [{transform:'translateX(240px)',opacity:1},{transform:'translateX(0)',opacity:1}] : [{transform:'translateY(10px)',opacity:0},{transform:'translateY(0)',opacity:1}];
      motion($('bag'), frames, timer ? 600 : 140, ()=>{bagBusy=false; showBag(stateOf(latestState));});
    }
    // 漏掉：包裝從左滑出 400ms＋「漏了！」灰浮字＋低音；下一包立刻從右滑入
    function missPackage() {
      if (bagBusy) { later(missPackage, 60); return; }
      bagBusy = true; sound('miss'); $('bag').classList.remove('shiver');
      float(0, false, { x: 485, y: 250 }, { text: '漏了！' });
      motion($('bag'), [{transform:'translateX(0)',opacity:1},{transform:'translateX(-260px)',opacity:0}], 400, () => { showBag(stateOf(latestState)); beltEnter(); }, 'ease-in');
    }
    function beltClock(dt) {
      const s = latestState, timer = s ? E.timerFor(s.settings.scene) : 0;
      if (!timer || $('belt').hidden) return;
      beltTime += dt; $('belt-track').style.backgroundPositionX = `${-((beltTime * 40) % 233).toFixed(1)}px`;
      const deadline = s.package.deadline; if (deadline == null || s.boss) return;
      const left = Math.max(0, (deadline - Math.max(Date.now(), s.settledAt)) / 1000), warn = left <= 5;
      $('belt-timer').textContent = `${Math.ceil(left)}s`; $('belt-timer').classList.toggle('warn', warn);
      $('belt-lamp').classList.toggle('warn', warn); $('bag').classList.toggle('shiver', warn && !bagBusy && left > 0);
      if (warn && !beltWarned) { beltWarned = true; sound('boss-heart'); } if (!warn) beltWarned = false;
      // 到期那刻主動請宿主結算一次，漏包演出不用等 1Hz 的下一拍
      if (left === 0 && beltTicked !== deadline) { beltTicked = deadline; tick?.(); }
    }
    // 三連包：子包各自五狀態；拆完的先爆開（單包演出的 60%）並留在原地變撕開狀態，三個都完成才整組滑出換新組
    const subStateOf = (progress, need) => progress >= need - need*1e-9 ? 4 : (r => r > .75 ? 0 : r > .5 ? 1 : r > .25 ? 2 : 3)(Math.max(0, 1 - progress/need));
    function showSub(i, state) {
      const img = document.querySelector(`.sub-pack[data-sub="${i}"]`), src = `clicker-pack3-${state}.png`;
      if (img.getAttribute('src') !== src) { img.style.visibility = ''; img.src = src; }
      img.alt = `${['第一','第二','第三'][i]}包：${['完整','輕損','中損','重損','撕開'][state]}`;
      subStates[i] = state;
    }
    function popSub(i) {
      showSub(i, 4); const point = SUB_CENTER(i);
      burst(4, false, false, point); impact(point, .6);
      motion(document.querySelector(`.sub-pack[data-sub="${i}"]`), [{transform:'scale(1)'},{transform:'scale(1.12)',offset:.4},{transform:'scale(1)'}], 160);
    }
    function renderTriple(s, { instant, completed, manual, heavy }) {
      const need = E.subNeed(s.package.index, s.settings.scene), states = s.package.sub.map(x => subStateOf(x.progress, need));
      if (instant) { states.forEach((st, i) => showSub(i, st)); return; }
      if (s.package.index > lastPackage) {
        $('package-result').textContent = `完成 ${completed || s.package.index - lastPackage} 包`;
        if (!tripleBusy) {
          tripleBusy = true;
          for (let i = 0; i < 3; i++) if (subStates[i] !== 4) popSub(i);
          motion($('package-result'), [{opacity:0,transform:'translateY(8px) scale(.7)'},{opacity:1,transform:'translateY(-12px) scale(1)',offset:.35},{opacity:0,transform:'translateY(-28px) scale(1)'}],700);
          later(() => motion($('triple'), [{transform:'translateX(0)',opacity:1},{transform:'translateX(-140px)',opacity:0}], 160, () => {
            const fresh = latestState.package.sub.map(x => subStateOf(x.progress, E.subNeed(latestState.package.index, latestState.settings.scene)));
            fresh.forEach((st, i) => showSub(i, st));
            motion($('triple'), [{transform:'translateY(12px)',opacity:0},{transform:'translateY(0)',opacity:1}], 140, () => { tripleBusy = false; renderTriple(latestState, { instant:true }); });
          }, 'ease-in'), 200);
        }
        if (!manual) burst(4);
        return;
      }
      if (tripleBusy) return;
      states.forEach((st, i) => {
        if (st === subStates[i]) return;
        if (st === 4) popSub(i);
        else { showSub(i, st); if (!heavy) subBounce(i, false); if (!manual) burst(3, false, false, SUB_CENTER(i)); }
      });
    }
    // 夜市限時大禮包：老闆從攤位後升起 300ms → 拋物線 500ms 丟到桌左 → 落地 scale(1.1,.9) 90ms＋4px 震＋upgrade 音
    function renderGift(s, instant) {
      const cfg = E.giftFor(s.settings.scene); if (!cfg) return;
      const key = s.gift ? String(s.gift.endsAt) : null, rk = s.giftResult ? String(s.giftResult.at) : null;
      if (key && key !== giftKey) {
        giftKey = key; giftLanded = false; giftResultKey = rk;
        $('gift-clip').hidden = false; $('gift-bag').hidden = true; $('gift-timer').hidden = true; $('gift-hot').hidden = true;
        if (instant || !running) { $('gift-boss').style.transform = ''; giftLand(true); return; }
        motion($('gift-boss'), [{transform:'translateY(80px)'},{transform:'translateY(0)'}], 300, () => {
          if (giftKey !== key) return;
          $('gift-bag').hidden = false;
          // 從老闆手上（約 518,70）拋到桌左（80,177）：線性內插加上 300·u(1−u) 的拋物線抬升，頂點約在 y 50
          const arc = [0, .2, .4, .6, .8, 1].map(u => ({ transform:`translate(${(438*(1-u)).toFixed(1)}px,${(-107*(1-u) - 300*u*(1-u)).toFixed(1)}px) scale(${(.55 + .45*u).toFixed(2)})`, offset:u }));
          motion($('gift-bag'), arc, 500, () => { if (giftKey === key) giftLand(false); }, 'linear');
        });
        return;
      }
      if (!s.gift && giftKey && rk !== giftResultKey && !instant) {
        giftKey = null; giftResultKey = rk; giftLanded = false;
        $('gift-hot').hidden = true; $('gift-timer').hidden = true;
        const r = s.giftResult;
        if (r.won) {
          sound('gift-win'); shake(4, 120); float(r.bonus, true, GIFT_POINT); impact(GIFT_POINT);
          for (let i = 0; i < 30; i++) fx?.spawn({ sprite:8, x:GIFT_POINT.x + (Math.random()-.5)*40, y:GIFT_POINT.y - 20, vx:(Math.random()-.5)*360, vy:-160 - Math.random()*300, g:420, r:8 + Math.random()*6, life:.9 + Math.random()*.6, rot:Math.random()*6, vr:(Math.random()-.5)*12, drag:.985, color:RIBBON[i % RIBBON.length], blend:'source-over', fadeK:3 });
          motion($('gift-bag'), [{transform:'scale(1)',opacity:1},{transform:'scale(1.25)',opacity:0}], 200, () => { $('gift-bag').hidden = true; });
          motion($('gift-boss'), [{transform:'translateY(0)'},{transform:'translateY(-10px)',offset:.3},{transform:'translateY(0)',offset:.6},{transform:'translateY(80px)'}], 500, () => { $('gift-clip').hidden = true; });
          notice(`限時大禮包拆完！×${cfg.mul}，+${format(r.bonus)}`);
        } else {
          motion($('gift-bag'), [{transform:'scale(1)',opacity:1},{transform:'scale(0)',opacity:0}], 300, () => { $('gift-bag').hidden = true; }, 'ease-in');
          motion($('gift-boss'), [{transform:'translateY(0)'},{transform:'translateY(80px)'}], 300, () => { $('gift-clip').hidden = true; }, 'ease-in');
        }
      } else if (instant || !s.gift) { giftResultKey = rk; if (!s.gift) { giftKey = null; for (const id of ['gift-clip','gift-bag','gift-timer','gift-hot']) $(id).hidden = true; } }
    }
    function giftLand(instant) {
      giftLanded = true; $('gift-bag').hidden = false; $('gift-bag').style.transform = '';
      $('gift-timer').hidden = false; $('gift-hot').hidden = false; giftClock();
      if (instant) return;
      motion($('gift-bag'), [{transform:'scale(1.1,.9)'},{transform:'scale(1)'}], 90);
      shake(4, 100); sound('upgrade'); burst(6, false, false, { x: GIFT_POINT.x, y: GIFT_POINT.y + 55 }, true);
    }
    function giftClock() {
      const s = latestState, cfg = s ? E.giftFor(s.settings.scene) : null;
      if (!cfg || !s.gift || $('gift-timer').hidden) return;
      const left = Math.max(0, (s.gift.endsAt - Math.max(Date.now(), s.settledAt)) / 1000);
      $('gift-timer').firstElementChild.style.transform = `scaleX(${left / cfg.seconds})`;
      $('gift-timer').classList.toggle('urgent', left <= 5); $('gift-timer').lastElementChild.textContent = `${Math.ceil(left)} 秒`;
    }
    function impact(point = IMPACT, k = 1) {
      if (reduced.matches) return;
      const el = document.createElement('img'); el.src = 'clicker-fx-impact-burst.png'; el.className = 'small-impact'; el.style.left = `${point.x - 65}px`; el.style.top = `${point.y - 65}px`; $('floaters').append(el);
      motion(el,[{transform:`scale(${.2*k})`,opacity:1},{transform:`scale(${.5*k})`,opacity:1,offset:.6},{transform:`scale(${.6*k})`,opacity:0}],150,()=>el.remove());
    }
    function shake(px,ms) {
      $('stage').style.setProperty('--boss-shake',`${px}px`);
      $('stage').classList.remove('boss-shake'); void $('stage').offsetWidth;
      $('stage').style.setProperty('--boss-shake-time',`${ms}ms`); $('stage').classList.add('boss-shake');
      later(()=>$('stage').classList.remove('boss-shake'),ms);
    }
    function rings(s) {
      const p=s.boss || s.package, el=$(s.boss?'boss-shells':'shell-rings');
      $('shell-rings').hidden=!!s.boss;
      const count=p.shells?.length || 0;
      const key=`${count}:${(p.shells||[]).join(',')}:${s.boss?'boss':'bag'}`;
      if (el.dataset.key!==key) {
        el.dataset.key=key; el.replaceChildren();
        for(let i=0;i<count;i++) {const img=document.createElement('img');img.src='clicker-can-shell.png';img.alt='硬殼';
          if (s.boss) {
            // 王包：環圖畫布（319×512）與大罐頭（531×600）不同，不能整張疊。環的高度固定為王高的一半（環帶約 34px），
            // 中心對齊大罐頭圖上自己的兩道金屬帶（31.7%／67.5%）與底緣（90%），依 shell 值 .75／.5／.25 由上到下
            const cfg=window.ClickerScene.resolve(s.boss.scene).boss, h=cfg.size?.[1] || 300, f={.75:.317,.5:.675,.25:.9}[p.shells[i]] ?? (.317+i*.29);
            img.style.cssText=`left:0;width:100%;height:${h*.5}px;top:${(f-.2675)*h}px;object-fit:fill`;
          } else img.style.transform=`translateY(${Math.round((.5-p.shells[i])*80)}%)`;   // 一般罐頭：同畫布整張疊，.75→−20%、.5→0、.25→+20%
          img.onerror=()=>{img.style.visibility='hidden';};el.append(img);}
      }
      el.classList.toggle('blocked',p.blocked>0); el.dataset.hp=p.shellHp ?? 3;
      // 被硬殼擋住時給一句說明：玩家看到「罐頭自己破掉噴錢」其實是被擋住的被動收益在敲開時一次釋放
      let hint=$('shell-hint'); if (!hint) { hint=document.createElement('b'); hint.id='shell-hint'; hint.textContent='硬殼！點 3 下敲開'; $('bag').append(hint); }
      hint.hidden=!(p.blocked>0 && !s.boss);
      shellTarget=el.firstElementChild;
    }
    function shell(result) {
      if(!result.shellHit || !running) return;
      sound('shell');
      const el=result.shellBroken?struckRing?.el:shellTarget;
      if(el) {
        if(result.shellBroken) {el.className='shell-hit-overlay';struckRing.parent.append(el);}
        const base=el.style.transform || '';   // 罐頭環有 translateY 位移，動畫要疊在它上面
        motion(el,[{transform:`${base} scale(1)`},{transform:`${base} scale(1.06)`,offset:.4},{transform:`${base} scale(1)`,opacity:result.shellBroken?0:1}],120,()=>{if(result.shellBroken) el.remove();});
      }
      if(result.shellBroken) {
        for(let i=0;i<10;i++) fx?.spawn({sprite:14,x:IMPACT.x,y:IMPACT.y,vx:(Math.random()-.5)*340,vy:-100-Math.random()*230,g:520,r:10,life:.65,rot:Math.random()*6,vr:8,drag:.99,color:'#D9D9D9',blend:'lighter'});
        shake(4,120);
        if(result.released>0) {float(result.released,true,{x:340,y:IMPACT.y});burst(18,true);}
      }
    }
    function bossClock() {
      const b=latestState?.boss; if(!b || $('boss-timer').hidden) return;
      const left=Math.max(0,(b.endsAt-Math.max(Date.now(),latestState.settledAt))/1000), sec=Math.ceil(left);
      $('boss-timer').firstElementChild.style.transform=`scaleX(${left/((b.endsAt-b.startedAt)/1000)})`;
      $('boss-timer').classList.toggle('urgent',left<=10); $('boss-timer').lastElementChild.textContent=`${sec} 秒`;
      if(sec<=10 && sec>0 && heartbeat!==sec) {heartbeat=sec;motion($('boss-timer'),[{transform:'scale(1)'},{transform:'scale(1.03)',offset:.5},{transform:'scale(1)'}],200);sound('boss-heart');}
      const ratio=b.dealt/b.need, health=$('boss-health');health.firstElementChild.style.width=`${ratio*100}%`;
      health.firstElementChild.style.background=`color-mix(in srgb,#E9B94E ${100-ratio*100}%,#EF8E8E)`;
      const n=v=>v>=10000?`${(v/10000).toFixed(1)}萬`:format(v);
      health.lastElementChild.textContent=`${n(b.dealt)} / ${n(b.need)}`;
    }
    function cracks(value) {
      const el=$('boss-cracks');el.replaceChildren();
      const count=value>=.75?3:value>.5?2:value>0?1:0;
      for(let i=0;i<count;i++) {const img=document.createElement('img');img.src='clicker-boss-crack.png';img.alt='';img.onerror=()=>{img.hidden=true;};img.style.transform=`translateX(${i*25-20}px) rotate(${i*17}deg)`;el.append(img);}
    }
    function renderBoss(s,instant) {
      const key=s.boss?`${s.boss.scene}:${s.boss.startedAt}`:null;
      if(key && key!==bossKey) {
        bossKey=key;bossBusy=true;bossEntering=true;heartbeat=-1;cracks(s.boss.crack);
        // 王包本體依場景換圖與尺寸；三連包場景滑出的是整組子包
        let cfg=window.ClickerScene.resolve(s.boss.scene).boss; const pk=packEl(s);
        const bossImg=$('boss-image');
        if (cfg.sprite) {
          // 會動的怪：img 本身放一張透明像素，真正的圖交給 CSS 背景 + steps() 逐幀播
          bossImg.src='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
          bossImg.classList.add('sprite');
          bossImg.style.setProperty('--boss-sprite',`url('${cfg.sprite}')`);
          bossImg.style.setProperty('--boss-frames',cfg.frames || 4);
        } else {
          bossImg.classList.remove('sprite');
          bossImg.style.removeProperty('--boss-sprite'); bossImg.style.removeProperty('--boss-frames');
          bossImg.src=cfg.image || 'clicker-boss-can.png';
        }
        bossImg.alt=cfg.name || '大罐頭';
        // v3 小王：先用路障 SVG 當佔位（使用者 2026-09-13：先用簡單 SVG 排版面，之後優化），尺寸比大王小一號
        const gate=s.boss.gate!==undefined; $('boss-view').classList.toggle('gate',gate);
        if (gate) { bossImg.classList.remove('sprite'); bossImg.style.removeProperty('--boss-sprite'); bossImg.src='data:image/svg+xml;utf8,'+encodeURIComponent(GATE_SVG); bossImg.alt='路障小王'; }
        if (gate) cfg={...cfg,size:[220,200],center:cfg.center || 460};
        $('boss-view').style.setProperty('--boss-w',`${cfg.size?.[0] || 260}px`); $('boss-view').style.setProperty('--boss-h',`${cfg.size?.[1] || 300}px`); $('boss-view').style.setProperty('--boss-cx',`${cfg.center || 460}px`);
        $('boss-view').classList.toggle('full-board', (cfg.size?.[0] || 260) >= 600);
        $('boss-timer').hidden=false;$('boss-view').hidden=false;
        $('boss-view').style.visibility='hidden'; layout(s);
        motion(pk,[{transform:'translateX(0)'},{transform:'translateX(200px)'}],220,()=>{
          pk.style.visibility='hidden';$('boss-view').style.visibility='';
          motion($('boss-view'),[{transform:'translateY(-360px)'},{transform:'translateY(0)'}],300,()=>{
            motion($('boss-view'),[{transform:'scale(1.06,.94)'},{transform:'scale(1)'}],90,()=>{bossBusy=false;bossEntering=false;render(latestState);});
            shake(6,80);burst(24,true);sound('boss-enter');
          },'ease-in');
        },'ease-in');
      }
      bossClock();
      const rk=s.bossResult?JSON.stringify(s.bossResult):null;
      if(!s.boss && bossKey && rk && rk!==resultKey && !instant && !bossEntering) {
        bossKey=null;resultKey=rk;bossBusy=true;$('boss-timer').hidden=true;
        const r=s.bossResult;
        if(r.won) {
          motion($('boss-view'),[{transform:'scale(1)'},{transform:'scale(1.15)'}],120,()=>{
            $('boss-flash').hidden=false;later(()=>$('boss-flash').hidden=true,60);
            burst(48,false,false,IMPACT,true);
            for(let i=0;i<6;i++) fx?.spawn({sprite:3,x:IMPACT.x+(i-2.5)*22,y:IMPACT.y,r:40+i*8,life:.65,color:'#FFF6E6',blend:'lighter',update(p){p.r+=2;}});
            shake(8,160);sound('boss-win');$('boss-view').hidden=true;
          });
          later(()=>{
            // ⚠ 終點站沒有下一站，r.next 是 undefined。這裡本來寫死特判 'fridge'，
            // 第二十二輪把終點搬到第七站 city 之後，打贏 city 會在 ClickerScenes[undefined].name 丟例外，
            // 而這段是在 later() 裡跑的——例外一丟，後面的 bossBusy=false 就永遠不會執行，
            // 於是「換桌布／場景」鍵一直是 disabled，要重整才會好（2026-09-08 使用者回報）。
            // 改成看 r.next 有沒有解得開，不要再認場景名字。
            const nextScene = r.next && window.ClickerScenes[r.next];
            const banner=$('boss-banner');
            // v3：路障打通與大王都給一次性獎金（C 路），橫幅直接寫金額——「錢就是為了這一刻」
            banner.textContent=r.gate!==undefined ? `路障打通！＋${format(r.bonus||0)}` : nextScene ? `${nextScene.name} 解鎖！＋${format(r.bonus||0)}` : '全站破關！珍母的零食櫃清空了';banner.classList.toggle('final-win',!nextScene && r.gate===undefined);banner.hidden=false;
            motion(banner,[{transform:'scale(.8)'},{transform:'scale(1)'}],200);
            // v3：小王每 10 包一隻，勝利橫幅縮短（停 700ms），免得強一點的玩家每幾秒被鎖一次招募
            later(()=>motion(banner,[{transform:'translateX(0)',opacity:1},{transform:'translateX(-600px)',opacity:0}],220,()=>{
              banner.hidden=true;
              window.ClickerScene.mount(latestState.settings.scene);$('bag').style.visibility='';$('triple').style.visibility='';bossBusy=false;lastPackage=latestState.package.index;render(latestState,{instant:true});
            }),r.gate!==undefined ? 700 : 1800);
          },r.gate!==undefined ? 300 : 800);
        } else {
          cracks(r.crack);
          motion($('boss-view'),Array.from({length:7},(_,i)=>({transform:`rotate(${i===6?0:i%2?4:-4}deg)`})),480,()=>{
            motion($('boss-view'),[{transform:'translateY(0)',opacity:1},{transform:'translateY(-80px)',opacity:0}],400,()=>{
              const pk=packEl(latestState); $('boss-view').hidden=true;pk.style.visibility='';
              motion(pk,[{transform:'translateX(200px)'},{transform:'translateX(0)'}],220,()=>{bossBusy=false;render(latestState);});
            });
          });
          notice(r.gate!==undefined ? '小王守住了。30 秒冷卻後，準備好再點「挑戰」' : `差一點！裂痕 ${Math.round(r.crack*100)}%，30 秒後再來`);
        }
      } else if(instant && !s.boss) {resultKey=rk;if(window.ClickerScene.current!==window.ClickerScene.resolve(s.settings.scene)) window.ClickerScene.mount(s.settings.scene);}
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
    function mythicSkill(effect) {
      if (!running || frozen || reduced.matches || window.GachaPool.byId[effect.source]?.rarity !== 'mythic') return;
      const stage = $('stage');
      if (effect.source === 'mieshi') {
        // 舞台座標 (430,150) 朝 (120,330)，同層後插入可蓋住整版王圖，仍低於技能槽。
        const layer = document.createElement('div'); layer.className = 'mythic-fx mythic-beam-layer'; layer.setAttribute('aria-hidden', 'true');
        const beam = document.createElement('div'); beam.className = 'mythic-beam';
        const flash = document.createElement('div'); flash.className = 'mythic-flash';
        layer.append(flash, beam); stage.append(layer);
        motion(flash, [{opacity:0},{opacity:.72,offset:.24},{opacity:0}], 320, () => flash.remove());
        motion(beam, [
          {transform:'rotate(150deg) scale(.04,.12)',opacity:0},
          {transform:'rotate(150deg) scale(.72,.45)',opacity:1,offset:.16},
          {transform:'rotate(150deg) scale(1,1)',opacity:1,offset:.38},
          {transform:'rotate(150deg) scale(1,1.35)',opacity:.9,offset:.62},
          {transform:'rotate(150deg) scale(1.05,0)',opacity:0}
        ], 840, () => layer.remove(), 'linear');
        shake(5, 240);
      } else if (effect.source === 'qinghua') {
        const slot = latestState?.skillSlots.indexOf(effect.source) ?? -1;
        const head = $('slots').children[slot]?.querySelector('.skill-use');
        if (!head) return;
        const rect = head.getBoundingClientRect(), box = stage.getBoundingClientRect();
        const bloom = document.createElement('div'); bloom.className = 'mythic-fx mythic-bloom'; bloom.setAttribute('aria-hidden', 'true');
        bloom.style.left = `${(rect.left + rect.width / 2 - box.left) * stage.offsetWidth / box.width}px`;
        bloom.style.top = `${(rect.top + rect.height / 2 - box.top) * stage.offsetHeight / box.height}px`;
        for (let i = 0; i < 12; i++) {
          const petal = document.createElement('i'); petal.className = 'mythic-petal';
          petal.style.transform = `rotate(${i * 30}deg) translateY(-48px)`; bloom.append(petal);
        }
        stage.append(bloom);
        motion(bloom, [
          {transform:'translate(-50%,-50%) scale(.2) rotate(-15deg)',opacity:0},
          {transform:'translate(-50%,-50%) scale(.65) rotate(-6deg)',opacity:1,offset:.24},
          {transform:'translate(-50%,-50%) scale(1) rotate(0deg)',opacity:.85,offset:.58},
          {transform:'translate(-50%,-50%) scale(1.3) rotate(8deg)',opacity:0}
        ], 680, () => bloom.remove(), 'linear');
      } else if (effect.source === 'yueyuexian' || effect.source === 'wanwumythic') {
        // 這兩張是增益技，比照青花從技能鈕長出來；不用滅世那種鋪滿全版的做法（那是打王專用）
        const slot = latestState?.skillSlots.indexOf(effect.source) ?? -1;
        const head = $('slots').children[slot]?.querySelector('.skill-use');
        if (!head) return;
        const rect = head.getBoundingClientRect(), box = stage.getBoundingClientRect();
        const at = (el) => {
          el.style.left = `${(rect.left + rect.width / 2 - box.left) * stage.offsetWidth / box.width}px`;
          el.style.top = `${(rect.top + rect.height / 2 - box.top) * stage.offsetHeight / box.height}px`;
        };
        if (effect.source === 'yueyuexian') {
          // 躺著也會贏：往外擴散的懶漣漪＋飄走的 Z，暖橘金（跟青花的藍、滅世的白金分開）
          for (let i = 0; i < 3; i++) {
            const ring = document.createElement('div'); ring.className = 'mythic-fx mythic-ripple';
            ring.setAttribute('aria-hidden', 'true'); at(ring); stage.append(ring);
            motion(ring, [
              {transform:'translate(-50%,-50%) scale(.25)',opacity:0},
              {transform:'translate(-50%,-50%) scale(.9)',opacity:.85,offset:.35},
              {transform:'translate(-50%,-50%) scale(1.6)',opacity:.5,offset:.7},
              {transform:'translate(-50%,-50%) scale(2.4)',opacity:0}
            ], 900 + i * 140, () => ring.remove(), 'linear');
          }
          for (let i = 0; i < 4; i++) {
            const z = document.createElement('i'); z.className = 'mythic-fx mythic-zzz';
            z.textContent = 'Z'; z.setAttribute('aria-hidden', 'true'); at(z); stage.append(z);
            const tilt = i % 2 ? 12 : -12;
            motion(z, [
              {transform:`translate(-50%,-50%) translate(0,0) scale(.6) rotate(0deg)`,opacity:0},
              {transform:`translate(-50%,-50%) translate(24px,-26px) scale(1) rotate(${tilt}deg)`,opacity:1,offset:.35},
              {transform:`translate(-50%,-50%) translate(60px,-64px) scale(1.1) rotate(${tilt}deg)`,opacity:0}
            ], 1000 + i * 160, () => z.remove(), 'linear');
          }
        } else {
          // 捧在手心：往上托起的柔光＋六顆愛心
          const cradle = document.createElement('div'); cradle.className = 'mythic-fx mythic-cradle';
          cradle.setAttribute('aria-hidden', 'true'); at(cradle); stage.append(cradle);
          motion(cradle, [
            {transform:'translate(-50%,-50%) translateY(0) scale(.4)',opacity:0},
            {transform:'translate(-50%,-50%) translateY(-18px) scale(.95)',opacity:1,offset:.4},
            {transform:'translate(-50%,-50%) translateY(-38px) scale(1.15)',opacity:0}
          ], 700, () => cradle.remove(), 'linear');
          for (let i = 0; i < 6; i++) {
            const heart = document.createElement('i'); heart.className = 'mythic-fx mythic-heart';
            heart.setAttribute('aria-hidden', 'true'); at(heart); stage.append(heart);
            const a = i * 60 * Math.PI / 180, r0 = 42, r1 = 62;
            motion(heart, [
              {transform:`translate(-50%,-50%) translate(${Math.sin(a)*r0*.4}px,${-Math.cos(a)*r0*.4}px) scale(.5)`,opacity:0},
              {transform:`translate(-50%,-50%) translate(${Math.sin(a)*r0}px,${-Math.cos(a)*r0}px) scale(1)`,opacity:1,offset:.45},
              {transform:`translate(-50%,-50%) translate(${Math.sin(a)*r1}px,${-Math.cos(a)*r1}px) scale(.7)`,opacity:0}
            ], 900 + i * 60, () => heart.remove(), 'linear');
          }
        }
      }
    }
    function skill(effect) {
      // bossDamage 跟 burst 一樣是瞬發傷害，先共用同一組浮字／衝擊／粒子當底；
      // 神話的專屬演出（滅世光線）疊在這之上，見 mythicSkill()。
      if (effect.kind === 'burst' || effect.kind === 'bossDamage') { float(effect.value, true, IMPACT); impact(); burst(12, false, false, IMPACT, true); }
      mythicSkill(effect);
      const label = $('effect-label'); label.hidden = false;
      label.textContent = window.ClickerBalance.characters[effect.source].skill;
      motion(label,[{transform:'translateY(8px) scale(.8)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],180);
      later(()=>{ label.hidden = true; },1800);
      if (effect.source === 'zhenmu') {
        const label = $('parasite-label');
        motion(label,[{transform:'translateY(-20px) scale(1.3)',opacity:0},{transform:'translateY(0) scale(1)',opacity:1}],300,()=>impact({x:label.offsetLeft+label.offsetWidth/2,y:label.offsetTop+label.offsetHeight/2}));
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
          const target = document.querySelector(`.buddy[data-id="${e.id}"] .buddy-portrait`);
          if (!target) return;   // 這一批的分頁上找不到這個角色就跳過，不要整段演出被例外打斷
          // 直式的夥伴列是一條左右滑的，目標常常滑在畫面外——頭貼就會飛去畫面外面降落。
          // 先把它捲進來再量位置。橫式的夥伴列是固定的十宮格，這行是 no-op。
          target.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
          // 落點與 clicker-gacha.js collect() 的起飛點用同一套映射：換算到 #join-flight 自己的
          // 座標系。橫式它是 #game 的 960×640（zoom 就是整體縮放），直式它蓋滿畫面、座標＝畫面像素。
          const jf = $('join-flight'), jr = jf.getBoundingClientRect(), rect = target.getBoundingClientRect();
          const zoom = jf.clientWidth ? jr.width / jf.clientWidth : 1;
          const from = e.origin || {x:jf.clientWidth/2,y:jf.clientHeight*.15}, to = {x:(rect.left+rect.width/2-jr.left)/zoom,y:(rect.top+rect.height/2-jr.top)/zoom};
          const el = document.createElement('div'); el.className = 'joining-portrait'; el.append(card.art.create(window.GachaPool.byId[e.id])); $('join-flight').append(el);
          motion(el,[{transform:`translate(${from.x-32}px,${from.y-32}px) scale(1)`},{transform:`translate(${(from.x+to.x)/2-32}px,${(from.y+to.y)/2-68}px) scale(.8)`,offset:.5},{transform:`translate(${to.x-32}px,${to.y-32}px) scale(.625)`}],380,()=>{el.remove(); motion(target,[{transform:'scale(1)'},{transform:'scale(1.08)',offset:.5},{transform:'scale(1)'}],140); notice(`${window.GachaPool.byId[e.id].name} 已入隊・★${E.stars(s.collection[e.id])}`);});
        },i*70));
        later(()=>group(index+1),items.length*70+520);
      }
      group(0);
    }
    // 電動手指：小機械手指站在珍母右肩，每秒依等級戳幾下（120ms 戳、粒子是手點的一半、不播音）
    let fingerEl = null;
    function autoClick(amount, heavy, s, completed, n) {
      if (frozen || !running) { latestState = s; return; }
      if (!fingerEl) { fingerEl = document.createElement('img'); fingerEl.id = 'auto-finger'; fingerEl.src = 'clicker-icon-hand.png'; fingerEl.alt = ''; $('hero-position').append(fingerEl); }
      render(s, { completed });
      motion(fingerEl, [{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg) translateY(6px)', offset: .4 }, { transform: 'rotate(0)' }], 120);
      pressAt = performance.now(); pressAmount = .06;
      burst(4, heavy, false, { x: IMPACT.x, y: IMPACT.y });
      float(amount, heavy, { x: IMPACT.x - 40, y: IMPACT.y - 10 });
    }
    function renderDeco(s) {
      let layer = $('deco-layer'); if (!layer) { layer = document.createElement('div'); layer.id = 'deco-layer'; $('hero-light').before(layer); }
      const key = JSON.stringify([s.decoShown || [], s.settings.scene]); if (layer.dataset.key === key) return; layer.dataset.key = key; layer.replaceChildren();
      const slots = window.ClickerScene.current?.decoSlots || [[352, 310], [150, 54], [42, 310], [452, 56], [578, 302], [106, 310], [170, 310], [470, 112], [234, 310], [298, 310]];
      // 只畫玩家選擇要擺出來的（s.decoShown），位置仍照它在 B.decor 的編號固定，換順序不會跑位
      (s.decoShown || []).forEach((id, i) => { const at = window.ClickerBalance.decor.findIndex(d => d.id === id); const item = at < 0 ? null : window.ClickerBalance.decor[at]; if (!item) return; const [x, y] = slots[at % slots.length]; const img = document.createElement('img'); img.src = item.file; img.alt = ''; img.className = 'deco'; img.style.left = `${x}px`; img.style.top = `${y}px`; img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'deco deco-fallback', textContent: item.name, style: `left:${x}px;top:${y}px` })); }; layer.append(img); });
    }
    // 更衣室試用：在珍母旁噴一次該特效；覺醒：整個舞台撒金粒子
    function preview(fxId) { if (!running) return; burst(10, false, true, IMPACT, false, fxId); }
    function confetti() {
      if (!fx) return; const rand = (a,b) => a + Math.random() * (b-a);
      for (let i = 0; i < 24; i++) fx.spawn({ sprite:14, x:rand(40,570), y:rand(30,120), vx:rand(-30,30), vy:rand(20,60), g:40, r:rand(5,9), life:rand(.9,1.4), color:'#E9B94E', blend:'lighter', shrink:true });
    }
    // 第十二輪 extras（每日一包、徽章、碎冰）借用舞台的粒子、浮字與震動
    const spawn = p => fx?.spawn(p);
    return { start, stop, click, render, skill, join, setPartners, freeze, preview, confetti, autoClick, shell, spawn, float, floatPassive, rateStamp, shake, motion, get running() { return running; }, get bossBusy() {return bossBusy;}, get frozen() { return frozen; } };
  }
  return { create };
})();
