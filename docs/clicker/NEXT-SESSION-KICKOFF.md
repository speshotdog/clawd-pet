# 珍母點點：新 session 開工提示（2026-09-09，公司電腦）

貼給新視窗的第一句：

> 幫我讀 D:\claude\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十四節，照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先收我實玩的回饋。

## 先 `git fetch && git pull --ff-only`；`npm test` 應為 154 例。main 最新 `37ccca3`，gh-pages 與 exe 都已是第二十輪。

## 第十九、二十輪上線後要收的回饋

- 招募：五連 80 秒、招募價只吃一半全隊訓練倍率——實玩回本手感？還慢就看 `DRAW_SECONDS.single`（30）與 `trainingLevel / 2` 那個除數。
- 被動收益浮字每秒一個（`floatPassive`）——掛機會不會太吵？太吵改每 3 秒或只在金額變大時出現。
- 印記祝福第 n 級價 n 印記——模擬器沒有輪迴策略，這個定價完全沒驗證，看實玩剩餘印記。
- 按鈕改 CSS 畫後 exe 實機（dpr 1.25／1.5）四角是否乾淨。
- 寄生標籤新位置（珍母左肩上方）看得清楚嗎。

## 其他待辦（照優先順序）
- 徽章 17 張無字底圖、屋頂星空專屬素材（換圖要拆 hue-rotate）、冷凍包五狀態圖（Codex imagegen，一次一個 job）。
- 派工簡報開頭列「不要動的旗標」（見 HANDOFF 第十二節）。
