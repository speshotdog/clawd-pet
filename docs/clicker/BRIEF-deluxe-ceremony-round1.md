# 派工簡報：第六種抽卡演出「裝幀典藏」第一輪（只做演出，不碰經濟）

日期：2026-09-08。分支 `holo-cards`（工作區 `D:\claude研究\clawd-pet-holo`）。
分工照舊：我寫簡報 → 你（Astra）實作 → 我用 Playwright 驗收後才 commit。

## 使用者原話

> 派 codex GPT 6 把新的抽卡介面跟演出都完成

追問「設計文件裡有 15 條商業規則還沒定案，要怎麼開工」之後，使用者選的是：

> **只做「裝幀典藏」演出，不碰經濟層**

所以這一輪的範圍就是 `DESIGN-deluxe-gacha.md` 第 5 節那個演出，其他一律不做。

## 先讀

1. `docs/clicker/DESIGN-deluxe-gacha.md` **第 2.2、5、6、7 節**——節拍表、單抽／五連／十連／跳過、
   reduced-motion、相容性、效能預算都在裡面，**照著做，不要重新設計**。
2. `src/gacha-mode-runtime.js`——`ctx` 的實際 API（`cards.deal/reveal/all`、`interact`、
   `signal`、`cancel`、`dispose`、`motion.reduced`）以你讀到的為準，不要照文件臆測。
3. `src/gacha-mode-stage.js` 與 `src/gacha-mode-summon.js`——最接近的兩個既有模式，
   照它們的檔案結構、註冊方式與命名慣例寫。

## 硬限制（違反就要重做）

1. **只准新增一個檔：`src/gacha-mode-deluxe.js`。**
   另外只准改 `src/gacha.html` 兩行：一行 `<script src="gacha-mode-deluxe.js"></script>`，
   一行模式選單的 `<option>`。
2. **`src/clicker.html` 不要動。** 遊戲本體在另一條線（`main`）上有人在開發，
   這一輪只在抽卡演示視窗 `src/gacha.html` 裡跑得起來就好。
3. **既有五種演出一個都不准改**，`gacha-mode-runtime.js`、`gacha-card.js`、`gacha-pool.js`、
   `gacha-fx.js`、`gacha-audio.js` 全部唯讀。需要 runtime 加東西才做得到的，
   **寫進回報，不要自己改 runtime**。
4. **不碰經濟層**：價格、抽率、保底、券、金幣、pending、存檔欄位一律不動，也不要新增。
   抽樣照現有 `DEMO_POLICY` 走。
5. **精美版（`edition`）這一輪是假資料**。設計文件第 3.1 節說「不可以用『這次從精裝池抽的
   所以套 deluxe 樣式』當唯一依據」——那是正式身分模型的規則，這輪還沒有身分模型。
   所以：讀 `entry.edition`，沒有的話用網址參數 `?edition=all|mixed|none`（預設 `mixed`，
   固定 seed，前兩張精美）決定哪幾張走精美高潮。**在檔案開頭註明這是演出用的假資料**，
   免得下一輪有人當成身分模型。
6. **不要 build、不要起 server、不要 commit、不要 push。** 改完就停，我來驗。
7. 不要引入任何第三方字型／材質／音效／圖片。箔紋、紙紋、印章用 CSS 漸層與自製 SVG。

## 要做出來的東西

### A. 模式骨架

註冊成第六種模式 `deluxe`，標籤「裝幀典藏」。入口按鈕、提示文字照其他非 hearthstone 模式的樣子
（`gacha.js` 裡 `launchBtn` 那條路徑）。`counts` 支援 `[1, 5, 10]`。

### B. 節拍（設計文件 5.2 的表格）

960×640 座標，五連為基準。表格裡每一格的時間、順序、以及「回饋／資料規則」那一欄都要照做。
重點：

- 揭曉一律走 `ctx.cards.reveal(key, { deferSummary: true })`，**不要自己複製傳說／神話的揭曉邏輯**。
- 卡背階段不准洩漏稀有度或 edition。
- 全部揭曉後才 `ctx.interact()`。
- 精美高潮只在 `edition === 'deluxe'` 觸發，**不改 rarity、不改 veil**，
  重點是「材質被完成」：壓印、箔面定位、寶石點亮三件事同時發生。
- 普通版也要有回饋（紙張回彈＋落塵），**不能讓普通版看起來像出錯**。

### C. 單抽／五連／十連／跳過（5.3）

- 單抽一槽置中；五連橫排五槽；十連兩排五槽，窄螢幕可捲但**不改資料順序**。
- 跳過：`skip()` 清掉裝幀室 → runtime `showSummary()`，不自動收下、不改 pending。
- 取消要可重入：`ctx.signal`、`ctx.cancel()`、`dispose()` 要清乾淨動畫、audio scope、粒子、
  注入的 style。切分頁、關窗、連按之後不可以有舊時間軸繼續發牌。

### D. reduced-motion（5.4）

照 5.4 全部做到。**跳過與重開的結果必須和正常模式完全一樣。**

### E. 效能預算（第 7 節）

同時可見的動態材質層照那張表控制：背景 1、頁面 1、全域微粒最多 1、焦點卡最多 3，
精美高潮最多再加 4 個短命層且要有明確生命週期。900ms 後移除高潮的 particle／glare layer。

## 一個踩過的坑，請避開

2026-09-05 你上一次做這個專案的演出時，以「效能／克制」為由把撕包、回彈、傳說的戲劇性都砍掉，
使用者實跑之後說原版比較好。**效能規矩只管閒置狀態；演出進行中的份量不要自己減。**
覺得某一拍太重，寫進回報讓使用者決定，不要直接砍。

## 回報

改完在 `docs/clicker/REPORT-deluxe-ceremony-round1.md` 寫：

1. 實際做了什麼、每一拍對應到程式的哪一段。
2. **設計文件裡做不到或需要改 runtime 才做得到的項目**（這個最重要，逐條列）。
3. 你自己覺得節奏可能有問題的地方（**只提，不要自己改**）。
4. 你動過的檔案清單。
