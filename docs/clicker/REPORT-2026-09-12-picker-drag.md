# 完成報告：技能挑選卡片化＋拖曳設定；黑角覆蓋率掃描（2026-09-12 夜，holo-5.0）

執行：Claude。指揮：Astra（`ORDER-2026-09-12-picker-drag.md`）。簡報：`BRIEF-2026-09-12-picker-drag.md`。
使用者入睡前指示：「持續 LOOP 工作，把已經規劃好的東西一路建設下去」。**沒有上線、沒有出 exe。**

> 兩項結論分開：**新功能已照 ORDER 驗收**；**使用者的黑角回報仍未結案**（本輪環境掃不到，等使用者醒後提供畫面／卡名／DPR／執行環境）。

---

## 〇、commit 序列（分支 `holo-5.0`）

| commit | 內容 |
|---|---|
| `5b8deba` | 簡報與 ORDER |
| `8cfcbff`…`dcccdb0` | 命令 2–9 施工、建置、證據、第一版報告 |
| （本 commit） | Astra 第一次 VERDICT（EXIT 1）＋掃描器修正 v3＋重掃證據＋報告修正 |

命令 1 現場：ORDER 基準 `928d5ed`；施工實際從 `5b8deba` 起（差一個純文件 commit，內容無程式）。
施工前工作區乾淨（我先前跑 `check_team20.py` 覆寫過 `shots/team-round3/*.png` 352 個檔，已 `git checkout` 還原，未帶進任何 commit）。

## 一、黑角裁決落地（ORDER 第一節）

- (a) 記為「簡報所列環境未重現；原判準存在假紅缺陷；使用者回報尚未結案」。
- (b) `check_card_corners.py` 改弧外取樣＋0×0 探針投影四角＋單應性反投影；門檻維持 8%／12（編隊呼叫端 5%／6）；0 樣本 SKIP、exit 2；注入遞迴 shadow root。
  多狀態掃描入庫為 `check_card_corner_states.py`，`check_team20.py` 的黑角回歸改用同一支 `collect_geometry()`。
- (c) 拖曳成立／中途／目標上方／放下第一個 rAF／雙 rAF 穩定 五個時點 × depth／framed／flat × 兩桌面 viewport 已納入 `--suite all`。

自檢：`corner-selftest/` **12/12**（亮背景深框卡誤報 0、單角黑塊 4/4、零樣本 SKIP 1/1、遮擋 SKIP、DPR 2、傾斜乾淨 0／傾斜單角檢出）。

## 二、設計實作（ORDER 第二節 → `team20.js`／`team20.css`／`map20.template.html`）

- `mountFace(host,c,{pointer})`：唯一掛載器，回 `{face,mount,dispose,refit}`；總覽 `overviewFaces`、挑選器 `pickerFaces`、ghost 各自持有；dispose 拆 pointer 事件、`unobserve`、移除節點。
- `openPicker()`：`showModal()` 之後才掛 24 張、下一個 rAF 再 `refit`；`closePicker()`／`setScreen()`／`reset()` 卸載。三模式共用；原候選／禁用／預覽／確認流程不變。
- 拖曳：Pointer Events；`innerWidth>700 && isPrimary && button===0 && (mouse|pen)`；8 CSS px 成立；ghost＝`mountFace` 的完整卡面、未放大佈局尺寸（`offsetWidth`）、中性姿態、`#drag-layer` fixed 覆層 `pointer-events:none aria-hidden`；`elementsFromPoint(x,y)[0].closest('#skill-grid .skill-slot')` 最上層命中；一個 rAF 最多一次 `placeGhost`；
  取消路徑：非目標放下、Escape、`pointercancel`、非預期 `lostpointercapture`、`showPage`、`reset`、`openPicker`、`setScreen`、`blur`、resize 到 ≤700。全部走 `dragCleanup()` → ghost 0／rAF 0／`drop-target` 0／釋放 capture。
  衍生 click 只吃一次（capture 階段攔截，`setTimeout(0)` 復位）。拖曳中清掉非空選區（從 `user-select:none` 網格按下再拖過詳情面板時 Chrome 仍會延伸選區——1024×768 實測到）。
- 訊息：新增 `#skill-status[role=status]`；`notify()` 在 dialog 開著寫 `#picker-status`、否則寫 `#skill-status`。成功「獨立技能 n · 卡名」、神話超限沿用原文、取消「已取消，技能未變更」。`assignSkill()` 仍是唯一規則入口、回布林。
- CSS：`#team-grid,.picker-grid,.team-skills` 與 shadow 樣式 `user-select:none`；`img{-webkit-user-drag:none}`；不 blanket `touch-action`；`.dragging` 抑制 hover 放大、來源 55% 透明、`grabbing` 游標。

## 三、逐步命令結果

