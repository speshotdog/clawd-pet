# 第四十輪：4.0 神話卡完成報告

**〇之二的四項決定是代為裁決，待使用者追認。** 本輪依第五節的量測否決權，進一步修正兩張純裁切路線；詳見下文。

已依序讀完簡報〇的五份指定材料後才修改程式。只在本 worktree 寫入；未 commit、未 push。保留開工時已有的第三十四至三十九輪改動。

## 實作與規格修正

珍氣球的實際主體（含線）bbox 為 x=69…795，寬726；真菌玥含肢體為 x=43…726，寬683。原定5:7純裁切視窗約607／571，不能保留完整主體。因此兩張改為裁掉兩側部分裝飾，再沿上下原邊像素外推，佔比約18.2%。没有重新畫雲、星星或角色。

沙堡原圖952×747若完全保留寬度，5:7高度約1333，需要586px，外推佔43.96%，不是規劃中的358px。改為先裁兩側背景至762px（x=116…878，保留沙堡與羊），再補320px，佔29.9906%，仍小於30%。沙堡是subject，羊／鏟子／沙灘／天空留在background，保留遮擋順序。

珍珍維持flat及既有透明留邊，卡圖未改。怪物素材未收。珍氣球的線在原圖下緣本來已截斷；保留現有全部線像素，不生成延長線。

兩層共用裁切與補邊矩形，輸出600×840 RGBA。縮放只作統一輸出重採樣（整數像素取整）；沒有局部拉伸、生成式補圖或重描RGB。

## 五張卡的處理與量測

| 卡 | 方法／主體 | 原圖 | 輸出 | 補洞像素 | 未填 | 邊界色差 ≤8 | 外推佔比 ≤30%／色差 ≤6 | 裁掉主體像素 |
|---|---|---|---|---:|---:|---:|---|---:|
| 珍氣球 | depth／含線羊氣球 | 848×850 | 兩層600×840 | 353824 | 0 | 0.154181 | 18.1906%／0.148547 | 0 |
| 真菌玥 | depth／灰色獸含肢體 | 800×800 | 兩層600×840 | 273925 | 0 | 1.619376 | 18.2840%／0.272612 | 0 |
| 沙堡領主 | depth／沙堡 | 952×747 | 兩層600×840 | 138122 | 0 | 0.337630 | 29.9906%／0.000000 | 0 |
| 流浪玥手 | framed／狼＋琴＋木頭＋草地 | 688×648 | 688×580 RGBA | 不適用 | 新洞0 | 亮邊0.1941% | 不適用 | 封閉白移除0 |
| 珍珍 | flat原檔保留 | 2039×1378 | 600×840，既有留邊 | 不適用 | 不適用 | 不適用 | 不適用 | 本輪未裁 |

補洞使用距離變換找到洞外最近的原圖像素並clone；逐像素驗證補入RGB等於其來源RGB。量測在原圖像素尺度：洞的內外各3px形態學帶，分別取RGB平均後算三通道絕對差的平均（0–255）。外推比較重複邊緣列與原圖相鄰三列，沿用原像素，不混色生成。填滿整張背景，因此所有最大位移均無未填洞；這不代表補洞能重建被遮住的真實場景。原圖羊／鏟子／陰影被clone進遮擋區的痕跡在「補洞後」圖完整揭露。

| 卡 | 原圖主體bbox（右／下不含） | 同層裁切矩形 | 上／下補邊 | 輸出alpha bbox |
|---|---|---|---|---|
| 珍氣球 | [69, 54, 795, 850] | [61, 0, 803, 850] | 94／95 | [4, 117, 596, 766] |
| 真菌玥 | [43, 105, 726, 697] | [35, 0, 734, 800] | 89／90 | [4, 164, 596, 677] |
| 沙堡領主 | [120, 329, 710, 630] | [116, 0, 878, 747] | 160／160 | [1, 383, 470, 624] |

## 去背與亮邊

