"""Build review-only alternatives; production defaults are never changed."""
import json
import argparse
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from scope3_capture import digest

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'docs/clicker/shots/scope3/standalone-options'
ENTRIES = ('pool-standalone','gacha-standalone','gacha-test-standalone')
FILES = ('cards-remade-standalone.html','deluxe-gacha-b-standalone.html','deluxe-gacha-b-test-standalone.html')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--shots-only',action='store_true')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    rows=[]
    for setting in ('current','520','600'):
        folder=OUT/setting;folder.mkdir(exist_ok=True)
        for entry,file in zip(ENTRIES,FILES):
            pool=entry=='pool-standalone'
            width=(420 if pool else 360) if setting=='current' else int(setting)
            script='build_cards_remade_standalone.py' if pool else 'build_deluxe_b_standalone.py'
            target=folder/file
            cmd=[sys.executable,str(HERE/script),'--card-width',str(width),'--output',str(target)]
            if entry=='gacha-test-standalone':cmd.append('--test')
            if not args.shots_only: subprocess.run(cmd,check=True)
            rows.append({'entry':entry,'setting':setting,'width':width,'height':width*7//5,
                         'quality':84 if pool else 82,'bytes':target.stat().st_size,'sha256':digest(target),'path':str(target)})
        for card in ('rocketdog','chaichai','mieshi'):
            subprocess.run([sys.executable,str(HERE/'shoot_card_parity_samesize.py'),'--card',card,
                            '--entries',','.join(ENTRIES),'--root',str(folder),'--out',str(folder/'shots')],check=True)
    sheets=[]
    for entry in ENTRIES:
        for card in ('rocketdog','chaichai','mieshi'):
            paths=[OUT/setting/'shots'/('%s-%s-260px.png'%(card,entry)) for setting in ('current','520','600')]
            ims=[Image.open(p).convert('RGB') for p in paths]
            sheet=Image.new('RGB',(sum(im.width for im in ims)+32,max(im.height for im in ims)+36),(14,18,26))
            draw=ImageDraw.Draw(sheet);x=0
            for label,im in zip(('current','520 x 728','600 x 840'),ims):
                draw.text((x+8,10),label,fill='white');sheet.paste(im,(x,36));x+=im.width+16
            path=OUT/('%s-%s-options.png'%(card,entry));sheet.save(path);sheets.append(str(path))
    (OUT/'sizes.json').write_text(json.dumps({'artifacts':rows,'comparisonSheets':sheets},indent=2),encoding='utf-8')
    for row in rows:print(row['entry'],row['setting'],row['bytes'])
    return 0

if __name__=='__main__':sys.exit(main())
