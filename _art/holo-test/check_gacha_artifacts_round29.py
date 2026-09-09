"""Artifact budgets, exact asset embedding, and frozen-source protection."""
from pathlib import Path
import hashlib,json,re,subprocess,base64
from PIL import Image
p=Path(__file__).resolve().parent;root=p.parent.parent
html=(p/'deluxe-gacha-b-standalone.html').read_text(encoding='utf-8')
a=json.loads(re.search(r'id="asset-data">(.*?)</script>',html,re.S)[1]);manifest={'standalone_bytes':(p/'deluxe-gacha-b-standalone.html').stat().st_size,'runtime_bytes':sum((p/n).stat().st_size for n in ['ceremony.js','ceremony.css']),'assets':{},'frozen':{}}
assert manifest['standalone_bytes']<=6500000 and manifest['runtime_bytes']<=100000
for name in ['foil-pack.webp','foil-tear.webp','summon-substrate.webp']:
 data=(p/'fx'/name).read_bytes();embedded=base64.b64decode(a['fx/'+name].split(',')[1]);assert data==embedded
 manifest['assets'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'embedded_identical':True}
with Image.open(p/'fx/summon-substrate.webp') as im:assert im.size==(1536,1024) and im.mode=='RGB'
assert manifest['assets']['summon-substrate.webp']['bytes']<=110000
for name in ['_art/holo-test/card_face.js','_art/holo-test/pool_data.py']:
 original=subprocess.check_output(['git','-c','safe.directory='+root.as_posix(),'show','HEAD:'+name],cwd=root);current=(root/name).read_bytes();assert current.replace(b'\r\n',b'\n')==original.replace(b'\r\n',b'\n');manifest['frozen'][name]={'working_copy_sha256':hashlib.sha256(current).hexdigest(),'git_normalized_unchanged':True}
name='_art/holo-test/build_deluxe_b.py';original=subprocess.check_output(['git','-c','safe.directory='+root.as_posix(),'show','HEAD:'+name],cwd=root).decode('utf-8');current=(root/name).read_text(encoding='utf-8');rate=lambda s:re.search(r'const RATE=.*?;',s)[0];assert rate(original)==rate(current);manifest['RATE_unchanged']=True
assert not subprocess.check_output(['git','-c','safe.directory='+root.as_posix(),'diff','--name-only','--','src/'],cwd=root)
manifest['src_unchanged']=True
for name in ['deluxe-gacha-b.html','deluxe-gacha-b-standalone.html']:manifest[name]=hashlib.sha256((p/name).read_bytes()).hexdigest()
(p/'verify-round29/artifact-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print(json.dumps(manifest,indent=2))
