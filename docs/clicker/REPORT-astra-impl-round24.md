# 第二十四輪實作報告

日期：2026-09-08

已依簡報加入五張新卡與指定技能，並將 `city` 加入王關徽章陣列。角色共 51 張、CATALOG 共 56 項、使用 PNG 的角色共 39 張、徽章共 18 枚。五張新卡接在 salamander 後、toy／emoji 前；技能另開第二十四輪區塊，數值照抄。新增 round24 永久測試，涵蓋稀有度、精良 trait、十一 11 發與海豹 clickAdd 強度。

## 修改檔案與行數

以下為 `git diff --numstat` 相對 HEAD 的新增／刪除行數；替換一行會同時計入新增與刪除。

| 檔案 | 新增 | 刪除 | 修改內容 |
| --- | ---: | ---: | --- |
| `src/gacha-pool.js` | 5 | 0 | 五張新卡目錄 |
| `src/clicker-balance.js` | 8 | 0 | 註解與獨立技能區塊 |
| `src/clicker-extras.js` | 1 | 1 | bossScenes 尾端加入 city |
| `tools/test/clicker-round12.test.js` | 1 | 1 | 徽章總數 18 |
| `tools/test/clicker-round15.test.js` | 3 | 3 | 角色 51、PNG 39，更新測試名稱與輪次註解 |
| `tools/test/clicker-round16.test.js` | 1 | 1 | 角色總數 51 |
| `tools/test/clicker-round17.test.js` | 1 | 1 | 技能角色總數 51 |
| `tools/test/clicker-round22.test.js` | 13 | 2 | 新卡清單、既有驗證迴圈、角色總數、新增 round24 測試 |
| `tools/test/gacha-pool.test.js` | 3 | 3 | CATALOG 56、遊戲候選 51、更新測試名稱 |
| `tools/test/clicker-browser.py` | 1 | 1 | 徽章牆總數 18，earned 仍為 1 |
| 合計（不含本報告） | 37 | 13 | 十個簡報允許的檔案 |

另新增本報告 `docs/clicker/REPORT-astra-impl-round24.md`。

簡報漏列 `tools/test/gacha-pool.test.js` 的 `Pool.GAME_POLICY.candidates.length === 46`。新增五張角色後，遊戲候選也必須是 51，因此同步將這個計數改為 51，並更新兩個測試名稱裡的舊數字；其餘既有行為斷言未修改。

## 五步驗證（按實際執行順序）

### 1. 搜尋 `??`

執行原指令：

```sh
grep -rn "??" src/gacha-pool.js src/clicker-balance.js src/clicker-extras.js
```

實際完整輸出（exit 0，代表找到符合項目）：

```text
src/clicker-extras.js:105:    return `我拆了 ${data.packages ?? 0} 包`;
src/clicker-extras.js:340:        if (def.src) { const el = await load(def.src); if (el) ctx.drawImage(el, def.x ?? -12, def.y, def.w ?? 632, def.h); }
src/clicker-extras.js:451:      lastBoss = won ?? 0;
```

**不符合簡報「輸出要是空的」的字面條件。** 三行皆為有效的 JavaScript 空值合併運算子，已用 `git show HEAD:src/clicker-extras.js` 確認原版本就存在；不是本輪新增亂碼。遵照該檔只改 bossScenes 陣列的要求，保留原程式。

### 2. npm test

第一次 `npm test` 被 PowerShell 執行原則擋住（exit 1），實際錯誤尾端：

```text
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

原因為無法載入 `C:\Program Files\nodejs\npm.ps1`。接著改用同一套 npm 的 Windows 命令入口 `npm.cmd test`，未修改系統執行原則或測試腳本。

重跑 exit 0，實際輸出尾端：

```text
ℹ tests 159
ℹ suites 0
ℹ pass 159
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 306.5182
```

### 3. clicker-round22.py

PowerShell 執行方式：

```powershell
$env:PYTHONIOENCODING='utf-8'
python tools/test/clicker-round22.py
```

exit 0；實際輸出尾端：

```text
ok   滅世光線砍掉血量的 27.1%（skillAt share 25.5%）
截圖 _art/out/r22-city-idle.png ／ r22-city-boss.png ／ r22-city-skill.png
ok   滅世光線演出中畫面上有 4 個 .mythic-fx 元素
ok   1.8 秒後演出殘骸歸零（剩 0 個）
ok   演出之後三顆技能鍵都還在最上層、沒被特效蓋住：[True, True, True]
截圖 _art/out/r22-mythic-beam.png ／ r22-mythic-bloom.png
ok   沒有 JS 錯誤：[]

