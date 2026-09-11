# Astra 複驗裁決：技能挑選卡片化與拖曳

日期：2026-09-12。複驗對象：`holo-5.0`，HEAD `dcccdb0`；本輪提交範圍 `928d5ed..dcccdb0`（`HEAD~5..HEAD`）。

**最終裁決：EXIT 1，不接受 REPORT 的「全部按 ORDER 驗收完成」宣告。** 原因是 flat 拖曳卡型漏測，以及 over-slot 的 ghost 本身全被 SKIP；掃描器仍報 missing=0、零樣本必測=0。這不等於已證實產品有黑角，也不否定已通過的 picker／drag 功能測試。

複驗依 ORDER 第五節執行。所有 Python 測試工作目錄為 `_art/holo-test`，環境 `PYTHONIOENCODING=utf-8`；新證據寫入 `../../docs/clicker/shots/picker-drag/verify/<名稱>`。沒有改程式碼、build、commit、發布或覆寫原有證據。執行前工作區無 tracked diff；`verify` 原先不存在。

收尾發現瀏覽器另在工作目錄產生 `debug.log`，已移入 [verify/browser-debug.log](shots/picker-drag/verify/browser-debug.log)，沒有刪除。內容是 GPU `SharedImageManager::ProduceMemory` mailbox 錯誤；這是原生瀏覽器診斷，不冒稱整個執行期間零錯誤，也不直接據此推論產品有黑角。測試命令與頁面檢查的 exit／結果仍按實際值記錄。

## 一、逐條實跑與數字

下表輸出名稱均相對 `../../docs/clicker/shots/picker-drag/verify/`；前八列的完整命令為 `python <命令> --out ../../docs/clicker/shots/picker-drag/verify/<輸出名稱>`。各數字為本次實跑，除非明列「原證據」。

| 命令／輸出名稱 | exit | 本次數字 | 與 REPORT 宣稱值是否一致 |
|---|---:|---|---|
| `check_picker_drag.py --suite picker` → `picker` | 0 | 102/102、FAIL 0；三模式 × 三尺寸、24/24 可達；20 次開關後殘留 0 | 一致 |
| `check_picker_drag.py --suite drag` → `drag` | 0 | 113/113、160/160 指派；兩桌面選區字串空，清除前後 ROI 差分均 0；手機開窗 4/4、touch 技能變更 0 | 一致 |
| `check_picker_drag.py --suite negative` → `negative` | 0 | runner 4/4；fewer-cards／wrong-rank-ink／wrong-slot／real-selection 各 exit 1；真實選區 ROI 差分 0.6863339752 | 四個反例被拒一致；ROI 原約 0.67，本次數值不同 |
| `check_picker_drag.py --suite perf --channel chrome` → `perf` | 0 | 22/22；兩桌面拖曳三次全 60.0 fps，取樣各 89 間隔；picker 頂／底三次全 60.0；ghost 寫入 90／89 間隔、idle rAF 0 | 通過數、拖曳／picker fps 一致；baseline／退步百分比不同，見下表 |
| `check_card_corner_states.py --suite all` → `corners-chromium` | 0 | bundled Chromium 149.0.7827.55、SwiftShader；42 狀態、工具 missing 0、zero_valid_required 0、clean_bad 0、負控制 48 | 工具數字一致；ORDER 覆蓋不一致，flat 缺 10、over-slot ghost 被 SKIP |
| `check_team20.py --build-evidence ../../docs/clicker/shots/picker-drag/build/build.json --protected-before ../../docs/clicker/shots/picker-drag/before/protected-before.json` → `regression` | 1（預期） | 1098 PASS／6 FAIL／2 NEEDS_DEVICE／1 BASELINE；地圖回歸 248/248、missing 0 | 與 REPORT 最終回歸一致；相對它新增 FAIL 0、PASS 退步 0、缺斷言 0 |
| `check_card_corner_states.py --suite all --channel chrome --gpu d3d11 --dprs 1,1.25,1.5,2` → `corners-chrome` | 0 | Chrome 152.0.7977.84、RTX 3080 Ti D3D11；DPR 4/4、各 42 狀態；clean_bad 全 0、工具 missing／zero_valid 全 0；負控制 48／48／48／76 | 數字一致；每 DPR 的 ORDER 覆蓋仍不成立 |
| `check_card_corner_states.py --suite all --channel msedge --gpu d3d11 --dprs 1,1.25,1.5,2` → `corners-edge` | 0 | Edge 151.0.4129.101、RTX 3080 Ti D3D11；DPR 4/4、各 42 狀態；clean_bad 全 0、工具 missing／zero_valid 全 0；負控制 48／48／48／56 | clean_bad／DPR／exit 一致；DPR 2 負控制為 56，非 REPORT 的 48；每組仍有 ORDER 覆蓋缺口 |
| identity 同模組隔離輸出命令 → `identity` | 0 | 454 embedded card layers PASS | 一致；入口調整詳見下文 |
| `python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --reference gacha-test` | 0 | 對原有 7 入口 × 3 viewport 證據重判，FAIL 0 | 一致，但沒有重新擷取 parity |
| `python check_card_assets.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --output ../../docs/clicker/shots/picker-drag/verify/assets/asset-layers.json` | 0 | 960 comparisons、differences 0 | 一致 |
| `python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-picker-drag.json --out ../../docs/clicker/shots/picker-drag/verify/sabotage` | 0 | 56/56 破壞被擋；clean exit 0，每個反例 exit 1 | 一致 |

