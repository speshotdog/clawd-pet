# 第二～五段地景製作回報

產出：四張 971×1619、RGB PNG，以及五段直接相接後等比縮至 360×3001 的 `out/strip.png`。使用內建 imagegen，依 seg2 → seg3 → seg4 → seg5 製作，共 10 個 job，全部串行。沒有執行 build、server、git，也沒有修改 refs。工作檔與原始生成圖均位於 out/。

**量化門檻全部通過；視覺要求仍有下述不足，不能解讀成全項驗收通過。**

## 量測方法

對最終 PNG 的 RGB 以 float64 計算 Y=0.2126R+0.7152G+0.0722B，在整張圖上用 NumPy gradient 得到 gy,gx，再以 hypot(gx,gy)>24 作布林邊緣圖；各區域取像素占比，沒有先縮圖、模糊或把 Y 正規化成 0～1。表內單位為百分比，顯示至四位小數，驗收使用未四捨五入數值。

座標採左上原點、右與下界不含：x=[0,339)、[339,631)、[631,971)；四格 y=[161,485)、[485,809)、[809,1133)、[1133,1457)。上帶 y=[0,161)，下帶 y=[1457,1619)。這是 int(比例×尺寸) 的一致取整。各格左／右 ≥0.8%，中央 ≤1.2%；上下帶 ≤0.3%。

可重算程式：`out/measure.py`，完整數值：`out/metrics.json`。對中央 80% 的後製前後陣列有逐像素相等檢查。

### seg2-supply-line

| Quarter | Left 35% | Center 30% | Right 35% | Result |
|---|---:|---:|---:|---|
| Q1 | 27.1241% | 0.0000% | 25.4729% | PASS |
| Q2 | 19.7695% | 0.0000% | 24.9909% | PASS |
| Q3 | 21.5685% | 0.0000% | 23.5875% | PASS |
| Q4 | 18.4338% | 0.0000% | 20.4394% | PASS |

Top band: 0.0307%; bottom band: 0.0000%. Both PASS.

### seg3-night-market

| Quarter | Left 35% | Center 30% | Right 35% | Result |
|---|---:|---:|---:|---|
| Q1 | 7.1589% | 0.6152% | 6.5024% | PASS |
| Q2 | 18.6296% | 0.7114% | 19.5080% | PASS |
| Q3 | 14.8640% | 0.0000% | 17.5136% | PASS |
| Q4 | 9.2283% | 0.0000% | 9.3119% | PASS |

Top band: 0.0000%; bottom band: 0.0000%. Both PASS.

### seg4-cold-storage

| Quarter | Left 35% | Center 30% | Right 35% | Result |
|---|---:|---:|---:|---|
| Q1 | 20.5470% | 0.9745% | 20.1797% | PASS |
| Q2 | 23.5151% | 0.0000% | 24.8339% | PASS |
| Q3 | 16.1377% | 0.0000% | 17.6416% | PASS |
| Q4 | 9.1819% | 0.0000% | 6.2337% | PASS |

Top band: 0.0000%; bottom band: 0.0000%. Both PASS.

### seg5-doom-city

| Quarter | Left 35% | Center 30% | Right 35% | Result |
|---|---:|---:|---:|---|
| Q1 | 5.1941% | 0.1300% | 3.0773% | PASS |
| Q2 | 13.7450% | 0.0666% | 11.3871% | PASS |
| Q3 | 10.7624% | 0.0000% | 11.8083% | PASS |
| Q4 | 11.5891% | 0.0000% | 10.8070% | PASS |

Top band: 0.0000%; bottom band: 0.0000%. Both PASS.


## 識別物、殘骸與預告痕跡

以下位置為目視約值，x/y 以全圖百分比表示。「格」均指上面的 10～90% 四等分。只把有來源可辨的物件列入殘骸計數；地面旁零散土塊／小塊石頭不計。

### seg2 補給線

- 識別物：左木貨架與成排貓臉包裝 x=0～30%、y=13～29%；右倒斜木貨架 x=73～100%、y=23～38%。裂開的紅框圓鐘 x=79～97%、y=11～20%，保留歪斜指針，無數字。黄色漏斗＋圓窗機 x=0～30%、y=40～61%；右白色儲槽＋梯子與圓窗 x=77～99%、y=40～59%。
- 地面：上部側邊淺綠碎磁磚；下部灰色工廠地板、斷裂邊緣與兩側黃黑警示條。場景轉換約 y=40%，不是精準 50%。
- 可辨殘骸至少 10 件：第1格左藍貓袋、破黄貓袋、右倒飲料罐；第2格左紅貓袋、倒瓶、斷貨架木板、右破黄貓袋；第3格右斷管與脫落接頭、左輸送帶上的紅袋；第4格左掉落黄漏斗、兩個破貓袋、右斷木架與破包裝。全數在左右側邊，未把成排陳列包裝當成散落殘骸。
- 預告：包裝膜於兩側 x≈0～30%、70～100%，y≈64～81%；y=70～81% 可見跨木架／機件的透明膜帶。膜以連續捲帶表示，**捲筒感強，「一圈圈撕不斷的纏繞」仍不夠明確；並且部分膜位於第3格**。

