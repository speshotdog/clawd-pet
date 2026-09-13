// v3：1.0 的編隊畫面（2026-09-13 改成與末世 team20 同一套邏輯——使用者：「1.0 跟 2.0 的相同功能都要用一樣的 UI 邏輯」）。
// 結構照 holo-5.0 _art/holo-test/team20.js：
//   累加上限列（四層、格子、受影響／違規提示）→ 隊伍網格（10 張一頁、序號、稀有度符號）→ 獨立技能格（點格挑、或從網格拖）
//   → 詳情面板（新增成員／替換目前成員／移除）→ 挑選器 <dialog>（候選、預覽受影響的層、確認）
// 差別只有卡面：1.0 用 GachaCard／character rig，末世用 HoloCardFace。規則本體在 economy（rosterCounts／rosterViolations／setRoster／equip）。
(function (root) {
  function create({ $, store, commit, changed, action, notice, sound, card, E, B, Pool, format, drag }) {
    const LIMITS = B.V3.ROSTER_LIMITS, LABELS = ['神話', '神話＋傳說', '神話＋傳說＋史詩', '全隊'], SYMBOLS = { mythic: '◆◆', legendary: '◆', epic: '◇', rare: '△' }, RAR = { rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' };
    // 兩個主系統共用這一個編隊畫面：上限規則、版面、操作完全一樣，
    // 差別只有卡池、「隊伍是誰」、以及 1.0 特有的當家／派遣／技能槽解鎖（末世沒有那些）。
    const A = () => window.ApocEconomy;
    const apoc = () => store.state?.settings.world === 'apoc';
    const RANK = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 3 };
    const byId = id => apoc() ? ((window.ApocPool || []).find(c => c.id === id) || Pool.byId[id]) : Pool.byId[id];
    const rank = id => apoc() ? RANK[byId(id).rarity] : 3 - E.origin(id);   // 0 神話 … 3 精良
    const apocState = () => A().normalize(store.state.apoc);
    let page = 0, selected = null, pickerMode = 'add', pickerSlot = 0, pending = null, previewTimer = 0;
    const team = () => apoc() ? apocState().roster : E.rosterOf(store.state);
    const skills = () => apoc() ? apocState().skills : store.state.skillSlots;
    const counts = ids => apoc() ? A().rosterCounts(ids) : E.rosterCounts(ids);
    const violations = ids => apoc() ? A().rosterViolations(ids) : E.rosterViolations(ids);
    const power = id => apoc() ? A().cardPower(apocState(), id) : E.individual(store.state, id);
    // 末世把隊伍與技能格一起寫回；1.0 沿用原本的 setRoster／equip
    function writeTeam(roster, nextSkills) {
      const next = E.clone(store.state);
      next.apoc = A().setTeam(apocState(), roster, nextSkills || apocState().skills);
      return next;
    }
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    function portrait(id) {
      const p = el('span', 'buddy-portrait');
      // 末世用精裝卡面
      const holo = apoc() && window.ClickerHolo?.ready() ? window.ClickerHolo.face(byId(id)) : null;
      if (holo) { p.classList.add('holo-slot'); p.append(holo); } else p.append(card.art.create(byId(id)));
      return p;
    }
    function proxy(id, index, handler) {
      const b = el('button', 'team-proxy'); b.type = 'button'; b.dataset.id = id;
      b.setAttribute('aria-label', `${index === null ? '候選' : String(index + 1).padStart(2, '0')} ${byId(id).name} ${RAR[byId(id).rarity]}`);
      const img = el('span', 'proxy-image'); img.append(portrait(id));
      if (index !== null) img.append(el('span', 'proxy-index', String(index + 1).padStart(2, '0')));
      img.append(el('span', 'proxy-symbol', SYMBOLS[byId(id).rarity]));
      b.append(img, el('span', 'proxy-name', byId(id).name.replace('（原版）', '')));
      if (!apoc() && E.champion(store.state, id)) b.append(el('i', 'champ-flag', '本輪當家'));
      const slot = skills().indexOf(id); if (slot >= 0) b.append(el('i', 'slot-stamp', `槽${slot + 1}`));
      b.onclick = handler; return b;
    }
    // ---- 累加上限列（同 team20 renderCapacity）
    function renderCapacity(ids = team()) {
      const n = counts(ids), rows = $('t20-caps'); rows.replaceChildren();
      LABELS.forEach((label, i) => {
        const row = el('div', 'capacity-row'); row.dataset.row = i;
        row.append(el('span', '', label), el('span', 'digits', `${n[i]} / ${LIMITS[i]}`));
        const seg = el('span', 'segments'); seg.style.setProperty('--count', LIMITS[i]); seg.setAttribute('aria-hidden', 'true');
        for (let j = 0; j < LIMITS[i]; j++) seg.append(el('i', j < n[i] ? 'filled' : ''));
        row.append(seg); rows.append(row);
      });
    }
    function clearOperation() { clearTimeout(previewTimer); pending = null; $('t20-errors').textContent = ''; document.querySelectorAll('#t20-caps .capacity-row').forEach(r => r.classList.remove('affected', 'violated')); }
    // ---- 隊伍網格（10 張一頁）
    function renderRoster() {
      const ids = team(), pages = Math.max(1, Math.ceil(ids.length / 10)); page = Math.min(page, pages - 1);
      const grid = $('t20-grid'); grid.replaceChildren();
      ids.forEach((id, i) => { const b = proxy(id, i, () => select(id, true)); b.hidden = Math.floor(i / 10) !== page; b.setAttribute('aria-selected', String(id === selected)); grid.append(b); });
      if (!ids.length) grid.append(el('p', 'team-empty', '隊伍是空的。點「新增成員」或「自動編隊」。'));
      $('t20-count').textContent = `${ids.length} / 20`; $('t20-page').textContent = `${page + 1} / ${pages}`;
      $('t20-prev').disabled = page === 0; $('t20-next').disabled = page >= pages - 1;
      renderCapacity(ids); renderSkills();
    }
    function renderSkills() {
      const s = store.state, box = $('t20-skills'), list = skills(); box.replaceChildren();
      for (let i = 0; i < list.length; i++) {
        const id = list[i], b = el('button', 'skill-slot'); b.type = 'button'; b.dataset.slot = i;
        b.append(el('small', '', `技能槽 ${i + 1}`));
        if (!apoc() && i >= E.slotCount(s)) { b.disabled = true; b.append(el('span', 'slot-name', '未解鎖')); }
        else if (id) { b.append(portrait(id), el('span', 'slot-name', byId(id).name.replace('（原版）', ''))); }
        else b.append(el('span', 'slot-name', '＋ 挑選'));
        b.onclick = () => openPicker('skill', i); box.append(b);
      }
    }
    // ---- 詳情面板（同 team20 detail）
    function detail() {
      const s = store.state, own = apoc() ? apocState().collection : s.collection;
      const ids = team(), id = selected && own[selected] ? selected : ids[0];
      if (!id) { $('t20-detail-name').textContent = '尚未編入'; $('t20-detail-number').textContent = '—'; $('t20-detail-rarity').textContent = ''; $('t20-detail-op').textContent = '選擇成員以編入'; $('t20-card').replaceChildren(); $('t20-remove').disabled = true; $('t20-replace').disabled = true; return; }
      selected = id; const index = ids.indexOf(id), serial = index >= 0 ? String(index + 1).padStart(2, '0') : '候選';
      $('t20-detail-number').textContent = serial; $('t20-detail-name').textContent = byId(id).name;
      $('t20-detail-rarity').textContent = apoc()
        ? `${RAR[byId(id).rarity]}・★${apocState().collection[id] || 1}・戰力 ${format(power(id))}`
        : `${RAR[Pool.byId[id].rarity]}・每秒 ${format(E.individual(s, id))}${E.champion(s, id) ? '・本輪當家 ×1.5' : ''}`;
      $('t20-detail-op').textContent = `${serial} · ${index >= 0 ? '已編入' : '尚未編入'} · ${byId(id).name}`;
      const host = $('t20-card'); host.replaceChildren();
      if (apoc() && window.ClickerHolo?.ready()) {
        const wrap = document.createElement('div'); wrap.className = 'card flipped album-card detail-card holo-card';
        const f = window.ClickerHolo.face(byId(id)); if (f) wrap.append(f); host.append(wrap);
        $('t20-remove').disabled = index < 0; $('t20-replace').disabled = index < 0;
        document.querySelectorAll('#t20-grid .team-proxy').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === selected)));
        return;
      }
      const face = card.create({ ...byId(id), rarity: E.rarity(s, id) }, { tag: false }); face.classList.add('flipped', 'album-card', 'detail-card'); host.append(face);
      $('t20-remove').disabled = index < 0; $('t20-replace').disabled = index < 0;
      document.querySelectorAll('#t20-grid .team-proxy').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === selected)));
    }
    function select(id, open = false) { clearOperation(); selected = id; const i = team().indexOf(id); if (i >= 0 && Math.floor(i / 10) !== page) { page = Math.floor(i / 10); renderRoster(); } detail(); if (open) $('team-editor').classList.add('detail-open'); }
    // ---- 預覽與加入（同 team20 preview／add）：撞上限時逐層寫出「合計已達 n，加入後將為 m」
    function preview(id) {
      clearOperation(); pending = id;
      previewTimer = setTimeout(() => { const affected = LIMITS.map((_, i) => rank(id) <= i); document.querySelectorAll('#t20-caps .capacity-row').forEach((r, i) => r.classList.toggle('affected', affected[i])); $('t20-picker-status').textContent = `${byId(id).name} · 影響：${LABELS.filter((_, i) => affected[i]).join('、')}`; }, 120);
    }
    function add(id, replace = null) {
      clearOperation(); const s = store.state;
      const own = apoc() ? apocState().collection : s.collection;
      if (!own[id]) return false;
      if (!apoc() && E.dispatched(s, id)) { $('t20-picker-status').textContent = '派遣中，回來才能編入'; return false; }
      let next = team().filter(x => x !== replace);
      if (next.includes(id)) { $('t20-picker-status').textContent = '此成員已在隊伍中'; return false; }
      next.push(id);
      const bad = violations(next);
      if (next.length > 20 || bad.length) {
        const n = counts(team()), after = counts(next);
        const msg = next.length > 20 ? '隊伍已滿 20 張，先移出一張' : bad.map(i => `${LABELS[i]}合計已達 ${n[i]}，加入後將為 ${after[i]}（上限 ${LIMITS[i]}${apoc() ? '' : '，用出身算'}）`).join('；');
        $('t20-errors').textContent = msg; $('t20-picker-status').textContent = msg;
        bad.forEach(i => { const r = document.querySelector(`#t20-caps .capacity-row[data-row="${i}"]`); r?.classList.add('violated'); });
        notice(msg); return false;
      }
      let ok = false;
      action(() => { if (commit(apoc() ? writeTeam(next) : E.setRoster(s, next, Date.now()))) { ok = true; changed(); sound('upgrade'); } });
      if (ok) { selected = id; renderRoster(); detail(); notice(replace ? `${byId(replace).name} → ${byId(id).name}` : `${byId(id).name} 編入隊伍`); }
      return ok;
    }
    function remove() {
      const s = store.state, id = selected; if (!id || !team().includes(id)) return;
      const next = team().filter(x => x !== id);
      action(() => { if (commit(apoc() ? writeTeam(next) : E.setRoster(s, next, Date.now()))) { changed(); selected = team()[0] || null; renderRoster(); detail(); $('team-editor').classList.remove('detail-open'); notice(`${byId(id).name} 離開隊伍${skills().includes(id) ? '，技能槽一併清空' : ''}`); } });
    }
    function assignSkill(i, id) {
      let ok = false;
      action(() => { try {
        let next;
        if (apoc()) { const list = [...skills()]; list[i] = id; const roster = team().includes(id) ? team() : [...team(), id]; next = writeTeam(roster, list); }
        else next = E.equip(store.state, i, id, Date.now());
        if (commit(next)) { ok = true; changed(); sound('upgrade'); notice(`技能槽 ${i + 1} · ${byId(id).name}${apoc() ? '' : '，等待 30 秒'}`); renderRoster(); }
      } catch (err) { notice(err.message); $('t20-picker-status').textContent = err.message; } });
      return ok;
    }
    // ---- 挑選器（同 team20 openPicker：add／replace／skill 三模式）
    function openPicker(mode, slot = 0) {
      drag?.cancel(); clearOperation(); pending = null; pickerMode = mode; pickerSlot = slot;
      const s = store.state, ids = team();
      $('t20-picker-title').textContent = mode === 'skill' ? `挑選技能槽 ${slot + 1}` : mode === 'replace' ? '替換目前成員' : '新增隊伍成員';
      $('t20-picker-status').textContent = mode === 'skill' ? `技能槽 ${slot + 1} · 點卡片選擇；桌機也可直接從隊伍拖到技能槽` : '選擇成員，預覽受影響的累加上限';
      $('t20-picker-confirm').disabled = true;
      const own = apoc() ? apocState().collection : s.collection;
      const pool = mode === 'skill' ? ids
        : Object.keys(own).filter(id => own[id] > 0 && (apoc() ? !!byId(id) : B.characters[id]))
            .sort((a, b) => rank(a) - rank(b) || power(b) - power(a));
      const grid = $('t20-picker-grid'); grid.replaceChildren();
      for (const id of pool) {
        const b = proxy(id, null, () => { if (mode === 'skill') { pending = id; $('t20-picker-status').textContent = `技能槽 ${slot + 1} · ${byId(id).name}`; } else preview(id); $('t20-picker-confirm').disabled = false; document.querySelectorAll('#t20-picker-grid .team-proxy').forEach(x => x.setAttribute('aria-selected', String(x === b))); });
        if (mode !== 'skill' && ids.includes(id)) b.disabled = true;
        if (mode !== 'skill' && !apoc() && E.dispatched(s, id)) { b.disabled = true; b.title = '派遣中'; }
        grid.append(b);
      }
      if (!pool.length) grid.append(el('p', 'team-empty', mode === 'skill' ? '隊伍是空的，先編入成員' : '沒有候選'));
      $('t20-picker').showModal();
    }
    function closePicker() { clearOperation(); const d = $('t20-picker'); if (d.open) d.close(); }
    $('t20-picker-close').onclick = closePicker;
    $('t20-picker').addEventListener('close', clearOperation);
    $('t20-picker-confirm').onclick = () => { if (!pending) return; const id = pending, ok = pickerMode === 'skill' ? assignSkill(pickerSlot, id) : add(id, pickerMode === 'replace' ? selected : null); if (ok) closePicker(); };
    $('t20-add').onclick = () => openPicker('add');
    $('t20-replace').onclick = () => openPicker('replace');
    $('t20-remove').onclick = remove;
    $('t20-prev').onclick = () => { page--; renderRoster(); };
    $('t20-next').onclick = () => { page++; renderRoster(); };
    $('t20-detail-close').onclick = () => $('team-editor').classList.remove('detail-open');
    $('team-auto').onclick = () => action(() => {
      const s = store.state;
      if (apoc()) {
        // 末世沒有 autoRoster：照戰力由高到低塞，撞上限就跳過（規則本體還是 setTeam 在擋）
        const a = apocState(), own = Object.keys(a.collection).filter(id => a.collection[id] > 0 && byId(id));
        const auto = [];
        for (const id of own.sort((x, y) => power(y) - power(x)))
          if (auto.length < 20 && !violations([...auto, id]).length) auto.push(id);
        if (commit(writeTeam(auto))) { changed(); selected = auto[0] || null; renderRoster(); detail(); notice('已照戰力自動編隊'); }
        return;
      }
      const auto = E.autoRoster(s, s.skillSlots.filter(Boolean));
      if (commit(E.setRoster(s, auto, Date.now()))) { changed(); selected = auto[0] || null; renderRoster(); detail(); notice('已照每秒收益自動編隊'); }
    });
    $('team-close').onclick = close;
    // 拖曳：從隊伍網格拖到技能槽（與舞台夥伴列共用 clicker-drag 的骨架）
    drag?.bind({ source: '#t20-grid', item: '.team-proxy', targets: '#t20-skills .skill-slot', drop: (index, id) => assignSkill(index, id), enabled: () => !$('team-editor').hidden });
    function render() { renderRoster(); detail(); }
    function open() { clearOperation(); page = 0; selected = team()[0] || null; $('team-editor').hidden = false; $('team-editor').classList.remove('detail-open'); $('game-content').inert = true; render(); $('team-close').focus(); }
    function close() { closePicker(); $('team-editor').hidden = true; $('game-content').inert = false; }
    return { open, close, render, openPicker, add, remove, get isOpen() { return !$('team-editor').hidden; }, get selected() { return selected; }, get page() { return page; } };
  }
  root.ClickerTeamUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
