# 第三十三輪報告：召喚介面、四層特效與開封互動

本輪 A–J 均有實作與驗證，但**整份驗收尚未全綠**：I 的 1024px 留白條件互相衝突，且後段淡出環仍有界外擴散；round32 的六項既有素材失敗也依卡面凍結要求保留。沒有降低這些門檻，也沒有把未回覆的版面取捨視為已批准。

在 `D:\claude\clawd-pet-holo`、分支 `holo-cards`、起始 HEAD `c93903093f9a2d50b35e1e8ef245c03b6d2b9125` 上工作。先讀完 brief 第 0 節要求的 LESSONS、REPORT31、HANDOFF 六之四／六之五、背景研究及 REPORT32；D 動工前已開啟參考圖。Round32 已落地，未另建卡池或重做卡面。

最終完整 round30、round31 均 exit **0**；卡面完整回歸連續三次 **0、0、0**。新 round33 checker 為 **68 項、64 通過、4 失敗，exit 1**，四項都是 dev／搬移 standalone 的 1024px 五／十連留白。新卡 round32 checker 為 **1533 項、6 失敗，exit 1**，失敗身份與上輪相同。

## 交付入口

| 產物 | bytes | 用途 |
|---|---:|---|
| [正式 dev](../../_art/holo-test/deluxe-gacha-b.html) | 1,288,370 | 正式機率、初始 30 券 |
| [正式 standalone](../../_art/holo-test/deluxe-gacha-b-standalone.html) | 5,966,447 | 可搬移單檔，低於 6,000,000 bytes |
| [測試 dev](../../_art/holo-test/deluxe-gacha-b-test.html) | 1,288,402 | 高機率、無限抽 |
| [測試 standalone](../../_art/holo-test/deluxe-gacha-b-test-standalone.html) | 5,966,479 | 使用者手感測試入口 |

四份的 SHA-256 與 382 個凍結檔案核對結果在 [final-artifacts.json](shots/round33/final-artifacts.json)。凍結檔案變更數 **0**，包含 `src/`、`card_face.js`、`pool_data.py`。開工時已存在的使用者 BRIEF 修改保留，沒有代改。

建置依賴順序如下；既有兩支 builder 加 `--test`，沒有複製第二套 builder。各次建置的真實退出碼皆為 0。

```powershell
python _art/holo-test/build_deluxe_b.py
python _art/holo-test/build_deluxe_b_standalone.py
python _art/holo-test/build_deluxe_b.py --test
python _art/holo-test/build_deluxe_b_standalone.py --test
```

## A. 衝擊波與背光的四層分工

先用保存的改前 HTML 做十連中間高階卡 fixture，拆開 CSS 環與 canvas 來源。不能只看 z-index 推測：舊 canvas 除了位於鄰卡下方，還把**所有卡面 rect** 都挖掉；只升層仍不會讓環出現在鄰卡上。

在已完成的鄰卡內，舊 canvas 特效開／關的 RGB 差為 0；分離的 CSS 環則已有正向亮度。升層並移除舊的全卡排除後，canvas 在同一鄰卡出現明確像素差。CSS 在 +100ms、canvas 在 +300ms 量，因兩來源抵達鄰卡的時間不同，不能拿尚未相交的幀當遮擋證據。

| 隔離量測 | legendary，鄰卡平均 RGB 增量 | mythic，鄰卡平均 RGB 增量 |
|---|---|---|
| 改前 canvas，+300ms | 0／0／0 | 0／0／0 |
| 改前 CSS 環，+100ms | 4.089／4.163／4.363 | 2.614／2.868／3.550 |
| canvas 升層且取消全卡排除，+300ms | 20.978／19.048／14.153 | 18.847／19.421／19.172 |

重現腳本為 `probe_round33_before.py`、`probe_occlusion_round33.py`；數據見 [A-isolated-diagnosis.json](shots/round33/A-isolated-diagnosis.json)。初次隔離 probe 選到環尚未抵達的時間而 exit 1，調整取樣位置後 exit 0，失敗保留。

