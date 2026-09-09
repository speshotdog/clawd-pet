# fx/ — 第二十八輪演出素材（Claude 產，2026-09-09）

| 檔 | 尺寸 | 來源 | 大小 |
|---|---|---|---|
| `summon-night.webp` | 1536×1024 RGB | Codex imagegen（無文字／UI），Pillow q82 | 63KB |
| `foil-pack.webp` | 700×980 RGBA | 鋁箔底材＋印刷貼圖（寶可夢補充包做法）：`make_print_layer.py` 產 `pack-print.png`（navy 底＋珍珍主視覺＋標題，封口與外緣留透明），再由 `build_foil_pack.py` 在 Blender 4.5.13 Cycles 鋪在鋁箔上（印刷區 metallic 0.25、未印刷區鋁箔） | 103KB |
| `foil-tear.webp` | 1024×256 RGBA | 同上，同一支腳本 | 32KB |

重渲：`blender -b -P build_foil_pack.py -- <out_dir>`（可攜版 Blender 在 `D:\claude\holo-pack\tools\`）。
中立銀白，不帶稀有度色——使用者裁決「不預告任何品質」。
