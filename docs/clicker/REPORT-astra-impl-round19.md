# 第十九輪實作報告

日期：2026-09-08；基準 HEAD：`151f7f1`；範圍：`BRIEF-astra-impl-round19.md`。

## 實作

- **招募定價**：新增並匯出 `medianPartnerLevel(s)`，只算已招募夥伴、缺級視為 0、偶數取較低中位數；`drawCost(s,count)` 透過 `rates(s,{partnerLevel:medianPartnerLevel(s)})` 計價，簽名、30／135 秒與 150／700 下限均保留。
- **收益相容性**：`rates(s)` 預設仍用個別等級，星／階級／超越／全隊訓練／親和／場景／裝飾／印記及 D 公式未變，新增測試以原公式手算比對；檢查宿主、招募 UI 與 tools/sim 呼叫點，不需修改既有呼叫。
- **新卡追隊**：`receive` 在首次加入 collection 前算中位數並設定等級，同包逐張處理、重複卡保持原級、不花幣、不購買訓練、不觸發訓練慶祝，既有 validate 可接受存檔。
- **模擬紀錄**：五連記錄實付 `price`（扣除免費抽數）、`newIds`、同一 now 收下前後基礎 P 差額 `gainPerSec` 與 `paybackSec`，整包重複記 null 並統計比例，列出中位數／最差抽次與天數／前後各五抽。
- **CSS 按鈕**：用中心像素取樣色、3px 深色邊框、12px 圓角、4px 硬陰影及內側虛線替換 9-slice，hover 上浮 1px／陰影 5px、active 下壓 3px／陰影 1px，停用色同步修正舊 purchase 覆寫。
- **CSS 紙框**：升級／招募／隊伍／一般面板／招募頂欄／音量面板與同紙材質的展示頁、粉塵罐、徽章內框改用取樣紙色、3px 邊框、14px 圓角、硬陰影與內側虛線；既有 padding 扣除實體邊框寬度，保持內容座標。
- **例外輪廓**：熱區、夥伴卡、slot-pick、圓技能貼紙、王包鍵、場景／推薦／印記票券、album-slot 與今日包／小偷排除通用陰影及虛線；翻頁箭頭改用 CSS 奶油鍵，標題帶、票券、錢包牌、桌墊、外框、卡冊書仍用原素材。
- **技能名字**：標籤置於貼紙正上方、只咬合邊緣 4px，96px 上限與省略機制，採 **gap 16px** 方案；冷卻右下角、空槽文字與 `.buddy .slot-stamp` 保留。

## 取樣色

PIL 只讀 PNG，在 `(width//2,height//2)` 取 RGB，CSS 使用不透明色（素材本身未寫入）。

| 素材 | 中心色 |
|---|---|
| clicker-ui-btn-cream.png | `#FBEED0` |
| clicker-ui-btn-green.png | `#8D9C5B` |
| clicker-ui-btn-pink.png | `#FA776B` |
| clicker-ui-btn-purple.png | `#B48CCB` |
| clicker-ui-btn-disabled.png | `#D9CCBB` |
| clicker-ui-paper.png | `#FCECC8` |

## 模擬結論與未達目標

| 情境 | 五連總數 | 回本中位數 | 最差含新卡五連 | 整包重複 | 到 fridge |
|---|---:|---:|---|---|---|
| 改前 14 天 | 557 | 6720.88 秒 | 5127900.00 秒，第 64 抽／第 2 天 | 540/557（96.95%） | 33.34 小時 |
| 改後 14 天 | 561 | 851.69 秒 | 3174.95 秒，第 29 抽／第 2 天 | 544/561（96.97%） | 25.03 小時 |
| 改前 30 天 | 1201 | 6720.88 秒 | 5127900.00 秒，第 64 抽／第 2 天 | 1184/1201（98.58%） | 33.34 小時 |
| 改後 30 天 | 1205 | 851.69 秒 | 3174.95 秒，第 29 抽／第 2 天 | 1188/1205（98.59%） | 25.03 小時 |

- **30 分鐘目標未達**：改後最差仍為 **52.92 分鐘**（超出 22.92 分鐘）；中位數 14.19 分鐘，比改前 112.01 分鐘改善，依 brief 不自行調整 DRAW_SECONDS。
- **冰箱進度目標達成**：兩者皆第 2 天進入，改後提前約 8.31 小時（0.35 天），差距少於 2 天。
- **節流已接近上限**：改前／後的完整日都常為 42 次，改後首日由 24 增至 28 次，全期僅多 4 次；既有模擬器每段 20 分鐘線上約 13 次，另在 8 小時離線結算後 shop 可再抽一次，三段會到 42 次，不代表單段線上抽 42 次。
- **時間邊界**：既有外層迴圈會把最後一段的 8 小時離線結算做完，因此每日表含索引 14／30 的最後一次；本輪保留模擬器既有節奏。
- **改前來源**：以 `git show HEAD:src/clicker-economy.js` 讀取舊經濟模組，透過 Node Module 以原 src 檔名載入 require cache，再執行同一份已加紀錄的模擬器；未 stash、未改 git 索引、未更換工作區原始碼，兩側使用相同預設抽卡 seed。

## 驗證與截圖

- `npm.cmd test`：**148 tests／148 pass／0 fail／0 skipped，exit 0**（原 142 例＋新增 6 例）。
- `PYTHONIOENCODING=utf-8 python tools/test/clicker-round19.py`：**ALL PASS，FAIL []，exit 0**；涵蓋經濟 API、停用色、四尺寸與 DPR 1.25／1.5 的 CSS 邊框、最長名字及使用者回報名字的矩形檢查，無 JS 錯誤。
- `PYTHONIOENCODING=utf-8 python tools/test/clicker-round18.py`：**ALL PASS，exit 0**；平均訓練總級數 1500→2000，四解析度 zoom 仍為 1.75／1.5／1.25／1。
- `_art/shot.py` 已依序跑 2560×1215、1920×1080、1280×860、1366×768，皆 **errors []、exit 0**，前綴 `r19`、`r19-1920`、`r19-1280`、`r19-1366`。
- 所有 Playwright 均設定 `PYTHONIOENCODING=utf-8` 並用 Python 執行，route 直接讀 src，未啟動 server。
- 與改前 CSS 的幾何比對：2560×1215 的 `#draw-five`、`#click-one`、`.upgrade`、卡冊 header／平均訓練、招募頂欄／五連、輪迴 header／確認鍵，外框 x／y／width／height 及內容文字 x／y 差皆 **0px**，量測輸出 `_art/out/r19-geometry.json` 與 `_art/out/r19-baseline-geometry.json`。
- 圖像並排檢視主畫面、卡冊、招募、輪迴：`_art/out/r19-compare-{main,album,recruit,prestige}.png`（左 r18、右 r19）；按鈕／紙框改為硬描邊虛線，內容無明顯位移，卡冊角色資源等載入完成才截圖。
- 名字測試按 UI 去掉「（原版）」後排序，最長三位為 **珍珍JPG／熱狗狗狗／女僕狐狐**，11px 全字容納；另補 **苔蘚珍珍／玥來玥閒／珍珍JPG** 回報案例，量測標籤與圖像、標籤彼此不相交。

| 解析度／DPR | 四角 3 倍圖（列：五連／升級鍵／紙框；欄：左上／右上／左下／右下） |
|---|---|
| 2560×1215／1 | `_art/out/r19-corner-2560-dpr1.png` |
| 1920×1080／1 | `_art/out/r19-corner-1920-dpr1.png` |
| 1280×860／1 | `_art/out/r19-corner-1280-dpr1.png` |
| 1366×768／1 | `_art/out/r19-corner-1366-dpr1.png` |
| 1280×860／1.25 | `_art/out/r19-corner-1280-dpr1.25.png` |
| 1280×860／1.5 | `_art/out/r19-corner-1280-dpr1.5.png` |

技能槽：`_art/out/r19-slots.png`、`_art/out/r19-slots-reported.png`，另有六組 `r19-slots-<width>-dpr<dpr>.png`；完整畫面 `r19-full-<width>-dpr<dpr>.png`，各面板 `r19-<width>-dpr<dpr>-{main,album,recruit,prestige}.png`。

- **文字與限制**：`Select-String -SimpleMatch '??'` 掃 src 的 JS／CSS／HTML 與 tools JS，命中均為既有空值運算子，未引入問號亂碼；`git diff --check` 通過。
- **保留行為**：WISH_TELEGRAPH=false、cutin T／EASE、空白關面板、卡冊翻頁、轉彩 30%、神話 0.5%、招募秒數與下限、applyZoom 0.25 取整未改，既有演出未精簡。
- **環境限制**：未 build、未起 server、未 commit、未修改任何 PNG 素材；PNG 僅只讀取樣，驗收圖片另寫 `_art/out`；`.git` 唯讀，未執行交接文件的 fetch／pull，本輪未實跑 exe。

## 四份模擬完整輸出

### 改前：4 點／秒、20 分鐘／段、14 天