最終是 brief A 的**四層**，不是交付清單誤寫的三層：

| 由下至上 | 實作 | 規則 |
|---|---|---|
| 其他卡 | slot 2；mobile-current 6；selected 7 | 接受背光與環覆蓋 |
| 背光 | upper／under canvas 與 flash，z 8 | 射線、底光、flash；排除演出卡面 rect |
| 演出卡 | light-owner 9；is-revealing 10 | 壓過鄰卡與背光；特效尾韻仍保留 owner |
| 衝擊波 | 新增 over canvas、舞台上的 CSS shockwave，z 20 | 跨越所有卡；不套卡面排除 |

CSS 環移出 slot 的 anchor，交由既有 FX painter 追蹤位置；新增第三張 canvas 共用既有引擎，不新增常駐 rAF。背光排除區只包含該效果的演出 owner 與當前 performer，並向外取整保護分數像素邊緣。尾韻結束／取消才移除 owner，避免 `is-revealing` 移除後退回鄰卡下方。沒有改卡面幾何或新增超過 42px 的 translateZ。

**這是依使用者裁決放寬 round31 的契約**：射線應穿過鄰卡，但一次也不能污染演出卡面。不是恢復「整張 canvas 放在全部卡前」。

| 指定量測幀（1440×900 單抽） | 改前外徑／線寬 | 最終外徑／線寬 |
|---|---|---|
| legendary，F+100ms | 474／12px | **474／26px** |
| mythic，F+120ms | 516／12px | **516／24px** |

加粗後先降低 over canvas 亮度；後來補量**已翻開鄰卡**，抓到 1024px mythic +450ms 文字對比僅 59.8%。固定 seed 0 重現：關掉 canvas 環仍 59.9%，CSS 環減半則 73.7%，證明主要來自 CSS 環。最終 CSS 環以 `filter:opacity(.4)` 收光，保留動畫透明度、幾何與時序；over canvas 的高階透明度為 .25。沒有不透明白棒或銘牌遮罩。

最終 120 個取樣（兩階 × 三尺寸 × 兩入口 × 10 幀）全部：演出卡 RGB max difference **0**、角度取樣缺口 **0**、演出卡層序高於所有鄰卡。desktop 鄰卡背光增量為正。主角及已揭曉鄰卡的卡名／稀有度對比最低 **73.708%**；另以 20 個固定種子在問題幀量實際產物，最低 **78.823%**，exit 0。對比使用同幀關閉「環」的對照，背光另以獨立開關驗證；不把背光造成的鄰卡變亮混算成環的效果。

最終 round30／31 都量到 legendary 峰值 **231、持續 2200ms**；mythic **255、3350ms**，既有峰值與尾韻門檻保留。環的 474／516px 是指定幀的尺寸，後段擴散限制見 I。

證據：[最終逐項數據](shots/round33/acceptance-round33.json)、[20 種子對比](shots/round33/A-label-seeds-final.json)、[神話十連 +450ms](shots/round33/portable-A-1024-mythic-450.png)。完整逐幀為 `dev-A-*`／`portable-A-*`，+50 至 +500ms，每 50ms 一張。

## B. 整片卡背蓄力

在 `.veilback` 內加入同尺寸、同圓角的 `charge-surface`，以 screen 混色；legendary 暖金，mythic 冷白。沒有 blur 或卡背 mask，既有外圈光暈與震動保留。光層在最後 120／160ms 急收，翻面或取消時移除。

量測同一張卡背矩形，僅在成對光度測試中凍結位移震動，避免取到不同印刷像素；產品震動不變。「峰值」取急收前，即蓄力 +780／+1140ms，不冒充急收完已熄光的瞬間。

| 灰階量測 | 起始 | legendary 峰值 | mythic 峰值 |
|---|---:|---:|---:|
| 平均亮度 | 111.855916 | 164.214220（**+46.81%**） | 189.595568（**+69.50%**） |
| 標準差 | 95.556474 | 60.932608（保留 **63.77%**） | 46.084579（保留 **48.23%**） |

