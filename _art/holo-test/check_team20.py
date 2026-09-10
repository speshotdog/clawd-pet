"""Team round acceptance, called by check_map20.py after all map regressions.

All raster masks are fixed BEFORE ablations. D = detail panel; K = neutral
card-host rectangle; UI = visible panel union minus K and proxy art windows;
C = shared capacity/roster/skill rails and carrier; R = K expanded 24 minus
K expanded 8, intersected with actual carrier, excluding all text.
"""
import io
import json
import math
import hashlib
from pathlib import Path
from PIL import Image, ImageChops, ImageStat, ImageDraw


def run_team(page, result, out, check, go, freeze, barrier, mask, area, rects, pair, contrast, landmarks):
    root=Path(__file__).resolve().parents[2]
    def rects(page, selector):
        # Unlike the map-only helper, the roster has an independent clipping
        # ancestor. Never subtract offscreen proxy art from visible skill UI.
        return page.eval_on_selector_all(selector, '''es=>es.flatMap(e=>{let r=e.getBoundingClientRect(),a=[Math.max(0,r.left),Math.max(0,r.top),Math.min(innerWidth,r.right),Math.min(innerHeight,r.bottom)];for(let p=e;p;p=p.parentElement){let s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return [];if(p!==e&&/(auto|scroll|hidden|clip)/.test(s.overflow)){let c=p.getBoundingClientRect();a=[Math.max(a[0],c.left),Math.max(a[1],c.top),Math.min(a[2],c.right),Math.min(a[3],c.bottom)]}}return a[2]>a[0]&&a[3]>a[1]?[a]:[]})''')
    result['manual'].extend([
        '待人工判定：隱去姓名，代理圖配對原卡正確率 90–100%，耗時 2–4 秒；68px 辨識下限未證實。',
        '待人工判定：由詳情定位隊伍及替換操作正確率 90–100%。',
        '待人工判定：灰階 C 分類正確率 85–100%。',
        '待人工判定：承載開的編隊物件判定 85–100%、獨立嵌入 0–15%、並排有效改善 80–100%。',
        '待人工判定：主要角色輪廓面積 45–70%；flat 無獨立角色遮罩，不能把整幅背景或透明框面積冒充輪廓。',
        'common 暫定併入精良；技能來源尚未定案，本輪不定義技能戰力。'])
    baseline=json.loads((out/'protected-before.json').read_text(encoding='utf-8'))
    changed=[p for p,h in baseline.items() if hashlib.sha256((root/p).read_bytes()).hexdigest()!=h]
    check('team.protected_files_changed',len(changed),0,0,'files');result['evidence']['protected_changed']=changed
    requests=[]
    page.on('request',lambda r:requests.append(r.url) if not r.url.startswith(('data:','file:')) else None)
    for w,h in [(1440,900),(1024,768),(390,844)]:
        page.set_viewport_size({'width':w,'height':h});go(page,'screen=team');freeze(page,0)
        tag=f'team-{w}x{h}';size=(w,h)
        geom=page.evaluate('''()=>{const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],r=e=>e.getBoundingClientRect(),s=e=>getComputedStyle(e),grid=q('.team-grid');let cards=all('#team-grid .team-proxy:not([hidden]) .proxy-image');return {count:all('#team-grid .team-proxy').length,widths:cards.map(e=>r(e).width),ratios:cards.map(e=>r(e).width/r(e).height),cols:s(grid).gridTemplateColumns.split(' ').length,gap:parseFloat(s(grid).gap),rowHeights:all('.capacity-row').map(e=>r(e).height),rowFonts:all('.capacity-row').map(e=>parseFloat(s(e).fontSize)),nameFonts:all('.proxy-name').map(e=>parseFloat(s(e).fontSize)),color:s(q('.capacity-row')).color,bg:s(q('.capacity')).backgroundColor,nameColor:s(q('.proxy-name')).color,nameBg:s(q('.team-roster')).backgroundColor,skillHeights:all('.skill-slot').map(e=>r(e).height),skillGap:parseFloat(s(q('.skill-grid')).gap),skillCount:all('.skill-slot').length,overlap:cards.flatMap((a,i)=>cards.slice(i+1).map(b=>{const A=r(a),B=r(b);return Math.max(0,Math.min(A.right,B.right)-Math.max(A.left,B.left))*Math.max(0,Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top))})).reduce((a,b)=>a+b,0),overflow:Math.max(0,document.body.scrollWidth-innerWidth)}}''')
        result['evidence'][tag+'.geometry']=geom
        check(tag+'.full_team',geom['count'],20,20)
        check(tag+'.columns',geom['cols'],5,5)
        check(tag+'.proxy_width',geom['widths'],96 if w<700 else 110 if w<1251 else 140,130 if w<700 else 150 if w<1251 else 200,'px')
        check(tag+'.proxy_ratio',geom['ratios'],5/7-.001,5/7+.001)
        check(tag+'.gap',geom['gap'],8,12,'px');check(tag+'.overlap',geom['overlap'],0,0,'px²')
        check(tag+'.capacity_height',geom['rowHeights'],24,36,'px');check(tag+'.capacity_font',geom['rowFonts'],13,15,'px')
        check(tag+'.capacity_contrast',contrast(geom['color'],geom['bg']),4.5,7,':1')
        check(tag+'.name_font',geom['nameFonts'],12,14,'px');check(tag+'.name_contrast',contrast(geom['nameColor'],geom['nameBg']),4.5,7,':1')
        check(tag+'.skills',geom['skillCount'],4,4);check(tag+'.skill_height',geom['skillHeights'],56,72,'px');check(tag+'.skill_gap',geom['skillGap'],8,12,'px')
        check(tag+'.overflow',geom['overflow'],0,0,'px')
        page.screenshot(path=str(out/f'{tag}-overview.png'))
        visiblecards=mask(size,rects(page,'#team-grid .proxy-image')+rects(page,'#card-host'))
        visibleui=ImageChops.logical_and(mask(size,rects(page,'.team-heading,.capacity,.team-roster-head,.roster-pages,.team-skills,.team-detail-header,.team-detail-note,.team-detail-actions,.carrier-board')),ImageChops.invert(visiblecards))
        visiblecards.convert('L').save(out/f'{tag}-visible-cards-mask.png')
        visibleui.convert('L').save(out/f'{tag}-visible-ui-mask.png')
        check(tag+'.visible_card_area',area(visiblecards)/(w*h)*100,45,70,'% viewport')
        check(tag+'.visible_noncard_ui_area',area(visibleui)/(w*h)*100,12,30,'% viewport')
        check(tag+'.visible_page_count',page.locator('#team-grid .team-proxy:visible').count(),10,10)
        ids=page.evaluate('''()=>{let ids=[];for(let p=0;p<2;p++){team20.showPage(p);ids.push(...[...document.querySelectorAll('#team-grid .team-proxy:not([hidden])')].map(e=>e.dataset.id))}team20.showPage(0);return [...new Set(ids)]}''')
        check(tag+'.page_union_count',len(ids),20,20)
        page.locator('#roster-next').click();page.evaluate("document.querySelector('.roster-scroll').scrollLeft=10000;document.querySelector('.roster-scroll').scrollTop=10000")
        barrier(page);page.screenshot(path=str(out/f'{tag}-page2-end.png'))
        check(tag+'.last_member_reachable',page.eval_on_selector('#team-grid .team-proxy:last-child .proxy-image','''e=>{let a=e.getBoundingClientRect(),b=document.querySelector('.roster-scroll').getBoundingClientRect();return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))/(a.width*a.height)*100}'''),100,100,'%')
        page.locator('#roster-prev').click();page.evaluate("document.querySelector('.roster-scroll').scrollLeft=0;document.querySelector('.roster-scroll').scrollTop=0")
        barrier(page)
        if w==1440: page.screenshot(path=str(out/'team-1440x900-original.png'))
        page.evaluate("document.querySelectorAll('.proxy-name').forEach(e=>e.style.visibility='hidden')");barrier(page)
        page.evaluate("document.querySelectorAll('.overview-face').forEach(e=>e.shadowRoot.querySelectorAll('.face-name').forEach(n=>n.style.visibility='hidden'))")
        barrier(page)
        page.screenshot(path=str(out/f'{tag}-names-hidden.png'))
        page.evaluate("document.querySelectorAll('.overview-face').forEach(e=>e.shadowRoot.querySelectorAll('.face-name').forEach(n=>n.style.visibility=''))")
        page.evaluate("document.querySelectorAll('.proxy-name').forEach(e=>e.style.visibility='')")
        persistent=page.evaluate('''()=>{const q=s=>document.querySelector(s),before=['.capacity','.team-skills'].map(s=>q(s).getBoundingClientRect().toJSON());q('.roster-scroll').scrollTop=10000;q('.roster-scroll').scrollLeft=10000;return before.map((b,i)=>{let a=q(['.capacity','.team-skills'][i]).getBoundingClientRect();return Math.abs(a.y-b.y)+Math.abs(a.height-b.height)+(a.top<0||a.bottom>innerHeight?1000:0)})}''')
        check(tag+'.fixed_capacity_skills',persistent,0,0,'px');page.evaluate("document.querySelector('.roster-scroll').scrollTop=0;document.querySelector('.roster-scroll').scrollLeft=0")
        # Identity checks across ALL 20 slots, not just one matching color.
        identities=page.evaluate('''()=>team20.roster.map((id,i)=>{team20.select(id);const q=s=>document.querySelector(s);return Number(q('#detail-number').textContent===String(i+1).padStart(2,'0')&&q('#team-detail').dataset.id===id&&q('#detail-operation').textContent.includes(team20.cards.find(c=>c.id===id).name)&&q('#team-grid [aria-selected=true]').dataset.id===id&&team20.face.dataset.id===id)})''')
        check(tag+'.identity_sync',sum(identities)/len(identities)*100,100,100,'%')
        # Representative matrix includes each rarity, all art kinds, dark and light art.
        samples=['rocketdog','mieshi','liulangyueshou','alienkitty','foxfriend','astronaut','alu','chaichai']
        for ident in samples:
            page.evaluate('(id)=>team20.select(id,true)',ident);page.evaluate('document.fonts.ready');barrier(page)
            page.evaluate('''async()=>{await Promise.all([...document.querySelector('#card-host').shadowRoot.querySelectorAll('img')].map(i=>i.decode()))}''')
            page.mouse.move(1,1);page.evaluate('team20.pose(0,0)');freeze(page,0)
            k=rects(page,'#card-host')[0];d=rects(page,'#team-detail')[0];slot=rects(page,'.card-slot')[0]
            km=mask(size,[k]);dm=mask(size,[d]);prox=mask(size,rects(page,'.proxy-image'))
            ui=ImageChops.logical_and(mask(size,rects(page,'[data-team-ui]')),ImageChops.invert(ImageChops.logical_or(km,prox)))
            # Mobile detail sheet occludes underlying panels; remove the covered layer.
            if w<700:
                ui=ImageChops.logical_and(mask(size,[d,*rects(page,'.team-heading')]),ImageChops.invert(km))
            rail=ImageChops.logical_and(ui,mask(size,rects(page,'.capacity,.team-roster,.team-skills,.card-slot')))
            if w<700: rail=ImageChops.logical_and(ui,mask(size,[d]))
            texture=Image.new('1',size)
            supports=rects(page,'.carrier-board>.team-texture') if w<700 else rects(page,'.team-texture')
            for a,b,c,e in supports:
                carrier_support=rects(page,'.carrier-board>.team-texture')[0]
                t=14 if [a,b,c,e]==carrier_support else 12
                ring=ImageChops.logical_and(mask(size,[[a,b,c,e]]),ImageChops.invert(mask(size,[[a+t,b+t,c-t,e-t]])))
                texture=ImageChops.logical_or(texture,ring)
            texture=ImageChops.logical_and(texture,ui)
            outer=[k[0]-24,k[1]-24,k[2]+24,k[3]+24];inner=[k[0]-8,k[1]-8,k[2]+8,k[3]+8]
            rm=ImageChops.logical_and(mask(size,[outer]),ImageChops.invert(mask(size,[inner])))
            carrier=rects(page,'.carrier-board')[0]
            rm=ImageChops.logical_and(rm,mask(size,[carrier]))
            # Predeclared text-free blank patch on the carrier top edge.
            blank=[carrier[0]+40,carrier[1]+1,carrier[0]+120,carrier[1]+7]
            prefix=f'{tag}-{ident}'
            result['evidence'][prefix+'.denominators']={'D':d,'K':k,'slot':slot,'R_pixels':area(rm),'UI_pixels':area(ui),'blank':blank,'mask_policy':__doc__}
            if ident==samples[0]:
                check(tag+'.detail_width',k[2]-k[0],280,400,'px')
                check(tag+'.card_detail_area',area(km)/area(dm)*100,35,50,'%')
                check(tag+'.new_language_area',area(rail)/area(ui)*100,65,85,'%',note='Historical round-one metric; retained, not a round-two visual-success claim')
                check(tag+'.texture_area',area(texture)/area(ui)*100,12,22,'%')
                check(tag+'.slot_gap',[k[0]-slot[0],k[1]-slot[1],slot[2]-k[2],slot[3]-k[3]],8,16,'px')
                check(tag+'.card_clipped',page.eval_on_selector('#card-host','e=>{const r=e.getBoundingClientRect();return 100*(1-Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left))*Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))/(r.width*r.height))}'),0,0,'%')
                for name,m in [('D',dm),('K',km),('UI',ui),('C',rail),('R',rm),('texture',texture)]:m.convert('L').save(out/f'{tag}-{name}-mask.png')
            for pose,(x,y) in [('neutral',(0,0)),('upper-left',(-.6,-.6)),('lower-right',(.6,.6))]:
                page.evaluate('([x,y])=>team20.pose(x,y)',[x,y]);freeze(page,0)
                page.evaluate('team20.ablate([])');freeze(page,0)
                on=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
                for flags,label in [(['carrier','texture','selection'],'all'),(['carrier'],'carrier'),(['texture'],'texture'),(['selection'],'selection')]:
                    page.evaluate('(flags)=>team20.ablate(flags)',flags);freeze(page,0)
                    off=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
                    pair(off,on,out/f'{prefix}-{pose}-{label}-pair.png')
                    delta=ImageChops.difference(on.convert('L'),off.convert('L'))

                    core_mask=mask(size,[[k[0]+24,k[1]+24,k[2]-24,k[3]-24]])
                    core_rgb=ImageChops.difference(on,off);cb=core_rgb.split()
                    core_max=ImageChops.lighter(ImageChops.lighter(cb[0],cb[1]),cb[2])
                    ch=core_max.histogram(mask=core_mask.convert('L'))
                    check(f'{prefix}.{pose}.{label}_core_difference',sum(ch[1:])/max(1,sum(ch))*100,0,0,'%')
                    if label=='carrier':
                        hist=delta.histogram(mask=rm.convert('L'));den=max(1,sum(hist))
                        check(f'{prefix}.{pose}.seam_delta',sum(hist[8:])/den*100,25,60,'% R')
                        rgbdiff=ImageChops.difference(on,off)
                        bands=rgbdiff.split();maximum=ImageChops.lighter(ImageChops.lighter(bands[0],bands[1]),bands[2])
                        dh=maximum.histogram(mask=dm.convert('L'))
                        check(f'{prefix}.{pose}.detail_delta',sum(dh[3:])/max(1,sum(dh))*100,12,35,'% D')
                        signed=[a-b for a,b,m in zip(on.convert('L').getdata(),off.convert('L').getdata(),rm.getdata()) if m]
                        check(f'{prefix}.{pose}.glow_peak',max(signed),6,18,'/255')
                        if ident==samples[0] and pose=='neutral':
                            pair(off,on,out/f'{tag}-carrier-pair.png');pair(off.convert('L'),on.convert('L'),out/f'{tag}-carrier-gray-pair.png')
                    if label=='all':
                        # Core in neutral projection inset 24px avoids perspective edges.
                        core=mask(size,[[k[0]+24,k[1]+24,k[2]-24,k[3]-24]])
                        diff=ImageChops.difference(on,off).convert('RGB');changed=diff.point(lambda v:255 if v else 0).convert('L').point(lambda v:255 if v else 0)
                        core_changed=area(ImageChops.logical_and(changed.convert('1'),core))/area(core)*100
                        check(f'{prefix}.{pose}.card_core_difference',core_changed,0,0,'%')
                        hist=delta.histogram(mask=rm.convert('L'));den=max(1,sum(hist))
                        check(f'{prefix}.{pose}.seam_8_24',sum(hist[8:25])/den*100,20,45,'% R')
                        check(f'{prefix}.{pose}.seam_over24',sum(hist[25:])/den*100,0,5,'% R')
                        if ident==samples[0] and pose=='neutral':
                            on.save(out/f'{tag}-detail.png')
                    if ident==samples[0] and pose=='neutral' and label=='texture':
                        check(tag+'.texture_blank_delta',ImageStat.Stat(delta.crop(tuple(map(round,blank)))).mean[0],6,14,'/255')
                page.evaluate('team20.ablate([])')
        perf=page.evaluate('''async()=>{team20.showPage(0);let intervals=[],last=performance.now();for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);let now=performance.now();intervals.push(now-last);last=now}let start=performance.now();team20.showPage(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));let switchMs=performance.now()-start;team20.showPage(0);return {intervals,switchMs,overviewFaces:[...document.querySelectorAll('.overview-face')].filter(e=>e.shadowRoot.querySelector('.hcard')).length}}''')
        result['evidence'][tag+'.performance']=perf
        check(tag+'.mounted_overview_faces',perf['overviewFaces'],10,10)
        # Only the detail host installs pointer / keyboard material handlers.
        overview_pose=page.evaluate('''()=>[...document.querySelectorAll('.overview-face')].map(e=>{let f=e.shadowRoot.querySelector('.hcard');return f.style.cssText})''')
        page.mouse.move(100,350);barrier(page)
        check(tag+'.overview_pointer_unchanged',int(overview_pose==page.evaluate('''()=>[...document.querySelectorAll('.overview-face')].map(e=>e.shadowRoot.querySelector('.hcard').style.cssText)''')),1,1)
        # Interaction accepts only the one mounted full face.
        check(tag+'.interactive_cards',page.locator('#card-host .hcard').count(),1,1)
        check(tag+'.proxy_animations',page.eval_on_selector_all('.team-proxy','es=>es.reduce((n,e)=>n+e.getAnimations({subtree:true}).length,0)'),0,0)
        check(tag+'.automatic_animations',page.evaluate('document.getAnimations().length'),0,0)
        check(tag+'.invented_meters',page.locator('#team-screen meter,#team-screen progress,#team-screen [role=progressbar]').count(),0,0)
        check(tag+'.skill_connection_lines',page.locator('.team-skills svg,.team-skills canvas').count(),0,0)
    # Mixed team: 2 mythic + 4 legendary already exhaust second cumulative row.
    go(page,'screen=team');page.evaluate('team20.reset()');before=page.evaluate('team20.roster')
    accepted=page.evaluate("team20.add('jintianwoshengri')")
    check('team.mixed_legendary_rejected',int(accepted),0,0)
    check('team.rejection_roster_unchanged',int(before==page.evaluate('team20.roster')),1,1)
    check('team.mixed_rejected_rows',page.evaluate('team20.state.lastReject.rows'),1,3,'row indexes; expected 1,2,3')
    check('team.mixed_all_rows_marked',page.locator('.capacity-row.violated').count(),3,3)
    freeze(page,0)
    anim=page.evaluate('document.getAnimations().map(a=>({id:a.id,d:a.effect.getTiming().duration}))')
    check('team.return_duration',[a['d'] for a in anim if a['id']=='team-return'],180,240,'ms')
    check('team.reject_border_duration',[a['d'] for a in anim if a['id']=='team-over-limit'],240,360,'ms')
    check('team.reject_border_width',page.eval_on_selector('.capacity-row.violated','e=>parseFloat(getComputedStyle(e).borderLeftWidth)'),2,3,'px')
    check('team.reject_border_contrast',contrast(page.eval_on_selector('.capacity-row.violated','e=>getComputedStyle(e).borderLeftColor'),page.eval_on_selector('.capacity','e=>getComputedStyle(e).backgroundColor')),4.5,7,':1')
    freeze(page,310);message=page.locator('#capacity-errors').inner_text();page.screenshot(path=str(out/'mixed-overflow.png'));page.wait_for_timeout(500)
    check('team.error_persists',int(message==page.locator('#capacity-errors').inner_text() and '7' in message),1,1)
    page.evaluate("team20.add('mieshi')");check('team.all_four_violations',page.locator('.capacity-row.violated').count(),4,4)
    result['evidence']['mixed_message']=message
    page.evaluate('team20.reset()');page.evaluate("team20.openPicker('add')");page.locator('#picker-grid [data-id="jintianwoshengri"]').click()
    page.wait_for_function('team20.state.preview!==null');check('team.preview_latency',page.evaluate('team20.state.previewElapsed'),100,160,'ms')
    check('team.preview_affected_rows',page.locator('.capacity-row.affected').count(),3,3)
    page.screenshot(path=str(out/'preview-capacity.png'));page.locator('#picker-close').click()
    page.evaluate('team20.reset()');m=page.evaluate("team20.cards.filter(c=>c.rarity==='mythic').map(c=>c.id)")
    check('team.first_mythic_skill',int(page.evaluate('(id)=>team20.assignSkill(0,id)',m[0])),1,1)
    attempts=[int(page.evaluate('([slot,id])=>team20.assignSkill(slot,id)',[i,c])) for i in (1,2,3) for c in m]
    check('team.second_mythic_skill_confirmed',sum(attempts),0,0,'attempts')
    page.evaluate("team20.openPicker('skill',1)");page.locator(f'#picker-grid [data-id="{m[1]}"]').click();page.locator('#picker-confirm').click()
    check('team.second_mythic_ui_confirmed',page.evaluate("team20.skills.filter(id=>id&&team20.cards.find(c=>c.id===id).rarity==='mythic').length"),1,1)
    page.screenshot(path=str(out/'skill-hard-limit.png'));page.locator('#picker-close').click()
    page.evaluate('team20.reset();team20.select(team20.roster[0],true)')
    page.locator('#replace-member').click();page.locator('#picker-grid [data-id="jintianwoshengri"]').click();page.locator('#picker-confirm').click()
    check('team.lower_tier_uses_vacancy',page.evaluate("Number(team20.roster[0]==='jintianwoshengri'&&JSON.stringify(team20.counts(team20.roster))==='[1,6,12,20]')"),1,1)
    removed=page.evaluate('team20.roster.at(-1)');page.evaluate('(id)=>team20.select(id,true)',removed);page.locator('#remove-member').click()
    check('team.remove_member',len(page.evaluate('team20.roster')),19,19)
    page.locator('#add-member').click();page.locator(f'#picker-grid [data-id="{removed}"]').click();page.locator('#picker-confirm').click()
    check('team.add_member',len(page.evaluate('team20.roster')),20,20)
    page.evaluate("team20.preview('mieshi');team20.setScreen('map')");page.wait_for_timeout(180)
    check('team.cancelled_preview_callback',int(page.evaluate('team20.state.preview===null')),1,1)
    check('team.map_unmounted_face',page.locator('#card-host .hcard').count(),0,0)
    page.locator('#open-team').click();check('team.navigation_one_screen',page.evaluate("Number(document.querySelector('.shell').getBoundingClientRect().height>0)+Number(document.querySelector('#team-screen').getBoundingClientRect().height>0)"),1,1)
    page.evaluate("team20.reset();team20.select(team20.roster[0],true);team20.ablate(['selection'])");barrier(page)
    check('team.ablation_preserves_status',int('已編入' in page.locator('#detail-operation').inner_text()),1,1)
    check('team.ablation_preserves_controls',int(page.locator('#replace-member').is_enabled() and page.locator('#remove-member').is_enabled()),1,1)
    page.evaluate('team20.ablate([])')
    check('team.external_requests',len(requests),0,0)
    proxy_stats=page.evaluate('team20.cards.map(c=>({id:c.id,kind:c.kind,bounds:c.proxy_bounds_share,alpha:c.proxy_alpha_share}))')
    result['evidence']['proxy_coverage']=proxy_stats
    check('team.proxy_subject_bounds', [c['bounds'] for c in proxy_stats if c['kind']!='flat'],45,70,'% proxy; complete alpha bounding box, not silhouette ink or recognition')
    check('team.pool_count',len(proxy_stats),20,24)
    for rarity in ['mythic','legendary','epic','rare']:
        check('team.pool.'+rarity,page.evaluate('(r)=>team20.cards.filter(c=>c.rarity===r).length',rarity),4,24)
    result['manual_status']='待人工判定'
    # First-segment travel: true single-position visible box maximum, no union
    # of fragments, and no changing thresholds to accommodate cropped sides.
    for w,h in [(1440,900),(1024,768),(390,844)]:
        page.set_viewport_size({'width':w,'height':h});go(page,'progress=0')
        journey=page.evaluate('''async boxes=>{const win=document.querySelector('.map-window');let rows=[];for(let pos=0;pos<=432;pos+=4){win.scrollTop=pos;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));let v=win.getBoundingClientRect(),t=document.querySelector('.terrain-tile').getBoundingClientRect(),scale=t.width/971;rows.push({scroll:win.scrollTop,visible:boxes.map(([a,b,c,d])=>{let x=t.left+a*scale,y=t.top+b*scale,W=(c-a)*scale,H=(d-b)*scale;return Math.max(0,Math.min(x+W,v.right)-Math.max(x,v.left))*Math.max(0,Math.min(y+H,v.bottom)-Math.max(y,v.top))/(W*H)*100})})}return rows}''',landmarks)
        maxima=[max(row['visible'][i] for row in journey) for i in range(3)]
        check(f'{w}x{h}.landmark_each_seen_once',maxima,90,100,'% bounding box at one scroll position')
        result['evidence'][f'{w}x{h}.landmark_whole_journey']=journey
        for i in range(3):
            best=max(journey,key=lambda row:row['visible'][i]);page.evaluate('(y)=>document.querySelector(".map-window").scrollTop=y',best['scroll']);freeze(page,0);page.screenshot(path=str(out/f'{w}x{h}-landmark-{i+1}-best.png'))
    # Grayscale component study: use the complete CURRENT CSS cascades, never
    # the superseded first declarations in clicker.css. No classification score.
    page.set_viewport_size({'width':1440,'height':900});go(page,'screen=team')
    components=[];component_styles=[]
    def capture_component(selector,label):
        box=page.locator(selector).bounding_box();pad=10
        shot=Image.open(io.BytesIO(page.screenshot(clip={'x':box['x']-pad,'y':box['y']-pad,'width':box['width']+pad*2,'height':box['height']+pad*2}))).convert('L')
        components.append((label,shot));component_styles.append({'source':label,'computed':page.eval_on_selector(selector,'e=>{let s=getComputedStyle(e);return {border:s.borderTopWidth,radius:s.borderTopLeftRadius,shadow:s.boxShadow,font:s.fontFamily,clip:s.clipPath}}')})
    capture_component('#return-map','C 編隊')
    for file,markup,label,selector in [
        (root/'src/clicker.css','<div id="game"><button style="margin:30px">返回地圖</button></div>','1.0','#game button'),
        (root/'_art/holo-test/ceremony.css','<div class="pull-actions" style="margin:30px"><button>返回地圖</button></div>','抽卡','.pull-actions button')]:
        css=file.read_text(encoding='utf-8')
        specimen=out/(file.stem+'-component.html')
        specimen.write_text('<meta charset="utf-8"><base href="'+file.parent.as_uri()+'/"><style>'+css+'</style>'+markup,encoding='utf-8')
        page.goto(specimen.as_uri())
        page.evaluate('document.fonts.ready');freeze(page,0);capture_component(selector,label)
    ordered=[components[1],components[0],components[2]]
    sheet=Image.new('L',(720,180),40);draw=ImageDraw.Draw(sheet)
    for i,(_,shot) in enumerate(ordered):
        sheet.paste(shot,(i*240+(240-shot.width)//2,50+(110-shot.height)//2));draw.text((i*240+112,16),f'{i+1:02}',fill=220)
    sheet.save(out/'classification-components-gray.png')
    (out/'classification-key.json').write_text(json.dumps({'order':[x[0] for x in ordered],'styles':component_styles,'status':'待人工判定；只提供現行元件形狀對照，沒有玩家分類數據。'},ensure_ascii=False,indent=2),encoding='utf-8')


if __name__ == '__main__':
    from check_map20 import main
    raise SystemExit(main())
