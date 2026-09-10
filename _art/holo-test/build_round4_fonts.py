from pathlib import Path
import base64, re
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).parent
html = (root / 'demo.html').read_bytes().decode('utf-8')
chars = ''.join(sorted(set(''.join(re.findall(r'[^\x00-\x7f]', html)) + '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz /·°↻')))
text = root / 'round4-font-chars.txt'
text.write_text(chars, encoding='utf-8')
fonts = {
    'ROUND4_NOTO_SANS_DATA': Path(r'C:\Windows\Fonts\NotoSansTC-VF.ttf'),
    'ROUND4_NOTO_SERIF_DATA': Path(r'C:\Windows\Fonts\NotoSerifTC-VF.ttf'),
}
for marker, source in fonts.items():
    out = root / (marker.lower() + '.woff2')
    opts = subset.Options(); opts.flavor = 'woff2'; opts.text = chars; opts.layout_features = ['*']; opts.retain_gids = False
    font = subset.load_font(str(source), opts)
    subsetter = subset.Subsetter(opts)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    subset.save_font(font, str(out), opts)
    blob = base64.b64encode(out.read_bytes()).decode('ascii')
    assert 150_000 <= out.stat().st_size <= 600_000, out
    family = 'Holo Noto Sans' if 'SANS' in marker else 'Holo Noto Serif'
    pattern = r'(@font-face\{font-family:"' + family + r'";src:url\("data:font/woff2;base64,)[^"]+'
    html, count = re.subn(pattern, lambda m: m[1] + blob, html)
    if not count:
        assert marker in html, f'Missing font source: {family}'
        html = html.replace(marker, blob)
    print(source.name, len(blob), 'base64 chars')
(root / 'demo.html').write_bytes(html.encode('utf-8'))
print('glyphs:', len(chars))
