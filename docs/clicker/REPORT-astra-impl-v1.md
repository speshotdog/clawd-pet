# 珍母點點 第一版實作報告

日期：2026-09-05。依 `DESIGN-astra.md` 第四部分第一版及本輪定案實作。

## 範圍與檔案

| 檔案 | 職責 |
|---|---|
| `src/clicker.html` | 960×640 五區畫面、固定點擊熱區、商店、技能槽、名冊、收據、錯誤匯出與滿版招募層。只載入共用零件，不載入演示宿主或桌寵程式。 |
| `src/clicker.css` | 紙桌與素材尺寸、五區座標、有限 UI 動作、招募桌面／壓暗／閃光／控制列。 |
| `src/clicker-balance.js` | 12 角色基礎收益、技能名稱、第一版三技能參數、星表、離線上限、槽位門檻。可供 Node require。 |
| `src/clicker-economy.js` | 純函式：D/P、價格、升星角標、二分拆包、區間積分、點擊與教學贈卡、升級、換槽／技能、付費抽取與 pending 收下。可供 Node require。 |
| `src/clicker-save.js` | `clicker_save` 初始結構、v1 驗證、工作副本與原子提交、壞檔保留、失敗鎖定。也提供 Node 匯出供交易測試。 |
| `src/clicker-stage.js` | 珍母 33ms 預算 rAF、呼吸／眨眼／擠壓／觸手、靜態夥伴、三技能動作與寄生、拆包換圖、限量浮字、視覺停止。 |
| `src/clicker-gacha.js` | 單抽／五連入口、模式能力檢查、五模式 runtime adapter、pending 恢復／略過／收下、FX 所有權與清場。 |
| `src/clicker.js` | 宿主事件、5 秒存檔、1Hz 結算／冷卻、操作時最多 10Hz 數字、音效 scope、離線收據、視窗拖曳／關閉／縮放、名冊與基本統計。 |
| `src/gacha-card.css` | 從演示 CSS 原樣搬出卡面、稀有度變數、live、卡背、相關 keyframes 與 mini 卡面規則；末尾新增遊戲升星／熟練標籤。 |
| `src/gacha.css` | 僅移除已搬走的卡面規則。 |
| `src/gacha.html` | 僅在 `gacha.css` 後增加 `gacha-card.css` link。 |
| `tools/test/clicker-economy.test.js` | 14 個新測試，涵蓋數值、積分、教學、技能、價格、保底交接、防重與存檔失敗。 |
| `tools/test/clicker-browser.py` | 可選無頭 Chromium 整合驗證；透過 Playwright 攔截請求讀取本地檔，沒有啟動 HTTP server。 |
| `tools/test/.clicker-artifacts/*.png` | 瀏覽器驗證產生的開局、教學、寄生、名冊與 pending 總覽截圖；重跑測試會更新。 |

八張 `clicker-*.png` 是使用者於實作期間補入的素材，本輪只引用，沒有生成或改圖。`src-tauri/`、`pet.js`、`index.html`、`menu.*` 及共用 JS 檔案未修改。沒有 build、啟動 server 或 commit。

## 主要行為

- 每 1 拆包力只入帳 1 幣；拆完不再發幣。包需求用等比級數及二分結算，保留溢出；多包只播一次開包。袋圖停留 300ms 後淡出，再接下一包。
- 全部已擁有角色提供被動；中央珍母並不等於持有珍母卡。第 50 次有效點擊直接送玥玥、開放其技能，不推進抽數或保底。
- 單抽與五連價格逐張計算；保底直接使用 `GachaPool.GAME_POLICY`，入口顯示 `40 − sinceLegendary`。
- 付費抽取一次提交扣款、抽數、保底與 `pending.draw`，成功才演出；收下先驗 draw.id、用舊產能結算，再加張數清 pending，一次提交成功後才入隊。同一 id 重複收下不落帳。
- 有 pending 禁止再抽；略過只到總覽；視窗隱藏不清 pending，恢復直接總覽；招募層開啟期間不能發動技能，底下產能繼續結算。
- 玥玥與膠布點擊倍率取最高，每次有效點擊消耗所有次數效果；珍母複製最高的另一隻常態 pᵢ 快照，20 秒後結束。換槽保留角色 CD 並等待 30 秒。
- 隱藏時停止工作計時器、呼吸／眨眼、浮字、有限動作與招募 runtime；恢復後先結算及存妥，再顯示離線收據。時間倒退給 0、保留 settledAt 高水位。
- 壞檔不清空，顯示原因及原始 JSON textarea。setItem 失敗不替換交易前記憶體，鎖消費並顯示「尚未儲存」；重試按鈕只重存現有工作副本，不偷偷重做失敗消費。
- 遊戲只讀寫 `clicker_save`。遊戲回饋與招募 scopes 共用同一 AudioContext；靜音控制 scopes 的輸出，不另存共用演示設定。

## 與原設計文件的差異及原因

