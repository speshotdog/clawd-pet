"""Export the standalone clicker to a static host; no build or server needed."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
DEST = ROOT / 'dist-web'


def main():
    files = set()
    for pattern in ['clicker*.*', 'apoc/**', 'chipforge/**', 'fonts/**', 'gacha-audio.js',
                    'gacha-fx.js', 'gacha-card.js', 'gacha-card.css',
                    'gacha-mode-runtime.js', 'gacha-mode-*.js', 'gacha-pool.js',
                    'character-config.js', 'update-notes.js', 'gacha-*.png', 'gacha-*.jpg', 'toy-*.png', 'card-*.png', 'monster-*.png']:
        files.update(p for p in SRC.glob(pattern) if p.is_file())
    for folder in ['chipforge', 'fonts', 'apoc']:   # v3：末世殼的自包含頁
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
    # 防快取：CSS／JS 連結加上 main 的 short hash（2026-09-07 玩家拿到新 JS 配舊 CSS：新卡圖沒被限制大小、卡冊翻頁鍵還是舊的）
    import subprocess, hashlib
    ver = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT).decode().strip()
    # ⚠ commit hash 只在「已經提交」時才代表內容。工作區有未提交的改動時，HEAD 沒變、
    #   ?v= 就跟上一次部署一模一樣，於是玩家拿到**新 HTML 配快取裡的舊 JS**——
    #   正是上面那條註解在防的事故（2026-09-07 新卡圖沒被限制大小、翻頁鍵還是舊的）。
    #   所以工作區髒的時候，改用實際要送出去的 css／js 內容算一個短雜湊。
    dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT).decode().strip()
    if dirty:
        h = hashlib.sha1()
        for path in sorted(p for p in files if p.suffix in ('.css', '.js')):
            h.update(path.relative_to(SRC).as_posix().encode()); h.update(path.read_bytes())
        ver = 'wip' + h.hexdigest()[:7]
        print(f'  工作區有未提交的改動 → 防快取版本用內容雜湊 {ver}（不是 HEAD）')
    html = re.sub(r'((?:href|src)=")([^"?]+\.(?:css|js))(")', lambda m: f'{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}', html)
    (DEST / 'index.html').write_text(html.replace('</body>', templates + '\n</body>'), encoding='utf8')
    shutil.copy2(ROOT / 'docs/clicker/shots/v6-scene.png', DEST / 'og.png')
    # 清掉上一次匯出留下、這一次已經不該存在的檔案。
    # ⚠ 這支本來只複製、從不刪除：src 裡刪掉的東西會永遠留在 dist-web，然後一路被部署出去。
    #   2026-09-14 抓到的實例：收藏卡改成原生渲染之後，退役的 apoc/mohuashaonv.html（10.5 MB）
    #   還是照樣上線、線上照樣下載得到。
    keep = {DEST / p.relative_to(SRC) for p in files} | {DEST / 'index.html', DEST / 'og.png'}
    stale = [p for p in sorted(DEST.rglob('*')) if p.is_file() and p not in keep]
    for p in stale:
        print(f'  刪除殘留 {p.relative_to(DEST).as_posix()}	{p.stat().st_size}')
        p.unlink()
    for d in sorted((p for p in DEST.rglob('*') if p.is_dir()), key=lambda p: -len(p.parts)):
        if not any(d.iterdir()): d.rmdir()
    if stale: print(f'  （共清掉 {len(stale)} 個檔案）')
    exported = sorted(p for p in DEST.rglob('*') if p.is_file())
    size = sum(p.stat().st_size for p in exported)
    print(f'{len(exported)} files, {size:,} bytes ({size / 1024**2:.2f} MiB) -> {DEST}')
    for p in exported:
        print(f'{p.relative_to(DEST).as_posix()}\t{p.stat().st_size}')


if __name__ == '__main__':
    main()
