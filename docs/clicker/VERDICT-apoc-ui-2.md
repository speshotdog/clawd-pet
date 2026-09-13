**這輪仍不能算通過，但上一輪指出的主要故障確實修掉了。** 十一條中，**1、3、4、5、10、11 還不完整**；2、6、7、8、9 的指定問題已修正。

以下以 **`ff28eb9` 的已提交內容與行號**為準，不包含工作目錄後來出現的修改。沒有改檔、build、起 server 或 commit。執行了末世經濟測試，**15／15 通過**；另外用唯讀 Node 記憶體案例確認了快取與 pending 漏洞，沒有重跑截圖體檢器。

**A．十一條逐項判定**

| 項目 | 判定 | 結果 |
|---|---|---|
| 1．切世界作廢快取 | **部分完成** | `slotsKey`、`teamKey` 修對；但金額及收益文字也有快取，尚未失效。見 B1。 |
| 2．hide／unhide | **指定問題已修** | [apoc-ui:173](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:173) 記錄真正被藏起來的節點，[leave:215](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:215) 還原，兩顆「最多」及價牌可回來。 |
| 3．拖曳世界轉接 | **部分完成** | 查卡、命中第四格、寫回 apoc 修對；[drag:32](D:/claude研究/clawd-pet-v3/src/clicker-drag.js:32) 的可放置提示仍讀桌邊槽數。 |
| 4．pending 恢復 | **部分完成** | 初始化已修；resume 無條件呼叫 `restore()` 也正確。但匯入後 reload、直橫切換仍漏接。見 B2、B3。 |
| 5．pending 驗證 | **部分完成** | 原先 null、未知 ID、生券問題已擋；每筆卡片內容、key、重複計數仍未驗證，仍能接受無法正常顯示的 pending。詳見下文。 |
| 6．ticketsBought／cleared | **已修** | [economy:60](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:60) 有限數處理正確；`cleared＝已通關、不補播` 的遷移語意也一致。 |
| 7．空技能格可點 | **已修** | [apoc-ui:138](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:138) 正確區分空格與技能發動條件。 |
| 8．結算文字顏色 | **已修** | [CSS:1332](D:/claude研究/clawd-pet-v3/src/clicker.css:1332) 已覆蓋原本明確指定文字色的子元素。 |
| 9．close 清結算 | **已修** | [gacha:90](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:90) 隱藏結算、轉移並清除待播入隊，沒有原先結算殘留問題。 |
| 10．裝備鍵／暫停恢復 | **部分完成** | 按鈕數確實減少，但滿槽後失去詳情頁直接替換能力；resume 還會間接啟動桌邊舞台。 |
| 11．UI 體檢器 | **部分完成** | 新流程與可見性檢查有價值，但捲動豁免仍過寬，也存在條件式跳過結算驗收。 |

第 5 條的剩餘問題在 [normalize:67](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:67)。記憶體實測，以下兩種資料**仍被接受**：

- 單張只有 `entry: { id: 合法ID }`，沒有 `rarity／name／kind／key`。
- 十張全部使用同一個 `key`。

前者會走到 [gacha-card:104](D:/claude研究/clawd-pet-v3/src/gacha-card.js:104) 的 `RARITY[shown].label`，缺少 rarity 可直接拋錯；後者在 [runtime:41](D:/claude研究/clawd-pet-v3/src/gacha-mode-runtime.js:41) 被 Map 合成同一張卡，**十張結果只建立一張 DOM**。應驗證或從卡池重建 canonical entry，並驗證 key、owned、dup；桌邊 [save:203](D:/claude研究/clawd-pet-v3/src/clicker-save.js:203) 已有相應檢查，末世尚未跟上。

第 10 條的裝備鍵是**功能縮減，不是資料毀損**：[album:275](D:/claude研究/clawd-pet-v3/src/clicker-album.js:275) 滿槽就 disabled；末世 [album:223](D:/claude研究/clawd-pet-v3/src/clicker-album.js:223) 則點了才說先卸下。原先建議是「一顆入口，按後選槽」，目前變成「只填空槽」。日常隊伍通常已滿，正需要替換時反而增加繞路。

