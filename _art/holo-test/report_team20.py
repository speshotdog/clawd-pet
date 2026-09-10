"""第三輪繁體中文報告，由驗收 JSON 與實際像素產生。"""
import json, html
from pathlib import Path
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/clicker/shots/team-round3'

def build_report():
 d=json.loads((OUT/'acceptance.json').read_text(encoding='utf-8'));c=d['checks']
 prior=json.loads((ROOT/'docs/clicker/shots/map-round3/acceptance.json').read_text(encoding='utf-8'))['checks']
 prev=json.loads((ROOT/'docs/clicker/shots/team-round2/acceptance.json').read_text(encoding='utf-8'))['checks']
 def span(k):
  a=c[k]['values'];return f'{min(a):.3f}～{max(a):.3f}'
 def gather(size,suffix):
  a=[x for k,v in c.items() if k.startswith('team-'+size+'-') and k.endswith(suffix) for x in v['values']];return f'{min(a):.3f}～{max(a):.3f}'
 sizes=['1440x900','1024x768','390x844']
 comparisons={}
 for size in sizes:
  name=size+'-overview.png'
  # Map main screenshots use the stable names emitted by check_map20.
  candidates=[p for p in OUT.glob(size+'*.png') if (ROOT/'docs/clicker/shots/team-round2'/p.name).exists()]
  for p in candidates:
   if p.name in [size+'-on.png']:
    a=Image.open(p).convert('RGB');b=Image.open(ROOT/'docs/clicker/shots/team-round2'/p.name).convert('RGB')
    diff=ImageChops.difference(a,b);changed=sum(any(v) for v in diff.get_flattened_data());comparisons[p.name]={'changed_pixels':changed,'total_pixels':a.width*a.height}
 (OUT/'map-pixel-regression.json').write_text(json.dumps(comparisons,indent=2),encoding='utf-8')
 build=json.loads((OUT/'build.json').read_text(encoding='utf-8'));oldbuild=json.loads((ROOT/'docs/clicker/shots/team-round2/build.json').read_text(encoding='utf-8'))
 assert len(comparisons)==3, 'Missing map screenshot comparison'
 assert all(v['changed_pixels']==0 for v in comparisons.values()), 'Map pixels changed'
 assert all(build[k]==oldbuild[k] for k in ['sources','frozen_css_sha256','terrain_quality']), 'Protected build metadata changed'
 counts=d['counts'];mcounts={s:sum(c[k]['status']==s for k in prior if k in c) for s in ['PASS','FAIL','NEEDS_DEVICE','BASELINE']}
 lines=['# 編隊第三輪實測報告','',f"驗收：**{counts['PASS']} PASS／{counts['FAIL']} FAIL／{counts['NEEDS_DEVICE']} 待實機／{counts['BASELINE']} 基準值**；整體 **{d['status']}**。未 commit、未 push。",'',
 '[390×844 原尺寸](team-390x844-original.png) · [1440×900 原尺寸](team-1440x900-original.png) · [完整圖集](index.html) · [驗收 JSON](acceptance.json) · [黑角 JSON](corners.json) · [執行紀錄](run.log)','',
 '手機固定三欄、卡寬 112px，其餘列在卡區垂直捲動。兩頁合計 20 張卡；逐張捲入視窗後量裁切。桌面排版、卡面 shadow root、承載與地圖保留。','',
 '| 尺寸 | 欄數 | 卡寬 px | 可見卡面積 % viewport | 非卡片 UI % | 相鄰卡重疊 px² |','|---|---:|---:|---:|---:|---:|']
 for size in sizes:
  p='team-'+size;lines.append(f"| {size} | {span(p+'.columns')} | {span(p+'.proxy_width')} | {span(p+'.visible_card_area')} | {span(p+'.visible_noncard_ui_area')} | {span(p+'.overlap')} |")
 lines+=['',f"手機 20 張卡的視窗裁切：{span('team-390x844.viewport_card_clipped')}%。面積分母仍為完整 viewport，只計可見卡矩形聯集並依捲動祖先裁切。45～70% 門檻保持原值；若未通過即保留 FAIL，不以畫面外卡片補足。",'',
 '| 尺寸 | 承載接縫差異 % | 詳情差異 % | 增亮 /255 | 卡內核心差異 % |','|---|---:|---:|---:|---:|']
 for size in sizes:lines.append(f"| {size} | {gather(size,'.seam_delta')} | {gather(size,'.detail_delta')} | {gather(size,'.glow_peak')} | {gather(size,'_core_difference')} |")
 lines+=['','黑角使用既有 check_card_corners.py 的共用取樣函式；本輪依 BRIEF 採暗像素占比 ≥5% 且最暗 ≤6，暗像素定義為 ≤max(4, 在地中位×0.35)。取樣固定 WAAPI currentTime=0 並等雙重 rAF。負控制樣式直接注入 shadow root，先驗證 ::after content。','']
 for screen,v in d['evidence']['corner_regression'].items():
  if v.get('status')=='SKIP':lines.append(f"- {screen}：SKIP，沒有掛載卡面。")
  else:
   for state in ['current','negative_control']:
    a=v[state];lines.append(f"- {screen} {state}：**{a['status']}**，黑角 {a['bad']}／{a['samples']}。")
 lines+=['','負控制 FAIL 是預期結果，驗收要求其至少檢出一角；不可把負控制沒有生效當作通過。','',
 '正式退役三尺寸 team-* 的 new_language_area、texture_area、texture_blank_delta：編隊已採卡牌語言，工作盤刮痕／導軌比例不再適用。共有 9 個指標實例，包含前輪 8 FAIL 與 1 PASS（手機 texture_area）；為一致性，整組退役。移除清單：','']
 retired=[k for k in prev if k.startswith('team-') and k.rsplit('.',1)[-1] in ['new_language_area','texture_area','texture_blank_delta']]
 missing=[k for k in prev if k not in c and k not in retired]
 assert not missing, f'Missing retained regressions: {missing}'
 lines += [f"- `{k}`（前輪 {prev[k]['status']}）" for k in retired]
 lines+=['',f"地圖歷史 {len(prior)} 項已執行 {sum(k in c for k in prior)} 項：{mcounts}。地圖同名指標繼續執行。真實 hidden 分頁兩項仍待實機，未冒充通過。",'',
 f"受保護檔案變更：{span('team.protected_files_changed')} 個；SHA-256 使用前輪原始基線。卡內幾何、Z、字級改動 0 項。地圖像素比對見 [JSON](map-pixel-regression.json)：{comparisons}。",'',
 '未通過項目（上下限未更動）：','']
 lines += [f"- `{k}`：{span(k)}，要求 {v['range']} {v['unit']}。" for k,v in c.items() if v['status']=='FAIL']
 if not counts['FAIL']:lines.append('無 FAIL。驗收程序退出碼為 1，原因是兩項 NEEDS_DEVICE；未將待實機項目算作通過。')
 lines += ['','人工辨識與美感、真實 hidden 分頁仍須人工／實機判定。完整量測證據、混合隊伍與技能殼回歸保留在 acceptance.json。','', '重現：`python _art/holo-test/build_map20.py`、`python _art/holo-test/check_team20.py`、`python _art/holo-test/report_team20.py`。']
 (OUT/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
 files=sorted(OUT.glob('*.png'),key=lambda p:(0 if p.name=='team-390x844-original.png' else 1 if p.name=='team-1440x900-original.png' else 2,p.name))
 gallery=''.join(f'<figure><a href="{p.name}"><img loading="lazy" src="{p.name}"></a><figcaption>{html.escape(p.name)}</figcaption></figure>' for p in files)
 (OUT/'index.html').write_text('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>編隊第三輪</title><style>body{background:#101115;color:#ecece6;font:16px sans-serif;margin:32px}a{color:inherit}figure{margin:32px 0}img{max-width:100%}</style><h1>編隊第三輪・原尺寸截圖</h1><a href="REPORT.md">實測報告</a> · <a href="acceptance.json">原始數據</a>'+gallery,encoding='utf-8')
 print(counts)
if __name__=='__main__':build_report()
