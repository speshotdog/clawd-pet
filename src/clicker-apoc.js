// v3：末世（2.0）的入口殼（2026-09-13）。打完滅世珍獸解鎖；用 iframe 嵌 holo-5.0 的自包含頁
//（apoc/map20.html 地圖＋編隊、apoc/gacha.html 精裝招募、apoc/mohuashaonv.html 精裝收藏卡），
// 外面套一層手機遊戲式的新手引導（遮罩＋對話泡＋下一步）。2.0 的經濟還沒接（DESIGN-2026-09-12-content-architecture 待施工），
// 這一版是「引導玩家走一遍末世長什麼樣」，不是可推進的關卡。
(function (root) {
  const STEPS = [
    { tab: 'map', title: '歡迎來到末世', text: '打倒滅世珍獸之後，門開了。這裡只能用精裝卡戰鬥——1.0 的夥伴、訓練、印記都帶不進來，大家從同一條線起跑。' },
    { tab: 'map', title: '這是末世地圖', text: '線性一條路，打不死就不能進下一關；王關失敗有 3 分鐘冷卻。小怪純點擊，只有王才有機制。' },
    { tab: 'gacha', title: '先抽第一張精裝卡', text: '末世券用末世金幣買（1 券＝1000）。試玩版這裡是展示用卡池，抽到的卡還沒接進隊伍——先感受一下精裝抽卡。' },
    { tab: 'team', title: '編隊：20 張、上限 2／6／12', text: '神話最多 2、神話＋傳說 6、再加史詩 12。塞不進去會告訴你哪一層滿了。點「開啟編隊」看看。' },
    { tab: 'team', title: '把卡拖到獨立技能格', text: '桌機從隊伍網格直接拖到「獨立技能 1～4」；手機點格子挑。神話技能最多 1 張。' },
    { tab: 'map', title: '準備好就出發', text: '教學到這裡。之後從底部「末世地圖」隨時進來；收藏卡分頁放精裝收藏卡。' },
  ];
  function create({ $, store, commit, changed, notice, sound }) {
    let step = -1, tab = 'map';
    const frame = id => $(`apoc-frame-${id}`);
    function ensure(id) {
      const f = frame(id); if (f.dataset.loaded) return; f.dataset.loaded = '1';
      f.src = { map: 'apoc/map20.html', gacha: 'apoc/gacha.html', collect: 'apoc/mohuashaonv.html' }[id];
    }
    function show(id) {
      tab = id;
      for (const t of ['map', 'gacha', 'collect']) { const on = (id === t) || (id === 'team' && t === 'map'); const f = $(`apoc-frame-${t}`); f.hidden = false; f.classList.toggle('off', !on); $(`apoc-tab-${t}`).classList.toggle('active', on); }   // 不用 display:none：map20 的 ResizeObserver 遇到 0 寬會丟 Invalid array length
      $('apoc-tab-team').classList.toggle('active', id === 'team');
      if (id === 'collect') { const owned = (store.state.collectibles || []).includes('mohuashaonv'); $('apoc-collect-empty').hidden = owned; if (owned) ensure('collect'); else frame('collect').classList.add('off'); return; }
      const target = id === 'team' ? 'map' : id; ensure(target);
      if (id === 'team' || id === 'map') { const w = frame('map').contentWindow; const go = () => { try { w.team20?.setScreen(id === 'team' ? 'team' : 'map'); } catch {} }; if (w?.team20) go(); else frame('map').addEventListener('load', () => setTimeout(go, 50), { once: true }); }   // 畫面切換在 map20 的 team20 物件上
    }
    function coach(i) {
      step = i; const box = $('apoc-coach');
      if (i < 0 || i >= STEPS.length) { box.hidden = true; return; }
      const st = STEPS[i]; show(st.tab);
      $('apoc-coach-title').textContent = st.title; $('apoc-coach-text').textContent = st.text; $('apoc-coach-step').textContent = `${i + 1} / ${STEPS.length}`;
      $('apoc-coach-next').textContent = i === STEPS.length - 1 ? '開始探索' : '下一步'; box.hidden = false;
    }
    function finishTutorial() {
      const next = JSON.parse(JSON.stringify(store.state)); next.apoc = { ...(next.apoc || {}), tutorial: STEPS.length };
      if (commit(next)) { changed(); } coach(-1); $('apoc-open').classList.remove('new');
    }
    function open(startTutorial = false) {
      $('apoc').hidden = false; $('game-content').inert = true;
      const done = (store.state.apoc?.tutorial || 0) >= STEPS.length;
      if (startTutorial || !done) coach(0); else { coach(-1); show('map'); }
      $('apoc-close').focus();
    }
    function close() { $('apoc').hidden = true; $('game-content').inert = false; coach(-1); }
    function refresh() {
      const s = store.state, unlocked = !!s.apoc?.unlocked;
      $('apoc-open').hidden = !unlocked; $('apoc-open').classList.toggle('new', unlocked && (s.apoc?.tutorial || 0) < STEPS.length);
    }
    $('apoc-open').onclick = () => open(false);
    $('apoc-close').onclick = close;
    $('apoc-coach-next').onclick = () => { if (step >= STEPS.length - 1) finishTutorial(); else coach(step + 1); };
    $('apoc-coach-skip').onclick = finishTutorial;
    for (const t of ['map', 'team', 'gacha', 'collect']) $(`apoc-tab-${t}`).onclick = () => { coach(-1); show(t); };
    return { open, close, refresh, STEPS, get step() { return step; }, get tab() { return tab; }, get isOpen() { return !$('apoc').hidden; } };
  }
  root.ClickerApoc = { create, STEPS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
