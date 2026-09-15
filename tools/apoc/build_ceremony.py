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
    # 第七輪使用者：「裡面的介面已經有單抽／五連／十連，招募夥伴那邊改成引導進入抽卡選單的按鈕」→ 入口的三顆鍵打開，
    # 但按下去是通知主頁扣錢（見下面的橋接）；試抽券計數收起來，小字改成價錢；結果頁加「繼續抽 N 次」
    css += ('\n/* 末世：扣錢在主頁；三顆鍵的小字是價錢，買不起就停用 */\n.test-label,.ticket-count{display:none!important}\n'
            '.pull-actions button:disabled{opacity:.42;cursor:not-allowed}\n'
            '.apoc-back{display:block;margin:18px auto 0;padding:8px 24px;font-size:13px;background:transparent;color:#c4c0b5;'
            'border:1px solid #c4c0b566;border-radius:999px;box-shadow:none;cursor:pointer}\n'
            '.apoc-back:hover{color:#fff;border-color:#fff}\n'
            '.apoc-again{min-width:136px;height:48px;padding:0 18px;background:#1b1e20;color:#eadfc4;border:1px solid #eadfc4;cursor:pointer}\n'
            '.apoc-again:disabled{opacity:.42;cursor:not-allowed}\n')
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
const apocPost=(type,extra={})=>{if(parent!==window)parent.postMessage({apocCeremony:type,...extra},'*');};
btn.fin.addEventListener('click',()=>apocPost('collect'));
// 第七輪：入口的單抽／五連／十連＝抽卡選單（扣錢在主頁）。原型自己綁的 click 會直接 pull()＝白抽，
// 在同一顆鍵上用 capture 先攔下來（目標元素上 capture 監聽先跑）、改成通知主頁；主頁扣完錢再呼叫 play()。
for(const [b,n] of [[btn.p1,1],[btn.p5,5],[btn.p10,10]])b.addEventListener('click',e=>{e.stopImmediatePropagation();if(b.disabled||busy||slots.length)return;apocPost('pull',{n});},true);
const apocBack=node('button','apoc-back','返回');apocBack.type='button';$('.entry-actions').append(apocBack);
apocBack.addEventListener('click',()=>apocPost('leave'));
addEventListener('keydown',e=>{if(e.key==='Escape'&&screen==='entry'&&!busy&&!slots.length)apocPost('leave');});
function apocOffer(offer){for(const [b,n] of [[btn.p1,1],[btn.p5,5],[btn.p10,10]]){const o=((offer&&offer.counts)||[]).find(c=>c.n===n);
  b.querySelector('small').textContent=o?o.label:'';b.disabled=!o||!o.ok;}}
// 結果頁的「繼續抽 N 次」（使用者第七輪：「我也希望他有繼續抽的功能，看當下是幾抽」）：主頁算好張數、價錢、買不買得起傳進來
let apocAgainOffer=null;
const apocAgain=node('button','apoc-again','');apocAgain.type='button';apocAgain.hidden=true;btn.fin.after(apocAgain);
apocAgain.addEventListener('click',()=>{if(apocAgain.hidden||apocAgain.disabled||collecting)return;collecting=true;apocAgain.hidden=true;btn.fin.hidden=true;apocPost('again');});
const apocUpdateFinish=updateFinish;
updateFinish=function(){apocUpdateFinish();apocAgain.hidden=btn.fin.hidden||!apocAgainOffer;
  if(apocAgainOffer){apocAgain.textContent=apocAgainOffer.label;apocAgain.disabled=!apocAgainOffer.ok;}};
// 結果卡上的「新夥伴／★1→★2」徽章（使用者第四輪：直接標在抽卡結果，不另外跳視窗）。
// 主頁照抽到的順序算好傳進來；卡片定型（completeSlot）時掛上，清場（clearRun）時跟著卡一起消失。
let apocBadges=[];
const apocCompleteSlot=completeSlot;
completeSlot=function(s){apocCompleteSlot(s);const list=apocBadges[+s.el.dataset.i]||[];
  if(!list.length||s.el.querySelector('.apoc-badges'))return;const box=node('div','apoc-badges');
  for(const b of list){const tag=node('b','apoc-badge '+(b.kind||''));tag.textContent=b.text;box.append(tag);}s.el.append(box);};
