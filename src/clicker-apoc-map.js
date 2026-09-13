// 末世的關卡地圖（使用者 2026-09-13：「模式 是額外的大選項，切換後就是之前做的關卡地圖」）。
//
// 版面照 holo-5.0 `_art/holo-test/map20.template.html` 的原型移植：二十站線性路線、每四站一個王、
// 五個區段，站點沿著插畫地形左右交錯。原型是 20 MB 的內嵌單頁，這裡只留畫面邏輯，
// 素材由 `tools/apoc/build_map.py` 拆成 `src/apoc/map/*.webp`。
//
// 資料一律讀 ApocEconomy 的 view（progress／stage／canFight），這支不自己存任何進度。
// 點「進入戰鬥」＝呼叫 apocUI.fight()，戰鬥畫面就是 1.0 那一套（使用者指定）。
window.ClickerApocMap = (() => {
  const SECTIONS = ['後院草地・廢墟', '補給線', '夜市攤・廢墟', '冷藏庫深處', '滅世都市'];
  const BOSSES = ['灰狼犬', '貼紙羊', '扛槌兔', '雞頭合成怪', '真・滅世珍獸'];
  const MECHANICS = ['召喚小怪', '護盾層', '節奏', '順序', '前四種輪播'];
  const NAMES = [['倒塌圍籬', '荒草小徑', '踩平的草地'], ['傾斜貨架', '停擺輸送帶', '包裝膜走廊'],
    ['熄燈攤口', '翻覆長桌', '等距槌痕'], ['破裂流理台', '結霜庫門', '異形腳印'],
    ['斷裂街口', '沉陷高架', '彎曲街道']];
  const OMENS = ['草地被踩平的路徑', '纏著撕不斷的包裝膜', '地面固定間隔的槌痕；間隔預示之後的拍子',
    '對不上任何動物的腳印', '街道不該有的弧度'];
  // 第七輪使用者：「地圖的美術是不是沒有完善，只有兩個區域，往下就重複而已，幫我完善」。
  // 以前只有第一段有真的美術（terrain.webp），二～五段拿同一張重複貼。現在一段一張（terrain-2～5.webp，
  // Codex imagegen 照第一段 seg1b 的規格畫，原稿與回報在 _art/apoc-map/），每張上放該段的 4 站。
  // 站點位置用「路線高度的百分比」算：第 k 段第 j 站在 (k + 0.2 + 0.2j) / 5——避開每張圖上下 10% 的接段過渡帶。
  const stationPct = i => (Math.floor(i / 4) + .2 + .2 * (i % 4)) / 5 * 100;
  const STAGES = Array.from({ length: 20 }, (_, i) => ({
    i, segment: Math.floor(i / 4), boss: i % 4 === 3,
    name: i % 4 === 3 ? BOSSES[Math.floor(i / 4)] : NAMES[Math.floor(i / 4)][i % 4],
  }));

  function create({ $, apocUI, format, refit }) {
    let selected = 0, built = false;

    function build() {
      const route = $('map-route'); route.replaceChildren();
      const terrain = document.createElement('div'); terrain.id = 'map-terrain'; terrain.setAttribute('aria-hidden', 'true');
      const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); lines.id = 'map-lines'; lines.setAttribute('aria-hidden', 'true');
      route.append(terrain, lines);
      // 五段五張直幅插畫由上往下順排，高度由寬度推（原圖 971×1619），路線高度就是五張疊起來的高度
      terrain.replaceChildren(...SECTIONS.map((_, k) => {
        const t = document.createElement('div'); t.className = 'map-tile'; t.dataset.seg = k + 1; return t;
      }));
      for (const s of STAGES) {
        const b = document.createElement('button');
        b.className = 'map-station' + (s.boss ? ' boss' : '');
        b.style.setProperty('--dx', `${s.i % 2 * 36}px`);
        b.style.top = `${stationPct(s.i)}%`;
        b.dataset.index = s.i;
        const body = document.createElement('span'); body.className = 'node-body';
        const sym = document.createElement('span'); sym.className = 'map-motif'; body.append(sym);
        const label = document.createElement('span'); label.className = 'map-label';
        b.append(body, label);
        b.onclick = () => { selected = s.i; details(); };
        route.append(b);
      }
      const rail = $('map-rail'); rail.replaceChildren();
      SECTIONS.forEach((name, i) => {
        const b = document.createElement('button');
        const n = document.createElement('b'); n.textContent = `0${i + 1}`;
        b.append(n, document.createTextNode(' ' + name));
        b.title = `${name}・${MECHANICS[i]}`;
        b.onclick = () => { selected = i * 4; details(); scrollTo(i * 4); };
        rail.append(b);
      });
      built = true;
    }

    const v = () => apocUI.view;
    function scrollTo(i) {
      const w = $('map-window'), node = $('map-route').querySelector(`.map-station[data-index="${i}"]`);
      if (!node) return;
      w.scrollTo({ top: Math.max(0, node.offsetTop - w.clientHeight / 2), behavior: 'smooth' });   // 站點以自己的中心定位（CSS translateY(-50%)）
    }

    function details() {
      const view = v(), progress = view.progress, s = STAGES[selected];
      $('map-section').textContent = `0${s.segment + 1} / ${SECTIONS[s.segment]}・${MECHANICS[s.segment]}`;
      $('map-title').textContent = `${String(selected + 1).padStart(2, '0')} ${s.name}`;
      const done = selected < progress, current = selected === progress;
      $('map-status').textContent = done ? '已通行' : current ? (view.stage ? '戰鬥中' : '目前位置')
        : `未解鎖・先過第 ${selected} 站`;
      $('map-desc').textContent = s.boss ? `區段王・${MECHANICS[s.segment]}。打贏才能進下一個區段。`
        : `路上的小怪。前方的痕跡：${OMENS[s.segment]}。`;
      $('map-next').textContent = current && !done
        ? `需要 ${format(view.need)} 傷害・目前戰力 ${format(view.power)}`
        : done ? '這一站已經走過了。' : '';
      const go = $('map-enter');
      go.disabled = !current || !(view.power > 0) || (!view.canFight && !view.stage);
      go.textContent = view.stage && current ? '回到戰鬥' : !(view.power > 0) ? '先去編隊' : s.boss ? '挑戰王關' : '進入戰鬥';
      $('map-back').disabled = selected === Math.min(progress, 19);
      render();
    }

    function render() {
      if (!built) return;
      const view = v(), progress = view.progress;
      const nodes = $('map-route').querySelectorAll('.map-station');
      nodes.forEach((b, i) => {
        const done = i < progress, current = i === progress;
        b.classList.toggle('done', done); b.classList.toggle('current', current);
        b.classList.toggle('locked', i > progress); b.classList.toggle('picked', i === selected);
        b.setAttribute('aria-label', `第 ${i + 1} 站 ${STAGES[i].name} ${done ? '已通關' : current ? '目前站' : '未解鎖'}`);
        b.querySelector('.map-motif').className = `map-motif motif-${done ? 'check' : current ? 'paw' : 'lock'}`;
        b.querySelector('.map-label').textContent = STAGES[i].name;
      });
      // 走過的路線畫實線，沒走過的淡：用站點自己的 top 算，不量 DOM（捲動位置不影響）
      const lines = $('map-lines');
      // 連線端點＝站點中心：直接量節點（left 是 43%／28% ＋ 交錯 36px、以中心定位），SVG 座標就是路線的像素座標。
      // Codex 第七輪：以前 x 寫死 43／47%，沒算交錯的 px 與節點半寬，線一直歪一側。
      const route = $('map-route'), pt = n => { const b = nodes[n]; return [b.offsetLeft + b.offsetWidth / 2, b.offsetTop]; };
      lines.setAttribute('viewBox', `0 0 ${route.clientWidth || 1} ${route.clientHeight || 1}`);
      lines.setAttribute('preserveAspectRatio', 'none');
      lines.replaceChildren(...STAGES.slice(0, 19).map((s, i) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const [x0, y0] = pt(i), [x1, y1] = pt(i + 1);
        path.setAttribute('d', `M${x0} ${y0} L${x1} ${y1}`);
        path.setAttribute('class', 'map-link' + (i < progress ? ' walked' : ''));
        return path;
      }));
      $('map-total').textContent = `${String(progress).padStart(2, '0')} / 20`;
    }

    function open() {
      if (!built) build();
      selected = Math.min(v().progress, 19);
      $('apoc-map').hidden = false; $('stage-fit').hidden = true; $('game-content').classList.add('map-open');
      details(); scrollTo(selected);
      $('map-enter').focus();
    }
    function close() {
      $('apoc-map').hidden = true; $('stage-fit').hidden = false; $('game-content').classList.remove('map-open');
      // 地圖開著時轉向，fitStage 量到的是隱藏的舞台（寬 0 → --stage-fit:0）；露出來要重量一次（Codex 複檢 B3）
      refit?.();
    }
    return {
      open, close, details,
      get visible() { return !$('apoc-map').hidden; },
      sync() { if (!$('apoc-map').hidden) details(); },
      bind() {
        $('map-enter').onclick = () => {
          const view = v();
          if (!view.stage) apocUI.fight();
          close(); apocUI.render();
        };
        $('map-back').onclick = () => { selected = Math.min(v().progress, 19); details(); scrollTo(selected); };
      },
    };
  }
  return { create, STAGES, SECTIONS };
})();
