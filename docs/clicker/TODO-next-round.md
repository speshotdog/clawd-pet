# 下一輪執行清單：抽卡卡面收尾

日期：2026-09-09。任務 A，附任務 C 排查線索。依據 [驗收報告](REPORT-gacha-card-verify.md) 與當前 `fc71688` 源碼；本輪只寫文件，下面的修改、建置、測試均是**下一輪指令，尚未執行**。揭曉研究另見 [DESIGN-reveal-light-v2.md](DESIGN-reveal-light-v2.md)。

## 1. 先校正報告與現況

`REPORT-gacha-card-verify.md` 測的是 `57a9887`，不可把當時所有失敗當成現在仍未修改，也不能看見新碼就算驗收通過。

| 項目 | 當前源碼狀態 | 下一輪處理 |
|---|---|---|
| depth／flat plate/text 未收斂 | 仍在：`demo.html:797–799` 有 5/5/4/16%；`934–935,982–986` framed 是 4.4/4.4/3.4/16.2% | 修改共用有效 CSS，三型一起驗 |
| demo 未接建立器 | 仍在：`demo.html:641–661` 自建正面，未經 HoloCardFace | 正式 pool／四場景接共用建立器，保留 wrapper |
| 四場景小尺寸字級 | 仍在：`679–691` 自有 sizeObserver／fitName，rarity 與 gem 有 7px 下限 | 移除重複計算，使用共用 observe／fit |
| 正式 pool 把 flat 當 framed | 仍在：`673` 明寫 `art:{kind:'framed'}` | 改走 pool_data 的 kind |
| 十連快轉收下競態 | `build_deluxe_b.py:333–437` 關鍵結構仍在 | 獨立做終態與取消修復，保留首次失敗證據 |
| flat 雙重黑底 | 已有修碼：`demo.html:973–980` scrim 在 plate、text 透明 | 不重寫，驗實際 computed／截圖及產物同步 |
| refit 用 transformed rect | 已改：`card_face.js:169–176` 改 clientWidth | 驗 content width 契約、padding 與 gem 更新；不能直接當全修好 |
| flat hover 圖內平移 | 已改：`card_face.js:195` 排除 flat 的 shift | 驗 remade／demo 接入後均無圖內位移 |
| 收下未 unobserve | 已接：`build_deluxe_b.py:441` 收下逐卡 unobserve | 驗 reset、重建 fan、取消所有移除路徑 |
| remade standalone 無生成入口 | 已有 `build_cards_remade_standalone.py` | 用現有入口重建驗證，不再新增第二支 |

## 2. 執行順序

### A1 — 保存控制組與資料身分

- 保留 `verify-gacha/`、首次快轉失敗日誌及既有 baseline，不覆蓋歷史證據。另標示本輪起點 commit 與新一輪輸出目錄。
- 以 `_art/holo-test/pool_data.py` 的 `catalog()/pool()/SCENE_CARDS` 為正式資料來源。正式 pool 43 張、加四場景共 47 張；demo 保留 65 個展示樣本的用途，歷史比較卡不算正式 pool 基準。
- 將 `data.id` 裸 id、`data.file`、kind、scene、pal 傳给建立器與 resolver 後，再加 `pool-` 等展示 dataset 前綴。mask 鍵是裸檔名，不可用前綴 id 或完整路徑索引。

### A2 — 三型幾何收斂，僅修未符合凍結的部分

檔案：`_art/holo-test/demo.html` 共用樣式區（`round8`、`round10` 及後續覆寫，重點 `797–805,925–989`）。`build_cards_remade.py:19` 與 `build_deluxe_b.py:19` 從這裡擷取樣式，因此不要只修改生成後 HTML。

- 讓 depth／flat／framed 的 `.face-plate`、`.face-text` 最終均為 left/right **4.4%**、bottom **3.4%**、height **16.2%**；text 獨立，不能塞回 plate。修有效規則，勿再堆另一份入口專屬補丁。
- depth text 的有效 z-index 從 60 收回契約 **200**；背景 10、art 30、plate 20、gem 210。保留 translateZ：背景 2、框 8、plate 13、text 40、gem 42px；framed／flat art **6px**，depth 主體既有 Z 不動。HANDOFF 六之四「flat Z=0」與六之五 6px 有歷史矛盾，本輪沿六之五與驗收現況 6px，不另降 0。
- 先列三型「有效圖窗」外層＋media 的合成位置：depth 目前 `.face-art` 固定 inset 7px、`.scene .art-media` inset 0（`demo.html:15`），framed／flat 另有百分比 media。以凍結圖窗 1.7%/2.4%/3.3% 為目標時，只在一層承擔內縮，不能外層 7px 再疊同一份百分比。不要為修 plate/text 改人物裁切、subject 配準或推高 Z。
- 保留已有 flat plate scrim 修碼及寶石公式；framed 人物既有 82.5%／置中公式不順手調整。

