# 執行回報：卡面一致性 ＋ 選 A 補字型（2026-09-11 第二輪）

照 `ORDER-2026-09-11-parity.md` 做的。上一輪你判 **EXIT 1**，我沒有 commit。
證據全部在 `docs/clicker/shots/parity/`。**請驗收，並裁決第六節那兩件我刻意留白的事。**

---

## 一、手改的來源（只有兩個檔，13 行）

```diff
# _art/holo-test/demo.html:816
-.hcard .face-rarity{font-size:var(--rarity-fs,9px) !important}
+.hcard .face-rarity{font-family:"Holo Noto Sans",sans-serif;font-size:var(--rarity-fs,9px) !important}
```

```diff
# _art/holo-test/team20.js（+9 行註解與換算，2 處使用點改吃 SHADOW_CSS）
+// 抽卡與卡池在 body 掛 ink-chroma，卡名／稀有度才會用階級墨色（--name-ink）。
+// 卡面搬進 shadow root 之後 body 選擇器跨不過邊界，文字會落回 --accent-card，
+// 所以在這裡換成同特異性（2 class + 1 type）的等價選擇器，規則先後順序不變。
+const SHADOW_CSS=TEAM_DATA.css
+  .replace(/body\.ink-chroma \.face-name/g,'.hcard b.face-name')
+  .replace(/body\.ink-chroma \.face-rarity/g,'.hcard span.face-rarity');
```

特異性核對：`body.ink-chroma .face-name` ＝ 2 class ＋ 1 type ＝ (0,2,1)；
`.hcard b.face-name` ＝ `.hcard`＋`.face-name` 兩個 class ＋ `b` 一個 type ＝ **(0,2,1)**，
就地替換所以在樣式表裡的先後位置也不變。
`.face-name` 是 `<b>`、`.face-rarity` 是 `<span>`（`card_face.js:96-97`）。
**沒有動全域 `--accent-card`**，寶石／卡框／光暈不受影響。

沒有動 `card_face.js`、舊 RWD、`baseline-css`、字型建置器邏輯、hover、1.04 放大、
黑角、動畫、Z 軸、抽卡機率、編隊規則、共用縮放常數。沒有退役任何回歸守衛。**沒有 commit。**

## 二、建置（你給的十條，逐條非零即停，全部 exit 0）

`build-merged.log` 有完整輸出與逐條退出碼。順序照你給的：
`update_demo_data.py` → `build_round4_fonts.py` → `build_round5_standalone.py` →
`build_cards_remade.py` → `build_cards_remade_standalone.py` → `build_deluxe_b.py` →
`build_deluxe_b_standalone.py` → `build_deluxe_b.py --test` →
`build_deluxe_b_standalone.py --test` → `build_map20.py`。

字型來源（`font-sources.json`）：

| 檔 | bytes | sha256(前 16) | version |
|---|---:|---|---|
| `C:\Windows\Fonts\NotoSansTC-VF.ttf` | 11,942,912 | `c6481c5d93420aea` | Version 2.04;241114210131 |
| `C:\Windows\Fonts\NotoSerifTC-VF.ttf` | 16,855,236 | `c8b7df78de02c2c3` | Version 2.02;241114204559 |

## 三、選 A：字型覆蓋（靜態解碼，九份主線 HTML 逐份）

我把每一份 HTML 內嵌的 WOFF2 解出來，比對該頁**實際會顯示的字串**（所有 `"name"` ＋五階中英標籤 ＋ 分隔符）：

| 產物 | Sans bytes | Serif bytes | cmap | 缺字 |
|---|---:|---:|---:|---:|
| demo、demo-standalone、cards-remade(±standalone)、deluxe-gacha-b(±standalone、±test) 、map20 —— **九份全部** | **240,448** | **325,236** | **739** | **0** |

修改前是 233,748／317,200、cmap **726**，9 個卡名共缺 13 字
（`丑菌熊流浪今日送鴿沙堡領扁`）。**九份的字型 payload 現在完全同步。**

⚠ 禮物卡與 mtk 單卡**仍是 996／984 bytes、cmap 0** —— 本輪照你的裁決沒有重建，
另案規格寫在 `SPEC-gift-card-into-gacha.md`。

## 四、量測器重寫（你點名的六個缺口）

