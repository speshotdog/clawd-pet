# 珍母點點 第十五輪簡報：十張新卡＋「神話」階級＋全彩卡面與炫麗抽卡特效

給 GPT-6 Astra 實作。**規則：不要 build、不要起 server、不要 commit、不要碰 `src/card-*.png` 以外的素材檔、不要「順便」精簡任何既有演出**（第五輪教訓：撕包／回彈／傳說戲劇性被砍過，使用者要求復原）。中文字串直接寫 UTF-8，寫完 `grep -n "??" src/*.js` 確認沒亂碼。

先讀 `docs/clicker/HANDOFF-next-session.md` 第四節（檔案地圖）與 `src/gacha-pool.js`、`src/gacha-card.js`、`src/clicker-balance.js`、`src/clicker-economy.js`、`src/clicker-cutin.js`、`src/clicker-stage.js`（`setPartners`）、`src/clicker-extras.js`（`portrait`）、五個 `gacha-mode-*.js` 與 `gacha-mode-runtime.js`、`gacha-fx.js`、`gacha-card.css`。

## 0. 素材（已備妥，PNG、已去背、含 3% 留白）

| id | 名稱 | 稀有度 | 檔 | 圖 |
|---|---|---|---|---|
| `yueyuexian` | 玥來玥閒 | **mythic 神話** | `card-yueyuexian.png` 595×603 | 灰狼趴在草地上，頭頂蝴蝶 |
| `zhenfang` | 珍的很方 | legendary | `card-zhenfang.png` | 橘色方塊珍珍，頂上禮物盒 |
| `lksphinx` | 獅身ㄌㄎ | legendary | `card-lksphinx.png` | 人面獅身 ㄌㄎ |
| `zhenmoss` | 苔蘚珍珍 | legendary | `card-zhenmoss.png` | 苔蘚小丘，上面有長頸鹿與小貓 |
| `yuetrumpet` | 小號玥 | epic | `card-yuetrumpet.png` | 灰狼吹小號 |
| `zhencao` | 珍的是草 | epic | `card-zhencao.png` | 盆栽裡的草珍珍 |
| `mianhua` | 棉花糖 | epic | `card-mianhua.png` | 白雲棉花糖（自帶白色貼紙邊，是設計） |
| `yangpu` | 羊咩噗 | epic | `card-yangpu.png` 325×354 | 粉紅蝴蝶結羊 |
| `alu` | 阿漉 | rare | `card-alu.png` | 拿麥克風的長頸鹿 |
| `yuelegend` | 玥玥傳說卡 | rare | **沒有新圖**：借用現有 `yueyue`（玥玥原版，傳說）的 rig／卡面圖，但稀有度是 rare | 梗卡：「傳說卡」只是名字 |

新角色都是**靜態 PNG**，沒有 rig／template。既有 12 隻是 SVG template + `CHAR_CFG` rig。所以每個讀 `CHAR_CFG[id]`／template 的地方都要有 **`entry.src` 圖片分支**：卡面（`gacha-card.js` 已有 `kind:'toy'` 的 `<img>` 路徑，可比照，但這些是 `kind:'char'`）、卡冊卡片與展示頁、夥伴圓鈕（`clicker-stage.js` `.buddy`）、切入（`clicker-cutin.js` 用 rig；圖片角色改成整張圖滑入＋輕微上下浮動）、推薦組合頭像（`clicker.js` `card.art.create`）、分享卡 `portrait()`（`clicker-extras.js` 現在把 SVG 內嵌成 data URL；圖片角色直接 `load(src)`）、第 100 包 12 選 1、徽章牆玩具進場不受影響。圖片在卡面上：`object-fit:contain`、置中、留 8% 邊，不裁切。

## 1. 神話階級（mythic）規則

