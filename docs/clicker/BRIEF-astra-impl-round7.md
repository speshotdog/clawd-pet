# 珍母點點 第七輪實作：十二技能全開（效果＋各自切入）、純網頁版可部署（可寫檔）

先 `git log -4`。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、新增 `tools/export-web.py`、`docs/clicker/REPORT-astra-impl-round7.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動，但可以**擴充**它讓每個角色有自己的招牌動作與文案。不 build、不起 server、不 commit。

## 使用者原話

> 幫我思考每一個人的技能，我想要全部做出來。之後單純的點餅乾遊戲可以部署到網站讓別人玩。

我上一輪已把 12 隻的效果說明寫進 `clicker-balance.js` 的 `desc`，hover 與名冊會顯示；你這輪要讓它們**真的能發動**，並各自有切入演出。

---

## 一、技能定案（沿用 `DESIGN-astra.md` 一‑5 的表，這裡補上實作型別）

`pᵢ`＝該角色含星級與訓練後的常態每秒收益；`P`＝全隊常態每秒收益（皆排除暫時效果）。

| 角色 | kind | 參數 | 說明 |
|---|---|---|---|
| 玥玥 yueyue2 | `click` | ×2、10 次、15s、CD60 | 已有 |
| 膠布原版 jiaobu | `click` | ×10、1 次、15s、CD45 | 已有 |
| 珍母 zhenmu | `passive`（寄生） | 20s、CD90 | 已有 |
| 采華 caihua | **`burst`** | `20 × pᵢ` 立即拆包力、CD45 | 新 |
| 女僕狐狐 fox | **`burst`** | `15 × P` 立即拆包力、CD120 | 新 |
| ㄌㄎ lk | **`self`** | 自身 ×3、20s、CD90 | 新 |
| 珍珍 zhenzhen2 | **`self`** | 自身 ×4、30s、CD120 | 新 |
| 羊咩 yang | **`team`** | 全隊 +0.20P／秒、30s、CD120 | 新 |
| 珍珍原版 zhenzhen | **`team`** | 全隊 +0.50P／秒、20s、CD120 | 新 |
| 熱狗狗狗 dog | **`clickAdd`** | 每次點擊 +0.5P、20 次、20s、CD90 | 新 |
| 膠布 jiaobu2 | `click` | ×4、5 次、15s、CD75 | 新（同 click 型） |
| 玥玥原版 yueyue | **`clickTime`** | 點擊 ×3、12s（時間型，不限次數）、CD90 | 新 |

規則（維持設計文件）：點擊倍率類（`click`／`clickTime`）**取最高不相乘**；`clickAdd` 是加法、與倍率相加後再乘？——**定案：先乘倍率再加 `clickAdd` 的固定值**（`D' = D × mult + Σ add`），一次有效點擊消耗所有次數型效果一格；`self`／`team`／`passive` 可相加、都採發動當下的快照值（`self` 的額外量＝`pᵢ × (mult−1)` 快照，`team` 的額外量＝`P × ratio` 快照）；`burst` 直接加拆包力（走 `click` 同一條入帳與拆包路徑，算一次「重擊」浮字，不噴點擊粒子、噴 12 片碎紙）；離線結算對 `self`／`team`／`passive` 只算剩餘區間；`clickTime` 到期即失效。經濟純邏輯全部進 `clicker-economy.js`，每種 kind 在 `tools/test/clicker-economy.test.js` 各補一例（含跨到期的區間積分與雙擊不重複）。

## 二、十二個切入（沿用同一分鏡，換「角色、色、招牌動作、文案、章」）

`clicker-cutin.js` 加一張表 `CUTIN[id] = { side, color, stripe, rig, name, sub(effect), stamp(effect) }`：

