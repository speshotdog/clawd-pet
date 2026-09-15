// 夥伴卡冊（取代名冊）：翻頁卡冊 → 點卡進展示頁（升階／超越／裝備）→ 粉塵罐兌換；更衣室（點擊音效／特效）。
// 卡面沿用共用 GachaCard（框色依「目前階」）；hover 3D 傾斜由 GachaCard 的 live 機制處理。
window.ClickerAlbum = (() => {
  function create({ store, card, commit, changed, action, format, notice, sound, skillTip, homeFlag, stage, showRecommendations }) {
    const $ = id => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, Pool = window.GachaPool;
    const CHAR_IDS = Pool.CHARACTER_IDS.filter(id => B.characters[id]).sort((a,b) => E.origin(a)-E.origin(b)), PER_PAGE = 4;
    // 兩個主系統共用這一本卡冊：差別只有卡池與「擁有幾張」怎麼算（使用者：兩邊邏輯不要差太多）
    const A = () => window.ApocEconomy;
    const apoc = () => store.state?.settings.world === 'apoc';
    const RANK = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 3 };
    let apocIdsCache = null, apocPoolSrc = null;
    const apocIds = () => { const p = window.ApocPool || []; if (p !== apocPoolSrc) { apocPoolSrc = p; apocIdsCache = p.map(c => c.id).sort((a, b) => RANK[byId(a).rarity] - RANK[byId(b).rarity] || a.localeCompare(b)); } return apocIdsCache; };
    const byId = (id) => apoc() ? (window.ApocPool || []).find(c => c.id === id) || Pool.byId[id] : Pool.byId[id];
    const have = (s, id) => apoc() ? (s.apoc?.collection?.[id] || 0) : (s.collection[id] || 0);
    // v3：收藏卡（魔花少女）擁有時排在最後一頁；沒有戰力、不編隊、不升星
    const allIds = () => apoc() ? apocIds() : [...CHAR_IDS, ...((store.state?.collectibles || []).filter(id => Pool.byId[id]))];   // 收藏卡排在最後
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
      // 末世（第十一輪）：星級來自累計粉塵、突破 0～5；桌邊維持原本的 dust／transcend
      const ap = apoc() ? A().normalize(s.apoc) : null;
      // 末世是一條連續的 1～10 星：前 5 顆靠粉塵升星，第 6～10 顆是突破（畫成寶石星做區別）。
      // 使用者：「★5＋5 我希望直接改成 6~10」——所以總數就是 星+突破，不再寫成「5＋5」。
      const t = ap ? A().transcendOf(ap, id) : (s.transcend?.[id] || 0);
      const n = ap ? Math.max(1, A().starsAt(ap, id)) + t : E.stars(E.dust(s, id));
      const row = document.createElement('div'); row.className = (ap ? byId(id)?.rarity : E.rarity(s, id)) === 'mythic' ? 'star-row mythic-stars' : 'star-row';
      // 第十二輪（使用者：「10 星在卡冊裡不好看，參考薑餅人王國」，選了 A 版）：
      // **格子永遠 5 個**，不隨星數變長——卡位只有 90px 寬，10 顆 13px 的星要 140px，一定擠爆。
      // 1～5 顆金星依序亮；第 6～10 星不是多長一顆，而是把金星從左邊一顆一顆換成寶石星。
      const SLOTS = 5, lit = Math.min(n, SLOTS), gems = Math.max(0, n - SLOTS);
      for (let i = 0; i < SLOTS; i++) {
        const gem = i < gems;
        const img = new Image(); img.src = gem ? 'clicker-star-gem.png' : 'clicker-star.png'; img.alt = '';
        img.className = `${gem ? 'gem' : ''}${i < lit ? '' : ' off'}`.trim(); row.append(img);
      }
      row.setAttribute('aria-label', ap ? `${n} 星` : `${n} 星${t ? `・超越 ${t}` : ''}`); return row;
    }
    function nextStep(s, id) {
      if (apoc()) return apocStep(A().normalize(s.apoc), id);
      if (!s.collection[id]) return '尚未招募';
      const d = E.dust(s, id), st = E.stars(d);
      if (st < 5) return `升星 ${d}/${B.stars[st]}`;
      if (E.tier(s, id) < 2) return `升階 ${E.availableDust(s, id)}/${E.promotionCost(s, id)}`;
      const t = s.transcend?.[id] || 0;
      return t < 5 ? `超越 ${E.availableDust(s, id)}/${E.transcendCost(s, id)}` : '滿養';
    }
    // 末世的下一步：還沒抽到也要講得出來（兌換所可以直接換出這張卡，是卡冊全收集唯一不看運氣的路）
    function apocStep(a, id) {
      const AE = A(), d = AE.dustOf(a, id), st = AE.starsAt(a, id);
      if (!a.collection[id]) return '尚未抽到';
      if (st < AE.maxStars()) return `升星 ★${st + 1}　${d}/${AE.RULES.GROW.STARS[st]}`;
      if (AE.isFullyMaxed(a, id)) return '輪迴滿養';
      if (AE.transcendOf(a, id) >= 5) return `突破 ${AE.transcendOf(a, id) + 1}／${AE.RULES.GROW.TRANSCEND.length}・${AE.transcendUnlocked(a, id) ? '已解鎖' : `第 ${AE.transcendLap(a, id)} 圈解鎖`}・要 ${AE.transcendCost(a, id)} 顆`;
      return `升星 ★${st + AE.transcendOf(a, id) + 1}　${AE.availableDust(a, id)}/${AE.transcendCost(a, id)}`;
    }
    function tierName(s, id) {
      const cur = E.rarity(s, id), o = ORIGIN[E.origin(id)], t = s.transcend?.[id] || 0;
      return `${RAR[cur]}${cur !== Pool.byId[id].rarity ? `（${o}出身）` : ''}${t ? `・超越 ${t}` : ''}${t === 5 ? '・覺醒' : ''}`;
    }
    // 收藏卡的精裝版。使用者 09-13：「2.0 不准出現任何 1.0 卡面，魔花少女是之前花最多心力做的卡」；
    // 09-14 再確認：**魔花少女／收藏卡只有精裝版**，所以 1.0 也一律用這個，
    // 沒有素材的收藏卡寧可顯示問號也不退回 1.0 卡面。
    //
    // ⚠ 第十二輪改成**原生渲染**（ClickerHolo → HoloCardFace），不再嵌 iframe。
    //   使用者：「卡片沒有完整還原精裝卡該有的品質」「為什麼 2.0 的顯示都很正常，1.0 這邊這麼醜」
    //   「你直接把 2.0 的程式碼拿來用不就好了」。iframe 那條路是模糊、掉 FPS、字型不對的共同根因：
    //   150px 寬的 iframe 會用 150px 的版面視口算版再放大，而 2.0 的 71 張卡從來就不走那條路。
    // 收藏卡的位子表：拿到的畫卡，沒拿到的留灰位子。`how` 是取得方式，寫在卡片下面當線索。
    const COLLECT_SLOTS = [
      { id: 'mohuashaonv', tier: '特殊 / SPECIAL', how: '大掃除・選「從零開始」',
        text: '舊時代收掉的那一天發的紀念卡。魔花少女是這條線上做最久的一張卡面，做成收藏卡留著。' },
    ];
    const collectFace = (id) => {
      const entry = window.ApocCollect?.entries?.[id];
      return entry && window.ClickerHolo?.ready() ? window.ClickerHolo.face(entry) : null;
    };
    function deluxeCard(id) {
      const wrap = document.createElement('div'); wrap.className = 'card flipped album-card collect holo-card';
      const face = collectFace(id);
      if (face) wrap.append(face);
      else { const q = document.createElement('b'); q.className = 'album-unknown'; q.textContent = '?'; wrap.append(q); }
      return wrap;
    }
    // 還沒抽到的卡：卡面上的名字也要遮掉。以前卡面照樣印「珍母／傳說」，可是卡片下面那行是「？？？」，
    // 前後不一致（朋友回報；使用者 2026-09-14 選「全遮」）。遮的是**名字**，稀有度留著——
    // 卡冊本來就照稀有度排，那不是祕密。
    const MASK = '？？？';
    const maskEntry = (entry, owned) => owned ? entry : { ...entry, name: MASK };
    function makeCard(s, id) {
      if (isCollect(id)) return deluxeCard(id);   // 收藏卡只有精裝版，兩個世界都一樣
      const owned = !!have(s, id);
      const entry = maskEntry(byId(id), owned);
      // 末世的卡一律用精裝卡面（使用者：所有卡都是精裝版）
      if (apoc() && window.ClickerHolo?.ready()) {
        const wrap = document.createElement('div'); wrap.className = 'card flipped album-card holo-card';
        wrap.classList.toggle('locked', !owned);
        const face = window.ClickerHolo.face(entry); if (face) wrap.append(face);
        if (!owned) { const q = document.createElement('b'); q.className = 'album-unknown'; q.textContent = '?'; wrap.append(q); }
        return wrap;
      }
      const el = card.create({ ...entry, rarity: apoc() ? entry.rarity : E.rarity(s, id) }, { tag: false });
      el.classList.add('flipped', 'album-card');
      el.classList.toggle('locked', !have(s, id));
      el.classList.toggle('awakened', !apoc() && s.transcend?.[id] === 5);
      if (!have(s, id)) { const q = document.createElement('b'); q.className = 'album-unknown'; q.textContent = '?'; el.append(q); }
      return el;
    }

    // 末世版：技能槽滿了就在原地展開「要換掉哪一格」
    function pickApocSlot(id, host, anchor) {
      host.querySelectorAll('.slot-pick-row').forEach(el => el.remove());
      const row = document.createElement('div'); row.className = 'slot-pick-row';
      const a = A().normalize(store.state.apoc), map = id2 => byId(id2);
      for (let i = 0; i < 4; i++) {
        const cur = (a.skills || [])[i], b = document.createElement('button');
        b.textContent = `換掉槽 ${i + 1}・${cur ? map(cur).name : '空'}`;
        b.onclick = () => action(() => {
          const aa = A().normalize(store.state.apoc), skills = [...(aa.skills || [null, null, null, null])];
          skills[i] = id;
          const next = E.clone(store.state);
          next.apoc = A().setTeam(aa, aa.roster.includes(id) ? aa.roster : [...aa.roster, id], skills);
          if (commit(next)) { sound('upgrade'); changed(); notice(`換進技能格 ${i + 1}`); renderBook(); openDetail(id); }
        });
        row.append(b);
      }
      const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.onclick = () => { row.remove(); anchor.focus(); };
      row.append(cancel); anchor.after(row); row.querySelector('button')?.focus();
    }
    // 技能槽滿了的時候，在原地展開「要換掉哪一格」；選完就裝（不用先跑去編隊卸下再回來）
    function pickSlot(id, open, host, anchor) {
      host.querySelectorAll('.slot-pick-row').forEach(el => el.remove());
      const row = document.createElement('div'); row.className = 'slot-pick-row';
      const s = store.state;
      for (let i = 0; i < open; i++) {
        const cur = s.skillSlots[i], b = document.createElement('button');
        b.textContent = `換掉槽 ${i + 1}・${cur ? Pool.byId[cur].name.replace('（原版）', '') : '空'}`;
        b.onclick = () => action(() => {
          if (commit(E.equip(store.state, i, id, Date.now()))) { changed(); notice(`${Pool.byId[id].name} 換進技能槽 ${i + 1}，等待 30 秒`); openDetail(id); renderBook(); }
        });
        row.append(b);
      }
      const cancel = document.createElement('button'); cancel.textContent = '取消'; cancel.onclick = () => { row.remove(); anchor.focus(); };
      row.append(cancel); anchor.after(row); row.querySelector('button')?.focus();
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
      // 翻頁動畫用 fill:forwards 把出去的那一頁停在 rotateY(±90)（＝寬度 0），
      // 正常收尾時會被 cancel 掉；但只要中途被打斷（連點下一頁、面板重開）就會卡住，
      // 那一頁從此隱形。不在翻頁中的時候一律清乾淨，才有穩定的靜止狀態。
      if (!flipping) for (const id of ['album-left', 'album-right']) $(id).getAnimations().forEach(a => a.cancel());
      // 末世的卡冊：1.0 的平均訓練、派遣收起來（粉塵罐與推薦組合兩邊都有）
      for (const id of ['train-all', 'recall-all']) $(id).hidden = apoc() || $(id).hidden;
      // 收藏卡卡冊：兩個世界都看得到（使用者第三輪：「之前說的收藏卡的卡冊做去哪了？」）。
      // ⚠ 這顆鍵以前兩邊都沒打開過——桌邊只把收藏卡排在最後一頁，末世的卡冊只列末世卡池，所以末世完全看不到。
      { const n = (s.collectibles || []).filter(id => Pool.byId[id]).length;
        $('collect-open').hidden = !n; $('collect-open').textContent = `收藏卡 ${n}`; }
      if (apoc()) {
        const a = A().normalize(s.apoc), owned = Object.keys(a.collection).filter(k => a.collection[k] > 0).length;
        const maxed = IDS.filter(id => A().isMaxed(a, id)).length;
        $('team-summary').innerHTML = `隊伍 <b>${a.roster.length}/20</b>・收藏 <b>${owned}/${IDS.length}</b>・滿養 <b>${maxed}/${IDS.length}</b>${A().lapsOf(a) >= 2 ? `・<small>輪迴滿養 ${IDS.filter(id => A().isFullyMaxed(a, id)).length}/${IDS.length}</small>` : ''}`;
        $('team-summary').title = `重複卡變成該夥伴的粉塵：${A().starCap()} 顆滿星（每星 +25%），之後五級突破（每級 +10%），共 ${A().fullDust()} 顆滿養；輪迴解鎖至十級，共 ${A().fullDustLoop()} 顆輪迴滿養。`;
        for (const id of ['train-all', 'recall-all']) $(id).hidden = true;
        $('recommend-open').hidden = false;   // 2026-09-16：末世也有推薦組合（照稀有度的四格模板）
        // 第十一輪：末世也有萬用粉塵罐（而且是卡冊全收集唯一不看運氣的路），所以粉塵罐不再收起來
        $('dust-open').hidden = false; $('dust-count').textContent = a.universalDust || 0;
      } else {
        for (const id of ['train-all', 'dust-open', 'recommend-open']) $(id).hidden = false;
        refreshTrainAll();
        $('dust-count').textContent = s.universalDust || 0;
      }
      // v3 編隊摘要：隊伍 n/20 與前綴上限（出身算層）；派遣到期就出「收回」鍵
      const team = apoc() ? [] : E.rosterOf(s);
      if (!apoc()) {
        const counts = E.rosterCounts(team), lim = B.V3.ROSTER_LIMITS, due = (s.dispatch || []).filter(d => d.until <= Date.now()).length;
        $('team-summary').innerHTML = `隊伍 <b>${team.length}/20</b>${s.roster?.length ? '' : '・自動'}`;
        $('team-summary').title = `神話 ${counts[0]}/${lim[0]}・＋傳說 ${counts[1]}/${lim[1]}・＋史詩 ${counts[2]}/${lim[2]}（上限用出身算）。只有隊伍裡的夥伴產錢；隊外的可以派遣 4 小時換粉塵`;
        $('recall-all').hidden = !due; $('recall-all').textContent = `收回派遣（${due}）`;
      }
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
          if (apoc()) {
            // 末世：星星是一條連續的 1～10（前 5 顆靠粉塵升星、第 6～10 顆是突破），加上「在不在隊上」。
            // ⚠ 第十一輪之前這裡是「張數＝星數」，一張抽了 30 次的卡會畫成「★×30」——那個語意已經沒有了。
            const a = A().normalize(s.apoc), owned = have(s, id), entry = byId(id);
            const n = owned ? A().starsAt(a, id) + A().transcendOf(a, id) : 0;
            const hint = owned ? `${entry.name}・★${n}・${apocStep(a, id)}・戰力 ${format(A().cardPower(a, id))}` : `${entry.name}・還沒抽到`;
            slot.setAttribute('aria-label', hint); slot.title = hint;
            slot.append(makeCard(s, id));
            const meta = document.createElement('div'); meta.className = 'album-meta';
            if (n) meta.append(starRow(s, id));
            const line = document.createElement('small'); line.textContent = owned ? `戰力 ${format(A().cardPower(a, id))}` : '？？？'; meta.append(line);
            const sk = (a.skills || []).indexOf(id);
            if (sk >= 0) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp'; stamp.textContent = `槽${sk + 1}`; slot.append(stamp); }
            else if ((a.roster || []).includes(id)) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp team-stamp'; stamp.textContent = '隊'; slot.append(stamp); }
            else if ((a.dispatch || []).some(d => d.id === id)) { const stamp = document.createElement('i'); stamp.className = 'slot-stamp away-stamp'; stamp.textContent = '派'; slot.append(stamp); }   // 第十輪 D 派遣
            slot.append(meta); slot.onclick = () => openDetail(id); el.append(slot); return;
          }
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
      // ⚠ 出去的那一頁用 fill:forwards 停在 rotateY(±90)（視覺寬度 0）。
      //   本來是等「進來」那一頁播完才 cancel，但只要中途被打斷（連點下一頁、面板重開、
      //   最後一跨頁右頁只有一張卡）就會留在 90 度——那一頁從此隱形，而且 inline style 蓋不掉它
      //   （動畫贏過 inline，只有 !important 贏得過動畫）。實測：收藏卡排到最後一頁時看不到。
      //   改成「換完內容就立刻把出去那頁的動畫收掉」，靜止狀態不再依賴任何還活著的動畫物件。
      const settle = () => { flipping = false; for (const id of ['album-left', 'album-right']) $(id).getAnimations().forEach(a => a.cancel()); };
      outEl.animate([{ transform: 'rotateY(0)' }, { transform: `rotateY(${dir > 0 ? -90 : 90}deg)` }], { duration: 120, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
        renderBook(); sound('page');
        outEl.getAnimations().forEach(a => a.cancel());
        const incoming = $(wide() && dir < 0 ? 'album-right' : 'album-left');
        incoming.animate([{ transform: `rotateY(${dir > 0 ? 90 : -90}deg)` }, { transform: 'rotateY(0)' }], { duration: 120, easing: 'ease-out' }).finished.then(settle).catch(settle);
      }).catch(settle);
    }
    function open(selected = null, slot = null) {
      targetSlot = slot; closeRecommend();
      $('roster').hidden = false; $('game-content').inert = true;
      renderBook(true); refreshKey = '';
      if (selected) openDetail(selected); else { closeDetail(true); $('roster-close').focus(); }
    }
    function close() {
      closeDetail(true); closeDustShop(); closeRecommend();
      $('roster').hidden = true;
    }

    // ---------- 展示頁 ----------
    // stateKey 裡有 detailId，所以「打開詳細頁」這件事本身一定會讓 key 變掉，
    // 下一個 tick 就會重建一次、把剛播完的進場動畫從頭重播——這就是使用者看到的
    // 「剛點開卡面會閃一下」與「卡片抽動」（實測：+0ms 開始、+145ms 完成、+222ms 整個歸零重來）。
    // 所以開完之後要自己把 refreshKey 對齊，讓那一次多餘的重建不要發生。
    function stateKey() {
      const s = store.state;
      if (apoc()) { const a = A().normalize(s.apoc); return JSON.stringify(['apoc', a.collection, a.roster, a.skills, a.dispatch, a.dispatch.length ? Math.floor(Date.now() / 60000) : 0]); }   // 派遣中每分鐘重畫一次倒數（Codex 10D 值得修）
      return JSON.stringify([s.apoc?.dust, s.apoc?.universalDust, s.apoc?.transcend, s.apoc?.collection,
        s.collection, s.dust, s.universalDust, s.promotions, s.transcend, s.skillSlots, s.partnerLevels, s.owned?.wardrobe, s.settings.clickSound, s.settings.clickFx, s.deco, s.coins >= E.wardrobePrice(s), s.coins >= window.ClickerPrestige.decoPrice(s), detailId && !isCollect(detailId) && s.coins >= window.ClickerPrestige.trainCost(s.partnerLevels?.[detailId] || 0, detailId)]);
    }
    function openDetail(id, animate = true) {
      const s = store.state; detailId = id; closeDustShop();
      const root = $('album-detail'); root.replaceChildren(); root.hidden = false;
      const left = document.createElement('div'); left.className = 'detail-left';
      const big = makeCard(s, id); big.classList.add('detail-card'); left.append(big, zoomButton(id));
      if (apoc()) window.ClickerHolo?.interactive(big.querySelector('.holo-face'));   // 拿在手上看：拖曳轉動、反光跟著游標
      const right = document.createElement('div'); right.className = 'detail-right';
      // 詳情頁標題也遮（不然點開locked卡還是看得到名字）
      const h = document.createElement('h3'); h.textContent = maskEntry(byId(id), !!have(s, id)).name; right.append(h);
      if (isCollect(id)) {   // 收藏卡：只有說明與返回
        const tier = document.createElement('div'); tier.className = 'detail-tier'; tier.textContent = '收藏卡'; right.append(tier);
        // ⚠ 以前這裡有一顆「看精裝版」＝ window.open(`apoc/${id}.html`) 開外部分頁。
        //   使用者 09-14：「他的放大比較 2.0 的檢視方式，不要外部開 HTML」——整顆拿掉。
        //   卡片下面（detail-left）本來就有「放大」鍵，走的是跟末世卡同一個 #card-zoom 內嵌層
        //   （裡面就是同一張精裝頁，拖得動、有反光），不需要在右欄再放一顆。
        const back = document.createElement('button'); back.className = 'detail-back'; back.textContent = '回到卡冊'; back.onclick = () => closeDetail(); right.append(back);
        root.append(left, right); big.style.transform = 'scale(1.15)'; refreshKey = stateKey(); return;
      }
      if (apoc()) {
        const a = A().normalize(s.apoc), owned = have(s, id), entry = byId(id), inTeam = a.roster.includes(id);
        // 第十一輪：星數 = 升星（前 5 顆，吃粉塵）＋ 突破（第 6～10 顆）。以前這裡直接把張數當星數。
        const n = owned ? A().starsAt(a, id) + A().transcendOf(a, id) : 0;
        const tier = document.createElement('div'); tier.className = 'detail-tier';
        tier.textContent = `${RAR[entry.rarity] || entry.rarity}${n ? `・★${n}` : ''}`; right.append(tier);
        if (n) right.append(starRow(s, id));
        const info = document.createElement('div'); info.className = 'detail-info';
        const add = (k, v) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; info.append(dt, dd); };
        if (n) {
          add('戰力', `${format(A().cardPower(a, id))}（★${n}：每星 +25%、每突破 +10%）`);
          add('粉塵', `${A().dustOf(a, id)} / ${A().fullDustLoop()} 顆・${apocStep(a, id)}`);
          add('編隊', inTeam ? `在隊伍裡（${a.roster.indexOf(id) + 1} / 20）` : ((a.dispatch || []).some(d => d.id === id) ? '派遣中（不算戰力）' : '不在隊伍（不算戰力）'));
          const sk = (a.skills || []).indexOf(id); add('獨立技能', sk >= 0 ? `技能格 ${sk + 1}` : '沒有裝');
        } else add('狀態', '還沒抽到（第一張只能從招募抽出來）');
        // 技能效果直接寫在卡上（使用者 2026-09-16：「每張卡上也要寫上他的技能效果」）；還沒抽到的也給看，知道值不值得追
        { const ROLE = { open: '開封', train: '加訓', reset: '重整', coin: '撿金幣', breach: '破防', idle: '放置狂熱' };
          const si = A().skillInfo?.(id), sb = A().skillInfo?.(id, { boss: true });
          if (si) { add(`技能・${si.name}`, `${ROLE[si.role] || si.role}型：${si.text}`);
            if (sb && sb.text !== si.text) add('王關', sb.text.slice(sb.text.indexOf('王關：') + 3)); } }
        right.append(info);
        const acts = document.createElement('div'); acts.className = 'detail-actions';
        if (n && A().transcendOf(a, id) >= 5 && A().transcendCost(a, id) && A().transcendUnlocked(a, id)) {
          const grow = document.createElement('button'); grow.dataset.apocTranscend = id;
          grow.textContent = `突破第 ${A().transcendOf(a, id) + 1} 級（${A().transcendCost(a, id)} 顆）`;
          grow.disabled = store.blocked || !A().canTranscend(a, id);
          grow.onclick = () => action(() => {
            const next = E.clone(store.state); next.apoc = A().transcend(A().normalize(next.apoc), id);
            if (commit(next)) { sound('upgrade'); changed(); renderBook(); openDetail(id); }
          });
          acts.append(grow);
        }
        if (n) {
          const t = document.createElement('button'); t.textContent = inTeam ? '移出隊伍' : '編入隊伍';
          t.onclick = () => action(() => {
            const next = E.clone(store.state), aa = A().normalize(next.apoc);
            const roster = inTeam ? aa.roster.filter(x => x !== id) : [...aa.roster, id];
            next.apoc = A().setTeam(aa, roster, aa.skills);
            if (commit(next)) { sound('upgrade'); changed(); renderBook(); openDetail(id); }
          });
          const away = (a.dispatch || []).some(d => d.id === id);
          if (away) { t.disabled = true; t.title = '派遣中，回來才能編入'; }
          acts.append(t);
          // 四顆「裝到技能格 N」是同一個決定的四個選項，而且跟編隊重複——收成一顆，
          //（Codex 複檢 3-1）按了才問要放哪一格；已經裝好的那格直接讓它退出。
          const sk = (a.skills || []).indexOf(id);
          const eq = document.createElement('button');
          eq.textContent = sk >= 0 ? `從技能格 ${sk + 1} 卸下` : '裝備技能';
          eq.onclick = () => action(() => {
            const aa = A().normalize(store.state.apoc);
            const skills = [...(aa.skills || [null, null, null, null])];
            let slot = sk;
            if (sk >= 0) skills[sk] = null;
            else {
              slot = skills.indexOf(null);
              // 滿格時不要叫玩家「先去卸下一個」——在原地展開要換掉哪一格（同桌邊的 pickSlot）
              if (slot < 0) { pickApocSlot(id, acts, eq); return; }
              skills[slot] = id;
            }
            const next = E.clone(store.state);
            const roster = aa.roster.includes(id) ? aa.roster : [...aa.roster, id];
            next.apoc = A().setTeam(aa, roster, skills);
            if (commit(next)) { sound('upgrade'); changed(); notice(sk >= 0 ? '已卸下' : `裝到技能格 ${slot + 1}`); renderBook(); openDetail(id); }
          });
          if (away && sk < 0) { eq.disabled = true; eq.title = '派遣中，回來才能裝'; }
          acts.append(eq);
          // 第十輪 D 派遣：不在隊上的卡出去，回來帶末世金幣（小機率帶券）；時間到在 clicker-apoc-ui.js 的 tick 自動收回
          // 印記重設計：派遣位數要看兌換「派遣位 +1」（dispatch4），不能用常數（Opus 群組 A 回報：買了第 4 位這裡仍只給 3）
          const job = (a.dispatch || []).find(d => d.id === id), D = A().RULES.DISPATCH, used = (a.dispatch || []).length, slots = D.SLOTS + (s.markShop?.dispatch4 ? 1 : 0);
          const go = document.createElement('button');
          go.textContent = job ? `派遣中・${Math.max(1, Math.ceil((job.until - Date.now()) / 60000))} 分後回來` : inTeam ? '派遣（要先離隊）' : `派遣 ${D.MS / 3600000} 小時（${used}/${slots}）${!s.markShop?.dispatch4 && used >= slots ? '・印記商店可買第 4 位' : ''}`;
          go.disabled = !!job || inTeam || used >= slots || store.blocked;
          go.title = `回來帶約 ${format(A().dispatchCoins(a, id))} 末世金幣，${Math.round(D.TICKET * 100)}% 機率多一張券`;
          go.onclick = () => action(() => {
            const next = E.clone(store.state); next.apoc = A().startDispatch(A().normalize(next.apoc), id, Date.now());
            if (commit(next)) { changed(); notice(`${entry.name} 出發了，${D.MS / 3600000} 小時後回來`); renderBook(); openDetail(id); }
          });
          acts.append(go);
        }
        const back = document.createElement('button'); back.className = 'detail-back'; back.textContent = '回到卡冊'; back.onclick = () => closeDetail();
        acts.append(back); right.append(acts);
        root.append(left, right); refreshKey = stateKey(); return;
      }
      const tier = document.createElement('div'); tier.className = 'detail-tier'; tier.textContent = tierName(s, id); right.append(tier);
      right.append(starRow(s, id));
      const owned = !!s.collection[id];
      const info = document.createElement('div'); info.className = 'detail-info';
      const def = B.characters[id];
      const rows = [
        ['被動', owned ? `每秒 ${format(E.individual(s, id))}${E.affinity(s, id) ? '（當家 ×1.5）' : ''}` : `每秒 ${format(def.base)}（招募後）`],
        [def.skill, skillTip(s, id).replace(/\n/g, '\n')],
        ['粉塵', owned ? `持有 ${E.dust(s, id)} 顆・可用 ${E.availableDust(s, id)} 顆` : '尚未招募'],
      ];
      if (def.trait) rows.push(['特質', `裝備時攻擊力 ×${E.skillAt(s,id).trait.clickMul}`]);
      for (const bond of B.bonds.filter(b => b.pair.includes(id))) rows.push(['羈絆', bond.pair.every(k => s.collection[k]) ? `${bond.name}・已生效` : `${bond.name}・需要 ${bond.pair.filter(k => !s.collection[k]).map(k => Pool.byId[k].name).join('、')}`]);
      const home = Object.entries(window.ClickerScenes).filter(([, sc]) => (sc.affinity || []).includes(id)).map(([, sc]) => sc.name);
      if (home.length) rows.push(['當家', `${home.join('、')}：收益 ×1.5、冷卻 −20%`]);
      if (E.champion(s, id)) rows.push(['本輪當家', '這一輪收益 ×1.5、冷卻 −20%；換桌布會重抽']);
      // 升階／超越改成「抽到就自動做」（使用者 2026-09-13），所以詳情頁不再放那兩顆按鈕——
      // 它們只是把外面已經會自動發生的事再問一次；改成一行看得懂的進度。
      if (owned) {
        const t = s.transcend?.[id] || 0, five = E.stars(E.dust(s, id)) >= 5;
        const next = E.tier(s, id) < 2 ? E.promotionCost(s, id) : (t < 5 ? E.transcendCost(s, id) : 0);
        const what = E.tier(s, id) < 2 ? '升階' : '超越';
        rows.push(['成長', t === 5 ? '超越五・覺醒（已滿養）'
          : !five ? `${nextStep(s, id)}　滿 5★ 之後，抽到重複的就會自動${what}`
          : next ? `自動${what} ${E.availableDust(s, id)}/${next}　粉塵夠了，下次抽到就自己升`
          : '已滿']);
      }
      const inTeam = E.rosterOf(s).includes(id), away = E.dispatched(s, id), job = (s.dispatch || []).find(d => d.id === id);
      if (owned) rows.push(['編隊', inTeam ? '在隊伍裡（產錢、可裝技能）' : away ? `派遣中，${Math.max(0, Math.ceil((job.until - Date.now()) / 60000))} 分鐘後回來` : '不在隊伍（不產錢；可以派遣）']);
      // 訓練列（以前 push 在 render 之後，從來沒顯示過）。新夥伴入隊時等級直接補到全隊中位數（E.receive → medianPartnerLevel），
      // 不寫出來玩家會以為是 bug（朋友 2026-09-16：「剛抽到青花膠但她已經 123 等了」）
      if (owned) { const P0 = window.ClickerPrestige, L0 = s.partnerLevels?.[id] || 0, ms0 = P0.nextMilestone(L0);
        rows.push(['訓練', `Lv.${L0}・被動 +${5 * L0}%${ms0 ? `・下一里程碑 ${ms0}` : ''}${s.collection[id] === 1 ? '（新夥伴入隊時自動補到全隊中位數等級）' : ''}`]); }
      for (const [k, v] of rows) { const r = document.createElement('p'); const b = document.createElement('b'); b.textContent = k; const span = document.createElement('span'); span.textContent = v; r.append(b, span); info.append(r); }
      right.append(info);
      const buttons = document.createElement('div'); buttons.className = 'detail-buttons';
      // 三顆「裝備至槽 N」是同一個決定的三個選項，跟編隊畫面也重複——收成一顆，
      // 自動放進第一個空槽（Codex 複檢 3-1）。哪一格裝了誰在「編隊」看得到。
      {
        const occupied = s.skillSlots.indexOf(id), open = E.slotCount(s);
        const free = s.skillSlots.findIndex((v, i) => i < open && !v);
        const btn = document.createElement('button');
        btn.textContent = occupied >= 0 ? `已在技能槽 ${occupied + 1}` : free >= 0 ? '裝備技能' : '換掉一個技能';
        btn.disabled = !owned || occupied >= 0 || store.blocked || !inTeam;
        btn.title = !owned ? '招募後才能裝備' : !inTeam ? '要先編入隊伍'
          : free >= 0 ? `放進技能槽 ${free + 1}，等待 30 秒` : '技能槽滿了，按一下挑要換掉哪一個';
        if (targetSlot !== null) btn.classList.add('target-slot');
        btn.onclick = () => action(() => {
          // 滿槽時不要把主要操作變灰——那正是最需要替換的時候（Codex 第二輪 A10）。
          // 槽滿就在原地展開一排「換掉槽 N」，選完直接裝。
          let slot = targetSlot !== null && !s.skillSlots[targetSlot] ? targetSlot : free;
          if (slot < 0) { pickSlot(id, open, buttons, btn); return; }
          if (commit(E.equip(store.state, slot, id, Date.now()))) { changed(); notice(`${Pool.byId[id].name} 裝備至槽 ${slot + 1}，等待 30 秒`); openDetail(id); renderBook(); }
        });
        buttons.append(btn);
      }
      const grow = document.createElement('div'); grow.className = 'detail-grow';
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
    // v3 收藏卡分頁（第一版）：只放卡與名字。正式的分頁之後再做。
    function openCollect() {
      const s = store.state; detailId = null; closeDustShop();
      const root = $('album-detail'); root.replaceChildren(); root.hidden = false;
      const wrap = document.createElement('div'); wrap.className = 'collect-page';
      const ids = (s.collectibles || []).filter(id => Pool.byId[id]);
      // 使用者第十二輪：「版面空、卡孤零零」——一張卡浮在一整頁的正中間。
      // 補成一個像樣的展示頁：標題列寫收藏進度，卡旁邊給一段由來與怎麼看，
      // 還沒拿到的收藏卡留成灰位子（看得到「還有東西可以收」，不然頁面永遠只有一張卡）。
      const head = document.createElement('div'); head.className = 'collect-head';
      const h = document.createElement('h3'); h.textContent = '收藏卡';
      const count = document.createElement('span'); count.className = 'collect-count';
      count.textContent = `${ids.length} / ${COLLECT_SLOTS.length} 張・不入隊、不算戰力，是紀念用的`;
      head.append(h, count); wrap.append(head);

      // 展示櫃版型：左邊一張大卡，右邊一塊說明牌（名稱／階級／取得方式／怎麼看）。
      // 以前是一張卡浮在一整頁的正中央，所以使用者說「版面空、卡孤零零」。
      const grid = document.createElement('div'); grid.className = 'collect-grid';
      for (const def of COLLECT_SLOTS) {
        const got = ids.includes(def.id);
        const item = document.createElement('div'); item.className = 'collect-item' + (got ? '' : ' empty');

        const slot = document.createElement('button'); slot.className = 'album-slot collect-slot'; slot.dataset.id = def.id; slot.type = 'button';
        slot.title = got ? Pool.byId[def.id].name : '還沒拿到';
        if (got) { slot.append(makeCard(s, def.id)); slot.onclick = () => openDetail(def.id); }
        else {
          const ph = document.createElement('div'); ph.className = 'card flipped album-card collect collect-empty';
          const q = document.createElement('b'); q.className = 'album-unknown'; q.textContent = '?'; ph.append(q); slot.append(ph);
          slot.disabled = true;
        }
        item.append(slot);

        const plate = document.createElement('div'); plate.className = 'collect-plate';
        const nm = document.createElement('b'); nm.className = 'collect-name'; nm.textContent = got ? Pool.byId[def.id].name : '？？？'; plate.append(nm);
        const tier = document.createElement('span'); tier.className = 'collect-tier'; tier.textContent = def.tier; plate.append(tier);
        for (const [k, v] of [['取得', def.how], ['說明', got ? def.text : '還沒拿到這張。']]) {
          const row = document.createElement('p'); row.className = 'collect-row';
          const key = document.createElement('i'); key.textContent = k; row.append(key, document.createTextNode(v));
          plate.append(row);
        }
        if (got) { const tip = document.createElement('p'); tip.className = 'collect-tip';
          tip.textContent = '點卡片進詳情，按「放大」可以拖曳轉動、滑過看反光；在放大畫面點一下卡，她會做一個動作。';
          plate.append(tip); }
        item.append(plate);
        grid.append(item);
      }
      wrap.append(grid);
      const back = document.createElement('button'); back.className = 'detail-back'; back.textContent = '回到卡冊'; back.onclick = () => closeDetail(); wrap.append(back);
      root.append(wrap); refreshKey = stateKey();
    }
    // 放大鏡（使用者第四輪）：卡移到畫面正中間放大、背景變暗，讓玩家好好把弄觀賞。
    // 末世是精裝卡面（拖曳轉動、反光跟游標）；收藏卡嵌精裝頁本身；1.0 是原本的卡。點背景、關閉鍵或 Esc 收起來。
    function zoomButton(id) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'zoom-btn'; b.title = '放大欣賞'; b.setAttribute('aria-label', '放大欣賞');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span>放大</span>';
      b.onclick = () => openZoom(id);
      return b;
    }
    let zoomReturn = null;   // 打開放大層的那顆鍵；關掉時把焦點還給它（Codex 第四輪）
    function openZoom(id) {
      closeZoom(); zoomReturn = document.activeElement;
      const s = store.state, layer = document.createElement('div'); layer.id = 'card-zoom';
      layer.setAttribute('role', 'dialog'); layer.setAttribute('aria-modal', 'true'); layer.setAttribute('aria-label', `${byId(id).name}・放大欣賞`);
      const holder = document.createElement('div'); holder.className = 'zoom-card';
      let face = null;
      // 收藏卡只有精裝版，1.0 也用同一套。放大層直接掛卡面本身，這樣才吃得到 refit／interactive
      // （拖曳轉動、反光跟游標）——跟 2.0 那 71 張走的是同一段程式。
      if (isCollect(id)) { face = collectFace(id); if (face) holder.append(face); else holder.append(deluxeCard(id)); }
      // 放大預覽也要遮（使用者：「放大預覽的部分也要遮」）——1.0 走下面的 makeCard 已經遮過了
      else if (apoc() && window.ClickerHolo?.ready() && (face = window.ClickerHolo.face(maskEntry(byId(id), !!have(store.state, id))))) holder.append(face);
      else if (apoc()) { const blank = document.createElement('span'); blank.className = 'apoc-face-blank'; holder.append(blank); }   // 末世不准退回 1.0 卡面
      else { const el = makeCard(s, id); el.classList.add('zoom-face'); holder.append(el); }
      const hint = document.createElement('p'); hint.className = 'zoom-hint';
      // ⚠ 判斷依據是「這張是不是會動的精裝卡」，不是「在哪個世界」——
      //   收藏卡在 1.0 也是精裝頁（可以拖曳轉動），照舊寫法會給它「點背景關閉」這種不完整的提示
      hint.textContent = (apoc() || isCollect(id)) ? '拖曳轉動・滑過看反光・點背景關閉' : '點背景關閉';
      const close = document.createElement('button'); close.type = 'button'; close.className = 'zoom-close'; close.textContent = '關閉'; close.onclick = () => closeZoom();
      layer.append(holder, hint, close);
      layer.onclick = e => { if (e.target === layer) closeZoom(); };
      // ⚠ 放大層是一片鋪滿的半透明遮罩，底下的舞台還在全速跑，整個畫面每幀都要重合成
      //   ——實測 FPS 從 59 掉到 26。招募層本來就會 pauseStage()，放大層漏了。
      //   （量過不是「兩份精裝卡同時跑」造成的：把底下那份整個從 DOM 移掉，FPS 一樣是 26。）
      stage?.stop?.();
      $('game').append(layer);
      if (face) { window.ClickerHolo.refit(face); window.ClickerHolo.interactive(face); }
      // 1.0 的卡：量原本的高度，整張等比放大到放大框的高度（內部是固定像素排版，不能直接撐大）
      const plain = holder.querySelector(':scope > .card');
      if (plain && plain.offsetHeight) plain.style.setProperty('--zoom-k', String(holder.clientHeight / plain.offsetHeight));
      close.focus();
    }
    function closeZoom() {
      const z = $('card-zoom'); if (!z) return false; z.remove();
      window.ClickerHolo?.sweepCollect?.();   // 收藏卡的替身動畫（2.5 MB）當場放掉，不要等下一次建卡
      stage?.start?.();   // 收起放大層＝回到遊戲，舞台要動回來
      if (zoomReturn?.isConnected) zoomReturn.focus(); zoomReturn = null;
      return true;
    }
    // 放大層開著時轉向：1.0 卡的比例要照新的框重量；精裝卡面的字級也跟著容器重算（Codex 第四輪）
    function refitZoom() {
      const z = $('card-zoom'); if (!z) return;
      const holder = z.querySelector('.zoom-card'), plain = holder?.querySelector(':scope > .card');
      if (plain && plain.offsetHeight) plain.style.setProperty('--zoom-k', String(holder.clientHeight / plain.offsetHeight));
      const face = holder?.querySelector(':scope > .holo-face'); if (face) window.ClickerHolo?.refit(face);
    }
    function closeDetail(instant = false) {
      closeZoom(); window.ClickerHolo?.sweepCollect?.();
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
      // 第十一輪：兩個世界共用這個罐子。兩邊唯一不同的是——**末世沒有的卡也能換**，
      // 換到第一顆就等於拿到這張卡（神話率 0.25% 分給 14 張，不給這條路的話卡冊全收集是結構上不可能的）。
      const ap = apoc() ? A().normalize(s.apoc) : null, AE = A();
      const have0 = ap ? (ap.universalDust || 0) : (s.universalDust || 0);
      const h = document.createElement('h3'); h.textContent = `萬用粉塵 ${have0} 顆`; root.append(h);
      const hint = document.createElement('p');
      hint.textContent = ap
        ? `兌換成指定夥伴的粉塵：精良 1:1、史詩 2:1、傳說 4:1、神話 10:1。只能補「已經抽到過」的卡——第一張一律要從招募抽出來（連續 ${AE.RULES.GROW.PITY.AT} 次沒新卡會保底）。萬用粉塵來自每隻王首勝、無盡模式推進、派遣，與滿養夥伴的重複卡。`
        : '兌換成指定夥伴的粉塵：精良 1:1、史詩 2:1、傳說 3:1。萬用粉塵來自每隻王首勝、每日一包與滿養夥伴的重複卡。';
      root.append(hint);
      const list = document.createElement('div'); list.className = 'dust-list';
      for (const id of (ap ? apocIds() : CHAR_IDS)) {
        const entry = ap ? byId(id) : Pool.byId[id];
        if (!entry) continue;
        const row = document.createElement('div'); row.className = 'dust-row';
        const rate = ap ? AE.dustRate(id) : E.exchangeRate(id);
        // 末世用圓形貼紙頭像（1.0 的 card.art 查不到末世卡，會留一個 43px 的空洞；
        // 而且「2.0 不准出現任何 1.0 卡面」是使用者第三輪的硬規定）
        row.append(ap ? window.ClickerApocUI.sticker(entry) : card.art.create(entry));
        const name = document.createElement('b'); name.textContent = `${entry.name}`; row.append(name);
        const small = document.createElement('small');
        small.textContent = ap ? (ap.collection[id] ? `${AE.dustOf(ap, id)}/${AE.fullDustLoop()} 顆・${apocStep(ap, id)}` : '尚未抽到')
                               : (s.collection[id] ? `${E.dust(s, id)} 顆・${nextStep(s, id)}` : '尚未招募');
        row.append(small);
        for (const n of [1, 5]) {
          const btn = document.createElement('button'); btn.textContent = `+${n}（${rate * n}）`;
          btn.disabled = store.blocked || have0 < rate * n
            || (ap ? (!ap.collection[id] || AE.exchangeCapacity(ap, id) < n) : (!s.collection[id] || s.transcend?.[id] === 5));
          btn.dataset.dust = `${id}:${n}`;
          btn.onclick = () => action(() => {
            const next = ap ? (() => { const c = E.clone(store.state); c.apoc = AE.exchangeDust(AE.normalize(c.apoc), id, n).state; return c; })()
                            : E.exchange(store.state, id, rate * n, Date.now());
            if (commit(next)) { changed(); sound('upgrade'); openDustShop({ id, n }); renderBook(); }
          });
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
    function closeRecommend() { const r = $('recommend-page'); if (r && !r.hidden) { r.hidden = true; r.replaceChildren(); } }
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
    $('collect-open').onclick = () => openCollect();
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
      if (closeZoom()) return true;   // 放大欣賞開著：Esc 先收它
      // 商店在分類內時，Esc 先退回分類頁，再按一次才關掉整個商店
      if (!$('wardrobe').hidden) {
        // 末世商店沒有分類頁：直接關（不然殘留的 1.0 shopCategory 會把末世商店重畫成桌邊商店，Codex 第三輪）
        if (shopCategory && !apoc()) { shopCategory = null; pendingBuy = null; renderWardrobe(); return true; }
        $('wardrobe-close').click(); return true;
      }
      if ($('roster').hidden) return false;
      if (!$('dust-shop').hidden) { closeDustShop(); return true; }
      if (detailId) { closeDetail(); return true; }   // 淡出中也算已關，連按兩下 Esc 才關得掉卡冊
      return false;
    }
    // 直橫切換：跨頁 ↔ 單頁的排版不同，卡冊開著的時候要重畫（page 是單頁索引，不會跳掉）
    function relayout() { if (!$('roster').hidden) renderBook(); refitZoom(); }
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
        if (!$('wardrobe').hidden && !apoc()) renderWardrobe();   // 末世的商店面板由 clicker-apoc-ui.js 畫，這裡不要蓋掉
      } };
  }
  return { create };
})();
