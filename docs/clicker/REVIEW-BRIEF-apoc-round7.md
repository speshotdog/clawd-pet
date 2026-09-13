# 複檢請求：第七輪——點擊特效華麗化＋噴金幣（兩個世界）、2.0 招募入口與繼續抽、收下淡出、地圖五段美術、技能格縮小（balance-v3，對 `01362b1` 的未 commit 工作樹）

你是唯讀複檢。請讀 `git diff 01362b1`（新檔 `src/clicker-hitfx.js`、`src/apoc/map/terrain-2～5.webp`、`_art/apoc-map/` 也算），找出**會讓玩家看到錯誤、卡住、丟進度、被鑽漏洞、效能明顯變差、或讓 1.0 被弄壞**的問題。
結論分成「必修」「值得修」「不用修（說明為什麼）」，每條附檔案與行號、重現步驟、建議修法。用繁體中文。

⚠ 使用者規則：**效能規矩只管閒置狀態，演出中的重量不能砍**。不要建議把粒子、震動、金幣數量砍掉來省效能；真的有卡頓或記憶體問題請給量測數字與不砍演出的修法。

## 使用者這一輪說了什麼與定案

1. 「抽卡的部分，裡面的介面已經有單抽、五連、十連的選項了，我希望招募夥伴那邊可以改成引導進入抽卡選單的按鈕，簡單顯示是否可以抽卡」「按下收下後的過場回到主畫面很不流暢」「我也希望他有繼續抽的功能（看當下是幾抽）」→ 問答定案：**只改 2.0**。
2. 「現在的點擊特效都不夠華麗，有辦法幫我強化嗎」「有沒有辦法製作類似 Sakura Clicker 點擊噴出金幣的特效」→ 做了 A（現況）／B（華麗）／C（華麗＋噴金幣）三欄樣品頁，使用者：「效果都不錯，都做」、**兩個世界都套**。
3. 「2.0 的技能格幫我縮小約 15%，比照 1.0 的大小」。
4. 「地圖的美術是不是沒有完善，只有兩個區域，往下就重複而已，幫我完善」→ 查到只有第一段有真美術、二～五段是同一張佔位；照第一段 seg1b 的派工規格請 Codex imagegen 畫二～五段（`_art/apoc-map/BRIEF.md`、`REPORT.md`）。

## 改了哪些

| 檔案 | 內容 |
|---|---|
| `src/clicker-hitfx.js`（新） | `impact(fx, p, level)`：碎片＋光痕＋四芒星＋中心閃光＋衝擊波（等級 0～3）；`coins(fx, p, n, {canvas, stage, wallet, floor})`：金幣噴出 → 在血條上緣彈跳落地 → 停頓 → 貝茲曲線飛進錢包，抵達時錢包跳一下；每秒最多 24 枚 |
| `src/clicker-apoc-ui.js` | `burstAt` 改呼叫共用模組；每一下輕微震動、越重越大；浮字大一號彈出；進末世清掉 1.0 的「桌子有點滿了」便條；舞台 `data-apoc-seg` 換段落背景 |
| `src/clicker-stage.js` | 1.0 `click()` 改走 `hitFx`：預設碎紙換華麗版＋金幣；更衣室換過點擊特效的保留自己的形狀、只加金幣；技能／拆完一包加震動；減少動畫維持原本碎紙、不噴金幣；浮字大一號 |
| `src/clicker-prestige-ui.js` | 便條在末世不產生 |
| `src/clicker-gacha.js` | 2.0：`#draw-one`＝「進入招募」（小字可不可以抽）、`#draw-five` 收起；`ceremony.enter()` 打開典藏包入口；iframe 訊息 `pull`／`again`／`leave`／`collect`；收下先淡出再落帳、`close()` 淡出 280ms；`collectApoc(again)` 落帳後直接 `start(同張數)`；拿掉以前 `open(); close();` 的繞路 |
| `tools/apoc/build_ceremony.py` → `src/apoc/ceremony.html/.css` | 入口三顆鍵打開，但用 capture 監聽攔下原型的 `pull()`、改成通知主頁；「返回」、Esc 離開；結果頁「繼續抽 N 次」（包 `updateFinish`）；`ApocCeremony.enter(offer)`／`offer()`／`play(ids, badges, again)` |
| `src/clicker-apoc-map.js`、`src/clicker.css`、`src/apoc/theme.css` | 地圖五張地景依序排、站點用百分比放在每張的 20／40／60／80%；連線同一套座標；捲動量節點；戰鬥舞台背景跟著段落換；2.0 技能貼紙 inset 2→7px；典藏包淡入淡出；「進入招募」小字換行 |
| 測試 | `clicker-browser.py`：浮字 26→30px、點擊粒子數 8 → ≥8 且在落點 ±21px |

## 請特別看

1. **iframe 攔截會不會白抽**：原型 `btn.p1.addEventListener('click',()=>pull(1))`，橋接在同一顆鍵上加 capture 監聽＋`stopImmediatePropagation`。在 WebView2／Chromium 的目標元素上，capture 監聽一定先跑嗎？鍵盤 Enter／Space 觸發的 click 呢？有沒有別的路徑（原型的鍵盤快捷、`__ceremony` 測試掛勾）能不經主頁扣錢就抽？
2. **繼續抽的狀態機**：`again` 訊息 → `collectApoc(true)` → `start(n)`。錢不夠、存檔鎖住、`start` 回 false、連點「繼續」、在「繼續」與「收下」之間快速切換、落帳失敗 `replay` 時 `.closing` 淡出有沒有收回來、`collecting` 旗標（原型的）有沒有卡住導致結果頁沒有任何按鈕。
3. **收下淡出**：`collect` 訊息一來就加 `.closing`（opacity 0、pointer-events none），240ms 後才落帳；落帳失敗時 `replay` 移除 `.closing`——中間這 240ms 玩家看不到結果、按不到東西，會不會吞掉「存檔失敗」的恢復路徑？`close()` 的 280ms 計時器與再次 `show()` 的競態（收下後 280ms 內又按「進入招募」）。
4. **金幣特效**：刷怪一秒一場＋放置擊倒＋連點時，每秒金幣上限 24 是否有效（`budget` 是模組層共用）；金幣抵達時 `wallet.animate` 在 1.0 的錢包數字補間（`clicker.js` coinRaf）上會不會打架；直式縮放、地圖開著、招募層開著時座標與清場（`fx.stop()` 會不會留下飛行中的金幣或錢包動畫）；減少動畫。
5. **1.0 被動到的地方**：更衣室特效（緞帶、星星）＋金幣；技能重擊、三連包、禮包、硬殼的 `burst()` 仍走舊路；`shake()` 在王包中是否跟王包震動衝突。
6. **地圖**：路線高度改由圖片撐開後，地圖第一次打開（圖片還沒載入、高度 0）時 `scrollTo` 捲動位置、直式、`#map-lines` 的 viewBox 與站點百分比是否對齊；`data-apoc-seg` 在 1.0 會不會殘留。

## 驗收（我這邊跑過的）

見本輪回報：`npm test`、`clicker-v3-apoc`／`apoc-play`、`clicker-browser.py`、v3 gate／team／teamui、round14／16／17／19、UI 體檢、招募流程驗證腳本（入口→返回→十連→繼續十連→收下淡出）、兩個世界的實機截圖。