兩入口皆達 +45%／+60% 與圖案標準差 ≥40%。common／rare／epic 仍保留 13 個 pre-F 時點逐像素零差；高階預告與 common 有差異。skip／Esc 的 180ms 清理由本輪與保留的原生蓄力測試驗證，anims／timers／rafs／voices 為 0、rarity-fx／發光層清空。

證據：[傳說開始](shots/round33/dev-B-legendary-start.png)、[傳說峰值](shots/round33/dev-B-legendary-peak.png)、[神話峰值](shots/round33/dev-B-mythic-peak.png)。

## C. 背景線條循環

沿用原創 SVG，讓各元素由 CSS 獨立驅動：

| 元素 | 循環 |
|---|---|
| 整體呼吸 | 28s |
| 外環 | 24s 自轉 |
| 內環 | 18s 反向自轉 |
| 點列／虛線 | 6s，dashoffset 一次移動 9 單位 |
| 破環弧線 | 12s 往返擺動 |
| 菱形刻度 | 32s 自轉 |
| 中央四芒星 | 4s 明滅／縮放 |
| 垂直光軸 | 5s 光點流動 |
| 三道地面橢圓 | 各 6s，delay 0／−2／−4s，向外擴散淡出 |
| 兩道細波線 | 8s／10s |

13 個動畫逐一在相距一個完整週期的兩幀比對，兩入口差異 bbox 全為 None。負 delay 的漣漪使用進入穩態循環後的等相位端點。中心星被入口卡包遮住，測它時單獨隱藏卡包，避免拿「被遮住所以零差」當證明；隔離後 13 個皆有中間幀像素變化，未隔離的入口也有 12 個可見變化，超過六元素門檻。

另有三尺寸各 0／2／4／6／8／10 秒的 18 張等間隔截圖，見 [C-equal-interval-samples.json](shots/round33/C-equal-interval-samples.json)。待機 3 秒 rAF 呼叫數 0；reduced-motion 背景動畫數 0；background-paused 生效，focus-held 保留降階／暫停。手機 SVG 調整為 740px，修正旋轉弧線原先超出可視範圍的問題。

CSS 足以表達全部動作，**不需要 Remotion**；未引影片、第三方素材、字型、npm 或 three.js。

## D. 參考圖與按鈕

已觀看 [summon-ui-reference.png](ref/summon-ui-reference.png)，選「**環＋水面漣漪地板**」：它與既有召喚陣銜接自然，能保留卡包焦點，也能把極細波線做成真正循環。

三顆實際抽卡按鈕保留「單抽／五連／十連」，全部改成黑底、細白框、左右切角六邊形、無圓角，名稱與「◇ 數量」分兩行。保留 hover／按下回饋、focus-visible 與 disabled；沒有加入 SHOP／RECORD 等假功能。

除了 clip-path／截圖檢查，也用沒有 testing hook 的正式頁面實際 Tab 聚焦、Enter 開封、連續三次十連：兩入口最後券數 0、三顆按鈕 disabled、透明度 .4、無 console error。

證據：[按鈕改前](shots/round33/D-before-buttons-detail.png)、[新版入口](shots/round33/dev-D-entry.png)、[鍵盤焦點](shots/round33/dev-D-keyboard-focus.png)、[停用狀態](shots/round33/dev-D-disabled.png)。D 改前圖使用保存的舊 HTML／CSS 配合目前素材，僅用於隔離比較按鈕樣式，不冒充整頁素材的歷史快照。

## E. 獨立測試產物

正式与測試 HTML 的 dev／standalone 逐行 diff 都**恰好兩行不同**，其餘行相同：

| 正式版 RATE（保持原文） | 測試版 RATE |
|---|---|
| `const RATE=[['mythic',.005],['legendary',.04],['epic',.15],['rare',.40],['common',.405]];` | `const RATE=[['mythic',.25],['legendary',.35],['epic',.25],['rare',.10],['common',.05]];` |

第二行是統一的券數／標記政策：

```js
// 正式
const ticketPolicy={unlimited:false,label:''};
// 測試
const ticketPolicy={unlimited:true,label:'測試版 · 高機率 · 無限抽'};
```

