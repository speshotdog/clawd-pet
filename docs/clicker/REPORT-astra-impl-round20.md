# 第二十輪實作報告

日期：2026-09-08；基準 HEAD：`83c9c38`；範圍：`BRIEF-astra-impl-round20.md`。

## 實作

1. 招募五連由 135 秒改為 80 秒，`drawCost` 使用中位數夥伴等級與 `trainingLevel / 2`；單抽 30 秒、定價下限、新卡追隊保留，`rates(s)` 與 `individual()` 的既有訓練倍率不變。
2. `buildCard` 移除 trait 參數與卡面文字，卡冊呼叫端同步移除；實際 `.card-trait` 規則位於 `clicker.css`，已刪除，展示頁「特質」資料列與技能提示保留，`gacha-card.css` 無需修改。
3. 寄生標籤最終舞台座標 **left 150px／top 120px／z-index 10**，全名 116×32px、compact 32×32px；進場由上方 20px 落下，impact 依當下標籤 offset 與尺寸取中心（全名中心 208,136；compact 中心 166,136）。
4. 連鎖標籤定位為 `slots.offsetLeft`／`slots.offsetTop - 52`，比原版上移 24px；實際發動珍母與三連鎖後，全名及 compact 均不與槽位、名字、冷卻或連鎖相交，`.skill-slot`／`.skill-name`／`.skill-slot small` 未改。
5. 宿主每次結算以 `result.earned`（該次結算實際被動入帳，不含點擊）呼叫 `floatPassive`，18px 淡金斜體、0.5px 描邊、無錢幣圖，包堆右側 ±16px 起點往右上飄 1400ms；每秒最多生成一個，保留完整 1400ms 動畫（會有短暫重疊），以文字右緣定位避免飄出舞台，被動優先回收並與點擊共用 12 個上限。
6. 點擊浮字依 `amount / P` 使用 26／30／36／42px 階梯，30 倍起旋轉 −4°、200 倍起粉色及 2px 描邊，連點金色保留，heavy 不再另設 34px 階梯。
7. 收益關卡使用中央紙票券章、升級音效及錢包 pulse，跨多級顯示最高一級，`peakRateStamp` 驗證並立即存檔防重複，換桌布歸零；凍結／停止舞台不生成，減少動態時浮字停用、章改淡入，停止時清理章。
8. 印記商店新增「永久／祝福」區段，收益祝福 Lv.N 與倍率／下一級價格、粉塵單次與 ×10、招募券按鈕均可重複購買；內容改為面板內捲動，商品不超出面板。
9. `buyBlessing`／`tradeDust(n)`／`buyDrawTicket(n)` 使用先結算再扣款的純邏輯，印記不足拋錯、批量數量要求正整數；blessing 預設 0、驗證級數與累計花費，換桌布保留，`blessMul` 對 rates 的 P、D 同乘加法祝福倍率，既有 `markMul` 不變。
10. 模擬器增加每日粉塵增量、祝福級數與剩餘印記輸出，`shop()` 優先買收益祝福至買不起；沿用原抽卡 seed、90 秒節流與原有玩法，不調整其他平衡常數。

## 驗收

- `npm.cmd test`：**154／154 PASS**（原 148＋新增 6）；既有招募測試的 135 秒／2160 價格依本輪更新為 80 秒／1280。
- `$env:PYTHONIOENCODING='utf-8'; python tools/test/clicker-round20.py`：**ALL PASS**；實際技能按鈕與既有切入、全名／compact／三連鎖矩形、18px 被動無圖浮字、42px 大額點擊、9 千→1.2 萬只蓋一次章、四個商店按鈕扣款與入帳、面板內捲動、凍結／停止／reduced-motion 均驗收。
- `$env:PYTHONIOENCODING='utf-8'; python tools/test/clicker-round19.py`：**ALL PASS**；四種解析度及 DPR 1.25／1.5、按鈕 CSS 邊框、最長角色名與原回報角色皆通過。
- Playwright 直接 route `src`，測試專用 stage 存取由 route 注入，不增加正式程式測試接口；沒有 build、啟動 server、git commit 或修改 PNG 素材。
- 以 Python 執行等價 UTF-8／`??` 掃描（環境沒有 rg）：57 個 JS／CSS／HTML 檔、31 行既有或合法 nullish 運算子，新增唯一問號對為 `s.blessing ??= 0; s.peakRateStamp ??= 0;`，沒有 U+FFFD 替代字元；明細 `_art/out/r20-encoding-scan.txt`。

