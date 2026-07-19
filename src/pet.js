// Clawd — 桌面小夥伴 前端狀態機
// 後端（Rust）負責：游標位置事件、打字事件、視窗移動；這裡負責演戲。

const TAURI = window.__TAURI__;
const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const body = document.getElementById('body');
const zzz = document.getElementById('zzz');
const legL = document.getElementById('legL');
const legR = document.getElementById('legR');
const pawR = document.getElementById('pawR');

// 四肢旋轉（樞紐在 viewBox 座標；值沒變就不寫屬性）
const _limbCache = new Map();
function setLimb(el, deg, px, py) {
  const v = deg.toFixed(1);
  if (_limbCache.get(el) === v) return;
  _limbCache.set(el, v);
  el.setAttribute('transform', `rotate(${v} ${px} ${py})`);
}

const CENTER = { x: 81, y: 108 };        // 臉的中心（視窗 CSS 座標）
const SLEEP_AFTER_MS = 90_000;
const LINES_CLICK = ['嗨嗨！', '啾！', '今天也加油 ♪', '(=´ω`=)', '呼嚕嚕…', '☆'];
const LINES_IDLE = ['……', '♪', '在忙嗎？'];
const LINES_SAD = ['好無聊…', '陪我玩嘛', '唉…'];
const LINES_HUNGRY = ['肚子餓了…', '想吃熱狗…', '咕嚕嚕…'];
const LINES_YUM = ['好吃！', '嗷嗚～ ♥', '還要！'];

// ---------- 心情 / 飽食度 ----------
const stats = { mood: 70, fullness: 80 };
let patrolOn = false;
try {
  const s = JSON.parse(localStorage.getItem('petstats') || '{}');
  if (s.stats) Object.assign(stats, s.stats);
  patrolOn = !!s.patrol;
} catch (_) {}
function saveStats() {
  localStorage.setItem('petstats', JSON.stringify({ stats, patrol: patrolOn }));
}
function addMood(n) { stats.mood = Math.max(0, Math.min(100, stats.mood + n)); saveStats(); }

// 數值隨時間流失：每 30 秒一格；餓肚子時心情掉更快
setInterval(() => {
  stats.fullness = Math.max(0, stats.fullness - 0.4);
  stats.mood = Math.max(0, stats.mood - (stats.fullness < 30 ? 0.6 : 0.25));
  saveStats();
}, 30_000);

let lastActivity = Date.now();
let typingUntil = 0;
let dropTimer = null;
let walking = false;
let grabbed = false;
let clickThrough = true;   // 目前是否穿透（Rust 端初始為穿透）

function setState(cls, on) { stage.classList.toggle(cls, on); }
function isSleeping() { return stage.classList.contains('sleep'); }

function wake() {
  lastActivity = Date.now();
  if (isSleeping()) setState('sleep', false);
}

// ---------- 逐像素（幾何）命中判定 ----------
// 200x220 視窗、角色底部置中（顯示尺寸 142x158）：頭部橢圓 + 軀幹矩形（CSS 座標）。
function hitTest(px, py) {
  const hx = px - 102, hy = py - 107;
  if ((hx * hx) / (64 * 64) + (hy * hy) / (47 * 47) <= 1) return true;  // 頭+雙耳
  if (px >= 30 && px <= 170 && py >= 145 && py <= 218) return true;     // 軀幹
  return false;
}

// ---------- 面向（角色原圖面朝左；往右走時整隻水平翻轉） ----------
const petEl = document.getElementById('pet');
let flipped = false;
function setFacing(toRight) {
  flipped = toRight;
  petEl.classList.toggle('flip', toRight);
}

// ---------- 視線跟隨 ----------
function setGaze(dx, dy) {
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const k = Math.min(1, dist / 300);
  const fx = flipped ? -1 : 1;  // 翻轉時視線 x 軸也要跟著反
  stage.style.setProperty('--gx', `${(dx / dist) * 9 * k * fx}px`);
  stage.style.setProperty('--gy', `${(dy / dist) * 7 * k}px`);
}

