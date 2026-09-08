# 第二十六輪派工簡報（Astra）：另外兩張神話的專屬演出

## 不要動的旗標

- `WISH_TELEGRAPH=false`、切入的 `T`／`EASE`（`clicker-cutin.js`）
- 點面板外關最上層面板、卡冊翻頁與箭頭鍵、轉彩 30%
- `B.MARK_MUL_COEF = .5`
- **既有兩個神話演出（`mieshi` 滅世光線、`qinghua` 青花綻放）的參數一個都不准改**
- `clicker-save.js` 的 `REPAIRS` 表與 `repair()`（第二十五輪剛做的存檔自動修復）

## 只准改這兩個檔

```
src/clicker-stage.js      （只准改 mythicSkill() 這一個函式）
src/clicker.css           （只准在既有 .mythic-* 那一段後面「新增」規則，不改既有的）
```

不要動測試檔、不要動素材、不要動其他任何檔案。

---

## 背景

`clicker-stage.js` 的 `mythicSkill(effect)` 目前只認兩張神話：

- `mieshi`（滅世珍獸・滅世光線）→ 橫掃全版的光束＋白閃＋震動
- `qinghua`（青花膠・青花綻放）→ 從技能鈕位置綻放的青花圓環＋12 片花瓣

**神話一共有四張**，另外兩張到現在都沒有演出，放技能時跟一般卡沒兩樣：

| id | 名字 | 技能 | 種類 |
|---|---|---|---|
| `yueyuexian` | 玥來玥閒 | 躺著也會贏 | `team`，全隊每秒 +100%，20 秒 |
| `wanwumythic` | 玩物就玩物 | 捧在手心 | `clickAdd`，接下來 30 次點擊各追加 150% 每秒收益，25 秒 |

這輪要把這兩個補上。

## 演出設計（照做，不要自己改方向）

兩個都**比照 `qinghua` 那條分支的做法**：從技能鈕的位置長出來
（`latestState.skillSlots.indexOf(effect.source)` → `$('slots').children[slot].querySelector('.skill-use')`
→ `getBoundingClientRect()` 換算成舞台座標），不要用 `mieshi` 那種鋪滿全版的做法——
鋪滿版是「打王」專用的，這兩張是增益技能。

### 1. `yueyuexian`（躺著也會贏）：懶洋洋的漣漪

「躺著也會贏」＝全隊收益上升，所以要**往外擴散、慢、不刺眼**，跟青花的「綻放」區隔開。

- 從技能鈕位置往外送 **3 圈同心漣漪**，每圈延遲 140ms 出發（`.mythic-ripple`）
- 每圈：`scale(.25)` 透明 → `scale(1.6)` 不透明 → `scale(2.4)` 淡出，單圈 900ms
- 顏色走「玥」的暖橘金（跟青花的藍、滅世的白金分開），例如描邊 `#F5C26B`、
  底 `radial-gradient(circle, transparent 58%, #F5C26B44 70%, transparent 80%)`
- 外加 **4 個 Z 字**（`.mythic-zzz`，就是打瞌睡那個 Z），從鈕的右上方飄出去，
  各自延遲 0/160/320/480ms，往右上飄 60px 同時 `scale(.6)→1.1`、旋轉 ±12deg，淡出，1000ms
- 整段結束時間**不要超過 1500ms**，收乾淨

### 2. `wanwumythic`（捧在手心）：捧起來的光暈與愛心

卡面是一雙手捧著珍珍羊，技能是「每一下點擊都額外加成」，所以是**往上托、溫柔**。

- 從技能鈕位置往**上**升起一圈柔光（`.mythic-cradle`），
  `translateY(0) scale(.4)` → `translateY(-38px) scale(1.15)`，700ms，淡入再淡出
- 顏色走卡面那個粉：描邊 `#F2A0B4`、底 `radial-gradient(circle, #FFF0F4 20%, #F7C2D0aa 55%, transparent 74%)`
- 外加 **6 顆愛心**（`.mythic-heart`，CSS 用兩個 `::before/::after` 圓角方塊旋轉 ±45deg 拼出來，
  或直接用 `border-radius` 捏，不要載圖），沿著 `rotate(i*60deg) translateY(-42px)` 排開，
  往外飄 20px 並 `scale(.5)→1→.7` 淡出，各自延遲 `i*60ms`，900ms
- 整段結束時間**不要超過 1500ms**

## 實作要點（照抄既有寫法，不要自創）

- 新增的元素**都要**掛 `class="mythic-fx ..."` 與 `setAttribute('aria-hidden','true')`。
  `.mythic-fx` 已經有 `position:absolute; z-index:8; pointer-events:none`，
  **z-index 一定要留在 8**（`#slots` 是 9，特效不能蓋住技能鍵，第二十二輪踩過）。
- 動畫一律用檔案裡既有的 `motion(el, keyframes, duration, done, easing)`，
  結束時務必把節點 `remove()` 掉（既有兩個都這樣做，`mythicSkill` 的驗收會查殘骸歸零）。
- 函式開頭那條 `if (!running || frozen || reduced.matches || rarity !== 'mythic') return;` **不要動**，
  也不要為了新分支放寬它。
- 新分支接在 `qinghua` 那條後面，寫成 `else if (effect.source === 'yueyuexian')` /
  `else if (effect.source === 'wanwumythic')`。

## 驗證（照順序跑，並回報每一步的實際輸出）

1. `npm test` — 應為 **169 例**、0 fail（這輪不該改到任何單元測試）
2. `PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py` — 全綠
   （它會驗滅世光線與青花綻放的演出還在、殘骸歸零、技能鍵沒被蓋住）
3. `PYTHONIOENCODING=utf-8 python tools/test/clicker-round24.py` — 全綠
4. `PYTHONIOENCODING=utf-8 python tools/test/clicker-round25.py` — 全綠

⚠ 寫自己的臨時驗證腳本時記得：**切入期間 `testStage.frozen` 是 true，特效會（正確地）整段跳過**，
要先 `wait_for_function('window.testStage?.running && !window.testStage.frozen')` 再放技能，
否則會驗出「0 個元素」的假失敗（第二十二輪踩過）。

回報：改了哪幾行、四步各自的實際輸出尾巴、有沒有哪一步是紅的。
**不要改「只准改這兩個檔」以外的任何東西**，尤其不要改測試檔的期望值。