全部通過
```

### 4. clicker-round21.py

```powershell
$env:PYTHONIOENCODING='utf-8'
python tools/test/clicker-round21.py
```

exit 0；實際輸出尾端：

```text
ok   沒有橫向漂移，右緣對齊（範圍 0px）
ok   不再斜體（font-style=normal）
ok   整疊高度 43.285491943359375px（20～48 才叫疊在一起、不叫瀑布）
截圖 _art/out/r21-passive-stack.png
ok   抽完、還沒收下：pending 還在
ok   按 ESC 後畫面沒有被清空：招募層 True／收下鍵 True／卡片 5 張
ok   ESC 之後照樣收得下，招募層正常關閉
ok   沒有 JS 錯誤：[]

全部通過
```

### 5. clicker-browser.py

第一次執行 `python tools/test/clicker-browser.py` 為 exit 1；測試尚未進入瀏覽器驗證，內部 `git show` 就因工作區擁有者與執行帳號不同而失敗。實際錯誤尾端：

```text
subprocess.CalledProcessError: Command '['git', 'show', 'HEAD:src/gacha-card.css']' returned non-zero exit status 128.
```

以本次 shell 與子程序限定的 Git 設定重跑，未寫入全域或 repo Git 設定：

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='D:/claude/clawd-pet'
python tools/test/clicker-browser.py
```

重跑 exit 1。逐卡技能驗證與 Round 6 通過，接著 Round 5 的場景時間凍結斷言失敗；實際輸出尾端：

```text
PASS round7: 12 cutins, burst, timed clicks, offline stacking, static web recruit/save/reload; no missing assets
PASS: Round 6 volume preview/save/popup, real AudioParam samples, fade reversal, center, floaters, ruler, tree overlap
Traceback (most recent call last):
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 1266, in <module>
    main()
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 910, in main
    round5(context)
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 93, in round5
    assert page.evaluate('ClickerScene.time') == frozen
AssertionError
```

注意：上述 `PASS round7: 12 cutins` 是既有輸出文字；該流程實際逐張讀取角色目錄，新五張卡也產生了演出截圖。

簡報說預設指令會走到徽章牆，但實際 `main()` 只有收到 `--round12` 才呼叫 `round12(browser)`，因此原五步跑完後另執行 `python tools/test/clicker-browser.py --round12`（沿用上述 UTF-8 與本次程序 Git 設定），確實驗到修改後的總數 18／earned 1 斷言。exit 0，完整輸出：

```text
PASS round12 browser
```

針對性重跑 `python tools/test/clicker-browser.py --round5` 同樣 exit 1，在完全相同的第 93 行失敗，確認本次環境可重現。實際輸出尾端：

```text
PASS: Round 6 volume preview/save/popup, real AudioParam samples, fade reversal, center, floaters, ruler, tree overlap
Traceback (most recent call last):
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 1266, in <module>
    main()
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 910, in main
    round5(context)
  File "D:\claude\clawd-pet\tools\test\clicker-browser.py", line 93, in round5
    assert page.evaluate('ClickerScene.time') == frozen
AssertionError
```

尚未定位此凍結斷言失敗的根因，不能據此斷定是否由本輪變更引起。遵照簡報禁止修改其他斷言與切入常數的限制，保留該斷言及相關實作，沒有略過、放寬或改等待時間來讓測試過關。

## 最終紅綠狀態

| 步驟 | 最終結果 |
| --- | --- |
| 1. grep | 非空：三行既有合法 `??` 運算子，不符合簡報的空輸出條件 |
| 2. npm test | 綠：改用 npm.cmd，159 pass／0 fail |
| 3. round22.py | 綠：全部通過，exit 0 |
| 4. round21.py | 綠：全部通過，exit 0 |
| 5. clicker-browser.py | **紅：Round 5 第 93 行 AssertionError，針對性重跑亦失敗** |
| 補驗 --round12 | 綠：徽章牆 18／earned 1 已實際驗過 |

五步皆已依序執行，但不是全部通過。另有兩次已排除的執行環境失敗：npm.ps1 執行原則與 Git 目錄擁有者檢查；它們與最後仍存在的 Round 5 斷言失敗分開記錄。

## 範圍核對

`git diff --check` 通過。WISH_TELEGRAPH、切入 T／EASE、點面板外關閉、卡冊翻頁與箭頭鍵、轉彩 30%、MARK_MUL_COEF=.5、bossDamage share（mieshi .22／yuefeimo .08）皆維持原樣。沒有修改或重切任何 `src/card-*.png`，沒有執行 `_art/cardcut.py`。

既有驗證腳本會產生 `_art/out` 與 `tools/test/clicker-artifacts` 的截圖／驗證資料，這些為 Git 忽略的測試產物。已清除本次 Chromium 在工作區根目錄新增的 `debug.log`。開始工作時已存在的簡報與五張未追蹤新卡素材保持原樣。
