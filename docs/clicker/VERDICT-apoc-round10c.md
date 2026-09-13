**必修**

1. **無盡通過第 21 站後，關閉模式會觸發存檔失敗並鎖住操作。**  
   位置：[clicker-save.js:224](/D:/claude研究/clawd-pet-v3/src/clicker-save.js:224)、[clicker-apoc-economy.js:561](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:561)。

   重現步驟：
   1. 通關後開啟無盡模式。
   2. 打完第 21 站，使 `progress = 21`。
   3. 從戰績頁開啟「全線通行選項」，按「關掉無盡模式」。

   `setEndless(false)` 保留進度 21，但驗證器限制非無盡進度必須 ≤20。實測 `commit()` 回傳 `false`、錯誤為「存檔驗證失敗：末世」，且 `store.blocked = true`。模式未成功關閉，消費與自動開戰受阻。應統一關閉模式後的進度語意與驗證規則，並補跨模組測試。

**值得修**

- **第二圈刷怪空檔顯示第一圈血量。** [clicker-apoc-ui.js:380](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:380) 的 `A.need(i)` 漏帶狀態。第二圈第 4 站失敗後，刷怪間隔顯示血量 22,050，下一場又回到正確的 220,500。實際傷害與獎勵正常。
- **無盡到頂仍提示不存在的第 101 站。** [clicker-apoc-ui.js:375](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:375)、[clicker-apoc-ui.js:684](/D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:684)。打完第 100 站後，`canFight=false`、`need=0`，畫面卻仍顯示怪物、`0 / 0`、「按開戰開始」與第 101 站目標。應顯示已達上限。

**可以不修**

- 指定的壞 `laps` 值皆能正規化，血量維持原剩餘比例，沒有 NaN。
- 第二圈換波、刷怪獎勵、無盡王關序列化後重載均驗證正常；模擬器沒有漏帶狀態的直接呼叫。
- 重走的重設／保留欄位與清單一致，`pending` 有阻擋；重新開啟結局面板會重設確認狀態。
- 地圖、音樂與王圖的索引限制未見越界；第 100 站可通過存檔驗證。最高圈數的血量／獎勵格式化為 `32.76澗`／`1467澗`，沒有 `e+` 或 NaN。

複檢範圍為 `HEAD~1..HEAD`（HEAD：`20dfa03`），檔案均取自 `git show HEAD:路徑`。記憶體載入執行末世經濟測試 **38／38 通過**；手機與桌機版面僅做靜態檢查，未實際渲染驗證。