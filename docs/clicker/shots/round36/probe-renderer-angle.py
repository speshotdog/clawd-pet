import importlib.util,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path.cwd();spec=importlib.util.spec_from_file_location('check',root/'_art/holo-test/check_gift_card.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--use-angle=d3d11']);p=b.new_page(viewport={'width':900,'height':1000},device_scale_factor=2);p.goto((root/'_art/holo-test/gift-mohuashaonv.html').as_uri());p.wait_for_timeout(1200)
 print(p.evaluate('''() => {const g=document.createElement('canvas').getContext('webgl');const e=g.getExtension('WEBGL_debug_renderer_info');return {ua:navigator.userAgent,renderer:g.getParameter(e.UNMASKED_RENDERER_WEBGL)};}'''))
 for i in range(3):
  d=c.transition_curve(p);(c.SHOTS/f'full-chromium-probe-{i}.json').write_text(json.dumps(d,indent=1));
  try:c.assert_crossfade(d);print(i,'PASS',len(d['frames']))
  except AssertionError as e:print(i,'FAIL',str(e),len(d['frames']))
 b.close()

