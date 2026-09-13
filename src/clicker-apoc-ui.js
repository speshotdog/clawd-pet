// v3 末世（2.0）的畫面：**直接畫進 1.0 的 DOM**，不再是 iframe 裡的原型頁。
// 使用者 2026-09-13：「1.0 的版本比較好，乾脆把 1.0 的 UI 介面稍微調色拿來用就好，
// 但注意卡片都要是末世卡版本」「兩邊邏輯不要差太多，不同的是 UI 的色調」。
//
// 所以這支不自己造版面，只是把末世的資料餵進 1.0 既有的節點：
//   #stage   → 怪物（1.0 的敵人素材）＋血條，點的位置就是 1.0 的 #tap
//   #buddies → 末世隊伍（卡面縮圖）
//   #slots   → 末世四個獨立技能格（卡面縮圖＋冷卻）
//   #shop    → 招募（末世券）與換券
// 色票由 `body[data-world="apoc"]` 在 clicker.css 換掉，版面一行都不用改。
window.ClickerApocUI = (() => {
  const RARITY = { common: '#A9A297', rare: '#94BED0', epic: '#B8A2CF', legendary: '#E9B94E', mythic: '#FF4FD8' };
  // 20 站的敵人：沿用 1.0 的敵人／王素材（使用者：整體畫面用 1.0 的改），王關用大一號的
  const MOBS = ['monster-0.png', 'monster-1.png', 'monster-2.png'];
  const BOSSES = ['clicker-monster-bird.png', 'clicker-monster-wolf.png', 'clicker-boss3-pack.png',
    'clicker-boss4-crate.png', 'clicker-boss5-bag.png', 'clicker-boss7-mieshi.png'];
  const enemyArt = (i, boss) => boss ? BOSSES[Math.floor(i / 4) % BOSSES.length] : MOBS[i % MOBS.length];


  function create({ $, store, commit, changed, notice, format, card, sound, openRoster, openTeam }) {
    const root = window;
    const A = window.ApocEconomy, Pool = () => window.ApocPool || [];
    let byIdCache = null, byIdSrc = null;
    const byId = () => { const p = Pool(); if (p !== byIdSrc) { byIdSrc = p; byIdCache = Object.fromEntries(p.map(c => [c.id, c])); } return byIdCache; };
    let lastTick = Date.now(), buddyPage = 0;
    // ⚠ 每秒都 replaceChildren() 會把玩家正在 Tab／拖曳的節點刪掉（Codex 第三輪 B3）。
    //   內容沒變就別重建；會每秒變的只有冷卻秒數與可按狀態，那兩個就地更新。
    let buddyKey = '', slotKey = '';

    // 末世的卡一律用精裝卡面（HoloCardFace）；拿不到就退回 1.0 的畫法，不要整個壞掉
    const faceOf = (entry) => (window.ClickerHolo && window.ClickerHolo.ready() && window.ClickerHolo.face(entry)) || card.art.create(entry);
    const view = () => A.view(A.normalize(store.state.apoc), Date.now());
    // 對 s.apoc 做一次純函式變換並提交
    function apply(fn, silent = false) {
      const s = store.state; if (!s.apoc?.unlocked) return [];
      let events = [];
      try {
        const next = JSON.parse(JSON.stringify(s)); const r = fn(A.normalize(next.apoc), Date.now());
        if (r && r.state) { next.apoc = r.state; events = r.events || []; } else next.apoc = r;
        if (!commit(next)) return [];
      } catch (err) { if (!silent) notice(err.message); return []; }
      for (const ev of events) {
        if (ev.type === 'win') { sound('upgrade'); notice(`通過第 ${ev.index + 1} 站・＋${format(ev.reward)} 末世金幣`); }
        else if (ev.type === 'fail') notice('王關失敗');
        else if (ev.type === 'cleared') {
          const v = view();
          $('apoc-ending-text').textContent = `二十站都打通了。收藏 ${v.owned.length} / ${(root.ApocPool || []).length} 張，戰力 ${format(v.power)}。`;
          $('apoc-ending').hidden = false; $('game-content').inert = true; $('apoc-ending-close').focus();
          sound('transcend');
        }
      }
      changed();   // 讓招募層等其他模組也跟著重畫（價目、按鈕的可按狀態都在那邊算）
      return events;
    }

    function tap() {
      if (!store.state.apoc?.stage) return;
      apply((x, now) => A.settle(A.tap(x, now), now, 0), true);
      sound('click');
      const el = $('apoc-enemy');
      if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches)
        el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)', offset: .4 }, { transform: 'scale(1)' }], 120);
    }
    function tick() {
      const now = Date.now(), dt = Math.min(60, (now - lastTick) / 1000); lastTick = now;
      apply((x, n) => A.settle(x, n, dt), true);
    }

    // ---- 舞台：把 1.0 的拆包面換成打怪面（同一組節點，換內容）
    function renderStage(v) {
      let el = $('apoc-enemy');
      if (!el) {
        el = document.createElement('img'); el.id = 'apoc-enemy'; el.alt = ''; el.draggable = false;
        $('stage').insertBefore(el, $('bag'));
      }
      const i = v.stage ? v.stage.index : v.progress;
      const boss = v.stage ? v.stage.boss : A.isBoss(i);
      const src = enemyArt(Math.min(i, 19), boss);
      if (el.getAttribute('src') !== src) el.setAttribute('src', src);
      el.classList.toggle('boss', !!boss);
      el.hidden = v.progress >= v.stations;

      document.querySelector('.package-meter').hidden = false;
      const hp = v.stage ? Math.max(0, v.stage.hp) : v.need, max = v.stage ? v.stage.need : v.need;
      $('package-label').textContent = v.progress >= v.stations ? '全線已通行' : `第 ${i + 1} 站${boss ? '・王關' : ''}`;
      $('package-progress').max = 1; $('package-progress').value = max ? Math.min(1, 1 - hp / max) : 0;
      $('package-number').textContent = v.progress >= v.stations ? `${v.stations} / ${v.stations}` : `${format(hp)} / ${format(max)}`;

      // 護盾與破防：借用「效果標籤」那一格，不另外長新東西
      const label = $('effect-label'), sh = v.stage && v.stage.boss ? v.stage.shield : null;
      const broken = !!(v.stage && v.stage.breakUntil > Date.now());
      label.hidden = !(v.stage && v.stage.boss);
      if (!label.hidden) {
        label.textContent = broken
          ? `破防！全傷害 ×2・剩 ${Math.max(0, Math.ceil((v.stage.breakUntil - Date.now()) / 1000))} 秒`
          : `護盾：再點 ${Math.max(0, (sh ? sh.need - sh.taps : 0))} 下破盾`;
        label.classList.toggle('broken', broken);
      }

      // 「開戰」沿用 1.0 的挑戰鍵
      const go = $('boss-challenge');
      go.hidden = !!v.stage || v.progress >= v.stations;
      go.disabled = !v.canFight || !(v.power > 0) || store.blocked;
      go.textContent = !(v.power > 0) ? '先去編隊' : A.isBoss(v.progress) ? '挑戰王關' : '開戰';
      go.classList.toggle('glow', !!(v.canFight && v.power > 0));
      $('boss-estimate').hidden = true;
      $('package-result').textContent = v.progress >= v.stations ? '全線已通行。'
        : v.stage ? '點怪攻擊；隊伍放著也會打。' : '按「開戰」開始。';
    }

    function renderBuddies(v) {
      const map = byId(), host = $('buddies');
      // 末世可以編 20 張，只畫前十張的話後十張在主畫面看不到也拖不到（Codex 第二輪 B11）
      const pages = Math.max(1, Math.ceil(v.roster.length / 10));
      buddyPage = Math.min(buddyPage, pages - 1);
      const key = JSON.stringify([v.roster, v.skills, v.collection, buddyPage]);
      if (key === buddyKey) return; buddyKey = key;
      host.replaceChildren();
      $('buddy-page').textContent = `${buddyPage + 1}/${pages}`;
      $('buddy-prev').disabled = buddyPage === 0; $('buddy-next').disabled = buddyPage + 1 >= pages;
      if (!v.roster.length) { host.textContent = '隊伍是空的。到「編隊」把卡放進來。'; return; }
      for (const id of v.roster.slice(buddyPage * 10, buddyPage * 10 + 10)) {
        const entry = map[id]; if (!entry) continue;
        const el = document.createElement('button'); el.className = 'buddy'; el.dataset.id = id;
        el.title = `${entry.name}・查看卡冊`; el.style.setProperty('--rarity', RARITY[entry.rarity]);
        const portrait = document.createElement('span'); portrait.className = 'buddy-portrait holo-slot'; portrait.append(faceOf(entry));
        const name = document.createElement('b'); name.textContent = entry.name;
        const stars = document.createElement('span'); stars.textContent = `★${v.collection[id] || 1}`;
        el.append(portrait, name, stars);
        const slot = v.skills.indexOf(id);
        if (slot >= 0) { const stamp = document.createElement('small'); stamp.className = 'slot-stamp'; stamp.textContent = `槽${slot + 1}`; el.append(stamp); }
        el.onclick = () => openRoster(id);
        host.append(el);
      }
    }

    function renderSlots(v) {
      const map = byId(), host = $('slots'), now = Date.now();
      const key = JSON.stringify([v.skills, v.skillDefs.map(d => d && d.name)]);
      if (key === slotKey) { updateSlots(v, now); return; }
      slotKey = key;
      host.replaceChildren();
      for (let i = 0; i < 4; i++) {
        const id = v.skills[i], def = v.skillDefs[i], entry = id ? map[id] : null;
        const wrap = document.createElement('article'); wrap.className = 'skill-slot';
        const b = document.createElement('button'); b.className = 'skill-use'; b.dataset.slot = i;
        const left = Math.max(0, Math.ceil(((v.skillCd && v.skillCd[i] || 0) - now) / 1000));
        if (entry) { const wrap = document.createElement('span'); wrap.className = 'holo-slot'; wrap.append(faceOf(entry)); b.append(wrap); }
        else { const plus = document.createElement('span'); plus.className = 'slot-empty'; plus.textContent = '＋'; b.append(plus); }
        // 空格要能點（點了就去編隊）；只有「發動技能」才受戰鬥中／冷卻限制（Codex 複檢 3-3）
        b.disabled = store.blocked || (!!def && (!!left || !v.stage));
        b.title = def ? `${def.card}・${def.text}` : '點一下去編隊，把卡放進獨立技能格';
        b.onclick = () => def ? apply((x, n) => A.useSkill(x, i, n)) : openTeam();
        const name = document.createElement('span'); name.className = 'skill-name';
        name.textContent = def ? (left ? `${def.name}・${left}s` : def.name) : '選夥伴';
        wrap.append(b, name); host.append(wrap);
      }
    }

    // 每秒只更新會變的：冷卻秒數與可按狀態（不重建節點，焦點與拖曳才不會被打斷）
    function updateSlots(v, now) {
      const host = $('slots');
      for (let i = 0; i < 4; i++) {
        const b = host.children[i]?.querySelector('.skill-use'), name = host.children[i]?.querySelector('.skill-name');
        if (!b) continue;
        const def = v.skillDefs[i], left = Math.max(0, Math.ceil(((v.skillCd && v.skillCd[i] || 0) - now) / 1000));
        b.disabled = store.blocked || (!!def && (!!left || !v.stage));
        if (name) name.textContent = def ? (left ? `${def.name}・${left}s` : def.name) : '選夥伴';
      }
    }
    function renderShop(v) {
      // 招募的兩顆鍵由 clicker-gacha.js 的 priceButton 統一畫（兩個世界共用那一層），這裡只管價目牌
      $('draw-price').textContent = `${v.tickets} 券`;
      $('draw-ticket').title = `末世券：抽卡用。金幣換券 ${format(v.ticketCost)}`;
      // 1.0 的兩張升級卡在末世換成「換券」與「隊伍」
      $('click-level').textContent = `券 ${v.tickets}`;
      $('click-next').textContent = `末世金幣 ${format(v.coins)}`;
      $('click-price').textContent = format(v.ticketCost);
      $('click-one').textContent = '換券！'; $('click-one').disabled = v.coins < v.ticketCost || store.blocked;
      hide('click-max');
      $('training-level').textContent = `${v.roster.length} / 20`;
      $('training-next').textContent = `戰力 ${format(v.power)}・點一下 ${format(v.power * A.RULES.CLICK_SHARE)}`;
      hide('training-ticket');
      $('training-one').textContent = '去編隊'; $('training-one').disabled = false;
      hide('training-max');
      // 三張卡的標題也要換成末世的說法，不然會留著「攻擊力／全隊訓練／幫忙拆包」。
      // ⚠ 這是改 1.0 的靜態文字，所以第一次改之前要把原文存起來，leave() 要還回去，
      //   不然從末世切回桌邊會看到「末世券」掛在攻擊力那張卡上。
      setLabel(document.querySelectorAll('#shop h2')[0], '末世券 ');
      setLabel(document.querySelectorAll('#shop h2')[1], '隊伍 ');
      setLabel(document.querySelector('#shop .recruit small'), '隊伍裡的卡才有戰力');
    }

    // 末世藏起來的 1.0 元件：離開時要一起還原，不然桌邊的「最多」與訓練價牌會永遠消失
    //（Codex 複檢 1-2）
    const hidden = new Set();
    function hide(id) { const el = $(id); if (el && !el.hidden) { el.hidden = true; hidden.add(id); } }
    function unhide() { for (const id of hidden) { const el = $(id); if (el) el.hidden = false; } hidden.clear(); }
    // 只換「第一個文字節點」，不動裡面的 <small>／<b>；原文記在 dataset 裡等 leave() 還原
    function setLabel(host, text) {
      if (!host) return;
      let node = [...host.childNodes].find(n => n.nodeType === 3);
      if (!node) { node = document.createTextNode(''); host.prepend(node); }
      if (host.dataset.homeLabel === undefined) host.dataset.homeLabel = node.textContent;
      node.textContent = text;
    }
    function restoreLabels() {
      for (const host of document.querySelectorAll('[data-home-label]')) {
        const node = [...host.childNodes].find(n => n.nodeType === 3);
        if (node) node.textContent = host.dataset.homeLabel;
        delete host.dataset.homeLabel;
      }
    }
    function render() {
      if (store.state?.settings.world !== 'apoc') return;
      const v = view();
      renderStage(v); renderBuddies(v); renderSlots(v); renderShop(v);
      $('coins').textContent = format(v.coins);
      $('click-rate').textContent = `戰力 ${format(v.power)}`;
      $('passive-rate').textContent = `每秒 ${format(v.power * A.RULES.IDLE_COINS)}`;
      $('next-goal').textContent = v.progress >= v.stations ? '全線已通行' : `第 ${Math.min(v.progress + 1, v.stations)} / ${v.stations} 站・收藏 ${v.owned.length} / ${Pool().length} 張`;
      $('owned-count').textContent = `${v.owned.length} / ${Pool().length}`;
      // 1.0 的 numbers() 在末世不跑，這幾顆鍵的可用狀態要自己設，不然會卡在 HTML 的預設值
      // （#scene-open 在 HTML 裡是 disabled 的 → 末世會完全打不開場景面板）
      $('scene-open').disabled = false; $('scene-open').title = '回到關卡地圖';
      setLabel($('scene-open').querySelector('span'), '地圖');
      $('roster-open').disabled = $('team-open').disabled = false;
      // 商店賣的是桌邊的音效／特效／擺飾，花的是桌邊的幣，對末世戰力沒有任何作用——
      // 留著只會讓玩家花錯錢、期待不存在的效果（Codex 第二輪 B8）。統計同理：那是桌邊的生涯數字。
      hide('wardrobe-open'); hide('stats-open');
      hide('recruit-open');   // 末世的演出固定是精裝典藏包，沒有演出方式可選
      if ($('daily-bag')) hide('daily-bag');   // 今日限定包是 1.0 的東西
    }

    // 進入／離開末世：只換 body 的旗標與一次重繪，版面節點完全共用
    // 進末世：開門禮（普發玥玥＋10 券）只發一次。舊版是 iframe 開啟時發的，
    // iframe 拿掉之後沒人發 → 第一次進去會是空隊伍、0 券，什麼都不能做。
    function enter() {
      document.body.dataset.world = 'apoc'; lastTick = Date.now(); buddyKey = slotKey = '';
      if (store.state?.apoc?.unlocked && !store.state.apoc.gifted) apply(a => A.gift(a));
      render();
    }
    function leave() {
      buddyKey = slotKey = '';
      delete document.body.dataset.world;
      const e = $('apoc-enemy'); if (e) e.hidden = true;
      // 王關的護盾文字借用桌邊的效果標籤，不收掉會留在桌邊（Codex 第二輪 B12）
      const label = $('effect-label'); if (label) { label.hidden = true; label.classList.remove('broken'); }
      restoreLabels(); unhide();
    }

    // 末世沒有離線收益：回到前景時把時間基準拉回現在，不然第一個 tick 會補結算最多 60 秒
    //（Codex 第二輪 B5）
    function resume() { lastTick = Date.now(); }
    return {
      render, enter, leave, tap, tick, apply, resume,
      page(dir) { buddyPage = Math.max(0, buddyPage + dir); buddyKey = ''; render(); },
      fight: () => apply((x, n) => A.fight(x, n)),
      buyTicket: () => apply(x => A.buyTicket(x, 1)),
      drawn: ids => apply(x => A.drawn(x, ids)),
      get view() { return view(); },
    };
  }
  return { create, enemyArt };
})();
