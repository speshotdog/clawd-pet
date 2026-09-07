# 珍母點點 第十六輪簡報：「轉彩」機制（偽裝精良→翻牌轉成傳說）＋移除玥玥傳說卡

給 GPT-6 Astra 實作。規則同前：**不要 build、不要起 server、不要 commit、不要碰素材檔、不要精簡任何既有演出**。中文直接寫 UTF-8，寫完 `grep -n "??" src/*.js` 確認。
前提：第十五輪（神話階級、十張新卡）已在 `src/` 完成。先讀 `docs/clicker/REPORT-astra-impl-round15.md` 與 `gacha-pool.js`、`gacha-card.js`、`gacha-card.css`、`gacha-mode-runtime.js`、五個 `gacha-mode-*.js`、`gacha-fx.js`、`gacha-audio.js`、`clicker-gacha.js`、`clicker-save.js`。

## 1. 移除「玥玥傳說卡」（`yuelegend`）

使用者說這張是輸入錯誤，**整個拿掉**：`gacha-pool.js` 目錄、`clicker-balance.js` 角色與羈絆（若有）、推薦組合、任何 `art:'yueyue'` 借圖的分支若只為它而存在也拿掉、測試中提到它的案例改掉。角色總數變 21。存檔 validate 若遇到舊存檔裡有 `yuelegend` 欄位（這一輪之間沒人玩過，但保險）：靜默刪掉該 id 的 collection／dust／promotions／transcend／partnerLevels，技能槽裡有就清成 null。

## 2. 轉彩機制（使用者原話）

> 傳說機率一樣保持 5%，只是大約 5% 的機率；指上去會顯示精良，翻開的時候會有特別演出，從精良轉色變成傳說。

### 2.1 抽樣層（`gacha-pool.js`）

- 抽到 **傳說** 的每一張，以 **30%** 機率標記 `veil: 'rare'`（另 70% 照舊直接是傳說；使用者覺得 50% 太高）。用同一個 `rng`（可重播）。**神話不轉彩**、史詩不轉彩。真實稀有度 `entry.rarity` 完全不變；保底、粉塵、存檔、卡冊都只看真實稀有度。
- 標記放在 draw 的 item 上（`{ entry, veil?: 'rare', ... }`），不要改共用的 entry 物件。存檔裡 `pending` draw 也要帶著 `veil`（`clicker-save.js validate` 允許這個可選欄位，值只能是 `'rare'`）。
- 提供 `Pool.shownRarity(item)`：`item.veil || item.entry.rarity`，所有「翻開前」的顯示都用它。

### 2.2 翻開前一律裝成精良（`gacha-card.js`、各 mode）

- `card.create(entry, { veil })`：有 `veil` 時 class 用 `r-rare` 且加 `veiled`，卡背光漏（`.back-leak`）、微粒、hover glow、傾斜視差 `LIVE_CFG` 全部用 rare 的；卡面內容（角色、名字、`.face-rarity` 文字）**先照真實傳說渲染但整張卡面用 rare 的框與底色**（因為翻開瞬間要看見角色是傳說角色，只有顏色是精良的）。
- 滑鼠指上去（hearthstone 的 hover、wish 的流星預告、stage 的聚光燈顏色、summon 腳印顏色、rip 撕包前的光）全部用 `shownRarity`。wish 的 `top`（本次最高）也用 `shownRarity` 算，所以五連裡若唯一的傳說是轉彩卡，預告會寫「本次最高 精良」或「史詩」。
- 翻開前 `host.charging`／`dim`／`rays` 這些「來了」的預兆**不播**（就是要讓玩家以為是精良）。

### 2.3 翻開時的轉彩演出（`gacha-mode-runtime.js reveal()` 共用；五個 mode 走同一條）

時間軸（在原本 rare 的翻牌流程之上）：
1. 照 rare 流程翻牌、`sound.reveal('rare')`、rare 粒子。玩家看到一張「精良框的傳說角色」約 **500ms**。
2. **停頓**：卡片輕微抖 2 下（`transform: rotate(±1.5deg)`，各 80ms），一聲短促的「叮」（`gacha-audio.js` 新 `tick` 音，高頻 sine 20ms）。
3. **轉色**：`card.unveil()` —— 加 class `unveiling`，用 CSS 做一道**由左下往右上掃過的斜向色帶**（`::after` 覆蓋整張卡，`linear-gradient(115deg, transparent 40%, #fff 50%, transparent 60%)` 從 -100% 掃到 200%，420ms），掃過的同時 class 由 `r-rare` 換成 `r-legendary`（掃到一半時切換，用 `setTimeout` 210ms），框線、底色、寶石、光漏、`.face-rarity` 文字「精良→傳說」都在這一刻換。掃帶尾端撒 8 顆橘色火花（`GachaFx`）。
4. 換完後**才**播傳說的完整演出：`host.dim.on`、`rays`（`fadeIn` 短一點 .3）、`host.shake()`、`sound.reveal('legendary')`、傳說粒子、`reveal-pop`；停留時間與傳說相同（900ms）。
5. `motion.reduced` 時：跳過 2、3 的動畫，直接換 class 並播傳說音效。