### seg3 夜市攤廢墟

- 識別物：兩側破紅白條紋篷 y≈21～36%（右側另有 y≈36～44%）；橘色圓燈籠串 y≈20～29%，有破裂與垂落；落地燈籠分布 y≈31%、46%、69%。深藍夜空 y≈11～31%，左彎月 x≈7～16%、y≈12～18%，右星星 x≈88～96%、y≈15～19%；有煙塵色塊。
- 地面：灰碎石板側面裂縫、翻倒攤台、裂木箱；左 x≈4～24%、y≈52～63% 有冒煙鍋。
- 可辨殘骸至少 10 件：第1格左斷篷支柱、撕裂篷布、右破燈籠；第2格左落地橘燈籠、翻倒木攤台、散落紅白布、右斷攤台木板和落燈籠；第3格左破木箱、鍋蓋、右破箱及散落食材；第4格兩側各有落燈籠、布片和斷木板。全部位於側邊。
- 預告：兩側各四個圓槌坑，中心大致 x≈14%、86%，y≈66%、71%、76%、80%；垂直間隔接近等距。**後三個位於指定第4格，第一個在第3格；並非整排都限制在 y=70～90%。**

### seg4 冷藏庫深處

- 識別物：左木層架 y≈14～25%，上有小麥圖案罐、草莓圖案果醬罐、魚圖案罐頭、倒破盆栽，無文字。右木窗 x≈71～98%、y≈11～26%，破玻璃、白磚牆與霜。左右冰箱門架 y≈42～57%，成排牛奶瓶、醃菜玻璃罐，瓶身破裂／傾斜；裂玻璃層板與碎片在 y≈54～67%、81～86%。
- 地面：兩側由廚房殘破木櫃轉為冰箱內部，越下方越多淺藍白霜斑、冰柱和冰面。中央保持淺藍低對比空地。
- 可辨殘骸至少 10 件：第1格左破盆栽、右碎窗片及斷窗框木條；第2格左破果醬罐、蓋、倒盆栽、右倒魚罐和斷櫃板；第3格兩側裂玻璃層板碎片、左倒奶瓶與藍瓶蓋、右倒醃菜罐；第4格左倒醃菜罐、瓶蓋、右倒奶瓶、數塊有玻璃層板形狀的碎片。全部位於側邊。
- 預告：兩侧 x≈15～23%、78～87%，y≈63～79% 有三叉、不對稱融合和環形足跡；其中 y≈72～79% 在第4格。**足跡起點偏早，不是整排都在第4格。環形印與混合形狀提供異常感，但部分單枚仍近似鳥足。**
- **上方木層架仍基本連著；冰柱、倒罐與下方櫥櫃破壞明確，但「層架斷裂」沒有充分達成。**

### seg5 滅世都市

- 識別物：左 x≈0～29%、y≈15～34% 為 prop0 的窄高樓／小方窗格；右 x≈76～100%、y≈20～37% 為 prop2 的較寬樓體／長矩形窗格，兩者均保留輪廓並斷裂傾斜。原 city-sky 灰褐／棕灰天空與層次天際線保留，變暗加煙塵；背景 y≈21～34% 樓群高度形成低伏隆起。
- 地面：側邊道路破裂、翻起、深色受損斑；中央為低對比棕灰街道。
- 可辨殘骸至少 10 件：第1格左右斷樓上部、缺角窗格樓段；第2格左倒方窗外牆板與倒空白路牌、右倒窗格外牆板與傾斜空白路牌；第3格左右破窗框、斷柱、倒斜路燈；第4格左右各有落地窗格外牆板、長條樓板／立柱，左另有斷路燈。這些有窗格或構件形狀的殘骸計數，無法辨來源的小石塊不計。
- 預告：兩側路緣與斑馬線約 x=0～25%、74～100%，y≈66～76% 向內弓曲；左燈柱延伸到 y≈84%，兩側燈具／道路相互呈彎曲排列。**斑馬線只有下部落在 y=70～90%；右侧較接近彎路，超自然扭曲感偏含蓄。**
- 遠方樓群已改成中間較高的低伏弧，但**「巨獸背脊」是弱暗示，不保證使用者能直接辨識**。沒有畫王本體、眼睛或臉。

