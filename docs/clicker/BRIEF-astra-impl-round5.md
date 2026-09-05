# 珍母點點 第五輪實作：拆層場景系統（風吹草動＋粒子）、ChipForge BGM 與技能變奏（可寫檔）

先 `git log -6`。切入演出的進出場我已依參考資料重做（`e685373`，`clicker-cutin.js` 的 `T`／`EASE`），**不要動它**。可寫範圍：`src/clicker*.*`、新檔 `src/clicker-scene.js`、`src/clicker-music.js`、`tools/test/clicker-*`、`docs/clicker/REPORT-astra-impl-round5.md`。`src/chipforge/` 是使用者自己的引擎原樣複製，**唯讀**。不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`。不 build、不起 server、不 commit。

## 使用者原話

> 點擊區域我希望背後是一個場景。場景不要是單純的背景，幫我做精緻一點，要把場景物件拆分，一點風吹草動的感覺，會稍微有粒子特效。之後可以靠場景區分難度。
> 技能施放的音效，希望可以按下去後一定時間改變 BGM。BGM 請用之前的 8bit 音樂器去調用資源。

---

## 一、場景系統 `clicker-scene.js`

### 資料驅動

```js
window.ClickerScenes = {
  backyard: {
    name: '後院草地', unlockPackages: 0, requirementMul: 1, bagSkin: 0,
    palette: { mat: '#8FA56E', sky: '#CFE7F5' },
    music: { theme: 'picnic', seed: 'zhenmu-backyard-1', gen: { density: 45, rhythm: 40, speed: 35, drama: 30, mood: 70, hook: 60, smooth: 65 } },
    layers: [ /* 由後到前 */
      { id: 'sky',     src: 'clicker-scene1-sky.png',     x: 0,   y: 0,   h: 360, parallax: 0 },
      { id: 'clouds',  sprites: 'clicker-scene1-cloud-{0,1,2}.png', drift: 6, parallax: .2, ...  },
      { id: 'far',     src: 'clicker-scene1-far.png',     y: 130, h: 150, parallax: .35 },
      { id: 'tree',    src: 'clicker-scene1-tree-trunk.png', x: 20, y: 60, h: 240, parallax: .5,
                       canopy: ['clicker-scene1-canopy-0.png','-1.png','-2.png'], sway: { amp: 1.6, stiff: .6 } },
      { id: 'mid',     src: 'clicker-scene1-mid.png',     y: 200, h: 110, parallax: .55 },
      { id: 'ground',  src: 'clicker-scene1-ground.png',  y: 240, h: 120, parallax: .8 },
      { id: 'flowers', sprites: 'clicker-scene1-flower-{0..4}.png', slots: [[70,300],[150,296],[470,304],[560,298]], h: 64, sway: { amp: 5, stiff: .9 }, parallax: .9 },
      { id: 'grass',   sprites: 'clicker-scene1-grass-{0..4}.png',  slots: [[30,316],[110,322],[230,318],[420,320],[520,316],[590,322]], h: 56, sway: { amp: 7, stiff: 1.1 }, parallax: 1 },
      { id: 'props',   sprites: ['clicker-scene1-prop-0.png' /*郵筒*/,'-2.png' /*鳥屋*/], slots: [[548,214],[24,190]], h: 60, parallax: .7 },
    ],
    particles: { sprites: ['clicker-scene1-particle-0.png' /*花瓣*/,'clicker-scene1-particle-1.png' /*蒲公英*/], everyMs: [1500, 3200], max: 6, size: [10, 16], life: [5, 9] },
  },
};
```

第一版只做 `backyard` 一個場景，但**程式要走設定**：`Scene.mount(sceneId)` 依 `layers` 建 DOM、`Scene.unmount()`；珍母、包裝、技能槽、量尺、寄生標籤仍是舞台的固定元件，疊在場景之上（場景 z 在桌墊之上、`#hero` 之下）。場景邊界＝現有桌墊內框（608×360 舞台，桌墊描邊與縫線仍在最上，讓場景像貼在紙板框裡的一張立體貼紙畫）。

### 風

一個全域風函數，所有會動的東西吃同一個值，才會「一起被吹」：