正式的 `let busy=false,slots=[],pending=0,tickets=30,cascading=false,skipped=false,generation=0;` 保持原文。共用邏輯依政策決定扣券、按鈕 disabled、∞ 與標記；沒有改正式機率或初始券數。builder 對替換 hook 數量加斷言，避免靜默替錯。

測試 standalone 搬到其他資料夾後完成 **200 次十連／2000 張**，五階皆出現、无 console error、券數仍 ∞。額外驗過測試 dev／搬移單檔的 reset 仍顯示 ∞。測試版沒有拿來當正式像素／時序基準。

證據：[測試版畫面](shots/round33/E-test-entry.png)、[版本差異與抽取紀錄](shots/round33/acceptance-round33.json)。

## F. 卡背滿版

從保存的原始 `deluxe-back.webp` 純裁切 `(35,43,465,645)`，得到 430×602（精確 5:7），再縮放回 500×700，輸出 PNG／WebP。原稿下方留白較厚，因此不能用對稱中心裁切。沒有重畫、補圖或卡背 CSS mask。

最終奶油色印刷線到四邊的距離（左／右／上／下）是 **5／5／8／10px**，均 ≤500px 卡寬的 2%。已檢視圓角與翻牌畫面，B 的光層沿相同 veilback 邊界覆蓋；裁切後重新跑 B 的兩入口亮度／標準差驗收。

重現：`python _art/holo-test/prepare_round33_assets.py --back`。來源留存在 [before-deluxe-back.webp](shots/round33/before-deluxe-back.webp)，產物為 `cardback/deluxe-back.png`／`.webp`。

## G. 四拍進場與新等待節點

`entryPhase` 明確區分 controls／push／waiting／opening／idle。按下抽卡先讓控制列與券數淡出 **220ms**，卡包推近置中 **380ms**，背景收束、入口文案退場；然後**無限等待玩家點擊**。等待期間 busy 保持 true，卡包有「點擊開封」提示、pointer 游標及鍵盤 Enter／Space 操作。

點卡包只開封一次，開封 Promise 被取走後再點不會新增 generation 或卡片。空白處沿用「跳過」，因而卡包 click 明確 stopPropagation，避免同一個點擊同時開封又跳過。Esc／跳過按鈕在等待時仍有效。cancelWork 解決等待 Promise 並清理狀態；沒有自動逾時。

只有 `?ceremony-test` 模式公開 `window.__ceremony.openPack()`；正式頁沒有該物件。reduced-motion 瞬間完成視覺過場，**仍等待點擊確認**，點擊後走既有 reduced 結果流程。等待推進 5 秒後狀態不變、timer／rAF／voice 不增加；連點五下只有一筆 pack-open、仍只有十張卡。等待中 Esc／skip 後 180ms 資源全空且可收下。

### 固定時點的新起點

設按下抽卡為 P=0，素材就緒且兩段過場結束後等待 W，玩家開封為 O。素材已就緒時 **O=P+600ms+W**；素材解碼更慢時等待入口會受 ready 一起約束。O 之後沿用拆封／deal 節奏，不能把 W 換成固定 timeout。

| round30 取樣名稱 | 時點 | fixture／涵義 |
|---|---:|---|
| controls | P+100ms | 220ms 控制列淡出中 |
| tension | O+300ms | tension 自 O+240ms 開始 |
| tear | O+550ms | tear 自 O+440ms 開始 |
| deal | O+900ms | deal 自 O+680ms 開始 |
| pre-face | O+3369ms | 首張 mythic，F 前 1ms |
| post-face | O+3371ms | 首張 mythic，F 後 1ms |
| return | O+5350ms | 首張 mythic 於 O+5270ms 開始回位 |
| last-before | O+12349ms | 首張 mythic＋九張 common；末張 charge 前 1ms |
| last-after | O+12351ms | 同 fixture；末張 charge 後 1ms |

