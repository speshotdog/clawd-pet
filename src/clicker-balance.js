// 第一版數值；抽樣政策唯一來源仍是 GachaPool.GAME_POLICY。
(function (root) {
  const characters = {
    yueyue2: { base: 4, skill: '尾巴節拍', kind: 'click', multiplier: 2, charges: 10, duration: 15, cd: 60 },
    caihua: { base: 4, skill: '龍尾掃袋' },
    lk: { base: 5, skill: '穩穩站好' },
    yang: { base: 5, skill: '數羊開工' },
    dog: { base: 8, skill: '聞到零食' },
    fox: { base: 8, skill: '收拾桌面' },
    jiaobu2: { base: 9, skill: '俐落拆封' },
    zhenzhen2: { base: 10, skill: '綿綿加班' },
    zhenmu: { base: 16, skill: '這個頭我收下了', kind: 'passive', duration: 20, cd: 90 },
    jiaobu: { base: 18, skill: '一刀開封', kind: 'click', multiplier: 10, charges: 1, duration: 15, cd: 45 },
    yueyue: { base: 18, skill: '玥來越快' },
    zhenzhen: { base: 20, skill: '大團圓' },
  };
  const api = { characters, stars: [1, 2, 4, 8, 16], offlineMs: 8 * 3600000,
    modes: ['hearthstone', 'wish', 'summon', 'stage', 'rip'], slotThresholds: [0, 5000, 100000] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClickerBalance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
