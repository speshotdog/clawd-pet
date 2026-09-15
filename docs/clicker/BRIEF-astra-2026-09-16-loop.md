# 任務：2.0 輪迴模式（把「重走廢土」升級成有變異、有退路、有紀錄的輪迴）

設計全文：`docs/clicker/DESIGN-2026-09-16-apoc-loop.md`（使用者 2026-09-16 拍板「方向對」）。**照文件做，不要自己改規則**；文件沒寫到的細節照下面補充。
你只做實作與模擬，不 commit；改完留在工作區給我驗。

## 一、經濟層（`src/clicker-apoc-economy.js`）

### 1. 變異池 `RULES.MUTATIONS`
```
thick   厚甲   王血 ×1.3                      counter: breach
haste   倒數   王關期限 60 → 45 秒（bossTimeOf ×.75；買了 bossTime 的 +15 秒照加） counter: open
pack    狗海   SUMMON.COUNT 5→8、AGAIN 3→4     counter: idle
shell   硬殼   SHELL.AT 加一層 .25             counter: open
offbeat 亂拍   RHYTHM.WINDOW 200→140           counter: train
lock    反鎖   技能冷卻 ×1.25                   counter: reset
famine  缺糧   站獎金 ×.7                       counter: coin
waste   荒地   放置傷害 ×.5                     counter: open
harvest 豐收（正向） 站獎金 ×1.5、掉券率 ×2
echo    回聲（正向） 技能冷卻 ×.8
```
每個：`{ id, name, text, positive, counter }`。負向 8：正向 2，抽法＝每個位置獨立抽，同一圈不重複；正向不佔負向名額（抽到正向就是這圈少一個負向）。
`text` 要寫完整效果給 tooltip 用。

### 2. 狀態欄位（`fresh()`／`normalize()` 補齊，舊檔全部補預設）
- `a.mutations: string[]`（這圈生效的 id；第 0 圈＝還沒重走過＝空）
- `a.purse: number`（盤纏：重走時帶進來的金幣；`replay()` 把 `coins × .5` 存進去再把 coins 歸零，重抽變異從 purse 扣）
- `a.rerolled: boolean`（這圈免費換變異用掉沒）
- `a.bossStreak: { index, fails }`（同一隻王連敗計數；打贏或換站歸零）
- `a.lapLog: [{ lap, mutations, seconds, bossFails, dust, at }]`（圈末寫入；用 `a.lapStartedAt`／累計戰鬥秒數算用時——用現有的 `stats` 或加 `lapPlayMs` 只在有 stage 的 tick 累加）
- `a.lapChest: number`（累計從寶箱拿到的萬用粉塵，方便模擬與上限檢查）

### 3. 規則接線
- `replay()`：圈數 +1（上限 10 維持）、抽變異（第 1 圈 1 個、第 2～4 圈 2 個、第 5 圈起 3 個）、盤纏＝上一圈 coins 的一半、其餘照現有歸零。
- `rerollMutations(a, now)`：花 `RULES.LOOP.REROLL_COST`（末世金幣，建議＝這一圈第 1 站獎金 ×20，寫成常數並在 HANDOFF 記數字）從 `purse`（不夠再從 coins）扣，重抽全部；只能在**第 1 站還沒打**時用（`progress === 0 && !stage`）。
- `swapMutation(a, id)`：把一個變異換成池裡另一個（不重複、不保證正向）；免費一次／圈（`rerolled`），條件：`bossStreak.fails >= 3` 且該王是 `bossStreak.index`。連敗到 6 → `dropMutation(a, id)` 直接少一個（也免費，一圈一次）。
- 讀變異的地方：`need()`（thick 只乘王站）、`bossTimeOf()`（haste）、`M()` 的 SUMMON／SHELL／RHYTHM（pack／shell／offbeat——改成 `mechRules(a)` 回一份套過變異的 BOSS_MECH，所有讀 `M()` 的地方改讀它）、`useSkill` 的 cd（lock／echo）、`reward()`（famine／harvest）、掉券率（harvest）、放置傷害（waste）。
- 王關失敗：`bossStreak` 累加；勝利歸零。
- 圈末（打贏第 20 站、`cleared` 變 true 的那一刻）：`lapChest(a)` 算寶箱＝`min(3, 1 + 負向變異數 × 0.5 + (用時 < 20 分鐘 ? 1 : 0))` 取整，萬用粉塵入 `universalDust`、`lapChest` 累加、寫 `lapLog`。**每圈上限 3 顆、10 圈合計上限 30 顆**（`RULES.LOOP.CHEST_MAX`／`CHEST_TOTAL`）。第 0 圈（第一次全破）不給寶箱。
- 無盡：`setEndless(true)` 之後每過 10 站（第 30／40／…）加一個變異到 `mutations`（不重複、池抽完就停）；關掉無盡清回這一圈原本的。
- `view()` 多回：`mutations`（含 name／text／positive／counter）、`purse`、`rerollCost`、`canReroll`、`canSwap`／`canDrop`、`bossStreak`、`lapLog`、`lapChest`、`nextMutationCount`。
- 印記：**一枚都不加**。`markMilestones` 不動。

