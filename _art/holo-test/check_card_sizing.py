"""Content-box sizing and flat material contracts, called by the follow-up check."""
import json
from pool_data import pool
from check_gacha_card_regression import HERE, OUT, settle


def check_sizing(browser):
    rows = []
    for entry in ['demo.html', 'cards-remade.html', 'deluxe-gacha-b.html']:
        p = browser.new_page();errors=[]
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        p.goto((HERE / entry).as_uri())
        settle(p)
        data = next(c for c in pool() if c['id'] == 'dino')
        p.evaluate("""d=>{
          for(const e of document.body.children)e.style.display='none';
          const h=document.createElement('div');h.style.cssText='position:fixed;left:100px;top:100px;width:102px;height:143px;scale:1.13';
          const c=HoloCardFace.create(d,{masks:JSON.parse(document.querySelector('#mask-data').textContent),resolve:n=>'art/'+n});
          h.append(c);document.body.append(h);window.probe=c;window.probeHost=h;HoloCardFace.observe(c);
        }""", data)
        for width in [102, 80, 290, 102]:
            p.evaluate("""w=>{probeHost.style.width=w+'px';probeHost.style.height=w*1.4+'px';HoloCardFace.refit(probe)}""", width)
            settle(p)
            value = p.evaluate("""()=>{HoloCardFace.refit(probe);return Object.fromEntries(['--cw','--name-fs','--rarity-fs','--gem-fs'].map(k=>[k,parseFloat(probe.style.getPropertyValue(k))]))}""")
            for key, share in [('--cw', 1), ('--name-fs', 24/290), ('--rarity-fs', 13.5/290), ('--gem-fs', 22/290)]:
                assert abs(value[key] - width*share) < .011, (entry, width, value)
            rows.append(dict(entry=entry, width=width, values=value))
        for sizing, width in [('border-box', 122), ('content-box', 102)]:
            value = p.evaluate("""({s,w})=>{probe.style.boxSizing=s;probe.style.width=w+'px';probe.style.padding='0 10px';HoloCardFace.refit(probe);return parseFloat(probe.style.getPropertyValue('--cw'))}""", dict(s=sizing,w=width))
            assert abs(value-102)<.01, (entry,sizing,value)
        p.evaluate("""()=>{probe.style.padding='0';probe.style.width='102px';probe.querySelector('.face-name').textContent='W'.repeat(100);HoloCardFace.refit(probe)}""")
        value = p.evaluate("""()=>({fs:parseFloat(probe.style.getPropertyValue('--name-fs')),fits:probe.dataset.nameFits})""")
        assert abs(value['fs']-102*24/290*.55)<.011 and value['fits']=='false', value
        flat = next(c for c in pool() if c['id']=='mieshi')
        value = p.evaluate("""d=>{HoloCardFace.unobserve(probe);probe.remove();probe=HoloCardFace.create(d,{masks:JSON.parse(document.querySelector('#mask-data').textContent),resolve:n=>'art/'+n});probeHost.append(probe);HoloCardFace.observe(probe);HoloCardFace.paint(probe,d.rarity,.8,-.7,{tilt:true});const text=getComputedStyle(probe.querySelector('.face-text')),plate=getComputedStyle(probe.querySelector('.face-plate'));return {ax:probe.style.getPropertyValue('--ax'),ay:probe.style.getPropertyValue('--ay'),bx:probe.style.getPropertyValue('--bx'),by:probe.style.getPropertyValue('--by'),text:text.backgroundImage,textColor:text.backgroundColor,plate:plate.backgroundImage,mask:!!probe.querySelector('.subject-mask')}}""", flat)
        assert all(float(value[k].removesuffix('px'))==0 for k in ['ax','ay','bx','by']), value
        assert value['text']=='none' and value['textColor']=='rgba(0, 0, 0, 0)' and 'rgba(7, 11, 18, 0.85)' in value['plate'] and not value['mask'], value
        assert not errors,(entry,errors)
        p.evaluate('HoloCardFace.unobserve(probe)')
        p.close()
    (OUT/'sizing.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
    print('sizing: 12 resize cases, 6 padded cases, 3 long-name and 3 flat-material cases passed',flush=True)