### 命令 2 快照（`shots/picker-drag/before/`）
HEAD `5b8deba`、髒檔 3（皆為本輪新文件）。**歷史 `team-round3/acceptance.json` 讀到 1104 PASS／0 FAIL／2 NEEDS_DEVICE／1 BASELINE**，不是 ORDER 預期的 1097/7——那份是無損編碼之前的證據；7 FAIL 是我在 HEAD 實跑才出現（簡報第一節）。受保護檔相對歷史 baseline 已變者：`demo.html`（歷史已知的 1 個）。

### 命令 3 儀器
`check_card_corners.py cards-remade.html --viewport 1440x4200`：乾淨 **0/148**；`--inject-bug` **48/148 FAIL**；`map20.html`（地圖面無卡）**SKIP exit 2**。自檢 12/12。

### 命令 5 建置（十步各 exit 0）
`build/build.json`（最終版，技能訊息移入標籤列後重建）：`html_bytes` **11,687,635**（1～20,000,000）、terrain **94**、記錄 SHA `2b55224b…` 與實體一致。第一次建置為 11,687,285／`6abfd111…`，已被覆蓋。
⚠ 重建改到的非 map20 產物：cards-remade×2、deluxe×4、demo×2、兩個 woff2——**全部只差內嵌字型子集 bytes**：Sans 240,556→**240,448**、Serif 325,088→**325,236**（後者正是 `HANDOFF-2026-09-11` 記載的權威值；HEAD 上 commit 的產物反而偏離文件）。用 fontTools 比對：cmap 皆 **739**、glyf 皆 **1056**、字元集完全相同，只有 WOFF2 壓縮輸出不同。`demo.html` 在禁改清單，這是建置器（`build_round4_fonts.py`）的正常衍生更新，不是手改；照 ORDER「先停下列 diff」記在這裡，未自行接受為新基準——**留給 Astra 裁**。

### 命令 6 功能與像素
輸出 `shots/picker-drag/{picker,drag,pixels,negative}/summary.json`（第一輪跑在版面修正前，搬到 `superseded/run1/`；下列數字是**最終產物**的）。

| suite | 結果 | 關鍵數字 |
|---|---|---|
| picker | **102/102** | 三模式 × 三 viewport 各 24 顆、每格 1 張 `.hcard`、殘留 `<img>` 0、逐格捲動可達 24/24；總覽每頁 10、兩頁聯集 20；開關 20 次後 observer 增量 0、pickerFaces 0、DOM 殘留 0、總覽仍 10；Escape／關閉鍵／確認成功／`setScreen` 四種關閉路徑清理；頁面錯誤 0 |
| drag | **113/113** | 桌面 1440×900 + 1024×768 × 20 成員 × 4 格 **160/160**，每案其他格變更 0、roster 變更 0；<8px＝點擊（開詳情、技能不變）、8px 成立（ghost 1）；非目標放下→技能不變、訊息「已取消，技能未變更」、詳情未開；Escape／showPage／openPicker／setScreen／blur／pointercancel 各路徑 ghost 0／targets 0／rAF 0／pending 0；神話：第一張 1、第二格 0（訊息在技能區可見）、同格替換 1；拖曳中 `getSelection()` 空、清選區前後網格 ROI 差分 >32 像素比 0；標籤↔data-slot 4/4；手機 tap 技能格開窗 4/4、CDP touch 拖曳技能變更 0 |
| pixels | **1599/1599** | 24 卡 × 3 viewport = 72 組（不在 roster 的 4 張以同稀有度換入）；統一 260 CSS px、DPR 2、SAMESIZE 中性姿態、全頁隔離只留目標卡；每入口三次重現 mean <1.0；挑選器 vs 總覽 mean <1.0、>32 像素 <1%、亮度 std >8；卡名／稀有度 ROI 同門檻；幾何差 ≤0.011px；字型同、墨色同、fallback 0 |
| negative | **4/4** | 少一張（visible 23≠24）、錯階級墨色（name ROI mean 63.5、ink_same false）、錯技能格（標籤「獨立技能 2」→ skills[1] 未指派）、真實選區覆色（ROI 差分 0.67）——四個子案例各 exit 1、各被相關斷言拒；乾淨組（上表）FAIL 0 |

pixels 第一版兩個測試端假紅已修：(1) 總覽卡被 modal `<dialog>` 與 `::backdrop` 蓋住；(2) fixed 定位的卡仍在 grid 堆疊序裡，後面的隊員名字透上來。都改成沿用 parity 的全頁 ISOLATE（所有 root `visibility:hidden`，只留目標卡，背景 `#0e121a`）。

### 命令 7 多狀態黑角

