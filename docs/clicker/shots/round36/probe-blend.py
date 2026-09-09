import importlib.util,json
from pathlib import Path
from io import BytesIO
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path.cwd();spec=importlib.util.spec_from_file_location('check',root/'_art/holo-test/check_gift_card.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
with sync_playwright() as pw:
 b=pw.chromium.launch();p=b.new_page(viewport={'width':900,'height':1000},device_scale_factor=2);p.goto((root/'_art/holo-test/gift-mohuashaonv.html').as_uri());p.wait_for_timeout(600);c.freeze_art(p)
 p.evaluate("giftCard.card.getAnimations({subtree:true}).filter(a=>a.animationName==='gift-pollen').forEach(a=>{a.pause();a.currentTime=5000;})")
 def shot(name):
  return np.asarray(Image.open(BytesIO(p.locator('#stage').screenshot(path=str(c.SHOTS/(name+'.png'))))).convert('RGB')).astype(float)@np.array([.299,.587,.114])
 hide=p.add_style_tag(content='.gift-particles{visibility:hidden!important}');off=shot('blend-off');hide.evaluate('(e)=>e.remove()');results={}
 for blend in ['screen','normal']:
  p.locator('.gift-particles').evaluate('(e,b)=>e.style.mixBlendMode=b',blend);on=shot('blend-'+blend);d=on-off;results[blend]={'peak':float(d.max()),'pixelsOver6':int((d>6).sum()),'cardGainPercent':float((on.mean()/off.mean()-1)*100)}
 print(results);(c.SHOTS/'blend-probe.json').write_text(json.dumps(results,indent=1));b.close()
