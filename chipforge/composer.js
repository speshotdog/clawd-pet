// 作曲引擎：段落規劃 → 和弦 → 旋律/和聲/貝斯/鼓 → 修復通道
// 精神繼承 EASY 8BIT EDITOR 的 生成→修復 思路，全部重新實作
import { CHORDS, SUB_DARK, SUB_BRIGHT, SEC_DOM, Rng, pc, midiToRow, rowToMidi, isChordTone, nearestChordTone, scaleWalk, chordAwareScale, SEG } from './theory.js';
import { THEMES, planSections, CATEGORIES } from './themes.js';
import { emptySong } from './state.js';

// 引擎版本：composer/synth 有影響作曲結果的改動就 bump。
// 「同 seed 同曲」只在同版引擎內成立——舊曲重鍛不一樣時，看這個欄位就知道原因
export const ENGINE_VER = '2026.07.18';

// ---- 主奏音色池：依主題分類抽，同主題不同 seed 會拿到不同樂器 ----
// 名義上是 8bit，實際目標是「復古遊戲感」——泰拉瑞亞/Undertale 都不是純方波
const THEME_CAT = {};
for (const c of CATEGORIES) for (const t of c.themes) THEME_CAT[t] = c.id;
const TONE_POOLS = {
  jpop:     ['fm', '25%', 'fm', 'bell'],
  nature:   ['25%', 'pluck', 'pluck', '50%'],
  city:     ['fm', 'saw', '25%', 'fm'],
  village:  ['pluck', '25%', 'fm', 'pluck'],
  facility: ['bell', 'organ', '25%', 'fm'],
  indoor:   ['fm', 'bell', 'piano', '25%'],
  scifi:    ['saw', 'saw', '25%', 'fm'],
  rpg:      ['25%', '50%', 'pluck', '25%'],
  legend:   ['fm', 'bell', '25%', 'piano'],
  casual:   ['pluck', 'bell', 'fm', '25%'],
  boss:     ['50%', 'saw', '25%', '50%'],
};

const LEAD_LO = 64, LEAD_HI = 83;
const HARM_LO = 60, HARM_HI = 76;
const BASS_LO = 60, BASS_HI = 77;

// ---- 編曲原型（Sharou 式編曲研究的結論：風格感＝聲部間共同的紋理原型）----
// groove＝現狀（旋律+和聲+貝斯+鼓全員驅動，BOSS/電音的緊湊感來源）
// ostinato＝一句固定伴奏音型全曲不變（身分錨），旋律稀疏地飄在上面（妖精之泉/2:23 AM）
// solo＝主旋律獨大，伴奏退到極簡低音（抒情鋼琴曲）
// 主題可設 archetype 欄位覆寫；未列名的主題一律 groove（行為不變）
const ARCH_OSTINATO = new Set(['library', 'musicbox', 'firefly', 'starcradle', 'aurora', 'deepsea', 'snow', 'temple', 'portal', 'observatory']);
const ARCH_SOLO = new Set(['memoryshard', 'sad', 'elegy', 'gentleend', 'bedtime', 'rainynight', 'lazynoon', 'slowcafe', 'daydream']);
const archetypeOf = (theme, T) =>
  T.archetype || (ARCH_OSTINATO.has(theme) ? 'ostinato' : ARCH_SOLO.has(theme) ? 'solo' : 'groove');

// 紋理編舞：各段落哪些聲部在場（Sharou 式 layer in/out——結構＝紋理的變化）
const LAYER_PLAN = {
  ostinato: {
    A:  { bass: 0, drums: 0, harm: 1 },
    A2: { bass: 1, drums: 0, harm: 1 },
    B:  { bass: 1, drums: 1, harm: 1 },
    S:  { bass: 1, drums: 1, harm: 1 },
    C:  { bass: 1, drums: 0, harm: 1 }, // 間奏拆到只剩伴奏句
  },
  solo: {
    A:  { bass: 1, drums: 0, harm: 0 },
    A2: { bass: 1, drums: 0, harm: 1 },
    B:  { bass: 1, drums: 1, harm: 1 },
    S:  { bass: 1, drums: 1, harm: 1 },
    C:  { bass: 1, drums: 0, harm: 0 }, // 間奏回到獨奏
  },
};

