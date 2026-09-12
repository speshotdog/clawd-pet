# 5.0 九張精裝卡交付報告

展示採用 **A：同系列一致背景**；七張系列卡的名字與稀有度均為 **提案，待使用者定**。小丑與奧米加的名字、神話稀有度沿用使用者指定。

[開啟 cards-remade](../../_art/holo-test/cards-remade.html) · [開啟 standalone](../../_art/holo-test/cards-remade-standalone.html) · [九張總覽](shots/5.0/all-cards.png)

## 可直接否決的製作決定

- 下午茶：女僕牛連兩側甜點；灰貓連浮帽、領帶與原圖可見尾巴；羊連奶油、角與前方整塊蛋糕。遮住的肢體不補畫。灰貓原圖和蛋糕交疊，尾巴保留可見部分，因此單獨抽出後構圖細長。
- 觀星：羊連手持望遠鏡（未把地面腳架納入）；深藍貓；藍色提籃角色連籃；龍連原圖可見尾端光點，不帶山丘。角色獨立放大置於原影片天空裁切，並非保留四個角色在原場景中的相對位置。
- A 背景：下午茶取上方無角色的粉色菱格牆，排除海報深色裝飾外框；觀星取上方天空，保留流星與雲。B 也只使用原畫的乾淨區塊，但各卡取樣位置不同。未用含其他角色的背景，避免重複角色；這是對「各自背景」的本輪解讀。
- 觀星抽取零起算第 **120 幀 / 2.000 秒**。比較了 0、2、4、6、8、10、12、15、18、21、24、27 秒，選 2 秒的斜流星，四角色未被雲遮。[候選幀](shots/5.0/frame-candidates.jpg) · [採用原尺寸靜幀](shots/5.0/stargaze-frame-120.png)。不是逐幀窮舉評分。
- 小丑採 framed。檔案雖是 RGBA，但實測 615,350 個像素 alpha 全為 255，並非已有透明背景；本輪移除與外邊界連通的白底，保留內部白色服飾、眼睛與毛色。未改來源檔。
- 奧米加採 depth：貓的輪廓可分離；背景另取原圖右側炒飯與紅底，不補出貓下方被遮住的炒飯。保留貓本體比例，構圖是重新配置，不是完整橫幅縮入直卡。具體面積、裁切列於下表與 JSON，可直接改判 flat。
- 主體只用多邊形引導 GrabCut／連通區域修改 alpha，RGB 與原來源逐像素相同；之後按比例 LANCZOS 縮放。無生成、繪製角色、inpaint 或背景補洞。選區多邊形只畫遮罩；比較圖上的文字是說明標籤。
- depth 的主體透明畫布與背景均為 600×840。主體等比縮到 520×530 內，置中、底緣 y=700；背景以中心 cover 裁切成 5:7，沒有拉伸。小丑等比縮到 600×580 內。
- 沿用卡框／字級／Z 與反光工法。新增靜態 alpha 遮罩於 masks-5.0.json，由 cards-remade builder 合併；不改 demo.html，也沒有執行期動畫 mask-image。

## 每張卡

座標皆為原素材像素，格式 `[left, top, right, bottom]`，右／下界不含。subject 是完整去背選區的包圍盒（非背景裁切）；完整選區、輸出縮放與位置見 [preparation.json](shots/5.0/preparation.json)。影片座標使用 1080×1920。

