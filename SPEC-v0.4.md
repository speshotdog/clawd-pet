# clawd-pet v0.4 規格書（Codex 作業用）

本文件是唯一需求來源。分三階段（PHASE 1/2/3），每次作業只做指定 PHASE，不要越界。
程式碼註解風格比照現有檔案（繁體中文、說明「為什麼」）。不要動 tools/、不要動既有角色拆件圖。

## 專案背景速覽
- Tauri 2 桌寵。前端 `src/pet.js`（角色狀態機）、`src/toy.js`（玩具）、`src/index.html`（六角色 <template>）、`src/pet.css`。後端 `src-tauri/src/main.rs`。
- 視窗：主寵 label=`main`、夥伴 `pet_<char>`、玩具 `toy_<id>`。stage 固定 240x256 CSS，縮放用 transform（SCALE）＋ fit_window(dpr*SCALE)。
- 所有角色頭頂都對齊 CSS y=93，地面線 CSS y=254。
- pet-cmd 事件格式一律 `label:指令`，前端過濾自己的。
- 視窗建立必須在非主執行緒（見 set_companion 註解，主執行緒 build 會死鎖）。

---

## PHASE 1：Bug 修復 + 小功能

### 1-A Bug：切換角色後夥伴勾選還在但夥伴視窗消失
現象：主視窗換角色（`char:` → location.reload()）後，localStorage 的 petcompanions 還在（選單勾選還在），但夥伴視窗不見了。
成因假說（請驗證）：reload 後 main() 開機還原對每個夥伴呼叫 `set_companion(on=true)`，該函式先 `destroy()` 舊視窗再立刻 `WebviewWindowBuilder::build()` 同 label。destroy 是非同步完成的，立刻 build 同 label 會撞「label already exists」而 create FAILED（dlog 有記）→ 視窗沒了但清單還在。
修法：`set_companion` 在 destroy 後輪詢等待 `app.get_webview_window(&label)` 變 None（每 50ms 查一次，上限 3 秒）再 build；build 失敗時 dlog 並 500ms 後重試一次。`set_toy` 有同樣模式，一併修。

### 1-B Bug：玩具恐龍會被踢到另一個螢幕
現象：多螢幕環境，恐龍被踢後飛到另一顆螢幕。
成因：`spawn_toy_physics` 每 tick 用 `work_area_of(&w)` 重算邊界（MonitorFromWindow 取「目前最近」螢幕）。視窗高速飛行/彈跳跨過螢幕接縫時，邊界會切換成鄰螢幕的工作區，牆壁跟著搬家，恐龍就順勢滾過去了。
修法：把工作區「閂鎖」在起跳當下的螢幕——玩具 grounded 且靜止時才允許重新取 work_area_of；airborne 或還在滾動時沿用上次閂住的 Rect。使用者手動拖曳到另一螢幕（grabbed 放下）時重新閂鎖。確保既有測試 `kick_trajectory` 仍過，並補一個「邊界閂鎖後不會超出該 Rect」的小測試（可直接用 Phys::step 驗證即可）。

### 1-C 玥玥（yueyue）睡覺換圖
素材已就位：`src/yueyue-sleep.png`（180x180，整張是趴睡姿，畫面主體約佔中間 60%）。
需求：yueyue 睡著時不要用現行「rotate(90deg) 躺平」的通用睡姿，改成整隻直接換成這張睡覺圖。
實作建議（機制做通用的，目前只有 yueyue 用）：
- `CHAR_CFG.yueyue` 加 `sleepImage: 'yueyue-sleep.png'`。
- 實例化角色時若有 sleepImage，在 stage 加一個 `<img id="sleepimg">`（display:none）。
- CSS：`#stage.sleep-img #pet { display:none }`、`#stage.sleep-img #sleepimg { display:block }`。JS 進睡眠時若 CFG.sleepImage 存在 → 加 `sleep-img` class（同時仍加 `sleep` class 維持 zzz 氣泡等既有邏輯，但要避免 `#stage.sleep #pet` 的躺平 transform 作用在隱藏的 pet 上造成醒來瞬間跳動——醒來時兩個 class 一起移除即可）。
- 尺寸/定位：站姿高 198px，趴睡應該更矮更寬。sleep 圖以「顯示高度約 150px」起步，水平置中（stage 寬 240），底邊貼地面線 y=254。要在程式旁註解說明尺寸怎麼來的，方便日後調。
- zzz 氣泡位置照舊即可。hit 判定沿用原 hit()（可接受誤差）。

### 1-D 餵食新增「愛心」
- 現行：選單「餵熱狗」→ pet-cmd `feed` → feed()。
- 新增：選單多一項「餵愛心」（主視窗 id `p_feedlove`，夥伴視窗 `q_feedlove@<label>`，插在「餵熱狗」下面）→ pet-cmd `feedlove`。
- `feed()` 改成 `feed(kind)`：kind `'hotdog'`（預設，行為不變）或 `'love'`。
- love 行為：emoji 用 ❤️；不受「fullness>95 吃不下」限制；fullness +5、mood +12；台詞池另開：『最喜歡你了 ♥』『臉紅紅…』『心跳加速！』。吃完觸發 1-E 的愛心噴發特效（任何角色都會）。

