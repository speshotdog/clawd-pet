# -*- coding: utf-8 -*-
"""精裝卡面的字型子集（2026-09-14）。

## 為什麼要有這支

上游 `_art/holo-test/build_round4_fonts.py` 是這樣寫的：

    opts = subset.Options(); opts.text = chars
    font = subset.load_font(str(source), opts)
    subset.Subsetter(opts).subset(font)          # ← 少了 populate()

**只設 `Options.text` 而沒有呼叫 `subsetter.populate(text=...)`，fontTools 會安靜產出一個空字型**
（996 bytes、1 個 glyph、cmap 0 個碼位），不報錯、不警告。結果精裝頁整頁退回
Arial／微軟正黑，卡上的「魔花少女」用的根本不是設計時的字型。
`src/apoc/fonts/holo-*.woff2` 則是另一次比較早的子集，有 755 個碼位，
但字集是照當時的頁面湊的——**缺「魔」「少」「殊」**，收藏卡的名字一樣掉字。

用法：python tools/apoc/build_fonts.py
產出：src/apoc/fonts/holo-0.woff2（Sans）、holo-1.woff2（Serif），
      並把 src/apoc/mohuashaonv.html 裡的內嵌 data URI 換成參照這兩個檔。
"""
import base64, io, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
APOC = SRC / 'apoc'
FONTS = APOC / 'fonts'

SOURCES = [('holo-0.woff2', Path(r'C:\Windows\Fonts\NotoSansTC-VF.ttf')),
           ('holo-1.woff2', Path(r'C:\Windows\Fonts\NotoSerifTC-VF.ttf'))]

# 字集：卡池的所有卡名＋稀有度字樣＋精裝頁自己的文字，寧可多給不要少給。
ASCII = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /·°↻★☆＋+-−×.,:;!?()[]％%\'"、。《》「」…—'

def collect_chars():
    chars = set(ASCII)
    # ① 末世卡池的卡名（src/apoc/pool.js 是 window.ApocPool=[...] 的 JSON）
    pool = (APOC / 'pool.js').read_text(encoding='utf-8')
    chars |= set(re.findall(r'[^\x00-\x7f]', pool))
    # ② 1.0 卡池的卡名（收藏卡在兩個世界都用精裝卡面了）
    for f in ('gacha-pool.js', 'clicker-balance.js'):
        p = SRC / f
        if p.exists(): chars |= set(re.findall(r'[^\x00-\x7f]', p.read_text(encoding='utf-8')))
    # ③ 精裝頁自己的文字（卡框上的稀有度、標語…）
    for p in list(APOC.glob('*.html')) + [APOC / 'holo.css']:
        if p.exists(): chars |= set(re.findall(r'[^\x00-\x7f]', p.read_text(encoding='utf-8')))
    # 控制字元與代理對不要進去
    chars = {c for c in chars if c.isprintable() and not (0xD800 <= ord(c) <= 0xDFFF)}
    return ''.join(sorted(chars))

def build(chars):
    from fontTools import subset
    out = []
    for name, source in SOURCES:
        if not source.exists():
            print(f'✗ 找不到字型來源 {source}'); sys.exit(1)
        opts = subset.Options()
        opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.retain_gids = False
        opts.drop_tables += ['DSIG']
        font = subset.load_font(str(source), opts)
        sub = subset.Subsetter(opts)
        sub.populate(text=chars)          # ⚠ 就是這一行。少了它 = 空字型，而且不會報錯
        sub.subset(font)
        dest = FONTS / name
        subset.save_font(font, str(dest), opts)
        font.close()
        out.append(dest)
        print(f'  {name}  {dest.stat().st_size/1024:.0f} KB')
    return out

def source_cmap(path):
    from fontTools.ttLib import TTFont
    f = TTFont(str(path), fontNumber=0); cm = set()
    for t in f['cmap'].tables: cm |= set(t.cmap.keys())
    f.close(); return cm

def verify(paths, chars):
    """產完一定要驗：空字型的症狀就是「檔案在、頁面不報錯、但字全是 fallback」。
       ⚠ 要分辨兩種「缺字」——子集把它丟掉了（是 bug），或原始字型本來就沒有（沒救，也不是這裡的錯）。
       Noto Sans/Serif TC 沒有 ↻ ≒ 🌭 這類符號與 emoji，那是預期內的。"""
    from fontTools.ttLib import TTFont
    bad = []
    for (name, source), p in zip(SOURCES, paths):
        f = TTFont(str(p)); cm = set()
        for t in f['cmap'].tables: cm |= set(t.cmap.keys())
        f.close()
        src_cm = source_cmap(source)
        dropped = [c for c in chars if ord(c) not in cm and ord(c) in src_cm]      # 子集弄丟的＝真的壞了
        absent = [c for c in chars if ord(c) not in cm and ord(c) not in src_cm]   # 原始字型就沒有
        print(f'  {p.name}：{len(cm)} 個碼位；子集弄丟 {len(dropped)} 字 {"".join(dropped[:10])}'
              f'；原始字型本來就沒有 {len(absent)} 字 {"".join(absent[:10])}')
        if len(cm) < 100 or dropped: bad.append((p.name, len(cm), dropped[:10]))
    return bad

def relink_inline():
    """把 mohuashaonv.html 內嵌的 data URI 換成參照 fonts/ 底下的實體檔。
       那兩段 base64 就是上游沒 populate 產出的空字型，留著只會繼續蓋掉正確的字型。"""
    p = APOC / 'mohuashaonv.html'
    html = io.open(p, encoding='utf-8', newline='').read()
    n = 0
    for i, family in enumerate(['Holo Noto Sans', 'Holo Noto Serif']):
        pat = re.compile(r'(font-family:"' + re.escape(family) + r'";src:url\()"data:font/woff2;base64,[A-Za-z0-9+/=]+"')
        html, k = pat.subn(lambda m: m.group(1) + f'"fonts/holo-{i}.woff2"', html)
        n += k
    io.open(p, 'w', encoding='utf-8', newline='').write(html)
    print(f'  {p.name}：換掉 {n} 個內嵌字型 → fonts/holo-*.woff2')
    return n

if __name__ == '__main__':
    chars = collect_chars()
    print(f'字集 {len(chars)} 字')
    FONTS.mkdir(parents=True, exist_ok=True)
    paths = build(chars)
    bad = verify(paths, chars)
    relink_inline()
    if bad:
        print('✗ 子集不完整：', bad); sys.exit(1)
    print('✓ 字型子集完成')
