const test = require('node:test');
const assert = require('node:assert/strict');
global.window=global; require('../../src/apoc/pool.js');
const A=require('../../src/clicker-apoc-economy.js');
const card=(role,rarity='epic')=>ApocPool.find(c=>c.role===role&&c.rarity===rarity).id;
const setup=(role,rarity='epic',boss=false)=>{
 const id=card(role,rarity); let a=A.normalize({...A.fresh(),unlocked:true,collection:{[id]:1},roster:[id],skills:[id,null,null,null],progress:boss?15:0});
 a=A.fight(a,0); a.stage={...a.stage,need:1e8,hp:1e8}; return a;
};
const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-6,`${x} != ${y}`);
test('role：71 張、40 張同名依 1.0 對映、四階各含六型，開門禮 open',()=>{
 const B=require('../../src/clicker-balance.js'),P=require('../../src/gacha-pool.js');
 const map={click:'open',clickTime:'open',team:'train',self:'train',reload:'reset',energize:'reset',clickAdd:'coin',burst:'breach',bossDamage:'breach',passive:'idle'};
 assert.equal(ApocPool.length,71);let matched=0;
 for(const c of ApocPool){const id=Object.keys(B.characters).find(id=>P.byId[id]?.name===c.name);if(id){assert.equal(c.role,map[B.characters[id].kind]);matched++}}
 assert.equal(matched,40);
 for(const rarity of ['mythic','legendary','epic','rare']) assert.equal(new Set(ApocPool.filter(c=>(c.rarity==='common'?'rare':c.rarity)===rarity).map(c=>c.role)).size,6);
 assert.equal(ApocPool.find(c=>c.id==='pufayueyue').role,'open');
});
test('open：12 下 ×8，抵抗是在實際點擊時套用；跨站不漏掉',()=>{
 let a=setup('open','mythic'),base=A.tapDamage(a,0);a=A.useSkill(a,0,0);close(A.tapDamage(a,0),base*8);
 a.stage.boss=true;a.stage.mech=3;close(A.tapDamage(a,0),base*6);
 for(let i=0;i<12;i++)a=A.tap(a,0);assert.equal(a.fx.clickLeft,0);close(A.tapDamage(a,0),base);
});
test('train：20 秒提升戰力，跨到期時間的放置按段積分',()=>{
 let a=setup('train'),base=A.power(a);a=A.useSkill(a,0,0);close(A.powerMul(a,19999),1.5);close(A.powerMul(a,20000),1);
 close(a.stage.hp-A.settle(a,21000,2).state.stage.hp,base*2.5);
});
test('reset：精良 −6 秒，自己 45 秒，其他格不低於現在',()=>{
 let a=setup('reset','rare');a.skillCd=[0,50000,100,50000];a=A.useSkill(a,0,1000);assert.deepEqual(a.skillCd,[46000,44000,1000,44000]);
});
test('coin：額外金幣入帳；王關用前站 reward；到期及死敵不刷幣',()=>{
 for(const boss of [false,true]){let a=setup('coin','epic',boss);a=A.useSkill(a,0,0);const delta=A.reward(boss?14:0,a)*.006;
 close(A.tap(a,1).coins-a.coins,delta);assert.equal(A.coinGain(a,20000),0);a.stage.hp=0;assert.equal(A.coinGain(a,1),0);assert.equal(A.tap(a,1),a);}
});
test('breach：一般关所有傷害 ×2，王关时间 0.6；第三次只 ×1.3 三秒',()=>{
 let a=setup('breach'),d=A.tapDamage(a,0),p=A.power(a);a=A.useSkill(a,0,0);assert.equal(a.stage.breakUntil,10000);close(A.tapDamage(a,0),d*2);close(a.stage.hp-A.settle(a,1000,1).state.stage.hp,p*2);
 a=setup('breach','epic',true);a=A.useSkill(a,0,0);assert.equal(a.stage.breakUntil,6000);
 for(const t of [10000,20000]){a.skillCd=[0,0,0,0];a=A.useSkill(a,0,t)}
 assert.equal(a.stage.skillBreaks,3);assert.equal(a.stage.breakUntil,16000);assert.equal(a.stage.breachFallbackUntil,23000);
 close(A.tapDamage(a,20000)/A.tapDamage(a,23000),1.3);
 const normalized=A.normalize(a);assert.equal(normalized.stage.skillBreaks,3);
});
test('抵抗限制只算技能：機制部位破防不消耗兩次額度',()=>{
 let a=setup('breach','epic',true);a.stage.skillBreaks=2;
 for(let i=0;i<4;i++)a=A.tap(a,100,{part:a.stage.order.seq[a.stage.order.step]});
 assert.equal(a.stage.breakUntil,8100);assert.equal(a.stage.skillBreaks,2);
});
test('idle：15 秒狂熱，機制 .35 提升為 1；跨到期放置切段',()=>{
 let a=setup('idle','epic',true),p=A.power(a);a=A.useSkill(a,0,0);
 close(a.stage.hp-A.settle(a,1000,1).state.stage.hp,p);
 close(a.stage.hp-A.settle(a,16000,2).state.stage.hp,p*1.35);
 const ordinary=setup('idle');close(ordinary.stage.hp-A.settle(A.useSkill(ordinary,0,0),1000,1).state.stage.hp,A.power(ordinary)/.35);
});
test('TAP_CAP：點擊最後才套一般 .10、王 .04，浮字記實際剩血',()=>{
 for(const boss of [false,true]){let a=setup('open','mythic',boss);a.teamLevel=200;a.clickLevel=100;a.stage.breakUntil=10000;a=A.useSkill(a,0,0);a.fx.powerMul=2;a.fx.powerUntil=10000;
 const cap=a.stage.need*(boss?.04:.10);assert.equal(A.tapDamage(a,0),cap);const hit=A.tap(a,0);close(a.stage.hp-hit.stage.hp,cap);assert.equal(hit.lastHit.capped,true);
 a.stage.hp=5;const dead=A.tap(a,0);assert.equal(dead.lastHit.damage,5);assert.equal(A.tap(dead,0),dead);}
});
test('TAP_CAP：放置每秒封頂，分段結算等價，機制 ×3×2 仍不穿盾',()=>{
 for(const boss of [false,true]){let a=setup('idle','mythic',boss);a.teamLevel=200;a.stage.breakUntil=10000;a=A.useSkill(a,0,0);
 const cap=a.stage.need*(boss?.04:.10),whole=A.settle(a,2000,2).state;close(a.stage.hp-whole.stage.hp,cap*2);
 let split=a;for(let i=1;i<=8;i++)split=A.settle(split,i*250,.25).state;close(split.stage.hp,whole.stage.hp);}
 let a=setup('open','mythic',true);a.stage.mech=2;a.stage.breakUntil=10000;a.teamLevel=200;assert.equal(A.tapDamage(a,0),a.stage.need*.04);
});
test('推薦依 role 選隊上最高戰力、數字 tooltip 與王關抵抗',()=>{
 const ids=ApocPool.map(c=>c.id);let a=A.normalize({...A.fresh(),unlocked:true,collection:Object.fromEntries(ids.map(id=>[id,1])),roster:[card('open','rare'),card('open','mythic'),card('train'),card('breach'),card('reset')]});
 const r=A.recommendTeam(a,0);assert.deepEqual(r.skills.map(id=>ApocPool.find(c=>c.id===id).role),['train','breach','open','reset']);assert.equal(r.skills[2],card('open','mythic'));
 assert.match(A.skillInfo(card('open','mythic'),{boss:true}).text,/抵抗，×6/);assert.match(A.skillInfo(card('breach'),{boss:true}).text,/6 秒/);
});

test('回顧一般關：normalize 保留技能破防，換站不帶王關次數',()=>{
 let a=setup('breach');a.progress=2;a.stage=null;a=A.revisit(a,100,0,{walk:false});a=A.useSkill(a,0,100);
 a=A.normalize(a);assert.equal(a.stage.breakUntil,10100);close(A.tapDamage(a,101),A.power(a)*A.RULES.CLICK_SHARE*2);
});
