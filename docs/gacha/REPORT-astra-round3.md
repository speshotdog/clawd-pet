已完成三個模式與入口接線，保留共用 R 的重量、禁止搶先發光，以及既有卡背 hover 預告。

修改檔案：

- 新增 [召喚陣](src/gacha-mode-summon.js)、[拉幕登場](src/gacha-mode-stage.js)、[撕包](src/gacha-mode-rip.js)。
- 修改 [gacha.html](src/gacha.html)、[gacha.js](src/gacha.js)：選項、入口與事件分流。
- 修改 [gacha-card.js](src/gacha-card.js)：提供 `art.cfg(id)`。
- 修改 [runtime](src/gacha-mode-runtime.js)：各卡起點、翻面同步鉤子、延後總覽、自動選項讀取。

| 模式 | 入口與時間軸 |
|---|---|
| 召喚陣 | 「蓋下腳印」→ 160ms 印章 → 440ms 描線 → 400ms 暖白卡位 → 320ms 共鳴 → 880ms 立卡成扇 → 180ms 淡出 → 共用 R |
| 拉幕登場 | 「拉開布幕」→ 600ms 開場 → 每位約 520ms 剪影進場；傳說追加 1080ms 蓄力 → 露臉、變色、揭曉音 → 回應並停留 600–1200ms → 320ms 收進扇形。逐張時等待下一位 |
| 撕包 | 中央封口左拖右，進度為指標行程八成；未達 70% 回彈 → 420ms 開包 → 點頂卡滑出並走完整 R → 第五張中央放大 → 480ms 排成扇形 |

與第一輪不同：召喚陣全部暖白、取消陣上的傳說預告；舞台延長進場與停留，加入本輪指定的完整傳說蓄力；撕包是新增模式。三者目前均支援五張。

六個 JS 檔的 `node --check` 全通過，`git diff --check` 通過。未 build、未起 server、未 commit，未新增圖片。

尚未實機驗證：舞台遮擋與角色切件接縫、撕包阻力手感，以及音畫同步。