// ---------- 眨眼 ----------
function scheduleBlink() {
  setTimeout(() => {
    if (!isSleeping() && !grabbed) {
      setState('blink', true);
      setTimeout(() => setState('blink', false), 130);
    }
    scheduleBlink();
  }, 2500 + Math.random() * 3500);
}

// ---------- 泡泡 ----------
let bubbleTimer = null;
function say(text, ms = 1800) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}

// ---------- 互動：點一下 / 拖曳 ----------
let pressPos = null;
let moveDebounce = null;
let grabWatchdog = null;
let dragMoved = false;
let hiTimer = null;

// 統一的「放下/解除抓取」出口：任何路徑結束抓取都走這裡，避免狀態卡死
function endGrab(bounce) {
  clearTimeout(grabWatchdog); grabWatchdog = null;
  clearTimeout(moveDebounce); moveDebounce = null;
  if (!grabbed) return;
  grabbed = false;
  pressPos = null;
  setState('grabbed', false);
  if (bounce) {
    setState('drop', true);
    setTimeout(() => setState('drop', false), 600);
  }
  wake();
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (grabbed) endGrab(false);   // 保險：上一次抓取沒正常結束就先重置
  wake();
  pressPos = { x: e.screenX, y: e.screenY };
});

stage.addEventListener('pointermove', (e) => {
  if (!pressPos || grabbed) return;
  const moved = Math.hypot(e.screenX - pressPos.x, e.screenY - pressPos.y);
  if (moved > 4 && TAURI) {
    grabbed = true;
    dragMoved = false;
    setState('grabbed', true);
    setState('drop', false);
    TAURI.window.getCurrentWindow().startDragging();
    // 看門狗：拖曳若瞬間結束（視窗從未移動），600ms 後自動解除
    clearTimeout(grabWatchdog);
    grabWatchdog = setTimeout(() => { if (grabbed && !dragMoved) endGrab(false); }, 600);
  }
});

stage.addEventListener('pointerup', () => {
  if (!grabbed && pressPos) {
    // 短按 = 摸摸打招呼（+心情）
    setState('hi', true);
    clearTimeout(hiTimer);
    hiTimer = setTimeout(() => setState('hi', false), 950);
    say(LINES_CLICK[Math.floor(Math.random() * LINES_CLICK.length)]);
    addMood(2);
  }
  pressPos = null;
});

// 右鍵 = 自訂選單（並擋掉 WebView 內建的影像選單）
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (TAURI) TAURI.core.invoke('show_menu', {
    mood: Math.round(stats.mood),
    fullness: Math.round(stats.fullness),
    patrol: patrolOn,
  });
});

// 雙擊 = 開心轉圈
stage.addEventListener('dblclick', () => {
  if (grabbed) return;
  setState('hi', false);
  setState('spin', true);
  setTimeout(() => setState('spin', false), 750);
  say('轉圈圈～');
  addMood(3);
});

// ---------- 餵食 ----------
let feeding = false;
function feed() {
  wake();
  if (feeding) return;
  if (stats.fullness > 95) { say('吃不下了啦…'); return; }
  feeding = true;
  if (isSleeping()) setState('sleep', false);
  const food = document.createElement('div');
  food.id = 'food';
  food.textContent = '🌭';
  stage.appendChild(food);
  setState('yum', true);
  setTimeout(() => {
    food.remove();
    stats.fullness = Math.min(100, stats.fullness + 25);
    addMood(10);
    say(LINES_YUM[Math.floor(Math.random() * LINES_YUM.length)]);
    setState('hi', true);
    clearTimeout(hiTimer);
    hiTimer = setTimeout(() => setState('hi', false), 950);
    setTimeout(() => { setState('yum', false); feeding = false; }, 800);
  }, 900);
}

// ---------- 巡邏模式 ----------
async function togglePatrol() {
  patrolOn = !patrolOn;
  saveStats();
  if (patrolOn) {
    try { await TAURI.core.invoke('snap_bottom'); } catch (_) {}
    say('出發巡邏！');
  } else {
    say('休息～');
  }
}

// 原生拖曳結束偵測：視窗停止移動 250ms 即視為放下
function onWindowMoved() {
  if (!grabbed) return;
  dragMoved = true;
  clearTimeout(moveDebounce);
  moveDebounce = setTimeout(() => endGrab(true), 250);
}