export function composeSong({ theme, steps, gen, seed }) {
  const T = THEMES[theme] || THEMES.bright;
  const rng = new Rng(seed);
  const bars = steps / 16;
  const d = gen.density / 100, rD = gen.rhythm / 100, sp = gen.speed / 100;
  const dr = gen.drama / 100, hk = gen.hook / 100, sm = gen.smooth / 100;
  const moodAmt = (gen.mood - 50) / 50;

  const song = emptySong(bars, Math.round(T.bpm[0] + (T.bpm[1] - T.bpm[0]) * sp));
  song.steps = steps;
  song.theme = theme;
  song.seed = seed;
  song.engineVer = ENGINE_VER;
  song.chords = [];
  song.transpose = rng.rint(-5, 6); // 整曲移調（播放時套用，音格仍以 C 調記譜）
  song.swing = !!T.swing;           // 主題級搖擺（scheduler 播放時套用）

  // 主奏音色：主題自訂池 > 主題固定 tone > 分類池（套用時機在 main.js/auto.js 同步進 mixer）
  const tonePool = T.tones || (T.tone && T.tone.lead ? [T.tone.lead] : TONE_POOLS[THEME_CAT[theme]] || null);
  if (tonePool) song.tone = { lead: rng.pick(tonePool) };

  const sections = planSections(bars, gen.form, rng);
  song.secTags = sections;

  // 編曲原型與紋理編舞
  const arch = archetypeOf(theme, T);
  if (arch !== 'groove') song.archetype = arch;
  const layerAt = sec => arch === 'groove' ? null : (LAYER_PLAN[arch][sec?.kind] || { bass: 1, drums: 1, harm: 1 });

  // ---- 無鼓編曲：抒情/氛圍系主題有機率整首不用鼓組（Undertale 抒情曲手法）----
  // 律動改由貝斯 + 反拍和聲刺（oom-pah）+ 琶音承擔。主題可設 drumless:true 強制 / false 禁用
  const drumlessOk = T.drumless === true ||
    (T.drumless !== false && T.fill === false && !T.jingle && (T.bpm[0] + T.bpm[1]) / 2 <= 115);
  const drumlessP = arch === 'solo' ? 0.7 : arch === 'ostinato' ? 0.5 : 0.4;
  const drumless = drumlessOk && (T.drumless === true || rng.chance(drumlessP));
  if (drumless) song.drumless = true;

  // ---- 和弦 ----
  // 調性錨：ostinato/solo 原型鎖定單一進行全曲不換——氛圍曲的「家」不能漂
  const progCache = {};
  const progFor = (kind) => {
    if (arch !== 'groove' || dr < 0.34) { progCache.all ||= rng.pick(T.progs); return progCache.all; }
    if (dr < 0.67) { const g = kind === 'A2' ? 'A' : kind; progCache[g] ||= rng.pick(T.progs); return progCache[g]; }
    return rng.pick(T.progs);
  };
  const moodChord = (ch, isLast) => {
    const amt = Math.abs(moodAmt);
    if (isLast || amt < 0.2) return ch;
    const map = moodAmt < 0 ? SUB_DARK : SUB_BRIGHT;
    return (map[ch] && rng.chance((amt - 0.2) / 0.8 * 0.85)) ? map[ch] : ch;
  };
  const totalSegs = steps / SEG;
  sections.forEach(sec => {
    const prog = progFor(sec.kind);
    const segs = sec.bars * 2;
    for (let i = 0; i < segs; i++) {
      const isLast = song.chords.length === totalSegs - 1;
      song.chords.push(moodChord(prog[i % prog.length], isLast));
    }
  });

  // ---- 次屬和弦：小節後半有機率換成「下一個和弦的 V7」做推進 ----
  // 調式色彩和弦（bII/bIII/借用小屬）是主題的身分證，不可替換——
  // 換掉 dragon/abyss 的 Bb 會讓黑暗氛圍整個出戲（用戶聽感實證）
  const MODAL_COLOR = new Set(['Bb', 'Eb', 'Gm', 'Bdim']);
  if (arch === 'groove') for (let i = 1; i < song.chords.length - 1; i += 2) { // 氛圍原型不加次屬（調性錨優先）
    const curC = song.chords[i], next = song.chords[i + 1];
    const dom = SEC_DOM[next];
    if (!dom || dom === curC || next === curC || MODAL_COLOR.has(curC)) continue;
    if (rng.chance(0.10 + dr * 0.18)) song.chords[i] = dom;
  }

  // ---- 旋律 ----
  const pcsAt = seg => CHORDS[song.chords[seg]] || [0, 4, 7];
  const centerOf = { A: 71, A2: 71, B: 74, S: 76, C: 68 };
  let cur = rng.rint(70, 75);
  let storedA = null; // A 段內容（notes/spans/vels），供 A2 複製
  let chorusHook = null; // 副歌動機（節奏骨架），供 post-chorus riff 用
  const leadOnsets = [];

  const pickRhythm = (energy) => {
    // 依密度 + 段落能量挑節奏型（長度加權）；ostinato 原型旋律要稀疏（伴奏句才是主體）
    const dEff = arch === 'ostinato' ? d * 0.5 : d;
    const want = Math.round(1 + (dEff * 0.7 + energy * 0.3) * (T.rhythms.reduce((m, r) => Math.max(m, r.length), 0) - 1));
    const pool = T.rhythms.filter(r => Math.abs(r.length - want) <= 1);
    return rng.pick(pool.length ? pool : T.rhythms);
  };

  const maxLeap = 3 + Math.round((1 - sm) * 7); // 滑順→3 半音；跳躍→10

  const placeLead = (c, midi, span, vel = 1) => {
    midi = Math.max(LEAD_LO, Math.min(LEAD_HI, midi));
    const r = midiToRow(midi);
    const key = r + ',' + c;
    song.notes[key] = 'lead';
    if (span > 1) song.spans[key] = span;
    if (vel > 1) song.vels[key] = vel;
    leadOnsets.push({ c, midi, key });
    return midi;
  };

  const writeSegment = (secKind, secStart, sg, motif, energy, forceMotif = false, opts = {}) => {
    const seg = (secStart + sg * SEG) / SEG;
    const pcs = pcsAt(seg);
    const scale = chordAwareScale(T.scale, pcs, T.keepClash);
    const center = centerOf[secKind] || 71;
    let rhythm;
    let contour = null;
    if (motif && (forceMotif || rng.chance(hk * 0.85))) {
      rhythm = motif.rhythm; contour = motif.contour; // フック：重用動機
    } else {
      rhythm = pickRhythm(energy);
      if (sg === 0 && !rhythm.includes(0)) rhythm = [0, ...rhythm];
    }
    // 樂句結尾：修掉尾巴的起音，讓句子呼吸（終止音會延長蓋過空拍）
    if (opts.restTail) {
      const trimmed = rhythm.filter(o => o < SEG - opts.restTail);
      rhythm = trimmed.length ? trimmed : [0];
    }
    const placed = [];
    rhythm.forEach((off, i) => {
      const c = secStart + sg * SEG + off;
      const strong = off % 4 === 0;
      let midi;
      if (contour && contour[i] !== undefined) {
        midi = nearestChordTone(motif.base + contour[i], strong ? pcs : pcs, LEAD_LO, LEAD_HI);
        if (!strong) midi = scaleWalk(motif.base + contour[i], scale, 0, LEAD_LO, LEAD_HI);
      } else if (strong || rng.chance(0.55)) {
        const drift = Math.round((center - cur) * 0.3) + rng.rint(-2, 2);
        midi = nearestChordTone(cur + drift, pcs, LEAD_LO, LEAD_HI);
      } else {
        midi = scaleWalk(cur, scale, rng.rint(-2, 2) || 1, LEAD_LO, LEAD_HI);
      }
      if (Math.abs(midi - cur) > maxLeap && placed.length) {
        midi = scaleWalk(cur, scale, midi > cur ? 1 : -1, LEAD_LO, LEAD_HI);
      }
      // 問答終止式：句尾落在指定音（問句→五度懸置、答句→根音解決）
      if (opts.cadence && i === rhythm.length - 1 && pcs.length) {
        const tPc = opts.cadence === 'root' ? pcs[0] : (pcs[0] + 7) % 12;
        midi = nearestChordTone(cur, [tPc], LEAD_LO, LEAD_HI);
      }
      const nextOff = rhythm[i + 1] ?? SEG;
      let gap = nextOff - off;
      let span = energy > 0.6 ? gap : Math.max(1, Math.round(gap * 0.6));
      if (T.fill === false) span = gap; // 抒情主題用連音
      if (opts.restTail && i === rhythm.length - 1) span = gap; // 終止音唱好唱滿
      cur = placeLead(c, midi, Math.min(span, gap), strong && rng.chance(0.3) ? 2 : 1);
      placed.push({ off, midi });
    });
    return { rhythm: [...rhythm], contour: placed.map(p => p.midi - (placed[0]?.midi ?? cur)), base: placed[0]?.midi ?? cur };
  };

  sections.forEach(sec => {
    const secStart = sec.startBar * 16;
    const segs = sec.bars * 2;
    const energy = { A: 0.45, A2: 0.5, B: 0.6, S: 0.85, C: 0.3 }[sec.kind] ?? 0.5;

    if (sec.kind === 'A2' && storedA) {
      // 複製 A 段再重寫尾巴做變化
      const len = Math.min(segs * SEG, storedA.len);
      for (const [k, v] of Object.entries(storedA.notes)) {
        const [r, c] = k.split(',').map(Number);
        if (c < len) {
          const key = r + ',' + (secStart + c);
          song.notes[key] = v;
          if (storedA.spans[k]) song.spans[key] = storedA.spans[k];
          if (storedA.vels[k]) song.vels[key] = storedA.vels[k];
          if (v === 'lead') leadOnsets.push({ c: secStart + c, midi: rowToMidi(r), key });
        }
      }
      const regenSegs = sec.bars >= 4 ? 2 : 1;
      for (let sg = segs - regenSegs; sg < segs; sg++) {
        for (let r = 0; r < 24; r++) for (let off = 0; off < SEG; off++) {
          const key = r + ',' + (secStart + sg * SEG + off);
          if (song.notes[key] === 'lead') {
            delete song.notes[key]; delete song.spans[key]; delete song.vels[key];
            const idx = leadOnsets.findIndex(o => o.key === key);
            if (idx >= 0) leadOnsets.splice(idx, 1);
          }
        }
        const isLast = sg === segs - 1;
        writeSegment(sec.kind, secStart, sg, null, energy, false,
          isLast ? { cadence: 'root', restTail: 3 } : {});
      }
      return;
    }

    let motif = null;
    const capture = sec.kind === 'A' || sec.kind === 'S';
    // 雷特動機：使用者記住/動機庫的動機強制開場（A/S 段開頭，B 段偶爾）
    // 支援 16 步（整小節）動機：拆成兩個半小節 cell 連續鋪出，成為完整的 hook 句
    const ext = gen.motif && gen.motif.rhythm && gen.motif.rhythm.length >= 2;
    let extCells = null;
    if (ext) {
      const rh = gen.motif.rhythm, ct = gen.motif.contour || [];
      const buildCells = mul => {
        const cs = [];
        rh.forEach((off, i) => {
          const ci = Math.floor(off * mul / SEG);
          (cs[ci] ||= { rhythm: [], contour: [] });
          cs[ci].rhythm.push((off * mul) % SEG);
          cs[ci].contour.push(ct[i] ?? 0);
        });
        for (let i = 0; i < cs.length; i++) if (!cs[i]) return null; // 出現空 cell 會斷句 → 放棄
        return cs;
      };
      // Undertale 式變形重現：副歌有空間時 50% 機率增值（時值×2）——同一句動機的莊嚴版
      const aug = sec.kind === 'S' && segs >= 4 && rng.chance(0.5);
      extCells = (aug && buildCells(2)) || buildCells(1);
    }
    const useExtHere = ext && (sec.kind === 'A' || sec.kind === 'S' || (sec.kind === 'B' && rng.chance(0.4)));
    // 樂句問答：每 2 小節（4 段）為一句，問句尾懸在五度、答句尾解決到根音；
    // 答句重用問句的節奏與輪廓，只換終止 —— 這是「像人寫的」關鍵
    const phraseSegs = Math.min(4, segs);
    let qMotifs = [];
    for (let sg = 0; sg < segs; sg++) {
      const pos = sg % phraseSegs;
      const phraseIdx = Math.floor(sg / phraseSegs);
      const isAnswer = phraseIdx % 2 === 1;
      const isPhraseEnd = pos === phraseSegs - 1;
      const isSectionEnd = sg === segs - 1;
      const opts = isPhraseEnd
        ? { cadence: (isAnswer || isSectionEnd) ? 'root' : 'fifth', restTail: 3 }
        : {};
      // 副歌 hook 迴圈：AAAB'——動機整段循環（立即重複是抓耳第一定律），
      // 句尾懸五度、段尾解決到根音當變尾（B'）。副歌的旋律必須比主歌「笨」。
      if (sec.kind === 'S' && sg > 0 && ((useExtHere && extCells) || motif)) {
        const loopOpts = isSectionEnd ? { cadence: 'root', restTail: 3 }
          : isPhraseEnd ? { cadence: 'fifth', restTail: 2 } : {};
        let lm = motif;
        if (useExtHere && extCells) {
          const cell = extCells[sg % extCells.length];
          lm = { rhythm: cell.rhythm, contour: cell.contour, base: centerOf.S };
        }
        writeSegment(sec.kind, secStart, sg, lm, energy, true, loopOpts);
        continue;
      }
      if (useExtHere && extCells && sg < extCells.length && extCells[sg]) {
        const extMotif = { rhythm: extCells[sg].rhythm, contour: extCells[sg].contour, base: centerOf[sec.kind] || 71 };
        const m = writeSegment(sec.kind, secStart, sg, extMotif, energy, true, opts);
        qMotifs[pos] = m;
        if (sg === 0) motif = m;
        continue;
      }
      let use = null, force = false;
      if (isAnswer && qMotifs[pos] && rng.chance(0.5 + hk * 0.45)) {
        use = qMotifs[pos]; force = true; // 答句重用問句動機
      } else {
        // ゼクエンツ／フック：偶數段有機率變成前段動機的移調重現
        const useMotif = motif && (
          (gen.sequenz && sg % 2 === 1 && rng.chance(0.55)) ||
          (sg >= 2 && sg % 2 === 0 && rng.chance(hk * 0.6))
        );
        if (useMotif) use = motif;
      }
      const m = writeSegment(sec.kind, secStart, sg, use, energy, force, opts);
      if (!isAnswer) qMotifs[pos] = m;
      if (sg === 0) motif = m;
    }
    if (sec.kind === 'S' && motif && !chorusHook) chorusHook = motif;
    if (capture && sec.kind === 'A' && !storedA) {
      const notes = {}, spans = {}, vels = {};
      for (const [k, v] of Object.entries(song.notes)) {
        const [r, c] = k.split(',').map(Number);
        if (c >= secStart && c < secStart + segs * SEG) {
          const lk = r + ',' + (c - secStart);
          notes[lk] = v;
          if (song.spans[k]) spans[lk] = song.spans[k];
          if (song.vels[k]) vels[lk] = song.vels[k];
        }
      }
      storedA = { notes, spans, vels, len: segs * SEG };
    }
  });

  // ---- 副歌高潮：預留最高音 ----
  const sSec = sections.find(s => s.kind === 'S');
  if (sSec && sSec.bars >= 2) {
    const s0 = sSec.startBar * 16, sLen = sSec.bars * 16;
    const peakC = s0 + Math.floor(sLen * 0.72 / 4) * 4;
    const seg = Math.floor(peakC / SEG);
    const pcs = pcsAt(seg);
    clearLeadAt(song, leadOnsets, peakC);
    const peak = nearestChordTone(LEAD_HI - 2, pcs, LEAD_HI - 5, LEAD_HI);
    const r = midiToRow(peak);
    const key = r + ',' + peakC;
    song.notes[key] = 'lead'; song.spans[key] = 3; song.vels[key] = 2;
    leadOnsets.push({ c: peakC, midi: peak, key });
  }

  // ---- 織體規劃：intro 段減薄、琶音段挑選 ----
  const introSec = (sections.length >= 4 && sections[0].kind !== 'C' && !T.jingle) ? sections[0] : null;
  // 無鼓時琶音也開放給抒情主題——穩定琶音就是「音高化的踏鈸」（ostinato/solo 原型不用泛用琶音）
  const arpOk = arch === 'groove' && (T.arp === true || ((T.fill !== false || drumless) && rng.chance(0.35 + d * 0.45)));
  const arpSecs = new Set(
    arpOk ? sections.filter(s => (s.kind === 'S' || s.kind === 'B') && s !== introSec) : []
  );

  // ---- 管絃編曲語法開關（管絃縮編思維：pulse2 當第二小提琴/銅管，不只是和聲填充）----
  // groove 限定；ostinato/solo 的紋理身分是「不變的伴奏句/獨奏留白」，不套管絃層
  const orch = arch === 'groove'
    ? { counter: rng.chance(0.65), tutti: rng.chance(0.75), echo: rng.chance(0.7) }
    : { counter: false, tutti: false, echo: false };
  const tuttiStartOf = sec => (sec.startBar + Math.ceil(sec.bars / 2)) * 16;

  // ---- 和聲（ハモリ）----
  const sorted = [...leadOnsets].sort((a, b) => a.c - b.c);
  if (arch !== 'ostinato') sorted.forEach(o => { // ostinato 的和聲通道整條讓給伴奏句
    const seg = Math.floor(o.c / SEG);
    const sec = sections.find(s => o.c >= s.startBar * 16 && o.c < (s.startBar + s.bars) * 16);
    if (arch === 'solo') {
      // solo 原型：極簡——只在半小節頭、低八度輕聲襯，讓主旋律獨大
      if (!sec || !layerAt(sec).harm) return;
      if (o.c % 8 !== 0 || !rng.chance(0.35)) return;
      const pcs = pcsAt(seg);
      const h = nearestChordTone(o.midi - rng.pick([7, 9, 12]), pcs, HARM_LO, Math.min(66, o.midi - 5));
      const key = midiToRow(h) + ',' + o.c;
      if (!song.notes[key]) { song.notes[key] = 'harm'; song.spans[key] = Math.min(8, SEG); }
      return;
    }
    if (drumless || !sec || sec === introSec || arpSecs.has(sec)) return; // intro 留白、琶音段交給琶音、無鼓時改用反拍刺
    if (orch.counter && (sec.kind === 'B' || sec.kind === 'A2')) return; // 對位線接管和聲通道
    if (orch.tutti && sec.kind === 'S' && o.c >= tuttiStartOf(sec)) return; // 副歌後半讓給八度齊奏
    const energy = { A: 0.35, A2: 0.4, B: 0.5, S: 0.75, C: 0.2 }[sec?.kind] ?? 0.4;
    if (o.c % 4 !== 0 || !rng.chance(d * 0.5 + energy * 0.45)) return;
    const pcs = pcsAt(seg);
    const h = nearestChordTone(o.midi - rng.pick([3, 4, 5, 7]), pcs.filter(p => p !== pc(o.midi)).length ? pcs.filter(p => p !== pc(o.midi)) : pcs, HARM_LO, Math.min(HARM_HI, o.midi - 2));
    const key = midiToRow(h) + ',' + o.c;
    if (song.notes[key]) return;
    song.notes[key] = 'harm';
    const leadSpan = song.spans[o.key] || 1;
    if (leadSpan > 1) song.spans[key] = leadSpan;
  });

  // ---- 管絃編曲語法（DQ 式管絃縮編：先想管絃配器再縮回四軌）----
  // tutti＝副歌後半 harm 貼主旋律低八度齊奏＋主旋律加重音（銅管 tutti、動態階梯最高層）
  // counter＝B 段對位線：半小節頭貼和弦音定錨，主旋律讓出的空隙級進行走（第二小提琴會唱的線）
  // echo＝間奏聲部問答：主旋律句半小節後被低八度回聲（木管問、銅管答）
  if (orch.tutti) sections.filter(s => s.kind === 'S').forEach(sec => {
    const t0 = tuttiStartOf(sec), end = (sec.startBar + sec.bars) * 16;
    for (const o of leadOnsets) {
      if (o.c < t0 || o.c >= end) continue;
      const h = o.midi - 12;
      if (h < HARM_LO) continue;
      const key = midiToRow(h) + ',' + o.c;
      if (!song.notes[key]) {
        song.notes[key] = 'harm';
        if (song.spans[o.key]) song.spans[key] = song.spans[o.key];
      }
      song.vels[o.key] = 2;
    }
  });
  // 對位線放 A2（主題重現時加第二小提琴——管絃變奏定石）與 B；琶音段讓給琶音
  if (orch.counter) sections.filter(s => (s.kind === 'B' || s.kind === 'A2') && s !== introSec && !arpSecs.has(s)).forEach(sec => {
    const start = sec.startBar * 16, end = start + sec.bars * 16;
    const leadAt = new Set(leadOnsets.filter(o => o.c >= start && o.c < end).map(o => o.c));
    let cm = 67;
    for (let c = start; c < end; c += 2) {
      const pcs = pcsAt(Math.floor(c / SEG));
      if (!pcs.length) continue;
      if (c % SEG === 0) {
        cm = nearestChordTone(cm, pcs, HARM_LO, 72);
      } else {
        if (leadAt.has(c) || leadAt.has(c + 1) || leadAt.has(c - 1) || !rng.chance(0.6)) continue;
        const scale = chordAwareScale(T.scale, pcs, T.keepClash);
        cm = scaleWalk(cm, scale, rng.chance(0.5) ? 1 : -1, HARM_LO, 72);
      }
      const key = midiToRow(cm) + ',' + c;
      if (!song.notes[key]) { song.notes[key] = 'harm'; song.spans[key] = 2; }
    }
  });
  if (orch.echo) sections.filter(s => s.kind === 'C' && s.bars >= 2).forEach(sec => {
    const start = sec.startBar * 16, end = start + sec.bars * 16;
    for (const o of leadOnsets) {
      if (o.c < start || o.c + 8 >= end) continue;
      const c2 = o.c + 8;
      let occupied = false;
      for (let r = 0; r < 24; r++) if (song.notes[r + ',' + c2] === 'lead') occupied = true;
      if (occupied) continue;
      const pcs = pcsAt(Math.floor(c2 / SEG));
      const midi = pcs.length ? nearestChordTone(Math.max(HARM_LO, o.midi - 12), pcs, HARM_LO, HARM_HI) : Math.max(HARM_LO, o.midi - 12);
      const key = midiToRow(midi) + ',' + c2;
      if (!song.notes[key]) {
        song.notes[key] = 'harm';
        if (song.spans[o.key]) song.spans[key] = Math.min(song.spans[o.key], 4);
      }
    }
  });

  // ---- Ostinato 伴奏句：一句音型全曲不變（身分錨），每半小節映射到當前和弦 ----
  // Sharou《2:23 AM》手法：不變的伴奏句比會變的旋律更能定義一首歌
  if (arch === 'ostinato') {
    const FIGS = [
      { steps: [0, 2, 4, 6], degs: [0, 1, 2, 1] }, // 上下波浪 8 分
      { steps: [0, 2, 4, 6], degs: [0, 1, 2, 3] }, // 上行琶音（3＝高八度根音）
      { steps: [0, 3, 6], degs: [0, 2, 1] },       // 附點搖曳
      { steps: [0, 2, 4, 6], degs: [2, 1, 0, 1] }, // 下行波浪
      { steps: [0, 2, 3, 6], degs: [0, 2, 1, 2] }, // 切分閃爍
    ];
    const fig = rng.pick(FIGS);
    const base = rng.rint(60, 64); // 音域錨，低於主旋律讓出空間
    sections.forEach(sec => {
      if (!layerAt(sec).harm) return;
      const start = sec.startBar * 16, end = start + sec.bars * 16;
      for (let c0 = start; c0 < end; c0 += SEG) {
        const pcs = pcsAt(Math.floor(c0 / SEG));
        if (!pcs.length) continue;
        const tones = [];
        for (let m = base; m <= base + 16 && tones.length < 3; m++) if (pcs.includes(pc(m))) tones.push(m);
        if (!tones.length) continue;
        fig.steps.forEach((st, i) => {
          const deg = fig.degs[i];
          let midi = deg === 3 ? tones[0] + 12 : (tones[Math.min(deg, tones.length - 1)]);
          let key = midiToRow(midi) + ',' + (c0 + st);
          if (song.notes[key]) { // 撞到主旋律就改用相鄰和弦音——脈動不能斷
            midi = tones[(Math.min(deg, tones.length - 1) + 1) % tones.length];
            key = midiToRow(midi) + ',' + (c0 + st);
          }
          if (!song.notes[key]) {
            song.notes[key] = 'harm';
            const gap = (fig.steps[i + 1] ?? SEG) - st;
            if (gap > 1) song.spans[key] = Math.min(gap, 2);
          }
        });
      }
    });
  }

  // ---- 琶音（分解和弦）：chiptune 招牌織體，副歌/橋段鋪 8 分或 16 分上行循環 ----
  const arpInt = rD > 0.55 ? 2 : 4;
  for (const sec of arpSecs) {
    const start = sec.startBar * 16, end = start + sec.bars * 16;
    let idx = 0;
    for (let c = start; c < end; c += arpInt) {
      if (c % SEG === 0) idx = 0; // 每半小節從和弦底音重新起跑
      const pcs = pcsAt(Math.floor(c / SEG));
      if (!pcs.length) continue;
      const tones = [];
      for (let m = HARM_LO; m <= HARM_HI; m++) if (pcs.includes(pc(m))) tones.push(m);
      if (!tones.length) continue;
      const midi = tones[idx % tones.length];
      idx++;
      const key = midiToRow(midi) + ',' + c;
      if (!song.notes[key]) song.notes[key] = 'harm';
    }
  }

  // ---- 無鼓編曲：反拍和聲刺（oom-pah）扛起律動，取代長音和聲（groove 原型限定）----
  if (drumless && arch === 'groove') {
    sections.forEach(sec => {
      if (sec === introSec || arpSecs.has(sec)) return;
      const start = sec.startBar * 16, end = start + sec.bars * 16;
      const sparse = sec.kind === 'C'; // 間奏刺一半就好
      for (let c = start + 2; c < end; c += 4) { // 落在每拍反拍（seg 內 2、6）
        if (sparse && c % SEG !== 2) continue;
        if (!rng.chance(0.9)) continue;
        const pcs = pcsAt(Math.floor(c / SEG));
        if (!pcs.length) continue;
        const tone = nearestChordTone(67, pcs, HARM_LO, HARM_HI);
        const key = midiToRow(tone) + ',' + c;
        if (!song.notes[key]) song.notes[key] = 'harm';
      }
    });
  }

  // ---- 貝斯 ----
  const bassify = (pat) => {
    let bp = pat;
    if (rD < 0.15) bp = bp.filter(p => p[0] === 0);
    else if (rD < 0.35) bp = bp.filter(p => p[0] % 4 === 0);
    if (rD > 0.65) {
      const have = new Set(bp.map(p => p[0]));
      bp = [...bp];
      [2, 6].forEach(o => { if (!have.has(o)) bp.push([o, 'o']); });
    }
    if (rD > 0.85) {
      const have = new Set(bp.map(p => p[0]));
      bp = [...bp];
      [1, 3, 5, 7].forEach(o => { if (!have.has(o)) bp.push([o, 'r']); });
    }
    return [...bp].sort((a, b) => a[0] - b[0]);
  };
  for (let seg = 0; seg < totalSegs; seg++) {
    const pcs = pcsAt(seg);
    if (!pcs.length) continue;
    const root = pcs[0];
    const sec = sections.find(s => seg * SEG >= s.startBar * 16 && seg * SEG < (s.startBar + s.bars) * 16);
    if (sec && layerAt(sec) && !layerAt(sec).bass) continue; // 紋理編舞：這段貝斯還沒進場
    if (sec?.kind === 'C' && rD < 0.5) { // 間奏 break：貝斯只留段首
      if (seg % 2 === 0) placeBass(song, seg * SEG, root, 4);
      continue;
    }
    const pat = bassify(T.bassPat);
    pat.forEach(([off, kind]) => {
      let p = root;
      if (kind === '5') p = (root + 7) % 12;
      if (kind === '3') p = pcs[1] ?? root;
      const nextOff = pat.find(q => q[0] > off)?.[0] ?? SEG;
      placeBass(song, seg * SEG + off, p, Math.max(1, Math.round((nextOff - off) * 0.9)), kind === 'o');
    });
    // 導音：換和弦前最後一步，貼著下一個根音的實際音高走半音進去
    // （不能用音類尋位——導音 B→C 會被找到高八度去，變成突兀的高音）
    const nextPcs = pcsAt(seg + 1);
    if (seg < totalSegs - 1 && nextPcs.length && nextPcs[0] !== root && rng.chance(rD * 0.35)) {
      const c7 = seg * SEG + 7;
      let target = BASS_LO; // 下一個根音實際會落的位置（與 placeBass 同邏輯）
      while (pc(target) !== nextPcs[0] && target <= BASS_HI) target++;
      let app = target - 1;
      if (app < BASS_LO) app = target + 1; // 低半音超出音域就改從上方走下來
      // 該步已有貝斯起音就放棄；前面延音蓋過來就剪短，確保單音線條
      let occupied = false;
      for (const [k, v] of Object.entries(song.notes)) {
        if (v !== 'bass') continue;
        const [r, c] = k.split(',').map(Number);
        if (c === c7) { occupied = true; break; }
        if (c < c7 && c >= seg * SEG && c + (song.spans[k] || 1) > c7) song.spans[k] = c7 - c;
      }
      if (!occupied) {
        const key = midiToRow(app) + ',' + c7;
        if (!song.notes[key]) song.notes[key] = 'bass';
      }
    }
  }

  // ---- 鼓 ----（無鼓編曲整組跳過）
  const hatPat = rD < 0.25 ? [0, 8] : rD < 0.5 ? [0, 4, 8, 12] : rD < 0.8 ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 2, 4, 6, 8, 10, 12, 14];
  if (!drumless) sections.forEach(sec => {
    if (layerAt(sec) && !layerAt(sec).drums) return; // 紋理編舞：這段鼓還沒進場
    const start = sec.startBar * 16, end = start + sec.bars * 16;
    const quiet = sec.kind === 'C';
    const thinBars = sec === introSec ? Math.ceil(sec.bars / 2) : 0; // intro 前半：鼓只留踏鈸
    for (let bar = 0; bar < sec.bars; bar++) {
      const b0 = start + bar * 16;
      if (bar < thinBars) { song.drums['2,' + b0] = 1; song.drums['2,' + (b0 + 8)] = 1; continue; }
      if (quiet && bar < sec.bars - 1) { song.drums['2,' + b0] = 1; song.drums['2,' + (b0 + 8)] = 1; continue; }
      (T.drums.kick || []).forEach(o => song.drums['0,' + (b0 + o)] = 1);
      (T.drums.snare || []).forEach(o => song.drums['1,' + (b0 + o)] = 1);
      (T.drums.hat || hatPat).forEach(o => song.drums['2,' + (b0 + o)] = (rD > 0.8 && o % 4 === 2) ? 2 : 1);
    }
    // 段尾過門
    if (T.fill && sec.bars >= 2 && !T.jingle) {
      const f0 = end - 4;
      [0, 1, 2, 3].forEach((i) => {
        if (rng.chance(0.7 + i * 0.1)) song.drums['1,' + (f0 + i)] = i >= 2 ? 2 : 1;
      });
      delete song.drums['2,' + (end - 2)];
      delete song.drums['2,' + (end - 1)];
    }
  });

  // ---- 噪音火花：段落交界 + 副歌點綴 ----
  sections.forEach((sec, i) => {
    if (i === 0) return;
    const c = sec.startBar * 16;
    const key = midiToRow(76) + ',' + (c - 1);
    if (!song.notes[key] && rng.chance(0.7)) song.notes[key] = 'noise';
  });
  if (sSec && rD > 0.45) {
    const s0 = sSec.startBar * 16, sLen = sSec.bars * 16;
    for (let c = s0; c < s0 + sLen; c += 8) {
      if (rng.chance(rD * 0.4)) {
        const key = midiToRow(rng.pick([74, 76, 78])) + ',' + (c + 6);
        if (!song.notes[key]) song.notes[key] = 'noise';
      }
    }
  }

  // ---- 副歌前導音（アウフタクト）：兩個上行音走進副歌第一音 ----
  if (sSec && sSec.startBar > 0) {
    const s0 = sSec.startBar * 16;
    const firstS = (() => {
      for (let c = s0; c < s0 + 8; c++)
        for (let r = 0; r < 24; r++)
          if (song.notes[r + ',' + c] === 'lead') return { c, midi: rowToMidi(r) };
      return null;
    })();
    if (firstS && rng.chance(0.7)) {
      const scale = chordAwareScale(T.scale, pcsAt(Math.floor((s0 - 1) / SEG)), T.keepClash);
      [2, 1].forEach(back => {
        const c = s0 - back;
        const midi = scaleWalk(firstS.midi, scale, -back, LEAD_LO, LEAD_HI);
        const key = midiToRow(midi) + ',' + c;
        let occupied = false;
        for (let r = 0; r < 24; r++) if (song.notes[r + ',' + c] === 'lead') occupied = true;
        if (!occupied && !song.notes[key]) song.notes[key] = 'lead';
      });
    }
  }

  // ---- 進副歌工程：五種 entry，同一首歌固定一種（JPOP 式多樣化）----
  // build ＝上行線＋鼓漸密＋屬音踏板＋空拍（燃系）
  // lift  ＝IV→V 和聲走升＋琶音爬升（王道 JPOP 推升）
  // pickup＝弱起：三個八分音符「唱」進副歌（歌謠感）
  // fill  ＝旋律收長音＋鼓過門（樂團感）
  // brake ＝半速煞車：高音長懸＋全停一拍（蓄力反差）
  const bsIdx = sections.findIndex((s, i) => s.kind === 'B' && sections[i + 1]?.kind === 'S');
  if (arch === 'groove' && bsIdx >= 0 && !T.jingle && rng.chance(0.85)) {
    const bSec = sections[bsIdx];
    const s0 = sections[bsIdx + 1].startBar * 16;
    // 2026-07-18 用戶裁決：build/pickup/brake 過關進隨機池；lift/fill 淘汰（仍可用 gen.chorusEntry 強制）
    let entry = ['build', 'lift', 'pickup', 'fill', 'brake'].includes(gen.chorusEntry)
      ? gen.chorusEntry
      : rng.pick(bSec.bars >= 2
        ? ['build', 'build', 'pickup', 'pickup', 'brake']
        : ['pickup', 'pickup', 'brake']);
    if (entry === 'build' && bSec.bars < 2) entry = 'pickup';
    song.chorusEntry = entry;
    const clearNotes = (from, to, kinds) => {
      for (const [k, v] of Object.entries(song.notes)) {
        if (kinds && !kinds.includes(v)) continue;
        const c = +k.split(',')[1];
        if (c >= from && c < to) {
          delete song.notes[k]; delete song.spans[k]; delete song.vels[k];
          if (song.slides) delete song.slides[k];
        }
      }
    };
    const clearDrums = (from, to) => {
      for (const k of Object.keys(song.drums)) {
        const c = +k.split(',')[1];
        if (c >= from && c < to) delete song.drums[k];
      }
    };
    const firstLeadAfter = c0 => {
      for (let c = c0; c < c0 + 8; c++)
        for (let r = 0; r < 24; r++)
          if (song.notes[r + ',' + c] === 'lead') return rowToMidi(r);
      return 76;
    };

    if (entry === 'build') {
      const b0 = s0 - Math.min(2, bSec.bars) * 16;
      const GAP = 4; // 爆發前空一拍：靜默比任何音都有力
      clearNotes(b0, s0); clearDrums(b0, s0);
      const target = firstLeadAfter(s0);
      const climbEnd = s0 - GAP;
      const nUp = Math.floor((climbEnd - b0) / 2);
      for (let i = 0; i < nUp; i++) {
        const c = b0 + i * 2;
        const pcs2 = pcsAt(Math.floor(c / SEG));
        const scale2 = chordAwareScale(T.scale, pcs2, T.keepClash);
        const midi = scaleWalk(target, scale2, i - nUp, LEAD_LO, LEAD_HI);
        const key = midiToRow(midi) + ',' + c;
        song.notes[key] = 'lead';
        song.spans[key] = 2;
        if (i >= nUp - 2) song.vels[key] = 2;
      }
      const sPcs = pcsAt(Math.floor(s0 / SEG));
      const domPc = ((sPcs[0] ?? 0) + 7) % 12;
      for (let c = b0; c < climbEnd; c += 4) placeBass(song, c, domPc, 4);
      if (!drumless) for (let c = b0; c < climbEnd; c++) {
        const rel = c - b0;
        if (c >= s0 - 16 || rel % 2 === 0) song.drums['1,' + c] = c >= s0 - 8 ? 2 : 1;
        if (rel % 16 === 0) song.drums['0,' + c] = 1;
      }
    } else if (entry === 'lift') {
      // 最後 1 小節：和聲改走 IV→V（王道進行的推升段），琶音一路爬，短空拍後開唱
      const b0 = s0 - 16, GAP = 2;
      clearNotes(b0, s0); clearDrums(s0 - 8, s0);
      const segIdx = Math.floor(b0 / SEG);
      const domName = SEC_DOM[song.chords[Math.floor(s0 / SEG)]] || 'G';
      song.chords[segIdx] = 'F';
      song.chords[segIdx + 1] = domName;
      [['F', b0], [domName, b0 + SEG]].forEach(([ch, base]) => {
        const pcs2 = CHORDS[ch] || [5, 9, 0];
        const tones = [];
        for (let m2 = 65; m2 <= 83 && tones.length < 4; m2++) if (pcs2.includes(pc(m2))) tones.push(m2);
        const end = base + SEG - (base + SEG === s0 ? GAP : 0);
        let i = 0;
        for (let c = base; c < end; c += 2) {
          const midi = tones[Math.min(i++, tones.length - 1)];
          const key = midiToRow(midi) + ',' + c;
          song.notes[key] = 'lead';
          song.spans[key] = 2;
          if (c >= s0 - 6) song.vels[key] = 2;
        }
        placeBass(song, base, pcs2[0], SEG);
      });
      if (!drumless) {
        song.drums['0,' + b0] = 1; song.drums['0,' + (b0 + SEG)] = 1;
        song.drums['1,' + (s0 - 4)] = 2; song.drums['1,' + (s0 - 3)] = 2;
      }
    } else if (entry === 'pickup') {
      // 弱起：清掉尾巴 3 拍的旋律，三個八分音符級進「唱」進副歌第一音（無空拍，歌接歌）
      clearNotes(s0 - 6, s0, ['lead', 'harm']);
      clearDrums(s0 - 4, s0);
      const target = firstLeadAfter(s0);
      const pcs2 = pcsAt(Math.floor((s0 - 1) / SEG));
      const scale2 = chordAwareScale(T.scale, pcs2, T.keepClash);
      [6, 4, 2].forEach((back, i) => {
        const midi = scaleWalk(target, scale2, i - 3, LEAD_LO, LEAD_HI);
        const key = midiToRow(midi) + ',' + (s0 - back);
        song.notes[key] = 'lead';
        song.spans[key] = 2;
        if (i === 2) song.vels[key] = 2;
      });
    } else if (entry === 'fill') {
      // 樂團感：旋律提早收成長音讓位，最後半小節鼓組打過門衝進副歌
      const b0 = s0 - 16;
      clearNotes(b0, s0, ['lead', 'harm']);
      const pcs2 = pcsAt(Math.floor(b0 / SEG));
      const midi = nearestChordTone(74, pcs2, LEAD_LO, LEAD_HI);
      const key = midiToRow(midi) + ',' + b0;
      song.notes[key] = 'lead';
      song.spans[key] = 12;
      if (!drumless) {
        clearDrums(b0 + 8, s0);
        song.drums['0,' + (b0 + 8)] = 1;
        song.drums['1,' + (b0 + 10)] = 1;
        song.drums['1,' + (b0 + 12)] = 1;
        song.drums['1,' + (b0 + 13)] = 1;
        [14, 15].forEach(o => song.drums['1,' + (b0 + o)] = 2);
      }
    } else {
      // brake：半速煞車——高音長懸＋貝斯半拍脈動，然後全停一拍再爆
      const b0 = s0 - 16, GAP = 4;
      clearNotes(b0, s0); clearDrums(b0, s0);
      const pcs2 = pcsAt(Math.floor(b0 / SEG));
      const midi = nearestChordTone(79, pcs2, 72, LEAD_HI);
      const key = midiToRow(midi) + ',' + b0;
      song.notes[key] = 'lead';
      song.spans[key] = 16 - GAP;
      song.vels[key] = 2;
      placeBass(song, b0, pcs2[0] ?? 0, 4);
      placeBass(song, b0 + 8, pcs2[0] ?? 0, 4);
      if (!drumless) song.drums['0,' + b0] = 2;
      const nk = midiToRow(78) + ',' + b0;
      if (!song.notes[nk]) song.notes[nk] = 'noise';
    }
  }

  // ---- Post-chorus riff：副歌後 1 小節器樂 riff（動機節奏＋和弦音高低彈跳）----
  // 現代流行樂的 post-chorus hook——副歌唱完，樂器再把 hook 的節奏講一次
  const sIdx = sections.findIndex(s => s.kind === 'S');
  const afterS = sIdx >= 0 ? sections[sIdx + 1] : null;
  if (arch === 'groove' && chorusHook && afterS && afterS.kind !== 'S' && rng.chance(0.7)) {
    const r0 = afterS.startBar * 16;
    for (let c = r0; c < r0 + 16; c++)
      for (let r = 0; r < 24; r++) {
        const k = r + ',' + c;
        if (song.notes[k] === 'lead') { delete song.notes[k]; delete song.spans[k]; delete song.vels[k]; }
      }
    for (let half = 0; half < 2; half++) {
      const base = r0 + half * SEG;
      const pcs2 = pcsAt(Math.floor(base / SEG));
      if (!pcs2.length) continue;
      chorusHook.rhythm.forEach((off, i) => {
        if (off >= SEG) return;
        const midi = nearestChordTone(i % 2 === 0 ? 77 : 70, pcs2, LEAD_LO, LEAD_HI);
        const k = midiToRow(midi) + ',' + (base + off);
        if (!song.notes[k]) {
          song.notes[k] = 'lead';
          if (i === 0) song.vels[k] = 2;
        }
      });
    }
  }

  // ---- 修復通道 ----
  repairSong(song, T, sections, rng);
  return song;
}

