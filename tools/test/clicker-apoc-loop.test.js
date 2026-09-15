const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.ApocPool = [{id:'pufayueyue',name:'玥',rarity:'rare',role:'reset'},{id:'open',name:'開',rarity:'mythic',role:'open'}];
const A=require('../../src/clicker-apoc-economy.js'),R=A.RULES;
const state=(mutations=[])=>({...A.gift(A.fresh()),unlocked:true,laps:1,mutations,baseMutations:[...mutations]});
const won=(a,i,at=1000)=>{a=A.fight({...a,progress:i,stage:null,cooldownUntil:0},at);a.stage.hp=0;a.stage.wave=a.stage.waves;return A.settle(a,at+1000,1,()=>0);};
test('loop: draws are unique, counts 1/2/3, positives occupy a slot',()=>{
 for(const lap of [1,2,4,5,10]) { const a=A.replay({...state(),laps:lap-1,cleared:true},1000,()=>.999);assert.equal(a.mutations.length,lap===1?1:lap<5?2:3);assert.equal(new Set(a.mutations).size,a.mutations.length);assert.equal(a.mutations[0],'echo'); }
 assert.equal(A.drawMutations(30,[],()=>0).length,10);assert.equal(R.MUTATIONS.filter(m=>m.positive).length,2);
});
test('loop: thick only changes boss HP; haste keeps the purchased 15 seconds',()=>{
 const a=state(),b=state(['thick','haste']);assert.equal(A.need(0,a),A.need(0,b));assert.equal(A.need(3,b),Math.round(A.need(3,a)*1.3));
 assert.equal(A.bossTimeOf(b),45000);assert.equal(A.bossTimeOf({...b,boost:{bossTime:true}}),60000);
 assert.equal(A.fight({...b,progress:3},1000).stage.deadline,46000);
});
test('loop: pack has 8 dogs and respawns 4, including after normalization',()=>{
 let a=A.fight({...state(['pack']),progress:3},1000);assert.equal(a.stage.minions.left,8);a=A.normalize(a);assert.equal(a.stage.minions.left,8);
 a.stage.minions={...a.stage.minions,left:0,hp:0,nextAt:2000};a=A.settle(a,2000,0).state;assert.equal(a.stage.minions.left,4);
});
test('loop: shell adds a real fourth shell at 25%, does not mutate shared rules',()=>{
 let a=A.fight({...state(['shell']),progress:7,teamLevel:100},1000);assert.deepEqual(A.mechRules(a).SHELL.AT,[.75,.5,.25,.25]);
 a.stage.hp=a.stage.need*.25;a.stage.shell={layer:2,hp:1};a=A.tap(a,1100);assert.equal(a.stage.shell.layer,3);assert.ok(a.stage.shell.hp>0);
 for(let i=0;i<4&&a.stage.shell.hp>0;i++) a=A.tap(a,1200+i);
 assert.equal(a.stage.shell.layer,4);assert.equal(a.stage.shell.hp,0);assert.deepEqual(R.BOSS_MECH.SHELL.AT,[.75,.5,.25]);
});
test('loop: offbeat changes actual hit window',()=>{
 const plain=A.fight({...state(),progress:11},1000),off=A.fight({...state(['offbeat']),progress:11},1000);
 assert.equal(A.tapMul(plain.stage,1170),3);assert.equal(A.tapMul(off.stage,1170),.5);
});
test('loop: lock / echo scale skill cooldown, including together',()=>{
 for(const [ms,k] of [[['lock'],1.25],[['echo'],.8],[['lock','echo'],1]]) { let a=state(ms);a.skills=['pufayueyue',null,null,null];a=A.useSkill(a,0,1000);assert.equal(a.skillCd[0]-1000,45000*k); }
});
test('loop: famine/harvest rewards, doubled ticket chance, waste idle only',()=>{
 assert.equal(A.reward(0,state(['famine'])),Math.round(A.reward(0,state())*.7));assert.equal(A.reward(0,state(['harvest'])),A.reward(0,state())*1.5);
 const make=ms=>({...state(ms),collection:{pufayueyue:1,open:1},dispatch:[{id:'open',until:1000}],tickets:0});
 assert.equal(A.collectDispatch(make([]),1000,()=>.2).rewards[0].ticket,0);assert.equal(A.collectDispatch(make(['harvest']),1000,()=>.2).rewards[0].ticket,1);
 const a=A.fight(state(),1000),b=A.fight(state(['waste']),1000);
 assert.equal(A.tapDamage(a,1001),A.tapDamage(b,1001));assert.equal(a.stage.hp-A.settle(a,2000,1).state.stage.hp,2*(b.stage.hp-A.settle(b,2000,1).state.stage.hp));
});
test('loop: replay halves coins into purse, retains collection, resets training',()=>{
 const a={...state(),cleared:true,coins:200001,teamLevel:7};const b=A.replay(a,1000,()=>0);
 assert.equal(b.purse,100000);assert.equal(b.coins,0);assert.equal(b.teamLevel,0);assert.deepEqual(a.collection,b.collection);assert.equal(b.lapStartedAt,1000);
});
test('loop: reroll spends purse first then coins, only before first battle',()=>{
 const a={...state(['thick']),purse:60000,coins:30000},b=A.rerollMutations(a,1000,()=>.9);
 assert.equal(b.purse,0);assert.equal(b.coins,10000);assert.equal(b.rerolled,false);assert.equal(a.purse,60000);
 for(const patch of [{stage:{}},{progress:1},{purse:0,coins:79999},{laps:0}])assert.throws(()=>A.rerollMutations({...a,...patch},1000));
});
test('loop: three failures swap once; six failures drop once independently',()=>{
 let a={...state(['thick','haste']),progress:3,bossStreak:{index:3,fails:2}};assert.throws(()=>A.swapMutation(a,'thick'));
 a.bossStreak.fails=3;let b=A.swapMutation(a,'thick',()=>0);assert.ok(!b.mutations.includes('thick'));assert.equal(b.mutations.length,2);assert.throws(()=>A.swapMutation(b,'haste'));
 assert.throws(()=>A.dropMutation(b,'haste'));b.bossStreak={index:3,fails:6};b=A.dropMutation(b,'haste');assert.equal(b.mutations.length,1);assert.throws(()=>A.dropMutation(b,b.mutations[0]));
 assert.throws(()=>A.swapMutation({...a,progress:7},'thick'));assert.throws(()=>A.swapMutation({...a,stage:{boss:true}},'thick'));
});
test('loop: real boss failures accumulate, farming preserves, victory clears',()=>{
 let a={...state(['thick']),progress:3};for(let i=1;i<=3;i++){a=A.fight({...a,cooldownUntil:0},i*100000);a=A.settle(a,i*100000+60000,0).state;assert.equal(a.bossStreak.fails,i);}
 const farm=A.fight(a,400000,true);assert.equal(A.settle(farm,400001,0).state.bossStreak.fails,3);
 const b=won(a,3).state;assert.deepEqual(b.bossStreak,{index:null,fails:0});
});
test('loop: chest floor, per-lap / total caps, lap zero no chest, no replay award',()=>{
 assert.equal(A.lapChest({...state(['thick','haste','lock']),lapPlayMs:1}),3);
 assert.equal(A.lapChest({...state(['thick']),lapPlayMs:1200000}),1);
 assert.equal(A.lapChest({...state(['thick','haste']),lapChest:29}),1);
 assert.equal(A.lapChest({...state(),laps:0}),0);
 let a=won({...state(['thick','haste']),laps:3},19).state;assert.equal(a.lapChest,3);assert.equal(a.lapLog[0].dust,3);assert.ok(a.cosmetics.owned.includes('loop3'));
 assert.equal(A.settle(a,9999,1).state.lapChest,3);assert.equal(A.lapChest(a),0);
 const z=won({...state(),laps:0},19).state;assert.equal(z.lapChest,0);assert.equal(z.lapLog.length,1);
 assert.throws(()=>A.buyCosmetic(state(),'loop3'));
});
test('loop: endless adds after 30/40, restores base, cannot farm repeated toggle rewards',()=>{
 let a=A.setEndless({...state(['thick']),cleared:true,progress:20},true);a=won(a,29).state;assert.equal(a.mutations.length,2);assert.equal(a.endlessMutationAt,30);
 a=won(a,39).state;assert.equal(a.mutations.length,3);a=A.setEndless(a,false);assert.deepEqual(a.mutations,['thick']);assert.equal(a.endlessMutationAt,40);
 a=A.setEndless(a,true);assert.deepEqual(a.mutations,['thick']);
});
test('loop: normalize legacy defaults and corrupted fields',()=>{
 const a=A.normalize({});for(const k of ['mutations','baseMutations','lapLog'])assert.deepEqual(a[k],[]);
 for(const k of ['purse','lapPlayMs','lapChest','lapBossFails'])assert.equal(a[k],0);assert.deepEqual(a.bossStreak,{index:null,fails:0});
 const b=A.normalize({...state(),mutations:['thick','bad','thick'],purse:Infinity,lapLog:[null,{lap:1,seconds:-1,dust:99}],lapChest:99});assert.deepEqual(b.mutations,['thick']);assert.equal(b.purse,0);assert.equal(b.lapChest,30);assert.equal(b.lapLog[0].dust,3);
});
test('loop: dynamic counter recommendation does not change lap zero templates',()=>{
 assert.equal(A.recommendations(state()).length,A.RECOMMENDATIONS.length);
 assert.deepEqual(A.recommendations(state(['thick','haste']))[0].pattern,['breach','open','train','reset']);
});
test('loop: waste halves offline kills without changing passive coin rate; absent stages do not add lap time',()=>{
 const a={...state(),teamLevel:50,seenAt:1000},b={...a,mutations:['waste']};
 const x=A.offline(a,3601000).events[0],y=A.offline(b,3601000).events[0];assert.equal(y.kills,Math.floor(x.kills/2));
 assert.equal(A.settle({...a,lapPlayMs:100},5000,2).state.lapPlayMs,100);
});
test('loop: completing all ten laps cannot exceed thirty chest dust',()=>{
 let a={...state(['thick','haste','lock']),lapChest:0};
 for(let lap=1;lap<=10;lap++){ a=won({...a,laps:lap,cleared:false,lapPlayMs:0,mutations:['thick','haste','lock']},19).state;assert.equal(a.lapChest,lap*3); }
 assert.equal(a.lapChest,30);assert.equal(A.lapChest(a),0);
});
