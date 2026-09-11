# ORDER：技能挑選卡片化、拖曳設定與黑角驗收

日期：2026-09-12  
指揮：Astra  
執行：Claude  
基準：`holo-5.0`／`928d5ed`

本文件是施工與驗收命令；本輪指揮僅讀檔，未修改程式、未 build、未啟動 server。下列命令交由執行輪逐條執行。

已讀簡報、四份必讀文件，以及 `team20.js`、`team20.css`、`map20.template.html`、`check_team20.py`、`check_card_corners.py`、`card_face.js` 公開 API；另查閱 `check_map20.py`、建置預算與既有像素驗收入口。

## 一、黑角裁決

- **(a)** 記為「簡報所列環境未重現；原判準存在假紅缺陷；使用者回報尚未結案」，醒後補畫面、卡名、截圖、DPR、縮放及執行環境，不宣稱已修好。
- **(b)** 採用弧外取樣取代方塊取樣，保留既有數值門檻及有效負控制，多狀態掃描正式入庫並由編隊／地圖驗收共用。
- **(c)** 拖曳成立、中途、目標上方及放下後第一個可呈現畫面全部納入，逐張、逐角記錄有效樣本與跳過原因。

反對 BACKLOG 中「已確定只是修法覆蓋不足」的預設。現有證據不足以把本次回報直接歸因於舊合成層問題；沒有重現前，不准全面加圓角、裁切或關閉 FX。

簡報中的 1,332、1,792、896 個角與效能數字是前輪報告值，本指揮未重新量測，不得寫成本輪實測。

## 二、設計決定

### 2.1 共用完整卡面

從 `mountOverview()` 抽出最小共用掛載／卸載函式，供總覽、挑選器及拖曳 ghost 使用。

必須沿用：

- `SHADOW_CSS` 既有階級墨色選擇器轉換。
- `TEAM_DATA.cards`、`images`、`masks`。
- `HoloCardFace.create(c,{masks,resolve})`。
- 掛載後 `observe(face)`、`refit(face)`；卸載時 `unobserve(face)`。
- 中性姿態呼叫 `paint(face,c.rarity,0,0,{tilt:false})`。

不得重寫 DOM、字級公式、素材編碼或卡池。`cloneNode(true)` 不會自動複製現有 shadow root；**ghost 重新呼叫共用掛載器，禁止把普通 DOM 複製誤當成完整卡面。**

總覽、挑選器與 ghost 各自持有生命週期；關閉挑選器不得清掉總覽的 observer 或事件。卸載必須取消待執行 rAF、移除事件、解除觀察，再移除節點。

`openPicker()` 三種模式共用同一套完整卡面，保留原本候選、禁用、預覽及確認流程。開窗後再 refit；不能拿尚未佈局的 dialog 尺寸完成字級計算。

每次掛滿 24 張，暂不增加虛擬列表、延後換圖或 paint 配額。這是本機證據支持的最小實作，不是跨裝置效能保證。

### 2.2 拖曳

採 Pointer Events，不採 HTML5 DnD。

- 來源：當頁 `#team-grid .team-proxy`，每頁 10 張。
- 目標：四個 `.skill-slot`，補穩定的 `data-slot="0"～"3"`。
- 啟用條件：寬度大於 700 CSS px，主指標且主按鍵，`pointerType` 為 mouse 或 pen。
- ≤700px 與 touch 保留點技能格開挑選器及原有捲動；本輪不加入手機長按拖曳。
- 移動距離達 **8 CSS px** 才成立拖曳；小於 8px 保留原 `select(id,true)` 點擊。
- 拖曳成立後抑制該次衍生 click；下一次正常點擊必須恢復。

ghost 使用同卡完整卡面、原卡未放大的佈局尺寸、中性姿態；在 `body` 的 fixed 覆層定位，`pointer-events:none`、`aria-hidden=true`。原卡保留位置，拖曳不移出 roster、不改 selected，也不開詳情。

拖曳期間抑制來源卡 hover paint；來源外層與 ghost 的 `transform`、`scale`、`rotate`、`translate`、transition 分別處理，禁止只設 `transform:none`。不可把卡內既有 3D 結構全部打平。

