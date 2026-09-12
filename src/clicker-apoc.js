// v3：末世（2.0）模式（2026-09-13）。打完滅世珍獸解鎖；**整個遊戲框切成末世模式**（覆蓋 1.0 的頂欄與底欄，
// 不是浮動面板——使用者：「整個 2.0 都在懸浮視窗裡玩很難受」）。內容是 tools/apoc/build_apoc.py 從 holo-5.0 組出來的
// src/apoc/index.html（map20 地圖＋team20 編隊收藏＋末世頂欄底欄＋收藏卡），以 postMessage 交換狀態：
//   parent → frame：{type:'apoc-state', state:{coins,tickets,collectibles}}、{type:'apoc-go', tab}
//   frame → parent：{type:'apoc-ready'}、{type:'apoc-back'}、{type:'apoc-tab', tab}
// 外面套一層手機遊戲式的新手引導（遮罩＋對話泡＋下一步）。2.0 的經濟還沒接：末世金幣先從 save.apoc.coins 顯示（0）。
(function (root) {
  const STEPS = [
    { tab: 'map', title: '歡迎來到末世', text: '打倒滅世珍獸之後，門開了。這裡只能用精裝卡戰鬥——1.0 的夥伴、訓練、印記都帶不進來，大家從同一條線起跑。上面是末世自己的金幣。' },
    { tab: 'map', title: '這是末世地圖', text: '線性一條路，打不死就不能進下一關；王關失敗有 3 分鐘冷卻。小怪純點擊，只有王才有機制。' },
    { tab: 'gacha', title: '先抽第一張精裝卡', text: '末世券用末世金幣買（1 券＝1000）。試玩版這裡是展示用卡池，抽到的卡還沒接進隊伍——先感受一下精裝抽卡。' },
    { tab: 'team', title: '編隊：20 張、上限 2／6／12', text: '神話最多 2、神話＋傳說 6、再加史詩 12。塞不進去會告訴你哪一層滿了。1.0 的編隊用的是同一套邏輯。' },
    { tab: 'team', title: '把卡拖到獨立技能格', text: '桌機從隊伍網格直接拖到「獨立技能 1～4」；手機點格子挑。神話技能最多 1 張。' },
    { tab: 'collect', title: '卡冊・收藏卡', text: '末世限定的收藏卡在編隊收藏最下面。教學到這裡，之後從底部「末世地圖」隨時進來。' },
  ];
  function create({ $, store, commit, changed, notice }) {
    let step = -1, tab = 'map', ready = false, pendingStart = null;
    const frame = () => $('apoc-frame');
    function post(msg) { try { frame().contentWindow?.postMessage(msg, '*'); } catch {} }
    function pushState() { const s = store.state; post({ type: 'apoc-state', state: { coins: s.apoc?.coins || 0, tickets: s.apoc?.tickets || 0, collectibles: s.collectibles || [] } }); }
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
    function open(startTutorial = false) {
      $('apoc').hidden = false; $('game-content').inert = true; document.body.dataset.mode = 'apoc';
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
    });
    $('apoc-open').onclick = () => open(false);
    $('apoc-coach-next').onclick = () => { if (step >= STEPS.length - 1) finishTutorial(); else coach(step + 1); };
    $('apoc-coach-skip').onclick = finishTutorial;
    return { open, close, refresh, STEPS, get step() { return step; }, get tab() { return tab; }, get ready() { return ready; }, get isOpen() { return !$('apoc').hidden; } };
  }
  root.ClickerApoc = { create, STEPS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
