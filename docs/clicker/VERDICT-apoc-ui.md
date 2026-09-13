這輪**還不能算通過複檢**。共用 1.0 介面的方向合理，但兩套 renderer 共用 DOM，卻各自保留快取與事件處理，已經產生實際漏接；只補 `apocMode()` 的幾個入口不夠。

已讀簡報與五個 commit。以下以靜態追蹤及唯讀 Node 記憶體測試為依據；沒有改檔、build、起 server 或 commit，也沒有執行會輸出截圖的體檢器。

**1．正確性：世界分流與介面還原**

- **一定要修｜切回原桌邊場景時，技能槽快取仍認為 DOM 有效。**  
  [clicker.js:260](D:/claude研究/clawd-pet-v3/src/clicker.js:260)、[clicker.js:718](D:/claude研究/clawd-pet-v3/src/clicker.js:718)、[clicker-apoc-ui.js:129](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:129)。  
  路徑是「桌邊 → 末世 → 原本桌邊場景」：桌邊 collection／skillSlots 沒變，所以 `slotsKey` 相同，跳過重建；但槽位已被末世換成四格，而且沒有桌邊期待的 `<small>`。[第 286 行](D:/claude研究/clawd-pet-v3/src/clicker.js:286) 會對 `null.textContent` 賦值。外層 `action()` 雖會清快取重畫，仍是切換流程中途拋錯。夥伴列的 [teamKey:208](D:/claude研究/clawd-pet-v3/src/clicker-stage.js:208) 也有同類問題，可能留下末世頭像。切世界必須讓所有共用節點的 renderer 快取失效。

- **一定要修｜商店還原只修了標題，沒有還原隱藏狀態。**  
  [clicker-apoc-ui.js:155](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:155)、[第 158 行](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:158)、[第 209 行](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:209)。  
  末世設成 `hidden=true` 的 `click-max`、`training-max`、`training-ticket`，離開時都沒還原。桌邊 [numbers():194](D:/claude研究/clawd-pet-v3/src/clicker.js:194) 只更新內容與 disabled，切回後兩顆「最多」及訓練價牌會繼續消失。

- **一定要修｜拖曳漏掉整套世界轉接，可能直接修改桌邊技能。**  
  [clicker-drag.js:28](D:/claude研究/clawd-pet-v3/src/clicker-drag.js:28)、[第 36 行](D:/claude研究/clawd-pet-v3/src/clicker-drag.js:36)、[第 71 行](D:/claude研究/clawd-pet-v3/src/clicker-drag.js:71)；接入點是 [clicker-team.js:179](D:/claude研究/clawd-pet-v3/src/clicker-team.js:179)。  
  拖曳影像固定查 `GachaPool`，落點固定受桌邊 `E.slotCount()` 限制，第四格永遠無法拖入。主畫面的預設 drop 更直接呼叫 `E.equip(store.state, ...)`：兩池重名角色若符合桌邊裝備條件，改到的是桌邊 `skillSlots`；其餘角色則可能報錯。編隊的自訂 drop 只修了最後落帳，沒有修影像與落點。

- **值得修｜暫停／恢復及設定操作仍會跑桌邊結算。**  
  [clicker.js:391](D:/claude研究/clawd-pet-v3/src/clicker.js:391)、[第 418 行](D:/claude研究/clawd-pet-v3/src/clicker.js:418)、[第 607 行](D:/claude研究/clawd-pet-v3/src/clicker.js:607)、[clicker-gacha.js:292](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:292)。  
  末世切到背景、恢復、重新載入或切換抽卡演出，仍可能結算桌邊收益；恢復還會啟動桌邊 stage。若桌邊應在背景累積，應明確保留這個規則，但不要在末世顯示未標明世界的桌邊離線收據。現在「末世不跑桌邊結算」只對 interval 成立。

- **值得修｜結算卡可被關閉，但自身狀態沒清掉。**  
  [clicker-gacha.js:84](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:84)、[第 264 行](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:264)。  
  收下後 pending 已清空，招募關閉鍵恢復可用；直接關閉時 `close()` 不隱藏 `draw-summary`、不清 `pendingSummaryJoins`。下次打開招募會帶著上次結算。結算「繼續」與一般關閉應共用完整收尾。

**2．存檔：有一個正常操作就會踩到的阻斷問題**

- **一定要修｜末世抽卡未收下就重開，結果不會恢復。**  
  [clicker.js:608](D:/claude研究/clawd-pet-v3/src/clicker.js:608)、[clicker-gacha.js:275](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:275)。  
  `restore()` 本身已用 `W()`，但初始化呼叫條件仍是 `if (store.state.pending)`。末世結果存在 `apoc.pending`，因此不會進入恢復；抽卡鍵又因 pending 而 disabled，末世一般招募入口也被 [CSS:1272](D:/claude研究/clawd-pet-v3/src/clicker.css:1272) 隱藏。  
  記憶體測試確認：正常十連後是 `homePending=false、apocPending=true、tickets=0`。這不是損壞存檔才會發生。

