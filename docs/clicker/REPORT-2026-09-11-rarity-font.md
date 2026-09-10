# 執行回報：稀有度字族統一（2026-09-11）

照 `ORDER-2026-09-11-rarity-font.md` 第 3 節做的。**請你驗收，並裁決第五節新發現的那件事。**
證據在 `docs/clicker/shots/rarity-font/`（腳本、before/after JSON、對照圖、check log 都在裡面）。

## 一、改了什麼（原始碼只有一行）

`_art/holo-test/demo.html:816`：

```diff
-.hcard .face-rarity{font-size:var(--rarity-fs,9px) !important}
+.hcard .face-rarity{font-family:"Holo Noto Sans",sans-serif;font-size:var(--rarity-fs,9px) !important}
```

沒有動 `card_face.js`、舊 RWD、`baseline-css`、字型建置器。沒有動 hover／放大／黑角／
動畫／Z 軸／寶石／光暈／卡背／機率／編隊規則。沒有退役任何回歸守衛。沒有 commit。

## 二、重建（照你給的順序，八條全部 exit 0）

`build_round5_standalone.py` → `build_cards_remade.py` → `build_cards_remade_standalone.py`
→ `build_deluxe_b.py` → `build_deluxe_b_standalone.py` → `build_deluxe_b.py --test`
→ `build_deluxe_b_standalone_py --test` → `build_map20.py`。

git 動到的檔（12 個）：上述 9 個 HTML 產物、`docs/clicker/shots/team-round3/build.json`
（`build_map20.py` 的副產物，你有預告）、加兩份新文件。

⚠ **一個你沒預告的副作用，我沒有隱瞞**：`build_round5_standalone.py` 第 30 行
`from update_demo_data import update; update()` 會**回頭改寫 demo.html 的 `poolData`**
（從 `pool_data.py` 重生）。所以 `demo.html` 的 diff 是**兩行**不是一行：我改的 CSS，
加上被重生的 poolData。demo 的卡片數因此 **65 → 81 張**。
我沒有還原它——它是你指定的建置鏈的正常行為，而且代表 demo.html 之前是**沒同步**的狀態。
要不要保留這個同步，你裁決。

禮物卡與 mtk 單卡**沒有重建**（Q3 待使用者決定）。

## 三、驗收數字（`check-rarity-font.log`，全綠，exit 0）

Chromium 140.0.7339.16、DPR=1、demo／抽卡／編隊三頁 ×（1440×900、1024×900、390×844）。
抽卡走 `#p1 → #entry-pack → #next` 到實際揭卡。遞迴穿 open shadow roots。
等 `document.fonts.ready` → `HoloCardFace.refit()` → 兩個 rAF 再量。

| 檢查 | 結果 |
|---|---|
| 字族指定第一順位正確率 | demo 81 張／抽卡 1 張／編隊 11 張 ×3 尺寸，**100%**，例外 0 |
| **實際平台字型**（CDP `CSS.getPlatformFontsForNode`）| 見下表 |
| 字級變數生效 `abs(fontSize − --rarity-fs)` | 全部 **0.0000px** |
| 主副標比例 `abs(rarityFS − nameFS×0.5625)` | 最差 **0.0056px**（門檻 0.011）|
| 非目標樣式零變更 | 共同卡 demo 65／編隊 10 張，weight／style／letter-spacing／color／textShadow 差異 **0 項** |
| 稀有度文字寬度 | 最大寬增 **+11.166px**（demo 1024），無一張超過 90% 卡寬 |
| 字族負控制 | 注入前 11 張全綠 → 注進 11 個 shadow root 後 **11 張全變 monospace（成功變紅）** → 移除後恢復全綠 |

**實際平台字型（這是最硬的那一項）**：

| 頁面／尺寸 | before | after |
|---|---|---|
| demo ×3 | `MingLiU: 687, 微軟正黑體: 2` | **`Noto Sans TC: 835`** |
| 抽卡 ×3 | `MingLiU: 9` | **`Noto Sans TC: 9~11`** |
| 編隊 ×3 | `MingLiU: 114~125` | **`Noto Sans TC: 114~125`** |

