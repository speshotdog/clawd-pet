# 抽卡卡面驗收：57a9887

日期：2026-09-09。依據：`REPORT-gacha-card-regression.md`，受驗 commit：`57a9887122e35794b0e8f96001bfd786d7092524`。

**裁定：主要修復做對了，但尚不能整體結案。** `cards-remade.html` 的 43 張正式卡池卡與抽卡頁，在五種相同尺寸下，215 組的所測幾何與 computed styles 完全一致。四張場景卡與 demo 的小尺寸字級仍不同；demo 還發生 palette 背景失效，展示單檔版也未同步。共用函式確實解決了兩個主要入口的漂移，但不能推論所有頁面、尺寸重算與生命週期都已一致。

這輪只寫測試、證據與本報告；未修改 `card_face.js`、建置腳本、`demo.html` 卡面實作，未 commit／push。建置與舊測試產生的既有檔案改動在保存證據後還原，避免把驗收副作用混入你的修改。

## 1. 逐條對照原指令

| 原指令 | 判定 | 實際結果／下一步 |
|---|---|---|
| A：共用卡面 DOM、材質、palette | 做到兩個入口 | `card_face.js` 建立前面；兩支生成器內嵌並呼叫它。215 組跨頁量測支持成果。不是只有靜態看見函式名稱。 |
| A：framed 補獨立 `.face-text`；plate 不放文字 | 做到 | 235 組抽卡卡面結構失敗 0；flat 無 subject-mask。id、kind、rarity 有值。 |
| A：展示 wrapper 保留事件、舊版比較卡分開 | 做到 | 測的是 `#grid` 正式卡池，沒有拿 `compare-depth` 當標準。比較卡仍分開。 |
| A：demo 的 makeCard 也接共用建立器 | 未做 | `demo.html:641` 仍自己拼 DOM；679、685 仍有自己的 observer／fit。需要做，安全方式見第 5 節。 |
| A：demo standalone 內嵌共用 script | 未做 | demo 尚未引入，`build_round5_standalone.py` 也沒有新 script 的內嵌邏輯。現在 portable 能跑不等於這項完成。 |
| B：抽卡使用 `pool()`，背景 CSS 搬到共用區 | 兩主頁做到；demo 有回歸 | 兩主頁拿到 palette；demo 不設 palette 變數，新的含 `var(--pal-*)` 宣告使背景失效，實测 `pool-foxfriend` 背景為 `none`。 |
| B：刪掉 `.slot .kind-framed .art-media` 舊覆寫 | 做到 | 102px 圖窗 left/right 2.4375px、bottom 4.70312px，符合 2.4%／3.3% 的佈局取整；與同尺寸 remade 完全一致。 |
| B：三型 plate／text 收斂到 4.4／4.4／3.4／16.2% | 未做完 | framed 已對齊；depth plate/text、flat text 仍是 5／5／4／16%。詳見第 3 節。 |
| B：人物 82.5% 限制、寶石公式保留 | 做到 | 同尺寸 framed 圖片 rect／transform 一致；102px 寶石字級變數 7.74px。已看人物與四角截圖。 |
| B：flat scrim 移到唯一背板，消除黑底重疊 | 未做 | plate 仍是 alpha .97～.99 深底，text 又畫一次 scrim；兩頁一致地保留這個問題。 |
| C：背景／框／plate／text／gem 低 Z | 大致做到 | 抽卡 plate/text/gem 分別 13／40／42px；framed/flat 圖 6px；四場景主體 26～36.4px。depth text 的 z-index 仍為 60，非指定 200。 |
| C：抽卡 hover 只追材質 | 做到受測流程 | 12 個流程的 hover 探針保留 rx/ry、ax/ay、bx/by 為零；phase／glare 改變。整卡 hover scale 另算。 |
| D：移除三份舊 observer／固定下限 | 未完全做到 | 共用 observer 已生效；抽卡 `build_deluxe_b.py:223` 還留一個含 9px／6px 下限的 observer，但沒有 observe 呼叫，屬這次改動留下的死碼，**不是仍在覆蓋字級**。demo 舊 observer 仍生效。 |
| D：Range、安全寬、55% 下限、可恢復 | 核心做到 | 真實卡池 235 組 `nameFits=false` 為 0。超長名停 55%、誠實標 false；同一 DOM 80→290 能恢復，換短名回 24px。 |
| D：只用未變形 content width | 有錯 | `refit()`（169 行）用 transformed rect 寬。102px 卡外層 scale=1.13 時算出 name 9.54、rarity 5.37px，應是 8.44、4.75px。 |
| D：字型完成／揭曉後中立姿態重算 | 部分做到 | 有 `document.fonts.ready`，但走上述錯誤 refit；揭曉後只 paint，未明確再 fit。10 張正常抽樣中，手動中立 refit 未改變字級，故不宣稱已測出普通名字的動畫縮字故障。 |
| D：移除卡面時 unobserve | 未接線 | 有匯出 unobserve，但收下的 handler 沒呼叫。實測收下十張後仍追蹤 10 個 detached 卡節點。 |
| 第 3 節：長名 rarity 跟 name 同比縮 | 採納此做法 | 符合本次「同一套外觀」要求；本輪裁定保留，不要求回退或再問一次。前報告曾要求事前明確採納；commit 所引原話不是該程序已完成的證據，但這不是現在要返工的視覺缺陷。 |
| 第 4／5 節：全部產物、固定資料跨頁測試 | 原提交缺漏；本轮補證據 | 原 commit 沒有新跨頁測試；`cards-remade-standalone.html` 仍不含共用建立器。這輪新增測試並實跑，沒有替你改生成器。 |

