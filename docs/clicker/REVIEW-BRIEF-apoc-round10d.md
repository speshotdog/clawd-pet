# Codex 複檢 第十輪 D：2.0 離線收益、派遣、徽章牆（含第十輪 C 複檢修正）

分支 `balance-v3`。範圍：第十輪 C commit 之後到 HEAD（第十輪 D commit）。讀檔一律 `git show HEAD:路徑`。

## 使用者定的規則
- 離線：「離線會在該關卡持續賺錢，不會自己前進任何關卡」
- 派遣：「派遣拿金幣，低機率拿到卷」
- 2.0 不准出現任何 1.0 卡面

## 這批做了什麼
1. **經濟**（`src/clicker-apoc-economy.js`）
   - `RULES.OFFLINE = { MIN_MS: 60s, MAX_MS: 8h, SHARE: .25 }`；`RULES.DISPATCH = { SLOTS: 3, MS: 2h, KILLS: 20, TICKET: .12, RARITY }`。
   - `settle` 每次把 `seenAt` 設成 now；`offline(a, now)`：離開 ≥ MIN_MS 才算，時間夾到 MAX_MS，
     收入＝（放置金幣 ×秒 ＋ 擊殺數 × killReward）×SHARE，站＝`incomeIndex`（目前這一站；王站、打完全線往前找一般站）。**不動 progress／stage**，回 `offline` 事件。
   - 派遣：`startDispatch`（要抽到、不在隊上、沒在派、位子沒滿）、`collectDispatch(a, now, rng)`（時間到的全收，金幣＝目前站 killReward×KILLS×稀有度，rng < TICKET 多一張券，`dispatchDone` 累計）、`dispatchCoins`。
   - `addCards` 自動入隊跳過派遣中的卡；`setTeam` 過濾派遣中的卡。normalize：`dispatch`（整筆驗證）、`dispatchDone`、`seenAt`。
   - 模擬器 `tools/sim/apoc.js` 下線 6 小時後套 `offline`（`OFFLINE=0` 對照）：一般玩家 179 → 158 分、慢 462 → 420 分。
2. **UI**（`src/clicker-apoc-ui.js`）
   - `offlineCheck()`：`enter()`（載入、從桌邊切回來）與 `resume()`（分頁回前景）先跑 `A.offline`，有錢就借 1.0 的 `#receipt` 出收據。
   - tick：有派遣到時間就 `collectDispatch` 自動入帳並 notice。
   - 戰績頁徽章牆：`APOC_BADGES` 14 個，從 view 現算（不存清單），字章圖示；`#badge-grid` 在末世不再藏起來。
3. **卡冊／編隊**（`src/clicker-album.js`、`src/clicker-team.js`）：末世詳情多「派遣 2 小時」鍵、派遣中不能編入／裝技能、名冊「派」章、stateKey 含 dispatch；編隊挑卡在末世也擋派遣中的卡。
4. **第十輪 C 複檢修正**：`clicker-save.js` 進度上限改成 `endless || cleared` 時 ENDLESS_MAX（關掉無盡後進度仍 >20 會 commit 失敗、鎖住）；刷怪空檔血量帶圈數；無盡到 ENDLESS_MAX 顯示「無盡模式到底了」。

## 請檢查（找會壞的）
- 離線：`seenAt` 在哪些路徑會被提早更新而吃掉離線時間（載入時 `validate→normalize`、`apply` 的其他動作、tap 的 settle、1.0 那邊的 commit）？哪些路徑會重複給（resume 被 focus／visibilitychange／clicker-zoom 連續叫、enter 後又 resume）？在桌邊待著的時間也算——會不會和 1.0 自己的離線收據同時出現？
- 離線中王關的 deadline 早就過了：回來第一個 tick 判輸是否合理、會不會因為 offline 先把 seenAt 推到 now 而讓 settle 的 dt 算錯？
- `offline` 是否真的「不前進任何關卡」：progress、stage.hp、wave、bossFailed、cooldown、farmNextAt 全都不動？
- 派遣：派遣中的卡在抽卡收下（collectDraw→addCards）、編隊畫面、技能格、重走廢土（replay 保留 dispatch？）、壞存檔（同一張在隊上又在派遣）時的行為；`collectDispatch` 在 tick 裡 `apply` 失敗時會不會重複給錢或丟獎勵。
- 金幣量級：派遣一次（20 隻×稀有度）與離線 8 小時，對照一場 20 分鐘的線上收入，會不會讓訓練一口氣跳太多？
- 徽章：`v.progress > k*4+3` 在重走後 progress 歸零時靠 `laps>0` 保住——無盡、壞值（laps 字串）會不會算錯？
- 手機 390×844／桌機：收據、徽章牆（14 格）、詳情頁多一顆鍵後有沒有擠出畫面、字太小。
- 2.0 不准出現 1.0 卡面：徽章牆、派遣相關 UI 有沒有借到 1.0 的卡圖。

## 已跑過
- `npm test` 223 過（新增離線、派遣兩個測試）
- `clicker-v3-apoc-play.py`、`clicker-ui-audit.py`、`clicker-v3-team.py`、`clicker-v3-teamui.py` 全過；scratchpad `batch_c.py` 全過；`batch_d.py`（離線收據、派遣、徽章牆、關無盡）見交接

輸出：必修（附重現步驟與行號）／值得修／可以不修。繁體中文。
