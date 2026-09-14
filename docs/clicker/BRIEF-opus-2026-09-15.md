# 任務書：公測前的收尾（2026-09-15，Fable 規劃、Opus 實作、Fable 驗收）

工作區 `D:\claude\clawd-pet-balance`（分支 balance-v3）。**不要動任何平衡數字**（`RULES`、`B.V3`、`ARTIFACT_APOC`、印記來源），那些剛過模擬。
每個任務做完要能用下面的指令自己驗：
- node：`for f in tools/test/*.test.js; do node $f; done`（21 檔全過）
- Playwright：`PYTHONIOENCODING=utf-8 python tools/test/<名字>.py`（測試用 `ctx.route` 從 src 直接餵檔，不用起伺服器；範本看 `tools/test/clicker-v3-collect.py`）
- 存檔測試種子：`tools/apoc/make_full_save.py` 產的全開存檔在桌面 `珍母點點-全開存檔.txt`；載入法看 scratch 範本：`ClickerExtras.decodeSave(blob)` → `sessionStorage.setItem('test-seed', JSON.stringify(s))` → reload
- 已知：`tools/test/clicker-browser.py` 長年紅且每次紅在不同行，不用理它

改完的每個任務在 `docs/clicker/HANDOFF-2026-09-14-r12.md` 最下面補一節（做了什麼、怎麼驗、踩了什麼）。**不要 commit**，驗收後由 Fable 提交。

---

## 群組 A（只准動：`src/clicker-apoc-ui.js`、`src/clicker-apoc-economy.js`、`src/clicker-extras.js`、`src/clicker-prestige-ui.js`、`src/clicker.js`、`src/clicker.html`、`src/clicker.css`、`tools/test/clicker-apoc-economy.test.js`、新的 `tools/test/clicker-v3-beta-*.py`）

### A1. 徽章彈窗卡住：把原始情境做成測試
真兇已修（`clicker-extras.js` `suspend()` 現在會 `pop.hidden = true`），但沒有測試重現。
做：`tools/test/clicker-v3-beta-badge.py`——載入一個「再打贏一隻王就拿到 王5 徽章」的存檔（`bossWins` 四隻、王包就緒），
用 `ClickerEconomy` 讓王包結束並拿到徽章，**在 1.8 秒內**觸發 `document.dispatchEvent(new Event('visibilitychange'))`＋把 `document.hidden` 模擬成 true
（或直接呼叫遊戲的 suspend 路徑，看 `clicker.js` 的 `suspend()` 綁在哪個事件），再切回來。
驗收：`#badge-pop` 在切回來後 2.5 秒內 `hidden === true`；把 `suspend()` 裡的 `pop.hidden = true` 拿掉這支測試要變紅（負控制，做完要真的試一次再放回去）。

### A2. 全破後的常駐怪不要走到王
現況：全破後 autoFight 用回顧路在第 18 站常駐，而回顧現在是「走完一段」，所以變成 18 → 19（真・滅世珍獸，60 秒機制王）→ 18 循環。
掛機賺錢的人不該一直被 60 秒王打斷。
做：`clicker-apoc-economy.js` `revisit(a, now, i, { walk = true } = {})`：`walk:false` 時 `stage.resident = true`，settle 的回顧分支看到 `resident` 就**不推 revisitAt**（永遠留在同一站）。
`clicker-apoc-ui.js` autoFight 裡「全線通行之後場上不要空著」那條改用 `walk:false`；玩家從地圖手動「重打這一站」照舊走完一段。
`normalize` 要保留 `stage.resident`。標籤：常駐照舊寫「常駐」。
驗收：單元測試——cleared、progress 20、`revisit(a, now, 18, {walk:false})` 連殺 WAVES 隻之後 `revisitAt` 仍是 18、stage 重生後 index 18 且 `boss=false`；手動 `revisit(a, now, 18)` 走完仍到 19 且 boss。

### A3. 「隊伍 21/20」
`gift()`（開門禮）在 roster 已滿 20 時仍會加人。做：roster 滿了就只給券與卡、不入隊。加單元測試。

### A4. 印記商店的導線（2.0）
2.0 玩家要買第四技能槽／派遣位得先想到「換桌布」面板。做：
- 2.0 的技能列第四格上鎖時，點它**直接打開**印記商店的「神器與商店」分頁（看 `clicker-prestige-ui.js` 的分頁切換函式，加一個可從外部呼叫的 `openMarks()`）。
- 2.0 的商店面板（`clicker-apoc-ui.js` 末世商店，`sec('兌換所', …)` 附近）加一個區塊「印記商店」：一行說明＋一顆「前往」鍵，同樣呼叫 `openMarks()`。
- 派遣面板派遣位滿時的錯誤訊息後面加「（印記商店可買第 4 位）」。
驗收：Playwright `clicker-v3-beta-marks-nav.py`——沒買 slot4 的存檔進 2.0，點第四格 → `#prestige` 面板可見且分頁是神器與商店；商店面板有「印記商店」鍵、點了同樣結果。

