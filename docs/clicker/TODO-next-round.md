# 抽卡卡面與演出：第三十輪狀態

本輪以原版 hearthstone 為底線完成移植，交付與真實退出碼見 [REPORT-holo-round30.md](REPORT-holo-round30.md)。

- 新入口：`ceremony-layout.js`／`ceremony-fx.js`／`ceremony-audio.js`，由既有 builder 內嵌到 dev 與 standalone。
- 五張單排、十張雙排，不再重疊或桌面換頁；手機有間距的單卡瀏覽保留。
- 原版粒子數、環、音效排程已移植；強化後以原版 file:// 畫面 50ms 截圖做 P95／持續時間對照。不要再用 CSS 參數當亮度證據。
- 保留卡面凍結、入口／拆封、六層背景、首次靜音、不預告、拖轉／光位／hover、A5 與跳過語意。
- 後續重新調整 FX 時，同時跑原版相同 mask 的比較和兩入口驗收，不能重新套用第二十九輪的亮度上限或縮短原版粒子尾韻。
- 不自動修改 `src/` 或合併遊戲經濟；不 push。共享 Git metadata 超出可寫範圍，依報告中的五個邊界待有權限時提交。

以下為第二十九輪歷史狀態（第三十輪 brief 已取代其中扇形、薄環與禁止移植舊 gacha 的敘述）。

本輪交付與真實退出碼見 [REPORT-holo-round29.md](REPORT-holo-round29.md)。
開發入口為 `_art/holo-test/ceremony.js`／`ceremony.css`，建置順序 `build_deluxe_b.py` → `build_deluxe_b_standalone.py`。

- 已完成：獨立入口／演出／結果、滿版印刷卡包、共用拆封、大卡扇形／手機卡帶、十連雙頁、五階材質回饋、220ms 收下。
- A5 狀態名稱、180ms 跳過、相同抽取身份順序、同一 reveal Promise、結果互動與像素選取防護保留。
- Claude 的 `fx/summon-substrate.webp` 已到位並嵌入（31,942 bytes）；缺檔時仍有 CSS 漸層替代。往後替換底材需重建兩個產物並重驗素材、亮度與體積。
- 請人工審閱12組成對靜音／等響度比較；不能把自動化像素與時序通過當成人類美感偏好結果。
- 第30輪僅在另行授權後評估神話底材真折射及調音；本輪不引入 three.js、影片或舊 gacha 程式。
- `src/`、`card_face.js`、`pool_data.py`、RATE 未動。卡面幾何、Z、字級維持凍結。
- Git metadata 不在可寫 worktree 內，未 commit／未 push；提交邊界見報告，待有正常 Git 寫入權限時提交。

以下為第二十七輪歷史摘要（卡面凍結與舊證據繼續有效）。

更新：2026-09-09。依 `BRIEF-holo-round27.md`，按 0 → A1 → A2 → A3 → A4 → A5 實作。
本輪起點 `4ab5997ff6a16e5aad3a771a7f1b42b6991457bc`。結果、真實退出碼與限制見 [REPORT-holo-round27.md](REPORT-holo-round27.md)。

## 1. 已完成的實作與驗證

| 項目 | 現況 | 證據／維護入口 |
|---|---|---|
| 0：卡面外皮隨卡寬縮放 | 圓角、線寬、角落記號、寶石字級使用 `--cw`，基準 262px；不調大扇形卡 | `demo.html` 共用樣式；`check_gacha_card_regression.py` 的 skin 與實際卡面斷言 |
| A1：控制組與資料身分 | 保存起點 demo、78 份歷史證據 SHA-256；正式 catalog 43 張，加 4 場景為 47；demo 的 65 個展示樣本保留 | `verify-round27/start.json`、`baseline-demo.html`；`pool_data.py` 仍是唯一來源 |
| A2：三型幾何 | plate/text 統一 4.4%／4.4%／3.4%／16.2%；depth text z-index 200；depth 圖窗由 media 單層承擔內縮 | 47 張 × 5 尺寸 × 三頁比較；原 215 組與四場景 20 組均納入 |
| A3：demo 接共用建立器 | `makeCard()` 使用 `HoloCardFace.create()`；保留卡背、選取、翻面、鍵盤／觸控 wrapper、歷史 override 與 shadow-root 真舊卡 | `update_demo_data.py`、`build_round5_standalone.py`；round8／round9 保留原門檻並補 kind、palette 斷言 |
| A4：尺寸與 observer | observe／refit 共用未變形 content width，含 padding／border 契約；同步更新 gem；動畫 finished 後 refit；移除前 unobserve | `check_card_sizing.py`、`check_gacha_followup.py`；102px 時 8.44／4.75／7.74px，detached observer 0 |
| A5：快轉完成／取消 | cascade finally 重算 UI；區分 revealed 與 complete；等卡片、動畫與 timer 完成才能收下；reset 取消本次工作並隔離舊回呼 | `check_reveal_timing.py` 由回歸腳本呼叫；五個固定觸發點各 20 次，dev／移走 standalone 共 200 次；另驗 10 次中途 reset 後重抽與 2 次蓄力中 reset |

