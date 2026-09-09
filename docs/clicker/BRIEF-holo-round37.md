# 派工簡報（第三十七輪）：愛心粒子、傾斜回彈、卡緣厚度

日期：2026-09-10。分支 `holo-cards`，工作區 **`D:\claude研究\clawd-pet-holo`**（git worktree）。
⚠ 路徑含中文，指令用相對路徑或先 `cd` 進工作區。

**本輪只動「魔花少女」這一張禮物卡**（`build_gift_card.py`／`check_gift_card.py`／
`gift-mohuashaonv.html`）。共用 CSS、`card_face.js`、卡池、抽卡頁一律不准動。

## 〇、必讀

1. `docs/clicker/REPORT-holo-round36.md` — 粒子、卡框提亮、字色是怎麼做的與量到多少。
2. `_art/holo-test/build_gift_card.py` 的 `.r-special` 註解 — 每個刻意不同的地方都寫了理由
   （`overlay`／`screen` 對淡色底無效、`background-clip:text` 不能用 `text-shadow`、
   文字框不能是黑條、multiply 彩虹會把角色染藍已被使用者否決）。**這些理由仍然成立。**
3. `docs/clicker/HANDOFF-holo-cards.md` 六之四 — `translateZ` ≤ 約 42px；
   「要讓 A 蓋過 B，正解是把 B 降下來」。
4. `docs/clicker/DESIGN-holo-cards.md` 第 8 節 — 授權。`pokemon-cards-css` 是 **GPL-3.0**，
   **只能學原理，不准搬它的 CSS／JS／貼圖**；Galaxy Holo／Vecteezy 授權未確認，不採用。
   本輪三項都是自己寫的實作。

建置：`python build_gift_card.py`　驗收：`PYTHONIOENCODING=utf-8 python check_gift_card.py`

## 〇之二、保留基準（第三十六輪成品的實測值，任何一項變差都算回歸）

| 項目 | 現值 | 本輪要求 |
|---|---:|---|
| 卡名 WCAG 對比 | 6.46:1 | ≥6.46 |
| 稀有度對比（中英取低） | 10.33:1 | ≥4.5 |
| 寶石對比 | 145.67 | ≥145.67 |
| 卡名／稀有度置中偏差 | 0.008118／0.008133 px | <2px |
| 字級 | 31.45／17.69／28.83 | 不變 |
| 文字框 | 4.399684／4.399789／3.398139／16.197726% | 不變（容差 0.0001）|
| 卡框環平均灰階 | 176.908446 | 見 C 題 |
| 卡框環灰階標準差 | 72.845376 | ≥95% |
| 粒子：圖窗 2 秒差異像素 | 0.2490～0.2755% | ≥0.15% |
| 粒子：文字框差異像素 | 0.0000% | ≤0.02% |
| 粒子：整卡增亮 | 0.0153～0.0200% | 見 A 題 |
| 靜置 3 秒 rAF 次數 | 0 | **必須仍是 0** |

量測條件沿用第三十六輪：viewport 900×1000、DPR 2、卡寬 380 CSS px、
checker 強制 `--use-angle=d3d11`（軟體渲染量不準，第三十六輪已證明）。

---

## A. 愛心粒子（使用者指定）

**現在 20 顆圓點全部保留、參數不動**（它們已經通過第三十六輪所有門檻）。
本輪是**額外加**愛心，不是把圓點換成愛心。

### 規格

| 項目 | 值 |
|---|---|
| 數量 | **4～6 顆** |
| 大小 | **8～14 CSS px**（380px 卡寬的 2.1%～3.7%） |
| 顏色 | 粉色系，與 `--palette` 同家族（`#ffd4ec`／`#ffb3dd` 之類） |
| 透明度 | **低於圓點**（愛心是點綴，不是主角） |
| 週期 | **14～24 秒**，比圓點慢；`animation-delay` 各自錯開（負值，一開頁就是散開的） |
| 出現範圍 | **只在卡片下三分之一**：任一時刻每顆愛心的 rect 必須落在卡高 **60%～80%** 之間 |
| 形狀 | CSS 畫（`clip-path` 的 `path()`／`polygon()`，或 inline SVG data URI 當 `mask-image`）。**不准引入圖片檔或第三方庫** |

**為什麼限制在下三分之一**：8～14px 的愛心飄到臉上會變成髒點；文字框上緣在 80.4%，
再往下就會壓到字。這條是硬性的。

### 門檻

| 條件 | 門檻 |
|---|---|
| **愛心看得出是愛心** | 停用粒子層取對照圖，相減定位出單顆愛心的遮罩，與你自己寫的那個 `clip-path`／mask 在同尺寸下算 **IoU ≥ 0.80** |
| 愛心實際渲染尺寸 | 8～14 CSS px（量 rect，逐顆列出） |
| 愛心的垂直範圍 | 每顆每次取樣都在卡高 60%～80% |
| 加了愛心之後整卡平均增亮 | **≤ 0.06%**（第三十六輪圓點是 0.0153～0.0200%，愛心更大更少，總量不該超過三倍） |
| 文字框區域差異像素 | 仍 **≤0.02%** |
| 卡名／稀有度／寶石對比 | 不得低於〇之二的值 |
| `elementFromPoint` | 卡名與稀有度中心仍回傳 `.face-name`／`.face-rarity` |
| z-index／Z | 與圓點同層：z-index < 20、所屬平面 Z ≤42px |
| reduced-motion | 愛心也要 `animation: none` |
| rAF | 靜置 3 秒仍為 0 |

**IoU 那條是本輪最重要的斷言**：它就是「看得出是愛心」的可量版本。
如果 8px 太小做不到 0.80，**把尺寸往上調到 14px 以內解決，不准放寬 IoU**；
14px 還做不到就是形狀路徑有問題，回報數字不要硬過。

