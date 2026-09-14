# -*- coding: utf-8 -*-
"""demo.html 內嵌字型的子集（round 4）。

⚠ 原本的寫法是：

    opts = subset.Options(); opts.text = chars
    font = subset.load_font(str(source), opts)
    subset.Subsetter(opts).subset(font)          # ← 少了 populate()

**只設 `Options.text` 而沒有呼叫 `subsetter.populate(text=...)`，fontTools 會安靜產出一個空字型**
（996 bytes、1 個 glyph、cmap 0 個碼位），不報錯、不警告。結果 demo.html 整頁退回
Arial／微軟正黑，卡上的字用的根本不是設計時的字型。
所以這支現在：populate() → 子集 → 檔案大小下限 → 卡面必備字檢查，任何一關不過就 exit(1)。

用法：python _art/holo-test/build_round4_fonts.py
"""
from pathlib import Path
import base64, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).parent
html = (root / 'demo.html').read_bytes().decode('utf-8')

# 卡面上一定會出現的字：demo.html 裡不一定全有（「魔」「少」「殊」就沒有），
# 但收藏卡的「魔花少女」「特殊」要是掉一個字就整排退回 fallback 字型，肉眼看得出來。
MUST = '魔花少女特殊神話傳說史詩精良'
MIN_BYTES = 100 * 1024      # 空字型是 996 bytes；低於這個一定是子集壞了
MAX_BYTES = 600 * 1024

chars = ''.join(sorted(set(
    ''.join(re.findall(r'[^\x00-\x7f]', html))
    + '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /·°↻'
    + MUST)))
text = root / 'round4-font-chars.txt'
text.write_text(chars, encoding='utf-8')

fonts = {
    'ROUND4_NOTO_SANS_DATA': Path(r'C:\Windows\Fonts\NotoSansTC-VF.ttf'),
    'ROUND4_NOTO_SERIF_DATA': Path(r'C:\Windows\Fonts\NotoSerifTC-VF.ttf'),
}


def cmap_of(path):
    f = TTFont(str(path))
    cm = set()
    for t in f['cmap'].tables:
        cm |= set(t.cmap.keys())
    f.close()
    return cm


bad = []
for marker, source in fonts.items():
    if not source.exists():
        print(f'x 找不到字型來源 {source}')
        sys.exit(1)
    out = root / (marker.lower() + '.woff2')
    opts = subset.Options()
    opts.flavor = 'woff2'; opts.text = chars; opts.layout_features = ['*']; opts.retain_gids = False
    font = subset.load_font(str(source), opts)
    subsetter = subset.Subsetter(opts)
    subsetter.populate(text=chars)      # ⚠ 就是這一行。少了它 = 空字型，而且不會報錯
    subsetter.subset(font)
    subset.save_font(font, str(out), opts)
    font.close()

    size = out.stat().st_size
    cm = cmap_of(out)
    src_cm = cmap_of(source)
    dropped = [c for c in chars if ord(c) not in cm and ord(c) in src_cm]   # 子集弄丟的＝真的壞了
    absent = [c for c in chars if ord(c) not in cm and ord(c) not in src_cm]  # 原始字型本來就沒有（↻ 這種）
    miss = [c for c in MUST if ord(c) not in cm]
    print(f'  {out.name}  {size/1024:.0f} KB；{len(cm)} 個碼位；'
          f'子集弄丟 {len(dropped)} 字 {"".join(dropped[:10])}；'
          f'原始字型本來就沒有 {len(absent)} 字 {"".join(absent[:10])}')
    if not (MIN_BYTES <= size <= MAX_BYTES):
        bad.append((out.name, f'檔案大小 {size} bytes 不在 {MIN_BYTES}~{MAX_BYTES} 之間'))
    if dropped:
        bad.append((out.name, '子集弄丟字', ''.join(dropped[:10])))
    if miss:
        bad.append((out.name, '卡面必備字缺漏', ''.join(miss)))

    blob = base64.b64encode(out.read_bytes()).decode('ascii')
    family = 'Holo Noto Sans' if 'SANS' in marker else 'Holo Noto Serif'
    # 第一次跑是替換 marker，之後 marker 已經被 base64 蓋掉了，要改換掉既有的那一串
    pattern = r'(@font-face\{font-family:"' + family + r'";src:url\("data:font/woff2;base64,)[^"]+'
    html, count = re.subn(pattern, lambda m: m[1] + blob, html)
    if not count:
        if marker not in html:
            print(f'x demo.html 裡找不到 {family} 的 @font-face，也沒有 {marker}')
            sys.exit(1)
        html = html.replace(marker, blob)
    print(f'  {source.name} -> {len(blob)} base64 chars 寫進 demo.html')

if bad:
    print('x 子集不完整：', bad)
    sys.exit(1)

(root / 'demo.html').write_bytes(html.encode('utf-8'))
print('glyphs:', len(chars))
print('v 字型子集完成')
