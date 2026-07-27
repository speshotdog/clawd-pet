// Clawd — 桌面小夥伴 前端狀態機
// 後端（Rust）負責：游標位置事件、打字事件、視窗移動；這裡負責演戲。

const TAURI = window.__TAURI__;
const Pure = window.ClawdPure;      // pure.js：無 DOM 依賴的邏輯，node --test 跑同一份
const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const workbar = document.getElementById('workbar');
const workfill = document.getElementById('workfill');
const workcount = document.getElementById('workcount');
const sweat = document.getElementById('sweat');
const zzz = document.getElementById('zzz');

// 寵物縮放倍率（localStorage: petscale，浮點字串）。所有寵物視窗共用同一 origin
// 的 localStorage，主視窗改完 reload、開機還原重建夥伴時大家一起套用。
// 非法值（NaN、超界）夾回 [0.5, 2]，讀不到時 fallback 1.0（標準）。
const SCALE = Pure.clampScale(localStorage.getItem('petscale'));

// ---------- 角色系統：從 template 實例化選定角色 ----------
// 每個角色是一個 <template>，內含同一套結構 id（pet/body/face/legL/legR/pawR/眼睛組），
// 一次只實例化一隻，所以 id 不會衝突；可選部件（tail/earL/earR）有就會動。
// hit：逐像素命中範圍，六個角色都是「頭部橢圓 ∪ 軀幹方框」，只換座標
// （ellipse: [cx, cy, rx, ry]、box: [x0, x1, y0, y1]，皆為 stage CSS 座標）。
const CHAR_CFG = {
  dog: {
    // 兩角色「頭頂（頭皮，不算耳朵）」等高：都落在 CSS y=93
    height: 161,                             // CSS 顯示高度
    limbScale: 1,                            // 四肢擺幅倍率
    center: { x: 101, y: 142 },             // 臉的中心（視窗 CSS 座標）
    legL: [91, 301], legR: [158, 305], pawR: [277, 264],  // 四肢樞紐（viewBox 座標）
    up: -1,                                  // pawR 舉起的旋轉方向（SVG 順時針為正）
    sleepShift: '8px',
    sleep: [{ img: 'dog-sleep.png', h: 90.7 }],
    hit: { ellipse: [122, 141, 65, 48], box: [49, 191, 180, 254] },  // 頭+雙耳 / 軀幹
  },
  fox: {
    // viewBox 61 94 495 467（原圖 635x618 的子窗）；頭皮鞍部 y=152 → 高度 184 時頭頂在 CSS y=93
    height: 184,
    limbScale: 0.55,   // 部件切割縫較淺，擺幅縮小避免毛刺
    center: { x: 123, y: 148 },
    legL: [258, 503], legR: [368, 503], pawR: [246, 400],
    tail: [441, 443],
    up: -1,
    sleepShift: '-6px',
    sleep: [{ img: 'fox-sleep.png', h: 103.1 }],
    hit: { ellipse: [124, 126, 52, 48], box: [74, 213, 175, 252] },  // 頭+雙耳 / 裙+尾巴
  },
  jiaobu: {
    // viewBox 121 63 553 635；頭皮鞍部（雙角間）y=181 → 高度 198 時頭頂在 CSS y=93
    height: 198,
    limbScale: 0.5,    // 存根切割縫，擺幅減半藏縫
    center: { x: 107, y: 136 },
    legL: [234, 650], legR: [544, 650],
    pawR: [533, 452],  // 樞紐放手肘斷口上：舉刀時斷口零位移
    pawScale: 0.5,     // 實機驗證台定的乾淨上限：刀臂輪廓掃過肚子的視覺黑線在此幅度下 Gemini/人審 PASS
    tail: [604, 560],
    up: 1,             // 刀尖在樞紐左上，順時針才是舉起
    sleepShift: '0px',
    sleep: [{ img: 'jiaobu-sleep.png', h: 136.4 }],
    hit: { ellipse: [107, 128, 58, 42], box: [38, 202, 162, 254] },  // 頭 / 軀幹
  },
  yueyue: {
    // viewBox 40 21 688 726；頭皮鞍部（雙耳間）y=157 → 高度 198 時頭頂在 CSS y=93
    height: 198,
    limbScale: 0.5,
    center: { x: 118, y: 113 },
    legL: [150, 690], legR: [535, 692],
    pawR: [145, 515],  // 樞紐放臂根下緣：舉手時下端幾乎不掃動
    tail: [608, 385],  // 樞紐貼熔接縫：上緣熔接點掃動最小化（原 [635,525] 撕裂 -47%；驗證台掃 7 候選此值最佳）
    tailScale: 0.2,    // 實機驗證台定的乾淨上限：尾巴可見輪廓掃動 ±1° 內 Gemini/人審 PASS
    up: 1,             // 拳頭在樞紐左側，順時針上舉
    sleepShift: '0px',
    // 兩張睡姿變體，依 w 加權抽選：新版 3、舊版 1（舊版 1/4 機率）
    sleep: [
      { img: 'yueyue-sleep2.png', h: 112.8, w: 3 },
      { img: 'yueyue-sleep.png', h: 102.9, w: 1 },
    ],
    hit: { ellipse: [105, 111, 72, 52], box: [28, 210, 158, 254] },  // 頭+雙耳 / 軀幹+尾巴
  },
  zhenzhen: {
    // viewBox 150 139 848 844（原圖 1000x1000 的子窗）；羊毛球頂 y=147 →
    // 解 (254-H)+(147-139)*H/844=93 得 H=162.5，頭頂落在 CSS y=93.04
    height: 162.5,
    limbScale: 0.5,   // 腿樁切在黑色輪廓帶（黑對黑藏縫），擺幅減半，±6.5° 零裂縫
    center: { x: 85, y: 150 },   // 雙眼中點（視窗 CSS 座標），視線跟隨用
    legL: [354, 910], legR: [596, 936],   // 腿樁樞紐（viewBox 座標，放切割帶中點）
    pawR: [400, 500],   // pawR 留空（未拆手），樞紐給任意值不影響（旋轉空 g 無視覺）
    up: -1,             // pawR 舉起方向（此角無手，保留欄位）
    sleepShift: '0px',
    sleep: [{ img: 'zhenzhen-sleep.png', h: 132.4 }],
    hit: { ellipse: [120, 172, 81, 80], box: [52, 188, 172, 254] },  // 圓滾羊身 / 底部
  },
  zhenmu: {
    // viewBox 62 128 650 543（768 畫布子窗）；圓頂最高 y=135，觸手末端貼地 y=670。
    // 解 (254-163)+(135-128)*163/543 = 93.1 → 頭頂線 CSS y≈93（誤差 0.1px）
    height: 163,
    limbScale: 0.5,     // 觸手細長、組內兩條共轉，擺幅 13*0.5=6.5° 藏住根部縫
    center: { x: 100, y: 150 },       // 臉中心（豆眼中點的 CSS 座標）
    legL: [226, 506], legR: [500, 506],  // 各組觸手根部中點（存根覆蓋帶內，接近交界）
    pawR: [400, 400],   // pawR 留空（未拆手），樞紐給任意值（旋轉空 g 無視覺；缺欄位會 spread 爆錯）
    up: -1,             // pawR 空，此值無實效，保留供 rig
    sleepShift: '0px',
    hit: { ellipse: [120, 148, 88, 54], box: [46, 191, 200, 254] },  // 圓頂 / 觸手矮區
  },
  caihua: {
    // 綠龍。素材直接取自畫師分層的 PSD（見 index.html 的 char-caihua 註解）。
    // viewBox 0 0 559 466＝群組緊裁；height = 466 × 0.3336（全域倍率，見 角色製作工法 §1.5）
    height: 155.5,
    limbScale: 1,      // body 完整無挖除區、部件是畫師自己的完整形狀 → 不必為藏縫縮擺幅
    center: { x: 96, y: 153 },            // 雙眼中點（視窗 CSS 座標）
    gazeScale: 0,      // 眼睛與眉毛在原畫連成一體，平移 #face 會把眼睛扯離眉毛 → 不做視線跟隨
    legL: [66, 310], legR: [302, 294],    // 樞紐取部件最頂列中點（貼身體交界，掃動最小）
    pawR: [279, 233],  // 無手部件，樞紐值無實效（空 g）
    tail: [368, 346],  // 尾根：部件最左欄中點
    up: -1,
    sleepShift: '0px',
    sleep: [{ img: 'caihua-sleep.png', h: 86.4 }],
    hit: { ellipse: [91, 134, 64, 35], box: [27, 213, 168, 254] },  // 頭＋雙角 / 軀幹＋尾巴
  },
  // 以下五隻與采華同工法（角色製作工法 §1.8 分層素材直出）。limbScale 一律 1：
  // body 完整無挖除區、部件是畫師自己的完整形狀，沒有接縫要靠縮擺幅來藏。
  yueyue2: {
    height: 175.1,     // viewBox 0 0 584 525；525 × 0.3336
    limbScale: 1,
    center: { x: 101, y: 141 },
    legL: [46, 284], legR: [384, 264],
    pawR: [292, 262],  // 無手部件（空 g）
    tail: [372, 427],
    up: -1,
    sleepShift: '0px',
    sleep: [
      { img: 'yueyue-sleep2.png', h: 112.8, w: 3 },
      { img: 'yueyue-sleep.png', h: 102.9, w: 1 },
    ],
    hit: { ellipse: [89, 118, 67, 39], box: [23, 217, 158, 254] },
  },
  zhenzhen2: {
    height: 190.1,     // viewBox 0 0 587 570
    // 腿畫在身體「前面」，擺動時上端會從身體底部輪廓下滑出來（掃出量與角度成正比）
    limbScale: 0.5,
    center: { x: 82, y: 150 },
    legL: [124, 465], legR: [378, 488],
    pawR: [293, 285],  // 無手部件（空 g）
    up: -1,
    sleepShift: '0px',
    sleep: [{ img: 'zhenzhen-sleep.png', h: 132.4 }],
    hit: { ellipse: [121, 107, 97, 43], box: [22, 218, 149, 254] },
  },
  jiaobu2: {
    height: 183.8,     // viewBox 0 0 466 551
    limbScale: 1,
    center: { x: 107, y: 151 },
    legL: [59, 323],   // 左臂：走路時擺動
    legR: [310, 511],  // 腿長在 body 裡，legR 留空（樞紐值無實效）
    pawR: [344, 330],  // 右臂：舉手提醒
    tail: [384, 384],
    up: -1,
    sleepShift: '0px',
    sleep: [{ img: 'jiaobu-sleep.png', h: 136.4 }],
    hit: { ellipse: [118, 112, 76, 41], box: [42, 197, 153, 254] },
  },
  lk: {
    height: 195.8,     // viewBox 0 0 586 587（全隊最高）
    limbScale: 0.5,    // 同珍珍：腿在身體前面，擺幅減半壓低上端掃出量
    center: { x: 107, y: 123 },
    legL: [143, 457], legR: [294, 474],
    pawR: [293, 293],  // 無手部件（空 g）
    up: -1,
    sleepShift: '0px',
    sleep: [{ img: 'lk-sleep.png', h: 140.8 }],
    hit: { ellipse: [93, 102, 71, 44], box: [23, 217, 146, 254] },
  },
  yang: {
    height: 161.8,     // viewBox 0 0 525 485
    limbScale: 1,
    center: { x: 100, y: 154 },
    legL: [130, 399], legR: [376, 393],
    pawR: [298, 285],  // 身上那隻小手
    up: -1,
    sleepShift: '0px',
    sleep: [{ img: 'yang-sleep.png', h: 100.1 }],
    hit: { ellipse: [120, 129, 87, 36], box: [33, 207, 165, 254] },
  },
};
// 除錯日誌：走 IPC 交後端寫進 %TEMP%\clawd-debug.log
const jlog = (m) => { try { TAURI?.core.invoke('js_log', { msg: String(m) }).catch(() => {}); } catch (_) {} };
window.onerror = (msg, src, line) => jlog(`ERROR ${msg} @${line}`);
window.onunhandledrejection = (e) => jlog(`REJECT ${e.reason}`);

