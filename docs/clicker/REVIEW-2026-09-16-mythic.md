# 審查任務（只讀、只回報，不要改任何檔案）

請審查以下兩個改動，回報你找到的問題；沒有問題就明說「沒有發現問題」。回覆用繁體中文，直接列點。

## 改動 1：`src/clicker.css` 第 836～837 行
`.mythic-ripple { width:150px; height:150px; … }` 改成 `.mythic-fx.mythic-ripple { … }`。
背景：`gacha-card` 的神話卡翻開時也會掛 `.mythic-ripple`（見 `src/gacha-mode-runtime.js:111`、`src/gacha-mode-stage.js:222`、`src/gacha-card.css:401`），
clicker.css 載入順序在後，1.0 抽卡的神話卡因此被壓成 150×150。技能漣漪的節點在 `src/clicker-stage.js:688` 建立、className 是 `'mythic-fx mythic-ripple'`。

請確認：
1. 限定後技能漣漪（玥來玥閒「躺著也會贏」）的樣式與動畫是否仍完整套用？看 `src/clicker-stage.js` 第 670～720 行的動畫怎麼驅動這個節點（Web Animations 還是 CSS class）。
2. `src/clicker.css` 其他 `.mythic-*` 類（`.mythic-flash`、`.mythic-bloom` 等）是否也和 `src/gacha-card.css`／`src/apoc/ceremony.css` 撞名？`grep -n "\.mythic-" src/*.css src/apoc/*.css` 逐一比對，列出還會互相覆蓋的。
3. 2.0 末世抽卡（`src/apoc/ceremony.html`＋`ceremony.css`）是不是也載入 `clicker.css`？如果是，`.mythic-ripple` 在那邊也被壓過嗎？

## 改動 2：新測試 `tools/test/clicker-v3-mythic-height.py`
用 `Math.random` 釘成序列讓一包同時有神話與非神話。請看 `src/gacha-pool.js` 的 `rollRarity`／`rollPack`：序列 `[.052,.4,.052,.4,.4,.4]` 是否在所有分支（軟保底 `legendaryBonus`、硬保底 `minRarity`、`packMinRarity` 補抽）下都還保證抽到至少一張神話與一張非神話？找得到讓測試偶發翻紅的路徑就指出來。
