# 珍母點點：第二輪視覺設計定案

基準：`f19d934` 第一版。對照實機截圖、`docs/cast.png`、clicker 版面／舞台程式及 `gacha-fx.js`，並經 Astra 獨立診斷。

本輪只制定設計。所有尺寸為 **960×640 邏輯座標**；截圖的 1200×800 是 DPR 1.25 結果，不把 CSS 尺寸乘上 1.25。保留經濟、技能效果與點擊熱區；不另立效能規矩。

## 1. 定案：珍母的零食手作桌

採用 **奶白紙板、鼠尾草綠桌墊、珊瑚粉包裝、黑褐粗描邊**。角色與介面像同一位畫師畫出來，再剪下組成玩具工作桌。

材質只用「紙板＋紙標籤」。桌墊也是平塗紙板，不混毛氈、木紋、金屬與寫實塑膠。手做感來自輪廓、摺邊、接觸與少量製作痕跡，不靠到處歪斜。

### 逐區診斷

| 區域 | 實際問題 | 定案 |
|---|---|---|
| 背景 | 已有紙紋、縫線、肉球與星印，並非沒有手做細節。背景過度完整，前景卻像另外套上的表單 | 移除主畫面的 `clicker-desk.png` 背景使用，改平塗底色；手做細節集中到真正的紙板元件 |
| 上欄 | 現有標題 23px、金額 25px，並非完全沒有字級；但金額與工具列混在一起，焦點弱 | 金額升到 32px，放獨立奶白紙標籤；遊戲名 24px，速率 13px |
| 舞台 | 空白本身不是錯。問題是隊員、珍母、袋子各佔一處，缺少共同接地關係 | 移走隊員，珍母與包裝共用一張桌墊；保留周圍空白 |
| 包裝 | 三張撕痕只遮住圖案，沒有改變袋口輪廓；白邊與旋轉讓它們像補丁 | 換成同一袋子的五狀態圖；破壞沿袋口發生 |
| 商店 | 同樣的框、按鈕與小字反覆出現，所有內容等權 | 固定「名稱→效果→購買」層級；主購買鍵與「最多」明確分級 |
| 圖示／文字 | 網格對齊不是問題；問題是縮得太小、行距擠、圖示缺少自己的位置 | 圖示給固定 40px 區域，文字基線保持精準，不故意排歪 |
| 技能區 | 三個大 select 像設定問卷；隊伍展示又散落舞台 | 下方共用紙板底座，左側瀏覽夥伴、右側操作三個技能 |
| 通知 | 截圖中的深棕大横幅遮住舞台與商店頂部，比遊戲本身醒目 | 入隊結果放夥伴列標頭；一般收益只用浮字 |
| 禁用狀態 | 整體降透明度，連字與邊框一起發灰，增加廉價感 | 使用實色禁用配色，保留文字辨識度 |

**不採納「多加裝飾就會好」的方向。** 現有按鈕其實也有硬陰影；需要統一筆觸與比例，而不是單純再加陰影。

### 色板與線條

```css
--ink: #30251F;
--text-secondary: #735E4E;
--desk: #E9D6B4;
--paper: #FFF6E6;
--paper-edge: #B69B78;
--mat: #C7D4B2;
--mat-contact: #9AA887;
--pink: #EF9B9C;
--gold: #E9B94E;
--disabled-bg: #DED4C3;
--disabled-text: #8B7D6C;
```

| 元件 | 描邊／圓角 | 陰影 |
|---|---|---|
| 大紙板底座、商店卡 | `3px solid var(--ink)`／14px | `4px 5px 0 var(--paper-edge)` |
| 主按鈕 | 3px／9px | `0 4px 0 var(--ink)` |
| 次按鈕 | 2px／7px | `0 2px 0 var(--paper-edge)` |
| 小標籤 | 2px／5px | 不加 |
| 內部分隔線 | 2px | 不加 |
| 角色、包裝接觸影 | 平塗橢圓 | 不用 blur、filter 或發光 |

主按鈕按下 `translateY(3px)`，陰影縮到 1px；過渡 80ms。Hover 改填色即可，不漂浮。

UI 主框保持水平。只有紙膠帶可旋轉 ±2°，單個大區最多一處，整個主畫面最多三處。角色原本的黑描邊不重畫、不套濾鏡。

