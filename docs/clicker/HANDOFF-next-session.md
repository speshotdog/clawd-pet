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

## 十七、2026-09-08 晚：第三十二輪 直式手機收尾（已出貨，main `4034a7f`／gh-pages `e729aaf`）

**接手第一步**：`git fetch && git pull --ff-only`，`npm test`（170 例），
以及 `NEXT-SESSION-KICKOFF.md` 列的**十支** Playwright 套件（新增 `clicker-round32.py`）。

### 起點：使用者截圖「抽卡也是剩一半」

實機量出來的數字（390×844，五連翻牌後）：卡片橫跨 x=55～905，只有第一張完整在畫面內，
其餘四張出界。根因不是版面沒調，是**招募層的內容是一套寫死的 960×640 座標系**
（`clicker-gacha.js` 的 `size/center/layout`、`#fx`/`#fx-under` 兩張 canvas 的 width/height 屬性），
橫式時招募層剛好就是 960×640 所以完全看不出來，直式它變成整個畫面就整組錯位。
**跟切入演出（`#cutin`）踩過的是同一個坑，只是這次連 canvas 的座標一起錯。**

⚠ 這裡有一個誘人的錯解：照 `#cutin` 那樣「整塊 960 等比縮到畫面寬」。算一下就知道不行——
scale 只有 0.406，卡片剩 61px 寬，字讀不到。**卡片是要看的，不能只縮。** 所以改重排。

### 這一輪做了什麼

- **招募演出換座標系**：新增 `ClickerGacha.PORTRAIT_BOX = {w:560, h:900, pad:76}`。直式時
  `makeRuntime()` 用這組當 `size/center`，`layout()` 把五連排成 **2+3**（上排兩張 y=330、
  下排三張 y=580，下排最外側中心 ±172、卡片半寬 75 → 邊緣 33／527 落在 560 框內）。
  CSS 那邊 `#fx-under/#cards/#fx/#mode-root` 變成 560×900 的框、等比縮到畫面寬並置中，
  縮放比 `--gacha-fit` 與位置 `--gacha-top` 由 `clicker.js` 的 `fitStage()` 算
  （縮放取 `min(寬/560, 可用高/900)`——**只看寬的話 320×640 這種矮螢幕會把下排頂到收下鍵上**）。
  ⚠ `#dim`／`#flash` 故意**不**進這個框：它們是整面壓暗／閃白，要蓋滿畫面才對。
  ⚠ canvas 的 width/height 是屬性、`GachaFx.init()` 只在建 runtime 時讀一次（`W=el.width`），
  一定要在 `init` 之前改，否則特效跟卡片對不準。
- **拉幕登場（stage 模式）的劇場是照 960 畫死的**（簷幕 1000 寬、布幕 500 寬、`FLOOR=452`），
  直式整片穿出去。橫向尺寸改成照 `ctx.size.width/960` 縮，`FLOOR` 直式擺在框正中央，
  布幕高度與「下一位」跟著框高走。另外**直式的演出框只佔畫面中間一段，劇場的暗場景只鋪到框邊、
  上下會露出招募層的海軍藍**——給 `.st-back` 加一圈 `box-shadow:0 0 0 9999px` 的實色把框外壓黑
  （橫式框就是整個招募層、又有 `overflow:hidden`，那圈陰影看不到）。其餘四個模式都吃 `ctx.center`，不用改。
- **卡冊在直式改單頁**。內部從「跨頁索引 `spread`」改成「**單頁索引 `page`**」當基準，
  `wide()/sheet()/sheets()` 三個小函式決定一次翻幾頁——直橫切換時 `page` 不變，
  所以會落在同一批角色上、不會跳頁。書框的 border-image 畫的是攤開的跨頁（中間有書脊），
  單頁時書脊會從正中央穿過去、四張卡看起來像被切兩半，**直式改用跟其他面板一樣的牛皮紙框**。
