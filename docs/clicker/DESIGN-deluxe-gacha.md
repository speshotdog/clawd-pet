# 精裝版特殊抽卡設計

狀態：研究與設計稿，尚未定案商業規則，也不代表本輪要修改程式。

本案是新增一個獨立卡池與第六種 `GachaModes` 演出。既有五種模式——`hearthstone` 拆包桌面、`rip` 撕包、`stage` 拉幕登場、`summon` 腳印召喚陣、`wish` 流星投遞——維持原檔案、節拍、素材、旗標及共用 runtime 行為不變。尤其不改 `WISH_TELEGRAPH = false`，也不改 `hearthstone` 已定案的節拍。

## 1. 先定義「精裝」的體驗差異

精裝版不是把拆包桌面加亮、加金色或提高粒子數。既有五種模式的核心都是「一個外部事件發生，卡片被送到玩家面前」：包被拆開、封口被撕、舞台揭幕、召喚陣啟動、流星墜落。

第六種採用「裝幀工作室」：玩家不是打開一包，也不是等待角色登場，而是看見一件尚未完成的典藏品被逐層裝幀。每張結果先以無角色的典藏頁進入編目槽，封蠟、金屬邊、紙張、箔面和卡片背面依序完成；玩家在最後一步親自「壓印」揭曉。這是不同的互動隱喻與空間語法：

| | 既有模式 | 精裝版第六模式 |
|---|---|---|
| 主要動作 | 拆、撕、拉、召喚、投遞 | 編目、裝幀、壓印、揭曉 |
| 空間 | 桌面事件、舞台或天空 | 近距離的典藏冊／裝幀台 |
| 期待感 | 外部力量把結果帶來 | 玩家逐層完成一件物品 |
| 高品質來源 | 事件特效與卡片揭曉 | 材質分層、精準對位、觸感節拍與精美版專屬壓印 |

因此「精裝」來自工藝感與完成感，而不是單純把視覺參數調高。普通卡也走完整裝幀流程；精美版在最後的壓印與開頁階段才出現明顯不同，避免在抽取前預告結果或破壞未知感。

## 2. 現況拆解：從入口到入袋

### 2.1 共用抽樣層

`src/gacha-pool.js` 目前同時持有 `CATALOG`、稀有度資料、`DEMO_POLICY`、`GAME_POLICY` 與 `rollPack()`。它不讀 localStorage、不扣幣、不改 collection；宿主傳入候選、權重、保底、既有收藏與 RNG，取回 `{ draw, nextPity }`。

`rollPack()` 會：

1. 依 policy candidates 建立各稀有度 pool。
2. 依 policy 的 `unit` 逐張或逐包處理保底。
3. 產生每張 `{ key, entry, owned, dup, veil? }`，`key` 是 `${draw.id}:${index}`。
4. 將 `visualSeed` 放在 draw，供 runtime 以可重現 RNG 播演出。

遊戲現行是 `GAME_POLICY`，候選為 `CHARACTER_IDS`；權重是程式目前的 `rare: 695 / epic: 250 / legendary: 50 / mythic: 5`。保底是 `draw` 單位，第 30 張起傳說率逐抽增加，第 40 張必得傳說以上，神話沒有獨立保底。這些既有規則不應被精裝池偷偷共用或改寫。

精裝池應是第三套明確命名的 policy／pool 設定，而不是把 `GAME_POLICY` 改成條件分支。若精美版機率與稀有度是兩個維度，抽樣 API 需要能回傳 edition；不能用卡面 CSS 在結果產生後猜測。

### 2.2 演出宿主與 runtime

`src/gacha.js` 是純演示區宿主：模式切換只在尚未抽取時發生；`startDraw()` 先 `rollPack()` 並存 `pending`，再建立 runtime 與模式；收下前結果一直留在 pending。`src/clicker-gacha.js` 是遊戲端宿主：

1. `start(count)` 檢查 boss、pending、餘額與模式 `counts`。
2. `ClickerEconomy.purchaseDraw()` 先結算離線收益，計算費用，呼叫 `rollPack()`，一次寫入扣款、付費／免費抽數、保底和 `pending.draw`。
3. 寫入成功後才建立 `GachaModeRuntime.create(host, draw)`，再呼叫 `window.GachaModes[name].create(run.ctx).open(draw)`。
4. runtime 將 `item.entry` 與 `dup / owned / veil` 傳給 `GachaCard.create()`，處理發牌、翻牌、傳說／神話蓄力、轉彩、揭曉鎖和 summary。
5. `collect()` 以 `draw.id` 防止重複收下，呼叫 `ClickerEconomy.collect()`；成功後才清掉 pending 並播放入隊。

