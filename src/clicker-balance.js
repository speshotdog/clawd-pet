// 第一版數值；抽樣政策唯一來源仍是 GachaPool.GAME_POLICY。
(function (root) {
  const characters = {
    yueyue2: { base: 4, skill: '尾巴節拍', desc: '接下來 10 次點擊 ×2（15 秒內用完）・冷卻 60 秒', kind: 'click', multiplier: 2, charges: 10, duration: 15, cd: 60 },
    caihua: { base: 4, skill: '龍尾掃袋', desc: '立即獲得自身每秒收益 ×20 的拆包力・冷卻 45 秒' },
    lk: { base: 5, skill: '穩穩站好', desc: '自身收益 ×3，持續 20 秒・冷卻 90 秒' },
    yang: { base: 5, skill: '數羊開工', desc: '全隊每秒額外 +20% 常態收益，持續 30 秒・冷卻 120 秒' },
    dog: { base: 8, skill: '聞到零食', desc: '接下來 20 次點擊各追加 50% 每秒收益（20 秒內用完）・冷卻 90 秒' },
    fox: { base: 8, skill: '收拾桌面', desc: '立即獲得每秒收益 ×15 的拆包力・冷卻 120 秒' },
    jiaobu2: { base: 9, skill: '俐落拆封', desc: '接下來 5 次點擊 ×4（15 秒內用完）・冷卻 75 秒' },
    zhenzhen2: { base: 10, skill: '綿綿加班', desc: '自身收益 ×4，持續 30 秒・冷卻 120 秒' },
    zhenmu: { base: 16, skill: '這個頭我收下了', desc: '複製常態收益最高的另一位夥伴的每秒收益，持續 20 秒・冷卻 90 秒', kind: 'passive', duration: 20, cd: 90 },
    jiaobu: { base: 18, skill: '一刀開封', desc: '下一次點擊 ×10（15 秒內使用）・冷卻 45 秒', kind: 'click', multiplier: 10, charges: 1, duration: 15, cd: 45 },
    yueyue: { base: 18, skill: '玥來越快', desc: '所有點擊 ×3，持續 12 秒・冷卻 90 秒' },
    zhenzhen: { base: 20, skill: '大團圓', desc: '全隊每秒額外 +50% 常態收益，持續 20 秒・冷卻 120 秒' },
  };
  const api = { characters, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
