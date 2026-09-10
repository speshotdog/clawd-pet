## 1. 診斷

**對象判斷正確：這輪要處理的是 `.face-rarity`。** 我已看過左右對照圖，並核對 [card_face.js](/D:/claude研究/clawd-pet-50/_art/holo-test/card_face.js:103)：建立器依序產生 `.face-name` 與 `.face-rarity`，後者就是「神話 / MYTHIC」。

根因是兩行使用不同字型規則：

- 卡名已指定 `"Holo Noto Sans", sans-serif`。
- 稀有度仍由 `font:9px monospace` 指定等寬字型，並重設 weight、style、line-height；只修改卡名不會影響它。
- Sans 現有子集已涵蓋五階稀有度的中文字、英文與分隔符號，**這個修正不需要新增字元或重製字型**。

簡報有以下需要修正或補充的地方：

| 項目 | 核對結果 |
|---|---|
| 「8 條 RWD 覆寫」 | 不能視為目前 `.hcard` 的有效字級來源。[demo.html:816](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:816) 的 `font-size:var(--rarity-fs,9px) !important` 已接管字級。舊規則中的其他屬性，例如 letter-spacing，仍可能生效。 |
| 三頁實測 | 簡報附記已補上抽卡頁，不應繼續寫成「尚未量到」。但這些是你提供的實測，本輪我沒有重跑 Playwright。 |
| 樣本數與單組數值 | 66、11 個元素不能用一組 style 代表全部卡片。map20 的 11 張來自總覽與詳情，尺寸不同；卡名也會因階級、長度而不同。驗收須逐卡記錄。 |
| `.back-edition` | [demo.html:826](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:826) 已將它隱藏；目前卡背使用圖片。改它不會改善這張圖。 |
| `fonts.check()` | 不能單獨證明指定文字實際使用該字型。Serif=false 也不足以診斷損壞，須區分未載入、未使用與載入失敗。 |
| 「重建流程已修好」 | 字型建置器確實已補 `populate()` 與既有 data URI 更新，但**產物尚未全部同步**。 |

我直接解碼各 HTML 內嵌 WOFF2，得到：

| 產物 | Sans／Serif bytes | 字元映射 |
|---|---:|---|
| demo、正式卡池及 standalone、正式抽卡及 standalone、map20 | 233,748／317,200 | 現行字型有效；demo 兩份各有 726 個映射 |
| demo-standalone、抽卡 test 及 test-standalone、gift-mohuashaonv、mtk-card | 996／984 | **兩份皆無字元映射，仍是舊空字型** |

因此這輪除 CSS 外，必須處理主線產物同步，否則不同入口仍會呈現不同結果。

## 2. 範圍裁決

**建議先做最小修正版：所有現行主線 `.hcard .face-rarity` 中英文一起使用卡名的 Sans 字族，保留既有階層與效果。** 這是可供審閱的候選，不代表「視覺統一」已經獲得使用者認可。

| 範圍 | 裁決 |
|---|---|
| demo、卡池、抽卡、編隊的真正卡面 | 統一稀有度字族，正式／測試／standalone 同步 |
| 字級與長名縮放 | 不動：保留 `24/290`、`13.5/290`、縮字下限 `0.55` |
| 卡名字重、字距、金色／彩虹效果 | 不動 |
| 稀有度現有 weight、letter-spacing、line-height、顏色、光暈 | 最小修正版先保留 |
| `baseline-css` 舊版對照 | 不動；它是比較樣本，不納入新樣式通過率 |
| 頁面 UI、數字、工具資訊的 monospace | 不動 |
| 卡背與 `.back-edition` | 不動 |

以下請原文轉達：

1. **這題要問使用者：稀有度的中英文是否都要和卡名同字族？**  
   選項 A：整行 Sans，統一中英文，建議先看這版。  
   選項 B：中文 Sans、英文保留等寬機械感；需要拆分文字節點，屬於另一種設計。

2. **這題要問使用者：這次是否也要重新設計字重與字距？**  
   選項 A：先只統一字族，保留目前大小與主副標階層。  
   選項 B：連字重、字距一起重訂；先提供同尺寸對照樣本，選定後才固定數值。  
   不要直接把稀有度套成卡名的 800／900，也不要自行發明 600、`.08em` 等定案值。

3. **這題要問使用者：禮物卡與 mtk 單卡是否一起納入？**  
   選項 A：本輪只交付主線，單卡的舊空字型另案處理。  
   選項 B：本輪同步單卡；但重建會同時恢復其卡名真字型，需另驗收兩張單卡。

## 3. 給你的明確指令

以下是**整行 Sans、只改字族**候選版的施工指令。

**修改來源**

只改 [demo.html:816](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:816)，把現有規則擴充為：

```css
.hcard .face-rarity{
  font-family:"Holo Noto Sans",sans-serif;
  font-size:var(--rarity-fs,9px) !important
}
```

實際提交沿用原檔單行格式。保留原有字級宣告，不新增 `font:` shorthand，也不需要對 family 加 `!important`。

不要逐份手改生成 HTML；不要修改 `card_face.js`、舊 RWD、`baseline-css` 或字型建置器。

**重建前**

先保存現況逐卡 computed style、字型使用證據及代表截圖，供同環境比較。先完成候選樣本對照，再把它稱為定案。

**主線重建順序**

工作目錄為 `_art/holo-test`，以下逐條執行；失敗即停：

```text
python build_round5_standalone.py
python build_cards_remade.py
python build_cards_remade_standalone.py
python build_deluxe_b.py
python build_deluxe_b_standalone.py
python build_deluxe_b.py --test
python build_deluxe_b_standalone.py --test
python build_map20.py
```

