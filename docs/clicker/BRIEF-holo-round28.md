# 派工簡報（第二十八輪）：揭曉演出 v3 第一階段——純 CSS 把整場戲立起來

日期：2026-09-09。分支 `holo-cards`，工作區 `D:\claude\clawd-pet-holo`（git worktree，**不要**碰 `D:\claude\clawd-pet`）。
你是**實作者**。前提：第二十七輪（`BRIEF-holo-round27.md`／`REPORT-holo-round27.md`）已落地，A5 的狀態契約與固定時序測試已存在——**本輪在它之上做，不重寫它**。

## 〇、必讀（順序不能反）

1. `docs/clicker/LESSONS-2026-09-09.md`
2. `docs/clicker/HANDOFF-holo-cards.md` 六之四、六之五（卡面凍結；本輪**不動 `card_face.js` 的幾何、Z、字級**）
3. `docs/clicker/REPORT-holo-round27.md`（上一輪實際做到哪、A5 的狀態名稱是什麼——沿用，不另造）
4. `docs/clicker/DESIGN-reveal-round28.md`（GPT-6 的設計 v3）——**本輪的規格書，但以下第一節的使用者裁決覆蓋它**
5. `docs/clicker/RESEARCH-gacha-ui-resources.md` 第二、五節（箔面套 UI 的允許／禁止）

## 一、使用者裁決（2026-09-09，覆蓋設計文件的對應段落）

| # | 設計文件原案 | 使用者裁決 | 對實作的意思 |
|---|---|---|---|
| 1 | 銀色典藏封套 | **鋁箔卡包** | 前奏主體是一個鋁箔卡包（像實體 TCG 補充包：直式、上緣鋸齒封口、金屬箔面有皺摺高光），不是信封。撕封＝從上緣撕開封口。 |
| 2 | 封印顯色，預告整包最高階 | **不預告任何品質，抽出來才知道** | **正面初見（`face-visible` marker）之前，畫面不得因結果階級而有任何差異**：卡包顏色、光色、蓄力時長、射線、音效全部一律「中立銀白」。設計文件第二節「封印顯色」那一拍**刪除**；第三節五階表裡「蓄力／翻面」的時長差異**改為全階相同**（用 rare 的 140／360），階級差異只允許出現在「讀卡／回槽」與翻面瞬間之後的卡外 FX。`.summon-seal` 五階印記**不做**（改成單一中立星軌印記）。 |
| 3 | 點演出空白處＝全部跳過 | **保留** | 照設計三節「跳過」規則。 |
| 4 | 演出期間蓋滿可用視窗、單檔 ≤ 9MB（本輪 ≤ 5.3MB） | **接受** | `.win.is-ceremony` 覆蓋整個視窗，不呼叫 Fullscreen API。 |
| 5 | 首次靜音、可手動開 | **照預設** | WebAudio 合成，首次靜音；提供開關並記住（localStorage）。 |
| 6 | （設計文件沒講清楚）揭曉後的卡片互動 | **鎖定角度、不追蹤滑鼠**；**滑鼠經過處要有光線材質回饋**；**可拖曳轉動角度**；**指上去有被選取的微微放大** | 見第三節，這是本輪新增的互動契約。 |

## 二、範圍（本輪做什麼）

按設計文件第六節「第二十八輪」的範圍，套上第一節的裁決：

1. **整包前奏（純 CSS／WAAPI）**：按下 → 進入舞台（側欄／底欄退暗，`.win.is-ceremony` 蓋滿）→ 召喚陣星軌點亮 → 流光投遞 → **鋁箔卡包顯現（中立銀白，無階級色）** → 撕封 → 發牌到槽位。前奏時長照設計：單抽 2600／五連 2760／十連 2960ms，但把「封印顯色 360ms」那一拍拿掉後可整體縮短，**實際時長寫進報告**。
2. **單卡揭曉**：沿用設計第二節單卡表，但**翻面前的蓄力／蓄力收緊對所有階級相同**；`face-visible` 之後才用 `SURGE` 階級色與階級 FX（common 短柔光、rare 藍光束、epic 紫光柱、legendary 射線＋火星＋單次衝擊、mythic 分色爆發＋較長讀卡）。高階互斥（史詩以上依序持有焦點）照設計。
3. **單一焦點排程、卡後定位**：`shock()`／`burst()`／`rayBurst()` 改成接受當次 scope 與 anchor；單卡 FX 中心距卡中心 ≤ 卡寬 5%。
4. **有限材質掃光**：1370–1820ms 由 `paintFoil()` 執行，之後交還 pointer 驅動；不新增不透明前景白片。
5. **跳過**：`#revealall` 改「跳過演出」，前奏開始就可按；點背景跳過；取消當次所有 WAAPI／rAF／延遲回呼／音效；結果 180ms 淡入；清理完 100ms 內可收下。**這一段必須沿用第二十七輪 A5 的 run ID 與狀態名稱**。
6. **WebAudio**：充能、紙裂、衝擊、和弦，用揭曉 marker 同步；首次靜音。
7. **`prefers-reduced-motion`** 獨立分支（設計三節末段）。
8. **揭曉後的卡片互動**（第三節）。

**不做**：three.js、影片、Blender 動態、`card_face.js` 內部幾何／Z／字級的任何改動、稀有度預告、Pixi。

## 三、揭曉後的卡片互動契約（使用者新增，只適用抽卡結果頁的卡）

