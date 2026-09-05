# 珍母點點 第一版實作（可寫檔）

先 `git log -3`、讀 `docs/clicker/DESIGN-astra.md`（你的設計文件，使用者已拍板照做）。本輪照文件**第四部分「第一版」**範圍實作，可寫檔，範圍只在 `src/`（新檔 `clicker*.*`、`gacha-card.css`）與 `tools/test/`。**不要碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`**，這些已經接好（見下）。不要 build、不要起 server、不要 commit。

## 使用者對設計文件的兩處改動（定案）

1. **珍母閒置不是全靜止。** 要慢速呼吸與偶爾眨眼，比照 `src/pet.js` 的做法：一個限速 30fps 的 rAF 迴圈（`animate()`，`budget=33ms`，用 `sin` 算 `scale` 呼吸，週期約 3.4s、幅度 ±1.5%），眨眼用 `setTimeout` 隨機 2.5–6s 排一次、閉 130ms（切 `#eyes-open / #eyes-closed` 的 display）。**不用無限 CSS 動畫。** 視窗隱藏／最小化時停迴圈（`visibilitychange`），回來再起。舞台其他角色仍靜止（同時 rig 動畫最多 2 隻的預算不變）。
2. **保底改成第 30 抽起每抽傳說率 +5%，第 40 抽必出**（第 30 張 10%、第 31 張 15%…第 39 張 55%、第 40 張 100%）。這已經寫進 `src/gacha-pool.js` 的 `GAME_POLICY`，你直接用；入口文字「最多再 X 抽必得傳說」照 `40 − sinceLegendary` 算。

## 使用者的硬性要求（原話，逐條對照）

- 「抽卡演示區與遊戲區完全分開、存檔分開（`clicker_save`）；兩邊只共用零件（卡池、卡面、演出模式、音效積木）。」→ 不讀不寫 `gacha_save`、`gacha_mode`、任何 `pet*` 鍵。
- 「每個回饋都要有重量、不要 AI 味、不要無腦堆特效。」→ 一個事件一個主要聲音落點＋一個動作（文件二‑5 的表）。回饋要落在動作發生那一刻。不要常駐粒子、不要每秒進帳音、不要漸層＋光暈＋抖動全開。
- 「需要素材就用生成的圖，不要用程式幾何硬撐。」→ 零食包裝、桌面、錢幣、升級圖示都有真素材（下節），**不要**用 CSS/SVG 畫包裝、撕線、錢幣。

## 已經幫你接好的東西（唯讀，直接用）

### `src/character-config.js`
`window.CharacterConfig`＝原 `pet.js` 的 `CHAR_CFG`（12 隻：`height / limbScale / center / legL / legR / pawR / tail / tailScale / pawScale / up / hit`），`pet.js` 與卡面現在都讀它。

### `src/gacha-pool.js`
```js
GachaPool.CATALOG            // 17 筆素材目錄（12 char + 3 toy + 2 emoji）
GachaPool.byId, RARITY, RARITY_ORDER, CHARACTER_IDS
GachaPool.GAME_POLICY        // 12 隻、70/25/5、pity {unit:'draw', hard:40, softStart:30, softStep:.05}
GachaPool.rollPack({ count, policy, pity, collection, rng?, id?, visualSeed? })
  → { draw: { id, entries: [{ key, entry, dup, owned }], visualSeed }, nextPity }
```
`owned`＝這張之前（存檔＋同包前面幾張）已持有張數，`dup = owned > 0`。五連是 `count: 5` 一次呼叫，內部逐張處理保底、跨保底從該張重新計數。它不讀存檔、不扣幣；你把 `nextPity` 存成 `pity.sinceLegendary`。測試在 `tools/test/gacha-pool.test.js`（`npm test`）。

### `src/gacha-card.js`
```js
const card = window.GachaCard.create({ rarity, byId, canHover, fatal, tagFor });
// tagFor(entry, dup, owned) → { text, cls } | null   ← 卡面右上角標籤由宿主決定
card.create(entry, { dup, owned, tag })   // 建卡面 DOM
card.art.create(entry)                    // 只要立繪 SVG（含 rig 結構 id）
card.art.cfg(id)                          // = CharacterConfig[id]
card.ready                                // 素材 Promise（fetch index.html 的 <template> 並預解碼圖片）
card.liveEnd()
```
遊戲的 `tagFor` 寫升星：`owned` 0 →「NEW」；之後依文件一‑4 的星表寫「2★ → 3★」或「升星進度 3/4」；滿星寫「熟練 +N%」。標籤 class 可自訂（`face-tag.dup` 樣式現有，需新的就在 `gacha-card.css` 加）。

