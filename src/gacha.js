// ClawdPet 抽卡 ─ 流程狀態機
// idle（拆包先拖曳就位）→ presenting → dealing → fanned（可翻）
//   ↳ revealing（共用揭曉鎖）↩ fanned → collecting → idle
// 幣目前無限、不接後端；抽取與收下各以一筆版本化存檔提交。
const TAURI = window.__TAURI__;
const Audio = window.GachaAudio;
const Fx = window.GachaFx;
const $ = (id) => document.getElementById(id);

const table = $('table'), zoomer = $('zoomer'), pack = $('pack'), packTilt = pack.querySelector('.pack-tilt');
const cardsEl = $('cards'), hintEl = $('hint'), collectBtn = $('collect'), dimEl = $('dim');
const dropzone = $('dropzone'), dustEl = $('dust'), dustValue = $('dust-value'), albumBtn = $('album-btn');
const albumEl = $('album'), albumBody = $('album-body'), albumProgress = $('album-progress');

// ---------- 卡池：目錄與抽樣在共用的 gacha-pool.js；這裡只補演示區自己的「塵」 ----------
const Pool = window.GachaPool;
const DUST = { common: 5, rare: 20, epic: 100, legendary: 400 };
const RARITY = Object.fromEntries(Object.entries(Pool.RARITY).map(([k, r]) => [k, { ...r, dust: DUST[k] }]));
const RARITY_ORDER = Pool.RARITY_ORDER;
const POOL = Pool.CATALOG;
const byId = Pool.byId;
// ---------- 存檔 ----------
const SAVE_KEY = 'gacha_save';
function loadSave() {
  const stored = localStorage.getItem(SAVE_KEY);
  if (stored) {
    const data = JSON.parse(stored);
    if (data.version !== 1) throw new Error('不支援的抽卡存檔版本');
    return data;
  }
  let collection = {};
  try { collection = JSON.parse(localStorage.getItem('gacha_collection') || '{}'); } catch {}
  const data = { version: 1, collection, dust: Number(localStorage.getItem('gacha_dust')) || 0,
    packs: Number(localStorage.getItem('gacha_packs')) || 0, pity: Number(localStorage.getItem('gacha_pity')) || 0, pending: null };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  // 先確定新物件落盤才移除舊鍵；中斷搬移也不會丟失原始進度。
  ['collection', 'dust', 'packs', 'pity'].forEach((key) => localStorage.removeItem('gacha_' + key));
  return data;
}
let SAVE;
try { SAVE = loadSave(); }
catch (err) { $('fatal').hidden = false; $('fatal').textContent = `抽卡存檔讀取失敗：${err.message}`; throw err; }
function save(next) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(next));
  SAVE = next;
}
// ---------- 抽卡邏輯：演示政策（17 張全池、每包保底精良、10 包必出傳說）。抽取當下就落盤 ----------
function rollPack() {
  const { draw, nextPity } = Pool.rollPack({ count: 5, policy: Pool.DEMO_POLICY, pity: SAVE.pity, collection: SAVE.collection });
  save({ ...SAVE, packs: SAVE.packs + 1, pity: nextPity, pending: draw });
  return draw;
}

// ---------- 座標與縮放 ----------
let Z = 1;
function applyZoom(z) {
  Z = z || 1;
  zoomer.style.transform = `scale(${Z})`;
}
// 桌子有 10px 木框；卡／卡包／canvas 都住在框內的 padding box，指標座標要扣掉框
const B = 10;
const pt = (e) => ({ x: e.clientX / Z - B, y: e.clientY / Z - B });
const CENTER = { x: 480, y: 330 };
const HOME = { x: 150, y: 488, rot: -8 };
const FAN = [
  { dx: -336, dy: 26, rot: -8 }, { dx: -168, dy: 7, rot: -4 }, { dx: 0, dy: 0, rot: 0 },
  { dx: 168, dy: 7, rot: 4 }, { dx: 336, dy: 26, rot: 8 },
];
const ALBUM_POINT = () => { const r = albumBtn.getBoundingClientRect(); return { x: (r.left + r.width / 2) / Z - B, y: (r.top + r.height / 2) / Z - B }; };
const DUST_POINT = () => { const r = dustEl.getBoundingClientRect(); return { x: (r.left + r.width / 2) / Z - B, y: (r.top + r.height / 2) / Z - B }; };

