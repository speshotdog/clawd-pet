# 派工簡報：技能挑選卡片化＋拖曳設定；黑角覆蓋率掃描結果裁決（2026-09-12 夜，holo-5.0）

給 Astra（gpt-6-astra）。工作區 `D:\claude研究\clawd-pet-50`（worktree，分支 `holo-5.0`，HEAD `928d5ed`）。
**這一輪你是指揮，我（Claude）是執行。你不要改程式碼**；請把要我做的事寫成可逐條執行、可逐條驗證的命令，
輸出到 `docs/clicker/ORDER-2026-09-12-picker-drag.md`。

必讀：`docs/clicker/BACKLOG-2026-09-12.md`（使用者的兩項備註）、`docs/clicker/METHOD-card-face.md`、
`docs/clicker/HANDOFF-2026-09-11.md`、`docs/clicker/DECISION-2026-09-12-lossless.md`。
使用者已入睡，明講「把已經規劃好的東西一路建設下去」；上線（gh-pages／exe）不在本輪。

---

## 〇、規矩（沿用，不重述理由）

- 卡面 DOM／字級唯一來源 `_art/holo-test/card_face.js`，卡池唯一來源 `pool_data.py`；**不准另刻縮圖**。
- 不准為了讓新功能過而放寬既有門檻。門檻要動，寫進報告等裁決。
- 只准改你點名的檔；建置順序照 `REPORT-2026-09-12-identical.md` 第 161 行（最後一步 `build_map20.py`）。
- 驗收要像素證據、要負控制、決定性取樣（WAAPI 暫停＋雙 rAF）。

## 一、既有基線（HEAD 就是這樣，不是本輪弄壞的）

`python _art/holo-test/check_team20.py` 在 `928d5ed`：PASS 1097／FAIL 7／NEEDS_DEVICE 2。七條 FAIL：

```
build.html_bytes                      11,680,201  門檻 ≤6,000,000（無損編碼後 map20.html 變 11.6MB）
team.protected_files_changed          1           門檻 0
team-1440x900.overview_pointer_unchanged 0        門檻 1
team-1440x900.proxy_animations        1           門檻 0
team-1440x900.automatic_animations    1           門檻 0
team-1024x768.proxy_animations        1           門檻 0
team-1024x768.automatic_animations    1           門檻 0
```

請在命令裡明說：這七條**本輪允許維持 FAIL**還是要一起處理（`html_bytes` 那條跟 lossless 決策直接衝突，我認為該由你裁）。
本輪新加的斷言不得讓 PASS 數下降。

## 二、黑角（備註第二項）——掃完了，結論是「掃不到」，請你裁決怎麼收

### 做了什麼

1. 多狀態掃描（scratchpad `scan_corners_states.py`，套 `check_card_corners.measure_corners`）：
   卡冊靜態／hover、揭卡 pack→openPack 各時點→results→hover→click、編隊三尺寸 × 總覽／選取／hover／技能彈窗／新增彈窗，共 **39 狀態、1,332 個角**。
   初判 26 紅，**全部是假紅**，分三種：
   - 彈窗開著時量到的是被 `<dialog>` 蓋住的卡，方塊裡是彈窗內的去背角色圖（20 筆）。
   - 編隊選取／hover 那筆是隔壁卡的陰影，9.03% 貼著 8% 門檻（2 筆）。
   - 揭卡途中神話卡 4 角（2 筆）：**判準錯**——`corner_boxes` 的 r×r 方塊有 79% 是卡片本體，
     背景亮到 lum 220 時門檻 `local_ref*0.35` 變 77，卡框深藍整塊被算進去。
     用只看**圓弧外**的量法重量：弧外中位 200–216，卡外背景 203–222，**圓角外沒有黑**。
2. 揭卡途中做了 25 組單變因 A/B（關 charge-glow／charge-surface／veilback／rarity-fx／foil／card-back／
   底板陰影／blend 全 normal／3D 打平／isolation／leaf overflow…）——**沒有任何一層能改變弧外亮度**，
   跟「合成層吐黑」機制不符。
3. 懷疑 headless SwiftShader 跟使用者 GPU 路徑不同：改用**系統 Chrome `--headless=new --use-angle=d3d11`**
   （驗到 RTX 3080 Ti D3D11）與 **Edge**（Tauri WebView2 同核），DPR 1／1.25／1.5／2，
   判準換成弧外版（scratchpad `scan_gpu_dpr.py`）：
   - Chrome GPU：**0 / 1,792 個角**（56 狀態）
   - Edge GPU：**0 / 896 個角**（28 狀態）
   - 負控制：注入 `check_card_corners.py --inject-bug` 那組寫法 → 紅（headless 7–8/68、GPU 8/68），乾淨版 much_darker 全 0.0，餘裕大。
4. 沒掃到的：拖曳中（功能還沒做）、Tauri 實機、使用者當時看到的那張卡與 DPR（沒有截圖）。

### 請你裁

