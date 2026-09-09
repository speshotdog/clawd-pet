# fx/ — 第二十八輪演出素材（Claude 產，2026-09-09）

| 檔 | 尺寸 | 來源 | 大小 |
|---|---|---|---|
| `summon-night.webp` | 1536×1024 RGB | Codex imagegen（無文字／UI），Pillow q82 | 63KB |
| `foil-pack.webp` | 700×980 RGBA | 滿版印刷＋鋁箔底材（參考寶可夢補充包，不照抄）：`pack-backdrop-source.png`（imagegen 鮮豔放射底，無文字）→ `make_print_layer.py` 疊珍珍主視覺／左上品牌膠囊／底部厚重貼標成 `pack-print.png`（封口上 4%／下 3% 留透明）→ `build_foil_pack.py` 在 Blender 鋪上鋁箔（印刷區 metallic 0＋coat 亮膜，封口鋁箔壓紋） | ≤140KB |
| `foil-tear.webp` | 1024×256 RGBA | 同上，同一支腳本 | 32KB |

重渲：`blender -b -P build_foil_pack.py -- <out_dir>`（可攜版 Blender 在 `D:\claude\holo-pack\tools\`）。
中立銀白，不帶稀有度色——使用者裁決「不預告任何品質」。
