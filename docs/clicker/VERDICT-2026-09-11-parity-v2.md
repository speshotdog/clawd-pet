**裁決：維持 EXIT 1，本輪不可 commit。**

有幾項確實修好了，但「每條都修完」「乾淨負控制」「A/B 新增失敗 0」不符合原始證據。更關鍵的是：**我已用現有判定邏輯重現缺入口、缺卡、缺全部手機詳情仍 EXIT 0。**

我沒有執行 build、Playwright 或瀏覽器操作。以下來自原始碼、Git HEAD／工作樹、JSON、logs、三張既有截圖，以及唯讀 Python 解析。我對假通過的測試只修改記憶體中的 JSON 副本，沒有改檔。

**1. 上輪缺口逐條裁決**

| 缺口 | 本輪核對 |
|---|---|
| 揭卡儀式 | **取樣流程已修。** test 確實走 `openPack → skipAll → ready`，核對 `results`、完成數與逐位 ID；post5 的序列證據成立。 |
| 正式版也要揭開 | **已有改善且有畫面佐證。** 我看的正式版桌面截圖已是十張正面；但正式分支只斷言 `screen`，沒有強制 `complete=10`、DOM 十槽與 `drawnIds` 逐位相符。 |
| 手機詳情 | **本次有取到。** `select(id,true)` 已修；390px 原生資料有 24 筆 detail，全部 `visible=true`、`inViewport=true`；截圖也有開啟浮層。但判定器仍不強制這 24 筆存在。 |
| 角色誤標 | **本次標記已修。** 每尺寸原生編隊為 overview 24、detail 24。中性資料仍重複收初始總覽，每尺寸 58 筆，合計 **174，非回報的 177**。 |
| `pool-` 前綴 | **已修。** demo 正式卡現在進入比對，每入口共 189 筆中性正式卡。 |
| `visible` 判準 | **部分修復。** 有 `checkVisibility`，但 `inViewport` 不参与判定，也未驗祖先裁切、遮擋與文字本身隱藏。 |
| CDP node ID | **已修。** 原生文字樣本保留 node ID，缺 ID 會 FAIL。 |
| 必填項影響退出碼 | **未修完整，有可重現假通過。** 詳見下段。 |
| 1.04 綁狀態 | **部分修復。** 已限制 `selectedState`，但漏判編隊純 hover；產品 CSS 接受 `.team-proxy:hover`，收集器只查抽卡 hover 和 `aria-selected`。也没有驗選取時應有的縮放。 |
| decode／refit／載入錯誤 | **未修。** `decode().catch(()=>{})`、refit 空 catch 仍在，沒有 broken-image、console、pageerror 的完整失敗判定。 |
| 完整卡面、素材與效果 | **未完成。** 回報自己列出的角色、背景、遮罩、箔面、偽元素、卡背，仍是 ORDER 必驗項，不能靠縮小宣稱範圍免驗。 |

相關實作：[收集器](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:148)、[判定器](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity_report.py:97)。

**2. 完整性仍是假通過**

我將 post5 載入記憶體，使用現有報告判定邏輯，得到：

| 記憶體中的破壞 | 實際結果 |
|---|---|
| 刪掉整個 `pool` 入口 | **EXIT 0** |
| 刪掉 pool 全尺寸 rocketdog 的原生＋中性樣本 | **EXIT 0** |
| 刪掉編隊所有尺寸的全部 detail | **EXIT 0** |
| pool 全部標不可見，清掉字級變數及部分必填幾何 | **EXIT 0** |

原因很明確：

- 預期入口預設取自 `list(entries)`，預期尺寸也取自輸入自己的 `viewports`。
- 沒有先核對各入口／角色／槽位的預期樣本完整清單。
- 幾何值缺失直接 `continue`；不可見或沒字級變數只是 note。
- 抽卡缺 `ceremony` 直接跳過；報告也沒有自行檢驗 `complete`。
- 收集器末尾本身固定 `return 0`，不能把它的退出碼當驗收結果。

因此本輪必須補的是**獨立預期清單與必填 schema**，不是再加幾條「目前有收到資料」的 PASS。

另外，post5 原始 log 和我重判都是 **321 PASS、0 FAIL**，不是 319。這只能表示目前判定器沒報錯。

**3. 幾何方向正確，但全域清除姿態不可接受**

回到未變形 content-box、取消原先混合樣本的校準帶，方向正確。問題在 [SAMESIZE_JS](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity.py:343)：

**它不是單純固定外部姿態，而是依 CSS 特異性，任意消掉部分卡內設計。**

原始 JSON 的 `rocketdog` 已直接證明：

| 元件 | 原生 | 中性 |
|---|---|---|
| frame | `translateZ(24px)` 的矩陣 | `none` |
| plate | Z=13 的矩陣 | **仍保留** |
| gem | 45°旋轉、Z=42 的矩陣 | **仍保留** |

原因是 `* !important` 能蓋過普通宣告，卻蓋不過更高特異性的 `!important`。所以「所有 transform 已關乾淨」不成立。

另一方面，本輪需要驗的 `zhenzhen .art-media { transform:translateY(-6%) }` 是普通宣告，會被測試關掉。**該驗的角色位移被消除，測試當然無法證明它同步正確。** 判定器又完全不比較 transform。

修法應是：

- 明列外部姿態載體，只固定其傾斜、互動位移與選取縮放。
- 保留卡內設計 transform、素材構圖及圖層關係。
- 保存並驗證固定前後的相關 computed 值。
- 補同尺寸卡面裁圖；目前截圖在還原後才拍，沒有中性卡面視覺證據。