單／五／十連 prelude 完成為 O+1300／1680／1750ms。上述十連首張 mythic F=3370、complete=5630；末張 common charge=12350、F=12670、return=12970、complete=13190（皆相對 O）。round30 全部九組時點各重複 20 次，兩入口最終全過。

`check_reveal_timing.py` 的另一組「九張 common＋末張 mythic」保持既有 O 後時序：末張 charge=9310、F=10930、return=12830；取樣仍為 deal 完成 O+1750 再加 `7559／7561／9181／11170ms`。共用 helper 先推進 600ms，再明確 openPack，沒有刪掉斷言。此 helper 由完整 card regression 匯入，各組重複 20 次。

## H. 程式產生卡包的壓光

修改 `fx/build_foil_pack.py` 的 Blender compositor 高光曲線與 DARKEN cap，再重新渲染 **foil-pack.png／foil-tear.png**，由 `prepare_round33_assets.py` 轉 WebP。沒有在 UI 疊黑紗。使用現有 portable Blender 執行檔，輸出全部寫入本 worktree。

| 全圖灰階量測 | 改前 | 最終 | 比例 |
|---|---:|---:|---:|
| 最亮 5% 平均亮度 | 255.000000 | 196.633382 | **77.111%**（目標 70–80%） |
| RMS 對比（灰階標準差） | 82.726910 | 74.658864 | **90.247%**（下降 9.753%） |

入口 entry-pack 與開封 summon-pack 共用同一張更新素材，兩處都已檢視；圖案、卡包標題仍清楚。最終 WebP：pack 70,570 bytes、tear 53,956 bytes；兩者一起重建到四份 HTML。前兩次探索渲染未達光度目標，但產生器本身 exit 0；不能把數值不合格誤記成產生器程序失敗。最終光度 checker 通過。

## I. 縮卡留白與未完成限制

桌面單抽改為 375×unit，並加 190px 下限；五連最大 208px、十連最大 198px。字級仍由既有 290px 比例 refit；未改卡面字級基準／下限。focusWidth、FX 定位、flakes、拖曳與文字溢出均隨既有共用尺寸重新驗證。

兩入口結果一致，以下是實際 rect，不是僅列 CSS 目標：

| 視口 | 抽數 | 卡寬 px | 左／右留白 px | 上／下留白 px | 結果 |
|---|---:|---:|---|---|---|
| 1440×900 | 1 | 375 | 532.5／532.5 | 163.5／211.5 | 通過 |
| 1440×900 | 5 | 208 | 141.76／141.76 | 280.406／328.406 | 通過 |
| 1440×900 | 10 | 198 | 169.56／169.56 | 154.986／154.986 | 通過 |
| 1024×640 | 1 | 266.656 | 378.672／378.672 | 109.344／157.344 | 通過 |
| 1024×640 | 5 | 191.438 | **17.402／17.402** | 162／210 | 左右留白失敗 |
| 1024×640 | 10 | 190 | **20／20** | 50／50 | 左右留白失敗 |
| 390×844 | 1 | 304 | 43／43 | 185.203／233.203 | 手機單卡通過 |
| 390×844 | 5 | 288 | 當前卡 51／51 | 196.406／244.406 | 保留單卡瀏覽 |
| 390×844 | 10 | 288 | 當前卡 51／51 | 196.406／244.406 | 保留單卡瀏覽 |

桌面任兩張 rect 交集為 0；同排間隙最少 8px（1024 五連約 8.002、十連 8.5px）。手機其他卡在視口外排隊是既有單卡瀏覽，不能把整條卡帶的負右邊距誤判為當前卡溢出。601／700px 的額外單抽檢查也確認不低於 190px。

**1024 的條件無法同時成立**：五張最低 190px＋四個最低 8px 間隙已需 982px，只剩左右各 21px；等比 140px 留白卻要求各約 99.56px，總需求至少 1181.11px。已詢問取捨但未收到答覆，目前採保留五欄與可讀性，並保留四項失敗，沒有暗降驗收值。

