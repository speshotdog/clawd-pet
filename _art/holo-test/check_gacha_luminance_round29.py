"""Gray P95 at ring/wave attack and decay samples, on both actual builds."""
from pathlib import Path
from tempfile import TemporaryDirectory
from io import BytesIO
import json,shutil
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round28 import HERE,OUT,BY,open_page,start,advance

def percentile(im,mask):
 h=im.histogram(mask=mask);target=sum(h)*.95;n=0
 for value,count in enumerate(h):
  n+=count
  if n>=target:return value
rows=[]
with sync_playwright() as pw,TemporaryDirectory(dir=OUT,prefix='luminance29-') as tmp:
 b=pw.chromium.launch();copy=Path(tmp)/'index.html';shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',copy)
 for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',copy)]:
  for rarity in BY:
   p,errors=open_page(b,file.as_uri());p.set_viewport_size({'width':1440,'height':900});start(p,[BY[rarity]]);advance(p,1480);last=0;measurements=[]
   for t in [24,60,84,100,120,180,204,240,400,660,850]:
    advance(p,t-last);last=t;p.evaluate('__syncAnimations()');im=Image.open(BytesIO(p.screenshot())).convert('L');box=p.locator('.reveal-flip').bounding_box()
    rect=(box['x'],box['y'],box['x']+box['width'],box['y']+box['height']);card=Image.new('L',im.size,0);ImageDraw.Draw(card).rectangle(rect,fill=255)
    bg=Image.new('L',im.size,0);draw=ImageDraw.Draw(bg);draw.rectangle((0,80,1439,800),fill=255);draw.rectangle(rect,fill=0)
    a,c=percentile(im,bg),percentile(im,card);ratio=a/max(c,1);assert ratio<(.85 if rarity in ['legendary','mythic'] else .65),(label,rarity,t,a,c,ratio)
    measurements.append({'after_face_ms':t,'background_p95':a,'card_p95':c,'ratio':ratio})
   assert not errors;p.close();rows.append({'entry':label,'rarity':rarity,'samples':measurements});print(label,rarity,max(x['ratio'] for x in measurements),flush=True)
 b.close()
(OUT/'luminance.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
