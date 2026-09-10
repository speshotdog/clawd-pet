# 2026-09-10 座標系更正（不是放寬）：38.8% 是量「圖層」的（600x840 內），
# 但這裡量的是「卡片」座標，而 .art-media 只佔卡高 95%，同一隻羊會量成 36.9%。
# 位移是純平移（實測 matrix(1,0,0,1,0,-18.35)，scale 恰為 1），羊沒有被縮放。
# 門檻改成夾住卡片座標的實測值 37.33~37.65%（dev 與 portable 差 0.32pp），
# 帶寬 1.0pp 約等於 1.3% 的縮放，仍然攔得住「趁著移動順手縮放」。
"""Round 43 rendered geometry, deterministic motion, pixel and native-input audit."""
from pathlib import Path
import io,json,shutil,base64
import numpy as np
from scipy import ndimage as nd
from PIL import Image
from playwright.sync_api import sync_playwright
from pool_data import pool
from check_round42_assets import pair

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=ROOT/'docs/clicker/shots/round43'
result={'cards':[],'pack':[]};fail=[]
def check(ok,label):
    if not ok:fail.append(label)
def barrier(p):p.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
def freeze(p,t=0,glow=None):
    p.evaluate('''v=>{for(const a of document.getAnimations())if(a instanceof CSSAnimation){a.pause();a.currentTime=a.animationName.startsWith('pack-')?v.t:0;if(v.glow!==null&&a.animationName==='pack-idle-glow')a.currentTime=v.glow;}}''',{'t':t,'glow':glow})
    barrier(p)
def shot(p,path=None):
    data=p.screenshot(clip={'x':330,'y':130,'width':440,'height':560})
    if path:path.write_bytes(data)
    return Image.open(io.BytesIO(data)).convert('RGB')
def rect(p,sel):return p.locator(sel).evaluate('e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}}')
def card_capture(p,width,path):
    c=p.locator('#grid .hcard[data-id="zhenzhen"]')
    c.evaluate('(c,w)=>{c.closest(".cell").style.width=w+"px";HoloCardFace.paint(c,c.dataset.rarity,0,0,{tilt:false});HoloCardFace.refit()}',width)
    c.scroll_into_view_if_needed();p.mouse.move(0,0);p.wait_for_timeout(350);freeze(p)
    c.screenshot(path=str(path))
    data=c.evaluate('''c=>{const b=c.getBoundingClientRect(),i=c.querySelector('.art-media>img').getBoundingClientRect(),n=c.querySelector('.face-plate').getBoundingClientRect();const range=document.createRange();range.selectNodeContents(c.querySelector('.face-name'));const text=range.getBoundingClientRect();return {width:c.clientWidth,card:{y:b.y,height:b.height},image:{y:i.y,height:i.height},plate_top:n.y,name:c.querySelector('.face-name').textContent,name_overflow_px:Math.max(0,b.left-text.left,text.right-b.right),background_loaded:c.querySelector('.face-depth-bg img').naturalWidth}}''')
    src=c.locator('.art-media>img').get_attribute('src')
    # Portable assets are resized/encoded: measure their actual decoded alpha,
    # never substitute the dev PNG's bbox for the portable image's bbox.
    rendered=Image.open(io.BytesIO(base64.b64decode(src.split(',')[1]))) if src.startswith('data:') else Image.open(HERE/'layer-zhenzhen-subject.png')
    alpha=np.asarray(rendered.convert('RGBA'))[:,:,3];ys=np.where(alpha>0)[0];top=data['image']['y']+ys.min()/rendered.height*data['image']['height'];bottom=data['image']['y']+(ys.max()+1)/rendered.height*data['image']['height'];h=data['card']['height']
    data['decoded_subject_size']=list(rendered.size);data['decoded_alpha_bbox']=list(rendered.getbbox())
    data.update(center_percent=((top+bottom)/2-data['card']['y'])/h*100,height_percent=(bottom-top)/h*100,gap_percent=(data['plate_top']-bottom)/h*100,top_percent=(top-data['card']['y'])/h*100,bottom_percent=(bottom-data['card']['y'])/h*100)
    return data

