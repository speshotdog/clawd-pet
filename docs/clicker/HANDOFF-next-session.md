# 珍母點點：交接（2026-09-07 下午，素材補齊＋三個 UI 修正）

## 一、現況一眼看

- **程式碼**：分支 `main`，已 push 到 origin（最新 `eec6587`）。
  ⚠ **每台機器路徑不一樣**：目前看過的有 `D:\claude研究\clawd-pet` 與 `D:\claude\clawd-pet` 兩種。本文件底下的指令一律不要寫死路徑，用 `git rev-parse --show-toplevel`。
  ⚠ **接手前一定先 `git fetch` + `git pull --ff-only`**（2026-09-07 就發生過本機落後 origin 66 個 commit，差點直接改到舊檔）。
  原（2026-09-06 深夜）：第八～十三輪全部合併，`npm test` 111 例、Playwright 全套件（round4~7 舊套件＋`--round8/9/11/12`）全綠。main 已於 2026-09-07 push 到 origin（`f319ebd` 之後可在別台機器 clone 續作；之前只推 gh-pages）。
- **網頁版**：https://speshotdog.github.io/clawd-pet/ ，來源是 `gh-pages` 分支（只放 `dist-web/` 內容＋`.nojekyll`，orphan commit，每次 force push 不保留歷史）。存檔在瀏覽器 localStorage 的 `clicker_save`（跟 exe 各自獨立；可用徽章牆的「匯出存檔／匯入存檔」搬家）。
- **桌面版**：Tauri 視窗 `clicker`（`src-tauri/target/release/clawd-pet.exe`，右鍵選單「珍母點點」）。與網頁版共用同一套 `src/clicker*.*`，差別只有 `window.__TAURI__` 有無（見 `clicker.js` 的 `TAURI` 分支：拖曳、關窗、fit_window）。
- **設計定案**：`docs/clicker/DESIGN-round8-roadmap.md`（王包規則、技能四規則、升星影響技能、角色粉塵／升階／超越、卡冊、更衣室、消費手段、輪迴）。各輪簡報 `BRIEF-astra-impl-round8~13.md`；第八、九輪由 GPT-6 Astra 實作，第十輪 Astra 只做經濟層一半（Codex 額度），其餘由 Claude 與子代理完成。

## 二、網頁版怎麼更新（每次改完 main 都要做）

```bash
REPO="$(git rev-parse --show-toplevel)"   # 別再寫死路徑（各機器不同：D:/claude研究/clawd-pet、D:/claude/clawd-pet）
cd "$REPO"
python tools/export-web.py            # → dist-web/（2026-09-07 起 307 檔、約 43 MB；clicker.html→index.html、內嵌角色 template）
git branch -D gh-pages 2>/dev/null   # 本地舊分支擋 orphan
T="$(mktemp -d)" && git worktree add --detach -q "$T" HEAD && cd "$T" \
 && git checkout -q --orphan gh-pages && git rm -rfq . && cp -r "$REPO/dist-web/." . && touch .nojekyll \
 && git add -A && git commit -q -m "網頁版：<說明>（main <hash>）" && git push -u origin gh-pages --force
cd "$REPO" && git worktree remove --force "$T"; git worktree prune; git branch -D gh-pages
```

- Pages 大約 30 秒生效；**推完馬上 curl 會拿到 404，那是 CDN 還在舊快取，不是推失敗**——先用 `gh api repos/speshotdog/clawd-pet/pages/builds/latest --jq '.status, .created_at'` 確認 build 完成再驗。玩家瀏覽器可能快取舊 CSS，重新整理即可。
- 網頁版驗證：`python tools/test/clicker-browser.py`（round7 會用 route 讀 `dist-web/`，所以要先 export）；真 Chrome 用 Playwright `channel='chrome'`，並把 viewport 開到 2560×1215 才會重現大視窗的 9-slice 縫線問題（見筆記）。
- 網頁版沒有後端：沒有排行榜、沒有雲端存檔；分享卡是 canvas 合成後下載／複製到剪貼簿。

## 三、桌面版怎麼出貨

1. 關掉正在跑的 `clawd-pet.exe`（build 會寫同一個檔）。
2. `npm run build`，**看錯誤不看 tail**：`grep -c "^error" build.log` 要是 0、`src-tauri/target/release/clawd-pet.exe` 的 mtime 要是現在。
3. 在 worktree build 不會更新主 repo 的 target，要複製 exe 與 `bundle/nsis/*.exe` 回主 repo。
4. 啟動 exe；實機驗證只截圖不送輸入（先看 `%TEMP%\clawd-debug.log` 有沒有人在玩）。

