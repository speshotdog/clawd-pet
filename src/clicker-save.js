(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const X = node ? require('./clicker-extras.js') : root.ClickerExtras;   // 第十二輪：每日一包／徽章／匯出匯入
  const KEY = 'clicker_save';
  function fresh(now) {
    return { version: 3, balanceVersion: 1, revision: 0, savedAt: now, settledAt: now,
      coins: 0, lifetimeCoins: 0, manualClicks: 0, clickLevel: 0, trainingLevel: 0,
      collection: {}, dust: {}, universalDust: 0, promotions: {}, transcend: {}, overflow: {}, awakened: {}, owned: {wardrobe:['sounds:soft','fx:shard']}, paidDraws: 0, pity: { sinceLegendary: 0 }, pending: null,
      package: E.newPackage('backyard'), claimedMilestones: [],
      boss: null, bossWins: [], bossCracks: {}, bossCooldownUntil: 0, bossResult: null, scenePackages: {}, freeDraws: 0, usedFreeDraws: 0,
      chain: {count:1,expiresAt:0}, daily: null, badges: [], pick100: null,
      marks: 0, marksClaimed: 0, prestiges: 0, markShop: {}, dustTrades: 0, autoClick: 0, autoRemainder: 0, autoClicks: 0, partnerLevels: {}, deco: [], decoShown: [], peakRate: 0, peakRateStamp: 0, blessing: 0, prestigeHintDate: null,
      missed: 0, sweep: {last:null,count:0,at:0}, gift: null, nextGiftAt: 0, giftResult: null,
      skillSlots: [null, null, null], cooldownUntil: {}, slotReadyAt: [0, 0, 0], effects: [],
      // v3（DESIGN-balance-v3）：編隊、本輪王勝／包數、本輪當家、派遣、寶箱種子、大掃除封存
      roster: [], runWins: [], runPacks: 0, runGates: 0, champions: [], artifacts: {}, collectibles: [], dispatch: [], dispatchDay: null, dispatchHalf: {}, chestSeed: Math.floor((now * 2654435761) % 4294967296), legacy: null,
      settings: { clickSound:'soft', clickFx:'shard', muted: false, mode: 'wish', scene: 'backyard', music: true, musicVolume: .6, sfxVolume: .8, autoChallenge: true } };
  }
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const number = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const integer = (v) => number(v) && Number.isSafeInteger(v);
  const known = (id) => Object.hasOwn(B.characters, id);
  function validate(s, pool) {
    const check = (ok, field) => { if (!ok) throw new Error(`存檔驗證失敗：${field}`); };
    if (object(s) && s.version===1) {
      s.dust={...s.collection}; s.universalDust=0; s.promotions={}; s.transcend={}; s.overflow={}; s.awakened={};
      s.owned={wardrobe:['sounds:soft','fx:shard']};
      s.settings={...s.settings,clickSound:'soft',clickFx:'shard'}; s.version=2;
    }
    // 第二十二輪把第七站 city 接在 fridge 後面時，finishBoss 開始在 bossResult 裡多寫一個 next；
    // 在那之前打贏王、結算牌還掛著就沒再開過遊戲的存檔沒有這個欄位，換新版一讀就卡「王包結算」讀不進來
    //（2026-09-08 使用者朋友回報：掛機一個多小時後重整就中）。這裡照場景表補回去。
    // 終點站 city 的 next 本來就是 undefined，JSON 也存不下 undefined，所以這行對新存檔是無作用的。
    if (object(s) && object(s.bossResult) && s.bossResult.next === undefined) s.bossResult.next = E.nextScene(s.bossResult.scene);
    // ---- v3 大掃除（2→3，DESIGN-2026-09-12-content-architecture §十一）：回收膨脹、不回收努力。
    // 只重算 marksClaimed／blessing／marks；原值封存到 legacy（補償分級要看它、日後可回溯）。
    // 新印記＝用新規則反推：每輪上限 12 × 輪迴次數（反推不到的給上界，寧多勿少）；祝福自動買到頂、剩的留手上。
    if (object(s) && s.version === 2) {
      const prestiges = Number.isSafeInteger(s.prestiges) ? s.prestiges : 0;
      s.legacy = { marksClaimed: s.marksClaimed || 0, blessing: s.blessing || 0, marks: s.marks || 0, lifetimeCoins: s.lifetimeCoins || 0, prestiges, migratedAt: Date.now() };
      const shopSpent = Object.keys(s.markShop || {}).reduce((sum, id) => sum + (B.marks.find(m => m.id === id)?.cost || 0), 0);
      const dustSpent = ((s.dustTrades || 0) * ((s.dustTrades || 0) + 1)) / 2;
      let pool = prestiges * B.V3.MARKS_PER_RUN, level = 0;
      while (level < B.BLESSING_MAX && pool >= level + 1) { pool -= level + 1; level++; }
      s.blessing = level; s.marks = pool;
      s.marksClaimed = prestiges * B.V3.MARKS_PER_RUN + shopSpent + dustSpent;   // 已買的商店與粉塵兌換照舊承認，不追討
      // 本輪當家：遷移時用生涯幣當種子確定性地抽 2 張（之後每次輪迴重抽）
      const ids = Object.keys(s.collection || {}).filter(id => known(id) && s.collection[id] > 0).sort();
      let h = Math.floor((s.lifetimeCoins || 0) % 2147483647) >>> 0; s.champions = [];
      while (ids.length && s.champions.length < B.V3.CHAMPIONS) { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; s.champions.push(ids.splice(h % ids.length, 1)[0]); }
      // 補償（魔花少女＋徽章）不在這裡發：要玩家在大掃除頁選「從零開始」才給（使用者 2026-09-13）
      s.version = 3;
    }
    check(object(s) && s.version === 3 && s.balanceVersion === 1, '版本（本版不降級或重置）');
    // 移除誤植角色，也清理它可能留下的養成與技能快照。
    for (const key of ['collection','dust','promotions','transcend','partnerLevels','overflow','awakened','cooldownUntil']) {
      if (object(s[key])) delete s[key].yuelegend;
    }
    if (Array.isArray(s.skillSlots)) s.skillSlots = s.skillSlots.map(id => id === 'yuelegend' ? null : id);
    if (Array.isArray(s.effects)) s.effects = s.effects.filter(e => e?.source !== 'yuelegend' && e?.target !== 'yuelegend');
    // 第十二輪：第六場景 id rainynight → fridge
    const rename = id => id === 'rainynight' ? 'fridge' : id;
    if (object(s.settings)) s.settings.scene = rename(s.settings.scene);
    for (const key of ['scenePackages','bossCracks']) if (object(s[key]) && Object.hasOwn(s[key],'rainynight')) { s[key].fridge = s[key].rainynight; delete s[key].rainynight; }
    if (Array.isArray(s.bossWins)) s.bossWins = s.bossWins.map(rename);
    if (object(s.bossResult)) { s.bossResult.scene = rename(s.bossResult.scene); s.bossResult.next = rename(s.bossResult.next); }
    if (object(s.boss)) s.boss.scene = rename(s.boss.scene);
    s.blessing ??= 0; s.peakRateStamp ??= 0;
    check(integer(s.blessing) && s.blessing <= B.BLESSING_MAX, '收益祝福');
    check(integer(s.peakRateStamp) && (s.peakRateStamp === 0 || (s.peakRateStamp >= 3 && s.peakRateStamp <= 308)), '收益關卡章');
    s.daily ??= null; s.badges ??= []; s.pick100 ??= null;
    if (s.daily !== null) { const d = s.daily; check(object(d) && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && typeof d.done === 'boolean' && number(d.need) && d.need > 0 && number(d.dealt) && d.dealt <= d.need && (d.done || d.dealt < d.need) && integer(d.streak), '每日一包'); }
    check(Array.isArray(s.badges) && new Set(s.badges).size === s.badges.length && s.badges.every(id => X.BADGES.some(b => b.id === id)), '徽章');
    check(s.pick100 === null || (B.originalIds.includes(s.pick100) && s.badges.includes('pack100')), '百包選角');
    if (s.chain === undefined) s.chain = {count:1,expiresAt:0};
    check(object(s.chain) && integer(s.chain.count) && s.chain.count >= 1 && s.chain.count <= 3 && number(s.chain.expiresAt), '連鎖');
    s.boss ??= null; s.bossWins ??= []; s.bossCracks ??= {}; s.bossCooldownUntil ??= 0;
    s.freeDraws ??= 0; s.usedFreeDraws ??= 0; s.scenePackages ??= {}; s.bossResult ??= null;
    check(integer(s.freeDraws) && integer(s.usedFreeDraws) && number(s.bossCooldownUntil), '王包獎勵與冷卻');
    // 第十一輪：輸送帶漏包數、三連包掃過去、夜市禮包（舊存檔缺欄位補預設）
    s.missed ??= 0; s.sweep ??= {last:null,count:0,at:0}; s.gift ??= null; s.nextGiftAt ??= 0; s.giftResult ??= null;
    check(integer(s.missed), '漏包數');
    check(object(s.sweep) && (s.sweep.last === null || [0,1,2].includes(s.sweep.last)) && integer(s.sweep.count) && number(s.sweep.at) && (s.sweep.last !== null || s.sweep.count === 0), '掃過去');
    check(number(s.nextGiftAt), '禮包排程');
    if (s.gift !== null) { const g = s.gift; check(object(g) && number(g.need) && g.need > 0 && number(g.dealt) && g.dealt < g.need && number(g.endsAt), '禮包'); }
    if (s.giftResult !== null) { const r = s.giftResult; check(object(r) && typeof r.won === 'boolean' && number(r.at) && number(r.bonus) && number(r.need) && (r.won || r.bonus === 0), '禮包結算'); }
    for (const key of ['coins', 'lifetimeCoins', 'savedAt', 'settledAt']) check(number(s[key]), key);
    for (const key of ['revision', 'manualClicks', 'clickLevel', 'trainingLevel', 'paidDraws']) check(integer(s[key]), key);
    check(s.lifetimeCoins >= s.coins, '累計收入');
    check(object(s.collection), 'collection');
    for (const [id, count] of Object.entries(s.collection)) check(known(id) && integer(count) && count > 0, '角色張數');
    for (const key of ['dust','promotions','transcend','overflow','awakened']) check(object(s[key]),key);
    check(integer(s.universalDust),'萬用粉塵');
    for (const key of ['dust','promotions','transcend','overflow']) for (const [id,n] of Object.entries(s[key])) check(known(id) && integer(n),key);
    for (const id of Object.keys(B.characters)) {
      const p=s.promotions[id] || 0, t=s.transcend[id] || 0;
      check(p<=Math.max(0,2-E.origin(id)) && t<=5 && (!t || E.tier(s,id)>=2),'升階與超越');
      check(!(p || t) || (s.dust[id]>=16+E.spentDust(s,id) && s.collection[id]>0),'粉塵帳');
      check((s.overflow[id] || 0)<[4,2,1,.5][E.origin(id)] && (!(s.overflow[id] || 0) || t===5),'溢出');
      check((s.awakened[id] || false)===(t===5),'覺醒');
    }
    check(Object.entries(s.awakened).every(([id,v])=>known(id) && typeof v==='boolean'),'覺醒欄位');
    check(object(s.owned) && Array.isArray(s.owned.wardrobe) && new Set(s.owned.wardrobe).size===s.owned.wardrobe.length && s.owned.wardrobe.every(key=>Object.entries(B.wardrobe).some(([kind,items])=>items.some(item=>key===`${kind}:${item.id}`))) && ['sounds:soft','fx:shard'].every(key=>s.owned.wardrobe.includes(key)),'更衣室');
    check(s.owned.wardrobe.includes(`sounds:${s.settings?.clickSound}`) && s.owned.wardrobe.includes(`fx:${s.settings?.clickFx}`),'穿著');
    check(object(s.pity) && integer(s.pity.sinceLegendary) && s.pity.sinceLegendary < 40 && s.pity.sinceLegendary <= s.paidDraws+s.usedFreeDraws, '保底');
    check(object(s.package) && integer(s.package.index) && s.package.index >= 1 && number(s.package.progress) && s.package.progress < E.requirement(s.package.index, s.settings?.scene), '拆包進度');
    check(Number.isFinite(E.requirement(s.package.index, s.settings?.scene)) && Object.values(E.rates(s)).every(number), '數值溢出');
    check(Array.isArray(s.claimedMilestones) && s.claimedMilestones.every((v) => v === 'tutorial50') && new Set(s.claimedMilestones).size === s.claimedMilestones.length, '獎勵紀錄');
    check(s.manualClicks < 50 ? !s.claimedMilestones.includes('tutorial50') : s.claimedMilestones.includes('tutorial50') && s.collection.yueyue2 > 0, '教學獎勵');
    s.marks ??= 0; s.marksClaimed ??= 0; s.prestiges ??= 0; s.markShop ??= {}; s.dustTrades ??= 0; s.autoClick ??= 0; s.autoRemainder ??= 0; s.autoClicks ??= 0; s.partnerLevels ??= {}; s.deco ??= []; s.decoShown ??= []; s.peakRate ??= 0; s.prestigeHintDate ??= null;
    check(integer(s.dustTrades) && integer(s.marks) && integer(s.marksClaimed) && s.marks <= s.marksClaimed && integer(s.prestiges) && integer(s.autoClick) && s.autoClick <= B.autoClickCap(s) && number(s.autoRemainder) && s.autoRemainder < 1 && integer(s.autoClicks), '輪迴與電動手指');
    check(object(s.markShop) && Object.entries(s.markShop).every(([id, v]) => B.marks.some(m => m.id === id) && v === true) && s.marksClaimed >= s.marks + s.blessing * (s.blessing + 1) / 2 + Object.values(s.artifacts || {}).reduce((sum, r) => sum + r * (r + 1) / 2, 0) + s.dustTrades * (s.dustTrades + 1) / 2 + Object.keys(s.markShop).reduce((sum, id) => sum + B.marks.find(m => m.id === id).cost, 0), '印記商店');
    check(object(s.partnerLevels) && Object.entries(s.partnerLevels).every(([id, L]) => known(id) && (s.collection[id] > 0 || L === 0) && integer(L) && L <= 200), '夥伴訓練');
    check(Array.isArray(s.deco) && new Set(s.deco).size === s.deco.length && s.deco.every(id => B.decor.some(d => d.id === id)), '裝飾');
    // 2026-09-08 使用者定案：裝飾保留、但預設不擺出來（全部擺出來畫面太亂）。
    // deco = 買到的（決定 decoMul，不變）；decoShown = 玩家選擇要擺在桌上的，一定是 deco 的子集。
    check(Array.isArray(s.decoShown) && new Set(s.decoShown).size === s.decoShown.length && s.decoShown.every(id => s.deco.includes(id)), '裝飾擺設');
    check(number(s.peakRate) && (s.prestigeHintDate === null || typeof s.prestigeHintDate === 'string'), '輪迴提示');
    const slotLen = s.markShop.slot4 ? 4 : 3;
    check(Array.isArray(s.skillSlots) && s.skillSlots.length === slotLen && s.skillSlots.every((id, i) => id === null || (known(id) && s.collection[id] > 0 && i < E.slotCount(s))), '技能槽');
    check(new Set(s.skillSlots.filter(Boolean)).size === s.skillSlots.filter(Boolean).length, '重複槽位');
    check(Array.isArray(s.slotReadyAt) && s.slotReadyAt.length === slotLen && s.slotReadyAt.every(number), '換槽時間');
    check(object(s.cooldownUntil) && Object.entries(s.cooldownUntil).every(([id, t]) => known(id) && s.collection[id] > 0 && number(t)), '冷卻');
    check(Array.isArray(s.effects) && s.effects.length <= Object.keys(B.characters).length, '效果');
    const sources = new Set();
    for (const e of s.effects) {
      check(object(e) && known(e.source) && s.collection[e.source] > 0 && !sources.has(e.source), '效果來源'); sources.add(e.source);
      const base = B.characters[e.source], def = e.params || base;
      if (e.chain === undefined) e.chain = 1;
      check(integer(e.chain) && e.chain>=1 && e.chain<=3, '效果快照');
      if (e.params) {
        check(object(e.params) && def.kind===base.kind, '效果快照');
        // 快照可能來自任一組：星級 × 超越 × 羈絆 × 當家 × 夥伴訓練里程碑（0/25/50/75/100，與 economy.skillAt 同一套加法）
        const variants = [0,1,2,3,4,5].flatMap(trans=>[1,2,3,4,5].flatMap(star=>[0,1,2].flatMap(bond=>[0,1,2].flatMap(home=>[0,25,50,75,100].map(L=>{
          const p=B.skillAt(e.source,star,trans);
          if (bond && ['click','clickAdd'].includes(p.kind)) p.charges+=bond;
          if (bond && p.kind==='self') p.duration*=1.25**bond;
          for (let i=0;i<home;i++) p.cd*=.8;   // 場景親和 ×.8、本輪當家 ×.8、兩者都有（v3）；逐次乘才跟 economy.skillAt 的浮點結果一致
          if (L >= 25) { if (['click','clickAdd'].includes(p.kind) && p.charges) p.charges += 1; else if (p.duration) p.duration += 2; }
          if (L >= 50 && p.duration) p.duration += 2;
          if (L >= 75) p.cd *= .95;
          if (L >= 100) { for (const k of ['ratio','factor','copy']) if (p[k]) p[k] *= 1.1; if (p.multiplier) p.multiplier = 1 + (p.multiplier - 1) * 1.1; }
          return p;
        })))));
        check(variants.some(p=>['kind','multiplier','ratio','factor','copy','charges','duration','cd','basis'].every(k=>p[k]===def[k])), '技能快照參數');
      }
      check(e.energized === undefined || e.energized === 2, '充能快照');
      check(e.arts === undefined || (object(e.arts) && integer(e.arts.skill) && e.arts.skill <= 10 && integer(e.arts.cd) && e.arts.cd <= 10), '神器快照');
      const artSkill = 1 + .05 * (e.arts?.skill || 0), artCd = 1 - .02 * (e.arts?.cd || 0);
      const mult = def.multiplier === undefined ? undefined : 1+(def.multiplier-1)*[1,1.3,1.6][e.chain-1]*(e.energized || 1)*artSkill;
      check(def.kind && e.kind === def.kind && number(e.startedAt) && number(e.expiresAt) && Math.abs(e.expiresAt - e.startedAt - def.duration * 1000) < .001 && e.startedAt <= s.settledAt, '效果期限');
      check(Math.abs(s.cooldownUntil[e.source] - e.startedAt - def.cd * 1000 * artCd) < .001, '效果冷卻');
      if (e.kind === 'click') check(e.multiplier === mult && integer(e.remaining) && e.remaining > 0 && e.remaining <= def.charges, '次數效果');
      else if (e.kind === 'clickTime') check(e.multiplier === mult, '時間倍率');
      else if (e.kind === 'clickAdd') check(number(e.value) && integer(e.remaining) && e.remaining > 0 && e.remaining <= def.charges, '點擊加法');
      else if (['self', 'team'].includes(e.kind)) check(number(e.value), '產能快照');
      else check(known(e.target) && e.target !== e.source && s.collection[e.target] > 0 && number(e.value), '寄生快照');
    }
    check(object(s.settings) && typeof s.settings.muted === 'boolean' && B.modes.includes(s.settings.mode), '設定');
    s.settings.scene ??= 'backyard'; s.settings.music ??= true;
    s.settings.musicVolume ??= .6; s.settings.sfxVolume ??= .8;
    check(['musicVolume','sfxVolume'].every(k => number(s.settings[k]) && s.settings[k] <= 1), '音量');
    const scenes = node ? require('./clicker-scene.js').scenes : root.ClickerScenes;
    check(s.gift === null || !!scenes[s.settings.scene]?.enemy?.gift, '禮包場景');
    check(Array.isArray(s.bossWins) && new Set(s.bossWins).size===s.bossWins.length && s.bossWins.every(id=>Object.hasOwn(scenes,id) && !!scenes[id].boss), '王包勝利');
    check(object(s.bossCracks) && Object.entries(s.bossCracks).every(([id,v])=>Object.hasOwn(scenes,id) && number(v) && v<=scenes[id].boss.crackMax), '王包裂痕');
    if(s.bossResult!==null) {const r=s.bossResult;check(object(r) && Object.hasOwn(scenes,r.scene) && typeof r.won==='boolean' && number(r.at) && number(r.crack) && r.crack<=scenes[r.scene].boss.crackMax && r.next===E.nextScene(r.scene), '王包結算');}
    check(typeof s.settings.music === 'boolean' && E.unlocked(s,s.settings.scene) && s.package.index >= scenes[s.settings.scene].unlockPackages, '場景與音樂');
    function pack(p,id,need=E.requirement(p?.index,id),boss=false) {
      check(object(p), '硬殼包');
      p.shells ??= [...(scenes[id].enemy?.shell || [])]; p.shellHp ??= 3; p.blocked ??= 0;
      if (!boss) {
        // 三連包：三個子包各不超過 H/3，總和就是 progress；輸送帶：deadline 為 null（尚未進場）或時間
        if (E.tripleFor(id)) {
          if (!p.sub) { let left = p.progress; p.sub = [0,1,2].map(() => { const v = Math.min(left, need/3); left -= v; return { progress:v }; }); }
          check(Array.isArray(p.sub) && p.sub.length === 3 && p.sub.every(x => object(x) && number(x.progress) && x.progress <= need/3 + need*1e-9), '三連包');
          check(Math.abs(p.sub.reduce((a,x) => a + x.progress, 0) - p.progress) <= need*1e-9, '三連包總和');
        }
        if (E.timerFor(id)) { p.deadline ??= null; check(p.deadline === null || number(p.deadline), '輸送帶時限'); }
      }
      if (!boss && p.gate !== undefined) check(object(p.gate) && integer(p.gate.index) && p.gate.index % B.V3.GATE_EVERY === 0 && p.gate.index === p.index - 1 && number(p.gate.cooldownUntil) && (p.gate.lost === undefined || p.gate.lost === true), '小王');
      const allowed=scenes[id].enemy?.shell || [];
      check(Array.isArray(p.shells) && p.shells.every((v,i)=>allowed.includes(v) && (!i || p.shells[i-1]>v)) && integer(p.shellHp) && p.shellHp>=1 && p.shellHp<=3 && number(p.blocked), '硬殼');
      check(number(p.progress) && p.progress<need && (!p.shells.length || p.progress<=need*(1-p.shells[0])+need*1e-12), '硬殼進度');
    }
    pack(s.package,s.settings.scene);
    check(object(s.scenePackages), '場景進度');
    for (const [id,p] of Object.entries(s.scenePackages)) {
      check(E.unlocked(s,id) && integer(p.index) && p.index>=1 && Number.isFinite(E.requirement(p.index,id)), '場景進度'); pack(p,id);
    }
    if (s.thief !== undefined) check(object(s.thief) && !!scenes[s.settings.scene].thief && !s.boss && typeof s.thief.active === 'boolean' && number(s.thief.remainingMs) && s.thief.remainingMs <= (s.thief.active ? 12600 : 120000) && integer(s.thief.hits) && s.thief.hits < 5, '零食小偷');
    if (s.boss) {
      const b=s.boss, cfg=scenes[s.settings.scene].boss;
      check(object(b) && b.scene===s.settings.scene && (b.gate !== undefined ? integer(b.gate) && s.package.gate?.index === b.gate : (b.scene === 'city' || !(s.runWins || []).includes(b.scene))) && !s.pending && number(b.need) && b.need>0 && number(b.dealt) && b.dealt<b.need && number(b.startedAt) && number(b.endsAt) && b.endsAt-b.startedAt===(cfg.seconds+(s.markShop?.bossTime ? 10 : 0))*1000 && number(b.crack) && b.crack<=cfg.crackMax, '王包');
      pack({...b,progress:b.dealt},b.scene,b.need,true);
    }
    if (s.pending !== null) {
      const draw = s.pending?.draw;
      check(object(draw) && typeof draw.id === 'string' && draw.id.length > 0 && integer(draw.visualSeed) && draw.visualSeed <= 0xffffffff, 'pending 身分');
      check(Array.isArray(draw.entries) && [1, 5].includes(draw.entries.length) && draw.entries.length <= s.paidDraws+s.usedFreeDraws, 'pending 張數');
      const counts = { ...s.collection }, keys = new Set();
      for (const [i, item] of draw.entries.entries()) {
        const id = item?.entry?.id;
        check(known(id) && item.key === `${draw.id}:${i}` && !keys.has(item.key), 'pending 角色'); keys.add(item.key);
        check(item.owned === (counts[id] || 0) && item.dup === (item.owned > 0), 'pending 升星計數');
        check(item.veil === undefined || (item.veil === 'rare' && item.entry.rarity === 'legendary'), 'pending 轉彩');
        if (pool) check(item.entry.kind === pool.byId[id].kind && item.entry.rarity === pool.byId[id].rarity && item.entry.name === pool.byId[id].name, 'pending 目錄');
        counts[id] = (counts[id] || 0) + 1;
      }
      const lastLegendary = draw.entries.findLastIndex((item) => ['legendary','mythic'].includes(item.entry.rarity));
      if (lastLegendary >= 0) check(s.pity.sinceLegendary === draw.entries.length - lastLegendary - 1, 'pending 保底');
    }
    // ---- v3 欄位：缺的補預設；隊伍／派遣不合法就靜默修正（不進 REPAIRS，那張表只准放暫時狀態）
    s.artifacts ??= {}; s.collectibles ??= [];
    { const PoolRef = pool || (node ? require('./gacha-pool.js') : root.GachaPool); check(Array.isArray(s.collectibles) && new Set(s.collectibles).size === s.collectibles.length && s.collectibles.every(id => PoolRef.COLLECTIBLE_IDS.includes(id)), '收藏卡'); }
    check(object(s.artifacts) && Object.entries(s.artifacts).every(([id, r]) => B.ARTIFACTS.some(a => a.id === id && a.id !== 'blessing' && integer(r) && r <= a.max)), '神器');
    s.runWins ??= []; s.runPacks ??= 0; s.runGates ??= 0; s.champions ??= []; s.dispatch ??= []; s.dispatchDay ??= null; s.dispatchHalf ??= {}; s.legacy ??= null;
    s.chestSeed ??= Math.floor(Math.random() * 4294967296); s.settings.autoChallenge ??= true;
    check(Array.isArray(s.runWins) && new Set(s.runWins).size === s.runWins.length && s.runWins.every(id => s.bossWins.includes(id)) && integer(s.runPacks) && integer(s.runGates), '本輪紀錄');
    check(integer(s.chestSeed) && typeof s.settings.autoChallenge === 'boolean' && (s.legacy === null || object(s.legacy)), '寶箱種子／自動挑戰／封存');
    check(Array.isArray(s.dispatch) && s.dispatch.length <= B.V3.DISPATCH_SLOTS && s.dispatch.every(d => object(d) && known(d.id) && s.collection[d.id] > 0 && number(d.startedAt) && number(d.until) && d.until - d.startedAt === B.V3.DISPATCH_MS) && new Set(s.dispatch.map(d => d.id)).size === s.dispatch.length, '派遣');
    check((s.dispatchDay === null || (object(s.dispatchDay) && integer(s.dispatchDay.day) && integer(s.dispatchDay.count))) && object(s.dispatchHalf) && Object.entries(s.dispatchHalf).every(([id, n]) => known(id) && [0,1].includes(n)), '派遣帳');
    s.champions = s.champions.filter(id => known(id) && s.collection[id] > 0).slice(0, B.V3.CHAMPIONS);
    if (!Array.isArray(s.roster)) s.roster = [];
    s.roster = [...new Set(s.roster.filter(id => known(id) && s.collection[id] > 0 && !E.dispatched(s, id)))];
    while (E.rosterViolations(s.roster).length) s.roster.pop();
    if (!s.roster.length && Object.keys(s.collection).length) s.roster = E.autoRoster(s, s.skillSlots.filter(Boolean));   // 自動編隊時技能槽裡的先保住
    s.skillSlots = s.skillSlots.map(id => id && !s.roster.includes(id) ? null : id);
    for (const id of Object.keys(B.characters).filter(id => !B.originalIds.includes(id))) {
      s.dust[id] ??= s.collection[id] || 0; s.promotions[id] ??= 0; s.transcend[id] ??= 0; s.partnerLevels[id] ??= 0;
    }
    return s;
  }
  // ---------- 自動修復 ----------
  // 2026-09-08：使用者朋友的存檔驗證失敗，遊戲只丟「存檔無法讀取」擋住整個畫面，
  // 而匯入鍵在被 inert 掉的 #stats 裡——**修好的存檔匯不進去，變成死循環**。
  // 這裡的原則：驗證失敗不等於整份存檔沒救。真正值錢的東西（卡片、粉塵、幣、等級、
  // 印記、徽章、升階／超越／夥伴等級）幾乎不會是壞掉的那一塊；壞的通常是「這一場的暫時狀態」。
  // 所以照「損失由小到大」的順序把暫時狀態逐項重置，每丟一項就重驗一次，過了就收工。
  // ⚠ 這張表**只准放丟掉了玩家不會心痛的東西**。任何會清掉養成進度的步驟都不準加進來。
  // 槽位陣列的長度是「印記商店有沒有買第四槽」決定的，不是固定 3。
  // 長度寫死 3 的話，買過 slot4 的存檔會從「每日一包」壞掉一路修到「技能槽」還是過不了。
  const slotArray = (s, fill) => Array(s?.markShop?.slot4 ? 4 : 3).fill(fill);
  const REPAIRS = [
    ['王包結算牌',   (s, n) => { s.bossResult = null; }],
    ['進行中的王包', (s, n) => { s.boss = null; s.bossCooldownUntil = 0; }],
    ['還沒收下的招募', (s, n) => { s.pending = null; s.pity = { sinceLegendary: 0 }; }],
    ['技能效果與冷卻', (s, n) => { s.effects = []; s.cooldownUntil = {}; s.slotReadyAt = slotArray(s, 0); s.chain = {count:1,expiresAt:0}; }],
    ['今日限定包',   (s, n) => { s.daily = null; }],
    ['零食小偷與禮包', (s, n) => { s.gift = null; s.giftResult = null; s.nextGiftAt = 0; delete s.thief; }],
    ['連點與漏包紀錄', (s, n) => { s.sweep = {last:null,count:0,at:0}; s.missed = 0; }],
    ['技能槽',       (s, n) => { s.skillSlots = slotArray(s, null); s.slotReadyAt = slotArray(s, 0); }],
    ['拆包進度',     (s, n) => { s.package = E.newPackage(s.settings?.scene || 'backyard'); }],
    ['場景與音量設定', (s, n) => { s.settings = fresh(n).settings; s.package = E.newPackage('backyard'); }],
  ];
  /** 回傳 { state, applied:[步驟名] }；救不回來就回 null。
   *  兩輪：先單獨試每一步（大多數情況只壞一塊，這樣只賠那一塊），
   *  都不行才照順序累加。不先試單步的話，「今日限定包壞掉」會連還沒收下的招募一起賠進去。
   *  每次都從原始資料重新複製一份——validate 會就地改寫傳進去的物件（補預設、改名），
   *  拿同一份接力試會越試越髒。 */
  function repair(parsed, pool, now = Date.now()) {
    const copy = () => { try { return JSON.parse(JSON.stringify(parsed)); } catch { return null; } };
    if (!object(copy())) return null;
    const attempt = (steps) => {
      const s = copy(); if (!s) return null;
      try { for (const [, fix] of steps) fix(s, now); } catch { return null; }
      try { return { state: validate(s, pool), applied: steps.map(([name]) => name) }; }
      catch { return null; }
    };
    for (const step of REPAIRS) { const r = attempt([step]); if (r) return r; }
    for (let i = 1; i <= REPAIRS.length; i++) { const r = attempt(REPAIRS.slice(0, i)); if (r) return r; }
    return null;
  }
  const BROKEN_KEY = KEY + '_broken';
  function create(storage, { now = Date.now, pool } = {}) {
    let state = null, raw = null, error = null, blocked = false, repaired = null;
    try { raw = storage.getItem(KEY); state = raw === null ? fresh(now()) : validate(JSON.parse(raw), pool); if (state.boss) state=E.abandonBoss(state,now()); }
    catch (err) {
      // 先原封不動備份壞掉的那份，再試修復；修不好才擋畫面。
      let fixed = null;
      try { fixed = raw === null ? null : repair(JSON.parse(raw), pool, now()); } catch { fixed = null; }
      if (fixed) {
        try { storage.setItem(BROKEN_KEY, raw); } catch { /* 備份寫不進去也不能因此不讓人玩 */ }
        state = fixed.state; if (state.boss) state = E.abandonBoss(state, now());
        repaired = { applied: fixed.applied, reason: err.message };
      } else { error = err; blocked = true; }
    }
    return {
      get state() { return state; }, get raw() { return raw; }, get error() { return error; }, get blocked() { return blocked; },
      /** 這次載入有沒有自動修復過：{ applied:[步驟名], reason:原本的錯誤訊息 }，沒有就是 null。 */
      get repaired() { return repaired; },
      // 點擊與 1Hz 結算只更新工作副本；消費提交成功才替換它。
      stage(next) { if (blocked) return false; state = next; return true; },
      commit(next = state) {
        if (!state) return false;
        try {
          const candidate = E.clone(next);
          candidate.revision = state.revision + 1; candidate.savedAt = Math.max(state.savedAt, now());
          validate(candidate, pool);
          const encoded = JSON.stringify(candidate, (key,value) => key === 'thief' ? undefined : value);
          storage.setItem(KEY, encoded);
          state = candidate; raw = encoded; error = null; blocked = false; return true;
        } catch (err) { error = err; blocked = true; return false; }
      },
    };
  }
  const api = { KEY, BROKEN_KEY, fresh, validate, repair, REPAIRS, create };
  if (node) module.exports = api; else root.ClickerSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
