# 第二十四輪派工簡報（Astra）

## 不要動的旗標（先讀這段）

- `WISH_TELEGRAPH=false`（維持關閉）
- 切入的 `T` / `EASE` 常數（`clicker-cutin.js`）
- 「點面板外空白關最上層面板」
- 卡冊左右書頁翻頁與角落箭頭鍵
- 轉彩機率 30%
- `B.MARK_MUL_COEF = .5`（第二十三輪剛定案的開根號倍率，不要碰）
- `bossDamage` 的 `share` 值（mieshi .22、yuefeimo .08）——使用者還在收實玩回饋

## 只准改這幾個檔

```
src/gacha-pool.js
src/clicker-balance.js
src/clicker-extras.js
tools/test/clicker-round12.test.js
tools/test/clicker-round15.test.js
tools/test/clicker-round16.test.js
tools/test/clicker-round17.test.js
tools/test/clicker-round22.test.js
tools/test/gacha-pool.test.js
tools/test/clicker-browser.py
```

**素材已經切好了，不要動 `src/card-*.png`，也不要跑 `_art/cardcut.py`。**

---

## 任務一：五張新卡進遊戲

第二十三輪只收了桌面「新卡\2.0」先到的 8 張，剩這 5 張要補完。
`src/card-<id>.png` 五個檔已經切好放進 repo（高 580、已去背、目視確認過沒挖到白／黑部件）。

### 1a. `src/gacha-pool.js` 的 `CATALOG`

接在 `salamander`（現在的最後一張 char）後面加五行，格式照既有那幾行：

```js
    { id: 'shiyi', name: '十一', rarity: 'legendary', kind: 'char', src: 'card-shiyi.png' },
    { id: 'shiwang', name: '失望卡哇', rarity: 'rare', kind: 'char', src: 'card-shiwang.png' },
    { id: 'seal', name: '快樂海豹', rarity: 'rare', kind: 'char', src: 'card-seal.png' },
    { id: 'chaichai', name: '柴柴', rarity: 'rare', kind: 'char', src: 'card-chaichai.png' },
    { id: 'jiaolan', name: '膠頭爛額', rarity: 'rare', kind: 'char', src: 'card-jiaolan.png' },
```

（稀有度照原始檔名：`十一 傳說` / 其餘四張 `精良`。`toy` / `emoji` 那幾行仍然排在最後，不要插到它們後面。）

### 1b. `src/clicker-balance.js` 的技能

在第二十三輪那個 `Object.assign(characters, {...})` **後面另開一塊**，
上面加一行註解「第二十四輪五張新卡（桌面「新卡\2.0」補完，稀有度照檔名）」，內容照抄：

```js
    shiwang: { base: 5, skill: '垂頭喪企', kind: 'burst', factor: 22, basis: 'individual', cd: 48 },
    seal: { base: 5, skill: '快樂拍拍', kind: 'clickAdd', ratio: .42, charges: 18, duration: 20, cd: 95 },
    chaichai: { base: 4, skill: '柴柴打滾', kind: 'self', multiplier: 4.8, duration: 20, cd: 105 },
    jiaolan: { base: 5, skill: '爛額狂點', kind: 'clickTime', multiplier: 2.8, duration: 12, cd: 82, trait: { clickMul: 1.15 } },
    shiyi: { base: 19, skill: '十一連發', kind: 'click', multiplier: 4.5, charges: 11, duration: 15, cd: 85 },
```

設計意圖（**數值是使用者這邊定的，不要自己調**，只要照抄）：

- `jiaolan` 是檔名註記「點擊流相關」那張。做法比照 `jiaotou`（膠頭燃額）的
  `clickTime` + `trait.clickMul`，但它是精良不是傳說，所以 `clickMul` 只給 1.15
  （`clicker-economy.js:115` 那條 trait 是**跨技能槽連乘**的，1.5 那級是傳說才配）。
  這是第一張帶 `trait` 的精良卡——`clicker-album.js:110` 的「特質」列會自動吃到，不用改它。
- `seal` 是第一張精良的 `clickAdd`（既有四張 dog/yangpu/zhenpete/foxmoney 全是史詩起跳），
  所以 ratio 壓到 .42、charges 18，比史詩那批弱一階。
- `shiyi` 的 11 發是呼應名字。`click` 類目前是 jiaobu 10×1、jinggou 8×3、zhenbush 9×3，
  4.5×11 每秒攤提略高於 zhenbush，這是傳說該有的位置。

### 1c. 測試裡的三個數字

