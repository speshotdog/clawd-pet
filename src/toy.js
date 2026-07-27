// Clawd — 玩具前端（小恐龍／黃色球／皮球，由 ?toy= 決定）
// 物理全在 Rust 執行緒跑，這裡只：回報 dpr、點擊穿透、拖曳、依 toy-state 演動畫。

const TAURI = window.__TAURI__;
const stage = document.getElementById('stage');
const toy = document.getElementById('toy');
const shadow = document.getElementById('toyshadow');
const TOY_ID = new URLSearchParams(location.search).get('toy') || 'dino';
const MY_LABEL = 'toy_' + TOY_ID;

// 玩具素材表：w/h 是實機 CSS 尺寸。球類的尺寸 = PSD px × 0.3336（與寵物同一把尺，
// 以熱狗狗狗的描邊粗細錨定），所以球擺在角色旁邊大小才對得起來。
// round=true 的用圓形命中判定（方形 bbox 對圓球太貪心，會擋到旁邊的點擊）。
const TOY_ART = {
  dino:       { img: 'toy-dino.png',       w: 120,   h: 71 },
  ballyellow: { img: 'toy-ballyellow.png', w: 109.4, h: 89.7, round: true },
  beachball:  { img: 'toy-beachball.png',  w: 94.7,  h: 94.7, round: true },
};
const ART = TOY_ART[TOY_ID] || TOY_ART.dino;
toy.src = ART.img;
toy.style.width = ART.w + 'px';
shadow.style.width = Math.round(ART.w * 0.83) + 'px';   // 恐龍原本寫死 100 = 120 × 0.83

// ---------- 視窗適配：回報真實 devicePixelRatio（fit_window 依 label 撐成 150x120） ----------
function fitWindow() {
  if (TAURI) TAURI.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {});
}
function watchDpr() {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', () => { fitWindow(); watchDpr(); }, { once: true });
}

// ---------- 點擊穿透：游標壓在玩具上才攔截（不用逐像素） ----------
// 玩具置中於 150x120 視窗、底留 2px，命中框由 ART 尺寸推出（外擴 1px 容差）
let clickThrough = true;
const BBOX = {
  x0: (150 - ART.w) / 2 - 1,
  y0: 118 - ART.h - 1,
  x1: (150 + ART.w) / 2 + 1,
  y1: 119,
};
function hitTest(cx, cy) {
  if (cx < BBOX.x0 || cx > BBOX.x1 || cy < BBOX.y0 || cy > BBOX.y1) return false;
  if (!ART.round) return true;
  // 圓球：以外接橢圓判定，落在四角的點擊照樣穿透
  const nx = (cx - 75) / (ART.w / 2);
  const ny = (cy - (118 - ART.h / 2)) / (ART.h / 2);
  return nx * nx + ny * ny <= 1;
}

// ---------- 拖曳（比照 pet.js 的看門狗模式） ----------
let grabbed = false;
let pressPos = null;
let grabWatchdog = null;
let moveDebounce = null;
let dragMoved = false;

function endGrab() {
  clearTimeout(grabWatchdog); grabWatchdog = null;
  clearTimeout(moveDebounce); moveDebounce = null;
  if (!grabbed) return;
  grabbed = false;
  stage.classList.remove('grabbed');
  if (TAURI) TAURI.core.invoke('toy_grab', { grabbed: false }).catch(() => {});
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (grabbed) endGrab();
  pressPos = { x: e.screenX, y: e.screenY };
});

stage.addEventListener('pointermove', (e) => {
  if (!pressPos || grabbed || !TAURI) return;
  const moved = Math.hypot(e.screenX - pressPos.x, e.screenY - pressPos.y);
  if (moved > 4) {
    grabbed = true;
    dragMoved = false;
    stage.classList.add('grabbed');
    TAURI.core.invoke('toy_grab', { grabbed: true }).catch(() => {});
    TAURI.window.getCurrentWindow().startDragging();
    // 看門狗：拖曳若瞬間結束（視窗從未移動），600ms 後自動解除
    clearTimeout(grabWatchdog);
    grabWatchdog = setTimeout(() => { if (grabbed && !dragMoved) endGrab(); }, 600);
  }
});

stage.addEventListener('pointerup', () => { pressPos = null; });

// 原生拖曳結束偵測：視窗停止移動 250ms 即視為放下
function onWindowMoved() {
  if (!grabbed) return;
  dragMoved = true;
  clearTimeout(moveDebounce);
  moveDebounce = setTimeout(endGrab, 250);
}

// 右鍵 = 收起玩具選單（並擋掉 WebView 內建影像選單）
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const dpr = window.devicePixelRatio || 1;
  if (TAURI) TAURI.core.invoke('toy_menu', { x: e.clientX * dpr, y: e.clientY * dpr }).catch(() => {});
});

