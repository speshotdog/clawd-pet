# 三面卡面一致性：2026-09-12

## 做到什麼（附數值與截圖路徑）

本輪只驗抽卡揭卡、卡冊、隊伍編制七個入口；不把 demo／demo-standalone 納入驗收，不更動末世地圖的卡冊設計、導航或關卡區。沒有 commit。

量測端修正：

- 每張圖片都切換為 eager 並等待 `decode()`，包括 `complete` 已為 true 的圖片；decode／refit／paint 失敗保留階段、卡片或圖片索引及錯誤，判定器拒收失敗紀錄。
- 同尺寸中性化只取消卡片與祖先的互動姿態，將量測卡片放在一致的 viewport (40,40)，保留卡內設計 transform。實際瀏覽器負控制確認 `zhenzhen` 圖層仍為 `matrix(1, 0, 0, 1, 0, -20.7488)`，寶石仍保留 45° 與 Z=42 的 matrix3d。decode 與 refit 注入均被記錄且呼叫端拒絕；見 `shots/scope3/capture-controls.json`。
- 截圖改為擷取 viewport，再依 viewport 矩形裁切，避免把 viewport 座標誤當 page 座標。另隔離鄰卡、關閉文字選取，將位置對齊整數 CSS 像素，保留卡內變形。舊錯位的二元跳動，以及修正後的次像素對位問題，分開處理；没有重新追查箔面相位。
- 必填欄位檢查包含實際型別、非空字串、CSS 數值有限且正值、來源文字、有效內嵌字型與 glyph 數量、nameRange、完整詳情矩形、每批每槽 ID、原生／中性實例數量。來源清單仍從程式與卡池讀取。
- 比較所有正面子節點及每個節點的 `::before`／`::after`，保留完整漸層、遮罩、transform、幾何與混色。PNG／lossless WebP 以完整解碼像素識別相同內容；SVG 保留完整內容雜湊。缺入口、尺寸、角色、卡片、必要元件都會失敗。
- 全量量測與受控截圖記錄相同產物集的 SHA-256；截图本身也有 SHA-256。截圖可重現性另記採集工具雜湊，像素比較只接受同產物、同工具且通過重現性檢查的證據。
- 避免完整 base64 在每個層及偽元素重複傳輸：採集仍保留完整內容，但每個唯一 CSS 圖像只傳一次。65 張 DOM 卡的 compact 採集為 7.72 秒，`rocketdog` 全記錄與舊路徑完全相同；見 `shots/scope3/transfer-control.json`。CDP 仍逐文字節點查真實平台字型，使用 document root 與 requestNode 對應節點，不重複傳整份大型 DOM。

建置依 brief 指定順序執行。前九步成功，`build_map20.py` 初次在覆寫既有 `shots/team-round3/icon-check-cutout-pair.png` 時遇到 PermissionError，依規則停止。新增只控制證據輸出位置的 `--evidence-dir` 後，重跑最後一步成功；產物 5,984,408 bytes，證據位於 `shots/scope3/map-build/build.json`。字型重建產生 747 字元子集；本機 Chromium 為 136.0.7103.25。

最終量測為七入口 × 1440×1200／1024×900／390×844，共 21 組、1,920 筆卡片紀錄（原生與中性各 960 筆）。測試揭卡與卡冊每尺寸各覆蓋 63 張；正式隨機揭卡每尺寸各 10 個實例；編隊每尺寸 24 張卡的總覽與詳情各一份。3,840 個實際文字字型樣本中，非預期 fallback 為 0，頁面錯誤為 0。

正式判定器 exit 0：同尺寸屬性差異 0、幾何差異 0。素材工具 exit 0：960 筆完整元件比對差異 0（其中 63 筆為基準本身、897 筆為跨入口或跨尺寸比對）；基準固定為 `gacha-test@1440x1200`。完整漸層、mask、偽元素與卡內變形均在比較中。證據：[正式判定輸出](shots/scope3/report.log)、[素材判定輸出](shots/scope3/assets.log)、[元件明細](shots/parity/asset-layers-scope3.json)、[採集統計](shots/scope3/collection-summary.json)。

反例測試 exit 0：乾淨資料 exit 0；54／54 個破壞案例均由實際判定器子行程回傳 exit 1 並列出 FAIL，沒有把程式例外當作成功攔截。涵蓋原有 15 案及新增型別／空值／字型／批次／文字幾何／元件內容／來源與截圖雜湊等案例，原始量測檔 SHA-256 在測試前後不變。證據：[反例總表](shots/scope3/sabotage.log)、[機讀摘要](shots/parity/sabotage-summary-scope3.json)，各案完整輸出歸檔在 `shots/scope3/sabotage/report-sabotage-<case>.log`；既有歷史 log 已還原。

