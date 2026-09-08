"""Embed existing project card CSS into demo's isolated baseline. No runtime loads."""
from pathlib import Path
import re, hashlib, json
out=Path(__file__).resolve().parent
source=out.parent.parent/'src/gacha-card.css'
css=source.read_text(encoding='utf-8')
css=re.sub(r'url\([\"\']?([^\)\"\']+)[\"\']?\)',lambda m:'url("../../src/'+m[1]+'")',css)
path=out/'demo.html'
html=path.read_text(encoding='utf-8')
replacement='<!-- BASELINE_START -->\n<template id="baseline-css"><style>\n'+css+'\n</style></template>\n<!-- BASELINE_END -->'
html=re.sub(r'<!-- BASELINE_START -->.*?<!-- BASELINE_END -->',lambda m:replacement,html,flags=re.S)
path.write_text(html,encoding='utf-8')
(out/'baseline-manifest.json').write_text(json.dumps({'source':'src/gacha-card.css','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'scope':'skin-af epic face; shadow-root; source size 150x210, uniformly scaled by ResizeObserver','changes':'host positioning, no stage entrance, no glow, shared demo pointer controller, finite flip transition'},indent=2),encoding='utf-8')
print('Embedded original card CSS, isolated in baseline shadow root.')
