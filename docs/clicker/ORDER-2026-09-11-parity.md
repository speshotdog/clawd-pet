**裁決：採用「以抽卡揭卡為準的完整卡面一致性」；選 A 補字型仍須完成。目前維持 EXIT 1，不可 commit。**

以下為 `ORDER-2026-09-11-parity.md` 指令正文。唯讀沙箱無法落檔，因此直接交付文字。本輪已讀背景鏈、設計／工法、量測腳本與原始碼，並解析內嵌字型；**沒有修改檔案、跑 build 或 Playwright。瀏覽器實際呈現與下列驗收結果，均待執行方提供證據。**

### 1. 目標裁決

第一節解讀基本正確，正式目標改為：

> 同一張正式卡，在抽卡揭卡、卡池、編隊總覽與詳情中，應保有相同的卡面設計、字體階層、配色、素材及效果；尺寸差異依共用卡面的既有縮放規則呈現。

字重、字距不再另選新方案，直接採抽卡現有規則。**但這些屬性仍要驗，不能因為「照抽卡」就省略。**

選 A 的缺字修補繼續執行。參考基準分成：

- **設計基準：**保存本次施工前的抽卡卡面。
- **最終字型基準：**補齊字元後的抽卡卡面；只接受可追溯到缺字修補的字形、文字寬度與縮字變化，不藉此重設階層。

禮物卡另案維持特殊外觀；`mtk-card` 不自動視為同一張卡或一起加入卡池。

### 2. 「一模一樣」的量測定義與 epic 修正

**epic 以抽卡的 `#f0d6ff`／`rgb(240,214,255)` 為準。**

來源已確認：

- [demo.html:768](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:768) 的階級規則使用 `color:var(--accent-card)`；epic 的 accent 是 `#b875ff`。
- [demo.html:588](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:588) 定義 epic 的 `--name-ink:#f0d6ff`；`body.ink-chroma …` 覆寫文字色。
- [build_deluxe_b.py:61](/D:/claude研究/clawd-pet-50/_art/holo-test/build_deluxe_b.py:61) 與卡池建置器會啟用 `body.ink-chroma`。
- [build_map20.py:62](/D:/claude研究/clawd-pet-50/_art/holo-test/build_map20.py:62) 複製 CSS，[team20.js:18](/D:/claude研究/clawd-pet-50/_art/holo-test/team20.js:18) 將卡面放進 shadow root。內部選擇器無法透過 shadow 邊界匹配外部 `body`，因此落回 accent 色。

這是**樣式作用域遺漏**。[DESIGN-team-and-map.md](/D:/claude研究/clawd-pet-50/docs/clicker/DESIGN-team-and-map.md) 的 §7-1 指定新 UI 語言與完整精裝卡展示，沒有指定編隊卡內另用飽和紫。

**施工指令：**在編隊共用的 shadow 樣式組裝處補上卡面文字色的作用域適配，讓總覽、詳情共同取得抽卡的 `--name-ink` 規則。核對選擇器特異性與兩行 computed style。不要改全域 `--accent-card`，那會連帶改寶石、卡框與光暈；只改外部 body class 也無效。

量測分兩層：

1. **同尺寸對照：**把真正頁面中的卡片設為相同未變形 content-box 寬度，保留各頁原有祖先結構與 shadow root，固定姿態後比較。用來識別設計差異。
2. **原生尺寸對照：**恢復各入口尺寸，驗共用縮放、長名適配及實際排版。不能把所有數值除以卡寬後一律要求相等。

| 類別 | 必驗項目與比較方式 |
|---|---|
| 身分與內容 | ID、rarity、kind、卡名與稀有度全文；完全一致 |
| 文字設計 | family、weight、style、white-space、text-transform、line-height 規則、color、text fill、opacity；相同狀態下完全一致 |
| 尺寸與排版 | 字級、字距、Range 寬高／行數、兩行距離、左右淨空、與寶石及裁切邊界的關係；保存原始值及正規化值 |
| 銘牌、寶石、卡框 | `.face-plate`、`.face-gem`、`.face-frame` 的位置、尺寸、padding、gap、border、radius、背景、陰影與必要偽元素 |
| 素材與效果 | 角色／背景、遮罩、箔面各層、漸層完整內容、filter、blend、opacity、transform 與卡背實際渲染載體 |

補充規則：