**Astra 第一次複驗（VERDICT）判 EXIT 1，抓到兩個掃描器漏洞，已修並重跑：**
1. `scan_drag()` 只從 roster 前 10 張找卡型，**flat 從未被拖過**，而必測清單又由實際跑到的反推 → 缺 10 個狀態／DPR 卻報 missing 0。改成固定矩陣（3 卡型 × 2 viewport × 5 時點）、flat 以同稀有度 `team20.add()` 換入。
2. over-slot 時 ghost 下緣出視窗被整張 SKIP，卻靠同畫面其他 11 張卡的 44 角讓「非零樣本」過關。改成抓取點放在卡 88% 高（ghost 懸在技能格上仍留在視窗內），並以 **ghost 自己 ≥4 有效角** 判三個拖曳時點的覆蓋（`ghost_valid`）。
補上 flat 後第一次掃出 3 個「黑角」（desk mid／over-slot、tablet over-slot），切圖看是 **flat 卡滿版插畫的黑描邊蓋在鄰卡角上**——ghost 遮擋沒被排除。再補：角落方塊或背景環與非自身 ghost 矩形相交 → 該角記 `occluded by drag ghost` 不判（ghost 是 `pointer-events:none`，`elementsFromPoint` 看不到，只能用矩形）。自檢仍 12/12。

`check_card_corner_states.py --suite all`（v3），每個 DPR **52 個記錄／50 個必測**（20 一般 + 30 拖曳；`gacha-pack` 無卡面只留紀錄、注入負控制另計）：

| 瀏覽器 | renderer | DPR | 必測遺漏 | 零樣本必測 | ghost 缺角 | 乾淨黑角 | 負控制紅 |
|---|---|---|---|---|---|---|---|
| bundled Chromium（SwiftShader） | 軟體 | 1 | 0 | 0 | 0 | **0** | 48 |
| Chrome 152 `--headless=new --use-angle=d3d11` | RTX 3080 Ti D3D11 | 1／1.25／1.5／2 | 0 | 0 | 0 | **0** | 48×4 |
| Edge 151（WebView2 同核） | RTX 3080 Ti D3D11 | 1／1.25／1.5／2 | 0 | 0 | 0 | **0** | 48／48／48／76 |

ghost 角：3 卡型 × 2 viewport × 3 時點 = 18 個狀態，每個 ghost **4/4** 有效角（72/72／DPR）。被 ghost 壓住的鄰卡角 Chromium 76 個，逐角記原因，不算 PASS 也不算 FAIL。
**Edge 通過不等於 Tauri 實機通過**；renderer 字串存在 `summary.json`。第一版（v1，缺 flat）與 v2 證據移到 `superseded/run1`、`run2`。

### 命令 8 效能
`--suite perf --channel chrome`（RTX 3080 Ti D3D11）**22/22**。暖機一輪丟棄，正式 3 次，每次 89–90 個 rAF 間隔（取前 60）：

| 尺寸 | 拖曳 fps（3 次） | 配對基準（未按鍵移動） | 退步 |
|---|---|---|---|
| 1440×900@1.25 | 60.0／60.0／60.0 | 59.4 | −1.08%（更快） |
| 1024×768@1.25 | 60.0／60.0／60.0 | 60.0 | +0.01% |

挑選器 1440×900@1.25 與 390×844@3，頂／底各 3 次 × 3 秒：全部 60.0。ghost `style` 寫入 ≤ 幀數＋1（90/89）、閒置 rAF 0。
取樣器第一版兩個假紅已修：路徑不足 60 幀被判 0；`stop()` 後立刻 `start()` 舊 rAF 迴圈沒退出而疊到 120／180 fps。單機單次路徑取樣，不跨機器比較。

### 命令 9 既有回歸與七入口一致性
| 命令 | 結果 |
|---|---|
| `check_team20.py --out regression --build-evidence build/build.json --protected-before before/protected-before.json` | exit **1**（預期）：**1098 PASS／6 FAIL／2 NEEDS_DEVICE／1 BASELINE**。六條 FAIL＝第四節允許保留的六條；`html_bytes` 轉 PASS（11,687,635 ≤ 20,000,000）；缺斷言 **0**。基準要分開講：相對施工前**實跑**（HEAD 928d5ed：1097 PASS／7 FAIL）舊 PASS 退步 0；相對 `before/snapshot.json` 保存的**歷史** acceptance（無損前，1104 PASS）有 6 個 PASS→FAIL，正是允許清單那六條，允許清單以外退步 0。`protected_changed` 只有 `demo.html`（命令 5 的字型 bytes） |
| 中途一次：`#skill-status` 佔一行時 `visible_noncard_ui_area` 30.3／31.8／32.6（>30）、手機 `visible_card_area` 43.8（<45）→ 沒放寬門檻，改把訊息放進標籤列（absolute），回到 28.5／29.8／29.9 與 46.2 | |
| `check_card_identity.py` | exit 0，**454** 層 PASS（`identical/identity.json` 內容不變） |
| `check_card_parity.py --label picker-drag --fixture auto --shots --entries …7 入口` | exit 0 |
| `check_card_parity_report.py --reference gacha-test` | exit 0，**全綠** |
| `check_card_assets.py` | exit 0，**960 comparisons、differences 0** |
| `check_card_parity_sabotage.py` | exit 0，**56/56** 反例被擋 |
| `check_picker_drag.py --suite entry-pixels` | **208/208**：9 個決定性 gate 全過、七入口 63 組比較 mean <1.0、>32 <1%、std >8 |

