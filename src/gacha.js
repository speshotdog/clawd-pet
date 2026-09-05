// ClawdPet 抽卡 ─ 流程狀態機
// idle（卡包在托盤）→ dragging → ready（就位）→ tearing → dealing → fanned（可翻）
//   ↳ charging（傳說蓄力）↩ fanned → collecting → idle
// 幣目前無限、不接後端；圖鑑與塵存 localStorage（gacha_*）。
const TAURI = window.__TAURI__;
const Audio = window.GachaAudio;
const Fx = window.GachaFx;
const $ = (id) => document.getElementById(id);

const table = $('table'), zoomer = $('zoomer'), pack = $('pack'), packTilt = pack.querySelector('.pack-tilt');
const cardsEl = $('cards'), hintEl = $('hint'), collectBtn = $('collect'), dimEl = $('dim'), flashEl = $('flash');
const dropzone = $('dropzone'), dustEl = $('dust'), dustValue = $('dust-value'), albumBtn = $('album-btn');
const albumEl = $('album'), albumBody = $('album-body'), albumProgress = $('album-progress');

// ---------- 卡池（id / 顯示名照 menu.js 的 CHARACTERS 與 TOYS） ----------
const RARITY = {
  common:    { label: '普通', dust: 5,   weight: 60 },
  rare:      { label: '精良', dust: 20,  weight: 27 },
  epic:      { label: '史詩', dust: 100, weight: 10 },
  legendary: { label: '傳說', dust: 400, weight: 3 },
};
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];
const POOL = [
  { id: 'zhenmu',     name: '珍母',        rarity: 'legendary', kind: 'char' },
  { id: 'jiaobu',     name: '膠布（原版）', rarity: 'legendary', kind: 'char' },
  { id: 'yueyue',     name: '玥玥（原版）', rarity: 'legendary', kind: 'char' },
  { id: 'zhenzhen',   name: '珍珍（原版）', rarity: 'legendary', kind: 'char' },
  { id: 'dog',        name: '熱狗狗狗',    rarity: 'epic', kind: 'char' },
  { id: 'fox',        name: '女僕狐狐',    rarity: 'epic', kind: 'char' },
  { id: 'jiaobu2',    name: '膠布',        rarity: 'epic', kind: 'char' },
  { id: 'zhenzhen2',  name: '珍珍',        rarity: 'epic', kind: 'char' },
  { id: 'yueyue2',    name: '玥玥',        rarity: 'rare', kind: 'char' },
  { id: 'caihua',     name: '采華',        rarity: 'rare', kind: 'char' },
  { id: 'lk',         name: 'ㄌㄎ',        rarity: 'rare', kind: 'char' },
  { id: 'yang',       name: '羊咩',        rarity: 'rare', kind: 'char' },
  { id: 'dino',       name: '小恐龍',      rarity: 'common', kind: 'toy', src: 'toy-dino.png', w: 120 },
  { id: 'ballyellow', name: '黃色球',      rarity: 'common', kind: 'toy', src: 'toy-ballyellow.png', w: 109.4 },
  { id: 'beachball',  name: '皮球',        rarity: 'common', kind: 'toy', src: 'toy-beachball.png', w: 94.7 },
  { id: 'hotdog',     name: '熱狗',        rarity: 'common', kind: 'emoji', glyph: '🌭' },
  { id: 'heart',      name: '愛心',        rarity: 'common', kind: 'emoji', glyph: '♥', color: '#e8473a' },
];
const byId = Object.fromEntries(POOL.map((e) => [e.id, e]));
// 角色 rig 資料（高度／四肢樞紐／擺幅倍率）直接從 pet.js 的 CHAR_CFG 讀，不另抄一份
let CHAR_CFG = {};
const ART_SCALE = 128 / 198;   // 最高的角色（198）在 148px 高的畫框裡佔 128px

