const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scenes, resolve } = require('../../src/clicker-scene.js');
const E = require('../../src/clicker-economy.js');
const Save = require('../../src/clicker-save.js');

test('場景倍率貫穿需求、多包結算與存檔驗證，未解鎖不掛載', () => {
  scenes.test = { ...scenes.backyard, requirementMul:2, unlockPackages:3 };
  try {
    assert.equal(resolve('test',2),scenes.backyard);
    assert.equal(resolve('test',3),scenes.test);
    assert.equal(E.requirement(3,'test'),E.requirement(3)*2);
    const s = Save.fresh(0); s.package.index = 3; s.settings.scene = 'test';
    const power = E.packageSum(3,4,'test') + 10;
    const result = E.advancePackage(s.package,power,'test');
    assert.equal(result.package.index,7);
    assert.ok(Math.abs(result.package.progress-10)<1e-8);
    s.package.progress = E.requirement(3)*1.5;
    assert.equal(Save.validate(s),s);
    s.package.index=2; s.package.progress=0;
    assert.throws(()=>Save.validate(s));
  } finally { delete scenes.test; }
});

test('舊存檔補場景／音樂預設，錯誤設定保留原文並阻擋', () => {
  const s = Save.fresh(0); delete s.settings.music; delete s.settings.scene;
  assert.deepEqual(Save.validate(s).settings,{clickSound:'soft',clickFx:'shard',muted:false,mode:'wish',music:true,scene:'backyard',musicVolume:.6,sfxVolume:.8,autoChallenge:true});
  // 第二十五輪：場景名不認得屬於「這一場的設定壞了」，自動修復會把 settings 重置成預設，
  // 不再擋住整個畫面（養成進度不受影響）。validate 本身照樣要拒絕它。
  s.settings.scene='missing'; const raw=JSON.stringify(s);
  assert.throws(()=>Save.validate(JSON.parse(raw)));
  const store=Save.create({getItem:()=>raw});
  assert.equal(store.blocked,false); assert.equal(store.raw,raw);
  assert.deepEqual(store.repaired.applied,['場景與音量設定']);
  assert.equal(store.state.settings.scene,'backyard');
  s.settings.scene='backyard'; s.settings.music='yes';
  assert.throws(()=>Save.validate(s));
});

test('volume defaults migrate and invalid volume settings are rejected', () => {
  const s=Save.fresh(0); delete s.settings.musicVolume; delete s.settings.sfxVolume;
  assert.equal(Save.validate(s).settings.musicVolume,.6);
  assert.equal(s.settings.sfxVolume,.8);
  for (const value of [-1,1.01,NaN,'0.5']) {
    const bad=Save.fresh(0); bad.settings.musicVolume=value;
    assert.throws(()=>Save.validate(bad));
  }
});
