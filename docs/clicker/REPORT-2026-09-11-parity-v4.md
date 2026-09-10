# 執行回報 v4：第三輪補件（2026-09-11）

`VERDICT-2026-09-11-parity-v3.md` 判 **EXIT 1**，並示範了 **5 種新的假通過**，
最小可交付壓成三包。這份回報三包的進度。

---

## 一、第一包（判定器補洞）：完成，9 種破壞全部擋下

你示範的 5 種我全部重現、全部修好，連同前一輪的 4 種寫成可重跑的
`check_card_assets.py` 旁邊那支 `check_card_parity_sabotage.py`：

```
clean              未破壞的對照            exit=0 FAIL=0  OK
drop-entry         刪掉整個 pool 入口       exit=1 FAIL=1  OK
drop-card          刪掉 pool 的 rocketdog  exit=1 FAIL=6  OK
drop-detail        刪掉編隊全部手機詳情       exit=1 FAIL=6  OK
blank-required     pool 全標不可見＋清必填     exit=1 FAIL=3  OK
shrink-manifest    連 JSON 自帶的預期清單一起改小 exit=1 FAIL=7  OK
hollow-geometry    幾何物件在、內層欄位掏空     exit=1 FAIL=3  OK
clone-one-slot     十連變成同一槽複製十份      exit=1 FAIL=9  OK
zero-complete      固定抽卡 complete 改成 0  exit=1 FAIL=3  OK
detail-offscreen   詳情全部標成視窗外        exit=1 FAIL=3  OK
→ 9/9 擋下
```

**你點名最關鍵的那一條**：`expected_manifest()` 之前確實是讀待驗 JSON 自己帶的
`expectedPoolIds`／`expectedTeamIds`——你說得對，「收集端從來源產生清單」不等於
「判定端有獨立清單」。現在判定器改成 `source_ids(root)`：
直接 `import pool_data.pool()`、直接解析 `map20.html` 的 `TEAM_DATA`，
**完全不看待驗 JSON**；並且多一條「JSON 自稱的清單與原始碼不符就 FAIL」。

其他四條：內層 schema（物件在不代表欄位在）、十連要有 10 個不同槽位且與 `drawnIds` 相符、
固定抽卡每批 `complete` 要等於該批張數、詳情必須在視窗內。

補完之後正式驗收 `parity-post7` 仍是 **EXIT 0 全綠**。

⚠ 兩條我自己收窄了範圍，請裁決：
1. **`inViewport` 只對 `detail` 強制**。卡池與 demo 是長格線頁、手機的揭卡結果也會捲動，
   要求「每張卡都在視窗內」等於要求逐卡捲動；我改成
   「詳情浮層必須整個在視窗內」＋「每個畫面至少要有一張卡真的在視窗內」。
2. **槽位唯一性只對原生姿態**。同尺寸那趟會把卡就地改寬度、關掉版面變形，位置本來就會疊。

## 二、第二包（箔面相位）：**原因查出來了，而且不是箔面相位**

照你的指示做了測試端包裝（`diag_foil_phase.py`）：把 `HoloCardFace.paint` 包起來記錄
每一次呼叫的參數與 stack，並在 **paint(0,0) 後 / 雙 rAF 後 / 截圖前（再等 600ms）**
各讀一次 `--phase`／`--fx`／`--fy`／`--gx`／`--gy`／`--sx`／`--sy`／`--tilt`／`--foil` 等變數。

**結果：四個入口全部「三個時點 0 個變數不同」，而且整個過程只有我自己那一次 `paint(0,0)`。**
所以**沒有後續寫入**——我上一輪猜「還有另一個來源在推相位」是錯的，那個猜測收回。

真正的原因是兩個，都量到了（`check_card_assets.py` / `asset-layers.json`）：

**（1）standalone 建置會把素材縮圖再重編碼。** 逐入口的實際內在解析度：

| 入口 | `.art-media img` | 箔面蝕刻 |
|---|---|---|
| `gacha-test`（參考）、`demo`、`pool` | **600×840**，檔案 | 檔案 |
| `team` | **600×840**，data:webp | data:webp |
| `pool-standalone` | **420×588**，data:webp | data:png |
| `demo-standalone`、`gacha-test-standalone` | **360×504**，data:webp | data:png |

