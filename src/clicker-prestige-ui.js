// 第十三輪 UI：換桌布（輪迴）面板、印記商店、電動手指購買、輪迴提示便條。
window.ClickerPrestigeUI = (() => {
  function create({ store, commit, changed, action, format, notice, sound, stage, album }) {
    const $ = id => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, P = window.ClickerPrestige;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let tab = 'prestige';
    function render() {
      const s = store.state, body = $('prestige-body'); body.replaceChildren();
      $('prestige-summary').textContent = `印記 ${s.marks}（累計 ${s.marksClaimed} / ${B.MARKS_TOTAL_CAP}）・本輪已拿 ${P.marksTotal(s)} / ${B.V3.MARKS_PER_RUN}・已換 ${s.prestiges} 次`;
      const tabs = document.createElement('div'); tabs.className = 'prestige-tabs';
      for (const [id, name] of [['prestige', '換桌布'], ['marks', '神器與商店'], ['finger', '電動手指']]) {
        const b = document.createElement('button'); b.textContent = name; b.classList.toggle('active', tab === id); b.onclick = () => { tab = id; render(); }; tabs.append(b);
      }
      body.append(tabs);
      if (tab === 'prestige') renderPrestige(s, body); else if (tab === 'marks') renderMarks(s, body); else renderFinger(s, body);
    }
    function renderPrestige(s, body) {
      // v3 D 路（DESIGN-balance-v3 §十五）：印記＝本輪做到的事，不看幣；畫面要讓玩家看懂「這輪拿了幾枚、還能拿幾枚、下一輪會快多少」
      const why = P.canPrestige(s), gained = P.marksAvailable(s), wins = (s.runWins || []), packs = s.runPacks || 0;
      const scenes = window.ClickerScenes, order = ['backyard','kitchen','market','factory','nightmarket','fridge','city'];
      const ledger = order.map(id => `<li class="${wins.includes(id) ? 'done' : ''}">${scenes[id]?.boss?.name || id} <b>${wins.includes(id) ? (id === 'city' ? '+4' : '+1') : '—'}</b></li>`).join('')
        + `<li class="${packs >= 100 ? 'done' : ''}">本輪拆滿 100 包（${Math.min(packs,100)}/100）<b>${packs >= 100 ? '+1' : '—'}</b></li><li class="${packs >= 300 ? 'done' : ''}">本輪拆滿 300 包（${Math.min(packs,300)}/300）<b>${packs >= 300 ? '+1' : '—'}</b></li>`;
      const halved = (s.bossWins || []).filter(id => id !== 'city').length;
      const note = document.createElement('div'); note.className = 'prestige-note';
      note.innerHTML = `<p>本輪可領印記 <b>${gained}</b> / ${B.V3.MARKS_PER_RUN} 顆（累計上限 ${B.MARKS_TOTAL_CAP}，已領 ${s.marksClaimed}）。</p>
        <ul class="run-ledger">${ledger}</ul>
        <p class="prestige-faster">下一輪會更快：贏過的 ${halved} 站門檻減半，神器加成照算，夥伴、粉塵、卡片全部帶著走。</p>
        <div class="prestige-cols"><div><b>會清除</b><ul><li>錢幣、攻擊力、全隊訓練</li><li>電動手指、夥伴訓練</li><li>當輪包數，回到後院草地</li><li>王包裂痕、技能效果與冷卻</li></ul></div>
        <div><b>會保留</b><ul><li>夥伴、粉塵、升階、超越、編隊</li><li>保底與抽數、王的勝利紀錄</li><li>徽章、更衣室、桌面裝飾、派遣</li><li>印記、神器、商店</li></ul></div></div>
        <p>換桌布另送萬用粉塵 ${3 + (s.artifacts?.dust || 0)} 顆${s.markShop?.starter5 ? '，以及開局五連' : ''}；本輪當家會重抽。</p>`;
      body.append(note);
      const row = document.createElement('div'); row.className = 'prestige-actions';
      const go = document.createElement('button'); go.id = 'prestige-go'; go.textContent = why || `換桌布（領 ${gained} 顆印記）`; go.disabled = !!why || store.blocked;
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
        t.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><span><b>${a.name} Lv.${level} / ${a.max}</b><small>${a.per}</small><em class="art-pips">${Array.from({length:a.max},(_,i)=>`<i class="${i<level?'on':''}"></i>`).join('')}</em></span><i>${full ? '滿級' : `下一級 ${cost} 印記`}</i>`;
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
      const heading2 = document.createElement('h3'); heading2.textContent = '兌換'; body.append(heading2);
      const repeat = document.createElement('div'); repeat.className = 'mark-list';
      for (const item of B.blessings.filter(b => b.id === 'dustTrade')) {
        for (const n of [1,10]) {
          const cost = P.dustTradeCost(s, n);
          const t = document.createElement('button'); t.className = 'mark-ticket'; t.dataset.item = item.id; t.dataset.quantity = n;
          t.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><span><b>${item.name}${n > 1 ? ' ×10' : ''}（已換 ${s.dustTrades || 0} 次 → +${P.DUST_PER_TRADE * n} 粉塵）</b><small>${item.desc}</small></span><i>${cost} 印記</i>`;
          t.disabled = s.marks < cost || store.blocked;
          t.onclick = () => action(() => { if (commit(P.tradeDust(store.state, n, Date.now()))) { sound('upgrade'); changed(); notice(`${item.name}${n > 1 ? ' ×10' : ''}`); render(); } });
          repeat.append(t);
        }
      }
      body.append(repeat);
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
    }
    function doPrestige() {
      action(() => {
        const r = P.prestige(store.state, Date.now());
        if (!commit(r.state)) return;
        close();
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
      const stamp = document.createElement('div'); stamp.className = 'mark-stamp'; stamp.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><b>印記 +${gained}</b>`;
      $('game').append(stamp);
      stamp.animate([{ transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.17,.89,.32,1.28)' }).finished.then(() => setTimeout(() => stamp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => stamp.remove()).catch(() => stamp.remove()), 1400)).catch(() => stamp.remove());
      notice(`換了新桌布，永久倍率 ×${E.markMul(store.state).toFixed(2)}`);
    }
    function open() { tab = 'prestige'; $('prestige').hidden = false; $('game-content').inert = true; render(); $('prestige-close').focus(); }
    function close() { $('prestige').hidden = true; $('game-content').inert = false; }
    // 「桌子有點滿了」便條：一天一次，點了就開面板
    function hint() {
      if ($('prestige-hint')) return;
      const el = document.createElement('button'); el.id = 'prestige-hint'; el.textContent = '桌子有點滿了，要不要換桌布？'; el.onclick = () => { el.remove(); open(); };
      $('stage').append(el); commit();
      setTimeout(() => el.remove(), 20000);
    }
    return { open, close, render, hint };
  }
  return { create };
})();
