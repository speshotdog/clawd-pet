# 第三十一輪報告：圖層、回正、蓄力與召喚陣

2026-09-09，`holo-cards`，工作區 `D:\claude\clawd-pet-holo`。
已先讀 brief 第 0 節文件與完整 LESSONS，再實作 A–E。五支必跑驗收最終均 **exit 0**。沒有修改 `src/`、`card_face.js`、`pool_data.py` 或 RATE，沒有 push，沒有 commit。

產物：[dev](../../_art/holo-test/deluxe-gacha-b.html)、[standalone](../../_art/holo-test/deluxe-gacha-b-standalone.html)。兩支 builder 已依序重建，各次退出碼均為 0。Standalone 也實際複製至 [另一資料夾](shots/round31/portable/index.html) 再開啟驗證。

## A：先重現，再修圖層

保留改動前的 [baseline-round31.html](../../_art/holo-test/baseline-round31.html)。最小重現由 `check_gacha_layers_round31.py --reproduce` 執行，exit 0；每 50ms 比較實際畫面與同時刻關閉 canvas 的畫面，再單獨把 upper 的 z-index 從 4 降至 1 作對照。

| 改前量測 | 首個完成後取樣 | 卡內差異 bbox（相對取樣區） | 只降低 upper 後 |
|---|---:|---|---|
| legendary | F+1250ms | `[37,64,401,434]` | bbox None |
| mythic | F+1600ms | `[96,162,291,347]` | bbox None |

真正量到的是：`completeSlot()` 移除 `is-revealing`，slot 從 z-index 10 回到 2，仍存活的 upper canvas（4）便畫到卡上。沒有把它誤寫成 rays 路由錯誤：rays／底光仍在 lower，沒有修改其路由或減粒子。

正式修正把 upper 降至 1。另為 brief 的「整個卡面 rect」契約補上 canvas／flash 的矩形排除：側面翻牌與圓角含透明空隙，單靠堆疊仍會看見後方光。排除區依當前卡面 rect 更新，並換算成每張 canvas 的局部座標。這也涵蓋 lower 繼承共用 `.under` 規則而產生的 22px 上邊距；保留原有光場位置，沒有移動卡片或推高卡面 Z。

最終檢查包含 F+0 至 F+4100ms、每 50ms 一組、兩階 × 兩入口，共 **332 組同幀對照**。檢查每個完整像素，包含圓角、翻牌側面、完成後、hover／selected；四組資料的最大 RGB 差異皆 **0**。早期使用 3px 內縮的重現只用於定位原因，沒有拿來取代最後的完整矩形驗收。

| 高階光效 | round30 峰值 → 本輪 | round30 持續 → 本輪 |
|---|---:|---:|
| legendary | 223 → **223** | 1600 → **2200ms** |
| mythic | 255 → **255** | 1950 → **3350ms** |

兩入口一致。沿用原版對照的固定卡外 ROI、Pillow L／P95 與「底色 P95+40」門檻。黑底使本輪底色約為 2（round30 為 24）；低階原始 P95 現為 49／49／42，效果參數未降低，且均通過原版 33／33／37 門檻。高階另以 round30 的 223／255 與 1600／1950ms 作更嚴格斷言。

證據：[改前量測](shots/round31/before-A-measurements.json)、[改前](shots/round31/before-A-legendary.png)、[完成後修正畫面](shots/round31/dev-after-A-legendary-2500.png)、[dev 數據](shots/round31/dev-A-summary.json)、[portable 數據](shots/round31/portable-A-summary.json)。

## B：外環使用平面堆疊，卡片保留內部 3D

直接把 anchor 推至 Z=42 的試作仍會與旋轉中的 flip 相交，形成直切缺口，因此未採用。最終把**外層 slot** 設為 flat，anchor 在 Z=0 的前方平面；shell／card-lift 的內部 preserve-3d、透視、卡面幾何及字級保留。後方光仍由 canvas／charge-glow 承擔。