### `src/gacha-mode-runtime.js` ＋ 五種 `GachaModes`
用法看 `src/gacha.js` 的 `makeRuntime()` / `startDraw()` / `skipPresentation()`：宿主給 `host = { root, size, center, cardsEl, dim, card, mode, layout(i, count), state, isFanned, isAuto, onCards, onReveal, interactive, summary, error, shake, flash, charging }`，`runtime.ctx` 交給 `GachaModes[name].create(ctx)`，`mode.open(draw)` resolve 只表示可收下。`GachaModes[name].counts` 是該模式支援的張數（hearthstone/wish 支援 1 與 5；summon/stage/rip 只支援 5）。runtime 已把 `item.owned` 傳給 `card.create`。

### Rust／視窗（已完成，不要改）
- 視窗 label `clicker`，載入 `clicker.html`，960×640 邏輯尺寸，不置頂、可最小化、進工作列。
- 縮放：`await TAURI.core.invoke('get_clicker_zoom')` 取初值，事件 `clicker-zoom` 更新；照 `gacha.js` 的 `applyZoom()`／`fitWindow()`（`invoke('fit_window', { dpr })`）做。
- 關閉：`invoke('close_clicker_window')`（隱藏不銷毀，所以 `visibilitychange` 會觸發）。頂列拖曳：`getCurrentWindow().startDragging()`。
- 右鍵選單「🍪 珍母點點」已接到 `show_clicker_window`。

## 素材（放在 `src/`，全部真 alpha、貼紙風、與角色同一位畫師手感）

| 檔名 | 內容 | 用途 |
|---|---|---|
| `clicker-desk.png` | 1536×1024 不透明，暖米色紙桌＋深褐粗邊框 | 整個視窗背景，`background-size: cover` |
| `clicker-bag.png` | 直式封口零食包（粉橘、中間熱狗標籤帶） | 主舞台的目標物，顯示高約 150px |
| `clicker-bag-open.png` | 同一個包撕開、熱狗露出 | 拆完那一刻換圖，再向兩側退開／下一包接上 |
| `clicker-tear.png` | 橫向鋸齒撕痕貼紙 | 75%／50%／25% 各蓋一道在包上（位置錯開、角度略轉） |
| `clicker-coin.png` | 金幣（熱狗浮雕） | 頂列餘額、浮字前的小圖、收益數字 |
| `clicker-icon-hand.png` | 白狗爪下壓＋動作線 | 商店「手勁」 |
| `clicker-icon-train.png` | 紅哨子＋星星 | 商店「全隊訓練」 |
| `clicker-star.png` | 黃色星星 | 升星標籤、角色列的星級 |

實際像素尺寸可能與上表略有不同，**用 CSS `height` 定尺寸、`width:auto`**，不要寫死寬高。若你開工時某張還沒到位（正在生成），照檔名接上並留註解，我補檔後不需要你改程式。招募入口的卡包沿用 `gacha-pack.png`。

## 第一版範圍（文件第四部分，逐項）

