# 珍母點點 第二輪實作：手作桌視覺、夥伴列、五狀態包裝、點擊粒子（可寫檔）

先 `git log -3`。讀你上一輪寫的 `docs/clicker/DESIGN-astra-visual-round2.md`（視覺定案）——**照它做，除了下面「與定案不同的地方」**。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`。不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*.js`／`gacha-card.css`。不要 build、不要起 server、不要 commit。

## 使用者原話（這輪要解的四件事）

> 畫面看起來很廉價。請跟 Astra 討論如何不要有 AI 味道，或是讓她不受限生成幾張參考圖片，你們吸取好的地方。
> 我希望隊員在額外的 UI 裡面，不要出現在主要點擊區域。
> 撕開的包裝很醜、很歪，包裝也不好看。
> 幫我新增點擊會出現的粒子特效，現在很空虛。

## 參考圖（一定要看）

`docs/clicker/shots/ref-mock-a.png` 是 imagegen 不受限畫出來的整畫面概念圖，**定為主方向**：牛皮紙板外框、鼠尾草綠紙桌墊＋奶白虛線縫邊、奶白紙標籤板、粉色標題帶、四處貼一點膠帶、厚黑描邊＋硬偏移陰影的圓角按鈕、下方一排圓形貼紙頭像的「MY BUDDIES」夥伴列、左上一支小旗子。`ref-mock-b.png`（零食攤棚）與 `ref-mock-c.png`（筆記本）是副參考，可借細節（b 的價籤掛牌、c 的膠帶貼照片）。不要照抄英文字與版位，我們的五區座標不變。

## 與你的視覺定案不同的地方（使用者拍板）

1. **不拿掉材質。** 你建議「移除紙紋背景改平塗」，但使用者的規矩是「要商業水準就要真素材，程式幾何撐不起來」。改成：外框用牛皮紙板貼圖平鋪，舞台桌墊、面板、標題帶都用生成的 9-slice 貼圖（下節），CSS 只負責排版與按鈕。
2. **粒子不要小氣。** 你配 4–8 顆，使用者說「很空虛」。改為：普通點擊 **8 顆**（6 片紙屑＋2 顆金色小閃）、連點 **12 顆**、×10 重擊 **18 顆**＋一道光痕＋包裝 `scale(1→1.10→.97→1)` 180ms。紙屑用 `GachaFx` 既有的 `shape: 'shard'`（平塗方形碎紙，有 `w/h/color/color2/rot/vr`，不透明、`blend:'source-over'`）——這才是真正的紙屑，不用 sprite 9 湊。顏色：包裝粉 `#EF8E8E` 四片、奶白 `#FFF3DC` 兩片；金色小閃用 sprite 14，`blend:'lighter'`，`#E9B94E`。其餘參數（vx/vy/g/life/r/drag、撕口錨點、連點 ≤180ms 第三擊起、優先序 重擊＞跨狀態＞普通、浮字同落點）照你的定案。
3. **夥伴列用貼紙頭像**（mock-a 的樣子）：每格是一張圓形白貼紙（`clicker-ui-sticker-badge.png`，中空可放頭像）套住角色 SVG 縮圖，貼紙下方名字 12px、星級「★3」、槽位小紙章、稀有度 4px 色帶照你的定案。80×88 格、一頁六格、翻頁、點格開名冊——都照定案。
4. **五狀態包裝已經生好**，不用等素材、不用寫 prompt：`src/clicker-bag-0.png`…`clicker-bag-4.png`，**448×512 RGBA，袋底基準 y480、水平中心 x224**，五幀已對齊。0 完整、1 輕損、2 中損、3 重損、4 撕開。顯示高度 176px（含透明邊），依剩餘比例 R 切換照定案；撕開幀由「包數增加」事件觸發。**刪掉 `clicker-tear.png` 與三張撕痕的演法、刪掉舊 `clicker-bag.png`／`clicker-bag-open.png` 的引用。**
5. 寄生：照定案改成宿主頭像標籤，不再把宿主 SVG 放進舞台。