```js
wind(t) = 0.6*sin(t*0.7) + 0.4*sin(t*1.9 + 1.3) + gust(t)   // t 秒
gust：每 6–14 秒隨機一次，持續 1.2–2.0 秒，形狀 sin^2，峰值 1.0～1.6，方向與當下 wind 同號
```

每株草／花／樹冠：`rotate(wind(t + phase) * amp / stiff)`，`transform-origin` 在底部中心（樹冠在冠底），`phase` 依 x 位置遞增（風從左到右掃過，右邊的晚 0.15 秒），葉子類另加 `scaleX(1 + 0.02*wind)`。更新走**既有 30fps 舞台 rAF**（`clicker-stage.js` 的 `animate`），一幀寫一批 transform；隱藏時停；切入凍結時場景也凍。

### 視差

滑鼠在 `#game` 內移動時，各層 `translateX((mx-0.5) * 12 * parallax) translateY((my-0.5) * 6 * parallax)`，用 `pointermove` 節流到 30fps、有 `lerp .12` 慣性；滑鼠離開回中。減少動態偏好：關視差與搖擺，粒子只留 2 顆。

### 粒子

用現有 `GachaFx` 主畫面 scope，spawn 時 `sprite` 換成場景粒子貼圖（`GachaFx.blit`／`spawn` 若只吃 sprite 表格編號，就在 `clicker-scene.js` 自畫一層 `layer({draw})` 用 `drawImage` 畫這幾張 PNG，**不要改共用 gacha-fx.js**）。每顆：從舞台上緣或右緣外進來，`vx = -18 + wind*22`、`vy = 8 + 6*sin`，自轉 `vr ±1.2`，壽命 5–9 秒，末 1 秒淡出；最多 6 顆；每 1.5–3.2 秒補一顆。點擊碎紙、切入不受影響。

### 雲

三朵雲 `translateX` 以 6／9／13px/s 往右漂，出右界回左界（`clouds` 層寬度多 240px 循環）。

### 難度掛鉤（先留接口）

`E.requirement(k)` 乘上 `scene.requirementMul`；包裝皮 `bagSkin` 目前只有 0。`store.state.settings.scene` 存場景 id（預設 `backyard`）；解鎖條件 `unlockPackages` 以 `package.index` 判斷；第一版不做切換 UI，但名冊旁留「場景」按鈕位置（disabled，title「更多場景後續開放」）。

### 素材（放 `src/`，我補；沒到照檔名接）

| 檔名 | 內容 |
|---|---|
| `clicker-scene1-sky.png` | 1536×1024 不透明天空（3–4 色帶＋太陽） |
| `clicker-scene1-cloud-0/1/2.png` | 三朵雲 |
| `clicker-scene1-far.png` | 遠景丘陵＋籬笆＋樹列（底部實心） |
| `clicker-scene1-mid.png` | 中景樹叢＋路牌＋花圃（底部實心） |
| `clicker-scene1-ground.png` | 近景草地＋野餐布（包裝放在野餐布上） |
| `clicker-scene1-grass-0..4.png` | 五株草（底部中心為軸） |
| `clicker-scene1-flower-0..4.png` | 五朵花（底部中心為軸） |
| `clicker-scene1-tree-trunk.png` / `clicker-scene1-canopy-0..2.png` | 樹幹＋三團樹冠 |
| `clicker-scene1-particle-0..3.png` | 花瓣／蒲公英種子／葉子／小蝴蝶 |
| `clicker-scene1-prop-0..2.png` | 郵筒／澆水壺／鳥屋 |

包裝要**放在野餐布上**：包裝圖盒位置改到野餐布中心（依 ground 圖實際位置量，約 x392 y150 不變或微調），接觸影落在布上。珍母站草地上，接觸影改成草地上的深綠橢圓。

---

## 二、BGM：ChipForge 引擎即時作曲＋技能變奏 `clicker-music.js`

`src/chipforge/` 是 ES Module（`theory/themes/composer/director/state/synth/scheduler/motifs`＋`worklet/bitcrusher.js`）。`clicker.html` 用 `<script type="module" src="clicker-music.js">` 載入它，對外掛 `window.ClickerMusic`（其他檔仍是 classic script，等 `window.ClickerMusic` 就緒再呼叫）。

