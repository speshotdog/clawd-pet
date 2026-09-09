# 派工簡報（第二十八輪 b）：拖曳把圖片選成藍色、卡包素材換新、像素級互動斷言

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`。這是第二十八輪的補丁輪，範圍很小，**不要**動第二十八輪其他東西。

## 一、Bug：拖曳轉動後，卡面整片變藍

Claude 複驗第二十八輪時用 Playwright 真的拖了 60px 再截圖：卡面圖變成一片藍色剪影
（截圖與量測：拖曳前藍色像素比 0.0，拖曳後 **0.68**；`getSelection().rangeCount = 1`、選區含 `<img>`；
`getSelection().removeAllRanges()` 之後藍色回到 0.0）。

**根因**：這是**瀏覽器的拖曳選取**——按住拖動把 `.art-media img` 選起來了，Chromium 給選中的圖片塗藍色。
`.slot`／`.hcard`／`img` 的 `user-select` 都還是 `auto`。第二十八輪的互動測試只量了 `--rx/--ry/--phase` 變數，沒看像素，所以全綠。

**修法**（在 `ceremony.css`／`ceremony.js` 或 `build_deluxe_b.py` 的既有互動程式碼裡改，不要另開檔）：
1. 結果頁的 `.slot`、`.hcard` 及其子孫 `user-select: none`；`img` 加 `-webkit-user-drag: none`、`draggable=false`。
2. 拖曳的 `pointerdown` handler 呼叫 `preventDefault()`，並在 pointerdown 時 `getSelection().removeAllRanges()` 保險。
3. 觸控路徑（單指拖曳）也一樣不能選取；`touch-action: none` 只在卡片上。

**驗收**（加進 `check_gacha_ceremony_round28.py --interaction-only`，不是臨時腳本）：
- 拖曳 60px、放開、**游標移開卡片**後截 `.hcard` 元素圖，「藍色像素比」（b>120 且 b>r+40 且 b>g+20）**≤ 0.01**；同時 `getSelection().rangeCount === 0`。
- 拖曳後 `--ry ≠ 0` 且保留、Esc 回 0 的既有斷言照舊。
- 在 dev 與搬走的 standalone 都跑。

## 二、卡包素材已換成 v3（滿版印刷）

`_art/holo-test/fx/foil-pack.webp` 已被 Claude 換成滿版鮮豔印刷版（`3378791`）。目前 `deluxe-gacha-b-standalone.html` 內嵌的還是舊的灰色版。
**重建** `build_deluxe_b.py` → `build_deluxe_b_standalone.py`，確認內嵌的是新檔（比對 SHA-256 或尺寸 87,102 bytes）。
順便看一下前奏裡卡包的顯示尺寸：截圖裡卡包在 1440×900 只有約 200px 寬，偏小；**若能在不動時間軸的前提下放大到約 300px 寬，就做；不能就寫在報告裡留給下一輪**。

## 三、交付

1. 修完跑 `check_gacha_ceremony_round28.py`（core 與 interaction 兩個分支）、`check_gacha_card_regression.py`，回報真實 exit code。
2. 在 `REPORT-holo-round28.md` 末尾加「28b 補丁」一節：根因、改了哪幾行、新斷言的實測數字、standalone 新大小。
3. `LESSONS-2026-09-09.md` 第三節「量測的三個陷阱」加第 4 條：**互動類驗收要驗像素，不能只驗 CSS 變數**（這次拖曳變數全對、畫面全藍）。
4. 不 push。commit 若被 sandbox 擋住就略過。
