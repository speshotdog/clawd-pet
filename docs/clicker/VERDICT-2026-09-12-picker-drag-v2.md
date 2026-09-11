**Astra 第二次複驗 VERDICT — 2026-09-12**

審查 HEAD：`99a83ff664a3a2e6adfcc7c6cdae4ae310b5c7d1`。

**最終 EXIT 1。** 本次實跑已補足 flat，over-slot ghost 也確實取得四角；逐角遮擋排除有幾何與圖片支持。但「固定必測矩陣」仍有整批繞過漏洞：全部拖曳未執行時，30 個拖曳必測會被取消，判定仍可通過。

本輪未修改程式碼、未 build、未 commit，也未寫入 VERDICT 檔案。新增證據僅在 `docs/clicker/shots/picker-drag/verify2/`。

**一、親自執行的檢查**

工作目錄 `_art/holo-test`；兩條命令皆設定 `PYTHONIOENCODING=utf-8`。

```text
python check_card_corner_states.py --self-test --out ../../docs/clicker/shots/picker-drag/verify2/selftest
python check_card_corner_states.py --suite all --out ../../docs/clicker/shots/picker-drag/verify2/corners-chromium
```

| 檢查 | 實際結果 |
|---|---|
| self-test | exit 0；12/12 通過 |
| 乾淨亮背景深框卡 | DPR 1、2 均無誤報 |
| 四個單角故障 | TL／TR／BL／BR 檢出 4/4 |
| 其他自檢 | DPR 2 單角、零樣本 SKIP、dialog 遮擋 SKIP、傾斜乾淨及故障案例均符合預期 |
| Chromium 全套 | exit 0；`summary.ok=true` |
| 瀏覽器／renderer | Chromium 149.0.7827.55；ANGLE Vulkan SwiftShader，軟體渲染 |
| 記錄／必測 | 52 筆／50 必測：20 一般＋30 拖曳，另有 gacha-pack 與負控制 |
| 必測缺漏／零有效樣本必測 | 0／0 |
| 拖曳矩陣 | 3 卡型 × 2 viewport × 5 時點＝30/30 |
| flat | 10/10 狀態；拖曳前三時點 ghost 24/24 有效角 |
| 全部 ghost | 18 個狀態各 1 張，均 4/4；共 72/72 有效角 |
| over-slot ghost | 6/6 狀態，24/24 有效角 |
| ghost 缺角／整張跳過 | 0／0 |
| 乾淨黑角／負控制檢出 | 0／48 |
| 有效角樣本 | 全部 2528；排除注入負控制後 2380 |
| 無效角 | ghost 遮擋 76；在地背景純黑 88 |
| 整張跳過 | 出視窗含背景環 159；dialog 遮擋 44；不可見 19 |

上述跳過數按「卡片在各狀態的出現次數」計算，包含非必測與負控制記錄，不是跳過了同樣數量的必測狀態。

**二、diff 審查**

已讀 `git diff dcccdb0..HEAD -- _art/holo-test/`：範圍內只有兩個掃描器，合計新增 64 行、刪除 27 行。

1. **flat fixture 合理，實際漏測已補足。**

   `DRAG_KINDS` 明列 depth／framed／flat；兩個 viewport 與五個時點組成 30 狀態。fixture 搜尋完整 roster，缺卡型時透過公開 `team20.add()` 以同稀有度換入，再切換至對應頁。沒有修改卡面樣式或降低黑角門檻。本次 flat 實際使用 `mieshi`（滅世珍獸）。

2. **`ghost_valid` 解決他卡樣本充數，但判準有適用前提。**

   有效角必須來自 `geometry[card].ghost=true` 的卡；無效角不计入。三個拖曳時點要求至少四個有效角，且有效角若黑角超標仍會進入 `clean_bad`，不是「取到樣本就通過」。

   本次每個拖曳畫面均只有一張 ghost，因此 `ghost_valid=4` 確實代表該張四角完整。程式目前採總和，並未另外斷言 ghost 恰好一張；多 ghost 情境不能僅憑這個總和保證逐張完整。這不是本次實際證據缺口。

