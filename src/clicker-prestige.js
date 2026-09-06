// 第十三輪純邏輯：輪迴（換桌布）、印記商店、電動手指、夥伴個別訓練、桌面裝飾。
// 只操作 state，不碰 DOM；倍率的套用點在 clicker-economy.js（rates／individual／skillAt／settle）。
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const THRESHOLD = 1e8;
  const marksTotal = (s) => Math.floor(Math.sqrt((s.lifetimeCoins || 0) / THRESHOLD));
  const marksAvailable = (s) => Math.max(0, marksTotal(s) - (s.marksClaimed || 0));
  const markMul = (s) => 1 + .05 * (s.marksClaimed || 0);
  function canPrestige(s) {
    if ((s.lifetimeCoins || 0) < THRESHOLD) return '生涯收入到 1 億才能換桌布';
    if (marksAvailable(s) < 1) return '目前沒有可領的印記，再賺一點';
    if (s.pending) return '先收下招募';
    if (s.boss) return '王包進行中';
    return null;
  }
  // 清除：幣、手勁、訓練、電動手指、夥伴訓練、當輪包數、場景進度；保留：角色、粉塵、升階、超越、保底、王勝、徽章、更衣室、印記。
  function prestige(state, now) {
    const s = E.settle(state, now).state, why = canPrestige(s);
    if (why) throw new Error(why);
    const gained = marksAvailable(s);
    s.marksClaimed = (s.marksClaimed || 0) + gained; s.marks = (s.marks || 0) + gained; s.prestiges = (s.prestiges || 0) + 1;
    s.coins = 0; s.clickLevel = 0; s.trainingLevel = 0; s.autoClick = 0; s.partnerLevels = {}; s.autoRemainder = 0;
    s.package = E.newPackage('backyard'); s.settings.scene = 'backyard'; s.scenePackages = {};
    s.bossCracks = {}; s.bossCooldownUntil = 0; s.bossResult = null; s.gift = null; s.boss = null;
    s.effects = []; s.cooldownUntil = {}; s.slotReadyAt = s.slotReadyAt.map(() => 0); s.chain = { count: 1, expiresAt: 0 };
    if (s.markShop?.starter5) s.freeDraws = (s.freeDraws || 0) + 5;
    s.universalDust = (s.universalDust || 0) + 3;
    s.prestigeHintDate = null; s.peakRate = 0;
    return { state: s, gained };
  }
  function buyMark(state, id, now) {
    const s = E.settle(state, now).state, item = B.marks.find(m => m.id === id);
    if (!item) throw new Error('印記商店沒有這項');
    s.markShop ||= {};
    if (s.markShop[id]) throw new Error('已經擁有');
    if ((s.marks || 0) < item.cost) throw new Error('印記不足');
    s.marks -= item.cost; s.markShop[id] = true;
    if (id === 'slot4' && s.skillSlots.length < 4) { s.skillSlots.push(null); s.slotReadyAt.push(0); }
    return s;
  }
  const autoClickCost = (L) => Math.ceil(5000 * 2.2 ** L);
  function buyAutoClick(state, now, max = false) {
    const s = E.settle(state, now).state; let levels = 0;
    do { const price = autoClickCost(s.autoClick || 0); if ((s.autoClick || 0) >= B.autoClickMax || price > s.coins) break; s.coins -= price; s.autoClick = (s.autoClick || 0) + 1; levels++; } while (max);
    if (!levels) throw new Error((s.autoClick || 0) >= B.autoClickMax ? '電動手指已滿級' : '餘額不足');
    return { state: s, levels };
  }
  // 每秒自動點擊次數 .5×L；用累積器把小數留到下一秒，回傳這一秒該點幾下
  function autoClicks(s, seconds) {
    const rate = .5 * (s.autoClick || 0); if (!rate) return 0;
    const total = (s.autoRemainder || 0) + rate * seconds, n = Math.floor(total);
    s.autoRemainder = total - n; return n;
  }
  const trainCost = (L) => Math.ceil(50 * 1.22 ** L);   // 1.5 會讓 100 級要 2e19 幣，1.22 約 2e10
  function train(state, id, now, max = false) {
    const s = E.settle(state, now).state;
    if (!s.collection[id]) throw new Error('尚未招募');
    s.partnerLevels ||= {}; let levels = 0;
    do { const L = s.partnerLevels[id] || 0, price = trainCost(L); if (L >= 100 || price > s.coins) break; s.coins -= price; s.partnerLevels[id] = L + 1; levels++; } while (max);
    if (!levels) throw new Error((s.partnerLevels[id] || 0) >= 100 ? '已經 100 級' : '餘額不足');
    return { state: s, levels };
  }
  const nextMilestone = (L) => [25, 50, 75, 100].find(m => L < m) || null;
  const decoPrice = (s) => Math.max(20000, Math.round(E.rates(s).P * 3600));
  function buyDeco(state, id, now) {
    const s = E.settle(state, now).state, item = B.decor.find(d => d.id === id);
    if (!item) throw new Error('沒有這件裝飾');
    s.deco ||= [];
    if (s.deco.includes(id)) throw new Error('已經擁有');
    const price = decoPrice(s); if (s.coins < price) throw new Error('餘額不足');
    s.coins -= price; s.deco.push(id); return s;
  }
  // 「桌子有點滿了」：最近收益不到本輪巔峰的 15%、且有印記可領，一天提示一次
  function hint(s, currentP, today) {
    s.peakRate = Math.max(s.peakRate || 0, currentP);
    if (!canPrestige(s) && currentP < (s.peakRate || 0) * .15 && s.prestigeHintDate !== today) { s.prestigeHintDate = today; return true; }
    return false;
  }
  const api = { THRESHOLD, marksTotal, marksAvailable, markMul, canPrestige, prestige, buyMark, autoClickCost, buyAutoClick, autoClicks, trainCost, train, nextMilestone, decoPrice, buyDeco, hint };
  if (node) module.exports = api; else root.ClickerPrestige = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
