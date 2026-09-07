const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const Pool = require('../../src/gacha-pool.js'), B = require('../../src/clicker-balance.js');
const E = require('../../src/clicker-economy.js'), S = require('../../src/clicker-save.js'), X = require('../../src/clicker-extras.js');
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} ~= ${b}`);
const roll = (x, pity=0, policy=Pool.GAME_POLICY) => Pool.rollPack({count:1,policy,pity,rng:()=>x,id:'r15',visualSeed:15});
const raised = id => { const s=S.fresh(0); s.collection[id]=16; s.dust[id]=100; return s; };

test('round15: 22 characters, nine PNG assets and rare yuelegend alias', () => {
  assert.equal(Pool.CHARACTER_IDS.length,22); assert.equal(Object.keys(B.characters).length,22);
  assert.equal(Pool.RARITY_ORDER[0],'mythic'); assert.equal(Pool.RARITY.mythic.label,'神話');
  const png=Pool.CATALOG.filter(e=>e.kind==='char' && e.src); assert.equal(png.length,9);
  for(const e of png) assert.ok(fs.existsSync(new URL(`../../src/${e.src}`,`file://${__filename.replaceAll('\\','/')}`)));
  assert.equal(Pool.byId.yuelegend.art,'yueyue'); assert.equal(Pool.byId.yuelegend.rarity,'rare'); assert.equal(Pool.byId.yuelegend.src,undefined);
});
test('round15: weights total 1000, exact stratified base rates 69.5/25/5/0.5', () => {
  assert.equal(Object.values(Pool.GAME_POLICY.weights).reduce((a,b)=>a+b),1000);
  const counts={rare:0,epic:0,legendary:0,mythic:0};
  for(let i=0;i<1000;i++) counts[roll((i+.5)/1000).draw.entries[0].entry.rarity]++;
  assert.deepEqual(counts,Pool.GAME_POLICY.weights);
});
test('round15: soft/hard pity retain mythic .5%, legendary-or-higher resets pity', () => {
  for(const pity of [0,29,30,38,39]) {
    let mythics=0;
    for(let i=0;i<1000;i++) { const r=roll((i+.5)/1000,pity), rarity=r.draw.entries[0].entry.rarity;
      if(rarity==='mythic') mythics++;
      if(Pool.rank(rarity)<=Pool.rank('legendary')) assert.equal(r.nextPity,0);
      if(pity===39) assert.ok(['legendary','mythic'].includes(rarity));
    }
    assert.equal(mythics,5);
  }
  const policy={...Pool.GAME_POLICY, pity:{unit:'pack',hard:1},packMinRarity:'epic'};
  assert.equal(roll(.052,0,policy).draw.entries[0].entry.rarity,'mythic');
  assert.equal(roll(.052,0,policy).nextPity,0);
});
test('round15: explicit origin tiers, mythic 5.5 tier and .20 transcend growth', () => {
  const s=raised('yueyuexian'); assert.equal(E.origin('yueyuexian'),3); assert.equal(E.rarity(s,'yueyuexian'),'mythic');
  near(E.individual(s,'yueyuexian'),30*2*5.5/5.5);
  const t=E.transcend(s,'yueyuexian',0); near(E.individual(t,'yueyuexian'),72);
  near(B.skillAt('yueyuexian',1,2).ratio,1.14); near(B.skillAt('zhenzhen',1,2).ratio,.55);
  assert.equal(E.origin('zhenfang'),2); assert.equal(E.origin('mianhua'),1); assert.equal(E.origin('yuelegend'),0);
});
test('round15: promotion stops at legendary, mythic can transcend five times', () => {
  for(const id of ['zhenfang','yueyuexian']) assert.throws(()=>E.promote(raised(id),id,0));
  let s=raised('yuelegend'); s=E.promote(s,'yuelegend',0); s=E.promote(s,'yuelegend',0);
  assert.equal(E.rarity(s,'yuelegend'),'legendary'); assert.throws(()=>E.promote(s,'yuelegend',0));
  s=raised('yueyuexian'); for(let i=0;i<5;i++) s=E.transcend(s,'yueyuexian',0);
  assert.equal(s.awakened.yueyuexian,true); near(E.individual(s,'yueyuexian'),120);
  assert.throws(()=>E.transcend(s,'yueyuexian',0)); S.validate(s,Pool);
});
test('round15: mythic exchange costs six universal dust and overflow pays two', () => {
  let s=raised('yueyuexian'); s.universalDust=13;
  assert.equal(E.exchangeRate('yueyuexian'),2*E.exchangeRate('zhenfang'));
  s=E.exchange(s,'yueyuexian',13,0); assert.equal(s.universalDust,1); assert.equal(s.dust.yueyuexian,102);
  for(let i=0;i<5;i++) s=E.transcend(s,'yueyuexian',0);
  s.coins=1e6; s.lifetimeCoins=1e6;
  s=E.purchaseDraw(s,1,0,Pool,{rng:()=>.052,id:'overflow',visualSeed:1});
  s=E.collect(s,'overflow',0).state; assert.equal(s.universalDust,3); assert.equal(s.overflow.yueyuexian,0); S.validate(s,Pool);
});
test('round15: 22-character save and stacked new bonds survive active snapshots', () => {
  let s=S.fresh(0); s.lifetimeCoins=1e6;
  s.collection=Object.fromEntries(Pool.CHARACTER_IDS.map(id=>[id,16]));
  s.skillSlots=['lk','yangpu','yueyuexian'];
  near(E.skillAt(s,'lk').duration,28*1.25*1.25);
  assert.equal(E.skillAt(s,'yangpu').charges,30);
  for(let i=0;i<3;i++) s=E.activate(s,i,0).state;
  assert.equal(s.chain.expiresAt,12000); S.validate(E.clone(s),Pool);
});
test('round15: old saves gain progression defaults without granting characters', () => {
  const old=S.fresh(0); old.collection.yueyue2=1;
  const s=S.validate(old,Pool);
  for(const id of Pool.CHARACTER_IDS.filter(id=>!B.originalIds.includes(id))) {
    assert.equal(s.collection[id] || 0,0);
    for(const key of ['dust','promotions','transcend','partnerLevels']) assert.equal(s[key][id],0);
  }
  assert.deepEqual(Object.keys(s.collection),['yueyue2']); S.validate(E.clone(s),Pool);
});
test('round15: pending mythic resets save pity on paid and free draw paths', () => {
  for(const free of [0,1,5]) {
    let s=S.fresh(0); s.coins=1e6; s.lifetimeCoins=1e6; s.freeDraws=free;
    s=E.purchaseDraw(s,free || 1,0,Pool,{rng:()=>.052,id:`free${free}`,visualSeed:1});
    assert.equal(s.pity.sinceLegendary,0); S.validate(s,Pool);
    s.pity.sinceLegendary=1; assert.throws(()=>S.validate(s,Pool));
  }
});
test('round15: hundred-pack selection stays at the original twelve', () => {
  const s=S.fresh(0); s.badges=['pack100']; assert.equal(B.originalIds.length,12);
  for(const id of B.originalIds) assert.equal(X.pick100(s,id).pick100,id);
  assert.throws(()=>X.pick100(s,'yuelegend')); assert.throws(()=>X.pick100(s,'yueyuexian'));
});
test('round15: card art creates PNG and yuelegend uses the original SVG/config', async () => {
  const element = tag => ({tag,style:{},removeAttribute(){},querySelector(){return null;},querySelectorAll(){return [];}});
  const svg=element('svg'), cfg={height:170};
  const document={createElement:element,importNode:()=>element('svg'),addEventListener(){}};
  const window={CharacterConfig:{yueyue:cfg},addEventListener(){}};
  const context={window,document,fetch:async()=>({text:async()=>''}),DOMParser:class {parseFromString(){return {querySelectorAll:()=>[{id:'char-yueyue',content:{querySelector:()=>svg}}]};}},Image:class {decode(){return Promise.resolve();}}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/gacha-card.js'),'utf8'),context);
  const card=window.GachaCard.create({rarity:Pool.RARITY,byId:Pool.byId,fatal:{},canHover:()=>false}); await card.ready;
  assert.equal(card.art.create(Pool.byId.yuelegend).tag,'svg'); assert.equal(card.art.cfg('yuelegend'),cfg);
  const png=card.art.create(Pool.byId.yueyuexian); assert.equal(png.tag,'img'); assert.equal(png.src,'card-yueyuexian.png'); assert.equal(card.art.cfg('yueyuexian'),null);
});