## 截圖與幾何

- `_art/out/r20-parasite-full.png`
- `_art/out/r20-parasite-compact.png`
- `_art/out/r20-floaters.png`
- `_art/out/r20-mark-shop.png`

已檢視四張截圖；完整矩形記錄在 `_art/out/r20-geometry.json`。1280×860、舞台縮放 1.25 下：hero 畫面矩形 (290,123.75,300,320)；全名標籤 (247.5,270,145,40)、compact (247.5,270,40,40)，均不與 brief 指定四種矩形相交。

## 14 天模擬比較與守門

命令：`node tools/sim/clicker-curve.js 4 20 14`。改前以 `git show HEAD:src/clicker-economy.js` 透過 Node Module、原 src 檔名及 require cache 載入，再執行同一份增加統計的模擬器；沒有替換工作區原始碼或 git 索引。

- 五連總數 **561 → 569**（1.014 倍）；每日最大增幅 **28 → 36＝1.286 倍**，其餘各日 1 倍；每日最高 **42**，未超過 1.5 倍與節流上限。
- 每日粉塵入帳均相同：首日 **12 → 12**、次日 **3 → 3**，其餘 **0 → 0**；正入帳日倍率 1，零入帳日沒有增量，全部符合 `after <= before × 1.5`。
- 最後 P **2.47e9 → 2.48e9**、五連回本等完整輸出見下方。
- 兩側最後 **blessing Lv.0、剩餘印記 0**，數字上小於 10；**原模擬器從新檔開始、不執行換桌布，沒有領取印記，所以這不是玩家領取大量印記後消耗效果的證明**。本輪依要求只新增「有印記先買祝福」策略，沒有額外加入輪迴策略；第 3 級累計花 6 印記、P／D ×1.3 由單元測試與商店 UI 實測驗證。
- 保留原模擬器整段 20 分鐘＋8 小時離線的結束方式：14 天設定最後會跑到 341.67 小時，輸出含第 15 天開頭 1 次五連；下表與全文都保留該桶，不刪資料。

| 天（原輸出 day＋1） | 改前五連 | 改後五連 | 倍率 | 改前粉塵 | 改後粉塵 |
|---|---:|---:|---:|---:|---:|
| 1 | 28 | 36 | 1.286 | 12 | 12 |
| 2 | 42 | 42 | 1.000 | 3 | 3 |
| 3 | 42 | 42 | 1.000 | 0 | 0 |
| 4 | 42 | 42 | 1.000 | 0 | 0 |
| 5 | 42 | 42 | 1.000 | 0 | 0 |
| 6 | 42 | 42 | 1.000 | 0 | 0 |
| 7 | 42 | 42 | 1.000 | 0 | 0 |
| 8 | 42 | 42 | 1.000 | 0 | 0 |
| 9 | 28 | 28 | 1.000 | 0 | 0 |
| 10 | 42 | 42 | 1.000 | 0 | 0 |
| 11 | 42 | 42 | 1.000 | 0 | 0 |
| 12 | 42 | 42 | 1.000 | 0 | 0 |
| 13 | 42 | 42 | 1.000 | 0 | 0 |
| 14 | 42 | 42 | 1.000 | 0 | 0 |
| 15 | 1 | 1 | 1.000 | 0 | 0 |

## 改前 14 天模擬全文

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

 每日萬用粉塵入帳 {"0":12,"1":3,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0}

 收益祝福 Lv 0 剩餘印記 0

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

## 改後 14 天模擬全文