```js
import { composeSong, nightVariant } from './chipforge/composer.js';
import { defaultMixer, defaultGen } from './chipforge/state.js';
import { ChipSynth } from './chipforge/synth.js';
import { scheduleStep, Transport } from './chipforge/scheduler.js';
```

### 作曲

- 場景曲：`composeSong({ theme: scene.music.theme, steps: 32*16, gen: {...defaultGen(), ...scene.music.gen}, seed: scene.music.seed })`。**固定 seed**，每次開窗同一首。
- 技能曲：`composeSong({ theme: 'lastboss', steps: 16*16, gen: {...defaultGen(), density: 70, rhythm: 75, speed: 70, drama: 85, mood: 60, hook: 75, smooth: 40}, seed: scene.music.seed + '-battle' })`，**強制 `song.transpose = 場景曲.transpose`** 讓兩首同調，切換不刺耳。
- 雷特動機（可選但加分）：`extractMotif(場景曲)` 若引擎提供 `motif` 參數就餵給技能曲，讓戰鬥版重現場景旋律開頭；不提供就略過並在報告說明。

### 播放

- 一個 `AudioContext`（不用 gacha 的），`new ChipSynth(ctx, () => mixer)`，`retro:false`（不載 worklet，避免相對路徑問題；若你能確認 `chipforge/worklet/bitcrusher.js` 載得到就開 retro）。
- 兩個 `Transport`（各自一個 `{song, mixer}` store），各接一個 `GainNode` 進 `synth.master`？——ChipSynth 內部是單一訊號鏈，兩首同時播會混在一起。做法：**兩個 ChipSynth 實例**（同一個 ctx），各自 master 再接一個外層 `GainNode`（`sceneGain`、`skillGain`）到 destination；`ChipSynth.limiter.connect(ctx.destination)` 要改接到外層 gain——**不能改 synth.js**，所以在建立後 `synth.limiter.disconnect(); synth.limiter.connect(gain)`。
- 場景曲 loop 播放，`sceneGain` 0.55；靜音設定＝`ctx.suspend()`；隱藏／最小化＝暫停 Transport 與 ctx，回來從 `lastStep` 續播。
- 首次播放要等使用者互動（AudioContext autoplay 政策）：第一次 pointerdown 才 `ctx.resume()` 並 start。

### 技能變奏（使用者要的重點）

- `cutin.play()` 開始那一刻（t=0）：場景曲 300ms 線性淡到 0.12（不停），技能曲從 step 0 起播、`skillGain` 0→0.7 用 300ms；切入的三段音效照舊疊在上面。
- 效果持續期間（`effect` 的 `until` 或次數用完）維持技能曲；結束時 800ms 交叉淡回（技能曲 →0 後 stop，場景曲回 0.55）。連續發動多個技能：不重啟技能曲，只延長到最後一個效果結束。
- 減少動態偏好不影響音樂；靜音時全部靜音。
- 音量：技能曲 master 比場景曲高 6%（mixer.master 64 vs 60），並在技能曲 mixer 開 `duty.lead:'12.5%'`、`echo 14` 讓它更尖。

### 頂列

「音效開／關」按鈕旁加一顆小的「♪ BGM」切換（cream 按鈕，24px），存 `settings.music`（預設開）。切關時 800ms 淡出。

---

## 三、驗收與交付

- `node --check`（module 檔用 `node --check` 亦可）、`npm test` 全綠。
- `tools/test/clicker-browser.py` 新增：場景層數與 z 序、風函數在 t=0/1/2 秒時草的 rotate 值不同且同號、視差在滑鼠移到右下時各層 translate 比例正確、粒子上限 6、雲循環；音樂：AudioContext 存在、場景 Transport playing、發動技能後 `skillGain` 目標 0.7、效果結束後 800ms 內回 0；隱藏時 ctx.suspend。Playwright 用 `--autoplay-policy=no-user-gesture-required` 或先送一次 pointerdown。
- 截圖：場景靜態、陣風瞬間（草倒向一側）、粒子在場、切入中場景凍結。
- `docs/clicker/REPORT-astra-impl-round5.md`：場景層與座標、風參數、音樂 seed 與兩首曲 bpm／transpose、切換時間、未完成與不確定（誠實）。
