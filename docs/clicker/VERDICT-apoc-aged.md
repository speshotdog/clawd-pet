本輪修正已處理原本的初始化汙染，但仍有兩項必修：舊化面板文字對比不足，以及卡片回正動畫會被游標移動中斷。

**A｜逐項複檢**

| 項目 | 結論 |
|---|---|
| 1. 跨世界汙染 | 初始化已分世界；`reload()`、`setWorld()` 有清除槽位、夥伴及收益快取；`resume()`、招募關閉與 `done: changed` 也有分流。未找到可確定的其他玩家觸發路徑，但所有權標記仍有防護缺口，見 C。 |
| 2. 末世技能施放 | 記憶體測試確認：成功才播放；冷卻中、提交失敗、演出已啟動均不播放。一般面板與模式入口有演出期間的阻擋；末世進場會清除桌邊 frozen 狀態，未找到正常流程誤解凍桌邊的路徑。 |
| 3. 卡片互動 | 有 capture、放開、取消及離開處理；重開詳情會建立新卡，沒有在同一卡重複綁定。回正存在已重現錯誤，見 B2。舊卡回收仍依賴後續建卡觸發 prune，並非關閉即回收。 |
| 4. 舊化樣式／素材 | `theme.css` 全部限定末世，不直接套用桌邊；22 張貼圖尺寸與 alpha 均吻合原圖。但紙底與既有文字規則混用造成 B1。產圖腳本已閱讀，未執行。 |
| 5. 直式手機 | 四欄規則存在；部分 `.skill-grid`、上限列規則也會影響桌邊。名稱隱藏後沒有承諾的 title，見 C。因瀏覽器受限，無法確認實際溢位、遮擋與點擊命中。 |

驗證：`npm.cmd test` **200 通過、0 失敗**；`git diff HEAD --check` 通過。Python 畫面測試未完成：腳本會寫截圖，而 Playwright 啟動也因唯讀環境沒有可用暫存目錄而失敗。全程未修改檔案、build、起 server 或 commit。

**B｜必修**

1. **舊化紙底仍搭配深藍版淺色文字〔程式碼確定〕**
   
   重現：進末世 → 招募並收下新卡或升星結果；另一條路徑是完成第 20 站，開啟「全線通行」面板。
   
   結果：抽卡結算的標題、名字及升星文字仍是 `#DDE6F4`；通關面板內文也繼承此色。新樣式用 `border-image … fill !important` 鋪上紙底，卻未蓋過原有較高權重的文字規則。紙圖中央實際像素為 `#C0AD88`，與該淺字對比僅約 **1.74:1**；這是素材取樣佐證，非瀏覽器整頁量測。
   
   位置：[紙底套用](D:/claude研究/clawd-pet-v3/src/apoc/theme.css:29)、[結算文字規則](D:/claude研究/clawd-pet-v3/src/clicker.css:1333)、[通關面板規則](D:/claude研究/clawd-pet-v3/src/clicker.css:1346)。

2. **放開卡片後移動游標，卡片停在半途不回正〔事件測試已重現〕**
   
   重現：末世卡冊 → 開啟詳情 → 拖曳旋轉 → 放開 → 在 280ms 內於卡面上稍微移動游標，再停住。
   
   實際結果：`pointermove` 無條件取消回正 RAF，沒有繼續回正或歸零。測試中放開 40ms 後移動游標，角度停在約 **−3.24°／6.48°**，且已無排程；離開卡面才會再次回正。
   
   位置：[回正動畫](D:/claude研究/clawd-pet-v3/src/clicker-holo.js:57)、[取消動畫的 pointermove](D:/claude研究/clawd-pet-v3/src/clicker-holo.js:65)。

**C｜值得修但不擋**

- **直式技能格隱藏名稱，卻沒有 title。** CSS 隱藏 `.slot-name`，但動態建立技能按鈕時未設定 `title` 或包含角色名的 `aria-label`；桌邊也受影響。位置：[隱藏規則](D:/claude研究/clawd-pet-v3/src/clicker.css:1526)、[按鈕建立](D:/claude研究/clawd-pet-v3/src/clicker-team.js:73)。
- **所有權標記不能真正偵測桌邊覆寫。** 末世設定 `data-world="apoc"`，桌邊 renderer 的 `replaceChildren()` 卻不清除此屬性，因此「被桌邊畫過就作廢」這層防護並不完整。目前正常切換另有清快取，**尚未確認可由玩家觸發的殘留路徑**。位置：[末世快取判斷](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:118)、[桌邊夥伴重畫](D:/claude研究/clawd-pet-v3/src/clicker-stage.js:209)、[桌邊槽位重畫](D:/claude研究/clawd-pet-v3/src/clicker.js:269)。