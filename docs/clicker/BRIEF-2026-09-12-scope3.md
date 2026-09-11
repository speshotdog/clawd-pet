# 派工簡報：三面卡面一致（2026-09-12，holo-5.0）

給 Astra（gpt-6-astra）。工作區 `D:\claude\clawd-pet-50`（worktree，分支 `holo-5.0`）。
前情**必讀**：`docs/clicker/HANDOFF-2026-09-11.md`（尤其第三、五、八節）。

---

## 〇、使用者本輪裁決（覆蓋前面所有驗收範圍設定）

> 「我要的只有 抽出來的卡 跟卡冊的卡 還有隊伍編制的卡 看起來都是一樣的就好。
>  是末世地圖的卡冊介面還沒設計，之後處理。」

**驗收範圍縮成三個面**，基準是抽卡揭到的那張：

| 面 | 入口（`check_card_parity.py` 的 ENTRIES 名） |
|---|---|
| 抽出來的卡（**基準**） | `gacha`、`gacha-standalone`、`gacha-test`、`gacha-test-standalone` |
| 卡冊的卡 | `pool`、`pool-standalone` |
| 隊伍編制的卡 | `team` |

**退出驗收範圍**：`demo`、`demo-standalone`（實驗頁）。
`HANDOFF-2026-09-11.md` 第四節那條「demo 兩版各剩 `.card-back` 一項」**不再是待辦**。

**本輪不做**：末世地圖的卡冊介面（還沒設計，使用者之後處理）。
不要因為「順手」去動 `map20.html` 的版面／導覽／關卡區，只准動卡面本身相關的東西。

---

## 一、要做完的四件事

### 1. 先讓量測工具自己站得住：`check_shot_determinism.py` 要過（門檻 mean < 1.0）

現況（`HANDOFF-2026-09-11.md` 第五節第 1 點）：同一入口、同一支腳本連跑三次，
像素在**兩種狀態之間二元跳動**（`demo` run0-run2 mean 29.69；`pool-standalone` run0-run1 mean 33.59）。
**已排除箔面相位**（`diag_foil_phase.py` 三時點零漂移，不要再查這條）。

下一步建議：查**圖片 decode 時序**——`img.decode()` 的例外目前被 `catch` 吞掉，
以及 lazy 解碼。採集端要把 `decode`／`refit` 的失敗結果留下來，不准吞。

⚠ 在這支過之前，**入口之間的像素比對不是有效訊號**，不准拿像素差當通過或不通過的證據。
這一條沒過，後面第 3 件事就不能宣稱完成。

### 2. 判定器與採集端補洞（限縮到三面）

沿用你在 `VERDICT-2026-09-11-parity-v5.md` 留的兩包，但**只針對上表七個入口**：

- 判定器（`check_card_parity_report.py`）：再補型別／空值／文字字型／批次與幾何的漏洞
- 採集端（`check_card_parity.py`）：留下 `refit`／`decode` 的失敗結果
- 比較內容擴充：保留卡內設計變形、覆蓋不同卡型與實例、比較**完整漸層與 mask 內容與偽元素**
- 量測與截圖要綁**同一份產物**
- `check_card_parity_sabotage.py` 的反例要跟著新判準擴充，新的判定漏洞每補一個就補一個反例

### 3. 三面一致，拿得出證據

- `check_card_assets.py`：七個入口 × 三尺寸（1440x1200／1024x900／390x844），元件層差異 0 項
- 同尺寸中性姿態下，列入比較的屬性與幾何差異 0 項
- 稀有度非預期 fallback 0
- 第 1 件事過了之後，補上**受控截圖的像素比對**（`shoot_card_parity_samesize.py`），並把門檻寫清楚

### 4. standalone 的卡圖是縮圖 —— 只量代價，**不要自己決定**

| 入口 | 卡圖內在尺寸 | 建置參數 |
|---|---|---|
| `gacha`／`pool`（一般版）、`team` | 600×840 | — |
| `pool-standalone` | 420×588 | `build_cards_remade_standalone.py:23` `box=(420,588)`, quality 84 |
| `gacha-standalone`／`gacha-test-standalone` | 360×504 | `build_deluxe_b_standalone.py:23`, quality 82 |

卡片顯示 260px、DPR 2 ＝ 520 裝置像素，**離線版的卡是被放大的、會比較糊**，
這直接違反「看起來都一樣」。但拉到 600×840 會讓單檔變大。

**你要做的是量出代價然後回報**：把 `pool-standalone` 與 `gacha*-standalone` 分別在
（a）現況、（b）520×728、（c）600×840 三個設定下建出來，列出**每個產物的實際 bytes**
與並排的視覺對照圖。**不要直接改產品設定**，等使用者裁決。

---

## 二、鐵則

1. **不准為了讓新東西過而放寬任何既有門檻。** 驗證腳本的每一條斷言都對應一次
   「規格照做但視覺失敗」的事故。門檻要動，寫進報告等裁決，不要自己動。
2. **上限型門檻要配下限**：只寫上限會做出「看不見的東西」也過關。
3. **你的驗收全綠不算數**，要附截圖／數值。拖曳互動的截圖注意 `user-select` 沒關會把 `<img>` 塗藍。
4. **不要 commit**（git index 在 worktree 外，sandbox 會擋）。改完停下來，我複驗後提交。
5. 做不到的就寫「未達成、未宣稱」，不要把沒驗的東西寫成驗過。上一輪你判 EXIT 1 是對的。
6. 建置順序（在 `_art/holo-test`，逐條非零即停）：
   ```
   python update_demo_data.py
   python build_round4_fonts.py
   python build_round5_standalone.py
   python build_cards_remade.py
   python build_cards_remade_standalone.py
   python build_deluxe_b.py
   python build_deluxe_b_standalone.py
   python build_deluxe_b.py --test
   python build_deluxe_b_standalone.py --test
   python build_map20.py
   ```
7. 驗收指令：
   ```
   python check_card_parity.py --label X --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team
   python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-X.json --reference gacha-test
   python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-X.json
   python check_card_assets.py
   python check_shot_determinism.py
   ```

## 三、交付

寫 `docs/clicker/REPORT-2026-09-12-scope3.md`，分成
「做到什麼（附數值與截圖路徑）」「**未達成、未宣稱**」「要使用者裁決的（含第 4 件事的體積表）」三節。
