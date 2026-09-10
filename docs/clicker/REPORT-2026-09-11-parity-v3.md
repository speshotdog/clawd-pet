# 執行回報 v3：第二輪補件（2026-09-11）

`VERDICT-2026-09-11-parity-v2.md` 判 **EXIT 1**，並且**用記憶體改資料示範了四種假通過**。
那四種我全部重現、全部修好，並把負控制留成可重跑的證據。
但**有一件我沒做到，也不會假裝做到**，寫在第五節。

---

## 一、你示範的四種假通過：現在全部非零退出

我照你的做法把 `parity-post6.json` 載進記憶體破壞，再用**同一支正式判定器**跑：

| 破壞 | 你示範時 | 現在 | 抓到什麼 |
|---|---|---|---|
| 刪掉整個 `pool` 入口 | EXIT 0 | **EXIT 1**（1 項 FAIL） | 入口缺漏 |
| 刪掉 `pool` 全尺寸的 `rocketdog` | EXIT 0 | **EXIT 1**（6 項 FAIL） | 預期清單缺 1 張 × 3 尺寸 × 2 姿態 |
| 刪掉編隊所有尺寸的全部 `detail` | EXIT 0 | **EXIT 1**（6 項 FAIL） | 預期角色 `detail` 缺 24 張 × 3 尺寸 |
| `pool` 全標不可見＋清掉字級變數與必填幾何 | EXIT 0 | **EXIT 1**（3 項 FAIL） | 必填欄位缺漏 |

證據：`shots/parity/parity-sabotage-*.json` 與 `report-sabotage-*.log`。

**做法**：判定器多了一段**獨立預期清單**（`expected_manifest()`），
它**不看輸入資料裡有什麼**，而是從資料來源反推：

- 卡池入口（demo／demo-standalone／pool／pool-standalone）：`pool_data.pool()` 的 **63 個 ID**，角色 `grid`
- 固定序列抽卡（gacha-test／-standalone）：同樣 63 個 ID，角色 `reveal`
- 正式版抽卡（gacha／-standalone）：隨機抽，所以驗**筆數 ≥10**（同一張可能抽到兩次）＋ `complete=10` ＋ `drawnIds` 10 筆
- 編隊：`map20.html` 的 `TEAM_DATA` **24 個 ID**，角色 `overview` 與 `detail` 各一份

每個 (入口 × 尺寸 × 姿態 × 角色) 都要對齊清單，缺一張就 FAIL。
另外每張卡有**必填 schema**：`nameStyle`／`rarityStyle`／`plate`／`gem`／`frame`／
`rarityRange`／`nameRange`／`rarityClear`／`nameClear`／`contentWidth`／字級變數／原生姿態必須 `visible`，
缺任何一項都是 FAIL，不再只是 note。

預期入口與尺寸也改成**寫死的清單**（九個入口、三個尺寸），不再從輸入自己抓。

## 二、其他你點名的缺口

| 你指出的 | 修法 |
|---|---|
| 正式版抽卡只斷言 `screen`，沒驗 `complete=10` 與 `drawnIds` | 都補上了，兩者都是 FAIL 條件 |
| 判定器不強制 24 筆手機詳情存在 | 由預期清單強制（上面第三種破壞就是驗這個） |
| 中性資料重複收初始總覽，**174 不是我寫的 177** | 你是對的。編隊的第一次收集會把 `card-host` 裡的卡收進來（那時浮層還沒開），我已在原生與中性兩趟都剔除；數字以 `report-post6.log` 為準，我不再自己抄 |
| `decode()`／`refit` 例外被吞、沒有 broken-image／console／pageerror | 收集端加 `pageerror` 與 `console.error` 監聽、掃 `naturalWidth===0` 的壞圖（含 shadow root）；判定端**兩者都是 FAIL 條件** |
| 1.04 漏判編隊純 hover | 收集端的 `selectedState` 補上 `.team-proxy:hover` |
| `rebuild-diff.json` 只留 name/rarity/kind/file，漏掉 scene 與 pal，說 5 個 ID 其實是 9 個 | 改成**全欄位**比對。重跑後與你的數字一致：**9 個 ID**、4 張 `flat→depth` 且新增 `scene:true`、1 張 `flat→framed`、5 張 palette 變更（`bianbiancaihua`、`jintianwoshengri`、`liulangyueshou`、`miepuxiong`、`xiaochouyue`）；遮罩鍵 test 60→65（+5）、demo-standalone 49→65（+16），逐鍵清單都在檔裡 |
| 雜湊混稱 LF 與原樣 bytes | 現在三種都列並註明：`sha256_head_git_blob_LF`、`sha256_work_raw_bytes_CRLF`、`sha256_work_LF_normalised` |

## 三、最終驗收（`parity-post6.json` / `report-post6.log`）

Chromium **149.0.7827.55**、DPR=1、九入口 × 三尺寸、固定序列＝整個正式卡池 **63 張**。