**I-3 也不能宣稱全段通過**：474／516px 是 A 指定幀的外徑，單卡 375px 時比例 1.264／1.376，十連 198px 時為 2.394／2.606。為保留 A 的直徑／節奏，本輪未重新縮放環；後段淡出環、尤其小桌面靠邊的卡，仍會擴散至視口外。環沒有成為不透明整排遮板，文字對比已量測，但「整段環都不出畫面」仍未完成，須和小桌面版面取捨一起處理。

## J. Hover 回歸的實際成因與三次完整重跑

改前量到 complete=1、rafs=1：滑鼠移動前光位 156°，移動後仍 156°，300ms 後被回正 writer 改成 120°。因此實際存在**回正覆寫新輸入**，不是未 complete；沒有改產品的 complete guard。

pointerenter／pointermove 現在立即停止回正，保留當下角度，由該次輸入接管光位。另發現測試原本 `first.hover()` 預設正好置中，中心光位本來就是中性 120°，不能用它斷言一定變化。回歸測試改用 70% 寬、40% 高的非中性位置，仍等完整 finish；沒有放寬時序斷言。

原生輸入驗證：回正中 raf 1 → 移動後 0，光位 **152.228571°** 在 300ms 後保持相同；中心仍正確為 120°。暫停背景後，前後像素差 bbox **(529,158,913,695)** 落在卡片上，並非只讀 CSS 變數。見 [改前狀態](shots/round33/before-J.json)、[改後像素與輸入證據](shots/round33/J-hover-evidence.json)。

三次完整執行由 `repeat_regression_round33.py` 依序啟動，沒有用 flows-only 代替，wrapper 真實 exit 0：

| 次數 | 真實 exit | 秒數 | 完整 log |
|---|---:|---:|---|
| 1 | **0** | 1237.67 | [run 1](shots/round33/1788955169311183600-python.log) |
| 2 | **0** | 1199.38 | [run 2](shots/round33/1788956407089071700-python.log) |
| 3 | **0** | 1406.39 | [run 3](shots/round33/1788957606640539800-python.log) |

每次皆 441 組配對、pairFailures=0、structureFailures=0、nameFitFailures=0、12 個流程，以及兩入口五組固定時點各 20 次。J 的輸入修正於三次前完成並保持不變；後續 CSS 環收光另以最終完整 round30／31／33 驗證。摘要：[three-consecutive-regressions.json](shots/round33/three-consecutive-regressions.json)。

## 完整驗收表

編號沿用 brief（原文沒有 #11），不把子項或失敗省略。

| # | 題 | 最終狀態與證據 |
|---|---|---|
| 1 | A 跨鄰卡環 | 通過；120 幀、角度缺口 0，1440／1024 與手機分開判定 |
| 2a | A 演出卡不可受背光覆蓋 | 通過；max RGB difference=0，保留 round31 尾韻、hover／selected 取樣 |
| 2b | A 鄰卡受背光、主角在最上 | 通過；desktop 鄰卡增量為正、逐 slot 層序檢查全過 |
| 3 | A 外徑、線寬、文字對比 | 通過；474／26、516／24px；120 幀最低 73.708%，另 20 種子問題幀最低 78.823% |
| 4 | B 亮度及圖案 | 通過；+46.81%／+69.50%，標準差保留 63.77%／48.23% |
| 5 | B 不預告 | 通過；低三階 13 個 pre-F 幀零差，高階與 common 有差 |
| 6 | B 取消清理 | 通過；skip／Esc 180ms 後四類資源為 0，發光元素清空 |
| 7 | C 無縫、閒置及減少動態 | 通過；13 動畫端點零差，idle rAF=0，reduced 背景動畫=0，paused 生效 |
| 8 | C 至少六元素移動 | 通過；入口可見 12，隔離中央星後 13；另有三尺寸等間隔截圖 |
| 9 | D 按鈕及鍵盤 | 通過；三顆六邊形、兩行、Tab／Enter、disabled 原生操作兩入口驗證 |
| 10 | E 測試版本 | 通過；恰好兩行差異，200 次十連五階齊全、無 console error；正式 RATE／30 券不變 |
| 12 | F 卡背邊界及翻牌 | 通過；四邊 5／5／8／10px、5:7、無卡背 mask，裁切後 B 重驗 |
| 13a | G 四拍／無限等待 | 通過；220＋380ms，推進 5 秒仍等待、資源不增，點擊才開封 |
| 13b | G 防重複／取消 | 通過；五次點擊只一筆開封，十張卡；Esc／skip 清理並可收下 |
| 13c | G 更新固定時點／reduced | 通過；最終完整 round30 exit 0；reduced 仍保留確認 |
| 14 | H 高光／對比 | 通過；最亮 5% 為 77.111%，RMS 保留 90.247% |
| 15 | I 三抽數×三尺寸 | **未通過**；1024 五／十連兩入口共四項留白失敗。rect 不重疊、間隙與字體檢查通過；I-3 全段界內亦未完成 |
| 17 | J 三次完整回歸 | **通過：0、0、0** |
| 16 | 全部保留腳本全綠 | **未通過**；round32 六項既有素材失敗仍 exit 1，其餘指定保留腳本通過 |

