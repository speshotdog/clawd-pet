const TAURI = window.__TAURI__;

// [id, 顯示名, 是否為隱藏角色]。隱藏角色平常不出現在「主角」「夥伴」清單，
// 要先在最下方「隱藏角色」區打勾解鎖，才回到自己原本的位置。需與 main.rs 的 CHARS 一致。
const CHARACTERS = [
  ['dog', '熱狗狗狗'], ['fox', '女僕狐狐'],
  ['jiaobu2', '膠布'], ['jiaobu', '膠布（原版）', true],
  ['yueyue2', '玥玥'], ['yueyue', '玥玥（原版）', true],
  ['zhenzhen2', '珍珍'], ['zhenzhen', '珍珍（原版）', true],
  ['zhenmu', '珍母'], ['caihua', '采華'], ['lk', 'ㄌㄎ'], ['yang', '羊咩'],
];
const TOYS = [['dino', '小恐龍'], ['ballyellow', '黃色球'], ['beachball', '皮球']];
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
  // 簽章要含「有哪些項目」——隱藏角色解鎖後清單內容會變但選取沒變，
  // 只比選取的話新解鎖的角色不會出現（DOM 被快取擋掉）
  const sig = `${prefix}|${entries.map(([id]) => id).join(',')}|${[...selected].join(',')}`;
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
  // 墓碑事件／殺戮模式：殺戮模式只有在墓碑事件開著時才有意義
  for (const [key, prop] of [['murder', 'murder'], ['killmode', 'killMode'], ['control', 'control']]) {
    const on = Boolean(state[prop]);
    $(key).classList.toggle('is-on', on);
    $(key).setAttribute('aria-pressed', String(on));
  }
  $('killmode').disabled = !state.murder;
  $('killmode').title = state.murder
    ? '拿刀的角色會主動追殺活著的人，相遇必定得手'
    : '需要先開啟「墓碑事件」';
  $('autostart').classList.toggle('is-on', Boolean(state.autostart));
  // 隱藏角色：未解鎖就不列進主角/夥伴清單，但「目前主角」永遠留著，
  // 否則使用者取消勾選後主角會從清單消失變成空窗
  const revealed = new Set(state.revealed || []);
  const hiddenChars = CHARACTERS.filter(([, , hidden]) => hidden);
  const shownChars = CHARACTERS.filter(([id, , hidden]) => !hidden || revealed.has(id) || id === state.character);
  $('hidden-summary').textContent = revealed.size ? `已解鎖 ${revealed.size}/${hiddenChars.length}` : '未解鎖';
  renderChoices('character-options', shownChars, state.character, 'char');
  renderChoices('companion-options', shownChars, companions, 'comp', 'check');
  renderChoices('hidden-options', hiddenChars, [...revealed], 'reveal', 'check');
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
  } else if (id === 'murder') {
    state.murder = !state.murder;
  } else if (id === 'killmode') {
    state.killMode = !state.killMode;
  } else if (id === 'control') {
    state.control = !state.control;
  } else if (id === 'autostart') {
    state.autostart = !state.autostart;
  } else if (id.startsWith('comp:') || id.startsWith('toy:') || id.startsWith('reveal:')) {
    const key = id.startsWith('comp:') ? 'companions' : id.startsWith('toy:') ? 'toys' : 'revealed';
    const value = id.slice(id.indexOf(':') + 1);
    const selected = new Set(state[key] || []);
    if (selected.has(value)) {
      // 取消解鎖：正在當主角的不准收（後端也會擋，這裡先讓 UI 不要閃一下）
      if (key === 'revealed' && value === state.character) return;
      selected.delete(value);
      if (key === 'revealed') state.companions = (state.companions || []).filter((c) => c !== value);
    } else {
      selected.add(value);
    }
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

// ---------- 拖曳選單（視窗是 decorations:false，得自己接） ----------
// 只有標題列可以拖，避免壓到底下的按鈕/展開區；✕ 按鈕不觸發。
// capabilities 已含 petmenu 與 core:window:allow-start-dragging。
document.querySelector('.menu-heading').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button')) return;
  TAURI?.window.getCurrentWindow().startDragging().catch(() => {});
});
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