外皮量測有一項必須更正簡報：起點的 `mask-size` 是 **100% 100%**，`background-size` 是 **300% 300%**，並非 100px／300px。
直接改成簡報的 38.2%／114.7% 會讓 frame mask 平鋪成跨越人物的格線。
本輪保留原本已同比縮放的百分比，證據為 `verify-round27/material-baseline.json` 與前後截圖；其餘指定 px 外皮才改綁 `--cw`，沒有引入 cqw 第二套系統。

## 2. 凍結契約與後續維護

- 三型資料、人物裁切／配準、290px 字級基準、7% 縮字步進與 55% 下限、稀有度同比縮均保留。
- Z 沿六之五及本輪簡報：背景 2、framed／flat 圖層 6、框 8、plate 13、text 40、gem 42px；depth 主體既有 Z 不動。六之四的「flat Z=0」是歷史矛盾，不沿用。
- flat 沒有 subject-mask／圖內位移；scrim 只在 plate，text 透明。不要回到雙重黑底或不透明銘牌。
- 所有新驗收輸出都在 `_art/holo-test/verify-round27/`，不要覆蓋 `verify-gacha/` 或本輪失敗證據。
- 固定時序測試使用 Playwright clock 與同步到該時鐘的原生 WAAPI；一般播放仍由未插樁的實際流程測試驗證，沒有縮短正式動畫節拍。
- 抽卡／remade／demo 都從 `demo.html` 的共用 style 與 `card_face.js` 建置；修改後重建三個 standalone。

## 3. 任務 C：已修（a6d188b），保留量測方法

傳說左上黃色方塊已在 `a6d188b` 的 `round26-frame-crown-fix` 修正，不再列為使用者待辦。
根因是新缺口邊框與舊皇冠規則只互相覆寫一半，殘留 `width:36px;height:12px;background:var(--accent-card)`。
現行規則清成 `width:auto;height:auto;background:none`，四角裝飾保留；本輪只讓其固定 px 幾何同比縮放。

重現排查方法保留：

1. 在問題節點記錄祖先 class、`::before`／`::after` 的 computed background、content、尺寸及 stylesheet 來源。
2. 區分真正 `.hcard` 與 shadow-root 的舊 `.skin-af .card`，不要把不匹配的 selector 當根因。
3. 以同名卡、同尺寸、同像素取樣區域比較；必要時逐個停用候選規則定位，不批量刪四角裝飾。
4. 簡報記載的修前後數字（不是本輪重新量的像素數）：警狗 1250 → 64、滅世珍獸 0、快樂海豹 0。本輪另驗皇冠背景 none 與跨尺寸角落比例。

## 4. 交付及真正尚未完成的事

- 本輪建置與檢查入口仍是 brief 列出的五支 build、round8、round9、gacha regression、followup；實際退出碼看 REPORT。
- **尚未 commit，沒有 push。** Git 的 worktree index 實際位於 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo/`，沙箱拒絕建立 `index.lock`。本工作區只有讀取該共享 metadata 的權限，因此無法履行每任務一個 commit；不得把它寫成已完成。
- 揭曉光效新方案不屬本輪，不在這裡接入；遊戲整合與經濟層仍待定案。
- Portable 壓縮規格維持：demo／deluxe 為 360×504 quality 82 WebP，remade 為 420×588 quality 84。比較幾何、文字、kind、載入與可攜性，不把有損圖資當逐像素零差。
