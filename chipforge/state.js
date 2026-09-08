// 歌曲資料模型 + 復原/重做 + 自動存檔
// notes["r,c"] = 'lead'|'harm'|'bass'|'noise'；spans/vels/slides 以同 key 附掛
// drums["lane,c"] = 1|2（力度）；chords: 每 8 步一個和弦名
import { SEG } from './theory.js';

export const BAR_OPTIONS = [2, 4, 8, 16, 32];
const LS_KEY = 'chipforge.song.v1';
const LS_MIXER = 'chipforge.mixer.v1';
const LS_GEN = 'chipforge.gen.v1';

export function emptySong(bars = 8, bpm = 132) {
  return {
    version: 1, bpm, steps: bars * 16,
    notes: {}, spans: {}, vels: {}, slides: {}, drums: {}, halves: {},
    chords: Array.from({ length: bars * 2 }, (_, i) => ['Am', 'F', 'C', 'G'][i % 4]),
    secTags: null, theme: 'bright', seed: null,
  };
}

export function defaultMixer() {
  return {
    vol: { lead: 80, harm: 66, bass: 80, noise: 58, drum: 74 },
    mute: { lead: false, harm: false, bass: false, noise: false, drum: false },
    solo: { lead: false, harm: false, bass: false, noise: false, drum: false },
    duty: { lead: '25%', harm: '12.5%' },
    pwm: false, bassWave: 'tri', noiseMode: 'white',
    vibrato: 35, echo: 8, echoFb: 22, susDecay: 78,
    swing: false, humanize: false, retro: false,
    master: 60, kick: 70, snare: 55, hat: 45,
  };
}

export function defaultGen() {
  return {
    density: 50, rhythm: 50, speed: 50, drama: 50, mood: 50, hook: 50, smooth: 50,
    sequenz: true, director: 'auto', power: 'light', form: 'auto',
  };
}

export class Store {
  constructor() {
    this.song = emptySong();
    this.mixer = defaultMixer();
    this.gen = defaultGen();
    this.history = [];
    this.future = [];
    this.listeners = new Set();
    this._saveTimer = null;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what = 'song') { for (const fn of this.listeners) fn(what); }

  snapshot() { return JSON.stringify(this.song); }

  pushHistory() {
    this.history.push(this.snapshot());
    if (this.history.length > 80) this.history.shift();
    this.future.length = 0;
  }

  undo() {
    if (!this.history.length) return false;
    this.future.push(this.snapshot());
    this.song = JSON.parse(this.history.pop());
    this.emit(); this.save();
    return true;
  }

  redo() {
    if (!this.future.length) return false;
    this.history.push(this.snapshot());
    this.song = JSON.parse(this.future.pop());
    this.emit(); this.save();
    return true;
  }

  applySong(song) {
    this.pushHistory();
    this.song = song;
    this.emit(); this.save();
  }

  mutate(fn) {
    this.pushHistory();
    fn(this.song);
    this.emit(); this.save();
  }

  // 不進歷史的小改（拖曳中）
  touch() { this.emit(); this.save(); }

  setBars(bars) {
    this.mutate(s => {
      const oldSteps = s.steps;
      s.steps = bars * 16;
      const segs = bars * 2;
      const old = s.chords;
      s.chords = Array.from({ length: segs }, (_, i) => old[i] || old[i % Math.max(1, old.length)] || 'Am');
      if (s.steps < oldSteps) {
        s.halves ||= {};
        for (const map of [s.notes, s.spans, s.vels, s.slides, s.halves]) {
          for (const k of Object.keys(map)) if (+String(k).replace(/^d/, '').split(',')[1] >= s.steps) delete map[k];
        }
        for (const k of Object.keys(s.drums)) if (+k.split(',')[1] >= s.steps) delete s.drums[k];
      }
      s.secTags = null;
    });
  }

  chordAt(step) {
    const i = Math.floor(step / SEG);
    return this.song.chords[i] || 'Am';
  }

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.song));
        localStorage.setItem(LS_MIXER, JSON.stringify(this.mixer));
        localStorage.setItem(LS_GEN, JSON.stringify(this.gen));
      } catch (e) { }
    }, 300);
  }

  load() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) this.song = { ...emptySong(), ...JSON.parse(s) };
      const m = localStorage.getItem(LS_MIXER);
      if (m) this.mixer = { ...defaultMixer(), ...JSON.parse(m) };
      const g = localStorage.getItem(LS_GEN);
      if (g) this.gen = { ...defaultGen(), ...JSON.parse(g) };
    } catch (e) { }
  }
}
