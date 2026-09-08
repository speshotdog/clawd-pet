const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Pool = require('../../src/gacha-pool.js'), B = require('../../src/clicker-balance.js');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js');
function seeded(seed) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}
const draw = (rng, pity = 0) => Pool.rollPack({ count:1, policy:Pool.GAME_POLICY, rng, pity, id:'r16', visualSeed:16 });

test('round16: 2000 seeded base draws retain 5% legendary and 30% veil', () => {
  // 每次 pity=0 檢查基礎機率；累積軟硬保底會提高長期傳說比例。
  const rng = seeded(16), counts = { legendary:0, veiled:0, mythic:0 };
  for (let i = 0; i < 2000; i++) {
    const item = draw(rng).draw.entries[0];
    if (item.entry.rarity === 'legendary') counts.legendary++;
    if (item.entry.rarity === 'mythic') counts.mythic++;
    if (item.veil) { counts.veiled++; assert.equal(item.entry.rarity, 'legendary'); }
    else assert.equal(Object.hasOwn(item, 'veil'), false);
    assert.equal(Pool.shownRarity(item), item.veil || item.entry.rarity);
    assert.equal(Object.hasOwn(Pool.byId[item.entry.id], 'veil'), false);
    assert.ok(Object.isFrozen(item));
  }
  assert.ok(Math.abs(counts.legendary / 2000 - .05) <= .012, JSON.stringify(counts));
  assert.ok(Math.abs(counts.veiled / counts.legendary - .3) <= .1, JSON.stringify(counts));
  assert.ok(counts.mythic > 0);
  assert.deepEqual(draw(seeded(16)), draw(seeded(16)));
});

test('round16: veil threshold is exactly .3, only legendary can veil, pity resets', () => {
  for (const [roll, veil] of [[.01,.299999],[.01,.3],[.052,0],[.1,0],[.9,0]]) {
    const values = [roll, 0, veil];
    const item = draw(() => values.shift()).draw.entries[0];
    assert.equal(item.veil, roll === .01 && veil < .3 ? 'rare' : undefined);
    assert.equal(Pool.shownRarity(item), item.veil ? 'rare' : item.entry.rarity);
  }
  for (const pity of [0,29,39]) {
    const result = draw(() => 0, pity);
    assert.equal(result.draw.entries[0].veil, 'rare'); assert.equal(result.nextPity, 0);
  }
});

test('round16: paid/free pending preserves veil through JSON, validates and collects real rarity', () => {
  for (const free of [0,1,5]) {
    let s = S.fresh(0); s.coins = s.lifetimeCoins = 1e6; s.freeDraws = free;
    s = E.purchaseDraw(s, free || 1, 0, Pool, { rng:() => 0, id:'r16', visualSeed:16 });
    s = S.validate(JSON.parse(JSON.stringify(s)), Pool);
    assert.ok(s.pending.draw.entries.every(item => item.veil === 'rare' && item.entry.rarity === 'legendary'));
    const bad = E.clone(s); bad.pending.draw.entries[0].veil = 'epic';
    assert.throws(() => S.validate(bad, Pool), /pending/);
    const original = E.clone(s); original.pending.draw.entries.forEach(item => delete item.veil);
    assert.deepEqual(E.collect(s, 'r16', 0), E.collect(original, 'r16', 0));
  }
  let s = S.fresh(0); s.freeDraws = 1;
  s = E.purchaseDraw(s, 1, 0, Pool, { rng:() => .052, id:'mythic', visualSeed:16 });
  s = E.clone(s);
  s.pending.draw.entries[0].veil = 'rare';
  assert.throws(() => S.validate(s, Pool), /pending/);
});

test('round16: removed character is absent and old progression/slots are cleaned', () => {
  assert.equal(Pool.byId.yuelegend, undefined); assert.equal(B.characters.yuelegend, undefined);
  assert.equal(Pool.CHARACTER_IDS.length, 38);
  const s = S.fresh(0);
  const keys = ['collection','dust','promotions','transcend','partnerLevels','overflow','awakened','cooldownUntil'];
  for (const key of keys) s[key].yuelegend = 1;
  s.skillSlots[0] = 'yuelegend'; s.effects = [{ source:'yuelegend' }];
  S.validate(s, Pool);
  for (const key of keys) assert.equal(Object.hasOwn(s[key], 'yuelegend'), false);
  assert.deepEqual(s.skillSlots, [null,null,null]); assert.deepEqual(s.effects, []);
});

