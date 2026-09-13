已唯讀檢查 `git diff 5583ae4`，包含產生器與 `ceremony.html`／`ceremony.css`，未修改檔案。`npm.cmd test` **203／203 通過**；另以記憶體內執行驗證事件與經濟流程。未重跑會輸出截圖的 Python UI 測試，以下 UI 問題依程式路徑判定，非瀏覽器實測。

**必修**

1. **放大卡一按就關，無法拖曳欣賞。**  
   位置：[clicker-album.js:447](D:/claude研究/clawd-pet-v3/src/clicker-album.js:447)、[clicker.js:825](D:/claude研究/clawd-pet-v3/src/clicker.js:825)。  
   重現：末世卡冊 → 任一普通夥伴詳情 → 放大 → 按住卡面準備拖曳。放大層掛在 `#game`，不在 `.panel` 裡；`pointerdown` 冒泡後被判為「點面板外」，立即呼叫 `closeZoom()`。已用既有事件處理器驗證此分支。  
   建議：將 `#card-zoom` 納入面板外點擊的排除範圍，背景關閉交由放大層自己的事件處理。

2. **典藏包尚未收下，背景仍會自動接關。**  
   位置：[clicker-apoc-ui.js:152](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:152)、[clicker-gacha.js:59](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:59)。  
   重現：戰鬥中開十連，留在典藏包，等待原本那隻怪被放置傷害打死；下一次 tick 會開下一站。`autoFight()` 只檢查 `#recruit-layer`，典藏包用的是另一個 `#apoc-ceremony`；也未擋 `apoc.pending`。記憶體驗證得到 `ceremonyVisible=true、pending=true、stageStarted=true`。  
   建議：自動開戰同時檢查典藏包是否開啟及末世 pending，或注入統一的招募活動狀態。既有戰鬥是否繼續結算可維持原規則。

**值得修**

1. **連抽最後收下，入隊演出被拆成兩次並行呼叫。**  
   位置：[clicker-gacha.js:139](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:139)、[clicker-gacha.js:301](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:301)。  
   重現：1.0 五連 →「收下並繼續五連」→ 下一包「收下夥伴」。`close()` 先播放累積的 `pendingJoins`，接著 `collect()` 又播放本包；兩包抽到相同角色時會重複飛入，不同隊伍分頁則可能互相切頁、漏播。記憶體驗證確實產生兩次 `joined(['same'])`。落帳本身沒有重複。  
   建議：本包先併入 `pendingJoins`，統一由 `close()` 去重並播放一次。

2. **放大層的鍵盤焦點會跑回背後卡冊。**  
   位置：[clicker-album.js:452](D:/claude研究/clawd-pet-v3/src/clicker-album.js:452)、[clicker.js:848](D:/claude研究/clawd-pet-v3/src/clicker.js:848)。  
   重現：放大卡後按 Tab；既有焦點循環只找到 `#roster`，把焦點送回被遮住的卡冊。按 Esc 關閉放大層，也沒有把焦點還給放大鍵。  
   建議：焦點循環優先處理 `#card-zoom`；開啟時記錄來源按鈕，關閉時恢復焦點。

3. **1.0 放大卡轉向後，縮放比例沒有重算。**  
   位置：[clicker-album.js:451](D:/claude研究/clawd-pet-v3/src/clicker-album.js:451)、[clicker-album.js:642](D:/claude研究/clawd-pet-v3/src/clicker-album.js:642)、[clicker.css:1577](D:/claude研究/clawd-pet-v3/src/clicker.css:1577)。  
   重現：1.0 橫式開啟放大卡，再旋轉成直式。容器切換成依寬度定尺寸，但 `--zoom-k` 仍是開啟時的值，卡面不再配合容器，可能超出畫面。  
   建議：在既有 resize／relayout 路徑重新量測目前放大卡的比例。

4. **抽卡總覽原本的焦點移轉變成不可達程式。**  
   位置：[clicker-gacha.js:184](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:184)。  
   重現：用鍵盤啟動 1.0 抽卡並略過；結果顯示後，「收下夥伴」不再自動取得焦點，焦點可能留在已隱藏的略過鍵。原本的 `$('collect').focus(); render();` 被移到 `badgeNode()` 的 `return box` 後面。  
   建議：把這兩句移回 `summary()` 結尾。

**不用修（說明為什麼）**

1. **招募層沒有掛 `boost`，目前不會造成戰力漏算。**  
   位置：[clicker-gacha.js:29](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:29)、[clicker-apoc-ui.js:44](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:44)。  
   檢查步驟：帶有印記／祝福的狀態依序走 purchase、collect、下一次 view／tick。末世 purchase／collect 只處理抽卡費用與收藏，不結算戰鬥；真正計算傷害的 UI 路徑會重新掛加成，提交前刪除。  
   建議：維持現狀，不必把加成存入存檔。

2. **徽章試算不會提前領卡，也不會重複落帳。**  
   位置：[clicker-gacha.js:159](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:159)、[clicker-economy.js:572](D:/claude研究/clawd-pet-v3/src/clicker-economy.js:572)、[clicker-apoc-economy.js:309](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:309)。  
   檢查步驟：對同一 pending 重複試算、比較原狀態，再對收下後的狀態重複 collect。驗證原狀態未變，末世第二次收下被拒絕。  
   建議：保留試算方式。

3. **王關失敗標記不會阻止手動再次挑戰。**  
   位置：[clicker-apoc-economy.js:106](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:106)、[clicker-apoc-economy.js:186](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:186)。  
   檢查步驟：僅在記憶體把 `BOSS_TIME` 設為正值，讓第 4 站超時，normalize 後等冷卻結束再呼叫 fight。失敗標記保留，手動重試成功進入同站。  
   建議：維持現狀；標記只擋自動開戰是正確的。

4. **典藏包橋接沒有漏掉略過／恢復，也沒有沿用上一抽徽章。**  
   位置：[ceremony.html:1338](D:/claude研究/clawd-pet-v3/src/apoc/ceremony.html:1338)、[ceremony.css:169](D:/claude研究/clawd-pet-v3/src/apoc/ceremony.css:169)、[build_ceremony.py:54](D:/claude研究/clawd-pet-v3/tools/apoc/build_ceremony.py:54)。  
   檢查步驟：沿正常翻卡、`skipAll()`、`restore()` 追到 `completeSlot`；再追下一抽的 `play()`／`clearRun()`。呼叫會走重新指定的函式，新一抽替換徽章陣列，舊節點隨清場移除；產物橋接也與產生器一致。  
   建議：維持現有橋接，不需改寫演出本體。