`pointermove` 只更新最新座標，一個 rAF 最多更新一次 ghost；閒置時不得維持動畫迴圈。

以 `elementsFromPoint(clientX,clientY)` 的最上層有效命中判定目標，檢查 `.skill-slot` 所屬容器及可用狀態。不是看 ghost 矩形有沒有碰到格子；浮層遮住目標時不可穿透指派。

以下事件統一清理並取消未提交操作：

- 非目標放下、Escape、`pointercancel`、非預期 `lostpointercapture`。
- 換頁、reset、開挑選器、切回地圖、視窗失焦。
- resize 後不再符合拖曳啟用條件。

所有結束路徑均要求 ghost **0**、待執行拖曳 rAF **0**、殘留目標標記 **0**。

### 2.3 選區與訊息

在來源與挑選器外層、各 shadow root 的掛載樣式內設 `user-select:none`／`-webkit-user-select:none`，圖片維持 `draggable=false` 並設 `-webkit-user-drag:none`。不在整頁 blanket 設定 `touch-action:none`；滑鼠／筆拖曳區的觸控設定必須保留 touch 捲動路徑。

新增獨立 `#skill-status`，放在技能區並設 `role=status`。`assignSkill()` 保留唯一規則入口及布林回傳，透過小型訊息函式選擇可見的訊息出口。

原碼的 `#picker-status` **一直存在**，問題是 dialog 關閉時不可見，不是沒有元素。

- 成功：顯示技能格編號與卡名。
- 神話超限：保留原技能，顯示既有拒絕文字。
- 非目標放下：顯示「已取消，技能未變更」。
- 不加自動消失計時器，不擴充技能戰力、來源或持久化。

### 2.4 反對簡報的單一負控制要求

**只移除 `user-select:none` 不保證自然產生藍選區。** `preventDefault`、圖片不可拖曳及 pointer capture 都可能仍阻止選取。

因此分成兩個實驗：

1. 只移除選區保護，跑真實拖曳並如實記錄結果。
2. 在獨立測試頁解除阻擋選取的條件，建立實際瀏覽器選區，確認卡面或文字 ROI 出現選取覆色，再要求同一像素判準拒絕。

不得為了讓負控制變紅而刪掉產品的其他有效保護，也不得塗一塊藍色矩形冒充瀏覽器選區。

## 三、逐步命令

### 共通規則

以下路徑以 repo 根目錄為準。Python 命令逐條執行，緊接著查看：

```powershell
$LASTEXITCODE
```

正常命令預期 **0**；負控制及保留基線紅燈的命令另列。非預期 exit 立即停止依賴該結果的後續步驟。

本節新增的 CLI 是**必須先實作的介面契約**，不是聲稱目前已有。

### 命令 1：鎖定現場與修改範圍

先執行：

```powershell
git rev-parse --short HEAD
```

驗證：預期 **`928d5ed`**；不同則回報差異，不偷偷換基準。

```powershell
git status --short
```

驗證：目前已有歷史證據檔修改及未追蹤簡報；施工後對這份清單比較，**本輪覆寫既有髒檔 0 個**。不要求工作區原本乾淨，不執行 restore／reset／clean。

允許手改的既有來源檔：

1. `_art/holo-test/team20.js`
2. `_art/holo-test/team20.css`
3. `_art/holo-test/map20.template.html`
4. `_art/holo-test/check_team20.py`
5. `_art/holo-test/check_card_corners.py`
6. `_art/holo-test/check_map20.py`

允許新增：

- `_art/holo-test/check_picker_drag.py`
- `_art/holo-test/check_card_corner_states.py`
- `docs/clicker/REPORT-2026-09-12-picker-drag.md`
- `docs/clicker/shots/picker-drag/` 下本輪證據。

`check_map20.py` 僅准修正體積預算、加入獨立輸出／基線路徑及接入本輪檢查；不得修改其他視覺門檻。

禁止手改 `card_face.js`、`pool_data.py`、`card_assets.py`、`demo.html`、任何 deluxe／cards-remade 建置器及 `REPAIRS`。`build_map20.py` 已有 20 MB 預算與輸出參數，本輪無須修改。

### 命令 2：先完成基線與輸出隔離

