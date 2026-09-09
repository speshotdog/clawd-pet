# 第二十八輪實作報告

日期：2026-09-09。工作區：`D:/claude/clawd-pet-holo`；最後觀察 HEAD：`3378791`。
依 brief 必讀順序、前奏 → 單卡 → 焦點／定位 → 掃光 → 跳過 → 音效 → reduced-motion → 結果互動完成。
**使用者裁決優先；本代理沒有建立 commit、沒有 push，沒有修改其他 worktree。**

交付：[開發版](../../_art/holo-test/deluxe-gacha-b.html)、[可攜單檔](../../_art/holo-test/deluxe-gacha-b-standalone.html)。
單檔實測 **5,187,027 bytes（5.187027 MB，十進位）**，低於 5,300,000 bytes 上限，剩餘 112,973 bytes。

## 1. 實作與檔案

| 檔案 | 修改 |
|---|---|
| `_art/holo-test/ceremony.js`（新增） | 演出生命週期、素材 decode、前奏、逐卡揭曉、焦點排程、卡後 FX、有限掃光、跳過、WebAudio、reduced-motion、結果互動 |
| `_art/holo-test/ceremony.css`（新增） | 全視窗舞台、夜空、鋁箔包與上緣撕封、外層翻面／選取、卡後光源；入口按鈕改為固定銀色 |
| `build_deluxe_b.py` | 嵌入上述兩個來源；保留 HoloCardFace 共用卡面與既有 A5 狀態名稱；`path()` 支援 `fx/` |
| `build_deluxe_b_standalone.py` | 五個 FX 素材進既有 asset 表與單一 resolver；未新增逐素材字面替換 |
| `deluxe-gacha-b.html`、`deluxe-gacha-b-standalone.html` | 重建產物 |
| `check_gacha_ceremony_round28.py`（新增） | 可分 `--core-only`／`--interaction-only` 執行；兩者合起來覆蓋完整新驗收 |
| `check_gacha_ceremony_edges_round28.py`、`check_gacha_fx_round28.py`（新增） | 最終產物的解碼中跳過、拖曳後跳過，以及外部 FX 深度／十槽定位專項 |
| `check_gacha_card_regression.py` | 門檻不變；新輸出放 `verify-round28/regression/`；因正面會預先建立，流程等待真正可收下，而非等待 DOM 存在後固定睡眠 |
| `check_reveal_timing.py` | 沿用原 A5 五組 fixture、20 次重複及清理斷言；先等實際 decode，再使用新前奏／單卡時間點 |
| `HANDOFF-holo-cards.md`、`TODO-next-round.md` | 同步第二十八輪入口、契約、驗收與後續範圍 |

`card_face.js` **沒有修改**；幾何、Z、字級公式、卡型、palette、demo／cards-remade 的 hover tilt 沒有改動。正式 `RATE` 與 HEAD 逐字比對相同；`src/` 未改。

使用現有的 `summon-night.webp` **62,956 bytes**、`foil-pack.webp` **87,102 bytes**、`foil-tear.webp` **31,988 bytes**。
原始 WebP 未加工；卡包顯示用 CSS grayscale 維持全階中立銀白。手寫 `star-track.svg`／`star-seal.svg` 分別 **524／336 bytes**，只有一個中立星軌印記。
新增演出 JS＋CSS 合計 **21,459 bytes**，無 three.js、Pixi、影片、CDN 或新 runtime 依賴。

## 2. 時間軸與裁決

前奏實測（虛擬時鐘，素材解碼完成後起算）：

| 段落 | 時長 ms |
|---|---:|
| 進入舞台 | 180 |
| 星軌點亮 | 620 |
| 流光投遞、銀白卡包顯現 | 700 |
| 上緣撕封 | 380 |
| 發牌 | `360 + 40 × (n−1)` |
| 單／五／十抽前奏總長 | **2240／2400／2600** |

刪除了原設計的 360ms 品質預告。所有階級一律 **140ms 蓄光＋360ms 翻面**；`face-visible` 位於單卡 **+320ms**，爆光 marker 同一時刻。卡包、預翻面光色、動作與音效不讀取稀有度。

高階移向中央與階級色 FX 都從正面 marker 後開始。common 短柔光環、rare 藍光束、epic 紫光柱、legendary 射線／火星／單次衝擊、mythic 粉青金分色與長讀卡。採整列依序揭曉，低階也不交錯，避免下一張啟動節拍成為品質線索；史詩以上直到回槽完成才交出焦點。

