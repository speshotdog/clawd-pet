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
    // 技能說明（使用者 2026-09-16：「指上去卡片會浮出他的技能效果，不然玩家不好配置」）
    // 1.0 照名冊的 skillTip（現在這一星＋下一星）；2.0 照稀有度表（名字沿用 1.0）。兩邊回同一個形狀 { name, text }。
    function skillInfo(id) {
      const s = store.state;
      if (apoc()) return A().skillInfo?.(id) || null;
      const def = B.characters[id]; if (!def) return null;
      if (!def.kind) return { name: def.skill, text: '後續開放' };
      const star = Math.max(1, E.stars(E.dust(s, id) || 0)), now = E.skillAt(s, id, star);
      return { name: def.skill, text: `現在：${now.desc(now)}` + (star < 5 ? `
下一星：${now.desc(E.skillAt(s, id, star + 1))}` : '') };
    }
    // 懸浮提示：一個共用的浮層跟著卡走（放在 #team-editor 裡，不會被網格的 overflow 切掉）。
    // 手機沒有 hover，同一份文字也寫在詳情面板（#t20-detail-skill），點卡就看得到。
    let tip = null, tipFor = null;
    function tipNode() { if (!tip) { tip = el('div', 'team-tip'); tip.hidden = true; tip.setAttribute('role', 'tooltip'); $('team-editor').append(tip); } return tip; }
    function showTip(anchor, id) {
      const info = skillInfo(id); if (!info) return hideTip();
      const n = tipNode(); n.replaceChildren(el('b', '', info.name), el('span', '', info.text)); n.hidden = false; tipFor = anchor;
      // 先放在卡的右邊；右邊放不下就放左邊；上下不超出編隊畫面。
      // ⚠ 整個遊戲是 transform:scale 縮放的：getBoundingClientRect 是螢幕座標、left/top 是版面座標，要除掉縮放比才對得上
      // 挑選器是 <dialog> showModal（top layer），掛在 #team-editor 的浮層會被它整個蓋住（使用者 2026-09-16 截圖）——
      // 卡在 dialog 裡就把浮層搬進 dialog，座標也改以 dialog 為準
      const ed = anchor.closest('dialog[open]') || $('team-editor'); if (n.parentElement !== ed) ed.append(n);
      const host = ed.getBoundingClientRect(), k = host.width / (ed.offsetWidth || host.width) || 1;
      const a = anchor.getBoundingClientRect(), w = n.offsetWidth, h = n.offsetHeight, W = ed.offsetWidth, H = ed.offsetHeight;
      let x = (a.right - host.left) / k + 8; if (x + w > W - 8) x = (a.left - host.left) / k - w - 8; if (x < 8) x = 8;
      let y = (a.top - host.top) / k; if (y + h > H - 8) y = H - 8 - h; if (y < 8) y = 8;
      n.style.left = `${x}px`; n.style.top = `${y}px`;
    }
    function hideTip() { if (tip) tip.hidden = true; tipFor = null; }
    function attachTip(node, id) {
      node.addEventListener('pointerenter', e => { if (e.pointerType === 'touch') return; showTip(node, id); });
      node.addEventListener('pointerleave', () => { if (tipFor === node) hideTip(); });
      node.addEventListener('focus', () => showTip(node, id)); node.addEventListener('blur', () => { if (tipFor === node) hideTip(); });
    }
    // 排序（使用者 2026-09-16：「編隊那邊能不能給個排序是戰力高低的？我看不太清楚有什麼戰力比較高的卡」）。
    // 五種：戰力／稀有度／技能型／養成（星＋突破）／編入順序。隊伍網格與挑選器共用同一個選單值，記在 localStorage。
    const ROLE_NAME = { open: '開封', train: '加訓', reset: '重整', coin: '撿金幣', breach: '破防', idle: '放置狂熱' };
    const ROLE_ORDER = ['open', 'train', 'breach', 'coin', 'idle', 'reset'];
    const SORTS = [['power', '戰力高→低'], ['rarity', '稀有度'], ['role', '技能型'], ['growth', '養成進度'], ['order', '編入順序']];
    let sortKey = (() => { try { return localStorage.getItem('t20-sort') || 'power'; } catch { return 'power'; } })();
    const roleOf = id => apoc() ? (byId(id)?.role || '') : (B.characters[id]?.kind || '');
    const growthOf = id => { const s = store.state; if (apoc()) { const a = apocState(); return A().starsAt(a, id) * 10 + A().transcendOf(a, id); } return E.stars(E.dust(s, id) || 0) * 10 + (s.transcend?.[id] || 0); };
    function sortIds(ids, mode = sortKey) {
      const arr = ids.map((id, i) => ({ id, i }));
      const cmp = { power: (x, y) => power(y.id) - power(x.id), rarity: (x, y) => rank(x.id) - rank(y.id) || power(y.id) - power(x.id),
        role: (x, y) => (ROLE_ORDER.indexOf(roleOf(x.id)) - ROLE_ORDER.indexOf(roleOf(y.id))) || rank(x.id) - rank(y.id) || power(y.id) - power(x.id),
        growth: (x, y) => growthOf(y.id) - growthOf(x.id) || power(y.id) - power(x.id), order: (x, y) => x.i - y.i }[mode] || ((x, y) => x.i - y.i);
      return arr.sort((x, y) => cmp(x, y) || x.i - y.i).map(x => x.id);
    }
    function sortSelect(id, onChange) {
      let sel = $(id); if (sel) { sel.value = sortKey; return sel; }
      sel = document.createElement('select'); sel.id = id; sel.className = 't20-sort'; sel.setAttribute('aria-label', '排序');
      for (const [k, name] of SORTS) { const o = document.createElement('option'); o.value = k; o.textContent = name; sel.append(o); }
      sel.value = sortKey; sel.onchange = () => { sortKey = sel.value; try { localStorage.setItem('t20-sort', sortKey); } catch {} document.querySelectorAll('.t20-sort').forEach(x => { x.value = sortKey; }); onChange(); };
      return sel;
    }
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
    function portrait(id) {
      const p = el('span', 'buddy-portrait');
      // 末世用精裝卡面
      const holo = apoc() && window.ClickerHolo?.ready() ? window.ClickerHolo.face(byId(id)) : null;
      // 末世拿不到精裝卡面時放空白底，不准退回 1.0 卡面（使用者 09-13）
      if (holo) { p.classList.add('holo-slot'); p.append(holo); } else if (apoc()) { const b = el('span', 'apoc-face-blank'); p.append(b); } else p.append(card.art.create(byId(id)));
      return p;
    }
    function proxy(id, index, handler) {
      const b = el('button', 'team-proxy'); b.type = 'button'; b.dataset.id = id;
      b.setAttribute('aria-label', `${index === null ? '候選' : String(index + 1).padStart(2, '0')} ${byId(id).name} ${RAR[byId(id).rarity]}`);
      const img = el('span', 'proxy-image'); img.append(portrait(id));
      if (index !== null) img.append(el('span', 'proxy-index', String(index + 1).padStart(2, '0')));
      if (!apoc()) img.append(el('span', 'proxy-symbol', SYMBOLS[byId(id).rarity]));   // 精裝卡的卡框本身就是稀有度
      b.append(img, el('span', 'proxy-name', byId(id).name.replace('（原版）', '')));
      if (!apoc() && E.champion(store.state, id)) b.append(el('i', 'champ-flag', '本輪當家'));
      const slot = skills().indexOf(id); if (slot >= 0) b.append(el('i', 'slot-stamp', `槽${slot + 1}`));
      b.onclick = handler; attachTip(b, id); return b;
    }
    // ---- 累加上限：一條 20 格的長條（使用者 2026-09-14：「可能一行就好，格子用顏色區別然後加字」）
    // 以前是四條列各一行，「神話＋傳說」「神話＋傳說＋史詩」在窄欄被截成「神話…」「神…」，
    // 看起來像四條都是神話（朋友回報「字跑不出來而且都是神話」）。
    // 現在：格子照實際隊伍組成上色、上限畫成分隔線（累加上限就是「前 N 格」）、底下一行短圖例。
    const TIERS = ['mythic', 'legendary', 'epic', 'rare'];
    function renderCapacity(ids = team()) {
      const n = counts(ids), host = $('t20-caps'); host.replaceChildren();
      const total = LIMITS[LIMITS.length - 1];
      const per = TIERS.map((_, i) => n[i] - (i ? n[i - 1] : 0));   // 每一階實際幾張（n 是累加的）
      const bar = el('div', 'caps-bar'); bar.style.setProperty('--count', total); bar.setAttribute('aria-hidden', 'true');
      let at = 0;
      for (let j = 0; j < total; j++) {
        while (at < TIERS.length && per.slice(0, at + 1).reduce((a, b) => a + b, 0) <= j) at++;
        const cell = el('i', j < n[n.length - 1] ? 'filled' : '');
        if (j < n[n.length - 1]) cell.dataset.tier = TIERS[Math.min(at, TIERS.length - 1)];
        // 上限線：畫在第 2／6／12 格之後（最後一格是隊伍尾端，不用畫）
        if (LIMITS.includes(j + 1) && j + 1 < total) cell.classList.add('cap-edge');
        bar.append(cell);
      }
      host.append(bar);
      const legend = el('div', 'caps-legend');
      LIMITS.forEach((lim, i) => {
        const chip = el('span', 'capacity-row'); chip.dataset.row = i;
        chip.title = `${LABELS[i]}合計上限 ${lim}`;
        chip.append(el('i', 'dot'));
        chip.lastChild.dataset.tier = TIERS[i];
        // 第四條的意思是「全隊」（累加到 20），不是「精良」——色塊仍用精良色對應長條尾段
        chip.append(el('b', '', i === LIMITS.length - 1 ? '全隊' : RAR[TIERS[i]]), el('span', 'digits', `${n[i]}/${lim}`));
        legend.append(chip);
      });
      host.append(legend);
    }
    function clearOperation() { clearTimeout(previewTimer); pending = null; $('t20-errors').textContent = ''; document.querySelectorAll('#t20-caps .capacity-row').forEach(r => r.classList.remove('affected', 'violated')); }
    // ---- 隊伍網格（10 張一頁）
    function renderRoster() {
      const ids = team(), pages = Math.max(1, Math.ceil(ids.length / 10)); page = Math.min(page, pages - 1);
      const grid = $('t20-grid'); grid.replaceChildren();
      { const head = document.querySelector('.team-roster-head'); const sel = sortSelect('t20-sort-roster', () => { renderRoster(); }); if (sel.parentElement !== head) head.insertBefore(sel, $('t20-add')); }
      // 顯示照排序，序號照隊伍位置（序號是技能槽拖曳與「第 N 位」用的，不能跟著排序變）
      const shown = sortIds(ids);
      shown.forEach((id, k) => { const i = ids.indexOf(id); const b = proxy(id, i, () => select(id, true)); b.hidden = Math.floor(k / 10) !== page; b.setAttribute('aria-selected', String(id === selected)); if (sortKey === 'power') b.append(el('i', 'proxy-power', format(power(id)))); grid.append(b); });
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
        // 直式只放卡不放名字，名字要留在 title／aria-label（Codex 複檢 C）
        const label = id ? `技能槽 ${i + 1}：${byId(id).name}` : `技能槽 ${i + 1}：挑選`; b.title = label; b.setAttribute('aria-label', label);
        if (!apoc() && i >= E.slotCount(s)) { b.disabled = true; b.append(el('span', 'slot-name', '未解鎖')); }
        else if (id) { b.append(portrait(id), el('span', 'slot-name', byId(id).name.replace('（原版）', ''))); attachTip(b, id); }
        else b.append(el('span', 'slot-name', '＋ 挑選'));
        b.onclick = () => openPicker('skill', i); box.append(b);
      }
    }
    // ---- 詳情面板（同 team20 detail）
    function detail() {
      const s = store.state, own = apoc() ? apocState().collection : s.collection;
      const ids = team(), id = selected && own[selected] ? selected : ids[0];
      if (!id) { const sk = $('t20-detail-skill'); if (sk) sk.hidden = true; $('t20-detail-name').textContent = '尚未編入'; $('t20-detail-number').textContent = '—'; $('t20-detail-rarity').textContent = ''; $('t20-detail-op').textContent = '選擇成員以編入'; $('t20-card').replaceChildren(); $('t20-remove').disabled = true; $('t20-replace').disabled = true; return; }
      selected = id; const index = ids.indexOf(id), serial = index >= 0 ? String(index + 1).padStart(2, '0') : '候選';
      $('t20-detail-number').textContent = serial; $('t20-detail-name').textContent = byId(id).name;
      $('t20-detail-rarity').textContent = apoc()
        ? `${RAR[byId(id).rarity]}・★${apocState().collection[id] || 1}・戰力 ${format(power(id))}`
        : `${RAR[Pool.byId[id].rarity]}・每秒 ${format(E.individual(s, id))}${E.champion(s, id) ? '・本輪當家 ×1.5' : ''}`;
      $('t20-detail-op').textContent = `${serial} · ${index >= 0 ? '已編入' : '尚未編入'} · ${byId(id).name}`;
      { const info = skillInfo(id), sk = $('t20-detail-skill'); if (sk) { sk.hidden = !info; if (info) sk.replaceChildren(el('b', '', info.name), el('span', '', info.text)); } }
      const host = $('t20-card'); host.replaceChildren();
      if (apoc() && window.ClickerHolo?.ready()) {
        const wrap = document.createElement('div'); wrap.className = 'card flipped album-card detail-card holo-card';
        const f = window.ClickerHolo.face(byId(id)); if (f) wrap.append(f); host.append(wrap); fitDetailCard();
        $('t20-remove').disabled = index < 0; $('t20-replace').disabled = index < 0;
        document.querySelectorAll('#t20-grid .team-proxy').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === selected)));
        return;
      }
      if (apoc()) { const b = document.createElement('div'); b.className = 'card flipped album-card detail-card apoc-face-blank'; host.append(b); fitDetailCard(); return; }   // 末世不准退回 1.0 卡面
      const face = card.create({ ...byId(id), rarity: E.rarity(s, id) }, { tag: false }); face.classList.add('flipped', 'album-card', 'detail-card'); host.append(face); fitDetailCard();
      $('t20-remove').disabled = index < 0; $('t20-replace').disabled = index < 0;
      document.querySelectorAll('#t20-grid .team-proxy').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === selected)));
    }
    // 詳情卡是固定 150×210 的版面，技能列加進來之後那一格常常不夠高，卡會壓到下面的字——
    // 量格子有多高，卡整張等比縮到塞得進去（1fr 那一格有多大就多大）
    function fitDetailCard() {
      const box = $('t20-card'), c = box.firstElementChild; if (!c) return;
      c.style.transform = ''; c.style.transformOrigin = '';
      requestAnimationFrame(() => { if (!box.isConnected || box.firstElementChild !== c) return;
        const k = Math.min(1, box.clientHeight / 210, box.clientWidth / 150);
        if (k < .999) { c.style.transformOrigin = '50% 0'; c.style.transform = `scale(${k.toFixed(3)})`; } });
    }
    function select(id, open = false) { clearOperation(); selected = id; const i = sortIds(team()).indexOf(id); if (i >= 0 && Math.floor(i / 10) !== page) { page = Math.floor(i / 10); renderRoster(); } detail(); if (open) $('team-editor').classList.add('detail-open'); }
    // ---- 預覽與加入（同 team20 preview／add）：撞上限時逐層寫出「合計已達 n，加入後將為 m」
    function preview(id) {
      clearOperation(); pending = id;
      previewTimer = setTimeout(() => { const affected = LIMITS.map((_, i) => rank(id) <= i); document.querySelectorAll('#t20-caps .capacity-row').forEach((r, i) => r.classList.toggle('affected', affected[i])); $('t20-picker-status').textContent = `${byId(id).name} · 影響：${LABELS.filter((_, i) => affected[i]).join('、')}`; }, 120);
    }
    // 多選：picks 是這次要一起加的 id；每按一次就用「隊伍＋picks」重算四條上限，撞到就標紅、不讓你選
    let picks = [];
    function togglePick(id, btn) {
      const ids = team();
      if (picks.includes(id)) picks = picks.filter(x => x !== id);
      else {
        const next = [...ids, ...picks, id], bad = violations(next);
        if (next.length > 20) { $('t20-picker-status').textContent = `隊伍最多 20 張（已選 ${picks.length}，還能加 ${Math.max(0, 20 - ids.length - picks.length)} 張）`; return; }
        if (bad.length) { const after = counts(next); $('t20-picker-status').textContent = bad.map(i => `${LABELS[i]}合計會到 ${after[i]}（上限 ${LIMITS[i]}）`).join('；'); btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 400); return; }
        picks.push(id);
      }
      btn.setAttribute('aria-selected', String(picks.includes(id)));
      refreshPickable();
      const next = [...ids, ...picks], n = counts(next);
      document.querySelectorAll('#t20-caps .capacity-row').forEach((r, i) => r.classList.toggle('affected', picks.some(p => rank(p) <= i)));
      $('t20-picker-status').textContent = picks.length ? `已選 ${picks.length} 張（隊伍 ${next.length} / 20・神話 ${n[0]}/${LIMITS[0]}・傳說 ${n[1]}/${LIMITS[1]}・史詩 ${n[2]}/${LIMITS[2]}）` : '點卡片選擇，可以一次選好幾張再按確認';
      $('t20-picker-confirm').textContent = picks.length ? `確認加入 ${picks.length} 張` : '確認';
      $('t20-picker-confirm').disabled = !picks.length;
    }
    // 每次勾選後把「現在再加會撞上限」的候選卡先灰掉、寫原因——不然玩家點了沒反應以為壞了（使用者 2026-09-16：「每次只能加一個卡」）
    function refreshPickable() {
      const base = [...team(), ...picks];
      document.querySelectorAll('#t20-picker-grid .team-proxy').forEach(b => {
        const id = b.dataset.id; if (!id || picks.includes(id) || team().includes(id)) { b.classList.remove('capped'); return; }
        const next = [...base, id], full = next.length > 20, bad = violations(next);
        b.classList.toggle('capped', full || !!bad.length);
        b.title = full ? '隊伍已滿 20 張' : bad.length ? bad.map(i => `${LABELS[i]}已達上限 ${LIMITS[i]}`).join('；') : '';
      });
    }
    function addMany(list) {
      clearOperation(); const s = store.state;
      const next = [...team(), ...list.filter(id => !team().includes(id))];
      if (next.length > 20 || violations(next).length) { $('t20-picker-status').textContent = '上限變了，重新選一次'; return false; }
      let ok = false;
      action(() => { if (commit(apoc() ? writeTeam(next) : E.setRoster(s, next, Date.now()))) { ok = true; changed(); sound('upgrade'); } });
      if (ok) { selected = list[0] || selected; renderRoster(); detail(); notice(`${list.map(id => byId(id).name).join('、')} 編入隊伍`); }
      return ok;
    }
    function add(id, replace = null) {
      clearOperation(); const s = store.state;
      const own = apoc() ? apocState().collection : s.collection;
      if (!own[id]) return false;
      if (apoc() ? (s.apoc?.dispatch || []).some(d => d.id === id) : E.dispatched(s, id)) { $('t20-picker-status').textContent = '派遣中，回來才能編入'; return false; }
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
      drag?.cancel(); clearOperation(); pending = null; picks = []; pickerMode = mode; pickerSlot = slot; $('t20-picker-confirm').textContent = '確認';
      const s = store.state, ids = team();
      $('t20-picker-title').textContent = mode === 'skill' ? `挑選技能槽 ${slot + 1}` : mode === 'replace' ? '替換目前成員' : '新增隊伍成員';
      $('t20-picker-status').textContent = mode === 'skill' ? `技能槽 ${slot + 1} · 點卡片選擇；桌機也可直接從隊伍拖到技能槽` : mode === 'add' ? '點卡片選擇，可以一次選好幾張再按確認' : '選擇成員，預覽受影響的累加上限';
      $('t20-picker-confirm').disabled = true;
      const own = apoc() ? apocState().collection : s.collection;
      const pool = mode === 'skill' ? ids
        : Object.keys(own).filter(id => own[id] > 0 && (apoc() ? !!byId(id) : B.characters[id]))
            .sort((a, b) => rank(a) - rank(b) || power(b) - power(a));
      const grid = $('t20-picker-grid'); grid.replaceChildren();
      { const head = document.querySelector('#t20-picker .picker-heading'); const sel = sortSelect('t20-sort-picker', () => { openPicker(pickerMode, pickerSlot); }); if (sel.parentElement !== head) head.insertBefore(sel, $('t20-picker-close')); }
      for (const id of sortIds(pool)) {
        const b = proxy(id, null, () => {
          if (mode === 'skill') { pending = id; $('t20-picker-status').textContent = `技能槽 ${slot + 1} · ${byId(id).name}`; }
          else if (mode === 'add') { togglePick(id, b); return; }   // 新增成員：多選，按一次確認一起加（參考薑餅人王國的編隊：點卡就進隊、上限條即時變）
          else preview(id);
          $('t20-picker-confirm').disabled = false; document.querySelectorAll('#t20-picker-grid .team-proxy').forEach(x => x.setAttribute('aria-selected', String(x === b))); });
        if (mode !== 'skill' && ids.includes(id)) b.disabled = true;
        if (mode !== 'skill' && (apoc() ? (s.apoc?.dispatch || []).some(d => d.id === id) : E.dispatched(s, id))) { b.disabled = true; b.title = '派遣中'; }
        grid.append(b);
      }
      if (!pool.length) grid.append(el('p', 'team-empty', mode === 'skill' ? '隊伍是空的，先編入成員' : '沒有候選'));
      if (mode === 'add') refreshPickable();
      if (!$('t20-picker').open) $('t20-picker').showModal();
    }
    function closePicker() { clearOperation(); const d = $('t20-picker'); if (d.open) d.close(); }
    $('t20-picker-close').onclick = closePicker;
    $('t20-picker').addEventListener('close', clearOperation);
    $('t20-picker-confirm').onclick = () => { if (pickerMode === 'add') { if (picks.length && addMany(picks)) closePicker(); return; } if (!pending) return; const id = pending, ok = pickerMode === 'skill' ? assignSkill(pickerSlot, id) : add(id, pickerMode === 'replace' ? selected : null); if (ok) closePicker(); };
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
        // 技能槽裡的卡先留住（使用者 2026-09-16：「我點自動他會轉掉我現在的技能組」），其餘照戰力補
        const keep = (a.skills || []).filter(id => id && own.includes(id));
        const auto = [...keep];
        for (const id of own.sort((x, y) => power(y) - power(x)))
          if (!auto.includes(id) && auto.length < 20 && !violations([...auto, id]).length) auto.push(id);
        if (commit(writeTeam(auto))) { changed(); selected = auto[0] || null; renderRoster(); detail(); notice('已照戰力自動編隊'); }
        return;
      }
      const auto = E.autoRoster(s, s.skillSlots.filter(Boolean));
      if (commit(E.setRoster(s, auto, Date.now()))) { changed(); selected = auto[0] || null; renderRoster(); detail(); notice('已照每秒收益自動編隊'); }
    });
    $('team-close').onclick = close;
    // 拖曳：從隊伍網格拖到技能槽（與舞台夥伴列共用 clicker-drag 的骨架）
    drag?.bind({ source: '#t20-grid', item: '.team-proxy', targets: '#t20-skills .skill-slot', drop: (index, id) => assignSkill(index, id), enabled: () => !$('team-editor').hidden });
    function render() { hideTip(); renderRoster(); detail(); }
    function open() { clearOperation(); page = 0; selected = team()[0] || null; $('team-editor').hidden = false;
      // 第一次進末世的編隊指引（使用者 2026-09-16）：還沒打過任何一站時，頂欄寫清楚接下來要做什麼
      { let hint = $('t20-first-hint'); if (!hint) { hint = el('p', 'team-first-hint'); hint.id = 't20-first-hint'; $('team-editor').querySelector('header').after(hint); }
        const a = apoc() ? apocState() : null; hint.hidden = !(a && (a.progress || 0) === 0 && !(a.laps > 0));
        hint.textContent = '第一次來：隊伍裡的卡才有戰力，先「＋ 新增成員」或「自動編隊」，再把最強的卡放進下面的技能槽；編好按「返回」，回戰鬥畫面按「開戰」。'; } $('team-editor').classList.remove('detail-open'); $('game-content').inert = true; render(); $('team-close').focus(); }
    function close() { closePicker(); $('team-editor').hidden = true; $('game-content').inert = false; }
    return { open, close, render, openPicker, add, remove, get isOpen() { return !$('team-editor').hidden; }, get selected() { return selected; }, get page() { return page; } };
  }
  root.ClickerTeamUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
