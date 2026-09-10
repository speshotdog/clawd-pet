**裁決：本輪不可 commit。** 九種既有反例確實修好了，但判定器仍有假通過路徑；完整卡面驗收尚未成立。`.subject-mask` 的原因我已查出，應在本輪修正。

我已讀兩份報告、原始碼、JSON、logs 與既有截圖；用唯讀、記憶體替換輸入的方式重跑判定函式，沒有修改檔案、跑 build、Playwright 或重新截圖。

**1. 判定器仍會讓不完整資料通過**

實測 post7 與 clean 都回傳 `0`；九種 sabotage 都回傳 `1`，FAIL 數與回報一致。

但以下修改**各自從原始 `parity-post7.json` 開始**，仍全部回傳 **0、0 FAIL**：

| 反例 | 可重現的 JSON 修改 |
|---|---|
| 錯誤採集證據消失 | 刪除所有 viewport 記錄的 `pageErrors`、`brokenImages` |
| 實例序號消失 | 刪除所有 card 記錄的 `instance` |
| 必驗設計欄位消失 | 所有 card 的 `nameStyle`、`rarityStyle` 刪除 `fontWeight`；`frame` 刪除 `backgroundImage` |
| 固定揭卡證據只剩第一批 | `fixtureIds` 保留前 10 項；兩個 `gacha-test*` 入口各 viewport 的 `activation.ceremony` 只保留第一批；cards 不變 |
| 中性姿態重複槽漏驗 | `gacha` 各 viewport 中，同一 canonicalId 的所有 neutral 記錄，都換成該 ID 第一筆 neutral 記錄的深複本；native、activation 不變 |

第四例的精確修改：

```python
d["fixtureIds"] = d["fixtureIds"][:10]
for name in ("gacha-test", "gacha-test-standalone"):
    for rec in d["entries"][name]["viewports"].values():
        rec["activation"]["ceremony"] = rec["activation"]["ceremony"][:1]
```

原因集中在[判定器](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity_report.py:132)：固定序列仍取自待驗 JSON；schema 只要求部分設計欄位；缺錯誤清單被當作空清單；槽位身分混用座標，且 neutral 沒有逐實例對應。

另測得 `pool` 的 `rarityClear.left` 全改成 `NaN` 也通過。這不是標準 JSON，但 Python 預設解析器接受；數值欄位應拒絕非有限值。

**2. 像素差原因：縮圖成立，完整歸因不成立**

建置參數可以確認，但要分開引用：

- `pool-standalone`： [build_cards_remade_standalone.py:23](/D:/claude研究/clawd-pet-50/_art/holo-test/build_cards_remade_standalone.py:23)，420×588、quality 84。
- `demo-standalone`： [build_round5_standalone.py:22](/D:/claude研究/clawd-pet-50/_art/holo-test/build_round5_standalone.py:22)，360×504、quality 82。
- 抽卡 standalone： [build_deluxe_b_standalone.py:23](/D:/claude研究/clawd-pet-50/_art/holo-test/build_deluxe_b_standalone.py:23)，360×504、quality 82。

`asset-layers.json` 的圖片內在尺寸符合這些來源。**縮圖與有損編碼足以解釋部分像素不等，不足以證明全部殘差都合理。**

相位證據確實顯示四入口三時點相同，支持「這次受控觀察沒有相位漂移」。但原始 JSON 的呼叫數是 **1、1、1、2**，team 不是一次；兩次都來自測試端中央 paint。工具按 ID 過濾，沒有區分總覽／詳情實例，因此也不能宣稱逐實例都已查完。

裁切方面，我對現有 PNG 重算 RGB 平均絕對差與 ±2 像素位移搜尋，確認位移能明顯降低 demo／team 差異；但**位移改善不等於已證明非整數裁切是唯一原因**。目前沒有與各張 PNG 綁定的穩定矩形／捲動紀錄。