**掃光時間的衝突處理：** 設計的 1370–1820ms 以舊傳說節拍為基準；遵循使用者 140／360 裁決後，保留「正面初見起算 450ms」的材質光路，實際為 **320–770ms**。沒有在卡面加不透明白片。common／rare 讀卡段仍為 120／180ms，但完成狀態等掃光結束，因此逐卡完整時長實測為：

| common | rare | epic | legendary | mythic |
|---:|---:|---:|---:|---:|
| **770ms** | **770ms** | **1140ms** | **1140ms** | **1520ms** |

全視窗只用 `.win.is-ceremony`，沒有 Fullscreen API。讀卡後恢復原展廳版面。

## 3. 完成、取消與互動契約

- 沿用 `generation`、`revealed`、`complete`、`cascading`、`busy` 等 A5 名稱；`revealed` 不代表完成。重入揭曉返回同一 Promise；cascade 的 finally 在歸屬相符時無條件重算 UI。
- 跳過從準備／前奏開始可用，背景點擊同樣有效；控制項不因冒泡重複跳過。先使舊 run 失效，再取消 WAAPI、timer、rAF、粒子、音源與 gain；保留原身份、順序、数量和已建立的 face。
- 素材已就緒不再重複 decode；未就緒等圖片成功解碼。結果 **180ms** 淡入。正常及跳過流程均在清理完成後立即可收下；正常 marker 最後完成到 collectable 差 **0ms（虛擬時鐘）**。
- 所有卡後效果接受當次 scope／anchor；外部 anchor 使用 **−200px Z**，在半翻面時也位於卡後。這不是卡內分層，沒有改 HoloCardFace 的 Z。
- `.slot.done` 才開啟光位、拖曳與選取。hover 外層 **1.04**／180ms；字級不變。光位隨 pointer、角度不隨 hover；拖曳上限 ±18°，放開保留，雙擊／Esc 回正；觸控點擊切換選取。
- 離開立刻呼叫中立 `paintFoil()`，phase 回 **120deg**；拖曳保留的角度不被光位重設覆蓋。跳過則連已拖曳的卡一起回正。
- WebAudio 四種合成事件，首次靜音；`holo-muted` 保存偏好。已開聲的下次抽卡會在使用者操作時 resume AudioContext；取消立即清空音源。
- reduced-motion 獨立走 180ms 結果淡入，沒有飛行、撕裂、大閃光或震動，使用相同完成契約。

## 4. 十二條驗收與真實退出碼

以下 **core** 指 `check_gacha_ceremony_round28.py --core-only`，**interaction** 指同檔 `--interaction-only`；兩個命令最終都 **exit 0**。時間軸暫停由 Playwright clock 與原生 WAAPI 的測試控制器共同提供；不縮短正式節拍。CSS hover 與有聲／閒置另用真實瀏覽器時間驗證。

| Brief 驗收 | 實測與 exit |
|---|---|
| 1. 固定單／五／十抽、RATE 不改 | dev／portable 各三組，身份與順序正確；RATE 比對相同。**core 0** |
| 2. 暫停與事件紀錄 | `phase-start`、`face-visible`、`slot-complete`、`collectable` 均存在；沒有 `rarity-lock`。**core 0** |
| 3. 不預告逐像素比較 | common／legendary／mythic；0–2400ms 每 200ms，13 時點 ×3 階 ×2 入口＝**78 張**；每次與 common 比較，最大像素差 **0**。**core 0** |
| 4. 高階互斥 | 100ms 探針每次最多一張 `.is-revealing`；後一張 charge 不早於前一張 slot-complete。**core 0** |
| 5. FX 卡後與定位 | 一般單／五／十抽加 resize；最終專項另驗十張傳說、左右中／兩排／兩次 resize。最大中心差 **2.8915×10⁻⁷ 卡寬**，遠低於 0.05。**core 0、FX 0** |
| 6. 露面／爆光／音效 | face 與 burst marker 差 **0ms**；另開真實 AudioContext，四事件均 running、非靜音，impact／chord 與露面差 ≤50ms；事件保存 audioTime。**core 0、interaction 0** |
| 7. A5 重複測試 | 原五觸發點 ×20×2入口＝**200 次**；新七點（含前奏／撕封）×20×2＝**280 次**。均可收下、身份／順序／數量相同；另驗 reset 後立即重抽。**原回歸 0、core 0** |
| 8. 結果互動 | wrapper scale 1.04、字級 **19.03px →19.03px**；hover phase **120→90.869565deg** 而 rx／ry 為 0；60px 拖曳 ry **12deg** 並保留；Esc 回 0、leave 回 phase120；觸控選取 toggle 正確。**interaction 0** |
| 9. 三型五尺寸回歸 | **235 組**跨三頁、80／102／150／230／290px；最大幾何差 **0px**，pair／structure／name-fit failures 都 **0**；45 個外皮探針通過。**完整 regression 0** |
| 10. 清理與閒置 | 收下／reset 後工作歸零；兩入口真實 **5s／30s** 檢查均 **0 DOM mutation**；舊回呼不改新抽次；observer／粒子清理通過。**interaction 0、regression 0、edges 0** |
| 11. reduced-motion | 179ms 還不可收下，180ms 完成淡入；沒有 tear／burst；相同清理終態。**interaction 0** |
| 12. dev／搬走單檔、大小 | standalone 複製到工作區內獨立臨時資料夾測；不依賴原資源目錄。**5,187,027 bytes**，兩入口無應用程式錯誤／失敗資源請求。**core 0、interaction 0、regression 0** |