另有量綱錯誤：[幾何判定](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_parity_report.py:250) 將除交疊面積外的所有數值差都乘 260，連**原本就是 px 的 Range 寬高、無單位的行數**也乘。只有已除卡寬的 gap／clearance 才應乘回去。這主要會製造假失敗，也表示「全部使用 0.011px 門檻」的說法不正確。

**4. 四種負控制仍未合格**

原始 JSON 和原始碼都顯示：

- `epic-accent` 沒有限定 epic。
- 同時污染 `gacha-test` 參考。
- 編隊更換卡片、重建 shadow root 後沒有重新注入。
- 沒有逐實例命中清單，只有 root 數。
- drop-card 仍是抽卡每批刪一張，共七張。

`report-neg2-epic-accent.log` 的 44 項差異包含 mythic 的 `mieshi`、`qinghua`，正是污染參考與漏注入造成的差異。

`report-neg2-drop-card.log` 也**不是揭卡序列不符**：儀式 ID 序列仍完整。它報的是 team 找不到兩張參考卡；沒有證明預期 DOM 缺卡本身會 FAIL。

以**目前**判定器重判四份 JSON，FAIL 數為：

| 控制 | 現在重判 | 舊 log |
|---|---:|---:|
| mono | 5 | 4 |
| epic-accent | 2 | 1 |
| wrap | 7 | 6 |
| drop-card | 2 | 1 |

多出的是 1.04 狀態判定失敗。證据與最終量測器版本不一致；必須以最終版本、乾淨參考、確定命中的候選樣本重新收集。

**5. 舊回歸 A/B：分類必須更正**

[regression-ab.json](/D:/claude研究/clawd-pet-50/docs/clicker/shots/parity/regression-ab.json) 沒有抽出真正的失敗集合。它列的 14 個 font 路徑不是 `checks` 中的 FAIL；對其他多支則輸出空集合。

我直接解析兩邊 logs：

| 腳本 | 核對結果 |
|---|---|
| `check_card_feel.py` | **修改後 6 FAIL，HEAD 5 FAIL**；新增 `demo_nonfont_diff`。可分類為授權修改碰到凍結守衛，不能寫新增 0。 |
| `check_card_feel_clearance.py` | 裁切失敗情況相同。1.04 在 1024／390px 分別約 **1.251%／1.549%** 裁切，仍是既有未解問題。 |
| `check_gacha_followup.py --sizing-only` | 兩邊 log 都記錄尺寸測試通過。 |
| `check_gacha_card_regression.py` | 兩邊都是 441 pairs、結構及 name-fit failures 0、12 flows。 |
| `check_round43_idle.py` | 兩邊都缺 `round43/portable/before-cards.html`，屬於**未能執行驗證**。 |
| `check_round42_contracts.py` | 缺的是 **`round42/portable/deluxe-gacha-b.html`**，回報寫錯路徑；同樣未能完成驗證。 |
| `run_card_feel_regression.py` | 兩邊確實相同：1098 PASS、6 FAIL，另有 **2 NEEDS_DEVICE、1 BASELINE**。 |

可以說「已完成的檢查未見新增產品行為失敗，新增一項授權修改造成的守衛失敗」。**不能說七支失敗集合完全一致，也不能把兩支啟動失敗當成已覆蓋相關回歸。** 舊 gacha 腳本也沒有補進這次重建的 test 入口。

`team_negative_bad_corners=0` 的分類尤其要撤回：

[注入器](/D:/claude研究/clawd-pet-50/_art/holo-test/check_card_feel.py:48) 確實只走第一層 shadow root，但 [產品](/D:/claude研究/clawd-pet-50/_art/holo-test/team20.js:25) 的 overview／detail 就位於那一層，建立器也確實產生 `.card-face`。因此所述條件**不能解釋漏注入**。

目前只能判成：**HEAD 已存在的無效負控制，根因未證實**。需補注入命中、偽元素 computed style、合成／裁切及取樣區證據，才能定位。

**6. 重建差異仍漏列**

我直接解出兩份 test HTML 的完整卡片 JSON，比對 HEAD：

- 仍是 **9 個 ID 內容變更，不是 5 個**。
- 五張卡涉及 kind／名稱，四張 depth 卡另新增 `scene:true`。
- palette 變更涉及 `liulangyueshou`、`xiaochouyue`、`jintianwoshengri`、`miepuxiong`、`bianbiancaihua`。
- `rebuild-diff.json` 只保留 name／rarity／kind／file，因而漏掉 scene 與 pal。
- 素材尺寸、alpha／輪廓、卡背及受控渲染對照仍未补齐。

可確認保留的成果是：九份主線字型 payload 一致，Sans／Serif 分別 **240,448／325,236 bytes、739 cmap**；九份 `product-hashes.json` 都吻合工作檔。`rebuild-diff.json` 的 demo 雜湊則使用 LF 正規化結果，需註明，不能與原樣 bytes SHA 混稱。

**重新送驗前的必要補件**

1. 修預期入口、尺寸、角色、槽位及必填欄位檢查，讓上述四種記憶體負例全部非零退出。
2. 修中性姿態的作用範圍與幾何量綱，保留卡內設計，補受控卡面圖。
3. 用最終量測器重做乾淨參考的四種負控制。
4. 補素材／效果及 test 入口回歸；兩支缺檔測試須補可執行證據。
5. 更正 A/B 解析、黑角根因分類、九個 ID 全欄位差異與報告數字。

**字型補齊與 epic shadow 作用域修正可以保留；本輪整體驗收尚未完成，不可 commit，也不能在 commit 訊息寫「完整 parity 通過」或「七支回歸新增 0」。**