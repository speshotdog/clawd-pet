/* 卡面特效層：card_face.js 是凍結檔、只認 subject／background 兩層，
 * 個別卡的加層（例：玩物就玩物的愛心微晃、羊呼吸）統一在這裡掛，
 * 每個建卡的入口在 HoloCardFace.create() 之後呼叫一次：
 *
 *   HoloCardFx.apply(card, data, resolve);
 *
 * 資料來源是 pool_data.py 的 OVERRIDES／卡表 → data.fx = {hearts:'layer-<id>-hearts.png', breathe:true}
 *   或（泡水大亨堡）{ripples:'layer-<id>-ripples.png', float:true}：水波層慢慢漂、熱狗本體上下浮
 * 樣式在 card-fx.css（建置腳本把它接在卡面 CSS 後面）。
 * 動畫都是純 transform（合成執行緒），prefers-reduced-motion 時停。
 */
(function (root) {
  'use strict';
  function apply(card, data, resolve) {
    var fx = data && data.fx;
    if (!card || !fx) return card;
    resolve = resolve || function (n) { return n; };
    var media = card.querySelector('.art-media');
    if (!media) return card;
    if (fx.hearts && !media.querySelector('.fx-hearts')) {
      var h = document.createElement('img');
      h.className = 'fx-hearts'; h.alt = ''; h.draggable = false;
      h.src = resolve(fx.hearts);
      media.append(h);
    }
    if (fx.ripples && !media.querySelector('.fx-ripples')) {
      var r = document.createElement('img');
      r.className = 'fx-ripples'; r.alt = ''; r.draggable = false;
      r.src = resolve(fx.ripples);
      media.append(r);
    }
    // 瞌睡時光：主體逐格動畫（作者的 AVI → animated WebP）蓋在靜態主體上
    if (fx.anim && !media.querySelector('.fx-anim')) {
      var a = document.createElement('img');
      a.className = 'fx-anim'; a.alt = ''; a.draggable = false;
      a.src = resolve(fx.anim);
      media.append(a);
      card.dataset.anim = '';
    }
    if (fx.breathe) card.dataset.breathe = '';
    if (fx.float) card.dataset.float = '';
    return card;
  }
  root.HoloCardFx = { apply: apply };
})(window);