### 字體與字級

先沿用既有 `"Microsoft JhengHei", "Segoe UI", sans-serif`，不把新字型列為改版前提。手做感由美術承擔，資訊仍清楚好讀。

| 用途 | 字級／行高 | 字重 |
|---|---|---|
| 金幣總數 | 32／36px | 800 |
| 遊戲名稱 | 24／30px | 800 |
| 區塊、升級名稱 | 18／24px | 700 |
| 主要操作 | 15／20px | 700 |
| 效果、產量、一般說明 | 13／18px | 400–600 |
| 格內名字、星級、冷卻 | 12／16px | 600 |
| 頁尾、補充註記 | 11／15px | 400 |

移除主操作內的 9–10px 字。數字使用 `font-variant-numeric: tabular-nums`。

圖示採 24／32／40px 三種尺寸；外輪廓在實際顯示尺寸約 2–3px，最多三個平塗色。不引入 emoji、細線 icon 或金屬高光圖示。

### 稀有度融入方式

沿用現有四種語意，不新增綠色稀有度：

| 稀有度 | 主畫面柔色 |
|---|---|
| common | `#A9A297` |
| rare | `#94BED0` |
| epic | `#B8A2CF` |
| legendary | `#E9B94E` |

只用於夥伴格的 **4px 底邊色帶、小角標**。名字仍用 `--ink`；名冊保留稀有度文字，不能只靠顏色辨識。

另設 clicker 區域變數，不覆寫共用 `--c-*`，避免改動既有招募卡面與揭曉演出。

## 2. 版面與夥伴列

### 主版面

| 區塊 | x／y／w／h |
|---|---|
| 上欄 | 16／12／928／48 |
| 主舞台 | **16／72／608／360，保留** |
| 商店 | 640／72／304／360 |
| 隊伍紙板底座 | 16／448／928／132 |
| 頁尾 | 16／592／928／32 |

`#tap` 保留舞台內 `left:184px; top:20px; width:240px; height:240px`，包含原本形狀與鍵盤入口。桌墊、包裝、粒子皆不攔截指標。

舞台不再用一個完整圓角框包住所有東西。以桌墊建立場景；教學紙條放舞台內 `x20 y12 w568 h28`，完成後收起。

商店保留三張卡的現有位置與高度。升級主購買鍵約 176px 寬，「最多」約 80px 寬，間距 8px；按鈕高 36px。名稱 18px、效果 13px、價格 15px，缺額提示 11px。禁用只改按鈕配色，不淡化整張卡。

### 下方共架，夥伴與技能不合併成同一格

**左側是收藏與選人，右側是技能操作。** 三個技能槽保留獨立身份；所有已獲得夥伴仍持續提供被動收益。

| 元件 | 全畫面座標／尺寸 |
|---|---|
| 夥伴標頭 | x28 y456，高 18px |
| 夥伴可視列 | x28 y480，w520 h88 |
| 夥伴單格 | 80×88px，間距 8px，一次六格 |
| 分隔線 | x564 y464，高 100px |
| 技能標頭 | x580 y456，高 18px |
| 三技能卡 | x580／700／820，y480，各 112×88px |

夥伴標頭右側放上一頁／下一頁與「名冊」入口。每頁六格，依固定角色順序顯示已擁有夥伴；不隨裝備狀態重排，不塞滿十二個灰色空框。沒有夥伴時顯示「點擊 50 次，迎接第一位夥伴」。

每格內容：

- 上方 40×40px 立繪縮圖，直接重用角色 SVG，`contain` 保留耳朵等輪廓；不用帶文字與特效的完整卡面。
- 名字 12／16px。
- 星級以現有星圖 12px＋數字表示，例如「★ 3」。
- 右上 28×16px 紙章顯示「槽1／槽2／槽3」；未裝備不顯示。
- 下緣 4px 稀有度色帶。

點夥伴格：開啟名冊並選中該角色。名冊詳情顯示三個「裝備至槽 N」按鈕，明示鎖定條件、已裝備位置與更換後 30 秒等待。點縮圖不直接換槽；已有其他槽使用該角色時，顯示目前位置，不暗中搬移。

技能卡內：