模式契約的實際形狀是：

```js
window.GachaModes.deluxe = {
  label: '裝幀典藏',
  counts: [1, 5, 10], // 這是設計建議，是否開放各張數仍待定案
  create(ctx) {
    return {
      open(draw) { /* Promise：完成到可互動揭曉 */ },
      skip() { /* 清理自己的 DOM／動畫 */ },
      dispose() { /* 可重入、可取消 */ },
    };
  },
};
```

`ctx` 可用的現有能力包括 `root`、`size`、`center`、`cards.create/deal/reveal/showSummary`、`audio`、`fx`、`wait`、`animate`、`signal`、`motion`、`flash`、`shake`、`mythicFlash`、`interact`、`cancel`。新模式只使用這份契約；不在 runtime 裡加精裝分支，不改五種既有模式的事件順序或行為。

### 2.3 需要接線的地方（本輪只記錄，不修改）

實作輪至少要處理：

- `src/gacha-mode-deluxe.js`：新增第六模式，獨立 DOM、CSS 與節拍。
- `src/clicker.html`、`src/gacha.html`：以 classic script 載入新模式；載入順序在 runtime 之後、宿主之前。
- `src/clicker-balance.js`：將模式白名單加入 `deluxe`，不得重排或改動原五種。
- `src/clicker-gacha.js`／`src/gacha.js`：讓選單、入口文案、`counts` 與精裝池選擇能辨識新模式；共用宿主流程仍維持「先落盤、後演出」。
- `src/gacha-pool.js`：加入精裝目錄／policy／edition 回傳，不修改既有 policy 的值與抽法。
- `src/clicker-economy.js`：新增精裝池的抽樣與收下路徑；普通池的 `purchaseDraw()`、`collect()` 不能因精裝而改變語意。
- `src/clicker-save.js`：新增欄位、遷移、pending edition 驗證與壞資料處理。
- 卡冊及夥伴 UI：呈現同角色的普通與精美版本，但不把兩張當成兩位可同時裝備的角色。

## 3. 主要設計問題：普通版與精美版共存

### 3.1 身分模型：角色身分與卡片版本分離

推薦把「角色」和「卡片版本」拆成兩層：

```js
// 角色身分：遊戲玩法的 canonical id
{ id: 'yueyue2', name: '玥玥', rarity: 'rare', kind: 'char' }

// 卡片版本：卡池與外觀的資料驅動差異
{
  cardId: 'yueyue2-deluxe',
  characterId: 'yueyue2',
  edition: 'deluxe',
  art: { src: 'card-yueyue2-deluxe.png', frame: 'deluxe', finish: 'foil-prism' }
}
```

普通版可使用既有 `entry.id` 作為 `cardId` 的相容別名；精美版不可把 `id` 改成另一個角色 id，也不可把普通 entry 物件直接覆寫。draw item 應帶：

```js
{
  key: 'draw-id:0',
  entry: { characterId: 'yueyue2', cardId: 'yueyue2-deluxe', edition: 'deluxe', ... },
  owned: 0,
  dup: false,
  veil: undefined
}
```

`entry` 是抽樣結果的快照；精美版資產、框、箔面與名稱都由它或可驗證的 catalog lookup 決定。不可用「這次從 deluxe pool 抽出來，所以畫面套 deluxe class」作為唯一資料來源，因為 pending、重開、匯入與跳過都需要可還原。

### 3.2 存檔欄位建議

既有 `collection` 保留為角色玩法擁有數，確保五種模式、技能槽、夥伴和舊功能不必理解 edition：

```js
collection: { yueyue2: 3 },          // 角色擁有數，普通或精美都可使角色入隊
cardEditions: {
  'yueyue2:standard': 2,
  'yueyue2:deluxe': 1,
},
pending: { draw: { entries: [/* 含 cardId / characterId / edition */] } }
```

建議以 `cardEditions` 保存展示與重複判定的卡片版本數，以 `characterId` 作為升階／訓練資料的唯一鍵。如此同一角色的兩種外觀可同時收藏，但不會變成兩個角色、兩份技能槽或兩套產能。

