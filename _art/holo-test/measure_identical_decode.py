"""Isolated A/B: lazy decode of identical embedded bytes; never a thumbnail swap.

Numbers are local headless Chromium diagnostics, not hardware-independent FPS.
decodedRGBABytes is a dimension-based estimate, NOT measured GPU residency.
"""
import json
import statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
from scope3_capture import digest

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[1]/'docs/clicker/shots/identical/performance'
SAMPLE=r"""(()=>{
 const create=document.createElement.bind(document);
 document.createElement=function(tag,...rest){const el=create(tag,...rest);
   if(tag.toLowerCase()==='img')el.setAttribute('elementtiming','card-image');
   if(window.__lazyCandidate && tag.toLowerCase()==='img'){el.loading='lazy';el.decoding='async';}
   return el;};
 // Observe source mutations instead of copying megabytes of base64 every rAF.
 new MutationObserver(records=>records.forEach(r=>{r.target.__srcChanged=true;}))
   .observe(document,{subtree:true,attributes:true,attributeFilter:['src']});
 window.__frames=[];window.__firstVisible=null;window.__stop=false;
 window.__cardPaints=[];
 window.__cardElementPaints=[];
 new PerformanceObserver(list=>list.getEntries().forEach(e=>{
   if(e.element&&e.element.closest('.hcard')&&e.intersectionRect.width>0&&e.intersectionRect.height>0)
     __cardElementPaints.push({t:e.renderTime||e.startTime,identifier:e.identifier,
       w:e.naturalWidth,h:e.naturalHeight,intersection:e.intersectionRect.toJSON(),card:e.element.closest('.hcard').dataset.id});
 })).observe({type:'element',buffered:true});
 new PerformanceObserver(list=>list.getEntries().forEach(e=>{
   if(e.element&&e.element.closest('.hcard'))__cardPaints.push({t:e.renderTime||e.startTime,size:e.size,tag:e.element.tagName});
 })).observe({type:'largest-contentful-paint',buffered:true});
 function frame(t){
   const cards=[...document.querySelectorAll('.hcard')];
   const images=cards.flatMap(c=>[...c.querySelectorAll('img')]);
   const visible=images.filter(i=>{const b=i.getBoundingClientRect();return b.width>0&&b.height>0&&b.bottom>0&&b.top<innerHeight&&b.right>0&&b.left<innerWidth;});
   const pending=visible.filter(i=>!i.complete||i.naturalWidth===0).length;
   if(visible.length&&!pending&&document.fonts.status==='loaded'&&window.__firstVisible===null)window.__firstVisible=t;
   window.__frames.push({t,visible:visible.length,pending,images:images.map((i,index)=>({
     index,w:i.naturalWidth,h:i.naturalHeight,complete:i.complete,changed:!!i.__srcChanged}))});
   if(!window.__stop)requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
})()"""