- 頂行 24px 縮圖＋名字，點此開名冊並指定目標槽。
- 中間 96×28px 技能發動按鈕，字級 13px。
- 底行 12px 顯示「可發動／冷卻 12 秒／剩 3 次」。
- 鎖定格顯示鎖定條件；不再以大 select 當主視覺。

### 新夥伴入隊

把 `join()` 的舞台滑入換成 **揭曉位置→夥伴格**：

1. 收下前記錄揭曉卡的位置及角色 ID；不能等 `close()` 清空卡片後才找起點。
2. 成功收下後更新夥伴列，定位到目標所在頁。
3. 招募層退去時，在 `#game` 的暫時過場層保留 64px 角色縮圖。
4. 用 380ms 從揭曉卡中心飛到夥伴格縮圖中心，縮至 40px。中途向上偏移 36px，無拖尾。
5. 到達後該格用 140ms 做 `scale(1→1.08→1)`，標頭顯示入隊訊息 1400ms。

五連按目標頁分組，組內間隔 70ms；每組落定後才換下一頁，避免飛行中的終點移動。重複角色合併一次到達，更新原格星級／進度，不建立新格。

現有回呼只傳 `newIds`，不足以表示重複獲得與來源卡位置；下一輪需攜帶本次結果的視覺資訊，經濟結算仍沿用原流程。

教學送出的夥伴從教學紙條位置進入夥伴列，不假裝來自招募卡。

### 珍母寄生

**採宿主頭像標籤，不讓宿主升上舞台。**

- 標籤位於舞台內 `x198 y205`，尺寸 116×32px，貼在珍母左下身側。
- 宿主縮圖 24×24px，旁邊顯示「寄生・名字」，字級 11px。
- 奶白底、2px 描邊、5px 圓角。
- 開始 160ms：`scale(.85→1)`＋淡入；結束 120ms 淡出。
- 夥伴列原格保留，再加一枚小寄生標記。
- 剩餘時間及複製收益放技能卡，不另在舞台上排一長串說明。

移除目前 `updateParasite()` 將完整宿主 SVG 放入 `#parasite-host` 的演法。宿主仍取自實際 `effect.target`，不改技能選人或收益邏輯。

## 3. 零食包與拆包

### 包裝美術與接地

改成一包直立、略鼓的粉色零食袋：

- 袋身寬高約 **0.65:1**，正面近正視，不傾斜。
- 珊瑚粉主體、奶白標籤、一個簡單餅乾圖案、兩條封口壓線。
- 外輪廓約 3px 黑褐線；內部約 2px。
- 最多兩塊平塗摺面；不要鏡面高光、細碎皺紋或複雜食品插畫。
- 品牌辨識靠珍母簡化臉章，不依賴 imagegen 生成文字。

舞台內配置：

| 元件 | 規格 |
|---|---|
| 珍母 | 保留既有定位盒與 190px 角色高度 |
| 新包裝圖盒 | x328 y160，120×160px |
| 紙板桌墊 | x168 y248，324×76px |
| 桌墊邊 | 3px，內縮 6px 加一條 2px 摺邊 |
| 珍母接觸影 | 中心約 x304 y254，92×12px |
| 包裝接觸影 | 中心約 x388 y310，82×10px |

桌墊用 `#C7D4B2`，接觸影用 `#9AA887`。陰影在物件後方，無模糊。袋子在珍母後左／前右構圖中的前右側；可遮到珍母右下肢，不能遮臉。

### 五張狀態圖

檔名：

```text
clicker-bag-0.png  完整
clicker-bag-1.png  輕損
clicker-bag-2.png  中損
clicker-bag-3.png  重損
clicker-bag-4.png  撕開
```

全部 **384×512 RGBA PNG**，真正透明背景。袋體水平中心 x192，底部基準 y480；左右主輪廓約 x48–336，封口約 y24。所有狀態同畫布、同縮放、同標誌位置。

| 狀態 | 剩餘拆包力比例 R | 畫面變化 |
|---|---:|---|
| 完整 | `R > .75` | 袋口封住 |
| 輕損 | `.50 < R <= .75` | 上封口右側出現小缺口 |
| 中損 | `.25 < R <= .50` | 缺口向左擴大，露出少量深色內側 |
| 重損 | `0 < R <= .25` | 封口大半分離，一端仍連著袋身 |
| 撕開 | `R = 0`／完成事件 | 上口張開，翻起的封邊仍連著袋子 |

