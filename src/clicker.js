window.Clicker = (() => {
  // WebView2 在 Tauri hide()/show() 後 document.hidden 不一定跟著變，所有可見性判斷改看這個旗標：
  // visibilitychange 兩向、Rust 的 clicker-zoom（每次顯示都會發）、focus 都會更新它。
  let visible = !document.hidden;
  const hiddenNow = () => !visible;
  const jlog = (m) => { try { window.__TAURI__?.core.invoke('js_log', { msg: `clicker ${m}` }).catch(() => {}); } catch (_) {} };
  const $ = (id) => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, Pool = window.GachaPool;
  const TAURI = window.__TAURI__;
  // 萬／億／兆：數字部分最多 5 位（1234萬、123.4億、12.34兆），價籤與錢包才放得下
  // 單位一路排到「極」（1e48）：只排到京的話，深層場景的需求會變成十幾位數字，把版位（#package-number 等固定寬）撐爆並被切掉。
  const UNITS = [[1e48, '極'], [1e44, '載'], [1e40, '正'], [1e36, '澗'], [1e32, '溝'], [1e28, '穰'], [1e24, '秭'], [1e20, '垓'], [1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '萬']];
  const format = (n) => { if (n >= 1e52) return n.toExponential(2); for (const [u, name] of UNITS) if (n >= u) { const v = n / u; return `${v.toFixed(v >= 1000 ? 0 : v >= 100 ? 1 : 2)}${name}`; } return n.toLocaleString('zh-TW', { maximumFractionDigits: 1 }); };
  const store = window.ClickerSave.create({ getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) }, { pool: Pool });
  let stage, gacha, cutin, ready = false, tickTimer = 0, saveTimer = 0, numberTimer = 0, noticeTimer = 0;
  let audio = null, lastNumbers = -Infinity, inputTimes = [], slotsKey = '', suspended = false;
  const volumeDrafts = new Map();
  const audioScopes = new Set(), createScope = window.GachaAudio.createScope;
  // 每個 scope 的出口統一跟隨遊戲靜音；不改共用音效積木、不建立第二個 context。
  window.GachaAudio.createScope = () => {
    const scope = createScope(); audioScopes.add(scope);
    if (scope.dry) scope.dry.gain.value = store.state?.settings.muted ? 0 : store.state.settings.sfxVolume;
    const stop = scope.stop;
    scope.stop = (ms) => { audioScopes.delete(scope); stop(ms); };
    return scope;
  };
  const sounds = { click: [160, 95, .055, .05], upgrade: [520, 780, .12, .09], skill: [110, 70, .14, .12], miss: [300, 150, .12, .05] };
  // 更衣室的十種點擊音（tone／noiseHit 兩種積木，都與現行 click 同量級）
  const at = (ms) => window.GachaAudio.ensure().currentTime + ms / 1000;
  const CLICK_SOUNDS = {
    soft: a => a.tone(160, { slide: 95, slideT: .055, a: .002, d: .051, r: .002, gain: .05 }),
    bubble: a => { a.tone(520, { slide: 180, slideT: .07, a: .002, d: .07, r: .01, gain: .045 }); a.noiseHit({ a: .001, d: .012, r: .004, f0: 3200, q: 2, gain: .025 }); },
    paper: a => { a.noiseHit({ a: .002, d: .045, r: .01, f0: 2600, f1: 900, q: 1.2, gain: .055 }); a.tone(140, { slide: 90, slideT: .03, a: .002, d: .03, r: .005, gain: .02 }); },
    coin: a => { a.tone(1760, { type: 'triangle', a: .002, d: .09, r: .02, gain: .028 }); a.tone(2637, { t: at(10), a: .002, d: .07, r: .02, gain: .014 }); a.noiseHit({ a: .001, d: .01, r: .004, f0: 6000, q: 1, gain: .012 }); },
    taiko: a => { a.tone(200, { slide: 95, slideT: .09, a: .002, d: .1, r: .02, gain: .06 }); a.noiseHit({ a: .002, d: .04, r: .01, type: 'lowpass', f0: 700, q: .5, gain: .035 }); },
    sticker: a => { a.noiseHit({ a: .001, d: .02, r: .005, f0: 4200, q: .9, gain: .05 }); a.tone(320, { t: at(4), slide: 190, slideT: .035, a: .002, d: .035, r: .005, gain: .04 }); },
    squish: a => { a.tone(330, { type: 'triangle', slide: 150, slideT: .09, a: .003, d: .09, r: .01, gain: .045 }); a.tone(660, { t: at(20), slide: 250, slideT: .06, a: .002, d: .06, r: .01, gain: .012 }); },
    bubblewrap: a => { a.noiseHit({ a: .001, d: .014, r: .004, type: 'highpass', f0: 2600, q: .7, gain: .045 }); a.tone(900, { slide: 380, slideT: .03, a: .001, d: .03, r: .005, gain: .045 }); },
    woodblock: a => { a.tone(880, { slide: 620, slideT: .04, a: .002, d: .06, r: .01, gain: .04 }); a.tone(1760, { a: .001, d: .02, r: .005, gain: .015 }); a.noiseHit({ a: .001, d: .015, r: .004, f0: 1800, q: 2, gain: .03 }); },
    jelly: a => { a.tone(240, { slide: 120, slideT: .12, a: .003, d: .12, r: .02, gain: .05 }); a.tone(480, { type: 'triangle', t: at(30), slide: 200, slideT: .08, a: .002, d: .08, r: .01, gain: .015 }); },
  };
  function sound(name, variant = null) {
    if (hiddenNow() || store.state.settings.muted) return;
    window.GachaAudio.ensure(); audio ||= window.GachaAudio.createScope();
    if (name === 'click') { (CLICK_SOUNDS[variant || store.state.settings.clickSound] || CLICK_SOUNDS.soft)(audio); return; }
    if (name === 'page') { audio.noiseHit({ a: .004, d: .08, r: .02, f0: 2200, f1: 900, q: .8, gain: .12 }); return; }
    if (name === 'promote') { audio.tone(659, { type: 'triangle', a: .004, d: .25, r: .2, gain: .12 }); audio.tone(988, { type: 'triangle', t: at(90), a: .004, d: .4, r: .3, gain: .1 }); return; }
    if (name === 'transcend') { [659, 988, 1319, 1976].forEach((f, i) => audio.tone(f, { type: 'triangle', t: at(i * 70), a: .004, d: .35, r: .3, gain: .1 })); audio.tone(55, { a: .005, d: .8, r: .2, gain: .25, slide: 40, slideT: .7 }); audio.noiseHit({ t: at(200), a: .02, d: .4, r: .3, f0: 2500, f1: 9000, q: .5, gain: .08 }); return; }
    if (name === 'cutin-impact') {
      audio.noiseHit({a:.002,d:.056,r:.002,f0:3000,f1:600,gain:.08});
      audio.noiseHit({a:.002,d:.026,r:.002,f0:1800,gain:.15}); return;
    }
    if (name === 'cutin-stamp') { audio.tone(180,{a:.002,d:.056,r:.002,gain:.1}); return; }
    if (name === 'shell') { audio.noiseHit({f0:5200,f1:2400,d:.04,gain:.18}); audio.tone(1320,{d:.05,gain:.18}); return; }
    if (name === 'boss-enter') { audio.tone(70,{slide:40,slideT:.5,d:.5,gain:.5}); return; }
    if (name === 'boss-heart') { audio.tone(880,{d:.06,gain:.08}); return; }
    if (name === 'boss-win') { audio.reveal('legendary'); return; }
    if (name === 'gift-win') { [659, 880, 1319].forEach((f, i) => audio.tone(f, { type: 'triangle', t: at(i * 60), a: .004, d: .22, r: .2, gain: .1 })); audio.noiseHit({ t: at(120), a: .01, d: .25, r: .2, f0: 3000, f1: 8000, q: .6, gain: .06 }); return; }
    if (name === 'badge') { audio.tone(880, { d: .24, gain: .1 }); return; }   // 第十二輪：里程碑鈴
    if (name === 'daily') { audio.reveal('epic'); return; }
    const [from, to, duration, gain] = sounds[name];
    audio.tone(from, { slide: to, slideT: duration, a: .002, d: duration - .004, r: .002, gain });
  }
  function muteAudio() {
    window.ClickerMusic?.sync(store.state);
    for (const scope of audioScopes) if (scope.dry) scope.dry.gain.value = store.state.settings.muted ? 0 : store.state.settings.sfxVolume;
    const ac = window.GachaAudio.ensure(); if (!ac) return;
    if (store.state.settings.muted || hiddenNow()) ac.suspend().catch(() => {});
    else ac.resume().catch(() => {});
  }
  function notice(text) {
    $('notice').textContent = text; $('notice').hidden = false; clearTimeout(noticeTimer);
    if (!hiddenNow()) noticeTimer = setTimeout(() => { $('notice').hidden = true; noticeTimer = 0; }, 1400);
  }
  function status() {
    $('save-status').textContent = store.blocked ? '尚未儲存' : '已儲存';
    $('retry-save').hidden = !store.blocked || !store.state;
    $('tap').disabled = !ready || store.blocked;
    if (store.blocked && store.state && !hiddenNow()) notice(`尚未儲存：${store.error?.message || '寫入失敗'}。消費已鎖住。`);
  }
  function commit(next = store.state) {
    const saved = volumeDrafts.size ? E.clone(next) : next;
    for (const [key,value] of volumeDrafts) saved.settings[key] = value;
    const ok = store.commit(saved); if (ok && volumeDrafts.size) store.stage(next); status(); if (!ok) { gacha?.render(); renderSlots(); } return ok;
  }
  // 電動手指：每秒依等級自動點（走同一條 click 路徑，吃倍率與次數型效果；不算手點）
  function autoTick() {
    if (store.blocked || !store.state || gacha?.active || cutin?.active || !$('roster').hidden) return;
    const s = E.clone(store.state), n = window.ClickerPrestige.autoClicks(s, 1);
    if (!n) { if (s.autoRemainder !== store.state.autoRemainder) store.stage(s); return; }
    let state = s, amount = 0, completed = 0, multiplier = 1;
    for (let i = 0; i < n; i++) { const r = E.click(state, Date.now(), undefined, { auto: true }); state = r.state; amount += r.amount; completed += r.completed; multiplier = Math.max(multiplier, r.multiplier); }
    store.stage(state); stage.autoClick(amount, multiplier >= 10, state, completed, n);
  }
  function settle() {
    if (store.blocked || !store.state) return;
    const before=store.state.boss, result = E.settle(store.state, Date.now());
    // 換桌布提示（原本只在電動手指 tick 裡檢查，沒買電動手指的玩家永遠看不到）
    const P = E.rates(result.state).P, need = E.requirement(result.state.package.index, result.state.settings.scene);
    const hinted = window.ClickerPrestige?.hint(result.state, P, new Date().toDateString(), P > 0 ? need / P : 0);
    if (before && !result.state.boss) { if (!commit(result.state)) return; } else store.stage(result.state);
    stage?.render(result.state, { completed: result.completed });
    if (result.state.bossResult?.apocUnlocked && !apocOpened) { apocOpened = true; setTimeout(() => notice('末世解鎖了！到「場景」就能過去'), 3400); }   // v3：兩個主系統都從場景面板切
    if (!hiddenNow()) {
      stage?.floatPassive(result.earned);
      if (result.chest) { notice(`寶箱包！＋${format(result.chest)} 幣`); sound('boss-win'); }
      if (stage?.rateStamp(result.state)) {
        commit(result.state);
        pulse(document.querySelector('.wallet'), [{transform:'scale(1)'},{transform:'scale(1.08)',offset:.4},{transform:'scale(1)'}],300);
      }
    }
    if (hinted) prestigeUI?.hint();
  }
  let coinShown = null, coinTarget = null, coinRaf = 0, coinStarted = 0;
  function pulse(el, frames, duration) {
    el.getAnimations().forEach(a => a.cancel());
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.animate(frames, { duration, easing:'ease-out' });
  }
  function balance(target) {
    const el = $('coins');
    el.title = target.toLocaleString('zh-TW', { maximumFractionDigits: 6 });
    if (coinTarget === target && (coinRaf || coinShown === target)) return;
    if (coinTarget !== null && target !== coinTarget) {
      pulse(el, target > coinTarget ? [{transform:'scale(1)'},{transform:'scale(1.12)',offset:.4},{transform:'scale(1)'}] : [{color:'#C9686B'},{color:'#30251F'}], target > coinTarget ? 140 : 200);
      if (target > coinTarget && target - coinTarget >= Math.max(1, E.rates(store.state).P * 10)) pulse(document.querySelector('.wallet'), [{transform:'scale(1)'},{transform:'scale(1.04)',offset:.4},{transform:'scale(1)'}],180);
      if (target > coinTarget) pulse(document.querySelector('.wallet img'), [{transform:'rotate(-10deg)'},{transform:'rotate(0)'}],140);
    }
    coinTarget = target;
    if (coinShown === null || matchMedia('(prefers-reduced-motion: reduce)').matches) { coinShown = target; el.textContent = format(Math.floor(target)); return; }
    if (coinRaf) return;
    coinStarted = performance.now();
    function frame(now) {
      coinShown += (coinTarget - coinShown) * .25;
      if (Math.abs(coinTarget - coinShown) < .1 || now - coinStarted >= 280) coinShown = coinTarget;
      el.textContent = format(Math.floor(coinShown));
      coinRaf = coinShown === coinTarget ? 0 : requestAnimationFrame(frame);
    }
    coinRaf = requestAnimationFrame(frame);
  }
  function rate(el, text, exact) {
    if (el.title === exact && el.dataset.value === text) return;
    el.title = exact;
    const old = el.dataset.value;
    el.dataset.value = text; el.replaceChildren();
    const next = document.createElement('span'); next.textContent = text; el.append(next);
    if (old) {
      const prev = document.createElement('span'); prev.className = 'rate-old'; prev.textContent = old; el.append(prev);
      pulse(next,[{transform:'translateY(6px)',opacity:0},{transform:'translateY(0)',opacity:1}],180);
      pulse(prev,[{opacity:1},{opacity:0}],180);
      prev.getAnimations()[0]?.finished.then(()=>prev.remove()).catch(()=>prev.remove());
      if (!prev.getAnimations().length) prev.remove();
    }
  }
  function numbers(force = false) {
    window.ClickerMusic?.sync(store.state);
    if (!store.state || hiddenNow()) return;
    const time = performance.now(), delay = 100 - (time - lastNumbers);
    if (!force && delay > 0) {
      if (!numberTimer) numberTimer = setTimeout(() => { numberTimer = 0; numbers(); }, delay);
      return;
    }
    lastNumbers = time;
    const s = store.state, { D, P } = E.rates(s);
    // v3：面前是路障小王還是站尾大王；輸過的小王不自動再打，鍵要一直在（DESIGN-balance-v3 §十三、§14.2）
    const now=Date.now(), challenge=$('boss-challenge'), preview=E.bossPreview(s,now), sceneBoss=window.ClickerScene.resolve(s.settings.scene).boss?.name || '大罐頭';
    const bossName=preview?.kind==='gate' ? '路障小王' : sceneBoss, show=!!preview && (preview.kind==='gate' ? !!s.package.gate : preview.ready);
    const cooling=preview && !preview.ready && preview.cooldownUntil>now;
    // 冷卻中的挑戰鍵會被 disabled，但以前長得跟可按的一模一樣，玩家以為「有東西擋住」（使用者 09-13 回報）→ 鍵面直接寫倒數
    const label=cooling ? `冷卻 ${Math.ceil((preview.cooldownUntil-now)/1000)} 秒` : `挑戰${bossName}！`;
    if (challenge.dataset.boss!==bossName) { challenge.dataset.boss=bossName; challenge.classList.toggle('long',bossName.length>4); }
    if (challenge.textContent!==label) challenge.textContent=label;
    challenge.classList.toggle('cooling',!!cooling);
    if (show && challenge.hidden) { pulse(challenge,[{transform:'rotate(-3deg) scale(0)'},{transform:'rotate(-3deg) scale(1.1)',offset:.7},{transform:'rotate(-3deg) scale(1)'}],260); sound('upgrade'); }
    challenge.hidden=!show; challenge.disabled=store.blocked || !!cutin?.active || !!gacha?.active || !!stage?.bossBusy || !!cooling;
    challenge.classList.toggle('glow', !!preview && preview.ratio>=.9 && !cooling);
    const est=$('boss-estimate'); est.hidden=!show;
    if (show) { const pct=Math.min(999,Math.round(preview.ratio*100)); est.querySelector('span').textContent=cooling ? `冷卻 ${Math.ceil((preview.cooldownUntil-now)/1000)} 秒` : `≈ ${pct}%`; est.querySelector('i').style.width=`${Math.min(100,pct)}%`; est.classList.toggle('ok',pct>=100); est.classList.toggle('near',pct>=90 && pct<100); }
    const gateBlock=$('gate-block'); gateBlock.hidden=!(preview?.kind==='gate' && !s.boss);
    if (!gateBlock.hidden) {
      $('gate-label').innerHTML=`第 ${preview.index} 包路障${preview.lost ? '<br><small>守住了，準備好再點「挑戰」</small>' : ''}`;
      // 小王＝該站大王的素材縮小（sprite 走 CSS 逐幀，靜態圖直接當背景）
      const cfg=window.ClickerScene.resolve(s.settings.scene).boss || {}, pv=$('gate-preview'), w=Math.round((cfg.size?.[0] || 260)*.5), h=Math.round((cfg.size?.[1] || 300)*.5);
      pv.style.width=`${w}px`; pv.style.height=`${h}px`;
      if (cfg.sprite) { pv.classList.add('sprite'); pv.style.setProperty('--boss-sprite',`url('${cfg.sprite}')`); pv.style.setProperty('--boss-frames',cfg.frames || 4); pv.style.backgroundImage=''; }
      else { pv.classList.remove('sprite'); pv.style.removeProperty('--boss-sprite'); pv.style.backgroundImage=`url('${cfg.image || 'clicker-boss-can.png'}')`; }
    }
    $('scene-open').disabled=!!s.boss || !!stage?.bossBusy; $('recruit-open').disabled=!!s.boss && s.boss.gate===undefined;   // v3：小王不鎖招募
    balance(s.coins); rate($('click-rate'), `每次 ${format(D)}`, String(D)); rate($('passive-rate'), `每秒 ${format(P)}`, String(P));
    $('tutorial-progress').textContent = `${Math.min(50, s.manualClicks)} / 50`;
    if (s.claimedMilestones.includes('tutorial50') && !$('tutorial').hidden && !$('tutorial').classList.contains('leaving')) {
      const el = $('tutorial'); el.classList.add('leaving');
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) el.hidden = true;
      else el.animate([{transform:'rotate(0)',opacity:1},{transform:'translateY(-60px) rotate(-8deg)',opacity:0}],{duration:240,easing:'ease-in'}).finished.then(()=>{el.hidden=true;}).catch(()=>{el.hidden=true;});
    }
    for (const type of ['click', 'training']) {
      const field = type === 'click' ? 'clickLevel' : 'trainingLevel', cost = (type === 'click' ? E.clickCost : E.trainingCost)(s[field]);
      const next = { ...s, [field]: s[field] + 1 }, after = E.rates(next);
      $(`${type}-level`).textContent = `Lv.${s[field]}`;
      rate($(`${type}-next`), type === 'click' ? `每次 ${format(D)} → ${format(after.D)}` : `每秒 ${format(P)} → ${format(after.P)}`, type === 'click' ? `${D} → ${after.D}` : `${P} → ${after.P}`);
      const missing = Math.max(0, Math.ceil(cost - s.coins));
      const buy = $(`${type}-one`); buy.textContent = '升級！'; $(`${type}-price`).textContent = format(cost); $(`${type}-ticket`).title = String(cost);
      buy.title = missing ? `還差 ${format(missing)}` : '升一級';
      $(`${type}-one`).disabled = $(`${type}-max`).disabled = store.blocked || cost > s.coins || !Number.isFinite(cost);
    }
    $('completed').textContent = `已拆 ${s.package.index - 1} 包`;
    $('owned-count').textContent = `${Object.keys(s.collection).length} / ${Object.keys(B.characters).length}`;
    const nextSlot = B.slotThresholds[E.slotCount(s)];
    $('next-goal').textContent = s.manualClicks < 50 ? '下一目標：50 點迎接玥玥' : nextSlot ? `累計 ${format(nextSlot)} 幣開下一技能槽` : '三個技能槽全部開放';
    audioUI();
    gacha?.render();
  }
  // 音量與靜音是兩個世界共用的設定，所以它的按鈕狀態不能只在桌邊的 numbers() 裡更新
  //（末世的 changed() 會提早 return → 靜音之後按鈕的刪線與 aria-pressed 停在舊值。Codex 第二輪 B13）
  function audioUI() {
    const s = store.state; if (!s) return;
    $('mute').setAttribute('aria-pressed', String(s.settings.muted));
    $('music').setAttribute('aria-pressed', String(!s.settings.music));
    for (const kind of ['music','sfx']) if (document.activeElement !== $(`${kind}-volume`)) $(`${kind}-volume`).value = s.settings[`${kind}Volume`];
    for (const kind of ['music','sfx']) renderVolume(kind);
  }
  function renderVolume(kind) {
    const input = $(`${kind}-volume`), percent = Math.round(Number(input.value)*100);
    input.style.setProperty('--p', `${percent}%`);
    $(`${kind}-percent`).textContent = percent ? `${percent}%` : '靜音';
  }
  function skillTip(s,id) {
    const star = Math.max(1,E.stars(E.dust(s,id) || 0));
    const now = E.skillAt(s,id,star);
    return `現在：${now.desc(now)}` + (star < 5 ? `\n下一星：${now.desc(E.skillAt(s,id,star+1))}` : '');
  }
  function homeFlag(s,id) {
    if (!E.affinity(s,id)) return null;
    const flag=document.createElement('span'); flag.className='affinity-flag';
    flag.title=`${window.ClickerScene.resolve(s.settings.scene).name}當家：收益 ×1.5、冷卻 −20%`;
    flag.setAttribute('aria-label',flag.title); return flag;
  }
  function renderChain() {
    if (apocMode()) { const t = $('chain-tape'); if (t) t.hidden = true; return; }   // 桌邊的連鎖倒數不該凍在末世（Codex 第二輪 B12）
    let tape=$('chain-tape');
    if (!tape) { tape=document.createElement('div');tape.id='chain-tape';tape.setAttribute('role','status');$('slots').before(tape); }
    tape.style.left=`${$('slots').offsetLeft}px`;tape.style.top=`${$('slots').offsetTop-52}px`;
    const chain=store.state.chain, seconds=Math.max(0,Math.ceil(((chain?.expiresAt || 0)-Date.now())/1000));
    tape.classList.toggle('visible',seconds>0);tape.dataset.count=chain?.count || 1;
    tape.textContent=chain?.count>=2 ? `連鎖 ×${chain.count} · ${seconds}s` : `連鎖 ${seconds}s`;
  }
  function showRecommendations() {
    let list=$('recommendations');
    if (list) {list.remove();return;}
    list=document.createElement('div');list.id='recommendations';
    B.recommendations.forEach((preset,index)=>{
      const ticket=document.createElement('button');ticket.className='recommend-ticket';ticket.dataset.index=index;
      const portraits=document.createElement('span');portraits.className='recommend-portraits';
      for(const id of [...preset.slots].sort((a,b)=>E.origin(a)-E.origin(b) || Pool.CHARACTER_IDS.indexOf(a)-Pool.CHARACTER_IDS.indexOf(b))) {const art=card.art.create(Pool.byId[id]);art.classList.toggle('missing',!store.state.collection[id]);art.setAttribute('aria-label',Pool.byId[id].name);portraits.append(art);}
      const label=document.createElement('b');label.textContent=preset.name;
      const desc=document.createElement('small');desc.textContent=preset.desc;
      ticket.title=preset.slots.some(id=>!store.state.collection[id])?'招募到即可套用':'套用後更換槽位等待 30 秒';
      ticket.append(portraits,label,desc);
      if(preset.slots.some(id=>!store.state.collection[id])) {const missing=document.createElement('small');missing.textContent='招募到即可套用';ticket.append(missing);}
      ticket.disabled=store.blocked || !!store.state.pending;
      ticket.onclick=()=>action(()=>{if(commit(E.recommend(store.state,index,Date.now()))) {changed();showRoster();notice(`已套用${preset.name}，更換槽位等待 30 秒`);}});
      list.append(ticket);
    });
    $('album-book').before(list);
  }
  function renderSlots() {
    if (apocMode()) return;   // 末世的技能格由 clicker-apoc-ui.js 畫
    if (!store.state) return;
    const s = store.state, key = JSON.stringify([s.settings.scene, s.collection, s.skillSlots, E.slotCount(s)]);
    if (slotsKey !== key) {
      slotsKey = key; $('slots').replaceChildren(); delete $('slots').dataset.world;
      for (let i = 0; i < s.skillSlots.length; i++) {
        const el = document.createElement('article'); el.className = 'skill-slot';
        const id = s.skillSlots[i];
        const button = document.createElement('button'); button.className = 'skill-use';
        if (id) {button.append(card.art.create(Pool.byId[id]));const flag=homeFlag(s,id);if(flag) button.append(flag);}
        else button.textContent = '＋';
        button.onclick = () => id ? activate(i) : showRoster(null,i);
        const name = document.createElement('span'); name.className = 'skill-name'; name.textContent = id ? Pool.byId[id].name.replace('（原版）','') : i < E.slotCount(s) ? '選夥伴' : '未解鎖';
        const detail = document.createElement('small'); el.append(button, name, detail); $('slots').append(el);
      }
    }
    [...$('slots').children].forEach((el, i) => {
      const id = s.skillSlots[i], def = id && E.skillAt(s,id), t = Math.max(Date.now(), s.settledAt);
      const remaining = Math.max(0, Math.ceil((Math.max(s.cooldownUntil[id] || 0, s.slotReadyAt[i]) - t) / 1000));
      const effect = s.effects.find((e) => e.source === id);
      const button = el.querySelector('.skill-use');
      const wasReady = el.dataset.ready === 'true';
      button.disabled = store.blocked || !!gacha?.active || !!cutin?.active || i >= E.slotCount(s) || (!!id && (!def?.kind || remaining > 0 || (id === 'zhenmu' && Object.keys(s.collection).length < 2)));
      const available = !!def?.kind && !button.disabled;
      el.dataset.ready = String(available); el.dataset.state = !id ? 'empty' : remaining ? 'cooldown' : available ? 'ready' : 'unavailable';
      el.style.setProperty('--cooldown', `${Math.min(1,remaining / (s.slotReadyAt[i] > (s.cooldownUntil[id] || 0) ? 30 : def?.cd || 30)) * 360}deg`);
      if (available && !wasReady) pulse(button,[{transform:'scale(1)'},{transform:'scale(1.12)',offset:.5},{transform:'scale(1)'}],240);
      const detail = i >= E.slotCount(s) ? `累積 ${format(B.slotThresholds[i])} 幣解鎖` : effect ? `${effect.remaining !== undefined ? `餘 ${effect.remaining} 次` : effect.kind === 'clickTime' ? `點擊 ×${effect.multiplier}` : `+${format(effect.value)}/秒`}・${Math.max(0,Math.ceil((effect.expiresAt-t)/1000))} 秒` : !def ? '點我選一位夥伴' : !def.kind ? '後續開放' : remaining ? `冷卻 ${remaining} 秒` : id === 'zhenmu' && Object.keys(s.collection).length < 2 ? '需要另一位夥伴' : '可以發動';
      el.querySelector('small').textContent = effect?.remaining !== undefined ? `餘 ${effect.remaining} 次` : remaining ? `${remaining}s` : '';
      const tip = def ? `${def.skill}\n${skillTip(s,id)}${def.kind ? '' : '\n（後續開放）'}` : (i >= E.slotCount(s) ? detail : '點我選一位夥伴');
      if (button.title !== tip) {button.title = tip;button.dataset.tooltip = tip;}   // title 不隨冷卻秒數改寫，hover 提示才不會每秒閃
      button.setAttribute('aria-label',`槽 ${i+1}・${def ? def.skill + '・' : ''}${detail}`);

    });
  }
  const apocMode = () => store.state?.settings.world === 'apoc';
  function changed() {
    if (store.state) $('mode-open').hidden = !store.state.apoc?.unlocked;   // 末世沒解鎖就只有一個模式，這顆鍵沒意義
    if (apocMode()) { apocUI?.render(); apocMap?.sync(); gacha?.render(); album?.refresh(); audioUI(); return; }   // 末世：同一組節點，另一套資料
    numbers(true); renderSlots(); renderChain(); stage?.render(store.state); album?.refresh(); extras?.tick();
  }
  function action(fn) {
    if (store.blocked || !ready || hiddenNow()) { if (hiddenNow()) jlog(`action blocked: visible=${visible} document.hidden=${document.hidden} suspended=${suspended}`); return; }
    try { fn(); } catch (err) { notice(err.message); slotsKey = ''; renderSlots(); }
  }
  // target：三連包子包 0..2 或 'gift'；點珍母、空白鍵沒有指向
  function tap(point, target) {
    action(() => {
      if (gacha.active || !$('roster').hidden || !$('wardrobe').hidden || !$('prestige').hidden || !$('receipt').hidden || !$('stats').hidden) return;
      if (apocMode()) { apocUI.tap(); return; }   // 末世：同一個點擊區，打的是怪
      const time = performance.now(); inputTimes = inputTimes.filter((t) => time - t < 1000); if (inputTimes.length >= 8) return;
      inputTimes.push(time);
      const result = E.click(store.state, Date.now(), target);
      if (result.tutorial || (store.state.boss && !result.state.boss) || result.giftHit) { if (!commit(result.state)) return; }
      else { store.stage(result.state); $('save-status').textContent = '等待自動儲存'; }
      stage.click(result.amount, result.multiplier >= 10, store.state, result.completed, point, result);
      stage.shell(result);
      if (result.chest) { notice(`寶箱包！＋${format(result.chest)} 幣`); sound('boss-win'); }
      if (result.tutorial) { stage.setPartners(store.state); stage.join(store.state, [{id:'yueyue2'}]); renderSlots(); notice('教學獎勵：玥玥入隊！每秒 +4 幣，可發動尾巴節拍。'); }
      numbers(true); extras?.afterClick();
    });
  }
  function upgrade(type, max) {
    action(() => {
      const result = E.upgrade(store.state, type, max, Date.now());
      if (!commit(result.state)) return;
      sound('upgrade'); changed();
      pulse($(`${type}-ticket`), [{transform:'scale(1)'},{transform:'scale(.96)',offset:.5},{transform:'scale(1)'}],140);
    });
  }
  function activate(slot) {
    action(() => {
      if (gacha.active || cutin.active) return;
      const result = E.activate(store.state, slot, Date.now());
      if (!commit(result.state)) return;
      window.ClickerMusic?.sync(store.state);
      cutin.play(result.effect); changed(); extras?.afterBurst(result);
    });
  }
  // 第十輪起名冊改成卡冊（clicker-album.js）
  function showRoster(selected = null, targetSlot = null) { if (!ready || cutin?.active) return; album.open(selected, targetSlot); }
  function showRosterLegacy(selected = null, targetSlot = null) {
    if (!ready || cutin?.active) return;
    const s = store.state; $('roster-grid').replaceChildren(); $('recommendations')?.remove();
    for (const id of Object.keys(B.characters)) {
      const count = s.collection[id] || 0, el = document.createElement('article'); el.className = `roster-character${count ? '' : ' locked'}`;
      el.append(card.art.create(Pool.byId[id]));
      const name = document.createElement('b'); name.textContent = Pool.byId[id].name;
      const stars = document.createElement('div'); stars.className = 'stars'; stars.setAttribute('aria-label', `${E.stars(count)} 星`);
      stars.innerHTML = '<img src="clicker-star.png" alt="" />'.repeat(E.stars(count));
      const passive = document.createElement('small'); passive.textContent = count ? `${count} 張 · 每秒 ${format(E.individual(s, id))}` : '尚未招募';
      const skill = document.createElement('small'); skill.textContent = `${B.characters[id].skill}${B.characters[id].kind ? '' : ' · 後續開放'}`; skill.title = skillTip(s,id); skill.dataset.tooltip=skill.title;
      const desc = document.createElement('small'); desc.className = 'skill-desc'; desc.textContent = skillTip(s,id);
      const mastery = document.createElement('small'); mastery.textContent = count > 16 ? `熟練 +${count - 16}%` : count ? `下次升星 ${count}/${B.stars[E.stars(count)] || 16}` : '';
      const rarity = document.createElement('small'); rarity.textContent = {common:'普通',rare:'精良',epic:'史詩',legendary:'傳說',mythic:'神話'}[Pool.byId[id].rarity];
      el.append(name, rarity, stars, passive, skill, desc, mastery);
      for(const bond of B.bonds.filter(b=>b.pair.includes(id))) {
        const row=document.createElement('div');row.className='bond-row';const active=bond.pair.every(key=>s.collection[key]);row.classList.toggle('inactive',!active);
        bond.pair.forEach((key,i)=>{if(i) {const chain=document.createElement('span');chain.className='bond-chain';chain.textContent='⛓';const img=new Image();img.src='clicker-ui-bond-chain.png';img.alt='';img.onload=()=>chain.replaceChildren(img);row.append(chain);}row.append(card.art.create(Pool.byId[key]));});
        const label=document.createElement('small');label.textContent=active?`${bond.name} · 已生效`:`需要 ${bond.pair.filter(key=>!s.collection[key]).map(key=>Pool.byId[key].name).join('、')}`;row.append(label);el.append(row);
      } el.dataset.id = id;
      el.tabIndex = 0; el.setAttribute('role','button'); el.onclick = () => showRoster(id, targetSlot);
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRoster(id,targetSlot); } };
      el.classList.toggle('selected', selected === id); $('roster-grid').append(el);
    }
    const detail = $('roster-detail'); detail.replaceChildren();
    const title = document.createElement('b'); title.textContent = selected ? `${Pool.byId[selected].name}・更換後等待 30 秒` : '選擇夥伴，再裝備至技能槽'; detail.append(title);
    for (let i = 0; i < 3; i++) {
      const button = document.createElement('button'), occupied = selected ? s.skillSlots.indexOf(selected) : -1;
      button.textContent = i >= E.slotCount(s) ? `槽${i+1}：累計 ${format(B.slotThresholds[i])} 幣` : occupied >= 0 ? `已在槽 ${occupied+1}` : `裝備至槽 ${i+1}`;
      button.disabled = !s.collection[selected] || i >= E.slotCount(s) || occupied >= 0 || store.blocked;
      button.classList.toggle('target-slot', targetSlot === i);
      button.onclick = () => action(()=>{ if (commit(E.equip(store.state,i,selected,Date.now()))) { changed(); showRoster(selected,i); } }); detail.append(button);
    }
    $('roster').hidden = false; $('game-content').inert = true; $('roster-close').focus();
  }
  function startTimers() {
    if (hiddenNow() || suspended || tickTimer || !ready) return;
    tickTimer = setInterval(() => {
      if (apocMode()) { apocUI?.tick(); return; }   // 末世不跑 1.0 的拆包結算
      settle(); autoTick(); changed();
    }, 1000);
    saveTimer = setInterval(() => { if (!store.blocked) commit(); }, 5000);
    if (!gacha.active && !apocMode()) stage.start();   // 末世不跑桌邊舞台（Codex 第二輪 B4）
  }
  function stopTimers() {
    clearInterval(tickTimer); clearInterval(saveTimer); clearTimeout(numberTimer); clearTimeout(noticeTimer);
    cancelAnimationFrame(coinRaf); coinRaf = 0;
    tickTimer = saveTimer = numberTimer = noticeTimer = 0; cutin?.stop(); stage?.stop();
    document.getAnimations().forEach((a) => a.cancel()); $('notice').hidden = true;
  }
  function suspend() {
    if (suspended) return; suspended = true; jlog(`suspend (document.hidden=${document.hidden})`);
    window.ClickerMusic?.suspend();
    if (store.state && !store.blocked && !apocMode()) { store.stage(E.abandonBoss(store.state,Date.now())); settle(); commit(); }   // 末世不跑桌邊結算
    stopTimers(); gacha?.suspend(); extras?.suspend?.(); audio?.stop(0); audio = null;
    const ac = window.GachaAudio.ensure(); ac?.suspend().catch(() => {});
  }
  function offline() {
    if (!store.state || store.blocked) return;
    const result = E.settle(store.state, Date.now(), {offline:true});
    if (!commit(result.state)) return;
    if (result.elapsed >= 60000 && result.earned > 0) {
      const hours = (ms) => format(ms / 3600000);
      $('receipt-text').textContent = `離開 ${hours(result.elapsed)} 小時，結算 ${hours(result.duration)} 小時，獲得 ${format(result.earned)} 幣。`;
      $('receipt').hidden = false; $('game-content').inert = true; $('receipt-close').focus();
    }
  }
  async function closeWindow() {
    visible = false; suspend();
    if (TAURI) {
      try { await TAURI.core.invoke('close_clicker_window'); }
      catch (err) { notice(`關閉失敗：${err.message}`); resume(); }
    }
  }
  function resume() {
    // 冪等：Tauri 的 hide()/show() 不一定觸發 visibilitychange，所以 resume 可能從多個來源進來
    jlog(`resume request: visible=${visible} suspended=${suspended} document.hidden=${document.hidden} ready=${ready}`);
    if (!visible || !suspended) return;
    suspended = false;
    if (!ready) return;
    // 末世沒有離線收益，也不該在回來時跑桌邊的離線收據與桌邊舞台（Codex 複檢 1-4）
    if (apocMode()) apocUI?.resume(); else { offline(); stage.render(store.state, { instant: true }); }
    window.ClickerMusic?.resume(store.state); gacha.restore(); changed(); startTimers(); muteAudio();
  }
  function applyZoom(z) {
    z = Math.max(.75, Math.floor((Number.isFinite(z) && z > 0 ? z : 1) / .25) * .25);
    $('zoomer').style.transform = `scale(${z})`; return z;
  }
  // 直式手機：螢幕比舞台還瘦的時候換一套版面（CSS 那邊是 max-aspect-ratio: 3/4）。
  // 這裡只負責算舞台的縮放比——舞台內部仍然是 608×360 的座標系，整塊等比縮到畫面寬，
  // 場景圖層、王的座標、粒子、技能槽全部跟著走，一行都不用改。
  const isPortrait = () => matchMedia('(max-aspect-ratio: 3/4)').matches;
  function fitStage() {
    const fit = $('stage-fit'); if (!fit) return;
    // ⚠ 變數要設在 #game 上不是 #stage-fit 上：粒子畫布與浮字層是 #stage 的兄弟，
    // 設在 #stage-fit 上它們讀不到，var(--stage-fit,1) 會退回 1、608px 寬直接撐出畫面。
    const host = $('game');
    if (!isPortrait()) {
      for (const v of ['--stage-fit', '--cutin-fit', '--gacha-fit', '--gacha-top']) host.style.removeProperty(v);
      return;
    }
    host.style.setProperty('--stage-fit', fit.clientWidth / 608);
    // 切入演出是 960×640 的座標系，直式縮到畫面寬當成中央的一條橫幅
    host.style.setProperty('--cutin-fit', host.clientWidth / 960);
    // 招募演出：直式換成 560×900 的直box，等比縮進「頂欄與收下鍵之間」那段，再水平置中。
    // ⚠ 不能只照畫面寬縮：320×640 這種矮螢幕是高度先卡住的，只看寬會把下排卡片頂到收下鍵上。
    const G = window.ClickerGacha.PORTRAIT_BOX;
    const room = Math.max(160, host.clientHeight - G.pad * 2);
    const gf = Math.min(host.clientWidth / G.w, room / G.h);
    host.style.setProperty('--gacha-fit', gf);
    host.style.setProperty('--gacha-top', `${G.pad + (room - G.h * gf) / 2}px`);
  }
  function fitWindow() {
    fitStage();
    if (isPortrait()) return;   // 直式由 CSS 撐滿，不縮放整個 #game
    if (TAURI) { TAURI.core.invoke('fit_window', { dpr: window.devicePixelRatio || 1 }).catch(() => {}); return; }
    const z = applyZoom(Math.min(innerWidth / 960, innerHeight / 640));
    $('zoomer').style.left = `${(innerWidth - 960 * z) / 2}px`;
    $('zoomer').style.top = `${(innerHeight - 640 * z) / 2}px`;
  }
  let album = null, prestigeUI = null, extras = null, dragUI = null, teamUI = null, apocUI = null, apocMap = null, apocOpened = false;
  // v3 大掃除結算頁：v2→v3 遷移過（legacy 存在）而且還沒看過就整頁顯示一次；玩家自己按「收下」才關。
  // 匯入存檔到另一台機器第一次載入也會看到（legacy.seen 存在存檔裡）。
  // 從零開始之後的獎勵視窗：卡與徽章；收下才關
  function rewardPage() {
    $('reward-badge').replaceChildren(extras?.badgeNode ? extras.badgeNode('oldtimes') : document.createTextNode('舊'));
    $('reward').hidden = false; $('game-content').inert = true; $('reward-ok').focus();
    $('reward-ok').onclick = () => { $('reward').hidden = true; $('game-content').inert = false; changed(); notice('從零開始。魔花少女在末世的卡冊，徽章在徽章牆'); };
  }
  // 舊時代的相簿：legacy.snapshot 的卡片（星、超越、階級）與數字
  function mementoPage() {
    const snap = store.state.legacy?.snapshot; if (!snap) return;
    const ids = Object.keys(snap.collection || {}).filter(id => Pool.byId[id] && snap.collection[id] > 0).sort((a, b) => E.origin(b) - E.origin(a));
    $('memento-summary').textContent = `生涯 ${format(snap.lifetimeCoins || 0)} 幣・已拆 ${format(snap.packages || 0)} 包・輪迴 ${snap.prestiges || 0} 次・夥伴 ${ids.length} 隻・徽章 ${(snap.badges || []).length} 枚（${new Date(snap.takenAt).toLocaleDateString('zh-TW')} 封存）`;
    const grid = $('memento-grid'); grid.replaceChildren();
    const fake = { ...store.state, collection: snap.collection, dust: snap.dust, promotions: snap.promotions || {}, transcend: snap.transcend || {} };
    for (const id of ids) {
      const cell = document.createElement('div'); cell.className = 'memento-cell';
      const el = card.create({ ...Pool.byId[id], rarity: E.rarity(fake, id) }, { tag: false }); el.classList.add('flipped', 'album-card'); cell.append(el);
      const meta = document.createElement('small'); const st = E.stars(E.dust(fake, id)), t = snap.transcend?.[id] || 0, L = snap.partnerLevels?.[id] || 0;
      meta.textContent = `★${st}${t ? `・超越 ${t}` : ''}${L ? `・Lv.${L}` : ''}`; cell.append(meta); grid.append(cell);
    }
    $('memento').hidden = false; $('game-content').inert = true; $('memento-close').focus();
  }
  function cleanupPage() {
    const s = store.state, L = s.legacy;
    if (!L || L.seen) return;
    const kept = [`夥伴 ${Object.keys(s.collection).filter(id => s.collection[id] > 0).length} 隻、星與超越`, `徽章 ${s.badges.length} 枚、更衣室、桌面裝飾`, `輪迴 ${L.prestiges} 次的紀錄、王的勝利`];
    const artsSpent = (s.blessing || 0) * ((s.blessing || 0) + 1) / 2;
    const tidy = [`印記 ${L.marksClaimed.toLocaleString('zh-TW')} → ${(s.marksClaimed).toLocaleString('zh-TW')}（新版印記照「每輪做到的事」算，每輪最多 ${B.V3.MARKS_PER_RUN} 枚）`,
      `收益祝福 Lv.${L.blessing.toLocaleString('zh-TW')} → Lv.${s.blessing}（已用 ${artsSpent} 枚幫你買到；手上還有 ${s.marks} 枚可以投其他神器）`,
      `永久倍率：拿掉（以前是 ×${(1 + .5 * Math.sqrt(L.marksClaimed)).toFixed(0)}，所有王都變成秒殺）`];
    const gifts = ['徽章「舊時代的珍母」', '魔花少女・精裝收藏卡（末世的收藏卡分頁）', '⚠ 只有選「從零開始」才拿得到：夥伴、粉塵、徽章、幣全部歸零']; 
    const why = `新印記 ＝ 換桌布次數 ${L.prestiges} × 每輪上限 ${B.V3.MARKS_PER_RUN} ＝ ${L.prestiges * B.V3.MARKS_PER_RUN} 枚（反推不到的一律給上界，寧可多給）。祝福第 L 級收 L 枚，先幫你買到買不起為止。永久倍率的根因：它跟生涯幣掛鉤、又乘回幣上，兩條互餵沒有頂；新版換成有頂的神器。`;
    $('cleanup-body').innerHTML = `<div class="cleanup-cols">
      <div><b>保留</b><ul>${kept.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div><b>整理</b><ul>${tidy.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div><b>補償</b><ul>${gifts.map(t => `<li>${t}</li>`).join('')}</ul></div></div>
      <p id="cleanup-explain" hidden>${why}</p>
      <p class="cleanup-choice">兩條路選一條：<b>保留進度</b>（照上面「整理」的數字繼續玩）或 <b>從零開始</b>（放棄全部進度，換魔花少女精裝收藏卡與徽章）。</p>`;
    $('cleanup').hidden = false; $('game-content').inert = true; $('cleanup-ok').focus();
    $('cleanup-why').onclick = () => { const el = $('cleanup-explain'); el.hidden = !el.hidden; };
    $('cleanup-ok').onclick = () => { const next = E.clone(store.state); next.legacy = { ...next.legacy, seen: Date.now(), reset: false }; if (commit(next)) { $('cleanup').hidden = true; $('game-content').inert = gacha?.active || false; changed(); } };
    // 從零開始：新存檔＋封存的 legacy（reset:true）＋收藏卡；要按兩次
    const resetBtn = $('cleanup-reset'); resetBtn.dataset.armed = '';
    resetBtn.onclick = () => {
      if (resetBtn.dataset.armed !== '1') { resetBtn.dataset.armed = '1'; resetBtn.textContent = '確定放棄全部進度？再按一次'; return; }
      const fresh = window.ClickerSave.fresh(Date.now());
      fresh.settings = { ...fresh.settings, muted: s.settings.muted, music: s.settings.music, musicVolume: s.settings.musicVolume, sfxVolume: s.settings.sfxVolume };
      // 進度快照：卡片、星、升階、超越、訓練、徽章——放在 legacy.snapshot，徽章牆的「舊時代的相簿」可以回味
      const snapshot = { takenAt: Date.now(), collection: { ...s.collection }, dust: { ...s.dust }, promotions: { ...s.promotions }, transcend: { ...s.transcend }, partnerLevels: { ...s.partnerLevels }, badges: [...s.badges], lifetimeCoins: s.lifetimeCoins, prestiges: L.prestiges, packages: window.ClickerExtras.totalPackages ? window.ClickerExtras.totalPackages(s) : 0 };
      fresh.legacy = { ...L, seen: Date.now(), reset: true, snapshot }; fresh.collectibles = ['mohuashaonv'];
      const checked = window.ClickerExtras.checkBadges ? window.ClickerExtras.checkBadges(fresh).state : fresh;
      if (commit(checked)) { $('cleanup').hidden = true; reload(); rewardPage(); }
    };
  }
  // 第十二輪：匯入存檔後整個畫面照新狀態重來（場景、夥伴列、舞台、待收下的招募）
  function reload() {
    window.ClickerScene.mount(store.state.settings.scene, store.state.package.index);
    // 匯入存檔會走到這裡。舊版只掛桌邊場景與桌邊舞台，所以匯入一份末世的檔之後
    // settings.world 是 apoc，畫面卻還是桌邊的（Codex 第二輪 B2）。
    slotsKey = ''; stage.invalidate();
    cancelAnimationFrame(coinRaf); coinRaf = 0; coinTarget = null; coinShown = null;
    for (const id of ['click-rate', 'passive-rate', 'click-next', 'training-next', 'click-level', 'training-level'])
      { const el = $(id); if (el) { el.title = ''; delete el.dataset.value; } }
    if (numberTimer) { clearTimeout(numberTimer); numberTimer = 0; }
    if (store.state.settings.world === 'apoc') { stage.stop(); apocUI?.enter(); apocMap?.open(); }
    else { apocMap?.close(); apocUI?.leave(); stage.setPartners(store.state); stage.render(store.state, { instant: true }); }
    changed(); status();
    if (store.state.pending || store.state.apoc?.pending) gacha.restore();
  }
  const card = window.GachaCard.create({ rarity: Pool.RARITY, byId: Pool.byId, canHover: () => gacha?.canHover() || !!album?.detailId || false, fatal: $('fatal'), tagFor: (entry, dup, owned) => {
    // 卡面右上角的標籤：末世的「星」就是張數，套桌邊的升星／熟練／萬用規則會寫出錯的東西
    //（同名卡在桌邊超越五時，末世的卡面會出現「萬用 +1」。Codex 第二輪 B7）
    if (apocMode()) return !owned ? { text: 'NEW', cls: 'new' } : { text: `★${owned} → ★${owned + 1}`, cls: 'star-up' };
    return E.tagFor(entry, dup, owned, store.state);
  } });
  // 保留供共用 rig 查找的結構 id；所有 url(#id) 素材引用則在每個 SVG 實例內唯一。
  let artSerial = 0;
  function isolateArt(svg) {
    if (!svg?.querySelectorAll) return svg;
    const ids = new Map();
    svg.querySelectorAll('defs [id]').forEach((el) => { const id = el.id, unique = `clicker-art-${++artSerial}-${id}`; ids.set(id, unique); el.id = unique; });
    svg.querySelectorAll('*').forEach((el) => {
      for (const attribute of [...el.attributes]) {
        let value = attribute.value;
        for (const [id, unique] of ids) value = value.replaceAll(`url(#${id})`, `url(#${unique})`).replaceAll(`url("#${id}")`, `url("#${unique}")`);
        if (attribute.name === 'href' || attribute.name === 'xlink:href') value = ids.has(value.slice(1)) && value.startsWith('#') ? `#${ids.get(value.slice(1))}` : value;
        if (value !== attribute.value) el.setAttribute(attribute.name, value);
      }
    });
    return svg;
  }
  const createArt = card.art.create, createCard = card.create;
  card.art.create = (entry) => isolateArt(createArt(entry));
  card.create = (...args) => { const el = createCard(...args); el.querySelectorAll('svg').forEach(isolateArt); return el; };
  async function main() {
    for (const id of ['close', 'error-close', 'recruit-window-close']) $(id).onclick = closeWindow;
    if (TAURI) for (const id of ['topbar', 'recruit-topbar']) $(id).onpointerdown = (e) => {
      if (e.button === 0 && !e.target.closest('button,select,label,input')) TAURI?.window.getCurrentWindow().startDragging().catch(() => {});
    };
    if (TAURI) {
      applyZoom(await TAURI.core.invoke('get_clicker_zoom').catch(() => 1)); fitWindow();
      // Rust 每次 show_clicker_window 都會發 clicker-zoom：拿它當「視窗已重新顯示」的訊號補跑 resume
      await TAURI.window.getCurrentWindow().listen('clicker-zoom', ({ payload }) => { jlog(`clicker-zoom ${payload}`); applyZoom(payload); fitWindow(); visible = true; resume(); });
    }
    if (!TAURI) {
      document.body.style.background = '#C9A46F';
      for (const id of ['close', 'error-close', 'recruit-window-close']) $(id).hidden = true;
      for (const id of ['topbar', 'recruit-topbar']) $(id).style.cursor = 'default';
      fitWindow();
    }
    if (!store.state) {
      $('game-content').inert = true; $('save-error').hidden = false; $('save-error-text').textContent = store.error.message;
      $('export-raw').onclick = () => { $('raw-save').value = store.raw ?? '(無法讀取原始資料)'; $('raw-save').hidden = false; $('raw-save').select(); };
      // 2026-09-08：這個畫面本來是死路——匯入鍵在 #stats 裡，而 #game-content 已經 inert 掉了，
      // 玩家拿到修好的存檔也貼不進去。所以救援入口一定要長在錯誤畫面自己身上。
      $('rescue-open').onclick = () => { $('rescue').hidden = false; $('rescue-text').focus(); };
      $('rescue-load').onclick = () => {
        const status = $('rescue-status');
        let parsed;
        try { parsed = JSON.parse($('rescue-text').value); }
        catch { status.textContent = '這段不是完整的存檔字串（JSON 解不開）'; return; }
        let next = null, note = '';
        try { next = window.ClickerSave.validate(parsed, Pool); }
        catch (err) {
          const fixed = window.ClickerSave.repair(parsed, Pool);          // 貼進來的那份也壞的話，一樣試著修
          if (!fixed) { status.textContent = `這份也讀不進來：${err.message}`; return; }
          next = fixed.state; note = `（自動修復，重置了：${fixed.applied.join('、')}）`;
        }
        try { localStorage.setItem(window.ClickerSave.KEY, JSON.stringify(next)); }
        catch (err) { status.textContent = `寫不進去：${err.message}`; return; }
        status.textContent = `讀進來了${note}，重新載入中…`;
        location.reload();
      };
      return;
    }
    await card.ready;
    await document.fonts.ready;
    await window.ClickerCutin.ready;
    window.ClickerScene.mount(store.state.settings.scene, store.state.package.index);
    stage = window.ClickerStage.create({ card, sound, format, showRoster, notice, tick: () => { settle(); changed(); }, thiefHit: () => action(() => { if (store.blocked || hiddenNow() || cutin?.active || gacha?.active) return; const r = E.thiefHit(store.state,Date.now()); if (commit(r.state)) { changed(); if (r.won) { stage.float(r.reward, true, {x:520,y:195}, {text:`零食小偷跑了！+${format(r.reward)}`}); notice(`零食小偷跑了！+${format(r.reward)}`); } } }) });
    cutin = window.ClickerCutin.create({card, stage, sound, done:changed});
    album = window.ClickerAlbum.create({ store, card, commit, changed, action, format, notice, sound, skillTip, homeFlag, stage, showRecommendations });
    prestigeUI = window.ClickerPrestigeUI.create({ store, card, commit, changed, action, format, notice, sound, stage, album });
    gacha = window.ClickerGacha.create({ store, card, commit, changed, format, notice,
      canOpen: () => !stage.bossBusy || store.state.boss?.gate !== undefined,   // v3：小王打到一半也能招募
      pauseStage() { cutin.stop(); stage.stop(); renderSlots(); },
      // 末世的舞台與技能格是 apocUI 在畫；1.0 的 stage／renderSlots 進去會對不上 DOM
      resumeStage() {
        if (apocMode()) { apocUI?.render(); return; }
        if (!hiddenNow() && !suspended) { stage.start(); stage.render(store.state, { instant: true }); }
        renderSlots();
      },
      joined(entries) { stage.join(store.state, entries); },
    });
    extras = window.ClickerExtras.create({ store, card, commit, changed, action, notice, format, sound, stage, reload, gacha, cutin });
    dragUI = window.ClickerDrag.create({ $, store, commit, changed, notice, sound, card, E, Pool });   // v3：夥伴列拖到技能槽
    teamUI = window.ClickerTeamUI.create({ $, store, commit, changed, action, notice, sound, card, E, B, Pool, format, drag: dragUI });
    apocUI = window.ClickerApocUI.create({ $, store, commit, changed, notice, format, card, sound, cutin,
      openRoster: (id) => showRoster(id), openTeam: () => teamUI?.open() });
    apocMap = window.ClickerApocMap.create({ $, apocUI, format, refit: () => fitStage() }); apocMap.bind();
    // 末世的主畫面是關卡地圖（使用者：「切換後就是之前做的關卡地圖」）；點站進去才是 1.0 那套戰鬥畫面
    if (store.state.settings.world === 'apoc') { apocUI.enter(); apocMap.open(); }
    document.querySelectorAll('button').forEach(el=>{if (!el.title) el.title=el.getAttribute('aria-label') || el.textContent.trim();});
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ['topbar','stage','shop','team'].map($).concat(document.querySelector('footer')).forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:i*60,fill:'backwards',easing:'ease-out'}));
    // ⚠ 夥伴列是兩個世界共用的節點：在末世重新整理時，這行會把末世已經畫好的夥伴列蓋成桌邊的隊伍
    //   （使用者 09-13 截圖：末世主畫面出現桌邊的夥伴、本輪當家、槽位）
    ready = true; gacha.setReady(); if (!apocMode()) stage.setPartners(store.state);
    if (!apocMode()) { offline(); stage.render(store.state, { instant: true }); }   // 末世沒有離線收益，不該出桌邊收據（Codex 第二輪 B4）
    changed(); status();
    if (store.state.pending || store.state.apoc?.pending) gacha.restore(); startTimers();   // 末世的結果存在 apoc.pending（Codex 複檢 2-1）
    cleanupPage();
    // 自動修復過就要講出來——不能默默把玩家的東西重置掉還裝作沒事。
    // 原本那份沒被覆蓋，留在 clicker_save_broken 底下。
    if (store.repaired) {
      notice(`存檔有一小塊壞掉，已自動修好（重置了：${store.repaired.applied.join('、')}）`);
      jlog(`save repaired: ${store.repaired.reason} → reset ${store.repaired.applied.join(',')}`);
    }
    // 落點一律換算成「遊戲座標」（960×640，舞台原點在 (16,72)）。
    // ⚠ 以前是拿 #game 的寬除以 960 換算——那只有橫式成立。直式 #game 是整個畫面（390 寬）、
    //   舞台是另外縮的 608 框，換算會整整放大 1.5 倍：實測三連包點第一、二包都會開到第三包。
    //   改成從 #stage 自己的盒子換算，橫式的數字一分不差（stage.left = game.left + 16×zoom，
    //   k = zoom，代回去就是原本的式子），直式也對。
    const pointOf = (e) => {
      const sb = $('stage').getBoundingClientRect(), k = sb.width / 608;
      if (!k) return null;
      return { x: 16 + (e.clientX - sb.left) / k, y: 72 + (e.clientY - sb.top) / k };
    };
    let pointer = null;
    $('tap').onpointerup = e => { pointer = pointOf(e); };
    $('tap').onpointercancel = () => { pointer = null; };
    $('tap').onclick = e => { const point = e.detail ? pointer : undefined; pointer = null; tap(point); };
    $('tap').onkeydown = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); } };
    // 三連包的三個子包熱區與禮包熱區：熱區互相重疊，落點以 point.x 最近的子包中心（380／442／504）為準
    // 王包本體：點罐頭等於點珍母（傷害全進王）
    { let hit = null; const bv = $('boss-view');
      bv.onpointerup = e => { hit = pointOf(e); };
      bv.onclick = e => { const point = e.detail ? hit : undefined; hit = null; if (store.state?.boss) tap(point); }; }
    const hotspots = [...document.querySelectorAll('.sub-hot'), $('gift-hot')];
    for (const hot of hotspots) {
      let hit = null;
      hot.onpointerup = e => { hit = pointOf(e); };
      hot.onpointercancel = () => { hit = null; };
      hot.onclick = e => {
        const point = e.detail ? hit : undefined; hit = null;
        if (hot.id === 'gift-hot') { tap(point, 'gift'); return; }
        const sub = point ? [380, 442, 504].map((cx, i) => [Math.abs(point.x - 16 - cx), i]).sort((a, b) => a[0] - b[0])[0][1] : Number(hot.dataset.sub);
        tap(point, sub);
      };
    }
    $('tap').onkeyup = (e) => { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); };
    for (const type of ['click', 'training']) {
      $(`${type}-one`).onclick = () => { if (apocMode()) return type === 'click' ? apocUI.buyTicket() : teamUI?.open(); upgrade(type, false); };
      $(`${type}-max`).onclick = () => { if (apocMode()) return; upgrade(type, true); };
    }
    // 共用設定（靜音／音樂／音量／演出）在末世不要順手跑桌邊結算——那會改到另一個世界的
    // 金額與進度（Codex 第三輪 B4）。設定本身兩個世界共用，這點沒變。
    const withSettings = (fn) => { const s = apocMode() ? E.clone(store.state) : E.settle(store.state, Date.now()).state; fn(s); return s; };
    $('mute').onclick = $('recruit-mute').onclick = () => action(() => {
      const s = withSettings(x => { x.settings.muted = !x.settings.muted; });
      if (commit(s)) { muteAudio(); changed(); }
    });
    $('music').onclick = () => action(() => {
      const s = E.clone(store.state); s.settings.music = !s.settings.music;
      if (commit(s)) changed();
    });
    const closeAudio = () => { $('audio-panel').hidden = true; $('audio-toggle').setAttribute('aria-expanded','false'); };
    $('audio-toggle').onclick = () => { const open = $('audio-panel').hidden; $('audio-panel').hidden = !open; $('audio-toggle').setAttribute('aria-expanded',String(open)); };
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.audio-controls')) closeAudio(); });
    for (const kind of ['music','sfx']) {
      const input = $(`${kind}-volume`);
      input.oninput = () => action(() => {
        const key = `${kind}Volume`;
        if (!volumeDrafts.has(key)) volumeDrafts.set(key,store.state.settings[key]);
        const s = E.clone(store.state); s.settings[key] = Number(input.value);
        store.stage(s); renderVolume(kind); muteAudio();
      });
      input.onchange = () => action(() => { volumeDrafts.delete(`${kind}Volume`); commit(); });
    }
    $('retry-save').onclick = () => { if (commit()) { if (!apocMode()) settle(); changed(); } };   // 末世不要跑桌邊結算與桌邊 stage.render（Codex 第三輪 B4）
    $('roster-open').onclick = () => showRoster();
    $('boss-challenge').onclick = () => action(()=>{ if (apocMode()) { apocUI.fight(); return; } if (stage.bossBusy || cutin.active || gacha.active) return; const now=Date.now(), p=E.bossPreview(store.state,now); if (!p) return; if (commit(p.kind==='gate' ? E.startGate(store.state,now) : E.startBoss(store.state,now))) changed(); });
    $('scene-open').title='選擇場景';
    $('scene-open').onclick = () => action(()=>{
      if (apocMode()) { apocMap.open(); return; }   // 末世沒有場景：這顆鍵在末世是「地圖」
      if (store.state.boss || stage.bossBusy || cutin.active) return;
      $('scene-tickets').replaceChildren();
      Object.entries(window.ClickerScenes).forEach(([id,scene],i)=>{
        const ticket=document.createElement('button'); ticket.className='scene-ticket'; ticket.dataset.scene=id;
        const thumb=document.createElement('span'); thumb.className='scene-thumb'; thumb.style.background=scene.palette.sky;
        const img=document.createElement('img'); img.src=`clicker-scene${i+1}-thumb.png`; img.alt=''; img.onerror=()=>{img.hidden=true;}; thumb.append(img);
        const text=document.createElement('span'), name=document.createElement('b'), status=document.createElement('small'); name.textContent=scene.name;
        const available=E.unlocked(store.state,id), current=store.state.settings.scene===id, markLocked=scene.requiresMark && !store.state.markShop?.[scene.requiresMark];
        status.textContent=current?'目前':available?'已解鎖':markLocked?'印記商店 5 印記解鎖':`${window.ClickerScenes[scene.unlock.boss].name}拆滿 ${scene.unlock.packages} 包並打贏${window.ClickerScenes[scene.unlock.boss].boss?.name || '大罐頭'}${scene.available===false?'（後續開放）':''}`;
        text.append(name,status); ticket.append(thumb,text);
        ticket.disabled=!available || current;
        ticket.onclick=()=>action(()=>{
          if(commit(E.switchScene(store.state,id,Date.now()))) {window.ClickerScene.mount(id); $('scenes-close').click(); changed();}
        });
        $('scene-tickets').append(ticket);
      });
      $('scenes').hidden=false; $('game-content').inert=true; $('scenes-close').focus();
    });
    // 「模式」：兩個主系統的大選項（使用者：「模式 是額外的大選項，切換後就是之前做的關卡地圖」）。
    //  跟場景分開——場景是桌邊裡的七站，模式是「玩桌邊還是玩末世」。
    $('mode-open').onclick = () => action(()=>{
      if (stage.bossBusy || cutin.active) return;
      const list = $('mode-list'); list.replaceChildren();
      const inApoc = apocMode();
      for (const m of [
        { id:'home', name:'珍母點點', desc:'桌邊拆零食包・七個場景', img:'clicker-scene1-thumb.png', locked:false },
        { id:'apoc', name:'末世', desc:store.state.apoc?.unlocked ? '二十站關卡地圖・精裝卡' : '打贏第七站的滅世珍獸解鎖', img:'clicker-boss7-mieshi.png', locked:!store.state.apoc?.unlocked },
      ]) {
        const b=document.createElement('button'); b.className='mode-card'; b.dataset.mode=m.id;
        const current = (m.id==='apoc')===inApoc;
        const thumb=document.createElement('span'); thumb.className='mode-thumb';
        const img=document.createElement('img'); img.src=m.img; img.alt=''; img.onerror=()=>{img.hidden=true;}; thumb.append(img);
        const text=document.createElement('span'), name=document.createElement('b'), small=document.createElement('small');
        name.textContent=m.name; small.textContent=current?'目前在玩':m.desc; text.append(name,small);
        b.append(thumb,text); b.disabled=current || m.locked;
        b.onclick=()=>action(()=>setWorld(m.id));
        list.append(b);
      }
      $('modes').hidden=false; $('game-content').inert=true; $('modes-close').focus();
    });
    $('modes-close').onclick=()=>{$('modes').hidden=true; $('game-content').inert=gacha.active; $('mode-open').focus();};
    // 兩個主系統的唯一切換點。切過去等同「重新整理」：面板全關、舞台重掛、存檔記住選的那個。
    function setWorld(world, scene) {
      const next = E.clone(store.state); next.settings = { ...next.settings, world };
      if (world === 'home' && scene && scene !== next.settings.scene) Object.assign(next, E.switchScene(next, scene, Date.now()));
      if (!commit(next)) return;
      for (const id of ['modes','scenes','roster','stats','wardrobe','prestige','team-editor','share','pick100']) $(id).hidden = true;
      album?.close?.(); $('game-content').inert = false;
      // ⚠ 兩套 renderer 共用同一組節點，各自有「內容沒變就不重畫」的快取。換世界時節點已經被
      //   另一套換掉了，快取卻還說有效 → 技能槽會找不到自己的 <small>（null.textContent）、
      //   夥伴列會留著上一個世界的頭像。所有共用節點的快取都要在這裡作廢。（Codex 複檢 1-1）
      slotsKey = ''; stage.invalidate();
      cancelAnimationFrame(coinRaf); coinRaf = 0; coinTarget = null; coinShown = null;   // 舊的金額動畫會把新世界的數字寫成 0（Codex 第三輪 A）
      // 收益文字也有快取（rate() 比對 title＋dataset.value），末世是直接寫 textContent 的，
      // 不清的話切回桌邊會留著末世的「戰力 744」（Codex 第二輪 B1）
      for (const id of ['click-rate', 'passive-rate', 'click-next', 'training-next', 'click-level', 'training-level'])
        { const el = $(id); if (el) { el.title = ''; delete el.dataset.value; } }
      if (numberTimer) { clearTimeout(numberTimer); numberTimer = 0; }
      if (world === 'apoc') { stage.stop(); apocUI.enter(); apocMap.open(); }
      else { apocMap.close(); apocUI.leave(); $('slots').replaceChildren(); window.ClickerScene.mount(store.state.settings.scene); stage.start(); }
      changed();
      // 目標世界如果有沒收下的抽卡結果，要在這裡恢復——不然招募鍵因 pending 被鎖、收下畫面又沒開，
      // 玩家只能重新載入（Codex 第三輪 B2）
      if (store.state.pending || store.state.apoc?.pending) gacha.restore(); else if (world !== 'apoc') $('tap').focus();
    }
    // 夥伴列的翻頁鍵在末世要翻末世的隊伍（桌邊的綁在 clicker-stage.js）
    for (const [id, dir] of [['buddy-prev', -1], ['buddy-next', 1]]) {
      const prev = $(id).onclick;
      $(id).onclick = (e) => { if (apocMode()) { apocUI.page(dir); return; } prev?.call($(id), e); };
    }
    $('apoc-ending-close').onclick = () => { $('apoc-ending').hidden = true; $('game-content').inert = gacha.active; $('tap').focus(); };
    $('scenes-close').onclick=()=>{$('scenes').hidden=true; $('game-content').inert=gacha.active; $('scene-open').focus();};
    for (const id of ['roster', 'stats', 'receipt', 'wardrobe', 'prestige']) $(`${id}-close`).onclick = () => { if (id === 'roster') album.close(); $(id).hidden = true; $('game-content').inert = gacha.active; $('tap').focus(); };
    $('prestige-open').onclick = () => { if (!cutin.active) prestigeUI.open(); };
    $('team-open').onclick = () => { if (!cutin.active) teamUI.open(); };
    $('memento-close').onclick = () => { $('memento').hidden = true; $('game-content').inert = false; };
    $('memento-open').onclick = () => { $('stats').hidden = true; mementoPage(); };
    $('wardrobe-open').onclick = () => { if (!cutin.active) album.openWardrobe(); };
    $('stats-open').onclick = () => { if (!cutin.active) extras.openWall(); };   // 第十二輪：統計面板改成徽章牆
  }
  window.addEventListener('clicker-music-ready', () => { if (suspended) window.ClickerMusic.suspend(); else window.ClickerMusic.sync(store.state); });
  document.addEventListener('visibilitychange', () => { jlog(`visibilitychange hidden=${document.hidden}`); visible = !document.hidden; if (!visible) suspend(); else resume(); });
  window.addEventListener('focus', () => { visible = true; resume(); });
  window.addEventListener('pagehide', suspend);
  if (!TAURI) window.addEventListener('beforeunload', suspend);
  // 直橫切換時招募演出的座標系整個換掉（960×640 ↔ 560×900），已經擺好的卡片會停在舊座標上。
  // 有 pending（結果已存、還沒收下）就照新版面把靜態總覽重建一次；演出進行中不動它。
  let wasPortrait = isPortrait();
  window.addEventListener('resize', () => {
    fitWindow();
    const now = isPortrait();
    // 末世的結果在 apoc.pending（Codex 第二輪 B3）
    if (now !== wasPortrait) { wasPortrait = now; if (gacha.active && (store.state?.pending || store.state?.apoc?.pending)) gacha.restore(); album?.relayout?.(); }
  });
  function closeTopPanel() {
    if (album?.escape()) return true;
    if (!$('prestige').hidden) { $('prestige-close').click(); return true; }
    if (!$('team-editor').hidden) { $('team-close').click(); return true; }
    if (!$('modes').hidden) { $('modes-close').click(); return true; }   // 漏列會掉進 closeWindow()（Codex 複檢 B4）
    if (!$('memento').hidden) { $('memento-close').click(); return true; }
    if (!$('reward').hidden) { $('reward-ok').click(); return true; }

    if (extras?.escape()) return true;
    if (!$('apoc-ending').hidden) { $('apoc-ending-close').click(); return true; }
    for (const id of ['scenes', 'roster', 'stats', 'receipt']) if (!$(id).hidden) { $(`${id}-close`).click(); return true; }
    return false;
  }
  document.addEventListener('pointerdown', e => {
    if (cutin?.active || !$('save-error').hidden) return;
    if (!['save-error', 'receipt', 'daily-done', 'prestige', 'wardrobe', 'roster', 'stats', 'scenes', 'share', 'pick100'].some(id => !$(id).hidden)) return;
    if (e.target.closest('.panel, .small-panel, #album-detail, #dust-shop, #recruit-layer, .audio-controls')) return;
    closeTopPanel();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('audio-panel').hidden) { $('audio-panel').hidden=true; $('audio-toggle').setAttribute('aria-expanded','false'); $('audio-toggle').focus(); e.preventDefault(); return; }
      if (cutin?.active) { e.preventDefault(); return; }
      if (closeTopPanel()) { e.preventDefault(); return; }
      // 招募層開著就只處理招募層，不要往下掉到 closeWindow()：
      // closeWindow() 會 suspend()（清掉卡面、藏起「收下」鍵），網頁版沒有視窗可關，
      // 結果就是停在一個沒有卡、沒有收下鍵、返回鍵又因為 pending 而停用的死畫面。
      // 有 pending 時 ESC 什麼都不做，跟「返回」鍵停用的規則一致。
      // 招募層開著就只處理招募層，不要往下掉到 closeWindow()：
      // closeWindow() 會 suspend()（清掉卡面、藏起「收下」鍵），網頁版沒有視窗可關，
      // 結果就是停在一個沒有卡、沒有收下鍵、返回鍵又因為 pending 而停用的死畫面。
      // 有 pending 時 ESC 什麼都不做，跟「返回」鍵停用的規則一致。
      if (gacha?.active) { if (!store.state.pending) gacha.close(); e.preventDefault(); return; }
      closeWindow();
    }
    if (e.key === 'Tab') {
      const panel = ['save-error', 'receipt', 'daily-done', 'prestige', 'wardrobe', 'roster', 'stats', 'scenes', 'share', 'pick100', 'recruit-layer'].map($).find((el) => !el.hidden);
      if (!panel) return;
      const focusable = [...panel.querySelectorAll('button,select,textarea')].filter((el) => !el.disabled && !el.hidden && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
    }
  });
  document.addEventListener('click', e => { if (cutin?.active && e.target.closest('#draw-one,#draw-five,#recruit-open')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  main().catch((err) => { console.error(err); $('fatal').hidden = false; $('fatal').textContent = `珍母點點初始化失敗：${err.message}`; });
  // repaired：這次載入有沒有自動修復過（{applied:[重置了哪些], reason:原本的錯誤}）。
  // 浮動訊息 1.4 秒就消失，驗收與客服要問「到底修了什麼」得看這裡。
  return { get state() { return store.state; }, get extras() { return extras; }, get repaired() { return store.repaired; }, get drag() { return dragUI?.state; }, get apocReady() { return !!apocUI; }, get world() { return store.state?.settings.world; } };
})();
