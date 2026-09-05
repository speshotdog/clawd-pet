// 傳輸控制：lookahead 排程（setInterval 25ms / 前瞻 0.12s）
import { rowToMidi, ROWS } from './theory.js';

// 把某一步的所有音符排入合成器（即時與離線渲染共用）
export function scheduleStep(synth, song, mixer, step, time, sd) {
  if ((mixer.swing || song.swing) && step % 2 === 1) time += sd * 0.28;
  const gate = 0.92;
  const halves = song.halves || {};
  const tr = song.transpose || 0; // 整曲移調（噪音通道除外，避免打擊音色跑掉）
  for (let r = 0; r < ROWS; r++) {
    const key = r + ',' + step;
    const inst = song.notes[key];
    if (!inst) continue;
    const span = song.spans[key] || 1;
    const vel = [0.6, 1, 1.35][(song.vels[key] || 1) - 1] || 1;
    const midi = rowToMidi(r) + (inst === 'noise' ? 0 : tr);
    let glide;
    if (song.slides[key] !== undefined) glide = rowToMidi(song.slides[key]) + (inst === 'noise' ? 0 : tr);
    if (halves[key]) { // 連打：一格打兩個 32 分音符
      synth.playNote(inst, midi, time, sd * 0.45, vel, glide);
      synth.playNote(inst, midi, time + sd / 2, sd * 0.45, vel, glide);
    } else {
      synth.playNote(inst, midi, time, sd * span * gate, vel, glide);
    }
  }
  for (let l = 0; l < 3; l++) {
    const d = song.drums[l + ',' + step];
    if (!d) continue;
    const v = d === 2 ? 1.3 : 1;
    if (halves['d' + l + ',' + step]) {
      synth.playDrum(l, time, v);
      synth.playDrum(l, time + sd / 2, v * 0.85);
    } else synth.playDrum(l, time, v);
  }
}

export class Transport {
  constructor(synth, store) {
    this.synth = synth;
    this.store = store;
    this.playing = false;
    this.timer = null;
    this.nextStep = 0;
    this.nextTime = 0;
    this.lastStep = 0;    // 最後聽到/停留的位置（loop 點與貼上用）
    this.loop = null;     // {a, b} 區間循環（含 b）
    this.onStep = null;   // (step, atTime) UI 播放頭
    this.onState = null;  // (playing)
  }

  setLoop(loop) { this.loop = loop; }

  get sd() { return 60 / this.store.song.bpm / 4; }

  start(from = 0) {
    const ctx = this.synth.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.stop(false);
    this.synth.setBpm(this.store.song.bpm);
    this.playing = true;
    this.nextStep = from;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
    this.onState?.(true);
  }

  stop(notify = true) {
    clearInterval(this.timer);
    this.timer = null;
    if (this.playing) {
      this.playing = false;
      if (notify) this.onState?.(false);
    }
  }

  toggle() { this.playing ? this.stop() : this.start(0); }

  tick() {
    const ctx = this.synth.ctx;
    const ahead = ctx.currentTime + 0.12;
    const { song, mixer } = this.store;
    while (this.nextTime < ahead) {
      const step = this.nextStep;
      scheduleStep(this.synth, song, mixer, step, this.nextTime, this.sd);
      const at = this.nextTime;
      const delay = Math.max(0, (at - ctx.currentTime) * 1000);
      setTimeout(() => { if (this.playing) { this.lastStep = step; this.onStep?.(step); } }, delay);
      let next = step + 1;
      if (this.loop && (next > this.loop.b || next >= song.steps)) next = this.loop.a;
      this.nextStep = next % song.steps;
      this.nextTime += this.sd;
    }
  }

  // 單音試聽（編輯時的回饋音）
  preview(inst, midi) {
    const ctx = this.synth.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const tr = inst === 'noise' ? 0 : (this.store.song.transpose || 0);
    this.synth.playNote(inst, midi + tr, ctx.currentTime + 0.01, this.sd * 2, 1);
  }
  previewDrum(lane) {
    const ctx = this.synth.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    this.synth.playDrum(lane, ctx.currentTime + 0.01, 1);
  }
}
