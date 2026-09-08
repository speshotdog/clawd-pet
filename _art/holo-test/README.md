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