`prepare_round32.py`支援`HOLO_SOURCE`，未設定時自動偵測簡報中的兩個素材候選路徑。邊緣相連近白洪水填充（>235）→最大元件→原尺寸及縮放後defringe均接同一份`bright_edge.sat_ok()`，保護封閉白與飽和填色。原本11張framed也從原圖重跑，以免只改判準而留下先前被剝掉的填色。

| 卡 | 原圖 | 輸出（高580） | 封閉白元件數 | 全白像素／移除白像素 | 封閉白像素／移除 | 新內部透明洞像素 | 亮邊比例 ≤1% |
|---|---|---|---:|---:|---:|---:|---:|
| 咩噗熊 | 370×320 | 578×580 | 291 | 2612／2276 | 335／0 | 0 | 0.0000% |
| 外送咩鴿 | 1350×1080 | 832×580 | 6 | 1117／0 | 1117／0 | 0 | 0.0000% |
| 普發玥玥 | 490×449 | 723×580 | 4 | 1370／979 | 388／0 | 0 | 0.0371% |
| 給咩錢好嗎 | 370×320 | 1009×580 | 164 | 7626／2864 | 4732／0 | 0 | 0.6187% |
| 膠齒 | 1920×1200 | 543×580 | 4 | 84273／0 | 84273／0 | 0 | 0.0000% |
| 小丑玥 | 672×667 | 722×580 | 11 | 300166／275376 | 24790／0 | 0 | 0.0207% |
| 小膠膠 | 570×574 | 510×580 | 9 | 200335／199183 | 1152／0 | 0 | 0.0000% |
| 成體熱狗 | 449×590 | 449×580 | 0 | 125220／125220 | 0／0 | 0 | 0.0000% |
| 扁扁彩華 | 759×664 | 649×580 | 2 | 347490／347477 | 13／0 | 0 | 0.0184% |
| 玥熊 | 619×492 | 739×580 | 0 | 126466／126466 | 0／0 | 0 | 0.0000% |
| 今天我生日 | 593×586 | 482×580 | 0 | 241075／241075 | 0／0 | 0 | 0.0000% |
| 流浪玥手 | 688×648 | 688×580 | 31 | 228498／228282 | 216／0 | 0 | 0.1941% |

## 建置與搬移驗收

依簡報順序六支builder全部exit 0：`build_card_scenes.py` → `embed_masks.py` → `build_cards_remade.py` → `build_cards_remade_standalone.py` → `build_deluxe_b.py` → `build_deluxe_b_standalone.py`。三張資料同時設depth及scene=True；embed_masks會重烘這三張的subject mask。沒有修改card_face.js、src/gacha-pool.js、RATE或卡面CSS幾何／Z／字級。

`check_depth_round40.py` exit 0：兩個單檔複製到`shots/round40/portable/`後才開啟。六個「入口×卡」都載入兩張內嵌圖片與subject mask；背景解碼alpha全255，pageerror及外部請求皆0。逐一拍下四角x/y=±1：rotateX/Y=±14°，subject平移±1.5px、background反向±0.5px；共24張最大視差截圖。測試直接呼叫既有paint以探測上限，不改產品的互動規則。初版virtual-clock探針停滯後終止，改用真實開包／跳過揭曉流程完成；沒有把中止當通過。

## 真實退出碼

| 腳本 | exit code |
|---|---:|
| check_demo_round8.py | 0 |
| check_demo_round9.py | 0 |
| check_gacha_card_regression.py | 0 |
| check_gacha_followup.py | 0 |
| check_bright_edge.py | 0 |
| check_new_cards_round32.py | 1 |
| check_gift_card.py | 0 |
| check_gift_perf.py | 1 |
| check_depth_round40.py | 0 |

Round9兩入口均65張（22張示範＋43張舊卡池）；該demo未新增4.0卡，故原卡數斷言仍正確且實跑通過。新增depth另由round40搬移驗收覆蓋。Round32將kind斷言擴充成depth並新增scene／雙層尺寸／不透明背景斷言；亮邊改用已裁決的共用判準，1%門檻不動。