`gacha-card.css` 加 `.card.unveiling::after` 掃帶、`.veiled` 的細節（例如 hover 時不透露）；兩套 skin（預設與 `.skin-af`）都要有。

### 2.4 各 mode 要對齊的地方

- **wish**：流星預告顏色、落地漣漪用 `shownRarity`；轉彩卡不是「傳說流星」。
- **stage**：`RC`／`LABEL`／`holds` 查表用 `shownRarity`；拉幕時是精良燈光，轉色時燈光跟著換成橘（`spot` 顏色過渡 300ms）。
- **summon**：腳印顏色用 `shownRarity`。
- **hearthstone**／**rip**：光漏與 hover 用 `shownRarity`；rip 撕開的瞬間仍是精良的，轉彩在翻面後才發生。
- 五連「全部翻開」（`reveal-all`）時轉彩卡照樣走完整流程（不省略）。
- 摘要／收下畫面（`summary`）用真實稀有度。

### 2.5 遊戲側（`clicker-gacha.js`、`clicker-save.js`）

- 王包免費五連、每日包免費單抽、開局五連走同一條 draw，自動帶轉彩。
- `pending` draw 重開（restore）時 `veil` 要還在，翻開狀態照舊。
- 卡冊／粉塵／徽章／分享卡：真實稀有度，不受影響。

## 2.6 卡冊翻頁改成明顯的箭頭鍵（`clicker-album.js`、`clicker.css`、`clicker.html`）

使用者：角落的小三角形太不直覺。改法：
- 把 `#album-prev`／`#album-next` 兩顆 `page-corner` 鍵**移到書頁左右邊緣的中間**：`#album-prev` 貼在左頁最左側（`left:10px; top:50%; transform:translateY(-50%)`），`#album-next` 貼在右頁最右側；大小 52×52。
- 外觀：沿用 `#game button` 的奶油貼紙鍵（`--button-art` btn-cream），中間畫一個粗墨線箭頭 `‹`／`›`（字級 34、`font-weight:800`、顏色 `#30251F`），不要只用貼圖三角形；hover 上浮 2px，`:disabled` 半透明 .3。
- 不可翻時 disabled（第一跨頁的 prev、最後跨頁的 next）。
- 第十四輪加的「點書頁空白翻頁」保留。
- 頁碼 `.album-pageno` 位置不動。
- 卡片與箭頭不能重疊：左頁 grid 的 `padding-left`、右頁 `padding-right` 各加 44px 讓出空間（卡片仍置中）。

## 2.7 第十五輪驗收發現的小 bug

- 卡冊展示頁（`#album-detail`）神話角色的星星列：彩虹底條拉滿整個展示頁寬度（從星星一路延伸到右邊緣），應該只包住星星列本身（`.star-row` 寬度 fit-content）。
- 神話卡面的 .35 彩虹鍍膜把角色本體洗得偏白（玥來玥閒在卡冊縮圖與展示頁都偏淡）。鍍膜改成**避開角色圖**：`face-holo` 用 `mask` 或把角色圖層放在鍍膜之上再對角色加一層 4% 的 overlay 即可，框、底、名牌維持全彩。

## 3. 測試（新 `tools/test/clicker-round16.test.js`）

- 固定 seed 下抽 2000 次：傳說（含轉彩）比率 ≈ 5%（±1.2%），轉彩佔傳說約 30%（±10%）；神話從不帶 `veil`；史詩／精良從不帶 `veil`。
- `shownRarity` 對轉彩卡回 `'rare'`，對其他回真實稀有度。
- 保底計數：轉彩傳說一樣重置保底。
- 存檔 validate：`pending` 含 `veil:'rare'` 通過、`veil:'epic'` 不通過。
- `yuelegend` 不存在於目錄；含 `yuelegend` 欄位的舊存檔 validate 後被清掉。
- 既有測試全綠（`npm test`）。

## 交付

`docs/clicker/REPORT-astra-impl-round16.md`，每項一句話。不要 build、不要起 server、不要 commit。
