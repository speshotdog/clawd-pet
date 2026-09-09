# 第三十七輪：魔花少女的愛心、傾斜回彈與卡緣厚度

已完成 A～D，所有門檻通過。加入最大四角驗收並修正愛心後，最終連續五次完整驗收 exit **0／0／0／0／0**（accepted-1～5，共十個入口）。未 commit、未 push。

## 〇、閱讀、範圍與量測方法

修改前依簡報讀完第三十六輪報告、builder 的特殊階級註解、HANDOFF 六之四，以及 DESIGN 第 8 節；另讀相關 LESSONS。依 A → B → C → D 實作，遇到不合格數值再修正，沒有放寬門檻。

只修改 build_gift_card.py、check_gift_card.py、生成的 gift-mohuashaonv.html，以及本輪報告與 shots/round37 證據。原二十顆圓點的 CSS、keyframes、建構程式碼逐字相同；內嵌共用 CSS 與 card_face.js 的 SHA-256 相同，所有原 gift 素材位元組亦相同。見 [scope-identity.json](shots/round37/scope-identity.json) 及兩份腳本差異：[builder](shots/round37/build_gift_card.py.diff)、[checker](shots/round37/check_gift_card.py.diff)。沒有修改卡池、抽卡頁、mtk-*、第三十四至三十六輪證據；沒有 commit、push。

採 viewport 900×1000、DPR 2、卡寬 380 CSS px、Chromium --use-angle=d3d11。像素比較沿用第三十六輪：固定原動畫素材第 0 格、停止舞台背景漂移；粒子兩秒差圖仍走原生 CSS 時鐘。原生角色疊化檢查重新載入完整 HTML，沒有用凍結素材替代。每次亦將單一 HTML 複製到本 worktree 的暫存子目錄重驗，不依賴原相對路徑。

改前頁完整保存在 [baseline-gift.html](shots/round37/baseline-gift.html)，同條件重測數值在 baseline-metrics-dev-round36.json／baseline-metrics-moved-copy-round36.json。沿用第三十六輪已保存的卡框環遮罩，並逐像素驗證遮罩相同。舊 JSON 的 gainsPercent 保留其歷史參照；下方表格重新以第三十六輪成品作分母。

## 〇之二、保留基準逐項對照

| 項目 | 第三十六輪簡報基準 | 改前頁同機重測 | 最終十個入口 | 門檻／結果 |
|---|---|---|---|---|
| 卡名 WCAG 對比 | 6.46 | 6.46 | 6.46 | ≥6.46 |
| 稀有度最低對比 | 10.33 | 10.33 | 中文 10.33；英文 10.57 | 同時守 ≥4.5 及不低於原 10.33 |
| 寶石對比 | 145.67 | 145.67 | 145.67 | ≥145.67 |
| 卡名置中偏差 px | 0.008118 | 0.008118 | 0.008118 | <2 |
| 稀有度置中偏差 px | 0.008133 | 0.008133 | 0.008133 | <2 |
| 卡名／稀有度／寶石字級 px | 31.45／17.69／28.83 | 同左 | 31.45／17.69／28.83 | 不變 |
| 文字框左／右 % | 4.399684／4.399789 | 同左 | 4.399684／4.399789 | 原值容差 0.0001 |
| 文字框底／高 % | 3.398139／16.197726 | 同左 | 3.398139／16.197726 | 原值容差 0.0001 |
| 框環平均灰階 | 176.908446 | 176.908446 | 177.208397 | 增幅 +0.169551%，≤6% |
| 框環灰階標準差 | 72.845376 | 72.845376 | 72.059428 | 保留 98.921074%，≥95% |
| 圖窗兩秒差異像素 % | 0.2490～0.2755 | 0.2501～0.2560 | 0.4784～0.4828 | ≥0.15 |
| 文字框兩秒差異像素 % | 0 | 0.0000 | 0.0000 | ≤0.02 |
| 粒子整卡平均增亮 % | 0.0153～0.0200 | 0.016108～0.017369 | 0.013810～0.013963 | 圓點＋愛心合計 ≤0.06 |
| 靜置三秒 rAF | 0 | 0 | 0 | 必須為 0 |