- **面板抬頭在 390／320 被壓成直書**（使用者截的卡冊：標題膠帶與說明整個變成一行一個字，
  書框被擠出畫面底部）。`.panel header` 是一排 flex，每個項目都被壓到剩一個字寬。
  直式一律 `flex-wrap:wrap`、膠帶縮小且 `nowrap`、說明自己占一整行；320 以下收掉說明。
- **「選擇演出方式」原本在直式是 `display:none`**。演出下拉只長在招募層的頂欄裡，
  而招募層只有這顆鍵或「抽下去」才打得開，而且 `mode-select.onchange` 在 `pending` 時會拒絕變更
  → **直式玩家永遠換不了演出方式**。改成招募那一列的第二行（圖與價格各跨兩行）。
  ⚠ 字級要寫 `#game #recruit-open`：`#game button`（1,0,1）比 `#recruit-open`（1,0,0）強，
  只寫 id 會被吃掉，實機上還是 14px、然後折行掉出那一列。
- **入隊演出會飛到畫面外**。`collect()` 的起飛點與 `join()` 的落點都寫死 `/960`，
  但直式 `#join-flight` 是跟著舞台縮的 608 框、而夥伴列根本在舞台外面。
  兩邊都改成**照 `#join-flight` 自己的座標系換算**（`zoom = rect.width / clientWidth`），
  橫式時它就是 `#game` 的 960×640、zoom 剛好等於整體縮放，**行為一模一樣**；
  直式讓 `#join-flight` 蓋滿畫面、座標就是畫面像素。另外夥伴列是左右滑的，
  目標常常滑在畫面外 → 落點先 `scrollIntoView({inline:'center'})` 再量。
- **夥伴列兩側加漸層遮罩**：被切一半的那顆會淡出去，讀得出來「還有、可以滑」。
- **卡冊詳細頁在直式改直排**；⚠ 卡片是 `scale(1.15)` 但版面高度還是 210，
  直排會直接壓在名字上（實機看到「阿漉」被卡片蓋掉半個字），直式取消放大並置中。

### 這一輪學到的坑

- **「只看得到一半」要先查座標系，不要先調版面。** 這已經是第三次同一個形狀的 bug
  （切入演出、粒子畫布、現在的招募層）：一段內容有自己的固定座標系，
  在橫式剛好等於容器大小，換到直式就整組錯位。以後看到直式錯位，
  先問「這塊有沒有自己的座標系」，再決定是縮還是重排。
- **縮放不是萬用解**。切入演出可以整塊縮（它是一條橫幅，看得懂就好），
  招募不行（卡片是要讀的）。判準是**內容有沒有要讀的字**。
- **CSS 特異性要連著 `#game` 一起算**。`#game button` 會蓋掉單獨的 `#recruit-open`。
  改完覺得「沒生效」的時候先量 `getComputedStyle`，不要重寫規則。
- **驗收要量座標不要看截圖**。卡片「看起來在畫面上」跟「bounding box 在畫面內」是兩回事；
  round32 的斷言全部是量 `getBoundingClientRect` 比 viewport。
- ⚠ **gh-pages 的發佈流程會被上一次留下的 worktree 卡住**。這次 `git checkout --orphan gh-pages`
  直接 fatal：`a branch named 'gh-pages' already exists`——因為**前一個 session 留了一個
  `%TEMP%	mp.xxxx` 的 worktree 還占著 gh-pages 分支**，所以第二節那行 `git branch -D gh-pages`
  刪不掉（分支被 worktree checkout 中）而且它的錯誤被 `2>/dev/null` 吞掉。
  發佈前先 `git worktree list`，看到 `%TEMP%` 底下的殘留就 `git worktree remove --force` 掉。

## 十六、2026-09-08 傍晚：第二十四～三十一輪（已出貨）

**接手第一步**：`git fetch && git pull --ff-only`，`npm test`（170 例），
以及 `NEXT-SESSION-KICKOFF.md` 列的九支 Playwright 套件。

### 修掉的 bug（照嚴重度）

