// 第一版數值；抽樣政策唯一來源仍是 GachaPool.GAME_POLICY。
(function (root) {
  const characters = {
    yueyue2: { base: 4, skill: '尾巴節拍', kind: 'click', multiplier: 2, charges: 10, duration: 15, cd: 60 },
    caihua: { base: 4, skill: '龍尾掃袋', kind: 'burst', factor: 20, basis: 'individual', cd: 45 },
    lk: { base: 5, skill: '穩穩站好', kind: 'self', multiplier: 3, duration: 20, cd: 90 },
    yang: { base: 5, skill: '數羊開工', kind: 'team', ratio: .2, duration: 30, cd: 120 },
    dog: { base: 8, skill: '聞到零食', kind: 'clickAdd', ratio: .5, charges: 20, duration: 20, cd: 90 },
    fox: { base: 8, skill: '收拾桌面', kind: 'burst', factor: 15, basis: 'team', cd: 120 },
    jiaobu2: { base: 9, skill: '俐落拆封', kind: 'click', multiplier: 4, charges: 5, duration: 15, cd: 75 },
    zhenzhen2: { base: 10, skill: '綿綿加班', kind: 'self', multiplier: 4, duration: 30, cd: 120 },
    zhenmu: { base: 16, skill: '這個頭我收下了', kind: 'passive', duration: 20, cd: 90 },
    jiaobu: { base: 18, skill: '一刀開封', kind: 'click', multiplier: 10, charges: 1, duration: 15, cd: 45 },
    yueyue: { base: 18, skill: '玥來越快', kind: 'clickTime', multiplier: 3, duration: 12, cd: 90 },
    zhenzhen: { base: 20, skill: '大團圓', kind: 'team', ratio: .5, duration: 20, cd: 120 },
  };
  // 印記永久倍率：×(1 + MARK_MUL_COEF × √累積印記)。
  // 本來是線性的 +5%／枚，2026-09-08 模擬實測發現那是會爆的：輪迴後訓練與夥伴等級是用被倍率
  // 放大的錢重買的，所以生涯收入的成長快過「印記 ∝ √生涯收入」能壓住的速度，
  // 三天七次輪迴就衝到 ×5.4 億（把 5% 調成 1% 只是把爆炸延一天，形狀不改沒有用）。
  // 改成開根號之後 100 枚仍是 ×6.0（跟舊值接得上），1000 枚 ×16.8、4472 枚 ×34.4。
  // 抽成常數是為了讓模擬器 A/B（MARKMUL 環境變數覆寫，economy／prestige 都是呼叫時才讀）。
  const MARK_MUL_COEF = .5;
  const originalIds = Object.freeze(Object.keys(characters));
  Object.assign(characters, {
    yueyuexian: { base: 30, skill: '躺著也會贏', kind: 'team', ratio: 1.0, duration: 20, cd: 120 },
    zhenfang: { base: 20, skill: '方方正正', kind: 'self', multiplier: 5, duration: 30, cd: 120 },
    lksphinx: { base: 18, skill: '謎語時間', kind: 'clickTime', multiplier: 3.5, duration: 12, cd: 90 },
    zhenmoss: { base: 19, skill: '苔原大團圓', kind: 'burst', factor: 40, basis: 'team', cd: 150 },
    yuetrumpet: { base: 9, skill: '起床號', kind: 'click', multiplier: 4, charges: 8, duration: 15, cd: 75 },
    zhencao: { base: 9, skill: '光合作用', kind: 'team', ratio: .3, duration: 30, cd: 120 },
    mianhua: { base: 8, skill: '蓬蓬鬆鬆', kind: 'self', multiplier: 4, duration: 30, cd: 120 },
    yangpu: { base: 10, skill: '噗噗數羊', kind: 'clickAdd', ratio: .6, charges: 20, duration: 20, cd: 90 },
    jiaotou: { base: 18, skill: '燃額連擊', kind: 'clickTime', multiplier: 4, duration: 15, cd: 90, trait: { clickMul: 1.5 } },
    jinggou: { base: 18, skill: '警棍敲擊', kind: 'click', multiplier: 8, charges: 3, duration: 15, cd: 60 },
    gebugou: { base: 9, skill: '偷吃一口', kind: 'burst', factor: 18, basis: 'team', cd: 100 },
    zhenjpg: { base: 5, skill: '壓縮失真', kind: 'self', multiplier: 4.5, duration: 20, cd: 110 },
    alu: { base: 5, skill: '一鳴驚人', kind: 'burst', factor: 20, basis: 'individual', cd: 45 },
  });
  // 第二十二輪十三張新卡（桌面「新卡」資料夾，稀有度照檔名）。
  // bossDamage 是新的技能種類：傷害是「王包血量的百分比」，跟 P／D 完全脫鉤，
  // 所以王包越硬它越值錢；不在王關時退化成一般的爆發，免得平常是張廢牌。
  Object.assign(characters, {
    guanjiu: { base: 5, skill: '乾杯助興', kind: 'team', ratio: .22, duration: 30, cd: 120 },
    miepupu: { base: 4, skill: '噗噗號角', kind: 'click', multiplier: 2.5, charges: 10, duration: 15, cd: 65 },
    manhua: { base: 5, skill: '滿載而歸', kind: 'burst', factor: 21, basis: 'individual', cd: 45 },
    yangtuo: { base: 4, skill: '聖誕小禮', kind: 'clickTime', multiplier: 2.6, duration: 12, cd: 80 },
    ababa: { base: 5, skill: '阿巴阿巴', kind: 'self', multiplier: 4.5, duration: 20, cd: 110 },
    bingyang: { base: 9, skill: '冰鎮保存', kind: 'self', multiplier: 4.2, duration: 30, cd: 115 },
    zhenbing: { base: 9, skill: '碎冰一擊', kind: 'burst', factor: 17, basis: 'team', cd: 110 },
    zhenpete: { base: 10, skill: '天使加班', kind: 'clickAdd', ratio: .55, charges: 20, duration: 20, cd: 90 },
    yuesong: { base: 19, skill: '合唱一曲', kind: 'team', ratio: .45, duration: 25, cd: 120 },
    zhenbush: { base: 18, skill: '草叢埋伏', kind: 'click', multiplier: 9, charges: 3, duration: 15, cd: 60 },
    yuefeimo: { base: 18, skill: '飛沫直擊', kind: 'bossDamage', share: .08, fallback: 14, cd: 90 },
    qinghua: { base: 30, skill: '青花綻放', kind: 'team', ratio: .9, duration: 22, cd: 125 },
    mieshi: { base: 32, skill: '滅世光線', kind: 'bossDamage', share: .22, fallback: 32, cd: 150 },
  });
  // 第二十三輪八張新卡（桌面「新卡.0」資料夾，稀有度照檔名）。
  Object.assign(characters, {
    gebuyang: { base: 5, skill: '營火慢燉', kind: 'team', ratio: .24, duration: 30, cd: 118 },
    zhenwang: { base: 4, skill: '汪汪叼骨', kind: 'click', multiplier: 2.6, charges: 10, duration: 15, cd: 62 },
    salamander: { base: 5, skill: '軟趴趴', kind: 'self', multiplier: 4.6, duration: 20, cd: 108 },
    lkreal: { base: 10, skill: '正版鴿鴿', kind: 'clickTime', multiplier: 3.2, duration: 14, cd: 85 },
    qipupu: { base: 9, skill: '氣到爆發', kind: 'burst', factor: 19, basis: 'individual', cd: 50 },
    foxmoney: { base: 10, skill: '給狐錢好嗎', kind: 'clickAdd', ratio: .58, charges: 20, duration: 20, cd: 88 },
    foxfriend: { base: 19, skill: '摯友同行', kind: 'burst', factor: 38, basis: 'team', cd: 145 },
    wanwu: { base: 18, skill: '玩到忘我', kind: 'self', multiplier: 5.2, duration: 30, cd: 120 },
  });
  // 第二十四輪五張新卡（桌面「新卡\2.0」補完，稀有度照檔名）
  Object.assign(characters, {
    shiwang: { base: 5, skill: '垂頭喪企', kind: 'burst', factor: 22, basis: 'individual', cd: 48 },
    seal: { base: 5, skill: '快樂拍拍', kind: 'clickAdd', ratio: .42, charges: 18, duration: 20, cd: 95 },
    chaichai: { base: 4, skill: '柴柴打滾', kind: 'self', multiplier: 4.8, duration: 20, cd: 105 },
    jiaolan: { base: 5, skill: '爛額狂點', kind: 'clickTime', multiplier: 2.8, duration: 12, cd: 82, trait: { clickMul: 1.15 } },
    shiyi: { base: 19, skill: '十一連發', kind: 'click', multiplier: 4.5, charges: 11, duration: 15, cd: 85 },
  });
  // 第二十五輪：神話「玩物就玩物」。clickAdd 這一族目前最高只到史詩（.6），神話這一格是空的，
  // 所以它走 clickAdd 而不是再開一張 team（三張神話裡已經有兩張是 team 了）。
  Object.assign(characters, {
    wanwumythic: { base: 31, skill: '捧在手心', kind: 'clickAdd', ratio: 1.5, charges: 30, duration: 25, cd: 130 },
  });
  const fmt = n => Number(n.toFixed(4));
  function describe(p) {
    const tail = `・冷卻 ${fmt(p.cd)} 秒`;
    if (p.kind === 'click') return `接下來 ${p.charges} 次點擊 ×${fmt(p.multiplier)}（${p.duration} 秒內用完）${tail}`;
    if (p.kind === 'clickTime') return `所有點擊 ×${fmt(p.multiplier)}，持續 ${p.duration} 秒${tail}`;
    if (p.kind === 'clickAdd') return `接下來 ${p.charges} 次點擊各追加 ${fmt(p.ratio*100)}% 每秒收益（${p.duration} 秒內用完）${tail}`;
    if (p.kind === 'burst') return `立即獲得${p.basis === 'individual' ? '自身' : '含全隊加成的'}每秒收益 ×${fmt(p.factor)} 的拆包力${tail}`;
    if (p.kind === 'bossDamage') return `王關中：立即對王包造成血量 ${fmt(p.share*100)}% 的傷害；不在王關時改為立即獲得每秒收益 ×${fmt(p.fallback)} 的拆包力${tail}`;
    if (p.kind === 'self') return `自身收益 ×${fmt(p.multiplier)}，持續 ${p.duration} 秒${tail}`;
    if (p.kind === 'team') return `全隊每秒額外 +${fmt(p.ratio*100)}% 常態收益，持續 ${p.duration} 秒${tail}`;
    return `複製含自身技能後最高夥伴收益的 ${fmt(p.copy*100)}%，持續 ${p.duration} 秒${tail}`;
  }
  for (const def of Object.values(characters)) def.desc = describe;
  function skillAt(id, stars, transcend = 0) {
    const p = {...characters[id]}, k = Math.max(0, Math.min(4, stars - 1)), t = 1 + (id === 'yueyuexian' ? .07 : .05)*transcend;
    if (['click','clickTime'].includes(p.kind)) { p.multiplier = 1+(p.multiplier-1)*(1+.08*k)*t; p.duration += k; }
    if (p.kind === 'clickAdd') { p.ratio = (p.ratio+.05*k)*t; p.charges += 2*k; }
    if (p.kind === 'burst') p.factor *= (1+.1*k)*t;
    // bossDamage：share 是「王包血量的百分比」，升星漲得比 burst 慢一點（8%／星），
    // 免得五星＋超越之後一發把王打掉一半；fallback 照 burst 的 10%／星走。
    if (p.kind === 'bossDamage') { p.share *= (1+.08*k)*t; p.fallback *= (1+.1*k)*t; }
    if (p.kind === 'self') { p.duration += 2*k; p.multiplier = 1+(p.multiplier-1)*t; }
    if (p.kind === 'team') { p.ratio = (p.ratio+.02*k)*t; p.duration += 2*k; }
    if (p.kind === 'passive') { p.duration += 2*k; p.copy = (k === 4 ? 1.1 : 1)*t; }
    if (p.trait) p.trait = { clickMul: fmt(p.trait.clickMul + .1*k + .05*transcend) };
    p.cd *= (1-.03*k)*(1-.02*transcend);
    return p;
  }
  const bonds = [
    {pair:['lk','lksphinx'],name:'獅王',effect:{chargesPlus:1}},
    {pair:['zhenzhen','zhenmoss'],name:'苔球',effect:{selfDurationMul:1.25}},
    {pair:['yang','yangpu'],name:'雙咩',effect:{chainWindowMs:11000}},
    {pair:['yueyue','yueyuexian'],name:'玥圓',effect:{chainWindowMs:12000}},
    {pair:['jiaobu','jiaobu2'],name:'雙刀',effect:{chargesPlus:1}},
    {pair:['yueyue','yueyue2'],name:'雙尾',effect:{chainWindowMs:11000}},
    {pair:['zhenzhen','zhenzhen2'],name:'雙球',effect:{selfDurationMul:1.25}},
  ];
  const recommendations = [
    {name:'連點流',slots:['yueyue','dog','jiaobu'],desc:'王關、限時包：狗 → 玥玥原版 → 膠布原版'},
    {name:'放置流',slots:['yang','zhenzhen2','zhenmu'],desc:'掛機：珍珍 → 珍母 → 羊咩'},
    {name:'爆發流',slots:['yang','fox','caihua'],desc:'冷凍包、王的最後一擊：羊咩 → 狐狐 → 采華'},
  ];
  recommendations.push({name:'神話流',slots:['yueyuexian','zhenfang','zhenmoss'],desc:'躺著也會贏 → 方方正正 → 苔原大團圓'});
  const wardrobe = {
    sounds: ['soft','bubble','paper','coin','taiko','sticker','squish','bubblewrap','woodblock','jelly'].map((id,i)=>({id,name:['軟碰','泡泡','撕紙','金幣','太鼓','貼紙拍','擠壓','泡泡紙','木魚','果凍'][i]})),
    fx: [
      {id:'shard',name:'碎紙',sprite:9,color:'#EF8E8E'}, {id:'coin',name:'金幣噴泉',sprite:0,color:'#E9B94E'},
      {id:'heart',name:'愛心',sprite:10,color:'#EF8E8E'}, {id:'paw',name:'肉球',sprite:11,color:'#FFF3DC'},
      {id:'star',name:'五角星',sprite:2,color:'#E9B94E'}, {id:'ribbon',name:'彩帶',sprite:8,color:'#EF8E8E'},
      {id:'bubble',name:'泡泡',sprite:3,color:'#94BED0'}, {id:'sakura',name:'櫻花',file:'clicker-fx-sakura.png',color:'#EF8E8E'},
      {id:'spark',name:'小閃電',file:'clicker-fx-spark.png',color:'#E9B94E',blend:'lighter'}, {id:'snow',name:'雪花',file:'clicker-fx-snow.png',color:'#FFFFFF'},
    ],
  };
  const marks = [
    { id:'finger14', name:'電動手指擴充', cost:3, desc:'電動手指上限 10 → 14' },
    { id:'bossTime', name:'王包 +10 秒', cost:3, desc:'限時 30 → 40 秒，血量不變' },
    { id:'offline15', name:'離線收益 ×1.5', cost:4, desc:'離線金幣 ×1.5，包進度不變' },
    { id:'daily2', name:'每日包雙倍', cost:2, desc:'免費單抽 +2、萬用粉塵 +2、獎勵金幣 ×2' },
    { id:'slot4', name:'第四技能槽', cost:3, desc:'三槽變四槽，連鎖窗可接到第四個（×1.9）' },
    { id:'offline12', name:'離線 12 小時', cost:2, desc:'離線結算上限 8 → 12 小時' },
    { id:'chain2', name:'連鎖窗 +2 秒', cost:2, desc:'與玥玥羈絆相加' },
    { id:'starter5', name:'開局送五連', cost:1, desc:'每次換桌布後送 5 次免費招募' },
    { id:'crack75', name:'裂痕 75% 起跳', cost:2, desc:'王包失敗保留 75% 傷害' },
    { id:'rooftop', name:'新桌布「屋頂星空」', cost:5, desc:'第七場景，純外觀與 BGM' },
  ];
  const blessings = [
    { id:'blessing', name:'收益祝福', desc:'全隊每秒收益與攻擊力，每級 +10%' },
    { id:'dustTrade', name:'粉塵兌換', cost:1, desc:'1 印記 → 5 萬用粉塵' },
    { id:'drawTicket', name:'招募券', cost:2, desc:'2 印記 → 5 次免費單抽' },
  ];
  const autoClickMax = 10;
  const autoClickCap = s => s.markShop?.finger14 ? 14 : autoClickMax;
  const decor = ['花盆','燈串','小鼓','風鈴','貓抓板','相框','香氛蠟燭','小旗串','多肉','留聲機'].map((name,i)=>({ id:`deco${i}`, name, file:`clicker-deco-${i}.png` }));
  const api = { originalIds, marks, blessings, autoClickMax, autoClickCap, decor, wardrobe, characters, MARK_MUL_COEF, skillAt, bonds, recommendations, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