角色數 46 → **51**（三處）、`CATALOG` 51 → **56**（一處）、char PNG 34 → **39**（一處）：

| 檔案 | 行 | 改法 |
|---|---|---|
| `tools/test/clicker-round15.test.js` | 10 | `CHARACTER_IDS.length` 與 `Object.keys(B.characters).length` 都 46 → 51，行尾註解補「、第二十四輪 +5」 |
| `tools/test/clicker-round15.test.js` | 12 | `png.length` 34 → 39 |
| `tools/test/clicker-round16.test.js` | 62 | 46 → 51 |
| `tools/test/clicker-round17.test.js` | 29 | 46 → 51 |
| `tools/test/clicker-round22.test.js` | 24 | 46 → 51 |
| `tools/test/gacha-pool.test.js` | 10 | `CATALOG.length` 51 → 56 |

同一個檔頂多改這幾個數字，**其他斷言一律不要動**。

### 1d. `tools/test/clicker-round22.test.js` 的新卡清單

檔案第 12 行現在是：

```js
const NEW_IDS_23 = ['foxfriend','wanwu','lkreal','qipupu','foxmoney','gebuyang','zhenwang','salamander'];
```

下面加一行：

```js
const NEW_IDS_24 = ['shiyi','shiwang','seal','chaichai','jiaolan'];
```

並把第 15 行的迴圈改成 `for (const id of [...NEW_IDS, ...NEW_IDS_23, ...NEW_IDS_24])`
（那個迴圈本來就會驗：卡在池裡、`kind === 'char'`、`src/` 底下 PNG 真的存在、有技能、`base > 0`）。

再**在同一個檔案末尾**加一個新的 test，把這輪的設計意圖釘住（不要只跑臨時腳本、要留在測試檔裡）：

```js
test('round24: 五張新卡的稀有度、精良 trait 與 11 發', () => {
  assert.deepEqual(NEW_IDS_24.map(id => Pool.byId[id].rarity),
    ['legendary','rare','rare','rare','rare']);
  // jiaolan 是第一張帶 trait 的精良卡，倍率要明顯低於傳說的 jiaotou（trait 是跨槽連乘的）
  assert.ok(B.characters.jiaolan.trait.clickMul < B.characters.jiaotou.trait.clickMul);
  assert.equal(B.characters.shiyi.charges, 11);
  // seal 是第一張精良 clickAdd，要比史詩那批弱
  assert.ok(B.characters.seal.ratio < Math.min(...['dog','yangpu','zhenpete','foxmoney'].map(id => B.characters[id].ratio)));
});
```

---

## 任務二：`boss-city` 徽章（第七站打贏沒有徽章可拿）

`src/clicker-extras.js:55`：

```js
const bossScenes = ['backyard', 'kitchen', 'market', 'factory', 'nightmarket', 'fridge'];
```

尾巴加 `'city'`。**只改這一個陣列**，下面 `BADGES` 裡那條 `bossScenes.map(...)` 會自動長出
`boss-city`（名字 `滅世珍獸・滅世都市`、label `王7`、`test: s => s.bossWins.includes('city')`），
`Scenes.city.name` 與 `Scenes.city.boss.name` 都已經存在，不用另外寫。

徽章總數會從 17 變 **18**，兩處要跟著改：

- `tools/test/clicker-round12.test.js:67` — `assert.equal(X.BADGES.length, 17)` → 18
- `tools/test/clicker-browser.py:793` — 同一行有兩個數字，只改 `.badge-cell` 那個 `count()==17` → 18；
  **`.badge-cell.earned` 的 `count()==1` 不要動**（那是「只賺到 pack10 這一張」的斷言）。

底圖仍走 `badgeNode()` 的合成 fallback（17 張無字底圖是另一件待辦，這輪不做）。

---

## 跑完要做的驗證（照順序，缺一不可）

1. `grep -rn "??" src/gacha-pool.js src/clicker-balance.js src/clicker-extras.js` — 找亂碼，要是空的
2. `npm test` — 應該從 158 例變成 **159 例**（多了 round24 那條），且 0 fail
3. `PYTHONIOENCODING=utf-8 python tools/test/clicker-round22.py` — 全綠
4. `PYTHONIOENCODING=utf-8 python tools/test/clicker-round21.py` — 全綠
5. `python tools/test/clicker-browser.py` — 全綠（徽章牆那條會走到改成 18 的斷言）

回報時請列：改了哪幾個檔各幾行、上面五步各自的實際輸出尾巴、有沒有任何一步是紅的。
**不要順手改沒有列在「只准改這幾個檔」裡的東西**，也不要重切素材。
