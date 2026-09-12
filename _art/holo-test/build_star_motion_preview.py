# -*- coding: utf-8 -*-
"""觀星動態卡的比對頁（靜卡 vs 動態，同一個視窗）。自包含，複製到哪裡都能開。
⚠ 這是**素材預覽**，不是最終卡面：holo 的反光、卡框、字體都不在這一頁，
   要判斷的是「這段動態值不值得做成動態卡、視窗對不對」。"""
from base64 import b64encode
from pathlib import Path
HERE = Path(__file__).resolve().parent
ART = HERE / 'art'
NAMES = {'wangyuanmie': ('咩有看錯星', '神話', '#C86BD8'),
         'xingyejiao': ('今晚不睡膠', '神話', '#C86BD8'),
         'shanqiulong': ('星願龍總欸', '傳說', '#E9B94E')}
def uri(p): return f'data:image/{"webp" if p.suffix==".webp" else "png"};base64,' + b64encode(p.read_bytes()).decode()
rows = []
for ident, (name, rarity, color) in NAMES.items():
    still, motion = ART / f'card-{ident}.png', ART / f'card-{ident}-motion.webp'
    rows.append(f'''<section><h2>{name} <small style="color:{color}">{rarity}</small></h2><div class="pair">
  <figure><img src="{uri(still)}" alt=""><figcaption>現況（靜卡）</figcaption></figure>
  <figure><img src="{uri(motion)}" alt=""><figcaption>動態（{motion.stat().st_size/1e6:.2f} MB）</figcaption></figure>
</div></section>''')
Path(HERE, 'shots', '5.0', 'star-motion-preview.html').write_text(f'''<!doctype html><meta charset="utf-8">
<title>觀星動態卡・素材預覽</title>
<style>
body{{margin:0;background:#14161c;color:#e9e4d8;font:15px/1.6 system-ui,"Noto Sans TC",sans-serif;padding:28px}}
h1{{font-size:22px;margin:0 0 4px}} p.note{{color:#9aa0ab;margin:0 0 24px;max-width:70ch}}
section{{margin-bottom:32px}} h2{{font-size:18px;margin:0 0 10px}}
.pair{{display:flex;gap:20px;flex-wrap:wrap}}
figure{{margin:0}} img{{width:300px;aspect-ratio:5/7;border-radius:14px;display:block;background:#000}}
figcaption{{color:#9aa0ab;font-size:13px;padding-top:6px}}
</style>
<h1>觀星動態卡・素材預覽</h1>
<p class="note">不摳圖：整幅畫的 5:7 視窗直接動起來，視窗跟現有靜卡完全一樣（同一個臉中心、同一個高度）。
來源是「觀星系列 拆四張卡.mp4」以第 120 格（靜卡取的那一格）為中心的 3 秒，24fps，來回播。
這一頁沒有卡框、反光與字體——要判斷的是動態本身與視窗，不是最終卡面。</p>
{''.join(rows)}''', encoding='utf-8')
print('wrote', HERE / 'shots/5.0/star-motion-preview.html')
