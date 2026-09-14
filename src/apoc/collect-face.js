// 收藏卡（魔花少女）的原生卡面加工。
//
// 使用者 2026-09-14：「卡片沒有完整還原精裝卡該有的品質」「為什麼 2.0 的顯示都很正常，
// 1.0 這邊顯示精裝卡這麼醜」「你直接把 2.0 的程式碼拿來用不就好了」「收藏卡的品質要跟 2.0 的卡冊一樣好」。
//
// 根因：2.0 的 71 張卡是 ClickerHolo.face() 畫的原生 DOM（HoloCardFace，跑在 shadow root 裡），
// 收藏卡卻是塞一個 iframe 去嵌那張 10.5 MB 的獨立頁——兩條路，品質當然不一樣，
// 還附帶模糊、掉 FPS、字型不對三個問題。這支把獨立頁在 create() 之後做的加工搬過來，
// 讓收藏卡走**完全同一套渲染**。
//
// 獨立頁在 create() 之後做四件事，這裡一件不漏：
//   ① 兩層特殊反光（主體 special-tint、背景 bg-tint）——card-face.js 是凍結檔不能改，只能事後補掛
//   ② 替身動作：另一支 90 幀動畫疊在上面，點一下疊化過去、跑完一輪再疊化回來
//   ③ 16 顆飄浮愛心（每顆自己的 @keyframes）
//   ④ body 的三個類別（font-system／gem-faceted／ink-chroma）——gem-faceted 由 create() 自己加，
//      另外兩個是 body 作用域的規則，在 shadow root 裡要改寫成卡面自己的選擇器
window.ApocCollectFace = (() => {
  const D = () => window.ApocCollect;
  const has = id => !!D()?.entries?.[id];
  const entry = id => D()?.entries?.[id] || null;
  let registered = false;
  // 「特殊」是這張卡自己新增的階級。card-face.js 是凍結檔，所以在外面補一筆（原頁也是這樣做的）。
  function register() {
    const d = D(); if (registered || !d || !window.HoloCardFace) return;
    Object.assign(window.HoloCardFace.LABEL, d.rarity.label);
    Object.assign(window.HoloCardFace.ZLIFT, d.rarity.zlift);
    Object.assign(window.HoloCardFace.TILT, d.rarity.tilt);
    registered = true;
  }
  // body 作用域的兩條規則改寫成 shadow root 裡的規則（每張卡自己一個 shadow root，不會波及別人）
  const BODY_CSS = '.hcard{--card-font:Arial,"Microsoft JhengHei",sans-serif}'
    + '.face-name,.face-rarity{color:var(--name-ink)}';

  function sheen(host, cls, subject) {
    const el = document.createElement('div');
    el.className = cls;
    if (subject) el.style.setProperty('--subject', subject);
    el.innerHTML = '<i></i>';
    host.append(el);
    return el;
  }

  // 16 顆愛心：每顆一組自己的 @keyframes（只動 transform 與 opacity）。
  // 原頁把 <style> 掛在 document.head；這裡要掛進 shadow root，不然卡面看不到。
  const HEART = {
    duration: [9.5, 15.064, 12.318, 10.856, 15.044, 9.533, 14.322, 11.252, 11.685, 14.554, 12.007, 11.786, 14.52, 12.296, 14.302, 15.5],
    size: [11.5, 18.4, 17.9, 19.8, 17.3, 15.1, 19.6, 19, 16.2, 13.2, 18, 20, 19.2, 17.7, 18.8, 14.3],
    fade: [.624, .648, .636, .684, .612, .756, .6, .744, .72, .672, .78, .732, .708, .768, .696, .66],
    x: [6, 57, 18, 82, 31, 12, 92, 43, 77, 23, 69, 8, 87, 20, 80, 90],
  };
  function hearts(card, root, tag) {
    const box = document.createElement('div');
    box.className = 'gift-hearts'; box.setAttribute('aria-hidden', 'true');
    const rules = document.createElement('style');
    for (let i = 0; i < 16; i++) {
      const duration = HEART.duration[i], size = HEART.size[i], fade = HEART.fade[i];
      const peak = .72 + i * .002, enter = .06 + i * .004, end = .10 + i * .006, nextFade = .35 + i * .9;
      const delay = ((nextFade - fade * duration) % duration - duration) % duration, sway = 2.13 + i * .071;
      const name = `gift-rise-${tag}-${i}`;   // shadow root 之間不共用 @keyframes，但同一頁多張卡還是各自取名比較穩
      const heart = document.createElement('i');
      heart.style.cssText = `--x:${HEART.x[i]}%;--size:${size}px;--duration:${duration}s;`
        + `--delay:${delay}s;--peak:${peak};--swing:${6 + i * .5}px;--sway:${sway}s;`
        + `--rise:${name};--rest:${-35 - (i * 7) % 40}%`;
      heart.innerHTML = '<b></b>';
      rules.textContent += `@keyframes ${name}{`
        + '0%{transform:translateY(0);opacity:0}'
        + `${enter * 100}%{opacity:${peak}}`
        + '20%{transform:translateY(-20%)}40%{transform:translateY(-35%)}70%{transform:translateY(-68%)}'
        + `${fade * 100}%{opacity:${peak}}`
        + `100%{transform:translateY(${-(1 - end) * 100}%);opacity:0}}`;
      box.append(heart);
    }
    root.append(rules);
    card.querySelector('.card-face')?.append(box);
  }

  const FADE = 320;      // 疊化時間
  const CYCLE = 2970;    // 一輪動作 ＝ 90 格 × 33ms

  /** 在 HoloCardFace.create() 之後加工。resolve：素材名 → 絕對網址。 */
  function enhance(card, root, resolve, tag) {
    const media = card.querySelector('.art-media'); if (!media) return null;
    const style = document.createElement('style'); style.textContent = BODY_CSS; root.append(style);

    const baseImg = media.querySelector('img');
    const baseMask = card.querySelector('.subject-mask');
    const baseSubject = baseMask ? baseMask.style.getPropertyValue('--subject') : '';
    const baseTint = sheen(media, 'subject-mask special-tint', baseSubject);
    const depth = card.querySelector('.face-depth-bg');
    if (depth) sheen(depth, 'bg-tint');

    // 替身動作：待機時不持有動畫來源（2.5 MB），觸發並 decode 完成才開始疊化
    const altImg = document.createElement('img');
    altImg.alt = ''; altImg.draggable = false; altImg.style.opacity = '0';
    media.append(altImg);
    const altMask = document.createElement('div');
    altMask.className = 'subject-mask';
    altMask.style.setProperty('--subject', 'none'); altMask.style.opacity = '0';
    altMask.innerHTML = baseMask ? baseMask.innerHTML : '';
    media.append(altMask);
    const altTint = sheen(media, 'subject-mask special-tint', 'none');
    altTint.style.opacity = '0';

    hearts(card, root, tag);

    const gain = () => parseFloat(getComputedStyle(card).getPropertyValue('--subject-gain').trim() || '.4');
    let busy = false, timer = 0;
    const ac = new AbortController();   // 卡片被拿掉時一起解掉監聽（listener 會留住 detached DOM）
    // 釋放替身動作持有的資源。⚠ 動畫來源是 2.5 MB 的 90 幀 WebP，一定要把 src 拿掉，
    //   不能只清 timeout——清掉 timeout 反而會讓底下那段釋放程式永遠不會跑。
    function release() {
      altImg.removeAttribute('src');
      altMask.style.setProperty('--subject', 'none'); altTint.style.setProperty('--subject', 'none');
      busy = false;
    }
    function show(alt) {
      // 遮罩的 opacity 平常吃 --subject-gain，疊化期間要自己算，兩邊加起來才不會忽亮忽暗
      const g = gain();
      baseImg.style.opacity = alt ? '0' : '1';
      altImg.style.opacity = alt ? '1' : '0';
      if (baseMask) baseMask.style.opacity = alt ? '0' : String(g);
      altMask.style.opacity = alt ? String(g) : '0';
      baseTint.style.opacity = alt ? '0' : '.72';
      altTint.style.opacity = alt ? '.72' : '0';
      card.dataset.face = alt ? 'alt' : 'idle';
    }
    async function trigger() {
      if (busy || !resolve('alt')) return;
      busy = true;
      altImg.src = resolve('alt');
      try { await altImg.decode(); } catch { release(); return; }
      // ⚠ decode 是 async：等的這段期間卡片可能已經被拿掉（翻頁、關掉放大層）。
      //   不檢查的話後面會對 detached DOM 播動畫、還會再排一個 3.3 秒的 timer。
      if (!card.isConnected) { release(); return; }
      const m = `url("${resolve('alt-mask')}")`;
      altMask.style.setProperty('--subject', m); altTint.style.setProperty('--subject', m);
      show(true);
      timer = setTimeout(async () => {      // 疊化進去＋完整跑一輪，再疊化回來
        timer = 0;
        if (!card.isConnected) { release(); return; }
        show(false);
        getComputedStyle(altImg).opacity;   // 等真正的淡出終點才釋放動畫來源
        try { await Promise.all(altImg.getAnimations().map(a => a.finished)); } catch { /* 元素被拔掉就算了 */ }
        release();
      }, FADE + CYCLE);
    }
    show(false);
    card.style.cursor = 'pointer';
    card.addEventListener('click', trigger, { signal: ac.signal });
    return {
      trigger, show,
      /** 卡片下架：解監聽、停計時，並且**確實**把 2.5 MB 的動畫來源放掉。 */
      stop() { ac.abort(); if (timer) { clearTimeout(timer); timer = 0; } release(); },
    };
  }
  return { register, has, entry, enhance, FADE, CYCLE };
})();
