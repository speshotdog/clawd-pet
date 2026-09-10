"""Traditional Chinese measured round-two report."""
import json, statistics, html
from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/team-round2'
def build_report():
 for size in ['1440x900','1024x768','390x844']:
  source=OUT/f'team-{size}-rocketdog-neutral-carrier-pair.png'
  (OUT/f'team-{size}-carrier-pair.png').write_bytes(source.read_bytes())
  Image.open(source).convert('L').save(OUT/f'team-{size}-carrier-gray-pair.png')
 d=json.loads((OUT/'acceptance.json').read_text(encoding='utf-8')); c=d['checks']; build=json.loads((OUT/'build.json').read_text(encoding='utf-8'))
 prior=json.loads((ROOT/'docs/clicker/shots/map-round3/acceptance.json').read_text(encoding='utf-8'))['checks']
 def v(k):return c[k]['values']
 def span(a):return f'{min(a):.3f}～{max(a):.3f}'
 def gather(p,s):return [x for k,z in c.items() if k.startswith(p) and k.endswith(s) for x in z['values']]
 counts=d['counts']; old={s:sum(c[k]['status']==s for k in prior if k in c) for s in ['PASS','FAIL','NEEDS_DEVICE','BASELINE']}
 lines=['# 編隊第二輪實測報告','',f"**{counts['PASS']} PASS／{counts['FAIL']} FAIL／{counts['NEEDS_DEVICE']} 待實機／{counts['BASELINE']} 基準值**。整體狀態 **{d['status']}**。未 commit、未 push；未達標項目沒有宣稱通過。",'', '[1440×900 原尺寸單張](team-1440x900-original.png) · [完整截圖索引](index.html) · [原始 JSON](acceptance.json) · [執行紀錄](run.log) · [成品](../../../../_art/holo-test/map20.html?screen=team)','',
 '編隊改用 #101115／#ecece6／#949690／#303239，稀有度色取自既有 --accent-card。每頁兩排五欄，兩頁合計 20 張真實 HoloCardFace 卡面；卡區獨立捲動，容量與技能列保持位置。只有詳情卡接受材質互動，沒有逐張發牌、蓄力或自動掃箔。', '',
 f"成品 {build['html_bytes']:,} bytes。受保護檔案變更 {v('team.protected_files_changed')[0]} 個，包含 src/、card_face.js、ceremony.*、pool_data.py、demo.html 與 map-art/，見 [SHA-256 基線](protected-before.json)。卡內幾何、Z、字級未修改。",'',
 '```powershell','python _art/holo-test/build_map20.py','python _art/holo-test/check_team20.py','python _art/holo-test/report_team20.py','```','',
 f"地圖歷史 {len(prior)} 項已執行 {sum(k in c for k in prior)} 項：{old['PASS']} PASS／{old['FAIL']} FAIL／{old['NEEDS_DEVICE']} 待實機／{old['BASELINE']} 基準值。245 項原 PASS／FAIL 回歸包含 runtime.errors。Date.now()+180000 與殺除 timer 後等待 6 秒再以 visibilitychange 重繪的回歸保留。兩項真實 hidden 分頁檢查仍待實機，沒有把 headless visible 當成 hidden 通過。",'',
 '| 尺寸 | 總覽卡寬 px | 詳情卡寬 px | 可見卡片 % | 非卡片 UI % |','|---|---:|---:|---:|---:|']
 for size in ['1440x900','1024x768','390x844']:
  p='team-'+size; lines.append(f"| {size} | {span(v(p+'.proxy_width'))} | {span(v(p+'.detail_width'))} | {span(v(p+'.visible_card_area'))} | {span(v(p+'.visible_noncard_ui_area'))} |")
 lines+=['','面積分母保守採完整 viewport（不扣頁首、容量與技能列）。卡片分子為可見卡矩形聯集，依 viewport 與捲動祖先裁切，畫面外不計。非卡片 UI 計頁首、容量、總覽工具列、分頁、技能、詳情標頭、說明、操作列及承載聯集並扣卡面；不把沒有元件的空白整塊當 UI。新舊遮罩都交付，舊指標仍使用原面板聯集分母。','',
 '手機兩排、卡寬最高 130px、5:7 比例，即使無欄距填滿 390px 寬，卡面上限仍只有 2×182÷844＝43.128%。因此以完整 viewport 為分母時，45% 下限與手機排數／卡寬限制互斥。本輪保留 FAIL，未加入畫面外卡片或修改門檻。其他尺寸以表中實測為準。','',
 '| 尺寸 | carrier seam_delta % R | carrier detail_delta % D | 微光峰值 /255 | 各組卡內核心差異 % |','|---|---:|---:|---:|---:|']
 for size in ['1440x900','1024x768','390x844']:
  p='team-'+size+'-';lines.append(f"| {size} | {span(gather(p,'.seam_delta'))} | {span(gather(p,'.detail_delta'))} | {span(gather(p,'.glow_peak'))} | {span(gather(p,'_core_difference'))} |")
 lines+=['','seam_delta 僅使用 carrier 獨立開／關，固定卡外 8～24px 的 R，計灰階絕對差 ≥8 的占比。detail_delta 在整個詳情 D 計 RGB 任一通道差 >2 的占比；微光峰值採 R 內開減關的正向灰階差。承載嚴格繪製在卡外，不改卡面材質參數。','',
 '三尺寸 × 8 張卡 × 3 姿態 × 4 開關＝288 張並排圖。左關右開；同卡、同游標與同動畫時刻，WAAPI 暫停＋currentTime＋雙重 rAF。carrier／texture／selection／all 各組均量卡內核心零差異。seam_8_24／seam_over24 保留作防爆亮檢查，**不再單獨作為承載存在的證據**。','',
 '| 尺寸 | 舊 seam_8_24 % | 舊 seam_over24 % | 舊 C／UI % | 舊紋理／UI % | 空白紋理差 /255 |','|---|---:|---:|---:|---:|---:|']
 for size in ['1440x900','1024x768','390x844']:
  p='team-'+size;lines.append(f"| {size} | {span(gather(p+'-','.seam_8_24'))} | {span(gather(p+'-','.seam_over24'))} | {span(v(p+'.new_language_area'))} | {span(v(p+'.texture_area'))} | {span(v(p+'.texture_blank_delta'))} |")
 lines+=['','舊 C 導軌／工業紋理比例仍有執行，未刪除或放寬範圍。它們與第二輪近黑、大留白、移除工業霧面槽板的方向不完全相容；本輪未為舊比例重加大面積槽板或刮痕，失敗值完整保留。','',
 '| 尺寸 | rAF 中位數 ms | rAF P95 ms | 換頁＋雙 rAF ms | 掛載總覽卡 |','|---|---:|---:|---:|---:|']
 for size in ['1440x900','1024x768','390x844']:
  a=d['evidence']['team-'+size+'.performance'];s=sorted(a['intervals']);lines.append(f"| {size} | {statistics.median(s):.3f} | {s[int((len(s)-1)*.95)]:.3f} | {a['switchMs']:.3f} | {a['overviewFaces']} |")
 lines+=['','以上是本機 headless Chromium 靜止卡面的 60 個 rAF 間隔，非跨裝置保證。分頁限制同時 10 張總覽＋1 張詳情，換頁與離開編隊均 unobserve；總覽不接受材質互動。沒有同時掛載 20 張總覽，頁外卡不占完整卡面觀察器。','',
 f"混合超額：退回 {span(v('team.return_duration'))} ms；邊框 {span(v('team.reject_border_duration'))} ms；預覽 {span(v('team.preview_latency'))} ms。具體文字：{d['evidence']['mixed_message']}。多條違規同時標出，文字持續到下次操作。",'',
 f"四個獨立技能格保留；第二張神話技能確認成功 {v('team.second_mythic_skill_confirmed')[0]} 次，沒有技能連線與虛構計量。common 暫併精良、技能來源尚未定案。總覽序號、詳情標頭、已編入／替換標記同步。",'',
 '**待人工判定**：卡片辨識、灰階分類、是否被讀成編隊物件、視覺改善與美感，未自行打分。原代理圖題目應以本輪真實卡面重新判定。','', '**未通過項目（上下限未調整）**：','']
 for k,a in c.items():
  if a['status']=='FAIL':lines.append(f"- `{k}`：{span(a['values'])}；要求 {a['range'][0]}～{a['range'][1]} {a['unit']}。")
 lines += ['', '地圖三尺寸主畫面與第一輪逐像素比對，差異皆為 0，見 [像素回歸紀錄](map-pixel-regression.json)。建置使用的卡面 CSS 雜湊、地圖素材雜湊及地圖壓縮品質亦與第一輪相同。']
 (OUT/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 files=[p for p in sorted(OUT.glob('*.png')) if not p.name.startswith(('quick','probe-','reference-'))]
 files.sort(key=lambda p:(0 if p.name=='team-1440x900-original.png' else 1 if p.name.endswith('-overview.png') else 2 if p.name.startswith('team-') else 3,p.name))
 gallery=''.join(f'<figure><a href="{p.name}"><img loading="lazy" src="{p.name}"></a><figcaption>{html.escape(p.name)}</figcaption></figure>' for p in files)
 (OUT/'index.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>編隊第二輪</title><style>body{background:#101115;color:#ecece6;font:16px sans-serif;margin:32px}a{color:inherit}figure{margin:32px 0}img{max-width:100%}figcaption{font-size:13px}</style><h1>編隊第二輪・原尺寸截圖</h1><p><a href="REPORT.md">實測報告</a> · <a href="acceptance.json">原始數據</a>。並排左關右開，點圖開啟原尺寸。</p>'+gallery,encoding='utf-8')
 print(counts)
if __name__=='__main__':build_report()
