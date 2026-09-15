# -*- coding: utf-8 -*-
"""玩物就玩物改版預覽頁：現況 flat 卡 vs 新 depth 卡（A 深色底／B 暖色底）。

CSS／card_face.js 與 build_cards_remade.py 取同一份來源（demo.html 凍結檔），
只是卡池換成三張對照。自包含單檔，雙擊就開。輸出 shots/wanwu/preview.html。
"""
from pathlib import Path
import base64, json, re

OUT = Path(__file__).resolve().parent
SHOT = OUT / 'shots' / 'wanwu'
demo = (OUT / 'demo.html').read_text(encoding='utf-8')
tpl = re.search(r'<template id="baseline-css">.*?</template>', demo, re.S)
styles = [m.group(0) for m in re.finditer(r'<style[^>]*>.*?</style>', demo, re.S)
          if not (tpl.start() <= m.start() < tpl.end())]
masks = json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S).group(1))
masks.update(json.loads((SHOT / 'mask.json').read_text(encoding='utf-8')))
styles.append('<style>' + (OUT / 'card-position.css').read_text(encoding='utf-8') + '</style>')
styles.append('<style>' + (OUT / 'card-fx.css').read_text(encoding='utf-8') + '</style>')

from pool_data import pool
cur = next(c for c in pool() if c['id'] == 'wanwumythic')

def uri(p):
    return 'data:image/png;base64,' + base64.b64encode(Path(p).read_bytes()).decode('ascii')

