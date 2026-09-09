# 抽卡介面／揭曉演出／UI 材質　資源研究

日期：2026-09-09。分支 `holo-cards`。本文只寫研究，未改動任何程式碼。

**查證方式**：下表每一條都由我實際打開過（WebFetch 或瀏覽器）。打不開的我寫「打不開」，
授權一律以官方頁／repo 的 LICENSE 為準，不用印象。截圖觀察我會標「（我實際看到）」。

**一個前提要先講清楚**：`BRIEF-reveal-research.md` 給的硬限制是
「WebAudio 合成、**不引第三方素材**、卡面工法凍結」。所以下面盤點的東西分兩類——
**可以搬技法／自己重寫**的（不違反限制），和**必須引入外部庫或素材**的（要另外拿授權決策）。
我在每一條都標了。

---

## 一、參考連結的實查結果

### 1-1　使用者昨天給的那串來源

| 連結 | 實際是什麼 | 授權 | 技術路線 | 跟我們的差異 | 可直接搬什麼 |
|---|---|---|---|---|---|
| https://x.com/itshanrw/status/2096881026329202695 | itshan 的推文（**我實際讀到內文**）。內容就是把 3D 鐳射效果的源頭列出來：simeydotme 的 poke-holo ＋源碼、html.non.io 的兩個頁、zackon.top 的兩篇。它引用（quote）了 @everettfish0408 2026-09-07 的貼文「開源一個新 Skill：3D 鐳射卡片生成」。20.3K 瀏覽。 | — | — | 這則本身沒有技術內容，只是索引 | 索引價值：確認了下面五條就是全部來源，沒有漏 |
| https://poke-holo.simey.me/ | Pokemon Cards v2 官方 Demo（**我實際看到**）。頁面自述：「advanced CSS styles to create realistic-looking effects… 3d transforms, filters, blend modes, css gradients」，用 SvelteJS 管互動與狀態，把值指派到 custom properties 再驅動效果與 3D transform。分區展示 Common & Uncommon / 各種 holo 類型 | 見下一列（同 repo） | 純 CSS ＋ Svelte 狀態層 | **跟我們同一條路**。我們的 `card_face.js` ＋ `foil-stack`（spectrum/relief/etch）＋ `foil-fiber`/`foil-grain`/`foil-glare` 就是這套的重寫版 | 沒有新東西可搬，但它是「材質正確性」的對照組。**另外一個重點在下面第二節**：它自己的頁面 UI（搜尋框、標題、導覽）是完全啞光的深藍灰，一點箔面都沒有 |
| https://github.com/simeydotme/pokemon-cards-css | 源碼庫，8.2k star / 799 fork / 135 commits，SvelteJS ＋ Vite | **GPL-3.0**（⚠ copyleft，不是 MIT） | CSS transforms / gradients / blend-modes / filters | 同上 | **授權要注意**：GPL-3.0 意思是照抄它的 CSS 進我們的專案，我們的專案就得跟著 GPL。我們現在是自己重寫的實作，建議**維持「看規格、自己寫」**，不要直接複製它的 `.scss`。README 另外指向作者的 `hover-tilt`（見下） |
| https://github.com/simeydotme/hover-tilt | 同作者另外抽出來的傾斜＋眩光元件，npm 可裝，**同時提供原生 Svelte 元件與 Web Component**（所以 Vue/React/Astro/vanilla 都能用），文件在 hover-tilt.simey.me | **MPL-2.0**（比 GPL 寬鬆很多：檔案級 copyleft，改到它的檔案才要公開，整合進閉源專案沒問題） | Web Component ＋ CSS transform | 我們的傾斜是自己算的（`--phase`/`--fx`/`--gx`），已經比它多做卡型分支 | 授權比主庫友善，但**我們不需要**——傾斜是我們已經解決的部分 |
| https://html.non.io/hydroponics | **不是鐳射卡**。是一個叫「Artisan Hydroponics」的水耕研究公司行銷首頁（**我實際看到**）：米白底、襯線大標、植物墨線插畫、右側人像＋植物合成主視覺、三張功能卡片 | 沒有標示授權或作者 | 純 HTML/CSS ＋ 靜態圖（webp/svg），無 canvas、無 WebGL | **跟卡面材質完全無關** | 它的價值是**版面與材質克制的示範**，不是鐳射。如果 itshan 是拿它當「AI 一次產出的高質感 HTML」範例，那它對我們的意義只有排版節奏 |
| https://html.non.io/tarot | 「Tarot Sanctuary」塔羅占卜落地頁（**我實際看到**）。深藍夜色、左邊一張「THE SUN」大牌、右邊 CTA 面板。**這一頁有真東西**：DOM 裡有 2 個 `<canvas>`，外掛兩支腳本 `js/device-tilt.js`（8.2 KB）與 `js/card.js`（25.3 KB） | 沒有標示授權（Cloudflare 託管，有 CF beacon） | **WebGL2 shader**。我把 `card.js` 抓下來讀了，裡面有完整的 GLSL：`uniform sampler2D uDiffuse / uNormal / uRough / uHeight`、`uMouse`（游標在 canvas UV，y 向上）、`uHasMouse`、`uParallax`、`uLightZ`、`uNormalStr`、`uSpecStr`、`uDiffuseAmt`、`uAmbientAmt`、`uLightColor`、`uAmbientColor`、`uMotion`。函式有 `createLitLayer` / `compile` / `makeTex` / `upload` / `draw` / `frame` / `loadTex` / `loadSet` / `loadCard`，以及 `tween` / `stepTweens` / `applyCardTransforms` / `tiltFrame` / **`spawnFlyOut`** | 這是**跟我們不同的第三條路**：不是 CSS 疊圖層、也不是完整 3D 物件，而是「**一張 2D 卡 ＋ 法線貼圖 ＋ 高度貼圖，在 fragment shader 裡打一盞跟著游標跑的點光**」。視差來自 height map 而不是 `translateZ` 分層 | **概念可搬、程式不可搬（沒授權）**。兩個直接有用的想法：(a) `uHeight` 驅動視差比我們的 `translateZ` 分層更連續，角色圖的凹凸不用切圖層；(b) **`spawnFlyOut`**——它有現成的「卡飛出去」動畫函式名，證明這條路做揭曉是可行的 |
| https://zackon.top/ziggy-card/ | Isaac Johnson 的 Ziggy Card WebGL Demo（**我實際看到，WebFetch 回 403，用瀏覽器才進得去**）。一張全息狗狗卡在暗場中央，右側一整排 Leva 控制面板：Foil（Hue cycles / Tilt shift / Milkiness / Saturation / Warp / Line freq / Line angle / Glint / Sparkle / Sparkle density / Sparkle size / Brightness）、Substrate、Motion、Channels（Albedo / Holo mask / Normal map / Normal amount 可個別開關）、Presets（Rainbow rare / Cosmos / Line holo / Reverse）。頁尾標示 React 19 · Three.js · R3F · Tailwind v4 · Vite | 沒有標示授權，也沒有給 repo（只給「React Three Fiber starter kit」的連結） | **React Three Fiber ＋ 自訂 GLSL patch** | 最遠離我們現況、也最值得學的一條 | 不能搬程式（沒開源），但**方法論全公開在下一列的長文裡** |
| https://zackon.top/posts/building-ziggy-card/ | 〈I Turned My Dog Into a Pokémon Card〉，2026-06-16，Isaac Johnson。**完整技術剖析長文，含大量 GLSL／JS 片段**（我全文讀過） | 文章沒標授權（引用可，複製整段程式碼要留意） | R3F ＋ `MeshPhysicalMaterial` 的 `onBeforeCompile` patch | **這篇是本次研究最有價值的一份** | 見下面 1-2 的拆解 |
| https://x.com/everettfish0408 的原貼 | **打不開**（WebFetch 回 402 Payment Required，X 對未登入的單則貼文擋）。但內容我從 itshan 的引用讀到了：「開源一個新 Skill：3D 鐳射卡片生成…看到一堆 GPT 6 Astra 玩 Blender 的影片…它能自己生圖又能直接操作 Blender」 | — | — | — | **repo 找到了**：見 1-3 |

