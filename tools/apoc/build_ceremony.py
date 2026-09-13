# -*- coding: utf-8 -*-
"""精裝典藏包（末世的抽卡演出）：從 holo-5.0 的 deluxe-gacha-b 組出檔案版。

使用者 2026-09-13：抽卡演出 → 精裝典藏包；「之前做這麼辛苦的東西不就都白費了」。
所以演出本體（ceremony.js／ceremony.css／背景幾何／音效／粒子）一個字都不改，
只換三件事：
  1. 素材不再 base64 內嵌，改讀 build_holo.py 輸出的 src/apoc/ 檔案（卡面 CSS、卡圖、遮罩共用）。
  2. 卡不是頁面自己抽的：主頁先用 ApocEconomy 扣券、決定結果、寫進存檔（pending），
     再把 id 交給 ApocCeremony.play(ids)。頁面的 draw(n) 改成照那份清單出卡。
  3. 「收下」按下去時通知主頁落帳（postMessage）；頁面自己的試抽券與單抽／五連／十連鍵收起來。

組法照 `_art/holo-test/build_deluxe_b.py`。輸出：
  src/apoc/ceremony.html  src/apoc/ceremony.css  src/apoc/fx/*.webp
用法：python tools/apoc/build_holo.py && python tools/apoc/build_ceremony.py
"""
import shutil
from pathlib import Path

HOLO = Path(r'D:/claude研究/clawd-pet-50/_art/holo-test')
OUT = Path(__file__).resolve().parents[2] / 'src/apoc'


def must_replace(text, old, new):
    assert text.count(old) == 1, f'原型改過了，找不到唯一的：{old[:60]}'
    return text.replace(old, new)