若產品希望精美版擁有獨立能力、獨立養成或獨立溢出粉塵，這就不再是單純外觀版本，必須改成獨立 gameplay identity；那是另一個產品決策，不應在實作時暗中混入本設計。

### 3.3 卡冊呈現

推薦「一格角色、一格可切換版本」：

- 卡冊進度以 `characterId` 計算，普通／精美不會把總角色數灌水。
- 該格顯示目前選中的版本，右上角有「普通／精美」切換；未擁有的版本顯示鎖定外框，不顯示未公開圖。
- 若兩個版本都擁有，提供左右切換或 segmented control；切換只改卡片 asset／材質，不改角色的玩法數值。
- 卡冊另提供「版本收藏」統計，讓精美版有成就感，但不把同角色拆成兩個可裝備名額。
- 遊戲中的夥伴圓鈕、技能槽、推薦組合只引用 `characterId`；選中的 `cardId` 只影響展示。

若美術或收藏成就要求「兩格」，可在同一角色群組下做兩個版本子格；不得把它們當成兩個 `B.characters` 身分，也不得讓 `collection` 出現 `yueyue2-deluxe` 這種會讓舊驗證與技能系統誤認的 id。

### 3.4 升階、訓練、重複與入隊

本設計的相容預設是：

- `promotions`、`transcend`、`awakened`、`partnerLevels`、`cooldownUntil`、`effects`、`skillSlots` 全部以 `characterId` 為鍵。
- 普通版與精美版都能使同一角色入隊，但同一張 draw 內仍以 `cardId`／edition 做展示上的 NEW／重複判斷。
- `owned` 與 `dup` 必須在抽樣時就按照產品選定的版本範圍計算，不能在收下時才猜；可能是「同版本才算重複」或「同角色任一版本都算重複」，必須定案。
- 收下時先寫入角色擁有數，再寫入版本擁有數；兩者要在同一個原子提交內完成，不能出現角色已入隊但精美版丟失的中間狀態。

以上是資料相容建議，不是商業規則。精美版重複是否換成粉塵、普通版重複是否能轉為精美版資源，均列於最後的定案清單。

### 3.5 舊存檔遷移

`clicker-save.js` 現有 `fresh()`、`validate()` 及 v1→v2 遷移，並會為新欄位補預設。精裝版上線應升至下一個 save schema 版本，採單向、可重跑的遷移：

1. 讀到舊版時保留原 `collection`、粉塵、升階、訓練、pending 和所有玩法狀態。
2. 新增 `cardEditions`，把每個既有 `collection[id]` 的數量標為 `id:standard`；這只是歷史資料的版本歸類，不創造精美版擁有權。
3. 若舊 `pending` 存在，為每個 entry 補 `characterId = entry.id`、`cardId = entry.id`、`edition = 'standard'`，保留原 `key`、`owned`、`dup`、`veil`、`visualSeed`。
4. 針對新目錄只補空物件／零值，不自動發送精美卡、資源或保底進度。
5. `validate()` 驗證版本欄位、edition 白名單、`cardId` 與 `characterId` 的目錄對應、pending 的 key／張數／版本計數；遇到未知精美版本應保留原檔並進入既有壞檔處理，不靜默當成普通版。
6. 版本遷移成功後才提交；失敗時保留原始存檔，沿用目前的 repair／failed lock 策略。

## 4. 精裝介面視覺設計

卡片既有的景深、箔面、光斑、顆粒、寶石與奢華框應成為材質 token，而不是把完整卡面特效複製到每個 DOM。介面分三層：

| 元件 | 材質層 | 成本控制 |
|---|---|---|
| 背景裝幀室 | 深色紙紋／細顆粒／固定景深漸層 | 一個背景層；不做全螢幕逐粒子動畫 |
| 典藏冊與頁面 | 偽 3D 紙張、內陰影、窄箔邊 | 1 個紙面 + 1 個高光 overlay，避免多重 filter |
| 模式入口 | 寶石色小徽章、金屬描邊、微弱 hover 光 | 每個按鈕最多 2 層 pseudo-element |
| 進度／保底條 | 低對比金屬槽、單條箔線、刻度點 | 只動畫 transform／opacity，不動畫 blur |
| 貨幣／券 | 紙券或金屬印章圖示、短陰影 | 靜態 asset；數字變化只做一次 pulse |
| 封蠟與壓印按鈕 | 立體陰影、局部高光、精美色階邊緣 | 互動時才開啟一層 sheen，不常駐粒子 |
| 卡槽 | 紙張底、細框、序號鉚釘 | 每張槽 1 個背景 + 1 個邊框，最多 10 張 |
| 精美版高潮 | 一次性箔面掃光、寶石光暈、粒子 | 僅在精美版揭曉瞬間啟用，完畢即清理 |
| 結算頁 | 書頁翻開、材質化摘要、版本徽章 | 只保留 summary 的靜態材質，不重播完整高潮 |

