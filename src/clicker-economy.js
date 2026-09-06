(function (root) {
  const B = typeof module !== 'undefined' && module.exports ? require('./clicker-balance.js') : root.ClickerBalance;
  const Scenes = typeof module !== 'undefined' && module.exports ? require('./clicker-scene.js').resolve : root.ClickerScene.resolve;
  const clone = (s) => JSON.parse(JSON.stringify(s));
  const clickCost = (l) => Math.ceil(10 * 1.30 ** l);
  const trainingCost = (t) => Math.ceil(1000 * 1.60 ** t);
  const drawCost = (n, count = 1) => Array.from({ length: count }, (_, i) => Math.ceil(150 * 1.30 ** Math.floor((n + i) / 5))).reduce((a, b) => a + b, 0);
  const stars = (n) => n < 1 ? 0 : B.stars.filter((threshold) => n >= threshold).length;
  const starMultiplier = (n) => n < 1 ? 0 : 1 + .25 * (stars(n) - 1);
  const origin = id => Object.keys(B.characters).indexOf(id) >> 2;
  const tier = (s,id) => origin(id) + (s.promotions?.[id] || 0);
  const dust = (s,id) => s.dust?.[id] ?? s.collection[id] ?? 0;
  const transcendCosts = [[6,8,10,12,14],[6,7,8,9,10],[4,5,6,7,10]];
  const promotionCost = (s,id) => tier(s,id) >= 2 ? 0 : origin(id) === 0 && s.promotions?.[id] === 1 ? 16 : 12;
  const transcendCost = (s,id) => transcendCosts[origin(id)][s.transcend?.[id] || 0] || 0;
  // Dust is cumulative. Paid progression records account for spending; the first 16 retain five stars.
  const spentDust = (s,id) => ((s.promotions?.[id] || 0) ? 12 + (s.promotions[id] === 2 ? 16 : 0) : 0) + transcendCosts[origin(id)].slice(0,s.transcend?.[id] || 0).reduce((a,b)=>a+b,0);
  const availableDust = (s,id) => Math.max(0,dust(s,id)-16-spentDust(s,id));
  const rarity = (s,id) => ['rare','epic','legendary'][tier(s,id)];
  function grow(state,id,now,trans) {
    const s=settle(state,now).state;
    if (!Object.hasOwn(B.characters,id) || s.pending || stars(dust(s,id))<5) throw new Error('要 5★ 才能升階或超越');
    const cost=trans ? transcendCost(s,id) : promotionCost(s,id);
    if (!cost || (trans && tier(s,id)!==2)) throw new Error('已是最高階，或還沒升到傳說階')
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
    s.collection[id]=(s.collection[id] || 0)+1;
    if (s.transcend?.[id]===5) {
      const rate=[4,2,1][origin(id)], count=(s.overflow[id] || 0)+1;
      s.universalDust+=Math.floor(count/rate); s.overflow[id]=count%rate;
    } else s.dust[id]++;
    return {id,from:before,to:stars(s.dust[id])};
  }
  function exchange(state,id,amount,now=state.settledAt) {
    const s=settle(state,now).state;
    if (!Object.hasOwn(B.characters,id) || !Number.isSafeInteger(amount) || amount<1 || s.pending || s.transcend?.[id]===5) throw new Error('無法兌換');
    // amount is the universal-dust budget; unconvertible remainder stays in the jar.
    const rate=origin(id)+1, count=Math.floor(amount/rate);
    if (!count || amount>s.universalDust) throw new Error('萬用粉塵不足');
    s.universalDust-=count*rate; s.dust[id]=dust(s,id)+count;
    return s;
  }
  const wardrobePrice = s => Math.max(5000,Math.round(rates(s).P*1200));
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
  const individual = (s, id) => B.characters[id].base * starMultiplier(dust(s,id)) * ([1,1.8,3.2][tier(s,id)]/[1,1.8,3.2][origin(id)]) * (1+[.06,.09,.14][origin(id)]*(s.transcend?.[id] || 0)) * 1.15 ** s.trainingLevel * (affinity(s,id) ? 1.5 : 1) * (1 + .05 * (s.partnerLevels?.[id] || 0));
  // 第十三輪：印記永久倍率、桌面裝飾
  const markMul = (s) => 1 + .05 * (s.marksClaimed || 0);
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
  function rates(s) {
    const P = Object.keys(B.characters).reduce((sum, id) => sum + individual(s, id), 0);
    const mul = (Scenes(s.settings?.scene).rewardMul || 1) * decoMul(s), M = markMul(s);
    return { P: M * P * mul, D: (M * 1.18 ** s.clickLevel + .05 * M * P) * mul };
  }
  function tagFor(entry, dup, owned, state) {
    if (state?.transcend?.[entry.id]===5) return {text:`萬用 +${['¼','½','1'][origin(entry.id)]}`,cls:'mastery'};
    if (!owned) return { text: 'NEW', cls: 'new' };
    if (owned >= 16) return { text: `熟練 +${owned + 1 - 16}%`, cls: 'mastery' };
    if (stars(owned + 1) > stars(owned)) return { text: `${stars(owned)}★ → ${stars(owned + 1)}★`, cls: 'star-up' };
    return { text: `升星進度 ${owned + 1}/${B.stars[stars(owned)]}`, cls: 'dup' };
  }
  const requirement = (k, sceneId = 'backyard') => 100 * 1.12 ** (k - 1) * Scenes(sceneId).requirementMul;
  // expm1 保留小區間精度；二分搜尋只依包數的對數次數運算。
  const packageSum = (index, count, sceneId) => count === 0 ? 0 : requirement(index, sceneId) * Math.expm1(count * Math.log(1.12)) / .12;
  const shellsFor = id => [...(Scenes(id).enemy?.shell || [])];
  const newPackage = (id, index = 1) => ({ index, progress:0, shells:shellsFor(id), shellHp:3, blocked:0 });
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
  function advancePackage(pack, power, sceneId, source = 'passive') {
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
    return { package: { ...newPackage(sceneId,pack.index+low), progress }, completed: low };
  }
  function grant(s, amount, source = 'passive', event = {}) {
    s.coins += amount; s.lifetimeCoins += amount;
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
    const result = advancePackage(s.package, amount, s.settings.scene, source); s.package = result.package;
    Object.assign(event,{shellHit:result.shellHit,shellBroken:result.shellBroken,released:result.released});
    return result.completed;
  }
  function settle(state, now, options = {}) {
    const s = clone(state), elapsed = Math.max(0, now - s.settledAt), duration = Math.min(elapsed, s.markShop?.offline12 ? 12 * 3600000 : B.offlineMs);
    if (options.offline && s.boss) finishBoss(s,false,s.settledAt);
    // Split at the deadline, so no damage after the 30-second boundary can win.
    if (s.boss && now > s.boss.endsAt) {
      const first=settle(s,s.boss.endsAt), rest=settle(first.state,now,options);
      return {...rest,earned:first.earned+rest.earned,completed:first.completed+rest.completed,elapsed,duration};
    }
    const start = s.settledAt, end = start + duration;
    let earned = rates(s).P * duration / 1000;
    for (const effect of s.effects) if (['passive', 'self', 'team'].includes(effect.kind)) {
      earned += effect.value * Math.max(0, Math.min(end, effect.expiresAt) - Math.max(start, effect.startedAt)) / 1000;
    }
    s.settledAt = Math.max(s.settledAt, now);
    const completed = grant(s, earned, options.offline ? 'offline' : 'passive');
    if (s.boss && now >= s.boss.endsAt) finishBoss(s,false,now);
    s.settledAt = Math.max(s.settledAt, now);
    s.effects = s.effects.filter((e) => e.expiresAt > s.settledAt && (e.remaining === undefined || e.remaining > 0));
    return { state: s, earned, completed, elapsed, duration };
  }
  function click(state, now, options = {}) {
    const result = settle(state, now), s = result.state;
    const multiplier = Math.max(1, ...s.effects.filter((e) => ['click', 'clickTime'].includes(e.kind)).map((e) => e.multiplier));
    const amount = (rates(s).D + s.effects.filter(e => e.kind === 'clickAdd').reduce((sum, e) => sum + e.value, 0)) * multiplier;
    result.completed += grant(s, amount, 'click', result); if (!options.auto) s.manualClicks++; else s.autoClicks = (s.autoClicks || 0) + 1;
    for (const effect of s.effects) if (effect.remaining !== undefined) effect.remaining--;
    s.effects = s.effects.filter((e) => e.remaining === undefined || e.remaining > 0);
    const tutorial = s.manualClicks >= 50 && !s.claimedMilestones.includes('tutorial50');
    if (tutorial) {
      receive(s,'yueyue2');
      s.claimedMilestones.push('tutorial50');
      if (!s.skillSlots[0]) s.skillSlots[0] = 'yueyue2';
    }
    return { ...result, amount, multiplier, tutorial };
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
    s.skillSlots[slot] = id; s.slotReadyAt[slot] = s.settledAt + 30000;
    return s;
  }
  function activate(state, slot, now) {
    const s = settle(state, now).state, id = s.skillSlots[slot], def = id && skillAt(s,id), t = s.settledAt;
    if (s.pending || slot >= slotCount(s) || !s.collection[id] || !def?.kind) throw new Error('技能尚未開放');
    if ((s.cooldownUntil[id] || 0) > t || s.slotReadyAt[slot] > t) throw new Error('技能冷卻中');
    const count = s.chain && t < s.chain.expiresAt && s.chain.count < 3 ? s.chain.count+1 : 1;
    const windowMs = activeBonds(s).find(b=>b.effect.chainWindowMs)?.effect.chainWindowMs || 8000;
    const chainMul = [1,1.3,1.6][count-1];
    s.chain = {count,expiresAt:t+windowMs};
    const effect = { chain:count, params:{...def,desc:undefined}, source: id, kind: def.kind, startedAt: t, expiresAt: t + (def.duration || 0) * 1000 };
    if (def.kind === 'click') Object.assign(effect, { multiplier: def.multiplier, remaining: def.charges });
    else if (def.kind === 'clickTime') effect.multiplier = def.multiplier;
    else if (def.kind === 'self') effect.value = individual(s, id) * (def.multiplier - 1) * (Scenes(s.settings.scene).rewardMul || 1);
    else if (def.kind === 'team') effect.value = rates(s).P * def.ratio;
    else if (def.kind === 'clickAdd') Object.assign(effect, { value: rates(s).P * def.ratio, remaining: def.charges });
    else if (def.kind === 'burst') effect.value = def.factor * (def.basis === 'individual' ? individual(s, id) * (Scenes(s.settings.scene).rewardMul || 1) : rates(s).P + s.effects.filter(e=>e.kind==='team').reduce((sum,e)=>sum+e.value,0));
    else {
      const copied = target => individual(s,target)*(Scenes(s.settings.scene).rewardMul || 1) + s.effects.filter(e=>e.kind==='self' && e.source===target).reduce((sum,e)=>sum+e.value,0);
      const targets = Object.keys(s.collection).filter((key) => key !== id && s.collection[key] > 0).sort((a, b) => copied(b) - copied(a));
      if (!targets.length) throw new Error('需要另一位夥伴');
      effect.target = targets[0]; effect.value = copied(effect.target) * def.copy;
    }
    if (effect.multiplier !== undefined) effect.multiplier = 1+(effect.multiplier-1)*chainMul;
    if (effect.value !== undefined) effect.value *= chainMul;
    const completed = def.kind === 'burst' ? grant(s, effect.value) : 0;
    if (def.kind !== 'burst') s.effects.push(effect); s.cooldownUntil[id] = t + def.cd * 1000;
    return { state: s, effect, completed };
  }
  function purchaseDraw(state, count, now, pool, options = {}) {
    const s = settle(state, now).state;
    if (state.boss || s.pending || ![1, 5].includes(count)) throw new Error('王包中或尚有待收下結果或張數錯誤');
    const free = Math.min(s.freeDraws || 0,count), paid=count-free;
    const price = drawCost(s.paidDraws, paid);
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
  const unlocked = (s,id) => Object.hasOwn(sceneMap(),id) && sceneMap()[id].available!==false && (!sceneMap()[id].unlock || (s.bossWins || []).includes(sceneMap()[id].unlock.boss));
  const canBoss = (s,now) => !s.boss && !s.pending && !!nextScene(s.settings.scene) && !(s.bossWins || []).includes(s.settings.scene) && s.package.index-1 >= Scenes(nextScene(s.settings.scene)).unlock.packages && now >= (s.bossCooldownUntil || 0);
  function switchScene(state,id,now) {
    if (state.boss || !unlocked(state,id)) throw new Error('王包中或場景尚未解鎖');
    const s=settle(state,now).state; changeScene(s,id); return s;
  }
  function changeScene(s,id) {
    if (s.settings.scene===id) return;
    s.scenePackages ||= {}; s.scenePackages[s.settings.scene]=clone(s.package);
    const oldMul=Scenes(s.settings.scene).rewardMul || 1, newMul=Scenes(id).rewardMul || 1;
    s.effects.forEach(e=>{if (e.value !== undefined) e.value*=newMul/oldMul;});
    s.settings.scene=id; s.package=clone(s.scenePackages[id] || newPackage(id));
  }
  function startBoss(state,now) {
    const s=settle(state,now).state;
    if (!canBoss(s,now)) throw new Error('王包尚未就緒');
    const scene=s.settings.scene, cfg=Scenes(scene).boss, need=cfg.mul*requirement(s.package.index,scene), crack=s.bossCracks?.[scene] || 0;
    s.boss={scene,need,dealt:crack*need,startedAt:now,endsAt:now+cfg.seconds*1000,crack,shells:shellsFor(scene).filter(v=>1-v>crack),shellHp:3,blocked:0};
    s.bossResult=null; return s;
  }
  function finishBoss(s,won,now) {
    const b=s.boss, cfg=Scenes(b.scene).boss;
    const crack=won?0:Math.min(cfg.crackMax,b.dealt/b.need*cfg.crackKeep);
    s.bossCracks ||= {}; s.bossCracks[b.scene]=crack; s.boss=null;
    s.bossResult={scene:b.scene,won,crack,at:now,next:nextScene(b.scene)};
    if (won) {
      s.bossWins ||= []; if (!s.bossWins.includes(b.scene)) { s.bossWins.push(b.scene); s.universalDust=(s.universalDust || 0)+3; s.freeDraws=(s.freeDraws || 0)+cfg.reward.freeDraws; }
      s.bossCooldownUntil=0;
      if (unlocked(s,s.bossResult.next)) changeScene(s,s.bossResult.next);
    } else s.bossCooldownUntil=now+cfg.cooldown*1000;
  }
  function abandonBoss(state,now) {
    const s=clone(state); if (s.boss) finishBoss(s,false,now); return s;
  }
  const api = { markMul, decoMul, origin, tier, rarity, dust, availableDust, spentDust, promotionCost, transcendCost, promote, transcend, exchange, wardrobe, wardrobePrice, affinity, activeBonds, skillAt, recommend, clone, clickCost, trainingCost, drawCost, stars, starMultiplier, individual, rates, tagFor,
    newPackage, unlocked, nextScene, canBoss, startBoss, abandonBoss, switchScene,
    requirement, packageSum, advancePackage, settle, click, upgrade, slotCount, equip, activate, purchaseDraw, collect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
