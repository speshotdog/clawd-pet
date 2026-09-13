# -*- coding: utf-8 -*-
"""UI 體檢：每一個看得到的東西都要「放得下、看得見、點得到」。

使用者 2026-09-13：「檢查過每一個 UI 不會被遮擋、字體被裁切、都是有必要的存在」。
所以這支不是截圖比對（那只會告訴你「不一樣」），而是四條會壞掉的具體條件：

  1. **字被裁掉**：元素的 scrollWidth／scrollHeight 大於自己的 clientWidth／clientHeight，
     而且沒有開捲動（overflow 不是 auto／scroll）也沒有寫 text-overflow:ellipsis。
  2. **跑出容器**：可見元素的矩形超出 #game 的範圍（左右各留 1px 容差）。
  3. **被蓋住**：可以點的東西（button／select）中心點做 elementFromPoint，
     命中的不是自己也不是自己的子孫 → 有人蓋在上面。
  4. **疊在一起**：同一層的按鈕互相重疊超過一半面積。

每一個畫面（1.0 與末世的主畫面、卡冊、編隊、商店、招募、結算⋯⋯）都掃一遍，
兩種解析度（桌機 1280×860、手機 390×844）。

用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-ui-audit.py [--json 檔案]
"""
import argparse, json, mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]; SRC = ROOT / 'src'
OUT = ROOT / '_art' / 'out' / 'ui-audit'; OUT.mkdir(parents=True, exist_ok=True)

SEED_HOME = """() => { const S=ClickerSave,E=ClickerEconomy,B=ClickerBalance; const s=S.fresh(Date.now());
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,8])); s.dust={...s.collection};
  s.coins=1e14; s.lifetimeCoins=1e15; s.manualClicks=50; s.claimedMilestones=['tutorial50'];
  s.trainingLevel=30; s.clickLevel=80; s.marks=40; s.marksClaimed=60; s.universalDust=88;
  s.bossWins=['backyard','kitchen','market','factory','nightmarket','fridge','city']; s.settings.scene='city';
  s.package=E.newPackage('city',120); s.roster=ids.slice(0,20); s.skillSlots=[ids[0],ids[1],ids[2]];
  s.apoc={unlocked:true,tutorial:6};
  S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }"""