普通版與精美版的差異應集中在 `edition` token：精美版使用更深的多層框、獨立箔紋、切面寶石與局部景深；普通版仍使用既有卡材質，不用把整個面板變成閃爍金色。

## 5. 第六種演出：裝幀典藏（`deluxe`）

### 5.1 流程原則

抽樣結果在入口按下時已固定；演出不重新抽卡、不改 pity、不決定精美版。所有「揭曉哪一張」的資訊仍交給共用 runtime 的 `ctx.cards.reveal()`，以保留現有 `veiled`、傳說、神話和跳過語意。

### 5.2 可實作節拍（正常動態）

以下以 960×640 座標、五連為基準；十連使用兩排五槽，單抽只顯示中央主槽。各階段可由 `draw.entries.length` 調整數量，但不改核心順序。

| 時間 | 畫面與操作 | 回饋／資料規則 |
|---:|---|---|
| 0–180 ms | 裝幀室淡入，紙面與桌面景深定位 | 不顯示稀有度與 edition |
| 180–480 ms | 典藏冊展開，頁角、鉚釘與槽位依序落位 | 只建立空槽 DOM |
| 480–760 ms | 逐槽壓入無字卡背；每槽相隔 70 ms | `ctx.cards.deal()` 建立卡片，卡背朝上 |
| 760–1,060 ms | 金屬索帶沿冊脊滑過，固定住所有卡槽 | 低音與紙張摩擦音；不預告稀有度 |
| 1,060–1,420 ms | 中央壓印頭下降，玩家看到「按住／點擊壓印」提示 | 進入 `fanned`；提示只代表可揭曉，不是抽樣操作 |
| 互動後 0–220 ms | 封蠟碎裂、卡背中央露出窄光 | 呼叫 `ctx.cards.reveal(key, { deferSummary: true })`；身份仍由 item 決定 |
| 220–800 ms | 卡片翻面；普通版是乾淨箔線，傳說以上沿用 runtime 蓄力 | 不複製 runtime 的傳說揭曉邏輯 |
| 揭曉點 | 卡面完全可讀 | `onReveal` 寫入 UI 級已揭曉集合；仍未收下 |
| 精美版專屬 0–900 ms | 壓印章變成精美版徽記，箔面從四角向中心收束，寶石光暈短促爆開；卡片像被裝入透明護頁 | 只有 `edition === 'deluxe'` 才觸發；不改 rarity，不改 veil |
| 普通版 0–320 ms | 紙張回彈、細小灰塵落下 | 與精美版有清楚檔次差，但不讓普通版像錯誤結果 |
| 全部揭曉後 180 ms | 冊頁固定，顯示「逐張翻／全部完成」狀態 | 呼叫 `ctx.interact()`，summary 才可收下 |

精美版高潮的重點是「材質被完成」：不是更大的白閃，也不是單純彩虹。精美版在揭曉的同一刻完成壓印、箔面定位、寶石點亮三件事，且只對精美版發生。這使玩家能辨認版本差異，又不會在卡背階段提前泄露抽率。

### 5.3 單抽、五連、十連、跳過

- `counts` 建議為 `[1, 5, 10]`；是否真的開放十連、十連是否沿用現有費用與券規則，待使用者定案。
- 單抽：一冊一槽，壓印與揭曉集中在中央。
- 五連：五槽橫排，依序入冊；玩家可點任一槽揭曉，若選自動則每張間隔 80 ms。
- 十連：兩排五槽；入冊順序仍是 `entries` 順序，揭曉順序可沿用 runtime 的 `all()`，不改 item key。
- 跳過：按下後立即呼叫模式的 `skip()` 清掉裝幀室，再由 runtime `showSummary()` 將所有卡直接翻到真實狀態；不自動收下、不改 pending。
- 模式自己的取消必須可重入，使用 `ctx.signal`、`ctx.cancel()` 和 `dispose()` 清除動畫、audio scope、粒子與 style，避免 visibility change 或關窗後舊時間軸繼續發牌。