1. `clicker.html / clicker.css / clicker.js / clicker-balance.js / clicker-economy.js / clicker-save.js / clicker-stage.js / clicker-gacha.js`（照文件三‑1 的分工；classic script＋IIFE，只掛 `window.Clicker*`）。`clicker-economy.js` 與 `clicker-balance.js` 要能被 node `require`（比照 `src/pure.js` 尾端的 `module.exports` 寫法），並補 `tools/test/clicker-economy.test.js`：手勁費用表（L=0/5/10/20/30）、訓練費用、`D`／`P` 公式、星級倍率（1/2/4/8/16/20 張）、拆包需求與二分結算（含溢出）、離線 8 小時上限與時間倒退給 0、跨技能到期的區間積分、pending 收下的雙擊防護（同一 `draw.id` 只落帳一次）。
2. **畫面**：文件二‑1 的五個分區與座標。背景用 `clicker-desk.png`。珍母在主舞台中央、顯示高約 190px、固定 240×240 點擊熱區；零食包在珍母下方偏前（不能擋臉）；最多三位展示夥伴站定兩側（對應技能槽，靜止）。稀有度色沿用藍／紫／橘。
3. **主舞台珍母**：閒置呼吸＋眨眼（上面第 1 點）；被點 `scale(1.08,.90)` 55ms 壓、220ms 回正；連點第 3 下起回復縮至 150ms、最大 `scale(1.10,.88)`；連點只重設當前動畫不排隊；觸手 `legL/legR` 反向擺 ±5°；`pawR` 是空組不要用。點擊音 160→95Hz 55ms gain .05，最多每秒 6 次。浮字每秒最多 8 個、同時 12 個，多的合併。
4. **拆零食包**：`H(k)=100×1.12^(k−1)`；75/50/25% 各蓋一道 `clicker-tear.png`；拆完換 `clicker-bag-open.png` 停 300ms，然後左右退開（用 `clip-path` 把同一張圖切成兩半各自位移，或整張淡出）、下一包從下方接上；溢出拆包力延續；一次結算多包只演最後一包並寫「完成 N 包」。拆完不另發幣。
5. **商店**：手勁（`ceil(10×1.30^L)`，寫「每次 12.5 → 14.2」）、全隊訓練（`ceil(1000×1.60^T)`，寫「每秒 79 → 91」）、各有「1 級／最多」；升級音 520→780Hz 120ms gain .09、數值上推 6px 180ms 落定。單抽／五連價格 `C(n)=ceil(150×1.30^floor(n/5))`、五連是五個連續價格相加；常駐顯示「最多再 X 抽必得傳說」；餘額不足按鈕鎖住並顯示差額。
6. **招募（遊戲內滿版覆蓋層）**：沿用 `GachaModeRuntime` 與五種 `GachaModes`，960×640 演出座標，預設 `wish`，可在覆蓋層上切換模式（存到 `clicker_save.settings.mode`）；單抽只開放 `counts` 含 1 的模式（hearthstone／wish），選到只支援 5 的模式時單抽按鈕停用並說明。流程照文件三‑3：結算→驗證→`rollPack`→**一次 `setItem` 存扣款＋抽數＋保底＋pending**→寫入成功才演出→收下驗 `draw.id`→先按舊產能結算再加張數清 pending→一次寫入→成功才播入隊。有 pending 禁止再抽；略過只到總覽不自動收下；關窗保留 pending，重開直接進總覽。覆蓋層開啟期間不能發動技能；底下舞台停視覺、收益照算。
7. **12 角色被動與升星**：全部已擁有角色都提供被動（表一‑5 的基礎幣／秒），星級倍率 1/1.25/1.5/1.75/2.0＋每張 1%。開局 50 次有效點擊直接送 `yueyue2` 一張（明示教學獎勵，不計保底）。
8. **技能（第一版只開三個）**：玥玥 `yueyue2`「尾巴節拍」（10 次點擊 ×2、15s 內用完、CD 60s）、膠布原版 `jiaobu`「一刀開封」（下一次點擊 ×10、15s、CD 45s）、珍母 `zhenmu`「這個頭我收下了」（複製常態收益最高的另一隻的 `pᵢ` 20s、CD 90s；演出：宿主移到中央、珍母 300ms 罩住頭臉，結束 300ms 跳回）。其他九隻的技能格顯示名稱＋「後續開放」。技能音 110→70Hz 140ms gain .12；技能中用靜態姿勢＋效果標籤，不循環播。開局 1 槽，累計 5,000／100,000 幣開第 2／3 槽。點擊倍率取最高不相乘；一次有效點擊消耗所有次數型效果一格。
9. **離線**：`clamp(now − settledAt, 0, 8h)`，100% 效率；時間型技能只結算剩餘區間；回來顯示收據「離開 12 小時，結算 8 小時，獲得 X 幣」，先存再顯示。時間倒退給 0 並保留高水位。
10. **存檔 `clicker_save`**：照文件三‑3 結構；驗證失敗不清空，顯示錯誤並提供「匯出原始資料」（把 JSON 放進 textarea 即可）；`setItem` 失敗不更新記憶體狀態、顯示「尚未儲存」並鎖消費。點擊每 5 秒存一次；升級／技能／招募／收下／隱藏／關窗立即存。
11. **預算**：可見時被動結算 1Hz；收益數字有操作時 10Hz、放置 1Hz；冷卻顯示 1Hz；隱藏／最小化停所有計時器與 rAF；閒置只剩珍母呼吸那一個限速 rAF（這是使用者要的例外）。

## 卡面 CSS 切分

把 `src/gacha.css` 裡卡面相關的規則（`.cards / .card* / .face-* / .back-* / .r-* / --c-* 變數 / 相關 @keyframes / .live*`）**原樣搬**到新檔 `src/gacha-card.css`，`gacha.html` 的 `<link>` 加上它（放在 `gacha.css` 之前或之後都要驗證抽卡視窗外觀不變——規則順序若有依賴就保留原順序）。`clicker.html` 只引 `gacha-card.css`，不引 `gacha.css`；招募覆蓋層自己需要的桌面／壓暗／閃光樣式寫在 `clicker.css`。演出模式檔的私有 CSS 是 create 時注入的，不用動。

## 音效／特效

一視窗一個 AudioContext：`GachaAudio.createScope()` 給遊戲回饋一個 scope、招募演出的 runtime 自己再開一個。`GachaFx.init(canvas, underCanvas)` 只在招募覆蓋層裡用；主舞台的點擊不產粒子。

## 交付

寫 `docs/clicker/REPORT-astra-impl-v1.md`：改了哪些檔、每個檔的職責、與設計文件不同的地方與原因、已知未完成、不確定需要我決定的點、你自己怎麼驗證的（`node --check` 每個檔、`npm test` 結果）。每個 JS 檔 `node --check`；`npm test` 全綠。
