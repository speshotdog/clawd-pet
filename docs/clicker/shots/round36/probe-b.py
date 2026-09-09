import importlib.util,json
from pathlib import Path
from io import BytesIO
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path.cwd(); spec=importlib.util.spec_from_file_location('check',root/'_art/holo-test/check_gift_card.py'); c=importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
css=(root/'_art/holo-test/build_gift_card.py').read_text(encoding='utf-8').split('<style id="gift-stage">')[1].split('</style>')[0]
with sync_playwright() as pw:
 b=pw.chromium.launch();p=b.new_page(viewport={'width':900,'height':1000},device_scale_factor=2);p.goto((root/'_art/holo-test/gift-mohuashaonv.html').as_uri());p.wait_for_timeout(600);c.freeze_art(p);p.add_style_tag(content=css)
 print('A',c.text_contrast(p,'.face-name'),{x:c.text_contrast(p,'.face-rarity',x) for x in ['特殊','SPECIAL']})
 ring=np.asarray(Image.open(c.SHOTS/'frame-ring-dev.png'))>0
 base=json.loads((c.SHOTS/'baseline-dev.json').read_text())['stats'];results=[]
 for dark in [1.3,1.6,2,2.5,3]:
  style=p.add_style_tag(content='.r-special .face-frame{filter:brightness('+str(dark)+')}')
  a=np.asarray(Image.open(BytesIO(p.locator('#stage').screenshot())).convert('RGB')).astype(float)@np.array([.299,.587,.114]);r={'dark':dark,'ringGain':(a[ring].mean()/base['ringMean']-1)*100,'stdRatio':a[ring].std()/base['ringStd'],'wholeGain':(a.mean()/base['cardMean']-1)*100};results.append(r);print(r);style.evaluate('(e)=>e.remove()')
 (c.SHOTS/'B-brightness-probe.json').write_text(json.dumps(results,indent=1))
 b.close()
