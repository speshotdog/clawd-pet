# 珍母點點 第十四輪簡報：卡冊翻頁、點空白關面板、分享卡字體、更衣室定價、手勁改名

給 GPT-6 Astra 實作。純前端，`src/clicker*.js`／`clicker.css`／`clicker.html`。
**規則：不要 build、不要起 server、不要 commit、不要碰 `src/` 以外的素材檔。** 單元測試在 `tools/test/*.test.js`（`node --test tools/test/`），改了數值要一併改測試。
所有中文字串請用 UTF-8 直接寫，寫完自己 `grep -n "??" src/*.js src/*.html` 確認沒有亂碼。

背景：使用者實玩後的五項回饋。先讀 `docs/clicker/HANDOFF-next-session.md` 第四節（檔案地圖）。

## 1. 卡冊翻頁：點書頁左右兩側就翻頁

檔：`src/clicker-album.js`（`renderBook()`／`flip()`，`$('album-left')`、`$('album-right')`）、`src/clicker.css`（`.album-page`、`.page-corner`）。

現況：只有右下角／左下角兩顆 `page-corner` 小按鈕能翻頁，太不直覺。

要做：
- 點左頁（`#album-left`）非卡片的區域 → `flip(-1)`；點右頁（`#album-right`）非卡片區域 → `flip(1)`。用 `e.target === e.currentTarget`（或 `!e.target.closest('.album-slot')`）判斷沒點到卡片。頁面的 `padding`／grid gap 都算「空白」。
- 保留原本兩顆 `page-corner` 按鈕，行為不變。
- 第一頁的左頁、最後一頁的右頁點了不動（沿用 `flip` 內的邊界檢查），不要跳錯。
- `.album-page` 加 `cursor:pointer`（可翻時），不可翻時 `cursor:default`：用 `data-can-flip` 之類的屬性在 `renderBook()` 更新。
- 卡冊細節頁（`#album-detail`）開著時不受影響（那時書頁本來就藏起來）。
- 保留 `flipping` 鎖，連點不要疊動畫。

## 2. 點面板外面的空白處 → 關掉最上層懸浮面板

檔：`src/clicker.js`（`keydown` 的 Escape 分支在檔尾附近，約 530 行）。

現況：面板（`.panel` inset 75/20/42、`.small-panel` 固定寬 520）沒蓋滿整個視窗，玩家點外面的桌面沒反應，只能按「返回」或 Esc。

要做：
- 在 `document` 上加 `pointerdown` 監聽（**用 pointerdown，跟現有 `.audio-controls` 那條一樣**；不要用 click，否則會跟開面板的按鈕 click 打架）。
- 判斷「有沒有面板開著」：`['save-error','receipt','daily-done','prestige','wardrobe','roster','stats','scenes','share','pick100']` 中 `!hidden` 的。沒有就 return。
- 若 `e.target` 落在任何一個 `.panel`／`.small-panel`／`#album-detail`／`#dust-shop`／`#recruit-layer`／`.audio-controls` 之內 → 不處理。
- 否則**照 Escape 那段同一個順序**關最上層一層：`album?.escape()` → prestige → `extras?.escape()` → scenes / roster / stats / receipt。請把 Escape 那段抽成一個 `closeTopPanel()` 函式讓兩邊共用，**但 pointerdown 版本不能走到最後的 `gacha.close()` 與 `closeWindow()`**（點空白不能關招募、更不能關視窗）；`cutin?.active` 時也不處理。`save-error` 面板不要被點空白關掉（它沒有正常的返回鍵）。
- Tauri 桌面版：`#topbar` 的 `onpointerdown` 是拖曳視窗（`TAURI` 分支）。點 topbar 也算「空白」→ 一樣關面板，關完照常拖曳，兩者不衝突即可。
- `e.preventDefault()` 不要亂加，會影響按鈕焦點；只做關面板。

## 3. 分享卡標題字體突出

檔：`src/clicker-extras.js` `compose()` 與 `text()`。

現況：`text(ctx, title, 48, 210, title.length > 9 ? 52 : 64, ...)`，標題「拿到「第 100 包」徽章」在 52px 下寬約 560px，右側撞進場景縮圖（縮圖 x 從 520 起）。使用者截圖：「徽」字被縮圖蓋住。