## 接段色值

使用最終原尺寸 PNG 實測平均；差值為每通道絕對差，門檻各 ≤18。`seg1-bands.txt` 原列下帶 (227,195,102)，本回報依上述切分實測為 (227.9969,195.4677,102.2034)，沒有用檔案的整數代替實測。

| Seam | Previous bottom mean RGB | Next top mean RGB | Absolute channel differences | Result |
|---|---|---|---|---|
| seg1 to seg2 | (227.9969, 195.4677, 102.2034) | (225.5091, 198.1956, 112.7280) | (2.4878, 2.7279, 10.5245) | PASS |
| seg2 to seg3 | (109.5700, 127.3105, 149.4066) | (108.1942, 125.6153, 146.6366) | (1.3758, 1.6952, 2.7700) | PASS |
| seg3 to seg4 | (111.5257, 123.5691, 131.8992) | (112.0362, 124.4382, 132.8892) | (0.5105, 0.8691, 0.9900) | PASS |
| seg4 to seg5 | (173.9425, 200.7779, 216.5770) | (173.5181, 200.0149, 215.5783) | (0.4243, 0.7631, 0.9988) | PASS |

## 允許範圍內的後製

1. 內建工具多數原始輸出為 971×1620，僅裁掉最底下一列過渡帶像素，得到 971×1619；seg4 的兩次修正版已為 971×1619，不再裁切。所有版本都不縮放、不裁切中央插畫。
2. 只替換 y=0～160 和 y=1457～1618 的上下過渡帶。每條帶靠外端的 75% 為指定純 RGB，靠插畫的 25% 用 smoothstep 連到相鄰插畫列的水平模糊色（Gaussian radius=24）。模糊僅用來求帶內漸層端色，未把模糊結果寫進中央 80%。
3. 上／下帶外端設定：seg2 (227,195,102)/(109,126,147)；seg3 (109,126,147)/(112,124,132)；seg4 (112,124,132)/(175,201,216)；seg5 (175,201,216)/(113,104,91)。因此 seg2→3、seg3→4、seg4→5 的相鄰最外列為同色。seg1 沒改，以它的既有末端近似黄接 seg2。
4. 全圖中央 80% 只有 imagegen 生成／修正，程式逐像素相等斷言通過。縮圖仅用於使用者要求的 strip。
5. strip 先以 971×8095 直接垂直拼接，沒有重疊、分隔線或文字，再用 Lanczos 等比縮小、整數高度取最近值到 360×3001。

## 未充分達成、參考異常與門檻評估

- 上述各張已逐項列出預告位置偏早、膜纏繞意象偏弱、層架斷裂不明顯、巨獸暗示不夠確定等問題；沒有為了這些問題自行降低門檻。
- 四張都有生成的少量土塊／通用碎塊，尤其都市樓體周圍較明顯。沒有把它們算成要求的 ≥6 件場景殘骸，但**「不要通用瓦礫」未完全達成**。
- 數值通過並不代表畫風與 seg1 完全一致。seg2／seg4 物件較多、較密集；膜和玻璃有白色示意線／色塊，仍稍有材質感。不存在寫實金屬鏡面、寶石或光暈，但不能宣稱逐筆風格一致。
- 直接接縫色差通過，strip 中相鄰圖邊界沒有明顯色彩跳線。不過 seg3／seg4／seg5 約 y=10.5% 還有原生成圖的水平色階，它位於禁止程式改動的中央 80% 內，因此沒有用程式抹掉。**整條路線仍看得出段內色區切換與寬過渡空帶，尚非完全自然無痕的地景融合。**
- `ref-1.0-scene7-thumb-x4.png` 實際是冰箱場景與角色/UI，沒有作為都市生成輸入；已看過，避免把不相符元素帶進都市。`city-sky` 和 boss 參考有 REC、取景框、角色／光束；prompt 明確排除，成品沒有沿用。prop0／prop2 實際是樓體窗格，不是路牌；保留兩者，路牌與路燈屬於題目所要求的城市街道語彙。
- 我不認為數值門檻本身需要改。兩側 ≥0.8% 很容易達成，仍不能代替「場景物件種類、是否毁壞」檢查。中央 ≤1.2% 也可能容許一小件高對比殘骸；seg3 首稿數值通過仍有侵入，所以另做 imagegen 修正。平均 RGB 接近不能單獨保證無硬邊；本次另外讓新圖的相接外列同色，但未擴大可程式修改範圍。
- 寫檔紀律：本機工作輸出僅 out/、REPORT.md。內建 imagegen 自動在其系統預設 `C:/Users/spesh/.codex/generated_images/...` 留存生成檔，此位置由工具決定，沒有可用的目的路徑參數；我未自行在該處改寫或刪除檔案，只讀取後複製進 out/。這是工具自動落盤，無法承諾全系統層面只有 map-job 產生新檔。