def image_memory(cdp, page):
    # Dump after timing so tracing overhead cannot inflate the idle sample.
    cdp.send('Tracing.start',{'transferMode':'ReturnAsStream','traceConfig':{
        'includedCategories':['disabled-by-default-memory-infra'],'memoryDumpConfig':{'triggers':[]}}})
    dump=cdp.send('Tracing.requestMemoryDump',{'levelOfDetail':'detailed'})
    assert dump['success'], dump
    done=[]
    cdp.on('Tracing.tracingComplete',lambda e:done.append(e))
    cdp.send('Tracing.end')
    while not done:page.wait_for_timeout(100)
    chunks=[]
    while True:
        part=cdp.send('IO.read',{'handle':done[0]['stream']})
        chunks.append(part['data'])
        if part.get('eof'):break
    cdp.send('IO.close',{'handle':done[0]['stream']})
    events=json.loads(''.join(chunks))['traceEvents']
    rows=[]
    for event in events:
        alloc=event.get('args',{}).get('dumps',{}).get('allocators',{})
        if 'cc/image_memory' in alloc:
            row=alloc['cc/image_memory']
            rows.append(dict(pid=event['pid'],bytes=int(row['attrs']['size']['value'],16),raw=row))
    assert rows, 'No Chromium compositor image-memory allocator reported'
    return {'bytes':sum(r['bytes'] for r in rows),'allocators':rows,'dump':dump}

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    result={'sourceSha256':digest(HERE/'cards-remade-standalone.html'),
        'dpr':1,'headless':True,
        'candidate':'img loading=lazy decoding=async before src; same embedded bytes; no product changes',
        'memoryLimitation':'decodedRGBABytes estimates unique complete image width*height*4; not actual decoded cache or GPU residency',
        'runs':[]}
    with sync_playwright() as pw:
        for vp in [(1440,1200),(390,844)]:
            for run in range(3):
                for candidate in [False,True] if run%2==0 else [True,False]:
                    br=pw.chromium.launch()
                    pg=br.new_page(viewport=dict(width=vp[0],height=vp[1]))
                    pg.add_init_script('window.__lazyCandidate='+str(candidate).lower()+';'+SAMPLE)
                    cdp=pg.context.new_cdp_session(pg);cdp.send('Performance.enable')
                    pg.goto((HERE/'cards-remade-standalone.html').as_uri(),wait_until='domcontentloaded')
                    pg.wait_for_timeout(7000)
                    metrics={m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
                    data=pg.evaluate(r"""()=>{window.__stop=true;
                      const imgs=[...document.querySelectorAll('.hcard img')];
                      const unique=[...new Map(imgs.filter(i=>i.complete&&i.naturalWidth).map(i=>[i.src,i])).values()];
                      return {firstVisibleMs:__firstVisible,frames:__frames,cardPaints:__cardPaints,cardElementPaints:__cardElementPaints,
                        firstCardPaintMs:__cardElementPaints.length?__cardElementPaints[0].t:null,
                        decodedRGBABytes:unique.reduce((s,i)=>s+i.naturalWidth*i.naturalHeight*4,0),
                        completeUniqueImages:unique.length};}""")
                    frames=data['frames'];end=frames[-1]['t'];idle=[f['t'] for f in frames if f['t']>=end-3000]
                    data.update(viewport='%dx%d'%vp,candidate=candidate,run=run,jsHeapBytes=metrics['JSHeapUsedSize'],
                        idleFps=(len(idle)-1)*1000/(idle[-1]-idle[0]),chromium=br.version)
                    data['changedSourceFrames']=sum(any(i['changed'] for i in f['images']) for f in frames)
                    data['pendingVisibleFrames']=sum(f['pending']>0 for f in frames)
                    data['pendingAfterFirstVisibleFrames']=sum(f['pending']>0 and data['firstVisibleMs'] is not None
                        and f['t']>=data['firstVisibleMs'] for f in frames)
                    sizes={}
                    for frame in frames:
                        for im in frame['images']:
                            if im['w'] and im['h']:sizes.setdefault(im['index'],set()).add((im['w'],im['h']))
                    data['nonzeroDimensionVariants']={str(k):sorted(v) for k,v in sizes.items()}
                    final_sizes={k:max(v,key=lambda size:size[0]*size[1]) for k,v in sizes.items()}
                    data['lowResolutionIntermediateFrames']=sum(any(im['w']>0 and
                        (im['w'],im['h'])!=final_sizes[im['index']] for im in frame['images']) for frame in frames)
                    data['compositorImageMemory']=image_memory(cdp,pg)
                    filename=f"{vp[0]}x{vp[1]}-{'lazy' if candidate else 'baseline'}-{run}"
                    pg.screenshot(path=str(OUT/(filename+'.png')))
                    (OUT/(filename+'.json')).write_text(json.dumps(data),encoding='utf-8')
                    result['runs'].append({k:v for k,v in data.items() if k!='frames'})
                    (OUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
                    print(filename,data['firstVisibleMs'],data['idleFps'],data['jsHeapBytes'],data['decodedRGBABytes'],flush=True)
                    br.close()
    result['adopted']=False
    result['reason']='No hover-only decode adopted: visible cards must already show final artwork. The same-byte lazy candidate needs consistent benefit and a presentation-frame guarantee before adoption.'
    (OUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')

if __name__=='__main__': main()
