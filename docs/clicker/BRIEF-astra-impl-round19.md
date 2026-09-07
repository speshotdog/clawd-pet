# 珍母點點 第十九輪簡報：招募回本、按鈕改 CSS 畫、技能槽名字遮角色

給 GPT-6 Astra 實作。規則同前：**不要 build、不要起 server、不要 commit、不要碰素材檔（png）、不要精簡任何既有演出**。
**不要動的旗標／行為**：`gacha-mode-wish.js` 的 `WISH_TELEGRAPH` 維持 `false`；`clicker-cutin.js` 的 `T`／`EASE` 不動；點空白關面板、卡冊箭頭翻頁、轉彩 30%、神話 0.5%、`DRAW_SECONDS`（30／135）與 `DRAW_FLOOR`（150／700）不動；第十七、十八輪的東西都不動；`applyZoom` 的 0.25 取整保留。
中文直接寫 UTF-8，寫完 `grep -n "??" src/*.js src/*.css src/*.html tools/**/*.js` 確認。先讀 `docs/clicker/HANDOFF-next-session.md` 第四、五、十二節與 `REPORT-astra-impl-round18.md`。

## 1. 招募回本太慢（使用者：角色多了、等級升了之後卡片變難抽、回本時間太長）

根因（`clicker-economy.js:11-12`）：`drawCost` 釘在 `rates(s).P` 的 30 秒，而 P 含每位夥伴的個別訓練倍率 `partnerMul`（線性 +1 倍／級、里程碑 ×2）。玩家越練，抽一次越貴；但抽到的新卡是 0 級，貢獻只有 `base × 星倍率`，相對練到 100 級的隊伍是幾百分之一。25 隻角色之後每張新卡都要等玩家把牠練上來才「回本」。

### 1a. 招募價改釘「全員視為中位數等級」的 P

- 新增 `medianPartnerLevel(s)`：已招募（`collection[id] > 0`）夥伴的 `partnerLevels` 中位數，取整數（偶數個取兩者較低者）；沒有夥伴時 0。匯出到 api。
- `rates(s, options)` 加第二參數 `{ partnerLevel }`：給了就把 `individual` 裡每位夥伴的 `partnerMul(s.partnerLevels[id])` 換成 `partnerMul(options.partnerLevel)`。其他一切（星、階級、超越、全隊訓練 `1.25 ** trainingLevel`、親和、場景 `rewardMul`、`decoMul`、`markMul`、D 的算法）照舊。**不給第二參數時行為完全不變**（`rates(s)` 被到處呼叫）。
- `drawCost(s, count)` 改用 `rates(s, { partnerLevel: medianPartnerLevel(s) }).P`。秒數與下限不動。
- 為什麼不是 KICKOFF 寫的「未訓練 P」：夥伴練到 100 級時 `partnerMul` 是 808，價格若完全不含訓練，五連會變成 0.2 秒收益、等於免費，招募失去意義。釘中位數，價格仍隨「隊伍一般水準」成長，但不被少數練滿的主力撐高。
- 檢查 `drawCost` 的所有呼叫點（`clicker-gacha.js`、`clicker.js` 的招募按鈕文案、`tools/sim`）簽名不變，不必改。

### 1b. 新夥伴自動追上隊伍（免費）

- `receive(s, id)`（`clicker-economy.js:41`）在 **第一次** 得到這個 id（`!s.collection[id]`）時，`s.partnerLevels[id] = medianPartnerLevel(s)`（用「得到牠之前」的隊伍算，所以要在 `s.collection[id]++` 之前先算好）。重複卡不動。不扣幣、不算入 `buys`。里程碑倍率照 `partnerMul` 自然生效，**不要**觸發卡冊的里程碑慶祝／通知（那是 `train()` 路徑的事）。
- 同一包五連裡先後出現兩張新卡：第二張用的中位數要包含第一張（已經設好等級），照自然順序算即可。
- 卡冊展示頁與入隊演出（`newIds`）不用改；新卡顯示的等級會直接是中位數。
- `clicker-save.js validate` 那條 `(s.collection[id] > 0 || L === 0)` 已能容納，不用改。

### 1c. 模擬器加「第 N 抽的回本秒數」

