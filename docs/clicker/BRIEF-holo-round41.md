# 派工簡報（第四十一輪）：讓另一台機器 clone 下來就能重建

日期：2026-09-10。分支 `holo-cards`，工作區 **`D:\claude研究\clawd-pet-holo`**（git worktree）。
⚠ 路徑含中文，指令用相對路徑或先 `cd` 進工作區。

## 〇、起因（這是交付風險，不是加功能）

使用者原話：

> 明天我要另一台電腦也能下載到 魔花少女 與 4.0影片的卡面和素材，不然我就沒辦法開發了

**現況做不到。** 所有原始素材都在桌面、不在版控裡：

| 素材 | 現在的位置 | 大小 | 誰在用 |
|---|---|---:|---|
| `mtk1.mov` | `C:\Users\spesh\OneDrive\Desktop\` | 33.0 MB | `build_gift_card.py`（魔花少女的常態動畫）|
| `mtk2.mov` | 同上 | 26.6 MB | 同上（特殊動作）|
| `IMG_1820.png` | 同上 | 0.1 MB | 同上（背景）|
| `4.0\`（16 張原圖 ＋ `怪物\`）| `C:\Users\spesh\OneDrive\Desktop\4.0` | 8.2 MB | `prepare_round32.py`、第四十輪的 depth |

而且兩支建置腳本都是去讀 `Path.home()/'OneDrive/Desktop'` 或寫死的絕對路徑，
**換一台機器就跑不動**。第三十二輪的報告已經記過同樣的問題
（`SOURCE` 寫死成 `C:\Users\ASUS User VII\...`，換機器直接 exit 1）。

repo 現有最大檔是 13.4 MB，沒有設定 LFS。兩支影片都在 GitHub 的單檔 100 MB 限制內，
**直接進版控即可，不要引入 LFS**（引入 LFS 會讓另一台還要多裝東西，違背這輪的目的）。

## 一、要做的事

### 1-1. 素材進版控

建立並放入（**用複製，不要移動桌面的原檔**）：

```
_art/holo-test/gift/source/mtk1.mov
_art/holo-test/gift/source/mtk2.mov
_art/holo-test/gift/source/IMG_1820.png
_art/holo-test/source-4.0/<16 張原圖>
_art/holo-test/source-4.0/怪物/<4 個檔>
```

- 先確認 `.gitignore` 不會吃掉這些路徑（現有規則 `_art/out/`、`_art/*.json`、
  `_art/*-source.png` 只匹配 `_art/` 的直接子項，理論上不影響，但**要實際用
  `git check-ignore -v` 逐檔確認**並把結果列進報告）。
- 放進去之後對每個檔算 SHA-256，與桌面原檔比對，確認位元組相同。

### 1-2. 兩支腳本改成「版控優先、桌面備援」

`build_gift_card.py` 與 `prepare_round32.py` 的來源解析改成依序找：

1. repo 內的路徑（上面那幾個）
2. `Path.home()/'OneDrive/Desktop'` 底下的舊位置
3. 環境變數覆寫（例如 `HOLO_SOURCE_4_0`），方便之後換機器

找不到時要**明確報錯並印出它找過哪些路徑**，不要靜默失敗或用半套素材繼續跑。

### 1-3. 衍生素材也要在版控裡

`_art/holo-test/gift/` 底下由 `build_gift_card.py` 產生的
`layer-mohuashaonv-*.webp`／`-mask.webp`／背景 PNG／`manifest.json`，
以及第四十輪產生的 `layer-<id>-subject.png`／`layer-<id>-background.png`，
**都要確認在版控裡**（`git status` 不能只剩 untracked）。
產物 `gift-mohuashaonv.html`、`cards-remade*.html`、`deluxe-gacha-b*.html` 同理。

## 二、驗收：**要證明「只有 repo」也能重建**

這是本輪唯一重要的驗收，不能只是「檔案有加進去」。

1. 把桌面的來源暫時改名（例如 `4.0` → `4.0__hidden`、`mtk1.mov` → `mtk1__hidden.mov`），
   讓舊路徑**確實不存在**。
2. 在這個狀態下完整重跑：
   - `python build_gift_card.py`
   - `python prepare_round32.py`（或第四十輪用到的等效入口）
   - 第四十輪的建置順序：`build_card_scenes.py` → `embed_masks.py` →
     `build_cards_remade.py` → `build_cards_remade_standalone.py` →
     `build_deluxe_b.py` → `build_deluxe_b_standalone.py`
3. 再跑一次完整驗收：`check_gift_card.py`、`check_gift_perf.py`、
   `check_demo_round8.py`、`check_demo_round9.py`、`check_gacha_card_regression.py`、
   `check_gacha_followup.py`、`check_bright_edge.py`。
4. **全部通過之後，把桌面的名字改回來**（不要留下改名的殘骸）。

報告要列出：改名前後的路徑、每一支的真實 exit code、以及「重建出來的產物與改名前的
SHA-256 是否相同」（不同的話要解釋為什麼，例如 WebP 編碼器的非決定性）。

**如果任何一支在「桌面素材不存在」的情況下失敗，那就是這輪沒做到**，
照實回報，不要把桌面路徑加回去湊過。

## 三、交付

1. 素材清單表（檔名、大小、SHA-256、`git check-ignore` 結果）。
2. 兩支腳本的來源解析改動 diff。
3. 第二節那個「桌面素材不存在」的完整重建與驗收紀錄，含真實 exit code。
4. `git status --porcelain` 的完整輸出，確認**沒有該進版控卻還是 untracked 的素材或產物**。
5. 報告 `docs/clicker/REPORT-holo-round41.md`，**用中文寫**。
6. **不要 commit、不要 push**（我會統一處理）。

## 四、不准做的事

- 不准引入 git LFS。
- 不准把桌面的原檔移走或刪掉（只能複製）。
- 不准為了縮小體積重新編碼那兩支 `.mov`（原始素材要保持位元組相同）。
- 不准動卡面幾何、`card_face.js`、卡池資料、第三十六～四十輪已通過的任何門檻。
