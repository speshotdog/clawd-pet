/* 卡面建立器：唯一一份。
 *
 * 以前卡面 DOM 與尺寸計算在 demo.html、build_cards_remade.py、build_deluxe_b.py
 * 各寫一次，結果就是「抽卡接入之後全部跑掉」——三份會各自漂移。
 * 規格在 docs/clicker/HANDOFF-holo-cards.md 第六之四、六之五節（凍結）。
 *
 * 用法：
 *   const face = HoloCardFace.create(data, {masks, resolve});
 *   HoloCardFace.observe(face);      // 字級與縮字
 *   HoloCardFace.paint(face, rarity, x, y, {tilt:false});
 *
 * data: {id, name, rarity, kind:'depth'|'flat'|'framed', file, scene?, bleed?, pal?}
 * resolve(name): 把素材檔名換成實際可用的 URL（相對路徑或 data URI），各頁自己決定。
 */
(function (root) {
  'use strict';

  var LABEL = {common:'普通', rare:'精良', epic:'史詩', legendary:'傳說', mythic:'神話'};
  var ZLIFT = {common:24, rare:32, epic:40, legendary:48, mythic:56};
  var TILT  = {common:6, rare:8, epic:10, legendary:12, mythic:14};

  // 凍結的換算基準：290px 卡寬（HANDOFF 六之五）
  var NAME_SHARE = 24 / 290;
  var RARITY_SHARE = 13.5 / 290;
  var GEM_SHARE = 22 / 290;
  var MIN_NAME_RATIO = 0.55;      // 縮字下限
  var GEM_GAP_SHARE = 0.02;       // 名字與寶石之間留白

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function material(parent) {
    var stack = node('div', 'foil-stack');
    ['spectrum', 'relief', 'etch'].forEach(function (x) { stack.append(node('div', 'foil-' + x)); });
    parent.append(stack, node('div', 'foil-fiber'), node('div', 'foil-grain'), node('div', 'foil-glare'));
  }

  function create(data, opts) {
    opts = opts || {};
    var masks = opts.masks || {};
    var resolve = opts.resolve || function (n) { return n; };
    var kind = data.kind || (data.scene ? 'depth' : (data.bleed ? 'flat' : 'framed'));

    var card = node('div', 'hcard r-' + data.rarity + ' kind-' + kind + ' gem-faceted' +
                           (data.scene ? ' scene' : '') + (data.bleed ? ' bleed' : ''));
    card.dataset.id = data.id;
    card.dataset.rarity = data.rarity;
    card.dataset.artKind = kind;

    var pal = data.pal || {};
    card.style.setProperty('--pal-base', pal.base || '#141b2e');
    card.style.setProperty('--pal-glow', pal.glow || '#2b3550');
    card.style.setProperty('--pal-accent', pal.accent || '#9fb0c8');
    card.style.setProperty('--pal-ink', pal.ink || '#080c17');

    var lift = node('div', 'card-lift'), inner = node('div', 'card-inner'), front = node('div', 'card-face');
    var stock = node('div', 'leaf face-stock'),
        bg = node('div', 'leaf face-depth-bg'),
        art = node('div', 'leaf face-art'),
        frame = node('div', 'leaf face-frame'),
        plate = node('div', 'leaf face-plate'),
        gem = node('div', 'face-gem'),
        text = node('div', 'face-text');

    // 背景：場景卡有自己的背景圖層，其他卡靠 CSS 的同色背景
    if (data.scene) {
      var bgImg = node('img');
      bgImg.src = resolve('layer-' + data.id + '-background.png');
      bgImg.alt = ''; bgImg.draggable = false;
      bg.append(bgImg);
    } else {
      bg.append(node('div', 'floor'));
    }
    material(bg);

    // 圖層
    var key = data.scene ? ('layer-' + data.id + '-subject.png') : data.file;
    var media = node('div', 'art-media'), img = node('img');
    img.src = resolve(key); img.alt = ''; img.draggable = false;
    media.append(img);
    // flat 不做圖內視差，所以不掛 subject-mask（HANDOFF 三節）
    if (masks[key] && kind !== 'flat') {
      var mask = node('div', 'subject-mask');
      mask.style.setProperty('--subject', 'url("' + masks[key] + '")');
      material(mask);
      media.append(mask);
    }
    art.append(media);
    frame.append(node('div', 'frame-material'));

    // 名字一律在 .face-text，.face-plate 只是背板
    text.append(node('b', 'face-name', data.name),
                node('span', 'face-rarity', LABEL[data.rarity] + ' / ' + data.rarity.toUpperCase()));

    front.append(stock, bg, art, frame, plate, gem, text);
    inner.append(front); lift.append(inner); card.append(lift);
    paint(card, data.rarity, 0, 0, {tilt: false});
    return card;
  }

  /* ── 字級與縮字：三個頁面共用同一份 ───────────────────────── */

  function textWidth(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().width;
  }

  function fit(card, w) {
    var name = card.querySelector('.face-name');
    var plate = card.querySelector('.face-plate');
    var gem = card.querySelector('.face-gem');
    if (!name || !plate) return;

    name.style.removeProperty('--name-fs');     // 局部值會遮住卡片上的變數
    var base = w * NAME_SHARE;
    card.style.setProperty('--name-fs', base.toFixed(2) + 'px');

    var pcs = getComputedStyle(plate);
    var cr = card.getBoundingClientRect(), pr = plate.getBoundingClientRect();
    var cx = cr.left + cr.width / 2;
    var scale = cr.width ? pr.width / plate.offsetWidth : 1;   // 投影比例，量到同一個座標空間
    var padL = parseFloat(pcs.paddingLeft) * scale;
    var padR = parseFloat(pcs.paddingRight) * scale;
    var half = Math.min(cx - (pr.left + padL), (pr.right - padR) - cx);
    if (gem) half = Math.min(half, cx - (gem.getBoundingClientRect().right + w * GEM_GAP_SHARE * scale));
    var room = Math.max(0, 2 * half);

    var fs = base, floor = base * MIN_NAME_RATIO, guard = 0;
    while (textWidth(name) > room && fs > floor && guard++ < 24) {
      fs = Math.max(floor, fs * 0.93);
      card.style.setProperty('--name-fs', fs.toFixed(2) + 'px');
    }
    card.dataset.nameFits = String(textWidth(name) <= room);

    // 稀有度跟著名字走：名字被縮過就照同一個比例縮，
    // 否則長名時 4.75px 的稀有度會比縮到 4.64px 的名字還大。
    var rarity = Math.min(w * RARITY_SHARE, fs * RARITY_SHARE / NAME_SHARE);
    card.style.setProperty('--rarity-fs', rarity.toFixed(2) + 'px');
  }

  var observer = null;
  function observe(card) {
    if (!observer) {
      observer = new ResizeObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var w = list[i].contentRect.width;
          if (!w) continue;
          var c = list[i].target;
          c.style.setProperty('--gem-fs', (w * GEM_SHARE).toFixed(2) + 'px');
          fit(c, w);
        }
      });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { refit(); });
      }
    }
    observer.observe(card);
  }

  function unobserve(card) { if (observer) observer.unobserve(card); }

  function refit() {
    // ⚠ 一定要用未變形的佈局寬（clientWidth），不能用 getBoundingClientRect()。
    // 卡片外層有 hover scale 與 Z 投影，用 rect 會把 102px 的卡算成 115px，
    // 字級就變成 9.54px 而不是 8.44px（Astra 驗收抓到）。
    document.querySelectorAll('.hcard').forEach(function (c) {
      var w = c.clientWidth;
      if (w) fit(c, w);
    });
  }

  /* ── 姿態：tilt=false 時卡片不轉，只有材質跟著游標 ──────────── */

  function paint(card, rarity, x, y, opts) {
    opts = opts || {};
    var tiltOn = opts.tilt !== false;
    x = x || 0; y = y || 0;
    var z = ZLIFT[rarity] * 0.65, tilt = tiltOn ? TILT[rarity] : 0;
    var d = Math.min(1, Math.hypot(x, y));
    var t = ((Math.atan2(y, x) + Math.PI) / (Math.PI * 2) * 4) % 4;
    if (d < 0.002) t = 0;
    var a = Math.floor(t), b = (a + 1) % 4, f = t - a;
    var q = function (i) { return (i % 2 * 100) + '% ' + (Math.floor(i / 2) * 100) + '%'; };
    // flat 的定義是「不做圖內視差」，所以就算整張卡可以傾斜，圖層也不位移
    var shift = (tiltOn && card.dataset.artKind !== 'flat') ? 1 : 0;
    var v = {
      '--rx': (-y * tilt) + 'deg', '--ry': (x * tilt) + 'deg',
      '--za': z + 'px', '--zb': '2px', '--zf': '8px', '--zp': '12px',
      '--comp': (1000 - z) / 1000,
      '--ax': (x * 1.5 * shift) + 'px', '--ay': (y * 1.5 * shift) + 'px',
      '--bx': (-x * 0.5 * shift) + 'px', '--by': (-y * 0.5 * shift) + 'px',
      '--fx': (50 - 26 * x + 10 * y) + '%', '--fy': (50 + 16 * y) + '%',
      '--cx': (50 + 20 * x + 8 * y) + '%', '--cy': (50 - 24 * y) + '%',
      '--gx': (50 + 42 * x) + '%', '--gy': (50 + 42 * y) + '%',
      '--phase': (120 + x * 70 - y * 40) + 'deg',
      '--ga': (0.18 + 0.82 * d) * (1 - f), '--gb': (0.18 + 0.82 * d) * f,
      '--apos': q(a), '--bpos': q(b),
      '--foil': 0.85, '--grain': 0.75, '--glare': 0.45 * (0.3 + 0.5 * d)
    };
    for (var k in v) card.style.setProperty(k, String(v[k]));
  }

  root.HoloCardFace = {
    create: create, observe: observe, unobserve: unobserve, refit: refit,
    paint: paint, fit: fit, LABEL: LABEL, ZLIFT: ZLIFT, TILT: TILT,
    NAME_SHARE: NAME_SHARE, RARITY_SHARE: RARITY_SHARE, GEM_SHARE: GEM_SHARE
  };
})(window);
