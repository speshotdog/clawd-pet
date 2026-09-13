# -*- coding: utf-8 -*-
"""把「精裝卡面」（HoloCardFace）整套搬進主頁，改成真實檔案而不是內嵌 data URI。

使用者 2026-09-13：「目前所有卡 71 張都是精裝，舊版的也全部都翻新了」、卡面用 HoloCardFace。

⚠ 我第一版誤判成「只有 24 張是精裝」，原因是我把去背的主體（art/card-*.png 有 alpha）
   直接壓在黑底上、又沒有卡框，看起來就像 1.0 的舊圖。真正的精裝卡面是 HoloCardFace
   把主體＋背景＋卡框＋寶石＋反光組起來的。

原本這一整套只存在 `src/apoc/index.html`（22 MB）裡面，因為 demo.html 的做法是把卡圖、遮罩、
字型全部 base64 內嵌。`card_face.js` 的 `resolve(name)` 本來就允許各頁自己決定 URL，
所以改成輸出檔案即可——實測扣掉字型的 CSS 只有 60 KB。

輸出（全部在 src/apoc/ 底下）：
  card-face.js      HoloCardFace 本體（從 holo-5.0 複製，不改）
  holo.css          卡面 CSS（url() 改成相對路徑，字型拆成檔案）
  fonts/*.woff2     卡面字型
  art/<key>.webp    71 張精裝卡的圖層（framed 是去背主體、depth 是主體＋背景、flat 是滿版）
  masks/<key>.webp  主體遮罩（做圖內視差用）＋ frame／glitter
  pool.js           末世卡池 71 張（window.ApocPool）＋素材對照表（ApocAssets／ApocMasks）

用法：python tools/apoc/build_holo.py
"""
import base64, json, re, shutil, sys
from pathlib import Path
from PIL import Image
import io as _io

HOLO = Path(r'D:/claude研究/clawd-pet-50/_art/holo-test')
V3 = Path(__file__).resolve().parents[2]
OUT = V3 / 'src/apoc'
sys.path.insert(0, str(HOLO))
from pool_data import pool as full_pool, palettes


def data_uri_bytes(uri):
    return base64.b64decode(uri.split(',', 1)[1])


def save_asset(uri, dest_dir, stem):
    """把 data URI 寫成檔案。點陣圖轉無損 WebP；SVG 原樣寫出去（PIL 讀不了 SVG）。"""
    head, b64 = uri.split(',', 1)
    raw = base64.b64decode(b64)
    if 'image/svg' in head:
        dest = dest_dir / (stem + '.svg'); dest.write_bytes(raw); return dest
    dest = dest_dir / (stem + '.webp')
    Image.open(_io.BytesIO(raw)).save(dest, 'WEBP', lossless=True, method=4, exact=True)
    return dest