交付驗收：同卡、同未變形寬 80/102/150/230/290px，在三頁比對 plate/text 最終位置與同層外觀，不能只比 CSS 宣告。原正式 pool 215 組幾何零差不得退步；四場景 20 組要收斂。保留框／文字／寶石邊界與原對比門檻。

### A3 — demo 接共用建立器：原報告六步仍成立，以下是更新後版本

1. **留基準。** 按 A1 保存目前與历史證據。baseline HTML 的素材根路徑須能解析；不把搬走後破圖算回歸。
2. **接資料。** demo 的 `poolData` 與 `sceneData` 由 `pool_data.py` 產生／注入一致資料；可在下一輪加一個小型 demo 資料更新入口，無須重寫整頁生成系統。`poolData.forEach`（673）移除強制 framed。兩張 bleed 為 flat，四場景為 depth，其餘按 catalog。palette 隨資料進入，不靠 CSS fallback 掩蓋缺資料。
3. **保留 wrapper。** `makeCard(data,host,opts)` 改用 `HoloCardFace.create()` 造正面，仍組裝卡背、hit、caption、flip 按鈕及 record；`select/flipCard/bind` 的鍵盤、觸控、選取行為繼續使用原 record。歷史假景深樣本以顯式資料 override 處理；`baseline-css` template 與 shadow root 的真舊卡不改。`paint(c,x,y)`（718）預設回共用 paint，控制項只在展示樣本顯式覆寫，不能再把正式預設 za/comp 改成另一套；flat shift 保持零。
4. **只留一份尺寸計算。** 刪除 demo 的 `sizeObserver/fitName`（679–691）及局部 name-fs 殘留，使用共用 observe。引入傳統相對 script `card_face.js`；`build_round5_standalone.py` 同時內嵌該 script，改 asset resolver 接線，不繼續依賴舊 makeCard 模板字串替換。搬到別的資料夾也須有 HoloCardFace 與 mask／字體／palette／圖資，無 fetch 或 module import。
5. **保留斷言、修錯的資料語意。** `check_demo_round9.py:84` 的「每張 pool 都 masked」改成依 pool_data kind：flat 無 mask，其他具備所需 mask。保留 65 張、名字與稀有度逐字對照、置中、寶石對比、邊界、互動與閒置斷言。補 `pool-mieshi/wanwumythic` kind、palette 預期值／有效背景，以及四場景小尺寸跨頁斷言。不能只刪舊斷言換綠燈。
6. **同步並驗所有產物。** 沿第 4 節的既有生成入口；原回歸加跨頁測試一起驗。快轉問題另列 A5，不和造型補丁混在一起。

這六步的依赖順序仍有效；更新處是「refit／scrim／flat shift／部分 unobserve 已有修碼、remade portable 入口已存在」，下一輪先驗與補齊，不回退再重做。

### A4 — 尺寸、observer 與既有修碼的補驗

檔案／函式：`card_face.js:fit/observe/refit/unobserve/paint`，`build_deluxe_b.py:makeFace/revealOne/pull/收下/reset`，demo `makeCard/paint`，remade `build()`。

- `refit()` 現在 clientWidth 已避開 transform，但 clientWidth 包含 padding，observe 的 contentRect 不含。用同一未變形 content width 來源統一兩條路徑，並同時刷新 `--gem-fs`；目前 refit 只 fit 字，沒有重算 gem。保留 Range、7% 步進、55% 下限、nameFits 與 rarity 同比縮的既定選擇。
- 揭曉／回槽動畫真正完成、姿態中立之後才 refit；不能用設了 revealed=true 或固定等待當動畫完成。font-ready 也用同一路徑。
- 每次 replaceChildren／移除 face 前 unobserve。收下已有接線；檢查 `pull():313`、reset 的 `btn.fin.click()`、失敗／取消的 fan 重建。只清這次改動留下的未使用 sizeObserver、helper，不做整檔死碼清理。
- 針對已改的 flat shift 與 scrim，從實際節點量 computed style 和增量，不以源碼存在為通過。demo 接入後也測，不能只看 remade。

驗收：102px、外層 scale 1.13 的 refit 仍得到短名 8.44px、rarity 4.75px、gem 7.74px；同 DOM 80→290 可恢復；長名最小 55% 並誠實回報超寬；收下／reset 後 detached observer 0。這些預期沿用報告與凍結公式，本輪未實測。

### A5 — 十連快轉：先重現，再修完成判定

