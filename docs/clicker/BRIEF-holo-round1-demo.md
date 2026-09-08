# 派工簡報：華麗卡牌 第一輪 —— 可操作的展示頁

分支 `holo-cards`。設計依據：[DESIGN-holo-cards.md](DESIGN-holo-cards.md)（你自己上一輪寫的）與
[BRIEF-holo-cards-research.md](BRIEF-holo-cards-research.md)（第八、九、十節是使用者定案）。

## 本輪唯一目標

做出一個**使用者可以自己打開、用滑鼠轉著玩**的展示頁，讓他當場決定要不要把這套接進遊戲。
**這一輪不改遊戲程式**（`src/` 下的既有檔一律不動），只新增展示頁與它自己的資源。

> 使用者原話：「**先展示給我看 我決定**」「**建立 HTML 讓我直接操作玩耍**」
> 品質標準（不打折）：「**跟 poke-holo.simey.me 展示的效果一樣**」。

## 交付物

1. **`_art/holo-test/demo.html`** —— 單一檔案，**用瀏覽器直接開檔（`file://`）就要能跑**。
   ⚠ 因此**不可以用 `fetch()` / XHR / ES module import 載入任何東西**（file:// 會被 CORS 擋死）。
   CSS 與 JS 全部內嵌在同一個 HTML 裡；圖片用相對路徑 `<img>` / `background-image`（這個 file:// 可以）。
   如果某個效果非要 fetch 不可，改成程式即時產生（Canvas → dataURL），不要要求使用者起伺服器。
2. **`_art/holo-test/` 底下自己產的貼圖**（細粒紋、glitter atlas、壓花紋等），
   照設計第 8.1 節：**程式生成，固定 seed，不用生成式 AI、不用第三方貼圖**。
   產生器腳本也放這裡（Python/Pillow 或 Node Canvas 都可），並在 README 記下 seed 與尺寸。
3. **`_art/holo-test/README.md`** —— 怎麼開、每個區塊在看什麼、哪些是還沒做到的。

## 展示頁要有的區塊（使用者要能一眼比較）

| 區塊 | 內容 |
|---|---|
| A. 前後對照 | **同一張卡**，左邊「現在遊戲裡的樣子」、右邊「新版」，並排、同尺寸、同時跟著同一個滑鼠動 |
| B. 新場景卡 | 四張滿版景深卡（素材見下），大張、可拖著轉 |
| C. 五階並排 | common / rare / epic / legendary / mythic 五張放一起，看得出檔次差 |
| D. 舊卡升級 | 既有去背 PNG 卡在新系統下的樣子（設計第 4.1 節：背景從 `.face-art` 搬出來，不用逐卡拆層） |
| E. 控制面板 | 即時滑桿：景深強度、箔面強度、顆粒強度、光斑強度；開關：只看景深／只看箔面／兩個都開；翻面鍵；模擬 reduced-motion |

E 的滑桿是重點——使用者要靠它告訴我們「再兇一點」還是「太over了」。
每個滑桿旁邊顯示目前數值，方便他直接報數字給我們。

## 素材

**新場景卡（已裁好，直接用）** —— `_art/holo-test/`，全部 600×840 RGBA：

| 檔 | 內容 |
|---|---|
| `scene-rocketdog.png` | 火箭狗（白色捲毛狗頭接在火箭上，橘黃尾焰，星空） |
| `scene-astronaut.png` | 太空人狗（穿太空衣戴頭盔，地球上方，粉色行星） |
| `scene-alienkitty.png` | 粉紅外星貓（趴在紫色土星環行星上） |
| `scene-fluffdog.png` | 白色捲毛狗（室內、矮桌、飯碗）——這張是暖色室內，故意跟前三張星空對比 |

來源是使用者給的 `C:\Users\ASUS User VII\Desktop\新卡\3.0\5.png`（一張圖三個角色）與 `2.png`，
Claude 已裁成直式 5:7。**這四張是不透明的滿版場景圖，沒有 alpha 去背**——
要做景深就得離線拆層或用其他手段，這正是本輪要證明可行性的地方。
`_art/holo-test/_contact.png` 是四張的對照縮圖。

**舊卡（去背 PNG）** —— 從 `src/` 挑幾張有代表性的，例如
`card-zhenpete.png`、`card-zhenwang.png`、`card-zhencao.png`、`card-zhenjpg.png`，
以及兩張 `bleed` 的（`滅世珍獸`、`玩物就玩物`，id 你自己去 `gacha-pool.js` 查）。
展示頁用相對路徑 `../../src/card-xxx.png` 引用，不要複製一份。

## 硬限制（沿用設計文件，違反就是白做）

1. 原生 HTML/CSS/JS，無框架、無打包器、無 build step。
2. `file://` 直接開得起來（見交付物第 1 點）。
3. 不搬 `pokemon-cards-css` 的 CSS/JS/貼圖（GPL-3.0），只用自己寫的實作與自己產的貼圖。
   不採用 Galaxy Holo / Vecteezy（授權未確認）。
4. 效能：五階並排那區會同時有五張卡，**同一時間只有一張接收連續輸入**（設計第 9.1 節）。
   游標離開就停 rAF，不要閒置空轉。
5. `prefers-reduced-motion` 要有降級，**降級是減少位移，不是把效果整個關掉**。
6. **不要動 `src/` 下的既有檔案**，也不要動工作區裡其他人未提交的變更
   （目前有另一個專案在同一個工作區改 `src/clicker-*.js`、`clicker.css`、`clicker.html`、
   `tools/test/clicker-round30.py` 等等，那些**完全不要碰**）。

## 驗收

- 你自己要先用瀏覽器實際打開 `demo.html` 操作過（可以用 Playwright 驅動並截圖），
  確認：四個區塊都畫得出來、滑鼠移動時箔面與景深都在動、滑桿即時生效、翻面正常、
  Console 沒有錯誤、游標離開後 rAF 歸零。
- 截圖存 `_art/holo-test/shots/`。
- **不要宣稱「已達到跟展示一樣的品質」**——那是使用者驗收的事。
  在 README 裡誠實列出「這版做到什麼、還差什麼」。

## 已知會踩的坑（本專案歷輪血淚）

- 寫瀏覽器驗證時用 `locator.click()`，**不要用 `evaluate` 裡的 `el.click()`**，
  後者會觸發 `:focus-visible` 驗出假 bug。
- 中文字一律 DOM 文字，不要畫進圖片裡。
- 素材若要程式生成，**存下 seed**，不要每次跑出來都不一樣。
