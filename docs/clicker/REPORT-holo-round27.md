# 第二十七輪實作報告

日期：2026-09-09。工作區 `D:/claude/clawd-pet-holo`，起點及目前 HEAD 均為 `4ab5997ff6a16e5aad3a771a7f1b42b6991457bc`。
依簡報順序完成 0 → A1 → A2 → A3 → A4 → A5 的實作及驗證。**沒有 push；沒有建立 commit，原因見第 5 節。**

## 1. 各任務的修改與實測

| 任務 | 修改的來源／證據 | 實測結果 | 驗收與未完成項 |
|---|---|---|---|
| 0 | `demo.html` 共用外皮、`card_face.js` 的 `--cw`、`check_gacha_card_regression.py` | 45 個入口／稀有度／尺寸探針通過；正式卡另驗 47×5×3。框與 plate／gem 圓角、角落 inset／記號、線寬、gem font-size 隨未變形卡寬縮放，262px 為基準 | `--skin-only` exit 0；最終完整 regression exit 0。mask-size／background-size 的簡報單位有誤，詳下文；commit 受阻 |
| A1 | `verify-round27/start.json`、`baseline-demo.html`；新測試輸出改到 `verify-round27/` | 正式 catalog 43、加四場景 47；demo 65 樣本保留。起點 demo 的圖片可載入；78 份歷史證據雜湊最後重驗一致，shadow-root 的 baseline-css 逐字未改 | 控制組與資料檢查 exit 0；commit 受阻 |
| A2 | `demo.html` 的有效 depth plate/text 與圖窗規則；回歸腳本加入實際節點幾何斷言 | 三型 plate/text 為 left/right 4.4%、bottom 3.4%、height 16.2%；depth text z-index 200。depth 外層 art inset 0，media 承擔 1.7%／2.4%／3.3%，不疊 7px。原 215 組＋四場景 20 組跨三頁共 235 組，最大矩形差 **0px**、style 差 **0** | 幾何專項 exit 0；最終 regression exit 0；commit 受阻 |
| A3 | `demo.html`、新增 `update_demo_data.py`、`build_round5_standalone.py`、remade resolver、round8／round9／regression 檢查 | demo 正面改用 HoloCardFace，formal pool 的 kind、裸 id/file、palette 先交給建立器，再加展示前綴。移除 demo 重複尺寸公式；保留歷史 override、wrapper、卡背、翻面／選取／鍵盤／觸控、65 樣本及真舊卡。三頁同卡同寬結果一致 | round8、round9、regression 最終均 exit 0；三份 standalone 已移到各自獨立測試資料夾開啟驗證；commit 受阻 |
| A4 | `card_face.js`、`build_deluxe_b.py`、新增 `check_card_sizing.py`、`check_gacha_followup.py` | observe/refit 共用 content width，扣除 border-box 的 padding／border，同時更新 cw/gem。102px、外層 scale 1.13：name **8.44px**、rarity **4.75px**、gem **7.74px**；12 次尺寸往返、6 個 padding 案例、3 個長名與 3 個 flat 材質案例通過。揭曉／回槽等實際 animation.finished 後 refit | followup exit 0，且新增關鍵 assertion 全部通過；settled refit 字級變動 0、收下後 detached observer 0；commit 受阻 |
| A5 | `build_deluxe_b.py`、新增 `check_reveal_timing.py`、回歸腳本真實流程段 | cascade finally 無條件刷新 UI；revealed 與 complete 分開；收下必須等待卡、動畫、timer 結束。每抽 generation 管理動畫與延遲回呼，reset 取消等待並 unobserve 後移除。五個固定觸發點 ×20×dev/portable＝**200 次**通過；最後動畫結束到按鈕可用最大延遲 **0ms（虛擬時鐘）**。另通過 10 次中途 reset 後立即重抽、2 次蓄力中 reset | 修前測試 exit 1，修後 `--race-only` exit 0，最終完整 regression exit 0。未縮短正式動畫節拍；commit 受阻 |

所有程式來源均在 `_art/holo-test/`；`src/` 沒有修改。HoloCardFace 的 Range 量字、7% 縮字步進、55% 下限、名字／稀有度公式與既有 Z 數值保留；framed／flat art 維持 6px，depth 主體 Z 不動。

### 任務 0 的單位更正（沒有照抄錯誤數字）

起點 262px 卡的實際 computed style 是：

| 屬性 | 起點實測 | 本輪處理 |
|---|---|---|
| frame-material mask-size | `100% 100%` | 保留滿框覆蓋；原本已隨尺寸縮放 |
| frame-material background-size | `300% 300%` | 保留原比例 |
| mask-repeat | `repeat` | 保留原行為 |

簡報把前兩者當成 100px／300px。初次照 38.2%／114.7% 實作後，截圖出現 mask 平鋪格線跨過人物；因此回查基準並更正，不把那個結果交付。
其餘真正固定 px 的外皮使用同一套 `--cw`，沒有引入 cqw。例：102px 卡的 frame radius 從 12px 改成約 **4.672px**，plate radius 約 **1.947px**，gem radius 約 **1.168px**。
依據：[基準 computed 值](../../_art/holo-test/verify-round27/material-baseline.json)、[基準截圖](../../_art/holo-test/verify-round27/material-baseline.png)、[修後截圖](../../_art/holo-test/verify-round27/material-current.png)。

## 2. 建置與驗收的實際退出碼

在 `_art/holo-test/` 執行；驗收使用 `PYTHONIOENCODING=utf-8`。Chromium **136.0.7103.25**，主回歸 viewport 1512×1000、deviceScaleFactor 1。

