# 任務：魔花少女收藏卡在卡冊詳情／放大層拖曳轉動「非常卡、沒有追蹤感」——找真兇並修掉

使用者 2026-09-16 實測回報（截圖是卡冊詳情頁那張 `.r-special` 魔花少女，下面有「放大」鍵；看起來是手機直式）：
「魔花少女的卡面動起來還是非常卡，拖移的時候會很卡，也導致沒有正常追蹤的感覺。」

2026-09-15 已經做過一輪（見 `docs/clicker/HANDOFF-2026-09-14-r12.md` §16 第三點）：
`src/clicker-holo.js interactive()` 把 pointermove 的重畫合併到 rAF、拖曳中掛 `.holo-dragging` 暫停 16 顆愛心動畫、
`src/apoc/collect-face.js` 讓移動超過 8px 的 click 不觸發替身動作。桌機 headed Chrome 量到 p50 17.6ms／max 18.1ms。
**使用者說還是卡** → 桌機 18ms 一格不代表手機不卡；問題很可能是**每一格本身的繪製成本**（不是事件數量），要在接近手機的條件下量。

## 你要做的
1. **先量，不要猜。** 用 Playwright（Python，套件已裝）開 `src/clicker.html`（照 `tools/test/clicker-v3-collect.py` 的 route／SEED 方式開頁，
   它會示範怎麼走到魔花少女的 `#album-detail` 與 `#card-zoom`），用 CDP `Emulation.setCPUThrottlingRate`（4× 與 6×）模擬手機，
   viewport 用 390×844 直式（`is_mobile=True, has_touch=True`）＋ 1280×860 桌機各量一次。
   對 `.holo-face.holo-interactive` 的 host 送一段真的拖曳（pointerdown → 60 個 pointermove → pointerup），
   用 `requestAnimationFrame` 時間戳記錄每格間隔，回報 p50／p95／max，以及 pointermove 事件數 vs 真正 paint 次數。
   同時用 CDP `Performance.getMetrics` 或 tracing 看一格裡的時間花在哪（Style／Layout／Paint／Composite、有沒有每格 layout thrash）。
   同一套量法拿一張**非 special 的 2.0 卡**（例如 ApocPool 第一張）當對照組——如果對照組也卡，真兇在共用路徑；只有魔花少女卡，真兇在 collect-face 的加工。
2. 依量到的數字找真兇。已知嫌犯（請逐一證實或排除，不要全部都動）：
   - `HoloCardFace.paint()` 每格寫十幾個 CSS 變數，變數若被 `mask`／`filter`／`mix-blend-mode` 層吃到，每格都是整張卡重新光柵化。
   - `.r-special` 多疊的層：`frame-material`、兩層 multiply 反光、`--frame-mask`／`--glitter-mask`、16 顆愛心（拖曳中雖暫停但仍是各自的合成層）、
     替身動作那張 90 幀 WebP（就算沒在播，`<img>` 若還掛著、每格會不會被重繪？）。
   - `flush()` 每格呼叫 `host.getBoundingClientRect()`——在剛寫完 CSS 變數的同一格裡量會強制同步 layout。
   - 詳情頁與放大層的 host 尺寸：`#card-zoom .zoom-card { height:min(80%,580px) }`，放大層的卡是原尺寸的好幾倍，光柵面積跟著平方長。
   - `transform`／`will-change`／`contain` 有沒有正確讓卡整張走合成層而不是每格重繪。
3. 修。原則：
   - **靜止時的長相一個像素都不能變**（拖曳中可以暫時關掉部分特效，放開後要回來；使用者只要求「拖的時候順、跟得上手」）。
   - 2.0 的 71 張卡跟收藏卡走同一條 `ClickerHolo.face()`，改共用路徑要對兩邊都量。
   - `src/apoc/holo-special.css` 是 `tools/apoc/build_collect_card.py` 的產出，**不能手改**，要改就改抽取器或 `collect-face.js enhance()`／`clicker-holo.js` 的 runtimeSheet。
   - 不要重新做一套拖曳；保留現在的手感（0.2°/px、±18° 封頂、280ms 四次方回正）。
4. 修完用同一套量法給「改前 vs 改後」的表（桌機、4×、6× 三種 × 魔花少女／對照卡），把量測腳本存成 `tools/test/clicker-v3-drag-perf.py`
   （要能重跑、印出數字、門檻：6× 節流下 p95 ≤ 34ms 才算過，過不了就如實印 FAIL）。
5. 驗收必跑、全綠才算完成：`npm test`（236）、`PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-collect.py`、
   `tools/test/clicker-v3-io-portrait.py`、`tools/test/clicker-v3-reduced-motion.py`、`tools/test/clicker-v3-mythic-height.py`。
6. 回報寫進 `docs/clicker/HANDOFF-2026-09-14-r12.md` 最下面新開「### 19. 魔花少女拖曳效能（2026-09-16）」：真兇是什麼、怎麼證實的、改了哪些檔、改前改後數字。
   **不要 commit**，改完留在工作區給我驗。

## 規矩
- 只能改 `D:\claude\clawd-pet-balance` 這個工作區；不要碰 `src/apoc/holo-special.css`、不要碰 `_art/` 以外的產出檔。
- 不要下載任何東西、不要開 dev server（Playwright 直接 route 到 src/ 檔案，範例在 clicker-v3-collect.py）。
- 量不到／證實不了的就寫「量不到」，不要編數字。