實際完成的命令：

| 命令（腳本都在 `_art/holo-test/`） | 最終 exit |
|---|---:|
| `python build_deluxe_b.py` | **0** |
| `python build_deluxe_b_standalone.py` | **0** |
| `python check_gacha_ceremony_round28.py --core-only` | **0** |
| `python check_gacha_ceremony_round28.py --interaction-only` | **0** |
| `python check_gacha_ceremony_edges_round28.py` | **0** |
| `python check_gacha_fx_round28.py` | **0** |
| `python check_gacha_card_regression.py --race-only` | **0** |
| `python check_gacha_card_regression.py`（完整重跑） | **0** |
| `node --check ceremony.js` | **0** |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | **0** |
| `git add …`／`git commit …` | **1／1** |

主要證據都在 [`verify-round28/`](../../_art/holo-test/verify-round28/)：
[core JSON](../../_art/holo-test/verify-round28/ceremony-results-core.json)、[interaction JSON](../../_art/holo-test/verify-round28/ceremony-results-interaction.json)、[edges](../../_art/holo-test/verify-round28/edges.json)、[FX](../../_art/holo-test/verify-round28/final-fx-alignment.json)、[完整 regression](../../_art/holo-test/verify-round28/regression/measure-gacha-after.json)、[命令退出碼](../../_art/holo-test/verify-round28/command-exits.json)、[最終產物大小與 SHA-256](../../_art/holo-test/verify-round28/artifact-manifest.json)。
最終完整回歸原始輸出為 [`verify-round28-regression-final.log`](../../_art/holo-test/verify-round28-regression-final.log)。
目視檢查：[銀白卡包](../../_art/holo-test/verify-round28/dev-mythic-1400.png)、[半翻面卡後接光](../../_art/holo-test/verify-round28/legendary-contact.png)、[十抽結果](../../_art/holo-test/verify-round28/portable-result-10.png)。

## 5. 開發中失敗與修正

- 首次不預告測試 **exit 1**：不同頁的 rAF 取樣相位不同，例如動畫落在 15ms／9ms；固定 WAAPI 時間和 16ms 取樣後逐像素歸零，沒有放寬零差門檻。
- 首次完整 regression **exit 1**：旧測試假定素材準備同步完成；新 decode 等待需要獨立於演出時計。測試增加 `__prepared()`，產品端也修掉跳過時重複 decode 已就緒圖片的等待。
- 首次 hover 斷言 **exit 1**：虛擬 timer 時間不會推進原生 CSS transition；改用真實 220ms 等待後讀取 1.04。最終以 core／interaction 兩個完整分支分開跑，並如上列出各自退出碼；不把早期整支命令的失敗寫成成功。
- 目視發現半翻面射線穿過人物：將**卡外** anchor 放到 −200px，保留卡內凍結層序，並補最終十槽／resize 專項。
- 調查中的部分執行有中止重跑，沒有算入通過；臨時單檔副本已清掉，截圖／JSON／log 保留。Chromium 底層 GPU diagnostic log 收到證據資料夾，不混入應用程式 console-error 結論。

## 6. 未提交與預定 commit 邊界

兩次實際 Git 寫入都遭拒絕，原文：

```text
fatal: Unable to create 'D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo/index.lock': Permission denied
```

共享 metadata 在另一個 worktree 目錄，超出沙箱可寫範圍；依使用者指示跳過提交，未改全域 Git 設定、未繞過沙箱、未 push。以下是**預定邊界，不是已存在的 commits**；目前共用檔案需按區塊分拆提交：