- **存檔會被鎖死，而且鎖死後出不來**（使用者朋友回報）。第二十二輪把第七站 city 接在 fridge 後面時，
  `finishBoss` 開始在 `bossResult` 多寫一個 `next`，但沒替既有存檔做遷移；在那之前打贏王、
  結算牌還掛著的存檔一讀就被 validate 擋下。更糟的是**錯誤畫面本身是死路**——
  匯入鍵長在 `#stats` 裡，而 `#game-content` 已經 inert 掉，拿到修好的存檔也貼不進去。
  兩邊一起解：`clicker-save.js` 加 `repair()`（照損失由小到大列十個重置步驟，
  先單獨試每一步、都不行才累加，所以只壞一塊時就只賠那一塊），
  以及錯誤畫面自己長出「貼上存檔救回」。
  ⚠ `REPAIRS` 那張表**只准放丟掉了玩家不會心痛的東西**，任何會清掉養成進度的都不準加。
  自動修復**不覆蓋 `clicker_save` 本身**，原檔備份到 `clicker_save_broken`。
- **打完第七站的王之後場景鍵鎖死到重整為止**。勝利字卡那行寫死特判 `'fridge'`，
  終點站 city 的 `r.next` 是 undefined → `ClickerScenes[undefined].name` 丟例外；
  那段跑在 `later()` 裡，例外一丟後面的 `bossBusy=false` 就永遠不會執行。
- **開了「減少動畫」的玩家一個收益浮字都看不到**。`float()` 與 `floatPassive()` 開頭都擋
  `reduced.matches`。數字是資訊不是裝飾——改成 reduced 時走「原地淡入淡出」，位移拿掉、讀數留著。
- **卡冊詳細頁的進場動畫會被重播一次**（使用者說的「卡片抽動／剛點開閃一下」）。
  `refresh()` 的比對 key 裡含 `detailId`，所以「打開」這個動作本身一定會讓 key 改變，
  下一個 tick 就重建並重播。實測 +0ms 開始、+145ms 播完、**+222ms 整個歸零重來**。
- **粉塵罐兌換後跳回最上面**、**推薦組合四張票券排一列 1120px 穿出紙面**、
  **商店分類頁的字溢出票券框**（票券素材的 9-slice 框是畫死的撐不開）。
- **商店面板一直掉在左上角**：`left/right/top/bottom` 後面跟著一句 `inset:auto`，把前面四個全部重設掉。

### 新東西

- 新卡共 **52 張**（第二十四輪五張＋神話「玩物就玩物」）。`boss-city` 徽章補上，徽章 18 枚。
- **粉塵兌換改遞增價**（使用者選 B）：第 n 次要 n 印記。理由是印記產出是 √生涯收入、
  會爆炸性成長，固定比例遲早把整個卡池買下來——跟第二十三輪印記倍率「線性改開根號」同一個教訓：
  形狀不改，係數只是延後。湊滿一張神話從 320 印記變成 51,360。
- **更衣室改成商店**：分類頁 → 點進去只看該分類，置中的懸浮視窗（外面有暗底）。
- **桌面裝飾預設不擺**：新欄位 `decoShown`（`deco` 的子集）。買到的照樣算 +1%，擺不擺只影響畫面。
- **前兩站的罐子換成會動的怪**：後院＝啄包怪鳥、廚房＝偷嘴灰狼，各 4 幀 sprite strip。
- **收下並繼續五連**：收下後不關面板直接再抽一輪。
- **四張神話演出到齊**（玥來玥閒＝暖橘金漣漪＋Z；玩物就玩物＝往上托的粉色柔光＋愛心）。
- **直式手機版面**：`@media (max-aspect-ratio: 3/4)`，橫式那套 960×640 原封不動留給桌機與 exe。

### 這一輪學到的坑

