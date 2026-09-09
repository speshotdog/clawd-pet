# 派工簡報（第三十一輪）：三個圖層／互動缺陷修正 ＋ 高階揭曉手感加長 ＋ 抽卡背景重做

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree；**不要**碰 `D:\claude\clawd-pet`，**不要修改 `src/`**）。
你是**實作者兼設計者**。本輪沒有另外的設計文件，規格就是本簡報。

## 〇、必讀（動手前）

1. `docs/clicker/LESSONS-2026-09-09.md` — **整份**。本輪四件事有三件正中裡面已經寫過的坑：
   - 第一節：`preserve-3d` 裡**誰在前面由 `translateZ` 決定，不是 `z-index`**；推越高被透視放越大；**要蓋過別人是把別人降下來**。這輪 A、B 兩題都是這條。
   - 第三節第 4 條：**互動類驗收要驗像素，不能只驗 CSS 變數**。
   - 第六節第 2 條：**報告與 commit 訊息不准寫沒跑過的結論**，每支驗收回報真實 exit code。
2. `docs/clicker/HANDOFF-holo-cards.md` 六之四／六之五 — **卡面凍結**。`card_face.js` 的幾何、Z 分層（背景 2px → 圖層 6px → 卡框 8px → 文字框 13px → 文字 40px → 寶石 42px）、字級一律不動。本輪只動**卡外的演出層與背景**。
3. `docs/clicker/REPORT-holo-round30.md` ＋ `docs/clicker/TODO-next-round.md` — 現況（entry／ceremony／results 三畫面、`ceremony.js`／`ceremony-fx.js`／`ceremony-layout.js`／`ceremony-audio.js`／`ceremony.css`、原版粒子與音效已移植）。
4. `docs/clicker/RESEARCH-gacha-ui-resources.md` — 已查證過的外部資源與**授權判斷**。本輪 E 題要用，不要重查已經寫過的條目。

建置順序（有依賴）：

```
python _art/holo-test/build_deluxe_b.py
python _art/holo-test/build_deluxe_b_standalone.py
```

產物：`_art/holo-test/deluxe-gacha-b.html`（dev）、`deluxe-gacha-b-standalone.html`（單檔）。**兩個入口都要驗**，單檔版要**複製到另一個資料夾再開**才算驗過（LESSONS 第五節）。

---

## 一、使用者本輪裁決（2026-09-09 夜）

原話：

> (圖一) 傳說 神話 底色的這種四散光芒 照理來說圖層不能比卡面高
> (圖二) 卡片 的圓形向外擴的特效 圖層不能在卡面後面
> (圖三) 雖然設計可以用滑鼠拖角度 但滑鼠放開 要讓他回正
> 傳說 神話 抽到的動畫應該持續更長一點 手感才會好。像是初版的珍母點點 他抽到傳說或神話 都會微微抖動 持續散發光芒 才會翻開炸出光芒。現在直接開 少一點手感
> 幫我設計抽卡的背景 請幫我去找 github 上的開源 或是幾何圖形

以下 A～E 五題，全部要做完。

---

## A. 傳說／神話的放射光芒不得蓋在卡面之上

**症狀（使用者截圖一）**：傳說卡揭曉時，金色四散射線畫在卡面**上方**——射線橫跨卡框、蓋住角色立繪與「傳說 / LEGENDARY」銘牌，整張卡被 `lighter` 疊到發白。

**現況程式**：

- `_art/holo-test/ceremony-fx.js` `rays()`（約 190 行起）回傳的 layer 帶 `under: true`，理應畫在 `lower` canvas。
- `_art/holo-test/ceremony.js` `runCanvasFx()`（約 224 行）建 `upper` / `lower` 兩張 canvas，`engine.init(upper, lower)`。
- `ceremony.css:93-94`：`.ceremony-canvas{z-index:4}`、`.ceremony-canvas.under{z-index:1}`；`ceremony.css:44/53/54`：`.slot{z-index:2}`、`.slot.selected{z-index:7}`、`.slot.is-revealing{z-index:10}`。

**這裡有帳面矛盾，先量再改，不要照我的猜測動手**：帳面上 under=1 < slot=2，射線本來就該在卡後面，但畫面不是。可能的成因（自己驗證，不要三個都改）：

