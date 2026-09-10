# -*- coding: utf-8 -*-
"""截圖可重現性：同一個入口、同一支腳本連跑兩次，像素應該要一樣。

2026-09-11 實測不是——所以在修好之前，**入口之間的像素比對不是有效訊號**，
因為量測工具自己的雜訊就蓋過了要找的差異。載重的證據是
`check_card_assets.py` 的層樣式與幾何比對（那個是決定性的）。

用法：
    python check_shot_determinism.py [--card rocketdog] [--entry demo] [--runs 2]
"""
from __future__ import annotations
import argparse, subprocess, sys, io, shutil
from pathlib import Path

_OUT = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stdout = _OUT
HERE = Path(__file__).resolve().parent
SHOTS = HERE.parent.parent / 'docs' / 'clicker' / 'shots' / 'parity' / 'samesize'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--card', default='rocketdog')
    ap.add_argument('--entry', default='demo')
    ap.add_argument('--runs', type=int, default=2)
    ap.add_argument('--width', type=int, default=260)
    args = ap.parse_args()
    from PIL import Image
    import numpy as np

    target = SHOTS / ('%s-%s-%dpx.png' % (args.card, args.entry, args.width))
    keep = []
    for i in range(args.runs):
        subprocess.run([sys.executable, str(HERE / 'shoot_card_parity_samesize.py'),
                        '--card', args.card, '--width', str(args.width)],
                       capture_output=True)
        if not target.exists():
            print('拍不到 %s' % target); return 2
        p = SHOTS / ('determinism-%s-run%d.png' % (args.entry, i))
        shutil.copy(target, p)
        keep.append(p)

    a = np.asarray(Image.open(keep[0]).convert('RGB')).astype(int)
    worst = 0.0
    for p in keep[1:]:
        b = np.asarray(Image.open(p).convert('RGB')).astype(int)
        if b.shape != a.shape:
            print('尺寸不同：%s' % p.name); return 1
        d = np.abs(a - b).max(axis=2)
        worst = max(worst, d.mean())
        print('%s vs %s：mean %.2f  max %d  >100 的像素 %.1f%%'
              % (keep[0].name, p.name, d.mean(), d.max(), (d > 100).mean() * 100))
    ok = worst < 1.0
    print('\n%s 截圖可重現性：%s（門檻 mean < 1.0）'
          % ('PASS' if ok else 'FAIL', '穩定' if ok else '不穩定，像素比對在修好前不是有效訊號'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