// ---------- 存檔 ----------
const SAVE = {
  get collection() { try { return JSON.parse(localStorage.getItem('gacha_collection') || '{}'); } catch { return {}; } },
  set collection(v) { localStorage.setItem('gacha_collection', JSON.stringify(v)); },
  get dust() { return Number(localStorage.getItem('gacha_dust')) || 0; },
  set dust(v) { localStorage.setItem('gacha_dust', String(Math.max(0, Math.round(v)))); },
  get packs() { return Number(localStorage.getItem('gacha_packs')) || 0; },
  set packs(v) { localStorage.setItem('gacha_packs', String(v)); },
  get pity() { return Number(localStorage.getItem('gacha_pity')) || 0; },
  set pity(v) { localStorage.setItem('gacha_pity', String(v)); },
};
const PITY_PACKS = 10;   // 連續 10 包沒傳說，第 10 包必出

// ---------- 抽卡邏輯 ----------
function rollRarity(minRarity = null) {
  let pool = Object.entries(RARITY);
  if (minRarity) {
    const min = RARITY_ORDER.indexOf(minRarity);
    pool = pool.filter(([k]) => RARITY_ORDER.indexOf(k) <= min);
  }
  const total = pool.reduce((s, [, r]) => s + r.weight, 0);
  let x = Math.random() * total;
  for (const [k, r] of pool) { x -= r.weight; if (x < 0) return k; }
  return pool[pool.length - 1][0];
}
function pick(rarity) {
  const list = POOL.filter((e) => e.rarity === rarity);
  return list[Math.floor(Math.random() * list.length)];
}
function rollPack() {
  const rarities = Array.from({ length: 5 }, () => rollRarity());
  const rank = (r) => RARITY_ORDER.indexOf(r);
  // 保底一：每包至少一張精良以上
  if (!rarities.some((r) => rank(r) <= rank('rare'))) {
    rarities[Math.floor(Math.random() * 5)] = rollRarity('rare');
  }
  // 保底二：連續 PITY_PACKS 包沒傳說就塞一張
  const pity = SAVE.pity + 1;
  if (!rarities.includes('legendary') && pity >= PITY_PACKS) {
    rarities[Math.floor(Math.random() * 5)] = 'legendary';
  }
  SAVE.pity = rarities.includes('legendary') ? 0 : pity;
  SAVE.packs = SAVE.packs + 1;
  // 同一包裡重複兩張同卡時，第二張算重複
  const seen = new Set(Object.keys(SAVE.collection).filter((k) => SAVE.collection[k] > 0));
  return rarities.map((r) => {
    const entry = pick(r);
    const dup = seen.has(entry.id);
    seen.add(entry.id);
    return { entry, dup };
  });
}

// ---------- 素材：角色從 index.html 的 <template> 拼回去 ----------
let templates = null;
const assetsReady = Promise.all([fetch('index.html').then((r) => r.text()), fetch('pet.js').then((r) => r.text())])
  .then(([html, js]) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    templates = {};
    doc.querySelectorAll('template[id^="char-"]').forEach((t) => {
      templates[t.id.slice(5)] = t.content.querySelector('svg');
    });
    if (!Object.keys(templates).length) throw new Error('no templates');
    // pet.js 是 classic script，CHAR_CFG 是頂層 const 物件字面量：切出來當運算式求值
    const m = js.match(/const CHAR_CFG = (\{[\s\S]*?\n\});/);
    if (m) CHAR_CFG = new Function('return ' + m[1])();
  })
  .catch((err) => {
    $('fatal').hidden = false;
    $('fatal').textContent = `角色素材載入失敗\n${err}`;
  });

