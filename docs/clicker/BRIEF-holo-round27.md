# 派工簡報（第二十七輪）：抽卡頁的卡跟卡池頁對齊，並把 TODO-next-round 的 A1–A5 收完

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree，**不要**碰 `D:\claude\clawd-pet`）。
這一輪你是**實作者**：改程式、重建產物、跑驗收、commit。我（Claude）之後會用 Playwright 複驗。

## 〇、動手前必讀（不讀就會重演 09-09 的返工）

1. `docs/clicker/LESSONS-2026-09-09.md` 全文——尤其第一節（`preserve-3d` 裡是 `translateZ` 決定前後）、第三節（量測的三個陷阱）、第六節（已否決路線）。
2. `docs/clicker/HANDOFF-holo-cards.md` 六之四（Z 只能小幅推）、六之五（卡片製作工法，**凍結**）。
3. `docs/clicker/TODO-next-round.md`——A1～A5 的權威清單，含「當前源碼狀態 vs 下一輪處理」表。

**凍結的東西這輪一律不改**：三型幾何百分比、Z 分層（背景 2 → 圖層 6 → 卡框 8 → 文字框 13 → 文字 40 → 寶石 42px）、字級公式（綁卡寬、290px 基準、名字縮字 55% 下限、稀有度同比縮）、卡型資料驅動（`pool_data.py`）、flat 不做圖內視差、不透明銘牌黑條是否決路線。

## 一、使用者的核心抱怨（昨天一整天沒解掉）

> 抽卡系統的卡片永遠沒辦法與 `cards-remade-standalone.html` 裡展示的一樣。

### 我今天量到的根因（Playwright 量 computed style，不是目測）

同一張卡「膠頭爛額」（`kind-framed`），抽卡頁攤開的扇形卡寬 **102px**，卡池頁 **262px**。
**幾何全部一致**（`.face-art`／`.art-media`／`.face-plate`／`.face-text` 佔卡片的 %、名字 8.27% vs 8.29%、稀有度 4.66%、寶石寬 7.58% vs 7.59%、plate padding 12.9%）——DOM 與 `card_face.js` 是同一份，這部分沒問題。

**不一致的是 7 個寫死 px 的外皮屬性**，卡越小佔比越大，所以 102px 的卡看起來像另一套皮（粗圓角金屬框＋角落大色條＋大寶石）：

| 元素 | 屬性 | 值 | 102px 卡佔比 | 262px 卡佔比 |
|---|---|---|---|---|
| `.face-frame` | `border-radius` | 12px | **11.76%** | 4.59% |
| `.face-frame` | `border-width` | 1px | 0.98% | 0.38% |
| `.face-frame::after`（角落記號） | `top`／`left` | 10px | **9.80%** | 3.82% |
| `.frame-material` | `border-radius` | 12px | 11.76% | 4.59% |
| `.frame-material` | `mask-size` | 100px | **98%** | 38% |
| `.frame-material` | `background-size` | 300px | **294%** | 115% |
| `.face-plate` | `border-radius`／`border-width` | 5px／1px | 4.9%／0.98% | 1.91%／0.38% |
| `.face-gem` | `border-radius`／`font-size` | 3px／14px | 2.94%／**13.7%** | 1.15%／5.35% |

（量測腳本的邏輯：對兩頁同名卡取 `getComputedStyle`，除以 `getBoundingClientRect().width`。）

### 要做的（任務 0，優先於 A1～A5）

