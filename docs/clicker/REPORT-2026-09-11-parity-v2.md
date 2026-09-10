# 執行回報 v2：補件（2026-09-11 第三輪）

`VERDICT-2026-09-11-parity.md` 判 **EXIT 1**。**你抓到的每一條我都認，而且都是真的 bug，不是判準之爭。**
這份是補件回報，取代 `REPORT-2026-09-11-parity.md` 第五節之後的內容（第一～四節的手改來源與建置順序不變）。

---

## 一、先更正我回報錯的數字

| 我寫的 | 正確的 |
|---|---|
| Chromium **140**.0.7339.16 | **149.0.7827.55**（pre／post／cal1～3 的 JSON 都是這個） |
| 固定序列 **59** 張 | **63** 張（`fixtureIds` 與 `expectedPoolIds` 都是 63；189 ＝ 63×3） |
| `product-hashes.json` 九份完整 SHA-256 | 原本寫的是 14 份 HTML 的前 16 碼。**已改成九份主線的完整 SHA-256。** |

## 二、你抓到的量測器 bug，逐條修好了

| 你指出的 | 根因 | 修法 |
|---|---|---|
| **抽卡根本沒揭開**（截圖停在卡包與「準備卡片…」） | 我只呼叫 `pull()`，卡片進了 DOM 但儀式沒跑完 | 改走 `pull → openPack → skipAll → await ready()`，並**斷言** `state().screen === 'results'`、`complete` 等於張數、**揭卡 ID 順序逐位相符**；任一條不符就回傳 error 讓該入口 FAIL |
| **手機詳情沒開啟** | 產品要 `select(id, true)` 才開浮層，我寫成 `select(id)` | 改成 `select(id, true)`，並**輪詢等到那張卡真的排版出來**（最多 3 秒）才量；等不到就寫成 `detail overlay never laid out` 的錯誤紀錄，不會靜靜收到空值 |
| **「總覽 25 筆」含誤標** | 初次收集把所有卡標成 overview，`card-host` 裡的詳情卡也算進去 | 角色改由 shadow host 判定（`overview-face`→總覽、`card-host`→詳情）；去重鍵改成 `(id, role, shadowPath, instance)`；**編隊的第一次收集直接剔除 `card-host`**（那時浮層還沒開，不是有效樣本） |
| **demo 的正式卡被當歷史樣本排除** | `demo.html:669` 把正式卡設成 `pool-<id>`，我拿它去比卡池 ID | 收集端多存 `canonicalId`（去掉 `pool-` 前綴），判定端一律用它 |
| **有矩形不等於看得見** | `visible` 只看寬高 | 改用 `checkVisibility({opacityProperty, visibilityProperty, contentVisibilityAuto})`，另存 `hasRect`／`inViewport` |
| **字型證據缺 CDP node ID** | `platform_fonts()` 拿到 `nid` 沒回傳 | 存進結果；判定端**缺 node ID 就 FAIL** |
| **必填項未驗不影響退出碼** | 判定器只看有沒有 FAIL | 新增第 0 節完整性檢查：入口缺漏、尺寸缺漏、啟動失敗、逐卡取樣錯誤，**每一項都是 FAIL** |
| **1.04 沒綁狀態** | 我寫成「只有編隊可以」 | 你說得對，而且我原本的理解也錯：`ceremony.css` 的 `.slot.done.selected` 與 `team20.css` 的 `[aria-selected=true]` **共用同一條 `scale:1.04`**。改成收集端記 `selectedState`，**放大只允許出現在真的被選取／hover 的那張卡**，跟哪個畫面無關 |

⚠ 正式版抽卡（`gacha`／`gacha-standalone`）我原本用點 `#p10 → #entry-pack → #next`，同樣停在卡包。
現在也走完儀式：**用真實 UI 的 `#p10` 抽（機率沒有被動過）**，再 `openPack → skipAll → ready`，
一樣斷言 `screen=results`。這兩個入口沒有固定序列，判定器改成列出實際抽到的 ID 而不是假裝比對。

## 三、幾何分母：照你的裁決改回未變形 content-box

你否決「只改分母」是對的。現在的做法是你要求的**同尺寸固定中性姿態**：

`SAMESIZE_JS` 把**每一張卡就地**（留在原本的容器與 shadow root 裡）設成同一個
**未變形 content-box 寬度 260px**，並在每個 root 注入
`*{transform:none;scale:none;rotate:none;translate:none;transition:none;animation:none;perspective:none}`，
再 `HoloCardFace.refit()` 一次、等雙 rAF，然後收第二份資料（`pose:'neutral'`）。量完立刻還原。

⚠ 過程中發現：**選取放大是 CSS 的 `scale` 屬性（`team20.css:142`）不是 `transform`**，
只關 `transform` 關不掉，量到的 Range 還是差 4%。要連 `scale`／`rotate`／`translate`
這組獨立屬性一起關才乾淨。

