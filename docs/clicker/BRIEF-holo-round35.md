# 派工簡報（第三十五輪）：把「魔花少女」這張禮物卡收尾

日期：2026-09-09 深夜。分支 `holo-cards`，工作區 **`D:\claude研究\clawd-pet-holo`**
（git worktree；不要碰 `D:\claude研究\clawd-pet`，**不要修改 `src/`**）。

⚠ 這台機器的路徑含中文。指令一律用相對路徑或先 `cd` 進工作區，不要把中文路徑寫進參數。

**本輪只做這一張卡。** 第三十四輪的 A／B／C 已經落地並驗過，`ISSUES-2026-09-09-night.md`
其餘各項這輪都不碰（使用者：「先完成滿花的卡，其他等等說」）。

## 〇、必讀（動手前）

1. `docs/clicker/HANDOFF-holo-cards.md` 六之四／六之五 — **卡面凍結**。`card_face.js` 不准改。
2. `docs/clicker/LESSONS-2026-09-09.md` 第一節（`preserve-3d` 與 `translateZ`）、
   第三節第 4 條（**驗收要驗像素**）、第六節第 2 條（**沒跑過的結論不准寫**）。
3. `_art/holo-test/build_gift_card.py` 檔頭 — 這張卡的來源、卡型、為什麼這樣做，都寫在裡面。
4. **看實際的卡長什麼樣**：`C:\Users\spesh\OneDrive\Desktop\抽卡round33測試版.html`
   （使用者指定的參考，是第三十三輪的抽卡單檔版）。用 `?ceremony-test` 開，
   `__ceremony.pull(n)` → `__ceremony.skipAll()` → 等 `state().collectable`，就能看到揭曉後的卡。
   **宇宙冒險羊（`rocketdog`，神話、depth 場景卡）是本輪的對照基準。**

建置：`python build_gift_card.py`（會重跑素材與頁面）
驗收：`PYTHONIOENCODING=utf-8 python check_gift_card.py`
產物：`_art/holo-test/gift-manhuahua.html`（自包含單檔，複製到別的資料夾也要能開）

## 〇之二、這張卡現在的狀態（實測值，不用重推）

| 項目 | 現值 | 來源 |
|---|---|---|
| 卡型 | `depth` + `scene`（主體／背景兩層，都是 600×840） | `verification-gift.json` |
| 文字框 | left 4.3997%／right 4.3998%／bottom 3.3981%／height 16.1977% | 同上 |
| 卡名置中偏差 | **0.0081px** | 同上 |
| 稀有度置中偏差 | **0.0081px** | 同上 |
| 字級（卡寬 380px） | name 31.45／rarity 17.69／gem 28.83 | 同上 |
| 投影超出卡緣 | −7.72px（負值＝完全在卡內） | 同上 |
| 寶石對比 | 145.67（門檻 35） | 同上 |
| 卡名對比 | 6.44:1（門檻 4.5:1，WCAG AA） | 同上 |
| 角色擺放 | x6 y190 w588 h520，左右各裁 0，與文字框重疊 35px | `gift/manifest.json` |

**這些都已經通過，不要在收尾時把它們弄壞。** 改完要逐項重量並在報告列出改前／改後。

---

## A. 改名：滿花花 → **魔花少女**（使用者指定）

- `build_gift_card.py` 的 `NAME`、`id`、輸出檔名一起改：
  id `manhuahua` → `mohuashaonv`，素材檔 `gift/layer-mohuashaonv-*`，
  輸出 `gift-mohuashaonv.html`，頁面 `<title>` 與 `<h1>` 一併改。舊檔刪掉，不要留兩份。
- **四個字比三個字寬**，要確認縮字沒有被觸發到難看：報告要寫改名後的
  `--name-fs`、`dataset.nameFits`、置中偏差、以及名字與寶石的最小間距。
  若 `nameFits` 變成 false，**不准改字級基準或下限**（LESSONS 第七節），
  要用「名字放得下」的方式解（例如確認文字框安全寬度的計算對不對），並在報告說明。

## B. 動作播完要**漸變**回原本樣式（使用者回報）

**使用者原話**：「黑色是正常，但是動畫結束 也要漸變 回原本樣式」。

意思是：那塊黑色是原畫本來就有的，**不用去背也不要清掉**；但「特殊動作 → 常態」這一段
現在看起來是硬切，要跟「常態 → 特殊動作」一樣做疊化。

**現況**（`build_gift_card.py` 的頁面 JS）：`show(alt)` 對六個元素設 `opacity`
（常態圖／常態遮罩／常態反光、動作圖／動作遮罩／動作反光），CSS 給
`.r-special .art-media img,.r-special .subject-mask,.r-special .special-tint`
上了 `transition:opacity 320ms ease`。理論上進出都會淡。

