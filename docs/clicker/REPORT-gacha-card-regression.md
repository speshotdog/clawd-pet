# 抽卡卡面版面回歸：診斷與執行指令

日期：2026-09-09。對象：`_art/holo-test/deluxe-gacha-b.html`。

本輪只做原始碼及既有量測檔的靜態診斷，未改程式、未 build、未起 server、未 commit／push，也未重新執行瀏覽器量測。以下修改與測試是交給執行者的下一輪指令，不代表已完成。

採用的前提：以 HANDOFF 六之五、六之四為規格，以 `cards-remade.html` 的生成來源作為卡池卡展示參照；`demo.html` 提供共用 CSS，但其中殘留的歷史規則不自動等於凍結規格。成功標準是同一張卡在同尺寸、同姿態下具有一致卡面結構、幾何與字級關係，抽卡揭曉後仍只追蹤材質光影。

## 1. 結論及證據

根因是「只共用 CSS，沒有共用卡面 DOM、尺寸計算與背景」，並且抽卡 UI 又蓋回舊圖窗。不是一個單純的整卡縮放問題，也不能只改稀有度下限就結案。以下行號以本輪讀到的檔案為準；路徑未另註者都在 `_art/holo-test/`。

### 1.1 稀有度的固定下限直接破壞比例

- `build_deluxe_b.py:242–246`：比例已是 `13.5/290`，但 observer 又用 `Math.max(9,w*RARITY_SHARE)`。102px 時應為 4.748px，卻被拉到 9px；卡名只約 8.441px。
- `measure-gacha.json` 四筆均為 `nameFs:8.4`、`rarityFs:9`、`gemFs:7.74px`，支持此因果。實測卡寬有取整，不能要求其字級剛好等於用整數 102 重算的值。
- 展示頁不是完全正確的字級範本：`build_cards_remade.py:98–103` 用 10.5px 下限，`demo.html:678–683` 用 7px 下限，三處各自決策。照抄 10.5px 到抽卡會更糟。
- 該 JSON 的 `rarityOverflow`、`nameOverflow` 全為 false；稀有度文字寬只有 35.5–38.1px，`plateInner` 為 68px。因此能證實「主次倒置」，不能宣稱這四筆已測到文字溢出或真的撐滿整條框。

### 1.2 抽卡頁以更高 specificity 蓋回舊圖窗

- `build_deluxe_b.py:18–21` 抽取 demo 的 style（排除 baseline template）；但插入之後又在 `:119–121` 寫 `.slot .kind-framed .art-media{inset:0 6% 20% 6% !important}`。
- `demo.html:905–913` 的新規則是 `.kind-framed .art-media`、`inset:1.7% 2.4% 3.3% !important`。兩邊都有 `!important`，抽卡規則多一個 `.slot`，又出現得更晚，確定獲勝。
- 更糟的是圖片仍沿用新規則的 `max-height:82.5%` 與 translateY，結果是「舊小圖窗 × 新圖片限制」的混合版面。圖窗高度從 95% 縮成 80%，內圖高度再受 82.5% 限制；實測圖窗高約 .792、圖高約 .654，符合這個方向。
- 實測圖窗 x 約 .064、w 約 .872，接近舊規則的 x .06、w .88，差額還含圖層 scale 與透視。不能拿 transformed rect 的 .064 直接當 CSS inset。
- 新 inset 上下相加後，未變形圖窗高度是 **95%**，不是 96.6%；`demo.html:902` 的歷史註解不是計算依據。

### 1.3 framed 卡缺少獨立文字層，文字實際落在背板深度

- `build_deluxe_b.py:230–234` 雖建立 `text`，只有 scene／bleed 才 append；framed 走 else，把 name、rarity 放進 `.face-plate`。四筆 JSON 的 `text:null` 與此吻合。
- `build_cards_remade.py:151–156`、`demo.html:653–657` 已對所有卡型統一 `.face-text`。
- `demo.html:876–877` 的背板為 `--zp+1`，也就是 13px；`:961–965` 的 framed 文字層為 `--zp+28`，也就是 40px。缺 DOM 使這些文字層規則根本無從套用。不能用提高背板 Z 來補救。
- 量測中的背板 x .038、w .924、h .164 本身不是錯誤證據：CSS 4.4%／91.2%／16.2% 經 13px Z 的透視後會稍放大。不能把 CSS 改成 left 3.8% 來追這筆投影數字。

### 1.4 抽卡沒有卡名 fitting；展示頁的兩份 fitting 也未完全一致