function buildArt(entry) {
  if (entry.kind === 'char') {
    const src = templates?.[entry.id];
    if (!src) return document.createElement('span');
    const svg = document.importNode(src, true);
    svg.removeAttribute('id');
    svg.querySelector('#shadow')?.remove();
    // 只留睜眼；happy/closed 在 pet.css 靠 stage class 切換，這裡沒有那套
    ['eyes-happy', 'eyes-closed'].forEach((k) => { const g = svg.querySelector('#' + k); if (g) g.style.display = 'none'; });
    svg.style.height = `${(CHAR_CFG[entry.id]?.height || 170) * ART_SCALE}px`;
    svg.style.width = 'auto';
    svg.style.overflow = 'visible';
    svg.style.marginBottom = '10px';
    svg.style.filter = 'drop-shadow(0 6px 4px rgba(0,0,0,.45))';
    return svg;
  }
  if (entry.kind === 'toy') {
    const img = document.createElement('img');
    img.src = entry.src; img.alt = ''; img.draggable = false;
    img.style.width = `${entry.w * ART_SCALE}px`;
    img.style.marginBottom = '16px';
    img.style.filter = 'drop-shadow(0 6px 4px rgba(0,0,0,.45))';
    return img;
  }
  const span = document.createElement('span');
  span.className = 'emoji';
  span.textContent = entry.glyph;
  if (entry.color) span.style.color = entry.color;
  return span;
}

