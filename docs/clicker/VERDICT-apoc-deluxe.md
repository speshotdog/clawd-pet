目前修改尚不宜提交：確認 4 項必修的玩家操作錯誤；200 項單元測試通過，但瀏覽器畫面驗收未能執行。

**A．逐項複檢**

| 簡報項目 | 結論 |
|---|---|
| 1．典藏包落帳、防重與存檔失敗 | 同一 draw ID 第二次收下會被拒絕，唯讀 Node 驗證通過；但存檔失敗會卡住典藏包，見 B1。末世單抽仍受桌邊設定限制，見 B2。 |
| 1．ready、restore、轉向、回前景、切世界及匯入 | `active` 會阻止轉向／回前景重播；正常 UI 被 `inert` 隔離，未確認玩家能在典藏包中直接切世界或匯入。`play()` 等待 ready 沒有取消機制，但未找到正常操作能在等待期間重入的路徑，不列為已發生錯誤。 |
| 1．postMessage | 有驗 `e.source`；目前固定載入同源 iframe，未確認 `'*'` 造成可利用問題。訊息未附 draw ID 是防護不足，不能據此宣稱會重複落帳。 |
| 2．地圖／戰鬥、初始化、reload、setWorld | `map-open` 與 `hidden` 的開關成對；隱藏的技能、夥伴列無正常滑鼠入口，空白鍵也只綁舞台按鈕。惟地圖轉直式會留下零縮放，見 B3；模式面板漏接 Esc，見 B4。 |
| 3．精裝卡面及素材 | 指定卡面呼叫點已替換；未確認正常末世流程仍顯示舊卡。71 張卡、79 個卡圖映射、65 個遮罩映射及兩份 CSS 的直接素材路徑均存在。卡面生命週期有記憶體保留問題，見 C。 |
| 4．UI 體檢器 | 新判準有漏報路徑，且未深入 Shadow DOM，不能以「0 條」證明精裝卡內容完整，見 C。 |

驗證範圍：已完整讀取簡報、檢查 `git diff HEAD`、指定未追蹤 JS、三支 `tools/apoc/*.py` 與典藏包尾端橋接。`npm.cmd test`：**200 通過、0 失敗**。Playwright 因唯讀環境沒有可用暫存目錄而無法啟動，三支 Python 畫面測試未完成；未改檔、未 build、未起 server、未 commit。

**B．必修：玩家可遇到的錯誤**

1. **收下時存檔失敗，典藏包失去所有恢復入口。**
   - **重現：**末世抽卡至結果頁；讓此次儲存寫入失敗，例如儲存空間不足，再按「收下」。
   - **實際結果：**iframe 於 220ms 後清掉結果；主頁提交失敗而保留 `pending`、典藏包與 `inert`。重試儲存鍵在被隔離的主頁內，`restore()` 又因典藏包仍 active 而不重建結果。須重新載入才能恢復。
   - **證據：**Node 替身測試確認失敗後 `pending=true`、`blocked=true`、`active=true`、`inert=true`，再呼叫 restore 不重播；iframe 清場由程式碼確定。
   - **位置：**[收下提交流程](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:69)、[restore 的 active 判斷](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:321)、[iframe 先清場](D:/claude研究/clawd-pet-v3/src/apoc/ceremony.html:1310)。

2. **桌邊選過限定多連演出，末世單抽會永久停用，直到回桌邊改設定。**
   - **重現：**桌邊選「撕包」「拉幕登場」或「腳印召喚陣」；切到末世、進入戰鬥，持有至少一張券。
   - **實際結果：**單抽「招募！」停用，顯示要求切換演出的提示；末世卻已隱藏演出設定。典藏包本身支援單抽，`start()` 也已放行，但按鈕的 `render()` 仍讀桌邊 `mode.counts`。
   - **證據：**同一末世狀態，Node 執行實際 render：`rip` 單抽 disabled 為 `true`，改 `wish` 為 `false`。
   - **位置：**[單抽支援判斷](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:100)、[隱藏末世演出入口](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:231)。

3. **地圖開著時轉直式，進入戰鬥後舞台縮成 0。**
   - **重現：**橫式進入末世地圖 → 轉為直式 → 按「進入戰鬥」。
   - **實際結果：**resize 對隱藏的 `#stage-fit` 量寬，得到 0，寫入 `--stage-fit:0`。關閉地圖只恢復顯示，沒有重算縮放；戰鬥舞台因此不可見，直到再次觸發尺寸重算。
   - **證據：**抽取實際 `fitStage()` 執行，隱藏舞台量測值確實產生 0；CSS 與地圖 close 路徑可確定後續結果，未作瀏覽器實測。
   - **位置：**[量測隱藏舞台](D:/claude研究/clawd-pet-v3/src/clicker.js:447)、[關地圖未重算](D:/claude研究/clawd-pet-v3/src/clicker-apoc-map.js:119)、[舞台縮放 CSS](D:/claude研究/clawd-pet-v3/src/clicker.css:1004)。

4. **模式面板按 Esc，會走關閉遊戲流程。**
   - **重現：**解鎖末世後開啟「模式」面板，按 Esc。
   - **實際結果：**`closeTopPanel()` 沒列入 `modes`，事件掉到 `closeWindow()`。桌面版會關閉遊戲視窗；網頁版會停止計時並設為不可見，但面板仍在，後續經 `action()` 的操作被阻擋，直到失焦再回前景等恢復事件。
   - **證據：**完整 Esc 分派及 suspend／action 路徑可由程式碼確定。
   - **位置：**[漏列模式面板](D:/claude研究/clawd-pet-v3/src/clicker.js:804)、[Esc 落入 closeWindow](D:/claude研究/clawd-pet-v3/src/clicker.js:835)、[停止遊戲流程](D:/claude研究/clawd-pet-v3/src/clicker.js:413)。

**C．值得修，但不擋**

- **精裝卡移除後未解除觀察，會持續保留 DOM。**每張卡都加入 `HoloCardFace` 的強引用 `Set`，主頁翻頁、換詳情、移除拖曳殘影時沒有 `unobserve()`。記憶體保留可由程式碼確定；長時間是否明顯卡頓尚未量測，不宣稱已發生。位置：[建立時 observe](D:/claude研究/clawd-pet-v3/src/clicker-holo.js:38)、[持有卡面的 Set](D:/claude研究/clawd-pet-v3/src/apoc/card-face.js:147)。

- **體檢器會漏掉更外層的文字裁切。**`cutBy()` 遇到第一個非 visible 祖先就直接回傳；若內層裁切框容得下文字、更外層框卻裁掉文字，就停止追查而漏報。另外 `querySelectorAll('*')` 不深入 Shadow DOM，主頁精裝卡內部文字不在掃描集合。位置：[過早停止祖先檢查](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:68)、[掃描集合](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:56)。

- **地形重複貼圖的間距算錯。**第二張起的 `top` 是路線容器高度的 `100%`、`200%`、`300%`；第一張依寬高比只有約一千像素高，而容器高 2960px。其餘三張都從容器底端以外開始並被裁掉，後段路線沒有預定的地形底圖。位置：[貼圖 top 設定](D:/claude研究/clawd-pet-v3/src/clicker-apoc-map.js:35)、[地形容器與貼圖尺寸](D:/claude研究/clawd-pet-v3/src/clicker.css:1418)。