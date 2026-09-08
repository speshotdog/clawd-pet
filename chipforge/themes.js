// 主題資料包：每個主題 = 純資料（BPM 範圍、音階、和弦進行池、節奏池、貝斯型、鼓型）
// rhythms: 半小節(8步)內的起音位置。bassPat: [步位, 音型] r=根音 5=五度 o=高八度 3=三度
export const THEMES = {
  // ===== JPOP 流行（2026-07-18 新增：王道/小室/丸サ/卡農進行）=====
  // 2026-07-18 用戶裁決：stardrive 特別好、idolstage 換樂器後留、confession 補搖擺後留；
  // seishun / citypop / rainpop 淘汰（王道 J-rock、丸サ citypop、卡農抒情三案不對味）
  stardrive: {
    label: '星夜兜風', icon: '✪', bpm: [108, 132], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'saw', 'strings', '25%'],
    progs: [['Am', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G'], ['Fmaj7', 'G', 'Em7', 'Am7'], ['Dm7', 'G', 'C', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'r'], [7, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true
  },
  idolstage: {
    label: '偶像舞台', icon: '♥', bpm: [138, 164], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['50%', 'fm', 'saw'], // 2026-07-18 換樂器：拿掉 bell/25%，改亮方波/電鋼/鋸齒

    progs: [['C', 'G', 'Am', 'F'], ['Fmaj7', 'G', 'Em', 'Am'], ['F', 'G', 'C', 'Am'], ['Dm7', 'G7', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 4, 5, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, fill: true
  },
  confession: {
    label: '放學告白', icon: '♡', bpm: [88, 106], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'strings', 'fm'], // 2026-07-18 補味道：鋼琴/小提琴優先＋doo-wop 三連搖擺
    progs: [['C', 'Am', 'Dm7', 'G7'], ['C', 'Em', 'Am', 'G'], ['Fmaj7', 'Em7', 'Dm7', 'G7'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4], [0, 3, 4, 6], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, swing: true
  },
  bright: {
    label: '明亮草原', icon: '☀', bpm: [128, 160], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'F', 'G'], ['F', 'G', 'C', 'C'], ['C', 'G', 'Am', 'F']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 2, 4, 5, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  sad: {
    label: '離別之淚', icon: '☂', bpm: [76, 102], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'piano', '25%', 'bell'],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'F', 'Em', 'Am'], ['F', 'G', 'Em', 'Am']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6], [0, 3, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, minor: true
  },
  battle: {
    label: '遭遇戰鬥', icon: '⚔', bpm: [156, 186], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Am', 'F', 'E'], ['Am', 'G', 'F', 'E'], ['Am', 'F', 'G', 'Am'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true, arp: true
  },
  lastboss: {
    label: '最終魔王', icon: '☠', bpm: [162, 192], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Am', 'G', 'Bb', 'E'], ['Dm', 'Bb', 'E', 'Am'], ['Am', 'Bb', 'G', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [3, 'r'], [4, '5'], [5, 'r'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true, keepClash: true, arp: true
  },
  temple: {
    label: '古老神殿', icon: '⛩', bpm: [84, 110], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'D', 'Am', 'G'], ['Em', 'D', 'Am', 'Am'], ['Am', 'Bm', 'G', 'Am']],
    rhythms: [[0], [0, 4], [0, 6], [0, 3, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 10], snare: [] }, fill: false, minor: true
  },
  cave: {
    label: '幽暗洞窟', icon: '◆', bpm: [88, 112], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Am', 'Em'], ['Am', 'G', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 3, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [3, 'r'], [6, '5']],
    drums: { kick: [0, 7, 8], snare: [12] }, fill: false, minor: true
  },
  snow: {
    label: '靜謐雪原', icon: '❄', bpm: [92, 120], scale: [0, 2, 4, 6, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'Em'], ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['F', 'C', 'G', 'C'], ['Am', 'F', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 2, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  desert: {
    label: '灼熱沙漠', icon: '♨', bpm: [108, 138], scale: [9, 10, 1, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Dm', 'Am', 'Bb', 'Am'], ['Am', 'Bb', 'E', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 3, 6], [0, 3, 4, 6], [0, 1, 3, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [3, 'r'], [4, '5'], [7, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: true, minor: true, keepClash: true
  },
  wafu: {
    label: '和風庭園', icon: '❀', bpm: [96, 126], scale: [0, 2, 4, 7, 9],
    tones: ['pluck', 'pluck', '25%'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'Em', 'G', 'Am'], ['C', 'G', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4], [0, 4, 5]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  space: {
    label: '無垠宇宙', icon: '✦', bpm: [104, 136], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'E', 'C'], ['C', 'Bb', 'D', 'C'], ['Am', 'D', 'C', 'E']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, keepClash: true
  },
  chase: {
    label: '全速追逐', icon: '➤', bpm: [168, 196], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'G', 'Am', 'G'], ['Am', 'C', 'G', 'Am'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6], [0, 2, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [4, '5'], [5, 'o'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  beach: {
    label: '碧海沙灘', icon: '~', bpm: [112, 138], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['Cmaj7', 'Fmaj7', 'Dm7', 'G7'], ['C', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'C']],
    rhythms: [[0, 3, 6], [0, 3, 4, 7], [0, 2, 3, 6], [0, 3, 5, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, '5']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: false
  },
  pastoral: {
    label: '田園牧歌', icon: '♣', bpm: [100, 128], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'Dm', 'G', 'C'], ['F', 'C', 'Dm', 'G']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 2, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  title: {
    label: '標題畫面', icon: '◈', bpm: [96, 124], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'Em', 'F', 'G'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4], [0, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12] }, fill: true
  },
  victory: {
    label: '勝利凱旋', icon: '★', bpm: [132, 160], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'C', 'C'], ['F', 'G', 'C', 'G']],
    rhythms: [[0, 2, 3], [0, 2, 3, 4], [0, 1, 2, 4], [0, 2, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8], snare: [4, 12] }, fill: true, jingle: true
  },
  gameover: {
    label: '遊戲結束', icon: '✝', bpm: [66, 88], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Dm', 'E', 'Am'], ['Am', 'F', 'E', 'Am'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, jingle: true
  },
  edm: {
    label: '電音派對', icon: '♫', bpm: [124, 132], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'C', 'F', 'G'], ['Am', 'G', 'F', 'F']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 7], [0, 2, 4, 6, 7], [0, 1, 4, 5], [0, 3, 6, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  arcade: {
    label: '街機對戰', icon: '◎', bpm: [150, 178], scale: [0, 2, 4, 5, 7, 9, 10],
    progs: [['C', 'Bb', 'F', 'C'], ['C', 'F', 'Bb', 'G'], ['C', 'G', 'Bb', 'F']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6], [0, 2, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 10] }, fill: true, arp: true
  },
  forest: {
    label: '神秘森林', icon: '♠', bpm: [90, 118], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'G', 'D', 'Am'], ['Am', 'Em', 'D', 'Am'], ['Am', 'Bm', 'D', 'Em']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 5], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [4] }, fill: false, minor: true
  },
  pirate: {
    label: '海盜船歌', icon: '☸', bpm: [132, 162], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'F', 'G', 'Am'], ['Am', 'C', 'G', 'Am']],
    rhythms: [[0, 3, 4], [0, 3, 4, 7], [0, 2, 3, 6], [0, 3, 6, 7], [0, 1, 3, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: true, minor: true
  },
  factory: {
    label: '機械工廠', icon: '⚙', bpm: [118, 144], scale: [0, 2, 3, 5, 7, 8, 10],
    progs: [['Am', 'Am', 'Gm', 'Am'], ['Am', 'Bb', 'Gm', 'Am'], ['Dm', 'Am', 'Gm', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [4, 'r'], [5, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true, keepClash: true
  },
  skycity: {
    label: '天空之城', icon: '☁', bpm: [108, 136], scale: [0, 2, 4, 6, 7, 9, 11],
    progs: [['C', 'D', 'G', 'C'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'C']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4], [0, 3, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  dungeon: {
    label: '地下迷宮', icon: '▦', bpm: [80, 104], scale: [9, 10, 0, 2, 4, 5, 7],
    progs: [['Am', 'Bb', 'Am', 'Am'], ['Am', 'Gm', 'Bb', 'Am'], ['Dm', 'Bb', 'Am', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 3], [0, 4, 7]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 9], snare: [] }, fill: false, minor: true, keepClash: true
  },
  festival: {
    label: '祭典之夜', icon: '✺', bpm: [140, 168], scale: [0, 2, 4, 7, 9],
    progs: [['C', 'Am', 'C', 'G'], ['C', 'F', 'G', 'C'], ['Am', 'C', 'G', 'C']],
    rhythms: [[0, 2, 3, 4], [0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 10, 12], hat: [2, 6, 14] }, fill: true, arp: true
  },
  rainynight: {
    label: '雨夜咖啡', icon: '☕', bpm: [72, 96], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Am7', 'Dm7', 'G7', 'Cmaj7']],
    rhythms: [[0, 3], [0, 4, 7], [0, 3, 6], [0, 2, 5], [0, 4]],
    bassPat: [[0, 'r'], [4, '5'], [7, '3']],
    drums: { kick: [0, 10], snare: [8], hat: [4, 12] }, fill: false, swing: true
  },
  // ===== 大自然（追加）=====
  swamp: {
    label: '迷霧沼澤', icon: '≈', bpm: [82, 106], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Dm', 'Am'], ['Am', 'Dm', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Em']],
    rhythms: [[0], [0, 5], [0, 4], [0, 3, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [5, '5']],
    drums: { kick: [0, 11], snare: [], hat: [6] }, fill: false, minor: true
  },
  mountain: {
    label: '高山霜峰', icon: '△', bpm: [88, 116], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'F', 'C'], ['C', 'F', 'Am', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  firefly: {
    label: '螢火蟲夜', icon: '✧', bpm: [92, 116], scale: [0, 2, 4, 7, 9],
    progs: [['Am', 'C', 'G', 'Am'], ['C', 'Am', 'Em', 'G'], ['Am', 'Em', 'C', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 5], [0, 2, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  // ===== 都市（追加）=====
  neon: {
    label: '霓虹街頭', icon: '◪', bpm: [112, 136], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Am7', 'Dm7', 'G7', 'Cmaj7'], ['Cmaj7', 'Am7', 'Fmaj7', 'G7']],
    rhythms: [[0, 3, 6], [0, 2, 4, 7], [0, 3, 4, 6], [0, 2, 5, 6]],
    bassPat: [[0, 'r'], [3, 'o'], [4, 'r'], [7, '5']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  station: {
    label: '車站月台', icon: '▤', bpm: [96, 120], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Em7', 'F', 'G7'], ['C', 'Am7', 'F', 'G'], ['Fmaj7', 'G', 'Em7', 'Am7']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [6, 14] }, fill: false
  },
  rooftop: {
    label: '高樓天台', icon: '☾', bpm: [100, 124], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am7', 'Dm7', 'G', 'Cmaj7'], ['Am7', 'Fmaj7', 'Dm7', 'Em7'], ['Dm7', 'Em7', 'Am7', 'Am7']],
    rhythms: [[0, 3], [0, 4, 7], [0, 3, 6], [0, 5]],
    bassPat: [[0, 'r'], [4, '5'], [7, 'o']],
    drums: { kick: [0, 10], snare: [8], hat: [4, 12] }, fill: false, minor: true
  },
  // ===== 村莊（追加）=====
  fishing: {
    label: '漁村碼頭', icon: '⚓', bpm: [104, 132], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'G', 'F', 'C'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 3, 4], [0, 2, 4, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, '5']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: false
  },
  market: {
    label: '市集喧囂', icon: '♒', bpm: [132, 160], scale: [0, 2, 4, 5, 7, 9, 10],
    progs: [['C', 'Bb', 'C', 'G'], ['C', 'F', 'Bb', 'C'], ['C', 'G', 'Bb', 'F']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 7], [0, 1, 4, 6], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  hamlet: {
    label: '山中小屋', icon: '⌂', bpm: [92, 116], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Dm', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 3], [0, 3, 6], [0, 4], [0, 2, 4]],
    bassPat: [[0, 'r'], [3, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  // ===== 特殊設施（追加）=====
  library: {
    label: '魔法圖書館', icon: '✎', bpm: [88, 110], scale: [0, 2, 4, 6, 7, 9, 11],
    // 進行全部以 C 開頭結尾：利底亞的神秘靠 D 和弦，「家」不能丟（聽感回報：聽不出主體）
    progs: [['C', 'D', 'Em', 'C'], ['C', 'Em', 'D', 'C'], ['C', 'D', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 6], [0, 5]],
    bassPat: [[0, 'r'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  alchemy: {
    label: '鍊金工房', icon: '⚗', bpm: [108, 136], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'D', 'Am', 'G'], ['Am', 'Bm', 'D', 'Am'], ['Em', 'D', 'Am', 'Bm']],
    rhythms: [[0, 3, 6], [0, 2, 4, 7], [0, 3, 4], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 6, 8], snare: [12], hat: [2, 10] }, fill: false, minor: true
  },
  casino: {
    label: '地下賭場', icon: '♦', bpm: [118, 144], scale: [0, 2, 3, 4, 7, 9, 10],
    progs: [['C7', 'F7', 'C7', 'G7'], ['C7', 'A7', 'Dm7', 'G7'], ['F7', 'C7', 'G7', 'C7']],
    rhythms: [[0, 3, 4], [0, 2, 3, 6], [0, 3, 6, 7], [0, 1, 4, 5]],
    bassPat: [[0, 'r'], [2, '3'], [4, '5'], [6, '3']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, keepClash: true, swing: true
  },
  prison: {
    label: '監獄深處', icon: '▩', bpm: [76, 96], scale: [9, 10, 0, 2, 4, 5, 7],
    progs: [['Am', 'Am', 'Bb', 'Am'], ['Am', 'Gm', 'Am', 'Am'], ['Dm', 'Am', 'Bb', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 7]],
    bassPat: [[0, 'r']],
    drums: { kick: [0, 12], snare: [] }, fill: false, minor: true, keepClash: true
  },
  // ===== 室內（追加）=====
  tavern: {
    label: '酒館夜談', icon: '♨', bpm: [116, 144], scale: [0, 2, 4, 5, 7, 9, 10],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Bb', 'F', 'C'], ['G', 'C', 'F', 'G']],
    rhythms: [[0, 3, 4], [0, 2, 3, 6], [0, 3, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: true, swing: true
  },
  ballroom: {
    label: '城堡舞會', icon: '❦', bpm: [100, 126], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'G'], ['C', 'Em', 'F', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 3, 6], [0, 3], [0, 3, 5], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 10] }, fill: false
  },
  shop: {
    label: '溫馨小店', icon: '✿', bpm: [108, 132], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'Em', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 4], [0, 4, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12], hat: [4] }, fill: false
  },
  musicbox: {
    label: '音樂盒回憶', icon: '♩', bpm: [66, 88], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'bell', 'piano'],
    progs: [['C', 'Am', 'F', 'G'], ['Am', 'F', 'C', 'G'], ['C', 'Em', 'Am', 'F']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [6, 'o']],
    drums: { kick: [], snare: [] }, fill: false
  },
  // ===== 科幻世界（追加）=====
  spacestation: {
    label: '軌道太空站', icon: '◍', bpm: [100, 124], scale: [0, 2, 4, 6, 7, 9, 11],
    progs: [['C', 'D', 'Em7', 'C'], ['Cmaj7', 'D', 'G', 'Em7'], ['Am7', 'D', 'Cmaj7', 'G']],
    rhythms: [[0, 4], [0, 2, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [2, 6, 10, 14] }, fill: false
  },
  cyberchase: {
    label: '賽博追擊', icon: '⚡', bpm: [150, 176], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'F', 'G'], ['Am', 'F', 'C', 'G'], ['Am', 'C', 'G', 'Em']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [4, 'r'], [5, 'o'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  alien: {
    label: '異星荒原', icon: '❉', bpm: [84, 110], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'Bb', 'C'], ['C', 'E', 'D', 'C'], ['Am', 'Bb', 'C', 'D']],
    rhythms: [[0], [0, 5], [0, 4], [0, 3, 6], [0, 6]],
    bassPat: [[0, 'r'], [5, 'o']],
    drums: { kick: [0, 9], snare: [], hat: [5, 13] }, fill: false, keepClash: true
  },
  mothership: {
    label: '母艦機房', icon: '▣', bpm: [116, 140], scale: [9, 10, 0, 2, 4, 5, 7],
    progs: [['Am', 'Gm', 'Am', 'Bb'], ['Am', 'Bb', 'Gm', 'Am'], ['Dm', 'Am', 'Gm', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 4, 6], [0, 2, 4, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [4, 'r'], [5, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 10] }, fill: false, minor: true, keepClash: true
  },
  // ===== RPG（追加）=====
  journey: {
    label: '冒險啟程', icon: '➹', bpm: [120, 148], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'Am'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  // ===== 休閒（追加）=====
  onsen: {
    label: '泡湯溫泉', icon: '♨', bpm: [80, 104], scale: [0, 2, 4, 7, 9],
    progs: [['C', 'Am', 'C', 'G'], ['Am', 'G', 'C', 'Am'], ['C', 'G', 'Am', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [], hat: [12] }, fill: false
  },
  minigame: {
    label: '歡樂小遊戲', icon: '✪', bpm: [140, 168], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'C', 'G'], ['C', 'F', 'C', 'G'], ['C', 'Em', 'F', 'G']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 7], [0, 1, 4, 6], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  puzzle: {
    label: '謎題時間', icon: '❓', bpm: [100, 128], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'D', 'Em', 'Am'], ['Am', 'Bm', 'Em', 'D'], ['Em', 'Am', 'D', 'Am']],
    rhythms: [[0, 3, 6], [0, 4], [0, 2, 5], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [3, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [4] }, fill: false, minor: true
  },
  picnic: {
    label: '野餐時光', icon: '☘', bpm: [116, 140], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'Dm', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 4, 5]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  // ===== 特定人物戰鬥（追加）=====
  rival: {
    label: '宿敵對決', icon: '⚔', bpm: [158, 184], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'F', 'E', 'Am'], ['Am', 'C', 'F', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [5, 'r'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 10] }, fill: true, minor: true, arp: true
  },
  fallenhero: {
    label: '墮落英雄', icon: '⚰', bpm: [140, 168], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'F', 'G', 'E'], ['Am', 'Dm', 'Bb', 'E'], ['F', 'E', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 4, 6, 7], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true
  },
  mechabeast: {
    label: '機械巨獸', icon: '⛓', bpm: [144, 172], scale: [9, 10, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'Gm'], ['Am', 'Gm', 'Bb', 'Am'], ['Am', 'Bb', 'E', 'Am']],
    rhythms: [[0, 1, 4, 5], [0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [4, 'r'], [5, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true, arp: true
  },
  witch: {
    label: '魔女之舞', icon: '☽', bpm: [128, 156], scale: [9, 11, 0, 2, 4, 6, 8],
    progs: [['Am', 'Bm', 'E', 'Am'], ['Am', 'D', 'E', 'Am'], ['Dm', 'E', 'Am', 'Bm']],
    rhythms: [[0, 3, 6], [0, 3, 4, 7], [0, 2, 3, 6], [0, 3, 5, 6]],
    bassPat: [[0, 'r'], [3, '5'], [6, '5']],
    drums: { kick: [0, 6, 8], snare: [4, 12], hat: [2, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  dragon: {
    label: '龍之咆哮', icon: '🜲', bpm: [132, 160], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'F', 'E'], ['Am', 'G', 'Bb', 'Am'], ['Am', 'E', 'Bb', 'Am']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [1, 'r'], [4, '5'], [5, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [8] }, fill: true, minor: true, keepClash: true
  },
  // ===== 傳說 RPG（雷特動機系作品風）=====
  fated: {
    label: '命運對決', icon: '☄', bpm: [180, 210], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'C', 'G', 'D'], ['Am', 'C', 'G', 'Am'], ['Am', 'G', 'C', 'D']],  // i→♭III→♭VII→IV
    rhythms: [[0, 1, 2, 4], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 4, 5, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [3, 'o'], [4, 'r'], [5, 'o'], [6, 'r'], [7, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  heartbattle: {
    label: '熱血王道戰', icon: '♥', bpm: [150, 178], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['F', 'G', 'Em', 'Am'], ['F', 'G', 'Am', 'Am'], ['Dm', 'G', 'Em', 'Am'], ['F', 'G', 'C', 'Am']],  // IV→V→iii→vi 王道進行
    rhythms: [[0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 10] }, fill: true, arp: true
  },
  bonedance: {
    label: '骨頭之舞', icon: '☠', bpm: [140, 170], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'Am', 'E'], ['Am', 'C', 'G', 'E'], ['Am', 'Em', 'G', 'Am']],
    rhythms: [[0, 2, 3, 4], [0, 1, 2, 4], [0, 2, 4, 5], [0, 2, 3, 6], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [3, 'o'], [4, '5'], [5, 'o'], [6, 'r'], [7, 'o']],  // 八度彈跳＝主角
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  bonds: {
    label: '羈絆之歌', icon: '❤', bpm: [72, 96], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Em', 'F', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'G', 'Em', 'Am'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 3, 6], [0, 4], [0, 3], [0, 4, 6], [0, 2, 5]],
    bassPat: [[0, 'r'], [3, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  determination: {
    label: '決意時刻', icon: '✦', bpm: [64, 86], scale: [9, 11, 0, 2, 4, 5, 7],
    tone: { lead: 'piano' },
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'C', 'F', 'G'], ['Am', 'Em', 'F', 'G']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 7], [0]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [], snare: [] }, fill: false, minor: true
  },
  finalhope: {
    label: '最終希望', icon: '✵', bpm: [148, 176], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'Am'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  hiddenboss: {
    label: '隱藏頭目', icon: '❖', bpm: [168, 196], scale: [9, 10, 1, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Eb', 'E'], ['Am', 'Eb', 'Bb', 'E'], ['Dm', 'Bb', 'Eb', 'Am']],
    rhythms: [[0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 5, 6, 7], [0, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [3, 'r'], [4, 'r'], [5, 'r'], [6, 'r'], [7, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 10, 12], hat: [2, 6, 14] }, fill: true, minor: true, keepClash: true
  },
  // ===== 大自然（第二批追加）=====
  waterfall: {
    label: '瀑布飛瀑', icon: '⛲', bpm: [120, 148], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4, 5, 6, 7], [0, 1, 2, 4, 6], [0, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  flowerfield: {
    label: '花田', icon: '❁', bpm: [108, 134], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'Dm', 'G']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [4, 12] }, fill: false
  },
  thunderstorm: {
    label: '雷雨', icon: '☈', bpm: [124, 152], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'E', 'Am'], ['Dm', 'Am', 'E', 'Am'], ['Am', 'G', 'F', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  deepsea: {
    label: '深海', icon: '≋', bpm: [70, 96], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'Bb', 'C'], ['Am', 'D', 'C', 'E'], ['C', 'Bb', 'D', 'C']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [12] }, fill: false, keepClash: true
  },
  aurora: {
    label: '極光', icon: '❈', bpm: [72, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'D', 'G', 'Em'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'Em']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [], hat: [4, 12] }, fill: false
  },
  bamboo: {
    label: '竹林', icon: '❇', bpm: [90, 118], scale: [0, 2, 4, 7, 9],
    progs: [['Am', 'G', 'Am', 'Em'], ['C', 'G', 'Am', 'Am'], ['Am', 'Em', 'G', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [], hat: [12] }, fill: false
  },
  // ===== 都市（第二批追加）=====
  cafestreet: {
    label: '咖啡街', icon: '♬', bpm: [92, 116], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Cmaj7', 'A7', 'Dm7', 'G7']],
    rhythms: [[0, 3, 4], [0, 2, 4, 7], [0, 3, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, '3']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, swing: true
  },
  subway: {
    label: '地鐵', icon: '▬', bpm: [120, 142], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'F', 'G'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 7], [0, 2, 4, 6, 7], [0, 1, 4, 5]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true
  },
  skyline: {
    label: '商業區', icon: '▨', bpm: [118, 140], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  nightmarket: {
    label: '夜市', icon: '✸', bpm: [132, 160], scale: [0, 2, 4, 5, 7, 9, 10],
    progs: [['C', 'Bb', 'F', 'C'], ['C', 'F', 'Bb', 'C'], ['C', 'G', 'Bb', 'F']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 7], [0, 1, 4, 6], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  citypark: {
    label: '城市公園', icon: '⚘', bpm: [112, 136], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  mall: {
    label: '購物中心', icon: '◫', bpm: [116, 138], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'Em', 'Am'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 3, 4, 7], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [3, 'o'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  ferriswheel: {
    label: '摩天輪', icon: '◉', bpm: [74, 98], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Em', 'F', 'G'], ['C', 'Am', 'Dm', 'G'], ['F', 'G', 'Em', 'Am']],
    rhythms: [[0, 3, 6], [0, 3], [0, 4], [0, 3, 5]],
    bassPat: [[0, 'r'], [3, '5'], [6, '5']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  rainstreet: {
    label: '雨中街道', icon: '☔', bpm: [72, 94], scale: [9, 11, 0, 2, 4, 5, 7],
    tone: { lead: 'piano' },
    progs: [['Am7', 'Dm7', 'G', 'Cmaj7'], ['Am', 'Em', 'F', 'G'], ['Dm7', 'Em7', 'Am7', 'Am7']],
    rhythms: [[0, 3], [0, 4], [0, 3, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5'], [7, '3']],
    drums: { kick: [0, 10], snare: [8], hat: [4, 12] }, fill: false, minor: true
  },
  gamecenter: {
    label: '電玩中心', icon: '⎔', bpm: [150, 176], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'C', 'G'], ['C', 'F', 'G', 'C'], ['C', 'Em', 'F', 'G']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6], [0, 2, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  overpass: {
    label: '天橋暮色', icon: '⛅', bpm: [100, 124], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['Cmaj7', 'A7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'G7'], ['Cmaj7', 'Am7', 'Fmaj7', 'G7']],
    rhythms: [[0, 3, 6], [0, 2, 4, 7], [0, 3, 4, 6], [0, 2, 5, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, '3']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  // ===== 村莊（第二批追加）=====
  bakery: {
    label: '麵包坊', icon: '✼', bpm: [92, 114], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'Dm', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12], hat: [4] }, fill: false, swing: true
  },
  florist: {
    label: '花店', icon: '❃', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 5]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  clocktower: {
    label: '鐘樓', icon: '◷', bpm: [96, 120], scale: [0, 2, 4, 6, 7, 9, 11],
    progs: [['C', 'G', 'D', 'G'], ['C', 'D', 'Em', 'G'], ['C', 'G', 'Em', 'D']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 10] }, fill: false
  },
  farm: {
    label: '農場', icon: '✤', bpm: [120, 144], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'G', 'F', 'C'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 3, 4, 6], [0, 4, 5]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  windmill: {
    label: '風車小鎮', icon: '✻', bpm: [104, 128], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Dm', 'G', 'C'], ['F', 'C', 'G', 'Am']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [12], hat: [4, 12] }, fill: false
  },
  festvillage: {
    label: '節慶村', icon: '❋', bpm: [136, 164], scale: [0, 2, 4, 7, 9],
    progs: [['C', 'Am', 'C', 'G'], ['C', 'F', 'G', 'C'], ['Am', 'C', 'G', 'C']],
    rhythms: [[0, 2, 3, 4], [0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 10, 12], hat: [2, 6, 14] }, fill: true
  },
  wellside: {
    label: '井邊', icon: '⊚', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  ranch: {
    label: '牧場', icon: '⛰', bpm: [108, 132], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'F', 'C'], ['C', 'F', 'C', 'G'], ['F', 'G', 'C', 'C']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 10] }, fill: false
  },
  chapel: {
    label: '村莊教堂', icon: '✟', bpm: [66, 88], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['organ', 'organ', 'piano', 'bell'],
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0], [0, 4], [0, 4, 6], [0, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [] }, fill: false
  },
  orchard: {
    label: '果園', icon: '❂', bpm: [112, 136], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  // ===== 特殊設施（第二批追加）=====
  lab: {
    label: '研究實驗室', icon: '⚛', bpm: [110, 134], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Am', 'G'], ['Am', 'Dm', 'Em', 'Am'], ['Am', 'G', 'Em', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7], [0, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true
  },
  arena: {
    label: '競技場', icon: '⬢', bpm: [140, 168], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['F', 'G', 'Em', 'Am'], ['F', 'G', 'C', 'Am'], ['C', 'G', 'Am', 'F']],
    rhythms: [[0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  training: {
    label: '訓練場', icon: '◇', bpm: [120, 146], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  portal: {
    label: '傳送門', icon: '⊛', bpm: [100, 126], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'E', 'C'], ['C', 'Bb', 'D', 'E'], ['Am', 'D', 'C', 'E']],
    rhythms: [[0, 4], [0, 2, 6], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [2, 6, 10, 14] }, fill: false, keepClash: true
  },
  belltower: {
    label: '鐘塔', icon: '⊕', bpm: [84, 108], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'F', 'C'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [4] }, fill: false, tones: ['bell', 'bell', '25%']
  },
  clinic: {
    label: '醫務室', icon: '✚', bpm: [70, 92], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['C', 'Em', 'F', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  workshop: {
    label: '武器工坊', icon: '⚒', bpm: [116, 140], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'F', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true
  },
  observatory: {
    label: '天文台', icon: '✫', bpm: [72, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'D', 'G', 'Em'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'Em']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [], hat: [4, 12] }, fill: false
  },
  controlroom: {
    label: '監控室', icon: '⊟', bpm: [112, 138], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Dm', 'Am'], ['Am', 'G', 'Dm', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true
  },
  // ===== 室內（第二批追加）=====
  bedroom: {
    label: '臥室', icon: '❍', bpm: [64, 86], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['C', 'Em', 'Am', 'F'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [], snare: [] }, fill: false
  },
  study: {
    label: '書房', icon: '✒', bpm: [68, 90], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['C', 'Em', 'F', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5'], [7, '3']],
    drums: { kick: [], snare: [], hat: [8] }, fill: false
  },
  kitchen: {
    label: '廚房', icon: '✾', bpm: [116, 140], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 4, 5]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false
  },
  attic: {
    label: '閣樓', icon: '⊡', bpm: [78, 100], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['Am', 'F', 'C', 'G'], ['C', 'Em', 'Am', 'F']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  bathhouse: {
    label: '大澡堂', icon: '⌇', bpm: [92, 116], scale: [0, 2, 4, 7, 9],
    progs: [['C', 'Am', 'C', 'G'], ['C', 'G', 'Am', 'C'], ['Am', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  lockerroom: {
    label: '更衣室', icon: '▥', bpm: [112, 136], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 4, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [4, 12] }, fill: false
  },
  livingroom: {
    label: '客廳', icon: '⊞', bpm: [96, 120], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12], hat: [4, 12] }, fill: false
  },
  greenhouse: {
    label: '花房', icon: '❧', bpm: [92, 114], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 5]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  secretroom: {
    label: '密室', icon: '⬚', bpm: [84, 108], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Am', 'Dm', 'E', 'Am'], ['Dm', 'Bb', 'E', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 9], snare: [], hat: [6] }, fill: false, minor: true, keepClash: true
  },
  fireplace: {
    label: '壁爐邊', icon: '✶', bpm: [66, 88], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['C', 'Em', 'F', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  // ===== 科幻世界（第二批追加）=====
  virtual: {
    label: '虛擬空間', icon: '⬡', bpm: [124, 148], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'E', 'C'], ['C', 'Bb', 'D', 'C'], ['Am', 'D', 'C', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 4, 6], [0, 2, 4, 6, 7], [0, 1, 4, 5]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, keepClash: true
  },
  robotcity: {
    label: '機器人城', icon: '⌸', bpm: [118, 142], scale: [9, 10, 0, 2, 4, 5, 7],
    progs: [['Am', 'Gm', 'Am', 'Bb'], ['Am', 'Bb', 'Gm', 'Am'], ['Dm', 'Am', 'Gm', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7], [0, 4, 6]],
    bassPat: [[0, 'r'], [1, 'r'], [4, 'r'], [5, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true, keepClash: true
  },
  timewarp: {
    label: '時光隧道', icon: '⟳', bpm: [92, 118], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'Bb', 'C'], ['Am', 'D', 'C', 'E'], ['C', 'E', 'D', 'C']],
    rhythms: [[0, 4], [0, 2, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [2, 6, 10, 14] }, fill: false, keepClash: true
  },
  datastream: {
    label: '資料流', icon: '⇊', bpm: [140, 168], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'C', 'G', 'Em'], ['Am', 'G', 'F', 'G']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  quantum: {
    label: '量子領域', icon: '⊙', bpm: [110, 138], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'E', 'C'], ['Am', 'Bb', 'C', 'D'], ['C', 'E', 'Bb', 'C']],
    rhythms: [[0, 2, 4, 6], [0, 3, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, keepClash: true
  },
  colony: {
    label: '廢棄殖民地', icon: '◨', bpm: [74, 98], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Dm', 'Am'], ['Am', 'G', 'Dm', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 4, 7]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 10], snare: [], hat: [8] }, fill: false, minor: true
  },
  starport: {
    label: '星際港', icon: '✩', bpm: [112, 138], scale: [0, 2, 4, 6, 7, 9, 11],
    progs: [['C', 'D', 'G', 'C'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'C']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 2, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true
  },
  hologram: {
    label: '全息投影', icon: '⬖', bpm: [76, 98], scale: [0, 2, 4, 6, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'D', 'G', 'Em'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'Em']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [], hat: [4, 12] }, fill: false
  },
  aiawaken: {
    label: 'AI覺醒', icon: '⏻', bpm: [120, 150], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'C', 'G', 'Em'], ['F', 'G', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  antigrav: {
    label: '反重力', icon: '⇡', bpm: [96, 120], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'Bb', 'C'], ['C', 'E', 'D', 'C'], ['Am', 'D', 'C', 'E']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [2, 10] }, fill: false, keepClash: true
  },
  // ===== RPG（第二批追加）=====
  worldmap: {
    label: '世界地圖', icon: '✹', bpm: [116, 142], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'C', 'G', 'Am'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  ruins: {
    label: '古代遺跡', icon: '▧', bpm: [84, 108], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'D', 'Am', 'G'], ['Em', 'D', 'Am', 'Am']],
    rhythms: [[0], [0, 4], [0, 6], [0, 3, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 10], snare: [], hat: [4] }, fill: false, minor: true
  },
  elfwood: {
    label: '精靈森林', icon: '✲', bpm: [96, 120], scale: [9, 11, 0, 2, 4, 6, 7],
    progs: [['Am', 'D', 'Em', 'Am'], ['Am', 'Bm', 'D', 'Am'], ['Em', 'D', 'Am', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 5]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [4, 12] }, fill: false, minor: true
  },
  royalcity: {
    label: '王城', icon: '♛', bpm: [100, 126], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'F', 'C'], ['C', 'F', 'G', 'C'], ['F', 'C', 'G', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  caravan: {
    label: '商隊之路', icon: '⛺', bpm: [112, 138], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'G', 'F', 'Am'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'F', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 4], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: false, minor: true
  },
  lostpath: {
    label: '迷失之路', icon: '⇝', bpm: [88, 112], scale: [9, 11, 0, 2, 4, 5, 7],
    progs: [['Am', 'Em', 'Dm', 'Am'], ['Am', 'Dm', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Em']],
    rhythms: [[0], [0, 5], [0, 4], [0, 3, 6]],
    bassPat: [[0, 'r'], [5, '5']],
    drums: { kick: [0, 10], snare: [8], hat: [6] }, fill: false, minor: true
  },
  // ===== 傳說 RPG（第二批追加）=====
  soul: {
    label: '決心之魂', icon: '♡', bpm: [72, 96], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'Am'], ['C', 'Em', 'F', 'G'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 6], [0, 2, 5]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  forgotten: {
    label: '遺忘旋律', icon: '❣', bpm: [66, 90], scale: [9, 11, 0, 2, 4, 5, 7],
    tone: { lead: 'piano' },
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Em', 'F', 'G'], ['Dm', 'Am', 'Em', 'Am'], ['Am', 'F', 'G', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [], snare: [] }, fill: false, minor: true
  },
  starcradle: {
    label: '星之搖籃', icon: '✬', bpm: [68, 90], scale: [0, 2, 4, 6, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'D', 'Em'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'Am', 'Em']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [], hat: [4, 12] }, fill: false
  },
  oath: {
    label: '誓言', icon: '⚑', bpm: [100, 128], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'C'], ['Am', 'F', 'G', 'C'], ['C', 'F', 'G', 'Am']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 2, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 10] }, fill: true
  },
  ghostwaltz: {
    label: '幽靈華爾滋', icon: '⚉', bpm: [110, 138], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'E', 'Am', 'Dm'], ['Am', 'Dm', 'E', 'Am'], ['Dm', 'Am', 'Bb', 'E']],
    rhythms: [[0, 3, 6], [0, 3], [0, 3, 5], [0, 2, 5]],
    bassPat: [[0, 'r'], [3, '5'], [6, '5']],
    drums: { kick: [0, 6], snare: [3, 9], hat: [0, 6, 12] }, fill: true, minor: true, keepClash: true
  },
  gentleend: {
    label: '溫柔終幕', icon: '❥', bpm: [64, 86], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['C', 'Em', 'F', 'G'], ['F', 'G', 'C', 'Am'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [], snare: [] }, fill: false
  },
  memoryshard: {
    label: '記憶碎片', icon: '◊', bpm: [72, 94], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'Em'], ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  elegy: {
    label: '英雄輓歌', icon: '☙', bpm: [66, 90], scale: [9, 11, 0, 2, 4, 5, 8],
    tone: { lead: 'piano' },
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'Em', 'F', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, minor: true
  },
  reunion: {
    label: '重逢', icon: '⟡', bpm: [80, 108], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'Am'], ['C', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [12], hat: [4, 12] }, fill: true
  },
  // ===== 休閒（第二批追加）=====
  lazynoon: {
    label: '慵懶午後', icon: '⛱', bpm: [66, 88], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Cmaj7', 'A7', 'Dm7', 'G7']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 3]],
    bassPat: [[0, 'r'], [4, '5'], [7, '3']],
    drums: { kick: [0, 10], snare: [8], hat: [4, 12] }, fill: false, swing: true
  },
  catday: {
    label: '貓咪日常', icon: '◕', bpm: [84, 106], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12], hat: [4, 12] }, fill: false, swing: true
  },
  fishingtime: {
    label: '釣魚時光', icon: '⟢', bpm: [68, 90], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'F', 'C', 'G'], ['C', 'Am', 'F', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8], hat: [12] }, fill: false
  },
  dessert: {
    label: '甜點時間', icon: '✽', bpm: [80, 102], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'F'], ['C', 'Em', 'F', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false, swing: true
  },
  stroll: {
    label: '悠閒散步', icon: '↝', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'Dm', 'G'], ['F', 'C', 'G', 'Am']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [4, 12] }, fill: false
  },
  daydream: {
    label: '發呆時光', icon: '◌', bpm: [64, 86], scale: [0, 2, 4, 6, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'D', 'G', 'Em'], ['Cmaj7', 'D', 'Em7', 'G'], ['C', 'G', 'D', 'Em']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 10], snare: [], hat: [8] }, fill: false
  },
  slowcafe: {
    label: '慢活咖啡', icon: '⚬', bpm: [66, 88], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Am7', 'Dm7', 'G7', 'Cmaj7']],
    rhythms: [[0, 3], [0, 4, 7], [0, 3, 6], [0, 4]],
    bassPat: [[0, 'r'], [4, '5'], [7, '3']],
    drums: { kick: [0, 10], snare: [8], hat: [4, 12] }, fill: false, swing: true
  },
  bedtime: {
    label: '睡前時光', icon: '⚝', bpm: [58, 78], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'Am', 'F', 'G'], ['C', 'Em', 'Am', 'F'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [], snare: [] }, fill: false
  },
  gardening: {
    label: '種花日和', icon: '❊', bpm: [84, 106], scale: [0, 2, 4, 5, 7, 9, 11],
    tone: { lead: 'piano' },
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'Dm', 'G'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8], snare: [], hat: [4, 12] }, fill: false
  },
  // ===== 頭目戰（第二批追加）=====
  abyss: {
    label: '深淵領主', icon: '⬣', bpm: [120, 150], scale: [9, 10, 1, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Dm', 'Bb', 'E', 'Am'], ['Am', 'Bb', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 4, 5]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [4, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  fallenAngel: {
    label: '墮天使', icon: '✞', bpm: [138, 166], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'F', 'G', 'E'], ['Am', 'Dm', 'Bb', 'E'], ['F', 'E', 'Am', 'Am'], ['Am', 'F', 'E', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 4, 6, 7], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 10] }, fill: true, minor: true
  },
  chaos: {
    label: '混沌核心', icon: '☢', bpm: [150, 182], scale: [9, 10, 1, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Eb', 'E'], ['Am', 'Eb', 'Bb', 'E'], ['Dm', 'Bb', 'Eb', 'Am']],
    rhythms: [[0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 5, 6, 7], [0, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [3, 'r'], [4, 'r'], [5, 'r'], [6, 'r'], [7, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 10, 12], hat: [2, 6, 14] }, fill: true, minor: true, keepClash: true
  },
  lich: {
    label: '亡靈君王', icon: '⛤', bpm: [112, 140], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'Dm', 'E', 'Am'], ['Am', 'Bb', 'E', 'Am'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 4, 5], [0, 2, 4, 6, 7], [0, 3, 4, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  colossus: {
    label: '巨神兵', icon: '◼', bpm: [120, 148], scale: [9, 10, 0, 2, 4, 5, 8],
    progs: [['Am', 'Bb', 'Am', 'Gm'], ['Am', 'Gm', 'Bb', 'Am'], ['Am', 'Bb', 'E', 'Am']],
    rhythms: [[0, 4], [0, 2, 4, 6], [0, 1, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [4, 'r'], [5, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [8] }, fill: true, minor: true, keepClash: true
  },
  twins: {
    label: '雙生子', icon: '⧓', bpm: [156, 186], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'F', 'E', 'Am'], ['Am', 'C', 'F', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [3, 'o'], [4, '5'], [5, 'o'], [6, 'r'], [7, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  timelord: {
    label: '時間支配者', icon: '⧖', bpm: [150, 180], scale: [0, 2, 4, 6, 8, 10],
    progs: [['C', 'D', 'E', 'C'], ['Am', 'Bb', 'C', 'D'], ['C', 'E', 'Bb', 'C']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, keepClash: true
  },
  truefinal: {
    label: '真·最終戰', icon: '✯', bpm: [168, 200], scale: [9, 11, 0, 2, 4, 5, 8],
    progs: [['Am', 'F', 'G', 'E'], ['Am', 'Bb', 'F', 'E'], ['Dm', 'Bb', 'E', 'Am'], ['Am', 'G', 'F', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [3, 'o'], [4, '5'], [5, 'o'], [6, 'r'], [7, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  // ===== 2026-07-18 大擴充 P1：JPOP+10 =====
  nightbus: {
    label: '夜行巴士', icon: '🚌', bpm: [86, 102], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['fm', 'strings', 'piano'],
    progs: [['Am', 'F', 'G', 'C'], ['Am', 'F', 'C', 'G'], ['Am', 'Dm7', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, minor: true
  },
  graduation: {
    label: '畢業式', icon: '🎓', bpm: [76, 96], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'strings', 'fm'],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'Em', 'Am'], ['C', 'Am', 'Dm7', 'G7']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false
  },
  conbini: {
    label: '便利商店', icon: '🏪', bpm: [116, 134], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'bell', '25%'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'F', 'G7'], ['Dm7', 'G7', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, fill: true
  },
  midnightradio: {
    label: '深夜電台', icon: '📻', bpm: [80, 98], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'piano'],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Am7', 'Dm7', 'G7', 'Cmaj7']],
    rhythms: [[0, 4], [0, 3, 6], [0, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5'], [7, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false, archetype: 'solo'
  },
  encore: {
    label: '安可燈海', icon: '🔦', bpm: [72, 92], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['strings', 'piano', 'fm'],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'Am'], ['Am', 'F', 'G', 'C']],
    rhythms: [[0, 4], [0, 4, 6], [0, 2, 4, 6], [0, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0], snare: [8] }, fill: false
  },
  tsuukin: {
    label: '通勤電車', icon: '🚃', bpm: [120, 140], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['25%', 'fm', 'saw'],
    progs: [['Am', 'G', 'F', 'G'], ['Am', 'C', 'G', 'Am'], ['F', 'G', 'Am', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 2, 3, 4, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  hatsuyuki: {
    label: '初雪之戀', icon: '⛄', bpm: [88, 106], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'strings', 'piano'],
    progs: [['C', 'Em', 'Am', 'G'], ['Fmaj7', 'G', 'Em7', 'Am7'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  karaoke: {
    label: '卡拉OK之夜', icon: '🎤', bpm: [128, 150], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['50%', 'fm', '25%'],
    progs: [['C', 'F', 'G', 'C'], ['Am', 'F', 'G', 'C'], ['C', 'G', 'F', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6, 7], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: true
  },
  seasideroad: {
    label: '海岸公路', icon: '🌊', bpm: [112, 130], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'pluck', 'saw'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['F', 'G', 'C', 'Am'], ['C', 'Dm7', 'G7', 'C']],
    rhythms: [[0, 3, 6], [0, 3, 4, 6], [0, 2, 4, 6], [0, 3, 5, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, 'o']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true
  },
  shibuya: {
    label: '澀谷交叉口', icon: '🚦', bpm: [124, 144], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['fm', 'saw', '25%'],
    progs: [['Am7', 'Dm7', 'G7', 'Cmaj7'], ['Am', 'F', 'G', 'Am'], ['Fmaj7', 'G7', 'Am7', 'Am7']],
    rhythms: [[0, 2, 3, 6], [0, 3, 6], [0, 2, 4, 6], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [3, 'o'], [4, '5'], [6, 'r'], [7, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  // ===== 大自然+10 =====
  canyon: {
    label: '大峽谷', icon: '🏜', bpm: [96, 120], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['25%', 'organ', '50%'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'C', 'G', 'Am'], ['Em', 'G', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, minor: true
  },
  rainforest: {
    label: '雨林深處', icon: '🌴', bpm: [104, 126], scale: [9, 0, 2, 4, 7],
    tones: ['pluck', '25%', 'bell'],
    progs: [['Am', 'Em', 'G', 'Am'], ['Am', 'G', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [3, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  tundra: {
    label: '極地凍原', icon: '🧊', bpm: [80, 100], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['organ', 'bell', 'strings'],
    progs: [['Am', 'Em', 'Am', 'G'], ['Am', 'G', 'Em', 'Em'], ['Em', 'Am', 'G', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0, 10], snare: [] }, fill: false, minor: true, archetype: 'ostinato'
  },
  dawnmeadow: {
    label: '晨露草地', icon: '🌾', bpm: [92, 114], scale: [0, 2, 4, 7, 9],
    tones: ['pluck', 'bell', '25%'],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  starlake: {
    label: '星空湖畔', icon: '🌌', bpm: [76, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'strings', 'fm'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'G', 'Am', 'Em'], ['Fmaj7', 'Cmaj7', 'G', 'C']],
    rhythms: [[0], [0, 6], [0, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0], snare: [] }, fill: false, archetype: 'ostinato'
  },
  sandstorm: {
    label: '沙暴來襲', icon: '🌪', bpm: [140, 168], scale: [9, 10, 1, 2, 4, 5, 8],
    tones: ['saw', '25%', '50%'],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Dm', 'Bb', 'E', 'Am'], ['Am', 'Bb', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6], [0, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [3, 'r'], [4, '5'], [6, 'r'], [7, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: true, minor: true, keepClash: true
  },
  sakurafall: {
    label: '櫻吹雪', icon: '🌸', bpm: [84, 104], scale: [0, 2, 4, 7, 9],
    tones: ['pluck', 'bell', 'strings'],
    progs: [['C', 'Am', 'F', 'G'], ['Am', 'G', 'C', 'Am'], ['C', 'G', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  coralreef: {
    label: '珊瑚礁光', icon: '🐠', bpm: [100, 122], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'fm', 'pluck'],
    progs: [['Cmaj7', 'Fmaj7', 'Dm7', 'G7'], ['C', 'Am7', 'Fmaj7', 'G'], ['Fmaj7', 'Em7', 'Dm7', 'C']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 3, 4, 7], [0, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  volcano: {
    label: '火山口', icon: '🌋', bpm: [132, 160], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['50%', 'saw', '25%'],
    progs: [['Am', 'Bb', 'E', 'Am'], ['Am', 'G', 'Bb', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true, keepClash: true
  },
  mistvalley: {
    label: '霧之谷', icon: '🌫', bpm: [72, 92], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['organ', 'strings', 'bell'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'Em', 'G', 'Am'], ['Em', 'D', 'Am', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, archetype: 'ostinato'
  },
  // ===== 都市+10 =====
  harbor: {
    label: '港灣夜色', icon: '⚓', bpm: [92, 112], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'piano', 'strings'],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Fmaj7', 'G7', 'Cmaj7', 'Am7'], ['C', 'Am', 'Dm7', 'G7']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [7, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false
  },
  expressway: {
    label: '高速公路', icon: '🛣', bpm: [132, 156], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['saw', 'fm', '25%'],
    progs: [['Am', 'F', 'G', 'Am'], ['Am', 'C', 'G', 'F'], ['Am', 'G', 'F', 'G']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 2, 3, 4, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [4, '5'], [5, 'o'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  backalley: {
    label: '後巷貓影', icon: '🐈', bpm: [104, 126], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['fm', 'pluck', '25%'],
    progs: [['Am7', 'Dm7', 'Em7', 'Am7'], ['Am', 'G', 'Em', 'Am'], ['Dm7', 'G7', 'Am7', 'Am7']],
    rhythms: [[0, 3, 6], [0, 2, 3, 6], [0, 3, 4, 7], [0, 2, 6]],
    bassPat: [[0, 'r'], [3, 'o'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: false, minor: true
  },
  dawnmetro: {
    label: '清晨地鐵', icon: '🚇', bpm: [108, 128], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['25%', 'fm', 'bell'],
    progs: [['C', 'G', 'Am', 'F'], ['Dm7', 'G7', 'C', 'C'], ['F', 'G', 'Em', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 4, 6], [0, 2, 4], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, fill: false
  },
  rooftopbar: {
    label: '空中酒吧', icon: '🍸', bpm: [96, 116], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'bell', 'piano'],
    progs: [['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Cmaj7', 'Am7', 'Fmaj7', 'G7'], ['Dm7', 'G7', 'Cmaj7', 'Am7']],
    rhythms: [[0, 3, 6], [0, 4, 7], [0, 3, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false, swing: true
  },
  basementclub: {
    label: '地下俱樂部', icon: '🎧', bpm: [124, 145], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['saw', 'fm', '50%'],
    progs: [['Am', 'Am', 'F', 'G'], ['Am', 'F', 'Am', 'G'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 4, 5, 6], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  oldtown: {
    label: '舊城石板路', icon: '🏘', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'organ', 'bell'],
    progs: [['C', 'F', 'C', 'G'], ['Am', 'F', 'C', 'G'], ['C', 'Dm', 'G', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  trainyard: {
    label: '調車場', icon: '🚂', bpm: [112, 136], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['25%', 'saw', 'fm'],
    progs: [['Am', 'G', 'Am', 'G'], ['Am', 'Em', 'F', 'G'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 2, 3, 4, 6], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true
  },
  neonrain: {
    label: '霓虹雨', icon: '🌂', bpm: [100, 122], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['fm', 'bell', 'strings'],
    progs: [['Am7', 'Fmaj7', 'G7', 'Am7'], ['Am', 'F', 'Em', 'Am'], ['Fmaj7', 'Em7', 'Am7', 'Am7']],
    rhythms: [[0, 3, 6], [0, 4, 6], [0, 2, 3, 6], [0, 4, 7]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, minor: true
  },
  skybridge: {
    label: '天橋夕陽', icon: '🌇', bpm: [104, 124], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', '25%', 'pluck'],
    progs: [['C', 'G', 'Am', 'F'], ['Fmaj7', 'G', 'Em7', 'Am7'], ['C', 'Em', 'F', 'G']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false
  },
  // ===== 村莊+10 =====
  vineyard: {
    label: '葡萄園', icon: '🍇', bpm: [100, 122], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', '25%', 'fm'],
    progs: [['C', 'F', 'G', 'C'], ['F', 'C', 'Dm', 'G'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 3, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  shepherdhill: {
    label: '牧羊坡', icon: '🐑', bpm: [88, 110], scale: [0, 2, 4, 7, 9],
    tones: ['organ', 'pluck', 'bell'],
    progs: [['C', 'G', 'C', 'F'], ['C', 'Am', 'G', 'C'], ['F', 'G', 'C', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  harvestfest: {
    label: '豐收祭', icon: '🎑', bpm: [126, 148], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', '50%', '25%'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: true
  },
  watermill: {
    label: '水車小屋', icon: '🛞', bpm: [92, 112], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'bell', '25%'],
    progs: [['C', 'Dm', 'G', 'C'], ['C', 'F', 'C', 'G'], ['Am', 'F', 'G', 'C']],
    rhythms: [[0, 2, 4, 6], [0, 4], [0, 2, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, archetype: 'ostinato'
  },
  smithy: {
    label: '鐵匠鋪', icon: '🔨', bpm: [112, 134], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['25%', '50%', 'pluck'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'C', 'G', 'Am'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true
  },
  herbgarden: {
    label: '藥草園', icon: '🌿', bpm: [84, 104], scale: [0, 2, 4, 7, 9],
    tones: ['bell', 'pluck', 'organ'],
    progs: [['C', 'G', 'Am', 'Em'], ['C', 'F', 'G', 'C'], ['Am', 'G', 'C', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [] }, fill: false
  },
  innfire: {
    label: '旅店爐火', icon: '🕯', bpm: [80, 100], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'piano', 'fm'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'C', 'G'], ['Am', 'Dm', 'G', 'C']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, swing: true
  },
  maplevillage: {
    label: '楓紅山村', icon: '🍁', bpm: [92, 114], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'fm', 'bell'],
    progs: [['C', 'G', 'Am', 'F'], ['Am', 'F', 'C', 'G'], ['F', 'Em', 'Dm', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  snowvillage: {
    label: '雪夜山村', icon: '🏔', bpm: [76, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'organ', 'strings'],
    progs: [['C', 'G', 'Am', 'Em'], ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['Am', 'F', 'G', 'C']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [] }, fill: false
  },
  moonwell: {
    label: '月光井', icon: '🌙', bpm: [72, 92], scale: [9, 0, 2, 4, 7],
    tones: ['bell', 'strings', 'pluck'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'C', 'G', 'Am'], ['Em', 'G', 'Am', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, archetype: 'ostinato'
  },
  // ===== 特殊設施+10 =====
  greathall: {
    label: '王城大廳', icon: '👑', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['organ', '50%', 'strings'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'Am', 'F'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 2, 3, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  archive: {
    label: '禁書庫', icon: '📜', bpm: [76, 96], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['bell', 'organ', 'fm'],
    progs: [['Am', 'Em', 'Am', 'G'], ['Am', 'G', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, archetype: 'ostinato'
  },
  forgeroom: {
    label: '鍛造間', icon: '⚒', bpm: [116, 140], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['50%', '25%', 'saw'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'F', 'G', 'Am'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true
  },
  sewer: {
    label: '下水道', icon: '💧', bpm: [88, 110], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['25%', 'fm', 'pluck'],
    progs: [['Am', 'Em', 'Am', 'Em'], ['Am', 'G', 'Em', 'Am'], ['Dm', 'Am', 'Em', 'Am']],
    rhythms: [[0, 6], [0, 3, 6], [0, 4], [0, 4, 7]],
    bassPat: [[0, 'r'], [3, 'r'], [6, '5']],
    drums: { kick: [0, 7, 8], snare: [12] }, fill: false, minor: true
  },
  throneroom: {
    label: '王座之間', icon: '🏛', bpm: [84, 106], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['organ', 'strings', '50%'],
    progs: [['Am', 'Bb', 'E', 'Am'], ['Am', 'Dm', 'E', 'Am'], ['Am', 'G', 'F', 'E']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, minor: true, keepClash: true
  },
  crypt: {
    label: '地下墓室', icon: '⚰', bpm: [68, 88], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['organ', 'bell', 'strings'],
    progs: [['Am', 'E', 'Am', 'Dm'], ['Am', 'Bb', 'Am', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, keepClash: true, archetype: 'ostinato'
  },
  lighthouse: {
    label: '燈塔', icon: '🗼', bpm: [88, 108], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'strings', 'organ'],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'Em', 'F', 'G'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  museum: {
    label: '博物館', icon: '🏺', bpm: [80, 100], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'bell', 'organ'],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['C', 'F', 'G', 'C'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [] }, fill: false
  },
  aquarium: {
    label: '水族館', icon: '🐟', bpm: [76, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'fm', 'strings'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'G', 'Am', 'Em'], ['Fmaj7', 'G', 'Cmaj7', 'Cmaj7']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0], snare: [] }, fill: false, archetype: 'ostinato'
  },
  clockroom: {
    label: '鐘樓機房', icon: '⏰', bpm: [104, 126], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['bell', '25%', 'pluck'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'Em', 'G', 'Am'], ['Dm', 'G', 'Am', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 4], [0, 2, 4], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, minor: true, archetype: 'ostinato'
  },
  // ===== 室內+10 =====
  candlestudy: {
    label: '燭光書房', icon: '🕮', bpm: [72, 92], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'pluck', 'bell'],
    progs: [['Cmaj7', 'Am7', 'Fmaj7', 'G7'], ['C', 'Em', 'Am', 'G'], ['Fmaj7', 'Cmaj7', 'Dm7', 'G7']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [] }, fill: false, archetype: 'solo'
  },
  teatime: {
    label: '午後紅茶', icon: '🫖', bpm: [92, 112], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'piano', 'pluck'],
    progs: [['C', 'Am', 'Dm7', 'G7'], ['Cmaj7', 'Fmaj7', 'Dm7', 'G7'], ['C', 'G', 'Am', 'F']],
    rhythms: [[0, 4], [0, 3, 6], [0, 2, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, swing: true
  },
  windowseat: {
    label: '窗邊座位', icon: '🪟', bpm: [80, 100], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'piano', 'strings'],
    progs: [['C', 'G', 'Am', 'Em'], ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], ['Am', 'F', 'C', 'G']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, archetype: 'solo'
  },
  winecellar: {
    label: '酒窖', icon: '🍷', bpm: [84, 104], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['pluck', 'fm', 'organ'],
    progs: [['Am7', 'Dm7', 'G7', 'Cmaj7'], ['Am', 'Em', 'F', 'G'], ['Dm7', 'Am7', 'Em7', 'Am7']],
    rhythms: [[0, 3, 6], [0, 4], [0, 3, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [3, 'o'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, minor: true, swing: true
  },
  nursery: {
    label: '育兒搖籃', icon: '🧸', bpm: [68, 88], scale: [0, 2, 4, 7, 9],
    tones: ['bell', 'piano', 'pluck'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C']],
    rhythms: [[0, 6], [0, 4], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [], snare: [] }, fill: false, drumless: true, archetype: 'solo'
  },
  gallery: {
    label: '畫廊', icon: '🖼', bpm: [76, 96], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['piano', 'bell', 'strings'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'Em', 'F', 'G'], ['Fmaj7', 'G', 'Em7', 'Am7']],
    rhythms: [[0], [0, 4], [0, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0], snare: [] }, fill: false, archetype: 'ostinato'
  },
  elevator: {
    label: '電梯間', icon: '🛗', bpm: [96, 116], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'bell', 'pluck'],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['Dm7', 'G7', 'Cmaj7', 'Am7'], ['Fmaj7', 'G7', 'Em7', 'Am7']],
    rhythms: [[0, 3, 6], [0, 4], [0, 3, 4, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false, swing: true
  },
  sunroom: {
    label: '日光室', icon: '🌞', bpm: [88, 108], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'bell', 'fm'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'F', 'G'], ['Fmaj7', 'C', 'G', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  dollhouse: {
    label: '娃娃屋', icon: '🎎', bpm: [92, 114], scale: [0, 2, 4, 7, 9],
    tones: ['bell', 'pluck', '25%'],
    progs: [['C', 'G', 'C', 'F'], ['C', 'Am', 'G', 'C'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 4], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, archetype: 'ostinato'
  },
  stormnight: {
    label: '暴風雨夜', icon: '🌩', bpm: [72, 92], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['piano', 'strings', 'fm'],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'G', 'Am'], ['Am', 'F', 'Em', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, minor: true, archetype: 'solo'
  },
  // ===== 2026-07-18 大擴充 P2：科幻世界+10 =====
  cryosleep: {
    label: '冷凍艙', icon: '❆', bpm: [68, 88], scale: [0, 2, 4, 6, 8, 10],
    tones: ['bell', 'organ', 'fm'],
    progs: [['C', 'D', 'C', 'Bb'], ['C', 'Bb', 'D', 'C'], ['Am', 'D', 'C', 'C']],
    rhythms: [[0], [0, 6], [0, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, keepClash: true, archetype: 'ostinato'
  },
  warpgate: {
    label: '曲速門', icon: '🌀', bpm: [128, 152], scale: [0, 2, 4, 6, 8, 10],
    tones: ['saw', 'fm', '25%'],
    progs: [['C', 'D', 'E', 'C'], ['Am', 'D', 'C', 'E'], ['C', 'Bb', 'D', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 1, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, keepClash: true, arp: true
  },
  andromeda: {
    label: '仙女座', icon: '✨', bpm: [88, 110], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'strings', 'fm'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'D', 'Em', 'C'], ['Fmaj7', 'G', 'Am7', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  mechbay: {
    label: '機庫整備', icon: '🔧', bpm: [108, 130], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['25%', 'saw', 'fm'],
    progs: [['Am', 'G', 'Am', 'Em'], ['Am', 'C', 'G', 'Am'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 4], [0, 4, 6], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true
  },
  neoncircuit: {
    label: '電子迷宮', icon: '💠', bpm: [132, 156], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['saw', '25%', 'fm'],
    progs: [['Am', 'G', 'F', 'G'], ['Am', 'Em', 'G', 'Am'], ['Am', 'C', 'D', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 4, 5, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [1, 'o'], [2, 'r'], [4, '5'], [5, 'o'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  satellite: {
    label: '衛星軌道', icon: '🛰', bpm: [84, 106], scale: [0, 2, 4, 6, 8, 10],
    tones: ['fm', 'bell', 'organ'],
    progs: [['C', 'D', 'C', 'D'], ['C', 'Bb', 'C', 'D'], ['Am', 'C', 'D', 'C']],
    rhythms: [[0], [0, 4], [0, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, 'o']],
    drums: { kick: [0, 8], snare: [] }, fill: false, keepClash: true, archetype: 'ostinato'
  },
  terraform: {
    label: '地球化工程', icon: '🌍', bpm: [104, 126], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', '25%', 'organ'],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'D', 'F', 'C'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 4, 6], [0, 2, 4], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  blackhole: {
    label: '黑洞邊緣', icon: '🕳', bpm: [66, 86], scale: [9, 10, 1, 2, 4, 5, 8],
    tones: ['organ', 'strings', 'saw'],
    progs: [['Am', 'Bb', 'Am', 'Bb'], ['Am', 'Eb', 'Bb', 'Am'], ['Dm', 'Bb', 'Am', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, keepClash: true, archetype: 'ostinato'
  },
  labcore: {
    label: '核心實驗艙', icon: '🧪', bpm: [116, 138], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['fm', 'saw', 'bell'],
    progs: [['Am', 'Em', 'G', 'Am'], ['Am', 'D', 'Em', 'Am'], ['Dm', 'G', 'Am', 'Em']],
    rhythms: [[0, 2, 4, 6], [0, 3, 6], [0, 2, 4], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, fill: false, minor: true
  },
  aicradle: {
    label: 'AI搖籃曲', icon: '🤖', bpm: [72, 92], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'fm', 'strings'],
    progs: [['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['C', 'Em', 'F', 'C'], ['Fmaj7', 'Em7', 'Cmaj7', 'Cmaj7']],
    rhythms: [[0, 6], [0, 4], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [0, 10], snare: [] }, fill: false, archetype: 'solo'
  },
  // ===== RPG+10 =====
  guild: {
    label: '公會大廳', icon: '🛡', bpm: [104, 126], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['25%', 'pluck', '50%'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'Am', 'F'], ['F', 'G', 'C', 'G']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 2, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  levelup: {
    label: '升級時刻', icon: '⬆', bpm: [128, 152], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['50%', 'bell', '25%'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'C', 'C'], ['F', 'G', 'C', 'C']],
    rhythms: [[0, 2, 3], [0, 2, 3, 4], [0, 1, 2, 4], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 4, 8], snare: [4, 12] }, fill: true, jingle: true
  },
  secretgrove: {
    label: '隱藏森林', icon: '🍄', bpm: [84, 106], scale: [0, 2, 4, 6, 7, 9, 11],
    tones: ['bell', 'pluck', 'organ'],
    progs: [['C', 'D', 'Em', 'C'], ['Cmaj7', 'Fmaj7', 'Em7', 'Am7'], ['Am', 'D', 'C', 'G']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, archetype: 'ostinato'
  },
  eveoffinal: {
    label: '決戰前夜', icon: '🌒', bpm: [76, 96], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['piano', 'strings', 'fm'],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'F', 'G', 'Am'], ['Am', 'Dm', 'G', 'C']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, minor: true, archetype: 'solo'
  },
  nightfield: {
    label: '夜間平原', icon: '🌠', bpm: [92, 114], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['fm', 'pluck', 'strings'],
    progs: [['Am', 'F', 'G', 'C'], ['Am', 'G', 'F', 'Am'], ['Am', 'C', 'G', 'Am']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, minor: true
  },
  deepdungeon: {
    label: '深層迷宮', icon: '🗝', bpm: [96, 120], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['25%', 'organ', 'fm'],
    progs: [['Am', 'E', 'Am', 'Dm'], ['Am', 'Bb', 'Am', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 3, 6], [0, 4], [0, 2, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [3, 'r'], [6, '5']],
    drums: { kick: [0, 7, 8], snare: [12] }, fill: false, minor: true, keepClash: true
  },
  sidequest: {
    label: '支線任務', icon: '📌', bpm: [112, 134], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', '25%', 'bell'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'C', 'G'], ['Dm', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 3, 4, 6], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  airship: {
    label: '飛空艇', icon: '🎈', bpm: [116, 140], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['50%', 'fm', '25%'],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'G', 'C'], ['F', 'G', 'Em', 'Am']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: true
  },
  coronation: {
    label: '加冕儀式', icon: '💎', bpm: [88, 110], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['organ', 'strings', '50%'],
    progs: [['C', 'F', 'G', 'C'], ['F', 'C', 'G', 'C'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 4], [0, 2, 4], [0, 2, 3, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  epilogue: {
    label: '終章旅路', icon: '🕊', bpm: [80, 102], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'strings', 'fm'],
    progs: [['C', 'G', 'Am', 'F'], ['F', 'G', 'Em', 'Am'], ['C', 'Em', 'F', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  // ===== 傳說RPG+10 =====
  judgement: {
    label: '審判迴廊', icon: '⚖', bpm: [76, 98], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['organ', 'strings', 'bell'],
    progs: [['Am', 'Dm', 'E', 'Am'], ['Am', 'Bb', 'E', 'Am'], ['Am', 'F', 'E', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 2, 4]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, minor: true, keepClash: true
  },
  snowtown: {
    label: '白雪小鎮', icon: '🏂', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'bell', '25%'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'G', 'Am', 'F'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 3, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  twilightown: {
    label: '暮光小鎮', icon: '🌆', bpm: [84, 106], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['fm', 'pluck', 'piano'],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'G', 'F', 'Am'], ['Am', 'Dm', 'G', 'C']],
    rhythms: [[0, 4], [0, 3, 6], [0, 4, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, minor: true
  },
  mercychoice: {
    label: '慈悲抉擇', icon: '💛', bpm: [72, 94], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'bell', 'strings'],
    progs: [['C', 'Am', 'F', 'G'], ['F', 'G', 'Em', 'Am'], ['C', 'Em', 'Am', 'F']],
    rhythms: [[0, 4], [0, 6], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, archetype: 'solo'
  },
  darkworld: {
    label: '暗黑世界', icon: '♠', bpm: [116, 140], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['saw', 'fm', '25%'],
    progs: [['Am', 'G', 'Em', 'Am'], ['Am', 'D', 'Em', 'Am'], ['Am', 'C', 'D', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 3, 6], [0, 2, 3, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true, arp: true
  },
  darkfountain: {
    label: '暗之泉', icon: '⛲', bpm: [68, 90], scale: [9, 10, 1, 2, 4, 5, 8],
    tones: ['organ', 'bell', 'strings'],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Am', 'Eb', 'Bb', 'Am'], ['Dm', 'Bb', 'E', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 2, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [0], snare: [] }, fill: false, minor: true, keepClash: true, archetype: 'ostinato'
  },
  cyberfield: {
    label: '電域原野', icon: '🔋', bpm: [124, 148], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['fm', 'saw', 'bell'],
    progs: [['Am', 'G', 'F', 'G'], ['Am', 'Em', 'F', 'G'], ['Am', 'C', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 4], [0, 1, 4, 6]],
    bassPat: [[0, 'r'], [2, 'o'], [4, 'r'], [6, 'o']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, arp: true
  },
  promiseflower: {
    label: '約定之花', icon: '🌼', bpm: [80, 102], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['piano', 'strings', 'bell'],
    progs: [['C', 'G', 'Am', 'F'], ['Fmaj7', 'G', 'Em7', 'Am7'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 4], [0, 4, 6], [0, 3, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  requiem: {
    label: '安魂彌撒', icon: '🕯', bpm: [64, 84], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['organ', 'strings', 'piano'],
    progs: [['Am', 'F', 'C', 'G'], ['Am', 'Dm', 'Am', 'E'], ['Am', 'F', 'Em', 'Am']],
    rhythms: [[0], [0, 6], [0, 4], [0, 4, 6]],
    bassPat: [[0, 'r'], [6, 'r']],
    drums: { kick: [], snare: [] }, fill: false, minor: true, drumless: true, archetype: 'solo'
  },
  finalecho: {
    label: '最後迴響', icon: '🔔', bpm: [72, 94], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['bell', 'piano', 'strings'],
    progs: [['Am', 'F', 'G', 'C'], ['Am', 'G', 'F', 'E'], ['F', 'G', 'Am', 'Am']],
    rhythms: [[0, 4], [0, 6], [0, 3, 6], [0, 2, 6]],
    bassPat: [[0, 'r'], [4, '5']],
    drums: { kick: [0, 10], snare: [8] }, fill: false, minor: true, archetype: 'ostinato'
  },
  // ===== 休閒+10 =====
  boardgame: {
    label: '桌遊夜', icon: '🎲', bpm: [108, 130], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'bell', '25%'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'Am', 'Dm7', 'G7'], ['F', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false, swing: true
  },
  kiteday: {
    label: '風箏日和', icon: '🪁', bpm: [104, 126], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['25%', 'pluck', 'bell'],
    progs: [['C', 'G', 'Am', 'F'], ['C', 'F', 'C', 'G'], ['F', 'G', 'C', 'C']],
    rhythms: [[0, 2, 4], [0, 4, 6], [0, 2, 4, 6], [0, 3, 4]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  icecreamvan: {
    label: '冰淇淋車', icon: '🍦', bpm: [112, 134], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'pluck', '25%'],
    progs: [['C', 'G', 'C', 'F'], ['C', 'Am', 'F', 'G7'], ['C', 'F', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 5, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: false
  },
  supermarket: {
    label: '超市推車', icon: '🛒', bpm: [116, 138], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['fm', 'bell', 'pluck'],
    progs: [['Cmaj7', 'Am7', 'Dm7', 'G7'], ['C', 'F', 'G', 'C'], ['Dm7', 'G7', 'C', 'Am7']],
    rhythms: [[0, 3, 6], [0, 2, 4], [0, 3, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r'], [7, 'o']],
    drums: { kick: [0, 8, 10], snare: [4, 12] }, fill: false, swing: true
  },
  naptime: {
    label: '午睡墊', icon: '💤', bpm: [64, 84], scale: [0, 2, 4, 7, 9],
    tones: ['piano', 'bell', 'fm'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'C', 'G'], ['Am', 'F', 'C', 'C']],
    rhythms: [[0, 6], [0, 4], [0, 4, 6], [0, 3, 6]],
    bassPat: [[0, 'r'], [6, '5']],
    drums: { kick: [], snare: [] }, fill: false, drumless: true, archetype: 'solo'
  },
  bubblebath: {
    label: '泡泡浴', icon: '🫧', bpm: [96, 118], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'fm', 'pluck'],
    progs: [['C', 'F', 'G', 'C'], ['Cmaj7', 'Fmaj7', 'Dm7', 'G7'], ['C', 'Am', 'F', 'G']],
    rhythms: [[0, 3, 6], [0, 2, 4], [0, 4, 6], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [3, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  morningjog: {
    label: '晨跑公園', icon: '🏃', bpm: [124, 146], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['25%', 'pluck', 'fm'],
    progs: [['C', 'F', 'G', 'C'], ['C', 'G', 'Am', 'F'], ['Dm', 'G', 'C', 'Am']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] }, fill: true
  },
  campfire: {
    label: '營火晚會', icon: '🔥', bpm: [92, 114], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['pluck', 'fm', '25%'],
    progs: [['C', 'Am', 'F', 'G'], ['C', 'F', 'C', 'G'], ['Am', 'F', 'G', 'C']],
    rhythms: [[0, 4], [0, 2, 4], [0, 4, 6], [0, 3, 4, 6]],
    bassPat: [[0, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false, swing: true
  },
  balloonfair: {
    label: '氣球市集', icon: '🎈', bpm: [120, 142], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', '25%', 'pluck'],
    progs: [['C', 'G', 'C', 'F'], ['C', 'F', 'G', 'C'], ['F', 'C', 'G', 'C']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 2, 3, 4], [0, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, '5'], [4, 'r'], [6, '5']],
    drums: { kick: [0, 8], snare: [4, 12] }, fill: true
  },
  rainyplay: {
    label: '雨天室內遊', icon: '🧩', bpm: [100, 122], scale: [0, 2, 4, 5, 7, 9, 11],
    tones: ['bell', 'pluck', 'fm'],
    progs: [['C', 'Am', 'Dm7', 'G7'], ['C', 'F', 'G', 'C'], ['Fmaj7', 'G', 'C', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 4], [0, 4, 6], [0, 2, 4, 6]],
    bassPat: [[0, 'r'], [3, '5'], [4, 'r']],
    drums: { kick: [0, 8], snare: [12] }, fill: false
  },
  // ===== 頭目戰+10 =====
  shadowking: {
    label: '影之王', icon: '👤', bpm: [144, 172], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['saw', '50%', '25%'],
    progs: [['Am', 'Bb', 'Am', 'E'], ['Am', 'F', 'E', 'Am'], ['Dm', 'Bb', 'E', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [4, '5'], [5, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true, keepClash: true, arp: true
  },
  seaserpent: {
    label: '海蛇王', icon: '🐍', bpm: [136, 162], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['50%', 'saw', 'fm'],
    progs: [['Am', 'G', 'Em', 'Am'], ['Am', 'D', 'Em', 'Am'], ['Dm', 'Am', 'G', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 3, 4, 6], [0, 2, 3, 6], [0, 1, 2, 4, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [3, 'o'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true
  },
  warlord: {
    label: '戰爭領主', icon: '🪓', bpm: [148, 176], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['50%', '25%', 'saw'],
    progs: [['Am', 'G', 'F', 'E'], ['Am', 'F', 'G', 'Am'], ['Am', 'Em', 'F', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 6], [0, 2, 4, 6, 7]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true
  },
  phantomcount: {
    label: '幻影伯爵', icon: '🎭', bpm: [132, 158], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['fm', 'organ', 'saw'],
    progs: [['Am', 'E', 'Am', 'Dm'], ['Am', 'Bb', 'E', 'Am'], ['Am', 'F', 'E7', 'Am']],
    rhythms: [[0, 3, 6], [0, 2, 3, 6], [0, 2, 4, 6], [0, 3, 4, 6, 7]],
    bassPat: [[0, 'r'], [3, 'o'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [4, 12] }, fill: true, minor: true, keepClash: true, swing: true
  },
  juggernaut: {
    label: '破城巨兵', icon: '🗿', bpm: [126, 150], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['50%', 'saw', '25%'],
    progs: [['Am', 'Am', 'F', 'G'], ['Am', 'G', 'Am', 'E'], ['Dm', 'Am', 'F', 'E']],
    rhythms: [[0, 2, 4], [0, 2, 4, 6], [0, 4, 6], [0, 2, 3, 4]],
    bassPat: [[0, 'r'], [2, 'r'], [4, 'r'], [6, 'r']],
    drums: { kick: [0, 4, 8, 12], snare: [8] }, fill: true, minor: true
  },
  hellgate: {
    label: '地獄之門', icon: '🔱', bpm: [152, 180], scale: [9, 10, 1, 2, 4, 5, 8],
    tones: ['saw', '50%', '25%'],
    progs: [['Am', 'Bb', 'E', 'Am'], ['Am', 'Eb', 'Bb', 'E'], ['Dm', 'Bb', 'Am', 'E']],
    rhythms: [[0, 2, 4, 6], [0, 1, 2, 4, 6], [0, 2, 3, 4, 6, 7], [0, 1, 2, 4, 5, 6, 7]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [3, 'r'], [4, '5'], [5, 'r'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12] }, fill: true, minor: true, keepClash: true, arp: true
  },
  frostwyrm: {
    label: '冰霜巨龍', icon: '🐲', bpm: [138, 164], scale: [9, 11, 0, 2, 4, 6, 7],
    tones: ['50%', 'bell', 'saw'],
    progs: [['Am', 'Em', 'G', 'Am'], ['Am', 'G', 'D', 'Em'], ['Am', 'D', 'Em', 'Am']],
    rhythms: [[0, 2, 4, 6], [0, 2, 3, 4, 6], [0, 3, 4, 6], [0, 2, 4, 5, 6]],
    bassPat: [[0, 'r'], [2, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8, 14], snare: [4, 12] }, fill: true, minor: true, arp: true
  },
  thunderking: {
    label: '雷霆之王', icon: '⚡', bpm: [150, 178], scale: [9, 11, 0, 2, 4, 5, 8],
    tones: ['saw', '50%', 'fm'],
    progs: [['Am', 'G', 'Bb', 'E'], ['Am', 'F', 'E', 'Am'], ['Am', 'Bb', 'G', 'E']],
    rhythms: [[0, 1, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 5, 6, 7], [0, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [4, '5'], [5, 'r'], [6, 'r'], [7, '5']],
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14] }, fill: true, minor: true, keepClash: true
  },
  voidmother: {
    label: '虛空之母', icon: '🌑', bpm: [120, 146], scale: [0, 2, 4, 6, 8, 10],
    tones: ['organ', 'saw', 'fm'],
    progs: [['C', 'D', 'Bb', 'C'], ['Am', 'Bb', 'D', 'C'], ['C', 'Bb', 'D', 'E']],
    rhythms: [[0, 3, 6], [0, 2, 4, 6], [0, 4], [0, 2, 3, 6]],
    bassPat: [[0, 'r'], [3, 'r'], [4, '5'], [6, 'r']],
    drums: { kick: [0, 6, 8], snare: [12] }, fill: true, keepClash: true
  },
  berserker: {
    label: '狂戰士', icon: '🩸', bpm: [160, 188], scale: [9, 11, 0, 2, 4, 5, 7],
    tones: ['50%', '25%', 'saw'],
    progs: [['Am', 'F', 'G', 'Am'], ['Am', 'G', 'F', 'E'], ['Dm', 'Am', 'E', 'Am']],
    rhythms: [[0, 1, 2, 4, 6], [0, 2, 4, 5, 6, 7], [0, 2, 3, 4, 6, 7], [0, 1, 2, 3, 4, 6]],
    bassPat: [[0, 'r'], [1, 'r'], [2, 'r'], [3, 'r'], [4, '5'], [5, 'r'], [6, 'r'], [7, 'r']],
    drums: { kick: [0, 2, 4, 8, 10, 12], snare: [4, 12] }, fill: true, minor: true
  },
};

export const THEME_ORDER = Object.keys(THEMES);

// 曲風分類選單
export const CATEGORIES = [
  { id: 'jpop',     label: 'JPOP流行', themes: ['stardrive', 'idolstage', 'confession', 'nightbus', 'graduation', 'conbini', 'midnightradio', 'encore', 'tsuukin', 'hatsuyuki', 'karaoke', 'seasideroad', 'shibuya'] },
  { id: 'nature',   label: '大自然',   themes: ['bright', 'forest', 'snow', 'desert', 'beach', 'cave', 'swamp', 'mountain', 'firefly', 'waterfall', 'flowerfield', 'thunderstorm', 'deepsea', 'aurora', 'bamboo', 'canyon', 'rainforest', 'tundra', 'dawnmeadow', 'starlake', 'sandstorm', 'sakurafall', 'coralreef', 'volcano', 'mistvalley'] },
  { id: 'city',     label: '都市',     themes: ['edm', 'factory', 'neon', 'station', 'rooftop', 'cafestreet', 'subway', 'skyline', 'nightmarket', 'citypark', 'mall', 'ferriswheel', 'rainstreet', 'gamecenter', 'overpass', 'harbor', 'expressway', 'backalley', 'dawnmetro', 'rooftopbar', 'basementclub', 'oldtown', 'trainyard', 'neonrain', 'skybridge'] },
  { id: 'village',  label: '村莊',     themes: ['pastoral', 'wafu', 'fishing', 'market', 'hamlet', 'bakery', 'florist', 'clocktower', 'farm', 'windmill', 'festvillage', 'wellside', 'ranch', 'chapel', 'orchard', 'vineyard', 'shepherdhill', 'harvestfest', 'watermill', 'smithy', 'herbgarden', 'innfire', 'maplevillage', 'snowvillage', 'moonwell'] },
  { id: 'facility', label: '特殊設施', themes: ['temple', 'dungeon', 'library', 'alchemy', 'casino', 'prison', 'lab', 'arena', 'training', 'portal', 'belltower', 'clinic', 'workshop', 'observatory', 'controlroom', 'greathall', 'archive', 'forgeroom', 'sewer', 'throneroom', 'crypt', 'lighthouse', 'museum', 'aquarium', 'clockroom'] },
  { id: 'indoor',   label: '室內',     themes: ['rainynight', 'tavern', 'ballroom', 'shop', 'musicbox', 'bedroom', 'study', 'kitchen', 'attic', 'bathhouse', 'lockerroom', 'livingroom', 'greenhouse', 'secretroom', 'fireplace', 'candlestudy', 'teatime', 'windowseat', 'winecellar', 'nursery', 'gallery', 'elevator', 'sunroom', 'dollhouse', 'stormnight'] },
  { id: 'scifi',    label: '科幻世界', themes: ['space', 'spacestation', 'cyberchase', 'alien', 'mothership', 'virtual', 'robotcity', 'timewarp', 'datastream', 'quantum', 'colony', 'starport', 'hologram', 'aiawaken', 'antigrav', 'cryosleep', 'warpgate', 'andromeda', 'mechbay', 'neoncircuit', 'satellite', 'terraform', 'blackhole', 'labcore', 'aicradle'] },
  { id: 'rpg',      label: 'RPG',      themes: ['journey', 'battle', 'chase', 'sad', 'title', 'victory', 'gameover', 'skycity', 'pirate', 'worldmap', 'ruins', 'elfwood', 'royalcity', 'caravan', 'lostpath', 'guild', 'levelup', 'secretgrove', 'eveoffinal', 'nightfield', 'deepdungeon', 'sidequest', 'airship', 'coronation', 'epilogue'] },
  { id: 'legend',   label: '傳說RPG',  themes: ['fated', 'heartbattle', 'bonedance', 'bonds', 'determination', 'finalhope', 'soul', 'forgotten', 'starcradle', 'oath', 'ghostwaltz', 'gentleend', 'memoryshard', 'elegy', 'reunion', 'judgement', 'snowtown', 'twilightown', 'mercychoice', 'darkworld', 'darkfountain', 'cyberfield', 'promiseflower', 'requiem', 'finalecho'] },
  { id: 'casual',   label: '休閒',     themes: ['arcade', 'festival', 'onsen', 'minigame', 'puzzle', 'picnic', 'lazynoon', 'catday', 'fishingtime', 'dessert', 'stroll', 'daydream', 'slowcafe', 'bedtime', 'gardening', 'boardgame', 'kiteday', 'icecreamvan', 'supermarket', 'naptime', 'bubblebath', 'morningjog', 'campfire', 'balloonfair', 'rainyplay'] },
  { id: 'boss',     label: '頭目戰',   themes: ['lastboss', 'rival', 'fallenhero', 'mechabeast', 'witch', 'dragon', 'hiddenboss', 'abyss', 'fallenAngel', 'chaos', 'lich', 'colossus', 'twins', 'timelord', 'truefinal', 'shadowking', 'seaserpent', 'warlord', 'phantomcount', 'juggernaut', 'hellgate', 'frostwyrm', 'thunderking', 'voidmother', 'berserker'] },
];

// 段落種類中文標籤與顏色
export const SEC_INFO = {
  A:  { label: '主歌',  color: '#4f7dff' },
  A2: { label: '主歌′', color: '#3f64cc' },
  B:  { label: '橋段',  color: '#c77dff' },
  S:  { label: '副歌',  color: '#ff5f3c' },
  C:  { label: '間奏',  color: '#4ade8c' },
};

// 曲式規劃：依小節數排出段落（kind, bars）
export function planSections(bars, form = 'auto', rng) {
  const P = {
    2: [['S', 2]],
    4: [['A', 2], ['S', 2]],
    8: [['A', 2], ['A2', 2], ['B', 2], ['S', 2]],
    16: [['A', 4], ['A2', 4], ['B', 4], ['S', 4]],
    32: [['A', 4], ['A2', 4], ['B', 4], ['S', 4], ['C', 4], ['A', 4], ['S', 4], ['S', 4]],
  };
  let plan = P[bars] || P[8];
  if (form === 'hookfirst' && bars >= 8) {
    plan = bars >= 32
      ? [['S', 4], ['A', 4], ['A2', 4], ['B', 4], ['S', 4], ['C', 4], ['B', 4], ['S', 4]]
      : bars >= 16 ? [['S', 4], ['A', 4], ['B', 4], ['S', 4]] : [['S', 2], ['A', 2], ['B', 2], ['S', 2]];
  } else if (form === 'loop' && bars >= 8) {
    plan = bars >= 32
      ? [['A', 4], ['A2', 4], ['B', 4], ['B', 4], ['A', 4], ['A2', 4], ['B', 4], ['B', 4]]
      : bars >= 16 ? [['A', 4], ['A2', 4], ['B', 4], ['A2', 4]] : [['A', 2], ['A2', 2], ['B', 2], ['A2', 2]];
  } else if (form === 'boss' && bars >= 8) {
    plan = bars >= 32
      ? [['C', 4], ['A', 4], ['A2', 4], ['S', 4], ['B', 4], ['A', 4], ['S', 4], ['S', 4]]
      : bars >= 16 ? [['C', 2], ['A', 6], ['S', 4], ['S', 4]] : [['C', 2], ['A', 2], ['S', 2], ['S', 2]];
  }
  let start = 0;
  return plan.map(([kind, b]) => { const s = { kind, startBar: start, bars: b }; start += b; return s; });
}
