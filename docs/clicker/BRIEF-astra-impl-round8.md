# 珍母點點 第八輪實作：關卡骨架＋廚房場景（罐頭硬殼）＋王包規則＋場景切換（可寫檔）

先 `git log -4`。可寫範圍：`src/clicker*.*`、`tools/test/clicker-*`、新增 `tools/sim/clicker-boss.js`、`docs/clicker/REPORT-astra-impl-round8.md`。`src/chipforge/` 唯讀；不碰 `src-tauri/`、`pet.js`、`index.html`、`menu.*`、共用 `gacha-*`；`clicker-cutin.js` 的 `T`／`EASE` 不動。不 build、不起 server、不 commit。演出規格「可以更好，不能更淡」：下面寫死的時間點、幅度、粒子數是下限。

設計依據：`docs/clicker/DESIGN-round8-roadmap.md` 第 1 節（關卡與王包）。素材檔名先寫死，我會在你實作期間放進 `src/`；缺檔時 `onerror` 隱藏、不報錯（沿用 scene1 的做法）。

## 使用者原話
> 關卡＝場景、敵人＝包裝家族：後院一般包 → 廚房罐頭（每 25% 一層硬殼只吃點擊）…敵人只靠三個參數 shell／timer／regen 做差異，全進場景設定。打王的規則、進入王關卡的時機、打不贏會退回一般戰鬥，要有挑戰性但又不讓遊戲太難玩。

---

## 一、場景設定資料化（`clicker-scene.js`）

每個場景加：
```js
requirementMul, rewardMul,          // 需求與收益同倍率：backyard 1／kitchen 3
unlock: { packages: 50, boss: 'backyard' },   // 要在哪個場景拆滿幾包、打贏哪隻王
enemy: { shell: [.75,.5,.25] | null, timer: 秒 | null, regen: 每秒比例 | null },
boss: { name: '大罐頭', mul: 6, seconds: 30, crackKeep: .5, crackMax: .75, cooldown: 30, reward: { freeDraws: 5 } },
bagSkin: 1, affinity: ['zhenzhen2','fox'],   // 親和本輪只顯示旗子、不生效（第九輪）
```
`kitchen` 場景：`requirementMul: 3, rewardMul: 3`、`enemy.shell: [.75,.5,.25]`、`unlock: { packages: 50, boss: 'backyard' }`（後院的王守著廚房門）、palette `{ mat:'#B9A58A', sky:'#F3E7D3' }`、music `{ theme:'shop', seed:'zhenmu-kitchen-1', gen:{ density:50, rhythm:55, speed:45, drama:35, mood:65, hook:60, smooth:55 } }`。層次照 scene1 的規格：`clicker-scene2-sky/far/mid/ground.png`、`clicker-scene2-prop-0..2.png`（鍋子、砧板、調味罐）、`clicker-scene2-steam-0..1.png`（取代雲，向上飄）、`clicker-scene2-particle-0..1.png`（麵粉／蒸氣點）、掛鉤上的抹布 `clicker-scene2-cloth.png` 用 sway。沒有樹。

`rewardMul` 進 `rates()`：`P` 與 `D` 都乘（升級時的預覽也要乘），`requirement()` 已吃 `requirementMul`。

## 二、罐頭硬殼（經濟純邏輯 `clicker-economy.js`）

- `package` 加 `shells: [.75,.5,.25]`（進包時從場景複製；後院為 `[]`）。
- 進度推進規則：`advancePackage` 對「非點擊」來源（被動、burst、離線）的拆包力，**推進到下一層硬殼就停**，多出來的拆包力不浪費：改成金幣照給、但拆包進度停在硬殼線（`progress = need × (1 − shell)`），並累計到 `package.blocked`（顯示用，不入進度）。
- 點擊來源：先「敲殼」——硬殼有 **3 點耐久**（每次有效點擊 −1，不看拆包力），敲破後本次點擊的拆包力照常推進，且把 `blocked` 一次釋放（前面被擋住的被動拆包力此刻灌進去；這是「回來點一下就整包爆開」的爽點，也是玩家回來的理由）。
- 離線結算：硬殼包在離線時最多推到第一層硬殼，`blocked` 累計上限＝該包需求的 3 倍（避免掛 8 小時回來一點就跳 200 包，改成「一點爆三包」）。
- 測試：硬殼停住、敲殼 3 下、釋放 blocked、離線上限、跨包（新包重新複製 shells）、`advancePackage` 對沒有 shells 的場景行為不變（既有 43 例仍綠）。

