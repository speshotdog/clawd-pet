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
    const p = {...characters[id]}, k = Math.max(0, Math.min(4, stars - 1)), t = 1 + .05*transcend;
    if (['click','clickTime'].includes(p.kind)) { p.multiplier = 1+(p.multiplier-1)*(1+.08*k)*t; p.duration += k; }
    if (p.kind === 'clickAdd') { p.ratio = (p.ratio+.05*k)*t; p.charges += 2*k; }
    if (p.kind === 'burst') p.factor *= (1+.1*k)*t;
    if (p.kind === 'self') { p.duration += 2*k; p.multiplier = 1+(p.multiplier-1)*t; }
    if (p.kind === 'team') { p.ratio = (p.ratio+.02*k)*t; p.duration += 2*k; }
    if (p.kind === 'passive') { p.duration += 2*k; p.copy = (k === 4 ? 1.1 : 1)*t; }
    p.cd *= (1-.03*k)*(1-.02*transcend);
    return p;
  }
  const bonds = [
    {pair:['jiaobu','jiaobu2'],name:'雙刀',effect:{chargesPlus:1}},
    {pair:['yueyue','yueyue2'],name:'雙尾',effect:{chainWindowMs:11000}},
    {pair:['zhenzhen','zhenzhen2'],name:'雙球',effect:{selfDurationMul:1.25}},
  ];
  const recommendations = [
    {name:'連點流',slots:['yueyue','dog','jiaobu'],desc:'王關、限時包：狗 → 玥玥原版 → 膠布原版'},
    {name:'放置流',slots:['yang','zhenzhen2','zhenmu'],desc:'掛機：珍珍 → 珍母 → 羊咩'},
    {name:'爆發流',slots:['yang','fox','caihua'],desc:'冷凍包、王的最後一擊：羊咩 → 狐狐 → 采華'},
  ];
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
  const api = { wardrobe, characters, skillAt, bonds, recommendations, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
