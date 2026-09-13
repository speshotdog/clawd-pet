唯讀複檢完成，未修改檔案。結論：**2 項必修、2 項值得修**。`npm.cmd test` 共 205 項全過，但額外重現了測試未涵蓋的勝負判定問題。

**必修**

1. **逾時後點擊會吞掉尚未結算的合法被動傷害，讓原本能贏的戰鬥判輸。**  
   位置：[clicker-apoc-ui.js:183](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:183)、[clicker-apoc-economy.js:198](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:198)。  
   重現：戰力 100、王有護盾，第 59 秒結算後剩 10 HP，期限為第 60 秒。第 60.001 秒點擊，UI 呼叫 `settle(..., 0)`，實測判 `fail`；相同狀態等到第 60.5 秒以 `dt=1.5` 結算，實測判 `win`。期限前尚有 35 點合法被動傷害。  
   建議：點擊與 tick 共用結算時間基準，先補算截至期限的被動傷害，再處理點擊與勝負；同步更新基準，避免重複計算。

2. **破防在期限附近結束時，期限前的 ×2 傷害被錯算成護盾倍率，可能誤判失敗。**  
   位置：[clicker-apoc-economy.js:196](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:196)。  
   重現：战力 100、王剩 100 HP，破防與王關期限都在第 60 秒結束。從第 59 秒開始計算，在第 59.999 秒結算會贏；延至第 60.001 秒結算卻輸。程式先恢復護盾，再用 ×0.35 計算整段時間，漏掉此前應有的 ×2。  
   建議：依破防結束、技能到期及王關期限切分結算區間，各區間使用當時倍率，最後判定勝負。

**值得修**

1. **新增的持續失敗說明實際上不可見。**  
   位置：[clicker-apoc-ui.js:248](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:248)、[clicker.css:296](D:/claude研究/clawd-pet-v3/src/clicker.css:296)。  
   重現：王關失敗後，`#package-result` 雖填入冷卻說明，仍套用 `opacity:0`；末世沒有啟動讓它顯示的動畫。既有測試只檢查文字內容，抓不到透明問題。  
   建議：在末世範圍內明確顯示此節點並安排位置；驗收需包含實際可見性。已有失敗通知與按鈕倒數，因此不列為阻擋遊玩的必修。

2. **被動浮字仍會刪掉點擊浮字。**  
   位置：[clicker-apoc-ui.js:106](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:106)。  
   重現：快速連點，使場上已有 12 個點擊浮字且沒有 `.apoc-passive`，下一次被動浮字會刪除第一個 `.floater`，可能包含尚未播完的破盾／擊倒數字。  
   建議：優先替換既有被動浮字；若全部都是點擊浮字，本次被動浮字直接略過。

**不用修（說明為什麼）**

1. **保留傷害已不再影響重打；舊血量按比例換算成立。**  
   位置：[clicker-apoc-economy.js:114](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:114)、[clicker-apoc-economy.js:183](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:183)。  
   檢查：帶入舊 `bossCarry`、`stage.startHp`，正規化後前者被刪除；後者雖仍殘留，但沒有讀取用途。失敗、冷卻結束後重打，實測為滿血 `19219 / 19219`。重載不會重設已有期限；換站後舊 `bossFailed` 不會阻擋下一站。  
   建議：維持現有重打與遷移邏輯；清除無作用的 `startHp` 可作清理，毋須列為功能修復。

2. **王血與獎勵降低，尚無卡死證據。**  
   位置：[clicker-apoc-economy.js:28](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:28)、[tools/sim/apoc.js:24](D:/claude研究/clawd-pet-v3/tools/sim/apoc.js:24)。  
   檢查：第 3 站血量／獎勵為 `410670 / 8213`，第 4 站王為 `19219 / 384`，確實較短，也可能在破盾前被高戰力擊殺。但重跑一般、慢速、無技能慢速、勤快、×2 加成模型，分別重現 **142、172、199、61、69 分鐘**通關，均抽 140 次。  
   建議：保留定案倍率；「王是否太快倒下」屬體驗取捨。模擬假設冷卻後立即重試，不能代表真人等待時間。

3. **正常切換前景與 1.0 的清理流程已有保護。**  
   位置：[clicker-apoc-ui.js:198](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:198)、[clicker-apoc-ui.js:536](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:536)、[clicker.js:430](D:/claude研究/clawd-pet-v3/src/clicker.js:430)。  
   檢查：只在同站仍存活時新增被動浮字，地圖開啟時略過；離開末世會移除 `.apoc-passive`，正常恢復前景會重設時間基準，避免補出隱藏期間 60 秒的巨大數字。  
   建議：維持。背景逐格動畫也只命中末世敵人，未發現會改壞 1.0 的新增規則。

本次未執行會寫入截圖的 Python UI 測試，也未實測 WebView2／直式縮放，因此**文字是否擠壞與動畫視覺效果尚未驗收**。