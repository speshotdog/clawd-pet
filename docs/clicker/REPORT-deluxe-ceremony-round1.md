# 裝幀典藏第一輪實作回報

日期：2026-09-08。分支：`holo-cards`。

本輪只實作演出與演示頁接線。沒有修改抽樣、價格、抽率、保底、券、金幣、pending、存檔或其他五種演出。**以下第 2 節的宿主／runtime 限制尚未解決，不能視為設計文件全部驗收通過。**

## 1. 實際做了什麼、節拍與程式對應

新增 `src/gacha-mode-deluxe.js`，註冊 `deluxe`／「裝幀典藏」，宣告 `counts: [1, 5, 10]`。`gacha.html` 只改原選單所在的一行、增加一行 script，載入在 runtime 之後、宿主之前。

所有行號對應 `src/gacha-mode-deluxe.js`；函式名稱可直接搜尋。

| 節拍／規則 | 實作位置 | 實際行為 |
|---|---|---|
| 0–180 ms | `open()`，264 行起 | 深色裝幀室淡入；不讀 rarity 來設定場景顏色。 |
| 180–480 ms | `makeSlots()`，101 行；`open()`，266 行起 | 典藏冊展開，紙紋、冊脊、頁緣、空槽與序號鉚釘依序落位。這拍沒有建立結果卡。 |
| 480–760 ms | `makeCards()`，111 行；`open()`，270 行起 | 以 `ctx.cards.create()` 取得卡片並設定直排槽座標，再由 `ctx.cards.deal()` 發牌；每張起點相隔 70 ms，單张壓入 140 ms。最後一張起點與時間表的歧義見第 2 節。 |
| 760–1060 ms | `open()`，276 行起 | 金屬索帶沿冊脊滑過；播放 scope 內的低音與紙摩擦合成音。 |
| 1060–1420 ms | `open()`，281 行起 | 中央壓印頭下降、輕微回彈，顯示「按住／點擊壓印」；完成後開放卡槽按鈕與「全部壓印」。 |
| 互動後 0–220 ms | `reveal()`，180 行起 | 封蠟出現裂縫、向外碎開、中央窄光一閃；220 ms 邊界呼叫 `ctx.cards.reveal(key, { deferSummary: true, onFlip, onUnveil })`。 |
| 220–800 ms／共用蓄力 | `reveal()` 的 runtime 呼叫 | 一般卡沿用 580 ms 翻牌；傳說、神話、veil 的蓄力、轉彩、揭曉通知、音效與震動均交給原 runtime，未複製這些邏輯。 |
| 揭曉點 | `onFlip`／`onUnveil` 回呼 | 一般卡從 `onFlip` 等待 580 ms 至翻面完成才完成材質；轉彩在 `onUnveil` 還原真實框時開始材質。UI 級已揭曉集合仍由 runtime 的 `notify → host.onReveal` 寫入。 |
| 精美 0–900 ms | `finishMaterial()`，122 行；`material()`，131 行起 | 僅閉包內 `edition === 'deluxe'`：同拍加入精美徽記、透明護頁、四角收束箔面、寶石光暈、壓印墨框與少量亮塵。四個短命效果節點在 900 ms 後由 `finally` 全部移除。 |
| 普通 0–320 ms | `material()` | 普通版保留乾淨箔邊與普通標記，紙面壓縮回彈並落塵 320 ms；沒有精美高潮。 |
| 全部揭曉後 180 ms | `conclude()`，171 行起 | 顯示「全部完成」、鎖定操作，等待 180 ms，移除装幀室。呼叫 `ctx.interact()`，隨即由 `ctx.cards.showSummary()` 完成 runtime 的 done；只顯示收下按鈕，不執行收下。 |

補充實作：