結果：**同尺寸中性姿態下可以直接比原始 px，門檻 0.011px，不需要任何視覺容差。**
所以我把上一輪那套「校準帶 ＋ 20% 餘裕」整個拿掉了——它本來就是為了繞開投影問題才存在的。
`calibration.json` 與 `write_card_parity_calibration.py` 保留在證據裡當歷史紀錄，**不再參與判定**。

`lineGap` 與銘牌 `padding` 也因此有答案了：在同尺寸中性姿態下，
它們對參考的差異是 **0 項**（門檻 0.011px）。上一輪看到的差異全部來自
「不同卡寬 ＋ 固定 px ＋ 投影」的混合，不是卡面設計差異。
**所以第六節那兩題不需要你裁決了，也不需要改 padding。**

## 四、驗收結果（`parity-post5.json` / `report-post5.log`）

Chromium **149.0.7827.55**、DPR=1、九入口 × 三尺寸（1440×900／1024×900／390×844）、
固定序列＝整個正式卡池 **63 張**。

**EXIT 0，319 項 PASS、0 項 FAIL。** 主要幾條：

| 檢查 | 結果 |
|---|---|
| 入口／尺寸／取樣完整性 | 九入口 × 三尺寸全到齊，逐卡取樣錯誤 **0** |
| 揭卡儀式 | 每一批 `screen=results`、`complete` 相符；`gacha-test`／`gacha-test-standalone` 的**揭卡順序與指定序列逐位相同（63/63）** |
| 字型：取樣錯誤／可見文字無證據／非預期 fallback／非內嵌／缺 node ID | 全部 **0** |
| `abs(fontSize − --rarity-fs)` | **0.0000px** |
| `abs(rarityFS − nameFS×0.5625)` | 最大 **0.0056px**（門檻 0.011） |
| **同尺寸中性姿態的卡面一致性** | demo 189、demo-standalone 189、pool 189、pool-standalone 189、gacha 30、gacha-standalone 30、gacha-test-standalone 189、**team 177** —— **列入比較的屬性差異全部 0 項**，未覆蓋 0 |
| **同尺寸中性姿態的幾何** | 全入口 **0 項**超過 0.011px |
| 原生姿態：稀有度單行／寶石零交疊 | 全部通過 |
| 原生姿態：投影倍率 | 只有 1.0，或**真的處於選取／hover 狀態**的 1.04；例外 **0** |

比對的屬性（比上一輪多了 `lineHeight`、`textShadow`、`filter`、卡片身分、以及銘牌／寶石／卡框的整組幾何與樣式）：

- 卡片身分：`rarity`、`kind`、`nameText`、`rarityText`
- 文字：`fontFamily`／`fontStyle`／`fontWeight`／`color`／`webkitTextFillColor`／`backgroundImage`／
  `backgroundClip`／`opacity`／`textTransform`／`whiteSpace`／`textAlign`／`mixBlendMode`／`lineHeight`／
  `fontSize`／`letterSpacing`／`textShadow`／`filter`
- `.face-plate`／`.face-gem`／`.face-frame`：`width`／`height`／`padding`／`margin`／`gap`／
  `borderTopWidth`／`borderTopColor`／`borderRadius`／`backgroundImage`／`backgroundColor`／
  `boxShadow`／`opacity`／`filter`／`mixBlendMode`／`left`／`right`／`top`／`bottom`／`position`
- 幾何：稀有度與卡名的 Range 寬高與行數、左右淨空、兩行間距、與寶石的交疊面積

**⚠ 這仍然是「列入比較的屬性差異 0」，不是「整張卡面像素相同」。**
沒有比到的：角色／背景圖層、遮罩、箔面各層、偽元素、卡背實際渲染。我沒有宣稱那些通過。

## 五、負控制（同一套正式驗收器，乾淨參考）

`report-neg2-*.log`。注入注進**卡片實際所在的每一個 root**（編隊是 11 個 shadow root）：

| 注入 | 驗收器退出碼 | 抓到 |
|---|---:|---|
| `mono` 稀有度改回 monospace | **1**（4 項 FAIL） | 大量 `MingLiU` fallback ＋ 字族差異 |
| `epic-accent` 階級墨色打回 `--accent-card` | **1**（1 項 FAIL） | 編隊 `color`／`webkitTextFillColor` 差異 |
| `wrap` 強迫換行 | **1**（6 項 FAIL） | 稀有度變兩行、與寶石交疊、字距差異 |
| `drop-card` 抽掉一張預期的卡 | **1**（1 項 FAIL） | 揭卡序列不符 |
| **不注入（post5）** | **0** | 全綠 |

## 六、舊回歸：跑了，而且做了 HEAD 的單變因 A/B

你點名的七支全部跑過（`shots/parity/regression/`）。
**為了分辨「既有失敗」與「我弄壞的」，我另外開了一個 `HEAD`（770af87）的乾淨 worktree
跑同樣七支**（`shots/parity/regression-head/`），逐項比對寫在 `regression-ab.json`。