negative 子案例詳細值：少卡 visible=23（期望 24）；錯墨色 mean=63.5161213、over32=0.527664995、ink_same=false；錯格 `skills[1]=null`，另格卻有 alienkitty；各與原 REPORT 的失敗方向一致。四個子案例失敗斷言數分別是 1／3／2／1，這些是預期的反例，不是乾淨產品 FAIL。

效能 renderer 是 `ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Ti (0x00002208) Direct3D11 vs_5_0 ps_5_0, D3D11)`，有實際 renderer 證據，沒有將軟體 fallback 冒稱 GPU。

| viewport | 本次拖曳 fps 三次 | 本次 baseline 三次／平均 | 本次退步 | REPORT baseline／退步 |
|---|---|---|---|---|
| 1440×900@1.25 | 60.0／60.0／60.0 | 60.0／60.0／60.0；60.0 | 0.0% | 59.4／−1.08% |
| 1024×768@1.25 | 60.0／60.0／60.0 | 56.3／60.0／60.0；58.8 | −2.1% | 60.0／+0.01% |

回歸六個 FAIL 逐項保持：`team.protected_files_changed=1`（只有 `demo.html`）、`team-1440x900.overview_pointer_unchanged=0`、1440×900 與 1024×768 的 `proxy_animations=1`／`automatic_animations=1`。見 [regression-comparison.json](shots/picker-drag/verify/regression-comparison.json)。兩個 NEEDS_DEVICE 仍保留，不改 PASS。

三瀏覽器共九組 DPR 的本次獨立覆蓋稽核見 [corner-coverage-audit.json](shots/picker-drag/verify/corner-coverage-audit.json)：每組缺 flat 10 個狀態、四個 over-slot ghost 均出界 SKIP。Edge DPR 2 的負控制計數變動只代表不與原數值逐項相等；它仍滿足至少檢出一個故障的門檻，不據此宣告乾淨產品新增黑角。

完整命令、exit 與耗時見 [commands.json](shots/picker-drag/verify/commands.json) 及 [supplemental-commands.json](shots/picker-drag/verify/supplemental-commands.json)；各命令 stdout／stderr 存在 `verify/<名稱>.log`。

`check_card_identity.py` 原 CLI 固定覆寫 `shots/identical/identity.json`，沒有 `--out`。為遵守本次輸出隔離，沒有原樣執行該 CLI；以 `python -c` 呼叫原模組 `measure()`／`valid()`，保持同一判準，把結果寫到 `verify/identity/identity.json`。完整實際命令載於 supplemental-commands.json，不冒稱原 CLI 已原樣重跑。

### 獲准未重跑的項目