```text
=== 曲線模擬 CPS 4 session 20 min，天數 14 ===
王勝： backyard → kitchen → market → factory → nightmarket ；目前場景 fridge 第 112 包；P= 2.47e+9 coins= 1.51e+15 lifetime= 1.94e+15
升級次數 { click: 73, training: 28, partner: 3402, auto: 10 } 五連 557 夥伴 25 訓練 Lv 28 攻擊力 Lv 73 夥伴訓練 {"yueyue2":136,"zhenjpg":136,"alu":136,"lk":136,"yang":136,"caihua":136,"jiaobu2":136,"lksphinx":136,"zhenzhen2":136,"mianhua":136,"dog":136,"yuetrumpet":136,"zhencao":136,"fox":136,"yangpu":136,"yueyuexian":136,"jiaobu":135,"yueyue":136,"zhenfang":135,"zhenmoss":136,"jiaotou":135,"gebugou":136,"zhenmu":139,"jinggou":136,"zhenzhen":138}
 王 backyard 第 0 次 敗 比例 0.58/0.80/1.01 need 5.31e+4 時間 0.20h 主動 0.20h P 1.03e+3 P0=1.03e+3 D0=6.40e+1 slots=yueyue2,yang,jiaobu2
 王 backyard 第 1 次 敗 比例 0.82 need 5.31e+4 時間 0.21h 主動 0.20h P 1.03e+3 
 王 backyard 第 2 次 勝 比例 1 need 5.31e+4 時間 0.23h 主動 0.20h P 1.30e+3 
 王 kitchen 第 0 次 敗 比例 0.61/0.80/1.01 need 1.65e+6 時間 0.31h 主動 0.28h P 3.37e+4 P0=3.37e+4 D0=1.73e+3 slots=yueyue2,yang,jiaobu2
 王 kitchen 第 1 次 敗 比例 0.86 need 1.65e+6 時間 0.32h 主動 0.28h P 3.37e+4 
 王 kitchen 第 2 次 勝 比例 1 need 1.65e+6 時間 0.34h 主動 0.28h P 4.25e+4 
 王 market 第 0 次 敗 比例 0.61/0.80/1.02 need 2.18e+8 時間 8.34h 主動 0.29h P 4.47e+6 P0=4.47e+6 D0=2.25e+5 slots=yueyue2,yang,jiaobu2
 王 market 第 1 次 勝 比例 1 need 2.18e+8 時間 8.34h 主動 0.29h P 5.35e+6 
 王 factory 第 0 次 敗 比例 0.62/0.80/1.04 need 2.04e+9 時間 16.67h 主動 0.61h P 4.18e+7 P0=4.18e+7 D0=2.10e+6 slots=yueyue2,yang,jiaobu2
 王 factory 第 1 次 敗 比例 0.97 need 2.04e+9 時間 16.68h 主動 0.61h P 4.18e+7 
 王 factory 第 2 次 勝 比例 1 need 2.04e+9 時間 16.70h 主動 0.61h P 4.90e+7 
 王 nightmarket 第 0 次 敗 比例 0.32/0.42/0.56 need 5.38e+9 時間 16.86h 主動 0.78h P 5.78e+7 P0=5.78e+7 D0=2.89e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.47/0.61/0.82 need 5.38e+9 時間 25.00h 主動 0.92h P 8.38e+7 P0=8.38e+7 D0=4.19e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.62/0.80/1.10 need 7.79e+9 時間 33.34h 主動 1.25h P 1.60e+8 P0=1.60e+8 D0=7.99e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 1 次 勝 比例 1 need 7.79e+9 時間 33.34h 主動 1.25h P 1.73e+8 
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 41.67h 主動 1.58h P 3.93e+8 P0=3.93e+8 D0=1.96e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 50.00h 主動 1.91h P 5.70e+8 P0=5.70e+8 D0=2.85e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 58.34h 主動 2.24h P 6.28e+8 P0=6.28e+8 D0=3.14e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 66.67h 主動 2.58h P 8.55e+8 P0=8.55e+8 D0=4.28e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 75.00h 主動 2.91h P 8.85e+8 P0=8.85e+8 D0=4.43e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 83.34h 主動 3.24h P 9.06e+8 P0=9.06e+8 D0=4.53e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 91.67h 主動 3.58h P 1.21e+9 P0=1.21e+9 D0=6.04e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 100.00h 主動 3.91h P 1.22e+9 P0=1.22e+9 D0=6.12e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 108.34h 主動 4.24h P 1.24e+9 P0=1.24e+9 D0=6.20e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 116.67h 主動 4.58h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 125.00h 主動 4.91h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 133.34h 主動 5.24h P 1.26e+9 P0=1.26e+9 D0=6.33e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 141.67h 主動 5.58h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 150.00h 主動 5.91h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 158.34h 主動 6.24h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 166.67h 主動 6.58h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 175.00h 主動 6.91h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 183.34h 主動 7.24h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 191.67h 主動 7.58h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 200.00h 主動 7.91h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 208.34h 主動 8.24h P 1.75e+9 P0=1.75e+9 D0=8.78e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 216.67h 主動 8.58h P 1.78e+9 P0=1.78e+9 D0=8.90e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 225.00h 主動 8.91h P 2.33e+9 P0=2.33e+9 D0=1.16e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 233.34h 主動 9.24h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 241.67h 主動 9.58h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 250.00h 主動 9.91h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 258.34h 主動 10.24h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 266.67h 主動 10.58h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 275.00h 主動 10.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 283.34h 主動 11.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 291.67h 主動 11.58h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 300.00h 主動 11.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 308.34h 主動 12.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 316.67h 主動 12.58h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 325.00h 主動 12.91h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 333.34h 主動 13.24h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 包速 backyard n= 50 中位 14.8s p90 23.3s 最長 30s
 包速 kitchen n= 48 中位 4.5s p90 14.8s 最長 17s
 包速 factory n= 55 中位 2.5s p90 19.3s 最長 320s
 包速 nightmarket n= 44 中位 10.8s p90 64.3s 最長 101s
 包速 fridge n= 58 中位 7.5s p90 319.3s 最長 644s
 每日五連數 {"0":24,"1":42,"2":42,"3":42,"4":42,"5":42,"6":42,"7":42,"8":28,"9":42,"10":42,"11":42,"12":42,"13":42,"14":1}
 主動遊玩總時數 13.58h
 醒來 0.34h 收工 market#19 P=1.43e+5 D=7.2e+3 訓練Lv8 攻擊力Lv25 夥伴12 Lv中位30
 醒來 8.34h market#100 P=4.47e+6 醒來幣=4.1e+9 剩=4.0e+6 訓練Lv15 夥伴Lv中位71
 醒來 8.67h 收工 factory#78 P=9.38e+6 D=4.7e+5 訓練Lv15 攻擊力Lv48 夥伴17 Lv中位76
 醒來 16.67h factory#78 P=4.18e+7 醒來幣=2.7e+11 剩=6.9e+9 訓練Lv20 夥伴Lv中位94
 醒來 17.00h 收工 nightmarket#96 P=6.35e+7 D=3.2e+6 訓練Lv20 攻擊力Lv54 夥伴21 Lv中位93
 醒來 25.00h nightmarket#124 P=8.38e+7 醒來幣=1.8e+12 剩=1.6e+12 訓練Lv21 夥伴Lv中位95
 醒來 33.34h nightmarket#132 P=1.60e+8 醒來幣=4.3e+12 剩=3.5e+12 訓練Lv22 夥伴Lv中位98
 醒來 41.67h fridge#103 P=3.93e+8 醒來幣=1.0e+13 剩=8.4e+12 訓練Lv23 夥伴Lv中位106
 醒來 50.00h fridge#103 P=5.70e+8 醒來幣=2.0e+13 剩=1.5e+13 訓練Lv24 夥伴Lv中位113
 醒來 58.34h fridge#103 P=6.28e+8 醒來幣=3.3e+13 剩=3.3e+13 訓練Lv24 夥伴Lv中位113
 醒來 66.67h fridge#103 P=8.55e+8 醒來幣=5.2e+13 剩=4.0e+13 訓練Lv25 夥伴Lv中位118
 醒來 75.00h fridge#103 P=8.85e+8 醒來幣=6.5e+13 剩=6.5e+13 訓練Lv25 夥伴Lv中位118
 醒來 83.34h fridge#103 P=9.06e+8 醒來幣=9.1e+13 剩=9.1e+13 訓練Lv25 夥伴Lv中位118
 醒來 91.67h fridge#103 P=1.21e+9 醒來幣=1.2e+14 剩=8.7e+13 訓練Lv26 夥伴Lv中位125
 醒來 100.00h fridge#105 P=1.22e+9 醒來幣=1.2e+14 剩=1.2e+14 訓練Lv26 夥伴Lv中位125
 醒來 108.34h fridge#106 P=1.24e+9 醒來幣=1.6e+14 剩=1.6e+14 訓練Lv26 夥伴Lv中位125
 醒來 116.67h fridge#106 P=1.25e+9 醒來幣=1.9e+14 剩=1.9e+14 訓練Lv26 夥伴Lv中位125
 醒來 125.00h fridge#106 P=1.25e+9 醒來幣=2.3e+14 剩=2.3e+14 訓練Lv26 夥伴Lv中位125
 醒來 133.34h fridge#106 P=1.26e+9 醒來幣=2.7e+14 剩=2.7e+14 訓練Lv26 夥伴Lv中位125
 醒來 141.67h fridge#106 P=1.67e+9 醒來幣=3.0e+14 剩=2.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 150.00h fridge#108 P=1.67e+9 醒來幣=2.8e+14 剩=2.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 158.34h fridge#109 P=1.67e+9 醒來幣=3.3e+14 剩=3.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 166.67h fridge#109 P=1.73e+9 醒來幣=3.8e+14 剩=3.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 175.00h fridge#109 P=1.73e+9 醒來幣=4.3e+14 剩=4.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 183.34h fridge#109 P=1.74e+9 醒來幣=4.7e+14 剩=4.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 191.67h fridge#109 P=1.74e+9 醒來幣=5.2e+14 剩=5.2e+14 訓練Lv27 夥伴Lv中位130
 醒來 200.00h fridge#109 P=1.74e+9 醒來幣=5.7e+14 剩=5.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 208.34h fridge#109 P=1.75e+9 醒來幣=6.2e+14 剩=6.2e+14 訓練Lv27 夥伴Lv中位130
 醒來 216.67h fridge#109 P=1.78e+9 醒來幣=6.7e+14 剩=6.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 225.00h fridge#109 P=2.33e+9 醒來幣=7.3e+14 剩=5.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 233.34h fridge#111 P=2.38e+9 醒來幣=6.1e+14 剩=6.1e+14 訓練Lv28 夥伴Lv中位136
 醒來 241.67h fridge#112 P=2.38e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv28 夥伴Lv中位136
 醒來 250.00h fridge#112 P=2.40e+9 醒來幣=7.5e+14 剩=7.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 258.34h fridge#112 P=2.40e+9 醒來幣=8.2e+14 剩=8.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 266.67h fridge#112 P=2.40e+9 醒來幣=8.9e+14 剩=8.9e+14 訓練Lv28 夥伴Lv中位136
 醒來 275.00h fridge#112 P=2.42e+9 醒來幣=9.5e+14 剩=9.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 283.34h fridge#112 P=2.42e+9 醒來幣=1.0e+15 剩=1.0e+15 訓練Lv28 夥伴Lv中位136
 醒來 291.67h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136
 醒來 300.00h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 308.34h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 316.67h fridge#112 P=2.44e+9 醒來幣=1.3e+15 剩=1.3e+15 訓練Lv28 夥伴Lv中位136
 醒來 325.00h fridge#112 P=2.44e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 333.34h fridge#112 P=2.47e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 341.67h fridge#112 P=2.47e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv28 夥伴Lv中位136
 五連回本秒數 中位數 6720.88 ／最差 5127900.00（第64抽、第2天） ／整包重複比例 540/557 (96.95%)
  前5抽 {"n":1,"day":1,"at":100000,"scene":"backyard","pkg":12,"price":810,"newIds":["zhenjpg","lk","alu"],"gainPerSec":17.5,"paybackSec":46.285714285714285}
  前5抽 {"n":2,"day":1,"at":255000,"scene":"backyard","pkg":27,"price":7155,"newIds":["yang","lksphinx"],"gainPerSec":28,"paybackSec":255.53571428571428}
  前5抽 {"n":3,"day":1,"at":430000,"scene":"backyard","pkg":37,"price":20318,"newIds":[],"gainPerSec":16.25,"paybackSec":null}
  前5抽 {"n":4,"day":1,"at":610000,"scene":"backyard","pkg":45,"price":45858,"newIds":["jiaobu2","caihua"],"gainPerSec":35.625,"paybackSec":1287.2421052631578}
  前5抽 {"n":5,"day":1,"at":815000,"scene":"kitchen","pkg":14,"price":0,"newIds":["mianhua","dog","zhenzhen2"],"gainPerSec":72.65625,"paybackSec":0}
  後5抽 {"n":553,"day":14,"at":1200910000,"scene":"fridge","pkg":112,"price":332839807846,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":554,"day":14,"at":1201000000,"scene":"fridge","pkg":112,"price":332839807846,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":555,"day":14,"at":1201090000,"scene":"fridge","pkg":112,"price":332839807846,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":556,"day":14,"at":1201180000,"scene":"fridge","pkg":112,"price":332839807846,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":557,"day":15,"at":1230008250,"scene":"fridge","pkg":112,"price":332839807846,"newIds":[],"gainPerSec":0,"paybackSec":null}
```

