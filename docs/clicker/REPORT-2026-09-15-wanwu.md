# 玩物就玩物 改版（2026-09-15）

作者給了 PSD 拆分（`玩物就玩物.psd`：1000×1500 透明底，三個像素圖層「手／羊／愛心」），
使用者要一張更好的卡：**flat → depth**，並接進遊戲。

## 定案（使用者逐項拍）

- 卡型 depth：手＝背景層、羊＝主體層、**愛心＝第三層疊在最上面微晃**、**羊本體有呼吸感**。
- 背景 **B 暖色底**（PSD 沒有背景，depth 的背景層必須不透明；A 深色底被否決）。
- 放大到**羊不會被裁切的程度**：視窗＝羊＋愛心包圍盒寬 + 兩側各 24px；臉中心釘卡高 40.2%（實測 0.4016）。
  來源視窗 (203,244)-(744,1001)；羊腳底落在卡高 84.8%，壓過文字框上緣（depth 允許）。手被裁是預期的。
- 不摳圖、RGB 不改、不補畫（圖層本來就是分開的）。

## 工法：特效層不動凍結檔

`card_face.js` 只認 subject／background，所以加了一份共用的 **`card_fx.js`＋`card-fx.css`**：
建卡入口在 `HoloCardFace.create()` 之後呼叫 `HoloCardFx.apply(card, data, resolve)`，
資料來自 `pool_data.OVERRIDES['wanwumythic'].fx = {hearts:'layer-wanwumythic-hearts.png', breathe:true}`。

- 愛心：`.fx-hearts` 疊在 `.art-media` 最上面（跟主體同一個 Z、一起吃視差），
  `translate ±1.2%/±0.6%` + `rotate ±1.6°`，3.6s ease-in-out alternate。
- 呼吸：主體圖**與 `.subject-mask`** 套同一組 `scale(1,1)→scale(1.008,1.018)`，原點 50% 85%，2.8s alternate
  （遮罩不跟著動箔光會錯位）。
- 純 transform（合成執行緒）；`prefers-reduced-motion` 一併停。

接了 fx 的入口：`build_cards_remade.py`、`build_deluxe_b.py`（→ v3 的 ceremony）、`team20.js`（map20）、
v3 `src/clicker-holo.js`（主頁卡冊／編隊／戰鬥）、v3 `src/clicker.html` 多載 `apoc/card-fx.js`。
`card_assets.keys()` 把 fx.hearts 一起納入編碼權威；v3 `build_holo.py` 改用同一份 `keys()`、
並合併 `masks-5.0.json`（之前只讀 demo.html 的 mask-data）。

## 產出

- 素材：`_art/holo-test/layer-wanwumythic-{subject,background,hearts}.png`（600×840）；
  製作腳本 `prepare_wanwu.py`（讀桌面 PSD，可用 `WANWU_PSD` 指定路徑），中間產物在 `shots/wanwu/`。
- 純卡片單檔：`_art/holo-test/wanwu-card.html`；對照頁 `shots/wanwu/preview.html`（`build_wanwu_preview.py`）。
- 全池：cards-remade（71 張）／standalone、deluxe-gacha-b／standalone、map20 重建。
- 遊戲（balance-v3）：`tools/apoc/build_holo.py`、`build_ceremony.py`、`export-web.py` 重跑；
  實測 `clicker.html` 的 `ClickerHolo.face()` 與 `apoc/ceremony.html` 抽到翻面：kind depth、愛心層 600×840、
  愛心／呼吸／遮罩各 1 個 running 動畫、console/pageerror/requestfailed 0。
  `npm test` 223 pass；`clicker-v3-apoc.py`／`-apoc-play.py`／`-black-corner.py`／`-team.py` 全 ALL OK。

## 沒做／已知

- `check_card_identity.py` 在 HEAD 就紅（它讀的 `deluxe-gacha-b-test.html`／`map20.html` 沒有 5.0 卡）；
  `build_deluxe_b.py --test` 的 RATE 斷言字串也早就跟第 71 行對不上。都不是這輪造成，沒動。
- 1.0 的 `src/card-wanwumythic.png` 與 `gacha-pool.js` 的 `bleed:true` 沒改（舊卡不升級，卡型在 `pool_data.OVERRIDES` 覆寫）。
- 沒有 commit、沒有併 main／push／部署。

## 2026-09-16 補：重做在正確基底上

第一次接進遊戲是用這台落後 58 個 commit 的 balance-v3（`7e2c423`）做的，還 `wrangler deploy` 蓋掉了線上較新的版本
（使用者已回滾）。重做時 v3 已對齊 `origin/balance-v3 = 7977a9d`，改動只有：

- `src/clicker-holo.js` `face()` 加一行 `HoloCardFx.apply`、`src/clicker.html` 多載 `apoc/card-fx.js`
- `tools/apoc/build_holo.py`：用 `card_assets.keys()`、**只合併 `masks-5.0.json` 裡 `layer-*` 的遮罩**（不動小丑）、複製 `card_fx.js`、pool 帶 `fx`、css 接 `card-fx.css`
- `tools/apoc/build_ceremony.py` 的 script 標籤；**`src/apoc/ceremony.html` 是手改兩行**（這台的 ceremony.js 沒有上游的快轉功能，重建會倒退）
- `src/apoc/art-thumb/layer-wanwumythic-*.webp` 三張 200px 縮圖（夥伴列小卡用；小卡不跑動畫，`card-fx.css` 末段）
- `src/apoc/fonts/` **沒動**（build_holo 會蓋掉 `build_fonts.py` 的產出，跑完要 `git restore src/apoc/fonts`）
- v3 直接改在 pool.js 的兩個名字（珍的一口、究極小丑薯條）寫回 `pool_data.OVERRIDES`，重跑 build_holo 不再倒退；跑完要 `node tools/apoc/assign_skill_roles.cjs` 補 role
- 結構化 diff：pool.js 只有 wanwumythic 一筆不同、holo.css 只有尾端 append；npm test 277 pass；apoc／apoc-play／team／drag ALL OK；
  teamui 在乾淨 HEAD 一樣紅（`#t20-picker-confirm` disabled），不是這輪的。