def main():
    for sub in ['art', 'masks', 'fonts']:
        (OUT / sub).mkdir(parents=True, exist_ok=True)

    cards = [dict(c) for c in full_pool()]   # 71 張全部
    pal = palettes()
    demo = (HOLO / 'demo.html').read_text(encoding='utf-8')

    # ---- 卡面 CSS（排除 baseline 模板那一段）
    baseline = re.search(r'<template id="baseline-css">.*?</template>', demo, re.S)
    css = '\n'.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', demo, re.S)
                    if not (baseline and baseline.start() <= m.start() < baseline.end()))
    css = css.replace('<style>', '')
    css += (HOLO / 'card-position.css').read_text(encoding='utf-8')

    # 字型：從 @font-face 的 data URI 拆成檔案
    total_font = 0
    for i, rule in enumerate(re.findall(r'@font-face\s*\{[^}]+\}', css)):
        m = re.search(r"url\((?:'|\")?(data:font/[^)'\"]+)", rule)
        if not m: continue
        name = f'holo-{i}.woff2'
        (OUT / 'fonts' / name).write_bytes(data_uri_bytes(m.group(1)))
        total_font += (OUT / 'fonts' / name).stat().st_size
        css = css.replace(rule, rule.replace(m.group(1), f'fonts/{name}'))

    # ---- 素材
    from card_assets import assets as card_assets
    canonical = card_assets(cards)
    masks = json.loads(re.search(r'<script type="application/json" id="mask-data">(.*?)</script>', demo, re.S)[1])

    keys, total_art, total_mask = [], 0, 0
    for c in cards:
        ks = [f"layer-{c['id']}-subject.png", f"layer-{c['id']}-background.png"] if c.get('scene') else [c['file']]
        keys += ks
    art_names, mask_names = {}, {}
    for key in keys:
        d = save_asset(canonical[key], OUT / 'art', Path(key).stem)
        art_names[key] = 'art/' + d.name; total_art += d.stat().st_size
    for key in list(keys) + ['frame', 'glitter']:
        if key in masks:
            d = save_asset(masks[key], OUT / 'masks', Path(key).stem)
            mask_names[key] = 'masks/' + d.name; total_mask += d.stat().st_size

    # CSS 裡的 ${masks.frame} / ${masks.glitter} 與相對路徑素材
    css = css.replace('${masks.frame}', mask_names.get('frame', 'masks/frame.svg'))
    css = css.replace('${masks.glitter}', mask_names.get('glitter', 'masks/glitter.webp'))
    css = css.replace('../../src/', '')          # clicker-star.png 等本來就在 src/ 底下
    # CSS 直接用檔名參照的材質（texture-*.png）也要帶過來
    for name in ['texture-engraving.png', 'texture-fiber.png', 'texture-glitter-atlas.png']:
        src = HOLO / name
        if src.exists() and name in css:
            dest = OUT / 'art' / (Path(name).stem + '.webp')
            Image.open(src).save(dest, 'WEBP', lossless=True, method=4, exact=True)
            css = css.replace(name, 'art/' + dest.name); total_art += dest.stat().st_size
    cardback = HOLO / 'cardback/deluxe-back.webp'
    if cardback.exists():
        shutil.copy2(cardback, OUT / 'art/deluxe-back.webp')
        css = css.replace('cardback/deluxe-back.webp', 'art/deluxe-back.webp')
    (OUT / 'holo.css').write_text(css, encoding='utf-8')
    shutil.copy2(HOLO / 'card_face.js', OUT / 'card-face.js')

    # ---- 卡池
    pool = []
    for c in cards:
        e = {'id': c['id'], 'name': c['name'], 'rarity': c['rarity'], 'kind': c['kind']}
        if c.get('file'): e['file'] = c['file']
        if c.get('scene'): e['scene'] = True
        if c.get('bleed'): e['bleed'] = True
        p = pal.get(c.get('file') or '', {})
        if p: e['pal'] = p
        pool.append(e)
    # 檔名對照表：card_face.js 的 resolve(name) 用它把「素材鍵」換成實際網址
    (OUT / 'pool.js').write_text(
        'window.ApocPool=' + json.dumps(pool, ensure_ascii=False, separators=(',', ':')) + ';\n'
        + 'window.ApocAssets=' + json.dumps(art_names, ensure_ascii=False, separators=(',', ':')) + ';\n'
        + 'window.ApocMasks=' + json.dumps(mask_names, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8')

    print(f'精裝卡 {len(pool)} 張')
    print(f'  卡圖   {total_art/1e6:.2f} MB（{len(keys)} 個圖層）')
    print(f'  遮罩   {total_mask/1e6:.2f} MB')
    print(f'  字型   {total_font/1e6:.2f} MB')
    print(f'  CSS    {len(css)/1024:.0f} KB')
    print(f'  合計   {(total_art+total_mask+total_font+len(css))/1e6:.2f} MB（原本是內嵌在 22 MB 的單頁裡）')


if __name__ == '__main__':
    main()
