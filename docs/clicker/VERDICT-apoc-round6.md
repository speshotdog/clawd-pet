唯讀複檢完成：**1 項必修、1 項值得修**。我未修改任何檔案。

**必修：刷怪沒有「最快一秒一場」限制，模擬器低估刷錢速度**

位置：[clicker-apoc-ui.js:182](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:182)、[clicker-apoc-economy.js:225](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:225)、[apoc.js:62](/D:/claude研究/clawd-pet-v3/tools/sim/apoc.js:62)。

- 重現：王輸過後，留在前一站，訓練到一擊擊殺，再連點。每次擊殺立即結算、清空 `stage`，下一次點擊又立即開場，完全不必等一秒。
- 實測：以實際 UI `tap()` 搭配 DOM 替身，普發玥玥、兩種訓練 Lv40、第 4 站輸過，**750 毫秒內擊殺 6 場，取得 12,030 金幣**，進度仍為 3。
- 影響：收益上限隨點擊速度增加；模擬器每秒只結算一場，因此目前「約一小時」的驗收不能代表這條操作路徑。這不代表一般玩家必然如此快速通關，但刷怪上限確實可被突破。
- 建議：在經濟層限制刷怪重新開場時間，並讓模擬器逐次點擊結算，避免兩邊規則不同。

**值得修：可編輯存檔的有限等級仍能造成乘算溢位**

位置：[clicker-apoc-economy.js:125](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:125)、[clicker-apoc-economy.js:169](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:169)。

- 重現：將 `teamLevel`、`clickLevel` 設為 `10000` 再 `normalize()`；等級被接受，戰力、點擊傷害與價格均為 `Infinity`。
- 影響：後續收益結算產生非有限金幣，可能導致提交驗證失敗。正常一輪遊玩不會達到此級數，因此不列正常流程必修。
- 建議：載入時檢查衍生戰力、傷害及價格是否有限；拒絕或修復異常資料。

**不用修（已檢查的疑點）**

- **勝王後仍殘留 `bossFailed`**：[economy.js:229](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:229)。重現「輸王→重挑→勝利」後，原始值雖暫留舊站號，但進度已前進，`canFarm` 為假，下一次 `normalize()` 清為 `null`；沒有延續刷怪權限的漏洞。無須修改。
- **刷怪重載、冷卻及重挑**：[economy.js:113](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:113)、[economy.js:186](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:186)。合法刷怪可保留，錯誤站號或未輸王的資料會丟棄；冷卻中不能重挑，冷卻後以滿血王替換刷怪。無須修改。
- **正常數值範圍與舊檔**：[economy.js:119](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:119)。舊血量依剩餘比例換算；Lv10 新倍率為約 ×2.594，符合此次乘算定案。Lv1000 與第 20 站血量仍為有限數，「最多」確實在 1000 次停止。無須因正常範圍擔心溢位。
- **1.0 的 `BOSS_MUL`**：[clicker-balance.js:156](/D:/claude研究/clawd-pet-v3/src/clicker-balance.js:156)。搜尋確認剩餘執行期引用屬於 1.0 自己的規則，沒有讀取已移除的末世欄位，不應刪除。

驗證結果：`npm.cmd test` **209 項全過**。一般玩家參數、種子 `20260913／42／12345` 的模擬結果為 **54／49／52 分鐘**，未完全重現交接文件的 49～51 分。

瀏覽器測試與 UI 體檢腳本會寫入截圖／產物，本次未執行，因此**不宣稱直式版面、遮擋及演出已通過視覺驗收**。檢查途中另有外部新增的 `clicker.css` 標籤寬度調整；已閱讀該差異，以上限制同樣適用。