- **假 edition**：檔案開頭明示非正式身分模型。`entry.edition` 優先，缺值才用網址參數；未知參數也走 mixed。固定 seed `0xD31A2026`，前兩張固定精美，後續使用同一可重現序列。五張 mixed 為「精美、精美、普通、精美、普通」；十張後五張為「精美、普通、普通、普通、普通」。不使用 draw 的 RNG 決定版本，也不回寫任何資料。
- **無預告卡背**：本次卡片加 `dl-card`，以局部 CSS 換成無字紙紋卡背，遮掉原卡背稀有度漏光、光點與卡背圖片；未揭曉不附上 edition dataset／ARIA。操作捕獲也阻止 runtime hover 音效洩漏 rarity。壓印後焦點卡仍保留 runtime 蓄力光暈與回彈。
- **逐張／自動**：每槽有原生 button，可點任一張，支援鍵盤啟動；連按由模式鎖擋下。自動按 entries 順序，前張整段結束後間隔 80 ms。模式自己的「全部壓印」及宿主既有自動選單都接入這條序列，不改 item key。
- **排版**：`layout()`（96 行）單抽置中、五連一排、十連兩排五槽；沿用宿主 960×640 外框、940×620 內部座標。十連卡片 scale `.82`，保持 entries 順序。演出期間對 body 暫時開啟 overflow 捲動，清理時還原。
- **reduced-motion**：`open()` 253 行起，0–480 ms 淡入完成冊頁；`deal` 使用 stagger 0、duration 150。沒有展頁旋轉、壓印頭運動、粒子或模式新增的震動／閃光；版別完成縮為 150 ms 靜態框／徽記 opacity pulse。CSS 同時有 `prefers-reduced-motion` 規則。
- **取消**：`cleanup()`／`dispose()`／`skip()`（233 行起），模式動畫集中追蹤、短命節點集中追蹤，解除事件、停止 audio 子 scope、移除 style、DOM 與捲動 class；`dispose()` 可重入並呼叫 `ctx.cancel()`。每個等待返回後檢查取消，阻止舊時間軸續發牌。skip 先把所有本批卡片的槽位和靜態版別外觀補齊，再取消；最後的真實翻面仍由宿主 `runtime.skip()` 完成。
- **入口**：297 行起的 DOMContentLoaded／MutationObserver 只為 deluxe 補上既有 launch 按鈕與提示文案。點擊仍走原本 `startDraw()`／`DEMO_POLICY`，未替換宿主函式，也未 monkey-patch runtime。
- **素材與成本**：只用 CSS 漸層及檔內自製印章 SVG，無新增外部資產。背景與紙面各一層、沒有模式的常駐全域粒子；同時僅一張焦點卡。精美四個短命層與徽記 pulse 都有生命週期；其餘卡片材質靜止。結算移除 mode style／效果節點，只在本批卡面留靜態護頁與標記。共用 FX 的例外見下一節。

已執行的檢查：

- `node --check src/gacha-mode-deluxe.js`：通過。
- `git diff --check`：通過；只有既有 Git 的 LF→CRLF 提示。
- `node --test tools/test/gacha-pool.test.js`：7 項通過、0 失敗。這只能證明既有卡池測試仍通過。
- 以 Node VM 載入**實際 mode 與實際 runtime**，用記憶體 DOM、動畫、卡面 adapter、音效與 FX 替身跑 26 個案例：1／5／10 張 × normal／reduced × all／mixed／none，另含逐張反序連按、早期與較晚時點 skip、重複 dispose。檢查 summary 一次、所有 key 揭曉、`entry.edition` 優先、draw 序列化前後相同、模式 style／短命效果／按鈕／事件清理。全部通過。測試透過 stdin 執行，未新增測試檔；計時有加速，**不能當成毫秒精準度、真實瀏覽器事件或視覺驗收**。
- 沒有 build、沒有啟動 server、沒有瀏覽器／Playwright 驗收、沒有 commit 或 push。低階裝置、WebView2 與 `getAnimations()` 實機效能仍待驗收。

## 2. 做不到、文件衝突、需要宿主／runtime 支援的項目

1. **演示頁不能從 UI 選單抽／十連。** `gacha.js` 的 `rollPack()` 寫死 `count: 5`，沒有張數控制。新模式本身可吃 1／5／10 的 draw，但原入口只會產生五張。要開放 UI 張數，需要改宿主；本輪未做。

2. **重開既有 pending 不會還原本模式的 edition 裝幀外觀。** `gacha.js main()` 直接 `makeRuntime(SAVE.pending).skip()`，完全不呼叫模式 `create/open/skip`；本檔沒有 draw 可讀，也沒有模式 summary hook。因此同一次演出中 skip 可保留精美／普通靜態徽記，重新載入頁面則只會得到既有 adapter 的真實 rarity 卡面，不會加回本輪護頁／版別徽記。固定 seed 可保證「再次把同一 draw 傳入本模式」的版別一致，但**不能宣稱宿主重開 pending 的版別顯示已完成**。需宿主提供帶 draw 的 summary／resume hook 或正式卡片 edition adapter；不能藉讀寫 pending 或複製存檔流程繞過限制。

3. **五連 480–760 的完整壓入與 70 ms stagger 無法同時零重疊。** 五張的起點為 480、550、620、690、760；若每張有非零壓入時間，最後一張必然在 760 之後完成。此實作保留 70 ms、140 ms 壓入，最後一張 900 ms 落定，760–1060 索帶拍與最後發牌重疊；其餘五連开場仍以 1420 ms 為目標。十連保留原順序與 70 ms stagger，索帶／壓印頭後移 350 ms，開場約 1770 ms。這是節拍表與張數的衝突處理，並未偷偷縮短後面的戲。