// 小型 DOM + 虛擬時間，實際執行卡片與 runtime，驗證演出先後、取消與摘要。
function harness(reduced = false, count = 1, mode = 'hearthstone', auto = true) {
  let time = 0, nextTimer = 0;
  const timers = new Map(), log = [];
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.style = { setProperty(){}, removeProperty(){} }; this.children = []; this.parts = new Map(); this.classes = new Set();
      this.classList = { add:(...v) => v.forEach(x => this.classes.add(x)), remove:(...v) => v.forEach(x => this.classes.delete(x)), contains:x => this.classes.has(x), toggle:(x,on) => on ? this.classes.add(x) : this.classes.delete(x) };
    }
    set className(value) { this.classes = new Set(value.split(' ')); }
    append(...els) { this.children.push(...els); }
    appendChild(el) { this.append(el); }
    replaceChildren() { this.children = []; }
    insertAdjacentHTML() {}
    querySelector(key) { if (!this.parts.has(key)) this.parts.set(key,new Element()); return this.parts.get(key); }
    querySelectorAll() { return []; }
    getAnimations() { return []; }
    closest() { return null; }
    animate(frames, options) {
      log.push(['animate', time, options.duration]);
      return { finished:new Promise(resolve => context.setTimeout(resolve, options.duration + (options.delay || 0))), cancel(){} };
    }
  }
  const scope = () => ({ createScope:scope, stop(){}, flip(){log.push(['flip',time]);}, reveal(r){log.push([r,time]);}, tick(){log.push(['tick',time]);}, charge(){log.push(['charge',time]);} });
  const window = { GachaPool:Pool, CharacterConfig:{}, addEventListener(){}, GachaAudio:{createScope:scope},
    GachaFx:{ createScope:() => ({ stop(){}, unveil(){log.push(['sparks',time]);} }), reveal(x,y,r){log.push(['fx-'+r,time]);}, rays(){log.push(['rays',time]);return {stop(){}};} } };
  const document = { createElement:() => new Element(), addEventListener(){} };
  const context = { window, document, Event, AbortController, DOMException, matchMedia:() => ({matches:reduced}),
    fetch:async() => ({text:async() => ''}), DOMParser:class { parseFromString(){return {querySelectorAll:() => [{id:'char-placeholder',content:{querySelector:() => new Element()}}]};} },
    Image:class { decode(){return Promise.resolve();} },
    setTimeout(fn,ms){ const id = ++nextTimer; timers.set(id,{fn,at:time+ms}); return id; }, clearTimeout(id){timers.delete(id);} };
  for (const name of ['gacha-card','gacha-mode-runtime']) vm.runInNewContext(fs.readFileSync(require.resolve(`../../src/${name}.js`),'utf8'),context);
  const card = window.GachaCard.create({rarity:Pool.RARITY,byId:Pool.byId,canHover:() => false,fatal:{}});
  const item = {key:'r16:0',entry:Pool.byId.zhenfang,veil:'rare',dup:false,owned:0};
  const host = { card, root:new Element(), cardsEl:new Element(), dim:new Element(), mode, center:{x:0,y:0}, layout:() => ({x:0,y:0,rot:0}),
    onCards(){}, onReveal(){}, state(){}, summary(){log.push(['summary',time]);}, shake(){log.push(['shake',time]);}, charging(on){if(on) log.push(['charging',time]);}, isAuto:() => auto, isFanned:() => true, error(e){throw e;} };
  const entries = Array.from({length:count},(_,i) => ({...item,key:`r16:${i}`}));
  const runtime = window.GachaModeRuntime.create(host,{id:'r16',visualSeed:16,entries});
  const cards = entries.map(it => runtime.ctx.cards.create(it)), c = cards[0];
  async function flush() { for(let i=0;i<30;i++) await Promise.resolve(); }
  async function advanceTo(target) {
    await flush();
    while (true) {
      const next = [...timers].sort((a,b) => a[1].at-b[1].at)[0];
      if (!next || next[1].at > target) break;
      time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
    }
    time = target;
  }
  return {runtime,c,cards,card,host,log,advanceTo};
}

test('round16: common reveal keeps rare frame until sweep midpoint, then full legendary', async () => {
  const h = harness(); await h.card.ready;
  assert.ok(h.c.el.classList.contains('r-rare')); assert.equal(h.c.el.querySelector('.face-rarity').textContent,'精良');
  const done = h.runtime.ctx.cards.reveal('r16:0');
  await h.advanceTo(1079);
  assert.ok(h.c.el.classList.contains('veiled')); assert.equal(h.log.some(([name]) => ['charging','charge','rays','legendary'].includes(name)),false);
  await h.advanceTo(1400); assert.ok(h.c.el.classList.contains('unveiling'));
  await h.advanceTo(1609); assert.ok(h.c.el.classList.contains('r-rare'));
  await h.advanceTo(1610); assert.ok(h.c.el.classList.contains('r-legendary')); assert.equal(h.c.el.querySelector('.face-rarity').textContent,'傳說');
  await h.advanceTo(1820); assert.ok(h.log.some(([name]) => name === 'sparks'));
  await h.advanceTo(3000); await done;
  assert.deepEqual(h.log.filter(([name]) => ['rare','legendary'].includes(name)),[['rare',290],['legendary',1820]]);
  assert.ok(h.log.some(([name]) => name === 'summary'));
});

test('round16: reduced motion and reveal-all preserve conversion; skip cancels sweep', async () => {
  const h = harness(true); await h.card.ready;
  h.runtime.all(); await h.advanceTo(2500);
  assert.ok(h.c.el.classList.contains('r-legendary'));
  assert.equal(h.log.some(([name]) => ['tick','sparks','shake'].includes(name)),false);
  assert.ok(h.log.some(([name]) => name === 'legendary'));
  const cancel = harness(); await cancel.card.ready;
  const pending = cancel.runtime.ctx.cards.reveal('r16:0'); const rejected = assert.rejects(pending,{name:'AbortError'});
  await cancel.advanceTo(1500); cancel.runtime.skip(); await rejected; await cancel.advanceTo(3000);
  assert.ok(cancel.c.el.classList.contains('r-legendary'));
  assert.equal(cancel.c.el.classList.contains('unveiling'),false);
  assert.equal(cancel.log.some(([name]) => name === 'legendary'),false);
});

test('round16: manual wish reveal-all completes all five conversions without skipping timing', async () => {
  const h = harness(false, 5, 'wish', false); await h.card.ready;
  h.runtime.all(); await h.advanceTo(15000);
  assert.ok(h.cards.every(c => c.el.classList.contains('r-legendary') && !c.el.classList.contains('veiled')));
  for (const name of ['rare','tick','sparks','legendary']) assert.equal(h.log.filter(([n]) => n === name).length,5);
  assert.equal(h.log.filter(([n]) => n === 'summary').length,1);
  const legends = h.log.filter(([n]) => n === 'legendary');
  assert.ok(legends.every(([,at],i) => !i || at - legends[i-1][1] >= 2800));
});