- `build_deluxe_b.py:243–246` 只設變數，沒有安全寬度量測與縮字。
- `build_cards_remade.py:105–115` 已用 `Range`，並考慮背板內緣、寶石右緣；但 `Math.max(24,...)` 是額外固定下限，且 `fs*=.93` 可一步跨過 55% 下限。
- `demo.html:685–690` 仍以 `scrollWidth` 量測、只看背板寬；還在 name 元素設局部 `--name-fs`，之後只更新 card 的同名變數，局部值會遮住繼承值。不能直接複製這版 fitting。
- 現有四筆名字文字寬皆 18px，沒有長名樣本，也沒有 id；這批資料不足以證明長名安全。

### 1.5 背景不一致是獨立、確定的差異

- `build_deluxe_b.py:26–27` 呼叫 `pool(with_palette=False)`，`:223–225` 非場景背景只加 floor 與材質。
- `build_cards_remade.py:26–27` 用 `pool(with_scenes=False)`，預設帶 palette；`:45–62` 有人物同色背景 CSS，`:137–141` 設四個 `--pal-*`。
- 所以即使修好字級與圖窗，framed 卡在抽卡仍會顯示 demo 的稀有度通用背景（`demo.html:847–852`），不會自動變成 cards-remade 的同色背景。這是背景／質感差異，不是人物尺寸的直接原因。

### 1.6 卡小的原因在十連容器配置

- `build_deluxe_b.py:287–295`：十連 `cw=min(118,stage.width/8.4)`，排列卻是每排 5 張、兩排，gap 為 `.16*cw`。5 張總寬只用 `5.64*cw`；寬度未達上限時，約只用舞台寬 67.1%。
- 展示頁 `build_cards_remade.py:37` 的網格最小欄寬是 230px，原本就不是與十連等尺寸比較。102×143 約為 5:7，並非比例壓壞。
- 決定：本次先在 102px 修復卡面比例與一致性，**不把放大十連卡片當必要修法**。如果使用者要十連文字達較高可讀尺寸，再另調 layout；不能只把稀有度硬拉到 9px。不要擅改舞台、抽卡流程或新增放大檢視功能。

### 1.7 不是「整套 Z 都沒更新」，也不是單純忘了重建

- `demo.html:919–944` 最新寶石 42px、framed／flat 圖層 6px 已在共用 CSS 中；`paintFoil()`（`build_deluxe_b.py:262–275`）已把角度及圖層位移設為零。真正缺的是 framed 文字 DOM，加上局部 CSS 回蓋。
- 產物 `deluxe-gacha-b.html:441`、`:554`、`:566` 也確實含舊 inset、plate.append 與 9px 下限。只重跑目前生成器仍會產生同樣錯誤。

## 2. 下一輪執行順序與修改範圍

順序：抽出最小共用卡面 → 三個入口接同一份 → 移除抽卡舊覆寫 → 統一尺寸及 fitting → 生成產物並驗收。不要重寫 UI、抽卡機率、素材或經濟層。

### A. 統一卡面建立器，不再維護三份 DOM

新增 `card_face.js`，只負責 `createFace(data,masks)`、材質 DOM 與卡面尺寸 fitting。回傳 `.hcard`；場景資產、一般圖片、mask 路徑保持現行規則。不要把抽卡狀態、展示頁操作、翻面、卡背或 captions 放進這個檔案。

共同 DOM 固定為：

```text
.hcard > .card-lift > .card-inner > .card-face
  .face-stock
  .face-depth-bg（場景背景或人物同色背景 + 材質）
  .face-art > .art-media（img；非 flat 才可有 subject-mask）
  .face-frame > .frame-material
  .face-plate（背板，不含名字／稀有度）
  .face-gem
  .face-text > .face-name + .face-rarity
```

修改入口：

1. `build_deluxe_b.py` 的 `makeFace()`（213–239）：改成共用建立器的薄包裝，保留初始化及 observer 註冊；取消 scene／bleed 分岔的文字 append。直接使用 `d.kind`，不再以 `scene/bleed` 重算卡型。補 `data-id`、`data-rarity`、`data-art-kind`，供驗收識別。
2. `build_cards_remade.py` 的 `build()`（133–167）：只保留 cell、hit、cap、事件與展示姿態；用共用建立器產生卡面。既有舊版對照卡的特殊資料由呼叫端傳入，不能污染一般卡池規則。
3. `demo.html` 的 `makeCard()`（641–661）：使用同一建立器；保留記錄、背面、鍵盤與翻面操作。展示頁既有 data id 前綴由 wrapper 設定；舊版比較卡不改成一般卡池樣本。一般卡池卡型透過資料 adapter 對應 `pool_data.py` 的規則。