- **sprite 動畫用 `steps(n)` 配 `background-position-x` 百分比是錯的**。百分比是
  「(容器寬 − 背景寬) × 比例」，0% 是第一幀、100% 才是最後一幀，中間要落在 1/(n−1)。
  普通 `steps(n)` 給 0、1/n、2/n…，每幀差一個身位，畫面上看得到接縫。要用 **`steps(n, jump-none)`**。
- **場景的王是用 `{ ...scenes.backyard.boss }` 繼承基準值的**，把 sprite 寫在 backyard 上，
  冰箱就會沿用到鳥的動畫。抽出不帶 sprite/image 的 `BOSS_BASE`，所有站從它長出來。
- **舞台寬只有 608**（不是 960）。狼寬 391 配預設中心 460，右緣會跑到 655 出界。
  round30 有一條通用斷言：每個王都要放得進舞台（鋪滿版面的滅世都市除外）。
- **直式時 CSS 變數要設在 `#game` 上不是 `#stage-fit` 上**：粒子畫布與浮字層是 `#stage` 的兄弟，
  設在 `#stage-fit` 上讀不到，`var(--stage-fit,1)` 退回 1 就變成 608px 寬撐出畫面。
- **置中的面板不能吃 `.panel` 那個進場動畫**——它動的是 transform，會蓋掉 `translate(-50%,-50%)`。
- **GIF 不能拿來做像素級的差異判讀**。使用者附 BUG.gif 回報卡片抽動，我用畫面差異熱區圖判成
  「整個面板都在抖」，那是錯的——GIF 只有 256 色且會 dithering，相鄰幀差異圖到處都是假訊號。
  實際量卡片 bbox：48 幀完全沒動。真正抓到問題是靠在瀏覽器裡**逐 animation frame 取樣
  `getBoundingClientRect`**。以後收到 GIF 就直接進瀏覽器重現。
- **被動浮字的測試要在「不點擊」的安靜視窗裡量**。它靠 1Hz 結算、每秒最多一個，
  跟點擊浮字混在同一個迴圈取樣會偶爾撲空。我被這個假失敗騙過一次，還一度以為是直式版面弄壞的。
  **只跑一次就下結論是不夠的。**
- **`git push origin main` 在別的分支上是 no-op**。2026-09-08 我有一段時間人在 `holo-cards`
  分支上卻一直以為在 main，push 全部沒作用、還當成成功回報。**commit 前先 `git branch --show-current`。**
- **Codex 會用完額度**：訊息是 usage limit、幾小時後才重置。額度沒了它會安靜地什麼都不做、exit 0，
  要自己檢查 `git status`。

### 直式版面的四個關鍵決定（2026-09-08 傍晚，與 Astra 討論後重做）

討論紀錄在 `docs/clicker/DISCUSS-portrait-layout.md`（我出的題）與 `-astra.md`（它的分析）。
**Astra 糾正了我三件事，三件都查證屬實**：

1. 錢包溢出不是 `margin-left:auto`，是它在橫式有 `position:absolute; left:340px; width:260px`；
   直式只改 margin／min-width 從來沒解除定位。**看到版面跑掉先查 position，不要只修看到的那個屬性。**
2. **省下來的垂直空間不能變成舞台變大**：舞台被寬度綁死（374/608 → 高 221），
   要更高就得寬 711。空出來的只能當留白。
3. `#slots` 的 bottom 早就被覆蓋成 72px（我引用了過期的 20px）；夥伴列需要 100px 不是 92。

而我原本堅持「舞台放最上面」也是錯的：實機量下來技能槽中心在 y=230、只有畫面高的 27%，
拆包鍵與技能槽都在舞台裡，而這是一個要一直點的遊戲。改成
**錢包 → 伸縮留白 → 升級／招募 → 舞台 → 夥伴 → 分頁**（flex order，DOM 不動）之後
拆包 y=533、技能 y=604，都進拇指區。

**教訓：版面爭議要用實機座標判，不要用直覺。** 我兩次都是量了才知道自己錯。

## 十五、2026-09-08 下午：第二十一～二十三輪（已出貨，main `cd6973b`）