- (a) 這項是否改記成「**無法重現；原判準有假紅缺陷**」，並要求使用者醒來後提供截圖＋環境（哪個畫面、哪張卡、DPR、Tauri 或瀏覽器）？
- (b) 弧外判準要不要**取代** `check_card_corners.py::measure_corners`（含負控制與 0 樣本印 SKIP 而非 PASS 的修正），
  多狀態掃描要不要留成正式工具、接進 `check_team20.py`／`check_map20.py`？
- (c) 拖曳做完後，拖曳中／落下瞬間要納入掃描——請把它寫進第三節的驗收。

## 三、技能挑選卡片化＋拖曳（備註第一項）——請出設計與命令

### 現況（實測）

- `team20.js:20 proxy()`：彈窗每格＝去背 `<img>`＋名字。`team20.js:25 mountOverview()` 已會把完整卡面掛進 shadow root
  （`HoloCardFace.create` + `TEAM_DATA.css` + masks），編隊網格 10 張就是這樣掛的。
- `team20.js:41 renderSkills()`：四顆 `.skill-slot` 按鈕，`onclick=openPicker('skill',i)`。
- `team20.js:42 assignSkill(i,id)`：神話最多 1 張的規則在這裡，回 false 時把訊息寫到 `#picker-status`（拖曳路徑沒有這個元素可寫，要另找地方）。
- `team20.css:142` 選取放大用 `scale` 屬性（不是 transform）；`.slot,.slot *{user-select:none}` 只在 ceremony.css，`team20.css` 的 `.team-proxy` 沒關 `user-select`。
- `TEAM_DATA.cards` 24 張；彈窗 `.picker-grid` 是 `auto-fit minmax(88px,1fr)`、`max-height:52dvh`、`.team-proxy{max-width:104px}`。

### 效能（GPU Chrome，`--headless=new`，各三秒取樣）

| 狀態 | 1440×900 @1.25 | 390×844 @3 |
|---|---|---|
| 編隊總覽 idle（10 張卡面） | 60.7 fps | 60.7 fps |
| 總覽 hover 掃過 | 61.0 | 60.5 |
| 彈窗（現況去背圖） | 60.6 | 60.8 |
| 彈窗掛滿 **24 張完整卡面** idle | **60.9** | **60.9** |
| 同上、捲到底 | 60.9 | 60.6 |

結論：24 張完整卡面不掉幀，**不需要限制同時 paint 張數**。（單機單次，只證明「沒有明顯掉幀」，不拿來跨機器比。）

### 要你決定的設計點

1. 彈窗卡片化：直接在 `openPicker` 的每格套 `mountOverview()`？還是抽出共用掛載函式？彈窗關閉時的 dispose 要怎麼接（現在 `disposeOverview()` 是總覽專用的 Set）。
2. 拖曳：Pointer Events 自繪 ghost（建議，能過 shadow root、手機也能用）vs HTML5 DnD。拖曳來源＝`#team-grid .team-proxy`（正在顯示的 10 張）；目標＝四顆 `.skill-slot`。
   - 拖曳中 ghost 是不是同一張卡面（複製 DOM）還是縮圖？若是卡面，`user-select`／`-webkit-user-drag`／`touch-action` 怎麼設。
   - 落下判定用 `elementsFromPoint` 還是 rect 相交；落在非目標處的取消回饋。
   - 神話上限違規（`assignSkill` 回 false）在拖曳路徑要顯示在哪。
   - 手機（≤700px）：拖曳要不要開？備註說彈窗是備援路徑，手機是否直接走彈窗。
   - 跟現有 `select(id,true)`（點一下選取＋開詳情）的手勢衝突：移動幾 px 才算拖曳。
3. 驗收（寫進 `check_team20.py` 或新檔，要留在 repo，不准只跑臨時腳本）：
   - 彈窗每格有 `.hcard`、稀有度銘牌／階級墨色與總覽同一張卡**像素相等**（同尺寸中性姿態，沿用 parity 的 SAMESIZE 做法）。
   - 拖曳：Playwright `mouse.down/move/up` 從第 n 張拖到第 k 格 → `team20.skills[k]===id`；拖曳中截圖驗 `<img>`／卡面**沒有藍色選區**（像素判，不是 CSS 變數）；
     拖曳中與落下後跑弧外黑角掃描；落到非目標處 skills 不變；神話第二張被拒且有可見訊息。
   - fps：拖曳中連續 60 幀取樣，門檻由你定。
   - 負控制：把 `user-select:none` 拿掉時藍選區斷言必須變紅。
4. 允許改的檔：請點名（我預期是 `team20.js`、`team20.css`、`map20.template.html`、`check_team20.py`，必要時 `build_map20.py`）。
   **不准動**：`card_face.js`、`pool_data.py`、`card_assets.py`、任何 build_deluxe／cards_remade 建置器、`REPAIRS` 表。

### 產出格式

`ORDER-2026-09-12-picker-drag.md`，章節：
1. 第二節 (a)(b)(c) 的裁決（一句話一條）
2. 設計決定（上面 1–2 各點）
3. 逐步命令：每步「改哪個檔、改什麼、怎麼驗（命令＋預期數字）」
4. 完成定義：哪些腳本要綠、哪些基線 FAIL 允許維持
5. 你驗收時會自己跑的命令
