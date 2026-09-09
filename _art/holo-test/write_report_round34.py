"""Render the round 34 report from saved measurements and process exit sidecars."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/round34'
def read(name):return json.loads((OUT/(name+'.json')).read_text(encoding='utf-8'))
def link(name):return f'[JSON](shots/round34/{name}.json)'
before=read('before');after=read('after');portable=read('after-portable')
checks=read('acceptance-round34');a=checks[0]['data'];iso=read('background-isolated')
lines=['# 第三十四輪報告：召喚陣光暈、比例留白、史詩揭曉光效','',
'A 的像素門檻、B 的三個指定尺寸與 1440 不變、C 的五階光效均通過；**A 的 20ms 幀時間門檻未達**。完整 retained round30／31、card regression、demo、followup、亮邊與目前 UI 檢查通過。Round32 缺原圖、Round33 舊 frozen manifest 與一次無 reference bins 的取樣仍失敗，以下保留原碼與診斷。','',
'起點 `cb2323f`，分支 `holo-cards`。已依 section 0 先讀指定文件；修改僅在本 worktree，沒有 commit／push。`src/`、`card_face.js`、卡池與角色圖未改；既有亮邊判準修正及 `build_card_scenes.py` 的 main guard 保留。',
'', '## A. 線條光暈：兩條路先量，選共享路徑的双描邊','',
'先在未修改的正式頁注入兩種候選，固定 seed=300、1440×900、同一背景動畫相位。filter 為兩個 drop-shadow；第二條路將每個幾何定義移入 SVG defs，兩個 use 共用同一個 d／圓／橢圓，動畫與 opacity 仍由同一父群組控制。沒有複製整份 SVG，也沒有新增動畫或常駐 rAF。',
'', '| 初測（Chromium 149／SwiftShader） | rAF p95 ms | 最大間隔 ms | >20ms 幀／總幀 |', '|---|---:|---:|---:|']
software=[('改前',before['timing'])]+[(k,v['timing']) for k,v in read('glow-candidates').items()]
for name in ['final-timing','final-portable-timing']:
 if (OUT/(name+'.json')).exists():software.append((name,read(name)['timing']))
for name,row in software:
 lines.append(f"| {name} | {row['p95']:.3f} | {row['max']:.3f} | {row['over20']} / {row['frames']} |")
lines += ['', '兩條初測都未達 20ms，依簡報退回做法 2。雙描邊的全畫面增亮較少、無濾鏡，保留細線與外溢。初版 halo opacity=.65 的整張畫面增亮雖只有 2.07%，另把前景完全移除後，背景平均亮度卻增加 **17.303%**，超過 15%。因此收至 **.50**，不是放寬門檻。初次失敗保留在 '+link('glow-refinement')+'。',
'', '| 最終像素條件 | 改前 | 改後 | 比例／門檻 |', '|---|---:|---:|---|',
f"| 完整畫面平均灰階 | {a['meanBefore']:.6f} | {a['meanAfter']:.6f} | {a['meanRatio']:.6f} ≤ 1.15 |",
f"| 隔離整個背景平均灰階 | {iso['rows'][0]['mean']:.6f} | {iso['rows'][1]['mean']:.6f} | {iso['ratio']:.6f} ≤ 1.15 |",
f"| 改前幾何遮罩中的線條平均灰階 | {a['lineBefore']:.6f} | {a['lineAfter']:.6f} | {a['lineRatio']:.6f} ≥ 1.40 |",
f"| 水平連續亮線寬 px | {a['widthBefore']:.3f} | {a['widthAfter']:.3f} | {a['widthRatio']:.3f} ≥ 1.5 |",
f"| 揭曉卡 rect 灰階標準差 | {a['cardStdBefore']:.6f} | {a['cardStdAfter']:.6f} | {a['cardStdRatio']:.6f} ≥ .98 |",
f"| focus-held 全畫面平均灰階 | {a['heldBefore']:.6f} | {a['heldAfter']:.6f} | {a['heldRatio']:.6f} ≤ 1.05 |",
'| reduced-motion 背景動畫 | 0（原有契約） | 0（實測） | 沒有新增動畫 |',
'', '線條遮罩是改前畫面減去同幀隱藏幾何層的畫面，共 23,505 像素；線寬取原 SVG 上方垂直軸 y=80..159 的水平截面，以底色+10 為門檻。卡 rect 比較使用完整内接像素；測 A 時固定使用改前的 FX 程式，隔離 C 的光效調整。focus-held 隱藏 halo，原細線與四層演出關係保留。dev／搬移 standalone 的逐項結果見 '+link('acceptance-round34')+'。',
'', '截圖：[改前](shots/round34/before-idle.png)、[最終](shots/round34/after-A-idle.png)、[隔離背景](shots/round34/after-background-isolated.png)、[搬移單檔](shots/round34/final-portable-A-idle.png)。',
'', '### 原生 Chrome／GPU 的另外一組量測','']
for file,title in [('gpu-timing-under-load','其他驗收進行時的探索結果'),('gpu-timing','目前保存的原生 Chrome 結果')]:
 if (OUT/(file+'.json')).exists():
  data=read(file);lines += [title+'：`'+data['environment']['renderer']+'`，Chrome '+data['environment']['version']+'。', '', '| 情境 | p95 ms | 最大 ms | >20ms 幀／總幀 |', '|---|---:|---:|---:|']
  for name,row in data['results'].items():lines.append(f"| {name} | {row['p95']:.3f} | {row['max']:.3f} | {row['over20']} / {row['frames']} |")
  lines += ['',link(file)+'。暖機與否記在各筆 `warmup`；每組使用相同 fixture、同一種子，完整十連從開封到可收下。軟體渲染和原生 Chrome 的數字分開，不跨瀏覽器比較增幅。','']
lines += ['## B. 留白、完整座標與 1440 相同證據','',
'桌面橫向使用 88% 視窗寬，預留四個至少 8px 的間隙。≤1024 且 >600 的桌面五／十連卡寬下限 170；其餘仍 190。小桌面高度預算另預留上下 70px 和至少 8px 的排距。手機分支與 1440 的計算結果不變。',
'', '| 入口 | 視口 | 抽數 | layout cw / rect 寬 | 同排 gap | 左／右／上／下留白 px |', '|---|---|---:|---:|---:|---|']
layout_sources=[('dev',after['layout']),('搬移單檔',read('final-portable-A')['layout'])]
for label,records in layout_sources:
 for row in records:
  w,h=row['viewport'];r=row['rects'][0];m=row['margins']
  if w<=600:m=[r['x'],w-r['x']-r['w'],r['y'],h-r['y']-r['h']]
  lines.append(f"| {label} | {w}×{h} | {row['n']} | {row['table'][0]['cw']:.6f} / {r['w']:.6f} | {row['gap']:.6f} | "+' / '.join(f'{v:.6f}' for v in m)+' |')
lines += ['', '手機留白列的是當前卡；其他卡在畫面外排隊是原有單卡瀏覽，完整條帶的負右邊距保存在 JSON。所有指定桌面 rect 交集為 0；同排 gap ≥8px；1024 十連上下 ≥70px。',
'', '1440 的五連／十連，`table` 的 cw、x、y、rz、page，以及每張實際 rect、gap、四邊留白和 refit 字級資料，都與改前字典逐項完全相同（非容差比較）。證據：'+link('before')+'、'+link('after')+'、'+link('final-portable-A')+'、'+link('acceptance-round34')+'。',
'', '### 每張卡的實際 x / y / width / height（px）','', '| 入口 | 視口 | 抽數 | 卡索引 | x | y | width | height |', '|---|---|---:|---:|---:|---:|---:|---:|']
for label,records in layout_sources:
 for row in records:
  for i,r in enumerate(row['rects']):lines.append(f"| {label} | {row['viewport'][0]}×{row['viewport'][1]} | {row['n']} | {i} | {r['x']:.6f} | {r['y']:.6f} | {r['w']:.6f} | {r['h']:.6f} |")
lines += ['', '### 指定尺寸以外仍有規則衝突','',
'若 6% 留白要適用於每一個連續桌面寬度，五欄的最小需求為 `(5×卡寬下限+4×8)/.88`。170px 卡需視窗寬至少 **1002.273px**；190px 卡需至少 **1115.909px**。因此 **601～1002px** 與 **1025～1115px** 仍無法同時滿足所有規則。這是幾何可行性，不冒充額外瀏覽器尺寸已驗收；未暗改卡寬下限、手機斷點或五欄結構。',
'', '原第三十三輪提到的後段大環界外擴散仍保留，沒有藉由縮環改動既定高階外徑或層序；不能宣稱整段環的幾何都在視窗內。指定三尺寸的層序、文字對比、refit、FX 與拖曳驗收結果見退出碼及對應 JSON。',
'', '## C. 史詩較暗的成因與修正','',
'控制實驗只把 epic flash 的色彩 `225,185,255` 換成中性 `255,238,208`，強度 .25、半徑 620、時長 .7 秒、粒子、Z 與時序完全不改：峰值 **42 → 49**，超過底色+40 的時間 **0 → 350ms**。因此原因是同 alpha 下紫色的灰階亮度較低；不是 palette 或 ZLIFT，也不是 epic 未進入某段。證據：'+link('epic-cause')+'。',
'', '保留紫色，先以同一灰階權重 .299/.587/.114 校正到中性曝光，再給 epic 1.2 倍曝光階差：`.25 × Y(255,238,208) / Y(225,185,255) × 1.2`。沒有改蓄力或 pre-F；沒有降低普通／精良、傳說／神話的任何參數。',
'', '| 稀有度 | 改前峰值 | dev 峰值 | 搬移單檔峰值 | 改前持續 ms | dev 持續 ms | 搬移单檔持續 ms |', '|---|---:|---:|---:|---:|---:|---:|']
for old,new,port in zip(before['light'],after['light'],portable['light']):lines.append(f"| {old['rarity']} | {old['peak']} | {new['peak']} | {port['peak']} | {old['duration']} | {new['duration']} | {port['duration']} |")
lines += ['', '五階的峰值與持續時間均單調不遞減，史詩比精良高 **18.367%**，持續 **400ms**。普通／精良峰值與持續時間相同且未降低；傳說／神話未降低。沿用 round30 的固定卡外 ROI、95 百分位亮度、50ms 取樣，0～4500ms，峰值取前 600ms；門檻使用 `>底色+40`（不是 ≥）。兩入口基準灰階皆為 2。',
'', '## 程序退出碼與條件結果分開記錄','',
'`check_retained_round34.py` 逐支建立 subprocess，保存原始 stdout/stderr、實際 returncode 與耗時。僅將舊輸出目錄字串重定位到 round34；輸入基準以原始位元組複製。診斷 probe 另放 diagnostics，避免它們建立的快照覆蓋舊驗收輸入。程序 exit 0 不代表所有數值通過。',
'', '| 命令（runner 的 script 參數） | 真實 exit | 秒數 | 完整 log |', '|---|---:|---:|---|']
exits=[]
for file in sorted(OUT.glob('*-exit.json')):
 row=json.loads(file.read_text(encoding='utf-8'));exits.append(row)
 lines.append(f"| `{' '.join(row['script'])}` | **{row['exit']}** | {row['seconds']} | [log](shots/round34/{row['log']}) |")
(OUT/'command-exits.json').write_text(json.dumps(exits,indent=2),encoding='utf-8')
lines += ['', '### 最終條件檢查的失敗（不放寬門檻）','']
failed=[r for r in checks if not r['pass_']]
lines += ['- '+r['check'] for r in failed] or ['- 本輪數值斷言全過。']
retained_file=OUT/'retained/acceptance-round33.json'
if retained_file.exists():
 for row in json.loads(retained_file.read_text(encoding='utf-8')):
  if not row['pass_']:lines.append('- Round33：'+row['check']+'（完整數字保存在 `retained/acceptance-round33.json`）。')
lines += ['', '保留測試的非零退出碼須另看上表原始 log：歷史缺陷重現 probe 不等於現行功能回歸；來源素材不存在也不等於已驗素材通過。Round32 的原圖在本機缺失，沒有用現有透明留邊稿代替原圖。',
'', 'Round33 的另一个失敗是搬移單檔 1440 legendary 的未固定種子取樣：10 幀中 reference bins 全為 0，故不能成立重疊覆蓋的反向斷言；activeMax=0、層序及文字對比都通過。以既有量測種子 300 重建改前／改後，兩者的 bins 序列同為 `[0,0,1,0,0,0,0,0,0,0]`，missing 全空，沒有測到本輪造成的差異。保留原失敗，未降低 >5 灰階的參考遮罩門檻，也未用反覆抽種子湊通過。證據：'+link('wave-coverage-diagnosis')+'。20 種子的最終鄰卡文字對比最低 **83.574%**，高於 70%。',
'', 'Round33 舊 frozen manifest 的四個差異為 `src/clicker.html`、`src/gacha-mode-deluxe.js`、`src/gacha.html`、`pool_data.py`。逐一對照本輪起點 HEAD，前兩者位元組相同，後兩者僅工作副本 CRLF／Git blob LF 不同，正規化後相同；`git diff -- src/ card_face.js pool_data.py` 為空。保留舊 hash 斷言的失敗，不更新 manifest 來湊綠。證據：'+link('frozen-diagnosis')+'。',
'', 'Round32 全測在 source file count 後，因 `source(miepuxiong)` 找不到原圖而中止（exit 1）。新增獨立 `--browser-only` 模式實際跑完既有瀏覽器部分：**1398 checks／0 failures**；這不取代失敗的素材驗收。歷史 occlusion probe 在目前產品上要求「鄰卡沒有背光」而失敗，正是 round33 已取消的舊缺陷前提，沒有修改它來假造重現。',
'', '### 驗收腳本維護與早期失敗','',
'- Round33 layout checker 的 1024 下限與留白斷言按本輪使用者裁決更新；1440 原斷言保留，另加完全相同的證據。',
'- followup 原本沒有開封就等待結果；改為實際點擊卡包並等待可收下，再測 refit／observer，沒有更動產品。',
'- UI checker 的舊 screenshot-only HTML 未被帶入這台機器；缺檔時明記，兩個目前正式入口的鍵盤／disabled 斷言照跑。',
'- 舊 audio checker 首次未點開卡包而 timeout；修正後又遇到高階已核准 charge 音效，更新為精確包含 charge 的高階序列，再重跑，沒有刪除排程同一性／靜音斷言。',
'- 最初 retained runner 因缺少歷史 screenshot-only HTML 在啟動檢查前 exit 1；修正輸入準備後再啟動，各檢查碼見表。新量測腳本第一次因等待虛擬時鐘中的 skip Promise 停住，取消 exit 1；改成先發送 skip、再推進時鐘後，baseline 全測 exit 0。',
'', '## 建置與邊界','',
'依序執行 `build_deluxe_b.py` → `build_deluxe_b_standalone.py`，同順序另建 `--test`，四份 HTML 全部重建。搬移單檔在 round34 的独立資料夾以 file:// 開啟；非原地自稱便攜。沒有修改卡面幾何、字級基準、原圖、四層分層表，也沒有 commit／push。',
'', '產物 byte size 與 SHA-256 見 '+link('final-build-hashes')+'。兩支修改 JS 的 `node --check`、新量測程式的 Python 語法檢查及 `git diff --check` 均實際成功。',
'', '自動審核以「blocked by policy」拒絕遞迴刪除本輪 `shots/round34/temporary/` 瀏覽器暫存目錄；未繞過拒絕，暫存目錄留在 worktree。報告寫入與唯讀 Git 檢查隨後正常完成。',
'', '證據目錄：[shots/round34](shots/round34/)。以上為實際 Chromium／Chrome 結果，不當成人類美感或實體手機已驗收。','']
(ROOT/'docs/clicker/REPORT-holo-round34.md').write_text('\n'.join(lines),encoding='utf-8')
print('wrote REPORT-holo-round34.md with',len(exits),'real exits and',len(failed),'failed numeric assertions')