// ---------- 打字 → 工作模式 ----------
function onTyping() {
  wake();
  typingUntil = Date.now() + 1400;
  if (!grabbed && !walking) setState('work', true);
}

// ---------- Claude Code 連動 ----------
let claudeBusy = false;
let claudeSafety = null;
function onClaudeEvent(evt) {
  wake();
  if (evt === 'start') {
    claudeBusy = true;
    setState('work', true);
    say('Claude 開工！', 1600);
    // 保險：萬一漏接 stop，10 分鐘後自動解除
    clearTimeout(claudeSafety);
    claudeSafety = setTimeout(() => { claudeBusy = false; }, 600_000);
  } else if (evt === 'stop') {
    claudeBusy = false;
    clearTimeout(claudeSafety);
    setState('work', false);
    setState('spin', true);
    setTimeout(() => setState('spin', false), 750);
    say('搞定！✓', 2000);
    addMood(5);
  } else if (evt === 'error') {
    claudeBusy = false;
    clearTimeout(claudeSafety);
    setState('work', false);
    setState('sad', true);
    setTimeout(() => setState('sad', false), 2500);
    say('嗯…出錯了', 2000);
  }
}

// ---------- 散步 / 巡邏 ----------
// 巡邏模式：貼著工作列底邊、更頻繁更長距離地來回走
async function maybeWalk() {
  const idleFor = Date.now() - lastActivity;
  const eager = patrolOn;
  const canWalk = !grabbed && !walking && !isSleeping()
    && (eager ? idleFor > 4_000 : idleFor > 15_000)
    && Math.random() < (eager ? 0.9 : 0.5);
  if (canWalk) {
    const dist = eager ? 120 + Math.random() * 260 : 60 + Math.random() * 140;
    const dx = (Math.random() < 0.5 ? -1 : 1) * dist;
    setFacing(dx > 0);
    try {
      if (eager) { try { await TAURI.core.invoke('snap_bottom'); } catch (_) {} }
      const durationMs = await TAURI.core.invoke('walk', { dx });
      if (durationMs > 0) {
        walking = true;
        setState('walk', true);
        setGaze(dx, 20); // 看向前進方向
        setTimeout(() => {
          walking = false;
          setState('walk', false);
        }, durationMs);
      }
    } catch (_) { /* 後端拒絕（例如拖曳中）就算了 */ }
  }
  const next = patrolOn ? 6_000 + Math.random() * 9_000 : 30_000 + Math.random() * 60_000;
  setTimeout(maybeWalk, next);
}

// ---------- 常駐動畫迴圈 ----------
// 用限速 rAF 取代 CSS 無限動畫：透明視窗的每一幀都要 DWM 重新合成，
// 30fps（睡覺 15fps）比放任 CSS 跑螢幕更新率省 75% 以上的合成量。
let lastFrame = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const budget = isSleeping() ? 66 : 33;
  if (now - lastFrame < budget) return;
  lastFrame = now;
  const t = now / 1000;

  let tf = '';
  if (grabbed) {
    tf = `scale(0.96, 1.07) rotate(${3 * Math.sin((t * 2 * Math.PI) / 0.9)}deg)`;
  } else {
    const period = isSleeping() ? 5.2 : 3.4;
    const b = (Math.sin((t * 2 * Math.PI) / period) + 1) / 2; // 0..1
    let bob = 0, rot = 0;
    if (walking || stage.classList.contains('work')) {
      const s = Math.sin((t * 2 * Math.PI) / 0.55);
      bob = -5 * Math.abs(s);
      rot = 1.5 * s;
    }
    tf = `translateY(${bob + b * -1.2}px) rotate(${rot}deg) scale(${1 + b * 0.015}, ${1 + b * 0.035})`;
  }
  body.style.transform = tf;

  // 四肢：走路/打字踏步、被抓張開晃動、打招呼揮右腳掌
  let aL = 0, aR = 0, aP = 0;
  if (grabbed) {
    const s = Math.sin((t * 2 * Math.PI) / 0.9);
    aL = 8 + 3 * s; aR = -8 - 3 * s; aP = 10 * s;
  } else if (walking || stage.classList.contains('work')) {
    const s = Math.sin((t * 2 * Math.PI) / 0.4);
    aL = 17 * s; aR = -17 * s;
    aP = 13 * Math.sin((t * 2 * Math.PI) / 0.4 + 1.2);
  } else if (stage.classList.contains('hi')) {
    aP = 22 * Math.sin((t * 2 * Math.PI) / 0.3);
  }
  setLimb(legL, aL, 91, 301);
  setLimb(legR, aR, 158, 305);
  setLimb(pawR, aP, 277, 264);

  if (isSleeping()) {
    const z = (t % 2.6) / 2.6;
    zzz.style.opacity = z < 0.3 ? z / 0.3 : z > 0.7 ? (1 - z) / 0.3 : 1;
    zzz.style.transform = `translateY(${4 - 14 * z}px)`;
  } else if (zzz.style.opacity !== '0') {
    zzz.style.opacity = '0';
  }
}
requestAnimationFrame(animate);