## 四、檔案地圖（clicker 部分）

| 檔 | 內容 |
|---|---|
| `clicker.js` | 宿主：結算 1Hz、存檔、技能槽、切入、場景票券、電動手指 tick（`autoTick`）、音效（`CLICK_SOUNDS` 十種點擊音） |
| `clicker-balance.js` | 12 角色技能基準、`skillAt(id,star,transcend)`、羈絆、推薦組合、更衣室目錄、印記商店、裝飾清單 |
| `clicker-economy.js` | 純邏輯：`click(state, now, target, options{auto,sink})`、settle（離線／regen／禮包／輸送帶）、王包、粉塵／升階／超越／溢出／兌換、更衣室、場景切換 |
| `clicker-save.js` | `fresh()`、`validate()`（v1→v2 遷移、rainynight→fridge 遷移、所有新欄位補預設） |
| `clicker-scene.js` | 七個場景設定（enemy: shell／timer／regen／triple／gift；boss；affinity；layers）＋層次渲染、風、視差、粒子 |
| `clicker-stage.js` | 舞台：包裝五狀態、硬殼、王包演出、三連包／輸送帶／禮包、粒子 `burst()`（更衣室特效預設）、電動手指、裝飾層 |
| `clicker-album.js` | 卡冊、展示頁（升階／超越／訓練／裝備）、粉塵罐、更衣室（音效／特效／裝飾） |
| `clicker-prestige.js`／`-ui.js` | 輪迴純邏輯與面板（換桌布、印記商店、電動手指購買、提示便條） |
| `clicker-extras.js` | 每日一包、徽章牆、第 100 包 12 選 1、分享卡、存檔匯出匯入、冰箱霜層 |
| `clicker-cutin.js`／`-music.js`／`-gacha.js` | 切入（`T`／`EASE` 不動）、ChipForge BGM、招募 |
| `tools/export-web.py` | 靜態匯出 |
| `tools/test/*.test.js`、`clicker-browser.py` | 單元與瀏覽器驗證（`--round8/9/11/12` 各自子命令） |
| `tools/sim/clicker-curve.js` | 進度曲線模擬（真人節奏、各場景王的三種打法比例、包速、開包節奏）；`clicker-boss.js` 是舊版 |

## 五、數值定案（2026-09-07 數值重整 v2 之後）

**全部細節與模擬結果在 `docs/clicker/DESIGN-balance-v2.md`**；模擬器 `node tools/sim/clicker-curve.js [點擊/秒] [每段分鐘] [天數]`（舊的 `clicker-boss.js` 已被它取代）。

- 王包血量 = `max(門檻包需求, 1.25 × (30P + 180D))`，冰箱 .95；純放置 0.6、連點 0.8、連點＋技能 1.1。**不再是包需求的倍數。**
- 場景需求倍率 1／8／64／500／2000／12000，收益倍率 1／1.5／2／2.5／3／3.5（不再同倍率）。解鎖仍是每場景拆滿 60／70／80／90 包。
- 夥伴訓練：每級 +1 倍（線性）、`200×base×1.15^L`、10/25/50/100/150/200 級 ×2（那一級價 ×10）、上限 200。全隊訓練 ×1.25／級、`2500×2.5^t`。手勁 `1.15^L`、`10×1.35^L`。
- 招募價釘在每秒收益：單抽 30 秒、五連 135 秒的 P（下限 150／700）。
- 換桌布提示改在 1Hz 結算檢查，多一個「一包 >3 分鐘且 ≥5 印記可領」的觸發。
- 第 100 包 12 選 1 不自動彈出，徽章牆按鈕手動開（避免蓋住王包／禮包）。

## 六、尚未做／素材缺口（2026-09-07 下午更新）

**已補齊**（見第八節）：桌面裝飾、深夜冰箱場景層、場景縮圖 3~7、今日限定包、霜層。

**還缺**：
- `clicker-badge-*` 17 檔（pack10/25/50/100/300/1000、boss-<六場景>、star5、promote、transcend、streak7、coins1e8）。
  目前走既有的合成 fallback（星／肉球／愛心底圖 ＋ DOM 疊字），文字保證正確、看起來也成立。
  ⚠ **不要直接叫 imagegen 把字畫進去**：徽章上有「王1」「升階」「超越」「7日」「1億」，gpt-image-2 畫中文會出錯字。
  要做就生「無字底圖」17 張，讓 `badgeNode()` 照舊疊字。