## 2. 實跑方式、數字與退出碼

Windows／Python／Playwright Chromium **149.0.7827.55**；`file://` 開啟，viewport **1512×1000**、deviceScaleFactor **1**，實際流程另 resize 到 **1100×800**。沒有啟 server、沒有改抽卡機率或正式 pool。

固定 fixture 從 `pool_data.pool()` 取得：43 張 CATALOG + 4 場景，包含兩張 flat、toy、五稀有度。測試在真實抽卡第一次建立卡面時捕捉 resolver／masks，固定比較使用頁內已內嵌的建立器；展示側用該頁已產生的真正卡節點。僅將 wrapper 放到一致座標、設相同寬高與中立姿態，沒有用測試 CSS 修補內部卡面。這部分驗證卡面；完整抽卡事件另以真實按鈕驗證。

等待字型、圖片解碼及 observer/rAF 後量測，固定 content width 為 **80、102、150、230、290px**。每組記錄頁面、id、kind、rarity、名稱、外層 transform/scale、15 個元素的 rect 與 23 個 computed style 欄位、Range 寬度、寶石間距、置中與邊界。

| 實際執行命令（下列檔案均在 `_art/holo-test/`） | Python 退出碼 | 結果 |
|---|---:|---|
| `python build_round5_standalone.py` | 0 | embedded=15，3,759,759 bytes；重建補進新 CSS，但沒有共用 JS。 |
| `python build_cards_remade.py` | 0 | 正式卡池 43 張，頁面另有 2 比較卡。 |
| `python build_deluxe_b.py` | 0 | 47 張 pool。 |
| `python build_deluxe_b_standalone.py` | 0 | 51 個卡圖資產，4.47 MiB。 |
| `python check_demo_round8.py` | 0 | dev、暫存目錄 standalone 各 65 張；原寶石對比門檻 35 未改，失敗 0；離開後 rAF 檢查通過。 |
| `python check_demo_round9.py` | 0 | dev、暫存目錄 standalone 各 65 張／43 pool，console error 與外部請求 0。 |
| `python check_gacha_card_regression.py` 第一次 | 1 | 十連快轉後 `#finish` hidden，click 等待 30,000ms timeout。保留原 traceback。 |
| 同一跨頁腳本，補上失敗記錄與逐段保存後重跑 | 1 | 235 組，20 組嚴格 styles 比對失敗（全為 demo 場景參照）；12 個真實流程本次均可收下。沒有調鬆比對門檻。 |
| `python check_gacha_followup.py` | 0 | **診斷輸出成功，不是全部斷言通過**：記錄 detached=10、超長名放不下及恢復结果。 |
| 額外 Python/Playwright 頁面探針、截圖命令 | 0 | 記錄 demo palette 失效、舊 remade standalone 狀態，以及等待中立後的十連全景。 |

