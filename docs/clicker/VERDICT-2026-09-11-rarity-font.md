**EXIT 1：本輪尚不可 commit。裁決選 A，本輪補齊卡名字型；保留 poolData 同步，但必須補驗並揭露其他重建差異。**

我已親自讀取原始碼、Git diff、量測腳本、before/after JSON、check log 與兩張對照圖，並以唯讀 Python 重算 JSON、解碼 WOFF2／cmap。**沒有跑 build 或 Playwright，也沒有修改檔案。**

以下涉及瀏覽器渲染、CDP 與互動的項目：**這條我沒辦法自己驗，只能核對你交的數字。**「數字符合」不等於我親自重測通過。

**1. 第三節數字對第四節門檻**

| 原門檻／回報 | 核對結果與裁決 |
|---|---|
| 預期卡片缺漏 0，每張各 1 個卡名、稀有度 | JSON 所收錄的卡確實各有 1 個節點。但腳本沒有從資料與狀態建立預期清單，且缺卡池頁、standalone／test 驗收。**完整性未通過。** |
| 稀有度第一字族 100% | JSON 中 demo 81、抽卡 1、編隊 11 × 三尺寸全部符合。**已收錄樣本通過。** |
| 真正字型 fallback glyph 0 | JSON 彙總確實只有 `Noto Sans TC`，但取樣有漏洞，**全量門檻未通過**，詳見下文。 |
| 稀有度字串缺字 0 | 我直接解碼 cmap，核對五階完整中英字串及分隔符，缺字確實 0。九份主線 HTML 的 Sans／Serif 均為 233,748／317,200 bytes、726 個映射。**靜態通過。** |
| 字級變數誤差 <0.011px | 重算有效樣本，最大 **0**。**有效樣本通過；不是所有卡都通過。** |
| 主副標比例誤差 <0.011px | 最大 **0.005625px**，回報四捨五入為 0.0056 正確。**有效樣本通過；隱藏詳情尚未驗。** |
| 80／102／290px 不縮字樣本 | 本次證據沒有這組結果。**未驗。** 原始碼常數未變不能代替實測。 |
| 102px、100 個 W，下限 4.64276px、`nameFits=false` | 本次證據沒有。**未驗。** |
| 非目標樣式變更 0 | 依你目前以 ID 合併的比較法，demo 65、編隊 10 的六項樣式確實零差異；抽卡共同 ID **0**。**部分通過，整體未通過。** |
| 最大寬增 +11.166px | 重算吻合，但僅代表目前共同卡的 Range 比較。**數字正確，不是視覺驗收通過。** |
| 不超過 90% 卡寬 | **自行新增的門檻**，原指令沒有批准；不能取代左右淨空、行距、裁切及寶石交疊。 |
| 字族負控制 | 腳本與 log 支持「11 個節點變 monospace、移除後恢復」。但未讓同一套正式驗收器實際報錯退出。**局部證據成立，完整負控制尚缺。** |
| 視覺校準 | 尚無三尺寸完整樣本、淨空／行距／交疊與壞樣本驗證。**未通過。** |

你自行排除的兩項，我的裁決如下：

- **390 編隊隱藏詳情：允許在隱藏狀態不套幾何門檻，但不允許永久免驗。** 它的 `20px／9px` 前後相同，確實不是本輪新回歸；仍須實際開啟手機詳情、完成 refit，再驗比例。原要求包含總覽與詳情。
- **line-height：撤掉無條件排除 px 的規則。** 我讀到 before／after 全部都是 `normal`，本次根本没有你說的 computed px 變動。現有共同樣本連 line-height 一起比較也為零差異；保留 `normal` 與實際字高增加是兩回事。

**2. 「實際平台字型」目前不能判全量通過**

[probe_font.py](D:/claude研究/clawd-pet-50/docs/clicker/shots/rarity-font/probe_font.py) 有四個關鍵缺口：

- `toIndex: min(n, 80)`：demo 搜到 **95 個稀有度結果**，最多只取 80 個，未覆蓋全部 81 張正式卡。
- 搜尋 `.face-rarity` 沒有限定正式 `.hcard`，結果數與正式卡數不一致。
- 只留下 familyName／glyphCount，**丟掉 `isCustomFont`**，無法证明用的是內嵌字型。
- CDP 失敗直接跳過；驗收器甚至可能把空 fonts 當成 fallback 0。

另外，「fallback 從 **810** 降至 0」不是表格的一致總計。例如 before 1440 三頁相加為 **689＋9＋125＝823**，390 為 **812**。應按頁面／尺寸列值，不要混成一個總數。

**3. poolData：保留，理由已獨立核對**

[update_demo_data.py](D:/claude研究/clawd-pet-50/_art/holo-test/update_demo_data.py) 的確會回寫 demo，而且不只處理 poolData，也處理 sceneData。

