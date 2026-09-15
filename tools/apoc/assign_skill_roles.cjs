// 在專案根目錄執行：node tools/apoc/assign_skill_roles.cjs
// build_apoc.py 重建卡池後重新套用技能型別；同名卡依 1.0，新增卡依已審閱的固定表。
const fs=require('fs');global.window=global;require('../../src/apoc/pool.js');const B=require('../../src/clicker-balance.js'),P=require('../../src/gacha-pool.js');
const map={click:'open',clickTime:'open',team:'train',self:'train',reload:'reset',energize:'reset',clickAdd:'coin',burst:'breach',bossDamage:'breach',passive:'idle'};
const roles={rocketdog:'open',alienkitty:'reset',astronaut:'reset',fluffdog:'idle',aomijiapaoxiaoshou:'breach',liulangyueshou:'open',shabaolingzhu:'breach',tiandianaini:'coin',wangyuanmie:'idle',xingyejiao:'idle',zhenjunyue:'reset',zhenqiqiu:'open',zhenzhen:'reset',jintianwoshengri:'coin',jiujixiaochouyueyue:'reset',shanqiulong:'idle',bianbiancaihua:'idle',chengtiregou:'breach',danngaomie:'open',geimieqianhaoma:'coin',xiaochouyue:'reset',xiaojiaojiao:'open',xiawujiaojiao:'idle',yuexiong:'train',jiaochi:'breach',miepuxiong:'idle',pufayueyue:'open',waisongmiege:'coin',ballyellow:'coin',beachball:'reset',dino:'idle',paoshuidahengbao:'idle',keshuishiguang:'reset',zhendebushiwo:'coin'};
for(const c of ApocPool){const id=Object.keys(B.characters).find(i=>P.byId[i]?.name===c.name);c.role=id?map[B.characters[id].kind]:roles[c.id];if(!c.role)throw Error(c.id)}
const path='src/apoc/pool.js';let s=fs.readFileSync(path,'utf8');s=s.replace(/window.ApocPool=.*?;(?=\r?\n)/,'window.ApocPool='+JSON.stringify(ApocPool)+';');fs.writeFileSync(path,s);
fs.mkdirSync('_art/out/apoc-skills',{recursive:true});
fs.writeFileSync('_art/out/apoc-skills/roles.json',JSON.stringify(ApocPool.map(({id,name,rarity,role})=>({id,name,rarity,role})),null,2));
