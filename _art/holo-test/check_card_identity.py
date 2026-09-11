"""Verify embedded encoded bytes first, then exact decoded pixels, per card layer."""
import base64
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image
from card_assets import HERE, assets, keys
from pool_data import pool

FILES = dict(gacha='deluxe-gacha-b.html', **{'gacha-standalone':'deluxe-gacha-b-standalone.html',
    'gacha-test':'deluxe-gacha-b-test.html','gacha-test-standalone':'deluxe-gacha-b-test-standalone.html',
    'pool':'cards-remade.html','pool-standalone':'cards-remade-standalone.html','team':'map20.html'})

def extract(entry, page):
    pattern = r'const TEAM_DATA=(\{.*?\});' if entry == 'team' else (
        r'const __A=(\{.*?\});' if entry.startswith('pool') else r'const __CARD_ASSETS=(\{.*?\});')
    data = json.loads(re.search(pattern, page, re.S)[1])
    return (data['images'], data['cards']) if entry == 'team' else (data, pool())

def measure():
    authority = assets()
    # Repeated embedded URIs are byte-identical: decode each unique URI once.
    # This retains exact RGBA comparison while avoiding 454 redundant decodes.
    decoded = {}
    def image(uri):
        if uri not in decoded:
            raw=base64.b64decode(uri.split(',',1)[1],validate=True)
            with Image.open(io.BytesIO(raw)) as im:
                decoded[uri]=(hashlib.sha256(raw).hexdigest(),len(raw),list(im.size),im.convert('RGBA').tobytes())
        return decoded[uri]
    result = {}
    for entry, file in FILES.items():
        table, cards = extract(entry, (HERE/file).read_text(encoding='utf-8'))
        rows = []
        for card in cards:
            for key in keys(card):
                uri = table[key]
                sha,count,size,pixels=image(uri)
                ref_sha,_,ref_size,ref_pixels=image(authority[key])
                pixels_equal=size==ref_size and pixels==ref_pixels
                rows.append(dict(card=card['id'],key=key,sha256=sha,
                    authoritySha256=ref_sha, bytes=count, size=size,
                    identical=uri == authority[key], pixelsEqual=pixels_equal))
        result[entry] = rows
    return result

def valid(result):
    return isinstance(result,dict) and set(result)==set(FILES) and all(rows and all(
        r['identical'] is True and r['pixelsEqual'] is True and r['sha256']==r['authoritySha256']
        and r['bytes']>0 and 0<r['size'][0]<=600 and 0<r['size'][1]<=840 for r in rows) for rows in result.values())

if __name__ == '__main__':
    out=HERE.parents[1]/'docs/clicker/shots/identical/identity.json'
    result=measure()
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('PASS' if valid(result) else 'FAIL',sum(map(len,result.values())),'embedded card layers')
    raise SystemExit(0 if valid(result) else 1)
