# 珍母點點：新 session 開工提示（2026-09-08 傍晚之後）

貼給新視窗的第一句：

> 幫我讀 D:\claude\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十六節，
> 照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先收我實玩的回饋。

## 先 `git fetch && git pull --ff-only`

`npm test` 應為 **170 例**。main 最新是第三十一輪（商店置中懸浮視窗＋直式手機版面）。
gh-pages 與 exe 都與 main 同步。

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

1. **直式手機版面的收尾**（第三十一輪只做到「排得下、不出捲軸」）：
   - 夥伴列吸收剩餘空間後中間有點空
   - 「名冊 52/52」的數字在分頁鈕裡會被切
   - 錢包的幣數在直式沒顯示出來（只看得到每次／每秒）
   - 招募演出的五連卡片在直式還沒排成 2+3
   - 卡冊的兩頁跨頁在直式還沒改成單頁
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
- 明確寫「只准改哪幾個檔」。Astra 會照做，但**要求它把驗收寫進測試檔時它只跑臨時腳本、不會留下來**，
  這段要自己補。
- 跑完先 `grep "??"`（找亂碼；JS 的 `??` 運算子會誤中，看到要自己判斷）、`npm test`、再跑該輪的 `clicker-roundNN.py`。
- Codex CLI 要 **0.153 以上**才吃得下 `gpt-6-astra`；直接用
  `codex exec --sandbox workspace-write -m gpt-6-astra "..."` 比較穩。
  ⚠ **它會用完額度**（2026-09-08 就中過，訊息是 usage limit、幾小時後才重置），
  額度沒了它會安靜地什麼都不做、exit 0，要自己檢查 `git status` 有沒有東西。