舞台表現（`clicker-stage.js`）：罐頭五狀態 `clicker-can-0..4.png`；硬殼是疊在罐頭上的 `clicker-can-shell.png`（金屬環）三層，被擋住時環會發亮呼吸（1.2s 循環，僅在 blocked>0 時跑）；敲殼每下：環 `scale(1.06)` 120ms＋金屬「鏘」（`noiseHit f0 5200→2400 d .04 gain .18` ＋ `tone 1320 d .05`）；第 3 下環碎成 10 片金屬碎片（sprite 14 上色 #D9D9D9、`lighter`）＋整桌震 4px＋`blocked` 釋放時浮字一個大數字（重擊樣式）＋`burst(18, heavy)`。

## 三、王包（經濟＋舞台＋UI）

### 3.1 狀態
`state.boss = null | { scene:'backyard', need, dealt, startedAt, endsAt, crack }`；`state.bossWins: ['backyard']`；`state.bossCooldownUntil`。

### 3.2 規則（寫死）
- 出現：目前場景 `package.index − 1 ≥ 下一場景.unlock.packages` 且該王未勝 → 舞台右上（x 470, y 40）出現「挑戰大罐頭！」貼紙鍵（`clicker-ui-boss-btn.png`，120×48，輕微 −3° 旋轉，出現時 `scale(0→1.1→1)` 260ms＋`sound('upgrade')`）。
- 按下：`E.startBoss(state, now)`：`need = boss.mul × requirement(package.index)`、`dealt = crack × need`、`endsAt = now + 30000`。一般包暫停（不推進、不收幣的部分**照常收幣**——王包期間所有拆包力進王，金幣照給）。
- 期間：點擊、burst、被動、技能全進 `dealt`。硬殼規則同罐頭（廚房王三層）。
- 勝：`dealt ≥ need` → `bossWins.push`、下一場景 `unlocked`、`settings.scene` 自動切換、`freeDraws += 5`（免費抽：`purchaseDraw` 先扣 `freeDraws` 再扣幣；招募 UI 顯示「免費 ×5」）。裂痕歸零。
- 敗：30 秒到 `dealt < need` → `crack = min(crackMax, dealt/need × crackKeep)`（第一次打到 80% → 裂痕 40%；最多 75%）、`bossCooldownUntil = now + 30000`、回一般包（一般包進度原封不動）。
- 王包期間不能開招募、不能切場景；可以開名冊換槽。
- 隱藏／關窗：王包**立刻結束視為敗**（存檔寫入 crack）；不讓王在背景跑。