所有字級與文字框原始數值比較均通過；名字／稀有度中心命中 face-name／face-rarity，沒有被愛心攔截。粒子 reduced-motion 兩秒差圖為 0.0000%，全部 animationName=none。

## A、五顆原創粉色愛心

保留二十顆圓點，另加五顆同層愛心。使用自行編寫的十二點 CSS polygon，無圖片檔、第三方圖案或新函式庫；顏色 #ffb3dd，opacity 0.18～0.30，低於圓點最高 0.85。週期 16／18／20／22／24 秒，延遲 −2／−5.7／−9.4／−13.1／−16.8 秒。只有 transform／opacity 動畫，local Z=0、所屬平面 Z=36.4px、z-index=5，pointer-events:none。

愛心原先設為 13px、top:68%。一般測試位置全過後，追加完整 14° 四角測試，實際抓到 top=59.923697%、最大 rect=14.181274px；因此收成 12.7px、top:69%。這是保住原門檻的尺寸／位置修正，沒有把 60% 或 14px 的門檻改掉。原始失敗樣本與退出碼保留在 full-corners.json、full-corners-summary.json、full-corners-red.log、full-corners.exit。

最終 checker 同時檢查：正常姿態每顆完整週期的 101 個取樣、四個最大傾角各 101 個週期取樣，以及跟隨／回正每個 rAF 畫面的實際 rect。因此不以未變形 CSS width 代替投影尺寸，也不只驗正常時的上下界。

IoU 量法：固定同一動畫時間，隱藏粒子取背景，再逐顆顯示愛心，RGB 絕對差最大通道 >1 定位可見像素；將原創 clip-path 在相同實際 rect／次像素位置另繪成黑底白色參考遮罩，以灰階 >127 二值化，計算交集／聯集。參考遮罩沒有從差圖反推，沒有調低 0.80。每顆差圖、參考圖與原圖均保留。

| 愛心 | 週期 s | 延遲 s | 正常 rect 寬×高 px | 所有姿態／逐格 rect 最小～最大 px | 上緣最小～下緣最大 % | IoU |
|---|---:|---:|---|---|---|---:|
| 1 | 16 | -2.0 | 12.688843×12.688782 | 11.595795～13.863861 | 60.905594～76.165381 | 0.909976 |
| 2 | 18 | -5.7 | 12.688843×12.688782 | 11.751404～13.642090 | 61.488078～75.084164 | 0.853547 |
| 3 | 20 | -9.4 | 12.688812×12.688782 | 11.909790～13.440552 | 61.963338～74.116401 | 0.847032 |
| 4 | 22 | -13.1 | 12.688812×12.688782 | 11.802826～13.575378 | 61.560059～74.779161 | 0.856502 |
| 5 | 24 | -16.8 | 12.688782×12.688843 | 11.646362～13.782166 | 61.013943～75.819695 | 0.920398 |

五顆的所有取樣均符合 8～14px、卡高 60%～80%；最小 IoU 0.847032 ≥0.80。正常週期每入口 505 筆愛心 rect，最大四角週期每入口 2020 筆，另含跟隨／回正逐格取樣。總增亮、文字框差圖、對比、命中測試與 rAF 見基準表，沒有以只關掉愛心的數字冒充整個粒子層。

## B、短跟隨、較長回正

先在改前頁實測 transition:transform 100ms ease-out，Chromium 產生七個不同的渲染矩陣，證實 var() 組成的 transform 能原生過渡；證據為 [var-transform-probe.json](shots/round37/var-transform-probe.json)。因此不需要 @property。

只在 gift-stage 的 .r-special 範圍覆蓋 card-lift：pointermove 時 100ms ease-out，pointerleave 後 500ms cubic-bezier(.2,0,.6,1)。事件只切換 class／目標值，不增加 rAF 或 interval。reduced-motion 覆蓋 transition:none，愛心 animation:none。

