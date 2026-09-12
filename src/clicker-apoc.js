// v3：末世（2.0）模式（2026-09-13）。打完滅世珍獸解鎖；**整個遊戲框切成末世模式**（覆蓋 1.0 的頂欄與底欄，
// 不是浮動面板——使用者：「整個 2.0 都在懸浮視窗裡玩很難受」）。內容是 tools/apoc/build_apoc.py 從 holo-5.0 組出來的
// src/apoc/index.html（map20 地圖＋team20 編隊收藏＋末世頂欄底欄＋收藏卡），以 postMessage 交換狀態：
//   parent → frame：{type:'apoc-state', state:{coins,tickets,collectibles}}、{type:'apoc-go', tab}
//   frame → parent：{type:'apoc-ready'}、{type:'apoc-back'}、{type:'apoc-tab', tab}
// 外面套一層手機遊戲式的新手引導（遮罩＋對話泡＋下一步）。
// 2026-09-13 晚：經濟接上（clicker-apoc-economy.js）：frame → parent 還有 apoc-fight／apoc-tap／apoc-buy-ticket／apoc-drawn／apoc-team；
// parent 每秒 tick() 結算（放置傷害、放置金幣、王關時限），通關時送 {type:'apoc-win'} 讓地圖跑通關演出。
(function (root) {
  const STEPS = [
    { tab: 'map', title: '歡迎來到末世', text: '打倒滅世珍獸之後，門開了。這裡只能用精裝卡戰鬥——1.0 的夥伴、訓練、印記都帶不進來，大家從同一條線起跑。上面是末世自己的金幣。' },
    { tab: 'map', title: '這是末世地圖', text: '線性一條路，打不死就不能進下一關；王關失敗有 3 分鐘冷卻。小怪純點擊，只有王才有機制。' },
    { tab: 'gacha', title: '先抽第一張精裝卡', text: '開門禮：普發玥玥＋10 張末世券，先來一次十連。之後券用末世金幣買（1 券＝1000）。抽到的卡自動進隊。' },
    { tab: 'team', title: '編隊：20 張、上限 2／6／12', text: '神話最多 2、神話＋傳說 6、再加史詩 12。塞不進去會告訴你哪一層滿了。1.0 的編隊用的是同一套邏輯。' },
    { tab: 'team', title: '把卡拖到獨立技能格', text: '桌機從隊伍網格直接拖到「獨立技能 1～4」；手機點格子挑。神話技能最多 1 張。' },
    { tab: 'collect', title: '卡冊・收藏卡', text: '末世限定的收藏卡在編隊收藏最下面。教學到這裡，之後從底部「末世地圖」隨時進來。' },
  ];
  function create({ $, store, commit, changed, notice }) {
    let step = -1, tab = 'map', ready = false, pendingStart = null, lastTick = Date.now();
    const A = root.ApocEconomy;
    // 對 s.apoc 做一次純函式變換並提交；回傳事件（win／fail）
    function apply(fn, silent = false) {
      const s = store.state; if (!s.apoc?.unlocked) return [];
      let events = [];
      try {
        const next = JSON.parse(JSON.stringify(s)); const r = fn(A.normalize(next.apoc), Date.now());
        if (r && r.state) { next.apoc = r.state; events = r.events || []; } else next.apoc = r;
        if (!commit(next)) return [];
      } catch (err) { if (!silent) notice(err.message); return []; }
      pushState(); for (const ev of events) { if (ev.type === 'win') { post({ type: 'apoc-win', index: ev.index, reward: ev.reward }); notice(`末世：通過第 ${ev.index + 1} 站，+${ev.reward} 末世金幣`); } else if (ev.type === 'fail') { post({ type: 'apoc-fail', index: ev.index }); notice('王關失敗，3 分鐘後再挑戰'); } }
      return events;
    }
    // 每秒由 clicker.js 的 tick 呼叫；末世關閉時照樣結算（放置）
    function tick() { const now = Date.now(), dt = Math.min(60, (now - lastTick) / 1000); lastTick = now; if (!store.state.apoc?.unlocked) return; apply(a => A.settle(a, now, dt), true); }
    const frame = () => $('apoc-frame');
    function post(msg) { try { frame().contentWindow?.postMessage(msg, '*'); } catch {} }
    function pushState() { const s = store.state; if (!s.apoc?.unlocked) return; post({ type: 'apoc-state', state: { ...A.view(A.normalize(s.apoc), Date.now()), collectibles: s.collectibles || [] } }); }
    function go(id) { tab = id; post({ type: 'apoc-go', tab: id }); }
    function coach(i) {
      step = i; const box = $('apoc-coach');
      if (i < 0 || i >= STEPS.length) { box.hidden = true; return; }
      const st = STEPS[i]; go(st.tab);
      $('apoc-coach-title').textContent = st.title; $('apoc-coach-text').textContent = st.text; $('apoc-coach-step').textContent = `${i + 1} / ${STEPS.length}`;
      $('apoc-coach-next').textContent = i === STEPS.length - 1 ? '開始探索' : '下一步'; box.hidden = false;
    }
    function finishTutorial() {
      const next = JSON.parse(JSON.stringify(store.state)); next.apoc = { ...(next.apoc || {}), tutorial: STEPS.length };
      if (commit(next)) changed();
      coach(-1); $('apoc-open').classList.remove('new');
    }
    // 畫布固定 1280 寬，縮到目前 #apoc 的寬（桌機 960→0.75；直式手機照寬度算）
    function fit() { const w = $('apoc').clientWidth || 960; const scale = w >= 800 ? w / 1280 : 1; $('apoc').style.setProperty('--apoc-scale', scale.toFixed(4)); $('apoc').style.setProperty('--apoc-width', `${Math.round(w / scale)}px`); }   // 直式手機：不縮，讓 map20 自己的手機版面接手
    addEventListener('resize', () => { if (!$('apoc').hidden) fit(); });
    function open(startTutorial = false) {
      $('apoc').hidden = false; fit();
      $('game-content').inert = true; document.body.dataset.mode = 'apoc';
      if (!store.state.apoc?.gifted) apply(a => A.gift(a));   // 開門禮：普發玥玥＋10 券
      if (!frame().getAttribute('src')) frame().src = 'apoc/index.html';
      const done = (store.state.apoc?.tutorial || 0) >= STEPS.length;
      const start = () => { pushState(); if (startTutorial || !done) coach(0); else { coach(-1); go('map'); } };
      if (ready) start(); else pendingStart = start;
    }
    function close() { $('apoc').hidden = true; $('game-content').inert = false; delete document.body.dataset.mode; coach(-1); $('tap')?.focus(); }
    function refresh() {
      const s = store.state, unlocked = !!s.apoc?.unlocked;
      $('apoc-open').hidden = !unlocked; $('apoc-open').classList.toggle('new', unlocked && (s.apoc?.tutorial || 0) < STEPS.length);
      if (ready && !$('apoc').hidden) pushState();
    }
    addEventListener('message', e => {
      const d = e.data || {}; if (typeof d.type !== 'string' || !d.type.startsWith('apoc-')) return;
      if (d.type === 'apoc-ready') { ready = true; if (pendingStart) { pendingStart(); pendingStart = null; } else pushState(); }
      else if (d.type === 'apoc-back') close();
      else if (d.type === 'apoc-tab') tab = d.tab;
      else if (d.type === 'apoc-fight') apply((a, now) => A.fight(a, now));
      else if (d.type === 'apoc-tap') apply((a, now) => A.settle(A.tap(a, now), now, 0));
      else if (d.type === 'apoc-buy-ticket') apply(a => A.buyTicket(a, d.n || 1));
      else if (d.type === 'apoc-drawn') apply(a => A.drawn(a, Array.isArray(d.ids) ? d.ids : []));
      else if (d.type === 'apoc-team') apply(a => A.setTeam(a, d.roster, d.skills));
    });
    $('apoc-open').onclick = () => open(false);
    $('apoc-coach-next').onclick = () => { if (step >= STEPS.length - 1) finishTutorial(); else coach(step + 1); };
    $('apoc-coach-skip').onclick = finishTutorial;
    return { open, close, refresh, tick, STEPS, get step() { return step; }, get tab() { return tab; }, get ready() { return ready; }, get isOpen() { return !$('apoc').hidden; } };
  }
  root.ClickerApoc = { create, STEPS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
