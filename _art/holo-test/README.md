# 箔光實驗室 · 第一輪展示

直接用瀏覽器開啟 [demo.html](demo.html)，網址應是 `file:///…/_art/holo-test/demo.html`。不用啟動伺服器、不用安裝套件、不用建置。

**請保留目前資料夾位置。** CSS、JS、遮罩資料都內嵌在單一 HTML；場景分層和紋理仍引用本資料夾的 PNG，舊角色圖片引用 `../../src/card-*.png`。只單獨寄出 HTML，會缺少這些圖片。

## 怎麼玩

- 在卡片上移動滑鼠，或按住拖曳。A 區左右卡共用同一輸入；其他區每次只有一張接收連續輸入。
- 四個滑桿控制**所有新版卡**，數值即時顯示。初值：景深 **100%**、箔面 **85%**、顆粒 **75%**、光斑 **45%**。
- 想固定角度比較：先勾「鎖定目前角度」，再把卡轉到喜歡的方向，移到滑桿調整。取消鎖定會回正。
- 「只看景深」關閉箔面、亮粒和光斑；「只看箔面」讓所有前景／背景 Z 層距歸零，保留整卡轉向以查看反射。
- 每張下方都有翻面鍵；側欄翻面鍵操作目前選取的卡。A 區兩面同步翻轉。
- Tab 移到卡片後，用方向鍵轉動、Enter／空白鍵翻面、Esc 回正。
- 「模擬 reduced-motion」或系統的減少動態設定，會停止跟隨和翻轉動畫，保留靜態箔紋、稀有度和 15% 的淺層景深。
- 手機可收合頂部「材質調校」；卡片支援觸控拖曳，卡片外仍可捲動，五階區可橫向捲動。

## 每區在看什麼

| 區塊 | 本輪內容 |
|---|---|
| A 前後對照 | 同一張史詩珍彼特，卡片外尺寸相同、共享角度。左側使用本專案 `gacha-card.css` 的 `skin-af` 樣式快照，放在 Shadow DOM 隔離；右側是新實作。 |
| B 新場景 | 火箭狗、太空人狗、粉紅外星貓、白色捲毛狗。各一張主體 RGBA＋補背景，卡框與名牌再用 DOM 分開。 |
| C 五階並排 | 同一珍汪，依序 common 細緞面、rare 拉絲柱光、epic 交叉光柵、legendary 壓花金箔、mythic 區域虹箔。比較框型、紋路、亮粒及反射，不只比較色相。 |
| D 舊卡升級 | 珍彼特、珍汪、珍的是草、珍珍JPG、滅世珍獸、玩物就玩物，共六張。直接引用原圖，不另存角色 RGB 副本。 |
| E 材質調校 | 四滑桿、三種組合、固定角度、翻面、重設、減少動態，以及實際控制器的 rAF／INPUT 診斷。 |

A 左卡是**既有卡面外觀的展示快照**，不是在這個頁面啟動整個遊戲：原本 150×210 等比放大、移除宿主定位／入場／卡外光暈，改由本展示的共同輸入控制器驅動。沒有宣稱複製抽卡揭曉、呼吸或養成流程。來源雜湊與調整列於 [baseline-manifest.json](baseline-manifest.json)。

## 這版做到什麼

- 實作設計方案 B：`card-lift → card-inner → card-face` 保留 3D，背景、前景、框、名牌各有實際 `translateZ`。裁切、遮罩、混色放在單一葉平面，不放在承載景深的祖先。
- 自行實作角度驅動的多層 CSS 材質：主光譜、反向明暗帶、固定壓紋、細粒、兩個方向樣本的亮粒插值，以及寬光斑／小亮心。沒有按時間輪播彩虹、沒有閒置循環動畫。
- 角色使用與原圖相同 contain／cover／fill 對位的 alpha 遮罩，名字與稀有度保持不透明 DOM 文字，不參與箔材混色。
- 舊去背 PNG 與 CSS 背景分開；四張不透明新場景做了離線主體分割與補底。新增場景和舊 PNG 可共用控制器及稀有度參數。
- 一個有限的 rAF 排程器，角度、紋理相位、亮粒權重共享平滑狀態。游標停止時收斂即停；離開時有限回正，接著 rAF 為 0。失焦、隱藏、捲動、resize、取消拖曳會清除當前互動。
- Chromium 的本機 CSS mask 會受 CORS 限制，因此 atlas、框 mask、角色的 **alpha-only** mask 已在產製時轉成 data URL，內嵌於 HTML。沒有執行期 fetch、XHR、ES module import、外部 JS／CSS／字型或 CDN。