assets = {
    'card-wanwumythic.png': uri(OUT / 'art' / 'card-wanwumythic.png'),
    'layer-wanwumythic-subject.png': uri(SHOT / 'layer-wanwumythic-subject.png'),
    'layer-wanwumythic-hearts.png': uri(SHOT / 'layer-wanwumythic-hearts.png'),
    'bg-B': uri(SHOT / 'layer-wanwumythic-background-B.png'),
}
new = dict(cur)                       # pool_data 的 OVERRIDES 已經是 depth＋fx
cur = {k: v for k, v in cur.items() if k not in ('scene', 'fx')}; cur.update(kind='flat', bleed=True)   # 現況對照用
CARDS = [
    dict(cur, cap='<b>現況</b>flat 滿版（card-wanwumythic.png 509×490）', bg=None),
    dict(new, cap='<b>新版</b>depth・手＝背景層，羊＝主體層，愛心＝最上層微晃、羊有呼吸感；暖色底、放大到羊不裁切', bg='bg-B'),
]

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>玩物就玩物 · 改版預覽</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<script>__CARD_FACE_JS__</script>
<script>__CARD_FX_JS__</script>
<style>
*{box-sizing:border-box}
body{margin:0;background:#07080d;color:#dbe7ff;padding:28px 22px 70px;font:14px/1.6 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
h1{font-size:20px;letter-spacing:.06em;margin:0 0 4px}
p.lede{color:#8f9bb3;max-width:76ch;margin:0 0 22px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,360px));gap:34px 26px}

@media(max-width:900px){.grid{grid-template-columns:1fr}}
.hit{position:relative;width:100%;aspect-ratio:5/7}
.cap{margin-top:9px;font-size:12px;color:#7b879c;text-align:center}
.cap b{color:#c9d4e6;display:block;font-size:13px;margin-bottom:2px}
</style>
<h1>玩物就玩物 · 改版預覽</h1>
<p class="lede"><b style="color:#ffd76a">滑鼠移到卡片上可以傾斜</b>，新版的手（背景）與羊（主體）會沿 Z 分開推，愛心在最上層微微晃動。
來源是作者給的 PSD 三層，不摳圖、RGB 不改；臉中心落在卡高 40%（卡頂到文字框上緣的中點）。</p>
<div class="grid" id="grid"></div>
<script type="application/json" id="mask-data">__MASKS__</script>
<script type="application/json" id="cards">__CARDS__</script>
<script>
'use strict';
(() => {
const $=s=>document.querySelector(s);
const masks=JSON.parse($('#mask-data').textContent);
const CARDS=JSON.parse($('#cards').textContent);
const __A=__ASSETS__;
document.documentElement.style.setProperty('--frame-mask',`url("${masks.frame}")`);
document.documentElement.style.setProperty('--glitter-mask',`url("${masks.glitter}")`);
document.body.classList.add('font-system','gem-faceted','ink-chroma');
const LABEL=HoloCardFace.LABEL;
function node(t,c,x){const n=document.createElement(t);if(c)n.className=c;if(x!==undefined)n.textContent=x;return n;}
const grid=$('#grid');
CARDS.forEach((d,i)=>{
 const cell=node('div','cell'),hit=node('div','hit');
 const card=HoloCardFace.create(d,{masks,resolve:n=>n==='layer-wanwumythic-background.png'?__A[d.bg]:__A[n]});
 card.dataset.variant=String(i);
 HoloCardFx.apply(card,d,n=>__A[n]);
 hit.append(card);
 const cap=node('p','cap');cap.innerHTML=d.cap;
 cell.append(hit,cap);grid.append(cell);
 HoloCardFace.observe(card);
 hit.addEventListener('pointermove',e=>{const r=hit.getBoundingClientRect();
  HoloCardFace.paint(card,d.rarity,(e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1,{tilt:true});});
 hit.addEventListener('pointerleave',()=>HoloCardFace.paint(card,d.rarity,0,0,{tilt:true}));
});
})();
</script>
'''
page = (HTML.replace('__CARD_FACE_JS__', (OUT / 'card_face.js').read_text(encoding='utf-8'))
            .replace('__CARD_FX_JS__', (OUT / 'card_fx.js').read_text(encoding='utf-8'))
            .replace('__CARD_CSS__', '\n'.join(styles))
            .replace('__MASKS__', json.dumps(masks, separators=(',', ':')))
            .replace('__CARDS__', json.dumps(CARDS, ensure_ascii=False, separators=(',', ':')))
            .replace('__ASSETS__', json.dumps(assets, separators=(',', ':'))))
# 箔紋是 CSS 直接引用的相對檔名，預覽頁在 shots/ 下所以要內嵌
for tex in ('texture-fiber.png', 'texture-engraving.png'):
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' + base64.b64encode((OUT / tex).read_bytes()).decode('ascii'))
(SHOT / 'preview.html').write_text(page, encoding='utf-8', newline='\n')
print('wrote', SHOT / 'preview.html', '%.2f MiB' % ((SHOT / 'preview.html').stat().st_size / 1048576))

# 純卡片版：沒有標題、說明、圖說，只有正式版那一張置中；其餘（CSS、JS、素材）原封不動。
ONLY = json.dumps([c for c in CARDS if c.get('bg')], ensure_ascii=False, separators=(',', ':'))
card_only = (page.replace(json.dumps(CARDS, ensure_ascii=False, separators=(',', ':')), ONLY)
                 .replace('<title>玩物就玩物 · 改版預覽</title>', '<title>玩物就玩物</title>'))
card_only = re.sub(r'<h1>.*?</h1>\s*<p class="lede">.*?</p>\s*', '', card_only, flags=re.S)
card_only = card_only.replace(" const cap=node('p','cap');cap.innerHTML=d.cap;\n cell.append(hit,cap);", " cell.append(hit);")
card_only = card_only.replace('.grid{display:grid;grid-template-columns:repeat(2,minmax(0,360px));gap:34px 26px}',
    'body{min-height:100vh;display:grid;place-items:center;padding:24px}.grid{width:min(420px,100%)}')
assert 'cap.innerHTML' not in card_only and '<h1>' not in card_only
(OUT / 'wanwu-card.html').write_text(card_only, encoding='utf-8', newline='\n')
print('wrote', OUT / 'wanwu-card.html', '%.2f MiB' % ((OUT / 'wanwu-card.html').stat().st_size / 1048576))
