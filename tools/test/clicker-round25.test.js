// 第二十五輪：存檔自動修復。
// 2026-09-08 使用者朋友卡在「存檔無法讀取」——而匯入鍵在被 inert 掉的 #stats 裡，
// 拿到修好的存檔也貼不進去，形成死循環。修復要能自己救回來，而且不准動到養成進度。
const assert = require('node:assert');
const { test } = require('node:test');
const S = require('../../src/clicker-save.js');
const E = require('../../src/clicker-economy.js');
const Pool = require('../../src/gacha-pool.js');

// 一份「玩很久」的存檔：卡片、粉塵、升階、超越、印記、徽章、第四技能槽都有東西
function veteran() {
  const s = S.fresh(0);
  s.collection = { zhenmu: 20, yueyue2: 18, dog: 3 };
  s.dust = { zhenmu: 40, yueyue2: 30, dog: 3 };
  s.promotions = { zhenmu: 0 }; s.transcend = {};
  s.partnerLevels = { zhenmu: 40, yueyue2: 25 };
  s.coins = 1e12; s.lifetimeCoins = 5e12; s.clickLevel = 60; s.trainingLevel = 20;
  // marksClaimed 要蓋得住 marks + 祝福累計價（blessing*(blessing+1)/2）+ 印記商店總價
  s.marks = 12; s.marksClaimed = 40; s.prestiges = 3; s.universalDust = 88; s.blessing = 4;
  s.bossWins = ['backyard', 'kitchen']; s.badges = ['pack10', 'pack25', 'boss-backyard'];
  s.skillSlots = ['zhenmu', 'yueyue2', null];
  s.paidDraws = 120; s.pity = { sinceLegendary: 3 };
  return S.validate(s, Pool);
}
// 修復絕對不准動的東西
const SACRED = ['coins','lifetimeCoins','clickLevel','trainingLevel','marks','marksClaimed','prestiges',
                'universalDust','blessing','badges','bossWins','collection','dust','promotions',
                'transcend','partnerLevels','claimedMilestones','markShop','deco','owned','pick100'];

const breakIt = (mutate) => { const s = JSON.parse(JSON.stringify(veteran())); mutate(s); return s; };

test('round25: 各種壞法都修得回來，而且養成進度一項都沒掉', () => {
  const cases = {
    '王包結算牌':   s => { s.bossResult = { scene: 'nope', won: 'yes', crack: 9, at: -1 }; },
    '進行中的王包': s => { s.boss = { scene: 'kitchen', need: -5, dealt: 'x' }; },
    '待收招募':     s => { s.pending = { draw: { entries: [{ entry: { id: 'nobody' } } ] } }; },
    '技能效果':     s => { s.effects = [{ source: 'ghost', kind: '???', expiresAt: 'x' }]; },
    '今日限定包':   s => { s.daily = { date: '亂碼', done: 1, need: -1, dealt: 99, streak: 'x' }; },
    '禮包':         s => { s.gift = { need: 0, dealt: 5, endsAt: 'x' }; s.nextGiftAt = -9; },
    '技能槽':       s => { s.skillSlots = ['nobody', 'nobody', 'nobody']; },
    '拆包進度':     s => { s.package = { index: -1, progress: 'x', shells: [9,9], shellHp: 99, blocked: 'y' }; },
    '設定':         s => { s.settings = { scene: '火星', musicVolume: 99, mode: '???' }; },
    '一次壞好幾塊': s => { s.bossResult = { scene: 'nope' }; s.effects = [{ source: 'ghost' }];
                           s.daily = { date: 'x' }; s.skillSlots = ['nobody', 1, 2]; },
  };
  const base = veteran();
  for (const [name, mutate] of Object.entries(cases)) {
    const broken = breakIt(mutate);
    assert.throws(() => S.validate(JSON.parse(JSON.stringify(broken)), Pool), undefined, `${name}：這份應該是壞的才對`);
    const fixed = S.repair(broken, Pool);
    assert.ok(fixed, `${name}：修不回來`);
    assert.ok(fixed.applied.length, `${name}：沒說自己做了什麼`);
    for (const key of SACRED) {
      assert.deepEqual(fixed.state[key], base[key], `${name}：修復動到了不該動的 ${key}`);
    }
    S.validate(JSON.parse(JSON.stringify(fixed.state)), Pool);   // 修完的那份要真的讀得進去
  }
});