## UI 貼圖（放在 `src/`，全部真 alpha 除了牛皮紙）

| 檔名 | 內容 | 怎麼用 |
|---|---|---|
| `clicker-ui-kraft.png` | 512×512 不透明牛皮紙板，可平鋪 | `#game` 背景 `background: url() repeat`，取代 `clicker-desk.png`（可刪其引用） |
| `clicker-ui-mat.png` | 鼠尾草綠桌墊，厚黑描邊＋內側奶白虛線，圓角 | 主舞台底：`border-image: url() 96 / 48px round`（切片值以圖為準，你載入後量：描邊＋虛線約佔 96px） |
| `clicker-ui-paper.png` | 奶白紙板，厚黑描邊，圓角 | 商店三張卡、下方夥伴／技能底座、頂列金幣標籤：同樣 `border-image` 9-slice |
| `clicker-ui-label.png` | 粉色圓角標題帶 | 區塊標題（手勁／全隊訓練／招募夥伴／我的夥伴／技能）：9-slice，文字疊上去 |
| `clicker-ui-label-green.png` / `-purple.png` | 綠／紫標題帶 | 綠給全隊訓練與技能區，紫給招募（呼應 mock-a） |
| `clicker-ui-tape-0.png`…`-3.png` | 四種紙膠帶（粉點、黃、綠斜紋、紫心） | 裝飾：每個大區最多一處，全畫面最多四處，旋轉 ±2～6° |
| `clicker-ui-flag.png` | 小粉旗＋肉球 | 舞台左上角裝飾（mock-a 左上那支） |
| `clicker-ui-sticker-badge.png` | 中空圓形白貼紙 | 夥伴列頭像框 |

實際像素尺寸以檔案為準，用 CSS 定顯示尺寸。若你開工時某張還沒到，先照檔名接上留註解。

按鈕不用貼圖：CSS 厚描邊 3px `#30251F`、圓角 9px、硬陰影 `0 4px 0 #30251F`、按下 `translateY(3px)` 陰影 1px、hover 只換填色；主按鈕填 `#9BAF6B`（綠）或 `#EF8E8E`（粉），次按鈕奶白。禁用用實色 `#DED4C3`／`#8B7D6C`，不降透明度。字級表照定案，數字 `tabular-nums`。

## 範圍（照定案第 6 節 A＋B 全做）

A1 色板／描邊／陰影／字級、移除舞台大框改桌墊；A2 商店主次按鈕與實色禁用、通知改到夥伴列標頭；A3 底部夥伴列＋三技能卡；A4 隊員移出舞台、入隊飛到夥伴格（帶揭曉卡位置）、寄生頭像標籤；A5 桌墊、接觸影、紙膠帶量尺；A6 撤撕痕；A7 主畫面 `#click-fx` canvas、單一 renderer 切換、每擊粒子、浮字同落點、連點與 ×10。B1–B2 五狀態包裝接入（素材已備）。

粒子 canvas 切換照定案第 4 節「Canvas 接線」：主畫面 `#click-fx` 960×640 在角色與包裝之上、浮字之下；進招募前停主畫面 scope、`GachaFx.init()` 指向招募 canvas；退出後指回。**招募層的揭曉粒子、射線、整桌震維持現狀，不准減。**

## 驗收與交付

寫 `docs/clicker/REPORT-astra-impl-round2.md`：改了哪些檔、與定案不同處與原因、未完成、你的驗證方式。`node --check` 每個 JS、`npm test` 全綠（經濟測試若因介面變動需要更新，說明原因）。更新 `tools/test/clicker-browser.py` 讓它能產出定案第 7 節列的驗收畫面（至少：一位夥伴／六位／七位以上、寄生中、五狀態包裝各一張、普通點擊粒子瞬間、×10 瞬間）到 `tools/test/.clicker-artifacts/`（已 gitignore）。