檔案：`_art/holo-test/build_deluxe_b.py`；函式 `cascade()`（333）、`skipAll()`（346）、`finishReveal()`（353）、`revealOne()`（358）、`updateFinish()`（434）、收下/reset（440–452）、`wait/A`（239–240）與延迟特效 callback。

源碼支持的競態：cascade 中途等 1000/1500ms 時按快轉 → skipAll 把其他卡啟動並呼叫 finishReveal → 所有 updateFinish 都看到 cascading=true → cascade 醒來設 false，但 skipped=true 跳過最後的 finishReveal → 沒有人再刷新收下。原報告第一次失敗、第二輪未重現，兩者都保留。這是因果候選，下一輪應固定排程重現。

- 用固定十張 fixture，在 cascade 等待期間、最後一張啟動前後、正面初見、回槽期間各觸發快轉；長等待高階卡之後的低階卡全數 fast 完成，是必要情境。保留失敗狀態的 cascading/skipped/slot 完成數與按鈕 hidden。
- 最小修復方向：cascade 在 finally 離開時無條件重新計算 UI；另外分清「已開始揭曉」與「已完成可收下」。現有 `s.revealed=true` 在 revealOne 一開始就設，不足以代表动画終態。不要只把收下強制顯示，讓它在舊回呼仍執行時清掉 DOM。
- 快轉對正在揭曉與尚未揭曉的卡都必須收斂至同一正面終態；動畫、timer、材質工作歸屬當次抽卡，收下／reset 後舊回呼不能寫新槽位。`setTimeout` shock/burst 也須受當次生命週期管理。是否以取消或等待已啟動任務完成實現，可採最少狀態的方案，但要交代語意。
- 測試加在 `check_gacha_card_regression.py` 的真實流程段；`check_gacha_followup.py` 的診斷輸出不是全部斷言通過，關鍵條件必須有 assertion。先保留能失敗的測試，再修流程。

驗收：上述固定觸發點各重複 20 次，dev 與移走的 standalone 都可收下；動畫與清理結束後 100ms 內按鈕可用；卡数／身份不變、沒有 console error；連按快轉／reset／收下再抽不漏卡、不重複結算、不受上一抽光效污染。一般播放節拍不因這個修復被減量。

## 3. 任務 C：傳說左上黃線，交給使用者排查的線索

本輪沒有原附圖，不能確診。`src/gacha-card.css:242–249` 的 `.skin-af .r-legendary .face-frame::after` 有四角 **13px × 2px** 的 `--rim-hi` 橫線，inset 5px；傳說 rim-hi 在 215 行是 `#ffd28a`，與「貼在卡框內側的黃色橫線」形態相符，是明確候選。`251–254` 的 `::before` 則是**頂部中央**三齒扣，不應直接當成左上問題。

但新卡 `.hcard` 不是舊 `.skin-af .card`，舊規則不必然匹配；demo 的 `baseline-css` template 也只是舊版比較區，不能因為搜尋找到同一段就判定新卡受污染。下一輪先在出問題節點記錄祖先 class、`::before/::after` computed background／content／尺寸與 stylesheet 來源；暫時在 DevTools 逐個關掉候選以定位，再看是否來自新框 `frame-material`／frame mask。若不匹配舊 selector，排除此候選。這項由使用者自行修；不要批量刪四角裝飾或改凍結卡框來「試試看」。

## 4. 下一輪交付與實際驗收命令

以下才在獲授權的實作輪執行。本輪不執行。

在 `_art/holo-test/` 依序生成：

1. demo 資料 adapter 更新完成後，`python build_round5_standalone.py`。
2. `python build_cards_remade.py` → `python build_cards_remade_standalone.py`。
3. `python build_deluxe_b.py` → `python build_deluxe_b_standalone.py`。

使用既有 `check_demo_round8.py`、`check_demo_round9.py`、`check_gacha_card_regression.py`、`check_gacha_followup.py`；最後一支目前是診斷，報告須區分「腳本正常退出」與「條件通過」。记录每条真实退出码、失敗卡 id/尺寸/入口、console/request、比較截图与量測 JSON，portable 複製到別處後驗。

portable 圖資不是同一編碼：目前 demo／deluxe 使用 360×504、quality 82 WebP；新增 remade standalone 使用 420×588、quality 84（其 `uri()`）。不要照舊報告說所有 portable 都一樣，也不要要求有損 WebP 對 dev PNG 逐像素零差。幾何、卡名、卡型、載入和可攜性要一致；像素比較用同圖資控制組，並記錄壓縮差異。

交付應包含：修改來源與同步產物、所有未結的通過／失敗表、快轉固定時序重現與修後結果、四場景 80/102px 比較、三型 plate/text 幾何、mask/palette 與清理證據。完成 A 後才將新的揭曉方案接上；不要以新光芒蓋住尚未收尾的卡面問題。