| 原命令／suite | 本次 exit | 實際讀取的既有證據與數字 | 與 REPORT 對照 |
|---|---|---|---|
| `check_picker_drag.py --suite pixels` | 未執行，無新 exit | [pixels/summary.json](shots/picker-drag/pixels/summary.json)：1599/1599、FAIL 0；72 組；216 個整卡／文字 ROI mean 最大 0、over32 最大 0；144 個重現 mean 最大 0；亮度 std 最小 59.3905 | 數量、門檻一致；這是讀證據，不是複驗重現 |
| `check_card_parity.py --label picker-drag --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team` | 未執行，無新 exit | [parity-picker-drag.json](shots/parity/parity-picker-drag.json)：7 入口、3 viewport、`artifactsUnchanged=true`；另有本次 report／assets／sabotage 實跑 | 原 REPORT 的 exit 0 為原執行結果；本次只重判既有採樣，未重新擷取瀏覽器證據 |
| `check_picker_drag.py --suite entry-pixels` | 未執行，無新 exit | [entry-pixels/summary.json](shots/picker-drag/entry-pixels/summary.json)：208/208、9/9 gate、63/63 比較；mean 最大 0.08597052、over32 最大 0、std 最小 59.38627；9 組 gateExit／pixelExit 均 0 | 與 REPORT 一致；未重跑 |

讀取證據的 SHA 與摘要保存在 [read-only-evidence.json](shots/picker-drag/verify/read-only-evidence.json)；數值彙整見 [old-pixel-metrics.json](shots/picker-drag/verify/old-pixel-metrics.json)。命令 5 不重建，僅稽核現存產物。

## 二、阻擋驗收的覆蓋漏洞

`check_card_corner_states.py` 的 `scan_drag()` 只從 `t.roster.slice(0,10)` 挑現有卡型，沒有準備 flat fixture。實際狀態只有 depth／framed。`run_all()` 又從 `drag_done` 產生 required 清單，因此缺 flat 的情況仍得到 exit 0、missing=[]。

ORDER 要求三種卡型 × 兩個桌面 viewport × 五個時點，應有 **30 個拖曳狀態／DPR**；目前只有 **20 個**。缺少 desk／tablet 的 flat：drag-start、drag-mid、drag-over-slot、drop-first-raf、drop-stable，合計 **10 個必測狀態／DPR**。前三個拖曳時點的 ghost 四角，flat 缺 **2 × 3 × 4 = 24 個角／DPR**。

原 REPORT 的 Chromium 1 組、Chrome 4 組、Edge 4 組，全都同樣缺這 10 個狀態，合計 **90 個狀態實例**，不是單次複驗環境造成。原證據獨立稽核見 [original-flat-coverage-audit.json](shots/picker-drag/verify/original-flat-coverage-audit.json)。

因此「42 個狀態」這個輸出數字可以重現，但不代表三卡型完整：42 是 20 個一般必測＋20 個拖曳＋gacha-pack＋注入負控制；若依相同清單補足 flat，應為 52 個記錄、其中 50 個必測。REPORT 的「三卡型全覆蓋／必測缺口 0」不成立。須在後續授權的修正中建立固定必測矩陣、確保 flat 可拖，並重跑；本次依指示不修程式。

**另一個獨立阻擋項：已跑的 over-slot 也沒有測到 ghost 的角。** 四個 depth／framed × desk／tablet 狀態都把第 11 號（零起算，即第 12 張）卡記為 `out of viewport (incl. background ring)`；這張就是 ghost，`occluded=false`。桌面 ghost 邊界 y=715～967，超出 900px 視窗底部；tablet y≈609.014～809.014，超出 768px 底部。儀器整張跳過，留下其他 11 張卡的 44 角，卻用全頁樣本數判斷必測非空。

因此每 DPR 的三時點 ghost 應有 72 角，實際只取到 depth／framed 起拖與中途的 **32 角**；flat 缺 24，over-slot 再缺 16，共缺 **40/72**。這些幾何上合理的 SKIP 必須保留，但不能用來通過 ghost 必測要求。原九組 DPR 也全部如此，見 [original-ghost-skip-audit.json](shots/picker-drag/verify/original-ghost-skip-audit.json)。後續需安排 ghost 完整可見的目標測例，並按 ghost 本身而非其他卡的總樣本判定覆蓋。

## 三、實際開圖觀察

以下皆是本次 `verify` 新產生的 PNG，已用看圖工具打開，不只讀 JSON：

