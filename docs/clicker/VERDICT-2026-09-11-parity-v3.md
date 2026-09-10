**裁決：維持 EXIT 1，這一輪不可 commit。** 原四種假通過確實修掉了，但我用同樣的記憶體破壞方式，找到五種新的假通過；完整卡面驗收也仍未完成。

我實際重跑了 JSON 判定、讀取原始 logs／程式碼、核對產物雜湊與內嵌字型，並查看七入口並排圖。**沒有跑 build、Playwright 或重新拍圖，也沒有修改檔案。**

**1. 假通過重驗**

現行判定器重跑結果：

| 證據 | 我的結果 |
|---|---|
| post6 | EXIT 0，0 FAIL |
| 原四種 sabotage | EXIT 1，分別 1／6／6／3 FAIL，與回報一致 |
| neg3 clean | EXIT 0，0 FAIL |
| neg3 mono／epic-accent／wrap／drop-card | EXIT 1，分別 4／1／6／5 FAIL |

但以下五種**各自從原始 post6 複製後單獨破壞**，仍全部得到 **EXIT 0、0 FAIL**：

| 新反例 | 可重現的修改 |
|---|---|
| 預期清單跟著缺卡縮水 | 刪除 `expectedPoolIds` 的 `rocketdog`，再刪掉 `pool` 三尺寸、兩姿態的全部 rocketdog 樣本 |
| 幾何物件存在，實際欄位消失 | 對 `pool` 所有樣本，把 `rarityClear`、`nameClear` 改成 `{"missing":true}`，刪除 `lineGap`、`gemOverlapArea` |
| 十連只剩同一槽的複本 | 對 `gacha` 各尺寸、各姿態，取第一筆樣本複製十次，替換該姿態全部樣本；保留原 activation |
| 固定抽卡完全未完成 | 對 `gacha-test` 各尺寸的 `activation.ceremony`，將每批 `complete` 改成 `0` |
| 詳情全部在視窗外 | 對 `team` 所有 `role=="detail"` 的樣本，將 `inViewport` 改成 `false` |

這些修改不需要改判定器，也不需要改比較結果。

第一個最關鍵：[expected_manifest()](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity_report.py:51) **仍直接讀待驗 JSON 的 `expectedPoolIds`／`expectedTeamIds`**。所以回報「不看輸入，而從資料來源反推」不符合判定端實作。收集端從來源產生清單，不等於判定端有獨立清單。

其他原因也很直接：schema 沒驗內層鍵；幾何缺值仍跳過；抽卡只算筆數，沒把實例／槽位與結果序列連起來；固定抽卡沒核對完成數；詳情的 `inViewport` 沒參與判定。

另外，**neg3 不能稱為「乾淨參考」**：JSON 記錄顯示 `gacha-test` 本身也被注入。`epic-accent` 的 FAIL 範例仍是 mythic 的 `mieshi`／`qinghua`；drop-card 則是每批刪一張，共刪七張固定抽卡。退出碼正確，不代表負控已證明指定缺陷能被可靠辨識。

**2. 第五節：本輪要解決，不能另案**

要完成的是**可信的受控卡面一致性驗收**，不是無條件要求每個像素差都等於零。這本來就是 [ORDER 的完成條件](/D:/claude研究/clawd-pet-50/docs/clicker/ORDER-2026-09-11-parity.md)，不是新增範圍。

現在也不能斷言只剩箔面相位：

- [中性化程式](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:344) 仍以全域 `*` 清除 transform／scale／rotate／translate／perspective，會消掉卡內設計，例如 `zhenzhen` 的 `translateY(-6%)`。
- 七入口並排圖中，`pool-standalone` 有明顯位置／裁切差異，不能全部解釋成材質亮度變化。
- 幾何比較仍把已是 px 的 Range 寬高及無量綱的行數乘上 260；上一輪指出的量綱問題還在。

最短查法：

1. **只固定外部傾斜、選取放大與互動位移，保留卡內設計 transform。** 幾何依各欄位原始單位比較。
2. 在測試端包裝 `HoloCardFace.paint`，記錄目標卡的參數、呼叫來源與時間；比較 `paint(0,0)` 後、雙 rAF 後、截圖前的 `--phase`、`--fx/--fy`、`--gx/--gy` 等值。先證明到底有沒有後續寫入。
3. 同時記錄捲動位置與卡片矩形，關閉平滑捲動並確認矩形穩定後裁圖。現行腳本反覆 `scrollIntoView()`，不能只靠等 300ms 認定裁切已固定。
4. 同入口重拍確認控制穩定，再跨入口比。剩餘差異逐層定位；**不能把全卡差異直接當作箔面噪聲豁免。**

**3. 第六節四件事，逐件裁決**

| 項目 | 本輪裁決 |
|---|---|
| 角色／背景、遮罩、箔面、偽元素、卡背實際渲染 | **要補。** 合併到上述完整卡面驗收，不另開一套工程。 |
| round43／round42 缺歷史檔 | **不要求本輪重造歷史檔或修復整套舊測試。** 明列無法執行；受本輪重建影響的現行入口仍須有有效證據。另更正：round42 缺的是 `round42/portable/deluxe-gacha-b.html`。 |
| A/B 解析 | **要補，但只需正確解析既有 logs。** `check_card_feel.py` 的 `checks` 是修改後 **6 FAIL、HEAD 5 FAIL**，新增 `demo_nonfont_diff`；「14 vs 14、新增 0」仍錯。這是授權修改觸發的守衛差異，可說明，不必為湊綠改產品。 |
| 黑角負控根因 | **根因修復可另案。** 保留「HEAD 同樣失效、負控尚未成立」，不能當作黑角驗收通過；本輪卡框／裁切由有效受控渲染證據驗證。 |

禮物卡／mtk 維持另案，不需本輪重建。

**4. 第七節的事實修正**

雖然本輪不准 commit，訊息草案仍有幾點可先更正：

- 九份內嵌字型確實一致：**240,448／325,236 bytes，各 739 cmap**。這點我直接解碼核對過。
- 兩份 test 產物的 **9 個 ID 變更、遮罩 +5**，以及 demo-standalone **遮罩 +16**，證據有列出。
- **漏了 demo 與 demo-standalone 各新增 16 個卡片 ID 的資料同步。**「demo 一行 CSS」只能描述手改 CSS，不能概括整份檔案差異。
- 「三支工具＋截圖一支」應列清楚：收集器、判定器、`write_card_parity_calibration.py`，以及截圖器。
- 雜湊值與目前檔案相符，但 `raw_bytes_CRLF` 標籤不準：九份中只有 demo 含 CRLF，其他八份是 LF。
- 維持禁止宣稱「完整 parity 通過」「七支回歸新增 0」。

**最小可交付清單只有三包：**

1. **判定器補洞**：獨立預期清單、內層 schema、槽位／序列／完成數與詳情可視性；上述五反例全部非零，乾淨對照仍通過，負控保留未污染參考。
2. **修正量測並完成既定卡面證據**：保留卡內 transform、修量綱、固定相位與裁切，交三尺寸及既定素材／效果／卡背覆蓋；捕捉並回報 refit／decode 例外，不能繼續吞掉。
3. **更正回報**：從既有 logs 正確列 A/B、缺檔與舊負控限制，補齊資料同步範圍。

**不要求修所有歷史測試、不要求追完舊黑角根因，也不加入禮物卡工程；但這三包補完前，本輪不可 commit。**