1. 揭曉結束、`completeSlot()` 移除 `is-revealing` 後 slot 掉回 `z-index:2`，而 `upper` canvas 是 4 —— **這時候整張上層 canvas 就跑到卡片前面了**。射線 hold 1.6s ＋ fadeOut 會延續到這之後。同一個問題也讓 `strengthen()` 裡那顆 `ring(...,1.04,410,14)`（畫在 upper）蓋到卡。
2. `strengthen()` 走了某條路徑讓 rays 落到 upper（例如 `init()` 沒拿到 `underEl` 時 `under` 會 fallback 成 `ctx`）。
3. `.fan` / `.slot` 的堆疊脈絡與 `preserve-3d` 交互作用，使 slot 的 `z-index` 沒有照預期參與 `stage` 的堆疊。

**要求**：

1. 先寫一支最小重現，**逐幀量像素**證明射線確實蓋在卡上，並指出真正成因。報告要寫「量到什麼」，不是「我認為」。
2. 修正後的**契約**：從 `face-visible` 起到演出全部結束（含 fadeOut 尾韻、含 `is-revealing` 被移除之後、含滑鼠 hover／selected 狀態），**卡面矩形內不得被任何 canvas 特效層覆蓋**。射線、底光、`flash` 全部只能在卡後面。
3. **不要用「把卡片 `translateZ` 推高」來解**（LESSONS 第一節：推高會被透視放大，卡面幾何是凍結的）。正確解法是把上層 canvas 降到卡片之下、或把該落在後面的效果全部歸到 `lower`、或給 slot 一個穩定且恆大於 canvas 的 `z-index`（三選一，選你能證明沒有副作用的那個）。
4. **不得因此弄丟**射線本身：亮度峰值與持續時間必須維持 round 30 量到的數值（`REPORT-holo-round30.md` 的原版對照表），不准為了修圖層順序而縮短尾韻或減粒子。

## B. 圓形向外擴的環不得被卡面遮住

**症狀（使用者截圖二）**：卡片周圍那圈往外擴的環，被卡片**擋掉中間一大塊**，看起來像從卡背後長出來的破環，而不是從卡片中心炸開的衝擊波。

**現況程式**：CSS 效果層由 `ceremony.js` `fx()`（約 186 行）建立，`s.anchor.append(e)`；而 `ceremony.css:47`：

```css
.reveal-anchor{pointer-events:none;transform:translateZ(-200px)}
```

`-200px` 把所有 `.rarity-fx`（`fx-substrate-wave` / `fx-spectrum-wave` / `fx-counter-wave` / `mythic-ripple` / `fx-*-ring` / `fx-flake`）整組推到卡片後面。

**要求**：

1. 讓「向外擴的環」在**視覺上壓過卡面邊緣**（環通過卡片時要看得到環壓在卡上，不是被切斷）。
2. **警告（LESSONS 第一節第 2、3 列）**：`.reveal-anchor` 直接改成正的 `translateZ` 會被透視**放大**，環的直徑與線寬會全部跑掉（`fx()` 是用 `focusWidth()` 的 px 在算寬度的）。若採此路，必須同步用 `scale(1/(1+z/perspective))` 之類的補償，並**用像素量出補償後的環直徑與改動前一致**；或者改成把環拆成前後兩層（後層留 -200px 當底光、前層 Z≈0 疊在卡上、用較低不透明度），這條通常比較安全。
3. 所有層的 `translateZ` **上界 ≤ 42px**（凍結分層規則），不得為了這題突破。
4. 修完要確認**沒有把 A 題修回去**：環在卡上、射線在卡後，兩件事同時成立。
5. 環在卡面上的疊法要克制：**不准變成一條不透明的白棒蓋住銘牌**（LESSONS 第六節第 1 條第 3 點：不透明銘牌黑條／白棒是已否決路線）。

## C. 拖曳放開後要自動回正

**現況程式**：`ceremony.js` `bindInteraction()`（277–286 行）。`pointerup` 只做 `drag=null`，`s.rx/s.ry` 原地留著；只有 `dblclick` 與 Esc 會 `reset()`。提示文字現在是「拖曳轉動 · 雙擊或 Esc 回正」。

**要求**：

