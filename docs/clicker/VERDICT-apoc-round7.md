複檢結論：**1 項必修、3 項值得修，建議先修正五連會遺失抽卡結果的問題。** 全程未修改檔案。

已檢查 `git diff 01362b1`、新增特效模組、地圖素材與美術回報。既有 Node 測試全部通過；另以記憶體內測試重現下列兩個邏輯問題。Playwright 因唯讀環境沒有可用暫存目錄而無法啟動，以下不宣稱完成實機驗收。

**必修**

1. **五連已扣款，但待領結果會被清除，玩家拿不到卡。**
   
   位置：[clicker-gacha.js:49](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:49)、[clicker-apoc-economy.js:148](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:148)。
   
   重現：持有 10 張券 → 進入招募 → 五連。新入口允許抽 5 張，但 `normalize()` 只接受 1 或 10 張的 pending；收下與末世 tick 都會經過正規化。
   
   **實測：券從 10 降到 5，五張結果正規化後變成 `pending:null`，`collectAccepted:false`。** 單抽、十連對照組均可正常領取。末世 tick 再提交狀態後，待領結果也會從存檔消失。
   
   建議：讓購買、pending 驗證與恢復流程一致支援 `[1,5,10]`，補上五連扣款→正規化／重開→領取的測試。

**值得修**

1. **前一擊的計時器會截斷後一擊震動。**
   
   位置：[clicker-apoc-ui.js:123](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:123)、[clicker-apoc-ui.js:149](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:149)。
   
   重現：普通命中後立即破盾或擊倒。每次震動都排程移除同一個 class，卻沒有取消舊計時器。
   
   **實測：0ms 普通命中、20ms 擊倒；擊倒原應震到 320ms，卻在 90ms 被上一擊取消。**
   
   建議：保存並取消上一個震動計時器，或用演出序號判斷是否仍是最新一擊；保留原強度與時長。

2. **恢復結果後，「繼續抽」會消失。**
   
   位置：[clicker-gacha.js:89](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:89)、[ceremony.html:1366](D:/claude研究/clawd-pet-v3/src/apoc/ceremony.html:1366)。
   
   重現：單抽／十連結果尚未領取便重開，或收下時發生存檔失敗、進入 `replay()`。`restore()` 呼叫 `play(ids,badges)`，沒有傳入 again offer，因此即使買得起，恢復後也只剩收下。
   
   建議：恢復時依 pending 張數重新計算並傳入續抽價格與可用狀態，同步修改產生器。此項不會丟卡，但會中斷續抽操作。

3. **地圖連線的水平座標仍未對準站點中心。**
   
   位置：[clicker-apoc-map.js:109](D:/claude研究/clawd-pet-v3/src/clicker-apoc-map.js:109)、[clicker.css:1472](D:/claude研究/clawd-pet-v3/src/clicker.css:1472)。
   
   檢查方式：開地圖，比較橫式／直式相鄰站點與連線端點。站點中心是 `43% + 0/36px + 26px`，線端卻是 `43%/47%`；偶數索引站固定差 26px，另一側還隨寬度變化。
   
   建議：連線與站點共用中心座標，或量取節點中心後轉成 SVG 座標。這是既有水平偏移，本輪只修正了垂直對齊。

**不用修／目前不列缺陷**

- **不必因 capture 監聽較晚註冊就改寫抽卡入口。**  
  [ceremony.html:1339](D:/claude研究/clawd-pet-v3/src/apoc/ceremony.html:1339) 使用目標元素 capture 加 `stopImmediatePropagation()`，可攔住原型的 bubble click。Enter／Space 產生的 click 也經過相同事件流程；原型鍵盤處理沒有另一條購買入口。測試掛鉤直接播放也不等於能領取任意卡，主頁仍按 pending 落帳。建議保留，實機補驗滑鼠與鍵盤即可。

- **收下失敗的恢復路徑，以及關閉後快速重開的計時器，已有處理。**  
  [clicker-gacha.js:60](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:60)、[clicker-gacha.js:100](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:100)：重開會取消關閉計時器；一般存檔失敗會移除 `.closing` 並恢復結果，`clearRun()` 也重設 `collecting`。可用「存檔失敗後再次收下」及「280ms 內重開」驗收，無須僅因淡出等待便重做流程。

- **地圖不會因背景圖尚未下載而高度為零，也無須重畫全部素材。**  
  [clicker.css:1463](D:/claude研究/clawd-pet-v3/src/clicker.css:1463)：高度由 CSS `aspect-ratio` 撐開。五張正式 WebP 均為 971×1619，接段上下帶平均 RGB 的最大通道差約 **10.49**，低於簡報門檻 18；拼接預覽可辨識五種地景。建議保留，段內色帶與留白屬美術精修。

沒有實機效能量測支持「明顯變慢」的結論，因此本次不提出削減粒子、金幣或震動的建議。另，檢查期間工作樹的 `clicker-stage.js` 曾被外部更新；本報告的震動缺陷指向末世程式，未將已改動的 1.0 拆包震動列入問題。