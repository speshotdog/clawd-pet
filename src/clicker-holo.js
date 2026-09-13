// 末世的精裝卡面：把 holo-5.0 的 HoloCardFace 接進主頁。
//
// 使用者 2026-09-13：「目前所有卡 71 張都是精裝，舊版的也全部都翻新了」、卡面要用精裝卡面。
//
// ⚠ 為什麼要用 shadow root：精裝卡面的 CSS 有 60 KB、選擇器（.leaf、.face-art、.foil-*⋯⋯）
//   跟 1.0 的樣式沒有命名空間，直接放進主頁一定互相打架。team20 當初就是用 shadow root 隔離的，
//   這裡沿用同一招。CSS 走 <link>，瀏覽器只會抓一次。
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
  const ready = () => !!(window.HoloCardFace && window.ApocPool);
  // HoloCardFace.observe() 用強引用的 Set 持有卡面，翻頁、換詳情、拖曳結束後不解除就一直留著（Codex 複檢 C）。
  // 呼叫端不會通知「這張卡被拿掉了」，所以每次建新卡時順手清：離開 DOM 超過 5 秒的才清——
  // 剛建好還沒掛上去的卡也是 isConnected=false，不能馬上清。
  const live = new Set();
  function prune(now) {
    for (const h of live) if (!h.isConnected && now - h._born > 5000) { window.HoloCardFace.unobserve(h._face); live.delete(h); }
  }

  // 回傳一個「填滿容器」的精裝卡面。容器自己要有尺寸與 position（.hcard 是 inset:0）。
  function face(entry, { tilt = false } = {}) {
    if (!ready() || !entry) return null;
    const host = document.createElement('span'); host.className = 'holo-face';
    const m = maskUrls();
    if (m.frame) host.style.setProperty('--frame-mask', `url("${m.frame}")`);
    if (m.glitter) host.style.setProperty('--glitter-mask', `url("${m.glitter}")`);
    const sh = host.attachShadow({ mode: 'open' });
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url('holo.css'); sh.append(link);
    const f = window.HoloCardFace.create(entry, { masks: m, resolve: assetUrl });
    sh.append(f);
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
    const rarity = face.dataset.rarity || [...face.classList].find(c => c.startsWith('r-'))?.slice(2) || 'rare';
    let rx = 0, ry = 0, lx = 0, ly = 0, drag = null, raf = 0;
    const paint = (x, y) => { lx = x; ly = y; window.HoloCardFace.paint(face, rarity, x, y, { tilt: false });
      face.style.setProperty('--rx', rx + 'deg'); face.style.setProperty('--ry', ry + 'deg'); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const release = () => {
      drag = null; stop(); const r0x = rx, r0y = ry, x0 = lx, y0 = ly, t0 = performance.now();
      const step = (now) => { const p = Math.min(1, (now - t0) / 280), k = Math.pow(1 - p, 4);
        rx = r0x * k; ry = r0y * k; paint(x0 * k, y0 * k); raf = p < 1 ? requestAnimationFrame(step) : 0; };
      raf = requestAnimationFrame(step);
    };
    host.style.touchAction = 'none';
    host.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); stop(); drag = { x: e.clientX, y: e.clientY, rx, ry }; host.setPointerCapture(e.pointerId); });
    host.addEventListener('pointermove', e => {
      // 回正途中游標只是經過（沒在拖）就讓它回完，不然卡會停在半途（Codex 複檢 B2）
      if (!drag && raf) return;
      stop(); const b = host.getBoundingClientRect();
      if (drag) { rx = Math.max(-18, Math.min(18, drag.rx - (e.clientY - drag.y) * .2)); ry = Math.max(-18, Math.min(18, drag.ry + (e.clientX - drag.x) * .2)); }
      paint((e.clientX - b.left) / b.width * 2 - 1, (e.clientY - b.top) / b.height * 2 - 1);
    });
    host.addEventListener('pointerup', e => { if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId); release(); });
    host.addEventListener('pointercancel', release);
    host.addEventListener('pointerleave', () => { if (!drag) release(); });
    host.classList.add('holo-interactive');
  }
  // 卡面的字級是用容器寬度算的，容器改變大小要重量一次
  function refit(host) { if (host && host._face) window.HoloCardFace.refit(host._face); }
  return { face, refit, ready, interactive };
})();
