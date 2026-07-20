// Clawd — 桌面小夥伴 前端狀態機
// 後端（Rust）負責：游標位置事件、打字事件、視窗移動；這裡負責演戲。

const TAURI = window.__TAURI__;
const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const workbar = document.getElementById('workbar');
const workfill = document.getElementById('workfill');
const workcount = document.getElementById('workcount');
const sweat = document.getElementById('sweat');
const zzz = document.getElementById('zzz');

// ---------- 角色系統：從 template 實例化選定角色 ----------
// 每個角色是一個 <template>，內含同一套結構 id（pet/body/face/legL/legR/pawR/眼睛組），
// 一次只實例化一隻，所以 id 不會衝突；可選部件（tail/earL/earR）有就會動。
const CHAR_CFG = {
  dog: {
    // 兩角色「頭頂（頭皮，不算耳朵）」等高：都落在 CSS y=57
    height: 161,                             // CSS 顯示高度
    limbScale: 1,                            // 四肢擺幅倍率
    center: { x: 81, y: 106 },              // 臉的中心（視窗 CSS 座標）
    legL: [91, 301], legR: [158, 305], pawR: [277, 264],  // 四肢樞紐（viewBox 座標）
    up: -1,                                  // pawR 舉起的旋轉方向（SVG 順時針為正）
    hit(px, py) {
      const hx = px - 102, hy = py - 105;
      if ((hx * hx) / (65 * 65) + (hy * hy) / (48 * 48) <= 1) return true;  // 頭+雙耳
      if (px >= 29 && px <= 171 && py >= 144 && py <= 218) return true;     // 軀幹
      return false;
    },
  },
  fox: {
    // viewBox 61 94 495 467（原圖 635x618 的子窗）；頭皮鞍部 y=152 → 高度 184 時頭頂在 CSS y=57
    height: 184,
    limbScale: 0.55,   // 部件切割縫較淺，擺幅縮小避免毛刺
    center: { x: 103, y: 112 },
    legL: [258, 503], legR: [368, 503], pawR: [246, 400],
    tail: [441, 443],
    up: -1,
    hit(px, py) {
      const hx = px - 104, hy = py - 90;
      if ((hx * hx) / (52 * 52) + (hy * hy) / (48 * 48) <= 1) return true;  // 頭+雙耳
      if (px >= 54 && px <= 193 && py >= 139 && py <= 216) return true;     // 裙+尾巴
      return false;
    },
  },
};
// 除錯日誌：打到後端寫進 %TEMP%\clawd-debug.log
const jlog = (m) => { try { fetch('http://127.0.0.1:17872/pet/log/' + encodeURIComponent(m)).catch(() => {}); } catch (_) {} };
window.onerror = (msg, src, line) => jlog(`ERROR ${msg} @${line}`);
window.onunhandledrejection = (e) => jlog(`REJECT ${e.reason}`);

// 夥伴視窗由 URL query 指定角色（?char=fox）；主視窗看 localStorage
const _urlChar = new URLSearchParams(location.search).get('char');
const IS_COMPANION = !!_urlChar;
const MY_LABEL = IS_COMPANION ? 'pet2' : 'main';
const CHAR = _urlChar || localStorage.getItem('petchar') || 'dog';
const CFG = CHAR_CFG[CHAR] || CHAR_CFG.dog;
const otherChar = (c) => (c === 'dog' ? 'fox' : 'dog');
const multiOn = () => localStorage.getItem('petmulti') === '1';
{
  const tpl = document.getElementById('char-' + CHAR) || document.getElementById('char-dog');
  stage.appendChild(tpl.content.cloneNode(true));
  document.getElementById('pet').style.height = CFG.height + 'px';
}
const body = document.getElementById('body');
const legL = document.getElementById('legL');
const legR = document.getElementById('legR');
const pawR = document.getElementById('pawR');
const tailEl = document.getElementById('tail');    // 可選（狐）
const earLEl = document.getElementById('earL');    // 可選（狐）
const earREl = document.getElementById('earR');    // 可選（狐）

// 四肢旋轉（樞紐在 viewBox 座標；值沒變就不寫屬性）
const _limbCache = new Map();
function setLimb(el, deg, px, py) {
  const v = deg.toFixed(1);
  if (_limbCache.get(el) === v) return;
  _limbCache.set(el, v);
  el.setAttribute('transform', `rotate(${v} ${px} ${py})`);
}