```text
=== 曲線模擬 CPS 4 session 20 min，天數 14 ===

王勝： backyard → kitchen → market → factory → nightmarket ；目前場景 fridge 第 112 包；P= 2.48e+9 coins= 1.73e+15 lifetime= 2.04e+15

升級次數 { click: 73, training: 28, partner: 2313, auto: 10 } 五連 569 夥伴 25 訓練 Lv 28 攻擊力 Lv 73 夥伴訓練 {"yueyue2":136,"zhenjpg":136,"lk":136,"alu":136,"yang":136,"lksphinx":136,"jiaobu2":136,"caihua":136,"mianhua":136,"dog":136,"zhenzhen2":136,"yuetrumpet":136,"zhencao":136,"fox":136,"yangpu":136,"yueyuexian":136,"jiaobu":136,"yueyue":136,"zhenfang":135,"zhenmoss":136,"jiaotou":135,"gebugou":136,"zhenmu":139,"jinggou":136,"zhenzhen":138}

 王 backyard 第 0 次 敗 比例 0.59/0.80/1.01 need 8.14e+4 時間 0.16h 主動 0.16h P 1.60e+3 P0=1.60e+3 D0=9.45e+1 slots=yueyue2,yang,jiaobu2

 王 backyard 第 1 次 敗 比例 0.93 need 8.14e+4 時間 0.17h 主動 0.16h P 1.60e+3 

 王 backyard 第 2 次 勝 比例 1 need 8.14e+4 時間 0.19h 主動 0.16h P 2.12e+3 

 王 kitchen 第 0 次 敗 比例 0.61/0.80/1.01 need 2.73e+6 時間 0.25h 主動 0.22h P 5.57e+4 P0=5.57e+4 D0=2.84e+3 slots=yueyue2,yang,jiaobu2

 王 kitchen 第 1 次 敗 比例 0.81 need 2.73e+6 時間 0.26h 主動 0.22h P 5.57e+4 

 王 kitchen 第 2 次 勝 比例 1 need 2.73e+6 時間 0.27h 主動 0.22h P 7.12e+4 

 王 market 第 0 次 敗 比例 0.61/0.80/1.03 need 3.40e+8 時間 8.33h 主動 0.28h P 6.96e+6 P0=6.96e+6 D0=3.49e+5 slots=yueyue2,yang,jiaobu2

 王 market 第 1 次 勝 比例 1 need 3.40e+8 時間 8.34h 主動 0.28h P 8.37e+6 

 王 factory 第 0 次 敗 比例 0.61/0.80/1.04 need 6.86e+8 時間 8.49h 主動 0.43h P 1.41e+7 P0=1.41e+7 D0=7.05e+5 slots=yueyue2,yang,jiaobu2

 王 factory 第 1 次 敗 比例 0.94 need 6.86e+8 時間 8.50h 主動 0.43h P 1.41e+7 

 王 factory 第 2 次 勝 比例 1 need 6.86e+8 時間 8.51h 主動 0.43h P 1.68e+7 

 王 nightmarket 第 0 次 敗 比例 0.53/0.68/0.92 need 5.38e+9 時間 16.67h 主動 0.58h P 9.42e+7 P0=9.42e+7 D0=4.72e+6 slots=yueyue2,yang,jiaobu2

 王 nightmarket 第 0 次 敗 比例 0.62/0.80/1.10 need 9.15e+9 時間 25.00h 主動 0.92h P 1.88e+8 P0=1.88e+8 D0=9.39e+6 slots=yueyue2,yang,jiaobu2

 王 nightmarket 第 1 次 勝 比例 1 need 9.15e+9 時間 25.01h 主動 0.92h P 2.06e+8 

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 58.39h 主動 2.30h P 8.55e+8 P0=8.55e+8 D0=4.28e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 66.67h 主動 2.57h P 8.85e+8 P0=8.85e+8 D0=4.43e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 75.00h 主動 2.91h P 9.06e+8 P0=9.06e+8 D0=4.53e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 83.33h 主動 3.24h P 1.20e+9 P0=1.20e+9 D0=5.99e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 91.67h 主動 3.57h P 1.22e+9 P0=1.22e+9 D0=6.12e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 100.00h 主動 3.91h P 1.23e+9 P0=1.23e+9 D0=6.15e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 108.33h 主動 4.24h P 1.25e+9 P0=1.25e+9 D0=6.28e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 116.67h 主動 4.57h P 1.25e+9 P0=1.25e+9 D0=6.28e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 125.00h 主動 4.91h P 1.65e+9 P0=1.65e+9 D0=8.27e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 133.33h 主動 5.24h P 1.68e+9 P0=1.68e+9 D0=8.39e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 141.67h 主動 5.57h P 1.68e+9 P0=1.68e+9 D0=8.39e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 150.00h 主動 5.91h P 1.68e+9 P0=1.68e+9 D0=8.39e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 158.33h 主動 6.24h P 1.72e+9 P0=1.72e+9 D0=8.59e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 166.67h 主動 6.57h P 1.73e+9 P0=1.73e+9 D0=8.66e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 175.00h 主動 6.91h P 1.73e+9 P0=1.73e+9 D0=8.66e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 183.33h 主動 7.24h P 1.74e+9 P0=1.74e+9 D0=8.73e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 191.67h 主動 7.57h P 1.74e+9 P0=1.74e+9 D0=8.73e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.00 need 1.00e+11 時間 200.00h 主動 7.91h P 1.76e+9 P0=1.76e+9 D0=8.80e+7 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 208.33h 主動 8.24h P 2.29e+9 P0=2.29e+9 D0=1.15e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 216.67h 主動 8.57h P 2.33e+9 P0=2.33e+9 D0=1.16e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 225.00h 主動 8.91h P 2.36e+9 P0=2.36e+9 D0=1.18e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 233.33h 主動 9.24h P 2.38e+9 P0=2.38e+9 D0=1.19e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 241.67h 主動 9.57h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 250.00h 主動 9.91h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 258.33h 主動 10.24h P 2.40e+9 P0=2.40e+9 D0=1.20e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 266.67h 主動 10.57h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 275.00h 主動 10.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 283.33h 主動 11.24h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 291.67h 主動 11.57h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 300.00h 主動 11.91h P 2.42e+9 P0=2.42e+9 D0=1.21e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 308.33h 主動 12.24h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 316.67h 主動 12.57h P 2.44e+9 P0=2.44e+9 D0=1.22e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 325.00h 主動 12.91h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2

 王 fridge 第 0 次 敗 比例 0.00/0.00/0.01 need 1.00e+11 時間 333.33h 主動 13.24h P 2.47e+9 P0=2.47e+9 D0=1.23e+8 slots=yueyue2,yang,jiaobu2

 包速 backyard n= 50 中位 11.0s p90 17.8s 最長 20s

 包速 kitchen n= 48 中位 3.0s p90 9.8s 最長 11s

 包速 market n= 38 中位 4.0s p90 14.8s 最長 17s

 包速 factory n= 49 中位 2.5s p90 17.8s 最長 117s

 包速 nightmarket n= 40 中位 10.0s p90 49.0s 最長 504s

 包速 fridge n= 67 中位 17.0s p90 542.3s 最長 1026s

 每日五連數 {"0":36,"1":42,"2":42,"3":42,"4":42,"5":42,"6":42,"7":42,"8":28,"9":42,"10":42,"11":42,"12":42,"13":42,"14":1}

 每日萬用粉塵入帳 {"0":12,"1":3,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0}

 收益祝福 Lv 0 剩餘印記 0

 主動遊玩總時數 13.57h

 醒來 0.33h 收工 market#66 P=4.13e+5 D=2.1e+4 訓練Lv9 攻擊力Lv35 夥伴15 Lv中位44

 醒來 8.33h market#109 P=6.96e+6 醒來幣=1.2e+10 剩=7.3e+6 訓練Lv16 夥伴Lv中位78

 醒來 8.67h 收工 nightmarket#81 P=2.11e+7 D=1.1e+6 訓練Lv16 攻擊力Lv51 夥伴20 Lv中位84

 醒來 16.67h nightmarket#114 P=9.42e+7 醒來幣=6.1e+11 剩=8.7e+9 訓練Lv21 夥伴Lv中位96

 醒來 17.00h 收工 nightmarket#116 P=1.48e+8 D=7.4e+6 訓練Lv21 攻擊力Lv56 夥伴22 Lv中位103

 醒來 25.00h nightmarket#132 P=1.88e+8 醒來幣=4.3e+12 剩=3.7e+12 訓練Lv22 夥伴Lv中位103

 醒來 33.33h fridge#94 P=3.93e+8 醒來幣=1.1e+13 剩=9.0e+12 訓練Lv23 夥伴Lv中位106

 醒來 41.67h fridge#96 P=5.70e+8 醒來幣=2.2e+13 剩=1.7e+13 訓練Lv24 夥伴Lv中位113

 醒來 50.00h fridge#99 P=6.28e+8 醒來幣=3.6e+13 剩=3.6e+13 訓練Lv24 夥伴Lv中位113

 醒來 58.33h fridge#100 P=8.55e+8 醒來幣=5.6e+13 剩=4.4e+13 訓練Lv25 夥伴Lv中位118

 醒來 66.67h fridge#102 P=8.85e+8 醒來幣=7.1e+13 剩=7.1e+13 訓練Lv25 夥伴Lv中位118

 醒來 75.00h fridge#103 P=9.06e+8 醒來幣=9.8e+13 剩=9.8e+13 訓練Lv25 夥伴Lv中位118

 醒來 83.33h fridge#103 P=1.20e+9 醒來幣=1.3e+14 剩=9.6e+13 訓練Lv26 夥伴Lv中位125

 醒來 91.67h fridge#105 P=1.22e+9 醒來幣=1.3e+14 剩=1.3e+14 訓練Lv26 夥伴Lv中位125

 醒來 100.00h fridge#106 P=1.23e+9 醒來幣=1.7e+14 剩=1.7e+14 訓練Lv26 夥伴Lv中位125

 醒來 108.33h fridge#106 P=1.25e+9 醒來幣=2.1e+14 剩=2.1e+14 訓練Lv26 夥伴Lv中位125

 醒來 116.67h fridge#106 P=1.25e+9 醒來幣=2.5e+14 剩=2.5e+14 訓練Lv26 夥伴Lv中位125

 醒來 125.00h fridge#106 P=1.65e+9 醒來幣=2.9e+14 剩=2.1e+14 訓練Lv27 夥伴Lv中位130

 醒來 133.33h fridge#108 P=1.68e+9 醒來幣=2.6e+14 剩=2.6e+14 訓練Lv27 夥伴Lv中位130

 醒來 141.67h fridge#109 P=1.68e+9 醒來幣=3.2e+14 剩=3.2e+14 訓練Lv27 夥伴Lv中位130

 醒來 150.00h fridge#109 P=1.68e+9 醒來幣=3.7e+14 剩=3.7e+14 訓練Lv27 夥伴Lv中位130

 醒來 158.33h fridge#109 P=1.72e+9 醒來幣=4.2e+14 剩=4.2e+14 訓練Lv27 夥伴Lv中位130

 醒來 166.67h fridge#109 P=1.73e+9 醒來幣=4.7e+14 剩=4.7e+14 訓練Lv27 夥伴Lv中位130

 醒來 175.00h fridge#109 P=1.73e+9 醒來幣=5.2e+14 剩=5.2e+14 訓練Lv27 夥伴Lv中位130

 醒來 183.33h fridge#109 P=1.74e+9 醒來幣=5.8e+14 剩=5.8e+14 訓練Lv27 夥伴Lv中位130

 醒來 191.67h fridge#109 P=1.74e+9 醒來幣=6.3e+14 剩=6.3e+14 訓練Lv27 夥伴Lv中位130

 醒來 200.00h fridge#109 P=1.76e+9 醒來幣=6.8e+14 剩=6.8e+14 訓練Lv27 夥伴Lv中位130

 醒來 208.33h fridge#109 P=2.29e+9 醒來幣=7.4e+14 剩=5.6e+14 訓練Lv28 夥伴Lv中位136

 醒來 216.67h fridge#111 P=2.33e+9 醒來幣=6.3e+14 剩=6.3e+14 訓練Lv28 夥伴Lv中位136

 醒來 225.00h fridge#112 P=2.36e+9 醒來幣=7.0e+14 剩=7.0e+14 訓練Lv28 夥伴Lv中位136

 醒來 233.33h fridge#112 P=2.38e+9 醒來幣=7.7e+14 剩=7.7e+14 訓練Lv28 夥伴Lv中位136

 醒來 241.67h fridge#112 P=2.40e+9 醒來幣=8.4e+14 剩=8.4e+14 訓練Lv28 夥伴Lv中位136

 醒來 250.00h fridge#112 P=2.40e+9 醒來幣=9.2e+14 剩=9.2e+14 訓練Lv28 夥伴Lv中位136

 醒來 258.33h fridge#112 P=2.40e+9 醒來幣=9.9e+14 剩=9.9e+14 訓練Lv28 夥伴Lv中位136

 醒來 266.67h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136

 醒來 275.00h fridge#112 P=2.42e+9 醒來幣=1.1e+15 剩=1.1e+15 訓練Lv28 夥伴Lv中位136

 醒來 283.33h fridge#112 P=2.42e+9 醒來幣=1.2e+15 剩=1.2e+15 訓練Lv28 夥伴Lv中位136

 醒來 291.67h fridge#112 P=2.42e+9 醒來幣=1.3e+15 剩=1.3e+15 訓練Lv28 夥伴Lv中位136

 醒來 300.00h fridge#112 P=2.42e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136

 醒來 308.33h fridge#112 P=2.44e+9 醒來幣=1.4e+15 剩=1.4e+15 訓練Lv28 夥伴Lv中位136

 醒來 316.67h fridge#112 P=2.44e+9 醒來幣=1.5e+15 剩=1.5e+15 訓練Lv28 夥伴Lv中位136

 醒來 325.00h fridge#112 P=2.47e+9 醒來幣=1.6e+15 剩=1.6e+15 訓練Lv28 夥伴Lv中位136

 醒來 333.33h fridge#112 P=2.47e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136

 醒來 341.67h fridge#112 P=2.48e+9 醒來幣=1.7e+15 剩=1.7e+15 訓練Lv28 夥伴Lv中位136

 五連回本秒數 中位數 131.13 ／最差 300.64（第9抽、第1天） ／整包重複比例 552/569 (97.01%)

  前5抽 {"n":1,"day":1,"at":95000,"scene":"backyard","pkg":12,"price":700,"newIds":["zhenjpg","lk","alu"],"gainPerSec":17.5,"paybackSec":40}

  前5抽 {"n":2,"day":1,"at":215000,"scene":"backyard","pkg":24,"price":3760,"newIds":["yang","lksphinx"],"gainPerSec":49.75,"paybackSec":75.57788944723617}

  前5抽 {"n":3,"day":1,"at":360000,"scene":"backyard","pkg":36,"price":15680,"newIds":[],"gainPerSec":17.75,"paybackSec":null}

  前5抽 {"n":4,"day":1,"at":500000,"scene":"backyard","pkg":44,"price":33184,"newIds":["jiaobu2","caihua"],"gainPerSec":148.125,"paybackSec":224.0270042194093}

  前5抽 {"n":5,"day":1,"at":685000,"scene":"kitchen","pkg":15,"price":0,"newIds":["mianhua","dog","zhenzhen2"],"gainPerSec":581.25,"paybackSec":0}

  後5抽 {"n":565,"day":14,"at":1200900000,"scene":"fridge","pkg":112,"price":8659255400,"newIds":[],"gainPerSec":0,"paybackSec":null}

  後5抽 {"n":566,"day":14,"at":1200990000,"scene":"fridge","pkg":112,"price":8659255400,"newIds":[],"gainPerSec":0,"paybackSec":null}

  後5抽 {"n":567,"day":14,"at":1201080000,"scene":"fridge","pkg":112,"price":8659255400,"newIds":[],"gainPerSec":0,"paybackSec":null}

  後5抽 {"n":568,"day":14,"at":1201170000,"scene":"fridge","pkg":112,"price":8659255400,"newIds":[],"gainPerSec":0,"paybackSec":null}

  後5抽 {"n":569,"day":15,"at":1230000000,"scene":"fridge","pkg":112,"price":8659255400,"newIds":[],"gainPerSec":17718208.720885277,"paybackSec":null}
```
