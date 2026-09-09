# 派工簡報（第四十輪）：把 4.0 的五張神話卡做完

日期：2026-09-10。分支 `holo-cards`，工作區 **`D:\claude研究\clawd-pet-holo`**（git worktree）。
⚠ 路徑含中文，指令用相對路徑或先 `cd` 進工作區。

**素材已經到位**：`C:\Users\spesh\OneDrive\Desktop\4.0`（16 張原圖 ＋ `怪物/`）。
`prepare_round32.py` 的 `SOURCE` 寫死成 `C:\Users\ASUS User VII\Desktop\新卡\4.0`（另一台機器的使用者），
**要改成可設定**（環境變數或自動偵測兩個候選路徑），不要在這台硬改成只有這台能跑。

## 〇、必讀

1. `docs/clicker/PLAN-round36-depth.md` — **本輪的規劃與量測全在這裡**，先讀完。
2. `docs/clicker/ISSUES-2026-09-09-night.md` 第一節 — 使用者原話與已裁決的「外推補洞」路線。
3. `角色製作工法.md` 第 1 節 — 去背四步驟（流浪玥手要用）。
4. `docs/clicker/HANDOFF-2026-09-09-night.md` 第三節 — 新卡進卡池的工法與建置順序。
5. `_art/holo-test/bright_edge.py` 檔頭 — 亮邊判準，以及**檔頭記著的待辦**：
   `prepare_round32.py` 的 defringe 用的是沒有飽和度保護的規則，會剝掉飽和填色。
   本輪要重跑去背，**順便把 `sat_ok()` 接進 defringe**。

## 〇之二、使用者已裁決 vs 我代為裁決

使用者已裁決（`ISSUES` 第一節）：
- 補洞走**外推**（只用原圖既有像素，不重繪、不生成）
- `流浪玥手` 改成 **`framed`**

以下四項使用者尚未回覆（他去睡了，指示是「把 4.0 的卡片都完成」），
**由我依 `PLAN-round36-depth.md` 的量測代為裁決，並在報告明確標示「待使用者追認」**：

| 卡 | 決定 | 依據 |
|---|---|---|
| `zhenqiqiu` 珍氣球 | depth，5:7 **純裁切** | 內容橫跨 817px／視窗 607px，裁掉的是兩側的雲，主體完整 |
| `zhenjunyue` 真菌玥 | depth，5:7 **純裁切** | 內容 748px／視窗 571px，裁掉外圍蘑菇，主體完整 |
| `shabaolingzhu` 沙堡領主 | depth，**垂直外推背景**補成 5:7 | 純裁切會切掉 339px（39%），沙堡與羊分居兩側，一定會犧牲一邊 |
| `zhenzhen` 珍珍 | **維持 flat，不做 depth** | 它是貼紙拼盤、所有元素同一平面，視差沒有意義；且 5:7 純裁切會失去 1054px（52%），垂直外推要補 1477px（原圖高的 107%），兩條都不可接受 |

**珍珍那張若使用者明天要求仍要做 depth，再開一輪**，本輪不要硬做。

## 一、沙堡領主有一個技術陷阱：主體在背景**後面**

原圖的前後關係是 `天空／沙灘（遠） → 羊（中） → 沙堡（近）`——**羊有一部分被沙堡擋住**。

`card_face.js` 的 depth 只有 subject／background 兩層，而 subject 是往前推的。
若照 `ISSUES` 字面「主體＝羊」去拆，羊會被推到沙堡**前面**，遮擋關係就反了。

**本輪的定義**：subject = **沙堡**（最靠近觀眾的那一層），background = 羊＋沙灘＋天空。
兩層就夠、遮擋關係正確，而且要補的洞變成沙堡底下的平坦沙灘，比挖羊還簡單。

## 二、每張要做的事

### 2-1. 三張 depth（珍氣球、真菌玥、沙堡領主）

輸出 `_art/holo-test/layer-<id>-subject.png` 與 `layer-<id>-background.png`，
**兩層都是 600×840、同一個裁切矩形**（`recrop_round10.py` 的做法：兩層一起裁，視差才對得齊）。

補洞規則（**硬性**）：

