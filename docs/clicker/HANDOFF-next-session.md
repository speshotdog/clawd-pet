# 珍母點點：新 session 接續開發提示 ＋ 遊戲性延伸構想

## 一、貼給新 session 的提示（可直接複製）

```
專案：D:\claude研究\clawd-pet（Tauri 2 桌面寵物），子專案「珍母點點」是 label `clicker` 的點餅乾放置遊戲，也有純網頁版部署在 https://speshotdog.github.io/clawd-pet/ （gh-pages 分支只放 dist-web/）。目前 main 在 ed2a31b，未 push；只有 gh-pages 有推。

先讀（順序）：
1. D:\筆記\新的\📦 資源收藏\專案筆記\熱狗寵物.md ── 專案規矩與七輪教訓（尤其：Astra 會偷減演出、build 要 grep 錯誤並驗 exe、worktree build 不更新主 repo exe、實機操作前確認使用者沒在玩、加內容後量關鍵按鈕是否還在面板內）。
2. docs/clicker/HANDOFF-next-session.md ── 本檔第二節的遊戲性延伸構想（關卡／敵人／技能搭配）。
3. docs/clicker/DESIGN-astra.md（經濟）、DESIGN-astra-visual-round2.md（視覺）、REPORT-astra-impl-round1~7.md（每輪實作報告）。
4. src/clicker*.js：clicker.js 宿主、clicker-economy.js 純邏輯（六種技能型別）、clicker-stage.js 舞台、clicker-scene.js 場景資料驅動、clicker-cutin.js 切入（T／EASE／CUTIN 表）、clicker-music.js（ChipForge 引擎即時作曲）、clicker-gacha.js 招募。共用：character-config.js、gacha-pool.js、gacha-card.js、gacha-mode-*.js、src/chipforge/（唯讀，上游 D:\claude研究\chipforge）。

協作方式：
- 我寫簡報到 docs/clicker/BRIEF-astra-impl-roundN.md，交 GPT-6 Astra 實作：
  C:\Users\spesh\.codex\plugins\.plugin-appserver\codex.exe exec -m gpt-6-astra -s workspace-write --skip-git-repo-check -C <repo> -o <報告.md> - < <簡報.md>
  Astra 跑的時候不碰 src/。它會把演出收乾，簡報要把每個時間點與幅度寫死並註明「可以更好，不能更淡」。
- 素材用 Codex imagegen 另開 job（英文 prompt、附 style-ref.png 與 ref-mock-a.png、要求真 alpha 貼紙風），生完用 PIL 裁邊／切 sprite／亮度轉 alpha 再放 src/。
- 驗證：npm test；python tools/test/clicker-browser.py（Playwright，無 server）；自己的 Playwright 腳本用 PowerShell Start-Process 起 python -m http.server 17999 --directory src。
- 出貨：關 clawd-pet.exe → npm run build → grep -c "^error" build.log 為 0、exe mtime 是現在 → git merge --ff-only 到 main → 複製 exe 與 nsis 到 D:\claude研究\clawd-pet\src-tauri\target\release\ → 啟動。網頁版：python tools/export-web.py → orphan commit force push 到 gh-pages（筆記有指令）。
- 實機驗證只截圖不送滑鼠鍵盤；先看 %TEMP%\clawd-debug.log 有沒有近期活動。

這次要做：<填入本次目標，例如「第二場景＋敵人系統第一版」>
```

## 二、遊戲性延伸構想（供下一輪挑選，數值都是起點）

### 2.1 核心問題
現在的循環是「點→買升級→招募→升星」，缺三件事：**目標感**（除了數字變大沒有下一個要去的地方）、**決策**（技能誰配誰沒有差別）、**變化**（同一包拆到底）。下面三個系統各補一件。

### 2.2 關卡＝場景，敵人＝零食包家族

把「拆包」正式做成**關卡制**：每個場景一條包裝家族，拆滿 N 包解鎖下一場景；場景切換時經濟不重置（不是 prestige），只是需求倍率與收益倍率一起提高，讓數字繼續有意義。