新檔三支，全部在 `_art/holo-test/`，路徑從腳本位置推導，接受 `--root`／`--out`：

| 檔 | 用途 |
|---|---|
| `check_card_parity.py` | 收原始資料（九入口 × 三尺寸），也提供負控制注入 |
| `check_card_parity_report.py` | 判 PASS/FAIL，硬契約與需校準的幾何分開 |
| `write_card_parity_calibration.py` | 從重複量測算幾何門檻，輸出樣本／波動／餘裕理由 |

| 你點名的缺口 | 怎麼補的 |
|---|---|
| 字型證據沒有節點對應、80 筆上限、錯誤被吞 | 改走 `Runtime.evaluate` → `DOM.requestNode` → `CSS.getPlatformFontsForNode`，**逐元素精準對應、沒有上限**；保留 `familyName`／`isCustomFont`／`glyphCount`；CDP 出錯、可見文字沒有字型證據都算 **FAIL** |
| 同 ID 合併 | 複合鍵 `(entry, viewport, id, role, shadowPath, instance)`；`rocketdog` 在編隊出現兩次，兩筆都在 |
| refit 與隱藏詳情 | 遞迴走 open shadow root 做 refit，等 `fonts.ready` ＋ 圖片 decode ＋ 雙 rAF；編隊**逐卡打開詳情**量 |
| 隨機抽樣 | 走既有的 `?ceremony-test` ＋ `__ceremonyFixture` 鉤子（其他 check_* 也是這樣），**固定抽到指定的卡**；`--fixture auto` ＝ 整個正式卡池 59 張，分批 10 張跑完；報告會核對「揭到的 ID＝指定的 ID」，不符就 FAIL |
| 個人路徑 | 沒有任何 Temp 或硬編碼磁碟位置 |
| 覆蓋率造成的假通過 | 新增覆蓋率檢查：**這個入口顯示的每一張正式卡都必須有參考對象**，否則 FAIL。舊做法「共同卡 2 張、差異 0、PASS」現在會被擋下來 |

編隊覆蓋：初始隊伍只有 10 位，其餘 14 張用**產品本來就有的「同階級替換」**
（`team20.add(id, sameRarityMember)`）換進來，沒有改編隊資料。
結果 **24 張全部量到，總覽 25 筆（含 rocketdog 兩個實例）＋ 詳情 24 筆**。

## 五、驗收結果

環境：Chromium 140.0.7339.16、DPR=1、1440×900／1024×900／390×844。
動畫用 WAAPI `pause()` ＋ `currentTime=0` 凍結（逐 shadow root）。

### 5.1 修改前（`parity-pre.json` / `report-pre.log`，同一套量測器）

**EXIT 1、23 項 FAIL**：

- **編隊：與參考共同卡 122 張，卡面設計差異 140 項，全部是 epic 稀有度顏色**
  `rgb(240,214,255)`（抽卡）vs `rgb(184,117,255)`（編隊），`color` 與 `webkitTextFillColor` 各一筆。
- 字型 fallback：demo/pool 各 9 筆、編隊 4 筆、抽卡 1～2 筆，全是 `微軟正黑體`（那 13 個缺字）。
- 覆蓋率全部 PASS（59 張卡池全量對照建立起來了）。

### 5.2 修改後（`parity-post.json` / `report-post.log`）

**EXIT 0、全綠。** 主要幾條：

| 檢查 | 結果 |
|---|---|
| 入口載入與取樣 | 九入口 × 三尺寸全部取到卡 |
| 抽卡固定序列 | `gacha-test`／`gacha-test-standalone` 揭到的 ID **完全等於**指定的 59 張 |
| 字型：取樣錯誤／可見文字無證據 | **0** |
| 字型：非預期 fallback | **0**（修改前 demo 9、pool 9、team 4、gacha 1～2） |
| 字型：非內嵌字型（`isCustomFont=false`） | **0** |
| `abs(fontSize − --rarity-fs)` | 全部 **0.0000px**（門檻 0.011） |
| `abs(rarityFS − nameFS×0.5625)` | 最大 **0.0056px**（門檻 0.011） |
| **卡面設計一致性（參考＝抽卡揭卡）** | pool 189、pool-standalone 189、gacha 30、gacha-standalone 30、gacha-test-standalone 189、**team 122**、demo 12、demo-standalone 12 —— **差異全部 0 項** |
| 覆蓋率 | 每個入口顯示的正式卡 **100% 都有參考對象**，未覆蓋 0 |
| 稀有度單行 | 全部 1 行 |
| 稀有度與寶石交疊 | **0** |
| 投影倍率 | 只有 1.0 或編隊指名要的 **1.04 選取放大**，例外 0 |
| 幾何（校準帶） | `rarityRange.w`／`rarityRange.h`／`rarityClear.left`／`rarityClear.right` 全入口 0 筆超出 |

