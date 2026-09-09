# 第二十九輪實作報告

日期：2026-09-09。工作區：`D:/claude/clawd-pet-holo`，分支 `holo-cards`。
已依 brief 必讀順序閱讀文件，再完成畫面流程／刪除、大卡、背景、拆封、五階回饋、介面與驗收。衝突以 **BRIEF 第一節**優先。

交付：[開發版](../../_art/holo-test/deluxe-gacha-b.html)、[可攜單檔](../../_art/holo-test/deluxe-gacha-b-standalone.html)。
**自動化驗收通過；人工成對偏好評估尚未執行。未 commit、未 push。**

## 1. 實作與範圍

| 檔案（程式檔均在 `_art/holo-test/`） | 內容 |
|---|---|
| `build_deluxe_b.py` | 移除展廳模板／拖曳程式，改滿版入口、舞台與結果；保留共用卡面、資料與 RATE；依底材是否存在插入 resolver 設定 |
| `ceremony.css` | 六層背景、印刷按鍵、真卡包、大卡扇形／手機卡帶、剝離封條、五階卡後環／箔片；禁止原生選取 |
| `ceremony.js` | 三畫面生命週期、共用拆封、四段 reveal 鏈、五階時間表、十連換組、分頁／選取、可暫停工作時鐘、WebAudio、A5 清理 |
| `build_deluxe_b_standalone.py` | 只打包使用中的包身／封條／底材；底材缺檔可略過；維持單一 `path()` 與 asset manifest |
| `deluxe-gacha-b.html`、`deluxe-gacha-b-standalone.html` | 已重建 |
| `check_gacha_ceremony_round29.py` | 三畫面、三 viewport、五階時間／實際可見像素、真正 F、下一張不洩漏、280 次跳過、真實閒置／隱藏恢復 |
| `check_gacha_controls_round29.py` | 兩入口各20次按壓回饋中跳過、殘留動畫、手機主卡文字 hit-test |
| `check_gacha_return_round29.py` | 兩入口各20次確實位於神話回槽中的跳過 |
| `check_gacha_luminance_round29.py` | 五階 ×11個攻擊／衰減時點 ×2入口的灰階 P95 |
| `check_gacha_artifacts_round29.py` | 體積、素材內嵌逐 byte 比對、凍結來源與 RATE／src 保護 |
| 第28輪 core／interaction／edges／FX 與 `check_reveal_timing.py` | 保留既有斷言，更新畫面、重設介面、前奏與觸發點；不刪舊測試 |
| `check_gacha_card_regression.py` | 保留原五尺寸，新增380／420；新增 `--flows-only` 方便獨立複驗真實流程 |
| `HANDOFF-holo-cards.md` 第七節、`TODO-next-round.md` | 同步本輪狀態與後續範圍 |

`src/`、`card_face.js`、`pool_data.py` **沒有修改**；RATE 與 HEAD 相同。沒有引用或移植 `src/gacha-mode-*.js`、`gacha-fx.js` 或舊 UI kit；沒有 three.js／WebGL／影片／召喚陣／印章／流星。
凍結檔案與 Git 正規化內容相同；Windows CRLF 與 Git LF 的差別沒有被誤判成來源變更。證據見 [artifact-manifest.json](../../_art/holo-test/verify-round29/artifact-manifest.json)。

入口依 brief 第一節只留卡包、三抽卡鍵、小字券數，音效保留在角落；未把設計中較寬鬆的標題、機率說明或展廳元件搬回來。`.bar/.rail/.body/.chip/.rate/.foot/.orbit/.charge/.core/.starfield/.rays/.idlepack`、正式重設鍵與卡外重複階級標記均不在 DOM。

## 2. 實際時序與畫面

以下為原生 WAAPI 配合 Playwright 虛擬時鐘的量測，不縮短產品時間。P 自素材成功 decode 後起算。

