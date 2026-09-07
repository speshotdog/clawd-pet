"""把 imagegen 產出的透明 PNG 裁邊 + 縮到目標高度，寫進 src/。
用法: python _art/postproc.py <來源png> <輸出檔名> <目標高度>
"""
import sys, os
from PIL import Image

def main(src, name, h):
    im = Image.open(src).convert('RGBA')
    a = im.getchannel('A')
    # 去掉幾乎透明的雜點再裁邊
    im.putalpha(a.point(lambda v: 0 if v < 8 else v))
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    h = int(h)
    if im.height != h:
        im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
    out = os.path.join('src', name)
    im.save(out)
    print(f'{name} {im.size}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
