const TAURI = window.__TAURI__;

const CHARACTERS = [
  ['dog', '熱狗狗狗'], ['fox', '女僕狐狐'], ['jiaobu', '膠布'],
  ['yueyue', '玥玥'], ['zhenzhen', '珍珍'], ['zhenmu', '珍母'],
];
const TOYS = [['dino', '小恐龍']];
const SCALES = [[0.7, '迷你'], [0.85, '小'], [1, '標準'], [1.15, '大'], [1.3, '特大']];
let state = {};

const $ = (id) => document.getElementById(id);
const nameFor = (id) => CHARACTERS.find(([key]) => key === id)?.[1] || id || '未選擇';
const clamp = (value) => Math.max(0, Math.min(100, Number(value) || 0));

function setStatus(id, value) {
  const safe = clamp(value);
  $(`${id}-value`).textContent = safe;
  $(`${id}-bar`).style.setProperty('--fill', `${safe}%`);
}

// 選項清單會被高頻重繪（心情/飽食度現在是即時同步的），內容沒變就別重建 DOM，
// 否則按鈕會在游標底下被抽換掉，hover 與焦點都會斷。
function renderChoices(target, entries, active, prefix, mode = 'single') {
  const selected = new Set(Array.isArray(active) ? active : [active]);
  const container = $(target);
  const sig = `${prefix}|${[...selected].join(',')}`;
  if (container.dataset.sig === sig) return;
  container.dataset.sig = sig;
  container.replaceChildren(...entries.map(([id, label]) => {
    const button = document.createElement('button');
    button.className = `choice${selected.has(id) ? (mode === 'check' ? ' checked' : ' selected') : ''}`;
    button.textContent = label;
    button.dataset.action = `${prefix}:${id}`;
    return button;
  }));
}

// 夥伴視窗開的選單只留「狀態＋餵食＋收回夥伴」：角色/夥伴/玩具/大小、躲起來、
// 回到右下角都是主視窗才管得動的東西。
function applyMode(companion) {
  document.body.classList.toggle('is-companion', companion);
  document.querySelectorAll('.main-only').forEach((el) => { el.hidden = companion; });
  document.querySelectorAll('.companion-only').forEach((el) => { el.hidden = !companion; });
}

function render(next) {
  state = { ...state, ...next };
  const companion = Boolean(state.companion);
  applyMode(companion);
  setStatus('mood', state.mood);
  setStatus('fullness', state.fullness);
  const character = nameFor(state.character);
  $('active-character').textContent = companion ? `夥伴 ${character}` : `今天和 ${character} 一起冒險`;
  if (companion) return;   // 以下都是主視窗才有的區塊

  const companions = state.companions || [];
  const toys = state.toys || [];
  $('character-summary').textContent = character;
  $('companion-summary').textContent = companions.length ? companions.map(nameFor).join('、') : '尚無';
  $('toy-summary').textContent = toys.length ? toys.length + ' 件' : '收起';
  $('scale-summary').textContent = SCALES.find(([value]) => Math.abs(value - state.scale) < .01)?.[1] || '標準';
  $('patrol').classList.toggle('is-on', Boolean(state.patrol));
  $('patrol').setAttribute('aria-pressed', String(Boolean(state.patrol)));
  $('autostart').classList.toggle('is-on', Boolean(state.autostart));
  $('autostart').textContent = `${state.autostart ? '✓ ' : ''}開機自動啟動`;
  renderChoices('character-options', CHARACTERS, state.character, 'char');
  renderChoices('companion-options', CHARACTERS, companions, 'comp', 'check');
  renderChoices('toy-options', TOYS, toys, 'toy', 'check');
  renderChoices('scale-options', SCALES.map(([value, label]) => [String(value), label]), String(state.scale), 'scale');
}

// 手風琴：視窗高度固定，一次只展開一組才塞得下（超出時中段仍可捲動保底）
document.querySelectorAll('details').forEach((d) => {
  d.addEventListener('toggle', () => {
    if (!d.open) return;
    document.querySelectorAll('details').forEach((o) => { if (o !== d) o.open = false; });
  });
});

async function closeMenu() {
  disarmQuit();
  await TAURI?.core.invoke('close_menu_window').catch(() => {});
}

// 「離開夥伴」要按兩次：它就在底排，一下點錯整個 app 就關了
let quitArmed = null;
function disarmQuit() {
  clearTimeout(quitArmed);
  quitArmed = null;
  $('quit').classList.remove('confirming');
  $('quit').textContent = '離開夥伴';
}

async function action(id) {
  if (!id) return;
  if (id !== 'quit' && quitArmed) disarmQuit();
  if (id === 'quit' && !quitArmed) {
    $('quit').classList.add('confirming');
    $('quit').textContent = '再按一次就離開';
    quitArmed = setTimeout(disarmQuit, 4000);
    return;
  }
  if (id === 'patrol') {
    state.patrol = !state.patrol;
  } else if (id === 'autostart') {
    state.autostart = !state.autostart;
  } else if (id.startsWith('comp:') || id.startsWith('toy:')) {
    const key = id.startsWith('comp:') ? 'companions' : 'toys';
    const value = id.slice(id.indexOf(':') + 1);
    const selected = new Set(state[key] || []);
    if (selected.has(value)) selected.delete(value);
    else selected.add(value);
    state[key] = [...selected];
  } else if (id.startsWith('char:')) {
    // 選單常駐不關閉，單選狀態要立即反映（主視窗那邊會 reload 換角）
    state.character = id.slice(5);
  } else if (id.startsWith('scale:')) {
    state.scale = Number(id.slice(6));
  }
  render(state);
  await TAURI?.core.invoke('menu_action', { id }).catch(() => {});
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button) action(button.dataset.action);
});
$('close').addEventListener('click', closeMenu);
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
// 不做 blur 自動關閉：使用者要求選單常駐，只有右上角 ✕（或 ESC）才收。

// 視窗適配：回報真實 devicePixelRatio（150% 顯示 × 125% 文字 = 1.875，
// GetDpiForWindow 量不到疊乘，不回報的話選單右/下會被裁切）。
function fitWindow() {
  TAURI?.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {});
}
function watchDpr() {
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    .addEventListener('change', () => { fitWindow(); watchDpr(); }, { once: true });
}

async function main() {
  if (!TAURI) return;
  fitWindow();
  watchDpr();
  // dpr 在載入初期可能還是舊值（文字大小疊乘晚到），matchMedia 若在註冊前變化會漏接
  // → 開機後補幾次冪等適配
  setTimeout(fitWindow, 600);
  setTimeout(fitWindow, 2000);
  const [initial, autostart] = await Promise.all([
    TAURI.core.invoke('get_menu_state').catch(() => ({})),
    TAURI.core.invoke('get_autostart').catch(() => false),
  ]);
  render({ ...initial, autostart });
  // 視窗範圍監聽：後端 emit_to("petmenu") 只送到這裡
  await TAURI.window.getCurrentWindow().listen('menu-state', ({ payload }) => render(payload || {}));
}

main();
