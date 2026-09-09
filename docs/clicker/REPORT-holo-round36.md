# 第三十六輪：魔花少女的字色、卡框與懸浮粒子

本輪完成 A → B → C → D，僅修改單張禮物卡的 builder、checker、生成 HTML，以及本輪報告／證據。最終建置 exit 0；最終驗收連續五次 exit 0，每次均包含原地 dev 與搬移後的單一 HTML。未 commit、未 push。

## 〇、必讀與量測條件

動手前已讀第三十五輪報告（包括 D 節與兩份火箭珍的對照表）、builder 檔頭及特殊階級註解、HANDOFF 六之四、LESSONS 第三節第 4 條與第六節第 2 條。保留淡底反光工法、透明莓紫 scrim、字級、幾何與既有 Z；未修改共用 CSS、card_face.js、卡池、抽卡頁、MTK 實驗、第三十四／三十五輪產物。

量測 viewport 900×1000、DPR 2、卡寬 380 CSS px。亮度比較固定角色／剪影 WebP 的第 0 格，並停用舞台背景漂移；粒子仍用原生 CSS 時鐘、原生等待 2 秒。這是為了不把既有角色動畫算成粒子。原有疊化驗收則重新載入未凍結的完整 HTML，角色、遮罩、反光與粒子都正常運作。

最終 renderer 為 ANGLE／NVIDIA RTX 3080 Ti／D3D11。預設 headless 實測是 SwiftShader 軟體渲染，曾只記到 57 格、入場中間值 2 格而失敗；保留原始失敗曲線。checker 明確使用 `--use-angle=d3d11`，沒有改變 320ms 過渡、DPR、字級或門檻。三次獨立硬體 renderer 探測先錄得 255～258 格並通過，之後才跑完整五次驗收。這份結論是本機硬體實測，不聲稱 SwiftShader 的卡頓已被頁面修好。

第一次真實改前截圖採預設軟體 renderer，保存在 `software-before-*`。切換 GPU 後，用已存的原始 builder 還原舊 gift-stage 樣式、移除新增粒子區塊，生成本輪的 `baseline-gift.html`，重跑同樣的改前斷言與截圖。GPU 改前／改後共用同一張保存的卡框遮罩，沒有拿兩種 renderer 混算百分比。原始樣式快照為 `before-builder.txt`；五份原有素材的 SHA-256 與第三十五輪紀錄完全一致，見 [asset-identity.json](shots/round36/asset-identity.json)。

## 〇之二、逐項保留基準

| 項目 | 簡報基準 | 同機 GPU 改前 | 最終 dev／搬移版 | 結果 |
|---|---:|---:|---:|---|
| 卡名 WCAG 亮度對比 | 6.44:1 | 5.73:1 | 6.46:1 | 達到更嚴基準 |
| 寶石對比 | 145.67 | 145.67 | 145.67 | 不變 |
| 卡名置中偏差 px | 0.0081 | 0.008118 | 0.008118 | 不變 |
| 稀有度置中偏差 px | 0.0081 | 0.008133 | 0.008133 | 不變 |
| name／rarity／gem 字級 px | 31.45／17.69／28.83 | 31.45／17.69／28.83 | 31.45／17.69／28.83 | 不變 |
| 最大文字／寶石投影超緣 px | −7.72 | −7.721130 | −7.721130 | 不變，仍在卡內 |
| 文字框左／右 % | 4.3997／4.3997 | 4.399684／4.399789 | 4.399684／4.399789 | 不變 |
| 文字框底／高 % | 3.3981／16.1977 | 3.398139／16.197726 | 3.398139／16.197726 | 不變 |

簡報的 6.44 與上一輪成品並不一致：第三十五輪報告實際寫了 5.94，本輪未改前的 SwiftShader 也量到 5.94；GPU 則量到 5.73。本輪沒有把門檻降成這些改前實測值，而是提升卡名漸層亮度，最終達到 6.46。幾何保留斷言除既有門檻外，亦逐项對照保存的改前數值，容差僅 0.0001。

## A、稀有度同色系漸層

稀有度採與卡名完全相同的粉藍亮色 stops、`linear-gradient(var(--phase), …)`、`background-clip:text` 與透明填色。小字只加一道貼字形的 `drop-shadow(0 1px 0 #21102c)`，`text-shadow` 明確關閉。卡名字級與稀有度字級均未變動。

| 斷言／門檻 | dev／搬移版实測 |
|---|---|
| 填色必須透明 | `rgba(0, 0, 0, 0)` |
| 必須 linear-gradient | 兩行均成立 |
| text-shadow 必須 none | `none` |
| 兩行角度一起隨 phase | 正常 120deg → 指標傾斜 190deg |
| 中文「特殊」對比 ≥4.5 | 10.33:1 |
| 英文「SPECIAL」對比 ≥4.5 | 10.57:1 |
| 取兩段最低作結果 | **10.33:1** |
| 置中偏差 <2px | 0.008133px |

