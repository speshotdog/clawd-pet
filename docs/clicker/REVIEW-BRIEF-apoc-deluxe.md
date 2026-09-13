# 複檢簡報：末世的精裝卡面、模式、關卡地圖、精裝典藏包（給 GPT-6 Astra）

## 使用者這一輪說了什麼（2026-09-13）

上一輪我把末世整套換成 1.0 介面，使用者退回：

- 「不是說末世的卡都是顯示精裝卡嗎，怎麼還有舊的圖繪」
- 「新的抽卡 UI 也被你毀了，而且也打不開」
- 「我昨天下的指令是：**如果現在沒有的 UI，就用舊的改色**，不然之前做這麼辛苦的東西不就都白費了」
- 「**模式是額外的大選項，切換後就是之前做的關卡地圖**」
- 「末世的介面沒有怪物，卡片顯示也都是舊版卡」

問答定案：戰鬥畫面＝1.0 那一套；卡池＝只要精裝，「舊的卡樣式一張都不准放」；
卡面＝精裝卡面 HoloCardFace；抽卡演出＝精裝典藏包。
補充：「目前所有卡 71 張都是精裝，舊版的也全部都翻新了」。

## 根因

上一輪的 `tools/apoc/export_cards.py` 把去背主體直接壓在黑底上、沒有卡框，
輸出 `src/apoc/cards/*.webp`——精裝卡看起來就跟 1.0 舊圖一樣。真正的精裝卡面是
HoloCardFace 把主體＋背景＋卡框＋寶石＋反光組起來的。這一輪把那套輸出整個刪掉。

## 這一輪做了什麼（`e3a9eb8` 之後，尚未 commit）

1. **精裝卡面接進主頁**（`tools/apoc/build_holo.py` → `src/apoc/`；`src/clicker-holo.js`）
   - 從 holo-5.0 的 demo 拆出卡面 CSS（60 KB）、71 張卡的圖層、遮罩、字型，改成實體檔（原本全是 base64）。
   - `ClickerHolo.face(entry)` 用 shadow root 隔離卡面 CSS（選擇器沒有命名空間，直接放主頁會跟 1.0 打架）。
   - ⚠ 遮罩網址一定要絕對：它透過 CSS 自訂屬性傳進 `apoc/holo.css`，相對網址會以那份樣式表為基準。
   - 用到的地方：夥伴列、技能格、卡冊格子與詳情、編隊格子／詳情／挑選器、抽卡結算、拖曳殘影。
2. **模式是頂層大選項**（頁尾 `#mode-open` → `#modes` 兩張卡）
   - 場景面板拿掉末世票券（場景＝桌邊的七站）；末世沒解鎖時模式鍵不出現。
   - 末世裡場景鍵改名「地圖」，按了回到關卡地圖；離開末世時名字還原。
3. **關卡地圖**（`tools/apoc/build_map.py` → `src/apoc/map/`；`src/clicker-apoc-map.js`）
   - 照 holo-5.0 `map20.template.html` 移植：20 站、每四站一王、五區段、插畫地形、站點左右交錯。
   - 資料全讀 `ApocEconomy.view`，這支不存任何進度。「進入戰鬥」＝`apocUI.fight()` 後切到 1.0 戰鬥畫面。
   - 末世一進來（切模式、重新整理、匯入存檔）就是地圖。
   - 地圖開著時，戰鬥畫面的兄弟節點（技能格／商店／隊伍列）橫式用 visibility 收、直式用 display:none 收。
4. **精裝典藏包**（`tools/apoc/build_ceremony.py` → `src/apoc/ceremony.html`）
   - 照 holo-5.0 `build_deluxe_b.py` 組出檔案版（81 KB，卡圖與卡面 CSS 跟主頁共用；原本是 19 MB 單頁）。
   - 演出本體（ceremony.js／css／背景／音效／粒子）不改。只換三件事：素材改讀檔、
     `draw(n)` 改成照主頁給的 id 清單出卡、「收下」時 postMessage 通知主頁。
   - **扣券與結果在主頁**：`start()` 先 `purchaseDraw` 寫進 `apoc.pending` 並 commit，才叫 iframe 演出。
     收下時主頁 `collectApoc()` 落帳、出結算卡（借用招募層的 `#draw-summary`）。
   - 重新整理時有 pending → `restore()` 直接開典藏包並跳到結果頁。
   - 末世收起「選擇演出方式」與招募層頂列的「演出」選單。
5. **其他收尾**：末世收起分享提示鍵（它分享的是桌邊事件）；刪掉 `export_cards.py` 與 71 張舊輸出。

## 請你看什麼（照重要性）

1. **典藏包的狀態機**（`src/clicker-gacha.js` 的 `ceremony`／`collectApoc`／`start`／`restore`）
   - 會不會重複落帳？（例：收下訊息來兩次、收下時存檔鎖住、`collectApoc` 進行中又收到 restore）
   - `ceremony.active` 期間，主頁有沒有哪條路徑會重開或關掉它（轉向、回前景、切世界、匯入存檔）？
   - iframe 還沒 ready 就被 hide／又 play 一次會怎樣？postMessage 用 `'*'`、主頁驗 `e.source`，夠不夠？
   - 切世界（`setWorld`）時典藏包開著會怎樣？
2. **地圖與戰鬥的切換**（`clicker-apoc-map.js`、`clicker.js` 的 `setWorld`／`reload`／初始化、`clicker-apoc-ui.js`）
   - 地圖開著時，1.0 的按鍵（空白鍵拆包、拖曳、夥伴列點擊）有沒有還能作用到被收起來的戰鬥畫面？
   - `map-open` class 與 `#stage-fit[hidden]` 有沒有漏清的路徑？
3. **精裝卡面**：還有沒有末世可達、但仍畫 1.0 舊卡面的地方？（我查過 `card.art.create`／`card.create` 的所有呼叫點）
   shadow root 每張卡一份 `<link>`，夥伴列＋編隊＋卡冊同時開著的效能有沒有問題？
4. **UI 體檢器的判準修改**（`tools/test/clicker-ui-audit.py`）
   - 「字被裁」：`overflow:visible` 的字，只有字形超出外層會裁切、又不能捲的容器才算。
   - 「被蓋住／按鈕疊住」：中心點在捲動容器可見範圍外的元素不檢查。
   - 我做了反向對照（自己裁、外層裁、真被蓋住都抓得到；外層不裁、捲出容器不誤報），請看有沒有別的漏洞。

## 不要做

- 不要改 `src/`、不要 build、不要起 server、不要 commit、不要碰 `main`／`gh-pages`。

## 驗收怎麼跑

```
npm test                                                           # 200
PYTHONIOENCODING=utf-8 python tools/test/clicker-ui-audit.py       # 56 畫面 0 條
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc.py        # 模式、地圖、精裝卡面、切換
PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-play.py   # 典藏包十連→打關→王關→技能→結局
```

已知不是這輪造成的：`clicker-browser.py` 第 944 行 `#hero > svg` 偶發失敗——
在點擊區啟用的當下量，HEAD 與現在都是 3 次有 1 次主角還沒掛上（A/B 實測）。
