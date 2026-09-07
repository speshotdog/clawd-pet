# 第十五輪實作報告

日期：2026-09-07；範圍：`BRIEF-astra-impl-round15.md` 第 0～5 章。

## 逐章交付

- **0 素材接線**：`gacha-pool.js`、`gacha-card.js`、`clicker-stage.js`、`clicker-cutin.js`、`clicker-extras.js`、`clicker.css` 接入九張既有 PNG，卡面置中 contain 並留 8% 邊，卡冊／推薦／技能槽／夥伴圓鈕／分享圖共用圖片分支，`yuelegend` 借用 `yueyue` 的 SVG 與 rig。
- **1 神話規則**：`gacha-pool.js`、`clicker-economy.js`、`clicker-save.js`、`clicker-album.js`、`clicker.js` 加入神話名稱、0.5% 權重、傳說以上重置保底、第四階係數與超越、升階封頂、兌換與溢出，卡冊自然擴成六頁三跨頁。
- **2 新角色與技能**：`clicker-balance.js` 加十名角色的指定數值與既有技能 kind、神話超越技能每級 +7%、四條羈絆與末尾新增「神話流」，並以 `originalIds` 固定百包選角的原始十二名角色。
- **3 全彩卡面**：`gacha-card.css` 與 `gacha-card.js` 為預設／skin-af 卡皮加入六秒彩虹框、整面 .35 鍍膜、淡彩虹名牌與畫窗、彩虹寶石、桃紅青色雙光暈、.8 秒呼吸與卡背漏光，`clicker.css` 補彩虹星列並保留 reduced-motion 靜態配色。
- **4 五種抽卡演出**：`gacha-mode-runtime.js`、`gacha-fx.js`、`gacha-audio.js` 與五個 `gacha-mode-*.js` 加深壓暗、120ms 白閃、彩虹射線／32 粒子／漣漪／雙震、神話和弦低音、彩虹流星尾與半徑 36、舞台掃色紙片、召喚陣色層腳印及拆包撕包彩虹漏光，`gacha.js` 補神話粉塵 1000。
- **5 其餘接線**：PNG 切入沿原有進出場滑入再浮動 6px／1.2s，`T`／`EASE` 未改，免費單抽／五連沿用共用抽卡與保底，並更新 `DESIGN-balance-v2.md` 的神話規則。
- **羈絆連動修正**：`clicker-economy.js` 改以最大羈絆連鎖窗決定時長，`clicker-save.js` 接受兩組次數／持續羈絆疊加的合法技能快照，卡冊與名冊列出角色的全部羈絆。
- **模擬器**：已讀 `tools/sim/clicker-curve.js`，角色列舉與收益／抽卡均取共用模組，沒有需補的角色數量或稀有度硬編碼，因此未修改亦未執行模擬。

## 規格解讀與差異

- 神話無專属保底的解讀為軟／硬保底皆保留神話 0.5%，第 40 抽為傳說 99.5%／神話 0.5%，不把神話機率按傳說一起提高。
- 神話兌換依明文「傳說兩倍」採每顆 6 萬用粉塵，滿養溢出每張折 2 萬用粉塵，未指定的神話超越成本沿用傳說 `4/5/6/7/10`。
- 舊存檔載入補新角色 `dust`／`promotions`／`transcend`／`partnerLevels` 為零，`collection` 保留既有稀疏格式（未列出即零），避免未擁有角色被計入夥伴數。
- 共用翻牌揭曉停留增加 400ms（雙震間隔 120ms＋等待 1180ms，傳說原為 900ms），stage 依章節指定採 hold 1600ms（既有傳說 1250ms），未改傳說原值。
- Wish 保留既有非神話抽卡不預告的行為，遇到神話才啟用本次最高神話文案與彩虹流星預告。
- 舊測試內代表「原始十二隻／原始三羈絆」的 fixture 改用 `B.originalIds`、目錄數量改為 22／27，保留所有既有測試例並另測完整新池。

## 驗證與限制

- `npm test` 在 PowerShell 被 `npm.ps1` 執行政策擋下，改用同一 npm 的 `npm.cmd test` 執行原 test script，最終 exit code 0：**122 tests、122 pass、0 fail、0 skipped**（原有 111＋round15 新增 11）。
- `tools/test/clicker-round15.test.js` 覆蓋精確分層抽樣機率、軟硬保底／包保底、神話出身與超越／升階上限／粉塵帳、22 角合法快照、舊存檔補欄、付費與免費抽卡、百包選角限制，以及以 DOM stub 實際呼叫 PNG／借圖 SVG 的建立路徑。
- 修改過的 JavaScript 與新增測試均通過 `node --check`，`git diff --check` 無空白錯誤，`src/*.js` 的 `??` 命中皆為合法空值運算子且未發現 U+FFFD 置換字元。
- 尚未做瀏覽器實機視覺與音效驗收，因此不宣稱已確認彩虹混色、卡冊縮圖或各模式的實際觀感。
- 交接文件要求的 `git fetch`／`git pull --ff-only` 因 `.git/FETCH_HEAD` 無寫入權限失敗，本輪以目前工作區完成，無法確認遠端同步狀態。
- 未 build、未起 server、未 commit、未更動任何素材檔，原本未追蹤的 `build.log` 保留未動。
