# ClawdPet 抽卡共同設計：第一輪定案提案

本輪只提供設計與程式規格，未改檔、未執行 build。以下數值是第一版實作基準，尚未經實機動畫與聽感驗證。

**建議定案：卡面保留 A 的厚框、角色比例與名牌結構，加入 F 的玻璃內緣與局部透光。演出先保留五張，第一個新增模式做「流星投遞」。**

這輪實驗應比較「期待感如何建立、揭曉由誰控制」，不要同時改卡池與保底，否則很難判斷體驗差異來自哪裡。

## 一、定案卡面：A 的實體感，F 的局部透光

### 1. 現況判讀

A 最好的地方是角色清楚、卡片像實物、下面有固定的資訊位置。F 最好的地方是畫窗有一層薄玻璃，稀有度光能從裡面透出。

我不同意直接把 F 疊到 A 上，原因有三個：

- F 的全幅點陣會穿過角色周圍與名牌，把可愛收藏卡拉向科技儀表板。
- F 的名字發光會吃掉繁體字細節；縮成圖鑑後更明顯。
- A 目前傳說揭曉同時出現雙大環、射線、90 條亮線、40 顆餘燼與18 顆星，中心立繪反而被遮住。「昂貴」應來自停頓與材質層級，不靠每個參數一起加大。

另有三個實作接點必須修：

1. `.face-holo`、`.face-glare` 已有 CSS，但目前 `buildCard()` 沒建立這兩個節點。
2. `ready` 卡包呼吸、掃光及光暈仍是無限 CSS 動畫。
3. `.live` 在游標停住後仍持續跑 rig rAF；餘燼也持續循環。這不符合本輪的閒置限制。

### 2. 卡面幾何

沿用 `150×210px`，不放大角色、不裁掉腳與尾巴。

| 元件 | 定案尺寸／位置 | 用途 |
|---|---|---|
| `.card-face` | 150×210，圓角12 | 深藍實體卡底 |
| `.face-frame` | inset 0，外黑線1，色框3～4 | A 的重量來源 |
| `.face-art` | x10、y10、130×148 | 沿用角色最高128px |
| `.face-plate` | x10、y166、130×34 | 獨立玻璃名牌 |
| `.face-gem` | 中心x75、y158 | 畫窗與名牌的接點 |
| `.face-name` | 13px／行高17px | 不發光；長名稱完整顯示 |
| `.face-rarity` | 10px／行高12px | 使用較亮同色文字，避免深藍字難讀 |
| `.face-tag` | top15、right15，最高18px | 沿用 NEW／重複提示 |
| `.face-holo` | 畫窗內 inset 0 | **新增實際節點**，鍍膜只蓋畫窗 |
| `.face-glare` | 畫窗內 inset 0 | **新增實際節點**，小範圍反光 |

`ART_SCALE = 128 / 198`、template 組裝、`CHAR_CFG` 比例先不動。玻璃感使用透明漸層與內陰影，不用 `backdrop-filter`。

### 3. 四階差異

| 稀有度 | 靜態結構 | 光與材質 | 未翻面的辨識 |
|---|---|---|---|
| 普通 | 3px灰框、10px平面方鑽 | 霧面，無外暈、無餘燼 | hover只有細灰內緣 |
| 精良 | 3px藍框、12px鑽石、名牌上緣1px色線 | 一條冷白反光 | hover藍光，220ms內到位 |
| 史詩 | 4px紫框、14px鑽石、四個內角扣 | 紫／淡紫雙層反光 | hover四角先亮，260ms完成 |
| 傳說 | 4px橘框、16px鑽石、頂部三齒扣、雙層名牌邊 | 暖白高光，橘光限制在框邊 | **未hover也有靜態橘色內漏光及頂部扣形** |

傳說「不用翻就知道它貴」必須真的出現在卡背。只修改正面框線，無法達成這個要求。

三齒扣是小型卡套扣件，寬24px、高8px，不做巨型皇冠，也不加入羽翼。

### 4. 可直接貼到 `gacha.css` 尾端的覆寫

在 `#table` 加 `skin-af`。此版本不依賴 `_cardlab.html` 的 `.vF`。

以下 CSS 完成靜態卡面、卡背差異與動態外觀；JS 動態數值與節流另見下一節。

