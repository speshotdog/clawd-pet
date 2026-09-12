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
    const A = window.ApocEconomy, Pool = () => window.ApocPool || [];
    let byIdCache = null, byIdSrc = null;
    const byId = () => { const p = Pool(); if (p !== byIdSrc) { byIdSrc = p; byIdCache = Object.fromEntries(p.map(c => [c.id, c])); } return byIdCache; };
    let lastTick = Date.now();

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
      }
      changed();   // 讓招募層等其他模組也跟著重畫（價目、按鈕的可按狀態都在那邊算）
      return events;
    }

    function tap() {
      if (!store.state.apoc?.stage) return;
      apply((x, now) => A.settle(A.tap(x, now), now, 0), true);
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
      host.replaceChildren();
      $('buddy-page').textContent = `${v.roster.length}/20`;
      $('buddy-prev').disabled = $('buddy-next').disabled = true;
      if (!v.roster.length) { host.textContent = '隊伍是空的。到「編隊」把卡放進來。'; return; }
      for (const id of v.roster.slice(0, 10)) {
        const entry = map[id]; if (!entry) continue;
        const el = document.createElement('button'); el.className = 'buddy'; el.dataset.id = id;
        el.title = `${entry.name}・查看卡冊`; el.style.setProperty('--rarity', RARITY[entry.rarity]);
        const portrait = document.createElement('span'); portrait.className = 'buddy-portrait'; portrait.append(card.art.create(entry));
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
      host.replaceChildren();
      for (let i = 0; i < 4; i++) {
        const id = v.skills[i], def = v.skillDefs[i], entry = id ? map[id] : null;
        const wrap = document.createElement('article'); wrap.className = 'skill-slot';
        const b = document.createElement('button'); b.className = 'skill-use'; b.dataset.slot = i;
        const left = Math.max(0, Math.ceil(((v.skillCd && v.skillCd[i] || 0) - now) / 1000));
        if (entry) b.append(card.art.create(entry));
        else { const plus = document.createElement('span'); plus.className = 'slot-empty'; plus.textContent = '＋'; b.append(plus); }
        b.disabled = !def || !!left || !v.stage || store.blocked;
        b.title = def ? `${def.card}・${def.text}` : '到「編隊」把卡放進獨立技能格';
        b.onclick = () => def ? apply((x, n) => A.useSkill(x, i, n)) : openTeam();
        const name = document.createElement('span'); name.className = 'skill-name';
        name.textContent = def ? (left ? `${def.name}・${left}s` : def.name) : '選夥伴';
        wrap.append(b, name); host.append(wrap);
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
      $('click-max').hidden = true;
      $('training-level').textContent = `${v.roster.length} / 20`;
      $('training-next').textContent = `戰力 ${format(v.power)}・點一下 ${format(v.power * A.RULES.CLICK_SHARE)}`;
      $('training-ticket').hidden = true;
      $('training-one').textContent = '去編隊'; $('training-one').disabled = false;
      $('training-max').hidden = true;
      // 三張卡的標題也要換成末世的說法，不然會留著「攻擊力／全隊訓練／幫忙拆包」
      const heads = document.querySelectorAll('#shop h2');
      if (heads[0]) heads[0].childNodes[0].textContent = '末世券 ';
      if (heads[1]) heads[1].childNodes[0].textContent = '隊伍 ';
      const recruitNote = document.querySelector('#shop .recruit small');
      if (recruitNote) recruitNote.textContent = '隊伍裡的卡才有戰力';
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
    }

    // 進入／離開末世：只換 body 的旗標與一次重繪，版面節點完全共用
    function enter() { document.body.dataset.world = 'apoc'; lastTick = Date.now(); render(); }
    function leave() { delete document.body.dataset.world; const e = $('apoc-enemy'); if (e) e.hidden = true; }

    return {
      render, enter, leave, tap, tick, apply,
      fight: () => apply((x, n) => A.fight(x, n)),
      buyTicket: () => apply(x => A.buyTicket(x, 1)),
      drawn: ids => apply(x => A.drawn(x, ids)),
      get view() { return view(); },
    };
  }
  return { create, enemyArt };
})();
