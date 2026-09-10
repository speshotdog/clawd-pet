# -*- coding: utf-8 -*-
"""從重複量測的參考樣本算出幾何門檻（METHOD-card-face.md 的做法）。

工法要求：先量一個明顯合格的樣本、看它在同環境重複量測下的波動，再往外留餘裕當上下限，
不可以憑感覺訂數字。這支腳本吃 N 份同一版本、同環境的 parity JSON（參考入口），
輸出每個指標的「樣本數／原始範圍／重複量測波動／量化誤差／上下限／餘裕理由」。

用法：
    python write_card_parity_calibration.py --inputs a.json b.json c.json \
        --reference gacha-test --out ../../docs/clicker/shots/parity/calibration.json
"""
from __future__ import annotations
import argparse, json, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# 幾何為什麼用「投影後的卡寬」當分母：
#   Range 的矩形是投影後（3D／選取放大）的座標，卡片本身也可能被 1.04 倍選取放大。
#   拿未變形 content-box 當分母會把那 4% 算進指標，讓「被選取的那張卡」假性超標。
#   縮放規則（fit/refit）該用未變形寬度，那條另外由字級契約驗；投影量對投影量才是同類比較。
#   renderScale = 投影寬 / 未變形寬，單獨列成指標，讓放大本身也看得見、也擋得住。
# 指標：名稱 -> (取原始 px 的函式, 是否要除以投影卡寬)
def _px(c, v):
    """收集端已經除過未變形卡寬的量，先乘回去還原成 px。"""
    return None if v is None else v * (c.get('contentWidth') or 0)

METRICS = {
    'renderScale':        (lambda c: ((c.get('box') or {}).get('w') or 0) / (c.get('contentWidth') or 1), False),
    'rarityRange.w':      (lambda c: (c.get('rarityRange') or {}).get('w'), True),
    'rarityRange.h':      (lambda c: (c.get('rarityRange') or {}).get('h'), True),
    'lineGap':            (lambda c: _px(c, c.get('lineGap')), True),
    'rarityClear.left':   (lambda c: _px(c, (c.get('rarityClear') or {}).get('left')), True),
    'rarityClear.right':  (lambda c: _px(c, (c.get('rarityClear') or {}).get('right')), True),
}

# 量化誤差：字級存進 CSS 變數時是 toFixed(2)，量到的長度再經瀏覽器 subpixel 捨入。
# 以 0.01px 的字級量化 + 0.5px 的版面量化，換算成「除以卡寬」之後的最壞值另計。
LAYOUT_QUANT_PX = 0.5


def collect(paths, reference):
    """runs[i][(viewport,id,role)][metric] = value"""
    runs = []
    for p in paths:
        data = json.loads(Path(p).read_text(encoding='utf-8'))
        run = {}
        e = data['entries'].get(reference, {})
        for vp, rec in e.get('viewports', {}).items():
            if not isinstance(rec, dict) or rec.get('error'):
                continue
            for c in rec.get('cards', []):
                if c.get('error') or not c.get('visible') or not c.get('rarityRange'):
                    continue
                cw = (c.get('box') or {}).get('w') or 0   # 投影後的卡寬
                if not cw or not c.get('contentWidth'):
                    continue
                k = (vp, c['id'], c.get('role'))
                vals = {}
                for name, (get, scale) in METRICS.items():
                    v = get(c)
                    if v is None:
                        continue
                    vals[name] = v / cw if scale else v
                run[k] = vals
        runs.append(run)
    return runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--inputs', nargs='+', required=True)
    ap.add_argument('--reference', default='gacha-test')
    ap.add_argument('--out', required=True)
    ap.add_argument('--headroom', type=float, default=0.20,
                    help='在觀測範圍外再留的餘裕比例（預設 20%%，沿用 METHOD 的做法）')
    args = ap.parse_args()

    runs = collect(args.inputs, args.reference)
    if len(runs) < 2:
        print('!! 至少要兩份量測才能看波動'); return 2
    common = set(runs[0])
    for r in runs[1:]:
        common &= set(r)
    print('參考入口 %s：%d 份量測、共同樣本 %d 個(viewport,卡,角色)' %
          (args.reference, len(runs), len(common)))

    out = {'reference': args.reference, 'runs': [str(p) for p in args.inputs],
           'sampleCount': len(common), 'headroom': args.headroom, 'metrics': {}}
    print('\n%-20s %6s %12s %12s %12s %12s %12s' %
          ('指標', '樣本', '最小', '最大', '重複波動', '下限', '上限'))
    for name in METRICS:
        per_sample = {}
        for k in common:
            vs = [r[k].get(name) for r in runs if r[k].get(name) is not None]
            if len(vs) == len(runs):
                per_sample[k] = vs
        if not per_sample:
            continue
        allv = [v for vs in per_sample.values() for v in vs]
        # 重複量測波動：同一個樣本在多次量測之間的最大差
        jitter = max(max(vs) - min(vs) for vs in per_sample.values())
        lo, hi = min(allv), max(allv)
        span = hi - lo
        # 餘裕 = max(重複波動, 觀測範圍 × headroom, 版面量化誤差換算)
        margin = max(jitter, span * args.headroom, LAYOUT_QUANT_PX / 1440)
        out['metrics'][name] = {
            'samples': len(per_sample), 'observedMin': lo, 'observedMax': hi,
            'repeatJitter': jitter, 'margin': margin,
            'min': lo - margin, 'max': hi + margin,
            'rationale': ('下限＝觀測最小 − 餘裕、上限＝觀測最大 + 餘裕；'
                          '餘裕取「重複量測波動 %.6f」「觀測範圍 %.6f × %.0f%%」'
                          '「版面量化 %.1fpx ÷ 1440」三者最大值'
                          % (jitter, span, args.headroom * 100, LAYOUT_QUANT_PX)),
        }
        print('%-20s %6d %12.6f %12.6f %12.6f %12.6f %12.6f' %
              (name, len(per_sample), lo, hi, jitter, lo - margin, hi + margin))

    Path(args.out).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\n寫出 %s' % args.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