### 1-2　Ziggy Card 那篇長文，實際可用的九個結論

原文網址：https://zackon.top/posts/building-ziggy-card/
（以下引號內為原文片段，我逐條核對過。）

1. **先做物件，再做 shader**。卡片建成三層薄的無倒角圓角擠出：正面紙帶／深色芯／背面紙帶，正反面另外用 `ShapeGeometry` 貼在上下。預設尺寸 `WIDTH 2.1 / HEIGHT 3.0 / DEPTH 0.012 / CORNER_RADIUS 0.12`。他的說法是 0.012 厚度小到幾乎看不見，但「足夠接到 rim light」，卡才會像紙而不像塑膠道具。
   → **對我們的意義**：我們的 CSS 卡沒有側邊。要做「翻卡」演出時側面一定會露出來，這個 0.012 的比例（深度／高度 = 1:250）可以直接拿來當側面條的厚度基準。

2. **不要自己寫全套 ShaderMaterial**。他繼承 `THREE.MeshPhysicalMaterial`，只用 `onBeforeCompile` 換掉需要的 chunk：
   ```
   .replace("#include <common>", ...)
   .replace("#include <map_fragment>", ...)
   .replace("#include <roughnessmap_fragment>", ...)
   .replace("#include <metalnessmap_fragment>", ...)
   .replace("#include <normal_fragment_maps>", ...)
   .replace("#include <opaque_fragment>", ...)
   ```
   理由：「Replacing the whole material would have given me total control, but it also would have handed me lighting problems I did not need.」