### 5.4 reduced-motion

`ctx.motion.reduced` 為 true 時：

- 不使用冊頁翻轉、旋轉壓印頭、粒子、震動、長 blur、全螢幕閃光或持續箔面動畫。
- 0–480 ms 以淡入顯示完成的典藏冊與所有卡背，使用 runtime `deal(... duration: 150)`。
- 直接保留逐張可點揭曉的互動；精美版高潮縮成 150 ms 的靜態邊框／徽記切換與一次 opacity pulse。
- 跳過與重開的結果必須和正常模式相同：所有卡面為真實 rarity／edition，pending 仍存在直到收下。
- CSS `prefers-reduced-motion` 與 runtime 判斷都要涵蓋；WebView2 不支援的效果要有無動畫 fallback，不能把材質 filter 當必要功能。

## 6. 相容性與邊界

### 6.1 稀有度、轉彩與神話

- 轉彩目前是 draw item 的 `veil: 'rare'`，而非改寫 entry；精裝模式照樣先以精良卡背／卡框進入 runtime，揭曉後由既有 `ctx.cards.reveal()` 和 `GachaCard.unveil()` 還原傳說。
- 30% 轉彩機率不由新模式重抽、不由精美版覆蓋，也不因精裝而增加。
- 神話仍是既有 `mythic`，仍維持現行 0.5% 商業／抽樣設定；新模式可給神話額外的裝幀視覺層，但不能改神話保底語意。
- 精美版不是新 rarity。`shownRarity(item)` 仍只負責顯示普通 rarity／veil；edition 是平行欄位。

### 6.2 卡片、縮圖與卡冊

`GachaCard` 目前依 `entry.id` 找 SVG template 或 PNG，並以 `shownRarity` 決定 class；精美版需要讓 asset lookup 支援 `cardId`，但要保留 `characterId` 找 rig 的能力。`art`、`src`、`bleed`、角色動態設定都應資料驅動。

`.mini` 縮圖只取精美版的靜態縮圖／背景 token，不載入完整粒子與 live rig。分享圖、夥伴圓鈕、技能槽若不需要顯示精美版本，使用 character asset；若顯示收藏版本，明確傳入 `cardId`，不能依目前選單全域狀態猜。

### 6.3 手機與 Tauri WebView2

- 960×640 演出座標照現有 clicker overlay 縮放；十連在窄螢幕改為兩排可滾動但不改資料順序。
- 觸控區至少 44×44 CSS px；壓印提示不可只依賴 hover 或拖曳。
- 使用 `transform`、`opacity`、`clip-path` 等已有瀏覽器能力；`backdrop-filter`、mix-blend-mode、filter 只能是增強層。
- 圖片先在既有 card adapter 的 preload 階段解碼；精美資產若未解碼，不得在高潮拍才阻塞主執行緒。
- 不搬入 GPL 或授權不明的字型、材質、音效、圖片；箔紋、紙紋、印章可用原生 CSS 漸層與自製 SVG／PNG。

## 7. 效能預算

以「同一時間的可見材質層數」而不是 DOM 節點總數估算：

| 場景 | 靜態材質層 | 動態材質層 | 備註 |
|---|---:|---:|---|
| 入口 | 4 | 0–1 | 背景、冊頁、入口徽章、按鈕 |
| 五連裝幀 | 4 + 5×2 | 2–4 | 槽位與卡背不各自掛完整箔面 |
| 十連裝幀 | 4 + 10×2 | 3–5 | 兩排卡片；限制同時 active 的 sheen |
| 普通揭曉 | 4 + 1 張卡面 | 3–6 | 只對焦當前卡，其餘降為靜態 |
| 精美高潮 | 4 + 1 張精美卡 | 短暫 8–10 | 900 ms 後移除 particle／glare layer |
| summary | 2 + 卡片靜態層 | 0 | 不保留高潮特效 |

控制算法：背景固定 1、頁面固定 1、全域微粒最多 1、目前焦點卡最多 3 個動態材質層；其他卡只保留 1 個靜態 frame + 1 個 card face。精美版高潮最多再加 4 個短命層（箔掃光、寶石暈、壓印墨、少量粒子），並設定明確生命週期。以 `getAnimations()`、粒子 layer 數與低階裝置手動測試驗證，不以「看起來沒卡」作為效能結論。

