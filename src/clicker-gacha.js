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
    // 兩個主系統共用這一層：差別只有「錢是什麼」「卡池是什麼」「落帳寫到哪」。
    const A = () => window.ApocEconomy;
    const apoc = () => store.state?.settings.world === 'apoc';
    const W = () => apoc() ? {
      pending: () => store.state.apoc?.pending || null,
      // 末世：先用券（只從桌邊金幣換來），不夠的才付末世金幣——同 1.0「免費抽先用、剩下付錢」
      cost: (n) => A().drawCost(A().normalize(store.state.apoc), n),
      wallet: () => A().normalize(store.state.apoc).coins,
      unit: '末世金幣',
      label: (n) => apocPrice(n, `${n === 1 ? '單抽' : '十連'} · `),
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
    // 末世的抽卡演出＝精裝典藏包（使用者指定）。演出頁只播放；扣券在 start()、落帳在 collectApoc()。
    const ceremony = (() => {
      const host = $('apoc-ceremony'), frame = $('apoc-ceremony-frame');
      let loaded = null;
      const load = () => loaded ||= new Promise(resolve => {
        const onReady = (e) => { if (e.source === frame.contentWindow && e.data?.apocCeremony === 'ready') { removeEventListener('message', onReady); resolve(); } };
        addEventListener('message', onReady); frame.src = 'apoc/ceremony.html';
      });
      addEventListener('message', (e) => {
        // 只認自己的 iframe；演出頁自己的收合動畫是 220ms，等它跑完再關
        if (e.source === frame.contentWindow && e.data?.apocCeremony === 'collect') setTimeout(collectApoc, 240);
      });
      return {
        async play(ids, restore = false, badges = []) {
          previousFocus = document.activeElement; host.hidden = false; $('game-content').inert = true; pauseStage();
          await load(); const api = frame.contentWindow.ApocCeremony;
          if (restore) api.restore(ids, badges); else api.play(ids, badges);
          frame.focus();
        },
        hide() { host.hidden = true; },
        // 典藏包按「收下」就自己清場了；主頁落帳不成時用它把同一批結果放回結果頁
        replay(ids) { frame.contentWindow?.ApocCeremony?.restore(ids, drawBadges().badges); },
        get active() { return !host.hidden; },
      };
    })();
    function collectApoc() {
      const p = W().pending(); if (!p) { ceremony.hide(); return; }
      const ids = p.draw.entries.map(it => it.entry.id);
      // 落帳不成（存檔鎖住、寫入失敗）一定要把結果頁放回去：典藏包已經清場，
      // 不放回去玩家就停在沒有任何按鈕的黑畫面，只能重新整理（Codex 複檢 B1）
      if (busy) { ceremony.replay(ids); return; }
      // 上一次寫入失敗後存檔會鎖住，而「重試儲存」鍵在被典藏包蓋住的主頁上按不到——收下時自己先重試一次
      if (store.blocked && !commit()) { ceremony.replay(ids); notice('存檔仍然失敗，結果已保留，再按一次收下'); return; }
      busy = true;
      try {
        const result = W().collect(p.draw.id, Date.now());
        if (!result.accepted || !commit(result.state)) { ceremony.replay(ids); notice('存檔失敗，結果已保留，再按一次收下'); return; }
        ceremony.hide(); changed();
        const jf = $('join-flight');
        const entries = p.draw.entries.map(it => ({ id: it.entry.id, origin: { x: jf.clientWidth / 2, y: jf.clientHeight / 2 } }));
        // 「新夥伴／升星」已經標在典藏包的結果卡上（使用者第四輪：不要另外跳「收下了！」視窗），收下就直接回遊戲
        open(); $('recruit-entry').hidden = true; pendingJoins.push(...entries); close();
      } catch (err) { notice(err.message); }
      finally { busy = false; render(); }
    }
    // 末世的價牌：先用券（只從桌邊金幣換來），剩下的付末世金幣——寫法同 1.0 的「免費 ×n + 價格」
    function apocPrice(n, prefix = '') {
      const a = A().normalize(store.state.apoc), free = Math.min(a.tickets || 0, n), cost = A().drawCost(a, n);
      return prefix + (free ? `券 ×${free}${cost ? ` + ${format(cost)}` : ''}` : format(cost));
    }
    function priceButton(el, count, s, supported) {
      const w = W(), cost = w.cost(count), missing = Math.max(0, Math.ceil(cost - w.wallet()));
      el.replaceChildren();
      el.textContent = el.id === 'draw-one' ? '招募！' : el.id === 'draw-five' ? (apoc() ? '十連' : '五連') : w.label(count);
      el.title = String(cost);
      if (el.id === 'draw-five') { const price = document.createElement('span'); price.className = 'draw-five-price';
        price.textContent = apoc() ? apocPrice(count) : (s.freeDraws ? `免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}` : format(cost)); el.append(price); }
      if (!apoc() && s.freeDraws && el.id.startsWith('recruit-')) el.textContent=`${count===1?'單抽':'五連'} · 免費 ×${Math.min(count,s.freeDraws)}${cost ? ` + ${format(cost)}` : ''}`;
      if (missing) { const note = document.createElement('small'); note.textContent = `還差 ${format(missing)} ${w.unit}`; el.append(note); }
      el.disabled = !ready || !canOpen() || store.blocked || w.blocked() || !!w.pending() || !supported || missing > 0 || busy;
    }
    function render() {
      const s = store.state; if (!s) return;
      const w = W(), many = packSize();
      if (!apoc()) { $('draw-price').textContent = s.freeDraws ? `免費 ×${s.freeDraws}` : format(E.drawCost(s, 1)); $('draw-ticket').title = String(E.drawCost(s, Math.max(0,1-s.freeDraws))); }
      const supported = apoc() || window.GachaModes[s.settings.mode].counts.includes(1);   // 末世固定是典藏包，單抽十連都有（Codex 複檢 B2）
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
      resumeStage(); previousFocus?.focus();
      if (pendingJoins.length) { const all = pendingJoins; pendingJoins = []; joined(dedupe(all)); }
    }
    function summary() {
      summaryReady = true; $('collect').hidden = false; $('skip').hidden = $('reveal-all').hidden = true;
      // 結果卡上直接標「新夥伴／升星／升階／超越」（使用者第四輪：兩個世界都是，不另外跳視窗）。卡的順序＝抽到的順序
      const { badges, dust } = drawBadges();
      [...$('cards').children].forEach((el, i) => { el.querySelectorAll('.draw-badges').forEach(x => x.remove()); if (badges[i]?.length) el.append(badgeNode(badges[i])); });
      // 錢是抽的當下就扣掉的，所以現在的 state 拿來算「還抽不抽得起下一次」是準的
      const s = store.state, again = $('collect-again'), w = W(), many = packSize();
      const cost = w.cost(many);
      const affordable = cost <= w.wallet() && window.GachaModes[s.settings.mode].counts.includes(apoc() ? 5 : many);
      again.hidden = !affordable;
      again.textContent = apoc() ? apocPrice(many, '收下並繼續十連 · ')
        : (s.freeDraws ? `收下並繼續五連 · 免費 ×${Math.min(many, s.freeDraws)}` : `收下並繼續五連 · ${format(cost)}`);
      $('recruit-hint').textContent = (affordable
        ? '結果已儲存。收下後夥伴就會開始幫忙，或直接再抽一次。'
        : '結果已儲存，收下後夥伴就會開始幫忙。') + (dust ? `　滿養溢出：萬用粉塵 ＋${format(dust)}` : '');
      $('collect').focus(); render();
    }
    // 收下之前，用同一份 pending 試算一次收下的結果（純函式、不提交），照抽到的順序對到每一張卡
    function drawBadges() {
      const none = { badges: [], dust: 0 }, p = W().pending(); if (!p) return none;
      let r; try { r = W().collect(p.draw.id, Date.now()); } catch { return none; }
      if (!r?.accepted) return none;
      const ids = p.draw.entries.map(it => it.entry.id), badges = ids.map(() => []);
      const put = (i, b) => { if (i >= 0) badges[i].push(b); };
      const RAR = { rare: '精良', epic: '史詩', legendary: '傳說', mythic: '神話' };
      const isNew = new Set(r.newIds || []);
      for (const id of isNew) put(ids.indexOf(id), { kind: 'new', text: '新夥伴' });
      // 升星標在同一隻的最後一張（那張收下時才升上去）；新夥伴自己不另外標升星
      for (const u of r.starUps || []) if (u.to > u.from && !isNew.has(u.id)) put(ids.lastIndexOf(u.id), { kind: 'star', text: `★${u.from}→★${u.to}` });
      // 同一隻連升好幾階併成一個（「采華 精良→史詩、史詩→傳說」讀起來像壞掉）
      const grows = new Map();
      for (const g of r.grows || []) { const key = `${g.kind}:${g.id}`, cur = grows.get(key); grows.set(key, { ...g, from: cur ? cur.from : g.from }); }
      for (const g of grows.values()) put(ids.lastIndexOf(g.id), g.kind === 'promote'
        ? { kind: 'promote', text: `升階 ${RAR[g.to] || ''}` } : { kind: 'transcend', text: `超越 ${g.to}${g.awakened ? '・覺醒' : ''}` });
      return { badges, dust: r.universalDust || 0 };
    }
    function badgeNode(list) {
      const box = document.createElement('div'); box.className = 'draw-badges';
      for (const b of list) { const tag = document.createElement('b'); tag.className = `draw-badge ${b.kind}`; tag.textContent = b.text; box.append(tag); }
      return box;
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
      const ok = apoc() || (count === 1 ? modeCounts.includes(1) : modeCounts.includes(count));   // 典藏包本來就有單抽／五連／十連
      if (!ready || (!apoc() && !canOpen()) || busy || store.blocked || w.blocked() || w.pending() || !ok) return false;
      busy = true;
      try {
        const next = w.purchase(count, Date.now());
        // 唯一寫入包含扣款、抽數、保底及 pending。成功以前沒有演出。
        if (!commit(next)) return false;
        const ticket = $('draw-ticket'); ticket.getAnimations().forEach(a=>a.cancel());
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) ticket.animate([{transform:'scale(1)'},{transform:'scale(.96)',offset:.5},{transform:'scale(1)'}],{duration:140});
        if (apoc()) { ceremony.play(W().pending().draw.entries.map(it => it.entry.id), false, drawBadges().badges); return true; }
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
        if (stay) {
          pendingJoins.push(...entries); $('collect').hidden = $('collect-again').hidden = true; busy = false;
          // 下一輪起不來（存檔鎖住、冒出大王⋯⋯）就正常收尾，不然會停在一個沒有任何按鈕的死畫面
          if (!start(packSize())) close();   // close() 會把累積的入隊去重後播一次
          return;
        }
        // 本包先併進累積的入隊，統一由 close() 去重播一次——分兩次叫 joined() 會讓連抽抽到的同一隻飛兩次（Codex 第四輪）
        pendingJoins.push(...entries); close();
      } catch (err) { notice(err.message); }
      finally { busy = false; render(); }
    }
    function restore() {
      if (!W().pending() || !ready) return;
      if (apoc()) { if (!ceremony.active) ceremony.play(W().pending().draw.entries.map(it => it.entry.id), true, drawBadges().badges); return; }
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
    return { render, open, close, restore, start, collect, get active() { return !layer.hidden || ceremony.active; },
      setReady() { ready = true; render(); },
      suspend() {
        // 隱藏後不留 runtime 等待、卡面動畫或粒子；回來以 pending 重建靜態總覽。
        cleanup(); $('collect').hidden = $('skip').hidden = $('reveal-all').hidden = true;
      }, canHover: () => !document.hidden && !layer.hidden && summaryReady,
    };
  }
  return { create, PORTRAIT_BOX, portrait };
})();
