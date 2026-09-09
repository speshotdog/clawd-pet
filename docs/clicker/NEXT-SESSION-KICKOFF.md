> ⚠ **你現在在 `holo-cards` 分支**。這份是 **`main` 遊戲本體** 的開工提示，而且是舊副本
> （停在第二十三輪；main 上的版本已到第三十三輪）。
> **卡牌／精裝抽卡這條線請改讀 [`HANDOFF-holo-cards.md`](HANDOFF-holo-cards.md) 與
> [`LESSONS-2026-09-09.md`](LESSONS-2026-09-09.md)**；要看 main 的最新狀態請到 `D:\claude\clawd-pet`。

# 珍母點點：新 session 開工提示（2026-09-08 下午之後）

貼給新視窗的第一句：

> 幫我讀 D:\claude\clawd-pet\docs\clicker\NEXT-SESSION-KICKOFF.md 與 HANDOFF-next-session.md 第十五節，照舊分工（我寫簡報 → Astra 用本機 codex.exe 實作 → 我用 Playwright 驗收 → commit／export-web／gh-pages／exe），先收我實玩的回饋。

## 先 `git fetch && git pull --ff-only`

`npm test` 應為 **158 例**。main 最新是 `cd6973b`「第二十三輪」；gh-pages 同步（線上已驗 200）；
exe 與 NSIS 是 2026-09-08 12:11 build 的，**跟 main 同步，不用重 build**。

三個瀏覽器套件都要綠：
```
PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py
PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py
python tools/test/clicker-browser.py            # 舊套件，另有 --round8/9/11/12
```

## 第二十一～二十三輪上線後要收的回饋（優先）

- **被動收益浮字**現在是同一欄疊三個（不再斜斜飄走）——掛機看久了會不會太吵？
- **第七站「滅世都市」**：拆滿 110 包才能挑戰，整張圖當王。難度對嗎？王的圖鋪滿版面會不會太滿？
- **滅世光線 22%**（滅世珍獸神話技能，砍王包血量的百分比）是不是太強？飛沫月月 8% 呢？
- **印記永久倍率改成 `1 + .5×√印記`** 之後的輪迴節奏。祝福定價要不要跟著動——
  現在 markMul ×301 對 blessMul ×86，量級相當，模擬器裡兩者互相拉扯。
- 21 張新卡的稀有度與技能手感（角色總數 46，五連重複率會上升）。

## 可以直接開工的待辦（照優先順序）

1. **`boss-city` 徽章**：`clicker-extras.js` 的 `bossScenes` 還是六站，第七站打贏沒有徽章。
2. **徽章 17 張無字底圖**。⚠ 不要叫 imagegen 把字畫進去（gpt-image-2 畫中文會出錯字），
   要生「無字底圖」讓 `badgeNode()` 照舊疊字。
3. **冷凍包五狀態圖**（現在用 `clicker-can-*` ＋ 霜層）。五個狀態要彼此一致，
   分五次 imagegen 很難對齊，建議同一張改圖或用程式疊霜。
4. **屋頂星空專屬素材**。⚠ 換圖的當下要同時把 `clicker.css` 那條 `hue-rotate` 拿掉，
   否則會二次調色調成怪顏色（冰箱踩過一次）。
5. 模擬器的祝福策略：現在是「有錢就一路買到買不起」，沒有模擬真人會留印記做別的事。

## 派工原則（給 Astra 的簡報開頭一定要列）

- **不要動的旗標**：`WISH_TELEGRAPH=false`、切入的 `T`／`EASE`、點空白關面板、卡冊箭頭、轉彩 30%。
- 明確寫「只准改哪幾個檔」。第二十二輪的經驗：Astra 會照做，但**要求它把驗收寫進測試檔時，
  它只跑臨時腳本、不會留下來**，這段要自己補。
- 跑完先 `grep "??"`（找亂碼）、`npm test`、再跑該輪的 `clicker-roundNN.py`。
- Codex CLI 要 **0.153 以上**才吃得下 `gpt-6-astra`；MCP 包裝器還在傳已移除的 `--full-auto`，
  直接用 `codex exec --sandbox workspace-write -m gpt-6-astra "..."` 比較穩。
