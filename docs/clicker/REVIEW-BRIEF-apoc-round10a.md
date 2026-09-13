# 複檢請求：第十輪 A——五種王關機制（balance-v3，對 `81c5085` 的未 commit 工作樹）

你是唯讀複檢。請讀 `git diff 81c5085`，找出**會讓玩家看到錯誤、卡關卡死、丟進度、被鑽漏洞、或讓 1.0 被弄壞**的問題。
結論分成「必修」「值得修」「不用修（說明為什麼）」，每條附檔案與行號、重現步驟、建議修法。用繁體中文。
⚠ 使用者規則：效能規矩只管閒置狀態，演出中的重量不能砍。

## 背景
使用者：「照企劃做五種」（`D:\claude研究\clawd-pet-50\docs\clicker\PLAN-2.0-levels.md` 第三節）、部位用「怪身上浮出大圓鈕」。以前五隻王都是同一套護盾（`SHIELD`），整個換掉。交接 `docs/clicker/HANDOFF-2026-09-13-v3.md` 〇之十四。

## 改了哪些
| 檔案 | 內容 |
|---|---|
| `src/clicker-apoc-economy.js` | `RULES.BOSS_MECH`（取代 `SHIELD`）；`freshMech`、`mechAt`（滅世珍獸每 15 秒輪流）、`onBeat`、`tapMul`、`idleMul`、`routeDamage`（狗群吸收、殼只吃點擊並在 75/50/25% 長出、節拍連中破防、部位順序破防）、`bossInfo`；`fight` 帶機制狀態；`settle` 放置傷害走 `routeDamage`、狗群清光 20 秒再來；`tap(a, now, {part})`；`normalize` 把舊護盾存檔換成機制狀態 |
| `src/clicker-apoc-ui.js` | 效果標籤照機制寫字（`mechText`）；`renderMech`：部位圓鈕（真的按鈕，`#apoc-parts`）、節拍光圈（對齊 `startedAt`）、狗群小圖示、王的 `.far`／`.shelled`／`.breaking`；`tap(point, part)`；離開末世清掉 |
| `src/clicker.css` | 上述元素的樣式；圓鈕 60px（直式 64px）、字 20px |
| `tools/sim/apoc.js` | 一秒內的點擊分散時間；`ACC` 機率踩拍子／點對部位 |
| 測試 | 單元：五種機制各一條、舊存檔換成機制；`clicker-v3-apoc-play.py`：狗群／清光露王／部位圓鈕真的點得到並破防／節拍光圈；`clicker-ui-audit.py`：結局前先清狗群 |

## 請特別看
1. **卡死**：狗群吸收全部傷害——狗群重生（`AGAIN_MS`）的時候如果玩家戰力很低，會不會永遠打不到王？殼在 25% 長出來而放置打不動，玩家不在場時王關一定輸（這是設計），但會不會出現「殼在場、點擊也打不動」的狀態？滅世珍獸輪流時殼／狗群狀態殘留會不會卡住（例如輪到殼時 `shell.hp>0` 殘留、輪到狗群時 `minions.left` 不重生）？
2. **期限與結算切段**：`settle` 的切段只看 `breakUntil`／`powerUntil`，滅世珍獸 15 秒換機制的邊界沒切，一次補算 60 秒離開再回來會不會整段用錯倍率？是否需要切？
3. **部位圓鈕**：`pointerdown` 停止冒泡、`click` 呼叫 `tap(null, part)`——舞台的點擊區是綁在 `#tap` 的哪個事件？會不會一下算兩次或一次都沒算？觸控裝置、鍵盤 Enter／Space。
4. **節拍對齊**：光圈動畫用負的 `animation-delay` 對齊 `startedAt`，王的逐格動畫也一起對齊；重新整理、切到地圖再回來、分頁隱藏後是否還對得上 `onBeat` 的判定？
5. **存檔可編輯**：`minions`／`shell`／`rhythm`／`order` 被改壞（負數、NaN、`seq` 長度 0、`layer` 超界）會不會 Infinity／卡死？
6. **平衡**：模擬（一天三段 20 分）一般玩家 170 分（加機制前 164）、準確率差 189、慢 371、很懶 483、勤快 38，王關輸 2～5 次。第 8 站（貼紙羊，殼）時間明顯拉長。

## 驗收（我這邊跑過的）
`npm test` 216；`clicker-v3-apoc`、`clicker-v3-apoc-play` 全過；UI 體檢 54 畫面 0 條；截圖看過三種王（狗群、部位、節拍）。