抽卡結果頁的 `.slot .hcard`（回槽完成、`.slot.done` 之後）：

| 行為 | 規格 |
|---|---|
| 角度 | **鎖定**。不隨滑鼠位置傾斜（不做 poke-holo 那種 hover tilt）。預設姿態 `--rx/--ry = 0`。 |
| 光線材質回饋 | 滑鼠在卡上移動時，**箔面光位跟著游標走**（`paintFoil()` 的光位輸入吃 pointer 座標），角度不變。離開卡片後光位在 ≤ 400ms 內回中立（`--phase` 120deg 的中立 API，不是寫死 0deg）。 |
| 拖曳轉動 | 按住拖曳可以轉動卡片角度（`--rx/--ry` 隨拖曳位移變化，上限 ±18deg），放開後**停在放開時的角度**（不是彈回）。雙擊或按 Esc 回正。拖曳中光位照樣跟游標。 |
| 選取感 | hover 時整張卡 `scale(1.04)`、180ms ease-out、加一圈細的階級色外光；離開時回 1.0。**縮放發生在 `.hcard` 外層的 wrapper（例如 `.reveal-shell` 或 `.slot`）**，不動 `.hcard` 內部的 Z 分層；而且 `refit()` 量的是未變形寬度，縮放不能改到字級（LESSONS 第三節第 2 點）。 |
| 觸控 | 單指拖曳＝轉動；點一下＝選取放大 toggle。 |
| 與 A5 的關係 | 只有 `.slot.done` 之後才啟用這些互動；揭曉中不吃 hover／drag。 |

卡池頁（`cards-remade`）與 demo 頁的既有 hover tilt **不改**——這條契約只給抽卡結果頁。

## 四、素材

| 素材 | 尺寸／格式 | 產製 | 上限 | 誰做 |
|---|---|---|---:|---|
| `summon-night.webp` 夜空 | 1536×1024 RGB WebP | imagegen，無文字無 UI 的星軌夜空 | 120KB | Claude 產，放 `_art/holo-test/fx/`；**沒到位前你先用 CSS 漸層＋既有 `.starfield` 頂著，不能卡住** |
| `foil-pack.webp` 鋁箔卡包 | 700×980 RGBA WebP（直式、上緣封口） | Blender 正交靜幀（holo-card-studio 材質數值） | 140KB | Claude 產；同上，沒到位前用 CSS 畫一個佔位卡包（銀灰漸層＋鋸齒封口 clip-path） |
| `foil-tear.webp` 撕裂邊 | 1024×256 RGBA WebP | Blender 靜幀 | 40KB | Claude 產；同上 |
| 星軌 SVG、中立印記 SVG | 星軌 viewBox 1024×1024；印記 256×256 | **你手工寫向量**（不用 imagegen 畫精確符號） | 合計 20KB | 你 |

素材進單一 resolver／asset manifest（第二十七輪的 `path()`／`resolve()`），**不新增字面字串替換**（LESSONS 第五節）。素材檔名固定如上，Claude 之後補檔進去就能吃到，不用改程式。

## 五、驗收（Playwright，全部要真的跑，回報真實 exit code）

新增 `_art/holo-test/check_gacha_ceremony_round28.py`，至少斷言：

1. 固定結果 fixture 驗單／五／十抽；不改正式 `RATE`。
2. 測試模式提供可暫停時間軸與事件紀錄：`phase-start`、`face-visible`、`slot-complete`、`collectable`（**沒有 `rarity-lock`**——已刪）。
3. **不預告驗證**：對同一 fixture 位置分別塞 common／legendary／mythic，`face-visible` 之前每 200ms 截圖，三者的截圖逐像素差異必須為 0（允許 starfield 隨機抖動則改用固定 seed）。這是本輪最重要的斷言。
4. `.slot.is-revealing` 的高階焦點最多一張；高階回槽後下一張才開始。
5. 左／中／右、十連上下排、resize 後：單卡 FX 中心距卡中心 ≤ 卡寬 5%。
6. `face-visible` 與爆光 marker 差 ≤ 50ms；音效排程與 AudioContext 狀態另量。
7. A5 固定觸發點各 20 次，新增「前奏中」「撕封中」兩個觸發點；身份、順序、數量不變，均可收下。
8. 第三節互動：hover 後 wrapper `scale` ≈ 1.04 而 `.hcard` 字級不變；滑鼠移動時 `--phase`（或等價變數）變化而 `--rx/--ry` 維持 0；拖曳 60px 後 `--ry` ≠ 0 且放開後保持；Esc 後回 0；離開 400ms 內 `--phase` 回中立。
9. 80／102／150／230／290px 三型回歸維持第二十七輪基準（跑既有 `check_gacha_card_regression.py`）。
10. 收下／reset 後工作計數歸零；靜置 5s／30s 無自動更新。
11. `prefers-reduced-motion` 分支：180ms 淡入、同一完成契約。
12. dev 與複製到別的資料夾的 standalone 都驗；standalone ≤ 5.3MB（十進位）。

## 六、交付

1. 每個大項（前奏／單卡揭曉／跳過與 A5 銜接／互動契約／音效／reduced-motion）一個 commit，訊息寫實際量到的數字與 exit code。
2. `docs/clicker/REPORT-holo-round28.md`：改了哪些檔、每條驗收 exit 多少、實際前奏時長、standalone 實際大小、還沒過的。
3. `HANDOFF-holo-cards.md` 第七節與 `TODO-next-round.md` 同步。
4. 不要 push。
