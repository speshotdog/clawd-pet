**這輪大部分修對，但仍有必修問題。** 已檢查 `ff28eb9..HEAD`（HEAD：`44e54e5`）。末世經濟 **16/16**、桌邊經濟 **26/26** 測試通過；另用原函式做記憶體案例確認。沒有改檔、build、起 server 或 commit，沒有跑截圖體檢器。

**A．本輪修改是否正確**

| 範圍 | 結論 |
|---|---|
| `resume / suspend / startTimers` | 指定的主要分流修對：末世恢復重設 `lastTick`，不再啟動桌邊舞台；初始化也不再結算桌邊離線收據。 |
| `setWorld / reload` | **尚不完整。** `setWorld` 清收益快取正確，但只設 `coinTarget=null`，未取消舊 `coinRaf`；記憶體案例確認舊動畫能把末世金額短暫寫成 **0**。`reload` 又漏掉收益快取、`numberTimer` 清理，以及回桌邊時的 `stage.start()`。[相關位置](</D:/claude研究/clawd-pet-v3/src/clicker.js:521>) |
| apoc UI 的 hide/unhide、resume、buddyPage | 還原機制、時間重設、翻頁分流均修對。隱藏統計也會連帶移除末世的匯出／匯入入口，目前必須回桌邊使用。**每秒重建按鈕的操作問題仍在。** |
| normalize 重建 pending | **原先缺卡面欄位、重複 key 的故障已修正。** |
| `setTeam` 禁同卡多槽 | **有修錯，見 B1。** |
| album `pickSlot` | 桌邊滿槽原地替換的邏輯修對。末世分支仍是「先卸下一個」，沒有使用 `pickSlot`；這是功能未補齊，有其他操作路徑，本輪不列必修。[末世分支](</D:/claude研究/clawd-pet-v3/src/clicker-album.js:244>) |
| UI audit 新判準 | 強制檢查結算出現、增加詳情／挑選器／結局，方向正確。**捲動漏判仍未修好**：第 73 行仍遇到可捲祖先就豁免；第 93 行新增判斷甚至任一軸可捲就跳過，未確認中間裁切及實際可達。不能把零問題當成操作驗收通過。[判準](</D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:73>) |

另有一處修了但沒生效：拖曳提示外層新增 `slotCount()`，但 `targetsOf()` 已先用桌邊槽數過濾，末世第四格仍可能不亮。它不阻止實際放置，本輪不列必修。[位置](</D:/claude研究/clawd-pet-v3/src/clicker-drag.js:32>)

**B．還要修的玩家錯誤**

1. **指定已裝備的卡，會誤清另一槽，卻回報成功。**  
   末世原本 `[A, B, 空, 空]`，在第二槽選 A，呼叫端傳入 `[A, A, 空, 空]`；新 `setTeam` 保留第一個 A、清除第二格，結果是 **`[A, 空, 空, 空]`**。B 被卸下，A 沒裝到指定位置，選擇器仍顯示成功並關閉。這已實測。應拒絕重複指定並保留原配置，或明確實作移槽。另外 `normalize` 仍保留舊檔的四槽同卡，舊配置可以繼續使用。  
   [去重邏輯](</D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:170>)、[成功回報](</D:/claude研究/clawd-pet-v3/src/clicker-team.js:122>)

2. **切進有 pending 的另一世界，仍可能卡住招募。**  
   例如匯入一份 `world=home`、但有 `apoc.pending` 的可接受存檔：`reload()` 雖呼叫 `restore()`，它只恢復當前世界；之後切末世，`setWorld()` **沒有再呼叫 restore**。結果是末世抽卡鍵因 pending 被禁用，收下畫面卻沒開，必須重新載入才能解除。切世界應恢復目標世界的 pending。  
   [setWorld](</D:/claude研究/clawd-pet-v3/src/clicker.js:731>)、[restore](</D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:278>)

3. **末世每秒刪除夥伴／技能按鈕，鍵盤操作仍會掉焦點。**  
   `tick → apply → changed → render` 每秒執行，兩個 renderer 都 `replaceChildren()`。玩家 Tab 到技能鍵後，下一秒焦點所在節點就被刪除，無法穩定用鍵盤選擇／發動。拖曳來源同樣會被移除，但本輪沒有實機驗證拖曳的瀏覽器結果；必修判定以確定的焦點問題為依據。  
   [夥伴重建](</D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:105>)、[技能重建](</D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:132>)

4. **共用設定／重試儲存仍會操作桌邊結算。**  
   這是上一輪 B6，這輪沒有改到：末世按靜音、切抽卡演出仍執行 `E.settle()`，修改另一世界的金額與進度；重試儲存還呼叫會執行桌邊 `stage.render()` 的 `settle()`。這些共用操作需要補世界分流。  
   [靜音](</D:/claude研究/clawd-pet-v3/src/clicker.js:673>)、[演出選擇](</D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:293>)、[重試儲存](</D:/claude研究/clawd-pet-v3/src/clicker.js:694>)