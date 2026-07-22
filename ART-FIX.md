# 美術修復實作單（依 ART-DIAGNOSIS.md 裁決後執行）

審查者裁決如下，照此實作。約束不變：只能從 `ref-jiaobu.png`／`ref-yueyue.png` 取像素，不得重繪形狀、不得改變外輪廓剪影、不得用深色重疊帶、不得用圖像生成。

## FIX-1 膠布靜止筆畫回補（診斷 #1）→ 歸屬 pawR
- `(388..401, 406..412)` 與 `(475..477, 537..539)` 兩塊，從 `ref-jiaobu.png` 逐像素取樣補進 `src/jiaobu-pawR.png`（第二塊的 ~110 alpha 也以原圖像素覆蓋成完整值）。
- 理由：既定工法「pawR 覆蓋區的 body 一律補毛色、不留殘留」，所以 0° 的筆畫必須由 pawR 供給。body 的毛色補丁保持不動。
- 驗收：0° 全層合成 vs 原圖（含此二區）逐像素一致；pawR 在 ask +7.25° 旋轉時此二區不得出現孤兒深色段（附 PIL 預檢數據即可，實機由審查者掃）。

## FIX-2 玥玥 2px 透明漏點（診斷 #2）→ 補進 body
- `(611, 333..334)` 從 `ref-yueyue.png` 取原像素補進 `src/yueyue-body.png`（靜態層，避免 tail 轉動產生孤兒像素）。
- 驗收：0° 合成一致；tail ±1° enclosed-gap 預檢不再命中該區。

## FIX-3 兩角色眼睛改「原圖眼件」工法（診斷 #3，已授權）
比照 zhenzhen/zhenmu 的定案工法（見 `src/index.html` 的 char-zhenzhen/char-zhenmu template 與 `角色製作工法.md`）：
1. 從原圖拆出緊裁（tight bbox）眼件 PNG：`jiaobu-eyeL/R.png`、`yueyue-eyeL/R.png`（含原圖的 AA 邊緣，完整不透明度）。
2. body PNG 的眼睛區域挖掉後用**周圍原圖底色**無縫補平（烘進 body PNG，不用 SVG 橢圓蓋）。
3. template 改成 zhenzhen 模式：
   - `eyes-open`：`<g class="eye"><image href="..-eyeL.png" x=.. y=.. width=.. height=..></g>`（緊裁 bbox 定位；`.eye` 靠 fill-box 做眨眼 scaleY，緊裁是必要條件）
   - `eyes-happy`：同一原眼 `translate(0,-3) → bbox 中心 scaleY(0.45)`
   - `eyes-closed`：同一原眼 bbox 中心 `scaleY(0.12)`
   - 刪除舊的底色橢圓與重畫 path。
4. 注意 pet.css 依賴：`.eye` 的視線跟隨（--gx/--gy translate）與 blink 用法，比照 zhenzhen 不需改 CSS；若發現需要 char 專屬樣式再最小幅度加。
5. 驗收：0°（睜眼）全層合成 vs 原圖逐像素一致（眼區不再排除）；happy/closed 形變只用 scaleY，不畫新形狀。

## FIX-4（本輪不做像素手術）
診斷 #4 的動態黑線/缺口候選：本輪**不動**，等審查者跑 tools/vtest 實機掃描後再決定。你只需保證 FIX-1~3 不惡化該區域的 0° 基準。

## 完成後
1. 跑 `python -B tools/vtest/diag_art_assets.py`（兩角色），把修復前後的差異統計寫進 `ART-DIAGNOSIS.md` 末尾新段落「修復後驗證」。
2. `node --check src/pet.js`（若動了 JS）；index.html 結構自查 id 完整（pet/body/face/legL/legR/pawR/tail 與眼組）。
3. 不要動 pet.js 的 CHAR_CFG 擺幅/樞紐、不要動其他角色資產。
4. 不要 git commit。
5. 修圖用的一次性腳本放 `tools/vtest/`、檔名 `fix_` 開頭，需可重跑（審查者會重跑驗證）。