第 11 條還有三個盲點：

- [audit:73](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:73) 找到該軸任意可捲祖先就豁免，沒有檢查中間 `overflow:hidden` 的裁切，也没有實際捲動確認可達。
- [audit:93](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:93) 中心落在 viewport 外直接跳過；搭配上述豁免，按不到的內容仍能漏報。
- [audit:179](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:179)、[audit:204](D:/claude研究/clawd-pet-v3/tools/test/clicker-ui-audit.py:204) 是「結算有出現才掃」。應出現卻沒出現時，這兩段不會失敗。末世詳情、商店、統計、挑選器、結局也未涵蓋。

**B．同類漏接清單**

以下由影響較大的開始；最後幾項明確標為低風險。

1. **切回桌邊，收益文字會持續留在末世；金額也可能殘留。**  
   [clicker.js:140](D:/claude研究/clawd-pet-v3/src/clicker.js:140) 的 `rate()` 用 `title＋dataset.value` 判定不必重畫；末世 [apoc-ui:153](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:153)、[195](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:195) 直接換 `textContent`，卻沒清這兩個值。回到原桌邊、D／P／等級沒變時，`click-rate`、`passive-rate`、兩張升級卡的 `*-next` 都可能跳過還原。  
   [balance:121](D:/claude研究/clawd-pet-v3/src/clicker.js:121) 同樣只看內部金額快取。**兩者均已用原函式記憶體實測確認。** 另外 [numbers:158](D:/claude研究/clawd-pet-v3/src/clicker.js:158) 的延遲回呼沒有世界判斷，切世界也未取消，可能短暫把桌邊數字寫回末世。

2. **匯入存檔繞過世界切換及 pending 恢復。**  
   [extras:313](D:/claude研究/clawd-pet-v3/src/clicker-extras.js:313) 匯入後呼叫 [reload:515](D:/claude研究/clawd-pet-v3/src/clicker.js:515)，只 mount 桌邊場景、畫桌邊 stage，沒有 `apocUI.enter／leave`。因此從桌邊匯入末世檔，或反向匯入，`settings.world` 與 `body.dataset.world`、hidden／文字還原會不同步。第 518 行又只看桌邊 pending，能重現「末世待收下但入口鎖死」。

3. **末世抽卡直橫切換漏恢復。**  
   [clicker.js:748](D:/claude研究/clawd-pet-v3/src/clicker.js:748) 仍只有 `store.state?.pending`。CSS 已換版，卡片與特效仍保留上一個座標系；這正是同一個 restore 呼叫只改了部分入口。

4. **末世初始化仍跑桌邊離線收據；resume 仍間接啟動桌邊舞台。**  
   [clicker.js:609](D:/claude研究/clawd-pet-v3/src/clicker.js:609) 無條件 `offline()`，所以「在末世重開」仍可能看到桌邊收據。resume 雖略過直接重繪，但最後進入 [startTimers:380](D:/claude研究/clawd-pet-v3/src/clicker.js:380)，仍會 `stage.start()`。該舞台包含桌邊 boss／輸送帶／禮包時鐘，並非單純共用粒子。

5. **末世 resume 沒重設自己的時間基準。**  
   [apoc-ui:60](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:60) 的 `lastTick` 只在 `enter()` 重設；resume 不呼叫它。離開十分鐘再回來，第一個 tick 會結算 **60 秒末世金幣與傷害**，與「末世沒有離線收益」不一致。

6. **共用設定與重試儲存仍結算桌邊。**  
   靜音：[clicker.js:656](D:/claude研究/clawd-pet-v3/src/clicker.js:656)；演出選擇：[gacha:295](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:295)；重試儲存：[clicker.js:677](D:/claude研究/clawd-pet-v3/src/clicker.js:677)。前兩者會修改桌邊結算狀態；重試還呼叫含 `stage.render()` 的 `settle()`，能碰到共用舞台。