比對的屬性：`fontFamily`／`fontStyle`／`fontWeight`／`color`／`webkitTextFillColor`／
`backgroundImage`／`backgroundClip`／`opacity`／`textTransform`／`whiteSpace`／`textAlign`／
`mixBlendMode`（要求完全相同）＋ `fontSize`／`letterSpacing`（正規化後比）
＋ 銘牌的 `gap`／`borderTopColor`（實測是固定值，要求完全相同）。

### 5.3 幾何校準（`calibration.json`）

參考入口 `gacha-test` 同環境跑 **3 次**（`parity-cal1/2/3.json`），共同樣本 **189** 個
(viewport, 卡, 角色)。**重複量測波動全部是 0.000000**（渲染是決定性的）。
門檻＝觀測範圍 ± 餘裕，餘裕取「重複波動」「觀測範圍 ×20%」「版面量化 0.5px÷1440」三者最大：

| 指標 | 樣本 | 觀測最小 | 觀測最大 | 重複波動 | 下限 | 上限 |
|---|---:|---:|---:|---:|---:|---:|
| `rarityRange.w` | 189 | 0.303240 | 0.503460 | 0.000000 | 0.263196 | 0.543504 |
| `rarityRange.h` | 189 | 0.065933 | 0.073662 | 0.000000 | 0.064387 | 0.075207 |
| `rarityClear.left` | 189 | 0.248270 | 0.348378 | 0.000000 | 0.228248 | 0.368400 |
| `rarityClear.right` | 189 | 0.248270 | 0.348378 | 0.000000 | 0.228248 | 0.368400 |

⚠ **分母我改成「投影後的卡寬」，這一條跟你的指令不一樣，請裁決**：
你說分母要用未變形 content-box。Range 的矩形是**投影後**的座標，而編隊被選取的那張卡
是 1.04 倍，用未變形寬當分母會把那 4% 算進指標，讓「剛好被選取的那張」假性超標
（我第一版就是這樣，`rarityRange.h` 冒出 30 筆假紅）。
所以幾何改成「投影量 ÷ 投影寬」，並把 `renderScale = 投影寬 ÷ 未變形寬` 單獨列成一條檢查
（只允許 1.0 或 1.04，例外 0）。**縮放規則本身仍然用未變形寬驗**，那是第 5.2 節的字級契約。

### 5.4 負控制（同一套正式驗收器，四種都要變紅）

| 注入（注進卡片所在的每個 root，含 11 個 shadow root） | 驗收器退出碼 | 抓到什麼 |
|---|---:|---|
| `mono`：稀有度改回 monospace | **1**（5 項 FAIL） | 抽卡 63 筆／編隊 35 筆 `MingLiU` fallback ＋ 14 項字族差異 |
| `epic-accent`：把階級墨色打回 `--accent-card` | **1**（1 項 FAIL） | 編隊 28 項 `color`／`webkitTextFillColor` 差異 |
| `wrap`：強迫換行 | **1**（13 項 FAIL） | 稀有度變 2 行、與寶石交疊 26 張、字距差異 |
| `drop-card`：抽掉一張預期的卡 | **1**（2 項 FAIL） | 固定序列不符 ＋ 編隊 2 張未覆蓋 |
| **移除注入** | **0** | 全綠 |

## 六、⚠ 兩件我刻意沒有讓它變綠的事，請裁決

### 1. `lineGap`（兩行間距）：量到了，但我不判定

它是「銘牌固定 6px `gap` ＋ 隨字級變的行距」的合成量，**除以卡寬不是尺寸不變量**。
照你第 2 節「固定 px、最小描邊、斷點規則按來源公式驗」，我試著拆：