// 從現有曲子擷取雷特動機：挑 A 段（或開頭）音數最適中的半小節
export function extractMotif(song) {
  const secA = (song.secTags || []).find(s => s.kind === 'A');
  const start = secA ? secA.startBar * 16 : 0;
  const scanEnd = Math.min(song.steps, start + 64);
  let best = null;
  for (let s0 = start; s0 + SEG <= scanEnd; s0 += SEG) {
    const evs = [];
    for (let c = s0; c < s0 + SEG; c++)
      for (let r = 0; r < 24; r++)
        if (song.notes[r + ',' + c] === 'lead') evs.push({ off: c - s0, midi: rowToMidi(r) });
    if (evs.length < 2) continue;
    // 3~5 音的動機最好記；越靠前越優先
    const score = -Math.abs(evs.length - 4) * 2 - (s0 - start) / SEG;
    if (!best || score > best.score) best = { score, evs };
  }
  if (!best) return null;
  best.evs.sort((a, b) => a.off - b.off);
  return {
    rhythm: best.evs.map(e => e.off),
    contour: best.evs.map(e => e.midi - best.evs[0].midi),
  };
}

function clearLeadAt(song, leadOnsets, c) {
  for (let r = 0; r < 24; r++) {
    const key = r + ',' + c;
    if (song.notes[key] === 'lead') {
      delete song.notes[key]; delete song.spans[key]; delete song.vels[key];
      const idx = leadOnsets.findIndex(o => o.key === key);
      if (idx >= 0) leadOnsets.splice(idx, 1);
    }
  }
}

