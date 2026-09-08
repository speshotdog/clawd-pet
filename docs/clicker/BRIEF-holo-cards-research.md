# 派工簡報：華麗卡牌（3D 鐳射／全息）研究與設計

分支：`holo-cards`（從 main 開，main 與 origin 同步、`npm test` 169 例全綠）
角色分工：**這一輪的研究與設計全部由 Codex（gpt-6-astra）負責**，Claude 只負責溝通與轉達。
本輪產出**只有文件，不改任何 src 程式碼**（mode: read_only）。

---

## 一、使用者要什麼

1. **更華麗的卡牌**——現有卡面已經有 hover 傾斜＋鍍膜，但要往「寶可夢閃卡／干脆麵卡」那種
   隨視角流動的 3D 鐳射全息質感走。
2. **之後會接進階轉蛋系統（額外抽卡池）**——這輪不做，但設計時要預留：
   新卡池可能有自己的卡框、自己的閃法、自己的稀有度階。

## 二、使用者提供的參考資料（Claude 已逐一打開查證過）

出處是 X 上的一串討論，原貼與回覆的實際內容如下（不是轉述，是實際打開看到的）：

- **原貼** @everettfish0408（2026-09-07，32.7 萬 views）：開源 skill「3D 镭射卡片生成」，
  `https://github.com/EverettFish/holo-card-studio`
  - 是一個 **Codex skill**。輸入自然語言或參考圖，輸出：互動網頁 ＋ `card.blend` ＋
    四層分層圖（主體／背景／線稿／文字）＋ `card-config.json` ＋ 靜態渲染圖。
  - Pipeline：推規格 → 畫四層圖 → 生文字層 → 資源驗證 → **建 Blender 場景（材質節點、視差、鏡射）**
    → 導出 web 資源 → 起本地服務（**Three.js** 查看器）→ 互動測試。
  - 依賴：Python 3 + Pillow、**Blender**（自動下載便攜版）、Node + npm、**Three.js / WebGL**。
  - 關鍵手法：四層圖在 UV 座標系疊合，各層有獨立深度（主體 0.4、背景 −0.25），
    用視差在空間裡「撐開」；Blender 端與 Three.js 端用**同一組公式**重建材質確保一致。

- **回覆** @itshanrw 指出效果源頭與原理：
  - `https://poke-holo.simey.me/` 與原始碼 `https://github.com/simeydotme/pokemon-cards-css`
    —— **純 CSS**（transforms / gradients / blend-modes / filters）＋ SvelteJS，沒有 shader。
    模擬 Sword & Shield 世代的閃卡箔面。
    ⚠ **授權是 GPL-3.0**。見下方第五節。
  - `https://html.non.io/hydroponics`、`https://html.non.io/tarot`
  - 原理文 `https://zackon.top/ziggy-card/`、`https://zackon.top/posts/building-ziggy-card/`
    （Claude 用 WebFetch 抓這篇回 **403**，需要你自己想辦法讀，或從別的路徑取得原理）

## 三、我們現有的卡片實作（你要改的是這一層）

| 檔 | 內容 |
|---|---|
| `src/gacha-card.js` | `buildCard()` 組 DOM、`buildArt()` 放立繪、`liveStart/liveMove/liveFrame` 的 hover 立體 |
| `src/gacha-card.css` | 426 行，`.face-holo` / `.face-glare` / `.face-sheen` / `.face-embers` / `.card-lift` |
| `src/clicker-album.js` | 卡冊與展示頁 |
| `src/clicker-gacha.js`、`src/gacha.js` | 招募流程、翻牌 |
| `src/card-<id>.png` | 40 張角色卡圖（**單張去背 PNG，高 580，沒有分層**） |

現況重點：

- DOM 結構已是 `.card > .card-glow + .card-lift > .card-inner > (.card-back | .card-face)`，
  `.card-face` 內有 `.face-art / .face-gem / .face-plate / .face-frame / .face-tag / .face-sheen`，
  角色卡另插 `.face-holo` + `.face-glare`（神話插在 `.card-face`，其餘插在 `.face-art` 只蓋畫窗）。
- 已有滑鼠追蹤：`liveMove` 每次寫 `--mx` / `--my`（0..100%）與 `--tilt`（0..1），
  `liveFrame` 每幀對 `.card-lift` 寫 inline `translateY/scale/rotateX/rotateY`，
  阻尼 0.16，游標停住就停 rAF（**本專案規矩：閒置不跑動畫**）。
- 稀有度五階 `common / rare / epic / legendary / mythic`，
  `LIVE_CFG` 給每階不同 tilt/lift/scale/parallax；`.face-holo` 每階不同漸層。