- `gacha-pool.js`：`RARITY` 加 `mythic: { label:'神話' }`，`RARITY_ORDER` 最前面加 `'mythic'`。`GAME_POLICY.weights` 改為 `{ rare: 695, epic: 250, legendary: 50, mythic: 5 }`（**神話 0.5%**，傳說 5% 不變，總和 1000）。`rank()`／`rollRarity` 的 `minRarity`／`legendaryBonus` 語意：**保底（40 抽必得傳說）算「傳說以上」**，抽到神話也重置保底；神話本身沒有保底。所有 `RARITY_ORDER` 的迭代要自然容納新階級。
- 存檔／保底：`clicker-save.js` 有 `findLastIndex(... rarity === 'legendary')`，改成 `rank(rarity) <= rank('legendary')` 之類。
- 經濟（`clicker-economy.js`）：`rarity(s,id)` 的 `['rare','epic','legendary'][tier]` 加 `'mythic'`（tier 3）；係數陣列 `[1,1.8,3.2]` 加第四項 **5.5**；超越每級 `[.06,.09,.14]` 加 **.20**；`origin()` 回傳 0~3。**升階上限仍是傳說**：rare→epic→legendary 可升，legendary 不能升成 mythic，mythic 出身不能升階（`tier < 2` 的判斷改成「出身 ≤ legendary 且目前 < legendary」）。超越五級規則對神話一樣適用。
- 粉塵／升星：門檻 `stars: [1,2,4,8,16]` 不變；萬用粉塵兌換神話的匯率是傳說的 **2 倍**（看 `exchange()` 現有 rate 怎麼算，往上加一階）。滿養溢出折萬用粉塵也照階級加一階。
- `clicker-album.js`：`RAR`／`ORIGIN` 加「神話」；卡冊 `PER_PAGE=4`，22 隻 → 6 頁 3 跨頁，翻頁自然增加；神話卡在卡冊與展示頁要有全彩卡面（見第 3 節）。
- 第 100 包 12 選 1：**維持原本 12 隻**（新卡不進 12 選 1），`canPick`／`pick100` 只需確認不會壞。
- `clicker.js:310` 稀有度文字表加 `mythic:'神話'`；`clicker-cutin.js` 的 `color`／`stripe` 加 mythic（彩虹：用 `conic-gradient` 或多色 stripe，見第 3 節）。
- 徽章 `star5`／`promote`／`transcend` 不變。分享卡 `shareTitle('transcend')` 不變。
- 稀有度顯示名稱一律「神話」，顏色主色 `#FF4FD8`（桃紅）＋彩虹。

## 2. 新角色數值與技能（`clicker-balance.js`）

沿用現有 `kind`（click／clickTime／clickAdd／burst／self／team／passive），**不要新增 kind**。`base` 對齊同稀有度現有值（rare 4~5、epic 8~10、legendary 16~20）。

| id | base | 技能名 | kind | 參數 |
|---|---|---|---|---|
| `yueyuexian` 神話 | 30 | 躺著也會贏 | team | ratio 1.0, duration 20, cd 120 |
| `zhenfang` 傳說 | 20 | 方方正正 | self | multiplier 5, duration 30, cd 120 |
| `lksphinx` 傳說 | 18 | 謎語時間 | clickTime | multiplier 3.5, duration 12, cd 90 |
| `zhenmoss` 傳說 | 19 | 苔原大團圓 | burst | factor 40, basis 'team', cd 150 |
| `yuetrumpet` 史詩 | 9 | 起床號 | click | multiplier 4, charges 8, duration 15, cd 75 |
| `zhencao` 史詩 | 9 | 光合作用 | team | ratio .3, duration 30, cd 120 |
| `mianhua` 史詩 | 8 | 蓬蓬鬆鬆 | self | multiplier 4, duration 30, cd 120 |
| `yangpu` 史詩 | 10 | 噗噗數羊 | clickAdd | ratio .6, charges 20, duration 20, cd 90 |
| `alu` 精良 | 5 | 一鳴驚人 | burst | factor 20, basis 'individual', cd 45 |
| `yuelegend` 精良 | 4 | 傳說中的玥玥 | click | multiplier 2, charges 10, duration 15, cd 60 |

`skillAt` 對神話多一條：`transcend` 每級係數 `t = 1 + .07*transcend`（其他仍 .05）。

羈絆新增三條（沿用現有 effect key）：`['lk','lksphinx']` 獅王 `chargesPlus:1`；`['zhenzhen','zhenmoss']` 苔球 `selfDurationMul:1.25`；`['yang','yangpu']` 雙咩 `chainWindowMs:11000`；另加一條 `['yueyue','yueyuexian']` 玥圓 `chainWindowMs:12000`。

推薦組合加一組 `{name:'神話流', slots:['yueyuexian','zhenfang','zhenmoss'], desc:'躺著也會贏 → 方方正正 → 苔原大團圓'}`。

`gacha-pool.js` 的 `CHARACTER_IDS`／目錄加 10 筆（`kind:'char'`，有 `src` 的加 `src`；`yuelegend` 不加 `src`，另加 `art:'yueyue'` 讓卡面／rig 借 `yueyue`）。`clicker-save.js validate()` 若有角色 id 白名單要跟著放寬；舊存檔載入後新角色欄位補預設（`collection`／`dust`／`promotions`／`transcend`／`partnerLevels`）。

## 3. 神話卡面：整張全彩