`build_round5_standalone.py` 產生的是 `demo-standalone.html`。上述來源關係已核對：各頁從 demo 擷取 CSS，map20 再把樣式送入 Shadow DOM。

**本輪不用跑 `build_round4_fonts.py`**：字元覆蓋已足夠，demo 內嵌字型也有效。若後續另有字元變更需要重製，才把它放在所有上述建置之前。

單卡若使用者選擇納入：

- 禮物卡使用 `python build_gift_card.py --page-only`。
- mtk 使用 `build_mtk_card.py`，先確認現有名稱／ID，保留原參數。
- 禮物建置器末段有刪除舊命名產物的副作用，執行前列出實際命中檔案；本輪不授權順便清理素材。

交回的產物應包含：差異清單、建置結果、逐卡量測 JSON、同尺寸前後對照圖、未處理單卡清單。

## 4. 驗收條件

**本輪沒有新的瀏覽器實測，也沒有已認可的新稀有度樣本。因此不能宣稱已有經校準的「好看」門檻。** 以下將可立即固定的程式契約，與必須先量樣本的視覺門檻分開。

**量測方式**

- 固定 Chromium 版本、DPR=1、viewport 與卡片 ID；至少涵蓋 1440×900、1024×900、390×844。
- demo／卡池涵蓋五階、三種卡型與長名卡；map20 涵蓋兩頁總覽及詳情。
- 抽卡走 `#p1 → #entry-pack → #next` 至實際揭卡；不能用空 DOM 通過。
- 遞迴讀取 open shadow roots，只統計真正的 `.hcard`。
- 等指定字型載入後呼叫 `HoloCardFace.refit()`，再等兩個 rAF。
- 字級比例使用未變形的 content-box 寬度；幾何比較先固定姿態與動畫時間。

| 檢查 | 數字門檻 | 基準來源 |
|---|---|---|
| 樣本完整性 | 預期卡片缺漏 **0 張**；每張恰有 **1** 個卡名、**1** 個稀有度 | 建立器 DOM 契約；預期 ID 由頁面資料與實際狀態建立，不能只寫 `count > 0` |
| 字族指定 | 目標稀有度第一字族正確率 **100%** | 候選規格：`Holo Noto Sans` |
| 真正字型使用 | 目標文字的非預期 fallback glyph count **0** | 用 Playwright 的 Chromium CDP `CSS.getPlatformFontsForNode` 檢查實際節點；需確認 custom font，不能只看 computed family |
| 字型字元覆蓋 | 實際稀有度字串缺字 **0** | 我已靜態核對五階文字，現有 Sans 缺字為 0；執行方再涵蓋所有交付字串 |
| 字級變數生效 | computed font-size 與對應 CSS 變數差 **<0.011 CSS px** | 現有 `check_card_sizing.py` 使用的精度；建立器以 `toFixed(2)` 儲存 |
| 主副標比例 | `abs(rarityFS − nameFS × 0.5625) < 0.011px` | `13.5/24 = 0.5625`；兩個值各自四捨五入的合成誤差小於約 0.007813px |
| 不缩字樣本 | name=`W×24/290`、rarity=`W×13.5/290`，各誤差 **<0.011px** | 現有 sizing 測試採用 80、102、290px；必須先確認樣本沒有觸發縮字 |
| 長名下限 | 102px 卡寬、100 個 W：name 約 **4.64276px**，誤差 **<0.011px**，`nameFits=false` | 現有壓力測試與 `0.55` 下限；此人工溢出樣本不可混入正常卡通過率 |
| 候選版非目標樣式 | weight、style、letter-spacing、line-height、顏色與效果的非預期 computed 值變更 **0 項** | 同卡、同尺寸的修改前快照；不把字型造成的文字框尺寸變化誤認為 CSS 規格變更 |

**視覺與排版門檻的校準指令**

請先讓使用者選定同尺寸候選樣本，再量：

- 稀有度文字 Range 的寬、高與換行數。
- 文字到可用區左右邊界的最小淨空。
- 卡名與稀有度的垂直間距。
- 文字與寶石、裁切邊界的交疊量。

上述項目本輪**不硬填 2px、5px、10% 等未量數字**。正式驗收文件須補上「合格樣本實測值／同條件波動／上下限與餘裕理由」，並讓合格樣本通過、注入換行或裁切的負控制失敗。

字族負控制則可立即做：在正確的 root 內將稀有度改回 monospace，指定字族檢查必須變紅；移除後恢復全綠。

**程式契約全綠，只代表修正正確落地；視覺定案仍須上述樣本認可與校準。**

## 5. 風險與不要碰的東西

- 換 family 即使保留 `line-height:normal`，文字實際高度仍可能變；必須量兩行間距與裁切。
- `fit()` 目前只拿卡名寬度決定縮字，**不會因稀有度過寬自動補救**。若真的溢出，回報樣本，不准直接改縮放常數。
- 現有 demo 對照圖的右半仍有未修的稀有度，不能拿它當「新稀有度已合格」的證據。
- `build_map20.py` 會重寫 `shots/team-round3` 的建置證據與圖片，檢查差異時須辨識這些副產物。
- 不改 hover、1.04 放大、黑角、動畫、卡面位置、Z 軸、寶石、光暈、卡背圖片、抽卡機率、編隊規則、5.0 新卡與變種卡。
- 不趁本輪刪除六個過期回歸守衛；若測試碰到已知失敗，列明原因，不假報全通過。

本輪我僅做唯讀原始碼、圖片及字型解析，未改檔、未跑 build、未 commit。