| 場景 | 解鎖 | 包裝家族（敵人） | 特性 | 場景 BGM 主題（ChipForge） |
|---|---|---|---|---|
| 後院草地（現有） | 0 | 一般零食包 | 無 | picnic |
| 廚房流理台 | 拆滿 50 包 | 罐頭：血量 ×3，**每 25% 有一層硬殼**，硬殼只吃點擊（被動不推進），逼玩家回來點 | shop |
| 便利商店貨架 | 200 包 | 三連包：一次三個小包並排，點哪個拆哪個，**全拆完才給下一組**，鼓勵連點掃過去（滑鼠移動有意義） | market |
| 零食工廠 | 600 包 | 輸送帶：包裝**會跑**，每 20 秒自動換下一包，沒拆完的算「漏掉」不給幣但不懲罰，燙手的 DPS 檢定 | factory |
| 夜市攤 | 1500 包 | 老闆隨機出現的**限時大禮包**：15 秒內拆完給 10 倍，過期消失；被動收益照常 | nightmarket |
| 深夜冰箱（終局） | 4000 包 | 冷凍包：**需求隨時間回升**（每秒回 1%），要靠 burst 型技能一口氣打穿 | rainynight |

每個場景需要：拆層場景素材一組（照 scene1 的 11 張規格生）、包裝五狀態一組、一首 ChipForge seed。場景切換 UI 用現有預留的「場景」鍵（票券式選單，已解鎖亮、未解鎖顯示條件）。

**敵人（包裝）的三個可調參數**就夠做出差異：`shell`（硬殼段數與位置）、`timer`（限時／自動換包）、`regen`（需求回升）。全部進 `clicker-scene.js` 的設定，不寫死在程式。

### 2.3 技能搭配：讓「三個槽放誰」變成決策

現在六種型別彼此獨立。加**四條互動規則**就會出現組合：

1. **連鎖窗（Combo Window）**：任一技能發動後 8 秒內發動第二個，第二個效果 ×1.3，第三個 ×1.6（顯示「連鎖 ×2／×3」章）。讓「冷卻對齊」有價值：60／90／120 的 CD 有公倍數，玩家會算。
2. **型別相剋加成**：
   - 倍率型（click／clickTime）× 加值型（clickAdd）：加值先乘倍率（現在是先乘後加，改成 `(D + Σadd) × mult`）→ 熱狗狗狗＋膠布原版一擊變大。
   - 自身型（self）與寄生（珍母複製）：珍母複製「含 self 加成後」的值 → ㄌㄎ／珍珍開了再寄生。
   - 全隊型（team）× burst（狐狐 15P）：burst 讀當下含 team 的 P → 羊咩先開再收拾桌面。
3. **角色羈絆（原版 × 新版）**：同時擁有 jiaobu＋jiaobu2、yueyue＋yueyue2、zhenzhen＋zhenzhen2 各給一條被動（例：膠布雙刀「次數型技能多 1 次」、玥玥雙尾「連鎖窗 +3 秒」、珍珍雙球「self 持續 +25%」）。名冊顯示羈絆條。
4. **場景親和**：每個場景標兩隻「當家」角色（收益 ×1.5、CD −20%），逼玩家換槽，而不是一套三槽用到底。

配套：技能槽從「選夥伴」改成有**推薦組合**提示（三個預設組：連點流／放置流／爆發流），新手能直接套。

### 2.4 目標與節奏
- **里程碑徽章**：第 10／25／50 包放小恐龍／黃球／皮球到場景裡（設計文件原本就有），第 100 包 12 選 1 贈卡。
- **每日一包**：每天第一次開遊戲，桌上多一個「今日限定包」，拆完給一次免費單抽。用 `settledAt` 的日期判斷即可。
- **Prestige（第三版原案）**：生涯 1 億幣開放「換一張新桌布」，保留角色與星級，重置幣／手勁／訓練／包數，給永久倍率 `1 + 0.05 × 印記`。網頁版玩家沒有桌寵情感綁定，這是他們的長線目標。

### 2.5 網頁版專屬
- 首次進入的 30 秒教學已夠；補一個**分享卡**：拆到里程碑時 canvas 合成一張「我拆了 N 包／隊伍頭像」的圖，下載或複製。
- 存檔匯出／匯入（JSON 文字）讓玩家換裝置；設計文件第三版原本就有。
- 排行榜先不做（沒有後端）；可做本機「最佳連點」「最快拆 100 包」。

### 2.6 建議的下一輪切法（各一輪 Astra）
1. **關卡系統骨架＋第二場景「廚房流理台」**：場景切換 UI、需求倍率、罐頭硬殼機制、素材一組、BGM seed。
2. **技能互動四條規則＋推薦組合**：經濟純邏輯與測試先做，切入加「連鎖 ×N」章。
3. **第三、四場景與限時包**：三連包、輸送帶。
4. **羈絆、每日一包、分享卡**。
5. **Prestige**。

每輪都要：素材先生、簡報寫死數值、Astra 實作、Playwright 驗、build＋gh-pages 出貨。
