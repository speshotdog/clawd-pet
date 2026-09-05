# 第三輪：實作三個新演出模式（可寫檔）

先 `git log -6` 看現況。第二輪之後 Claude 依使用者實跑回饋改了幾件事，**這些是定案，不要再改回去**：

1. **共用揭曉節拍換回第一版**（`gacha-mode-runtime.js` 的 `reveal()`）：580ms 翻、290ms 揭曉；傳說＝壓暗＋其他卡沉下＋卡抖＋射線＋蓄力音拖一秒再翻，翻完整桌震＋鐘。使用者說「本來的回饋感比較好」，你第二輪的減量版被退回。**演出中的重量不能砍，效能規矩只管閒置狀態。**
2. **不搶先發光**：任何稀有度在玩家「揭曉動作」之前都不能被看出來——卡背不透光、不變色、沒有「本次最高」。驚喜要留到翻卡／露臉那一刻。傳說的「來了」蓄力是揭曉動作**之後**的事，那是允許而且必要的。`gacha-mode-wish.js` 的 `WISH_TELEGRAPH=false` 就是這個原則。
3. hover 卡背的透光（`gacha.css` 尾端 `back-leak / back-sweep / back-motes`）是玩家主動靠近才給的預告，保留。
4. `ctx` 現在有 `flash()`、`shake(soft)`；`ctx.audio` 有 tear/burst/charge/lock/drop；`ctx.fx` 有 ring/packBurst/spawn/layer。

## 本輪要做的三個模式（各一個檔，照第一輪文件的架構）

### A. `gacha-mode-summon.js` 腳印召喚陣
依你第一輪文件「模式三」實作，但**卡位不可預先點亮成結果顏色**（違反不搶先原則）。改成：五個卡位依序點亮同一種暖白，卡從卡位立起成扇形，之後走共用 R。傳說的重量放在共用 R 的蓄力，不放在陣上。腳印印章、雙圓環、描線、印章聲都照文件。

### B. `gacha-mode-stage.js` 拉幕登場
依文件「模式四」，這是本輪最重要的一個：它要證明這套架構能演「角色」，不只演「卡」。
- 角色本尊上台：用 `ctx.art.create(entry)` 拿 SVG，放大到約 192px 高；需要 rig 資料時在 `gacha-card.js` 的 `art` 上補一個 `cfg(id)` 回傳 `CHAR_CFG[id]`（樞紐、limbScale、up、tail 等，格式見 `src/pet.js`）。
- 進場：剪影（`filter: brightness(0)`）從側邊走進來，走路＝雙腿以 `setLimb` 交替擺動（見 `gacha-card.js` 的 `setLimb` 寫法：`rotate(deg px py)`，擺幅 × limbScale），尾巴慢搖。
- 燈：單盞探照燈圓錐（SVG 漸層）。**打亮之前燈是白的**，露臉的那一刻燈才變成稀有度色＋播對應揭曉音＋名字條滑入；傳說在打亮前多一段：燈忽明忽暗、地板低頻、角色停步，再「啪」一聲全亮＋整桌震＋鐘（沿用 `ctx.audio.reveal('legendary')`、`ctx.shake()`、`window.GachaFx.rays` 打在角色背後）。
- 露臉後角色做一次回應（眨眼＋抬手或搖尾），停 0.6–1.2s（依稀有度），縮成卡飛到扇形位（用 `ctx.cards.create` 建好卡、直接標成已揭曉：呼叫 `ctx.onReveal(key)` 並加 `dealt flipped` class 與扇形 transform）。
- 玩具／emoji 沒有 rig：從舞台上方掉下來彈一下。
- 自動／逐張都要支援；逐張時每位完成後等點擊。

### C. `gacha-mode-rip.js` 撕包（Pokémon TCG Pocket 語彙）
- 卡包直立在中央（沿用 `gacha-pack.png`），玩家**用滑鼠沿封口從左拖到右**才撕開：拖曳過程中封口逐段裂開（clip-path 隨進度推進）、有阻力（進度落後指標 20%）、每推進 15% 一聲撕紙顆粒；拖不到 70% 放手會彈回。
- 撕開後五張卡疊成一疊在中央（同一位置、微錯位），每次點擊最上面那張，它往右滑走並翻面揭曉（共用 R 的音效與特效要用同一套，翻面可以是滑出時翻），第五張留在中央放大一點。
- 最後五張排成扇形進入 `fanned`，收下。
- 略過：直接總覽。

## 共通要求
- 純前端 classic script；私有 CSS 在 create 時注入、dispose 移除；閒置零 rAF。
- 不能加圖片素材。
- 音效全用 `ctx.audio` 積木或既有語意方法。
- 頂列 `#mode-select` 加三個選項，`gacha.js` 的 `renderEntry()` 要知道新模式的入口（summon 與 stage 用中央按鈕 `#launch`，文字各自改；rip 用卡包但不是拖到中央而是直接立在中央可撕——`renderEntry()` 對 rip 要把 `pack` 顯示在中央並交給模式接管 pointer 事件，宿主的拖包邏輯對 rip 不生效）。
- 每檔 `node --check`；不要 build、不要起 server、不要 commit。
- 交付時列：改了哪些檔、每個模式的入口與時間軸、哪裡跟第一輪文件不同與原因、不確定的地方。