**稀有度的 fallback glyph 從 810 降到 0。** 原本中文走 MingLiU（新細明體）、
英文走系統等寬，現在整行走內嵌的 Noto Sans TC，跟卡名同一套。

對照圖：`shots/rarity-font/demo-plate-old-vs-new.png`、`team-plate-old-vs-new.png`
（同一張卡 rocketdog、同一個 rect、DPR=2，上＝舊 monospace 注入版，下＝新 Sans）。

**兩點誠實揭露**：
1. 第 4 項在編隊 390 有一張 `rocketdog` 被排除——那是**未佈局的詳情卡**
   （`cardWidth=0`、沒有 `--rarity-fs`、沒跑過 `fit()`），比例 0.45 不是 0.5625。
   **before 與 after 數值完全相同，不是本輪造成的**，但排除規則是我自己訂的，請你裁決。
2. `lineHeight` 我在比對時排除了——換字族會動 `normal` 解析出的 px 值，
   照你第 5 節的提醒不能當成 CSS 規格變更。若你要看數字，`before/after.json` 裡有原始值。

## 四、還沒做的（照你的裁決，等使用者回答）

你交代要原文轉達的三題我已經轉給使用者，還沒回覆：中英文是否同字族、要不要重訂字重字距、單卡是否納入。
所以視覺／排版門檻（Range 寬高、淨空、兩行間距、寶石交疊）**本輪還沒校準也沒量**，
我沒有硬填任何未量的數字。

## 五、⚠ 我量到一件跟你第 1 節結論衝突的事，請裁決

你寫「Sans 現有子集已涵蓋五階稀有度的中文字、英文與分隔符號，**這個修正不需要新增字元或重製字型**」。
**稀有度那部分你是對的（缺字 0）。但卡名不是。**

我把 demo.html 內嵌的 Holo Noto Sans 解出來（cmap 726 字），拿去比對頁面裡所有 `"name"` 字串（74 個），
**9 個卡名共缺 13 個字**：

| 卡名 | 缺的字 |
|---|---|
| 流浪玥手 | 流、浪 |
| 今天我生日 | 今、日 |
| 外送咩鴿 | 送、鴿 |
| 沙堡領主 | 沙、堡、領 |
| 小丑玥 | 丑 |
| 真菌玥 | 菌 |
| 咩噗熊 / 玥熊 | 熊 |
| 扁扁彩華 | 扁 |

缺的 13 字：`丑菌熊流浪今日送鴿沙堡領扁`。

這對應到我 check log 的觀察行：`.face-name` 的平台字型仍有
`微軟正黑體: 15`（demo）／`4`（編隊）／`2`（抽卡）——
**也就是同一個卡名裡，一半是 Noto Sans TC、一半是微軟正黑體。**
以使用者「統一視覺」的說法，這跟稀有度那行是同一種病，只是發生在字內。

**根因（我讀了 `build_round4_fonts.py`）**：它是從 **demo.html 自己**掃非 ASCII 字元來決定子集
（第 8 行 `re.findall(r'[^\x00-\x7f]', html)`）。字型是在 poolData 還沒同步前建的，
所以新卡的字沒進子集。而本輪 `update_demo_data.update()` 剛把 poolData 補進 demo.html——
**現在再跑 `build_round4_fonts.py` 就會涵蓋這 13 個字**。

**我沒有動它**，因為你明講「本輪不用跑」。請裁決：

- A：本輪一起修（跑 `build_round4_fonts.py`，然後八條建置全部重跑一次），
  正確順序應該是 `update_demo_data` → `build_round4_fonts` → 其餘七條。
- B：另案處理，本輪只交付稀有度字族。

順帶：`document.fonts.check('16px "Holo Noto Serif"')` 三頁都是 false。
我**沒有**判斷這是不是問題（你第 1 節也提醒 check() 不能單獨當證據），只回報。

## 六、我沒做也不打算順手做的

hover 門檻重訂、1.04 放大裁切、六個過期回歸守衛退役、黑角演出途中掃描、
5.0 新卡、變種卡——全部沒碰。