| id | 名稱 | 稀有度／狀態 | 卡型 | subject 包圍盒 | A 背景實際 cover 範圍 | 並排圖 |
|---|---|---|---|---|---|---|
| `tiandianaini` | 甜點愛牛 | 史詩；提案，待使用者定 | depth | [245, 484, 1266, 1377] | [242.86, 130, 507.14, 500] | [本體／卡面](shots/5.0/tiandianaini-body-and-card.png) · [A／B](shots/5.0/tiandianaini-background-options.png) |
| `xiawujiaojiao` | 下午膠膠 | 精良；提案，待使用者定 | depth | [117, 1193, 706, 2376] | [242.86, 130, 507.14, 500] | [本體／卡面](shots/5.0/xiawujiaojiao-body-and-card.png) · [A／B](shots/5.0/xiawujiaojiao-background-options.png) |
| `danngaomie` | 蛋糕分咩一口 | 史詩；提案，待使用者定 | depth | [378, 1468, 1172, 2457] | [242.86, 130, 507.14, 500] | [本體／卡面](shots/5.0/danngaomie-body-and-card.png) · [A／B](shots/5.0/danngaomie-background-options.png) |
| `wangyuanmie` | 咩有看錯星 | 史詩；提案，待使用者定 | depth | [24, 1043, 524, 1369] | [247.14, 0, 832.86, 820] | [本體／卡面](shots/5.0/wangyuanmie-body-and-card.png) · [A／B](shots/5.0/wangyuanmie-background-options.png) |
| `xingyejiao` | 今晚不睡膠 | 精良；提案，待使用者定 | depth | [488, 1109, 737, 1376] | [247.14, 0, 832.86, 820] | [本體／卡面](shots/5.0/xingyejiao-body-and-card.png) · [A／B](shots/5.0/xingyejiao-background-options.png) |
| `tilanxing` | 提籃摘星獸 | 史詩；提案，待使用者定 | depth | [758, 1023, 1039, 1371] | [247.14, 0, 832.86, 820] | [本體／卡面](shots/5.0/tilanxing-body-and-card.png) · [A／B](shots/5.0/tilanxing-background-options.png) |
| `shanqiulong` | 星願龍總欸 | 傳說；提案，待使用者定 | depth | [698, 827, 961, 1018] | [247.14, 0, 832.86, 820] | [本體／卡面](shots/5.0/shanqiulong-body-and-card.png) · [A／B](shots/5.0/shanqiulong-background-options.png) |
| `jiujixiaochouyueyue` | 究極小丑玥玥 | 神話；使用者指定 | framed | [37, 21, 766, 753] | 無 | [本體／卡面](shots/5.0/jiujixiaochouyueyue-body-and-card.png) |
| `aomijiapaoxiaoshou` | 奧米加咆嘯獸 | 神話；使用者指定 | depth | [1100, 353, 2771, 1654] | [2830, 160.0, 3830, 1560.0] | [本體／卡面](shots/5.0/aomijiapaoxiaoshou-body-and-card.png) |

B 背景實際 cover 座標（對應相同素材）：

- `tiandianaini`：[114.64, 135, 375.36, 500]。
- `xiawujiaojiao`：[381.43, 140, 638.57, 500]。
- `danngaomie`：[239.64, 300, 400.36, 525]。
- `wangyuanmie`：[0, 0.0, 580, 812.0]。
- `xingyejiao`：[260, 0.0, 840, 812.0]。
- `tilanxing`：[500, 0.0, 1080, 812.0]。
- `shanqiulong`：[367.86, 100, 882.14, 820]。

奧米加去背後保留 **1,493,646** 原始像素，占整張來源 **20.26%**。其 source-mask 與 source-cutout 均附於 shots/5.0，可檢查耳尖、鬍鬚和炒飯交界。

## 檢查與退出碼

最後一次有效製作／檢查依序如下（從專案根目錄執行，Python 輸出使用 UTF-8）：

| 指令 | 退出碼 | 結果 |
|---|---:|---|
| `python _art/holo-test/prepare_5_0.py` | 0 | 九張卡圖、16 張 depth 圖層、九張靜態遮罩與比較圖 |
| `python -c "import sys; sys.path.insert(0,'_art/holo-test'); from card_assets import build; build()"` | 0 | 既有 lossless WebP 共用權威；編碼前後 RGBA 完全相同 |
| `python _art/holo-test/build_cards_remade.py` | 0 | 72 張，16.15 MiB |
| `python _art/holo-test/build_cards_remade_standalone.py` | 0 | 72 張，17.27 MiB，共用 88 個 layer 引用 |
| `python _art/holo-test/check_5_0.py` | 0 | Playwright Chromium，兩頁均以 file:// 開啟，無 server |

[機器檢查結果](shots/5.0/checks.json)：兩頁各 **9/9 新卡載入**、全池 **72/72**、**Console / pageerror 0**、**失敗請求 0**；新卡共 17 張 img 各有有效 naturalWidth/Height、九張靜態主體反光遮罩，實際文字與 pool_data 一致。四個來源 SHA-256 前後一致；九份全尺寸去背圖 RGB 與各自來源（影片為抽出的靜幀）完全相同。