test('round25: 只壞一塊就只賠那一塊，不會把旁邊的一起重置', () => {
  // daily 壞掉不該連還沒收下的招募一起賠進去（累加式修復會，先試單步就不會）
  const broken = breakIt(s => { s.daily = { date: '亂碼', done: 1, need: -1, dealt: 99, streak: 'x' }; });
  const fixed = S.repair(broken, Pool);
  assert.deepEqual(fixed.applied, ['今日限定包']);
  assert.deepEqual(fixed.state.skillSlots, ['zhenmu', 'yueyue2', null]);   // 技能槽沒被清掉
});

test('round25: 買過第四技能槽的存檔，修復後陣列長度要跟著是 4', () => {
  const s = veteran();
  s.markShop = { ...s.markShop, slot4: true };
  s.skillSlots = ['zhenmu', 'yueyue2', null, null]; s.slotReadyAt = [0, 0, 0, 0];
  s.marksClaimed = 999; s.marks = 0;
  const broken = JSON.parse(JSON.stringify(s)); broken.skillSlots = ['nobody', 'nobody', 'nobody', 'nobody'];
  const fixed = S.repair(broken, Pool);
  assert.ok(fixed, '買過第四槽就修不回來了');
  assert.equal(fixed.state.skillSlots.length, 4);
  assert.equal(fixed.state.slotReadyAt.length, 4);
});

test('round25: 真的救不回來的東西不會硬凹成假的存檔', () => {
  assert.equal(S.repair(null, Pool), null);
  assert.equal(S.repair('不是存檔', Pool), null);
  assert.equal(S.repair({}, Pool), null);
  // 養成資料本身壞掉（不在修復表裡）就該老實說修不了，不能把 collection 清掉了事
  const broken = breakIt(s => { s.collection = { nobody: 5 }; });
  assert.equal(S.repair(broken, Pool), null);
});

test('round25: create() 載入壞存檔時自己修好、備份原檔、而且不擋畫面', () => {
  const broken = breakIt(s => { s.bossResult = { scene: 'nope', won: 'yes', crack: 9, at: -1 }; });
  const mem = { [S.KEY]: JSON.stringify(broken) };
  const store = S.create({ getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }, { pool: Pool });
  assert.equal(store.blocked, false, '修得好就不該擋住畫面');
  assert.ok(store.state, '應該要有可以玩的狀態');
  assert.deepEqual(store.repaired.applied, ['王包結算牌']);
  assert.match(store.repaired.reason, /王包結算/);
  assert.equal(mem[S.BROKEN_KEY], JSON.stringify(broken), '原始的壞存檔要原封不動備份起來');
  assert.equal(store.state.coins, veteran().coins);
});

test('round25: 好的存檔照常載入，不會被誤判成要修', () => {
  const good = veteran();
  const mem = { [S.KEY]: JSON.stringify(good) };
  const store = S.create({ getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }, { pool: Pool });
  assert.equal(store.blocked, false);
  assert.equal(store.repaired, null, '沒壞的存檔不該說自己被修過');
  assert.equal(mem[S.BROKEN_KEY], undefined, '沒壞就不該留備份');
});

// ---- 第二十五輪的新神話：玩物就玩物 ----
const B = require('../../src/clicker-balance.js');

test('round25: 玩物就玩物是神話，走 clickAdd 補上這一族的空格', () => {
  const e = Pool.byId.wanwumythic;
  assert.ok(e, '不在卡池');
  assert.equal(e.rarity, 'mythic');
  assert.equal(e.kind, 'char');
  assert.equal(e.src, 'card-wanwumythic.png');
  assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '../../src/', e.src)));
  const def = B.characters.wanwumythic;
  assert.equal(def.kind, 'clickAdd');
  // 神話這格本來是空的：既有 clickAdd 全是史詩起跳，最高 .6
  const others = ['dog','yangpu','zhenpete','foxmoney','seal'].map(id => B.characters[id].ratio);
  assert.ok(def.ratio > Math.max(...others), '神話的 clickAdd 要比史詩那批強');
  // 神話的 base 要跟另外三張同一個量級
  const mythics = Pool.CATALOG.filter(x => x.rarity === 'mythic' && x.kind === 'char').map(x => B.characters[x.id].base);
  assert.equal(mythics.length, 4);
  assert.ok(Math.min(...mythics) >= 30 && Math.max(...mythics) <= 32, `神話 base 應在 30~32：${mythics}`);
  assert.match(def.desc(def), /接下來 30 次點擊各追加 150% 每秒收益/);
});
