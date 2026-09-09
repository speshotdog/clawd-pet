# -*- coding: utf-8 -*-
"""卡池資料的單一來源，所有建置腳本共用。

以前每支建置腳本各自解析一次 CATALOG、各自決定一次卡型，結果就是新寫的腳本
會把已經定案的規則忘掉（2026-09-09 就發生過：cards-remade 與 deluxe-b 都把
非場景卡寫死成 framed，害規格標明是 flat 的滅世珍獸與玩物就玩物走錯卡型）。
規則只寫在這裡一份。

卡型定案在 docs/clicker/HANDOFF-holo-cards.md 第三節：

  depth   主體與背景拆得開      → subject／background 兩層沿 Z 推開做視差
  flat    有背景但拆不出前後關係 → 整張平鋪，不做圖內視差（所以不掛 subject-mask）
  framed  單一角色去背 PNG      → 卡框卡

CATALOG 的 `bleed: true` 就是在標「這張是整幅畫，不是去背角色」。
"""
from pathlib import Path
import json, re

HERE = Path(__file__).parent
ROOT = (HERE / '../..').resolve()

RANK = {'mythic': 0, 'legendary': 1, 'epic': 2, 'rare': 3, 'common': 4}

# 四張分層場景卡只存在於這條研究線，不在 src/gacha-pool.js 裡
SCENE_CARDS = [
    {'id': 'rocketdog',  'name': '宇宙冒險羊',  'rarity': 'mythic',    'kind': 'depth', 'scene': True},
    {'id': 'alienkitty', 'name': '天外膠膠',    'rarity': 'legendary', 'kind': 'depth', 'scene': True},
    {'id': 'astronaut',  'name': '玥面探索者',  'rarity': 'epic',      'kind': 'depth', 'scene': True},
    {'id': 'fluffdog',   'name': '居家珍獸',    'rarity': 'epic',      'kind': 'depth', 'scene': True},
]


# 2026-09-09: 桌面「新卡\4.0」，只在精裝研究線生效，尚未進遊戲。
EXTRA_CARDS = [
    {'id': ident, 'name': name, 'rarity': rarity, 'kind': kind, 'file': f'card-{ident}.png'}
    for ident, name, rarity, kind in [
        ('miepuxiong', '咩噗熊', 'rare', 'framed'),
        ('waisongmiege', '外送咩鴿', 'rare', 'framed'),
        ('pufayueyue', '普發玥玥', 'rare', 'framed'),
        ('geimieqianhaoma', '給咩錢好嗎', 'epic', 'framed'),
        ('jiaochi', '膠齒', 'rare', 'framed'),
        ('xiaochouyue', '小丑玥', 'epic', 'framed'),
        ('xiaojiaojiao', '小膠膠', 'epic', 'framed'),
        ('chengtiregou', '成體熱狗', 'epic', 'framed'),
        ('bianbiancaihua', '扁扁彩華', 'epic', 'framed'),
        ('yuexiong', '玥熊', 'epic', 'framed'),
        ('jintianwoshengri', '今天我生日', 'legendary', 'framed'),
        ('shabaolingzhu', '沙堡領主', 'mythic', 'flat'),
        ('liulangyueshou', '流浪玥手', 'mythic', 'flat'),
        ('zhenqiqiu', '珍氣球', 'mythic', 'flat'),
        ('zhenjunyue', '真菌玥', 'mythic', 'flat'),
        ('zhenzhen', '珍珍', 'mythic', 'flat'),
    ]
]


def catalog():
    """讀 src/gacha-pool.js 的 CATALOG，回傳有美術素材的卡。

    名字與稀有度一律從這裡讀，不手打也不從檔名推——HANDOFF 第五節第 2 點那次
    「foxfriend 被寫成狐狸朋友」的事故就是這樣來的。
    """
    src = (ROOT / 'src' / 'gacha-pool.js').read_text(encoding='utf-8')
    start = src.index('const CATALOG = [')
    body = src[start:src.index('\n  ];', start)]
    out = []
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith('{ id:'):
            continue
        art = re.search(r"\bsrc:\s*'([^']*)'", line)
        if not art:
            continue                      # 遊戲裡即時組出來的角色與 emoji，沒有卡圖
        bleed = 'bleed: true' in line
        out.append({
            'id': re.search(r"\bid:\s*'([^']*)'", line).group(1),
            'name': re.search(r"\bname:\s*'([^']*)'", line).group(1),
            'rarity': re.search(r"\brarity:\s*'([^']*)'", line).group(1),
            'file': art.group(1),
            'kind': 'flat' if bleed else 'framed',
            **({'bleed': True} if bleed else {}),
        })
    return out


def palettes():
    p = HERE / 'art' / 'palette.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}


def pool(with_scenes=True, with_palette=True, sort_by_rarity=True):
    cards = catalog() + [dict(c) for c in EXTRA_CARDS]
    if with_palette:
        pal = palettes()
        for c in cards:
            c['pal'] = pal.get(c['file'], {})
    if sort_by_rarity:
        cards.sort(key=lambda c: (RANK[c['rarity']], c['id']))
    return (SCENE_CARDS + cards) if with_scenes else cards


if __name__ == '__main__':
    cards = pool()
    kinds = {}
    for c in cards:
        kinds.setdefault(c['kind'], []).append(c['id'])
    print('總數', len(cards))
    for k, ids in kinds.items():
        print(' ', k, len(ids), ids if len(ids) <= 6 else '')