- `tools/sim/clicker-curve.js`：每次五連在 `drawLog` 多記 `{ price, newIds, gainPerSec, paybackSec }`：`gainPerSec` = 收下後 `rates().P` 減收下前 `rates().P`（同一 `now`，不含技能效果），`paybackSec = price / gainPerSec`（沒有新卡時記 null，另外統計「整包重複」的次數）。結尾多印一行：「五連回本秒數 中位數／最差（第幾抽、哪一天）／整包重複比例」，並印前 5 抽與後 5 抽的明細。
- 改前（`git stash` 或用 `git show HEAD:src/clicker-economy.js` 跑一次）與改後各跑 `node tools/sim/clicker-curve.js`（預設 4 點／20 分／14 天）與 `node tools/sim/clicker-curve.js 4 20 30`，四份輸出全文貼進報告。
- 目標：改後任何階段五連回本 ≤ 30 分鐘（含新卡）；每日五連數不能爆（每段 20 分最多 13 次是模擬器節流，若接近上限要在報告說明）；14 天內到 fridge 的天數與改前差不超過 2 天。**達不到就在報告寫數字，不要自己改 `DRAW_SECONDS`。**

### 1d. 單元測試 `tools/test/clicker-round19.test.js`

- `drawCost` 不隨單一夥伴個別訓練變（三隻夥伴 0/0/0 與 0/0/150，中位數都是 0 → 價格相同）；全部練到 20 → 價格變高。
- `rates(s)` 無第二參數時與改前一模一樣（用改前的公式手算一組數）。
- `receive` 第一次得到 → 等級＝中位數；第二次得到 → 等級不變；隊伍只有一隻時新卡＝那隻的等級；空隊伍 → 0。
- `medianPartnerLevel` 偶數個取較低者。
- 存檔 `validate` 接受這種存檔。

## 2. 按鈕與紙框改用 CSS 畫（使用者截圖：按鈕角落仍有缺口）

第十八輪把縮放比取 0.25 倍數後網頁版四種解析度乾淨，但使用者實機（exe、Windows 顯示縮放 dpr 1.25／1.5 之類）還是缺角。9-slice 貼圖在任意小數縮放下永遠對不齊，**治本：按鈕與紙框不再用 `border-image`，改用 CSS 畫**。

### 2a. 按鈕

- `clicker.css:181` 的 `#game button, #game select, #game .save-plate` 改成：
  - `--button-bg` 取代 `--button-art`；預設奶油色（從 `src/clicker-ui-btn-cream.png` 中心取樣，用 PIL 讀實際像素，不要猜；綠／粉／紫／disabled 同樣取樣 `clicker-ui-btn-green/pink/purple/disabled.png`）。
  - `background: var(--button-bg)`、`border: 3px solid #30251F`、`border-radius: 12px`、`box-shadow: 0 4px 0 #30251F`（硬陰影）、內側虛線 `outline: 2px dashed #FFF6E6AA; outline-offset: -6px`。
  - hover 上浮（`translateY(-1px)`、陰影 5px）、active 下壓（`translateY(3px)`、陰影 1px）沿用現有規則的手感。
  - 原本 `border-image: … / 8px 12px` 撐出來的內距要用 `padding` 補回來，按鈕尺寸與文字位置不能跑（`_art/shot.py` 前後對照）。
- 第 189～191、290、520 行等用 `--button-art` 換色的地方，改成 `--button-bg`；`:disabled`（184）改成 disabled 取樣色＋文字 `#30251F`。
- **例外元件要逐一保住**：`#tap`、`.buddy`、`.slot-pick`、`.skill-use`（圓貼紙）、`#boss-challenge`、`.scene-ticket`、`.recommend-ticket`、`.album-slot`、`.page-corner`（這個是 `--button-art` 奶油鍵，改成 CSS 畫）。凡是原本寫 `border-image:none` 來排除的，要改成同時排除 `border`／`box-shadow`／`outline`／`background`。改完 `grep -n "button-art\|border-image" src/clicker.css` 逐條看。
- 第 407～419 行「9-slice 縫線修正」的填色規則，凡是針對按鈕與紙框的，隨這次改動一併刪掉（它們是為 border-image 補洞的）；標題帶、票券、錢包牌那幾條留著。

### 2b. 紙框

