"""Gray P95 at ring/wave attack and decay samples, on both actual builds."""
from pathlib import Path
from tempfile import TemporaryDirectory
from io import BytesIO
import json,shutil
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance
from check_gacha_ceremony_round30 import pixels

def percentile(im,mask):
 h=im.histogram(mask=mask);target=sum(h)*.95;n=0
 for value,count in enumerate(h):
  n+=count
  if n>=target:return value
rows=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='luminance29-') as tmp:
 b=pw.chromium.launch();copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
  # Round30 supersedes the old upper ceiling: same pixel intent, denser samples,
  # and measured original-relative floors. Never weaken to a CSS-variable check.
  rows.extend(pixels(b,file,label))
 b.close()
(OUT/'luminance.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