所有原始stdout／stderr：[驗收日誌與退出碼](shots/round40/exit-codes.json)。失敗細節見同資料夾各`check_*.py.log`，不刪斷言、不放寬門檻。

Round32完成1542項，3項失敗：珍珍既有alpha bbox `[0,217,600,622]` 不符合舊純裁切契約；單檔6,127,733 bytes，相對舊基準增加981,268 bytes，超出900,000預算81,268 bytes；歷史凍結快照不同的檔案為`src/clicker.html`、`src/gacha-mode-deluxe.js`、`src/gacha.html`及本輪必改的`pool_data.py`。前三項src檔不在本輪修改範圍，沒有為通過測試倒退它們。完整記錄：[acceptance-round32.json](shots/round40/acceptance-round32.json)。

魔花少女：完整視覺驗收原地與搬移均exit 0，卡名對比6.46:1、寶石對比145.67、卡寬380px與字級31.45／17.69／28.83均通過。效能驗收獨立在其他瀏覽器工作結束後跑5輪×2入口，10筆全部未達原預算：fps 20.22–20.66（要求≥35）、中位50.0ms（要求≤25）、p95約50.1ms（要求≤50）；靜置rAF均0。這與第三十九輪已記錄的效能未達標方向一致，不能宣稱本輪把它修好。產品頁、builder與gift素材沒有變；完整數據：[gift/round40.json](shots/round40/gift/round40.json)，視覺：[gift/round40-verification.json](shots/round40/gift/round40-verification.json)。

## 截圖與重跑

- 珍氣球：[補洞前](shots/round40/zhenqiqiu-hole-before.png)／[補洞後](shots/round40/zhenqiqiu-hole-after.png)／[重合圖](shots/round40/zhenqiqiu-aligned.png)／[gallery最大視差](shots/round40/cards-remade-zhenqiqiu-max-1-1.png)／[gacha最大視差](shots/round40/deluxe-gacha-b-zhenqiqiu-max-1-1.png)。
- 真菌玥：[補洞前](shots/round40/zhenjunyue-hole-before.png)／[補洞後](shots/round40/zhenjunyue-hole-after.png)／[重合圖](shots/round40/zhenjunyue-aligned.png)／[gallery最大視差](shots/round40/cards-remade-zhenjunyue-max-1-1.png)／[gacha最大視差](shots/round40/deluxe-gacha-b-zhenjunyue-max-1-1.png)。
- 沙堡領主：[補洞前](shots/round40/shabaolingzhu-hole-before.png)／[補洞後](shots/round40/shabaolingzhu-hole-after.png)／[重合圖](shots/round40/shabaolingzhu-aligned.png)／[gallery最大視差](shots/round40/cards-remade-shabaolingzhu-max-1-1.png)／[gacha最大視差](shots/round40/deluxe-gacha-b-shabaolingzhu-max-1-1.png)。
- [流浪玥手去背前後](shots/round40/liulangyueshou-before-after.png)。
- [補洞量測JSON](shots/round40/depth-metrics.json)、[去背JSON](shots/round40/cutout-metrics.json)、[搬移／四角JSON](shots/round40/portable-depth.json)。

在worktree根目錄執行：`python _art/holo-test/prepare_round40.py`重產三張雙層及12張framed，再依上述六支builder順序建置；`python _art/holo-test/run_checks_round40.py`跑八支既有驗收，`python _art/holo-test/check_depth_round40.py`驗搬移。

## 凍結檔核對

驗收前後SHA-256比對11個檔案（含禮物頁、builder、gift素材、card_face.js、遊戲卡池、珍珍卡圖），變更清單：`[]`。這是驗收前後的核對，沒有冒稱為開工前快照；本輪沒有編輯任何禮物產品檔。詳見[frozen-after-checks.json](shots/round40/frozen-after-checks.json)。
