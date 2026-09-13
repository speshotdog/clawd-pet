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
  const ids=Object.keys(B.characters); s.collection=Object.fromEntries(ids.map(i=>[i,15])); s.dust={...s.collection};   // 15 張：再抽到一張就升 5★，結算一定有東西可講
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
  const open=[...document.querySelectorAll('.panel,.small-panel,#recruit-layer,#card-zoom,#album-detail,#dust-shop,dialog[open]')]
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
    // 逐軸看：橫向可捲不代表縱向也可以（Codex 複檢 4-1）
    const scrollX=/auto|scroll/.test(c.overflowX), scrollY=/auto|scroll/.test(c.overflowY);
    const dx=e.scrollWidth-e.clientWidth, dy=e.scrollHeight-e.clientHeight;
    // overflow:visible 的字不會被自己的框裁掉，只會被外層「會裁切、又不能捲」的容器裁到——
    // 那就量字形的實際矩形。精裝卡的卡名行框 14px、字形 16px，但外層沒有東西裁它，畫面上是完整的。
    const cutBy=(axis)=>{const rg=document.createRange(); rg.selectNodeContents(e); const t=rg.getBoundingClientRect();
      let p=e.parentElement; while(p&&p!==document.documentElement){const pc=getComputedStyle(p), ov=axis==='x'?pc.overflowX:pc.overflowY;
        if(/auto|scroll/.test(ov)) return false;
        // 內層容得下不代表外層也容得下，要一路查上去（Codex 複檢 C）
        if(ov!=='visible'){const pr=p.getBoundingClientRect();
          if(axis==='x' ? (t.left<pr.left-1||t.right>pr.right+1) : (t.top<pr.top-1||t.bottom>pr.bottom+1)) return true;}
        p=p.parentElement;} return false;};
    const badX = dx>1 && !scrollX && c.textOverflow!=='ellipsis' && (c.overflowX!=='visible' || cutBy('x'));
    const badY = dy>1 && !scrollY && (c.overflowY!=='visible' || cutBy('y'));
    if(badX||badY) problems.push({kind:'字被裁', el:desc(e), detail:`${badX?'橫':''}${badY?'縱':''}向：內容 ${e.scrollWidth}×${e.scrollHeight}，框 ${e.clientWidth}×${e.clientHeight}`});
  }
  // 2 跑出可見範圍。⚠ 在捲動容器裡面「超出去」是正常的（那就是捲動的意思），
  //   所以先往上找最近的捲動祖先；有的話就不算，沒有才拿 #game 的框比。
  // 逐軸找可捲的祖先：橫向可捲的容器裡，縱向超出去還是問題（Codex 複檢 4-1）
  const scrollerOn=(e,axis)=>{let p=e.parentElement; while(p&&p!==document.documentElement){
    const c=getComputedStyle(p); if(/auto|scroll/.test(axis==='x'?c.overflowX:c.overflowY)) return p; p=p.parentElement;} return null;};
  for(const e of all){
    if(e.closest('[aria-hidden="true"]')) continue;   // 場景視差件之類的純裝飾，本來就會超出舞台邊
    const r=e.getBoundingClientRect();
    const sx=scrollerOn(e,'x'), sy=scrollerOn(e,'y');
    const bx=sx?sx.getBoundingClientRect():gb, by=sy?sy.getBoundingClientRect():gb;
    if(!sx && (r.left<gb.left-1||r.right>gb.right+1))
      problems.push({kind:'左右出界', el:desc(e), detail:`x ${Math.round(r.left)}..${Math.round(r.right)} / 可見 ${Math.round(bx.left)}..${Math.round(bx.right)}`});
    if(!sy && (r.top<gb.top-1||r.bottom>gb.bottom+1))
      problems.push({kind:'上下出界', el:desc(e), detail:`y ${Math.round(r.top)}..${Math.round(r.bottom)} / 可見 ${Math.round(by.top)}..${Math.round(by.bottom)}`});
  }
  // 捲到捲動容器可見範圍外的東西，看不到也點不到，捲過去才輪得到它——這時量「被蓋住／疊住」
  // 會量到容器外面的鄰居（例如地圖站點捲到底下，中心點落在頁尾的鍵上）
  const scrolledOut=e=>{const r=e.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
    let p=e.parentElement; while(p&&p!==document.documentElement){const c=getComputedStyle(p);
      if(/auto|scroll/.test(c.overflowX+c.overflowY)){const pr=p.getBoundingClientRect();
        if(x<pr.left||x>pr.right||y<pr.top||y>pr.bottom) return true;}
      p=p.parentElement;} return false;};
  // 3 可以點的東西被蓋住
  for(const e of all){
    if(!/^(button|select|input)$/i.test(e.tagName)) continue;
    if(e.disabled||isHit(e)||scrolledOut(e)) continue;
    const r=e.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    if(x<0||y<0||x>innerWidth||y>innerHeight){
      // 在可捲的容器裡（例如直式的夥伴列是一條左右滑的）捲一下就點得到，不算問題
      const inScroller=(()=>{let p=e.parentElement; while(p&&p!==document.documentElement){
        const c=getComputedStyle(p); if(/auto|scroll/.test(c.overflowX+c.overflowY)) return true; p=p.parentElement;} return false;})();
      if(!inScroller) problems.push({kind:'按鈕在畫面外', el:desc(e), detail:`中心 ${Math.round(x)},${Math.round(y)} / 畫面 ${innerWidth}×${innerHeight}`});
      continue;}
    const hit=document.elementFromPoint(x,y);
    if(!hit) continue;
    if(hit!==e && !e.contains(hit) && !hit.contains(e))
      problems.push({kind:'被蓋住', el:desc(e), detail:`中心點命中 ${desc(hit)}`});
  }
  // 4 按鈕互相重疊超過一半
  const btns=all.filter(e=>/^button$/i.test(e.tagName)&&!isHit(e)&&!scrolledOut(e)).map(e=>({e,r:e.getBoundingClientRect()}));
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


