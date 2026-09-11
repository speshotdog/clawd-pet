"""All front-face instances, descendants and both pseudo-elements."""
import base64
import hashlib
import re
import io
from PIL import Image
from pathlib import Path
from urllib.parse import urlparse, unquote

LAYER_JS = r"""(c)=>{
 const cr=c.getBoundingClientRect();
 const keys=['display','position','width','height','left','right','top','bottom','padding','margin',
 'transform','transformOrigin','transformStyle','perspective','perspectiveOrigin','scale','rotate','translate',
 'backgroundImage','backgroundColor','backgroundSize','backgroundPosition','backgroundRepeat','backgroundBlendMode',
 'maskImage','maskSize','maskPosition','maskRepeat','maskMode','maskComposite',
 'opacity','visibility','mixBlendMode','filter','backdropFilter','isolation','zIndex','overflow',
 'objectFit','objectPosition','borderRadius','borderWidth','borderColor','borderStyle','boxShadow','clipPath',
 'content','color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textShadow','webkitTextFillColor'];
 const style=(e,p)=>{const s=getComputedStyle(e,p),o={};keys.forEach(k=>{if(!e.matches('.face-name,.face-rarity') && ['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textShadow','webkitTextFillColor'].includes(k))return;o[k]=s[k]||''});return o};
 return [...c.querySelectorAll('*')].filter(e=>!e.closest('.card-back')).map((e,i)=>{
 const r=e.getBoundingClientRect();
 return {index:i,tag:e.tagName,classes:e.className,
 rect:{x:+((r.x-cr.x)/cr.width).toFixed(5),y:+((r.y-cr.y)/cr.height).toFixed(5),
 w:+(r.width/cr.width).toFixed(5),h:+(r.height/cr.height).toFixed(5)},
 style:style(e),before:style(e,'::before'),after:style(e,'::after'),
 image:e.tagName==='IMG'?{width:e.naturalWidth,height:e.naturalHeight}:null};
 });
}"""

_cache = {}
def normalize_url(match):
    url = match.group(1).strip('"\'')
    if url not in _cache:
        if url.startswith('data:'):
            head,body = url.split(',',1)
            raw = base64.b64decode(body) if ';base64' in head else unquote(body).encode()
        elif url.startswith('file:'):
            path = unquote(urlparse(url).path)
            if re.match(r'^/[A-Za-z]:', path):
                path = path[1:]
            raw = Path(path).read_bytes()
        else:
            raise ValueError('unresolved CSS resource: ' + url[:100])
        if not (raw.lstrip().startswith(b'<') or '<svg' in raw[:200].decode('ascii','ignore')):
            with Image.open(io.BytesIO(raw)) as im:
                # PNG and lossless WebP transport compare by their full decoded content.
                raw = str(im.size).encode() + im.convert('RGBA').tobytes()
        _cache[url] = 'sha256:' + hashlib.sha256(raw).hexdigest()
    return 'url(' + _cache[url] + ')'


def normalize_layers(layers):
    for layer in layers:
        for part in ('style','before','after'):
            for k,v in layer[part].items():
                layer[part][k] = re.sub(r'url\(([^)]+)\)', normalize_url, v)
    return layers


def design(layers):
    return [{k:v for k,v in layer.items() if k != 'image'} for layer in layers]
