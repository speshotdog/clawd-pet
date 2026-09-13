# 複檢請求：第八輪——地圖接縫、王圖、2.0 換桌布、每站 BGM＋神話技能 BGM、手機 UI 修正（balance-v3，對 `1fdbfa1` 的未 commit 工作樹）

你是唯讀複檢。請讀 `git diff 1fdbfa1`（新檔 `src/apoc/boss/*.png` 也算），找出**會讓玩家看到錯誤、卡住、丟進度、聽到錯的音樂或音樂停不下來、或讓 1.0 被弄壞**的問題。
結論分成「必修」「值得修」「不用修（說明為什麼）」，每條附檔案與行號、重現步驟、建議修法。用繁體中文。
⚠ 使用者規則：效能規矩只管閒置狀態，演出中的重量不能砍。

使用者這一輪的原話與定案、每一項的做法見 `docs/clicker/HANDOFF-2026-09-13-v3.md` 〇之十二。

## 請特別看

1. **`src/clicker-music.js` 換曲**：`current()` 的 key 在 1.0 讀 `#stage.dataset.scene`、末世讀 `ClickerApocMap.musicFor(state.apoc)`。
   - 換 key 時場景曲與技能曲都重建：舊技能曲正在放、正在淡出（`fadeKind==='skill'`）、正在 suspend 淡出時會不會留下停不掉的 transport、斷線的 gain、或 `afterFade` 的計時器去停到新的那一軌？
   - 末世每秒 tick 都呼叫 `sync()`：`revision` 與 `await ctx.resume()` 會不會讓連續呼叫互相取消、造成神話技能曲一直起不來？
   - 1.0 的王包／技能行為有沒有被改到（`battle` 在 1.0 的判斷、`effectsAlive` 的到期計時器）？
2. **`fx.mythic`**（`src/clicker-apoc-economy.js`）：舊存檔沒有這個欄位、`normalize` 清理、神話技能還沒用完就換站／刷怪／切世界／輸了王、傳說卡接在神話卡後面放（`clickMul` 被覆寫但 `mythic` 被改成 false）、技能祝福。
3. **2.0 按換桌布**（`src/clicker-prestige-ui.js` `doPrestige` 的末世分支、`src/clicker.js` `prestige-open`）：1.0 的進度照樣重來，但 1.0 的舞台是停著的——回到 1.0 時場景有沒有正確掛上、`ClickerScene.mount` 沒跑會不會留下舊場景？印記加成改變後 2.0 的 boost 有沒有馬上更新？
4. **Esc 修法**（`src/clicker.js`）：網頁版不再呼叫 `closeWindow()`。有沒有別的地方依賴 Esc 來 suspend（測試、Tauri 判斷 `TAURI` 在網頁版一定是 falsy 嗎）？
5. **王圖**（`src/clicker-apoc-ui.js` `BOSSES`／`renderStage`、`src/clicker.css` `.apoc-sprite`）：寬高寫在 inline style，換到一般站（單張 `monster-*.png`）時有沒有清掉；直式縮放；`--frames` 是 1 時；`prefers-reduced-motion`。
6. **地圖疊合**（`OVERLAP` 與 CSS 的 22%）：站點百分比、連線（量節點）、捲動、直式。

## 驗收（我這邊跑過的）

見本輪回報：`npm test`、`clicker-v3-apoc`／`apoc-play`、`clicker-browser.py`、UI 體檢、BGM 驗證腳本、手機 390×844 巡檢截圖。
