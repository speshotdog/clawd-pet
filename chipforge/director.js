// 總監系統：多候選生成 → 12 項啟發式評分 → 多樣性挑選
// 「作曲模式」= 不同的評分權重組合
import { CHORDS, pc, rowToMidi, isChordTone, SEG } from './theory.js';
import { composeSong } from './composer.js';
import { Rng, hashSeed } from './theory.js';

export const DIRECTOR_MODES = [
  { id: 'auto',     label: '均衡',   w: { motif: 2.0, hook: 2.3, phrase: 1.5, cadence: 1.3, energy: 1.4, contrast: 1.1, random: 2.0, repetitive: 1.0 } },
  { id: 'catchy',   label: '洗腦',   w: { motif: 2.2, hook: 2.7, phrase: 1.4, cadence: 1.3, energy: 1.3, contrast: 1.0, random: 2.2, repetitive: 0.8 } },
  { id: 'dramatic', label: '戲劇',   w: { motif: 1.5, hook: 2.1, phrase: 1.7, cadence: 1.3, energy: 2.1, contrast: 1.5, random: 1.6, repetitive: 1.0 } },
  { id: 'game',     label: 'BGM',    w: { motif: 2.0, hook: 1.5, phrase: 1.4, cadence: 1.2, energy: 1.1, contrast: 1.4, random: 1.9, repetitive: 1.4 } },
  { id: 'singable', label: '歌謠',   w: { motif: 1.7, hook: 2.0, phrase: 2.1, cadence: 1.7, energy: 1.2, contrast: 0.9, random: 2.3, repetitive: 1.0 } },
];

export const POWER_LEVELS = [
  { id: 'off',    label: '單發', count: 1 },
  { id: 'light',  label: '弱',   count: 4 },
  { id: 'mid',    label: '中',   count: 8 },
  { id: 'strong', label: '強',   count: 14 },
];

// ---- 工具 ----
function leadEvents(song, start = 0, end = null) {
  end ??= song.steps;
  const out = [];
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'lead') continue;
    const [r, c] = k.split(',').map(Number);
    if (c >= start && c < end) out.push({ c, midi: rowToMidi(r) });
  }
  return out.sort((a, b) => a.c - b.c);
}
const secRange = (song, kind) => {
  const sec = (song.secTags || []).find(s => s.kind === kind);
  return sec ? [sec.startBar * 16, (sec.startBar + sec.bars) * 16] : null;
};
const pcsAt = (song, c) => CHORDS[song.chords[Math.floor(c / SEG)]] || [0, 4, 7];
const rhythmSet = evs => new Set(evs.map(e => e.c % 16));
const setSim = (a, b) => {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  return inter / Math.max(a.size, b.size);
};

// ---- 評分指標（各回傳約 0..1）----
function scoreMotif(song) { // A 段動機是否在後段重現
  const a = secRange(song, 'A');
  if (!a) return 0.5;
  const motif = leadEvents(song, a[0], a[0] + 16).map(e => e.c % 16);
  if (motif.length < 2) return 0.2;
  const mSet = new Set(motif);
  let best = 0;
  for (let bar = a[0] / 16 + 2; bar < song.steps / 16; bar++) {
    const evs = leadEvents(song, bar * 16, bar * 16 + 16);
    best = Math.max(best, setSim(mSet, rhythmSet(evs)));
  }
  return best;
}

function scoreHook(song) { // 副歌開頭是否強而穩（早進、和弦音起唱）
  const s = secRange(song, 'S');
  if (!s) return 0.5;
  const evs = leadEvents(song, s[0], s[1]);
  if (evs.length < 2) return 0;
  const first = evs[0];
  let v = 0.4;
  if (first.c <= s[0] + 2) v += 0.3;
  if (isChordTone(first.midi, pcsAt(song, first.c))) v += 0.3;
  return v;
}

