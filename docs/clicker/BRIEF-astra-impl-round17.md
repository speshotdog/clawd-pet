# 珍母點點 第十七輪簡報：冰箱終點、新卡 2.0、卡冊排序、印記商店擴充、電動手指、三個 UI 修正、音量條重設計、零食小偷

給 GPT-6 Astra 實作。規則同前：**不要 build、不要起 server、不要 commit、不要碰素材檔、不要精簡任何既有演出**。
**不要動的旗標／行為**：`gacha-mode-wish.js` 的 `WISH_TELEGRAPH` 必須維持 `false`（使用者要求不預告）；`clicker-cutin.js` 的 `T`／`EASE` 不動；點空白關面板、卡冊箭頭鍵、轉彩 30% 都不動。
中文直接寫 UTF-8，寫完 `grep -n "??" src/*.js src/*.html` 確認。先讀 `docs/clicker/HANDOFF-next-session.md` 第四、十節與 `REPORT-astra-impl-round15/16.md`。

## 1. 深夜冰箱：固定 100 包門檻，王勝＝全破

現況：`canBoss`（`clicker-economy.js`）用下一個場景的 `unlock.packages` 當本場景的挑戰門檻；`rooftop.unlock` 是 null，所以冰箱永遠不能挑戰王。

- `clicker-scene.js` 冰箱加 `bossPackages: 100`；`canBoss` 改成 `scene.bossPackages ?? nextScene?.unlock?.packages`，其他場景行為不變。
- 冰箱王勝：`bossWins` 記 `fridge`、給既有獎勵（免費五連 5、萬用粉塵 3）、**不切場景**（留在冰箱繼續拆）；舞台跳一張「全破！」字卡（沿用 `#boss-banner` 的膠帶字卡樣式，文案「六站全破！珍母的零食櫃清空了」），並開 `boss-fridge` 徽章。之後可再挑戰但沒有額外獎勵（沿用既有 30 秒冷卻）。
- 測試：round17 加「冰箱 100 包可挑戰、勝利不切場景、徽章可得」。

## 2. 新卡 2.0（四張，素材已在 `src/card-*.png`）

| id | 名稱 | 稀有度 | base | 技能 |
|---|---|---|---|---|
| `jiaotou` | 膠頭燃額 | 傳說 | 18 | **點擊特化**（見下） |
| `jinggou` | 警狗 | 傳說 | 18 | 警棍敲擊 `click` multiplier 8, charges 3, duration 15, cd 60 |
| `gebugou` | 哥不狗 | 史詩 | 9 | 偷吃一口 `burst` factor 18, basis 'team', cd 100 |
| `zhenjpg` | 珍珍JPG | 史詩（使用者沒標，先當史詩） | 8 | 壓縮失真 `self` multiplier 4.5, duration 20, cd 110 |

**膠頭燃額＝點擊傷害特化卡**（使用者原話）：
- 技能「燃額連擊」`clickTime` multiplier 4, duration 15, cd 90（比玥玥原版 ×3／12s 強一階）。
- **新增被動特質 `trait: { clickMul: 1.5 }`**：只要膠頭燃額**裝在技能槽**，每次點擊 D ×1.5（在 `rates()` 算 D 時乘上所有已裝備夥伴的 `trait.clickMul`，只有它有）。升星每星 +0.1（5★ = ×1.9）、超越每級 +0.05。卡面與展示頁要顯示這條特質（「裝備時攻擊力 ×1.5」）；`skillAt` 回傳物件帶 `trait`。
- 這是唯一的 trait，用最小實作：`B.characters[id].trait`，`rates()` 讀 `s.skillSlots` 裝備者。存檔不新增欄位。

全部走第十五輪的 PNG 靜態圖分支（`src` 屬性）；卡池目錄、`clicker-balance.js`、卡冊、切入、分享卡 portrait、驗證白名單、舊存檔補欄位都要跟上。角色總數 25。

## 3. 卡冊排序：稀有度低→高

`clicker-album.js` 的 `IDS` 改為依稀有度 rare → epic → legendary → mythic 排序，同稀有度內照目錄順序。卡冊、展示頁翻頁、推薦組合都用這個順序。夥伴列（`.buddy` 圓鈕）順序不動。

## 4. 印記商店擴充＋電動手指上限

- `B.autoClickMax` 6 → **10**（每秒 5 下）。價格公式不變。
- 印記商店（`clicker-balance.js marks`）新增四項，`clicker-prestige.js`／`clicker-economy.js` 接效果：

| id | 名稱 | 印記 | 效果 |
|---|---|---|---|
| `finger14` | 電動手指擴充 | 3 | 上限 10 → 14 |
| `bossTime` | 王包 +10 秒 | 3 | 王包限時 30 → 40 秒；**血量公式仍用 30 秒容量**（不跟著變大） |
| `offline15` | 離線收益 ×1.5 | 4 | 離線結算金幣 ×1.5（只影響金幣，不影響包進度） |
| `daily2` | 每日包雙倍 | 2 | 每日限定包獎勵：免費單抽 +2、萬用粉塵 +2、金幣 ×2 |