- `.upgrade`、`.recruit`、`#team`（85）、`.panel`／`.small-panel`（287）、`#recruit-topbar`（232）、`#audio-panel`（382）：改成 `border: 3px solid #30251F; border-radius: 14px; background: <clicker-ui-paper.png 中心取樣色>; box-shadow: 0 4px 0 #30251F`，內側虛線 `outline: 2px dashed #30251F55; outline-offset: -7px`。`.wallet` 從 85 行那組拿掉（它用錢包牌 195 行）。
- 原本 `border-image … / 18px`／`22px` 撐出的內距同樣用 `padding` 補回，面板內容位置不能跑。
- **不動**：標題帶（`clicker-ui-label*.png`、`clicker-ui-title-tape.png`）、票券（`clicker-ui-ticket.png`）、錢包牌、`#game::after` 外框、`.desk-mat`、卡冊書（`clicker-ui-album.png`）——圓端造型 CSS 畫會走樣，缺角主要出在按鈕。

### 2c. 驗證

- `python _art/shot.py 2560 1215 r19`、`1920 1080`、`1280 860`、`1366 768` 四種；用 PIL 裁 `#draw-five`、`#click-one`、`.upgrade` 的四角放大 3 倍存 `_art/out/r19-corner-*.png`。
- 另外用 Playwright `device_scale_factor=1.25` 與 `1.5`、viewport 1280×860 各截一次（模擬 exe 的 dpr），一樣裁四角。
- 主畫面、卡冊、招募、輪迴面板截圖與 `_art/out/r18-*.png` 並排看：文字位置與按鈕尺寸不能明顯位移。

## 3. 技能槽的名字遮住角色（使用者截圖：「苔蘚珍珍」「玥來玥閒」壓在角色上）

現況：舞台左下三個技能槽（`.skill-slot` 64×64，`clicker.css:271-277`），名字標籤 `.skill-name` 是 `position:absolute; right:-5px; top:-8px; rotate(4deg)`，兩個字時剛好貼在圓貼紙右上角，**四個字以上就往左延伸到圓心，蓋住 40px 的角色圖**。冷卻秒數 `small` 在右下角。

要做：
- 名字標籤改到**圓貼紙正上方、完全不重疊角色圖**：`left:50%; transform:translateX(-50%) rotate(-3deg); top:auto; bottom:calc(100% - 4px)`（只跟貼紙邊緣咬合 4px，不碰 40px 的角色區）。`white-space:nowrap`、`max-width:96px`、超出用 `text-overflow:ellipsis; overflow:hidden`（現有最長名字先 `node -e` 從 `gacha-pool.js` 列出來確認 11px 字都放得下，放不下才會用到省略）。
- 冷卻 `small` 維持右下角。`[data-state="empty"]` 的「選夥伴」「未解鎖」一樣走新位置。
- 三個槽之間 gap 8px，名字寬度可能超過 64px 互相碰到：第一個槽貼左、第二個置中、第三個貼右各自偏一下，或把 `#slots` 的 gap 改 16px（舞台左下有空間，`#slots{left:28px}`）。二選一，報告說用哪個。
- 另一組 `.buddy .slot-stamp`／`#team` 的隊伍卡（`clicker.css:143`）不在這次範圍，不動。
- 驗證放進 `tools/test/clicker-round19.py`：用 SEED 存檔裝上 3 個最長名字的夥伴（找名字最長的三位），對每個槽取 `.skill-name` 與 `.skill-use .character-png`（或 svg）的 `getBoundingClientRect`，**兩者不能相交**；三個 `.skill-name` 彼此也不能相交；截圖 `_art/out/r19-slots.png`。

## 4. 驗收腳本 `tools/test/clicker-round19.py`

照 `clicker-round18.py` 的骨架（`open_page`、SEED、`check`），涵蓋：1a／1b 的 `window.ClickerEconomy` 呼叫驗證、2c 的四角放大與 dpr 截圖、3 的矩形不相交；最後印 FAIL 清單並以非零 exit。要能用 `PYTHONIOENCODING=utf-8 python tools/test/clicker-round19.py` 一次跑完。

## 5. 交付

- `docs/clicker/REPORT-astra-impl-round19.md`：每項一句話；1c 的四份模擬輸出全文；取樣到的五個按鈕色與紙色（hex）；`r19-corner-*` 與 `r19-slots.png` 路徑；第 3 點選了哪個防碰撞方案。
- `npm.cmd test` 全綠（142 例＋新增）；`PYTHONIOENCODING=utf-8 python tools/test/clicker-round19.py` 全綠；`python tools/test/clicker-round18.py` 仍綠（0.25 取整沒被動到）。
- 不要 build、不要起 server、不要 commit。