function placeBass(song, c, pcVal, span, octaveUp = false) {
  let midi = BASS_LO;
  while (pc(midi) !== pcVal && midi <= BASS_HI) midi++;
  if (octaveUp && midi + 12 <= BASS_HI) midi += 12;
  if (midi > BASS_HI) midi = BASS_LO;
  const key = midiToRow(midi) + ',' + c;
  if (song.notes[key]) return;
  song.notes[key] = 'bass';
  if (span > 1) song.spans[key] = span;
}

// ---- 修復：樂句結尾、未解決跳進、強拍貼和弦、終止式 ----
export function repairSong(song, T, sections, rng) {
  const leads = collectLead(song);
  if (!leads.length) return;

  // 1. 未解決大跳：|Δ|>9 → 後音拉回一個八度
  for (let i = 1; i < leads.length; i++) {
    const dlt = leads[i].midi - leads[i - 1].midi;
    if (Math.abs(dlt) > 9) {
      const fixed = leads[i].midi - Math.sign(dlt) * 12;
      if (fixed >= LEAD_LO && fixed <= LEAD_HI) moveLead(song, leads[i], fixed);
    }
  }

  // 2. 段落最後一個音 → 貼到和弦音
  const leads2 = collectLead(song);
  sections.forEach(sec => {
    const end = (sec.startBar + sec.bars) * 16;
    const last = [...leads2].reverse().find(o => o.c < end && o.c >= sec.startBar * 16);
    if (!last) return;
    const pcs = CHORDS[song.chords[Math.floor(last.c / SEG)]] || [0, 4, 7];
    if (!isChordTone(last.midi, pcs)) {
      moveLead(song, last, nearestChordTone(last.midi, pcs, LEAD_LO, LEAD_HI));
    }
  });

  // 3. 對位法則（jrleszcz/counterpoint 規則移植）：
  // 3a. 唯一 climax——全曲最高音只出現一次，重複的高點會稀釋高潮
  const leadsCx = collectLead(song);
  if (leadsCx.length > 3) {
    const peak = Math.max(...leadsCx.map(o => o.midi));
    const peaks = leadsCx.filter(o => o.midi === peak);
    if (peaks.length > 1) {
      const keep = peaks[Math.min(peaks.length - 1, Math.floor(peaks.length * 0.7))]; // 留偏後段的那個（高潮靠副歌）
      for (const o of peaks) {
        if (o === keep) continue;
        const pcs = CHORDS[song.chords[Math.floor(o.c / SEG)]] || [0, 4, 7];
        moveLead(song, o, nearestChordTone(o.midi - 3, pcs, LEAD_LO, o.midi - 1));
      }
    }
  }
  // 3b. 大跳後反向級進——跳進(≥5半音)之後同向續跳的音折返，輪廓才像人唱的
  const leadsLp = collectLead(song);
  for (let i = 2; i < leadsLp.length; i++) {
    const a = leadsLp[i - 2], b = leadsLp[i - 1], o = leadsLp[i];
    const leap = b.midi - a.midi, next = o.midi - b.midi;
    if (Math.abs(leap) >= 5 && Math.sign(next) === Math.sign(leap) && Math.abs(next) > 2) {
      const pcs = CHORDS[song.chords[Math.floor(o.c / SEG)]] || [0, 4, 7];
      const scale = chordAwareScale(T.scale, pcs, T.keepClash);
      moveLead(song, o, scaleWalk(b.midi, scale, leap > 0 ? -1 : 1, LEAD_LO, LEAD_HI));
    }
  }

  // 4. 終止式：全曲最後一個 lead → 第一個和弦的根音（回到主和弦感），拉長
  const leads3 = collectLead(song);
  const fin = leads3[leads3.length - 1];
  if (fin) {
    const homePcs = CHORDS[song.chords[0]] || [9, 0, 4];
    const tonic = nearestChordTone(fin.midi, [homePcs[0]], LEAD_LO, LEAD_HI);
    moveLead(song, fin, tonic);
    const key = midiToRow(tonic) + ',' + fin.c;
    song.spans[key] = Math.max(song.spans[key] || 1, Math.min(4, song.steps - fin.c));
  }
}

