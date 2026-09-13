# 複檢簡報：末世改用 1.0 介面（給 GPT-6 Astra）

## 這輪在做什麼

使用者 2026-09-13 的回報與指示：

- 末世的 UI「按鈕和文字會有裁切」「獨立技能的部分也不會顯示角色縮圖」「末世的卡冊也還沒做」
  「只有做關卡地圖，但沒有實機遊玩的畫面⋯⋯沒有怪，也沒有能點的地方」。
- 「1.0 的版本比較好，乾脆把 1.0 的 UI 介面稍微調色拿來用就好，但注意卡片都要是末世卡版本」。
- 「末世地圖的選項放在場景裡面⋯⋯就是兩個主系統，選擇哪一個就算重新整理了，
  選擇的那個就是當前的主系統」「兩邊邏輯不要差太多，不同的是 UI 的色調」。
- 「整體 UI 邏輯非常差勁，幫我思考怎麼樣才像是一款真正的遊戲，哪些是真的需要、哪些是干擾玩家」
  「1.0 卡冊把卡片點開會有非常多選項，有一些已經跟外面重複了」
  「升階 超越 我希望抽到後就會自己升級了，幫我思考抽到時結算的提示」。
- 「檢查過每一個 UI 不會被遮擋、字體被裁切、都是有必要的存在」。

## 做法（五個 commit，`2c7789b..HEAD`）

1. **拆掉 iframe**。原本末世是把原型頁 map20／team20 縮進 22 MB 的 iframe，
   上面所有症狀都是同一個根因。改成末世直接畫進 1.0 的節點。
   - `tools/apoc/export_cards.py`：71 張末世卡輸出成 `src/apoc/cards/*.webp`（共 0.77 MB），
     欄位形狀跟 `GachaPool.CATALOG` 一樣 → 1.0 的卡面／頭像／卡冊直接吃得下。
   - `src/clicker-apoc-ui.js`（新）：把末世資料餵進 `#stage`／`#buddies`／`#slots`／`#shop`。
     怪用 1.0 的敵人與王素材，站在原本零食包的位置；點擊區＝`#tap`；血條＝拆包進度條。
   - `body[data-world="apoc"]`：只換 CSS 變數與紙質貼圖 → 同一套版面的深色版。
   - 刪掉 `src/clicker-apoc.js`（iframe 橋）。
2. **兩個主系統從「場景」切**：七站＋末世並排，選了就是當前主系統，存進 `settings.world`。
3. **招募層兩個世界共用**：`clicker-gacha.js` 加世界轉接器（卡池／貨幣／落帳三件事不同）。
   `ApocEconomy` 補 `rollPack／purchaseDraw／collectDraw`，draw 形狀與 1.0 相同 → 五種演出全沿用。
   十連補上 `layout()` 的兩排版面（原本只寫了 1 與 5）。
4. **卡冊與編隊**也各加一層世界轉接器，兩邊共用同一個畫面。
5. **升階／超越自動化**（`E.autoGrow`，規則沿用手動的 `grow`）＋**抽卡結算** `#draw-summary`。
6. **UI 體檢器** `tools/test/clicker-ui-audit.py`：字被裁／跑出畫面／被蓋住／按鈕互疊四條，
   28 畫面 × 桌機手機。第一版 1504 條 → 扣掉假陽性 86 條真的 → 逐條修完現在 0 條。

## 請你看什麼（照重要性）

1. **正確性**：兩個世界共用同一層 UI，狀態會不會互相汙染？特別看
   `clicker-gacha.js` 的 `W()` 轉接器、`clicker-album.js`／`clicker-team.js` 的 `apoc()` 分支、
   `clicker.js` 的 `apocMode()` 分流（`changed`／`tick`／`tap`／`resumeStage`／`renderSlots`）。
   有沒有哪條路徑會在末世跑到 1.0 的邏輯（或反過來），像我已經修掉的那兩個：
   關招募層時呼叫 1.0 `renderSlots()` 炸掉、末世改掉的商店標題沒還原。
2. **存檔**：`settings.world`、`apoc.pending`、`apoc.cleared`、`apoc.ticketsBought` 的
   `normalize`／`validate` 有沒有漏；舊存檔讀進來會不會壞。
3. **UI 必要性**（使用者明說要砍）：還有哪些按鈕是「跟外面重複」或「玩家根本不會用」？
   1.0 卡片詳情現在 10 顆鍵（裝備至槽 ×3、上一位、下一位、訓練、最多、編入隊伍、派遣、回到卡冊）。
4. **體檢器本身有沒有鑑別力**：`clicker-ui-audit.py` 的四條判準會不會漏掉真的問題
   （我已經知道它看不出「醜」，只看得出「放不下／看不見／點不到」）。

## 不要做

- 不要改 `src/`（我會照你的意見自己改）、不要 build、不要起 server、不要 commit。
- 不要碰 `main`／`gh-pages`。

## 怎麼跑驗收

```
npm test                                                  # 194
PYTHONIOENCODING=utf-8 python tools/test/clicker-ui-audit.py       # 0 條
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc.py        # 切換、卡圖、卡冊、編隊
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py   # 十連→打關→王關→技能→結局
```
