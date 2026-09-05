// 樂理基礎：音名、和弦、音階工具、種子化亂數
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ROWS = 24;          // 音格列數（上 B5 → 下 C4）
export const TOP_MIDI = 83;      // 第 0 列 = B5
export const STEPS_PER_BAR = 16; // 16 分音符
export const SEG = 8;            // 和弦每半小節一換

export const CHORDS = {
  'C': [0, 4, 7], 'Dm': [2, 5, 9], 'Em': [4, 7, 11], 'F': [5, 9, 0], 'G': [7, 11, 2],
  'Am': [9, 0, 4], 'E': [4, 8, 11], 'D': [2, 6, 9], 'Bm': [11, 2, 6], 'Bb': [10, 2, 5],
  'Gm': [7, 10, 2], 'A': [9, 1, 4], 'Eb': [3, 7, 10], 'Bdim': [11, 2, 5],
  'C7': [0, 4, 7, 10], 'G7': [7, 11, 2, 5], 'E7': [4, 8, 11, 2], 'A7': [9, 1, 4, 7], 'F7': [5, 9, 0, 3],
  'B7': [11, 3, 6, 9], 'D7': [2, 6, 9, 0],
  'Am7': [9, 0, 4, 7], 'Dm7': [2, 5, 9, 0], 'Em7': [4, 7, 11, 2],
  'Cmaj7': [0, 4, 7, 11], 'Fmaj7': [5, 9, 0, 4], '—': []
};

// 次屬和弦：走向某和弦前，先放它的 V7（增加和聲推進感）
export const SEC_DOM = {
  'C': 'G7', 'Cmaj7': 'G7', 'Dm': 'A7', 'Dm7': 'A7', 'Em': 'B7', 'Em7': 'B7',
  'F': 'C7', 'Fmaj7': 'C7', 'G': 'D7', 'G7': 'D7', 'Am': 'E7', 'Am7': 'E7',
};
export const CHORD_CYCLE = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'E', 'D', 'Bm', 'Bb', '—'];

// 明暗滑桿用的大小調替換表（G 不動，保住屬和弦終止式）
export const SUB_DARK = { 'C': 'Am', 'F': 'Dm', 'Cmaj7': 'Am7', 'Fmaj7': 'Dm7', 'D': 'Bm' };
export const SUB_BRIGHT = { 'Am': 'C', 'Dm': 'F', 'Em': 'G', 'Am7': 'Cmaj7', 'Dm7': 'Fmaj7', 'Bm': 'D' };

export const pc = m => ((m % 12) + 12) % 12;
export const midiName = m => NOTE_NAMES[pc(m)] + (Math.floor(m / 12) - 1);
export const rowToMidi = r => TOP_MIDI - r;
export const midiToRow = m => TOP_MIDI - m;

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) { this.f = mulberry32(hashSeed(seed)); }
  next() { return this.f(); }
  chance(p) { return this.f() < p; }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  rint(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
}

export function newSeed() {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0).toString(36).toUpperCase();
}

// 是否為和弦音
export const isChordTone = (midi, pcs) => pcs.length > 0 && pcs.includes(pc(midi));

// 在指定範圍內找離 target 最近的和弦音
export function nearestChordTone(target, pcs, lo, hi) {
  let best = null, bd = 99;
  for (let m = lo; m <= hi; m++) {
    if (!pcs.includes(pc(m))) continue;
    const d = Math.abs(m - target);
    if (d < bd) { bd = d; best = m; }
  }
  return best ?? Math.max(lo, Math.min(hi, target));
}

// 音階內走步：從 midi 往上/下移動 delta 個音階音
export function scaleWalk(midi, scale, delta, lo, hi) {
  const list = [];
  for (let m = lo; m <= hi; m++) if (scale.includes(pc(m))) list.push(m);
  if (!list.length) return Math.max(lo, Math.min(hi, midi));
  let idx = 0, bd = 99;
  list.forEach((m, i) => { const d = Math.abs(m - midi); if (d < bd) { bd = d; idx = i; } });
  return list[Math.max(0, Math.min(list.length - 1, idx + delta))];
}

// 和弦感知音階：把跟和弦相剋（差半音）的音級換成和弦音本身
export function chordAwareScale(scale, pcs, keepClash) {
  if (keepClash || !pcs || !pcs.length) return scale;
  const out = scale.map(p => {
    if (pcs.includes(p)) return p;
    const up = (p + 1) % 12, dn = (p + 11) % 12;
    if (pcs.includes(up) && !scale.includes(up)) return up;
    if (pcs.includes(dn) && !scale.includes(dn)) return dn;
    return p;
  });
  return out.filter((v, i) => out.indexOf(v) === i);
}