function scorePhrase(song) { // 樂句方向感：上行/下行有弧線而非鋸齒
  const evs = leadEvents(song);
  if (evs.length < 4) return 0.3;
  let flips = 0, prev = 0;
  for (let i = 1; i < evs.length; i++) {
    const d = Math.sign(evs[i].midi - evs[i - 1].midi);
    if (d && prev && d !== prev) flips++;
    if (d) prev = d;
  }
  const rate = flips / (evs.length - 1);
  return Math.max(0, 1 - Math.abs(rate - 0.35) * 2.2);
}

function scoreCadence(song) { // 段尾與曲尾落在和弦音
  const secs = song.secTags || [];
  if (!secs.length) return 0.5;
  let ok = 0, total = 0;
  secs.forEach(sec => {
    const end = (sec.startBar + sec.bars) * 16;
    const evs = leadEvents(song, sec.startBar * 16, end);
    const last = evs[evs.length - 1];
    if (!last) return;
    total++;
    if (isChordTone(last.midi, pcsAt(song, last.c))) ok++;
  });
  return total ? ok / total : 0.5;
}

function scoreEnergy(song) { // 能量曲線：副歌密度 > 主歌
  const a = secRange(song, 'A'), s = secRange(song, 'S');
  if (!a || !s) return 0.55;
  const dA = leadEvents(song, a[0], a[1]).length / (a[1] - a[0]);
  const dS = leadEvents(song, s[0], s[1]).length / (s[1] - s[0]);
  if (dS <= dA * 0.8) return 0.2;
  return Math.min(1, 0.5 + (dS - dA) * 8);
}

function scoreContrast(song) { // 段落節奏對比
  const a = secRange(song, 'A'), s = secRange(song, 'S');
  if (!a || !s) return 0.55;
  const sim = setSim(rhythmSet(leadEvents(song, a[0], a[1])), rhythmSet(leadEvents(song, s[0], s[1])));
  return 1 - sim * 0.7;
}

function scoreGroove(song) { // 鼓與貝斯是否互補（反拍互鎖）
  // ostinato/solo 原型的律動來自紋理編舞，不以大鼓數評分
  if (song.archetype && song.archetype !== 'groove') return 0.6;
  if (song.drumless) {
    // 無鼓編曲：律動由反拍和聲刺/琶音承擔，不罰沒有大鼓（否則永遠選不上）
    let offbeat = 0, n = 0;
    for (const [k, v] of Object.entries(song.notes)) {
      if (v !== 'harm') continue;
      n++;
      if ([2, 6].includes(+k.split(',')[1] % 8)) offbeat++;
    }
    return n ? Math.min(1, 0.55 + (offbeat / n) * 0.4) : 0.4;
  }
  let kick = 0, offbeatBass = 0, bassN = 0;
  for (const [k, v] of Object.entries(song.drums)) if (k.startsWith('0,') && v) kick++;
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'bass') continue;
    bassN++;
    if (+k.split(',')[1] % 4 === 2) offbeatBass++;
  }
  if (!bassN) return 0.2;
  return Math.min(1, 0.45 + (kick / (song.steps / 4)) * 0.3 + (offbeatBass / bassN) * 0.5);
}

function penaltyAimless(song) { // 漫無目的：連續大跳 + 方向亂換
  const evs = leadEvents(song);
  if (evs.length < 3) return 0.3;
  let bad = 0;
  for (let i = 1; i < evs.length; i++) {
    const d = Math.abs(evs[i].midi - evs[i - 1].midi);
    if (d > 7) bad++;
    if (d === 6) bad += 0.5; // 三全音裸跳
  }
  return Math.min(1, bad / evs.length * 2.5);
}

function penaltyDissonance(song) { // 強拍上與和弦相剋
  let clash = 0, n = 0;
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'lead' && v !== 'harm') continue;
    const [r, c] = k.split(',').map(Number);
    if (c % 4 !== 0) continue;
    n++;
    const pcs = pcsAt(song, c);
    const p = pc(rowToMidi(r));
    if (pcs.length && pcs.some(q => Math.abs(((q - p + 6 + 12) % 12) - 6) === 5)) clash++;
  }
  return n ? clash / n : 0;
}