7. **末世抽卡標籤仍顯示桌邊成長規則。**  
   [clicker.js:520](D:/claude研究/clawd-pet-v3/src/clicker.js:520) 共用 card 的 `tagFor` 固定呼叫 [桌邊 tagFor:175](D:/claude研究/clawd-pet-v3/src/clicker-economy.js:175)。末世每張直接多一星，卻會看到桌邊的「升星進度」「熟練」；同名卡若桌邊已超越五，甚至顯示「萬用 +…」。結算頁雖分流，卡面標籤沒有。

8. **末世商店仍花桌邊幣、賣桌邊效果，還能叫桌邊 renderer 覆寫畫面。**  
   末世保持商店入口可用，但 [album:438](D:/claude研究/clawd-pet-v3/src/clicker-album.js:438) 起的商店仍使用 `s.coins`、桌邊 wardrobe／decor。裝飾的「全隊 +1%」不增加末世戰力，且末世 CSS 藏了裝飾。  
   更直接的是 [album:485](D:/claude研究/clawd-pet-v3/src/clicker-album.js:485)、[488](D:/claude研究/clawd-pet-v3/src/clicker-album.js:488)：`changed()` 剛畫完末世，又 `stage.render()` 畫桌邊。聲音可視為共用設定，但商品貨幣、裝飾用途與 renderer 不能因此混用。

9. **末世統計入口打開的是桌邊統計與獎勵。**  
   [clicker.js:736](D:/claude研究/clawd-pet-v3/src/clicker.js:736) → [extras:278](D:/claude研究/clawd-pet-v3/src/clicker-extras.js:278)，顯示拆包、桌邊收藏、桌邊付費抽數；符合條件時還能經 [extras:264](D:/claude研究/clawd-pet-v3/src/clicker-extras.js:264) 領桌邊百包粉塵。若是跨世界生涯頁，至少應明確標示；目前會被讀成末世進度。

10. **拖曳提示仍分錯世界，且末世重建節點會干擾操作。**  
    [drag:32](D:/claude研究/clawd-pet-v3/src/clicker-drag.js:32) 仍使用 `E.slotCount()`，所以第四格實際可放，卻不亮可放提示。  
    [apoc-ui:108](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:108)、[129](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:129) 每次 tick 都刪掉全部夥伴／技能按鈕。鍵盤焦點會跟著節點消失，拖曳中的來源也會被移除；拖曳中斷的具体瀏覽器表現本輪未實機驗證，但節點生命週期衝突確定存在。

11. **夥伴列只移植前十張，翻頁事件沒有末世版本。**  
    [apoc-ui:110](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:110) 永久禁用前後頁，第 112 行只取前十張。末世可編二十張，後十張卻無法從主畫面查看或拖曳。桌邊翻頁仍綁在 [stage:227](D:/claude研究/clawd-pet-v3/src/clicker-stage.js:227)。

12. **桌邊動態標記沒有完整離場。**  
    [chain-tape:230](D:/claude研究/clawd-pet-v3/src/clicker.js:230) 在末世不更新也不隱藏：連鎖中切過去，倒數可原地凍住。冰箱的 [regen-tag:204](D:/claude研究/clawd-pet-v3/src/clicker-extras.js:204) 同樣可能留下 `−…%／秒`。  
    反向則是末世王關寫入的 [effect-label:85](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:85)，`leave()` 沒收掉；回桌邊可能留下護盾文字。`boss-challenge.cooling` 也只由 [桌邊 numbers:171](D:/claude研究/clawd-pet-v3/src/clicker.js:171) 更新，切末世後可能保留不可按外觀。

13. **音訊控制實際有改，但按鈕狀態不更新。**  
    `aria-pressed`、音量初值同步只在 [numbers:208](D:/claude研究/clawd-pet-v3/src/clicker.js:208)；末世 `changed()` 提前返回。末世點靜音／音樂後，按鈕的刪線、透明度與無障礙狀態可能仍是舊值；從末世檔啟動時，滑桿也可能不是存檔值。

