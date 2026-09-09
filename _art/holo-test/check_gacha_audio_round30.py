"""Compare actual native WebAudio source schedules against unmodified original code."""
from pathlib import Path
import json,shutil
from playwright.sync_api import sync_playwright
from check_gacha_ceremony_round30 import HERE,OUT,BY,save

PROBE=r'''(()=>{
 const params=new WeakMap();window.__audioSources=[];
 for(const method of ['setValueAtTime','exponentialRampToValueAtTime']){
  const original=AudioParam.prototype[method];AudioParam.prototype[method]=function(value,time){
   const list=params.get(this)||[];list.push({method,value,time});params.set(this,list);return original.call(this,value,time);
  };
 }
 for(const [klass,kind] of [[OscillatorNode,'tone'],[AudioBufferSourceNode,'noiseHit']]){
  const original=klass.prototype.start;klass.prototype.start=function(at){
   __audioSources.push({kind,at,type:this.type||null,frequency:this.frequency?(params.get(this.frequency)||[]):[]});
   return original.call(this,at);
  };
 }
})()'''

def normalized(rows):
    first=min(r['at'] for r in rows)
    return [dict(kind=r['kind'],type=r['type'],at=round(r['at']-first,5),frequency=[dict(method=f['method'],value=round(f['value'],5),at=round(f['time']-first,5)) for f in r['frequency']]) for r in rows]

with sync_playwright() as pw:
    b=pw.chromium.launch();expected={}
    for rarity in BY:
        p=b.new_page();p.set_content('<button id="go">Play</button>');p.add_script_tag(content=PROBE)
        p.add_script_tag(content=(HERE.parent.parent/'src/gacha-audio.js').read_text(encoding='utf-8'))
        p.evaluate('r=>{document.querySelector("#go").onclick=async()=>{await GachaAudio.ensure().resume();GachaAudio.createScope().reveal(r)}}',rarity)
        p.click('#go');p.wait_for_function('__audioSources.length>0')
        expected[rarity]=normalized(p.evaluate('__audioSources'));p.close()
    save('original-audio-schedules.json',expected)
    portable=OUT/'portable'/'index.html';portable.parent.mkdir(exist_ok=True);shutil.copyfile(HERE/'deluxe-gacha-b-standalone.html',portable)
    results=[]
    for label,file in [('dev',HERE/'deluxe-gacha-b.html'),('portable',portable)]:
        for rarity,card in BY.items():
            p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.add_init_script(PROBE)
            p.goto(file.as_uri()+'?ceremony-test');p.click('#sound')
            p.evaluate('f=>{__ceremonyFixture=[f];__ceremony.pull(1)}',card)
            p.wait_for_function('__ceremony.events.some(e=>e.type==="face-visible")',timeout=15000)
            data=p.evaluate('({sources:__audioSources,cues:__ceremony.events.filter(e=>e.type==="audio"),scheduled:__ceremony.events.filter(e=>e.type==="audio-scheduled")})')
            schedules=[e for e in data['scheduled'] if e['cue']=='reveal:'+rarity]
            assert len(schedules)==len(expected[rarity]),(rarity,len(schedules),len(expected[rarity]))
            actual=data['sources'][-len(schedules):]
            assert normalized(actual)==expected[rarity],(label,rarity,normalized(actual),expected[rarity])
            assert [c['kind'] for c in data['cues']]==['tear','burst','deal','flip','reveal']
            assert all(c['state']=='running' and not c['muted'] for c in data['cues'])
            p.wait_for_function('__ceremony.state().collectable',timeout=15000);p.click('#finish')
            p.wait_for_timeout(240)
            assert p.evaluate('__ceremony.events.some(e=>e.type==="audio-scheduled"&&e.cue==="collect")')
            # Collection sound has its own lifetime, survives the 220ms screen exit.
            assert p.evaluate('__ceremony.state().screen')=='entry'
            p.click('#sound');p.evaluate('__audioSources.length=0;__ceremony.events.length=0')
            p.evaluate('f=>{__ceremonyFixture=[f];__ceremony.pull(1)}',card)
            p.wait_for_function('__ceremony.events.some(e=>e.type==="face-visible")',timeout=15000)
            assert p.evaluate('__audioSources.length')==0
            assert p.evaluate('__ceremony.events.filter(e=>e.type==="audio-scheduled").length')==0
            assert not errors,errors;p.close();results.append({'entry':label,'rarity':rarity,'cue':'reveal:'+rarity,'sources':len(schedules),'native_schedule_equal':True,'muted_sources':0});print(results[-1],flush=True)
    b.close();save('audio-results.json',results)
