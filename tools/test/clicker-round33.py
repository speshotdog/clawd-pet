# -*- coding: utf-8 -*-
"""第三十三輪驗收：
  ·略過改成「快轉」：沒抽過的卡會停下來把翻牌演出播完，重複卡直接掃過去
  ·逃生口：快轉中再按一次＝真的全部略過
  ·restore()（重開視窗還原沒收下的結果）不可以重播新卡演出
  ·拆包面上不再有別的熱區（技能槽搬出舞台、今日限定包讓開）
  ·三連包的落點換算在直式也對（修好前點第一、二包都會開到第三包）
用法：PYTHONIOENCODING=utf-8 python tools/test/clicker-round33.py"""
import mimetypes, sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SRC, OUT = ROOT / 'src', ROOT / '_art/out'
fails = []


def check(ok, msg):
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok:
        fails.append(msg)


def seed(owned):
    """owned=None 代表整本圖鑑都有（抽出來全是重複卡）；給數字代表只擁有前 n 隻。"""
    pick = 'ids' if owned is None else 'ids.slice(0, %d)' % owned
    return """() => { const S=ClickerSave,B=ClickerBalance,E=ClickerEconomy; const s=S.fresh(Date.now());
      const ids=Object.keys(B.characters); const mine=%s;
      s.collection=Object.fromEntries(mine.map(i=>[i,5])); s.partnerLevels=Object.fromEntries(mine.map(i=>[i,20]));
      s.clickLevel=60; s.trainingLevel=10; s.coins=1e14; s.lifetimeCoins=1e15;
      s.manualClicks=50; s.claimedMilestones=['tutorial50'];
      s.settings.scene='backyard'; s.package=E.newPackage('backyard',30);
      S.validate(s,GachaPool); sessionStorage.setItem('test-seed',JSON.stringify(s)); }""" % pick