對比仍使用原 `text_contrast()` 的最亮 25%／最暗 35% 亮度百分位法；只新增可選的 Range 子字串取樣，使中文、英文分別量測。沒有改公式、字級或放寬門檻。

## B、卡框提亮而保留層次

先保存「卡片矩形往內 3.5%」的環狀帶，遮罩不含圖窗中央。卡片 380×532，內矩形 x13.3／y18.62／w353.4／h494.76 CSS px。DPR 2 的像素遮罩、像素數與矩形定義見 [baseline-dev.json](shots/round36/baseline-dev.json) 及 [frame-ring-dev.png](shots/round36/frame-ring-dev.png)；搬移入口有獨立同形證據。每次驗收先斷言新計算的遮罩與保存的遮罩完全相等。

最終只給 `.face-frame` 加固定 `filter:brightness(1.6)`，五道原始 inset 描邊及 conic 保留。這是固定框樣式，沒有動畫 filter，也沒有改 `--foil-gain=1`、`--grain-gain=1.3`、`--subject-gain=.4`。

| 量測 | GPU 改前 | 改後 | 變化／門檻 |
| 卡框平均灰階 | 149.180157 | 176.908446 | +18.587117%；+12%～+30% |
| 卡框灰階標準差 | 61.670021 | 72.845376 | +18.121211%；至少保留 95% |
| 整卡平均灰階 | 180.302474 | 184.016131 | +2.059682%；增幅 ≤5% |
| 圖窗中央角色區平均灰階 | 206.137956 | 206.137956 | +0.000000%；增幅 ≤2% |

框外的文字／寶石另守卡名 ≥6.44、寶石 ≥145；本輪還要求寶石不得低於 145.67，兩入口均為 6.46／145.67。

曾先測直接提亮暗槽：即使平均亮度達 +12.96%，標準差僅剩 80.85%，因此否決。固定 brightness(1.6) 的先期軟體 renderer 探測為 +18.62%、標準差保留 118.09%，方向可行，最終以上表的同 renderer 完整驗收為準。也量過把倍率直接烘入色階：倍率 1.6 約 +12.36%、標準差保留 109.64%；未採用，避免把 conic 多個粉藍色階裁成純白。試驗數據見 `AB-probe.json`、`B-brightness-probe.json`、`B-baked-probe.json`。

## C、看第二眼才注意到的花粉

20 顆，實測直徑約 3.1875～6px（380px 卡寬的 0.84%～1.58%），週期 8～18 秒，各自錯開延遲（0 至 −17.3 秒）。白色核心、粉 `#ffd4ec`／藍 `#cfeeff`／白三色柔邊；由下往上輕微左右飄動，頭尾淡入淡出。沒有新增圖片、第三方庫或常駐 JavaScript 動畫迴圈。

先在同一暫停時刻比較混合模式：screen 的粒子開／關差圖峰值 81.735 灰階、>6 灰階像素 881；normal 為 75.995、809。整卡增亮分別僅 0.014888%／0.013057%。保留 screen，靠白色核心與柔邊避免淡底不可見。原建議的數量、大小、週期及混合模式均未否決，見 [blend-probe.json](shots/round36/blend-probe.json) 與 `blend-screen.png`／`blend-normal.png`。

粒子容器在既有 `.art-media` 內，local Z=0、隨既有角色平面 Z=36.4px，z-index=5 < 文字框 20。下緣在文字框之前收掉，`overflow:hidden` 與 12px 圓角裁切；沒有把任何既有層推高。

下表為五次完整驗收、十個入口的實測範圍：

| 條件 | 實測 | 門檻 |
|---|---|---|
| 圖窗間隔 2 秒的差異像素 | 0.2490～0.2755% | ≥0.15%，灰階差 >6 |
| 文字框差異像素 | 0.0000～0.0000% | ≤0.02% |
| 粒子開／關峰值增亮 | 103.8370～139.3860 灰階 | ≥8 |
| 粒子相對鄰近背景的峰值 | 77.5170～104.2255 灰階 | ≥8 |
| 粒子導致整卡平均增亮 | 0.0153～0.0200% | ≤2% |
| 靜置 3 秒的 rAF 次數 | 0.0000～0.0000 | 0 |
| reduced-motion 間隔截圖差異 | 0.0000～0.0000% | ≤0.02% |
| 傾斜時粒子容器超緣 | -3.1185～-3.1185px | ≤1.5px |
| 正常時粒子容器超緣 | −9.004578px | ≤1.5px |
| 粒子 Z | local 0；所屬平面 36.4px | ≤42px |
| z-index | 5 | <20 |
| keyframes 宣告 | 每格只有 transform／opacity | 不得動畫 layout／paint 屬性 |
| reduced-motion 動畫名稱 | 20 顆全部 none | 停止動畫 |
| elementFromPoint | face-name／face-rarity | 文字仍在最上層 |
| 卡名／寶石／稀有度最低對比 | 6.46／145.67／10.33 | ≥6.44／145／4.5 |

