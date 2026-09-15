// 第十三輪 UI：換桌布（輪迴）面板、印記商店、電動手指購買、輪迴提示便條。
window.ClickerPrestigeUI = (() => {
  function create({ store, commit, changed, action, format, notice, sound, stage, album }) {
    const $ = id => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, P = window.ClickerPrestige;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let tab = 'prestige';
    function render() {
      const s = store.state, body = $('prestige-body'); body.replaceChildren();
      // 玩家回報（09-16）：「為什麼是 171/150」——上限與累計數字不上畫面，只留手上有幾顆
      $('prestige-summary').textContent = `手上印記 ${s.marks} 顆・換過 ${s.prestiges} 次`;
      const tabs = document.createElement('div'); tabs.className = 'prestige-tabs';
      for (const [id, name] of [['prestige', '換桌布'], ['marks', '神器與商店'], ['finger', '電動手指']]) {
        const b = document.createElement('button'); b.textContent = name; b.classList.toggle('active', tab === id); b.onclick = () => { tab = id; render(); }; tabs.append(b);
      }
      body.append(tabs);
      if (tab === 'prestige') renderPrestige(s, body); else if (tab === 'marks') renderMarks(s, body); else renderFinger(s, body);
    }
    function renderPrestige(s, body) {
      // v3 D 路（DESIGN-balance-v3 §十五）：印記＝本輪做到的事，不看幣；畫面要讓玩家看懂「這輪拿了幾枚、還能拿幾枚、下一輪會快多少」
      const why = P.canPrestige(s), wins = (s.runWins || []);
      // 實際入帳＝本輪做到的 與 上限剩餘 取小（prestige() 同一條）；以前鍵上寫「領 1 顆」、按下去 0 顆，玩家以為被吃掉
      const room = Math.max(0, B.MARKS_TOTAL_CAP - (s.marksClaimed || 0)), gained = Math.min(P.marksAvailable(s), room);
      const scenes = window.ClickerScenes, order = ['backyard','kitchen','market','factory','nightmarket','fridge','city'];
      // 包數的 +1 在印記重設計（09-15）已經拿掉，帳上不再列
      const ledger = order.map(id => `<li class="${wins.includes(id) ? 'done' : ''}">${scenes[id]?.boss?.name || id} <b>${wins.includes(id) ? (room <= 0 ? '已贏' : id === 'city' ? '+4' : '+1') : '—'}</b></li>`).join('');
      const capLine = room <= 0 ? '<p><b>印記已領滿</b>，換桌布不會再給印記。</p>' : `<p>這次換桌布可以領 <b>${gained}</b> 顆印記。</p>`;
      const halved = (s.bossWins || []).filter(id => id !== 'city').length;
      const note = document.createElement('div'); note.className = 'prestige-note';
      // 第八輪：末世也打得開這個面板——要講清楚重置的是 1.0，不然「清除錢幣、攻擊力」會被看成末世的（Codex 第八輪）
      const inApoc = document.body.dataset.world === 'apoc';
      note.innerHTML = `${inApoc ? '<p><b>這裡重置的是 1.0 桌邊的進度</b>；末世的金幣、訓練與關卡進度都保留。</p>' : ''}${capLine}
        <ul class="run-ledger">${ledger}</ul>
        <p class="prestige-faster">下一輪會更快：贏過的 ${halved} 站門檻減半，神器加成照算，夥伴、粉塵、卡片全部帶著走。</p>
        <div class="prestige-cols"><div><b>${inApoc ? '1.0 會清除' : '會清除'}</b><ul><li>錢幣、攻擊力、全隊訓練</li><li>電動手指、夥伴訓練</li><li>當輪包數，回到後院草地</li><li>王包裂痕、技能效果與冷卻</li></ul></div>
        <div><b>會保留</b><ul><li>夥伴、粉塵、升階、超越、編隊</li><li>保底與抽數、王的勝利紀錄</li><li>徽章、更衣室、桌面裝飾、派遣</li><li>印記、神器、商店</li></ul></div></div>
        <p>換桌布另送萬用粉塵 ${3 + (s.artifacts?.dust || 0)} 顆；本輪當家會重抽。</p>`;
      body.append(note);
      const row = document.createElement('div'); row.className = 'prestige-actions';
      const go = document.createElement('button'); go.id = 'prestige-go'; go.textContent = why || (gained ? `換桌布（領 ${gained} 顆印記）` : '換桌布'); go.disabled = !!why || store.blocked;
      go.onclick = () => { if (go.dataset.armed !== '1') { go.dataset.armed = '1'; go.textContent = `確定要重來嗎？再按一次`; return; } doPrestige(); };
      row.append(go); body.append(row);
    }
    function renderMarks(s, body) {
      // v3 D 路：七條神器線，第 r 級收 r 枚、各有頂（照 Sakura Clicker）
      const heading = document.createElement('h3'); heading.textContent = '神器（每級價＝下一級的等級）'; body.append(heading);
      const arts = document.createElement('div'); arts.className = 'mark-list artifacts';
      for (const a of B.ARTIFACTS) {
        const level = a.id === 'blessing' ? (s.blessing || 0) : (s.artifacts?.[a.id] || 0), full = level >= a.max, cost = level + 1;
        const t = document.createElement('button'); t.className = 'mark-ticket artifact'; t.dataset.item = a.id; t.classList.toggle('owned', full);
        t.innerHTML = `<img src="clicker-art-${a.id}.png" alt="" /><span><b>${a.name} Lv.${level} / ${a.max}</b><small>${a.per}</small><em class="art-pips">${Array.from({length:a.max},(_,i)=>`<i class="${i<level?'on':''}"></i>`).join('')}</em></span><i>${full ? '滿級' : `下一級 ${cost} 印記`}</i>`;
        t.disabled = full || s.marks < cost || store.blocked;
        t.onclick = () => action(() => { if (commit(P.buyArtifact(store.state, a.id, Date.now()))) { sound('upgrade'); changed(); notice(`${a.name} Lv.${level + 1}`); render(); } });
        arts.append(t);
      }
      body.append(arts);
      const permanent = document.createElement('h3'); permanent.textContent = '永久'; body.append(permanent);
      const list = document.createElement('div'); list.className = 'mark-list';
      for (const item of B.marks) {
        const owned = !!s.markShop?.[item.id];
        const t = document.createElement('button'); t.className = 'mark-ticket'; t.classList.toggle('owned', owned);
        t.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><span><b>${item.name}</b><small>${item.desc}</small></span><i>${owned ? '已擁有' : `${item.cost} 印記`}</i>`;
        t.disabled = owned || s.marks < item.cost || store.blocked;
        t.onclick = () => action(() => { if (commit(P.buyMark(store.state, item.id, Date.now()))) { sound('transcend'); changed(); notice(`印記商店：${item.name}`); render(); } });
        list.append(t);
      }
      body.append(list);
      // 印記換粉塵已停售（第十一輪使用者：「我希望印記商店的粉塵兌換也移除」）。
      // 理由同招募券：印記產出是 √生涯收入，開一條印記→粉塵的路等於可以把卡池買下來，
      // 而 2.0 的養成已經有自己的粉塵來源（重複卡、王首勝、無盡、派遣）。
      // 舊存檔的 dustTrades 仍留在存檔裡（clicker-save 的 marksClaimed 對帳要用），只是不能再換。
    }
    function renderFinger(s, body) {
      const L = s.autoClick || 0, price = P.autoClickCost(L);
      const note = document.createElement('div'); note.className = 'prestige-note';
      note.innerHTML = `<p><img src="clicker-ui-hanger.png" alt="" style="display:none" />電動手指 <b>Lv.${L}</b>／${B.autoClickCap(s)}：每秒自動點 <b>${(.5 * L).toFixed(1)}</b> 次（吃所有點擊倍率與次數型技能，不算手點）。累計自動點 ${format(s.autoClicks || 0)} 次。</p><p>下一級 ${L >= B.autoClickCap(s) ? '已滿級' : `${format(price)} 幣`}。換桌布會歸零。</p>`;
      body.append(note);
      const row = document.createElement('div'); row.className = 'prestige-actions';
      for (const [label, max] of [['升一級', false], ['最多', true]]) {
        const b = document.createElement('button'); b.textContent = label; b.disabled = L >= B.autoClickCap(s) || s.coins < price || store.blocked;
        b.onclick = () => action(() => { const r = P.buyAutoClick(store.state, Date.now(), max); if (commit(r.state)) { sound('upgrade'); changed(); notice(`電動手指 +${r.levels} 級`); render(); } });
        row.append(b);
      }
      body.append(row);
      // v3：路障小王第一次遇到要不要自動開打（輸過一次一律等玩家自己點挑戰）
      const auto = document.createElement('div'); auto.className = 'prestige-note';
      const on = s.settings.autoChallenge !== false;
      auto.innerHTML = `<p>路障小王：<b>${on ? '第一次遇到自動開打' : '一律等我點「挑戰」'}</b>。輸過一次之後都要自己點。</p>`;
      const toggle = document.createElement('button'); toggle.id = 'auto-challenge'; toggle.textContent = on ? '改成手動' : '改成自動';
      toggle.onclick = () => action(() => { const next = E.clone(store.state); next.settings.autoChallenge = !on; if (commit(next)) { changed(); render(); } });
      auto.append(toggle); body.append(auto);
    }
    function doPrestige() {
      action(() => {
        const r = P.prestige(store.state, Date.now());
        if (!commit(r.state)) return;
        close();
        // 在末世按換桌布：1.0 的進度照樣重來，但畫面停在末世——不捲 1.0 的桌布、不掛 1.0 的場景（會蓋進 2.0 畫面），只蓋印記章
        if (document.body.dataset.world === 'apoc') { sound('transcend'); changed(); finish(r.gained); return; }
        // 桌布捲起 → 黑一格 → 新桌布展開；印記數字「到站才跳」
        const table = $('game-content');
        sound('transcend');
        if (reduced.matches) { finish(r.gained); return; }
        table.style.transformOrigin = '50% 0';
        table.animate([{ transform: 'rotateX(0)', filter: 'brightness(1)' }, { transform: 'rotateX(-90deg)', filter: 'brightness(.6)' }], { duration: 600, easing: 'cubic-bezier(.3,0,.8,.15)', fill: 'forwards' }).finished.then(() => {
          $('game').animate([{ backgroundColor: '#160c08' }, { backgroundColor: '#160c08' }], { duration: 80 }).finished.then(() => {
            window.ClickerScene.mount(store.state.settings.scene, store.state.package.index);
            changed();
            table.getAnimations().forEach(a => a.cancel());
            table.animate([{ transform: 'rotateX(90deg)', filter: 'brightness(.6)' }, { transform: 'rotateX(0)', filter: 'brightness(1)' }], { duration: 600, easing: 'cubic-bezier(.05,.7,.1,1)' }).finished.then(() => { table.style.transformOrigin = ''; finish(r.gained); }).catch(() => finish(r.gained));
          }).catch(() => finish(r.gained));
        }).catch(() => finish(r.gained));
      });
    }
    function finish(gained) {
      stage?.confetti?.();
      const stamp = document.createElement('div'); stamp.className = 'mark-stamp'; stamp.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><b>${gained ? `印記 +${gained}` : '換好桌布了'}</b>`;
      $('game').append(stamp);
      stamp.animate([{ transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.17,.89,.32,1.28)' }).finished.then(() => setTimeout(() => stamp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => stamp.remove()).catch(() => stamp.remove()), 1400)).catch(() => stamp.remove());
      notice(`換了新桌布，永久倍率 ×${E.markMul(store.state).toFixed(2)}`);
    }
    function open(initial = 'prestige') { tab = initial; $('prestige').hidden = false; $('game-content').inert = true; render(); $('prestige-close').focus(); }
    function close() { $('prestige').hidden = true; $('game-content').inert = false; }
    // 「桌子有點滿了」便條：一天一次，點了就開面板
    function hint() {
      if ($('prestige-hint') || document.body.dataset.world === 'apoc') return;   // 便條掛在共用舞台上，末世不要冒出 1.0 的換桌布提示
      const el = document.createElement('button'); el.id = 'prestige-hint'; el.textContent = '桌子有點滿了，要不要換桌布？'; el.onclick = () => { el.remove(); open(); };
      $('stage').append(el); commit();
      setTimeout(() => el.remove(), 20000);
    }
    // 2.0 的導線：末世的第四技能格／派遣位都是在這裡買的，但 2.0 玩家想不到要先進「換桌布」。
    // 技能格與末世商店直接呼叫這一顆，開在「神器與商店」分頁（任務書 A4）。
    function openMarks() { open('marks'); }
    return { open, openMarks, close, render, hint };
  }
  return { create };
})();
