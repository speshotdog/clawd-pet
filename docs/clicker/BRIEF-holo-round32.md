# 派工簡報（第三十二輪）：桌面「新卡\4.0」16 張進精裝卡池

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree；**不要**碰 `D:\claude\clawd-pet`）。
**本輪只做精裝版**（`deluxe-gacha-b`／`cards-remade` 這條研究線）。**不改 `src/`、不進遊戲、不動經濟與技能。**

## 〇、必讀（動手前）

1. `角色製作工法.md` **第 0、1 節（素材要求與清圖）** — 去背的四步驟（洪水填充只移除與邊緣相連的近白像素 → 連通元件只留最大塊 → defringe 跑 5 輪）。**「一律用原插畫直接拆件，不要手繪重描」**，本輪同理：**不准重畫、不准生成新形狀、不准改變剪影**，只能對原圖做去背／裁切／縮放。
2. `docs/clicker/HANDOFF-holo-cards.md` 第三節 — **卡型定義**（depth／flat／framed）。
3. `docs/clicker/LESSONS-2026-09-09.md` — 特別是第二節（**同一份規格在多支腳本各寫一次一定會漂移**：卡池與卡型的唯一來源是 `_art/holo-test/pool_data.py`）、第六節第 1 條（卡型是資料驅動的 `art.kind`，不要在腳本裡寫死）、第六節第 2 條（**沒跑過的結論不准寫進報告**）。
4. `_art/holo-test/pool_data.py` 的檔頭註解 — 它已經記載了「把非場景卡寫死成 framed」那次事故。
5. `docs/clicker/REPORT-holo-round31.md` — 上一輪剛改過演出層與背景，本輪**不要動**那些檔（`ceremony*.js`／`ceremony.css`）。

建置順序（有依賴）：

```
python _art/holo-test/build_card_scenes.py            # 重算 art/palette.json
python _art/holo-test/embed_masks.py                  # 新卡的箔面遮罩
python _art/holo-test/build_cards_remade.py
python _art/holo-test/build_cards_remade_standalone.py
python _art/holo-test/build_deluxe_b.py
python _art/holo-test/build_deluxe_b_standalone.py
```

---

## 一、素材：`C:\Users\ASUS User VII\Desktop\新卡\4.0`

16 張。**檔名就是規格**：`<卡名> <稀有度>.<副檔名>`。稀有度對照 `精良=rare`／`史詩=epic`／`傳說=legendary`／`神話=mythic`。
卡名一律照檔名，**不要自己翻譯或改字**（HANDOFF 第五節第 2 點那次「foxfriend 被寫成狐狸朋友」的事故）。

我已經量過，狀況分三類，**不要當成同一種處理**：

| 檔名 | 尺寸 | 現有 alpha | 我看到的內容 | 建議卡型 |
|---|---|---|---|---|
| 咩噗熊 精良.png | 370×320 | 有 | 粉紅熊，已去背 | framed |
| 外送咩鴿 精良.png | 1350×1080 | 有 | 戴帽子的鴿子，已去背 | framed |
| 普發玥玥 精良.png | 490×449 | 有 | 灰色小獸，已去背 | framed |
| 給咩錢好嗎 史詩.png | 370×320 | 有 | 白色小生物，已去背 | framed |
| 膠齒 精良.png | 1920×1200 | 有 | 灰色四足獸，已去背 | framed |
| 小丑玥 史詩.png | 672×667 | 全不透明 | 戴派對帽的灰獸，**白底** | framed（要去背） |
| 小膠膠 史詩.png | 570×574 | 全不透明 | 綠色小獸，**白底** | framed（要去背） |
| 成體熱狗 史詩.png | 449×590 | 全不透明 | 熱狗狗狗站姿，**白底** | framed（要去背） |
| 扁扁彩華 史詩.png | 759×664 | 全不透明 | 米色鹿角獸，**白底** | framed（要去背） |
| 玥熊 史詩.png | 619×492 | 全不透明 | 灰色胖獸，**白底** | framed（要去背） |
| 今天我生日 傳說.jpg | 593×586 | JPG | 灰獸戴生日帽＋彩帶，**白底** | framed（要去背；JPG 邊緣有壓縮雜訊，門檻要放寬並多跑一輪 defringe） |
| 沙堡領主 神話.png | 952×747 | 有（實際不透明） | **整幅畫**：沙灘、沙堡、羊 | flat |
| 流浪玥手 神話.png | 688×648 | 全不透明 | **整幅畫**：狼彈吉他坐在木頭上、草地 | flat |
| 珍氣球 神話.png | 848×850 | 全不透明 | **整幅畫**：羊氣球在藍天雲層 | flat |
| 真菌玥 神話.png | 800×800 | 全不透明 | **整幅畫**：褐底貼紙拼盤 | flat |
| 珍珍 神話.png | 2039×1378 | 有（實際不透明） | **整幅畫**：暗色森林、發光狼、蘑菇 | flat |