## Imagegen 完整工作紀錄

所有 job 均為內建 imagegen，無 CLI/API fallback、無並行。原始輸出複本位於 `out/jobs/`；下方列出每次實際送入的 prompt 原文與參考來源。修圖輸入為當時 out/ 的版本：原生成圖裁底一列並經同樣上下帶處理（seg2 首次修圖前只有裁底列）；已不是後續覆蓋的最終版。可依原始複本、色參數與 measure.py 還原。

### Job 01 - seg2

NOT SELECTED as final; used as edit input. Center Q1=4.6994%, Q3=2.2662%, top band=0.7407% failed.

Raw output: [PNG](out/jobs/seg2.png); 971x1620, RGB.

Inputs in submitted order:
- `refs/style-seg1-backyard-ruin.png`
- `refs/style-gacha-cardback.png`
- `refs/style-monster-0.png`
- `refs/ref-1.0-scene3-market-shelves.png`
- `refs/ref-1.0-scene4-snack-factory.png`

Verbatim prompt:

```text
Use case: stylized-concept. Create one portrait scrolling game map illustration, 971x1619 (approximately 3:5), RGB. Style reference seg1 is authoritative: thick black slightly hand-drawn outlines, flat sticker-like fills, simple shapes, same scale and object density, no realistic light, no metal shine, no gems or glow. No text, numerals, letters, logos, watermarks, UI, borders, or characters. Cat faces ONLY as printed snack packaging graphics when requested.
STRICT LAYOUT: top y=0-10% and bottom y=90-100% completely empty large flat color transition bands with no lines or objects. In middle y=10-90%, keep center x=35-65% COMPLETELY OPEN, broad low contrast unoutlined color fields, NO cracks, tile lines, outlines, objects, debris crossing center. Arrange illustrated scene objects exclusively within left x=0-34% and right x=66-100%. Both sides must have substantial black outlined objects in EACH row y=10-30%,30-50%,50-70%,70-90%. Edge-density goals gradient luminance >24: each side each row >=0.8%, center <=1.2%, end bands <=0.3%. Make the center naturally integrated as open ground, not a framed stripe. All destructive floor details confined to side areas. At least 6 distinct scene-specific wreckage objects across at least 3 rows. No generic rubble. Clearly devastated as much as seg1.
SEGMENT 2 SUPPLY LINE. Reference images: 1 seg1 composition/style; 2 cardback line style only; 3 monster line weight only, NEVER draw character; 4 original market shelves for recognizable shapes; 5 original snack factory for recognizable shapes.
Top 10% solid RGB(227,195,102), fading naturally into scene below. Bottom 10% muted gray-blue RGB(90,105,119), empty.
UPPER HALF ruined convenience store: collapsed wooden shelving with several rows of cat-face snack bags, spilled bags; broken red-rim ROUND wall clock, crooked hands and NO numbers; shattered light-green square tiled floor at sides only. Distribute shelf fragments and torn cat-print bags on both sides in rows 1 and 2. LOWER HALF ruined snack factory: stopped yellow funnel machine with circular porthole, white storage tank with ladder, disconnected pipes, damaged conveyor; gray flooring with interrupted yellow-black hazard stripes ONLY on side strips. Row 3 broken pipes and machine parts, row 4 fallen yellow hopper and torn cat snack packets. At y=70-90% on BOTH sides, coils upon coils of transparent packaging film wrap between fallen shelf fragments and machines, visibly taut unbroken loops, flat pale translucent fills outlined delicately, no shine. Center must remain blank. Preserve cheerful old-place recognizable shapes but wreck them.
```

### Job 02 - seg2-revision

SELECTED. Center all four quarters=0%; recognizable props retained. Only allowed transition bands postprocessed.

Raw output: [PNG](out/jobs/seg2-revision.png); 971x1620, RGB.

Inputs in submitted order:
- `out/seg2-supply-line.png`

Verbatim prompt:

```text
Edit this image preserving its exact illustration style, recognizable objects, damage, colors, scene, vertical positions and dimensions. ONLY correct composition: central x=35%-65% must contain ZERO black outlines and ZERO high contrast objects throughout y=10%-90%. Move the inner edges of shelves, wall bricks, pipes and rubble outward so ALL black lines and debris lie strictly in x=0%-31% or x=69%-100%, leaving safety margins. Keep both sides richly detailed in all four vertical quarters. Center is the existing pale green to gray low contrast open floor with only faint unoutlined broad patches. Top 10% and bottom 10% must have no outlines at all. Keep yellow top and blue-gray bottom. Preserve red round broken clock with no numerals, cat snack shelves, yellow funnel machine with porthole, white tank with ladder, broken yellow-black stripes and clear packaging-film loops on both lower sides. No new objects, no text, no characters. Target 971x1619 portrait.
```

### Job 03 - seg3

NOT SELECTED as final; used as edit input. Numerical checks passed after band processing, but upper-left broken lantern intruded into center.

Raw output: [PNG](out/jobs/seg3.png); 971x1620, RGB.

Inputs in submitted order:
- `refs/style-seg1-backyard-ruin.png`
- `refs/ref-1.0-scene5-night-market.png`

Verbatim prompt:

```text
Use case: stylized-concept. Create one portrait scrolling game map illustration, 971x1619 (approximately 3:5), RGB. Style reference seg1 is authoritative: thick black slightly hand-drawn outlines, flat sticker-like fills, simple shapes, same scale and object density, no realistic light, no metal shine, no gems or glow. No text, numerals, letters, logos, watermarks, UI, borders, or characters. Cat faces ONLY as printed snack packaging graphics when requested.
STRICT LAYOUT: top y=0-10% and bottom y=90-100% completely empty large flat color transition bands with no lines or objects. In middle y=10-90%, keep center x=35-65% COMPLETELY OPEN, broad low contrast unoutlined color fields, NO cracks, tile lines, outlines, objects, debris crossing center. Arrange illustrated scene objects exclusively within left x=0-34% and right x=66-100%. Both sides must have substantial black outlined objects in EACH row y=10-30%,30-50%,50-70%,70-90%. Edge-density goals gradient luminance >24: each side each row >=0.8%, center <=1.2%, end bands <=0.3%. Make the center naturally integrated as open ground, not a framed stripe. All destructive floor details confined to side areas. At least 6 distinct scene-specific wreckage objects across at least 3 rows. No generic rubble. Clearly devastated as much as seg1.
SEGMENT 3 RUINED NIGHT MARKET. Reference 1 authoritative art style and density; reference 2 old night market recognizable shapes.
Composition safety margin: ALL outlines and debris strictly x=0-30% or x=70-100%, absolutely NONE in x=35-65%. Leave y=0-12% and y=88-100% entirely featureless color so end bands are clean. Still place objects on BOTH sides in y=12-30,30-50,50-70,70-88%.
Top band RGB(110,127,149) matching previous segment's measured bottom mean. Bottom band RGB(112,124,132). Upper side sky DEEP NAVY blue, darkened smoky with a crescent moon at upper left and simple stars at upper right, all y=13-24%, no glow, dark blue smoky shapes do not enter center as black outlines. A destroyed old night market retaining red-white striped awnings on both sides: top row collapsed awnings with torn flaps and broken orange round hanging lantern string; row 2 overturned wooden stall counters, fallen orange lanterns, torn red-white cloth; row 3 broken wooden crates and fallen stall planks and a smoking cooking pot on each side; gray shattered paving slabs on side floors in all lower rows, gray open low contrast central ground. At least 8 distinct market-specific scattered wreckage objects across 4 rows; do not fill with generic rocks.
At y=72-87%, BOTH side ground strips have a straight vertical row of FOUR evenly spaced ROUND hammer impact pits; precise repeated equal spacing, neat beat pattern despite wreckage, outside central 30%. Extra fallen orange lantern and torn awning fragment beside the pits. No hammer, no rabbit or any characters. Flat fills thick black hand-drawn outlines like seg1, no realism.
```

### Job 04 - seg3-revision

SELECTED. Lantern moved outward; numerical checks passed. Hammer trail begins above Q4, noted as a limitation.

Raw output: [PNG](out/jobs/seg3-revision.png); 971x1620, RGB.

Inputs in submitted order:
- `out/seg3-night-market.png`

Verbatim prompt:

```text
Edit this map with a single correction: move the upper left dangling broken lantern and the few ground debris pieces that extend inward OUTWARD, so all objects, black outlines and wreckage stay exclusively in x=0-32% and x=68-100%. Keep x=35-65% completely clear of outlined objects throughout y=10-90%. Preserve the exact night market scene, flat thick black hand-drawn sticker style, colors, red-white torn awnings, orange lanterns, crescent and stars, fallen stalls/crates, smoking pot, and FOUR evenly spaced round hammer pits along EACH lower side. Preserve dimensions 971x1619 and empty top and bottom bands. No text, no characters, no new objects. Keep visual damage. Do not introduce any lines across center.
```

### Job 05 - seg4

NOT SELECTED as final; used as edit input. Center Q1=3.9595%, Q2=1.7292% failed; plants intruded into center.

Raw output: [PNG](out/jobs/seg4.png); 971x1620, RGB.

Inputs in submitted order:
- `refs/style-seg1-backyard-ruin.png`
- `refs/ref-1.0-scene2-kitchen.png`
- `refs/ref-1.0-scene6-midnight-fridge.png`

Verbatim prompt:

```text
Use case: stylized-concept. Create one portrait scrolling game map illustration, 971x1619 (approximately 3:5), RGB. Style reference seg1 is authoritative: thick black slightly hand-drawn outlines, flat sticker-like fills, simple shapes, same scale and object density, no realistic light, no metal shine, no gems or glow. No text, numerals, letters, logos, watermarks, UI, borders, or characters. Cat faces ONLY as printed snack packaging graphics when requested.
STRICT LAYOUT: top y=0-10% and bottom y=90-100% completely empty large flat color transition bands with no lines or objects. In middle y=10-90%, keep center x=35-65% COMPLETELY OPEN, broad low contrast unoutlined color fields, NO cracks, tile lines, outlines, objects, debris crossing center. Arrange illustrated scene objects exclusively within left x=0-34% and right x=66-100%. Both sides must have substantial black outlined objects in EACH row y=10-30%,30-50%,50-70%,70-90%. Edge-density goals gradient luminance >24: each side each row >=0.8%, center <=1.2%, end bands <=0.3%. Make the center naturally integrated as open ground, not a framed stripe. All destructive floor details confined to side areas. At least 6 distinct scene-specific wreckage objects across at least 3 rows. No generic rubble. Clearly devastated as much as seg1.
SEGMENT 4 DEEP COLD STORAGE. Reference 1 exact art style and side composition; reference 2 old kitchen props; reference 3 old fridge props. STRICT safety margin: ALL objects, black outlines, floor cracks, debris confined x=0-30% and x=70-100%. Center x=35-65% entirely unoutlined pale low-contrast open floor. y=0-12% and y=88-100% blank featureless transition colors. Still substantial illustrated objects on both sides of y=12-30,30-50,50-70,70-88%.
TOP band RGB(112,124,132), measured previous bottom approximately (111.53,123.57,131.90). BOTTOM band RGB(175,201,216).
Upper HALF a ruined kitchen progressively freezing: LEFT row 1 snapped wooden wall shelf holding cracked frosted wheat jar with wheat pictogram, strawberry jam jar with strawberry pictogram, fish tin with fish pictogram, broken small plant pot. No writing on any label. RIGHT row 1 broken wooden window frame, shattered glass, frosty white brick wall; in row 2 both sides overturned counter fragments, spilled broken jam jar, wheat jar lid, snapped plant pot and fish tin, heavy frost patches and damaged side floor.
Lower HALF is INSIDE a destroyed refrigerator, increasingly ice blue and white: broken refrigerator door racks on BOTH sides with rows of milk bottles and pickled vegetables in glass jars, toppled and cracked bottles; broken pale cyan GLASS SHELVES restricted to side areas, no shelf crossing center. Icicles from side racks, white frost on everything, chunks of broken shelf glass, milk bottle caps and overturned pickle jars scattered in rows 3 and 4. At least 8 clearly separate kitchen/fridge specific wreckage items across all four rows. Flat pale icy blue and white, no realistic highlights or glass shine.
At y=72-87% on BOTH sides in frosty floor, a vertical trail of mismatched impossible footprints: asymmetrical three-pronged, ring-shaped and oddly fused lobes that cannot belong to any real animal. They are strange FOOTPRINT impressions, not characters, no chicken or creature. Keep all prints outside center. Damage visible, center stays quiet.
```

### Job 06 - seg4-revision

NOT SELECTED as final; used as edit input. Center Q1 still 1.4291%, above threshold. Plants had not moved far enough.

Raw output: [PNG](out/jobs/seg4-revision.png); 971x1619, RGB.

Inputs in submitted order:
- `out/seg4-cold-storage.png`

Verbatim prompt:

```text
Edit only the side positioning of this map. All black outlines, plant leaves, shelf ends, countertop edges, floor debris and cracks MUST stay strictly inside x=0-31% or x=69-100%. Keep the entire center x=35-65%, y=10-90% clear pale icy blue low contrast open ground with ZERO outlined objects. In particular move BOTH upper left plants, their leaves, soil and broken pots outward to the left, and move the right countertop's broken protruding plank outward right. Keep all recognizable props present: wheat jar, strawberry jam, fish tin, broken potted plants, wooden shelf, smashed wooden window and frosty white tiles; lower half ice refrigerator bottle racks, milk bottles, pickle jars, broken glass shelves, icicles and mismatched impossible footprints on BOTH lower sides. Preserve exact style, colors, damage, broad central color patches, vertical placements. No added objects, no text, no characters. Top and bottom bands remain empty. 971x1619 portrait.
```

### Job 07 - seg4-revision2

SELECTED. Both plants repositioned outward. Center Q1=0.9745%, other quarters=0%. Shelf breakage remains insufficiently clear.

Raw output: [PNG](out/jobs/seg4-revision2.png); 971x1619, RGB.

Inputs in submitted order:
- `out/seg4-cold-storage.png`

Verbatim prompt:

```text
ONE SURGICAL EDIT: The two potted plants on the left stick too far into the empty center. Reposition BOTH plants completely to the far left x=5-20%: upper plant on the shelf beside the wheat jar and lower broken plant beside the spilled jam jar. Every leaf, soil fleck and pot shard must end before x=28%. Shorten wooden shelf to end x=29%. Restore the places they vacate with the adjacent plain icy blue background, with no cracks or outlines. Preserve wheat jar, strawberry jam and fish tin by rearranging them compactly on left shelf as necessary. Keep EVERYTHING else unchanged: style, colors, composition, right window and counter, lower fridge racks and glass, impossible footprints, empty top/bottom bands. Center x=35-65% must have zero objects or black marks. No text or characters. 971x1619.
```

### Job 08 - seg5

NOT SELECTED as final; used as edit input. Numerical checks passed, but gritty dimensional rendering differed from seg1, lower-left lamp intruded, distant ridge was too ordinary.

Raw output: [PNG](out/jobs/seg5.png); 971x1620, RGB.

Inputs in submitted order:
- `refs/style-seg1-backyard-ruin.png`
- `refs/ref-1.0-city-sky.png`
- `refs/ref-1.0-city-prop-0.png`
- `refs/ref-1.0-city-prop-2.png`
- `refs/ref-1.0-boss-mieshi.png`

Verbatim prompt:

```text
Use case: stylized-concept. Create one portrait scrolling game map illustration, 971x1619 (approximately 3:5), RGB. Style reference seg1 is authoritative: thick black slightly hand-drawn outlines, flat sticker-like fills, simple shapes, same scale and object density, no realistic light, no metal shine, no gems or glow. No text, numerals, letters, logos, watermarks, UI, borders, or characters. Cat faces ONLY as printed snack packaging graphics when requested.
STRICT LAYOUT: top y=0-10% and bottom y=90-100% completely empty large flat color transition bands with no lines or objects. In middle y=10-90%, keep center x=35-65% COMPLETELY OPEN, broad low contrast unoutlined color fields, NO cracks, tile lines, outlines, objects, debris crossing center. Arrange illustrated scene objects exclusively within left x=0-34% and right x=66-100%. Both sides must have substantial black outlined objects in EACH row y=10-30%,30-50%,50-70%,70-90%. Edge-density goals gradient luminance >24: each side each row >=0.8%, center <=1.2%, end bands <=0.3%. Make the center naturally integrated as open ground, not a framed stripe. All destructive floor details confined to side areas. At least 6 distinct scene-specific wreckage objects across at least 3 rows. No generic rubble. Clearly devastated as much as seg1.
SEGMENT 5 DOOM CITY. Input 1 authoritative thick black hand-drawn flat sticker style and open-center composition. Input 2 city sky ONLY its muted sepia gray-brown sky/haze and layered building skyline; NEVER reproduce its character, beams, REC text or recording frame. Inputs 3 and 4 recognizable old city props: retain BOTH narrow dark rectangular highrise with small square window grid (prop0) AND broad brown facade with tall rectangular window grid (prop2), now snapped and leaning. Input 5 mood only, NEVER depict monster, face, eyes, beam, UI or framing.
TOP y=0-12% featureless RGB(175,201,216), connects measured previous bottom RGB(173.94,200.78,216.58). BOTTOM y=88-100% featureless muted taupe RGB(113,104,91). Objects on both sides of each row y=12-30,30-50,50-70,70-88%, restricted strictly x=0-30% and x=70-100%. Center x=35-65% low-contrast open ground/sky, NO black edges, no debris, NO crossing crosswalk stripes.
Upper side areas: smoky darkened sepia sky, broken leaning high-rise silhouettes. The distant CITY ROOFLINE suggests the ridged back of an enormous recumbent beast entirely through clustered building heights and hazy architecture silhouettes, subtle not literal spikes, NO animal body, NO eyes or face. Let only a VERY LOW CONTRAST broad distant hazy rooftop contour continue across center, no black outline. City ruins in both sides all rows: row1 broken square-window tower and tall-window facade, snapped window frame sections; row2 tilted grid-window building halves, fallen rectangular facade panels with surviving window openings, broken window glass, fallen BLANK street sign; row3 separated window-frame sections, toppled streetlamp, bent blank road sign, lifted charred asphalt slabs; row4 fallen window-grid facade fragments and broken streetlamp heads. At least 8 distinct city-specific debris items distributed in at least 3 rows. No generic rubble piles. Floor destruction only at sides, center quiet.
BOSS FORESHADOW y=70-87% on BOTH SIDES: road edges, several white zebra-crossing stripes and a sequence of streetlamps follow a slight physically impossible smooth curvature. The white stripes curve as a group along the side pavement, NEVER cross the central x=35-65%. Slight unnatural warp, not dramatic spiral. Bent road surface side contours, bowed alignment of lamps, all in flat colors. No characters, no text, numbers, letters, logos or UI anywhere.
```