卡面截圖固定為 600px 寬，CSS 動畫暫停於 currentTime=0，雙 rAF 屏障後截圖；A/B 只替換背景圖片，主體與框相同。已看過最終九張總覽與裁切／背景並排圖。本輪未測 fps、未宣稱動態效能。

工具探查曾遇到 `rg` 未安裝（退出碼 1），改用 PowerShell；不存在的 build_masks.py 探查退出碼 1，已找到 embed_masks.py 並讀取其靜態遮罩做法，未執行會改 demo 的腳本。首輪檢查為 0，但截圖發現部分背景邊色，修正 GrabCut 後重新建置及檢查；沒有放寬檢查條件。

## 範圍與待辦

- 待使用者決定七個名稱／稀有度，以及兩系列 A/B 背景。名稱的唯一可編輯來源是 pool_data.py 的 CARDS_5_0；報告、截圖皆讀取該資料。
- 觀星日後升級動態：依 METHOD §一走 R3 three.js canvas / build_gift_card.py，另做逐幀主體、alpha、反光和效能校準；本輪僅交四张 depth 靜卡。
- 灰貓尾巴原本與蛋糕交疊、觀星腳架未納入、龍未帶山丘、炒飯貓改為獨立擺位，都是可否決的構圖選擇；如要維持完整原場景，需另定裁切，不能補畫遮住部分。
- 沒有修改 src/、card_face.js、demo.html、來源素材；沒有啟動 server、commit、建置其他頁面。只跑 cards-remade → standalone 這一對，沒有跑 deluxe builders。
- 工作途中出現 ceremony.js、deluxe-gacha-b.html／standalone 的外部變動；不是本輪指令產生，未修改或還原。BRIEF-astra-5.0-cards.md 與來源資料夾開工時已是 untracked，予以保留。

## 2026-09-13 夜：使用者退回（字體醜、摳圖爛、人物沒置中）→ 改版

- **字體**：根因是 demo.html 內嵌的字型子集只收了 demo.html 出現過的字，5.0 名字裡 19 個字（甜牛午蛋糕錯晚睡提籃摘願總欸究奧米咆嘯）不在裡面，掉回系統字體。`build_round4_fonts.py` 改成字元集加上 `pool_data.pool()` 所有名字，重建後 766 字，缺字 0。demo.html 只有字型 blob 變了。
- **不摳圖**：八張系列卡改 `flat`（滿版平鋪、`bleed`），`prepare_5_0_flat.py` 以角色本體為中心裁 5:7 視窗（角色約佔卡高六成、中心落在 44% 高度給名字框留位），LANCZOS 縮成 600×840，不改 RGB、不補畫。小丑玥玥維持 framed。
- **觀星系列的限制**：影片裡四隻擠在一起，flat 視窗一定看得到旁邊那隻；龍只有 191px 高，放大到卡面會糊。替代方案：觀星做**一張**群像卡（整幅景）而不是拆四張——待使用者裁。
- 結果：`shots/5.0/all-cards-flat.png`（舊版摳圖版留在 `all-cards.png` 對照）。

## 2026-09-13 夜（二）：使用者第二次指示後的定案

- 裁窗改以**臉**為中心（卡寬 50%、卡高 42%），甜點系列放大、龍總拉近；尾巴／道具裁掉可以。
- 名字與稀有度定案：女僕是**膠布**→「膠你點餐」神話；戴帽灰貓是**玥玥**→「玥下午茶」史詩；「今晚不睡膠」保留、升史詩；咩有看錯星神話；這系列最低史詩、沒有精良。
- 卡名改有階級色：精良藍、史詩紫（`demo.html` 原本 `.r-rare/.r-epic .face-name` 強制白字的規則改掉，全池一致）。
- 總覽：`shots/5.0/all-cards-flat.png`（最右一張是 1.0 的哥不狗，看史詩字色是否一致）。

## 2026-09-13 夜（三）
- 今晚不睡膠＋提籃摘星獸併成一張（兩隻臉的中點置中）、神話；究極小丑玥玥改傳說；臉的中心改到卡高 40%（卡頂到文字框上緣的中點）。八張。
