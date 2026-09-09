# 第三十二輪報告：新卡 4.0 精裝研究線

2026-09-09，`D:\claude\clawd-pet-holo`。已先讀 brief 第 0 節要求的工法、HANDOFF、完整 LESSONS、pool_data 檔頭與 round31 報告。

**已完成 16 張原圖輸出、63 張卡池整合、六支 builder、dev／standalone、逐卡對照與完整驗收執行；尚未全數通過 brief。** 五張 flat 為保留原圖的透明留邊審閱稿，並非要求的純 5:7 裁切；咩噗熊的原畫粉紅邊界超過指定亮邊比例。這六項保留為驗收失敗，沒有改成綠燈。透明留邊的偏好問題尚未得到使用者答覆，不視為已批准。

## 交付與邊界

- [展示頁](../../_art/holo-test/cards-remade-standalone.html) 與 [抽卡頁](../../_art/holo-test/deluxe-gacha-b-standalone.html) 均含 63 張，保留原有 47 張身份。
- `pool_data.py` 新增唯一 `EXTRA_CARDS` 資料清單；名稱／稀有度逐字核對來源檔名，id 為無聲調拼音，與原有 47 張無衝突。未改 `SCENE_CARDS` 與現有 43 張欄位。
- `embed_masks.py` 使用單一路徑解析函式，從 canonical pool 決定卡型；新 framed 由 `art/` alpha 生成箔面遮罩，新 flat 不產生／不掛 subject-mask。歷史 demo 遮罩保留；新遮罩重跑會更新。
- palette 共 63 筆：原有 43、新增 16、原有四張場景主體 palette；新卡 base 明度均低於插畫不透明像素的平均明度。
- gallery 納入原有四張 depth，並更新 portable 場景層解析；未新增 depth 或改卡面幾何、Z、字級。
- 開工前 SHA-256 清單與完工比對涵蓋 387 個檔案，`src/`、`card_face.js` 與所有 `ceremony*` 的變更數為 **0**。RATE 未改。原有 round31 dirty changes 完整保留。
- 沒有生成、重畫、補繪、拉伸或引入外部圖像／字型／npm。來源資料夾只讀。`怪物/` 的 `01.gif`、`ej93j4.gif`、`image.gif`、`rise.png` 未納入。

## 每張卡與原圖判讀