先新增 `check_picker_drag.py` 的 `--snapshot`，保存：

- HEAD、工作區狀態。
- 所有受保護檔及待修改來源的施工前 SHA-256。
- 既有 `acceptance.json` 的逐項結果。
- 現有產物 SHA-256。

輸出只能新增到本輪目錄，已有同名證據則報錯，不能覆寫。

```powershell
python _art/holo-test/check_picker_drag.py --snapshot --out docs/clicker/shots/picker-drag/before
```

驗證：exit **0**；讀入舊結果為 **1097 PASS／7 FAIL／2 NEEDS_DEVICE／1 BASELINE**；七個 FAIL 的名稱及數值須與第四節相符。

再替 `check_map20.py` 加 `--out`、`--build-evidence`、`--protected-before`；未給參數維持舊行為。`check_team20.py` 目前只是呼叫同一個 `main()`，不得宣稱它和 map 是兩套獨立回歸。

驗證：本輪路徑外新增／覆寫證據 **0 個**。

### 命令 3：修正黑角儀器，再施工產品

修改 `check_card_corners.py`：

- 取樣遮罩限定圓角弧外，不能把整個 r×r 方塊當弧外。
- 使用實際四角半徑、縮放及截圖 DPR；CSS 座標與裝置像素不得混用。
- 傾斜卡必須使用投影後幾何；不能直接對 bounding box 套未變形圓角。
- 排除 viewport 外、裁切、遮擋或背景無鑑別力的樣本，逐角記原因。
- 不為避開陰影而一律刪掉暗像素；遮擋及取樣資格必須由幾何與控制組證明。
- 保留一般工具 **8%／12**，編隊呼叫端 **5%／6**；本轮不放寬。
- CLI 直接使用 `measure_corners()` 的結果；有效樣本 **0** 必須印 **SKIP**，exit **2**。
- 必測狀態沒有有效樣本，由上層判為覆蓋缺口，不能冒充通過。
- 注入須遞迴進入 shadow roots，證明實際目標的偽元素已生效。

新增正式 `check_card_corner_states.py`，以自檢涵蓋亮背景深色卡框、四角各別黑塊、零樣本、DPR、遮擋與投影幾何。

```powershell
python _art/holo-test/check_card_corner_states.py --self-test --out docs/clicker/shots/picker-drag/corner-selftest
```

驗證：exit **0**；乾淨樣本誤報 **0**；四個單角故障 **4/4** 被檢出；零樣本 **1/1 SKIP**；漏檢、未生效注入與錯誤 PASS 均 **0**。保存原圖、弧外 mask、背景 mask 及逐角 JSON。

### 命令 4：完成挑選器與拖曳產品碼

依第二節修改三個產品檔；不得修改其他產品來源。

新增 `check_picker_drag.py --suite picker`、`--suite drag`，測試必須以 UI 事件操作。準備 fixture 可使用既有公開 API；正式拖曳不能直接呼叫 `assignSkill()` 代替。

挑選器驗收：

- 三模式 × 三 viewport，每次 **24 張**候選、每格 **1 張 `.hcard`**。
- viewport：1440×900、1024×768、390×844。
- 逐列捲動確認 **24/24** 可達，不把同時可见張數當總數。
- 總覽仍為每頁 **10 張**，两頁聯集 **20 張**。
- 開關挑選器 **20 次**後，挑選器 observer、事件與殘留卡面均 **0**；總覽仍 **10 張**。
- 正常關閉、Escape、確認成功與切畫面皆驗清理。

拖曳驗收：

- 兩個桌面 viewport × 20 位成員 × 4 技能格，個案間 reset：**160/160** 指派正確。
- 每案只改目標格，其他格變更 **0**；roster 變更 **0**。
- 未達 8px 點擊、剛達 8px 拖曳、非目標放下、神話拒絕及全部取消路徑各有斷言。
- 神話第一張成功 **1**；第二格再放神話成功 **0**；同格替換神話成功 **1**。
- 拒絕訊息在可見技能區出现 **1**，不能只驗隱藏 dialog 的文字。
- 手機點技能格開窗成功 **4/4**；touch 捲動造成技能變更 **0**。
- 拖曳與下一次普通 click 各只觸發預期操作 **1 次**。
- 每次清理後 ghost、目標標記及待執行拖曳 rAF 均 **0**。

