# 精裝版卡背美術回報

- 成品：`_art/holo-test/cardback/deluxe-back.png`，1000×1400，直式 5:7。
- 使用內建 imagegen，共 **1 次 job**，沒有並行、沒有使用 CLI/API fallback。
- `src/gacha-cardback.jpg` 僅作為畫風參考，未修改。imagegen 只生成空獎章、深藍底、奶油雙框及四角爪印／骨頭／星星／愛心圖形；未讓模型生成角色。
- 四角為生成的插畫形狀，沒有使用 emoji、字型或第三方素材。成品無文字、寶石或金屬反光特效。

## 角色原樣合成與驗證

原始 `subject-hotdog.png` 為 571×574，但實際不是透明底：所有像素 alpha 都是 255，含 248,231 個純白像素。原始檔未修改。

合成腳本 `_art/holo-test/cardback/compose.ps1` 使用 System.Drawing，從圖片邊緣 flood fill，只把與外緣連通的 RGB(255,255,255) 純白背景設為透明，另存 `subject-cutout.png`。不修改任何保留像素，不重新描線、不換色、不重畫，也沒有縮放角色。

角色有效邊界為原圖座標 `(146,129)` 至 `(456,474)`；以偏移 `(199,398)` 逐像素複製至成品，讓角色可見邊界置中於畫布。原生大小保留，沒有插值。實際驗證輸出：

```text
Output=1000x1400; source=571x574; retained=79523; changed=0; composite_mismatch=0; bbox=146,129,456,474; offset=199,398
```

79,523 個保留像素與原始圖、最終合成位置逐一比較，差異均為 0。

## 底圖與安全區

保留 imagegen 原始底圖 `generated-background.png`（1060×1484，已為 5:7，不需裁方圖）。底圖等比例縮至 930×1302，置於 1000×1400 深藍畫布中央，讓主要外框約從 x=68、y=91 開始，避開四邊 6% 遮擋區。角色在底圖縮放完成後才直接複製。

已開啟最終 PNG 目視檢查：無文字，四角為統一粗黑輪廓的簡單插畫，角色完整置中，奶油獎章及對稱花紋清楚。外圍補色區位於預期可遮擋範圍。

## Imagegen prompt

```text
Create one premium deluxe playing-card BACKGROUND artwork, portrait 5:7, ideally 1000x1400. Reference image is STYLE ONLY. Match its charming flat cartoon illustration with thick near-black slightly handmade outlines, deep navy #26324f, warm cream #f4e7c4 and #f7edcf. Center: large perfectly EMPTY solid pale cream circular medallion centered exactly at image center, diameter about 70% of image width, bordered with thick black outline plus an elegant thin cream outer ring and restrained symmetrical ornamental arcs. DO NOT DRAW THE DOG or any central subject: this empty medallion will receive an existing PNG by deterministic compositing later. Premium compared to reference through carefully spaced double cream border lines, small symmetrical ornamental flourishes. Four corners inside safe area: hand-drawn simple paw upper left, bone upper right, star lower left, heart lower right, cohesive thick black strokes and restrained cream/pale muted pastel fills, friendly sticker shapes, not emoji or font glyphs. Keep all borders and important decoration at least 7% inset from image edges; navy background extends fully to all edges. Whole image is flat straight-on card artwork, no perspective, no scene or mockup. Absolutely no text, letters, numerals, logos, watermarks; no gemstones, diamonds, glow effects, foil effects, metallic gradients, photoreal shading. Keep design spacious and match reference's simple flat illustration style. Center medallion must remain entirely blank and plain cream.
```

僅新增允許的美術目錄檔案與本報告。未 build、未啟動 server、未 commit、未 push。