# 精裝典藏包在 iframe 裡：同一套判準，框換成演出頁自己的 #win
FRAME_AUDIT_JS = AUDIT_JS.replace("document.getElementById('game')", "document.getElementById('win')").replace("document.getElementById('game-content')", "document.getElementById('win')")


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

            # 一定要先確認「真的到了那個畫面」，不然可能只是把主畫面冠上「卡冊」的名字掃過去，
            # 所有問題都會躲掉（Codex 複檢 4-2）。expect 是那個畫面必須可見的節點。
            def scan(label, expect=None):
                pg.wait_for_timeout(500)
                screen = size + '・' + label
                for sel in ([expect] if isinstance(expect, str) else (expect or [])):
                    loc = pg.locator(sel)
                    if loc.count() == 0 or not loc.first.is_visible():
                        findings.append({'kind': '畫面沒開', 'el': label, 'detail': '找不到或看不到 ' + sel, 'screen': screen})
                res = pg.evaluate(AUDIT_JS, screen)
                for pr in res['problems']: findings.append({**pr, 'screen': res['label']})
                name = (size + '-' + label).replace('／', '-').replace(' ', '')
                pg.screenshot(path=str(OUT / (name + '.png'))); shots.append(name)

            def go_world(world):
                # 照真人的路走：模式面板 → 點那張卡。直接改 state 再 reload 會跳過切換流程，
                # 切回去時的快取／還原問題就全部躲掉了（Codex 複檢 4-2）
                pg.eval_on_selector('#mode-open', 'e=>e.click()'); pg.wait_for_timeout(500)
                pg.eval_on_selector('.mode-card[data-mode="' + world + '"]', 'e=>e.click()'); pg.wait_for_timeout(1500)

            def scan_frame(label):
                frame = next(f for f in pg.frames if f.url.endswith('apoc/ceremony.html'))
                screen = size + '・' + label
                res = frame.evaluate(FRAME_AUDIT_JS, screen)
                for pr in res['problems']: findings.append({**pr, 'screen': res['label']})
                name = (size + '-' + label).replace('／', '-').replace(' ', '')
                pg.screenshot(path=str(OUT / (name + '.png'))); shots.append(name)
                return frame

            def apoc_draw(label, collect=True):
                # 末世的十連是精裝典藏包：開包 → 跳過演出 → 結果頁
                pg.eval_on_selector('#draw-five', 'e=>e.click()'); pg.wait_for_timeout(600)
                scan(label + '（典藏包外框）', '#apoc-ceremony')
                frame = next(f for f in pg.frames if f.url.endswith('apoc/ceremony.html'))
                frame.wait_for_function("()=>window.ApocCeremony && ApocCeremony.state().entryPhase==='waiting'", timeout=20000)
                scan_frame(label + '・開包')
                frame.eval_on_selector('#entry-pack', 'e=>e.click()'); pg.wait_for_timeout(1500)
                frame.evaluate("()=>{const b=document.getElementById('revealall'); if(b&&!b.hidden) b.click();}")
                frame.wait_for_function("()=>ApocCeremony.state().collectable", timeout=30000)
                pg.wait_for_timeout(500)
                scan_frame(label + '・結果')
                if collect:
                    frame.eval_on_selector('#finish', 'e=>e.click()'); pg.wait_for_timeout(1000)

            # ---- 1.0
            HOME_MAIN = ['#tap', '#bag-image', '#slots .skill-slot', '#buddies .buddy']
            scan('主畫面', HOME_MAIN)
            PANELS = [('roster-open', 'roster-close', '卡冊', '#roster .album-slot'),
                      ('team-open', 'team-close', '編隊', '#team-editor #t20-caps'),
                      ('wardrobe-open', 'wardrobe-close', '商店', '#wardrobe #shop-cats'),
                      ('stats-open', 'stats-close', '統計', ['#stats #stats-tiles .stat-tile', '#stats #badge-grid']),
                      ('prestige-open', 'prestige-close', '換桌布', '#prestige #prestige-body'),
                      ('scene-open', 'scenes-close', '場景', '#scenes .scene-ticket'),
                      ('mode-open', 'modes-close', '模式', '#modes .mode-card')]
            for opener, closer, label, expect in PANELS:
                pg.eval_on_selector(f'#{opener}', 'e=>e.click()'); scan(label, expect)
                pg.eval_on_selector(f'#{closer}', 'e=>e.click()'); pg.wait_for_timeout(400)
            pg.eval_on_selector('#roster-open', 'e=>e.click()'); pg.wait_for_timeout(600)
            pg.evaluate("()=>document.querySelector('.album-slot:not(.locked)')?.click()"); scan('卡片詳情', '#album-detail .detail-info')
            pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
            pg.eval_on_selector('#draw-five', 'e=>e.click()'); pg.wait_for_timeout(900)
            for _ in range(6):
                if pg.locator('#skip').is_visible(): pg.locator('#skip').click()
                pg.wait_for_timeout(600)
                if not pg.locator('#collect').is_hidden(): break
            # 第四輪：「新夥伴／升星」直接標在結果卡上（不再有收下後的「收下了！」視窗）。
            # 五連一定會有新夥伴或升星，徽章就一定要出現——「有才掃」等於沒驗（Codex 第二輪 A11）
            scan('招募總覽', ['#cards .card', '#cards .draw-badge'])
            pg.eval_on_selector('#collect', 'e=>e.click()'); pg.wait_for_timeout(1200)

            # ---- 末世（從模式面板走過去）
            go_world('apoc')
            pg.evaluate("()=>{const A=ApocEconomy,s=Clicker.state; s.apoc=A.drawn({...A.normalize(s.apoc),tickets:40}, ApocPool.slice(0,22).map(c=>c.id)); s.apoc.skills=[s.apoc.roster[0],s.apoc.roster[1],null,null];}")
            pg.wait_for_timeout(1400)
            # 第四輪：末世一進來是戰鬥畫面，地圖要從頂列「地圖」打開
            pg.eval_on_selector('#scene-open', 'e=>e.click()'); pg.wait_for_timeout(800)
            scan('末世地圖', ['#apoc-map .map-station', '#map-enter'])
            pg.eval_on_selector('.map-station.boss', 'e=>e.click()'); scan('末世地圖・選王關', '#map-title')
            pg.eval_on_selector('#map-back', 'e=>e.click()'); pg.wait_for_timeout(300)
            pg.eval_on_selector('#map-enter', 'e=>e.click()'); pg.wait_for_timeout(900)
            scan('末世主畫面', ['#apoc-enemy', '#slots .skill-slot', '#buddies .buddy'])
            for opener, closer, label, expect in [('roster-open', 'roster-close', '末世卡冊', '#roster .album-slot'),
                                                  ('team-open', 'team-close', '末世編隊', '#team-editor #t20-caps'),
                                                  ('mode-open', 'modes-close', '末世模式', '#modes .mode-card')]:
                pg.eval_on_selector(f'#{opener}', 'e=>e.click()'); scan(label, expect)
                pg.eval_on_selector(f'#{closer}', 'e=>e.click()'); pg.wait_for_timeout(400)
            # 末世的卡片詳情與編隊挑選器（第一輪漏掉的畫面）
            pg.eval_on_selector('#roster-open', 'e=>e.click()'); pg.wait_for_timeout(700)
            pg.evaluate("()=>document.querySelector('.album-slot:not(.locked)')?.click()")
            scan('末世卡片詳情', ['#album-detail .detail-info', '#album-detail .zoom-btn'])
            # 第四輪：放大鏡 → 卡到畫面正中間、背景變暗
            pg.eval_on_selector('#album-detail .zoom-btn', 'e=>e.click()'); pg.wait_for_timeout(700)
            scan('末世卡片放大', ['#card-zoom .zoom-card', '#card-zoom .zoom-close'])
            pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
            pg.eval_on_selector('#roster-close', 'e=>e.click()'); pg.wait_for_timeout(400)
            pg.eval_on_selector('#team-open', 'e=>e.click()'); pg.wait_for_timeout(700)
            pg.evaluate("()=>document.querySelector('#t20-skills .skill-slot')?.click()")
            scan('末世技能挑選器', '#t20-picker-grid .team-proxy')
            pg.evaluate("()=>document.getElementById('t20-picker-close')?.click()"); pg.wait_for_timeout(300)
            pg.eval_on_selector('#team-close', 'e=>e.click()'); pg.wait_for_timeout(400)
            # 末世結局
            pg.evaluate("()=>{const a=Clicker.state.apoc; a.progress=19; a.stage=null; a.cleared=false;}"); pg.wait_for_timeout(1200)
            pg.eval_on_selector('#boss-challenge', 'e=>e.click()'); pg.wait_for_timeout(500)
            pg.evaluate("()=>{if(Clicker.state.apoc.stage) Clicker.state.apoc.stage.hp=1;}")
            for _ in range(30):
                pg.evaluate("()=>document.getElementById('tap').click()"); pg.wait_for_timeout(40)
                if pg.evaluate("()=>Clicker.state.apoc.progress") >= 20: break
            pg.wait_for_timeout(900)
            scan('末世結局', '#apoc-ending-close')
            pg.eval_on_selector('#apoc-ending-close', 'e=>e.click()'); pg.wait_for_timeout(500)
            pg.evaluate("()=>{const a=Clicker.state.apoc; a.progress=2; a.stage=null;}"); pg.wait_for_timeout(1000)
            apoc_draw('末世十連', collect=False)
            # 抽完不收下就重新整理：pending 要還原得回來（不然玩家卡在沒有按鈕的畫面）
            pg.reload(); pg.wait_for_function('window.Clicker?.state'); pg.wait_for_timeout(2200)
            frame = next(f for f in pg.frames if f.url.endswith('apoc/ceremony.html'))
            frame.wait_for_function("()=>window.ApocCeremony && ApocCeremony.state().collectable", timeout=30000)
            scan_frame('末世重開後的待收下')
            frame.eval_on_selector('#finish', 'e=>e.click()'); pg.wait_for_timeout(1200)   # 第四輪：收下就回遊戲，沒有結算視窗
            # 切回原本的桌邊場景：共用節點的快取與還原有沒有做好
            go_world('home')
            scan('切回桌邊', HOME_MAIN)
            # 兩套 renderer 共用同一組節點，各有「內容沒變就不重畫」的快取。切回桌邊時如果沒把快取
            # 作廢，夥伴列與技能格會留著末世的卡圖。這條專門抓那個（Codex 複檢 1-1）。
            leftover = pg.evaluate("()=>[...document.querySelectorAll('#buddies .holo-face, #slots .holo-face, #slots .apoc-sticker')]"
                                   ".map(e=>(e.closest('.buddy,.skill-slot')?.textContent||'').trim())")
            if leftover:
                findings.append({'kind': '殘留上個世界的卡圖', 'el': '#buddies / #slots',
                                 'detail': '%d 張還是末世的精裝卡面：%s' % (len(leftover), leftover[0]),
                                 'screen': size + '・切回桌邊'})
            for opener, closer, label, expect in PANELS[:2]:
                pg.eval_on_selector('#' + opener, 'e=>e.click()'); scan('回桌邊-' + label, expect)
                pg.eval_on_selector('#' + closer, 'e=>e.click()'); pg.wait_for_timeout(400)
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