環沒有 perspective 祖先；實測補償倍率是 **1.000**，不需要猜測縮放公式。所有被檢查的效果與卡面局部 translateZ 絕對值均不超過 42px。

| 環／取樣點 | 改前外徑／線寬 | 改後外徑／線寬 | 差 |
|---|---:|---:|---:|
| legendary substrate，F+100ms | 474／12px | 474／12px | 0／0px |
| mythic spectrum，F+120ms | 516／12px | 516／12px | 0／0px |

dev／portable 都一致。量外徑時真正移除 shell 的繪製，避免子卡的 inline `visibility:visible` 穿過父層 hidden 而污染參考。環與卡相交的角度區段逐區確認有**正向亮度增加**，沒有被卡切斷的缺口；沒有加不透明白棒或銘牌背板。A 的 canvas 檢查同時成立。

證據：[改前](shots/round31/dev-before-B-legendary.png)、[改後](shots/round31/dev-after-B-legendary.png)、[dev 量測](shots/round31/dev-B.json)、[portable 量測](shots/round31/portable-B.json)。

## C：原生時間的回正像素驗收

pointerup／pointercancel／pointerleave 使用 280ms 阻尼回正，衰減為 `(1-p)^4`，無過衝。角度和 `paintFoil` 光位由同一個有限 rAF 更新；取消與重入共用既有 ownership。移除 card-lift 繼承的第二段 transition，避免角度落後光位。再次按下立即取消回正並承接當下角度；雙擊與 Esc 回正保留。提示改為「拖曳轉動 · 放開自動回正」。

互動測試改用**原生瀏覽器時間**，避免把 WAAPI 虛擬時鐘誤當 CSS hover transition 的時鐘。以白色 `foxfriend` 隔離選取藍色與卡圖顏色，保持相同 selected 狀態：

| 90×90 拖曳、放開、等待 400ms | dev | 搬移 standalone |
|---|---|---|
| `ImageChops.difference(...).getbbox()` | None | None |
| selection rangeCount | 0 | 0 |
| 藍色像素比 | 0 | 0 |
| 200ms 中斷後接手 | 當下角度相等，續移 10px 得 ±2° | 同左 |

證據：[dev 前](shots/round31/dev-C-before.png)、[dev 後](shots/round31/dev-C-after.png)、[dev 資料](shots/round31/dev-C.json)、[portable 資料](shots/round31/portable-C.json)。

## D：高階蓄力、閱讀與尾韻

legendary／mythic 增加 900／1300ms 蓄力，21Hz 左右的抖動只施加在 reveal-shell，上限為 ±2.5px／0.8°、±4px／1.2°；神話末段加強，最後 120／160ms 同時收束抖動與底光。後方金／冷白光漸強至約 60／70% 的設定峰值。既有 `CeremonyAudio.charge()` 已含漸強低頻與充能聲，因此直接接入，沒有新增素材或改掉首次靜音規則。

READ 改為 1400／1900ms，RETURN 保持 320／360ms；新增 rays 的 hold 為 2.2／2.8s、fadeOut 為 1.0／1.2s，flash 為 2.25／2.85s。原版粒子、峰值與 rays 的 4s 上限不變。

**no-preview 的改寫是使用者本輪裁決**：common／rare／epic 的 13 個 pre-F 時點仍逐像素零差，兩入口共 78 幀；legendary／mythic 在 pre-F 的反向差異斷言成立。不是刪掉舊測試，也不是自行放寬。

十連 fixture＝mythic＋9 common 的固定時間如下，起點為 entry：

| 事件／檢查點 | 新時間 |
|---|---:|
| 發牌完成／首張 charge | 1750ms |
| 首張 F | 3370ms |
| pre-face／post-face | 3369／3371ms |
| 首張 return 起點／中途檢查 | 5270／5350ms |
| 首張 complete | 5630ms |
| 最後一張 charge | 12350ms |
| last-before／last-after | 12349／12351ms |
| 最後一張 F／return／complete | 12670／12970／13190ms |

