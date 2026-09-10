# 卡片手感實測報告

2026-09-10。結果：**FAIL，未達完整驗收**。已依 brief 完成字型與互動實作、依序建立六個產物、執行原有回歸與新增量測。總覽照用詳情卡 paint 後未達 hover 門檻，依「回報實測值停手」保留現況，不加光暈、不改門檻、不改卡內字級。不曾 commit 或 push。

## 交付與實作

- 修正 `build_round4_fonts.py`：呼叫 `Subsetter.populate(text=chars)`，並能替換已內嵌的字型，不再只找初次建置的 marker。
- 已依序執行 `build_round4_fonts.py` → `build_cards_remade.py` → `build_cards_remade_standalone.py` → `build_deluxe_b.py` → `build_deluxe_b_standalone.py` → `build_map20.py`。
- 總覽透過原有 `HoloCardFace.paint()` 接收指標座標；pointermove 用 rAF 合併，離開取消排程並回中立。換頁移除舊監聽器。詳情指標亦合併為 rAF。
- 總覽外層使用 `scale:1.04`、`180ms ease-out`，hover 及選取均生效，離開後選取仍維持放大。
- 字型原本在編隊單檔儲存兩遍。改為只儲存一份，在執行時還原相同 shadow CSS。單檔 **5,964,296 bytes**，小於 6,000,000；地圖 WebP quality 維持 **94**。

成品：[編隊／地圖](../../../../_art/holo-test/map20.html)、[卡面單檔](../../../../_art/holo-test/cards-remade-standalone.html)、[抽卡單檔](../../../../_art/holo-test/deluxe-gacha-b-standalone.html)。

## 字型、保護範圍與地圖

| 項目 | 實測 | 結果 |
|---|---:|---|
| Sans woff2 | 996 → **233,748 bytes** | 通過 150,000～600,000 |
| Serif woff2 | 984 → **317,200 bytes** | 通過 150,000～600,000 |
| 六份 HTML 的 Sans fonts.check | **6／6 true** | 通過 |
| 六份 HTML 的兩個 FontFace 強制 load 後 | **12／12 loaded，0 error** | 通過 |
| demo 去掉兩段字型 base64 後 | **位元組完全相同，0 行其他差異** | 通過 |
| src、card_face.js、ceremony.css/js、pool_data.py、map-art | **0 檔變更** | SHA-256 比對通過 |
| 地圖 1440×900／1024×768／390×844 | **0／0／0 像素差** | 通過 |

卡名 DOM 溢出檢查在編隊兩頁抽樣未發現溢出（0 筆），四組並排圖已目視檢查。這不等於所有卡池、所有尺寸的字形裁切皆已窮舉；未修改字級。

## Hover：基準本身未達指定範圍

固定 Chromium **136.0.7103.25**、DPR 1、同張宇宙冒險羊；指標位於卡寬 25%／50%／75%、高度 50%。CSS 動畫用 WAAPI 暫停、currentTime=1000，雙重 rAF 後截圖。亮區定義為固定卡面截圖內亮度最高 10% 像素；質心除以卡寬。像素差為任一 RGB 通道差 >2 的比例。截圖包含原有傾斜效果，沒有把傾斜造成的差異扣掉。

| 狀態 | 左／中／右亮區質心（卡寬 %） | 左右位移 | 左／中／右相對非 hover 像素差 |
|---|---|---:|---|
| 修改前詳情 | 44.151／46.077／47.905 | **3.754%** | **87.491%／0%／87.216%** |
| 修改前總覽 | 45.328／45.328／45.328 | **0%** | **0%／0%／0%** |
| 修改後詳情 | 44.151／46.077／47.905 | **3.754%** | **87.583%／0%／87.167%** |
| 修改後總覽 | 42.739／45.760／48.936 | **6.198%** | **90.072%／0%／89.305%** |

指定範圍為位移 **12～45%**、像素差 **3～25%**，本次未過。中心指標映射為 `(0,0)`，與中立姿態相同，因此中心差為 0。未把此事改寫成通過。

無指標輸入 60 幀內 **0 次 paint**；同批送入 20 次 pointermove，事件當下 **0 次**、雙 rAF 後 **1 次 paint**。移開／再次送出中立姿態的卡面差為 **0%**。這是有限 60 幀觀察，並非無限時間的自動掃箔證明。

## 放大與裁切