```js
R = Math.max(0, 1 - progress / requirement);
```

破壞沿同一封口累積，不從袋身中間長出三條獨立裂縫。底部與正面標誌保持不動。

**程式接點：** 經濟層完成後會直接進入下一包，所以撕開圖不能只等目前 `R === 0`。必須由包數增加／完成事件觸發。

### 切換動作

- 輕損／中損／重損切換：140ms，袋底為原點，`scale(1→1.045→1)`，不旋轉。
- 一次跨越多個門檻：直接切到最終狀態，只彈一次。
- 完成：撕開圖停留 180ms，淡出 100ms；下一包從下方 10px 淡入，140ms。
- 完成期間的後續輸入仍正常結算；動畫结束時讀取最新包數／進度，不能一律重設完整圖。
- 一次完成多包：只演一次開封，量尺旁顯示「完成 N 包」。

切狀態時使用同一撕口的碎屑粒子。若該次點擊已噴粒子，補足該事件配額即可，不再加第二次爆炸。

### 紙膠帶量尺

取消橫跨舞台的原生細進度條。量尺固定在包裝下方：

- 舞台內 `x244 y328 w340 h24`。
- 奶白紙膠帶底，2px 黑褐線；兩端各有一個小缺角，保持水平。
- 左側包數 48px，中間軌道 124×8px，右側數字 128px。
- 軌道填色 `#EF9B9C`，十等分刻線用 1px `#735E4E`。
- 數字保留已拆量／總需求，例如 `62.5 / 100`，字級 11px。
- 填充顯示已拆比例，五狀態依其互補的剩餘比例判斷。
- 包數增長、數字過長時使用既有格式化，不讓量尺改寬。

尚未取得五狀態素材時：**撤除三張撕痕，暫用完整袋＋量尺；完成圖保留為短暫過渡。** 不用 CSS 再拼一套假裂縫。

## 4. 每次點擊都有粒子

### 單一主要落點

所有有效點擊，包含鍵盤輸入，都在 **包裝撕口** 產生回饋，不跟隨滑鼠另開爆點。

定義舞台內撕口錨點：

```js
const impact = { x: 388, y: 172 };
```

轉成全畫面是 `{x:404, y:244}`。生成位置只加 `x ±8px、y ±3px` 隨機量。包裝彈動、碎屑、浮字共用此錨點。

### 粒子配方

`vx/vy` 為 px/s，`g` 為 px/s²；**`life` 傳入秒，`r` 是半徑**。

| 事件 | 配方 | 數量 |
|---|---|---:|
| 普通點擊 | sprite 9 方紙 ×4＋14 小閃 ×2 | 6 |
| 連點 | sprite 9 ×6＋14 ×2 | 8 |
| 點擊同時跨狀態 | 沿用該次配方，方紙補到總數 8 | 8 |
| ×10 重擊 | sprite 9 ×5＋2 五星 ×2＋5 光痕 ×1 | 8 |
| 被動收益跨狀態 | sprite 9 ×4；不產生手動收益浮字 | 4 |

×10 用尺寸、速度與一次光痕區別，**不疊普通點擊、不連炸十次、不全屏閃白**。

| 參數 | 普通方紙 | 小閃 | ×10 方紙 |
|---|---|---|---|
| `vx` | -65～65 | -35～35 | -110～110 |
| `vy` | -115～-55 | -60～-20 | -180～-90 |
| `g` | 260 | 60 | 320 |
| `life` | .36～.52 | .18～.26 | .42～.65 |
| `r` | 3～5 | 4～6 | 5～7 |
| `vr` | -5～5 rad/s | -1～1 | -7～7 |
| `drag` | .985 | .985 | .985 |
| `shrink` | true | true | true |

普通方紙：三顆 `#EF9B9C`、一顆 `#FFF0D5`。連點追加的兩顆使用粉色。小閃使用 `#E9B94E`。

×10 五星：`r:9–12`、`life:.24–.32`，從同一錨點向左右上方散開。光痕：`r:28`、`life:.12`、`vx:0`、`vy:0`、`g:0`、`rot:-.35`，一筆切過袋口。包裝同步做 180ms 的 `scale(1→1.10→.97→1)`。

### 貼圖混合方式