4. **`fanned` 精確切換點受 runtime 控制。** `ctx.cards.deal()` 完成就呼叫 `host.state('fanned')`，五連約 900 ms，早於表格的 1060–1420。`ctx` 沒有任意 state setter；本模式在 1420 ms 前鎖住實際卡槽操作，自動選單事件也不會提前揭曉，但宿主 state class 仍會較早變成 fanned。要讓 state 時點完全吻合，需 deal 的 defer-interactive 能力。

5. **`ctx.interact()` 不會替 deferred reveal 開 summary。** runtime 的 `reveal(...deferSummary:true)` 不呼叫 finish；`interact()` 只等 done，若只照表格最後呼叫 interact，整段不會結算。所以全部完成 180 ms 後先 interact，再明確 `ctx.cards.showSummary(draw.entries)`。沒有手動 notify 或自動收下。若設計要求只呼叫 interact 就完成，需要 runtime 增加對應能力。

6. **揭曉通知不是「卡面完全可讀」的精確時間。** runtime 在翻面開始後 270／290 ms 寫入 onReveal，普通完整翻牌則為 580 ms；reduced 的翻牌含 240 ms delay＋150 ms fade。沒有共用 onReadable hook。本模式用 onFlip＋等待在完整翻面時完成材質；veil 用 onUnveil，UI 已揭曉集合仍照原 runtime 時機，不自行改寫。

7. **共用 runtime FX 無法由模式完整納入短命層與取消預算。** runtime 使用全域 `window.GachaFx.reveal/rays`，部分粒子可存活到約 3 秒，射線也有自己的漸退；它們不全部歸 `ctx.fx` scope，取消中斷時模式拿不到那些 handle。模式新增的四層會在 900 ms 清掉，但無法保證共用 runtime 粒子在 skip／summary 當下全消失，也不能保證把共用全域 ring／rays 算入後仍符合第 7 節的總層數。需要 runtime 將 FX 歸入 scope 並在取消／summary 統一停止。未砍共用高潮、未清空全域 canvas 來掩蓋問題。

8. **窄螢幕與縮放後的 44 CSS px 不能全面保證。** 模式提供固定兩排與演出期間的捲動；實際 Tauri `applyZoom()` 由宿主縮放整個畫布，頂列、底列與按鈕都會跟著縮小。結算移除模式 style 後也回到宿主原本 overflow 規則。未改宿主 viewport／zoom，故不能宣稱手機捲動、縮放後觸控尺寸、結算畫面的窄屏操作已通過。

9. **正式 cardId 資產、縮圖／卡冊與缺圖預載未實作。** 仍由既有 adapter 根據 entry.id 使用已載入素材；本輪沒有正式 edition 資產與身分模型，精美版是本次演出的護頁／箔框／徽记。第 6.2 的 cardId lookup、獨立靜態縮圖與卡冊切換需修改唯讀 adapter／宿主，留待後輪。

10. **無 WAAPI 的完整 runtime fallback 不在模式控制內。** 模式自製動畫有「等待後顯示靜態終態」fallback，材質不依賴 filter／混色；但現有 runtime 的 `animate()` 直接呼叫 `el.animate()`。完全沒有 Web Animations API 的環境仍需 runtime 支援。WebView2 真實相容性尚未實測。

## 3. 我認為節奏可能有問題的地方（只提）

- 十連因 70 ms 依序入冊，開場比五連多 350 ms；是否應兩排同時入冊，需使用者決定，本輪保留 entries 順序與 stagger。
- 一般精美卡完整翻面後還有 900 ms 裝幀，自動揭曉再等 80 ms；十連多張精美時會比較長。未自行縮短。
- 傳說／神話的原蓄力、震動、光線保留，精美材質可能與其揭曉餘韻重疊。转彩在真實框切換時完成材質；與普通直接翻面的節奏感不同，待實際觀看決定。
- 最後「全部完成」只停留 180 ms 就撤去裝幀室，收下頁回到宿主桌面。若希望長留典藏冊或做設計第 4 節的完整書頁 summary，需要另定 summary 生命周期，本輪未延長這一拍。
- 「按住／點擊」使用原生 button 的按下／放開啟動，沒有另加長按進度條或門檻；點一下和按住再放開都是一次壓印。

## 4. 動過的檔案

1. 新增 `src/gacha-mode-deluxe.js`。
2. 修改 `src/gacha.html`：原模式選單的一行新增 option，另新增一行 script；Git numstat 為 2 行新增、1 行刪除。
3. 新增本回報 `docs/clicker/REPORT-deluxe-ceremony-round1.md`，依簡報明示的回報要求。

其他 `src/` 檔案全部唯讀。未改簡報、設計文件、package、測試或經濟檔案。