既有 `check_team20.py` 兩處測試端相容改動：挑選器定位器 `#picker-grid [data-id]` 縮到 `.team-proxy[data-id]`（卡面 `.hcard` 也帶 data-id，Playwright 穿 shadow 會 strict-mode 撞）；黑角回歸改用共用 `collect_geometry()`。斷言值與門檻都沒動。

## 四、完成定義對照

| 條件 | 結果 |
|---|---|
| 新功能、像素、黑角有效性與負控制全部通過 | ✅ picker 102／drag 113／pixels 1599／negative 4／perf 22／corner self-test 12／corners 三瀏覽器 9 個 DPR 組全 OK |
| 原有 1097 PASS 逐項維持；體積修正後 ≥1098 | ✅ **1098**，舊 PASS 退步 0 |
| 既有 FAIL 最多保留 6 條；新增 FAIL 0 | ✅ 恰好六條（`protected_files_changed`＝demo.html 字型 bytes、`overview_pointer_unchanged`、proxy／automatic animations ×2 尺寸） |
| 2 NEEDS_DEVICE 不改 PASS；GPU／Tauri 缺口分列 | ✅ 仍 2；Tauri 實機未驗（第五節） |
| 必測狀態覆蓋缺口 0；合法 SKIP 有原因 | ✅ 每 DPR 42 狀態、遺漏 0、零樣本必測 0；skip 逐張記 `out of viewport`／`occluded`／`not visible` |
| 報告列來源 SHA、命令、exit、數字、PNG、mask、JSON | ✅ `shots/picker-drag/*/summary.json`、`build/build.json`、`before/snapshot.json`；PNG 逐狀態；黑角 rows 含弧外像素數與在地背景 |
| 不上 gh-pages、不產 exe、不擴展技能規則 | ✅ |

七條基線處置：`build.html_bytes` 依 lossless 裁決改 20MB 上限→PASS；`protected_files_changed` 歷史 1（demo.html）保留、本輪 manifest 也只抓到 demo.html 且原因是建置字型 bytes（第五節第 2 點）；其餘四條原值保留 FAIL，animation 來源仍是既有總覽互動，不是新功能殘留（拖曳中 ghost 只在 `#drag-layer`，量測時沒有拖曳）。

## 五、Astra 第一次複驗（`VERDICT-2026-09-12-picker-drag.md`）處置

| 裁決 | 處置 |
|---|---|
| EXIT 1：flat 漏測 10 狀態／DPR | 已修（固定矩陣＋flat fixture），v3 三瀏覽器 9 組 DPR 全 52 狀態 |
| EXIT 1：over-slot ghost 整張 SKIP 卻靠他卡過關 | 已修（抓點 88% 高＋`ghost_valid` ≥4 才算覆蓋） |
| 命令 5 字型 bytes：接受重建產物為新基準；不更新歷史 manifest、`protected_files_changed=1` 不改 PASS | 照辦（本輪沒動 manifest） |
| REPORT 建置舊值 11,687,285／6abfd111 | 已改為 11,687,635／2b55224b |
| 「舊 PASS 退步 0」基準混寫 | 已分開寫實跑基準與歷史快照基準 |
| Edge DPR 2 負控制 56 vs 48 | 負控制數量本來就隨版面波動，門檻是 ≥1；v3 為 76 |
| `git diff --check HEAD~5..HEAD` 8794 個尾空白（ORDER 三份 md 與 log） | 未處理：ORDER 是 Astra 產出的 markdown 雙空白換行、log 是工具輸出；等裁決要不要清 |
| 瀏覽器在工作目錄留 `debug.log`（GPU SharedImageManager mailbox 錯誤） | 屬 Chrome 原生診斷；v3 重跑後若再出現一併移入 verify |

## 六、未完成／待裁決

1. **使用者黑角回報未結案**：需醒後提供畫面、卡名、截圖、DPR、Tauri 或瀏覽器。Edge 不代替 Tauri 實機。
2. 命令 5 字型子集 bytes 差異（上述）等 Astra 裁：接受重建產物為新基準，或改回 HEAD bytes。
3. 手機（≤700px／touch）**沒有**拖曳（ORDER 2.2 決定），走原本點格開挑選器。
4. 技能來源／效果／戰力／持久化未定義（不代決）。