1. **依使用者定案**：閒置保留 3.4 秒、±1.5% 呼吸；以 33ms 預算 rAF 執行。眨眼 2.5–6 秒一次，閉 130ms。其他展示角色靜止。
2. **依使用者定案**：第 30 抽起每抽 +5% 傳說率，第 40 抽必出；不沿用文件舊版「無軟保底」。
3. **依使用者定案**：桌面、零食包、撕痕、錢幣、升級圖示與星星全部用提供的 PNG；拆包退場採明確允許的整張淡出。
4. 不另抽 `character-art.js`，直接沿用已接好的 `GachaCard.art`；宿主只為 SVG defs 與 `url(#id)` 引用加實例前綴，避免同角色出現在多處時引用碰撞。rig 結構 id 保留共用介面。
5. 寄生依 `PARASITE-V2.md` 的「同一 240×256 容器、同底對齊」實作。主角與宿主按相同比例放大，讓圓頂罩住頭臉；不採站在頭頂的偏移。未展示的宿主會替換夥伴席，總量不超過珍母＋三位夥伴。
6. 共用 runtime 的舊 reveal/rays 與 packBurst 有部分在 scope 外建立特效。為遵守唯讀邊界，遊戲 adapter 在本視窗補上所有權與清場：揭曉轉入当前 scope、射線記錄並取消、拆包爆光改用共用貼圖 spawn 的 20 片效果；每 scope 最多 24 粒子。清場同步執行最後的空幀，使共用 FX 的 running 歸零，不留下排隊 rAF。演示視窗不受此宿主調整影響。
7. v1 沒有可遷移的舊遊戲版本，保存 version／balanceVersion 檢查；未知版本顯示錯誤及匯出，不猜測降級。
8. 額外提供基礎名冊與統計入口，便於查看全部角色被動與技能名稱；完整手點／被動收入拆帳、里程碑贈卡等仍依第四部分留到第二版。

## 驗證

### 語法與 Node 測試

以下全部 `node --check` 通過：

```text
src/clicker-balance.js
src/clicker-economy.js
src/clicker-save.js
src/clicker-stage.js
src/clicker-gacha.js
src/clicker.js
tools/test/clicker-economy.test.js
tools/test/gacha-pool.test.js
tools/test/pure.test.js
```

PowerShell 的 `npm.ps1` 被現有 ExecutionPolicy 阻擋，因此直接使用同一 npm 的 `npm.cmd test`，没有更改執行政策。實際結果：**29 tests、29 pass、0 fail、0 skipped**（14 個本輪新增，15 個原有）。`git diff --check` 通過，只有現有 Git LF→CRLF 提示。

指定覆蓋：手勁 L=0/5/10/20/30、訓練費用、D/P、1/2/4/8/16/20 張星級倍率、需求／二分／溢出、離線 8h／倒退高水位、跨技能到期的積分、同 draw.id 防重。另測逐級最多購買、教學只送一次、技能不相乘、換槽 CD、五連跨硬保底、壞檔、購買及收下寫入失敗與重開 pending。

### 無 server 的瀏覽器驗證

執行 `python tools/test/clicker-browser.py`，本機已有 Python Playwright 與 Chromium，沒有安裝依賴。所有資源由 route 攔截直接讀本地檔，測試存檔在獨立瀏覽器 context，不碰實際 Tauri 存檔。

實際通過：

- 真實按鈕 12 次突發输入只記 8 次；50 次教學贈卡、技能可用、collection／抽數正確。
- 固定 240px 點擊熱區，珍母約 190px；名冊 12 格；寄生選最高常態收益角色，舞台可見夥伴不超額。
- 五種模式都能購買、啟動及略過到五張總覽；只支援五張的模式鎖單抽。
- 重新載入保留同一 pending id 並直接總覽；連點兩次收下只增加五張。
- 模擬 quota 失敗，升級不落帳、狀態顯示尚未儲存、抽取鎖住；恢復寫入後能重試。
- 啟動閒置僅一個 rAF；正常遊戲隱藏及流星演出途中隱藏，清場後量測 rAF／timeout／interval 排隊數均為 **0／0／0**；返回恢復結算，pending 直接總覽。
- 卡面切分前後，用 `git show HEAD:src/gacha.css` 作基準，對相同 DOM 的四種稀有度卡面與 locked mini、子元素及 `::before/::after` 比對 computed styles；一般與 reduced-motion 兩種設定均一致。比對時停用動畫以排除取樣時刻差，沒有修改原有卡面規則。
- 沒有瀏覽器 pageerror；檢視過開局、寄生與 pending 截圖，修正差額文字把商店撐出 360px 的問題。

## 已知未完成／驗證限制

- 其他九個主動技能、里程碑裝飾／第 100 包選角、完整收入分類統計、prestige 按設計分期未實作；名冊仍顯示技能名稱＋「後續開放」。
- 未執行 Tauri build、啟動 Rust 或實機視窗；拖曳、最小化、工作列與 DPI 縮放只按已提供的命令／事件介面接線，尚未做 Windows 實機操作驗收。
- 瀏覽器驗證涵蓋五模式啟動／取消／總覽交易，不等於逐幀人工驗收所有五模式的完整分鏡或聽感；本輪沒有改動模式原檔。
- 離線與長期數值已做公式／交易測試，沒有進行數天實際遊玩與經濟調校。

## 需要使用者決定的點

目前沒有阻塞第一版的待決策項目。採用的例外均來自本輪明確定案；後續九技能及里程碑維持原分期。
