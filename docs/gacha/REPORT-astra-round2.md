已完成，保留既有 A＋F 卡面與拖包手感。

- **修改**：`gacha.js`、`gacha.html`、`gacha.css`、`gacha-audio.js`、`gacha-fx.js`
- **新增**：`gacha-card.js`、`gacha-mode-runtime.js`、`gacha-mode-hearthstone.js`、`gacha-mode-wish.js`

入口與時間軸：
- **拆包桌面**：拖包就位後點擊抽取；1320ms 可翻牌。五張全精良、全部翻開為 **5020ms**，符合文件。
- **流星投遞**：中央按鈕抽取，預設自動、可選逐張；2040ms 開始揭曉，五張全精良為 **5740ms**，符合文件。
- 減少動態時以淡入替代高速移動，保留節拍。略過立即顯示同批總覽，不自動收下。

七個 JS 檔均通過 `node --check`；虛擬時鐘與存檔邏輯檢查通過。未執行 build、server 或 commit。

**尚待實機確認**：WebView 的動畫銜接、縮放後粒子對位、hide／重開流程，以及實際音量與迴響聽感；HTML／CSS 無法用 `node --check` 驗證。