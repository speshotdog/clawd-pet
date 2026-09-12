// v3：1.0 的編隊畫面（2026-09-13）。左邊隊伍 20 格＋階級上限列，右邊候選；點候選＝編入、點隊員＝移出；
// 底下技能槽：點隊員再點槽＝裝備。塞不進去一律講原因（使用者：「想放置塞不進去的階級會提示原因」）。
// 拖曳到舞台技能槽的路徑在 clicker-drag.js（主畫面夥伴列），這裡先用點選，之後再把拖曳接進來。
(function (root) {
  function create({ $, store, commit, changed, action, notice, sound, card, E, B, Pool, format }) {
    const LIMITS = B.V3.ROSTER_LIMITS, LAYER = ['神話', '神話＋傳說', '神話＋傳說＋史詩', '全隊'], RAR = { rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' };
    let picked = null;   // 點選中的隊員（準備裝到槽）
    // 為什麼塞不進去：回傳一句話，塞得進去回傳 null
    function whyNot(s, id) {
      const team = E.rosterOf(s);
      if (team.includes(id)) return '已在隊伍裡';
      if (E.dispatched(s, id)) return '派遣中，回來才能編入';
      if (team.length >= 20) return '隊伍已滿 20 張，先移出一張';
      const next = [...team, id], counts = E.rosterCounts(next), bad = E.rosterViolations(next);
      if (!bad.length) return null;
      const i = bad[0], origin = RAR[Pool.byId[id].rarity];
      const occupants = ['神話', '神話或傳說', '神話、傳說或史詩', '任一'][i];
      return `${origin}卡塞不進去：「${LAYER[i]}」這一層 ${counts[i] - 1}/${LIMITS[i]} 已滿（上限用出身算，升階不會換層）。移出一張${occupants}的卡才有位子`;
    }
    function render() {
      const s = store.state, team = E.rosterOf(s), counts = E.rosterCounts(team);
      $('team-caps').replaceChildren(...LAYER.map((name, i) => { const row = document.createElement('div'); row.className = 'team-cap' + (counts[i] >= LIMITS[i] ? ' full' : ''); row.innerHTML = `<span>${name}</span><b>${counts[i]} / ${LIMITS[i]}</b>`; return row; }));
      $('team-count').textContent = `${team.length} / 20`;
      const grid = $('team-grid'); grid.replaceChildren();
      for (let i = 0; i < 20; i++) {
        const id = team[i], cell = document.createElement('button'); cell.className = 'team-cell'; cell.type = 'button';
        if (id) {
          cell.dataset.id = id; const port = document.createElement('span'); port.className = 'buddy-portrait'; port.append(card.art.create(Pool.byId[id])); cell.append(port);
          const name = document.createElement('b'); name.textContent = Pool.byId[id].name.replace('（原版）', ''); cell.append(name);
          const rar = document.createElement('small'); rar.textContent = RAR[Pool.byId[id].rarity]; cell.append(rar);
          const slot = s.skillSlots.indexOf(id); if (slot >= 0) { const st = document.createElement('i'); st.className = 'slot-stamp'; st.textContent = `槽${slot + 1}`; cell.append(st); }
          if (E.champion(s, id)) { const f = document.createElement('i'); f.className = 'champ-flag'; f.textContent = '本輪當家'; cell.append(f); }
          cell.classList.toggle('picked', picked === id);
          cell.title = `${Pool.byId[id].name}・每秒 ${format(E.individual(s, id))}・點一下選取（再點技能槽裝備），再點一次移出隊伍`;
          cell.onclick = () => { if (picked === id) { picked = null; remove(id); } else { picked = id; render(); } };
        } else { cell.classList.add('empty'); cell.textContent = '＋'; cell.title = '從右邊點一張候選編入'; cell.onclick = () => notice('從右邊點一張候選編入'); }
        grid.append(cell);
      }
      const cands = $('team-candidates'); cands.replaceChildren();
      const pool = Object.keys(s.collection).filter(id => s.collection[id] > 0 && B.characters[id] && !team.includes(id)).sort((a, b) => E.origin(b) - E.origin(a) || E.individual(s, b) - E.individual(s, a));
      if (!pool.length) { const p = document.createElement('p'); p.className = 'team-empty'; p.textContent = '所有夥伴都在隊伍裡'; cands.append(p); }
      for (const id of pool) {
        const why = whyNot(s, id), cell = document.createElement('button'); cell.className = 'team-cell cand' + (why ? ' blocked' : ''); cell.type = 'button'; cell.dataset.id = id;
        const port = document.createElement('span'); port.className = 'buddy-portrait'; port.append(card.art.create(Pool.byId[id])); cell.append(port);
        const name = document.createElement('b'); name.textContent = Pool.byId[id].name.replace('（原版）', ''); cell.append(name);
        const rar = document.createElement('small'); rar.textContent = E.dispatched(s, id) ? '派遣中' : RAR[Pool.byId[id].rarity]; cell.append(rar);
        cell.title = why || `${Pool.byId[id].name}・每秒 ${format(E.individual(s, id))}・點一下編入`;
        cell.onclick = () => { if (why) { notice(why); $('team-why').textContent = why; return; } add(id); };
        cands.append(cell);
      }
      const slots = $('team-slots'); slots.replaceChildren();
      for (let i = 0; i < s.skillSlots.length; i++) {
        const id = s.skillSlots[i], b = document.createElement('button'); b.className = 'team-slot' + (picked ? ' target' : ''); b.type = 'button';
        b.innerHTML = `<small>技能槽 ${i + 1}</small>`;
        if (i >= E.slotCount(s)) { b.disabled = true; b.append(document.createTextNode('未解鎖')); }
        else if (id) { const port = document.createElement('span'); port.className = 'buddy-portrait'; port.append(card.art.create(Pool.byId[id])); b.append(port); const n = document.createElement('b'); n.textContent = Pool.byId[id].name.replace('（原版）', ''); b.append(n); }
        else b.append(document.createTextNode('＋'));
        b.title = picked ? `把 ${Pool.byId[picked].name} 裝到槽 ${i + 1}` : id ? `${Pool.byId[id].name}・點隊員再點這裡可換人` : '先點一位隊員，再點這裡';
        b.onclick = () => { if (!picked) { notice('先點左邊的隊員，再點技能槽'); return; } equip(i, picked); };
        slots.append(b);
      }
      $('team-why').textContent = picked ? `已選 ${Pool.byId[picked].name}：點技能槽裝備，或再點一次移出隊伍` : ($('team-why').textContent || '');
    }
    function add(id) { action(() => { const s = store.state, why = whyNot(s, id); if (why) { notice(why); return; } if (commit(E.setRoster(s, [...E.rosterOf(s), id], Date.now()))) { changed(); sound('upgrade'); $('team-why').textContent = `${Pool.byId[id].name} 編入隊伍`; render(); } }); }
    function remove(id) { action(() => { const s = store.state; if (commit(E.setRoster(s, E.rosterOf(s).filter(x => x !== id), Date.now()))) { changed(); $('team-why').textContent = `${Pool.byId[id].name} 離開隊伍${s.skillSlots.includes(id) ? '，技能槽一併清空' : ''}`; render(); } }); }
    function equip(i, id) { action(() => { try { const next = E.equip(store.state, i, id, Date.now()); if (commit(next)) { changed(); sound('upgrade'); notice(`${Pool.byId[id].name} 裝備至槽 ${i + 1}，等待 30 秒`); picked = null; render(); } } catch (err) { notice(err.message); $('team-why').textContent = err.message; } }); }
    function open() { picked = null; $('team-why').textContent = '點右邊候選編入、點隊員移出；只有隊伍裡的夥伴產錢'; $('team-editor').hidden = false; $('game-content').inert = true; render(); $('team-close').focus(); }
    function close() { $('team-editor').hidden = true; $('game-content').inert = false; }
    $('team-close').onclick = close;
    $('team-auto').onclick = () => action(() => { const s = store.state, auto = E.autoRoster(s, s.skillSlots.filter(Boolean)); if (commit(E.setRoster(s, auto, Date.now()))) { changed(); $('team-why').textContent = '已照每秒收益自動編隊'; render(); } });
    return { open, close, render, whyNot, get isOpen() { return !$('team-editor').hidden; } };
  }
  root.ClickerTeamUI = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