| 角色 | 面板方向 | 色（稀有度） | 招牌 rig（400ms，用 `setLimb`＋眨眼） | 章 |
|---|---|---|---|---|
| 玥玥 | 左入 | 精良藍 | 尾巴掃兩下 | ×2 |
| 采華 | 左入 | 精良藍 | 尾巴大掃向包裝（`tail` −28°→+28°） | 拆！ |
| ㄌㄎ | 左入 | 精良藍 | 兩腿交替踏穩（`legL/legR` ±10°）身體 `scaleY .96` | ×3 |
| 羊咩 | 左入 | 精良藍 | 小手 `pawR` 舉一下 | +20% |
| 熱狗狗狗 | 左入 | 史詩紫 | 抬 `pawR` 前傾（面板內 `translateX(6px)`） | 聞！ |
| 女僕狐狐 | 左入 | 史詩紫 | 抬手收攏（`pawR` −18°→0）尾巴輕搖 | 收！ |
| 膠布 | 左入 | 史詩紫 | 右臂短促揮下（`pawR` +26° 快出慢回） | ×4 |
| 珍珍 | 左入 | 史詩紫 | 身體 `scale(1.06,.9)` 壓扁再回彈 | ×4 |
| 珍母 | 右入 | 傳說金 | 觸手張開 | 發動 |
| 膠布原版 | 左入 | 傳說金 | 刀臂 `pawR` 揮下 | ×10 |
| 玥玥原版 | 左入 | 傳說金 | 舉拳（`pawR`）＋極小尾擺（`tailScale` 遵守） | ×3 |
| 珍珍原版 | 左入 | 傳說金 | 羊毛球下壓回彈（`scale(1.08,.92)`） | +50% |

副標文案（`sub`）用 `desc` 的前半句（去掉冷卻）。`name` 用技能名；四字以上不換行，六字以上換兩行（珍母那條已是）。樞紐、`limbScale`、`pawScale`、`tailScale` 全部從 `CharacterConfig` 讀，`pawR` 是空組的角色（珍珍、珍母、采華、玥玥、ㄌㄎ、珍珍原版）不要用 `pawR`，改用表上寫的替代動作。技能音沿用三段；`burst` 命中時多一次 `impact` 小爆與 12 片碎紙落在包裝。

技能鍵與名冊：`kind` 全有之後，「後續開放」文案自然消失；名冊的「裝備至槽 N」照舊。

## 三、純網頁版可部署

目標：把遊戲以**靜態網站**放到 GitHub Pages（或任何靜態主機）讓別人玩；桌寵、抽卡演示視窗不包含。

- 新增 `tools/export-web.py`：把 `src/` 裡 clicker 需要的檔案（`clicker*.*`、`chipforge/**`、`fonts/**`、`gacha-audio.js`、`gacha-fx.js`、`gacha-card.js`、`gacha-card.css`、`gacha-mode-runtime.js`、五個 `gacha-mode-*.js`、`gacha-pool.js`、`character-config.js`、卡面需要的 `index.html`（只為 `<template>`）與所有角色 PNG、`gacha-*.png/jpg`、`clicker-*.png`、`toy-*.png`）複製到 `dist-web/`，並把 `clicker.html` 複製成 `dist-web/index.html`（保留原名一份）。列出總大小。不要複製 `pet.js`、`menu.*`、`toy.*`、`pure.js`。
- 網頁模式差異（`clicker.js` 用 `window.__TAURI__` 有無判斷）：沒有 Tauri 時——頂列「×」隱藏；頂列不做拖曳；`fit_window`／`get_clicker_zoom` 不呼叫，改為視窗 `resize` 時計算 `min(innerWidth/960, innerHeight/640)` 套到 `#zoomer`，置中並讓 `body` 背景用牛皮紙色 `#C9A46F`；`beforeunload` 觸發 `suspend()` 存檔；`visibilitychange` 照舊。音樂第一次點擊才開始（已是）。
- `<title>` 改「珍母點點」，加 `<meta name="viewport">`、`<link rel="icon">`（用 `clicker-coin.png`），加 `<meta property="og:title/description/image">`（image 用 `docs/clicker/shots/v6-scene.png` 複製成 `dist-web/og.png`）。
- 路徑全部保持相對；`chipforge/worklet` 不需要（retro:false）。
- 驗證：`python tools/export-web.py` 後用 Playwright 直接開 `dist-web/index.html` 的 http 版（你現有的 route 攔截方式改成讀 `dist-web/`），跑一次開局→點 50 下→技能→招募→收下→重載保留存檔，截圖 `round7-web-*.png`。

## 四、驗收與交付
- `node --check`、`npm test` 全綠（新增 9 種 kind 的經濟測試）；`tools/test/clicker-browser.py` 加：12 技能各一張 400ms 切入截圖、`burst` 立即入帳、`clickTime` 到期、`team`＋`self` 疊加離線結算、網頁模式（無 TAURI）主流程。
- `docs/clicker/REPORT-astra-impl-round7.md`：每個技能的實際數值與切入動作、export 清單與大小、網頁模式的差異、未完成。