// ---------- 狀態 ----------
let state = 'idle';
let hand = [];          // [{entry, dup, el, x, y, flipped}]

function setState(next) {
  table.classList.remove(`state-${state}`);
  state = next;
  table.classList.add(`state-${state}`);
  $('mode-select').disabled = next !== 'idle' && next !== 'ready';
  $('reveal-all').disabled = next !== 'fanned';
}
function hint(text) {
  if (!text) { hintEl.classList.remove('on'); return; }
  hintEl.textContent = text;
  hintEl.classList.add('on');
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// ---------- 頂列數字 ----------
function renderCounters() {
  dustValue.textContent = SAVE.dust;
  const col = SAVE.collection;
  const owned = POOL.filter((e) => col[e.id] > 0).length;
  albumProgress.textContent = `${owned}/${POOL.length}`;
  $('pack-count').textContent = `已開 ${SAVE.packs} 包`;
}

// ---------- 卡包：擺放 / 拖曳 / 就位 ----------
function placePack(x, y, rot = 0, scale = 1) {
  pack.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
}
function packHome(popIn = false) {
  pack.classList.remove('tearing', 'burst', 'gone', 'grabbed', 'snap');
  packTilt.style.transform = '';
  if (popIn) {
    pack.style.transition = 'none';
    placePack(HOME.x, HOME.y - 60, HOME.rot, 0.4);
    void pack.offsetWidth;
    pack.style.transition = '';
    Audio.drop();
  }
  placePack(HOME.x, HOME.y, HOME.rot, 1);
}

let drag = null;   // { ox, oy, lastX, lastY, lastT, vx, vy, moved }
pack.addEventListener('pointerdown', (e) => {
  if (modeName === 'rip') return;
  if (e.button !== 0) return;
  Audio.ensure();
  if (state !== 'idle' && state !== 'ready') return;
  const p = pt(e);
  const rect = pack.getBoundingClientRect();
  const cx = (rect.left + rect.width / 2) / Z - B, cy = (rect.top + rect.height / 2) / Z - B;
  drag = { ox: cx - p.x, oy: cy - p.y, lastX: p.x, lastY: p.y, lastT: performance.now(), vx: 0, vy: 0, moved: false, from: state };
  pack.setPointerCapture(e.pointerId);
});
pack.addEventListener('pointermove', (e) => {
  if (modeName === 'rip') return;
  const p = pt(e);
  if (!drag) {
    // 就位後：卡包朝滑鼠方向微傾，像真的擺在你面前
    if (state === 'ready' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const dx = (p.x - CENTER.x) / 64, dy = (p.y - CENTER.y) / 115;
      packTilt.style.transform = `rotateY(${dx * 9}deg) rotateX(${-dy * 9}deg)`;
    }
    return;
  }
  const dist = Math.hypot(p.x - drag.lastX, p.y - drag.lastY);
  if (!drag.moved) {
    if (dist < 4) return;
    drag.moved = true;
    pack.classList.add('grabbed');
    table.classList.add('dragging');
    setState('dragging');
    Audio.pick();
  }
  const now = performance.now();
  const dt = Math.max(1, now - drag.lastT);
  drag.vx = drag.vx * 0.6 + ((p.x - drag.lastX) / dt) * 1000 * 0.4;
  drag.vy = drag.vy * 0.6 + ((p.y - drag.lastY) / dt) * 1000 * 0.4;
  drag.lastX = p.x; drag.lastY = p.y; drag.lastT = now;
  const x = p.x + drag.ox, y = p.y + drag.oy;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tiltY = reduced ? 0 : Math.max(-22, Math.min(22, drag.vx * 0.03));
  const tiltX = reduced ? 0 : Math.max(-18, Math.min(18, -drag.vy * 0.03));
  placePack(x, y, tiltY * 0.35, 1.04);
  packTilt.style.transform = `rotateY(${tiltY}deg) rotateX(${tiltX}deg)`;
  const hot = Math.hypot(x - CENTER.x, y - CENTER.y) < 120;
  dropzone.classList.toggle('hot', hot);
});
pack.addEventListener('lostpointercapture', () => { if (drag) endDrag(); });
pack.addEventListener('pointerup', () => { if (drag) endDrag(); });
function endDrag() {
  const d = drag; drag = null;
  pack.classList.remove('grabbed');
  table.classList.remove('dragging');
  packTilt.style.transform = '';
  if (!d.moved) {
    // 沒拖只點：idle → 提醒；ready → 撕
    if (d.from === 'ready') { tear(); return; }
    hint('把卡包拖到桌子中央');
    pack.classList.add('snap');
    placePack(HOME.x, HOME.y, HOME.rot + 4, 1);
    setTimeout(() => placePack(HOME.x, HOME.y, HOME.rot, 1), 120);
    return;
  }
  const hot = dropzone.classList.contains('hot');
  dropzone.classList.remove('hot');
  pack.classList.add('snap');
  if (hot) {
    placePack(CENTER.x, CENTER.y, 0, 1);
    setState('ready');
    Audio.lock();
    hint('點一下，撕開');
  } else {
    placePack(HOME.x, HOME.y, HOME.rot, 1);
    setState('idle');
    setTimeout(() => Audio.drop(), 300);
    hint('拖到桌子中央');
  }
}

// ---------- 模式入口：抽取先落盤，演出只讀固定結果 ----------
const modeSelect = $('mode-select'), launchBtn = $('launch'), skipBtn = $('skip');
const allBtn = $('reveal-all'), autoSelect = $('reveal-policy'), modeRoot = $('mode-root');
let modeName = window.GachaModes[localStorage.getItem('gacha_mode')] ? localStorage.getItem('gacha_mode') : 'hearthstone';
let runtime = null, modeInstance = null, currentDraw = null, assetsLoaded = false;
let entryDispose = null;
const revealedKeys = new Set();
const cardAdapter = window.GachaCard.create({ rarity: RARITY, byId,
  tagFor: (entry, dup) => dup ? { text: `重複 +${RARITY[entry.rarity].dust} 塵`, cls: 'dup' } : { text: 'NEW', cls: 'new' },
  canHover: () => state === 'fanned', fatal: $('fatal') });
const buildCard = cardAdapter.create, liveEnd = cardAdapter.liveEnd;
const assetsReady = cardAdapter.ready;
modeSelect.value = modeName;
function renderEntry() {
  entryDispose?.(); entryDispose = null;
  const hearthstone = modeName === 'hearthstone';
  const rip = modeName === 'rip';
  pack.hidden = !hearthstone && !rip;
  $('tray').hidden = !hearthstone; dropzone.hidden = !hearthstone;
  launchBtn.hidden = hearthstone || rip; launchBtn.disabled = !assetsLoaded;
  launchBtn.textContent = { wish: '投遞一包 · 五張', summon: '蓋下腳印 · 召喚', stage: '拉開布幕 · 登場' }[modeName] || '';
  autoSelect.hidden = hearthstone || rip; autoSelect.disabled = false;   // 收下後總覽把它鎖住，回到入口要解開
  pack.style.pointerEvents = assetsLoaded ? '' : 'none';
  if (rip) {
    placePack(470, 310);
    if (assetsLoaded && !SAVE.pending) entryDispose = window.GachaModes.rip.mountEntry(pack, { audio: Audio.createScope(), start: startDraw });
  }
  hint(assetsLoaded ? ({ hearthstone: '拖到桌子中央', wish: '投遞一包，看看流星帶來誰', summon: '蓋下腳印，呼喚五位夥伴', stage: '拉開布幕，看看誰會走上舞台', rip: '沿封口從左拖到右，放手撕開' }[modeName]) : '素材載入中');
}
function summary() {
  setState('fanned'); collectBtn.classList.add('on');
  skipBtn.hidden = true; allBtn.hidden = true; autoSelect.disabled = true; hint('');
}
function makeRuntime(draw) {
  runtime?.stop(); modeInstance?.dispose();
  cardsEl.replaceChildren(); hand = []; revealedKeys.clear();
  currentDraw = draw;
  modeRoot.className = `mode-root mode-${modeName}`;
  runtime = window.GachaModeRuntime.create({
    root: modeRoot, size: { width: 940, height: 620 }, center: modeName === 'hearthstone' ? CENTER : { x: 470, y: 310 },
    cardsEl, dim: dimEl, card: cardAdapter, mode: modeName,
    layout(i, count) {
      if (count === 1) return { x: 470, y: 310, rot: 0 };
      if (count === 10) return { x: 142 + i % 5 * 164, y: i < 5 ? 218 : 416, rot: 0, scale: .82 };
      const f = FAN[i]; return { x: CENTER.x + f.dx, y: CENTER.y + f.dy, rot: f.rot };
    },
    state: setState, isFanned: () => state === 'fanned', isAuto: () => autoSelect.value === 'auto',
    onCards(cards) { hand = cards; },
    onReveal(key) { revealedKeys.add(key); },
    interactive() { allBtn.hidden = false; hint('逐張翻開，或全部翻開'); },
    summary, error(err) { console.error(err); skipPresentation(); },
    shake(soft = false) {
      const cls = soft ? 'shake-soft' : 'shake';
      table.classList.remove('shake', 'shake-soft'); void table.offsetWidth;
      table.classList.add(cls); table.addEventListener('animationend', () => table.classList.remove(cls), { once: true });
    },
    flash() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); },
    charging(on) { table.classList.toggle('charging-mode', on); },
  }, draw);
  return runtime;
}
function skipPresentation() {
  if (!runtime || !SAVE.pending || state === 'collecting') return;
  modeInstance?.skip(); runtime.skip(); pack.hidden = true; launchBtn.hidden = true;
}
async function startDraw() {
  if (!assetsLoaded || SAVE.pending || (state !== 'idle' && state !== 'ready')) return;
  liveEnd(); setState('presenting'); hint('');
  let draw;
  try { draw = rollPack(); }
  catch (err) { setState(modeName === 'hearthstone' ? 'ready' : 'idle'); hint(`抽取未存入：${err.message}`); return; }
  const run = makeRuntime(draw);
  entryDispose?.(); entryDispose = null;
  if (modeName === 'hearthstone') {
    const visualPack = pack.cloneNode(true); visualPack.removeAttribute('id');
    visualPack.classList.remove('snap'); visualPack.querySelector('.pack-tilt').style.transform = '';
    modeRoot.append(visualPack);
  }
  pack.hidden = true; launchBtn.hidden = true;
  collectBtn.classList.remove('on'); autoSelect.disabled = false;
  renderCounters();
  modeInstance = window.GachaModes[modeName].create(run.ctx);
  run.run(run.ctx.wait(200).then(() => { if (state !== 'collecting') skipBtn.hidden = false; }));
  run.run(modeInstance.open(draw));
}
function tear() { if (state === 'ready') startDraw(); }
launchBtn.addEventListener('click', startDraw);
skipBtn.addEventListener('click', skipPresentation);
allBtn.addEventListener('click', () => { if (modeName !== 'hearthstone') autoSelect.value = 'auto'; runtime?.all(); });
autoSelect.addEventListener('change', () => { if (autoSelect.value === 'auto' && state === 'fanned') runtime?.all(); });
modeSelect.addEventListener('change', async () => {
  if (state !== 'idle' && state !== 'ready') { modeSelect.value = modeName; return; }
  liveEnd(); runtime?.stop(); modeInstance?.dispose();
  entryDispose?.(); entryDispose = null;
  const next = modeSelect.value, outgoing = modeName === 'hearthstone' || modeName === 'rip' ? pack : launchBtn;
  // 尚未抽取的入口可直接換掉，180ms 內只做淡出入，拖包座標不另算。
  setState('presenting');
  const fadeOut = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 90, fill: 'forwards' });
  await fadeOut.finished;
  modeName = next;
  try { localStorage.setItem('gacha_mode', modeName); } catch {}
  packHome(false); renderEntry(); fadeOut.cancel();
  const incoming = modeName === 'hearthstone' || modeName === 'rip' ? pack : launchBtn;
  const fadeIn = incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90 });
  await fadeIn.finished; fadeIn.cancel(); setState('idle');
});

