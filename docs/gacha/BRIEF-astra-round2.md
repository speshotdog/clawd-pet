# 第二輪：實作（可寫檔）

你在第一輪寫的 `docs/gacha/DESIGN-astra-round1.md` 已被採納。Claude 已完成其中「一、定案卡面」：`src/gacha.css` 尾端的 `.skin-af` 區塊、`src/gacha.js` 的 live 控制器重寫（有限 rAF、入場一次動作）、鍍膜節點放進畫窗、傳說粒子減量、ready 待機循環移除。請先 `git log -3` 與 `git diff HEAD~1 --stat` 看一下現況，**不要重做這部分**。

本輪請你實作設計文件的「三、模式切換架構」與「二、模式一／模式二」：

## 要做的
1. **拆開抽取與發牌**：`rollPack()` 不再由 `deal()` 內部呼叫；抽取當下固定 `draw = { id, entries:[{key, entry, dup}], visualSeed }`。
2. **pending 存檔**：`collection / dust / packs / pity / pending` 合成單一版本化存檔物件（保留舊 `gacha_*` 鍵的一次性搬移）。抽取時寫 packs / pity / pending；收下時寫圖鑑與塵並清 pending；關窗再開若有 pending，直接顯示該批總覽等收下（重新開視窗時 gacha.html 會重新載入嗎？不會——視窗是 hide 不是 destroy，所以主要是防 app 重啟）。
3. **模式 runtime**（新檔 `src/gacha-mode-runtime.js`、`src/gacha-card.js` 依你文件的檔案安排）：`window.GachaModes[name] = { label, counts, create(ctx) → { open(draw), skip(), dispose() } }`，`ctx` 照文件第三部分第 2 節（`cards.create/deal/reveal/showSummary`、`art.create`、`audio`、`fx`、`wait/animate`、`signal`、`motion`、`onReveal`、`rng`）。共用揭曉節拍 R 依文件第二部分第 3 節實作一次，模式共用。
4. **`GachaAudio.createScope()` / `GachaFx.createScope()`**：把 tone / noiseHit / bell 與 spawn / layer 開成 scope API，`skip()` 30ms 淡出並清掉本次演出的聲音與粒子；ray 不得 `hold: Infinity`。
5. **現行拆包移成 `src/gacha-mode-hearthstone.js`**（依文件模式一：撕包縮短、輕版 burst、發牌節拍、逐張／全部翻開、共用 R）。拖包 → 就位仍由宿主的入口控制器負責。
6. **新模式 `src/gacha-mode-wish.js`「流星投遞」**：完整依文件模式二的分鏡、預告、音效表實作。私有 CSS 以 `.mode-wish` 前綴，可放在模式檔內於 create 時注入。
7. **頂列模式切換**：原生 `<select>`（拆包桌面／流星投遞），只在 idle/ready 可切，偏好存 `gacha_mode`；頂列拖窗排除條件補 `select, option, input, label`。
8. **略過演出**：所有模式從 200ms 起顯示「略過演出」，180ms 內進總覽；不自動收下。
9. `prefers-reduced-motion` 由 JS 讀取並傳入 `ctx.motion`。

## 限制
- 純前端 classic script，載入順序：audio／fx → card／runtime → 各模式 → gacha 宿主。`gacha.html` 的 `<script>` 順序要跟著改。
- 不能新增圖片素材；不能動 `src/pet.js`、`src/index.html`、Rust 端。
- 保持現有 `skin-af` 卡面與 live 控制器可用（可搬到 `gacha-card.js`，但行為不變）。
- 現有 hearthstone 的拖包手感（`pack` 的 pointer 事件、`placePack`、`HOME/CENTER`）不要重新設計。
- 閒置時不能有常駐 rAF 或無限 CSS 動畫。
- 每個檔案改完跑 `node --check`。你**不需要**也不要跑 `npm run build`、不要啟 http server、不要 commit；Claude 會用 Playwright 與實機驗證後再 commit。
- 程式註解用繁體中文，語氣比照現有檔案（說「為什麼」，不是複述程式碼）。

## 交付
最後回覆請列：改了哪些檔、新增哪些檔、每個模式的入口與時間軸對照文件是否有偏離（有就說原因）、你自己還不確定的地方。