完整退出碼彙整在 [all-exit-codes.json](../../_art/holo-test/verify-gacha/all-exit-codes.json)；建置與原測試輸出在 [commands.json](../../_art/holo-test/verify-gacha/commands.json)、[cross-page.log](../../_art/holo-test/verify-gacha/cross-page.log)、[首次錯誤日誌](../../_art/holo-test/verify-gacha/cross-page-first-attempt.log)、[followup.log](../../_art/holo-test/verify-gacha/followup.log)。表內是 Python 的 `$LASTEXITCODE`，不是最後 `Get-Content` 所在 PowerShell 的退出碼。

### 同卡同尺寸結果

| 比較 | 組數 | 幾何最大差 | 所選 styles |
|---|---:|---:|---|
| remade 43 卡 × 5 寬 → gacha | 215 | **0px** | 0 差異 |
| demo 4 場景 × 5 寬 → gacha | 20 | **34.03675px** | 20 組有差異；其中 8 組 rect 差 >1px |

「20 組 styles 不同」包含無文字容器繼承的 font/color，不能解讀為 20 組都有明顯視覺錯誤。四場景在 230／290px 的所測 rect 與 name/rarity 字型樣式一致；80／102px 是實際字級差，150px 只有 7 對 6.98px 的稀有度下限差。

例：宇宙冒險羊 102px，兩頁 name 都 8.44px，但 demo rarity **7px**、gacha **4.75px**；rarity rect 寬 **56.2812 vs 38.2031px**，投影 rect 最大差 **18.83336px**。80px 的 demo gem 下限也是 7px，gacha 為 6.07px。

抽卡 235 組：結構失敗 **0**、破圖 **0**、正式卡池縮名失敗 **0**、name/rarity 中心最大偏差 **0.00815px**、五個受檢框元素超出卡緣量 **0px**、Range 名字到寶石右緣最小距離 **7.82917px**。102px 短名計算得到 **8.44／4.75／7.74px**，沒有舊下限回蓋。

保存 5 張代表卡 × 5 寬的 **25 對截圖**（兩張 flat、傳說 framed、common toy、mythic scene）。一般卡池的 20 對截圖 RGB 平均絕對差 MAE 是 **0.003018～0.062500／255**；並非每個像素完全相等。抽查 dino 80、foxfriend 80、mieshi 102 的單通道最大差為 2／255，未測到 >2 的差值。這是極小光柵／合成差，不能據此說卡面幾何仍跑版，也不能宣稱逐像素零差。場景 rocketdog 102 的 MAE 為 **2.200949／255**，最大單通道差 **163**，有 **1,359** 個像素差 >2，稀有度大小差有實際圖像證據。

已人工看過 [290px 五對比較圖](../../_art/holo-test/verify-gacha/comparison-290.png) 與 80px flat 原圖；人物、框四角、名字可見，flat 底部深色橫條也可見。中立十連全景另存 [ten-pull-neutral.png](../../_art/holo-test/verify-gacha/ten-pull-neutral.png)。`ten-pull-False.png` 等早期流程圖截到 pointerleave 的 scale 過渡，不拿它們當中立比較證據。

### 長名、縮放與實際流程

