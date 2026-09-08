// 晶片合成器：NES 風格 2×方波(duty) + 三角波貝斯 + 噪音 + 合成鼓組
// 訊號鏈：ch → master → (retro: bitcrusher wet/dry) → compressor → limiter → 輸出
//        ch → echoSend → delay(+feedback+lowpass) → master
export const CH_VOL = { lead: 0.20, harm: 0.14, bass: 0.30, noise: 0.19 };
export const DUTY_VAL = { '12.5%': 0.125, '25%': 0.25, '50%': 0.5 };

export class ChipSynth {
  constructor(ctx, getMixer, { retroNode = null } = {}) {
    this.ctx = ctx;
    this.getMixer = getMixer;
    this.retroNode = retroNode; // AudioWorkletNode（離線渲染時為 null，改用後處理）
    this.build();
  }

  build() {
    const ctx = this.ctx, m = this.getMixer();
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVal(m);

    this.comp = ctx.createDynamicsCompressor();
    Object.assign(this.comp, {});
    this.comp.threshold.value = -16; this.comp.ratio.value = 4; this.comp.knee.value = 8;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -2; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001; this.limiter.release.value = 0.1;

    this.comp.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // NES APU 式非線性混音：真機各聲道不是線性相加，疊越多壓越扁
    // （NESdev 混音公式的 tanh 軟飽和近似，餵進 comp 前先過一道）
    this.shaper = ctx.createWaveShaper();
    {
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1) * 2 - 1;
        curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
      }
      this.shaper.curve = curve;
    }
    this.shaper.connect(this.comp);

    // retro 濕/乾混音
    this.retroWet = ctx.createGain(); this.retroWet.gain.value = 0.6;
    this.retroDry = ctx.createGain(); this.retroDry.gain.value = 0.4;
    if (this.retroNode) {
      this.retroNode.connect(this.retroWet);
      this.retroWet.connect(this.shaper);
      this.retroDry.connect(this.shaper);
    }
    this.routeRetro(!!m.retro);

    // 回音匯流排
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = (m.echo ?? 8) / 100 * 0.9;
    this.delay = ctx.createDelay(1.2);
    this.fb = ctx.createGain(); this.fb.gain.value = (m.echoFb ?? 22) / 100 * 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.echoSend.connect(this.delay); this.delay.connect(lp);
    lp.connect(this.fb); this.fb.connect(this.delay); lp.connect(this.master);

    // 噪音緩衝：白噪音 + 128 樣本循環（NES 短模式金屬聲）
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    const pb = ctx.createBuffer(1, 128, ctx.sampleRate);
    const pd = pb.getChannelData(0);
    for (let i = 0; i < pd.length; i++) pd[i] = Math.random() < 0.5 ? -0.7 : 0.7;
    this.metalBuf = pb;

    // duty 方波
    this.waves = {};
    for (const duty of [0.125, 0.25, 0.5]) {
      const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
      for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
      this.waves[duty] = ctx.createPeriodicWave(real, imag);
    }

    // 聲道立體聲位置
    this.pans = {};
    const panMap = { lead: 0, harm: 0.18, bass: 0, noise: -0.2, drum: 0 };
    for (const [ch, v] of Object.entries(panMap)) {
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner(); p.pan.value = v;
        p.connect(this.master); this.pans[ch] = p;
      } else this.pans[ch] = null;
    }
  }

  out(ch) { return this.pans[ch] || this.master; }
  masterVal(m) { return 0.9 * (m.master ?? 60) / 80; }

  routeRetro(on) {
    try { this.master.disconnect(); } catch (e) { }
    if (on && this.retroNode) {
      this.master.connect(this.retroNode);
      this.master.connect(this.retroDry);
    } else this.master.connect(this.shaper);
  }

  syncMixer() {
    const m = this.getMixer();
    this.master.gain.value = this.masterVal(m);
    this.echoSend.gain.value = (m.echo ?? 8) / 100 * 0.9;
    this.fb.gain.value = (m.echoFb ?? 22) / 100 * 0.6;
    this.routeRetro(!!m.retro);
  }

  setBpm(bpm) {
    this.delay.delayTime.value = Math.min(1.1, 60 / bpm * 0.75); // 附點八分
  }

  chVol(ch) {
    const m = this.getMixer();
    const anySolo = Object.values(m.solo || {}).some(Boolean);
    if ((m.mute || {})[ch] || (anySolo && !(m.solo || {})[ch])) return 0;
    return ((m.vol || {})[ch] ?? 70) / 75;
  }

  freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  playNote(inst, midi, time, dur, vel = 1, glideMidi) {
    const m = this.getMixer();
    let mul = this.chVol(inst) * vel;
    if (m.humanize) { time += (Math.random() - 0.5) * 0.008; mul *= 0.85 + Math.random() * 0.3; }
    if (mul <= 0) return;
    const vol = CH_VOL[inst] * mul;
    const ctx = this.ctx;

    if (inst === 'noise') return this.playNoise(midi, time, dur, vol, m);

    const toneSel = inst === 'bass' ? null : ((m.duty || {})[inst] || (inst === 'lead' ? '25%' : '12.5%'));
    if (toneSel === 'pluck') return this.playPluck(midi, time, dur, vol * 1.15, inst);

    const gn = ctx.createGain();
    const osc = ctx.createOscillator();
    let vol2 = vol, extra = null, punch = false, piano = false, bell = false, organ = false, strings = false, wantVib = false, dutyAttack = false;

    if (inst === 'bass') {
      midi -= 12; dur *= 1.1;
      if (glideMidi !== undefined) glideMidi -= 12;
      if (m.bassWave === 'pulse') { osc.setPeriodicWave(this.waves[0.5]); vol2 = vol * 0.55; }
      else if (m.bassWave === 'slap') { osc.type = 'triangle'; vol2 = vol * 1.1; punch = true; }
      else osc.type = 'triangle';
    } else {
      const dutySel = toneSel;
      const f0 = this.freq(midi);
      if (dutySel === 'piano') {
        // 鋼琴：脈衝波主體 + 高八度微失諧泛音，槌擊起音後自然衰減的長尾
        osc.setPeriodicWave(this.waves[0.25]);
        vol2 = vol * 1.25;
        piano = true;
        extra = { freqMul: 2, gain: 0.22, duty: 0.5, detune: 4 };
      } else if (dutySel === 'fm') {
        // FM 電鋼：正弦載波 + 2 倍頻調變器急速回落——16bit RPG 抒情主奏質感
        osc.type = 'sine';
        vol2 = vol * 1.5;
        piano = true; // 借用鋼琴包絡（槌擊起音＋自然長尾）
        const mod = ctx.createOscillator(), mg = ctx.createGain();
        mod.type = 'sine';
        mod.frequency.value = f0 * 2;
        mg.gain.setValueAtTime(f0 * 2.2, time);
        mg.gain.setTargetAtTime(f0 * 0.15, time + 0.01, 0.18);
        mod.connect(mg); mg.connect(osc.frequency);
        mod.start(time); mod.stop(time + dur + 0.4);
      } else if (dutySel === 'bell') {
        // 音樂盒/鐘琴：正弦 + 微失諧三倍頻泛音，敲擊後自然長衰減
        osc.type = 'sine';
        vol2 = vol * 1.6;
        bell = true;
        extra = { freqMul: 3.02, gain: 0.35, type: 'sine', detune: 0 };
      } else if (dutySel === 'organ') {
        // 管風琴/笛：疊泛音持續長音（神殿、聖堂、圖書館）
        this.organWave ||= (() => {
          const n = 8, re = new Float32Array(n), im = new Float32Array(n);
          im[1] = 1; im[2] = 0.6; im[3] = 0.35; im[4] = 0.2; im[6] = 0.12;
          return ctx.createPeriodicWave(re, im);
        })();
        osc.setPeriodicWave(this.organWave);
        vol2 = vol * 0.9;
        organ = true;
      } else if (dutySel === 'strings') {
        // 小提琴/弦樂：雙鋸齒微失諧 + 慢起音（弓壓感）+ 低通柔化 + 延遲揉音
        // 拉奏類音色的空白格——適合抒情主奏與對位聲部，快速音群會糊（勿進 battle 池）
        osc.type = 'sawtooth';
        osc.detune.value = -5;
        vol2 = vol * 0.55;
        extra = { gain: 0.9, type: 'sawtooth', detune: 6 };
        strings = true;
        wantVib = true;
      } else if (dutySel === 'saw') {
        // 鋸齒波雙簧微失諧——C64 SID／早期電腦遊戲系 lead
        osc.type = 'sawtooth';
        osc.detune.value = -4;
        vol2 = vol * 0.6;
        extra = { gain: 1, type: 'sawtooth', detune: 5 };
        wantVib = true;
      } else {
        const duty = DUTY_VAL[dutySel] ?? (inst === 'lead' ? 0.25 : 0.125);
        osc.setPeriodicWave(this.waves[duty]);
        if (inst === 'lead' && m.pwm) {
          osc.detune.value = -6; vol2 = vol * 0.55;
          extra = { detune: 6, gain: 1, duty };
        } else if (inst === 'lead' && duty !== 0.5) {
          dutyAttack = true; // 音頭疊 50% duty 亮起音（FamiTracker 式 duty 包絡）
        }
        wantVib = true;
      }
      if (wantVib && (m.vibrato ?? 35) > 0) {
        // 延遲揉音：先直音、約 0.13 秒後才揉進來（模擬真人演奏，短音自然不揉）
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.6;
        const vibAmt = (m.vibrato ?? 35) / 40 * 7;
        lg.gain.setValueAtTime(0, time);
        lg.gain.setValueAtTime(0, time + 0.13);
        lg.gain.linearRampToValueAtTime(vibAmt, time + 0.32);
        lfo.connect(lg); lg.connect(osc.detune);
        lfo.start(time); lfo.stop(time + dur + 0.4);
      }
    }

    const f = this.freq(midi);
    osc.frequency.value = f;
    const gf = (glideMidi !== undefined && glideMidi !== midi) ? this.freq(glideMidi) : null;
    if (gf) {
      osc.frequency.setValueAtTime(f, time);
      osc.frequency.linearRampToValueAtTime(gf, time + Math.max(0.02, dur));
    } else if (punch) {
      osc.frequency.setValueAtTime(f * 1.7, time);
      osc.frequency.exponentialRampToValueAtTime(f, time + 0.06);
    } else if (vel > 1.2 && inst === 'lead' && !extra && !piano && !bell && !organ) {
      // 重音進入滑：從下方半音 scoop 進音高（真人吹奏感，只給方波主奏的重音）
      osc.frequency.setValueAtTime(f * 0.945, time);
      osc.frequency.exponentialRampToValueAtTime(f, time + 0.035);
    }

    if (dutyAttack) {
      // duty 包絡：音頭 ~70ms 疊一層 50% duty，亮起音後讓位給本命音色
      const ao = ctx.createOscillator();
      ao.setPeriodicWave(this.waves[0.5]);
      ao.frequency.value = f;
      if (gf) { ao.frequency.setValueAtTime(f, time); ao.frequency.linearRampToValueAtTime(gf, time + Math.max(0.02, dur)); }
      const ag = ctx.createGain();
      ag.gain.setValueAtTime(0.55, time);
      ag.gain.setTargetAtTime(0, time + 0.015, 0.03);
      ao.connect(ag); ag.connect(gn);
      ao.start(time); ao.stop(time + 0.12);
    }

    if (piano) {
      // 槌擊 → 快速回落 → 會自己唱完的長尾（不受 susDecay 影響）
      gn.gain.setValueAtTime(0, time);
      gn.gain.linearRampToValueAtTime(vol2, time + 0.003);
      gn.gain.setTargetAtTime(vol2 * 0.35, time + 0.01, 0.07);
      gn.gain.setTargetAtTime(0.0001, time + 0.2, 0.5);
      gn.gain.setTargetAtTime(0, time + dur, 0.04);
    } else if (bell) {
      // 敲擊後自由振鈴，不被音長硬切（音樂盒的殘響感）
      gn.gain.setValueAtTime(0, time);
      gn.gain.linearRampToValueAtTime(vol2, time + 0.002);
      gn.gain.setTargetAtTime(0.0001, time + 0.02, 0.45);
      gn.gain.setTargetAtTime(0, time + Math.max(dur, 0.8), 0.05);
    } else if (organ) {
      // 平滑起音、全延音、柔放
      gn.gain.setValueAtTime(0, time);
      gn.gain.linearRampToValueAtTime(vol2, time + 0.04);
      gn.gain.setTargetAtTime(0, time + dur, 0.08);
    } else if (strings) {
      // 弓壓起音：緩進 → 滿弓微膨脹 → 收弓長放
      gn.gain.setValueAtTime(0, time);
      gn.gain.linearRampToValueAtTime(vol2 * 0.7, time + 0.06);
      gn.gain.linearRampToValueAtTime(vol2, time + 0.16);
      gn.gain.setTargetAtTime(0, time + dur, 0.09);
    } else {
      gn.gain.setValueAtTime(0, time);
      gn.gain.linearRampToValueAtTime(vol2, time + 0.004);
      gn.gain.setTargetAtTime(vol2 * 0.6, time + 0.012, 0.06);
      if (dur > 0.25) {
        const dk = (m.susDecay ?? 78) / 100;
        if (dk > 0) {
          const floor = vol2 * 0.6 * Math.max(0.05, 1 - dk);
          gn.gain.setTargetAtTime(floor, time + 0.15, Math.max(0.08, dur * (1 - dk) * 0.8 + 0.08));
        }
      }
      gn.gain.setTargetAtTime(0, time + dur, 0.025);
    }

    osc.connect(gn);
    if (strings) {
      // 低通柔化：磨掉鋸齒的毛邊，才像弓摩擦弦而不是合成器
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
      gn.connect(lp);
      lp.connect(this.out(inst));
      lp.connect(this.echoSend);
    } else {
      gn.connect(this.out(inst));
      if (inst !== 'bass') gn.connect(this.echoSend);
    }

    const tail = bell ? Math.max(dur, 0.8) + 0.6 : dur + 0.4;
    if (extra) {
      const eo = ctx.createOscillator();
      const fm2 = extra.freqMul || 1;
      if (extra.duty) eo.setPeriodicWave(this.waves[extra.duty]);
      else eo.type = extra.type || 'sine';
      eo.frequency.value = f * fm2;
      if (gf) { eo.frequency.setValueAtTime(f * fm2, time); eo.frequency.linearRampToValueAtTime(gf * fm2, time + Math.max(0.02, dur)); }
      eo.detune.value = extra.detune;
      const eg = ctx.createGain(); eg.gain.value = extra.gain;
      eo.connect(eg); eg.connect(gn);
      eo.start(time); eo.stop(time + tail);
    }
    osc.start(time); osc.stop(time + tail);
  }

  // Karplus-Strong 撥弦：噪音激發＋延遲線回授，實際合成進 buffer（WebAudio 回授迴圈
  // 有 128 樣本下限、對 lead 音域行不通，所以離線算好）。同音高共用快取。
  ksBuffer(midi) {
    this._ks ||= {};
    if (this._ks[midi]) return this._ks[midi];
    const rate = this.ctx.sampleRate;
    const N = Math.max(2, Math.round(rate / this.freq(midi)));
    const len = Math.floor(rate * 1.2);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      d[i] = cur;
      ring[idx] = (cur + ring[(idx + 1) % N]) * 0.5 * 0.996; // 平均濾波＝自然阻尼
      idx = (idx + 1) % N;
    }
    this._ks[midi] = buf;
    return buf;
  }

  playPluck(midi, time, dur, vol, inst) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.ksBuffer(midi);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, time);
    gn.gain.setTargetAtTime(0, time + Math.max(dur, 0.12), 0.05);
    src.connect(gn);
    gn.connect(this.out(inst));
    gn.connect(this.echoSend);
    src.start(time);
    src.stop(time + Math.min(1.2, dur + 0.6));
  }

  playNoise(midi, time, dur, vol, m) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    let nVol = vol;
    if (m.noiseMode === 'metal') {
      n.buffer = this.metalBuf; n.loop = true;
      n.playbackRate.value = Math.pow(2, (midi - 60) / 12) * 0.5;
      nVol = vol * 0.55;
    } else n.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.value = Math.max(120, Math.min(12000, 150 * Math.pow(2, (midi - 60) / 4)));
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, time);
    gn.gain.linearRampToValueAtTime(nVol, time + 0.004);
    gn.gain.setTargetAtTime(0, time + dur * 0.5, 0.05);
    n.connect(bp); bp.connect(gn);
    gn.connect(this.out('noise')); gn.connect(this.echoSend);
    n.start(time); n.stop(time + dur + 0.5);
  }

  playDrum(lane, time, vel = 1) {
    const m = this.getMixer();
    let mul = this.chVol('drum') * vel;
    if (m.humanize) { time += (Math.random() - 0.5) * 0.006; mul *= 0.88 + Math.random() * 0.24; }
    if (mul <= 0) return;
    const ctx = this.ctx;
    const laneVol = [(m.kick ?? 70) / 100, (m.snare ?? 55) / 100, (m.hat ?? 45) / 100][lane] ?? 0.6;
    const v = 0.5 * mul * laneVol;

    if (lane === 0) { // 大鼓：三角波下滑 + 點擊
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, time);
      o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      g.gain.setValueAtTime(v * 1.6, time);
      g.gain.setTargetAtTime(0, time + 0.02, 0.05);
      o.connect(g); g.connect(this.out('drum'));
      o.start(time); o.stop(time + 0.3);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(v * 0.5, time);
      ng.gain.setTargetAtTime(0, time, 0.015);
      n.connect(f); f.connect(ng); ng.connect(this.out('drum'));
      n.start(time); n.stop(time + 0.1);
    } else if (lane === 1) { // 小鼓：噪音 + 短音體
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(v * 1.1, time);
      ng.gain.setTargetAtTime(0, time + 0.01, 0.045);
      n.connect(f); f.connect(ng); ng.connect(this.out('drum'));
      n.start(time); n.stop(time + 0.25);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, time);
      o.frequency.exponentialRampToValueAtTime(140, time + 0.05);
      g.gain.setValueAtTime(v * 0.5, time);
      g.gain.setTargetAtTime(0, time, 0.03);
      o.connect(g); g.connect(this.out('drum'));
      o.start(time); o.stop(time + 0.15);
    } else { // 腳踏鈸：高通短噪音
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6800;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(v * 0.8, time);
      ng.gain.setTargetAtTime(0, time, vel > 1 ? 0.035 : 0.018);
      n.connect(f); f.connect(ng); ng.connect(this.out('drum'));
      n.start(time); n.stop(time + 0.12);
    }
  }
}

// 建立即時 AudioContext + bitcrusher worklet
export async function createLiveSynth(getMixer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let retroNode = null;
  try {
    await ctx.audioWorklet.addModule('worklet/bitcrusher.js');
    retroNode = new AudioWorkletNode(ctx, 'bitcrusher');
  } catch (e) { console.warn('bitcrusher worklet unavailable', e); }
  return new ChipSynth(ctx, getMixer, { retroNode });
}