**EXIT 0、全綠**，且是在上面那套嚴格預期清單與必填 schema 之下。

## 四、負控制（同一支正式判定器，乾淨參考）

`report-neg3-*.log`。注入注進卡片所在的每一個 root：

| | 退出碼 | FAIL |
|---|---:|---:|
| `mono`（稀有度改回 monospace） | **1** | 4 |
| `epic-accent`（階級墨色打回 `--accent-card`） | **1** | 1 |
| `wrap`（強迫換行） | **1** | 6 |
| `drop-card`（抽掉一張預期的卡） | **1** | 5 |
| **不注入（neg3-clean，同樣參數）** | **0** | 0 |

加上第一節那四種記憶體破壞，總共 **8 種負控制全部變紅、乾淨狀態全綠**。

## 五、⚠ 受控卡面圖：做了，但**像素層級的一致性我沒有做到，也不宣稱**

你要求「同尺寸完整卡面驗收」不能只有 computed style。我寫了
`shoot_card_parity_samesize.py`：同一張卡（`rocketdog`）、同一個未變形寬度 260px、
中性姿態，在**七個入口各拍一張**（正式版抽卡是隨機抽，那兩個入口沒抽到這張，已列明跳過）。
並排圖在 `shots/parity/samesize/rocketdog-all-entries-260px.png`。

**像素比對結果（以 `gacha-test` 為參考）：**

| 入口 | 最大像素差 | 平均 |
|---|---:|---:|
| `gacha-test`（參考自己）| 0 | 0.000 |
| `gacha-test-standalone` | 176 | 2.213 |
| `team` | 241 | 9.820 |
| `demo` | 241 | 11.497 |
| `pool` | 241 | 11.498 |
| `demo-standalone` | 240 | 12.224 |
| `pool-standalone` | 249 | **44.117** |

**這不是全綠，我沒有把它算進通過。**

我查到的部分原因：**箔面相位不是 WAAPI 動畫，凍結動畫關不掉它**。
它是 `HoloCardFace.paint(card, rarity, x, y)` 依指標座標算出來的。
我已在同尺寸那趟統一 `paint(c, rarity, 0, 0, {tilt:false})`，
`demo` 的平均差因此從 **51.6 降到 11.5**——**但 `pool-standalone` 反而從 11.7 升到 44.1**，
表示還有另一個來源（很可能是閒置重繪的 rAF 又把相位推走）在動它。

**我沒有再往下猜。** 照工法「查不出來就說查不出來」：
**受控像素一致性這一項未達成，證據與數字都留在上面，請你裁決要不要這輪解決。**
computed style 與幾何的一致性（第三節）是通過的，那兩件事不能互相代替。

## 六、還是沒做的（照實列，不縮小範圍宣稱免驗）

- **角色／背景圖層、遮罩、箔面各層、偽元素、卡背的實際渲染比對**：沒有做。
  第五節的像素差正說明這一塊還沒受控。
- `check_round43_idle.py` 與 `check_round42_contracts.py` 缺的
  `docs/clicker/shots/round43/portable/before-cards.html` **repo 裡沒有這個檔**，
  HEAD 也一樣缺。我**沒有**去生成一份來讓它跑得動——那會變成我自己造證據。
- A/B 解析：`check_card_feel.py` 是逐項比對（14 vs 14、新增 0）；
  另外四支我是**遮掉數值後做整份 log 文字比對**（clearance 與
  `run_card_feel_regression` 完全相同；round43／round42 只差絕對路徑）。
  這兩種強度不同，我不該一起講成「逐項 A/B」。
- 黑角 `team_negative_bad_corners=0`：我讀了 `check_card_feel.py:48`，
  它的注入只走一層 shadow root 且要求 `root.querySelector('.card-face')`；
  **HEAD 也是 0**。但我**沒有實際證明**注入位置就是唯一原因，這只是讀碼＋A/B 推論。
- 禮物卡／mtk：只有規格 `SPEC-gift-card-into-gacha.md`，沒有重建。
- **沒有 commit。**

## 七、如果你判可以 commit，訊息應該只寫這些事實

- `demo.html` 一行 CSS：`.hcard .face-rarity` 補 `font-family:"Holo Noto Sans",sans-serif`
- `team20.js`：`SHADOW_CSS` 把 `body.ink-chroma` 的兩條規則換成同特異性、能在 shadow root 命中的寫法
- 字型子集 726 → 739 字元，補齊 9 個卡名缺的 13 字；九份主線產物 payload 一致（240,448／325,236 bytes）
- 產物同步帶進來的既有來源變更（9 個 ID 的 kind／scene／name／palette、遮罩鍵 +5／+16）
- 新增驗收工具三支＋受控截圖一支
- **不可以寫「完整 parity 通過」**（像素層級未達成）
- **不可以寫「七支回歸新增 0」**（其中四支只到文字比對強度）
