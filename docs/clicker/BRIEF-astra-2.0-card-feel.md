# 派工：把卡的「手感」補回來（字型 ＋ hover 光影 ＋ 選取微放大）

使用者原話：

> 卡到隊伍系統裡面 **字型是不是都跑掉了**
> 我希望他還是有 **一樣的感覺**，還有**選取 會微微放大** 和 **滑鼠指上去的光影回饋**

三件事。**第一件影響整條線（含抽卡），第二三件只在編隊畫面。**

---

## 一、字型：整條線嵌的是 996 bytes 的空字型

**先讀 `docs/clicker/VERIFY-empty-subset-font.md`（我已經查完並實測驗證過）。**

摘要：`_art/holo-test/build_round4_fonts.py` 第 17～19 行少呼叫 `Subsetter.populate()`。
`Options.text` 只是把字串放進選項物件，**不會變成要保留的字符集**——
真正決定的是 `populate()`。少了它，產出的是結構合法但**沒有任何字**的字型，
瀏覽器報 `error` 之後**安靜退回 fallback**。

實測（同來源字型、同 734 字）：

| 做法 | 產出 |
|---|---:|
| 現況 | **996 bytes** |
| `subsetter.populate(text=chars)` | **233,748 bytes** |

### 要做的

```python
opts = subset.Options(); opts.flavor='woff2'; opts.text=chars; opts.layout_features=['*']; opts.retain_gids=False
font = subset.load_font(str(source), opts)
subsetter = subset.Subsetter(opts)
subsetter.populate(text=chars)     # ← 補這一行
subsetter.subset(font)
subset.save_font(font, str(out), opts)
```

然後重跑 `build_round4_fonts.py` → `build_cards_remade.py` →
`build_cards_remade_standalone.py` → `build_deluxe_b.py` →
`build_deluxe_b_standalone.py` → `build_map20.py`（順序照 KICKOFF 的定案）。

⚠ **`demo.html` 這次只換內嵌的字型 base64，不准動任何樣式規則。**
它是共用凍結檔，卡面幾何／Z／字級一個字都不要改。
改完要證明：**除了那兩段 base64 之外，`demo.html` 的 diff 是空的。**

### 驗收（這個錯誤的特徵是「安靜」，只能用量的擋）

| 門檻 | 值 |
|---|---|
| 內嵌 woff2 的 byte 數（兩個字型各自）| **150,000～600,000** |
| `document.fonts.check('600 16px "Holo Noto Sans"')` | **`true`** |
| 每個 `FontFace.status` | **不得為 `error`** |
| `demo.html` 除 base64 外的 diff | **0 行** |

⚠ **不要只驗 `getComputedStyle().fontFamily`**——空字型的情況下它照樣回報
`"Holo Noto Sans"`，這正是這個錯誤能藏三十幾輪的原因。

### 要交的並排圖

**「修正前 vs 修正後」**，同一張卡、同一尺寸、同一游標位置：
`demo.html` 的大卡一張、抽卡結果頁一張、編隊總覽一張、編隊詳情卡一張。
把卡名與稀有度那一塊**裁圖放大**一起交，我要看得到字形差異。

⚠ 這會讓每一張卡的外觀都變（包含抽卡）。**這是使用者要的**，
但如果你量到任何卡名溢出卡框、換行、或被裁切，**寫進回報停手**，不要自己改字級救。

---

## 二、hover 光影回饋（總覽卡）

第二輪我下的指令是「**只有詳情卡接受材質互動、總覽卡靜止**」。
那條是照 astra 的「節制外部動態」寫的，但**它擔心的是自動掃箔**
（沒人動它也在閃、會持續搶注意力），**不是 hover 回饋**（使用者自己觸發的）。

所以規則改成：

```
自動掃箔／自動巡迴光影   →  維持 0 次（不變）
hover 時的光影回饋       →  要有（這一輪新增）
```

- 走既有的 `HoloCardFace.paint(face, ...)`，**`card_face.js` 不准改**
- `pointermove` **要用 rAF 合併**（一個顯示幀最多做一次）——
  `METHOD-card-face.md` 第三節記過這個坑：不合併的話 `pointermove` 觸發率高於螢幕更新率，
  同一顯示幀重複 paint，還會把非同步解碼餓死
- 滑鼠移開要回到中立姿態

### 驗收：要證明「亮部真的跟著游標移動」，不是加了等於沒加

游標放在卡面**左 25%／中 50%／右 75%** 三個位置，各自取樣：

| 門檻 | 值 | 理由 |
|---|---|---|
| 最亮區質心在卡內的水平位移（左 vs 右）| **≥ 12% 卡寬**（上限 45%）| 下限防「加了等於沒加」；上限防整卡爆亮 |
| hover vs 非 hover 的卡面像素差（>2 階）| **3～25%** | 同上，兩端都要 |
| 自動掃箔次數（無指標輸入時）| **0～0** | 維持 |
| 卡內核心區在**非 hover** 狀態的開關差異 | **0～0%** | 證明沒有為了做效果去改卡本身 |

⚠ **先量基準再訂**（`METHOD-card-face.md` 第二節第 2 點）：
上面的 12% 是我從「詳情卡現有的 hover 效果」推的，**還沒量過**。
**請先量詳情卡現況的實際值寫進回報**，如果總覽卡照抄詳情卡的做法卻搆不到 12%，
**回報實測值停手，不要自己調門檻或加光暈硬頂**（那條線踩過：為了過亮度下限加光暈，把愛心做成光斑）。

---

## 三、選取微放大

抽卡那邊已經有這個契約（`ceremony.css`）：

```css
.slot.done:hover .reveal-shell,.slot.done.selected .reveal-shell{scale:1.04}
.reveal-shell{transition:scale 180ms ease-out}
```

編隊沿用**同一組值**，不要自己發明：

| 門檻 | 值 |
|---|---|
| hover／選取的 scale | **1.03～1.06** |
| 轉場時間 | **140～220ms**、`ease-out` |
| 選取狀態的放大**要持續**（不是只有 hover 時）| 是 |
| 放大時是否被相鄰卡遮住 | **0～0%**（版面要留得下 1.06 倍）|
| 放大時是否被視窗邊緣裁切 | **0～0%** |

⚠ 最後兩條是這一輪最容易做壞的：現在手機是 3 欄 112px 剛好排滿，
**放大 6% 很可能就會互相蓋到或被邊緣切掉**。
如果量到衝突，**縮欄距或縮卡寬都可以，但不准取消放大**——那是使用者指名要的。

---

## 四、回歸（全部要繼續通過）

- 地圖 **245 項**、三尺寸地圖截圖像素差 **0**
- 編隊第三輪 **1104 項**
- **黑角判準**：現況 PASS ＋ 負控制 FAIL
  （⚠ 負控制要注進 **shadow root**，注在頁面層是無效的，見 `VERIFY-black-corner.md`）
- `card_face.js` 卡內幾何／Z／字級改動 **0 項**
- 受保護檔案變更 **0**

輸出到 `docs/clicker/shots/card-feel/`。

## 五、紀律

- **不要動** `src/`、`card_face.js`、`ceremony.*`、`pool_data.py`、`map-art/` 的圖、**地圖畫面**
- `demo.html` **只准換字型 base64**
- **不要 commit、不要 push**
- 門檻上下限成對；決定性取樣（WAAPI 暫停 ＋ `currentTime` ＋ 雙重 rAF）
- **驗收全綠也要交截圖**
- 量不到或你認為門檻訂錯，**寫理由**，不要為了過關調門檻，**不要編數字**