**接手第一步**：`git fetch && git pull --ff-only`，`npm test`（158 例），
`PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py`、`...round22.py`。

已出貨：main 已 push；gh-pages 已 force push 並確認線上 200（`clicker-boss7-mieshi.png`／
`card-salamander.png` 都拿得到）；exe 與 NSIS 於 2026-09-08 12:11 重 build（`grep -c "^error" build.log` = 0）。

### 第二十一輪
- **冰箱王本來永遠打不贏**。血量下限是 `requirement(101,'fridge')`＝1.0e11，比玩家走到終點站時的
  30 秒容量（約 3.3e10）高三倍，血量跟玩家強度脫鉤，再被 1%/s 回升吃掉 30%。
  冰箱王加 `boss.floorMul: .3` 收下限，淨比例回到 純放置 .51／連點 .75／連點＋技能 1.13。
- ⚠ **模擬器量王的容量時，把 need 灌成 1e100 會讓「按血量比例」的機制一起爆掉**：
  冰箱回升 1%×1e100 每個 tick 把 dealt 歸零，量出來三種打法全是 0.00，看起來像差 100 倍的
  災難級失衡，真實差距只有 1.5 倍。已修（量容量時關回升，ratio 再用 `rate×30` 扣回來）。
  **看到模擬結果是乾淨的 0.00 或 100%，先懷疑量測壞了。**
- 被動收益浮字改「同一欄疊起來」（`PASSIVE_RISE` 42／`PASSIVE_LIFE` 2600，同時看得到三個），
  拿掉斜體與斜向漂移。使用者回饋：斜斜飄走沒有爽感。
- **BUG 修正**：抽完還沒收下時按 ESC 會卡在空的招募畫面。pending 存在時 ESC 掉進 `closeWindow()`，
  它先 `suspend()`（清卡面、藏收下鍵）再關 Tauri 視窗——網頁版沒有視窗可關，於是三條路同時斷掉。
  改成招募層開著時 ESC 只管招募層。

### 第二十二輪
- **十三張新卡**（桌面「新卡」）＋**新技能種類 `bossDamage`**：傷害＝王包血量的百分比，
  完全不吃 P／D，王越硬越值錢；不在王關時退化成一般爆發。飛沫月月 8%、滅世珍獸 22%。
- `_art/cardcut.py`：三種來源（已去背／白底 flood fill／黑底 flood fill）統一切成高 580 的 `src/card-<id>.png`。
  白底那條只吃「跟邊界連通」的近白，角色身上封閉的白袋不會被挖掉。
- **第七站「滅世都市」**（使用者定案）：打贏大冰磚解鎖、拆滿 110 包挑戰滅世珍獸。
  戰鬥時整張畫鋪滿版面當王本體（`#boss-view.full-board`）。
  ⚠ 王的圖鋪滿會蓋住技能鍵與夥伴圓鈕，`.full-board` 的 z-index 要壓在 `#slots`（9）底下。
  ⚠ 終點站的「可重複挑戰＋冷卻＋獎勵只發一次」規則已從 `fridge` 搬到 `city`，
  改動點有三處：`economy.canBoss`、`economy.finishBoss`、`save.validate`。
- 站內背景是「同一張畫壓暗去飽和」。**從原圖裁層試過三次都失敗**（鐵塔跟天空同一組暖色分不開，
  放寬門檻會把塔本身吃掉；鏡射拼寬又整片對稱很假）。不要再試了。
- 神話專屬演出由 Astra 實作（滅世光線、青花綻放），只動 `clicker-stage.js` 與 `clicker.css`。
  ⚠ 寫這類演出的測試時要先等 `testStage.frozen` 退掉——切入期間 stage 是 frozen，
  特效會（正確地）整段跳過，直接放會驗出「0 個元素」的假失敗。
  技能剛放完按鍵是 disabled，「點得到」要用 `elementFromPoint` 驗，不要真的按。