function buildCard(entry, { dup = false, tag = true } = {}) {
  const card = document.createElement('div');
  card.className = `card r-${entry.rarity}`;
  card.dataset.entry = entry.id;
  card.innerHTML = `
    <div class="card-glow"></div>
    <div class="card-lift"><div class="card-inner">
      <div class="card-back"><div class="back-leak"></div></div>
      <div class="card-face">
        <div class="face-art"><div class="floor"></div></div>
        <div class="face-gem"></div>
        <div class="face-plate"><b class="face-name"></b><span class="face-rarity"></span></div>
        <div class="face-frame"></div>
        ${tag ? `<div class="face-tag ${dup ? 'dup' : 'new'}">${dup ? `重複 +${RARITY[entry.rarity].dust} 塵` : 'NEW'}</div>` : ''}
        <div class="face-sheen"></div>
      </div>
    </div></div>`;
  const art = card.querySelector('.face-art');
  art.appendChild(buildArt(entry));
  if (entry.rarity === 'legendary' || entry.rarity === 'epic') {
    // 活起來時畫框裡飄的餘燼／星屑（CSS 動畫，只在 .live 時顯示）
    const embers = document.createElement('div');
    embers.className = 'face-embers';
    embers.innerHTML = '<i></i>'.repeat(9);
    art.appendChild(embers);
  }
  card.querySelector('.face-name').textContent = entry.name;
  card.querySelector('.face-rarity').textContent = RARITY[entry.rarity].label;
  return card;
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
let flippedCount = 0;

function setState(next) {
  table.classList.remove(`state-${state}`);
  state = next;
  table.classList.add(`state-${state}`);
}
function hint(text) {
  if (!text) { hintEl.classList.remove('on'); return; }
  hintEl.textContent = text;
  hintEl.classList.add('on');
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function shake(soft = false) {
  const cls = soft ? 'shake-soft' : 'shake';
  table.classList.remove('shake', 'shake-soft');
  void table.offsetWidth;   // 重新觸發 animation
  table.classList.add(cls);
  table.addEventListener('animationend', () => table.classList.remove(cls), { once: true });
}

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
  const p = pt(e);
  if (!drag) {
    // 就位後：卡包朝滑鼠方向微傾，像真的擺在你面前
    if (state === 'ready') {
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
  const tiltY = Math.max(-22, Math.min(22, drag.vx * 0.03));
  const tiltX = Math.max(-18, Math.min(18, -drag.vy * 0.03));
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

// ---------- 撕包 → 發牌 ----------
async function tear() {
  if (state !== 'ready') return;
  setState('tearing');
  hint('');
  pack.classList.remove('snap');
  packTilt.style.transform = '';
  pack.classList.add('tearing');
  Audio.tear();
  await wait(430);
  pack.classList.add('burst');
  flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on');
  Audio.burst();
  Fx.packBurst(CENTER.x, CENTER.y);
  shake();
  await wait(140);
  await assetsReady;
  deal();
  await wait(500);
  pack.classList.add('gone');
  placePack(CENTER.x, CENTER.y, 0, 0.001);
}

function deal() {
  setState('dealing');
  cardsEl.replaceChildren();
  flippedCount = 0;
  hand = rollPack().map(({ entry, dup }, i) => {
    const el = buildCard(entry, { dup });
    const f = FAN[i];
    const x = CENTER.x + f.dx, y = CENTER.y + f.dy;
    el.dataset.idx = i;
    cardsEl.appendChild(el);
    return { entry, dup, el, x, y, rot: f.rot, flipped: false };
  });
  // 由中央往外依序甩出去；每張間隔一小拍
  hand.forEach((c, i) => {
    setTimeout(() => {
      c.el.classList.add('dealt');
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg)`;
      Audio.deal(i);
    }, 80 + i * 95);
  });
  setTimeout(() => {
    setState('fanned');
    hint('靠近看看，翻開它');
  }, 80 + 5 * 95 + 500);
}

// ---------- 翻卡 ----------
const hoverCooldown = new WeakMap();
cardsEl.addEventListener('pointerover', (e) => {
  const el = e.target.closest('.card');
  if (!el || el.classList.contains('flipped') || state !== 'fanned') return;
  if (e.relatedTarget && el.contains(e.relatedTarget)) return;   // 卡內部子元素間移動不算
  const t = performance.now();
  if ((hoverCooldown.get(el) || 0) > t) return;
  hoverCooldown.set(el, t + 400);
  Audio.hover(hand[el.dataset.idx].entry.rarity);
});
cardsEl.addEventListener('click', (e) => {
  const el = e.target.closest('.card');
  if (!el || state !== 'fanned') return;
  const c = hand[el.dataset.idx];
  if (!c || c.flipped) return;
  if (c.entry.rarity === 'legendary') revealLegendary(c);
  else flip(c);
});

async function flip(c) {
  c.flipped = true;
  const r = c.entry.rarity;
  Audio.flip();
  c.el.classList.add('flipped');
  await wait(290);   // 翻到一半、卡面剛露出來的瞬間才是「揭曉」
  Audio.reveal(r);
  Fx.reveal(c.x, c.y - 6, r);
  c.el.classList.add('reveal-pop');
  if (r === 'epic') shake(true);
  afterFlip();
}

// 傳說：先讓你知道「來了」——桌子壓暗、卡在抖、射線從背後升起、蓄力音在漲——
// 故意拖半拍，再翻、再震、再敲鐘。
async function revealLegendary(c) {
  c.flipped = true;
  setState('charging');
  hint('');
  c.el.classList.add('charging');
  dimEl.classList.add('on');
  const rays = Fx.rays(c.x, c.y - 10, { fadeIn: 0.6 });
  Audio.charge(1.05);
  await wait(560);
  c.el.classList.add('hard');
  await wait(520);
  c.el.classList.remove('charging', 'hard');
  Audio.flip();
  c.el.classList.add('flipped');
  await wait(270);
  shake();
  Audio.reveal('legendary');
  Fx.reveal(c.x, c.y - 6, 'legendary');
  c.el.classList.add('reveal-pop');
  await wait(900);
  dimEl.classList.remove('on');
  rays.stop(1.4);
  setState('fanned');
  afterFlip();
}

function afterFlip() {
  flippedCount++;
  if (flippedCount < hand.length) return;
  setTimeout(() => {
    if (state !== 'fanned') return;
    collectBtn.classList.add('on');
    hint('');
  }, 450);
}

// ---------- 動態卡面：翻開的卡指上去就活起來 ----------
// 卡跟著滑鼠 3D 傾斜、卡面鍍膜順著角度走光、立繪視差＋本尊 rig 的閒置動作
// （呼吸、踏腳、尾巴、眨眼——樞紐和擺幅倍率都是 pet.js 那一套）。離開就慢慢躺回去。
const TILT = { common: 7, rare: 10, epic: 12, legendary: 14 };
const live = { el: null, entry: null, raf: 0, t0: 0, rx: 0, ry: 0, tx: 0, ty: 0, rig: null, blinkAt: 0, blinking: false };

function liveStart(el, entry) {
  if (live.el === el) return;
  liveEnd();
  live.el = el; live.entry = entry; live.t0 = performance.now();
  live.rx = live.ry = live.tx = live.ty = 0;
  live.blinkAt = live.t0 + 900 + Math.random() * 1800;
  const svg = el.querySelector('.face-art > svg');
  const cfg = entry.kind === 'char' ? CHAR_CFG[entry.id] : null;
  live.rig = svg && cfg ? {
    svg, cfg,
    legL: svg.querySelector('#legL'), legR: svg.querySelector('#legR'), pawR: svg.querySelector('#pawR'),
    tail: svg.querySelector('#tail'),
    open: svg.querySelector('#eyes-open'), closed: svg.querySelector('#eyes-closed'),
  } : { svg: null, media: el.querySelector('.face-art > img, .face-art > .emoji') };
  el.classList.add('live');
  live.raf = requestAnimationFrame(liveFrame);
}
function liveMove(e) {
  if (!live.el) return;
  const r = live.el.getBoundingClientRect();
  const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  const k = TILT[live.entry.rarity] || 8;
  live.ty = nx * k;
  live.tx = -ny * k;
  live.el.style.setProperty('--mx', `${((nx + 1) / 2 * 100).toFixed(1)}%`);
  live.el.style.setProperty('--my', `${((ny + 1) / 2 * 100).toFixed(1)}%`);
}
function setLimb(el, deg, pivot) {
  if (!el || !pivot) return;
  el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${pivot[0]} ${pivot[1]})`);
}
function liveFrame(now) {
  if (!live.el) return;
  const t = (now - live.t0) / 1000;
  live.rx += (live.tx - live.rx) * 0.14;
  live.ry += (live.ty - live.ry) * 0.14;
  live.el.querySelector('.card-lift').style.transform =
    `translateY(-10px) scale(1.09) rotateX(${live.rx.toFixed(2)}deg) rotateY(${live.ry.toFixed(2)}deg)`;
  // 鍍膜亮度：卡越斜、光越亮（正面看是霧的）
  live.el.style.setProperty('--tilt', Math.min(1, Math.hypot(live.rx, live.ry) / 12).toFixed(3));
  // 立繪視差：往傾斜的反方向偏，像浮在畫框前面；再疊一層呼吸
  const breath = Math.sin(t * 2 * Math.PI / 2.4);
  const px = -live.ry * 0.55, py = live.rx * 0.45 + breath * 2;
  const rig = live.rig;
  if (rig.svg) {
    rig.svg.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${(1 + breath * 0.008).toFixed(3)}, ${(1 - breath * 0.012).toFixed(3)})`;
    const cfg = rig.cfg, ls = cfg.limbScale || 1;
    // 閒置踏腳：慢慢左右換重心；手臂偶爾晃；尾巴慢搖
    const s = Math.sin(t * 2 * Math.PI / 1.6);
    setLimb(rig.legL, 5 * s * ls, cfg.legL);
    setLimb(rig.legR, -5 * s * ls, cfg.legR);
    setLimb(rig.pawR, (cfg.up || 1) * 4 * Math.sin(t * 2 * Math.PI / 1.1 + 0.8) * ls * (cfg.pawScale || 1), cfg.pawR);
    if (rig.tail && cfg.tail) setLimb(rig.tail, 3 * Math.sin(t * 2 * Math.PI / 1.3) * (cfg.tailScale || 1), cfg.tail);
    // 眨眼：隨機間隔，閉 110ms
    if (rig.open && rig.closed) {
      if (!live.blinking && now >= live.blinkAt) {
        live.blinking = true; rig.open.style.display = 'none'; rig.closed.style.display = '';
        live.blinkAt = now + 110;
      } else if (live.blinking && now >= live.blinkAt) {
        live.blinking = false; rig.open.style.display = ''; rig.closed.style.display = 'none';
        live.blinkAt = now + 1600 + Math.random() * 2600;
      }
    }
  } else if (rig.media) {
    // 玩具／emoji：輕輕彈跳＋左右晃
    const b = Math.abs(Math.sin(t * 2 * Math.PI / 1.1));
    rig.media.style.transform = `translate(${px.toFixed(1)}px, ${(py - b * 6).toFixed(1)}px) rotate(${(Math.sin(t * 2 * Math.PI / 2.2) * 4).toFixed(1)}deg) scale(${(1 + b * 0.03).toFixed(3)}, ${(1 - b * 0.03).toFixed(3)})`;
  }
  live.raf = requestAnimationFrame(liveFrame);
}
function liveEnd() {
  if (!live.el) return;
  cancelAnimationFrame(live.raf);
  const el = live.el, rig = live.rig;
  el.classList.remove('live');
  el.querySelector('.card-lift').style.transform = '';
  el.style.removeProperty('--tilt');
  if (rig.svg) {
    rig.svg.style.transform = '';
    [rig.legL, rig.legR, rig.pawR, rig.tail].forEach((g) => g?.removeAttribute('transform'));
    if (rig.open) rig.open.style.display = '';
    if (rig.closed) rig.closed.style.display = 'none';
  } else if (rig.media) rig.media.style.transform = '';
  live.el = null; live.rig = null; live.blinking = false;
}
// 桌上翻開的卡與圖鑑裡已擁有的卡都會活
function liveTarget(e) {
  const el = e.target.closest?.('.card');
  if (!el) return null;
  const mini = el.closest('.mini');
  if (mini) return mini.classList.contains('locked') ? null : el;
  return el.classList.contains('flipped') && state === 'fanned' ? el : null;
}
document.addEventListener('pointerover', (e) => {
  const el = liveTarget(e);
  if (!el) return;
  const entry = byId[el.dataset.entry];
  if (entry) { liveStart(el, entry); liveMove(e); }
});
document.addEventListener('pointermove', (e) => { if (live.el) liveMove(e); });
document.addEventListener('pointerout', (e) => {
  if (live.el && !live.el.contains(e.relatedTarget)) liveEnd();
});

// ---------- 收下 ----------
collectBtn.addEventListener('click', async () => {
  if (state !== 'fanned' || flippedCount < hand.length) return;
  liveEnd();
  setState('collecting');
  collectBtn.classList.remove('on');
  Audio.collect(hand.length);
  // 先落帳，再演動畫；動畫只是把數字「跳」到已經存好的值
  const col = SAVE.collection;
  let dustGain = 0;
  for (const c of hand) {
    if (c.dup) dustGain += RARITY[c.entry.rarity].dust;
    col[c.entry.id] = (col[c.entry.id] || 0) + 1;
  }
  SAVE.collection = col;
  justCollected.clear();
  hand.filter((c) => !c.dup).forEach((c) => justCollected.add(c.entry.id));
  const dustBefore = SAVE.dust;
  SAVE.dust = dustBefore + dustGain;
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
  packHome(true);
  hint('拖到桌子中央');
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
  ['gacha_collection', 'gacha_dust', 'gacha_packs', 'gacha_pity'].forEach((k) => localStorage.removeItem(k));
  renderCounters();
  renderAlbum();
});

// ---------- 視窗：關閉 / 拖曳 / 縮放 ----------
async function closeWindow() {
  await TAURI?.core.invoke('close_gacha_window').catch(() => {});
}
$('close').addEventListener('click', closeWindow);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!albumEl.hidden) { albumEl.hidden = true; return; } closeWindow(); }
});
$('topbar').addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('button, .dust')) return;
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
  hint('拖到桌子中央');
  if (!TAURI) return;
  const z = await TAURI.core.invoke('get_gacha_zoom').catch(() => 1);
  applyZoom(z);
  fitWindow();
  setTimeout(fitWindow, 600);
  await TAURI.window.getCurrentWindow().listen('gacha-zoom', ({ payload }) => { applyZoom(payload); fitWindow(); });
}
main();
