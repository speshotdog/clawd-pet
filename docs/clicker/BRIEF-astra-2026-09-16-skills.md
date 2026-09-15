# 任務：2.0 技能豐富化（六型）＋王的抵抗＋單下傷害盾牌

設計全文：`docs/clicker/DESIGN-2026-09-16-apoc-skills.md`。使用者 2026-09-16 拍板：**方向對，凍結／續命不做**；為了平衡，**王要有抵抗效果、而且都要有「最大單下傷害盾牌」（不會被秒殺）**；**不能太破壞平衡**；希望當天上線。
你只做實作與模擬，不 commit；改完留在工作區，我驗收。

## 一、規則（照這個做，不要自己發明別的）

### 1. 六型技能：稀有度定強度、角色定型
`src/apoc/pool.js` 每張卡加 `role`（6 型之一）；`RULES.SKILLS` 改成 `SKILLS[role][rarity]`。
強度倍率：神話 ×1.6、傳說 ×1.3、史詩 ×1.0、精良／一般 ×0.7（套在「量」上；持續秒數與冷卻不乘）。

| role | 名稱（史詩級） | kind | 史詩級數值 | 持續／次數 | 冷卻 | text 範本 |
|---|---|---|---|---|---|---|
| open | 一口氣開封 | clickMul | ×5（神話 ×8、傳說 ×6.5、精良 ×3.5） | 12 下 | 60s | 接下來 12 次點擊 ×N |
| train | 全隊加訓 | powerMul | ×1.5（神話 ×1.8、傳說 ×1.65、精良 ×1.35） | 20s | 60s | 全隊戰力 ×N，20 秒 |
| reset | 重整 | cool | −8s（神話 −13、傳說 −10、精良 −6） | 即時 | 45s | 其他技能冷卻 −N 秒 |
| coin | 撿金幣 | coin | 每下點擊額外掉「這一站獎金 ×0.4%」的末世金幣（神話 0.64%、傳說 0.52%、精良 0.28%）；期間受擊噴的金幣粒子 ×2 | 20s | 75s | 20 秒內每下點擊多掉這站獎金 N% 的金幣 |
| breach | 破防 | breach | 立刻破防（王關：接 BOSS_MECH.BREAK 那條路、傷害 ×BREAK_MUL）；一般關：5 秒內所有傷害 ×2 | 5s（神話 8、傳說 6.5、精良 3.5） | 90s | 立刻破防 N 秒，傷害 ×2 |
| idle | 放置狂熱 | idle | 放置傷害的 IDLE_MUL 從 .35 變 1.0（神話 1.3、傳說 1.15、精良 .8） | 15s | 75s | 15 秒內放置傷害像在點一樣（×N） |

- 現有神話「一口氣開封」10 下 ×10 → 改成 open 型神話 12 下 ×8（略降，因為多了破防 ×2 可疊）。這是刻意的，不要調回 ×10。
- 技能名：同一型四階名字不同。**沿用現有 `oneSkillName`**（2.0 同名角色用 1.0 的技能名）；1.0 沒有同名卡的，用該型的預設名（上表）。
- `text` 要能直接給 `skillInfo()`／編隊 tooltip／推薦頁用，寫實際數字不寫 N。

### 2. `role` 的分配（71 張）
- 40 張跟 1.0 同名：照 1.0 的 `ClickerBalance.characters[id].kind` 對映——click／clickTime → open；team／self → train；reload／energize → reset；clickAdd → coin；burst／bossDamage → breach；passive → idle。
- 其餘 31 張：**每一個稀有度裡六型都要至少有一張**（神話 14 張、傳說 15、史詩 21、精良＋一般 21），照卡名／卡面氣質分，分完把表印出來給我看（寫在 HANDOFF）。
- 開門禮 `pufayueyue`（普發玥玥）固定 open 型（新手第一張卡要是「點下去有感覺」的）。

### 3. 王的抵抗（RULES.BOSS_MECH.RESIST）
王關（`isBoss(i)`）對技能有抵抗：
- open：點擊倍率超過 ×4 的部分打五折——`mul = 4 + (mul − 4) × .5`（神話 ×8 → ×6）。
- breach：破防秒數 ×0.6（史詩 5s → 3s），且**王關同一場只能被技能破防 2 次**（第 3 次起技能只給 ×1.3、3 秒，不觸發破防演出）。機制自己的破防（剝殼／節拍連中／部位）不受此限。
- coin：王關的獎金大，撿金幣改用「一般關的獎金基準」算（`reward(i−1)`），不然王關刷幣會失衡。
- train／reset／idle：不抵抗。
畫面上王關技能格要能看出來被抵抗：技能格 tooltip 末尾加「王關：抵抗，×6 / 3 秒」這種字（用 `skillInfo(id, {boss:true})`）。

