// 夥伴卡冊（取代名冊）：翻頁卡冊 → 點卡進展示頁（升階／超越／裝備）→ 粉塵罐兌換；更衣室（點擊音效／特效）。
// 卡面沿用共用 GachaCard（框色依「目前階」）；hover 3D 傾斜由 GachaCard 的 live 機制處理。
window.ClickerAlbum = (() => {
  function create({ store, card, commit, changed, action, format, notice, sound, skillTip, homeFlag, stage, showRecommendations }) {
    const $ = id => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, Pool = window.GachaPool;
    const CHAR_IDS = Pool.CHARACTER_IDS.filter(id => B.characters[id]).sort((a,b) => E.origin(a)-E.origin(b)), PER_PAGE = 4;
    // v3：收藏卡（魔花少女）擁有時排在最後一頁；沒有戰力、不編隊、不升星
    const allIds = () => [...CHAR_IDS, ...((store.state?.collectibles) || []).filter(id => Pool.byId[id])];
    let IDS = allIds(); let PAGES = Math.ceil(IDS.length / PER_PAGE);
    const isCollect = id => Pool.byId[id]?.kind === 'collect';
    // 橫式一次看跨頁（兩頁），直式一次一頁。sheet 是「目前這一翻」的索引，sheets 是總翻數。
    const wide = () => !matchMedia('(max-aspect-ratio: 3/4)').matches;
    const sheets = () => wide() ? Math.ceil(PAGES / 2) : PAGES;
    const sheet = () => wide() ? Math.floor(page / 2) : page;
    const RAR = { rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' }, ORIGIN = ['精良', '史詩', '傳說', '神話'];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let shopCategory = null;   // 商店：null = 分類頁，否則是 'sounds'／'fx'／'decor'
    // page 是「單頁」索引（0..PAGES-1），才是真正的位置。橫式一次翻兩頁（跨頁），
    // 直式一次一頁——390 寬塞不下兩頁，硬塞的話一張卡只剩不到 90px。
    // 用單頁當基準，直橫切換時只要重畫就會落在同一批角色上，不會跳頁。
    let page = 0, targetSlot = null, detailId = null, blinkTimer = 0, flipping = false, pendingBuy = null, refreshKey = '';
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

    // ---------- 共用零件 ----------
    function starRow(s, id) {
      const n = E.stars(E.dust(s, id)), t = s.transcend?.[id] || 0, row = document.createElement('div'); row.className = E.rarity(s,id) === 'mythic' ? 'star-row mythic-stars' : 'star-row';
      for (let i = 0; i < n; i++) { const img = new Image(); img.src = i < t ? 'clicker-star-gem.png' : 'clicker-star.png'; img.alt = ''; img.className = i < t ? 'gem' : ''; row.append(img); }
      row.setAttribute('aria-label', `${n} 星${t ? `・超越 ${t}` : ''}`); return row;
    }
    function nextStep(s, id) {
      if (!s.collection[id]) return '尚未招募';
      const d = E.dust(s, id), st = E.stars(d);
      if (st < 5) return `升星 ${d}/${B.stars[st]}`;
      if (E.tier(s, id) < 2) return `升階 ${E.availableDust(s, id)}/${E.promotionCost(s, id)}`;
      const t = s.transcend?.[id] || 0;
      return t < 5 ? `超越 ${E.availableDust(s, id)}/${E.transcendCost(s, id)}` : '滿養';
    }
    function tierName(s, id) {
      const cur = E.rarity(s, id), o = ORIGIN[E.origin(id)], t = s.transcend?.[id] || 0;
      return `${RAR[cur]}${cur !== Pool.byId[id].rarity ? `（${o}出身）` : ''}${t ? `・超越 ${t}` : ''}${t === 5 ? '・覺醒' : ''}`;
    }
    function makeCard(s, id) {
      if (isCollect(id)) { const el = card.create({ ...Pool.byId[id] }, { tag: false }); el.classList.add('flipped', 'album-card', 'collect'); return el; }
      const el = card.create({ ...Pool.byId[id], rarity: E.rarity(s, id) }, { tag: false });
      el.classList.add('flipped', 'album-card'); el.classList.toggle('locked', !s.collection[id]); el.classList.toggle('awakened', s.transcend?.[id] === 5);
      if (!s.collection[id]) { const q = document.createElement('b'); q.className = 'album-unknown'; q.textContent = '?'; el.append(q); }
      return el;
    }

    // ---------- 卡冊 ----------
    function refreshTrainAll() {
      const s = store.state, P = window.ClickerPrestige;
      const ids = CHAR_IDS.filter(id => s.collection[id] && (s.partnerLevels?.[id] || 0) < P.PARTNER_CAP);
      const cost = ids.reduce((sum,id) => sum + P.trainCost(s.partnerLevels?.[id] || 0, id), 0);
      $('train-all').disabled = !ids.length || s.coins < cost || store.blocked;
      $('train-all').textContent = !ids.length ? '平均訓練（無可訓練夥伴）' : `平均訓練（${s.coins < cost ? '需' : '約'} ${format(cost)} 幣）`;
    }
    function renderBook(instant = false) {
      const s = store.state; if (!s) return;
      IDS = allIds(); PAGES = Math.ceil(IDS.length / PER_PAGE);
      refreshTrainAll();
      $('dust-count').textContent = s.universalDust || 0;
      // v3 編隊摘要：隊伍 n/20 與前綴上限（出身算層）；派遣到期就出「收回」鍵
      const team = E.rosterOf(s), counts = E.rosterCounts(team), lim = B.V3.ROSTER_LIMITS, due = (s.dispatch || []).filter(d => d.until <= Date.now()).length;
      $('team-summary').innerHTML = `隊伍 <b>${team.length}/20</b>（神 ${counts[0]}/${lim[0]}・傳 ${counts[1]}/${lim[1]}・史 ${counts[2]}/${lim[2]}）${s.roster?.length ? '' : '・自動編隊'}`;
      $('team-summary').title = '只有隊伍裡的夥伴產錢；上限用出身算（升階不改層）；隊外的夥伴可以派遣 4 小時換粉塵';
      $('recall-all').hidden = !due; $('recall-all').textContent = `收回派遣（${due}）`;
      const sh = sheet(), n = sheets();
      $('album-page').textContent = `${sh + 1} / ${n}`;
      $('album-prev').disabled = sh === 0; $('album-next').disabled = sh + 1 >= n;
      const faces = wide() ? [['album-left', sh * 2], ['album-right', sh * 2 + 1]] : [['album-left', sh]];
      if (!wide()) $('album-right').replaceChildren();
      faces.forEach(([pageId, face]) => {
        const el = $(pageId); el.replaceChildren();
        el.dataset.canFlip = String(pageId === 'album-left' ? sh > 0 : sh + 1 < n);
        IDS.slice(face * PER_PAGE, face * PER_PAGE + PER_PAGE).forEach(id => {
          const slot = document.createElement('button'); slot.className = 'album-slot'; slot.dataset.id = id; slot.type = 'button';
          if (isCollect(id)) { slot.setAttribute('aria-label', `${Pool.byId[id].name}・收藏卡`); slot.title = '收藏卡・絕版'; slot.append(makeCard(s, id)); const meta = document.createElement('div'); meta.className = 'album-meta'; const line = document.createElement('small'); line.textContent = '收藏卡・絕版'; meta.append(line); slot.append(meta); slot.onclick = () => openDetail(id); el.append(slot); return; }
          const hint = `${Pool.byId[id].name}・${s.collection[id] ? `粉塵 ${format(E.dust(s, id))} 顆・` : ''}${nextStep(s, id)}`;
          slot.setAttribute('aria-label', hint); slot.title = hint;
          slot.append(makeCard(s, id));
          const meta = document.createElement('div'); meta.className = 'album-meta';
          meta.append(starRow(s, id));
          const line = document.createElement('small'); line.textContent = s.collection[id] ? nextStep(s, id) : '？？？'; meta.append(line);
          if (s.skillSlots.includes(id)) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp'; stamp.textContent = `槽${s.skillSlots.indexOf(id) + 1}`; slot.append(stamp); }
          else if (team.includes(id)) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp team-stamp'; stamp.textContent = '隊'; slot.append(stamp); }
          else if (E.dispatched(s, id)) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp away-stamp'; stamp.textContent = '派'; slot.append(stamp); }
          if (E.champion(s, id)) { const flag = document.createElement('i'); flag.className = 'champ-flag'; flag.textContent = '本輪當家'; slot.append(flag); }
          slot.append(meta); slot.onclick = () => openDetail(id);
          el.append(slot);
        });
      });
    }
    function flip(dir) {
      if (flipping) return; const next = sheet() + dir; if (next < 0 || next >= sheets()) return;
      page = wide() ? next * 2 : next;
      if (reduced.matches) { renderBook(); return; }
      flipping = true;
      // 直式只有左頁，出去與進來都是同一片
      const outEl = $(wide() && dir > 0 ? 'album-right' : 'album-left');
      outEl.animate([{ transform: 'rotateY(0)' }, { transform: `rotateY(${dir > 0 ? -90 : 90}deg)` }], { duration: 120, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
        renderBook(); sound('page');
        const incoming = $(wide() && dir < 0 ? 'album-right' : 'album-left');
        incoming.animate([{ transform: `rotateY(${dir > 0 ? 90 : -90}deg)` }, { transform: 'rotateY(0)' }], { duration: 120, easing: 'ease-out' }).finished.then(() => { outEl.getAnimations().forEach(a => a.cancel()); flipping = false; }).catch(() => { flipping = false; });
      }).catch(() => { flipping = false; });
    }
    function open(selected = null, slot = null) {
      targetSlot = slot; $('recommendations')?.remove();
      $('roster').hidden = false; $('game-content').inert = true;
      renderBook(true); refreshKey = '';
      if (selected) openDetail(selected); else { closeDetail(true); $('roster-close').focus(); }
    }
    function close() {
      closeDetail(true); closeDustShop(); $('recommendations')?.remove();
      $('roster').hidden = true;
    }

    // ---------- 展示頁 ----------
    // stateKey 裡有 detailId，所以「打開詳細頁」這件事本身一定會讓 key 變掉，
    // 下一個 tick 就會重建一次、把剛播完的進場動畫從頭重播——這就是使用者看到的
    // 「剛點開卡面會閃一下」與「卡片抽動」（實測：+0ms 開始、+145ms 完成、+222ms 整個歸零重來）。
    // 所以開完之後要自己把 refreshKey 對齊，讓那一次多餘的重建不要發生。
    function stateKey() {
      const s = store.state;
      return JSON.stringify([s.collection, s.dust, s.universalDust, s.promotions, s.transcend, s.skillSlots, s.partnerLevels, s.owned?.wardrobe, s.settings.clickSound, s.settings.clickFx, s.deco, s.coins >= E.wardrobePrice(s), s.coins >= window.ClickerPrestige.decoPrice(s), detailId && !isCollect(detailId) && s.coins >= window.ClickerPrestige.trainCost(s.partnerLevels?.[detailId] || 0, detailId)]);
    }
    function openDetail(id, animate = true) {
      const s = store.state; detailId = id; closeDustShop();
      const root = $('album-detail'); root.replaceChildren(); root.hidden = false;
      const left = document.createElement('div'); left.className = 'detail-left';
      const big = makeCard(s, id); big.classList.add('detail-card'); left.append(big);
      const right = document.createElement('div'); right.className = 'detail-right';
      const h = document.createElement('h3'); h.textContent = Pool.byId[id].name; right.append(h);
      if (isCollect(id)) {   // 收藏卡：只有說明與返回
        const tier = document.createElement('div'); tier.className = 'detail-tier'; tier.textContent = '特別・收藏卡'; right.append(tier);
        const info = document.createElement('div'); info.className = 'detail-info';
        for (const [k, v] of [['來歷', '大掃除之前就換過桌布的老玩家才有；絕版，之後沒有任何取得方式'], ['戰力', '沒有。不編隊、不升星、不派遣，純收藏'], ['原型', '禮物卡「魔花少女」，精裝版的全息卡面在末世'] ]) { const r = document.createElement('p'); const b = document.createElement('b'); b.textContent = k; const span = document.createElement('span'); span.textContent = v; r.append(b, span); info.append(r); }
        right.append(info);
        const back = document.createElement('button'); back.className = 'detail-back'; back.textContent = '回到卡冊'; back.onclick = () => closeDetail(); right.append(back);
        root.append(left, right); big.style.transform = 'scale(1.15)'; refreshKey = stateKey(); return;
      }
      const tier = document.createElement('div'); tier.className = 'detail-tier'; tier.textContent = tierName(s, id); right.append(tier);
      right.append(starRow(s, id));
      const owned = !!s.collection[id];
      const info = document.createElement('div'); info.className = 'detail-info';
      const def = B.characters[id];
      const rows = [
        ['被動', owned ? `每秒 ${format(E.individual(s, id))}${E.affinity(s, id) ? '（當家 ×1.5）' : ''}` : `每秒 ${format(def.base)}（招募後）`],
        [def.skill, skillTip(s, id).replace(/\n/g, '\n')],
        ['粉塵', owned ? `持有 ${E.dust(s, id)} 顆・可用 ${E.availableDust(s, id)} 顆・${nextStep(s, id)}` : '尚未招募'],
      ];
      if (def.trait) rows.push(['特質', `裝備時攻擊力 ×${E.skillAt(s,id).trait.clickMul}`]);
      for (const bond of B.bonds.filter(b => b.pair.includes(id))) rows.push(['羈絆', bond.pair.every(k => s.collection[k]) ? `${bond.name}・已生效` : `${bond.name}・需要 ${bond.pair.filter(k => !s.collection[k]).map(k => Pool.byId[k].name).join('、')}`]);
      const home = Object.entries(window.ClickerScenes).filter(([, sc]) => (sc.affinity || []).includes(id)).map(([, sc]) => sc.name);
      if (home.length) rows.push(['當家', `${home.join('、')}：收益 ×1.5、冷卻 −20%`]);
      if (E.champion(s, id)) rows.push(['本輪當家', '這一輪收益 ×1.5、冷卻 −20%；換桌布會重抽']);
      const inTeam = E.rosterOf(s).includes(id), away = E.dispatched(s, id), job = (s.dispatch || []).find(d => d.id === id);
      if (owned) rows.push(['編隊', inTeam ? '在隊伍裡（產錢、可裝技能）' : away ? `派遣中，${Math.max(0, Math.ceil((job.until - Date.now()) / 60000))} 分鐘後回來` : '不在隊伍（不產錢；可以派遣）']);
      for (const [k, v] of rows) { const r = document.createElement('p'); const b = document.createElement('b'); b.textContent = k; const span = document.createElement('span'); span.textContent = v; r.append(b, span); info.append(r); }
      right.append(info);
      const buttons = document.createElement('div'); buttons.className = 'detail-buttons';
      for (let i = 0; i < s.skillSlots.length; i++) {
        const btn = document.createElement('button'), occupied = s.skillSlots.indexOf(id);
        btn.textContent = i >= E.slotCount(s) ? `槽${i + 1} 未開` : occupied === i ? `已在槽 ${i + 1}` : `裝備至槽 ${i + 1}`;
        btn.disabled = !owned || i >= E.slotCount(s) || occupied >= 0 || store.blocked || !inTeam;
        if (owned && !inTeam && occupied < 0) btn.title = '要先編入隊伍';
        btn.classList.toggle('target-slot', targetSlot === i);
        btn.onclick = () => action(() => { if (commit(E.equip(store.state, i, id, Date.now()))) { changed(); notice(`${Pool.byId[id].name} 裝備至槽 ${i + 1}，等待 30 秒`); openDetail(id); renderBook(); } });
        buttons.append(btn);
      }
      const grow = document.createElement('div'); grow.className = 'detail-grow';
      const canPromote = owned && E.tier(s, id) < 2, canTranscend = owned && E.tier(s, id) >= 2 && (s.transcend?.[id] || 0) < 5;
      const five = owned && E.stars(E.dust(s, id)) >= 5;
      const promote = document.createElement('button'); promote.className = 'grow-btn promote';
      promote.textContent = canPromote ? `升階（${E.availableDust(s, id)}/${E.promotionCost(s, id)} 顆）` : E.tier(s, id) >= 2 ? `已是${RAR[E.rarity(s,id)]}階` : '升階';
      promote.disabled = !canPromote || !five || E.availableDust(s, id) < E.promotionCost(s, id) || store.blocked;
      promote.title = !five ? '要 5★ 才能升階' : '';
      promote.onclick = () => action(() => { if (commit(E.promote(store.state, id, Date.now()))) { changed(); celebrate(big, 'promote'); notice(`${Pool.byId[id].name} 升階為${RAR[E.rarity(store.state, id)]}！`); later(() => { openDetail(id); renderBook(); }, 700); } });
      const trans = document.createElement('button'); trans.className = 'grow-btn transcend';
      const t = s.transcend?.[id] || 0;
      trans.textContent = canTranscend ? `超越 ${t + 1}（${E.availableDust(s, id)}/${E.transcendCost(s, id)} 顆）` : t === 5 ? '超越五・覺醒' : '超越（要傳說階）';
      trans.disabled = !canTranscend || !five || E.availableDust(s, id) < E.transcendCost(s, id) || store.blocked;
      trans.onclick = () => action(() => { if (commit(E.transcend(store.state, id, Date.now()))) { changed(); celebrate(big, store.state.transcend[id] === 5 ? 'awaken' : 'transcend'); notice(`${Pool.byId[id].name} 超越 ${store.state.transcend[id]}！`); later(() => { openDetail(id); renderBook(); }, 900); } });
      grow.append(promote, trans);
      // 夥伴個別訓練：每級 +1 倍（CC 建築），10/25/50/100/150/200 收益 ×2；25/50/75/100 給技能副軸
      const P = window.ClickerPrestige, L = s.partnerLevels?.[id] || 0, ms = P.nextMilestone(L), om = E.PARTNER_MILESTONES.find(m => L < m), CAP = P.PARTNER_CAP;
      const train = document.createElement('button'); train.className = 'grow-btn train';
      train.textContent = owned ? (L >= CAP ? `訓練 Lv.${CAP}（滿）` : `訓練 Lv.${L}（${format(P.trainCost(L, id))} 幣）`) : '訓練（招募後）';
      train.title = `每級被動 +1 倍（現在 ×${format(E.partnerMul(L))}）` + (om ? `・Lv.${om} 收益 ×2` : '') + (ms ? `・Lv.${ms} 技能：${{25:'次數 +1／持續 +2 秒',50:'持續 +2 秒',75:'冷卻 −5%',100:'效果 ×1.1'}[ms]}` : '');
      train.disabled = !owned || L >= CAP || s.coins < P.trainCost(L, id) || store.blocked;
      train.onclick = () => action(() => { const r = P.train(store.state, id, Date.now()); if (commit(r.state)) { changed(); sound('upgrade'); if (!reduced.matches) big.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1.19)', offset: .5 }, { transform: 'scale(1.15)' }], { duration: 100 }); if ([10,25,50,75,100,150,200].includes(store.state.partnerLevels[id])) { celebrate(big, 'promote'); notice(`${Pool.byId[id].name} 訓練里程碑 ${store.state.partnerLevels[id]}！`); } openDetail(id); } });
      const trainMax = document.createElement('button'); trainMax.className = 'grow-btn train'; trainMax.textContent = '最多'; trainMax.disabled = train.disabled;
      trainMax.onclick = () => action(() => { const r = P.train(store.state, id, Date.now(), true); if (commit(r.state)) { changed(); sound('upgrade'); notice(`${Pool.byId[id].name} 訓練 +${r.levels} 級`); openDetail(id); } });
      grow.append(train, trainMax);
      // v3：編入／移出隊伍、派遣／收回（DESIGN-balance-v3 §三、§六）
      const teamRow = document.createElement('div'); teamRow.className = 'detail-grow team-row';
      const teamBtn = document.createElement('button'); teamBtn.className = 'grow-btn team';
      teamBtn.textContent = !owned ? '編隊（招募後）' : inTeam ? '移出隊伍' : away ? '派遣中' : '編入隊伍';
      teamBtn.disabled = !owned || away || store.blocked;
      if (owned && !inTeam && !away && E.rosterViolations([...E.rosterOf(s), id]).length && E.rosterOf(s).length < 20) teamBtn.title = '這個階級的格子滿了（上限用出身算），先移出一張';
      teamBtn.onclick = () => action(() => {
        const cur = E.rosterOf(store.state); let next;
        if (inTeam) next = cur.filter(x => x !== id);
        else { next = [...cur, id]; if (next.length > 20 || E.rosterViolations(next).length) { notice(next.length > 20 ? '隊伍已滿 20 張，先移出一張' : '這個階級的格子滿了，先移出一張'); return; } }
        if (commit(E.setRoster(store.state, next, Date.now()))) { changed(); notice(inTeam ? `${Pool.byId[id].name} 離開隊伍` : `${Pool.byId[id].name} 編入隊伍`); openDetail(id); renderBook(); }
      });
      const goBtn = document.createElement('button'); goBtn.className = 'grow-btn dispatch';
      const slotsUsed = (s.dispatch || []).length, V = B.V3;
      goBtn.textContent = !owned ? '派遣（招募後）' : away ? (job.until <= Date.now() ? '回來了・收回' : '派遣中') : inTeam ? '派遣（要先離隊）' : `派遣 4 小時（${slotsUsed}/${V.DISPATCH_SLOTS}）`;
      goBtn.disabled = !owned || inTeam || (away && job.until > Date.now()) || (!away && slotsUsed >= V.DISPATCH_SLOTS) || store.blocked;
      goBtn.title = '回來給這位夥伴的粉塵 1 顆（傳說／神話半顆）＋萬用粉塵 1 顆；每天最多收 9 次';
      goBtn.onclick = () => action(() => {
        if (away) { const r = E.recall(store.state, Date.now()); if (commit(r.state)) { changed(); sound('transcend'); notice(`收回派遣：${r.rewards.filter(x => !x.capped).length} 位帶粉塵回來${r.rewards.some(x => x.capped) ? '（今天已達 9 次上限）' : ''}`); openDetail(id); renderBook(); } }
        else if (commit(E.dispatch(store.state, id, Date.now()))) { changed(); notice(`${Pool.byId[id].name} 出發了，4 小時後回來`); openDetail(id); renderBook(); }
      });
      teamRow.append(teamBtn, goBtn); grow.after(teamRow);
      if (owned) rows.push(['訓練', `Lv.${L}・被動 +${5 * L}%${ms ? `・下一里程碑 ${ms}` : ''}`]);
      right.append(buttons, grow, teamRow);
      for (const [dir,label] of [[-1,'上一位'],[1,'下一位']]) { const nav = document.createElement('button'), index = IDS.indexOf(id)+dir; nav.textContent = label; nav.disabled = index < 0 || index >= IDS.length; nav.onclick = () => openDetail(IDS[index]); buttons.append(nav); }
      const back = document.createElement('button'); back.className = 'detail-back'; back.textContent = '回到卡冊'; back.onclick = () => closeDetail(); right.append(back);
      root.append(left, right);
      if (animate && !reduced.matches) big.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.17,.89,.32,1.28)', fill: 'forwards' });
      else big.style.transform = 'scale(1.15)';
      startBlink(big);
      if (animate) back.focus();
      refreshKey = stateKey();   // 對齊，免得下一個 tick 又重建一次
    }
    function closeDetail(instant = false) {
      stopBlink(); detailId = null; refreshKey = stateKey(); const root = $('album-detail'); if (root.hidden) return;
      if (instant || reduced.matches) { root.hidden = true; root.replaceChildren(); return; }
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).finished.then(() => { root.hidden = true; root.replaceChildren(); }).catch(() => { root.hidden = true; });
      $('roster-close').focus();
    }
    // 展示中的本尊會呼吸與眨眼（這是「展示中」不是閒置）
    function startBlink(big) {
      stopBlink(); const svg = big.querySelector('.face-art svg'); if (!svg) return;
      const open = svg.querySelector('#eyes-open'), shut = svg.querySelector('#eyes-closed');
      if (!open || !shut) return;
      const tick = () => { blinkTimer = setTimeout(() => { open.style.display = 'none'; shut.style.display = ''; later(() => { open.style.display = ''; shut.style.display = 'none'; }, 130); tick(); }, 2500 + Math.random() * 3500); };
      tick();
    }
    function stopBlink() { clearTimeout(blinkTimer); blinkTimer = 0; }
    function celebrate(big, kind) {
      sound(kind === 'promote' ? 'promote' : 'transcend');
      if (reduced.matches) return;
      big.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1.24)', offset: .4 }, { transform: 'scale(1.15)' }], { duration: 260, easing: 'ease-out' });
      const flash = document.createElement('div'); flash.className = 'detail-flash'; $('album-detail').append(flash);
      flash.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 320, easing: 'ease-out' }).finished.then(() => flash.remove()).catch(() => flash.remove());
      const stars = $('album-detail').querySelectorAll('.detail-right .star-row img');
      stars.forEach((img, i) => img.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)', offset: .5 }, { transform: 'scale(1)' }], { duration: 260, delay: i * 40 }));
      if (kind === 'awaken') stage?.confetti?.('gold');
    }

    // ---------- 粉塵罐：萬用粉塵 → 指定角色 ----------
    // keep：兌換後重畫時要留住捲動位置與焦點。整份 replaceChildren 會把 .dust-list 的
    // scrollTop 歸零、back.focus() 又把焦點搶走，於是每按一次「+1」畫面就跳回最上面、
    // 還要重新找那一列（2026-09-08 使用者回報「不方便兌換」）。
    function openDustShop(keep = null) {
      const s = store.state, root = $('dust-shop');
      const scrollTop = keep ? (root.querySelector('.dust-list')?.scrollTop || 0) : 0;
      root.replaceChildren(); root.hidden = false;
      const h = document.createElement('h3'); h.textContent = `萬用粉塵 ${s.universalDust || 0} 顆`; root.append(h);
      const hint = document.createElement('p'); hint.textContent = '兌換成指定夥伴的粉塵：精良 1:1、史詩 2:1、傳說 3:1。萬用粉塵來自每隻王首勝、每日一包與滿養夥伴的重複卡。'; root.append(hint);
      const list = document.createElement('div'); list.className = 'dust-list';
      for (const id of CHAR_IDS) {
        const row = document.createElement('div'); row.className = 'dust-row'; const rate = E.exchangeRate(id);
        row.append(card.art.create(Pool.byId[id]));
        const name = document.createElement('b'); name.textContent = `${Pool.byId[id].name}`; row.append(name);
        const have = document.createElement('small'); have.textContent = s.collection[id] ? `${E.dust(s, id)} 顆・${nextStep(s, id)}` : '尚未招募'; row.append(have);
        for (const n of [1, 5]) {
          const btn = document.createElement('button'); btn.textContent = `+${n}（${rate * n}）`;
          btn.disabled = !s.collection[id] || (s.universalDust || 0) < rate * n || s.transcend?.[id] === 5 || store.blocked;
          btn.dataset.dust = `${id}:${n}`;
          btn.onclick = () => action(() => { if (commit(E.exchange(store.state, id, rate * n, Date.now()))) { changed(); sound('upgrade'); openDustShop({ id, n }); renderBook(); } });
          row.append(btn);
        }
        list.append(row);
      }
      root.append(list);
      const back = document.createElement('button'); back.textContent = '關上罐子'; back.onclick = closeDustShop; root.append(back);
      if (keep) {
        list.scrollTop = scrollTop;
        // 焦點回到剛才按的那顆；它按到買不起變成 disabled 時，退回同一列的另一顆，都不行才收在「關上罐子」
        const same = root.querySelector(`[data-dust="${keep.id}:${keep.n}"]`);
        const other = root.querySelector(`[data-dust^="${keep.id}:"]:not([disabled])`);
        (same && !same.disabled ? same : other || back).focus({ preventScroll: true });
        list.scrollTop = scrollTop;
      } else back.focus();
    }
    function closeDustShop() { const root = $('dust-shop'); root.hidden = true; root.replaceChildren(); }

    // ---------- 更衣室 ----------
    const SHOP_CATS = [
      { id:'sounds', icon:'♪', name:'點擊音效', hint:'換拆包的聲音' },
      { id:'fx',     icon:'✦', name:'點擊特效', hint:'換點下去的粒子' },
      { id:'decor',  icon:'❀', name:'桌面裝飾', hint:'每件全隊 +1%' },
    ];
    function renderShopCats() {
      const s = store.state, host = $('shop-cats'); host.replaceChildren();
      for (const cat of SHOP_CATS) {
        const owned = cat.id === 'decor' ? s.deco.length : B.wardrobe[cat.id].filter(i => s.owned.wardrobe.includes(`${cat.id}:${i.id}`)).length;
        const total = cat.id === 'decor' ? B.decor.length : B.wardrobe[cat.id].length;
        const extra = cat.id === 'decor' ? `擺出來 ${(s.decoShown || []).length} 件` : '';
        const t = document.createElement('button'); t.className = 'shop-cat'; t.dataset.cat = cat.id;
        t.innerHTML = `<span class="shop-cat-icon">${cat.icon}</span>`
          + `<span class="shop-cat-text"><b>${cat.name}</b><small>${cat.hint}</small></span>`
          + `<span class="shop-cat-count"><b>${owned}</b> / ${total}${extra ? `<br>${extra}` : ''}</span>`;
        t.onclick = () => { shopCategory = cat.id; pendingBuy = null; renderWardrobe(); };
        host.append(t);
      }
    }
    function renderWardrobe() {
      const s = store.state, price = E.wardrobePrice(s);
      // 分類頁／分類內容兩態切換
      const inCat = !!shopCategory;
      $('shop-cats').hidden = inCat; $('wardrobe-body').hidden = !inCat; $('shop-back').hidden = !inCat;
      $('shop-title').textContent = inCat ? SHOP_CATS.find(c => c.id === shopCategory).name : '商店';
      $('wardrobe-price').textContent = inCat && shopCategory !== 'decor' ? `每件 ${format(price)} 幣` : '';
      $('shop-hint').textContent = !inCat ? '挑一個分類逛逛。買過的永久保留。'
        : shopCategory === 'decor' ? '按兩次購買。買了就算 +1%，要不要擺在桌上另外用「擺出來」切換。'
        : '點一下試用；已擁有的再點就穿上，未擁有的按兩次購買。';
      for (const col of document.querySelectorAll('.wardrobe-col')) col.hidden = col.dataset.cat !== shopCategory;
      if (!inCat) { renderShopCats(); return; }
      const scrolls = [...document.querySelectorAll('.wardrobe-col')].map(el => [el,el.scrollTop]);
      renderDecor();
      for (const kind of ['sounds', 'fx']) {
        const col = $(`wardrobe-${kind}`); col.replaceChildren();
        const wearing = s.settings[kind === 'sounds' ? 'clickSound' : 'clickFx'];
        for (const item of B.wardrobe[kind]) {
          const key = `${kind}:${item.id}`, owned = s.owned.wardrobe.includes(key);
          const btn = document.createElement('button'); btn.className = 'wardrobe-item'; btn.dataset.key = key;
          btn.classList.toggle('owned', owned); btn.classList.toggle('wearing', wearing === item.id);
          const icon = document.createElement('span'); icon.className = 'wardrobe-icon'; icon.textContent = kind === 'sounds' ? '♪' : '✦'; if (item.color) icon.style.color = item.color;
          const name = document.createElement('b'); name.textContent = item.name;
          const status = document.createElement('small'); status.textContent = wearing === item.id ? '穿著中' : owned ? '穿上' : pendingBuy === key ? `確定 ${format(price)}？` : format(price);
          btn.append(icon, name, status);
          btn.disabled = store.blocked || (!owned && s.coins < price);
          btn.onclick = () => action(() => {
            preview(kind, item);
            if (owned) { if (wearing !== item.id && commit(E.wardrobe(store.state, kind, item.id, true, Date.now()))) { changed(); notice(`已換上「${item.name}」`); } pendingBuy = null; renderWardrobe(); return; }
            if (pendingBuy !== key) { pendingBuy = key; renderWardrobe(); return; }
            pendingBuy = null;
            if (commit(E.wardrobe(store.state, kind, item.id, false, Date.now()))) { sound('upgrade'); changed(); notice(`買下「${item.name}」，已自動穿上`); if (commit(E.wardrobe(store.state, kind, item.id, true, Date.now()))) changed(); }
            renderWardrobe();
          });
          col.append(btn);
        }
      }
      for (const [el,top] of scrolls) el.scrollTop = top;
    }
    // 桌面裝飾（第十三輪）：買了放進場景，各 +1% 全隊
    function renderDecor() {
      const s = store.state, P = window.ClickerPrestige, col = $('wardrobe-decor'); if (!col) return; col.replaceChildren();
      const price = P.decoPrice(s); $('wardrobe-decor-price').textContent = `下一件 ${format(price)} 幣・+1%／件（${s.deco.length}/10）`;
      for (const item of B.decor) {
        const owned = s.deco.includes(item.id), btn = document.createElement('button'); btn.className = 'wardrobe-item'; btn.dataset.key = `deco:${item.id}`; btn.classList.toggle('owned', owned); btn.classList.toggle('wearing', owned);
        const icon = document.createElement('span'); icon.className = 'wardrobe-icon'; icon.textContent = '❀';
        const name = document.createElement('b'); name.textContent = item.name;
        // 2026-09-08：買了就算 +1%，但預設不擺出來（全部擺出來畫面太亂）——擺不擺另外切換
        const shown = (s.decoShown || []).includes(item.id);
        btn.classList.toggle('wearing', shown);
        const status = document.createElement('small'); status.textContent = owned ? (shown ? '擺在桌上' : '已擁有・收起來') : pendingBuy === `deco:${item.id}` ? `確定 ${format(price)}？` : format(price);
        btn.append(icon, name, status); btn.disabled = store.blocked || (!owned && s.coins < price);
        btn.onclick = () => action(() => {
          const key = `deco:${item.id}`;
          if (owned) { if (commit(P.toggleDeco(store.state, item.id))) { sound('upgrade'); changed(); stage?.render?.(store.state); notice(`「${item.name}」${shown ? '收起來了' : '擺上桌了'}`); } renderWardrobe(); return; }
          if (pendingBuy !== key) { pendingBuy = key; renderWardrobe(); return; }
          pendingBuy = null;
          if (commit(P.buyDeco(store.state, item.id, Date.now()))) { sound('upgrade'); changed(); notice(`買下「${item.name}」，全隊 +1%（要擺出來再點一次）`); stage?.render?.(store.state); }
          renderWardrobe();
        });
        col.append(btn);
      }
    }
    function preview(kind, item) {
      if (kind === 'sounds') [0, 120, 240].forEach(ms => later(() => sound('click', item.id), ms));
      else stage?.preview?.(item.id);
    }
    function openWardrobe() { pendingBuy = null; shopCategory = null; $('wardrobe').hidden = false; $('game-content').inert = true; renderWardrobe(); $('wardrobe-close').focus(); }
    function closeWardrobe() { $('wardrobe').hidden = true; }

    for (const [id, dir] of [['album-left', -1], ['album-right', 1]]) $(id).onclick = e => {
      if (!e.target.closest('.album-slot, .page-corner')) flip(dir);
    };
    $('album-prev').onclick = () => flip(-1); $('album-next').onclick = () => flip(1);
    $('recall-all').onclick = () => action(() => { const r = E.recall(store.state, Date.now()); if (commit(r.state)) { changed(); sound('transcend'); notice(`收回派遣：${r.rewards.filter(x => !x.capped).length} 位帶粉塵回來${r.rewards.some(x => x.capped) ? '（今天已達 9 次上限）' : ''}`); renderBook(); } });
    $('train-all').onclick = () => action(() => {
      const r = window.ClickerPrestige.trainAll(store.state, Date.now());
      if (commit(r.state)) {
        changed(); sound('upgrade');
        notice(`平均訓練：${Object.keys(r.perPartner).length} 位夥伴共 +${r.levels} 級，花 ${format(r.spent)} 幣`);
        renderBook(); if (detailId) openDetail(detailId);
      }
    });
    $('shop-back').onclick = () => { shopCategory = null; pendingBuy = null; renderWardrobe(); $('shop-cats').querySelector('button')?.focus(); };
    $('dust-open').onclick = () => $('dust-shop').hidden ? openDustShop() : closeDustShop();
    $('recommend-open').onclick = () => showRecommendations();
    // Esc：先關展示頁／粉塵罐，再關卡冊
    function escape() {
      // 商店在分類內時，Esc 先退回分類頁，再按一次才關掉整個商店
      if (!$('wardrobe').hidden) {
        if (shopCategory) { shopCategory = null; pendingBuy = null; renderWardrobe(); return true; }
        $('wardrobe-close').click(); return true;
      }
      if ($('roster').hidden) return false;
      if (!$('dust-shop').hidden) { closeDustShop(); return true; }
      if (detailId) { closeDetail(); return true; }   // 淡出中也算已關，連按兩下 Esc 才關得掉卡冊
      return false;
    }
    // 直橫切換：跨頁 ↔ 單頁的排版不同，卡冊開著的時候要重畫（page 是單頁索引，不會跳掉）
    function relayout() { if (!$('roster').hidden) renderBook(); }
    return { open, close, openDetail, openWardrobe, closeWardrobe, renderBook, escape, starRow, relayout,
      get isOpen() { return !$('roster').hidden; }, get detailId() { return detailId; },
      // 每秒結算都會呼叫；只有卡冊真正關心的欄位變了才重建，否則每秒重建卡片會閃爍
      refresh() {
        const s = store.state; if (!s) return;
        if (!$('roster').hidden) refreshTrainAll();
        const key = stateKey();
        if (key === refreshKey) return; refreshKey = key;
        // 重建不是「打開」，不要重播進場動畫、也不要把焦點搶回「回到卡冊」
        if (!$('roster').hidden) { renderBook(); if (detailId) openDetail(detailId, false); }
        if (!$('wardrobe').hidden) renderWardrobe();
      } };
  }
  return { create };
})();
