// v3：拖曳骨架（照 holo-5.0 team20.js 搬過來，2026-09-13）。兩個地方共用：
//   ① 主畫面夥伴列 #buddies .buddy → 舞台技能槽 #slots .skill-slot（裝備）
//   ② 編隊畫面隊伍網格 #t20-grid .team-proxy → #t20-skills .skill-slot（同一套邏輯，1.0／2.0 一樣）
// Pointer Events；只在 >700px、mouse/pen、主鍵；移動 8 CSS px 才成立，未成立就是原本的點擊。
// ghost 是同一張頭像的複本，放在 body 的 fixed 覆層、pointer-events:none。命中用矩形判（舞台技能槽本身是 pointer-events:none）。
(function (root) {
  function create({ $, store, commit, changed, notice, sound, card, E, Pool }) {
    // 拖曳也要分世界：影像走哪個卡池、能拖到第幾格、落帳寫到哪（Codex 複檢 1-3）
    const A = () => window.ApocEconomy;
    const apoc = () => store.state?.settings.world === 'apoc';
    const byId = id => apoc() ? ((window.ApocPool || []).find(c => c.id === id) || Pool.byId[id]) : Pool.byId[id];
    const slotCount = () => apoc() ? 4 : E.slotCount(store.state);
    function equipApoc(index, id) {
      const next = E.clone(store.state), a = A().normalize(next.apoc);
      const skills = [...(a.skills || [null, null, null, null])]; skills[index] = id;
      const roster = a.roster.includes(id) ? a.roster : [...a.roster, id];
      next.apoc = A().setTeam(a, roster, skills); return next;
    }
    const THRESHOLD = 8;
    let drag = null, suppressClick = false;
    const layer = document.createElement('div'); layer.id = 'drag-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer);
    const enabled = e => innerWidth > 700 && e.isPrimary && e.button === 0 && (e.pointerType === 'mouse' || e.pointerType === 'pen');
    const bindings = [];
    function cleanup() {
      if (!drag) return; const d = drag; drag = null;
      cancelAnimationFrame(d.raf); d.ghost?.remove(); d.over?.classList.remove('drop-target'); d.src.classList.remove('drag-source');
      if (d.captured) { try { d.src.releasePointerCapture(d.pid); } catch {} }
      document.body.classList.remove('dragging');
      document.querySelectorAll('.skill-slot.drop-ok').forEach(el => el.classList.remove('drop-ok'));
    }
    function cancel() { if (!drag) return; const active = drag.active; cleanup(); if (active) notice('已取消，技能未變更'); }
    function targetsOf(d) { return [...document.querySelectorAll(d.bind.targets)].filter((el, i) => !el.disabled && i < slotCount()); }   // 槽數要分世界（Codex 第三輪 A）
    function start(e) {
      const d = drag; d.active = true; document.body.classList.add('dragging'); getSelection()?.removeAllRanges();
      d.src.classList.add('drag-source');
      const img = d.src.querySelector('.buddy-portrait') || d.src, r = img.getBoundingClientRect();
      d.w = r.width; d.h = r.height; d.gx = e.clientX - r.left; d.gy = e.clientY - r.top;
      const g = document.createElement('div'); g.className = 'drag-ghost'; g.style.width = `${d.w}px`; g.style.height = `${d.h}px`;
      g.append(card.art.create(byId(d.id))); layer.append(g); d.ghost = g;
      try { d.src.setPointerCapture(d.pid); d.captured = true; } catch {}
      targetsOf(d).forEach(el => el.classList.add('drop-ok'));
      place();
    }
    function hit(d, x, y) {
      let found = null;
      [...document.querySelectorAll(d.bind.targets)].forEach((el, i) => {
        if (el.disabled || i >= slotCount()) return; const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = { el, index: i };
      });
      return found;
    }
    function place() {
      const d = drag; if (!d || !d.active) return; d.raf = 0;
      d.ghost.style.translate = `${d.x - d.gx}px ${d.y - d.gy}px`;
      const sel = getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges();
      const over = hit(d, d.x, d.y)?.el || null;
      if (over !== d.over) { d.over?.classList.remove('drop-target'); over?.classList.add('drop-target'); d.over = over; }
    }
    function bind(bind) {
      bindings.push(bind);
      const src = document.querySelector(bind.source); if (!src) return;
      src.addEventListener('pointerdown', e => {
        const b = e.target.closest(bind.item); if (!b || !enabled(e) || drag || (bind.enabled && !bind.enabled())) return;
        drag = { bind, id: b.dataset.id, src: b, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false, raf: 0, ghost: null, over: null, captured: false };
      });
      src.addEventListener('lostpointercapture', e => { if (drag && drag.active && e.pointerId === drag.pid && drag.captured) cancel(); });
      src.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    }
    addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return; drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.active) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < THRESHOLD) return; start(e); return; }
      if (!drag.raf) drag.raf = requestAnimationFrame(place);
    });
    addEventListener('pointerup', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.active) { drag = null; return; }
      drag.x = e.clientX; drag.y = e.clientY; cancelAnimationFrame(drag.raf); drag.raf = 0; place();
      const d = drag, target = hit(d, d.x, d.y), id = d.id; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); cleanup();
      if (!target) { notice('已取消，技能未變更'); return; }
      if (d.bind.drop) { d.bind.drop(target.index, id); return; }
      try {
        // 末世要寫回 s.apoc（兩個卡池有 44 個同名 id，直接呼叫 E.equip 會改到桌邊的技能槽）
        const next = apoc() ? equipApoc(target.index, id) : E.equip(store.state, target.index, id, Date.now());
        if (commit(next)) { changed(); sound('upgrade'); notice(`${byId(id).name} 裝備至槽 ${target.index + 1}${apoc() ? '' : '，等待 30 秒'}`); }
      } catch (err) { notice(err.message); }
    });
    addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) cancel(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && drag) cancel(); });
    addEventListener('blur', () => cancel());
    addEventListener('resize', () => { if (drag && innerWidth <= 700) cancel(); });
    // 預設：主畫面夥伴列 → 舞台技能槽
    bind({ source: '#buddies', item: '.buddy', targets: '#slots .skill-slot' });
    return { bind, cancel, get active() { return !!(drag && drag.active); }, get state() { return { pending: !!drag, active: !!(drag && drag.active), ghosts: layer.childElementCount, targets: document.querySelectorAll('.skill-slot.drop-target').length }; } };
  }
  root.ClickerDrag = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