**先量再改**：用 `window.giftCard.trigger()` 觸發，每 60ms 取樣一次六個元素的 computed opacity，
**進場與回程都要取**，把兩條曲線放進報告。我量過進場是
`[1,0] → [.8,.2] → [.46,.54] → [.18,.82] → [.05,.95] → [0,1]`（只取了兩張圖），
**回程沒有量過**——如果回程真的是硬切，找出原因再修；如果本來就有淡，就把量測當證據寫進報告，
不要為了「有做事」去改一個沒壞的東西。

可能的成因（**只是假設，要用量測否決或證實**）：
1. 回程時 `altImg.removeAttribute('src')` 之類的重設打斷了 transition；
2. 遮罩的 opacity 在回程被 `--subject-gain` 的 CSS 值蓋回去，變成瞬間跳值；
3. `timers` 的第二層 `setTimeout` 讓 `busy` 在 transition 還沒結束就解鎖，連點時看起來像硬切。

**驗收**：回程也要是連續變化——取樣曲線中必須有至少 3 個中間值落在 (0.05, 0.95) 之間，
且切換全程沒有任何一格「兩層都接近 0」（會閃一下空白）或「兩層都接近 1」（會疊成雙重影）。
把這條寫成 `check_gift_card.py` 的斷言。

## C. 字有沒有置中（使用者問）

已經量到 **0.0081px**（門檻 <2px），`check_gift_card.py` 裡有這條斷言。
本輪要做的是：**改名之後重量一次**，並在報告直接回答「置中偏差 X px」。
不要移除或放寬這條。

## D. 「有沒有比照火箭珍的高規格」（使用者問）—— 要逐項回答

使用者要的是一個**可核對的對照表**，不是一句「有」。請實際開對照組
（桌面那份 round33 測試版裡的 `rocketdog`，以及 `_art/holo-test/cards-remade.html`），
量下面每一項在**兩張卡上的實際值**，一項一行：

| 項目 | 怎麼量 |
|---|---|
| 圖窗 `.art-media` inset | 佔卡片比例（未變形的佈局盒，不是 rect） |
| 文字框 `.face-plate` | left／right／bottom／height 佔比 |
| 文字層 `.face-text` | 同上 |
| 寶石 `.face-gem` | 位置與大小佔比 |
| 各層 `translateZ` | 背景／圖層／卡框／文字框／文字／寶石 |
| `z-index` | 同上六層 |
| 字級換算 | `--name-fs`／`--rarity-fs`／`--gem-fs` 對卡寬的比例 |
| 箔面變數 | `--foil-gain`／`--grain-gain`／`--subject-gain`／`--palette` |
| 主體 foil mask | 有沒有掛、mask-size、剪影對不對得上 |
| 卡框 | `frame-material` 的漸層、`face-frame` 的 inset 描邊層數 |

然後把差異分成三類寫進報告：

1. **完全一致**（凍結工法的部分，這些本來就該一樣）；
2. **刻意不同**（新階級「特殊」的配色、半透明文字框、淡色畫用的反光層、
   稀有度那行的字型、動畫圖層與疊化——這些都是使用者指定或有實測理由的，
   `build_gift_card.py` 的註解寫了為什麼，**不要改掉它們**）；
3. **不該不同、但現在不同**（如果有）——這一類才是要修的，逐項修完並附改前／改後。

⚠ 特別提醒：這張卡的圖是**淡色**的，火箭珍是深色星空底。共用箔面是
`mix-blend-mode:overlay`，對接近白的底幾乎不動作（實測：平塗區只被改 6.66／底色 230 ≈ 3%）。
所以「箔面變數調成跟火箭珍一樣」**不會**讓它看起來一樣——這件事已經處理過了
（另掛一層 multiply 的反光，平塗區 6.66 → 18.34，亮度只掉 2.2%、偏藍量只動 0.8）。
**不要把那層拿掉去對齊火箭珍的參數**，那是走回頭路。

## 二、驗收與交付

1. `python build_gift_card.py` → `PYTHONIOENCODING=utf-8 python check_gift_card.py`，
   **記錄真實 exit code**，dev 與「複製到別的資料夾」兩個入口都要過。
2. 〇之二那張表的每一項都要重量，改前／改後並列。任何一項變差都要在報告寫明。
3. 新增的斷言（B 的回程疊化曲線）要真的能失敗——先確認它在修好之前是紅的。
4. 截圖放 `docs/clicker/shots/round35/`：常態、動作中、**疊化回程的中間格**、傾斜看反光。
5. 報告寫成 `docs/clicker/REPORT-holo-round35.md`，含 D 的完整對照表。
6. **不要 commit、不要 push。** 不要動 `mtk-card.html`／`build_mtk_art.py`／`check_mtk_card.py`
   （那是另一條實驗），也不要動第三十四輪的產物。

## 三、允許你否決我

B 的三個成因假設、D 的分類，只要你拿得出量測都可以否決並改走別條，
在報告寫明「我原本的建議是什麼、量到什麼、所以改成什麼」。
但**使用者指定的事項（名字、黑色保留、進出都要疊化）與既有門檻不可以自己放寬**。
