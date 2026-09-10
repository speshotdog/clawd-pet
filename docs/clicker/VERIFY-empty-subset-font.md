# 整條卡面線的字型從來沒有生效過（996 bytes 的空字型）

使用者說「卡到隊伍系統裡面 字型是不是都跑掉了」。查下去發現的是**更早、更大的問題**。

## 一、現象

```
document.fonts 狀態：
  demo.html   → Holo Noto Sans: status = "error"
  編隊畫面     → Holo Noto Sans: status = "error"
  document.fonts.check('600 16px "Holo Noto Sans"') → false（兩邊都是）
```

**不是編隊畫面把字型弄壞的，是這條線從第四輪起就沒有真的載入過那個字型。**
`.face-name` 宣告的是 `"Holo Noto Sans", sans-serif`，
`getComputedStyle` 也照樣回報 `"Holo Noto Sans"`——
**但實際畫出來的一直是系統的 sans-serif fallback。** 這就是「字型跑掉了」的真身。

## 二、成因：`fontTools` 子集少了 `populate()`

`_art/holo-test/build_round4_fonts.py` 第 17～19 行：

```python
opts = subset.Options(); opts.flavor = 'woff2'; opts.text = chars; ...
font = subset.load_font(str(source), opts)
subset.Subsetter(opts).subset(font)      # ← 少了 subsetter.populate(text=chars)
```

**`Options.text` 只是把字串放進選項物件，它不會自己變成要保留的字符集。**
真正決定保留哪些字的是 `Subsetter.populate()`。沒呼叫 populate，
subsetter 的保留集是空的，於是產出一個**結構合法但沒有任何字的字型**——
瀏覽器載入時報 `error`，**安靜退回 fallback，不報任何錯**。

### 實測（同一支來源字型、同一組 734 個字）

| 做法 | 產出大小 |
|---|---:|
| 現況（沒有 `populate`）| **996 bytes** |
| 加上 `subsetter.populate(text=chars)` | **233,748 bytes** |

996 bytes 這個數字是這個錯誤的指紋。

## 三、影響範圍

`build_round4_fonts.py` 產的兩個字型（Sans／Serif）**內嵌在 `demo.html`**，
而 `demo.html` 是所有卡面產物的來源（`build_cards_remade.py`／`build_deluxe_b.py`
都是從它擷取 style 與 mask 的），所以：

**卡面頁、抽卡系統、編隊畫面——整條線的每一張卡，卡名與稀有度都在用系統 fallback。**

## 四、要加的門檻（防止它再變回空字型）

這個錯誤的特徵是**安靜**：沒有例外、沒有紅字、computed style 看起來完全正常。
所以必須用量的擋住：

| 門檻 | 值 | 理由 |
|---|---|---|
| 內嵌 woff2 的 byte 數 | **≥ 150,000**（上限 600,000）| 996 bytes 是空字型的指紋；實測正常值 233,748，下限留約 36% 餘裕 |
| `document.fonts.check('600 16px "Holo Noto Sans"')` | **必須是 `true`** | 直接量「瀏覽器認不認這個字型」，不看宣告 |
| 每個 `@font-face` 的 `FontFace.status` | **不得為 `error`** | 現況兩個都是 error |

⚠ **不要只驗 `getComputedStyle().fontFamily`**——那是宣告值，
空字型的情況下它照樣回報 `"Holo Noto Sans"`。這正是這個錯誤能藏三十幾輪的原因。

## 五、修這個會改變什麼

修好之後**每一張卡的卡名與稀有度都會換成真正的 Noto Sans TC / Serif**，
包含抽卡系統。這是使用者要的（「我希望他還是有一樣的感覺」），
但**它會動到所有卡面產物的外觀**，所以：

- 修完要交「修正前 vs 修正後」的並排圖（同一張卡、同一尺寸）
- 單檔會變大：兩個字型合計約 **+460KB**（base64 後約 +620KB）
- `demo.html` 是共用凍結檔，**這次只換內嵌的字型 base64，不動任何樣式規則**
