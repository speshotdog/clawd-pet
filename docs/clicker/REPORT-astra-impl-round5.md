# 珍母點點：第五輪實作報告

## 範圍

先執行 `git log -6`；基底 HEAD 為 `3f627c4`，包含第五輪全部場景素材。
`clicker-cutin.js` 完全未修改，保留 `e685373` 的 T／EASE 與進出場。
未修改 ChipForge、共用 gacha、Tauri、pet、index 或 menu；未 build、未啟動 server、未 commit。

## 場景與座標

`clicker-scene.js` 提供 `ClickerScenes.backyard` 設定及 `ClickerScene.mount(id, packageIndex)`／`unmount()`。
一個 608×360 場景根節點，依設定逐層建立 DOM；裁切到桌墊 24px 內框（560×312），不是另加一張整體背景。
桌墊底層保持原圖；同圖不帶 fill 的九宮格邊框疊在 z=12，留下描邊與縫線。
場景根 z=1，珍母及接觸影 z=2，包裝 z=4；粒子使用主畫面 `click-fx` scope 並裁切到內框。
量尺與教學紙條 z=13，其餘技能槽、寄生標籤沿用固定位置及既有層級。

| 後→前 | 座標／尺寸（舞台 px） | 視差 |
|---|---|---:|
| sky | x=-12、y=0、632×360 | 0 |
| clouds | (30,32)、(260,58)、(470,20)，高 52、等比寬 | .2 |
| far | x=-12、y=130、632×150 | .35 |
| tree | 樹幹 (20,60)、120×240；樹冠 (8,42)、(62,20)、(115,55)，高 100 | .5 |
| mid | x=-12、y=200、632×110 | .55 |
| ground | x=-12、y=220、632×140 | .8 |
| flowers | 底部中心 (70,300)、(150,296)、(470,304)、(560,298)，高 64 | .9 |
| grass | 底部中心 (30,316)、(110,322)、(230,318)、(420,320)、(520,316)、(590,322)，高 56 | 1 |
| props | 底部中心 (548,214)、(24,190)，高 60；郵筒、鳥屋 | .7 |

橫向連續圖多留 12px 出血，避免視差露出空隙。草花來源五張依 slot 輪用；樹冠、草花各自有底部旋轉軸。
ground 實圖的野餐布在右半部，將原提議 y=240/h=120 調為 y=220/h=140，使草地接到珍母腳下。
包裝保留 (392,150)、154×176，接觸影 (428,313)、82×10 落在布內；珍母影為深綠橢圓 `#36583880`。

### 風、雲與粒子

- 基本風 `0.6*sin(t*.7)+0.4*sin(t*1.9+1.3)`；每 6–14 秒陣風，1.2–2.0 秒 sin² 包絡，峰值 1.0–1.6，方向取開始時基本風同號。
- 草／花／樹冠 amp 分別 7／5／1.6，stiff 分別 1.1／.9／.6；角度為共享風 × amp/stiff。x 相位用 `-x/608*.15`，右側延遲 150ms；葉類 `scaleX(1+.02*wind)`。
- 不另開場景 rAF。沿用 stage 的 33ms 門檻批次寫 transform，以實際幀間隔推進場景時間（卡頓單幀上限 100ms）。凍結、隱藏、招募停舞台時不推進；恢復重設時間基準，不補跑停下期間。
- pointermove 只保留最新座標；30fps 更新時讀矩形、計算 `(mx-.5)*12*p`／`(my-.5)*6*p`，lerp .12；離開回中。
- 三朵雲 6／9／13 px/s；848px（608+240）循環，左右各預留 120px。
- 場景花瓣／蒲公英 PNG 使用既有主畫面 scope 的 `layer({draw})` 自畫，沒有修改共用 sprite 表或點擊碎紙。位置與生命由舞台更新，draw 不推進時間，因此切入時像素也凍結。
- 每 1.5–3.2 秒最多補一顆，最多 6 顆，10–16px，壽命 5–9 秒、末秒淡出；上緣或右緣外生成，vx=-18+wind×22、vy=8+6*sin、自轉 ±1.2 rad/s。
- 減少動態關視差／搖擺，粒子上限 2；雲仍緩慢漂移，音樂不受影響。

### 設定與難度

新存檔及舊存檔補預設 `settings.scene='backyard'`、`settings.music=true`。
存檔驗證拒絕不存在或未解鎖場景；mount 對無效／未解鎖 id 回退後院，門檻採 `package.index`。
`E.requirement(k, sceneId)`、`packageSum`、`advancePackage`、收益結算、量尺及存檔驗證都走相同 multiplier；顯式傳 id 避免結算依賴目前 DOM。
目前 multiplier=1、bagSkin=0；bagSkin 寫在包裝 dataset，素材仍使用既有五種破損狀態。
名冊旁已放 disabled「場景」按鈕，title 為「更多場景後續開放」。

## ChipForge BGM

