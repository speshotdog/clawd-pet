# 第二十二輪 · Astra 派工：神話技能專屬特效

## 不要動的旗標（照舊）
- `WISH_TELEGRAPH=false`、切入的 `T`／`EASE`、點空白關面板、卡冊箭頭、轉彩 30%。
- 不要改數值：`clicker-balance.js` 的 `characters`、`skillAt`、`MARK_MUL_PER` 一個字都不要動。
- 不要改 `clicker-economy.js`（技能結算已完成並有測試）。
- 不要碰 `src/*.png`（素材已切好）。

## 背景
第二十二輪加了十三張新卡與一個新技能種類 `bossDamage`（傷害＝王包血量的百分比）：
- `mieshi` 滅世珍獸（**神話**）技能「滅世光線」share .22
- `qinghua` 青花膠（**神話**）技能「青花綻放」kind `team`
- `yuefeimo` 飛沫月月（傳說）技能「飛沫直擊」share .08

第七站「滅世都市」的王就是滅世珍獸，戰鬥時整張畫（`clicker-boss7-mieshi.png`）鋪滿版面當王本體
（`#boss-view.full-board`，z-index 8，在技能槽底下）。

目前 `bossDamage` 只共用 burst 的浮字／衝擊／粒子（`clicker-stage.js` 的 `skill()` 第一行），**沒有專屬演出**。

## 你的任務（只做這一件）
在 `src/clicker-stage.js` 的 `skill(effect)` 裡加一個 `mythicSkill(effect)`，只在
`GachaPool.byId[effect.source].rarity === 'mythic'` 時額外播放專屬演出，並在 `src/clicker.css`
補對應的 keyframes／class。兩個神話各一種：

1. **滅世光線（mieshi）** — 從珍獸嘴部往左下斜射的光束掃過整個版面。
   參考原圖裡本來就有的那道黃白色光線（版面座標大約從 (430,150) 射向 (120,330)）。
   建議：一條會拉長、變寬再收掉的漸層光束 ＋ 版面短暫過曝白 ＋ 螢幕震動（用現成的 `shake()`）。
   時間軸控制在 900ms 內。

2. **青花綻放（qinghua）** — 從技能槽那顆頭往外開出一圈青花藍白的花瓣環，
   由小放大、邊緣淡出。時間軸 700ms 內。

## 硬性限制
- 只准改 `src/clicker-stage.js` 與 `src/clicker.css`。
- 一律走既有的 `motion(el, frames, duration, done, easing)` 包裝，不要直接呼叫 `el.animate`
  （`motion` 有處理 reduced-motion 與 frozen）。
- `matchMedia('(prefers-reduced-motion: reduce)')` 為真時整段跳過。
- 元素掛在 `#floaters` 或 `#stage` 底下，`pointer-events:none`，動畫結束一定要 `remove()`，
  不可以留殘骸（連續放三次技能後 DOM 不能一直長）。
- z-index 不要蓋過技能槽（`#slots` 是 9）。
- 不要改任何既有技能的演出。

## 驗收（做完自己跑，全綠才算完成）
```
npm test                                             # 158 例
PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py
PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py
```
再自己補一段 Playwright 檢查（可加在 `tools/test/clicker-round22.py` 尾巴）：
在滅世都市開王 → 連放三次滅世光線 → 斷言
(a) 演出期間 `#stage` 底下出現你新增的元素、
(b) 1.5 秒後那些元素數量回到 0、
(c) `#slots` 的技能鍵仍然可以被 `locator.click()` 點到、
(d) 沒有 JS 錯誤，
並存一張演出中的截圖到 `_art/out/r22-mythic-beam.png`。

回報時附上：改了哪幾行、三個指令的輸出尾巴、截圖路徑。