### A5. 診斷複製鍵＋更新說明
- 存檔頁（`#io-*`，看 `clicker-extras.js` 的 io 區塊）加一顆「複製診斷」：複製 JSON——`版本（dist 的 ?v=，抓 document.scripts 裡 clicker.js 的 src 參數）、UA、devicePixelRatio、視窗尺寸、prefers-reduced-motion、settings.world、apoc.progress／laps／revisitAt、marks／marksClaimed／markShop／artifacts、collection 張數、最近三則 notice 文字`。
  用 `navigator.clipboard.writeText`，失敗時把文字塞進 `#io-text` 讓玩家自己複製。
- 更新說明：存檔載入後若 `s.seenNotes !== NOTES_VERSION`（新欄位，`clicker-save.js` 只需要 `??=`，不要加驗證），彈一頁「這次更新改了什麼」（借 `#daily-done` 那種小面板的樣式，做新的 `#update-notes`），內容從 `src/update-notes.js` 的常數讀（Fable 會寫文案，你先放三條佔位）。看過按「知道了」就寫回 `seenNotes`。
驗收：Playwright——新存檔載入看得到面板、按了之後 reload 不再出現；複製診斷在 headless 用 `context.grant_permissions(['clipboard-read','clipboard-write'])` 後 `navigator.clipboard.readText()` 讀得到含 `world` 的 JSON。

## 群組 B（只准動：`tools/test/*`、`src/clicker-holo.js`、`src/apoc/collect-face.js`、`src/apoc/collect.js`、`tools/apoc/build_collect_card.py`）

### B1. 全部王關真打一場的截圖工具
`tools/test/clicker-v3-beta-bosses.py`：1.0 七個場景各真的開一場王包（`ClickerEconomy.startBoss` 需要 `canBoss`：看 `clicker-economy.js` 的 `canBoss`，把 `package.index`、`runWins`、`bossWins` 設到能開），
2.0 六個站（第 1／4／8／12／16／20）用真實進度載入讓 autoFight 開場。每一場在**開打 1 秒後**截 `#stage` 的圖存到 `_art/out/beta-bosses/`，
並量：王圖層 rect 與四顆 `.skill-use` rect 不相交、血條（1.0 `#boss-view` 裡的血條、2.0 `#package-progress`）在舞台內、`elementFromPoint` 打在四顆鍵中心都回 `.skill-use`。
驗收：13 張圖全部產出、量測全過；Fable 會逐張看圖。

### B2. 手機記憶體：量＋減
- `tools/test/clicker-v3-beta-mobile-mem.py`：375×812、DPR 3，用 CDP `Performance.getMetrics` 的 `JSHeapUsedSize` 與 `Memory.getDOMCounters`，
  在「主畫面 → 卡冊翻 9 頁 → 收藏卡頁 → 回主畫面」四個時點各量一次，印表；門檻：JS heap 任一時點 ≤ 150 MB、回主畫面後不高於進卡冊前的 1.3 倍（沒有洩漏）。
- 收藏卡的替身動畫 2.5 MB（`collect-face.js` 的 `altImg`）現在建卡就載；改成**進收藏卡頁才 fetch、離開就釋放**（`sweepCollect` 已有釋放，補「延遲載入」那一半）。
  卡冊縮圖（`.album-slot` 裡的收藏卡）不載替身。
驗收：量測腳本兩個門檻過；`clicker-v3-collect.py` 仍全過；收藏卡頁的替身動畫仍會播（該測試有檢查 `hearts`／`tint`，替身看 `collect-face.js` 的 `enhance`）。

### B3. 黑角測試的負控制
`tools/test/clicker-v3-black-corner.py` 的負控制注入壞寫法後判準不會變紅。查清楚典藏包的卡面為什麼吃不到注入的樣式
（很可能是 shadow root——第十二輪下半場之後樣式表是 `adoptedStyleSheets`，外面 `<style>` 進不去；要注入就得往每個 `.holo-face` 的 `shadowRoot.adoptedStyleSheets` 追加一張），
修到負控制會紅、正控制會綠。

## 群組 C（別的工作區）

### C1. 三條華麗卡牌分支的字型腳本
`D:\claude\clawd-pet-holo`（holo-cards）、`D:\claude\clawd-pet-gift`（holo-gift）、`D:\claude\clawd-pet-50`（holo-5.0）各自的 `build_round4_fonts.py`：
只設 `Options.text` 沒呼叫 `subsetter.populate(text=…)`，會安靜產出 996 bytes 的空字型。
照 balance-v3 的 `tools/apoc/build_fonts.py` 修（有「卡面必備字」檢查與檔案大小下限）。三個工作區各自跑一次、確認產出的 woff2 > 100 KB、必備字都在。
**這三個工作區可以 commit**（各自分支），訊息寫清楚。不要 push。
