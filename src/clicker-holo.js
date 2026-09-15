// 末世的精裝卡面：把 holo-5.0 的 HoloCardFace 接進主頁。
//
// 使用者 2026-09-13：「目前所有卡 71 張都是精裝，舊版的也全部都翻新了」、卡面要用精裝卡面。
//
// ⚠ 為什麼要用 shadow root：精裝卡面的 CSS 有 60 KB、選擇器（.leaf、.face-art、.foil-*⋯⋯）
//   跟 1.0 的樣式沒有命名空間，直接放進主頁一定互相打架。team20 當初就是用 shadow root 隔離的，
//   這裡沿用同一招。CSS 用 constructable stylesheet 同步掛（見下面 attachSheets 的說明）。
//
// 素材：`tools/apoc/build_holo.py` 把卡圖、遮罩、字型從內嵌 data URI 拆成 src/apoc/ 底下的檔案，
//       對照表在 window.ApocAssets（卡圖）與 window.ApocMasks（遮罩）。
window.ClickerHolo = (() => {
  // ⚠ 一定要絕對網址。遮罩是透過 CSS 自訂屬性（--subject）傳進去的，而自訂屬性裡的相對網址
  //   是用「使用它的那份樣式表」當基準——也就是 apoc/holo.css——結果會變成 apoc/apoc/masks/...。
  const url = (n) => new URL('apoc/' + n, document.baseURI).href;
  let maskCache = null, maskSrc = null;
  function maskUrls() {
    const m = window.ApocMasks || {};
    if (m !== maskSrc) { maskSrc = m; maskCache = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, url(v)])); }
    return maskCache;
  }
  const assetUrl = (n) => url((window.ApocAssets || {})[n] || n);
  // 卡面的樣式表用 constructable stylesheet **同步**掛進 shadow root。
  // ⚠ 以前是每張卡塞一個 <link>：瀏覽器非同步套用，從卡建好到樣式生效之間整張卡是裸的——
  //   600×840 的卡圖用原尺寸畫出來、名字跟稀有度擠成一行。實測真 Chrome 一次翻頁 8 張卡裸 8～9 格（約 130ms），
  //   慢一點的機器更久，看起來就是「翻頁／點開卡面就破圖」（使用者 2026-09-14 回報，四種環境都靠 16ms 取樣才抓到）。
  //   同步掛載就沒有這個空窗。樣式表裡的相對網址（fonts/、art/）要先改成絕對網址，
  //   因為 replaceSync 的文字是用**頁面**當基準，不是 apoc/holo.css。還沒抓到之前退回 <link>。
  const SHEET_NAMES = ['holo.css', 'holo-special.css'];
  const canAdopt = typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype && 'adoptedStyleSheets' in ShadowRoot.prototype;
  const sheets = {};   // 檔名 → CSSStyleSheet（還沒到的沒有鍵）
  const absolutize = (css, base) => css.replace(/url\(\s*(['"]?)(?!data:|https?:|\/|#)([^'")]+)\1\s*\)/g, (m, q, path) => `url("${new URL(path, base).href}")`);
  async function loadSheet(name) {
    const href = url(name), res = await fetch(href); if (!res.ok) throw new Error(`${name} ${res.status}`);
    const sheet = new CSSStyleSheet(); sheet.replaceSync(absolutize(await res.text(), href)); sheets[name] = sheet;
  }
  const sheetsReady = canAdopt ? Promise.allSettled(SHEET_NAMES.map(n => loadSheet(n).catch(e => { console.warn('ClickerHolo 樣式表', e); throw e; }))) : Promise.resolve([]);
  // 回傳實際同步掛上的檔名（測試用 host.dataset.holoSheets 看）；沒掛上的補 <link>
  // 拖曳時暫停前景與背景收藏卡的愛心（飄浮 i 與擺動 b 都要停）。
  // clicker.css 透過繼承變數同步各張卡；移除拖曳卡也會自動恢復，不會留下暫停狀態。
  // 放在 clicker-holo 而不是 holo-special.css，因為那張是 build_collect_card.py 的產出（不能手改）。
  const runtimeCss = ':host(.holo-dragging) .gift-hearts>i{animation-play-state:paused}'
    + '.hcard .gift-hearts>i,.hcard .gift-hearts b{animation-play-state:var(--holo-heart-play-state,running)}'
    // 大尺寸前景的愛心即使暫停，濾鏡／混色層仍有合成成本。暫時不畫，保留動畫進度。
    + ':host(.holo-dragging) .gift-hearts{visibility:hidden}';
  const runtimeSheet = (() => { if (!canAdopt) return null; const st = new CSSStyleSheet(); st.replaceSync(runtimeCss); return st; })();
  function attachSheets(sh, names) {
    const adopted = names.filter(n => sheets[n]);
    if (adopted.length) sh.adoptedStyleSheets = [...adopted.map(n => sheets[n]), ...(runtimeSheet ? [runtimeSheet] : [])];
    for (const n of names) if (!sheets[n]) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url(n); sh.append(link); }
    if (!adopted.length) { const st = document.createElement('style'); st.textContent = runtimeCss; sh.append(st); }
    return adopted;
  }
  // adoptedStyleSheets 在 cascade 裡排在 shadow root 裡的 <style> **之後**（規範：adopted 最後套用），
  // 所以第十二輪下半場改用 adopted 之後，收藏卡的加工樣式（collect-face.js `enhance()` 注入的 <style>）
  // 反而排在 holo.css／holo-special.css **前面**——跟獨立頁的順序相反（原頁的加工樣式在 <head> 最後）。
  // 這裡把加工用的 <style> 也轉成 CSSStyleSheet 接在 adopted 最後面，順序回到「holo → special → 卡自己的加工」。
  //
  // ⚠ 誠實記錄：這**不是**「16 顆愛心不動」的原因（2026-09-15 一度以為是）。加工樣式裡只有 @keyframes
  //   （名字還是每張卡自己的 gift-rise-<tag>-<i>），沒有任何 animation 宣告，所以順序根本影響不到它。
  //   真兇是 tools/apoc/build_collect_card.py 把 @media(prefers-reduced-motion:reduce) 拆平了，見那支的註解。
  //   保留這段是為了跟獨立頁同一個順序，不是為了修愛心。
  function adoptInlineStyles(sh) {
    // 退回 <link> 的那條路（樣式表還沒抓到）本來順序就對，動了反而會壞：<link> 是非同步的，
    // 把 <style> 抽走變成 adopted 之後，加工樣式會比 <link> 早生效。
    if (!canAdopt || !sh.adoptedStyleSheets.length || sh.querySelector('link')) return 0;
    const extra = [];
    for (const st of [...sh.querySelectorAll('style')]) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(absolutize(st.textContent, document.baseURI));
        extra.push(sheet); st.remove();
      } catch (e) { console.warn('ClickerHolo 加工樣式轉 adopted 失敗，留著原來的 <style>', e); }
    }
    if (extra.length) sh.adoptedStyleSheets = [...sh.adoptedStyleSheets, ...extra];
    return extra.length;
  }
  const ready = () => !!(window.HoloCardFace && window.ApocPool);
  // 收藏卡（魔花少女）：不在卡池裡、素材與遮罩是另一組、階級是這張卡自己新增的「特殊」。
  // 使用者 2026-09-14：「收藏卡的品質要跟 2.0 的卡冊一樣好」——所以走的是**同一個 face()**，
  // 只是換一組素材對照表、多掛一張 holo-special.css，再補上獨立頁在 create() 之後做的加工。
  const CF = () => window.ApocCollectFace;
  const isCollect = (entry) => !!(entry && CF()?.has(entry.id));
  let collectSeq = 0;
  // HoloCardFace.observe() 用強引用的 Set 持有卡面，翻頁、換詳情、拖曳結束後不解除就一直留著（Codex 複檢 C）。
  // 呼叫端不會通知「這張卡被拿掉了」，所以每次建新卡時順手清：離開 DOM 超過 5 秒的才清——
  // 剛建好還沒掛上去的卡也是 isConnected=false，不能馬上清。
  const live = new Set();
  function prune(now) {
    for (const h of live) if (!h.isConnected && now - h._born > 5000) { window.HoloCardFace.unobserve(h._face); h._collect?.stop(); live.delete(h); }
  }
  // 尺寸保險：卡面的字級全靠 --cw（HoloCardFace 用 ResizeObserver 量），量不到就退回 holo.css 的預設 262px——
  // 在 46px 寬的夥伴列上就是「阿巴阿巴／精良／RARE」整排大字疊在一起（朋友 2026-09-16 截圖，本機重現不出來）。
  // 不管是哪條路漏掉了量測，這裡每 1.5 秒把還在畫面上的卡對一次：--cw 跟實際寬度差超過 1px 就重量、沒被觀察的補回觀察。
  function guard() {
    for (const h of live) {
      const f = h._face; if (!f || !h.isConnected) continue;
      const w = f.clientWidth; if (!w) continue;
      const cw = parseFloat(f.style.getPropertyValue('--cw')) || 0;
      if (Math.abs(cw - w) > 1) { window.HoloCardFace.observe(f); window.HoloCardFace.refit(f); }
    }
  }
  setInterval(guard, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) guard(); });
  // 收藏卡帶著 2.5 MB 的替身動畫，不能等下一次建卡順手清（關掉卡冊之後就不會再建卡了）。
  // 它只會有一兩張，所以離開 DOM 就直接收——比 prune 的 5 秒寬限積極。
  function sweepCollect() {
    for (const h of live) if (h._collect && !h.isConnected) { window.HoloCardFace.unobserve(h._face); h._collect.stop(); live.delete(h); }
  }

  // 回傳一個「填滿容器」的精裝卡面。容器自己要有尺寸與 position（.hcard 是 inset:0）。
  function face(entry, { tilt = false } = {}) {
    if (!ready() || !entry) return null;
    const collect = isCollect(entry);
    if (collect) CF().register();      // LABEL／ZLIFT／TILT 補上「特殊」這一階（card-face.js 是凍結檔）
    const host = document.createElement('span'); host.className = 'holo-face' + (collect ? ' holo-collect' : '');
    const D = collect ? window.ApocCollect : null;
    const m = collect ? Object.fromEntries(Object.entries(D.masks).map(([k, v]) => [k, url(v)])) : maskUrls();
    const resolve = collect ? (n) => url(D.assets[n] || n) : assetUrl;
    if (m.frame) host.style.setProperty('--frame-mask', `url("${m.frame}")`);
    if (m.glitter) host.style.setProperty('--glitter-mask', `url("${m.glitter}")`);
    const sh = host.attachShadow({ mode: 'open' });
    // 共用的 holo.css 沒有 .r-special（原頁註解：「只寫在這一頁」），收藏卡要多掛一張
    host.dataset.holoSheets = attachSheets(sh, collect ? ['holo.css', 'holo-special.css'] : ['holo.css']).join(' ');
    const f = window.HoloCardFace.create(entry, { masks: m, resolve });
    sh.append(f);
    if (collect) { host._collect = CF().enhance(f, sh, resolve, ++collectSeq); host.dataset.holoInline = String(adoptInlineStyles(sh)); }
    window.HoloCardFace.observe(f); window.HoloCardFace.refit(f);
    window.HoloCardFace.paint(f, entry.rarity, 0, 0, { tilt });
    host._face = f; host._born = Date.now();
    prune(host._born); live.add(host);
    return host;
  }
  // 可以拿在手上看的卡（卡冊詳情）：滑鼠經過時反光跟著游標，按住拖曳轉動，放開 280ms 回正。
  // 手感照精裝典藏包的 bindInteraction：拖曳 0.2°/px、±18° 封頂、四次方緩出回正。
  function interactive(host) {
    const face = host && host._face; if (!face) return;
    const lift = face.querySelector('.card-lift');
    // 收藏卡的獨立頁帶 700ms transform 過渡；這裡已經由 rAF 控制跟手與 280ms 回正，
    // 再疊 CSS 過渡會一直追趕舊角度，甚至 JS 回正結束後畫面仍沒回正。
    lift.style.transition = 'none';
    const rarity = face.dataset.rarity || [...face.classList].find(c => c.startsWith('r-'))?.slice(2) || 'rare';
    let rx = 0, ry = 0, lx = 0, ly = 0, drag = null, raf = 0;
    const paint = (x, y) => { lx = x; ly = y;
      // 拖曳／回正時固定反光，只轉動 lift。--rx/--ry 寫在 face 上會繼承到整棵卡面，
      // 即使跳過 HoloCardFace.paint() 仍會反覆重算樣式。直接寫 transform 才避開這條路。
      // hover 照常更新反光；回正終點恢復完整的中性卡面，主圖、遮罩與材質都不改。
      if (!host.classList.contains('holo-dragging')) window.HoloCardFace.paint(face, rarity, x, y, { tilt: false });
      lift.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`; };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const release = () => {
      // 釋放捕捉後可能接著收到 pointerleave／cancel；不要把同一次回正重新計時。
      if (!drag && raf) return;
      drag = null; stop(); if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; pending = null; } const r0x = rx, r0y = ry, x0 = lx, y0 = ly, t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 280), k = Math.pow(1 - p, 4);
        rx = r0x * k; ry = r0y * k;
        if (p === 1) host.classList.remove('holo-dragging');
        paint(x0 * k, y0 * k);
        if (p === 1) lift.style.removeProperty('transform');
        raf = p < 1 ? requestAnimationFrame(step) : 0; };
      raf = requestAnimationFrame(step);
    };
    host.style.touchAction = 'none';
    host.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); stop(); drag = { x: e.clientX, y: e.clientY, rx, ry }; host.classList.add('holo-dragging'); host.setPointerCapture(e.pointerId); });
    // 拖曳的重畫合併到 rAF：滑鼠一秒可以送 120+ 個 pointermove，每個都 paint（十幾個 CSS 變數＋整張卡的合成層）
    // 在收藏卡（16 顆愛心＋兩層 multiply 反光）上會掉格（使用者 2026-09-15：「魔花少女沒辦法流暢拖移角度，會卡」）。
    // 一格只畫最後一個位置；拖曳中 host 掛 .holo-dragging，CSS 把愛心動畫暫停。
    let moveRaf = 0, pending = null;
    const flush = () => { moveRaf = 0; const e = pending; pending = null; if (!e) return;
      const b = host.getBoundingClientRect();
      if (drag) { rx = Math.max(-18, Math.min(18, drag.rx - (e.y - drag.y) * .2)); ry = Math.max(-18, Math.min(18, drag.ry + (e.x - drag.x) * .2)); }
      paint((e.x - b.left) / b.width * 2 - 1, (e.y - b.top) / b.height * 2 - 1); };
    host.addEventListener('pointermove', e => {
      // 回正途中游標只是經過（沒在拖）就讓它回完，不然卡會停在半途（Codex 複檢 B2）
      if (!drag && raf) return;
      stop(); pending = { x: e.clientX, y: e.clientY };
      if (!moveRaf) moveRaf = requestAnimationFrame(flush);
    });
    host.addEventListener('pointerup', e => { if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId); release(); });
    host.addEventListener('pointercancel', release);
    host.addEventListener('pointerleave', () => { if (!drag) release(); });
    // ⚠ 按下時 host 有 setPointerCapture，click 會被重新指派到 host（pointerdown 在 shadow 裡、pointerup 在 host，共同祖先是 host），
    //   collect-face.js 掛在 .hcard 上的 click 永遠收不到——真人點魔花少女從來觸發不了替身動作，只有測試用 JS click 才會
    //   （朋友 2026-09-16：「不回跳到砍人那張」）。這裡在 host 上補：沒拖動（<8px）的點擊就轉給替身。
    let tapAt = null;
    host.addEventListener('pointerdown', e => { tapAt = { x: e.clientX, y: e.clientY }; });
    host.addEventListener('click', e => { const d = tapAt; tapAt = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return; host._collect?.trigger?.(); });
    host.classList.add('holo-interactive');
  }
  // 卡面的字級是用容器寬度算的，容器改變大小要重量一次
  function refit(host) { sweepCollect(); if (host && host._face) window.HoloCardFace.refit(host._face); }
  return { face, refit, ready, interactive, isCollect, sweepCollect, sheetsReady };
})();