3. **88% 抓取點合理。**

   改變抓取位置使 over-slot ghost 與背景環留在視窗內，仍經真實滑鼠拖曳。它沒有把原本出界的樣本硬改為有效，也没有取消出界檢查。

4. **固定矩陣仍非無條件必測，構成本輪阻擋項。**

   `check_card_corner_states.py:250–251` 仍是：

   ```python
   has_drag = bool(drag_done)
   required = list(REQUIRED_STATES) + (drag_required() if has_drag else [])
   ```

   `ghost_gap` 又只檢查已存在的拖曳記錄。若 `scan_drag()` 因 drag API 不存在而提早返回，或所有 fixture 都失敗，`drag_done=[]`，整批 30 個拖曳必測便消失。這與「固定必測，不由實際跑到的結果決定」仍不一致。

   我從原始碼 AST 取出**未修改的覆蓋判定式**，以現存 Chrome DPR 1 證據做記憶體內反例；沒有修改來源或歷史 JSON，也沒有把此診斷冒稱為瀏覽器實跑：

   | 輸入情境 | required | missing | ghost_gap | drag_covered | ok |
   |---|---:|---:|---:|---|---|
   | 原始完整記錄 | 50 | 0 | 0 | true | true |
   | 移除 flat 記錄，保留其他拖曳 | 50 | 10 | 0 | true | false |
   | 移除全部拖曳記錄，`drag_done=[]` | **20** | **0** | **0** | false | **true** |

   部分漏測已能被拒絕，整批漏測仍會假綠。這是可重現的驗收邏輯漏洞，不是本次產品拖曳失效的證據。

**三、ghost 逐角遮擋排除**

矩形來源是其他 `#drag-layer .drag-ghost`；透過跨 shadow host 的祖先檢查排除自身。相交角標為 `much_darker_pct=None`、附 `occluded by drag ghost`，不算有效樣本，也不算黑角。DPR 換算保留，原有 8%／12 門檻未放寬。

我以新 Chromium PNG 與 summary geometry 重算全部 30 個拖曳狀態，樣本數及黑角數均與 summary 相同，並檢查全部 **76 個遮擋角**：

- **76/76** 的角落方塊或背景環，確實有像素落在 ghost 矩形內。
- **70/76** 連實際測量區域「圓弧外＋背景環」都被矩形壓到。
- 另外 **6 個**僅碰到角落方塊中的卡體內部，均為兩個 viewport、三卡型起拖時來源卡的 TL。
- 被排除的 ghost 自身角：**0**。

所以這是較保守的排除，不是精確到「實際測量像素必受遮擋」才排除。那 6 個角存在少量過度排除，但符合報告明說的「角落方塊或背景環」規則；沒有排除 ghost 必測角，本次不列為獨立阻擋項。

以下為 flat 抽查，座標取新 summary，單位為 DPR 1 的像素；card index 從 0 起算：

| 畫面／被排除角 | 角落方塊含環的包圍範圍 | ghost 矩形 | 實際測量像素受壓數 |
|---|---|---|---:|
| desk mid，card 5 TR（警狗） | x202–229、y465–492 | x161.875–341.875、y407.620–659.620 | 407 |
| desk over-slot，card 6 BR（玥面探索者） | x392–419、y705–732 | x289.750–469.750、y630.240–882.240 | 407 |
| desk over-slot，card 7 BL（居家珍獸） | x414–441、y705–732 | 同上 | 407 |
| tablet over-slot，card 6 BR | x294–321、y561–588 | x177.250–320.250、y544.004–744.004 | 349 |
| tablet over-slot，card 7 BL | x316–343、y561–588 | 同上 | 112 |

另外只在記憶體中移除 geometry 的 occluders、重算同一批 flat PNG，確實重現報告所述三個紅角：

| 畫面／角 | much_darker_pct | darkest |
|---|---:|---:|
| desk mid，警狗 TR | 34.783% | 9.21 |
| desk over-slot，玥面探索者 BR | 47.826% | 9.21 |
| tablet over-slot，玥面探索者 BR | 57.143% | 9.21 |

