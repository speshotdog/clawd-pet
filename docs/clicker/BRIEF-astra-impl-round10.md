# 珍母點點 第十輪實作：角色粉塵／升階／超越＋卡冊＋展示頁＋更衣室（可寫檔）

先 `git log -4`（第八、九輪已合併）。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、`docs/clicker/REPORT-astra-impl-round10.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`（卡面用 `GachaCard` 既有 API：`card.create(entry, opts)`、`card.liveBegin/liveEnd`、`art.create`、`art.cfg`）。`clicker-cutin.js` 的 `T`／`EASE` 不動。不 build、不起 server、不 commit。演出「可以更好，不能更淡」。素材檔名寫死，缺檔 `onerror` 隱藏。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 第 3、4、6.4 節。

## 使用者原話
> 重複抽到的卡片滿星之後變成塵，粉塵是該角色的粉塵（點進卡面可以知道持有數量）。可以讓傳說外的卡片提升階級最多到傳說。傳說五星後用塵升星變成超越等級，超越的星星是寶石藍色的星星，最高超越五。名冊要像遊戲的卡牌精緻地放在那（爐石卡冊），點開可以看技能與動態卡面。點擊音效與點擊特效做進商店販售，在更衣室自由替換。

---

## 一、經濟（`clicker-economy.js`、`clicker-save.js`，存檔 `version: 2` 含遷移）

### 1.1 粉塵
- `s.dust[id]`：該角色累計粉塵（每張卡 +1，含第一張）。遷移：`dust[id] = collection[id]`。
- 星級：`stars(dust)`＝門檻 `[1, 2, 4, 8, 16]`（累計顆數 ≥ 門檻 → 該星，與現在的張數規則一致）。**升星自動**，`collect()` 收下時判斷升星並回傳 `starUps`。
- `s.universalDust`：萬用粉塵。來源本輪只做兩個：**每隻王首勝 +3**（第八輪 `bossWins` 觸發）、**滿養溢出**（見 1.4）。每日一包在第十二輪。
- 卡面標籤 `tagFor`：`NEW`／`升星 3/4`／`2★ → 3★`／`粉塵 +1（17）`／滿養時 `萬用 +¼`。

### 1.2 升階 `promote(state, id, now)`
- 條件：5★、`promotions[id] < 傳說階`、粉塵足夠。費用：精良→史詩 **12**、史詩→傳說 **12**（精良第二步 **16**）。
- 效果：`individual` 乘 `tierMul = [1, 1.8, 3.2][tier]`，tier = 出身階 + promotions。切入色、卡框色、名冊稀有度文字都顯示「目前階」（原生用「精良（升階）」註記）。卡池機率不變。

### 1.3 超越 `transcend(state, id, now)`
- 條件：目前階為傳說且 5★；費用照出身：精良 `[6,8,10,12,14]`、史詩 `[6,7,8,9,10]`、傳說 `[4,5,6,7,10]`。
- 效果：`individual` 乘 `1 + N × t`，N 精良 .06／史詩 .09／傳說 .14；技能 `skillAt(id, stars, t)`（第九輪已留 `1 + .05t` 與 `1 − .02t`）。
- 超越五：`awakened = true`（純外觀）。

### 1.4 滿養溢出與粉塵商店
- 已超越五的角色再收到卡：不加 `dust`，改加 `overflow[id]`；每累積 精良 4／史詩 2／傳說 1 張 → `universalDust += 1`（零頭保留）。
- `exchange(state, id, amount)`：萬用 → 該角色粉塵，匯率 精良 1:1、史詩 2:1、傳說 3:1（以出身算）。
- 所有操作走 `settle → 驗證 → commit` 一次寫入；測試各一例（含遷移、不足、越階、匯率零頭）。

## 二、卡冊（取代 `#roster`）
- 面板底：`clicker-ui-album.png` 9-slice（皮革外框＋兩頁紙），內容區 880×470，左右兩頁各 4 張卡（2×2，卡 150×210，`card.create(entry, { face:'af', size:'roster' })`，稀有度框依「目前階」）。12 隻 → 2 跨頁；翻頁鍵是右下角的頁角（`clicker-ui-page-corner.png`），按下 240ms 翻頁：舊頁 `rotateY(0→-90deg)`（`transform-origin` 書脊）→ 新頁 `rotateY(90→0)`，翻到一半 `sound('upgrade')` 換成紙聲（`noiseHit f0 2200→900 d .08 gain .12`）。
- 卡下方一列：星（金星 `clicker-star.png`；超越 t 級時前 t 顆換 `clicker-star-gem.png`）、`粉塵 23`、下一步（`升星 3/4`／`升階 9/12`／`超越 2/4`／`滿養`）。未擁有：卡背（`gacha` 的卡背）＋灰剪影＋「?」。
- 頂端：標題帶「夥伴卡冊」、萬用粉塵罐（`clicker-ui-dust-jar.png` 48px＋數字，點開粉塵商店）、第九輪的「推薦組合」鍵、返回。
- hover 卡：既有 A+F 的 3D 傾斜與鍍膜（`card.liveBegin` 在卡冊開啟時呼叫，關閉 `liveEnd`）。