`card_face.js` 採傳統 script，兩支 Python 在建置時讀文字並內嵌，demo 用相對 script 引入；`build_round5_standalone.py` 必須同步將此 script 內嵌，避免搬到別處後失效。不用 fetch／XHR／ES module import，不增加框架或通用元件平台。

### B. 同步背景；移除抽卡對卡面幾何的覆寫

- `build_deluxe_b.py:27` 改為 `pool()`，讓 palette 隨資料進來。
- 將 `build_cards_remade.py:45–62` 的人物背景規則移入 demo 的共用卡面 style 區（baseline template 之外），原處移除；共用建立器設定相同四個 palette 變數及現有 fallback 值。這樣兩支 Python 現行 CSS 擷取方式就會取得相同背景，不再複製一次。
- 刪除 `build_deluxe_b.py:119–121` 的整條 `.slot .kind-framed .art-media` 覆寫。不要在抽卡頁再追加一條反向 `!important` 補丁。
- `demo.html` 的 `round18-geometry` 作為幾何修正位置；圖窗保持 `1.7% 2.4% 3.3%`，plate 和 text 對所有三種卡型統一 `left/right:4.4%;bottom:3.4%;height:16.2%`。目前 depth plate（797）、depth／flat text（799）仍有 5%／4%／16% 舊值，應在這個共用區明確收斂，不能聲稱三型已全部一致。
- framed 圖片先保留展示頁現有 `:910–913` 的 82.5% 與位置公式，配合恢復完整圖窗驗收；這個百分比是人物可用高度限制，不能直接改為 100% 高讓人物鋪到卡底。以卡頂到 plate 上緣的置中目標檢查；不得另裁圖或放大圖片掩飾錯誤圖窗。
- 寶石保持 `left:calc(5% + var(--gem-fs)*.62)`、`bottom:calc(12% - var(--gem-fs)/2)`，保持既有形狀與字效。
- flat／bleed 保持指定 scrim `linear-gradient(to top,#070b12d9,#080d16a6 52%,#0a101c40)`、外框、上緣細線、圓角。不要只看 `.face-text` 有透明漸層：下方 `.face-plate` 仍可能有近乎不透明的舊背景（demo 863–869）；必須消除重複深色底造成的黑條，令實際合成結果能透出卡圖。scrim 放在獨立背板，文字層不重複塗底。

### C. Z 的處理：保留已生效的低深度，不重演推高修補

固定 `--zb:2px;--zf:8px;--zp:12px`；plate 為 13px，text 為 40px，gem 為 42px。背景／圖層／背板／文字／寶石 z-index 為 10／30／20／200／210；文字層下的 name／rarity 不再另外加 Z。檢查最終 computed transform，不能只搜尋仍被覆蓋的 100px／160px 歷史宣告判定失敗。

**規格矛盾需明記：** HANDOFF 六之四與六之五「卡型」寫 flat 圖層 Z=0／不推 Z；六之五 Z 表及 demo 最後生效的 `:940–944` 卻都寫 framed／flat 6px。這兩項不可能同時通過數值驗收。

本次對齊展示頁的執行裁決：先維持 framed／flat 的固定 6px（介於背景 2px 與卡框 8px），flat 不做圖內位移、不掛 subject-mask；不要直接降成 0 讓背景再蓋住圖。這不是宣稱 6px 符合「Z=0」文字，而是明確保留現行展示基準。若後續指定字面 Z=0，需另處理 flat 背景可见性／層次並驗收，不能把它混入本次必要修補。此矛盾應在交付時列為待使用者裁定項。

depth 保留原場景主體深度設計；不是把所有主體都設 6px。所有層以約 42px 為上限，不把任何層推到 70／106px。`paintFoil()` 保持 rx/ry=0、ax/ay/bx/by=0，只更新材質參數；展示頁的傾斜事件仍由展示 wrapper 負責。現有 hover 整體縮放及揭曉動畫不在本次擅改範圍，量測時需排除它們。

### D. 共用 ResizeObserver 與 fitting

移除 `build_deluxe_b.py:242–246`、`build_cards_remade.py:98–115`、`demo.html:678–690` 三份尺寸／fit 實作，改呼叫共用函式：

