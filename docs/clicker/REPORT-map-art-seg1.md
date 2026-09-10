# 第一段地圖美術樣品回報

日期：2026-09-10

## 交付與狀態

本輪僅產出美術樣品與本報告。使用內建 imagegen，共 **6 個 job，全部依序執行，沒有並行**；地景 3 次、圖示 3 次。未使用 CLI/API fallback，未引入第三方素材或字型。

- 地景：`_art/holo-test/map-art/seg1-backyard-ruin.png`，971 × 1619，RGB PNG，寬高比 0.59975，約 3:5。
- 圖示：`_art/holo-test/map-art/icons-sheet.png`，1254 × 1254，RGB PNG。
- 並排：`_art/holo-test/map-art/seg1-compare.png`，2187 × 1619，RGB PNG。

**這是待人工審閱的樣品，不能宣稱所有硬限制均已通過。** 識別物完整性與中央避讓已檢查；生成圖仍有微弱色調起伏，圖示背景也不是逐像素完全相同的純色，見下方限制。未宣稱辨識率；「是不是同一個後院」由使用者看並排圖判定。

## 事前閱讀與參考

先讀 `docs/clicker/DESIGN-2.0-art-direction.md`，再讀本次 brief；生成前已實際檢視：
- `_art/holo-test/map-art/ref-1.0-backyard.png`：原場景／地標形狀參考。
- `src/gacha-cardback.jpg`：粗黑線、奶油色與粉紅爪印的畫風參考。
- `_art/holo-test/art/card-ababa.png`：角色卡手繪線條參考。

方向文件的三識別物與本次 brief 不同；採本次 brief 的具體清單：分叉大樹、白色尖頭柵欄＋紅信箱、紅白格紋野餐布。爪印用於圖示母題。參考檔均未修改。

## 構圖、座標與過渡帶

座標原點是成圖左上角，x 向右、y 向下，單位 px。以下為人工目視包圍框近似值，包含外輪廓，不是語意分割精確遮罩。

| 識別物 | 成圖位置／約略包圍框 (x0,y0)–(x1,y1) | 保留與破壞 |
|---|---|---|
| 分叉大樹 | 左側，(24,524)–(330,883) | 左短右長的兩根粗分叉、圓切口；三團焦黑樹冠。未裁邊。 |
| 白色尖頭柵欄＋紅信箱 | 右側，(632,770)–(943,941) | 白色尖頭與斷缺板、紅色圓頂箱體、開啟箱門與歪斜支柱；外輪廓完整。 |
| 紅白格紋野餐布 | 右下，(651,1028)–(933,1143) | 透視梯形、紅白大格紋、左緣撕口、右下捲角；四角與整體外形可見。髒污與褪色表現偏輕。 |

中央 30% 的量測範圍為 x=[339,631)，共 292 px（整數取樣約 30.07%）。三組識別核心均在此帶之外。中央只有天空、草地與大尺度丘陵輪廓，沒有野餐布格紋或細碎草叢；丘陵黑線仍會橫穿中央，不能寫成「中央完全無邊緣」。

上下各選 10% 作接段過渡帶：頂端 y=[0,162)，底端 y=[1457,1619)。兩帶没有識別物、文字或裝飾，高對比邊緣密度均為 0%；底端草地、頂端天空仍有微弱色調變化。所有識別物遠離上下邊緣。未與尚未生成的相鄰段落實際拼接，無縫銜接尚未驗證。

本輪沒有 UI 接線或遮擋實測，因此不宣稱 UI 開啟後的辨識率、遮擋比例或整頁地景可見面積。

## 中央帶量測

直接使用最終 971 × 1619 成圖，未先縮放。

方法：RGB 以 Y=0.2126R+0.7152G+0.0722B 轉成亮度（直接使用 8-bit 編碼值，非線性光度測量）。局部對比取每區完整、互不重疊 16 × 16 區塊的亮度標準差除以 255，再平均；不足 16 px 的邊緣餘數不計。邊緣密度使用 NumPy gradient 的 x/y 梯度幅值，門檻 >24 亮度階/px，計超過門檻像素占比。各區使用相同方法。

