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
      holo.css 的 @font-face 直接指這兩個檔（卡面在 shadow root 裡也吃得到）。
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

NON_ASCII = '[^' + chr(0) + '-' + chr(0x7f) + ']'   # 非 ASCII 的字（用 chr 組，避免跳脫字元在編輯時被吃掉）

def collect_chars():
    chars = set(ASCII)
    # ① 末世卡池的卡名（src/apoc/pool.js 是 window.ApocPool=[...] 的 JSON）
    pool = (APOC / 'pool.js').read_text(encoding='utf-8')
    chars |= set(re.findall(r'[^\x00-\x7f]', pool))
    # ② 1.0 卡池的卡名（收藏卡在兩個世界都用精裝卡面了）
    for f in ('gacha-pool.js', 'clicker-balance.js'):
        p = SRC / f
        if p.exists(): chars |= set(re.findall(r'[^\x00-\x7f]', p.read_text(encoding='utf-8')))
    # ③ 收藏卡（魔花少女）的卡名與「特殊」這個階級標籤。
    # ⚠ 第十二輪把獨立頁退役之後，這些字只存在 collect.js／collect-face.js／holo-special.css 裡，
    #   漏掉這一條，卡面上的「魔花少女」「特殊」就會掉進 fallback 字型（字型不一致，肉眼看得出來）。
    for f in ('collect.js', 'collect-face.js', 'holo-special.css'):
        p = APOC / f
        if p.exists(): chars |= set(re.findall(NON_ASCII, p.read_text(encoding='utf-8')))
    # ④ 精裝頁自己的文字（卡框上的稀有度、標語…）
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
        # 卡面上一定會出現的字，缺一個就是整排掉 fallback（第十二輪新增這道明確檢查）
        must = '魔花少女特殊神話傳說史詩精良'
        miss = [c for c in must if ord(c) not in cm]
        if miss: bad.append((p.name, '卡面必備字缺漏', ''.join(miss)))
    return bad

# ⚠ 第十二輪拿掉了 relink_inline()：收藏卡已經改成原生卡面（ClickerHolo → HoloCardFace），
#   src/apoc/mohuashaonv.html（10.5 MB 的獨立頁）連同它內嵌的那兩個空字型一起退役了。
#   字型子集本身還在用——holo.css 的 @font-face 指的就是 fonts/holo-*.woff2。

if __name__ == '__main__':
    chars = collect_chars()
    print(f'字集 {len(chars)} 字')
    FONTS.mkdir(parents=True, exist_ok=True)
    paths = build(chars)
    bad = verify(paths, chars)
    if bad:
        print('✗ 子集不完整：', bad); sys.exit(1)
    print('✓ 字型子集完成')