1. **前奏／素材**：`round28 prelude: 2240/2400/2600ms, 78 neutral frames identical; core exit 0`。builder、resolver、前奏 JS／CSS、SVG 與相應產物。
2. **單卡／定位／掃光**：`round28 reveal: face+320ms, 450ms foil sweep, FX error <0.000029%; checks exit 0`。逐卡、焦點、卡後定位及 FX 測試。
3. **跳過／A5**：`round28 skip: 180ms fade, 280 new + 200 retained cases; regression exit 0`。generation 取消、decode-ready 重用、終態与競態測試。
4. **結果互動**：`round28 interaction: wrapper 1.04, 60px drag 12deg, font delta 0; exit 0`。pointer、拖曳保留、觸控、Esc／雙擊與清理專項。
5. **WebAudio**：`round28 audio: 4 running-context cues, silent by default, 30s idle mutations 0; exit 0`。音效、偏好保存、resume／取消與真實時間測試。
6. **reduced-motion／交付**：`round28 reduced motion: 180ms completion, portable 5187027 bytes; checks exit 0`。獨立淡入分支、最終產物、驗收證據、HANDOFF／TODO／本報告。

**功能與驗收沒有尚未通過項；未完成的交付只有 Git commit。** 後續 three.js、影片、遊戲本體整合、價格與經濟層不在本輪授權範圍。

## 7. 28b 補丁

根因是瀏覽器原生拖曳選取：圖片被選中後 Chromium 塗藍，原本只驗 CSS 姿態變數的測試無法發現。

- `ceremony.css:23–24`：結果 `.slot` 及全部子孫（含 `.hcard`）禁止選取，圖片禁止 WebKit 原生拖曳；既有 `touch-action:none` 仍限於卡片。
- `ceremony.js:73,178`：建立卡面時所有圖片設 `draggable=false`；拖曳 pointerdown 呼叫 `preventDefault()` 並清除既有 selection。
- `check_gacha_ceremony_round28.py:165–183`：60px 拖曳、放開、移開游標、等待 hover 結束後截 `.hcard`；逐像素驗 `b>120 && b>r+40 && b>g+20` 比例 ≤0.01，並驗 selection rangeCount 為 0；原本角度保留與 Esc 歸零斷言保留。
- `ceremony.css:7`：卡包寬度改為 `min(70vw,316px)`，不改時間軸；1440×900 實測外框 315.887px，扣除素材透明邊後可見約 300px。保留第 28 輪既有灰階 filter，僅更新內嵌素材與顯示尺寸。

像素斷言採白色「摯友之狐」卡。首次沿用「天外膠膠」時，原畫紫色星球也命中指定藍色閾值（0.1696085133、selection 0），該次 interaction **exit 1**；改用不含藍紫主體的固定卡，沒有放寬閾值或修改卡面。最終 dev／portable 都是 **0 / 74,613 像素，比例 0.0，selection ranges 0**；拖曳 `--ry=12deg` 保留，Esc 回 0。另以原生 Chromium touch events 驗單指 60px 拖曳，`ry=12deg`、selection 0，圖片全部不可原生拖曳。

負向對照在測試頁暫時停用選取防護：**藍色比 0.6862611073、selection ranges 1**，證明新斷言能抓到本次 bug。證據：[負向對照](../../_art/holo-test/verify-round28/round28b-negative-control.json)、[dev 拖曳截圖](../../_art/holo-test/verify-round28/dev-drag-card.png)、[portable 拖曳截圖](../../_art/holo-test/verify-round28/portable-drag-card.png)。

依序重建 `build_deluxe_b.py` → `build_deluxe_b_standalone.py`，兩者 **exit 0**。新 standalone **5,187,239 bytes**；解析實際 HTML asset-data、base64 解碼後與來源逐 byte 相同，卡包 **87,102 bytes**，SHA-256 `49ff3c7a69803e77586050c731c2c55816a02a437e199354ceb30c03e0b8f52b`。證據：[素材與觸控量測](../../_art/holo-test/verify-round28/round28b-artifacts.json)、[1440×900 卡包](../../_art/holo-test/verify-round28/round28b-pack-1440.png)。

28b 最終命令退出碼：驗收仍在執行，完成後補記。

本輪只在此 worktree 寫檔；未 push。`.git` 指向 worktree 外的 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，依目前沙箱可寫邊界及前輪已確認的 index.lock 拒絕紀錄，略過 commit，未嘗試修改外部 metadata。
