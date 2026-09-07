# -*- coding: utf-8 -*-
"""第十九輪驗收：直接 route src，不啟動 server。"""
import json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src'
OUT = ROOT / '_art/out'
OUT.mkdir(exist_ok=True)
SEED = (ROOT / '_art/audit.py').read_text(encoding='utf-8').split("SEED = '''")[1].split("'''")[0]
fails = []

def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

def open_page(p, width, height, dpr=1, css=None):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr)
    ctx.add_init_script("const seed=sessionStorage.getItem('test-seed');if(seed){localStorage.setItem('clicker_save',seed);sessionStorage.removeItem('test-seed');}")
    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if css is not None and path == SRC / 'clicker.css': r.fulfill(body=css, content_type='text/css')
        elif path.is_relative_to(SRC) and path.is_file(): r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        else: r.fulfill(status=404, body='missing')
    ctx.route('**/*', route)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://clicker.test/clicker.html')
    pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(SEED)
    pg.reload()
    pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(900)
    return b, pg, errs

def corners(pg, tag, dpr):
    full = OUT / f'r19-full-{tag}.png'
    pg.screenshot(path=str(full))
    with Image.open(full) as im:
        sheet = Image.new('RGB', (4*96, 3*96), '#ffffff')
        for row, selector in enumerate(['#draw-five', '#click-one', '.upgrade']):
            box = pg.locator(selector).first.bounding_box()
            for col, (right, bottom) in enumerate([(False, False), (True, False), (False, True), (True, True)]):
                x = (box['x'] + (box['width'] if right else 0))*dpr
                y = (box['y'] + (box['height'] if bottom else 0))*dpr
                left, top = round(x)-(26 if right else 6), round(y)-(26 if bottom else 6)
                crop = im.crop((left, top, left+32, top+32)).resize((96, 96), Image.Resampling.NEAREST)
                sheet.paste(crop, (col*96, row*96))
        sheet.save(OUT / f'r19-corner-{tag}.png')

def geometry(pg):
    return pg.evaluate("""() => Object.fromEntries(['#draw-five','#click-one','.upgrade','#roster header','#train-all','#recruit-topbar','#recruit-five','#prestige header','#prestige-go'].flatMap(sel=>{
      const el=document.querySelector(sel); if(!el || !el.getClientRects().length) return [];
      const r=el.getBoundingClientRect(); const range=document.createRange(); range.selectNodeContents(el); const text=range.getBoundingClientRect();
      return [[sel,{x:r.x,y:r.y,width:r.width,height:r.height,textX:text.x,textY:text.y}]];
    }))""")

def panels(pg, tag):
    result = {'main': geometry(pg)}
    pg.screenshot(path=str(OUT / f'{tag}-main.png'))
    for name, selector in [('album','#roster-open'),('recruit','#recruit-open'),('prestige','#prestige-open')]:
        pg.locator(selector).click()
        pg.mouse.move(0,0)
        pg.wait_for_timeout(1200)
        pg.wait_for_function("Array.from(document.querySelectorAll('#roster img')).filter(el=>el.getClientRects().length).every(el=>el.complete)")
        pg.screenshot(path=str(OUT / f'{tag}-{name}.png'))
        result[name] = geometry(pg)
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(200)
    return result

def intersects(a, b):
    return a['left'] < b['right'] and a['right'] > b['left'] and a['top'] < b['bottom'] and a['bottom'] > b['top']