## 8. 分輪實作與驗收

### 第 1 輪：資料模型與純邏輯

只做 catalog／edition schema、policy 介面、`cardEditions` 遷移與 validate 設計的測試，不接 UI。驗收：普通舊存檔逐字保留；同角色兩 edition 可同時存在；pending 重開可重建；未知 edition 被拒絕；既有 pool 測試與既有五模式檔案無差異。

### 第 2 輪：卡面與卡冊資料驅動

讓 card adapter 能以 `cardId` 取精美資產，以 `characterId` 取玩法 rig；完成一格可切換的卡冊原型。驗收：普通、精美、veil、mythic、`.mini`、缺圖 fallback 都可顯示，且技能槽／夥伴仍只以角色身分運作。

### 第 3 輪：獨立 `deluxe` 模式骨架

新增 `gacha-mode-deluxe.js` 與必要載入／選單接線，先用普通卡資料跑完整裝幀節拍。驗收：單抽／五連／十連、跳過、重開 pending、關窗、visibility change、reduced-motion、手機觸控均可完成；五種舊模式的檔案與節拍測試不變。

### 第 4 輪：精美版高潮與材質成本

接入精美 edition 的封蠟、箔面、寶石與壓印高潮；完成效能預算與 WebView2 fallback。驗收：普通版與精美版同時抽到時能清楚分辨；精美高潮只在揭曉時出現；skip／summary 不殘留動畫；低階裝置不持續產生粒子。

### 第 5 輪：商業規則接線與回歸

在使用者定案後才接價格、貨幣、抽率、保底、券、重複轉換與限定期。驗收：原五種模式的結果、節拍、旗標、保底、轉彩 30%、神話 0.5% 全部回歸；精裝 pool 的 pending、原子收下、離線結算與存檔修復有測試。

## 9. 待使用者定案的商業問題

以下刻意不填數字、不替使用者決定。沒有答案前，只能完成視覺與資料模型，不能完成正式經濟接線。

1. 精裝池每次單抽、五連、十連各自價格是多少？是否沿用現有 `drawCost()` 的產能換算、折扣地板與免費抽的計算？
2. 精裝池使用哪一種貨幣？是現有 coins、獨立精裝貨幣，還是新的招募券／票券？
3. 現有招募券能否用於精裝池？若可以，單抽／五連／十連的抵扣順序是什麼？若不可以，精裝券如何取得？
4. 精裝池的候選角色是全角色、指定輪替名單，還是全新的角色集合？普通版與精美版是否都在同一角色的候選內？
5. 精美版是獨立於 rarity 的第二次抽樣，還是精裝池每張結果必定為精美版？各 rarity 的精美版機率是否相同？
6. 精裝池是否使用現有稀有度權重 `rare 695 / epic 250 / legendary 50 / mythic 5`？若不同，請給各 rarity 權重；神話是否仍為 0.5%？
7. 精裝池是否沿用第 30 抽起傳說率增加、第 40 抽傳說以上必得的現有保底？若有自己的保底，單位是抽、包、精美版結果，還是雙保底？
8. 精裝池的保底是否與普通招募共用 `pity.sinceLegendary`，或完全獨立保存？切換卡池是否重置、累積或分別顯示？
9. 精美版是否限定期間／輪替？下架後已擁有的版本是否永久保留？未來復刻是否沿用同一 `cardId`？
10. 同一角色的普通版與精美版是否都能重複？重複判定是同一 edition 才算，還是同一 character 任一版本都算？
11. 精美版重複的處理是粉塵、萬用資源、版本碎片、保留張數，還是其他方式？普通版重複能否轉成精美版資源？
12. 精美版是否只改外觀？若有數值、技能、訓練、升階或羈絆差異，請指定哪些資料跟 character 共用、哪些跟 edition 分離。
13. 精美版是否能直接解鎖尚未擁有的角色並加入隊伍？若同角色已有普通版，是否觸發一次性新角色入隊演出？
14. 卡冊進度要採「一個角色一格」還是「普通／精美各一格」？兩種版本是否各有收藏成就或完成獎勵？
15. 精裝模式是否在遊戲與抽卡演示兩處都可選？演示區是否只展示、不使用遊戲貨幣與遊戲精裝存檔？

在上述答案確認前，設計不會自行發明價格、抽率、保底、限定與重複收益，也不會把精美版偷偷塞進現有五種模式或改動它們的行為。
