# 派工簡報：卡面字體階級沒統一（2026-09-11）

**這一輪你是指揮，我是執行。請你不要改任何程式碼、不要跑 build、不要 commit。**
我要的是「診斷 ＋ 明確指令 ＋ 驗收條件」，我照做完再回來請你驗收。

---

## 一、使用者原話

> 「我覺得他下面的字體階級還是沒修好，我要的是統一視覺。」

配的圖是卡面標題區的左右對比（左＝上一輪修字型前，右＝修字型後）：
上面一行卡名「宇宙冒險羊」（彩虹漸層），下面一行稀有度「神話 / MYTHIC」。
使用者指的是**下面那一行**——卡名換成真字型了，稀有度那行沒有，
兩行看起來不是同一套字，所以視覺不統一。

參考圖：`docs/clicker/shots/card-feel/detail-type-pair.png`

## 二、上一輪的背景（`docs/clicker/HANDOFF-2026-09-10-night.md` 第二節）

上一輪修好了「整條線的字型從來沒生效過」：`build_round4_fonts.py` 少呼叫
`Subsetter.populate()`，產出 996 bytes 空字型，瀏覽器安靜退回系統 fallback。
已修成 996 → 233,748（Sans）／984 → 317,200（Serif）。

**但那一輪只把 `.face-name` 綁到新字型，`.face-rarity` 沒動。**

## 三、我實測到的數字（Playwright，Chromium 1440×900，剛剛跑的）

腳本讀 `.face-name` 與 `.face-rarity` 的 computed style（有穿 shadow root）：

| 頁面 | 元素 | 樣本數 | fontFamily | font-size | font-weight | letter-spacing |
|---|---|---:|---|---:|---:|---:|
| `demo.html` | `.face-name` | 66 | `"Holo Noto Sans", sans-serif` | 23.17px | 800 | 1.274px |
| `demo.html` | `.face-rarity` | 66 | **`monospace`** | 13.03px | 400 | 1.824px |
| `map20.html`（編隊）| `.face-name` | 11 | `"Holo Noto Sans", sans-serif` | 14.90px | 900 | 0.596px |
| `map20.html`（編隊）| `.face-rarity` | 11 | **`monospace`** | 8.38px | 400 | 1.173px |

`document.fonts.check('16px "Holo Noto Sans"')` = **true**（demo 與 map20 都是），
`...Serif` = **false**（兩頁都是；我沒有判斷這是不是問題，只回報觀察）。

`deluxe-gacha-b.html` 這次量不到——那頁要先抽一次卡才會有 `.hcard`，
我的腳本沒有觸發抽卡就直接讀，`.face-name`/`.face-rarity` 都是 null，
`fonts.check` 兩個都 false。**這頁的數字我還沒量到，不要當成證據。**

## 四、原始碼位置（我 grep 到的，未改動）

`demo.html` / `cards-remade.html` / `deluxe-gacha-b.html` / `map20.html` 內嵌 CSS：

```css
.face-rarity{font:9px monospace;color:var(--accent-card);letter-spacing:.14em}
```

`font:` 這個 shorthand 會**同時重設 font-family / weight / style / line-height**。

對照卡名那條（上一輪加的）：

```css
.hcard .face-name{... font-family:"Holo Noto Sans",sans-serif !important; font-weight:800; letter-spacing:.055em; ...}
.r-legendary .face-name,.r-mythic .face-name{font-family:"Holo Noto Sans",sans-serif !important; font-weight:900; ...}
```

`.face-rarity` 的 `font-size` 另有 8 條 RWD 覆寫（7px/6px/8px…），
且 `card_face.js:142-143` 會算 `--rarity-fs` 塞進 CSS 變數 —— 動的時候要注意別把縮放邏輯弄壞。

同一批頁面裡其他還在吃 monospace 的 class（供你判斷「統一」要做到多大範圍）：
`.back-edition`（卡背版次，**在卡上**）、`.edition`、`.eyebrow`、`.edge-title`、
`.limits`、`.diagnostics`、`.layout-status`、`.legacy-side-label`，
map20 另有 `.digits` `.number` `.roster-pages` `.team-marker`。
後面這些多半是**頁面 UI／工具介面**不是卡面，我沒有自作主張決定要不要一起改。

產出鏈：`build_round4_fonts.py` → `demo.html` →（其他卡面產物由 demo 衍生）。
上一輪的坑：**建置器靠替換 marker 注入字型，marker 第一次建置後就不存在了**，
所以只補程式碼重跑不會更新內嵌字型，重建流程上一輪已一起修。

## 五、我需要你給的東西

1. **診斷**：確認「使用者說的下面那行」＝`.face-rarity`，還是我看錯了對象。
2. **「統一視覺」的範圍要你裁決**（我不替使用者拍板）：
   只換 family、還是連 weight／letter-spacing／大小比例一起訂成一套階級？
   卡背 `.back-edition` 要不要一起？頁面 UI 的 monospace 要不要一起？
   如果你認為這是使用者才能決定的事（例如 MYTHIC 那串英文本來就想要等寬的機械感），
   **照實說「這題要問使用者」**，我原文轉達，不要替他決定。
3. **明確指令**：要我改哪個檔的哪一段、改成什麼、產物要不要重建（哪個腳本、什麼順序）。
   注意不能破壞 `--rarity-fs` 的縮放與那 8 條 RWD 覆寫。
4. **驗收條件**：可以用 Playwright 量的數字門檻。
   ⚠ 照 `METHOD-card-face.md`：**門檻要先量一個明顯合格的樣本再往下留餘裕**，
   不要憑感覺訂（上一輪 hover 訂 12% 結果連參考實作都只有 3.754%，整條門檻作廢）。

## 六、其他不要動的事

上一輪還有四件沒做完（hover 門檻重訂、1.04 放大裁切、六個過期回歸守衛退役、
黑角演出途中沒掃）＋ 5.0 新卡與變種卡完全沒開始。
**這一輪只處理字體階級**，那些不要順手做。

---

## 附記（簡報送出後補量到的第三頁）

`deluxe-gacha-b.html` 我改用「點 `#p1` → 點 `#entry-pack` → 連點 `#next` 翻到揭卡」
的方式跑出 `.hcard`，量到：

| 元素 | fontFamily | font-size | font-weight | letter-spacing |
|---|---|---:|---:|---:|
| `.face-name` | `"Holo Noto Sans", sans-serif` | 31.03px | 800 | 1.707px |
| `.face-rarity` | **`monospace`** | 17.46px | 400 | 2.444px |

`fonts.check` Sans=true、Serif=false。**三頁全部都是同一個症狀。**
