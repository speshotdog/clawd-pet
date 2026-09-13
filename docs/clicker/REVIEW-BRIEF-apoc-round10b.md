# Codex 複檢 第十輪 B：王前預告關、2.0 新手引導、全線通行結局

分支 `balance-v3`，對照 commit `5761a51`（第十輪 A）之後的未提交變更（`git diff`）。

## 這批做了什麼
1. **王前預告關**（`src/clicker-apoc-ui.js` renderStage）：一般站 index %4 === 2（王前一站）、非刷怪時，
   `#stage` 加 `apoc-omen`（CSS 一圈暗紅、只動 opacity）、`#effect-label` 加 `omen` 並寫「前方預告・王名｜打法」（`OMEN_HINT`）。
2. **2.0 新手引導**（`coach(v)`）：`apoc.tutorial` 0～4。四步 `COACH[step]` 條件成立就在舞台上方冒紙片 `#apoc-coach`，
   按「知道了」`apply(x => ({...x, tutorial: at+1}))`。進度 ≥ 4 的舊存檔不冒。紙片出現時 `#stage.coaching` 把效果標籤移到血條上方。
   經濟 `normalize` 把 tutorial 夾成 0～4 整數。
3. **結局數字**：`cleared` 事件時 `#apoc-ending-stats` 填六格（打贏、點擊、最高一擊、破防、招募、收藏），全部 textContent。
4. `leave()` 收掉 `apoc-omen`／`coaching`／紙片。
5. 順帶：第十輪 A 後的 CSS（末世商店標題列高、招募按鈕列高橫式限定、手機效果標籤 20px 置中）。

## 請檢查（找會壞的，不要風格建議）
- 「知道了」按鈕在 `#stage` 裡：pointerdown／click 會不會同時被舞台當成點怪（clicker.js 的 #tap pointerup 換算、末世舞台整塊是點擊區）？
- `coach()` 每個 render（tick 每秒數次）都跑：有沒有每次重建 DOM、改 textContent、toggle class 造成閒置時的多餘重排？
- 引導在招募層、開包演出、地圖、結局面板打開時會不會蓋在上面或搶焦點？`store.blocked` 時？
- 預告標籤跟王關標籤共用 `#effect-label`：從預告站打完進王站、王站輸了回前一站刷怪（index 2 的刷怪）時 class／文字會不會殘留（`omen`、`broken`、`urgent`）？
- 刷怪中的第 3 站（王輸了回 index 2 刷）不該出預告——`!v.stage.farm` 有擋，farmGap（兩場之間 1 秒沒有 stage）呢？
- `tutorial` 舊存檔／壞值（字串、負數、小數、NaN）normalize 後都合法嗎？
- 結局 `v.stats` 缺欄位時不會出 NaN／undefined 字樣？
- 手機直式（390×844）與桌機（1280×860）：引導紙片、預告標籤、結局六格有沒有出界、疊在一起、字小於 11px？

## 已跑過
- `npm test` 219 過；`clicker-v3-apoc-play.py`、`clicker-ui-audit.py` 全過
- scratchpad `batch_b.py`（桌機＋手機）：引導四步、真的點「知道了」、預告第 3／11 站、一般站沒預告、引導＋王關標籤不重疊、結局六格在畫面內，全過

輸出格式：必修（會壞／會誤導玩家）逐條附重現步驟；值得修；可以不修。
