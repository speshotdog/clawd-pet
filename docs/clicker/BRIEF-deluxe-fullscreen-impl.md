# 派工簡報：整頁式精裝抽卡——實作第一輪

日期：2026-09-08。分支 `holo-cards`，工作區 `D:\claude研究\clawd-pet-holo`。
**使用者等著用，這一輪要能玩。**

## 依據

你自己寫的 `docs/clicker/DESIGN-deluxe-gacha-fullscreen.md`。照它做，但有三條使用者裁決要覆蓋：

### 使用者裁決（原話）

> 十張同屏
> 沒有保底
> 其他照 Astra 建議

1. **十連結果要十張同屏**，不分頁。你在設計文件第 7 節第 3 點反對過，理由是可讀性；
   使用者知道了還是要同屏。**所以請把可讀性用別的方式解掉**，不要靠分頁：
   例如把舞台讓到最大、卡名／稀有度做成卡外的標籤、點任一張進入同頁大圖檢視、
   結果頁的卡可以比演出主卡小但標籤要夠大。做法你決定，但**十張要同時看得到**。
2. **精裝池沒有保底**——這是 HANDOFF 已定案的。目前原型 `build_deluxe_b.py` 裡那段
   「十連沒抽到傳說就塞一張」是我加錯的，**不要搬過來**。
3. 其他一律照你的設計文件，包含：稀有度用不同動詞（揭／扣／掃／壓／撕）、
   效果從接觸點長出來、每包只有一個完整高潮、高潮前的安靜區、
   聲音早 40–60ms 但撞擊對齊揭曉、WebAudio 合成不引音效檔。

## 要交付什麼

一支**可以直接玩**的原型，跟現有的走同一套建置方式：

1. `_art/holo-test/build_deluxe_full.py`——建置腳本，產出 `deluxe-gacha-full.html`。
   照 `build_deluxe_b.py` 的做法：
   - 從 `demo.html` 抽出 `<style>` 區塊（跳過 `<template id="baseline-css">`）當卡面 CSS
   - 從 `demo.html` 的 `#mask-data` 拿 foil mask
   - 從 `src/gacha-pool.js` 的 CATALOG 讀卡池（**名字不要手打、不要從檔名推**）
   - 卡圖用 **`_art/holo-test/art/`** 底下**已經去掉透明留白**的版本
     （`trim_card_art.py` 產的，附 `art/manifest.json`），這樣主體置中才準
   - 四張場景卡（rocketdog／alienkitty／astronaut／fluffdog）沿用 `layer-*-{subject,background}.png`
   - 卡背用 `cardback/deluxe-back.webp`
2. `_art/holo-test/deluxe-gacha-full.html`——建置產物，用瀏覽器開就能抽。
3. `docs/clicker/REPORT-deluxe-fullscreen-impl.md`——回報。

## 硬限制

- **`src/` 全部唯讀。** 這一輪不接進遊戲，只做 `_art/holo-test/` 底下的原型。
  音效要沿用 `gacha-audio.js` 的原理就把需要的部分**複製進原型**，不要改原檔。
- 卡面版型是已定案的，不要重新設計：階級寶石＋文字框＋名字＋稀有度，每張都要有；
  傳說亮金字 `#fff45c`、神話 conic 彩虹跟著 `--phase`；沒有背景的卡人物置中在
  「卡頂到文字框上緣」之間。細節看 HANDOFF 六之二／六之三。
- 機率是**試抽用的假數字**，畫面上要標明未定案（神話 .5%／傳說 4%／史詩 15%／
  精良 40%／普通 40.5%）。**不要保底。**
- 不要引入任何第三方素材、字型、音效檔。
- **不要 build 遊戲、不要起 server、不要 commit、不要 push。**
- 做完就停，我用 Playwright 驗收。

## 我會怎麼驗（先講，免得白做）

- 十連：十張同時在畫面上、每張的名字讀得到（實際 CSS 字級量測）
- 沒有任何一張是靠 hover 才看得清楚；點擊區 ≥ 44×44 CSS px
- 沒有逐卡白閃、沒有徑向光束
- 主體置中：卡圖的框心與圖窗中心偏差 ≤ 2px
- 抽 200 次統計稀有度分布，確認**沒有保底**、分布貼近設定值
- 靜音後 30ms 內沒有殘響；跳過之後沒有補播
- 無 console error、無 failed request、演出結束後 `getAnimations()` 不殘留