| 區域 | 平均局部 RMS 對比（0–1） | 邊緣密度 |
|---|---:|---:|
| 左側 x=[0,339) | 0.018468 | 1.6105% |
| 中央 x=[339,631) | 0.006734 | 0.4882% |
| 右側 x=[631,971) | 0.032032 | 2.6100% |
| 上端 10% | 0.001825 | 0.0000% |
| 下端 10% | 0.001840 | 0.0000% |

中央局部對比約比左側低 63.5%、比右側低 79.0%；邊緣密度約比左側低 69.7%、比右側低 81.3%。

避免上半部大面積天空稀釋比較，另在識別物所在高度 y=[500,1150) 做相同測量：

| 區域 | 平均局部 RMS 對比 | 邊緣密度 |
|---|---:|---:|
| 左側 | 0.045860 | 4.0113% |
| 中央 | 0.014536 | 1.2160% |
| 右側 | 0.074072 | 6.5009% |

中央在此高度仍比兩侧單純。這些數值只反映局部變化與邊緣，不是辨識率；brief 未訂數值通過門檻，不能據此冒稱辨識驗收通過。

## 圖示排列與限制

左上勾號、右上鎖、左下粉紅爪印、右下深藍破損閘口，已目視確認。閘口寬度明顯大於其他母題。大致外輪廓（含貼紙細邊）：
- 勾號：(120,140)–(508,498)。
- 鎖：(812,113)–(1121,513)。
- 爪印：(117,752)–(498,1111)。
- 閘口：(690,746)–(1211,1134)。

可沿 x=627、y=627 等分為 4 個 627 × 627 區塊。兩條裁切線上的暗色像素（RGB 最大通道 <100）皆為 0，目視也無輪廓跨線，格間留白完整。沒有真的裁成獨立圖示，本輪交付母題 sheet。

**未完全符合純色背景硬限制：** 空白中央樣區 x=[550,690)、y=[550,690) 的 RGB 最小值為 (253,251,241)，最大值為 (255,253,244)，各通道標準差約 (0.556,0.551,0.601)。視覺上為骨白，但不是單一 RGB 純色；imagegen 在反覆要求下仍留下輕微紋理。未用程式重新上色或偷偷替換為向量圖。地景與圖示色塊同樣有輕微明暗起伏，嚴格要求完全扁平純色時仍需修正。目視未見寫實投影、金屬反光、光暈或寶石；不能把「沒有寫實光影」當作「所有像素完全無漸變」。

目視檢查最終地景、圖示與並排图均未見字母、數字、logo、浮水印或標題。未執行 OCR；勾號與爪印是 brief 指定的繪製母題。

## 直式處理與並排圖

地景直接生成為 971 × 1619 直式，**沒有方圖轉直式、沒有裁切、沒有拉伸、沒有擴圖，也沒有重採樣**；直接複製內建 imagegen 的選定 PNG。故沒有需保留的原始方形地景。

並排圖使用確定性 Pillow 貼合，左為 1216 × 720 原參考圖，右為 971 × 1619 廢墟圖。兩圖皆原像素 1:1，頂端對齊，左圖下方補 RGB (243,238,222) 的骨白至畫布高 1619。左圖放 (0,0)，右圖放 (1216,0)。無標題、文字、箭頭。驗證左右內容的 RGB 像素皆與來源逐像素相等。

**規格歧義／未滿足之處：** brief 同時寫「同高、原尺寸並排」，而兩個來源高度分別為 720 與 1619；在不縮放或裁掉内容的條件下，內容本身無法等高。目前只做到兩側畫布等高、內容原尺寸。保留原像素以方便檢視，並在此明列；不宣稱已做到內容等高。

## Job 紀錄與 prompt 原文

原始工具輸出均留在內建預設 generated_images 目錄；選定第 3 與第 6 次的 PNG 複製至專案。第 1、2、4、5 次是淘汰稿，未當成最終交付。全部採一次一個 job。

### Job 1

輸入：三張已檢視的參考圖，依序為後院、卡背、card-ababa。