```css
/* A + F：厚框、暗玻璃、局部透光 */
.skin-af .card {
  --rim: 3px;
  --rim-hi: #b8babd;
  --ink-rarity: #b8babd;
  --wash: rgba(157, 157, 157, .06);
  --gem: 10px;
  --foil: .08;
  --glare: .05;
  will-change: auto;
}

.skin-af .card.r-rare {
  --rim-hi: #78baff;
  --ink-rarity: #78baff;
  --wash: rgba(0, 112, 221, .14);
  --gem: 12px;
  --foil: .15;
  --glare: .09;
}

.skin-af .card.r-epic {
  --rim: 4px;
  --rim-hi: #d5a2ff;
  --ink-rarity: #d5a2ff;
  --wash: rgba(163, 53, 238, .17);
  --gem: 14px;
  --foil: .20;
  --glare: .12;
}

.skin-af .card.r-legendary {
  --rim: 4px;
  --rim-hi: #ffd28a;
  --ink-rarity: #ffc477;
  --wash: rgba(255, 128, 0, .20);
  --gem: 16px;
  --foil: .26;
  --glare: .15;
}

.skin-af .card-face {
  padding: 0;
  border-radius: 12px;
  background: linear-gradient(160deg, #202b43, #0d1423 65%);
  box-shadow: 0 8px 14px rgba(0, 0, 0, .46);
}

.skin-af .face-frame {
  inset: 0;
  z-index: 5;
  border: 1px solid #101217;
  border-image: none;
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 var(--rim) var(--rc),
    inset 0 0 0 calc(var(--rim) + 1px) rgba(255, 255, 255, .14),
    inset 0 0 0 calc(var(--rim) + 3px) #101827;
}

.skin-af .face-art {
  left: 10px;
  right: 10px;
  top: 10px;
  height: 148px;
  border: 0;
  border-radius: 7px;
  isolation: isolate;
  background:
    radial-gradient(ellipse 85% 48% at 50% 100%,
      var(--wash), transparent 80%),
    linear-gradient(160deg, #29364f, #141d30 75%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, .12),
    inset 0 2px 0 rgba(255, 255, 255, .04);
}

.skin-af .face-art > svg,
.skin-af .face-art > img,
.skin-af .face-art > .emoji {
  position: relative;
  z-index: 1;
}

.skin-af .face-art .floor {
  height: 10px;
  bottom: 8px;
  filter: none;
  background: radial-gradient(ellipse,
    rgba(0, 0, 0, .36), transparent 72%);
}

.skin-af .face-plate {
  left: 10px;
  right: 10px;
  bottom: 10px;
  height: 34px;
  padding: 2px 3px;
  gap: 0;
  border: 1px solid rgba(255, 255, 255, .10);
  border-top-color: var(--rc);
  border-radius: 6px;
  background: linear-gradient(180deg, #151c2b, #090e18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
}

.skin-af .face-name {
  max-width: 100%;
  font-size: 13px;
  line-height: 17px;
  letter-spacing: .04em;
  color: #fff1d2;
  text-shadow: 0 1px 0 #000;
  white-space: nowrap;
}

.skin-af .face-rarity {
  font-size: 10px;
  line-height: 12px;
  letter-spacing: .22em;
  color: var(--ink-rarity);
  text-shadow: none;
}

.skin-af .face-gem {
  z-index: 6;
  top: calc(158px - var(--gem) / 2);
  left: 50%;
  width: var(--gem);
  height: var(--gem);
  margin-left: calc(var(--gem) / -2);
  border: 1px solid var(--rim-hi);
  border-radius: 2px;
  background: linear-gradient(135deg,
    var(--rim-hi), var(--rc) 45%, #202333);
  box-shadow: 0 0 0 2px #101827;
}

.skin-af .r-common .face-gem {
  background: #9d9d9d;
  border-color: #b8babd;
}

.skin-af .r-epic .face-frame::after,
.skin-af .r-legendary .face-frame::after {
  content: "";
  position: absolute;
  inset: 5px;
  border-radius: 7px;
  background:
    linear-gradient(var(--rim-hi), var(--rim-hi))
      left top / 13px 2px,
    linear-gradient(var(--rim-hi), var(--rim-hi))
      right top / 13px 2px,
    linear-gradient(var(--rim-hi), var(--rim-hi))
      left bottom / 13px 2px,
    linear-gradient(var(--rim-hi), var(--rim-hi))
      right bottom / 13px 2px;
  background-repeat: no-repeat;
}

.skin-af .r-legendary .face-frame::before,
.skin-af .r-legendary .card-back::after {
  content: "";
  position: absolute;
  z-index: 2;
  left: calc(50% - 12px);
  top: 3px;
  width: 24px;
  height: 8px;
  background: #ffd28a;
  clip-path: polygon(
    0 100%, 0 30%, 25% 58%, 50% 0,
    75% 58%, 100% 30%, 100% 100%
  );
}

.skin-af .r-legendary .face-plate {
  box-shadow: 0 0 0 1px #5b3216,
    inset 0 0 0 1px rgba(255, 196, 119, .10);
}

.skin-af .face-tag {
  top: 15px;
  right: 15px;
  z-index: 7;
  font-size: 9px;
  line-height: 14px;
  padding: 1px 5px;
  letter-spacing: .04em;
}

/* 卡背：靜態預告不需要動畫 */
.skin-af .card-glow {
  animation: none !important;
  box-shadow: 0 0 18px 2px var(--rc-b);
}

.skin-af .back-leak {
  box-shadow: inset 0 0 12px 1px var(--rc-b),
    inset 0 0 0 2px var(--rc);
}

.skin-af .r-common .card-glow,
.skin-af .r-common.live .card-glow {
  opacity: 0;
}

.skin-af .r-common .back-leak {
  box-shadow: inset 0 0 0 1px #9d9d9d;
}

.skin-af .r-legendary:not(.flipped) .back-leak {
  opacity: .55;
}

.skin-af .r-legendary:not(.flipped):hover .back-leak,
.skin-af .card.charging .back-leak {
  opacity: 1;
}

.skin-af .card.flipped .card-glow {
  opacity: .25;
}

.skin-af .card.live .card-glow {
  opacity: .35;
}

/* 鍍膜節點放在 face-art 裡，避免洗白名字與框線 */
.skin-af .face-holo,
.skin-af .face-glare {
  inset: 0;
  z-index: 2;
  border-radius: 7px;
  mix-blend-mode: screen;
  pointer-events: none;
}

.skin-af .face-holo {
  background: linear-gradient(115deg,
    transparent calc(var(--mx) - 18%),
    var(--rim-hi) var(--mx),
    transparent calc(var(--mx) + 18%));
}

.skin-af .face-glare {
  background: radial-gradient(circle at var(--mx) var(--my),
    #fff5df, transparent 24%);
}

.skin-af .card.live .face-holo {
  opacity: calc(var(--foil) * (.4 + var(--tilt) * .6));
}

.skin-af .card.live .face-glare {
  opacity: var(--glare);
}

/* 入場才跑一次；不要因 pointermove 重加 live-enter */
.skin-af .face-embers i {
  animation: none;
  box-shadow: 0 0 4px var(--rc);
}

.skin-af .card.live-enter .face-embers i {
  animation: af-ember 900ms ease-out 1 both;
}

.skin-af .face-embers i:nth-child(n + 5) {
  display: none;
}

.skin-af .r-epic .face-embers i:nth-child(n + 3) {
  display: none;
}

@keyframes af-ember {
  0% { transform: translateY(0); opacity: 0; }
  18% { opacity: .55; }
  100% { transform: translateY(-38px); opacity: 0; }
}

.skin-af .card.flipped .face-sheen {
  animation: none;
}

.skin-af .card.reveal-pop .face-sheen {
  animation: face-sheen 550ms ease-out 1 both;
}

/* 圖鑑：保留結構，移除細碎特效 */
.skin-af .mini { height: 135px; }

.skin-af .mini .card {
  --foil: .08;
  --glare: .04;
}

.skin-af .mini .face-name {
  font-size: 15px;
  letter-spacing: 0;
}

.skin-af .mini .face-rarity {
  display: none;
}

.skin-af .mini .face-holo,
.skin-af .mini .face-glare,
.skin-af .mini .face-embers,
.skin-af .mini .face-frame::after {
  display: none;
}

.skin-af .mini.locked .card {
  filter: none;
}

.skin-af .mini.locked .face-art > svg,
.skin-af .mini.locked .face-art > img,
.skin-af .mini.locked .face-art > .emoji {
  filter: brightness(0) !important;
  opacity: .72;
}

.skin-af .mini.locked .face-art {
  background: #1b2538;
}

.skin-af .mini.locked .face-name {
  visibility: hidden;
}

.skin-af .mini.locked .face-plate::after {
  content: "未擁有";
  color: #aeb7c8;
  font-size: 15px;
}

.skin-af .mini.locked::after {
  display: none;
}

/* ready 是等待狀態：只能靜態提示 */
.skin-af.table.state-ready .pack-body,
.skin-af.table.state-ready .pack-shine,
.skin-af.table.state-ready .pack-glow {
  animation: none;
}

.skin-af .pack { will-change: auto; }

@media (prefers-reduced-motion: reduce) {
  .skin-af .face-embers { display: none; }
}
```

