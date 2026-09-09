# -*- coding: utf-8 -*-
"""把桌面那兩支 mp4 變成卡面能用的素材。

來源是黑底、沒有 alpha 的 h264（1280x720 / 30fps / 90 格）。卡面的圖層一律是去背
PNG（HANDOFF 三節的 framed 卡型），所以這裡要做三件事：

  1. 去黑底：黑底 AA 邊是「已經跟黑色混過」的顏色，只砍門檻會留一圈暗邊，
     所以砍完要 unpremultiply（rgb / alpha）把邊的顏色還原。
  2. 兩支影片共用同一個裁切框：常態與特殊表情切換時角色不能跳位或縮放，
     所以 bbox 取兩支所有格的聯集，不是各自 trim（trim_card_art.py 是單張才那樣做）。
  3. 輸出兩支 animated WebP：圖層一支（有 alpha，<img> 直接吃），foil mask 一支
     （白底＋alpha，300px）。Chromium 的 mask-image 吃得動 animated WebP，所以箔面
     逐格貼著角色；用靜態的 alpha 聯集當 mask 會在角色外面留一塊會發光的殘影
     （頭被削開那支特別明顯）。mask 要另外出小的，是因為 CSS 自訂屬性值大約
     2M 字元就會被 Chromium 吃掉，圖層那支 base64 完 4.5 MB 塞不進 --subject。

輸出到 _art/holo-test/mtk/。
"""
from pathlib import Path
import io, json, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).parent
OUT = HERE / 'mtk'
OUT.mkdir(exist_ok=True)
SRC = {
    'idle': Path.home() / 'OneDrive/Desktop/mtk1.mp4',
    'shock': Path.home() / 'OneDrive/Desktop/mtk2.mp4',
}
LO, HI = 8, 26          # 去黑底的門檻（max channel）
MAX_EDGE = 500          # 輸出長邊（卡片實際只有 380 CSS px 寬，再大是浪費位元組）
MASK_EDGE = 300         # foil mask 的長邊：只是剪影，不需要跟圖層同解析度
PAD = 6                 # 聯集 bbox 外擴，留給羽化邊
HOLE_MAX = 400          # 補洞上限（px）：瞳孔線稿是幾十 px，真背景缺口是數千 px


def frames(path: Path):
    """解 h264 成 uint8 陣列，一次讀完（90 格 x 1280x720x3 = 250 MB，還好）。"""
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                            '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', str(path)],
                           capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(v) for v in probe.split('x'))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path),
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)


def key(frame: np.ndarray):
    """黑底 → RGBA。回傳 uint8 (h,w,4)。"""
    f = frame.astype(np.float32)
    a = np.clip((f.max(2) - LO) / (HI - LO), 0, 1)

    # 角色內部若有接近黑的色塊（瞳孔、線稿交界）會被門檻打穿，補回來。
    # ⚠ 不能無條件 binary_fill_holes：這隻角色的裙子與尾巴之間有一塊 6845 px
    # 的真背景缺口，整個填掉會在卡上留一塊黑斑（實測過）。只填小洞。
    solid = a > 0.5
    holes = ndimage.binary_fill_holes(solid) & ~solid
    lab, n = ndimage.label(holes)
    if n:
        area = ndimage.sum(holes, lab, range(1, n + 1))
        small = np.zeros(n + 1, bool)
        small[1:] = area <= HOLE_MAX
        a[small[lab]] = 1.0

    # unpremultiply：邊緣像素是 C*α 混在黑底上，除回去才不會留暗邊
    rgb = np.where(a[..., None] > 0.004, f / np.maximum(a[..., None], 0.004), 0)
    return np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)


keyed = {}
for name, path in SRC.items():
    if not path.exists():
        sys.exit('missing source video: %s' % path)
    keyed[name] = [key(f) for f in frames(path)]
    print(name, len(keyed[name]), 'frames', keyed[name][0].shape)

# 兩支共用的裁切框
box = None
for seq in keyed.values():
    for rgba in seq:
        b = Image.fromarray(rgba).getchannel('A').getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
H, W = keyed['idle'][0].shape[:2]
box = (max(0, box[0] - PAD), max(0, box[1] - PAD), min(W, box[2] + PAD), min(H, box[3] + PAD))
cw, ch = box[2] - box[0], box[3] - box[1]
scale = MAX_EDGE / max(cw, ch)
size = (round(cw * scale), round(ch * scale))
print('shared bbox', box, '->', size)

manifest = {'source': {k: str(v) for k, v in SRC.items()}, 'bbox': list(box),
            'size': list(size), 'threshold': [LO, HI], 'files': {}}

for name, seq in keyed.items():
    ims = [Image.fromarray(rgba).crop(box).resize(size, Image.Resampling.LANCZOS) for rgba in seq]

    buf = io.BytesIO()
    ims[0].save(buf, format='WEBP', save_all=True, append_images=ims[1:],
                duration=33, loop=0, quality=78, method=5, minimize_size=True)
    (OUT / ('mtk-%s.webp' % name)).write_bytes(buf.getvalue())

    # foil mask 另出一支「白底＋alpha」的動畫：mask 只吃 alpha，RGB 全白壓起來幾乎不佔
    # 位元組。不能直接拿角色動畫當 mask——Chromium 的 CSS 自訂屬性值大約 2M 字元就會
    # 被吃掉（實測 setProperty 靜默失敗），4.5 MB 的 base64 塞不進 --subject。
    mask_size = (round(size[0] * MASK_EDGE / max(size)), round(size[1] * MASK_EDGE / max(size)))
    masks = []
    for im in ims:
        m = Image.new('RGBA', size, 'white')
        m.putalpha(im.getchannel('A'))
        masks.append(m.resize(mask_size, Image.Resampling.LANCZOS))
    mb = io.BytesIO()
    masks[0].save(mb, format='WEBP', save_all=True, append_images=masks[1:],
                  duration=33, loop=0, quality=70, method=4, minimize_size=True)
    (OUT / ('mtk-%s-mask.webp' % name)).write_bytes(mb.getvalue())

    still = io.BytesIO()
    ims[0].save(still, format='WEBP', quality=90, method=5)
    (OUT / ('mtk-%s-still.webp' % name)).write_bytes(still.getvalue())

    manifest['files']['mtk-%s.webp' % name] = {
        'frames': len(ims), 'bytes': len(buf.getvalue()), 'mask_bytes': len(mb.getvalue()),
        'mask_size': list(mask_size), 'still_bytes': len(still.getvalue())}
    print('%-6s anim %6.1f KiB  mask %6.1f KiB  still %5.1f KiB' % (
        name, len(buf.getvalue()) / 1024, len(mb.getvalue()) / 1024, len(still.getvalue()) / 1024))

(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
print('wrote', OUT)