## 還差什麼

- **視覺品質仍待使用者驗收。** 本輪提供可調樣品，沒有把功能檢查當作品質對標通過。
- 四張場景採人工輪廓導引、OpenCV GrabCut 分割、Telea 局部補底。遮住的部分是周邊像素推補，**不是重建原本看不到的場景**。大角度／高景深時可能看到暈邊、拉抹或接縫，還需要逐張美術修整。
- 太空人的繫繩、玻璃頭盔與地球没有各自獨立分層；外星貓與土星也沒有接觸變形。這是主體／背景的兩層視差，不是完整場景模型。
- **滅世珍獸尚未拆出角色。** 其不透明 PNG 整幅作前景，只有画片相對框／底的景深；城市與角色不會互相移動。玩物就玩物沿用既有透明 alpha，手和角色同一層。
- 白色角色的箔色刻意保守；細緻材質、光澤強弱、五階差異仍需依使用者回報的滑桿值調校。尚未加入設計文件中的局部色散亮邊。
- Glitter 只有四方向樣本插值，不是連續微法線 shader；沒有 PBR 光源、實體卡邊、鏡面環境反射或失焦景深。
- 驗證範圍是本機 Playwright Chromium 和其行動／觸控模擬；尚未測實體手機、Safari、Firefox、Tauri WebView2、低階 GPU，也沒有做 GPU paint profile 或宣稱 FPS 數字。
- 此版是独立展示，還沒有接進遊戲、卡冊、存檔、抽卡狀態與揭曉流程；只展示六張既有卡，未逐張驗證全部 40 張。

## 素材與可重現產製

固定 seed：**20260908**。無生成式 AI、無第三方箔面貼圖；沒有搬用 Pokémon Cards CSS 的 CSS／JS／貼圖，也未採用 Galaxy Holo／Vecteezy。

| 檔案 | 尺寸／方式 |
|---|---|
| `texture-fiber.png` | 512×512 RGBA，中性灰細粒，固定亂數，可平鋪 |
| `texture-glitter-atlas.png` | 1024×1024 RGBA；四格各 512×512，共用粒子位置和法線，依四個方向的 `max(dot(n,h),0)^32` 輸出 alpha |
| `texture-engraving.png` | 512×512 RGBA，週期交叉曲線，固定幾何壓紋 |
| `frame-mask.svg` | 600×840 viewBox，自製雙層圓角幾何，無文字 |
| `layer-*-subject.png` | 四張 600×840 RGBA，原場景主體＋分割 alpha |
| `layer-*-background.png` | 四張 600×840 RGB，局部補底 |
| HTML 的 `mask-data` | 角度 atlas、框，以及由原 PNG 提取的純白 RGB＋alpha；供本機 CSS mask 使用 |

原始 `scene-*.png`、`_contact.png` 與 `src/card-*.png` 都只讀。生成記錄見 [asset-manifest.json](asset-manifest.json)。不同 Pillow／OpenCV 版本未保證輸出位元完全相同；本次使用版本記在 manifest。

重產素材才需要 Python、Pillow、numpy、OpenCV；看展示不需要。從專案根目錄執行：

```powershell
python _art/holo-test/generate_assets.py
python _art/holo-test/embed_masks.py
```

要重新取得本專案目前的左卡 CSS 快照，執行 `python _art/holo-test/snapshot_baseline.py`。這些腳本只寫本資料夾的產出。

## 實際瀏覽器檢查

測試腳本：[check_demo.py](check_demo.py)。原生 Playwright pointer／keyboard／`locator.click()` 操作，使用未關閉安全機制的正常 `file://`；沒有以 DOM `el.click()` 代替使用者點擊。

```powershell
python _art/holo-test/check_demo.py
```

機器可讀结果與瀏覽器版本：[verification.json](verification.json)。截圖在 [shots/](shots/)。紀錄包含四區繪製、四滑桿高低端即時更新、四場景拖曳、五階僅一張連續更新、翻面、鍵盤、系統／模擬 reduced-motion、390px 行動版、觸控拖曳、Console／外部請求及游標離開後 rAF 歸零。另在測試端包裝原生 rAF 計數，交叉確認沒有未結束的排程。

最適合先看的截圖：[前後對照](shots/02-comparison-tilted.png)、[四張場景](shots/10-section-scenes.png)、[五階並排](shots/10-section-rarities.png)、[舊卡](shots/10-section-legacy.png)、[卡背](shots/06-card-back.png)。實際動態請直接開 HTML；單張截圖無法交代角度變化。
