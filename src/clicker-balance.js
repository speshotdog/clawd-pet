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
  // 2026-09-12 v3：拿掉（係數 0、欄位保留）。使用者存檔實測祝福 Lv.1462（×147）× markMul ×518 ≈ ×76,000，
  // 根因是「印記∝√幣、買到的倍率又乘在幣上」兩條無頂倍率互餵。v3 只留有頂的收益祝福（DESIGN-balance-v3 §四）。
  const MARK_MUL_COEF = 0;
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
    seal: { base: 5, skill: '快樂拍拍', kind: 'energize', cd: 150 },   // v3 §七：充能，下一個技能效果 ×2（原 clickAdd .42×18）
    chaichai: { base: 4, skill: '柴柴打滾', kind: 'reload', cd: 180 },   // v3 §七：重整，其他槽冷卻歸零（原 self ×4.8／20s）
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
    if (p.kind === 'reload') return `其他技能槽的冷卻立刻歸零${tail}`;
    if (p.kind === 'energize') return `下一個發動的技能效果量 ×2${tail}`;
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
  // 推薦組合（2026-09-16 重做，使用者：「推薦組合有點舊了，重新設計、獨立一個頁面」）。
  // slots 是技能槽的順序（第四格要印記商店買 slot4，沒買就只裝前三個）；order 是按的順序；
  // tag 是用途、stage 是「大概什麼時候湊得齊」。⚠ 前三組的 slots 不要動：clicker-round9.test.js 拿它們當固定資料。
  const recommendations = [
    {name:'連點流',tag:'王關・限時包',stage:'前期',slots:['yueyue','dog','jiaobu'],
      order:'狗 → 玥玥原版 → 膠布原版',desc:'先開「聞到零食」讓每一下都帶收益，再開「玥來越快」×3，最後「一刀開封」打最重的一下。手要一直點。'},
    {name:'放置流',tag:'掛機',stage:'前期',slots:['yang','zhenzhen2','zhenmu'],
      order:'珍珍 → 珍母 → 羊咩',desc:'「綿綿加班」先把珍珍撐到 ×4，珍母「這個頭我收下了」複製她的收益，羊咩再給全隊 +20%。三個都是長效，放著就好。'},
    {name:'爆發流',tag:'冷凍包・王的最後一擊',stage:'前期',slots:['yang','fox','caihua'],
      order:'羊咩 → 狐狐 → 采華',desc:'羊咩先把全隊墊高，狐狐「收拾桌面」拿全隊 ×15 的一發，采華補自身 ×20。全部一次放完，適合血量剩一點的王。'},
    {name:'神話流',tag:'全面',stage:'後期',slots:['yueyuexian','zhenfang','zhenmoss','wanwumythic'],
      order:'躺著也會贏 → 方方正正 → 苔原大團圓',desc:'玥來玥閒全隊 +100%，方方正正自身 ×5，苔原大團圓在加成最高時拿全隊 ×40 的一發；第四格「捧在手心」30 下點擊各追加 150% 每秒收益。'},
    {name:'新手三寶',tag:'剛開局',stage:'前期',slots:['yueyue2','caihua','lk'],
      order:'ㄌㄎ → 玥玥 → 采華',desc:'全部是精良卡，開局幾包就湊得齊。「穩穩站好」自身 ×3 先開，「尾巴節拍」10 下 ×2 點掉，采華「龍尾掃袋」收尾。'},
    {name:'史詩中堅',tag:'王關・掛機都行',stage:'中期',slots:['zhenzhen2','jiaobu2','gebugou','zhenpete'],
      order:'珍珍 → 珍彼特 → 膠布 → 哥不狗',desc:'全史詩、沒有傳說也能打。珍珍「綿綿加班」長效墊底，珍彼特 20 下追加 55%，膠布「俐落拆封」5 下 ×4，哥不狗「偷吃一口」全隊 ×18 收尾。'},
    {name:'王關特化',tag:'王關',stage:'後期',slots:['mieshi','yuefeimo','seal','jiaobu'],
      order:'海豹 → 滅世珍獸 → 飛沫月月 → 膠布原版',desc:'快樂海豹「快樂拍拍」讓下一個技能 ×2，接「滅世光線」直接扣王 22% 血（×2 就是 44%），飛沫再扣 8%，膠布原版一刀收尾。不打王時滅世光線退成 ×32 拆包力，不浪費。'},
    {name:'循環流',tag:'王關・長戰',stage:'後期',slots:['chaichai','zhenmoss','foxfriend','mieshi'],
      order:'苔蘚珍珍 → 摯友之狐 → 滅世珍獸 → 柴柴',desc:'三個 150 秒級的大招全放完，柴柴「柴柴打滾」把其他槽冷卻歸零，再放一輪。等於大招連放兩次。'},
    {name:'合唱團',tag:'掛機・全隊',stage:'中後期',slots:['zhenzhen','yuesong','zhencao','qinghua'],
      order:'任意順序，錯開放',desc:'四個都是「全隊每秒 +N%」：大團圓 50%、合唱一曲 45%、光合作用 30%、青花綻放 90%。冷卻都 120 秒左右，錯開放就有近乎常駐的加成。'},
    {name:'獅王羈絆',tag:'王關・連點',stage:'中後期',slots:['lk','lksphinx','jinggou','shiyi'],
      order:'ㄌㄎ → 謎語時間 → 警棍敲擊 → 十一連發',desc:'收齊 ㄌㄎ＋獅身ㄌㄎ 就有羈絆「獅王」（擁有即生效）：次數型技能各 +1 下。警棍 ×8 變 4 下、十一連發變 12 下，謎語時間 ×3.5 期間全部點完。'},
    {name:'雙尾連鎖',tag:'限時包・連點',stage:'中期',slots:['yueyue','yueyue2','yuetrumpet','yangtuo'],
      order:'玥玥原版 → 小號玥 → 玥玥 → 羊駝',desc:'收齊玥玥兩個版本就有「雙尾」（擁有即生效）：連鎖判定放寬到 11 秒，技能一個接一個放不會斷鏈。四個都是點擊倍率，限時包最吃這個。'},
    {name:'苔球長效',tag:'掛機',stage:'中後期',slots:['zhenzhen','zhenmoss','wanwu','bingyang'],
      order:'珍珍原版 → 冰羊咩 → 玩物 → 苔蘚珍珍',desc:'收齊珍珍原版＋苔蘚珍珍就有「苔球」（擁有即生效）：自身增益持續 ×1.25。玩物「玩到忘我」×5.2、冰羊咩 ×4.2 都變 37 秒，大團圓期間放苔原大團圓收一筆。'},
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
  // 印記兌換（2026-09-15 重設計，DESIGN-2026-09-14-marks）：只留「改變規則的永久解鎖」，而且每一項在 1.0 與 2.0 都要有意義。
  // 砍掉的六項（finger14／offline15／daily2／chain2／starter5／crack75）在 RETIRED_MARKS，舊存檔載入時原價退回。
  const marks = [
    { id:'slot4', name:'第四技能槽', cost:3, desc:'1.0 三槽變四槽；2.0 第四格技能解鎖' },
    { id:'bossTime', name:'王關 +時間', cost:3, desc:'1.0 王包 30 → 40 秒；2.0 王關 60 → 75 秒' },
    { id:'offline12', name:'離線 12 小時', cost:2, desc:'兩個世界的離線結算上限 8 → 12 小時' },
    // v3 §九：點擊附加隊伍收益 5% → 10% → 15%（後期點擊不歸零，「連點＋技能才過得了王」才成立）
    { id:'tapShare1', name:'點擊附加 +5%', cost:3, desc:'1.0 每下點擊附加的全隊收益 5% → 10%；2.0 點擊佔戰力 50% → 55%' },
    { id:'tapShare2', name:'點擊附加再 +5%', cost:3, desc:'1.0 10% → 15%；2.0 55% → 60%（需先買前一項）', requires:'tapShare1' },
    { id:'dispatch4', name:'派遣位 +1', cost:3, desc:'2.0 派遣位 3 → 4' },
    { id:'rooftop', name:'新桌布「屋頂星空」', cost:5, desc:'第七場景，純外觀與 BGM' },
  ];
  const RETIRED_MARKS = { finger14: 3, offline15: 4, daily2: 2, chain2: 2, starter5: 1, crack75: 2 };
  // 2.0 的印記來源（全部一次性或有頂）：五隻區段王首勝、全線通行、卡冊全收集、全滿養、重走廢土每圈
  const APOC_MARKS = { BOSS_FIRST: 2, CLEARED: 5, COLLECTED: 5, MAXED: 10, LAP: 4 };
  // 神器在 2.0 的套用強度（每級）。戰力類只吃 1/5：模擬顯示 2.0 吃到 ×1.2 全破就從第 5～7 天縮到第 3 天（見 DESIGN-marks）。
  const ARTIFACT_APOC = { blessing: .02, tap: .02, skill: .025, cd: .01, offline: .1, chest: .01, dust: 1 };
  const BLESSING_MAX = 20;   // v3 §四：×3.0 封頂；第 L 級收 L 枚，全滿 210
  // v3 常數集中放這裡讓模擬器 A/B（DESIGN-balance-v3）
  const V3 = { GATE_EVERY: 10, GATE_MUL: 2, AREA_MUL: 1.5, BOSS_MUL: 4, GATE_SECONDS: 30, GATE_COOLDOWN: 30,
    ROSTER_LIMITS: [2, 6, 12, 20], CHAMPIONS: 2, CHAMPION_MUL: 1.5, DISPATCH_SLOTS: 3, DISPATCH_MS: 4 * 3600000, DISPATCH_DAILY: 9,
    CHEST_RATE: .03, CHEST_MUL: 8, CHEST_MILESTONE: 150, MARKS_PER_RUN: 8,   // 印記重設計：12 → 8（拿掉 100／300 包的 +1）
    // C 路（2026-09-12 使用者拍）：王是「賺大錢的時刻」——打贏小王給 requirement×GATE_REWARD、大王給門檻包需求×BOSS_REWARD 的幣（一次性、只進錢包）
    GATE_REWARD: 8, BOSS_REWARD: 40,
    // 30 秒火力 ≥ 血量 × GATE_SKIP 的小王直接讓路（給獎金、不演出）：剛換桌布或壓倒性強的玩家不用每 10 包看一次動畫，牆只在真的是牆時出現
    GATE_SKIP: 10,
    // 成長側實驗旋鈕（模擬器 A/B 用；1／1／1.15 就是 v2 原值）：夥伴訓練每級再乘 PARTNER_G^L、全隊訓練價 ×TRAIN_COST_MUL、夥伴訓練價 ×PARTNER_COST_MUL
    // 2026-09-13 兩週日曆掃描定案（REPORT §二之三）：PARTNER_G 1.02、每站 K 遞減；一個小數點就是一天與一週的差別，改之前先跑 tools/sim/clicker-v3.js
    PARTNER_G: 1.02, TRAIN_COST_MUL: 2.5, PARTNER_COST_MUL: 1.15, PARTNER_CAP: 200,
    // 每站各自的大王 K（缺的用 BOSS_MUL）：前段大、後段小，讓第一次離線那筆錢沖不過前四站（DESIGN-balance-v3 §十四）
    BOSS_K: { backyard: 10, kitchen: 8, market: 6, factory: 5, nightmarket: 8, fridge: 8, city: 2 } };
  // D 路（2026-09-13 使用者拍，照 Sakura Clicker）：祝福從一條線拆成 7 個「神器」線，第 r 級收 r 枚印記、各有頂，
  // 玩家要選先升哪個。收益祝福沿用舊欄位 s.blessing；其餘存 s.artifacts[id]。總量上限 MARKS_TOTAL_CAP（Sakura 是 350）。
  const ARTIFACTS = [
    { id:'blessing', name:'收益祝福', per:'全隊每秒收益與攻擊力 +10%', max:20 },
    { id:'tap',      name:'攻擊力祝福', per:'攻擊力（點擊拆包力）+10%', max:20 },
    { id:'skill',    name:'技能祝福', per:'技能效果量 +5%', max:10 },
    { id:'cd',       name:'冷卻祝福', per:'技能冷卻 −2%', max:10 },
    { id:'offline',  name:'離線祝福', per:'離線收益 +10%', max:10 },
    { id:'chest',    name:'寶箱祝福', per:'寶箱包機率 +1%', max:10 },
    { id:'dust',     name:'粉塵祝福', per:'每次換桌布多 1 顆萬用粉塵', max:10 },
  ];
  const MARKS_TOTAL_CAP = 150;   // 印記重設計：1.0 換桌布 ≤ 100 ＋ 2.0 里程碑與重走 ≤ 70，合併上限 150
  const blessings = [
    { id:'blessing', name:'收益祝福', desc:'全隊每秒收益與攻擊力，每級 +10%（上限 Lv.20）' },
    { id:'dustTrade', name:'粉塵兌換', cost:1, desc:'換 5 萬用粉塵；每換一次下一次就貴 1 印記' },
  ];
  const autoClickMax = 10;
  const autoClickCap = () => autoClickMax;   // finger14 已退役（印記重設計）
  const decor = ['花盆','燈串','小鼓','風鈴','貓抓板','相框','香氛蠟燭','小旗串','多肉','留聲機'].map((name,i)=>({ id:`deco${i}`, name, file:`clicker-deco-${i}.png` }));
  const api = { originalIds, marks, RETIRED_MARKS, APOC_MARKS, ARTIFACT_APOC, blessings, ARTIFACTS, MARKS_TOTAL_CAP, BLESSING_MAX, V3, autoClickMax, autoClickCap, decor, wardrobe, characters, MARK_MUL_COEF, skillAt, bonds, recommendations, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
