// v3 末世（2.0）的畫面：**直接畫進 1.0 的 DOM**，不再是 iframe 裡的原型頁。
// 使用者 2026-09-13：「1.0 的版本比較好，乾脆把 1.0 的 UI 介面稍微調色拿來用就好，
// 但注意卡片都要是末世卡版本」「兩邊邏輯不要差太多，不同的是 UI 的色調」。
//
// 所以這支不自己造版面，只是把末世的資料餵進 1.0 既有的節點：
//   #stage   → 怪物（1.0 的敵人素材）＋血條，點的位置就是 1.0 的 #tap
//   #buddies → 末世隊伍（卡面縮圖）
//   #slots   → 末世四個獨立技能格（圓形貼紙頭像＋冷卻）
//   #shop    → 點擊力｜全隊訓練｜招募（先用券、不夠付末世金幣）＋「用桌邊金幣換券」入口
//   #wardrobe／#stats（頁尾商店、頂列統計）→ 末世商店（兌換所＋受擊特效外觀）、末世戰績
// 色票由 `body[data-world="apoc"]` 在 clicker.css 換掉，版面一行都不用改。
window.ClickerApocUI = (() => {
  const RARITY = { common: '#A9A297', rare: '#94BED0', epic: '#B8A2CF', legendary: '#E9B94E', mythic: '#FF4FD8' };
  // 20 站的敵人：沿用 1.0 的敵人／王素材（使用者：整體畫面用 1.0 的改），王關用大一號的
  const MOBS = ['monster-0.png', 'monster-1.png', 'monster-2.png'];
  // 第八輪使用者：「王的名字和圖對不上，請解決」——地圖上的王是 2.0 企劃定的五隻（灰狼犬／貼紙羊／扛槌兔／雞頭合成怪／真・滅世珍獸，
  // PLAN-2.0-levels），戰鬥卻一直借 1.0 的鳥／灰狼／罐頭／箱子／袋子。換成企劃指定的原素材
  // （holo-5.0 `_art/holo-test/source-4.0/怪物/`：01.gif、ej93j4.gif、image.gif 去白底、rise.png 去白底），轉成逐格圖放 apoc/boss/；
  // 滅世珍獸企劃當時「素材未定」，用 1.0 滅世都市的滅世珍獸本體：原圖是有 REC 取景框與大樓的整張畫，放上來像貼一張照片，
  // 裁掉取景框、四周橢圓淡出（apoc/boss/boss5-mieshi.png）。aspect＝單格寬／高，h＝舞台上的顯示高度。
  const BOSSES = [
    // 2026-09-14 使用者：「檢查還有沒有關卡的怪物會覆蓋到技能欄位」——技能鍵在 y 224～288，怪的下緣要 ≤ ENEMY_FLOOR。
    // 王的高度縮 10～15%，位置改由高度算（下面 renderStage：top = ENEMY_FLOOR − h/2），不再寫死 top:140。
    { name: '灰狼犬', src: 'apoc/boss/boss1-wolfdog.png', frames: 5, ms: 100, aspect: 205 / 180, h: 180 },
    { name: '貼紙羊', src: 'apoc/boss/boss2-sticker-sheep.png', frames: 7, ms: 100, aspect: 338 / 300, h: 200 },
    { name: '扛槌兔', src: 'apoc/boss/boss3-hammer-bunny.png', frames: 9, ms: 130, aspect: 360 / 300, h: 200 },
    { name: '雞頭合成怪', src: 'apoc/boss/boss4-chicken-chimera.png', frames: 1, aspect: 260 / 280, h: 200 },
    // 使用者 2026-09-15：「真・滅世珍獸排場大一點，整個畫面都是王關」——照 1.0 滅世都市的滿版王：用同一張 632×360 整幅圖鋪滿舞台（full:true），
    // 尺寸與位置由 clicker.css #apoc-enemy.full-board 管，不走 ENEMY_FLOOR 那套；舞台加 apoc-final 暗角脈動。
    { name: '真・滅世珍獸', src: 'clicker-boss7-mieshi.png', frames: 1, full: true },
  ];
  const ENEMY_FLOOR = 218;   // 怪的下緣（舞台座標），技能鍵上緣是 224，留 6px 餘裕（含四捨五入）
  const _unused = [
  ];
  const enemyArt = (i, boss) => boss ? BOSSES[Math.floor(i / 4) % BOSSES.length] : { src: MOBS[i % MOBS.length], frames: 1 };


  const blankFace = () => { const el = document.createElement('span'); el.className = 'apoc-face-blank'; return el; };
  // 圓形貼紙頭像：外圈稀有度色、裡面是精裝卡的主體圖，取景由 tools/apoc/build_sticker.py 算好（window.ApocSticker）。
  // 技能格與粉塵兌換所共用（第十一輪）——兩邊都不能退回 1.0 卡面（使用者：「2.0 不准出現任何 1.0 卡面」）。
  function sticker(entry) {
    const ring = document.createElement('span'); ring.className = 'apoc-sticker'; ring.dataset.rarity = entry.rarity;
    const art = document.createElement('i'), crop = (window.ApocSticker || {})[entry.id];
    if (crop) { const [file, size, x, y] = crop; art.style.backgroundImage = `url("apoc/${file}")`; art.style.backgroundSize = `${size}% auto`; art.style.backgroundPosition = `${x}% ${y}%`; }
    else art.append(blankFace());
    ring.append(art); return ring;
  }

  function create({ $, store, commit, changed, notice, format, card, sound, openRoster, openTeam, openMarks, cutin }) {
    const root = window;
    const A = window.ApocEconomy, Pool = () => window.ApocPool || [];
    let byIdCache = null, byIdSrc = null;
    const byId = () => { const p = Pool(); if (p !== byIdSrc) { byIdSrc = p; byIdCache = Object.fromEntries(p.map(c => [c.id, c])); } return byIdCache; };
    let lastTick = Date.now(), buddyPage = 0;
    // ⚠ 每秒都 replaceChildren() 會把玩家正在 Tab／拖曳的節點刪掉（Codex 第三輪 B3）。
    //   內容沒變就別重建；會每秒變的只有冷卻秒數與可按狀態，那兩個就地更新。
    let buddyKey = '', slotKey = '';

    // 末世的卡一律用精裝卡面（HoloCardFace）。拿不到就放一塊空白底，**不准退回 1.0 的卡面**
    //（使用者 09-13：「2.0 不准出現任何 1.0 卡面」）
    const blank = blankFace;
    const faceOf = (entry) => (window.ClickerHolo && window.ClickerHolo.ready() && window.ClickerHolo.face(entry)) || blank();
    // 1.0 的印記／祝福加成直接套進 2.0（使用者第四輪）。算法照 1.0 的 rates()：
    //   全隊戰力 ×（印記倍率 × 收益祝福）、點擊再 ×（1＋10%×攻擊力祝福）、技能效果 ×（1＋5%×技能祝福）、冷卻 ×（1−2%×冷卻祝福）。
    //   每次都從 1.0 的存檔現算（1.0 買了祝福，2.0 馬上吃到），不寫進末世存檔。
    // 印記重設計（2026-09-15，DESIGN-2026-09-14-marks）：神器在 2.0 的強度改成 B.ARTIFACT_APOC（戰力類每級只吃 1/5）。
    // ⚠ 以前是全額（收益 ×(1+.1L)、攻擊 ×(1+.1L)），而 2.0 的兩週日曆是用「沒有神器」算的——
    //   模擬顯示 2.0 吃到 ×1.2 全破就從第 5～7 天縮到第 3 天，這就是失衡的根源。
    // 四個兌換解鎖（slot4／bossTime／offline12／tapShare／dispatch4）也從 1.0 的 markShop 讀，兩個世界共用。
    function oneBoost(s) {
      const B = window.ClickerBalance, art = id => s?.artifacts?.[id] || 0, K = B?.ARTIFACT_APOC, shop = s?.markShop || {};
      if (!B || !K || !s) return { power: 1, click: 1, skill: 1, cd: 1, offline: 1, ticket: 0, dust: 0, slot4: true, bossTime: false, offline12: false, tapShare: 0, dispatch4: false };
      return { power: 1 + K.blessing * (s.blessing || 0), click: 1 + K.tap * art('tap'), skill: 1 + K.skill * art('skill'), cd: 1 - K.cd * art('cd'),
        offline: 1 + K.offline * art('offline'), ticket: K.chest * art('chest'), dust: K.dust * art('dust'),
        slot4: !!shop.slot4, bossTime: !!shop.bossTime, offline12: !!shop.offline12, tapShare: (shop.tapShare1 ? 1 : 0) + (shop.tapShare2 ? 1 : 0), dispatch4: !!shop.dispatch4 };
    }
    const boosted = (a, s = store.state) => { a.boost = oneBoost(s); return a; };
    A.setBoostProvider(() => oneBoost(store.state));   // 卡冊／編隊直接呼叫經濟層時也拿得到印記商店的解鎖（派遣位 +1 等）
    const view = () => A.view(boosted(A.normalize(store.state.apoc)), Date.now());
    // 對 s.apoc 做一次純函式變換並提交
    function apply(fn, silent = false) {
      const s = store.state; if (!s.apoc?.unlocked) return [];
      let events = [];
      try {
        const next = JSON.parse(JSON.stringify(s)); const r = fn(boosted(A.normalize(next.apoc), s), Date.now());
        if (r && r.state) { next.apoc = r.state; events = r.events || []; } else next.apoc = r;
        delete next.apoc.boost;   // 加成是現算的，不寫進存檔
        // 印記重設計：2.0 的里程碑印記在這裡入帳（錢包在 1.0 的存檔上，上限 MARKS_TOTAL_CAP）
        { const m = A.markMilestones(next.apoc);
          if (m.gained > 0) { const B = window.ClickerBalance, room = Math.max(0, (B?.MARKS_TOTAL_CAP ?? Infinity) - (next.marksClaimed || 0)), got = Math.min(m.gained, room);
            next.apoc = m.state; next.marks = (next.marks || 0) + got; next.marksClaimed = (next.marksClaimed || 0) + got;
            events = [...events, { type: 'marks', gained: got, notes: m.notes, capped: got < m.gained }]; } }
        if (!commit(next)) return [];
      } catch (err) { if (!silent) notice(err.message); return []; }
      for (const ev of events) {
        if (ev.type === 'win') { sound('upgrade'); notice(`通過第 ${ev.index + 1} 站・＋${format(ev.reward)} 末世金幣`); }
        else if (ev.type === 'fail') notice(`王關失敗：回前一站刷錢變強，${Math.round(A.RULES.BOSS_COOLDOWN / 1000)} 秒後可以再次挑戰`);
        else if (ev.type === 'cleared') { showEnding(); sound('transcend'); }
        else if (ev.type === 'offline') showOffline(ev);
        else if (ev.type === 'marks') { notice(`印記 +${ev.gained}：${ev.notes.join('、')}${ev.capped ? '（已達生涯上限）' : ''}`); if (ev.gained > 0) { try { sound('badge'); } catch {} } }   // ⚠ 初始化的第一次 apply 就可能入帳（舊存檔補發），這時舞台還沒建好，不能碰 DOM 特效
      }
      changed();   // 讓招募層等其他模組也跟著重畫（價目、按鈕的可按狀態都在那邊算）
      return events;
    }

    // ---- 全線通行面板：第十輪 B 的數字、C 的重走廢土／無盡模式。打完第 20 站自動打開，戰績頁也能再打開
    let replayArmed = false;
    function showEnding() {
      const v = view(); replayArmed = false;
      $('apoc-ending-text').textContent = `二十站都打通了${v.laps ? `（第 ${v.laps + 1} 圈）` : ''}。收藏 ${v.owned.length} / ${(root.ApocPool || []).length} 張，戰力 ${format(v.power)}。`;
      const st = v.stats || {};   // textContent 組，不塞 HTML
      $('apoc-ending-stats').replaceChildren(...[['打贏', `${v.wins} 場`], ['點擊', `${format(st.taps || 0)} 下`], ['最高一擊', format(st.maxHit || 0)],
        ['破防', `${st.shieldBreaks || 0} 次`], ['招募', `${st.draws || 0} 抽`], ['收藏', `${v.owned.length} 張`]].map(([k, val]) => {
        const li = document.createElement('li'), sp = document.createElement('span'), b = document.createElement('b');
        sp.textContent = k; b.textContent = val; li.append(sp, b); return li;
      }));
      endingActions(v);
      $('apoc-ending').hidden = false; $('game-content').inert = true; $('apoc-ending-close').focus();
    }
    // 第十輪 D 離線收據：借 1.0 的 #receipt（1.0 的 offline() 在末世不跑，兩邊不會同時出收據）
    function showOffline(ev) {
      if (!(ev.earned > 0)) return;
      const h = ms => Math.round(ms / 360000) / 10;
      $('receipt-text').textContent = `離開 ${h(ev.elapsed)} 小時（最多算 ${h(A.RULES.OFFLINE.MAX_MS)} 小時）。隊伍在第 ${ev.index + 1} 站${ev.kills > 0 ? `打了 ${format(ev.kills)} 隻，` : '放著打，'}帶回 ${format(ev.earned)} 末世金幣；進度沒有往前。`;
      $('receipt').hidden = false; $('game-content').inert = true; $('receipt-close').focus();
    }
    // Codex 10D 必修：離線入帳 commit 失敗（存檔鎖住、寫入失敗）時記成待結算；在補發成功之前，tick 與點擊都不准跑會把 seenAt 推到現在的 settle，
    //   不然「重試存檔」之後下一個 tick 就把八小時的離線收益吃掉。
    let offlinePending = false;
    function offlineCheck() {
      if (!store.state?.apoc?.unlocked) { offlinePending = false; return; }
      if (store.blocked) { offlinePending = true; return; }
      const before = store.state.apoc; apply((x, n) => A.offline(x, n), true);
      offlinePending = store.state.apoc === before;
    }
    // 第十輪 D 末世徽章牆：從存檔現算（不另存清單，壞檔也不會掉徽章）；圖示是字章，不借 1.0 的圖
    const APOC_BADGES = [
      ...['灰狼犬', '貼紙羊', '扛槌兔', '雞頭合成怪', '真・滅世珍獸'].map((name, k) => ({ name: `打贏${name}`, label: `王${k + 1}`, test: v => v.progress > k * 4 + 3 || v.laps > 0 })),
      { name: '全線通行', label: '通', test: v => v.cleared || v.laps > 0 },
      { name: '重走廢土', label: '重走', test: v => v.laps >= 1 },
      { name: '重走 5 圈', label: '5圈', test: v => v.laps >= 5 },
      { name: '無盡＋10 站', label: '無盡', test: v => v.endlessBest >= 10 },
      { name: '收藏 30 張', label: '30', test: v => v.owned.length >= 30 },
      { name: '收藏全部', label: '全', test: v => Pool().length > 0 && v.owned.length >= Pool().length },
      { name: '破防 50 次', label: '破', test: v => (v.stats?.shieldBreaks || 0) >= 50 },
      { name: '點擊一萬下', label: '萬', test: v => (v.stats?.taps || 0) >= 10000 },
      { name: '派遣回來 10 次', label: '派', test: v => v.dispatchDone >= 10 },
    ];
    function apocBadges(v) {
      const grid = $('badge-grid'); grid.replaceChildren(); grid.hidden = false;
      let got = 0;
      for (const b of APOC_BADGES) {
        const ok = !!b.test(v); got += ok ? 1 : 0;
        const el = document.createElement('div'); el.className = 'badge-cell apoc-badge-cell'; el.classList.toggle('earned', ok); el.title = `${b.name}${ok ? '（已拿到）' : '（還沒拿到）'}`;
        const medal = document.createElement('span'); medal.className = 'apoc-medal'; medal.textContent = b.label;
        const name = document.createElement('small'); name.textContent = b.name; el.append(medal, name); grid.append(el);
      }
      return got;
    }
    const times = x => `×${Math.round(x * 100) / 100}`;
    function endingActions(v) {
      const re = $('apoc-replay'), en = $('apoc-endless');
      re.disabled = !v.canReplay || store.blocked; en.disabled = store.blocked;
      re.textContent = !v.canReplay ? `重走廢土（已到 ${A.RULES.LAP.MAX} 圈）` : replayArmed ? '確定重走？' : '重走廢土';
      en.textContent = v.endless ? '關掉無盡模式' : '無盡模式';
      // 按兩次才重走（同商店購買）：第一次先寫清楚會歸零什麼
      $('apoc-lap-note').textContent = replayArmed
        ? `金幣與訓練會歸零，收藏和隊伍保留。下一圈敵人血 ${times(v.nextLapHp)}、戰力 ${times(v.nextLapPower)}。再按一次確定。`
        : `重走廢土：保留收藏重來，下一圈敵人血 ${times(v.nextLapHp)}、戰力 ${times(v.nextLapPower)}。無盡模式：第 21 站起一直往下打${v.endlessBest ? `（最遠 ＋${v.endlessBest} 站）` : ''}。`;
      re.onclick = () => {
        if (!replayArmed) { replayArmed = true; endingActions(view()); return; }
        replayArmed = false; const before = view().laps;
        apply(x => A.replay(x));
        if (view().laps > before) { closeEnding(); notice(`重走廢土・第 ${view().laps + 1} 圈開始`); } else endingActions(view());
      };
      en.onclick = () => {
        const on = !view().endless; apply(x => A.setEndless(x, on));
        if (view().endless === on) { closeEnding(); notice(on ? '無盡模式：第 21 站起一直往下打' : '無盡模式關掉了'); }
      };
    }
    function closeEnding() { replayArmed = false; $('apoc-ending').hidden = true; $('game-content').inert = false; render(); }

    // ---- 點擊回饋（使用者第三輪：「點擊上什麼都沒有」）：跟 1.0 同一套語彙——傷害浮字、碎片＋火花、
    //      受擊閃白＋壓扁、爆擊／破盾加衝擊圖與震動。
    // ⚠ 1.0 的 stage 在末世是 stop() 的，它的 float()/burst() 會碰 1.0 的 state，不能叫；這裡自己畫。
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let fx = null, sparkAt = 0;
    // 落點換算：clicker.js 給的是「遊戲座標」（舞台原點 (16,72)、舞台 608 寬）。浮字層與粒子畫布在橫式／直式的
    // 盒子與縮放不一樣（直式是 608×360 的盒子、畫布屬性仍是 960×640），所以先換成螢幕座標，再換進各層。
    function hitPoint(point) {
      const sb = $('stage').getBoundingClientRect(), k = sb.width / 608 || 1;
      let cx, cy;
      if (point) { cx = sb.left + (point.x - 16) * k; cy = sb.top + (point.y - 72) * k; }
      else { const e = $('apoc-enemy').getBoundingClientRect(); cx = e.left + e.width / 2; cy = e.top + e.height * .45; }
      const f = $('floaters'), fr = f.getBoundingClientRect(), fk = fr.width / (f.offsetWidth || 1) || 1;
      const c = $('click-fx'), cr = c.getBoundingClientRect(), ck = c.width / (cr.width || 1);
      return { fl: { x: (cx - fr.left) / fk, y: (cy - fr.top) / fk }, cv: { x: (cx - cr.left) * ck, y: (cy - cr.top) * c.height / (cr.height || 1) }, u: ck * k };
    }
    function floatText(text, at, kind) {
      const list = $('floaters');
      while (list.querySelectorAll('.floater').length >= 12) list.querySelector('.floater').remove();
      const el = document.createElement('span'); el.className = 'floater apoc-hit';
      const b = document.createElement('b'); b.textContent = text; el.append(b);
      el.style.left = `${at.x + Math.random() * 44 - 22}px`; el.style.top = `${at.y - 24 - Math.random() * 14}px`;   // 連點時數字不要疊成一團
      // 第七輪：數字彈出放大（樣品 B／C），越重越大
      el.style.fontSize = kind === 'kill' ? '46px' : kind === 'break' ? '44px' : kind === 'crit' ? '42px' : '30px';
      el.style.color = kind === 'crit' ? '#FFD76A' : kind === 'break' ? '#FF9A6B' : kind === 'kill' ? '#FFE9A8' : '#FFF6E6';
      list.append(el);
      // 減少動畫：數字照樣看得到，只是不飄（1.0 第 21 輪的教訓：讀數是資訊不是裝飾）
      const frames = reduced.matches
        ? [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .72 }, { opacity: 0 }]
        : [{ transform: 'translateY(0) scale(.3)', opacity: 1 }, { transform: 'translateY(-6px) scale(1.45)', opacity: 1, offset: .1 },
           { transform: 'translateY(-10px) scale(1)', opacity: 1, offset: .22 }, { transform: 'translateY(-48px)', opacity: 1, offset: .75 }, { transform: 'translateY(-66px) scale(.9)', opacity: 0 }];
      el.animate(frames, { duration: kind === 'break' || kind === 'kill' ? 1150 : kind === 'crit' ? 1000 : 760, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(() => el.remove(), () => el.remove());
    }
    // 被動傷害浮字（使用者第五輪：「2.0 似乎沒有顯示被動傷害，能加回來嗎」）：照 1.0 的 floatPassive——
    // 怪的右側、每秒一個、往上疊著慢慢淡出；減少動畫時原地淡入淡出（讀數是資訊不是裝飾，1.0 第 21 輪的教訓）。
    function floatPassive(amount) {
      if ($('game-content').classList.contains('map-open') || !$('recruit-layer').hidden || !$('apoc-enemy') || $('apoc-enemy').hidden) return;
      const p = hitPoint(null), list = $('floaters');
      // 滿了只換掉舊的被動數字；全是點擊數字就這一秒不飄（Codex 5b：不能刪掉還沒播完的破盾／擊倒數字）
      while (list.querySelectorAll('.floater').length >= 12) { const old = list.querySelector('.apoc-passive'); if (!old) return; old.remove(); }
      const el = document.createElement('span'); el.className = 'floater passive apoc-passive'; el.textContent = `-${format(amount)}`;
      el.style.left = `${p.fl.x + 96}px`; el.style.top = `${p.fl.y + 20}px`;
      list.append(el);
      const frames = reduced.matches
        ? [{ opacity: 0 }, { opacity: .9, offset: .12 }, { opacity: .9, offset: .72 }, { opacity: 0 }]
        : [{ transform: 'translateY(0)', opacity: 0 }, { transform: 'translateY(-4px)', opacity: .9, offset: .12 }, { transform: 'translateY(-30px)', opacity: .9, offset: .62 }, { transform: 'translateY(-42px)', opacity: 0 }];
      el.animate(frames, { duration: 2600, easing: 'linear' }).finished.then(() => el.remove(), () => el.remove());
    }
    function impactAt(at, k = 1) {
      const el = document.createElement('img'); el.src = 'clicker-fx-impact-burst.png'; el.alt = ''; el.className = 'small-impact apoc-hit-impact';
      el.style.left = `${at.x - 65}px`; el.style.top = `${at.y - 65}px`; $('floaters').prepend(el);   // 墊在浮字底下，不然爆擊數字被衝擊圖蓋掉
      el.animate([{ transform: `scale(${.2 * k})`, opacity: 1 }, { transform: `scale(${.55 * k})`, opacity: 1, offset: .6 }, { transform: `scale(${.7 * k})`, opacity: 0 }], 180)
        .finished.then(() => el.remove(), () => el.remove());
    }
    let shakeTimer = 0;
    function shakeStage(px, ms) {
      const st = $('stage'); st.style.setProperty('--boss-shake', `${px}px`); st.style.setProperty('--boss-shake-time', `${ms}ms`);
      st.classList.remove('boss-shake'); void st.offsetWidth; st.classList.add('boss-shake');
      // 每一下都會震：上一下的移除計時器要取消，不然普通命中後馬上擊倒，擊倒的震動會在 90ms 被切掉（Codex 第七輪）
      clearTimeout(shakeTimer); shakeTimer = setTimeout(() => st.classList.remove('boss-shake'), ms);
    }
    // 碎片是舊化的土色／鐵鏽色，火花是金色；打在護盾上火花換成冷灰藍，一聽一看就知道「在磨盾」
    function burstAt(cv, u, kind) {
      if (!window.GachaFx || !$('recruit-layer').hidden) return;   // 招募層開著時 GachaFx 的全域畫布是招募層的，不能畫過去
      window.GachaFx.init($('click-fx'));   // 招募層會把全域畫布換成自己的，回來第一下要換回舞台這張
      fx ||= window.GachaFx.createScope();
      // 第七輪：華麗版碎片＋噴金幣（兩個世界共用 ClickerHitFx）。配色跟著末世商店換上的外觀走（預設鏽鐵火花）
      const skin = A.RULES.HIT_FX.find(f => f.id === store.state?.apoc?.cosmetics?.hitFx) || A.RULES.HIT_FX[0];
      const level = HIT_LEVEL[kind] ?? 0, H = window.ClickerHitFx; if (!H) return;
      H.impact(fx, cv, level, { spark: kind === 'shield' ? skin.shield : skin.spark, shards: skin.shards, u });
      H.coins(fx, cv, H.COINS[level] * (Date.now() < (store.state.apoc?.fx?.coinUntil || 0) ? 2 : 1), { canvas: $('click-fx'), stage: $('stage'), wallet: document.querySelector('.wallet img'), floor: document.querySelector('.package-meter'), u });
    }
    const HIT_LEVEL = { hit: 0, shield: 0, crit: 1, break: 2, kill: 3 };
    // 滿版王的受擊閃光：舞台上一層白色淡入淡出（不動 DOM 結構，用 #stage 的 --flash 變數配 CSS）
    let flashEl = null;
    function flashStage(alpha) {
      if (!flashEl) { flashEl = document.createElement('div'); flashEl.id = 'apoc-flash'; $('stage').append(flashEl); }
      flashEl.animate([{ opacity: alpha }, { opacity: 0 }], { duration: 180, easing: 'ease-out' });
    }
    function hitFx(point, kind, text) {
      const p = hitPoint(point), el = $('apoc-enemy');
      floatText(text, p.fl, kind);
      if (reduced.matches) return;
      const now = performance.now();
      // 連點很快的時候碎片不必每下都噴（浮字每下都有）；爆擊／破盾／擊倒一定噴
      if (kind !== 'hit' && kind !== 'shield' || now - sparkAt > 60) { sparkAt = now; burstAt(p.cv, p.u, kind); }
      const level = HIT_LEVEL[kind] ?? 0;
      if (level) impactAt(p.fl, [0, 1, 1.4, 1.7][level]);
      shakeStage([2, 5, 8, 11][level], [90, 180, 240, 300][level]);   // 第七輪：每一下都有輕微震動（樣品 B／C），越重震越大
      if (!el) return;
      if (el.classList.contains('full-board')) {   // 滿版王：整張圖佔滿舞台，縮 5% 會晃到頭暈；改成微縮＋整面閃光＋更重的震動
        shakeStage([4, 7, 10, 13][level], [110, 200, 260, 320][level]);
        if (kind === 'kill') el.animate([{ opacity: 1, filter: 'brightness(2.6)' }, { opacity: 0, filter: 'brightness(3)' }], 700);
        else el.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: kind === 'hit' || kind === 'shield' ? 'scale(1.012)' : 'scale(1.025)', filter: `brightness(${kind === 'shield' ? 1.4 : 1.9})`, offset: .3 }, { transform: 'scale(1)', filter: 'brightness(1)' }], kind === 'hit' || kind === 'shield' ? 140 : 220);
        flashStage(kind === 'hit' || kind === 'shield' ? .18 : .32);
        return;
      }
      const shade = 'drop-shadow(0 8px 10px rgba(0,0,0,.55))';
      if (kind === 'kill') el.animate([{ transform: 'scale(1)', opacity: 1, filter: `brightness(2.4) ${shade}` }, { transform: 'scale(1.22)', opacity: 0, offset: .45 },
        { transform: 'scale(.85)', opacity: 0, offset: .55 }, { transform: 'scale(1)', opacity: 1 }], 620);
      else el.animate([{ transform: 'scale(1)', filter: `brightness(1) ${shade}` }, { transform: kind === 'hit' || kind === 'shield' ? 'scale(1.05,.93)' : 'scale(1.1,.88)', filter: `brightness(${kind === 'shield' ? 1.5 : 2.2}) ${shade}`, offset: .3 },
        { transform: 'scale(1)', filter: `brightness(1) ${shade}` }], kind === 'hit' || kind === 'shield' ? 130 : 200);
    }

    // 使用者第四輪：「打死上一隻怪物之後，下一隻出現，然後就無法點了」——以前要再按一次「開戰」。
    // 戰鬥畫面上一律自動接下一站；地圖、招募層、結局畫面開著，或隊伍是空的就不自動。
    // 「常駐」的那一站：全線通行、沒開無盡，而且回顧停在收益站（incomeIndex）上。
    // 場上有 stage 時直接看 stage.resident；重生空檔 stage 是 null，只能從這裡認。
    const residentSpot = a => a.stage ? !!a.stage.resident
      : !!a.cleared && !a.endless && a.progress >= A.RULES.STATIONS && a.revisitAt === A.incomeIndex(a);
    function autoFight() {
      const a = store.state?.apoc; if (!a?.unlocked || a.stage || store.blocked) return false;
      if ($('game-content').classList.contains('map-open') || !$('recruit-layer').hidden || !$('apoc-ending').hidden) return false;
      // 精裝典藏包是另一層（#apoc-ceremony），還沒收下的結果也算招募中：背景不要偷偷接下一站（Codex 第四輪）
      if (!$('apoc-ceremony').hidden || a.pending) return false;
      const v = view(); if (!(v.power > 0)) return false;
      // 這一站的王輸過：回前一站刷怪變強（第六輪，照 Sakura Clicker），準備好玩家自己按「再次挑戰」
      if (A.isBoss(a.progress) && a.bossFailed === a.progress) { apply((x, n) => A.fight(x, n, true), true); return !!store.state.apoc?.stage; }
      // 回顧走過的站（第十二輪）：選了就一直重打那一站，打死一隻等 FARM_RESPAWN 再來一隻。
      // ⚠ 重生空檔要直接回 false，不能往下掉：掉下去會去打「目前站」，回顧模式一秒就被自己取消，
      //   而且進度會一路衝上去（實測 8 → 19）。
      if (Number.isInteger(a.revisitAt)) {
        if (Date.now() < (a.farmNextAt || 0)) return false;
        // 重生空檔（1 秒）裡 stage 是 null，resident 旗標跟著不見了——常駐的那一站要從狀態自己認出來，
        // 不然重生回來的是「會走路」的回顧，走完一段就撞上第 19 站的機制王（任務書 A2）。
        // 手動「重打這一站」不會誤判：走完一段之後 settle 已經把 revisitAt 推到下一站，對不上常駐站。
        apply((x, n) => A.revisit(x, n, x.revisitAt, { walk: !residentSpot(x) }), true); return !!store.state.apoc?.stage;
      }
      if (!v.canFight) {
        // 全線通行之後場上不要空著（使用者指定）：常駐一隻珍母在最後一個小怪站，讓玩家點著賺錢。
        // 用回顧那條路走，所以獎勵、點擊、放置傷害全部沿用，不必另寫一套。
        // walk:false ＝常駐：永遠留在這一站。以前用會走路的回顧，18 → 19（真・滅世珍獸，60 秒機制王）→ 18 一直循環，
        // 掛機賺錢的人被 60 秒王打斷（任務書 A2）。
        if (a.cleared && !a.endless && a.progress >= A.RULES.STATIONS && Date.now() >= (a.farmNextAt || 0)) {
          apply((x, n) => A.revisit(x, n, A.incomeIndex(x), { walk: false }), true); return !!store.state.apoc?.stage;
        }
        return false;
      }
      apply((x, n) => A.fight(x, n), true);
      return !!store.state.apoc?.stage;
    }
    // 點舞台任何地方都算打怪（使用者第四輪：「點擊範圍不要只有怪物本身，空白地方也要能造成傷害」）；
    // 王的護盾照舊：每一下都算進破盾進度。受擊特效一律打在怪身上（點在空白處也是打到怪）。
    // part：王④的部位圓鈕（head／body／tail）；點舞台其他地方不帶
    function tap(point, part) {
      if (offlinePending) { offlineCheck(); if (offlinePending) return; lastTick = Date.now(); }
      if (!store.state.apoc?.stage && !autoFight()) return;
      const before = store.state.apoc;
      const b = boosted(A.normalize(before)), now = Date.now(), idx = b.stage.index;
      const dmg = A.tapDamage(b, now), crit = (b.fx?.clickLeft || 0) > 0, boss = !!b.stage.boss, wasBroken = now < (b.stage.breakUntil || 0);
      // 第十輪：這一下打在狗群或殼上（王本身不掉血）→ 演「磨盾」；扛槌兔拍子上 → 浮字寫「準！」
      const info0 = A.bossInfo(b.stage, now), absorbed = !!info0 && ((info0.mech === 0 && info0.minions > 0) || (info0.mech === 1 && info0.shellHp > 0));
      const beat = !!info0 && info0.mech === 2 && info0.onBeat;
      const events = apply((x, n) => {
        // 期限已過、下一次 tick 還沒來：先把上次結算到期限為止的放置傷害補算、分出勝負，這一下不算（Codex 5b 必修 1：
        // 以前直接 settle(…, 0)，那一段合法的放置傷害被吞掉，本來會贏的判成輸）。補算過就把 tick 的基準往前推，不重複算
        if (x.stage?.deadline && n >= x.stage.deadline) { const r = A.settle(x, n, Math.min(60, (n - lastTick) / 1000)); lastTick = n; return r; }
        return A.settle(A.tap(x, n, { part }), n, 0);
      }, true);
      if (!events.length && store.state.apoc === before) return;   // commit 被擋（存檔鎖住之類）就不演
      const after = store.state.apoc, won = events.some(e => e.type === 'win' || e.type === 'farm' || e.type === 'wave');
      if (!!before?.fx?.mythic !== !!after?.fx?.mythic) window.ClickerMusic?.sync(store.state);   // 神話技能的 10 下用完：技能曲收掉
      if (!(dmg > 0) && !won) return;   // 期限已過的點擊不算傷害，也不演受擊（下一次結算判輸）
      const broke = boss && !wasBroken && !won && after.stage?.index === idx && (after.stage.breakUntil || 0) > now;
      sound(broke ? 'skill' : crit ? 'skill' : 'click');
      const kind = won ? 'kill' : broke ? 'break' : crit ? 'crit' : absorbed ? 'shield' : 'hit';
      const hit = after.lastHit || { damage: dmg, coins: 0, capped: false };
      hitFx(null, kind, `${broke ? '破防！' : beat ? '準！' : ''}-${format(hit.damage)}${hit.capped ? ' 盾' : ''}${hit.coins > 0 ? `\n+${format(hit.coins)} 幣` : ''}`);
      const floater = $('floaters').lastElementChild;
      if (floater?.classList.contains('apoc-hit')) { floater.classList.toggle('apoc-coin-hit', hit.coins > 0); floater.dataset.damage = hit.damage; floater.dataset.capped = hit.capped; }   // dmg 0 還贏＝期限前的放置傷害補算打死的
      renderMech(store.state.apoc?.stage);
    }
    function tick() {
      if (offlinePending) { offlineCheck(); if (offlinePending) return; lastTick = Date.now(); }   // 離線收益還沒入帳：先補，補不進去就整個 tick 不跑
      const now = Date.now(), dt = Math.min(60, (now - lastTick) / 1000); lastTick = now;
      const was = store.state.apoc?.stage, hp0 = was?.hp, idx0 = was?.index;
      const events = apply((x, n) => A.settle(x, n, dt), true);
      // 第十輪 D 派遣時間到：自動收回入帳
      if ((store.state.apoc?.dispatch || []).some(d => d.until <= now)) {
        const before = store.state.apoc; let got = [];
        apply((x, n) => { const r = A.collectDispatch(x, n); got = r.rewards; return r.state; }, true);
        if (got.length && store.state.apoc !== before) {
          const coins = got.reduce((sum, r) => sum + r.coins, 0), t = got.reduce((sum, r) => sum + r.ticket, 0);
          sound('transcend'); notice(`派遣回來 ${got.length} 位：＋${format(coins)} 末世金幣${t ? `，還撿到 ${t} 張券！` : ''}`);
        }
      }
      // 被動傷害：這一秒的結算沒有點擊，同一場戰鬥少掉的血就是隊伍放著打的量
      const st = store.state.apoc?.stage;
      if (st && was && st.index === idx0 && hp0 - st.hp > 0) floatPassive(hp0 - st.hp);
      // 放著被隊伍打死也要有擊倒演出（點死的那一下由 tap() 自己演）；地圖蓋著舞台時不演
      window.ClickerMusic?.sync(store.state);   // 第八輪：一站一首——換站、刷怪回前一站時換曲（沒變就什麼都不做）
      if (events.some(e => e.type === 'win' || e.type === 'farm' || e.type === 'wave') && !$('game-content').classList.contains('map-open') && $('recruit-layer').hidden) hitFx(null, 'kill', '擊倒！');
      autoFight();
    }

    // ---- 王關機制的畫面（第十輪）：標籤文字、狗群列、殼的外框、節拍光圈、部位圓鈕
    const PART_NAME = { head: '頭', body: '身', tail: '尾' };
    const MECH_NAME = ['狗群', '外殼', '節拍', '部位'];
    function mechText(info) {
      const sec = ms => Math.max(0, Math.ceil(ms / 1000));
      // ⚠ 字要短：手機截圖看過，滅世珍獸「輪到狗群（15 秒後換）｜狗群擋路：…」會斷兩行、超出舞台右邊
      const head = info.rotating ? `${MECH_NAME[info.mech]}・${sec(info.rotateIn)}秒後換｜` : '';
      if (info.breaking) return `${head}破防！傷害 ×2・剩 ${sec(info.breakLeft)} 秒`;
      if (info.mech === 0) return head + (info.minions > 0 ? `狗群剩 ${info.minions} 隻，清光才打得到王` : `王露出來了！狗群 ${sec(info.respawnIn)} 秒後再來`);
      if (info.mech === 1) return head + (info.shellHp > 0 ? `外殼 ${info.shellLayer + 1}/${info.shellLayers}：點擊剝殼・剩 ${format(info.shellHp)}` : `已剝殼 ${info.shellLayer}/${info.shellLayers}・打下去還會長殼`);
      if (info.mech === 2) return `${head}照槌子落地的拍子點・連中 ${info.chain}/${info.chainNeed}`;
      return `${head}照順序點亮的部位：${PART_NAME[info.nextPart] || ''}（${info.step}/${info.steps}）`;
    }
    let mechKey = '';
    function renderMech(st) {
      const stage = $('stage'), enemy = $('apoc-enemy');
      let parts = $('apoc-parts'), beat = $('apoc-beat'), dogs = $('apoc-minions');
      if (!parts) {
        parts = document.createElement('div'); parts.id = 'apoc-parts';
        for (const id of ['head', 'body', 'tail']) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.part = id; b.textContent = PART_NAME[id]; b.setAttribute('aria-label', `點${PART_NAME[id]}`);
          // 圓鈕自己吃掉這一下（不要再往下傳到舞台的點擊區，不然一下算兩次）
          b.addEventListener('pointerdown', e => e.stopPropagation());
          b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); tap(null, id); });
          parts.append(b);
        }
        beat = document.createElement('div'); beat.id = 'apoc-beat'; beat.setAttribute('aria-hidden', 'true');
        dogs = document.createElement('div'); dogs.id = 'apoc-minions'; dogs.setAttribute('aria-hidden', 'true');
        stage.append(beat, dogs, parts);
      }
      const now = Date.now(), info = st?.boss ? A.bossInfo(st, now) : null, m = info ? info.mech : -1;
      const eb = enemy && !enemy.hidden ? { l: enemy.offsetLeft, t: enemy.offsetTop, w: enemy.offsetWidth, h: enemy.offsetHeight } : null;   // 置中用 translate(-50%,-50%)
      // 部位圓鈕：頭在左上、身在中間、尾在右邊（雞頭合成怪面向左）
      parts.hidden = m !== 3 || !eb;
      if (!parts.hidden) {
        // 截圖看過：頭再往上會壓到效果標籤；尾巴在右側偏高的地方
        // 滿版王（滅世珍獸）的 #apoc-enemy 是鋪滿舞台的 632×360、左上角在 (−12,0)，不是置中的那套座標：
        // 用中心式的比例算，頭跟尾會落到舞台外、身體壓在左上角的效果標籤底下（朋友 2026-09-16：「跑位，看不到身體標記」）。
        // 滿版改用「舞台的比例」直接釘在珍獸身上：頭＝臉、身＝肚子、尾＝右下的尾巴。
        const full = enemy.classList.contains('full-board');
        const pos = full ? { head: [.50, .46], body: [.76, .46], tail: [.88, .74] } : { head: [-.28, -.14], body: [.02, .12], tail: [.4, -.02] };
        for (const b of parts.children) {
          const [dx, dy] = pos[b.dataset.part];
          b.style.left = `${eb.l + dx * eb.w}px`; b.style.top = `${eb.t + dy * eb.h}px`;
          b.classList.toggle('next', b.dataset.part === info.nextPart);
        }
      }
      // 節拍光圈：跟扛槌兔的揮槌同一個週期；每一場開打時把動畫對齊到 startedAt
      beat.hidden = m !== 2 || !eb;
      const key = info ? `${st.startedAt}:${m}` : '';
      if (!beat.hidden) {
        beat.style.left = `${eb.l}px`; beat.style.top = `${eb.t + eb.h * .08}px`;   // 圈在兔子身上（截圖看過：放腳下會蓋到技能格的字）
        if (key !== mechKey) {
          // 重新掛動畫再對齊（Codex 第十輪 A 必修 3：分頁隱藏時動畫被取消，只改負延遲不會重新開始）
          const delay = `-${(now - (st.startedAt || 0)) % info.beatMs}ms`;
          beat.style.setProperty('--beat-ms', `${info.beatMs}ms`); beat.style.animationDelay = delay;
          beat.classList.remove('on'); void beat.offsetWidth; beat.classList.add('on');
          if (enemy.classList.contains('apoc-sprite')) { enemy.style.animationName = 'none'; void enemy.offsetWidth; enemy.style.animationName = ''; enemy.style.animationDelay = delay; }
        }
      }
      mechKey = key;
      // 狗群：王待在遠處（變小變暗），前面排一列小狗
      const dogCount = m === 0 ? info.minions : 0;
      dogs.hidden = !dogCount || !eb;
      if (!dogs.hidden) {
        if (dogs.childElementCount !== dogCount) dogs.replaceChildren(...Array.from({ length: dogCount }, () => { const i = document.createElement('i'); return i; }));
        // 滿版王（真・滅世珍獸）的框是整個舞台，錨點會跑到左上；狗群固定排在右下（技能鍵 x 44～336、y 224～288 之外）
        if (enemy.classList.contains('full-board')) { dogs.style.left = '345px'; dogs.style.top = '250px'; }   // 五隻 50px 從 345 排到 595，不出舞台（實測 470 會被右緣切掉兩隻）
        else { dogs.style.left = `${eb.l}px`; dogs.style.top = `${eb.t + eb.h * .42}px`; }
      }
      if (enemy) {
        enemy.classList.toggle('far', dogCount > 0);
        enemy.classList.toggle('shelled', m === 1 && info.shellHp > 0);
        enemy.classList.toggle('breaking', Date.now() < (st?.breakUntil || 0));
      }
    }

    // ---- 舞台：把 1.0 的拆包面換成打怪面（同一組節點，換內容）
    // 第十輪 B 王前預告關：下一隻王的打法（字要短，手機直式最多兩行）
    const OMEN_HINT = ['狗群擋在王前面，先清光才打得到', '會長殼：只有點擊剝得掉，放著打不動', '跟著槌子落地的拍子點，踩中傷害 ×3',
      '照亮起的部位順序點，點對一輪就破防', '前四種打法每 15 秒輪流換'];
    // 第十輪 B 2.0 新手引導：四步，第 N 步在條件成立時冒出來、按「知道了」才前進（存在 apoc.tutorial）。
    //   打過第 4 站的舊存檔（朋友試玩的存檔）不冒，免得老手被當新手
    const COACH = [
      // ⚠ 第 0 步不能等「還沒開戰」：tick 一能打就自動開戰（自動接關），第一次進來馬上就有 stage（batch_b 驗收抓到）
      { when: () => true, text: '末世：編隊裡的卡才有戰力，隊伍會一站站打下去' },
      { when: a => !!a.stage && !a.stage.boss && !a.stage.farm, text: '點怪就能打，隊伍放著也會打；一般站要打 5 隻' },   // Codex 10B 必修：刷怪固定一隻，不能講 5 隻
      { when: a => a.progress >= 1, text: '打怪賺末世金幣：拿去「全隊訓練」或「進入招募」變強' },
      { when: a => a.progress >= 3, text: '每 4 站一隻王：限時 60 秒，照提示打' },   // 手機直式兩行會剩一個字掉下去，縮短
    ];
    function coach(v) {
      const a = store.state.apoc, step = a?.tutorial || 0, c = a && a.progress < 4 && COACH[step];
      const show = !!c && c.when(a) && !store.blocked && $('recruit-layer').hidden && $('apoc-ceremony').hidden;
      let el = $('apoc-coach');
      if (!el && show) {
        el = document.createElement('div'); el.id = 'apoc-coach'; el.setAttribute('role', 'status');
        const text = document.createElement('span'), ok = document.createElement('button'); ok.type = 'button'; ok.textContent = '知道了';
        ok.addEventListener('pointerdown', e => e.stopPropagation());   // 不要被舞台當成點怪
        ok.addEventListener('click', e => { e.stopPropagation(); const at = store.state.apoc?.tutorial || 0; apply(x => ({ ...x, tutorial: Math.min(4, at + 1) }), true); render(); });
        el.append(text, ok); $('stage').append(el);
      }
      if (el) { el.hidden = !show; if (show && el.firstChild.textContent !== c.text) el.firstChild.textContent = c.text; }
      $('stage').classList.toggle('coaching', show);
    }
    function renderStage(v) {
      let el = $('apoc-enemy');
      if (!el) {
        el = document.createElement('img'); el.id = 'apoc-enemy'; el.alt = ''; el.draggable = false;
        $('stage').insertBefore(el, $('bag'));
      }
      // 刷怪兩場之間有 1 秒空檔（Codex 第六輪必修：限制刷怪重新開場）：空檔照樣畫前一站、寫刷怪中，不要閃成王
      const farmGap = !v.stage && store.state.apoc?.bossFailed === v.progress && A.isBoss(v.progress) && v.progress > 0 && (v.endless || v.progress < v.stations);
      // 回顧的重生空檔（1 秒）也要維持在回顧的那一站，不然標籤會閃回「第 N 站・按開戰開始」
      const revGap = !v.stage && Number.isInteger(v.revisitAt), rev = !!v.stage?.revisit || revGap;
      const i = v.stage ? v.stage.index : revGap ? v.revisitAt : farmGap ? v.progress - 1 : v.progress;
      const boss = v.stage ? v.stage.boss : (revGap || farmGap) ? false : A.isBoss(i);
      $('stage').dataset.apocSeg = String(Math.floor(Math.min(i, 19) / 4) + 1);   // 舞台背景跟著這一段的地景換（apoc/theme.css）
      const art = enemyArt(Math.min(i, 19), boss);
      if (el.getAttribute('src') !== art.src) {
        el.setAttribute('src', art.src);
        // 逐格的王：動畫表當背景一格一格硬切（見 clicker.css .apoc-sprite）；單張的直接用 <img>
        el.classList.toggle('apoc-sprite', art.frames > 1);
        el.style.backgroundImage = art.frames > 1 ? `url("${art.src}")` : '';
        el.style.setProperty('--frames', art.frames); el.style.setProperty('--frame-ms', `${art.ms || 100}ms`);
        el.style.height = art.h ? `${art.h}px` : ''; el.style.width = art.h ? `${Math.round(art.h * art.aspect)}px` : '';
        el.style.top = art.h ? `${ENEMY_FLOOR - art.h / 2}px` : '';   // 王依高度貼齊技能鍵上緣（translate -50% 是以中心定位）
        el.classList.toggle('full-board', !!art.full);
      }
      el.classList.toggle('boss', !!boss);
      $('stage').classList.toggle('apoc-final', !!boss && !!art.full && !!v.stage);   // 滿版王：整個舞台就是王關
      // 回顧／常駐的那隻也是怪：場上有 stage 就不算走完（不然全線通行之後怪會被藏起來）
      const over = !v.stage && !revGap && v.progress >= (v.endless ? A.RULES.ENDLESS_MAX : v.stations);   // 第十輪 C：無盡模式第 21 站起照樣有怪；打到 ENDLESS_MAX 才算到底（Codex 10C 值得修）
      el.hidden = over;

      document.querySelector('.package-meter').hidden = false;
      const failed = (!v.stage || !!v.stage.farm) && store.state.apoc?.bossFailed === v.progress;   // 這一站的王輸過（輸了從滿血重來；第六輪起在前一站刷怪）
      const idleNeed = (farmGap || revGap) ? A.need(i, { laps: v.laps }) : v.need;   // 第二圈的刷怪空檔也要帶圈數（Codex 10C 值得修）
      const hp = v.stage ? Math.max(0, v.stage.hp) : idleNeed, max = v.stage ? v.stage.need : idleNeed;
      $('package-label').textContent = over ? (v.endless ? '無盡模式到底了' : '全線已通行') : `${i >= v.stations ? '無盡・' : ''}第 ${i + 1} 站${boss ? (rev ? '・王關回顧' : '・王關') : rev ? `${v.progress >= v.stations ? '・常駐' : '・回顧'}${v.stage?.waves > 1 ? ` ${v.stage.wave}/${v.stage.waves}` : ''}` : (v.stage?.farm || farmGap) ? '・刷怪中' : v.stage?.waves > 1 ? `・${v.stage.wave}/${v.stage.waves}` : ''}`;
      $('package-progress').max = 1; $('package-progress').value = max ? Math.min(1, 1 - hp / max) : 0;
      $('package-number').textContent = over ? (v.endless ? `${A.RULES.ENDLESS_MAX} 站` : `${v.stations} / ${v.stations}`) : `${format(hp)} / ${format(max)}`;

      // 王關機制與破防：借用「效果標籤」那一格（第十輪：五種機制各寫各的）
      const label = $('effect-label'), now = Date.now(), info = v.stage && v.stage.boss ? A.bossInfo(v.stage, now) : null;
      // 第十輪 B 王前預告關：王前一站（index %4 === 2）舞台一圈暗紅，標籤寫下一隻王的名字與打法
      const omen = !!v.stage && !v.stage.boss && !v.stage.farm && v.stage.index % 4 === 2 && v.stage.index < 19;
      $('stage').classList.toggle('apoc-omen', omen);
      label.classList.toggle('omen', omen && !info);
      label.hidden = !info && !omen;
      if (omen && !info) {
        const seg = Math.floor(v.stage.index / 4);
        const text = `前方預告・${BOSSES[seg].name}｜${OMEN_HINT[seg]}`;
        if (label.textContent !== text) label.textContent = text;   // Codex 10B 值得修：同樣的字不重設（render 一秒好幾次）
        label.classList.remove('broken', 'urgent');
      }
      coach(v);
      if (info) {
        // 王關 60 秒倒數放最前面，跟破防秒數分開寫（Codex 第五輪必修 1：看不到倒數就直接判輸）
        const left = v.stage.deadline ? Math.max(0, Math.ceil((v.stage.deadline - now) / 1000)) : null;
        label.textContent = (left !== null ? `王關剩 ${left} 秒｜` : '') + mechText(info);
        label.classList.toggle('broken', info.breaking);
        label.classList.toggle('urgent', left !== null && left <= 10);
      }
      renderMech(v.stage);

      // 「開戰」沿用 1.0 的挑戰鍵
      const go = $('boss-challenge');
      go.hidden = (!!v.stage && !v.stage.farm) || over;   // 刷怪中也要看得到「再次挑戰」
      // 全線通行後的常駐怪（回顧路）：這顆鍵按下去是 fight()，而 canFight 早就是 false（進度 20/20），
      // 使用者 2026-09-14：「最後的開戰不能點」——沒有目標站可回，直接藏掉。
      if (rev && v.progress >= v.stations && !v.endless) go.hidden = true;
      if (rev && v.progress < v.stations) { go.hidden = false; }   // 回顧中留一個回得去的鍵
      go.disabled = (rev ? false : !v.canFight) || !(v.power > 0) || store.blocked;
      // 冷卻中寫出還要等幾秒，不然停用的「再次挑戰」看起來像壞掉（Codex 第五輪）
      const wait = Math.max(0, Math.ceil((v.cooldownUntil - Date.now()) / 1000));
      go.textContent = rev && v.progress < v.stations ? '回到目前站' : !(v.power > 0) ? '先去編隊' : A.isBoss(v.progress) ? (store.state.apoc?.bossFailed === v.progress ? (wait ? `再次挑戰・${wait}秒` : '再次挑戰') : '挑戰王關') : '開戰';
      go.classList.toggle('glow', !!(v.canFight && v.power > 0));
      $('package-result').textContent = over ? (v.endless ? '無盡模式到底了。' : '全線已通行。')
        : failed ? (v.canFight ? '王關失敗：在前一站刷錢變強，準備好就按「再次挑戰」。' : '王關失敗：先在前一站刷錢變強，冷卻結束後可以「再次挑戰」。')
        : rev ? (v.progress >= v.stations ? '全線已通行：這一隻會一直在，點著賺錢就好。' : `回顧第 ${i + 1} 站：從這裡往下走到這一段的王為止，不會推進度。要回去推進度就按下面的「回到目前站」。`)
        : v.stage ? '點怪攻擊；隊伍放著也會打。'
        : '按「開戰」開始。';
      // 1.0 的這一格平常透明、只在完成一包時閃一下；末世輸了王要一直看得到（Codex 5b）
      $('package-result').classList.toggle('apoc-shown', failed && !over);
    }

    function renderBuddies(v) {
      const map = byId(), host = $('buddies');
      // 末世可以編 20 張，只畫前十張的話後十張在主畫面看不到也拖不到（Codex 第二輪 B11）
      const pages = Math.max(1, Math.ceil(v.roster.length / 10));
      buddyPage = Math.min(buddyPage, pages - 1);
      const key = JSON.stringify([v.roster, v.skills, v.collection, buddyPage]);
      // 快取只在「這塊還是末世畫的」時才算數：共用節點被桌邊的 renderer 蓋過就要重畫
      if (key === buddyKey && host.dataset.world === 'apoc') return; buddyKey = key;
      host.replaceChildren(); host.dataset.world = 'apoc';
      $('buddy-page').textContent = `${buddyPage + 1}/${pages}`;
      $('buddy-prev').disabled = buddyPage === 0; $('buddy-next').disabled = buddyPage + 1 >= pages;
      if (!v.roster.length) { host.textContent = '隊伍是空的。到「編隊」把卡放進來。'; return; }
      for (const id of v.roster.slice(buddyPage * 10, buddyPage * 10 + 10)) {
        const entry = map[id]; if (!entry) continue;
        const el = document.createElement('button'); el.className = 'buddy'; el.dataset.id = id;
        el.title = `${entry.name}・查看卡冊`; el.style.setProperty('--rarity', RARITY[entry.rarity]);
        const portrait = document.createElement('span'); portrait.className = 'buddy-portrait holo-slot'; portrait.append(faceOf(entry));
        const name = document.createElement('b'); name.textContent = entry.name;
        // 第十一輪：星數不再等於張數（8 顆粉塵封頂 5★），突破接在後面變成第 6～10 顆星。
        // 使用者：「★5＋5 我希望直接改成 6~10」——畫面上是一條連續的 1～10。
        const st = v.stars?.[id] || 1, tr = v.transcend?.[id] || 0;
        const stars = document.createElement('span'); stars.className = 'buddy-stars'; stars.textContent = `★${st + tr}`;
        stars.title = tr ? `${st + tr} 星（前 5 星靠升星，第 6～10 星靠突破）` : `${st} 星`;
        el.append(portrait, name, stars);
        const slot = v.skills.indexOf(id);
        if (slot >= 0) { const stamp = document.createElement('small'); stamp.className = 'slot-stamp'; stamp.textContent = `槽${slot + 1}`; el.append(stamp); }
        el.onclick = () => openRoster(id);
        host.append(el);
      }
    }

    // 技能施放：跟 1.0 同一套切入演出（使用者：「技能點下去也要有跟 1.0 一樣的施放效果」）
    const SKILL_COLOR = { common: ['#A9A297', '#7E776C'], rare: ['#94BED0', '#5E93AA'], epic: ['#B8A2CF', '#80679E'],
      legendary: ['#E9B94E', '#B8862A'], mythic: ['#FF4FD8', 'conic-gradient(#ff4fd8,#ffb347,#fff275,#7dff9c,#5ad7ff,#b48bff,#ff4fd8)'] };
    function cast(i) {
      if (cutin?.active) return;
      const before = view(), def = before.skillDefs[i], id = before.skills[i], entry = byId()[id];
      if (!def || !entry) return;
      const events = apply((x, n) => A.useSkill(x, i, n));
      const after = view(); if ((after.skillCd?.[i] || 0) === (before.skillCd?.[i] || 0)) return;   // 冷卻中之類被擋下，apply 已經講原因
      const d = A.RULES.SKILLS[entry.role][entry.rarity], stamp = d.kind === 'cool' ? `−${d.value / 1000} 秒` : d.kind === 'coin' ? `+${+(d.value * 100).toFixed(4)}%` : d.kind === 'breach' ? `${d.ms / 1000} 秒` : `×${d.value}`;
      if (entry.role === 'breach' && (store.state.apoc?.stage?.breakUntil || 0) > Date.now() && (store.state.apoc.stage.skillBreaks || 0) <= 2) { shakeStage(8, 240); renderMech(store.state.apoc.stage); }
      const [color, stripe] = SKILL_COLOR[entry.rarity] || SKILL_COLOR.rare;
      const name = def.name.length >= 6 ? def.name.slice(0, Math.floor(def.name.length / 2)) + '\n' + def.name.slice(Math.floor(def.name.length / 2)) : def.name;
      cutin?.play({ source: id, entry: { ...entry, rarity: entry.rarity }, actor: () => faceOf(entry),
        spec: { side: 'left', color, stripe, name, sub: () => def.text, stamp: () => stamp } });
      window.ClickerMusic?.sync(store.state);   // 第八輪：神話卡一放下去就疊上神話技能曲（技能曲本身延後 260ms 起步，對齊切入的撞擊）
      return events;
    }

    function renderSlots(v) {
      const map = byId(), host = $('slots'), now = Date.now();
      const key = JSON.stringify([v.skills, v.skillDefs.map(d => d && d.name), v.skillSlots]);
      if (key === slotKey && host.dataset.world === 'apoc') { updateSlots(v, now); return; }
      slotKey = key;
      host.replaceChildren(); host.dataset.world = 'apoc';
      for (let i = 0; i < 4; i++) {
        const id = v.skills[i], def = v.skillDefs[i], entry = id ? map[id] : null;
        const wrap = document.createElement('article'); wrap.className = 'skill-slot';
        const b = document.createElement('button'); b.className = 'skill-use'; b.dataset.slot = i;
        const locked = i === 3 && v.skillSlots < 4;   // 印記重設計：第四格要在印記商店買「第四技能槽」
        if (locked) { const lock = document.createElement('span'); lock.className = 'slot-empty slot-locked'; lock.textContent = '🔒'; b.append(lock); }
        else if (entry) b.append(stickerOf(entry));
        else { const plus = document.createElement('span'); plus.className = 'slot-empty'; plus.textContent = '＋'; b.append(plus); }
        // 上鎖的第四格直接把印記商店開起來（任務書 A4）：只丟一句「去印記商店買」，2.0 玩家想不到那是「換桌布」面板
        b.title = locked ? '第四技能格：點一下直接去印記商店買「第四技能槽」（3 印記）' : def ? `${def.card}・${def.text}` : '點一下去編隊，把卡放進獨立技能格';
        b.onclick = () => locked ? (notice('第四技能格在印記商店解鎖'), openMarks?.()) : def ? cast(i) : openTeam();
        const name = document.createElement('span'); name.className = 'skill-name';
        wrap.append(b, name); host.append(wrap);
      }
      updateSlots(v, now);
    }
    // 技能格是圓形貼紙頭像（使用者第三輪：「技能格不要把整張卡放上去（不好看）」，跟 1.0 一樣）：
    // 外圈稀有度色、裡面是精裝卡的主體圖，取景由 tools/apoc/build_sticker.py 算好（window.ApocSticker）。
    const stickerOf = sticker;

    // 每秒只更新會變的：冷卻秒數與可按狀態（不重建節點，焦點與拖曳才不會被打斷）
    function updateSlots(v, now) {
      const host = $('slots');
      for (let i = 0; i < 4; i++) {
        const slot = host.children[i], b = slot?.querySelector('.skill-use'), name = slot?.querySelector('.skill-name');
        if (!b) continue;
        const def = v.skillDefs[i], until = v.skillCd && v.skillCd[i] || 0, left = Math.max(0, Math.ceil((until - now) / 1000));
        // 空格要能點（點了就去編隊）；只有「發動技能」才受戰鬥中／冷卻限制（Codex 複檢 3-3）
        b.disabled = store.blocked || (!!def && (!!left || !v.stage));
        if (name) name.textContent = (i === 3 && v.skillSlots < 4) ? '未解鎖' : def ? (left ? `${def.name}・${left}s` : def.name) : '選夥伴';
        // 冷卻用 1.0 同一個圓形遮罩（.skill-slot[data-state="cooldown"] .skill-use::after 讀 --cooldown）
        slot.dataset.state = !def ? 'empty' : left ? 'cooldown' : v.stage ? 'ready' : 'unavailable';
        if (def) b.title = `${def.card}・${A.skillInfo(v.skills[i], { boss: !!v.stage?.boss }).text}`;
        slot.dataset.role = def?.role || '';
        slot.classList.toggle('coin-active', def?.role === 'coin' && now < (v.fx?.coinUntil || 0));
        slot.classList.toggle('idle-active', def?.role === 'idle' && now < (v.fx?.idleUntil || 0));
        slot.classList.toggle('resisted', !!v.stage?.boss && ['open', 'breach', 'coin'].includes(def?.role));
        $('buddies')?.classList.toggle('apoc-frenzy', now < (v.fx?.idleUntil || 0));
        const total = def ? A.RULES.SKILLS[def.role]?.[def.rarity]?.cd || 60000 : 1;
        slot.style.setProperty('--cooldown', `${Math.min(1, Math.max(0, until - now) / total) * 360}deg`);
      }
    }
    function renderShop(v) {
      // 使用者第三輪選 A：三張卡跟 1.0 一一對應——點擊力｜全隊訓練｜招募。前兩張花末世金幣；
      // 招募的兩顆鍵由 clicker-gacha.js 的 priceButton 統一畫（先用券、不夠才付末世金幣）。
      // ⚠ 這是改 1.0 的靜態文字，第一次改之前要把原文存起來，leave() 要還回去，
      //   不然從末世切回桌邊會看到「點擊力」掛在攻擊力那張卡上。
      const h2 = document.querySelectorAll('#shop h2'), T = A.RULES.TRAIN;
      setLabel(h2[0], '點擊力 '); setLabel(h2[1], '全隊訓練 ');
      setLabel(document.querySelector('#shop .recruit small'), '隊伍裡的卡才有戰力');
      $('click-level').textContent = `Lv.${v.clickLevel}`;
      $('click-next').textContent = `點一下 ${format(v.tapDamage)} → ${format(v.tapDamage * (1 + T.click.MUL))}`;
      $('click-price').textContent = format(v.clickCost);
      $('training-level').textContent = `Lv.${v.teamLevel}`;
      $('training-next').textContent = `全隊戰力 ×${v.teamMul.toFixed(2)} → ×${(v.teamMul * (1 + T.team.MUL)).toFixed(2)}`;
      $('training-price').textContent = format(v.teamCost);
      for (const [type, cost] of [['click', v.clickCost], ['training', v.teamCost]]) {
        $(`${type}-one`).textContent = '升級！';
        $(`${type}-one`).disabled = $(`${type}-max`).disabled = v.coins < cost || store.blocked;
      }
      $('draw-price').textContent = v.tickets ? `券 ×${v.tickets}` : format(v.drawCost1);
      $('draw-ticket').title = `末世券只能用桌邊金幣換；抽卡先用券，不夠才付末世金幣（下一抽付現 ${format(v.drawCostNext)}）`;
      // 朋友回饋：「我發現只是抽卡而已，下一次抽卡也會變貴，這樣單抽不就很虧」。
      // 其實只有**付金幣**的那一抽才會漲（用券抽不算 paidDraws），而且十連的每抽均價跟單抽一樣——
      // 漲價是按「第幾次付費抽」算的，不是按「按了幾次按鈕」。這件事以前只寫在 tooltip 裡，等於沒講。
      let note = $('draw-growth');
      if (!note) { note = document.createElement('small'); note.id = 'draw-growth'; $('single-note').after(note); }
      const pct = ((A.RULES.DRAW_GROWTH - 1) * 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      note.textContent = v.tickets
        ? `用券抽不漲價（還有 ${v.tickets} 張）；券用完後一抽 ${format(v.drawCostNext)}`
        : `每付費抽一次漲 ${pct}%・十連 ${format(v.drawCost10)}（每抽 ${format(Math.round(v.drawCost10 / 10))}，跟單抽一樣）`;
      // 換券入口：招募卡下面一行小字（樣張 A）→ 打開商店的兌換所
      let link = $('apoc-exchange');
      if (!link) { link = document.createElement('button'); link.id = 'apoc-exchange'; link.type = 'button'; link.className = 'text-button'; link.onclick = () => openShop(); $('recruit-open').after(link); }
      // ⚠ 字要短：直式時這一行跟價牌共用一欄，寫成「用桌邊金幣換券（今天 0 張）」會把欄撐寬、十連鍵被擠出畫面
      link.textContent = '用桌邊金幣換券'; link.title = `打開末世商店的兌換所（今天換了 ${v.exchangeToday} 張）`;
    }

    // 換券的定價基準＝1.0「每秒收益」，但要取**歷史最高**（1.0 的「每秒破 10^n」紀錄 peakRateStamp，只會往上）。
    // ⚠ 只用當下的每秒收益會被鑽漏洞：把 1.0 隊伍換成一張弱卡、每秒收益掉到很低，券價就跟著變很便宜。
    // ⚠ peakRateStamp 只存指數（9e10 只記成 10），換弱隊仍能把價格壓到九分之一（Codex 第三輪）→ 另存精確值 apoc.onePeak（clicker.js 每秒記）。
    const oneRate = s => Math.max(window.ClickerEconomy.rates(s).P || 0, s.apoc?.onePeak || 0, s.peakRateStamp ? 10 ** s.peakRateStamp : 0);
    // ---- 1.0 金幣換券（時薪券）：錢從桌邊扣、券進末世，同一次提交
    function exchangeTicket() {
      const s = store.state; if (!s?.apoc?.unlocked) return false;
      try {
        const next = JSON.parse(JSON.stringify(s)), oneP = oneRate(s);
        const r = A.exchange(A.normalize(next.apoc), next.coins, oneP, Date.now());
        next.apoc = r.state; next.coins -= r.cost;
        if (!commit(next)) return false;
      } catch (err) { notice(err.message); return false; }
      sound('upgrade'); notice('換到一張末世券'); changed(); return true;
    }
    function train(kind, max) {
      const key = kind === 'team' ? 'teamLevel' : 'clickLevel', before = view()[key];
      apply(x => A.train(x, kind, max));
      const got = view()[key] - before;
      if (got > 0) { sound('upgrade'); if (max && got > 1) notice(`${kind === 'team' ? '全隊訓練' : '點擊力'} +${got} 級`); }
    }

    // ---- 商店（頁尾「商店」，兩個世界同一顆鍵）：末世版＝兌換所（桌邊金幣→券）＋受擊特效外觀（末世金幣）
    //      借 1.0 商店的面板（標題、返回鍵、Esc 都共用），內容自己畫
    let shopPending = null, shopKey = '';
    function openShop() { shopPending = null; shopKey = ''; $('wardrobe').hidden = false; $('game-content').inert = true; renderShopPanel(); $('wardrobe-close').focus(); }
    function renderShopPanel() {
      if ($('wardrobe').hidden || store.state?.settings.world !== 'apoc') return;
      const s = store.state, a = A.normalize(s.apoc), now = Date.now(), oneP = oneRate(s);
      const cost = A.exchangeCost(a, oneP, now), today = A.exchangeToday(a, now);
      // 每秒都會叫到：內容沒變就不重建（焦點才不會被打掉）
      // ⚠ 不能放每秒都在長的餘額：金額一變就整片重建，Tab 停在按鈕上的焦點會被刪掉（Codex 第三輪）
      const key = JSON.stringify([Math.floor(s.coins), oneP, a.tickets, today, a.cosmetics, A.RULES.HIT_FX.map(f => a.coins >= f.price), store.blocked, shopPending]);
      if (key === shopKey) return; shopKey = key;
      $('shop-title').textContent = '末世商店'; $('wardrobe-price').textContent = '';
      $('shop-back').hidden = true; $('wardrobe-body').hidden = true; $('shop-cats').hidden = false;
      $('shop-hint').textContent = '券只能用桌邊金幣換，比值故意很差——桌邊溢出來的錢總算有地方去。外觀買了永久保留。';
      const host = $('shop-cats'); host.replaceChildren();
      const sec = (title, sub) => {
        const el = document.createElement('section'); el.className = 'apoc-shop-sec';
        const h = document.createElement('h3'); h.textContent = title; const p = document.createElement('p'); p.textContent = sub;
        el.append(h, p); host.append(el); return el;
      };
      const ex = sec('兌換所', `桌邊金幣 ${format(s.coins)}・桌邊每秒 ${format(oneP)}・手上 ${a.tickets} 張券`);
      const line = document.createElement('p'); line.className = 'apoc-shop-line';
      line.textContent = Number.isFinite(cost)
        ? `下一張券：${format(cost)} 桌邊金幣（今天第 ${today + 1} 張；每多換一張 ×${A.RULES.EXCHANGE.GROWTH}，明天回原價）`
        : '桌邊還沒有每秒收益，換不了券';
      const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'apoc-exchange-one'; btn.textContent = '換一張券';
      btn.disabled = store.blocked || !(s.coins >= cost);
      btn.onclick = () => { exchangeTicket(); renderShopPanel(); };
      ex.append(line, btn);
      // 印記商店的導線（任務書 A4）：第四技能槽、派遣位、王關 +15 秒這些都在 1.0 的印記商店，
      // 但 2.0 玩家要先想到「換桌布」那個面板才找得到。這裡放一顆直達鍵。
      const mk = sec('印記商店', '第四技能槽、第 4 個派遣位、王關 +15 秒、離線 12 小時都在 1.0 的印記商店（換桌布 → 神器與商店），用印記買。');
      const goMk = document.createElement('button'); goMk.type = 'button'; goMk.id = 'apoc-marks-go'; goMk.textContent = '前往';
      goMk.title = '打開印記商店（換桌布 → 神器與商店）';
      goMk.onclick = () => { $('wardrobe').hidden = true; openMarks?.(); };
      mk.append(goMk);
      const fxSec = sec('受擊特效', '點怪時碎片與火花的顏色。花末世金幣，沒有數值效果。');
      const grid = document.createElement('div'); grid.className = 'apoc-shop-grid'; fxSec.append(grid);
      for (const item of A.RULES.HIT_FX) {
        const owned = a.cosmetics.owned.includes(item.id), wearing = a.cosmetics.hitFx === item.id;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'wardrobe-item'; b.dataset.key = `hitfx:${item.id}`;
        b.classList.toggle('owned', owned); b.classList.toggle('wearing', wearing);
        const sw = document.createElement('span'); sw.className = 'wardrobe-icon'; sw.textContent = '✦'; sw.style.color = item.spark;
        const nm = document.createElement('b'); nm.textContent = item.name;
        const st = document.createElement('small');
        st.textContent = wearing ? '使用中' : owned ? '換上' : shopPending === item.id ? `確定 ${format(item.price)}？` : format(item.price);
        b.append(sw, nm, st); b.disabled = store.blocked || (!owned && a.coins < item.price);
        b.onclick = () => {
          if (!owned && shopPending !== item.id) { shopPending = item.id; renderShopPanel(); return; }   // 按兩次購買（同 1.0 商店）
          shopPending = null;
          const was = A.normalize(store.state.apoc).cosmetics.hitFx;
          apply(x => A.wearCosmetic(owned ? x : A.buyCosmetic(x, item.id), item.id));
          if (A.normalize(store.state.apoc).cosmetics.hitFx !== was) { sound('upgrade'); notice(`換上「${item.name}」`); }
          renderShopPanel();
        };
        grid.append(b);
      }
    }

    // ---- 戰績（頂列「統計」，兩個世界同一顆鍵）：借 1.0 徽章牆的面板；匯出／匯入存檔兩邊共用同一份
    function openStats() {
      const v = view();
      setLabel($('stats').querySelector('h2'), '末世戰績 ');
      hide('badge-count'); hide('pick100-open'); hide('badge-share'); hide('memento-open');
      $('stats-body').textContent = `這一頁是末世的數字與徽章（${apocBadges(v)} / ${APOC_BADGES.length}）。下面的匯出／匯入存檔是兩個世界共用的同一份存檔。`;
      if (v.cleared) {   // 第十輪 C：關掉結局之後，從戰績頁回去選重走廢土／無盡模式（1.0 的統計重寫 textContent 時這顆會一起消失）
        const b = document.createElement('button'); b.type = 'button'; b.className = 'text-button apoc-lap-open'; b.textContent = '全線通行選項（重走廢土／無盡模式）';
        b.onclick = () => { $('stats').hidden = true; showEnding(); }; $('stats-body').append(document.createElement('br'), b);
      }
      // 數字格跟 1.0 統計同一套（#stats-tiles）；末世沒有徽章，徽章牆先藏起來，離開末世會還原
      const grid = $('stats-tiles'); grid.replaceChildren(); grid.hidden = false;
      for (const [k, val] of [['通過站數', `${v.progress} / ${v.stations}`], ['收藏', `${v.owned.length} / ${Pool().length}`], ['戰力', format(v.power)],
        ['抽卡次數', format(v.stats.draws)], ['點擊次數', format(v.stats.taps)], ['最高一擊', format(v.stats.maxHit)], ['破防次數', format(v.stats.shieldBreaks)],
        ['換到的券', format(v.exchangeTotal)], ['點擊力', `Lv.${v.clickLevel}`], ['全隊訓練', `Lv.${v.teamLevel}`], ['1.0 印記加成（戰力）', `×${v.boost.power.toFixed(2)}`], [v.laps ? `重走・戰力 ${times(v.lapPower)}` : '重走廢土', v.laps ? `第 ${v.laps + 1} 圈` : '還沒重走'], ['無盡最遠', v.endlessBest ? `＋${v.endlessBest} 站` : '—']]) {
        const cell = document.createElement('div'); cell.className = 'stat-tile';
        const b = document.createElement('b'); b.textContent = val; const sm = document.createElement('small'); sm.textContent = k;
        cell.append(b, sm); grid.append(cell);
      }
      for (const id of ['save-io', 'import-check', 'import-confirm']) if ($(id)) $(id).hidden = true;
      $('stats').hidden = false; $('game-content').inert = true; $('stats-close').focus();
    }

    // 末世藏起來的 1.0 元件：離開時要一起還原，不然桌邊的「最多」與訓練價牌會永遠消失
    //（Codex 複檢 1-2）
    const hidden = new Set();
    function hide(id) { const el = $(id); if (el && !el.hidden) { el.hidden = true; hidden.add(id); } }
    function unhide() { for (const id of hidden) { const el = $(id); if (el) el.hidden = false; } hidden.clear(); }
    // 只換一個文字節點（第一個有字的；按鈕裡常有 <img> 之前的空白節點），不動裡面的 <small>／<b>／<img>。
    // 原文與那個節點的位置記在 dataset，leave() 照位置還回去。
    function setLabel(host, text) {
      if (!host) return;
      const nodes = [...host.childNodes];
      let i = host.dataset.homeLabelAt !== undefined ? Number(host.dataset.homeLabelAt) : nodes.findIndex(n => n.nodeType === 3 && n.textContent.trim());
      if (i < 0) i = nodes.findIndex(n => n.nodeType === 3);
      if (i < 0) { host.prepend(document.createTextNode('')); i = 0; }
      const node = host.childNodes[i];
      if (host.dataset.homeLabel === undefined) { host.dataset.homeLabel = node.textContent; host.dataset.homeLabelAt = String(i); }
      node.textContent = text;
    }
    function restoreLabels() {
      for (const host of document.querySelectorAll('[data-home-label]')) {
        const node = host.childNodes[Number(host.dataset.homeLabelAt)];
        if (node && node.nodeType === 3) node.textContent = host.dataset.homeLabel;
        delete host.dataset.homeLabel; delete host.dataset.homeLabelAt;
      }
    }
    // 1.0 的按鈕在末世改成停用／換說明：原本的狀態記下來，離開時還回去
    function setButton(id, disabled, title) {
      const el = $(id); if (!el) return;
      if (el.dataset.homeDisabled === undefined) { el.dataset.homeDisabled = el.disabled ? '1' : ''; el.dataset.homeTitle = el.title; }
      el.disabled = disabled; el.title = title;
    }
    function restoreButtons() {
      for (const el of document.querySelectorAll('[data-home-disabled]')) {
        el.disabled = el.dataset.homeDisabled === '1'; el.title = el.dataset.homeTitle;
        delete el.dataset.homeDisabled; delete el.dataset.homeTitle;
      }
    }
    function render() {
      if (store.state?.settings.world !== 'apoc') return;
      const v = view();
      renderStage(v); renderBuddies(v); renderSlots(v); renderShop(v); renderShopPanel();
      $('coins').textContent = format(v.coins);
      $('click-rate').textContent = `戰力 ${format(v.power)}`;
      $('passive-rate').textContent = `每秒 ${format(v.power * A.RULES.IDLE_COINS)}・印記 ${store.state.marks || 0}`;   // 印記重設計：2.0 頂列看得到印記
      $('next-goal').textContent = v.endless && v.progress >= v.stations ? (v.progress >= A.RULES.ENDLESS_MAX ? `無盡到底・最遠 ＋${v.endlessBest}` : `無盡 第 ${v.progress + 1} 站・最遠 ＋${v.endlessBest}`) : v.progress >= v.stations ? '全線已通行' : `${v.laps ? `第 ${v.laps + 1} 圈・` : ''}第 ${Math.min(v.progress + 1, v.stations)} / ${v.stations} 站・收藏 ${v.owned.length} / ${Pool().length} 張`;
      $('owned-count').textContent = `${v.owned.length} / ${Pool().length}`;
      // 1.0 的 numbers() 在末世不跑，這幾顆鍵的可用狀態要自己設，不然會卡在 HTML 的預設值
      // （#scene-open 在 HTML 裡是 disabled 的 → 末世會完全打不開場景面板）
      $('scene-open').disabled = false; $('scene-open').title = '回到關卡地圖';
      setLabel($('scene-open').querySelector('span'), '地圖');
      $('roster-open').disabled = $('team-open').disabled = false;
      // 使用者第三輪：頂列「統計」＝末世戰績、頁尾「商店」＝兌換所＋外觀。
      // 第八輪使用者：「2.0 也要看得到換桌布相關的東西，不然要升級還要回去 1.0 按，很不直覺」→ 頁尾「換桌布」在末世照樣打開
      // 1.0 的換桌布面板（神器與商店的加成本來就套進 2.0）；以前這一格是還沒做的「重走廢土」佔位、按了沒反應。
      setLabel($('stats-open').querySelector('span'), '戰績');
      setButton('prestige-open', store.blocked, '換桌布・神器與商店（印記加成也套用在末世）');
      hide('recruit-open');   // 末世的演出固定是精裝典藏包，沒有演出方式可選
      if ($('daily-bag')) hide('daily-bag');   // 今日限定包是 1.0 的東西
    }

    // 進入／離開末世：只換 body 的旗標與一次重繪，版面節點完全共用
    // 進末世：開門禮（普發玥玥＋10 券）只發一次。舊版是 iframe 開啟時發的，
    // iframe 拿掉之後沒人發 → 第一次進去會是空隊伍、0 券，什麼都不能做。
    function enter() {
      document.body.dataset.world = 'apoc'; lastTick = Date.now(); buddyKey = slotKey = shopKey = '';
      $('prestige-hint')?.remove();   // 1.0 的「桌子有點滿了」便條掛在共用舞台上、20 秒才消失：剛冒出來就切末世會留在 2.0 畫面（第七輪截圖看到）
      document.body.dataset.apocTheme = 'aged';   // 使用者 09-13 選定：舊化的 1.0 材質（apoc/theme.css）
      if (store.state?.apoc?.unlocked && !store.state.apoc.gifted) apply(a => A.gift(a));
      offlineCheck();   // 第十輪 D：離線收益（在桌邊待著的時間也算，最多 8 小時）
      render();
    }
    function leave() {
      buddyKey = slotKey = shopKey = '';
      delete document.body.dataset.world; delete document.body.dataset.apocTheme; delete $('stage').dataset.apocSeg;
      $('package-result').classList.remove('apoc-shown');
      window.ClickerMusic?.sync(store.state);   // 回桌邊：換回 1.0 的場景曲
      const e = $('apoc-enemy'); if (e) { e.hidden = true; e.getAnimations().forEach(a => a.cancel()); e.classList.remove('far', 'shelled', 'breaking'); }
      for (const id of ['apoc-parts', 'apoc-beat', 'apoc-minions']) { const x = $(id); if (x) x.hidden = true; }   // 第十輪王關機制的畫面不留到桌邊
      mechKey = '';
      // 第十輪 B：預告暗紅圈、引導紙片也不留到桌邊
      $('stage').classList.remove('apoc-omen', 'apoc-final', 'coaching'); const coachEl = $('apoc-coach'); if (coachEl) coachEl.hidden = true;
      // 受擊特效是末世自己畫的，切回桌邊要收乾淨（粒子 scope 只清自己的，不會動到 1.0 的）
      fx?.stop(); fx = null; document.querySelectorAll('#floaters .apoc-hit, #floaters .apoc-hit-impact, #floaters .apoc-passive').forEach(el => el.remove());
      // 王關的護盾文字借用桌邊的效果標籤，不收掉會留在桌邊（Codex 第二輪 B12）
      const label = $('effect-label'); if (label) { label.hidden = true; label.classList.remove('broken'); }
      $('apoc-exchange')?.remove();
      $('draw-growth')?.remove();   // 抽卡漲價說明是 2.0 的規則，切回桌邊要收掉（招募卡是兩個世界共用的）
      restoreLabels(); restoreButtons(); unhide();
    }

    // 末世沒有離線收益：回到前景時把時間基準拉回現在，不然第一個 tick 會補結算最多 60 秒
    //（Codex 第二輪 B5）
    // 分頁隱藏回來：節拍光圈與逐格動畫重新掛上、對齊 startedAt（Codex 第十輪 A 必修 3）
    function resume() { lastTick = Date.now(); mechKey = ''; if (store.state?.settings.world === 'apoc') { offlineCheck(); render(); } }   // 第十輪 D：回到前景先補離線收益
    // 招募層要借 GachaFx 的全域畫布：先把末世的粒子停掉清乾淨，不然會畫到招募層上（Codex 第三輪）
    function stopFx() { fx?.stop(); fx = null; }
    return {
      render, enter, leave, tap, tick, apply, resume, train, openShop, openStats, stopFx,
      exchange: exchangeTicket,
      page(dir) { buddyPage = Math.max(0, buddyPage + dir); buddyKey = ''; render(); },
      fight: () => apply((x, n) => A.fight(x, n)),
      revisit: i => apply((x, n) => A.revisit(x, n, i)),
      drawn: ids => apply(x => A.drawn(x, ids)),
      get view() { return view(); },
    };
  }
  return { create, enemyArt, sticker };
})();