**上表的卡型是我的判讀，不是命令**：你要自己開圖確認再定案。判準照 HANDOFF 第三節：
單一角色去背 PNG → `framed`；有背景、整張是一幅畫 → `flat`。

**本輪不做 `depth`。** depth 要拆 subject／background 兩層＋掛 subject-mask，是另一件事；即使 `珍珍` 看起來拆得開，本輪也走 flat。要做 depth 另開一輪。

**`4.0\怪物\` 子資料夾（`01.gif`／`ej93j4.gif`／`image.gif`／`rise.png`）本輪不處理**，那是動畫素材不是卡圖。在報告裡列出來說明沒收，不要自己決定收進去。

---

## 二、要做的事

### 2-1. 產卡圖 `_art/holo-test/art/card-<id>.png`

**id 命名**：用卡名的漢語拼音（小寫、無聲調、無分隔），例如 `咩噗熊 → miepuxiong`。
**必須先檢查不與現有 47 張的 id 相撞**（現有 id 見 `python _art/holo-test/pool_data.py` 的輸出），撞了就加一個有意義的後綴，不要用數字流水號。

**framed（去背角色）**：

- 已有 alpha 的 5 張：確認 alpha 真的是去背（不是整張不透明），直接用；仍要跑 defringe 檢查白邊。
- 白底的 6 張：照 `角色製作工法.md` 第 1 節四步驟去背。
  - 洪水填充只移除**與邊緣相連**的近白像素（門檻 r,g,b > 235），角色身上被輪廓包住的白色不能被吃掉。**成體熱狗、今天我生日、給咩錢好嗎 這幾隻身上有大面積白色，去背後必須逐張目視確認沒有挖破。**
  - 連通元件只留最大塊，清掉飄在外面的殘渣。
  - defringe：邊界上且 `min(r,g,b) > 165` 的像素逐圈剝除，跑 5 輪（JPG 那張跑 7 輪並把門檻降到 150）。
- 輸出：RGBA、**緊裁**（四邊沒有多餘透明）、**高度統一 580**（對齊現有 `art/card-*.png` 的慣例，寬度依原比例），LANCZOS 縮放。

**flat（滿版場景）**：

- **不要去背**，整張就是畫。
- 裁成 **5:7**（照 `recrop_round10.py` 的做法：只裁不重畫，保留原構圖重心；主體不得被切到），再重採樣到 **600×840**。
- `珍珍` 是 2039×1378、6.4MB，縮小後檔案要壓下來；`真菌玥` 是貼紙拼盤沒有明確主體，裁切以「拼盤置中、不切到邊緣任何一顆貼紙」為準。

### 2-2. 卡池資料：只加在 `pool_data.py`，不碰 `src/`

`pool_data.py` 的 `catalog()` 是從 `src/gacha-pool.js` 讀的，**本輪不改那支**。
照 `SCENE_CARDS` 的既有先例（註解寫著「只存在於這條研究線，不在 `src/gacha-pool.js` 裡」），**新增一個 `EXTRA_CARDS` 清單**放這 16 張，每筆帶 `id` / `name` / `rarity` / `kind` / `file`，並在 `pool()` 裡併進去（排序邏輯沿用既有的 `RANK`）。

- 註解要寫清楚：來源是桌面「新卡\4.0」、日期、**只在精裝研究線生效、尚未進遊戲**。
- `kind` 是資料，不准在任何 builder 裡寫死。
- **不要動 `RATE`、不要動 `SCENE_CARDS`、不要動現有 43 張的任何欄位。**

### 2-3. 配色與遮罩

- 跑 `build_card_scenes.py` 重算 `art/palette.json`（它會掃 `art/*.png`，新卡自動進去）。確認新卡的 `base` 沒有跟角色主色打架（LESSONS 第七節：背景要比角色暗、比角色低飽和）。
- `embed_masks.py` 目前有幾個名單是從 `root/src/card-*.png` 讀的——新卡**不在 `src/`**，所以要讓它從 `art/` 取新卡的 alpha 產箔面遮罩。改法要收斂成一個路徑解析函式，**不要在腳本裡再貼一份名單**（LESSONS 第二節）。
- flat 卡**不掛 subject-mask、不做圖內視差**（HANDOFF 第三節、LESSONS 第六節第 1 條第 2 點）。

### 2-4. 重建與版面

- 依上面的順序重跑六支建置腳本，dev 與 standalone 都更新。
- 卡池從 47 張變成 **63 張**：確認 `cards-remade` 的展示頁、`deluxe-gacha-b` 的抽卡與結果頁在 1440×900／1024×640／390×844 都不重疊、不溢出、不換頁失敗。
- **卡面幾何、Z、字級一律凍結**（`card_face.js` 不動）。新卡的長名（`今天我生日`、`給咩錢好嗎`、`外送咩鴿` 都是 4–5 字）由既有的 7% 縮字步進處理，**不要為了塞下去改字級基準或下限**。

---

## 三、不要做的

- 不改 `src/` 任何檔（讀可以）。
- 不改 `card_face.js`、`ceremony*.js`、`ceremony.css`、`RATE`。
- 不做 depth 卡、不拆層、不引第三方素材／字型／npm。
- **不重畫、不生成、不改變任何角色的剪影或造型**；只做去背、裁切、縮放。
- 不收 `怪物\` 資料夾。
- 不 `git push`。sandbox 擋住 commit 就跳過並列出提交邊界。

## 四、驗收（新增 `_art/holo-test/check_new_cards_round32.py`；舊測試更新不刪）

| # | 斷言 |
|---|---|
| 1 | 16 張新卡的 `name`／`rarity` 與桌面來源**檔名**逐字相符；id 不與現有 47 張相撞；`kind` 只有 framed／flat |
| 2 | 每張 `art/card-<id>.png` 存在、可載入、RGBA；framed 的高度 = 580 且四邊緊裁（外框一圈透明度為 0 的列／欄數為 0）；flat 的尺寸 = 600×840 |
| 3 | framed 去背品質：邊界像素 `min(r,g,b) > 165` 的比例 ≤ 1%；**角色內部**不得出現與邊緣不相連的新透明破洞（與去背前的白色連通元件比對，逐張列數字） |
| 4 | 63 張卡在三個尺寸下，展示頁與抽卡結果頁**任兩張 rect 交集面積為 0**；卡名／稀有度不溢出卡片 1.5px（沿用 `check_demo_round9.py` 的量法，**用 `Range.selectNodeContents` 量文字寬度，不要量塊元素的 rect**——LESSONS 第三節第 1 點） |
| 5 | `palette.json` 有 63 筆；新卡的 `base` 明度低於該卡角色平均明度 |
| 6 | 新卡在 deluxe 抽卡流程可被抽到並正常揭曉（用 fixture 指定，每張各跑一次，無 console error） |
| 7 | `deluxe-gacha-b-standalone.html` 體積增量 ≤ **900 KB**（現況 5,146,465 bytes），實際數字寫進報告 |
| 8 | `check_demo_round8.py`、`check_demo_round9.py`、`check_gacha_card_regression.py`、`check_gacha_ceremony_round30.py`、`check_gacha_layers_round31.py` 全綠 |

**每一支驗收都要回報真實 exit code。寫完檢查腳本要先確認它在已知正確的情況下是綠的**（LESSONS 第三節第 3 條）。

## 五、交付

1. 16 張 `art/card-<id>.png`、更新後的 `palette.json`、`pool_data.py` 的 `EXTRA_CARDS`、`embed_masks.py` 的路徑解析、六支建置腳本重跑後的所有產物。
2. `docs/clicker/REPORT-holo-round32.md`：每張卡的 id／名稱／稀有度／卡型／原始尺寸／輸出尺寸／去背手法與逐張的去背品質數字、卡型判讀理由、體積增量、每支驗收的真實 exit code、限制與未完成項（含 `怪物\` 未收）。
3. **逐張的去背前後對照圖**放 `docs/clicker/shots/round32/`，另外一張 63 張的接觸表（contact sheet）與三個尺寸的抽卡結果頁截圖。
4. 更新 `docs/clicker/TODO-next-round.md`；新踩到的坑追加到 LESSONS。