### 第二十三輪
- **印記永久倍率改形狀**：`1 + .05×累積印記` → `1 + .5×√累積印記`（使用者定案）。
  線性那版模擬三天七次輪迴衝到 ×5.4 億——輪迴後訓練與夥伴等級是用被倍率放大的錢重買的，
  生涯收入的成長快過「印記 ∝ √生涯收入」壓得住的速度。**把 5% 調成 1% 只是把爆炸延一天，
  形狀不改沒有用。** 改開根號後同一套策略跑三天：×301，每輪印記倍數從 ×9.4 收斂到 ×2.4。
  100 枚仍是 ×6.0，跟舊值接得上。係數在 `B.MARK_MUL_COEF`，模擬器用 `MARKMUL=` 覆寫 A/B。
- 再八張新卡（桌面「新卡.0」），角色總數 **46**。`cardcut.py` 補黑底 flood fill。
- 模擬器補了**輪迴策略**與**換場景**：換桌布會清場景進度但保留 bossWins，
  沒有 `maybeSwitchScene()` 的話第一次輪迴後永遠卡在後院，印記量測整個失真。

### 待收／待做
- 使用者實玩：被動浮字疊三個會不會太吵、第七站的難度、滅世光線 22% 是不是太強、
  開根號後的輪迴節奏、祝福定價（現在 markMul ×301 對 blessMul ×86，量級相當）。
- 徽章 17 張無字底圖仍缺（走合成 fallback）；冷凍包五狀態圖仍缺。
- `boss-city` 徽章沒做（`clicker-extras.js` 的 `bossScenes` 要不要加第七站）。
- 屋頂星空專屬素材（換圖要拆 hue-rotate）。

## 十四、2026-09-08：第二十輪（五連 80 秒＋訓練通膨、卡面去特質字、寄生標籤、數字爽感、印記祝福）

- 簡報 `BRIEF-astra-impl-round20.md`、報告 `REPORT-astra-impl-round20.md`；驗收 `PYTHONIOENCODING=utf-8 python tools/test/clicker-round20.py`。`npm test` 154 例。
- **招募**：`DRAW_SECONDS.five` 135 → 80，使用者實玩覺得太快，同日改回 135（保留一半訓練倍率）；`drawCost` 的 P 只吃一半全隊訓練倍率（`rates(s,{trainingLevel:T/2})`）。模擬：每日五連數首日 28 → 36，其餘日相同；粉塵入帳不變。
- **卡面**不再顯示「裝備時攻擊力 ×N」（`buildCard` 的 trait 參數已移除），資訊留在卡冊展示頁「特質」列。
- **寄生標籤** `#parasite-label` 移到 left 150／top 120、z-index 10（原本落在技能槽名字那排且層級較低）；「連鎖」標籤上移 24px。
- **數字爽感**：被動收益每秒一個 18px 淡金斜體浮字（`.floater.passive`，往右上飄 1400ms，優先回收）；點擊浮字依 `amount/P` 分 26／30／36／42px 四階（≥200 倍粉紅＋2px 描邊，`heavy` 併入）；每秒收益首次破十倍關卡蓋章（`s.peakRateStamp`，換桌布歸零）。
- **印記商店**新增「祝福」區：收益祝福（每級 +10%、第 n 級價 n 印記、無上限、`blessMul` 乘在 `rates` 的 M 旁，換桌布保留）、粉塵兌換（1 印記→5 萬用粉塵，有 ×10）、招募券（2 印記→5 次免費單抽）。`s.blessing`。模擬器沒有輪迴策略，所以「剩餘印記 <10」的目標沒有被真正驗證，要靠使用者實玩回饋。
- 待收：使用者實玩 80 秒與通膨手感、被動浮字會不會太吵、祝福定價。

## 十三、2026-09-08：第十九輪（招募回本、按鈕紙框改 CSS 畫、技能槽名字不遮角色）

