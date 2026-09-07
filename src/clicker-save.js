(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const X = node ? require('./clicker-extras.js') : root.ClickerExtras;   // 第十二輪：每日一包／徽章／匯出匯入
  const KEY = 'clicker_save';
  function fresh(now) {
    return { version: 2, balanceVersion: 1, revision: 0, savedAt: now, settledAt: now,
      coins: 0, lifetimeCoins: 0, manualClicks: 0, clickLevel: 0, trainingLevel: 0,
      collection: {}, dust: {}, universalDust: 0, promotions: {}, transcend: {}, overflow: {}, awakened: {}, owned: {wardrobe:['sounds:soft','fx:shard']}, paidDraws: 0, pity: { sinceLegendary: 0 }, pending: null,
      package: E.newPackage('backyard'), claimedMilestones: [],
      boss: null, bossWins: [], bossCracks: {}, bossCooldownUntil: 0, bossResult: null, scenePackages: {}, freeDraws: 0, usedFreeDraws: 0,
      chain: {count:1,expiresAt:0}, daily: null, badges: [], pick100: null,
      marks: 0, marksClaimed: 0, prestiges: 0, markShop: {}, autoClick: 0, autoRemainder: 0, autoClicks: 0, partnerLevels: {}, deco: [], peakRate: 0, prestigeHintDate: null,
      missed: 0, sweep: {last:null,count:0,at:0}, gift: null, nextGiftAt: 0, giftResult: null,
      skillSlots: [null, null, null], cooldownUntil: {}, slotReadyAt: [0, 0, 0], effects: [],
      settings: { clickSound:'soft', clickFx:'shard', muted: false, mode: 'wish', scene: 'backyard', music: true, musicVolume: .6, sfxVolume: .8 } };
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
    check(object(s) && s.version === 2 && s.balanceVersion === 1, '版本（本版不降級或重置）');
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
    s.marks ??= 0; s.marksClaimed ??= 0; s.prestiges ??= 0; s.markShop ??= {}; s.autoClick ??= 0; s.autoRemainder ??= 0; s.autoClicks ??= 0; s.partnerLevels ??= {}; s.deco ??= []; s.peakRate ??= 0; s.prestigeHintDate ??= null;
    check(integer(s.marks) && integer(s.marksClaimed) && s.marks <= s.marksClaimed && integer(s.prestiges) && integer(s.autoClick) && s.autoClick <= B.autoClickCap(s) && number(s.autoRemainder) && s.autoRemainder < 1 && integer(s.autoClicks), '輪迴與電動手指');
    check(object(s.markShop) && Object.entries(s.markShop).every(([id, v]) => B.marks.some(m => m.id === id) && v === true) && s.marksClaimed >= s.marks + Object.keys(s.markShop).reduce((sum, id) => sum + B.marks.find(m => m.id === id).cost, 0), '印記商店');
    check(object(s.partnerLevels) && Object.entries(s.partnerLevels).every(([id, L]) => known(id) && (s.collection[id] > 0 || L === 0) && integer(L) && L <= 200), '夥伴訓練');
    check(Array.isArray(s.deco) && new Set(s.deco).size === s.deco.length && s.deco.every(id => B.decor.some(d => d.id === id)), '裝飾');
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
        const variants = [0,1,2,3,4,5].flatMap(trans=>[1,2,3,4,5].flatMap(star=>[0,1,2].flatMap(bond=>[false,true].flatMap(home=>[0,25,50,75,100].map(L=>{
          const p=B.skillAt(e.source,star,trans);
          if (bond && ['click','clickAdd'].includes(p.kind)) p.charges+=bond;
          if (bond && p.kind==='self') p.duration*=1.25**bond;
          if (home) p.cd*=.8;
          if (L >= 25) { if (['click','clickAdd'].includes(p.kind) && p.charges) p.charges += 1; else if (p.duration) p.duration += 2; }
          if (L >= 50 && p.duration) p.duration += 2;
          if (L >= 75) p.cd *= .95;
          if (L >= 100) { for (const k of ['ratio','factor','copy']) if (p[k]) p[k] *= 1.1; if (p.multiplier) p.multiplier = 1 + (p.multiplier - 1) * 1.1; }
          return p;
        })))));
        check(variants.some(p=>['kind','multiplier','ratio','factor','copy','charges','duration','cd','basis'].every(k=>p[k]===def[k])), '技能快照參數');
      }
      const mult = def.multiplier === undefined ? undefined : 1+(def.multiplier-1)*[1,1.3,1.6][e.chain-1];
      check(def.kind && e.kind === def.kind && number(e.startedAt) && number(e.expiresAt) && Math.abs(e.expiresAt - e.startedAt - def.duration * 1000) < .001 && e.startedAt <= s.settledAt, '效果期限');
      check(Math.abs(s.cooldownUntil[e.source] - e.startedAt - def.cd * 1000) < .001, '效果冷卻');
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
      check(object(b) && b.scene===s.settings.scene && (b.scene === 'fridge' || !s.bossWins.includes(b.scene)) && !s.pending && number(b.need) && b.need>0 && number(b.dealt) && b.dealt<b.need && number(b.startedAt) && number(b.endsAt) && b.endsAt-b.startedAt===(cfg.seconds+(s.markShop?.bossTime ? 10 : 0))*1000 && number(b.crack) && b.crack<=cfg.crackMax, '王包');
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
    for (const id of Object.keys(B.characters).filter(id => !B.originalIds.includes(id))) {
      s.dust[id] ??= s.collection[id] || 0; s.promotions[id] ??= 0; s.transcend[id] ??= 0; s.partnerLevels[id] ??= 0;
    }
    return s;
  }
  function create(storage, { now = Date.now, pool } = {}) {
    let state = null, raw = null, error = null, blocked = false;
    try { raw = storage.getItem(KEY); state = raw === null ? fresh(now()) : validate(JSON.parse(raw), pool); if (state.boss) state=E.abandonBoss(state,now()); }
    catch (err) { error = err; blocked = true; }
    return {
      get state() { return state; }, get raw() { return raw; }, get error() { return error; }, get blocked() { return blocked; },
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
  const api = { KEY, fresh, validate, create };
  if (node) module.exports = api; else root.ClickerSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
