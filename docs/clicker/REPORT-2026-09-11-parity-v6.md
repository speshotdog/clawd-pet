# 執行回報 v6：三包補完（2026-09-11）

`VERDICT-2026-09-11-parity-v4.md` 判 EXIT 1，列出五種新的假通過與最小三包。這份回報三包的結果。

⚠ **使用者已裁決先把前一份狀態 commit（`08eb0c6`）**，commit 訊息裡寫明
「Astra 仍判 EXIT 1，本次提交是使用者裁決先落地」，並且沒有宣稱完整 parity 通過、
也沒有宣稱七支回歸新增 0。本輪的補件在那之後。

---

## 一、第一包：五種新反例全部擋下，總共 **15/15**

| 反例（你示範的） | 現在 |
|---|---:|
| 錯誤採集證據消失（刪 `pageErrors`／`brokenImages`）| **exit 1**（27 FAIL） |
| 實例序號消失（刪 `instance`）| **exit 1**（27 FAIL） |
| 必驗設計欄位消失（樣式字典刪 `fontWeight`、`frame` 刪 `backgroundImage`）| **exit 1**（27 FAIL） |
| 固定揭卡證據只剩第一批 | **exit 1**（18 FAIL） |
| 中性姿態重複槽（換成第一筆深複本）| **exit 1**（3 FAIL） |
| `rarityClear.left` 改成 `NaN` | **exit 1**（3 FAIL） |
| 前一輪的九種 | 全部 **exit 1** |
| **未改動的對照** | **exit 0、0 FAIL** |

判定器的對應修法：

1. **固定序列改由原始碼推導**：期望序列＝`sorted(pool_data.pool())`，
   並檢查儀式批次數＝`ceil(63/10)=7`、揭卡序列逐位相符、
   以及「JSON 自帶的 `fixtureIds` 必須與原始碼一致」。
2. **錯誤採集欄位缺 key 就 FAIL**（不再把「沒有這個鍵」當成空清單）。
3. **樣式字典必須帶齊所有要比的鍵**（`TEXT_SAMESIZE`／`BOX_SAMESIZE` 逐鍵檢查），
   否則「差異 0」只是因為兩邊都沒有那個鍵。
4. **`instance` 必填**。
5. **中性姿態要與原生逐實例對應**：同一張卡在同一畫面有幾個實例、
   `shadowPath+instance` 是什麼，中性那趟必須一模一樣，不能整批換成同一筆的複本。
6. **非有限數值一律 FAIL**：遞迴掃整份紀錄，`NaN`／`Infinity` 直接擋（Python 的 json 會接受它們）。

反例全部寫進可重跑的 `check_card_parity_sabotage.py`（15 種＋乾淨對照）。

## 二、第二包：素材層擴到三尺寸與正式版抽卡，**全部 0 差異**

`check_card_assets.py` 現在：

- **三個尺寸**：1440×1200、1024×900、390×844。
- **正式版抽卡也納入**：走 `?ceremony-test` 的固定序列鉤子指定卡片
  （你說可以由測試端替換結果、不必改產品機率）。
- 層分成兩類：
  - **共用元件自己建立的十二層**（`card_face.js` 第 61–65、80–100 行建立的
    `.face-stock`／`.face-depth-bg`／`.face-art`／`.art-media`／`.art-media img`／
    `.subject-mask`／`.face-frame`／`.frame-material`／`.foil-stack`／`.foil-etch`／
    `.face-plate`／`.face-gem`）→ **樣式與幾何必須完全一致**。
  - **頁面自己加的層**（目前只有 `.card-back`）→ 只回報不判定。
    理由：全線只有 `demo.html` 會建立 `.card-back` 元素（元素建立的字串只在 demo.html 命中一次），
    `card_face.js` 從頭到尾沒有建立它，所以它是實驗頁自己的翻面樣本，
    屬於你 ORDER 第 2 節「周邊 UI 可不同」。**這是我的判斷，請裁決。**

**結果：九個入口 × 三個尺寸＝26 個組合（參考自己不算），元件層差異全部 0 項。**
（含 `demo`、`demo-standalone`、正式版 `gacha`、`gacha-standalone`。）

素材內在解析度逐尺寸都列了，並照你的要求**分開引用來源**：

| 入口 | 卡圖內在尺寸 | 建置參數來源 |
|---|---|---|
| `gacha-test`／`gacha`／`demo`／`pool` | 600×840（檔案） | — |
| `team` | 600×840（data:webp） | `build_map20.py` 不縮圖 |
| `pool-standalone` | **420×588** | `build_cards_remade_standalone.py:23`，`box=(420,588)`、quality 84 |
| `demo-standalone` | **360×504** | `build_round5_standalone.py:22`，`box=(360,504)`、quality 82 |
| `gacha-standalone`／`gacha-test-standalone` | **360×504** | `build_deluxe_b_standalone.py:23`，quality 82 |

⚠ 照你的裁決措辭：**縮圖與有損編碼足以解釋部分像素不等，不足以證明全部殘差都合理。**
我沒有宣稱像素層級一致。

## 三、`.subject-mask` 已修（見 v5）

`build_round5_standalone.py` 取代圖片參照前先把 `mask-data` 區塊挖出來，
避免整份字串取代把 JSON 鍵名換掉。修完 `demo-standalone` 的 65 個遮罩鍵全部是原檔名，
四張場景卡的 `.subject-mask` 回來了，元件層差異降到 0。

## 四、第三包：回報更正

- **A/B 我寫錯了，已更正**（v5 第一節）：`check_card_feel.py` 的 `checks`
  **HEAD 5 FAIL、修改後 6 FAIL**，新增的是 `demo_nonfont_diff`
  ——舊「demo.html 整檔凍結」守衛與本輪授權改動的衝突。不是「新增 0」。
- 相位歸因限縮成證據支持的範圍：`diag_foil_phase.py` 只證明
  **「三個時點零漂移、只有一次 `paint` 呼叫」**，也就是**沒有後續寫入**；
  像素殘差的完整歸因**不成立**，只確認縮圖與有損編碼是其中一部分。
- 其餘四支回歸的 A/B 強度是「遮掉數值後整份 log 文字比對」，不是逐項。

## 五、還沒做的

- 受控截圖的像素層級一致性（成因部分定位，未完全歸因）。
- 卡背的實際翻面實拍。
- `try{...}catch(e){}` 仍在收集端個別卡的 `refit`／`decode` 上，
  雖然頁面層 `pageErrors`／`brokenImages` 會 FAIL，個別卡的 refit 失敗仍可能被吞。
- 禮物卡／mtk 只有規格。
- 沒有退役任何過期守衛。