`clicker.html` 載入 module `clicker-music.js`，對外 `window.ClickerMusic`，classic script 以 optional 呼叫及 ready 事件同步狀態。
首次 pointerdown 才建立／resume 音樂 context；音樂使用自己的單一 AudioContext，與既有音效 context 分開。
同一音樂 context 內兩套 ChipSynth／Transport，各自 `limiter.disconnect()` 後接外層 GainNode 到 destination。
全程 `retro:false`，沒有 worklet 請求，也沒修改引擎來源。

| 曲目 | seed | 長度 | 實測 BPM | transpose | mixer |
|---|---|---:|---:|---:|---|
| picnic 場景 | zhenmu-backyard-1 | 512 steps | 124 | -1 | master 60、其餘 defaultMixer |
| lastboss 技能 | zhenmu-backyard-1-battle | 256 steps | 183 | -1（強制與場景相同） | master 64、lead duty 12.5%、echo 14 |

場景 gen 為 density45/rhythm40/speed35/drama30/mood70/hook60/smooth65。
技能 gen 為 density70/rhythm75/speed70/drama85/mood60/hook75/smooth40。
引擎確實提供 `extractMotif` 及 `gen.motif`，已將場景的節奏／旋律輪廓傳入技能作曲。
實測數值亦輸出於 `tools/test/clicker-artifacts/round5-music.json`。

### 音樂切換

- 場景循環 gain=.55；發動技能、呼叫 cutin.play 的同一事件轉為場景 .12／技能 .7，線性 300ms，技能從 step0 開始。
- 連續技能不重啟 playing Transport；依所有有效 `expiresAt`／`remaining` 判斷，仍有任何效果就維持技能曲。
- 最後效果消耗完或自然到期，800ms 回場景 .55／技能 0，隨後停止技能 Transport；場景整段不中斷。
- 「♪ BGM」獨立設定按鈕高 24px、cream 素材；關閉 800ms 淡至 0 再 suspend。
- 全域音效關會立即暫停兩個 Transport 並 suspend 音樂 ctx；隱藏／Tauri 現有 suspend 流程同樣處理。恢復從 lastStep 起播，效果到期則回場景。
- 淡化用 AudioParam 排程；取消舊淡化使用 cancelAndHoldAtTime，避免快速切換跳到上一個目標值。

## 驗證與截圖

- `node --check`：所有 `src/clicker*.js` 通過，含 module。
- `npm.cmd test`：31/31 通過。PowerShell 政策禁止 npm.ps1，因此使用 npm.cmd 跑同一個 npm test。
- 新增 `clicker-scene.test.js`：倍率與多包結算、驗證進度、解鎖門檻、舊存檔預設與錯誤設定保留。
- `python tools/test/clicker-browser.py --round5`：通過九層及 z、三時間點草角同號且不同、視差比例、雲循環、粒子上限、切入時間凍結、實際音樂 Transport/gain、連續技能、次數耗盡、自然到期、BGM 持久化、隱藏／恢復、減少動態。
- `python tools/test/clicker-browser.py`：整合後完整通過（exit 0），包含新增 Round 5 及既有 Round 2–4 切入分鏡、輸入／收益、碎紙與浮字凍結、招募、存檔失敗、隱藏清理、共用卡面 CSS 等價檢查。
- Playwright 以路由攔截讀本地檔；未啟動 HTTP server。新增 `--autoplay-policy=no-user-gesture-required`，仍實際送 pointerdown。

截圖（已視覺檢查；場景粒子較小，左上可見花瓣）：

- [場景靜態](../../tools/test/clicker-artifacts/round5-static.png)
- [陣風瞬間](../../tools/test/clicker-artifacts/round5-gust.png)
- [粒子在場](../../tools/test/clicker-artifacts/round5-particles.png)
- [切入中場景凍結](../../tools/test/clicker-artifacts/round5-cutin-frozen.png)

## 未完成與不確定

- 按要求只提供 backyard，沒有場景切換 UI；未來新增場景須另外定義切換時既有拆包進度如何換算，以及換曲時機。bagSkin 目前只接 0，不虛構其他皮膚檔名。
- 瀏覽器通過不代表已在 Tauri/WebView2 真機驗證最小化事件；沿用原本可從 visibilitychange／pagehide／Tauri 顯示訊號進出的生命週期，未改 Rust。
- 驗證了音符生成參數、排程、實際 Web Audio gain 與播放狀態，沒有人工聽感試聽或輸出 WAV；同 transpose 不等於兩首和弦在每個跨淡瞬間完全相同。
- 引擎 Transport.stop 不取消已排入 Web Audio 的音符（lookahead 120ms）；使用外層增益與 ctx suspend 管控音量，恢復是 lastStep 精度而非取樣精度，未改引擎。
- 陣風／粒子視覺是隨機的，截圖測試透過公開場景 update 推進到陣風與粒子存在的時刻；音樂作曲 seed 固定。