| 命令 | 最終 exit | 結果 |
|---|---:|---|
| `python build_round5_standalone.py` | 0 | demo 單檔 3,776,566 bytes |
| `python build_cards_remade.py` | 0 | 43 張正式 pool |
| `python build_cards_remade_standalone.py` | 0 | remade 單檔 3,511,223 bytes |
| `python build_deluxe_b.py` | 0 | 47 張資料 |
| `python build_deluxe_b_standalone.py` | 0 | gacha 單檔 4,689,405 bytes |
| `python check_demo_round8.py` | 0 | dev／移走 standalone 各 65 張；原間距、對比 ≥35、層序、閒置等斷言保留並通過 |
| `python check_demo_round9.py` | 0 | 65 樣本、43 張正式名字／稀有度／kind／mask／palette、邊界與字效；兩入口無 console error／外部請求 |
| `python check_gacha_card_regression.py` | 0 | 235 組 pairFailures 0、structureFailures 0、nameFitFailures 0；12 個一般流程均收下；200 個固定時序案例通過 |
| `python check_gacha_followup.py` | 0 | 已補 assertion，不只是診斷退出正常；尺寸、長名下限、scrim、flat 位移與 observer 清理通過 |
| `git -c safe.directory=D:/claude/clawd-pet-holo diff --check` | 0 | 無 whitespace error |

followup 的超長名字刻意得到 `nameFits=false`：保留 55% 下限、如實回報超寬，不是假稱放得下。恢復短名字後是 **24px**，settled refit 變動 **0**。
一般流程是未插樁的 1／5／10 抽 ×一般／快轉 ×dev／移走 standalone，共 12 次；材質跟隨游標、整卡姿態不動、卡片數與載入、收下、console／request 均驗過。
固定時序使用 Playwright clock，原生 WAAPI 按同一虛擬時鐘完成，不用減少正式節拍換通過。

## 3. 失敗證據與調查過程

- **先失敗、再改 A5**：[timing-first-failure.log](../../_art/holo-test/verify-round27/timing-first-failure.log)、[JSON](../../_art/holo-test/verify-round27/timing-first-failure.json)，exit **1**。A4 之後、A5 之前，mythic＋九張 common 在 cascade 等待期快轉；收下已顯示時仍有 **15 個動畫、11 個 effect 節點**。當時的 builder 保存在 `verify-round27/build_deluxe_b-before-a5.py`。
- **原始 hidden race 也固定重現**：[timing-original-hidden.log](../../_art/holo-test/verify-round27/timing-original-hidden.log)、[JSON](../../_art/holo-test/verify-round27/timing-original-hidden.json)，對起點 HTML 執行 exit **1**：`cascading=false`、`skipped=true`、10 張正面、動畫 0，但 `finish.hidden=true`。它與前項是不同終態錯誤，均保留。
- 開發中的量測探針曾因缺少 `.leaf` 的 position 契約而失敗，scrim 字串斷言也曾把 Chromium 的 `0.85` 誤寫為 `0.851`；修正的是探針／表示法，沒有放寬幾何或對比門檻。
- 初期跨頁比較發現 demo 繼承 body 的 font/color 與另兩頁不同；將卡根的共用預設寫入 shared style 後收斂。部分探索性長測在定位差異後中止重跑，不能當通過；上表列的是最終完整執行結果。

最終完整證據：[measure-gacha-after.json](../../_art/holo-test/verify-round27/measure-gacha-after.json)、[regression log](../../_art/holo-test/verify-round27/check_gacha_card_regression.py.log)、[timing-after.json](../../_art/holo-test/verify-round27/timing-after.json)、[sizing.json](../../_art/holo-test/verify-round27/sizing.json)、[followup.json](../../_art/holo-test/verify-round27/followup.json)。
建置退出碼與輸出在 [build-results.json](../../_art/holo-test/verify-round27/build-results.json)；其餘最終命令退出碼在 `check-results.json`、`regression-exit.json`。

## 4. 同步產物與文件

三份 tracked standalone 已一起重建並各自複製到獨立資料夾測試：

- [demo-standalone.html](../../_art/holo-test/demo-standalone.html)
- [cards-remade-standalone.html](../../_art/holo-test/cards-remade-standalone.html)
- [deluxe-gacha-b-standalone.html](../../_art/holo-test/deluxe-gacha-b-standalone.html)

[HANDOFF 第七節](HANDOFF-holo-cards.md) 與 [TODO-next-round](TODO-next-round.md) 已更新。任務 C 改為 **已修（a6d188b）**，保留量測方法；本輪沒有把既有四角装飾批量刪除。
歷史 `verify-gacha/` 78 檔未變；新增輸出使用 `verify-round27/`。現有其他未追蹤文件／使用者日誌沒有納入或改寫。

## 5. 尚未完成：逐任務 commit

任務 0 完成後實際嘗試 `git add` 與 `git commit`，均被拒絕（exit **1**）：

```text
fatal: Unable to create 'D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo/index.lock': Permission denied
```

這個 worktree 的 Git index 位於共享 metadata 目錄，超出本輪可寫範圍；審批模式也不允許提權。只使用 command-scoped safe.directory 解決讀取時的 ownership 檢查，沒有更改全域 Git 設定，也沒有繞過沙箱去改另一個 worktree。
所以 **0／A1／A2／A3／A4／A5 的六個 commit 都沒有建立**，三份產物也尚未 commit；修改完整留在本 worktree。沒有 push。
除了此 Git 交付限制，以及已用實測更正的 mask/background 單位，最終要求的建置及驗收沒有未通過項。