// ---------- 主迴圈（低頻） ----------
setInterval(() => {
  const now = Date.now();
  if (stage.classList.contains('work') && now > typingUntil && !claudeBusy) setState('work', false);
  if (!isSleeping() && now - lastActivity > SLEEP_AFTER_MS && !grabbed && !walking) {
    setState('sleep', true);
    setState('work', false);
  }
}, 500);

// ---------- 後端事件 ----------
async function main() {
  if (!TAURI) {
    // 純瀏覽器預覽模式：只跑本地動畫
    scheduleBlink();
    document.addEventListener('mousemove', (e) => setGaze(e.clientX - CENTER.x, e.clientY - CENTER.y));
    return;
  }
  const win = TAURI.window.getCurrentWindow();
  const dpr = window.devicePixelRatio || 1;

  await TAURI.event.listen('cursor', ({ payload }) => {
    // payload: 游標相對視窗左上角的實體像素座標
    const cx = payload.x / dpr;
    const cy = payload.y / dpr;
    const inside = cx >= 0 && cx < 200 && cy >= 0 && cy < 220;

    // 逐像素穿透：只有壓在角色身上才攔截滑鼠
    const wantCapture = grabbed || (inside && hitTest(cx, cy));
    if (wantCapture === clickThrough) {
      clickThrough = !wantCapture;
      TAURI.core.invoke('set_click_through', { ignore: clickThrough });
    }

    if (inside) wake();
    if (!walking && !grabbed) setGaze(cx - CENTER.x, cy - CENTER.y);
  });

  await TAURI.event.listen('typing', onTyping);
  await win.onMoved(onWindowMoved);

  scheduleBlink();
  setTimeout(maybeWalk, 20_000);

  // 開場時段問候
  setTimeout(() => {
    const h = new Date().getHours();
    say(h < 5 ? '夜貓子…' : h < 11 ? '早安！' : h < 18 ? '午安～' : '晚上好！', 2200);
  }, 1500);

  // 偶爾自言自語（依心情/飢餓換台詞）
  setInterval(() => {
    if (!isSleeping() && !grabbed && Math.random() < 0.25) {
      const pool = stats.fullness < 30 ? LINES_HUNGRY : stats.mood < 35 ? LINES_SAD : LINES_IDLE;
      say(pool[Math.floor(Math.random() * pool.length)], 1400);
    }
  }, 75_000);

  // 肚子餓提醒（垂眼 + 泡泡）
  setInterval(() => {
    if (stats.fullness < 30 && !isSleeping() && !grabbed) {
      say(LINES_HUNGRY[Math.floor(Math.random() * LINES_HUNGRY.length)], 2000);
      setState('sad', true);
      setTimeout(() => setState('sad', false), 2200);
    }
  }, 50_000);

  // 選單指令（餵食 / 巡邏切換）
  await TAURI.event.listen('pet-cmd', ({ payload }) => {
    if (payload === 'feed') feed();
    else if (payload === 'patrol') togglePatrol();
  });

  // Claude Code 連動事件
  await TAURI.event.listen('claude-event', ({ payload }) => onClaudeEvent(payload));
}

main();