### 4. 最大單下傷害盾牌（RULES.TAP_CAP）
任何一下點擊（`tapDamage`）對**當前敵人**的傷害上限＝敵人總血量 × CAP：一般關 CAP=.10、王關 CAP=.04（王最少要點 25 下才會死）。
放置傷害每秒也套同一個 cap（一般關 .10／秒、王關 .04／秒）。
浮字要顯示實際扣的（被 cap 到的那一下浮字加一個「盾」小字或換色，讓玩家知道封頂了）。
⚠ cap 是最後一道，套在所有倍率（含破防、加訓、王關機制的 HIT_MUL/BREAK_MUL）之後。

### 5. 平衡鐵律（不過就退回調）
`tools/sim/apoc.js` 現在 `SKILLS=1` 會在四格 canSkill 時全按（第 130 行）。你要：
- 讓模擬器認得六型（useSkill 走新表就自然認得；但 coin 的金幣要入帳、breach 的 ×2 要吃到、idle 要改 IDLE_MUL、TAP_CAP 要套）。
- 加一個簡單策略：王關先 train 再 breach 再 open；一般關照現在全按。
- 跑 `MARKS=1` 三種子（見 `DESIGN-2026-09-14-marks.md` §模擬）：**全破第 4～6 天、全滿養 ≤ 14 天**。改前先跑一次當基準記下來，改後再跑；兩組數字都寫進 HANDOFF。
- 另外跑 `SKILLS=0`（不放技能）確認沒有技能的玩家還是全破 ≤ 7 天（技能是加分不是門票）。
- 超出鐵律就調數值（優先調 coin 的 % 與 breach 的秒數），不要調 TAP_CAP 以外的其他系統。

## 二、畫面（`src/clicker-apoc-ui.js`＋`clicker.css`）
每型放技能時要有看得見的差別（使用者的重點）：
- coin：期間受擊噴出的金幣粒子數 ×2、點擊浮字變金色並多一行「+N 幣」；技能格亮金框。
- breach：王身上出現裂痕層（已有破防演出 `breakUntil` 的話直接沿用）、畫面抖一下；一般關用同一個裂痕層蓋在怪身上。
- idle：夥伴列全員加一個「衝」的動畫（沿用現有 buddy 動畫 class，加速即可），技能格亮橘。
- open／train／reset：沿用現在的。
不要新做圖；用現有粒子／CSS 就好。

## 三、要改的檔（提示）
`src/apoc/pool.js`（role）、`src/clicker-apoc-economy.js`（RULES.SKILLS／RESIST／TAP_CAP、skillOf／skillInfo／useSkill／tapDamage／settle 放置傷害／reward 入帳）、
`src/clicker-apoc-ui.js`（畫面）、`src/clicker.css`、`tools/sim/apoc.js`、
`src/clicker-apoc-economy.js` 的 `RECOMMENDATIONS`（六型之後模板要改成用 role：王關「train → breach → open → reset」、掛機「train ×2 → idle → reset」、農幣「coin ×2 → train → reset」、新手「train → reset ×3」、雙開封、全開封；`recommendTeam` 的 pattern 從稀有度改成 role，挑法一樣取該型戰力最高）。
推薦頁的格子文字（`clicker.js showRecommendations` apoc 分支）跟著顯示型的名字。

## 四、驗收必跑（全綠才算完成）
`npm test`（現 238，新規則要加單元測試：六型各一條、抵抗兩條、TAP_CAP 兩條、role 表每階六型齊全一條）；
`PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py`、`clicker-v3-apoc-recommend.py`（模板改 role 後要更新斷言）、`clicker-v3-team-tip.py`、`clicker-v3-beta-bosses.py`、`clicker-ui-audit.py`。
新增 `tools/test/clicker-v3-apoc-skills.py`：真的開一場一般關與一場王關，四型各放一次，量：coin 金幣有進帳、breach 期間浮字傷害 ×2、idle 期間放置扣血變快、王關單下浮字 ≤ 4% 總血、王關 open 浮字反映 ×6 不是 ×8。

## 五、回報
`docs/clicker/HANDOFF-2026-09-14-r12.md` 新開「### 25. 2.0 技能六型（2026-09-16）」：role 分配表（71 張）、六型四階數值表、抵抗與 cap 的實際數字、模擬器改前／改後的三種子結果、SKILLS=0 的結果、改了哪些檔、測試結果。
量不到／過不了的如實寫，不要編。

## 規矩
只改 `D:\claude\clawd-pet-balance`；不下載、不開 dev server（Playwright 直接 route src/）；不 commit；`src/apoc/holo-special.css` 不碰。
