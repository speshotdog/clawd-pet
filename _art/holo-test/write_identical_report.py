"""Assemble delivery from measured evidence; missing gates remain explicitly incomplete."""
import json
import statistics
from pathlib import Path
HERE=Path(__file__).resolve().parent
DOC=HERE.parents[1]/'docs/clicker'
OUT=DOC/'shots/identical'

def read(path):return json.loads(path.read_text(encoding='utf-8'))

def main():
    identity=read(OUT/'identity.json')
    # The narrative below names this measured run. Refuse to reuse those claims
    # for a changed/incomplete collection; pixel/performance gaps stay explicit.
    from check_card_identity import valid
    assert valid(identity) and sum(map(len,identity.values()))==454
    summary=read(OUT/'collection-summary.json')
    assert summary['cards']==1920 and summary['fontSamples']==3840
    assert not summary['unexpectedFonts'] and not summary['pageErrors'] and summary['artifactsUnchanged']
    components=read(OUT/'asset-layers.json')
    assert components['pass'] and components['comparisons']==960 and components['differences']==0
    sabotage=read(OUT/'sabotage/sabotage-summary-scope3.json')
    assert sabotage['pass'] and len(sabotage['cases'])==56 and sabotage['sourceUnchanged']
    compression=read(OUT/'compression.json')
    assert compression['rawBytes']==173747406 and compression['gzipBytes']==6151768 and compression['roundTripExact']
    lines=['# 三面卡圖同一性：2026-09-12','',
        '## 1. 資產同一性','',
        '卡圖現在只由 `card_assets.py` 編碼，`update_demo_data.py` 在既有建置順序的第一步產生權威檔與 `card-assets.json`。其餘建置器只讀取並嵌入同一串 bytes，不再各自重編卡圖。來源或權威檔雜湊不符會停止建置。沒有 commit。', '',
        '採 lossless WebP（exact=True、method=6），600×840 為 bounding box。原本已為 600×840 的場景圖維持該尺寸；去背卡原圖比例各異，保持比例、不拉伸、不加透明邊、不放大小原圖。這不是每張檔案都硬改為 600×840。', '',
        '六個抽卡／卡冊入口各嵌入完整 63 卡、71 個圖層；team 嵌入其既有 24 卡、28 個圖層。共 **454 個引用**逐一驗 SHA-256、data URI 完整相等，以及解碼 RGBA 完全相等，全部通過。解碼像素差為 0。這項資產檢查也已接入正式判定器，缺證據或與現有產物不符會 FAIL。', '',
        '[逐入口原始資料](shots/identical/identity.json)。下表「六入口」表示 gacha、gacha-standalone、gacha-test、gacha-test-standalone、pool、pool-standalone；加 team 者七入口共用。', '',
        '| 卡／圖層鍵 | 尺寸 | SHA-256（編碼 bytes） | 共用入口 |','|---|---|---|---|']
    team={r['key'] for r in identity['team']}
    for r in identity['pool']:
        lines.append(f"| {r['card']} / {r['key']} | {r['size'][0]}×{r['size'][1]} | `{r['sha256']}` | 六入口"+('＋team' if r['key'] in team else '')+' |')
    lines += ['', '## 2. 像素結果與完整採集', '',
        '受控卡寬 260 CSS px、DPR 2，裁圖 520×728。每一個卡型／viewport 先做七入口各三次獨立程序截圖的重現性檢查，再做跨入口比較；來源產物與採集工具 SHA-256 必須相符。原有門檻保持：重現性 mean <1.0；跨入口 mean <1.0、差值 >32 的像素比例 <1%、亮度標準差 >8。沒有事後對位。', '',
        '| viewport | 入口 | depth / rocketdog mean | framed / chaichai mean | flat / mieshi mean |','|---|---|---:|---:|---:|']
    missing=[]
    all_pixels=[]
    for vp in ['1440x1200','1024x900','390x844']:
        captures={}
        for card in ['rocketdog','chaichai','mieshi']:
            p=OUT/'controlled'/vp/(card+'-capture.json')
            captures[card]=read(p) if p.exists() else {}
            all_pixels.extend(captures[card].get('pixelComparison',{}).get('results',{}).values())
            if not p.exists():missing.append(f'{vp}/{card} pixel capture')
        if vp!='1440x1200':
            lines += ['| viewport | entry | depth mean | framed mean | flat mean |','|---|---|---:|---:|---:|']
        for entry in identity:
            cells=[]
            for card,c in captures.items():
                v=c.get('pixelComparison',{}).get('results',{}).get(entry)
                cells.append(f"{v['mean']:.6f}"+(' FAIL' if not v['pass'] else '') if v else '未達成、未宣稱')
            lines.append('| '+vp+' | '+entry+' | '+' | '.join(cells)+' |')
        lines += ['', '並排截圖：'+ '、'.join(f'[{card}](shots/identical/controlled/{vp}/{card}-all-entries-260px.png)' for card in captures), '']
    if len(all_pixels)==63:
        gates=[read(p) for p in (OUT/'determinism').glob('*/*-result.json')]
        pairs=[pair for g in gates for entry in g['entries'].values() for pair in entry['pairs']]
        lines += [f"跨入口結果：{sum(r['pass'] for r in all_pixels)}/63 通過；最大 mean={max(r['mean'] for r in all_pixels):.6f}，最大單通道差={max(r['max'] for r in all_pixels)}，最大 >32 比例={max(r['fractionOver32'] for r in all_pixels):.6%}，最低亮度標準差={min(r['luminanceStandardDeviation'] for r in all_pixels):.6f}。", '',
            f"重現性：{sum(g['pass'] for g in gates)}/{len(gates)} 個 gate 通過，{len(pairs)} 次兩兩比較，最大 mean={max(p['mean'] for p in pairs):.6f}、最大單通道差={max(p['max'] for p in pairs)}。", '']
    lines += ['完整採集：[collection.log](shots/identical/collection.log)；正式判定：[report.log](shots/identical/report.log)；元件檢查：[assets.log](shots/identical/assets.log)；反例：[sabotage.log](shots/identical/sabotage.log)。', '',
        '本輪重新完整採集七入口 × 三 viewport，共 1,920 筆卡紀錄、3,840 個字型樣本；非預期 fallback 0、頁面錯誤 0。正式判定 exit 0：同尺寸屬性差異 0、幾何差異 0；元件工具 exit 0：960 次比對、差異 0。原始 rarityRange 高度跨入口最大差為 0。詳見 [採集統計](shots/identical/collection-summary.json)。所有 21 張原生截圖位於 `shots/parity/shots/identical/<entry>/<viewport>.png`，其路徑與雜湊綁在完整採集檔。這次完整採集取代先前 scope3-final 的完成度疑義，沒有覆寫歷史證據。', '',
        '量測精度修正：所有入口本來都走同一個 `range()`，兩端都有 `toFixed(3)`，並非一端兩位、一端三位。現在兩端都直接保留瀏覽器原始 Range 寬高，移除毫像素四捨五入，沒有增加容差。現存上一輪壓縮採集檔未重現簡報提及的 17.710／17.711 差異（見 [舊資料掃描](shots/identical/rounding-before.json)），因此未宣稱已定位那一筆舊失敗的原始觸發過程。', '',
        '新增反例把同張圖編成 PNG，確認 RGBA 完全相同後改動編碼 SHA；正式判定器仍必須拒收。另有移除資產同一性證據的反例。', '',
        '反例實測 **56/56 通過**：clean exit 0，56 個反例均 exit 1 且有 FAIL 斷言，包含「不同編碼但像素完全相同」與缺少資產同一性證據。原始輸入測試前後 SHA 不變。[機讀摘要](shots/identical/sabotage/sabotage-summary-scope3.json)。完整採集壓縮成 [parity-identical.json.gz](shots/parity/parity-identical.json.gz)：173,747,406 → 6,151,768 bytes，已驗證解壓逐位元相同；[壓縮證據](shots/identical/compression.json)。', '',
        '## 3. 體積', '',
        '唯一調整的預算是 map20：6,000,000 → 20,000,000 bytes。理由是容納共用 lossless 卡圖與 quality 94 地形，不再因 6 MB 腳本預算拒收同一份卡圖。註解、上下限檢查與 build.json 均記錄新值。', '',
        '| 產物 | 修改前 bytes | 現在 bytes | 舊上限 | 新上限 |','|---|---:|---:|---:|---:|']
    for e,r in read(OUT/'sizes.json').items():
        lines.append(f"| {r['file']} | {r.get('oldBytes','—')} | {r['bytes']} | {r['oldLimit'] or '無'} | {r['newLimit'] or '無'} |")
    lines += ['', '地形 quality **94 → 94，沒有變好也沒有降級**。map20 實際 11,679,652 bytes；[建置證據](shots/identical/map-build/build.json)。pool 與兩個 gacha standalone 建置器原本沒有體積 gate；demo-standalone 的 15 MiB gate 原封不動，demo 僅按規定順序重建，未納入七入口驗收。地圖 template、版面、導覽、關卡區未改。', '',
        '依 scope3 報告的十步順序建置全部成功；權威資產產生已納入第一步 update_demo_data.py。最後一步使用 `python build_map20.py --evidence-dir ../../docs/clicker/shots/identical/map-build`，避免覆寫歷史證據。', '',
        '在 `_art/holo-test` 的驗收重跑指令（每步檢查 exit code）：', '',
        '```powershell',
        'python check_card_identity.py',
        'python check_card_parity.py --label identical --fixture auto --shots --entries gacha,gacha-standalone,gacha-test,gacha-test-standalone,pool,pool-standalone,team',
        'python check_card_parity_report.py --input ../../docs/clicker/shots/parity/parity-identical.json --reference gacha-test',
        'python check_card_assets.py --input ../../docs/clicker/shots/parity/parity-identical.json --output ../../docs/clicker/shots/identical/asset-layers.json',
        'python check_card_parity_sabotage.py --input ../../docs/clicker/shots/parity/parity-identical.json --out ../../docs/clicker/shots/identical/sabotage',
        'python run_identical_pixels.py',
        '# 等其他瀏覽器驗收結束後再測效能',
        'python measure_identical_decode.py',
        '```', '',
        'JSON 路徑不存在時，判定／元件／反例工具會自動讀取同名 .json.gz。像素 runner 對每組呼叫 check_shot_determinism.py 與 shoot_card_parity_samesize.py；只有來源、工具、viewport、card 與七入口都吻合且已通過的 gate 才可重用。', '',
        '## 4. 延後 decode 的效能實驗與結論', '',
        '**不採用。** 單檔 bytes 已內嵌，延後 decode 不會減少檔案大小。候選只在設定同一個 src 前加 `loading=lazy`／`decoding=async`，沒有縮圖、沒有 hover 換高清；未寫入產品。', '',
        '每個 viewport 做 baseline／候選各三次新 headless Chromium 程序，DPR 1，交錯順序，等待其他驗收程序結束後才測。首次卡圖 paint 取 Element Timing observer 第一次報告卡內元素 renderTime；另列 DOM ready：rAF 中可見卡圖均 complete 且 naturalWidth>0、字型已載入的第一個時刻。兩者都不是螢幕物理呈現時間。待機 fps 取最後三秒 rAF。JS heap 取 Performance.getMetrics；影像記憶體取 detailed memory dump 的 `cc/image_memory` size（避免加總其子項造成重複）；另記 unique complete 圖片 width×height×4 的 RGBA 估算，兩者不可混稱。', '']
    perf=OUT/'performance/result.json'
    if perf.exists():
        runs=read(perf)['runs']
        lines += ['三次中位數：', '', '| viewport | 版本 | 首次卡圖 paint ms | DOM ready ms | 待機 fps | JS heap bytes | compositor image memory bytes | RGBA 估算 bytes |','|---|---|---:|---:|---:|---:|---:|---:|']
        for vp in ['1440x1200','390x844']:
            for mode in [False,True]:
                rows=[r for r in runs if r['viewport']==vp and r['candidate']==mode]
                if len(rows)!=3:missing.append(f'{vp}/{mode} performance runs');continue
                med=lambda k:statistics.median(r[k] for r in rows)
                memory=statistics.median(r['compositorImageMemory']['bytes'] for r in rows)
                paint=f"{med('firstCardPaintMs'):.1f}" if all(r.get('firstCardPaintMs') is not None for r in rows) else '未量得'
                lines.append(f"| {vp} | {'候選' if mode else 'baseline'} | {paint} | {med('firstVisibleMs'):.1f} | {med('idleFps'):.2f} | {med('jsHeapBytes'):.0f} | {memory:.0f} | {med('decodedRGBABytes'):.0f} |")
        lines += ['', f"12 次執行中：來源改變 frame 合計 {sum(r['changedSourceFrames'] for r in runs)}；非零內在尺寸先小後大 frame 合計 {sum(r.get('lowResolutionIntermediateFrames',0) for r in runs)}；首次 DOM ready 之後仍有可見未完成圖片的 frame 合計 {sum(r.get('pendingAfterFirstVisibleFrames',0) for r in runs)}。"]
        lines += ['', '不採用的依據：兩個尺寸的待機均約 60 fps，實測 compositor 影像記憶體沒有下降，JS heap 中位數差僅極小幅度；初次 paint 的差異如表，不能把較少的 complete 圖片／RGBA 估算當作已省下實際影像 cache。這次沒有證明 hover-only decode 的待機或影像 cache 收益，也沒有實體呈現逐幀無閃爍的證據，因此不把候選寫入產品。']
        lines += ['', '[全部次數數值](shots/identical/performance/result.json)；同目錄每次 JSON 保存逐 rAF 的尺寸、complete、source 是否改變與可見未完成數。PNG 為完成後畫面。']
    else:missing.append('performance experiment');lines+=['效能數據未達成、未宣稱。']
    lines += ['', '## 5. 未達成、未宣稱', '',
        '- 資產解碼像素完全相同，不等於整張瀏覽器合成畫面逐像素必為 0；上表保留真實殘差。',
        '- 去背圖維持原始比例與 600×840 bounding box；未宣稱每個圖層的實際尺寸都是 600×840。',
        '- 不宣稱 hover-only decode 已能省效能；未採用任何延後解碼產品改動。rAF/DOM 逐幀資料能檢查來源與內在尺寸，不能證明每個實體顯示器／GPU 呈現幀完全無閃爍。',
        '- 不宣稱全卡池逐卡瀏覽器像素驗證：渲染像素只驗三代表卡型；資產 bytes／解碼像素則覆蓋七入口全部內嵌卡圖。',
        '- demo、末世地圖卡冊設計、禮物卡、新卡及舊範圍外回歸項目未納入本輪。']
    for item in missing:lines.append('- 未達成、未宣稱：'+item)
    (DOC/'REPORT-2026-09-12-identical.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

if __name__=='__main__':main()