- **一定要修｜末世 pending 驗證不足，能接受會拋錯或憑空增券的資料。**  
  [clicker-apoc-economy.js:62](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:62)、[第 180 行](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:180)、[clicker-save.js:224](D:/claude研究/clawd-pet-v3/src/clicker-save.js:224)。  
  實測兩份資料都通過 `S.validate()`：
  - `entries:[null]`：收下時拋出讀取 `entry` 的錯誤。
  - 卡片 ID 為 `missing`：收下回傳成功，券從 **10 變 11**。原因是先補 `ids.length` 張券，`drawn()` 再過濾未知 ID，沒有扣回。  
  應驗證 draw 身分、1／10 張數、每筆結構、末世卡池 ID、key 與重複計數；不能只驗證 entries 是陣列。

- **值得修｜`ticketsBought` 沒有有限數檢查；`cleared` 舊檔語意未完成。**  
  [clicker-apoc-economy.js:60](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:60)、[第 99 行](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:99)。  
  實測字串 `"1e309"` 會被正規化成 `Infinity`，仍通過存檔驗證，券價也變 `Infinity`。另外舊檔若已 `progress=20` 而沒有 `cleared`，會補成 false，卻不可能再觸發 win，結局永遠不補播。應決定它代表「已通關」還是「已看結局」，再訂遷移規則。  
  一般舊檔缺欄位的基本補值則通過實測：`world=home、pending=null、cleared=false、ticketsBought=0`。

**3．UI 必要性與實際可用性**

- **值得修｜應優先合併裝備鍵，不要為湊按鈕數刪掉訓練。**  
  [clicker-album.js:200](D:/claude研究/clawd-pet-v3/src/clicker-album.js:200)、[第 248 行](D:/claude研究/clawd-pet-v3/src/clicker-album.js:248)。  
  桌邊三顆、末世四顆裝備鍵，是同一個決策的槽位選項，又和編隊重複。建議收成一顆「裝備技能」，按後選槽；詳情保留目前槽位資訊。末世商店的 [「去編隊」:159](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:159) 也與固定底欄編隊入口重複，可把那張卡改成純戰力摘要。

- **可以不修｜個別訓練／最多，以及上一位／下一位，有不同用途。**  
  [clicker-album.js:260](D:/claude研究/clawd-pet-v3/src/clicker-album.js:260)、[第 292 行](D:/claude研究/clawd-pet-v3/src/clicker-album.js:292)。  
  個別訓練與外面的全隊／平均訓練不是相同操作；「最多」避免反覆點擊；前後切卡避免退回卡冊再找卡。這些有具體用途，不該因為「現在十顆」就一併砍掉。

- **一定要修｜末世空技能格寫「選夥伴」，實際卻禁止點擊。**  
  [clicker-apoc-ui.js:137](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:137)。  
  `!def` 時按鈕 disabled，下一行 handler 裡的 `openTeam()` 永遠無法由空格點擊觸發。空格應可打開編隊；只有已裝技能的發動動作才受戰鬥／冷卻限制。

- **值得修｜末世結算文字的深色覆寫沒有命中。**  
  [clicker.css:1319](D:/claude研究/clawd-pet-v3/src/clicker.css:1319)、[第 1330 行](D:/claude研究/clawd-pet-v3/src/clicker.css:1330)。  
  `#game #draw-summary ...` 明確把標題、內文與名字設為 `var(--ink)`；末世 `--ink` 是 `#0C1119`，結算背景是 `#22304A`。後面的末世規則只改容器文字色，無法覆蓋子元素的明確設定，容器本身也輸在 specificity。這就是另一個「有寫 patch，但沒命中」的案例。

**4．UI 體檢器：有用途，但現在的零問題不足以驗收**

- **一定要修｜捲動豁免過寬，垂直裁切也漏判。**  
  [clicker-ui-audit.py:63](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:63)、[第 70 行](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:70)、[第 76 行](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:76)。  
  任一軸有 auto／scroll，就略過兩軸文字檢查；任一祖先可捲動，就完全略過子元素出界。如此水平捲動容器裡被垂直裁掉的內容也能通過。邊界判斷只抓完全離開上下邊界，部分垂直越界不報。應逐軸計算可見裁切範圍，並實際捲動檢查剩餘內容。

- **一定要修｜腳本沒有確認真的進入目標畫面，且缺少最關鍵的往返與恢復流程。**  
  [clicker-ui-audit.py:135](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:135)、[第 148 行](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:148)、[第 172 行](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:172)。  
  多數操作用 `e.click()`，不驗證實際可點，也沒 assert 目標面板已打開；失敗時可能只是把主畫面冠上「卡冊」名稱掃過。末世靠直接改 state 後 reload 進入，沒有測「桌邊→末世→原場景」；十連掃完也沒收下，更沒測 pending 重開。因此上面的切回、還原、恢復與末世結算問題都能躲過。應補這些明確流程斷言，先確保掃的是正確畫面。