# 珍母點點：第六輪實作

## 範圍

先執行 `git log -4`，起點為 `052df2f`。修改僅限 `src/clicker*.*`、`tools/test/clicker-*` 與本報告。未 build、未起 server、未 commit；未修改 ChipForge、Rust、共用 gacha、pet、index 或 menu。`clicker-cutin.js` 僅將 `play()` 珍母版 focus-x 的 256 改為 320，T／EASE 未動。

## 已實作

- 音樂基準場景 .24、技能 .32，再乘使用者音量（預設 .6），實際預設出口分別 .144／.192。音效 scope 出口乘音效音量（預設 .8），含乾聲及經 scope 回流的迴響、點擊、升級與切入音。
- 頂列單一 ♪ 按鈕，160×110 紙板浮層；兩條紙膠帶 range、40px 貼紙滑塊與各自靜音。沿用 `settings.music` 控制音樂、`settings.muted` 控制音效。點外部／Esc 關閉，Esc 先關浮層而不關視窗。
- `input` 即時預覽，`change` 才存音量；預覽中即使自動存檔或其他操作存檔，也保留先前已提交的音量。舊存檔補預設，非法音量拒收。
- 場景根套 saturate(.78)、contrast(.92)、brightness(1.04)，遠景 opacity .85，草花再 saturate(.85)。草四株、花三朵避開中心 ±120px；道具僅郵筒，兩朵雲的整張圖位於 y<60。
- 珍母與點擊區 left=184，接觸影及寄生標籤同步右移 64px；背後靜態 300×220 奶白舞台光、SVG 四方向 2px 奶白陰影。包裝維持 x392。
- 三團樹冠保留獨立 DOM／搖擺。樹幹原圖 360×443，量測左右枝頭約 (42,87)、(318,30)，中央分叉 (180,165)；映射至舞台約 (34,107)、(126,76)、(80,149)。三團中心各在錨點上方 10px，高 96／120／88，宽 118／130／118；刻意橫向展寬以連接狹長素材。每兩團 bbox 的水平、垂直重疊均超過較小尺寸的 20%，z 序中央 > 右 > 左，樞軸在中心下方 10px。
- 浮字 26／28／34px，奶白／金／粉填色，1.2px 深色描邊及硬陰影、22px 金幣。720ms 上升 56px，前 60ms 彈出，最後 200ms 淡出；浮字使用線性時間軸以維持分段時間，上限 12，既有切入期間合併規則保留。
- 量尺 (24,308)、560×40，票券 9-slice；72px 包數、14px 軌道、150px 進度文字，粉→金填充／滿格金色保留。數字接入既有量尺 tween（每幀 .25、最長 180ms）；技能槽 bottom 由 20 改為 72。

## 音訊排程實際參數

所有淡化均由 AudioParam 排程；setTimeout 僅處理效果期限、淡化結束後停止 transport／suspend，沒有新增 setInterval 改 gain。既有 ChipForge 的音符排程器不變。

| 時機 | 參數 |
| --- | --- |
| 初次／恢復場景 | 64 點 sin 曲線，1200ms 到 .24 |
| 音量滑動 | 獨立出口 gain 的 setTargetAtTime，時間常數 200/3ms，200ms 約完成 95% 變化，不中斷音樂包絡 |
| 技能起動 | 場景 cancelAndHold 後以 τ=.12s 逼近 .036（.24 的 15%）；400ms 時約完成 96.4% duck |
| 技能進場 | t=.26s 開始，從 step 0 排音；64 點 sin，700ms 到 .32；低通同時從 900Hz 指數掃到 14kHz |
| 技能結束 | 技能 64 點 cos，1400ms 到 0，低通 14kHz→1.2kHz；場景晚 300ms，以 sin 插值 1400ms 從當前值回 .24 |
| 連續技能 | 持續播放時不重啟 transport／包絡；退場中取消並保持當前值，400ms 回 .32，低通同步回 14kHz，場景重新 duck |
| 隱藏／音樂靜音 | 兩軌 300ms cos 淡出，再停 transport 與 suspend；恢復沿用場景播放位置 |

取樣 i=0…63，角度為 i/63 × π/2，確保兩端完整抵達 0／目標。從非零值恢復時使用 `from + (target-from) × sin(angle)`。

注意：需求同時指定「錯開 300ms、兩軌不同目標」與「總能量不凹陷」，無法以同相位 sin²+cos²=1 嚴格同時滿足。本輪保留指定時序與 sin／cos 包絡，未加入額外響度補償，因此不宣稱恆功率或實際感知响度恆定。

## 驗證與截圖

- `node --check`：所有 `src/clicker*.js` 通過。
- `npm.cmd test`：32/32 通過（PowerShell 的 npm.ps1 被執行政策阻擋，改用 npm.cmd 執行同一 test script）。
- `python tools/test/clicker-browser.py`：第六輪、第五輪與第二至四輪完整互動回歸均通過。Playwright 以 request routing 讀取本地檔，沒有 HTTP server。舊有隱藏後清空排程的檢查由 100ms 改在 500ms 執行，容納本輪新增的 300ms 淡出及最後一批音符排程。
- 新增實際 AudioParam 在 0／300／700／1000ms 取樣、單調性、相鄰差 <.25、退場反轉、結束 1.7s 回目標，以及音量預覽／存檔、浮層開關、SFX 出口、置中、浮字 computed style、量尺尺寸與樹冠 bbox 重疊檢查。
- 在音量 .4 下，技能進場實測有效 scene／skill gain 約為 (.096,0)、(.02060,.01413)、(.01462,.10827)、(.01442,.128)。原始值見 [gain JSON](../../tools/test/clicker-artifacts/round6-gains.json)。

截圖放在允許寫入的測試產物目錄（該目錄受 gitignore 忽略）：

- [新場景](../../tools/test/clicker-artifacts/round6-scene.png)
- [浮字瞬間](../../tools/test/clicker-artifacts/round6-floater.png)
- [量尺](../../tools/test/clicker-artifacts/round6-meter.png)
- [音量浮層](../../tools/test/clicker-artifacts/round6-volume.png)

## 未完成／限制

- 未進行 Tauri 實機聽感驗收或 Rust 音訊 session 驗證，依指示不 build、不啟動應用程式。瀏覽器 AudioParam 數值通過不等同真人聽感驗收。
- 嚴格恆功率補償未實作，原因如上。