| 入口 | n | 版面 px 範圍 | 殘差 `(gap_px − plateGap)/(nameFS+rarityFS)` |
|---|---:|---|---|
| gacha / gacha-test（參考）| 30／189 | [2.197, 4.118] | **[−0.10211, −0.08377]** |
| pool | 189 | [1.837, 2.653] | [−0.09895, −0.08539] |
| demo | 12 | [2.410, 2.947] | [−0.09574, −0.08283] |
| **team** | 122 | [1.302, 4.118] | **[−0.13220, −0.09759]** |

編隊的殘差帶比參考低約 3%（−0.132 vs −0.102），**落在參考範圍外**。
我**沒有**編一條公式讓它變綠，也**沒有**把它塞進校準帶。
可能是編隊的斷點讓銘牌 `gap` 或 `padding` 走到不同分支，但我還沒查出來——
照「查不出來就說查不出來」，我在這裡停手等你裁決：這算不算卡面設計差異？

### 2. 銘牌 `padding` 與 `borderTopWidth`：實測是比例值，不是固定 px

我原本照你的「固定 px 要完全相同」把 `padding` 一起比，結果全紅。實測：

| 入口／卡寬 | 銘牌 padding（水平）| ÷ 卡寬 |
|---|---:|---:|
| gacha-test 320 | 37.400px | 0.1169 |
| gacha 198 | 25.534px | 0.1290 |
| pool 261.6 | 33.745px | 0.1290 |
| team 180 | 23.222px | 0.1290 |

**它是比例值（≈12.9% 卡寬），但參考自己在 320 寬時是 11.69%，比其他入口低約 10%。**
我把 `padding`／`borderTopWidth` 從「必須完全相同」的清單裡拿掉了（那個假設本來就錯），
但**沒有**改成正規化門檻——因為參考自己就有兩個值，我不知道哪個才是對的。
請裁決：320 寬那個 11.69% 是斷點規則還是走鐘。

## 七、重建副作用：完整揭露（你上一輪點名的）

`git diff --stat` 九份產物：demo 8 行、demo-standalone 24 行、pool(±standalone) 各 6 行、
gacha(±standalone) 各 6 行、**gacha-test 92 行、gacha-test-standalone 96 行**、map20 15 行。
（`product-hashes.json` 有九份的 sha256。）

逐項是什麼：

| 產物 | 除了字型 base64 與我的一行 CSS 之外，還有什麼 |
|---|---|
| `demo.html` | `poolData` 被 `update_demo_data.update()` 重生（43 → 59 筆，你上一輪已核對：刪 0、改 0、新增 16 筆全來自既有 `EXTRA_CARDS`） |
| `demo-standalone.html` | 同上的 `poolData`，**外加** `mask-data`、`assetMap`、卡背 webp 重新編碼（舊產物追上既有來源） |
| `deluxe-gacha-b-test(-standalone).html` | **舊產物落後很多**：追上了 2026-09-10 已在來源裡的「depth 也吃銘牌黑棒」那條規則（帶原本的中文註解與裁決理由），以及卡包 hover／浮動／呼吸動畫、拖曳與點擊抑制、遮罩與資料更新 |
| `map20.html` | 字型、`TEAM_DATA`、以及我改的 `SHADOW_CSS` |
| `docs/clicker/shots/team-round3/build.json` | `build_map20.py` 的副產物（你有預告） |

**這些行為／素材變更不是我這一輪決定的**，是**已 commit 的來源**終於進到落後的產物裡。
但它們確實是本次交付的一部分，所以列在這裡，不用「沒有手改來源」帶過。

⚠ **我沒有跑舊的回歸腳本。** 上一輪 `run_card_feel_regression.py` 是 1098 PASS / 6 FAIL，
六個過期守衛你交代不准這輪退役；我也不想在沒有你裁決的情況下跑完就宣稱通過。
要不要跑、跑哪些、失敗怎麼分類，請一起裁決。

## 八、沒做的

- 禮物卡／mtk：只交規格 `SPEC-gift-card-into-gacha.md`，沒有重建、沒有清理舊命名產物。
  規格裡有一題**要問使用者**：修字型會改變禮物卡現在的樣子，跟「維持」衝不衝突。
- hover 門檻重訂、1.04 放大裁切、六個過期守衛退役、黑角演出途中掃描、5.0 新卡、變種卡：全部沒碰。
- 沒有 commit。
