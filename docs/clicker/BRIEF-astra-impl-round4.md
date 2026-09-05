# 珍母點點 第四輪實作：格鬥遊戲式技能切入演出、上市水準打磨（可寫檔）

先 `git log -5`，讀 `docs/clicker/REPORT-astra-impl-round3.md` 你自己列的「與範例仍有的差距」——**這輪全部要補掉**。可寫範圍：`src/clicker*.*`、`src/fonts/`（只讀）、`tools/test/clicker-*`、`docs/clicker/REPORT-astra-impl-round4.md`。不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`。不 build、不起 server、不 commit。

## 使用者原話

> 幫我設計技能發動的特效，我想要像格鬥遊戲那樣，跳出特寫角色跟一些畫面上的視線縮減強調主體那種。
> Astra 自己承認還差範例的地方全都完善，請自己找方法，我要的是有上市遊戲的水準，包含前面的技能釋放。

標準：**玩家打開視窗，第一眼分不出這是獨立小品還是上市遊戲。**

---

## 一、技能切入演出（Claude 設計，照做；細節你可以更好，但不能更淡）

參考語彙：格鬥遊戲超必殺的「Super Art 切入」——畫面瞬間暫停、壓暗、速度線往主體收束、角色大特寫從側邊撞進來、技能名蓋章、再回到戰鬥。整段 **900–1100ms**，不可跳過，但點擊輸入在切入期間照常結算（只是不演）。

### 素材（放 `src/`，我補；沒到就照檔名接）

| 檔名 | 內容 | 用途 |
|---|---|---|
| `clicker-fx-speedlines.png` | 白色放射速度線，中央留空 | 收束聚焦層，tint 成技能色 |
| `clicker-fx-speedlines-h.png` | 白色水平速度線（右→左） | 特寫面板進場時的拖線 |
| `clicker-fx-stripe-tile.png` | 黑白 45° 斜紋 tile | 特寫背板底紋（用 `mix-blend-mode: multiply` 疊在技能色上，或 CSS mask） |
| `clicker-fx-brush-banner.png` | 白色乾刷橫幅 | 技能名底 |
| `clicker-fx-impact-burst.png` | 漫畫式爆裂星形，黑描邊、中空 | 命中瞬間（重擊／寄生合體）那一格 |
| `clicker-fx-halftone-tile.png` | 黑色網點 tile | 壓暗層的漫畫網點質感 |
| `clicker-fx-ink-splash.png` | 白色墨漬 | 角色特寫背後 |
| `clicker-fx-ring.png` | 白色手繪粗圓環 | 收束環 |
| `clicker-fx-stamp.png` | 紅色橡皮章雙圈 | 技能名右下蓋章 |
| `clicker-fx-paper-grain.png` | 紙纖維顆粒 tile（8% 透明） | 疊在整個 UI 上 |

### 分鏡（時間軸，t=0 是按下技能鍵）

**0–80ms 頓住（hit-stop）**
- 舞台上珍母、包裝、粒子全部凍住（rAF 迴圈進入 `frozen`，不更新 transform；浮字暫停）。
- 全畫面壓暗層 `#cutin-dim` 進來：`#160c08` 82% ＋ `clicker-fx-halftone-tile.png` 網點 12%，80ms 淡入。**壓暗層蓋整個 960×640 含商店與夥伴列**，只有舞台中央主體區之後會被挖亮。
- 音：低頻短擊 110→70Hz 140ms gain .12（第一版定案的技能音），此刻就放。

**80–260ms 收束**
- `clicker-fx-speedlines.png` 以舞台中央為中心 `scale(1.6→1)`、opacity 0→.9，tint 成技能色（`filter: drop-shadow` 不行，用 canvas `blit` 上色或 CSS `mask-image` 把速度線當遮罩填色）。180ms `cubic-bezier(.2,.9,.3,1)`。
- 同時 `clicker-fx-ring.png` 從 `scale(2.2)` 收到 `scale(.9)`，opacity 1→0，收到主體上。
- 上下兩條黑色 letterbox（各 56px 高）從外滑入舞台區，`#30251F`，帶 2px 奶白內線。
- 視線焦點：壓暗層用 `mask` 或第二層徑向漸層，在**技能發動者**位置留一個 260px 亮圈（珍母寄生時是珍母，玥玥／膠布是牠們在夥伴列的貼紙？不是——見下「發動者定位」）。

