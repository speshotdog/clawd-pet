# 派工簡報（第三十輪）：回到最初版珍母點點的爐石風拆包桌面，基於相同設計強化

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree；**不要**碰 `D:\claude\clawd-pet`，**不要修改 `src/`**——但本輪**要讀、要移植** `src/` 裡原版的東西，見第一節）。
你是**實作者兼設計者**：這輪沒有另外的設計文件，規格就是本簡報；不清楚的地方以「原版怎麼做」為準。

## 〇、必讀

1. `docs/clicker/LESSONS-2026-09-09.md`（第三節第 4 條：互動與特效驗收要驗像素）
2. `docs/clicker/HANDOFF-holo-cards.md` 六之四／六之五——卡面凍結，`card_face.js` 幾何、Z、字級不動
3. `docs/clicker/REPORT-holo-round29.md`——現況（entry/ceremony/results 三畫面、拆包時間軸、單卡鏈、背景六層、互動契約、A5）
4. **原版**：`src/gacha-mode-hearthstone.js`（拆包桌面版面）、`src/gacha-fx.js`（ring／rainbowRing／spawn／flash／mythic-ripple）、`src/gacha-audio.js`（音效設計）、`src/gacha-mode-runtime.js`（deal／reveal 節奏）、`src/gacha-card.css`（.card-lift、翻面）

## 一、使用者裁決（2026-09-09 晚，覆蓋 29 輪設計）

原話：
> 我覺得照之前像是爐石戰紀的風格就好。卡片疊在一起非常不好看。
> 點開的光暈特效都太薄弱，音效也沒有最初版的珍母點點好，出傳說神話的演出也都輸爛。
> 為什麼我們不能基於相同設計強化就好。

因此本輪的原則只有一條：**最初版珍母點點的拆包桌面（`hearthstone` 模式）是基底，一切以它為底線往上強化**。

1. **版面**：卡片**絕對不重疊**。照 `gacha-mode-hearthstone.js` 的桌面擺法（卡平鋪在桌上、輕微弧線或兩排），在 1440×900 把卡放到不重疊的最大尺寸；預期五抽每張約 240–260px 寬一排、十抽兩排各五張。任何兩張卡的 rect 交集必須是 0。29 輪的扇形（±420 位移、±12° 旋角、重疊）**刪除**。
2. **揭曉特效**：把 `src/gacha-fx.js` 的 `ring / rainbowRing / spawn / flash / mythic-ripple` **移植**進原型（複製成 `_art/holo-test/ceremony-fx.js`，改成不依賴 runtime 的純函式；不改 `src/`）。每個階級在 `face-visible` 的回饋，**以原版 wish／hearthstone 模式的參數為下限**（環的直徑、線寬、持續時間、粒子數、閃光強度），再疊上 29 輪的箔底材衝擊波與卡面掃光。傳說、神話**必須明顯贏過原版**：亮度峰值（灰階截圖卡外區域 P95）與持續時間都要 ≥ 原版量到的值 ×1.3。29 輪那套「細環＋箔片」太薄弱，**整個換掉**。
3. **音效**：把 `src/gacha-audio.js` 的音效設計**移植**（同樣複製成獨立模組），至少包含原版的：發牌、翻面、各階級揭曉（普通／精良／史詩／傳說／神話各自不同）、收下。29 輪的 WebAudio 合成音全部換成原版的；原版若用合成，就用原版的合成參數。首次靜音、可開啟的規則不變。
4. **保留**：入口畫面（卡包＋三鍵）、拆包時間軸（卡包 → 撕封 → 卡從封口發出）、新卡面 `HoloCardFace`、卡包素材、背景六層、不預告品質（face-visible 前逐像素零差）、互動契約（鎖角度／光位跟游標／拖轉／hover 1.04／Esc／點空白跳過／`user-select:none`）、A5 完成契約與跳過語意。
5. **發牌**：照原版 `ctx.cards.deal()` 的節奏（共同出發點＝封口、stagger、終點回彈），卡從封口飛到桌面槽位，不重疊。

## 二、不要做的

- 不改 `src/` 任何檔（讀與複製可以）。
- 不動 `card_face.js`、`pool_data.py`、`RATE`。
- 不做 three.js、影片、召喚陣、流星。
- 不再做扇形重疊。
- 不縮短原版特效的時間或粒子數來「省效能」；原版能跑的這裡也要能跑。

## 三、驗收（新增 `check_gacha_ceremony_round30.py`；舊測試更新不刪。每支回報真實 exit code）

1. **不重疊**：五抽／十抽結果頁，任兩張 `.hcard` 的 `getBoundingClientRect()` 交集面積 0；1440×900、1024×640、390×844 都驗。
2. **卡片尺寸**：五抽一排每張未變形寬 ≥ 240px（1440×900）；十抽兩排每張 ≥ 200px。
3. **特效強度**（像素級）：每階級在 `face-visible` 後 0–600ms 每 50ms 截圖，量卡外區域灰階 P95 峰值與「亮度 > 底色 +40」的持續 ms；先在原版 `src/clicker.html` 的 hearthstone 模式用同一方法量一次當基準（file:// 可開；用固定 fixture），寫進報告；傳說、神話新版 ≥ 基準 ×1.3，普通／精良／史詩 ≥ 基準 ×1.0。
4. **音效**：每階級揭曉觸發的 cue 數與名稱對照原版清單；AudioContext running 時 cue 排程存在；靜音時 0。
5. **不預告**：face-visible 前三階級 78 幀逐像素零差（沿用）。
6. 互動像素斷言、A5 固定觸發點各 20 次、dev 與搬走的 standalone 都驗、standalone ≤ 6.0MB。

## 四、交付

1. 每個大項（版面不重疊／特效移植與強化／音效移植／發牌節奏／測試）一個 commit 邊界；sandbox 擋 commit 就在報告列邊界。
2. `docs/clicker/REPORT-holo-round30.md`：原版基準量測值 vs 新版、每條驗收 exit、standalone 大小、還沒過的。
3. `HANDOFF-holo-cards.md` 第七節與 `TODO-next-round.md` 同步。
4. 不 push。