### 1-E 女僕狐（fox）雙擊機率愛心特效
- 在既有 dblclick handler：若 `CHAR === 'fox'` 且 `Math.random() < 0.35` → 觸發 `heartBurst()`（原本轉圈照舊，特效疊加）。
- `heartBurst()`：在角色頭部周圍（CFG.center 附近）生成 6~10 個 ❤️/💕/💖 DOM 元素，隨機水平漂移、向上飄 40~80px、1.2s 淡出後移除。CSS keyframes 實作，元素加完自清（animationend remove）。
- 此函式同時被 1-D 的餵愛心呼叫（所有角色）。
- 注意透明視窗效能慣例：特效期間才有 DOM，結束即移除。

### PHASE 1 驗證
- `cargo check`（在 src-tauri；注意 cargo 在 `~\.cargo\bin`，PATH 可能沒有）
- `cargo test`
- JS 無型別檢查，請自我審查一遍語法與 id 對應（p_/q_ 事件 handler 都要接）。

---

## PHASE 2：睡覺被踢 + 珍母寄生

### 2-A 睡著的角色低機率被踢走（比照小恐龍）
需求：睡著的寵物，旁邊清醒的寵物有低機率跑過去把它「踢飛」，飛行物理比照玩具恐龍（拋物線、彈跳、滾動停止）。
設計：
- 前端回報睡眠狀態：新增 tauri command `set_sleeping(window, on: bool)`，pet.js 在進入睡眠（主迴圈 setState('sleep', true) 處）與 wake() 時呼叫。Rust 用 `static SLEEP_STATE: Mutex<HashMap<String,bool>>` 記錄，視窗銷毀時清掉（可在既有清理路徑順手做）。
- Rust 全域評估執行緒（setup 時 spawn 一條）：每 10 秒評估一次。對每個「睡著」的寵物 S：找同螢幕、水平距離 < 250px 的清醒寵物 K（排除正在 busy 的）。找到後以 8% 機率觸發踢擊：
  - 對 K 發 `pet-cmd K:kick:<dir>`（沿用既有踢腿演出）。
  - 對 S 啟動飛行：`busy_start(S)`（擋 walk），初速 vx = dir * rng(500..900) * scale、vy = -rng(400..800) * scale，沿用 `Phys` 結構與 1-B 的「閂鎖工作區」跑 33ms tick 直到 grounded 且 vx==0，然後 `busy_end(S)`。scale 用該視窗 dpr（比照玩具的 scale 來源；查 toy 那邊怎麼拿的就照抄）。
  - 對 S 發 `pet-cmd S:kicked` → pet.js 新 handler：wake()、say('哇啊！？')、mood -5、播 drop+shake（沿用 endGrab(true) 的落地演出即可）。
  - 冷卻：每隻 S 被踢後 3 分鐘內不再被踢（Rust 端記 map label->Instant）。
- 飛行中使用者抓取衝突：簡化處理——飛行執行緒每 tick 檢查該 label 是否還存在即可；不用處理搶奪（機率低、時長 ~2 秒）。

### 2-B 珍母（zhenmu）寄生
需求：珍母在場（主視窗或夥伴皆可）且旁邊有其他夥伴時，低機率跳到別人「頭上」寄生 1~3 分鐘；游標點擊可提前移除。
設計：
- 觸發（JS，僅 CHAR==='zhenmu' 的視窗）：每 20 秒，若非 grabbed/睡眠/走路/已寄生，`Math.random() < 0.12` → `invoke('parasite_start')`。
- Rust `parasite_start(window)`：
  - 找宿主：其他 pet 視窗（label != 自己）、同螢幕、水平距離 < 500px、非飛行中。沒有 → 回傳 false，JS 靜默。
  - 黏附執行緒：時長 rng(60..180) 秒。`busy_start(zhenmu)` 擋 walk。每 50ms 讀宿主 outer_position，把珍母視窗移到：x = host.x（兩窗同尺寸，直接對齊），y = host.y - round(161 * scale * dpr)。161 由來：珍母腳底在 CSS 254、宿主頭頂在 CSS 93 → 254-93=161，請照這樣註解。scale*dpr 的取得比照 fit_window 存的資訊或用視窗實體高/256 推回。
  - 開始時：對珍母發 `pet-cmd <zm>:parasite:1`、對宿主發 `pet-cmd <host>:parasited:1`。
  - 結束（時間到或被點擊）：停止黏附，讓珍母從當前位置做一段小落地物理（沿用 Phys：vx = ±rng(100..200)，vy=0 自由落體到地面），`busy_end`，發 `parasite:0` / `parasited:0`，冷卻 5 分鐘。
