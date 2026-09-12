// 第十三輪純邏輯：輪迴（換桌布）、印記商店、電動手指、夥伴個別訓練、桌面裝飾。
// 只操作 state，不碰 DOM；倍率的套用點在 clicker-economy.js（rates／individual／skillAt／settle）。
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const B = node ? require('./clicker-balance.js') : root.ClickerBalance;
  const E = node ? require('./clicker-economy.js') : root.ClickerEconomy;
  const THRESHOLD = 1e8;   // 舊版門檻，v3 只留給遷移對照
  // v3 §四：印記改成「本輪做到的事」的計數，不看幣——本輪打贏的大王每隻 1、本輪累計 100／300 包各 1、
  // 本輪打贏滅世珍獸再 +3，每輪上限 12。產出線性於進度、有頂，才不會再出現 ×76,000。
  const marksTotal = (s) => Math.min(B.V3.MARKS_PER_RUN, (s.runWins || []).length + ((s.runPacks || 0) >= 100 ? 1 : 0) + ((s.runPacks || 0) >= 300 ? 1 : 0) + ((s.runWins || []).includes('city') ? 3 : 0));
  const marksAvailable = (s) => marksTotal(s);
  const markMul = (s) => 1 + B.MARK_MUL_COEF * Math.sqrt(s.marksClaimed || 0);
  function canPrestige(s) {
    if (!(s.runWins || []).length) return '本輪至少要打贏一隻王才能換桌布';
    if (s.pending) return '先收下招募';
    if (s.boss) return '王包進行中';
    return null;
  }
  // 清除：幣、手勁、訓練、電動手指、夥伴訓練、當輪包數、場景進度；保留：角色、粉塵、升階、超越、保底、王勝、徽章、更衣室、印記。
  // v3 §五 本輪當家：從已擁有的角色隨機抽 2 張（不夠就有幾張抽幾張）
  function pickChampions(s, rng = Math.random) {
    const ids = Object.keys(s.collection || {}).filter(id => s.collection[id] > 0 && Object.hasOwn(B.characters, id));
    const out = [];
    while (ids.length && out.length < B.V3.CHAMPIONS) out.push(ids.splice(Math.floor(rng() * ids.length), 1)[0]);
    return out;
  }
  function prestige(state, now, rng = Math.random) {
    const s = E.settle(state, now).state, why = canPrestige(s);
    if (why) throw new Error(why);
    const gained = marksAvailable(s);
    s.marksClaimed = (s.marksClaimed || 0) + gained; s.marks = (s.marks || 0) + gained; s.prestiges = (s.prestiges || 0) + 1;
    s.coins = 0; s.clickLevel = 0; s.trainingLevel = 0; s.autoClick = 0; s.partnerLevels = {}; s.autoRemainder = 0;
    s.package = E.newPackage('backyard'); s.settings.scene = 'backyard'; s.scenePackages = {};
    s.bossCracks = {}; s.bossCooldownUntil = 0; s.bossResult = null; s.gift = null; s.boss = null;
    delete s.thief;
    s.effects = []; s.cooldownUntil = {}; s.slotReadyAt = s.slotReadyAt.map(() => 0); s.chain = { count: 1, expiresAt: 0 };
    if (s.markShop?.starter5) s.freeDraws = (s.freeDraws || 0) + 5;
    s.universalDust = (s.universalDust || 0) + 3;
    s.runWins = []; s.runPacks = 0; s.runGates = 0; delete s.energized;
    s.champions = pickChampions(s, rng);
    s.prestigeHintDate = null; s.peakRate = 0; s.peakRateStamp = 0;
    return { state: s, gained };
  }
  function buyMark(state, id, now) {
    const s = E.settle(state, now).state, item = B.marks.find(m => m.id === id);
    if (!item) throw new Error('印記商店沒有這項');
    s.markShop ||= {};
    if (s.markShop[id]) throw new Error('已經擁有');
    if (item.requires && !s.markShop[item.requires]) throw new Error('要先買前一項');
    if ((s.marks || 0) < item.cost) throw new Error('印記不足');
    s.marks -= item.cost; s.markShop[id] = true;
    if (id === 'bossTime' && s.boss) s.boss.endsAt += 10000;
    if (id === 'slot4' && s.skillSlots.length < 4) { s.skillSlots.push(null); s.slotReadyAt.push(0); }
    return s;
  }
  function buyBlessing(state, now = state.settledAt) {
    const s = E.settle(state, now).state, level = (s.blessing || 0) + 1;
    if (level > B.BLESSING_MAX) throw new Error('收益祝福已滿級');
    if ((s.marks || 0) < level) throw new Error('印記不足');
    s.marks -= level; s.blessing = level; return s;
  }
  // 粉塵兌換改成遞增價（2026-09-08 使用者定案）。原本是固定 1 印記換 5 粉塵，
  // 但印記的產出是 √生涯收入，會爆炸性成長（生涯 1e18 就有 10 萬枚），
  // 固定比例遲早會被追過、整個卡池直接買下來，卡片就沒價值了。
  // 這跟第二十三輪「印記倍率線性改開根號」是同一個教訓：形狀不改，係數只是延後。
  // 改成第 n 次兌換要 n 印記（比照祝福的形狀），每輪能買的量就自然封頂，
  // 跟你手上有幾萬枚印記無關，同時也讓印記真的有回收去處。
  const DUST_PER_TRADE = 5;
  /** 接下來 n 次兌換的總價：第 (dustTrades+1) 次到第 (dustTrades+n) 次的等差和 */
  function dustTradeCost(s, n = 1) {
    const done = s.dustTrades || 0;
    return n * done + n * (n + 1) / 2;
  }
  function tradeDust(state, n = 1, now = state.settledAt) {
    if (!Number.isSafeInteger(n) || n < 1) throw new Error('兌換數量無效');
    const s = E.settle(state, now).state;
    const cost = dustTradeCost(s, n);
    if ((s.marks || 0) < cost) throw new Error('印記不足');
    s.marks -= cost; s.dustTrades = (s.dustTrades || 0) + n;
    s.universalDust = (s.universalDust || 0) + DUST_PER_TRADE * n; return s;
  }
  // v3：招募券拿掉（使用者 2026-09-12）——印記換免費抽等於把整個卡池買下來
  function buyDrawTicket() { throw new Error('招募券已停售'); }
  const autoClickCost = (L) => Math.ceil(5000 * 2.2 ** L);
  function buyAutoClick(state, now, max = false) {
    const s = E.settle(state, now).state; let levels = 0;
    do { const price = autoClickCost(s.autoClick || 0); if ((s.autoClick || 0) >= B.autoClickCap(s) || price > s.coins) break; s.coins -= price; s.autoClick = (s.autoClick || 0) + 1; levels++; } while (max);
    if (!levels) throw new Error((s.autoClick || 0) >= B.autoClickCap(s) ? '電動手指已滿級' : '餘額不足');
    return { state: s, levels };
  }
  // 每秒自動點擊次數 .5×L；用累積器把小數留到下一秒，回傳這一秒該點幾下
  function autoClicks(s, seconds) {
    const rate = .5 * (s.autoClick || 0); if (!rate) return 0;
    const total = (s.autoRemainder || 0) + rate * seconds, n = Math.floor(total);
    s.autoRemainder = total - n; return n;
  }
  // 夥伴訓練價＝CC 建築：基礎價 200×base（回本 200 秒；CC 游標 150 秒、農場 137 秒、礦坑 255 秒），每級 ×1.15；效果在 economy.partnerMul（線性＋里程碑 ×2）
  const PARTNER_CAP = 200;
  // 里程碑那一級（→10／25／50／100／150／200）價 ×10：CC 的建築升級品是另外買的、約十倍建築價，這裡併進那一級
  const trainCost = (L, id) => Math.ceil(200 * B.characters[id].base * 1.15 ** L);   // 2026-09-08 使用者定：里程碑那一級不再 ×10 價（只保留 ×2 倍率），免得 25 隻夥伴都卡在 49 級
  function train(state, id, now, max = false) {
    const s = E.settle(state, now).state;
    if (!s.collection[id]) throw new Error('尚未招募');
    s.partnerLevels ||= {}; let levels = 0;
    do { const L = s.partnerLevels[id] || 0, price = trainCost(L, id); if (L >= PARTNER_CAP || price > s.coins) break; s.coins -= price; s.partnerLevels[id] = L + 1; levels++; } while (max);
    if (!levels) throw new Error((s.partnerLevels[id] || 0) >= PARTNER_CAP ? `已經 ${PARTNER_CAP} 級` : '餘額不足');
    return { state: s, levels };
  }
  function trainAll(state, now) {
    let s = E.settle(state, now).state, levels = 0, spent = 0;
    const perPartner = {};
    const ids = Object.keys(B.characters).filter(id => s.collection[id]);
    while (levels < 500) {
      const round = ids.filter(id => (s.partnerLevels?.[id] || 0) < PARTNER_CAP)
        .sort((a,b) => (s.partnerLevels?.[a] || 0) - (s.partnerLevels?.[b] || 0));
      let bought = 0;
      for (const id of round) {
        const price = trainCost(s.partnerLevels?.[id] || 0, id);
        if (price > s.coins) continue;
        s = train(s, id, now).state;
        spent += price; levels++; bought++; perPartner[id] = (perPartner[id] || 0) + 1;
        if (levels >= 500) break;
      }
      if (!bought) break;
    }
    if (!levels) throw new Error('餘額不足');
    return { state: s, levels, spent, perPartner };
  }
  const nextMilestone = (L) => [25, 50, 75, 100].find(m => L < m) || null;
  const decoPrice = (s) => Math.round(50000 * 1.5 ** s.deco.length);
  function buyDeco(state, id, now) {
    const s = E.settle(state, now).state, item = B.decor.find(d => d.id === id);
    if (!item) throw new Error('沒有這件裝飾');
    s.deco ||= [];
    if (s.deco.includes(id)) throw new Error('已經擁有');
    const price = decoPrice(s); if (s.coins < price) throw new Error('餘額不足');
    s.coins -= price; s.deco.push(id); return s;
  }
  // 「桌子有點滿了」：最近收益不到本輪巔峰的 15%，或（2026-09-07）一包要拆超過三分鐘且已有 5 枚以上印記可領——
  // 數值重整後停滯的樣子是「收益不掉、包變慢」，只看收益下降永遠不會提示。一天一次。
  function hint(s, currentP, today, needSeconds = 0) {
    s.peakRate = Math.max(s.peakRate || 0, currentP);
    const stalled = needSeconds > 180 && marksAvailable(s) >= 5;
    if (!canPrestige(s) && (currentP < (s.peakRate || 0) * .15 || stalled) && s.prestigeHintDate !== today) { s.prestigeHintDate = today; return true; }
    return false;
  }
  /** 切換某件裝飾要不要擺在桌上（買了才切得動）。買到的仍然算 decoMul，擺不擺只影響畫面。 */
  function toggleDeco(state, id) {
    if (!(state.deco || []).includes(id)) throw new Error('還沒買這件裝飾');
    const s = E.clone(state); s.decoShown ||= [];
    s.decoShown = s.decoShown.includes(id) ? s.decoShown.filter(x => x !== id) : [...s.decoShown, id];
    return s;
  }
  const api = { PARTNER_CAP, THRESHOLD, marksTotal, marksAvailable, markMul, canPrestige, prestige, pickChampions, buyMark, buyBlessing, tradeDust, dustTradeCost, DUST_PER_TRADE, buyDrawTicket, autoClickCost, buyAutoClick, autoClicks, trainCost, train, trainAll, nextMilestone, decoPrice, buyDeco, toggleDeco, hint };
  if (node) module.exports = api; else root.ClickerPrestige = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