補節點的位置：

```html
<div class="face-art">
  <div class="floor"></div>
  <!-- buildArt(entry) 建立的 SVG／PNG／emoji -->
  <!-- 史詩、傳說才建立 face-embers -->
  <div class="face-holo"></div>
  <div class="face-glare"></div>
</div>
```

此 CSS 保留 `.card-inner` 翻面責任，沒有改它的 `rotateY(180deg)`。

### 5. `.live` 動態定案

現行最高14°傾斜、立繪持續蹬腳與跳動，太像「展示模型」。定案改為拿起卡片看一眼，角色短暫回應。

| 項目 | 普通 | 精良 | 史詩 | 傳說 |
|---|---:|---:|---:|---:|
| 最大 X／Y 傾斜 | ±4° | ±5° | ±6° | ±7° |
| hover 上提，總位移 | −8px | −8px | −9px | −10px |
| hover scale | 1.035 | 1.04 | 1.045 | 1.05 |
| 立繪最大視差 | 1px | 1.5px | 2px | 2.5px |
| 鍍膜峰值透明度 | .08 | .15 | .20 | .26 |
| 一次餘燼數 | 0 | 0 | 2 | 4 |
| 餘燼顏色 | — | — | 淡紫 | 橘色，最多1顆暖白 |

JS 修改原則：

- 視差改用 `nx / ny × amplitude`，不要沿用目前依角度乘 `.55 / .45` 的放大方式。
- pointerenter：立繪單次800ms呼吸；第280ms閉眼，390ms張眼。
- 肢體只選一組：有尾巴先輕搖尾巴±2°；無尾巴才用右手±3°。不要腳、手、尾巴一起動。
- 玩具／emoji只在進入時做一次160ms壓縮至 `scale(1.02,.98)`，再200ms回正；取消連續跳躍。
- rAF只在傾斜尚未收斂，或800ms入場動作未結束時執行。
- 角度誤差小於 `.05°` 即停止；pointermove才重新喚醒。
- pointerleave：220ms回正；移除 `.live-enter`，恢復所有 rig 原始屬性。
- 同一張卡的入場動作冷卻1500ms；停著不會自動再眨眼、再飄餘燼。
- 圖鑑最高±3°、scale 1.025、上提2個畫面像素；不跑rig、餘燼與鍍膜，只保留短暫傾斜。
- `blur`、頁面隱藏、開圖鑑、收下、模式切換時，都呼叫共用停止函式。

**刪除史詩彩虹鍍膜與 `color-dodge`。**紫色稀有度不需要突然出現青／黃兩種語彙；白色角色也不該被鍍膜洗成發光剪影。

### 6. 圖鑑與黑影

`.64`後卡面是 `96×134.4px`，外盒改135px，避免分數像素高度被截。

圖鑑已按稀有度分區，因此縮圖不再重複顯示稀有度小字；名字升至原始15px，顯示約9.6px。保留粗框、中央鑽石與傳說頂扣。

未擁有狀態只把**立繪**變成黑影，卡框保持稀有度色。整卡 `grayscale + brightness(.35)` 會連分類提示都一起壓掉，應移除。

黑影不晃、不hover、不顯示NEW或數量。可讀名稱與 `aria-label` 同步改為「未擁有的傳說卡」等描述，不能只用CSS藏住視覺名字。

**故意不要的F元素：**全幅點陣、名字霓虹光、發光地板、每個內框都泛光、卡面穿透看見桌布。保留玻璃的邊與反射即可。

---

## 二、四種抽卡演出模式

### 1. 所有模式共同遵守的規則

**這版正式入口維持一包五張。**現行 `rollPack()` 的五張精良保證與十包傳說保底，不因模式而改。

下面的單抽／十連是未來演出能力，不代表本輪要開放新抽法。未來十連可由宿主產生兩包五張，再合併給演出；單抽的保底如何計數需由宿主另外定義，模式不得自行決定。

時間軸約定：

- `t=0`是有效抽取操作成立、結果已準備好的瞬間。
- 素材須在允許抽取前載入；載入耗時不算演出。
- 表內時間是目標節拍；手動等候標為 `W`，不能假裝玩家一定準時點。
- 除拆包模式外，都提供「自動／逐張」，預設自動。拆包預設逐張。
- 所有模式從200ms起出現「略過演出」；點擊後180ms內進入全部揭曉的總覽。
- 略過會停掉後續音效、粒子、計時器；**不自動收下，也不重抽。**
- 等玩家時所有動畫都停下，保留靜態預告。
- 頂列與收下按鈕不跟著鏡頭震動；震動只作用在演出區。
- `prefers-reduced-motion` 下取消傾斜、震動與高速移動，以120～180ms淡入替代；JS也要讀設定，不能只靠現有CSS。