反向可見性不是只讀 CSS：先暫停粒子於同一時刻，截開啟／隱藏粒子層的兩張圖；差圖定位粒子，再量該粒子像素相對 2～8 CSS px 鄰域背景中位數的亮度差。動態測試的圖窗遮罩排除文字框，文字框則用完整 rect 獨立驗零差。rAF 計數時粒子已恢復播放，計數器不含 checker 後續自行啟動的曲線取樣 rAF。

## D、逐格驗疊化與五次完整驗收

`assert_crossfade()` 的「每方向、每組 ≥3 筆中間值」改從既有 `frames` 選取；60ms `samples` 仍保留作歷史曲線與終點紀錄。每格不得雙空、不得雙滿、互補和誤差 <0.025 三條完全保留，過渡時間仍為 320ms。

| 次數 | exit code | dev：入場／返回各組最低中間格數 | 搬移版：入場／返回各組最低中間格數 | 日誌 |
|---|---:|---|---|---|
| 1 | 0 | 12／12 | 12／12 | [final-1.log](shots/round36/final-1.log) |
| 2 | 0 | 12／12 | 12／12 | [final-2.log](shots/round36/final-2.log) |
| 3 | 0 | 12／12 | 12／12 | [final-3.log](shots/round36/final-3.log) |
| 4 | 0 | 12／12 | 12／12 | [final-4.log](shots/round36/final-4.log) |
| 5 | 0 | 12／12 | 12／12 | [final-5.log](shots/round36/final-5.log) |

十個入口每條曲線錄得 246～256 格，最大互補和誤差 0.00000250，雙空／雙滿均為 0。各入口錯誤與外部 HTTP 請求皆為空陣列；原有兩份火箭珍幾何／Z／字級比例、剪影對齊、實際點擊切換與指標像素回應驗收亦通過。見 [crossfade-summary.json](shots/round36/crossfade-summary.json)。

## 紅燈、真實退出碼與交付

| 實際執行 | exit | 說明／證據 |
|---|---:|---|
| 第一版 checker harness | 1 | rAF 還原語句回傳函式而被 Playwright 再呼叫；改成不回傳函式的區塊，見 before-check.log |
| 真實未改卡，新 A／B／C 斷言 | 1 | 稀有度沒有漸層、卡框增亮 0%、粒子動態／可見性 0，兩入口均紅；software-before-check-corrected.log |
| 首次建置 | 0 | build-first.log |
| 首次 A／B／C 驗收 | 0 | 兩入口，check-first.log |
| 首次完整驗收（SwiftShader） | 1 | per-frame 仍只取得入場 2 格，full-first.log 與 full-first-dev-curve.json；沒有刪除失敗 |
| 完整 Chromium channel 探測 | 啟動失敗 | 系統回報 spawn UNKNOWN；probe-renderer.log，不算通過 |
| D3D11 探測 | 0 | 三條原生曲線通過，probe-renderer-angle.log |
| GPU 改前重建首次呼叫 | 1 | 快照路徑未建立，before-gpu.log；修正快照建立步驟後重跑 |
| GPU 改前重跑 | 1 | 兩入口 A／B／C 新斷言如預期為紅，before-gpu-corrected.log |
| 最終建置 | 0 | build-final.log |
| 最終完整驗收 1～5 | 0／0／0／0／0 | 上表五個獨立日誌／exit sidecar |

最終指令（worktree 根目錄，PowerShell）：

```powershell
python _art/holo-test/build_gift_card.py
$env:PYTHONIOENCODING='utf-8'
python _art/holo-test/check_gift_card.py --tag final-1
# 同一成品與 checker，依序重跑 final-2、final-3、final-4、final-5
```

checker 將單一 HTML 複製到 `docs/clicker/shots/round36/` 之下的暫存子資料夾，以 file:// 開啟並完整驗收，之後只清掉自己的暫存複本。所有本輪產物都在此 worktree；既有外部素材／桌面火箭珍參考只有讀取。

交付：[gift-mohuashaonv.html](../../_art/holo-test/gift-mohuashaonv.html)、[builder](../../_art/holo-test/build_gift_card.py)、[checker](../../_art/holo-test/check_gift_card.py)。修改前後的文字差異另存 `builder.diff`／`checker.diff`。

已檢視常態、傾斜、粒子差圖與卡框遮罩；文字保持清楚、沒有黑條回歸，粒子差圖只在圖窗留下細點。必要截圖如下（每次、每入口另有完整同名系列）：

- [常態](shots/round36/final-1-dev-particles-held.png)
- [傾斜](shots/round36/final-1-dev-tilt.png)
- [粒子第一張](shots/round36/final-1-dev-particles-0.png)、[兩秒後](shots/round36/final-1-dev-particles-2.png)、[差圖，顯示增益 ×8](shots/round36/final-1-dev-particles-diff.png)
- [卡框環遮罩](shots/round36/frame-ring-dev.png)
- [reduced-motion 第一張](shots/round36/final-1-dev-reduced-motion-0.png)、[兩秒後](shots/round36/final-1-dev-reduced-motion-2.png)

未 commit、未 push；未處理 ISSUES 其餘項目或另一路 depth 設計。
