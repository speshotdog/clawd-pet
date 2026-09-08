# 華麗卡牌：景深與全息箔面研究設計

研究日期：2026-09-08。依據 [BRIEF-holo-cards-research.md](BRIEF-holo-cards-research.md)，**第八節優先於前文**。本輪只交付這份設計，沒有實作、產製素材或變更現有檔案。

## 1. 結論與定案邊界

**推薦「既有 DOM 的 CSS 3D 景深＋自行實作的多層 CSS 箔面」共同運作。** 角色、背景、框與名牌有相對深度；同時讓箔面的光譜、光斑、壓紋及顆粒隨觀看方向變化。兩者都是必要交付，不能把任何一者列為日後選配。

品質標準維持使用者原話：**「跟 poke-holo.simey.me 展示的效果一樣」**。CSS 路線有直接的技術可行性證據，因為該參考的核心材質本來就是 CSS；但「有彩虹＋會傾斜」不等於達標。必須在同尺寸、同輸入軌跡下比對材質紋理、明暗反轉、光斑、回彈及翻面，再由使用者驗收。角色浮出則是本專案額外要求，不能拿參考主要呈現平面箔材當作省略景深的理由。

本文件的狀態用語：

- **已定案**：景深與箔面並存、品質對標、原生 HTML/CSS/JS、無框架與打包器、無 Blender 依賴、手機與 Tauri WebView2、多卡效能、閒置不持續跑動畫。
- **推薦設計／初始調校值**：本文的層距、閃法命名、材質參數及效能預算，用於下一輪做出可比較的樣品；不是自行增加的產品規則。
- **待使用者定案**：實際參考卡組、五階美術樣品、觸控操作細節、滿版場景拆圖的美術處理、最低驗收裝置、未來卡池業務規則。集中列於第 11 節。

### 1.1 本輪查證範圍與限制

動筆前已完整讀取 `src/gacha-card.js`、`src/gacha-card.css`、`src/clicker-album.js`、`src/gacha.js`。另沿呼叫關係檢查 `gacha-pool.js`、`clicker.js`、`clicker-gacha.js`、`clicker.css` 的相關段落與 `package.json`，並讀取 40 張 `card-*.png` 的尺寸、alpha 資訊及兩張 `bleed` 圖的實際畫面。

五個指定網址均已實際請求：兩個 GitHub repo、Ziggy 原理文與 Tarot 的 HTML／相關原始碼成功取得。Pokémon 展示網址能由網頁讀取工具開啟，但抽出的正文為空；其 repo 原始碼已實讀。另嘗試開啟互動瀏覽器時，權限審查拒絕該展示頁存取，回報該次請求未獲允許，故未進行繞路操作。**本輪沒有完成展示的即時拖曳／視覺比對，也沒有量測本專案新效果的 FPS；以下不把原始碼推論寫成已實測達標。**

## 2. 研究來源：實際做法與可借用原理

### 2.1 Pokémon Cards CSS：箔材品質的主要對標