const CENTER = CFG.center;
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
// （多人模式下 stats 共用 localStorage，只讓主視窗扣，避免雙倍衰減）
if (!IS_COMPANION) {
  setInterval(() => {
    stats.fullness = Math.max(0, stats.fullness - 0.4);
    stats.mood = Math.max(0, stats.mood - (stats.fullness < 30 ? 0.6 : 0.25));
    saveStats();
  }, 30_000);
}

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
  if (isSleeping()) {
    setState('sleep', false);
    // 剛睡醒伸個懶腰（瞇眼、拉長身體、抬手）
    if (!grabbed && !walking) {
      setState('stretch', true);
      setTimeout(() => setState('stretch', false), 1150);
    }
  }
}

// ---------- 逐像素（幾何）命中判定：依角色設定 ----------
const hitTest = CFG.hit;

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

// ---------- 耳朵抖動（有耳朵部件的角色才會動） ----------
let earTwitch = 0;   // -1 左耳、1 右耳、0 無
function scheduleEarTwitch() {
  setTimeout(() => {
    if (earLEl && !isSleeping() && !grabbed) {
      earTwitch = Math.random() < 0.5 ? -1 : 1;
      setTimeout(() => { earTwitch = 0; }, 260);
    }
    scheduleEarTwitch();
  }, 5000 + Math.random() * 8000);
}
scheduleEarTwitch();

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
    // 落地後偶爾抖抖毛
    if (Math.random() < 0.4) {
      setTimeout(() => {
        setState('shake', true);
        setTimeout(() => setState('shake', false), 520);
      }, 620);
    }
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
  // 座標用「相對視窗的實體像素」傳給後端錨定選單位置——
  // 預設的游標定位在多螢幕+DPI疊乘環境會開到畫面外，變成隱形模態選單卡死主執行緒
  const dpr = window.devicePixelRatio || 1;
  if (TAURI) TAURI.core.invoke('show_menu', {
    mood: Math.round(stats.mood),
    fullness: Math.round(stats.fullness),
    patrol: patrolOn,
    character: CHAR,
    multi: multiOn(),
    x: e.clientX * dpr,
    y: e.clientY * dpr,
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

// ---------- Claude 工作進度條（偽進度：快起步、漸進逼近 95%，stop 時補滿） ----------
let barProgress = 0;
let barHideTimer = null;
function barShow() {
  clearTimeout(barHideTimer);
  barProgress = 0;
  workfill.classList.remove('done');
  workfill.style.width = '0%';
  workbar.classList.add('show');
}
function barFinish(ok) {
  if (!workbar.classList.contains('show')) return;
  barProgress = 1;
  workfill.style.width = '100%';
  if (ok) workfill.classList.add('done');
  clearTimeout(barHideTimer);
  barHideTimer = setTimeout(() => workbar.classList.remove('show'), 800);
}

// ---------- Claude Code 連動（多工計數：每個 session 的 start/stop 各記一筆） ----------
let claudeCount = 0;
let claudeStartAt = 0;   // 第一件工作開始的時間（冒汗判定用）
let claudeSafety = null;
const claudeBusy = () => claudeCount > 0;

function updateWorkCount() {
  if (claudeCount >= 2) {
    workcount.textContent = '×' + claudeCount;
    workcount.classList.add('show');
  } else {
    workcount.classList.remove('show');
  }
}

function claudeAllDone(ok) {
  claudeCount = 0;
  claudeStartAt = 0;
  clearTimeout(claudeSafety);
  updateWorkCount();
  sweat.classList.remove('show');
  setState('work', false);
  barFinish(ok);
}

function onClaudeEvent(evt) {
  wake();
  if (evt === 'start') {
    claudeCount += 1;
    if (claudeCount === 1) {
      claudeStartAt = Date.now();
      barShow();
      say('Claude 開工！', 1600);
    } else {
      say(`同時 ${claudeCount} 件工作！`, 1600);
    }
    setState('work', true);
    updateWorkCount();
    // 保險：萬一漏接 stop，最後一次 start 後 10 分鐘自動全部解除
    clearTimeout(claudeSafety);
    claudeSafety = setTimeout(() => claudeAllDone(true), 600_000);
  } else if (evt === 'stop') {
    claudeCount = Math.max(0, claudeCount - 1);
    if (claudeCount === 0) {
      claudeAllDone(true);
      setState('spin', true);
      setTimeout(() => setState('spin', false), 750);
      say('搞定！✓', 2000);
      addMood(5);
    } else {
      updateWorkCount();
      say(`完成一件！剩 ${claudeCount} 件`, 1500);
    }
  } else if (evt === 'wait') {
    // Claude 停在權限確認等你按——舉手提醒（保持工作狀態，回合還沒結束）
    setState('ask', true);
    setTimeout(() => setState('ask', false), 4000);
    say('需要你確認一下！', 4000);
  } else if (evt === 'error') {
    claudeCount = Math.max(0, claudeCount - 1);
    if (claudeCount === 0) {
      claudeAllDone(false);
    } else {
      updateWorkCount();
    }
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
// T_OFFSET：多人模式下兩個視窗同秒起跑會導致呼吸/彈跳/搖尾完全同相，
// 各自加一個隨機相位讓動作錯開
const T_OFFSET = Math.random() * 7;
let lastFrame = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const budget = isSleeping() ? 66 : 33;
  if (now - lastFrame < budget) return;
  lastFrame = now;
  const t = now / 1000 + T_OFFSET;

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
    // 擺幅 13°：存根平切邊的直角掃出量壓在輪廓線厚度內（17° 會露出膝蓋尖角）
    const s = Math.sin((t * 2 * Math.PI) / 0.4);
    aL = 13 * s; aR = -13 * s;
    aP = 11 * Math.sin((t * 2 * Math.PI) / 0.4 + 1.2);
  } else if (stage.classList.contains('ask')) {
    aP = CFG.up * (26 + 3 * Math.sin((t * 2 * Math.PI) / 0.7));  // 舉手（微晃）等你確認
  } else if (stage.classList.contains('yum')) {
    const s = Math.sin((t * 2 * Math.PI) / 0.22);
    aL = 7 * s; aR = -7 * s;   // 吃飯開心踏踏
  } else if (stage.classList.contains('stretch')) {
    aL = -7; aR = 7; aP = CFG.up * 16;  // 伸懶腰：腿撐開、手掌抬起
  } else if (stage.classList.contains('hi')) {
    aP = 22 * Math.sin((t * 2 * Math.PI) / 0.3);
  }
  // 依角色縮放擺幅（切割縫淺的角色擺小一點，避免露出接縫）
  aL *= CFG.limbScale; aR *= CFG.limbScale; aP *= CFG.limbScale;
  setLimb(legL, aL, ...CFG.legL);
  setLimb(legR, aR, ...CFG.legR);
  setLimb(pawR, aP, ...CFG.pawR);

  // 可選部件（狐）：尾巴——閒置慢搖、走路/工作快搖、開心猛搖
  if (tailEl) {
    let aT = 1.5 * Math.sin((t * 2 * Math.PI) / 2.8);
    if (walking || stage.classList.contains('work')) aT = 3 * Math.sin((t * 2 * Math.PI) / 0.5);
    if (stage.classList.contains('hi') || stage.classList.contains('yum') || stage.classList.contains('spin')) {
      aT = 5 * Math.sin((t * 2 * Math.PI) / 0.25);
    }
    setLimb(tailEl, aT, ...CFG.tail);
  }
  // 可選部件（狐）：耳朵偶爾抖一下
  if (earLEl && CFG.earL) {
    setLimb(earLEl, earTwitch === -1 ? -9 * Math.sin((t * 2 * Math.PI) / 0.26) : 0, ...CFG.earL);
    setLimb(earREl, earTwitch === 1 ? 9 * Math.sin((t * 2 * Math.PI) / 0.26) : 0, ...CFG.earR);
  }

  // Claude 進度條：偽進度逼近 95%＋斜紋流動（只在顯示時動，不加閒置成本）
  if (claudeBusy() && workbar.classList.contains('show')) {
    barProgress += (0.95 - barProgress) * 0.008;
    workfill.style.width = `${(barProgress * 100).toFixed(1)}%`;
    workfill.style.backgroundPosition = `${((t * 22) % 14.6).toFixed(1)}px 0`;
  }

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
  if (stage.classList.contains('work') && now > typingUntil && !claudeBusy()) setState('work', false);
  if (!isSleeping() && now - lastActivity > SLEEP_AFTER_MS && !grabbed && !walking) {
    setState('sleep', true);
    setState('work', false);
  }
  // 長任務冒汗：連續工作超過 30 秒
  sweat.classList.toggle('show', claudeBusy() && claudeStartAt > 0 && now - claudeStartAt > 30_000);
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

  // 視窗適配：把真實 devicePixelRatio 回報給後端，讓實體視窗剛好裝下
  // 200x220 CSS。後端的 GetDpiForWindow 只看得到「顯示縮放」，量不到
  // Windows「文字大小」的疊乘（例：150%×125% = dpr 1.875），會裁切角色。
  function fitWindow() {
    TAURI.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {});
  }
  // dpr 改變（拖到不同縮放的螢幕、改系統設定）就重新適配
  function watchDpr() {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener('change', () => { fitWindow(); watchDpr(); }, { once: true });
  }
  fitWindow();
  watchDpr();

  // 多人模式：開機還原夥伴視窗（只有主視窗負責；換角色重載後也走這裡換角）
  if (!IS_COMPANION && multiOn()) {
    TAURI.core.invoke('set_companion', { on: true, character: otherChar(CHAR) }).catch(() => {});
  }

  await TAURI.event.listen('cursor', ({ payload }) => {
    // 事件實際上是廣播；只吃標給自己視窗的座標（吃到別窗的會導致穿透狂切）
    if (payload.w && payload.w !== MY_LABEL) return;
    // payload: 游標相對視窗左上角的實體像素座標（dpr 即時讀，避免適配後失準）
    const dpr = window.devicePixelRatio || 1;
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
  setTimeout(maybeWalk, 12_000 + Math.random() * 18_000);  // 錯開首次散步

  // 開場時段問候
  setTimeout(() => {
    const h = new Date().getHours();
    say(h < 5 ? '夜貓子…' : h < 11 ? '早安！' : h < 18 ? '午安～' : '晚上好！', 2200);
  }, 1500);

  // 偶爾自言自語（依心情/飢餓換台詞；週期加抖動避免多人模式同時開口）
  setInterval(() => {
    if (!isSleeping() && !grabbed && Math.random() < 0.25) {
      const pool = stats.fullness < 30 ? LINES_HUNGRY : stats.mood < 35 ? LINES_SAD : LINES_IDLE;
      say(pool[Math.floor(Math.random() * pool.length)], 1400);
    }
  }, 70_000 + Math.random() * 20_000);

  // 肚子餓提醒（垂眼 + 泡泡）
  setInterval(() => {
    if (stats.fullness < 30 && !isSleeping() && !grabbed) {
      say(LINES_HUNGRY[Math.floor(Math.random() * LINES_HUNGRY.length)], 2000);
      setState('sad', true);
      setTimeout(() => setState('sad', false), 2200);
    }
  }, 50_000);

  jlog(`main() listeners phase char=${CHAR} companion=${IS_COMPANION}`);

  // 選單指令。格式「label:指令」——事件實際上是廣播，只執行標給自己的
  await TAURI.event.listen('pet-cmd', ({ payload }) => {
    if (typeof payload !== 'string') return;
    const sep = payload.indexOf(':');
    if (sep < 0) return;
    const tgt = payload.slice(0, sep);
    const cmd = payload.slice(sep + 1);
    jlog(`pet-cmd ${payload} -> ${tgt === MY_LABEL ? 'act' : 'skip'}`);
    if (tgt !== MY_LABEL) return;
    if (cmd === 'feed') feed();
    else if (cmd === 'patrol') togglePatrol();
    else if (cmd === 'multi' && !IS_COMPANION) {
      // 多人模式開關：夥伴視窗的角色永遠是主角色的「另一位」
      const on = !multiOn();
      localStorage.setItem('petmulti', on ? '1' : '0');
      TAURI.core.invoke('set_companion', { on, character: otherChar(CHAR) }).catch(() => {});
      say(on ? '夥伴來了！' : '夥伴回家了～', 1800);
    }
    else if (cmd.startsWith('char:')) {
      const next = cmd.slice(5);
      if (next !== CHAR && CHAR_CFG[next]) {
        localStorage.setItem('petchar', next);
        location.reload();   // 重載以乾淨狀態實例化新角色（夥伴由重載後的開機檢查換角）
      }
    }
  });

  // Claude Code 連動事件
  await TAURI.event.listen('claude-event', ({ payload }) => onClaudeEvent(payload));
  jlog('main() complete, all listeners registered');
}

main();