結果：地景初版：樹冠與野餐布被裁邊，底部有花草；淘汰。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-ab0c0485-57a4-49bd-99cd-9a5c807d6114.png by default.

Prompt 原文：

```text
Use case: stylized-concept
Asset type: portrait scrolling game map background, ruined backyard sample.
Input images: image 1 is the original backyard, the exact landmark shape reference; image 2 is the card-back style reference; image 3 is the character-card hand-drawn line reference. Do not modify reference files.
Generate ONE portrait image, aspect ratio 3:5, ideally 1200x2000. Reimagine this SAME backyard after ruin, with thick slightly irregular black outlines, flat restrained colors, hand-drawn sticker illustration language like the card references. Absolutely no realistic lighting, gradients, metallic reflections, glow, gems or diamonds. No text, letters, numbers, logos, watermarks, labels, UI, borders or characters.
Composition: central vertical 30% (x=35%-65%) must be extremely simple uninterrupted broad flat sky and grass, no patterned or small high-contrast details. Keep ALL landmark silhouettes outside this center strip. Top 10% is plain muted blue-gray sky; bottom 10% is plain muted dry grass, both clean transition zones, with no landmark touching them. Sky clearly reads as sky, darker than original bright blue but not black.
Keep original recognizable shapes rather than replacing them:
LEFT at x=4%-31%, y=22%-58%: the SAME broad brown tree trunk forking into two uneven prongs as original, with cut rounded ends and three blackened depleted rounded foliage masses. Preserve the two-prong branching silhouette. Entire tree within margins.
RIGHT at x=70%-96%, y=42%-65%: original ivory-white pointed picket fence, now broken with missing and fallen slats, beside same small RED rounded-top mailbox on brown post, tilted with flap open. Strong recognizable mailbox red body and silhouette.
LOWER RIGHT at x=68%-95%, y=72%-88%: original perspective trapezoid red-and-ivory checkered picnic blanket, torn and dirty, one corner curled, clear large checker squares, full contour intact within frame. Keep blanket wholly to right of center corridor.
Subtle simple rolling muted olive hills preserve backyard identity. Sparse wilted flowers and fallen grass ONLY at lateral edges. Side landmarks are large and clear. Flat bounded color patches only, no noisy textures. The center remains calm even between landmarks.
```

### Job 2

輸入：第 1 次輸出作編輯目標。

結果：地景修正：清掉多餘裝飾，但仍裁切野餐布與左側樹冠；淘汰。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-be445c68-913e-4ba2-9b67-3a0558188c3f.png by default.

Prompt 原文：

```text
Use case: precise-object-edit
Edit this portrait ruined backyard map image. Preserve its original two-pronged cut tree trunk identity, three rounded charred foliage clumps, red open mailbox and ivory pointed picket fence, and torn red-ivory perspective checkerboard blanket. Preserve portrait 3:5 composition and no text.
Fix these defects rigorously:
1. ALL main landmarks must be fully visible and NOT cropped at any edge. Move and scale the complete left tree including all three foliage clumps into x=5%-32%, y=23%-55%. Its trunk must remain the same two-pronged rounded-cut shape. Remove extra bare trees to simplify.
2. Fit the entire torn checkerboard blanket including all corners into x=68%-94%, y=72%-86%. No part beyond the right edge. Keep original trapezoid perspective and clear checkered pattern, torn hole and rolled corner.
3. Fit the broken ivory pickets and red open mailbox fully into x=70%-94%, y=44%-62%.
4. Top 10% must be completely plain single flat blue-gray sky, no cloud or decoration. Bottom 10% must be completely plain single flat muted olive grass, no flowers, stones, leaves or texture. No border.
5. Entire central 30% x=35%-65% must have no shrubs, twigs, grass marks or small details; only broad simple sky and grass areas with at most a simple hill contour.
6. Replace ALL gradients, shading, paper texture and mottling with uniform FLAT solid fills. Thick irregular black hand-drawn outlines, restrained flat cartoon sticker color blocks. No volumetric lighting.
Keep the three landmark identities recognizable as the same original backyard. No text, numbers, letters, logo, watermark, arrows, UI, gems, glow or metallic reflections.
```