// ---------- 動畫：依 Rust 的 toy-state 事件演戲 ----------
// 飛行時輕微翻滾擺動（±20° wobble，不整圈滾）、落地瞬間 squash、地面滾動小幅前後傾。
// 30fps rAF；靜止（落地不動）時停止寫 DOM 省合成。
let phys = { airborne: false, vx: 0, vy: 0 };
let prevAirborne = false;
let rafOn = false;
let lastFrame = 0;
let squashUntil = 0;
// 面向：原圖朝左（1）；被往右踢（vx>0）就水平翻轉（-1），靜止後保持最後面向
let facing = 1;

function applyIdle() {
  toy.style.transform = `translateX(-50%) scaleX(${facing})`;
  shadow.style.transform = 'translateX(-50%)';
}

function frame(now) {
  if (!rafOn) return;
  requestAnimationFrame(frame);
  if (now - lastFrame < 33) return;   // ~30fps
  lastFrame = now;
  const t = now / 1000;

  if (Math.abs(phys.vx) > 10) facing = phys.vx > 0 ? -1 : 1;
  let tf = `translateX(-50%) scaleX(${facing})`;
  const speed = Math.min(1, (Math.abs(phys.vx) + Math.abs(phys.vy)) / 900);
  if (phys.airborne) {
    // 飛行翻滾擺動：往速度方向偏，幅度隨速度（±20° 上限）
    const dir = phys.vx >= 0 ? 1 : -1;
    const wob = 20 * Math.sin(t * (7 + 9 * speed)) * (0.45 + 0.55 * speed);
    tf += ` rotate(${(wob * dir).toFixed(1)}deg)`;
  } else if (Math.abs(phys.vx) > 1) {
    // 地面滾動：小幅前後傾
    const roll = Math.min(1, Math.abs(phys.vx) / 300);
    const tilt = 8 * roll * Math.sin(t * 13);
    tf += ` rotate(${tilt.toFixed(1)}deg)`;
  }
  // 落地瞬間 squash（160ms 內衰減）
  if (now < squashUntil) {
    const k = (squashUntil - now) / 160;
    tf += ` scale(${(1 + 0.18 * k).toFixed(3)}, ${(1 - 0.18 * k).toFixed(3)})`;
  }
  toy.style.transform = tf;

  // 陰影：飛越高越淡越小（用 vy 上升量粗估）
  if (phys.airborne) {
    const lift = Math.min(1, Math.abs(phys.vy) / 700);
    shadow.style.opacity = (0.9 - 0.5 * lift).toFixed(2);
    shadow.style.transform = `translateX(-50%) scale(${(1 - 0.25 * lift).toFixed(2)})`;
  } else {
    shadow.style.opacity = '1';
    shadow.style.transform = 'translateX(-50%)';
  }

  // 靜止且 squash 播完 → 停迴圈
  if (!phys.airborne && Math.abs(phys.vx) <= 1 && now >= squashUntil) {
    rafOn = false;
    applyIdle();
  }
}

function ensureRaf() {
  if (!rafOn) { rafOn = true; lastFrame = 0; requestAnimationFrame(frame); }
}

// ---------- 啟動 ----------
async function main() {
  if (!TAURI) return;   // 純瀏覽器預覽：靜態顯示
  const win = TAURI.window.getCurrentWindow();
  fitWindow();
  watchDpr();
  // dpr 在載入初期可能還是舊值，matchMedia 若在註冊前就變化會漏接 → 補幾次冪等適配
  setTimeout(fitWindow, 600);
  setTimeout(fitWindow, 2000);

  // 游標穿透：只有壓在恐龍身上（或拖曳中）才攔截滑鼠
  await TAURI.event.listen('cursor', ({ payload }) => {
    if (payload.w && payload.w !== MY_LABEL) return;
    const dpr = window.devicePixelRatio || 1;
    const cx = payload.x / dpr;
    const cy = payload.y / dpr;
    const inside = cx >= 0 && cx < 150 && cy >= 0 && cy < 120;
    const wantCapture = grabbed || (inside && hitTest(cx, cy));
    if (wantCapture === clickThrough) {
      clickThrough = !wantCapture;
      TAURI.core.invoke('set_click_through', { ignore: clickThrough });
    }
  });

  // 物理狀態 → 動畫
  await TAURI.event.listen('toy-state', ({ payload }) => {
    if (!payload) return;
    const wasAir = prevAirborne;
    phys = { airborne: !!payload.airborne, vx: payload.vx || 0, vy: payload.vy || 0 };
    if (wasAir && !phys.airborne) squashUntil = performance.now() + 160;  // 落地瞬間
    prevAirborne = phys.airborne;
    if (phys.airborne || Math.abs(phys.vx) > 1 || squashUntil > performance.now()) ensureRaf();
  });

  await win.onMoved(onWindowMoved);
  applyIdle();
}

main();