// ---------- 收下 ----------
collectBtn.addEventListener('click', async () => {
  if (state !== 'fanned' || !currentDraw || SAVE.pending?.id !== currentDraw.id || revealedKeys.size !== currentDraw.entries.length) return;
  liveEnd();
  setState('collecting');
  collectBtn.classList.remove('on');
  // 先落帳，再演動畫；動畫只是把數字「跳」到已經存好的值
  const col = { ...SAVE.collection };
  let dustGain = 0;
  for (const c of hand) {
    if (c.dup) dustGain += RARITY[c.entry.rarity].dust;
    col[c.entry.id] = (col[c.entry.id] || 0) + 1;
  }
  justCollected.clear();
  hand.filter((c) => !c.dup).forEach((c) => justCollected.add(c.entry.id));
  const dustBefore = SAVE.dust;
  try { save({ ...SAVE, collection: col, dust: dustBefore + dustGain, pending: null }); }
  catch (err) { summary(); hint(`收下未存入：${err.message}`); return; }
  runtime?.stop(); modeInstance?.dispose();
  Audio.collect(hand.length);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await wait(150); cardsEl.replaceChildren(); hand = []; currentDraw = null;
    renderCounters(); setState('idle'); packHome(false); renderEntry(); return;
  }
  let shownDust = dustBefore;

  const album = ALBUM_POINT();
  const dustP = DUST_POINT();
  const dups = hand.filter((c) => c.dup).length;
  let dupIdx = 0;
  hand.forEach((c, i) => {
    setTimeout(() => {
      if (c.dup) {
        // 重複 → 化塵：卡碎成金粉飛向塵計數器，到站時數字才跳
        const gain = RARITY[c.entry.rarity].dust;
        const myIdx = dupIdx++;
        c.el.classList.add('dusting');
        Audio.dust();
        Fx.dustStream(c.x, c.y, dustP.x, dustP.y, {
          n: 34 + Math.min(40, gain / 6),
          onArrive(k, n) {
            const target = dustBefore + hand.filter((h) => h.dup).slice(0, myIdx + 1).reduce((s, h) => s + RARITY[h.entry.rarity].dust, 0);
            const prev = shownDust;
            shownDust = Math.max(shownDust, Math.round(target - gain + (gain * k) / n));
            if (shownDust !== prev) { dustValue.textContent = shownDust; Audio.tick(k); }
            if (k === n) { dustEl.classList.remove('bump'); void dustEl.offsetWidth; dustEl.classList.add('bump'); }
          },
        });
      } else {
        // 新卡 → 飛進圖鑑
        c.el.classList.add('flying');
        c.el.style.transform = `translate(${album.x}px, ${album.y}px) rotate(${(i - 2) * 25}deg) scale(.12)`;
        setTimeout(() => {
          Fx.puff(album.x, album.y);
          albumBtn.classList.remove('bump'); void albumBtn.offsetWidth; albumBtn.classList.add('bump');
          renderCounters();
        }, 480);
      }
    }, i * 110);
  });
  await wait(hand.length * 110 + (dups ? 1500 : 700));
  dustValue.textContent = SAVE.dust;
  renderCounters();
  cardsEl.replaceChildren();
  hand = [];
  setState('idle');
  packHome(modeName === 'hearthstone');
  currentDraw = null;
  renderEntry();
});