現有 `gacha-vfx.png` 自帶光暈，染色時還會回混白色。它適合做短促玩具閃點，不能宣稱已經是真正的不透明紙屑。

- 方紙指定現有支援的 `blend:'source-over'`，保留粉色辨識度。
- 小閃、五星與光痕使用 `blend:'lighter'`。
- 不加 `glow`，不使用光球 0、煙 4、光柱 15。
- 先用現有貼圖完成點擊回饋；若要完全平塗的碎紙質感，再換專用素材。

普通方紙參數範例：

```js
scope.spawn({
  sprite: 9,
  x: impact.x + rand(-8, 8),
  y: impact.y + rand(-3, 3),
  vx: rand(-65, 65),
  vy: rand(-115, -55),
  g: 260,
  drag: .985,
  r: rand(3, 5),
  life: rand(.36, .52),
  rot: rand(0, Math.PI * 2),
  vr: rand(-5, 5),
  color: '#EF9B9C',
  blend: 'source-over',
  shrink: true
});
```

### 連點與重擊判斷

連續點擊間隔 `<=180ms`，第三擊起採八顆配方，方紙初速度乘 1.15；間隔超過 180ms 回普通配方。尺寸與種類不再升級。

這是粒子的連點條件，可獨立於既有角色擠壓 combo。

「一刀開封」現有設定是 ×10、一次充能。啟動技能時只在技能卡顯示待用；真正吃到倍率的下一次點擊才演重擊。×10 沒有實際完成這一包時，不強制顯示撕開圖。

### 浮字與粒子整合

- 起點為撕口上方 12px。
- 金幣圖示 18px＋數字 20px／700，文字 `#30251F`。
- 480ms 向上移動 36px，最後 160ms 淡出。
- ×10 數字 26px；只顯示實際收益，不另外疊一條「×10 傷害」。
- 連點沿用同一窄區，不採目前左右三道分散起點。
- 可在 120ms 內合併更新同一浮字；粒子仍每次有效點擊都有。
- 錢包只更新數值，不再同步飛幣、閃光或跳動。

同一次輸入若兼有跨階段、重擊、開封，先合成一個演出描述；優先序為 **重擊＞完成／跨狀態＞普通**，避免 `click()` 與 `render()` 各噴一次。

### Canvas 接線

目前 `#fx`／`#fx-under` 在隱藏的招募層內；`createScope()` 只隔離粒子生命週期，**不建立獨立 renderer**。

下一輪採既有單一 renderer、依畫面切換：

1. 主畫面新增 960×640 的 `#click-fx`，放在角色／包裝之上、浮字之下，`pointer-events:none`。
2. 舞台錨點加上舞台全畫面偏移後傳給粒子。
3. 進招募前停止主畫面 scope，再把 `GachaFx.init()` 指向招募 canvas。
4. 招募退出、runtime 清理後，把 renderer 指回 `#click-fx`，建立新的主畫面 scope。
5. 現有招募初始化的 `initialized` 判斷須調整：切回主畫面後，下次招募仍必須重新綁定 canvas。

不新增常駐粒子更新迴圈；沿用 GachaFx 無粒子時自然停 rAF 的行為。這裡不修改角色其他動畫或既有閒置規則。

每秒八次、每次八顆是 **64 顆／秒的生成率**；本規格壽命最多 .65 秒，單純連點同時在場數低於 64。重擊替換普通配方，不另外疊加。

## 5. 要素材的部分：英文 prompt 草稿

本輪沒有生成圖片。下一輪先把 `docs/cast.png` 當風格參考，確認完整袋主稿，再依同一主稿產生狀態；不要五次各自獨立設計。

### 必要：完整包裝主稿