| id | 名稱 | 稀有度 | 卡型 | 原始尺寸 | 輸出尺寸 | 方法／判讀 |
|---|---|---|---|---|---|---|
| miepuxiong | 咩噗熊 | rare | framed | 370×320 | 589×580 | 原 alpha＋5 輪 defringe；單一粉紅熊，原本已有 alpha；下緣裸露粉紅填色。 |
| waisongmiege | 外送咩鴿 | rare | framed | 1350×1080 | 832×580 | 原 alpha＋5 輪 defringe；單一外送鳥，透明背景。 |
| pufayueyue | 普發玥玥 | rare | framed | 490×449 | 723×580 | 原 alpha＋5 輪 defringe；單一灰色角色，透明背景。 |
| geimieqianhaoma | 給咩錢好嗎 | epic | framed | 370×320 | 1009×580 | 原 alpha＋5 輪 defringe；羊角色與碗為原圖一組；已有 alpha，保留碗與原白色。 |
| jiaochi | 膠齒 | rare | framed | 1920×1200 | 543×580 | 原 alpha＋5 輪 defringe；白色小角色，原始透明背景；不是簡報描述的灰色四足獸。 |
| xiaochouyue | 小丑玥 | epic | framed | 672×667 | 724×580 | 邊緣近白洪水＋最大元件＋5 輪／165 defringe；灰獸趴在浮圈／水面，白底；不是簡報描述的派對帽。 |
| xiaojiaojiao | 小膠膠 | epic | framed | 570×574 | 510×580 | 邊緣近白洪水＋最大元件＋5 輪／165 defringe；棕黃色單一角色，白底；不是簡報描述的綠色。 |
| chengtiregou | 成體熱狗 | epic | framed | 449×590 | 449×580 | 邊緣近白洪水＋最大元件＋5 輪／165 defringe；站姿熱狗角色，白底；保留原本身體與黑線。 |
| bianbiancaihua | 扁扁彩華 | epic | framed | 759×664 | 649×580 | 邊緣近白洪水＋最大元件＋5 輪／165 defringe；綠色單一角色，白底；不是簡報描述的米色。 |
| yuexiong | 玥熊 | epic | framed | 619×492 | 739×580 | 邊緣近白洪水＋最大元件＋5 輪／165 defringe；灰色單一角色，白底。 |
| jintianwoshengri | 今天我生日 | legendary | framed | 593×586 | 482×580 | 邊緣近白洪水＋最大元件＋7 輪／150 defringe；生日帽灰獸，白底 JPEG。 |
| shabaolingzhu | 沙堡領主 | mythic | flat | 952×747 | 600×840 | 完整圖等比例縮放＋透明留邊（偏離 crop-only）；沙堡、羊、沙灘是一幅完整構圖。 |
| liulangyueshou | 流浪玥手 | mythic | flat | 688×648 | 600×840 | 完整圖等比例縮放＋透明留邊（偏離 crop-only）；角色、吉他、木頭與草地構成整幅插畫；白色也是原背景。 |
| zhenqiqiu | 珍氣球 | mythic | flat | 848×850 | 600×840 | 完整圖等比例縮放＋透明留邊（偏離 crop-only）；羊氣球與天空／雲層整幅插畫。 |
| zhenjunyue | 真菌玥 | mythic | flat | 800×800 | 600×840 | 完整圖等比例縮放＋透明留邊（偏離 crop-only）；實際為暗色森林／蘑菇角色，並非貼紙拼盤。 |
| zhenzhen | 珍珍 | mythic | flat | 2039×1378 | 600×840 | 完整圖等比例縮放＋透明留邊（偏離 crop-only）；實際為褐底貼紙拼盤，並非森林；所有邊緣貼紙保留。 |

所有 framed 都緊裁到四邊有非零 alpha，高 580，LANCZOS 縮放。近白洪水門檻為 RGB 全部 >235；只清與外緣相連的背景。最大元件僅用於六張白底素材；原本有 alpha 的五張直接保留原來的分離物件。縮放後另做同規則邊界清理；兩階段都保護原圖封閉白色元件。沒有色彩重繪。

## 去背品質數字

「白元件／像素」是原尺寸、與邊緣不相連且 RGB 全 >235 的元件；元件逐個的移除像素陣列見 [quality-checked.json](shots/round32/quality-checked.json)。新洞在原尺寸處理後、排除與外緣連通的透明區計算，不把本來已有的透明洞當新洞。亮邊比例在最終 580px 輸出、四鄰邊界用 `min(R,G,B)>165` 計算。

| id | 封閉白元件數 | 封閉白像素 | 移除白像素 | 新內部透明洞像素 | 最大元件清除的非背景像素 | 亮邊比例 |
|---|---:|---:|---:|---:|---:|---:|
| miepuxiong | 291 | 335 | 0 | 0 | 0 | 10.92972% |
| waisongmiege | 6 | 1117 | 0 | 0 | 0 | 0.00000% |
| pufayueyue | 4 | 388 | 0 | 0 | 0 | 0.03709% |
| geimieqianhaoma | 164 | 4732 | 0 | 0 | 0 | 0.61870% |
| jiaochi | 4 | 84273 | 0 | 0 | 0 | 0.00000% |
| xiaochouyue | 11 | 24790 | 0 | 0 | 3336 | 0.02045% |
| xiaojiaojiao | 9 | 1152 | 0 | 0 | 0 | 0.00000% |
| chengtiregou | 0 | 0 | 0 | 0 | 0 | 0.00000% |
| bianbiancaihua | 2 | 13 | 0 | 0 | 84 | 0.01833% |
| yuexiong | 0 | 0 | 0 | 0 | 0 | 0.00000% |
| jintianwoshengri | 0 | 0 | 0 | 0 | 7766 | 0.00000% |