### Job 3

輸入：原後院、卡背作參考。

結果：重新生成地景，識別物完整；選為地景成品，仍有微弱色調起伏。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-65d9ba24-bc35-4801-8f1f-cab96bc7a971.png by default.

Prompt 原文：

```text
Create a new portrait 3:5 game background illustration. Use attached original backyard for landmark identity and attached cardback for thick black rough cartoon lines and flat colors. The whole drawing must look like simple paper stickers with SOLID flat colors and NO gradients or light shading.
A ruined version of this SAME backyard: darkened blue-gray sky, muted dry olive grass, one very simple rolling hill. Exactly THREE landmark groups, FULLY INSIDE THE IMAGE with generous margins:
A. Left group: the original brown tree with its distinctive two thick forked arms with rounded cut ends and three round clumps of charred dark foliage, fully visible. Group fits entirely within left 5%-30% of image width and 25%-55% of height. No part of tree touching frame. No signboard.
B. Right middle group: a few damaged WHITE POINTED picket fence slats and the RED rounded mailbox on a crooked wood post with its door open. Group fits entirely within right 72%-94% of width and 45%-60% of height. Entire silhouettes visible.
C. Right lower group: a SMALL COMPLETE TRAPEZOID red and cream checkered picnic blanket with a torn notch and one curled corner, fits entirely within 70%-94% of width and 74%-85% of height. Show ALL FOUR CORNERS and ENTIRE outline, with ample grass visible between its RIGHT edge and image edge. Keep large recognizable checker pattern. This is a distant small blanket, NOT a foreground closeup.
Keep CENTRAL 30% of image width absolutely empty of objects or pattern, just broad sky and grass. Top 12% entirely blank sky. Bottom 12% entirely blank grass. No clouds, flowers, pebbles, spare trees, shrubbery or decoration. Simple flat bounded color areas. Thick BLACK outlines only on landmarks and one hill contour. No text or symbols of any kind, no UI, no letters, numbers, logos, watermark, glow, gems or metallic reflections. Output the complete new illustration, with all landmark objects smaller than the earlier original wide view so they have safe margins in the narrow portrait.
```

### Job 4

輸入：卡背作畫風與爪印參考。

結果：圖示初版：閘口跨中線，不利等分裁切；淘汰。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-ceaac834-ec6c-4c14-bed3-a26b1b799691.png by default.

Prompt 原文：

```text
Use case: stylized-concept
Asset type: game map icons-sheet.png, ONE square image.
Reference image is cardback, STYLE AND PINK PAW MOTIF ONLY, do not draw card border or dog.
Draw exactly FOUR isolated hand-drawn sticker motifs in a clean 2x2 arrangement. Each cell holds one motif, with wide empty gutters. Background must be ONE uniform solid bone-white color across whole sheet, no paper texture, no gradients. No grid lines or panels.
TOP LEFT: a chunky irregular hand-drawn check mark, muted sage green fill, thick black outline and narrow cream sticker rim. This is a drawn shape, never a typed font character.
TOP RIGHT: a simple chunky padlock, dark blue body and cream rounded shackle, black outline, a small simple keyhole. Flat color, no metallic reflections.
BOTTOM LEFT: a pink animal paw print with one large soft main pad and four small toe pads, same motif as cardback and original backyard pink paw flag. Thick slightly wobbly black outline and narrow cream sticker rim, no enclosing flag.
BOTTOM RIGHT: a large ruined checkpoint gate SILHOUETTE, two uneven stout dark navy gateposts joined overhead with a lintel and recognizable barred doorway; small broken stone contours. Flat dark silhouette with bone-white negative-space openings, black edge and narrow cream sticker rim. The gate must occupy visibly more width and height than other motifs (about 80% of its quadrant), do NOT shrink to match their size. Other motifs about 50%-60% of their quadrants.
Exactly these four motifs. Cohesive rough black hand-drawn linework, flat restrained pink, navy, cream, sage palette. No realistic light or shadow, no gradient, glow, gems, diamonds, extra symbols, decorative stars, text, letters, numbers, logo or watermark. NOT emoji, NOT a font glyph sheet. Generous outer padding, all four shapes complete and separated by clear empty central horizontal and vertical gutters.
```