完整採集檔為 [parity-scope3-final.json.gz](shots/parity/parity-scope3-final.json.gz)，壓縮後逐位元驗證解壓內容與原始 JSON 相同；[壓縮大小與雜湊](shots/scope3/compression.json)。原生畫面截圖在 `shots/parity/shots/scope3-final/<entry>/<viewport>.png`，每張路徑與 SHA-256 都包含在量測檔；例如 [pool 手機](shots/parity/shots/scope3-final/pool/390x844.png)、[team 桌面](shots/parity/shots/scope3-final/team/1440x1200.png)。

重現性已通過後才進行本次像素判定：depth／framed／flat 三卡型，各七入口獨立擷取三次，加上 rocketdog 的編隊詳情與揭卡基準各三次，共 69 張圖、69 次兩兩比較，全部 mean=0、max=0；尺寸全部 520×728 且非空白。證據在 `shots/scope3/determinism/{rocketdog,chaichai,mieshi,rocketdog-detail}-result.json`。四份 gate 與四份正式像素 capture 的來源 358 個產物雜湊及採集工具雜湊均一致。另以實際 opacity=0 圖片測試確認截圖工具 exit 1，見 [空白反例](shots/scope3/blank-control.log)。

診斷歷程保留：第一份 full collection `shots/parity/parity-scope3.json.gz` 的判定為 exit 1，元件有 4,922 項矩形差異（樣式差異 0），兩個 pool 各有 41 項文字幾何差異。原因包含未顯示 `.floor` 的零矩形被減去不同頁面座標，以及大座標下 transformed DOMRect／Range 的浮點精度損失。統一量測位置後，24 組 desktop/mobile、三卡型、抽卡／卡冊／編隊總覽與詳情控制得到 0 差異；見 `shots/scope3/origin-control.json`。所有既有精度與門檻保持不變，沒有用增加容差處理。

重跑方式（在 `_art/holo-test`）：

```powershell
python check_card_parity.py --label scope3-final --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team
python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-scope3-final.json --reference gacha-test
python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-scope3-final.json
python check_card_assets.py
python check_shot_determinism.py
python shoot_card_parity_samesize.py --compare --out ../../docs/clicker/shots/scope3/controlled
python measure_standalone_cost.py
```

`check_card_assets.py` 使用同一份 full collection 的所有元件，不另跑只取第一张卡的採集。判定器、反例與素材工具亦可讀 `.json.gz`；若命令中的 `.json` 不在，會讀同名 `.json.gz`，不必還原大型 JSON。

## 未達成、未宣稱

完整三面視覺一致尚未宣稱通過。獨立重現性通過不代表跨入口像素一致；縮圖與重新編碼的差異必須獨立列出。

受控像素比較以 `gacha-test` 為基準，以下為 mean；粗體為超過 mean <1.0 的門檻：

| 入口 | depth：rocketdog | framed：chaichai | flat：mieshi |
|---|---:|---:|---:|
| gacha | 0 | 0 | 0 |
| gacha-standalone | **4.158001** | 0.885051 | **3.920499** |
| gacha-test（基準） | 0 | 0 | 0 |
| gacha-test-standalone | **4.158001** | 0.885051 | **3.920499** |
| pool | 0.000026 | 0.000021 | 0.000026 |
| pool-standalone | **3.575988** | 0.730209 | **3.330716** |
| team 總覽 | **2.306242** | 0.329673 | **2.114022** |

team 詳情另測 rocketdog，mean=2.306242，同樣未通過。總覽三卡型 21 筆中 8 筆失敗；另 2 筆詳情／基準比較中 1 筆失敗。兩個 gacha standalone 的 rocketdog 同時有 1.4436% 像素差值 >32，亦超過 1% 上限。這些是有效且可重現的失敗，沒有移動圖片做事後對位或放寬門檻。像素證據只覆蓋這三個代表卡型及一張詳情卡，未宣稱全卡池像素逐張相同。

