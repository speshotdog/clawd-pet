"""One-variable control: replace only epic's flash hue with the neutral hue."""
import json
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from check_gacha_round34 import HERE, OUT, SEED
from check_gacha_ceremony_round28 import BY,open_page,start,advance
from check_gacha_ceremony_round30 import shot,p95

def main():
    rows=[]
    original=(OUT/'source-before/ceremony-fx.js').read_text(encoding='utf-8')
    with sync_playwright() as pw:
        b=pw.chromium.launch()
        for label,code in [('original',original),('neutral-hue-only',original.replace("rarity==='epic'?'225,185,255'","rarity==='epic'?'255,238,208'"))]:
            p,errors=open_page(b,(HERE/'deluxe-gacha-b.html').as_uri());p.set_viewport_size(dict(width=1440,height=900));p.evaluate(SEED)
            p.add_script_tag(content=code)
            mask=Image.new('L',(1440,900),0);d=ImageDraw.Draw(mask);d.rectangle((160,160,1279,719),fill=255);d.rectangle((490,110,950,750),fill=0)
            start(p,[BY['epic']]);advance(p,1300);base=p95(shot(p),mask);advance(p,320)
            values=[]
            for t in range(0,1001,50):
                if t:advance(p,50)
                im=shot(p);values.append(dict(ms=t,p95=p95(im,mask)))
                if t==250:im.save(OUT/(label+'-epic-control.png'))
            rows.append(dict(control=label,base=base,peak=max(v['p95'] for v in values),duration=sum(50 for v in values[:-1] if v['p95']>base+40),samples=values,errors=errors));p.close()
            print(rows[-1],flush=True)
        b.close()
    (OUT/'epic-cause.json').write_text(json.dumps(rows,indent=2))

if __name__=='__main__':main()