14. **共用技能選擇器的規則不一致。**  
    桌邊 [equip:496](D:/claude研究/clawd-pet-v3/src/clicker-economy.js:496) 禁止同一卡佔兩槽；末世 [setTeam:164](D:/claude研究/clawd-pet-v3/src/clicker-apoc-economy.js:164) 沒有這條限制。經 [team:126](D:/claude研究/clawd-pet-v3/src/clicker-team.js:126) 或拖曳，可把同一卡放進四格，冷卻又按槽計算。**若末世刻意允許，這是規則差異；若要求兩邊同邏輯，這是可影響戰鬥的漏接。**

15. **低風險：共用卡面的 hover／unveil 還固定查桌邊池。**  
    [gacha-card:247](D:/claude研究/clawd-pet-v3/src/gacha-card.js:247)：末世獨有 ID 不會啟動 hover，同名卡套桌邊 rarity 的動態參數。第 111 行 unveil 也一樣；目前正常末世 draw 不產 veil，因此後者屬潛在路徑。

16. **低風險：入隊演出回呼仍固定桌邊。**  
    [clicker.js:598](D:/claude研究/clawd-pet-v3/src/clicker.js:598) → [stage.join:730](D:/claude研究/clawd-pet-v3/src/clicker-stage.js:730)，查桌邊 roster／卡池／星數。正常末世抽卡關閉時 stage 已停，通常被 `!running` 擋掉，結果是沒有入隊演出；仍不能把它當作已世界分流的共用回呼。

17. **低風險：尚未造成阻斷的桌邊判斷殘留。**  
    [Escape:781](D:/claude研究/clawd-pet-v3/src/clicker.js:781) 只看桌邊 pending，但 `gacha.close()` 內層有正確防線，因此目前不會丟掉末世結果。[場景入口:681](D:/claude研究/clawd-pet-v3/src/clicker.js:681) 與招募 `canOpen` 仍看桌邊 boss；正常切換大多避得開，匯入後狀態則未必。主點擊區 [HTML:34](D:/claude研究/clawd-pet-v3/src/clicker.html:34) 的無障礙名稱也仍是「點珍母拆零食包」。

**C．從遊戲介面看，優先拿掉或合併什麼**

- **拿掉末世商店中的桌面裝飾、桌邊特效商品及未標示世界的桌邊統計。** 目前不只是多餘，而是讓玩家花錯貨幣、期待不存在的戰力效果。存檔與音訊設定可保留共用入口。
- **把「換券」與「招募」合在同一個區塊。** 現在券數、末世幣、券價分散重複；另一張「隊伍／去編隊」卡又重複固定編隊入口。[apoc-ui:147](D:/claude研究/clawd-pet-v3/src/clicker-apoc-ui.js:147) 這三張卡應依玩家決策整理，而不是沿用三張桌邊卡的數量。
- **保留一顆裝備鍵，但讓它開槽位選擇／替換。** 滿槽時不要把主要操作變灰，也不要要求先退回、找舊卡、卸下、再回來。
- **合併抽卡總覽與第二層結算。** 新卡／升星摘要可直接放在待收下總覽；「收下」完成流程，「收下並再抽」保留捷徑。每次重複卡都升星的末世，第二次「繼續」很容易變成固定多按一次。
- **把五種抽卡演出選擇移到設定。** 玩家不該因演出模式不支援單抽，被迫先理解技術限制才能招募。[gacha:62](D:/claude研究/clawd-pet-v3/src/clicker-gacha.js:62) 的限制目前直接干擾核心操作。
- **移除長駐解釋，改顯示正在影響戰鬥的資訊。** 「點怪攻擊；隊伍放著也會打」適合首次教學；實戰更需要剩餘倍率次數、增益持續時間。末世已算出 `fx`，UI 卻主要顯示技能冷卻，玩家難以確認技能到底有沒有生效。
- **不要再按按鈕總數刪功能。** 個別訓練、最多、前後切卡仍有明確用途；真正應減少的是跨世界的無效選項、重複入口與重複確認。