- JS 反應：
  - 珍母收 `parasite:1`：say('嘿嘿～')、開心眼；`parasite:0`：say('下次再玩～')。寄生中抑制自走（walking 觸發前檢查 flag）與睡眠計時（lastActivity 持續刷新即可）。
  - 宿主收 `parasited:1`：say('頭上有東西！？')、播 shake；`parasited:0`：say('呼…')。
  - 珍母寄生中被 pointerdown（點擊）：不進入拖曳/打招呼流程，改 `invoke('parasite_end')`。
- z 順序：黏附開始時對珍母視窗重新 `set_always_on_top(true)` 讓它壓在宿主上面。

### PHASE 2 驗證
- `cargo check` + `cargo test`。
- 自我審查：pet-cmd 新指令都有 handler、busy_start/busy_end 成對、執行緒在視窗消失時會收工（比照玩具物理迴圈的寫法）。

---

## PHASE 3：主視窗右鍵選單改成遊戲風懸浮視窗

需求：右鍵「主寵物」不再彈原生選單，改開一個遊戲 UI 風格的懸浮視窗。夥伴/玩具視窗維持原生小選單不動。

### 風格（參考 Stardew Valley 物品欄，全 CSS/inline-SVG 自繪，不引外部資源）
- 外框：深棕木框（#5C3A21 底、#8B5A2B 高光），圓角 10px，四角小鉚釘裝飾。
- 內裡：羊皮紙（#F6E3B4 → #EFCB8E 縱向漸層），區塊用淺棕描邊分隔。
- 標題/區塊頭：小木牌樣式（棕底米字）。
- 按鈕/選項：米色格子＋2px 棕描邊，hover 時金色外框（#FFD24A）＋微微放大；選中狀態（單選/勾選）金框常亮＋左側小圖示（✔）。
- 字體：'Microsoft JhengHei'，粗體，棕黑字（#4A2F1A）。
- 心情/飽食度：畫成 5 格方塊條（實心 ■ 棕紅 / 空心格），數值在旁。

### 內容（沿用全部既有功能，指令走既有路徑）
1. 頂部：角色名（依當前 char 顯示 CHARS 中文名）＋ 心情條 ＋ 飽食度條
2. 動作：餵熱狗 🌭、餵愛心 ❤️、巡邏模式（勾選）
3. 角色（主視窗）：六角色單選
4. 夥伴：六角色勾選
5. 玩具：小恐龍勾選
6. 大小：五檔單選
7. 底部：躲起來、回到主螢幕右下角、開機自動啟動（勾選）、離開

### 實作
- 新檔：`src/menu.html`、`src/menu.css`、`src/menu.js`。
- Rust：
  - 新 command `show_menu_window(app, payload...)`：由 pet.js 的 contextmenu（僅 label==='main' 時）呼叫，帶 mood/fullness/patrol/char/companions/toys/scale/autostart ＋點擊實體座標。
  - 建立/重用 label=`petmenu` 視窗：frameless、transparent、always_on_top、skip_taskbar、resizable(false)、**有 focus**。邏輯尺寸約 300x520（在 `logical_size()` 加 petmenu 分支）。建立走非主執行緒（同 set_companion 模式）。已存在就 destroy 重建（狀態才會新）——沿用 1-A 的等待邏輯。
  - 位置：錨在點擊座標附近，並 clamp 進該螢幕工作區（選單不可超出螢幕）。
  - 關閉：menu.js 監聽視窗 blur → invoke `close_menu_window`；ESC 同。任何選項按下後也自動關閉（狀態類勾選除外——巡邏/夥伴/玩具/自啟這四類按完「不關」，即時更新 UI 讓使用者連續操作；餵食/換角色/大小/躲起來/回家/離開按完即關）。
  - 指令轉發：全部走既有 pet-cmd 路徑（`relay` command 發 `main:feed`、`main:comp:<id>`…）。躲起來/回家/自啟/離開這四個原本是 on_menu_event 裡的 Rust 邏輯 → 抽成新 command `menu_action(app, id: String)`（id: hide/home/autostart/quit），on_menu_event 對應分支改呼叫同一函式避免重複。
  - autostart 勾選狀態：payload 帶進去；按下後 menu.js 重新 invoke 查詢（新增 command `get_autostart() -> bool`）更新 UI。
- 狀態即時性：夥伴/玩具勾選後主視窗 localStorage 會變，menu.js 自己樂觀更新 UI 即可，不必回查。
- pet.js：contextmenu handler 改成 main 走 show_menu_window、夥伴照舊 show_menu。原 show_menu 裡 main 分支的原生選單碼可以刪（q_ 夥伴分支保留）。

### PHASE 3 驗證
- `cargo check` + `cargo test`。
- 自我審查：petmenu 視窗不能搶 always_on_top 蓋住寵物拖曳；blur 關閉不能跟「點選項」互吃（點按鈕在視窗內不會 blur，沒問題）。

---

## 完成後
- `src-tauri/tauri.conf.json` version 升到 0.4.0（PHASE 3 完成時才升）。
- 不要自行 git commit（由審查者處理）。
