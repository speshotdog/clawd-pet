"""One persistent encoding per card layer, shared by every production entry.

600 x 840 is the bounding box: cutout aspect ratios must not be distorted.
Lossless WebP preserves the final resized RGBA pixels, including hidden RGB.
Only update_demo_data rebuilds this authority; consumers never encode artwork.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from pool_data import pool

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / 'card-assets.json'

def keys(card):
    return [f"layer-{card['id']}-{part}.png" for part in ('subject','background')] if card.get('scene') else [card['file']]

def build():
    target = HERE / 'card-assets'
    target.mkdir(exist_ok=True)
    records = {}
    for c in pool():
        for key in keys(c):
            source = HERE / key if key.startswith('layer-') else HERE / 'art' / key
            source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
            dest = target / (source_hash + '.webp')
            with Image.open(source) as im:
                im = im.convert('RGBA')
                im.thumbnail((600,840), Image.Resampling.LANCZOS)
                if not dest.exists():
                    # 使用者裁決 2026-09-12：維持無損，「遊戲好看就好」。
                    # ⚠ 無損不是三面一致的必要條件——一致靠的是「全線共用同一串 bytes」，
                    #   不是「編碼無損」。共用一份 quality 90 的 lossy 也一樣能做到逐像素相同，
                    #   檔案會從 11-16 MB 回到 5 MB 級。
                    #   除非之後真的遇到效能問題，否則不要自作主張改回 lossy。
                    #   改了就要重跑 check_card_identity.py 與整條像素驗收。
                    im.save(dest, 'WEBP', lossless=True, exact=True, method=6)
                raw = dest.read_bytes()
                with Image.open(io.BytesIO(raw)) as decoded:
                    assert decoded.convert('RGBA').tobytes() == im.tobytes()
                records[key] = dict(path=dest.relative_to(HERE).as_posix(), sourceSha256=source_hash,
                    sha256=hashlib.sha256(raw).hexdigest(), size=list(im.size), bytes=len(raw))
    MANIFEST.write_text(json.dumps(records, indent=2), encoding='utf-8')

def assets(cards=None):
    records = json.loads(MANIFEST.read_text(encoding='utf-8'))
    result = {}
    for c in cards if cards is not None else pool():
        for key in keys(c):
            rec = records[key]
            source = HERE / key if key.startswith('layer-') else HERE / 'art' / key
            assert hashlib.sha256(source.read_bytes()).hexdigest() == rec['sourceSha256'], 'Rebuild authority: ' + key
            raw = (HERE / rec['path']).read_bytes()
            assert hashlib.sha256(raw).hexdigest() == rec['sha256'], key
            result[key] = 'data:image/webp;base64,' + base64.b64encode(raw).decode('ascii')
    return result