- [桌面 picker](shots/picker-drag/verify/picker/1440x900-picker-skill.png)：彈窗中卡面有插畫、名稱、稀有度與邊框；背景遮罩正常，底部確認按鈕可見。沒有在這張截圖看到異常黑色角塊。
- [手機 picker](shots/picker-drag/verify/picker/390x844-picker-skill.png)：兩欄卡片、標題與關閉鍵可見，底部說明及確認按鈕留在彈窗內。靜態截圖本身不能證明捲動；24/24 可達由 picker 實跑斷言佐證。
- [drag-over-slot](shots/picker-drag/verify/drag/1440x900-drag-over-slot.png)：天外膠膠來源卡變暗，完整卡面 ghost 出現在技能格上方，目標格有外框提示；下緣超出視窗，因此不把視窗外的卡角算成有效目視樣本。
- [negative selection-on](shots/picker-drag/verify/negative/real-selection/selection-on.png)／[selection-off](shots/picker-drag/verify/negative/real-selection/selection-off.png)：on 的多張卡插畫與文字有明顯藍色選區，off 恢復原色。不是用另一張不相干卡面比較。ROI 差分 0.6863339752，反例確實被拒。
- [Chromium depth ghost 中途](shots/picker-drag/verify/corners-chromium/d1-drag-desk-depth-drag-mid.png)：宇宙冒險羊 ghost 清楚浮於卡列前方，姿態直立、文字完整，來源變暗；可見四角未見突出的黑塊。
- [Chromium framed ghost 中途](shots/picker-drag/verify/corners-chromium/d1-drag-desk-framed-drag-mid.png)：流浪玥手 ghost 可見，邊框與下方文字完整，四角未見異常黑塊。另開啟 [tablet framed 起拖](shots/picker-drag/verify/corners-chromium/d1-drag-tablet-framed-drag-start.png)：起拖位移小，ghost 與來源接近重疊，不拿這張單圖宣稱所有階段正確。

flat ghost 圖不存在，不能作目視通過宣告。本次沒有把成功／拒絕放下的斷言冒稱為已看過專屬截圖，也未檢視獨立黑角 mask 圖；上述觀察只涵蓋列出的 PNG。

## 四、REPORT 數字與證據修正

1. REPORT 命令 5 段寫 **11,687,285 bytes／6abfd111…**，但現存 `build/build.json` 與 `map20.html` 都是 **11,687,635 bytes**，SHA-256 **`2b55224b4d288bb7aaf3d69c11b57fa5a6a804c5f8240a48c1fd6cb2bf145b99`**，terrain quality **94**。REPORT 命令 9 的 bytes 才與現存最終產物一致。這是報告殘留舊值；現存 evidence／實體互相符合，且小於 20,000,000。見 [build-check.json](shots/picker-drag/verify/build-check.json)。
2. 「對施工前快照舊 PASS 退步 0」須限定基準。`before/snapshot.json` 保存的是歷史 **1104 PASS**，相對它有 **6 個 PASS→FAIL**，恰為 ORDER 允許保留的六項。不能把歷史快照與施工前另一次實跑 1097 PASS／7 FAIL 混寫。正確說法是「允許清單以外退步 0」，並分別報告與原 REPORT 最終回歸的比較。
3. negative 真實選區差分原報告約 0.67，本次 0.68633；perf 配對基準也有變動。門檻與判定一致，不主張每個量測值逐位相等。perf 執行期間另有 CPU 端 parity sabotage，沒有平行跑另一組瀏覽器掃描；只接受本次門檻結果，不把負退步百分比宣稱成產品效能提升。
4. 42 狀態與三卡型完整覆蓋並不一致，詳見第二節。REPORT 所述 48／44 是每張狀態圖全部卡面的有效角總數，不是 ghost 單張卡有 48／44 個角；over-slot 的 SKIP 是 ghost 出界，不是「附近一張被遮」。

## 五、字型與其餘待裁決事項

**命令 5 裁決：接受本次重建產物為新基準，不要求改回施工前 bytes。** 這裡的「施工前 HEAD bytes」明確指 `928d5ed`（目前 `HEAD~5`）的產物；現在 HEAD 已含重建產物，不能含糊地用 `git restore HEAD` 代表回到施工前。

