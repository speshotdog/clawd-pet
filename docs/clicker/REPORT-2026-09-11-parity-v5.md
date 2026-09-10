# 執行回報 v5：更正與 `.subject-mask` 修復（2026-09-11）

`VERDICT-2026-09-11-parity-v4.md` 判 **EXIT 1**，並指出我一項回報錯誤。這份先把兩件事處理掉。

---

## 一、⚠ 更正：我的 A/B 結論寫錯了，舊回歸**有一項新增失敗**

我之前寫「`check_card_feel.py` 修改後 14 項 FAIL、HEAD 14 項、新增 0」。
**這是錯的。** 我的比對程式把巢狀節點也算進去，把 `checks` 這一層的差異蓋掉了。

從同兩份原始 log 重新解 `checks`：

| | FAIL 項目 |
|---|---|
| **HEAD（770af87）5 項** | `hover_travel_percent`、`hover_changed_0/1/2_percent`、`team_negative_bad_corners` |
| **修改後 6 項** | 上面五項 ＋ **`demo_nonfont_diff`** |

**新增的那一項是 `demo_nonfont_diff`**，來自舊守衛「demo.html 整檔凍結」——
本輪授權改了 `.face-rarity` 那行 CSS，`poolData`／`sceneData` 也被建置鏈重生，
所以 demo.html 不再與凍結基準逐位元組相同。**這是授權改動造成的守衛衝突，不是回歸**，
但它確實是「新增的失敗」，我不該講成新增 0。

其餘四支的 A/B 我是**遮掉數值後整份 log 文字比對**（強度較低，已在 v4 說明）：
`check_card_feel_clearance.py` 與 `run_card_feel_regression.py` 完全相同；
`check_round43_idle.py`／`check_round42_contracts.py` 只差絕對路徑（兩邊都是缺檔而失敗）。

## 二、`.subject-mask`：根因與你判斷一致，已修並複驗

**根因**：`build_round5_standalone.py` 收集完圖片參照後，對**整份 HTML 做純字串取代**，
把檔名換成 data URI——連 `<script id="mask-data">` 裡的 **JSON 鍵名**一起換掉。
`card_face.js:86` 是用原檔名查 `masks[key]`，查不到就不掛 `.subject-mask`，
四張場景卡（`rocketdog`／`astronaut`／`alienkitty`／`fluffdog`）因此少了圖內視差層。

**這是既有問題**：`git show HEAD:_art/holo-test/demo-standalone.html` 同樣缺這四個鍵
（HEAD 是 65 個鍵中 4 個變成 `data:`）。

**修法**（`build_round5_standalone.py`）：取代前先把 `mask-data` 區塊挖出來換成佔位符，
取代完再放回去。鍵名保持原檔名，值本來就是 data URI 不需要動。

**複驗**：
- `demo-standalone.html` 的 mask 鍵 **65 個全部是原檔名**，含 `layer-rocketdog-subject.png`。
- `check_card_assets.py`：`demo-standalone` 的層差異從 **2 項降到 1 項**，
  `.subject-mask` 已與參考一致。

## 三、剩下的一項層差異：`.card-back`

`demo` 與 `demo-standalone` 都比參考多一個 `.card-back`。
我查過 `card_face.js` **沒有**建立 `.card-back`，它是頁面層的標記
（demo.html 出現 8 次、抽卡與卡池各 4 次），是實驗頁自己的翻面樣本。

照你 ORDER 第 2 節「周邊 UI、卡片在頁面上的位置可不同」，這應該屬於頁面層差異；
但它掛在卡片裡面，**我不自己認定它合格**，請裁決。

## 四、目前狀態

| | |
|---|---|
| `parity-post7` 正式驗收 | EXIT 0（在獨立預期清單與必填 schema 之下） |
| 九種不完整資料的反例 | 全部 exit 1；未改動的對照 exit 0 |
| 四種注入負控制 ＋ 乾淨對照 | 4 紅 1 綠 |
| 卡內十三層樣式與幾何 | `pool`／`pool-standalone`／`gacha-test-standalone`／`team` 全部 0 差異；`demo`／`demo-standalone` 各剩 `.card-back` 一項 |
| 素材內在解析度 | 已列出並可追溯到建置參數（standalone 縮圖 600×840 → 420×588／360×504） |
| 舊回歸 | 七支跑過、與 HEAD A/B；**新增失敗 1 項＝ `demo_nonfont_diff`（授權改動造成）** |

⚠ `demo-standalone.html` 因為修了遮罩鍵而重建過，**這是本輪第三個手改的來源檔**
（`demo.html`、`team20.js`、`build_round5_standalone.py`）。

**沒有 commit。**
