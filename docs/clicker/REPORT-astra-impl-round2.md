# 珍母點點：第二輪實作報告

基準提交：4678e5c。開工先執行 `git log -3`，閱讀視覺定案並查看 ref-mock-a／b／c，以 mock-a 為主方向。

## 修改檔案

- `src/clicker.html`：桌墊、旗子、接觸影、夥伴列與翻頁、三技能卡底座、寄生標籤、主畫面 canvas、入隊過場層、名冊裝備詳情；移除舞台隊員、宿主大立繪與三張撕痕結構。
- `src/clicker.css`：牛皮紙平鋪；桌墊、紙板與粉／綠／紫標題使用含中心填充的 9-slice；兩處膠帶；字級、3px 按鈕描邊、硬陰影、實色禁用；80×88 夥伴格、貼紙頭像、星級、槽位章、4px 稀有度色帶；固定量尺與粒子層級。
- `src/clicker-stage.js`：五狀態門檻與包數事件；開封停留 180ms、淡出 100ms、下一包淡入 140ms；過場後讀最新進度。普通 8 顆、第三次起連點 12 顆、×10 重擊 18 顆加一道光痕，浮字共用袋口錨點。被動跨狀態 4 片碎紙，不疊加手動粒子；重擊優先，倍率只在實際消耗那一击呈現。單一 GachaFx renderer 的主畫面 scope；夥伴分頁、寄生標籤、依目標頁分批入隊與重複角色合併。
- `src/clicker.js`：技能卡取代 select；點夥伴進名冊，明示三槽裝備、鎖定門檻、目前槽位與更換等待；收益／剩餘次數放技能卡。通知移到夥伴標頭，1400ms 收起；手動點擊傳入一次完整演出描述。
- `src/clicker-gacha.js`：收下前保留每張結果的角色 ID 與卡片中心座標，經濟提交成功後飛入夥伴格；每次進招募重新綁定招募 canvas，退出清理後恢復主畫面。原揭曉、射線與整桌震流程保留。
- `tools/test/clicker-browser.py`：更新技能卡與宿主標籤選擇器，960×640／DPR 1.25 截圖、合法存檔場景、可控時鐘、粒子配方與 canvas 非空像素斷言、分頁／多包進度／renderer 切換驗證。
- 本報告：依交付要求寫入，作為原列舉可寫範圍的明示例外。

經濟、存檔格式及經濟測試未修改；沒有改動禁止範圍。舊 PNG 檔案保留，但 clicker 程式已無 clicker-desk.png、clicker-tear.png、clicker-bag.png、clicker-bag-open.png 引用。

## 與定案的差異及原因

1. 依使用者拍板保留真素材，未採原定案平塗去材質方案。桌墊採主方向的大面積綠紙面，取代原舞台框；五區與點擊熱區座標維持。實測桌墊 1015×760、紙板 1003×615，切片採桌墊 96／48px、紙板 80／18px。標題三種尺寸不同，採 70／9px stretch，避免圓角與細節重複拼接。
2. 依拍板使用 shard 紙屑，不用 sprite 9；兩面同色，source-over，不透明（fadeK: Infinity），粉 #EF8E8E 與奶白 #FFF3DC。普通六片紙屑加兩顆 sprite 14 金色小閃；連點十二顆；重擊十八顆另加 sprite 5 光痕。未更動共用 renderer；既有 shard 繪製以 w/h 控制尺寸。
3. 夥伴縮圖採中空白貼紙素材，外框 50px、內部角色 SVG 40px，保留耳朵等輪廓。
4. 五張袋圖實測皆 448×512，顯示 154×176px，水平中心仍為舞台 x388。完整圖可見封口起於素材 y122，不是定案假設的靠近畫布頂端；圖盒採 x311／y130，使封口約落在指定錨點 x388／y172。接觸影同步上移，圖像 transform-origin 保持 50%／93.75%（袋底 y480）。各狀態仍用同一尺寸與位置。
5. 只有兩處膠帶，各大區一處；並未為湊滿四處而增加裝飾。長技能角色名以省略號與 title 保留完整名稱，字級不縮小。
6. 原瀏覽器卡面比較取 HEAD 的 gacha.css，但 HEAD 已拆出 gacha-card.css；基準改為 HEAD 兩檔拼接，再比較全部 computed style。這是測試基準修正，未修改共用 CSS。

## 驗證結果

- `node --check`：所有 `src/clicker*.js` 通過；測試 JS 亦檢查。
- `npm.cmd test`：29 tests、29 pass、0 fail。PowerShell 封鎖 npm.ps1，改用同一 npm 的 `.cmd` 入口，沒有更改系統執行政策。
- `python tools/test/clicker-browser.py`：PASS。包括真實點擊限流、教學、技能、十二角色、五種招募模式、pending 重開與雙擊收下、儲存失敗、隱藏／恢復、招募卡面 computed-style 等價，以及第二輪新增場景。粒子斷言同時檢查 spawn 配額與主 canvas 非空 alpha 像素；多包過場後與最新經濟進度比對。
- Playwright 以 route 讀取本地 src 檔案回覆請求，沒有啟動 server。場景使用合法存檔，短暫結算高水位避免素材載入時間改變指定進度；Python 時鐘使用 datetime，避免秒／毫秒歧義。
- 查看實際截圖確認紙材、六格、寄生、入隊過場與重擊畫面。`git diff --check` 通過。
- 未 build、未啟動 Tauri／server、未 commit。

## 驗收圖

全部輸出至 `tools/test/.clicker-artifacts/`（已 gitignore），邏輯 960×640、PNG 1200×800：

- `buddies-1.png`、`buddies-6.png`、`buddies-7.png`、`buddies-7-page2.png`
- `skills-cooldown.png`、`parasite-active.png`、`roster.png`
- `bag-0.png` 至 `bag-4.png`
- `click-normal.png`、`click-chain.png`、`click-heavy.png`
- `join-tutorial.png`、`join-duplicate.png`、`multi-package.png`
- 保留既有 `opening.png`、`tutorial.png`、`parasite.png`、`pending.png`

## 未完成與驗證界線

本輪 A1–A7、B1–B2 的程式接入已完成，素材沒有缺件。未進行 Tauri 原生視窗的實機驗收；此次驗證為離線 Chromium。入隊留圖涵蓋教學新夥伴與招募重複夥伴，並非每種五連組合都各留一張。無 build／打包結果可宣稱。