1. 用 observer 的未變形 content width 計算 `N0=w*24/290`、`R0=w*13.5/290`、`G=w*22/290`。移除 rarity 的 9／10.5／7px 下限，以及 gem 的 6／7px 下限，不改比例常數、不使用 vw。
2. 變數只設在 card；清除舊 `.face-name` 局部 `--name-fs`。每次重新量測先重置 N0，再做縮字，讓卡變大時能恢復。
3. 以卡中心、背板內緣及寶石右緣算安全寬度；左右都檢查，寶石側沿用展示 fit 的 `w*.02` 留白。可用半寬取「中心到左內緣、中心到右內緣、中心到寶石右緣加留白」三者最小值，安全寬為其兩倍。不得用 `Math.max(24,...)` 假造可用空間。
4. 用 `Range.selectNodeContents(name)` 量實際文字。每次 `fs=max(N0*.55,fs*.93)`，直到放得下或已到 55%；不可跨過下限。到下限仍放不下就記錄驗收失敗，不無限縮小、不隱藏／裁掉文字假裝成功。
5. 量測與安全距離要在一致座標空間進行。fitting 在中立姿態及動畫完成後計算；外層 scale 與 Z 投影存在時，不要混用 transformed rect 距離和未縮放 padding。以同一比例轉換所有距離，或在未變形量測容器計算後套回。實際畫面另驗證文字与寶石不相交。
6. 字型載入完成後重新 fit；卡寬改變、重新附加卡面後重新 fit。移除卡片時 unobserve，避免共用 observer 持有已收下的卡。

## 3. 102px 小卡的字級下限裁決

**不設定獨立的固定 px 可讀下限。** 在 102px、未縮名狀態，預期值如下（允許因實際 content width、兩位小數捨入產生小差異）：

| 項目 | 計算值 |
|---|---:|
| 卡名 N0 | 8.44px |
| 稀有度 R0 | 4.75px |
| 寶石 G | 7.74px |
| 卡名最低 55% | 4.64px |
| 未縮名 rarity/name | 0.5625 |

僅刪掉 9px 下限仍有一個極端衝突：名字真縮到 55% 時，4.75px 的稀有度仍略大於 4.64px 的卡名。因此「稀有度永遠固定 R0」「名字允許 55%」「稀有度永遠小於卡名」無法三者並存，不能漏報。

給下一輪的**建議修訂**是：長名完成 fitting 後使用 `Rfinal=min(R0,Nfinal*13.5/24)`，使主次比例始終一致；短名不受影響。這是對凍結字級公式增加長名例外，須在執行前取得使用者明確採納，不能假稱原規格已授權。未採納之前，先做本報告其餘無爭議修復、保留 R0，將縮到低於 R0 的長名列為未通過，不能自行抬高 55% 或偷縮稀有度。

如果要求稀有度至少 9px，純比例所需卡寬至少 `9*290/13.5≈193.33px`；這是容器空間的需求，應另決定十連排法，無法靠單一字級下限免費達成。

## 4. 修改檔案清單與結構裁決

要一起處理重複結構，但只抽本次已證實會漂移的部分：

| 檔案 | 指令 |
|---|---|
| 新增 `card_face.js` | 共用前面 DOM、材質、palette 設定、尺寸與 fit |
| `build_deluxe_b.py` | makeFace 改 wrapper、帶 palette、刪舊圖窗、共用尺寸 |
| `build_cards_remade.py` | build 改 wrapper、移出背景 CSS、共用尺寸 |
| `demo.html` | makeCard 接共用建立器，收斂卡面幾何／scrim，移除舊尺寸实现 |
| `build_round5_standalone.py` | 將新增共用 script 內嵌到 standalone |
| 新增 `check_gacha_card_regression.py` | 固定卡資料、跨頁等尺寸比較與真實抽卡流程驗收 |
| `cards-remade.html`、`deluxe-gacha-b.html` 及相關 standalone | 下一輪由生成器輸出，禁止只手改產物 |

`pool_data.py` 保持資料唯一來源，本次不用改它。demo 是手寫頁面中的第三份 JS，不是另一支同名 Python 生成器。不要趁機清光所有歷史 CSS；只移除會與本次契約衝突的規則。獨立 script 的引入與內嵌邏輯必須一起交付，不能只讓其中兩個入口共用。

## 5. 做完後必須提交的驗收證據

以下只供下一輪執行。本轮未執行這些命令。

### 5.1 先生成，再跑既有展示回歸

