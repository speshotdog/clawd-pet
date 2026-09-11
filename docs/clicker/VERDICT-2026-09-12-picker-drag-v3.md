**Astra 第三次複驗 VERDICT — 2026-09-12**

審查 HEAD：`4186eea9d08a71c9b83404695e7848e99611bcd4`。

**最後一個阻擋項解除；本次未發現新阻擋項。最終 EXIT 0。**

已讀指定 diff、第二次 VERDICT 與 REPORT 第五之二節。本輪未改程式碼、未 build、未 commit、未寫 VERDICT 檔；僅新增 `verify3/selftest/` 驗證證據。

**判定式與 AST 反例**

新判定式：

```python
required = list(REQUIRED_STATES) + drag_required()
```

30 個拖曳必測不再受 `drag_done` 是否為空影響。`has_drag` 保留作覆蓋資訊，不能取消必測。三個持有 ghost 的時點另要求 `ghost_cards == 1` 且 `ghost_valid >= 4`；缺少整筆狀態則由 `missing` 拒絕。

我從目前原始碼 AST 抽出未修改的判定式，以 `corners-chrome-v4` DPR 1 記錄在記憶體內重做三個情境：

| 情境 | required | missing | zero_valid | ghost_gap | drag_covered | ok |
|---|---:|---:|---:|---:|---|---|
| 完整記錄 | 50 | 0 | 0 | 0 | true | true |
| 移除 flat | 50 | 10 | 0 | 0 | true | false |
| 移除全部拖曳，`drag_done=[]` | **50** | **30** | 0 | 0 | false | **false** |

全缺拖曳時，`ghost_gap=0` 只是沒有可檢查的 ghost 記錄；**30 個 missing 已使整組失敗**。第二次複驗的整批漏測假綠反例不再成立。

**指定證據核對**

以下為現存 JSON 核讀；本輪沒有重跑三瀏覽器完整 suite。我也以目前 AST 重算各組判定，結果均與摘要一致。

| 證據 | DPR | 每組記錄／必測 | missing | 乾淨黑角 | 負控制檢出 | summary.ok |
|---|---|---|---:|---:|---|---|
| `corners-negctl-nodrag` | 1 | 22／50 | **30** | 0 | 48 | **false** |
| `corners-chromium-v4` | 1 | 52／50 | 0 | 0 | 48 | true |
| `corners-chrome-v4` | 1、1.25、1.5、2 | 52／50 | 0 | 0 | 48、48、48、56 | true |
| `corners-edge-v4` | 1、1.25、1.5、2 | 52／50 | 0 | 0 | 48、48、48、48 | true |

停用拖曳的負控制確實保留全部 50 個必測，缺的正是 30 個拖曳狀態；依目前返回邏輯為 EXIT 1，符合預期。

正式九組均確認：

- 每組拖曳 **30/30**、flat **10/10**。
- 每組 18 個持有 ghost 的狀態均恰好一張、四角有效，共 **72/72**。
- `zero_valid_required`、`ghost_gap`、ghost 整張跳過均為 0。
- 合計 **270 個拖曳狀態、90 個 flat 狀態、648/648 ghost 有效角**。
- 每組 ghost 遮擋排除角 76；前次明列的保守排除限制仍保留。

記錄的 renderer：Chromium 149 為 SwiftShader；Chrome 152、Edge 151 為 RTX 3080 Ti D3D11。數字與 REPORT 第五之二節相符。

**親自執行 self-test**

於 `_art/holo-test` 設定 `PYTHONIOENCODING=utf-8` 後執行：

```text
python check_card_corner_states.py --self-test --out ../../docs/clicker/shots/picker-drag/verify3/selftest
```

**程序 exit 0，13/13 通過**：乾淨誤報 0、四個單角故障檢出 4/4、零樣本 SKIP 1/1，其餘 DPR、遮擋及傾斜案例符合預期。各案例狀態、樣本數、故障角與跳過原因均與 `corner-selftest-3` 相同。

新增 ghost 案例的原始逐角資料也已核對：鄰卡 TR 記為 `occluded by drag ghost`、不計有效樣本；ghost 自己四角全部有效，總有效樣本 7、黑角 0。這補足了前次缺少的 ghost 遮擋專屬自檢。

**整輪總結論與保留事項**

技能挑選卡片化＋拖曳設定，依既有驗收與本次補驗，**可通過本輪 ORDER 範圍驗收**。前兩次指出的 flat 漏測、over-slot ghost 靠他卡樣本充數，以及整批拖曳取消必測，均已解除。

黑角掃描在所列環境與狀態中未檢出乾淨黑角，故障注入可被檢出，覆蓋缺漏亦會失敗。這支持掃描器與本輪覆蓋通過驗收；**使用者原始黑角回報仍未結案**。

本次不代使用者決定或宣告：

- 原始黑角問題已消失；仍需對應畫面、卡名、DPR 與執行環境重現。
- Tauri 實機已通過；Chrome／Edge 證據不替代 Tauri，既有 `NEEDS_DEVICE` 保留。
- 新增手機／touch 拖曳；沿用 ≤700px／touch 點格開挑選器的既定範圍。
- 技能來源、效果、戰力計算與持久化規則。
- 上線、發布或產出 exe。

既有六條回歸 FAIL 不因本次 EXIT 0 改成 PASS。字型重建產物沿用前次已接受的裁決，不更新歷史 manifest；REPORT 第六節仍寫「等 Astra 裁」屬文件殘留，不另構成阻擋。

結束時無 tracked 變更，`git diff --check` 無診斷；工作區僅新增 `docs/clicker/shots/picker-drag/verify3/`。**最終 EXIT 0。**