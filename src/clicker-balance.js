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
  const fmt = n => Number(n.toFixed(4));
  function describe(p) {
    const tail = `・冷卻 ${fmt(p.cd)} 秒`;
    if (p.kind === 'click') return `接下來 ${p.charges} 次點擊 ×${fmt(p.multiplier)}（${p.duration} 秒內用完）${tail}`;
    if (p.kind === 'clickTime') return `所有點擊 ×${fmt(p.multiplier)}，持續 ${p.duration} 秒${tail}`;
    if (p.kind === 'clickAdd') return `接下來 ${p.charges} 次點擊各追加 ${fmt(p.ratio*100)}% 每秒收益（${p.duration} 秒內用完）${tail}`;
    if (p.kind === 'burst') return `立即獲得${p.basis === 'individual' ? '自身' : '含全隊加成的'}每秒收益 ×${fmt(p.factor)} 的拆包力${tail}`;
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
  const api = { originalIds, marks, blessings, autoClickMax, autoClickCap, decor, wardrobe, characters, skillAt, bonds, recommendations, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
