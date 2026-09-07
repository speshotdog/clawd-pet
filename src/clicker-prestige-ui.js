// 第十三輪 UI：換桌布（輪迴）面板、印記商店、電動手指購買、輪迴提示便條。
window.ClickerPrestigeUI = (() => {
  function create({ store, commit, changed, action, format, notice, sound, stage, album }) {
    const $ = id => document.getElementById(id), E = window.ClickerEconomy, B = window.ClickerBalance, P = window.ClickerPrestige;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let tab = 'prestige';
    function render() {
      const s = store.state, body = $('prestige-body'); body.replaceChildren();
      $('prestige-summary').textContent = `印記 ${s.marks}（累計 ${s.marksClaimed}，永久倍率 ×${E.markMul(s).toFixed(2)}）・已換 ${s.prestiges} 次`;
      const tabs = document.createElement('div'); tabs.className = 'prestige-tabs';
      for (const [id, name] of [['prestige', '換桌布'], ['marks', '印記商店'], ['finger', '電動手指']]) {
        const b = document.createElement('button'); b.textContent = name; b.classList.toggle('active', tab === id); b.onclick = () => { tab = id; render(); }; tabs.append(b);
      }
      body.append(tabs);
      if (tab === 'prestige') renderPrestige(s, body); else if (tab === 'marks') renderMarks(s, body); else renderFinger(s, body);
    }
    function renderPrestige(s, body) {
      const why = P.canPrestige(s), gained = P.marksAvailable(s), next = (P.marksTotal(s) + 1) ** 2 * P.THRESHOLD;
      const note = document.createElement('div'); note.className = 'prestige-note';
      note.innerHTML = `<p>生涯收入 <b>${format(s.lifetimeCoins)}</b> 幣。可領印記 <b>${gained}</b> 顆（下一顆在 ${format(next)} 幣）。換桌布後永久倍率 ×${(1 + .05 * (s.marksClaimed + gained)).toFixed(2)}。</p>
        <div class="prestige-cols"><div><b>會清除</b><ul><li>錢幣、攻擊力、全隊訓練</li><li>電動手指、夥伴訓練</li><li>當輪包數，回到後院草地</li><li>王包裂痕、技能效果與冷卻</li></ul></div>
        <div><b>會保留</b><ul><li>夥伴、粉塵、升階、超越</li><li>保底與抽數、王的勝利紀錄</li><li>徽章、更衣室、桌面裝飾</li><li>印記與印記商店</li></ul></div></div>
        <p>換桌布另送萬用粉塵 3 顆${s.markShop?.starter5 ? '，以及開局五連' : ''}。</p>`;
      body.append(note);
      const row = document.createElement('div'); row.className = 'prestige-actions';
      const go = document.createElement('button'); go.id = 'prestige-go'; go.textContent = why || `換桌布（領 ${gained} 顆印記）`; go.disabled = !!why || store.blocked;
      go.onclick = () => { if (go.dataset.armed !== '1') { go.dataset.armed = '1'; go.textContent = `確定要重來嗎？再按一次`; return; } doPrestige(); };
      row.append(go); body.append(row);
    }
    function renderMarks(s, body) {
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
      const heading = document.createElement('h3'); heading.textContent = '祝福'; body.append(heading);
      const repeat = document.createElement('div'); repeat.className = 'mark-list';
      for (const item of B.blessings) {
        for (const n of item.id === 'dustTrade' ? [1,10] : [1]) {
          const cost = item.id === 'blessing' ? (s.blessing || 0) + 1 : item.cost * n;
          const t = document.createElement('button'); t.className = 'mark-ticket'; t.dataset.item = item.id; t.dataset.quantity = n;
          const title = item.id === 'blessing' ? `${item.name} Lv.${s.blessing || 0}（×${E.blessMul(s).toFixed(2)}）` : `${item.name}${n > 1 ? ' ×10' : ''}`;
          t.innerHTML = `<img src="clicker-ui-stamp-transcend.png" alt="" /><span><b>${title}</b><small>${item.desc}</small></span><i>${item.id === 'blessing' ? '下一級 ' : ''}${cost} 印記</i>`;
          t.disabled = s.marks < cost || store.blocked;
          t.onclick = () => action(() => {
            const next = item.id === 'blessing' ? P.buyBlessing(store.state, Date.now()) : item.id === 'dustTrade' ? P.tradeDust(store.state, n, Date.now()) : P.buyDrawTicket(store.state, n, Date.now());
            if (commit(next)) { sound('upgrade'); changed(); notice(`${item.name}${n > 1 ? ' ×10' : ''}`); render(); }
          });
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
