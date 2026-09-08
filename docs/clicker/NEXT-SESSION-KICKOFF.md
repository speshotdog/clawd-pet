# 珍母點點：新 session 開工提示（2026-09-08 晚，第三十二輪之後）

貼給新視窗的第一句：

> 幫我讀 D:\claude\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十七節，
> 照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先收我實玩的回饋。

## 先 `git fetch && git pull --ff-only`

`npm test` 應為 **170 例**。main 最新是**第三十二輪**（`4034a7f` 直式手機收尾：招募演出 2+3、
卡冊單頁、面板抬頭、入隊演出座標）。gh-pages 已同步（`e729aaf`），**exe 還停在第三十一輪、需要重 build**。

⚠ 發佈 gh-pages 前先 `git worktree list`：上一個 session 在 `%TEMP%` 留了一個占著 gh-pages 分支的
worktree，害 `git checkout --orphan gh-pages` 直接 fatal（而 `git branch -D` 的錯誤被 `2>/dev/null` 吞掉）。
看到 `%TEMP%` 底下的殘留就 `git worktree remove --force` 再走第二節的流程。

驗收套件（Playwright，全部要綠）：
```
PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py    # 冰箱王、被動浮字疊三層、招募 ESC
PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py    # 第七站滅世都市、神話演出
PYTHONIOENCODING=utf-8 python tools/test/clicker-round24.py    # 新卡、boss-city 徽章、卡面滿版
PYTHONIOENCODING=utf-8 python tools/test/clicker-round25.py    # 存檔自動修復、錯誤畫面救援入口
PYTHONIOENCODING=utf-8 python tools/test/clicker-round26.py    # 卡冊不重播進場、粉塵罐不跳頁、繼續五連
PYTHONIOENCODING=utf-8 python tools/test/clicker-round27.py    # 打完終點王還換得了場景
PYTHONIOENCODING=utf-8 python tools/test/clicker-round29.py    # 減少動畫時浮字仍看得到
PYTHONIOENCODING=utf-8 python tools/test/clicker-round30.py    # 遞增價、商店兩層、裝飾預設不擺、會動的怪
PYTHONIOENCODING=utf-8 python tools/test/clicker-round31.py    # 商店置中懸浮視窗、直式手機版面
PYTHONIOENCODING=utf-8 python tools/test/clicker-round32.py    # 直式招募 2+3、卡冊單頁、入隊演出座標（含 320 寬與橫式回歸）
python tools/test/clicker-browser.py                            # 舊套件，另有 --round8/9/11/12
```
⚠ `clicker-browser.py` 預設流程的 **round5 場景凍結斷言是紅的，而且在很久以前就紅了**
（不是哪一輪弄壞的）。根因：切入凍結是 `T.unfreeze` = 1250ms，測試卻等 1000ms 才量，
只剩 250ms 餘裕，被 Playwright 點擊本身的 ~200ms 延遲吃掉就翻。要修就改成從點擊開始計時。

## 待收的實玩回饋（一直沒收到，優先問）

- 被動收益浮字同欄疊三個，掛機看久了會不會太吵？
- 第七站「滅世都市」拆滿 110 包才能挑戰、整張圖當王——難度對嗎？版面會不會太滿？
- 滅世光線 22%（砍王包血量的百分比）是不是太強？飛沫月月 8% 呢？
- 印記倍率改 `1 + .5×√印記` 之後的輪迴節奏。
- **粉塵兌換剛改成遞增價**（第 n 次要 n 印記），實際玩起來會不會太緊？

## 可以直接開工的待辦

1. **直式手機版面**：第三十二輪已收尾（招募 2+3、卡冊單頁、面板抬頭、入隊演出座標、
   夥伴列漸層、320 寬、「選擇演出方式」不再被藏）。剩下沒試的只有
   **瀏覽器工具列收合（動態 viewport）與實機橫直旋轉**——程式有掛 resize 重排
   （`gacha.restore()` ＋ `album.relayout()`），但只在 headless 改 viewport 驗過。
   ⚠ 舞台是**被寬度綁死**的（374/608 = 0.615 → 高 221），要它更高就得更寬，
   所以多出來的垂直空間只能當留白，不能拿來放大舞台。
   ⚠ 招募演出直式是 **560×900 的座標系**（`ClickerGacha.PORTRAIT_BOX`），不是 960×640。
   要改招募的版面先看第十七節，別直接改 960 的數字。
2. **徽章 17 張無字底圖**仍缺（走 `badgeNode()` 的合成 fallback）。
   ⚠ 不要叫 imagegen 把字畫進去（gpt-image-2 畫中文會出錯字），要生「無字底圖」讓程式疊字。
3. **冷凍包五狀態圖**仍缺（現在用 `clicker-can-*` ＋ 霜層）。五個狀態要彼此一致，
   分五次 imagegen 很難對齊，建議同一張改圖或用程式疊霜。
4. **屋頂星空專屬素材**。⚠ 換圖的當下要同時把 `clicker.css` 那條 `hue-rotate` 拿掉，
   否則會二次調色調成怪顏色（冰箱踩過一次）。
5. **難度整體檢視**：角色 52 張後，單抽機率被稀釋到 精良 3.86%／史詩 1.67%／傳說 0.33%／
   神話 0.125%。收集本身已經變慢，先讓使用者用全圖鑑存檔實玩再決定要不要動王的血量。
6. **華麗卡牌（3D 鐳射／全息）** 的研究在 `holo-cards` 分支，`docs/clicker/BRIEF-holo-cards-research.md`。

## 派工原則（給 Astra 的簡報開頭一定要列）

- **不要動的旗標**：`WISH_TELEGRAPH=false`、切入的 `T`／`EASE`、點空白關面板、卡冊箭頭、轉彩 30%、
  `B.MARK_MUL_COEF=.5`、`bossDamage` 的 share（mieshi .22／yuefeimo .08）、
  `clicker-save.js` 的 `REPAIRS` 表與 `repair()`。
  第三十二輪新增：`ClickerGacha.PORTRAIT_BOX`（560×900／pad 76）與直式 2+3 的 `layout()`、
  `#join-flight` 的座標換算（`rect.width / clientWidth`，橫直共用同一套，改一邊就會飛歪）、
  卡冊的單頁索引 `page` 與 `wide()/sheet()/sheets()`。
- 明確寫「只准改哪幾個檔」。Astra 會照做，但**要求它把驗收寫進測試檔時它只跑臨時腳本、不會留下來**，
  這段要自己補。
- 跑完先 `grep "??"`（找亂碼；JS 的 `??` 運算子會誤中，看到要自己判斷）、`npm test`、再跑該輪的 `clicker-roundNN.py`。
- Codex CLI 要 **0.153 以上**才吃得下 `gpt-6-astra`；直接用
  `codex exec --sandbox workspace-write -m gpt-6-astra "..."` 比較穩。
  ⚠ **它會用完額度**（2026-09-08 就中過，訊息是 usage limit、幾小時後才重置），
  額度沒了它會安靜地什麼都不做、exit 0，要自己檢查 `git status` 有沒有東西。