## B. 傾斜回彈（使用者指定）

**現況**：`demo.html` 的共用 CSS 是 `.card-lift{transition:none}`，
所以傾斜是瞬間跟隨、放開就死板地跳回原位，沒有重量感。

**要做的**：在**這一頁的 `.r-special` 範圍內**覆蓋成有緩動的版本
（⚠ 不准改 `demo.html`，只能在 `build_gift_card.py` 的 `<style id="gift-stage">` 裡覆蓋）。

- 跟隨：游標移動時有短緩動。
- 回正：`pointerleave` 之後用較長的 ease-out 回到 0。

`HoloCardFace.paint()` 是把 `--rx`／`--ry` 寫到卡片上、`.card-lift` 的 `transform` 讀那兩個變數，
所以在 `.card-lift` 上加 `transition: transform ...` 就會生效（**先實測確認 Chromium 真的會過渡
以 `var()` 組出來的 transform**，不要假設；量不到就改用 `@property` 註冊 `--rx`／`--ry` 再過渡）。

### 門檻

| 條件 | 門檻 |
|---|---|
| 跟隨不能鈍 | 游標移到定點後，卡片達到目標角度 **90% 的時間 ≤120ms** |
| 回正時間 | `pointerleave` 後 **380～520ms** 內回到 \|--rx\|、\|--ry\| < 0.1deg |
| 不准彈過頭 | 回正過程的過衝 **≤ 目標角度的 8%**，而且最多一次 |
| **全程不得浮出卡緣** | 回正與跟隨的**每一格**（rAF 逐格取樣），`.face-plate`／`.face-text`／`.face-gem`／`.face-name`／`.face-rarity` 的投影超緣仍 **≤1.5px** |
| reduced-motion | 回正立即（`transition: none`），不留動畫 |
| rAF | 靜置 3 秒仍為 0（過渡由 CSS 跑，不准自己寫迴圈） |

**「全程逐格」這條是重點**：HANDOFF 六之四記了三次「推太高浮出卡外」的事故，
加了緩動之後會出現**中間態**，中間態一樣要守這條。只量靜止時的兩端不算驗過。

## C. 卡緣厚度（使用者指定）

**目的**：讓它像一張有厚度的實體卡，不是貼在螢幕上的圖。

- 1～2px 的內側亮邊 ＋ 外側陰影，**隨傾斜換邊**（迎光側亮、背光側暗）。
- 用 `box-shadow`／`inset` 之類做，**不准改卡框既有的五道描邊與 conic**（那是第三十六輪定案的）。

### 門檻

| 條件 | 門檻 |
|---|---|
| 亮邊寬度 | 1～2 CSS px |
| **換邊要真的會換** | 左傾與右傾各截一張，量卡片左右兩側各 3px 帶的平均亮度差，**兩張的符號必須相反**，且差值絕對值 ≥ 6 灰階 |
| 卡框環平均灰階 | 相對第三十六輪的 176.908446，增幅 **≤ +6%**（框已經提亮過了，這輪只加厚度不再加亮） |
| 卡框環標準差 | ≥ 第三十六輪的 95%（72.845376 × .95） |
| 整卡平均增亮 | ≤ 2% |
| 圖窗中央角色區增亮 | ≤ 1% |
| 投影超緣 | ≤1.5px（外側陰影若用 `box-shadow` 不計入 rect，但要確認沒有把 `.leaf` 的 `overflow` 弄壞） |

## D. 順手修第三十六輪留下的一條假紅

`check_gift_card.py` 的 `capture_motion()` 用 `wait_for_function` 去等 320ms 過渡的中間狀態
（`opacity` 落在 .15～.85），等不到就 30 秒 timeout。**我獨立連跑五次掛了一次**：

```
File "check_gift_card.py", line 105, in capture_motion
  page.wait_for_function("... opacity>.15 && ... opacity<.85", polling='raf')
playwright._impl._errors.TimeoutError: Page.wait_for_function: Timeout 30000ms exceeded.
```

這是在賭能不能撞上一個瞬間。**改成決定性取樣**：用 Web Animations API 拿到那條 transition
（`el.getAnimations()`），`pause()` 後把 `currentTime` 設成 160ms，截圖，再 `play()`。
畫面固定停在中間格，可重現、不用等。**這是把賭運氣換成決定性，不放寬任何門檻。**

若 `getAnimations()` 在該元素上拿不到 transition，改用等效的決定性做法（例如暫時把
`transition-duration` 拉長到可穩定取樣的長度、截完再還原），並在報告寫明你用了哪一種與為什麼。

驗收：連續跑 **5 次** `check_gift_card.py`，5 次都要 exit 0，退出碼全部列進報告。

## 二、交付

1. 〇之二的基準表逐項並列改前／改後；A／B／C 每一條門檻都要有實測數字。
2. 新斷言要先確認在做之前是紅的（愛心的 IoU、回彈的逐格超緣、卡緣的換邊符號），
   把「紅的那次」的 log 保留下來。
3. 截圖放 `docs/clicker/shots/round37/`：常態、左傾、右傾、愛心的定位差異圖、
   回正過程的三格（起／中／末）、reduced-motion。
4. 報告 `docs/clicker/REPORT-holo-round37.md`，**用中文寫**。
5. **不要 commit、不要 push。** 不要動共用 CSS、`card_face.js`、卡池、抽卡頁、`mtk-*`，
   也不要動第三十四～三十六輪的其他產物。

## 三、允許你否決我

A 的數量／大小／週期、B 的緩動曲線與時間、C 的實作手法，只要拿得出量測都可以改，
在報告寫明「原本建議什麼、量到什麼、所以改成什麼」。
但**使用者指定的三件事與所有門檻不可以自己放寬**。