咩噗熊的最終邊界共 5023 像素，549 個超過門檻，其中 544 個是粉紅色、548 個位於最下方 20px。原畫的裸露粉紅填色也符合此亮度門檻，因此不能繼續剝到 1% 而不侵蝕原畫。門檻未放寬；保留失敗。小丑玥初版 defringe 刪除一個凹角近白像素；後來明確保護原始封閉白元件，最終移除數歸零。

最大元件規則確實移除了今天我生日的三個分離彩色裝飾（以及小丑玥、扁扁彩華的分離殘留），沒有把這些數字寫成零。角色主體完整；成體熱狗、今天我生日、給咩錢好嗎的逐卡前後圖已目視檢查。若要保留生日裝飾，須改最大元件規則，另行裁決。

## Flat 構圖限制

逐張開圖後發現五張的完整主體／貼紙分布寬於可用的 5:7 直式裁切範圍。直接裁切會切掉角、木頭、氣球或貼紙；本輪沒有做這種素材取捨，也沒有把圖拉長或生成背景。交付為完整圖等比例置中於透明 600×840 畫布，沿用 flat，沒有 subject-mask 或图內視差。這是可審閱的保全稿，**不是 brief 的 crop-only 完成版**；新 checker 對五張各保留一個失敗。

## 執行結果與實際退出碼

Standalone 最終 **5,945,963 bytes**；對 5,146,465 基準增加 **799,498 bytes**，低於更保守的 900,000 bytes 上限。

新驗收先以已知正確的封閉白色／故意新增洞數值案例，以及歷史 dino 實際 Range 文字量測校準，`--self-test` exit 0。舊 demo 保持 65 個歷史展示樣本；新卡只在 Deluxe，因此 regression 對新卡比對 gallery／gacha，對既有 47 張繼續包含 legacy demo，不偽稱 legacy demo 已新增新卡。

| 命令（共同前綴 `python _art/holo-test/`） | 實際 exit code，依執行順序 |
|---|---|
| `check_demo_round8.py` | 0, 0 |
| `check_demo_round9.py` | 0, 0 |
| `check_new_cards_round32.py --self-test` | 0 |
| `prepare_round32.py` | 0, 0 |
| `build_card_scenes.py` | 0, 0 |
| `embed_masks.py` | 0, 0 |
| `build_cards_remade.py` | 0, 0 |
| `build_cards_remade_standalone.py` | 0, 0 |
| `build_deluxe_b.py` | 0, 0 |
| `build_deluxe_b_standalone.py` | 0, 0 |
| `check_new_cards_round32.py` | 1, 1, 1, 1 |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | 0, 0 |
| `check_gacha_card_regression.py` | 0 |
| `check_gacha_ceremony_round30.py` | 0 |
| `check_new_cards_round32.py --assets-only` | 1 |
| `check_gacha_layers_round31.py` | 0 |
| `Python Chromium-log cleanup guard (initial GPU-only assertion)` | 1 |
| `Python Chromium-log cleanup guard (GPU/audio verified)` | 0 |

Chromium 的原生 GPU／audio log 有診斷訊息，與 page console／pageerror 分開看待；沒有宣稱原生日誌零錯誤。完整存檔在 `shots/round32/chromium-debug.log`，根目錄 `debug.log` 已還原起初的乾淨版本。首次清理 guard 因多出一行 audio warning 而中止，未改檔；確認 GPU／audio 全部是瀏覽器診斷後才存檔還原。

完整 [command-exits.json](shots/round32/command-exits.json) 保存每次 returncode、時長與後期逐次 log 路徑。runner 只要任何子程式失敗就 exit 1。初次新驗收因 fixture 最後僅剩 3 張而觸發不存在的三抽控制，實際 exit 1；修為合法五抽補齊後重跑，沒有修改 ceremony。中途含舊版白像素處理的完整新驗收有 7 項失敗；最終重新量測為下列失敗：