`check_reveal_timing.py` 的另一個 fixture＝9 common＋mythic，保留原本相對發牌完成的 last-before／after 7559／7561；front 改為 9181，return 改為 11170（絕對時間 10931／12920ms）。

實際 event 時戳量得 charge→F 為 **1220／1620ms**，三尺寸、兩入口均符合。另以原生音效開啟狀態驗證實際時距與 voices；skipAll／Esc 後 181ms 檢查所有資源為 0、無 rarity-fx、可收下。為避免 WAAPI `finished` 晚一個 render frame，skip 的完成現在由既有可取消的 180ms timer 決定，再取消 fade。16ms 取樣的額外驗收同時檢查 slot 及 shell，三尺寸均無交集。

證據：[DE](shots/round31/dev-DE.json)、[原生充能與清理](shots/round31/dev-native-charge.json)、[蓄力 400ms](shots/round31/dev-D-mythic-1440-400.png)、[800ms](shots/round31/dev-D-mythic-1440-800.png)、[1200ms](shots/round31/dev-D-mythic-1440-1200.png)。

## E：背景與效能

背景改為近黑底、同心細環／點列／對稱破環、菱形刻度、四芒星、垂直光軸、四層透視橢圓與倒影。`ceremony-background.svg` 是自行寫的幾何，builder 直接內嵌；沒有第三方圖檔、字型、影片、three.js 或 npm 相依。

[研究與授權判斷](RESEARCH-gacha-background.md) 記錄三個實際開啟的 GitHub repository、stars、技術與 LICENSE 查證。GeoPattern 的 MIT 原文已驗證；另兩個 LICENSE 打不開，明記未驗證且未引用。最終沒有複製任何第三方程式碼或 SVG 路徑。

背景只用 28 秒 CSS 呼吸，focus-held 停動畫並降亮度；background-paused 與 reduced-motion 保留。待機三秒的 rAF 呼叫為 **0**，reduced-motion 的背景 animation 為 **0**。另外三次原生 CDP 取樣，三秒 main-thread TaskDuration 平均由 **1.074ms → 2.212ms**，增量約 0.038% 單核心時間，屬相同低負載等級；此數據不代表整台電腦或 GPU 的總用量。

Standalone 為 **5,146,465 bytes**，相對 round30 記錄的 5,142,068 增加 **4,397 bytes**，低於 +204,800 上限。手機召喚陣 bbox 約 x=12.675、寬=364.650px，完整位於 390px 視窗內，沒有壓扁或半圈裁切。

證據：[1440×900](shots/round31/dev-E-1440.png)、[1024×640](shots/round31/dev-E-1024.png)、[390×844](shots/round31/dev-E-390.png)、[CPU](shots/round31/background-cpu.json)、[體積與 SHA-256](shots/round31/artifact-manifest.json)。

## 第 3 節驗收表對照

| # | 結果 |
|---|---|
| 1 | 332 組完整卡面 rect 對照，max RGB difference=0；含完成後／hover／selected |
| 2 | 高階峰值 223／255，持續 2200／3350ms，均達 round30 門檻 |
| 3 | 環在卡內有正向亮度增加，交集角度區段無缺口 |
| 4 | 兩階環外徑與線寬差皆 0px |
| 5 | 被檢查層的局部 translateZ 絕對值 ≤42px |
| 6 | 兩入口原生 400ms 回正：bbox None、selection 0、blue ratio 0 |
| 7 | 200ms 重入角度連續，續拖偏移正確 |
| 8 | 低階 pre-F 零差；兩高階反向差異成立 |
| 9 | event 時距 1220／1620ms；另有原生時鐘驗證 |
| 10 | 三尺寸、兩入口，16ms 取樣 slot／shell 交集皆 0 |
| 11 | charge 中 skip／Esc，180ms 完成契約與資源清理通過；含開啟音效 |
| 12 | +4397 bytes；idle rAF=0；reduced-motion 背景 animation=0 |
| 13 | 下列四支保留驗收皆 exit 0 |

