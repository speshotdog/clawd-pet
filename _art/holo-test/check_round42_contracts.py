"""Independent contour/crop, botanical visibility, timing and frozen-boundary audit."""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from scipy import ndimage as nd
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
from pool_data import pool

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=ROOT/'docs/clicker/shots/round42'
def main():
    result={};fail=[]
    # Independent reference is the reviewed generated master before the crop.
    # Largest connected alpha component excludes disconnected generator dust.
    a=np.asarray(Image.open(HERE/'round42-source/a-subject.png').convert('RGBA').resize((952,747),Image.Resampling.LANCZOS))[:,:,3]>0
    labels,n=nd.label(a);sizes=np.bincount(labels.ravel());sizes[0]=0;subject=labels==sizes.argmax()
    contour=subject&~nd.binary_erosion(subject);clipped=contour.copy();clipped[:,116:878]=False
    result['A_contour']={'reference':'reviewed imagegen master; largest connected nonzero-alpha sheep+castle component before card crop',
        'contour_pixels':int(contour.sum()),'cropped_contour_pixels':int(clipped.sum()),
        'retained_percent':float(100*(1-clipped.sum()/contour.sum()))}
    if clipped.any():fail.append('A contour cropped')
    # Six complete large botanical stickers above the nameplate, independently
    # selected by white-outline connected components, not a claimed count.
    bg=np.asarray(Image.open(HERE/'layer-zhenzhen-background.png').convert('RGBA'))
    sub=np.asarray(Image.open(HERE/'layer-zhenzhen-subject.png').convert('RGBA'))[:,:,3]>0
    labels,n=nd.label(bg[:,:,:3].min(2)>220);plants=[]
    annotated=Image.open(HERE/'layer-zhenzhen-background.png').convert('RGB');d=ImageDraw.Draw(annotated)
    for i in range(1,n+1):
        m=nd.binary_fill_holes(labels==i)
        if m.sum()<9000:continue
        y,x=np.where(m);bbox=[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
        if bbox[3]>640:continue
        overlap=int((m&sub).sum());plants.append({'bbox':bbox,'pixels':int(m.sum()),'occluded_by_sheep':overlap})
        d.rectangle(bbox,outline='#d32145',width=2);d.text((bbox[0],bbox[1]),str(len(plants)),fill='#d32145')
    result['C_complete_large_botanical_stickers']=plants
    if len(plants)<6 or any(p['occluded_by_sheep'] for p in plants):fail.append('C six complete plants')
    annotated.save(OUT/'C-six-complete-plants.png')
    base=json.loads((OUT/'baseline-metrics.json').read_text(encoding='utf-8'));same={}
    for ident in ['zhenjunyue','zhenqiqiu','fluffdog']:
        same[ident]={layer:hashlib.sha256((HERE/f'layer-{ident}-{layer}.png').read_bytes()).hexdigest()==base['cards'][ident][layer]['sha256'] for layer in ['subject','background']}
    result['B_unchanged_sha256']=same
    if not all(all(v.values()) for v in same.values()):fail.append('B modified')
    cmd=['git','-c','safe.directory='+ROOT.as_posix(),'diff','--name-only','--','src/','_art/holo-test/card_face.js']
    run=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True);result['frozen_files']={'git_exit':run.returncode,'diff':run.stdout.strip()}
    if run.returncode or run.stdout.strip():fail.append('frozen boundary')
    result['standalone_bytes']=(HERE/'deluxe-gacha-b-standalone.html').stat().st_size
    if result['standalone_bytes']>6000000:fail.append('standalone size')
    source=(HERE/'build_deluxe_b.py').read_text(encoding='utf-8');js=(HERE/'ceremony.js').read_text(encoding='utf-8')
    result['economy']={'rate_unchanged':"const RATE=[['mythic',.005],['legendary',.04],['epic',.15],['rare',.40],['common',.405]];" in source,
        'initial_tickets_30':'tickets=30' in js,'unlimited_false':"const ticketPolicy={unlimited:false,label:''};" in js}
    if not all(result['economy'].values()):fail.append('economy')
    with sync_playwright() as p:
        browser=p.chromium.launch();rows=[]
        for entry in ['dev','portable']:
            page=browser.new_page(viewport={'width':1100,'height':900})
            path=HERE/'deluxe-gacha-b.html' if entry=='dev' else OUT/'portable/deluxe-gacha-b.html'
            page.goto(path.as_uri()+'?ceremony-test');durations=[];angles=[]
            for _ in range(3):
                page.evaluate('c=>{__ceremony.reset();window.__ceremonyFixture=[c];__ceremony.pull(1)}',next(c for c in pool() if c['rarity']=='common'))
                page.wait_for_function('__ceremony.state().entryPhase==="waiting"')
                b=page.locator('#entry-pack').bounding_box();x=b['x']+b['width']/2;y=b['y']+b['height']/2
                page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+60,y-30,steps=4)
                angles.append(page.locator('.pack-surface').evaluate('e=>e.style.transform'))
                page.mouse.up()
                durations.append(page.locator('.pack-surface').evaluate('e=>e.getAnimations().map(a=>a.effect.getTiming().duration).filter(x=>x===280)[0]'))
                page.wait_for_timeout(400)
                transform=page.locator('.pack-surface').evaluate('e=>getComputedStyle(e).transform')
                if transform not in ['matrix(1, 0, 0, 1, 0, 0)','none']:fail.append('D4 did not return')
            start=page.evaluate('__ceremony.events.filter(e=>e.type==="pack-open").length');page.wait_for_timeout(4000)
            phase=page.evaluate('__ceremony.state().entryPhase');end=page.evaluate('__ceremony.events.filter(e=>e.type==="pack-open").length')
            rows.append({'entry':entry,'return_duration_ms_samples':durations,'return_duration_mean_ms':sum(durations)/3 if all(durations) else None,
                         'drag_transforms':angles,'settled_transform':transform,'observed_no_click_wait_ms':4000,'phase_after_wait':phase,'opens_during_wait':end-start})
            if durations!=[280,280,280] or phase!='waiting' or end!=start:fail.append('D4 timing/wait')
            page.close()
        result['D4_timing']=rows;browser.close()
    result['failures']=fail;(OUT/'contract-metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2));raise SystemExit(1 if fail else 0)
if __name__=='__main__':main()