依更新後依賴順序產出 demo standalone、cards-remade、deluxe-b 與其 standalone；使用既有 `build_round5_standalone.py`、`build_cards_remade.py`、`build_deluxe_b.py`、`build_deluxe_b_standalone.py`。再執行：

```powershell
$env:PYTHONIOENCODING='utf-8'
python _art/holo-test/check_demo_round8.py
python _art/holo-test/check_demo_round9.py
python _art/holo-test/check_gacha_card_regression.py
```

既有 round8／9 是展示頁回歸：圖資、65 張展示卡、字效、置中、寶石對比、層次、邊界與離開後 rAF 等；**它們通過不代表抽卡頁通過**。既有腳本若失敗，交付實際 assertion 與原因；不得弱化門檻來換綠燈。standalone 必須搬到臨時目錄驗證，不得只在原資料夾測到旁邊的共用 script。

### 5.2 新增針對本次故障的 Playwright 檢查

- 用 `file://` 開啟，不需 server。等待圖片、字型、observer 及全部揭曉動畫完成；游標移開卡片後記錄中立狀態。JSON 記錄 viewport、deviceScaleFactor、未變形卡寬、外層 scale、card id、kind、rarity、名稱及對應頁面，不能再有 id:null。
- 固定資料覆蓋全部 47 張抽卡池卡（43 張有圖 CATALOG + 4 張場景）；包含兩張 flat、toy 圖、長名字和五稀有度。測試 fixture 從既有 pool 資料讀取，不改正式隨機抽樣結果或機率。展示頁中故意錯誤的舊版 depth 對照組另列，不拿來當正確基準。
- 至少在 102、150、230、290px 寬及一個低於 102px 的尺寸（例如 80px）量同卡；cards-remade 與 gacha 的 43 張逐張比較，四張場景和 demo 比較。固定 content width、相同字型與中立姿態，不能拿大展示卡與小抽卡卡片直接比像素。
- 每張恰有一個 `.face-text`、其中各一個 name／rarity；`.face-plate` 不含文字；flat 無 subject-mask；卡名、稀有度、kind 與 pool 一致。
- CSS 幾何檢查使用未變形佈局：art inset 為 1.7/2.4/3.3%，plate／text 為 4.4/4.4/3.4/16.2%；最終 rect 另做跨頁比較，對同樣設定允許最多 1px 差。不把 `.024/.952` 當作有透視時必須精確相等的 rect。
- 102px 短名要得到約 8.44／4.75／7.74px；依實際 w 計算預期，容許 0.05px。驗證 fitting 可在縮小後恢復，不存在 name 的局部變數遮蔽。長名以 Range 測安全寬、實際無寶石碰撞；55% 邊界與字級例外按第 3 節裁定分別報告。
- 文字與稀有度相對卡中心偏差 <2px；plate／text／gem／name／rarity 矩形不超出卡緣 1.5px；無水平或垂直溢出。文字行高、固定 gap 5px 加總若在小卡造成高度問題，列實測失敗再處理，不先憑猜測更動凍結外觀。
- 檢查 computed Z 與 z-index，並用截圖確認人物、框四角、名字都可見。framed 圖片在恢復圖窗後應與同尺寸展示頁一致，不能只斷言 img DOM 寬高，透明 PNG 的實際人物留白需看圖。
- flat／bleed 截圖放大檢查 scrim 下可見圖案；legendary 亮金 `#fff45c`，mythic conic 隨 phase 改變，白字卡名沒有被改成彩色效果。保留 round8 的寶石對比度門檻，不因小卡另任意放寬。
- 真實點擊單抽、五連、十連，分別測正常揭曉與全部揭曉、收下、重抽及 resize；確認卡數、圖資與 console 無錯。既有事件或動畫問題若被測出，另記錄，不能悄悄擴大本次修補範圍。
- hover 時抽卡 rx/ry 與圖層位移仍為零，材質座標／phase 有變；展示頁仍可傾斜。既有 slot 的整體 hover scale 要從圖層位移量測排除，不誤判為違反光影追蹤。

### 5.3 交回的最小成果

提供修改 diff、每個檢查的實際退出碼與失敗摘要、`measure-gacha-after.json`、同卡同尺寸展示／抽卡對照截圖，以及十連結果全景。保留原 `measure-gacha.json` 作 before。只有新量測及截圖真的支持才能宣稱修好；flat Z 的文件矛盾與長名公式若未裁定，須保留為明示限制，不能寫「完全符合凍結規格」。
