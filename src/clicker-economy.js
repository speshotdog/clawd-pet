(function (root) {
  const B = typeof module !== 'undefined' && module.exports ? require('./clicker-balance.js') : root.ClickerBalance;
  const Scenes = typeof module !== 'undefined' && module.exports ? require('./clicker-scene.js').resolve : root.ClickerScene.resolve;
  const Pool = typeof module !== 'undefined' && module.exports ? require('./gacha-pool.js') : root.GachaPool;
  const clone = (s) => JSON.parse(JSON.stringify(s));
  // 手勁：每級固定點擊力 ×1.15、價 ×1.35（翻倍約 ×4 價）；原本 1.18／1.30 翻倍只要 ×3 價，前十分鐘點擊力就超過被動
  const clickCost = (l) => Math.ceil(10 * 1.35 ** l);
  // 2026-09-06 數值重整（參考 Cookie Clicker）：全隊訓練每級 ×1.25、價 ×2.5（一次翻倍約 ×17 價；CC 升級品每步約 ×10～×100）
  const trainingCost = (t) => Math.ceil(2500 * B.V3.TRAIN_COST_MUL ** t);
  // 招募價釘在「全員視為中位數等級的每秒收益」：單抽 30 秒、五連 135 秒，招募只計一半全隊訓練倍率的被動收益（下限 150／700），後期永遠抽得起
  const DRAW_SECONDS = { single: 30, five: 135 }, DRAW_FLOOR = { single: 150, five: 700 };
  const drawCost = (s, count = 1) => { const P = rates(s, { partnerLevel: medianPartnerLevel(s), trainingLevel: s.trainingLevel / 2 }).P; return count >= 5 ? Math.max(DRAW_FLOOR.five, Math.ceil(DRAW_SECONDS.five * P)) : count * Math.max(DRAW_FLOOR.single, Math.ceil(DRAW_SECONDS.single * P)); };
  // 夥伴訓練＝CC 的建築：每級 +1 倍（線性），10／25／50／100／150／200 級各 ×2（CC 的建築升級品節奏）
  const PARTNER_MILESTONES = [10, 25, 50, 100, 150, 200];
  const partnerMul = (L) => (1 + L) * B.V3.PARTNER_G ** L * 2 ** PARTNER_MILESTONES.filter(m => L >= m).length;
  function medianPartnerLevel(s) {
    const levels = Object.keys(s.collection).filter(id => s.collection[id] > 0).map(id => s.partnerLevels?.[id] || 0).sort((a,b) => a-b);
    return levels.length ? levels[Math.floor((levels.length-1)/2)] : 0;
  }
  const stars = (n) => n < 1 ? 0 : B.stars.filter((threshold) => n >= threshold).length;
  const starMultiplier = (n) => n < 1 ? 0 : 1 + .25 * (stars(n) - 1);
  const origin = id => ['rare','epic','legendary','mythic'].indexOf(Pool.byId[id]?.rarity);
  const tier = (s,id) => origin(id) + (s.promotions?.[id] || 0);
  const dust = (s,id) => s.dust?.[id] ?? s.collection[id] ?? 0;
  const transcendCosts = [[6,8,10,12,14],[6,7,8,9,10],[4,5,6,7,10],[4,5,6,7,10]];
  const promotionCost = (s,id) => tier(s,id) >= 2 ? 0 : origin(id) === 0 && s.promotions?.[id] === 1 ? 16 : 12;
  const transcendCost = (s,id) => transcendCosts[origin(id)][s.transcend?.[id] || 0] || 0;
  // Dust is cumulative. Paid progression records account for spending; the first 16 retain five stars.
  const spentDust = (s,id) => ((s.promotions?.[id] || 0) ? 12 + (s.promotions[id] === 2 ? 16 : 0) : 0) + transcendCosts[origin(id)].slice(0,s.transcend?.[id] || 0).reduce((a,b)=>a+b,0);
  const availableDust = (s,id) => Math.max(0,dust(s,id)-16-spentDust(s,id));
  const exchangeRate = id => origin(id) === 3 ? 100 : origin(id)+1;   // 神話 100 萬用粉塵換 1 顆（使用者 2026-09-08）
  const rarity = (s,id) => ['rare','epic','legendary','mythic'][tier(s,id)];
  function grow(state,id,now,trans) {
    const s=settle(state,now).state;
    if (!Object.hasOwn(B.characters,id) || s.pending || stars(dust(s,id))<5) throw new Error('要 5★ 才能升階或超越');
    const cost=trans ? transcendCost(s,id) : promotionCost(s,id);
    if (!cost || (trans && tier(s,id)<2)) throw new Error('已是最高階，或還沒升到傳說階')
    if (availableDust(s,id)<cost) throw new Error('粉塵不足');
    const key=trans?'transcend':'promotions'; s[key] ||= {}; s[key][id]=(s[key][id] || 0)+1;
    s.awakened ||= {}; if (s.transcend?.[id]===5) s.awakened[id]=true;
    return s;
  }
  const promote = (s,id,now) => grow(s,id,now,false);
  const transcend = (s,id,now) => grow(s,id,now,true);
  function receive(s,id) {
    s.dust ||= {}; s.overflow ||= {}; s.universalDust ||= 0;
    const before=stars(dust(s,id)); s.dust[id]=dust(s,id);
    if (!s.collection[id]) { s.partnerLevels ||= {}; s.partnerLevels[id]=medianPartnerLevel(s); }
    s.collection[id]=(s.collection[id] || 0)+1;
    // v3 §三：新夥伴有空位就自動入隊（撞前綴上限就留在卡冊），玩家不用先開編隊才有收益
    if (Array.isArray(s.roster) && !s.roster.includes(id) && s.roster.length < 20 && !rosterViolations([...s.roster,id]).length) s.roster.push(id);
    if (s.transcend?.[id]===5) {
      if (origin(id)===3) { s.universalDust+=100; }   // 神話滿養重複一張＝100 萬用粉塵（與兌換價對稱）
      else { const rate=[4,2,1][origin(id)], count=(s.overflow[id] || 0)+1; s.universalDust+=Math.floor(count/rate); s.overflow[id]=count%rate; }
    } else s.dust[id]++;
    return {id,from:before,to:stars(s.dust[id])};
  }
  function exchange(state,id,amount,now=state.settledAt) {
    const s=settle(state,now).state;
    if (!Object.hasOwn(B.characters,id) || !Number.isSafeInteger(amount) || amount<1 || s.pending || s.transcend?.[id]===5) throw new Error('無法兌換');
    // amount is the universal-dust budget; unconvertible remainder stays in the jar.
    const rate=exchangeRate(id), count=Math.floor(amount/rate);
    if (!count || amount>s.universalDust) throw new Error('萬用粉塵不足');
    s.universalDust-=count*rate; s.dust[id]=dust(s,id)+count;
    return s;
  }
  const wardrobePrice = s => 20000;
  function wardrobe(state,kind,id,wear,now) {
    const s=settle(state,now).state, key=`${kind}:${id}`;
    if (!B.wardrobe[kind]?.some(item=>item.id===id) || s.pending) throw new Error('更衣室沒有這件');
    const owned=s.owned.wardrobe.includes(key);
    if (wear) { if (!owned) throw new Error('尚未擁有'); s.settings[kind==='sounds'?'clickSound':'clickFx']=id; }
    else {
      if (owned) throw new Error('已經擁有'); const price=wardrobePrice(s);
      if (!Number.isFinite(price) || s.coins<price) throw new Error('餘額不足');
      s.coins-=price; s.owned.wardrobe.push(key);
    }
    return s;
  }
  const individual = (s, id, partnerLevel = s.partnerLevels?.[id] || 0) => B.characters[id].base * starMultiplier(dust(s,id)) * ([1,1.8,3.2,5.5][tier(s,id)]/[1,1.8,3.2,5.5][origin(id)]) * (1+[.06,.09,.14,.20][origin(id)]*(s.transcend?.[id] || 0)) * 1.25 ** s.trainingLevel * (affinity(s,id) ? 1.5 : 1) * (champion(s,id) ? B.V3.CHAMPION_MUL : 1) * partnerMul(partnerLevel);
  // v3 §五：本輪當家＝輪迴時隨機 2 張 ×1.5、CD −20%（跟場景親和同形狀），只在本輪
  const champion = (s,id) => (s.champions || []).includes(id);
  // 第十三輪：印記永久倍率、桌面裝飾
  const markMul = (s) => 1 + B.MARK_MUL_COEF * Math.sqrt(s.marksClaimed || 0);
  const blessMul = (s) => 1 + .1 * (s.blessing || 0);
  const art = (s, id) => s.artifacts?.[id] || 0;   // D 路神器等級
  const skillArt = (s) => 1 + .05 * art(s, 'skill');
  const cdArt = (s) => 1 - .02 * art(s, 'cd');
  const decoMul = (s) => 1 + .01 * (s.deco?.length || 0);
  const affinity = (s,id) => (Scenes(s.settings?.scene).affinity || []).includes(id);
  const activeBonds = s => B.bonds.filter(b => b.pair.every(id => s.collection[id] > 0));
  function skillAt(s,id,star = stars(dust(s,id) || 1)) {
    const p = B.skillAt(id,star,s.transcend?.[id] || 0);
    for (const b of activeBonds(s)) {
      if (b.effect.chargesPlus && ['click','clickAdd'].includes(p.kind)) p.charges += b.effect.chargesPlus;
      if (b.effect.selfDurationMul && p.kind === 'self') p.duration *= b.effect.selfDurationMul;
    }
    if (affinity(s,id)) p.cd *= .8;
    if (champion(s,id)) p.cd *= .8;
    // 夥伴個別訓練里程碑：25 次數+1（非次數型改持續+2s）、50 持續+2s、75 CD −5%、100 效果 ×1.1
    const L = s.partnerLevels?.[id] || 0;
    if (L >= 25) { if (['click','clickAdd'].includes(p.kind) && p.charges) p.charges += 1; else if (p.duration) p.duration += 2; }
    if (L >= 50 && p.duration) p.duration += 2;
    if (L >= 75) p.cd *= .95;
    if (L >= 100) { for (const k of ['ratio','factor','copy']) if (p[k]) p[k] *= 1.1; if (p.multiplier) p.multiplier = 1 + (p.multiplier - 1) * 1.1; }
    return p;
  }
  function recommend(state,index,now) {
    const preset = B.recommendations[index];
    if (!preset) throw new Error('未知組合');
    let s = clone(state);
    const desired = s.skillSlots.map((id,i) => i < slotCount(s) && s.collection[preset.slots[i]] ? preset.slots[i] : id);
    // Missing-character slots retain their occupants; those occupants cannot also move.
    for (let pass=0;pass<3;pass++) for (let i=0;i<3;i++) if (desired[i] !== s.skillSlots[i] && desired.some((id,j)=>j!==i && id===desired[i] && desired[j]===s.skillSlots[j])) desired[i]=s.skillSlots[i];
    for (let i=0;i<slotCount(s);i++) if (desired[i] !== s.skillSlots[i]) s=equip(s,i,null,now);
    for (let i=0;i<slotCount(s);i++) if (desired[i] !== s.skillSlots[i]) s=equip(s,i,desired[i],now);
    return s;
  }
  // ---- v3 §三 編隊：前綴上限用出身（原生稀有度）算層，升階不改所屬層（使用者 2026-09-12 定案 (a)）
  // 空隊伍＝自動編隊（沒開過編隊畫面的玩家照樣有收益）；沒有 roster 欄位的舊狀態＝全部
  const rosterOf = s => !Array.isArray(s.roster) ? Object.keys(B.characters) : s.roster.length ? s.roster.filter(id => s.collection[id] > 0) : autoRoster(s, (s.skillSlots || []).filter(Boolean));
  const rosterCounts = ids => B.V3.ROSTER_LIMITS.map((_,i) => ids.filter(id => (3 - origin(id)) <= i).length);   // 神話 origin 3 → 第 0 層
  const rosterViolations = ids => rosterCounts(ids).flatMap((n,i) => n > B.V3.ROSTER_LIMITS[i] ? [i] : []);
  const dispatched = (s,id) => (s.dispatch || []).some(d => d.id === id);
  function setRoster(state, ids, now) {
    const s = settle(state, now).state;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length > 20 || ids.some(id => !s.collection[id] || dispatched(s,id))) throw new Error('隊伍不合法');
    if (rosterViolations(ids).length) throw new Error('超過階級上限');
    s.roster = [...ids];
    s.skillSlots = s.skillSlots.map(id => id && !ids.includes(id) ? null : id);   // 離隊的卡一併離開技能槽
    return s;
  }
  // 自動編隊：按目前每秒收益由高到低塞，撞上限就跳過（遷移與新手用）
  function autoRoster(s, seed = []) {
    const ids = Object.keys(s.collection).filter(id => s.collection[id] > 0 && !dispatched(s,id)).sort((a,b) => individual(s,b) - individual(s,a));
    const out = []; for (const id of seed) if (s.collection[id] > 0 && !out.includes(id) && !rosterViolations([...out,id]).length && out.length < 20) out.push(id);   // 技能槽裡的先保住
    for (const id of ids) { if (out.length >= 20) break; if (!out.includes(id) && !rosterViolations([...out,id]).length) out.push(id); }
    return out;
  }
  // ---- v3 §六 派遣：只能派不在隊的卡、4 小時、回來給該角色粉塵 1（傳說／神話半顆）＋萬用 1；每日最多 9 次回收
  const dayKey = now => Math.floor(now / 86400000);
  function dispatch(state, id, now) {
    const s = settle(state, now).state;
    s.dispatch ||= [];
    if (!s.collection[id] || rosterOf(s).includes(id) || dispatched(s,id) || s.dispatch.length >= B.V3.DISPATCH_SLOTS) throw new Error('無法派遣');
    s.dispatch.push({ id, startedAt: s.settledAt, until: s.settledAt + B.V3.DISPATCH_MS });
    return s;
  }
  function recall(state, now) {
    const s = settle(state, now).state, done = (s.dispatch || []).filter(d => d.until <= s.settledAt);
    if (!done.length) throw new Error('還沒回來');
    s.dispatchDay = s.dispatchDay?.day === dayKey(s.settledAt) ? s.dispatchDay : { day: dayKey(s.settledAt), count: 0 };
    const rewards = [];
    for (const d of done) {
      s.dispatch = s.dispatch.filter(x => x !== d);
      if (s.dispatchDay.count >= B.V3.DISPATCH_DAILY) { rewards.push({ id: d.id, capped: true }); continue; }
      s.dispatchDay.count++;
      s.dispatchHalf ||= {};
      if (origin(d.id) >= 2) { s.dispatchHalf[d.id] = (s.dispatchHalf[d.id] || 0) + 1; if (s.dispatchHalf[d.id] >= 2) { s.dispatchHalf[d.id] = 0; s.dust[d.id] = dust(s,d.id) + 1; } }
      else s.dust[d.id] = dust(s,d.id) + 1;
      s.universalDust = (s.universalDust || 0) + 1;
      rewards.push({ id: d.id, capped: false });
    }
    return { state: s, rewards };
  }
  function rates(s, options = {}) {
    if (options.trainingLevel !== undefined) s = { ...s, trainingLevel: options.trainingLevel };
    // v3 §三：只算隊伍裡的（沒有 roster 欄位的舊狀態＝全部，讓遷移前的驗證能過）
    const P = rosterOf(s).reduce((sum, id) => sum + individual(s, id, options.partnerLevel), 0);
    const mul = (Scenes(s.settings?.scene).rewardMul || 1) * decoMul(s), M = markMul(s) * blessMul(s);
    const trait = (s.skillSlots || []).reduce((m,id) => m * (id && s.collection[id] ? skillAt(s,id).trait?.clickMul || 1 : 1), 1);
    const share = .05 * (1 + (s.markShop?.tapShare1 ? 1 : 0) + (s.markShop?.tapShare2 ? 1 : 0));   // v3 §九：5％→10％→15％
    return { P: M * P * mul, D: trait * (1 + .1 * art(s, 'tap')) * (M * 1.15 ** s.clickLevel + share * M * P) * mul };
  }
  function tagFor(entry, dup, owned, state) {
    if (state?.transcend?.[entry.id]===5) return {text:`萬用 +${['¼','½','1','2'][origin(entry.id)]}`,cls:'mastery'};
    if (!owned) return { text: 'NEW', cls: 'new' };
    if (owned >= 16) return { text: `熟練 +${owned + 1 - 16}%`, cls: 'mastery' };
    if (stars(owned + 1) > stars(owned)) return { text: `${stars(owned)}★ → ${stars(owned + 1)}★`, cls: 'star-up' };
    return { text: `升星進度 ${owned + 1}/${B.stars[stars(owned)]}`, cls: 'dup' };
  }
  const requirement = (k, sceneId = 'backyard') => 100 * 1.12 ** (k - 1) * Scenes(sceneId).requirementMul;
  // expm1 保留小區間精度；二分搜尋只依包數的對數次數運算。
  const packageSum = (index, count, sceneId) => count === 0 ? 0 : requirement(index, sceneId) * Math.expm1(count * Math.log(1.12)) / .12;
  const shellsFor = id => [...(Scenes(id).enemy?.shell || [])];
  // 第十一輪：三種敵人只看場景設定的 enemy 欄位（triple／timer／gift），不認場景名
  const enemyOf = id => Scenes(id).enemy || {};
  const tripleFor = id => !!enemyOf(id).triple;
  const timerFor = id => enemyOf(id).timer || 0;
  const giftFor = id => enemyOf(id).gift || null;
  const SWEEP_WINDOW_MS = 1500, SWEEP_BONUS = .15;
  const rand = (range, rng = Math.random) => range[0] + rng() * (range[1] - range[0]);
  const emptySub = () => [{ progress:0 }, { progress:0 }, { progress:0 }];
  function newPackage(id, index = 1) {
    const p = { index, progress:0, shells:shellsFor(id), shellHp:3, blocked:0 };
    if (tripleFor(id)) p.sub = emptySub();
    if (timerFor(id)) p.deadline = null;   // 進場時由 stampDeadline 蓋上時限
    return p;
  }
  // 三連包：三個子包各需 H/3；只有點擊有指向（target 0..2），被動與 burst 平均分給未拆完的子包；
  // 指向的子包拆完後溢出再平均分給其餘；三個都拆完才算完成一包，溢出進下一組。
  function advanceTriple(pack, power, sceneId, target) {
    let p = { ...newPackage(sceneId, pack.index), ...pack, sub:(pack.sub || emptySub()).map(x => ({ progress:x.progress })) }, completed = 0;
    for (;;) {
      const need = requirement(p.index, sceneId) / 3, eps = need * 1e-12;
      const open = [0,1,2].filter(i => p.sub[i].progress < need - eps);
      if (!open.length) { completed++; p = newPackage(sceneId, p.index + 1); continue; }
      if (power <= eps) break;
      const pick = Number.isInteger(target) && open.includes(target) ? [target] : open, share = power / pick.length;
      for (const i of pick) { const used = Math.min(need - p.sub[i].progress, share); p.sub[i].progress += used; power -= used; if (need - p.sub[i].progress <= eps) p.sub[i].progress = need; }
      target = undefined;
    }
    p.progress = p.sub.reduce((a, x) => a + x.progress, 0);
    return { package:p, completed, shellHit:false, shellBroken:false, released:0 };
  }
  const subNeed = (index, sceneId) => requirement(index, sceneId) / 3;
  function shellPower(pack, power, need, source) {
    const p = { ...pack, shells:[...(pack.shells || [])], blocked:pack.blocked || 0, shellHp:pack.shellHp ?? 3 };
    let shellHit = false, shellBroken = false, released = 0;
    const line = () => p.shells.length ? need * (1-p.shells[0]) : Infinity;
    if (source === 'click' && p.progress >= line() - need*1e-12) {
      shellHit = true; p.shellHp--;
      if (p.shellHp > 0) return { package:p, shellHit, shellBroken, released, remaining:0 };
      p.shells.shift(); p.shellHp=3; shellBroken=true; released=p.blocked; p.blocked=0;
      if(released) return {package:p,shellHit,shellBroken,released,remaining:power};
    }
    const used = Math.min(power, Math.max(0,Math.min(need,line())-p.progress));
    p.progress += used;
    let remaining = power-used;
    if (p.shells.length && p.progress >= line()-need*1e-12) {
      p.blocked += remaining; remaining=0;
      if (source === 'offline') p.blocked=Math.min(p.blocked,need*3);
    }
    return { package:p, shellHit, shellBroken, released, remaining };
  }
  function advancePackage(pack, power, sceneId, source = 'passive', target) {
    if (tripleFor(sceneId)) return advanceTriple(pack, power, sceneId, target);
    if ((pack.shells || shellsFor(sceneId)).length || shellsFor(sceneId).length) {
      let p = {...newPackage(sceneId,pack.index),...pack}, completed=0, shellHit=false, shellBroken=false, released=0;
      do {
        const r=shellPower(p,power,requirement(p.index,sceneId),source);
        p=r.package; shellHit ||= r.shellHit; shellBroken ||= r.shellBroken; released+=r.released; power=r.remaining;
        // Stored power already earned its coins; release bypasses rings, including across packages.
        if (r.released) {
          const fast=advancePlain(p,r.released,sceneId); completed+=fast.completed;
          p={...p,...fast.package,shells:fast.completed?shellsFor(sceneId):p.shells};
          p.shells=p.shells.filter(v=>p.progress < requirement(p.index,sceneId)*(1-v));
        }
        if (p.progress >= requirement(p.index,sceneId)-requirement(p.index,sceneId)*1e-12) { completed++; p=newPackage(sceneId,p.index+1); }
        source=source==='click'?'passive':source;
      } while (power>0);
      return {package:p,completed,shellHit,shellBroken,released};
    }
    return advancePlain(pack,power,sceneId);
  }
  function advancePlain(pack, power, sceneId) {
    const total = pack.progress + power;
    let low = 0, high = 1;
    const fits = (n) => packageSum(pack.index, n, sceneId) <= total;
    while (fits(high)) high *= 2;
    while (low + 1 < high) { const mid = Math.floor((low + high) / 2); if (fits(mid)) low = mid; else high = mid; }
    let progress = Math.max(0, total - packageSum(pack.index, low, sceneId));
    // 累積等比浮點誤差不留下一包幾乎 100% 的幽靈進度。
    if (requirement(pack.index + low, sceneId) - progress <= requirement(pack.index + low, sceneId) * 1e-12) { low++; progress = 0; }
    // 沒拆完的包保留輸送帶時限；拆完的新包由 stampDeadline 重新蓋章
    return { package: { ...newPackage(sceneId,pack.index+low), progress, ...(low === 0 && pack.deadline !== undefined ? { deadline: pack.deadline } : {}) }, completed: low };
  }
  function grant(s, amount, source = 'passive', event = {}, target) {
    s.coins += amount; s.lifetimeCoins += amount;
    if (event.coinsOnly) return 0;   // 離線超過輸送帶時限的部分只進錢包，不推進包裝
    if (s.boss) {
      const r=shellPower({...s.boss,progress:s.boss.dealt},amount,s.boss.need,source);
      let p=r.package;
      if(r.released) {
        p.progress=Math.min(s.boss.need,p.progress+r.released);
        p.shells=p.shells.filter(v=>p.progress<s.boss.need*(1-v));
        p=shellPower(p,r.remaining,s.boss.need,'passive').package;
      }
      Object.assign(s.boss,{dealt:p.progress,shells:p.shells,shellHp:p.shellHp,blocked:p.blocked});
      Object.assign(event,{shellHit:r.shellHit,shellBroken:r.shellBroken,released:r.released});
      if (s.boss.dealt >= s.boss.need) finishBoss(s,true,s.settledAt);
      return 0;
    }
    if (s.package.gate) return 0;   // v3 §二：小王擋路時拆包力只進錢包，不推包
    const from = s.package.index;
    const result = advancePackage(s.package, amount, s.settings.scene, source, target); s.package = result.package;
    Object.assign(event,{shellHit:result.shellHit,shellBroken:result.shellBroken,released:result.released});
    if (result.completed) {
      s.runPacks = (s.runPacks || 0) + result.completed;
      // v3 §八 寶箱包：拆完額外 requirement×8 幣（離線不出）；用存檔種子決定，重開不會變
      if (source !== 'offline') for (let i = from; i < from + result.completed; i++) if (isChest(s, i)) { const bonus = requirement(i, s.settings.scene) * B.V3.CHEST_MUL; s.coins += bonus; s.lifetimeCoins += bonus; event.chest = (event.chest || 0) + bonus; }
      // v3 §二 小王：每 10 包擋一次（門檻包之後交給大王）；一口氣拆過好幾包時停在第一個路障
      const threshold = bossPackagesFor(s, s.settings.scene);
      for (let i = from; i < from + result.completed; i++) if (i % B.V3.GATE_EVERY === 0 && (threshold == null || i < threshold)) {
        const need = gateNeed(s, i);
        if (source !== 'offline' && capacity30(s) >= need * B.V3.GATE_SKIP) { const bonus = requirement(i, s.settings.scene) * B.V3.GATE_REWARD; s.coins += bonus; s.lifetimeCoins += bonus; s.runGates = (s.runGates || 0) + 1; event.gateSkipped = (event.gateSkipped || 0) + bonus; continue; }   // 壓倒性火力：小王讓路
        s.package = { ...newPackage(s.settings.scene, i + 1), gate: { index: i, cooldownUntil: 0 } }; break;
      }
    }
    stampDeadline(s, s.settledAt, result.completed > 0);
    return result.completed;
  }
  // 寶箱判定：(種子, 場景, 包號) 的雜湊；隊伍裡 Lv≥150 的夥伴每人 +1%
  function chestRate(s) { return B.V3.CHEST_RATE + .01 * art(s, 'chest') + .01 * rosterOf(s).filter(id => (s.partnerLevels?.[id] || 0) >= B.V3.CHEST_MILESTONE).length; }
  function isChest(s, index) {
    let h = ((s.chestSeed || 0) ^ 0x9e3779b9) >>> 0; for (const ch of `${s.settings.scene}#${index}`) { h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; }
    return (h % 10000) / 10000 < chestRate(s);
  }
  // v3 §二 小王：借用王包的整套結算（分段、硬殼、計時），差別只有 gate 旗標與結束處理
  const gateNeed = (s, index) => B.V3.GATE_MUL * requirement(index, s.settings.scene) * (index % (B.V3.GATE_EVERY * 5) === 0 ? B.V3.AREA_MUL : 1);
  const canGate = (s, now) => !s.boss && !s.pending && !!s.package.gate && now >= (s.package.gate.cooldownUntil || 0);
  // 自動挑戰只在第一次遇到小王時開打；輸過一次就等玩家自己點「挑戰」（使用者 2026-09-12）
  const autoGate = (s, now) => s.settings?.autoChallenge !== false && !s.package.gate?.lost && canGate(s, now);
  function startGateInPlace(s, now) {
    const g = s.package.gate;
    s.boss = { scene: s.settings.scene, gate: g.index, need: gateNeed(s, g.index), dealt: 0, startedAt: now, endsAt: now + (B.V3.GATE_SECONDS + (s.markShop?.bossTime ? 10 : 0)) * 1000, crack: 0, shells: [], shellHp: 3, blocked: 0 };
    if (s.gift) endGift(s, now, false);
    delete s.thief; s.bossResult = null; return s;
  }
  // UI 用：現在面前是哪一隻王（路障小王或站尾大王）、血量多少、玩家「30 秒火力」大約幾成（DESIGN-balance-v3 §14.2）
  // 火力＝被動 30 秒＋連點 6 下/秒（模擬器同一個假設），不含技能——玩家可以賭技能，所以低於 100% 也能按
  function capacity30(s) { const r = rates(s); return (r.P + r.D * 6) * 30; }
  function bossPreview(s, now) {
    if (s.boss) return null;
    if (s.package.gate) { const need = gateNeed(s, s.package.gate.index); return { kind: 'gate', index: s.package.gate.index, need, ratio: capacity30(s) / need, ready: canGate(s, now), lost: !!s.package.gate.lost, cooldownUntil: s.package.gate.cooldownUntil || 0 }; }
    const scene = s.settings.scene, cfg = Scenes(scene).boss;
    if (!cfg || bossPackages(scene) == null) return null;
    const need = (B.V3.BOSS_K[scene] ?? B.V3.BOSS_MUL) * requirement(bossPackages(scene) + 1, scene) * cfg.mul;
    return { kind: 'boss', need, ratio: capacity30(s) / need, ready: canBoss(s, now), cooldownUntil: s.bossCooldownUntil || 0 };
  }
  function startGate(state, now) {
    const s = settle(state, now).state;
    if (!canGate(s, now)) throw new Error('沒有待打的小王');
    return startGateInPlace(s, now);
  }
  // 輸送帶：每包進場時 deadline = 進場時刻 + timer 秒；王包期間不計時，結束後重新給一段完整時限
  function stampDeadline(s, at, fresh = false) {
    const timer = timerFor(s.settings.scene);
    if (!timer || s.boss) return;
    if (fresh || s.package.deadline == null) s.package.deadline = at + timer * 1000;
  }
  function missPackage(s, at) {
    const timer = timerFor(s.settings.scene);
    s.missed = (s.missed || 0) + 1;
    s.package = { ...newPackage(s.settings.scene, s.package.index), deadline: at + timer * 1000 };
  }
  // 夜市限時大禮包：需求 4×H(k)、限時 seconds 秒；只吃點擊，拆完一次性加 H_gift×(mul−1) 幣（不進拆包進度）
  function spawnGift(s, now) {
    const cfg = giftFor(s.settings.scene);
    s.gift = { need: 4 * requirement(s.package.index, s.settings.scene), dealt: 0, endsAt: now + cfg.seconds * 1000 };
  }
  function endGift(s, at, won, rng) {
    const cfg = giftFor(s.settings.scene), g = s.gift;
    const bonus = won ? g.need * (cfg.mul - 1) : 0;
    if (won) { s.coins += bonus; s.lifetimeCoins += bonus; }
    s.gift = null; s.giftResult = { won, at, bonus, need: g.need };
    s.nextGiftAt = at + rand(cfg.everyMs, rng);
  }
  function tickGift(s, now, options) {
    const cfg = giftFor(s.settings.scene);
    if (options.offline || !cfg) { if (s.gift) endGift(s, now, false, options.rng); if (cfg && s.nextGiftAt < now) s.nextGiftAt = now + rand(cfg.everyMs, options.rng); return; }
    if (s.gift && now >= s.gift.endsAt) endGift(s, s.gift.endsAt, false, options.rng);
    if (s.boss || s.gift) return;
    if (!s.nextGiftAt) s.nextGiftAt = now + rand(cfg.everyMs, options.rng);
    else if (now >= s.nextGiftAt) spawnGift(s, now);
  }
  // 暫態小偷：只扣可見時間，重開不保留事件。
  function tickThief(s, elapsed, options) {
    const cfg = Scenes(s.settings.scene).thief;
    if (!cfg) { delete s.thief; return; }
    if (options.offline || options.visible === false || s.boss) { delete s.thief; return; }
    if (!s.thief) s.thief = { active:false, remainingMs:rand(cfg.everyMs, options.rng), hits:0 };
    s.thief.remainingMs -= elapsed;
    if (s.thief.remainingMs > 0) return;
    s.thief = s.thief.active
      ? { active:false, remainingMs:rand(cfg.everyMs, options.rng), hits:0 }
      : { active:true, remainingMs:12600, hits:0 };
  }
  function thiefHit(state, now) {
    const result = settle(state, now), s = result.state, cfg = Scenes(s.settings.scene).thief;
    let reward = 0, won = false;
    if (cfg && !s.boss && s.thief?.active && s.thief.remainingMs <= 12000 && ++s.thief.hits >= cfg.hits) {
      won = true; reward = rates(s).P * cfg.reward;
      grant(s, reward, 'passive', {coinsOnly:true});
      s.thief = { active:false, remainingMs:rand(cfg.everyMs), hits:0, won:true };
    }
    return { ...result, reward, won };
  }
  // 第十二輪 regen（冰箱）：每秒 progress -= need × regen，不低於 0。可見時直接吃進度；離線時回傳要從被動裡先扣掉的量
  // （P < need×regen 時離線進度停在原地、幣照給）。王包照吃，但不低於裂痕起點。
  function regen(s, duration, offline) {
    const rate = Scenes(s.settings?.scene).enemy?.regen;
    if (!rate || !duration) return 0;
    if (s.boss) { s.boss.dealt = Math.max(s.boss.crack * s.boss.need, s.boss.dealt - s.boss.need * rate * duration / 1000); return 0; }
    const amount = requirement(s.package.index, s.settings.scene) * rate * duration / 1000;
    if (offline) return amount;
    s.package.progress = Math.max(0, s.package.progress - amount); return 0;
  }
  function settle(state, now, options = {}) {
    const s = clone(state), elapsed = Math.max(0, now - s.settledAt), duration = Math.min(elapsed, s.markShop?.offline12 ? 12 * 3600000 : B.offlineMs);
    if (options.offline && s.boss) finishBoss(s,false,s.settledAt);
    if (!options.offline && autoGate(s, s.settledAt)) startGateInPlace(s, s.settledAt);   // v3：自動挑戰小王（只有第一次）
    // Split at the deadline, so no damage after the 30-second boundary can win.
    if (s.boss && now > s.boss.endsAt) {
      const first=settle(s,s.boss.endsAt), rest=settle(first.state,now,options);
      return {...rest,earned:first.earned+rest.earned,completed:first.completed+rest.completed,elapsed,duration};
    }
    // 輸送帶到期：切在 deadline；線上算漏（進度歸零、不給幣、不扣東西，下一包立刻進場），
    // 離線不算漏：包裝停在到期前的進度、剩下的時間只進錢包，回來後重新給一段完整時限。
    const timer = timerFor(s.settings.scene);
    if (timer && !s.boss && !options.coinsOnly && s.package.deadline != null && now > s.package.deadline) {
      let cur = s, earned = 0, completed = 0;
      while (!cur.boss && cur.package.deadline != null && now > cur.package.deadline) {
        const first = settle(cur, cur.package.deadline, options); earned += first.earned; completed += first.completed; cur = first.state;
        if (options.offline) {
          const rest = settle(cur, now, { ...options, coinsOnly:true });
          rest.state.package.deadline = now + timer * 1000;
          return { ...rest, earned:earned + rest.earned, completed, elapsed, duration };
        }
        missPackage(cur, cur.package.deadline);
      }
      const rest = settle(cur, now, options);
      return { ...rest, earned:earned + rest.earned, completed:completed + rest.completed, elapsed, duration };
    }
    const start = s.settledAt, end = start + duration;
    let earned = rates(s).P * duration / 1000;
    for (const effect of s.effects) if (['passive', 'self', 'team'].includes(effect.kind)) {
      earned += effect.value * Math.max(0, Math.min(end, effect.expiresAt) - Math.max(start, effect.startedAt)) / 1000;
    }
    s.settledAt = Math.max(s.settledAt, now);
    const kept = Math.min(earned, regen(s, duration, options.offline)); s.coins += kept; s.lifetimeCoins += kept;
    const ev = { coinsOnly:!!options.coinsOnly };
    const completed = grant(s, earned - kept, options.offline ? 'offline' : 'passive', ev);
    if (s.boss && now >= s.boss.endsAt) finishBoss(s,false,now);
    s.settledAt = Math.max(s.settledAt, now);
    if (options.offline && s.markShop?.offline15) { grant(s, earned * .5, 'offline', {coinsOnly:true}); earned *= 1.5; }
    if (options.offline && art(s, 'offline')) { const extra = earned * .1 * art(s, 'offline'); grant(s, extra, 'offline', {coinsOnly:true}); earned += extra; }   // D 路離線祝福
    stampDeadline(s, now);
    tickGift(s, now, options);
    tickThief(s, state.boss ? 0 : elapsed, options);
    s.effects = s.effects.filter((e) => e.expiresAt > s.settledAt && (e.remaining === undefined || e.remaining > 0));
    if (!options.offline && autoGate(s, s.settledAt)) startGateInPlace(s, s.settledAt);   // v3：這一段結算裡拆到路障就立刻開打
    return { state: s, earned, completed, elapsed, duration, chest: ev.chest || 0 };
  }
  // target：三連包的子包 0..2、'gift' 打禮包；undefined = 點珍母（三連包平均分配、禮包不受影響）
  function click(state, now, target, options = {}) {
    const result = settle(state, now), s = result.state;
    const multiplier = Math.max(1, ...s.effects.filter((e) => ['click', 'clickTime'].includes(e.kind)).map((e) => e.multiplier));
    let amount = (rates(s).D + s.effects.filter(e => e.kind === 'clickAdd').reduce((sum, e) => sum + e.value, 0)) * multiplier;
    // 掃過去：連續點中不同子包，第三下起每下 +15% 拆包力；同一子包連點、點珍母或隔太久都重算
    let sweep = false;
    if (tripleFor(s.settings.scene) && !s.boss) {
      const prev = s.sweep || { last:null, count:0, at:0 };
      if (Number.isInteger(target)) {
        const count = prev.last !== null && prev.last !== target && now - prev.at <= SWEEP_WINDOW_MS ? prev.count + 1 : 1;
        s.sweep = { last:target, count, at:now }; sweep = count >= 3;
      } else s.sweep = { last:null, count:0, at:now };
      if (sweep) amount *= 1 + SWEEP_BONUS;
    }
    let giftHit = false;
    // sink：第十二輪的今日限定包等「額外目標」拿走拆包力（幣照給、一般包不動）
    if (options.sink) { s.coins += amount; s.lifetimeCoins += amount; options.sink(s, amount); }
    else if (target === 'gift' && s.gift && !s.boss) {
      giftHit = true; s.coins += amount; s.lifetimeCoins += amount; s.gift.dealt += amount;
      if (s.gift.dealt >= s.gift.need) endGift(s, now, true);
    } else result.completed += grant(s, amount, 'click', result, target);
    if (!options.auto) s.manualClicks++; else s.autoClicks = (s.autoClicks || 0) + 1;
    for (const effect of s.effects) if (effect.remaining !== undefined) effect.remaining--;
    s.effects = s.effects.filter((e) => e.remaining === undefined || e.remaining > 0);
    const tutorial = s.manualClicks >= 50 && !s.claimedMilestones.includes('tutorial50');
    if (tutorial) {
      receive(s,'yueyue2');
      s.claimedMilestones.push('tutorial50');
      if (!s.skillSlots[0]) s.skillSlots[0] = 'yueyue2';
    }
    if (!options.offline && autoGate(s, now)) startGateInPlace(s, now);
    return { ...result, amount, multiplier, tutorial, sweep, giftHit, target };
  }
  function upgrade(state, type, max, now) {
    const s = settle(state, now).state, field = type === 'click' ? 'clickLevel' : 'trainingLevel';
    if (!['click', 'training'].includes(type)) throw new Error('未知升級');
    const cost = type === 'click' ? clickCost : trainingCost;
    let levels = 0;
    do { const price = cost(s[field]); if (price > s.coins || !Number.isFinite(price)) break;
      s.coins -= price; s[field]++; levels++;
    } while (max);
    if (!levels) throw new Error('餘額不足');
    return { state: s, levels };
  }
  const slotCount = (s) => B.slotThresholds.filter((v) => s.lifetimeCoins >= v).length + (s.markShop?.slot4 ? 1 : 0);
  function equip(state, slot, id, now) {
    const s = settle(state, now).state;
    if (!Number.isInteger(slot) || slot < 0 || slot >= slotCount(s) || (id !== null && !s.collection[id])) throw new Error('無法裝備');
    if (s.pending) throw new Error('請先收下招募');
    if (s.skillSlots[slot] === id) return s;
    if (id && s.skillSlots.includes(id)) throw new Error('角色已在其他槽位');
    // v3：裝技能＝自動編入隊伍（有位子就進，撞前綴上限或滿 20 才擋）——玩家不用先去卡冊編隊
    if (id && !rosterOf(s).includes(id)) {
      const next = [...rosterOf(s), id];
      if (next.length > 20 || rosterViolations(next).length || dispatched(s, id)) throw new Error(dispatched(s, id) ? '派遣中，回來再裝' : '隊伍沒有位子，先移出一張');
      s.roster = next;
    }
    s.skillSlots[slot] = id; s.slotReadyAt[slot] = s.settledAt + 30000;
    return s;
  }
  function activate(state, slot, now) {
    const s = settle(state, now).state, id = s.skillSlots[slot], def = id && skillAt(s,id), t = s.settledAt;
    if (s.pending || slot >= slotCount(s) || !s.collection[id] || !def?.kind) throw new Error('技能尚未開放');
    if ((s.cooldownUntil[id] || 0) > t || s.slotReadyAt[slot] > t) throw new Error('技能冷卻中');
    const count = s.chain && t < s.chain.expiresAt && s.chain.count < 3 ? s.chain.count+1 : 1;
    const windowMs = Math.max(8000, ...activeBonds(s).map(b=>b.effect.chainWindowMs || 0)) + (s.markShop?.chain2 ? 2000 : 0);
    const chainMul = [1,1.3,1.6][count-1];
    s.chain = {count,expiresAt:t+windowMs};
    const effect = { chain:count, params:{...def,desc:undefined}, source: id, kind: def.kind, startedAt: t, expiresAt: t + (def.duration || 0) * 1000 };
    // v3 §七：重整／充能自己不打傷害，但算一次發動（連鎖窗照走）
    if (def.kind === 'reload') { for (let k = 0; k < s.skillSlots.length; k++) { const other = s.skillSlots[k]; if (other && other !== id) { s.cooldownUntil[other] = 0; s.slotReadyAt[k] = 0; } } s.cooldownUntil[id] = t + def.cd * 1000; return { state: s, effect, completed: 0 }; }
    if (def.kind === 'energize') { s.energized = true; s.cooldownUntil[id] = t + def.cd * 1000; return { state: s, effect, completed: 0 }; }
    const energized = s.energized ? 2 : 1; if (s.energized) { delete s.energized; effect.energized = 2; }
    if (art(s,'skill') || art(s,'cd')) effect.arts = { skill: art(s,'skill'), cd: art(s,'cd') };   // 神器快照（驗證用；params 仍是基礎值）
    if (def.kind === 'click') Object.assign(effect, { multiplier: def.multiplier, remaining: def.charges });
    else if (def.kind === 'clickTime') effect.multiplier = def.multiplier;
    else if (def.kind === 'self') effect.value = individual(s, id) * (def.multiplier - 1) * (Scenes(s.settings.scene).rewardMul || 1);
    else if (def.kind === 'team') effect.value = rates(s).P * def.ratio;
    else if (def.kind === 'clickAdd') Object.assign(effect, { value: rates(s).P * def.ratio, remaining: def.charges });
    // bossDamage：王關中直接砍血量的百分比（不吃 P／D，王越硬越值錢）；平常退化成含全隊加成的爆發。
    else if (def.kind === 'bossDamage') effect.value = s.boss
      ? s.boss.need * def.share
      : def.fallback * (rates(s).P + s.effects.filter(e=>e.kind==='team').reduce((sum,e)=>sum+e.value,0));
    else if (def.kind === 'burst') effect.value = def.factor * (def.basis === 'individual' ? individual(s, id) * (Scenes(s.settings.scene).rewardMul || 1) : rates(s).P + s.effects.filter(e=>e.kind==='team').reduce((sum,e)=>sum+e.value,0));
    else {
      const copied = target => individual(s,target)*(Scenes(s.settings.scene).rewardMul || 1) + s.effects.filter(e=>e.kind==='self' && e.source===target).reduce((sum,e)=>sum+e.value,0);
      const targets = Object.keys(s.collection).filter((key) => key !== id && s.collection[key] > 0).sort((a, b) => copied(b) - copied(a));
      if (!targets.length) throw new Error('需要另一位夥伴');
      effect.target = targets[0]; effect.value = copied(effect.target) * def.copy;
    }
    if (effect.multiplier !== undefined) effect.multiplier = 1+(effect.multiplier-1)*chainMul*energized*skillArt(s);
    if (effect.value !== undefined) effect.value *= chainMul*energized*skillArt(s);
    const instant = def.kind === 'burst' || def.kind === 'bossDamage';
    const completed = instant ? grant(s, effect.value, 'skill') : 0;
    // 重整之後同一張卡可能在舊效果還沒到期時再放：新效果取代舊的（存檔規則：一個來源一個效果、冷卻對得上 startedAt）
    if (!instant) { s.effects = s.effects.filter(e => e.source !== id); s.effects.push(effect); }
    s.cooldownUntil[id] = t + def.cd * 1000 * cdArt(s);
    return { state: s, effect, completed };
  }
  function purchaseDraw(state, count, now, pool, options = {}) {
    const s = settle(state, now).state;
    if ((state.boss && state.boss.gate === undefined) || s.pending || ![1, 5].includes(count)) throw new Error('王包中或尚有待收下結果或張數錯誤');   // v3：路障小王不鎖招募（計時照走）
    const free = Math.min(s.freeDraws || 0,count), paid=count-free;
    const price = drawCost(s, paid);
    if (!Number.isFinite(price) || s.coins < price) throw new Error('餘額不足');
    const result = pool.rollPack({ ...options, count, policy: pool.GAME_POLICY, pity: s.pity.sinceLegendary, collection: s.collection });
    s.coins -= price; s.paidDraws += paid; s.freeDraws=(s.freeDraws || 0)-free; s.usedFreeDraws=(s.usedFreeDraws || 0)+free; s.pity.sinceLegendary = result.nextPity;
    s.pending = { draw: result.draw };
    return s;
  }
  function collect(state, drawId, now) {
    // 同一 id 第二次收下直接拒絕；不結算、不寫入、不播入隊。
    if (!state.pending || state.pending.draw.id !== drawId) return { state, accepted: false };
    const s = settle(state, now).state, entries = s.pending.draw.entries;
    const newIds = [...new Set(entries.filter((e) => !s.collection[e.entry.id]).map((e) => e.entry.id))];
    const starUps=entries.map(item=>receive(s,item.entry.id)).filter(up=>up.to>up.from);
    s.pending = null;
    return { state: s, accepted: true, newIds, starUps };
  }
  const sceneMap = () => typeof module !== 'undefined' && module.exports ? require('./clicker-scene.js').scenes : root.ClickerScenes;
  const nextScene = id => Object.keys(sceneMap()).find(key=>sceneMap()[key].unlock?.boss===id);
  const unlocked = (s,id) => Object.hasOwn(sceneMap(),id) && sceneMap()[id].available!==false && (!sceneMap()[id].requiresMark || !!s.markShop?.[sceneMap()[id].requiresMark]) && (!sceneMap()[id].unlock || (s.bossWins || []).includes(sceneMap()[id].unlock.boss));
  const bossPackages = id => Scenes(id).bossPackages ?? sceneMap()[nextScene(id)]?.unlock?.packages;
  // v3 §四：大王每輪可重打（runWins 本輪、bossWins 永久解鎖）；通關章＝以前贏過的站門檻減半
  const runWon = (s,id) => (s.runWins || []).includes(id);
  const bossPackagesFor = (s,id) => { const n = bossPackages(id); return n == null ? null : (s.bossWins || []).includes(id) && !runWon(s,id) ? Math.ceil(n / 2) : n; };
  const canBoss = (s,now) => !s.boss && !s.pending && !s.package.gate && bossPackages(s.settings.scene) != null && (s.settings.scene === 'city' || !runWon(s,s.settings.scene)) && s.package.index-1 >= bossPackagesFor(s,s.settings.scene) && now >= (s.bossCooldownUntil || 0);
  function switchScene(state,id,now) {
    if (state.boss || !unlocked(state,id)) throw new Error('王包中或場景尚未解鎖');
    const s=settle(state,now).state; changeScene(s,id); return s;
  }
  function changeScene(s,id) {
    if (s.settings.scene===id) return;
    s.scenePackages ||= {}; s.scenePackages[s.settings.scene]=clone(s.package);
    const oldMul=Scenes(s.settings.scene).rewardMul || 1, newMul=Scenes(id).rewardMul || 1;
    s.effects.forEach(e=>{if (e.value !== undefined) e.value*=newMul/oldMul;});
    if (s.gift) endGift(s, s.settledAt, false);
    delete s.thief;
    s.settings.scene=id; s.package=clone(s.scenePackages[id] || newPackage(id));
    if (giftFor(id)) s.nextGiftAt = s.settledAt + rand(giftFor(id).everyMs);
    if (timerFor(id)) s.package.deadline = s.settledAt + timerFor(id) * 1000; else delete s.package.deadline;
    if (tripleFor(id) && !s.package.sub) s.package.sub = emptySub();
    s.sweep = { last:null, count:0, at:0 };
  }
  function startBoss(state,now) {
    const s=settle(state,now).state;
    if (!canBoss(s,now)) throw new Error('王包尚未就緒');
    const scene=s.settings.scene, cfg=Scenes(scene).boss, r=rates(s), crack=s.bossCracks?.[scene] || 0;
    // 王包血量＝玩家「現在的 30 秒容量」（被動 30 秒＋每秒 6 下點擊）× mul，下限門檻包需求：
    // 純放置約 60%、連點不用技約 80%、連點＋技能 110%↑；離線衝過門檻不會讓王變得打不動
    // 下限用「門檻那一包」而不是現在這一包：離線衝過門檻幾十包，王不能跟著變成不可能
    // v3 §二：血量改成關卡函數（門檻包需求 × K × 站係數），不再讀 P／D——這才是牆
    const need=(B.V3.BOSS_K[scene] ?? B.V3.BOSS_MUL)*requirement(bossPackages(scene)+1,scene)*cfg.mul;
    s.boss={scene,need,dealt:crack*need,startedAt:now,endsAt:now+(cfg.seconds+(s.markShop?.bossTime ? 10 : 0))*1000,crack,shells:shellsFor(scene).filter(v=>1-v>crack),shellHp:3,blocked:0};
    if (s.gift) endGift(s, now, false);
    delete s.thief;
    s.bossResult=null; return s;
  }
  function finishBoss(s,won,now) {
    const b=s.boss;
    if (b.gate !== undefined) {   // 小王：贏了拆掉路障，輸了 30 秒冷卻，沒有裂痕
      s.boss=null; s.bossResult={scene:b.scene,gate:b.gate,won,crack:0,at:now,next:undefined};
      if (won) { delete s.package.gate; s.runGates=(s.runGates || 0)+1; const bonus=requirement(b.gate,b.scene)*B.V3.GATE_REWARD; s.coins+=bonus; s.lifetimeCoins+=bonus; s.bossResult.bonus=bonus; }
      else { s.package.gate.cooldownUntil=now+B.V3.GATE_COOLDOWN*1000; s.package.gate.lost=true; }
      stampDeadline(s, now, true); return;
    }
    const cfg=Scenes(b.scene).boss;
    const crack=won?0:Math.min(cfg.crackMax,b.dealt/b.need*(s.markShop?.crack75 ? .75 : cfg.crackKeep));
    s.bossCracks ||= {}; s.bossCracks[b.scene]=crack; s.boss=null;
    s.bossResult={scene:b.scene,won,crack,at:now,next:nextScene(b.scene)};
    if (won) {
      const bonus=requirement(bossPackages(b.scene)+1,b.scene)*cfg.mul*B.V3.BOSS_REWARD; s.coins+=bonus; s.lifetimeCoins+=bonus; s.bossResult.bonus=bonus;   // C 路：大王＝賺大錢的時刻；獎金不吃 K，K 只決定牆多厚
      s.runWins ||= []; if (!s.runWins.includes(b.scene)) s.runWins.push(b.scene);
      s.bossWins ||= []; if (!s.bossWins.includes(b.scene)) { s.bossWins.push(b.scene); s.universalDust=(s.universalDust || 0)+3; s.freeDraws=(s.freeDraws || 0)+cfg.reward.freeDraws; }
      if (b.scene === 'city') { s.apoc ||= { unlocked: false, tutorial: 0 }; if (!s.apoc.unlocked) { s.apoc.unlocked = true; s.bossResult.apocUnlocked = true; } }   // v3：打完滅世珍獸開末世
      s.bossCooldownUntil=b.scene === 'city' ? now+cfg.cooldown*1000 : 0;   // 終點站可重複挑戰，要有冷卻
      if (unlocked(s,s.bossResult.next)) changeScene(s,s.bossResult.next);
    } else s.bossCooldownUntil=now+cfg.cooldown*1000;
    stampDeadline(s, now, true);
  }
  function abandonBoss(state,now) {
    const s=clone(state); if (s.boss) finishBoss(s,false,now); return s;
  }
  const api = { medianPartnerLevel, exchangeRate, PARTNER_MILESTONES, partnerMul, DRAW_SECONDS, tripleFor, timerFor, giftFor, subNeed, SWEEP_WINDOW_MS, SWEEP_BONUS, origin, tier, rarity, dust, availableDust, spentDust, promotionCost, transcendCost, promote, transcend, exchange, wardrobe, wardrobePrice, affinity, activeBonds, skillAt, recommend, clone, clickCost, trainingCost, drawCost, stars, starMultiplier, individual, rates, tagFor, markMul, blessMul, decoMul,
    thiefHit, newPackage, unlocked, nextScene, canBoss, startBoss, abandonBoss, switchScene, autoGate, bossPreview, capacity30,
    art, skillArt, cdArt, rosterOf, rosterCounts, rosterViolations, setRoster, autoRoster, dispatched, dispatch, recall, champion, bossPackagesFor, runWon, canGate, startGate, gateNeed, isChest, chestRate,
    requirement, packageSum, advancePackage, settle, click, upgrade, slotCount, equip, activate, purchaseDraw, collect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
