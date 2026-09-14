# -*- coding: utf-8 -*-
"""把收藏卡（魔花少女）改成**跟 2.0 卡冊一樣的原生精裝卡面**，不要再用 iframe。

使用者 2026-09-14：「卡片沒有完整還原精裝卡該有的品質」「為什麼 2.0 的顯示都很正常，
1.0 這邊顯示精裝卡這麼醜」「我不是說獨立作業面嗎，你直接把 2.0 的程式碼拿來用不就好了」
「收藏卡的品質要跟 2.0 的卡冊一樣好」。

**根因**：2.0 的 71 張卡是用 `ClickerHolo.face()`（原生 DOM 的 HoloCardFace，跑在 shadow root 裡）畫的；
收藏卡卻是塞一個 iframe 去嵌那張 10.5 MB 的獨立頁 —— 兩條完全不同的路，品質當然不一樣，
而且 iframe 還帶來模糊、FPS、字型三個附帶問題。

這支把那張獨立頁拆成 2.0 吃得下的素材：

  src/apoc/art/collect-*.webp      主體／背景／替身動作／替身遮罩
  src/apoc/masks/collect-*.webp    主體遮罩（圖內視差用）
  src/apoc/holo-special.css        `.r-special` 的卡面樣式（共用 CSS 沒有這個階級）
  src/apoc/collect.js              window.ApocCollect：卡片資料＋素材對照＋階級註冊

⚠ 「特殊」是這張卡自己新增的階級。`card-face.js` 是凍結檔不能改，
   所以 LABEL／ZLIFT／TILT 要在外面補一筆（原頁也是這樣做的）。

用法：python tools/apoc/build_collect_card.py [來源.html]
預設來源：使用者桌面那份「魔花少女卡面莓紫.html」。
"""
import base64, io as _io, json, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
APOC = ROOT / 'src' / 'apoc'
DEFAULT_SRC = Path(r'C:\Users\ASUS User VII\Desktop\新卡\u04g\魔花少女卡面莓紫.html')