3. **箔面遮罩不是顏色疊加，是「材質許可證」**。他算一個 `exposedFoil`：
   ```glsl
   float exposedFoil = clamp(holoMaskValue * pow(max(1.0 - whiteInkValue, 0.0), 1.4), 0.0, 1.0);
   metalnessFactor = mix(metalnessFactor, uFoilMetalness, exposedFoil);
   roughnessFactor = mix(roughnessFactor, uFoilRoughness, exposedFoil);
   ```
   原文的判準句：「This is the difference between "rainbow sticker" and "different substrate."」
   → **對我們的意義最大**。我們手上已經有 `subject-mask`，但目前它只讓「光走在角色身上」。這篇說的是：遮罩應該同時改變**粗糙度與金屬度**，不只是改顏色。CSS 沒有 roughness，但等價操作是**同一個 mask 同時驅動 `filter: contrast()/brightness()` 與 glare 的 blur 半徑**——箔面區要更銳、更亮、對比更硬。

4. **閃光來自視角，不是來自時間**。他把反射向量投影到切線空間得到一個 2D tilt，再拿 tilt 算 hue：
   ```glsl
   vec2 tilt = vec2(dot(reflectionDirection, holoTbn[0]), dot(reflectionDirection, holoTbn[1]));
   float hue = along * uHue + dot(tilt, dir) * uTshift + (w - 0.5) * 1.2;
   vec3 sheen = 0.5 + 0.5 * cos(PI2 * (hue + vec3(0.0, 0.33, 0.66)));
   ```
   箔面由三層組成：柔和光譜（sheen）＋ 各向異性刷紋（brushed lines）＋ 離散閃粉（glitter flecks）。
   → 我們的 `foil-spectrum` / `foil-relief` / `foil-etch` 三層剛好對應，命名可以互相驗證。那個 `0.5 + 0.5*cos(2π(hue + [0, .33, .66]))` 就是 conic-gradient 彩虹的數學原式。

5. **動態來自角速度，不是計時器**。
   ```js
   const angularDistance = 2 * Math.acos(quaternionDot);
   const angularVelocity = angularDistance / safeDelta;
   const targetMotion = clamp(angularVelocity * motionSensitivity, 0, 1);
   foil += spark * uSpark * (0.7 + uMotion * 0.9);
   foil *= uBright * (0.85 + uMotion * 0.55);
   ```
   「The card can be shiny without constantly animating for its own sake.」
   → **這條可以直接解掉使用者「現在的揭曉不滿意」的一半**：把 `--motion` 做成由 `--phase` 的一階微分（每幀角度差）算出來的變數，而不是一條 loop 動畫。卡不動就不閃，卡一甩就爆亮——這才是「舊版光芒比較好」的物理原因。

6. **色彩空間**。albedo 與卡背用 `THREE.SRGBColorSpace`，遮罩／roughness／normal／metalness 用 `THREE.NoColorSpace`。原文：「Not broken enough to throw a useful error, just wrong enough to waste an afternoon.」
   → CSS 等價坑：我們的 mask PNG 如果被當成彩色圖去做 `mix-blend-mode`，門檻值會偏。

7. **打光跟 shader 一樣重要**。他用棚拍配置：中等強度環境反射、大面暖色主光箱、冷色副光、窄邊緣光（打卡邊）、頂部髮絲光、微暖底補光，再加 bloom / vignette / 一點點 noise。有個 three.js 實務坑：`RectAreaLight` 要先 `RectAreaLightUniformsLib.init()` 才會正常。
   結論句：「Materials do not become convincing in isolation.」

8. **早點做旋鈕、把好狀態存成 preset**。他用 Leva，presets 是 Rainbow rare / Cosmos / Line holo / Reverse。
   → 我們的稀有度（common→mythic）本質上就是 preset 列表，這個模型可以直接對映。

9. **防呆與 reduced-motion**。掛場景前先驗 WebGL2（`canvas.getContext("webgl2")`），沒有就顯示訊息而不是白畫面；`prefers-reduced-motion` 時停掉自動搖擺，但**手動 orbit 保留**（因為那是使用者主動觸發的）。
   他自己列的下一步待辦裡有兩條跟我們有關：「add a static poster image and short video fallback」「bake stable composites offline」。

### 1-3　@everettfish0408 的 Skill：找到了

- **Repo**：https://github.com/EverettFish/holo-card-studio
- **授權**：**MIT**（我開了 LICENSE 檔：`MIT License / Copyright (c) 2026 Holo Card Studio contributors`）。這是本次所有資源裡授權最乾淨的一個。
- **它是什麼**：一個 Codex Skill。輸入是文字描述或參考圖，輸出是「可互動的 Three.js 網頁 ＋ 可編輯的 `.blend` ＋ 四層 PNG ＋ 渲染圖」。
- **依賴**：Python 3 ＋ Pillow、Node.js ＋ npm、Blender（**腳本會自動下載官方免安裝版**，不用手動裝）。
- **檔案結構**：
  ```
  scripts/ensure_blender.py       下載官方 Blender 免安裝包
  scripts/generate_typography.py  產透明文字層
  scripts/validate_assets.py      驗四層圖的對位與透明
  scripts/build_card.py           產可編輯的 Blender 場景
  scripts/export_web.py           匯出卡片幾何
  scripts/run_pipeline.py         總調度
  assets/web-template/            Three.js 檢視器
  ```
