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
  const BOSSES = ['clicker-monster-bird.png', 'clicker-monster-wolf.png', 'clicker-boss3-pack.png',
    'clicker-boss4-crate.png', 'clicker-boss5-bag.png', 'clicker-boss7-mieshi.png'];
  const enemyArt = (i, boss) => boss ? BOSSES[Math.floor(i / 4) % BOSSES.length] : MOBS[i % MOBS.length];


  function create({ $, store, commit, changed, notice, format, card, sound, openRoster, openTeam, cutin }) {
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
    const blank = () => { const el = document.createElement('span'); el.className = 'apoc-face-blank'; return el; };
    const faceOf = (entry) => (window.ClickerHolo && window.ClickerHolo.ready() && window.ClickerHolo.face(entry)) || blank();
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
      el.style.fontSize = kind === 'break' || kind === 'kill' ? '34px' : kind === 'crit' ? '32px' : '24px';
      el.style.color = kind === 'crit' ? '#FFD76A' : kind === 'break' ? '#FF9A6B' : kind === 'kill' ? '#FFE9A8' : '#FFF6E6';
      list.append(el);
      // 減少動畫：數字照樣看得到，只是不飄（1.0 第 21 輪的教訓：讀數是資訊不是裝飾）
      const frames = reduced.matches
        ? [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .72 }, { opacity: 0 }]
        : [{ transform: 'translateY(0) scale(.6)', opacity: 1 }, { transform: 'translateY(-4px) scale(1.18)', opacity: 1, offset: .06 },
           { transform: 'translateY(-8px) scale(1)', opacity: 1, offset: .14 }, { transform: 'translateY(-44px)', opacity: 1, offset: .72 }, { transform: 'translateY(-60px)', opacity: 0 }];
      el.animate(frames, { duration: kind === 'break' || kind === 'kill' ? 1000 : 720, easing: 'linear' }).finished.then(() => el.remove(), () => el.remove());
    }
    function impactAt(at, k = 1) {
      const el = document.createElement('img'); el.src = 'clicker-fx-impact-burst.png'; el.alt = ''; el.className = 'small-impact apoc-hit-impact';
      el.style.left = `${at.x - 65}px`; el.style.top = `${at.y - 65}px`; $('floaters').prepend(el);   // 墊在浮字底下，不然爆擊數字被衝擊圖蓋掉
      el.animate([{ transform: `scale(${.2 * k})`, opacity: 1 }, { transform: `scale(${.55 * k})`, opacity: 1, offset: .6 }, { transform: `scale(${.7 * k})`, opacity: 0 }], 180)
        .finished.then(() => el.remove(), () => el.remove());
    }
    function shakeStage(px, ms) {
      const st = $('stage'); st.style.setProperty('--boss-shake', `${px}px`); st.style.setProperty('--boss-shake-time', `${ms}ms`);
      st.classList.remove('boss-shake'); void st.offsetWidth; st.classList.add('boss-shake');
      setTimeout(() => st.classList.remove('boss-shake'), ms);
    }
    // 碎片是舊化的土色／鐵鏽色，火花是金色；打在護盾上火花換成冷灰藍，一聽一看就知道「在磨盾」
    function burstAt(cv, u, kind) {
      if (!window.GachaFx || !$('recruit-layer').hidden) return;   // 招募層開著時 GachaFx 的全域畫布是招募層的，不能畫過去
      window.GachaFx.init($('click-fx'));   // 招募層會把全域畫布換成自己的，回來第一下要換回舞台這張
      fx ||= window.GachaFx.createScope();
      const big = kind === 'break' || kind === 'kill', n = big ? 22 : kind === 'crit' ? 14 : 8;
      // 配色跟著末世商店換上的外觀走（預設鏽鐵火花）
      const skin = A.RULES.HIT_FX.find(f => f.id === store.state?.apoc?.cosmetics?.hitFx) || A.RULES.HIT_FX[0];
      const spark = kind === 'shield' ? skin.shield : skin.spark;
      const rand = (a, b) => a + Math.random() * (b - a);
      for (let i = 0; i < n; i++) {
        fx.spawn(i % 3 === 0
          ? { sprite: 14, x: cv.x + rand(-8, 8), y: cv.y + rand(-8, 8), vx: rand(-170, 170) * u, vy: rand(-230, -40) * u, g: 280 * u,
              r: rand(big ? 9 : 6, big ? 14 : 10) * u, life: rand(.25, .42), drag: .96, shrink: true, color: spark, blend: 'lighter' }
          : { shape: 'shard', x: cv.x + rand(-10, 10), y: cv.y + rand(-6, 6), vx: rand(big ? -260 : -150, big ? 260 : 150) * u, vy: rand(big ? -380 : -260, -90) * u,
              g: 560 * u, life: rand(.45, big ? .95 : .7), w: rand(8, big ? 18 : 14) * u, h: rand(5, 10) * u, rot: rand(0, 6.28), vr: rand(-9, 9),
              drag: .99, color: skin.shards[i % 2], color2: '#2A1C12', fadeK: 4 });
      }
      if (kind !== 'hit' && kind !== 'shield')
        fx.spawn({ sprite: 3, x: cv.x, y: cv.y, r: 34 * u, life: big ? .32 : .22, color: spark, blend: 'lighter', update(q) { q.r = (34 + (big ? 90 : 56) * (1 - q.life / q.max)) * u; } });
    }
    function hitFx(point, kind, text) {
      const p = hitPoint(point), el = $('apoc-enemy');
      floatText(text, p.fl, kind);
      if (reduced.matches) return;
      const now = performance.now();
      // 連點很快的時候碎片不必每下都噴（浮字每下都有）；爆擊／破盾／擊倒一定噴
      if (kind !== 'hit' && kind !== 'shield' || now - sparkAt > 60) { sparkAt = now; burstAt(p.cv, p.u, kind); }
      if (kind !== 'hit' && kind !== 'shield') impactAt(p.fl, kind === 'crit' ? .8 : 1.2);
      if (kind === 'break' || kind === 'kill') shakeStage(kind === 'kill' ? 7 : 5, 220);
      if (!el) return;
      const shade = 'drop-shadow(0 8px 10px rgba(0,0,0,.55))';
      if (kind === 'kill') el.animate([{ transform: 'scale(1)', opacity: 1, filter: `brightness(2.4) ${shade}` }, { transform: 'scale(1.22)', opacity: 0, offset: .45 },
        { transform: 'scale(.85)', opacity: 0, offset: .55 }, { transform: 'scale(1)', opacity: 1 }], 620);
      else el.animate([{ transform: 'scale(1)', filter: `brightness(1) ${shade}` }, { transform: kind === 'hit' || kind === 'shield' ? 'scale(1.05,.93)' : 'scale(1.1,.88)', filter: `brightness(${kind === 'shield' ? 1.5 : 2.2}) ${shade}`, offset: .3 },
        { transform: 'scale(1)', filter: `brightness(1) ${shade}` }], kind === 'hit' || kind === 'shield' ? 130 : 200);
    }

    function tap(point) {
      const before = store.state.apoc; if (!before?.stage) return;
      const b = A.normalize(before), now = Date.now(), idx = b.stage.index;
      const dmg = A.tapDamage(b, now), crit = (b.fx?.clickLeft || 0) > 0, boss = !!b.stage.boss, wasBroken = now < (b.stage.breakUntil || 0);
      const events = apply((x, n) => A.settle(A.tap(x, n), n, 0), true);
      if (!events.length && store.state.apoc === before) return;   // commit 被擋（存檔鎖住之類）就不演
      const after = store.state.apoc, won = events.some(e => e.type === 'win');
      const broke = boss && !wasBroken && !won && after.stage?.index === idx && (after.stage.breakUntil || 0) > now;
      sound(broke ? 'skill' : crit ? 'skill' : 'click');
      const kind = won ? 'kill' : broke ? 'break' : crit ? 'crit' : boss && !wasBroken ? 'shield' : 'hit';
      hitFx(point, kind, broke ? `破盾！-${format(dmg)}` : `-${format(dmg)}`);
    }
    function tick() {
      const now = Date.now(), dt = Math.min(60, (now - lastTick) / 1000); lastTick = now;
      const events = apply((x, n) => A.settle(x, n, dt), true);
      // 放著被隊伍打死也要有擊倒演出（點死的那一下由 tap() 自己演）；地圖蓋著舞台時不演
      if (events.some(e => e.type === 'win') && !$('game-content').classList.contains('map-open') && $('recruit-layer').hidden) hitFx(null, 'kill', '擊倒！');
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
        const stars = document.createElement('span'); stars.textContent = `★${v.collection[id] || 1}`;
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
      const d = A.RULES.SKILLS[entry.rarity], stamp = d.kind === 'clickMul' ? `×${d.value}` : d.kind === 'powerMul' ? `×${d.value}` : `−${d.value / 1000} 秒`;
      const [color, stripe] = SKILL_COLOR[entry.rarity] || SKILL_COLOR.rare;
      const name = def.name.length >= 6 ? def.name.slice(0, Math.floor(def.name.length / 2)) + '\n' + def.name.slice(Math.floor(def.name.length / 2)) : def.name;
      cutin?.play({ source: id, entry: { ...entry, rarity: entry.rarity }, actor: () => faceOf(entry),
        spec: { side: 'left', color, stripe, name, sub: () => def.text, stamp: () => stamp } });
      return events;
    }

    function renderSlots(v) {
      const map = byId(), host = $('slots'), now = Date.now();
      const key = JSON.stringify([v.skills, v.skillDefs.map(d => d && d.name)]);
      if (key === slotKey && host.dataset.world === 'apoc') { updateSlots(v, now); return; }
      slotKey = key;
      host.replaceChildren(); host.dataset.world = 'apoc';
      for (let i = 0; i < 4; i++) {
        const id = v.skills[i], def = v.skillDefs[i], entry = id ? map[id] : null;
        const wrap = document.createElement('article'); wrap.className = 'skill-slot';
        const b = document.createElement('button'); b.className = 'skill-use'; b.dataset.slot = i;
        if (entry) b.append(stickerOf(entry));
        else { const plus = document.createElement('span'); plus.className = 'slot-empty'; plus.textContent = '＋'; b.append(plus); }
        b.title = def ? `${def.card}・${def.text}` : '點一下去編隊，把卡放進獨立技能格';
        b.onclick = () => def ? cast(i) : openTeam();
        const name = document.createElement('span'); name.className = 'skill-name';
        wrap.append(b, name); host.append(wrap);
      }
      updateSlots(v, now);
    }
    // 技能格是圓形貼紙頭像（使用者第三輪：「技能格不要把整張卡放上去（不好看）」，跟 1.0 一樣）：
    // 外圈稀有度色、裡面是精裝卡的主體圖，取景由 tools/apoc/build_sticker.py 算好（window.ApocSticker）。
    function stickerOf(entry) {
      const ring = document.createElement('span'); ring.className = 'apoc-sticker'; ring.dataset.rarity = entry.rarity;
      const art = document.createElement('i'), crop = (window.ApocSticker || {})[entry.id];
      if (crop) { const [file, size, x, y] = crop; art.style.backgroundImage = `url("apoc/${file}")`; art.style.backgroundSize = `${size}% auto`; art.style.backgroundPosition = `${x}% ${y}%`; }
      else art.append(blank());   // 沒有取景資料也不准退回 1.0 卡面
      ring.append(art); return ring;
    }

    // 每秒只更新會變的：冷卻秒數與可按狀態（不重建節點，焦點與拖曳才不會被打斷）
    function updateSlots(v, now) {
      const host = $('slots');
      for (let i = 0; i < 4; i++) {
        const slot = host.children[i], b = slot?.querySelector('.skill-use'), name = slot?.querySelector('.skill-name');
        if (!b) continue;
        const def = v.skillDefs[i], until = v.skillCd && v.skillCd[i] || 0, left = Math.max(0, Math.ceil((until - now) / 1000));
        // 空格要能點（點了就去編隊）；只有「發動技能」才受戰鬥中／冷卻限制（Codex 複檢 3-3）
        b.disabled = store.blocked || (!!def && (!!left || !v.stage));
        if (name) name.textContent = def ? (left ? `${def.name}・${left}s` : def.name) : '選夥伴';
        // 冷卻用 1.0 同一個圓形遮罩（.skill-slot[data-state="cooldown"] .skill-use::after 讀 --cooldown）
        slot.dataset.state = !def ? 'empty' : left ? 'cooldown' : v.stage ? 'ready' : 'unavailable';
        const total = def ? A.RULES.SKILLS[def.rarity]?.cd || 60000 : 1;
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
      $('click-next').textContent = `點一下 ${format(v.tapDamage)} → ${format(v.tapDamage / v.clickMul * (v.clickMul + T.click.MUL))}`;
      $('click-price').textContent = format(v.clickCost);
      $('training-level').textContent = `Lv.${v.teamLevel}`;
      $('training-next').textContent = `全隊戰力 ×${v.teamMul.toFixed(2)} → ×${(v.teamMul + T.team.MUL).toFixed(2)}`;
      $('training-price').textContent = format(v.teamCost);
      for (const [type, cost] of [['click', v.clickCost], ['training', v.teamCost]]) {
        $(`${type}-one`).textContent = '升級！';
        $(`${type}-one`).disabled = $(`${type}-max`).disabled = v.coins < cost || store.blocked;
      }
      $('draw-price').textContent = v.tickets ? `券 ×${v.tickets}` : format(v.drawCost1);
      $('draw-ticket').title = `末世券只能用桌邊金幣換；抽卡先用券，不夠才付末世金幣（下一抽 ${format(v.drawCost1)}）`;
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
      $('stats-body').textContent = '這一頁是末世的數字。下面的匯出／匯入存檔是兩個世界共用的同一份存檔。';
      const grid = $('badge-grid'); grid.replaceChildren();
      for (const [k, val] of [['通過站數', `${v.progress} / ${v.stations}`], ['收藏', `${v.owned.length} / ${Pool().length}`], ['戰力', format(v.power)],
        ['抽卡次數', format(v.stats.draws)], ['點擊次數', format(v.stats.taps)], ['最高一擊', format(v.stats.maxHit)], ['破盾次數', format(v.stats.shieldBreaks)],
        ['換到的券', format(v.exchangeTotal)], ['點擊力', `Lv.${v.clickLevel}`], ['全隊訓練', `Lv.${v.teamLevel}`]]) {
        const cell = document.createElement('div'); cell.className = 'apoc-stat';
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
      $('passive-rate').textContent = `每秒 ${format(v.power * A.RULES.IDLE_COINS)}`;
      $('next-goal').textContent = v.progress >= v.stations ? '全線已通行' : `第 ${Math.min(v.progress + 1, v.stations)} / ${v.stations} 站・收藏 ${v.owned.length} / ${Pool().length} 張`;
      $('owned-count').textContent = `${v.owned.length} / ${Pool().length}`;
      // 1.0 的 numbers() 在末世不跑，這幾顆鍵的可用狀態要自己設，不然會卡在 HTML 的預設值
      // （#scene-open 在 HTML 裡是 disabled 的 → 末世會完全打不開場景面板）
      $('scene-open').disabled = false; $('scene-open').title = '回到關卡地圖';
      setLabel($('scene-open').querySelector('span'), '地圖');
      $('roster-open').disabled = $('team-open').disabled = false;
      // 使用者第三輪：頂列「統計」＝末世戰績、頁尾「商店」＝兌換所＋外觀、「換桌布」那一格＝重走廢土（鍵先放，全線通行後開放）
      setLabel($('stats-open').querySelector('span'), '戰績');
      setLabel($('prestige-open'), '重走廢土');
      setButton('prestige-open', true, v.cleared ? '重走廢土：還在設計，之後開放' : '全線通行之後開放（還在設計）');
      hide('recruit-open');   // 末世的演出固定是精裝典藏包，沒有演出方式可選
      if ($('daily-bag')) hide('daily-bag');   // 今日限定包是 1.0 的東西
    }

    // 進入／離開末世：只換 body 的旗標與一次重繪，版面節點完全共用
    // 進末世：開門禮（普發玥玥＋10 券）只發一次。舊版是 iframe 開啟時發的，
    // iframe 拿掉之後沒人發 → 第一次進去會是空隊伍、0 券，什麼都不能做。
    function enter() {
      document.body.dataset.world = 'apoc'; lastTick = Date.now(); buddyKey = slotKey = shopKey = '';
      document.body.dataset.apocTheme = 'aged';   // 使用者 09-13 選定：舊化的 1.0 材質（apoc/theme.css）
      if (store.state?.apoc?.unlocked && !store.state.apoc.gifted) apply(a => A.gift(a));
      render();
    }
    function leave() {
      buddyKey = slotKey = shopKey = '';
      delete document.body.dataset.world; delete document.body.dataset.apocTheme;
      const e = $('apoc-enemy'); if (e) { e.hidden = true; e.getAnimations().forEach(a => a.cancel()); }
      // 受擊特效是末世自己畫的，切回桌邊要收乾淨（粒子 scope 只清自己的，不會動到 1.0 的）
      fx?.stop(); fx = null; document.querySelectorAll('#floaters .apoc-hit, #floaters .apoc-hit-impact').forEach(el => el.remove());
      // 王關的護盾文字借用桌邊的效果標籤，不收掉會留在桌邊（Codex 第二輪 B12）
      const label = $('effect-label'); if (label) { label.hidden = true; label.classList.remove('broken'); }
      $('apoc-exchange')?.remove();
      restoreLabels(); restoreButtons(); unhide();
    }

    // 末世沒有離線收益：回到前景時把時間基準拉回現在，不然第一個 tick 會補結算最多 60 秒
    //（Codex 第二輪 B5）
    function resume() { lastTick = Date.now(); }
    // 招募層要借 GachaFx 的全域畫布：先把末世的粒子停掉清乾淨，不然會畫到招募層上（Codex 第三輪）
    function stopFx() { fx?.stop(); fx = null; }
    return {
      render, enter, leave, tap, tick, apply, resume, train, openShop, openStats, stopFx,
      exchange: exchangeTicket,
      page(dir) { buddyPage = Math.max(0, buddyPage + dir); buddyKey = ''; render(); },
      fight: () => apply((x, n) => A.fight(x, n)),
      drawn: ids => apply(x => A.drawn(x, ids)),
      get view() { return view(); },
    };
  }
  return { create, enemyArt };
})();
