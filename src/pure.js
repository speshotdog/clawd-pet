// Clawd — 無 DOM / 無 Tauri 依賴的純邏輯
// 瀏覽器端掛在 window.ClawdPure（index.html 在 pet.js 之前載入），
// node --test 直接 require 同一支檔案，測試跑的就是實際上線的程式碼。
(function (root) {
  'use strict';

  // ---------- 縮放檔位 ----------
  const SCALE_MIN = 0.5;
  const SCALE_MAX = 2;
  // localStorage 存的是浮點字串；讀不到或壞掉一律回標準 1.0，超界夾回。
  function clampScale(raw) {
    const v = parseFloat(raw);
    if (!isFinite(v) || v === 0) return 1;
    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, v));
  }

  // ---------- 心情 / 飽食度 ----------
  const FEED_GAIN = {
    hotdog: { fullness: 25, mood: 10 },
    love: { fullness: 5, mood: 12 },
  };

  // 每 30 秒一格：飽食度固定掉 0.4，心情看「扣完之後」的飽食度決定掉多少
  function decayStats(stats) {
    const fullness = Math.max(0, stats.fullness - 0.4);
    return {
      fullness,
      mood: Math.max(0, stats.mood - (fullness < 30 ? 0.6 : 0.25)),
    };
  }

  // 熱狗吃太飽會拒絕；愛心不佔肚子，隨時都吃得下
  function canFeed(stats, kind) {
    return kind === 'love' || stats.fullness <= 95;
  }

  function feedStats(stats, kind) {
    const gain = FEED_GAIN[kind] || FEED_GAIN.hotdog;
    return {
      fullness: Math.min(100, stats.fullness + gain.fullness),
      mood: Math.max(0, Math.min(100, stats.mood + gain.mood)),
    };
  }

  // ---------- Claude 工作分派 ----------
  // windows = 夥伴數 + 主視窗。每位夥伴拿 base，除不盡的餘數歸主視窗。
  function splitShare(count, windows) {
    const n = Math.max(1, windows);
    const base = Math.floor(count / n);
    return { base, main: base + (count % n) };
  }

  // ---------- 夥伴 / 玩具清單開關 ----------
  // 不改動傳入的陣列，回傳新清單與這次是加入還是移除
  function toggleInList(list, id) {
    const next = list.slice();
    const i = next.indexOf(id);
    if (i >= 0) {
      next.splice(i, 1);
      return { list: next, added: false };
    }
    next.push(id);
    return { list: next, added: true };
  }

  // ---------- 逐像素（幾何）命中判定 ----------
  // 六個角色的命中範圍都是同一個形狀：「頭部橢圓 ∪ 軀幹方框」，差別只在座標。
  // shape = { ellipse: [cx, cy, rx, ry], box: [x0, x1, y0, y1] }（stage CSS 座標）
  function hitShape(shape, px, py) {
    const [cx, cy, rx, ry] = shape.ellipse;
    const dx = px - cx;
    const dy = py - cy;
    if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) return true;
    const [x0, x1, y0, y1] = shape.box;
    return px >= x0 && px <= x1 && py >= y0 && py <= y1;
  }

  const api = {
    SCALE_MIN,
    SCALE_MAX,
    clampScale,
    decayStats,
    canFeed,
    feedStats,
    splitShare,
    toggleInList,
    hitShape,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClawdPure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