親自以 fontTools 比對，Sans **240,556→240,448 bytes**，Serif **325,088→325,236 bytes**；各有 **739 cmap／1056 glyphs**，glyph order 相同。八個非 map20 HTML 去除 font data URI 後完全相同。

REPORT 的「只有 WOFF2 壓縮輸出不同」過於簡略：解壓後二進位表的 `head`、`GPOS`、`GSUB` 也不同；但完整字型表輸出成 XML，除了 `checkSumAdjustment` 外全部相同，GPOS／GSUB 解碼內容一致。這支持為序列化／編碼差異，不是字元、輪廓、字距或替換規則改動。依此接受字型重建，而非只憑 cmap 數量下結論。證據：[audit.json](shots/picker-drag/verify/audit.json)、[font-semantic-comparison.json](shots/picker-drag/verify/font-semantic-comparison.json)、兩份 `verify/*.woff2.diff.txt`。

此裁決只是接受重建產物；**不更新歷史 manifest，不把 `team.protected_files_changed=1` 改成 PASS**。`demo.html` 的差異仍保留在歷史證據中。

其餘 REPORT 第五節逐項裁決：

| 事項 | 裁決 |
|---|---|
| 使用者黑角回報 | 保持未結案；本環境未檢出不等於回報無效，且本次另查出 flat 漏測 |
| Tauri | 未實機驗收；Chrome／Edge GPU 通過也不能代替 |
| 手機 ≤700px／touch 沒有拖曳 | 接受，這是 ORDER 2.2 的既定範圍，維持點技能格開挑選器 |
| 技能來源／效果／戰力／持久化 | 不代為設計，保留待使用者決定 |

明列不替使用者決定的事：不宣告其黑角回報無效或已修復；不以 Edge 代 Tauri；不增加技能規則或重複限制；不調 lossless／地形品質／縮圖；不順便處理禮物卡字型、新卡、變種卡或退役歷史守衛；不上線、不發布 exe。字型 bytes 是本次明確委託 Astra 裁決的事項，已作決定，沒有退回給使用者。

## 六、Git 範圍與最終判定

`git diff --check` **exit 0、0 診斷**；`git diff --name-only` **exit 0、0 個 tracked 變更**。此外實際跑 `git diff --name-only HEAD~5..HEAD`：**exit 0，共 2628 個檔案**，完整清單見 [diff-name-only-commits.txt](shots/picker-drag/verify/diff-name-only-commits.txt)。

其中非 shots 檔案 23 個：產品來源 `team20.js`、`team20.css`、`map20.template.html`；測試檔 `check_picker_drag.py`、`picker_drag_suites.py`、`check_card_corner_states.py`、`check_card_corners.py`、`check_map20.py`、`check_team20.py`；`map20.html`；八個其他 HTML 產物；兩個 woff2；BRIEF／ORDER／REPORT 三份文件。`picker_drag_suites.py` 雖未逐字列在 ORDER 白名單，是被授權的六組 suite 實作拆檔，接受其範圍。八個 HTML／字型差異依第五節裁決接受。未見其他無關來源變更；初始工作區乾淨，沒有本次覆寫歷史髒檔的證據。

額外跑 `git diff --check HEAD~5..HEAD` 得 **exit 2，8794 個 trailing-whitespace 診斷、60 個檔案**（ORDER 的三個 Markdown 換行尾空白及證據 log）。見 [whitespace-summary.json](shots/picker-drag/verify/whitespace-summary.json) 與完整 [diff-check-commits.txt](shots/picker-drag/verify/diff-check-commits.txt)。不能以工作區檢查通過推論五個提交沒有空白錯誤；本次依指示不修改。

**EXIT 1 的必要理由是 flat 漏測，以及 over-slot ghost 零樣本被其他卡的樣本掩蓋。** 已通過的功能與數值結果保留；回歸允許的六項 FAIL 不冒充本次新增故障；字型重建已接受。REPORT 的建置舊值、基準說法及提交空白問題另行列明。未重跑的 pixels／parity 採樣／entry-pixels 按使用者本次例外明列，沒有冒稱新 PASS；使用者黑角與 Tauri 缺口繼續保留。