已讀 [展示入口](https://poke-holo.simey.me/)、[repo](https://github.com/simeydotme/pokemon-cards-css) 與下列原始碼。研究時 `main` 為 `acb1197633e749a1fba4412231db2f6581586d00`；引用固定版本，避免後續分支變動混淆。

| 實讀檔案 | 觀察與對本案的意義 |
|---|---|
| [Card.svelte](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/src/lib/components/Card.svelte) | 指標正規化後分別驅動旋轉、glare、background 的 spring；背景位移範圍與光斑不同；批次處理指標更新，只有當前 active card 接受互動。Svelte 是狀態組織方式，並不是箔面所需的繪圖引擎。 |
| [base.css](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/public/css/cards/base.css) | front image、shine、glare 分工；shine 有額外偽元素與 mask；使用 blend/filter。旋轉容器的註解也指出 overflow/isolation 與背面可見性的衝突。 |
| [regular-holo.css](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/public/css/cards/regular-holo.css) | 光譜、細掃描紋與不同方向／速度的亮暗柱分層，另以徑向明暗調節；不是把單一彩虹透明疊上去。 |
| [rainbow-holo.css](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/public/css/cards/rainbow-holo.css) | glitter、光譜、圖樣及光斑各有合成方式；用觀看位置改變亮度、背景位置及層透明度。 |
| [cosmos-holo.css](https://github.com/simeydotme/pokemon-cards-css/blob/acb1197633e749a1fba4412231db2f6581586d00/public/css/cards/cosmos-holo.css) | 多張宇宙紋理與光譜共同混合，以不同比例映射輸入。可學「固定紋理在角度改變時分區亮起」，不能搬它的第三方貼圖。 |

本案採用上述材質分工與輸入一致性的概念，自行建立幾何、公式及紋理。沒有把 Svelte 元件翻譯成 JS，也不逐條改名移植其 CSS。色散邊是本文提出的額外細節，不能誤稱為所有參考卡共有的獨立 RGB 效果。

### 2.2 Holo Card Studio：值得借的是分層取樣，不是整套製作流程

已讀 [repo](https://github.com/EverettFish/holo-card-studio)、[app.js](https://github.com/EverettFish/holo-card-studio/blob/b470957e0dea681eadc05e467a57bdc84b702333/assets/web-template/app.js)、[build_card.py](https://github.com/EverettFish/holo-card-studio/blob/b470957e0dea681eadc05e467a57bdc84b702333/scripts/build_card.py) 與 [設定範例](https://github.com/EverettFish/holo-card-studio/blob/b470957e0dea681eadc05e467a57bdc84b702333/references/config.example.json)。研究版本為 `b470957e0dea681eadc05e467a57bdc84b702333`。

Web shader 以局部視線的 XY/Z 比例、深度及縮放偏移 UV，對掠射角分母設下限；主體 alpha 合成至背景，再加線稿、文字、箔色與星光。**四份素材不代表瀏覽器中四張真正沿 Z 分開的卡圖平面**；重要景深來自材質內取樣位移。Blender 端也建立對應的視差節點，但同類公式不保證兩個渲染器逐像素一致。

實碼有 `uTime` 閃爍、`setAnimationLoop`、bloom 與 GLTF 模型載入，不能原封搬入本案。可借「主體與背景取樣方向相反、文字保持穩定」；現有 PNG＋DOM 背景已提供大部分所需分離，無需先替 40 張卡建立 Blender 工程。

### 2.3 Ziggy：材質區域要有不同反射性

[Building Ziggy Card 原理文](https://zackon.top/posts/building-ziggy-card/) 本次成功讀取，沒有沿用簡報所述的 403 結果。文章實作採 React Three Fiber／Three.js，擴充實體材質；箔面資格 mask、白墨遮蔽、roughness、normal、光譜與顆粒協作。觀看反射方向投影到表面切線，驅動色相；角速度也參與亮度。這支持本案「同一平滑角度驅動材質、保護印刷文字與主體」的設計。

本文只借這些概念，不移植文章 shader 範例，不假設文章展示的所有材質效果都能由 CSS 精確重現；其 PBR 光源、反射環境與實體卡邊不是本案選用的執行期。

### 2.4 Tarot：原生 WebGL 可行，但不是免費的 CSS 升級

已取得 [Tarot 頁面](https://html.non.io/tarot/)、[card.js](https://html.non.io/tarot/js/card.js?v=2)、[device-tilt.js](https://html.non.io/tarot/js/device-tilt.js) 與 [style.css](https://html.non.io/tarot/css/style.css?v=2)。HTTP 初次取原始 HTML 為 403，正常瀏覽器 User-Agent 的 HTTP 請求取得 HTML，再沿其中宣告的網址讀碼。

其 IIFE 在正、反面圖片上各建 WebGL2 canvas；diffuse／normal／roughness／height 四組圖控制金色高光與微小逐像素視差。DOM 負責旋轉／飛入翻面，GL 負責光照；圖片保留為 GL 不可用時的退路。這是「無框架也能做 shader」的證據，不能以無打包器直接判它不可能。

但它的姿態更新持續請求 rAF 並有 idle sway；GL 雖以 `needsDraw` 避免每次重畫，仍排下一個 rAF。雙 canvas／每卡四組材質圖也不適合直接放大成卡冊。感測器權限與觸控退路可作參考，不在本案預設啟用陀螺儀。

## 3. 現有程式的真實接點與限制

### 3.1 DOM、樣式覆蓋與素材

目前 `buildCard()`（`gacha-card.js:72` 起）的結構為：

```text
.card                     宿主定位、收卡／飛出、稀有度 class
├─ .card-glow             卡外光暈
└─ .card-lift             live 傾斜／抬起
   └─ .card-inner         翻面 rotateY(180deg)
      ├─ .card-back
      └─ .card-face       本身預先 rotateY(180deg)
         ├─ .face-art    背景、floor、img/svg/emoji、箔面等
         ├─ .face-gem
         ├─ .face-plate  名稱與稀有度
         ├─ .face-frame
         ├─ .face-tag    宿主標籤
         └─ .face-sheen  揭曉掃光
```

`buildArt()` 回傳 PNG、SVG、玩具圖片或 emoji；角色 PNG 仍是單張媒體。`.card-lift` 與 `.card-inner` 已有 `preserve-3d`，但 `.card-face`／`.face-art` 有 `overflow:hidden`，`.skin-af .face-art` 還有 `isolation:isolate`。因此現有「分節點」不等於已建立完整 3D 景深。

基礎 CSS 的 epic／legendary 彩虹規則之後，`.skin-af` 會把 `.face-holo` 改回單道亮帶及 `screen`，且透明度很低。只改前段漸層會被後段蓋過。神話在檔案尾另有更高優先序，包含常駐 `mythic-spin`、縮圖重新開啟 holo，以及將畫窗排除的 `mask-composite:exclude`；**目前神話箔面並非均勻覆蓋角色本身**。

素材實查為 40 張 PNG，尺寸並非一律高 580；例如 `card-yangpu.png` 是 325×354、`card-yueyuexian.png` 是 595×603。共有兩筆 `bleed:true`：

| 卡 | 實檢結果 | 景深處理 |
|---|---|---|
| `mieshi`／滅世珍獸 | 509×580，alpha 全 255，角色、城市、光束都畫在一張圖內 | 整張圖浮起只能得到「畫片浮起」。角色相對城市浮出的完整版本需要主體遮罩／去背與補背景。 |
| `wanwumythic`／玩物就玩物 | 509×580，alpha 有 0 與 255；實際為有透明外圍的角色與手 | 可沿用 PNG 整體作前景；`bleed` 是 cover 排版選擇，不能據此誤判完全不透明，也不能讓手和角色自行拆動。 |

推薦先用既有 DOM 處理可分離素材；針對滅世珍獸提出獨立拆圖工作，**不能用整幅平移宣稱已滿足該卡的角色／背景相對景深**。其分割邊界與補畫內容待使用者定案。

### 3.2 控制器、顯示稀有度與生命週期

`liveMove()`（165 起）讀 `.card` 的 rect，立即寫 `--mx/--my`，設定角度目標；`liveFrame()`（180 起）以 0.16 阻尼更新 `.card-lift`，寫 `--tilt`。所以光斑與 PNG 的 `nx/ny` 視差目前比卡面旋轉更直接，沒有完全同步。rAF 在角差小於 0.05 度、入場動作完畢時停止；`liveEnd()` 取消 rAF、移除 inline transform 與 `--tilt`，但沒有清除 `--mx/--my`。

`buildCard()` 的 `shown` 由 `GachaPool.shownRarity({entry, veil})` 計算；`unveil()` 在原本的 210ms 中點改 class／標籤，再等待 210ms。現在 DOM 特效插入位置及 embers 數量仍讀真實 `entry.rarity`。新材質不能另從真實稀有度提前洩露偽裝。

另一個接線問題：卡冊 `makeCard()` 把 `E.rarity(s,id)` 覆寫後傳入 `card.create()`，但 `liveStart()` 的 entry 來自事件處理器重新查詢 `byId[dataset.entry]`，會回到原始稀有度。**必須把每個卡節點建立時的顯示資料保留到 hover／材質解析**，不能只替 `LIVE_CFG` 加五套數值。

### 3.3 三種卡面宿主不可混為一談

| 宿主 | 實際狀態 | 設計接法 |
|---|---|---|
| 招募／抽卡演示 | 外層 `.card` 由 runtime／宿主定位，`.card-inner` 翻面；`canHover()` 管演出鎖 | 材質只處理自己的層與輸入，不覆寫發牌、揭曉或收卡 transform。 |
| Clicker 卡冊 | `PER_PAGE=4`，左右頁共 8 張；`.album-slot` 是 button，卡片 `pointer-events:none`，CSS 明確關掉紙上卡的 tilt | 預設沿用紙上靜態卡、點擊開大卡；仍保留可辨識的靜態箔紋與深度陰影。不要為了 hover 改壞按鈕和翻頁。 |
| Clicker 展示大卡 | `.detail-card` 有 `scale(1.15)`、入場 WAAPI；`clicker.js` 以 detailId 放行 hover | 主要景深與箔面品質驗收位置。保留外層入場動畫的所有權。 |
| 演示區圖鑑 `.mini` | `gacha.js::renderAlbum()` 一次建立各稀有度卡；`.mini.locked` 決定能否 hover | 與 `.album-slot` 分開設定密度；不以 `.mini` 規則推論 Clicker 卡冊。 |

「一次十幾張」保留為壓力測試要求：實際跨頁 8 張不表示只需測 8 張；另測 16 張同屏及圖鑑全目錄。現有 `.album-card.awakened .face-sheen`、神話卡 `--spin` 有無限 CSS 動畫，故 **rAF 停止不代表卡面閒置**。新材質啟用範圍須把這些呈現改為靜態或有限次效果；這是遵守卡面功能硬限制的整合項，不改養成規則。

## 4. 候選方案與明確推薦

| 方案 | 景深＋箔面能否完整交付 | 硬限制與成本 | 決定 |
|---|---|---|---|
| A. 單一平面純 CSS 箔面升級 | 箔面能對標；既有幾像素立繪平移不足以交代前後層次 | 原生、零打包，素材與維護成本最低；gradient/filter 仍可能重繪 | **淘汰其作為完整方案**，保留為 B 的材質部分。只交 A 違反第八節。 |
| B. CSS 3D 多層 DOM＋A 箔材 | 角色／背景／框有幾何層次；每個印刷面有角度驅動的箔材 | 原生 JS/CSS 可落地；沿用 40 張 PNG，主要工作是裁切／合成邊界、生命週期、樣式整合 | **唯一推薦的產品路線**。先在大卡證明深度與混色可共存，再擴及其他宿主。 |
| C. 原生 WebGL shader＋DOM 文字 | 可同時做 UV 景深與微表面材質，控制力最高 | 不必引進框架，但要自建 renderer、材質設定、context loss、圖像解碼／GPU 釋放及 DOM 對位；卡冊須單一共享 canvas/scissor 或只畫當前大卡 | **本案淘汰為首輪產品路線**。參考的核心箔面不需要此成本；保留為 B 實測確定無法滿足品質時重新評估的技術後備，不是宣稱手機跑不了 WebGL。 |
| D. 逐卡四層 PNG＋Blender／Three.js 工作室流程 | 理論上可達成，但必須重建／維護大量美術與離線工程 | 工作室流程依賴 Blender 與模型匯出；每張多份素材及製作成本，不符本案限制 | **淘汰整套導入**；只借視差與安全取樣概念。 |

CSS 3D **單獨使用**也不及格：幾張 PNG 撐開只解決空間，沒有箔材質地。選 B 的理由是 A 與 B 互補，不是把兩個半成品各列成選配。

### 4.1 既有 DOM 對比逐卡拆圖

採 B 時，去背 PNG 已是前景，CSS 畫窗底與框本來可獨立。共用程式調整一次即可覆蓋大部分卡，PNG 不必新增背景／文字層。真正需要的是「背景從 `.face-art` 搬出來」及各層合成方式。

若 40 張都產 2～3 張新 PNG，會增加最多約 80～120 張檔案、遮擋補畫、對位及逐卡 QA；把原來去背主體再切頭、身、手，也可能產生接縫與錯誤動作。這些不是本次景深需求的必要成本。推薦只對**圖內原本混在一起、又需相對移動的場景**製作必要分層；本輪已確認的例子是滅世珍獸。將來 `art.layers` 可接受更多前景層，並不要求每張都填。

## 5. 可實作的幾何與材質規格

以下公式為本案獨立設計的起始規格，參數須經對標調校。所稱「景深」是多平面視差，不做鏡頭失焦模糊，不模糊角色或文字。

### 5.1 指標、角度與阻尼共用一份狀態

先由不受 live 傾斜影響的命中區取得局部座標：

```text
u = clamp((pointerX - rect.left) / rect.width, 0, 1)
v = clamp((pointerY - rect.top) / rect.height, 0, 1)
targetX = 2u - 1                    // 左 -1，右 +1
targetY = 2v - 1                    // 上 -1，下 +1
alpha(dt) = 1 - (1 - 0.16)^(dt / (1000/60))
sx += (targetX - sx) * alpha
sy += (targetY - sy) * alpha
rx = -sy * tiltLimit                // 度
ry =  sx * tiltLimit
d = min(1, hypot(sx, sy))
```

沿用 60Hz 時原本 0.16 的手感，使用時間補償避免 120Hz 裝置反應變快；切回可見時重設時間，dt 上限初設 50ms。縮圖與 detail 的倍率納入命中區大小，不能直接使用原始 150×210 當 client 座標。

`.card-lift`、箔材光斑、紋理相位、陰影都由同一個 `sx/sy` 推導；不再 pointermove 直接寫漸層，而旋轉慢慢追上。讀 rect 放在 liveStart／resize／scroll／宿主 zoom 變更；指標事件只存最新目標，每個 rAF 批次寫值。扇形卡有外層 rotateZ，起始實作可快取宿主已知旋轉並逆轉輸入；若存在一般矩陣變換，須做局部平面座標換算，不能把旋轉後 bounding box 當精確 UV。此差異必須在扇形左右端卡實測。

收斂同時檢查 sx、sy、回正的 active 強度及有限入場動作；角差容許沿用約 0.05 度，最後寫到精確目標再停 rAF。指標離開設回正目標，跑有限段收斂；關閉面板、失焦、隱藏、DOM 移除則立即取消並清乾淨。不能用永遠排 rAF、裡面 `if (!dirty) return` 假裝零閒置。

### 5.2 3D 空間：把需要隔離的材料做成葉節點

推薦結構是兩層分工：**3D 骨架不做裁切／混色／filter；各深度的平面內自行裁切並合成箔材。** CSS 的 `overflow:hidden`、`isolation:isolate`、非 normal blend、filter、mask、opacity 小於 1 等會要求合成群組扁平化；不能放在承載多個 Z 層的節點上。依據 [CSS Transforms 2：Grouping property values](https://drafts.csswg.org/css-transforms-2/#grouping-property-values)。葉節點內的扁平化則是刻意的：先得到一張帶箔的印刷面，再讓整面處於不同 Z。

以 150×210 卡座標為例，初始層距如下；正面局部 +Z 朝觀看者。背景／框「後退」指相對角色退後，不必把背景放到不透明底板後方：

| 平面 | 初始局部 Z | 工作 |
|---|---:|---|
| 底板 | 0px | 不透明卡紙底、圓角與陰影 |
| 畫窗背景 | 2px | 原 CSS 背景、floor、背景箔與粒紋 |
| 卡框／名牌 | 6px | 原框形、靜態稀有度特徵；文字不參與強混色 |
| gem／tag | 7px | 保留各自 rotate／scale 動畫 |
| 角色 | 12～28px | 按五階調校；角色及其箔材在同一葉平面 |

外層 `.card` 保持宿主 transform；在 `.card-lift` 的 transform 最前方加入 `perspective(P)`，為整張卡建立本地視角，初始 P=800px。`.card-inner` 保持既有翻面；`.card-face` 保持預轉 180 度並開 `preserve-3d`。不要只在 `.card-lift` 設 perspective 屬性卻期待它影響自己的旋轉。需一併檢查既有 `.cards{perspective:1400px}`，避免兩層投影不經意相乘；採本地投影後應讓本功能卡外部投影不再參與同一段 3D 鏈，並實测位置不跳動。

幾何估算：先套 Y、再 X 旋轉（對應 `rotateX(rx) rotateY(ry)` 的矩陣順序），最後投影。

```text
x1 = x*cos(ry) + z*sin(ry)
z1 = -x*sin(ry) + z*cos(ry)
y2 = y*cos(rx) - z1*sin(rx)
z2 = y*sin(rx) + z1*cos(rx)
screenX = P*x1/(P-z2)
screenY = P*y2/(P-z2)
```

公式三角函數用弧度。差 24px 的兩平面在 8° 橫傾時有約 3.3px 的幾何橫向差，再疊最多約 1～2px 的可調 2D 視差便足以讓原尺寸卡面分層。以 P=800、z=28 計，正視放大約 1.036；如需保持既有主體大小，可對該平面加 `(P-z)/P` 的基準補償，實測後存進 preset。不要只靠大幅 `scale()` 把人物擠出圖窗。

本地前後各面與可見的葉平面都設 `backface-visibility:hidden`，保留卡背與正面之間極小偏移以防共面閃爍。翻至側面不能看到角色的鏡像或飄到卡背外。角色超出**外卡邊界**的幅度尚未定案；初始樣品限定在安全區內，透過層距和陰影呈現「浮出」，不擅自改成角色飛出卡框的玩法。

### 5.3 光譜相位：角度決定流光，不是時間決定

抽象模型：對畫面局部座標 q=(x,y)，令光譜方向向量 `a=(cos θ,sin θ)`，則色相相位為：

```text
phase(q) = frequency * dot(q,a) + kx*sx + ky*sy + phaseSeed
rgb = palette(fract(phase(q)))
```

CSS 用多個色標的 repeating/linear gradient 近似 palette。背景放大至 260%×260% 作位移空間；光譜一層初始使用：

```text
foilX = 50 - 26*sx + 10*sy          // %
foilY = 50 + 16*sy                  // %
crossX = 50 + 20*sx + 8*sy          // 第二道紋，反方向
crossY = 50 - 24*sy
glareX = 50 + 42*sx                // 光斑跟觀看方向
glareY = 50 + 42*sy
```

CSS `background-position` 的百分比不是移動圖片同等百分比：像素 offset 為 `(容器尺寸-背景繪製尺寸)*百分比`。260% 背景沿 X 改變 26 個百分點，在 130px 畫窗上約移 54px；這才會有明顯材質流動。不要把 `--mx` 同時當作光斑座標、角度與每張背景的位移值。

第二道逆向細紋與第一道主光譜產生不同的亮暗區；兩者角度及空間頻率也分開。靜止時只保留固定相位和適量材質，不加 `time`、不讓漸層自己輪播。若要揭曉一掃，只接既有有限揭曉狀態。

### 5.4 混色順序、明暗與文字保護

每個印刷葉平面內，底到頂的順序是：底圖 → 箔色與壓紋 → 局部 glitter → 寬柔光斑／小亮心。框另有自己的材質，名牌文字以正常不透明 DOM 疊在其上。

`background-blend-mode` 混合同一元素的背景圖片；`mix-blend-mode` 則與元素背後的已合成內容混合，兩者不是互換開關。RGB 通道 B、S 正規化到 0～1，主要模式依 [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/#blending)：

```text
multiply(B,S) = B*S
screen(B,S) = 1-(1-B)*(1-S)
overlay(B,S) = B<=0.5 ? 2*B*S : 1-2*(1-B)*(1-S)
colorDodge(B,S): B==0 → 0；否則 S==1 → 1；其餘 min(1,B/(1-S))
```

對不透明底，覆蓋後可理解為 `(1-opacity)*B + opacity*Blend(B,S)`；半透明角色要由瀏覽器做完整 alpha 合成，不套錯不透明簡式。`color-dodge` 在亮角色上容易爆白、在全黑底不會憑空點亮，所以只靠提高它的 opacity 無法得到質地。

本案調校起點：光譜與灰階壓紋先 `overlay`；合成結果以 `color-dodge` 局部提亮，必要時對偏白角色降低箔強度；glare 用低透明度 `screen`。箔色層可用固定 `brightness(.8) contrast(1.6)` 起步，避免每幀改 filter。角色白區、眼睛及名字不應長時間變成白板。

局部葉平面使用 `isolation:isolate`，因此 glitter 不會和整個卡冊／遊戲背景混色。主體葉的箔層必須套主體 alpha，否則透明區會變成浮在空中的長方形光片。框箔與角色箔分別合成；不要再把一個整卡 color-dodge 蓋到名牌上。

隔離邊界必須包含「底圖＋效果」：例如隔離 `.face-art`，讓其中的 `.foil-stack` 與同群組的 img 混色。若 stack 因 mask 先形成一張合成影像，應把對底圖的 `mix-blend-mode` 設在 stack 根上；不能只在空的隔離 stack 內對子層設 dodge，卻期待它穿出群組看到 img。需要不同混色的 glare 可做同葉平面的兄弟元素，套同一材料 mask；跨 Z 的骨架仍不隔離。

### 5.5 光斑模型

局部像素 q 距光斑中心 g 的距離，以橢圓半徑正規化：

```text
r = hypot((qx-gx)/radiusX, (qy-gy)/radiusY)
wide = max(0,1-r)^2
core = max(0,1-r/0.28)^4
intensity = base + edgeGain*d
```

CSS 使用兩個徑向漸層近似 wide/core。亮心窄、外緣漸淡，另一低強度暗帶增加箔面起伏；不是將整張底色同時提高亮度。初始 glare opacity 約 0.12～0.32，依材質及主體曝光調整；確切上限待樣品對比。光斑圓心由 `sx/sy` 平滑更新，與箔纹相位使用不同映射，但轉向不能無因跳動。

### 5.6 Glitter：固定粒子、角度選光

不用每粒一個 DOM，也不每幀亂數。離線以固定 seed 生成一張 512×512 可平鋪灰階粒紋，以及一張 1024×1024 的四象限 glitter atlas（每象限 512×512）。四個象限使用**相同位置的顆粒**，但依四組微表面方向有不同亮度；顆粒不因換角度瞬移。

生成概念：每個粒子保存位置、半徑與微法線 `nj`；四個樣本半向量 `Hk` 分別對應四種斜視方向，`brightness(j,k)=max(dot(nj,Hk),0)^p`，p 起設 24～64。用固定 seed 的分格抖動分布避免規則網格，少量較大晶粒與較多細粒混合，邊緣作周期環繞。輸出到 alpha，不使用會被誤解為不透明遮罩的純黑底。

執行期把 `atan2(sy,sx)` 映射到四組樣本，取相鄰兩組循環插值：

```text
t = wrap01((atan2(sy,sx)+PI)/(2*PI))*4
i0 = floor(t) % 4；i1 = (i0+1)%4；f = t-floor(t)
weight0 = gain*d*(1-f)
weight1 = gain*d*f
```

只需 `.foil-grain::before/::after` 兩個取樣面；每面用 atlas 的一格 alpha 作 mask。`mask-size:200% 200%`，四格 `mask-position` 為 0/100% 的四個角。切格索引變時更新位置，幀間只更新兩個透明度。光斑用 CSS gradient 填色，使亮粒集中在入射區。`d` 接近零時把方向選擇保持前值、權重趨零，中心不抖；另保留低強度靜態粒紋，正視也看得出印刷質地。

四方向插值只是便宜近似，不保證達到連續微法線 shader 的精度。若對標出現「整批亮／滅」的可見分段，先增加 atlas 角度樣本或改善粒法線分布，再實測貼圖成本；不能隱藏缺陷後宣稱同品質。粒子頂層仍受主體／畫窗／框的材料區域遮罩裁切。放大時能見顆粒，縮小時不出現摩爾紋或噪點閃爍。

### 5.7 Chromatic aberration 與 mask

色散只用於史詩以上的箔紋亮邊，**不複製整張角色或中文文字做 RGB 錯位**。以同一份箔紋 alpha E 取兩個小偏移樣本，青與洋紅各一份：

```text
delta = min(deltaMax, gain*d)         // 初始 deltaMax=0.45 CSS px
edgeCyan(q) = E(q - delta*(sx,sy))
edgeMagenta(q) = E(q + delta*(sx,sy))
```

可放在框箔的兩個偽元素，`screen` 疊合；不能與同一組 grain 偽元素搶用。若多卡成本超預算，先限於大卡與最高兩階。縮圖／reduced-motion 移除偏移但保留正常彩色箔紋，資訊不消失。

材料遮罩 M 與粒紋 E 的概念是 `finalAlpha=M*E*opacity`。CSS 以外層材料 mask、內層 atlas mask 的巢狀葉群組實現交集，避免不同瀏覽器 `mask-composite`／`-webkit-mask-composite` 運算名稱與順序差異。每個群組都是單一 Z 平面，不破壞跨平面景深。

角色 PNG 的 mask 使用原檔 alpha，mask 的 fit、position、縮放必須與圖片完全相同。`object-fit:contain` 的實際繪圖矩形是：`s=min(boxW/imgW,boxH/imgH)`，左右／上下留白各為差值的一半；`cover` 改用 max。把此繪圖矩形在 decode／resize 時算一次寫入 CSS 變數；不可直接用整個 face-art 的 84% 當所有長寬比的遮罩尺寸。局部入場壓縮若只加到 img 而沒加到 mask，會露邊；新控制器應讓媒體與其材料遮罩共用同一個 2D 動作變數。

框的 mask 以自製 SVG 幾何／CSS 四邊區塊構成；名牌洞的位置來自版型資料。若需保護圖內眼睛等區域，單靠 PNG alpha 無法推知，應提供美術審核過的 mask；未提供時維持保守主體箔強度，不自行推算五官遮罩。SVG 舊角色／emoji 沒有現成 PNG alpha 時，先把主要箔面放背景與框，避免複製 rig 的 ID；角色仍有真景深。

## 6. 套入現有程式：只示意，不是本輪修改

### 6.1 DOM 與 transform 所有權

推薦新增 `.face-depth-bg`、每平面共用的 `.foil-stack`、按 preset 需要的 `.foil-grain`，並把角色材料留在 `.face-art` 這個葉平面。保留既有 `.face-art > img/svg/emoji` 直接子節點，減少 rig／鎖卡／PNG 排版 selector 的破壞。

```text
.card-face                       3D 骨架：透明、overflow visible
├─ .face-stock                   底板葉：圓角、不透明背景、原陰影
├─ .face-depth-bg                背景葉：原畫窗背景＋floor
│  └─ .foil-stack                葉內隔離合成，含 holo/glare/grain
├─ .face-art                     主體葉：透明底、保留 media 直接子節點
│  ├─ img / svg / .emoji
│  ├─ .foil-stack.subject-mask   主體材料，與 media 的 2D 動作一致
│  └─ .face-embers               保留有限入場版本
├─ .face-frame                   框葉：原幾何＋框箔（按 preset）
├─ .face-plate                   名牌葉：正常文字，不混色
├─ .face-gem / .face-tag          保留原 transform，前加深度
└─ .face-sheen                   有限揭曉用途；放適當葉平面內裁切
```

每張不是一律產滿所有特效節點；基本卡只建必要結構，大卡高階材質才加 grain／色散。DOM 增量預估每張約 6～12 個元素，偽元素另算 paint 成本；實作輪以實際 Layers/paint profile 為準。

```css
/* 新功能的 scope，避免和兩套既有卡皮無意互蓋。 */
.card[data-material-version="2"] .card-face {
  overflow: visible;
  transform-style: preserve-3d;
  background: none;
  box-shadow: none;
}
.card[data-material-version="2"] .face-depth-bg,
.card[data-material-version="2"] .face-art {
  /* 沿用原畫窗定位；這兩個本身是 3D 葉平面。 */
  position: absolute;
  left: 10px; right: 10px; top: 10px; height: 148px;
  border-radius: 7px;
  overflow: hidden;
  isolation: isolate;
}
.card[data-material-version="2"] .face-depth-bg {
  transform: translate3d(var(--bg-x, 0px), var(--bg-y, 0px), var(--z-bg));
  background: var(--art-background);
}
.card[data-material-version="2"] .face-art {
  background: none; box-shadow: none;
  transform: translate3d(var(--art-x, 0px), var(--art-y, 0px), var(--z-art));
}
.card[data-material-version="2"] .face-frame {
  transform: translateZ(var(--z-frame));
}
.card[data-material-version="2"] .face-plate {
  transform: translateZ(var(--z-plate));
}
/* gem 的 rotate(45deg)、tag 的 rotate/scale 要保留並合成，不能覆蓋。 */
```

這是結構示意，尚須補 `.face-stock`、遮罩、backface 與狀態規則。`z-index` 只解決同平面內排序，不能取代 Z 層距。原本會扁平化祖先的 `.card.unveiling{overflow:hidden}`，應在新 scope 把裁切移至既有掃帶偽元素自身，保留相同時序；`.card` 淡入／飛出的短暫 opacity/filter 效果可能扁平化整卡，深度在這些受控過渡中暫收為 0，恢復後再展開，不能強改宿主發牌時序。

選擇器也要隨結構移動：原 `.face-art .floor` 的兩套規則改指新背景葉；底板接收原 `.card-face` 的背景、圓角、陰影與覺醒靜態框提示。原有神話 `.face-art` 背景在新 scope 必須移至背景葉，否則又用不透明底蓋掉後層；原神話根層 holo 與 exclude mask 則由分區材料取代。保留媒體直接子節點只是減少遷移，不代表舊 CSS 全部可以不動。

### 6.2 `buildCard()` 與資料保存

修改位置以目前行號加語意錨點辨識，後續實作時以函式為準：

| 位置 | 設計修改 |
|---|---|
| `buildCard()` 72～90，innerHTML | 加底板／背景葉，把 floor 放背景葉；原 frame/plate/gem/tag 名稱不變。 |
| 75 的 `shownRarity` | 保留；以 shown 解析外觀，不使用真實 rarity 選預揭曉材質。 |
| 92 的 `art.appendChild(buildArt(entry))` | 保留直接子媒體；decode 後按實際尺寸建立主體 alpha 對位。 |
| 94 的神話／非神話 `insertAdjacentHTML` 分支 | 改為通用的材質 mounting；畫窗／主體／框由 preset 決定。 |
| 95～101 的 embers | 顯示階層決定是否顯示；轉彩只換 preset，不預先露出真實高階特徵。 |
| `unveil()` 109 起 | 沿用 210+210ms；切 class 和文字的同一中點原子更新材質與 live config。 |

```js
// create() 內新資料；所有新名稱僅為設計介面。
const visualByCard = new WeakMap();

function buildCard(entry, {
  dup = false, tag = true, owned = 0, veil,
  view = 'draw', skinId = 'base', locked = false
} = {}) {
  // 原本的 tagFor(entry, dup, owned)、shown 與 card 建立邏輯保留。
  // 下列片段接在 DOM 建立、媒體插入後：
  const visual = {
    entry,                       // 包含卡冊傳入的目前階
    shownRarity: shown,
    view, skinId, locked,
  };
  visualByCard.set(card, visual);
  card.dataset.materialVersion = '2';
  applyVisual(card, visual);      // 解析完整 preset、掛必要葉材料
  // 原本填字與 return card 保留。
}

// 事件處理器不再用 byId[id] 覆蓋顯示資料：
const visual = visualByCard.get(el);
if (visual) liveStart(el, visual);

// unveil 在原 210ms 中點，且已解除 veiled 後：
const visual = visualByCard.get(el);
visual.shownRarity = visual.entry.rarity;
applyVisual(el, visual);          // 同步 label/class/preset/live.cfg
```

以上為三個不同位置的示意片段，省略原本建立 DOM 的內容，不能當作完整函式直接取代原碼。`applyVisual`、`resolveVisual`、`writeChanged` 都是下一輪要新增的 helpers。`owned` 現有參數代表數量，完整傳給 `tagFor`；新增的 `locked` 才是互動鎖定布林，不混用兩種語意。

外觀解析只接受顯示階層；卡池內真實機率、粉塵、升階數值仍由原宿主管，不由材質決定。

### 6.3 `liveFrame()` 要多寫什麼

建立時写一次的參數：`--z-bg/art/frame/plate`、`--art-background`、箔色 palette、密度、紋理 URL、遮罩幾何、P、各層 mix/gain、穩定 seed、view quality。不要每幀重新查 preset 或把整張 CSS text 覆蓋。

每幀只更新 active card 的以下值（其餘卡 0 次）：

| 變數 | 範圍／單位 | 用途 |
|---|---|---|
| `--mx / --my` | 8～92% 初值範圍 | 延用名稱給平滑後光斑 |
| `--tilt` | 0～1 | 平滑離中心程度 |
| `--foil-x / --foil-y` | % | 主光譜相位 |
| `--cross-x / --cross-y` | % | 反向壓紋／第二波箔 |
| `--art-x/y`、`--bg-x/y` | px | 少量額外前後視差；不取代 Z 幾何 |
| `--grain-a/b` | 0～1 | 相鄰角度樣本權重 |
| `--edge-phase` | deg | 神話框箔角度，不再用時鐘跑 `--spin` |
| `--aberration-x/y` | px | 高階箔亮邊的極小色散 |

```js
// liveStart 快取 lift/media/各葉節點與 cfg；liveMove 只存目標。
// liveFrame 平滑 sx/sy 後（公式見 5.1）：
const d = Math.min(1, Math.hypot(live.sx, live.sy));
const rx = -live.sy * cfg.tilt;
const ry =  live.sx * cfg.tilt;
live.lift.style.transform =
  `perspective(${cfg.perspective}px) translateY(${-cfg.lift}px) ` +
  `scale(${cfg.scale}) rotateX(${rx}deg) rotateY(${ry}deg)`;

const values = {
  '--mx': `${50 + 42 * live.sx}%`,
  '--my': `${50 + 42 * live.sy}%`,
  '--tilt': d,
  '--foil-x': `${50 - 26 * live.sx + 10 * live.sy}%`,
  '--foil-y': `${50 + 16 * live.sy}%`,
  '--cross-x': `${50 + 20 * live.sx + 8 * live.sy}%`,
  '--cross-y': `${50 - 24 * live.sy}%`,
  '--art-x': `${live.sx * cfg.extraParallax}px`,
  '--art-y': `${live.sy * cfg.extraParallax}px`,
  '--bg-x': `${-live.sx * cfg.extraParallax * .5}px`,
  '--bg-y': `${-live.sy * cfg.extraParallax * .5}px`,
};
for (const [key, value] of Object.entries(values)) {
  writeChanged(live.el, key, String(value)); // 快取前值；數值量化後再比
}
// 同幀計 grain 權重／框相位／有限入場進度；沒有 per-card for-loop。
```

舊的 `rig.media/svg.style.transform` 要只保留一次性肢體／呼吸，移除它原有的重複 parallax，避免雙倍位移。若媒體入場縮放仍存在，mask 跟著同一變數縮放。靜態與回正用相同 perspective 模型，避免移除 inline transform 時投影突然換掉；這也必須在 `.card.flipped .card-lift` 的新 scope 寫清楚。

`liveEnd({immediate:true})` 清除所有本次動態變數、動畫、pointer capture 與 cached rect；平常 pointerleave 則先有限回正，再清理。rAF 開頭檢查 `isConnected`／宿主可見性，但不能以逐幀全 DOM 掃描代替宿主的主動 dispose。

### 6.4 卡冊、鎖卡、轉彩與減少動態

`clicker-album.js::makeCard()` 傳 `view:'album'`、`locked:!s.collection[id]`；`openDetail()` 改傳 `view:'detail'`。同時保留 `E.rarity(s,id)`。`renderBook()`、`openDetail()` 在 replaceChildren 前，`closeDetail()`／`close()` 在隱藏前呼叫 `card.liveEnd()`；不要讓 controller 握著已移除的圖。

演示區 `gacha.js::renderAlbum()` 傳 `view:'mini'`，繼續沿用既有 `.mini.locked` 的圖鑑資訊策略。一般 card、`.mini.locked`、`.album-card.locked` 都要由同一 `liveTarget` gate 檢查，不讓 detailId 已打開就把未擁有大卡放行。非角色素材仍可顯示、翻面，缺專用 mask 不可令整張卡消失。

`veiled` 時 frame、foil、glitter、深度、glare、背面預告均使用 `shownRarity`。立繪維持既有真身，這不是新改規則。`unveil()` 中點一次更新全套視覺，不追加另一組 delay；skip/reduced 直接套最後狀態。取消時以 runtime 結果重建，不在 finally 盲目轉彩。

reduced-motion：旋轉、浮升、額外 parallax、色散偏移、粒子／自動掃光設零；顯示穩定相位的箔紋、框型、稀有度文字、星等、鎖定及升階資訊。无需跑 live rAF。若減少動態設定在面板開啟途中改變，立即結束動態並重新套視圖參數。因可及性而使用靜態外觀不等於把正常模式的雙效果改成二選一。

觸控推薦：卡冊保持點選開 detail、垂直捲動；展示大卡才拖曳看箔，處理 `pointerup/cancel/lostpointercapture`，只捕獲該 pointerId。大卡手勢區可使用 `touch-action:none`，但不設在整張頁面或含操作按鈕的面板上。拖曳結束不能觸發點空白關面板。完整手勢及是否讓一般招募總覽直接拖看，待使用者定案；不擅自啟用陀螺儀。鍵盤推薦保留原按鈕導覽，在專屬大卡焦點區提供有限角度調整，不攔截卡冊翻頁箭頭。

## 7. 五階外觀與未來卡池資料化

### 7.1 每階要有不同材質行為

以下為**推薦的第一版美術樣品**；命名、強度及圖樣待使用者定案。五階都有景深與箔面，差異不只 hue。

| 階 | 推薦招牌閃法 | 景深起點（角色 Z；背景 2、框 6） | 靜態辨識及安全區 |
|---|---|---:|---|
| common 普通 | 細緞面：窄中性色帶、可見纖維般細紋，無離散大星點；仍有角度反光 | 12px；tilt 4° | 保留灰框，低強度定格材質，不改成完全無箔 |
| rare 精良 | 拉絲柱光：冷白／藍色窄亮柱與低密度固定晶粒，橫向轉卡有明暗交替 | 16px；tilt 5° | 藍框＋畫窗柱紋，名字區正常混色 |
| epic 史詩 | 交叉光柵：兩組反向斜線與三段光譜，局部細顆粒；四角扣保持辨識 | 20px；tilt 6° | 即使轉灰階，交叉紋也不同於 rare |
| legendary 傳說 | 壓花金箔：大面積金／琥珀反射、壓印紋理固定、稀疏亮晶片隨角度選光 | 24px；tilt 7° | 保留三齒扣＋四角扣，以箔面反差呈現價值，不依賴橘色粒子海 |
| mythic 神話 | 全幅區域式虹箔：角色、畫窗及框都有各自受控虹箔，雙向寬光譜＋多尺度晶粒；虹色框相位與角度連動 | 28px；tilt 8° | 框的虹色分區＋獨有雙層幾何刻紋，定格／縮圖也能辨識；文字下方獨立名牌，保留「神話」標示 |

神話不能只靠無限 `mythic-spin` 才與傳說不同；停止輸入時保留多色框、獨有大尺度壓紋與背景／主體的材質區別。不得以覆蓋白色強閃來代替表面質地。現有最高傾斜只有 8°，起始先保持這個範圍；若對標的「拿卡手感」不足，可在**展示大卡**樣品調至更大角度比較，最終幅度待樣品定案，不改揭曉的 T/EASE。

縮圖推薦保留同一套材質的定格版本，減少細粒密度、glare 與色散；不是完全關掉所有箔而仍宣稱縮圖同品質。卡冊是否需要每張跟滑鼠閃動尚未定案，目前推薦沿用既有紙上靜態卡、單張 detail 展示完整效果。

### 7.2 外觀設定與抽卡政策分離

推薦一次性新增 `window.GachaVisuals = (() => {...})()` 資料與 resolver，以普通 `<script src>` 載入；只用靜態本地資源。設定分為 card art、版型／框、foil recipe、卡池外觀對照；稀有度的排序、抽率與養成不塞進渲染器。

```js
// 示意設定，不是宣告存在新的正式卡池。
const visuals = {
  schemaVersion: 1,
  frames: {
    base: {
      artRect: [10, 10, 130, 148],
      plateRect: [10, 166, 130, 34],
      radius: 12,
      ornament: 'corner-clamps',   // 有限 primitive 或自製本地 mask
    },
  },
  recipes: {
    etchedPrism: {
      spectrum: { angle: 118, size: 2.6, palette: ['#ae60dc','#65d3dc','#eac879'] },
      grain: { asset: 'glitterAngles', gain: .28 },
      regions: ['background', 'subject', 'frame'],
      motion: { tilt: 6, perspective: 800, extraParallax: 1.2 },
      depth: { background: 2, frame: 6, plate: 6, subject: 20 },
    },
  },
  pools: {
    base: {
      skinsByDisplayRarity: {
        // common/rare/epic/legendary/mythic 均需完整定義
        epic: { frame: 'base', recipe: 'etchedPrism', label: '史詩' },
      },
    },
  },
};
```

實際 `resolveVisual({skinId, shownRarity, art, view, locked, reduced})` 產生完整不缺欄位的 profile。優先序：view/reduced 的品質限制 → 顯示階層對應 → 明確卡款 override → 共用預設；override 只能在目前顯示階層允許的範圍內作用，偽裝時禁止真實高階 override 穿透。未知 ID 用中性完整外觀並在開發期警示，不崩潰、不改抽卡結果。所有字走 `textContent`，所有資源路徑來自受控 manifest，設定不允許任意 JS 回呼或 HTML 字串。

新增一個**使用既有圖元與材質能力的卡池外觀**，目標只改 1 份資料登錄：加入 pool/skin、框幾何／資源、各顯示階的 recipe；需要新圖時另加入其靜態資源。新卡項目按既有目錄登錄即可，渲染 JS/CSS 不改。若新閃法需要 renderer 沒有的圖元／shader，必然要擴充渲染器，不能把「永遠只加資料」作無條件承諾。

之後卡池自身的抽率、貨幣、保底、獲得同角色如何存外觀、升階是否換皮、新稀有度如何對應經濟階，**全部待使用者定案**。目前宿主有 `RARITY_ORDER`、卡冊 `RAR/ORIGIN` 等固定值，故資料化目標只保證外觀層；不能說新增經濟稀有度也完全不用動其他程式。本輪不變更存檔 schema。

## 8. 素材清單、產製與授權

### 8.1 建議新增的共用素材

| 素材 | 數量與規格 | 產生方式與用途 |
|---|---|---|
| 細粒紋理 | 1 張 512×512，灰階，可平鋪 PNG | 固定 seed 程式生成，多尺度顆粒；CSS 作固定底紋 |
| glitter 角度 atlas | 1 張 1024×1024 RGBA，四格各 512×512 | 固定微粒位置／法線，四方向離線取樣，alpha 表示亮點 |
| 壓花／光柵紋理 | 1 張 512×512，灰階可平鋪 PNG | 程式生成曲線、交叉線與晶格，色彩由 CSS 決定；不使用生成式圖片 |
| 框用幾何 mask | 初始 1 張 SVG，可用 600×840 viewBox；版型需要時增加 | 用自製路徑畫框與銘牌排除區；低階框可直接 CSS，無中文字 |
| 光譜／glare／色散 | 0 張 bitmap | CSS gradient 與同份 mask 重用 |
| 角色 alpha | 通常 0 張新圖 | 原 PNG alpha 對位；新增美術遮罩需另列來源 |
| 滅世珍獸分層 | 推薦新增前景 RGBA＋補背景各 1 張；至少維持原圖解析度與構圖 | 去背／補遮擋區，先審分割；本輪不產製。僅移除背景不能補出原來看不到的城市 |
| 中文名稱、稀有度、標籤 | 0 張圖片 | 一律 DOM 文字；若將來新增背景美術，仍為無字底圖＋DOM 疊字 |

基準為 **3 張共用 raster＋1 張框 mask**，全卡重用；不是每階各出一套彩虹 PNG。素材生成工具推薦後續使用本地 Python/Pillow 或離線 Canvas，輸出固定檔案；執行期不需要 Python、Blender、AI 或產圖 API。存 seed、尺寸、生成版本與自製來源說明，便於重現。壓縮格式可比較無損 WebP，但初版以 PNG alpha 避免引入有損 mask 邊緣。

靜態材質載入錯誤只退為 CSS 光譜與基本深度，不走現有角色載入 fatal；但這只是可用性退路，缺纹理時不能通過完整品質驗收。不要把整個卡池所有高解析度美術再次 `decode()`；共用材質一次 decode/cache，按面板需要載入。

### 8.2 LICENSE 實讀結論：哪些能抄、哪些只能學、哪些自己做

授權判斷依實際 LICENSE 內容，不依 GitHub 側欄；以下是採用決策，不把「改名重寫」當作授權豁免。

| 來源 | 實讀證據 | 本案處理 |
|---|---|---|
| Pokémon Cards CSS | [固定版本 LICENSE 原文](https://raw.githubusercontent.com/simeydotme/pokemon-cards-css/acb1197633e749a1fba4412231db2f6581586d00/LICENSE)，GNU GPL Version 3；第 4 節規範原碼轉散布，第 5 節規範修改作品，第 6 節規範非原碼形式及對應原碼 | **只能學原理，不搬 CSS／JS／貼圖**。GPL 本身允許符合條件的複製，但本案明確不採納它的程式碼。若形成衍生作品，僅換變數名、數字或從 Svelte 翻譯成 JS 不會自動解除義務。 |
| Holo Card Studio | [固定版本 LICENSE 原文](https://raw.githubusercontent.com/EverettFish/holo-card-studio/b470957e0dea681eadc05e467a57bdc84b702333/LICENSE)，MIT；另明文排除生成圖片及使用者上傳參考圖 | **軟體程式碼可以依 MIT 複用**，須保留版權與許可聲明；但本案推薦只借概念，不導入其工作室程式。該 MIT 不替生成素材或參考圖授權。 |
| Ziggy 文章／Tarot 頁面程式 | 本次讀到文章及站上 JS/CSS，但未確認涵蓋這些具體檔案與圖像的 repo LICENSE；不能用其他 starter repo 的授權替代 | **目前只能學原理，程式與素材不搬**。公開可讀不等於可再散布；若將來要採用，授權文件待補查，採用待使用者定案。 |
| Galaxy Holo／HoloSheet-2012 | Pokémon README 指到 [aschefield101 原作品頁](https://www.deviantart.com/aschefield101/art/HoloSheet-2012-313543843)，已實際請求，但未成功取得作品授權條款 | **授權未確認，不採用**；不把 README 致謝視為商用／再散布許可。 |
| Vecteezy 背景 | README 只連一般圖庫，沒有逐張素材 ID。[官方授權協議](https://www.vecteezy.com/licensing-agreement) 已讀，包含不同 license 類型，且限制獨立檔再散布與內容提取 | **不採用**。無法由圖庫連結判定個別檔案取得何種許可；公開 repo 放可下載原圖也不能只靠署名推定合規。 |
| 本案箔紋、粒紋、框 mask | 獨立程式生成／自行繪製，不以第三方貼圖作輸入 | **自己做**，保留生成記錄；原角色美術沿用本專案既有來源管理，不擴大宣稱其權利。 |

補正來源歸屬：Galaxy Holo／Vecteezy 的致謝實際出現在 **Pokémon Cards CSS README**，不能因簡報行文把它們歸到 Holo Card Studio 的 MIT 之下。

本地根目錄未見專案 LICENSE，`package.json` 的 `private:true` 也不提供或解除著作權許可。gh-pages 傳送 CSS/JS 給瀏覽器與桌面包散布程式不是「僅供伺服器內部使用」；若未來決定納入 GPL 衍生碼，須另行處理相應範圍的授權與散布義務。**本輪不替專案挑選 LICENSE、不改公開／發布設定。**

## 9. 效能預算與跨平台風險

### 9.1 成本模型與停止條件

CSS 不是免 GPU／免重繪。gradient 的 background-position、mask/filter 及多層混色可能重繪；只有 transform/opacity 也不能保證整個效果永遠合成器獨立完成。以實際 profile 判断。

推薦新卡面在同一宿主最多一張接收連續輸入；若一個頁面有多個 adapter，用共用 coordinator 保證單一 active，而不是每個 `create()` 都各跑一套 document listener。卡冊建構／換頁為 O(N)，交互更新為 O(1)。生命週期：關閉、換卡、切頁、隱藏、取消 pointer 都解除 active，移除 `will-change`，不留 polling。

粗估 150×210、DPR 2，一張全尺寸 RGBA surface 約 `150*210*4*4=504,000 bytes`，即 0.48MiB；六個同等 surface 約 2.88MiB，一次替 16 張都升層約 46MiB，尚未算原圖、mask、放大及中間合成。DPR 3 時同條件約 104MiB。這是面積估算而非瀏覽器實際配置；不能以壓縮 PNG 幾十 KB 推斷顯存也那麼少。

三張共用 raster 若解碼為 RGBA，兩張 512²＋一張 1024²約 6MiB，不含 mipmap／GPU 副本。別為每張卡複製同樣 atlas；可共用 URL、讓瀏覽器快取，但仍須量測不同合成表面的成本。

推薦測試預算（**非既有實測，裝置／門檻待使用者定案**）：

- 桌面 Chrome／WebView2 單張大卡連續操作，以 60Hz、總 frame p95 不高於約 16.7ms 為目標；卡面 JS p95 儘量小於 1ms，其餘留給 paint、composite 及遊戲。
- 手機正常模式也以穩定 60fps 為目標。若測不到，不自行把 30fps 定義為合格；先降低表面數與取樣密度，再提交差異。
- 16 張同屏、主遊戲 1Hz 結算及既有粒子同時開啟，除 active 卡外不寫動態 style；不要因每秒結算重建 detail 重播閃光。
- 停止輸入並完成回正／一次性入場後，新增卡面 rAF、interval 及無限 CSS 動畫為 0；背景頁立即為 0。以卡面程式與動畫名歸因，不把遊戲其他模組的工作算成卡面殘留。

退化順序：先縮小混色範圍、合併箔紋背景、降低 glitter 解碼／取樣密度、只在 active 大卡保留色散；仍保留**角色／背景相對視差及角度箔面**。不能以整個效果停用來通過正常手機模式。真正不支援必要能力時提供清楚可用的靜態卡，但列為支援範圍與品質待定，不冒稱等效。

### 9.2 必測風險表

| 風險 | 原因 | 防法與驗收 |
|---|---|---|
| 景深被壓平 | 3D 祖先帶 overflow/filter/isolation/mask；淡入時 opacity<1 | 多個 Z 平面放無 grouping 的骨架，隔離與裁切只放葉內；以棋盤背景＋主體輪廓看相對差，不能只看 computed `preserve-3d` |
| 混色跨卡／角色出現彩色矩形 | mix backdrop 未隔離，或 alpha mask fit 不對 | 每葉材料群隔離；對透明 PNG、cover、長寬比特例逐張抽檢 |
| 翻面鏡像、漏面、共面閃爍 | backface、兩次 180 度與 Z 排序錯置 | 0/45/90/135/180 度檢查，翻前後無角色漏出、無文字鏡像；保留既有 runtime 鎖 |
| CSS 優先序失效 | skin-af 與尾部神話規則覆蓋新層 | 新 scope 與舊功能交界一次整理，測兩套卡皮；不用不停追加 `!important` 疊補 |
| 白角色爆白、文字失讀 | dodge、白光與亮底相乘 | 主體與框分區 mask，保留正常名牌；截圖比對眼睛、輪廓、名稱及標籤 |
| 升階後閃法退回原階 | hover 回查 byId 原始 entry | WeakMap 保留建立時顯示 entry，轉彩同步 update；測 rare 出身升到 legendary |
| 縮圖仍持續轉虹 | 神話尾段恢復動畫、覺醒 sheen 無限循環 | 新功能 scope 的靜態 view 必須覆蓋這些動畫；用 `getAnimations()`＋Performance 觀察停止後狀態 |
| 手機捲動／點擊衝突 | 全局 pointermove 與 capture 抢手勢 | 大卡專屬操作區，卡冊保留原 click；測多指、cancel、拖出卡外及點空白關閉 |
| WebView2 差異 | Chromium runtime 版本、GPU／縮放／合成行為不等於桌面 Chrome 當前版 | 實記 runtime 版本、DPR、OS 縮放與硬體加速狀態；測 100/125/150% 縮放，不只看 `CSS.supports` |
| 手機瀏覽器差異 | WebKit 與 Chromium 的 mask/背面/觸控實作差異 | 至少 Android Chrome；iOS 是否納入最低支援待定，但應做 Safari 抽驗，不以桌面裝置模擬代替真機 |
| 路徑／離線失效 | GitHub Pages 子路徑與 Tauri 本地來源不同 | 貼圖用專案相對路徑，不用參考站 `/img/...` 或 CDN；測離線桌面與 gh-pages |
| rAF 指向舊卡、事件倍增 | replaceChildren、adapter 重建未解除 listener | 宿主 dispose、isConnected 防線、單 coordinator；連開關／換卡 20 次檢查 handle、事件與記憶體 |
| 粒紋摩爾紋／閃跳 | 小尺寸高頻線條、atlas 方向離散 | 各視圖專用密度、細粒低通、相鄰樣本 crossfade；測高 DPR＋縮放 |

## 10. 分輪實作與可獨立驗收

所有輪次均指**後續實作輪**。本次未建立 demo、未跑應用測試；只做來源與文件核對。既有 `WISH_TELEGRAPH=false`、切入 T/EASE、點空白關面板、卡冊翻頁箭頭、傳說轉彩 30%、神話 0.5% 都是回歸不變項，不重設機率、不重設演出節拍。

| 輪 | 交付 | 可獨立驗收方式 |
|---|---|---|
| 0. 建立比較基準 | 已定案參考卡組、同尺寸／軌跡比對流程、裝置記錄與當前卡面基準 | 實際開參考站，選一般 holo、rainbow、cosmos 等代表，記錄中／四角／繞圈／停止／翻面操作；使用者定品質樣本，避免用一句「更亮」作標準。此輪不降低既有「一樣」要求。 |
| 1. 景深骨架＋顯示資料 | detail 一張透明 PNG、一張 SVG 舊卡、兩筆 bleed 的骨架；WeakMap 顯示階層、生命週期 | 關箔看角色／背景／框相對位移；開箔的簡單測試面後也不能變平。測升階資料與鎖卡、翻至背面、退出後 0 rAF；滅世珍獸缺真分層需明列未完成項。 |
| 2. 完整箔材＋原創貼圖 | 光譜、明暗柱、glare、固定粒紋／角度 glitter、材料 mask | 同一方向重回同一材質狀態；顆粒位置不漂移；深度與箔面一起開啟。與第 0 輪樣本同尺寸並排，逐項調校，使用者驗收後才宣稱材質達標。 |
| 3. 五階與場景特例 | 五階完整外觀資料、神話靜態辨識、經定案的場景分層 | 五階同場可分辨；神話停止／縮圖仍辨識；透明長寬比、滿版圖、安全區與中文檢查。不能用片面只驗一張神話替代全素材相容。 |
| 4. 宿主整合與多卡 | draw/detail/album/mini profiles、mobile input、轉彩／skip／reduced 接線 | 測 8／16／全目錄、多次換頁／開關、所有揭曉模式；轉彩中點無提前洩露；縮圖不占每幀工作；點空白與箭頭行為原樣。 |
| 5. 跨平台品質與擴充驗證 | Chrome／Android／WebView2 記錄、效能與可及性結果、純資料新 skin 範例 | 真機錄製相同軌跡，量 p95、卡面閒置 10 秒、記憶體與動畫殘留；只加資料切換框／箔，不改 renderer。正常模式兩種效果都必須過關。 |

### 10.1 「跟展示一樣」的具體檢核表

以下是把使用者標準拆成觀察項，並未另訂可以打折的分數：

1. **角度關聯**：左／右／上／下、對角和圓周移動有連續材質變化，光斑與卡身没有不同步的跳步；同角度有可重現外觀。
2. **箔面反差**：能看到亮、暗、色譜交替與壓紋，不能只看見半透明彩虹。
3. **質地**：細粒與較大晶粒位置穩定、因角度換亮點；沒有影片般自動輪播、整批生硬切換。
4. **景深共存**：箔面開啟時角色依然相對背景／框浮起；滿版場景若要求角色相對城市，必須用完成分層的素材驗。
5. **手感**：移入、快速換向、停止、移出與翻面都連續；參考站的感受以人工並排確認，不能拿 FPS 當手感全證據。
6. **資訊完整**：中文、稀有度、星等與標籤清楚；鎖定、升階及轉彩資訊不因材質遺失。
7. **各宿主／平台**：detail 達標不代表 mini／手機／WebView2 自動達標；縮圖的靜態策略與可及性例外需明列。

程式驗證聚焦有意義的行為：顯示階層 resolver、veil 切換原子性、停止／dispose、透明 mask 對位與宿主互動。既有測試在真正改碼後跑；本文件輪不以執行整套遊戲測試製造「效果已驗收」的假象。

## 11. 待使用者定案

| 項目 | 本文推薦／尚缺資訊 |
|---|---|
| 精確對標樣本 | 標準已定，不再問要不要做；尚需指定或確認參考站各代表卡及大卡尺寸。推薦 regular holo＋rainbow＋cosmos 三類共同看，不只看首頁單一卡。 |
| 五階招牌美術 | 採第 7 節五套樣品比較；框幾何、神話刻紋及閃亮強度尚未由使用者選定。 |
| 景深幅度／是否越外卡框 | 先用安全區內的多平面與相對位移；角色超出外卡邊緣的程度、detail 更大傾角待樣品定案。 |
| 滅世珍獸場景分層 | 要完整角色／城市景深，推薦製作主體去背與補背景；光束應黏哪一層、遮擋區怎麼補畫待美術定案。不能自行生成不存在的城市細節。 |
| 卡冊與手機交互 | 推薦卡冊靜態材質＋點 detail，detail 拖看；是否要求縮圖也動態、招募總覽觸控手勢、是否需要陀螺儀尚未定案。 |
| 支援裝置與效能門檻 | 原要求是手機／Chrome／WebView2；最低手機型號、iOS 範圍、可接受品質差異需在樣品輪確定。 |
| 進階卡池業務 | 卡池名、階級、抽率、保底、貨幣、同角色外觀保存與升階換皮規則，全部未定；只預留渲染資料介面。 |
| 外部程式／素材採用 | 本案推薦不帶外部碼／圖；若要改用需補授權證據。Galaxy、Tarot／Ziggy 具體程式素材的再利用許可未確認，不代替使用者決定採納。 |

本設計的完成判斷是：後續依推薦路線實現**同卡景深＋箔面**，用實際可觀看的樣品達成既定品質，再通過多卡與平台驗收。來源研究支持這條路可做；設計文件本身不等同於完成視覺品質證明。