這一步先寫完程式與檢查；以下瀏覽器驗證必須等命令 5 完成新產物，不能拿舊 `map20.html` 驗新來源。

### 命令 5：依既定順序建置

由執行輪執行；本輪指揮不執行。先進入：

```powershell
Set-Location _art/holo-test
```

驗證：目前位置尾段為 **`_art/holo-test`**。

下列十條各自執行、各自檢查 exit **0**：

```powershell
python update_demo_data.py
```

```powershell
python build_round4_fonts.py
```

```powershell
python build_round5_standalone.py
```

```powershell
python build_cards_remade.py
```

```powershell
python build_cards_remade_standalone.py
```

```powershell
python build_deluxe_b.py
```

```powershell
python build_deluxe_b_standalone.py
```

```powershell
python build_deluxe_b.py --test
```

```powershell
python build_deluxe_b_standalone.py --test
```

```powershell
python build_map20.py --evidence-dir ../../docs/clicker/shots/picker-drag/build
```

最後一條另驗：`html_bytes` **1～20,000,000**、terrain quality **94**、build 記錄 SHA 與實體產物一致 **1**。

只允許上述建置器正常更新衍生產物；受保護來源相對施工前差異 **0**。若重建改到受保護來源，先停下列 diff，不得直接接受新 hash。

以下命令均在 `_art/holo-test` 執行。

### 命令 6：驗功能與卡面像素

```powershell
python check_picker_drag.py --suite picker --out ../../docs/clicker/shots/picker-drag/picker
```

驗證：exit **0**，命令 4 挑選器所有計數成立，新 FAIL **0**。

```powershell
python check_picker_drag.py --suite drag --out ../../docs/clicker/shots/picker-drag/drag
```

驗證：exit **0**；桌面拖曳 **160/160**；未授權狀態變更 **0**；結束殘留 **0**。

```powershell
python check_picker_drag.py --suite pixels --out ../../docs/clicker/shots/picker-drag/pixels
```

先實作此 suite，沿用 `SAMESIZE_JS` 工法。以 **24 張 × 3 viewport＝72 組**，比較挑選器與同卡總覽掛載器；不在 roster 的四張以明確 fixture 納入，不縮小預期集合。

統一寬度 **260 CSS px**、DPR **2**，完成字型及圖片 decode、refit、`paint(0,0)`，遞迴暫停 WAAPI、固定時間、等待雙 rAF；每組獨立採樣 **3 次**。

驗證：

- 三次重現 mean **<1.0**。
- 跨入口 mean **<1.0**、差值 >32 的像素 **<1%**、亮度標準差 **>8**。
- 名字與稀有度另裁 ROI，沿用同一差異門檻；非預期 fallback **0**。
- 字級／幾何契約沿用既有 **0.011px** 門檻。
- 缺卡、decode 失敗、空 ROI、非有限數、來源不符均 **0**。

不把「像素相等」偷換成每個像素必須 bit-exact；既有七入口已接受光柵化微差，本輪沿用原門檻並報實值。

```powershell
python check_picker_drag.py --suite negative --out ../../docs/clicker/shots/picker-drag/negative
```

驗證：控制組 runner exit **0**；乾淨組 FAIL **0**；少卡、錯階級墨色、錯技能格、實際選區覆色四類反例 **4/4** 被各自相關斷言拒絕。每個故障子案例 exit **1**；不能靠無關錯誤湊數。

藍選區必須以相同卡面、相同姿態的選區開／關截圖及差分 ROI 判定，不可數全卡藍像素。乾淨拖曳誤報 **0**、實際覆色負控制漏檢 **0**。

### 命令 7：多狀態黑角掃描

```powershell
python check_card_corner_states.py --suite all --out ../../docs/clicker/shots/picker-drag/corners-chromium
```

驗證：exit **0**；至少保留簡報 **39 種狀態**的明列清單，另增拖曳狀態；預期狀態遺漏 **0**、必測狀態零有效樣本 **0**、乾淨黑角 **0**。

