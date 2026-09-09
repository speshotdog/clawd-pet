# fx/ — 第二十八輪演出素材（Claude 產，2026-09-09）

| 檔 | 尺寸 | 來源 | 大小 |
|---|---|---|---|
| `summon-night.webp` | 1536×1024 RGB | Codex imagegen（無文字／UI），Pillow q82 | 63KB |
| `foil-pack.webp` | 700×980 RGBA | Blender 4.5.13 Cycles 靜幀，`build_foil_pack.py`（材質數值取自 holo-card-studio，MIT） | 128KB |
| `foil-tear.webp` | 1024×256 RGBA | 同上，同一支腳本 | 32KB |

重渲：`blender -b -P build_foil_pack.py -- <out_dir>`（可攜版 Blender 在 `D:\claude\holo-pack\tools\`）。
中立銀白，不帶稀有度色——使用者裁決「不預告任何品質」。
