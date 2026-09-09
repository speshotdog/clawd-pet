"""Assemble the Chinese handoff from actual measurements and process results."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/round40'
read=lambda name:json.loads((OUT/name).read_text(encoding='utf-8'))
depth=read('depth-metrics.json');cutouts=read('cutout-metrics.json')
codes=read('exit-codes.json')
lines=['# 第四十輪：4.0 神話卡完成報告','',
'**〇之二的四項決定是代為裁決，待使用者追認。** 本輪依第五節的量測否決權，進一步修正兩張純裁切路線；詳見下文。','',
'已依序讀完簡報〇的五份指定材料後才修改程式。只在本 worktree 寫入；未 commit、未 push。保留開工時已有的第三十四至三十九輪改動。','',
'## 實作與規格修正','',
'珍氣球的實際主體（含線）bbox 為 x=69…795，寬726；真菌玥含肢體為 x=43…726，寬683。原定5:7純裁切視窗約607／571，不能保留完整主體。因此兩張改為裁掉兩側部分裝飾，再沿上下原邊像素外推，佔比約18.2%。没有重新畫雲、星星或角色。','',
'沙堡原圖952×747若完全保留寬度，5:7高度約1333，需要586px，外推佔43.96%，不是規劃中的358px。改為先裁兩側背景至762px（x=116…878，保留沙堡與羊），再補320px，佔29.9906%，仍小於30%。沙堡是subject，羊／鏟子／沙灘／天空留在background，保留遮擋順序。','',
'珍珍維持flat及既有透明留邊，卡圖未改。怪物素材未收。珍氣球的線在原圖下緣本來已截斷；保留現有全部線像素，不生成延長線。','',
'兩層共用裁切與補邊矩形，輸出600×840 RGBA。縮放只作統一輸出重採樣（整數像素取整）；沒有局部拉伸、生成式補圖或重描RGB。','',
'## 五張卡的處理與量測','',
'| 卡 | 方法／主體 | 原圖 | 輸出 | 補洞像素 | 未填 | 邊界色差 ≤8 | 外推佔比 ≤30%／色差 ≤6 | 裁掉主體像素 |',
'|---|---|---|---|---:|---:|---:|---|---:|']
for r in depth:
    lines.append(f"| {r['name']} | depth／{'沙堡' if r['id']=='shabaolingzhu' else '含線羊氣球' if r['id']=='zhenqiqiu' else '灰色獸含肢體'} | {'×'.join(map(str,r['original_size']))} | 兩層600×840 | {r['hole_pixels']} | {r['unfilled_pixels']} | {r['boundary_color_delta']:.6f} | {r['extension_ratio']*100:.4f}%／{r['extension_color_delta']:.6f} | {r['subject_pixels_cropped']} |")
wolf=next(r for r in cutouts if r['id']=='liulangyueshou')
lines += [f"| 流浪玥手 | framed／狼＋琴＋木頭＋草地 | 688×648 | {'×'.join(map(str,wolf['output_size']))} RGBA | 不適用 | 新洞0 | 亮邊{wolf['bright_boundary_ratio']*100:.4f}% | 不適用 | 封閉白移除0 |",
'| 珍珍 | flat原檔保留 | 2039×1378 | 600×840，既有留邊 | 不適用 | 不適用 | 不適用 | 不適用 | 本輪未裁 |','',
'補洞使用距離變換找到洞外最近的原圖像素並clone；逐像素驗證補入RGB等於其來源RGB。量測在原圖像素尺度：洞的內外各3px形態學帶，分別取RGB平均後算三通道絕對差的平均（0–255）。外推比較重複邊緣列與原圖相鄰三列，沿用原像素，不混色生成。填滿整張背景，因此所有最大位移均無未填洞；這不代表補洞能重建被遮住的真實場景。原圖羊／鏟子／陰影被clone進遮擋區的痕跡在「補洞後」圖完整揭露。','',
'| 卡 | 原圖主體bbox（右／下不含） | 同層裁切矩形 | 上／下補邊 | 輸出alpha bbox |',
'|---|---|---|---|---|']
for r in depth:lines.append(f"| {r['name']} | {r['source_alpha_bbox']} | {r['crop']} | {r['extension_top']}／{r['extension_bottom']} | {r['output_alpha_bbox']} |")
lines+=['','## 去背與亮邊','',
'`prepare_round32.py`支援`HOLO_SOURCE`，未設定時自動偵測簡報中的兩個素材候選路徑。邊緣相連近白洪水填充（>235）→最大元件→原尺寸及縮放後defringe均接同一份`bright_edge.sat_ok()`，保護封閉白與飽和填色。原本11張framed也從原圖重跑，以免只改判準而留下先前被剝掉的填色。','',
'| 卡 | 原圖 | 輸出（高580） | 封閉白元件數 | 全白像素／移除白像素 | 封閉白像素／移除 | 新內部透明洞像素 | 亮邊比例 ≤1% |',
'|---|---|---|---:|---:|---:|---:|---:|']
for r in cutouts:
    lines.append(f"| {r['name']} | {'×'.join(map(str,r['original_size']))} | {'×'.join(map(str,r['output_size']))} | {r['white_components']} | {r['white_pixels']}／{r['removed_white_pixels']} | {r['interior_white_pixels']}／{r['interior_white_removed']} | {r['new_interior_hole_pixels']} | {r['bright_boundary_ratio']*100:.4f}% |")
lines+=['','## 建置與搬移驗收','',
'依簡報順序六支builder全部exit 0：`build_card_scenes.py` → `embed_masks.py` → `build_cards_remade.py` → `build_cards_remade_standalone.py` → `build_deluxe_b.py` → `build_deluxe_b_standalone.py`。三張資料同時設depth及scene=True；embed_masks會重烘這三張的subject mask。沒有修改card_face.js、src/gacha-pool.js、RATE或卡面CSS幾何／Z／字級。','',
'`check_depth_round40.py` exit 0：兩個單檔複製到`shots/round40/portable/`後才開啟。六個「入口×卡」都載入兩張內嵌圖片與subject mask；背景解碼alpha全255，pageerror及外部請求皆0。逐一拍下四角x/y=±1：rotateX/Y=±14°，subject平移±1.5px、background反向±0.5px；共24張最大視差截圖。測試直接呼叫既有paint以探測上限，不改產品的互動規則。初版virtual-clock探針停滯後終止，改用真實開包／跳過揭曉流程完成；沒有把中止當通過。','',
'## 真實退出碼','',
'| 腳本 | exit code |','|---|---:|']
for r in codes:lines.append(f"| {r['script']} | {r['exit_code']} |")
lines+=['| check_depth_round40.py | 0 |','',
'Round9兩入口均65張（22張示範＋43張舊卡池）；該demo未新增4.0卡，故原卡數斷言仍正確且實跑通過。新增depth另由round40搬移驗收覆蓋。Round32將kind斷言擴充成depth並新增scene／雙層尺寸／不透明背景斷言；亮邊改用已裁決的共用判準，1%門檻不動。','',
'所有原始stdout／stderr：[驗收日誌與退出碼](shots/round40/exit-codes.json)。失敗細節見同資料夾各`check_*.py.log`，不刪斷言、不放寬門檻。','',
'Round32完成1542項，3項失敗：珍珍既有alpha bbox `[0,217,600,622]` 不符合舊純裁切契約；單檔6,127,733 bytes，相對舊基準增加981,268 bytes，超出900,000預算81,268 bytes；歷史凍結快照不同的檔案為`src/clicker.html`、`src/gacha-mode-deluxe.js`、`src/gacha.html`及本輪必改的`pool_data.py`。前三項src檔不在本輪修改範圍，沒有為通過測試倒退它們。完整記錄：[acceptance-round32.json](shots/round40/acceptance-round32.json)。','',
'魔花少女：完整視覺驗收原地與搬移均exit 0，卡名對比6.46:1、寶石對比145.67、卡寬380px與字級31.45／17.69／28.83均通過。效能驗收獨立在其他瀏覽器工作結束後跑5輪×2入口，10筆全部未達原預算：fps 20.22–20.66（要求≥35）、中位50.0ms（要求≤25）、p95約50.1ms（要求≤50）；靜置rAF均0。這與第三十九輪已記錄的效能未達標方向一致，不能宣稱本輪把它修好。產品頁、builder與gift素材沒有變；完整數據：[gift/round40.json](shots/round40/gift/round40.json)，視覺：[gift/round40-verification.json](shots/round40/gift/round40-verification.json)。','',
'## 截圖與重跑','']
for r in depth:
    ident=r['id'];lines.append(f"- {r['name']}：[補洞前](shots/round40/{ident}-hole-before.png)／[補洞後](shots/round40/{ident}-hole-after.png)／[重合圖](shots/round40/{ident}-aligned.png)／[gallery最大視差](shots/round40/cards-remade-{ident}-max-1-1.png)／[gacha最大視差](shots/round40/deluxe-gacha-b-{ident}-max-1-1.png)。")
lines+=['- [流浪玥手去背前後](shots/round40/liulangyueshou-before-after.png)。',
'- [補洞量測JSON](shots/round40/depth-metrics.json)、[去背JSON](shots/round40/cutout-metrics.json)、[搬移／四角JSON](shots/round40/portable-depth.json)。','',
'在worktree根目錄執行：`python _art/holo-test/prepare_round40.py`重產三張雙層及12張framed，再依上述六支builder順序建置；`python _art/holo-test/run_checks_round40.py`跑八支既有驗收，`python _art/holo-test/check_depth_round40.py`驗搬移。','']
before=read('frozen-before-checks.json')
changed=[p for p,h in before.items() if hashlib.sha256((ROOT/p).read_bytes()).hexdigest()!=h]
(OUT/'frozen-after-checks.json').write_text(json.dumps(dict(changed=changed,hashes=before),ensure_ascii=False,indent=2),encoding='utf-8')
lines+=['## 凍結檔核對','',f'驗收前後SHA-256比對{len(before)}個檔案（含禮物頁、builder、gift素材、card_face.js、遊戲卡池、珍珍卡圖），變更清單：`{changed}`。這是驗收前後的核對，沒有冒稱為開工前快照；本輪沒有編輯任何禮物產品檔。詳見[frozen-after-checks.json](shots/round40/frozen-after-checks.json)。','']
(ROOT/'docs/clicker/REPORT-holo-round40.md').write_text('\n'.join(lines),encoding='utf-8')