五張總覽沿用 `FAN` 的位移與角度。下文新增模式以桌內中央 `(470,310)` 為構圖中心；現行 `(480,330)`與 `pt()` 的10px邊框換算集中交由宿主處理，模式不可各算一次zoom。

未來十連總覽採两排五張：

- 卡片scale `.82`，不旋轉。
- x：142、306、470、634、798。
- y：218、416。
- 卡片本體123×172.2px；收下按鈕保持在底部。

### 2. 稀有度預告：共同語法

| 稀有度 | 色 | 靜態形狀 | 聲音提示 | 節奏 |
|---|---|---|---|---|
| 普通 | `#9d9d9d` | 單線／小點 | 乾短聲，無鐘 | 不蓄力 |
| 精良 | `#0070dd` | 單層菱形 | 880Hz短音 | 一次到位 |
| 史詩 | `#a335ee` | 雙層菱形／四角扣 | 1174Hz＋弱五度 | 多一次分層 |
| 傳說 | `#ff8000` | 三齒扣／分叉尾／雙光門 | 1568Hz提示＋低音支撐 | **先減速，留一小段空白，再落下** |

批次預告表示「本批最高稀有度」，不表示每张都是該階，也不暗示傳說數量。提示旁可用小字「本次最高」。

禁止普通冒出橘色後再變回灰色；第一版不做假升階。

可以隨機：

- 路徑偏移±12px。
- 碎片方向±15°。
- 預先準備的三組粒子種子。
- 非關鍵動作長度±40ms。

不能隨機：

- 預告色與實際稀有度的關係。
- 傳說的關鍵靜默與揭曉音落點。
- 卡片順序、張數、重複標記。
- 點擊後是否翻得動、長按是否提高中獎率。

演出亂數使用獨立 `visualSeed`。相同一手牌、相同seed可重播四種模式，才方便做體驗比較。

### 3. 共用揭曉節拍 R

模式可借用此節拍，但**只能有一份揭曉音與一份揭曉特效**。不能舞台先敲一遍鐘，共用 `flip()` 再敲一遍。

| 從揭曉請求起 | 普通／精良／史詩 | 傳說 |
|---|---|---|
| 0ms | 開始翻面，`Audio.flip()` | 畫面局部壓暗至.48，卡上提8px |
| 0–320ms | 翻面 | 色框收亮，低頻48→62Hz |
| 320–440ms | 已進入落定段 | 動作停120ms；蓄力聲淡出，不加新聲 |
| 440–920ms | — | 480ms翻面 |
| 240ms／680ms | 普通組於240ms露正面；播放該階揭曉音 | 傳說於680ms露正面；鐘與180ms震動同時落 |
| 結束 | 普通540ms、精良640ms、史詩780ms | 1280ms，壓暗與光束退完 |

普通組翻面統一480ms；史詩較長的部分是落定，不是延遲可讀名字。

特效收斂為：

- 普通：無粒子，卡片落定即是回饋。
- 精良：8條短光線，最長12px、生命240ms。
- 史詩：12顆邊緣碎光，生命420ms；不全畫面震動。
- 傳說：6束卡後光線＋20條外緣短線，生命最多600ms。
- 傳說不畫目前兩個520／700px大環，卡片中央60×100px不放前景粒子。

### 4. 模式一：拆包桌面 `hearthstone`

**概念：拆開一包實體收藏卡，再親手挑選先翻哪張。**沿用原需求的爐石節奏，作為所有新模式的操作基準。

#### 分鏡

拖包至中央仍是抽取前操作；尚未點撕開，不產生結果、不增加包數。

| 時間 | 畫面與鏡頭 | 聲音 | 操作 |
|---|---|---|---|
| 0–120ms | 卡包向下壓3px、橫向縮至.98 | 紙張受力短聲 | 鎖定再次抽取 |
| 120–360ms | 頂封條向右上撕走，位移90／−140px | 現有tear縮為240ms | 可略過 |
| 360–500ms | 卡包張開，中心暖白亮度最高.25 | 輕版burst | 無整桌震動 |
| 500–1320ms | 五張卡背飛出；起點500＋80i，單張500ms落定 | `deal(i)`對齊起飛 | 暫不可翻 |
| 1320ms | 扇形静止，傳說卡背保留靜態橘漏光 | 無 | 逐張可選，或全部翻開 |
| `Wᵢ`後 | 被選卡執行共用R | 共用R | 本張完成後可再翻 |
| 最後一張R結束＋180ms | 收下出現，卡面可hover | 無額外成功音 | 可收下 |

「全部翻開」按既有排列逐張執行R，間隔80ms；不額外把傳說搬到最後。

無傳說、五張全精良的自動路徑約：

`1320 + 5×640 + 4×80 + 180 = 5020ms`，不含拖包時間。

#### 預告與變化

不預告整包最高階，讓玩家自己靠近探查。卡背hover提示每卡冷卻800ms，避免滑過整排變成電子琴。

傳說hover只有一次180ms框邊收亮；真正的停頓留給翻牌。隨機只改封條旋轉±6°及碎片路徑。

#### 單抽／十連

- 單抽：一張直立置中；發牌500–1000ms，其餘沿用R。
- 十連：採兩排卡背；第i張於500＋50i起飛、500ms落定，1450ms可操作。
- 第一版仍只顯示五張入口。

#### 元件與聲音工作量

| 項目 | 技術 | 約略增改行數 |
|---|---|---:|
| 縮短撕包、移除常駐待機 | CSS | 35–50 |
| 邊緣揭曉特效替換 | canvas | 60–90 |
| 手動／全部翻開接點 | JS | 45–65 |
| 輕版burst | WebAudio | 15–25 |

輕版burst：`tone(95→55Hz, sine, A3/D180/R50ms, gain .18)`；加 `noiseHit(lowpass, 1200→500Hz, A3/D100/R40ms, gain .09)`。取消現行每包70Hz重低音、長掃頻與大震動。