- 把上表這些 px 全部改成**綁卡寬**。`card_face.js` 已經在 `observe/refit` 裡算 `--gem-fs`（第 154 行附近），比照它再設一個 `--cw`（卡片未變形寬度，px），CSS 端用 `calc(var(--cw) * 0.0459)` 這種寫法；或直接用 container query 單位（`cqw`）——二選一，但**只能有一套**，不要有的用 `--cw` 有的用 `cqw`。
- 基準以 **262px 卡池卡的現況為準**（也就是右邊那張的比例：框圓角 4.59%、角落記號 inset 3.82%、mask-size 38.2%、background-size 114.7%、plate 圓角 1.91%、寶石圓角 1.15%、寶石內圖 5.35%），不是改卡池頁去遷就抽卡頁。線寬（1px）可以設下限 `max(1px, calc(var(--cw)*0.0038))`，其他不設 px 下限（LESSONS 第七節：小卡不要固定 px 下限）。
- 這些規則住在 `demo.html` 的共用 `<style>` 區（兩支建置腳本都從那裡擷取），**不要**在 `build_deluxe_b.py` 或 `build_cards_remade.py` 各自打補丁——LESSONS 第二節。
- 改完要在**三頁**（demo／cards-remade／deluxe-gacha-b）同卡、同未變形寬 80／102／150／230／290px 比對這 7 項的佔比，誤差 < 0.3 個百分點。把比對寫進 `check_gacha_card_regression.py`（新增斷言，不是臨時腳本）。
- 傳說／神話的四角記號（`round26-frame-crown-fix` 那段）與皇冠殘留一併檢查是否也是 px；是就一起換。

### 不要做的

- 不要為了「看起來一樣」去動人物裁切、subject 配準、Z、字級公式。
- 不要把扇形卡放大來掩蓋問題。
- 不要另外開一支「抽卡頁專用 CSS」。

## 二、接著把 `TODO-next-round.md` 的 A1～A5 做完

順序照那份：A1 → A2 → A3 → A4 → A5。每一項的「當前源碼狀態」表已校正過，**先驗現況再改**，不要把舊 REPORT 的失敗當成現在還在，也不要看到新碼就當通過。

補充幾點那份沒寫、今天確認的：

- **任務 C（傳說卡左上黃色方塊）已在 `a6d188b` 修掉**（round26 override，量測警狗 1250 → 64、滅世珍獸 0、快樂海豹 0）。TODO 第 3 節是 03:12 寫的，比修好的 commit 晚但沒同步。請把 TODO 第 3 節改成「已修（a6d188b），保留量測方法」，不要再當待辦。
- A5（十連快轉競態）：先寫**會失敗**的固定時序測試，再修；修法照 TODO 的最小方向（cascade 在 finally 無條件重算 UI、分清「已開始揭曉」與「已完成可收下」）。動畫節拍不能減量。
- A3 接 demo 時，65 張歷史樣本是**研究基準不是正式卡池**，不能抹掉。

## 三、建置與驗收（每一項都要真的跑，回報真實 exit code）

```bash
cd D:\claude\clawd-pet-holo\_art\holo-test
python build_round5_standalone.py
python build_cards_remade.py && python build_cards_remade_standalone.py
python build_deluxe_b.py    && python build_deluxe_b_standalone.py

PYTHONIOENCODING=utf-8 python check_demo_round8.py
PYTHONIOENCODING=utf-8 python check_demo_round9.py
PYTHONIOENCODING=utf-8 python check_gacha_card_regression.py
PYTHONIOENCODING=utf-8 python check_gacha_followup.py     # 目前是診斷輸出，關鍵條件要補成 assertion
```

- 單檔版一定要**複製到別的資料夾再開**才算驗過（LESSONS 第五節）。
- `check_gacha_followup.py` 的「腳本正常退出」≠「條件通過」，報告要分開寫。
- 修完後的三張單檔版產物要一起 commit（它們是被追蹤的）。

## 四、交付格式

1. 每完成一個任務（0、A1…A5）就一個 commit，訊息寫**實際做了什麼與實際量到的數字**；commit 訊息裡出現的 exit code 必須是你看到的（LESSONS 六之二）。
2. 最後寫 `docs/clicker/REPORT-holo-round27.md`：每個任務的「改了哪些檔／量到什麼／哪個驗收腳本 exit 多少／還沒過的」。不要寫「全綠」除非每一支都是 exit 0 而且你看過輸出。
3. `HANDOFF-holo-cards.md` 第七節「下一步」與 `TODO-next-round.md` 同步到做完後的狀態。
4. 不要 push；我複驗完再 push。