- `miepuxiong bright boundary <=1%`
- `shabaolingzhu crop-only composition contract`
- `liulangyueshou crop-only composition contract`
- `zhenqiqiu crop-only composition contract`
- `zhenjunyue crop-only composition contract`
- `zhenzhen crop-only composition contract`

量測使用 Chromium、本機 file://；gallery 每尺寸 63 張兩兩 rect 交集，results 以合法批次遍歷 63 張、手機逐頁量測；文字使用 `Range.selectNodeContents`，上限 1.5px。每張新卡各完成正常 fixture 揭曉，兩入口均驗證。portable 實際複製至同 worktree 的獨立資料夾後開啟。結果細節見 [acceptance.json](shots/round32/acceptance.json)。

保留 round31 的 FX／native charge／互動斷言；round31 的舊 +200KB 演出專用體積預算更新為本 brief 的新卡 +900KB 預算，其餘閾值不降。舊 harness 僅調整本輪證據目的地、gallery 卡池數量與 Deluxe-only 比對範圍。

## 圖片證據

- [63 張卡面接觸表](shots/round32/contact-sheet-63.jpg)
- 抽卡結果：[1440×900](shots/round32/dev-results-1440.png)、[1024×640](shots/round32/dev-results-1024.png)、[390×844](shots/round32/dev-results-390.png)；同目錄有 portable 三尺寸。
- 每張去背／構圖前後：
  - [咩噗熊](shots/round32/miepuxiong-before-after.png)
  - [外送咩鴿](shots/round32/waisongmiege-before-after.png)
  - [普發玥玥](shots/round32/pufayueyue-before-after.png)
  - [給咩錢好嗎](shots/round32/geimieqianhaoma-before-after.png)
  - [膠齒](shots/round32/jiaochi-before-after.png)
  - [小丑玥](shots/round32/xiaochouyue-before-after.png)
  - [小膠膠](shots/round32/xiaojiaojiao-before-after.png)
  - [成體熱狗](shots/round32/chengtiregou-before-after.png)
  - [扁扁彩華](shots/round32/bianbiancaihua-before-after.png)
  - [玥熊](shots/round32/yuexiong-before-after.png)
  - [今天我生日](shots/round32/jintianwoshengri-before-after.png)
  - [沙堡領主](shots/round32/shabaolingzhu-before-after.png)
  - [流浪玥手](shots/round32/liulangyueshou-before-after.png)
  - [珍氣球](shots/round32/zhenqiqiu-before-after.png)
  - [真菌玥](shots/round32/zhenjunyue-before-after.png)
  - [珍珍](shots/round32/zhenzhen-before-after.png)

## 提交邊界與未完成項

未 commit、未 push。`.git` 指向 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，超出允許寫入的 worktree；依使用者指示跳過 commit。沒有改共享 index、主工作區或全域 Git 設定；唯讀 Git 使用單次 `-c safe.directory=...`。

後續可分三個提交邊界：
1. 原圖產製：`prepare_round32.py`、16 張 `art/card-*.png`、去背／構圖證據；五張 padded flat 與粉紅亮邊須先裁決。
2. 資料與建置：`pool_data.py`、`embed_masks.py`、palette builder／palette、gallery builders、demo mask block、四個生成 HTML。`build_deluxe_b.py` 與 ceremony 的既有 dirty hunks 屬 round31，不能當本輪修改提交。
3. 驗收與文件：`check_new_cards_round32.py`、runner／report helper、retained checks 的本輪增量、`shots/round32/`、本報告、TODO 與 LESSONS 的本輪增量。

未完成：五張 flat 的純裁切契約與咩噗熊 ≤1% 亮邊契約尚未通過；使用者尚未裁決這兩項與保留原畫的衝突。怪物素材明確排除。沒有宣稱實體手機／跨 GPU 測試或美感盲測。