## 真實退出碼與失敗歷史

命令省略共同前綴 `python _art/holo-test/`。

| 必跑驗收 | 實際 exit |
|---|---:|
| `check_gacha_layers_round31.py` 完整兩入口 | **0** |
| `check_gacha_ceremony_round30.py` 完整 layout／core／pixels | **0** |
| `check_gacha_card_regression.py` 完整：329 組卡面、12 flows、固定時序 | **0** |
| `check_demo_round8.py` | **0** |
| `check_demo_round9.py` | **0** |

| 其他實際執行 | exit（依執行順序，保留失敗） |
|---|---|
| round31 `--reproduce` | 0 |
| round31 `--b --c --de` | 1、1、1 |
| round31 `--a` | 1、0 |
| round31 `--c` | 0 |
| round31 `--native` | 1、0 |
| round31 `--b --de` | 0 |
| round31 `--de`（16ms 取樣） | 0 |
| round31 `--b`（正向亮度斷言） | 0 |
| round31 完整模式 | 1、0 |
| 兩支 builder（多次依序重建） | 每次 0 |
| `node --check` ceremony.js／ceremony-fx.js | 各 0 |
| Python harness／builder 編譯 | 0 |
| 原生 CPU 取樣、凍結／RATE／體積檢查、證據歸檔 | 各 0 |
| `git diff --check` | 0 |

六次中途驗收 exit 1 沒有當成通過：分別揭露／校正了拖曳像素與紫色圖的選取遮罩、Z=42 翻牌相交、虛擬 hover 時鐘、側面透明空隙、原生 skip 晚一幀、以及完整 rect 的 canvas 局部座標。初次包含失敗項的批次 runner 最後是 **exit 1**，即使其中後續四支保留驗收都已 exit 0；單項 runner 的退出碼亦如實跟隨該項結果。

完整紀錄：[command-exits.json](shots/round31/command-exits.json)、[初期直接執行](shots/round31/command-exits-initial.json) 與同資料夾 `.log`。新驗收結果位於 `shots/round31/`；355 個本輪由舊 harness 產出的檔案已歸檔至 `shots/round31/retained30/`。被測試改寫的**已追蹤**歷史 JSON 與 debug.log 已還原；保留 harness 之後只改輸出路徑至本輪目錄並重新編譯（0），沒有移除或放寬斷言。原版校準仍保留在 verify-round30。

## 交付與提交邊界

A–E、驗收表及指定交付均已完成，沒有尚未通過的必跑項目。新增研究、此報告、截圖／JSON／log，並把本輪踩坑追加到 LESSONS、更新 TODO。驗證平台為本機 Chromium；沒有宣稱完成實體手機／跨 GPU 或人類美感盲測。

沒有 commit／push。`.git` 實際指向 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，超出本次可寫範圍；未嘗試繞過沙箱、修改主工作區或全域 Git 設定。Git 的 ownership 限制僅以每次命令的 `-c safe.directory=...` 處理唯讀檢查。

最終 `git status` 仍列出部分歷史 JSON 的修改標記，但逐 byte 比對均與 HEAD 相同，該目錄的 `git diff --exit-code` 為 0；沒有為清除這些標記而寫入共享 index。

待有正常 Git 寫入權限時，可依以下邊界按 hunk 提交（共用檔需拆 hunk，產物隨對應版本重建）：

1. **A／B 圖層**：ceremony.css 的 canvas／slot／anchor，ceremony.js 的 canvas rect 排除。
2. **C 互動**：bindInteraction、回正 ownership、提示與 card-lift transition。
3. **D 蓄力與時間**：chargeHigh、READ、rays／flash／tail、充能呼叫、180ms skip 及固定時間驗收。
4. **E 背景**：原創 SVG、背景 CSS 與 builder 內嵌。
5. **驗收與文件**：新／保留 checks、runner、兩個生成 HTML、baseline、研究／報告／LESSONS／TODO 與 round31 證據。