window.ApocCeremony={
  play(ids,badges,again){apocBadges=Array.isArray(badges)?badges:[];apocAgainOffer=again||null;if(busy||slots.length)clearRun();window.__apocIds=ids.slice();pull(ids.length);},
  // 入口＝抽卡選單：不抽，只把三顆鍵的價錢與可不可以按放上去（主頁的「進入招募」鍵打開這裡）
  enter(offer){apocAgainOffer=null;if(busy||slots.length)clearRun();window.__apocIds=null;hint.textContent='';apocOffer(offer);
    [btn.p10,btn.p5,btn.p1].find(b=>!b.disabled)?.focus()||apocBack.focus();},
  offer:apocOffer,
  // 重新整理時存檔裡還有沒收下的結果：直接跳到結果頁（原型的 skipAll 就是這條路）
  restore(ids,badges,again){this.play(ids,badges,again);const run=generation;const go=async()=>{
    if(run!==generation)return; if(!await ready)return;
    if(entryPhase!=='waiting'){requestAnimationFrame(go);return;} openPack(); skipAll();};go();},
  reset(){clearRun();hint.textContent='';},
  state:()=>({screen,entryPhase,busy,collectable:!btn.fin.hidden,again:!apocAgain.hidden,ids:slots.map(s=>s.data.id),
    offer:[btn.p1,btn.p5,btn.p10].map(b=>({disabled:b.disabled,label:b.querySelector('small').textContent}))}),
};
parent!==window&&parent.postMessage({apocCeremony:'ready'},'*');
'''
    svg = (HOLO / 'ceremony-background.svg').read_text(encoding='utf-8')
    tpl = (HOLO / 'build_deluxe_b.py').read_text(encoding='utf-8')
    html = tpl[tpl.index("HTML = r'''") + len("HTML = r'''"):]
    html = html[:html.index("'''")]
    html = must_replace(html, '__CARD_CSS__', '<link rel="stylesheet" href="holo.css">')
    html = must_replace(html, '<script>__CARD_FACE_JS__</script>\n<script>__CARD_FX_JS__</script>', '<script src="card-face.js"></script><script src="card-fx.js"></script><script src="pool.js"></script>')
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
    # 第九輪使用者：「我想要有更好的開封效果，點下去卡包微微震動、發光、縮小，然後回彈噴出卡片」。
    # 原型點下去只有「放大 1.08 → 回 1」＋「往下壓 5px」；換成蓄力（微震＋越縮越小＋越來越亮）620ms → 回彈閃光，之後照原本撕包、發牌。
    html = must_replace(html, "A(pack,[{transform:`translateY(0) rotate(0deg) scale(1.08)`},{transform:'translateY(0) rotate(0deg)'}],{duration:240});", (
        "sound('charge');"
        "A(pack,[{transform:'translate(0,0) rotate(0deg) scale(1.06)',filter:'brightness(1) drop-shadow(0 0 0 #ffd76a)'},"
        "{transform:'translate(-3px,1px) rotate(-1.6deg) scale(1.01)',offset:.14},{transform:'translate(3px,-1px) rotate(1.6deg) scale(.97)',offset:.28},"
        "{transform:'translate(-3px,1px) rotate(-1.3deg) scale(.93)',filter:'brightness(1.2) drop-shadow(0 0 12px #ffd76a)',offset:.42},"
        "{transform:'translate(3px,0) rotate(1.2deg) scale(.9)',offset:.56},{transform:'translate(-2px,0) rotate(-1deg) scale(.87)',offset:.7},"
        "{transform:'translate(2px,0) rotate(.8deg) scale(.85)',filter:'brightness(1.55) drop-shadow(0 0 28px #ffd76a)',offset:.86},"
        "{transform:'translate(0,0) rotate(0deg) scale(.84)',filter:'brightness(1.85) drop-shadow(0 0 42px #fff2b0)'}],{duration:620,easing:'ease-in'});"
        "if(!await wait(620,run))return false;"
        "A(pack,[{transform:'scale(.84)',filter:'brightness(1.85) drop-shadow(0 0 42px #fff2b0)'},"
        "{transform:'scale(1.24)',filter:'brightness(2.3) drop-shadow(0 0 64px #fff6d0)',offset:.5},"
        "{transform:'scale(1.12)',filter:'brightness(1.3) drop-shadow(0 0 22px #ffd76a)'}],{duration:240,easing:'cubic-bezier(.2,1.6,.4,1)',fill:'forwards'});"))
    # 回彈之後不要再「往下壓 5px、縮回 .985」，那會把回彈吃掉
    html = must_replace(html, "A(pack,[{transform:'translateY(0) scale(1)'},{transform:'translateY(5px) scale(.985)'}],{duration:200});", "")
    html = '<!-- 由 tools/apoc/build_ceremony.py 產生，不要手改 -->\n' + html
    (OUT / 'ceremony.html').write_text(html, encoding='utf-8', newline='\n')
    size = sum(p.stat().st_size for p in [OUT / 'ceremony.html', OUT / 'ceremony.css'] + list((OUT / 'fx').glob('*.webp')))
    print(f'精裝典藏包：ceremony.html {(OUT/"ceremony.html").stat().st_size/1024:.0f} KB，連同 CSS 與 fx 共 {size/1024:.0f} KB（卡圖與卡面 CSS 跟主頁共用）')


if __name__ == '__main__':
    main()