- 立繪有 rig（SVG 角色可動四肢），但**新卡都是 PNG 靜態圖**（`entry.src`），只有整體視差。
- 有 `veiled`／轉彩機制（傳說 30% 偽裝成精良，翻開後掃色帶轉回來）——新效果不能破壞它。
- `.mini`（卡冊縮圖）會關掉大部分特效；`prefers-reduced-motion` 有專門分支。

## 四、硬限制（不可違反，違反就是白做）

1. **前端只有原生 HTML/CSS/JS，沒有打包器、沒有框架。** 全部 `window.XXX = (() => {...})()`
   的 IIFE，`index.html` 直接 `<script src>`。**不能引入 Svelte、不能引入 build step。**
2. **要同時跑在網頁版（gh-pages，Chrome/手機）與 Tauri 桌面版 WebView2。**
3. **不能引入 Blender 或離線 3D 管線當執行期依賴。** holo-card-studio 那套是產「一張」卡的
   工作室流程；我們有 40+ 張卡、之後還會更多，而且要在點擊遊戲裡即時渲染。
   → **你要判斷**：那套四層視差的「原理」值不值得借（例如離線把每張卡拆成 2~3 層 PNG，
   執行期用 CSS 3D 視差疊起來），還是純 CSS 箔面就夠。**這個取捨請你評估後給建議，不要兩個都寫。**
4. **效能**：這是掛機點擊遊戲，主畫面 1Hz 結算＋粒子已經在跑。卡冊一次會出現十幾張卡。
   任何「每幀對所有卡做事」的方案要先算成本。手機也要能跑。
5. **不要動的旗標**（歷輪血淚）：`WISH_TELEGRAPH=false`、切入的 `T`／`EASE`、
   點空白關面板、卡冊翻頁箭頭、轉彩 30%、神話 0.5%。
6. `prefers-reduced-motion` 下要有可用的降級（**注意：降級是減少位移，不是把資訊拿掉**）。

## 五、授權：這是真的風險，請正面處理

- `simeydotme/pokemon-cards-css` 是 **GPL-3.0**。
- 我們的 repo `speshotdog/clawd-pet` 是 **public**（gh-pages 有線上版），`package.json` 標 `private: true`
  但沒有 LICENSE 檔。
- → **不可以把它的 CSS / 素材複製貼上進來。** 可以讀它、理解原理、用自己的話重寫實作。
- → `holo-card-studio` 的授權請你自己去 repo 讀 LICENSE 檔確認後寫進報告。
- → 它 README 提到的 holo 貼圖（DeviantArt 的 aschefield101 Galaxy Holo、Vecteezy 背景）
  **是第三方素材，授權要各自查**。我們要用的箔面貼圖建議自己生或程式產。
- 報告裡請明確寫出「哪些能抄、哪些只能學、哪些要自己做」。

## 六、要你交付什麼

寫成 **`docs/clicker/DESIGN-holo-cards.md`**（繁體中文，可以長），內容：

1. **原理拆解**：鐳射／全息閃卡在 web 上到底由哪幾層構成，每層的數學（角度→漸層位置、
   blend-mode 疊法、chromatic aberration、glitter 取樣、mask）。要具體到能照著寫程式的程度。
2. **方案評估**：至少三個候選（純 CSS 箔面升級／CSS 3D 多層視差／WebGL shader），
   對照第四節的硬限制與效能，**給一個明確推薦**，並說為什麼淘汰另外兩個。
3. **套進我們現有結構的具體做法**：要新增哪些 DOM 層、哪些 CSS 變數、
   `liveFrame` 要多寫哪些值、`buildCard` 要改哪幾行。用 diff 或程式片段示意（**但不要真的改檔**）。
4. **五個稀有度的差異化設計**：common→mythic 每階的招牌閃法（現在只是漸層色不同，太弱）。
   神話要有「一看就知道是神話」的辨識度。
5. **預留給進階轉蛋（額外抽卡池）**：卡框／閃法怎麼資料驅動，
   之後新增一個卡池要改幾個地方（目標是只加資料不改渲染程式）。
6. **素材需求清單**：需要幾張箔面／glitter 貼圖、尺寸、怎麼產（能程式產就別生圖）。
   ⚠ 本專案 imagegen 畫中文會出錯字，任何要帶字的素材一律「無字底圖＋DOM 疊字」。
7. **分輪實作計畫**：拆成可獨立驗收的小輪，每輪列驗收方式。
8. **風險與已知坑**：包含效能、行動裝置、WebView2 差異、與 `veiled`／轉彩／`.mini` 的相容。

## 七、驗證與規矩