- `clicker-scene7-*` 屋頂星空（仍是借後院層＋`clicker.css` 的 `[data-scene="rooftop"]` 夜色濾鏡）。
  ⚠ 做這個時記得看第八節的冰箱教訓：**素材換成夜色的當下，要同時把那條 `hue-rotate` 濾鏡拿掉**，否則會二次調色調成怪顏色。
- `clicker-frozen-{0..4}` 冷凍包五狀態（目前用 `clicker-can-*` ＋ 霜層，看起來還可以）。
  五個狀態要彼此一致，分五次 imagegen 很難對齊，建議用同一張圖改圖或改用程式疊霜。
- `tools/sim/clicker-boss.js` 補三～六場景的王與「滿養」情境；`REPORT-astra-impl-round10~13.md` 未寫（commit 訊息有摘要）。
- 使用者實玩回饋待收：王的手感、開包節奏、換桌布時機、印記是否太大方。

## 九、2026-09-07 晚：第十四輪（使用者實玩回饋五項）

簡報 `BRIEF-astra-impl-round14.md`，Astra 實作，Claude 驗收（`python tools/test/clicker-round14.py`，需 `PYTHONIOENCODING=utf-8`，截圖在 `_art/out/r14-*.png`）：
- 卡冊點左右書頁空白就翻頁（角落鍵保留）；卡片下方只剩「升階 24/12」一行，粉塵數移到 title／aria-label。
- 點面板外空白關最上層面板（`clicker.js` `closeTopPanel()`，Escape 共用；不關招募、不關視窗、save-error 不關）。
- 分享卡標題依 470px 可用寬自動縮字／拆兩行；順手修 `#share-canvas` 撐出面板底部（下載鍵被擠掉）。
- 更衣室：音效／特效固定 2 萬、裝飾 `50000×1.5^擁有數`，不再跟收益走。
- 「手勁」改顯示「攻擊力」（變數／存檔欄位不動）。
- 待做：gh-pages 更新、exe 重 build（要先問）。

## 八、2026-09-07 下午：素材補齊＋三個 UI 修正（main `eec6587`）

**補了 22 張素材**（Codex imagegen，單行 prompt；批次清單留在 `_art/TASK-deco.md`、`_art/TASK2.md`）：
- `clicker-deco-0~9` 桌面裝飾十件 — 原本畫面上只印文字標籤
- `clicker-scene6-*` sky/far/mid/ground/prop×3 — 深夜冰箱終於有自己的圖，不再借廚房
- `clicker-scene3~7-thumb` — 場景票券縮圖，**不是 imagegen，是 Playwright 實機截圖裁 192×54**
  （`python _art/audit.py thumbs`；會連 scene1/2 一起重產，記得 `git checkout` 把原本那兩張還原）
- `clicker-daily-bag`、`clicker-frozen-frost`、`clicker-frozen-ice`

**修掉三個 bug**：
1. **深夜冰箱整場變粉紅**。`clicker.css` 的 `[data-scene="fridge"] #clicker-scene { filter:hue-rotate(160deg) }`
   本來是把暖色廚房圖轉藍；換成冰箱自己的冷色素材後，反而把藍轉成粉。已拿掉 hue-rotate，`tint.opacity` 從 .34 降到 .12。
   **教訓：借圖用的調色濾鏡，跟素材是綁在一起的，換素材必須同時拆濾鏡。**（scene7 屋頂星空之後會踩同一顆）
2. **大數字撐爆版位被切掉**。`clicker.js` 的 `format()` 單位只排到「京」，
   冰箱第 400 包需求變成 `5214015183京`（`scrollWidth 190 > clientWidth 150`，尾巴被票券框切掉）。
   單位補到 垓／秭／穰／溝／澗／正／載／極，`>= 1e52` 退回科學記號。現在顯示 `52.14秭`。
3. **裝飾壓在技能槽與進度條上**。`decoSlots` 舊座標落在夥伴圓鈕（x28-308, y224-288）與進度條（y308-348）上。
   改成 **依裝飾自己在 `B.decor` 的編號固定位置**（原本是依購買順序 `i % slots.length` 輪流佔位，
   所以同一件裝飾會因為買的順序不同跑到不同地方）；會掛的（燈串／風鈴／小旗串）放上方、其餘排地面線；
   `.deco` 加 `max-width:88px; object-fit:contain` 免得燈串／旗串橫向爆出畫面。

**一個查了不是 bug 的**：面板關閉鍵上的藍色外框。那是用 JS `element.click()` 開面板才觸發的 `:focus-visible`，
真滑鼠點不會出現。**寫瀏覽器驗證時用 `locator.click()`，不要用 `evaluate` 裡的 `el.click()`**，否則會驗出假 bug。

