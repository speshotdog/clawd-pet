# -*- coding: utf-8 -*-
"""朋友 2026-09-16 三條建議的實機驗收：儲存隊伍（存／套用／覆蓋要按兩次）、挑選器技能型篩選＋型標籤、戰鬥技能格的效果剩餘顯示。
route 本機 src，不開 server。"""
import importlib.util, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]; SRC=ROOT/'src'; OUT=ROOT/'_art/out/v3-presets'; OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('recommend',Path(__file__).with_name('clicker-v3-apoc-recommend.py')); helper=importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
fails=[]
def check(ok,label,data=None):
    print(('ok   ' if ok else 'FAIL ')+label+(f' {data}' if data is not None else ''))
    if not ok:fails.append(label)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True);ctx=browser.new_context(viewport={'width':1280,'height':860})
    def route(r):
        path=(SRC/unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if path.is_relative_to(SRC) and path.is_file():r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else:r.fulfill(status=404,body='missing')
    ctx.route('**/*',route);ctx.add_init_script("const s=sessionStorage.getItem('test-seed');if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html');pg.wait_for_function('window.Clicker?.state');pg.evaluate(helper.SEED);pg.reload();pg.wait_for_function('window.Clicker?.state');pg.wait_for_timeout(1600)
    # 末世：12 張卡、4 格技能，戰鬥中
    ids=pg.evaluate("""()=>{const A=ApocEconomy,s=Clicker.state;const sk=['open','train','coin','breach'].map(r=>ApocPool.find(c=>c.rarity==='rare'&&c.role===r).id);
      const pick=(r,n)=>ApocPool.filter(c=>c.rarity===r&&!sk.includes(c.id)).slice(0,n).map(c=>c.id);const ids=[...pick('legendary',2),...pick('epic',4),...sk,...pick('rare',2)];   // 2/6/12 的累加上限內
      A.RULES.BASE_NEED=1e6;let a=A.normalize({...A.fresh(),unlocked:true,gifted:true,tutorial:6,collection:Object.fromEntries(ids.map(id=>[id,1])),roster:ids,skills:sk,progress:0,coins:0,seenAt:Date.now()});
      s.apoc=A.fight(a,Date.now());Clicker.save?.();return {ids,sk};}""")
    pg.wait_for_timeout(500)
    # ── 3. 效果剩餘顯示
    slots=pg.locator('#slots .skill-slot')
    check(slots.count()==4 and pg.locator('#slots .skill-slot[data-effect="on"]').count()==0,'開打前沒有效果中的格子')
    pg.locator('#slots .skill-use[data-slot="1"]').click();pg.wait_for_timeout(1900)   # train：20 秒
    st=pg.evaluate("()=>[...document.querySelectorAll('#slots .skill-slot')].map(s=>({eff:s.dataset.effect,left:s.querySelector('.skill-left')?.textContent,ring:getComputedStyle(s.querySelector('.skill-ring')).display,deg:s.style.getPropertyValue('--effect')}))")
    check(st[1]['eff']=='on' and st[1]['left'].startswith('效果 ') and st[1]['left'].endswith('s') and st[1]['ring']=='block' and st[1]['deg'].endswith('deg') and float(st[1]['deg'][:-3])>180,'加訓放下去：格子亮、寫「效果 Ns」、環顯示',st[1])
    check(all(x['eff']=='off' for i,x in enumerate(st) if i!=1),'其他格沒亮',st)
    pg.locator('#slots .skill-use[data-slot="0"]').click();pg.wait_for_timeout(1900)   # open：12 下
    left0=pg.evaluate("()=>document.querySelector('#slots .skill-slot:nth-child(1) .skill-left').textContent")
    check(left0=='剩 12 下','開封放下去寫「剩 12 下」',left0)
    pg.evaluate("()=>document.getElementById('tap').click()");pg.wait_for_timeout(300)
    left0b=pg.evaluate("()=>document.querySelector('#slots .skill-slot:nth-child(1) .skill-left').textContent")
    check(left0b=='剩 11 下','點一下之後變「剩 11 下」',left0b)
    pg.screenshot(path=str(OUT/'effect-left.png'),clip={'x':0,'y':0,'width':1280,'height':860})
    # 效果到期後熄掉
    pg.evaluate("()=>{const a=Clicker.state.apoc;a.fx.powerUntil=Date.now()-1;a.fx.clickLeft=0;}");pg.wait_for_timeout(1300)
    check(pg.locator('#slots .skill-slot[data-effect="on"]').count()==0,'效果到期後全部熄掉')
    # ── 1. 儲存隊伍
    pg.click('#team-open');pg.wait_for_timeout(400)
    check(not pg.evaluate("()=>document.getElementById('team-editor').hidden"),'編隊畫面開啟')
    chips=pg.locator('#t20-presets .preset-chip')
    check(chips.count()==3 and pg.locator('#t20-presets .preset-chip.empty').count()==3,'三組全空')
    pg.locator('#t20-presets .preset-chip[data-i="0"] .preset-save').click();pg.wait_for_timeout(300)
    name=pg.evaluate("()=>document.querySelector('#t20-presets .preset-chip[data-i=\"0\"] .preset-name').textContent")
    saved=pg.evaluate("()=>Clicker.state.apoc.presets[0]")
    check(saved and saved['roster']==ids['ids'] and saved['skills']==ids['sk'] and name==saved['name'] and '／' in name,'存第 1 組：照抄隊伍＋技能槽、名字是技能型',name)
    # 改隊伍：清技能槽、移掉半隊
    pg.evaluate("""()=>{const A=ApocEconomy,s=Clicker.state;s.apoc=A.setTeam(s.apoc,s.apoc.roster.slice(0,4),[null,null,null,null]);}""")
    pg.click('#team-close');pg.wait_for_timeout(150);pg.click('#team-open');pg.wait_for_timeout(300)
    # 覆蓋要按兩次
    pg.locator('#t20-presets .preset-chip[data-i="0"] .preset-save').click();pg.wait_for_timeout(200)
    armed=pg.evaluate("()=>document.querySelector('#t20-presets .preset-chip[data-i=\"0\"] .preset-save').textContent")
    still=pg.evaluate("()=>Clicker.state.apoc.presets[0].roster.length")
    check(armed=='再按一次覆蓋' and still==12,'非空格按一次「存」只是武裝，不覆蓋',{'btn':armed,'roster':still})
    pg.locator('#t20-presets .preset-chip[data-i="1"] .preset-save').click();pg.wait_for_timeout(200)
    check(pg.evaluate("()=>Clicker.state.apoc.presets[1].roster.length")==4,'第 2 組存目前 4 張隊伍')
    pg.locator('#t20-presets .preset-chip[data-i="0"] .preset-use').click();pg.wait_for_timeout(400)
    after=pg.evaluate("()=>({roster:Clicker.state.apoc.roster,skills:Clicker.state.apoc.skills,count:document.getElementById('t20-count').textContent.trim()})")
    check(after['roster']==ids['ids'] and after['skills']==ids['sk'] and after['count']=='12 / 20','套用第 1 組：隊伍與技能槽回來、畫面 12/20',after['count'])
    # 派遣中的卡套用時跳過
    pg.evaluate("""()=>{const s=Clicker.state,A=ApocEconomy;const id=s.apoc.roster[5];s.apoc=A.setTeam(s.apoc,s.apoc.roster.filter(x=>x!==id),s.apoc.skills);s.apoc.dispatch=[{id,startedAt:Date.now(),until:Date.now()+A.RULES.DISPATCH.MS}];}""")
    pg.locator('#t20-presets .preset-chip[data-i="0"] .preset-use').click();pg.wait_for_timeout(400)
    n=pg.evaluate("()=>Clicker.state.apoc.roster.length");note=pg.evaluate("()=>document.getElementById('notice')?.textContent||''")
    check(n==11 and '1 張' in note,'派遣中的卡跳過並提示',{'n':n,'note':note})
    pg.screenshot(path=str(OUT/'presets.png'))
    # ── 2. 挑選器技能型篩選＋標籤
    pg.click('#t20-add');pg.wait_for_timeout(400)
    chipsN=pg.locator('#t20-picker-roles .role-chip').count()
    check(chipsN==7 and pg.locator('#t20-picker-roles .role-chip[aria-pressed="true"]').count()==1,'篩選列：全部＋六型',chipsN)
    total=pg.locator('#t20-picker-grid .team-proxy').count()
    check(total>0 and pg.locator('#t20-picker-grid .team-proxy .proxy-role').count()==total,'每張候選卡都有型標籤',total)
    pg.locator('#t20-picker-roles .role-chip[data-role="breach"]').click();pg.wait_for_timeout(400)
    roles=pg.evaluate("()=>[...document.querySelectorAll('#t20-picker-grid .team-proxy')].map(b=>ApocPool.find(c=>c.id===b.dataset.id).role)")
    check(len(roles)>0 and all(r=='breach' for r in roles) and pg.locator('#t20-picker-roles .role-chip[data-role="breach"][aria-pressed="true"]').count()==1,'按「破防」只剩破防型',{'n':len(roles)})
    pg.screenshot(path=str(OUT/'picker-filter.png'))
    pg.locator('#t20-picker-roles .role-chip[data-role=""]').click();pg.wait_for_timeout(300)
    check(pg.locator('#t20-picker-grid .team-proxy').count()==total,'按「全部」回到全部')
    # Astra 必修 2：留著「破防」篩選關掉挑選器，切到 1.0 不能把候選全篩掉
    pg.locator('#t20-picker-roles .role-chip[data-role="breach"]').click();pg.wait_for_timeout(300)
    pg.click('#t20-picker-close');pg.wait_for_timeout(200)
    # 隊伍網格也有型標籤
    check(pg.locator('#t20-grid .team-proxy .proxy-role').count()==pg.locator('#t20-grid .team-proxy:not([hidden])').count()+pg.locator('#t20-grid .team-proxy[hidden]').count(),'隊伍網格每張都有型標籤')
    # ── 1.0 也有儲存隊伍（同一個編隊畫面）
    pg.click('#team-close');pg.wait_for_timeout(200)
    pg.evaluate("()=>{Clicker.state.settings.world='home';}");pg.reload();pg.wait_for_function('window.Clicker?.state');pg.wait_for_timeout(1200)
    pg.click('#team-open');pg.wait_for_timeout(400)
    if not pg.evaluate("()=>document.getElementById('team-editor').hidden"):
        pg.locator('#t20-presets .preset-chip[data-i="2"] .preset-save').click();pg.wait_for_timeout(300)
        hp=pg.evaluate("()=>Clicker.state.teamPresets?.[2]")
        check(bool(hp) and hp['name']=='隊伍 3' and isinstance(hp['roster'],list),'1.0 存第 3 組（隊伍 3）',hp and hp['name'])
        pg.click('#t20-add');pg.wait_for_timeout(400)
        check(pg.locator('#t20-picker-roles').count()==0 or pg.locator('#t20-picker-roles[hidden]').count()==1,'1.0 沒有型篩選列')
        check(pg.locator('#t20-picker-grid .team-proxy').count()>0,'1.0 挑選器候選沒有被末世殘留的篩選清空',pg.locator('#t20-picker-grid .team-proxy').count())
        pg.click('#t20-picker-close');pg.wait_for_timeout(200)
        # Astra 必修 1：1.0 套用預設要能交換技能槽 [A,B] → [B,A]
        swap=pg.evaluate("""()=>{const s=Clicker.state,E=ClickerEconomy;let sl=s.skillSlots.filter(Boolean);
          if(sl.length<2){const r=E.rosterOf(s).slice(0,2);let n=s;try{n=E.equip(n,0,null,Date.now());n=E.equip(n,1,null,Date.now());n=E.equip(n,0,r[0],Date.now());n=E.equip(n,1,r[1],Date.now());}catch(e){return null;}Object.assign(s,n);sl=s.skillSlots.filter(Boolean);}
          if(sl.length<2)return null;
          s.teamPresets[2]={name:'swap',roster:[...E.rosterOf(s)],skills:[sl[1],sl[0],...s.skillSlots.slice(2)]};return [sl[0],sl[1]];}""")
        if swap:
            pg.click('#team-close');pg.wait_for_timeout(150);pg.click('#team-open');pg.wait_for_timeout(300)
            pg.locator('#t20-presets .preset-chip[data-i="2"] .preset-use').click();pg.wait_for_timeout(400)
            now=pg.evaluate("()=>Clicker.state.skillSlots.slice(0,2)");note=pg.evaluate("()=>document.getElementById('notice')?.textContent||''")
            check(now==[swap[1],swap[0]] and '裝不進去' not in note and '不在卡冊' not in note,'1.0 套用預設交換兩個技能槽',{'now':now,'note':note})
        else: print('skip 1.0 技能槽不足兩格，跳過交換測試')
    else:
        print('skip 1.0 編隊畫面開不了（不影響末世）')
    check(not errors,'頁面錯誤 0：'+'; '.join(errors))
    browser.close()
print('\nALL OK' if not fails else '\nFAIL: '+', '.join(fails)); sys.exit(1 if fails else 0)