def main():
    assert (OUT / 'holo.css').exists() and (OUT / 'pool.js').exists(), '先跑 build_holo.py'
    (OUT / 'fx').mkdir(exist_ok=True)
    for name in ['foil-pack.webp', 'foil-tear.webp', 'summon-substrate.webp']:
        shutil.copy2(HOLO / 'fx' / name, OUT / 'fx' / name)

    css = (HOLO / 'ceremony.css').read_text(encoding='utf-8')
    css = css.replace('cardback/deluxe-back.webp', 'art/deluxe-back.webp')
    # 主頁負責扣券：原型的試抽券與抽卡鍵收起來（節點保留，ceremony.js 會讀它們）
    css += '\n/* 末世：扣券在主頁，這裡只演出 */\n.entry-actions,.test-label{display:none!important}\n'
    # 使用者第四輪：「新夥伴／升星」直接標在抽卡結果上，不另外跳「收下了！」視窗
    css += ('\n/* 末世：結果卡上的新夥伴／升星徽章（主頁算好傳進來） */\n'
            '.slot .apoc-badges{position:absolute;left:50%;top:-4%;transform:translateX(-50%);z-index:40;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;width:130%;pointer-events:none}\n'
            '.apoc-badge{font:800 13px/1 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;padding:5px 9px;border-radius:999px;color:#fff;background:#8E3B2E;'
            'border:2px solid #fff6e6;box-shadow:0 3px 8px #000a;white-space:nowrap;letter-spacing:.04em}\n'
            '.apoc-badge.new{background:#D9412F}.apoc-badge.star{background:#B9821F}.apoc-badge.promote,.apoc-badge.transcend{background:#6A4FB0}\n')
    (OUT / 'ceremony.css').write_text(css, encoding='utf-8')

    js = '\n'.join((HOLO / n).read_text(encoding='utf-8')
                   for n in ['ceremony-layout.js', 'ceremony-fx.js', 'ceremony-audio.js', 'ceremony.js'])
    js = must_replace(js, "const ticketPolicy={unlimited:false,label:''};", "const ticketPolicy={unlimited:true,label:''};")
    js = must_replace(js, '__SUBSTRATE_INIT__', "win.style.setProperty('--substrate', 'url(' + path('fx/summon-substrate.webp') + ')');")
    js += r'''
// ── 末世橋接（build_ceremony.py 加的，演出本體沒改）──────────────────────
// 主頁已經扣券並把結果寫進存檔；這裡只照清單演出，收下時回報。
btn.fin.addEventListener('click',()=>{if(parent!==window)parent.postMessage({apocCeremony:'collect'},'*');});
// 結果卡上的「新夥伴／★1→★2」徽章（使用者第四輪：直接標在抽卡結果，不另外跳視窗）。
// 主頁照抽到的順序算好傳進來；卡片定型（completeSlot）時掛上，清場（clearRun）時跟著卡一起消失。
let apocBadges=[];
const apocCompleteSlot=completeSlot;
completeSlot=function(s){apocCompleteSlot(s);const list=apocBadges[+s.el.dataset.i]||[];
  if(!list.length||s.el.querySelector('.apoc-badges'))return;const box=node('div','apoc-badges');
  for(const b of list){const tag=node('b','apoc-badge '+(b.kind||''));tag.textContent=b.text;box.append(tag);}s.el.append(box);};
window.ApocCeremony={
  play(ids,badges){apocBadges=Array.isArray(badges)?badges:[];if(busy||slots.length)clearRun();window.__apocIds=ids.slice();pull(ids.length);},
  // 重新整理時存檔裡還有沒收下的結果：直接跳到結果頁（原型的 skipAll 就是這條路）
  restore(ids,badges){this.play(ids,badges);const run=generation;const go=async()=>{
    if(run!==generation)return; if(!await ready)return;
    if(entryPhase!=='waiting'){requestAnimationFrame(go);return;} openPack(); skipAll();};go();},
  reset(){clearRun();hint.textContent='';},
  state:()=>({screen,entryPhase,busy,collectable:!btn.fin.hidden,ids:slots.map(s=>s.data.id)}),
};
parent!==window&&parent.postMessage({apocCeremony:'ready'},'*');
'''
    svg = (HOLO / 'ceremony-background.svg').read_text(encoding='utf-8')
    tpl = (HOLO / 'build_deluxe_b.py').read_text(encoding='utf-8')
    html = tpl[tpl.index("HTML = r'''") + len("HTML = r'''"):]
    html = html[:html.index("'''")]
    html = must_replace(html, '__CARD_CSS__', '<link rel="stylesheet" href="holo.css">')
    html = must_replace(html, '<script>__CARD_FACE_JS__</script>', '<script src="card-face.js"></script><script src="pool.js"></script>')
    html = must_replace(html, '<style>__CEREMONY_CSS__</style>', '<link rel="stylesheet" href="ceremony.css">')
    html = must_replace(html, '__BACKGROUND_GEOMETRY__', svg)
    html = must_replace(html, '<script type="application/json" id="mask-data">__MASKS__</script>\n', '')
    html = must_replace(html, '<script type="application/json" id="pool-data">__POOL__</script>\n', '')
    # 素材對照：卡圖鍵 → art/*.webp；遮罩走絕對網址（它是透過 CSS 自訂屬性用在 holo.css 裡的）
    html = must_replace(html, "const masks = JSON.parse($('#mask-data').textContent);",
        "const abs=n=>new URL(n,location.href).href;\n"
        "const masks = Object.fromEntries(Object.entries(window.ApocMasks||{}).map(([k,v])=>[k,abs(v)]));")
    html = must_replace(html, "const POOL  = JSON.parse($('#pool-data').textContent);", "const POOL  = window.ApocPool||[];")
    html = must_replace(html, 'function draw(n){\n',
        "function draw(n){\n  if(window.__apocIds){const m=Object.fromEntries(POOL.map(c=>[c.id,c]));return window.__apocIds.slice(0,n).map(id=>m[id]).filter(Boolean);}\n")
    html = must_replace(html, 'function path(n){\n',
        "function path(n){\n  if(window.ApocAssets&&window.ApocAssets[n]) return abs(window.ApocAssets[n]);\n")
    html = must_replace(html, '__CEREMONY_JS__', js)   # ceremony.js 用到 IIFE 內的 $／path／makeFace，只能內嵌在同一段
    html = '<!-- 由 tools/apoc/build_ceremony.py 產生，不要手改 -->\n' + html
    (OUT / 'ceremony.html').write_text(html, encoding='utf-8', newline='\n')
    size = sum(p.stat().st_size for p in [OUT / 'ceremony.html', OUT / 'ceremony.css'] + list((OUT / 'fx').glob('*.webp')))
    print(f'精裝典藏包：ceremony.html {(OUT/"ceremony.html").stat().st_size/1024:.0f} KB，連同 CSS 與 fx 共 {size/1024:.0f} KB（卡圖與卡面 CSS 跟主頁共用）')


if __name__ == '__main__':
    main()