1. `pointerup` / `pointercancel` / 指標離開時，卡片角度 `--rx` / `--ry` **自動彈回 0**。
2. 用**帶阻尼的回彈**，不要線性歸零：建議 220–320ms、`cubic-bezier(.22,1,.36,1)` 或等價的彈簧，最多一次極小的過衝（≤ 1.5°）。回正過程中光位（`paintFoil`）要跟著角度一起收，不能角度回了但箔光還卡在偏移位置。
3. **可中斷**：回正動畫進行中再次按下要立刻接手，從當下角度續拖，不能跳回去。
4. 保留 `dblclick` 與 Esc 的回正（既有契約），只是現在它們變成備援。
5. 更新提示文字：`updateFinish()` 裡的 `hint.textContent` 改成不再宣稱要靠雙擊才會回正（例如「拖曳轉動 · 放開自動回正」）。
6. **驗收要驗像素，不能只驗 CSS 變數**（LESSONS 第三節第 4 條）。拖曳 → 放開 → 等回彈結束 → 截圖，比對與未拖曳時的卡片影像差異 bbox 為 None；同時 `getSelection().rangeCount === 0`、卡片區域藍色選取像素比 ≤ 0.01。dev 與搬走的 standalone 兩個入口都要跑。
7. 這個回正動畫在演出未結束時不得干擾 A5 完成契約：完成判定時 `anims` 必須能歸零（回正動畫要能被 `skipAll()`／完成流程取消）。

## D. 傳說／神話：翻開前要有「蓄力」，整段演出加長

**使用者要的手感**（對照初版珍母點點）：抽到傳說／神話時，卡片**先微微抖動、持續散發光芒**，光越來越強，**然後才翻開炸出光芒**。現在是直接翻開，缺少前置張力。

### D-0. 這一題要解除一條已凍結的規則，先看清楚

`ceremony.js` 第 171 行的註解與 `check_gacha_ceremony_round30.py` 的 `core()`（96–104 行）目前把「**不預告**」釘成硬斷言：common / legendary / mythic 三個階級在 `face-visible` 之前的 13 個時間點截圖，**39 幀逐像素零差**（`no-preview`）。

**使用者本輪明確要求推翻它**：傳說／神話**必須**在翻開前就看得出來。因此：

- `no-preview` 斷言**改寫**，不是刪掉：改成「common / rare / epic 三者之間 pre-F 仍需逐像素零差」（低階不預告的部分保留），legendary / mythic 允許且**必須**與 common 有差異（新增一條反向斷言：legendary vs common 的 pre-F 幀差異 bbox **不得**為 None）。
- 這是使用者裁決，不是你自己放寬標準。在 `REPORT` 裡把這條寫明。

### D-1. 蓄力段規格

在既有 `beginReveal()`（171–178 行，目前是 `focus` 上浮 500ms → 等 140ms → `flip` 180ms）之前／之中，為 legendary 與 mythic 插入蓄力段：

| 參數 | legendary | mythic |
|---|---|---|
| 蓄力總長 | 900ms | 1300ms |
| 抖動 | 幅度由 0 漸進到 ±2.5px／±0.8°，頻率約 18–24Hz，**translate/rotate 只作用在 `.reveal-shell`**，不得改卡面內部幾何 | 幅度到 ±4px／±1.2°，頻率同上，末段 200ms 抖動再放大一階 |
| 光芒 | 卡背後（`lower` canvas 或 `.reveal-anchor` 後層）的暖金底光由 0 漸強到蓄力結束時約 60% 峰值，**持續發光不閃爍** | 同上但用彩虹／冷白，強度到 70% |
| 收束 | 蓄力最後 120ms 抖動與光同時**急收**一拍（略降），製造翻牌前的吸氣 | 同左，收束 160ms |
| 翻開 | 收束結束才進入既有 `flip`；`face-visible` 時的爆光沿用 round 30 的 `strengthen()`，**強度不得降低** | 同左 |

- 蓄力段的音效：沿用已移植的 `ceremony-audio.js`，加一層漸強的低頻嗡鳴／充能音（用現有合成參數延伸，不要引新素材）。首次靜音、可開啟的規則不變。
- **跳過語意不變**：蓄力段必須完整響應 `skipAll()` 與 Esc，跳過後不留殘影、不留 timer/raf/animation（A5 完成契約：`anims/timers/rafs/voices` 全空）。
- 蓄力**不得**造成卡片與鄰卡重疊（round 30 的 `nonoverlap` 契約）：抖動幅度已按現有間距抓在 ±4px 內，若量到會碰就縮幅度，不要改版面。

### D-2. 揭曉後也要更長

`ceremony.js:200-201`：

```js
const READ={common:300,rare:420,epic:640,legendary:900,mythic:1200};
```

