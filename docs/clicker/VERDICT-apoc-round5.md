唯讀複檢完成，未修改檔案。`npm.cmd test`：205 項全過；模擬重現一般玩家 166 分鐘／失敗 12 次、勤快玩家 67 分鐘／失敗 1 次。本次未執行會輸出截圖的瀏覽器測試，也未實測 WebView2 畫面。

**必修**

1. **新增 60 秒限制，卻沒有顯示王關倒數。**  
   位置：[clicker.css:1251](D:/claude研究/clawd-pet-v3/src/clicker.css:1251)、[clicker-apoc-ui.js:205](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:205)。  
   重現：進入第 4 站，持續戰鬥但不要擊殺；畫面只顯示護盾下數或「破防剩幾秒」，60 秒後直接出現「王關失敗」。`#boss-timer` 被 `display:none !important` 隱藏，末世 renderer 也沒有更新它。  
   建議：顯示由 `stage.deadline` 計算的「王關剩餘秒數」，與破防倒數明確區分；一般關及戰鬥結束時隱藏。

2. **舊存檔的無限時王關與舊血量沒有遷移。**  
   位置：[clicker-apoc-economy.js:110](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:110)、[clicker-apoc-economy.js:25](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:25)。  
   重現：上一版在第 4 站王關打至半血後存檔，再載入目前版本。以相同資料執行 `normalize()`、再於開戰後 1,000 秒呼叫 `settle(..., 0)`，實測仍為 `deadline:null`、血量 `1296000 / 2592000`、沒有失敗事件；新版該王滿血只有 `120121`。因此老玩家仍須打舊版高血量，且不受統一時限約束。  
   建議：對舊戰鬥做一次性遷移，按剩餘血量比例換算新版 `need/hp/startHp`，並給予明確的新 60 秒期限。不要在每次 `normalize()` 時重設期限，否則會形成無限續時。

3. **已逾時的攻擊仍可被判為勝利。**  
   位置：[clicker-apoc-economy.js:193](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:193)、[clicker-apoc-economy.js:217](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:217)、[clicker-apoc-ui.js:169](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:169)。  
   重現：王剩 1 HP，於 `deadline + 10000` 呼叫 `settle(tap(a, now), now, 0)`；實測事件是 `win`。遊戲每秒結算一次，期限過後、下一次 tick 前仍可點擊；隱藏視窗逾時後返回，也有第一個 tick 前的空窗。  
   建議：點擊前先處理到期；放置傷害只計算截止期限以前的時間，再判斷勝負。不能只把失敗判斷移到最前面，否則可能吞掉期限前合法的致死傷害。

**值得修**

1. **冷卻與保留傷害沒有呈現在等待畫面，容易誤以為按鈕壞掉或進度消失。**  
   位置：[clicker-apoc-ui.js:200](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:200)、[clicker-apoc-ui.js:217](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:217)、[clicker-apoc-ui.js:57](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:57)。  
   重現：打掉王 40% 血量後失敗。等待畫面顯示滿血、停用的「再次挑戰」，下方卻寫「按『開戰』開始」；沒有冷卻秒數，也沒有保留傷害說明。等 60 秒重打，才看到約 70% 的剩餘血量。  
   建議：冷卻時顯示「再次挑戰・剩 N 秒」，等待血量使用 `need − bossCarry.dealt`，失敗通知說明本次保留量。按鈕的停用邏輯本身正確。

2. **難度模擬漏掉正式遊戲的 1.0 加成，不能代表所有已解鎖玩家。**  
   位置：[tools/sim/apoc.js:30](D:/claude研究/clawd-pet-v3/tools/sim/apoc.js:30)、[tools/sim/apoc.js:48](D:/claude研究/clawd-pet-v3/tools/sim/apoc.js:48)、[clicker-apoc-ui.js:38](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:38)。  
   重現：預設模型得到 67 分鐘；在記憶體中讓初始隊伍帶 `boost={power:2,click:1,skill:1,cd:1}`，其餘相同，實測變成第 1 天 33 分鐘、失敗 0 次。這對應收益祝福 Lv.10 的戰力倍率。另外，模擬沒有配置技能槽，`SKILLS=1` 實際上也沒有技能可放。  
   建議：補入具代表性的 1.0 祝福／神器資料與技能配置，再確認老玩家一天通關是否符合預期；目前不宜直接據此再調高血量。

**不用修（說明為什麼）**

1. **合法保留傷害的累加、上限與勝利清除邏輯成立。**  
   位置：[clicker-apoc-economy.js:117](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:117)、[clicker-apoc-economy.js:204](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:204)。  
   重現／檢查：第一次打掉滿血 40% 後失敗，保留 30%；第二次再打掉滿血 20%，累積保留 45%。別站、負數、字串會被丟掉，超量值夾到剩 1 HP，勝利清除保留；相關測試通過。有效戰鬥也不會僅因重新整理就被 `normalize()` 清掉，因此沒有正常重載重複累加的路徑。  
   建議：維持算法。允許使用者直接改本機存檔時，夾值只能防壞資料，不能視為防作弊保證。

2. **目前沒有理由回退背景逐格動畫，或認定它會破壞 1.0。**  
   位置：[clicker.css:1271](D:/claude研究/clawd-pet-v3/src/clicker.css:1271)、[clicker.css:801](D:/claude研究/clawd-pet-v3/src/clicker.css:801)、[clicker-apoc-ui.js:144](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:144)。  
   重現／檢查：第 4、8 站連點，切換減少動畫設定，再回到 1.0 王關。從程式可確認：新 selector 只命中 `#apoc-enemy`；背景動畫與受擊 `transform` 使用不同屬性；減少動畫時停在第一格；共用 keyframes 沒有被修改。  
   建議：維持此實作。WebView2 與直式縮放是否仍有接縫，本次未做視覺實測，不能宣稱已驗收。

3. **王關獎勵變少，本身不足以判定抽卡節奏被破壞。**  
   位置：[clicker-apoc-economy.js:25](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:25)、[clicker-apoc-economy.js:172](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:172)。  
   重現／檢查：執行一般玩家與勤快玩家兩組模擬，均完成 20 站並抽到 140 次，沒有因王關獎勵降低而卡死。  
   建議：保留已定案的 2% 獎勵公式；抽數從 210 降至 140 是節奏變化，不是獨立程式錯誤。先補齊上述加成模型，再決定是否需要調整。