## 每支檢查的真實退出碼

每次命令的完整參數、程序退出碼、秒數與 log 連結都在 [check-exits.md](shots/round33/check-exits.md) 及 [command-exits.json](shots/round33/command-exits.json)。以下依執行順序列出各指令的退出碼序列；後一次通過不覆蓋前一次失敗。

| 指令（省略 `python _art/holo-test/`） | 真實 exit 序列 |
|---|---|
| `check_gacha_ceremony_round30.py` | **1、1、0、0**；最終 [log](shots/round33/1788957999385216500-python.log)，1212.17s |
| `check_gacha_layers_round31.py` | **1、0、0**；最終 [log](shots/round33/1788957936632524100-python.log)，919.75s |
| `check_new_cards_round32.py` | **1**；[log](shots/round33/1788955076468255400-python.log)，1533 項／6 失敗 |
| `check_gacha_card_regression.py` | **0、0、0**，完整三次見 J |
| `check_demo_round8.py` | **0、0** |
| `check_demo_round9.py` | **0、0**，文字溢出斷言保留 |
| `check_gacha_layers_round33.py` | **1、1**；最終 [log](shots/round33/1788957947422208500-python.log)，782.09s，僅四項 I 失敗 |
| `check_gacha_layers_round31.py --b --c --de` | **1、1** |
| `check_gacha_layers_round31.py --a` | **0** |
| `check_gacha_card_regression.py --flows-only` | **1、0**，不計入 J 的三次 |
| `check_gacha_ceremony_round30.py --core --preview-only` | **0**，不取代完整全測 |
| `check_gacha_layers_round33.py --self-test` | **0**，像素同一性／不相交校準 |
| `check_gacha_layers_round33.py --assets --charge --transition --layout --endurance` | **1** |
| `check_gacha_layers_round33.py --background --layers` | **1** |
| `check_gacha_layers_round33.py --assets --charge --background` | **0** |
| `check_gacha_layers_round33.py --layers` | **1、1**；第二次新增鄰卡文字檢查抓到 59.8%，修正後由完整全測驗證 |
| `check_gacha_layers_round33.py --assets --layout --endurance` | **1**，四項 I 失敗 |
| `check_gacha_layers_round33.py --background` | **0**，含中央星隔離驗證 |
| `check_hover_round33.py` | **0、0** |
| `check_ui_round33.py` | **0、0、0** |
| `check_background_samples_round33.py` | **0** |
| `probe_round33_before.py` | **0** |
| `probe_occlusion_round33.py` | **1、0** |
| `probe_preface_round33.py` | **0** |
| `probe_label_contrast_round33.py` | **0、0**，來源隔離診斷，不把诊斷的低值算成通過驗收 |
| `probe_label_contrast_round33.py --final` | **0**，20 個種子的實際產物對比斷言 |

`check_gacha_ceremony_round28.py` 的共用 start helper、`check_reveal_timing.py` 的完整時序函式由上述腳本匯入執行，未另外宣稱獨立程序 exit。Python 語法檢查、兩支 JS 的 `node --check`、Git `diff --check` 已實際 exit 0，詳見命令表。