- legendary → 1400，mythic → 1900（`RETURN` 維持不變）。
- `ceremony-fx.js` `strengthen()` 裡 high 階的 `rays(..., hold:1.6)` 與 `flash(duration:1.65)` 隨之延長：legendary hold 2.2s，mythic hold 2.8s（`rays()` 目前有 `hold = Math.min(hold, 4)` 的上限，夠用，不要改上限）。尾韻 fadeOut 一併加長，**不准用縮短來遷就**。
- 十連時多出來的時間會累積：確認 `cascade()` 的序列化與 `check_gacha_ceremony_round30.py` 裡那幾個固定時間點（`F=2070`、`return=3270`、`last-before=10349`、`last-after=10351`）**全部要重算並更新**，不是註解掉。新的固定點寫進報告。

## E. 抽卡背景重做（目標＝使用者提供的參考圖）

**現況**：`ceremony.css:7-21` 的六層 `.stage-background`（base / substrate / geometry / glow / sheen / vignette），深藍 `#091221` ＋ 兩塊 `clip-path` 幾何 ＋ 呼吸光暈。

**目標視覺（使用者截圖四，本輪的預設方向）**：純黑底的**召喚陣舞台**，全部是**細白線幾何**、幾乎無彩：

1. **中央召喚陣**：三～四層同心圓，一層實線細環（線寬 1–2px）、一層**虛線／點列環**、一層只畫兩段對稱弧的**破環**（缺口在左右），環之間有小菱形與小圓點當刻度。
2. **中心光點**：一顆四芒星（上下長、左右短的四角星），帶柔和輝光，是整個畫面的視覺焦點。
3. **垂直光軸**：畫面上下各一條穿過中心的細垂直線，另外左右兩側各有 1–2 條較短的垂直細線，線上串著小菱形節點。
4. **地平面**：畫面下半是有透視的**地板**，由中心向外的**同心橢圓**（3–5 圈，越外越淡）＋ 幾條放射狀的地面格線構成；中心處有一道垂直的**倒影光柱**往下拉。
5. **氛圍**：整體極暗（背景近 `#000`），亮度全靠這些細線；四角有微弱的暗角；線條可以極慢地呼吸／旋轉（≥ 20s 一圈），但**不能搶走卡片的注意力**。
6. **留白**：左右兩側與四角是文字／按鈕的位置（參考圖左側 `SUMMON A NEW STORY`、右側 `SHOP / RECORD / DETAIL`、四角小字），中央 60% 必須乾淨，卡片放上去不會被線條干擾。

**做法與授權（重要）**：

- 先做一輪**資源研究**，寫進 `docs/clicker/RESEARCH-gacha-background.md`：到 GitHub 找可用的開源幾何／召喚陣／SVG 背景生成器（magic circle / sigil generator / geometric SVG pattern / procedural mandala 一類），**每一條都要實際打開**，記錄 star 數、**LICENSE 實際內容**、技術路線、可搬什麼。打不開的就寫「打不開」。已經在 `RESEARCH-gacha-ui-resources.md` 查過的不要重查。
- **授權硬規則**：GPL/AGPL 的**不准複製程式碼**（只能看規格自己寫）；MIT/BSD/Apache/CC0 才可直接引用，且要在報告記錄出處與授權。專案既有限制是**不引第三方素材**，所以最終產物**必須是我們自己寫的 CSS／inline SVG／canvas 幾何**，不得下載外部圖檔或字型。研究的價值在於數學與參數，不是拿檔案。
- 實作放在 `ceremony.css` 的 `.stage-background` 體系內（可以增減層，但保留 `.background-paused` 與 `.focus-held` 的降階行為、保留 `prefers-reduced-motion` 停動畫）。
- 效能：背景**不得**新增常駐 rAF。用 CSS 動畫或一次性繪製的 canvas／SVG。桌面待機時 CPU 與現況同級（現況：沒事時特效層完全靜止）。
- 產物體積：`deluxe-gacha-b-standalone.html` 目前 5.14 MB，本輪**增量不得超過 +200 KB**。
- 卡片可讀性優先：套上新背景後，重跑既有的卡面對比／不重疊驗收，卡面文字對比不得下降。
- 螢幕比例：1440×900、1024×640、390×844 都要好看，召喚陣不得被裁掉一半或壓扁。

---

## 二、不要做的

- 不改 `src/` 任何檔（讀可以）。
- 不動 `card_face.js`、`pool_data.py`、`RATE`、卡面幾何／Z／字級。
- 不引入 three.js、影片、外部圖檔、外部字型、任何 npm 相依。
- 不做扇形重疊版面；不縮短或減弱 round 30 已量到的特效強度來換效能或換圖層順序。
- 不加不透明銘牌背板／黑條白棒（已否決路線）。
- 不 `git push`。sandbox 擋住 commit 就跳過，並在報告列出提交邊界。

