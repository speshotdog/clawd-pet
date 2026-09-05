# 珍母點點：第七輪實作

基準提交：`6826d064`。先執行 `git log -4`，只修改指定 clicker 原始碼、測試、匯出工具與本報告；`dist-web/` 和測試截圖為要求的產物。未 build、未起 server、未 commit，未修改共用 gacha、CharacterConfig、chipforge 或桌寵檔案。

## 十二技能

以下範例為十二隻各一張、手勁與訓練 Lv.0：`P=125`、`D=7.25`。自身產能 `pᵢ` 與全隊產能均含星級、訓練，排除暫時效果。

| 角色／技能 | 實際效果與範例 | 期限／CD | 400ms 招牌動作／章 |
|---|---|---|---|
| 玥玥／尾巴節拍 | click ×2；每點 14.5 | 10 次、15s／60s | 尾巴掃兩下／×2 |
| 采華／龍尾掃袋 | burst 20pᵢ；立即 +80 | 即時／45s | tail −28°→+28°→歸位／拆！ |
| ㄌㄎ／穩穩站好 | self 額外 2pᵢ；+10/s | 20s／90s | 腿交替 ±10°、scaleY .96／×3 |
| 羊咩／數羊開工 | team 額外 .2P；+25/s | 30s／120s | 舉右手／+20% |
| 熱狗狗狗／聞到零食 | clickAdd 每點 +.5P；單獨使用每點 69.75 | 20 次、20s／90s | 抬右手、前傾 translateX 6px／聞！ |
| 女僕狐狐／收拾桌面 | burst 15P；立即 +1875 | 即時／120s | 右手 −18° 收攏、尾巴輕搖／收！ |
| 膠布／俐落拆封 | click ×4；每點 29 | 5 次、15s／75s | 右臂 +26°，前 20% 快出、後 80% 慢回／×4 |
| 珍珍／綿綿加班 | self 額外 3pᵢ；+30/s | 30s／120s | scale(1.06,.9) 壓扁回彈／×4 |
| 珍母／這個頭我收下了 | passive 複製最高另一夥伴；範例 +20/s | 20s／90s | 觸手張開／發動 |
| 膠布原版／一刀開封 | click ×10；每點 72.5 | 1 次、15s／45s | 刀臂揮下／×10 |
| 玥玥原版／玥來越快 | clickTime ×3；每點 21.75 | 不限次數、12s／90s | 舉拳、尾巴極小擺動（5° × tailScale .2）／×3 |
| 珍珍原版／大團圓 | team 額外 .5P；+62.5/s | 20s／120s | scale(1.08,.92) 下壓回彈／+50% |

所有旋轉以 CharacterConfig 樞紐為準；腿使用 limbScale，手使用 pawScale（缺省回退 limbScale），尾使用 tailScale（缺省回退 limbScale）。空 pawR 的角色均使用指定替代動作。每個 rig 使用原本 180ms 開始、70ms 的眨眼；不更動 `T` 與 `EASE`。珍母右入，其餘左入；精良藍、史詩紫、傳說金沿用原稀有度。技能名六字以上分兩行，副標取 desc 去除「・冷卻」之後的部分，三段技能音沿用。

點擊採 `D × max(mult) + Σ add`，所有次數效果同時扣一格；時間型不扣次數。self、team、passive 保存發動快照，離線依起迄交集積分，保留八小時上限與時間高水位。burst 直接走與 click 共用的 grant／拆包路徑，CD 同筆存檔，重按不重複入帳，也不增加教學點擊數。切入結束在包裝位置呈現一次重擊浮字、小 impact 與 12 片碎紙，不走點擊粒子流程。

## 靜態匯出與網頁模式

執行 `python tools/export-web.py`，目前輸出 **198 檔、22,755,376 bytes（21.70 MiB）**。逐檔名稱與大小見 `tools/test/clicker-artifacts/round7-export.txt`。

匯出清單：clicker*.*、chipforge 模組（不含 worklet）、fonts、gacha audio/fx/card/card.css、runtime 與五種 mode、pool、character-config、角色 PNG（含模板引用）、gacha PNG/JPG、toy PNG、OG 圖。排除 pet.js、menu.*、toy.*、pure.js 及抽卡演示入口。

共用 GachaCard 固定 fetch `index.html` 取角色模板，因此從來源 index.html 只抽出 template，嵌入匯出的遊戲首頁；不執行桌寵頁面的 script。`dist-web/clicker.html` 仍保留來源遊戲頁，`dist-web/index.html` 為同遊戲加模板。所有資源路徑相對，`docs/clicker/shots/v6-scene.png` 複製為 `og.png`；標題、viewport、favicon、OG title/description/image 均已配置。

沒有 `window.__TAURI__` 時隱藏關窗按鈕、取消頂列拖曳，改以 `min(innerWidth/960, innerHeight/640)` 縮放並置中，背景 #C9A46F；不呼叫 fit_window/get_clicker_zoom。beforeunload、pagehide 與 visibilitychange 保存／暫停，音樂維持第一次互動才開始。Tauri 分支保留。網頁使用該網站 origin 的 localStorage 存檔。

部署時將 `dist-web/` 內容放上 GitHub Pages 或其他靜態主機即可；本輪未實際發布遠端網站。

## 驗證

- 所有 `src/clicker*.js`：`node --check` 通過。
- `npm.cmd test`：43/43 通過（PowerShell 禁止 npm.ps1，使用同一 npm 的 .cmd 入口）。九隻新技能各一測，加上倍率／加法混合及 self/team/passive 離線疊加；涵蓋快照、到期、分段積分、防重與存檔驗證。
- Playwright 無 server：HTTP route 直接讀 dist-web。第七輪已通過 12 切入、burst 入帳／双擊防重／命中 12 片碎紙與一個浮字、clickTime 到期、self/team 離線、縮放置中、50 點→技能→招募→收下→重載；pageerror 與缺失素材均為零。
- 第五、六輪瀏覽器回歸通過（音量存檔、AudioParam 淡入淡出、場景、隱藏恢復與減少動態）。
- `python tools/test/clicker-browser.py` 完整套件 exit 0：第七輪、第五／六輪、原第二至四輪皆 PASS，包含五種招募模式、pending 恢復／雙擊、存檔失敗防護與共用卡面 CSS computed-style 等價。
- 截圖：`tools/test/clicker-artifacts/round7-web-*.png`；各角色 400ms 截圖固定 WAAPI 時間，依原時間軸技能名尚未出現，另提供 700ms 文案／章截圖。
- 700ms 視覺檢查發現長副標與章重疊，已將副標限制在章左側（220px、16px），重新驗收通過。

## 未完成

本輪要求的實作與本機驗收均完成。遠端主機發布不在本輪實作範圍，尚未執行。