清單必含卡冊靜態／hover、揭卡 pack／演出時點／results／hover／click，以及編隊總覽／選取／hover／詳情／三種挑選模式。揭卡必走實際控制器，不能把 `pull()` 當完成揭卡。

拖曳至少取 depth、framed、flat 各一張，兩桌面 viewport，成立／中途／目標上方三時點：ghost **3×2×3×4＝72 個有效角**；放下後另驗來源卡四角。技能格本身仍是文字按鈕，不冒充落地卡面。

放下後第一個 rAF 與雙 rAF 穩定畫面分開保存；穩定取樣不得冒稱「第一幀」。

```powershell
python check_card_corner_states.py --suite all --channel chrome --gpu d3d11 --dprs 1,1.25,1.5,2 --out ../../docs/clicker/shots/picker-drag/corners-chrome
```

```powershell
python check_card_corner_states.py --suite all --channel msedge --gpu d3d11 --dprs 1,1.25,1.5,2 --out ../../docs/clicker/shots/picker-drag/corners-edge
```

兩條各驗：exit **0**；DPR 覆蓋 **4/4**；乾淨黑角 **0**；每個 DPR 的已生效故障控制至少檢出 **1 個角**。保存 browser version、實際 renderer、原始樣本與遮罩。

指定 D3D11 參數不等於已證明使用硬體 GPU。無法取得要求的 renderer 時記 **NEEDS_DEVICE**，不可把軟體 fallback 算 GPU 通過。Edge 通過不等於 Tauri 實機通過。

### 命令 8：效能驗收

```powershell
python check_picker_drag.py --suite perf --channel chrome --out ../../docs/clicker/shots/picker-drag/perf
```

先實作完整暖機一輪並丟棄，再正式取 **3 次**。每次拖曳記 **60 個連續 rAF 間隔**，共 **180 個間隔／桌面尺寸**；與同次環境、同路徑的未按下指標移動配對比較。取樣期間持續移動，禁止凍結動畫或每幀截圖。

驗證：

- 桌面 1440×900@1.25、1024×768@1.25：三次平均 **≥58 fps**，每次 **≥55 fps**。
- 拖曳相對配對基準退步 **≤5%**。
- 挑選器 1440×900@1.25、390×844@3：頂部及底部各取三次、每次 **3 秒**，同上平均與單次底線。
- 無輸入時拖曳 rAF **0**；有輸入時 ghost 每顯示幀提交 **≤1 次**。

58／55 是依簡報約 60 fps 基線保留量測餘裕的新功能門檻；必須先證明同場基準能過。若基準自己不過，回報原始數據及環境，不能歸罪本輪，也不能自行降低門檻。rAF 數字只代表此取樣路徑，不宣稱全部內容呈現均無掉幀。

### 命令 9：既有回歸與七入口一致性

```powershell
python check_team20.py --out ../../docs/clicker/shots/picker-drag/regression --build-evidence ../../docs/clicker/shots/picker-drag/build/build.json --protected-before ../../docs/clicker/shots/picker-drag/before/protected-before.json
```

驗證：預期 exit **1**，因第四節允許的既有 FAIL／NEEDS_DEVICE；**新增 FAIL 0**、舊 PASS 退步 **0**。新 suite 不得掩蓋原報表。

```powershell
python check_card_identity.py
```

驗證：exit **0**；素材同一性差異 **0**。

```powershell
python check_card_parity.py --label picker-drag --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team
```

驗證：exit **0**；入口 **7**、viewport **3**、採集錯誤 **0**。

```powershell
python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --reference gacha-test
```

驗證：exit **0**；缺漏、契約及幾何差異 **0**。

```powershell
python check_card_assets.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --output ../../docs/clicker/shots/picker-drag/asset-layers.json
```

驗證：exit **0**；資產／層比對差異 **0**。

```powershell
python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --out ../../docs/clicker/shots/picker-drag/sabotage
```

驗證：runner exit **0**；既有反例 **56/56** 被拒絕；clean exit **0**、故障子案例 exit **1**；原始輸入 SHA 變更 **0**。

新增 `check_picker_drag.py --suite entry-pixels`，逐組呼叫現有 `check_shot_determinism.py` 與 `shoot_card_parity_samesize.py`，顯式傳本輪 `--out`。不用硬編碼舊證據目錄的 `run_identical_pixels.py` 覆寫歷史。