**260–520ms 特寫撞入**
- 特寫面板 `#cutin-panel`：寬 520px、高 300px，置於舞台中央偏發動者側，背板＝技能色平塗＋斜紋 tile（multiply, 18%），黑描邊 4px，向右傾 -6°（skewX）。從畫面外側 `translateX(±120%)` 撞進來，**80ms 到位、超衝 12px、60ms 回彈**（`cubic-bezier(.17,.89,.32,1.28)`）。
- 面板進場的同一幀，`clicker-fx-speedlines-h.png` 在面板後方以 tint 白 40% 拖出，120ms 淡出。
- 角色特寫：用 `card.art.create(entry)` 拿本尊 SVG，放大到 **高 340px**（超出面板上緣，頭部露出面板頂，這是格鬥切入的標準構圖），置於面板左 1/3，背後一張 `clicker-fx-ink-splash.png` tint 成技能色的淺版。角色 rig 做一次招牌動作（第一版技能表：玥玥尾巴掃、膠布揮刀臂、珍母觸手張開；用 `setLimb` 400ms，中途一次眨眼）。
- 角色進場比面板晚 40ms、從面板外側滑入 60px，帶 `scale(1.08→1)`。
- 命中格：面板到位那一幀，`clicker-fx-impact-burst.png` 在角色胸前 `scale(.4→1.15)` 90ms 然後 60ms 消失；整個舞台 `translate(4px,-3px)` 抖 3 幀（沿用 shake-soft）。
- 音：面板到位 whoosh（白噪音 60ms 掃頻 3k→600Hz gain .08）＋命中「啪」（noiseHit 30ms gain .15）。

**520–820ms 技能名蓋章**
- `clicker-fx-brush-banner.png` tint 成奶白，橫過面板右 2/3，`scaleX(0→1)` 從左向右 120ms 刷出。
- 技能名（字型見第二節，48px、`#30251F`、字距 .06em）在刷完那幀 `scale(1.3→1)` 80ms 落下；副標（角色名＋效果一句，18px）從下方 8px 淡入。
- `clicker-fx-stamp.png` 在技能名右下 `scale(1.6→1)`＋ `rotate(-12°)` 100ms 蓋下，章內文字「發動」（或效果數字 ×2／×10）。蓋下那幀再一次 shake-soft＋短「咚」（tone 180Hz 60ms gain .1）。

**820–1050ms 退場**
- 面板向進場的反方向 `translateX(±130%)` 滑出 160ms（`ease-in`），角色跟著。
- 速度線、letterbox、壓暗層 180ms 淡出；舞台解凍；技能效果標籤（現有 `#effect-label`）在珍母頭上彈出。
- 寄生技能特例：退場後接現有 300ms 合體（宿主頭像標籤），合體那幀再打一次小的 impact-burst。

### 技能色

| 技能 | 主色 | 面板斜紋色 |
|---|---|---|
| 玥玥 尾巴節拍（精良） | `#94BED0` | `#5E93AA` |
| 膠布原版 一刀開封（傳說） | `#E9B94E` | `#B8862A` |
| 珍母 這個頭我收下了（傳說） | `#E9B94E`，主體白 | `#B8862A` |
| 其餘九隻（後續） | 依稀有度：史詩 `#B8A2CF`／精良 `#94BED0` | 深一階 |

### 發動者定位
- 珍母：舞台中央本體。亮圈套在珍母。面板從右側撞入（珍母在左）。
- 其他角色：亮圈套在舞台中央（切入時舞台主體就是特寫本身），面板從左側撞入。夥伴列上該角色的貼紙格同時 `scale(1.15)` 亮一下＋槽位章閃。

### 規則
- 切入期間 `#tap` 仍收輸入並結算，但不噴粒子、不出浮字；退場後把累積收益合成一個浮字彈出。
- 招募層開啟時不能發動（維持）。
- 減少動態偏好：只保留壓暗＋面板淡入淡出＋技能名，不做撞入與抖動。
- 切入用獨立 `#cutin` 層（z 在浮字之上、招募層之下），結束後 `replaceChildren()`，不留 rAF。
- 所有時間常數集中在 `clicker-cutin.js` 頂部一個 `T` 物件，方便調。

---

## 二、字型：換成手寫感圓體

`src/fonts/jf-openhuninn-2.1.ttf`（jf open 粉圓，SIL OFL 1.1，授權檔在同目錄）。

```css
@font-face { font-family: 'Huninn'; src: url('fonts/jf-openhuninn-2.1.ttf') format('truetype'); font-display: block; }
```