// 夥伴視窗由 URL query 指定角色（?char=fox）；主視窗看 localStorage
const _urlChar = new URLSearchParams(location.search).get('char');
const IS_COMPANION = !!_urlChar;
const CHAR = _urlChar || localStorage.getItem('petchar') || 'dog';
const CFG = CHAR_CFG[CHAR] || CHAR_CFG.dog;
const otherChar = (c) => {
  const pool = Object.keys(CHAR_CFG).filter((k) => k !== c);
  return pool[Math.floor(Math.random() * pool.length)];
};

// ---------- 夥伴清單（localStorage: petcompanions = JSON array of char ids） ----------
const compList = () => {
  try { return JSON.parse(localStorage.getItem('petcompanions') || '[]'); }
  catch (_) { return []; }
};
const setCompList = (arr) => localStorage.setItem('petcompanions', JSON.stringify(arr));
// ---------- 玩具清單（localStorage: pettoys = JSON array of toy ids） ----------
const toyList = () => {
  try { return JSON.parse(localStorage.getItem('pettoys') || '[]'); }
  catch (_) { return []; }
};
const setToyList = (arr) => localStorage.setItem('pettoys', JSON.stringify(arr));
// 已知玩具 id（需與 main.rs 的 TOYS 一致）
const TOYS_KNOWN = ['dino', 'ballyellow', 'beachball'];
// ---------- 隱藏角色（localStorage: petrevealed = JSON array of char ids） ----------
// CHARS 標了 hidden 的角色平常不出現在「主角」「夥伴」清單，得先在選單最下方的
// 「隱藏角色」區打勾解鎖，才回到自己原本的位置。
const revealedList = () => {
  try { return JSON.parse(localStorage.getItem('petrevealed') || '[]'); }
  catch (_) { return []; }
};
const setRevealedList = (arr) => {
  // 過濾在 menu.js 端做（清單經 show_menu_window 的 revealed 欄位帶進選單狀態），
  // 後端不需要鏡像一份
  localStorage.setItem('petrevealed', JSON.stringify(arr));
};
// 舊版 petmulti 遷移：無 petcompanions 且 petmulti=='1' → 建一位隨機夥伴
if (!IS_COMPANION
    && localStorage.getItem('petcompanions') === null
    && localStorage.getItem('petmulti') === '1') {
  setCompList([otherChar(CHAR)]);
  localStorage.removeItem('petmulti');
}
{
  const tpl = document.getElementById('char-' + CHAR) || document.getElementById('char-dog');
  stage.appendChild(tpl.content.cloneNode(true));
  // 整體縮放：stage 維持 240x256 CSS，用 transform 縮放後剛好填滿縮放後的視窗
  // （fitWindow 傳 dpr*SCALE，Rust 把物理視窗撐到 240*SCALE*dpr）。
  stage.style.transform = 'scale(' + SCALE + ')';
  stage.style.transformOrigin = '0 0';
  document.getElementById('pet').style.height = CFG.height + 'px';
  // 墓碑：每隻都可能被做掉，一律建好備用（死亡時才 display:block）
  const tombimg = document.createElement('img');
  tombimg.id = 'tomb';
  tombimg.src = 'tomb.png';
  tombimg.alt = '';
  stage.insertBefore(tombimg, zzz);
  if (CFG.sleep && CFG.sleep.length) {
    // 睡圖是緊裁 PNG，只給高度、寬度靠 aspect 自動；bottom:2px 對齊地板（CSS y=254）。
    // h 值 = 素材 PSD 高 × 0.3336（以熱狗狗狗錨定的全域倍率，見 角色製作工法.md §1.5）。
    const sleepimg = document.createElement('img');
    sleepimg.id = 'sleepimg';
    sleepimg.alt = '';
    stage.insertBefore(sleepimg, zzz);
  }
  // 睡覺躺平時的落地微調（依角色體型不同）
  stage.style.setProperty('--sleepShift', CFG.sleepShift || '0px');
  // UI 元素依角色高度定位：角色頂在 stage 的 y、文字區頂（懸在頭頂上方不壓頭）
  stage.style.setProperty('--charTop', (254 - CFG.height) + 'px');
  stage.style.setProperty('--uiTop', Math.max(4, 254 - CFG.height - 36) + 'px');
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
const LINES_LOVE = ['最喜歡你了 ♥', '臉紅紅…', '心跳加速！'];

// ---------- 心情 / 飽食度 ----------
const stats = { mood: 70, fullness: 80 };
let patrolOn = false;
let murderOn = false;   // 墓碑事件總開關
let killMode = false;   // 殺戮模式：相遇必定得手
let controlOn = false;  // 操作模式：←→ 移動、空白跳躍（按鍵輪詢在 Rust）
try {
  const s = JSON.parse(localStorage.getItem('petstats') || '{}');
  if (s.stats) Object.assign(stats, s.stats);
  patrolOn = !!s.patrol;
  murderOn = !!s.murder;
  killMode = !!s.killMode && murderOn;   // 舊存檔可能留下「總開關關著卻有殺戮模式」
  controlOn = !!s.control;
} catch (_) {}
function saveStats() {
  localStorage.setItem('petstats', JSON.stringify({
    stats, patrol: patrolOn, murder: murderOn, killMode, control: controlOn,
  }));
  // 選單是常駐的，數值變了就推給它；沒開或不是自己開的，後端會直接返回
  TAURI?.core.invoke('sync_menu_state', {
    mood: Math.round(stats.mood),
    fullness: Math.round(stats.fullness),
    patrol: patrolOn,
    murder: murderOn,
    killMode,
    control: controlOn,
  }).catch(() => {});
}
// 位置判定在 Rust（只有後端看得到所有視窗座標），把它需要的狀態同步過去
function syncPetInfo() {
  if (TAURI) TAURI.core.invoke('set_pet_info', { character: CHAR, patrol: patrolOn }).catch(() => {});
}
function syncMurder() {
  if (TAURI && !IS_COMPANION) TAURI.core.invoke('set_murder', { on: murderOn, killmode: killMode }).catch(() => {});
}
function syncControl() {
  if (TAURI && !IS_COMPANION) TAURI.core.invoke('set_control', { on: controlOn }).catch(() => {});
}
function addMood(n) { stats.mood = Math.max(0, Math.min(100, stats.mood + n)); saveStats(); }

// 多人模式下所有視窗共用同一份 petstats，但各自在記憶體裡有一份副本。
// 沒有這個同步，夥伴餵食寫回的加成會被主視窗下一次衰減 tick 用舊值整個蓋掉，
// 而且夥伴選單顯示的會是它開窗當下的快照。storage 事件只會在「其他」同源
// context 寫入時觸發，所以不會和自己的 saveStats 打架。
window.addEventListener('storage', (e) => {
  if (e.key !== 'petstats' || !e.newValue) return;
  try {
    const s = JSON.parse(e.newValue);
    if (s.stats) Object.assign(stats, s.stats);
    patrolOn = !!s.patrol;
    // 巡邏狀態一定要跟著回報給後端，否則夥伴視窗（例如拿刀的女僕狐）在後端
    // 會一直是開窗當下的舊值，墓碑事件與追殺都不會對它發動
    syncPetInfo();
  } catch (_) {}
});

// 數值隨時間流失：每 30 秒一格；餓肚子時心情掉更快
// （只讓主視窗扣，避免多人模式下雙倍衰減）
if (!IS_COMPANION) {
  setInterval(() => {
    Object.assign(stats, Pure.decayStats(stats));
    saveStats();
  }, 30_000);
}

let lastActivity = Date.now();
let typingUntil = 0;
let dropTimer = null;
let walking = false;
let grabbed = false;
let parasiting = false;
let dead = false;          // 被有刀的做掉了，正躺在墓碑底下
let reviveTimer = null;
let ctrlDir = 0;           // 操作模式下的移動方向（1=右 -1=左 0=停）
let clickThrough = true;   // 目前是否穿透（Rust 端初始為穿透）

function setState(cls, on) { stage.classList.toggle(cls, on); }
function isSleeping() { return stage.classList.contains('sleep'); }

// 每次入睡從 CFG.sleep 依 w 權重抽一張（未給 w 視為 1），套上該張的實機高度。
// 沒有專屬睡圖的角色回 false → 走通用「旋轉 90° 躺平」路線。
function pickSleepImage() {
  const list = CFG.sleep;
  if (!list || !list.length) return false;
  const el = document.getElementById('sleepimg');
  if (!el) return false;
  const total = list.reduce((s, v) => s + (v.w || 1), 0);
  let r = Math.random() * total;
  let pick = list[list.length - 1];
  for (const v of list) {
    r -= v.w || 1;
    if (r < 0) { pick = v; break; }
  }
  el.src = pick.img;
  el.style.height = pick.h + 'px';
  return true;
}

function wake() {
  lastActivity = Date.now();
  if (isSleeping()) {
    setState('sleep', false);
    setState('sleep-img', false);
    if (TAURI) TAURI.core.invoke('set_sleeping', { on: false }).catch(() => {});
    // 剛睡醒伸個懶腰（瞇眼、拉長身體、抬手）
    if (!grabbed && !walking) {
      setState('stretch', true);
      setTimeout(() => setState('stretch', false), 1150);
    }
  }
}

// ---------- 逐像素（幾何）命中判定：依角色設定 ----------
const hitTest = (px, py) => Pure.hitShape(CFG.hit, px, py);

// ---------- 面向（角色原圖面朝左；往右走時整隻水平翻轉） ----------
const petEl = document.getElementById('pet');
let flipped = false;
function setFacing(toRight) {
  flipped = toRight;
  petEl.classList.toggle('flip', toRight);
}

// ---------- 視線跟隨 ----------
// gazeScale：視線跟隨會平移整個 #face（最多 ±9/±7 CSS px）。眼睛與眉毛在原畫
// 連成一體的角色（采華）一平移就把眼睛從眉毛底下扯開，看起來像眉毛被切斷 →
// 那種角色設 0，只保留眨眼（眨眼已改成以眼睛頂端為軸，不會脫離眉毛）。
function setGaze(dx, dy) {
  const gs = CFG.gazeScale === undefined ? 1 : CFG.gazeScale;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const k = Math.min(1, dist / 300) * gs;
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
let kickTimer = null;   // 踢玩具動作計時器

// 統一的「放下/解除抓取」出口：任何路徑結束抓取都走這裡，避免狀態卡死
function endGrab(bounce) {
  clearTimeout(grabWatchdog); grabWatchdog = null;
  clearTimeout(moveDebounce); moveDebounce = null;
  const playDrop = () => {
    setState('drop', true);
    setTimeout(() => setState('drop', false), 600);
    if (Math.random() < 0.4) {
      setTimeout(() => {
        setState('shake', true);
        setTimeout(() => setState('shake', false), 520);
      }, 620);
    }
  };
  if (!grabbed) {
    if (bounce) playDrop();
    return;
  }
  grabbed = false;
  pressPos = null;
  setState('grabbed', false);
  if (bounce) {
    playDrop();
  }
  wake();
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // 寄生中的珍母只能被點下來，不能同時進入拖曳或摸摸流程。
  if (CHAR === 'zhenmu' && parasiting) {
    TAURI?.core.invoke('parasite_end').catch(() => {});
    return;
  }
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
  if (dead) { pressPos = null; return; }   // 死了就別戳了，等它自己爬起來
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
  if (!TAURI) return;
  // 主視窗與夥伴共用同一個 HTML 選單視窗；後端用 source label 決定顯示哪些區塊
  TAURI.core.invoke('show_menu_window', {
    mood: Math.round(stats.mood),
    fullness: Math.round(stats.fullness),
    x: e.clientX * dpr,
    y: e.clientY * dpr,
    patrol: patrolOn,
    character: CHAR,
    companions: compList(),
    toys: toyList(),
    revealed: revealedList(),
    murder: murderOn,
    killMode,
    control: controlOn,
    scale: SCALE,
  }).catch(() => {});
});

// 雙擊 = 開心轉圈
stage.addEventListener('dblclick', () => {
  if (grabbed) return;
  setState('hi', false);
  setState('spin', true);
  setTimeout(() => setState('spin', false), 750);
  if (CHAR === 'fox' && Math.random() < 0.35) heartBurst();
  say('轉圈圈～');
  addMood(3);
});

// ---------- 餵食 ----------
let feeding = false;
function heartBurst() {
  const count = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'heart-burst';
    heart.textContent = ['❤️', '💕', '💖'][Math.floor(Math.random() * 3)];
    heart.style.left = (CENTER.x + (Math.random() * 24 - 12)) + 'px';
    heart.style.top = (CENTER.y + (Math.random() * 16 - 8)) + 'px';
    heart.style.setProperty('--heart-x', (Math.random() * 70 - 35).toFixed(1) + 'px');
    heart.style.setProperty('--heart-rise', -(40 + Math.random() * 40).toFixed(1) + 'px');
    heart.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
    heart.addEventListener('animationend', () => heart.remove(), { once: true });
    stage.appendChild(heart);
  }
}

