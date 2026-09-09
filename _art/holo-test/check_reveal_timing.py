"""Fixed fixtures and virtual time; native WAAPI effects finish on the same clock.

Only test copies are instrumented (draw fixture and read-only closure diagnostics).
Normal timing is separately exercised without instrumentation by the regression flows.
"""
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import json
from pool_data import pool

ANIMATION_CLOCK = """(() => {
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
    const a=animate.call(this,frames,options);a.pause();
    const o=typeof options==='number'?{duration:options}:options;
    const timer=setTimeout(()=>{if(a.playState!=='idle')a.finish()},(o.delay||0)+(o.duration||0)*(o.iterations||1));
    a.finished.catch(()=>{}).finally(()=>{clearTimeout(timer);window.__lastAnimationEnd=Date.now()});return a;
  };
  const Original=ResizeObserver;window.__observed=new Set();
  window.ResizeObserver=class extends Original{
    observe(e,...args){__observed.add(e);return super.observe(e,...args)}
    unobserve(e){__observed.delete(e);return super.unobserve(e)}
  };
})();"""

HOOK = """
window.__testReset=()=>{tickets=30;document.querySelector("#ticket").textContent=tickets;clearRun();};
window.__fixture=__FIXTURE__;
draw=n=>window.__fixture.slice(0,n);
window.__prepared=()=>typeof ready==='undefined'?Promise.resolve():ready;
window.__early=[];
window.__state=()=>({cascading,skipped,busy,slots:slots.length,
  started:slots.filter(s=>s.revealed).length,completed:slots.filter(s=>s.complete).length,
  ids:slots.map(s=>s.data.id),faces:fan.querySelectorAll('.hcard').length,
  hidden:btn.fin.hidden,tickets,anims:[...anims].filter(a=>a.playState!=='finished'&&a.playState!=='idle').length,
  finishAt:window.__finishVisibleAt||0,lastAnimationEnd:window.__lastAnimationEnd||0,
  detached:[...__observed].filter(e=>e.matches('.hcard')&&!e.isConnected).length,
  sparks:document.querySelectorAll('.shock,.spark').length});
new MutationObserver(()=>{if(!btn.fin.hidden){window.__finishVisibleAt=Date.now();setTimeout(()=>{
  const s=__state();if(!s.hidden&&(s.anims||s.faces!==s.slots))__early.push(s);
},0)}}).observe(btn.fin,{attributes:true,attributeFilter:['hidden']});
"""


def check_timing(ctx, here, out, repeats=20, portable_values=(False, True), evidence='timing-after.json', source_override=None):
    cards=pool()
    high=next(c for c in cards if c['id']=='rocketdog')
    low=next(c for c in cards if c['id']=='dino')
    fixtures={'wait':[high]+[low]*9,'last-before':[low]*9+[high],
              'last-after':[low]*9+[high],'front':[low]*9+[high],
              'return':[low]*9+[high]}
    # Round 29: 1790ms ten-card peel/deal, 840ms common, 320ms page handoff.
    # All ranks first appear at +320ms.
    offsets={'wait':500,'last-before':7879,'last-after':7881,'front':8201,'return':9410}
    rows=[]
    with TemporaryDirectory(prefix='timing-copies-',dir=out) as tmp:
        for portable in portable_values:
            source=source_override or here/('deluxe-gacha-b-standalone.html' if portable else 'deluxe-gacha-b.html')
            html=source.read_text(encoding='utf-8')
            hook=HOOK.replace('__FIXTURE__',json.dumps(fixtures['wait'],ensure_ascii=False))
            anchor='// Test instrumentation boundary (no window dragging).'
            assert html.count(anchor)==1
            html=html.replace(anchor,hook+'\n'+anchor)
            if not portable:html='<base href="'+here.as_uri()+'/">'+html
            copied=Path(tmp)/('portable.html' if portable else 'dev.html')
            copied.write_text(html,encoding='utf-8')
            p=ctx.new_page();errors=[];failed=[]
            p.on('pageerror',lambda e:errors.append(str(e)))
            p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            p.on('requestfailed',lambda r:failed.append(r.url))
            p.clock.install(time=datetime(2026,9,9,tzinfo=timezone.utc))
            p.clock.pause_at(datetime(2026,9,9,0,0,1,tzinfo=timezone.utc))
            p.add_init_script(ANIMATION_CLOCK)
            p.goto(copied.as_uri())
            for phase,fixture in fixtures.items():
                for repeat in range(repeats):
                    p.evaluate("""f=>{__testReset();window.__fixture=f;window.__early=[];window.__finishVisibleAt=0;window.__lastAnimationEnd=0;document.querySelector('#p10').click()}""",fixture)
                    p.evaluate('async()=>await __prepared()')
                    p.clock.run_for(1790+offsets[phase])
                    before=p.evaluate('__state()')
                    p.evaluate("document.querySelector('#revealall').click();document.querySelector('#revealall').click()")
                    p.clock.run_for(6000)
                    after=p.evaluate('__state()');early=p.evaluate('__early')
                    row=dict(portable=portable,phase=phase,repeat=repeat,before=before,after=after,early=early,errors=list(errors),failedRequests=list(failed))
                    rows.append(row)
                    (out/evidence).write_text(json.dumps(rows,indent=2),encoding='utf-8')
                    assert not after['hidden'] and after['faces']==10 and not after['anims'], row
                    assert after['ids']==[c['id'] for c in fixture] and not early and not errors and not failed, row
                    assert after['completed']==10 and after['tickets']==20, row
                    assert 0<=after['finishAt']-after['lastAnimationEnd']<=100, row
                    p.evaluate("document.querySelector('#finish').click();document.querySelector('#finish').click()")
                    p.clock.run_for(221)
                    clean=p.evaluate('__state()');row['collected']=clean
                    assert clean['slots']==0 and clean['faces']==0 and clean['detached']==0 and clean['sparks']==0, row
                print('fixed timing',portable,phase,repeats,'passed',flush=True)
                # Cancel while callbacks/animations are live, then immediately draw again.
                p.evaluate("__testReset();document.querySelector('#p10').click()")
                p.evaluate('async()=>await __prepared()')
                p.clock.run_for(1790+offsets[phase])
                p.evaluate("document.querySelector('#revealall').click();__testReset();document.querySelector('#p1').click()")
                p.evaluate('async()=>await __prepared()')
                p.clock.run_for(9000)
                clean=p.evaluate('__state()')
                assert clean['slots']==1 and clean['faces']==1 and clean['completed']==1 and clean['tickets']==29 and clean['detached']==0 and not clean['hidden'] and not clean['anims'] and not clean['sparks'], clean
                assert clean['ids']==[fixture[0]['id']] and not errors and not failed, (clean,errors,failed)
                rows[-1]['resetThenDraw']=clean
            # Reset during the initial charge, before slots exist.
            p.evaluate("__testReset();document.querySelector('#p10').click()")
            p.evaluate('async()=>await __prepared()')
            p.clock.run_for(100)
            p.evaluate("__testReset();document.querySelector('#p1').click()")
            p.evaluate('async()=>await __prepared()')
            p.clock.run_for(9000)
            clean=p.evaluate('__state()')
            assert clean['slots']==1 and clean['faces']==1 and clean['detached']==0 and not clean['hidden'],clean
            rows[-1]['chargeReset']=clean
            p.close()
    (out/evidence).write_text(json.dumps(rows,indent=2),encoding='utf-8')
    return rows
