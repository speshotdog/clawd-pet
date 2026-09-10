"""Run: python _art/holo-test/check_map20.py

No server or application dependencies. Requires Playwright + Pillow.
Area masks: visible union of header, navigation, inspector, node bodies and labels;
exclude the empty map canvas. Rail numerator: navigation + inspector, consistently
across all three viewport sizes; the independent header is excluded.
Texture numerator: actual SVG support strips, clipped to the same UI union.
Timing only: three runs, retain raw samples and mean. No timing cross-machine claim.
"""
import io
import argparse
import json
import math
import statistics
import time
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/clicker/shots/map-round2'
URL = (ROOT / '_art/holo-test/map20.html').as_uri()
RESULT = {'checks': {}, 'evidence': {}, 'manual': ['灰階圖的 C 結構辨識須人工判讀，未以像素差冒充玩家辨識率。']}


def check(name, values, low, high, unit='', note=''):
    v = values if isinstance(values, list) else [values]
    RESULT['checks'][name] = {'values': v, 'range': [low, high], 'unit': unit,
        'status': 'PASS' if v and all(low-0.001 <= x <= high+0.001 for x in v) else 'FAIL', 'note': note}


def timing(name, samples, low, high):
    check(name, statistics.mean(samples), low, high, 'ms')
    RESULT['checks'][name]['samples'] = samples


def barrier(page):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')


def go(page, query='progress=2'):
    page.goto(URL + '?' + query)
    page.evaluate('document.fonts.ready')
    barrier(page)


def freeze(page, t):
    page.evaluate('(t)=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=t})', t)
    barrier(page)


def rects(page, selector):
    return page.eval_on_selector_all(selector, '''es=>es.filter(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden').map(e=>{let r=e.getBoundingClientRect();let w=e.closest('.map-window');let c=w?w.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight};return [Math.max(0,r.left,c.left),Math.max(0,r.top,c.top),Math.min(innerWidth,r.right,c.right),Math.min(innerHeight,r.bottom,c.bottom)]}).filter(r=>r[2]>r[0]&&r[3]>r[1])''')


def mask(size, rectangles):
    im = Image.new('1', size)
    d = ImageDraw.Draw(im)
    for x0,y0,x1,y1 in rectangles:
        d.rectangle((math.ceil(x0),math.ceil(y0),math.ceil(x1)-1,math.ceil(y1)-1), fill=255)
    return im


def area(im):
    return im.convert('L').point(lambda x: 255 if x else 0).histogram()[255]


def rgb(color):
    import re
    return list(map(float,re.findall(r'[\d.]+',color)))[:3]


def contrast(a,b):
    def lum(c):
        c=[x/255 for x in rgb(c)]
        return sum(k*(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4) for k,x in zip([.2126,.7152,.0722],c))
    a,b=sorted([lum(a),lum(b)])
    return (b+.05)/(a+.05)


def raster_style():
    """Measure supplied colors/linework instead of inert SVG CSS on bitmap spans.

    Median of every chromatic fill pixel, excluding cream and black outline.
    Lock line width: first/last black runs on source y=360, excluding keyhole;
    convert through contain scale for its real 22px icon box.
    """
    sheet=Image.open(ROOT/'_art/holo-test/map-art/icons-sheet.png').convert('RGB')
    def fill(box, channel):
        pixels=[p for p in list(sheet.crop(box).get_flattened_data()) if p[channel]>max(p[(channel+1)%3],p[(channel+2)%3])*1.1]
        return tuple(statistics.median(p[i] for p in pixels) for i in range(3))
    green=fill((112,132,516,506),1);blue=fill((682,738,1219,1142),2)
    def background(box):
        pixels=[p for p in sheet.crop(box).get_flattened_data() if min(p)>220]
        return tuple(statistics.median(p[i] for p in pixels) for i in range(3))
    check_bg=background((112,132,516,506));gate_bg=background((682,738,1219,1142))
    runs=[];length=0
    for x in range(804,1129):
        dark=max(sheet.getpixel((x,360)))<35
        if dark:length+=1
        elif length:runs.append(length);length=0
    if length:runs.append(length)
    return {'check':str(green),'boss':str(blue),'check_background':str(check_bg),'gate_background':str(gate_bg),
            'check_contrast':contrast(str(green),str(check_bg)),'boss_contrast':contrast(str(blue),str(gate_bg)),
            'lock_stroke':statistics.mean([runs[0],runs[-1]])*22/416,
            'lock_black_runs_source_px':runs,'method':'Source chromatic-fill median versus actual cream bitmap background median (channels >220), not the coal plate behind the opaque bitmap. Lock outer black runs at original y=360 scaled by CSS contain height.'}


def start_advance(page):
    page.evaluate('void map20.advance()')
    page.wait_for_function('document.getAnimations().length>0')


