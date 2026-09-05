window.Clicker = (() => {
  const $ = (id) => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, Pool = window.GachaPool;
  const TAURI = window.__TAURI__;
  const format = (n) => n >= 1e9 ? n.toExponential(2) : n.toLocaleString('zh-TW', { maximumFractionDigits: 1 });
  const store = window.ClickerSave.create({ getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) }, { pool: Pool });
  let stage, gacha, ready = false, tickTimer = 0, saveTimer = 0, numberTimer = 0, noticeTimer = 0;
  let audio = null, lastNumbers = -Infinity, inputTimes = [], slotsKey = '', suspended = false;
  const audioScopes = new Set(), createScope = window.GachaAudio.createScope;
  // 每個 scope 的出口統一跟隨遊戲靜音；不改共用音效積木、不建立第二個 context。
  window.GachaAudio.createScope = () => {
    const scope = createScope(); audioScopes.add(scope);
    if (scope.dry) scope.dry.gain.value = store.state?.settings.muted ? 0 : 1;
    const stop = scope.stop;
    scope.stop = (ms) => { audioScopes.delete(scope); stop(ms); };
    return scope;
  };
  const sounds = { click: [160, 95, .055, .05], upgrade: [520, 780, .12, .09], skill: [110, 70, .14, .12] };
  function sound(name) {
    if (document.hidden || store.state.settings.muted) return;
    window.GachaAudio.ensure(); audio ||= window.GachaAudio.createScope();
    const [from, to, duration, gain] = sounds[name];
    audio.tone(from, { slide: to, slideT: duration, a: .002, d: duration - .004, r: .002, gain });
  }
  function muteAudio() {
    for (const scope of audioScopes) if (scope.dry) scope.dry.gain.value = store.state.settings.muted ? 0 : 1;
    const ac = window.GachaAudio.ensure(); if (!ac) return;
    if (store.state.settings.muted || document.hidden) ac.suspend().catch(() => {});
    else ac.resume().catch(() => {});
  }
  function notice(text) {
    $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer);
    if (!document.hidden) noticeTimer = setTimeout(() => { $('notice').hidden = true; noticeTimer = 0; }, 1400);
  }
  function status() {
    $('save-status').textContent = store.blocked ? '尚未儲存' : '已儲存';
    $('retry-save').hidden = !store.blocked || !store.state;
    $('tap').disabled = !ready || store.blocked;
    if (store.blocked && store.state && !document.hidden) notice(`尚未儲存：${store.error?.message || '寫入失敗'}。消費已鎖住。`);
  }
  function commit(next = store.state) {
    const ok = store.commit(next); status(); if (!ok) { gacha?.render(); renderSlots(); } return ok;
  }
  function settle() {
    if (store.blocked || !store.state) return;
    const result = E.settle(store.state, Date.now()); store.stage(result.state);
    stage?.render(result.state, { completed: result.completed });
  }
  function numbers(force = false) {
    if (!store.state || document.hidden) return;
    const time = performance.now(), delay = 100 - (time - lastNumbers);
    if (!force && delay > 0) {
      if (!numberTimer) numberTimer = setTimeout(() => { numberTimer = 0; numbers(); }, delay);
      return;
    }
    lastNumbers = time;
    const s = store.state, { D, P } = E.rates(s);
    $('coins').textContent = format(Math.floor(s.coins)); $('click-rate').textContent = `每次 ${format(D)}`; $('passive-rate').textContent = `每秒 ${format(P)}`;
    $('tutorial-progress').textContent = `${Math.min(50, s.manualClicks)} / 50`;
    $('tutorial').hidden = s.claimedMilestones.includes('tutorial50');
    for (const type of ['click', 'training']) {
      const field = type === 'click' ? 'clickLevel' : 'trainingLevel', cost = (type === 'click' ? E.clickCost : E.trainingCost)(s[field]);
      const next = { ...s, [field]: s[field] + 1 }, after = E.rates(next);
      $(`${type}-level`).textContent = `Lv.${s[field]}`;
      $(`${type}-next`).textContent = type === 'click' ? `每次 ${format(D)} → ${format(after.D)}` : `每秒 ${format(P)} → ${format(after.P)}`;
      const missing = Math.max(0, Math.ceil(cost - s.coins));
      const buy = $(`${type}-one`); buy.textContent = `1 級 · ${format(cost)}`;
      if (missing) { const note = document.createElement('small'); note.textContent = `還差 ${format(missing)}`; buy.append(note); }
      $(`${type}-one`).disabled = $(`${type}-max`).disabled = store.blocked || cost > s.coins || !Number.isFinite(cost);
    }
    $('completed').textContent = `已拆 ${s.package.index - 1} 包`;
    $('owned-count').textContent = `${Object.keys(s.collection).length} / 12`;
    const nextSlot = B.slotThresholds[E.slotCount(s)];
    $('next-goal').textContent = s.manualClicks < 50 ? '下一目標：50 點迎接玥玥' : nextSlot ? `累計 ${format(nextSlot)} 幣開下一技能槽` : '三個技能槽全部開放';
    $('mute').textContent = s.settings.muted ? '音效關' : '音效開'; $('mute').setAttribute('aria-pressed', String(s.settings.muted));
    gacha?.render();
  }
  function renderSlots() {
    if (!store.state) return;
    const s = store.state, key = JSON.stringify([s.collection, s.skillSlots, E.slotCount(s)]);
    if (slotsKey !== key) {
      slotsKey = key; $('slots').replaceChildren();
      for (let i = 0; i < 3; i++) {
        const el = document.createElement('article'); el.className = 'skill-slot';
        const select = document.createElement('button'); select.className = 'slot-pick'; select.setAttribute('aria-label', `第 ${i + 1} 技能槽角色`);
        const id = s.skillSlots[i];
        if (id) select.append(card.art.create(Pool.byId[id]));
        const name = document.createElement('span'); name.textContent = id ? Pool.byId[id].name : i < E.slotCount(s) ? '選擇夥伴' : '尚未解鎖'; select.append(name); select.title = name.textContent;
        select.onclick = () => showRoster(id, i);
        const button = document.createElement('button'); button.className = 'skill-use'; button.onclick = () => activate(i);
        const detail = document.createElement('small'); el.append(select, button, detail); $('slots').append(el);
      }
    }
    [...$('slots').children].forEach((el, i) => {
      const id = s.skillSlots[i], def = B.characters[id], t = Math.max(Date.now(), s.settledAt);
      const remaining = Math.max(0, Math.ceil((Math.max(s.cooldownUntil[id] || 0, s.slotReadyAt[i]) - t) / 1000));
      const effect = s.effects.find((e) => e.source === id);
      const button = el.querySelector('.skill-use'), select = el.querySelector('.slot-pick');
      button.textContent = def ? def.skill : '等待夥伴';
      button.disabled = store.blocked || !!gacha?.active || !def?.kind || remaining > 0 || (id === 'zhenmu' && Object.keys(s.collection).length < 2);
      select.disabled = store.blocked || !!gacha?.active;
      el.querySelector('small').textContent = i >= E.slotCount(s) ? `累計 ${format(B.slotThresholds[i])} 幣` : effect ? `${effect.kind === 'click' ? `剩 ${effect.remaining} 次 · ` : `+${format(effect.value)}/秒 · `}${Math.max(0, Math.ceil((effect.expiresAt - t) / 1000))} 秒` : !def ? '裝備後 30 秒可發動' : !def.kind ? '後續開放' : remaining ? `冷卻 ${remaining} 秒` : id === 'zhenmu' && Object.keys(s.collection).length < 2 ? '需要另一位夥伴' : '可以發動';
    });
  }
  function changed() { numbers(); renderSlots(); stage?.render(store.state); }
  function action(fn) {
    if (store.blocked || !ready || document.hidden) return;
    try { fn(); } catch (err) { notice(err.message); slotsKey = ''; renderSlots(); }
  }
  function tap() {
    action(() => {
      if (gacha.active || !$('roster').hidden || !$('receipt').hidden || !$('stats').hidden) return;
      const time = performance.now(); inputTimes = inputTimes.filter((t) => time - t < 1000); if (inputTimes.length >= 8) return;
      inputTimes.push(time);
      const result = E.click(store.state, Date.now());
      if (result.tutorial) { if (!commit(result.state)) return; }
      else { store.stage(result.state); $('save-status').textContent = '等待自動儲存'; }
      stage.click(result.amount, result.multiplier >= 10, store.state, result.completed);
      if (result.tutorial) { stage.setPartners(store.state); stage.join(store.state, [{id:'yueyue2'}]); renderSlots(); notice('教學獎勵：玥玥入隊！每秒 +4 幣，可發動尾巴節拍。'); }
      numbers();
    });
  }
  function upgrade(type, max) {
    action(() => {
      const result = E.upgrade(store.state, type, max, Date.now());
      if (!commit(result.state)) return;
      sound('upgrade'); changed();
      const el = $(`${type}-next`); el.getAnimations().forEach((a) => a.cancel());
      el.animate(matchMedia('(prefers-reduced-motion: reduce)').matches ? [{ opacity: .5 }, { opacity: 1 }] : [{ transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 180 });
    });
  }
  function activate(slot) {
    action(() => {
      if (gacha.active) return;
      const result = E.activate(store.state, slot, Date.now());
      if (!commit(result.state)) return;
      sound('skill'); stage.render(store.state); stage.skill(result.effect); changed();
    });
  }
  function showRoster(selected = null, targetSlot = null) {
    if (!ready) return;
    const s = store.state; $('roster-grid').replaceChildren();
    for (const id of Object.keys(B.characters)) {
      const count = s.collection[id] || 0, el = document.createElement('article'); el.className = `roster-character${count ? '' : ' locked'}`;
      el.append(card.art.create(Pool.byId[id]));
      const name = document.createElement('b'); name.textContent = Pool.byId[id].name;
      const stars = document.createElement('div'); stars.className = 'stars'; stars.setAttribute('aria-label', `${E.stars(count)} 星`);
      stars.innerHTML = '<img src="clicker-star.png" alt="" />'.repeat(E.stars(count));
      const passive = document.createElement('small'); passive.textContent = count ? `${count} 張 · 每秒 ${format(E.individual(s, id))}` : '尚未招募';
      const skill = document.createElement('small'); skill.textContent = `${B.characters[id].skill}${B.characters[id].kind ? '' : ' · 後續開放'}`;
      const mastery = document.createElement('small'); mastery.textContent = count > 16 ? `熟練 +${count - 16}%` : count ? `下次升星 ${count}/${B.stars[E.stars(count)] || 16}` : '';
      const rarity = document.createElement('small'); rarity.textContent = {common:'普通',rare:'稀有',epic:'史詩',legendary:'傳說'}[Pool.byId[id].rarity];
      el.append(name, rarity, stars, passive, skill, mastery); el.dataset.id = id;
      el.tabIndex = 0; el.setAttribute('role','button'); el.onclick = () => showRoster(id, targetSlot);
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRoster(id,targetSlot); } };
      el.classList.toggle('selected', selected === id); $('roster-grid').append(el);
    }
    const detail = $('roster-detail'); detail.replaceChildren();
    const title = document.createElement('b'); title.textContent = selected ? `${Pool.byId[selected].name}・更換後等待 30 秒` : '選擇夥伴，再裝備至技能槽'; detail.append(title);
    for (let i = 0; i < 3; i++) {
      const button = document.createElement('button'), occupied = selected ? s.skillSlots.indexOf(selected) : -1;
      button.textContent = i >= E.slotCount(s) ? `槽${i+1}：累計 ${format(B.slotThresholds[i])} 幣` : occupied >= 0 ? `已在槽 ${occupied+1}` : `裝備至槽 ${i+1}`;
      button.disabled = !s.collection[selected] || i >= E.slotCount(s) || occupied >= 0 || store.blocked;
      button.classList.toggle('target-slot', targetSlot === i);
      button.onclick = () => action(()=>{ if (commit(E.equip(store.state,i,selected,Date.now()))) { changed(); showRoster(selected,i); } }); detail.append(button);
    }
    $('roster').hidden = false; $('game-content').inert = true; $('roster-close').focus();
  }
  function startTimers() {
    if (document.hidden || suspended || tickTimer || !ready) return;
    tickTimer = setInterval(() => { settle(); changed(); }, 1000);
    saveTimer = setInterval(() => { if (!store.blocked) commit(); }, 5000);
    if (!gacha.active) stage.start();
  }
  function stopTimers() {
    clearInterval(tickTimer); clearInterval(saveTimer); clearTimeout(numberTimer); clearTimeout(noticeTimer);
    tickTimer = saveTimer = numberTimer = noticeTimer = 0; stage?.stop();
    document.getAnimations().forEach((a) => a.cancel()); $('notice').hidden = true;
  }
  function suspend() {
    if (suspended) return; suspended = true;
    if (store.state && !store.blocked) { settle(); commit(); }
    stopTimers(); gacha?.suspend(); audio?.stop(0); audio = null;
    const ac = window.GachaAudio.ensure(); ac?.suspend().catch(() => {});
  }
  function offline() {
    if (!store.state || store.blocked) return;
    const result = E.settle(store.state, Date.now());
    if (!commit(result.state)) return;
    if (result.elapsed >= 60000 && result.earned > 0) {
      const hours = (ms) => format(ms / 3600000);
      $('receipt-text').textContent = `離開 ${hours(result.elapsed)} 小時，結算 ${hours(result.duration)} 小時，獲得 ${format(result.earned)} 幣。`;
      $('receipt').hidden = false; $('game-content').inert = true; $('receipt-close').focus();
    }
  }
  async function closeWindow() {
    suspend();
    if (TAURI) {
      try { await TAURI.core.invoke('close_clicker_window'); }
      catch (err) { notice(`關閉失敗：${err.message}`); resume(); }
    }
  }
  function resume() {
    // 冪等：Tauri 的 hide()/show() 不一定觸發 visibilitychange，所以 resume 可能從多個來源進來
    if (document.hidden || !suspended) return;
    suspended = false;
    if (!ready) return;
    offline(); gacha.restore(); stage.render(store.state, { instant: true }); changed(); startTimers(); muteAudio();
  }
  function applyZoom(z) { $('zoomer').style.transform = `scale(${Number.isFinite(z) && z > 0 ? z : 1})`; }
  function fitWindow() { TAURI?.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {}); }
  const card = window.GachaCard.create({ rarity: Pool.RARITY, byId: Pool.byId, canHover: () => gacha?.canHover() || false, fatal: $('fatal'), tagFor: E.tagFor });
  // 保留供共用 rig 查找的結構 id；所有 url(#id) 素材引用則在每個 SVG 實例內唯一。
  let artSerial = 0;
  function isolateArt(svg) {
    if (!svg?.querySelectorAll) return svg;
    const ids = new Map();
    svg.querySelectorAll('defs [id]').forEach((el) => { const id = el.id, unique = `clicker-art-${++artSerial}-${id}`; ids.set(id, unique); el.id = unique; });
    svg.querySelectorAll('*').forEach((el) => {
      for (const attribute of [...el.attributes]) {
        let value = attribute.value;
        for (const [id, unique] of ids) value = value.replaceAll(`url(#${id})`, `url(#${unique})`).replaceAll(`url("#${id}")`, `url("#${unique}")`);
        if (attribute.name === 'href' || attribute.name === 'xlink:href') value = ids.has(value.slice(1)) && value.startsWith('#') ? `#${ids.get(value.slice(1))}` : value;
        if (value !== attribute.value) el.setAttribute(attribute.name, value);
      }
    });
    return svg;
  }
  const createArt = card.art.create, createCard = card.create;
  card.art.create = (entry) => isolateArt(createArt(entry));
  card.create = (...args) => { const el = createCard(...args); el.querySelectorAll('svg').forEach(isolateArt); return el; };
  async function main() {
    for (const id of ['close', 'error-close', 'recruit-window-close']) $(id).onclick = closeWindow;
    for (const id of ['topbar', 'recruit-topbar']) $(id).onpointerdown = (e) => {
      if (e.button === 0 && !e.target.closest('button,select,label')) TAURI?.window.getCurrentWindow().startDragging().catch(() => {});
    };
    if (TAURI) {
      applyZoom(await TAURI.core.invoke('get_clicker_zoom').catch(() => 1)); fitWindow();
      // Rust 每次 show_clicker_window 都會發 clicker-zoom：拿它當「視窗已重新顯示」的訊號補跑 resume
      await TAURI.window.getCurrentWindow().listen('clicker-zoom', ({ payload }) => { applyZoom(payload); fitWindow(); resume(); });
    }
    if (!store.state) {
      $('game-content').inert = true; $('save-error').hidden = false; $('save-error-text').textContent = store.error.message;
      $('export-raw').onclick = () => { $('raw-save').value = store.raw ?? '(無法讀取原始資料)'; $('raw-save').hidden = false; $('raw-save').select(); };
      return;
    }
    await card.ready;
    stage = window.ClickerStage.create({ card, sound, format, showRoster, notice });
    gacha = window.ClickerGacha.create({ store, card, commit, changed, format, notice,
      pauseStage() { stage.stop(); renderSlots(); },
      resumeStage() { if (!document.hidden && !suspended) { stage.start(); stage.render(store.state, { instant: true }); } renderSlots(); },
      joined(entries) { stage.join(store.state, entries); },
    });
    ready = true; gacha.setReady(); stage.setPartners(store.state);
    offline(); stage.render(store.state, { instant: true }); changed(); status();
    if (store.state.pending) gacha.restore(); startTimers();
    $('tap').onclick = tap;
    $('tap').onkeydown = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); } };
    $('tap').onkeyup = (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); };
    for (const type of ['click', 'training']) { $(`${type}-one`).onclick = () => upgrade(type, false); $(`${type}-max`).onclick = () => upgrade(type, true); }
    $('mute').onclick = $('recruit-mute').onclick = () => action(() => {
      const s = E.settle(store.state, Date.now()).state; s.settings.muted = !s.settings.muted;
      if (commit(s)) { muteAudio(); changed(); }
    });
    $('retry-save').onclick = () => { if (commit()) { settle(); changed(); } };
    $('roster-open').onclick = () => showRoster();
    for (const id of ['roster', 'stats', 'receipt']) $(`${id}-close`).onclick = () => { $(id).hidden = true; $('game-content').inert = gacha.active; $('tap').focus(); };
    $('stats-open').onclick = () => {
      const s = store.state;
      $('stats-body').textContent = `生涯收入 ${format(s.lifetimeCoins)} 幣｜手點 ${format(s.manualClicks)} 次｜已拆 ${s.package.index - 1} 包｜夥伴 ${Object.keys(s.collection).length} / 12｜付費抽數 ${s.paidDraws}`;
      $('stats').hidden = false; $('game-content').inert = true; $('stats-close').focus();
    };
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
  window.addEventListener('focus', resume);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('resize', fitWindow);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('roster').hidden) $('roster-close').click(); else if (!$('stats').hidden) $('stats-close').click();
      else if (!$('receipt').hidden) $('receipt-close').click(); else if (gacha?.active && !store.state.pending) gacha.close(); else closeWindow();
    }
    if (e.key === 'Tab') {
      const panel = ['save-error', 'receipt', 'roster', 'stats', 'recruit-layer'].map($).find((el) => !el.hidden);
      if (!panel) return;
      const focusable = [...panel.querySelectorAll('button,select,textarea')].filter((el) => !el.disabled && !el.hidden && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
  });
  main().catch((err) => { $('fatal').hidden = false; $('fatal').textContent = `珍母點點初始化失敗：${err.message}`; });
  return { get state() { return store.state; } };
})();
