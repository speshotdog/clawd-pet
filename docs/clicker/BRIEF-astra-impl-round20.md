# 珍母點點 第二十輪簡報：五連 80 秒＋訓練通膨、卡面去特質字、寄生標籤、數字爽感、印記消費

給 GPT-6 Astra 實作。規則同前：**不要 build、不要起 server、不要 commit、不要碰 png 素材、不要精簡任何既有演出**。
**不要動的旗標／行為**：`WISH_TELEGRAPH=false`；`clicker-cutin.js` 的 `T`／`EASE`；點空白關面板、卡冊箭頭、轉彩 30%、神話 0.5%、`DRAW_FLOOR`、`applyZoom` 0.25 取整、第十九輪的中位數定價與新卡追隊、CSS 畫按鈕；`markMul`（1 + 0.05 × 累計印記）不動。
中文直接寫 UTF-8，寫完 `grep -n "??" src/*.js src/*.css src/*.html tools/**/*.js`。先讀 `HANDOFF-next-session.md` 第四、五、十三節與 `REPORT-astra-impl-round19.md`。基準：`npm test` 148 例。

## 1. 招募：五連 135 秒 → 80 秒；全隊訓練造成的通膨（使用者：獲取速度還是偏慢，升級隊伍讓價格膨脹）

- `DRAW_SECONDS.five` 135 → **80**。單抽 30 不動。
- 通膨：`drawCost` 用的 P 現在含全隊訓練 `1.25 ** trainingLevel`，買一級全隊訓練（價 ×2.5 的大筆支出）之後招募價立刻 ×1.25，玩家剛花光錢又看到招募變貴。改成**招募價只吃一半的全隊訓練倍率**：`rates(s, { partnerLevel, trainingLevel })` 多支援 `trainingLevel` 覆寫，`drawCost` 傳 `trainingLevel: s.trainingLevel / 2`（`1.25 ** (T/2)`，非整數次方沒關係）。個別收益與 `rates(s)` 無第二參數時完全不變。
- 模擬器 `tools/sim/clicker-curve.js` 現有輸出再多兩行：「每日萬用粉塵入帳」（`universalDust` 每日增量）與「每日五連數」已有；跑改前（`git show HEAD:src/clicker-economy.js` 的載法同上輪）與改後各 14 天，貼進報告。守門：改後每日五連數不能超過改前的 1.5 倍（節流上限 42 之內），萬用粉塵每日入帳不能超過改前 1.5 倍；超過就在報告寫數字，不要自己再調常數。
- 測試：`drawCost` 在 `trainingLevel` 0 → 4 時價格只變 `1.25 ** 2` 倍；`rates(s)` 無參數不變。

## 2. 卡面不顯示裝備特質（使用者：影響觀看）

- `gacha-card.js:105` 的 `.card-trait`（「裝備時攻擊力 ×1.5」）**不再畫在卡面上**：招募翻牌、卡冊格子、展示頁大卡都不顯示。把 `buildCard` 的 `trait` 參數與那段移除，呼叫端（`clicker-album.js:32`）一併拿掉參數；`gacha-card.css` 的 `.card-trait` 規則刪掉。
- 特質資訊保留在卡冊展示頁的資料列（`clicker-album.js:110` 的「特質」列）與技能提示，不要弄丟。

## 3. 寄生標籤被技能槽擋住（使用者截圖）

現況（我用 Playwright 重現，`_art/out/r20-parasite-b.png`）：`#parasite-label`（`clicker.css:103`，舞台座標 left 198 / top 205、z-index 6）正好落在技能槽名字那一排，`#slots` z-index 9 蓋在上面；「連鎖 12s」標籤也壓到第一槽的名字。

要做：
- `#parasite-label` 移到**珍母（hero）左肩旁、技能槽上方**：建議 `left:150px; top:120px`，先量 `#hero-position`（184,3，240×256）與 `#slots` 各子元素的 rect，標籤（含 compact 32px 與全名 116px 兩種寬度）**不得與任何 `.skill-slot`、`.skill-name`、`.skill-slot small`、連鎖標籤相交**；z-index 提到 10（高於 `#slots`）。第 551 行發動時的 `translateY(-40px)` 進場動畫與 `impact({x:250,y:285})` 的落點跟著新位置調（落點改成標籤中心）。
- 「連鎖 N s」標籤（找 `#chain` 或 `.chain-label` 的定位）同樣不得與 `.skill-name` 相交：往上移到名字上方，或移到 `#slots` 右側。
- 驗收放 `tools/test/clicker-round20.py`：種子存檔裝 zhenmu 進槽 1、發動後（全名階段與 compact 階段各一次）量四種矩形不相交；再把連鎖疊到 ≥3 量連鎖標籤。截圖 `_art/out/r20-parasite-{full,compact}.png`。

## 4. 數字爽感（使用者：被動收益也要跳數字，但樣式要跟點擊不同）

現況：只有點擊／技能／禮包會 `float()`（`clicker-stage.js:118`，錢幣圖＋粗體、26～34px、往上飄 720ms）；被動收益只有錢包數字在跳。