`gacha-card.css`（兩套 skin：預設與 `.skin-af`）加 `.r-mythic`：
- `--c-mythic` 主色 `#FF4FD8`；框線 `border-image: conic-gradient(from var(--spin), #ff4fd8, #ffb347, #fff275, #7dff9c, #5ad7ff, #b48bff, #ff4fd8) 1`，`--spin` 用 `@property` 或 keyframes 讓它 6 秒轉一圈。
- `.face-holo`：整面卡（不只框）鋪一層 `linear-gradient(115deg, 彩虹七色)` + `mix-blend-mode: color-dodge`（或 overlay），透明度 .35，隨 hover／傾斜視差位移；`.face-plate` 底色改成淡彩虹漸層而不是紙色，**「整張卡都是彩色」是使用者原話**。
- 角落寶石（`--gem`）用彩虹 conic；星星列一樣。
- 卡背 `.back-leak` 的 mythic 版：彩虹光漏，強度比傳說大。
- `.card-glow`：`box-shadow` 桃紅＋青色雙層，`glow-throb` 節奏快一點（.8s）。
- 尊重 `prefers-reduced-motion`：轉動與 throb 停，靜態彩虹保留。
- 卡冊縮圖（`.album-slot .card` scale .6）與展示頁都要看得出全彩。

## 4. 神話抽卡特效：比傳說更炫

五種演出（wish 流星投遞／hearthstone 拆包桌面／summon 腳印召喚陣／stage 拉幕登場／rip 撕包）＋共用的 `gacha-mode-runtime.js`、`gacha-fx.js`、`gacha-audio.js`。原則：**傳說有的神話全都有，再疊一層**；不改傳說本身。

- 共通（runtime／fx）：翻牌前 `host.dim` 加深、白閃 120ms、光線 `rays` 改成彩虹色（依角度分七色）、粒子數 `mythic: 32`、`life: .8`，粒子顏色輪替七色，`host.shake()` 兩次，停留時間 `mythic` 比傳說多 400ms。翻牌後卡片周圍加一圈彩虹 ripple（一次性 CSS 動畫，`gacha-card.css` 或 `gacha.css`）。
- 音效（`gacha-audio.js`）：`mythic: { f: 2093, d: 1.0, g: .12 }` 加上三音和弦（f、f×1.25、f×1.5）與低音 slide，長度比傳說長。
- wish：`RC`／`RGB` 加 mythic（桃紅），`order` 加 `'mythic'`，流星預告：神話流星是彩虹尾巴（每段不同色）、`R` 半徑 36、落地後多一圈彩虹漣漪；`preview` 文案「本次最高 神話」。
- stage：`RC`／`RC2`／`LABEL`／`holds` 加 mythic（hold 1600）；聚光燈變彩虹掃色，幕布拉開時撒彩虹紙片。
- summon：召喚陣的圖案（`gacha-summon-circle.png` 不改）疊一層旋轉彩虹色 `filter: hue-rotate` 動畫，腳印彩色。
- hearthstone／rip：拆包／撕包時光漏（`back-leak`）是彩虹，撕開瞬間粒子彩虹。
- `gacha.js`（抽卡試作區）的 `DUST` 表加 `mythic: 1000`，不然試作區壞掉。

## 5. 其他接線

- 舞台夥伴圓鈕（`.buddy`）的 `--rarity` 顏色加 mythic；圖片角色的圓鈕用 `<img>` 置中。
- 切入（`clicker-cutin.js`）：圖片角色滑入 + 上下浮動 6px／1.2s；神話切入的底色是彩虹 stripe。`T`／`EASE` 不動。
- 王包免費五連、每日包免費單抽：走同一條 draw 路徑，不需特別處理，但確認 `minRarity`／`legendaryBonus` 語意仍對。
- `tools/sim/clicker-curve.js` 若有寫死角色數量或稀有度表，補 mythic。
- 測試：新增 `tools/test/clicker-round15.test.js`：權重總和與神話機率 0.5%、保底算傳說以上、神話係數與超越 .20、升階上限（legendary 不能升 mythic、mythic 不能升階）、萬用粉塵匯率、`yuelegend` 借圖不崩、22 隻存檔 validate 通過、舊存檔遷移補欄位。既有 111 例要仍全綠（`npm test`）。
- `docs/clicker/DESIGN-balance-v2.md` 補「神話階級」一節（機率、係數、超越、匯率）。

## 交付

`docs/clicker/REPORT-astra-impl-round15.md`：每項一句話（改了哪些檔、偏離簡報處、沒把握處）。`npm test` 全綠。不要 build、不要起 server、不要 commit。
