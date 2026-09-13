唯讀複檢完成，**建議先修正以下問題，再通過本輪驗收**。未修改任何檔案。

`npm.cmd test`：**216／216 通過**。另以記憶體內測例確認結算及壞存檔問題；一般玩家模擬重現 **170 分鐘、王關失敗 4 次**。未重跑會寫入截圖的 Python UI 套件，因此不將簡報中的 UI 驗收視為本次實測結果。

**必修**

1. **放置傷害取決於結算頻率，跨機制時也會算錯。**  
   位置：[clicker-apoc-economy.js:109](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:109)、[結算切段:311](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:311)。  
   重現：第 4 站、戰力 10,000，同樣結算 10 秒，一次結算仍剩 **4 隻狗、王滿血 92,610**；逐秒結算則 **狗全清、王剩 42,610**。另在第 20 站清空狗群後，以戰力 100 結算前 40 秒，單段扣 4,000，逐秒扣 3,350。  
   原因：一段放置傷害最多殺一隻狗，剩餘傷害消失；切段未涵蓋每 15 秒的機制切換。  
   建議：按換機制、清狗、重生及長殼等事件時間推進，讓放置傷害跨越事件後繼續結算。點擊是否保留溢傷可另維持既定設計。

2. **期限後的狗群重生，會把期限前本應獲勝的結果改成失敗。**  
   位置：[clicker-apoc-economy.js:308](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:308)。  
   重現：戰力 100、王剩 50 血、期限 `160000`、狗群已清且 `nextAt=160500`。`settle(a,160000,1)` 判勝；`settle(a,161000,2)` 同樣涵蓋期限前最後一秒，卻判輸。  
   原因：先依目前時間重生狗，再讓新狗吸收過去的傷害。  
   建議：依時間順序處理重生，只處理到 `tEnd`；期限後的事件不得改變期限前勝負。

3. **隱藏分頁再回來，節拍動畫缺少恢復路徑。**  
   位置：[clicker-apoc-ui.js:272](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:272)、[resume:651](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:651)；相關呼叫：[clicker.js:397](D:/claude研究/clawd-pet-v3/src/clicker.js:397)。  
   重現路徑：第 12 站開打，切到其他分頁，再於期限內返回。隱藏時會取消全部動畫；返回只更新 `lastTick`，同場的 `mechKey` 不變，因此不會重新啟動、對齊節拍動畫。判定時間仍持續前進。此項為程式路徑確認，未做瀏覽器實測。  
   建議：恢復時明確重建光圈與逐格動畫，並以 `startedAt` 設定相位；單純重設負延遲不足以恢復已取消的動畫。保留演出重量。

4. **新機制存檔只檢查物件存在，壞內容會造成 NaN 或點擊例外。**  
   位置：[clicker-apoc-economy.js:198](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:198)。  
   重現：經過 `normalize()` 後，`order={}` 點部位仍拋例外；`minions.hp="bad"` 點擊後變 NaN；`shell.layer=0.5` 點擊後王血變 NaN。  
   建議：驗證有限數、整數範圍、合法部位序列及索引；不合法時重建該機制狀態，保留關卡進度與既有期限。

**值得修**

- **模擬器的 `ACC` 並非實際命中率，點擊時間也可能倒退。**  
  位置：[tools/sim/apoc.js:65](D:/claude研究/clawd-pet-v3/tools/sim/apoc.js:65)。  
  重現：`ACC=1`、每秒 6 下時，多次點擊被壓到同一個拍點；混合未調整的點擊時，後一次可能被移到前一次之前。部位「失誤」分支也有三分之一機率選對。  
  建議：產生單調遞增的點擊時間，明確區分命中窗內外、正確及錯誤部位，再重跑平衡。170 分鐘可重現，但不足以證明準確率模型可靠。

**不用修（本輪未發現問題）**

- **正常狗群不會無限刷新而永遠擋王。**  
  [clicker-apoc-economy.js:111](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:111)：逐隻清除後才設定 20 秒重生，未清完不會補滿。維持設計；修正上述時間結算即可。

- **正常外殼可以用點擊剝完。**  
  [clicker-apoc-economy.js:114](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:114)：實測依序觸發並剝掉三層後通關。放置被殼擋住是指定設計；換到其他機制時，殘留外殼也不會繼續擋傷害。建議維持。

- **部位圓鈕沒有明顯的雙算事件路徑，離開末世也有清理。**  
  [clicker-apoc-ui.js:246](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:246)、[離場清理:638](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:638)。圓鈕與 `#tap` 是不同分支，圓鈕由原生 `click` 計一次，Enter／Space 可沿用按鈕行為；離場會隱藏新增元素。靜態檢查未見因此破壞 1.0，建議維持，觸控及鍵盤實機驗收仍需補跑。