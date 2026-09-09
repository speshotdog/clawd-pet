# Round 31：召喚陣背景研究

2026-09-09。先讀 `RESEARCH-gacha-ui-resources.md`，以下三個 repository 不在舊清單中。本輪實際用 web 工具打開 repository 及 LICENSE 路徑；stars 是頁面當次顯示值（可能有快取），沒有安裝、下載素材或複製其程式碼。

| 來源 | Stars | 實際授權查證 | 技術與可取觀念 |
|---|---:|---|---|
| [btmills/geopattern](https://github.com/btmills/geopattern) | 1.8k（頁面四捨五入） | [LICENSE 原文](https://raw.githubusercontent.com/btmills/geopattern/master/LICENSE) 已開啟。MIT；Copyright (c) 2014 Jason Long, Brandon Mills。允許使用、修改、散布與商用，須保留著作權及許可聲明，並含無擔保條款。 | JavaScript 把輸入字串雜湊成種子，生成可平鋪 SVG。可參考「幾何參數 → SVG」與可重現的參數設計；本案不要滿版平鋪，以免干擾卡面。 |
| [msurguy/rad-lines](https://github.com/msurguy/rad-lines) | 177 | Repository 顯示 MIT，但 `blob/master/LICENSE`、raw 與 refs 路徑均打不開（Internal Error / Cache miss）。**未驗到 LICENSE 實際內容，因此不當作可複製來源。** | Vue/Vite 的向量線條工具，調整形狀及旋轉公式，輸出繪圖機可用 SVG。取「少量細線、空心形狀、旋轉對稱」概念。沒有執行或複製工具。 |
| [jessenbeaupre/Magic-Circle-Generator](https://github.com/jessenbeaupre/Magic-Circle-Generator) | 0 | Repository 顯示 MIT；實際點 LICENSE 以及 raw master/main 路徑均打不開（Cache miss）。**LICENSE 內容未驗證，不複製。** | Python 命令列程序生成魔法陣，可指定尺寸和 RGBA 背景。取「同心幾何可由參數構成、背景與筆畫分離」概念；沒有下載其輸出圖。 |

## 本案設計與實作選擇

視覺主張：近黑舞台，以稀疏白線同心圓和垂直軸形成召喚儀式，彩色與強光留給卡片。

內容維持既有入口／演出／結果與四角控制；不增加裝飾文字或第三方 UI。互動使用蓄力漸強、翻面爆光、放開拖曳後 280ms 阻尼回正。背景只有 28 秒的 CSS 呼吸，沒有常駐 rAF。

`_art/holo-test/ceremony-background.svg` 是本輪自行寫的 inline SVG 原始幾何：137／157／172px 同心圓、176px 對稱破環、點列環、菱形刻度、四芒星、上下垂直軸、四層透視橢圓與放射地線。viewBox 保持正方形比例；手機放大整張 SVG，使中央圓陣仍可讀，周邊地面延伸出畫面。builder 直接內嵌 SVG，沒有新增圖片請求、字型、npm 相依或 WebGL。

最終沒有引用任何第三方程式碼／SVG 路徑／圖片。MIT 來源也僅作方法參考；不需要搬入其授權檔。GPL／AGPL 不複製的 brief 規則照守，未把搜尋到但未查證的內容視為可用授權。背景 `.background-paused`、`.focus-held` 與 `prefers-reduced-motion` 保留。
