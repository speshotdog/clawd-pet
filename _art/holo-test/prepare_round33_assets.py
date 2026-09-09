"""Crop the existing back only; convert the generator's rendered pack outputs."""
from pathlib import Path
from PIL import Image
import sys
HERE=Path(__file__).resolve().parent
if '--back' in sys.argv:
    source=HERE.parents[1]/'docs/clicker/shots/round33/before-deluxe-back.webp'
    im=Image.open(source)
    # 430 x 602, same 5:7 ratio; account for the original's asymmetric bottom margin.
    im=im.crop((35,43,465,645)).resize((500,700),Image.Resampling.LANCZOS)
    im.save(HERE/'cardback/deluxe-back.png')
    im.save(HERE/'cardback/deluxe-back.webp',quality=85,method=6)
else:
    for name in ['foil-pack','foil-tear']:
        Image.open(HERE/f'fx/{name}.png').save(HERE/f'fx/{name}.webp',quality=82,method=6)
print('assets prepared',sys.argv[1:])