def open_page(p, w, h, mobile, owned=None):
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2,
                        is_mobile=mobile, has_touch=mobile, reduced_motion='no-preference')

    def route(r):
        path = (SRC / unquote(urlparse(r.request.url).path).lstrip('/')).resolve()
        if not path.is_relative_to(SRC) or not path.is_file():
            r.fulfill(status=404, body='missing')
            return
        r.fulfill(body=path.read_bytes(),
                  content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    ctx.route('**/*', route)
    ctx.add_init_script("const s=sessionStorage.getItem('test-seed'); if(s){localStorage.setItem('clicker_save',s);sessionStorage.removeItem('test-seed');}")
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto('http://clicker.test/clicker.html')
    pg.wait_for_function('window.Clicker?.state')
    pg.evaluate(seed(owned))
    pg.reload()
    pg.wait_for_function('!document.getElementById("tap").disabled')
    pg.wait_for_timeout(1400)
    return b, pg, errors


SAMPLE = """()=>({flipped:document.querySelectorAll('#cards .card.flipped').length,
  hint:document.getElementById('recruit-hint').textContent,
  skipText:document.getElementById('skip').textContent,
  collect:!document.getElementById('collect').hidden})"""


def watch(pg, limit=140, step=60):
    """按下略過之後逐幀取樣，回傳 (毫秒, 翻開張數序列, 出現過的新夥伴提示)"""
    flips, hints = [], set()
    for i in range(limit):
        pg.wait_for_timeout(step)
        d = pg.evaluate(SAMPLE)
        flips.append(d['flipped'])
        if d['hint'].startswith('新夥伴'):
            hints.add(d['hint'])
        if d['collect']:
            return (i + 1) * step, flips, hints
    return limit * step, flips, hints


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        # ───────── 快轉遇到新卡會停 ─────────
        b, pg, errors = open_page(p, 390, 844, True, owned=6)
        pg.wait_for_function('!document.getElementById("draw-five").disabled', timeout=15000); pg.locator('#draw-five').click()   # v3：強存檔幾秒就過一隻小王，勝利演出那一下鍵會暫時鎖住
        pg.wait_for_timeout(900)
        entries = pg.evaluate("()=>Clicker.state.pending.draw.entries.map(e=>({name:e.entry.name,dup:e.dup}))")
        fresh = [e['name'] for e in entries if not e['dup']]
        check(len(fresh) >= 2, '這一包裡有 %d 張沒抽過的卡可以測：%s' % (len(fresh), fresh))
        check(pg.eval_on_selector('#skip', 'e=>e.textContent').strip() == '略過演出', '按之前是「略過演出」')
        pg.locator('#skip').click()
        ms, flips, hints = watch(pg)
        check(hints == {'新夥伴・' + n for n in fresh},
              '每一張新卡都停下來、而且提示打出它的名字：%s' % sorted(hints))
        # 一張一張翻＝翻開張數是逐步增加的，不是 0 直接跳到 5
        steps = len({f for f in flips if 0 < f < 5})
        check(steps >= max(1, len(fresh) - 1),
              '翻開張數是一張一張increment的（看得到中間狀態 %d 種）：%s' % (steps, flips[:24]))
        check(ms > 1000, '有真的停下來播演出，不是瞬間全開（%dms）' % ms)
        check(errors == [], '快轉沒有 JS 錯誤：%s' % errors)
        pg.screenshot(path=str(OUT / 'r33-fastforward.png'))

        # ───────── restore()：還原不可以重播 ─────────
        # 還沒收下就重整，pending 會被還原成靜態總覽
        pg.reload()
        pg.wait_for_function('!document.getElementById("tap").disabled')
        pg.wait_for_timeout(1500)
        st = pg.evaluate("""()=>({flipped:document.querySelectorAll('#cards .card.flipped').length,
          cards:document.querySelectorAll('#cards .card').length,
          collect:!document.getElementById('collect').hidden,
          skipHidden:document.getElementById('skip').hidden,
          hint:document.getElementById('recruit-hint').textContent})""")
        check(st['cards'] == 5 and st['flipped'] == 5 and st['collect'],
              '重開之後直接是全部翻開的總覽、收下鍵在：%s' % st)
        check(not st['hint'].startswith('新夥伴'),
              '還原沒有重播新卡演出（不會讓玩家以為又抽了一次）：「%s」' % st['hint'])
        check(errors == [], '還原沒有 JS 錯誤：%s' % errors)
        b.close()

        # ───────── 全是重複卡時，快轉要真的快 ─────────
        b, pg, errors = open_page(p, 390, 844, True, owned=None)
        pg.wait_for_function('!document.getElementById("draw-five").disabled', timeout=15000); pg.locator('#draw-five').click()   # v3：強存檔幾秒就過一隻小王，勝利演出那一下鍵會暫時鎖住
        pg.wait_for_timeout(900)
        alldup = pg.evaluate("()=>Clicker.state.pending.draw.entries.every(e=>e.dup)")
        check(alldup, '整本圖鑑都有的存檔抽出來全是重複卡')
        pg.locator('#skip').click()
        ms, flips, hints = watch(pg, limit=60)
        check(not hints, '沒有新卡就不會停：完全沒有出現新夥伴提示')
        check(ms <= 900, '重複卡整排掃過去很快（%dms）' % ms)

        # ───────── 逃生口：再按一次＝全部略過 ─────────
        pg.locator('#collect').click()
        pg.wait_for_timeout(2600)
        b.close()
        b, pg, errors = open_page(p, 390, 844, True, owned=6)
        pg.wait_for_function('!document.getElementById("draw-five").disabled', timeout=15000); pg.locator('#draw-five').click()   # v3：強存檔幾秒就過一隻小王，勝利演出那一下鍵會暫時鎖住
        pg.wait_for_timeout(900)
        pg.locator('#skip').click()
        pg.wait_for_timeout(240)
        check(pg.eval_on_selector('#skip', 'e=>e.textContent').strip() == '全部略過',
              '按下快轉之後按鈕變成「全部略過」，逃生口看得見')
        pg.locator('#skip').click()
        pg.wait_for_timeout(400)
        check(not pg.eval_on_selector('#collect', 'e=>e.hidden'),
              '再按一次馬上跳到總覽，不會被關在自己按的快轉裡')
        check(errors == [], '逃生口沒有 JS 錯誤：%s' % errors)
        b.close()

        # ───────── 拆包面上不該有別的熱區 ─────────
        HIT = """()=>{const tap=document.getElementById('tap'), tr=tap.getBoundingClientRect();
          const hits={}; let n=0;
          for(let x=tr.left+1;x<tr.right;x+=2) for(let y=tr.top+1;y<tr.bottom;y+=2){ n++;
            const el=document.elementFromPoint(x,y); let k='(none)';
            if(el){const u=el.closest('.skill-use'), s=el.closest('.skill-slot');
              k = u?'skill-use' : s?'skill-slot' : (el.id?('#'+el.id):(el.className||el.tagName));}
            hits[k]=(hits[k]||0)+1;}
          return {n, hits};}"""
        b, pg, errors = open_page(p, 390, 844, True, owned=None)
        d = pg.evaluate(HIT)
        other = {k: v for k, v in d['hits'].items() if k != '#tap'}
        check(not other, '直式：珍母身上 100%% 都是拆包，沒有別的熱區（修好前只有 85.6%%）：%s' % other)

        # 技能槽在舞台外面、跟拆包鍵不相交
        geo = pg.evaluate("""()=>{const st=document.getElementById('stage'), sl=document.getElementById('slots');
          const tr=document.getElementById('tap').getBoundingClientRect(), sr=sl.getBoundingClientRect(),
                str=st.getBoundingClientRect();
          const ox=Math.max(0,Math.min(sr.right,tr.right)-Math.max(sr.left,tr.left));
          const oy=Math.max(0,Math.min(sr.bottom,tr.bottom)-Math.max(sr.top,tr.top));
          return {inStage:st.contains(sl), overlapTap:+(ox*oy).toFixed(0),
                  belowStage:sr.top>=str.bottom-1, y:+sr.top.toFixed(0), h:+sr.height.toFixed(0),
                  slots:sl.querySelectorAll('.skill-slot').length,
                  want:Clicker.state.skillSlots.length};}""")
        check(not geo['inStage'], '技能槽已經不是舞台的子元素：%s' % geo)
        check(geo['overlapTap'] == 0, '技能槽跟拆包鍵完全不相交：交集 %d px²' % geo['overlapTap'])
        check(geo['belowStage'], '直式技能槽自成一列、排在舞台下面：%s' % geo)
        # 第四槽要花印記解鎖，這個存檔只有三槽——比對存檔實際的槽數，不要寫死 4
        check(geo['slots'] == geo['want'] >= 3, '槽數跟存檔一致（%d 個）' % geo['slots'])

        # 今日限定包也讓開了
        daily = pg.evaluate("""()=>{const d=document.getElementById('daily-bag'); if(!d) return null;
          const r=d.getBoundingClientRect(), t=document.getElementById('tap').getBoundingClientRect();
          const ox=Math.max(0,Math.min(r.right,t.right)-Math.max(r.left,t.left));
          const oy=Math.max(0,Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top));
          return {overlap:+(ox*oy).toFixed(0), hidden:d.hidden};}""")
        check(daily and daily['overlap'] == 0,
              '今日限定包不再壓在拆包鍵上（修好前疊了 3680 舞台 px²）：%s' % daily)

        # ───────── 三連包的落點換算 ─────────
        sub = pg.evaluate("""()=>{document.querySelectorAll('.sub-hot').forEach(e=>e.hidden=false);
          const sb=document.getElementById('stage').getBoundingClientRect(), k=sb.width/608;
          return [...document.querySelectorAll('.sub-hot')].map(h=>{const r=h.getBoundingClientRect();
            const px=16+((r.left+r.right)/2-sb.left)/k;
            const picked=[380,442,504].map((c,i)=>[Math.abs(px-16-c),i]).sort((a,b)=>a[0]-b[0])[0][1];
            return {declared:Number(h.dataset.sub), picked};});}""")
        bad = [r for r in sub if r['declared'] != r['picked']]
        check(len(sub) == 3 and not bad,
              '直式三連包點哪一包就開哪一包（修好前第一、二包都會開到第三包）：%s' % sub)
        check(errors == [], '直式沒有 JS 錯誤：%s' % errors)
        pg.screenshot(path=str(OUT / 'r33-portrait-home.png'))
        b.close()

        # ───────── 矮螢幕：多一條技能列之後底部分頁不能被擠出畫面 ─────────
        # ⚠ #game-content 是 overflow:hidden，被擠出去的分頁是「按不到」，不是「捲得到」
        SHORT = """()=>{const f=document.querySelector('footer').getBoundingClientRect(),
          g=document.getElementById('game-content'),
          sl=document.getElementById('slots').getBoundingClientRect();
          return {footBottom:Math.round(f.bottom), vh:innerHeight,
                  overflow:g.scrollHeight>g.clientHeight+1, slotH:Math.round(sl.height)};}"""
        for W, H in [(390, 667), (320, 640)]:
            b, pg, errors = open_page(p, W, H, True, owned=None)
            d = pg.evaluate(SHORT)
            check(d['footBottom'] <= d['vh'] + 1 and not d['overflow'],
                  '%dx%d：底部分頁還在畫面內、內容沒有溢出：%s' % (W, H, d))
            check(errors == [], '%dx%d 沒有 JS 錯誤：%s' % (W, H, errors))
            b.close()

        # ───────── 橫式：技能槽位置一分不差、拆包面只剩技能鍵 ─────────
        b, pg, errors = open_page(p, 1280, 860, False, owned=None)
        land = pg.evaluate("""()=>[...document.querySelectorAll('.skill-slot')].map(e=>{
          const r=e.getBoundingClientRect(); return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];})""")
        want = [[95, 400, 80, 80], [195, 400, 80, 80], [295, 400, 80, 80], [395, 400, 80, 80]][:len(land)]
        check(land == want and len(land) >= 3,
              '橫式技能槽搬出舞台之後畫面位置一分不差（1280×860 下仍是 95/195/295… @400）：%s' % land)
        d = pg.evaluate(HIT)
        other = {k: v for k, v in d['hits'].items() if k != '#tap'}
        check(set(other) <= {'skill-use'},
              '橫式：拆包面上只剩技能鍵本身（今日限定包與槽容器都不再吃點擊）：%s' % other)
        check(errors == [], '橫式沒有 JS 錯誤：%s' % errors)
        b.close()

    print('\n截圖 _art/out/r33-fastforward.png ／ r33-portrait-home.png')
    print('\n全部通過' if not fails else '\n%d 條沒過：\n%s' % (len(fails), '\n'.join(fails)))
    sys.exit(1 if fails else 0)


main()