def main():
    with sync_playwright() as p:
        b, pg, errs = open_page(p, 1280, 860)
        result = pg.evaluate("""() => {
          const E=ClickerEconomy, S=ClickerSave; let s=S.fresh(0);
          s.collection={yueyue2:1,caihua:1,lk:1}; s.partnerLevels={yueyue2:0,caihua:0,lk:0};
          const price=E.drawCost(s,5), base=E.rates(s); s.partnerLevels.lk=150;
          const isolated=E.drawCost(s,5), actual=E.rates(s), uniform=E.rates(s,{partnerLevel:0});
          s.partnerLevels={yueyue2:20,caihua:20,lk:150}; const trained=E.drawCost(s,5);
          s.pending={draw:{id:'r19',entries:['dog','fox','lk','yang','zhenmu'].map(id=>({entry:GachaPool.byId[id]}))}};
          const r=E.collect(s,'r19',0); S.validate(r.state,GachaPool);
          const empty=S.fresh(0); empty.pending={draw:{id:'first',entries:[{entry:GachaPool.byId.dog}]}};
          const first=E.collect(empty,'first',0).state;
          first.partnerLevels.dog=50; first.pending={draw:{id:'second',entries:[{entry:GachaPool.byId.fox}]}};
          return {price,isolated,trained,base,actual,uniform,levels:r.state.partnerLevels,newIds:r.newIds,coins:r.state.coins,first:E.medianPartnerLevel(empty),second:E.collect(first,'second',0).state.partnerLevels.fox};
        }""")
        check(result['price'] == result['isolated'] < result['trained'], '招募價不受單一主力影響，全隊升級仍漲價')
        check(result['base'] == result['uniform'] and result['actual']['P'] > result['base']['P'], 'rates 預設使用個別等級，override 支援零級')
        check(all(result['levels'][id] == 20 for id in result['newIds']) and result['levels']['lk'] == 150 and result['coins'] == 0, '新卡逐張追上中位數，重複卡不改級、不扣款、存檔可讀')
        check(result['first'] == 0 and result['second'] == 50, '空隊零級、單人隊伍繼承等級')
        check(not errs, f'經濟驗收無 JS 錯誤 {errs[:3]}')
        disabled = pg.evaluate("""() => {
          const el=document.getElementById('click-one'); el.style.transition='none'; el.disabled=true;
          return getComputedStyle(el).backgroundColor;
        }""")
        check(disabled == 'rgb(217, 204, 187)', '彩色升級鍵停用時使用取樣停用色')
        b.close()
        measurements = {}
        for w,h,dpr in [(2560,1215,1),(1920,1080,1),(1280,860,1),(1366,768,1),(1280,860,1.25),(1280,860,1.5)]:
            tag = f'{w}-dpr{dpr:g}'
            b, pg, errs = open_page(p,w,h,dpr)
            corners(pg,tag,dpr)
            styles = pg.evaluate("""() => ['#draw-five','#click-one','.upgrade','.recruit','#team'].map(sel=>{const c=getComputedStyle(document.querySelector(sel));return [sel,c.borderImageSource,c.borderTopWidth,c.outlineStyle,c.boxShadow,c.backgroundColor];})""")
            check(all(s[1] == 'none' and s[2] == '3px' and s[3] == 'dashed' and s[4] != 'none' for s in styles), f'{tag} 按鈕與紙框使用完整 CSS 邊框／虛線／陰影')
            measurements[tag] = panels(pg, f'r19-{tag}')
            # Match the UI's removal of the original-version suffix when finding the longest names.
            names = pg.evaluate("""() => {
              const s=ClickerSave.fresh(Date.now()), name=id=>GachaPool.byId[id].name.replace('（原版）',''), ids=Object.keys(ClickerBalance.characters).sort((a,b)=>name(b).length-name(a).length).slice(0,3);
              s.collection={yueyue2:1,...Object.fromEntries(ids.map(id=>[id,1]))}; s.lifetimeCoins=s.coins=1e6; s.manualClicks=100;
              s.claimedMilestones=['tutorial50']; s.skillSlots=ids; ClickerSave.validate(s,GachaPool);
              sessionStorage.setItem('test-seed',JSON.stringify(s)); return ids.map(name);
            }""")
            pg.reload()
            pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(900)
            rects = pg.locator('.skill-slot').evaluate_all("""els=>els.map(el=>{
              const label=el.querySelector('.skill-name'), art=el.querySelector('.skill-use .character-png, .skill-use svg');
              return {name:label.getBoundingClientRect().toJSON(),art:art?.getBoundingClientRect().toJSON(),fits:label.scrollWidth<=label.clientWidth};
            })""")
            check(len(rects)==3 and all(r['art'] and not intersects(r['name'],r['art']) for r in rects), f'{tag} 最長三名不遮角色 {names}')
            check(all(not intersects(rects[i]['name'],rects[j]['name']) for i in range(len(rects)) for j in range(i)), f'{tag} 名字彼此不相交')
            check(all(r['fits'] for r in rects), f'{tag} 11px 最長名字完整顯示')
            pg.screenshot(path=str(OUT / f'r19-slots-{tag}.png'))
            if w==1280 and dpr==1: pg.screenshot(path=str(OUT / 'r19-slots.png'))
            if w==1280 and dpr==1:
                pg.evaluate("""() => {const s=ClickerEconomy.clone(Clicker.state); s.collection.zhenmoss=1; s.collection.yueyuexian=1; s.skillSlots=['zhenmoss','yueyuexian','zhenjpg']; ClickerSave.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s));}""")
                pg.reload()
                pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
                pg.evaluate('document.fonts.ready')
                pg.wait_for_timeout(900)
                reported = pg.locator('.skill-slot').evaluate_all("""els=>els.map(el=>({name:el.querySelector('.skill-name').getBoundingClientRect().toJSON(),art:el.querySelector('.skill-use .character-png, .skill-use svg').getBoundingClientRect().toJSON()}))""")
                check(all(not intersects(r['name'],r['art']) for r in reported) and all(not intersects(reported[i]['name'],reported[j]['name']) for i in range(3) for j in range(i)), '回報角色「苔蘚珍珍／玥來玥閒」亦不遮圖、不互撞')
                pg.screenshot(path=str(OUT / 'r19-slots-reported.png'))
            check(not errs, f'{tag} 無 JS 錯誤 {errs[:3]}')
            b.close()
        (OUT / 'r19-geometry.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2),encoding='utf-8')
    print('\nFAIL:', fails)
    print('RESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAIL')
    return 1 if fails else 0

if __name__ == '__main__': sys.exit(main())
