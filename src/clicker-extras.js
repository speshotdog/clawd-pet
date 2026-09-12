// 第十二輪：每日一包、里程碑徽章牆、分享卡、存檔匯出／匯入、冰箱霜層與碎冰。
// 上半是純邏輯（node 可 require、npm test 直接測）；下半是宿主 UI（clicker.js 以 create() 掛上）。
// 素材檔名全部集中在 ASSETS，等素材補上只要換檔名；缺檔一律 onerror 退回現有素材。
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const Scenes = node ? require('./clicker-scene.js').scenes : root.ClickerScenes;
  const PREFIX = 'ZMDD1.';
  const ASSETS = {
    daily: { bag: 'clicker-daily-bag.png', fallback: 'clicker-gift-bag.png', tape: 'clicker-ui-tape-1.png', star: 'clicker-star.png' },
    badge: id => `clicker-badge-${id}.png`,
    badgeBase: { star: 'clicker-ui-badge-star.png', paw: 'clicker-ui-badge-paw.png', heart: 'clicker-ui-badge-heart.png' },
    badgeStar: 'clicker-star.png',
    share: { kraft: 'clicker-ui-kraft.png', tape: 'clicker-ui-title-tape.png', url: 'speshotdog.github.io/clawd-pet' },
    frost: { layer: 'clicker-frozen-frost.png', ice: 'clicker-frozen-ice.png', iceFallback: 'clicker-fx-snow.png' },
  };
  const pad = n => String(n).padStart(2, '0');
  const localDate = ms => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const totalPackages = s => (s.package.index - 1) + Object.entries(s.scenePackages || {}).filter(([id]) => id !== s.settings.scene).reduce((sum, [, p]) => sum + (p.index - 1), 0);
    // 今日限定包只吃點擊：需求用「當下 25 次點擊」估（原本 3×H(k) 在第 60 包是 24 萬，點五千下才拆得完）
  const dailyNeed = s => Math.max(100, 80 * E.rates(s).D);
  // ---------- 每日一包 ----------
  // 以 settledAt 的本地日期判斷；日期變了就換一包（沒拆不累積）。連續天數：昨天有拆才延續，否則歸零。
  function dailyRoll(state) {
    const date = localDate(state.settledAt);
    if (state.daily?.date === date) return state;
    const s = E.clone(state), prev = s.daily, yesterday = localDate(state.settledAt - 86400000);
    s.daily = { date, done: false, need: dailyNeed(s), dealt: 0, streak: prev?.done && prev.date === yesterday ? prev.streak : 0 };
    return s;
  }
  function dailyHit(s, amount) {
    const d = s.daily; if (!d || d.done || !(amount > 0)) return false;
    d.dealt = Math.min(d.need, d.dealt + amount);
    if (d.dealt < d.need) return false;
    const reward = s.markShop?.daily2 ? 2 : 1;
    d.done = true; d.streak++; s.freeDraws = (s.freeDraws || 0) + reward; s.universalDust = (s.universalDust || 0) + reward;
    // 金幣獎勵：等於這包的需求（拆包時已經拿到一份，等於再給一份）
    d.bonus = d.need * reward; s.coins += d.bonus; s.lifetimeCoins += d.bonus;
    return true;
  }
  // 點今日限定包：拆包力進限定包、幣照給、一般包不動（E.click 的 sink）
  function dailyClick(state, now) {
    if (!state.daily || state.daily.done) throw new Error('今天的限定包已經拆完');
    let done = false;
    const result = E.click(state, now, undefined, { sink: (s, amount) => { done = dailyHit(s, amount); } });
    return { ...result, done };
  }
  // burst 也打限定包（額外目標，不另外給幣）
  function dailyBurst(state, value) {
    if (!state.daily || state.daily.done) return { state, done: false };
    const s = E.clone(state); return { state: s, done: dailyHit(s, value) };
  }
  // ---------- 里程碑徽章 ----------
  const bossScenes = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket', 'fridge', 'city'];
  const BADGES = [
    ...[[10, 'toy-dino.png'], [25, 'toy-ballyellow.png'], [50, 'toy-beachball.png'], [100], [300], [1000]].map(([n, toy]) => ({
      id: `pack${n}`, name: `第 ${n} 包`, desc: `累計拆滿 ${n} 包`, icon: 'star', label: String(n), toy, test: s => totalPackages(s) >= n })),
    ...bossScenes.map((id, i) => ({ id: `boss-${id}`, name: `${Scenes[id].boss?.name || '大罐頭'}・${Scenes[id].name}`, desc: `打贏${Scenes[id].name}的${Scenes[id].boss?.name || '大罐頭'}`, icon: 'paw', label: `王${i + 1}`, test: s => (s.bossWins || []).includes(id) })),
    { id: 'star5', name: '第一次 5★', desc: '任一夥伴升到 5★', icon: 'heart', label: '5★', test: s => Object.keys(B.characters).some(id => E.stars(E.dust(s, id)) >= 5) },
    { id: 'promote', name: '第一次升階', desc: '任一夥伴升階', icon: 'heart', label: '升階', test: s => Object.values(s.promotions || {}).some(v => v > 0) },
    { id: 'transcend', name: '第一次超越', desc: '任一夥伴超越', icon: 'heart', label: '超越', test: s => Object.values(s.transcend || {}).some(v => v > 0) },
    { id: 'streak7', name: '連續 7 天', desc: '連續 7 天拆完今日限定包', icon: 'star', label: '7日', test: s => (s.daily?.streak || 0) >= 7 },
    { id: 'coins1e8', name: '生涯 1 億', desc: '生涯收入達 1 億幣', icon: 'star', label: '1億', test: s => s.lifetimeCoins >= 1e8 },
    // v3 大掃除補償：換過桌布的老玩家（DESIGN-2026-09-12-content-architecture §十一）
    { id: 'oldtimes', name: '舊時代的珍母', desc: '大掃除之前就換過桌布的老玩家', icon: 'heart', label: '舊', test: s => (s.legacy?.prestiges || 0) >= 1 },
  ];
  const badge = id => BADGES.find(b => b.id === id);
  function checkBadges(state) {
    const earned = BADGES.filter(b => !(state.badges || []).includes(b.id) && b.test(state)).map(b => b.id);
    if (!earned.length) return { state, earned };
    const s = E.clone(state); s.badges = [...(s.badges || []), ...earned];
    return { state: s, earned };
  }
  const toys = s => BADGES.filter(b => b.toy && (s.badges || []).includes(b.id)).map(b => b.toy);
  // 第 100 包 12 選 1：送該角色粉塵 1 顆（等於一張卡）
  const canPick = s => (s.badges || []).includes('pack100') && !s.pick100;
  function pick100(state, id) {
    if (!canPick(state)) throw new Error('還沒到第 100 包，或已經選過');
    if (!B.originalIds.includes(id)) throw new Error('未知角色');
    const s = E.clone(state); s.pick100 = id; s.dust ||= {}; s.dust[id] = E.dust(s, id) + 1;
    return s;
  }
  // ---------- 匯出／匯入 ----------
  const encodeSave = s => PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s, (key,value) => key === 'thief' ? undefined : value))));
  function decodeSave(text) {
    const t = String(text || '').trim();
    if (!t.startsWith(PREFIX)) throw new Error(`格式不對：存檔字串要以 ${PREFIX} 開頭`);
    let json; try { json = decodeURIComponent(escape(atob(t.slice(PREFIX.length)))); } catch { throw new Error('不是有效的 base64 字串'); }
    let obj; try { obj = JSON.parse(json); } catch { throw new Error('存檔內容不是 JSON'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('存檔內容不是物件');
    return obj;
  }
  // 驗證過的存檔在匯入前套時間高水位：settledAt 不能在未來；王包進行中視同放棄
  function prepareImport(validated, now) {
    let s = E.clone(validated);
    if (s.settledAt > now) s.settledAt = now;
    if (s.boss) s = E.abandonBoss(s, now);
    return s;
  }
  const summary = s => ({ coins: s.coins, packages: totalPackages(s), partners: Object.keys(s.collection).length, savedAt: s.savedAt, scene: Scenes[s.settings.scene]?.name || s.settings.scene });
  // ---------- 分享卡文案 ----------
  function shareTitle(kind, data = {}) {
    if (kind === 'boss') return `打贏了${Scenes[data.scene]?.boss?.name || '大罐頭'}`;
    if (kind === 'transcend') return `${data.name || '夥伴'} 超越五！`;
    if (kind === 'badge') return `拿到「${badge(data.id)?.name || data.id}」徽章`;
    return `我拆了 ${data.packages ?? 0} 包`;
  }
  const pure = { PREFIX, ASSETS, BADGES, badge, localDate, totalPackages, dailyNeed, dailyRoll, dailyHit, dailyClick, dailyBurst, checkBadges, toys, canPick, pick100, encodeSave, decodeSave, prepareImport, summary, shareTitle };
  if (node) { module.exports = pure; return; }

  // ======================= 瀏覽器：UI =======================
  let instance = null;
  function create({ store, card, commit, changed, action, notice, format, sound, stage, reload, gacha, cutin }) {
    const $ = id => document.getElementById(id), Pool = root.GachaPool, S = root.ClickerSave;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const RIBBON = ['#EF8E8E', '#E9B94E', '#94BED0', '#B8A2CF', '#9BAF6B'];
    // ⚠ left 原本是 300 → x=300..380 跟拆包鍵（x=184..424、y=20..260）疊了 3680px²，
    //   實測珍母身上有 4.3% 的面積點下去是開今日限定包、不是拆包。搬到左側空地（x=30..110）。
    const DAILY = { left: 30, top: 214, w: 80, h: 92 };
    const DAILY_POINT = { x: 16 + DAILY.left + DAILY.w / 2, y: 72 + DAILY.top + DAILY.h / 2 };
    const BAG_POINT = { x: 485, y: 262 };
    let dailyShown = false, lastBoss = null, lastAwakened = -1, offerTimer = 0, share = null, popTimer = 0;
    const scene = () => root.ClickerScene.current || root.ClickerScene.resolve(store.state?.settings.scene);
    const busy = () => !!gacha?.active || !!cutin?.active || !!stage?.bossBusy;
    const img = (src, fallback) => { const el = new Image(); el.alt = ''; el.draggable = false; el.onerror = () => { if (fallback && el.getAttribute('src') !== fallback) el.src = fallback; else el.style.visibility = 'hidden'; }; el.src = src; return el; };

    // ---------- 舞台元素：今日限定包、回升標、霜層、徽章蓋章 ----------
    const stageEl = $('stage');
    const dailyEl = document.createElement('button'); dailyEl.id = 'daily-bag'; dailyEl.type = 'button'; dailyEl.hidden = true;
    dailyEl.setAttribute('aria-label', '今日限定包：拆完送免費單抽 +1 與萬用粉塵 +1');
    dailyEl.style.cssText = `left:${DAILY.left}px;top:${DAILY.top}px;width:${DAILY.w}px;height:${DAILY.h}px`;
    const dailyImg = img(ASSETS.daily.bag, ASSETS.daily.fallback); dailyImg.className = 'daily-image';
    const dailyTape = img(ASSETS.daily.tape); dailyTape.className = 'daily-tape';
    const dailyStar = img(ASSETS.daily.star); dailyStar.className = 'daily-star';
    const dailyMeter = document.createElement('i'); dailyMeter.className = 'daily-meter'; dailyMeter.innerHTML = '<b></b>';
    const dailyLabel = document.createElement('small'); dailyLabel.className = 'daily-label'; dailyLabel.textContent = '今日限定';
    dailyEl.append(dailyImg, dailyTape, dailyStar, dailyLabel, dailyMeter);
    $('boss-challenge').before(dailyEl);
    const regenTag = document.createElement('div'); regenTag.id = 'regen-tag'; regenTag.hidden = true;
    regenTag.append(img(ASSETS.frost.ice, ASSETS.frost.iceFallback)); const regenText = document.createElement('b'); regenTag.append(regenText);
    stageEl.append(regenTag);   // ⚠ CSS 是 `#stage > #regen-tag`，一定要留在舞台裡（#slots 已搬出舞台，不能再當插入點）
    const frost = document.createElement('div'); frost.id = 'frost'; frost.hidden = true; $('bag').append(frost);
    const frostImg = img(ASSETS.frost.layer); frostImg.className = 'frost-image'; frost.append(frostImg);
    const pop = document.createElement('div'); pop.id = 'badge-pop'; pop.hidden = true; stageEl.append(pop);
    const offer = document.createElement('button'); offer.id = 'share-offer'; offer.type = 'button'; offer.textContent = '分享'; offer.hidden = true; $('notice').after(offer);

    function motion(el, frames, ms, easing = 'ease-out') {
      if (reduced.matches) return { finished: Promise.resolve() };
      return el.animate(frames, { duration: ms, easing, fill: 'backwards' });
    }
    function floatText(text, point, color = '#FFF6E6', size = 20) {
      const el = document.createElement('span'); el.className = 'floater extra-floater'; el.style.cssText = `left:${point.x - 90}px;top:${point.y - 12}px;font-size:${size}px;color:${color}`;
      const b = document.createElement('b'); b.textContent = text; el.append(b); $('floaters').append(el);
      const a = motion(el, [{ transform: 'translateY(0) scale(.6)', opacity: 1 }, { transform: 'translateY(-4px) scale(1.1)', opacity: 1, offset: .1 }, { transform: 'translateY(-46px)', opacity: 1, offset: .75 }, { transform: 'translateY(-64px)', opacity: 0 }], 1100, 'linear');
      a.finished.then(() => el.remove()).catch(() => el.remove()); if (reduced.matches) setTimeout(() => el.remove(), 1100);
    }
    function ribbons(count, point) {
      for (let i = 0; i < count; i++) stage.spawn({ sprite: 8, x: point.x + (Math.random() - .5) * 30, y: point.y, vx: (Math.random() - .5) * 320, vy: -160 - Math.random() * 260, g: 480, life: .8 + Math.random() * .5, r: 8 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - .5) * 14, drag: .99, color: RIBBON[i % RIBBON.length], blend: 'source-over', shrink: true, fadeK: 4 });
    }

    // ---------- 每日一包 ----------
    function renderDaily(instant) {
      const s = store.state, d = s?.daily, show = !!d && !d.done && !s.boss && !stage.bossBusy;
      if (show) {
        dailyMeter.firstElementChild.style.width = `${Math.min(100, d.dealt / d.need * 100)}%`;
        dailyEl.title = `今日限定包 ${format(d.dealt)} / ${format(d.need)}・拆完送免費單抽 +${s.markShop?.daily2 ? 2 : 1}、萬用粉塵 +${s.markShop?.daily2 ? 2 : 1}`;
        dailyEl.setAttribute('aria-label', dailyEl.title);
        if (!dailyShown) {
          dailyEl.hidden = false; dailyShown = true;
          if (!instant && stage.running) {
            motion(dailyEl, [{ transform: 'translateY(-120px) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1, offset: .7 }, { transform: 'scale(1.1,.9)', opacity: 1, offset: .82 }, { transform: 'scale(1)', opacity: 1 }], 420, 'ease-in').finished.then(() => { stage.shake(4, 100); sound('upgrade'); }).catch(() => {});
            notice(`今日限定包上桌！拆完送免費單抽 +${s.markShop?.daily2 ? 2 : 1}、萬用粉塵 +${s.markShop?.daily2 ? 2 : 1}`);
          }
        }
      } else if (dailyShown) { dailyShown = false; dailyEl.hidden = true; }
      dailyEl.disabled = store.blocked || busy();
    }
    function dailyDone(s) {
      if (!commit(s)) return;
      ribbons(24, DAILY_POINT); sound('daily'); stage.shake(4, 140);
      floatText(`免費單抽 ＋${s.markShop?.daily2 ? 2 : 1}・萬用粉塵 ＋${s.markShop?.daily2 ? 2 : 1}`, { x: DAILY_POINT.x + 40, y: DAILY_POINT.y - 60 }, '#E9B94E', 22);
      notice(`今日限定包拆完！連續 ${s.daily.streak} 天`);
      dailyShown = false; dailyEl.disabled = true;
      // 拆完 700ms 後跳收據，把拿到什麼列清楚
      setTimeout(() => { if ($('daily-done').hidden) { $('daily-done-text').innerHTML = `<b>免費單抽 ＋${s.markShop?.daily2 ? 2 : 1}</b><br><b>萬用粉塵 ＋${s.markShop?.daily2 ? 2 : 1}</b><br><b>金幣 ＋${format(s.daily.bonus || 0)}</b><br><small>連續 ${s.daily.streak} 天・明天再來拆一包</small>`; openPanel('daily-done'); } }, 700);
      motion(dailyEl, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.4) rotate(6deg)', opacity: 1, offset: .35 }, { transform: 'scale(.2) translateY(-40px)', opacity: 0 }], 360).finished.then(() => { dailyEl.hidden = true; renderDaily(); }).catch(() => { dailyEl.hidden = true; });
      changed();
    }
    dailyEl.onclick = () => action(() => {
      if (busy() || !store.state.daily || store.state.daily.done) return;
      const r = dailyClick(store.state, Date.now());
      if (r.tutorial) { if (!commit(r.state)) return; stage.setPartners(store.state); stage.join(store.state, [{ id: 'yueyue2' }]); notice('教學獎勵：玥玥入隊！每秒 +4 幣，可發動尾巴節拍。'); }
      else store.stage(r.state);
      sound('click'); stage.float(r.amount, r.multiplier >= 10, { x: DAILY_POINT.x, y: DAILY_POINT.y - 30 });
      for (let i = 0; i < 6; i++) stage.spawn({ shape: 'shard', x: DAILY_POINT.x + (Math.random() - .5) * 20, y: DAILY_POINT.y - 20, vx: (Math.random() - .5) * 220, vy: -140 - Math.random() * 120, g: 460, life: .5 + Math.random() * .3, w: 8 + Math.random() * 6, h: 6 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - .5) * 10, drag: .99, color: '#E9B94E', color2: '#B8892E', fadeK: 4 });
      motion(dailyImg, [{ transform: 'scale(1)' }, { transform: 'scale(1.08,.94)', offset: .4 }, { transform: 'scale(1)' }], 140);
      if (r.done) dailyDone(r.state); else { renderDaily(); changed(); }
    });

    // ---------- 冰箱：回升標、霜層、碎冰 ----------
    function renderFrost() {
      const s = store.state, sc = scene(), rate = sc?.enemy?.regen;
      regenTag.hidden = !rate; frost.hidden = !rate || !!s.boss || stage.bossBusy;
      if (!rate) return;
      regenText.textContent = `−${Math.round(rate * 100)}%/秒`;
      const need = E.requirement(s.package.index, s.settings.scene), k = Math.max(0, Math.min(1, 1 - s.package.progress / need));
      const src = $('bag-image').getAttribute('src');
      if (frost.dataset.mask !== src) { frost.dataset.mask = src; frost.style.setProperty('--frost-mask', `url('${src}')`); }
      frost.style.setProperty('--frost', (0.15 + .85 * k).toFixed(3));
      frost.dataset.level = k > .66 ? 3 : k > .33 ? 2 : 1;
    }
    function shatter() {
      const cfg = scene()?.frost?.shards || { sprite: 9, count: 16, color: '#DFF3FF' };
      // 淺色場景上 lighter 幾乎看不見：碎冰用一般混合畫，外加一圈淡藍閃光
      for (let i = 0; i < cfg.count; i++) stage.spawn({ sprite: cfg.sprite, x: BAG_POINT.x + (Math.random() - .5) * 90, y: BAG_POINT.y + (Math.random() - .5) * 110, vx: (Math.random() - .5) * 380, vy: -80 - Math.random() * 280, g: 540, life: .6 + Math.random() * .4, r: 13 + Math.random() * 9, rot: Math.random() * 6, vr: (Math.random() - .5) * 12, drag: .99, color: i % 3 ? cfg.color : '#8CC8F0', blend: 'source-over', shrink: true, fadeK: 3 });
      stage.spawn({ sprite: 3, x: BAG_POINT.x, y: BAG_POINT.y, r: 50, life: .3, color: '#DFF3FF', blend: 'lighter', update(p) { p.r = 50 + 70 * (1 - p.life / p.max); } });
      stage.shake(3, 100);
      motion(frost, [{ opacity: 1 }, { opacity: 0, offset: .3 }, { opacity: 1 }], 400);
    }
    function afterBurst(result) {
      if (result.effect?.kind !== 'burst') return;
      // 切入演出期間舞台是凍結的，碎冰等切入結束（珍母一擊落下）再噴，才看得見
      if (scene()?.enemy?.regen) { const wait = () => cutin?.active ? setTimeout(wait, 50) : shatter(); wait(); }
      const r = dailyBurst(store.state, result.effect.value);
      if (r.state !== store.state) { if (r.done) dailyDone(r.state); else { store.stage(r.state); renderDaily(); } }
    }

    // ---------- 徽章 ----------
    function badgeNode(id, size = 64) {
      const b = badge(id), el = document.createElement('span'); el.className = 'badge-icon'; el.dataset.badge = id; el.style.setProperty('--size', `${size}px`);
      const art = img(ASSETS.badge(id)); art.className = 'badge-art';
      art.onerror = () => { art.remove(); el.classList.add('composed'); const base = img(ASSETS.badgeBase[b.icon]); base.className = 'badge-base'; const star = img(ASSETS.badgeStar); star.className = 'badge-star'; const label = document.createElement('b'); label.textContent = b.label; el.append(base, star, label); };
      el.append(art); return el;
    }
    function badgeEarned(id) {
      const b = badge(id); if (!b) return;
      notice(`徽章：${b.name}`); offerShare('badge', { id });
      if (b.toy) decorate();
      if (stage.running && !document.hidden) {
        pop.replaceChildren(badgeNode(id, 96)); const name = document.createElement('b'); name.textContent = b.name; pop.append(name); pop.hidden = false;
        clearTimeout(popTimer);
        motion(pop, [{ transform: 'scale(0) rotate(-12deg)' }, { transform: 'scale(1.18) rotate(3deg)', offset: .7 }, { transform: 'scale(1) rotate(0)' }], 220, 'cubic-bezier(.2,1.4,.4,1)').finished.then(() => { stage.shake(4, 120); sound('badge'); }).catch(() => {});
        popTimer = setTimeout(() => { motion(pop, [{ opacity: 1 }, { opacity: 0 }], 260).finished.then(() => { pop.hidden = true; }).catch(() => { pop.hidden = true; }); }, 1800);
      }
      // 第 100 包的 12 選 1 不再自動彈出（會蓋到王包／禮包），改由徽章牆的按鈕手動開
      if (id === 'pack100') notice('第 100 包！到徽章牆選一位夥伴，送該角色粉塵 1 顆');
    }
    // 里程碑玩具進當前場景的 props 槽（缺 props 層就補一層）
    const TOY_SLOTS = [[62, 334], [122, 338], [178, 332]];
    function decorate(host = document.getElementById('clicker-scene')) {
      const s = store.state; if (!host || !s) return;
      let layer = host.querySelector('[data-layer="props"]');
      if (!layer) { layer = document.createElement('div'); layer.className = 'scene-layer'; layer.dataset.layer = 'props'; layer.style.zIndex = host.querySelectorAll('.scene-layer').length; host.append(layer); }
      toys(s).forEach((src, i) => {
        if (layer.querySelector(`img[data-toy="${src}"]`)) return;
        const el = img(src); el.dataset.toy = src; el.className = 'scene-toy'; el.style.cssText = `left:${TOY_SLOTS[i][0]}px;top:${TOY_SLOTS[i][1]}px;height:60px;translate:-50% -100%;`;
        layer.append(el);
        if (stage.running) motion(el, [{ transform: 'translateY(-60px) scale(.6)', opacity: 0 }, { transform: 'translateY(0) scale(1.1)', opacity: 1, offset: .75 }, { transform: 'scale(1)' }], 360, 'ease-in');
      });
    }

    // ---------- 12 選 1 ----------
    function openPick() {
      const s = store.state; if (!canPick(s)) return;
      const grid = $('pick100-grid'); grid.replaceChildren();
      for (const id of B.originalIds) {
        const entry = Pool.byId[id], el = document.createElement('button'); el.type = 'button'; el.className = 'pick-card'; el.dataset.id = id;
        el.append(card.art.create(entry)); const name = document.createElement('b'); name.textContent = entry.name; el.append(name);
        const owned = document.createElement('small'); owned.textContent = s.collection[id] ? `粉塵 ${E.dust(s, id)} 顆` : '尚未招募'; el.append(owned);
        el.onclick = () => action(() => { if (!commit(pick100(store.state, id))) return; closePanel('pick100'); notice(`${entry.name} 粉塵 +1`); sound('promote'); changed(); });
        grid.append(el);
      }
      openPanel('pick100');
    }

    // ---------- 徽章牆（統計面板） ----------
    function openWall() {
      const s = store.state; if (!s) return;
      $('stats-body').textContent = `生涯收入 ${format(s.lifetimeCoins)} 幣｜手點 ${format(s.manualClicks)} 次｜已拆 ${totalPackages(s)} 包｜夥伴 ${Object.keys(s.collection).length} / ${Object.keys(B.characters).length}｜付費抽數 ${s.paidDraws}｜漏掉 ${s.missed || 0} 包｜連續 ${s.daily?.streak || 0} 天`;
      const grid = $('badge-grid'); grid.replaceChildren();
      for (const b of BADGES) {
        const el = document.createElement('div'); el.className = 'badge-cell'; el.dataset.id = b.id; el.classList.toggle('earned', s.badges.includes(b.id));
        el.title = `${b.name}：${b.desc}`; el.append(badgeNode(b.id)); const name = document.createElement('small'); name.textContent = b.name; el.append(name); grid.append(el);
      }
      $('pick100-open').hidden = !canPick(s);
      $('badge-count').textContent = `${s.badges.length} / ${BADGES.length}`;
      $('save-io').hidden = true; $('import-check').hidden = true; $('import-confirm').hidden = true; $('io-text').value = ''; $('io-status').textContent = '';
      openPanel('stats');
    }
    function showExport() {
      $('save-io').hidden = false; $('import-check').hidden = true; $('import-confirm').hidden = true; $('io-copy').hidden = false;
      $('io-text').readOnly = true; $('io-text').value = encodeSave(store.state); $('io-status').textContent = '複製這串文字，就是你的存檔。'; $('io-text').select();
    }
    function showImport() {
      $('save-io').hidden = false; $('import-check').hidden = false; $('import-confirm').hidden = true; $('io-copy').hidden = true;
      $('io-text').readOnly = false; $('io-text').value = ''; $('io-status').textContent = '把存檔字串貼進來，先「檢查」再決定要不要覆蓋。'; $('io-text').focus();
    }
    let importCandidate = null;
    function checkImport() {
      importCandidate = null; $('import-confirm').hidden = true;
      try {
        const v = prepareImport(S.validate(decodeSave($('io-text').value), Pool), Date.now()), info = summary(v);
        importCandidate = v;
        $('io-status').textContent = `存檔 OK：${format(info.coins)} 幣、已拆 ${info.packages} 包、夥伴 ${info.partners} / ${Object.keys(B.characters).length}、場景 ${info.scene}、存檔時間 ${new Date(info.savedAt).toLocaleString('zh-TW')}。確定要覆蓋現在的存檔嗎？`;
        $('import-confirm').hidden = false;
      } catch (err) { $('io-status').textContent = `無法匯入：${err.message}`; }
    }
    function confirmImport() {
      if (!importCandidate) return;
      if (!store.commit(importCandidate)) { $('io-status').textContent = `寫入失敗：${store.error?.message || ''}`; return; }
      importCandidate = null; closePanel('stats'); reload(); notice('存檔已匯入');
    }
    async function copyText(text, ok = '已複製') { try { await navigator.clipboard.writeText(text); $('io-status').textContent = ok; } catch { $('io-status').textContent = '無法自動複製，請全選文字後手動複製。'; $('io-text').select(); } }

    // ---------- 分享卡 ----------
    const images = new Map();
    const load = src => images.get(src) || images.set(src, new Promise(resolve => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => resolve(null); el.src = src; })).get(src);
    const dataUrls = new Map();
    const inline = href => dataUrls.get(href) || dataUrls.set(href, fetch(href).then(r => r.blob()).then(blob => new Promise(resolve => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => resolve(null); fr.readAsDataURL(blob); })).catch(() => null)).get(href);
    // 角色 SVG 立繪 → 內嵌所有 <image> → data:image/svg+xml → Image
    async function portrait(id) {
      if (Pool.byId[id].src) return load(Pool.byId[id].src);
      const svg = card.art.create(Pool.byId[id]); if (!(svg instanceof SVGElement)) return null;
      const box = (svg.getAttribute('viewBox') || '0 0 200 200').split(/[\s,]+/).map(Number);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', box[2]); svg.setAttribute('height', box[3]); svg.removeAttribute('style');
      for (const el of svg.querySelectorAll('image')) {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href'); if (!href || href.startsWith('data:')) continue;
        const data = await inline(href); if (data) { el.setAttribute('href', data); el.removeAttribute('xlink:href'); } else el.remove();
      }
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
      return new Promise(resolve => { const el = new Image(); el.onload = () => resolve(el); el.onerror = () => resolve(null); el.src = url; });
    }
    function text(ctx, str, x, y, size, { color = '#30251F', stroke = '#FFF6E6', width = 6, align = 'left', weight = 800, maxWidth } = {}) {
      ctx.font = `${weight} ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y, maxWidth); ctx.fillStyle = color; ctx.fillText(str, x, y, maxWidth);
    }
    // 場景縮圖：依 scene.layers 座標把各層 img 重畫一次（舞台 24..584 × 24..336 的可見區）
    async function drawScene(ctx, sc, x, y, w, h) {
      const k = w / 560; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.fillStyle = sc.palette.sky; ctx.fillRect(x, y, w, h);
      ctx.translate(x - 24 * k, y - 24 * k); ctx.scale(k, k);
      for (const def of sc.layers) {
        if (def.src) { const el = await load(def.src); if (el) ctx.drawImage(el, def.x ?? -12, def.y, def.w ?? 632, def.h); }
        for (const [j, [sx, sy]] of (def.slots || []).entries()) {
          const el = await load(def.sprites[j % def.sprites.length]); if (!el) continue;
          const ww = def.h * el.naturalWidth / el.naturalHeight; ctx.drawImage(el, def.drift ? sx : sx - ww / 2, def.drift ? sy : sy - def.h, ww, def.h);
        }
        for (const [j, src] of (def.canopy || []).entries()) { const el = await load(src); if (el) ctx.drawImage(el, ...def.canopySlots[j]); }
      }
      for (const src of toys(store.state)) { const el = await load(src); if (el) { const i = toys(store.state).indexOf(src), ww = 60 * el.naturalWidth / el.naturalHeight; ctx.drawImage(el, TOY_SLOTS[i][0] - ww / 2, TOY_SLOTS[i][1] - 60, ww, 60); } }
      if (sc.tint) { ctx.globalCompositeOperation = sc.tint.blend === 'multiply' ? 'multiply' : 'source-over'; ctx.globalAlpha = sc.tint.opacity; ctx.fillStyle = sc.tint.color; ctx.fillRect(-100, -100, 900, 700); }
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = '#30251F'; ctx.strokeRect(x, y, w, h);
    }
    async function compose(kind, data) {
      const s = store.state, sc = Scenes[s.settings.scene] || scene(), canvas = $('share-canvas'), ctx = canvas.getContext('2d');
      canvas.width = 960; canvas.height = 540;
      const kraft = await load(ASSETS.share.kraft);
      ctx.fillStyle = '#E9D6B4'; ctx.fillRect(0, 0, 960, 540);
      if (kraft) { ctx.fillStyle = ctx.createPattern(kraft, 'repeat'); ctx.fillRect(0, 0, 960, 540); }
      ctx.lineWidth = 8; ctx.strokeStyle = '#30251F'; ctx.strokeRect(14, 14, 932, 512);
      const tape = await load(ASSETS.share.tape);
      if (tape) ctx.drawImage(tape, 40, 26, 300, 72); else { ctx.fillStyle = '#EF8E8E'; ctx.fillRect(40, 30, 300, 64); }
      text(ctx, '珍母點點', 190, 78, 34, { align: 'center', stroke: '#FFF6E6', width: 5 });
      const title = shareTitle(kind, data);
      const width = 9, available = 470;
      ctx.font = '800 64px "Noto Sans TC","Microsoft JhengHei",sans-serif';
      let size = Math.max(30, Math.min(64, Math.floor(64 * available / (ctx.measureText(title).width + width))));
      ctx.font = `800 ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
      // 描邊不隨字級縮小，取整後再確認實際寬度。
      while (size > 30 && ctx.measureText(title).width + width > available) {
        size--; ctx.font = `800 ${size}px "Noto Sans TC","Microsoft JhengHei",sans-serif`;
      }
      const lines = [title];
      if (ctx.measureText(title).width + width > available) {
        let split = -1;
        for (let i = 1; i < title.length; i++) {
          if (title[i] === '「' || title[i] === '・') split = i;
          else if (title[i] === '」' && i + 1 < title.length) split = i + 1;
        }
        if (split < 0) split = Math.ceil(title.length / 2);
        lines.splice(0, 1, title.slice(0, split), title.slice(split));
      }
      lines.forEach((line, i) => text(ctx, line, 48, 210 + i * size * 1.05, size, { width, maxWidth: available - width }));
      text(ctx, `${sc.name}・${localDate(Date.now())}`, 50, 252 + (lines.length - 1) * size * 1.05, 22, { color: '#735E4E', width: 4 });
      const ids = [...new Set([...s.skillSlots.filter(Boolean), ...Object.keys(B.characters).filter(id => s.collection[id])])].slice(0, 3);
      const arts = await Promise.all(ids.map(portrait));
      ids.forEach((id, i) => {
        const cx = 120 + i * 130, cy = 400;
        ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.fillStyle = '#FFF6E6'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#30251F'; ctx.stroke();
        const el = arts[i];
        if (el) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 54, 0, Math.PI * 2); ctx.clip(); const hh = 104, ww = hh * el.width / el.height; ctx.drawImage(el, cx - ww / 2, cy - hh / 2 + 4, ww, hh); ctx.restore(); }
        text(ctx, Pool.byId[id].name.replace('（原版）', ''), cx, cy + 86, 18, { align: 'center', width: 4 });
      });
      if (!ids.length) text(ctx, '還沒有夥伴，點 50 次迎接玥玥', 60, 400, 22, { color: '#735E4E', width: 4 });
      await drawScene(ctx, sc, 520, 120, 392, 218);
      if (tape) { ctx.save(); ctx.translate(716, 118); ctx.rotate(-.05); ctx.drawImage(tape, -70, -16, 140, 34); ctx.restore(); }
      text(ctx, `已拆 ${totalPackages(s)} 包・徽章 ${s.badges.length} 枚`, 716, 372, 20, { align: 'center', width: 4 });
      text(ctx, ASSETS.share.url, 924, 512, 20, { align: 'right', color: '#735E4E', width: 4 });
      return canvas;
    }
    function offerShare(kind, data) {
      share = { kind, data }; offer.hidden = false; clearTimeout(offerTimer);
      motion(offer, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)' }], 240);
      offerTimer = setTimeout(() => { offer.hidden = true; }, 8000);
    }
    let composing = null;
    function openShare(kind = share?.kind || 'packs', data = share?.data || { packages: totalPackages(store.state) }) {
      if (busy()) return;
      $('share-status').textContent = '合成中…'; $('share-download').disabled = $('share-copy').disabled = true;
      openPanel('share');
      composing = compose(kind, data).then(() => { $('share-status').textContent = '下載 PNG，或複製到剪貼簿貼給朋友。'; $('share-download').disabled = $('share-copy').disabled = false; }).catch(err => { $('share-status').textContent = `合成失敗：${err.message}`; });
      return composing;
    }
    function download() {
      const canvas = $('share-canvas');
      canvas.toBlob(blob => {
        if (!blob) { $('share-status').textContent = '無法產生圖片'; return; }
        const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `zhenmu-${localDate(Date.now())}.png`; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000); $('share-status').textContent = '已送出下載。';
      }, 'image/png');
    }
    function copyImage() {
      const canvas = $('share-canvas');
      canvas.toBlob(async blob => {
        try { if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); $('share-status').textContent = '已複製到剪貼簿。'; }
        catch { $('share-status').textContent = '這個環境無法複製圖片，請用下載。'; }
      }, 'image/png');
    }

    // ---------- 面板開關 ----------
    function openPanel(id) { $(id).hidden = false; $('game-content').inert = true; $(`${id}-close`).focus(); }
    function closePanel(id) { $(id).hidden = true; $('game-content').inert = !!gacha?.active; $('tap').focus(); }
    function escape() {
      for (const id of ['share', 'pick100', 'daily-done']) if (!$(id).hidden) { closePanel(id); return true; }
      return false;
    }
    $('share-close').onclick = () => closePanel('share'); $('pick100-close').onclick = () => closePanel('pick100'); $('daily-done-close').onclick = () => closePanel('daily-done');
    $('share-download').onclick = download; $('share-copy').onclick = copyImage;
    $('badge-share').onclick = () => { closePanel('stats'); openShare('packs', { packages: totalPackages(store.state) }); };
    $('pick100-open').onclick = () => { closePanel('stats'); openPick(); };
    $('io-export').onclick = showExport; $('io-import').onclick = showImport; $('io-copy').onclick = () => copyText($('io-text').value);
    $('import-check').onclick = checkImport; $('import-confirm').onclick = confirmImport;
    offer.onclick = () => { if (share) openShare(share.kind, share.data); };

    // ---------- 每秒／每次動作後的掛鉤 ----------
    function tick() {
      const s = store.state; if (!s || store.blocked) return;
      let next = dailyRoll(s);
      const found = checkBadges(next); next = found.state;
      if (next !== s) { if (found.earned.length) commit(next); else store.stage(next); }
      const won = store.state.bossResult?.won ? store.state.bossResult.at : null;
      if (lastBoss !== null && won && won !== lastBoss) offerShare('boss', { scene: store.state.bossResult.scene });
      lastBoss = won ?? 0;
      const awakened = Object.keys(store.state.awakened || {}).filter(id => store.state.awakened[id]);
      if (lastAwakened >= 0 && awakened.length > lastAwakened) offerShare('transcend', { name: Pool.byId[awakened.at(-1)]?.name.replace('（原版）', '') });
      lastAwakened = awakened.length;
      found.earned.forEach(badgeEarned);
      renderDaily(); renderFrost();
    }
    // 隱藏時把分享鍵與徽章彈窗的計時器清掉（閒置狀態不能留任何 timer）
    function suspend() { clearTimeout(offerTimer); offerTimer = 0; clearTimeout(popTimer); popTimer = 0; offer.hidden = true; }
    instance = { tick, afterClick: renderFrost, afterBurst, decorate, openWall, openShare, openPick, escape, badgeEarned, suspend, get share() { return share; }, compose };
    decorate(); renderDaily(true); renderFrost();
    return instance;
  }
  root.ClickerExtras = { ...pure, create, decorate: (host, sc) => instance?.decorate(host, sc) };
})(typeof globalThis !== 'undefined' ? globalThis : this);
