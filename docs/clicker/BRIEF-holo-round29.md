# 派工簡報（第二十九輪）：配得上新卡面的抽卡演出——進入抽卡畫面、大卡、拆包、材質回饋、去 AI 感

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree；**不要**碰 `D:\claude\clawd-pet`，**不要**動 `src/`）。
你是**實作者**。規格書是 [`DESIGN-holo-round29.md`](DESIGN-holo-round29.md)（GPT-6 設計，已由使用者以預設值通過）。本簡報只補充裁決、範圍邊界與交付；**規格以設計文件為準，衝突時以本簡報第一節為準**。

## 〇、必讀（順序不能反）

1. `docs/clicker/LESSONS-2026-09-09.md`（含第三節第 4 條：互動驗收要驗像素）
2. `docs/clicker/HANDOFF-holo-cards.md` 六之四／六之五——卡面凍結，`card_face.js` 幾何、Z、字級**本輪不動**
3. `docs/clicker/REPORT-holo-round28.md`（含 28b 節）——現況、A5 狀態名稱、互動契約、既有測試
4. `docs/clicker/DESIGN-holo-round29.md` 全文
5. `docs/clicker/RESEARCH-gacha-ui-resources.md` 第二節（箔面套 UI 的允許／禁止）

## 一、使用者裁決與方向（覆蓋一切）

使用者的原始參考是一則 FB 影片的提示詞概念：**「給我最屌的效果、不要有 AI 味、動畫看起來很爽但別無腦一昧添加、像戰地風雲擊殺回饋那種概念、參考現成風格但別被限制住、別偷懶全照抄」**。他明說：舊的招募畫面也是 AI 做的但沒有 AI 味，就是因為照了這個概念；**現在要用同一個概念＋新學到的技術（箔面卡、鋁箔卡包、材質）做一套更符合新卡面的抽卡方式**。

因此：
1. **不是搬回舊系統**。`src/gacha-mode-*.js`、`gacha-fx.js`、舊 UI kit **一律不引用、不移植**。設計文件第四節從舊程式抽的是節奏原理，不是程式碼。
2. **保留卡包**（`fx/foil-pack.webp` 滿版印刷版）。不重做、不換風格。
3. **卡要大**：照設計第二節（1440×900 五抽每張 380×532px、扇形 X `[-420,-210,0,210,420]·s`、旋角 `±12/±6/0°`；單抽與揭曉焦點 420×588；十抽兩組五張）。
4. **按抽卡進入專屬抽卡畫面**：`setScreen('entry'|'ceremony'|'results')`；入口只留一包卡包＋三個抽卡鍵＋小字券數；刪除設計第一節列出的所有展廳元件（`.bar/.rail/.body/.chip/.rate/.foot/.orbit/.charge/.core/.starfield/.rays/.idlepack` 與相關文案）。
5. **背景**＝幾何＋光暈＋箔底材＋循環動畫，照設計第三節六層；箔底材貼圖 `fx/summon-substrate.webp` **由 Claude 產**（本輪已在做）；沒到位前用 CSS 漸層頂著，不能卡住。
6. **揭曉照設計第四節**：共用拆包時間軸、單卡鏈（`beginReveal/commitFaceVisible/runRarityFx/settleReveal`，掛在既有 `revealOne()` 的同一 Promise 上）、五階回饋表。**每一個特效元素都要對得上表裡那句「告訴玩家什麼」**，表裡沒有的不准加。
7. **不預告品質**：`face-visible` 之前所有階級逐像素零差（沿用 28 輪的 78 幀斷言，改到新時間軸上）。
8. **互動契約不變**：揭曉後鎖角度、光位跟游標、拖轉保留、hover 1.04、Esc 回正、點空白全跳過、`user-select:none`＋像素斷言。
9. **去 AI 感照設計第五節的 before／after 逐項做**；箔面只出現在設計允許的位置。
10. **本輪純 CSS／WAAPI**，three.js 一行都不加（30 輪才評估神話折射）。

## 二、不要做的

- 不動 `card_face.js`、`pool_data.py`、`RATE`、抽取結果。
- 不做召喚陣、流星、印章、神話影片、三道常駐圓環。
- 不把 `.reveal-rays` 複製幾份當「更強」；不以粒子數量當成功標準。
- 不動 `src/`。
- 不改 28 輪的 A5 狀態契約名稱；跳過語意不變。

## 三、素材

| 檔 | 規格 | 誰 |
|---|---|---|
| `fx/summon-substrate.webp` | 1536×1024 RGB，箔底材無印刷，≤110KB | Claude（`fx/build_foil_stage.py`） |
| `fx/foil-pack.webp`、`fx/foil-tear.webp` | 既有 | 已有 |
| 幾何形狀（斜切面、開口框） | 手寫 SVG／CSS clip-path，奶油色 | 你 |
| 五階特效的環／箔片 | CSS／SVG，設計第四節 | 你 |
| 音效 | WebAudio 合成，設計第四節聲音欄 | 你 |

## 四、驗收（照設計第六節；新增 `check_gacha_ceremony_round29.py`，舊測試更新不刪）

至少：
1. 三個畫面狀態切換與刪除清單：`.rail/.bar/.orbit/...` 在 DOM 中不存在。
2. 卡片尺寸斷言：1440×900 五抽每張未變形 content width 380±2px、扇形位移與旋角；1024×640 與 390×844 依表。
3. 不預告：`face-visible` 前三個階級逐像素零差。
4. 五階回饋：每階級在 `F` 之後才出現對應 class／節點；時序在表值 ±40ms；`F` 之前不得有任何階級色節點。
5. 連續性：兩張連續揭曉之間無空檔超過 100ms（普通／精良允許回槽末 100ms 重疊）。
6. 背景：閒置 5s／30s 期間 rAF 計數 0；隱藏分頁時動畫暫停；灰階截圖卡外背景 P95 < 焦點卡 P95 的 65%（主波峰值 85%）。
7. 互動：像素級拖曳斷言（28b）、hover 1.04、字級不變、Esc 回正。
8. A5 固定觸發點各 20 次（含拆包中、翻面中）。
9. dev 與搬走的 standalone 都驗；standalone 大小 ≤ 設計給的預算（寫進報告）。
10. 每支測試回報真實 exit code；「腳本正常退出」≠「條件通過」。

## 五、交付

1. 每個大項（畫面流程與刪除／大卡排版／背景／拆包時間軸／五階回饋／去 AI 感／測試）一個 commit 邊界；commit 若被 sandbox 擋住，在報告列出邊界。
2. `docs/clicker/REPORT-holo-round29.md`：改了哪些檔、每條驗收 exit、實際時序、standalone 大小、還沒過的。
3. `HANDOFF-holo-cards.md` 第七節與 `TODO-next-round.md` 同步。
4. 不 push。
