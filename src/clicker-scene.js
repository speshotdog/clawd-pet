(function (root) {
  // 2026-09-06 數值重整：rewardMul 從「與需求同倍率」改成 1.5／2／2.5／3／3.5。同倍率時新場景只需再長 ×3 就到王，
  // 一個場景五分鐘就過；需求倍率改 1／8／64／500／2000／12000，每個場景約需 ×20 的養成成長（≈4.4 次翻倍）；一夜離線約 ×10～20，所以大約「一個場景＝一段遊玩或一夜」。
  const sprites = (kind, n) => Array.from({ length: n }, (_, i) => `clicker-scene1-${kind}-${i}.png`);
  const scenes = {
    backyard: {
      thief: { sprite:'monster-0.png', everyMs:[60000,120000], hits:5, reward:20 },
      name: '後院草地', unlockPackages: 0, requirementMul: 1, rewardMul: 1, bagSkin: 0,
      unlock: null, enemy: { shell: null, timer: null, regen: null }, affinity: ['yueyue2','caihua'],
      // mul 是「玩家 30 秒容量（被動＋每秒 6 點）」的倍數（見 economy.startBoss），不再是包需求的倍數
      boss: { name: '大罐頭', mul: 1.25, seconds: 30, crackKeep: .5, crackMax: .75, cooldown: 30, reward: { freeDraws: 5 } },
      palette: { mat: '#8FA56E', sky: '#CFE7F5' },
      music: { theme: 'picnic', seed: 'zhenmu-backyard-1', gen: { density: 45, rhythm: 40, speed: 35, drama: 30, mood: 70, hook: 60, smooth: 65 } },
      layers: [
        { id: 'sky', src: 'clicker-scene1-sky.png', y: 0, h: 360, parallax: 0 },
        { id: 'clouds', sprites: sprites('cloud', 2), slots: [[30,0],[470,4]], h: 52, drift: [6,9], parallax: .2 },
        { id: 'far', src: 'clicker-scene1-far.png', y: 130, h: 150, parallax: .35 },
        { id: 'tree', src: 'clicker-scene1-tree-trunk.png', x: 20, y: 60, h: 240, w: 120, parallax: .5,
          canopy: sprites('canopy', 3), canopySlots: [[-25,49,96,118],[15,79,120,130],[67,22,88,118]], sway: { amp: 1.6, stiff: .6 } },
        { id: 'mid', src: 'clicker-scene1-mid.png', y: 200, h: 110, parallax: .55 },
        { id: 'ground', src: 'clicker-scene1-ground.png', y: 220, h: 140, parallax: .8 },
        { id: 'flowers', sprites: sprites('flower', 5), slots: [[70,300],[470,304],[560,298]], h: 64, sway: { amp: 5, stiff: .9 }, parallax: .9 },
        { id: 'grass', sprites: sprites('grass', 5), slots: [[45,316],[140,322],[475,316],[560,322]], h: 56, sway: { amp: 7, stiff: 1.1 }, parallax: 1 },
        { id: 'props', sprites: ['clicker-scene1-prop-0.png'], slots: [[548,214]], h: 60, parallax: .7 },
      ],
      particles: { sprites: sprites('particle', 2), everyMs: [1500,3200], max: 6, size: [10,16], life: [5,9] },
    },
  };
  scenes.kitchen = {
    name: '廚房流理台', unlockPackages: 0, requirementMul: 8, rewardMul: 1.5, bagSkin: 1,
    unlock: { packages: 50, boss: 'backyard' }, enemy: { shell: [.75,.5,.25], timer: null, regen: null }, affinity: ['zhenzhen2','fox'],
    boss: { ...scenes.backyard.boss, mul:1.25, reward: { freeDraws: 5 } },
    palette: { mat: '#B9A58A', sky: '#F3E7D3' },
    music: { theme: 'shop', seed: 'zhenmu-kitchen-1', gen: { density:50, rhythm:55, speed:45, drama:35, mood:65, hook:60, smooth:55 } },
    layers: [
      { id:'sky', src:'clicker-scene2-sky.png', y:0, h:360, parallax:0 },
      // 層架與後櫃素材不是橫幅，用固定寬度放在牆上與窗戶錯開，不拉伸
      { id:'far', src:'clicker-scene2-far.png', x:36, y:52, h:130, w:243, parallax:.35 },
      { id:'mid', src:'clicker-scene2-mid.png', x:130, y:196, h:96, w:294, parallax:.55 },
      { id:'ground', src:'clicker-scene2-ground.png', y:220, h:140, parallax:.8 },
      { id:'props', sprites:[0,1,2].map(i=>`clicker-scene2-prop-${i}.png`), slots:[[80,270],[300,300],[550,270]], h:64, parallax:.7 },
      { id:'steam', sprites:[0,1].map(i=>`clicker-scene2-steam-${i}.png`), slots:[[60,160],[490,180]], h:70, drift:[12,16], rise:true, parallax:.2 },
      { id:'cloth', sprites:['clicker-scene2-cloth.png'], slots:[[200,150]], h:90, sway:{amp:5,stiff:.9}, hanging:true, parallax:.5 },
    ],
    particles: { sprites:[0,1].map(i=>`clicker-scene2-particle-${i}.png`), everyMs:[1500,3200], max:6, size:[10,16], life:[5,9], rise:true },
  };
  // 第十一輪：三個場景的敵人只靠 enemy 參數（triple／timer／gift）做差異，經濟層不認場景名。
  // far／mid 素材都是有邊界的物件（貨架、機台、攤位），照廚房用 x,y,h,w 固定尺寸擺放；sky 與 ground 才拉滿 632。
  const sceneSprites = (n, kind, count) => Array.from({ length: count }, (_, i) => `clicker-scene${n}-${kind}-${i}.png`);
  const boss = (name, image, size, center) => ({ ...scenes.backyard.boss, name, mul: 1.25, image, size, ...(center ? { center } : {}), reward: { freeDraws: 5 } });
  scenes.market = {
    thief: { sprite:'monster-1.png', everyMs:[60000,120000], hits:5, reward:20 },
    name: '便利商店貨架', unlockPackages: 0, requirementMul: 64, rewardMul: 2, bagSkin: 0,
    unlock: { packages: 60, boss: 'kitchen' }, enemy: { shell: null, timer: null, regen: null, triple: true }, affinity: ['dog', 'jiaobu2'],
    boss: boss('大三連包', 'clicker-boss3-pack.png', [320, 150], 440),   // 寬王：中心左移到 440，右緣 600 不出舞台
    palette: { mat: '#C9D3DA', sky: '#EEF3F6' },
    music: { theme: 'market', seed: 'zhenmu-market-1', gen: { density: 55, rhythm: 60, speed: 55, drama: 30, mood: 75, hook: 65, smooth: 50 } },
    layers: [
      { id: 'sky', src: 'clicker-scene3-sky.png', y: 0, h: 360, parallax: 0 },
      { id: 'far', src: 'clicker-scene3-far.png', x: 40, y: 44, h: 150, w: 260, parallax: .35 },
      { id: 'mid', src: 'clicker-scene3-mid.png', x: 330, y: 120, h: 104, w: 244, parallax: .55 },
      { id: 'ground', src: 'clicker-scene3-ground.png', y: 220, h: 140, parallax: .8 },
      { id: 'props', sprites: sceneSprites(3, 'prop', 3), slots: [[72, 318], [560, 300], [470, 322]], h: 64, parallax: .7 },
      { id: 'tags', sprites: sceneSprites(3, 'tag', 2), slots: [[120, 110], [512, 104]], h: 64, sway: { amp: 6, stiff: .9 }, hanging: true, parallax: .45 },
    ],
    particles: { sprites: sceneSprites(3, 'particle', 4), everyMs: [1500, 3200], max: 6, size: [10, 16], life: [5, 9] },
  };
  scenes.factory = {
    thief: { sprite:'monster-2.png', everyMs:[60000,120000], hits:5, reward:20 },
    name: '零食工廠', unlockPackages: 0, requirementMul: 500, rewardMul: 2.5, bagSkin: 0,
    unlock: { packages: 70, boss: 'market' }, enemy: { shell: null, timer: 20, regen: null }, affinity: ['lk', 'jiaobu'],
    boss: boss('大輸送箱', 'clicker-boss4-crate.png', [260, 285]),
    palette: { mat: '#9DA3A8', sky: '#DCE1E4' },
    music: { theme: 'factory', seed: 'zhenmu-factory-1', gen: { density: 65, rhythm: 75, speed: 65, drama: 45, mood: 50, hook: 60, smooth: 35 } },
    layers: [
      { id: 'sky', src: 'clicker-scene4-sky.png', y: 0, h: 360, parallax: 0 },
      { id: 'far', src: 'clicker-scene4-far.png', x: 30, y: 84, h: 120, w: 386, parallax: .35 },
      { id: 'gears', sprites: ['clicker-scene4-mover-0.png'], slots: [[470, 70], [536, 118]], h: 56, spin: [24, -18], parallax: .3 },
      { id: 'smoke', sprites: ['clicker-scene4-mover-1.png'], slots: [[96, 150], [300, 170]], h: 64, drift: [12, 15], rise: true, parallax: .25 },
      { id: 'mid', src: 'clicker-scene4-mid.png', x: 340, y: 176, h: 96, w: 226, parallax: .55 },
      { id: 'ground', src: 'clicker-scene4-ground.png', y: 210, h: 150, parallax: .8 },
      { id: 'props', sprites: sceneSprites(4, 'prop', 3), slots: [[70, 316], [150, 300], [566, 300]], h: 64, parallax: .7 },
    ],
    particles: { sprites: sceneSprites(4, 'particle', 4), everyMs: [1500, 3200], max: 6, size: [10, 16], life: [5, 9], rise: true },
  };
  scenes.nightmarket = {
    name: '夜市攤', unlockPackages: 0, requirementMul: 2000, rewardMul: 3, bagSkin: 0,
    unlock: { packages: 80, boss: 'factory' }, enemy: { shell: null, timer: null, regen: null, gift: { everyMs: [45000, 90000], seconds: 15, mul: 10 } }, affinity: ['yang', 'yueyue'],
    boss: boss('老闆的巨無霸禮包', 'clicker-boss5-bag.png', [220, 312]),
    palette: { mat: '#4B3B52', sky: '#2B2440' },
    music: { theme: 'nightmarket', seed: 'zhenmu-nightmarket-1', gen: { density: 60, rhythm: 65, speed: 60, drama: 55, mood: 70, hook: 80, smooth: 45 } },
    layers: [
      { id: 'sky', src: 'clicker-scene5-sky.png', y: 0, h: 360, parallax: 0 },
      { id: 'far', src: 'clicker-scene5-far.png', x: 60, y: 78, h: 130, w: 404, parallax: .35 },
      { id: 'moths', sprites: ['clicker-scene5-particle-0.png'], slots: [[140, 70], [420, 52]], h: 22, drift: [14, 20], parallax: .3 },
      { id: 'mid', src: 'clicker-scene5-mid.png', x: 330, y: 92, h: 128, w: 256, parallax: .55 },
      { id: 'ground', src: 'clicker-scene5-ground.png', y: 220, h: 140, parallax: .8 },
      { id: 'props', sprites: sceneSprites(5, 'prop', 3), slots: [[70, 318], [546, 322], [160, 302]], h: 64, parallax: .7 },
      { id: 'lanterns', sprites: sceneSprites(5, 'lantern', 2), slots: [[92, 118], [548, 110]], h: 80, sway: { amp: 5, stiff: .9 }, hanging: true, parallax: .45 },
    ],
    particles: { sprites: sceneSprites(5, 'particle', 4).slice(1), everyMs: [1500, 3200], max: 6, size: [10, 16], life: [5, 9], rise: true },
  };
  // 印記商店的新桌布「屋頂星空」：純外觀（層次先借後院，CSS 上夜色；素材另補），需求倍率同後院
  scenes.rooftop = { ...scenes.backyard, thief: null, name: '屋頂星空', unlock: null, requiresMark: 'rooftop', affinity: [], bagSkin: 0,
    palette: { mat: '#3B3F5C', sky: '#1E2440' }, music: { theme: 'rainynight', seed: 'zhenmu-rooftop-1', gen: { density: 35, rhythm: 30, speed: 30, drama: 40, mood: 55, hook: 60, smooth: 80 } },
    particles: { sprites: ['clicker-fx-spark.png', 'clicker-scene1-particle-1.png'], everyMs: [900, 2200], max: 8, size: [8, 14], life: [5, 9] } };
  // 第十二輪：深夜冰箱（舊 id rainynight，存檔遷移在 clicker-save.js）。regen：需求每秒回升 1%，靠 burst 打穿。
  // 冰箱自己的層已產出（clicker-scene6-*）；tint 只留一點冷色。冷凍包仍用罐頭 + 霜層（clicker-frozen-frost/ice）。
  scenes.fridge = {
    bossPackages: 100,
    name: '深夜冰箱', unlockPackages: 0, requirementMul: 12000, rewardMul: 3.5, bagSkin: 1, bagPrefix: 'clicker-can-',
    unlock: { packages: 90, boss: 'nightmarket' }, enemy: { shell: null, timer: null, regen: .01 }, affinity: ['zhenmu','zhenzhen'],
    boss: { ...scenes.backyard.boss, name: '大冰磚', mul: .95, reward: { freeDraws: 5 } },   // 王也吃 1%/s 回升，30 秒約掉 30%，係數補回
    palette: { mat: '#AEC6D6', sky: '#DCE9F2' },
    tint: { color: '#7FB5E6', opacity: .12, blend: 'multiply' },
    frost: { layer: 'clicker-frozen-frost.png', ice: 'clicker-frozen-ice.png', shards: { sprite: 9, count: 16, color: '#DFF3FF' } },
    music: { theme: 'rainynight', seed: 'zhenmu-fridge-1', gen: { density: 35, rhythm: 30, speed: 30, drama: 40, mood: 45, hook: 55, smooth: 80 } },
    layers: [
      { id:'sky', src:'clicker-scene6-sky.png', y:0, h:360, parallax:0 },
      { id:'far', src:'clicker-scene6-far.png', x:330, y:44, h:130, w:243, parallax:.35 },
      { id:'mid', src:'clicker-scene6-mid.png', x:40, y:196, h:96, w:294, parallax:.55 },
      { id:'ground', src:'clicker-scene6-ground.png', y:220, h:140, parallax:.8 },
      { id:'props', sprites:[0,1,2].map(i=>`clicker-scene6-prop-${i}.png`), slots:[[62,274],[330,298],[556,272]], h:64, parallax:.7 },
      { id:'mist', sprites:[0,1].map(i=>`clicker-scene2-steam-${i}.png`), slots:[[90,150],[470,176]], h:70, drift:[8,11], rise:true, parallax:.2 },
      { id:'frost-edge', sprites:['clicker-fx-snow.png','clicker-fx-snow.png'], slots:[[40,40],[540,36]], h:40, drift:[3,4], parallax:.15 },
    ],
    particles: { sprites:['clicker-fx-snow.png','clicker-fx-spark.png'], everyMs:[900,2000], max:8, size:[8,14], life:[5,9] },
  };
  const resolve = (id, index = Infinity) => Object.hasOwn(scenes, id) && index >= scenes[id].unlockPackages ? scenes[id] : scenes.backyard;
  root.ClickerScenes = scenes;
  if (typeof module !== 'undefined' && module.exports) { module.exports = { scenes, resolve }; return; }
  const rand = (a,b) => a + Math.random() * (b-a);
  const baseWind = t => .6 * Math.sin(t * .7) + .4 * Math.sin(t * 1.9 + 1.3);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let host, scene, layers = [], movers = [], clouds = [], spinners = [], particles = [], textures = [], fxLayer;
  let time = 0, nextParticle = 0, gust = null, nextGust = 0;
  let target = {x:.5,y:.5}, pointer = {...target}, pendingPointer = null;
  function wind(t) {
    const u = gust ? (t - gust.start) / gust.duration : -1;
    return baseWind(t) + (u >= 0 && u <= 1 ? gust.peak * Math.sin(Math.PI * u) ** 2 : 0);
  }
  function move(e) {
    pendingPointer = {x:e.clientX,y:e.clientY};
  }
  function center() { pendingPointer = null; target = {x:.5,y:.5}; }
  function unmount() {
    if (fxLayer) fxLayer.dead = true; fxLayer = null;
    host?.remove(); host = null; layers = []; movers = []; clouds = []; spinners = []; particles = [];
    document.getElementById('game').removeEventListener('pointermove', move);
    document.getElementById('game').removeEventListener('pointerleave', center);
  }
  function mount(id, index) {
    const old = host?.cloneNode(true); if (old) { old.removeAttribute('id'); old.classList.add('scene-outgoing'); }
    const scope = fxScope;
    unmount(); scene = resolve(id, index); time = 0; gust = null; nextGust = rand(6,14); nextParticle = rand(...scene.particles.everyMs)/1000; center(); pointer = {...target};
    host = document.createElement('div'); host.id = 'clicker-scene'; host.setAttribute('aria-hidden','true');
    host.style.background = scene.palette.sky;
    document.querySelector('.desk-mat').after(host);
    if (old) { host.before(old); old.animate([{opacity:1},{opacity:0}],{duration:400}).finished.then(()=>old.remove()).catch(()=>old.remove()); host.animate([{opacity:0},{opacity:1}],{duration:400}); }
    if (scope) attach(scope);
    document.getElementById('stage').style.setProperty('--scene-mat',scene.palette.mat);
    document.getElementById('stage').dataset.scene=id;
    function picture(parent, src, x, y, h, w, sway, leaf = false, anchor = false) {
      const el = document.createElement('img'); el.src = src; el.alt = ''; el.draggable = false;
      el.style.cssText = `left:${x}px;top:${y}px;height:${h}px;${w ? `width:${w}px;` : ''}${anchor ? 'translate:-50% -100%;' : ''}`;
      el.onerror = () => { el.style.visibility = 'hidden'; };
      parent.append(el);
      if (sway) movers.push({el,x,sway,leaf});
      return el;
    }
    scene.layers.forEach((def,i) => {
      const el = document.createElement('div'); el.className = 'scene-layer'; el.dataset.layer = def.id; el.style.zIndex = i; host.append(el); layers.push({el,def});
      if (def.src) picture(el,def.src,def.x ?? -12,def.y,def.h,def.w ?? 632);
      def.slots?.forEach(([x,y],j) => {
        const img = picture(el,def.sprites[j % def.sprites.length],x,y,def.h,null,def.sway,!!def.sway,!def.drift);
        if (def.hanging) img.style.transformOrigin='50% 0';
        if (def.drift) clouds.push({el:img,x,speed:def.drift[j],rise:def.rise});
        // 工廠齒輪：繞自身中心等速旋轉（度／秒），與風無關
        if (def.spin) { img.style.transformOrigin='50% 50%'; spinners.push({el:img,speed:def.spin[j]}); }
      });
      // Trunk 360?443: branch tips (42,87)/(318,30), fork (180,165).
      // At (20,60), 120?240: tips (34,107)/(126,76), fork (80,149).
      def.canopy?.forEach((src,j) => {
        const leaf = picture(el,src,...def.canopySlots[j],def.sway,true);
        leaf.style.zIndex = [1,3,2][j];
        leaf.style.transformOrigin = `50% ${50 + 10/def.canopySlots[j][2]*100}%`;
      });
    });
    if (scene.tint) { const tint = document.createElement('div'); tint.className = 'scene-tint'; tint.style.cssText = `background:${scene.tint.color};opacity:${scene.tint.opacity};mix-blend-mode:${scene.tint.blend || 'normal'}`; host.append(tint); }
    root.ClickerExtras?.decorate?.(host, scene);   // 第十二輪：里程碑玩具進 props 槽
    textures = scene.particles.sprites.map(src => { const img = new Image(); img.src = src; return img; });
    document.getElementById('game').addEventListener('pointermove',move,{passive:true});
    document.getElementById('game').addEventListener('pointerleave',center);
    update(0);
    return scene;
  }
  let fxScope;
  function attach(scope) {
    fxScope = scope;
    if (fxLayer) fxLayer.dead = true;
    fxLayer = scope.layer({ dead:false, update() {}, draw(ctx) {
      if (!host) return;
      const stage = document.getElementById('stage');
      ctx.save(); ctx.translate(stage.offsetLeft,stage.offsetTop);
      ctx.beginPath(); ctx.rect(24,24,560,312); ctx.clip();
      for (const p of particles) {
        if (!p.img.complete || !p.img.naturalWidth) continue;
        // 壽命最後一秒淡出；負值會被 canvas 忽略而以 alpha 1 畫出「消失前閃一下」，所以夾在 [0,1]
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0,Math.min(1,p.life,(p.max-p.life)*2));
        ctx.drawImage(p.img,-p.size/2,-p.size/2,p.size,p.size); ctx.restore();
      }
      ctx.restore();
    } });
  }
  function detach() { if (fxLayer) fxLayer.dead = true; fxLayer = null; fxScope = null; }
  function update(dt) {
    if (!host) return;
    time += dt;
    if (pendingPointer) {
      const box = document.getElementById('game').getBoundingClientRect();
      target = {x:Math.max(0,Math.min(1,(pendingPointer.x-box.left)/box.width)),y:Math.max(0,Math.min(1,(pendingPointer.y-box.top)/box.height))};
      pendingPointer = null;
    }
    if (time >= nextGust) { gust = {start:time,duration:rand(1.2,2),peak:rand(1,1.6)*(Math.sign(baseWind(time)) || 1)}; nextGust = time + rand(6,14); }
    pointer.x += (target.x-pointer.x)*.12; pointer.y += (target.y-pointer.y)*.12;
    for (const {el,def} of layers) el.style.transform = `translate(${reduced.matches ? 0 : (pointer.x-.5)*12*def.parallax}px, ${reduced.matches ? 0 : (pointer.y-.5)*6*def.parallax}px)`;
    for (const {el,x,sway,leaf} of movers) {
      // Negative phase delays the right edge by 150ms; every sprite samples the same gust.
      const w = reduced.matches ? 0 : wind(time-x/608*.15);
      el.style.transform = `rotate(${w*sway.amp/sway.stiff}deg) scaleX(${1+(leaf ? .02*w : 0)})`;
    }
    for (const sp of spinners) sp.el.style.transform = `rotate(${reduced.matches ? 0 : (time*sp.speed)%360}deg)`;
    for (const c of clouds) { c.el.style.transform = c.rise ? `translateY(${-time*c.speed%220}px)` : `translateX(${((c.x+time*c.speed+120)%848)-120-c.x}px)`; if (c.rise) c.el.style.opacity = Math.sin((time*c.speed%220)/220*Math.PI); }
    const cfg = scene.particles, max = reduced.matches ? 2 : cfg.max;
    particles = particles.filter(p => p.life > 0).slice(0,max);
    if (time >= nextParticle) {
      if (particles.length < max) {
        const top = Math.random() < .7;
        const life = rand(...cfg.life);
        particles.push({x:top ? rand(40,570) : 615,y:cfg.rise ? 320 : top ? -10 : rand(30,240),rot:rand(0,Math.PI*2),vr:rand(-1.2,1.2),life,max:life,size:rand(...cfg.size),phase:rand(0,6),img:textures[Math.floor(Math.random()*textures.length)]});
      }
      nextParticle = time+rand(...cfg.everyMs)/1000;
    }
    for (const p of particles) { p.life-=dt; p.x+=(-18+wind(time)*22)*dt; p.y+=(cfg.rise ? -18 : 8+6*Math.sin(time+p.phase))*dt; p.rot+=p.vr*dt; }
    // 到期的粒子當幀就移除，不留給 draw 多畫一格
    particles = particles.filter(p => p.life > 0);
  }
  root.ClickerScene = { mount, unmount, resolve, update, attach, detach, wind,
    get current() { return scene; }, get time() { return time; }, get particleCount() { return particles.length; }, get gust() { return gust; } };
})(globalThis);