function feed(kind = 'hotdog') {
  wake();
  if (feeding) return;
  const love = kind === 'love';
  if (!Pure.canFeed(stats, kind)) { say('吃不下了啦…'); return; }
  feeding = true;
  const food = document.createElement('div');
  food.id = 'food';
  food.textContent = love ? '❤️' : '🌭';
  stage.appendChild(food);
  setState('yum', true);
  setTimeout(() => {
    food.remove();
    Object.assign(stats, Pure.feedStats(stats, kind));
    saveStats();
    say((love ? LINES_LOVE : LINES_YUM)[Math.floor(Math.random() * (love ? LINES_LOVE : LINES_YUM).length)]);
    if (love) heartBurst();
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
  syncPetInfo();
  if (patrolOn) {
    try { await TAURI.core.invoke('snap_bottom'); } catch (_) {}
    say('出發巡邏！');
  } else {
    say('休息～');
  }
}

// ---------- 墓碑死亡 / 復活 ----------
// 誰死由 Rust 的鄰近判定決定（只有後端看得到所有視窗座標），這裡只負責演出。
// 楓之谷風：墓碑從天上砸下來，停 REVIVE_MS 後原地復活。
const REVIVE_MS = 15_000;
const LINES_DIE = ['嗚哇！', '啊……', '就這樣…嗎…'];
const LINES_DIE_DUEL = ['棋差一著…', '我輸了…', '技不如人…'];
const LINES_KILL = ['一刀。', '擋路了。', '下一位。', '……安息吧'];

function die(duel) {
  if (dead) return;
  dead = true;
  // 睡到一半被做掉：先把睡眠狀態收乾淨，不然睡圖會跟墓碑疊在一起
  if (isSleeping()) {
    setState('sleep', false);
    setState('sleep-img', false);
    if (TAURI) TAURI.core.invoke('set_sleeping', { on: false }).catch(() => {});
  }
  setState('work', false);
  setState('hi', false);
  setState('walk', false);
  setState('dead', true);
  const lines = duel ? LINES_DIE_DUEL : LINES_DIE;
  say(lines[Math.floor(Math.random() * lines.length)], 2400);
  addMood(-12);
  clearTimeout(reviveTimer);
  reviveTimer = setTimeout(revive, REVIVE_MS);
}

function revive() {
  clearTimeout(reviveTimer);
  if (!dead) return;
  dead = false;
  setState('dead', false);
  lastActivity = Date.now();
  if (TAURI) TAURI.core.invoke('revive').catch(() => {});
  say('我回來了！', 1800);
  setState('hi', true);
  clearTimeout(hiTimer);
  hiTimer = setTimeout(() => setState('hi', false), 950);
}

// 得手的一方：舉刀（沿用 hi 的舉手動作）＋撂話
function onKill() {
  if (dead || grabbed) return;
  wake();
  setState('hi', true);
  clearTimeout(hiTimer);
  hiTimer = setTimeout(() => setState('hi', false), 1300);
  say(LINES_KILL[Math.floor(Math.random() * LINES_KILL.length)], 2400);
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

// ---------- Claude Code 連動（多工計數＋夥伴分流） ----------
// 主視窗是唯一計數者。有 N 個夥伴時工作平分 N+1 份（每份 floor，餘數歸主視窗），
// 份數用 relay 指令送給每個夥伴視窗（{ cmd: 'cshare', n }）。
// 沒任何夥伴卻來了第 2 件工作 → 隨機臨時召喚一位非主角色分擔，全部完工 10 秒後
// 自動回家（本來就有手動夥伴時＝不召喚也不收回）。
let claudeCount = 0;
let claudeStartAt = 0;   // 自己開始工作的時間（冒汗判定用）
let claudeSafety = null;
let helperTemp = false;  // 是否有臨時召喚來的夥伴
let helperChar = null;   // 臨時夥伴的角色 id（收回時要指定 label）
let helperGoneTimer = null;
let myShare = 0;         // 夥伴視窗：目前被分派的份數（由主視窗 relay 驅動）
const claudeBusy = () => (IS_COMPANION ? myShare > 0 : claudeCount > 0);
// 目前實際在場的夥伴角色清單（手動清單 + 臨時召喚的那位）
const activeComps = () => {
  const list = compList();
  if (helperTemp && helperChar && !list.includes(helperChar)) return list.concat(helperChar);
  return list;
};
const companionActive = () => compList().length > 0 || helperTemp;

function updateWorkCount(n) {
  if (n >= 2) {
    workcount.textContent = '×' + n;
    workcount.classList.add('show');
  } else {
    workcount.classList.remove('show');
  }
}

// 主視窗：把工作份數分派給每個在場夥伴＋更新自己的徽章
function syncShare() {
  if (IS_COMPANION || !TAURI) return;
  const comps = activeComps();
  const { base, main } = Pure.splitShare(claudeCount, comps.length + 1);
  comps.forEach((c) => {
    TAURI.core.invoke('relay', {
      target: `pet_${c}`,
      payload: { cmd: 'cshare', n: base },
    }).catch(() => {});
  });
  updateWorkCount(main);                      // 主視窗拿 base + 餘數
}

function claudeAllDone(ok) {
  claudeCount = 0;
  claudeStartAt = 0;
  clearTimeout(claudeSafety);
  updateWorkCount(0);
  syncShare();
  sweat.classList.remove('show');
  setState('work', false);
  barFinish(ok);
  // 臨時夥伴：完工 10 秒後自動回家（期間有新工作就留下）
  if (helperTemp) {
    clearTimeout(helperGoneTimer);
    helperGoneTimer = setTimeout(() => {
      if (helperTemp && claudeCount === 0) {
        const c = helperChar;
        helperTemp = false;
        helperChar = null;
        TAURI.core.invoke('set_companion', { on: false, character: c }).catch(() => {});
        say('謝謝幫忙～', 1600);
      }
    }, 10_000);
  }
}

function onClaudeEvent(evt) {
  if (IS_COMPANION) return;   // 夥伴不聽原始事件，只聽主視窗分派的 cshare
  wake();
  if (evt === 'start') {
    claudeCount += 1;
    clearTimeout(helperGoneTimer);
    if (claudeCount === 1) {
      claudeStartAt = Date.now();
      barShow();
      say('Claude 開工！', 1600);
    } else {
      say(`同時 ${claudeCount} 件工作！`, 1600);
    }
    setState('work', true);
    // 複數工作但沒有任何夥伴 → 隨機臨時召喚一位非主角色來分擔
    if (claudeCount >= 2 && !companionActive()) {
      helperTemp = true;
      helperChar = otherChar(CHAR);
      TAURI.core.invoke('set_companion', { on: true, character: helperChar }).catch(() => {});
      say('叫夥伴來幫忙！', 1800);
      setTimeout(syncShare, 3000);   // 等夥伴開機完再同步一次份數
    }
    syncShare();
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
      syncShare();
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
      syncShare();
    }
    setState('sad', true);
    setTimeout(() => setState('sad', false), 2500);
    say('嗯…出錯了', 2000);
  }
}

// 夥伴視窗：接收主視窗分派的份數
function setCompanionShare(n) {
  const was = myShare;
  myShare = n;
  updateWorkCount(n);
  if (n >= 1 && was === 0) {
    wake();
    setState('work', true);
    claudeStartAt = Date.now();
    barShow();
    say('我來幫忙！', 1600);
  } else if (n === 0 && was >= 1) {
    claudeStartAt = 0;
    sweat.classList.remove('show');
    setState('work', false);
    barFinish(true);
    setState('spin', true);
    setTimeout(() => setState('spin', false), 750);
    say('這邊搞定！✓', 1800);
  }
}

// ---------- 散步 / 巡邏 ----------
// 巡邏模式：貼著工作列底邊、更頻繁更長距離地來回走
async function maybeWalk() {
  const idleFor = Date.now() - lastActivity;
  const eager = patrolOn;
  // 操作模式下不自己亂走，免得跟玩家搶視窗座標
  const canWalk = !grabbed && !walking && !parasiting && !isSleeping() && !dead && !controlOn
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
    // translateY 抬 3px：1.07 縱向放大會讓 198px 高的角色腳底掃出視窗底 ~2px
    tf = `translateY(-3px) scale(0.96, 1.07) rotate(${3 * Math.sin((t * 2 * Math.PI) / 0.9)}deg)`;
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
  } else if (walking || stage.classList.contains('work') || stage.classList.contains('kick')) {
    // 擺幅 13°：存根平切邊的直角掃出量壓在輪廓線厚度內（17° 會露出膝蓋尖角）
    // 踢玩具沿用 walk 擺腿（身體衝刺由 .kick 的 keyframes 負責）
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
  // pawScale：手臂專用的額外上限（實機驗證抓出的乾淨最大角 ÷ 全幅角），預設 1
  aL *= CFG.limbScale; aR *= CFG.limbScale; aP *= CFG.limbScale * (CFG.pawScale || 1);
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
    // tailScale：尾巴擺幅上限（實機驗證抓出的乾淨最大角 ÷ 全幅角），預設 1
    setLimb(tailEl, aT * (CFG.tailScale || 1), ...CFG.tail);
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
  if (!isSleeping() && now - lastActivity > SLEEP_AFTER_MS && !grabbed && !walking && !parasiting && !dead) {
    setFacing(false);   // 躺下動畫以面朝左為前提（翻轉時會變臉朝下）
    setState('sleep', true);
    setState('sleep-img', pickSleepImage());
    setState('work', false);
    if (TAURI) TAURI.core.invoke('set_sleeping', { on: true }).catch(() => {});
  }
  if (parasiting) lastActivity = now; // 黏在宿主頭上時不准因閒置重新睡著
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
  // 240x256 CSS。後端的 GetDpiForWindow 只看得到「顯示縮放」，量不到
  // Windows「文字大小」的疊乘（例：150%×125% = dpr 1.875），會裁切角色。
  function fitWindow() {
    // 傳 dpr*SCALE：物理視窗撐到 240*SCALE*dpr，剛好裝下縮放後的 stage。
    // fit_window 的 clamp 是 0.5..4.0，最小檔 0.7 在 dpr=1 時 =0.7 仍在界內。
    TAURI.core.invoke('fit_window', { dpr: (window.devicePixelRatio || 1) * SCALE }).catch(() => {});
  }
  // dpr 改變（拖到不同縮放的螢幕、改系統設定）就重新適配
  function watchDpr() {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener('change', () => { fitWindow(); watchDpr(); }, { once: true });
  }
  fitWindow();
  watchDpr();
  // 墓碑系統：後端要知道我是誰、有沒有在巡邏，以及總開關狀態
  syncPetInfo();
  syncMurder();
  syncControl();
  // dpr 在載入初期可能還是舊值（文字大小疊乘晚到），matchMedia 若在註冊前就變化會漏接
  // → 開機後補幾次冪等適配（實測：夥伴重建偶發卡在 240×1.5 裁切，即此競態）
  setTimeout(fitWindow, 600);
  setTimeout(fitWindow, 2000);

  // 多人模式：開機還原所有夥伴視窗（只有主視窗負責；換角色重載後也走這裡重建）
  // set_companion 會先 destroy 同 label 再建，重複呼叫安全。
  if (!IS_COMPANION) {
    compList().forEach((c) => {
      TAURI.core.invoke('set_companion', { on: true, character: c }).catch(() => {});
    });
    // 開機還原所有玩具視窗（只有主視窗負責）
    toyList().forEach((tid) => {
      TAURI.core.invoke('set_toy', { on: true, toy: tid }).catch(() => {});
    });
  }

  // 事件一律用視窗範圍的 win.listen 註冊：後端 emit_to(label) 只會送到 label
  // 相符的視窗，全域 emit（typing / claude-event）則照樣全員收到。
  // 舊版用全域 TAURI.event.listen，那是 target=Any，emit_to 對它形同廣播，
  // 才需要在 payload 裡塞 label 讓前端自己過濾。
  await win.listen('cursor', ({ payload }) => {
    // payload: 游標相對視窗左上角的實體像素座標（dpr 即時讀，避免適配後失準）
    // 再除以 SCALE 換回未縮放的 stage 座標系（0..240 / 0..256），
    // 後續 inside 判定與 hitTest 沿用原座標不必改。
    const dpr = window.devicePixelRatio || 1;
    const cx = payload.x / dpr / SCALE;
    const cy = payload.y / dpr / SCALE;
    const inside = cx >= 0 && cx < 240 && cy >= 0 && cy < 256;

    // 逐像素穿透：只有壓在角色身上才攔截滑鼠
    const wantCapture = grabbed || (inside && hitTest(cx, cy));
    if (wantCapture === clickThrough) {
      clickThrough = !wantCapture;
      TAURI.core.invoke('set_click_through', { ignore: clickThrough });
    }

    if (inside) wake();
    if (!walking && !grabbed) setGaze(cx - CENTER.x, cy - CENTER.y);
  });

  await win.listen('typing', onTyping);
  await win.onMoved(onWindowMoved);

  scheduleBlink();
  setTimeout(maybeWalk, 12_000 + Math.random() * 18_000);  // 錯開首次散步
  if (CHAR === 'zhenmu') {
    setInterval(() => {
      if (!grabbed && !walking && !parasiting && !isSleeping() && Math.random() < 0.12) {
        TAURI.core.invoke('parasite_start').catch(() => {});
      }
    }, 20_000);
  }

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

  // 指令由後端 emit_to 直接送到本視窗，payload 是 { cmd, ...參數 }
  await win.listen('pet-cmd', ({ payload }) => {
    const cmd = payload && typeof payload.cmd === 'string' ? payload.cmd : null;
    if (!cmd) return;
    jlog(`pet-cmd ${cmd}`);
    if (cmd === 'feed') feed();
    else if (cmd === 'feedlove') feed('love');
    else if (cmd === 'patrol') togglePatrol();
    else if (cmd === 'die') die(payload.duel === true);
    else if (cmd === 'kill') onKill();
    else if (cmd === 'murder' && !IS_COMPANION) {
      murderOn = !murderOn;
      // 總開關關掉時順手收掉殺戮模式，不然會留下「開著卻被鎖住」的殘留狀態
      if (!murderOn) killMode = false;
      saveStats();
      syncMurder();
      say(murderOn ? '巡邏時要小心刀…' : '和平了。', 2000);
    }
    else if (cmd === 'killmode' && !IS_COMPANION) {
      if (!murderOn) return;   // 總開關沒開就沒有殺戮模式（選單那邊也是 disabled）
      killMode = !killMode;
      saveStats();
      syncMurder();
      say(killMode ? '殺戮模式開啟！' : '收刀。', 2000);
    }
    else if (cmd === 'control' && !IS_COMPANION) {
      // payload.on 有給就直接指定，沒給就切換（選單走切換）
      controlOn = typeof payload.on === 'boolean' ? payload.on : !controlOn;
      saveStats();
      syncControl();
      if (!controlOn) { setState('walk', false); ctrlDir = 0; }
      say(controlOn ? '交給你操作囉！←→ 移動、空白跳' : '我自己走就好～', 2600);
    }
    else if (cmd === 'ctrl' && !IS_COMPANION) {
      // Rust 的按鍵輪詢送來的方向：1=右、-1=左、0=停。位置由後端搬，這裡只演戲。
      const d = Number(payload.dir) || 0;
      ctrlDir = d;
      // walking 這個旗標同時驅動四肢擺動，所以直接設它（不是只加 .walk class）
      walking = d !== 0;
      if (d !== 0) {
        wake();
        setFacing(d > 0);
        setGaze(d * 40, 20);
        setState('walk', true);
      } else {
        setState('walk', false);
      }
    }
    else if (cmd === 'chase') {
      // 被玩具吸引走過去（dx = 實體 px，交給 walk）
      if (grabbed || feeding) return;
      if (isSleeping()) wake();      // 被玩具吵醒
      if (walking) return;           // 走路中忽略，Rust 下秒會再導引
      const dx = Number(payload.dx);
      if (!isFinite(dx) || Math.abs(dx) < 8) return;
      setFacing(dx > 0);
      TAURI.core.invoke('walk', { dx }).then((durationMs) => {
        if (durationMs > 0) {
          walking = true;
          setState('walk', true);
          setGaze(dx, 20);
          setTimeout(() => { walking = false; setState('walk', false); }, durationMs);
        }
      }).catch(() => {});
    }
    else if (cmd === 'kick') {
      // 踢玩具！dir = 玩具相對自己的方向（+1 右）
      if (grabbed) return;
      if (isSleeping()) wake();
      const dir = Number(payload.dir) || 1;
      setFacing(dir > 0);            // 面向玩具
      setState('kick', true);
      clearTimeout(kickTimer);
      kickTimer = setTimeout(() => setState('kick', false), 450);
      if (Math.random() < 0.5) say(Math.random() < 0.5 ? '踢～！' : '嘿！', 1200);
      addMood(2);                    // 追到玩具算「玩」
    }
    else if (cmd === 'kicked') {
      wake();
      say('哇啊！？');
      addMood(-5);
      endGrab(true);                 // 未被抓時也會播落地與抖毛
    }
    else if (cmd === 'parasite') {
      parasiting = !!payload.on;
      setState('happy', parasiting);
      if (parasiting) { wake(); say('這個頭我收下了～'); }
      else { lastActivity = Date.now(); say('下次再玩～'); }
    }
    else if (cmd === 'parasited') {
      if (payload.on) {
        say('我的臉！？');
        setState('shake', true);
        setTimeout(() => setState('shake', false), 520);
      } else {
        say('呼…');
      }
    }
    else if (cmd === 'toy' && !IS_COMPANION) {
      // 切換某玩具視窗（勾＝開，取消勾＝收）
      const id = payload.id;
      if (!TOYS_KNOWN.includes(id)) return;
      const { list, added } = Pure.toggleInList(toyList(), id);
      setToyList(list);
      TAURI.core.invoke('set_toy', { on: added, toy: id }).catch(() => {});
      say(added ? '來玩玩具！ ♪' : '玩具收起來了～', 1600);
    }
    else if (cmd === 'toyoff' && !IS_COMPANION) {
      // 只收不開（玩具視窗自己按「收起玩具」時走這條）
      const id = payload.id;
      setToyList(toyList().filter((t) => t !== id));
      TAURI.core.invoke('set_toy', { on: false, toy: id }).catch(() => {});
    }
    else if (cmd === 'cshare' && IS_COMPANION) {
      setCompanionShare(Number(payload.n) || 0);
    }
    else if (cmd === 'comp' && !IS_COMPANION) {
      // 切換某角色的夥伴視窗（勾＝開，取消勾＝關）
      const id = payload.id;
      if (!CHAR_CFG[id]) return;
      const { list, added } = Pure.toggleInList(compList(), id);
      setCompList(list);
      // 收回時解除臨時夥伴身分；手動加入剛好是臨時那位 → 身分轉正，不再自動回家
      if (helperChar === id) { helperTemp = false; helperChar = null; clearTimeout(helperGoneTimer); }
      TAURI.core.invoke('set_companion', { on: added, character: id }).catch(() => {});
      say(added ? '夥伴來了！' : '夥伴回家了～', 1800);
      syncShare();
    }
    else if (cmd === 'compoff' && !IS_COMPANION) {
      // 只收回不開（夥伴視窗自己按「收回夥伴」時走這條）
      const id = payload.id;
      setCompList(compList().filter((c) => c !== id));
      if (helperChar === id) { helperTemp = false; helperChar = null; clearTimeout(helperGoneTimer); }
      TAURI.core.invoke('set_companion', { on: false, character: id }).catch(() => {});
      say('夥伴回家了～', 1800);
      syncShare();
    }
    else if (cmd === 'multitest' && !IS_COMPANION) {
      // 自動化/測試切換「有/無夥伴」：有→全收回，無→隨機召喚一位非主角色
      const list = compList();
      if (list.length > 0 || helperTemp) {
        list.forEach((c) => TAURI.core.invoke('set_companion', { on: false, character: c }).catch(() => {}));
        if (helperTemp && helperChar) TAURI.core.invoke('set_companion', { on: false, character: helperChar }).catch(() => {});
        setCompList([]);
        helperTemp = false; helperChar = null; clearTimeout(helperGoneTimer);
      } else {
        const c = otherChar(CHAR);
        setCompList([c]);
        TAURI.core.invoke('set_companion', { on: true, character: c }).catch(() => {});
      }
      syncShare();
    }
    else if (cmd === 'reveal' && !IS_COMPANION) {
      // 隱藏角色解鎖／收回。收回時若該角色正在當夥伴要一併請它回家；
      // 正在當主角則不收（不然選單會出現「目前主角不在清單裡」的空窗）。
      const id = payload.id;
      if (!CHAR_CFG[id]) return;
      const list = revealedList();
      const idx = list.indexOf(id);
      if (idx >= 0) {
        if (id === CHAR) { say('我還在這裡耶…', 1800); return; }
        list.splice(idx, 1);
        setRevealedList(list);
        const comps = compList();
        const ci = comps.indexOf(id);
        if (ci >= 0) {
          comps.splice(ci, 1);
          setCompList(comps);
          if (helperChar === id) { helperTemp = false; helperChar = null; clearTimeout(helperGoneTimer); }
          TAURI.core.invoke('set_companion', { on: false, character: id }).catch(() => {});
          syncShare();
        }
      } else {
        list.push(id);
        setRevealedList(list);
        say('解鎖隱藏角色！', 1800);
      }
    }
    else if (cmd === 'char') {
      const next = payload.id;
      if (next !== CHAR && CHAR_CFG[next]) {
        localStorage.setItem('petchar', next);
        location.reload();   // 重載以乾淨狀態實例化新角色（夥伴由重載後的開機檢查換角）
      }
    }
    else if (cmd === 'scale') {
      // 換寵物大小：存 localStorage 後 reload。主視窗 reload 的開機還原會用新
      // scale 重建所有夥伴視窗（夥伴同 origin 共用 localStorage，自動同步）。
      const v = Number(payload.value);
      if (isFinite(v) && v > 0 && Math.abs(v - SCALE) > 0.001) {
        localStorage.setItem('petscale', String(v));
        location.reload();
      }
    }
  });

  // Claude Code 連動事件（後端用全域 emit 廣播給所有寵物視窗）
  await win.listen('claude-event', ({ payload }) => onClaudeEvent(payload));
  jlog('main() complete, all listeners registered');
}

main();