七欄並排圖：[rocketdog](shots/scope3/controlled/rocketdog-all-entries-260px.png)、[chaichai](shots/scope3/controlled/chaichai-all-entries-260px.png)、[mieshi](shots/scope3/controlled/mieshi-all-entries-260px.png)。欄位由左至右依上表入口順序；[詳情對照](shots/scope3/controlled-detail/rocketdog-all-entries-260px.png) 左為 gacha-test、右為 team。每張的完整數值、來源與圖片 SHA-256 在同目錄 `<card>-capture.json`。

編隊的原圖雖是 600×840，建置仍以 quality 90 重新編碼。另量測一個 lossless WebP（method 6、exact=True）候選：卡圖 URI 合計增加 5,588,172 bytes，按現有 HTML 內容替換計算將為 11,572,580 bytes，超過原有 6,000,000 bytes 上限。這是逐資源編碼後的封裝大小計算，沒有宣稱另一次完整 map build 已通過；沒有為此降低其他素材品質、修改地圖配置或放寬 6 MB 上限。明細見 `shots/scope3/team-lossless-cost.json`。

跨入口受控像素門檻明訂為：逐像素 RGB 最大通道絕對差的 mean < 1.0、差值 >32 的像素占比 <1%，且亮度標準差 >8（排除空白或單色圖）。重現性也要求 520×728 的正確尺寸與亮度下限。這是本輪新增的明確像素判準，未放寬既有 mean <1.0 的重現性門檻或任何既有幾何／字級斷言。

完整正反面、實驗頁、地圖卡冊 UI、禮物卡、5.0 新卡、舊 hover／裁切與回歸守衛退役均不在本輪範圍；未把它們寫成完成。

## 要使用者裁決的（含第 4 件事的體積表）

沒有改動產品預設解析度或品質。新增 `--card-width`／`--output` 讓三個設定各自生成獨立 review 產物；pool 預設仍為 420×588／quality 84，兩個 gacha 預設仍為 360×504／quality 82。

以下是實際 HTML 檔案 bytes，包含全部內嵌資源，不是推估或圖片檔大小：

| 產物 | 現況 | 520×728 | 600×840 |
|---|---:|---:|---:|
| pool-standalone | 5,223,641 | 5,814,729 | 6,150,157 |
| gacha-standalone | 5,207,072 | 6,104,604 | 6,415,540 |
| gacha-test-standalone | 5,207,104 | 6,104,636 | 6,415,572 |

相較現況，pool 的兩個選項增加 591,088 bytes（11.32%）／926,516 bytes（17.74%）；兩個 gacha 產物各增加 897,532 bytes（17.24%）／1,208,468 bytes（23.21%）。

九份 HTML、各檔 SHA-256 與完整大小明細：`shots/scope3/standalone-options/sizes.json`。每個入口均提供 depth（rocketdog）、framed（chaichai）、flat（mieshi）在 260 CSS px／DPR 2 的三欄並排圖，檔名為 `shots/scope3/standalone-options/<card>-<entry>-options.png`；欄位順序是現況、520×728、600×840。

| 入口 | depth | framed | flat |
|---|---|---|---|
| pool-standalone | [對照圖](shots/scope3/standalone-options/rocketdog-pool-standalone-options.png) | [對照圖](shots/scope3/standalone-options/chaichai-pool-standalone-options.png) | [對照圖](shots/scope3/standalone-options/mieshi-pool-standalone-options.png) |
| gacha-standalone | [對照圖](shots/scope3/standalone-options/rocketdog-gacha-standalone-options.png) | [對照圖](shots/scope3/standalone-options/chaichai-gacha-standalone-options.png) | [對照圖](shots/scope3/standalone-options/mieshi-gacha-standalone-options.png) |
| gacha-test-standalone | [對照圖](shots/scope3/standalone-options/rocketdog-gacha-test-standalone-options.png) | [對照圖](shots/scope3/standalone-options/chaichai-gacha-test-standalone-options.png) | [對照圖](shots/scope3/standalone-options/mieshi-gacha-test-standalone-options.png) |

表頭是縮圖 bounding box；非 5:7 的原圖保留原始比例，不拉伸。三份 current review HTML 與產品檔案的 SHA-256 完全相同，見 `shots/scope3/production-defaults.json`。

需要裁決：pool 與 gacha 兩類離線版，各自保留現況、採 520×728，或採 600×840。600×840 同尺寸仍會重新編碼，不能把「解析度相同」寫成「像素相同」。本輪停在可檢視的成本與視覺證據，不擅自選定產品設定。

若要進一步要求編隊也使用完全無損的相同圖像，還需要裁決單檔封裝／既有 6 MB 限制的取捨；目前測得的 lossless 候選不符合該限制。