LANDMARKS = [(25,329,332,693),(665,564,950,740),(663,892,947,1009)]

def pair_images(left, right, path):
    im=Image.new('RGB',(left.width*2,left.height))
    im.paste(left,(0,0));im.paste(right,(left.width,0));im.save(path)


def painted_masks(page,size,build):
    """Paint footprints, excluding hollow-node interiors and motif letterboxing.

    Positive alpha contributes to all-UI; only alpha=1 contributes to opaque.
    Source motifs are RGB, so their fitted image rectangles are fully painted.
    SVG paths sampled at <=1 source px; stroke widths rounded up to device px.
    """
    ui=Image.new('1',size);opaque=Image.new('1',size)
    data=page.evaluate('''()=>{const alpha=c=>c.startsWith('rgba')?Number(c.slice(5,-1).split(',')[3]):1;
      return [...document.querySelectorAll('[data-ui],.station-label,.segment-note,.node-body,.motif,.boss .symbol')].flatMap(e=>{
        const s=getComputedStyle(e),r=e.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||!r.width||!r.height)return [];
        let parent=e,opacity=1;while(parent){const ps=getComputedStyle(parent);if(ps.display==='none'||ps.visibility==='hidden')return [];opacity*=Number(ps.opacity);parent=parent.parentElement}
        const w=e.closest('.map-window'),clip=w?w.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight};
        return [{rect:[r.left,r.top,r.right,r.bottom],clip:[clip.left,clip.top,clip.right,clip.bottom],opacity,bg:alpha(s.backgroundColor),border:parseFloat(s.borderTopWidth),borderAlpha:alpha(s.borderTopColor),motif:['check','lock','paw','gate'].find(n=>e.classList.contains(n))||null}]
      })}''')
    def add(layer,clip,opacity):
        nonlocal ui,opaque
        clipped=ImageChops.logical_and(layer,mask(size,[clip]))
        if opacity>0:ui=ImageChops.logical_or(ui,clipped)
        if opacity>=.999:opaque=ImageChops.logical_or(opaque,clipped)
    for e in data:
        box=e['rect'];a,b,c,d=box
        if e['bg']>0:add(mask(size,[box]),e['clip'],e['bg']*e['opacity'])
        if e['border']>0 and e['borderAlpha']>0:
            bw=e['border']
            border=ImageChops.logical_and(mask(size,[box]),ImageChops.invert(mask(size,[[a+bw,b+bw,c-bw,d-bw]])))
            add(border,e['clip'],e['borderAlpha']*e['opacity'])
        if e['motif']:
            name=e['motif'];sw,sh=build['crops'][name]['size']
            if name!='gate':
                scale=min((c-a)/sw,(d-b)/sh);w,h=sw*scale,sh*scale
                box=[(a+c-w)/2,(b+d-h)/2,(a+c+w)/2,(b+d+h)/2]
            add(mask(size,[box]),e['clip'],e['opacity'])
    paths=page.evaluate('''()=>[...document.querySelectorAll('.route-lines path,.bracket path')].flatMap(e=>{
      const svg=e.ownerSVGElement,r=svg.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||getComputedStyle(svg).display==='none')return [];
      const view=svg.viewBox.baseVal,sx=view.width?r.width/view.width:1,sy=view.height?r.height/view.height:1,len=e.getTotalLength(),count=Math.ceil(len);
      let points=[];for(let i=0;i<=count;i++){const p=e.getPointAtLength(len*i/count);points.push([r.left+p.x*sx,r.top+p.y*sy])}
      const clip=document.querySelector('.map-window').getBoundingClientRect();
      return [{points,alpha:Number(s.strokeOpacity),width:parseFloat(s.strokeWidth),clip:[clip.left,clip.top,clip.right,clip.bottom],bracket:svg.classList.contains('bracket')}]
    })''')
    for path in paths:
        layer=Image.new('1',size);draw=ImageDraw.Draw(layer)
        # A bracket path has four disconnected corners. Avoid connecting its
        # pen-up gaps while sampling the actual SVG geometry.
        pts=path['points'];width=math.ceil(path['width'])
        for a,b in zip(pts,pts[1:]):
            if math.dist(a,b)<4:draw.line([tuple(a),tuple(b)],fill=255,width=width)
        add(layer,path['clip'],path['alpha'])
    return ui,opaque