// ---------- 圖鑑 ----------
function renderAlbum() {
  const col = SAVE.collection;
  albumBody.replaceChildren();
  const owned = POOL.filter((e) => col[e.id] > 0).length;
  $('album-sub').textContent = `${owned} / ${POOL.length} 張 ・ 塵 ${SAVE.dust} ・ 已開 ${SAVE.packs} 包`;
  for (const r of RARITY_ORDER) {
    const entries = POOL.filter((e) => e.rarity === r);
    const sec = document.createElement('section');
    sec.className = 'album-section';
    sec.style.setProperty('--sc', `var(--c-${r})`);
    const got = entries.filter((e) => col[e.id] > 0).length;
    sec.innerHTML = `<h3>${RARITY[r].label}<small>${got}/${entries.length}</small></h3><div class="album-grid"></div>`;
    const grid = sec.querySelector('.album-grid');
    for (const e of entries) {
      const mini = document.createElement('div');
      const n = col[e.id] || 0;
      mini.className = `mini${n ? '' : ' locked'}${hand.length === 0 && justCollected.has(e.id) ? ' just' : ''}`;
      mini.appendChild(buildCard(e, { tag: false }));
      if (n) { const b = document.createElement('b'); b.className = 'count'; b.textContent = `×${n}`; mini.appendChild(b); }
      grid.appendChild(mini);
    }
    albumBody.appendChild(sec);
  }
  justCollected.clear();   // 「剛收到」的光圈只在下一次打開圖鑑時亮一次
}
const justCollected = new Set();
albumBtn.addEventListener('click', async () => {
  Audio.ui();
  await assetsReady;
  renderAlbum();
  albumEl.hidden = false;
});
$('album-close').addEventListener('click', () => { Audio.ui(); liveEnd(); albumEl.hidden = true; disarmReset(); });
let resetArmed = null;
function disarmReset() {
  clearTimeout(resetArmed); resetArmed = null;
  $('album-reset').classList.remove('confirming');
  $('album-reset').textContent = '重置';
}
$('album-reset').addEventListener('click', () => {
  Audio.ui();
  if (!resetArmed) {
    $('album-reset').classList.add('confirming');
    $('album-reset').textContent = '再按一次清空';
    resetArmed = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  if (SAVE.pending || state === 'collecting') { hint('請先收下本批結果再重置'); return; }
  save({ version: 1, collection: {}, dust: 0, packs: 0, pity: 0, pending: null });
  renderCounters();
  renderAlbum();
});

// ---------- 視窗：關閉 / 拖曳 / 縮放 ----------
async function closeWindow() {
  liveEnd(); skipPresentation();
  await TAURI?.core.invoke('close_gacha_window').catch(() => {});
}
$('close').addEventListener('click', closeWindow);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!albumEl.hidden) { albumEl.hidden = true; return; } closeWindow(); }
});
$('topbar').addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('button, .dust, select, option, input, label')) return;
  TAURI?.window.getCurrentWindow().startDragging().catch(() => {});
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerdown', () => Audio.ensure(), { once: true });

function fitWindow() {
  TAURI?.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {});
}

async function main() {
  Fx.init($('fx'), $('fx-under'));
  renderCounters();
  packHome(false);
  renderEntry();
  await assetsReady; assetsLoaded = true; renderEntry();
  if (SAVE.pending) {
    setState('presenting');
    makeRuntime(SAVE.pending).skip(); pack.hidden = true; launchBtn.hidden = true;
  }
  if (!TAURI) return;
  const z = await TAURI.core.invoke('get_gacha_zoom').catch(() => 1);
  applyZoom(z);
  fitWindow();
  setTimeout(fitWindow, 600);
  await TAURI.window.getCurrentWindow().listen('gacha-zoom', ({ payload }) => { applyZoom(payload); fitWindow(); });
}
main().catch((err) => { $('fatal').hidden = false; $('fatal').textContent = `抽卡初始化失敗：${err.message}`; });
document.addEventListener('visibilitychange', () => { if (document.hidden) skipPresentation(); });
window.addEventListener('pagehide', () => { liveEnd(); entryDispose?.(); runtime?.stop(); modeInstance?.dispose(); });