### Job 09 - seg5-revision

NOT SELECTED as final; used as edit input. Flatter style improved; distant skyline still needed a low hump, with a few central edge pixels remaining.

Raw output: [PNG](out/jobs/seg5-revision.png); 971x1620, RGB.

Inputs in submitted order:
- `out/seg5-doom-city.png`
- `refs/style-seg1-backyard-ruin.png`

Verbatim prompt:

```text
Edit image 1 ruined city map, using image 2 ONLY as authoritative illustration style. Make city match the flat hand-drawn sticker style of image 2: bold black outlines, simple flat fills, remove gritty paper texture and dimensional shading on buildings/window fragments. Keep sepia brown-gray palette and all existing recognizable broken square-window and tall-window highrises, fallen facade panels, blank signs, broken window frames and streetlamps.
Correct layout: move ALL objects, black outlines, debris and lamps outside central x=35-65%, into x=0-30% and x=70-100%. Especially upper left rubble at y=34-37% and lower left lamp head and rubble at y=71-85% must shift outward. Center must remain broad quiet low-contrast open ground.
Adjust ONLY the distant background skyline heights so its overall silhouette forms a long, low recumbent beast-like back ridge: one broad humped arc with irregular roof steps on top, fading into smoky sepia haze. It must read as ARCHITECTURE first, no literal animal, no face or eyes, no spines on a body. Any skyline in central 30% has low contrast, no black outline.
Keep warped road edges and bowed zebra stripe arrangement at y=70-87% on both sides. Slight unnatural curvature in the alignment of the existing streetlamps. Preserve clean blank top/bottom 10% bands and 971x1619 dimensions. No characters, no text/numerals/logos/UI/borders.
```

### Job 10 - seg5-revision2

SELECTED. Distant roofline now has a low rise; center Q4=0%. Numerical checks passed. Beast-back implication remains subtle.

Raw output: [PNG](out/jobs/seg5-revision2.png); 971x1620, RGB.

Inputs in submitted order:
- `out/seg5-doom-city.png`

Verbatim prompt:

```text
Surgical edit ONLY to distant background skyline around y=20-34%. Preserve all foreground ruined buildings, lamps, street signs, road, curved zebra stripes, side rubble, colors, empty center foreground and blank end bands exactly. Replace the distant skyline's valley shape with ONE BROAD LOW HUMP: starting low at x=15%, roof heights gradually rise toward x=47%, then gradually descend toward x=85%. The collective upper edge of these tightly clustered distant buildings is a long arch like the back ridge of a giant sleeping beast. Small irregular roof steps suggest vertebrae, but they MUST still be buildings with no literal animal anatomy, no eyes or face, no spikes on an animal body. Use extremely low-contrast taupe haze for this background silhouette, adjacent luminance difference less than 20, no black outline anywhere in center x=35-65%. This is a subtle architectural silhouette only. Keep flat thick black sticker style on foreground, no texture, no realistic shading. Also move the tiny left rubble tip at x=35%,y=85% slightly left so center x=35-65% contains no foreground black marks. No text, characters, logo or border. 971x1619.
```
