# -*- coding: utf-8 -*-
"""2.0 推薦組合：卡冊有鍵、開得起來、模板照技能型別挑隊伍裡戰力最高的卡、套用會寫進技能槽、缺型會標缺。
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-v3-apoc-recommend.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out/v3-apoc-recommend'
OUT.mkdir(parents=True, exist_ok=True)
fails = []
def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)

SEED = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,4])); s.dust={...s.collection};
  s.coins=1e12; s.lifetimeCoins=1e13; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.marksClaimed=50; s.marks=0; s.prestiges=10; s.markShop={slot4:true}; s.skillSlots=[null,null,null,null]; s.slotReadyAt=[0,0,0,0];
  s.package=E.newPackage('city',120); s.apoc={unlocked:true,tutorial:6}; s.settings.world='apoc';
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 1280, 'height': 860})
        def route(r):
            path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
            if not path.is_relative_to(SRC) or not path.is_file(): r.fulfill(status=404, body='missing'); return
            r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        ctx.route('**/*', route)
        ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
        pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
        pg.evaluate(SEED); pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1500)
        # 隊伍：2 神話 3 傳說 5 史詩 5 精良（有的階都有），技能槽空
        pg.evaluate("""()=>{const A=ApocEconomy,s=Clicker.state; const a=A.normalize(s.apoc); const by=r=>ApocPool.filter(c=>c.role===r).map(c=>c.id);
          const ids=['rocketdog','liulangyueshou','bingyang','mianhua','wanwu','gebugou','qipupu','foxmoney','yangpu','alienkitty','chaichai','seal','miepuxiong','dino'];
          a.collection=Object.fromEntries(ids.map(i=>[i,1])); a.roster=ids; a.skills=[null,null,null,null]; s.apoc=a;}""")
        pg.wait_for_timeout(300)
        pg.evaluate("()=>document.getElementById('roster-open').click()"); pg.wait_for_timeout(700)
        check(not pg.evaluate("()=>document.getElementById('recommend-open').hidden"), '末世卡冊有「推薦組合」鍵')
        pg.evaluate("()=>document.getElementById('recommend-open').click()"); pg.wait_for_timeout(900)
        n = pg.evaluate("()=>document.querySelectorAll('#recommend-page .recommend-card').length")
        check(n == 6, f'六組模板：{n}')
        names = pg.evaluate("()=>[...document.querySelectorAll('#recommend-page .recommend-card')].map(c=>[c.querySelector('b').textContent,[...c.querySelectorAll('.recommend-slot')].map(s=>s.dataset.rarity+':'+s.querySelector('.name').textContent+(s.classList.contains('missing')?'(缺)':'')),c.querySelector('.status').textContent])")
        for x in names: print('   ', x)
        first = names[0]
        check('缺' not in first[2] and all('(缺)' not in s for s in first[1]), f'王關爆發：四型都在隊伍裡，全部到齊：{first[2]}')
        check(names[5][2].startswith('缺'), f'全開封：隊伍只有 2 張開封，標缺：{names[5][2]}')
        faces = pg.evaluate("()=>[...document.querySelectorAll('#recommend-page .recommend-slot:not(.missing) .holo-face')].length")
        check(faces >= 12, f'選中的卡用精裝卡面顯示：{faces} 張')
        pg.screenshot(path=str(OUT / 'page.png'))
        # 套用王關爆發 → 技能槽 = 史詩／神話／傳說／精良、各自是該型戰力最高
        pg.locator('#recommend-page .recommend-card').nth(0).locator('.recommend-apply').click(); pg.wait_for_timeout(800)
        got = pg.evaluate("""()=>{const A=ApocEconomy,a=A.normalize(Clicker.state.apoc); const rar=id=>{const c=ApocPool.find(c=>c.id===id);return c.role};
          return {rar:a.skills.map(id=>id&&rar(id)), best:a.skills.map(id=>{if(!id)return null;const r=rar(id);const top=a.roster.filter(x=>rar(x)===r).sort((x,y)=>A.cardPower(a,y)-A.cardPower(a,x));return top.indexOf(id)<=1;})};}""")
        check(got['rar'] == ['train', 'breach', 'open', 'reset'], f'套用後四格技能型別照模板：{got["rar"]}')
        check(all(got['best']), f'每格是該型戰力最高（或次高，同型同戰力）：{got["best"]}')
        check(not pg.evaluate("()=>document.getElementById('recommend-page').hidden"), '套用後頁面留著（重畫）')
        # 隊伍沒有精良、卡冊有 → 順手入隊
        pg.evaluate("""()=>{const A=ApocEconomy,s=Clicker.state; const a=A.normalize(s.apoc); const rare=a.roster.filter(id=>{const c=ApocPool.find(c=>c.id===id);return c.role==='reset'});
          a.roster=a.roster.filter(id=>!rare.includes(id)); a.skills=[null,null,null,null]; s.apoc=a;}""")
        pg.evaluate("()=>{document.getElementById('recommend-open').click();document.getElementById('recommend-open').click();}"); pg.wait_for_timeout(800)
        pg.locator('#recommend-page .recommend-card').nth(0).locator('.recommend-apply').click(); pg.wait_for_timeout(800)
        joined = pg.evaluate("()=>{const a=ApocEconomy.normalize(Clicker.state.apoc); const id=a.skills[3]; return id && a.roster.includes(id);}")
        check(bool(joined), '隊伍裡沒重整卡：從卡冊挑一張入隊並裝到第四格')
        check(not errors, f'沒有 pageerror：{errors}')
        b.close()
    print('\n' + ('全部通過' if not fails else f'失敗 {len(fails)} 項')); sys.exit(1 if fails else 0)

if __name__ == '__main__': main()