- 印記面板列表自然多四列；`validate()` 的 `marksClaimed >= marks + 商店總價` 檢查會跟著總價變，確認測試種子仍合法。
- 測試：每項效果各一例。

## 5. 更衣室桌面裝飾欄被擠壓（使用者截圖：點留聲機後整欄變窄、字折行）

`clicker.css` `#wardrobe-body { grid-template-columns:1fr 1fr 1fr }`、`.wardrobe-col`、`.wardrobe-item`。
- 三欄改 `repeat(3, minmax(0, 1fr))`，`.wardrobe-col { min-width:0 }`，`.wardrobe-item { min-width:0 }`。
- 裝飾名 `b` 與狀態 `small` 加 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`；「已放上桌」不准折成兩行。
- `#wardrobe-decor-price` 文案縮短為「下一件 X 幣・+1%／件（9/10）」並 `white-space:normal`，不要撐寬欄。
- 點購買後 `renderWardrobe()` 重建整欄會讓捲軸跳回頂端：重建前記 `scrollTop`，重建後還原。
- 在 2560×1215 與 1280×860 各驗一次（`python _art/shot.py <寬> <高> <前綴>` 會截更衣室）。

## 6. 「我的夥伴」標題帶文字擠出框（使用者截圖）

`clicker.css:226` `.buddy-header h2 { width:146px }` 是固定寬，第十四輪把標題帶 9-slice 側寬改成 14px 之後內容區變窄，愛心徽章＋四個字擠到右邊框外。
- 改成 `width:auto; min-width:146px; padding:0 12px 0 8px`，並確認 `#shop h2`（攻擊力／全隊訓練／招募夥伴）與 `.skills-heading` 在 2560 寬也沒有貼邊：兩側至少留 8px。
- 順手檢查所有 `border-image ... fill` 的標題／票券在 2560 寬的文字內距。

## 7. 音量面板重設計＋百分比

`clicker.html:21-25`、`clicker.css:380-388`。使用者：音量條很粗糙。
- 面板寬 160 → **220px**，高自適應；每列改成三欄 `26px 1fr 40px`：靜音鍵、滑桿、**百分比**（`<output>`，`tabular-nums`，即時跟著 `input` 更新，例如「60%」）。
- 滑桿：軌道 10px 高、圓角、底色紙色、**左側已填滿部分用粉紅**（用 `linear-gradient(90deg, var(--tape) p%, #E9D6B4 p%)` 由 JS 設 `--p`），墨線邊 2px；thumb 改成 24px 圓形貼紙（奶油底、墨線 2px、硬陰影 2px），不再用 40px 的 `sticker-badge` 圖（那個太大、遮住軌道）。
- 兩列標籤「音樂」「音效」字級 13px；靜音狀態的鍵維持半透明＋刪除線。
- 0% 時百分比顯示「靜音」。
- 存檔仍存 0～1 的小數；不改 `clicker-music.js`／`gacha-audio.js` 的介面。

## 8. 零食小偷（三隻怪物素材 `src/monster-0/1/2.png`）

使用者提供三隻怪物讓我們當關卡怪物。做一個**輕量事件**，不影響既有機制：
- 後院、便利商店、零食工廠各配一隻（monster-0 黃貓 → 後院、monster-1 白雲羊 → 便利商店、monster-2 棕毛球 → 工廠；場景設定加 `thief: { sprite, everyMs:[60000,120000], hits:5, reward:20 }`）。
- 每 60～120 秒從舞台右側探頭走到包裝旁邊（滑入 600ms、上下浮動），停 12 秒；**點牠 5 下**趕走，掉落金幣 = 20 秒的 P（用 `grant` 進錢包但**不進拆包進度**，浮字「零食小偷跑了！+X」）；沒趕走就帶著一片零食離開（無懲罰）。
- 離線不出現；王包進行中不出現；只有可見時才計時（沿用禮包 `gift` 的可見／離線判斷方式）。
- 純舞台層（`clicker-stage.js`）＋經濟層一個 `thiefHit()`；存檔不新增持久欄位（事件狀態放 `s.thief` 暫態，validate 允許可選）。
- 測試：出現節奏、5 下趕走、獎勵不進包進度、離線不出現。

## 9. 交付

- `docs/clicker/REPORT-astra-impl-round17.md` 每項一句話。
- `npm.cmd test` 全綠（新增 `tools/test/clicker-round17.test.js`）。
- `DESIGN-balance-v2.md` 補：冰箱終點、新卡、trait、印記四項、電動手指上限、零食小偷。
- 不要 build、不要起 server、不要 commit。