- **七步流程**：① 建專案與卡片規格 → ② 生主體／背景／線稿三層＋文字層，跑 `validate_assets.py` → ③ 寫 `card-config.json` → ④ `run_pipeline.py --project <name>`（找／裝 Blender、產場景、匯出幾何、組 Three.js 站） → ⑤ `node <project>/web/server.mjs` 本地驗 → ⑥ 開 `.blend` 目視驗 → ⑦ 交付。
- **它的 Blender 鐳射材質規格（原文重點，這段最值錢）**：
  - 箔面：mapped bands，**scale ≈ 0.55、distortion 7、mapping Y ≈ 32°**，另接一張 pattern 圖做 mapping，經 Multiply/Add，配**粉→黃→藍→白的 color ramp**，再 Overlay。硬性要求：「**The spectrum phase must change with viewing angle, not only time.**」（跟 Ziggy 那篇同一個結論，兩個獨立來源互相印證）
  - 發光遮罩：主體 BSDF 用**黑色 emission**；stripe 與 line 的 emission 分開合成，line strength ≈ **40**，但要**稀疏遮罩**，才不會把印刷字的細節蓋掉。
  - 星芒：Voronoi 的 distance-to-edge ＋ 動畫 noise。
  - 視差：**把視線方向轉進卡平面、除以法線分量、再用帶符號的深度去位移 UV**——原文明講「不是只把 UV 置中」。
- **Three.js 匯出契約**：四個材質槽 `web_front` / `web_edge` / `web_back` / `web_gold`；網頁端用**相同的 UV 公式**合成四層圖，**V 座標只能還原一次**，並且**要測兩個旋轉方向**才抓得到拖影或視差反向。
- **另一個索引**：https://github.com/magiccreator-ai/awesome-gpt-6-astra 的 Blender & 3D 區有「Holographic 3D Cards」條目指向這個 repo（該清單本身沒標授權）。

---

## 二、箔面材質能不能套到卡片以外的 UI

### 結論

**不能整套搬，但可以拆成三件事分開用。**

箔面材質是四個東西的合成：① conic-gradient 彩虹、② `mix-blend-mode`、③ 隨游標／角度移動的光位、④ 顆粒／閃粉貼圖。
**只有 ③（光位隨互動移動）可以自由套到 UI；① 幾乎不能；② 要限制在單一元件內；④ 只能當靜態肌理，不能動。**

理由不是品味問題，是**注意力經濟**：抽卡頁面上唯一該閃的東西是剛抽到的那張卡。
每多一個會閃的 UI，那張卡的閃就少值一分。彩虹在畫面上是**最高階的訊號**，用在按鈕上等於把最高階訊號花在「你可以再按一次」。

### 三個實證案例（都是我實際打開看過的）