- 簡報 `BRIEF-astra-impl-round19.md`、報告 `REPORT-astra-impl-round19.md`（含四份模擬全文）；驗收 `PYTHONIOENCODING=utf-8 python tools/test/clicker-round19.py`（四解析度＋dpr 1.25／1.5 四角放大、技能名字矩形不相交）。`npm test` 148 例。
- **招募價改釘「全員視為中位數等級」的 P**（`clicker-economy.js medianPartnerLevel`、`rates(s,{partnerLevel})`、`drawCost`）；不是 KICKOFF 寫的「未訓練 P」——那樣夥伴 100 級時五連只值 0.2 秒收益、等於免費。**新夥伴第一次入隊自動設為中位數等級**（`receive`，免費、不觸發慶祝）。模擬：五連回本中位數 112 分 → 14 分，最差 52.9 分（第 29 抽、第 2 天，未達 30 分目標，`DRAW_SECONDS` 沒動，要不要調給使用者定）；到 fridge 提前 8 小時。
- **按鈕與紙框不再用 9-slice**：`#game button`／`.upgrade`／`.recruit`／`#team`／`.panel`／`#recruit-topbar`／`#audio-panel` 改 CSS 畫（取樣色 奶油 #FBEED0、綠 #8D9C5B、粉 #FA776B、紫 #B48CCB、停用 #D9CCBB、紙 #FCECC8；3px 描邊、硬陰影、內虛線）。標題帶、票券、錢包牌、外框、桌墊、卡冊書仍用素材。任何 dpr 都乾淨，`_art/out/r19-corner-*.png`。
- **技能槽名字**：`.skill-name` 改到圓貼紙正上方置中（只咬合 4px），`#slots` gap 16px；四字以上名字不再蓋住角色圖。
- 待收：使用者實機 exe（dpr 1.25／1.5）看按鈕角；最差回本 52.9 分要不要再壓；其他待辦見 `NEXT-SESSION-KICKOFF.md`。


## 十二、2026-09-08 凌晨收尾：第十八輪＋訓練里程碑不加價（公司電腦接手從這裡開始）

**接手第一步**：`git fetch && git pull --ff-only`（家機 main 已 push），`npm test`（142 例），`PYTHONIOENCODING=utf-8 python tools/test/clicker-round18.py`。

- 第十八輪（報告 `REPORT-astra-impl-round18.md`）：卡冊標頭「平均訓練」鍵（`clicker-prestige.js trainAll`：每輪依等級低→高各買一級、買不起跳過、一次 commit）；`applyZoom` 縮放比向下取 0.25 倍數（下限 0.75）＋ border-image 寬度改偶數 → 9-slice 角落缺塊消失，四種解析度放大圖 `_art/out/r18-corner-*.png`。素材本身的淡色切片縫線仍在，要徹底消除得改素材或改 CSS 畫按鈕。
- **使用者定**：夥伴訓練里程碑那一級**不再 ×10 價**（只保留 10/25/50/100/150/200 的 ×2 倍率）；`trainCost = ceil(200×base×1.15^L)`。模擬器跑過（14 天到 fridge#112）。
- `card-zhencao.png` 重切：這張沒有白色部件，所有近白（含手臂與身體間的封閉白袋）都當背景去掉。
- 瀏覽器測試改的期望值：round7 `#join-flight svg` → 也接受 `img`（新招募的可能是 PNG 角色）。
- 待做／待收：徽章 17 張底圖、屋頂星空專屬素材（換圖要拆 hue-rotate）、冷凍包五狀態；使用者實玩回饋（轉彩 30%、神話 0.5%、零食小偷節奏、平均訓練手感）；「留聲機無法購買」仍未重現。
- 派工原則（給下一個 session）：簡報開頭列「不要動的旗標」（`WISH_TELEGRAPH=false`、`T`／`EASE`、點空白關面板、卡冊箭頭、轉彩 30%）；Astra 跑完先 `grep "??"`、`npm test`、再跑該輪 `clicker-roundNN.py`；瀏覽器套件裡 `gacha-card.css` 與 HEAD 比對那條要在 commit 後才會綠。

