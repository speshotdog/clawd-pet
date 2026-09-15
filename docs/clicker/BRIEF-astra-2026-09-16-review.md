# 複檢簡報（2026-09-16，給 GPT-6 Astra）：朋友三條建議＋玩物就玩物新卡接入

你是**複檢者**，不是實作者。`-s read-only`，不要改任何檔案、不要 build、不要起 server、不要 commit。
讀原始碼、必要時自己跑 `npm test`／`node --test tools/test/clicker-apoc-presets.test.js`。
產出一份 markdown：每一條發現寫 **檔案:行號、嚴重度（必修／建議／備註）、重現方式或推理、建議修法**；最後一行給退出碼 `EXIT 0`（可上線）或 `EXIT 1`（有必修）。
沒有發現就寫「沒有發現」，不要湊數。

## 基底
worktree `D:\claude研究\clawd-pet-v3`，`balance-v3 = origin/balance-v3 = 7977a9d`，以下改動**未 commit**（`git diff` / `git status` 看得到）。
試玩版已佈：https://zhenmu-dots-beta.clawd-pet.workers.dev （Workers 版本 `a440f1a1`）。

## 這一輪改了什麼（請對照 `git diff`）

### A. 朋友的三條建議（Discord 截圖，2026-09-16）
1. **儲存隊伍**：「一直切技能的情況下，滿需要有儲存隊伍的功能」。
   - `src/clicker-apoc-economy.js`：`RULES.PRESETS=3`、`normalize()` 清 `a.presets`、新增 `savePreset(a,i,name)`／`applyPreset(a,i)`（套用時過濾不在卡冊／派遣中的卡，其餘交 `setTeam` 照上限規則）。
   - `src/clicker-team.js`：編隊標題下一排三組（`renderPresets`／`savePresetAt`／`applyPresetAt`）；名字自動取技能槽的型；非空格「存」要按兩次才覆蓋（3 秒武裝）。1.0 也有（存 `state.teamPresets`，套用走 `E.setRoster`＋`E.equip` 逐格）。
   - 單元測試 `tools/test/clicker-apoc-presets.test.js`；實機 `tools/test/clicker-v3-presets.py`。
2. **技能類型分類**：「技能類型能夠分類也比較好組隊」。
   - `clicker-team.js`：挑選器上方一列篩選藥丸（全部＋六型，`roleFilter`，只影響候選列、換出列不篩）；卡片右下角 `.proxy-role` 型標籤（末世才有）。
3. **技能效果剩餘顯示**：「相同類型的技能不能乘上去的話，應該要有個顯示表示技能效果還有多久完，不然不知道什麼時候才要按下一個」。
   - `src/clicker-apoc-ui.js`：`effectLeft(def,v,now)`（open 剩幾下＝`fx.clickLeft`；train／coin／idle 到期；breach 看 `stage.breakUntil`／`breachFallbackUntil`；reset 無）；格子 `data-effect="on"`、`.skill-left` 標籤、`.skill-ring` 綠環（`--effect` 角度）。同型兩格都會亮（效果是型的狀態不是格子的，正好對到「同型覆蓋不相乘」）。
   - `src/clicker.css` 末段：樣式；手機直式（`max-aspect-ratio:3/4`）標籤改貼貼紙上緣。
   - `src/update-notes.js` VERSION `2026-09-16c`＋一條文案。

### B. 玩物就玩物改 depth 卡（作者給 PSD 拆分）
- `src/clicker-holo.js` `face()` 加一行 `HoloCardFx.apply`；`src/clicker.html` 多載 `apoc/card-fx.js`；`src/apoc/ceremony.html` 手改兩行（同上）。
- `tools/apoc/build_holo.py`：用 `card_assets.keys()`、只合併 `masks-5.0.json` 裡 `layer-*` 的遮罩、複製 `card_fx.js`、pool 帶 `fx`、css 接 `card-fx.css`；`build_ceremony.py` script 標籤。
- 產物：`src/apoc/card-fx.js`、`pool.js`（只有 wanwumythic 一筆變：flat→depth＋fx）、`holo.css` 尾端 append、三張 `art/`＋三張 `art-thumb/` 圖層、一張 `masks/`。
- 上游來源在 `D:\claude研究\clawd-pet-50\_art\holo-test`（`card_fx.js`、`card-fx.css`、`pool_data.OVERRIDES`）。

## 特別想請你看的
1. `applyPreset` 與 `setTeam` 的互動：技能槽裡的卡不在 roster 時是否正確清掉；派遣中的卡被過濾後 `skills` 對齊；`normalize` 對舊存檔（沒有 `presets` 欄位）與匯入壞資料的行為。
2. 1.0 那條路（`applyPresetAt` 的 `E.setRoster`＋`E.equip` 迴圈）：`equip` 有「裝技能＝自動編入隊伍」與「隊伍沒位子」的例外，逐格裝會不會踩到；`E.equip(next,k,null,now)` 清槽的順序對不對。
3. `effectLeft`：`breachFallbackUntil` 的顯示、王關 `RESIST` 之後 `def.ms` 與實際時長不同（王關 breach ×.6）→ 環的比例會不準，要不要用實際時長；`fx.clickLeft` 在王關抵抗下的計數。
4. `renderSlots` 的重建鍵 `slotKey` 沒含 fx 狀態——`updateSlots` 每 tick 都跑所以應該沒問題，請確認 `tick()` 的呼叫路徑在戰鬥外（沒有 stage）時 `effectLeft` 不會丟例外。
5. `card-fx.js` 的呼叫點是否漏了哪個建卡入口（卡冊詳情、編隊、挑選器、夥伴列、典藏包、收藏卡走 `collect` 分支）；`data-small` 小卡不跑動畫的規則有沒有把別張卡的東西關掉。
6. 存檔驗證 `clicker-save.js` 對新欄位（`apoc.presets`、`teamPresets`）有沒有需要補的 check；`export`／`import` 路徑。
7. 任何你在 `git diff` 裡看到、跟這輪無關但明顯壞掉的東西（列出就好，標「與本輪無關」）。

## 已知、不用再報
- `tools/test/clicker-v3-teamui.py` 在乾淨 HEAD 就紅（`#t20-picker-confirm` disabled）。
- `_art/holo-test/check_card_identity.py`（上游 repo）在 HEAD 就紅。
- 字型 `src/apoc/fonts/` 這輪沒動（build_holo 會蓋掉，已 `git restore`）。

## 產出檔
寫到 `docs/clicker/VERDICT-2026-09-16-presets.md`（用 `-o`）。