1. **poke-holo.simey.me 自己**——全世界最會做 CSS 箔面的那個人，他的展示頁 UI 是**完全啞光的深藍灰**：純色標題、沒有邊框特效的搜尋輸入框、樸素的內文連結。卡在下面閃，UI 一點都不閃。
2. **zackon.top/ziggy-card/**——整頁純黑，唯一的 UI 是右側 Leva 面板，深灰底＋藍色滑桿＋藍色 preset 按鈕。做了一整套光譜 shader 的人，控制面板連漸層都沒有。
3. **html.non.io/tarot**——這頁最能說明「怎麼在有卡的頁面做 UI」：整頁深藍夜色，卡是唯一發光體（WebGL、跟著游標打光）；旁邊的主 CTA「DRAW A CARD」是**一整塊實心橘**，次要 CTA 是深色玻璃面板，intention chips 是細線描邊。**沒有任何一個 UI 元件用彩虹**，主 CTA 用的是跟卡上太陽同一個橘——**呼應卡的顏色，但不模仿卡的材質**。

### 逐項判斷

| UI 元素 | 合理用法 | 會很俗／很吵的用法 | 我的建議 |
|---|---|---|---|
| **面板背景** | 極低飽和的箔面殘影：把 spectrum 層 `opacity` 壓到 0.03–0.05、飽和度砍到 15%，只在面板頂緣做一道緩慢的方向性微光。作用是「這個介面跟卡是同一種材質」，不是「這個面板會發光」 | 整片 conic-gradient 當背景。彩虹背景會讓上面所有文字失去對比，而且卡放上去之後兩層彩虹會互相打架 | ✅ 做，但要壓到**幾乎看不見**。判準：截圖去飽和後應該看不出面板有漸層 |
| **一般按鈕** | 只做 `foil-glare` 的那一層——一道跟隨游標的白色柔光掃過，`mix-blend-mode: soft-light`，不帶色相 | conic 彩虹描邊、跑馬燈邊框。Magic UI 的 border-beam 那類效果放在**一頁只有一個**的主 CTA 上是對的，放在每個按鈕上就變成聖誕燈 | ✅ 眩光可以，❌ 彩虹不行 |
| **稀有度徽章** | **這是唯一該全套用箔面的 UI**。徽章本來就是「稀有度的化身」，materially 它就該是卡上箔面的一小塊。而且它面積小，彩虹在小面積上讀起來是「金屬」不是「油漬」 | 每一階都用彩虹。應該只有 legendary / mythic 兩階有箔面，epic 以下用實色或單色金屬——不然徽章就不再是分級訊號 | ✅ 做，但**只給最高兩階** |
| **抽卡按鈕的按下回饋** | 按下瞬間讓 `--phase` 跳一大步（等同 Ziggy 的 `uMotion` 尖峰），光位掃過去再回彈。**這是「隨互動移動的光位」的正解用法**：光只在你按的那一瞬間動，之後靜止 | 常駐的旋轉光暈、呼吸漸層。閒置時會閃的按鈕會一直偷走注意力，而且違反我們自己的閒置效能規矩 | ✅ 強烈建議做。這是四個元素裡最安全也最有回報的一個 |
| **標題字** | 用**單色**的金屬漸層（暗金→亮金→暗金的 linear-gradient ＋ `background-clip: text`），配一道會走的高光。金屬感靠明度對比，不靠色相 | 彩虹字。彩虹填色的文字在深色底上可讀性會掉一階，而且立刻讀成 2014 年的 Web 特效 | ⚠ 只做單色金屬，**不做彩虹** |
| **卡片列表／背包縮圖** | 靜止時全部啞光，只有 hover 的那一張啟動箔面 | 列表裡每張都在閃 | ✅ hover 才啟動 |

### 可以照抄手法的參考實作

- **Magic UI**（https://magicui.design/ ，repo https://github.com/magicuidesign/magicui ，**MIT**，React ＋ Tailwind ＋ Framer Motion，複製貼上型元件）。相關元件：`border-beam`（一道光沿容器邊框跑，文件頁我開過，透過 `transition` prop 吃 motion 設定，支援 spring）、`shine-border`、`shimmer-button`、`animated-shiny-text`、`glare-hover`、`aurora-text`、`magic-card`。
  → **我們不該裝這個庫**（React 依賴、違反不引第三方的精神），但這幾個元件是「把箔面挪到 UI 上而不俗」的成熟樣板，值得逐一看它的 CSS 再自己寫。特別是 `glare-hover`——那就是我們該給按鈕的那一層。

---

## 三、揭曉演出資源盤點

整合難度：1＝抄一段 CSS 就好，5＝要改架構或引重依賴。
「限制」欄標的是跟 `BRIEF-reveal-research.md` 硬限制（不引第三方素材）的關係。

| # | 網址 | 是什麼 | 授權 | 技術棧 | 難度 | 限制 | 看點 |
|---|---|---|---|---|---|---|---|
| 1 | https://zackon.top/posts/building-ziggy-card/ | **拆解教學**（全文，含 GLSL／JS 片段） | 未標授權（引用可，勿整段複製） | R3F ＋ GLSL patch | 2（取觀念）／5（照做） | 純技法，不引任何東西 | **本次第一名**。「角速度驅動閃光」與「遮罩改材質不改顏色」兩條可以直接改寫成 CSS 變數版，不用引庫。見 1-2 第 3、5 條 |
| 2 | https://github.com/EverettFish/holo-card-studio | **Skill ＋ 可跑的 pipeline**（Blender→Three.js） | **MIT** | Python ＋ Blender ＋ Three.js | 4 | 會引入 Blender 產的素材 | 唯一 MIT 的完整鐳射卡管線。就算不用它產片，**它的材質參數（bands scale 0.55／distortion 7／mapping Y 32°／粉黃藍白 ramp／line strength 40 稀疏遮罩／Voronoi 星芒）可以當數值起點**，省掉一輪盲調 |
| 3 | https://html.non.io/tarot （`js/card.js`, `js/device-tilt.js`） | **可拆解的線上實作**（WebGL2 卡面＋`spawnFlyOut` 飛出動畫＋裝置傾斜） | **未標授權 → 不可複製程式碼** | WebGL2 fragment shader，diffuse/normal/rough/height 四張圖 | 3（重寫觀念） | 只取觀念 | 兩個具體想法：height map 做連續視差（取代 translateZ 分層）；`device-tilt.js` 是手機端傾斜的獨立小檔（8.2 KB），我們手機版目前沒有傾斜輸入 |
| 4 | https://github.com/tsparticles/tsparticles ／ https://confetti.js.org/ ／ https://particles.js.org/samples/presets/fireworks.html | **JS 庫**：粒子／彩帶／煙火，`@tsparticles/confetti`、`@tsparticles/fireworks` 都是**單行呼叫**的 preset 包 | **MIT**（confetti 與 fireworks 包我在 npm 頁確認過） | Canvas 2D／WebGL，有 Web Component 版（不綁 React） | 2 | ⚠ 引第三方庫（但不引「素材」，粒子是程式生成的） | 揭曉爆點最省力的一條。fireworks preset 的爆散曲線可以直接當 mythic 的節拍參考，就算不裝庫也值得看它的 easing |
| 5 | https://github.com/pmndrs/postprocessing | **JS 庫**：three.js 後製效果集 | **Zlib**（源自 three.js 的部分保留 MIT） | three.js peer dependency | 5 | ⚠ 需要整個 three.js 場景 | 直接命中需求清單的三項：**Chromatic Aberration**、**Glitch**、**Shock Wave（帶 depth picking）**，另有 Bloom / God Rays / Vignette / Noise。**但這條要先有 WebGL 場景才用得上**——如果我們維持 CSS 卡面，這條是死的，只能拿它的參數當靈感 |
| 6 | https://tympanus.net/codrops/2022/06/27/volumetric-light-rays-with-three-js/ | **拆解教學**（Codrops，akella），Demo https://schweinkarausdisco.netlify.app/ ，設定在 gist https://gist.github.com/akella/a19954c9ee42e3ae85b76d0e06977535 | **MIT**（Codrops 授權頁明寫：downloadable demos 除非另行標示皆為 MIT） | three.js fragment shader | 3 | ⚠ 需要 WebGL | **「稀有度光柱」的正解來源**。使用者說「舊版本抽到的光芒比較好」，體積光柱正是那個東西的物理版。MIT 可商用 |
| 7 | https://github.com/jianzhishendi/Genshin-Impact-Wish-Simulator-1 （fork 自 https://github.com/Mantan21/Genshin-Impact-Wish-Simulator ，線上版 https://wishsimulator.vercel.app） | **可跑的參考實作**：原神抽卡模擬器，README 自述「Include **meteor and reveal animation**」 | ⚠ **未標授權**，且 README 有免責「No affiliation with mihoyo, all data belongs to Mihoyo」 → **只能看，不能抄** | SvelteKit ＋ JS，localStorage/IndexedDB | 1（觀摩）／不可用（複製） | 不可引用 | 使用者點名的「原神：流星→色光→立繪」就是這個。**價值在節拍**：流星飛入的時長、色光判別的那一刻停多久、立繪推進的緩速。這些數值可以量出來自己重做 |
| 8 | https://github.com/catptype/Blue-Archive-Gacha-Simulator-V2 （線上 gacha-sim.onrender.com） | **可跑的參考實作**：README 明寫「high-impact, multi-stage **"Prismatic Burst"** animation for revealing rare (★★★) students, complete with foil shines and sparkle effects」 | ⚠ 非營利同人專案，授權未在 README 標明 → 觀摩 | Django ＋ Tailwind ＋ Alpine.js（前端很輕，**沒有 three.js**） | 2（觀摩） | 不可引用 | **對我們最像的一個**：它用純 CSS/JS 做出了多階段的稀有度爆發。證明「不引 WebGL 也能做出重量級揭曉」。⚠ 它的 Render 免費資料庫寫著只活到 2025-11-19，線上版可能已死，**要看得趁早或直接看 repo 的 CSS** |
| 9 | https://codepen.io/NaveenPantra/pen/ExKbrQB | **CodePen Demo**：Game Card Reveal Animation（**我開過，還活著**，畫面是一張 CS:GO 卡） | CodePen 預設 **MIT** | **純 CSS**，用自訂 `cubic-bezier(...)` 與分層 `transition-delay` | **1** | 零依賴 | 最低成本的一條。它的價值是**揭卡 easing 的骨架**：多個 transition 各自 delay，卡才會有「先傾、再彈、最後定住」的層次。可以直接量它的 bezier |
| 10 | https://github.com/simeydotme/hover-tilt （文件 hover-tilt.simey.me） | **Web Component**：傾斜＋眩光 | **MPL-2.0**（可整合進閉源） | Web Component ＋ CSS | 2 | ⚠ 引第三方庫 | 備案。如果哪天要把箔面效果套到卡片以外的東西（例如背包縮圖），這是授權最乾淨、又不綁框架的現成件 |

### 沒有找到的東西（誠實記錄）

- **「卡包／封筒撕開」的開源 shader**：搜不到現成可用的。找到的 pack-opening 專案（`trungLyDal/pokemon-card-game`、`AlexsanderRST/YGO-Booster-Packs`、`rjoken/boosterboxer`、`bryanseah234/pokemonpacks`）都是**遊戲邏輯 ＋ 簡單 CSS 動畫**，沒有一個是撕紙 shader。撕封這件事目前只能自己做（`DESIGN-deluxe-gacha-fullscreen.md` 已經有「撕封、落印、揭卡」的節拍設計，方向是對的）。
- **X 上 @everettfish0408 的原貼**：打不開（402），內容只能從 itshan 的引用轉述。

---

## 四、Blender 路線評估

### 可行流程

有現成的 MIT 專案可以直接跑：**`EverettFish/holo-card-studio`**（見 1-3）。
它的 `scripts/ensure_blender.py` 會自己下載官方免安裝 Blender，所以**不需要在機器上裝 Blender**——
這對我們是關鍵，因為使用者的環境不用被動一根手指。

如果只是要「卡片旋轉揭曉」的透明影片，流程可以縮成五步：

1. **輸入四層 PNG**（背景／主體／線稿／文字），全部同尺寸同對位。我們已經有 `layer-*-background.png` / `layer-*-subject.png`，缺線稿與文字層——但文字層可以用它的 `generate_typography.py` 產。
2. **建場景**：`build_card.py` 產可編輯 `.blend`。材質照它的規格（bands scale 0.55、distortion 7、mapping Y 32°、粉黃藍白 ramp、Overlay；line emission 40 但稀疏遮罩；Voronoi 星芒）。
3. **相機動畫**：卡從 Y 軸 −90° 轉到 0°，30–45 幀。**光源固定、卡轉**——這樣光譜相位才會隨視角變（這是兩個來源都強調的鐵則）。
4. **輸出**：Cycles 或 EEVEE Next，`Film > Transparent` 開啟，輸出 **PNG 序列（RGBA）**，1080×1512（3:2 直式的 2 倍）或 720×1008。
5. **轉檔**：序列幀 → 透明 WebM（VP9 with alpha）：
   ```
   ffmpeg -framerate 30 -i frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 out.webm
   ```

### 檔案大小預估

以 720×1008、30 fps、1.2 秒（36 幀）的單張卡旋轉：

| 格式 | 預估大小 | 備註 |
|---|---|---|
| PNG 序列（未壓） | 15–25 MB | 只當中間產物 |
| **VP9 透明 WebM**（crf 32） | **250–500 KB** | ✅ 首選。Chrome/Edge/Firefox 全支援 alpha；Safari 17+ 才行 |
| HEVC-alpha MP4 | 200–400 KB | Safari 專用，要雙檔 |
| APNG | 3–8 MB | ⚠ 大 10 倍，而且我們筆記裡已經記過「GIF/APNG 不能做像素級判讀」的坑 |
| 序列幀 sprite sheet（WebP） | 800 KB–2 MB | 可用 CSS `steps()` 播，控制最精準，但貼圖尺寸會爆（36 幀 × 720×1008 需要拆多張） |

**重點警告**：我們現在 `deluxe-gacha-b-standalone.html` 已經 **4.7 MB**（內嵌全部素材）。
一張卡一支 WebM，卡池 15 張就是 4–7 MB，standalone 檔會直接翻倍。
所以**不要每張卡都做影片**——見下面的建議。

### 跟 CSS 卡面怎麼銜接

這是整條路線唯一真正的技術風險：**影片播完接回 CSS 卡的那一幀，如果對不上，會看到「跳一下」。**

可行的交接法：

1. **末幀對齊**：Blender 的最後一幀必須是「卡正面、零旋轉、光譜相位 = 我們 CSS 卡在 `--phase: 0` 時的相位」。這要靠人工比對截圖調 mapping 的初始角度，不能靠算。
2. **雙層疊放，交叉淡出**：影片 `<video>` 與 CSS 卡同位置疊在一起，CSS 卡先 `opacity: 0`。影片播到剩最後 3 幀時，CSS 卡淡入、影片淡出，跨 100ms。**只要末幀夠接近，交叉淡出可以吃掉剩下的誤差**——這比追求像素級精準務實得多。
3. **影片播放期間不可互動**，淡出完成才接上 pointer 事件。中間如果使用者點擊要能跳過（直接切到 CSS 卡）——這條 `DESIGN-deluxe-gacha-fullscreen.md` 第 5.4 節已經有「跳過」的設計，可以沿用。
4. **降級**：`<video>` 載入失敗或 `prefers-reduced-motion` 時，直接顯示 CSS 卡＋一次快速的 `--phase` 掃光。

### 現成的 Blender 鐳射材質檔／教學

| 來源 | 是什麼 | 授權／價格 |
|---|---|---|
| https://github.com/EverettFish/holo-card-studio | **完整可跑的 pipeline ＋ 材質規格寫在 SKILL.md** | **MIT，免費** |
| https://www.youtube.com/watch?v=xoJlYEsTn2o | 「BEST Holographic Card Material. Blender」影片教學（Blender 3.5） | 免費觀看，節點自己重建 |
| https://www.youtube.com/watch?v=6hiMUtcMdZM | 「Holographic Card Shader Graph : Blender + Unity 2021」 | 免費觀看 |
| https://vexastrae.gumroad.com/l/hologrphx | HOLOGRPHX：模擬薄膜干涉的 Blender shader，有藝術家友善的參數 | **付費**（Gumroad，價格以官方頁為準，我沒有下單所以不寫數字） |
| https://neoyume.gumroad.com/l/holographic_shader_pack | 30 組 holographic shader preset | **付費** |
| https://phcgm.gumroad.com/l/pckld | Iridescent and Dispersive Shader for Blender | **付費** |
| https://blenderartists.org/t/how-to-make-material-that-looks-like-it-is-hologram-foil-printing-effect/1100302 | 論壇討論串，有人貼節點圖 | 論壇內容，非正式授權 |

**判斷**：付費 shader pack 不必買。`holo-card-studio` 已經把材質參數用文字寫死了（scale 0.55 / distortion 7 / 32° / 粉黃藍白 ramp），照著在 Blender 裡搭三十分鐘就有，而且是 MIT。

### 這條路線值不值得

**值得，但只值得做一件事：mythic 的揭曉。**

- 成本：一張卡的完整流程（四層圖對位 → Blender → 渲染 → 轉檔 → 末幀對齊）我估 **半天到一天**，之後每張卡約 1–2 小時（大部分時間在末幀對齊）。
- 收益遞減很快：common 卡沒有人會看第二次，做影片是浪費。
- 風險：末幀對不上就會很醜，而且**這個醜是使用者一眼就看得到的那種**。
- 替代方案：把 Blender 產的**單張高解析箔面貼圖**（不是影片）拿回來當 CSS 卡的 `foil-spectrum` 底圖。這樣成本只有一次，沒有交接問題，材質品質卻能拉高一階。**如果只做一件事，做這個。**

---

## 五、給下一步的三個建議（依優先序）

### 1️⃣ 先把「閃光由角速度驅動」改進現有的 CSS 卡面 — 零依賴、零風險、直接解掉使用者的抱怨

使用者說「舊版本抽到的光芒比較好」，而 Ziggy Card 那篇給了物理解釋：**好看的箔面是被「動作」點亮的，不是被「時間」點亮的**（`foil += spark * uSpark * (0.7 + uMotion * 0.9)`）。現在的揭曉多半是一條跑固定時間的 loop，所以看起來像螢幕保護程式而不像有人把卡翻過來——把 `--motion` 做成 `--phase` 的每幀差分，卡不動就不閃、一甩就爆亮，這一改不引任何庫、不動凍結的卡面工法，卻可能是投報率最高的一刀。

### 2️⃣ 用 `holo-card-studio`（MIT）的材質數值當起點，跑一次 Blender 產「單張高解析箔面貼圖」，不做影片

這是唯一授權乾淨、又有明確數值可照抄的來源（bands scale 0.55／distortion 7／mapping Y 32°／粉黃藍白 ramp／Voronoi 星芒），而且它自帶 Blender 下載腳本，不用動使用者的環境；**先只取貼圖不取影片**，可以完全避開「影片末幀跟 CSS 卡對不上」這個唯一的高風險項，同時把材質品質拉上去。等貼圖驗證有效，再決定要不要為 mythic 一階做影片。

### 3️⃣ 把「稀有度光柱」補回去，技法照 Codrops 的體積光教學（MIT），但用 CSS 重寫

使用者懷念的「舊版光芒」大機率就是一根從卡底衝上來的光柱，這是所有日系抽卡（FGO 召喚陣、原神色光、賽馬娘封筒）共用的稀有度預告語彙，而我們現在缺這一拍；Codrops 那篇是 MIT 且把光柱的衰減與噪聲分層講清楚了，即使我們不引 three.js，把它的「錐體 ＋ 沿高度衰減 ＋ 疊一層緩慢 noise」三段結構用 CSS 的 `conic-gradient` ＋ `mask-image` 線性衰減重寫，也能拿到八成的效果、零依賴。**順序放第三是因為它需要新的視覺設計決策**（光柱的顏色要用卡的 `art/palette.json` 還是稀有度固定色），比前兩項多一輪來回。

---

## 附：本次未能查證的項目

- @everettfish0408 的原始貼文：X 對未登入請求回 402，**打不開**。內容僅從 @itshanrw 的引用轉述（引用文字我實際讀到）。
- `holo-card-studio` 我只讀了 README、SKILL.md 與 LICENSE，**沒有實際 clone 或執行**，所以「半天到一天」的工時是估的，不是量的。
- `catptype/Blue-Archive-Gacha-Simulator-V2` 的線上 Demo 我沒開（README 自述資料庫效期到 2025-11-19，很可能已死），「Prismatic Burst」的描述來自它的 README 原文，**我沒有親眼看到那個動畫**。
- `magiccreator-ai/awesome-gpt-6-astra` 的授權：README 沒寫，我沒去開 LICENSE 檔。
- Gumroad 上三個付費 Blender shader 的價格：我沒進結帳頁，所以本文不寫數字。