原始 --rx／--ry 是 paint() 寫入的「目標」，離開即設成零；驗收讀取實際渲染 transform 的 DOMMatrix，還原畫面角度，避免把目標已為零誤算成回正完成。四個最大 ±14° 對角均逐格錄下跟隨與返回，五個保護層的投影範圍每格都驗，沒有只看兩端。過衝分別量兩軸的反向比例與跨越次數。

| 條件 | 最終實測 | 門檻 |
|---|---|---|
| 四角跟隨至 90% | 81.700～96.300ms | ≤120ms |
| 回正至兩軸 <0.1° | 474.600～497.300ms | 380～520ms |
| 最大反向過衝 | 0.000000% | ≤8% |
| 最多跨越零點次數 | 0 | ≤1 |
| 每格最大投影超緣 | -0.998596px（負值代表仍在卡內） | ≤1.5px |
| 實際 rAF 姿態取樣 | 3235 格／80 條軌跡，另有每段起格 | 所有格、所有五層逐一通過 |
| reduced-motion | transition-duration=0s，渲染角度立即 <0.1° | 立即回正 |
| 頁面靜置 rAF | 十入口皆 0 | 0 |

## C、內側亮邊與外側陰影

在這張卡既有 face-frame 的 ::before 畫獨立 inset 亮／暗邊及外陰影，偏移正負跟隨同一指標方向；中央時內側偏移為零。不更動 face-frame 的五道描邊、conic、brightness(1.6)，不提高任何 Z。

第一次偏移為 1.36px 時，左傾左右帶差只達 −4.624217 灰階，未達 6，因此改成 clamp 限制在 2px。最終左右傾測得兩道 inset offset 絕對值皆 2px，blur／spread 都為零。外側 box-shadow 不參與 rect；leaf 的 overflow 保留原值（stock／背景／art 為 hidden，plate 原本就是 visible），沒有為了陰影打開圖窗裁切。

左右 3px 帶沿實際投影邊界取樣：在 frame 內放零尺寸定位點取得投影座標，避開上下圓角，再沿每一側的帶寬量像素；沒有把傾斜後軸對齊外接矩形的空白區當作卡邊。

| 條件 | 改前 | 最終實測 | 門檻 |
|---|---|---|---|
| 新增內側亮邊 | 無 | 左／右測得 2.000000 CSS px | 1～2px |
| 左傾：左帶／右帶／差值 | 差 +4.697330 | 233.512273／254.935310／-21.423037 | 差值絕對值 ≥6 |
| 右傾：左帶／右帶／差值 | 差 +4.699990 | 252.701915／204.831592／+47.870323 | 兩張符號相反 |
| 框環平均增幅 | 176.908446 | +0.169551% | ≤+6% |
| 框環標準差保留比例 | 72.845376 | 98.921074% | ≥95% |
| 整卡灰階／增幅（關粒子以隔離厚度） | 184.016131 | 184.056455／+0.021913% | ≤2% |
| 整卡加回粒子的合計增幅上限 | 同上 | +0.035879% | ≤2% |
| 中央角色灰階／增幅 | 206.137956 | 206.137956／+0.000000% | ≤1% |
| 五個保護層每格超緣 | 原本亦在內側 | -0.998596px | ≤1.5px |
| 裁切 | 原值 | 全部等於原值 | 不修改 leaf overflow |

## D、決定性疊化截圖

在 trigger 前監聽 data-face 的 mutation。show(false) 切回 idle 的同一個 mutation checkpoint 內，強制讀取樣式以建立原生過渡，用 getAnimations({subtree:true}) 取得六條 opacity transition，pause()，逐條將 currentTime 設為 160ms，再截圖、play()。wait_for_function 只等待已鎖定且持續成立的 returnHeld，不再等待一閃即逝的 opacity 區間。

沒有拉長 320ms 過渡，也沒有暫停或改寫用來量原生疊化曲線的時鐘。原本逐格不得雙空／雙滿、互補誤差 <0.025、每方向每組至少三筆中間值，全部保留。

早期證據輸出曾讓「卡片回正中間格」與「角色疊化中間格」共用檔名，已修成 return-middle 與 fade-return-middle 兩個檔名。下方連結使用修正後、且通過完整四角檢查的成品。

