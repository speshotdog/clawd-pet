// 卡面與有限 hover 共用；宿主只提供卡池與互動狀態。
window.GachaCard = (() => {
const defaultTag = (entry, dup) => (dup ? { text: '重複', cls: 'dup' } : { text: 'NEW', cls: 'new' });
// tagFor(entry, dup) → { text, cls } | null：卡面右上角的標籤由宿主決定（演示區寫「重複 +塵」，遊戲寫「2★ → 3★」）
function create({ rarity: RARITY, byId, canHover, fatal, tagFor = defaultTag }) {
// 角色 rig 資料（高度／四肢樞紐／擺幅倍率）讀共用的 character-config.js，不另抄一份
const CHAR_CFG = window.CharacterConfig || {};
const ART_SCALE = 128 / 198;   // 最高的角色（198）在 148px 高的畫框裡佔 128px

// ---------- 素材：角色從 index.html 的 <template> 拼回去 ----------
let templates = null;
const assetsReady = fetch('index.html').then((r) => r.text())
  .then(async (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    templates = {};
    doc.querySelectorAll('template[id^="char-"]').forEach((t) => {
      templates[t.id.slice(5)] = t.content.querySelector('svg');
    });
    if (!Object.keys(templates).length) throw new Error('no templates');
    // 抽取前先解碼，讓網路或首次圖片解碼不佔演出的節拍。
    const sources = new Set(['gacha-pack.png', 'gacha-cardback.jpg']);
    Object.values(byId).forEach((entry) => { if (entry.src) sources.add(entry.src); });
    Object.values(templates).forEach((svg) => svg.querySelectorAll('image').forEach((el) => {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href');
      if (href) sources.add(href);
    }));
    await Promise.all([...sources].map((src) => {
      const image = new Image(); image.src = src; return image.decode();
    }));
  })
  .catch((err) => {
    fatal.hidden = false;
    fatal.textContent = `角色素材載入失敗\n${err}`;
    throw err;
  });

function buildArt(entry) {
  if (entry.kind === 'char' && entry.src) {
    const img = document.createElement('img'); img.className = 'character-png' + (entry.bleed ? ' bleed' : '');
    img.src = entry.src; img.alt = ''; img.draggable = false; return img;
  }
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

function buildCard(entry, { dup = false, tag = true, owned = 0, veil } = {}) {
  const label = tag ? tagFor(entry, dup, owned) : null;
  const card = document.createElement('div');
  const shown = window.GachaPool.shownRarity({ entry, veil });
  card.className = `card r-${shown}${veil ? ' veiled' : ''}`;
  card.dataset.entry = entry.id;
  card.innerHTML = `
    <div class="card-glow"></div>
    <div class="card-lift"><div class="card-inner">
      <div class="card-back"><div class="back-leak"></div><div class="back-sweep"></div>${entry.rarity === 'common' ? '' : '<div class="back-motes"><i></i><i></i><i></i><i></i><i></i></div>'}</div>
      <div class="card-face">
        <div class="face-art"><div class="floor"></div></div>
        <div class="face-gem"></div>
        <div class="face-plate"><b class="face-name"></b><span class="face-rarity"></span></div>
        <div class="face-frame"></div>
        ${label ? `<div class="face-tag ${label.cls || ''}"></div>` : ''}
        <div class="face-sheen"></div>
      </div>
    </div></div>`;
  const art = card.querySelector('.face-art');
  art.appendChild(buildArt(entry));
  // 鍍膜與反光只蓋畫窗（放在立繪之後、餘燼之前）
  (entry.rarity === 'mythic' ? card.querySelector('.card-face') : art).insertAdjacentHTML('beforeend', '<div class="face-holo"></div><div class="face-glare"></div>');
  if (entry.rarity === 'mythic' || entry.rarity === 'legendary' || entry.rarity === 'epic') {
    // 活起來時畫框裡飄的餘燼／星屑（CSS 動畫，只在 .live 時顯示）
    const embers = document.createElement('div');
    embers.className = 'face-embers';
    embers.innerHTML = '<i></i>'.repeat(9);
    art.appendChild(embers);
  }
  if (label) card.querySelector('.face-tag').textContent = label.text;
  card.querySelector('.face-name').textContent = entry.name;
  card.querySelector('.face-rarity').textContent = RARITY[shown].label;
  return card;
}

// 等待由 runtime 提供，210ms 計時可隨演出取消；摘要直接切回真實色階。
async function unveil(el, { reduced = false, wait, onChange = null } = {}) {
  if (!el.classList.contains('veiled')) return;
  const entry = byId[el.dataset.entry];
  if (!reduced) el.classList.add('unveiling');
  try {
    if (!reduced) await wait(210);
    el.classList.remove('r-rare', 'veiled'); el.classList.add(`r-${entry.rarity}`);
    el.querySelector('.face-rarity').textContent = RARITY[entry.rarity].label;
    if (live.el === el) live.cfg = el.closest('.mini') ? LIVE_MINI : LIVE_CFG[entry.rarity];
    onChange?.();
    if (!reduced) await wait(210);
  } finally { el.classList.remove('unveiling'); }
}

// ---------- 動態卡面：翻開的卡指上去，像拿起來看一眼 ----------
// 卡跟著滑鼠傾斜（幅度依稀有度）、畫窗內鍍膜與反光順著角度走、立繪小幅視差；
// 入場時角色做「一次」回應（呼吸＋眨眼＋一組肢體），之後靜止。
// rAF 只在傾斜還沒收斂或入場動作未結束時跑；游標停住就停，符合本專案「閒置不跑動畫」的規矩。
const LIVE_CFG = {
  mythic: { tilt: 8, lift: 11, scale: 1.055, parallax: 3 },
  common:    { tilt: 4, lift: 8,  scale: 1.035, parallax: 1 },
  rare:      { tilt: 5, lift: 8,  scale: 1.04,  parallax: 1.5 },
  epic:      { tilt: 6, lift: 9,  scale: 1.045, parallax: 2 },
  legendary: { tilt: 7, lift: 10, scale: 1.05,  parallax: 2.5 },
};
const LIVE_MINI = { tilt: 3, lift: 2, scale: 1.025, parallax: 0 };
const ENTER_MS = 800;          // 入場動作長度
const ENTER_COOLDOWN = 1500;   // 同一張卡再入場的冷卻
const live = { el: null, entry: null, cfg: null, raf: 0, t0: 0, rx: 0, ry: 0, tx: 0, ty: 0, nx: 0, ny: 0, rig: null, lastEnter: new WeakMap() };

function liveStart(el, entry) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (live.el === el) return;
  liveEnd();
  const mini = !!el.closest('.mini');
  live.el = el; live.entry = entry; live.cfg = mini ? LIVE_MINI : LIVE_CFG[el.classList.contains('veiled') ? 'rare' : entry.rarity];
  live.t0 = performance.now();
  live.rx = live.ry = live.tx = live.ty = 0;
  const svg = el.querySelector('.face-art > svg');
  const cfg = entry.kind === 'char' ? CHAR_CFG[entry.id] : null;
  live.rig = svg && cfg ? {
    svg, cfg,
    tail: svg.querySelector('#tail'), pawR: svg.querySelector('#pawR'),
    open: svg.querySelector('#eyes-open'), closed: svg.querySelector('#eyes-closed'),
  } : { svg: null, media: el.querySelector('.face-art > img, .face-art > .emoji') };
  // 入場動作：冷卻內或圖鑑縮圖不做
  const last = live.lastEnter.get(el) || 0;
  live.enter = !mini && live.t0 - last > ENTER_COOLDOWN;
  if (live.enter) { live.lastEnter.set(el, live.t0); el.classList.add('live-enter'); }
  el.classList.add('live');
  liveWake();
}
function liveWake() {
  if (!live.el || live.raf) return;
  live.raf = requestAnimationFrame(liveFrame);
}
function liveMove(e) {
  if (!live.el) return;
  const r = live.el.getBoundingClientRect();
  live.nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
  live.ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  live.ty = live.nx * live.cfg.tilt;
  live.tx = -live.ny * live.cfg.tilt;
  live.el.style.setProperty('--mx', `${((live.nx + 1) / 2 * 100).toFixed(1)}%`);
  live.el.style.setProperty('--my', `${((live.ny + 1) / 2 * 100).toFixed(1)}%`);
  liveWake();
}
function setLimb(el, deg, pivot) {
  if (!el || !pivot) return;
  el.setAttribute('transform', `rotate(${deg.toFixed(1)} ${pivot[0]} ${pivot[1]})`);
}
function liveFrame(now) {
  live.raf = 0;
  if (!live.el) return;
  const c = live.cfg;
  live.rx += (live.tx - live.rx) * 0.16;
  live.ry += (live.ty - live.ry) * 0.16;
  live.el.querySelector('.card-lift').style.transform =
    `translateY(${-c.lift}px) scale(${c.scale}) rotateX(${live.rx.toFixed(2)}deg) rotateY(${live.ry.toFixed(2)}deg)`;
  live.el.style.setProperty('--tilt', Math.min(1, Math.hypot(live.rx, live.ry) / c.tilt).toFixed(3));
  // 入場動作進度（0..1），結束後為 1 且不再變
  const t = Math.min(1, (now - live.t0) / ENTER_MS);
  const entering = live.enter && t < 1;
  // 立繪：視差用 nx/ny 直接乘幅度；入場時疊一次呼吸
  const breath = entering ? Math.sin(t * Math.PI) : 0;
  const px = -live.nx * c.parallax, py = live.ny * c.parallax * 0.8 + breath * 2;
  const rig = live.rig;
  if (rig.svg) {
    rig.svg.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${(1 + breath * 0.008).toFixed(3)}, ${(1 - breath * 0.012).toFixed(3)})`;
    if (live.enter) {
      const cfg = rig.cfg, ls = cfg.limbScale || 1;
      const swing = Math.sin(t * Math.PI * 2) * (t < 1 ? 1 : 0);
      // 肢體只選一組：有尾巴搖尾巴，沒有才動右手
      if (rig.tail && cfg.tail) setLimb(rig.tail, 2 * swing * (cfg.tailScale || 1), cfg.tail);
      else setLimb(rig.pawR, (cfg.up || 1) * 3 * swing * ls * (cfg.pawScale || 1), cfg.pawR);
      // 眨眼：第 280ms 閉、390ms 張
      if (rig.open && rig.closed) {
        const ms = t * ENTER_MS, shut = ms >= 280 && ms < 390;
        rig.open.style.display = shut ? 'none' : '';
        rig.closed.style.display = shut ? '' : 'none';
      }
    }
  } else if (rig.media) {
    // 玩具／emoji：入場時壓一下再回正（160ms 壓、200ms 回）
    const ms = t * ENTER_MS;
    const k = live.enter ? (ms < 160 ? ms / 160 : ms < 360 ? 1 - (ms - 160) / 200 : 0) : 0;
    rig.media.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${(1 + k * 0.02).toFixed(3)}, ${(1 - k * 0.02).toFixed(3)})`;
  }
  const settled = Math.abs(live.tx - live.rx) < 0.05 && Math.abs(live.ty - live.ry) < 0.05;
  if (!settled || entering) live.raf = requestAnimationFrame(liveFrame);
}
function liveEnd() {
  if (!live.el) return;
  cancelAnimationFrame(live.raf); live.raf = 0;
  const el = live.el, rig = live.rig;
  el.classList.remove('live', 'live-enter');
  el.querySelector('.card-lift').style.transform = '';
  el.style.removeProperty('--tilt');
  if (rig.svg) {
    rig.svg.style.transform = '';
    [rig.pawR, rig.tail].forEach((g) => g?.removeAttribute('transform'));
    if (rig.open) rig.open.style.display = '';
    if (rig.closed) rig.closed.style.display = 'none';
  } else if (rig.media) rig.media.style.transform = '';
  live.el = null; live.rig = null;
}
// 桌上翻開的卡與圖鑑裡已擁有的卡都會活
function liveTarget(e) {
  const el = e.target.closest?.('.card');
  if (!el) return null;
  const mini = el.closest('.mini');
  if (mini) return mini.classList.contains('locked') ? null : el;
  return el.classList.contains('flipped') && canHover() ? el : null;
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
window.addEventListener('blur', liveEnd);
document.addEventListener('visibilitychange', () => { if (document.hidden) liveEnd(); });


return { create: buildCard, unveil, art: { create: buildArt, cfg: (id) => byId[id]?.src ? null : CHAR_CFG[id] }, ready: assetsReady, liveEnd };
}
return { create };
})();
