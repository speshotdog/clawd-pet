const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../src/pure.js');

test('clampScale：壞值回標準、超界夾回', () => {
  assert.equal(P.clampScale('1'), 1);
  assert.equal(P.clampScale('1.15'), 1.15);
  assert.equal(P.clampScale(null), 1);        // localStorage 沒存過
  assert.equal(P.clampScale('abc'), 1);       // 壞掉的值
  assert.equal(P.clampScale('0'), 1);
  assert.equal(P.clampScale('9'), P.SCALE_MAX);
  assert.equal(P.clampScale('-3'), P.SCALE_MIN);
  assert.equal(P.clampScale('0.1'), P.SCALE_MIN);
});

test('decayStats：飽食度掉 0.4，心情看扣完後的飽食度換檔', () => {
  // 飽食度扣完仍 >= 30 → 心情掉 0.25
  assert.deepEqual(P.decayStats({ mood: 70, fullness: 80 }), { fullness: 79.6, mood: 69.75 });
  // 扣完後跨過 30 的門檻 → 這一 tick 就開始掉 0.6
  const hungry = P.decayStats({ mood: 50, fullness: 30.2 });
  assert.equal(hungry.fullness, 29.8);
  assert.equal(hungry.mood, 49.4);
});

test('decayStats：不會掉到負值', () => {
  assert.deepEqual(P.decayStats({ mood: 0.1, fullness: 0.2 }), { fullness: 0, mood: 0 });
});

test('canFeed：熱狗吃太飽會拒絕，愛心不佔肚子', () => {
  assert.equal(P.canFeed({ mood: 50, fullness: 96 }, 'hotdog'), false);
  assert.equal(P.canFeed({ mood: 50, fullness: 95 }, 'hotdog'), true);
  assert.equal(P.canFeed({ mood: 50, fullness: 100 }, 'love'), true);
});

test('feedStats：兩種食物的加成與上限', () => {
  assert.deepEqual(P.feedStats({ mood: 50, fullness: 50 }, 'hotdog'), { fullness: 75, mood: 60 });
  assert.deepEqual(P.feedStats({ mood: 50, fullness: 50 }, 'love'), { fullness: 55, mood: 62 });
  // 兩項都夾在 100
  assert.deepEqual(P.feedStats({ mood: 95, fullness: 90 }, 'hotdog'), { fullness: 100, mood: 100 });
  // 未知種類當熱狗
  assert.deepEqual(P.feedStats({ mood: 0, fullness: 0 }, 'wat'), { fullness: 25, mood: 10 });
});

test('splitShare：餘數歸主視窗，總數守恆', () => {
  // 主視窗獨自一人
  assert.deepEqual(P.splitShare(3, 1), { base: 3, main: 3 });
  // 主視窗 + 2 夥伴，5 件工作 → 夥伴各 1、主視窗 3
  const s = P.splitShare(5, 3);
  assert.deepEqual(s, { base: 1, main: 3 });
  assert.equal(s.main + s.base * 2, 5);
  // 除得盡
  assert.deepEqual(P.splitShare(4, 2), { base: 2, main: 2 });
  // 沒工作
  assert.deepEqual(P.splitShare(0, 4), { base: 0, main: 0 });
  // windows 傳 0 也不能除以零
  assert.deepEqual(P.splitShare(2, 0), { base: 2, main: 2 });
});

test('toggleInList：來回切換且不改動原陣列', () => {
  const orig = ['fox'];
  const added = P.toggleInList(orig, 'yueyue');
  assert.deepEqual(added, { list: ['fox', 'yueyue'], added: true });
  assert.deepEqual(orig, ['fox'], '原陣列不該被改動');
  const removed = P.toggleInList(added.list, 'fox');
  assert.deepEqual(removed, { list: ['yueyue'], added: false });
});

test('hitShape：橢圓命中頭、方框命中軀幹、中間空隙不命中', () => {
  // 熱狗狗狗的形狀
  const dog = { ellipse: [122, 141, 65, 48], box: [49, 191, 180, 254] };
  assert.equal(P.hitShape(dog, 122, 141), true, '橢圓中心');
  assert.equal(P.hitShape(dog, 122, 93), true, '橢圓正上緣（頭頂線）');
  assert.equal(P.hitShape(dog, 122, 92), false, '頭頂線上方 1px');
  assert.equal(P.hitShape(dog, 120, 220), true, '軀幹方框內');
  assert.equal(P.hitShape(dog, 49, 254), true, '方框角落（含邊界）');
  assert.equal(P.hitShape(dog, 5, 250), false, '方框左外側');
  assert.equal(P.hitShape(dog, 200, 100), false, '右上角空白');
});
