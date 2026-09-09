# -*- coding: utf-8 -*-
"""驗 mtk-card.html：幾何照凍結工法、神話字效、特殊表情會換圖也會換 mask。

跟 check_demo_round8/9 同一套門檻，數字不放寬。輸出截圖到 shots/mtk-*.png。
"""
from io import BytesIO
from pathlib import Path
import json, shutil, sys
from tempfile import TemporaryDirectory
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent
SHOTS = OUT / 'shots'
FROZEN = {'plate': {'left': 4.4, 'right': 4.4, 'bottom': 3.4, 'height': 16.2},
          'media': {'top': 1.7, 'left': 2.4, 'right': 2.4, 'bottom': 3.3}}
TOL = 0.15          # 佔卡片寬/高的百分點


def diff(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / 3


def gem_contrast(page):
    im = Image.open(BytesIO(page.locator('#stage').screenshot())).convert('RGB')
    box = page.evaluate('''() => {
      const s = document.querySelector('#stage').getBoundingClientRect();
      const g = document.querySelector('.face-gem').getBoundingClientRect();
      return {x: g.left - s.left, y: g.top - s.top, w: g.width, h: g.height};
    }''')
    dpr = page.evaluate('devicePixelRatio')      # 截圖是實體像素，box 是 CSS px
    x, y, w, h = (round(box[k] * dpr) for k in ('x', 'y', 'w', 'h'))
    inner = im.crop((x + round(w * .28), y + round(h * .28), x + round(w * .72), y + round(h * .72)))
    rings = [im.crop((max(0, x - 8), max(0, y - 8), min(im.width, x + w + 8), max(0, y - 2))),
             im.crop((max(0, x - 8), min(im.height, y + h + 2), min(im.width, x + w + 8), min(im.height, y + h + 8))),
             im.crop((max(0, x - 8), y, min(im.width, x - 2), min(im.height, y + h))),
             im.crop((min(im.width, x + w + 2), y, min(im.width, x + w + 8), min(im.height, y + h)))]
    g = tuple(round(v) for v in ImageStat.Stat(inner).mean)
    r = tuple(round(sum(ImageStat.Stat(i).mean[k] for i in rings) / len(rings)) for k in range(3))
    return round(diff(g, r), 2), g, r


MEASURE = '''() => {
  const card = document.querySelector('.hcard');
  const c = card.getBoundingClientRect();
  // ⚠ 幾何要量「未變形的佈局盒」。卡面是 preserve-3d + perspective，
  // 文字框在 translateZ 13px 上，用 getBoundingClientRect 量 4.4% 會得到 3.79%
  // （被透視放大），那是投影不是版面。投影超出卡緣多少另外用 maxOverflow 管。
  // offsetLeft/offsetWidth 是整數，4.4% 會量成 4.21%，所以讀 computed 的 used value。
  const W = card.clientWidth, H = card.clientHeight;
  const pct = (el) => { let x = 0, y = 0, n = el;
    while (n && n !== card) { const s = getComputedStyle(n);
      x += parseFloat(s.left) || 0; y += parseFloat(s.top) || 0; n = n.offsetParent; }
    const s = getComputedStyle(el), w = parseFloat(s.width), h = parseFloat(s.height);
    return {left: x / W * 100, right: (W - x - w) / W * 100,
            top: y / H * 100, bottom: (H - y - h) / H * 100,
            height: h / H * 100, width: w / W * 100}; };
  const name = card.querySelector('.face-name'), rarity = card.querySelector('.face-rarity');
  const cx = c.left + c.width / 2;
  const mid = (el) => { const r = el.getBoundingClientRect(); return Math.abs((r.left + r.right) / 2 - cx); };
  const cs = getComputedStyle(name);
  const overflow = [...card.querySelectorAll('.face-plate,.face-text,.face-gem,.face-name,.face-rarity')]
    .map(el => { const r = el.getBoundingClientRect(); return Math.max(
        c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom); });
  return {
    kind: card.dataset.artKind, rarity: card.dataset.rarity, nameFits: card.dataset.nameFits,
    plate: pct(card.querySelector('.face-plate')), media: pct(card.querySelector('.art-media')),
    nameCenterDelta: mid(name), rarityCenterDelta: mid(rarity),
    nameFill: cs.webkitTextFillColor, nameImage: cs.backgroundImage.slice(0, 24),
    nameText: name.textContent, rarityText: rarity.textContent,
    cardWidth: c.width, nameFs: parseFloat(getComputedStyle(card).getPropertyValue('--name-fs')),
    rarityFs: parseFloat(getComputedStyle(card).getPropertyValue('--rarity-fs')),
    gemFs: parseFloat(getComputedStyle(card).getPropertyValue('--gem-fs')),
    maxOverflow: Math.max(...overflow),
    // 單檔版的 src 是 2 MB 的 data URI，不能整條帶回來（assert 訊息會爆掉），
    // 也不能用檔名判斷換圖成功，所以用長度＋尾巴當指紋。
    face: card.dataset.face || 'normal',
    art: (() => { const v = card.querySelector('.art-media img').getAttribute('src');
                  return v.length + ':' + v.slice(-32); })(),
    // 兩張 mask 都是 url("data:image/png;base64,iVBORw0KGgo... 開頭，
    // 只取前 40 字會永遠相等（這條斷言一度假通過），所以用長度＋尾巴當指紋。
    mask: (() => { const v = card.querySelector('.subject-mask').style.getPropertyValue('--subject');
                   return v.length + ':' + v.slice(-40); })(),
    artNatural: [card.querySelector('.art-media img').naturalWidth,
                 card.querySelector('.art-media img').naturalHeight],
  };
}'''


def run(page, uri, label):
    errors, external = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: external.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
    page.goto(uri, wait_until='load')
    page.wait_for_function('Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)')
    page.wait_for_timeout(400)
    assert not errors, errors
    assert not external, external

    m = page.evaluate(MEASURE)
    assert m['kind'] == 'framed' and m['rarity'] == 'mythic', m
    assert m['artNatural'][0] > 0, m
    for key, want in FROZEN.items():
        for side, v in want.items():
            got = m[key][side]
            assert abs(got - v) <= TOL, f'{label} {key}.{side} = {got:.2f}%, 應為 {v}%'
    assert m['nameCenterDelta'] < 2 and m['rarityCenterDelta'] < 2, m
    assert m['nameFits'] == 'true', m
    assert m['maxOverflow'] <= 1.5, m          # 六之四：不准浮出卡外
    # 神話字效：透明填色 ＋ conic 漸層（六之二）
    assert m['nameFill'] == 'rgba(0, 0, 0, 0)', m['nameFill']
    assert m['nameImage'].startswith('conic-gradient'), m['nameImage']
    # 字級照 290px 基準換算（六之五）
    w = m['cardWidth']
    assert abs(m['nameFs'] - w * 24 / 290) < .05 or m['nameFs'] < w * 24 / 290, m
    assert abs(m['rarityFs'] - w * 13.5 / 290) < .05, m
    assert abs(m['gemFs'] - w * 22 / 290) < .05, m
    delta, gem_rgb, ring_rgb = gem_contrast(page)
    assert delta >= 35, f'{label} 寶石對比 {delta} < 35（gem {gem_rgb} / ring {ring_rgb}）'

    page.locator('#stage').screenshot(path=str(SHOTS / f'mtk-{label}-normal.png'))

    # ── 特殊表情 ────────────────────────────────────────────
    page.locator('.hcard').click()
    page.wait_for_timeout(120)
    s = page.evaluate(MEASURE)
    assert s['face'] == 'special', s['face']
    assert s['art'] != m['art'], '點了卡片但圖沒換'
    assert s['mask'] != m['mask'], '換了圖但 mask 沒換，箔面會停在舊剪影上'
    assert page.locator('#state').inner_text() == '特殊表情'
    page.wait_for_timeout(900)
    page.locator('#stage').screenshot(path=str(SHOTS / f'mtk-{label}-special.png'))

    page.wait_for_timeout(2600)               # 3000ms 播完自己回常態
    back = page.evaluate(MEASURE)
    assert back['face'] == 'normal' and back['art'] == m['art'], back['face']
    assert back['mask'] == m['mask'], back['mask']
    assert page.locator('#state').inner_text() == '常態'

    print(f'  {label}: 幾何 OK・寶石對比 {delta}・{m["nameText"]} / {m["rarityText"]}'
          f'・卡寬 {w:.0f}px・字級 {m["nameFs"]:.2f}/{m["rarityFs"]:.2f}/{m["gemFs"]:.2f}')
    return {'label': label, 'gem_delta': delta, **m}


SHOTS.mkdir(exist_ok=True)
report = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={'width': 900, 'height': 1000}, device_scale_factor=2)
    src = OUT / 'mtk-card.html'
    report.append(run(page, src.as_uri(), 'dev'))
    # 搬到別的資料夾也要能開：頁面裡不可以有相對路徑素材
    with TemporaryDirectory() as tmp:
        copy = Path(tmp) / src.name
        shutil.copy(src, copy)
        report.append(run(page, copy.as_uri(), 'moved-copy'))
    browser.close()

(OUT / 'verification-mtk.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
print('OK ·', len(report), 'entr%s' % ('y' if len(report) == 1 else 'ies'))
