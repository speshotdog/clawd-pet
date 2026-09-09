# 第三十輪報告：以原版 Hearthstone 拆包為底線

日期：2026-09-09。工作區：`D:\claude\clawd-pet-holo`。原版先量測，再移植與強化；`src/` 沒有修改，沒有 push。開發入口為 [`deluxe-gacha-b.html`](../../_art/holo-test/deluxe-gacha-b.html)，可搬走入口為 [`deluxe-gacha-b-standalone.html`](../../_art/holo-test/deluxe-gacha-b-standalone.html)。

## 實作

- 新增 `ceremony-layout.js`：移植原版桌面槽位概念，移除扇形角度與桌面分頁。五張單排、十張兩排各五張；揭曉留在原槽位，只上提 6px。手機保留有間距的單卡瀏覽，所有卡的 rect 仍互不相交。resize 同步更新正在播放的定位／返回動畫。
- 新增 `ceremony-fx.js`：保留原版 ring、rainbowRing、spawn、reveal、粒子繪製與射線參數，改為呼叫端持有 canvas 與時鐘的獨立工廠。原版各階粒子數 8／26／62／68／100 保留，沒有縮短尾韻；不需要 reveal 未使用的 sprite sheet。新增大範圍光暈、強環、傳說／神話箔底材波與掃光。原版 mythic 白閃移至 F 後，延長至 156ms，避免預告。舊薄環＋箔片不再呼叫。
- 新增 `ceremony-audio.js`：完整複製原版合成設計，只更名命名空間及加入測試觀察 hook。tear、burst、deal、flip、五階 reveal、collect 使用原版頻率、音量、包絡、延遲與殘響。首次靜音不變；收下音保有獨立生命週期，不被 220ms 畫面退出截斷。
- 原版 deal 的 620ms、五張 stagger 95ms／十張 50ms、共同封口起點與回彈保留。連同 680ms 拆封前段，單／五／十抽發牌完成時間為 1,300／1,680／1,750ms。卡面 F 仍在 charge 後 320ms。
- 保留入口、拆封素材、六層背景、HoloCardFace、鎖角度／游標光位／拖轉／hover 1.04、Esc／空白跳過、文字不可選取與 A5 完成所有權。builder 將三個新模組內嵌至兩個入口。

## 原版實測與新版像素比較

原版實際以 `file://.../src/clicker.html` 開啟 Hearthstone 模式，固定抽取 fixture 與亂數。Chromium 的 file fetch 無法取得 rig template，因此測試注入只將 `fetch('index.html')` 回傳替換為磁碟上原封不動的 `src/index.html`；沒有改寫原版效果或 DOM 設計。原版桌面卡 CSS 寬 150px，受 zoom／旋角影響，五張首卡 rect 寬約 222.208px，原版旋轉 rect 有交集。

雙方均在 1440×900，採同一固定卡外 mask：ROI x=160–1279、y=160–719，排除 x=490–950、y=110–750 的最大卡面包圍區。排除原版明亮邊框／控制 UI，以免量到框線而不是揭曉效果。灰階使用 Pillow L，量 P95。F+0 至 600ms 每 50ms 一張；另延伸至 2,400ms 量尾韻，因只量 600ms 無法驗證長效果的 1.3 倍持續時間。持續時間為 P95 > 各自底色 P95+40 的 50ms 區間總和。

| 階級 | 原版底色 | 新版底色 | 原版峰值 → 新版峰值 | 峰值倍率 | 原版持續 → 新版持續 |
|---|---:|---:|---:|---:|---:|
| 普通 | 33 | 24 | 33 → 66 | 2.00× | 0 → 350ms |
| 精良 | 33 | 24 | 33 → 66 | 2.00× | 0 → 350ms |
| 史詩 | 33 | 24 | 37 → 60 | 1.62× | 0 → 0ms |
| 傳說 | 33 | 24 | 69 → 223 | 3.23× | 0 → 1,600ms |
| 神話 | 33 | 24 | 95 → 255 | 2.68× | 750 → 1,950ms（2.60×） |

dev 與搬走的 standalone 最終數值一致。傳說原版沒有超過底色+40，持續時間基準為 0，倍率無法定義；測試除 brief 的比較外，另要求兩個高階至少 1,000ms，避免把乘零當作強化證據。史詩依指定門檻仍為 0ms，峰值和原版粒子參數均達標。這些是固定 mask 的客觀結果，不宣稱人類偏好或盲聽結論。

證據在 [`verify-round30`](../../_art/holo-test/verify-round30/)：`original-baseline.json`、`original-layout.json`、`photometry-mask.png`、`dev-pixels.json`、`portable-pixels.json` 及逐幀 PNG。可直接看 [`final-mixed-5.png`](../../_art/holo-test/verify-round30/final-mixed-5.png)。

## 驗收與真實退出碼

命令均從 worktree 執行，下表省略 `python _art/holo-test/`。兩入口含只搬移 HTML 的 standalone；測試副本與截圖仍放在此 worktree。

