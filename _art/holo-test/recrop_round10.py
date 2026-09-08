"""Round 10 re-crop: tighter framing for two scene cards, per the user's note.

  astronaut  -> 玥面探索者   "畫面特寫一點人物"
  alienkitty -> 天外膠膠     "特寫一點，人物跟行星都是主體，重新構圖"

This is a re-crop of the existing artwork, not a redraw - the drawing style stays
exactly as it was. Both layers of a card get the same crop rectangle so the
subject/background parallax still lines up. Crops keep the 5:7 card ratio and are
resampled back to 600x840.

Originals are in git history (round 2's compose output); run this from a clean
checkout of those files, it is not idempotent on already-cropped layers.
"""
from pathlib import Path
from PIL import Image
import subprocess

OUT = Path(__file__).parent
SIZE = (600, 840)

# (left, top, width) - height follows from the 5:7 card ratio
CROPS = {
    'astronaut':  (106, 171, 400),
    'alienkitty': (150, 252, 420),
}


def original(name, layer):
    """Read the pre-crop layer out of git so re-running never stacks crops."""
    rel = f'_art/holo-test/layer-{name}-{layer}.png'
    blob = subprocess.run(['git', 'show', f'd540b5f:{rel}'], cwd=OUT.parent.parent,
                          capture_output=True, check=True).stdout
    tmp = OUT / f'.orig-{name}-{layer}.png'
    tmp.write_bytes(blob)
    return tmp


for name, (left, top, width) in CROPS.items():
    height = round(width * 7 / 5)
    for layer in ('subject', 'background'):
        tmp = original(name, layer)
        im = Image.open(tmp)
        assert im.size == SIZE, (name, layer, im.size)
        box = (left, top, left + width, top + height)
        assert box[2] <= SIZE[0] and box[3] <= SIZE[1], (name, box)
        out = im.crop(box).resize(SIZE, Image.Resampling.LANCZOS)
        out.save(OUT / f'layer-{name}-{layer}.png')
        tmp.unlink()
    print(f'{name}: cropped {width}x{height} at ({left},{top}) -> 600x840')