### 改前：4 點／秒、20 分鐘／段、30 天

```text
=== 曲線模擬 CPS 4 session 20 min，天數 30 ===
王勝： backyard → kitchen → market → factory → nightmarket ；目前場景 fridge 第 119 包；P= 5.10e+9 coins= 4.72e+15 lifetime= 7.02e+15
升級次數 { click: 79, training: 30, partner: 3691, auto: 10 } 五連 1201 夥伴 25 訓練 Lv 30 攻擊力 Lv 79 夥伴訓練 {"yueyue2":147,"zhenjpg":147,"alu":147,"lk":147,"yang":147,"caihua":147,"jiaobu2":147,"lksphinx":147,"zhenzhen2":147,"mianhua":147,"dog":147,"yuetrumpet":147,"zhencao":147,"fox":147,"yangpu":147,"yueyuexian":147,"jiaobu":147,"yueyue":147,"zhenfang":147,"zhenmoss":147,"jiaotou":147,"gebugou":147,"zhenmu":155,"jinggou":147,"zhenzhen":155}
 王 backyard 第 0 次 敗 比例 0.58/0.80/1.01 need 5.31e+4 時間 0.20h 主動 0.20h P 1.03e+3 P0=1.03e+3 D0=6.40e+1 slots=yueyue2,yang,jiaobu2
 王 backyard 第 1 次 敗 比例 0.82 need 5.31e+4 時間 0.21h 主動 0.20h P 1.03e+3 
 王 backyard 第 2 次 勝 比例 1 need 5.31e+4 時間 0.23h 主動 0.20h P 1.30e+3 
 王 kitchen 第 0 次 敗 比例 0.61/0.80/1.01 need 1.65e+6 時間 0.31h 主動 0.28h P 3.37e+4 P0=3.37e+4 D0=1.73e+3 slots=yueyue2,yang,jiaobu2
 王 kitchen 第 1 次 敗 比例 0.86 need 1.65e+6 時間 0.32h 主動 0.28h P 3.37e+4 
 王 kitchen 第 2 次 勝 比例 1 need 1.65e+6 時間 0.34h 主動 0.28h P 4.25e+4 
 王 market 第 0 次 敗 比例 0.61/0.80/1.02 need 2.18e+8 時間 8.34h 主動 0.29h P 4.47e+6 P0=4.47e+6 D0=2.25e+5 slots=yueyue2,yang,jiaobu2
 王 market 第 1 次 勝 比例 1 need 2.18e+8 時間 8.34h 主動 0.29h P 5.35e+6 
 王 factory 第 0 次 敗 比例 0.62/0.80/1.04 need 2.04e+9 時間 16.67h 主動 0.61h P 4.18e+7 P0=4.18e+7 D0=2.10e+6 slots=yueyue2,yang,jiaobu2
 王 factory 第 1 次 敗 比例 0.97 need 2.04e+9 時間 16.68h 主動 0.61h P 4.18e+7 
 王 factory 第 2 次 勝 比例 1 need 2.04e+9 時間 16.70h 主動 0.61h P 4.90e+7 
 王 nightmarket 第 0 次 敗 比例 0.32/0.42/0.56 need 5.38e+9 時間 16.86h 主動 0.78h P 5.78e+7 P0=5.78e+7 D0=2.89e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.47/0.61/0.82 need 5.38e+9 時間 25.00h 主動 0.92h P 8.38e+7 P0=8.38e+7 D0=4.19e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.62/0.80/1.10 need 7.79e+9 時間 33.34h 主動 1.25h P 1.60e+8 P0=1.60e+8 D0=7.99e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 1 次 勝 比例 1 need 7.79e+9 時間 33.34h 主動 1.25h P 1.73e+8 
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 41.67h 主動 1.58h P 3.93e+8 P0=3.93e+8 D0=1.96e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 50.00h 主動 1.91h P 5.70e+8 P0=5.70e+8 D0=2.85e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 58.34h 主動 2.24h P 6.28e+8 P0=6.28e+8 D0=3.14e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 66.67h 主動 2.58h P 8.55e+8 P0=8.55e+8 D0=4.28e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 75.00h 主動 2.91h P 8.85e+8 P0=8.85e+8 D0=4.43e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 83.34h 主動 3.24h P 9.06e+8 P0=9.06e+8 D0=4.53e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 91.67h 主動 3.58h P 1.21e+9 P0=1.21e+9 D0=6.04e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 100.00h 主動 3.91h P 1.22e+9 P0=1.22e+9 D0=6.12e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 108.34h 主動 4.24h P 1.24e+9 P0=1.24e+9 D0=6.20e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 116.67h 主動 4.58h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 125.00h 主動 4.91h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 133.34h 主動 5.24h P 1.26e+9 P0=1.26e+9 D0=6.33e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 141.67h 主動 5.58h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 150.00h 主動 5.91h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 158.34h 主動 6.24h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 166.67h 主動 6.58h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 175.00h 主動 6.91h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 183.34h 主動 7.24h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 191.67h 主動 7.58h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 200.00h 主動 7.91h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 208.34h 主動 8.24h P 1.75e+9 P0=1.75e+9 D0=8.78e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 216.67h 主動 8.58h P 1.78e+9 P0=1.78e+9 D0=8.90e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 225.00h 主動 8.91h P 2.33e+9 P0=2.33e+9 D0=1.16e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 233.34h 主動 9.24h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 241.67h 主動 9.58h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 250.00h 主動 9.91h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 258.34h 主動 10.24h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 266.67h 主動 10.58h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 275.00h 主動 10.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 283.34h 主動 11.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 291.67h 主動 11.58h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 300.00h 主動 11.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 308.34h 主動 12.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 316.67h 主動 12.58h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 325.00h 主動 12.91h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 333.34h 主動 13.24h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 341.67h 主動 13.58h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 350.00h 主動 13.91h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 358.34h 主動 14.24h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 366.67h 主動 14.58h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 375.00h 主動 14.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 383.34h 主動 15.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 391.67h 主動 15.58h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 400.00h 主動 15.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 408.34h 主動 16.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 416.67h 主動 16.58h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 425.00h 主動 16.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 433.34h 主動 17.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 441.67h 主動 17.58h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.21e+11 時間 450.00h 主動 17.91h P 3.27e+9 P0=3.27e+9 D0=1.63e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 458.34h 主動 18.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 466.67h 主動 18.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 475.00h 主動 18.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 483.34h 主動 19.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 491.67h 主動 19.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 500.00h 主動 19.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 508.34h 主動 20.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 516.67h 主動 20.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 525.00h 主動 20.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 533.34h 主動 21.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 541.67h 主動 21.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 550.00h 主動 21.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 558.34h 主動 22.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 566.67h 主動 22.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 575.00h 主動 22.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 583.34h 主動 23.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 591.67h 主動 23.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 600.00h 主動 23.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 608.34h 主動 24.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 616.67h 主動 24.58h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 625.00h 主動 24.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 633.34h 主動 25.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 641.67h 主動 25.58h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 650.00h 主動 25.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 658.34h 主動 26.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 666.67h 主動 26.58h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 675.00h 主動 26.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 683.34h 主動 27.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 691.67h 主動 27.58h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 700.00h 主動 27.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 708.34h 主動 28.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 716.67h 主動 28.58h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 包速 backyard n= 50 中位 14.8s p90 23.3s 最長 30s
 包速 kitchen n= 48 中位 4.5s p90 14.8s 最長 17s
 包速 factory n= 55 中位 2.5s p90 19.3s 最長 320s
 包速 nightmarket n= 44 中位 10.8s p90 64.3s 最長 101s
 包速 fridge n= 65 中位 13.0s p90 439.3s 最長 644s
 每日五連數 {"0":24,"1":42,"2":42,"3":42,"4":42,"5":42,"6":42,"7":42,"8":28,"9":42,"10":42,"11":42,"12":42,"13":42,"14":42,"15":42,"16":28,"17":42,"18":42,"19":42,"20":42,"21":42,"22":42,"23":42,"24":28,"25":42,"26":42,"27":42,"28":42,"29":42,"30":1}
 主動遊玩總時數 28.91h
 醒來 0.34h 收工 market#19 P=1.43e+5 D=7.2e+3 訓練Lv8 攻擊力Lv25 夥伴12 Lv中位30
 醒來 8.34h market#100 P=4.47e+6 醒來幣=4.1e+9 剩=4.0e+6 訓練Lv15 夥伴Lv中位71
 醒來 8.67h 收工 factory#78 P=9.38e+6 D=4.7e+5 訓練Lv15 攻擊力Lv48 夥伴17 Lv中位76
 醒來 16.67h factory#78 P=4.18e+7 醒來幣=2.7e+11 剩=6.9e+9 訓練Lv20 夥伴Lv中位94
 醒來 17.00h 收工 nightmarket#96 P=6.35e+7 D=3.2e+6 訓練Lv20 攻擊力Lv54 夥伴21 Lv中位93
 醒來 25.00h nightmarket#124 P=8.38e+7 醒來幣=1.8e+12 剩=1.6e+12 訓練Lv21 夥伴Lv中位95
 醒來 33.34h nightmarket#132 P=1.60e+8 醒來幣=4.3e+12 剩=3.5e+12 訓練Lv22 夥伴Lv中位98
 醒來 41.67h fridge#103 P=3.93e+8 醒來幣=1.0e+13 剩=8.4e+12 訓練Lv23 夥伴Lv中位106
 醒來 50.00h fridge#103 P=5.70e+8 醒來幣=2.0e+13 剩=1.5e+13 訓練Lv24 夥伴Lv中位113
 醒來 58.34h fridge#103 P=6.28e+8 醒來幣=3.3e+13 剩=3.3e+13 訓練Lv24 夥伴Lv中位113
 醒來 66.67h fridge#103 P=8.55e+8 醒來幣=5.2e+13 剩=4.0e+13 訓練Lv25 夥伴Lv中位118
 醒來 75.00h fridge#103 P=8.85e+8 醒來幣=6.5e+13 剩=6.5e+13 訓練Lv25 夥伴Lv中位118
 醒來 83.34h fridge#103 P=9.06e+8 醒來幣=9.1e+13 剩=9.1e+13 訓練Lv25 夥伴Lv中位118
 醒來 91.67h fridge#103 P=1.21e+9 醒來幣=1.2e+14 剩=8.7e+13 訓練Lv26 夥伴Lv中位125
 醒來 100.00h fridge#105 P=1.22e+9 醒來幣=1.2e+14 剩=1.2e+14 訓練Lv26 夥伴Lv中位125
 醒來 108.34h fridge#106 P=1.24e+9 醒來幣=1.6e+14 剩=1.6e+14 訓練Lv26 夥伴Lv中位125
 醒來 116.67h fridge#106 P=1.25e+9 醒來幣=1.9e+14 剩=1.9e+14 訓練Lv26 夥伴Lv中位125
 醒來 125.00h fridge#106 P=1.25e+9 醒來幣=2.3e+14 剩=2.3e+14 訓練Lv26 夥伴Lv中位125
 醒來 133.34h fridge#106 P=1.26e+9 醒來幣=2.7e+14 剩=2.7e+14 訓練Lv26 夥伴Lv中位125
 醒來 141.67h fridge#106 P=1.67e+9 醒來幣=3.0e+14 剩=2.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 150.00h fridge#108 P=1.67e+9 醒來幣=2.8e+14 剩=2.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 158.34h fridge#109 P=1.67e+9 醒來幣=3.3e+14 剩=3.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 166.67h fridge#109 P=1.73e+9 醒來幣=3.8e+14 剩=3.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 175.00h fridge#109 P=1.73e+9 醒來幣=4.3e+14 剩=4.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 183.34h fridge#109 P=1.74e+9 醒來幣=4.7e+14 剩=4.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 191.67h fridge#109 P=1.74e+9 醒來幣=5.2e+14 剩=5.2e+14 訓練Lv27 夥伴Lv中位130
 醒來 200.00h fridge#109 P=1.74e+9 醒來幣=5.7e+14 剩=5.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 208.34h fridge#109 P=1.75e+9 醒來幣=6.2e+14 剩=6.2e+14 訓練Lv27 夥伴Lv中位130
 醒來 216.67h fridge#109 P=1.78e+9 醒來幣=6.7e+14 剩=6.7e+14 訓練Lv27 夥伴Lv中位130
 醒來 225.00h fridge#109 P=2.33e+9 醒來幣=7.3e+14 剩=5.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 233.34h fridge#111 P=2.38e+9 醒來幣=6.1e+14 剩=6.1e+14 訓練Lv28 夥伴Lv中位136
 醒來 241.67h fridge#112 P=2.38e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv28 夥伴Lv中位136
 醒來 250.00h fridge#112 P=2.40e+9 醒來幣=7.5e+14 剩=7.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 258.34h fridge#112 P=2.40e+9 醒來幣=8.2e+14 剩=8.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 266.67h fridge#112 P=2.40e+9 醒來幣=8.9e+14 剩=8.9e+14 訓練Lv28 夥伴Lv中位136
 醒來 275.00h fridge#112 P=2.42e+9 醒來幣=9.5e+14 剩=9.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 283.34h fridge#112 P=2.42e+9 醒來幣=1.0e+15 剩=1.0e+15 訓練Lv28 夥伴Lv中位136
 醒來 291.67h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136
 醒來 300.00h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 308.34h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 316.67h fridge#112 P=2.44e+9 醒來幣=1.3e+15 剩=1.3e+15 訓練Lv28 夥伴Lv中位136
 醒來 325.00h fridge#112 P=2.44e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 333.34h fridge#112 P=2.47e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 341.67h fridge#112 P=2.47e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv28 夥伴Lv中位136
 醒來 350.00h fridge#112 P=2.48e+9 醒來幣=1.6e+15 剩=1.6e+15 訓練Lv28 夥伴Lv中位136
 醒來 358.34h fridge#112 P=2.48e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136
 醒來 366.67h fridge#112 P=2.48e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136
 醒來 375.00h fridge#112 P=3.24e+9 醒來幣=1.8e+15 剩=1.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 383.34h fridge#114 P=3.24e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 391.67h fridge#114 P=3.24e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 400.00h fridge#115 P=3.24e+9 醒來幣=1.6e+15 剩=1.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 408.34h fridge#115 P=3.24e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 416.67h fridge#115 P=3.24e+9 醒來幣=1.8e+15 剩=1.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 425.00h fridge#115 P=3.24e+9 醒來幣=1.9e+15 剩=1.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 433.34h fridge#115 P=3.24e+9 醒來幣=2.0e+15 剩=2.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 441.67h fridge#115 P=3.24e+9 醒來幣=2.1e+15 剩=2.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 450.00h fridge#115 P=3.27e+9 醒來幣=2.2e+15 剩=2.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 458.34h fridge#115 P=3.33e+9 醒來幣=2.3e+15 剩=2.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 466.67h fridge#115 P=3.33e+9 醒來幣=2.4e+15 剩=2.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 475.00h fridge#115 P=3.33e+9 醒來幣=2.5e+15 剩=2.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 483.34h fridge#115 P=3.33e+9 醒來幣=2.6e+15 剩=2.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 491.67h fridge#115 P=3.33e+9 醒來幣=2.7e+15 剩=2.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 500.00h fridge#115 P=3.33e+9 醒來幣=2.8e+15 剩=2.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 508.34h fridge#115 P=3.33e+9 醒來幣=2.8e+15 剩=2.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 516.67h fridge#115 P=3.33e+9 醒來幣=2.9e+15 剩=2.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 525.00h fridge#115 P=3.33e+9 醒來幣=3.0e+15 剩=3.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 533.34h fridge#115 P=3.33e+9 醒來幣=3.1e+15 剩=3.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 541.67h fridge#115 P=3.33e+9 醒來幣=3.2e+15 剩=3.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 550.00h fridge#115 P=3.33e+9 醒來幣=3.3e+15 剩=3.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 558.34h fridge#115 P=3.33e+9 醒來幣=3.4e+15 剩=3.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 566.67h fridge#115 P=3.33e+9 醒來幣=3.5e+15 剩=3.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 575.00h fridge#115 P=3.33e+9 醒來幣=3.6e+15 剩=3.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 583.34h fridge#115 P=3.33e+9 醒來幣=3.7e+15 剩=3.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 591.67h fridge#115 P=3.33e+9 醒來幣=3.8e+15 剩=3.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 600.00h fridge#115 P=3.33e+9 醒來幣=3.9e+15 剩=3.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 608.34h fridge#115 P=3.33e+9 醒來幣=4.0e+15 剩=4.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 616.67h fridge#115 P=3.33e+9 醒來幣=4.1e+15 剩=4.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 625.00h fridge#115 P=3.33e+9 醒來幣=4.2e+15 剩=4.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 633.34h fridge#115 P=3.33e+9 醒來幣=4.3e+15 剩=4.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 641.67h fridge#115 P=5.10e+9 醒來幣=4.4e+15 剩=3.3e+15 訓練Lv30 夥伴Lv中位147
 醒來 650.00h fridge#118 P=5.10e+9 醒來幣=3.4e+15 剩=3.4e+15 訓練Lv30 夥伴Lv中位147
 醒來 658.34h fridge#118 P=5.10e+9 醒來幣=3.6e+15 剩=3.6e+15 訓練Lv30 夥伴Lv中位147
 醒來 666.67h fridge#119 P=5.10e+9 醒來幣=3.7e+15 剩=3.7e+15 訓練Lv30 夥伴Lv中位147
 醒來 675.00h fridge#119 P=5.10e+9 醒來幣=3.8e+15 剩=3.8e+15 訓練Lv30 夥伴Lv中位147
 醒來 683.34h fridge#119 P=5.10e+9 醒來幣=4.0e+15 剩=4.0e+15 訓練Lv30 夥伴Lv中位147
 醒來 691.67h fridge#119 P=5.10e+9 醒來幣=4.1e+15 剩=4.1e+15 訓練Lv30 夥伴Lv中位147
 醒來 700.00h fridge#119 P=5.10e+9 醒來幣=4.3e+15 剩=4.3e+15 訓練Lv30 夥伴Lv中位147
 醒來 708.34h fridge#119 P=5.10e+9 醒來幣=4.4e+15 剩=4.4e+15 訓練Lv30 夥伴Lv中位147
 醒來 716.67h fridge#119 P=5.10e+9 醒來幣=4.6e+15 剩=4.6e+15 訓練Lv30 夥伴Lv中位147
 醒來 725.00h fridge#119 P=5.10e+9 醒來幣=4.7e+15 剩=4.7e+15 訓練Lv30 夥伴Lv中位147
 五連回本秒數 中位數 6720.88 ／最差 5127900.00（第64抽、第2天） ／整包重複比例 1184/1201 (98.58%)
  前5抽 {"n":1,"day":1,"at":100000,"scene":"backyard","pkg":12,"price":810,"newIds":["zhenjpg","lk","alu"],"gainPerSec":17.5,"paybackSec":46.285714285714285}
  前5抽 {"n":2,"day":1,"at":255000,"scene":"backyard","pkg":27,"price":7155,"newIds":["yang","lksphinx"],"gainPerSec":28,"paybackSec":255.53571428571428}
  前5抽 {"n":3,"day":1,"at":430000,"scene":"backyard","pkg":37,"price":20318,"newIds":[],"gainPerSec":16.25,"paybackSec":null}
  前5抽 {"n":4,"day":1,"at":610000,"scene":"backyard","pkg":45,"price":45858,"newIds":["jiaobu2","caihua"],"gainPerSec":35.625,"paybackSec":1287.2421052631578}
  前5抽 {"n":5,"day":1,"at":815000,"scene":"kitchen","pkg":14,"price":0,"newIds":["mianhua","dog","zhenzhen2"],"gainPerSec":72.65625,"paybackSec":0}
  後5抽 {"n":1197,"day":30,"at":2580910000,"scene":"fridge","pkg":119,"price":688420806304,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1198,"day":30,"at":2581000000,"scene":"fridge","pkg":119,"price":688420806304,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1199,"day":30,"at":2581090000,"scene":"fridge","pkg":119,"price":688420806304,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1200,"day":30,"at":2581180000,"scene":"fridge","pkg":119,"price":688420806304,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1201,"day":31,"at":2610008250,"scene":"fridge","pkg":119,"price":688420806304,"newIds":[],"gainPerSec":0,"paybackSec":null}
```