要做：
- 標題可用寬度定為 **48 → 470**（右緣留 50px 給縮圖）。先用 64px 量 `ctx.measureText(title).width`，超過就按比例縮字級：`size = Math.min(64, Math.floor(64 * 470 / width))`，下限 30px。
- 若縮到 30px 仍超寬（理論上不會，但徽章名可能很長）：在最後一個「」或「・」處拆成兩行，第二行 y +size×1.05；副標（場景・日期，y=252）跟著往下推。
- `text()` 的 `strokeText` 描邊 9px 也算寬度，量寬時加上 `width`。
- 其他三種標題（`shareTitle` 的 boss／transcend／packs）走同一條路，不要各寫一套。

## 4. 卡冊卡片下方字變兩行

檔：`src/clicker-album.js` `renderBook()`（`meta` 的 `<small>`）、`src/clicker.css` `.album-meta`。

現況：每張卡下方 `粉塵 ${dust} 顆・${nextStep}`，數字大了（例如「粉塵 1234 顆・超越 1234/5678」）超過欄寬就折成兩行，格子高度被撐開、四張卡對不齊。

要做：
- `.album-meta small` 加 `white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis`，並保證 grid 欄不被撐開（`.album-slot { min-width:0 }`）。
- 內容本身縮短：改成兩段分開顯示 —— 第一行只放 `nextStep`（「升階 24/12」），粉塵數移進 `aria-label`／`title`（滑過看得到），或縮成「粉 1234・升階 24/12」。二選一，選版面最穩的。粉塵數字用 `clicker.js` 那個 `format()`（萬／億）以免爆長。
- 目標：任何數字下每張卡的 meta 都只有一行、高度固定。

## 5. 更衣室售價不再跟收益走

檔：`src/clicker-economy.js`（`wardrobePrice`）、`src/clicker-prestige.js`（`decoPrice`）、`src/clicker-balance.js`、`src/clicker-album.js`（顯示）、測試 `tools/test/clicker-round10.test.js:44`、`clicker-round13.test.js:44`、`docs/clicker/DESIGN-balance-v2.md`。

現況：音效／特效 `max(5000, P×1200)`（20 分鐘收益）、裝飾 `max(20000, P×3600)`（1 小時收益）。使用者：到後期幾乎買不起，因為錢一直投進訓練，永遠存不到 20 分鐘的量；換場景後 P 跳一級價格又翻。

要做（使用者決定：外觀類的價格不隨難度變貴）：
- 音效／特效：**每件固定 20,000 幣**，`wardrobePrice(s)` 改成常數（保留函式簽名，UI 與 economy 都用它）。
- 桌面裝飾：**依已擁有件數的固定階梯** `50,000 × 1.5^擁有數`（第 1 件 5 萬、第 10 件約 192 萬），與收益無關。`decoPrice(s)` 改為只看 `s.deco.length`。
- 更衣室標頭 `#wardrobe-price`／`#wardrobe-decor-price` 文案照新規則改（裝飾寫「下一件 X 幣」）。
- 兩個測試的期望值改成新數值；`DESIGN-balance-v2.md` 對應段落補一句改法與理由（2026-09-07 使用者回饋）。
- `clicker-album.js:264` 的 `refreshKey` 裡有 `s.coins >= E.wardrobePrice(s)`，邏輯不用動，確認仍正確。

## 6. 「手勁」改名「攻擊力」

只改玩家看得到的字，不改變數名／存檔欄位（`clickLevel`、`clickCost` 不動）。
- `src/clicker.html:49`（升級卡標題）、`src/clicker-prestige-ui.js:21`（會清除清單）。
- `tools/sim/clicker-curve.js` 兩處輸出字串、測試名稱／註解裡的「手勁」順手改，`DESIGN-balance-v2.md:23` 表格那格改成「攻擊力（原手勁）」。
- 改完 `grep -rn "手勁" src tools docs` 應只剩程式註解（`clicker-economy.js:5`、`clicker-prestige.js:18` 這種可留可改）。

## 交付

- 每項做完一句話寫進 `docs/clicker/REPORT-astra-impl-round14.md`：改了哪些檔、有沒有偏離簡報、哪裡沒把握。
- `node --test tools/test/` 全綠（現在 111 例）。
- 不要動 `clicker-cutin.js` 的 `T`／`EASE`，不要「順便」精簡任何動畫演出。
