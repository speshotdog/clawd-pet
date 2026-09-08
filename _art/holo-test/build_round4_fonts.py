from pathlib import Path
import base64, re
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).parent
html = (root / 'demo.html').read_text(encoding='utf-8')
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
    subset.Subsetter(opts).subset(font)
    subset.save_font(font, str(out), opts)
    blob = base64.b64encode(out.read_bytes()).decode('ascii')
    html = html.replace(marker, blob)
    print(source.name, len(blob), 'base64 chars')
(root / 'demo.html').write_text(html, encoding='utf-8')
print('glyphs:', len(chars))