**新的稽核工具**（`_art/`，`_art/out/` 與原始生圖已 gitignore）：
- `python _art/audit.py audit` — 種一份滿等存檔，掃七個場景＋各面板，印出「缺素材清單／破圖／JS 錯誤」並每個狀態存一張截圖
- `python _art/audit.py thumbs` — 產場景縮圖
- `python _art/shot.py <寬> <高> <前綴>` — 指定解析度截全套面板（驗 960／1280／2560 用）
- `python _art/postproc.py <來源> <檔名> <目標高>` — imagegen 產出去背裁邊丟進 `src/`
- ⚠ 種存檔要過 `S.validate()`，很多欄位互相牽制（`marksClaimed >= marks + 印記商店總價`、
  `skillSlots.length === slotLen`、`slotReadyAt` 長度要跟著、升階／超越要有對應粉塵）。
  **改種子先用 `node -e` 跑 `S.validate()` 試，不要在瀏覽器裡猜**——驗證失敗時遊戲只跳「存檔無法讀取」不噴錯。

**已出貨**：main `eec6587` 已 push；gh-pages 已 force push 並確認線上 200；
exe 於 2026-09-07 16:17 重 build（`grep -c "^error" build.log` = 0），NSIS 安裝檔 `ClawdPet_0.5.3_x64-setup.exe` 一併產出。
`npm test` 111 例、Playwright round4~7 與 `--round8/9/11/12` 全綠。

## 七、2026-09-07 凌晨：罐頭錯位已修、數值重整 v2

- **罐頭錯位已修**（`clicker.css` `#bag[data-skin="1"]` 132×212 容器、底部對齊同一個接地陰影；`clicker-stage.js rings()` 一般包的環改成整張同畫布疊上去、依 shell 值 translateY −20%／0／+20%，王包仍用 24% 分段；`shell()` 的命中動畫疊在既有 transform 上）。Playwright 真 Chrome 2560×1215 驗過「種存檔進廚房」與「後院票券切過去再切回來」兩條路，截圖在 `D:\claude研究\_scratch\clawd\out-can\`。
- **數值重整 v2**：見第五節與 `DESIGN-balance-v2.md`。單元測試 111 例已改成新數值。
- **03:00 追加修正**：王包環改依大罐頭自己的金屬帶定位；被擋住的環亮度 1.5→1.22＋「硬殼！點 3 下敲開」膠帶（`#shell-hint`）；解鎖字卡 `#boss-banner` 去底色（膠帶貼圖四成透明會露白邊）。main `5d81d9c`、gh-pages 同步、exe 03:03 重 build。
- **素材仍未生**：Codex 額度 9/7 11:03 才重置（凌晨探測確認 usage limit）。缺口清單見第六節。
- 下一步：收使用者實玩回饋（王的手感、開包節奏、換桌布時機、印記是否太大方）。

## 七之前、2026-09-06 深夜實測後的狀態與待修（已處理，留作紀錄）

- main `131121e`（未 push）、gh-pages `bccf6fa`、exe 23:23 build 並已啟動。今晚實測修掉：舞台 `:not(#id)` 特異度害可點元素點不到、按鈕填色出框、卡冊每秒重建閃爍與 hover 白塊、技能發動鎖死（驗證漏訓練里程碑）、今日限定包需求／收據、粒子浮字在王之上、王包本體可點、12 選 1 改手動。
- ~~待修~~（09-07 已修，見上）：換到廚房後罐頭顯示錯誤（使用者截圖）：切場景後 `#bag` 容器仍是袋子尺寸（154×176），罐頭圖 319×512 比例不同，硬殼環 `#shell-rings img { height:24% }` 依容器定位，結果環浮在空中／與罐頭錯位，有時罐頭本體沒畫出來只剩環。看 `clicker-stage.js` 的 `showBag()`／`rings()`／`layout()` 與 `#bag`、`#bag-image`、`#shell-rings` 的 CSS：罐頭要有自己的容器尺寸（例如 `bagSkin` 1 → 132×212），環的位置改依罐頭圖上實際的金屬環座標（`clicker-can-shell.png` 與 `clicker-can-0.png` 同畫布，直接疊同尺寸即可，不要用 24% 分三段）。切場景時要重設 `#bag-image` 的 src 與尺寸再顯示。用 Playwright 種 `settings.scene:'kitchen'` 與從後院 switchScene 兩條路各截一張比對。
- 驗證習慣：Playwright 真 Chrome、viewport 2560×1215、真滑鼠點擊＋`elementFromPoint`；hover 前後截圖 diff。舊套件 `python tools/test/clicker-browser.py` 加 `--round8/9/11/12`。
