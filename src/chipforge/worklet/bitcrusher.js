// 真正的 8-bit 降解：sample-rate 降頻（取樣保持）+ bit-depth 量化
class BitCrusher extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 5, minValue: 1, maxValue: 16 },
      { name: 'reduction', defaultValue: 4, minValue: 1, maxValue: 32 },
    ];
  }
  constructor() {
    super();
    this.phase = 0;
    this.hold = [0, 0];
  }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0];
    if (!inp.length) return true;
    const bits = params.bits[0], red = Math.max(1, Math.round(params.reduction[0]));
    const levels = Math.pow(2, bits);
    for (let ch = 0; ch < out.length; ch++) {
      const i = inp[ch] || inp[0], o = out[ch];
      let phase = this.phase, hold = this.hold[ch] || 0;
      for (let s = 0; s < o.length; s++) {
        if (phase % red === 0) hold = Math.round(i[s] * levels) / levels;
        o[s] = hold;
        phase++;
      }
      this.hold[ch] = hold;
    }
    this.phase = (this.phase + out[0].length) % 1e9;
    return true;
  }
}
registerProcessor('bitcrusher', BitCrusher);