- 超長 fixture 使用同一卡面、只更换測試名稱：290px 基準 name 24px，停在 **13.20px（55%）**，rarity **7.43px**；Range **348.19708px**、安全寬 **176.84456px**，`nameFits=false`。這是故意超出容量的測試，不是正式 pool 失敗。80px 停 **3.64px**，回 290 恢復 13.20；改回「小恐龍」則 **24／13.5px**、fits=true。
- 真實十連另外量測，完成動畫後手動中立 fit，**10 張字級改變 0 張**。這支持目前普通 pool 名字可用；不證明所有載字型／動畫時機安全。
- `refit()` 的縮放探針：content width **102px**、外層 scale **1.13**、rect width **115.26001px**，name **9.54px**、rarity **5.37px**。這是確定的 API 錯算，證據在主 JSON 的 `scaledRefit`。
- 第二輪共 **12** 流程＝本地／搬走的 standalone × 單／五／十抽 × 正常／快轉；共量 **64** 張真實抽出卡，卡數正確、破圖 **0**、console/page errors **0**、failed request **0**、收下 **12/12**。每次均測 resize、hover、收下後再抽。
- hover 例：phase **120→97.20285deg**、glare **.135→.36**，六個角度／位移變數維持零。JSON 保存每次結果。
- **第一次十連快轉無法收下不可抹掉。** 第二輪未再出現，屬時序性未結問題。程式 `cascade()` 在 `cascading=false` 後僅於 `!skipped` 呼叫 finishReveal；若各 revealOne 最後一次 updateFinish 早於 cascade 結束，按鈕可能一直隱藏。這是源碼支持的原因推斷，未在本輪修改流程。

## 3. 尚未處理、會造成不同外觀或不符指令的項目

1. **demo palette 是這次搬 CSS 造成的回歸。** `round25-palette-bg` 使用無 fallback 的變數，demo makeCard 沒有設它們。`pool-foxfriend`、`pool-mieshi` 的背景 computed 為 `none`；round8/9 不檢查此屬性，仍會綠。不要把「demo 沒改 makeCard」等同「demo 外觀沒改」。
2. **demo 的正式 pool 還把 flat 算成 framed。** `pool-mieshi` 實測 kind=framed，而 remade/gacha=flat。保留舊版對照組合理；正式 pool 的這個錯誤不能作為永久基準。
3. **共用 CSS 仍未完成三型契約。** 102px 時 depth plate/text left=5.09375px、bottom=5.70312px、height=22.8438px（5/4/16%）；framed plate/text 是 4.48438、4.84375、23.125px（4.4/3.4/16.2%）。flat plate 用新值、text 用舊值，兩層本身未重合。depth 的 art 是外層固定 inset 7px、內層 media inset 0；原報告把所有型的 media 都列同一 inset 過於簡化，不能硬改內層造成雙重 inset。下一輪若收斂，應在共用 CSS 對「最終有效圖窗」一次定義並保留場景主體 Z，不要疊加兩次內縮。
4. **flat 黑條仍是兩層疊底。** plate `linear-gradient(140deg,rgba(22,27,38,.97),rgba(17,24,33,.99))`；text 又畫指定 scrim。照前報告，把同一個 scrim／邊框留在獨立 plate，text 透明，並在兩頁一起验，不能只刪文字層背景就聲稱修好。
5. **refit 與 observer 路徑不一致。** 改 `refit()` 使用與 ResizeObserver 同一未變形 content width（不可簡單換成含 padding/border 的寬），並在中立、動畫完成時測長名。font-ready 也要走這個正確路徑。現在只改造型建構器不足以防止時機造成的不同。
6. **移除卡片前未 unobserve。** 在收下、重設及任何替換 fan 內容的路徑接上；移除本次留下的未使用 sizeObserver／helper。不要求清全檔歷史死碼。
7. **standalone 版本未齊。** `cards-remade-standalone.html` 搬到暫存目錄能顯示 45 張、破圖 0，但 `HoloCardFace` 不存在、正式卡缺 data-art-kind，是舊實作。四支既有建置命令沒有重建它。`demo-standalone.html` 本次重建比 commit 版本多出 20 行 palette CSS，表示 commit 中該產物也未跟進。補可靠的 remade standalone 生成入口，從最新 remade 產出。
8. **PNG 與 portable WebP 本來就不是逐像素同圖。** 兩支 portable 轉換採 360×504 thumbnail、quality=82 WebP。若「一樣」包含跨 dev／portable 的逐像素完全一致，需要保留相同圖資 bytes／編碼；目前測到 portable 可攜與載入成功，不等於這項像素契約通過。
9. **flat 在展示頁 hover 仍有圖內位移。** 實際 hover remade 的 mieshi，ax/ay 從 0 變成 **−1.22826／−1.30595px**，computed art transform 也有該平移（[flat-hover.json](../../_art/holo-test/verify-gacha/flat-hover.json)，探針 exit 0）。共用 paint 只用 tiltOn 決定 shift，未排除 flat。抽卡 hover 為零是正確的，但前報告「flat 不做圖內位移」尚未全面實現。下一輪保留整卡 tilt、僅讓 flat 的圖內 shift 為零。

