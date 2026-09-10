"""Generate the Traditional Chinese report and full-resolution review index."""
import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/team-round1'


def build_report():
    data=json.loads((OUT/'acceptance.json').read_text(encoding='utf-8'))
    checks=data['checks'];build=json.loads((OUT/'build.json').read_text(encoding='utf-8'))
    prior=json.loads((ROOT/'docs/clicker/shots/map-round3/acceptance.json').read_text(encoding='utf-8'))['checks']
    def values(key):return checks[key]['values']
    def first(key):return values(key)[0]
    def span(v):return f'{min(v):.3f}～{max(v):.3f}'
    old_counts={s:sum(checks[k]['status']==s for k in prior if k in checks) for s in ['PASS','FAIL','NEEDS_DEVICE','BASELINE']}
    lines=[
        f"本輪已建置並執行完整驗收：**{data['counts']['PASS']} PASS／{data['counts']['FAIL']} FAIL／{data['counts']['NEEDS_DEVICE']} NEEDS_DEVICE／{data['counts']['BASELINE']} BASELINE**。最終腳本狀態 `{data['status']}`。未 commit、未 push。",
        '',
        '交付：[單檔地圖＋編隊](../../../../_art/holo-test/map20.html)、[模板](../../../../_art/holo-test/map20.template.html)、[編隊版型](../../../../_art/holo-test/team20.css)、[編隊控制器](../../../../_art/holo-test/team20.js)、[建置](../../../../_art/holo-test/build_map20.py)、[驗收入口](../../../../_art/holo-test/check_map20.py)、[編隊驗收](../../../../_art/holo-test/check_team20.py)、[完整 JSON](acceptance.json)、[執行紀錄](run.log)、[原尺寸截圖索引](index.html)。',
        '',
        f"成品 **{build['html_bytes']:,} bytes**，上限 6,000,000 bytes；24 張原型子集為神話 4／傳說 6／史詩 6／精良 8。初始合法滿隊為 2／4／6／8。卡圖以品質 90 的 WebP 內嵌；原圖未修改。地圖仍使用品質 {build['terrain_quality']} 的既有建置設定。無外部網路請求。",
        '',
        '地圖與編隊以 `data-screen` 切換，隊伍狀態保留。完整卡面只掛載一張，使用 `HoloCardFace.create/observe/refit/unobserve/paint`；展示頁的既有 CSS 放在 Shadow DOM，僅替換素材 URL 為內嵌資料。容量、代理圖、槽板與技能均為卡外元件，沒有擴充 Ceremony 控制器或版型。',
        '',
        f"受保護檔案 SHA-256 比對：**{first('team.protected_files_changed'):.0f} 個變更**；範圍包含 `src/`、`card_face.js`、`ceremony.*`、`pool_data.py`、`demo.html` 與 `map-art/` 全部檔案。對照清單見 [protected-before.json](protected-before.json)。",
        '',
        '```powershell',
        'python _art/holo-test/build_map20.py',
        'python _art/holo-test/check_map20.py',
        'python _art/holo-test/report_team20.py',
        '```',
        '',
        f"第三輪記錄共 {len(prior)} 項，本輪全部執行 {sum(k in checks for k in prior)} 項：{old_counts['PASS']} PASS／{old_counts['FAIL']} FAIL／{old_counts['NEEDS_DEVICE']} NEEDS_DEVICE／{old_counts['BASELINE']} BASELINE。簡報所稱的 245 項為原 PASS／FAIL 項；另外 2 項真實隱藏分頁檢查與 1 項歷史對比基準沒有移除或假裝通過。",
        '',
        '冷卻仍以 `Date.now()+180000` 記錄到期時間。互動式 bundled Chromium 啟動回報 `spawn UNKNOWN`；另探測已安裝 Edge，分頁切換仍回報 visible。headless 的倒數測試有實際跑，但不能替代真實 hidden 狀態，因此保留 NEEDS_DEVICE。',
        '',
        '| 尺寸 | 欄數／卡寬 px | 完整卡／詳情 % | C／非卡片 UI % | 紋理／非卡片 UI % | 空白紋理灰階差 /255 |',
        '|---|---:|---:|---:|---:|---:|',
    ]
    for tag in ['1440x900','1024x768','390x844']:
        p='team-'+tag
        lines.append(f"| {tag} | {first(p+'.columns'):.0f}／{span(values(p+'.proxy_width'))} | {first(p+'.card_detail_area'):.3f} | {first(p+'.new_language_area'):.3f} | {first(p+'.texture_area'):.3f} | {first(p+'.texture_blank_delta'):.3f} |")
    lines+=['', '桌面 10 欄×2 排；中型桌面 5 欄×4 排；手機 4 欄、卡寬不再縮小。卡區獨立捲動，容量與技能固定。手機點卡開啟完整尺寸詳情，使用「返回隊伍」關閉；截圖索引另交總覽與詳情。', '',
        '| 尺寸 | 接合 R：灰階差 8～24 的像素 % | 超過 24 的像素 % | 卡內核心開關差異 % |',
        '|---|---:|---:|---:|']
    for tag in ['1440x900','1024x768','390x844']:
        def gather(suffix):return [v for k,c in checks.items() if k.startswith('team-'+tag+'-') and k.endswith(suffix) for v in c['values']]
        lines.append(f"| {tag} | {span(gather('.seam_8_24'))} | {span(gather('.seam_over24'))} | {span(gather('.card_core_difference'))} |")
    lines+=['',
        '遮罩先固定再拍開／關：D 為詳情面板，K 為中立姿態的卡片投影；非卡片 UI 為可見面板聯集，扣除卡面、代理圖與捲動裁切區。C 計共用容量／隊伍／技能導軌與槽板，手機詳情則計其導軌面板。R 為 K 外側 8～24 px 與實際承載板相交的區域，不含文字。卡到槽內緣 12 px；槽外另有 12 px 承載板。紋理遮罩依實際環帶：一般導軌 12 px、承載板 14 px。遮罩及分母原始座標都在 JSON，兩圖使用完全相同的遮罩。',
        '',
        '並排圖左＝關、右＝開；除了總開關，還交承載、紋理、共同標記三項獨立開關。四個稀有度、depth／flat／framed、明亮與深色卡都涵蓋；每卡有靜止、左上、右下三次取樣。WAAPI 暫停、固定 currentTime，等待雙重 rAF 後才截圖。承載關不隱藏完整卡與操作按鈕，也不改卡內參數。',
        '',
        '| 尺寸 | 識別物可見／全畫面 % | 第一段三物件單次最大可見 % |',
        '|---|---:|---:|']
    for tag in ['1440x900','1024x768','390x844']:
        lines.append(f"| {tag} | {first(tag+'.landmarks_visible'):.3f} | {'／'.join(f'{x:.3f}' for x in values(tag+'.landmark_each_seen_once'))} |")
    lines+=['',
        '手機面積門檻僅依本簡報撤換為 8～25%。另沿第一段 0～432 px、每 4 px 捲動取樣，對每個完整包圍框取「單一位置」的最大可見比例，沒有把不同位置的碎片加總。手機地景在捲動中左右巡覽，三物件各有一次完整出現；地圖原圖、比例及垂直捲動關係不變。這是可見範圍證據，不是玩家辨識率。',
        '',
        f"混合隊伍 2 神話＋4 傳說時，再加傳說被拒絕，原隊伍不變；第二、三、四列同時指出超額。退回動畫 **{span(values('team.return_duration'))} ms**、邊框提示 **{span(values('team.reject_border_duration'))} ms**；文字保留至下一次操作。新增預覽實測 **{first('team.preview_latency'):.3f} ms**，同時標出三條受影響的集合。", '',
        f"第二張神話技能經程式入口嘗試確認成功 **{first('team.second_mythic_skill_confirmed'):.0f} 次**，另有實際 UI 確認被拒絕的截圖。技能四格只提供獨立挑選，不畫隊伍連線、戰力百分比、冷卻或能量條。較低階替換神話後可使用空出的累加額度；新增與移除亦有 UI 驗收。", '',
        '**暫定階級對應**：神話＝mythic、傳說＝legendary、史詩＝epic、精良＝rare＋common。技能來源與戰力定義仍未定案。', '',
        '代理圖只整理透明邊界、完整保留角色及附屬物；另外建置 5:7 元件，不縮改完整卡。原型暫不選入給狐錢好嗎、阿巴阿巴、哥布羊三張寬幅角色：在保持完整輪廓與比例時，既定槽位無法達到包圍框面積下限，之後接全池須另處理。JSON 同時列主體包圍框及實際 alpha 面積；包圍框不是輪廓墨跡面積，也不是辨識率。flat 的背景不能算作主體，因此不以整幅圖面積冒充角色遮罩。', '',
        '**待人工判定，未自行打分**：', '',
    ]
    lines += ['- '+x for x in data['manual'] if '待人工判定' in x]
    lines += ['', '三道門的人工部分尚未裁定，不能只憑自動數字宣告 C 已成立。第三道門在編隊不適用，地圖辨識沿用第三輪的人工作業背景；本輪補交完整巡覽可見證據。']
    failed={k:v for k,v in checks.items() if v['status']=='FAIL'}
    if failed:
        lines+=['','**仍未通過的自動項目**：','']
        for k,v in failed.items():lines.append(f"- `{k}`：{v['values']}；規格 {v['range']} {v['unit']}。保留 FAIL，未改門檻。")
    (OUT/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    active={c['id'] for c in build['team_cards']}
    files=[p for p in sorted(OUT.glob('*.png')) if not p.name.startswith(('quick-','current-')) and p.name!='preview.png' and '-ababa-' not in p.name]
    groups=[('總覽與主要對照',[p for p in files if any(p.name.endswith(x) for x in ['-overview.png','-detail.png','-carrier-pair.png','-names-hidden.png'])]),
            ('完整取樣矩陣',[p for p in files if any('-'+i+'-' in p.name for i in active) and '-pair.png' in p.name]),
            ('操作與地圖證據',[p for p in files if not p.name.startswith('team-') and 'mask' not in p.name])]
    page=['<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>編隊第一輪・原尺寸驗收截圖</title><style>body{background:#242723;color:#e5e3d6;font:16px/1.6 sans-serif;padding:24px}a{color:#bccbb0}summary{cursor:pointer;padding:10px;border-bottom:1px solid #66705d}img{display:block;max-width:none;margin:12px 0}details{overflow:auto}p{max-width:900px}</style><h1>編隊第一輪・原尺寸驗收截圖</h1><p>並排左＝關，右＝開。圖片保持原始像素，手機圖不縮為縮圖；橫向捲動檢視。角色配對、共同操作關係與 C 分類均待人工判定。</p><p><a href="REPORT.md">繁體中文報告</a> · <a href="acceptance.json">原始量測</a></p>']
    for title,items in groups:
        page.append('<h2>'+title+'</h2>')
        for p in items:page.append(f'<details><summary>{html.escape(p.name)}</summary><a href="{p.name}">另開原圖</a><img loading="lazy" src="{p.name}" alt="{html.escape(p.name)}"></details>')
    page.append('</html>');(OUT/'index.html').write_text('\n'.join(page),encoding='utf-8')
    print(str(OUT/'REPORT.md'))


if __name__=='__main__':build_report()