## 三、展示頁（點卡）
- 覆蓋在卡冊上：左側大卡（`card.create` 同一張放大 1.6 倍、置中 x 250）；進場 220ms：卡從冊子位置飛到中央並放大（`translate+scale`，EASE settle），其他卡 `opacity .3`。大卡常駐本尊 rig 呼吸與眨眼（用 `art.cfg` 與 `#eyes-*`；傳說／超越五常駐鍍膜走光 4s 循環——這是「展示中」不是閒置，可以動）。
- 右側說明書（紙板 `clicker-ui-paper.png`，420×470）：名（目前階＋出身）、被動每秒（含場景親和）、技能名＋`desc(現在)`／`desc(下一星)`、羈絆列、當家旗、粉塵「持有 23 顆」、三顆鍵：「裝備至槽 N」（三顆小鍵）、「升階（9/12 顆）」、「超越（2/4 顆）」。不足時灰＋差幾顆；按下走 `promote/transcend`，成功演出：卡 `scale 1.08` 120ms＋白閃＋星列該顆星 `scale 0→1.4→1` 260ms＋`GachaAudio` 史詩揭曉音（升階）／傳說揭曉音（超越）；超越五時整頁金粒子 24 顆（`fx.spawn sprite 14 color #E9B94E blend lighter`）。
- ESC／點外面：大卡飛回冊子位置 200ms。

## 四、更衣室（商店第四張卡 → `#wardrobe` 面板）
- 商店 `#shop` 加一列「更衣室」入口（`clicker-ui-label.png` 標籤＋衣架小圖 `clicker-ui-hanger.png`），開 `small-panel` 放大版（`clicker-ui-wardrobe.png` 9-slice 衣櫃）：左欄「點擊音效」10 格、右欄「點擊特效」10 格，每格 72×72 貼紙（`clicker-ui-sticker-badge.png` 底＋圖示：音效用音符＋編號、特效用該粒子 sprite 上色），已擁有亮、未擁有灰＋價籤。
- 目錄 `B.wardrobe`：
  - 音效 `sounds`: `soft`（現行，預設擁有）、`bubble`、`paper`、`coin`、`taiko`、`sticker`、`squish`、`bubblewrap`、`woodblock`、`jelly`；合成參數照下表（`tone`/`noiseHit` 兩種積木，都是 `GachaAudio` 現有的）。
  - 特效 `fx`: `shard`（現行碎紙，預設）、`coin`（sprite 0 金 #E9B94E）、`heart`（10 粉 #EF8E8E）、`paw`（11 奶油 #FFF3DC）、`star`（2 金）、`ribbon`（8 彩：五色輪流）、`bubble`（3 環 淡藍 #94BED0）、`sakura`（`clicker-fx-sakura.png` 粉）、`spark`（`clicker-fx-spark.png` 金 lighter）、`snow`（`clicker-fx-snow.png` 白）。特效只換 `burst()` 的 sprite／色，數量、速度、重力、連點加成配方全部沿用。
- 價格：`max(5000, round(P × 1200))`，P 為當下常態每秒；買了寫 `owned.wardrobe[]`；`settings.clickSound`／`settings.clickFx` 是穿著。輪迴不清。
- 試用：點格子 → 音效播三下（間隔 120ms）／特效在珍母旁噴一次；「穿上」鍵存檔；未擁有格子按下是「購買」確認（價籤變成「確定 5,000？」再按一次）。

音效參數表（`tone(f, {slide, slideT, d, gain, type})`、`hit({f0, f1, d, gain, type, q})`）：
| id | 積木 |
|---|---|
| soft | tone 160→95 55ms g.05 |
| bubble | tone 520→180 70ms g.045；hit f0 3200 q2 12ms g.025 |
| paper | hit 2600→900 45ms g.055；tone 140→90 30ms g.02 |
| coin | tone tri 1760 90ms g.028；tone 2637 70ms g.014（+10ms）；hit 6000 10ms g.012 |
| taiko | tone 200→95 100ms g.06；hit lowpass 700 40ms g.035 |
| sticker | hit 4200 20ms g.05；tone 320→190 35ms g.04（+4ms） |
| squish | tone tri 330→150 90ms g.045；tone 660→250 60ms g.012（+20ms） |
| bubblewrap | hit highpass 2600 14ms g.045；tone 900→380 30ms g.045 |
| woodblock | tone 880→620 60ms g.04；tone 1760 20ms g.015；hit 1800 q2 15ms g.03 |
| jelly | tone 240→120 120ms g.05；tone tri 480→200 80ms g.015（+30ms） |
（gain 已含 sfxVolume 前的基準，與現行 click 的 .05 同量級。）

## 五、驗收與交付
- `npm test` 全綠：遷移、粉塵升星、升階三條路、超越費用與倍率、溢出折算與零頭、匯率、更衣室購買／穿著、存檔驗證。
- `tools/test/clicker-browser.py` 加 round10：卡冊兩跨頁截圖、翻頁中段截圖、展示頁（含 rig 動、鍍膜）、升階成功 200ms、超越五金粒子、藍寶石星 3 顆、更衣室面板、試用特效 120ms、購買流程、穿上後 `settings` 值。
- 量關鍵鍵是否都在面板內（`getBoundingClientRect` 全在 960×640 內且不被遮）。
- `docs/clicker/REPORT-astra-impl-round10.md`：資料結構、遷移、費用表、素材引用清單、未完成。
