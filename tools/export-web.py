"""Export the standalone clicker to a static host; no build or server needed."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
DEST = ROOT / 'dist-web'


def main():
    files = set()
    for pattern in ['clicker*.*', 'chipforge/**', 'fonts/**', 'gacha-audio.js',
                    'gacha-fx.js', 'gacha-card.js', 'gacha-card.css',
                    'gacha-mode-runtime.js', 'gacha-mode-*.js', 'gacha-pool.js',
                    'character-config.js', 'gacha-*.png', 'gacha-*.jpg', 'toy-*.png', 'card-*.png']:
        files.update(p for p in SRC.glob(pattern) if p.is_file())
    for folder in ['chipforge', 'fonts']:
        files.update(p for p in (SRC / folder).rglob('*') if p.is_file() and 'worklet' not in p.parts)
    source = (SRC / 'index.html').read_text(encoding='utf8')
    templates = '\n'.join(re.findall(r'<template\b[^>]*>.*?</template>', source, re.S))
    ids = re.findall(r'<template id="char-([^"]+)"', templates)
    for ident in ids:
        files.update(SRC.glob(ident + '*.png'))
    for href in re.findall(r'(?:href|src)="([^"]+\.png)"', templates):
        files.add(SRC / href)
    for path in sorted(files):
        target = DEST / path.relative_to(SRC)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    # GachaCard fetches index.html for templates. Keep them in the game entry
    # without executing any desktop scripts or changing the shared renderer.
    html = (SRC / 'clicker.html').read_text(encoding='utf8')
    (DEST / 'index.html').write_text(html.replace('</body>', templates + '\n</body>'), encoding='utf8')
    shutil.copy2(ROOT / 'docs/clicker/shots/v6-scene.png', DEST / 'og.png')
    exported = sorted(p for p in DEST.rglob('*') if p.is_file())
    size = sum(p.stat().st_size for p in exported)
    print(f'{len(exported)} files, {size:,} bytes ({size / 1024**2:.2f} MiB) -> {DEST}')
    for p in exported:
        print(f'{p.relative_to(DEST).as_posix()}\t{p.stat().st_size}')


if __name__ == '__main__':
    main()