來源可追溯：`build_cards_remade_standalone.py:23` 的
`uri(path, box=(420,588), quality=84)` 會 `thumbnail()` 縮圖。
卡片顯示 260px、DPR 2 ＝ 520 裝置像素，**360／420px 的素材是被放大的**，
所以像素一定不同。這是既有的離線包體積取捨，不是本輪造成的，
但它就是「同尺寸截圖比像素不會全等」的主因。

**（2）截圖裁切落在非整數像素。** 位移補償實測：
`demo` 15.81 → **9.73**、`team` 13.33 → **4.99**（都在位移 (1,1) 時最小）；
但 `pool-standalone` 59.24 → 55.63，位移補不掉——正好對應上面的縮圖差異。
`gacha-test-standalone` 只有 3.84、>100 的像素 0.0%，那是純 WebP 重編碼雜訊。

**所以第二包我改成這樣驗**（`check_card_assets.py`）：
**層的樣式與幾何必須完全一致**（`.face-stock`／`.face-depth-bg`／`.face-art`／`.art-media`／
`.art-media img`／`.subject-mask`／`.face-frame`／`.frame-material`／`.foil-stack`／`.foil-etch`／
`.face-plate`／`.face-gem`／`.card-back` 的位置、尺寸、transform、背景尺寸／位置／重複、
opacity、mix-blend-mode、filter、object-fit／position、圓角、遮罩尺寸／位置／重複），
**素材的內在解析度與傳輸方式另外列出、要能追溯到建置參數**。

結果：

| 入口 | 層樣式與幾何 |
|---|---|
| `pool`、`pool-standalone`、`gacha-test-standalone`、`team` | **PASS，0 項差異** |
| `demo` | FAIL 1 項：多一個 `.card-back` |
| `demo-standalone` | FAIL 2 項：多一個 `.card-back`、**少一個 `.subject-mask`** |

`demo` 的 `.card-back` 應該是實驗頁本來就有的翻面樣本；
但 **`demo-standalone` 少 `.subject-mask`** 我還沒查出原因，**沒有當成通過**。

⚠ 正式版抽卡（`gacha`／`gacha-standalone`）是隨機抽，這次沒抽到 `rocketdog`，兩個入口跳過。
要全量就得讓正式版也能指定卡，那會動到正式機率，我沒有做。

## 三、第三包（回報更正）

- Chromium **149.0.7827.55**（不是 140）；固定序列 **63 張**（不是 59）。
- `product-hashes.json` 改成九份主線的**完整 SHA-256**；`rebuild-diff.json` 同時列
  `git blob(LF)`／`工作檔原樣`／`LF 正規化` 三種並註明——你指出「九份中只有 demo 含 CRLF」，
  標籤已改成不再統稱 CRLF。
- `rebuild-diff.json` 改成**全欄位**：test 產物 **9 個 ID** 變更
  （4 張 `flat→depth` 且新增 `scene:true`、1 張 `flat→framed`、5 張 palette），
  遮罩鍵 test +5、demo-standalone +16，逐鍵清單都在檔裡。
- **demo 與 demo-standalone 各新增 16 個卡片 ID 的資料同步**，
  上一份回報只寫「demo 一行 CSS」是不完整的，這裡補上。
- 工具是**四支**：收集器 `check_card_parity.py`、判定器 `check_card_parity_report.py`、
  校準器 `write_card_parity_calibration.py`（已不參與判定，留作歷史）、
  截圖器 `shoot_card_parity_samesize.py`；再加本輪的
  `check_card_parity_sabotage.py`、`diag_foil_phase.py`、`check_card_assets.py`。
- A/B 強度照實分開：`check_card_feel.py` 是**逐項**（14 vs 14、新增 0）；
  其餘四支是**遮掉數值後整份 log 文字比對**。兩者不同，不再統稱「逐項 A/B」。

## 四、還沒做的（照實列）

- `demo-standalone` 少 `.subject-mask` 的原因。
- 正式版抽卡入口的素材層比對（隨機抽沒抽到目標卡）。
- 三尺寸的素材層比對（目前只做 1440×1200 一個尺寸）。
- 卡背的實際渲染比對（`.card-back` 只驗了存在與否與樣式，沒有翻面實拍）。
- `refit`／`decode` 例外目前是收集端記 `pageErrors`／`brokenImages` 並判 FAIL，
  但 `try{...}catch(e){}` 本身還在，個別卡的 refit 失敗仍會被吞。
- **沒有 commit。**
