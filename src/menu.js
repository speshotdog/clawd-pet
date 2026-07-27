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

function renderChoices(target, entries, active, prefix, mode = 'single') {
  const selected = new Set(Array.isArray(active) ? active : [active]);
  const container = $(target);
  container.replaceChildren(...entries.map(([id, label]) => {
    const button = document.createElement('button');
    button.className = `choice${selected.has(id) ? (mode === 'check' ? ' checked' : ' selected') : ''}`;
    button.textContent = label;
    button.dataset.action = `${prefix}:${id}`;
    return button;
  }));
}

function render(next) {
  state = { ...state, ...next };
  setStatus('mood', state.mood);
  setStatus('fullness', state.fullness);
  const character = nameFor(state.character);
  $('active-character').textContent = `今天和 ${character} 一起冒險`;
  $('character-summary').textContent = character;
  $('companion-summary').textContent = (state.companions || []).length ? `${state.companions.length} 位同行` : '尚無';
  $('toy-summary').textContent = (state.toys || []).length ? `${state.toys.length} 件` : '收起';
  const selectedScale = SCALES.find(([value]) => Math.abs(value - state.scale) < .01)?.[1] || '標準';
  $('scale-summary').textContent = selectedScale;
  $('patrol').classList.toggle('is-on', Boolean(state.patrol));
  $('patrol').setAttribute('aria-pressed', String(Boolean(state.patrol)));
  // 墓碑事件／殺戮模式：殺戮模式只有在墓碑事件開著時才有意義
  for (const [key, prop] of [['murder', 'murder'], ['killmode', 'killMode'], ['control', 'control']]) {
    const on = Boolean(state[prop]);
    $(key).classList.toggle('is-on', on);
    $(key).setAttribute('aria-pressed', String(on));
  }
  $('killmode').disabled = !state.murder;
  $('autostart').classList.toggle('is-on', Boolean(state.autostart));
  $('autostart').textContent = `${state.autostart ? '✓ ' : ''}開機自動啟動`;
  // 隱藏角色：未解鎖就不列進主角/夥伴清單，但「目前主角」永遠留著，
  // 否則使用者取消勾選後主角會從清單消失變成空窗
  const revealed = new Set(state.revealed || []);
  const hiddenChars = CHARACTERS.filter(([, , hidden]) => hidden);
  const shownChars = CHARACTERS.filter(([id, , hidden]) => !hidden || revealed.has(id) || id === state.character);
  $('hidden-summary').textContent = revealed.size ? `已解鎖 ${revealed.size}/${hiddenChars.length}` : '未解鎖';
  renderChoices('character-options', shownChars, state.character, 'char');
  renderChoices('companion-options', shownChars, state.companions || [], 'comp', 'check');
  renderChoices('hidden-options', hiddenChars, [...revealed], 'reveal', 'check');
  renderChoices('toy-options', TOYS, state.toys || [], 'toy', 'check');
  renderChoices('scale-options', SCALES.map(([value, label]) => [String(value), label]), String(state.scale), 'scale');
}

async function closeMenu() {
  await TAURI?.core.invoke('close_menu_window').catch(() => {});
}

async function action(id) {
  if (!id) return;
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
  await TAURI.event.listen('menu-state', ({ payload }) => render(payload || {}));
}

main();