flat 圖層本輪繼續採 **6px**，與目前展示基準相同，不擅降 0；前報告指出的文件「Z=0」矛盾仍存在。不是把 6px 寫成符合字面 Z=0。

## 4. 證據位置與驗收限度

- [完整逐卡量測 measure-gacha-after.json](../../_art/holo-test/verify-gacha/measure-gacha-after.json)
- [生命週期與長名 followup.json](../../_art/holo-test/verify-gacha/followup.json)
- [demo／舊單檔版探針 extra-pages.json](../../_art/holo-test/verify-gacha/extra-pages.json)
- [跨頁測試](../../_art/holo-test/check_gacha_card_regression.py)、[後續診斷腳本](../../_art/holo-test/check_gacha_followup.py)
- [證據目錄](../../_art/holo-test/verify-gacha/) 包含逐卡 PNG、基準副本、舊測試實際輸出；原 `measure-gacha.json` 未覆蓋。

幾何/字級/結構全 47 張覆蓋，像素比較是上述 25 對代表截圖，不是全 235 組截圖。既有寶石對比 35 的測試只在原 demo 規定尺寸通過；没有宣稱 80px 全卡也逐顆通過對比門檻。沒有跨瀏覽器、不同作業系統字型、所有可能動畫／字型載入競態驗證。這些限制不影響本輪已量到的通過或失敗。

## 5. demo 要不要接共用建立器：要，但不要抹掉歷史基準

**正式卡面要接；六十五張展示樣本的用途與舊版錯誤對照要保留。** 不必為了接共用建立器重寫 demo UI，也不必把歷史比較卡全部改成正確卡型。

下一輪按此順序做：

1. 以本輪保存的 `baseline-demo.html`／`baseline-demo-standalone.html`、round8/9 輸出與截圖保留舊基準。它們是歷史證據，不把其中已知錯誤提升成新規格。基準 dev HTML 需仍從原素材根解析，不直接把資料夾移走後的破圖當回歸。
2. 讓 demo 的正式 pool／四場景用資料 adapter 接 `pool_data.py` 對應資料，傳入正確 kind、palette、file、scene；建立器只造正面。`makeCard` wrapper 繼續管 data-id 前綴、record、卡背、鍵盤、翻面、選取與展示設定。原始卡 id 先給 resolver，用完再加展示前綴。
3. 歷史假景深卡以明確 override 送入同一建立器；shadow-root 的真正舊版卡基準維持原樣。不要用 id 特判污染正式 pool。demo 的控制項仍可調材質，但「預設、中立」要對齊共用 paint；特別不要讓原 demo 再把非場景 `za/comp` 寫成另一套。
4. 移除 demo 自己的正面 DOM／fit／observer，使用修正後的共用內容寬計算。接相對傳統 script，並同步修改 demo standalone 建置的內嵌及 asset resolver；不可只加入 `<script src>` 就交付。
5. 保留 round8/9 的 65 張、名稱、稀有度、互動、對比等斷言。**round9 現有「每張 pool 都必須 masked」斷言需要按正確 pool kind 改寫**：flat 必須無 mask、其餘依素材要求有 mask。目前它恰好放過誤標 framed 的兩張 flat；修正這條是更正測試語意，不是放寬門檻換綠燈。補 palette 非空/預期背景、kind 及新跨頁斷言。
6. 完成後重建所有產物，原回歸與本輪跨頁測試一起跑；四場景在 80/102px 也必須使用同一比例，正式 remade/gacha 的 215 組零幾何差不可退步。另針對快轉收下的時序問題交付獨立修復，不把它混成卡面外觀更動。

這樣既能保存 65 張基準的查核價值，也能終止第三份卡面邏輯繼續漂移。你本次先停在 demo 前來請驗收是合理的；但目前 demo 已受共用 CSS 搬移影響，不能以「保護基準」為由永久不接線。
