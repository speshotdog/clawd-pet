// v3：從主畫面夥伴列把夥伴拖到技能槽（照 holo-5.0 team20.js 的拖曳骨架搬過來，2026-09-13）。
// Pointer Events；只在 >700px、mouse/pen、主鍵；移動 8 CSS px 才成立，未成立就是原本的點擊（開名冊）。
// ghost 是同一張頭像的複本，放在 body 的 fixed 覆層、pointer-events:none。
// 技能槽本身是 pointer-events:none（第三十三輪：拆包面上不該有別的熱區），所以命中用矩形判，不用 elementsFromPoint。
(function (root) {
  function create({ $, store, commit, changed, notice, sound, card, E, Pool }) {
    const THRESHOLD = 8;
    let drag = null, suppressClick = false;
    const layer = document.createElement('div'); layer.id = 'drag-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer);
    const enabled = e => innerWidth > 700 && e.isPrimary && e.button === 0 && (e.pointerType === 'mouse' || e.pointerType === 'pen');
    function cleanup() {
      if (!drag) return; const d = drag; drag = null;
      cancelAnimationFrame(d.raf); d.ghost?.remove(); d.over?.classList.remove('drop-target'); d.src.classList.remove('drag-source');
      if (d.captured) { try { d.src.releasePointerCapture(d.pid); } catch {} }
      document.body.classList.remove('dragging');
      document.querySelectorAll('#slots .skill-slot.drop-ok').forEach(el => el.classList.remove('drop-ok'));
    }
    function cancel() { if (!drag) return; const active = drag.active; cleanup(); if (active) notice('已取消，技能未變更'); }
    function start(e) {
      const d = drag; d.active = true; document.body.classList.add('dragging'); getSelection()?.removeAllRanges();
      d.src.classList.add('drag-source');
      const img = d.src.querySelector('.buddy-portrait') || d.src, r = img.getBoundingClientRect();
      d.w = r.width; d.h = r.height; d.gx = e.clientX - r.left; d.gy = e.clientY - r.top;
      const g = document.createElement('div'); g.className = 'drag-ghost'; g.style.width = `${d.w}px`; g.style.height = `${d.h}px`;
      g.append(card.art.create(Pool.byId[d.id])); layer.append(g); d.ghost = g;
      try { d.src.setPointerCapture(d.pid); d.captured = true; } catch {}
      const s = store.state;
      document.querySelectorAll('#slots .skill-slot').forEach((el, i) => el.classList.toggle('drop-ok', i < E.slotCount(s)));
      place();
    }
    function hit(x, y) {
      const s = store.state; let found = null;
      document.querySelectorAll('#slots .skill-slot').forEach((el, i) => {
        if (i >= E.slotCount(s)) return; const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = { el, index: i };
      });
      return found;
    }
    function place() {
      const d = drag; if (!d || !d.active) return; d.raf = 0;
      d.ghost.style.translate = `${d.x - d.gx}px ${d.y - d.gy}px`;
      const sel = getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges();
      const over = hit(d.x, d.y)?.el || null;
      if (over !== d.over) { d.over?.classList.remove('drop-target'); over?.classList.add('drop-target'); d.over = over; }
    }
    $('buddies').addEventListener('pointerdown', e => {
      const b = e.target.closest('.buddy'); if (!b || !enabled(e) || drag) return;
      drag = { id: b.dataset.id, src: b, pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, active: false, raf: 0, ghost: null, over: null, captured: false };
    });
    addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return; drag.x = e.clientX; drag.y = e.clientY;
      if (!drag.active) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < THRESHOLD) return; start(e); return; }
      if (!drag.raf) drag.raf = requestAnimationFrame(place);
    });
    addEventListener('pointerup', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.active) { drag = null; return; }
      drag.x = e.clientX; drag.y = e.clientY; cancelAnimationFrame(drag.raf); drag.raf = 0; place();
      const target = hit(drag.x, drag.y), id = drag.id; suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); cleanup();
      if (!target) { notice('已取消，技能未變更'); return; }
      try {
        const next = E.equip(store.state, target.index, id, Date.now());
        if (commit(next)) { changed(); sound('upgrade'); notice(`${Pool.byId[id].name} 裝備至槽 ${target.index + 1}，等待 30 秒`); }
      } catch (err) { notice(err.message); }
    });
    addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.pid) cancel(); });
    $('buddies').addEventListener('lostpointercapture', e => { if (drag && drag.active && e.pointerId === drag.pid && drag.captured) cancel(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && drag) cancel(); });
    addEventListener('blur', () => cancel());
    addEventListener('resize', () => { if (drag && innerWidth <= 700) cancel(); });
    // 拖曳成立後衍生的 click 只吃這一次
    $('buddies').addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    return { get active() { return !!(drag && drag.active); }, cancel, get state() { return { pending: !!drag, active: !!(drag && drag.active), ghosts: layer.childElementCount, targets: document.querySelectorAll('#slots .drop-target').length }; } };
  }
  root.ClickerDrag = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