更關鍵的是，[並排圖](/D:/claude研究/clawd-pet-50/docs/clicker/shots/parity/samesize/rocketdog-all-entries-260px.png) 的 `pool-standalone` 仍有明顯構圖、框線及銘牌位置差異。同長寬比縮圖本身不能解釋銘牌移位。這可能涉及截圖與量測版本不同，或量測漏項；現有證據無法定案。`gacha-test-standalone` 也不能稱為「純重編碼雜訊」，因為它同時縮圖。

**3. 十三層樣式／幾何一致，不算完整卡面驗收**

我重算了 JSON 比較，四個入口零差異、demo 一項差異、demo-standalone 兩項差異，數字正確。但這只能證明**被採集的欄位一致**：

- [中性化程式](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:354) 仍用 `*` 清除所有 transform 等屬性，卡內設計差異會先被抹掉。
- [素材工具](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_assets.py:55) 每個 selector 只取第一個元素；多處 `.foil-stack`／`.foil-etch` 並未全部驗。
- 未比較完整背景／漸層、mask 內容、必要偽元素及素材 alpha／輪廓；同解析度也可能是不同素材。
- 只有 rocketdog、單一 1440×1200；正式抽卡兩入口跳過，卡背未實拍。
- 工具只遍歷成功採集的入口；漏入口不會自動列 FAIL。

這些都是原 ORDER 既定要求，不是要求新增「逐像素零差」。

**4. 兩條收窄範圍的裁決**

- **`inViewport`：接受長格線不必同時全在窗內；不接受目前實作代表詳情完整可見。** [收集器](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:163) 只驗矩形與視窗相交，露出一小角也是真。詳情應驗完整包含；卡面截圖則逐張確保完整入鏡。「至少一張在窗內」只能作基本可見性檢查。
- **槽位唯一性：接受座標檢查只用 native；不接受 neutral 免驗實例完整性。** 位置可重疊，身分不能消失。用穩定實例鍵連接兩姿態，核對每槽 ID 與批次；不要用座標代替身分。

**5. `.subject-mask`：本輪修，根因已找到**

[build_round5_standalone.py:42](/D:/claude研究/clawd-pet-50/_art/holo-test/build_round5_standalone.py:42) 的全頁：

```python
html = html.replace(ref, uri)
```

也替換了 `mask-data` 的 JSON **鍵名**。

我直接解析確認：

- demo 有 `layer-rocketdog-subject.png` 鍵。
- standalone 沒有該鍵，卻有以相對應圖片 data URI 為鍵、遮罩值完全相同的項目。
- 共四個鍵受影響：`rocketdog`、`astronaut`、`alienkitty`、`fluffdog`。

[card_face.js:81](/D:/claude研究/clawd-pet-50/_art/holo-test/card_face.js:81) 仍以原檔名查 `masks[key]`，因此不建立 `.subject-mask`。這是可定位的建置錯誤，不能當作解析度取捨。修替換範圍、保留資料鍵即可；瀏覽器修復結果仍需你補跑。

**6. commit 前最小清單：三包**

1. **補判定完整性**：上述反例全部擋下；固定序列由獨立來源建立並連到實際批次／槽位；必验欄位、錯誤採集結果與有限數值不得缺；詳情驗完整入窗。
2. **修量測與遮罩，補既定卡面證據**：保留卡內 transform、修正仍存在的 Range／行數乘卡寬問題、記錄 refit／decode 例外；修四個 mask 鍵；補三尺寸、正式抽卡、各素材效果實例及卡背。正式抽卡可由測試端替換結果，不必改產品機率。截圖須與量測同批產出，解釋 pool-standalone 的構圖差異。
3. **更正回報**：相位呼叫數與像素歸因改成證據支持的範圍；A/B 仍未改對——我讀取兩份原始 `check_card_feel.py.log`，`checks` 是 **修改後 6 FAIL、HEAD 5 FAIL，新增 `demo_nonfont_diff`**。`14 vs 14、新增 0` 沒有涵蓋這組檢查；說明授權修改造成的守衛差異即可。

**以上三包完成並重新驗收前，不可 commit。**