# 頁面內的體檢器。回傳一串問題，每一條都寫清楚是哪一個元素、壞在哪裡。
AUDIT_JS = r"""(label)=>{
  const problems=[];
  const game=document.getElementById('game'); const gb=game.getBoundingClientRect();
  // 有面板打開的時候，後面的東西「被蓋住」是對的，不是問題——只檢查目前真的在操作的那一層。
  const open=[...document.querySelectorAll('.panel,.small-panel,#recruit-layer,#draw-summary,#album-detail,#dust-shop,dialog[open]')]
    .filter(e=>!e.hidden && getComputedStyle(e).display!=='none');
  const scope=open.length? open[open.length-1] : document.getElementById('game-content');
  // 這些是刻意做成透明的大片點擊區（點珍母／點怪／子包／禮包），本來就會跟別的東西重疊
  const HIT=new Set(['tap','gift-hot','daily-bag']);
  const isHit=e=>HIT.has(e.id)||e.classList.contains('sub-hot');
  const vis=e=>{const r=e.getBoundingClientRect(); if(r.width<1||r.height<1)return false;
    let p=e; while(p&&p!==document.documentElement){const c=getComputedStyle(p);
      if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0||p.hidden)return false; p=p.parentElement;}
    return true;};
  const desc=e=>{const t=(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,24);
    const own=`${e.tagName.toLowerCase()}${e.id?'#'+e.id:''}${e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/)[0]:''}`;
    const p=e.parentElement, par=p?`${p.tagName.toLowerCase()}${p.id?'#'+p.id:''}${p.className&&typeof p.className==='string'?'.'+p.className.trim().split(/\s+/)[0]:''}`:'';
    const src=e.tagName==='IMG'?`(${(e.getAttribute('src')||'').split('/').pop()})`:'';
    return `${par?par+' > ':''}${own}${src}${t?`「${t}」`:''}`;};
  const all=[...scope.querySelectorAll('*')].filter(vis).filter(e=>!e.closest('[inert]'));

  // 1 字被裁：沒有捲動也沒有省略號，內容卻比框大
  for(const e of all){
    if(!(e.textContent||'').trim()) continue;
    if(e.children.length && ![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) continue;
    const c=getComputedStyle(e);
    if(/auto|scroll/.test(c.overflowX+c.overflowY)) continue;
    if(c.textOverflow==='ellipsis') continue;
    const dx=e.scrollWidth-e.clientWidth, dy=e.scrollHeight-e.clientHeight;
    if(dx>1||dy>1) problems.push({kind:'字被裁', el:desc(e), detail:`內容 ${e.scrollWidth}×${e.scrollHeight}，框 ${e.clientWidth}×${e.clientHeight}`});
  }
  // 2 跑出可見範圍。⚠ 在捲動容器裡面「超出去」是正常的（那就是捲動的意思），
  //   所以先往上找最近的捲動祖先；有的話就不算，沒有才拿 #game 的框比。
  const scroller=e=>{let p=e.parentElement; while(p&&p!==document.documentElement){
    const c=getComputedStyle(p); if(/auto|scroll/.test(c.overflowX+c.overflowY)) return p; p=p.parentElement;} return null;};
  for(const e of all){
    if(scroller(e)) continue;
    if(e.closest('[aria-hidden="true"]')) continue;   // 場景視差件之類的純裝飾，本來就會超出舞台邊
    const r=e.getBoundingClientRect();
    if(r.right<gb.left-1||r.left>gb.right+1||r.bottom<gb.top-1||r.top>gb.bottom+1)
      problems.push({kind:'跑出畫面', el:desc(e), detail:`x ${Math.round(r.left)}..${Math.round(r.right)} / 畫面 ${Math.round(gb.left)}..${Math.round(gb.right)}`});
    else if(r.left<gb.left-1||r.right>gb.right+1)
      problems.push({kind:'左右出界', el:desc(e), detail:`x ${Math.round(r.left)}..${Math.round(r.right)} / 畫面 ${Math.round(gb.left)}..${Math.round(gb.right)}`});
  }
  // 3 可以點的東西被蓋住
  for(const e of all){
    if(!/^(button|select|input)$/i.test(e.tagName)) continue;
    if(e.disabled||isHit(e)) continue;
    const r=e.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    if(x<0||y<0||x>innerWidth||y>innerHeight) continue;
    const hit=document.elementFromPoint(x,y);
    if(!hit) continue;
    if(hit!==e && !e.contains(hit) && !hit.contains(e))
      problems.push({kind:'被蓋住', el:desc(e), detail:`中心點命中 ${desc(hit)}`});
  }
  // 4 按鈕互相重疊超過一半
  const btns=all.filter(e=>/^button$/i.test(e.tagName)&&!isHit(e)).map(e=>({e,r:e.getBoundingClientRect()}));
  for(let i=0;i<btns.length;i++)for(let j=i+1;j<btns.length;j++){
    const a=btns[i],b=btns[j];
    if(a.e.contains(b.e)||b.e.contains(a.e)) continue;
    const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left);
    const h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);
    if(w<=0||h<=0) continue;
    const share=(w*h)/Math.min(a.r.width*a.r.height, b.r.width*b.r.height);
    if(share>0.5) problems.push({kind:'按鈕疊住', el:desc(a.e), detail:`與 ${desc(b.e)} 重疊 ${Math.round(share*100)}%`});
  }
  return {label, problems};
}"""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--json'); args = ap.parse_args()
    findings, shots = [], []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vw, vh, size in [(1280, 860, '桌機'), (390, 844, '手機')]:
            ctx = b.new_context(viewport={'width': vw, 'height': vh})
            def route(r):
                path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
                if path.is_relative_to(SRC) and path.is_file():
                    r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
                else: r.fulfill(status=404, body='missing')
            ctx.route('**/*', route)
            ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto('http://clicker.test/clicker.html'); pg.wait_for_function('window.Clicker?.state')
            pg.evaluate(SEED_HOME); pg.reload()
            pg.wait_for_function('window.Clicker?.state && !document.getElementById("tap").disabled')
            pg.wait_for_timeout(1500)

            def scan(label):
                pg.wait_for_timeout(500)
                res = pg.evaluate(AUDIT_JS, f'{size}・{label}')
                for pr in res['problems']: findings.append({**pr, 'screen': res['label']})
                name = f"{size}-{label}".replace('／', '-').replace(' ', '')
                pg.screenshot(path=str(OUT / f'{name}.png')); shots.append(name)

            def apoc_on():
                pg.evaluate("()=>{const s=Clicker.state; s.settings.world='apoc';}")
                pg.evaluate("()=>{const A=ApocEconomy,s=Clicker.state; s.apoc=A.gift(A.normalize(s.apoc)); s.apoc=A.drawn({...s.apoc,tickets:40}, ApocPool.slice(0,22).map(c=>c.id)); s.apoc.skills=[s.apoc.roster[0],s.apoc.roster[1],null,null];}")
                pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(1800)

            # ---- 1.0
            scan('主畫面')
            for opener, closer, label in [('roster-open', 'roster-close', '卡冊'),
                                          ('team-open', 'team-close', '編隊'),
                                          ('wardrobe-open', 'wardrobe-close', '商店'),
                                          ('stats-open', 'stats-close', '統計'),
                                          ('prestige-open', 'prestige-close', '換桌布'),
                                          ('scene-open', 'scenes-close', '場景')]:
                pg.eval_on_selector(f'#{opener}', 'e=>e.click()'); scan(label)
                pg.eval_on_selector(f'#{closer}', 'e=>e.click()'); pg.wait_for_timeout(400)
            pg.eval_on_selector('#roster-open', 'e=>e.click()'); pg.wait_for_timeout(600)
            pg.evaluate("()=>document.querySelector('.album-slot:not(.locked)')?.click()"); scan('卡片詳情')
            pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
            pg.eval_on_selector('#draw-five', 'e=>e.click()'); pg.wait_for_timeout(900)
            for _ in range(6):
                if pg.locator('#skip').is_visible(): pg.locator('#skip').click()
                pg.wait_for_timeout(600)
                if not pg.locator('#collect').is_hidden(): break
            scan('招募總覽')
            pg.eval_on_selector('#collect', 'e=>e.click()'); pg.wait_for_timeout(1100)
            if not pg.locator('#draw-summary').is_hidden():
                scan('抽卡結算'); pg.eval_on_selector('#draw-summary-ok', 'e=>e.click()')
            pg.wait_for_timeout(1200)

            # ---- 末世
            apoc_on()
            scan('末世主畫面')
            for opener, closer, label in [('roster-open', 'roster-close', '末世卡冊'),
                                          ('team-open', 'team-close', '末世編隊'),
                                          ('scene-open', 'scenes-close', '末世場景')]:
                pg.eval_on_selector(f'#{opener}', 'e=>e.click()'); scan(label)
                pg.eval_on_selector(f'#{closer}', 'e=>e.click()'); pg.wait_for_timeout(400)
            pg.eval_on_selector('#draw-five', 'e=>e.click()'); pg.wait_for_timeout(900)
            for _ in range(6):
                if pg.locator('#skip').is_visible(): pg.locator('#skip').click()
                pg.wait_for_timeout(600)
                if not pg.locator('#collect').is_hidden(): break
            scan('末世十連')
            if errs: findings.append({'kind': '頁面錯誤', 'el': size, 'detail': '; '.join(errs)[:160], 'screen': size})
            ctx.close()
        b.close()

    by_screen = {}
    for f in findings: by_screen.setdefault(f['screen'], []).append(f)
    for screen in sorted(by_screen):
        print(f'\n=== {screen} ===')
        for f in by_screen[screen][:40]: print(f"  [{f['kind']}] {f['el']}　{f['detail']}")
    print(f'\n掃了 {len(shots)} 個畫面，共 {len(findings)} 條問題。截圖在 {OUT}')
    if args.json: Path(args.json).write_text(json.dumps(findings, ensure_ascii=False, indent=1), encoding='utf-8')
    return 1 if findings else 0


if __name__ == '__main__':
    sys.exit(main())