- 分母採 [card_face.js:150](/D:/claude研究/clawd-pet-50/_art/holo-test/card_face.js:150) 同義的**未變形 content-box 寬度**，不採傾斜後的 `getBoundingClientRect().width`。
- 按比例縮放的長度除以卡寬；固定 px、最小描邊、斷點規則按來源公式驗。角度、色彩、opacity、字重不除卡寬。
- 陰影／filter 要拆開比較長度與顏色，不能整串原樣比卻宣稱已正規化；背景不得截成前 40 字。
- URL 與 data URI 可不同，但須追溯同一素材；有重新編碼時另驗尺寸、alpha／輪廓及受控畫面，不能只比 URL。
- 周邊 UI、卡片在頁面上的位置、揭卡儀式階段可不同；卡內設計不得因此不同。

**容差先校準再固定：**

依 [METHOD-card-face.md](/D:/claude研究/clawd-pet-50/docs/clicker/METHOD-card-face.md)，先用固定腳本、同環境的合格抽卡樣本完整暖機，再收三次正式量測。每個幾何指標列出「樣本、原始範圍、波動、量化誤差、上下限、餘裕理由」，固定後才驗候選版。

已存在的程式契約維持：

- CSS 字級變數誤差 `<0.011 CSS px`。
- `abs(rarityFS − nameFS × 0.5625) <0.011px`。
- 保留 80／102／290px 不縮字測試及 102px、100W 下限測試。

**不得沿用任意 `2e-4` 或「90% 卡寬」作視覺容差。** 現有 `rar._h` 差異尚未定位：腳本量的是元素框，還刪掉 line-height，不能判定只是四捨五入，也不能直接改 CSS 消差。先分別量元素框、文字 Range、字型使用及 line-height。

### 3. 執行順序

1. 重寫量測器，建立預期樣本清單；用目前版本保存受控抽卡基準與各入口施工前證據。
2. 用該量測器確認 epic 差異及其他 parity 缺口；完成編隊作用域修正。其他差異只在已定位來源後修，不預先重設卡面。
3. **將 parity 修正與選 A 合併成一次主線建置**，不要先跑完整舊流程再重跑一輪。
4. 校準最終字型下的抽卡幾何基準，執行全量驗收、負控制與重建副作用回歸，再交回報。

工作目錄 `_art/holo-test`，逐條執行，非零即停：

```text
python update_demo_data.py
python build_round4_fonts.py
python build_round5_standalone.py
python build_cards_remade.py
python build_cards_remade_standalone.py
python build_deluxe_b.py
python build_deluxe_b_standalone.py
python build_deluxe_b.py --test
python build_deluxe_b_standalone.py --test
python build_map20.py
```

保留既有 poolData／sceneData 同步。`build_round5_standalone.py` 仍會再次呼叫 update，須确认資料未因此漂移。字型建置器使用本機 Noto 字型檔，回報其版本與雜湊。

不執行禮物／mtk 建置，不改抽卡機率、編隊規則或共用縮放常數。

### 4. 量測腳本重寫規格

以下為必要要求：

| 缺口 | 明確要求 |
|---|---|
| 字型證據無節點對應 | 每筆保留入口、viewport、ID、畫面角色、實例序號、shadow host 路徑、文字角色、CDP node ID，以及所有 `familyName`、`isCustomFont`、`glyphCount`。卡名和稀有度都驗 |
| 80 筆上限與錯誤吞掉 | 取消上限，逐正式 `.hcard` 的實際文字節點取樣。缺節點、CDP 錯誤、可見文字 fonts 為空均 FAIL，不能算 fallback 0 |
| 同 ID 合併 | 使用複合鍵或陣列；`rocketdog` 總覽／詳情、十連同 ID 不同槽位全部分開。比對前先驗完整清單，不能僅取交集 |
| refit 與隱藏詳情 | 遞迴走訪 open shadow roots，字型／圖片就緒後逐卡 `HoloCardFace.refit(card)`，再等雙 rAF。手機詳情實際開啟後必驗；隱藏狀態可標不適用，但不能永久免驗。寬度 0 不得換成 1 |
| 隨機抽樣 | 測試端固定抽卡結果序列，以指定 ID 經原有揭卡流程顯示。可在測試環境替換 draw 結果，不改正式機率；保存序列並核對實際結果。共同卡 0、未揭卡、ID 不符均 FAIL |
| 個人路徑 | 以腳本位置推導 repo root，或接受 `--root`、`--output`。不依賴個人 Temp 或硬編碼磁碟位置 |