// ===== 日夜配對：從日版衍生夜間變奏 =====
// 不是單純放慢——保留和弦與動機骨架，但：旋律抽疏成連音、和聲變長音鋪底、
// 貝斯半密度、鼓組退到心跳程度、去掉重音。搭配 nightMixerPatch 的回音加深。
export function nightVariant(day) {
  const song = JSON.parse(JSON.stringify(day));
  const rng = new Rng(String(day.seed || 'seed') + '|night');
  song.bpm = Math.max(60, Math.round(day.bpm * 0.78));
  song.seed = (day.seed || '—') + '·夜';
  song.tone = { ...(song.tone || {}), lead: 'piano' }; // 夜版統一鋼琴「回憶版」質感

  const steps = song.steps;

  // --- 主旋律：保留強拍骨架，抽掉部分弱拍，剩下的音連成 legato ---
  const leads = collectLead(song);
  for (const o of leads) {
    if (o.c % 8 === 0) continue;                    // 段首永遠保留（動機錨點）
    const drop = o.c % 4 === 0 ? 0.25 : 0.55;       // 弱拍抽更多
    if (rng.chance(drop)) {
      delete song.notes[o.key]; delete song.spans[o.key];
      delete song.vels[o.key]; delete song.slides[o.key];
    }
  }
  const kept = collectLead(song);
  for (let i = 0; i < kept.length; i++) {
    const gap = (kept[i + 1] ? kept[i + 1].c : Math.min(steps, kept[i].c + 8)) - kept[i].c;
    const span = Math.max(song.spans[kept[i].key] || 1, Math.min(gap, 8));
    if (span > 1) song.spans[kept[i].key] = span;
    delete song.vels[kept[i].key];                  // 全部轉輕
  }

  // --- 和聲：全部換成段落長音鋪底 ---
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'harm') { continue; }
    delete song.notes[k]; delete song.spans[k]; delete song.vels[k]; delete song.slides[k];
  }
  for (let seg = 0; seg < steps / SEG; seg++) {
    if (!rng.chance(0.85)) continue;
    const pcs = CHORDS[song.chords[seg]] || [];
    if (!pcs.length) continue;
    const tone = nearestChordTone(69, pcs, HARM_LO, 74);
    const key = midiToRow(tone) + ',' + seg * SEG;
    if (song.notes[key]) continue;
    song.notes[key] = 'harm';
    song.spans[key] = SEG;
  }

  // --- 貝斯：半密度、長音 ---
  const bassKeys = Object.entries(song.notes).filter(([, v]) => v === 'bass').map(([k]) => k);
  for (const k of bassKeys) {
    const c = +k.split(',')[1];
    if (c % 4 !== 0) { delete song.notes[k]; delete song.spans[k]; }
    else song.spans[k] = 4;
  }

  // --- 噪音火花：只留段落交界 ---
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'noise') continue;
    const c = +k.split(',')[1];
    const onBoundary = (song.secTags || []).some(s => Math.abs(s.startBar * 16 - 1 - c) <= 1);
    if (!onBoundary) { delete song.notes[k]; delete song.spans[k]; }
  }

  // --- 鼓：退到心跳程度 ---
  const drums = {};
  for (const [k, v] of Object.entries(song.drums)) {
    if (!v) continue;
    const [l, c] = k.split(',').map(Number);
    if (l === 0 && (c % 16 === 0 || (c % 16 === 8 && rng.chance(0.6)))) drums[k] = 1;  // 大鼓：每小節 1~2 下
    if (l === 1 && c % 16 === 12 && rng.chance(0.35)) drums[k] = 1;                     // 小鼓：偶爾點一下
    if (l === 2 && c % 8 === 4) drums[k] = 1;                                           // 踏鈸：反拍呼吸
  }
  song.drums = drums;
  return song;
}

// 夜版建議混音（套用時備份原值，切回日版還原）
// 夜版主奏自動換鋼琴 —— Undertale 式「回憶版」質感
export const NIGHT_MIXER_PATCH = {
  echo: 18, echoFb: 34, vibrato: 48, susDecay: 62,
  duty: { lead: 'piano', harm: '12.5%' },
  vol: { noise: 40, drum: 58 },
};

function collectLead(song) {
  const out = [];
  for (const [k, v] of Object.entries(song.notes)) {
    if (v !== 'lead') continue;
    const [r, c] = k.split(',').map(Number);
    out.push({ r, c, midi: rowToMidi(r), key: k });
  }
  return out.sort((a, b) => a.c - b.c);
}

function moveLead(song, o, midi) {
  if (midi === o.midi) return;
  const span = song.spans[o.key], vel = song.vels[o.key];
  delete song.notes[o.key]; delete song.spans[o.key]; delete song.vels[o.key];
  const key = midiToRow(midi) + ',' + o.c;
  song.notes[key] = 'lead';
  if (span) song.spans[key] = span;
  if (vel) song.vels[key] = vel;
  o.midi = midi; o.key = key; o.r = midiToRow(midi);
}
