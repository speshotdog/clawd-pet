# 珍母點點 第十二輪實作：深夜冰箱冷凍包＋每日一包＋里程碑徽章牆＋分享卡＋存檔匯出匯入（可寫檔）

先 `git log -4`（第八～十一輪已合併）。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、`tools/sim/*`、`docs/clicker/REPORT-astra-impl-round12.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動。不 build、不起 server、不 commit。演出「可以更好，不能更淡」。素材檔名寫死（`clicker-scene6-*.png`、`clicker-frozen-*.png`、`clicker-daily-*.png`、`clicker-badge-*.png`），缺檔 `onerror` 隱藏。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 1.1（第六場景）、3.6（每日萬用粉塵）、5（目標與節奏、網頁版專屬）。

## 一、深夜冰箱（`rainynight` → 改 id `fridge`，名「深夜冰箱」；舊存檔若有 `rainynight` 遷移成 `fridge`）
- `unlock: { packages: 4000, boss: 'nightmarket' }`、`requirementMul/rewardMul: 120`、`enemy: { regen: .01 }`、當家 zhenmu、zhenzhen；palette mat #AEC6D6／sky #DCE9F2；music theme `rainynight`, seed `zhenmu-fridge-1`, gen density 35 rhythm 30 speed 30 drama 40 mood 45 hook 55 smooth 80。
- **regen**：每秒 `progress -= need × regen`（不低於 0），只在可見時與離線結算時都算（離線：被動 P 減掉回升量後才推進；若 `P < need×regen` 離線進度停在原地、幣照給）。UI：量尺旁一個小雪花標 `clicker-frozen-ice.png` 與「−1%/秒」。
- 舞台：冷凍包 `clicker-frozen-{0..4}.png`（結霜的藍白袋子五狀態）；回升時包裝表面結霜層 `clicker-frozen-frost.png` 的 opacity 隨 `1 − progress/need` 變；burst 命中時霜層碎成 16 片白色碎冰（sprite 9 上色 #DFF3FF、`lighter`）。層次照前幾個場景：sky（冰箱內壁）／far（層架與食物）／mid／ground（下層板）／props×3／drift（冷氣霧）×2／particles（雪花、冰晶）。王「大冰磚」：`boss.mul 6`＋regen 照吃。

## 二、每日一包（`state.daily = { date:'YYYY-MM-DD', done:false }`）
- 以 `settledAt` 的本地日期判斷：日期變了 → 桌上多一個「今日限定包」（`clicker-daily-bag.png`，金色膠帶＋星星，放在一般包左邊 x 300，一般包不動）。它是**額外目標**（同夜市禮包的熱區機制），需求 `3×H(k)`、不限時、被動不打它（只吃點擊與 burst）。
- 拆完：`freeDraws += 1`、`universalDust += 1`、彩帶 24 片＋`GachaAudio` 史詩揭曉音＋浮字「免費單抽 ＋1・萬用粉塵 ＋1」；當天不再出現。沒拆不累積。
- 統計面板顯示「連續 N 天」（僅顯示，不給加成）。

## 三、里程碑徽章牆（統計面板改版）
- `#stats` 改成「徽章牆」：紙板上一格格徽章（`clicker-badge-{id}.png` 64px，未得灰）：第 10／25／50／100／300／1000 包、六隻王、第一次 5★、第一次升階、第一次超越、連續 7 天、生涯 1 億。第 10／25／50 包同時把小恐龍／黃球／皮球放到當前場景的 props 槽（既有 toy PNG，60px）。
- 拿到徽章：徽章從 `scale 0` 蓋下 220ms（settle）＋4px 震＋`tone 880 d .24 gain .1`（設計文件的里程碑鈴）；`notice` 一行。
- 第 100 包 12 選 1：一張 12 格小面板，選一隻 → `dust[id] += 1`（等於一張卡）。

## 四、分享卡（網頁版與 exe 都做，網頁版有「複製」）
- 拿到徽章、打贏王、超越五時，`notice` 多一顆「分享」小鍵 → 開 `#share` 面板：canvas 960×540 合成：牛皮紙底（`clicker-ui-kraft.png`）＋標題帶「珍母點點」＋大字「我拆了 N 包」／「打贏了大罐頭」＋三槽夥伴頭像（`card.art.create` 轉 SVG → `drawImage` 需先序列化成 `data:image/svg+xml`）＋當前場景縮圖（`html2canvas` 不用；直接 `drawImage` 場景各層 img 依 `scene.layers` 座標重畫一次）＋右下角網址字樣 `speshotdog.github.io/clawd-pet`。
- 鍵：「下載 PNG」（`a[download]`）、「複製到剪貼簿」（`navigator.clipboard.write` ClipboardItem，失敗顯示「請用下載」）。

## 五、存檔匯出／匯入（統計面板底部兩顆鍵）
- 匯出：`btoa(unescape(encodeURIComponent(JSON.stringify(state))))` 加前綴 `ZMDD1.`，放進 textarea＋「複製」鍵。
- 匯入：textarea 貼上 → `validate()`（`clicker-save.js` 既有，含版本遷移）→ 成功先顯示摘要（幣、包數、夥伴數、存檔時間）要玩家按「確定覆蓋」→ `commit` → 重新 `mount`／`changed`；失敗顯示錯誤欄位，不動現有存檔。匯入的 `settledAt` 若在未來 → 取現在（時間高水位規則）。

## 六、驗收與交付
- `npm test`：regen 可見／離線兩路、每日日期切換與不累積、徽章判定、12 選 1、匯出匯入 round-trip 與壞字串拒絕。
- `tools/test/clicker-browser.py` 加 round12：冰箱靜態圖、霜層三階、burst 碎冰 120ms、今日限定包出現與拆完、徽章蓋下 100ms、分享卡 PNG 落地（存到 artifacts 並檢查尺寸）、匯出→清存檔→匯入→狀態一致。
- `docs/clicker/REPORT-astra-impl-round12.md`。
