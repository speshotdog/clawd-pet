# 珍母點點：新 session 開工提示（2026-09-08）

貼給新視窗的第一句：

> 幫我讀 D:\claude研究\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十二節，照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先做第十九輪。

## 先 `git fetch && git pull --ff-only`；`npm test` 應為 142 例。

## 第十九輪要解的兩件事

### A. 招募回本太慢（使用者：角色多了、等級升了之後卡片變難抽、回本時間太長）

根因（`clicker-economy.js:11-12`）：招募價釘在 **30 秒的 P**，而 P 含所有夥伴的個別訓練倍率 `partnerMul`（線性 +1 倍／級、里程碑 ×2）與裝飾、印記；玩家越練，抽一次越貴。但抽到的新卡是 **0 級**，貢獻只有 `base × 星倍率`，相對已練到 100 級的隊伍是幾百分之一，所以「回本」要等到把牠也練上來。25 隻角色後每張新卡都是這個處境。

建議（兩條一起做）：
1. **招募價改釘「未訓練的 P」**：`drawCost` 用 `rates(s, {ignoreTraining:true}).P`（把 `partnerMul`、`decoMul`、`markMul` 從這個 P 拿掉，只留 base × 星 × 階級 × 全隊訓練 × 親和）。價格只隨「你有幾隻、幾星」成長，不隨個別訓練成長。單抽仍是 30 秒、五連 135 秒，但秒數換算的是這個「素 P」。
2. **新夥伴自動追上隊伍**：招募到新角色時，`partnerLevels[id]` 直接設為 **全隊個別訓練等級的中位數**（免費，不扣幣；里程碑倍率照算）。重複卡不觸發。這樣新卡一到隊就有意義，也不用把「平均訓練」按到手軟。
3. 附帶：`tools/sim/clicker-curve.js` 加一段輸出「第 N 抽的回本秒數」（新卡每秒貢獻 ÷ 抽價），改前改後各跑一次放進報告；目標：任何階段單抽回本 ≤ 10 分鐘、五連 ≤ 30 分鐘。

### B. UI 邊框還是不整齊（使用者截圖：按鈕角落仍有缺口）

第十八輪把縮放比取 0.25 倍數後，網頁版四種解析度乾淨，但使用者實機（很可能是 exe，Tauri `fit_window` 走 Windows 顯示縮放 dpr，仍是任意小數）還是缺角。**治本：不再用 9-slice 貼圖畫按鈕與紙框，改用 CSS 畫**，任何縮放都乾淨：
- 按鈕：`background` 用貼圖中心色（奶油 #FDF1D6、綠 #9BAF6B、粉 #EF8E8E、紫 #B8A2CF，從 `clicker-ui-btn-*.png` 取樣）、`border:3px solid #30251F`、`border-radius:12px`、`box-shadow:0 4px 0 #30251F`（硬陰影）、內側虛線用 `outline:2px dashed #FFF6E6aa; outline-offset:-6px`；hover 上浮、active 下壓沿用。
- 紙框（`.upgrade`／`.recruit`／`#team`／面板）：同樣改成 `border` + `border-radius` + 內虛線 + 牛皮紙紋 `background-image`（現有 `clicker-ui-kraft.png` 平鋪即可）。
- 標題帶、票券、錢包牌先不動（它們是圓端造型，CSS 畫會走樣）；缺角主要出在按鈕。
- 驗收：`_art/shot.py` 四種解析度 + exe 實機截圖（dpr 1.25／1.5）放大四角。

## 其他待辦（照優先順序）
- 收使用者回饋：轉彩 30%、神話 0.5%、零食小偷節奏、平均訓練手感。
- 徽章 17 張無字底圖、屋頂星空專屬素材（換圖要拆 hue-rotate）、冷凍包五狀態圖（Codex imagegen，一次一個 job）。
- 留聲機問題已由使用者確認可以買了（09-08），不用再追。
