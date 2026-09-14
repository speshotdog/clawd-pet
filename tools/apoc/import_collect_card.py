# -*- coding: utf-8 -*-
"""把收藏卡（魔花少女）的最新版精裝頁匯進遊戲。

卡的本體是在 `holo-gift` 那條線上做的（`_art/holo-test/gift-mohuashaonv.html`），
遊戲這邊只是拿來用。搬過來要補兩件那邊沒有、只有遊戲需要的東西：

1. **嵌入模式 `?embed=1`**：卡冊是用 iframe 嵌這一頁當卡面，要把標題、說明、頁面留白藏掉，
   只留卡本身。原始頁沒有這段（它是給人單獨開來看的）。
2. **字型換成參照實體檔**：原始頁內嵌的兩個 woff2 是**空字型**（996／984 bytes，
   上游的子集腳本少呼叫 populate()，見 tools/apoc/build_fonts.py 的說明）。
   留著會蓋掉正確的字型，所以匯進來之後一定要跑 build_fonts.py 把它們換掉。

用法：
    python tools/apoc/import_collect_card.py [來源.html]
    python tools/apoc/build_fonts.py            # ← 接著一定要跑這支
預設來源：D:\\claude\\clawd-pet-gift\\_art\\holo-test\\gift-mohuashaonv.html
"""
import io, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'src' / 'apoc' / 'mohuashaonv.html'
# 使用者 2026-09-14 指定：最新版在他桌面，不是 holo-gift 分支上那份
DEFAULT_SRC = Path(r'C:\Users\ASUS User VII\Desktop\新卡\u04g\魔花少女卡面莓紫.html')

EMBED = ('\n<!-- 嵌入模式（?embed=1）：卡冊直接嵌這一頁當卡面，只留卡本身。'
         '由 tools/apoc/import_collect_card.py 補上，原始頁沒有這段。 -->\n'
         '<style>html[data-embed]{color-scheme:light}'
         'html[data-embed] body{padding:0;min-height:0;height:100vh;background:transparent;gap:0;overflow:hidden}'
         'html[data-embed] body:before,html[data-embed] h1,html[data-embed] .hint{display:none}'
         # ⚠ .stage 不要留 drop-shadow：那是整張卡的 alpha 遮罩，半徑再小都要每幀重算，
         #   實測放大預覽因此掉 10 fps（20 → 29）。卡片本來就在深色底上，那圈外陰影看不出來。
         'html[data-embed] .stage{width:auto;height:94vh;max-width:94vw;filter:none}</style>\n'
         '<script>if(/[?&]embed=/.test(location.search))document.documentElement.setAttribute("data-embed","1")</script>\n')

def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        print(f'✗ 找不到來源 {src}'); sys.exit(1)
    html = io.open(src, encoding='utf-8', newline='').read()
    print(f'來源 {src}  {len(html)/1e6:.2f} MB')

    if 'data-embed' in html:
        print('  來源已經有嵌入模式，不重複注入')
    else:
        # 注入點：<h1> 之前（嵌入模式要藏的就是 h1／hint／留白）
        # 注入點：<h1> 之前，或 <div class="stage"> 之前。
        # ⚠ 使用者桌面那份（莓紫）沒有 <h1>——它是純卡片頁，沒有標題與說明，只有 .stage。
        m = re.search(r'\n<h1[ >]', html) or re.search(r'\n<div class="stage"', html)
        if not m:
            print('✗ 找不到注入點（<h1> 或 <div class="stage">），頁面結構變了——先看過再改這支腳本'); sys.exit(1)
        html = html[:m.start()] + EMBED + html[m.start():]
        print('  已注入嵌入模式')

    io.open(DEST, 'w', encoding='utf-8', newline='').write(html)
    print(f'寫入 {DEST}  {DEST.stat().st_size/1e6:.2f} MB')

    n = len(re.findall(r'data:font/woff2', html))
    if n:
        print(f'⚠ 還有 {n} 個內嵌字型（空字型），**接著要跑 python tools/apoc/build_fonts.py**')
    print('✓ 匯入完成')

if __name__ == '__main__':
    main()