三者都位於 ghost 矩形下，圖片亦支持由前景卡面遮住鄰卡角。**本次未發現用遮擋規則掩蓋未受遮擋黑角的證據；接受此修正的主要目的與結果。**

自檢 12/12 是原有案例，沒有新增 ghost 遮擋專屬案例，不能把 12/12 單獨當成新規則已驗證；本節的實圖與幾何核對才補上這部分證據。

**四、親自開圖觀察**

以下三張均為本次 `verify2/corners-chromium/` 新生成圖片，已用看圖工具開啟：

- `d1-drag-desk-flat-drag-mid.png`：滅世珍獸 ghost 完整浮於兩列卡片交界，來源卡變暗。ghost 四角未見突出的黑色 L 形塊；它明顯遮住警狗右上角及附近卡角。
- `d1-drag-desk-flat-drag-over-slot.png`：ghost 完整位於技能區前方，下緣約 y882.24，距 900px 視窗底約 17.76px，8px 背景環仍在視窗內。上半部覆蓋玥面探索者右下與居家珍獸左下附近，與排除紀錄一致。
- `d1-drag-tablet-flat-drag-over-slot.png`：ghost 下緣約 y744.00，距 768px 底部約 24px；四角完整。右側接近居家珍獸左下角，與該角部分受壓的幾何吻合。

三張 ghost 的插畫、名稱與邊框完整，未目視到異常黑角。這些靜態圖不額外證明精確的第一個 rAF 時序，也不代表使用者原先黑角回報已結案。

**五、Chrome／Edge：只讀現存 summary，未重跑**

| 現存證據 | DPR | 各 DPR 記錄／必測 | 各 DPR ghost 有效角 | 各 DPR 乾淨黑角 | 負控制 |
|---|---|---|---|---|---|
| `corners-chrome/summary.json` | 1、1.25、1.5、2 | 52／50 | 72／72 | 0 | 48、48、48、48 |
| `corners-edge/summary.json` | 1、1.25、1.5、2 | 52／50 | 72／72 | 0 | 48、48、48、76 |

Chrome 152.0.7977.84、Edge 151.0.4129.101，兩者記錄的 renderer 均為 RTX 3080 Ti D3D11。

八組均有 30 個拖曳、10 個 flat 狀態；missing、zero_valid_required、ghost_gap、ghost_skipped 均為 0；每組遮擋角 76。這些是**現存證據核讀結果，不是本轮 GPU 實跑**。

加上本次 Chromium，九組共確認 270 個拖曳狀態、90 個 flat 狀態、648/648 ghost 有效角。Chrome／Edge 不代替 Tauri 實機驗收。

REPORT 命令 7 與第五節主要數字吻合；第四節仍殘留「每 DPR 42 狀態」，應為 **52 記錄／50 必測**。此為報告殘留，不另列阻擋項。

**六、阻擋項處置與最終裁決**

| 項目 | 第二次裁決 |
|---|---|
| 上輪 flat 實際漏測 10 狀態／DPR | **實際覆蓋缺口解除**：新跑與現存八組均已補足 |
| 上輪 over-slot ghost 整張 SKIP、靠他卡充數 | **解除**：新跑 6 個 over-slot 均 ghost 4/4，無 ghost SKIP |
| 固定矩陣完整性 | **未完全修復，維持阻擋**：全部拖曳未執行仍可取消必測而假綠 |
| 逐角 ghost 遮擋排除 | 接受；76/76 有矩形相交，6 個保守過度排除已明列 |
| 新產品黑角故障 | 本次未檢出 |
| 使用者黑角回報／Tauri | 保持未結案／未實機驗收 |

結束時 `git diff --name-only` 無 tracked 變更，`git diff --check` 無診斷；`git status --short` 僅新增 `verify2/`。

**最終 EXIT 1：原因是驗收器仍容許整批拖曳漏測通過，不是本次 Chromium suite 失敗。** 要解除此阻擋，已落地功能的 30 個拖曳狀態必須不受 `drag_done` 是否為空影響；全部未執行應明確失敗。本輪依指示未修改程式碼。