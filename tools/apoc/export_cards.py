# -*- coding: utf-8 -*-
"""把末世卡池的卡面輸出成獨立圖檔，給 1.0 的畫面直接用。

原本末世的卡面只存在 src/apoc/index.html 那 22 MB 的內嵌資料裡（iframe 專用），
主畫面拿不到——所以末世的夥伴列、技能槽、卡冊都沒有縮圖。
這支把 71 張卡輸出成 src/apoc/cards/<id>.webp（連 scene 卡也先合成成一張），
並把 src 欄位寫進 src/apoc/pool.js。

用法：python tools/apoc/export_cards.py
"""
import json, sys
from pathlib import Path
from PIL import Image

HOLO = Path(r'D:/claude研究/clawd-pet-50/_art/holo-test')
V3 = Path(__file__).resolve().parents[2]
OUT = V3 / 'src/apoc/cards'
sys.path.insert(0, str(HOLO))
from pool_data import pool

SIZE = (300, 420)   # 卡冊最大就是這個尺寸；再大只是浪費頻寬


def face(card):
    """回傳這張卡的 600×840 卡面（scene 卡把主體疊回背景）。"""
    if card.get('scene'):
        bg = Image.open(HOLO / f"layer-{card['id']}-background.png").convert('RGBA')
        sub = Image.open(HOLO / f"layer-{card['id']}-subject.png").convert('RGBA')
        if sub.size != bg.size: sub = sub.resize(bg.size, Image.LANCZOS)
        bg.alpha_composite(sub); return bg
    return Image.open(HOLO / 'art' / card['file']).convert('RGBA')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cards, total = [], 0
    for c in pool():
        im = face(c)
        im.thumbnail(SIZE, Image.LANCZOS)
        dest = OUT / f"{c['id']}.webp"
        im.convert('RGB').save(dest, 'WEBP', quality=82, method=4)
        total += dest.stat().st_size
        # 欄位形狀跟 GachaPool.CATALOG 一模一樣：這樣 1.0 的卡面／頭像／卡冊都能直接吃末世卡
        cards.append({'id': c['id'], 'name': c['name'], 'rarity': c['rarity'], 'kind': 'char',
                      'src': f"apoc/cards/{c['id']}.webp", 'bleed': True})
    (V3 / 'src/apoc/pool.js').write_text(
        'window.ApocPool=' + json.dumps(cards, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{len(cards)} 張卡 → {OUT}（共 {total/1e6:.2f} MB，平均 {total/len(cards)/1024:.0f} KB）')


if __name__ == '__main__':
    main()
