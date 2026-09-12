# 派工簡報：5.0 新卡（九張）— 給 codex gpt-6-astra

**這一輪你是執行者**：在 `_art/holo-test/` 產出九張 5.0 精裝卡，走既有工法。不要 build 別的頁、不要起 server、不要 commit、不要動 `src/`、不要動 `card_face.js`／`demo.html`。
先讀：`docs/clicker/KICKOFF-5.0-window.md`（任務一）、`docs/clicker/METHOD-card-face.md`、`docs/clicker/HANDOFF-holo-cards.md` 第三節（卡型）、`_art/holo-test/pool_data.py`、`prepare_round32.py`（4.0 那批怎麼做的）、`build_cards_remade.py`。

## 素材（已放在 `_art/holo-test/source-5.0/`，四個檔案，實際內容如下，不要憑檔名猜）

| 檔案 | 內容 | 產幾張 |
|---|---|---|
| `悠閒時光系列 拆三張卡.jpg` 1320×2580 RGB | 粉色下午茶直式海報含裝飾外框；三個角色：端甜點的女僕牛、戴帽子的灰貓、抱蛋糕的羊 | 3 |
| `觀星系列 拆四張卡.mp4` 1080×1920 h264 無 alpha 60fps 29.5s | 會動的夜晚觀星：流星、星閃、雲飄、水波；四個角色：拿望遠鏡的羊、深藍色貓、提籃子的藍色角色、山丘上的藍色龍 | 4 |
| `究極小丑玥玥 神話.png` 794×775 RGBA | 彩虹爆炸頭＋紅鼻子＋橘色小丑裝的灰色松鼠犬（已去背） | 1 |
| `奧米加咆嘯獸 神話.png` 3840×1920 RGB | 一隻虎斑貓蜷在一大盤炒飯上，紅底；橫幅、無 alpha | 1 |

## 要做的決定（做了就寫進報告，讓使用者能一眼否決）

1. **同一幅畫拆多張卡**：每張的 subject 是誰、背景取整幅畫的哪一塊。建議同系列背景一致（像一套），但把兩種選項各出一張並排圖讓使用者選。
2. **觀星系列來源是影片**：`METHOD-card-face.md` §一的結論是動態要走 R3（three.js canvas，`build_gift_card.py` 那套，成本高）。**這輪先抽靜幀做四張 depth 卡**（挑一格流星最好看、角色沒被雲遮的），把「之後升級成動態卡」列在報告的待辦。不要在執行期用動畫 `mask-image`。
3. **稀有度與命名**：小丑玥玥＝神話、奧米加咆嘯獸＝神話（檔名寫的）。其餘七張你**提案**名字與稀有度（名字要有這個池的梗味，看 pool_data 現有名字的風格），寫進 `pool_data.py` 的新清單 `CARDS_5_0`（結構照 `EXTRA_CARDS`），並在報告列表標明「提案，待使用者定」。名字只寫在 pool_data，任何腳本不得手打。
4. **卡型**：小丑玥玥 framed；奧米加咆嘯獸 depth（貓與炒飯拆得開）或 flat，你量過再定；兩個系列拆出來的卡 depth（subject／background 兩層）。去背只能用原圖像素（GrabCut／連通區域），**不得繪製、inpaint、生成**——跟 4.0 一樣。

## 交付
- `_art/holo-test/source-5.0/` 不動；產物與 4.0 同位置同命名規則（`card-<id>.png`、layer 檔），跑既有 builder 順序讓 `cards-remade.html`／standalone 看得到新卡。
- `docs/clicker/REPORT-5.0-cards.md`：每張卡的 id／提案名／稀有度／卡型／來源裁切座標／並排圖連結；所有決定與待辦；你跑過的檢查腳本與退出碼。
- `docs/clicker/shots/5.0/` 放並排圖（本體卡面、系列一致 vs 各自背景）。
- 用 Playwright 開 `cards-remade.html` 確認九張載入、Console 無錯，數字寫進報告。