#### 狀態接點

沿用 `idle → dragging → ready`；`tearing`成為模式內階段；發牌共用 `dealing`，等待共用 `fanned`，傳說使用共用揭曉鎖，最後接 `collecting`。

---

### 5. 模式二：流星投遞 `wish`

**概念：一顆帶著包裹的流星飛過桌面，尾光先透露本批價值，落下才散成卡片。**借用使用者提到的祈願「軌跡＋顏色預告」，但保留桌面玩具比例，不做寫實天空。

美術上只借用夜空中單一運動主體的留白感；官方流星題材影片可作色面参考，並非本案抽卡時間軸依據。[《A Wish Upon Shooting Stars》官方影片](https://www.youtube.com/watch?v=3C-VmlwBVro)

#### 分鏡

| 時間 | 畫面與鏡頭 | 聲音 | 操作 |
|---|---|---|---|
| 0–120ms | 中央72px紙封菱形壓縮至.92 | 一聲輕扣 | 鎖定抽取 |
| 120–480ms | 紙封升至右上 `(800,130)`，縮至24px | 風聲淡入 | 可略過 |
| 480–1040ms | 彎曲飛向中央；一條粗尾、最多12粒尾屑 | 風聲抬升 | 不需拖曳 |
| 720–880ms | 尾光由中性白轉成本批最高稀有度色 | 該階提示音一次 | 顏色真實預告 |
| 1040–1160ms | 普通至史詩直接靠近落點；傳說懸停，尾光裂成兩叉 | 傳說此120ms不加聲 | 可略過 |
| 1160–1400ms | 落點 `(470,310)`，紙封展成卡背小堆 | 一聲落桌；傳說低音較深 | 不播放揭曉鐘 |
| 1400–2040ms | 卡背散開；起点1400＋60i，單張400ms | `deal(i)`降低音量 | 等待發完 |
| 2040ms起 | 自動模式依序執行R，間隔80ms | 共用R | 可改逐張或略過 |
| 最後R＋180ms | 全部總覽、收下 | 無 | hover／收下 |

逐張設定下，2040ms停在靜態扇形；之後時間是 `Σ(Wᵢ+Rᵢ)`。

五張全精良、自動揭曉约5740ms。流星落地只是開包，**不准在落地先放傳說全套煙火**。

#### 預告與變化

- 普通：短直尾，寬3px，無分叉。
- 精良：尾寬5px，有一顆菱形頭。
- 史詩：兩條相距6px的尾線，第二條延後40ms跟隨。
- 傳說：主尾8px、末端分叉；1040ms固定減速，橘色持續至卡背可見。

批次飛行時間固定，不以整段拖慢來表達高稀有度。只讓傳說在落點前短暫懸停。

路徑從三條預設Bézier中選一條，控制點偏移最多12px；不隨機飛行方向，以免每次都重新找畫面主體。

#### 單抽／十連

- 單抽：不散成五張；1400–1800ms將一張卡背落在中央，再執行R。
- 十連：只有一顆主流星，落地後十張兩排展開；不播兩次起飛。
- 十連發牌1400＋40i、單張400ms，2160ms完成，之後R按結果順序跑。
- 不在天空畫十條流星；小畫布會變成粒子雨。

#### 新增元件

| 項目 | 技術 | 約略行數 |
|---|---|---:|
| 72px紙封／菱形 | SVG，3px黑邊、平塗 | 20–30 |
| 主軌跡、雙尾、尾屑 | canvas，有期限的layer | 85–120 |
| 局部夜色遮罩 | CSS | 15–25 |
| 模式時間軸與收尾 | JS | 100–140 |

#### 新增合成音效

下列A／D／R均以毫秒表示，映射現有工具參數時除1000。

| 音效 | 配方 |
|---|---|
| 投遞啟動 | `tone(440→660Hz, triangle, A3/D90/R30, gain .10)` |
| 飛行風 | `noiseHit(bandpass, 700→2800Hz, Q .7, A100/D480/R120, gain .10)` |
| 色階提示 | 880／1174／1568Hz sine，A15/D180/R100，gain .05，送verb；普通略過 |
| 普通落點 | 120→75Hz sine，A3/D150/R40，gain .16 |
| 傳說落點 | 75→45Hz sine，A4/D240/R70，gain .22；**不加bell** |

傳說1040ms靜默前，要讓飛行風與提示音已收乾，不只是停止建立新音符。

#### 狀態接點

`idle → presenting(mode: launch / flight / landing) → dealing → fanned → collecting`。

新增的launch等是模式內階段，不擴充全域狀態。`fanned`與共用R全部沿用。

---

### 6. 模式三：腳印召喚陣 `summon`

**概念：蓋下一枚腳印印章，五個卡位沿圓陣依序點亮，卡片從桌面立起。**借用FGO召喚陣與卡階辨識的語彙，改成寵物玩具印章；不用神祕文字和符文牆。

#### 分鏡

| 時間 | 畫面與鏡頭 | 聲音 | 操作 |
|---|---|---|---|
| 0–160ms | 腳印印章向下壓6px，影子收緊 | 橡膠印章低短聲 | 鎖定抽取 |
| 160–600ms | 半徑152px的圓環描出；五個卡位出現 | 短擦聲，後接微弱共鳴 | 可略過 |
| 600–1000ms | 每80ms點亮一個卡位，顏色對應各張結果 | 五次低音量色階提示 | 能先看出哪個卡位稀有 |
| 1000–1200ms | 普通組圓陣停止；若有傳說，第二層環反向轉12°後停住 | 傳說低頻收緊 | 無玩家等待 |
| 1200–1320ms | 傳說中心腳印收成一道橘邊，靜止120ms | 留白 | 可略過 |
| 1320–1960ms | 卡背從各卡位立起、排成扇形；起點1320＋60i、400ms落定 | `deal(i)` | 不再另播爆破 |
| 1960ms起 | 預設自動R，間隔80ms；逐張模式則停住 | 共用R | 可選卡／略過 |
| 最後R＋180ms | 召喚陣180ms淡出，收下出現 | 無額外結尾音 | 收下 |

沒有傳說也維持相同總長，1200–1320ms是一個普通落定間隔，不裝出傳說蓄力。

#### 預告與變化

五個卡位位置固定，顏色真實對應之後那張卡，**不可發牌後洗牌**。

形狀對應單環、菱形、雙菱形、三齒扣。傳說除了橘色，卡位外多一層6px間距環，避免只靠色覺辨識。

只允許外圓起始角在−8°、0°、8°中選。腳印方向與卡位編號固定；不做「亂轉一圈抽到哪裡」的輪盤假象。

#### 單抽／十連

- 單抽：圓環半徑110px，只亮中央卡位；卡片於1320–1720ms立起。
- 十連：外圈畫10個小型位置標記，每40ms點亮一個。
- 十連發牌1320＋40i、400ms落定，2080ms完成，进入两排總覽。
- 中央不要真的放10張完整卡圍成圓圈；150px卡寬會互相遮擋。

#### 新增元件

| 項目 | 技術 | 約略行數 |
|---|---|---:|
| 腳印印章 | SVG：一個掌墊＋四個橢圓 | 15–25 |
| 雙圓環與卡位符號 | SVG | 35–55 |
| 描線、短角度旋轉、消退 | CSS／WAAPI | 40–60 |
| 卡位映射與時間軸 | JS | 100–145 |

不需要新增常駐canvas。已有粒子層只在共用R時使用。

#### 新增合成音效

| 音效 | 配方 |
|---|---|
| 印章 | `tone(110→70Hz, sine, A2/D80/R25, gain .18)`＋lowpass噪音650Hz，D35、gain .08 |
| 描環 | bandpass噪音1200→2400Hz，Q2，A20/D240/R60，gain .055 |
| 卡位點亮 | 880／1174／1568Hz triangle，A3/D65/R35，gain .025；普通440Hz |
| 圓陣共鳴 | 196Hz sine＋294Hz sine，A60/D260/R100，gain .025／.012，少量verb |
| 傳說第二環 | 62Hz sine，A80/D100/R60，gain .12；於1200ms前結束 |

卡位提示不使用完整 `bell()`：現有bell單次建立多個泛音，五次連播會過密。

#### 狀態接點

`idle → presenting(mode: stamp / inscribe / telegraph) → dealing → fanned → collecting`。

與流星相同，能完全沿用扇形揭曉與收下。

---

### 7. 模式四：拉幕登場 `stage`

**概念：拉開一座小紙劇場，夥伴先以剪影站到燈下，再露出真面目。**借用角色登場與探照燈揭曉的語彙，重點是「看見角色來了」，不是卡片飛行。

這個模式才真正測試非卡牌中心的演出，因此值得做；但成本最高，不宜先做。

#### 分鏡

開場固定600ms，之後每個結果走自己的登場節拍。

| 時間 | 畫面與鏡頭 | 聲音 | 操作 |
|---|---|---|---|
| 0–160ms | 左右紙幕向內收4px，拉環壓下 | 紙繩扣聲 | 鎖定抽取 |
| 160–420ms | 兩片厚描邊紙幕向外各移150px | 低通摩擦聲 | 可略過 |
| 420–600ms | 舞台底座顯示，頂燈亮成暖白 | 短燈扣聲 | 不做全畫面推近 |
| 600ms起 | 第1位進場，後續按下表串接 | 每人一份揭曉音 | 自動／逐張 |
| 最後一位結束 | 已揭曉卡片180ms排成五張總覽 | 無 | 收下 |

每位進場的局部時間 `s=0`：

| 節拍 | 普通 | 精良 | 史詩 | 傳說 |
|---|---:|---:|---:|---:|
| 剪影進場、燈邊變色 | 0–160 | 0–200 | 0–240 | 0–320 |
| 留白／結構預告 | 無 | 無 | 雙燈交會240–320 | 燈停320–440 |
| 首次露出角色與名字 | 160 | 200 | 320 | 440 |
| 角色展示 | 至440 | 至580 | 至820 | 至1200 |
| 收進結果卡位 | 440–700 | 580–840 | 820–1080 | 1200–1460 |

露出時只改剪影filter／opacity、淡入名字並播放對應 `Audio.reveal()`；**不再呼叫共用翻面R**。否則角色已经露臉還得再等一次翻卡。

角色最高顯示192px，約現有卡內比例的1.5倍。出場後做一次700ms呼吸；不將拆件PNG放大到300px當全屏立繪。

玩家操作：

- 自動：前一位收進卡位後60ms，下一位進場。
- 逐張：每位完成後靜止，顯示「下一位」；點擊或Space進下一位。
- 普通點舞台不當作略過，避免玩家想看角色卻直接跳走。
- 不採用必要長按。長按在桌面滑鼠上增加等待，對此模式沒有實際回饋價值。
- 可隨時使用明確的「略過演出」。

五位全精良自動路徑：

`600 + 5×840 + 4×60 + 180 = 5220ms`。

#### 預告與變化

剪影進場時：

- 普通：單盞窄燈，角度固定。
- 精良：藍色燈邊，光斑由80px擴至120px。
- 史詩：左右兩盞紫邊燈於320ms交會。
- 傳說：先出現橘色雙門縫，320–440ms停住，440ms才把角色打亮。

不預先曝光整批最高階；期待感分配在每位登場。剪影可能讓熟悉角色的玩家猜中身份，這是此模式特色，不必假裝完全保密。

只隨機入場從左或右偏移18px、停步時頭部方向；依rig能力選擇動作，不替不存在的尾巴造假動作。

#### 單抽／十連

- 單抽：一位完成後，結果卡在中央放大至150×210；不顯示空的其餘四格。
- 十連：底部先用十個12px進度點，已揭曉結果以縮小卡片存入；結尾转为两排總覽。
- 不做十個角色同台，避免素材遮擋與rig同時更新。

#### 新增元件

| 項目 | 技術 | 約略行數 |
|---|---|---:|
| 左右紙幕、台座、拉環 | CSS＋SVG | 60–90 |
| 單燈／雙燈／門縫 | SVG漸層＋CSS | 45–65 |
| 角色展示容器 | DOM，呼叫共用buildArt | 35–50 |
| 每人時間軸、結果卡交接 | JS | 160–220 |
| 有限次登場rig動作 | JS，共用rig adapter | 45–70 |

#### 新增合成音效

| 音效 | 配方 |
|---|---|
| 拉環扣 | triangle 240→170Hz，A2/D65/R25，gain .09 |
| 紙幕滑動 | noiseHit lowpass，1600→650Hz，A25/D180/R60，gain .09 |
| 燈亮 | triangle 1200Hz，A2/D35/R20，gain .035 |
| 停步 | sine 130→85Hz，A3/D65/R25，gain .09；toy不播腳步，改輕碰桌面 |
| 傳說門縫 | sine 55Hz，A80/D100/R60，gain .14；另1568Hz短提示，於320ms前收乾 |

傳說440ms露臉時才播放鐘。整批沒有開幕鐘、落幕鐘，保留唯一的重量落點。

#### 狀態接點

`idle → presenting(mode: curtain / entrance / reveal / dock)`。

此模式不使用未翻面的 `fanned` 等候；全部登場後，將已翻卡交給共用結果排列，进入 `fanned`，再接 `collecting`。

因此共用 `fanned` 應解釋成「結果區可互動」，而不只是「五張卡背已攤開」。

---

## 三、模式切換架構

### 1. 最小抽象：一個工廠、一次演出、兩個控制方法

僅有 `open(handEntries) → Promise<void>` 不夠。它沒有說清楚：

- Promise何時結束。
- 如何略過。
- 如何在切換／關窗時取消。
- 誰建立卡片、誰記錄揭曉。
- 模式可否碰存檔。

建議使用classic script的IIFE註冊，避免跨檔頂層 `const` 名稱衝突：

```js
window.GachaModes = window.GachaModes || {};

window.GachaModes.wish = {
  label: '流星投遞',
  counts: [1, 5, 10],

  create(ctx) {
    return {
      // 全部結果已揭曉、排入總覽才 resolve。
      // 不包含按收下，也不負責存檔。
      async open(draw) {
        // draw: { id, entries, visualSeed }
        // entries: [{ key, entry, dup }]
      },

      // 停止演出，交由宿主180ms呈現完整總覽。
      skip() {},

      // 可重複呼叫；釋放本模式資源。
      dispose() {}
    };
  }
};
```

`counts`是演出能力，**不是抽取規則或入口開放名單**。

`key`必須是單次抽取內的唯一值，例如 `draw.id + ':' + index`。不能用角色id當key，同包可能抽到兩張相同角色。

### 2. `ctx`只給演出需要的能力

| 接口 | 責任 |
|---|---|
| `root`、`size`、`center` | 模式自己的DOM容器、可用尺寸與座標 |
| `cards.create(item)` | 建立共用卡面；所有模式用同一版 |
| `cards.deal(items, layout)` | 只發牌，不抽卡 |
| `cards.reveal(key, options)` | 共用R或舞台揭曉，回傳完成Promise |
| `cards.showSummary(items)` | 將所有卡標成揭曉並排入總覽 |
| `art.create(entry)` | ClawdPet template／PNG adapter |
| `rig.playOnce(art, gesture)` | 有限次角色動作；無rig時可略過 |
| `audio` | 語意音效與受控合成能力 |
| `fx` | 本次演出專屬的粒子／圖層scope |
| `wait(ms)`、`animate(...)` | 可取消的等待與有限動畫 |
| `signal`、`motion` | 中止訊號、減少動態設定 |
| `onReveal(key)` | 單張首次揭曉，宿主去重記錄 |
| `rng()` | 本次演出的seed亂數 |

模式不得取得 `SAVE`、`rollPack()`、Tauri、`albumBody`或全域DOM查詢捷徑。

卡池與立繪adapter屬於宿主。之後移植時，模式檔依然能用，只換 `art.create()`與卡面資料。

**「只帶模式檔」必須理解成：帶模式檔，接上同一份小型接口。**如果要求完全不帶任何runtime，也不接adapter，每個模式只能重複內嵌音效、卡面與粒子引擎，反而不可維護。

### 3. 資料流與存檔

```text
使用者有效抽取
    ↓
宿主確認素材ready、鎖定模式
    ↓
rollPack() 只呼叫一次
    ↓
固定 draw.entries / dup / visualSeed
    ↓
建立pending紀錄
    ↓
mode.create(ctx).open(draw)
    ├─ 正常揭曉 → 全部總覽
    └─ 略過     → 同一批結果總覽
    ↓
宿主啟用「收下」
    ↓
collect(draw.id) 只提交一次
    ↓
圖鑑／塵先記帳，再播放收集動畫
    ↓
dispose → idle
```

現行 `deal()`內部呼叫 `rollPack()`，必須拆開。流星要在發牌前知道最高稀有度，不能等落地才抽結果。

現行 `rollPack()`還會立刻更新包數與pity，圖鑑與塵則等收下才寫。若中途關窗，這些進度會分離。模式抽象落地時一併處理：

- 將 `collection / dust / packs / pity / pending`放入單一版本化存檔物件。
- 抽取時一次寫入更新後包數、pity及固定pending。
- 關窗只停止演出，不丟棄pending。
- 下次開啟直接顯示pending總覽，等待收下。
- 收下時一次更新圖鑑、塵並清除pending。
- `draw.id`與pending檢查保證雙擊或遲到callback不會重複發獎。

這不是要增加伺服器交易系統，而是讓切模式、略過、關窗都不改變同一手牌。

目前重複卡同時增加收藏數量與給塵；本輪保持該行為，別在演出改造時偷偷改成重複卡不計數。

### 4. 全域與模式內狀態

| 層級 | 狀態 | 誰控制 |
|---|---|---|
| 共用 | `idle` | 宿主 |
| 舊模式入口 | `dragging / ready` | 拆包入口控制器 |
| 共用 | `presenting` | 宿主鎖定，模式執行 |
| 共用 | `dealing` | 共用發牌 |
| 共用 | `fanned` | 結果可互動；可能尚未全揭曉 |
| 共用 | `revealing` | 單張揭曉期間鎖定 |
| 共用 | `collecting` | 宿主 |
| 模式內 | tear、flight、stamp、curtain等 | 各模式自己 |

現行 `charging`可以保留為CSS表現class，但不讓模式直接修改全域 `state`。

揭曉紀錄以 `Set<key>`計算，取代散落的 `flippedCount++`。視覺翻面、身份揭曉與動畫完成是三個不同時點；尤其現在傳說在蓄力開始就把 `c.flipped = true`，不能拿這個值直接判斷「全部展示完成」。

### 5. 音效與粒子需要補的接口

目前 `tone / noiseHit / bell / verb`都在 `GachaAudio` IIFE內部，不是模式可直接呼叫的API；`GachaFx`的spawn／layer也是私有。

建議：

- `GachaAudio.createScope()`提供合成積木、`now()`、dry／verb路由與 `stop()`。
- `tone()`、`noiseHit()`建立的source都登記在scope。
- `skip()`用30ms淡出scope輸出，停止尚未播放與正在播放的source。
- verb回授尾音經scope輸出控制，略過後不能仍傳來已取消的鐘聲。
- 保留現有 `reveal / flip / deal / collect`等語意方法，但接受scope或使用本次scope。
- `GachaFx.createScope()`登記其particles與layers，`stop()`能立即清掉本次演出。
- 每個ray必須有有限上限；不沿用默認 `hold: Infinity`等待外部一定會呼叫stop。
- canvas的陣列清空後沿用目前「自然停止rAF」的做法。

音量先以現有master `.7`為起點。上述gain只是單聲部基準；bell有多個泛音，不能把全部峰值當作一顆sine來加。最終應用同一喇叭／耳機匹配四種模式的感知音量。

### 6. 檔案安排

```text
gacha.js                 宿主：抽取、存檔、模式選擇、收下、圖鑑
gacha-card.js            buildCard、buildArt adapter、有限hover
gacha-mode-runtime.js    可取消計時／動畫、共用揭曉、總覽
gacha-audio.js           合成積木與scope
gacha-fx.js              粒子與scope

gacha-mode-hearthstone.js
gacha-mode-wish.js
gacha-mode-summon.js
gacha-mode-stage.js
```

每個模式的私有CSS以 `.mode-wish`等命名隔離。若要搬移時只拷一個檔，可將少量私有CSS字串放在該模式IIFE內，首次create才注入，dispose時移除；不用建通用主題系統。

載入順序：audio／fx → card／runtime → 各模式 → gacha宿主。全部classic script。

### 7. 頂列切換

頂列加入一個寬132px、高30px的原生select：

- 拆包桌面
- 流星投遞
- 腳印召喚
- 拉幕登場

只在 `idle / ready`可切換；演出、尚未收下、收集期間disabled。不做中途切換確認框，也不允許切走丟掉結果。

`ready`切換可直接收回尚未開啟的卡包，180ms換成新模式入口，因為此時尚未抽取。

目前頂列拖窗排除條件只有 `button, .dust`，必須補 `select, option, input, label`，避免點選模式時拖走視窗。

偏好存在獨立 `gacha_mode`鍵。讀到不存在的模式時退回拆包；不修改pending資料。

---

## 四、優先順序與工時

### 1. 先做什麼

**第一個新增模式做流星投遞。**

它可以沿用五張卡背、扇形、逐張翻牌與收下，卻能引入現行缺少的「整批最高稀有度預告」。相較召喚陣，它和拆包的視覺及等待感更不同；相較拉幕登場，又不用先做角色到卡片的交接系統。

順序：

1. A＋F卡面、有限hover、移除待機循環。
2. 抽取與發牌拆開；建立模式runtime、取消與存檔接點。
3. 現行拆包移為第一個mode，行為保持可用。
4. 新增流星投遞，使用同一手牌比較兩種體驗。
5. 腳印召喚陣。
6. 拉幕登場。

### 2. 工時估算

假設一位熟悉此repo的前端工程師，1工作日按6小時有效開發計；包含一輪實機調整，不包含新增素材、支付或後端抽取。

| 工作 | 工時 | 說明 |
|---|---:|---|
| A＋F卡面、圖鑑、有限hover | 8–12h | 含長名稱、四階與黑影處理 |
| 共用runtime、抽取拆分、取消／pending、切換列 | 12–18h | 四模式共用，只做一次 |
| 拆包移植與演出減量 | 4–6h | 不重新設計拖曳手感 |
| 流星投遞 | 8–12h | 有限canvas軌跡＋分鏡＋合成音效 |
| 腳印召喚陣 | 10–14h | 卡位映射、描線、十位布局契約 |
| 拉幕登場 | 16–24h | 多結果序列、rig、結果卡交接 |

「卡面＋共用架構＋拆包保留＋流星」第一批約 **32–48h，5～8個工作日**。四種全部完成約58–86h。

### 3. 實作完成的判準

用固定結果資料驗證，不靠反覆抽到想要的測試案例：

| 案例 | 必須看到的結果 |
|---|---|
| 五張混階、含一張傳說 | 預告正確；傳說身份出現瞬間才落鐘 |
| 同包兩張相同角色 | 第二張重複標記正確；收下只提交一次 |
| 同包兩張傳說 | 各自完整但不重疊的揭曉；不遺留射線 |
| 起飛／翻面中按略過 | 180ms內總覽；不遲到播放舊音效 |
| 演出中關窗再開 | 同一批pending結果，包數及pity不再增加 |
| idle、ready、逐張等待、hover停住 | 有限尾段結束後，無待執行動畫rAF或無限CSS動畫 |
| zoom 1與後端縮小比例 | 指標、卡片、粒子落點一致 |
| 圖鑑`.64` | 名字可辨識，黑影不漏彩色肢體，分類框保持清楚 |

後續實作才執行 `npm run build`及上述操作檢查。本輪沒有修改檔案，因此不把閱讀程式與截圖當作已完成的實機驗證。