### 4. 推薦組合
`RECOMMENDATIONS` 前面動態插一組「這一圈的解法」：依 `mutations[].counter` 組 pattern（例：厚甲＋倒數 → breach／open／train／reset），名字「第 N 圈：解法」、desc 列出每個變異對到哪一型。沒變異（第 0 圈）不插。`recommendTeam` 照現有取戰力最高。

## 二、畫面（`src/clicker-apoc-ui.js`、`src/clicker-apoc-map.js`、`src/clicker.html`、`src/clicker.css`）
照設計文件 §三，逐項：
1. 頂列右上戰力那塊加一行 `#apoc-lap-line`：「第 N 圈 ・ [厚甲][倒數]」藥丸（`.mut-chip`，負向紅底、正向綠底），hover／點開 tooltip 寫 text 與「反制：破防型」。第 0 圈整行 hidden。
2. 地圖：標題旁「第 N 圈」徽章；地圖上方 `#map-mutations` 橫幅（同一組藥丸）＋右邊「重抽（N 金幣）」鍵（只在 canReroll 時出現，按兩次確認）；王站節點疊變異小圖示（用文字符號就好：厚甲 ⛨、倒數 ⏱、狗海 🐾、硬殼 ◈、亂拍 ♪；不要新圖），點站的說明面板加「這一圈：…」一行。
3. 全線通行面板 `#apoc-ending` 改三張卡（`.ending-card` ×3：輪迴／無盡／留在這一圈），內容照文件排版圖；手機直式（`max-aspect-ratio: 3/4`）改直排。「開始第 N 圈」按下 → 先 `replay()` → 蓋一層 `#mutation-draw`：三張牌背、翻開抽到的那幾張（CSS 翻牌 400ms，reduced-motion 直接顯示）→ 下面一行「這一圈的解法：〈推薦組合名〉」＋「去編隊」鍵 → 關掉進地圖。
4. 王關失敗結算加「這隻王連敗 N 次」；到 3 次出現「換一個變異（這圈免費 1 次）」鍵（點了列出這圈的變異讓玩家選哪一個換）；到 6 次出現「少一個變異」。
5. 圈末結算 `#lap-done`：「第 N 圈完成」、用時、變異、寶箱開出 N 顆萬用粉塵（數字滾動即可）、解鎖的配色（第 3／6／10 圈：HIT_FX 各加一個 `unlockLap: n` 的配色，末世商店顯示「第 n 圈解鎖」）；按「繼續」才進全線通行面板。
6. 戰績頁（`#stats`）在末世多一個區塊「輪迴紀錄」表：圈數｜變異｜用時｜王關失敗｜寶箱；底下「無盡最遠 第 N 站」。
全部不要新做圖。

## 三、模擬（`tools/sim/apoc.js`）
- 加變異（照 replay 規則隨機）、盤纏、寶箱粉塵、連敗退路（模擬玩家：連敗 3 次就換變異）。
- 跑 `MARKS=1` 三種子（CPS=3 TAP_SHARE=.5 START_MARKS=0 KEEP=1 SKILLS=1，SEED 20260913／14／15，20 分 ×3 場／天 ×14 天）：**全破 4～6 天、全滿養 ≤14 天**——寶箱是新的粉塵來源，滿養那條最可能被推前，超出就先降寶箱（每圈上限 3 → 2）。
- 另外印：14 天內走到第幾圈、每圈用時、寶箱合計。改前（現在的重走）也跑一次當基準。

## 四、驗收必跑（全綠才算完成）
`npm test`（現 251；新規則要加單元測試：變異抽選不重複／數量、每個變異真的改到對應數字、replay 盤纏、reroll 扣錢與條件、swap／drop 的連敗條件與一圈一次、寶箱上限與第 0 圈不給、無盡每 10 站加變異、normalize 舊檔補欄位）；
`clicker-v3-apoc-play.py`、`clicker-v3-apoc-recommend.py`、`clicker-v3-apoc-skills.py`、`clicker-v3-beta-bosses.py`、`clicker-v3-beta-resident.py`、`clicker-v3-portrait.py`、`clicker-ui-audit.py`。
新增 `tools/test/clicker-v3-apoc-loop.py`：真的走「全破 → 全線通行三張卡 → 開始第 1 圈 → 翻牌 → 頂列與地圖有藥丸 → 王站圖示 → 連敗 3 次出現換變異鍵並真的換 → 圈末結算寶箱數字 → 戰績頁有紀錄」，桌機＋手機直式各一次，截圖存 `_art/out/v3-apoc-loop/`。

## 五、回報
`docs/clicker/HANDOFF-2026-09-14-r12.md` 新開「### 29. 2.0 輪迴模式（2026-09-16）」：變異表與實際數字、常數（REROLL_COST／CHEST）、模擬改前／改後、改了哪些檔、測試結果、量不到的如實寫。

## 規矩
只改 `D:\claude\clawd-pet-balance`；不下載、不開 dev server、不 commit；`src/apoc/holo-special.css` 不碰；印記一枚不加。