- 本輪 **read_only，不要改 `src/`**。只寫 `docs/clicker/DESIGN-holo-cards.md`。
- 你可以（也應該）實際打開第二節的網址去讀原始碼與原理，不要憑印象寫。
- 講「現有程式怎樣」之前先實際讀檔，不要根據本簡報的摘要推測。
- 不確定的地方標成「待使用者定案」，不要自己發明規則。

---

## 八、使用者定案（2026-09-08 下午，補在第一次派工失敗之後）

第一次派工時 Codex 用量額度用完、一步都沒跑，這輪重派。同時使用者對第六節第 2 項
（方案評估）給了明確方向，**取代**原本「三選一給推薦」的要求：

1. **景深與箔面兩個都要做。** 不是二選一。
   - 「景深」＝角色浮出來、背景／卡框往後退，隨視角視差移動。
   - 「箔面」＝平面上的鐳射流光要比現在兇很多。
   兩層要能疊在同一張卡上。
2. **驗收標準是「跟展示的效果一樣」**——目標品質對標 `https://poke-holo.simey.me/`
   的實際手感（箔面隨角度流動、光斑、質地顆粒、翻卡）。
   所以第六節第 2 項改成：**不要再問要不要做，改成評估「怎麼在我們的限制下做到那個品質」**；
   三個候選方案改為評估「哪一個（或哪幾個組合）能達到對標品質」，仍然要給明確推薦與淘汰理由。
3. **這條分支只做新功能。** 工作區裡 `src/clicker-stage.js` 與 `tools/test/clicker-round26.py`
   的未提交變更（reduced-motion 浮字修正）**是別的專案正在處理的，不要動它們、不要 commit 它們、
   也不要把它們寫進報告**。

### 一個你評估時該注意的既有優勢

我們的卡面**天生就已經是分層 DOM**：`.face-art`（立繪，獨立元素）與
`.face-frame` / `.face-plate` / `.face-gem`（卡框與銘牌）本來就是不同節點，
`.card-lift` 已經是 `transform-style: preserve-3d`。
也就是說**景深不一定需要重新產分層素材**——把既有節點沿 Z 軸推開可能就有了。
請實際讀程式確認這條路可不可行，並跟「離線把 40 張卡拆成多層 PNG」比較成本後給建議。

---

## 九、測試素材（使用者提供，2026-09-08 15:18）

`C:\Users\ASUS User VII\Desktop\新卡\3.0\`（**在桌面，不在 repo 裡**）：

| 檔 | 尺寸 | 內容 | 用途 |
|---|---|---|---|
| `5.png` | 1748×1240 RGBA | 太空場景，**裡面有三個角色**（見下） | 使用者指定：拆成三張卡來測 |
| `2.png` | 1051×685 RGBA | 室內場景：白色捲毛狗＋飯碗＋矮桌 | 測試素材 |
| `滅世珍獸 神話.png` | 1051×685 RGBA | 已入庫角色的原圖 | 對照 |
| `青花膠 神話.png` | 1027×1980 RGBA | 已入庫角色的原圖 | 對照 |

`5.png` 裡的三個角色（Claude 實際看過圖）：
1. **火箭狗**——畫面中央，白色捲毛狗頭接在白紅色火箭上，尾焰橘黃，正在起飛。
2. **太空人狗**——右側，深棕色小狗穿白色太空衣、戴圓形頭盔，靠著地球，有繩子連著火箭。
3. **粉紅外星貓**——左下，粉色帶觸角的小生物趴在紫色土星環行星上。

### ⚠ 這批素材跟現有 40 張卡本質上不同，是本輪設計的關鍵

現有 `src/card-<id>.png` 是**單一角色去背圖**（高 580），貼在卡框的畫窗裡。
這批 3.0 是**完整場景圖**：有星空／房間背景、有中景行星／家具、有前景主體。

也就是說它們**天生就有景深素材**：背景（星空＋遠處行星）、中景（土星、地球）、前景（主體角色）
可以離線切成 2~3 層，執行期沿 Z 軸推開做視差——這正好是 holo-card-studio 那套四層視差的原理，
但不需要 Blender。

請在設計裡回答：
- 新卡要走「滿版場景卡」（整張圖鋪滿卡面、有景深）還是沿用現有「畫窗＋卡框」？兩種能不能共存？
- 拆層要人工還是能程式做（現有 `_art/cardcut.py` 只做去背，不做分層）？
- 一張場景圖拆出三個角色當三張卡時，**每張卡的背景要各自從原圖裁哪一塊**？
- 舊的 40 張單層卡在新的景深系統下怎麼降級（不能只有新卡好看，舊卡變醜）。