### 改後：4 點／秒、20 分鐘／段、14 天

```text
=== 曲線模擬 CPS 4 session 20 min，天數 14 ===
王勝： backyard → kitchen → market → factory → nightmarket ；目前場景 fridge 第 112 包；P= 2.47e+9 coins= 1.51e+15 lifetime= 1.94e+15
升級次數 { click: 73, training: 28, partner: 2268, auto: 10 } 五連 561 夥伴 25 訓練 Lv 28 攻擊力 Lv 73 夥伴訓練 {"yueyue2":136,"zhenjpg":136,"lk":136,"alu":136,"yang":136,"lksphinx":136,"jiaobu2":136,"caihua":136,"mianhua":136,"dog":136,"zhenzhen2":136,"yuetrumpet":136,"zhencao":136,"fox":136,"yangpu":136,"yueyuexian":136,"jiaobu":135,"yueyue":136,"zhenfang":135,"zhenmoss":136,"jiaotou":135,"gebugou":136,"zhenmu":139,"jinggou":136,"zhenzhen":138}
 王 backyard 第 0 次 敗 比例 0.59/0.80/1.01 need 7.03e+4 時間 0.20h 主動 0.20h P 1.38e+3 P0=1.38e+3 D0=8.16e+1 slots=yueyue2,yang,jiaobu2
 王 backyard 第 1 次 敗 比例 0.84 need 7.03e+4 時間 0.20h 主動 0.20h P 1.38e+3 
 王 backyard 第 2 次 勝 比例 1 need 7.03e+4 時間 0.22h 主動 0.20h P 1.80e+3 
 王 kitchen 第 0 次 敗 比例 0.61/0.80/1.01 need 1.92e+6 時間 0.29h 主動 0.27h P 3.91e+4 P0=3.91e+4 D0=2.00e+3 slots=yueyue2,yang,jiaobu2
 王 kitchen 第 1 次 敗 比例 0.79 need 1.92e+6 時間 0.30h 主動 0.27h P 3.91e+4 
 王 kitchen 第 2 次 勝 比例 1 need 1.92e+6 時間 0.32h 主動 0.27h P 4.96e+4 
 王 market 第 0 次 敗 比例 0.62/0.80/1.02 need 2.65e+8 時間 8.33h 主動 0.28h P 5.44e+6 P0=5.44e+6 D0=2.73e+5 slots=yueyue2,yang,jiaobu2
 王 market 第 1 次 勝 比例 1 need 2.65e+8 時間 8.34h 主動 0.28h P 6.51e+6 
 王 factory 第 0 次 敗 比例 0.61/0.80/1.04 need 2.33e+9 時間 16.67h 主動 0.61h P 4.78e+7 P0=4.78e+7 D0=2.40e+6 slots=yueyue2,yang,jiaobu2
 王 factory 第 1 次 勝 比例 1 need 2.33e+9 時間 16.68h 主動 0.61h P 5.61e+7 
 王 nightmarket 第 0 次 敗 比例 0.39/0.51/0.67 need 5.38e+9 時間 16.82h 主動 0.75h P 6.96e+7 P0=6.96e+7 D0=3.49e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.57/0.74/1.00 need 5.38e+9 時間 25.00h 主動 0.93h P 1.02e+8 P0=1.02e+8 D0=5.13e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 1 次 敗 比例 1 need 5.38e+9 時間 25.01h 主動 0.93h P 1.02e+8 
 王 nightmarket 第 2 次 勝 比例 1 need 5.38e+9 時間 25.03h 主動 0.93h P 1.14e+8 
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 66.72h 主動 2.63h P 8.68e+8 P0=8.68e+8 D0=4.34e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 75.00h 主動 2.91h P 8.89e+8 P0=8.89e+8 D0=4.45e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 83.33h 主動 3.24h P 9.06e+8 P0=9.06e+8 D0=4.53e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 91.67h 主動 3.57h P 1.21e+9 P0=1.21e+9 D0=6.04e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 100.00h 主動 3.91h P 1.23e+9 P0=1.23e+9 D0=6.14e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 108.33h 主動 4.24h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 116.67h 主動 4.57h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 125.00h 主動 4.91h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 133.33h 主動 5.24h P 1.26e+9 P0=1.26e+9 D0=6.33e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 141.67h 主動 5.57h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 150.00h 主動 5.91h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 158.33h 主動 6.24h P 1.70e+9 P0=1.70e+9 D0=8.48e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 166.67h 主動 6.57h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 175.00h 主動 6.91h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 183.33h 主動 7.24h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 191.67h 主動 7.57h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 200.00h 主動 7.91h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 208.33h 主動 8.24h P 1.75e+9 P0=1.75e+9 D0=8.78e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 216.67h 主動 8.57h P 1.78e+9 P0=1.78e+9 D0=8.90e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 225.00h 主動 8.91h P 2.33e+9 P0=2.33e+9 D0=1.16e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 233.33h 主動 9.24h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 241.67h 主動 9.57h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 250.00h 主動 9.91h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 258.33h 主動 10.24h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 266.67h 主動 10.57h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 275.00h 主動 10.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 283.33h 主動 11.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 291.67h 主動 11.57h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 300.00h 主動 11.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 308.33h 主動 12.24h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 316.67h 主動 12.57h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 325.00h 主動 12.91h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 333.33h 主動 13.24h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 包速 backyard n= 50 中位 12.0s p90 23.5s 最長 35s
 包速 kitchen n= 46 中位 3.8s p90 14.3s 最長 32s
 包速 market n= 25 中位 1.8s p90 4.3s 最長 6s
 包速 factory n= 53 中位 2.3s p90 19.5s 最長 379s
 包速 nightmarket n= 64 中位 5.0s p90 61.3s 最長 110s
 包速 fridge n= 58 中位 26.5s p90 428.8s 最長 638s
 每日五連數 {"0":28,"1":42,"2":42,"3":42,"4":42,"5":42,"6":42,"7":42,"8":28,"9":42,"10":42,"11":42,"12":42,"13":42,"14":1}
 主動遊玩總時數 13.57h
 醒來 0.33h 收工 market#49 P=2.03e+5 D=1.0e+4 訓練Lv8 攻擊力Lv29 夥伴12 Lv中位36
 醒來 8.33h market#103 P=5.44e+6 醒來幣=5.8e+9 剩=1.3e+6 訓練Lv16 夥伴Lv中位69
 醒來 8.67h 收工 factory#80 P=1.22e+7 D=6.1e+5 訓練Lv16 攻擊力Lv48 夥伴17 Lv中位78
 醒來 16.67h factory#80 P=4.78e+7 醒來幣=3.5e+11 剩=1.4e+10 訓練Lv20 夥伴Lv中位97
 醒來 17.00h 收工 nightmarket#99 P=7.91e+7 D=4.0e+6 訓練Lv20 攻擊力Lv57 夥伴21 Lv中位97
 醒來 25.00h nightmarket#126 P=1.02e+8 醒來幣=2.3e+12 剩=2.0e+12 訓練Lv21 夥伴Lv中位97
 醒來 33.33h fridge#92 P=1.82e+8 醒來幣=5.6e+12 剩=5.0e+12 訓練Lv22 夥伴Lv中位98
 醒來 41.67h fridge#92 P=4.05e+8 醒來幣=1.1e+13 剩=9.4e+12 訓練Lv23 夥伴Lv中位107
 醒來 50.00h fridge#95 P=5.70e+8 醒來幣=2.2e+13 剩=1.7e+13 訓練Lv24 夥伴Lv中位113
 醒來 58.33h fridge#99 P=6.35e+8 醒來幣=3.5e+13 剩=3.5e+13 訓練Lv24 夥伴Lv中位113
 醒來 66.67h fridge#100 P=8.60e+8 醒來幣=5.4e+13 剩=4.2e+13 訓練Lv25 夥伴Lv中位118
 醒來 75.00h fridge#102 P=8.89e+8 醒來幣=6.7e+13 剩=6.7e+13 訓練Lv25 夥伴Lv中位118
 醒來 83.33h fridge#103 P=9.06e+8 醒來幣=9.3e+13 剩=9.3e+13 訓練Lv25 夥伴Lv中位118
 醒來 91.67h fridge#103 P=1.21e+9 醒來幣=1.2e+14 剩=8.9e+13 訓練Lv26 夥伴Lv中位125
 醒來 100.00h fridge#105 P=1.23e+9 醒來幣=1.2e+14 剩=1.2e+14 訓練Lv26 夥伴Lv中位125
 醒來 108.33h fridge#106 P=1.25e+9 醒來幣=1.6e+14 剩=1.6e+14 訓練Lv26 夥伴Lv中位125
 醒來 116.67h fridge#106 P=1.25e+9 醒來幣=2.0e+14 剩=2.0e+14 訓練Lv26 夥伴Lv中位125
 醒來 125.00h fridge#106 P=1.25e+9 醒來幣=2.3e+14 剩=2.3e+14 訓練Lv26 夥伴Lv中位125
 醒來 133.33h fridge#106 P=1.26e+9 醒來幣=2.7e+14 剩=2.7e+14 訓練Lv26 夥伴Lv中位125
 醒來 141.67h fridge#106 P=1.67e+9 醒來幣=3.0e+14 剩=2.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 150.00h fridge#108 P=1.67e+9 醒來幣=2.8e+14 剩=2.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 158.33h fridge#109 P=1.70e+9 醒來幣=3.3e+14 剩=3.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 166.67h fridge#109 P=1.73e+9 醒來幣=3.8e+14 剩=3.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 175.00h fridge#109 P=1.73e+9 醒來幣=4.3e+14 剩=4.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 183.33h fridge#109 P=1.74e+9 醒來幣=4.8e+14 剩=4.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 191.67h fridge#109 P=1.74e+9 醒來幣=5.3e+14 剩=5.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 200.00h fridge#109 P=1.74e+9 醒來幣=5.8e+14 剩=5.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 208.33h fridge#109 P=1.75e+9 醒來幣=6.3e+14 剩=6.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 216.67h fridge#109 P=1.78e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 225.00h fridge#109 P=2.33e+9 醒來幣=7.3e+14 剩=5.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 233.33h fridge#111 P=2.38e+9 醒來幣=6.2e+14 剩=6.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 241.67h fridge#112 P=2.40e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv28 夥伴Lv中位136
 醒來 250.00h fridge#112 P=2.40e+9 醒來幣=7.5e+14 剩=7.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 258.33h fridge#112 P=2.40e+9 醒來幣=8.2e+14 剩=8.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 266.67h fridge#112 P=2.40e+9 醒來幣=8.9e+14 剩=8.9e+14 訓練Lv28 夥伴Lv中位136
 醒來 275.00h fridge#112 P=2.42e+9 醒來幣=9.6e+14 剩=9.6e+14 訓練Lv28 夥伴Lv中位136
 醒來 283.33h fridge#112 P=2.42e+9 醒來幣=1.0e+15 剩=1.0e+15 訓練Lv28 夥伴Lv中位136
 醒來 291.67h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136
 醒來 300.00h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 308.33h fridge#112 P=2.44e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 316.67h fridge#112 P=2.44e+9 醒來幣=1.3e+15 剩=1.3e+15 訓練Lv28 夥伴Lv中位136
 醒來 325.00h fridge#112 P=2.44e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 333.33h fridge#112 P=2.47e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 341.67h fridge#112 P=2.47e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv28 夥伴Lv中位136
 五連回本秒數 中位數 851.69 ／最差 3174.95（第29抽、第2天） ／整包重複比例 544/561 (96.97%)
  前5抽 {"n":1,"day":1,"at":100000,"scene":"backyard","pkg":12,"price":810,"newIds":["zhenjpg","lk","alu"],"gainPerSec":17.5,"paybackSec":46.285714285714285}
  前5抽 {"n":2,"day":1,"at":245000,"scene":"backyard","pkg":26,"price":6345,"newIds":["yang","lksphinx"],"gainPerSec":51,"paybackSec":124.41176470588235}
  前5抽 {"n":3,"day":1,"at":425000,"scene":"backyard","pkg":38,"price":26460,"newIds":[],"gainPerSec":19,"paybackSec":null}
  前5抽 {"n":4,"day":1,"at":620000,"scene":"backyard","pkg":46,"price":50085,"newIds":["jiaobu2","caihua"],"gainPerSec":118.5,"paybackSec":422.65822784810126}
  前5抽 {"n":5,"day":1,"at":795000,"scene":"kitchen","pkg":16,"price":0,"newIds":["mianhua","dog","zhenzhen2"],"gainPerSec":581.25,"paybackSec":0}
  後5抽 {"n":557,"day":14,"at":1200900000,"scene":"fridge","pkg":112,"price":332249635158,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":558,"day":14,"at":1200990000,"scene":"fridge","pkg":112,"price":332249635158,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":559,"day":14,"at":1201080000,"scene":"fridge","pkg":112,"price":332249635158,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":560,"day":14,"at":1201170000,"scene":"fridge","pkg":112,"price":332249635158,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":561,"day":15,"at":1230000000,"scene":"fridge","pkg":112,"price":332249635158,"newIds":[],"gainPerSec":0,"paybackSec":null}
```