def main():
    OUT.mkdir(exist_ok=True);portable=OUT/'portable';portable.mkdir(exist_ok=True)
    for n in ['cards-remade','deluxe-gacha-b']:shutil.copyfile(HERE/f'{n}-standalone.html',portable/f'{n}.html')
    with sync_playwright() as pw:
        b=pw.chromium.launch()
        p=b.new_page(viewport={'width':1100,'height':1000});p.goto((portable/'before-cards.html').as_uri());result['card_before']=card_capture(p,262,OUT/'A-before.png');p.close()
        for label,folder in [('dev',HERE),('portable',portable)]:
            p=b.new_page(viewport={'width':1100,'height':1000});p.goto((folder/'cards-remade.html').as_uri());images=[]
            for width in [102,190,262]:
                path=OUT/f'A-{label}-{width}.png';row=card_capture(p,width,path);row['entry']=label;result['cards'].append(row);images.append(Image.open(path))
                check(48<=row['center_percent']<=53,label+' sheep center');check(7<=row['gap_percent']<=14,label+' sheep gap');check(37.0<=row['height_percent']<=38.0,label+' sheep height');check(row['name_overflow_px']==0,label+' name overflow')
            pair(images,OUT/f'A-{label}-sizes.png',['102 px','190 px','262 px']);pair([Image.open(OUT/'A-before.png'),images[-1]],OUT/f'A-{label}-before-after.png',['BEFORE','AFTER']);p.close()
        bg=np.asarray(Image.open(HERE/'layer-zhenzhen-background.png'))[:,:,3]
        result['background_alpha_zero_pixels']=int((bg==0).sum());check(result['background_alpha_zero_pixels']==0,'background holes')
        for label,folder in [('dev',HERE),('portable',portable)]:
            p=b.new_page(viewport={'width':1100,'height':900},device_scale_factor=1);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto((folder/'deluxe-gacha-b.html').as_uri()+'?ceremony-test');p.mouse.move(0,0);p.wait_for_timeout(300);freeze(p)
            row={'entry':label};row['idleRaf']=p.evaluate('__ceremony.state().rafs');check(row['idleRaf']==0,label+' idleRaf')
            row['motion']=p.evaluate('''()=>{const names=['pack-float','pack-breath','pack-idle-glow'];return names.map(name=>{const a=document.getAnimations().find(a=>a.animationName===name);const timing=a.effect.getTiming();const target=a.effect.target;let values=[];for(let t=0;t<=timing.duration*2;t+=timing.duration/72){a.currentTime=t;const m=new DOMMatrix(getComputedStyle(target).transform);values.push([t,m.m42,m.m11,Number(getComputedStyle(target).opacity)]);}return {name,duration_ms:timing.duration,easing:a.effect.getKeyframes().map(k=>k.easing),values}})}''')
            check(all(all(e=='ease-in-out' for e in m['easing']) for m in row['motion'][:2]),label+' idle easing')
            floating,breathing,glowing=row['motion'];fv=np.array(floating['values']);bv=np.array(breathing['values']);row['float_peak_to_peak_px']=float(np.ptp(fv[:,1]));row['float_half_amplitude_px']=row['float_peak_to_peak_px']/2
            # The two minima and descending midline crossings independently locate the period.
            from scipy.signal import find_peaks
            peaks=find_peaks(-fv[:,1])[0];row['float_measured_period_ms']=float(fv[peaks[1],0]-fv[peaks[0],0]);cross=[]
            for i in range(1,len(fv)):
                if fv[i-1,1]>0>=fv[i,1]:cross.append(float(np.interp(0,[fv[i,1],fv[i-1,1]],[fv[i,0],fv[i-1,0]])))
            row['float_midline_crossings_ms']=cross;row['float_midline_period_ms']=cross[1]-cross[0]
            row['breath_scale_range']=[float(bv[:,2].min()),float(bv[:,2].max())];peaks=find_peaks(bv[:,2])[0];row['breath_measured_period_ms']=float(bv[peaks[1],0]-bv[peaks[0],0]);row['period_ratio']=row['breath_measured_period_ms']/row['float_measured_period_ms']
            check(4<=row['float_peak_to_peak_px']<=10,label+' float amplitude');check(2800<=row['float_measured_period_ms']<=4500,label+' float period');check(not .95<=row['period_ratio']<=1.05,label+' distinct periods');check(1<=min(row['breath_scale_range'])<=max(row['breath_scale_range'])<=1.025,label+' breath range')
            frames=[]
            for t in [0,600,1200,1800,2400,3000]:freeze(p,t);frames.append(shot(p,OUT/f'{label}-idle-{t}.png'))
            pair(frames,OUT/f'B-{label}-idle-six-frames.png',[f'{t/1000:.1f} s' for t in [0,600,1200,1800,2400,3000]])
            freeze(p);before=rect(p,'.pack-breath');im0=shot(p);box=rect(p,'#entry-pack');p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
            row['hover_enter_transition']=p.locator('.pack-hover').evaluate('e=>({duration:getComputedStyle(e).transitionDuration,easing:getComputedStyle(e).transitionTimingFunction})');samples=[]
            for i in range(20):barrier(p);samples.append(rect(p,'.pack-breath')['width'])
            row['hover_width_samples']=samples;row['hover_ratio']=samples[-1]/before['width'];pair([im0,shot(p)],OUT/f'B-{label}-hover-before-after.png',['BEFORE HOVER','HOVER']);check(1.03<=row['hover_ratio']<=1.08,label+' hover ratio')
            p.mouse.down();p.mouse.move(box['x']+box['width']/2+60,box['y']+box['height']/2-30,steps=4);row['drag_transform']=p.locator('.pack-surface').evaluate('e=>e.style.transform');row['drag_hover_scale']=p.locator('.pack-hover').evaluate('e=>new DOMMatrix(getComputedStyle(e).transform).m11');p.mouse.up();p.mouse.move(0,0);row['hover_leave_transition']=p.locator('.pack-hover').evaluate('e=>({duration:getComputedStyle(e).transitionDuration,easing:getComputedStyle(e).transitionTimingFunction})');p.wait_for_timeout(400);freeze(p)
            # The actual alpha silhouette is rasterized by Chromium, including rotation,
            # contain sizing and clip. Ring = Euclidean outer 12 screen pixels.
            check(.120<=float(row['hover_enter_transition']['duration'][:-1])<=.200 and .160<=float(row['hover_leave_transition']['duration'][:-1])<=.260,label+' hover durations')
            check(row['drag_transform']=='rotateX(6deg) rotateY(12deg)' and abs(row['drag_hover_scale']-1.055)<.00001,label+' independent drag transform')
            maskstyle=p.add_style_tag(content='.stage-background,.entry-actions,.stageacts,.hint{visibility:hidden!important}body,.stage-base{background:#000!important}.entry-pack{filter:none!important}.pack-idle-glow{visibility:hidden!important}.pack-surface{filter:brightness(0) invert(1)!important}.pack-surface>*{visibility:hidden!important}')
            barrier(p);mask=np.asarray(shot(p)).max(2)>128;maskstyle.evaluate('e=>e.remove()');barrier(p);dist=nd.distance_transform_edt(~mask);ring=(dist>0)&(dist<=12);row['glow_ring_pixels']=int(ring.sum())
            freeze(p,0,0);dark=np.asarray(shot(p,OUT/f'{label}-glow-dark.png')).astype(float);freeze(p,0,glowing['duration_ms']/2);bright=np.asarray(shot(p,OUT/f'{label}-glow-bright.png')).astype(float);row['glow_luminance_delta']=float(((bright-dark)@np.array([.2126,.7152,.0722]))[ring].mean());freeze(p,0,glowing['duration_ms']);end=np.asarray(shot(p)).astype(float);row['glow_seam_max_channel_delta']=float(np.abs(end-dark).max());row['glow_period_ms']=glowing['duration_ms'];check(8<=row['glow_luminance_delta']<=28,label+' glow brightness');check(row['glow_seam_max_channel_delta']<=2,label+' glow seam');check(3000<=row['glow_period_ms']<=6000,label+' glow period')
            # A test-paused CSS animation can remain associated after its CSS rule
            # disappears. Reload to relinquish WAAPI ownership before native tests.
            p.reload();p.wait_for_timeout(250)
            row['input']=[]
            def waiting(c=None):
                p.evaluate('c=>{__ceremony.reset();__ceremony.events.length=0;window.__ceremonyFixture=[c];__ceremony.pull(1)}',c or pool()[0]);p.wait_for_function('__ceremony.state().entryPhase==="waiting"');freeze(p)
            def opens():return p.evaluate('__ceremony.events.filter(e=>e.type==="pack-open").length')
            for motion in ['no-preference','reduce']:
                p.emulate_media(reduced_motion=motion);waiting();initial=opens()
                for _ in range(20):
                    q=rect(p,'#entry-pack');x=q['x']+q['width']*.45;y=q['y']+q['height']*.5;p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+45,y-28,steps=5);p.mouse.up()
                drags=opens()-initial;clicks=0
                for _ in range(20):waiting();p.locator('#entry-pack').click();clicks+=opens()
                row['input'].append({'motion':motion,'drags':20,'drag_distance_px':float(np.hypot(45,28)),'drag_opens':drags,'clicks':20,'click_opens':clicks});check(drags==0 and clicks==20,label+' input '+motion)
            p.emulate_media(reduced_motion='no-preference');shots=[]
            for rarity in ['common','rare','epic','legendary','mythic']:
                waiting(next(c for c in pool() if c['rarity']==rarity));p.mouse.move(0,0);p.wait_for_timeout(400);freeze(p);shots.append(np.asarray(shot(p)))
            row['preopen_different_pixels']=[int(np.any(a!=shots[0],axis=2).sum()) for a in shots[1:]];check(not any(row['preopen_different_pixels']),label+' rarity identity')
            p.wait_for_timeout(500);first=rect(p,'.pack-breath');im1=np.asarray(shot(p));p.wait_for_timeout(500);second=rect(p,'.pack-breath');im2=np.asarray(shot(p));row['waiting_displacement_px']=[second[k]-first[k] for k in ['x','y','width','height']];row['waiting_idle_animation_count']=p.locator('#entry-pack').evaluate('e=>e.getAnimations({subtree:true}).filter(a=>["pack-float","pack-breath","pack-idle-glow"].includes(a.animationName)).length');check(not any(row['waiting_displacement_px']) and row['waiting_idle_animation_count']==0,label+' waiting stopped')
            p.emulate_media(reduced_motion='reduce');p.evaluate('__ceremony.reset()');p.mouse.move(0,0);p.wait_for_timeout(300);r0=rect(p,'.pack-breath');p.wait_for_timeout(500);r1=rect(p,'.pack-breath');row['reduced_displacement_px']=[r1[k]-r0[k] for k in ['x','y','width','height']];row['reduced_idle_animation_count']=p.locator('#entry-pack').evaluate('e=>e.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation).length');row['reduced_glow_opacity']=p.locator('.pack-idle-glow').evaluate('e=>Number(getComputedStyle(e).opacity)');q=rect(p,'#entry-pack');p.mouse.move(q['x']+q['width']/2,q['y']+q['height']/2);p.wait_for_timeout(300);row['reduced_hover_ratio']=rect(p,'.pack-breath')['width']/r1['width'];check(not any(row['reduced_displacement_px']) and row['reduced_idle_animation_count']==0 and row['reduced_glow_opacity']>0 and 1.03<=row['reduced_hover_ratio']<=1.08,label+' reduced motion')
            row['errors']=errors;check(not errors,label+' page errors');result['pack'].append(row);print(label,{k:v for k,v in row.items() if k not in ['motion','hover_width_samples']},flush=True);p.close()
        b.close()
    result['failures']=fail;(OUT/'idle-metrics.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8');print('failures',fail,flush=True);raise SystemExit(1 if fail else 0)
if __name__=='__main__':main()