| 次數 | exit | dev／搬移版原生疊化格數 | 入場／返回各組最少中間格 | 最大互補和誤差 | 日誌 |
|---|---:|---|---|---|---|
| accepted-1 | 0 | 256／255 | 12／12 | 0.00000139 | [log](shots/round37/accepted-1.log)／[exit](shots/round37/accepted-1.exit) |
| accepted-2 | 0 | 257／256 | 12／12 | 0.00000125 | [log](shots/round37/accepted-2.log)／[exit](shots/round37/accepted-2.exit) |
| accepted-3 | 0 | 256／256 | 12／12 | 0.00000125 | [log](shots/round37/accepted-3.log)／[exit](shots/round37/accepted-3.exit) |
| accepted-4 | 0 | 250／250 | 12／12 | 0.00000125 | [log](shots/round37/accepted-4.log)／[exit](shots/round37/accepted-4.exit) |
| accepted-5 | 0 | 256／256 | 12／12 | 0.00000139 | [log](shots/round37/accepted-5.log)／[exit](shots/round37/accepted-5.exit) |

五次使用相同的渲染實作與完整 checker，均驗 dev 與搬移版。十次 160ms 決定性截圖的 opacity 皆為 0.802403／0.197597；各次皆無 pageerror、console error 或外部 HTTP 請求。摘要見 [accepted-summary.json](shots/round37/accepted-summary.json)，完整原始數據在 accepted-N-verification.json、*-round37.json 與 *-curve.json。交付前另修正 PowerShell 管線造成的中文報告與 CSS 註解編碼損失，沒有改渲染規則或斷言；重新建置及內容比較見 build-final.log、final-comment-identity.json。

## 紅燈與保留證據

修改卡面前先新增 A／B／C 斷言並跑在舊頁：愛心數為 0、IoU 無可量遮罩；沒有跟隨中間格，回正只需約 9.2～10.8ms；卡邊兩張差值同為正（+4.697330／+4.699990）。實際 exit 1，見 [before.log](shots/round37/before.log) 與 before-dev-round37.json。

舊頁的投影範圍本來就合格，不能偽稱這條自然為紅。另在保存的改前 HTML 注入 face-text Z=106px，逐格斷言正確拒絕最大 21.516724px 超緣，見 [overflow-negative-control.json](shots/round37/overflow-negative-control.json)／[log](shots/round37/overflow-negative-control.log)。初版 harness 還誤以為所有 leaf 都應 hidden；依原值修正 plate 的比較，未改頁面裁切。

第一版視覺實作只剩卡邊 −4.624217 灰階不合格，first.log／first.exit=1 保留。full-first 完整驗收 exit 0。其後 final-1～5 雖均 exit 0，但當時取樣尚未涵蓋最大四角；追加四角發現上述愛心真回歸後，這五次不算本輪最終驗收。修正尺寸／位置、加嚴 checker 後，另以 accepted-1～5 重新連續完整驗收，結果見 D 節表格。沒有刪除或覆寫早期失敗。

## 截圖與交付

- [常態](shots/round37/accepted-5-dev-particles-held.png)
- [左傾](shots/round37/accepted-5-dev-edge-left.png)、[右傾](shots/round37/accepted-5-dev-edge-right.png)
- [五顆愛心差圖與參考遮罩放大對照](shots/round37/heart-iou-detail.png)
- [回正起格](shots/round37/accepted-5-dev-return-start.png)、[中間格](shots/round37/accepted-5-dev-return-middle.png)、[末格](shots/round37/accepted-5-dev-return-end.png)、[三格並排](shots/round37/return-three-frames.png)
- [reduced-motion](shots/round37/accepted-5-dev-reduced-motion.png)
- [角色疊化 160ms](shots/round37/accepted-5-dev-fade-return-middle.png)

成品：[gift-mohuashaonv.html](../../_art/holo-test/gift-mohuashaonv.html)。建置：python _art/holo-test/build_gift_card.py；驗收：設定 PYTHONIOENCODING=utf-8 後執行 python _art/holo-test/check_gift_card.py --tag 自訂名稱。所有執行與輸出皆在這個 worktree；原素材來源只有讀取。