```powershell
python check_picker_drag.py --suite entry-pixels --out ../../docs/clicker/shots/picker-drag/entry-pixels
```

驗證：exit **0**；三卡型 × 三 viewport 的決定性 gate **9/9**，七入口比較 **63/63**；mean **<1.0**、>32 差異 **<1%**、亮度標準差 **>8**。重用證據必須匹配本輪來源、工具及產物 SHA。

## 四、完成定義與七條基線處置

| 原 FAIL | 本輪處置 | 預期 |
|---|---|---|
| `build.html_bytes` | 修正 `check_map20.py` 舊上限，遵循已存在的 lossless 裁決 | **≤20,000,000，PASS** |
| `team.protected_files_changed` | 保留歷史比較；另用施工前 manifest 守住本輪 | 歷史 **1** 可保留；必須仍僅為 `demo.html`；本輪變更 **0** |
| `team-1440x900.overview_pointer_unchanged` | 保留舊斷言與結果，不為了變綠移除總覽互動 | 原值 **0** 可保留 FAIL |
| `team-1440x900.proxy_animations` | 保留舊斷言；追記 animation 目標及種類 | 原值 **1** 可保留 FAIL |
| `team-1440x900.automatic_animations` | 同上 | 原值 **1** 可保留 FAIL |
| `team-1024x768.proxy_animations` | 同上 | 原值 **1** 可保留 FAIL |
| `team-1024x768.automatic_animations` | 同上 | 原值 **1** 可保留 FAIL |

體積是落實既有使用者裁決，不是本輪新增放寬。其他六條暫不退役，也不提高門檻；若 animation 來源改成新功能殘留，即使數值仍為 1，也不准沿用豁免。

歷史受保護檔結果須獨立保留，不能拿新 manifest 覆蓋舊證據，讓既有的 1 消失。

完成須同時符合：

- 新功能、像素、黑角有效性與負控制全部通過。
- 原有 **1097 個 PASS 逐項維持**；體積修正後至少 **1098 PASS**，新增斷言另計。
- 既有 FAIL 最多保留上述 **6 條**；新增 FAIL **0**。
- 原有背景分頁相關 **2 NEEDS_DEVICE** 不改成 PASS；新增 GPU／Tauri 缺口分別列出。
- 必測狀態覆蓋缺口 **0**；合法 SKIP 有逐項原因，不能計入 PASS。
- 完成報告列出來源 SHA、命令、exit、數字、PNG、mask、JSON、差異與未完成事項。
- 不上 gh-pages、不產 exe、不擴展技能規則。

「新功能已驗收」與「使用者黑角回報已結案」是兩項結論；後者仍等待對應環境證據。

## 五、Astra 複驗命令與不代決事項

複驗直接逐條重跑第三節命令 6～9，使用新的複驗輸出子目錄；不重用施工者標記為 PASS 的結論代替執行。`check_team20.py` 已包含地圖回歸，不再重跑相同的 `check_map20.py` 冒充第二份驗證。

另執行：

```powershell
git diff --check
```

驗證：exit **0**、空白錯誤 **0**。

```powershell
git diff --name-only
```

驗證：對照施工前清單，本輪未授權來源變更 **0**、歷史髒檔遭覆寫 **0**。

Astra 會實際查看挑選器、拖曳中、成功／拒絕放下、手機捲動、黑角遮罩與選區負控制截圖，不只讀 JSON。

使用者已入睡，下列事項不代為決定，也不阻擋已授權施工：

1. **不宣告使用者黑角回報無效或已修復。** 需醒後提供對應畫面、卡名、截圖及環境。
2. **不把 Edge 代替 Tauri 實機驗收。**
3. **不定義技能來源、效果、戰力、持久化或新的重複限制。**
4. **不變更 lossless、不調地形品質、不引入縮圖。**
5. **不順便處理禮物卡字型、新卡、變種卡或退役其他歷史守衛。**
6. **不上線、不發布 exe。**

做不到指定門檻時，保留實測值與證據，停止依賴該項的完成宣告；不得自行放寬、刪除樣本或把 SKIP 改成 PASS。