三尺寸第一張選取卡均為 **1.04、180ms、ease-out**，游標移開仍維持；單張抽樣裁切與遮擋皆為 0%。進一步逐一選取兩頁共 20 張卡、捲入可見區後，發現以下最差值。分母為放大後卡面矩形；裁切範圍包含 roster 捲動容器與視窗。

| 視窗寬 | 1.04 倍最大裁切 | 1.06 倍預留測試最大裁切 | 相鄰重疊 |
|---|---:|---:|---:|
| 1440 | **0%** | **0.584%** | **0%** |
| 1024 | **1.251%** | **2.173%** | **0%** |
| 390 | **0.936%** | **1.260%** | **0%** |

**裁切門檻未通過**。這些是後續完整掃描發現的真實問題，不能以第一張卡通過代表整隊通過；本次依 hover 失敗的停手條款保留，未取消放大。原始 120 組數據見 [clearance.json](clearance.json)。

## 黑角：不可把無鑑別力的綠燈算通過

使用文件原判準：深黑佔比 ≥8% 且最暗 ≤12；每角採在地背景。編隊注入確實位於 shadow root。

| 畫面 | 現況黑角／有效樣本 | 注入後黑角／有效樣本 | 判定 |
|---|---:|---:|---|
| demo | **0／4** | **3／4** | 正／負控制通過 |
| 抽卡十連結果 | **0／4** | **2／4** | 正／負控制通過 |
| 編隊 | **0／44** | **0／44** | **負控制失敗** |

編隊注入後最暗已到 **0**，最高深黑佔比 **7.639%**，低於 8%。既有第三輪腳本實際用另一組 **5%／6** 判準，在 900px 高視窗得到現況 **0／44**、注入 **12／44**。兩組結果均保留；沒有把舊腳本的成功當成文件原判準通過，也沒有調低新判準。抽卡揭卡途中 FX 未掃描，結果頁通過不代表整段演出通過。

## 完整回歸原始結果

原第三輪記錄共 **1107** 筆：1104 PASS、2 NEEDS_DEVICE、1 BASELINE。本次原腳本不改條件，結果為：

**1098 PASS、6 FAIL、2 NEEDS_DEVICE、1 BASELINE。**

六個 FAIL：

1. 舊保護清單將 demo 全檔凍結，因此報 1 檔變更；本輪授權的字型 base64 之外，實測 0 差異。
2. 桌面 `overview_pointer_unchanged` 要求 hover 不變，與本輪新增 hover 衝突。
3. 1440、1024 各有 `proxy_animations`、`automatic_animations` 失敗，共四筆；舊腳本把指標／選取觸發的 scale transition 也計為動畫（各 1）。獨立閒置 paint 檢查為 0。

地圖階段單獨保存 **247** 筆：**244 PASS、0 FAIL、2 NEEDS_DEVICE、1 BASELINE**。其中通過／基準合計 245。兩項 NEEDS_DEVICE 是既有 headless 分頁隱藏驗證：計時器三次均倒數 5 秒，但 visibility 未變 hidden，故不得宣稱裝置驗證通過。

原始完整輸出：[回歸 acceptance.json](regression/acceptance.json)、[本輪 after.json](after.json)、[修改前 before.json](before.json)。原腳本既有需人工辨識的項目仍保留為人工待驗。

## 截圖與重跑

| 場景 | 同卡、同尺寸前後並排 | 卡名／稀有度放大 |
|---|---|---|
| demo 大卡 | [並排](demo-pair.png) | [字形放大](demo-type-pair.png) |
| 抽卡結果 | [並排](gacha-pair.png) | [字形放大](gacha-type-pair.png) |
| 編隊總覽 | [並排](overview-pair.png) | [字形放大](overview-type-pair.png) |
| 編隊詳情 | [並排](detail-pair.png) | [字形放大](detail-type-pair.png) |

總覽字型比較暫時將外層 scale 定位為 1，以維持前後同尺寸；字型截圖與實際選取縮放測試分開。全畫面另有 `team-1440-after.png`、`team-1024-after.png`、`team-390-after.png`。

```powershell
python _art/holo-test/check_card_feel.py
python _art/holo-test/check_card_feel_clearance.py
python _art/holo-test/run_card_feel_regression.py
```

三支本次皆因記錄的未通過項目回傳非零。`--before` 僅用於修改前保存，不應對現在的產物重跑來覆蓋基準。所有建置日誌、原始像素截圖及判定均留在本資料夾。