## 三、驗收

新增 `_art/holo-test/check_gacha_layers_round31.py`（A、B、C 三題的像素驗收）；更新 `check_gacha_ceremony_round30.py`（D 題的 `no-preview` 改寫與固定時間點重算）。**舊測試更新不刪**。

| # | 題 | 斷言 |
|---|---|---|
| 1 | A | legendary／mythic，`face-visible` 起每 50ms 到演出結束，卡面 rect 內的像素與「同一幀但關掉 canvas 特效層」的對照幀差異 ≤ 容差；證明射線／底光／flash 一次都沒有蓋到卡面。含 `is-revealing` 移除後的時段與 hover／selected 狀態 |
| 2 | A | 射線亮度峰值（卡外區域灰階 P95）與持續 ms **≥ round 30 報告記錄值**（不得因修圖層而變弱） |
| 3 | B | 環擴張過程中，環與卡面重疊的區段在卡面上**可見**（該區段像素亮度高於未播特效的對照幀，且沿環一圈連續，無被卡片切斷的缺口） |
| 4 | B | 環的外徑與線寬在改動前後一致（±2px），證明沒有被透視放大 |
| 5 | B | 所有 `.rarity-fx` 與卡面各層的 `translateZ` 絕對值 ≤ 42px |
| 6 | C | 拖 90×90 → 放開 → 等 400ms → 截圖，與未拖曳基準幀 `ImageChops.difference(...).getbbox() is None`；`getSelection().rangeCount === 0`；卡片區藍色像素比 ≤ 0.01。dev ＋ 搬到別資料夾的 standalone 都跑 |
| 7 | C | 回彈中途 200ms 再次 `pointerdown` 並移動，角度從當下值續接（不跳回原角度）——量 `--rx/--ry` 的連續性 |
| 8 | D | pre-F：common vs rare vs epic 三者逐像素零差；legendary vs common、mythic vs common 的 pre-F 幀差異 bbox **不得**為 None（反向斷言） |
| 9 | D | legendary 從 `phase-start:charge` 到 `face-visible` 的實際時距 ≥ 900ms＋既有 320ms；mythic ≥ 1300ms＋320ms（實測 event 時戳，不是讀常數） |
| 10 | D | 蓄力段任一幀，任兩張 `.slot` 的 rect 交集面積為 0（1440×900／1024×640／390×844） |
| 11 | D | 蓄力段中途 `skipAll()`／Esc：180ms 後 `anims/timers/rafs/voices` 全空、`.rarity-fx` 數量為 0、`collectable` 成立 |
| 12 | E | `deluxe-gacha-b-standalone.html` 體積增量 ≤ 204800 bytes；背景待機 3 秒內無 rAF 呼叫（用 `requestAnimationFrame` 攔截計數）；`prefers-reduced-motion` 下背景動畫為 0 |
| 13 | 全 | `check_gacha_ceremony_round30.py`、`check_gacha_card_regression.py`、`check_demo_round8.py`、`check_demo_round9.py` 全綠 |

**每一支驗收都要回報真實 exit code。** 沒跑過的結論不准寫進報告或 commit 訊息（LESSONS 第六節第 2 條）。
另外：**寫完檢查腳本要先確認它在已知正確的情況下是綠的**（LESSONS 第三節第 3 條），否則你會拿一支自己量錯的腳本去改對的程式。

## 四、交付

1. 程式：`ceremony.js` / `ceremony-fx.js` / `ceremony.css`（＋必要的新模組），兩支 builder 重跑，dev 與 standalone 兩個產物都更新。
2. `docs/clicker/RESEARCH-gacha-background.md`（E 題的資源研究與授權判斷）。
3. `docs/clicker/REPORT-holo-round31.md`：A 題真正成因的量測證據、B 題採哪條路與補償數字、C 題像素證據、D 題新的固定時間點表與 `no-preview` 改寫說明、E 題出處與授權、每支驗收的真實 exit code、以及本輪的限制與未完成項。
4. 截圖證據放 `docs/clicker/shots/round31/`：A／B 修正前後對照、C 回正前後、D 蓄力段逐幀、E 三個解析度的背景。
5. 若有新踩到的坑，追加到 `docs/clicker/LESSONS-2026-09-09.md` 或新開一份。