function penaltyTooRandom(song) { // 每小節節奏都不同 → 難記
  const bars = song.steps / 16;
  const sets = [];
  for (let b = 0; b < bars; b++) sets.push(rhythmSet(leadEvents(song, b * 16, b * 16 + 16)));
  let simSum = 0, n = 0;
  for (let i = 1; i < sets.length; i++) { simSum += setSim(sets[i - 1], sets[i]); n++; }
  const avg = n ? simSum / n : 0.5;
  return Math.max(0, 0.55 - avg) * 1.6;
}

function penaltyRepetitive(song) { // 完全相同的相鄰小節太多
  const bars = song.steps / 16;
  let same = 0;
  const sig = b => leadEvents(song, b * 16, b * 16 + 16).map(e => `${e.c % 16}:${e.midi}`).join('|');
  for (let b = 1; b < bars; b++) if (sig(b) && sig(b) === sig(b - 1)) same++;
  return Math.min(1, same / Math.max(1, bars - 1) * 1.8);
}

export function scoreSong(song, modeId = 'auto') {
  const mode = DIRECTOR_MODES.find(m => m.id === modeId) || DIRECTOR_MODES[0];
  const w = mode.w;
  return (
    scoreMotif(song) * w.motif +
    scoreHook(song) * w.hook +
    scorePhrase(song) * w.phrase +
    scoreCadence(song) * w.cadence +
    scoreEnergy(song) * w.energy +
    scoreContrast(song) * w.contrast +
    scoreGroove(song) * 1.25 -
    penaltyAimless(song) * 1.8 -
    penaltyDissonance(song) * 0.4 -
    penaltyTooRandom(song) * w.random -
    penaltyRepetitive(song) * w.repetitive
  );
}

// 候選間差異度（挑三首風格最不同的）
function diversity(a, b) {
  const rA = rhythmSet(leadEvents(a)), rB = rhythmSet(leadEvents(b));
  let chordSame = 0;
  const n = Math.min(a.chords.length, b.chords.length);
  for (let i = 0; i < n; i++) if (a.chords[i] === b.chords[i]) chordSame++;
  return (1 - setSim(rA, rB)) * 0.6 + (1 - chordSame / Math.max(1, n)) * 0.4;
}

export function makeSeed(theme, gen, salt = '') {
  return (hashSeed([theme, JSON.stringify(gen), Date.now(), Math.random(), salt].join('|')) >>> 0).toString(36).toUpperCase();
}

// 主要入口：生成 count 首 → 評分 → 回傳排序後前 3 首（多樣性優先）
export async function forge({ theme, steps, gen, count, onProgress }) {
  const candidates = [];
  for (let i = 0; i < count; i++) {
    const seed = makeSeed(theme, gen, 'c' + i);
    const song = composeSong({ theme, steps, gen, seed });
    candidates.push({ song, seed, score: scoreSong(song, gen.director) });
    onProgress?.(i + 1, count);
    await new Promise(r => setTimeout(r, 0)); // 讓 UI 呼吸
  }
  candidates.sort((a, b) => b.score - a.score);
  // 多樣性挑選：第一名保底，其後在分數前 60% 中挑差異最大者
  const picked = [candidates[0]];
  const pool = candidates.slice(1, Math.max(3, Math.ceil(count * 0.6)));
  while (picked.length < Math.min(3, candidates.length) && pool.length) {
    let bi = 0, bv = -1;
    pool.forEach((c, i) => {
      const dv = Math.min(...picked.map(p => diversity(c.song, p.song))) + c.score * 0.02;
      if (dv > bv) { bv = dv; bi = i; }
    });
    picked.push(pool.splice(bi, 1)[0]);
  }
  return picked;
}

// 變奏：同一首歌換 salt 重生（保留主題與設定）
export function varySeed(seed, salt) {
  return (hashSeed(String(seed) + '|' + String(salt)) >>> 0).toString(36).toUpperCase();
}
