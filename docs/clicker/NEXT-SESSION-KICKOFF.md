# 珍母點點：新 session 開工提示（2026-09-09，公司電腦）

貼給新視窗的第一句：

> 幫我讀 D:\claude\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十四節，照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先收我實玩的回饋；明天主題是「平衡與難度」。

## 先 `git fetch && git pull --ff-only`；`npm test` 應為 154 例。main 最新是「五連改回 135 秒」那個 commit；gh-pages 同步；exe 是第二十輪（五連 80 秒版，下次 build 會更新）。

## 第十九、二十輪上線後要收的回饋

- 招募：五連 80 秒實玩覺得**太快**，使用者已改回 135 秒（招募價只吃一半全隊訓練倍率保留）。

## 明天主題：平衡與難度

使用者指定。開工先跑 `node tools/sim/clicker-curve.js`（預設 4 點／20 分／14 天）與 `4 20 30`，把各場景王前耗時、包速、每日五連數、回本秒數列成表，再跟使用者對「哪一段太快／太慢／王太好打」。可動的旋鈕都在 `docs/clicker/DESIGN-balance-v2.md` 與 HANDOFF 第五節；改任何常數先跑模擬器，模擬器缺「輪迴」與「印記祝福」策略，若要調印記相關要先補這兩段。
- 被動收益浮字每秒一個（`floatPassive`）——掛機會不會太吵？太吵改每 3 秒或只在金額變大時出現。
- 印記祝福第 n 級價 n 印記——模擬器沒有輪迴策略，這個定價完全沒驗證，看實玩剩餘印記。
- 按鈕改 CSS 畫後 exe 實機（dpr 1.25／1.5）四角是否乾淨。
- 寄生標籤新位置（珍母左肩上方）看得清楚嗎。

## 其他待辦（照優先順序）
- 徽章 17 張無字底圖、屋頂星空專屬素材（換圖要拆 hue-rotate）、冷凍包五狀態圖（Codex imagegen，一次一個 job）。
- 派工簡報開頭列「不要動的旗標」（見 HANDOFF 第十二節）。