### 改後：4 點／秒、20 分鐘／段、30 天

```text
=== 曲線模擬 CPS 4 session 20 min，天數 30 ===
王勝： backyard → kitchen → market → factory → nightmarket ；目前場景 fridge 第 119 包；P= 5.10e+9 coins= 4.74e+15 lifetime= 7.03e+15
升級次數 { click: 79, training: 30, partner: 2557, auto: 10 } 五連 1205 夥伴 25 訓練 Lv 30 攻擊力 Lv 79 夥伴訓練 {"yueyue2":147,"zhenjpg":147,"lk":147,"alu":147,"yang":147,"lksphinx":147,"jiaobu2":147,"caihua":147,"mianhua":147,"dog":147,"zhenzhen2":147,"yuetrumpet":147,"zhencao":147,"fox":147,"yangpu":147,"yueyuexian":147,"jiaobu":147,"yueyue":147,"zhenfang":147,"zhenmoss":147,"jiaotou":147,"gebugou":147,"zhenmu":155,"jinggou":147,"zhenzhen":155}
 王 backyard 第 0 次 敗 比例 0.59/0.80/1.01 need 7.03e+4 時間 0.20h 主動 0.20h P 1.38e+3 P0=1.38e+3 D0=8.16e+1 slots=yueyue2,yang,jiaobu2
 王 backyard 第 1 次 敗 比例 0.84 need 7.03e+4 時間 0.20h 主動 0.20h P 1.38e+3 
 王 backyard 第 2 次 勝 比例 1 need 7.03e+4 時間 0.22h 主動 0.20h P 1.80e+3 
 王 kitchen 第 0 次 敗 比例 0.61/0.80/1.01 need 1.92e+6 時間 0.29h 主動 0.27h P 3.91e+4 P0=3.91e+4 D0=2.00e+3 slots=yueyue2,yang,jiaobu2
 王 kitchen 第 1 次 敗 比例 0.79 need 1.92e+6 時間 0.30h 主動 0.27h P 3.91e+4 
 王 kitchen 第 2 次 勝 比例 1 need 1.92e+6 時間 0.32h 主動 0.27h P 4.96e+4 
 王 market 第 0 次 敗 比例 0.62/0.80/1.02 need 2.65e+8 時間 8.33h 主動 0.28h P 5.44e+6 P0=5.44e+6 D0=2.73e+5 slots=yueyue2,yang,jiaobu2
 王 market 第 1 次 勝 比例 1 need 2.65e+8 時間 8.34h 主動 0.28h P 6.51e+6 
 王 factory 第 0 次 敗 比例 0.61/0.80/1.04 need 2.33e+9 時間 16.67h 主動 0.61h P 4.78e+7 P0=4.78e+7 D0=2.40e+6 slots=yueyue2,yang,jiaobu2
 王 factory 第 1 次 勝 比例 1 need 2.33e+9 時間 16.68h 主動 0.61h P 5.61e+7 
 王 nightmarket 第 0 次 敗 比例 0.39/0.51/0.67 need 5.38e+9 時間 16.82h 主動 0.75h P 6.96e+7 P0=6.96e+7 D0=3.49e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 0 次 敗 比例 0.57/0.74/1.00 need 5.38e+9 時間 25.00h 主動 0.93h P 1.02e+8 P0=1.02e+8 D0=5.13e+6 slots=yueyue2,yang,jiaobu2
 王 nightmarket 第 1 次 敗 比例 1 need 5.38e+9 時間 25.01h 主動 0.93h P 1.02e+8 
 王 nightmarket 第 2 次 勝 比例 1 need 5.38e+9 時間 25.03h 主動 0.93h P 1.14e+8 
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 66.72h 主動 2.63h P 8.68e+8 P0=8.68e+8 D0=4.34e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 75.00h 主動 2.91h P 8.89e+8 P0=8.89e+8 D0=4.45e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 83.33h 主動 3.24h P 9.06e+8 P0=9.06e+8 D0=4.53e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 91.67h 主動 3.57h P 1.21e+9 P0=1.21e+9 D0=6.04e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 100.00h 主動 3.91h P 1.23e+9 P0=1.23e+9 D0=6.14e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 108.33h 主動 4.24h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 116.67h 主動 4.57h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 125.00h 主動 4.91h P 1.25e+9 P0=1.25e+9 D0=6.27e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 133.33h 主動 5.24h P 1.26e+9 P0=1.26e+9 D0=6.33e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 141.67h 主動 5.57h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 150.00h 主動 5.91h P 1.67e+9 P0=1.67e+9 D0=8.37e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 158.33h 主動 6.24h P 1.70e+9 P0=1.70e+9 D0=8.48e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 166.67h 主動 6.57h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 175.00h 主動 6.91h P 1.73e+9 P0=1.73e+9 D0=8.63e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 183.33h 主動 7.24h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 191.67h 主動 7.57h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 200.00h 主動 7.91h P 1.74e+9 P0=1.74e+9 D0=8.70e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 208.33h 主動 8.24h P 1.75e+9 P0=1.75e+9 D0=8.78e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 216.67h 主動 8.57h P 1.78e+9 P0=1.78e+9 D0=8.90e+7 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 225.00h 主動 8.91h P 2.33e+9 P0=2.33e+9 D0=1.16e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 233.33h 主動 9.24h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 241.67h 主動 9.57h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 250.00h 主動 9.91h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 258.33h 主動 10.24h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 266.67h 主動 10.57h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 275.00h 主動 10.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 283.33h 主動 11.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 291.67h 主動 11.57h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 300.00h 主動 11.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 308.33h 主動 12.24h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 316.67h 主動 12.57h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 325.00h 主動 12.91h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 333.33h 主動 13.24h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 341.67h 主動 13.57h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 350.00h 主動 13.91h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 358.33h 主動 14.24h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 366.67h 主動 14.57h P 2.48e+9 P0=2.48e+9 D0=1.24e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 375.00h 主動 14.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 383.33h 主動 15.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 391.67h 主動 15.57h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 400.00h 主動 15.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 408.33h 主動 16.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 416.67h 主動 16.57h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 425.00h 主動 16.91h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 433.33h 主動 17.24h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.20e+11 時間 441.67h 主動 17.57h P 3.24e+9 P0=3.24e+9 D0=1.62e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.21e+11 時間 450.00h 主動 17.91h P 3.27e+9 P0=3.27e+9 D0=1.63e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 458.33h 主動 18.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 466.67h 主動 18.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 475.00h 主動 18.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 483.33h 主動 19.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 491.67h 主動 19.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 500.00h 主動 19.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 508.33h 主動 20.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 516.67h 主動 20.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 525.00h 主動 20.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 533.33h 主動 21.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 541.67h 主動 21.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 550.00h 主動 21.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 558.33h 主動 22.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 566.67h 主動 22.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 575.00h 主動 22.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 583.33h 主動 23.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 591.67h 主動 23.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 600.00h 主動 23.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 608.33h 主動 24.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 616.67h 主動 24.57h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 625.00h 主動 24.91h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.24e+11 時間 633.33h 主動 25.24h P 3.33e+9 P0=3.33e+9 D0=1.67e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 641.67h 主動 25.57h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 650.00h 主動 25.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 658.33h 主動 26.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 666.67h 主動 26.57h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 675.00h 主動 26.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 683.33h 主動 27.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 691.67h 主動 27.57h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 700.00h 主動 27.91h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 708.33h 主動 28.24h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.89e+11 時間 716.67h 主動 28.57h P 5.10e+9 P0=5.10e+9 D0=2.55e+8 slots=yueyue2,yang,jiaobu2
 包速 backyard n= 50 中位 12.0s p90 23.5s 最長 35s
 包速 kitchen n= 46 中位 3.8s p90 14.3s 最長 32s
 包速 market n= 25 中位 1.8s p90 4.3s 最長 6s
 包速 factory n= 53 中位 2.3s p90 19.5s 最長 379s
 包速 nightmarket n= 64 中位 5.0s p90 61.3s 最長 110s
 包速 fridge n= 65 中位 40.0s p90 496.0s 最長 1145s
 每日五連數 {"0":28,"1":42,"2":42,"3":42,"4":42,"5":42,"6":42,"7":42,"8":28,"9":42,"10":42,"11":42,"12":42,"13":42,"14":42,"15":42,"16":28,"17":42,"18":42,"19":42,"20":42,"21":42,"22":42,"23":42,"24":28,"25":42,"26":42,"27":42,"28":42,"29":42,"30":1}
 主動遊玩總時數 28.91h
 醒來 0.33h 收工 market#49 P=2.03e+5 D=1.0e+4 訓練Lv8 攻擊力Lv29 夥伴12 Lv中位36
 醒來 8.33h market#103 P=5.44e+6 醒來幣=5.8e+9 剩=1.3e+6 訓練Lv16 夥伴Lv中位69
 醒來 8.67h 收工 factory#80 P=1.22e+7 D=6.1e+5 訓練Lv16 攻擊力Lv48 夥伴17 Lv中位78
 醒來 16.67h factory#80 P=4.78e+7 醒來幣=3.5e+11 剩=1.4e+10 訓練Lv20 夥伴Lv中位97
 醒來 17.00h 收工 nightmarket#99 P=7.91e+7 D=4.0e+6 訓練Lv20 攻擊力Lv57 夥伴21 Lv中位97
 醒來 25.00h nightmarket#126 P=1.02e+8 醒來幣=2.3e+12 剩=2.0e+12 訓練Lv21 夥伴Lv中位97
 醒來 33.33h fridge#92 P=1.82e+8 醒來幣=5.6e+12 剩=5.0e+12 訓練Lv22 夥伴Lv中位98
 醒來 41.67h fridge#92 P=4.05e+8 醒來幣=1.1e+13 剩=9.4e+12 訓練Lv23 夥伴Lv中位107
 醒來 50.00h fridge#95 P=5.70e+8 醒來幣=2.2e+13 剩=1.7e+13 訓練Lv24 夥伴Lv中位113
 醒來 58.33h fridge#99 P=6.35e+8 醒來幣=3.5e+13 剩=3.5e+13 訓練Lv24 夥伴Lv中位113
 醒來 66.67h fridge#100 P=8.60e+8 醒來幣=5.4e+13 剩=4.2e+13 訓練Lv25 夥伴Lv中位118
 醒來 75.00h fridge#102 P=8.89e+8 醒來幣=6.7e+13 剩=6.7e+13 訓練Lv25 夥伴Lv中位118
 醒來 83.33h fridge#103 P=9.06e+8 醒來幣=9.3e+13 剩=9.3e+13 訓練Lv25 夥伴Lv中位118
 醒來 91.67h fridge#103 P=1.21e+9 醒來幣=1.2e+14 剩=8.9e+13 訓練Lv26 夥伴Lv中位125
 醒來 100.00h fridge#105 P=1.23e+9 醒來幣=1.2e+14 剩=1.2e+14 訓練Lv26 夥伴Lv中位125
 醒來 108.33h fridge#106 P=1.25e+9 醒來幣=1.6e+14 剩=1.6e+14 訓練Lv26 夥伴Lv中位125
 醒來 116.67h fridge#106 P=1.25e+9 醒來幣=2.0e+14 剩=2.0e+14 訓練Lv26 夥伴Lv中位125
 醒來 125.00h fridge#106 P=1.25e+9 醒來幣=2.3e+14 剩=2.3e+14 訓練Lv26 夥伴Lv中位125
 醒來 133.33h fridge#106 P=1.26e+9 醒來幣=2.7e+14 剩=2.7e+14 訓練Lv26 夥伴Lv中位125
 醒來 141.67h fridge#106 P=1.67e+9 醒來幣=3.0e+14 剩=2.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 150.00h fridge#108 P=1.67e+9 醒來幣=2.8e+14 剩=2.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 158.33h fridge#109 P=1.70e+9 醒來幣=3.3e+14 剩=3.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 166.67h fridge#109 P=1.73e+9 醒來幣=3.8e+14 剩=3.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 175.00h fridge#109 P=1.73e+9 醒來幣=4.3e+14 剩=4.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 183.33h fridge#109 P=1.74e+9 醒來幣=4.8e+14 剩=4.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 191.67h fridge#109 P=1.74e+9 醒來幣=5.3e+14 剩=5.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 200.00h fridge#109 P=1.74e+9 醒來幣=5.8e+14 剩=5.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 208.33h fridge#109 P=1.75e+9 醒來幣=6.3e+14 剩=6.3e+14 訓練Lv27 夥伴Lv中位130
 醒來 216.67h fridge#109 P=1.78e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv27 夥伴Lv中位130
 醒來 225.00h fridge#109 P=2.33e+9 醒來幣=7.3e+14 剩=5.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 233.33h fridge#111 P=2.38e+9 醒來幣=6.2e+14 剩=6.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 241.67h fridge#112 P=2.40e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv28 夥伴Lv中位136
 醒來 250.00h fridge#112 P=2.40e+9 醒來幣=7.5e+14 剩=7.5e+14 訓練Lv28 夥伴Lv中位136
 醒來 258.33h fridge#112 P=2.40e+9 醒來幣=8.2e+14 剩=8.2e+14 訓練Lv28 夥伴Lv中位136
 醒來 266.67h fridge#112 P=2.40e+9 醒來幣=8.9e+14 剩=8.9e+14 訓練Lv28 夥伴Lv中位136
 醒來 275.00h fridge#112 P=2.42e+9 醒來幣=9.6e+14 剩=9.6e+14 訓練Lv28 夥伴Lv中位136
 醒來 283.33h fridge#112 P=2.42e+9 醒來幣=1.0e+15 剩=1.0e+15 訓練Lv28 夥伴Lv中位136
 醒來 291.67h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136
 醒來 300.00h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 308.33h fridge#112 P=2.44e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136
 醒來 316.67h fridge#112 P=2.44e+9 醒來幣=1.3e+15 剩=1.3e+15 訓練Lv28 夥伴Lv中位136
 醒來 325.00h fridge#112 P=2.44e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 333.33h fridge#112 P=2.47e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136
 醒來 341.67h fridge#112 P=2.47e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv28 夥伴Lv中位136
 醒來 350.00h fridge#112 P=2.48e+9 醒來幣=1.6e+15 剩=1.6e+15 訓練Lv28 夥伴Lv中位136
 醒來 358.33h fridge#112 P=2.48e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136
 醒來 366.67h fridge#112 P=2.48e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136
 醒來 375.00h fridge#112 P=3.24e+9 醒來幣=1.8e+15 剩=1.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 383.33h fridge#114 P=3.24e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 391.67h fridge#115 P=3.24e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 400.00h fridge#115 P=3.24e+9 醒來幣=1.6e+15 剩=1.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 408.33h fridge#115 P=3.24e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 416.67h fridge#115 P=3.24e+9 醒來幣=1.8e+15 剩=1.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 425.00h fridge#115 P=3.24e+9 醒來幣=1.9e+15 剩=1.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 433.33h fridge#115 P=3.24e+9 醒來幣=2.0e+15 剩=2.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 441.67h fridge#115 P=3.24e+9 醒來幣=2.1e+15 剩=2.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 450.00h fridge#115 P=3.27e+9 醒來幣=2.2e+15 剩=2.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 458.33h fridge#115 P=3.33e+9 醒來幣=2.3e+15 剩=2.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 466.67h fridge#115 P=3.33e+9 醒來幣=2.4e+15 剩=2.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 475.00h fridge#115 P=3.33e+9 醒來幣=2.5e+15 剩=2.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 483.33h fridge#115 P=3.33e+9 醒來幣=2.6e+15 剩=2.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 491.67h fridge#115 P=3.33e+9 醒來幣=2.7e+15 剩=2.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 500.00h fridge#115 P=3.33e+9 醒來幣=2.8e+15 剩=2.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 508.33h fridge#115 P=3.33e+9 醒來幣=2.9e+15 剩=2.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 516.67h fridge#115 P=3.33e+9 醒來幣=2.9e+15 剩=2.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 525.00h fridge#115 P=3.33e+9 醒來幣=3.0e+15 剩=3.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 533.33h fridge#115 P=3.33e+9 醒來幣=3.1e+15 剩=3.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 541.67h fridge#115 P=3.33e+9 醒來幣=3.2e+15 剩=3.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 550.00h fridge#115 P=3.33e+9 醒來幣=3.3e+15 剩=3.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 558.33h fridge#115 P=3.33e+9 醒來幣=3.4e+15 剩=3.4e+15 訓練Lv29 夥伴Lv中位142
 醒來 566.67h fridge#115 P=3.33e+9 醒來幣=3.5e+15 剩=3.5e+15 訓練Lv29 夥伴Lv中位142
 醒來 575.00h fridge#115 P=3.33e+9 醒來幣=3.6e+15 剩=3.6e+15 訓練Lv29 夥伴Lv中位142
 醒來 583.33h fridge#115 P=3.33e+9 醒來幣=3.7e+15 剩=3.7e+15 訓練Lv29 夥伴Lv中位142
 醒來 591.67h fridge#115 P=3.33e+9 醒來幣=3.8e+15 剩=3.8e+15 訓練Lv29 夥伴Lv中位142
 醒來 600.00h fridge#115 P=3.33e+9 醒來幣=3.9e+15 剩=3.9e+15 訓練Lv29 夥伴Lv中位142
 醒來 608.33h fridge#115 P=3.33e+9 醒來幣=4.0e+15 剩=4.0e+15 訓練Lv29 夥伴Lv中位142
 醒來 616.67h fridge#115 P=3.33e+9 醒來幣=4.1e+15 剩=4.1e+15 訓練Lv29 夥伴Lv中位142
 醒來 625.00h fridge#115 P=3.33e+9 醒來幣=4.2e+15 剩=4.2e+15 訓練Lv29 夥伴Lv中位142
 醒來 633.33h fridge#115 P=3.33e+9 醒來幣=4.3e+15 剩=4.3e+15 訓練Lv29 夥伴Lv中位142
 醒來 641.67h fridge#115 P=5.10e+9 醒來幣=4.4e+15 剩=3.3e+15 訓練Lv30 夥伴Lv中位147
 醒來 650.00h fridge#118 P=5.10e+9 醒來幣=3.4e+15 剩=3.4e+15 訓練Lv30 夥伴Lv中位147
 醒來 658.33h fridge#118 P=5.10e+9 醒來幣=3.6e+15 剩=3.6e+15 訓練Lv30 夥伴Lv中位147
 醒來 666.67h fridge#119 P=5.10e+9 醒來幣=3.7e+15 剩=3.7e+15 訓練Lv30 夥伴Lv中位147
 醒來 675.00h fridge#119 P=5.10e+9 醒來幣=3.9e+15 剩=3.9e+15 訓練Lv30 夥伴Lv中位147
 醒來 683.33h fridge#119 P=5.10e+9 醒來幣=4.0e+15 剩=4.0e+15 訓練Lv30 夥伴Lv中位147
 醒來 691.67h fridge#119 P=5.10e+9 醒來幣=4.2e+15 剩=4.2e+15 訓練Lv30 夥伴Lv中位147
 醒來 700.00h fridge#119 P=5.10e+9 醒來幣=4.3e+15 剩=4.3e+15 訓練Lv30 夥伴Lv中位147
 醒來 708.33h fridge#119 P=5.10e+9 醒來幣=4.4e+15 剩=4.4e+15 訓練Lv30 夥伴Lv中位147
 醒來 716.67h fridge#119 P=5.10e+9 醒來幣=4.6e+15 剩=4.6e+15 訓練Lv30 夥伴Lv中位147
 醒來 725.00h fridge#119 P=5.10e+9 醒來幣=4.7e+15 剩=4.7e+15 訓練Lv30 夥伴Lv中位147
 五連回本秒數 中位數 851.69 ／最差 3174.95（第29抽、第2天） ／整包重複比例 1188/1205 (98.59%)
  前5抽 {"n":1,"day":1,"at":100000,"scene":"backyard","pkg":12,"price":810,"newIds":["zhenjpg","lk","alu"],"gainPerSec":17.5,"paybackSec":46.285714285714285}
  前5抽 {"n":2,"day":1,"at":245000,"scene":"backyard","pkg":26,"price":6345,"newIds":["yang","lksphinx"],"gainPerSec":51,"paybackSec":124.41176470588235}
  前5抽 {"n":3,"day":1,"at":425000,"scene":"backyard","pkg":38,"price":26460,"newIds":[],"gainPerSec":19,"paybackSec":null}
  前5抽 {"n":4,"day":1,"at":620000,"scene":"backyard","pkg":46,"price":50085,"newIds":["jiaobu2","caihua"],"gainPerSec":118.5,"paybackSec":422.65822784810126}
  前5抽 {"n":5,"day":1,"at":795000,"scene":"kitchen","pkg":16,"price":0,"newIds":["mianhua","dog","zhenzhen2"],"gainPerSec":581.25,"paybackSec":0}
  後5抽 {"n":1201,"day":30,"at":2580900000,"scene":"fridge","pkg":119,"price":580255050491,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1202,"day":30,"at":2580990000,"scene":"fridge","pkg":119,"price":580255050491,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1203,"day":30,"at":2581080000,"scene":"fridge","pkg":119,"price":580255050491,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1204,"day":30,"at":2581170000,"scene":"fridge","pkg":119,"price":580255050491,"newIds":[],"gainPerSec":0,"paybackSec":null}
  後5抽 {"n":1205,"day":31,"at":2610000000,"scene":"fridge","pkg":119,"price":580255050491,"newIds":[],"gainPerSec":0,"paybackSec":null}
```