def block(html, id_):
    m = re.search(r'<script[^>]*id="' + id_ + r'"[^>]*>(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None

EXT = {'image/svg+xml': '.svg', 'image/webp': '.webp', 'image/png': '.png',
       'image/jpeg': '.jpg', 'image/gif': '.gif'}

def save_uri(uri, dest_dir, stem):
    """data URI → 檔案，**原封不動寫出去，不重新編碼**。

    ⚠ 這裡踩過一次：原本用 PIL 轉成無損 WebP，結果主體是**90 幀的動畫 WebP**
      （卡片會動），PIL 預設只存第一幀——2.8 MB 變成 162 KB，卡就不動了，而且不報錯。
      這些素材本來就已經是壓好的 webp／png，直接搬位元組最保險也最忠實。"""
    head, b64 = uri.split(',', 1)
    raw = base64.b64decode(b64)
    mime = head.split(':', 1)[1].split(';', 1)[0]
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / (stem + EXT.get(mime, '.bin'))
    dest.write_bytes(raw)
    # 動畫的幀數印出來，下次再壞掉一眼就看得到
    frames = 1
    if mime != 'image/svg+xml':
        try: frames = getattr(Image.open(_io.BytesIO(raw)), 'n_frames', 1)
        except Exception: pass
    return dest, frames

def _blocks(css):
    """把一段 CSS 切成最上層的區塊：(前綴, 內容) —— 前綴是選擇器或 at-rule 的頭。
       用括號配對切，不用正規式：正規式表達不了巢狀的 at-rule（見下面 special_css 的教訓）。"""
    out, depth, start, head = [], 0, 0, None
    for i, ch in enumerate(css):
        if ch == '{':
            depth += 1
            if depth == 1: head = css[start:i]; body_start = i + 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                out.append((head.strip(), css[body_start:i])); start = i + 1
    return out


def special_css(html):
    """挑出 `.r-special` 的規則。整頁 CSS 有 1.2 MB，但其中只有兩個 style 區塊碰這個階級，
       其餘是共用的卡面 CSS（src/apoc/holo.css 已經有了）與這一頁自己的頁面外觀（body／h1／.hint）。
       頁面外觀不要搬——搬過去會把卡冊的底色一起換掉。

    ⚠ 第一版用一條正規式掃 `選擇器{宣告}`，**表達不了巢狀的 at-rule**：
      `@media(prefers-reduced-motion:reduce){ .r-special .gift-hearts>i{animation:none} … }`
      被拆成「@media 那一行（選擇器裡沒有 r-special，丟掉）」＋「裡面那幾條規則（照收）」，
      於是「只有關掉動態才生效」的 animation:none 變成**無條件**套用。
      結果：收藏卡的 16 顆愛心永遠不動（getAnimations() 全 0、computed animationName 'none'），
      而且一聲不吭——CSS 沒有錯誤、卡面照畫，只是少了整層動畫。
      所以 at-rule 一定要連著外殼一起搬。"""
    out = []
    for css in re.findall(r'<style[^>]*>(.*?)</style>', html, re.S):
        if 'r-special' not in css: continue
        for head, body in _blocks(css):
            if head.startswith('@keyframes'):
                out.append(f'{head}{{{body}}}'); continue
            if head.startswith('@'):                     # @media／@supports⋯⋯：遞迴挑，外殼保留
                inner = [f'{h}{{{b}}}' for h, b in _blocks(body)
                         if h.startswith('@keyframes') or 'r-special' in h]
                if inner: out.append(head + '{\n ' + '\n '.join(inner) + '}')
                continue
            if 'r-special' not in head: continue          # 只要這個階級的
            out.append(f'{head}{{{body}}}')
    return '\n'.join(out)

def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        print(f'✗ 找不到來源 {src}'); sys.exit(1)
    html = _io.open(src, encoding='utf-8', newline='').read()
    print(f'來源 {src.name}  {len(html)/1e6:.2f} MB')

    card = block(html, 'card-data'); assets = block(html, 'asset-data'); masks = block(html, 'mask-data')
    if not (card and assets and masks):
        print('✗ 找不到 card-data／asset-data／mask-data，頁面結構變了'); sys.exit(1)
    print(f'卡片：{card["name"]}（{card["id"]}・{card["rarity"]}・{card["kind"]}）')

    amap, mmap = {}, {}
    for key, uri in assets.items():
        stem = 'collect-' + re.sub(r'[^a-z0-9\-]', '-', key.lower().replace('.png', '').replace('layer-', ''))
        p, frames = save_uri(uri, APOC / 'art', stem)
        amap[key] = f'art/{p.name}'
        print(f'  素材 {key:<38} → {p.name}  {p.stat().st_size/1024:>5.0f} KB' + (f'  {frames} 幀' if frames > 1 else ''))
    for key, uri in masks.items():
        stem = 'collect-' + re.sub(r'[^a-z0-9\-]', '-', key.lower().replace('.png', '').replace('layer-', ''))
        p, frames = save_uri(uri, APOC / 'masks', stem)
        mmap[key] = f'masks/{p.name}'
        print(f'  遮罩 {key:<38} → {p.name}  {p.stat().st_size/1024:>5.0f} KB' + (f'  {frames} 幀' if frames > 1 else ''))

    css = special_css(html)
    (APOC / 'holo-special.css').write_text(
        '/* 收藏卡的「特殊」階級卡面。由 tools/apoc/build_collect_card.py 從獨立頁抽出來，\n'
        '   共用的 holo.css 沒有 .r-special（原頁註解：「只寫在這一頁，卡池與抽卡頁不受影響」）。\n'
        '   ⚠ 不要手改這個檔，改了下次重跑會被蓋掉。 */\n' + css, encoding='utf-8')
    print(f'  樣式 .r-special → holo-special.css  {len(css)/1024:.1f} KB')

    js = ('// 收藏卡：卡片資料＋素材對照＋新階級註冊。由 tools/apoc/build_collect_card.py 產生，不要手改。\n'
          '// 「特殊」是這張卡自己新增的階級；card-face.js 是凍結檔，所以標籤與參數在外面補。\n'
          'window.ApocCollect = ' + json.dumps({
              'entries': {card['id']: card},
              'assets': amap,
              'masks': mmap,
              'rarity': {'label': {'special': '特殊'}, 'zlift': {'special': 56}, 'tilt': {'special': 14}},
              'bodyClass': ['font-system', 'gem-faceted', 'ink-chroma'],
          }, ensure_ascii=False, indent=1) + ';\n')
    (APOC / 'collect.js').write_text(js, encoding='utf-8')
    print(f'  資料 → collect.js  {len(js)/1024:.1f} KB')
    print('✓ 抽取完成')

if __name__ == '__main__':
    main()