def round2(page):
    """Viewport denominator; painted footprints, separate all-UI overlap.

    Use the CURRENT seg1b report's boxes, not its historical appendix.
    Whole landmark boxes also serve as conservative core masks: zero overlap
    proves core protection without inventing smaller, favorable core regions.
    """
    build=json.loads((OUT/'build.json').read_text(encoding='utf-8'))
    check('build.html_bytes',(ROOT/'_art/holo-test/map20.html').stat().st_size,0,2_500_000,'bytes')
    RESULT['evidence']['build']=build
    RESULT['evidence']['landmark_source_boxes']=LANDMARKS
    RESULT['evidence']['area_method']='Full viewport denominator; current seg1b bounding boxes. Background/border paint and fitted RGB motif rectangles; exclude hollow-node interiors and contain letterboxing. SVG routes/brackets sampled at <=1 source px; stroke width rounded up to device pixels. All positive-alpha UI counted in overlap; only alpha=1 subtracted from visible terrain. Whole landmark boxes used for stricter core test.'
    requests=[]
    page.on('request',lambda r: requests.append(r.url) if not r.url.startswith(('file:','data:')) else None)
    for width,height in [(1440,900),(1024,768),(390,844)]:
        page.set_viewport_size({'width':width,'height':height})
        size=(width,height);tag=f'{width}x{height}'
        go(page);freeze(page,0)
        on=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
        ui,opaque=painted_masks(page,size,build)
        view=rects(page,'.map-window')[0]
        ground=mask(size,[view])
        # The undistorted tiles fill this window. Validate tiling separately.
        coverage=page.eval_on_selector_all('.terrain-tile','es=>es.map(e=>{let r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})')
        ground=ImageChops.logical_and(ground,mask(size,coverage))
        landmark_boxes=[]
        for x0,y0,x1,y1 in coverage:
            scale=(x1-x0)/971
            for a,b,c,d in LANDMARKS:
                landmark_boxes.append([x0+a*scale,y0+b*scale,x0+c*scale,y0+d*scale])
        landmarks=ImageChops.logical_and(mask(size,landmark_boxes),ground)
        visible=ImageChops.logical_and(ground,ImageChops.invert(opaque))
        landmark_visible=ImageChops.logical_and(landmarks,ImageChops.invert(opaque))
        overlay=ImageChops.logical_and(ground,ui)
        check(tag+'.terrain_visible',area(visible)/(width*height)*100,55 if width<700 else 60,75,'% viewport')
        check(tag+'.ui_over_terrain',area(overlay)/(width*height)*100,10,20,'% viewport','Includes opaque and translucent panel footprints, painted node borders, fitted motifs, labels, route and brackets; hollow interiors excluded.')
        check(tag+'.landmarks_visible',area(landmark_visible)/(width*height)*100,15,25,'% viewport')
        check(tag+'.core_opaque_occlusion',area(ImageChops.logical_and(landmarks,opaque))/max(1,area(landmarks))*100,0,0,'% landmark boxes','Full boxes, stricter than unprovided core-only masks.')
        check(tag+'.landmark_ui_occlusion',area(ImageChops.logical_and(landmarks,ui))/max(1,area(landmarks))*100,0,10,'% landmark boxes')
        check(tag+'.rail_midband',RESULT['checks'][tag+'.rail_area']['values'],70,80,'%')
        check(tag+'.texture_midband',RESULT['checks'][tag+'.texture_area']['values'],14,19,'%')
        for name,m in [('ground',ground),('opaque',opaque),('all-ui',ui),('landmarks',landmarks),('ground-visible',visible)]:
            m.convert('L').save(OUT/f'{tag}-{name}-mask.png')
        # Same geometry and frozen time for independent ablations.
        page.evaluate("document.body.classList.add('no-texture')");barrier(page)
        no=Image.open(io.BytesIO(page.screenshot(path=str(OUT/f'{tag}-wear-off.png')))).convert('RGB')
        pair_images(no,on,OUT/f'{tag}-wear-pair.png')
        check(tag+'.wear_changed_pixels',sum(v for i,v in enumerate(ImageChops.difference(no,on).convert('L').histogram()) if i>0),1,width*height,'pixels')
        interiors=[[a+24,b+24,c-24,d-24] for a,b,c,d in rects(page,'[data-ui]') if c-a>48 and d-b>48]
        interior=mask(size,interiors).convert('L')
        changed=ImageChops.difference(no,on).convert('L')
        check(tag+'.wear_interior_gray_delta',ImageStat.Stat(changed,interior).mean[0],0,0,'/255','Panel interiors inset by 24 px; no seam support included.')
        page.evaluate("document.body.classList.remove('no-texture');document.body.classList.add('no-terrain')");barrier(page)
        no=Image.open(io.BytesIO(page.screenshot(path=str(OUT/f'{tag}-terrain-off.png')))).convert('RGB')
        pair_images(no,on,OUT/f'{tag}-terrain-pair.png')
        check(tag+'.terrain_changed_pixels',sum(v for i,v in enumerate(ImageChops.difference(no,on).convert('L').histogram()) if i>0),1,width*height,'pixels')
        go(page)
        drift=page.evaluate('''()=>{const w=document.querySelector('.map-window'),n=document.querySelector('.station'),t=document.querySelector('.terrain-tile');const before=n.getBoundingClientRect().top-t.getBoundingClientRect().top;w.scrollTop+=60;return Math.abs(before-(n.getBoundingClientRect().top-t.getBoundingClientRect().top))}''')
        check(tag+'.terrain_node_scroll_drift',drift,0,0,'px')
        check(tag+'.terrain_aspect_error',page.eval_on_selector_all('.terrain-tile','es=>es.map(e=>{let r=e.getBoundingClientRect();return Math.abs(r.width/r.height-971/1619)})'),0,.001)
        # Inspect all 21 progress entry points, not just the hero screenshot.
        clipping=[];sections=[];panels=[];placeholders=[]
        for n in range(21):
            go(page,f'progress={n}');freeze(page,0)
            val=page.evaluate('''()=>{let w=document.querySelector('.map-window').getBoundingClientRect(),p=document.querySelector('.inspector').getBoundingClientRect();if(innerWidth>=700)w={top:Math.max(w.top,document.querySelector('nav').getBoundingClientRect().bottom),bottom:w.bottom};let clipped=[...document.querySelectorAll('.station')].map(e=>{let r=e.getBoundingClientRect(),visible=Math.max(0,Math.min(r.bottom,w.bottom)-Math.max(r.top,w.top));return visible>0&&visible<r.height?100*(1-visible/r.height):0});return {clip:Math.max(...clipped),panel:p.height/innerHeight*100,section:document.querySelector('#section').innerText,placeholder:document.querySelector('#art-note').innerText}}''')
            clipping.append(val['clip']);panels.append(val['panel']);sections.append(int('/ 5' in val['section'] and bool(val['section'].strip())))
            if n>=4:placeholders.append(int('佔位' in val['placeholder']))
        check(tag+'.node_edge_clipping',clipping,0,0,'% body cropped, all progress hooks')
        check(tag+'.segment_indicator',sections,1,1)
        check(tag+'.placeholder_label',placeholders,1,1)
        if width<700:check(tag+'.bottom_panel_height',panels,0,32,'% viewport height')
    check('build.external_requests',len(requests),0,0)
    go(page,'progress=3')
    for name in ['check','lock','paw','gate']:
        matches=page.eval_on_selector_all('.'+name,'(es,name)=>es.map(e=>Number(getComputedStyle(e).backgroundImage===getComputedStyle(document.documentElement).getPropertyValue("--art-"+name).trim()))',name)
        check('icons.'+name+'.state_asset_mapping',matches,1,1)
    check('icons.no_filters',page.eval_on_selector_all('.motif,.terrain-tile','es=>es.map(e=>Number(getComputedStyle(e).filter==="none"))'),1,1)
    # Verify actual embedded raster pixels, not just CSS stroke tokens.
    import base64,re,hashlib
    html=(ROOT/'_art/holo-test/map20.html').read_text(encoding='utf-8')
    sheet=Image.open(ROOT/'_art/holo-test/map-art/icons-sheet.png').convert('RGB')
    for name,crop in build['crops'].items():
        uri=re.search(r'--art-'+name+r':url\("data:image/webp;base64,([^"\)]+)',html)[1]
        decoded=Image.open(io.BytesIO(base64.b64decode(uri))).convert('RGB')
        check('icons.'+name+'.source_pixel_difference',max(ImageChops.difference(decoded,sheet.crop(crop['source_box'])).getextrema()[i][1] for i in range(3)),0,0,'/255')
    for name,sha in build['sources'].items():
        check('source.'+name+'.unchanged',int(hashlib.sha256((ROOT/'_art/holo-test/map-art'/name).read_bytes()).hexdigest()==sha),1,1)
    go(page)
    check('wear.random_calls',len(re.findall(r'Math\.random|random\(',html)),0,0)
    wear=page.eval_on_selector_all('.wear path','es=>es.map(e=>e.getAttribute("d"))')
    go(page)
    check('wear.reload_identity',int(wear==page.eval_on_selector_all('.wear path','es=>es.map(e=>e.getAttribute("d"))')),1,1)
    check('wear.interior_support',page.eval_on_selector_all('.wear','es=>es.filter(e=>{let r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return Math.min(Math.abs(r.left-p.left),Math.abs(r.top-p.top),Math.abs(r.right-p.right),Math.abs(r.bottom-p.bottom))>2}).length'),0,0,'strips detached from panel edge')
    RESULT['evidence']['wear_paths']=wear
    starts=sorted(set(int(x) for x in re.findall(r'M(\d+) \d+',wear[0])))
    gaps=[b-a for a,b in zip(starts,starts[1:])]
    check('wear.distinct_seam_gaps',len(set(gaps)),2,len(gaps),'distinct gap lengths','Parsed from actual fixed SVG move-to positions; equal spacing would produce 1.')
    RESULT['evidence']['wear_seam_gaps']=gaps
    # Reproduce the verification note's worst-case timer suspension, explicitly
    # synthetic visibilitychange: this is NOT proof of real hidden state.
    go(page,'progress=3&cooldown=180')
    before=page.locator('.current .cooldown').inner_text()
    page.evaluate('()=>{const end=setInterval(()=>{},10000);for(let i=1;i<=end;i++){clearInterval(i);clearTimeout(i)}}')
    page.wait_for_timeout(6000)
    stalled=page.locator('.current .cooldown').inner_text()
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");barrier(page)
    after=page.locator('.current .cooldown').inner_text()
    check('cooldown.timers_suspended_display',int(before==stalled),1,1)
    check('cooldown.timers_suspended_drop',180-page.evaluate('map20.remaining(3)'),5,7,'s')
    RESULT['evidence']['timer_suspension']={'before':before,'stalled':stalled,'after_event':after,'event':'synthetic visibilitychange; no visibilityState override'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--headed',action='store_true',help='Run the real tab-hide check in an interactive browser.')
    parser.add_argument('--channel',choices=['chrome','msedge'],help='Installed browser; omit for bundled Chromium.')
    args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=not args.headed,channel=args.channel)
        RESULT['evidence']['browser']=browser.version
        context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
        page=context.new_page()
        page.on('pageerror',lambda e:errors.append(str(e)))
        for width,height in [(1440,900),(1024,768),(390,844)]:
            size=(width,height);tag=f'{width}x{height}'
            page.set_viewport_size({'width':width,'height':height})
            go(page)
            on_rects=page.eval_on_selector_all('.station','es=>es.map(e=>{let r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
            ui=mask(size,rects(page,'[data-ui], .station, .station-label'))
            rail=mask(size,rects(page,'[data-rail]'))
            texture=mask(size,rects(page,'.wear'))
            denom=area(ui)
            check(f'{tag}.rail_area',area(ImageChops.logical_and(ui,rail))/denom*100,65,85,'%')
            # Complete external frames among panels: inspect all four computed borders.
            floating=page.eval_on_selector_all('[data-ui]','es=>es.filter(e=>{let s=getComputedStyle(e);return [s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].every(x=>parseFloat(x)>0)}).length')
            check(f'{tag}.floating_panels',floating,0,0,'count', 'No complete-frame panels; therefore their union is 0% (allowed 0–15%).')
            check(f'{tag}.floating_area',0 if floating==0 else 100,0,15,'%')
            check(f'{tag}.texture_area',area(ImageChops.logical_and(ui,texture))/denom*100,12,22,'%')
            for name,m in [('ui-mask',ui),('rail-mask',rail),('texture-mask',texture)]:m.convert('L').point(lambda x:255 if x else 0).save(OUT/f'{tag}-{name}.png')
            freeze(page,0)
            on=Image.open(io.BytesIO(page.screenshot(path=str(OUT/f'{tag}-on.png')))).convert('RGB')
            page.evaluate("document.body.classList.add('no-texture')")
            barrier(page)
            no=Image.open(io.BytesIO(page.screenshot(path=str(OUT/f'{tag}-texture-off.png')))).convert('RGB')
            # Predeclared blank sample: header upper seam, x+100..188, y+1..15; no text.
            r=rects(page,'.mast')[0]; box=(int(r[0]+100),int(r[1]+1),int(r[0]+188),int(r[1]+15))
            diff=ImageChops.difference(on.convert('L'),no.convert('L')).crop(box)
            check(f'{tag}.texture_gray_delta',ImageStat.Stat(diff).mean[0],6,14,'/255',str(box))
            RESULT['evidence'][f'{tag}.ui_pixels']=denom
            go(page,'progress=2&ui=off')
            freeze(page,0)
            off=Image.open(io.BytesIO(page.screenshot(path=str(OUT/f'{tag}-off.png')))).convert('RGB')
            off_rects=page.eval_on_selector_all('.station','es=>es.map(e=>{let r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})')
            check(f'{tag}.ui_off_reflow',max(abs(a-b) for ra,rb in zip(on_rects,off_rects) for a,b in zip(ra,rb)),0,0,'px')
            pair=Image.new('RGB',(width*2,height));pair.paste(off,(0,0));pair.paste(on,(width,0));pair.save(OUT/f'{tag}-pair.png');pair.convert('L').save(OUT/f'{tag}-pair-gray.png')
            go(page)
            check(f'{tag}.horizontal_overflow',page.evaluate('Math.max(0,document.body.scrollWidth-innerWidth)'),0,0,'px')
            check(f'{tag}.summary_position',page.evaluate('()=>{let a=document.querySelector(".inspector").getBoundingClientRect(),m=document.querySelector(".map-window").getBoundingClientRect();return innerWidth<700?Number(a.top>=m.bottom):Number(a.left>=m.right)}'),1,1)
        page.set_viewport_size({'width':1440,'height':900})
        go(page,'progress=3')
        g=page.evaluate('''()=>{let all=s=>[...document.querySelectorAll(s)],c=s=>getComputedStyle(document.querySelector(s)),r=s=>document.querySelector(s).getBoundingClientRect();return {nodes:all('.station').map(e=>{let r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,boss:e.classList.contains('boss')}}),base:c('body').backgroundColor,edge:c('.done .node-body').borderTopColor,check:c('.check').stroke,label:c('.station-label').color,lockedLabel:c('.locked .station-label').color,boss:c('.current .gate').stroke,focus:c('.current .bracket').stroke,gap:r('.current').left-r('.current .bracket').left,checkSize:r('.check').width,lineWidth:parseFloat(c('.link').strokeWidth),walked:parseFloat(c('.walked').strokeOpacity),unwalked:parseFloat(c('.link:not(.walked)').strokeOpacity),lockedAlpha:c('.locked .node-body').borderTopColor,lockAlpha:parseFloat(c('.lock').strokeOpacity),links:all('.link').map(e=>[+e.dataset.from,+e.dataset.to])}}''')
        raster=raster_style();g['check']=raster['check'];g['boss']=raster['boss'];RESULT['evidence']['raster_style']=raster
        check('node.size',[x['w'] for x in g['nodes'] if not x['boss']],44,60,'px')
        check('node.vertical_spacing',[b['y']-a['y'] for a,b in zip(g['nodes'],g['nodes'][1:])],104,144,'px')
        check('node.horizontal_offset',[abs(b['x']-a['x']) for a,b in zip(g['nodes'],g['nodes'][1:])],24,56,'px')
        check('node.outline_contrast',contrast(g['edge'],g['base']),3,5,':1')
        check('route.width',g['lineWidth'],2,3,'px');check('route.walked_alpha',g['walked'],.65,.80);check('route.unwalked_alpha',g['unwalked'],.22,.34)
        degrees=[sum(i in edge for edge in g['links']) for i in range(20)]
        check('route.branches',sum(d>2 for d in degrees),0,0)
        check('route.edges',len(g['links']),19,19)
        check('current.gap',g['gap'],6,10,'px');check('current.contrast',contrast(g['focus'],g['base']),5,7,':1')
        check('complete.check_size',g['checkSize'],14,18,'px');check('complete.graphic_contrast',raster['check_contrast'],3,4.5,':1');check('complete.label_contrast',contrast(g['label'],g['base']),4.5,7,':1')
        check('complete.retained_names',page.locator('.done .station-label').count(),3,3)
        check('locked.graphic_alpha',page.eval_on_selector('.lock','e=>parseFloat(getComputedStyle(e).opacity)'),.30,.42);check('locked.label_contrast',contrast(g['lockedLabel'],g['base']),4.5,7,':1')
        check('locked.outline_alpha',float(g['lockedAlpha'].split(',')[-1].rstrip(')')),.30,.42)
        check('locked.hollow',page.eval_on_selector_all('.locked .node-body',"es=>es.filter(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)').length"),16,16)
        check('boss.width_ratio',[x['w']/g['nodes'][0]['w'] for x in g['nodes'] if x['boss']],1.4,1.8)
        check('boss.contrast',raster['boss_contrast'],4,6,':1')
        check('boss.red_dominance',max(0,rgb(g['boss'])[0]-max(rgb(g['boss'])[1:])),0,0)
        check('map.stage_count',page.locator('.station').count(),20,20);check('map.boss_count',page.locator('.boss').count(),5,5)
        check('map.preview_stations',sum('預告' in t for t in page.locator('.station-label').all_inner_texts()),5,5)
        control=page.eval_on_selector('#back','e=>{let s=getComputedStyle(e);return {radius:parseFloat(s.borderTopLeftRadius),border:parseFloat(s.borderLeftWidth),font:parseFloat(s.fontSize)}}')
        check('controls.radius',control['radius'],0,2,'px');check('controls.border',control['border'],1,2,'px');check('controls.body_font',control['font'],16,18,'px')
        check('controls.icon_size',page.locator('.lock').first.bounding_box()['width'],20,24,'px')
        check('controls.icon_stroke',raster['lock_stroke'],1.5,2,'px','Actual bitmap outer black runs; CSS strokeWidth is inert on an image and is not counted.')
        check('controls.title_font',page.eval_on_selector('h1','e=>parseFloat(getComputedStyle(e).fontSize)'),24,28,'px')
        # Genuine idle sampling and real pointer press displacement.
        before=page.locator('.current').bounding_box();page.wait_for_timeout(300);after=page.locator('.current').bounding_box()
        check('node.idle_displacement',math.hypot(after['x']-before['x'],after['y']-before['y']),0,0,'px')
        btn=page.locator('#back');r=btn.bounding_box();page.mouse.move(r['x']+10,r['y']+10);page.mouse.down();barrier(page);a=btn.bounding_box();page.mouse.up()
        check('controls.press_displacement',math.hypot(a['x']-r['x'],a['y']-r['y']),0,0,'px')
        # Every locked station must hide result controls and offer predecessor + return.
        dead=0
        for i in range(20):
            page.locator(f'.station[data-index="{i}"]').evaluate('(e)=>e.click()')
            if i>3:
                check(f'locked.{i+1}.challenge_buttons',int(page.locator('#advance').is_visible()),0,0)
            dead+=int(not page.locator('#back').is_visible() or not page.locator('#next').inner_text().strip())
        check('tasks.dead_ends',dead,0,0)
        # Sample WAAPI after pause/currentTime and double-rAF; inspect real keyframes.
        samples={k:[] for k in ['check','connection','bracket']}
        for run in range(3):
            go(page,'progress=2');start_advance(page);freeze(page,0)
            anim=page.evaluate('document.getAnimations().map(a=>({id:a.id,duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay,frames:a.effect.getKeyframes()}))')
            for a in anim:samples[a['id']].append(a['duration'])
            check(f'advance.{run}.ordering',[a['delay'] for a in anim],[0][0],420,'ms')
            check(f'advance.{run}.connection_start',[a['delay'] for a in anim if a['id']=='connection'],140,140,'ms')
            check(f'advance.{run}.bracket_start',[a['delay'] for a in anim if a['id']=='bracket'],420,420,'ms')
            freeze(page,280)
            peak=page.eval_on_selector('.link[data-from="2"]','e=>parseFloat(getComputedStyle(e).strokeOpacity)');check(f'advance.{run}.peak_alpha',peak,.78,.90)
            page.screenshot(path=str(OUT/f'advance-{run}-connection.png'))
            before=page.locator('.station[data-index="3"]').bounding_box();freeze(page,515);after=page.locator('.station[data-index="3"]').bounding_box()
            check(f'current.{run}.displacement',math.hypot(after['x']-before['x'],after['y']-before['y']),0,0,'px')
            page.screenshot(path=str(OUT/f'advance-{run}-bracket.png'))
        for name,bounds in [('check',(120,160)),('connection',(240,320)),('bracket',(160,220))]:timing('advance.'+name,samples[name],*bounds)
        # Also time actual browser playback, separate from deterministic timeline settings.
        playback={k:[] for k in ['check','connection','bracket']}
        for run in range(3):
            go(page,'progress=2')
            measured=page.evaluate('''async()=>{const original=Element.prototype.animate,results={};Element.prototype.animate=function(...args){const a=original.apply(this,args);a.finished.then(()=>{results[a.id]=document.timeline.currentTime-a.startTime-a.effect.getTiming().delay});return a};try{await map20.advance();return results}finally{Element.prototype.animate=original}}''')
            for k in playback:playback[k].append(measured[k])
        for name,bounds in [('check',(120,160)),('connection',(240,320)),('bracket',(160,220))]:timing('playback.'+name,playback[name],*bounds)
        # Normal camera actual rAF progression, both fully visible and occluded.
        camera_times=[];camera_dist=[]
        for run in range(3):
            go(page,'progress=2');check('camera.visible_no_scroll',page.evaluate('async()=>{let w=document.querySelector(".map-window"),s=w.scrollTop;await map20.ensureVisible(3);return Math.abs(w.scrollTop-s)}'),0,0,'px')
            delta=page.evaluate('async()=>{let w=document.querySelector(".map-window"),nodes=[...document.querySelectorAll(".station")];w.scrollTop=0;let index=nodes.findIndex(e=>e.getBoundingClientRect().bottom>w.getBoundingClientRect().bottom),n=nodes[index];let start=performance.now();await map20.ensureVisible(index);let r=n.getBoundingClientRect(),v=w.getBoundingClientRect();return {elapsed:performance.now()-start,delta:w.scrollTop,percent:w.scrollTop/innerHeight*100,centerDistance:Math.abs(r.y+r.height/2-(v.y+v.height/2))}}')
            camera_times.append(delta['elapsed']);camera_dist.append(delta['percent'])
            check(f'camera.{run}.not_centered',delta['centerDistance'],1,900,'px')
        timing('camera.duration',camera_times,280,380);check('camera.distance',camera_dist,12,28,'% viewport height')
        reduced_times=[]
        for run in range(3):
            go(page,'progress=2&motion=off');start_advance(page);freeze(page,0)
            reduced_times.append(page.evaluate('document.getAnimations()[0].effect.getTiming().duration'))
            check(f'reduced.{run}.all_state_durations',page.evaluate('document.getAnimations().map(a=>a.effect.getTiming().duration)'),100,160,'ms')
            check(f'reduced.{run}.tracking',page.evaluate('async()=>{let w=document.querySelector(".map-window"),s=w.scrollTop;await map20.ensureVisible(10);return Math.abs(w.scrollTop-s)}'),0,0,'px')
            page.screenshot(path=str(OUT/f'reduced-{run}.png'))
            check(f'reduced.{run}.static_state_shapes',page.locator('.done .check, .locked .lock, .current .bracket').count(),20,20)
        timing('reduced.duration',reduced_times,100,160)
        page.emulate_media(reduced_motion='reduce');go(page,'progress=2');start_advance(page);freeze(page,0)
        check('reduced.media_query',page.evaluate('document.getAnimations().map(a=>a.effect.getTiming().duration)'),100,160,'ms')
        page.emulate_media(reduced_motion='no-preference')
        # Every progress hook, actual completion, boss failure and expiry behavior.
        for n in range(21):
            go(page,f'progress={n}')
            check(f'progress.{n}.completed',page.locator('.station.done').count(),n,n)
            check(f'progress.{n}.current',page.locator('.station.current').count(),int(n<20),int(n<20))
        go(page,'progress=19&motion=off');page.locator('#advance').click();page.wait_for_function('map20.progress===20');check('tasks.final_complete',map_bool(page.locator('#advance').is_visible()),0,0)
        go(page,'progress=3');page.locator('#fail').click();check('cooldown.failure_seconds',page.evaluate('map20.remaining(3)'),179,180,'s')
        page.screenshot(path=str(OUT/'boss-cooldown.png'))
        check('cooldown.result_disabled',int(page.locator('#advance').is_disabled()),1,1)
        go(page,'progress=3&cooldown=1');page.wait_for_timeout(1100);check('cooldown.expired_enabled',int(page.locator('#advance').is_enabled()),1,1)
        # Headless tab switching is not a real hide. Record truth, never patch visibilityState.
        hidden_samples=[]
        for run in range(3):
            go(page,'progress=3&cooldown=30')
            before=page.evaluate('({remaining:map20.remaining(3),now:Date.now()})')
            page.evaluate('window.visibilityEvidence=[];document.addEventListener("visibilitychange",()=>visibilityEvidence.push({state:document.visibilityState,at:Date.now()}))')
            other=context.new_page();other.goto('about:blank');other.bring_to_front()
            hidden=page.evaluate('document.visibilityState')
            time.sleep(5)
            page.bring_to_front();barrier(page)
            after=page.evaluate('({remaining:map20.remaining(3),now:Date.now()})')
            events=page.evaluate('visibilityEvidence')
            other.close();hidden_samples.append({'visibility':hidden,'elapsed_ms':after['now']-before['now'],'countdown_drop':before['remaining']-after['remaining'],'events':events})
        RESULT['evidence']['hidden_trials']=hidden_samples
        check('cooldown.hidden_state',[int(x['visibility']=='hidden') for x in hidden_samples],1,1)
        check('cooldown.hidden_countdown_drop',statistics.mean(x['countdown_drop'] for x in hidden_samples),4,6,'s','Only valid if cooldown.hidden_state passes.')
        RESULT['checks']['cooldown.hidden_countdown_drop']['samples']=[x['countdown_drop'] for x in hidden_samples]
        if any(x['visibility']!='hidden' for x in hidden_samples):
            RESULT['checks']['cooldown.hidden_state']['status']='NEEDS_DEVICE'
            RESULT['checks']['cooldown.hidden_countdown_drop']['status']='NEEDS_DEVICE'
            RESULT['manual'].append('這需要實機量：目前 headless Chromium 的分頁切換仍回報 visible；5 秒實時倒數成立，但不能宣稱通過隱藏分頁測試。')
        round2(page)
        check('runtime.errors',len(errors),0,0);RESULT['evidence']['errors']=errors
        browser.close()
    old=json.loads((ROOT/'docs/clicker/shots/map-round1/acceptance.json').read_text(encoding='utf-8'))['checks']
    RESULT['regression']={'expected':len(old),'executed':sum(k in RESULT['checks'] for k in old),'missing':[k for k in old if k not in RESULT['checks']]}
    RESULT['status']='FAIL' if any(c['status']=='FAIL' for c in RESULT['checks'].values()) else 'NEEDS_DEVICE' if any(c['status']=='NEEDS_DEVICE' for c in RESULT['checks'].values()) else 'PASS'
    RESULT['counts']={s:sum(c['status']==s for c in RESULT['checks'].values()) for s in ['PASS','FAIL','NEEDS_DEVICE']}
    (OUT/'acceptance.json').write_text(json.dumps(RESULT,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'status':RESULT['status'],'counts':RESULT['counts'],'failed':{k:v for k,v in RESULT['checks'].items() if v['status']=='FAIL'}},ensure_ascii=False,indent=2))
    return 0 if RESULT['status']=='PASS' else 1


def map_bool(value):
    return int(value)


if __name__=='__main__':
    raise SystemExit(main())