| 腳本 | 修改後 | HEAD | 新增 FAIL |
|---|---|---|---:|
| `check_card_feel.py` | exit 1，**14 項 FAIL** | exit 1，**14 項 FAIL** | **0** |
| `check_card_feel_clearance.py` | exit 1 | exit 1 | **0**（遮掉數值後 log 完全相同） |
| `check_gacha_followup.py --sizing-only` | **exit 0** | exit 0 | 0 |
| `check_gacha_card_regression.py` | **exit 0** | exit 0 | 0 |
| `check_round43_idle.py` | exit 1 | exit 1 | **0** |
| `check_round42_contracts.py` | exit 1 | exit 1 | **0** |
| `run_card_feel_regression.py` | exit 1，**1098 PASS / 6 FAIL** | exit 1，**1098 PASS / 6 FAIL** | **0**（遮掉數值後 log 完全相同） |

**七支的退出碼與失敗集合在 HEAD 與修改後完全一致，新增失敗 0 項。**

既有失敗的分類（**沒有改門檻、沒有標成過期、原始退出碼與失敗都留著**）：

1. `check_card_feel.py` 的 `hover_travel_percent` 6.29%（門檻 [12,45]）與三條
   `hover_changed_*` —— 就是 `HANDOFF-2026-09-10-night` 第三節第 1 點已經記載的**無效門檻**
   （連參考實作都只有 3.754%）。
2. `demo_nonfont_diff = 1` —— 這是**本輪授權的改動**（`.face-rarity` 那行 CSS ＋ `poolData` 重生）
   被舊的「demo.html 整檔凍結」守衛擋下。
3. `team_negative_bad_corners = 0`（門檻 [1,10000]）—— 黑角的**負控制注不出紅燈**。
   ⚠ 我看了 `check_card_feel.py:48`，它的注入只走 `document.querySelectorAll('*')` 一層 shadow root，
   而且要求 `root.querySelector('.card-face')` 才注。**這是那支腳本自己的注入位置問題**
   （正是交接文件記的第三個坑），HEAD 也一樣是 0。**我沒有修它，也沒有宣稱它通過。**
4. `check_round43_idle.py` / `check_round42_contracts.py` 兩支都是
   `net::ERR_FILE_NOT_FOUND`：缺 `docs/clicker/shots/round43/portable/before-cards.html`
   這份證據檔（repo 裡沒有）。HEAD 也一樣。**是缺素材，不是回歸。**
5. `run_card_feel_regression.py` 的 6 項就是交接文件列的那六個過期守衛
   （`protected_files_changed`、`overview_pointer_unchanged`、`proxy_animations`／`automatic_animations`×4）。
   **本輪沒有退役任何一個。**

## 七、重建副作用：逐項證據（`rebuild-diff.json`）

我把 HEAD 與工作目錄的九份產物逐份解出 `mask-data`、卡片資料、完整 SHA-256 做比對：

| 產物 | mask 項數 | 卡片新增 | 內容變更 |
|---|---|---:|---:|
| `demo.html` | 65 → 65 | **16** | 0 |
| `demo-standalone.html` | **49 → 65** | **16** | 0 |
| `cards-remade(.-standalone).html` | 65 → 65 | 0 | 0 |
| `deluxe-gacha-b(-standalone).html` | 65 → 65 | 0 | 0 |
| **`deluxe-gacha-b-test(-standalone).html`** | **60 → 65** | 0 | **5** |

test 產物那 5 個內容變更的 ID（你要求不能只寫「資料更新」）：

| ID | HEAD | 現在 |
|---|---|---|
| `zhenzhen` | 珍珍 / flat | **本草珍目** / **depth** |
| `zhenqiqiu` | 珍氣球 / flat | 珍氣球 / **depth** |
| `shabaolingzhu` | 沙堡領主 / flat | 沙堡領主 / **depth** |
| `zhenjunyue` | 真菌玥 / flat | 真菌玥 / **depth** |
| `liulangyueshou` | 流浪玥手 / flat | 流浪玥手 / **framed** |

`demo-standalone` 也一起吃到 depth 銘牌那條規則（你說得對，不只 test 產物）。
這些都是**已 commit 的來源終於進到落後好幾輪的產物**，不是我這輪的設計決定。

⚠ **另外兩件我要主動揭露**：

1. 工作樹還有 `round4-font-chars.txt` 與兩份 WOFF2 中間產物被改動——
   那是 `build_round4_fonts.py` 的正常輸出（字元集 726→739）。
2. **跑舊回歸會覆寫它們自己的證據檔**：`docs/clicker/shots/card-feel/` 下的
   `after.json`、`clearance.json` 與多張 PNG 都被重寫了。這是那些腳本的設計行為，
   但確實動到了已 commit 的證據，所以列在這裡。

## 八、還沒做的

- 禮物卡／mtk：只交規格 `SPEC-gift-card-into-gacha.md`，沒有重建。
  規格裡有一題**要問使用者**：修字型會改變禮物卡現在的樣子，跟「維持」衝不衝突。
- 沒有比到角色／背景圖層、遮罩、箔面各層、偽元素、卡背實際渲染。
- hover 門檻重訂、1.04 放大裁切、六個過期守衛退役、黑角演出途中掃描、5.0 新卡、變種卡：沒碰。
- **沒有 commit。**