> Create one upright snack pouch for a small handmade toy clicker game. Use the supplied character reference as the visual style authority, as if the same illustrator drew both: thick warm-black outlines, gently imperfect contours, soft pastel flat fills, simple playful shapes, sticker-like illustration without a white sticker border. Coral pink body (#EF9B9C), cream front label (#FFF6E6), one simple smiling mascot face emblem and a small three-cracker illustration. Front view, approximately 0.65 width-to-height ratio, straight vertical placement, two crimped seal lines, at most two flat fold shapes. No readable text. Deliver one 384×512 RGBA PNG with genuine transparent alpha. Center at x192, bottom baseline y480, main side boundaries approximately x48 and x336, top seal around y24. Keep generous transparent margins. No cast shadow baked into the image, no glossy rendering, gradients, glow, realistic texture, scenery, watermark, or checkerboard background.

### 必要：由主稿延伸四個受損狀態

> Edit the supplied approved pouch, preserving the exact same physical object and the character reference style. Produce four separate registered damage-state images: a tiny notch at the upper-right seal; a tear extending leftward across the top seal; a nearly detached top seal still attached at one side; and an opened mouth with a dark flat interior and the torn flap still attached. Damage must progress cumulatively along the same top seam. Preserve the exact front label, mascot emblem, crackers, body colors, side seams, bottom contour, scale, camera angle, center x192, and bottom baseline y480. Each image must be a separate 384×512 RGBA PNG with genuine transparent alpha, aligned to the supplied sealed master. Do not redesign or rotate the bag. No floating tear stickers, pasted-on cracks, detached decorative strips, baked shadows, white outlines, glow, gradients, text, watermark, or checkerboard background.

素材驗收：五張疊放時底邊、標誌與側縫不能跳；以實際 120×160px 顯示仍能辨別四段損傷。PNG 要有實際 alpha，不能把棋盤格畫進去。Prompt 是規格，不能取代驗收。

### 選配：真正平塗的紙屑

既有 VFX 足以完成第一批改動；這項不阻擋實作。

> Create a 2×2 sprite sheet of four tiny flat paper fragments for the supplied character art style: a coral square scrap, a cream irregular scrap, a coral folded chip, and a small golden four-point accent. Thick warm-black outlines appropriate for display at 8–14 pixels, two flat colors per fragment at most, playful handmade toy sticker illustration by the same illustrator as the reference. A 256×256 RGBA PNG, four equal 128×128 cells, one centered fragment per cell with clear transparent gutters. Genuine transparent alpha. No gradients, glow, soft halo, realistic texture, cast shadow, white sticker border, text, or checkerboard background.

此為獨立新貼圖，不覆蓋共用 `gacha-vfx.png`。需要專用取格／繪製入口才能使用，不能直接把新圖當原 4×4 表。

桌墊、膠帶量尺、UI 紙板與縮圖皆不需要生圖。

## 6. 下一輪工作分堆

### A. 不生素材就能改——先做

1. 主画面色板、粗描邊、硬陰影與字級；移除全畫面紙紋背景及大舞台框。
2. 商店主次按鈕、實色禁用狀態與局部通知。
3. 新增底部夥伴列，三技能槽改工具牌；名冊增加明確裝備入口。
4. 移除舞台隊員；入隊飛到夥伴格；寄生改宿主頭像標籤。
5. CSS 紙板桌墊、接觸影、膠帶量尺；先沿用既有包裝圖。
6. 撤除撕痕貼紙演法。
7. 接通主畫面 canvas、每次點擊粒子、同落點浮字、連點與 ×10 重擊。

### B. 要素材才能改

1. 產生並驗收同一袋子的五狀態 PNG。
2. 接入受損門檻、狀態彈動及完成過場，換掉舊包裝素材的使用。
3. 如既有粒子仍太像光點，再製作平塗紙屑並接入專用貼圖。

A 完成即可先交付一版實機畫面；五狀態包裝是 B 的必要交付，不以三張裂痕替代。

## 7. 下一輪驗收畫面

以同一 960×640 邏輯尺寸、DPR 1.25 留圖：

- 一位夥伴、六位夥伴、超過六位夥伴：主舞台都只有珍母與包裝。
- 未裝備、冷卻、技能可用：三格用途一眼可辨，文字沒有縮到 9–10px。
- 寄生中：只有宿主小標籤，夥伴列位置不消失。
- 新夥伴／重複夥伴收下：飛向正確格，不進舞台。
- 包装五階段：底邊、品牌標誌不跳動，破口確實改變封口輪廓。
- 普通點擊、連點、×10：每擊有回饋，所有主要回饋集中在袋口。
- 一擊跨多階段／多包：只演一次，過場後顯示最新進度。
- 主畫面→招募→返回→再次招募：兩邊粒子都顯示在正確 canvas。

本輪僅完成唯讀診斷與規格；未執行實作、生成素材或宣稱以上驗收已通過。