| 條件 | 門檻 |
|---|---|
| 補洞只能用原圖既有像素 | edge-extend／clone；**不准生成式補圖、不准重繪、不准拉伸變形** |
| 最大視差位移時，背景層不得露出未填的洞 | 未填像素 **= 0** |
| 補洞邊界的色彩連續性 | 邊界兩側各 3px 帶的平均色差 **≤ 8 灰階** |
| 主體不得被裁到 | 主體的 alpha bbox 必須完整落在畫布內 |

沙堡領主的垂直外推額外條件：

| 條件 | 門檻 |
|---|---|
| 外推只能沿用最上／最下緣的既有像素 | 不得產生新形狀 |
| 外推區域佔最終畫布 | ≤ 30% |
| 外推區的色彩連續性 | 與相鄰原圖區的平均色差 ≤ 6 灰階 |

**逐張都要附**：補洞前／補洞後／最大視差位移時的截圖，以及上表每一項的實測數字。

### 2-2. 流浪玥手改 framed

走 `角色製作工法.md` 第 1 節：邊緣近白洪水填充（門檻 235，**只清與邊緣相連的**）→
最大元件 → defringe。輸出 RGBA、緊裁、**高度統一 580**。

⚠ 兩個坑：
- **這張的白色也是原背景的一部分**（第三十二輪報告寫過），狼身上與草地的白不能被吃掉。
  洪水填充只能清與邊緣相連的白，要逐項回報「封閉白元件數／白像素／移除白像素／新內部透明洞」。
- **defringe 要接上 `bright_edge.sat_ok()`**（近白**且**低飽和才剝），否則會剝掉飽和填色。
  接上之後 `check_bright_edge.py` 必須仍然 11 張（加上新的就是 12 張）全部 ≤1%。

### 2-3. 資料與建置

- `pool_data.py` 的 `EXTRA_CARDS`：三張改成 `kind:'depth'` **並且** `scene:True`
  （`embed_masks.py` 的路徑解析是看 `scene` 決定去拿 `layer-<id>-subject.png`，
  只設 `kind` 會抓錯檔——`ISSUES` 第一節已經標出來）；`liulangyueshou` 改 `kind:'framed'`；
  `zhenzhen` 不動。
- 建置順序（`HANDOFF` 第三節）：
  `build_card_scenes.py` → `embed_masks.py` → `build_cards_remade.py` →
  `build_cards_remade_standalone.py` → `build_deluxe_b.py` → `build_deluxe_b_standalone.py`。
- **不改 `src/gacha-pool.js`**、不改 `RATE`、不改 `card_face.js`、不改卡面幾何／Z／字級。

## 三、驗收（**你要自己跑完並記錄真實 exit code**）

| 腳本 | 要求 |
|---|---|
| `check_demo_round8.py` | exit 0 |
| `check_demo_round9.py` | exit 0（卡數會變，斷言要跟著資料走，**不准只刪斷言換綠燈**）|
| `check_gacha_card_regression.py` | exit 0 |
| `check_gacha_followup.py` | exit 0 |
| `check_bright_edge.py` | exit 0，全部 ≤1% |
| `check_new_cards_round32.py` | 跑，記錄結果；缺原圖那項現在應該可以真的跑起來了 |
| `check_gift_card.py`、`check_gift_perf.py` | 也要跑，**證明本輪沒有動到魔花少女** |

另外：三張 depth 卡在 `cards-remade-standalone.html` 與 `deluxe-gacha-b-standalone.html`
兩個入口都要能正常顯示，**單檔要複製到別的資料夾再開**才算驗過。

## 四、交付

1. 每張卡的處理方式、原圖尺寸、輸出尺寸、補洞數字、去背數字，一張表。
2. 三張 depth 的補洞前／後／最大視差截圖；流浪玥手的去背前後對照。
3. 所有驗收的真實 exit code 表；沒過的照實列出來，**不准改門檻湊綠燈**。
4. 報告 `docs/clicker/REPORT-holo-round40.md`，**用中文寫**，
   並在開頭標明「〇之二的四項決定是代為裁決，待使用者追認」。
5. 截圖與量測 JSON 放 `docs/clicker/shots/round40/`。
6. **不要 commit、不要 push**（我會在全部驗完之後統一處理）。

## 五、允許你否決我

每張卡的 5:7 路線、沙堡領主的 subject 定義、補洞的門檻數字，
只要拿得出量測都可以改，在報告寫明「原本要求什麼、量到什麼、所以改成什麼」。
但**「不准重繪、不准生成、不准拉伸」與既有驗收門檻不可以放寬**。
