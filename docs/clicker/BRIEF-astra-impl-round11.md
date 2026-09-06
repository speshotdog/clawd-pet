# 珍母點點 第十一輪實作：便利商店三連包＋工廠輸送帶＋夜市限時大禮包（可寫檔）

先 `git log -4`（第八～十輪已合併）。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、`tools/sim/*`、`docs/clicker/REPORT-astra-impl-round11.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動。不 build、不起 server、不 commit。演出「可以更好，不能更淡」。素材檔名寫死（`clicker-scene3/4/5-*.png`、`clicker-pack3-*.png`、`clicker-belt-*.png`、`clicker-gift-*.png`），缺檔 `onerror` 隱藏。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 1.1 表。三個場景的 `enemy` 參數第八輪已放進 `clicker-scene.js`（`triple`／`timer`／限時事件），本輪把三種行為做出來，全部由參數驅動，不寫死場景名。

## 使用者原話
> 便利商店三連包（點哪拆哪，掃過去）→ 工廠輸送帶（20 秒自動換包，DPS 檢定）→ 夜市限時大禮包（15 秒 10 倍）。敵人只靠三個參數 shell／timer／regen 做差異，全進場景設定。

---

## 一、場景設定補齊（`clicker-scene.js`）
| id | 名 | unlock | requirementMul／rewardMul | enemy | 當家 | palette | music |
|---|---|---|---|---|---|---|---|
| market | 便利商店貨架 | `{ packages: 200, boss: 'kitchen' }` | 8 | `{ triple: true }` | dog, jiaobu2 | mat #C9D3DA／sky #EEF3F6 | theme `market`, seed `zhenmu-market-1`, gen density 55 rhythm 60 speed 55 drama 30 mood 75 hook 65 smooth 50 |
| factory | 零食工廠 | `{ packages: 600, boss: 'market' }` | 20 | `{ timer: 20 }` | lk, jiaobu | mat #9DA3A8／sky #DCE1E4 | theme `factory`, seed `zhenmu-factory-1`, gen density 65 rhythm 75 speed 65 drama 45 mood 50 hook 60 smooth 35 |
| nightmarket | 夜市攤 | `{ packages: 1500, boss: 'factory' }` | 50 | `{ gift: { everyMs: [45000, 90000], seconds: 15, mul: 10 } }` | yang, yueyue | mat #4B3B52／sky #2B2440 | theme `nightmarket`, seed `zhenmu-nightmarket-1`, gen density 60 rhythm 65 speed 60 drama 55 mood 70 hook 80 smooth 45 |
每場景層次照 scene1／scene2 規格：sky／far／mid／ground／props×3／drift 物×2（商店：懸掛價牌搖晃；工廠：齒輪轉、煙；夜市：燈籠搖、蛾）／particles×2。王：market「大三連包」、factory「大輸送箱」、nightmarket「老闆的巨無霸禮包」，都用 `boss.mul: 6` 起，跑模擬校準。

## 二、三連包（`enemy.triple`）
- `package` 變成三個子包 `sub: [{progress}, {progress}, {progress}]`，各需求 `H(k)/3`；**只有點擊有「指向」**：點擊落點在哪個子包（舞台三個子包並排在 x 330／392／454，各 100×120，命中用 `point.x` 最近者）就推進那個；被動與 burst 平均分給三個未拆完的子包。
- 三個都拆完才算完成一包（`completed +1`），溢出拆包力進下一組。
- 連續點擊命中**不同**子包（掃過去）第三下起每下額外 +15% 拆包力（`sweep` 加成，UI 浮字加「掃！」小章）；同一子包連點沒有加成。
- 舞台：三個小包用 `clicker-pack3-{0..4}.png`（五狀態，尺寸 100×120），拆完的那個先爆開（沿用單包爆開演出的 60%）並留在原地變成撕開狀態；三個都完成才整組滑出換新組。
- `#tap` 熱區維持珍母；**新增三個子包各自的熱區**（`pointer-events` 只開這三個），點珍母 = 平均分配三個。

## 三、輸送帶（`enemy.timer`）
- 每包進場時 `package.deadline = now + timer×1000`；到期未拆完 → `package.missed++`，該包丟棄（進度歸零、**不給幣、不扣東西**），下一包立刻進場。離線不算漏（離線只結算到 deadline 前）。
- 舞台：包裝坐在輸送帶上從右滑入 600ms（`translateX(240→0)`），帶面 `clicker-belt-track.png` 用 `background-position` 以 40px/s 捲動（只在可見時跑；輸送帶動畫屬於「有東西在動」，不算閒置）；剩 5 秒包裝開始抖（±2px、8Hz）＋警示燈 `clicker-belt-lamp.png` 閃紅（2Hz）；漏掉：包裝從左滑出 400ms＋「漏了！」浮字（灰）＋`tone 300→150 d .12 gain .05`。
- 統計面板加「漏掉 N 包」。

## 四、夜市限時大禮包（`enemy.gift`）
- 每隔 `everyMs` 隨機一次事件：老闆從攤位後探出（`clicker-gift-boss.png` 從 y+80 升起 300ms）、把大禮包丟到桌上（拋物線 500ms、落地 `scale(1.1,.9)` 90ms＋4px 震＋`sound('upgrade')`）；禮包需求 `4×H(k)`，限時 `seconds`；拆完 → 幣 ×`mul`（一次性加 `H_gift × (mul−1)` 幣，**不進拆包進度**）＋彩帶 30 片；過期 → 禮包縮小消失 300ms＋老闆縮回，什麼都不扣。
- 事件期間一般包照常（禮包是額外目標，點擊落在禮包熱區才打禮包；被動仍打一般包）。
- 存檔：`gift: { need, dealt, endsAt } | null`、`nextGiftAt`；隱藏視為過期。
- 倒數用第八輪王包的膠帶條樣式（縮小 60%）。

## 五、模擬與驗收
- `tools/sim/clicker-boss.js` 加三個場景的王與「輸送帶 20 秒內平均能拆幾包」、「三連包 sweep 對總 DPS 的加成」兩個指標；報告寫實際數字。
- `npm test`：三連包分配／sweep／完成判定、輸送帶到期／離線不漏、禮包命中與過期、存檔驗證。
- `tools/test/clicker-browser.py` 加 round11：三連包掃三下截圖、輸送帶剩 5 秒抖動、漏包浮字、禮包落地／過期，三場景各一張靜態圖與場景票券選單。
- `docs/clicker/REPORT-astra-impl-round11.md`。