| 拆封動作 | 時間 |
|---|---:|
| 卡包移至中央／轉正 | P+0–240ms |
| 張力、下沉5px、壓縮0.985 | P+240–440ms |
| 上封條剝離／中立撕膜音 | P+440–780ms |
| 卡背抽出 | P+680ms 起 |
| 每張發牌／錯峰 | 480ms／70ms |
| 單／五／十連前奏 | **1160／1440／1790ms** |
| 第1張正面 F | P+1480／1760／2110ms |

`revealOne()` 重入沿用同一 Promise，串接 `beginReveal → commitFaceVisible → runRarityFx → settleReveal`。所有階級共用140ms移入與180ms前半翻面；F 位於單卡+320ms，正面以−89°開始可見。新增像素差測試證明 F 已有正面像素，不只檢查 visibility。

| 階級 | F後開始回槽 | 回槽時間 | F→完成 | 單卡總長 |
|---|---:|---:|---:|---:|
| 普通 | 300ms | 220ms | 520ms | 840ms |
| 精良 | 420ms | 240ms | 660ms | 980ms |
| 史詩 | 640ms | 280ms | 920ms | 1240ms |
| 傳說 | 900ms | 320ms | 1220ms | 1540ms |
| 神話 | 1200ms | 360ms | 1560ms | 1880ms |

共用後半翻面180ms、2%餘勢80ms。各 FX 起迄與表定時間差在34ms以內；虛擬事件表的排程為表定值。普通／精良沒有使用可選的100ms重疊，採前卡完成即啟動下一張；一般槽間空檔0ms。第5→6張是320ms兩段水平交接，期間有換組動作，不是空白等待。

五階分別使用確認環、冰藍環＋4箔片、紫環／斷環＋12光片、金白環／底材波＋24碎光／6餘光、銀白環／光譜主波／逆向第二波＋32箔片。神話第二拍 F+180ms，弱反向卡面餘光 F+480–920ms；兩遍材質光由單一 writer 合成，沒有互搶 `paint()`。每個環／箔片類別均量到卡外非零像素差。

收下220ms縮至0.96、下移20px並淡出，才返回入口；結果始終滿版。十連分兩頁五張；手機主卡在上、鄰卡只露邊，切換使用箭頭／方向鍵，拖曳仍負責旋轉。

## 3. 尺寸、背景與素材

| viewport | 單卡 content width | 五／十連 content width |
|---|---:|---:|
| 1440×900 | 420px | **380px** |
| 1024×640 | 298.656px | **270.219px** |
| 390×844 | 304px | **288px** |

桌面 X／Y／旋角符合設計扇形；尺寸以未變形 content box 量測。47張正式資料 ×7尺寸 ×三頁比較＝329組，幾何／樣式失敗0；新增大尺寸沒有改卡面字級、Z、mask 或 palette。

背景六層為底色、靜態箔底材、偏心幾何、藍灰光暈、方向反光、暗角。循環只動 CSS transform／opacity；揭曉期間壓暗並暫停，隱藏／reduced-motion 時停止。`backgroundScope` 與當抽工作分離；取消只清理當抽與控制項，保留三個背景 CSS 循環。隱藏期間 timer、rAF、WAAPI 與 AudioContext 都暫停，恢復剩餘時間。

Claude 的 `fx/summon-substrate.webp` **已到位並已打包**：1536×1024 RGB，31,942 bytes。未重製或修改該素材；缺檔時同 class 使用 CSS 漸層，builder 不插入圖片請求。既有卡包87,102 bytes、封條31,988 bytes，三者與 standalone 內嵌資料逐 byte 相同。

- standalone：**5,107,403 bytes**，低於6,500,000，餘額1,392,597 bytes。
- `ceremony.js`＋`ceremony.css`：**35,698 bytes**，低於100KB程式預算。
- 新底材31,942 bytes，低於110KB單圖／160KB二進位預算。
- 110張灰階取樣（F+24/60/84/100/120/180/204/240/400/660/850ms），背景／卡面P95最大 **28.6408%**，低於普通場景65%與主波85%門檻。

## 4. 驗收與真實 exit code

