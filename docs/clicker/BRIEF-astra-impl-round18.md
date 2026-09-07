# 珍母點點 第十八輪簡報：批量平均訓練鍵＋貼圖邊框對齊

給 GPT-6 Astra 實作。規則同前：**不要 build、不要起 server、不要 commit、不要碰素材檔、不要精簡任何既有演出**。
**不要動的旗標／行為**：`gacha-mode-wish.js` 的 `WISH_TELEGRAPH` 維持 `false`；`clicker-cutin.js` 的 `T`／`EASE` 不動；點空白關面板、卡冊箭頭、轉彩 30%、第十七輪的東西都不動。
中文直接寫 UTF-8，寫完 `grep -n "??" src/*.js src/*.html` 確認。先讀 `docs/clicker/HANDOFF-next-session.md` 第四節與 `REPORT-astra-impl-round17.md`。

## 1. 批量平均訓練鍵（使用者：一個一個升級好累）

現況：夥伴個別訓練只能在卡冊展示頁對單一角色按「訓練」／「最多」（`clicker-album.js:134`、`clicker-prestige.js train()`）。

要做：
- 卡冊標頭（`#roster header`，粉塵罐旁）加一顆按鈕 **「平均訓練」**（`#train-all`）。文案顯示這一輪會花多少：「平均訓練（約 X 幣）」，餘額不夠一輪時 disabled 並顯示「平均訓練（需 X 幣）」。
- 邏輯放 `clicker-prestige.js` 新函式 `trainAll(state, now)`：
  1. 取所有已招募且未滿級（200）的夥伴。
  2. **輪流升級**：每一輪依「目前等級低→高」排序，逐一嘗試買下一級（`trainCost(L,id)`），買不起就跳過；一輪內沒買到任何一級就停。上限 500 級／次（防呆）。
  3. 回傳 `{ state, levels, spent, perPartner: {id: n} }`。
- 這樣等級低的先追上，結果近似「平均」；不要做「把錢平分」那種會剩一堆零頭的算法。
- 按下後：`commit` 一次、`sound('upgrade')`、通知「平均訓練：N 位夥伴共 +M 級，花 X 幣」，卡冊重繪；里程碑（25/50/75/100）解鎖的技能副軸照舊觸發（`train()` 內原本怎麼處理就怎麼處理，不要繞過）。
- 展示頁單一角色的「訓練」「最多」保留。
- 測試（`tools/test/clicker-round18.test.js`）：三位夥伴 Lv 0/0/10、給剛好夠的錢 → 低的先升；沒錢 → 拋「餘額不足」；滿級的跳過；500 級上限。

## 2. 貼圖邊框不整齊（使用者截圖：按鈕角落缺一塊）

根因：`#game` 用 `applyZoom(z)` 做整體縮放（`clicker.js:383-388 fitWindow`，`z = min(innerWidth/960, innerHeight/640)`），`z` 是任意小數，所有 9-slice 貼圖（按鈕 `52 96 64 96 fill / 8px 12px`、紙框 `88 fill / 18px`、標題帶）的邊片與角片在非整數倍下對不齊，出現缺角與縫線。之前用「填色遮縫」只治標。

要做（治本，不改素材）：
- **縮放比只取 0.25 的倍數**：`z = floor(min(...) / 0.25) * 0.25`，下限 0.75。8px／12px／18px 乘 0.25 的倍數都是整數或 .5，邊片就對齊。剩下的空間讓 `#zoomer` 置中（現有 left/top 算法沿用）；`body` 背景是牛皮紙色所以留白看不出來。
- Tauri 版：`fit_window` 走 Rust 那邊調視窗大小，這輪**不動 Rust**；只在網頁版與 `applyZoom` 套用。若 `applyZoom` 在 Tauri 也會被叫到，一樣套 0.25 取整。
- 另外把所有 `border-image` 的 `/ 寬度` 檢查一遍，寬度是奇數 px（例如 9px、13px、15px、19px）的改成偶數或 .5 對齊（第十四輪改的標題帶 `10px 14px`、`9px 13px`、`14px 19px` → `10px 14px`、`10px 14px`、`14px 20px`，切片同比例微調），這樣在 0.25 倍數下也是整數。
- 驗證：`python _art/shot.py 2560 1215 r18`、`1920 1080`、`1280 860`、`1366 768` 四種，放大看按鈕四角與紙框四角（可以用 PIL 裁 3 倍放大存 `_art/out/r18-corner-*.png`），四種都要乾淨。

## 3. 交付

- `docs/clicker/REPORT-astra-impl-round18.md` 每項一句話，附四種解析度的角落放大圖路徑。
- `npm.cmd test` 全綠。
- 不要 build、不要起 server、不要 commit。
