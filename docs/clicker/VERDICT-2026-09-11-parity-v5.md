**結論：以目前證據，「編隊與抽卡的卡面設計一致」仍不成立，尚不能寫成已驗收通過。** 已確認的成果是文字／框板等既有量測通過，以及 rocketdog 的三尺寸、九入口指定素材欄位一致；完整素材、效果與實際構圖仍有證據缺口。`08eb0c6` 是使用者已裁決的提交，本次不重設 commit 禁令。

我讀了兩份報告、相關原始碼、JSON、logs 與既有並排圖。唯讀重跑採記憶體替換輸入，只略過 stdout 包裝，保留判定邏輯；**沒有跑 build、Playwright 或重新截圖，也沒有寫檔。**

原有 **15 種反例全部回傳 1，乾淨對照回傳 0**，FAIL 數與 logs 相符。未壓縮 JSON 與 gzip 解出的內容相同。

**1. 仍可重現的假通過**

以下每例都**獨立從原始 post7 開始修改**；實測正式判定器 `main()` 均回傳 **0、0 FAIL**：

| 反例 | 精確修改方式 |
|---|---|
| 錯誤採集仍可變成未知 | 每個 viewport 記錄設 `pageErrors = null`、`brokenImages = null`。 |
| 必驗樣式只有鍵、沒有值 | 所有 cards 的 `nameStyle.fontWeight`、`rarityStyle.fontWeight`、`frame.backgroundImage` 都設為 `null`。 |
| 文字與字型證據一起消失 | 所有 cards 刪除 `nameText`、`rarityText`；其 `platformFonts` 各文字角色的 `fonts` 設為 `[]`，保留 `nodeId`。 |
| 揭卡批次與樣本脫鉤 | 所有 cards 刪除 `batch`；另測兩個 `gacha-test*` 的 cards 全設 `batch = 0`，也通過，儀式七批不變。 |
| 卡名幾何完全缺失 | `team` 所有 cards 設 `nameRange = []`。另測 `{ "w":9999, "h":9999, "lines":99 }` 並設 `nameFits = "false"`，也通過。 |
| 非有限值藏在 CSS 字串 | `pool` 所有 cards 設 `rarityFsVar = "NaNpx"`。這是合法 JSON，現有非有限數值掃描不會抓到。 |
| 詳情只露一條邊 | `team` 各 viewport 的 native/detail 設 `box.y = 視窗高度 - 1`、`inViewport = true`，其餘不變。 |

根因不是再少列幾個鍵而已：

- [schema 檢查](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity_report.py:226) 未完整驗型別與有效值；部分非字典直接跳過內層檢查。
- 字型驗收依賴輸入文字是否為空；文字本身卻非必填。
- 批次序列與 cards 沒有逐批、逐槽連接；卡名 Range 沒進入幾何比較。
- `px()` 解析後仍須驗有限值；可見性須從矩形判定完整包含。

補充：**原始 post7 的三尺寸編隊詳情矩形，我實際重算都完整在視窗內。** 最後一例是判定器漏洞，不是指目前詳情已經被裁掉。

素材判定也仍能漏入口。我在記憶體執行[原始比較區段](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_assets.py)，結果：

| `asset-layers.json` 修改 | 回傳 |
|---|---:|
| 不修改：26 次比較 | 0 |
| 刪除全部 `team@…`：23 次比較 | 0 |
| 只保留 `gacha-test@1440x1200`：零次比較 | 0 |

這是重跑比較區段，**不是重跑瀏覽器採集**。目前檔案確實有完整 27 組；但工具遇到採集失敗會跳過，缺組不會阻止通過。

**2. `.card-back` 的裁決**

**可將它排除於本次「已揭開正面設計一致」的判定；但把它稱為周邊 UI，理由不成立。**

[demo.html:651](/D:/claude研究/clawd-pet-50/_art/holo-test/demo.html:651) 把它插進 `.card-inner`，並提供真正的翻面操作。抽卡也有卡背，只是載體叫 [`.veilback`](/D:/claude研究/clawd-pet-50/_art/holo-test/ceremony.js:109)，其 [CSS](/D:/claude研究/clawd-pet-50/_art/holo-test/ceremony.css:53) 使用相同的 `cardback/deluxe-back.webp`。

所以應按**正面／背面與實際用途**劃界，不能按「是不是共用建立器產生」劃界。卡背翻面實拍不列為這次正面結論的阻擋項；完整正反面 parity 則仍未驗收。

**3. 真正影響結論的剩餘缺口，壓成兩包**

1. **讓判定器驗的是完整、有效、可對應的樣本。**  
   補上述型別／空值／文字字型／批次與幾何漏洞，素材入口缺漏必須失敗；採集端留下 refit／decode 失敗結果。這些直接決定目前的「零差異」是否可信。

2. **補能證明实际正面設計的同批證據。**  
   [中性化程式](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:354) 仍以 `*` 清除卡內 transform；素材工具仍只量 rocketdog、第一個同名層與第一個同 ID 卡，未分開編隊總覽／詳情，也未比較完整漸層、mask 內容、必要偽元素及素材輪廓。須保留卡內設計變形，覆蓋不同卡型／效果與實例，並讓量測及受控截圖綁定同一份產物。

第二包還有兩個具體證據問題：

- 我重新看過[既有並排圖](/D:/claude研究/clawd-pet-50/docs/clicker/shots/parity/samesize/rocketdog-all-entries-260px.png)，`pool-standalone` 的構圖、框線與銘牌位置差異仍在，不能用同長寬比縮圖直接解釋。**不要求逐像素零差，但這種設計層級差異必須定位。**
- post7 記錄的 `demo-standalone.html` 雜湊為 `ffad12d7b35de536`，目前檔案為 `e4d3a71177fbd8b1`。目前 65 個 mask 鍵及四個修復鍵已確認存在，但舊全量結果不能直接代表修復後產物。

禮物卡／mtk、退役舊守衛及已授權 commit 都不列入這兩包。A/B 的 **HEAD 5 FAIL、修改後 6 FAIL** 更正正確；相位原始資料仍是 **1、1、1、2 次 paint**，v6 的「只有一次」尚未完全改對，但這項文字更正本身不構成正面設計的阻擋。