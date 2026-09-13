window.ClickerGacha = (() => {
  // 直式手機的演出座標系。橫式是 960×640（招募層本身就是那個大小），直式的招募層是整個畫面
  // （390×844 之類），960 的座標會有四張卡直接掉在畫面外——跟切入演出踩過的是同一個坑。
  // 改成一套 560×900 的直box，等比縮到畫面寬並置中；pad 是上下各留給頂欄與收下鍵的空間。
  const PORTRAIT_BOX = { w: 560, h: 900, pad: 76 };
  const portrait = () => matchMedia('(max-aspect-ratio: 3/4)').matches;
  function create({ store, card, commit, changed, pauseStage, resumeStage, joined, notice, format, canOpen = () => true }) {
    const $ = (id) => document.getElementById(id), E = window.ClickerEconomy;
    let runtime = null, mode = null, state = 'idle', ready = false;
    let currentId = null, summaryReady = false, busy = false, previousFocus = null;
    let fastForwarding = false;   // 快轉中；再按一次略過鍵就是硬略過（每次重建 runtime 都要重置）
    // 連抽時每一輪收下的夥伴先存著，等真的離開招募畫面再一次播入隊演出——
    // 演出是在舞台上跑的，招募層蓋著的時候播等於白播。
    let pendingJoins = [];
    // 連抽好幾輪才一起播入隊演出時，同一個角色可能在不同輪都被抽到。
    // stage.join() 是「一個角色一個目標圓鈕」的，同一個 id 出現兩次時第二次會查不到目標
    //（它是照分頁分批的，第二次查的時候頁面已經翻到別批了）→ getBoundingClientRect of null。
    const dedupe = (list) => { const seen = new Set(); return list.filter(e => !seen.has(e.id) && seen.add(e.id)); };
    const layer = $('recruit-layer');
    let pendingSummaryJoins = null;   // 結算卡按「繼續」之前，先收著這一抽要播入隊的夥伴
    // 兩個主系統共用這一層：差別只有「錢是什麼」「卡池是什麼」「落帳寫到哪」。
    const A = () => window.ApocEconomy;
    const apoc = () => store.state?.settings.world === 'apoc';
    const W = () => apoc() ? {
      pending: () => store.state.apoc?.pending || null,
      cost: (n) => Math.max(0, n),                        // 末世：一張卡一張券
      wallet: () => A().normalize(store.state.apoc).tickets,
      unit: '券',
      label: (n) => `${n === 1 ? '單抽' : '十連'} · ${n} 券`,
      counts: [1, 10],
      purchase: (n, now) => { const next = E.clone(store.state); next.apoc = A().purchaseDraw(A().normalize(next.apoc), n, now); return next; },
      collect: (id, now) => { const next = E.clone(store.state); const r = A().collectDraw(A().normalize(next.apoc), id, now); next.apoc = r.state; return { state: next, accepted: r.accepted, newIds: r.newIds, starUps: r.starUps }; },
      blocked: () => false,
    } : {
      pending: () => store.state?.pending || null,
      cost: (n) => E.drawCost(store.state, Math.max(0, n - (store.state.freeDraws || 0))),
      wallet: () => store.state.coins,
      unit: '幣',
      label: (n) => `${n === 1 ? '單抽' : '五連'} · ${format(E.drawCost(store.state, Math.max(0, n - (store.state.freeDraws || 0))))}`,
      counts: [1, 5],
      purchase: (n, now) => E.purchaseDraw(store.state, n, now, window.GachaPool),
      collect: (id, now) => E.collect(store.state, id, now),
      blocked: () => !!(store.state.boss && store.state.boss.gate === undefined),
    };
    const packSize = () => apoc() ? 10 : 5;
    function priceButton(el, count, s, supported) {
      const w = W(), cost = w.cost(count), missing = Math.max(0, Math.ceil(cost - w.wallet()));
      const many = packSize();
      el.replaceChildren();
      el.textContent = el.id === 'draw-one' ? '招募！' : el.id === 'draw-five' ? (apoc() ? '十連' : '五連') : w.label(count);
      el.title = String(cost);
      if (el.id === 'draw-five') { const price = document.createElement('span'); price.className = 'draw-five-price';
        price.textContent = apoc() ? `${many} 券` : (s.freeDraws ? `免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}` : format(cost)); el.append(price); }
      if (!apoc() && s.freeDraws && el.id.startsWith('recruit-')) el.textContent=`${count===1?'單抽':'五連'} · 免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}`;
      if (missing) { const note = document.createElement('small'); note.textContent = `還差 ${format(missing)} ${w.unit}`; el.append(note); }
      el.disabled = !ready || !canOpen() || store.blocked || w.blocked() || !!w.pending() || !supported || missing > 0 || busy;
    }
    function render() {
      const s = store.state; if (!s) return;
      const w = W(), many = packSize();
      if (!apoc()) { $('draw-price').textContent = s.freeDraws ? `免費 ×${s.freeDraws}` : format(E.drawCost(s, 1)); $('draw-ticket').title = String(E.drawCost(s, Math.max(0,1-s.freeDraws))); }
      const supported = window.GachaModes[s.settings.mode].counts.includes(1);
      const note = supported ? '' : `此演出只支援${apoc() ? '十' : '五'}連；單抽請選流星或拆包桌面。`;
      for (const id of ['draw-one', 'recruit-one']) priceButton($(id), 1, s, supported);
      for (const id of ['draw-five', 'recruit-five']) priceButton($(id), many, s, true);
      for (const id of ['pity', 'recruit-pity']) $(id).textContent = apoc()
        ? `神話 0.25%・傳說 4%・史詩 20%` : `最多再 ${40 - s.pity.sinceLegendary} 抽必得傳說`;
      $('single-note').textContent = supported ? '' : '此模式限多連；單抽請切換演出。'; $('recruit-note').textContent = note;
      $('mode-select').value = s.settings.mode; $('mode-select').disabled = !!w.pending() || store.blocked;
      $('recruit-close').disabled = !!w.pending();
      $('collect').disabled = store.blocked || busy;
      $('recruit-mute').textContent = s.settings.muted ? '音效關' : '音效開';
    }
    function open() {
      if (!store.state || !ready || W().blocked() || (!apoc() && !canOpen())) return;   // v3：路障小王不鎖招募（重開時也要進得來收下 pending）
      previousFocus = document.activeElement; layer.hidden = false; $('game-content').inert = true;
      pauseStage(); window.GachaFx.init($('fx'), $('fx-under')); $('mode-select').focus(); render();
    }
    function cleanup() {
      mode?.dispose(); mode = null; runtime?.stop(); runtime = null;
      fastForwarding = false; $('skip').textContent = '略過演出';
      card.liveEnd(); $('cards').replaceChildren(); $('mode-root').replaceChildren();
      $('flash').classList.remove('on'); layer.classList.remove('charging-mode');
    }
    function close() {
      if (W().pending()) return;
      cleanup(); layer.hidden = true; $('game-content').inert = false; $('recruit-entry').hidden = false;
      $('collect').hidden = $('collect-again').hidden = $('skip').hidden = $('reveal-all').hidden = true;
      // 結算卡與它的待播入隊也要一起收掉，不然下次打開招募會帶著上一次的結算（Codex 複檢 1-5）
      $('draw-summary').hidden = true;
      if (pendingSummaryJoins) { pendingJoins.push(...pendingSummaryJoins); pendingSummaryJoins = null; }
      resumeStage(); previousFocus?.focus();
      if (pendingJoins.length) { const all = pendingJoins; pendingJoins = []; joined(dedupe(all)); }
    }
    function summary() {
      summaryReady = true; $('collect').hidden = false; $('skip').hidden = $('reveal-all').hidden = true;
      // 錢是抽的當下就扣掉的，所以現在的 state 拿來算「還抽不抽得起下一次」是準的
      const s = store.state, again = $('collect-again'), w = W(), many = packSize();
      const cost = w.cost(many);
      const affordable = cost <= w.wallet() && window.GachaModes[s.settings.mode].counts.includes(apoc() ? 5 : many);
      again.hidden = !affordable;
      again.textContent = apoc() ? `收下並繼續十連 · ${many} 券`
        : (s.freeDraws ? `收下並繼續五連 · 免費 ×${Math.min(many, s.freeDraws)}` : `收下並繼續五連 · ${format(cost)}`);
      $('recruit-hint').textContent = affordable
        ? '結果已儲存。收下後夥伴就會開始幫忙，或直接再抽一次。'
        : '結果已儲存，收下後夥伴就會開始幫忙。';
      $('collect').focus(); render();
    }
    function makeRuntime(draw) {
      cleanup(); currentId = draw.id; summaryReady = false;
      const name = store.state.settings.mode;
      // 演出的座標系跟著版面走：橫式 960×640；直式改一套 560×900 的直box（見 PORTRAIT_BOX），
      // 五連在直式排成 2+3 兩排。⚠ 特效畫布的 width/height 是「屬性」，GachaFx.init 只在
      // 這裡讀一次（gacha-fx.js 的 W=el.width），所以一定要在 init 之前改。
      const P = portrait(), box = P ? { width: PORTRAIT_BOX.w, height: PORTRAIT_BOX.h } : { width: 960, height: 640 };
      const mid = { x: box.width / 2, y: box.height / 2 };
      for (const c of [$('fx'), $('fx-under')]) { c.width = box.width; c.height = box.height; }
      window.GachaFx.init($('fx'), $('fx-under'));
      $('mode-root').className = `mode-root mode-${name}`;
      runtime = window.GachaModeRuntime.create({
        root: $('mode-root'), size: box, center: mid,
        cardsEl: $('cards'), dim: $('dim'), card, mode: name,
        layout(i, count) {
          if (count === 1) return { x: mid.x, y: mid.y, rot: 0 };
          // 末世是十連：五張一排、兩排，整體縮到 .76 才塞得下（原本只寫了 1 與 5，
          // 第 6～10 張會直接排到畫面外——跟直式那次踩的是同一個坑）
          if (count > 5) {
            const per = P ? 2 : 5, col = i % per, row = Math.floor(i / per), rows = Math.ceil(count / per);
            const gapX = P ? 176 : 172, gapY = P ? 150 : 218, scale = P ? .62 : .76;
            const n = col - (per - 1) / 2;
            return { x: mid.x + n * gapX * scale * (P ? 1 : 1.28), y: mid.y + (row - (rows - 1) / 2) * gapY * scale,
                     rot: n * 2, scale };
          }
          if (P) {
            // 直式 2+3：上排兩張（i=0,1）、下排三張（i=2,3,4）。
            // 卡片 150 寬、半寬 75：下排最外側中心 ±172 → 邊緣落在 33／527，560 的框裡放得下。
            const top = i < 2, n = top ? i - .5 : i - 3;
            return { x: mid.x + n * (top ? 176 : 172), y: top ? 330 : 580, rot: n * (top ? 8 : 5) };
          }
          const n = i - 2;
          return { x: 480 + n * 168, y: 320 + Math.abs(n) ** 2 * 6.5, rot: n * 4 };
        },
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
      if (!runtime || !W().pending()) return;
      mode?.skip(); runtime.skip();
    }
    // 「快轉」：掃過去，但沒抽過的卡會停下來把翻牌演出播完。
    // 作法是照 restore() 那條路重建一個乾淨的 runtime 再快轉——
    // 這樣五種演出模式（含 rip／stage 那兩個自己跑時間軸的）行為一致，
    // 也不必去拆各家模式的 skip 語意：按下快轉的當下，那一套劇場本來就結束了。
    function fastForward() {
      if (!runtime || !W().pending() || fastForwarding) return;
      const run = makeRuntime(W().pending().draw);
      // ⚠ 順序：makeRuntime() 內部會跑 cleanup()，而 cleanup() 會把旗標與按鈕字樣重置，
      //   所以這兩行一定要排在它後面，不然按下去馬上又變回「略過演出」。
      fastForwarding = true;
      $('reveal-all').hidden = true;
      $('skip').textContent = '全部略過';          // 逃生口：再按一次就是真的全部略過
      run.run(run.fastForward((item) => {
        // 停在這張是有原因的，要講出來，否則玩家以為快轉壞掉
        $('recruit-hint').textContent = `新夥伴・${item.entry.name}`;
      }));
    }
    // 回傳這一輪有沒有真的開演——「收下並繼續五連」靠它判斷要不要把總覽畫面收回來
    function start(count) {
      const s = store.state, w = W();
      const modeCounts = window.GachaModes[s.settings.mode].counts;
      const ok = count === 1 ? modeCounts.includes(1) : modeCounts.includes(apoc() ? 5 : count);   // 末世十連借五連的演出排版
      if (!ready || (!apoc() && !canOpen()) || busy || store.blocked || w.blocked() || w.pending() || !ok) return false;
      busy = true;
      try {
        const next = w.purchase(count, Date.now());
        // 唯一寫入包含扣款、抽數、保底及 pending。成功以前沒有演出。
        if (!commit(next)) return false;
        const ticket = $('draw-ticket'); ticket.getAnimations().forEach(a=>a.cancel());
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ticket.animate([{transform:'scale(1)'},{transform:'scale(.96)',offset:.5},{transform:'scale(1)'}],{duration:140});
        open(); $('recruit-entry').hidden = true; $('collect').hidden = true; $('skip').hidden = false;
        $('recruit-hint').textContent = ''; const run = makeRuntime(W().pending().draw);
        if (s.settings.mode === 'hearthstone') {
          const pack = document.createElement('div'); pack.className = 'pack'; $('mode-root').append(pack);
        }
        mode = window.GachaModes[s.settings.mode].create(run.ctx);
        run.run(mode.open(W().pending().draw));
        return true;
      } catch (err) { notice(err.message); return false; }
      finally { busy = false; changed(); render(); }
    }
    function collect(stay = false) {
      if (!summaryReady || busy || store.blocked) return;
      busy = true;
      try {
        // 起飛點要換算成 #join-flight 自己的座標系（入隊演出就畫在那一層）。
        // ⚠ 不能寫死 /960：橫式時 #join-flight 確實是 960 寬，直式它蓋滿畫面、座標就是畫面像素。
        // clicker-stage.js 的 join() 用同一套映射算落點，兩邊一致才不會飛歪。
        const jf = $('join-flight'), jr = jf.getBoundingClientRect();
        const zoom = jf.clientWidth ? jr.width / jf.clientWidth : 1, cards = [...$('cards').children];
        const entries = W().pending().draw.entries.map((item,i) => {
          const r = cards[i]?.getBoundingClientRect();
          return {id:item.entry.id, origin:r ? {x:(r.left+r.width/2-jr.left)/zoom,y:(r.top+r.height/2-jr.top)/zoom}
                                             : {x:jf.clientWidth/2,y:jf.clientHeight/2}};
        });
        const result = W().collect(currentId, Date.now());
        if (!result.accepted || !commit(result.state)) return;
        summaryReady = false; currentId = null; changed();
        if (!stay) { const done = showDrawSummary(result, entries); if (done) return; }   // 先講清楚得到什麼，再關
        if (stay) {
          pendingJoins.push(...entries); $('collect').hidden = $('collect-again').hidden = true; busy = false;
          // 下一輪起不來（存檔鎖住、冒出大王⋯⋯）就正常收尾，不然會停在一個沒有任何按鈕的死畫面
          if (!start(packSize())) { close(); joined(dedupe([...pendingJoins.splice(0)])); }
          return;
        }
        close(); joined(dedupe([...pendingJoins.splice(0), ...entries]));
      } catch (err) { notice(err.message); }
      finally { busy = false; render(); }
    }
    // 抽卡結算（使用者 2026-09-13：「幫我思考抽到時結算的提示」）。
    // 沒有任何值得講的事（全是重複又沒升星）就不擋路，直接關。
    function showDrawSummary(result, entries) {
      const map = apoc() ? Object.fromEntries((window.ApocPool || []).map(c => [c.id, c])) : window.GachaPool.byId;
      const name = id => map[id]?.name || id;
      const lines = [];
      if (result.newIds?.length) lines.push({ tag: '新夥伴', faces: result.newIds });
      // 同一隻連升好幾級要併成一行：「采華 精良→史詩、采華 史詩→傳說」讀起來像壞掉
      const isNew = new Set(result.newIds || []);
      const stars = (result.starUps || []).filter(u => u.to > u.from && !isNew.has(u.id));
      if (stars.length) lines.push({ tag: '升星', text: stars.map(u => `${name(u.id)} ★${u.from}→★${u.to}`).join('、') });
      const RAR = { rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' };
      const promotes = new Map();
      for (const g of (result.grows || []).filter(g => g.kind === 'promote')) {
        const cur = promotes.get(g.id); promotes.set(g.id, { from: cur ? cur.from : g.from, to: g.to });
      }
      if (promotes.size) lines.push({ tag: '自動升階', text: [...promotes].map(([id, g]) => `${name(id)} ${RAR[g.from]}→${RAR[g.to]}`).join('、') });
      const trans = new Map();
      for (const g of (result.grows || []).filter(g => g.kind === 'transcend')) trans.set(g.id, g);
      if (trans.size) lines.push({ tag: '自動超越', text: [...trans].map(([id, g]) => `${name(id)} 超越 ${g.to}${g.awakened ? '・覺醒！' : ''}`).join('、') });
      if (result.universalDust) lines.push({ tag: '萬用粉塵', text: `＋${format(result.universalDust)}（滿養溢出）` });
      if (!lines.length) return false;
      const body = $('draw-summary-body'); body.replaceChildren();
      for (const line of lines) {
        const row = document.createElement('div'); row.className = 'draw-line';
        const b = document.createElement('b'); b.textContent = line.tag; row.append(b);
        if (line.faces) {
          const wrap = document.createElement('div'); wrap.className = 'draw-faces';
          for (const id of line.faces) {
            const fig = document.createElement('figure'); fig.append(card.art.create(map[id]));
            const cap = document.createElement('figcaption'); cap.textContent = name(id); fig.append(cap); wrap.append(fig);
          }
          row.append(wrap);
        } else { const t = document.createElement('span'); t.textContent = line.text; row.append(t); }
        body.append(row);
      }
      pendingSummaryJoins = entries;
      $('collect').hidden = $('collect-again').hidden = true; $('recruit-hint').textContent = '';
      $('draw-summary').hidden = false; $('draw-summary-ok').focus();
      return true;
    }
    $('draw-summary-ok').onclick = () => {
      $('draw-summary').hidden = true;
      const entries = pendingSummaryJoins || []; pendingSummaryJoins = null;
      close(); joined(dedupe([...pendingJoins.splice(0), ...entries]));
    };
    function restore() {
      if (!W().pending() || !ready) return;
      open(); $('recruit-entry').hidden = true;
      // pending 保留 veil；沿用重開直接總覽，由 runtime 將卡面還原真實色階。
      makeRuntime(W().pending().draw).skip();
    }
    $('draw-one').onclick = $('recruit-one').onclick = () => start(1);
    $('draw-five').onclick = $('recruit-five').onclick = () => start(packSize());
    $('recruit-open').onclick = open; $('recruit-close').onclick = close;
    // ⚠ 不能寫 onclick = collect：DOM 會把事件物件當成第一個參數傳進去，stay 就變成 truthy
    $('collect').onclick = () => collect(false);
    $('collect-again').onclick = () => collect(true);
    // 第一下＝快轉（新卡會停），第二下＝真的全部略過
    $('skip').onclick = () => (fastForwarding ? skip() : fastForward());
    $('reveal-all').onclick = () => runtime?.all();
    $('mode-select').onchange = () => {
      if (store.blocked || W().pending()) { render(); return; }
      // 末世不要順手跑桌邊結算（Codex 第三輪 B4）：演出是共用設定，但結算不是
      const s = apoc() ? E.clone(store.state) : E.settle(store.state, Date.now()).state;
      s.settings.mode = $('mode-select').value;
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
  return { create, PORTRAIT_BOX, portrait };
})();
