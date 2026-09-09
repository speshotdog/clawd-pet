# -*- coding: utf-8 -*-
"""單張神話卡樣品：素材是 mtk1/mtk2 兩支影片（先跑 build_mtk_art.py）。

照 HANDOFF-holo-cards.md 六之五的凍結工法做，卡面 DOM 與字級一律走 card_face.js，
CSS 從 demo.html 擷取（跟 build_cards_remade.py 同一條路），所以這張卡跟卡池那 43 張
是同一套幾何：圖窗 1.7/2.4/3.3%、文字框 4.4/4.4/3.4/16.2%、寶石在文字框左側、
名字在 .face-text、mythic 名字走 conic 彩虹。

這張卡多出來的東西只有一樣：**特殊表情**。
圖層不是靜態 PNG 而是 animated WebP，點卡片會換成第二支動畫（頭被削開那個），
播完自己回常態。foil mask 用同一支動畫（Chromium 的 mask-image 會跟著播），
所以箔面逐格貼著角色；用靜態剪影當 mask 會在角色旁邊留一塊會發光的殘影。

動畫一律 base64 內嵌，沒有分「開發版／單檔版」：file:// 的 CSS mask 吃 CORS
（HANDOFF 五之四），相對路徑的 mask 會被擋掉，所以 mask 非 data URI 不可；
既然圖層與 mask 是同一支動畫，那就整支內嵌一次、兩邊共用同一個字串。

用法：python build_mtk_card.py [--name 卡名]
輸出：mtk-card.html（自包含，複製到任何資料夾都能開）
"""
from base64 import b64encode
from pathlib import Path
import argparse, json, re, sys

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
from build_card_scenes import palette          # 配色用同一支，不另外算一套

ap = argparse.ArgumentParser()
ap.add_argument('--name', default='女僕羊咩')
ap.add_argument('--id', default='mtk')
args = ap.parse_args()

demo = (HERE / 'demo.html').read_text(encoding='utf-8')
tpl = re.search(r'<template id="baseline-css">.*?</template>', demo, re.S)
styles = [m.group(0) for m in re.finditer(r'<style[^>]*>.*?</style>', demo, re.S)
          if not (tpl.start() <= m.start() < tpl.end())]
demo_masks = json.loads(re.search(
    r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S).group(1))

masks = {'frame': demo_masks['frame'], 'glitter': demo_masks['glitter']}

# 圖層與 foil mask 各一支動畫，全部內嵌
ART = ('mtk-idle.webp', 'mtk-shock.webp')


def embed(name):
    return 'data:image/webp;base64,' + b64encode((HERE / 'mtk' / name).read_bytes()).decode('ascii')


assets = {f: embed(f) for f in ART}
masks.update({f: embed(f.replace('.webp', '-mask.webp')) for f in ART})

# 箔紋是 CSS 直接引用的相對檔名，一起內嵌
TEXTURES = ('texture-fiber.png', 'texture-engraving.png')

pal = palette(HERE / 'mtk' / 'mtk-idle-still.webp')
card = {'id': args.id, 'name': args.name, 'rarity': 'mythic',
        'kind': 'framed', 'file': 'mtk-idle.webp', 'pal': pal}