### 保留的失敗歷史

- 初次 round30 已通過各場景／像素，最後因舊的 6,169,249-byte 單檔超過 6 MB 而 exit 1。壓縮素材後保留原大小斷言，最終為 5,966,447 bytes。
- 另一次 round30 在 rare +200ms 出現卡包區域不一致。12 組 probe 的時間／矩陣／像素都相同，未確證瞬態成因；加入樣式讀取及 20ms 呈現等待，並斷言虛擬時鐘沒前進。沒有刪除 pre-F 像素斷言；之後兩次完整全測 exit 0。
- 早期 round31 分組失敗為 portal 在隱藏 shell 時讀到零 rect，以及手機旋轉背景越界；已修正。一次完整失敗是傳說峰值 218 低於 223，調整背光 flash 後最終 231，門檻沒改。
- 早期 round33 抓到不對稱卡背邊距、負 delay 循環端點、分數像素邊緣與文字對比。分別修正後重跑；新增鄰卡對比抓到的 CSS 環問題與固定種子證據見 A。
- Round32 的六項失敗：`miepuxiong` 亮邊比例 **10.92972%** 超過 1%；`shabaolingzhu`、`liulangyueshou`、`zhenqiqiu`、`zhenjunyue`、`zhenzhen` 為上輪保留的透明留邊稿，不符合 crop-only。沒有為本輪全綠而侵蝕／改畫角色、改卡池或放寬門檻。

## 檔案與提交邊界

所有程式、素材及證據修改均在本 worktree。沒有修改 `src/`、`card_face.js`、`pool_data.py`，沒有引入依賴，沒有 push。

Git 實際 metadata 為 `D:/claude/clawd-pet/.git/worktrees/clawd-pet-holo`，位於可寫 worktree 外；本次權限不允許寫入，依指示**跳過 commit／index 寫入**，沒有要求繞過 sandbox。一次唯讀程序盤點命令也受環境拒絕（exit 1），未繞過限制。沒有把這些環境邊界誤稱為程式驗收失敗。

待有適當權限時可按下列邊界提交；不可收進使用者原有的 BRIEF 修改：

| 邊界 | 檔案／用途 |
|---|---|
| A／B 特效 | `ceremony-fx.js`、`ceremony.js`／`.css` 的背光、環、卡背發光 |
| G／J 生命週期與輸入 | `ceremony.js` 的四拍等待、取消、pointer 接手 |
| C／D／I 介面與排版 | `ceremony-background.svg`、`ceremony.css`、`ceremony-layout.js` |
| E 建置與交付 | 既有兩支 builder、正式／測試各 dev／standalone 四份 HTML |
| F／H 素材 | `prepare_round33_assets.py`、`fx/build_foil_pack.py`、卡背 PNG／WebP、pack／tear PNG／WebP |
| 驗證與文件 | 更新的保留 checker、新 checker／probe／runner、`shots/round33/`、本報告、TODO、LESSONS |

已刪除本輪一次性編輯 helper 與可重建的 Blender scene／backup；保留要求的 PNG／WebP。Chromium 對根目錄 debug.log 的追加已完整存到 [chromium-debug.log](shots/round33/chromium-debug.log)，確認為追加後恢復原檔，避免混入無關變更。

證據皆位於 [shots/round33](shots/round33/)：A 逐幀、B 開始／峰值、C 等間隔及每動畫首尾、D 改前／改後／鍵盤／disabled、E 測試版畫面，以及原生 hover、全部 logs／exit sidecars。standalone 以複製到別的子資料夾後的 file:// 入口實測，並非僅在原位置打開。

已更新 [TODO-next-round.md](TODO-next-round.md) 與 [LESSONS-2026-09-09.md](LESSONS-2026-09-09.md)。剩餘事項為 I 的版面／界外擴散取捨，以及 round32 六項素材條件；不宣稱它們已解決。驗證範圍是本機 Chromium 三種視口與原生鍵鼠／音效流程，未把它當成真實手機或人類美感偏好已驗收。