## 十一、2026-09-08：第十七輪（冰箱終點、新卡 2.0、印記四項、音量面板、零食小偷）＋第十八輪派工

- 第十七輪已 commit `f91d05b`（報告 `REPORT-astra-impl-round17.md`，驗收 `python tools/test/clicker-round17.py` 兩種寬度）。冰箱固定 100 包可挑戰、王勝＝六站全破不切場景；新卡 膠頭燃額（傳說、裝備時攻擊力 ×1.5 的唯一 trait）、警狗（傳說）、哥不狗（史詩）、珍珍JPG（**精良**，使用者定）；卡冊依稀有度低→高；電動手指上限 10（印記 finger14 → 14）；印記商店多 bossTime／offline15／daily2；零食小偷（monster-0/1/2 → 後院／便利商店／工廠）。
- 使用者定：**萬用粉塵換神話 100 換 1；神話滿養重複一張折 100 萬用粉塵**（`clicker-economy.js exchangeRate`／`receive`）。
- 素材：`src/card-{zhenjpg,jiaotou,jinggou,gebugou}.png`、`src/monster-{0,1,2}.png`（export-web 白名單已含 `card-*`，`monster-*` 這次一併加）。
- 第十八輪簡報 `BRIEF-astra-impl-round18.md`：卡冊「平均訓練」鍵（低等級先升、輪流買）、`fitWindow` 縮放比取 0.25 倍數修 9-slice 邊角缺塊。
- 舊瀏覽器測試改的期望值：round7 切入角色接受 `img`（PNG 角色）。

## 十、2026-09-07 深夜：第十五輪（十張新卡＋神話階級）、第十六輪（轉彩）

- 第十五輪：簡報 `BRIEF-astra-impl-round15.md`、報告 `REPORT-astra-impl-round15.md`。新卡素材 `src/card-*.png`（PNG 靜態圖，沒有 rig；所有讀 `CHAR_CFG` 的地方都有 `entry.src` 圖片分支）。神話 0.5%、係數 5.5、超越 +20%、萬用粉塵匯率 6。單元測試 122 例。
  驗收：`_art/out/r15-*.png`（卡冊第三跨頁、神話展示頁、神話翻牌五格）。舊瀏覽器測試兩處期望值已改（珍母複製對象→玥來玥閒、玥圓羈絆連鎖窗 12 秒）。
  強制抽神話的方法：在頁面裡包一層 `GachaPool.rollPack`，重抽到 entries 含 mythic 為止（見本次 session 的 `myth.py` 作法）。
- 「玥玥傳說卡」（`yuelegend`）是使用者輸入錯誤，第十六輪移除。
- 第十六輪已完成（報告 `REPORT-astra-impl-round16.md`，驗收 `python tools/test/clicker-round16.py`，截圖 `_art/out/r16-*.png`）：轉彩（傳說的 30% 偽裝成精良、翻開後掃色帶轉成傳說）、卡冊翻頁改成書頁邊緣的箭頭鍵、展示頁神話星星列彩虹底條拉滿與鍍膜洗白角色的修正。
- 使用者回報「留聲機無法正常購買」：在線上版 Playwright 走完整流程（9 件→點兩下→扣款→放上桌）正常，重現不出來，待使用者說明具體症狀。

- **待決 bug**：深夜冰箱的王打不到（`rooftop` 沒有 `unlock`，`nextScene('fridge')` 拿不到門檻，`canBoss` 永遠 false，`boss-fridge` 徽章不可得）。要使用者決定：冰箱設固定門檻、王勝當終點，或屋頂星空當第七站。
- 流星投遞「本次最高」預告 `WISH_TELEGRAPH` 是使用者要求關掉的，第十六輪誤開已關回（`041aa11`）；派工簡報要列「不要動的旗標」。
- 開發者玩法總覽 `docs/clicker/珍母點點玩法總覽.html`（也發佈成 Claude artifact）。

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
