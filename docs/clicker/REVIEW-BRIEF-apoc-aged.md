# 複檢簡報：末世第二輪回饋（舊化 1.0 配色、技能施放、卡片旋轉、編隊版面）給 GPT-6 Astra

## 使用者這一輪說了什麼（2026-09-13，看完 `38660a7` 的試玩）

- 「字體不好閱讀，深色底深色字，很多地方都是」
- 「卡冊星星請直接用圖示；點進去後也要支援滑鼠可以旋轉卡、跟滑鼠經過的反光等等特效」
- 「主畫面什麼都看不到」（截圖：末世主畫面的夥伴列是**桌邊的隊伍**、有「本輪」、槽位是桌邊的）
- 「技能點下去也要有跟 1.0 一樣的施放效果」
- 「技能槽不要兩行」
- 「（編隊的四條上限）想辦法把這些資訊壓縮；隊伍成員不要框，直接用精裝卡呈現」
- 「（編隊詳情）不需要額外框來框住卡片，卡本身已經有框了」
- 「幫我再思考新的 UI 配色……說不定可以變成舊化材質的 1.0 感覺」
  → 做了深藍／舊化／焦黑三張樣張，使用者選**舊化 1.0**。

## 做了什麼（`38660a7` 之後，尚未 commit）

1. **主畫面夥伴列被桌邊蓋掉**（根因）：`clicker.js` 初始化時不分世界呼叫 `stage.setPartners()`，
   從末世重新整理時把末世已畫好的夥伴列蓋成桌邊隊伍；末世 renderer 的快取以為內容沒變，永遠不重畫。
   修法：初始化分世界；另外 `#buddies`／`#slots` 由末世畫時標 `data-world="apoc"`，標記不在就作廢快取。
2. **技能施放**：`ClickerCutin.play()` 接受 `effect.spec／entry／actor`，末世用同一套分鏡、主角是精裝卡，
   不凍結也不結算 1.0 舞台（`clicker-apoc-ui.js` 的 `cast()`）。
3. **卡冊詳情拿在手上看**：`ClickerHolo.interactive(host)`，手感照精裝典藏包的 `bindInteraction`
   （反光跟游標、拖曳 0.2°/px ±18°、放開 280ms 回正）。
4. **卡冊星星**：1.0 的星星圖示；超過 5 張改「一顆星＋×張數」。
5. **編隊**：技能槽一排四格（直式只放卡、名字在 title）；四條上限壓成一排四格；
   末世的隊伍成員＝裸精裝卡（拿掉奶油框與稀有度符號）；詳情卡不再外框。
   ⚠ 要帶 `#game`／`#roster` 權重，1.0 的 `#game button` 會把奶油底與 3px 框畫回來。
6. **舊化 1.0 配色**：`tools/apoc/build_theme.py` 把 1.0 的牛皮紙／紙卡／標籤貼圖做舊
   （褪色、咖啡漬、焦邊，同尺寸同 alpha）→ `src/apoc/theme/aged/`；`src/apoc/theme.css` 以
   `body[data-apoc-theme="aged"]`（進末世時掛上）蓋掉深藍色票。外層面板用 9-slice，內層分區不再貼紙。
   戰鬥舞台墊地圖同一張「廢墟後院」插畫（處理「主畫面什麼都看不到」）。
7. 對比度：寫了 WCAG 掃描（地圖、戰鬥、卡冊、詳情、編隊、模式），修到剩一個刻意半透明的停用翻頁鍵。

## 請你看什麼（照重要性）

1. **跨世界汙染還有沒有別的路徑**：第 1 條是這輪最嚴重的玩家錯誤。請找其他「共用節點被另一個世界的
   renderer 畫過、快取卻沒作廢」的地方（`#slots`、`#buddies`、商店三張卡、`#effect-label`、頂列收益……），
   特別是初始化、`reload()`、`resume()`、`setWorld()`、招募層關閉、切入演出結束的 `done: changed`。
2. **末世技能施放**：`cast()` 先 `apply(useSkill)` 再播演出——冷卻中／存檔失敗時會不會還播？
   演出期間再按技能、切世界、開面板會怎樣？`cutin.stop()` 在末世（1.0 舞台停著）會不會碰到 1.0 的 `stage.freeze`？
3. **`ClickerHolo.interactive`**：pointer capture、離開、取消、重開詳情（重複綁定、舊卡面回收）有沒有漏。
4. **舊化樣式表**：`!important` 的 border-image 會不會蓋到不該有紙框的東西？桌邊（沒有 data-world）完全不受影響嗎？
5. 直式手機的技能格、編隊、主畫面有沒有被這輪的 CSS 弄壞。

## 不要做

- 不要改檔、不要 build、不要起 server、不要 commit、不要碰 `main`／`gh-pages`。

## 驗收怎麼跑

```
npm test                                                           # 200
PYTHONIOENCODING=utf-8 python tools/test/clicker-ui-audit.py       # 56 畫面 0 條
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc.py
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py
```