### Job 5

輸入：第 4 次輸出作編輯目標。

結果：圖示修正：閘口仍跨垂直中線；淘汰。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-6fee0e22-bd73-4efc-a688-cdc3ce12676f.png by default.

Prompt 原文：

```text
Edit this four-icon sheet. Preserve the same four hand-drawn thick-black outlined motifs and their colors and shapes: top-left sage check, top-right navy padlock, bottom-left pink paw, bottom-right larger ruined gate. Make ONLY these production-layout corrections:
- Strict equal 2x2 quadrants in the square canvas. Center dividing lines are at 50% width and 50% height (DO NOT DRAW LINES). Every complete sticker must fit within its own quadrant.
- Move/scale the gate so its entire sticker silhouette and rim fit inside x=55%-95%, y=55%-95%. Gate remains larger than each other motif.
- Fit check within x=10%-40%, y=10%-40%; lock within x=60%-90%, y=10%-40%; paw within x=10%-40%, y=60%-90%.
- Completely uniform solid bone-white background RGB (248,243,223), including all empty gutters. No background texture, no vignette, no variation, no shadow. Flat color fills inside each motif too; remove all gradients and mottling. Preserve rough black hand-drawn contours and cream sticker rims.
No new objects, no text, no letters, no numbers, no lines separating cells, no glow, no gems or metallic effects. Exactly one square sheet with exactly four motifs.
```

### Job 6

輸入：無圖片附件；依已檢視參考的文字規格重新生成。

結果：重畫圖示，四格均可獨立裁切；選為成品，純色背景仍未嚴格達成。

工具輸出位置：

Generated images are saved to C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a as C:\Users\ASUS User VII\.codex\generated_images\01a08a65-7fbf-7792-818b-d516f4d3813a\exec-31e532a6-6bd8-4a7a-875f-757e56789148.png by default.

Prompt 原文：

```text
Create one SQUARE 2x2 game icon sprite sheet on a SINGLE SOLID BONE-WHITE BACKGROUND. Four separate hand-drawn outlined stickers. Use thick slightly wobbly BLACK cartoon outlines, utterly flat solid fills, no shading, no texture.
CRITICAL: Reserve an EMPTY CROSS-SHAPED GUTTER: x=44% to 56% is empty from top to bottom; y=44% to 56% is empty from left to right. No sticker or outline can touch these gutters. All four motifs are fully within their own quadrants. Outer 8% margin is also empty.
Top-left quadrant: green hand-drawn chunky check mark centered at (25%,25%), width 24%, height 24%.
Top-right quadrant: navy blue padlock with cream shackle centered at (75%,25%), width 24%, height 24%.
Bottom-left quadrant: soft pink animal paw with 4 oval toes and one main pad, centered at (25%,75%), width 24%, height 24%.
Bottom-right quadrant: dark navy ruined checkpoint gate silhouette with broken stone posts, overhead lintel, barred opening, centered at (75%,75%), width 34%, height 34%. Gate is larger than each other icon but must be entirely between x=58%-92% and y=58%-92%.
No boxes around icons, no drawn dividing lines. Thin cream sticker rim optional. Hand-drawn sticker silhouettes, NOT typed glyphs or emoji. Restrained sage, navy, pink and cream. No text, labels, alphabet, numerals, logos, watermark, stars, gems, glow, reflections or gradients. Background identical single bone-white color everywhere outside the four stickers.
```

## 範圍與檢查

只新增 map-art 下三張交付圖與本報告；沒有更動原參考圖、src、map20.html 或其他文件。未 build、未啟動 server、未 commit、未 push。只用工具複製圖檔、以記憶體中的 Python 指令製作指定並排圖與進行量測，未新增程式檔或接線。

Git 初次只讀狀態查詢遇到 dubious ownership；改用單次命令的 safe.directory 設定讀取，未修改全域或專案 Git 設定。

