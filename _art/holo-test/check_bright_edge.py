# -*- coding: utf-8 -*-
"""亮邊驗收：從已入版的 art/card-*.png 直接量，不需要外部原圖。

第三十二輪這個數字只在 prepare_round32.py 產圖時算過一次，而那支腳本綁死
`C:\\Users\\ASUS User VII\\Desktop\\新卡\\4.0`，換一台機器就跑不動、也就無法複驗。
這支只吃版控裡的產物，所以任何一台機器都能重跑。

判準見 bright_edge.py（2026-09-09 使用者裁決：改判準不改圖）。

    PYTHONIOENCODING=utf-8 python check_bright_edge.py
"""
from pathlib import Path
import json, sys
import numpy as np
from PIL import Image

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from bright_edge import measure, MIN_CHANNEL, MAX_SAT
from pool_data import EXTRA_CARDS

THRESHOLD = 0.01           # 1%，第三十二輪簡報訂的，沒有放寬

# 範圍是第三十二輪新收的那批（EXTRA_CARDS）。原本 43 張卡池卡不在這條契約裡：
# 它們有的整張不透明（邊界就是畫面四邊，舊判準直接量到 100%），套這條門檻沒有意義。
rows, failed = [], []
for card in EXTRA_CARDS:
    if card['kind'] != 'framed':
        continue
    path = HERE / 'art' / card['file']
    if not path.exists():
        continue
    m = measure(np.array(Image.open(path).convert('RGBA')))
    rows.append({'id': card['id'], 'name': card['name'], 'file': card['file'], **m})
    if m['bright_boundary_ratio'] > THRESHOLD:
        failed.append(rows[-1])

rows.sort(key=lambda r: -r['legacy_bright_ratio'])
print('判準：邊界像素 且 min(R,G,B) > %d 且 飽和度 < %.2f' % (MIN_CHANNEL, MAX_SAT))
print('%-18s %8s %10s %10s %s' % ('id', '邊界', '舊判準', '新判準', '被排除的飽和像素'))
for r in rows:
    print('%-18s %8d %9.3f%% %9.3f%% %6d (飽和度中位 %s)' % (
        r['id'], r['boundary_pixels'], r['legacy_bright_ratio'] * 100,
        r['bright_boundary_ratio'] * 100, r['excluded_saturated_pixels'],
        '—' if r['excluded_sat_median'] is None else '%.3f' % r['excluded_sat_median']))
print('共 %d 張（第三十二輪 framed 批次），完整數字在 verification-bright-edge.json' % len(rows))

(HERE / 'verification-bright-edge.json').write_text(
    json.dumps({'threshold': THRESHOLD, 'min_channel': MIN_CHANNEL, 'max_sat': MAX_SAT,
                'cards': rows, 'failed': [r['id'] for r in failed]},
               ensure_ascii=False, indent=1), encoding='utf-8')

assert not failed, ['%s %.3f%%' % (r['id'], r['bright_boundary_ratio'] * 100) for r in failed]
print('OK ·', len(rows), '張全部 ≤ %.0f%%' % (THRESHOLD * 100))
