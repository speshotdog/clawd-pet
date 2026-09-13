# Codex 複檢 第十輪 C：重走廢土＋無盡模式（含第十輪 B 複檢修正）

分支 `balance-v3`。範圍：第十輪 B commit 之後到 HEAD（第十輪 C commit）。讀檔一律 `git show HEAD:路徑`。

## 這批做了什麼
1. **經濟**（`src/clicker-apoc-economy.js`）
   - `RULES.LAP = { MAX: 10, HP_FIRST: 10, HP_GROWTH: 1.1, POWER: .25 }`、`RULES.ENDLESS_MAX = 100`。
   - `lapsOf(a)`（壞值當 0、夾到 MAX）、`lapHp(a)`＝第 n 圈 HP_FIRST×HP_GROWTH^(n−1)、`lapPower(a)`＝1＋POWER×n。
   - `need(i, a)`、`reward(i, a)`、`killReward(i, a)` 多了 a；`freshMech(i, needHp)`；`power` 乘 `lapPower`。所有呼叫點都改帶狀態（fight、farm、settle 的 wave／win／farm、normalize 的舊血量換算、cleanMech）。
   - `replay(a)`：cleared 才能重走，laps+1；進度、金幣、訓練、王關狀態、技能冷卻、fx 歸零；收藏／隊伍／技能／券／戰績／外觀／引導保留。
   - `setEndless(a, on)`：cleared 才能開；關掉時進度 ≥ 20 的戰鬥丟掉。`canFight` 在 endless 時上限是 ENDLESS_MAX。
   - settle 打贏時 progress > 20 記 `endlessBest`。normalize：`laps`、`endless`（要 cleared）、`endlessBest`。view 多了 laps／endless／endlessBest／lapHp／lapPower／canReplay／nextLapHp／nextLapPower。
2. **存檔驗證**（`src/clicker-save.js:224`）：`apoc.progress <= 20` 改成 endless 時 ≤ ENDLESS_MAX（以前第 21 站 commit 被擋、畫面整個停住，batch_c 抓到）。
3. **UI**（`src/clicker-apoc-ui.js`）
   - cleared 事件改呼叫 `showEnding()`；結局面板多了說明行 `#apoc-lap-note` 與兩顆鍵：重走廢土（按兩次確定，第一次寫清楚會歸零什麼與下一圈倍率）、無盡模式／關掉無盡模式。
   - 戰績頁 `v.cleared` 時多一顆「全線通行選項」打開結局面板。
   - renderStage：`over = progress >= 20 && !endless`；無盡站標籤「無盡・第 N 站」；底部目標「第 N 圈・…」「無盡 第 N 站・最遠 ＋k」。
4. **第十輪 B 複檢修正**：引導第 2 步排除刷怪（Codex 10B 必修）；預告標籤同字不重設（值得修）。
5. 模擬（scratchpad `ngplus_sim.js`，一般玩家 CPS 3、在場一半）：HP_FIRST 3／4／6／10／16 → 第二圈 59／51／76／109／137 分，取 10（146 → 109 → 48 → 41 → 40）。

## 請檢查（找會壞的）
- 有沒有漏改的 `need(i)`／`reward(i)`／`killReward(i)` 呼叫點，讓第 2 圈某處血量或獎勵掉回第一圈（例如 normalize 舊血量換算、狗群血、殼的門檻、刷怪、wave 的下一隻、view.need、模擬器 tools/sim/apoc.js）？
- normalize 裡 `need(a.stage.index, a)` 用到的 `a.laps` 在夾值之前（`lapsOf` 自己有擋），壞存檔（laps: "9", 1.5, 1e9, -1）會不會讓血量 NaN 或換算錯？
- `replay` 保留／歸零的欄位合理嗎？有沒有該歸零沒歸零（`farmNextAt`、`bossFailed`、`cooldownUntil`、`fx`、`skillCd`、pending）或不該歸零被歸零的？重走中途在招募層／開包演出時按會怎樣？
- 無盡模式：到 ENDLESS_MAX 之後、王輸了回前一站刷怪（index ≥ 20）、關掉無盡時正在刷怪、重新整理頁面、1.0 那邊的存檔驗證（clicker-save.js 其他檢查、匯入存檔）有沒有會卡住或丟檔的地方？數字格式化到 2.1^100 等級會不會寫出 e+ 或 NaN？
- 結局面板：按兩次的 `replayArmed` 狀態在關面板、再從戰績頁打開、`store.blocked` 時會不會殘留；`apply` 失敗時畫面有沒有卡在 inert？
- 地圖（clicker-apoc-map.js 用 Math.min(progress, 19)）、音樂（musicFor 夾 19）、王圖（enemyArt 夾 19）在無盡站會不會拿到錯的東西或丟例外？
- 手機直式 390×844 與桌機：結局說明行、三顆鍵、戰績頁兩格新數字有沒有出界、截斷、字太小？

## 已跑過
- `npm test` 221 過（新增重走廢土、無盡模式兩個測試）
- `clicker-v3-apoc-play.py`、`clicker-ui-audit.py`、scratchpad `batch_b.py`／`batch_c.py`（桌機＋手機：結局兩顆鍵、按兩次才重走、第 2 圈血 ×10、戰績頁打開、無盡第 21 站開打、最遠 +1）

輸出：必修（附重現步驟與行號）／值得修／可以不修。繁體中文。