HTML = r'''<!doctype html>
<meta charset="utf-8">
<title>神話卡樣品 · 特殊表情</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
__CARD_CSS__
<script>__CARD_FACE_JS__</script>
<style id="mtk-stage">
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:
  radial-gradient(120% 80% at 50% -10%,#1d1533 0%,#0b0a15 46%,#06060c 100%);
 color:#dbe7ff;font:14px/1.7 "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;
 display:flex;flex-direction:column;align-items:center;justify-content:center;
 padding:36px 20px 44px;gap:20px;overflow-x:hidden}
body:before{content:"";position:fixed;inset:-20%;pointer-events:none;z-index:0;
 background:
  radial-gradient(closest-side,#ff7ad933 0%,transparent 70%) 18% 26%/46% 46% no-repeat,
  radial-gradient(closest-side,#6fe3ff2b 0%,transparent 70%) 82% 70%/52% 52% no-repeat;
 filter:blur(6px);animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate3d(2.5%,-2%,0) scale(1.06)}}
h1{position:relative;z-index:1;font-size:17px;letter-spacing:.16em;font-weight:700;margin:0;
 color:#f4e6ff;text-shadow:0 0 18px #b07bff55}
.hint{position:relative;z-index:1;margin:0;color:#8f9bb3;font-size:13px;letter-spacing:.04em}
.hint b{color:#ffd76a;font-weight:700}
.stage{position:relative;z-index:1;width:min(78vw,380px);aspect-ratio:5/7;
 filter:drop-shadow(0 30px 46px #00000099)}
.stage.shake{animation:shake .42s cubic-bezier(.36,.07,.19,.97)}
@keyframes shake{
 10%{transform:translate3d(-6px,2px,0) rotate(-1.1deg)}
 30%{transform:translate3d(7px,-3px,0) rotate(1.3deg)}
 55%{transform:translate3d(-4px,2px,0) rotate(-.7deg)}
 78%{transform:translate3d(3px,-1px,0) rotate(.4deg)}
 100%{transform:none}}
.stage .hcard{cursor:pointer}
/* 換表情的瞬間閃一下白，掩住兩個動畫之間的接縫 */
.flash{position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:400;
 background:radial-gradient(60% 46% at 50% 40%,#ffffff,#ffd9ff00 68%);
 opacity:0;mix-blend-mode:screen}
.flash.on{animation:flash .5s ease-out}
@keyframes flash{0%{opacity:.9}100%{opacity:0}}
.bar{position:relative;z-index:1;display:flex;gap:10px;align-items:center}
button{font:600 13px/1 "Noto Sans TC",system-ui,sans-serif;letter-spacing:.06em;
 color:#f0e7ff;background:#221a3a;border:1px solid #4b3a76;border-radius:999px;
 padding:9px 18px;cursor:pointer;transition:background .16s,border-color .16s}
button:hover{background:#2e2350;border-color:#7a5fc0}
button[aria-pressed="true"]{background:#4a2c63;border-color:#c07bff}
.state{font-size:12px;color:#7b879c;min-width:8em}
</style>

<h1>神話卡樣品 · 特殊表情</h1>
<div class="stage" id="stage"><div class="flash" id="flash"></div></div>
<p class="hint">滑鼠移到卡上可以傾斜看箔面，<b>點一下卡片</b>切成特殊表情，播完自己回常態。</p>
<div class="bar">
 <button id="toggle" aria-pressed="false">特殊表情</button>
 <span class="state" id="state">常態</span>
</div>

<script type="application/json" id="mask-data">__MASKS__</script>
<script type="application/json" id="asset-data">__ASSETS__</script>
<script type="application/json" id="card-data">__CARD__</script>
<script>
'use strict';
(() => {
const $ = s => document.querySelector(s);
const masks = JSON.parse($('#mask-data').textContent);
const DATA  = JSON.parse($('#card-data').textContent);
const A = JSON.parse($('#asset-data').textContent);
const url = n => A[n];
// foil mask 也是動畫（masks[檔名] 是另一支白底＋alpha 的 WebP）：Chromium 的
// mask-image 吃得動 animated WebP，所以箔面逐格貼著角色。用一張靜態剪影當 mask，
// 角色旁邊會留一塊會發光的殘影（頭被削開那支特別明顯，頭掃過的範圍全都會亮）。

document.documentElement.style.setProperty('--frame-mask', `url("${masks.frame}")`);
document.documentElement.style.setProperty('--glitter-mask', `url("${masks.glitter}")`);
document.body.classList.add('font-system','gem-faceted','ink-chroma');

const stage = $('#stage'), flash = $('#flash'), toggle = $('#toggle'), state = $('#state');
const card = HoloCardFace.create(DATA, {masks, resolve: url});
stage.prepend(card);
HoloCardFace.observe(card);

const img  = card.querySelector('.art-media img');
const mask = card.querySelector('.subject-mask');
const applyMask = file => mask && mask.style.setProperty('--subject', `url("${masks[file]}")`);
const FACE = {
 normal:  {file:'mtk-idle.webp',  label:'常態'},
 special: {file:'mtk-shock.webp', label:'特殊表情', ms:3000}
};

// 兩支動畫都先讀進 cache，換的時候才不會露出空白格
Object.values(FACE).forEach(f => { const p = new Image(); p.src = url(f.file); });

applyMask(FACE.normal.file);
card.dataset.face = 'normal';
let mode = 'normal', timer = 0;
function setFace(next){
 const f = FACE[next];
 mode = next;
 // 同一個 src 再指定一次不會重播 animated WebP，要先清掉才會從第 0 格開始
 img.removeAttribute('src');
 img.src = url(f.file);
 applyMask(f.file);
 card.dataset.face = next;
 toggle.setAttribute('aria-pressed', String(next === 'special'));
 state.textContent = f.label;
 clearTimeout(timer);
 if (next === 'special'){
  flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
  timer = setTimeout(() => setFace('normal'), f.ms);
 }
}
const fire = () => setFace(mode === 'normal' ? 'special' : 'normal');
card.addEventListener('click', fire);
toggle.addEventListener('click', fire);

// 卡面展示頁：整張卡可以傾斜（抽卡揭曉後的卡才是不轉、只有材質跟著游標）
stage.addEventListener('pointermove', e => {
 const r = stage.getBoundingClientRect();
 HoloCardFace.paint(card, DATA.rarity,
   (e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1, {tilt:true});
});
stage.addEventListener('pointerleave', () => HoloCardFace.paint(card, DATA.rarity, 0, 0, {tilt:true}));
window.mtkCard = {card, setFace, FACE};
})();
</script>
'''

page = (HTML.replace('__CARD_FACE_JS__', (HERE / 'card_face.js').read_text(encoding='utf-8'))
            .replace('__CARD_CSS__', '\n'.join(styles))
            .replace('__MASKS__', json.dumps(masks, separators=(',', ':')))
            .replace('__ASSETS__', json.dumps(assets, separators=(',', ':')))
            .replace('__CARD__', json.dumps(card, ensure_ascii=False, separators=(',', ':'))))
for tex in TEXTURES:
    assert tex in page, tex
    page = page.replace(tex, 'data:image/png;base64,' +
                        b64encode((HERE / tex).read_bytes()).decode('ascii'))

out = HERE / 'mtk-card.html'
out.write_text(page, encoding='utf-8', newline='\n')
print('wrote mtk-card.html : %.2f MiB  pal=%s' % (out.stat().st_size / 1048576, pal['base']))
