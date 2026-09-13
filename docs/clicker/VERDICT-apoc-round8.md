唯讀複檢完成：**1 項必修、1 項值得修**。已檢查 `git diff 1fdbfa1`、交接第〇之十二節與五張新增王圖，未修改任何檔案。

**必修**

1. **刷怪空檔會切回王站 BGM，反覆刷怪時反覆換曲。**  
   位置：[clicker-apoc-map.js:38](D:/claude研究/clawd-pet-v3/src/clicker-apoc-map.js:38)、[clicker-apoc-ui.js:214](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:214)。  
   重現：第 4 站王戰失敗 → 回第 3 站刷怪 → 殺死刷怪。此時 `stage=null`、`progress=3`，`musicFor()` 選到第 4 站的 `rival`，但畫面仍顯示第 3 站刷怪中。重新出怪後又換回 `mistvalley`。記憶體探針已確認這組選曲結果。  
   建議：沒有 `stage` 時，沿用 `renderStage()` 的 `farmGap` 判斷，以 `progress-1` 選曲；只有實際重挑王時才切王曲。這也能避免神話技能曲跟著反覆重建。

**值得修**

1. **末世的換桌布確認頁沒有說清楚重置的是 1.0。**  
   位置：[clicker-prestige-ui.js:27](D:/claude研究/clawd-pet-v3/src/clicker-prestige-ui.js:27)、[clicker-prestige-ui.js:101](D:/claude研究/clawd-pet-v3/src/clicker-prestige-ui.js:101)。  
   重現：在末世開啟「換桌布」→ 切至「換桌布」分頁。說明直接寫「清除錢幣、攻擊力、全隊訓練」，玩家容易理解成目前末世的數值；實際清除的是桌邊進度。  
   建議：末世模式補一句「重置 1.0 桌邊進度；末世金幣、訓練與關卡進度保留」，並將清除欄標為「1.0 會清除」。

**不用修（本輪未發現問題）**

- **換曲收尾與連續 `sync()`**：[clicker-music.js:84](D:/claude研究/clawd-pet-v3/src/clicker-music.js:84)。驗證了技能播放中換站、淡出中換站、suspend 淡出中恢復並換站，以及連續呼叫。音訊替身測試均通過，未發現舊計時器停止新軌或舊 transport 殘留；不建議為此重寫流程。
- **`fx.mythic` 與技能覆寫**：[clicker-apoc-economy.js:163](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:163)、[clicker-apoc-economy.js:273](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:273)。舊檔缺欄位預設為 false；次數耗盡會清除，傳說技能覆寫也會關閉；技能祝福仍套用。未用完的效果跨站保留符合次數型設計，無須在換站或輸王時強制清除。
- **末世輪迴後的場景與加成**：[clicker.js:776](D:/claude研究/clawd-pet-v3/src/clicker.js:776)、[clicker-apoc-ui.js:48](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:48)。返回桌邊會重新 mount 場景；末世 boost 每次從目前存檔重算。流程上無須在末世輪迴時先掛回 1.0 場景。
- **Esc 分流**：[clicker.js:849](D:/claude研究/clawd-pet-v3/src/clicker.js:849)。一般網頁未注入 `__TAURI__`，不再誤進關窗流程；分頁隱藏仍有原本的 suspend 路徑，無須恢復 Esc 暫停。
- **王圖與地圖比例**：[clicker-apoc-ui.js:235](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:235)、[clicker.css:1273](D:/claude研究/clawd-pet-v3/src/clicker.css:1273)、[clicker-apoc-map.js:39](D:/claude研究/clawd-pet-v3/src/clicker-apoc-map.js:39)。五張圖尺寸符合設定；換普通怪會清除 inline 寬高與背景，單格圖不套逐格動畫，減少動態模式有處理。地圖總高與 22% 疊合公式一致，連線依節點位置計算，未見需修的靜態邏輯問題。

驗證結果：`npm.cmd test` **212/212 通過**；音訊替身四組情境通過。Playwright 因唯讀環境沒有可寫暫存目錄而無法啟動，因此本次**未重新完成瀏覽器實聽、390×844 排版與捲動驗收**；上述視覺結論限於素材檢視與程式檢查。