本次 `parity_probe.py` 並沒有 CDP 字型取樣，因此不是單純刪除 80 上限就足夠；另外它已將編隊同 ID 存成陣列，但卡池仍以 ID 覆寫，且有 `common[:6]` 截斷，兩者都須修。

覆蓋要求：

- 九份主線 HTML，至少三個 viewport：1440×900、1024×900、390×844。
- 預期清單從資料與操作狀態建立，涵蓋五階、三卡型、長名及九個缺字卡名。
- 編隊涵蓋兩頁總覽與逐卡詳情。原型未提供的階級／ID明列不適用；例如不能為了 common 覆蓋而擅改編隊資料。
- 抽卡與卡池全量對照；編隊對照其可提供的卡片全集，不只目前十張初始成員。
- demo 歷史樣本、`baseline-css` 與純 UI proxy 分開列示，不混入正式卡通過率。
- 正式／test／standalone 均須驗可載入、素材、字型、卡面及必要揭卡操作。

固定動畫採 WAAPI 暫停與 `currentTime`；動畫圖片另固定解碼影格，不能靠 timeout 當定位。保留正常視圖及同尺寸卡面裁圖。

同一套正式驗收器必須通過以下控制：

- 合格抽卡樣本：PASS。
- 注入 monospace、還原 epic 飽和紫、缺一張預期卡、製造裁切／換行：各自非零退出。
- 移除注入：恢復 PASS。

交付到新的 `shots/parity/` 目錄，保留既有證據；包含原始 JSON、完整差異、校準表、截圖、固定樣本清單、環境版本、命令／退出碼、來源與產物雜湊。摘要不得截掉未通過項目。

### 5. 禮物卡進抽卡系統：另案規格，本輪不施工

**整合抽卡與維持特殊外觀沒有必然衝突；直接重建及修復空字型則可能改變目前外觀。**

本輪直接解析確認：

| 頁面 | Sans／Serif bytes | cmap |
|---|---:|---:|
| demo | 233,748／317,200 | 726／726 |
| 禮物卡、mtk 單卡 | 996／984 | 0／0 |

因此不能將「換成有效字型」描述為純同步且保證外觀不變；目前實際 fallback 使用與修復後差異仍需瀏覽器量測。

另案規格須寫明：

- 目標為 `mohuashaonv`／`special`，保留其特殊卡框、文字效果、動態素材與互動；mtk 是另一份樣品，不自動加入。
- 先保存目前合格外觀、實際字型、動畫與材質證據，再決定如何提供可攜的字型資產。
- 不能只把資料塞進 pool：現有共用五階 LABEL、抽樣 RATE，以及禮物頁獨有的 special 設定／渲染，都須有整合方案。
- 抽取資格、機率、重複取得處理及是否可編隊列為待定產品規格；不自行把 special 映射成 mythic。
- 保留 METHOD 的角色換格、傾斜、文字／銘牌與效果驗收。整合須走真實揭卡流程，證明特殊渲染仍成立。

**本輪只交另案規格，不重建禮物卡，不清理舊命名產物。**

### 6. 完成定義與 commit 條件

本輪完成須同時成立：

- 選 A 完成：九份主線字型 payload 同步，實際卡名與稀有度缺字 0，逐可見節點非預期 fallback 0。
- epic 作用域修正生效，其他卡面 parity 差異已消除或有符合既有尺寸規則的證據。
- 樣本缺漏 0，手機詳情及重複 ID 均未漏驗；校準、尺寸契約與正負控制全部符合。
- 三尺寸受控圖與原生入口圖完成實際複驗，不能只憑 computed style 宣稱完整卡面一致。
- 上輪揭露的 mask、assetMap、卡背、depth 底板與抽卡 test 互動同步差異完整列出，相關既有回歸有真實結果；舊守衛失敗逐项說明，不能隱藏或改門檻湊綠。
- 回報清楚區分手改來源、既有資料同步、生成產物及副產物；禮物另案規格已交付。

**現在仍為 EXIT 1。執行方完成以上證據並送回驗收，確認 EXIT 0 後才可 commit；本指令不代表已通過驗收。**