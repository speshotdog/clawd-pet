# 珍母點點 第九輪實作：技能搭配四規則＋升星影響技能＋推薦組合＋連鎖章（可寫檔）

先 `git log -4`（第八輪已合併：場景設定、廚房、王包）。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、`tools/sim/*`、`docs/clicker/REPORT-astra-impl-round9.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動，可擴充 `CUTIN` 表與 `play()` 加章。不 build、不起 server、不 commit。演出「可以更好，不能更淡」。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 第 2 節。數值全部寫死如下；經濟純邏輯先做、測試先綠，再接 UI。

## 使用者原話
> 技能搭配四條規則：連鎖窗（8 秒內接第二技 ×1.3、第三 ×1.6）、型別相剋（加值先乘倍率；珍母複製含 self 後的值；burst 讀含 team 的 P）、原版×新版羈絆被動、場景親和兩隻當家（收益 ×1.5、CD −20%）逼換槽。加三組推薦組合給新手。升星要提升技能的效果或持續時間。

---

## 一、升星影響技能（`clicker-balance.js` → `skillAt(id, state)`）

`B.characters[id]` 的數值改成「基準」，新增純函式 `ClickerBalance.skillAt(id, stars, transcend = 0)` 回傳實際參數；`E.activate` 只讀 `skillAt`。`★` 為 `E.stars(...)`，`k = ★ − 1`（0–4）：

| kind | 主軸 | 副軸 |
|---|---|---|
| click／clickTime | `multiplier' = 1 + (multiplier − 1) × (1 + .08k)` | `duration' = duration + k`（秒） |
| clickAdd | `ratio' = ratio + .05k`（.5 → 5★ .7） | `charges' = charges + 2k` |
| burst | `factor' = factor × (1 + .1k)` | – |
| self | `duration' = duration + 2k` | –（倍率不動） |
| team | `ratio' = ratio + .02k` | `duration' = duration + 2k` |
| passive（珍母） | `duration' = duration + 2k` | 5★ 時 `copy = 1.1`，否則 1 |
| 全部 | `cd' = cd × (1 − .03k)` | |

`transcend` 參數本輪先接口（乘 `1 + .05t` 到效果量、`1 − .02t` 到 cd），第十輪才會有值。

`desc` 改成 `desc(params)` 模板（例：`接下來 ${charges} 次點擊 ×${mult}（${duration} 秒內用完）・冷卻 ${cd} 秒`），名冊與技能鍵 hover 顯示「現在」與「下一星」兩行（5★ 只顯示現在）。所有現有測試的期望值以 1★ 計算不變。

## 二、型別相剋（`clicker-economy.js`，三條公式）
1. `click()`：`amount = (D + Σ clickAdd.value) × max(1, mult…)`。
2. 珍母寄生 `activate`：`effect.value = individual(target) + Σ(該 target 的 self effect.value)`；仍選「含 self 後」最高者。
3. burst：`base = P + Σ team effect.value`（basis team）；basis individual 不變。
測試：三條各一例，數字寫在測試名裡（例 `(7.25+62.5)×10 = 697.5`）。

## 三、連鎖窗（`state.chain = { count, expiresAt }`）
- `activate` 時：若 `now < chain.expiresAt` → `count++`，否則 `count = 1`；`expiresAt = now + windowMs`（基準 8000，玥玥羈絆 11000）。
- `k = [1, 1.3, 1.6][min(count,3) − 1]`；`count ≥ 3` 後下一次重新從 1。
- 套用：click／clickTime `mult = 1 + (mult − 1) × k`；clickAdd／burst／self／team／passive `value × k`；charges、duration 不變。
- effect 記 `chain: count`；存檔驗證：`chain.count` 1–3 整數、`expiresAt` 數字。
- UI：技能槽上方（`#slots` 上 −28px）一條 120×18 小膠帶「連鎖 8s」倒數（1Hz），第二段起顯示「連鎖 ×2」金字、第三段「連鎖 ×3」粉字；到期 200ms 淡出。切入：`count ≥ 2` 時在 `#cutin-stamp` 下方多一枚較小的紅章（60×60，`clicker-fx-stamp.png`）寫「連鎖 ×2／×3」，在 `T.stamp + 120ms` 蓋下（`scale 1.6→1`，90ms，settle），蓋下同時 `sound('cutin-stamp')`＋4px 震。

## 四、羈絆（`B.bonds`）
```js
bonds: [
  { pair:['jiaobu','jiaobu2'], name:'雙刀',   effect:{ chargesPlus:1 } },      // click／clickAdd charges +1
  { pair:['yueyue','yueyue2'], name:'雙尾',   effect:{ chainWindowMs:11000 } },
  { pair:['zhenzhen','zhenzhen2'], name:'雙球', effect:{ selfDurationMul:1.25 } },
]
```
兩隻都在 `collection` 即生效（不用裝槽）。`skillAt` 之後套用。名冊每張卡下方一條羈絆列：兩個 24px 小頭像＋鎖鏈貼紙（`clicker-ui-bond-chain.png`，缺檔用「⛓」），未湊齊灰階＋「需要 膠布原版」。

## 五、場景親和（讀第八輪的 `scene.affinity`）
- `individual(s, id)` 乘 1.5（僅該場景）；`skillAt` 的 cd 再乘 .8。
- 技能槽與夥伴列的頭像右上角一面 18px 小旗 `clicker-ui-flag.png`（既有素材縮小），hover title「廚房當家：收益 ×1.5、冷卻 −20%」。
- 切場景時 `changed()` 重算（`rates` 已吃場景）。

## 六、推薦組合（名冊右上「推薦組合」鍵）
三張票（`clicker-ui-ticket.png` 9-slice，各 280×64）：
| 名 | 三槽 | 一句話 |
|---|---|---|
| 連點流 | yueyue, dog, jiaobu | 王關、限時包：狗 → 玥玥原版 → 膠布原版 |
| 放置流 | yang, zhenzhen2, zhenmu | 掛機：珍珍 → 珍母 → 羊咩 |
| 爆發流 | yang, fox, caihua | 冷凍包、王的最後一擊：羊咩 → 狐狐 → 采華 |
按下 = 依序 `E.equip` 三槽（缺角色的槽跳過並留原本），30 秒換槽等待照舊；缺角色的頭像灰階＋「招募到即可套用」。

## 七、模擬更新
`tools/sim/clicker-boss.js` 加「滿養」情境（全員 5★、當家在場、三技連鎖）跑後院與廚房兩隻王，報告比例；上限 180%。超過就把 `boss.mul` 或連鎖係數回報，不自行改設計值。

## 八、驗收與交付
- `npm test` 全綠：`skillAt` 每 kind 一例（1★、3★、5★）、三條相剋、連鎖三段與到期、羈絆三條、親和乘數、推薦組合裝備（含缺角色）、存檔驗證新欄位。
- `tools/test/clicker-browser.py` 加 round9：hover 兩行文案截圖、連鎖膠帶三段截圖（0／第二技 300ms／第三技 700ms）、連鎖章截圖、推薦組合一鍵裝備、當家小旗、名冊羈絆列。
- `docs/clicker/REPORT-astra-impl-round9.md`：實際公式、每隻 1★→5★ 數值表、模擬結果、未完成。
