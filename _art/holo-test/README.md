# 箔光實驗室 · 第二輪展示

直接用 [demo.html](demo.html) 開啟即可，支援 `file://`，沒有 fetch、XHR 或 ES module import。

## 本輪變更

- 只調整 `rare`：把接近 90° 的單一直條，改成 116° 多段光譜、112° 多柱 relief、28°／-34° 交叉細紋；common、epic、legendary、mythic 未改。
- [compose_legacy.py](compose_legacy.py) 使用固定 seed `20260908`，把既有角色 alpha 與既有場景層合成 10 組 600×840 的 `layer-*-{subject,background}.png`。未使用 GrabCut，未改動 `src/`。
- D 區改成每張「原本去背卡框版／合成滿版景深版」並排比較。合成版仍由展示頁的前景、背景 Z 層控制。

## 場景配對

| 角色 | 場景 | 說明 |
|---|---:|---|
| 珍彼特 | 1 | 草地野餐，暖色角色放在開闊前景 |
| 珍汪 | 2 | 布幕舞台，藍色稀有度呼應冷色背景 |
| 珍的是草 | 3 | 標籤棚景，小體型角色留出天空層次 |
| 珍珍JPG | 4 | 戶外移動景，橙色角色在中景前 |
| 滅世珍獸 | 5 | 夜色燈景，bleed 滿版對照 |
| 玩物就玩物 | 6 | 冷色庭院，bleed 滿版對照 |
| 狐狸朋友 | 6 | 暖橙庭院，狐狸色調與夕光相配 |
| 米噗噗 | 1 | 草地花叢，粉色主體與綠地反差 |
| 火蜥蜴 | 2 | 布幕舞台，長形主體放在地面線上 |
| 羊舖 | 5 | 燈籠夜景，小角色保留環境空間 |

## 驗證與限制

用 [check_demo_round2.py](check_demo_round2.py) 以 Playwright 實際開啟本機 `file://` 頁面：30 張卡載入、10 組合成比較、rare 材質角度、合成卡互動景深、Console 無錯誤，以及游標離開後 `rAF = 0` 均已記錄於 [verification-round2.json](verification-round2.json)。截圖在 [shots/](shots/) 且以 `r2-` 開頭。

這些是本輪實作與操作證據，不代表視覺品質已達標；合成背景是既有場景層的初版拼接，仍待使用者驗收與逐張美術調整。`src/` 下原始素材保持只讀。

## 第三輪：銘牌、懸浮文字與場景邊緣

- 珍珍JPG 的格子梗保留原樣；本輪沒有改 `zhenjpg` 的角色 alpha 或合成 layer。
- 四張第一輪 GrabCut 場景卡改用固定 seed `20260908` 的衍生 layer：輪廓內縮 2px、窄環 NS inpaint 去背景色溢、0.8px 羽化。展示頁 `B·1 / 邊緣修復證據` 以同尺寸 BEFORE/AFTER 並排；第二輪 10 張合成卡不在這個處理範圍。
- 階級寶石移到卡面上方，銘牌加高並保留安全區；名字、稀有度與銘牌分別有可見的 Z 深度。`check_demo_round3.py` 會對所有卡量 `.face-gem` 與 `.face-name` 的矩形並斷言不相交，包含最長的「玩物就玩物」。

### 字體提案

展示頁右側 `字體方向` 可切換三個方向：

1. 正黑：中性、清楚，適合資訊密度高的卡面。
2. 襯線：以 Georgia 搭配系統中文襯線 fallback，偏收藏品／印刷卡牌。
3. 圓體：以 Microsoft JhengHei UI 搭配系統 fallback，讓角色卡更親和。

目前採用「系統字體三方向＋稀有度彩色墨色」的完整方案：稀有度改變名字與稀有度標的墨色、描邊與微光，並維持高對比，不讓箔面蓋掉資訊。沒有選擇把字做成金屬漸層，因為大角度時容易失去中文字的筆畫對比；也沒有做依卡面主色自動取色，因為同一套卡在深淺背景間會造成不穩定的可讀性。

硬限制與授權結論：本輪沒有把任何第三方字體檔打包進 HTML，三個方向都只使用作業系統既有字體，因此 `file://` 不需網路、不需 fetch，也沒有重新散布字體檔的授權問題。仍實際核對了 [SIL Open Font License 1.1 官方原文](https://openfontlicense.org/)：OFL 字體可用於網站並可修改／再散布，但若日後改採內嵌子集，必須隨專案保留授權與字體著作權聲明，並檢查 Reserved Font Name；本輪為降低跨機器 fallback 風險，選擇不內嵌。

### 驗證與待驗收

第三輪驗證會保留 `file://`、無外部 request、圖片完整載入、Console 無錯誤、文字／寶石矩形不相交、三個字體方向可切換，以及滑鼠角度造成文字與角色不同 transform 的檢查。截圖存於 `shots/` 且以 `r3-` 開頭。這些證據不代表視覺品質已達標，仍請逐張驗收暈邊、箔面強度與字體取向。

## 第五輪：寶石回到舊版邏輯、字效提案、單檔分享

舊版 `src/gacha-card.css` 的 `.face-gem` 是固定實心色、位於卡面上方；`.skin-af .face-gem` 依稀有度放大到 10/12/14/16px，並有明確描邊；`.r-common` 使用不透明灰色，`.r-mythic` 用高亮 conic-gradient。關鍵是尺寸夠大、實心亮面、描邊對比清楚、位置不被深色銘牌吃掉。第四輪的深色銘牌與暗部外圈使寶石變成模糊暗塊，五階又縮到 8px；本輪恢復大尺寸實心切面與亮色 keyline，五階保持 20–22px。

開源調查實際讀過 [Pokémon Cards CSS GPL-3.0 原文](https://raw.githubusercontent.com/simeydotme/pokemon-cards-css/acb1197633e749a1fba4412231db2f6581586d00/LICENSE) 與 [Holo Card Studio MIT 原文](https://raw.githubusercontent.com/EverettFish/holo-card-studio/b470957e0dea681eadc05e467a57bdc84b702333/LICENSE)。前者第 4–6 節有保留通知、同授權散布與 Corresponding Source 要求，本案只學原理；後者允許軟體複製修改但第 7 行排除生成 artwork。本輪沒有找到同時涵蓋寶石素材再散布權的可直接納入來源，故寶石為固定 seed 下自製 CSS 幾何，不硬稱為第三方設計。

common–epic 維持乾淨可讀；legendary/mythic 可切換遊戲金屬、像素疊描、浮雕燙金、斜體分層四種方向。名字 Z 位移提高到 18–23px，五階靠加寬銘牌與最小卡寬撐開；中文一律 DOM，像素方案用系統等寬 fallback。Noto 子集沿用前輪已核對的 SIL OFL 1.1 與 Reserved Font Name 注意事項。

`demo.html` 是開發版；`demo-standalone.html` 將素材依展示尺寸重採樣為 WebP（主體保留 alpha）並內嵌動態素材映射，實際 3,045,272 bytes（約 2.90 MiB），低於 15 MiB。`check_demo_round5.py` 已把 standalone 複製到暫存資料夾後以 `file://` 開啟，驗證圖片、無外部 request、Console、排版與離開後 rAF；結果在 `verification-round5.json`。仍待使用者視覺驗收，不宣稱品質已達標。