我核對結果：

- poolData：**43 → 59 筆**。
- 原 43 筆：**刪除 0、內容變更 0**。
- 新增 16 筆全部來自現有 `EXTRA_CARDS`。
- 新 poolData 與 `pool(with_scenes=False)` **完全相等**。
- JSON 中 demo：**65 → 81 張**，差額一致。

因此保留這次同步；還原會讓 demo 再次偏離資料來源，下次相同建置又會重生。這不是新增 5.0 卡，但提交描述必須明寫「同步既有 16 張研究線卡片」，不能再稱整份 diff 只有字族一行。

**4. 選 A：完整執行順序與新驗收條件**

我直接解碼確認 **9 個卡名缺 13 字**：

`丑、今、堡、扁、日、沙、流、浪、熊、菌、送、領、鴿`

上一輪「不用重製字型」只適用稀有度字串，沒有涵蓋同步後的卡名；這個範圍判斷需要修正。

先修正量測腳本並保存目前候選版證據。接著在 `_art/holo-test` **逐條執行，非零即停**：

```text
python update_demo_data.py
python build_round4_fonts.py
python build_round5_standalone.py
python build_cards_remade.py
python build_cards_remade_standalone.py
python build_deluxe_b.py
python build_deluxe_b_standalone.py
python build_deluxe_b.py --test
python build_deluxe_b_standalone.py --test
python build_map20.py
```

**不能省掉 `build_round5_standalone.py`**；它負責更新 demo-standalone。正確說法是「先同步資料、重製字型，再跑原八條」，不是「其餘七條」。

新增／補齊的驗收條件：

1. **字型覆蓋：**九份主線 HTML 的卡名與稀有度實際字串缺字均為 **0**；字型 payload 同步。以字串覆蓋驗收，不硬訂新 cmap 數量。禮物／mtk 本輪另案，明列仍有空字型。
2. **實際字型：**逐正式卡、逐文字節點保留 ID、畫面角色、`isCustomFont`、glyphCount；取消 80 上限。缺節點、CDP 錯誤或可見文字沒有字型證據均 FAIL；卡名與稀有度非預期 fallback 均 **0**。
3. **完整樣本：**三尺寸固定卡 ID，涵蓋五階、三卡型、長名及九個缺字卡名；覆蓋卡池與所有交付入口。編隊以「ID＋總覽／詳情」區分，手機詳情必須開啟測量。
4. **尺寸：**保留原 `<0.011px`、`0.5625`、80／102／290px 與 100W 壓力門檻。字型補齊會影響卡名寬度與縮字，必須重測。
5. **樣式與幾何：**遞迴處理 shadow roots，等待字型後 refit；記錄未變形 content-box，固定姿態與動畫時點。非目標 CSS 零變更；因缺字修補導致的實際縮字差異逐卡列出。
6. **視覺：**補三尺寸同卡樣本，實測行數、Range、左右淨空、兩行距離、裁切與寶石交疊；依原指令完成樣本認可及校準，移除任意 90% 門檻。正式檢查器在負控制下須退出非零，恢復後退出 0。
7. **可重現證據：**腳本改讀交付目錄或明確參數，不能依賴個人 Temp 路徑；保存各建置／測試命令的實際退出碼及產物雜湊。保留原 before，另存 A 修補後結果。

**5. 漏掉的回歸風險**

最重要的是，Git diff **還有你第二節沒有揭露的同步內容**：

- demo-standalone 的 **mask-data、assetMap、卡背 data URI** 改變，並新增 depth 底板規則。
- 抽卡 test 產物新增 **本草珍目位移、卡包 hover／浮動／呼吸動畫、拖曳與點擊抑制邏輯**，也更新資料與遮罩。

這些可能是舊產物追上既有來源，但確實是本次交付的行為／素材變更。**必須補列並跑相關現有回歸；不能用「沒有手改來源」宣稱產物沒動動畫或卡背。**

此外：

- 編隊 `rocketdog` 出現兩次，以 ID 建字典會吞掉一張。
- 抽卡三尺寸 before／after 全是不同 ID，現在的「共同卡 0、差異 0、PASS」是假通過。
- 顯式 refit 只遍歷 document，沒有遍歷 shadow roots。
- 對照腳本除 family 外還強制 weight 400、letter-spacing `.14em`，且重新取 rect、未固定動畫；兩張 DPR=2 放大圖只能作候選示意，不能代替受控量測。
- 字型建置同時更新 Sans／Serif；需核對兩份字型，不能只盯 Sans。`fonts.check(Serif)=false` 本身仍不足以判壞。

**EXIT 1 — 不可 commit：先完成 A、修正漏驗與假 PASS、補齊尺寸／視覺及重建副作用回歸證據，再送驗。**