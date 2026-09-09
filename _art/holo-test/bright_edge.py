# -*- coding: utf-8 -*-
"""亮邊判準：唯一一份。

這條門檻本來是抓「去背沒剝乾淨的白色毛邊」。第三十二輪它把咩噗熊判成 10.93%
（門檻 1%），但實際去看那 549 個超標像素——**544 個是角色自己的粉紅填色**，
而且飽和度緊緊聚在 0.208～0.231，跟真正的白毛邊（飽和度 0.000）差了一個數量級。
再剝下去就是在侵蝕原畫，所以 2026-09-09 使用者裁決：**改判準不改圖**。

新判準在原本的「四鄰有透明的邊界像素 且 min(R,G,B) > 165」之外，再要求
**飽和度 < 0.12**。門檻取 0.12 的理由（實測 art/card-*.png）：

| 卡 | 舊亮邊 | 那些像素的飽和度 | 新亮邊 |
|---|---:|---|---:|
| miepuxiong | 549 (10.930%) | 中位 0.208、p10 0.208、max 0.231 | 7 (0.139%) |
| pufayueyue | 2 (0.037%) | 0.000（真的是白邊） | 2 (0.037%) |
| 其餘 framed | 0 | — | 0 |

也就是 0.12 在兩群之間，既濾掉飽和粉紅、又不會對真正的白毛邊變瞎。

第四十輪已完成另一半：`prepare_round32.py` 原尺寸與縮放後的 defringe 都使用
`sat_ok()`，並從 4.0 原圖重跑全部 framed（含流浪玥手），恢復飽和填色的保護。
實測與重跑入口見 `prepare_round40.py`、`docs/clicker/shots/round40/`。
"""
import numpy as np
from scipy import ndimage as nd

CROSS = nd.generate_binary_structure(2, 1)
MIN_CHANNEL = 165          # 「近白」：三個通道都要夠亮
MAX_SAT = 0.12             # 「低飽和」：飽和的填色不算白毛邊


def boundary(mask):
    return mask & ~nd.binary_erosion(mask, structure=CROSS, border_value=0)


def saturation(rgb):
    mx = rgb.max(2).astype(np.float32)
    mn = rgb.min(2).astype(np.float32)
    return np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx > 0)


def sat_ok(rgb):
    """要被當成「白毛邊」必須同時近白且低飽和。defringe 與量測共用這一條。"""
    return (rgb.min(2) > MIN_CHANNEL) & (saturation(rgb) < MAX_SAT)


def measure(rgba):
    """rgba: HxWx4 的 uint8 陣列。回傳新舊兩個數字，好對照。"""
    rgb = rgba[:, :, :3]
    edge = boundary(rgba[:, :, 3] > 0)
    total = int(edge.sum())
    old = int(((rgb.min(2) > MIN_CHANNEL) & edge).sum())
    new = int((sat_ok(rgb) & edge).sum())
    sat = saturation(rgb)[(rgb.min(2) > MIN_CHANNEL) & edge]
    return {
        'boundary_pixels': total,
        'bright_boundary_pixels': new,
        'bright_boundary_ratio': (new / total) if total else 0.0,
        'legacy_bright_pixels': old,
        'legacy_bright_ratio': (old / total) if total else 0.0,
        'excluded_saturated_pixels': old - new,
        'excluded_sat_median': float(np.median(sat)) if old else None,
        'excluded_sat_max': float(sat.max()) if old else None,
    }