| 驗收／命令 | 結果 | exit |
|---|---|---:|
| `check_gacha_ceremony_round30.py --baseline`／`--baseline-layout` | 原版 file 畫面、固定 fixture 實測 | 各 0 |
| `check_gacha_ceremony_round30.py --layout` | 3 種尺寸 × 五／十張 × 兩入口，任兩張 rect 交集 0；含 hover、拖轉與手機逐張瀏覽 | 0 |
| 同上，1440×900 卡寬 | 五張 245.031px（clientWidth 245），十張 222.219px（clientWidth 222） | 0 |
| `check_gacha_luminance_round29.py` | 舊測試更新為新基準比較，最終峰值／尾韻如上表 | 0 |
| `check_gacha_ceremony_round30.py --pixels` | 新增密集像素測試；最終 renderer 前一次全跑也通過 | 0 |
| `check_gacha_audio_round30.py` | 五階各一次 reveal cue；native sources 1／4／9／34／51，原版與新版排程一致，running 有排程、muted 為 0；收下音存活 | 0 |
| `check_gacha_ceremony_round30.py --core` | 三階 × 13 個 F 前時點 × 兩入口，共 78 幀逐像素差 0 | 0 |
| `check_gacha_ceremony_round30.py --core --a5-only` | 九個觸發點 × 20 次 × 兩入口，共 360 次；含最後一張前／後及實際返回動畫，完成一次、身份不變、清理無殘留 | 0 |
| `check_gacha_controls_round29.py` | 控制項、早期 skip、手機文字 hit、清理 | 0 |
| `check_gacha_return_round29.py` | 兩入口實際返回點各 20 次 | 0 |
| `check_gacha_ceremony_edges_round28.py` | 拖曳 reset、decode 競態 | 0 |
| `check_gacha_fx_round28.py` | 最終版揭曉／resize 全十張不相交；效果中心偏差最大 0.0194 卡寬 | 0 |
| `check_gacha_ceremony_round28.py --interaction-only` | 互動像素斷言 | 0 |
| `check_gacha_ceremony_round28.py --core-only` | 最終完整保留套件：再次驗證 78 幀零差、單／五／十張正常流程、七個 skip 階段各 20 次 × 兩入口 | 0 |
| `check_gacha_ceremony_round29.py --live` | 原生時鐘／可見性與互動回歸 | 0 |
| `check_gacha_ceremony_round29.py --neutral-only` | 相同前綴、不同下一張階級，畫面逐像素相同 | 0 |
| `check_gacha_ceremony_round29.py --visual-only` | 最終完整重跑：兩入口版面、五階實際像素、底材波及下一張階級中性畫面 | 0 |
| `check_gacha_card_regression.py --cards-only` | 47 張 × 7 寬度，共 329 組跨三頁卡面比對 | 0 |
| `check_gacha_card_regression.py --race-only` | 五個固定階段 × 20 次 × 兩入口，共 200 次；最後一張返回點另斷言實際 animation，重入／reset 後重抽也通過 | 0 |
| `check_gacha_card_regression.py --flows-only` | 原生時鐘單／五／十抽，正常與 skip，共 12 條兩入口流程；收下、hover、resize、無壞圖／console error | 0 |
| `check_gacha_artifacts_round29.py` | 原版參數、素材、凍結檔、RATE、src 與體積 guard | 0 |

上述驗收最終均通過，沒有尚未通過的 brief 自動化驗收項目。四個 JavaScript 模組 `node --check`、更新後 Python harness 編譯及 `git diff --check` 均 exit 0。每支命令的實際結果保存在 `command-exits-direct.json`、`command-exits-manual.json`、`command-exits-final.json`、`command-exits-regression.json`、`command-exits-retained.json`、`command-exits-finish-regression.json`；整合索引為 `command-exits-all.json`。

測試保留舊檔並更新原版節奏／新版 FX 預期，未刪除舊套件。時序重複測試使用依序前進到 timer deadline 的虛擬時鐘；保持原生 WAAPI、原始 duration 及 20 次重複。像素測試仍渲染實際 frame，精確同步 canvas 與 WAAPI，避免抓到相鄰 frame 的一級 RGB 誤差。

中間失敗沒有當成通過：原版 harness 曾因 file fetch、貨幣條件、fixture 接線失敗（exit 1），修正後才建立上述基準；污染到原版亮框的舊 mask 已淘汰。舊 visual 三次 exit 1 分別揭露等待不足原版 3 秒粒子尾韻、未同步 canvas 造成下一張階級快照一級 RGB 差異；修正等待與精確取樣後單項及完整兩入口重跑均為 0。兩次耗時的舊 race runner 被中止，不能算完整成功。保留實際 logs 與 `command-exits-*.json`，最終結果不抹除歷史失敗。

## 體積、凍結與提交邊界

standalone **5,142,068 bytes**，低於 6,000,000；五個 runtime 檔合計 70,304 bytes。三張既有 FX WebP 與內嵌資料逐 byte 相同。`card_face.js`、`pool_data.py` 與 RATE 不變，`src/` diff 為空；沒有 three.js 或影片。詳見 `artifact-manifest.json`。

沒有 commit，也沒有 push。worktree 的 `.git` 指向 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，位於 sandbox 可寫範圍外；本輪不嘗試繞過權限或修改主工作區。待有 Git 寫入權限時，按以下五個邊界拆分（共用檔需按 hunk 暫存，每段重建產物）：

1. **版面不重疊**：`ceremony-layout.js`、`ceremony.js` 槽位／手機／resize 定位。
2. **FX 移植與強化**：`ceremony-fx.js`、`ceremony.css`、`ceremony.js` canvas／白閃／底材波及生命週期。
3. **音效移植**：`ceremony-audio.js`、`ceremony.js` cue／mute／收下生命週期。
4. **原版發牌節奏**：`ceremony.js` 封口起點、620ms、95／50ms stagger 與回彈。
5. **測試、建置與文件**：新舊 check、capture／runner、builder、兩個 HTML、REPORT、HANDOFF 第七節與 TODO。

未做遊戲 `src/` 整合或推送，這是本輪明確邊界。未宣稱已驗證實體手機 GPU 或人類等響度盲聽。