要做（三件，全部尊重 `prefers-reduced-motion`、舞台 `frozen`／`hidden` 時不生成）：
1. **被動收益浮字**：`clicker-stage.js` 新增 `floatPassive(amount)`，宿主 `settle()` 每次 1Hz 結算後呼叫（`clicker.js:94` 附近，用該秒實際入帳的被動金額，不含點擊）。樣式與點擊區分：**沒有錢幣圖、斜體、18px、顏色 `#E9B94E`（淡金）、細描邊 `-webkit-text-stroke:.5px #30251F`、opacity .85**；從包裝堆右側（`IMPACT.x + 70, IMPACT.y + 30` 附近，隨機 ±16px）**往右上斜飄** 1400ms 後淡出（點擊是直上 720ms）。每秒最多 1 個；`#floaters` 上限 12 個的規則共用，被動浮字先被回收（新增 `.floater.passive` 類別，回收時優先移除 passive）。P 為 0 不生成。
2. **點擊浮字依「份量」放大**：`float()` 的字級改成依 `amount / rates(s).P` 的比例：ratio < 5 → 26px（現況）；5～30 → 30px；30～200 → 36px 並加 `rotate(-4deg)`；≥ 200 → 42px、`#EF8E8E`、加 2px 描邊（技能爆發那種）。`heavy` 參數的既有行為（34px 粉色）併進這個階梯，不要兩套並存。連點 ≥3 的金色沿用。
3. **每秒收益破關卡章**：`rates(s).P` 第一次跨過 1 千／1 萬／10 萬／100 萬／1000 萬／1 億／10 億／100 億…（每個 10 倍）時，舞台中央蓋一枚章（沿用 `celebrate(...,'promote')` 那類演出或 `#package-result` 的票券樣式）寫「每秒破 10 萬！」、`sound('upgrade')`、錢包 pulse。存檔記 `s.peakRateStamp`（已達成的最高關卡指數），`clicker-save.js` 補預設與 validate；換桌布後歸零（跟 `peakRate` 一樣）。
- 驗收：`clicker-round20.py` 量 1 秒內 `.floater.passive` 出現且 ≤1 個、樣式（font-style italic、無 img）；點擊一次 ratio ≥200 的浮字 font-size 42px；把 P 從 9 千拉到 1.2 萬後 `peakRateStamp` 變 4 且章出現一次、再結算一秒不重複出現。

## 5. 印記商店：可重複消費（使用者：印記溢出太多）

現況：`clicker-balance.js:82` 十項一次性商品共 27 印記；印記 = `floor(sqrt(生涯收入 / 1e8))`，生涯 5 兆就 223 顆，買完商品剩一大堆沒地方花。`markMul` 是照**累計**印記算的，花掉不影響倍率。

要做（三個可重複項目，加在 `B.marks` 之後、UI 分「永久」與「祝福」兩段）：
1. **收益祝福**（`blessing`）：每級 全隊收益（P 與 D）**+10%**（加法：`1 + .1 × 級`），第 n 級價 **n 印記**（1、2、3…），無上限。套用點在 `rates()` 的 `M` 旁邊乘上 `blessMul(s)`；`s.blessing` 記級數。UI 顯示「收益祝福 Lv.N（×1.N0）→ 下一級 n 印記」。
2. **粉塵兌換**（`dustTrade`）：**1 印記 → 5 萬用粉塵**，可重複，一次按鈕換 1 顆、長按或「×10」鍵換 10。走 `s.universalDust`。
3. **招募券**（`drawTicket`）：**2 印記 → 5 次免費單抽**（`s.freeDraws += 5`），可重複。
- 純邏輯在 `clicker-prestige.js` 新函式 `buyBlessing`／`tradeDust(n)`／`buyDrawTicket(n)`，錯誤訊息「印記不足」；`clicker-save.js` 補 `blessing` 預設 0 與 validate（整數 ≥0）；換桌布**不清** blessing。
- 模擬器：`shop()` 裡若有印記、先買收益祝福到買不起（模擬真人），報告列 14 天結束時的 blessing 級數與剩餘印記；目標是 14 天結束剩餘印記 < 10。達不到寫數字。
- 測試（`clicker-round20.test.js`）：祝福第 3 級累計花 6 印記、`rates` 變 ×1.3；粉塵兌換與招募券的餘額增減；印記不足拋錯；validate。

## 6. 驗收腳本與交付

- `tools/test/clicker-round20.py`（照 round19 骨架）：第 3、4 點的矩形與浮字檢查、第 5 點面板按鈕存在且可按（`#prestige-open` → 印記商店分頁）；四張截圖路徑列進報告。
- `docs/clicker/REPORT-astra-impl-round20.md`：每項一句話；第 1 點改前改後兩份模擬全文＋守門數字；第 5 點模擬的 blessing 級數與剩餘印記；寄生標籤最終座標。
- `npm.cmd test` 全綠（148＋新增）；`PYTHONIOENCODING=utf-8 python tools/test/clicker-round20.py` 與 `clicker-round19.py` 都全綠。
- 不要 build、不要起 server、不要 commit。
