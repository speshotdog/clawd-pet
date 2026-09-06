# 珍母點點 第十三輪實作：輪迴（換桌布）＋印記商店＋電動手指＋夥伴個別訓練＋桌面裝飾（可寫檔）

先 `git log -4`（第八～十二輪已合併）。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、`tools/sim/*`、`docs/clicker/REPORT-astra-impl-round13.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動。不 build、不起 server、不 commit。演出「可以更好，不能更淡」。素材檔名寫死（`clicker-scene7-*.png`、`clicker-ui-mark.png`、`clicker-ui-finger.png`、`clicker-deco-{0..9}.png`），缺檔 `onerror` 隱藏。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 第 6、7 節。

## 一、輪迴「換一張新桌布」（`E.prestige(state, now)`）
- 開放：`lifetimeCoins ≥ 1e8`。可領印記 `floor(sqrt(lifetime/1e8)) − marksClaimed`，≥1 才能重開。有 pending 招募或王包進行中不能重開。
- 清除：`coins, clickLevel, trainingLevel, autoClick, partnerLevels, package(回 index 1), settings.scene(回 backyard), bossCrack, gift, daily.done`。**保留**：`collection, dust, universalDust, promotions, transcend, paidDraws, pity, bossWins（王保留，但下次再打門檻減半的規則寫成 `unlock.packages × .5`）, claimedMilestones/badges, owned.wardrobe, marks, markShop`。技能效果全清、CD 從 0 開始（不是滿 CD，讓重開第一分鐘有事做）。
- 永久倍率 `M = 1 + .05 × marks`，進 `rates()`：`P = M × B × 1.15^T × rewardMul`、`D = M × 1.18^L + .05P`（照設計文件，不重複乘）。
- 演出：確認面板（紙板，寫清楚保留與清除各一列、可領印記數、新倍率）→ 按「換桌布」：整張桌子（`#game-content`）向上捲起 600ms（`transform-origin top`、`rotateX(0→-90deg)`＋陰影），黑一格 80ms，新桌布從下方展開 600ms（`rotateX(90→0)`），同時 `GachaAudio` 傳說揭曉音＋整桌震 8px；重開後第一次 `numbers()` 的印記數字用金粉「到站才跳」（沿用塵的做法）。
- 提示便條：最近 10 分鐘的每秒收益 < 本輪巔峰 15% 且可領印記 ≥ 1 → 舞台左上出便條「桌子有點滿了，要不要換桌布？」（`clicker-ui-paper.png` 小紙條＋膠帶），點了開確認面板；一天只出一次。

## 二、印記商店（輪迴面板第二頁，只能用印記買，永久）
| id | 名 | 印記 | 效果 |
|---|---|---:|---|
| slot4 | 第四技能槽 | 3 | `slotThresholds` 多一格 0；連鎖窗第四段 ×1.9 |
| offline12 | 離線 12 小時 | 2 | `offlineMs = 12h` |
| chain2 | 連鎖窗 +2 秒 | 2 | 與玥玥羈絆相加 |
| starter5 | 開局送五連 | 1 | 每次重開 `freeDraws += 5` |
| crack75 | 王包裂痕 75% 起跳 | 2 | `crackKeep = .75` |
| rooftop | 新桌布「屋頂星空」 | 5 | 第七場景（純外觀＋BGM，requirementMul 同當前場景），素材 `clicker-scene7-*`（sky 星空／far 城市剪影／mid 水塔與晾衣繩／ground 屋頂／props 三件／drift 流星×2／particles 星塵） |
買了寫 `markShop[id] = true`；`marks` 扣除。面板上每項一張票券（`clicker-ui-ticket.png`）＋印記小圖 `clicker-ui-mark.png`。

## 三、電動手指（商店第四張升級卡）
- `autoClick` 0–6 級，價 `5000 × 2.2^L`，每級每秒自動點 .5 次（6 級 3 次／秒），走 `E.click()` 同一條路（吃倍率、消耗次數型效果、算連點但不算「手點」統計）；上限與手點 8 次／秒分開計。
- 舞台：一隻小小的機械手指 `clicker-ui-finger.png`（48px）站在珍母右肩，每次自動點擊做 120ms 的戳一下（`rotate(-12deg→0)`）＋普通點擊粒子 4 片（手點的一半）；音效不播（避免噪音），但點擊浮字照出。

## 四、夥伴個別訓練（展示頁第四顆鍵「訓練」）
- `partnerLevels[id]` 0–100，價 `50 × 1.5^L`（幣），每級 `individual ×(1+.05L)`。
- 里程碑 25／50／75／100 給技能副軸：`charges+1`（次數型）／`duration+2s`／`cd×.95`／效果量 `×1.1`（各一次，四個里程碑分別給四種；非次數型的第一個里程碑改給 `duration+2s`）。展示頁顯示「Lv.37・下一里程碑 50：冷卻 −5%」。
- 訓練成功演出：大卡 `scale 1.04` 100ms＋`sound('upgrade')`；里程碑時多一次星列閃。

## 五、桌面裝飾（更衣室第三欄）
- 10 件 `clicker-deco-{0..9}.png`（花盆、燈串、小鼓、風鈴、貓抓板、相框、香氛蠟燭、小旗串、多肉、留聲機），價 `max(20000, P × 3600)` 幣，各 +1% 全隊（`decoMul = 1 + .01 × 擁有數`），買了放進當前場景的 `props` 空槽（每場景三個裝飾槽，座標寫在場景設定 `decoSlots`），輪迴不清。

## 六、驗收與交付
- `npm test`：prestige 清除／保留清單逐欄位、印記計算、M 進 rates 不重複乘、印記商店六項、電動手指節奏與次數型消耗、夥伴訓練里程碑、裝飾倍率。
- `tools/test/clicker-browser.py` 加 round13：確認面板、桌布捲起 300ms、印記到站、印記商店、電動手指戳 60ms、訓練里程碑閃、裝飾入場景、提示便條。
- `docs/clicker/REPORT-astra-impl-round13.md`。