| brief 驗收 | 結果／證據 | exit |
|---|---|---:|
| 1 三畫面與刪除 | entry→ceremony→results→entry；禁止DOM不存在 | 0 |
| 2 三尺寸／扇形 | 18組入口×viewport×抽數檢查；尺寸見上表 | 0 |
| 3 不預告 | 13個時點 ×3階 ×2入口＝78張；直到F前1ms，逐像素差0；固定前綴替換下一階也為0 | 0 |
| 4 五階回饋 | F前沒有FX；F真有正面像素；起迄±34ms；每種環／箔片有卡外像素 | 0 |
| 5 連續性／定位 | 普通槽間0ms；換組320ms持續動作；最多一張揭曉；兩次resize後FX中心誤差最大0.955%卡寬 | 0 |
| 6 背景 | dev／portable真實5s、30s rAF=0；隱藏1.2s無事件追加，CSS paused，恢復完成；110張亮度取樣通過 | 0 |
| 7 互動 | hover1.04，字級30.90→30.90px；光位改變、未拖角度0；60px拖曳12°保留；Esc回正；兩入口選取藍像素0、rangeCount=0 | 0 |
| 8 A5 | 原五點200次；更新第28輪七點280次；新七點280次；早期控制項40次；神話實際回槽40次；身份／次序／完成清理通過 | 0 |
| 9 dev／搬走單檔 | 兩入口正常／跳過／互動／FX／A5；真實按鍵12流程；素材完整，無應用錯誤與失敗請求；大小合格 | 0 |
| 10 真實退出碼 | 下表為實際完成的命令；失敗與中止未冒充通過 | 見下表 |

所有下列 Python 腳本位於 `_art/holo-test/`：

| 命令 | 最後 exit |
|---|---:|
| `python build_deluxe_b.py` | 0 |
| `python build_deluxe_b_standalone.py` | 0 |
| `python check_gacha_ceremony_round28.py --core-only` | 0 |
| `python check_gacha_ceremony_round28.py --interaction-only` | 0 |
| `python check_gacha_ceremony_edges_round28.py` | 0 |
| `python check_gacha_fx_round28.py` | 0 |
| `python check_gacha_card_regression.py --cards-only` | 0 |
| `python check_gacha_card_regression.py --race-only` | 0 |
| `python check_gacha_card_regression.py --flows-only` | 0 |
| `python check_gacha_ceremony_round29.py` | 0 |
| `python check_gacha_ceremony_round29.py --visual-only` | 0 |
| `python check_gacha_ceremony_round29.py --live` | 0 |
| `python check_gacha_controls_round29.py` | 0 |
| `python check_gacha_return_round29.py` | 0 |
| `python check_gacha_luminance_round29.py` | 0 |
| `python check_gacha_artifacts_round29.py` | 0 |
| `node --check ceremony.js` | 0 |
| `python -m py_compile`（更新的驗收腳本） | 0 |
| `git diff --check` | 0 |
| git commit／push | 未執行 |

卡面回歸按 cards／race／flows 分支執行；**沒有把未執行的無參數完整命令寫成通過**。最後的按鍵清理、手機前景與觸控修正另做針對性重驗；第28輪神話回槽觸發校正為3400ms，另外40次測試先確認當下 phase 真是 return。

主要證據：
[命令退出碼](../../_art/holo-test/verify-round29/command-exits.json)、
[78幀／正常時間軸／第28輪A5](../../_art/holo-test/verify-round29/ceremony-results-core.json)、
[五階／尺寸／真正F](../../_art/holo-test/verify-round29/round29-visual.json)、
[新A5](../../_art/holo-test/verify-round29/round29-skip.json)、
[原A5](../../_art/holo-test/verify-round29/regression/timing-after.json)、
[互動與音效](../../_art/holo-test/verify-round29/ceremony-results-interaction.json)、
[真實隱藏／閒置](../../_art/holo-test/verify-round29/round29-live.json)、
[灰階110幀](../../_art/holo-test/verify-round29/luminance.json)、
[卡面329組](../../_art/holo-test/verify-round29/regression/measure-gacha-after.json)、
[真實12流程](../../_art/holo-test/verify-round29/regression/flows-final.json)。