### 3.3 舞台演出（寫死）
- 進場 600ms：一般包滑出右側（`translateX(200px)` 220ms ease-in）→ 王包 `clicker-boss-can.png`（260×300，放 x 330, y 60）從上方落下 300ms（`translateY(-360px → 0)`，落地 `scale(1.06,.94)` 90ms 回正）＋整桌震 6px 80ms＋`burst(24, heavy)` 碎紙從落點噴＋低頻 `tone 70→40 d .5 gain .5`。同時 BGM 切戰鬥曲（沿用技能切換曲線，但整段王包期間不退場）。
- 倒數：舞台頂（y 28）一條 560×16 紙膠帶進度條（`clicker-ui-tape-0.png` 拉伸）從滿往左縮，剩 10 秒變粉紅（`#EF8E8E`）並每秒 `scale(1.03)` 心跳＋`tone 880 d .06 gain .08`。王血條：王包下方 300×14，填色金→粉，數字「12.3萬 / 60.0萬」。
- 勝：王包 `scale(1.15)` 120ms → 白閃 `#FFF6E6` 60ms → 爆成 **48 片**碎紙（三倍普通拆包）＋ 6 個 sprite 3 光環＋整桌震 8px 160ms（用 gacha.css 的 `clicker-shake` keyframes）＋ 鐘聲（沿用 `GachaAudio` 傳說揭曉音）；800ms 後紙板橫幅「廚房流理台 解鎖！」（`clicker-ui-title-tape.png`，中央 520×70，`scale(.8→1)` 200ms settle）停 1600ms 滑走；接著場景 `mount('kitchen')` 用 400ms 交叉淡入（舊場景 `opacity 1→0`、新場景 `0→1`）。
- 敗：王包搖頭（`rotate(-4deg / 4deg)` 三次各 80ms）＋硬殼裂痕貼圖 `clicker-boss-crack.png` 依 crack 值顯示（>0 一道、>.5 兩道、≥.75 三道）→ 王包向上飄走 400ms（`translateY(-80px)`，`opacity→0`）→ 一般包從右滑回 220ms；便條「差一點！裂痕 40%，30 秒後再來」（`notice`）。

### 3.4 難度校準（`tools/sim/clicker-boss.js`）
用 `DESIGN-astra.md` 一‑7 的路徑（前 30 分鐘 2 次／秒；之後每天兩次各 10 分鐘 6 次／秒；收入 20/40/40 分給手勁／訓練／招募；抽卡用 `GachaPool` 固定 seed），跑到「後院 50 包」，量三種 30 秒打法對 `need` 的比例並印表：只放置／連點 6 次／秒不用技／連點＋推薦組合「連點流」（沒抽到就用當下擁有的最強兩個技能）。目標：35–45%／70–85%／110–140%。不在區間就調 `boss.mul`（後院王一個值），報告寫實際數字與最終係數。

## 四、場景切換 UI
- footer 的「場景」鍵啟用：開一張票券式選單（`small-panel`），六張票（`clicker-ui-ticket.png` 9-slice，每張 300×64）：場景名、縮圖（`clicker-scene{n}-thumb.png` 96×54，缺檔用色塊）、狀態（「目前」／「已解鎖」／「拆滿 50 包並打贏大罐頭」）。本輪只有兩張真的能切；其餘四張顯示條件、灰票。
- 切換：`settings.scene` 改、`mount()`、BGM 交叉淡入（沿用曲線）；經濟不重置。切換不能在王包中。
- 存檔 `validate`：`scene` 必須已解鎖（`bossWins` 含其 `unlock.boss` 或無門檻）。

## 五、粒子淡出（已修，請保留）
`clicker-scene.js` 粒子 alpha 夾在 [0,1]、前 0.5 秒淡入、到期當幀移除——這是使用者回報「飄浮物突然消失／瞬移」的修正，別改回去。

## 六、驗收與交付
- `node --check`、`npm test` 全綠（新增：硬殼 6 例、王包 8 例含隱藏視為敗與存檔驗證、rewardMul 進 rates、場景解鎖驗證）。
- `tools/test/clicker-browser.py` 加 round8：後院 50 包→挑戰鍵出現→開王→30 秒敗→裂痕→再挑戰（注入高手勁）→勝→廚房場景 mount、免費五連可用；廚房硬殼被動停住→點 3 下釋放 blocked 截圖 0／120／400ms；場景票券選單截圖；粒子淡出（連續抓 `globalAlpha`，最後一格 < .1）。
- 截圖：`round8-boss-enter.png`、`round8-boss-win.png`、`round8-boss-fail.png`、`round8-kitchen.png`、`round8-shell-release.png`、`round8-scenes.png`。
- `docs/clicker/REPORT-astra-impl-round8.md`：規則實際數值、模擬結果表與最終 `boss.mul`、素材引用清單（我補圖用）、未完成。