- 全部 clicker 介面（含招募層頂列、切入技能名、浮字、名冊）改 `font-family: 'Huninn', 'Microsoft JhengHei', sans-serif`。
- 字級表因字型變寬要重校：標題 24→26、金幣 32→34、按鈕 15→16、說明 13→14；`font-weight` 粉圓只有一個字重，用 `-webkit-text-stroke: .6px currentColor` 做「粗」的層級（標題、金幣、按鈕），說明文字不加。
- 字型載入前避免閃爍：`font-display: block`＋在 `card.ready` 之外再 `await document.fonts.ready`。

---

## 三、素材換成手繪筆觸版

我會用同檔名覆蓋 `clicker-ui-*.png`（frame／mat／paper／btn-*／label*／ticket／coinplate／title-tape／kraft）為「線條會抖、填色不均、有紙纖維」的版本。你要：
- 重新量 9-slice 切片值（線條粗細可能變）。
- 整個 `#game` 最上層疊 `clicker-fx-paper-grain.png` tile（`pointer-events:none`, opacity .5），讓所有平塗都有紙感。
- 角色貼紙頭像、包裝、旗子不動。

---

## 四、夥伴區密度與版面（你自己指出比範例密）

改成範例的一排：
- **夥伴列改為全寬 928px、一頁 10 格**（格 80×88 不變），標頭「我的夥伴」＋愛心貼紙在左，翻頁在右。
- **三個技能槽搬進舞台**：做成三顆 **64px 圓形貼紙按鈕**（`clicker-ui-sticker-badge.png` 框＋角色 40px 頭像），停在桌墊**左下角**一排（x 28／100／172，y 舞台底 -84），像格鬥遊戲的必殺技槽。冷卻用 `conic-gradient` 遮罩從 12 點鐘順時針退掉（1Hz 更新即可，不做連續旋轉），可發動時外框脈動一次（不是無限動畫：每次變成可發動時做一次 `scale(1→1.12→1)`）。空槽是灰貼紙＋「＋」，點了開名冊選人。名字／剩餘次數用小紙章浮在按鈕右上。
- 舞台高度不變，珍母與包裝位置不變；技能槽在桌墊上不遮包裝（包裝在右下）。
- 名冊裡的「裝備至槽 N」保留。

---

## 五、其他上市水準的打磨（逐條做）

1. **按鈕手感**：hover 上浮 1px＋填色亮 6%，按下 `translateY(3px)` 陰影縮短，放開回彈 `cubic-bezier(.2,1.4,.4,1)` 120ms；禁用時圖示也換灰。
2. **面板進場**：視窗開啟時五區依序 60ms 間隔從下方 12px 淡入（只在開窗那次，減少動態則不做）。
3. **餘額牌**：金幣圖在收益進帳時「叮」一下 `rotate(-10°→0)` 已做；再加大額（≥ 每秒收益 ×10 的單次進帳）時牌子 `scale(1.04)` 一拍。
4. **量尺**：填滿的那一格用粉色→金色 200ms 轉色再歸零。
5. **包裝撕開**：撕開那幀噴 6 片碎紙＋一次 impact-burst 小版（scale .5），「完成 N 包」用紙章從包裝上方彈出。
6. **教學條**：改成黏在桌墊上緣的紙膠帶便條（用 `clicker-ui-tape-0.png` 壓角），完成後撕走（`rotate(-8°)`＋往上飛 240ms）。
7. **名冊／統計／收據面板**：改成紙板卡（`clicker-ui-paper.png`），標題用標題帶，關閉鍵用 cream 按鈕；面板進場 `scale(.96→1)` 140ms。
8. **空狀態文案**要有人味：夥伴列空時「還沒有夥伴。點 50 次，玥玥會來幫忙。」；技能槽空「點我選一位夥伴」。
9. **hover 提示**：所有圖示按鈕加 `title`。
10. **音效**：升級／招募／收下／技能各自的音維持第一版定案；新增切入音三段。

---

## 六、驗收與交付

- `node --check`、`npm test` 全綠。
- `tools/test/clicker-browser.py` 新增：切入分鏡 t=120／400／700／950ms 各一張（三個技能各自一組）、字型載入後的主畫面、技能槽三種狀態（空／冷卻／可發動）、夥伴 10 格滿頁、名冊紙板卡。
- `docs/clicker/REPORT-astra-impl-round4.md`：改了什麼、切入實際時間軸、還差什麼（誠實），並附「如果我是上市遊戲的美術總監還會改哪三件事」。