目視檢查：[入口](../../_art/holo-test/verify-round29/dev-entry29.png)、[神話](../../_art/holo-test/verify-round29/dev-mythic-peak29.png)、[最終手機主卡](../../_art/holo-test/verify-round29/dev-mobile-final.png)。

## 5. 中途失敗與修正

- 初次 builder 引號語法失敗，exit1；修正後重建兩份產物，不把當時成功打包的舊HTML當新交付。
- 初次78幀測試 exit1：CSS背景loop的起始相位未同步。只在測試中固定背景取樣時間，產品循環保留；重新比較像素歸零。
- FX定位首次 exit1：fan的全局perspective令−200px卡後層偏心；移除多餘的容器透視，未碰卡內Z；重验最大0.955%。
- 拖曳選取藍色為0，但舊touch斷言預設「之前一定沒選取」；新增桌面選取後不成立。改驗相對toggle，並使觸控保持單張前景；最终interaction exit0。
- 初次live rAF計數包裝、原A5 reset測試hook各exit1，修正測試函式包裝／作用域後通過。
- 真實flow首次exit1：舊測試hover卡片左上20px，在扇形裡該點被鄰卡遮擋；改hover可見卡的中心，未使用force繞過hit-test；12流程通過。
- 手機目視發現鄰卡遮住主卡右側文字，將當前卡置於鄰卡前，補上實際文字位置的elementFromPoint斷言；最終截圖已更新。
- 按壓中跳過必須清掉已結束但fill仍在的按鈕動畫；取消範圍已補齊。背景撞擊完成也取消WAAPI，避免留下結束物件；40次早跳過與殘留檢查通過。
- 兩次工作中測試被中止重跑，不列通過。所有早期失敗退出碼另記在command-exits JSON。

## 6. 尚未執行／限制

1. **設計的12組人工成對偏好評估尚未執行**：沒有12組使用者選擇、等響度盲評、閱讀錯誤或辨識時間資料；不能宣稱「至少8組偏好新版」。本輪只完成可重現的自動化與目視檢查。
2. 手機為390×844 Chromium viewport／觸控驗證，沒有實體手機GPU量測；不宣稱第30輪的實機frame-time目標已通過。
3. Git提交未完成，原因見下節；沒有push。
4. 自動核准審查拒絕刪除兩個中止測試留下的資料夾，理由僅為 **“blocked by policy”**。`verify-round29/portable29-fl9qv5ef` 與 `portable29-zbmf99aj` 仍保留；没有改用其他刪除方式繞過限制。這兩份是測試副本，不是正式交付入口。

## 7. 預定 commit 邊界（不是已存在的 commits）

`.git` 指向 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，在本輪唯一可寫worktree之外。依使用者授權與既有index.lock拒絕記錄，**略過commit，不要求提權、不修改外部metadata**；本輪未重新嘗試git add／commit，因此不捏造它們的exit code。

以下共用檔案需按hunk切分；生成HTML隨各邊界重建：

1. **畫面流程與刪除**：builder模板、三screen生命週期、展廳DOM／視窗拖曳刪除。
2. **大卡排版**：layout／position、380／420尺寸、扇形、十連換頁、手機主卡、選取／鍵盤操作。
3. **背景**：六層CSS、底材resolver／manifest、backgroundScope與隱藏暫停。
4. **拆包時間軸**：包身連續移動、張力、撕封、480／70ms發牌、中立撕膜音。
5. **五階回饋**：四段reveal鏈、表定環／箔片／材質掃光／音效、單writer與A5清理。
6. **去AI感與控制項**：奶油色厚印刷鍵、80／160ms按壓掃光、精簡文案、移除重複階級資訊、220ms收下。
7. **驗收與交付**：新／更新測試、證據、兩份HTML、HANDOFF第七節、TODO與本報告。

最初已存在且未追蹤的 `BRIEF-holo-round29.md`／`DESIGN-holo-round29.md` 未被修改，也未被擅自提交。
