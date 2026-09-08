window.ClickerGacha = (() => {
  function create({ store, card, commit, changed, pauseStage, resumeStage, joined, notice, format, canOpen = () => true }) {
    const $ = (id) => document.getElementById(id), E = window.ClickerEconomy;
    let runtime = null, mode = null, state = 'idle', ready = false;
    let currentId = null, summaryReady = false, busy = false, previousFocus = null;
    // 連抽時每一輪收下的夥伴先存著，等真的離開招募畫面再一次播入隊演出——
    // 演出是在舞台上跑的，招募層蓋著的時候播等於白播。
    let pendingJoins = [];
    // 連抽好幾輪才一起播入隊演出時，同一個角色可能在不同輪都被抽到。
    // stage.join() 是「一個角色一個目標圓鈕」的，同一個 id 出現兩次時第二次會查不到目標
    //（它是照分頁分批的，第二次查的時候頁面已經翻到別批了）→ getBoundingClientRect of null。
    const dedupe = (list) => { const seen = new Set(); return list.filter(e => !seen.has(e.id) && seen.add(e.id)); };
    const layer = $('recruit-layer');
    function priceButton(el, count, s, supported) {
      const cost = E.drawCost(s, Math.max(0,count-(s.freeDraws || 0))), missing = Math.max(0, Math.ceil(cost - s.coins));
      el.textContent = el.id === 'draw-one' ? '招募！' : el.id === 'draw-five' ? '五連' : `${count === 1 ? '單抽' : '五連'} · ${format(cost)}`; el.title = String(cost);
        if (el.id === 'draw-five') { const price = document.createElement('span'); price.className = 'draw-five-price'; price.textContent = s.freeDraws ? `免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}` : format(cost); el.append(price); }
      if (s.freeDraws && el.id.startsWith('recruit-')) el.textContent=`${count===1?'單抽':'五連'} · 免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}`;
      if (missing) { const note = document.createElement('small'); note.textContent = `還差 ${format(missing)}`; el.append(note); }
      el.disabled = !ready || !canOpen() || store.blocked || !!s.boss || !!s.pending || !supported || missing > 0 || busy;
    }
    function render() {
      const s = store.state; if (!s) return;
      $('draw-price').textContent = s.freeDraws ? `免費 ×${s.freeDraws}` : format(E.drawCost(s, 1)); $('draw-ticket').title = String(E.drawCost(s, Math.max(0,1-s.freeDraws)));
      const supported = window.GachaModes[s.settings.mode].counts.includes(1);
      const note = supported ? '' : '此演出只支援五連；單抽請選流星或拆包桌面。';
      for (const id of ['draw-one', 'recruit-one']) priceButton($(id), 1, s, supported);
      for (const id of ['draw-five', 'recruit-five']) priceButton($(id), 5, s, true);
      for (const id of ['pity', 'recruit-pity']) $(id).textContent = `最多再 ${40 - s.pity.sinceLegendary} 抽必得傳說`;
      $('single-note').textContent = supported ? '' : '此模式限五連；單抽請切換演出。'; $('recruit-note').textContent = note;
      $('mode-select').value = s.settings.mode; $('mode-select').disabled = !!s.pending || store.blocked;
      $('recruit-close').disabled = !!s.pending;
      $('collect').disabled = store.blocked || busy;
      $('recruit-mute').textContent = s.settings.muted ? '音效關' : '音效開';
    }
    function open() {
      if (!store.state || !ready || store.state.boss || !canOpen()) return;
      previousFocus = document.activeElement; layer.hidden = false; $('game-content').inert = true;
      pauseStage(); window.GachaFx.init($('fx'), $('fx-under')); $('mode-select').focus(); render();
    }
    function cleanup() {
      mode?.dispose(); mode = null; runtime?.stop(); runtime = null;
      card.liveEnd(); $('cards').replaceChildren(); $('mode-root').replaceChildren();
      $('flash').classList.remove('on'); layer.classList.remove('charging-mode');
    }
    function close() {
      if (store.state?.pending) return;
      cleanup(); layer.hidden = true; $('game-content').inert = false; $('recruit-entry').hidden = false;
      $('collect').hidden = $('collect-again').hidden = $('skip').hidden = $('reveal-all').hidden = true;
      resumeStage(); previousFocus?.focus();
      if (pendingJoins.length) { const all = pendingJoins; pendingJoins = []; joined(dedupe(all)); }
    }
    function summary() {
      summaryReady = true; $('collect').hidden = false; $('skip').hidden = $('reveal-all').hidden = true;
      // 錢是抽的當下就扣掉的，所以現在的 state 拿來算「還抽不抽得起下一次」是準的
      const s = store.state, again = $('collect-again');
      const cost = E.drawCost(s, Math.max(0, 5 - (s.freeDraws || 0)));
      const affordable = cost <= s.coins && window.GachaModes[s.settings.mode].counts.includes(5);
      again.hidden = !affordable;
      again.textContent = s.freeDraws ? `收下並繼續五連 · 免費 ×${Math.min(5, s.freeDraws)}` : `收下並繼續五連 · ${format(cost)}`;
      $('recruit-hint').textContent = affordable
        ? '結果已儲存。收下後夥伴就會開始幫忙，或直接再抽一次。'
        : '結果已儲存，收下後夥伴就會開始幫忙。';
      $('collect').focus(); render();
    }
    function makeRuntime(draw) {
      cleanup(); currentId = draw.id; summaryReady = false;
      const name = store.state.settings.mode;
      window.GachaFx.init($('fx'), $('fx-under'));
      $('mode-root').className = `mode-root mode-${name}`;
      runtime = window.GachaModeRuntime.create({
        root: $('mode-root'), size: { width: 960, height: 640 }, center: { x: 480, y: 320 },
        cardsEl: $('cards'), dim: $('dim'), card, mode: name,
        layout(i, count) { const n = i - 2; return count === 1 ? { x: 480, y: 320, rot: 0 } : { x: 480 + n * 168, y: 320 + Math.abs(n) ** 2 * 6.5, rot: n * 4 }; },
        state(next) { layer.classList.remove(`state-${state}`); state = next; layer.classList.add(`state-${state}`); },
        isFanned: () => state === 'fanned', isAuto: () => true,
        onCards() {}, onReveal() {}, summary,
        interactive() { $('reveal-all').hidden = false; },
        error(err) { notice(`演出中斷，已保留結果：${err.message}`); skip(); },
        shake(soft) {
          // 沿用演示區的整桌震（gacha.css 的 shake / shake-soft keyframes，搬到 clicker.css）
          const cls = soft ? 'shake-soft' : 'shake';
          layer.classList.remove('shake', 'shake-soft'); void layer.offsetWidth;
          layer.classList.add(cls); layer.addEventListener('animationend', () => layer.classList.remove(cls), { once: true });
        },
        flash() { $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on'); },
        charging(on) { layer.classList.toggle('charging-mode', on); },
      }, draw);
      return runtime;
    }
    function skip() {
      if (!runtime || !store.state?.pending) return;
      mode?.skip(); runtime.skip();
    }
    async function start(count) {
      const s = store.state;
      if (!ready || !canOpen() || busy || store.blocked || s.boss || s.pending || !window.GachaModes[s.settings.mode].counts.includes(count)) return;
      busy = true;
      try {
        const next = E.purchaseDraw(s, count, Date.now(), window.GachaPool);
        // 唯一寫入包含扣款、抽數、保底及 pending。成功以前沒有演出。
        if (!commit(next)) return;
        const ticket = $('draw-ticket'); ticket.getAnimations().forEach(a=>a.cancel());
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ticket.animate([{transform:'scale(1)'},{transform:'scale(.96)',offset:.5},{transform:'scale(1)'}],{duration:140});
        open(); $('recruit-entry').hidden = true; $('collect').hidden = true; $('skip').hidden = false;
        $('recruit-hint').textContent = ''; const run = makeRuntime(store.state.pending.draw);
        if (s.settings.mode === 'hearthstone') {
          const pack = document.createElement('div'); pack.className = 'pack'; $('mode-root').append(pack);
        }
        mode = window.GachaModes[s.settings.mode].create(run.ctx);
        run.run(mode.open(store.state.pending.draw));
      } catch (err) { notice(err.message); }
      finally { busy = false; changed(); render(); }
    }
    function collect(stay = false) {
      if (!summaryReady || busy || store.blocked) return;
      busy = true;
      try {
        const box = $('game').getBoundingClientRect(), zoom = box.width / 960, cards = [...$('cards').children];
        const entries = store.state.pending.draw.entries.map((item,i) => {
          const r = cards[i]?.getBoundingClientRect();
          return {id:item.entry.id, origin:r ? {x:(r.left+r.width/2-box.left)/zoom,y:(r.top+r.height/2-box.top)/zoom} : {x:480,y:320}};
        });
        const result = E.collect(store.state, currentId, Date.now());
        if (!result.accepted || !commit(result.state)) return;
        summaryReady = false; currentId = null; changed();
        if (stay) { pendingJoins.push(...entries); $('collect').hidden = $('collect-again').hidden = true; busy = false; start(5); return; }
        close(); joined(dedupe([...pendingJoins.splice(0), ...entries]));
      } catch (err) { notice(err.message); }
      finally { busy = false; render(); }
    }
    function restore() {
      if (!store.state.pending || !ready) return;
      open(); $('recruit-entry').hidden = true;
      // pending 保留 veil；沿用重開直接總覽，由 runtime 將卡面還原真實色階。
      makeRuntime(store.state.pending.draw).skip();
    }
    $('draw-one').onclick = $('recruit-one').onclick = () => start(1);
    $('draw-five').onclick = $('recruit-five').onclick = () => start(5);
    $('recruit-open').onclick = open; $('recruit-close').onclick = close;
    // ⚠ 不能寫 onclick = collect：DOM 會把事件物件當成第一個參數傳進去，stay 就變成 truthy
    $('collect').onclick = () => collect(false);
    $('collect-again').onclick = () => collect(true);
    $('skip').onclick = skip; $('reveal-all').onclick = () => runtime?.all();
    $('mode-select').onchange = () => {
      if (store.blocked || store.state.pending) { render(); return; }
      const s = E.settle(store.state, Date.now()).state; s.settings.mode = $('mode-select').value;
      commit(s); render();
    };
    return { render, open, close, restore, start, collect, get active() { return !layer.hidden; },
      setReady() { ready = true; render(); },
      suspend() {
        // 隱藏後不留 runtime 等待、卡面動畫或粒子；回來以 pending 重建靜態總覽。
        cleanup(); $('collect').hidden = $('skip').hidden = $('reveal-all').hidden = true;
      }, canHover: () => !document.hidden && !layer.hidden && summaryReady,
    };
  }
  return { create };
})();
